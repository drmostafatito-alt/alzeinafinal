import { Hono } from 'hono';
import { all, first, run, paginateQuery } from '../lib/db.js';
import { ok, created, fail, nowIso, parseJson, stringify, uuid } from '../lib/response.js';
import { admin, adminOrModerator } from '../middleware/auth.js';

const app = new Hono();

const ticketNumber = (id) => 'TKT-' + String(id).slice(0,8).toUpperCase();
const returnNumber = (id) => 'RET-' + String(id).slice(0,8).toUpperCase();

app.get('/returns', adminOrModerator, async c => {
  const status = c.req.query('status');
  const where = status && status !== 'all' ? 'WHERE status=?' : '';
  const args = where ? [status] : [];
  const total = (await c.env.DB.prepare(`SELECT COUNT(*) n FROM return_requests ${where}`).bind(...args).first())?.n || 0;
  const pending = (await c.env.DB.prepare("SELECT COUNT(*) n FROM return_requests WHERE status='pending'").first())?.n || 0;
  const statusCounts = {};
  for (const r of await all(c.env.DB.prepare('SELECT status, COUNT(*) count FROM return_requests GROUP BY status'))) statusCounts[r.status]=r.count;
  const rows = await all(c.env.DB.prepare(`SELECT rr.*, o.orderNumber FROM return_requests rr LEFT JOIN orders o ON o.id=rr.orderId ${where} ORDER BY rr.createdAt DESC LIMIT 100`).bind(...args));
  const returns = rows.map(r => ({...r, _id:r.id, returnNumber: returnNumber(r.id), items:parseJson(r.items,[]), notes:parseJson(r.notes,[])}));
  return ok(c,{ returns, items:returns, total, pending, pages:1, statusCounts });
});
app.get('/return-reasons', adminOrModerator, async c => {
  const result = await Promise.resolve({items: await all(c.env.DB.prepare('SELECT * FROM return_reasons ORDER BY sortOrder,name')), pages:1});
  return ok(c,{ ...result, reasons: result.items });
});
app.get('/returns/:id', adminOrModerator, async c => {
  const r=await first(c.env.DB.prepare('SELECT rr.*, o.orderNumber FROM return_requests rr LEFT JOIN orders o ON o.id=rr.orderId WHERE rr.id=?').bind(c.req.param('id')));
  if(!r) return fail(c,'غير موجود',404);
  return ok(c,{ returnRequest:{...r,_id:r.id, returnNumber:returnNumber(r.id), items:parseJson(r.items,[]), notes:parseJson(r.notes,[])} });
});
app.put('/returns/:id/status', adminOrModerator, async c => {
  const b=await c.req.json(); const o=await first(c.env.DB.prepare('SELECT * FROM return_requests WHERE id=?').bind(c.req.param('id'))); if(!o) return fail(c,'غير موجود',404);
  await run(c.env.DB.prepare('UPDATE return_requests SET status=?,updatedAt=? WHERE id=?').bind(b.status,nowIso(),o.id));
  if(b.status==='returned'){ const items=parseJson(o.items,[]); await c.env.DB.batch(items.map(i=>c.env.DB.prepare('UPDATE products SET stock=stock+? WHERE id=?').bind(i.quantity||1,i.productId||i.product_id))); }
  return ok(c,{message:'updated'});
});
app.post('/returns/:id/notes', adminOrModerator, async c => { const b=await c.req.json(), r=await first(c.env.DB.prepare('SELECT notes FROM return_requests WHERE id=?').bind(c.req.param('id'))); const notes=parseJson(r.notes,[]); notes.push({id:uuid(),body:b.note,at:nowIso(),author:c.get('user')?.name}); await run(c.env.DB.prepare('UPDATE return_requests SET notes=?,updatedAt=? WHERE id=?').bind(stringify(notes),nowIso(),c.req.param('id'))); return created(c,{note:notes.at(-1)}); });
app.post('/returns/:id/restock', adminOrModerator, async c => { const r=await first(c.env.DB.prepare('SELECT * FROM return_requests WHERE id=?').bind(c.req.param('id'))); if(!r) return fail(c,'غير موجود',404); const items=parseJson(r.items,[]); await c.env.DB.batch(items.map(i=>c.env.DB.prepare('UPDATE products SET stock=stock+? WHERE id=?').bind(i.quantity||1,i.productId||i.product_id))); return ok(c,{message:'restocked'}); });
app.get('/returns/:id/credit-note', adminOrModerator, async c => { const r=await first(c.env.DB.prepare('SELECT * FROM return_requests WHERE id=?').bind(c.req.param('id'))); if(!r) return fail(c,'غير موجود',404); const html=`<!doctype html><html dir="rtl"><meta charset="utf-8"><title>Credit Note</title><body style="font-family:Arial;padding:40px"><h1>إشعار دائن</h1><p>رقم الإرجاع: ${returnNumber(r.id)}</p><p>المبلغ: ${r.refundAmount}</p><button onclick="window.print()" style="padding:10px 16px;background:#111;color:#fff;border:0;border-radius:8px">طباعة / حفظ PDF</button></body></html>`; return c.html(html); });

