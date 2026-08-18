import { Hono } from 'hono';
import { all, first, run } from '../lib/db.js';
import { ok, created, fail, nowIso, uuid } from '../lib/response.js';
import { admin, adminOrModerator } from '../middleware/auth.js';

const app = new Hono();
const shape = (b) => ({ ...b, _id: b.id });

app.get('/', adminOrModerator, async (c) => {
  const q = c.req.query();
  const rows = q.position
    ? await all(c.env.DB.prepare('SELECT * FROM banners WHERE position=? ORDER BY sortOrder ASC, createdAt DESC').bind(q.position))
    : await all(c.env.DB.prepare('SELECT * FROM banners ORDER BY sortOrder ASC, createdAt DESC'));
  return ok(c, { banners: rows.map(shape) });
});

app.post('/', adminOrModerator, async (c) => {
  const b = await c.req.json().catch(() => null);
  if (!b?.title) return fail(c, 'العنوان مطلوب', 400);
  if (!b?.image) return fail(c, 'الصورة مطلوبة', 400);
  const now = nowIso();
  const row = {
    id: b.id || uuid(),
    title: b.title,
    titleEn: b.titleEn || b.title,
    subtitle: b.subtitle || '',
    subtitleEn: b.subtitleEn || '',
    buttonText: b.buttonText || '',
    buttonTextEn: b.buttonTextEn || '',
    image: b.image,
    link: b.link || '',
    position: b.position || 'hero',
    sortOrder: Number(b.sortOrder ?? b.order ?? 0) || 0,
    isActive: b.isActive === false ? 0 : 1,
    startDate: b.startDate || null,
    endDate: b.endDate || null,
    createdAt: now,
    updatedAt: now,
  };
  const cols = Object.keys(row);
  const placeholders = cols.map(() => '?').join(',');
  await run(c.env.DB.prepare(`INSERT INTO banners (${cols.join(',')}) VALUES (${placeholders})`).bind(...cols.map((k) => row[k])));
  return created(c, { banner: shape(await first(c.env.DB.prepare('SELECT * FROM banners WHERE id=?').bind(row.id))) });
});

app.put('/:id', adminOrModerator, async (c) => {
  const old = await first(c.env.DB.prepare('SELECT * FROM banners WHERE id=?').bind(c.req.param('id')));
  if (!old) return fail(c, 'البانر غير موجود', 404);
  const b = await c.req.json().catch(() => ({}));
  /**
   * السبب الجذري لفشل تعديل البانر: الواجهة ترسل حقولاً إضافية مثل `order`
   * و`_id`، وكان الدمج `{...old, ...b}` يمرّرها كما هي إلى جملة UPDATE،
   * فتتولّد `SET order=?` — و`order` كلمة محجوزة في SQLite وليست عموداً —
   * ويفشل الطلب بـ D1_ERROR: near "order": syntax error.
   * الحل: قائمة بيضاء بأعمدة الجدول الفعلية فقط.
   */
  const row = {
    title: b.title ?? old.title,
    titleEn: b.titleEn || old.titleEn,
    subtitle: b.subtitle ?? old.subtitle,
    subtitleEn: b.subtitleEn ?? old.subtitleEn,
    buttonText: b.buttonText ?? old.buttonText,
    buttonTextEn: b.buttonTextEn ?? old.buttonTextEn,
    image: b.image || old.image,
    link: b.link ?? old.link,
    position: b.position || old.position,
    sortOrder: Number(b.sortOrder ?? b.order ?? old.sortOrder) || 0,
    isActive: b.isActive === undefined ? old.isActive : b.isActive ? 1 : 0,
    startDate: b.startDate === undefined ? old.startDate : b.startDate || null,
    endDate: b.endDate === undefined ? old.endDate : b.endDate || null,
    updatedAt: nowIso(),
  };
  const cols = Object.keys(row);
  await run(c.env.DB.prepare(`UPDATE banners SET ${cols.map((x) => `${x}=?`).join(',')} WHERE id=?`).bind(...cols.map((k) => row[k]), c.req.param('id')));
  return ok(c, { banner: shape(await first(c.env.DB.prepare('SELECT * FROM banners WHERE id=?').bind(c.req.param('id')))) });
});

app.delete('/:id', adminOrModerator, async (c) => {
  await run(c.env.DB.prepare('DELETE FROM banners WHERE id=?').bind(c.req.param('id')));
  return ok(c, { deleted: true });
});

export default app;
