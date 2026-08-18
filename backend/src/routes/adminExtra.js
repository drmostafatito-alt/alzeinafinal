import { Hono } from 'hono';
import { all, first, run, paginateQuery } from '../lib/db.js';
import { ok, created, fail, nowIso, parseJson, stringify, uuid, bool } from '../lib/response.js';
import { admin, adminOrModerator } from '../middleware/auth.js';
import { RESOURCES, listResource, getResource, createResource, updateResource, deleteResource, reorderResource, toggleResource } from '../services/resource.js';
import { getSettings, updateSettings, resetTheme } from '../services/settings.js';
import { DEFAULT_PERMISSIONS, ROLE_DEFS, PERMISSION_KEYS } from '../middleware/permissions.js';
import { sanitizeHtml } from '../lib/sanitize.js';
import { serializeOrder, invoiceHtml } from './orders.js';
import { approveVerification, rejectVerification, auditLog } from '../services/paymentVerification.js';

const app = new Hono();

/** تنظيف محتوى HTML القادم من لوحة الإدارة قبل التخزين */
const sanitizePayload = (path, payload) => {
  if (!payload || typeof payload !== 'object') return payload;
  if (path === 'pages') {
    if (typeof payload.content === 'string') payload.content = sanitizeHtml(payload.content);
    if (typeof payload.contentEn === 'string') payload.contentEn = sanitizeHtml(payload.contentEn);
  }
  if (path === 'home-sections') {
    if (typeof payload.html === 'string') payload.html = sanitizeHtml(payload.html);
    if (payload.data && typeof payload.data === 'object' && typeof payload.data.html === 'string') payload.data.html = sanitizeHtml(payload.data.html);
    if (Array.isArray(payload.items)) payload.items = payload.items.map((it) => (it && typeof it.body === 'string' ? { ...it, body: sanitizeHtml(it.body) } : it));
  }
  return payload;
};

