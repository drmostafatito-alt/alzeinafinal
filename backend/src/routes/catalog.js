import { Hono } from 'hono';
import { all, first, run, buildWhere, paginateQuery } from '../lib/db.js';
import { ok, created, fail, stringify, parseJson, nowIso, uuid, slugify, round2 } from '../lib/response.js';
import { protect, admin, optionalAuth } from '../middleware/auth.js';
import { countryMiddleware } from '../services/country.js';

export const productShape = (p) => ({
  ...p, _id:p.id, images:parseJson(p.images,[]), variants:parseJson(p.variants,[]), colors:parseJson(p.colors,[]), sizes:parseJson(p.sizes,[]), tags:parseJson(p.tags,[]), metaKeywords:parseJson(p.metaKeywords,[]), keywords:parseJson(p.keywords,[])
});

/* ---------- Multi-Country (المرحلة D) ---------- */
/** شرط إتاحة المنتج في الإمارات: مفعّل للإمارات + سعر إماراتي صريح. مصر لا يتغير عليها شيء. */
export const AE_GATE_SQL = 'p.isActiveAE = 1 AND p.priceAE IS NOT NULL';
const isAE = (country) => String(country || 'EG').toUpperCase() === 'AE';

/**
 * يعيد تشكيل المنتج لعرضه ببلد محدد. لمصر: يعاد كما هو بايتًا-ببايت.
 * للإمارات: price ← priceAE و oldPrice ← oldPriceAE (بلا أي تحويل — أرقام صريحة من لوحة الإدارة).
 * variants: التسعير على مستوى المنتج فقط للإمارات (المقصود بالموافقة) — سعر الخيار
 * لا يُعتمد للإمارات حتى لا يتسرّب سعر مصري؛ يُعرض بسعر الإمارات للمنتج.
 */
export const shapeProductForCountry = (p, country) => {
  if (!p || !isAE(country)) return p;
  const out = { ...p, price: p.priceAE, oldPrice: p.oldPriceAE ?? null };
  if (Array.isArray(out.variants)) out.variants = out.variants.map((v) => (v && typeof v === 'object' ? { ...v, price: p.priceAE } : v));
  return out;
};

/** سعر الوحدة الخادمي لطلب/سلة حسب البلد — المرجع الوحيد لحساب الأموال. */
export function unitPriceForCountry(productRow, variantObj, country) {
  if (isAE(country)) return Number(productRow.priceAE);
  return variantObj?.price ?? productRow.price;
}

/** هل المنتج قابل للبيع في البلد؟ (مصر = السلوك التاريخي؛ الإمارات = البوابة الموافق عليها) */
export function productAvailableInCountry(productRow, country) {
  if (!productRow || !productRow.isActive) return false;
  if (isAE(country)) return Boolean(productRow.isActiveAE) && productRow.priceAE !== null && productRow.priceAE !== undefined;
  return true;
}

/** خطأ برسالة ودّية تُعرض للمستخدم (بدل 500 برسالة D1 خام). */
export class FriendlyError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

/**
 * يحوّل قيمة القسم/الماركة القادمة من النموذج إلى معرّف سجل حقيقي.
 *
 * السبب: Combobox الماركة في نموذج المنتج يسمح بكتابة اسم جديد (allowCreate)
 * ويرسل الاسم الخام نصّاً — وكان الخادم يمرّره إلى INSERT كما هو، فيكسر
 * قيد FOREIGN KEY (خطأ 500 «المنتج لا يُحفظ»). القسم (allowCreate=false)
 * إن وصل نص خام لا يطابق سجلاً نُرجع خطأ ودّياً بدل كسر القيد.
 */