app.get('/tickets', adminOrModerator, async c => {
  const status=c.req.query('status'), priority=c.req.query('priority'), q=c.req.query('q');
  const where=[]; const args=[];
  if(status && status!=='all'){where.push('status=?');args.push(status)}
  if(priority && priority!=='all'){where.push('priority=?');args.push(priority)}
  if(q){where.push('(subject LIKE ? OR guestName LIKE ? OR guestEmail LIKE ?)');args.push(`%${q}%`,`%${q}%`,`%${q}%`)}
  const ws=where.length?`WHERE ${where.join(' AND ')}`:'';
  const total=(await c.env.DB.prepare(`SELECT COUNT(*) n FROM tickets ${ws}`).bind(...args).first())?.n||0;
  const unreadCount=(await c.env.DB.prepare("SELECT COUNT(*) n FROM tickets WHERE status IN ('open','pending')").first())?.n||0;
  const statusCounts={}; for(const r of await all(c.env.DB.prepare('SELECT status,COUNT(*) count FROM tickets GROUP BY status'))) statusCounts[r.status]=r.count;
  const rows=await all(c.env.DB.prepare(`SELECT * FROM tickets ${ws} ORDER BY updatedAt DESC LIMIT 100`).bind(...args));
  const tickets=rows.map(t=>({...t,_id:t.id,ticketNumber:ticketNumber(t.id),messages:parseJson(t.messages,[]),notes:parseJson(t.notes,[]),name:t.guestName,email:t.guestEmail}));
  return ok(c,{tickets,items:tickets,total,unreadCount,pages:1,statusCounts});
});
app.get('/tickets/staff', adminOrModerator, async c => {
  const staff=(await all(c.env.DB.prepare("SELECT id,name,email,role,staffRole FROM users WHERE role IN ('admin','moderator') ORDER BY name"))).map(u=>({...u,_id:u.id}));
  return ok(c,{staff});
});
app.get('/tickets/:id', adminOrModerator, async c => { const t=await first(c.env.DB.prepare('SELECT * FROM tickets WHERE id=?').bind(c.req.param('id'))); if(!t) return fail(c,'غير موجود',404); return ok(c,{ticket:{...t,_id:t.id,ticketNumber:ticketNumber(t.id),messages:parseJson(t.messages,[]),notes:parseJson(t.notes,[]),name:t.guestName,email:t.guestEmail}}); });
app.post('/tickets/:id/reply', adminOrModerator, async c => { const b=await c.req.json(); const t=await first(c.env.DB.prepare('SELECT * FROM tickets WHERE id=?').bind(c.req.param('id'))); if(!t) return fail(c,'التذكرة غير موجودة',404); const msgs=parseJson(t.messages,[]); msgs.push({from:c.get('user').name,staff:true,message:b.message,at:nowIso()}); await run(c.env.DB.prepare('UPDATE tickets SET messages=?,status=?,updatedAt=? WHERE id=?').bind(stringify(msgs),'answered',nowIso(),t.id)); return ok(c,{message:'تم الرد'}); });
app.put('/tickets/:id', adminOrModerator, async c => { const b=await c.req.json(); await run(c.env.DB.prepare('UPDATE tickets SET subject=COALESCE(?,subject),category=COALESCE(?,category),priority=COALESCE(?,priority),status=COALESCE(?,status),assignedTo=COALESCE(?,assignedTo),updatedAt=? WHERE id=?').bind(b.subject,b.category,b.priority,b.status,b.assignedTo,nowIso(),c.req.param('id'))); return ok(c,{message:'updated'}); });
app.post('/tickets/:id/notes', adminOrModerator, async c => { const b=await c.req.json(), t=await first(c.env.DB.prepare('SELECT notes FROM tickets WHERE id=?').bind(c.req.param('id'))); const notes=parseJson(t.notes,[]); notes.push({id:uuid(),body:b.note,at:nowIso(),author:c.get('user')?.name}); await run(c.env.DB.prepare('UPDATE tickets SET notes=?,updatedAt=? WHERE id=?').bind(stringify(notes),nowIso(),t.id)); return created(c,{note:notes.at(-1)}); });
app.delete('/tickets/:id', admin, async c => { await run(c.env.DB.prepare('DELETE FROM tickets WHERE id=?').bind(c.req.param('id'))); return ok(c,{message:'deleted'}); });

export default app;
