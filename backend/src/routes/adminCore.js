import { Hono } from 'hono';
import { all, first, run, paginateQuery } from '../lib/db.js';
import { ok, created, fail, nowIso, parseJson, stringify, uuid, bool } from '../lib/response.js';
import { admin, adminOrModerator } from '../middleware/auth.js';
import { saveProduct, listProducts, productShape, FriendlyError } from './catalog.js';
import { listVerifications, approveVerification, rejectVerification, auditLog } from '../services/paymentVerification.js';

const app = new Hono();

/** يحوّل خطأ العمل الودّي إلى استجابة 4xx (ويعيد null لغير ذلك حتى يُعاد رميها). */
const friendlyResponse = (c, e) => (e instanceof FriendlyError ? fail(c, e.message, e.status) : null);

app.put('/account/credentials', adminOrModerator, async c => {
  const { currentPassword, newPassword, name } = await c.req.json();
  const u = await first(c.env.DB.prepare('SELECT * FROM users WHERE id=?').bind(c.get('user').id));
  if (newPassword) {
    const { verifyPassword, hashPassword } = await import('../lib/crypto.js');
    if (!await verifyPassword(currentPassword, u.passwordHash)) return fail(c,'كلمة المرور الحالية غير صحيحة',400);
    await run(c.env.DB.prepare('UPDATE users SET passwordHash=?, sessionsValidFrom=?, name=COALESCE(?,name), updatedAt=? WHERE id=?').bind(await hashPassword(newPassword), new Date(Date.now()+1000).toISOString(), name||null, nowIso(), u.id));
  } else {
    await run(c.env.DB.prepare('UPDATE users SET name=?, updatedAt=? WHERE id=?').bind(name||u.name, nowIso(), u.id));
  }
  return ok(c,{message:'saved'});
});
const AR_MONTHS=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const EN_MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const growth=(cur,prev)=>prev?Math.round(((cur-prev)/prev)*100):cur?100:0;
app.get('/dashboard', async c => {
  const now=new Date(); const startThisMonth=new Date(now.getFullYear(),now.getMonth(),1); const startLastMonth=new Date(now.getFullYear(),now.getMonth()-1,1); const twelveAgo=new Date(now.getFullYear()-1,now.getMonth(),1);
  const [products,orders,users,totalSales,thisMonthSales,lastMonthSales,ordersThisMonth,ordersLastMonth,productsThisMonth,productsLastMonth,customersThisMonth,customersLastMonth,monthlyAgg,statusAgg,categoryAgg] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) n FROM products').first(),
    c.env.DB.prepare("SELECT COUNT(*) n FROM orders WHERE orderStatus NOT IN ('cancelled','refunded')").first(),
    c.env.DB.prepare("SELECT COUNT(*) n FROM users WHERE role='user'").first(),
    c.env.DB.prepare("SELECT COALESCE(SUM(total),0) total FROM orders WHERE orderStatus NOT IN ('cancelled','refunded')").first(),
    c.env.DB.prepare("SELECT COALESCE(SUM(total),0) total FROM orders WHERE createdAt>=? AND orderStatus NOT IN ('cancelled','refunded')").bind(startThisMonth.toISOString()).first(),
    c.env.DB.prepare("SELECT COALESCE(SUM(total),0) total FROM orders WHERE createdAt>=? AND createdAt<? AND orderStatus NOT IN ('cancelled','refunded')").bind(startLastMonth.toISOString(),startThisMonth.toISOString()).first(),
    c.env.DB.prepare('SELECT COUNT(*) n FROM orders WHERE createdAt>=?').bind(startThisMonth.toISOString()).first(),
    c.env.DB.prepare('SELECT COUNT(*) n FROM orders WHERE createdAt>=? AND createdAt<?').bind(startLastMonth.toISOString(),startThisMonth.toISOString()).first(),
    c.env.DB.prepare('SELECT COUNT(*) n FROM products WHERE createdAt>=?').bind(startThisMonth.toISOString()).first(),
    c.env.DB.prepare('SELECT COUNT(*) n FROM products WHERE createdAt>=? AND createdAt<?').bind(startLastMonth.toISOString(),startThisMonth.toISOString()).first(),
    c.env.DB.prepare("SELECT COUNT(*) n FROM users WHERE role='user' AND createdAt>=?").bind(startThisMonth.toISOString()).first(),
    c.env.DB.prepare("SELECT COUNT(*) n FROM users WHERE role='user' AND createdAt>=? AND createdAt<?").bind(startLastMonth.toISOString(),startThisMonth.toISOString()).first(),
    all(c.env.DB.prepare("SELECT CAST(strftime('%Y',createdAt) AS INTEGER) y, CAST(strftime('%m',createdAt) AS INTEGER) m, COALESCE(SUM(total),0) sales, COUNT(*) orders FROM orders WHERE orderStatus NOT IN ('cancelled','refunded') AND createdAt>=? GROUP BY y,m ORDER BY y,m").bind(twelveAgo.toISOString())),
    all(c.env.DB.prepare('SELECT orderStatus status, COUNT(*) count FROM orders GROUP BY orderStatus')),
    all(c.env.DB.prepare('SELECT p.category _id, COALESCE(SUM(oi.total),0) value FROM order_items oi LEFT JOIN products p ON p.id=oi.productId GROUP BY p.category ORDER BY value DESC'))
  ]);
  const monthlyMap=new Map(monthlyAgg.map(m=>[`${m.y}-${m.m}`,{sales:m.sales,orders:m.orders}]));
  const monthly=Array.from({length:12},(_,i)=>{const d=new Date(now.getFullYear(),now.getMonth()-11+i,1); const hit=monthlyMap.get(`${d.getFullYear()}-${d.getMonth()+1}`)||{sales:0,orders:0}; return {label:AR_MONTHS[d.getMonth()],labelEn:EN_MONTHS[d.getMonth()],sales:Math.round(hit.sales),orders:hit.orders};});
  const statusCounts=statusAgg.reduce((a,s)=>{a[s.status]=s.count;return a;},{});
  const cats=await all(c.env.DB.prepare('SELECT id,name,nameEn FROM categories')); const catMap=new Map(cats.map(x=>[x.id,x]));
  const revenueByCategory=categoryAgg.map(x=>{const cat=catMap.get(x._id); return {name:cat?.name||'أخرى',nameEn:cat?.nameEn||'Other',value:Math.round(x.value)};});
  const recentOrders=await all(c.env.DB.prepare('SELECT * FROM orders ORDER BY createdAt DESC LIMIT 8'));
  const topProducts=await all(c.env.DB.prepare('SELECT p.id,p.name,p.nameEn,p.mainImage,p.soldCount,COALESCE(SUM(oi.total),0) revenue,COUNT(o.id) orders FROM products p LEFT JOIN order_items oi ON oi.productId=p.id LEFT JOIN orders o ON o.id=oi.orderId GROUP BY p.id ORDER BY revenue DESC,p.soldCount DESC LIMIT 8'));
  const lowStock=await all(c.env.DB.prepare('SELECT * FROM products WHERE stock<=5 ORDER BY stock ASC LIMIT 8'));
  return ok(c,{stats:{totalSales:Math.round(totalSales.total),totalOrders:orders.n,totalProducts:products.n,totalCustomers:users.n,salesGrowth:growth(Number(thisMonthSales.total),Number(lastMonthSales.total)),ordersGrowth:growth(ordersThisMonth.n,ordersLastMonth.n),productsGrowth:growth(productsThisMonth.n,productsLastMonth.n),customersGrowth:growth(customersThisMonth.n,customersLastMonth.n),products:products.n,orders:orders.n,customers:users.n,revenue:totalSales.total,lowStock:lowStock.length},monthly,statusCounts,revenueByCategory,recentOrders,topProducts,lowStock});
});

