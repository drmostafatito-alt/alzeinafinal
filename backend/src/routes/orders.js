import { Hono } from 'hono';
import { first, all, run } from '../lib/db.js';
import { created, fail, nowIso, parseJson, round2, stringify, uuid } from '../lib/response.js';
import { optionalAuth, protect } from '../middleware/auth.js';
import { calculateShipping, calculatePaymentFee, calculateTax, couponValid, couponDiscount, couponApplies } from '../services/pricing.js';
import { getSettings } from '../services/settings.js';
import { countryMiddleware, methodAvailableInCountry, shippingForCountry } from '../services/country.js';
import { productShape, productAvailableInCountry, unitPriceForCountry } from './catalog.js';
import { qrSvgDataUri } from '../utils/qr.js';
import { recordReceipt, notifyAdmins, auditLog } from '../services/paymentVerification.js';

const app = new Hono();
/* المرحلة D/J: البلد يُحسم خادمياً قبل أي حساب أموال — لا ثقة بأي بلد/عملة من العميل */
app.use('*', countryMiddleware);

const orderNumber = async (env) => {
  /* إصلاح جذري: كان الرقم يُحسب بـ COUNT(*) — بعد حذف أي طلبات من اليوم
     (يدوي أو عبر Reset Center) يقل العدد عن أكبر رقم موجود، فيتكرر رقم قديم
     ويفشل إنشاء الطلب بـ UNIQUE constraint على orderNumber.
     الحساب الصحيح: أكبر رقم موجود اليوم + 1 (يتحمل الفجوات والحذف). */
  const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const prefix = `AZ-${today}-`;
  const row = await env.DB.prepare('SELECT orderNumber FROM orders WHERE orderNumber LIKE ? ORDER BY orderNumber DESC LIMIT 1').bind(`${prefix}%`).first();
  let max = 0;
  if (row?.orderNumber) {
    const n = parseInt(String(row.orderNumber).slice(prefix.length), 10);
    if (Number.isFinite(n) && n > 0) max = n;
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
};

async function serializeOrder(env, row, includeItems = true) {
  if (!row) return null;
  const order = { ...row, _id:row.id, shippingAddress:parseJson(row.shippingAddress,{}), paymentVerification:parseJson(row.paymentVerification,{state:'none',history:[]}), financialSnapshot:parseJson(row.financialSnapshot,{}), statusHistory:parseJson(row.statusHistory,[]), activity:parseJson(row.activity,[]), adminNotes:parseJson(row.adminNotes,[]) };
  if (includeItems) order.items = await all(env.DB.prepare('SELECT * FROM order_items WHERE orderId=?').bind(row.id));
  const user = row.userId ? await first(env.DB.prepare('SELECT id,name,email,phone FROM users WHERE id=?').bind(row.userId)) : null;
  order.user = user ? { ...user, _id:user.id } : undefined;
  return order;
}

app.post('/', optionalAuth, async c => {
  const body = await c.req.json().catch(()=>({}));
  const settings = await getSettings(c.env);
  /* البلد النهائي — من resolveCountry فقط. أي country/currency في جسم الطلب يُتجاهل تماماً. */
  const country = c.get('country');
  const countryRow = c.get('countryRow');
  const shipRules = shippingForCountry(settings.shipping, countryRow);
  if (!c.get('user') && settings.features?.guestCheckout === false) return fail(c,'يرجى تسجيل الدخول لإتمام الطلب',401);
  if (!body.shippingAddress || !body.paymentMethod || !Array.isArray(body.items) || !body.items.length) return fail(c,'بيانات الطلب غير مكتملة',400);
  if (!body.governorateCode && !body.governorateId) return fail(c,'يجب اختيار المحافظة',400);
  const rawAddr = typeof body.shippingAddress === 'string' ? JSON.parse(body.shippingAddress) : body.shippingAddress;
  const addr = { ...rawAddr, governorateCode: body.governorateCode || body.governorateId || rawAddr?.governorateCode };
  if (!addr?.phone || !addr?.street || !addr?.city) return fail(c,'عنوان الشحن غير مكتمل',400);
  const method = await first(c.env.DB.prepare('SELECT * FROM payment_methods WHERE code=? AND isActive=1 AND isVisible=1').bind(String(body.paymentMethod).toLowerCase()));
  if (!method) return fail(c,'طريقة الدفع غير متاحة حالياً',400);
  /* وسيلة الدفع يجب أن تكون متاحة في هذا البلد (config.countries داخل D1).
     هجوم X-Country:AE + instapay يُرفض هنا — إخفاء الواجهة وحده لا يكفي أبداً. */
  if (!methodAvailableInCountry(method, country)) return fail(c,'طريقة الدفع غير متاحة لهذا البلد',400);
  const proof = String(body.paymentProof||'').trim(), reference = String(body.paymentReference||'').trim();
  if (method.requiresProof && !proof) return fail(c,`يجب رفع صورة إيصال التحويل لإتمام الدفع عبر ${method.name}`,400);
  if (method.requiresReference && !reference) return fail(c,`رقم عملية التحويل مطلوب للدفع عبر ${method.name}`,400);

  const orderId = uuid(); const now = nowIso();
  const productRows = await all(c.env.DB.prepare(`SELECT p.*, c.name categoryName, b.name brandName FROM products p LEFT JOIN categories c ON c.id=p.category LEFT JOIN brands b ON b.id=p.brand WHERE p.id IN (${body.items.map(()=>'?').join(',')})`).bind(...body.items.map(i=>i.productId)));
  const byId = new Map(productRows.map(p=>[p.id,p]));
  let subtotal=0, frozenCost=0, costComplete=true; const itemRows=[];
  for (const it of body.items) {
    const p = byId.get(it.productId); if (!p || !p.isActive) return fail(c,`المنتج ${it.productId} غير موجود`,400);
    /* إتاحة المنتج في البلد المطلوب — منتج بلا سعر إماراتي صريح لا يُباع في الإمارات أبداً */
    if (!productAvailableInCountry(p, country)) return fail(c,`المنتج ${p.name} غير متوفر في بلدك`,400);
    const variants = parseJson(p.variants,[]); const v = it.variant ? variants.find(x=>x.sku===it.variant || x.name===it.variant) : null;
    const price = unitPriceForCountry(p, v, country);
    const oldPriceItem = country==='AE' ? (p.oldPriceAE ?? null) : p.oldPrice;
    // الكمية يجب أن تكون عدداً صحيحاً موجباً — كمية سالبة/صفرية كانت تسمح بطلب بإجمالي سالب وزيادة المخزون.
    const qty = Math.trunc(Number(it.quantity));
    if (!Number.isFinite(qty) || qty < 1 || qty > 1000) return fail(c,'كمية غير صالحة',400);
    if (p.stock < qty) return fail(c,`المنتج ${p.name} غير متوفر بالكمية المطلوبة`,400);
    const total = round2(price*qty); subtotal += total; frozenCost += (p.cost||0)*qty; if (!p.cost) costComplete=false;
    if (p.stock < qty) return fail(c,`المنتج ${p.name} غير متوفر بالكمية المطلوبة. المتاح: ${p.stock}`,400);
    itemRows.push({ id:uuid(), orderId, productId:p.id, variant:v?.name||it.variant||null, name:v?`${p.name} - ${v.name}`:p.name, sku:v?.sku||it.variant||p.sku, quantity:qty, price, oldPrice:oldPriceItem, discount:p.discount, total, image:p.mainImage, cost:p.cost||0, currency:countryRow.currency, currencySymbol:countryRow.currencySymbol, categoryName:p.categoryName||'', brandName:p.brandName||'', createdAt:now, updatedAt:now });
  }
  let coupon = body.couponCode || body.coupon ? await first(c.env.DB.prepare('SELECT * FROM coupons WHERE code=? OR id=?').bind(String(body.couponCode||'').toUpperCase(), body.coupon || '')) : null;
  if (coupon && !(await couponValid(c.env, coupon, c.get('user')?.id))) coupon = null;
  const couponDisc = coupon ? couponDiscount(coupon, subtotal) : 0;
  /* الشحن: المحافظة/الإمارة تُطابَق داخل البلد المحسوم، وقواعد الشحن من إعداداته هو */
  const quote = await calculateShipping(c.env, settings, { governorateCode:body.governorateCode, governorateId:body.governorateId, subtotal: subtotal-couponDisc, country, countryRow });
  if (!quote.governorate || !quote.governorate.isActive) return fail(c,'المحافظة المختارة غير متاحة',400);
  // الدفع عند الاستلام: يجب احترام إيقافه عاماً (قواعد البلد المدمجة) أو على مستوى المحافظة (codEnabled).
  if (String(body.paymentMethod).toLowerCase() === 'cod') {
    if (shipRules.codEnabled === false) return fail(c,'الدفع عند الاستلام غير متاح حالياً',400);
    if (quote.governorate.codEnabled === false || quote.governorate.codEnabled === 0) return fail(c,'الدفع عند الاستلام غير متاح لهذه المحافظة',400);
  }
  addr.governorateId=quote.governorate.id; addr.governorateName = rawAddr?.language === 'en' ? quote.governorate.nameEn : quote.governorate.name;
  const clientShipping = Number(body.shippingCost);
  if (Number.isFinite(clientShipping) && Math.abs(clientShipping-quote.cost)>0.01) return fail(c,'قيمة الشحن غير صحيحة',400);
  const pay = await calculatePaymentFee(c.env, { methodCode:body.paymentMethod, methodId:body.paymentMethodId, amount: subtotal-couponDisc+quote.cost });
  const tax = calculateTax(settings, subtotal-couponDisc);
  const total = round2(subtotal-couponDisc+quote.cost+pay.fee+tax);
  const needsVerify = Boolean(method.requiresProof || method.requiresReference);
  const statusHistory = [{ status: needsVerify ? 'awaiting-payment':'pending', at:now }];
  /* اللقطة المالية الدائمة: البلد والعملة من صف countries في D1 — لا تأثير لأي تغيير مستقبلي على الطلبات */
  const fin = { country:country, countryName:countryRow.name, countryNameEn:countryRow.nameEn, currency:countryRow.currency, currencySymbol:countryRow.currencySymbol, currencySymbolEn:countryRow.currencySymbolEn, currencyPosition:countryRow.currencyPosition||'after', taxRate:Number(settings.payment?.taxRate)||0, taxIncluded:settings.payment?.taxIncluded!==false, taxName:settings.payment?.taxName||'', taxNameEn:settings.payment?.taxNameEn||'', totalCost:round2(frozenCost), grossProfit:round2(Math.max(0,total-quote.cost-tax-frozenCost)), costComplete, shippingCost:quote.cost, discountTotal:couponDisc, governorate:{id:quote.governorate.id,code:quote.governorate.code,name:quote.governorate.name,nameEn:quote.governorate.nameEn}, capturedAt:now };
  const orderData = { id:orderId, orderNumber: await orderNumber(c.env), userId:c.get('user')?.id||null, guestEmail:body.email||body.guestEmail||c.get('user')?.email||null, guestPhone:body.guestPhone||body.shippingAddress?.phone||null, shippingAddress:stringify(addr), subtotal, discount:0, couponId:coupon?.id||null, couponDiscount:couponDisc, shippingCost:quote.cost, paymentFee:pay.fee, tax, total, paymentMethod:body.paymentMethod, paymentMethodRef:pay.method?.id||method.id, paymentStatus:needsVerify?'awaiting-verification':'pending', orderStatus:needsVerify?'awaiting-payment':'pending', notes:body.notes||'', governorate:quote.governorate?.id||null, paymentReference:reference||null, paymentProof:proof||null, paymentVerification:stringify(needsVerify?{state:'pending',history:[{proof,reference,at:now,state:'pending'}]}:{state:'none',history:[]}), financialSnapshot:stringify(fin), statusHistory:stringify(statusHistory), activity:stringify([{type:'created',at:now,by:c.get('user')?.id||'guest'}]), adminNotes:'[]', estimatedDeliveryFrom:quote.estimate?new Date(Date.now()+quote.estimate.min*86400000).toISOString():null, estimatedDeliveryTo:quote.estimate?new Date(Date.now()+quote.estimate.max*86400000).toISOString():null, countryCode:country, currency:countryRow.currency, currencySymbol:countryRow.currencySymbol, createdAt:now, updatedAt:now };
  const cols = Object.keys(orderData);
  for (const [i,k] of cols.entries()) { if (orderData[k] === undefined) orderData[k] = null; }
  const statements = [c.env.DB.prepare(`INSERT INTO orders (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`).bind(...cols.map(k=>orderData[k]))];
  for (const it of itemRows) {
    Object.keys(it).forEach(k => { if (it[k] === undefined) it[k] = null; });
    const ic=Object.keys(it); statements.push(c.env.DB.prepare(`INSERT INTO order_items (${ic.join(',')}) VALUES (${ic.map(()=>'?').join(',')})`).bind(...ic.map(k=>it[k]))); const p=byId.get(it.productId);
    // Conditional update prevents concurrent checkouts from overselling limited stock.
    statements.push(c.env.DB.prepare('UPDATE products SET stock=stock-?, soldCount=soldCount+? WHERE id=? AND stock>=?').bind(it.quantity,it.quantity,it.productId,it.quantity));
    statements.push(c.env.DB.prepare('INSERT INTO stock_movements(id,productId,userId,type,quantity,beforeStock,afterStock,reason,referenceType,referenceId,createdAt) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(uuid(),it.productId,c.get('user')?.id||null,'sale',-it.quantity,p.stock,p.stock-it.quantity,'order','order',orderId,now));
  }
  if (coupon) {
    statements.push(c.env.DB.prepare('UPDATE coupons SET usedCount=usedCount+1 WHERE id=?').bind(coupon.id));
    if (c.get('user')?.id) statements.push(c.env.DB.prepare('INSERT OR IGNORE INTO coupon_users(couponId,userId,orderId,createdAt) VALUES(?,?,?,?)').bind(coupon.id,c.get('user').id,orderId,now));
  }
  try {
    await c.env.DB.batch(statements);
  } catch (err) {
    if (String(err.message).includes('INSUFFICIENT_STOCK')) return fail(c, 'نفدت الكمية لمنتج أثناء إتمام الطلب، يرجى تحديث السلة والمحاولة مرة أخرى.', 409);
    /* سباق نادر على رقم الطلب (طلبان متزامنان) — نعيد المحاولة برقم أحدث */
    if (String(err.message).includes('UNIQUE') && String(err.message).includes('orderNumber')) {
      const retryNumber = await orderNumber(c.env);
      statements[0] = c.env.DB.prepare(`INSERT INTO orders (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`)
        .bind(...cols.map((k) => (k === 'orderNumber' ? retryNumber : orderData[k])));
      try {
        await c.env.DB.batch(statements);
      } catch (err2) {
        if (String(err2.message).includes('INSUFFICIENT_STOCK')) return fail(c, 'نفدت الكمية لمنتج أثناء إتمام الطلب، يرجى تحديث السلة والمحاولة مرة أخرى.', 409);
        throw err2;
      }
    } else {
      throw err;
    }
  }

  /*
    مراجعة الدفع اليدوي: عند اختيار طريقة تشترط إيصالاً (إنستاباي/محافظ/ميزة)
    يُنشأ صف payment_verifications بحالة pending، والمبلغ من إجمالي الطلب
    المحسوب خادمياً حصراً — أي قيم paymentStatus/verificationStatus/approved
    أرسلها العميل في الـ body لا تُقرأ إطلاقاً.
  */
  if (needsVerify) {
    await recordReceipt(c.env, c, {
      order: { id: orderId, userId: c.get('user')?.id || null, paymentMethod: method.code },
      method,
      amount: total,
      receiptKey: proof ? String(proof).replace(/^\/uploads\//, '') || null : null,
      receiptMimeType: null,
      receiptSize: null,
      receiptUrl: proof || null,
      reference: reference || null,
      customerNote: body.paymentNote || null
    });
  }

  const order = await serializeOrder(c.env, await first(c.env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(orderId)));
  return created(c,{order},'تم إنشاء الطلب بنجاح');
});

/**
 * رفع صورة إيصال (يُستخدم أثناء إتمام الطلب قبل إنشائه).
 * تحقق خادمي صارم: النوع (JPEG/PNG/WebP فقط) + الامتداد + الحجم ≤ 5MB،
 * والمفتاح عشوائي مُولَّد بالكامل — لا يُستخدم اسم ملف العميل أبداً.
 */
const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
const RECEIPT_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const extOf = (name) => String(name || '').split('.').pop().toLowerCase();

const storeReceiptFile = async (c, file, folder = 'proofs') => {
  if (!file || !(file instanceof File)) return { error: 'يرجى اختيار صورة الإيصال' };
  const ext = RECEIPT_TYPES[file.type];
  if (!ext) return { error: 'يُقبل فقط صور JPEG أو PNG أو WebP' };
  if (extOf(file.name) !== ext) return { error: 'امتداد الملف لا يطابق نوعه' };
  if (file.size <= 0 || file.size > RECEIPT_MAX_BYTES) return { error: 'حجم الصورة يجب أن يكون حتى 5 ميجابايت' };
  const key = `${folder}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  await c.env.R2.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  return { key, url: `/uploads/${key}`, mimeType: file.type, size: file.size };
};

app.post('/payment-proof', optionalAuth, async c => {
  const form = await c.req.formData();
  const stored = await storeReceiptFile(c, form.get('file') || form.get('image'));
  if (stored.error) return fail(c, stored.error, 400);
  return created(c, { url: stored.url, thumbnailUrl: stored.url, key: stored.key }, 'تم رفع الإيصال');
});
app.use('/*', protect);

/**
 * إرفاق/إعادة إرفاق إيصال دفع لطلب قائم (مالك الطلب فقط).
 * يُستخدم عندما رُفض إيصال سابق أو لم يُرفع عند إنشاء الطلب.
 * لا يمكن رفع إيصال جديد طالما توجد مراجعة pending (منع التكرار).
 */
app.post('/:id/receipt', async c => {
  const order = await first(c.env.DB.prepare('SELECT * FROM orders WHERE id=? AND userId=?').bind(c.req.param('id'), c.get('user').id));
  if (!order) return fail(c, 'الطلب غير موجود', 404);
  const method = order.paymentMethodRef
    ? await first(c.env.DB.prepare('SELECT * FROM payment_methods WHERE id=?').bind(order.paymentMethodRef))
    : await first(c.env.DB.prepare('SELECT * FROM payment_methods WHERE code=?').bind(order.paymentMethod));

  const form = await c.req.formData();
  const stored = await storeReceiptFile(c, form.get('file') || form.get('image'));
  if (stored.error) return fail(c, stored.error, 400);

  const verification = await recordReceipt(c.env, c, {
    order: { id: order.id, userId: order.userId, paymentMethod: order.paymentMethod, paymentProof: order.paymentProof },
    method,
    amount: order.total,
    receiptKey: stored.key,
    receiptMimeType: stored.mimeType,
    receiptSize: stored.size,
    receiptUrl: stored.url,
    reference: String(form.get('reference') || '').trim() || null,
    customerNote: String(form.get('note') || '').trim() || null
  });
  if (verification instanceof Response) return verification; // رفض منطقي (تكرار/409)
  if (!verification) return fail(c, 'تعذر حفظ الإيصال', 400);
  return created(c, { verification }, 'تم استلام الإيصال — طلبك قيد المراجعة');
});

/** آخر حالة مراجعة دفع لطلب العميل (للشاشة: قيد المراجعة/مقبول/مرفوض + السبب) */
app.get('/:id/verification', async c => {
  const order = await first(c.env.DB.prepare('SELECT id FROM orders WHERE id=? AND userId=?').bind(c.req.param('id'), c.get('user').id));
  if (!order) return fail(c, 'الطلب غير موجود', 404);
  const verification = await first(c.env.DB.prepare(
    'SELECT id,status,amount,receiptUrl,reference,customerNote,adminNote,reviewedAt,createdAt,updatedAt FROM payment_verifications WHERE orderId=? ORDER BY createdAt DESC'
  ).bind(order.id));
  return c.json({ status: 'success', data: { verification: verification || null } });
});

app.get('/', async c => { const rows = await all(c.env.DB.prepare('SELECT * FROM orders WHERE userId=? ORDER BY createdAt DESC').bind(c.get('user').id)); return c.json({status:'success',data:{orders:await Promise.all(rows.map(r=>serializeOrder(c.env,r)))}}); });
app.get('/:id', async c => { const row = await first(c.env.DB.prepare('SELECT * FROM orders WHERE id=? AND userId=?').bind(c.req.param('id'),c.get('user').id)); if (!row) return fail(c,'الطلب غير موجود',404); return c.json({status:'success',data:{order:await serializeOrder(c.env,row)}}); });
app.put('/:id/cancel', async c => {
  const row = await first(c.env.DB.prepare('SELECT * FROM orders WHERE id=? AND userId=?').bind(c.req.param('id'),c.get('user').id)); if (!row) return fail(c,'الطلب غير موجود',404);
  if (['shipped','delivered','cancelled','refunded'].includes(row.orderStatus)) return fail(c,'لا يمكن إلغاء الطلب في حالته الحالية',400);
  const now=nowIso(); const items=await all(c.env.DB.prepare('SELECT * FROM order_items WHERE orderId=?').bind(row.id)); const stmts=[c.env.DB.prepare('UPDATE orders SET orderStatus=?, updatedAt=? WHERE id=?').bind('cancelled',now,row.id)];
  for (const it of items) { stmts.push(c.env.DB.prepare('UPDATE products SET stock=stock+? WHERE id=?').bind(it.quantity,it.productId)); }
  await c.env.DB.batch(stmts); return c.json({status:'success',message:'تم إلغاء الطلب',data:{order:await serializeOrder(c.env,await first(c.env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(row.id)))}});
});
app.get('/:id/invoice', async c => { const row=await first(c.env.DB.prepare('SELECT * FROM orders WHERE id=? AND userId=?').bind(c.req.param('id'),c.get('user').id)); if(!row) return fail(c,'الطلب غير موجود',404); const order=await serializeOrder(c.env,row); const settings=await getSettings(c.env); const html = invoiceHtml(order,settings); return c.html(html,200,{'Content-Type':'text/html; charset=utf-8'}); });

function invoiceHtml(order,s) { const addr=order.shippingAddress||{}; const items=(order.items||[]).map(i=>`<tr><td>${i.name}</td><td>${i.quantity}</td><td>${i.price}</td><td>${i.total}</td></tr>`).join(''); return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>Invoice ${order.orderNumber}</title><style>body{font-family:Arial,'Noto Sans Arabic',sans-serif;padding:32px;color:#111}.card{max-width:820px;margin:auto;border:1px solid #ddd;padding:28px}h1{margin:0 0 8px}.muted{color:#666}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border-bottom:1px solid #eee;padding:10px;text-align:right}.totals{margin-top:18px;text-align:left}.btn{display:inline-block;margin-top:20px;padding:10px 18px;background:#111;color:#fff;border-radius:8px;cursor:pointer}@media print{.btn{display:none}}</style></head><body><div class="card"><h1>${s.invoice?.companyName||s.siteNameAr||'AL-ZEINA'}</h1><div class="muted">${s.invoice?.companyAddress||''} · ${s.invoice?.companyPhone||s.contact?.phone||''}</div><h2>فاتورة ${order.orderNumber}</h2><p>${addr.governorate||''} - ${addr.city||''} - ${addr.street||''}</p><table><thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>${items}</tbody></table><div class="totals"><p>المنتجات: ${order.subtotal}</p><p>الشحن: ${order.shippingCost}</p><p>الضريبة: ${order.tax}</p><h3>الإجمالي: ${order.total} ${order.financialSnapshot?.currencySymbol||''}</h3></div><img src="${qrSvgDataUri(order.orderNumber+' '+order.id)}" alt="QR" style="width:120px;height:120px;margin-top:16px"/><button class="btn" onclick="window.print()">طباعة / حفظ PDF</button></div><script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`; }

export { serializeOrder };
export default app;
