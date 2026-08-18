import { all, first, run } from '../lib/db.js';
import { nowIso, parseJson, stringify, uuid, fail } from '../lib/response.js';

/**
 * خدمة مراجعة المدفوعات اليدوية — المنطق الوحيد المصرَّح به لتغيير حالة الدفع.
 *
 * القاعدة الذهبية: رفع الإيصال ≠ دفع مؤكد.
 * لا ينتقل الطلب إلى paid إلا عبر approveVerification أدناه، ولا يُستدعى
 * إلا من endpoints إدارة محمية بـ JWT + RBAC. لا توجد أي شفرة تقرّ قيمة
 * paymentStatus/verificationStatus/approved قادمة من العميل.
 */

/** ملخص لحالة الطلب داخل orders.paymentVerification (JSON) للتوافق */
const orderSummary = (verification) => ({
  state: verification.status,
  verificationId: verification.id,
  receiptUrl: verification.receiptUrl,
  reference: verification.reference,
  amount: verification.amount,
  at: verification.createdAt,
  reviewedAt: verification.reviewedAt,
  reviewedBy: verification.reviewedBy,
  adminNote: verification.adminNote,
  history: [], // يُبنى في updateOrderState أدناه
});

/** يُحدّث ملخص الطلب (JSON) مع تاريخ كامل للعميل */
async function updateOrderState(env, orderId, verification) {
  const order = await first(env.DB.prepare('SELECT paymentVerification FROM orders WHERE id=?').bind(orderId));
  if (!order) return null;
  const pv = parseJson(order.paymentVerification, { state: 'none', history: [] });
  pv.state = verification.status;
  pv.verificationId = verification.id;
  pv.receiptUrl = verification.receiptUrl;
  pv.reference = verification.reference;
  pv.amount = verification.amount;
  pv.reviewedAt = verification.reviewedAt;
  pv.reviewedBy = verification.reviewedBy;
  pv.adminNote = verification.adminNote;
  pv.history = Array.isArray(pv.history) ? pv.history : [];
  pv.history.push({ state: verification.status, at: nowIso(), note: verification.adminNote || undefined });
  await run(env.DB.prepare('UPDATE orders SET paymentVerification=? WHERE id=?').bind(stringify(pv), orderId));
  return pv;
}

/** إشعار واضح داخل لوحة الإدارة — يستخدم نظام notifications الموجود */
export async function notifyAdmins(env, { title, body, link, refId, priority = 'high' }) {
  try {
    await run(env.DB.prepare(
      'INSERT INTO notifications(id,userId,type,title,body,link,refModel,refId,priority,isRead,data,createdAt) VALUES(?,?,?,?,?,?,?,?,?,0,?,?)'
    ).bind(uuid(), null, 'payment', title, body, link, 'Order', refId, priority, '{}', nowIso()));
  } catch { /* الإشعار لا يجوز أن يكسر تدفق الدفع */ }
}