app.get('/products', async c => ok(c, await listProducts(c.env, c.req.query(), true)));
app.get('/products/export', adminOrModerator, async c => {
  const products = await all(c.env.DB.prepare('SELECT name,nameEn,slug,sku,price,oldPrice,cost,stock,category,brand,description,mainImage,isFeatured,isBestSeller,isNewArrival,isActive FROM products'));
  const headers = ['name','nameEn','slug','sku','price','oldPrice','cost','stock','category','brand','description','image','featured','bestseller','newArrival','active'];
  const lines = [headers.join(','), ...products.map(p => headers.map(h => `"${String(p[h === 'image' ? 'mainImage' : h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  return c.body(lines, 200, { 'Content-Type':'text/csv; charset=utf-8', 'Content-Disposition':'attachment; filename="products.csv"' });
});
app.get('/products/import-template', adminOrModerator, c => c.body(['name','nameEn','slug','sku','price','oldPrice','cost','stock','category','brand','description','image','featured','bestseller','newArrival'].join(',')+'\n',200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="products-template.csv"'}));
app.get('/products/:id', async c => { const p=await first(c.env.DB.prepare('SELECT * FROM products WHERE id=?').bind(c.req.param('id'))); if(!p) return fail(c,'المنتج غير موجود',404); return ok(c,{product:productShape(p)}); });
app.post('/products', adminOrModerator, async c => {
  try { return created(c,{ product: productShape(await saveProduct(c.env, await c.req.json())) }); }
  catch (e) { const r = friendlyResponse(c, e); if (r) return r; throw e; }
});
app.put('/products/:id', adminOrModerator, async c => {
  try { return ok(c,{ product: productShape(await saveProduct(c.env, await c.req.json(), c.req.param('id'))) }); }
  catch (e) { const r = friendlyResponse(c, e); if (r) return r; throw e; }
});
app.delete('/products/:id', adminOrModerator, async c => { await run(c.env.DB.prepare('DELETE FROM products WHERE id=?').bind(c.req.param('id'))); return ok(c,{message:'تم الحذف'}); });
app.post('/products/:id/duplicate', adminOrModerator, async c => {
  const p = await first(c.env.DB.prepare('SELECT * FROM products WHERE id=?').bind(c.req.param('id')));
  if (!p) return fail(c, 'غير موجود', 404);
  const body = { ...productShape(p) };
  delete body.id; delete body._id; delete body.sku; /* sku فريد — يجب توليد واحد جديد وإلا يفشل النسخ بـ UNIQUE constraint */
  body.name = `${p.name} copy`; body.slug = `${p.slug}-copy-${Date.now()}`;
  try { return created(c, { product: productShape(await saveProduct(c.env, body)) }, 'تم إنشاء نسخة من المنتج'); }
  catch (e) { const r = friendlyResponse(c, e); if (r) return r; throw e; }
});

const simpleList = (table, order='createdAt DESC', key='items') => async c => ok(c,{ items: await all(c.env.DB.prepare(`SELECT * FROM ${table} ORDER BY ${order}`)), [key]: await all(c.env.DB.prepare(`SELECT * FROM ${table} ORDER BY ${order}`)) });
app.get('/coupons', async c => {
  const coupons = await all(c.env.DB.prepare('SELECT * FROM coupons ORDER BY createdAt DESC'));
  return ok(c,{ items:coupons, coupons });
});
app.get('/coupons/:id', async c => ok(c,{coupon:await first(c.env.DB.prepare('SELECT * FROM coupons WHERE id=?').bind(c.req.param('id')))}));
app.post('/coupons', adminOrModerator, async c => { const b=await c.req.json(); const id=uuid(), now=nowIso(); await run(c.env.DB.prepare(`INSERT INTO coupons(id,code,description,discountType,discountValue,freeShipping,minOrderAmount,maxDiscount,startDate,endDate,usageLimit,usedCount,perUserLimit,userIds,categories,brands,products,excludedProducts,isActive,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,String(b.code).toUpperCase(),b.description||'',b.discountType,b.discountValue,b.freeShipping?1:0,b.minOrderAmount||0,b.maxDiscount||null,b.startDate,b.endDate,b.usageLimit||1,b.usedCount||0,b.perUserLimit||1,stringify(b.userIds||[]),stringify(b.categories||[]),stringify(b.brands||[]),stringify(b.products||[]),stringify(b.excludedProducts||[]),b.isActive===false?0:1,now,now)); return created(c,{coupon:await first(c.env.DB.prepare('SELECT * FROM coupons WHERE id=?').bind(id))}); });
app.put('/coupons/:id', adminOrModerator, async c => { const b=await c.req.json(), old=await first(c.env.DB.prepare('SELECT * FROM coupons WHERE id=?').bind(c.req.param('id'))); const row={...old,...b,freeShipping:b.freeShipping?1:0,isActive:b.isActive===false?0:1,userIds:stringify(b.userIds||parseJson(old.userIds,[])),categories:stringify(b.categories||parseJson(old.categories,[])),brands:stringify(b.brands||parseJson(old.brands,[])),products:stringify(b.products||parseJson(old.products,[])),excludedProducts:stringify(b.excludedProducts||parseJson(old.excludedProducts,[])),updatedAt:nowIso()}; delete row.id; delete row._id; /* hydrate() يضيف alias _id — كان يكسر UPDATE بـ no such column: _id */ const cols=Object.keys(row); await run(c.env.DB.prepare(`UPDATE coupons SET ${cols.map(x=>`${x}=?`).join(',')} WHERE id=?`).bind(...cols.map(k=>row[k]),c.req.param('id'))); return ok(c,{coupon:await first(c.env.DB.prepare('SELECT * FROM coupons WHERE id=?').bind(c.req.param('id')))}); });
app.delete('/coupons/:id', adminOrModerator, async c => { await run(c.env.DB.prepare('DELETE FROM coupons WHERE id=?').bind(c.req.param('id'))); return ok(c,{message:'deleted'}); });

app.get('/orders', async c => { const {page,limit,offset}=paginateQuery(c.req.query,20,100); const where=[]; const vals=[]; const q=c.req.query(); if(q.status) {where.push('orderStatus=?'); vals.push(q.status)} if(q.paymentStatus) {where.push('paymentStatus=?'); vals.push(q.paymentStatus)} if(q.search) {where.push('(orderNumber LIKE ? OR guestEmail LIKE ? OR guestPhone LIKE ?)'); vals.push(`%${q.search}%`,`%${q.search}%`,`%${q.search}%`)} const ws=where.length?`WHERE ${where.join(' AND ')}`:''; const total=(await c.env.DB.prepare(`SELECT COUNT(*) n FROM orders ${ws}`).bind(...vals).first()).n; const orders=await all(c.env.DB.prepare(`SELECT * FROM orders ${ws} ORDER BY createdAt DESC LIMIT ? OFFSET ?`).bind(...vals,limit,offset)); return ok(c,{orders,pagination:{page,limit,total,pages:Math.ceil(total/limit)}}); });
app.get('/payment-verifications', adminOrModerator, async c => {
  const data = await listVerifications(c.env, c.req.query());
  return ok(c, { ...data, orders: data.verifications.map(v => ({ ...v, _id: v.orderId, orderId: v.orderId, paymentProof: v.receiptUrl, paymentReference: v.reference, paymentMethodRef: { id: v.paymentMethodId, name: v.methodName, nameEn: v.methodNameEn, accountNumber: v.accountNumber } })) });
});
app.get('/payment-verifications/:id', adminOrModerator, async c => {
  const v = await first(c.env.DB.prepare(
    `SELECT pv.*, o.orderNumber, o.guestEmail, o.guestPhone, o.shippingAddress, o.total orderTotal, o.paymentMethod, o.orderStatus, o.createdAt orderCreatedAt,
            pm.name methodName, pm.nameEn methodNameEn, pm.instructions methodInstructions
     FROM payment_verifications pv
     LEFT JOIN orders o ON o.id=pv.orderId
     LEFT JOIN payment_methods pm ON pm.id=pv.paymentMethodId
     WHERE pv.id=?`
  ).bind(c.req.param('id')));
  if (!v) return fail(c, 'المراجعة غير موجودة', 404);
  v._id = v.id; v.shippingAddress = parseJson(v.shippingAddress, {});
  return ok(c, { verification: v });
});
app.post('/payment-verifications/:id/approve', adminOrModerator, async c => {
  const b = await c.req.json().catch(() => ({}));
  const v = await approveVerification(c.env, c, c.req.param('id'), b.adminNote);
  if (v instanceof Response) return v;
  return ok(c, { verification: v }, 'تم تأكيد الدفع');
});
app.post('/payment-verifications/:id/reject', adminOrModerator, async c => {
  const b = await c.req.json().catch(() => ({}));
  if (!String(b.reason || '').trim()) return fail(c, 'سبب الرفض مطلوب', 400);
  const v = await rejectVerification(c.env, c, c.req.param('id'), b.reason);
  if (v instanceof Response) return v;
  return ok(c, { verification: v }, 'تم رفض الدفع');
});
app.get('/orders/search', adminOrModerator, async c => { const q=`%${c.req.query('q')||''}%`; return ok(c,{orders:await all(c.env.DB.prepare('SELECT id,orderNumber,guestEmail,guestPhone,total,orderStatus,createdAt FROM orders WHERE orderNumber LIKE ? OR guestEmail LIKE ? OR guestPhone LIKE ? ORDER BY createdAt DESC LIMIT 20').bind(q,q,q))}); });
app.get('/orders/export', adminOrModerator, async c => { const rows=await all(c.env.DB.prepare('SELECT orderNumber,guestEmail,guestPhone,subtotal,shippingCost,tax,total,paymentStatus,orderStatus,createdAt FROM orders ORDER BY createdAt DESC')); const cols=['orderNumber','guestEmail','guestPhone','subtotal','shippingCost','tax','total','paymentStatus','orderStatus','createdAt']; const csv=[cols.join(','),...rows.map(r=>cols.map(k=>JSON.stringify(r[k]??'')).join(','))].join('\n'); return c.body(csv,200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="orders.csv"'}); });
app.get('/orders/bulk-status', adminOrModerator, c => c.json({status:'error',message:'Method not allowed'},405));
app.get('/orders/:id/timeline', adminOrModerator, async c => { const o=await first(c.env.DB.prepare('SELECT statusHistory,activity,adminNotes,createdAt,updatedAt FROM orders WHERE id=?').bind(c.req.param('id'))); if(!o) return fail(c,'not found',404); return ok(c,{timeline:parseJson(o.statusHistory,[]),activity:parseJson(o.activity,[]),notes:parseJson(o.adminNotes,[]),createdAt:o.createdAt,updatedAt:o.updatedAt}); });
app.post('/orders/bulk-status', adminOrModerator, async c => { const b=await c.req.json(); await c.env.DB.batch((b.ids||[]).map(id=>c.env.DB.prepare('UPDATE orders SET orderStatus=?,updatedAt=? WHERE id=?').bind(b.status,nowIso(),id))); return ok(c,{updated:(b.ids||[]).length}); });
app.post('/orders/:id/notes', adminOrModerator, async c => { const b=await c.req.json(), o=await first(c.env.DB.prepare('SELECT adminNotes FROM orders WHERE id=?').bind(c.req.param('id'))); const notes=parseJson(o.adminNotes,[]); notes.push({id:uuid(),body:b.note||b.body,at:nowIso(),author:c.get('user')?.name}); await run(c.env.DB.prepare('UPDATE orders SET adminNotes=?,updatedAt=? WHERE id=?').bind(stringify(notes),nowIso(),c.req.param('id'))); return created(c,{note:notes.at(-1)}); });
app.delete('/orders/:id/notes/:noteId', adminOrModerator, async c => { const o=await first(c.env.DB.prepare('SELECT adminNotes FROM orders WHERE id=?').bind(c.req.param('id'))); const notes=parseJson(o.adminNotes,[]).filter(n=>n.id!==c.req.param('noteId')); await run(c.env.DB.prepare('UPDATE orders SET adminNotes=?,updatedAt=? WHERE id=?').bind(stringify(notes),nowIso(),c.req.param('id'))); return ok(c,{}); });
app.get('/orders/:id/invoice', adminOrModerator, async c => c.redirect(`/api/v1/orders/${c.req.param('id')}/invoice`));
app.get('/orders/:id/label', adminOrModerator, async c => { const o=await first(c.env.DB.prepare('SELECT orderNumber,shippingAddress,trackingNumber FROM orders WHERE id=?').bind(c.req.param('id'))); const a=parseJson(o.shippingAddress,{}); return c.html(`<!doctype html><html dir="rtl"><meta charset="utf-8"><body style="font-family:Arial;padding:24px"><h2>شحنة ${o.orderNumber}</h2><p>${a.governorate||''} - ${a.city||''} - ${a.street||''}</p><p>${a.phone||''}</p><p>تتبع: ${o.trackingNumber||'-'}</p><button onclick="window.print()" style="padding:10px 16px">طباعة البوليصة</button></body></html>`); });
app.put('/orders/:id/status', adminOrModerator, async c => { const b=await c.req.json(); const o=await first(c.env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(c.req.param('id'))); if(!o) return fail(c,'not found',404); const hist=parseJson(o.statusHistory,[]); hist.push({status:b.status||b.orderStatus,at:nowIso(),note:b.note,by:c.get('user').id}); await run(c.env.DB.prepare('UPDATE orders SET orderStatus=?, statusHistory=?, updatedAt=? WHERE id=?').bind(b.status||b.orderStatus,stringify(hist),nowIso(),o.id)); return ok(c,{message:'updated'}); });
app.put('/orders/:id/shipping', adminOrModerator, async c => { const b=await c.req.json(); await run(c.env.DB.prepare('UPDATE orders SET trackingNumber=?, shippingCompany=?, updatedAt=? WHERE id=?').bind(b.trackingNumber,b.shippingCompany,nowIso(),c.req.param('id'))); return ok(c,{message:'updated'}); });
app.put('/orders/:id/payment-status', adminOrModerator, async c => { const b=await c.req.json(); await run(c.env.DB.prepare('UPDATE orders SET paymentStatus=?, updatedAt=? WHERE id=?').bind(b.paymentStatus,nowIso(),c.req.param('id'))); return ok(c,{message:'updated'}); });
/* مسار التوافق القديم — يوجَّه عبر خدمة المراجعة نفسها حتى لا تتشعب الحالات */
app.post('/orders/:id/payment-verification', adminOrModerator, async c => {
  const b = await c.req.json().catch(() => ({}));
  const o = await first(c.env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(c.req.param('id')));
  if (!o) return fail(c, 'not found', 404);
  if (!['approve', 'reject', 'request-proof'].includes(b.action)) return fail(c, 'إجراء غير معروف', 400);
  if (b.action === 'request-proof') {
    const pv = parseJson(o.paymentVerification, { state: 'none', history: [] });
    pv.state = 'resubmit-requested';
    pv.history = [...(pv.history || []), { state: 'resubmit-requested', note: b.note, at: nowIso(), by: c.get('user').id }];
    await run(c.env.DB.prepare("UPDATE orders SET paymentStatus='pending', paymentVerification=?, updatedAt=? WHERE id=?").bind(stringify(pv), nowIso(), o.id));
    await auditLog(c.env, c, { action: 'payment_resubmit_requested', entity: 'orders', entityId: o.id, label: `طلب إيصال جديد ${o.orderNumber}`, message: 'طلب إيصال جديد' });
    return ok(c, { message: 'updated' });
  }
  // المراجعات الجديدة لها صف في payment_verifications — نستخدمه كمصدر الحقيقة
  const latest = await first(c.env.DB.prepare("SELECT * FROM payment_verifications WHERE orderId=? AND status='pending' ORDER BY createdAt DESC").bind(o.id));
  if (latest) {
    const res = b.action === 'approve'
      ? await approveVerification(c.env, c, latest.id, b.note || b.adminNote)
      : await rejectVerification(c.env, c, latest.id, b.note || b.reason || 'إيصال غير مطابق للمطلوب');
    if (res instanceof Response) return res;
    return ok(c, { message: 'updated', verification: res });
  }
  // طلبات قديمة بلا صف: سلوك التوافق السابق حرفياً
  const pv = parseJson(o.paymentVerification, { state: 'none', history: [] });
  pv.state = b.action;
  pv.history = [...(pv.history || []), { state: b.action, note: b.note, at: nowIso(), by: c.get('user').id }];
  await run(c.env.DB.prepare('UPDATE orders SET paymentStatus=?, orderStatus=?, paymentVerification=?, updatedAt=? WHERE id=?').bind(b.action === 'approve' ? 'paid' : 'rejected', b.action === 'approve' ? 'confirmed' : o.orderStatus, stringify(pv), nowIso(), o.id));
  await auditLog(c.env, c, { action: b.action === 'approve' ? 'payment_approved' : 'payment_rejected', entity: 'orders', entityId: o.id, label: `دفع ${o.orderNumber}`, message: b.action === 'approve' ? 'تم تأكيد الدفع' : 'تم رفض الدفع' });
  return ok(c, { message: 'updated' });
});
app.post('/orders/:id/resend-invoice', adminOrModerator, c => ok(c,{ sent:true, message:'No email provider configured; invoice remains available for download/print.' }));
app.get('/orders/:id', adminOrModerator, async c => { const o=await first(c.env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(c.req.param('id'))); if(!o) return fail(c,'الطلب غير موجود',404); o.items=await all(c.env.DB.prepare('SELECT * FROM order_items WHERE orderId=?').bind(o.id)); o.shippingAddress=parseJson(o.shippingAddress,{}); o.financialSnapshot=parseJson(o.financialSnapshot,{}); o.statusHistory=parseJson(o.statusHistory,[]); o.activity=parseJson(o.activity,[]); o.adminNotes=parseJson(o.adminNotes,[]); o.paymentVerification=parseJson(o.paymentVerification,{}); return ok(c,{order:o}); });

app.get('/users', adminOrModerator, async c => { const {page,limit,offset}=paginateQuery(c.req.query,20,100); const search=c.req.query('search'); let where="WHERE role='user'"; const vals=[]; if(search){where+=' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)'; vals.push(`%${search}%`,`%${search}%`,`%${search}%`)} const total=(await c.env.DB.prepare(`SELECT COUNT(*) n FROM users ${where}`).bind(...vals).first()).n; const users=await all(c.env.DB.prepare(`SELECT * FROM users ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`).bind(...vals,limit,offset)); users.forEach(u=>delete u.passwordHash); return ok(c,{users,pagination:{page,limit,total,pages:Math.ceil(total/limit)}}); });
app.get('/users/:id', adminOrModerator, async c => { const u=await first(c.env.DB.prepare('SELECT * FROM users WHERE id=?').bind(c.req.param('id'))); if(!u) return fail(c,'not found',404); delete u.passwordHash; u.addresses=await all(c.env.DB.prepare('SELECT * FROM addresses WHERE userId=?').bind(u.id)); u.orders=await all(c.env.DB.prepare('SELECT id,orderNumber,total,orderStatus,paymentStatus,createdAt FROM orders WHERE userId=? ORDER BY createdAt DESC').bind(u.id)); return ok(c,{user:u}); });
app.put('/users/:id', admin, async c => { const b=await c.req.json(); await run(c.env.DB.prepare('UPDATE users SET name=?,phone=?,role=?,staffRole=?,isActive=?,updatedAt=? WHERE id=?').bind(b.name,b.phone,b.role||'user',b.staffRole||'',b.isActive?1:0,nowIso(),c.req.param('id'))); return ok(c,{message:'updated'}); });
app.delete('/users/:id', admin, async c => { await run(c.env.DB.prepare('DELETE FROM users WHERE id=?').bind(c.req.param('id'))); return ok(c,{message:'deleted'}); });

app.get('/reviews', adminOrModerator, async c => { const status=c.req.query('status'); const rows=status?await all(c.env.DB.prepare('SELECT r.*, p.name productName FROM reviews r LEFT JOIN products p ON p.id=r.productId WHERE r.status=? ORDER BY r.createdAt DESC').bind(status)):await all(c.env.DB.prepare('SELECT r.*, p.name productName FROM reviews r LEFT JOIN products p ON p.id=r.productId ORDER BY r.createdAt DESC')); return ok(c,{reviews:rows}); });
app.put('/reviews/:id', adminOrModerator, async c => { const b=await c.req.json(); await run(c.env.DB.prepare('UPDATE reviews SET status=?, isActive=?, reply=?, repliedAt=?, updatedAt=? WHERE id=?').bind(b.status,b.isActive===false?0:1,b.reply,b.reply?nowIso():null,nowIso(),c.req.param('id'))); return ok(c,{message:'updated'}); });
app.patch('/reviews/:id/status', adminOrModerator, async c => { const b=await c.req.json(); await run(c.env.DB.prepare('UPDATE reviews SET status=?, updatedAt=? WHERE id=?').bind(b.status,nowIso(),c.req.param('id'))); return ok(c,{message:'updated'}); });
app.post('/reviews/:id/reply', adminOrModerator, async c => { const b=await c.req.json(); await run(c.env.DB.prepare('UPDATE reviews SET reply=?, repliedAt=?, updatedAt=? WHERE id=?').bind(b.reply,nowIso(),nowIso(),c.req.param('id'))); return ok(c,{message:'sent'}); });
app.delete('/reviews/:id', adminOrModerator, async c => { await run(c.env.DB.prepare('DELETE FROM reviews WHERE id=?').bind(c.req.param('id'))); return ok(c,{message:'deleted'}); });

app.get('/messages', adminOrModerator, async c => ok(c,{ items: await all(c.env.DB.prepare('SELECT * FROM messages ORDER BY createdAt DESC')), messages: await all(c.env.DB.prepare('SELECT * FROM messages ORDER BY createdAt DESC')) }));
app.put('/messages/:id/read', adminOrModerator, async c => { await run(c.env.DB.prepare('UPDATE messages SET isRead=1, repliedAt=? WHERE id=?').bind(nowIso(),c.req.param('id'))); return ok(c,{message:'updated'}); });
app.put('/messages/:id/reply', adminOrModerator, async c => ok(c,{message:'sent'}));
app.delete('/messages/:id', adminOrModerator, async c => { await run(c.env.DB.prepare('DELETE FROM messages WHERE id=?').bind(c.req.param('id'))); return ok(c,{message:'deleted'}); });
app.get('/subscribers', adminOrModerator, simpleList('subscribers'));
app.get('/inventory/low', adminOrModerator, async c => ok(c,{products:await all(c.env.DB.prepare('SELECT * FROM products WHERE stock <= ? ORDER BY stock ASC').bind(Number(c.req.query('threshold'))||5))}));
app.put('/inventory/update', adminOrModerator, async c => { const b=await c.req.json(); await run(c.env.DB.prepare('UPDATE products SET stock=?, updatedAt=? WHERE id=?').bind(Number(b.stock),nowIso(),b.productId)); await run(c.env.DB.prepare('INSERT INTO stock_movements(id,productId,userId,type,quantity,beforeStock,afterStock,reason,createdAt) VALUES(?,?,?,?,?,?,?,?,?)').bind(uuid(),b.productId,c.get('user').id,'adjust',0,0,Number(b.stock),b.reason||'manual',nowIso())); return ok(c,{message:'updated'}); });

app.post('/products/bulk', adminOrModerator, async c => {
  const { ids = [], action, value } = await c.req.json();
  if (!ids.length || !action) return fail(c, 'بيانات العملية الجماعية غير مكتملة', 400);
  const ph = ids.map(() => '?').join(',');
  let sql, params;
  switch (action) {
    case 'activate': sql = `UPDATE products SET isActive=1 WHERE id IN (${ph})`; params = ids; break;
    case 'deactivate': sql = `UPDATE products SET isActive=0 WHERE id IN (${ph})`; params = ids; break;
    case 'feature': sql = `UPDATE products SET isFeatured=1 WHERE id IN (${ph})`; params = ids; break;
    case 'category': sql = `UPDATE products SET category=? WHERE id IN (${ph})`; params = [value, ...ids]; break;
    case 'brand': sql = `UPDATE products SET brand=? WHERE id IN (${ph})`; params = [value, ...ids]; break;
    case 'stock': sql = `UPDATE products SET stock=? WHERE id IN (${ph})`; params = [Number(value) || 0, ...ids]; break;
    case 'price': sql = `UPDATE products SET price=? WHERE id IN (${ph})`; params = [Number(value) || 0, ...ids]; break;
    case 'delete': sql = `DELETE FROM products WHERE id IN (${ph})`; params = ids; break;
    default: return fail(c, 'إجراء جماعي غير مدعوم', 400);
  }
  await run(c.env.DB.prepare(sql).bind(...params));
  return ok(c, { updated: ids.length, action });
});

function csvCell(v) { return `"${String(v ?? '').replace(/"/g, '""')}"`; }
function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], nx = text[i+1];
    if (q) { if (ch === '"' && nx === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell=''; } else if (ch === '\n') { row.push(cell); rows.push(row); row=[]; cell=''; } else if (ch !== '\r') cell += ch;
  }
  row.push(cell); rows.push(row);
  return rows.filter(r => r.some(Boolean));
}
app.post('/products/import', adminOrModerator, async c => {
  const { csv, dryRun } = await c.req.json();
  if (!csv || typeof csv !== 'string') return fail(c, 'ملف CSV مطلوب', 400);
  const rows = parseCsv(csv); const headers = rows.shift().map(h => h.trim().toLowerCase());
  const created = [], errors = [];
  for (let i = 0; i < rows.length; i++) {
    const obj = {}; headers.forEach((h, idx) => obj[h] = rows[i][idx]);
    if (!obj.name && !obj.nameen) { errors.push({ row: i + 2, message: 'الاسم مطلوب' }); continue; }
    const product = {
      name: obj.name || obj.nameen, nameEn: obj.nameen || obj.name, slug: obj.slug || undefined,
      sku: obj.sku || undefined, price: Number(obj.price) || 0, oldPrice: obj.oldprice ? Number(obj.oldprice) : undefined,
      cost: Number(obj.cost) || 0, stock: Number(obj.stock) || 0, category: obj.category || null, brand: obj.brand || null,
      description: obj.description || '', descriptionEn: obj.descriptionen || '', mainImage: obj.image || obj.mainimage || '',
      isFeatured: obj.featured === '1' || obj.featured === 'true', isBestSeller: obj.bestseller === '1' || obj.bestseller === 'true',
      isNewArrival: obj.newarrival === '1' || obj.newarrival === 'true', status: 'published', isActive: true
    };
    if (dryRun) created.push(product);
    else {
      try { created.push(productShape(await saveProduct(c.env, product))); }
      catch (e) { if (e instanceof FriendlyError) errors.push({ row: i + 2, message: e.message }); else throw e; }
    }
  }
  return c.json({ status: errors.length ? 'partial' : 'success', message: dryRun ? 'اكتمل الفحص التجريبي' : 'تم الاستيراد', data: { dryRun: Boolean(dryRun), created, errors, imported: created.length, failed: errors.length } }, errors.length ? 400 : 200);
});
/*
 * ملاحظة: كانت هنا نسخ مكررة من GET /products/import-template و
 * GET /products/export (مسجّلة أعلى الملف أيضاً). في Hono يفوز أول
 * تسجيل، فكانت النسخ المتأخرة كوداً ميتاً — أُزيلت بلا تغيير سلوكي.
 */
app.post('/products/publish-due', adminOrModerator, async c => {
  const result = await run(c.env.DB.prepare("UPDATE products SET isActive=1,status='published' WHERE status='scheduled' AND publishAt IS NOT NULL AND publishAt <= ?").bind(nowIso()));
  return ok(c, { published: result.meta?.changes || 0 });
});

export default app;
