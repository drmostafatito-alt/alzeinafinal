import { Hono } from 'hono';
import { all, first, run } from '../lib/db.js';
import { ok, created, fail, nowIso, stringify, uuid, parseJson } from '../lib/response.js';
import { protect } from '../middleware/auth.js';
import { getSettings } from '../services/settings.js';

const app = new Hono();
async function recalcProduct(env, productId) {
  const row = await env.DB.prepare('SELECT AVG(rating) avg, COUNT(*) cnt FROM reviews WHERE productId=? AND status=?').bind(productId,'approved').first();
  await run(env.DB.prepare('UPDATE products SET rating=?, reviewsCount=? WHERE id=?').bind(Math.round(Number(row?.avg||0)*10)/10, Number(row?.cnt||0), productId));
}
app.get('/product/:productId', async c => ok(c,{ reviews:(await all(c.env.DB.prepare('SELECT r.*, u.name userName FROM reviews r LEFT JOIN users u ON u.id=r.userId WHERE r.productId=? AND r.status=? ORDER BY r.createdAt DESC').bind(c.req.param('productId'),'approved'))).map(r=>({...r,_id:r.id,images:parseJson(r.images,[])})) }));
app.post('/', protect, async c => {
  const body = await c.req.json(); const settings = await getSettings(c.env); const id=uuid(), now=nowIso();
  const status = settings.features?.reviewsAutoApprove === false ? 'pending' : 'approved';
  await run(c.env.DB.prepare(`INSERT INTO reviews(id,productId,userId,userName,rating,title,comment,images,status,isActive,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,1,?,?)`).bind(id,body.productId,c.get('user').id,c.get('user').name,Number(body.rating)||5,body.title||'',body.comment||'',stringify(body.images||[]),status,now,now));
  if (status==='approved') await recalcProduct(c.env, body.productId);
  const review = await first(c.env.DB.prepare('SELECT * FROM reviews WHERE id=?').bind(id)); return created(c,{review});
});
app.put('/:id', protect, async c => { const old=await first(c.env.DB.prepare('SELECT * FROM reviews WHERE id=? AND userId=?').bind(c.req.param('id'),c.get('user').id)); if(!old) return fail(c,'المراجعة غير موجودة',404); const b=await c.req.json(); await run(c.env.DB.prepare('UPDATE reviews SET rating=?,title=?,comment=?,images=?,updatedAt=? WHERE id=?').bind(Number(b.rating)||old.rating,b.title??old.title,b.comment??old.comment,stringify(b.images??parseJson(old.images,[])),nowIso(),old.id)); await recalcProduct(c.env,old.productId); return ok(c,{review:await first(c.env.DB.prepare('SELECT * FROM reviews WHERE id=?').bind(old.id))}); });
app.delete('/:id', protect, async c => { const old=await first(c.env.DB.prepare('SELECT * FROM reviews WHERE id=? AND userId=?').bind(c.req.param('id'),c.get('user').id)); if(!old) return fail(c,'المراجعة غير موجودة',404); await run(c.env.DB.prepare('DELETE FROM reviews WHERE id=?').bind(old.id)); await recalcProduct(c.env,old.productId); return ok(c,{message:'تم الحذف'}); });
export default app;