/** أثر تدقيق — يستخدم جدول audit_logs الموجود */
export async function auditLog(env, c, { action, entity, entityId, label, message, success = true, changes }) {
  try {
    const u = c?.get?.('user');
    await run(env.DB.prepare(
      `INSERT INTO audit_logs(id,userId,userName,userEmail,userRole,action,entity,entityId,label,changes,success,status,message,ip,userAgent,path,method,createdAt)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      uuid(), u?.id || null, u?.name || null, u?.email || null, u?.role || null,
      action, entity, entityId || null, label || null, changes ? stringify(changes) : null,
      success ? 1 : 0, success ? 200 : 400, message || null,
      c?.req?.header?.('cf-connecting-ip') || c?.req?.header?.('x-forwarded-for') || null,
      c?.req?.header?.('user-agent') || null, c?.req?.path || null, c?.req?.method || null,
      nowIso()
    ));
  } catch { /* التدقيق لا يكسر التدفق */ }
}

/**
 * يسجّل إيصالاً جديداً: صف payment_verifications + تحديث ملخص الطلب + إشعار الأدمن.
 * يمنع التكرار: إن وُجدت مراجعة بحالة pending لنفس الطلب يُرفض الطلب 409.
 */
export async function recordReceipt(env, c, { order, method, amount, receiptKey, receiptMimeType, receiptSize, receiptUrl, reference, customerNote }) {
  const existing = await first(env.DB.prepare(
    "SELECT * FROM payment_verifications WHERE orderId=? AND status='pending' ORDER BY createdAt DESC"
  ).bind(order.id));
  if (existing) {
    return fail(c, 'يوجد إيصال قيد المراجعة لهذا الطلب بالفعل. يرجى انتظار نتيجة المراجعة.', 409);
  }

  const id = uuid();
  const now = nowIso();
  await run(env.DB.prepare(
    `INSERT INTO payment_verifications(id,orderId,userId,paymentMethodId,paymentMethodCode,amount,receiptKey,receiptMimeType,receiptSize,receiptUrl,reference,status,customerNote,adminNote,createdAt,updatedAt)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, order.id, order.userId || null, method?.id || null, method?.code || order.paymentMethod || null,
    Number(amount) || 0, receiptKey || null, receiptMimeType || null, Number(receiptSize) || null, receiptUrl || null,
    reference || null, 'pending', customerNote || null, null, now, now));

  const verification = await first(env.DB.prepare('SELECT * FROM payment_verifications WHERE id=?').bind(id));
  await updateOrderState(env, order.id, verification);
  await run(env.DB.prepare(
    "UPDATE orders SET paymentProof=?, paymentReference=COALESCE(?,paymentReference), paymentStatus='awaiting-verification', updatedAt=? WHERE id=?"
  ).bind(receiptUrl || order.paymentProof, reference || null, now, order.id));

  const freshOrder = await first(env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(order.id));
  const methodName = method?.name || freshOrder?.paymentMethod || '';
  await notifyAdmins(env, {
    title: 'طلب دفع جديد يحتاج للمراجعة',
    body: `الطلب ${freshOrder.orderNumber} — ${methodName} — المبلغ ${amount}`,
    link: `/admin/payment-verification?status=pending&id=${id}`,
    refId: order.id
  });
  await auditLog(env, c, {
    action: 'receipt_uploaded', entity: 'payment_verifications', entityId: id,
    label: `إيصال للطلب ${freshOrder.orderNumber}`, message: 'رفع إيصال دفع يدوي', changes: { receiptUrl, reference }
  });
  return verification;
}

/** موافقة الأدمن — الانتقال الوحيد إلى paid/confirmed */
export async function approveVerification(env, c, id, adminNote) {
  const verification = await first(env.DB.prepare('SELECT * FROM payment_verifications WHERE id=?').bind(id));
  if (!verification) return fail(c, 'المراجعة غير موجودة', 404);
  if (verification.status !== 'pending') return fail(c, 'هذه المراجعة ليست قيد الانتظار', 400);

  const admin = c.get('user');
  const now = nowIso();
  await run(env.DB.prepare(
    "UPDATE payment_verifications SET status='approved', adminNote=COALESCE(?,adminNote), reviewedAt=?, reviewedBy=?, updatedAt=? WHERE id=?"
  ).bind(adminNote || null, now, admin?.id || null, now, id));

  const updated = await first(env.DB.prepare('SELECT * FROM payment_verifications WHERE id=?').bind(id));
  await updateOrderState(env, updated.orderId, updated);
  const orderRow = await first(env.DB.prepare('SELECT statusHistory FROM orders WHERE id=?').bind(updated.orderId));
  const hist = parseJson(orderRow?.statusHistory, []);
  hist.push({ status: 'confirmed', at: now, note: 'تم تأكيد الدفع' });
  await run(env.DB.prepare(
    "UPDATE orders SET paymentStatus='paid', orderStatus='confirmed', statusHistory=?, updatedAt=? WHERE id=?"
  ).bind(stringify(hist), now, updated.orderId));

  const order = await first(env.DB.prepare('SELECT orderNumber FROM orders WHERE id=?').bind(updated.orderId));
  await auditLog(env, c, {
    action: 'payment_approved', entity: 'payment_verifications', entityId: id,
    label: `موافقة دفع ${order.orderNumber}`, message: 'تم تأكيد الدفع', changes: { adminNote }
  });
  return updated;
}

/** رفض الأدمن — يتطلب سبباً، ويسمح للعميل بإعادة الرفع */
export async function rejectVerification(env, c, id, reason) {
  const verification = await first(env.DB.prepare('SELECT * FROM payment_verifications WHERE id=?').bind(id));
  if (!verification) return fail(c, 'المراجعة غير موجودة', 404);
  if (verification.status !== 'pending') return fail(c, 'هذه المراجعة ليست قيد الانتظار', 400);
  if (!String(reason || '').trim()) return fail(c, 'سبب الرفض مطلوب', 400);

  const admin = c.get('user');
  const now = nowIso();
  await run(env.DB.prepare(
    "UPDATE payment_verifications SET status='rejected', adminNote=?, reviewedAt=?, reviewedBy=?, updatedAt=? WHERE id=?"
  ).bind(String(reason).trim(), now, admin?.id || null, now, id));

  const updated = await first(env.DB.prepare('SELECT * FROM payment_verifications WHERE id=?').bind(id));
  await updateOrderState(env, updated.orderId, updated);
  // لا يُعتبر الطلب مدفوعاً؛ يبقى بانتظار إيصال جديد، ويستطيع العميل إعادة الرفع
  await run(env.DB.prepare(
    "UPDATE orders SET paymentStatus='rejected', updatedAt=? WHERE id=?"
  ).bind(now, updated.orderId));

  const order = await first(env.DB.prepare('SELECT orderNumber FROM orders WHERE id=?').bind(updated.orderId));
  await auditLog(env, c, {
    action: 'payment_rejected', entity: 'payment_verifications', entityId: id,
    label: `رفض دفع ${order.orderNumber}`, message: 'تم رفض الدفع', changes: { reason: String(reason).trim() }
  });
  return updated;
}

/** قائمة المراجعات مع فلاتر: status / method / بحث برقم الطلب أو العميل */
export async function listVerifications(env, query = {}) {
  const where = [];
  const vals = [];
  if (query.status && query.status !== 'all') { where.push('pv.status=?'); vals.push(query.status); }
  if (query.method) { where.push('pv.paymentMethodCode=?'); vals.push(query.method); }
  if (query.q) {
    where.push('(o.orderNumber LIKE ? OR o.guestPhone LIKE ? OR o.guestEmail LIKE ? OR o.shippingAddress LIKE ?)');
    const q = `%${query.q}%`; vals.push(q, q, q, q);
  }
  const ws = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = await all(env.DB.prepare(
    `SELECT pv.*, o.orderNumber, o.guestEmail, o.guestPhone, o.shippingAddress, o.total orderTotal, o.paymentMethod, o.orderStatus, o.createdAt orderCreatedAt,
            pm.name methodName, pm.nameEn methodNameEn, pm.config methodConfig
     FROM payment_verifications pv
     LEFT JOIN orders o ON o.id=pv.orderId
     LEFT JOIN payment_methods pm ON pm.id=pv.paymentMethodId
     ${ws} ORDER BY pv.createdAt DESC LIMIT 200`
  ).bind(...vals));

  const counts = await all(env.DB.prepare('SELECT status, COUNT(*) n FROM payment_verifications GROUP BY status'));
  const summary = { pending: 0, approved: 0, rejected: 0 };
  counts.forEach((r) => { summary[r.status] = r.n; });

  const shape = (r) => {
    const cfg = parseJson(r.methodConfig, {});
    const out = { ...r, ...cfg, _id: r.id, shippingAddress: parseJson(r.shippingAddress, {}) };
    delete out.methodConfig;
    return out;
  };

  return {
    verifications: rows.map(shape),
    items: rows.map(shape),
    summary,
    total: rows.length
  };
}
