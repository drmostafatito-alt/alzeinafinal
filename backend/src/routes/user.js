import { Hono } from 'hono';
import { all, first, run } from '../lib/db.js';
import { ok, created, fail, nowIso, uuid } from '../lib/response.js';
import { protect } from '../middleware/auth.js';

const app = new Hono();
app.use('*', protect);
app.get('/me', async c => {
  const u = await first(c.env.DB.prepare('SELECT * FROM users WHERE id=?').bind(c.get('user').id));
  const addresses = await all(c.env.DB.prepare('SELECT * FROM addresses WHERE userId=? ORDER BY isDefault DESC, createdAt DESC').bind(u.id));
  const wish = await all(c.env.DB.prepare('SELECT p.* FROM wishlist w JOIN products p ON p.id=w.productId WHERE w.userId=?').bind(u.id));
  delete u.passwordHash; return ok(c,{ user:{ ...u, _id:u.id, addresses:addresses.map(a=>({...a,_id:a.id})), wishlist:wish } });
});
app.put('/me', async c => { const b=await c.req.json(), u=c.get('user'); await run(c.env.DB.prepare('UPDATE users SET name=?,firstName=?,lastName=?,phone=?,gender=?,avatar=?,updatedAt=? WHERE id=?').bind(b.name??u.name,b.firstName??u.firstName,b.lastName??u.lastName,b.phone??u.phone,b.gender??u.gender,b.avatar??u.avatar,nowIso(),u.id)); return ok(c,{user:{...u,...b,_id:u.id}}); });
app.get('/addresses', async c => ok(c,{ addresses:(await all(c.env.DB.prepare('SELECT * FROM addresses WHERE userId=? ORDER BY isDefault DESC,createdAt DESC').bind(c.get('user').id))).map(a=>({...a,_id:a.id})) }));
app.post('/addresses', async c => {
  const b=await c.req.json(), id=uuid(), now=nowIso();
  if (b.isDefault) await run(c.env.DB.prepare('UPDATE addresses SET isDefault=0 WHERE userId=?').bind(c.get('user').id));
  await run(c.env.DB.prepare(`INSERT INTO addresses(id,userId,label,governorate,city,district,street,buildingNumber,floor,apartment,landmark,phone,isDefault,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,c.get('user').id,b.label||'الرئيسي',b.governorate,b.city,b.district,b.street,b.buildingNumber||'',b.floor||'',b.apartment||'',b.landmark||'',b.phone,b.isDefault?1:0,now,now));
  return created(c,{address:{...b,id,_id:id,userId:c.get('user').id}}, 'تم حفظ العنوان');
});
app.put('/addresses/:id', async c => { const b=await c.req.json(); const old=await first(c.env.DB.prepare('SELECT * FROM addresses WHERE id=? AND userId=?').bind(c.req.param('id'),c.get('user').id)); if(!old) return fail(c,'العنوان غير موجود',404); if(b.isDefault) await run(c.env.DB.prepare('UPDATE addresses SET isDefault=0 WHERE userId=?').bind(c.get('user').id)); await run(c.env.DB.prepare('UPDATE addresses SET label=?,governorate=?,city=?,district=?,street=?,buildingNumber=?,floor=?,apartment=?,landmark=?,phone=?,isDefault=?,updatedAt=? WHERE id=?').bind(b.label??old.label,b.governorate??old.governorate,b.city??old.city,b.district??old.district,b.street??old.street,b.buildingNumber??old.buildingNumber,b.floor??old.floor,b.apartment??old.apartment,b.landmark??old.landmark,b.phone??old.phone,b.isDefault?1:old.isDefault,nowIso(),old.id)); return ok(c,{address:await first(c.env.DB.prepare('SELECT * FROM addresses WHERE id=?').bind(old.id))}); });
app.delete('/addresses/:id', async c => { await run(c.env.DB.prepare('DELETE FROM addresses WHERE id=? AND userId=?').bind(c.req.param('id'),c.get('user').id)); return ok(c,{message:'تم الحذف'}); });
app.put('/addresses/:id/default', async c => { const uid=c.get('user').id; await c.env.DB.batch([c.env.DB.prepare('UPDATE addresses SET isDefault=0 WHERE userId=?').bind(uid), c.env.DB.prepare('UPDATE addresses SET isDefault=1 WHERE id=? AND userId=?').bind(c.req.param('id'),uid)]); return ok(c,{message:'تم التعيين كافتراضي'}); });
export default app;