for (const [path] of Object.entries(RESOURCES)) {
  const singular = path.endsWith('ies') ? path.slice(0,-3)+'y' : path.replace(/s$/, '');
  app.get(`/${path}`, async c => {
    /* قوالب الثيمات جدول إعدادات صغير (21+ قالباً) — حد الترقيم الافتراضي 20
       كان يُخفي أي ثيم جديد بعد العشرين من لوحة الثيمات والـAPI معاً.
       نعيد القائمة كاملة لهذا المورد فقط (بلا تأثير على بقية الموارد). */
    const q = path === 'theme-presets' ? { ...c.req.query(), limit: '200' } : c.req.query();
    const result = await listResource(c.env, path, q);
    const aliases={ 'payment-methods':'paymentMethods', 'shipping-zones':'shippingZones', 'shipping-companies':'shippingCompanies', 'return-reasons':'returnReasons', 'email-templates':'templates', 'home-sections':'sections', 'theme-presets':'presets' }; const extra=aliases[path]||singular; return ok(c, { ...result, [singular]: result.items, [path]: result.items, [extra]: result.items });
  });
  const guard = (c, e) => { if (e?.friendly) return fail(c, e.message, e.status); throw e; };
  app.post(`/${path}`, adminOrModerator, async c => {
    let payload = await c.req.json();
    /* البلوكات الجديدة تُلحق في نهاية الصفحة (لا تقفز فوق القائمة) */
    if (path === 'home-sections' && payload && typeof payload === 'object' && payload.sortOrder === undefined) {
      const max = await c.env.DB.prepare('SELECT COALESCE(MAX(sortOrder),0) mx FROM home_sections').first();
      payload = { ...payload, sortOrder: (max?.mx || 0) + 1 };
    }
    try { return created(c, await createResource(c.env, path, sanitizePayload(path, payload))); }
    catch (e) { return guard(c, e); }
  });
  app.put(`/${path}/reorder`, adminOrModerator, async c => { const b=await c.req.json(); await reorderResource(c.env,path,b.items||b); return ok(c,{message:'reordered'}); });
  app.get(`/${path}/:id`, async c => ok(c, await getResource(c.env, path, c.req.param('id'))));
  app.put(`/${path}/:id`, adminOrModerator, async c => { try { return ok(c, await updateResource(c.env, path, c.req.param('id'), sanitizePayload(path, await c.req.json()))); } catch (e) { return guard(c, e); } });
  app.delete(`/${path}/:id`, adminOrModerator, async c => { await deleteResource(c.env,path,c.req.param('id')); return ok(c,{message:'deleted'}); });
  for (const field of ['isActive','isVisible']) app.patch(`/${path}/:id/${field}`, adminOrModerator, async c => ok(c, await toggleResource(c.env,path,c.req.param('id'),field)));
}
app.put('/categories-reorder', adminOrModerator, async c => { const b=await c.req.json(); await reorderResource(c.env,'categories',b.items||b); return ok(c,{}); });
app.put('/brands-reorder', adminOrModerator, async c => { const b=await c.req.json(); await reorderResource(c.env,'brands',b.items||b); return ok(c,{}); });
app.put('/governorates-bulk', adminOrModerator, async c => {
  const { items = [] } = await c.req.json();
  const now = nowIso();
  const stmts = items.map((g, i) => {
    let countryCode = String(g.countryCode || '').trim().toUpperCase();
    if (!['EG', 'AE'].includes(countryCode)) {
      countryCode = (g.id && String(g.id).includes('-ae-')) || (g.code && String(g.code).startsWith('AE-')) ? 'AE' : 'EG';
    }
    const cost = g.shippingCost !== undefined && g.shippingCost !== null && g.shippingCost !== ''
      ? Math.max(0, Number(g.shippingCost) || 0)
      : null;
    const cod = g.codEnabled === false || g.codEnabled === 0 ? 0 : 1;
    const active = g.isActive === false || g.isActive === 0 ? 0 : 1;
    const zone = g.zoneId || null;
    const sort = g.sortOrder !== undefined ? Number(g.sortOrder) || 0 : i;

    return c.env.DB.prepare(
      'UPDATE governorates SET name=?, nameEn=?, code=?, countryCode=?, shippingCost=?, codEnabled=?, zoneId=?, isActive=?, sortOrder=?, updatedAt=? WHERE id=?'
    ).bind(g.name || '', g.nameEn || '', g.code || '', countryCode, cost, cod, zone, active, sort, now, g.id);
  });
  if (stmts.length) await c.env.DB.batch(stmts);
  return ok(c, { updated: items.length });
});

app.get('/notifications', adminOrModerator, async c => {
  /* جرس الإشعارات كان يقرأ unreadCount غير الموجود في الرد — العدّاد كان صفراً دائماً.
     كما نحصّن التواريخ غير الصالحة (null) كي لا يفجّر timeAgo واجهة الإدارة. */
  const rows = await all(c.env.DB.prepare('SELECT * FROM notifications ORDER BY createdAt DESC LIMIT 100'));
  const notifications = rows.map((n) => {
    const t = new Date(n.createdAt).getTime();
    return Number.isFinite(t) ? n : { ...n, createdAt: null };
  });
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  return ok(c, { notifications, unreadCount });
});
app.get('/notifications/unread-count', adminOrModerator, async c => ok(c,{ count:(await c.env.DB.prepare('SELECT COUNT(*) n FROM notifications WHERE isRead=0').first())?.n||0 }));
app.put('/notifications/read-all', adminOrModerator, async c => { await run(c.env.DB.prepare('UPDATE notifications SET isRead=1')); return ok(c,{}); });
app.put('/notifications/:id/read', adminOrModerator, async c => { await run(c.env.DB.prepare('UPDATE notifications SET isRead=1 WHERE id=?').bind(c.req.param('id'))); return ok(c,{}); });
app.delete('/notifications/:id', adminOrModerator, async c => { await run(c.env.DB.prepare('DELETE FROM notifications WHERE id=?').bind(c.req.param('id'))); return ok(c,{}); });

