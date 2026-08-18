import { Hono } from 'hono';
import { created, fail, nowIso, uuid } from '../lib/response.js';
import { run } from '../lib/db.js';
import { protect, adminOrModerator } from '../middleware/auth.js';

const app = new Hono();
const MAX = 6 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']);

async function store(c, file, folder) {
  if (!file) throw new Error('no-file');
  if (!(file instanceof File)) throw new Error('invalid-file');
  if (file.size > MAX) throw new Error('file-too-large');
  if (!IMAGE_TYPES.has(file.type)) throw new Error('invalid-type');
  const safeName = file.name.replace(/[^\w.\-]+/g,'_');
  const key = `${folder}/${Date.now()}-${safeName}`;
  await c.env.R2.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  const id = uuid(), now = nowIso(), url = `/uploads/${key}`;
  await run(c.env.DB.prepare(`INSERT INTO media(id,url,thumbnailUrl,filename,originalName,mimeType,size,folder,title,userId,createdAt) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(id,url,url,key,safeName,file.type,file.size,folder,safeName,c.get('user')?.id||null,now));
  return { id, _id:id, url, thumbnailUrl:url, filename:key, originalName:safeName, mimeType:file.type, size:file.size, folder };
}

// Main admin image upload. Original Express route required protect + adminOrModerator.
app.post('/', protect, adminOrModerator, async c => {
  const form = await c.req.formData();
  try { const media = await store(c, form.get('image') || form.get('file'), String(form.get('folder') || 'misc')); return created(c, { ...media, isMock:false }, 'تم رفع الصورة'); }
  catch(e) { return fail(c, e.message === 'file-too-large' ? 'حجم الملف كبير جداً' : e.message === 'invalid-type' ? 'نوع الملف غير مدعوم' : 'يرجى اختيار ملف صالح', 400); }
});
app.post('/image', protect, adminOrModerator, async c => { const form=await c.req.formData(); return created(c, await store(c, form.get('image')||form.get('file'), form.get('folder')||'products')); });
app.post('/avatar', protect, async c => { const form=await c.req.formData(); const media=await store(c, form.get('avatar')||form.get('image')||form.get('file'),'avatars'); return created(c,{url:media.url}); });
// Separate public proof endpoint is mounted under orders in the original app.
app.post('/payment-proof', protect, async c => { const form=await c.req.formData(); const media=await store(c, form.get('file')||form.get('image'),'proofs'); return created(c,{url:media.url,thumbnailUrl:media.url}); });
app.delete('/', protect, adminOrModerator, async c => {
  const url = (await c.req.json().catch(()=>({}))).url || c.req.query('url');
  if (!url) return fail(c,'الرابط مطلوب',400);
  const key = String(url).replace(/^\/uploads\//,'');
  if (!key || key.includes('..')) return fail(c,'رابط غير صالح',400);
  await c.env.R2.delete(key);
  await run(c.env.DB.prepare('DELETE FROM media WHERE url=? OR filename=?').bind(url,key));
  return c.json({status:'success',message:'تم حذف الصورة'});
});

export default app;
