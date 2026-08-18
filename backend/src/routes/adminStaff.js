import { Hono } from 'hono';
import { all, first, run } from '../lib/db.js';
import { ok, created, fail, nowIso, uuid } from '../lib/response.js';
import { admin } from '../middleware/auth.js';
import { hashPassword } from '../lib/crypto.js';
import { DEFAULT_PERMISSIONS, ROLE_DEFS, PERMISSION_KEYS } from '../middleware/permissions.js';

const app = new Hono();
/**
 * مهم: هذا الراوتر مركّب على /api/v1/admin مع بقية الراوترات، و`use('*')`
 * كان يفرض دور admin على *كل* مسارات الإدارة اللاحقة (products/orders/...)
 * فيكسر نظام أدوار الطاقم (manager/editor/support) بالكامل.
 * نقيّد الحماية على مسارات هذا الملف فقط.
 */
app.use('/staff', admin);
app.use('/staff/*', admin);
app.use('/permissions', admin);
app.use('/permissions/*', admin);

const publicStaff = (u) => { if (u) delete u.passwordHash; return { ...u, _id: u.id }; };

app.get('/staff', async c => {
  const staff = (await all(c.env.DB.prepare("SELECT * FROM users WHERE role IN ('admin','moderator') ORDER BY createdAt DESC"))).map(publicStaff);
  const roles = Object.entries(ROLE_DEFS).map(([key, value]) => ({ key, ...value, permissions: DEFAULT_PERMISSIONS[key] || {} }));
  return ok(c,{ staff, roles, permissionKeys: PERMISSION_KEYS });
});
app.post('/staff', async c => {
  const b=await c.req.json(); if(!b.email||!b.password||!b.name) return fail(c,'بيانات مطلوبة',400);
  const exists=await first(c.env.DB.prepare('SELECT id FROM users WHERE email=?').bind(String(b.email).toLowerCase())); if(exists) return fail(c,'البريد موجود',409);
  const id=uuid(), now=nowIso(), role=ROLE_DEFS[b.staffRole||'manager']?.dbRole||'moderator';
  await run(c.env.DB.prepare('INSERT INTO users(id,name,email,passwordHash,phone,role,staffRole,isActive,authProvider,sessionsValidFrom,lastActivityAt,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,1,?,?,?,?,?)').bind(id,b.name,String(b.email).toLowerCase(),await hashPassword(b.password),b.phone||'',role,b.staffRole||'manager','local',now,now,now,now));
  return created(c,{staff:publicStaff(await first(c.env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id)))});
});
app.put('/staff/:id', async c => { const b=await c.req.json(); const old=await first(c.env.DB.prepare('SELECT staffRole FROM users WHERE id=?').bind(c.req.param('id'))); const role=ROLE_DEFS[b.staffRole]?.dbRole || ROLE_DEFS[old.staffRole]?.dbRole; await run(c.env.DB.prepare('UPDATE users SET name=?,phone=?,role=?,staffRole=?,isActive=?,updatedAt=? WHERE id=?').bind(b.name,b.phone,role,b.staffRole||old.staffRole,b.isActive?1:0,nowIso(),c.req.param('id'))); return ok(c,{message:'updated'}); });
app.post('/staff/:id/reset-password', async c => { const { password }=await c.req.json(); if(!password||password.length<6) return fail(c,'كلمة مرور قصيرة',400); await run(c.env.DB.prepare('UPDATE users SET passwordHash=?, sessionsValidFrom=?, updatedAt=? WHERE id=?').bind(await hashPassword(password),new Date(Date.now()+1000).toISOString(),nowIso(),c.req.param('id'))); return ok(c,{message:'reset'}); });
app.delete('/staff/:id', async c => { await run(c.env.DB.prepare('DELETE FROM users WHERE id=?').bind(c.req.param('id'))); return ok(c,{message:'deleted'}); });
app.get('/permissions', c => {
  const roles = Object.entries(ROLE_DEFS).map(([key, value]) => ({ key, ...value, permissions: DEFAULT_PERMISSIONS[key] || {} }));
  return c.json({status:'success',data:{ defaults:DEFAULT_PERMISSIONS, roles, permissionKeys:PERMISSION_KEYS, keys:PERMISSION_KEYS }});
});
export default app;