async function resolveTaxonomy(env, table, raw, allowCreate, label) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  const byId = await first(env.DB.prepare(`SELECT id FROM ${table} WHERE id=?`).bind(s));
  if (byId) return byId.id;
  const found = await first(env.DB.prepare(
    `SELECT id FROM ${table} WHERE lower(name)=lower(?) OR lower(nameEn)=lower(?) OR lower(slug)=lower(?) LIMIT 1`
  ).bind(s, s, s));
  if (found) return found.id;
  if (!allowCreate) throw new FriendlyError(`«${label}» غير موجود — اختر من القائمة أو أنشئه أولاً`, 400);
  // إنشاء السجل تلقائياً (السلوك الموثّق في Combobox: «الخادم يتكفّل بذلك»)
  const id = uuid(), now = nowIso(), slug = slugify(s);
  if (table === 'brands') {
    await run(env.DB.prepare(`INSERT INTO brands(id,name,nameEn,slug,logo,description,descriptionEn,metaTitle,metaDescription,keywords,isActive,sortOrder,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id, s, s, slug, null, null, null, null, null, '[]', 1, 0, now, now));
  } else {
    await run(env.DB.prepare(`INSERT INTO categories(id,name,nameEn,slug,image,description,descriptionEn,parent,metaTitle,metaDescription,keywords,isActive,sortOrder,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id, s, s, slug, null, null, null, null, null, null, '[]', 1, 0, now, now));
  }
  return id;
}

/** يحوّل أخطاء UNIQUE (slug/sku) من رسالة D1 خام إلى خطأ ودّي للمستخدم. */
function guardUnique(e) {
  const msg = String(e?.message || '');
  if (msg.includes('UNIQUE constraint failed: products.slug')) throw new FriendlyError('الرابط (slug) مستخدم مسبقاً — غيّر اسم المنتج أو الرابط', 409);
  if (msg.includes('UNIQUE constraint failed: products.sku')) throw new FriendlyError('كود SKU مستخدم مسبقاً — استخدم كوداً آخر', 409);
  throw e;
}

