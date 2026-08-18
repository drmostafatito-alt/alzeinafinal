import { Hono } from 'hono';
import { all, first, run, paginateQuery } from '../lib/db.js';
import { ok, created, fail, nowIso, parseJson, stringify, uuid } from '../lib/response.js';
import { adminOrModerator, admin } from '../middleware/auth.js';

const app = new Hono();
app.use('*', adminOrModerator);
app.get('/', async c => {
  const {limit,offset}=paginateQuery(c.req.query,40,200);
  const where=[]; const vals=[]; const q=c.req.query('q'), folder=c.req.query('folder');
  if(q){where.push('(originalName LIKE ? OR title LIKE ?)'); vals.push(`%${q}%`,`%${q}%`)}
  if(folder){where.push('folder=?'); vals.push(folder)}
  const ws=where.length?`WHERE ${where.join(' AND ')}`:'';
  const total=(await c.env.DB.prepare(`SELECT COUNT(*) n FROM media ${ws}`).bind(...vals).first()).n;
  const items=await all(c.env.DB.prepare(`SELECT * FROM media ${ws} ORDER BY createdAt DESC LIMIT ? OFFSET ?`).bind(...vals,limit,offset));
  return ok(c,{media:items,files:items,pagination:{total,limit}});
});
app.post('/', adminOrModerator, async c => {
  const form=await c.req.formData();
  /**
   * الواجهة (ImagePicker/MediaLibrary/Media) ترسل الملفات في الحقل `files`
   * (متعدد) وتتوقع مصفوفة `data.media`. كان الخادم يقرأ `file`/`image` فقط
   * ويرجع كائناً واحداً، فكان كل رفع صورة من لوحة الإدارة يفشل بـ
   * "file required" — وهو السبب الحقيقي لفشل إضافة البانرات بصورة.
   * ندعم الاسمين معاً حفاظاً على التوافق.
   */
  const files=[...form.getAll('files'),...form.getAll('file'),...form.getAll('image')].filter(f=>f && typeof f==='object' && 'name' in f);
  if(!files.length) return fail(c,'file required',400);
  const MAX=6*1024*1024; const TYPES=new Set(['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']);
  const folder=String(form.get('folder')||'library'); const out=[];
  for (const file of files) {
    if (file.size>MAX) return fail(c,'حجم الملف كبير جداً',400);
    if (!TYPES.has(file.type)) return fail(c,'نوع الملف غير مدعوم',400);
    const safe=file.name.replace(/[^\w.\-]+/g,'_'); const key=`${folder}/${Date.now()}-${Math.random().toString(36).slice(2,8)}-${safe}`;
    await c.env.R2.put(key,file.stream(),{httpMetadata:{contentType:file.type}}); const id=uuid(), url=`/uploads/${key}`, now=nowIso();
    await run(c.env.DB.prepare('INSERT INTO media(id,url,thumbnailUrl,filename,originalName,mimeType,size,folder,title,userId,createdAt) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,url,url,key,safe,file.type,file.size,folder,form.get('title')||safe,c.get('user').id,now));
    out.push(await first(c.env.DB.prepare('SELECT * FROM media WHERE id=?').bind(id)));
  }
  return created(c,{media:out});
});
app.put('/:id', adminOrModerator, async c => { const b=await c.req.json(); await run(c.env.DB.prepare('UPDATE media SET title=?,alt=?,folder=?,updatedAt=? WHERE id=?').bind(b.title,b.alt,b.folder||'library',nowIso(),c.req.param('id'))); return ok(c,{media:await first(c.env.DB.prepare('SELECT * FROM media WHERE id=?').bind(c.req.param('id')))}); });
app.delete('/:id', adminOrModerator, async c => { const m=await first(c.env.DB.prepare('SELECT * FROM media WHERE id=?').bind(c.req.param('id'))); if(m){ await c.env.R2.delete(m.filename); await run(c.env.DB.prepare('DELETE FROM media WHERE id=?').bind(m.id)); } return ok(c,{deleted:true}); });
app.post('/bulk-delete', adminOrModerator, async c => { const {ids=[]}=await c.req.json(); for(const id of ids){ const m=await first(c.env.DB.prepare('SELECT * FROM media WHERE id=?').bind(id)); if(m){ await c.env.R2.delete(m.filename); await run(c.env.DB.prepare('DELETE FROM media WHERE id=?').bind(id)); }} return ok(c,{deleted:ids.length}); });
app.get('/unused', adminOrModerator, async c => ok(c,{media:(await all(c.env.DB.prepare('SELECT * FROM media ORDER BY createdAt DESC LIMIT 200'))).filter(m=>!m.usage||parseJson(m.usage,[]).length===0)}));
app.post('/delete-unused', adminOrModerator, async c => { const {ids=[]}=await c.req.json(); for(const id of ids){ const m=await first(c.env.DB.prepare('SELECT * FROM media WHERE id=?').bind(id)); if(m){ await c.env.R2.delete(m.filename); await run(c.env.DB.prepare('DELETE FROM media WHERE id=?').bind(id)); }} return ok(c,{deleted:ids.length}); });
export default app;