app.get('/orders/search', adminOrModerator, async c => { const q=`%${c.req.query('q')||''}%`; return ok(c,{orders:await all(c.env.DB.prepare('SELECT id,orderNumber,guestEmail,guestPhone,total,orderStatus,createdAt FROM orders WHERE orderNumber LIKE ? OR guestEmail LIKE ? OR guestPhone LIKE ? ORDER BY createdAt DESC LIMIT 20').bind(q,q,q))}); });
app.get('/orders/export', adminOrModerator, async c => { const rows=await all(c.env.DB.prepare('SELECT orderNumber,guestEmail,guestPhone,subtotal,shippingCost,tax,total,paymentStatus,orderStatus,createdAt FROM orders ORDER BY createdAt DESC')); const cols=Object.keys(rows[0]||{}); return c.body([cols.join(','),...rows.map(r=>cols.map(k=>`"${String(r[k]??'').replace(/"/g,'""')}"`).join(','))].join('\n'),200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="orders.csv"'}); });
app.get('/orders/bulk-status', adminOrModerator, c=>c.json({status:'error',message:'Method not allowed'},405));
app.post('/orders/bulk-status', admin, async c => { const b=await c.req.json(); await c.env.DB.batch((b.ids||[]).map(id=>c.env.DB.prepare('UPDATE orders SET orderStatus=?,updatedAt=? WHERE id=?').bind(b.status,nowIso(),id))); return ok(c,{updated:(b.ids||[]).length}); });
app.get('/orders/:id/timeline', adminOrModerator, async c => { const o=await first(c.env.DB.prepare('SELECT statusHistory,activity,adminNotes FROM orders WHERE id=?').bind(c.req.param('id'))); return ok(c,{timeline:parseJson(o.statusHistory,[]),activity:parseJson(o.activity,[]),notes:parseJson(o.adminNotes,[])}); });
app.post('/orders/:id/notes', adminOrModerator, async c => { const b=await c.req.json(), o=await first(c.env.DB.prepare('SELECT adminNotes FROM orders WHERE id=?').bind(c.req.param('id'))); const notes=parseJson(o.adminNotes,[]); notes.push({id:uuid(),body:b.note||b.body,at:nowIso(),author:c.get('user')?.name}); await run(c.env.DB.prepare('UPDATE orders SET adminNotes=?,updatedAt=? WHERE id=?').bind(stringify(notes),nowIso(),c.req.param('id'))); return created(c,{note:notes.at(-1)}); });
app.delete('/orders/:id/notes/:noteId', adminOrModerator, async c => { const o=await first(c.env.DB.prepare('SELECT adminNotes FROM orders WHERE id=?').bind(c.req.param('id'))); const notes=parseJson(o.adminNotes,[]).filter(n=>n.id!==c.req.param('noteId')); await run(c.env.DB.prepare('UPDATE orders SET adminNotes=?,updatedAt=? WHERE id=?').bind(stringify(notes),nowIso(),c.req.param('id'))); return ok(c,{}); });
app.get('/orders/:id/invoice', adminOrModerator, async c => {
  const row = await first(c.env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(c.req.param('id')));
  if (!row) return fail(c, 'الطلب غير موجود', 404);
  const order = await serializeOrder(c.env, row);
  const settings = await getSettings(c.env);
  const html = invoiceHtml(order, settings);
  return c.html(html, 200, { 'Content-Type': 'text/html; charset=utf-8' });
});

app.get('/orders/:id/label', adminOrModerator, async c => {
  const row = await first(c.env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(c.req.param('id')));
  if (!row) return fail(c, 'الطلب غير موجود', 404);
  const order = await serializeOrder(c.env, row);
  const settings = await getSettings(c.env);
  const addr = order.shippingAddress || {};
  const fin = order.financialSnapshot || {};
  const isCod = String(order.paymentMethod).toLowerCase() === 'cod';
  const sym = fin.currencySymbol || (fin.country === 'AE' ? 'د.إ' : 'ج.م');
  const countryName = fin.country === 'AE' || addr.countryCode === 'AE' ? 'الإمارات العربية المتحدة 🇦🇪' : 'جمهورية مصر العربية 🇪🇬';
  const govName = addr.governorateName || addr.governorate || '—';
  const fullAddress = [
    addr.street,
    addr.buildingNumber ? `مبنى ${addr.buildingNumber}` : null,
    addr.floor ? `طابق ${addr.floor}` : null,
    addr.apartment ? `شقة ${addr.apartment}` : null,
    addr.district,
    addr.city,
    govName
  ].filter(Boolean).join('، ');

  const itemsList = (order.items || []).map((i) => `<li>${i.name} (×${i.quantity})</li>`).join('');

  const html = `<!doctype html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>بوليصة شحن ${order.orderNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 20px; background: #f4f4f4; color: #111; }
    .label-card { max-width: 600px; margin: 0 auto; background: #fff; border: 2px solid #111; border-radius: 12px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .top-bar { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 16px; }
    .store-name { font-size: 20px; font-weight: 800; }
    .order-num { font-size: 22px; font-weight: 900; font-family: monospace; letter-spacing: 1px; }
    .payment-badge { display: block; text-align: center; font-size: 16px; font-weight: 800; padding: 10px; border-radius: 8px; margin-bottom: 16px; }
    .cod-badge { background: #fef2f2; color: #991b1b; border: 2px solid #f87171; }
    .prepaid-badge { background: #f0fdf4; color: #166534; border: 2px solid #4ade80; }
    .recipient-box { background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 16px; margin-bottom: 16px; font-size: 14px; line-height: 1.6; }
    .recipient-name { font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
    .phone { font-size: 18px; font-weight: 800; direction: ltr; display: inline-block; font-family: monospace; }
    .items-box { font-size: 12px; color: #475569; border-top: 1px dashed #ccc; padding-top: 12px; }
    .actions { margin-top: 20px; text-align: center; }
    .btn { background: #111; color: #fff; border: none; padding: 10px 24px; border-radius: 99px; font-weight: bold; cursor: pointer; font-size: 14px; }
    @media print { body { padding: 0; background: #fff; } .label-card { border: 2px solid #000; box-shadow: none; max-width: 100%; } .actions { display: none !important; } }
  </style>
</head>
<body>
  <div class="label-card">
    <div class="top-bar">
      <div>
        <div class="store-name">${settings.siteNameAr || 'الزينة — AL-ZEINA'}</div>
        <div style="font-size:12px;color:#666;">هاتف المتجر: ${settings.contact?.phone || '—'}</div>
      </div>
      <div style="text-align:left;">
        <div style="font-size:12px;color:#666;">بوليصة شحن</div>
        <div class="order-num">${order.orderNumber}</div>
      </div>
    </div>

    ${
      isCod
        ? `<div class="payment-badge cod-badge">⚠️ الدفع عند الاستلام — المطلوب تحصيله: ${order.total} ${sym}</div>`
        : `<div class="payment-badge prepaid-badge">✓ دفع مسبق — تم السداد / مدفوع بالكامل</div>`
    }

    <div class="recipient-box">
      <div class="recipient-name">👤 ${addr.name || order.user?.name || order.guestEmail || 'عميل المتجر'}</div>
      <div>📞 هاتف المستلم: <span class="phone">${addr.phone || order.guestPhone || order.user?.phone || '—'}</span></div>
      <div>🌍 الدولة: <strong>${countryName}</strong></div>
      <div>🏛️ المحافظة / الإمارة: <strong>${govName}</strong></div>
      <div style="margin-top:6px;font-size:13px;color:#334155;">📍 العنوان التفصيلي: ${fullAddress || '—'}</div>
      ${addr.notes ? `<div style="margin-top:6px;font-size:12px;color:#d97706;">📝 ملاحظات التوصيل: ${addr.notes}</div>` : ''}
    </div>

    <div class="items-box">
      <strong>محتويات الشحنة (${order.items?.length || 0} صنف):</strong>
      <ul style="margin:4px 0 0;padding-right:20px;">
        ${itemsList}
      </ul>
      ${order.trackingNumber ? `<p style="margin-top:8px;font-weight:bold;">رقم التتبع: ${order.trackingNumber}</p>` : ''}
    </div>

    <div class="actions">
      <button class="btn" onclick="window.print()">طباعة بوليصة الشحن</button>
    </div>
  </div>
  <script>window.onload = () => setTimeout(() => window.print(), 300);</script>
</body>
</html>`;

  return c.html(html, 200, { 'Content-Type': 'text/html; charset=utf-8' });
});
app.put('/orders/:id/status', adminOrModerator, async c => { const b=await c.req.json(), o=await first(c.env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(c.req.param('id'))); const hist=parseJson(o.statusHistory,[]); hist.push({status:b.status||b.orderStatus,at:nowIso(),note:b.note,by:c.get('user')?.id}); await run(c.env.DB.prepare('UPDATE orders SET orderStatus=?,statusHistory=?,updatedAt=? WHERE id=?').bind(b.status||b.orderStatus,stringify(hist),nowIso(),o.id)); return ok(c,{message:'updated'}); });
app.put('/orders/:id/shipping', adminOrModerator, async c => { const b=await c.req.json(); await run(c.env.DB.prepare('UPDATE orders SET trackingNumber=?,shippingCompany=?,updatedAt=? WHERE id=?').bind(b.trackingNumber,b.shippingCompany,nowIso(),c.req.param('id'))); return ok(c,{message:'updated'}); });
app.put('/orders/:id/payment-status', adminOrModerator, async c => { const b=await c.req.json(); await run(c.env.DB.prepare('UPDATE orders SET paymentStatus=?,updatedAt=? WHERE id=?').bind(b.paymentStatus,nowIso(),c.req.param('id'))); return ok(c,{message:'updated'}); });
/* مسار مكرر (يفوز تسجيل adminCore الأول) — بقي مفوَّضاً للخدمة نفسها للاتساق */
app.post('/orders/:id/payment-verification', adminOrModerator, async c => {
  const b = await c.req.json().catch(() => ({}));
  const o = await first(c.env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(c.req.param('id')));
  if (!o) return fail(c, 'not found', 404);
  const latest = await first(c.env.DB.prepare("SELECT * FROM payment_verifications WHERE orderId=? AND status='pending' ORDER BY createdAt DESC").bind(o.id));
  if (latest && (b.action === 'approve' || b.action === 'reject')) {
    const res = b.action === 'approve'
      ? await approveVerification(c.env, c, latest.id, b.note || b.adminNote)
      : await rejectVerification(c.env, c, latest.id, b.note || b.reason || 'إيصال غير مطابق للمطلوب');
    if (res instanceof Response) return res;
    return ok(c, { message: 'updated', verification: res });
  }
  await auditLog(c.env, c, { action: b.action, entity: 'orders', entityId: o.id, label: o.orderNumber, message: 'تحديث دفع (مسار قديم)' });
  return ok(c, { message: 'updated' });
});
app.post('/orders/:id/resend-invoice', adminOrModerator, c => ok(c,{sent:true,message:'No email provider configured; invoice remains available for download/print.'}));

app.get('/customers', admin, async c => {
  const {page,limit,offset}=paginateQuery(c.req.query(),20,100); const search=c.req.query('search'); let where="WHERE role='user'"; const vals=[]; if(search){where+=' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';vals.push(`%${search}%`,`%${search}%`,`%${search}%`)}
  const total=(await c.env.DB.prepare(`SELECT COUNT(*) n FROM users ${where}`).bind(...vals).first())?.n||0;
  const users=(await all(c.env.DB.prepare(`SELECT * FROM users ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`).bind(...vals,limit,offset))).map(u=>{delete u.passwordHash;u._id=u.id;return u;});
  return ok(c,{users,pagination:{page,limit,total,pages:Math.ceil(total/limit)}});
});
app.get('/customers/:id/profile', admin, async c => {
  const id=c.req.param('id'); const u=await first(c.env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id)); if(!u) return fail(c,'not found',404); delete u.passwordHash;
  const [orders,addresses,wishlist,reviews,stats] = await Promise.all([
    all(c.env.DB.prepare('SELECT * FROM orders WHERE userId=? ORDER BY createdAt DESC').bind(id)),
    all(c.env.DB.prepare('SELECT * FROM addresses WHERE userId=?').bind(id)),
    all(c.env.DB.prepare('SELECT p.* FROM wishlist w JOIN products p ON p.id=w.productId WHERE w.userId=?').bind(id)),
    all(c.env.DB.prepare('SELECT r.*,p.name productName FROM reviews r LEFT JOIN products p ON p.id=r.productId WHERE r.userId=? ORDER BY r.createdAt DESC').bind(id)),
    c.env.DB.prepare("SELECT COUNT(*) totalOrders, COALESCE(SUM(total),0) totalSpent, COALESCE(AVG(total),0) averageOrderValue, MAX(createdAt) lastOrderAt FROM orders WHERE userId=? AND orderStatus NOT IN ('cancelled','refunded')").bind(id).first()
  ]);
  orders.forEach(o=>{o.items=[]; o._id=o.id});
  const profile={...u,_id:u.id,orders,addresses:addresses.map(a=>({...a,_id:a.id})),wishlist:wishlist.map(w=>({...w,_id:w.id})),reviews,reviewsCount:reviews.length,recentlyViewed:[],notes:parseJson(u.adminNotes,[]),stats};
  return ok(c,{customer:profile,profile,stats});
});
app.post('/customers/:id/notes', admin, async c => { const b=await c.req.json(); const u=await first(c.env.DB.prepare('SELECT adminNotes FROM users WHERE id=?').bind(c.req.param('id'))); const notes=parseJson(u.adminNotes,[]); notes.push({id:uuid(),body:b.body||b.note,authorName:c.get('user')?.name,at:nowIso()}); await run(c.env.DB.prepare('UPDATE users SET adminNotes=?,updatedAt=? WHERE id=?').bind(stringify(notes),nowIso(),c.req.param('id'))); return created(c,{note:notes.at(-1)}); });
app.delete('/customers/:id/notes/:noteId', admin, async c => { const u=await first(c.env.DB.prepare('SELECT adminNotes FROM users WHERE id=?').bind(c.req.param('id'))); const notes=parseJson(u.adminNotes,[]).filter(n=>n.id!==c.req.param('noteId')); await run(c.env.DB.prepare('UPDATE users SET adminNotes=?,updatedAt=? WHERE id=?').bind(stringify(notes),nowIso(),c.req.param('id'))); return ok(c,{}); });
app.get('/customers/export', admin, async c => { const rows=await all(c.env.DB.prepare("SELECT name,email,phone,createdAt FROM users WHERE role='user' ORDER BY createdAt DESC")); return c.body(['name,email,phone,createdAt',...rows.map(r=>[r.name,r.email,r.phone,r.createdAt].map(x=>`"${String(x??'').replace(/"/g,'""')}"`).join(','))].join('\n'),200,{'Content-Type':'text/csv','Content-Disposition':'attachment; filename="customers.csv"'}); });
app.get('/customers/insights', admin, async c => ok(c,{ total:(await c.env.DB.prepare("SELECT COUNT(*) n FROM users WHERE role='user'").first()).n, recent:await all(c.env.DB.prepare("SELECT id,name,email,phone,createdAt FROM users WHERE role='user' ORDER BY createdAt DESC LIMIT 10")) }));

app.get('/permissions', admin, c => { const roles=Object.entries(ROLE_DEFS).map(([key,value])=>({key,...value,permissions:DEFAULT_PERMISSIONS[key]||{}})); return c.json({status:'success',data:{defaults:DEFAULT_PERMISSIONS,roles,permissionKeys:PERMISSION_KEYS,keys:PERMISSION_KEYS}}); });
app.put('/permissions', admin, async c => { const b=await c.req.json(); await updateSettings(c.env,{ permissions:b.permissions||b }); return ok(c,{message:'saved'}); });
app.get('/settings', adminOrModerator, async c => { const settings=await getSettings(c.env); return ok(c,{ settings, ...settings }); });
app.put('/settings', admin, async c => ok(c,{ settings: await updateSettings(c.env, await c.req.json()) }, 'saved'));
app.post('/settings/theme/reset', admin, async c => ok(c, await resetTheme(c.env)));
app.post('/settings/reset-theme', admin, async c => ok(c, await resetTheme(c.env)));

app.post('/theme-presets/:id/apply', admin, async c => { const p=await getResource(c.env,'theme-presets',c.req.param('id')); if(!p) return fail(c,'not found',404); const theme=parseJson(p.theme,{}); const settings=await updateSettings(c.env,{theme}); await run(c.env.DB.prepare('UPDATE theme_presets SET isActive=0')); await run(c.env.DB.prepare('UPDATE theme_presets SET isActive=1,updatedAt=? WHERE id=?').bind(nowIso(),p.id)); return ok(c,{settings},'تم تطبيق القالب بنجاح'); });
app.post('/theme-presets/:id/duplicate', admin, async c => { const old=await getResource(c.env,'theme-presets',c.req.param('id')); if(!old) return fail(c,'not found',404); return created(c, await createResource(c.env,'theme-presets',{name:`${old.name} copy`,description:old.description,theme:parseJson(old.theme,{})})); });
app.get('/theme-presets/:id/export', adminOrModerator, async c => { const p=await getResource(c.env,'theme-presets',c.req.param('id')); return c.body(JSON.stringify(p,null,2),200,{'Content-Type':'application/json','Content-Disposition':`attachment; filename="theme-${p.id}.json"`}); });
app.post('/theme-presets/import', admin, async c => { const { preset }=await c.req.json(); return created(c, await createResource(c.env,'theme-presets',preset)); });
app.post('/branding-reorder', admin, async c => ok(c,{}));

app.get('/backup', admin, async c => {
  const scope=c.req.query('scope')||'all'; const tables=scope==='settings'?['settings']:['users','products','categories','brands','orders','order_items','coupons','banners','reviews','settings','pages','media','tickets','return_requests'];
  const data={}; for(const t of tables) data[t]=(await all(c.env.DB.prepare(`SELECT * FROM ${t}`))).map(r=>{delete r.passwordHash;return r;});
  return c.body(JSON.stringify({version:2,exportedAt:nowIso(),scope,data}),200,{'Content-Type':'application/json','Content-Disposition':'attachment; filename="alzeina-backup.json"'});
});
app.post('/backup/restore-preview', admin, async c => { const b=await c.req.json(); const d=b.backup?.data||b.data||{}; return ok(c,{tables:Object.keys(d),counts:Object.fromEntries(Object.entries(d).map(([k,v])=>[k,Array.isArray(v)?v.length:0]))}); });
app.post('/backup/restore', admin, c => c.json({status:'success',message:'Database restore must be performed with wrangler d1 execute from a downloaded backup for Free-plan safety.'},202));
app.get('/backup/schedule', admin, c => ok(c,{schedule:'Use Cloudflare Cron Trigger; Worker Free plan includes scheduled handlers.'}));
app.put('/backup/schedule', admin, c => ok(c,{saved:true}));

export default app;