async function listProducts(env, query = {}, adminMode = false, country = 'EG') {
  const { page, limit, offset } = paginateQuery(query, 12, 100);
  const where = []; const vals = [];
  if (!adminMode) where.push('p.isActive = 1');
  /* الإمارات: بوابة الإتاحة + عمود السعر الإماراتي في الفلاتر/الترتيب. مصر: لا تغيير إطلاقاً. */
  const ae = isAE(country) && !adminMode;
  if (ae) where.push(AE_GATE_SQL);
  const priceCol = ae ? 'p.priceAE' : 'p.price';
  /* بحث نصي: الواجهة ترسل المعامل باسم search (صفحتا Shop وSearch)
     بينما كانت القراءة لـ q فقط — فيُتجاهل البحث بصمت وتظهر كل المنتجات.
     نقرأ الاسمين معاً (الاتفاقان كلاهما مستخدمان في الواجهة). */
  const q = query.q || query.search;
  if (query.category) { where.push('(p.category = ? OR c.slug = ?)'); vals.push(query.category, query.category); }
  if (query.brand) { where.push('(p.brand = ? OR b.slug = ?)'); vals.push(query.brand, query.brand); }
  if (query.featured) where.push('p.isFeatured = 1');
  if (query.bestSeller || query.sort === 'bestSeller') where.push('p.isBestSeller = 1');
  if (query.newArrival) where.push('p.isNewArrival = 1');
  if (query.discount) where.push(ae ? '(p.oldPriceAE IS NOT NULL AND p.oldPriceAE > p.priceAE)' : 'p.discount > 0');
  if (q) { where.push('(p.name LIKE ? OR p.nameEn LIKE ? OR p.description LIKE ? OR p.tags LIKE ?)'); vals.push(`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`); }
  if (query.minPrice) { where.push(`${priceCol} >= ?`); vals.push(Number(query.minPrice)); }
  if (query.maxPrice) { where.push(`${priceCol} <= ?`); vals.push(Number(query.maxPrice)); }
  /* فلترا المتجر اللذان كانا يُرسلان من الواجهة ويُتجاهلان هنا */
  if (query.rating) { where.push('p.rating >= ?'); vals.push(Number(query.rating)); }
  if (query.inStock === 'true' || query.inStock === true || query.inStock === '1') where.push('p.stock > 0');
  const orderMap = { newest:'p.createdAt DESC', price_asc:`${priceCol} ASC`, price_desc:`${priceCol} DESC`, discount:'p.discount DESC', rating:'p.rating DESC', bestSeller:'p.soldCount DESC', name:'p.name COLLATE NOCASE ASC' };
  const order = orderMap[query.sort] || 'p.createdAt DESC';
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await env.DB.prepare(`SELECT COUNT(*) n FROM products p LEFT JOIN categories c ON c.id=p.category LEFT JOIN brands b ON b.id=p.brand ${whereSql}`).bind(...vals).first()).n;
  const rows = await all(env.DB.prepare(`SELECT p.*, c.name categoryName, c.slug categorySlug, b.name brandName, b.slug brandSlug FROM products p LEFT JOIN categories c ON c.id=p.category LEFT JOIN brands b ON b.id=p.brand ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...vals, limit, offset));
  return { products: rows.map((p)=>shapeProductForCountry(productShape(p), adminMode ? 'EG' : country)), pagination:{ page, limit, total, pages:Math.max(1,Math.ceil(total/limit)) } };
}

const products = new Hono();
/* حلّ البلد لكل مسارات الكتالوج العامة — مصر الافتراضي، الإمارات بترويسة X-Country */
products.use('*', countryMiddleware);
products.get('/', async c => ok(c, await listProducts(c.env, c.req.query(), false, c.get('country'))));
products.get('/featured', async c => ok(c, await listProducts(c.env, { featured:1, limit:c.req.query('limit')||8 }, false, c.get('country'))));
products.get('/best-sellers', async c => ok(c, await listProducts(c.env, { bestSeller:1, sort:'bestSeller', limit:c.req.query('limit')||8 }, false, c.get('country'))));
products.get('/new-arrivals', async c => ok(c, await listProducts(c.env, { newArrival:1, limit:c.req.query('limit')||8 }, false, c.get('country'))));
products.get('/search/suggestions', async c => {
  const q = `%${c.req.query('q')||c.req.query('search')||''}%`;
  const country = c.get('country');
  const ae = isAE(country);
  const rows = await all(c.env.DB.prepare(`SELECT id,name,nameEn,slug,${ae?'priceAE':'price'} price,mainImage,rating FROM products WHERE isActive=1 AND ${ae ? 'isActiveAE=1 AND priceAE IS NOT NULL AND ' : ''}(name LIKE ? OR nameEn LIKE ?) ORDER BY rating DESC LIMIT 8`).bind(q,q));
  return ok(c, { suggestions: rows.map(p=>({...p,_id:p.id,type:'product'})), products: rows });
});
products.get('/ids', async c => {
  /* منتجات محددة بالمعرّفات — يستخدمها بانى الصفحة لمصدر "اختيار يدوي".
     المعرّفات فقط (لا أسعار ولا بيانات أعمال) تُحفظ في إعدادات البلوك. */
  const ids = String(c.req.query('ids') || '').split(',').map(s=>s.trim()).filter(Boolean).slice(0,50);
  if (!ids.length) return ok(c, { products: [] });
  const ph = ids.map(()=>'?').join(',');
  const country = c.get('country'); const ae = isAE(country);
  const rows = await all(c.env.DB.prepare(`SELECT * FROM products WHERE isActive=1 ${ae?'AND isActiveAE=1 AND priceAE IS NOT NULL':''} AND id IN (${ph})`).bind(...ids));
  const byId = new Map(rows.map(p=>[p.id,p]));
  const ordered = ids.map(id=>byId.get(id)).filter(Boolean);
  return ok(c, { products: ordered.map((p)=>shapeProductForCountry(productShape(p), country)) });
});
products.get('/slug/:slug', optionalAuth, async c => {
  const p = await first(c.env.DB.prepare(`SELECT p.*, c.name categoryName,c.slug categorySlug,b.name brandName,b.slug brandSlug FROM products p LEFT JOIN categories c ON c.id=p.category LEFT JOIN brands b ON b.id=p.brand WHERE p.slug=?`).bind(c.req.param('slug')));
  const country = c.get('country');
  /* بوابة البلد: منتجٌ غير مفعّل للإمارات أو بلا سعر إماراتي = غير موجود إطلاقاً هناك */
  if (!p || !p.isActive || !productAvailableInCountry(p, country)) return fail(c,'المنتج غير موجود',404);
  return ok(c,{ product: shapeProductForCountry(productShape(p), country) });
});
products.get('/:id/related', async c => {
  const p = await first(c.env.DB.prepare('SELECT category,brand FROM products WHERE id=?').bind(c.req.param('id'))); if (!p) return fail(c,'المنتج غير موجود',404);
  const limit = Number(c.req.query('limit'))||8;
  const country = c.get('country'); const ae = isAE(country);
  const rows = await all(c.env.DB.prepare(`SELECT * FROM products WHERE isActive=1 ${ae?'AND isActiveAE=1 AND priceAE IS NOT NULL':''} AND id<>? AND (category=? OR brand=?) ORDER BY rating DESC,soldCount DESC LIMIT ?`).bind(c.req.param('id'),p.category,p.brand,limit));
  return ok(c,{ products: rows.map((x)=>shapeProductForCountry(productShape(x), country)) });
});
products.get('/:id', async c => { const p=await first(c.env.DB.prepare('SELECT * FROM products WHERE id=?').bind(c.req.param('id'))); const country=c.get('country');
  /* مصر: نفس السلوك التاريخي تماماً (لا تحقق isActive هنا). الإمارات: بوابة الإتاحة الكاملة. */
  if (!p || (isAE(country) && !productAvailableInCountry(p, country))) return fail(c,'المنتج غير موجود',404);
  return ok(c,{ product:shapeProductForCountry(productShape(p), country) }); });

const normalizeProductInput = (body, old = {}) => {
  const now = nowIso(); const row = { ...old };
  const direct = ['name','nameEn','slug','sku','description','descriptionEn','ingredients','howToUse','category','brand','mainImage','metaTitle','metaDescription','status','publishAt'];
  for (const k of direct) {
    if (body[k] === undefined) continue;
    /* إصلاح جذري: النموذج/الواجهة يرسلان '' عند ترك القسم أو الماركة بلا اختيار،
       وسلسلة فارغة تكسر قيد FOREIGN KEY في D1 (خطأ 500 عند إنشاء منتج بلا قسم/ماركة —
       وهي الحالة الحتمية بعد Full Reset حيث لا توجد أقسام أو ماركات).
       المعنى الصحيح لـ'' هو "بدون قسم/ماركة" = NULL، وهو ما يقبله المخطط. */
    if ((k === 'category' || k === 'brand') && body[k] === '') { row[k] = null; continue; }
    row[k] = body[k];
  }
  for (const k of ['price','oldPrice','cost','rating','soldCount','stock','discount','isFeatured','isBestSeller','isNewArrival','isActive','isActiveAE','trackInventory']) if (body[k] !== undefined) row[k] = ['isFeatured','isBestSeller','isNewArrival','isActive','isActiveAE','trackInventory'].includes(k) ? (body[k]?1:0) : body[k];
  /* تسعير الإمارات (المرحلة D/K): قيم REAL قابلة للفراغ — '' تعني «بلا سعر إماراتي» ⇒ NULL
     ولا يتحوّل أي سعر مصري إلى إماراتي آلياً أبداً؛ الإدمن يكتب الأرقام صراحةً.
     Gate 2: الخادم هو المرجع — payload مزيّف بسعر سالب/غير رقمي كان سيُخزَّن ويصبح
     المنتج قابلاً للبيع في الإمارات بالسالب (البوابة تفحص NULL فقط). يُرفض الآن 400. */
  for (const k of ['priceAE','oldPriceAE']) {
    if (body[k] === undefined) continue;
    if (body[k] === '' || body[k] === null) { row[k] = null; continue; }
    const n = Number(body[k]);
    if (!Number.isFinite(n) || n < 0) throw new FriendlyError('سعر الإمارات يجب أن يكون رقماً صالحاً لا يقل عن صفر', 400);
    row[k] = n;
  }
  for (const k of ['images','variants','colors','sizes','tags','metaKeywords']) if (body[k] !== undefined) row[k] = stringify(body[k] || []);
  if (!row.slug && (row.nameEn||row.name)) row.slug = slugify(row.nameEn || row.name);
  if (!row.sku) row.sku = `${(row.nameEn||row.name||'SKU').replace(/[^A-Za-z0-9]+/g,'').slice(0,6) || 'SKU'}-${Date.now().toString(36).toUpperCase()}`;
  if (row.oldPrice && Number(row.oldPrice) > Number(row.price)) row.discount = Math.round(((Number(row.oldPrice)-Number(row.price))/Number(row.oldPrice))*100);
  if (row.status === 'draft') row.isActive = 0; if (row.status === 'published') row.isActive = 1;
  row.updatedAt = now; return row;
};

async function saveProduct(env, body, id) {
  const old = id ? await first(env.DB.prepare('SELECT * FROM products WHERE id=?').bind(id)) : null;
  const row = normalizeProductInput(body, old || {});
  // قسم/ماركة: قد يصلا كمعرّف أو كاسم خام من النموذج — نُوحّدهما لمعرّف سجل حقيقي
  row.category = await resolveTaxonomy(env, 'categories', row.category, false, 'القسم');
  row.brand = await resolveTaxonomy(env, 'brands', row.brand, true, 'الماركة');
  if (old) {
    // hydrate() يضيف alias ‏`_id` للصف — يجب حذفه مع id قبل UPDATE
    // وإلا تفشل الجملة بـ D1_ERROR: no such column: _id (كسر تعديل المنتجات).
    delete row.id; delete row._id; const cols = Object.keys(row);
    try {
      await run(env.DB.prepare(`UPDATE products SET ${cols.map(c=>`${c}=?`).join(',')} WHERE id=?`).bind(...cols.map(c=>row[c]), id));
    } catch (e) { guardUnique(e); }
    return first(env.DB.prepare('SELECT * FROM products WHERE id=?').bind(id));
  }
  row.id = id || uuid(); row.createdAt = nowIso(); row.updatedAt = row.createdAt;
  const cols = Object.keys(row);
  try {
    await run(env.DB.prepare(`INSERT INTO products (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`).bind(...cols.map(c=>row[c])));
  } catch (e) { guardUnique(e); }
  return first(env.DB.prepare('SELECT * FROM products WHERE id=?').bind(row.id));
}

export { saveProduct, listProducts, normalizeProductInput };

const categories = new Hono();
/* التصنيفات نفسها عالمية (كتالوج واحد) لكن قائمة منتجات التصنيف تتبع البلد */
categories.use('*', countryMiddleware);
categories.get('/', async c => ok(c,{ categories: (await all(c.env.DB.prepare('SELECT * FROM categories ORDER BY sortOrder ASC, name ASC'))).map(r=>({...r,_id:r.id,keywords:parseJson(r.keywords,[])})) }));
categories.get('/:slug', async c => { const cat=await first(c.env.DB.prepare('SELECT * FROM categories WHERE slug=?').bind(c.req.param('slug'))); if (!cat) return fail(c,'القسم غير موجود',404); return ok(c,{ category:{...cat,_id:cat.id,keywords:parseJson(cat.keywords,[])}, products:(await listProducts(c.env,{category:cat.id,limit:20}, false, c.get('country'))).products }); });
const brands = new Hono();
brands.get('/', async c => ok(c,{ brands: (await all(c.env.DB.prepare('SELECT * FROM brands WHERE isActive=1 ORDER BY sortOrder ASC, name ASC'))).map(b=>({...b,_id:b.id,keywords:parseJson(b.keywords,[])})) }));
brands.get('/:slug', async c => { const b=await first(c.env.DB.prepare('SELECT * FROM brands WHERE slug=?').bind(c.req.param('slug'))); if (!b) return fail(c,'الماركة غير موجودة',404); return ok(c,{ brand:{...b,_id:b.id,keywords:parseJson(b.keywords,[])} }); });
const banners = new Hono();
banners.get('/', async c => { const q=c.req.query('position'); const rows = q ? await all(c.env.DB.prepare('SELECT * FROM banners WHERE isActive=1 AND position=? ORDER BY sortOrder ASC').bind(q)) : await all(c.env.DB.prepare('SELECT * FROM banners WHERE isActive=1 ORDER BY sortOrder ASC')); return ok(c,{ banners: rows.map(x=>({...x,_id:x.id})) }); });

export { products, categories, brands, banners };
