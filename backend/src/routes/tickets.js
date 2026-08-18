import { Hono } from 'hono';
import { all, first, run } from '../lib/db.js';
import { ok, created, fail, nowIso, stringify, uuid, parseJson } from '../lib/response.js';
import { optionalAuth, protect } from '../middleware/auth.js';
const app = new Hono();

app.post('/', optionalAuth, async c => {
  const b=await c.req.json().catch(()=>({})); const u=c.get('user'); const id=uuid(), now=nowIso();
  const messages=[{from:u?.name||b.guestName||'customer', message:b.message||b.subject, at:now}];
  await run(c.env.DB.prepare(`INSERT INTO tickets(id,userId,guestName,guestEmail,subject,category,priority,status,messages,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(id,u?.id||null,b.guestName||u?.name||'',b.guestEmail||b.email||u?.email||'',b.subject||'support ticket',b.category||'general',b.priority||'normal','open',stringify(messages),now,now));
  return created(c,{ ticket: await first(c.env.DB.prepare('SELECT * FROM tickets WHERE id=?').bind(id)) });
});
app.get('/my', protect, async c => ok(c,{tickets:(await all(c.env.DB.prepare('SELECT * FROM tickets WHERE userId=? ORDER BY updatedAt DESC').bind(c.get('user').id))).map(t=>({...t,messages:parseJson(t.messages,[]),notes:parseJson(t.notes,[])}))}));
app.get('/:id', protect, async c => { const t=await first(c.env.DB.prepare('SELECT * FROM tickets WHERE id=? AND userId=?').bind(c.req.param('id'),c.get('user').id)); if(!t) return fail(c,'غير موجود',404); return ok(c,{ticket:{...t,messages:parseJson(t.messages,[])}}); });
app.post('/:id/reply', protect, async c => {
  const b=await c.req.json(); const t=await first(c.env.DB.prepare('SELECT * FROM tickets WHERE id=? AND userId=?').bind(c.req.param('id'),c.get('user').id)); if(!t) return fail(c,'التذكرة غير موجودة',404);
  const msgs=parseJson(t.messages,[]); msgs.push({from:c.get('user').name,message:b.message,at:nowIso()});
  await run(c.env.DB.prepare('UPDATE tickets SET messages=?, status=?, updatedAt=? WHERE id=?').bind(stringify(msgs),'answered',nowIso(),t.id)); return ok(c,{message:'تم الرد'});
});
app.put('/:id', protect, async c => { const b=await c.req.json(); await run(c.env.DB.prepare('UPDATE tickets SET subject=?,category=?,priority=?,updatedAt=? WHERE id=? AND userId=?').bind(b.subject,b.category,b.priority,nowIso(),c.req.param('id'),c.get('user').id)); return ok(c,{message:'تم التحديث'}); });
export default app;
