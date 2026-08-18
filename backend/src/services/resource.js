import { nowIso, parseJson, stringify, uuid, slugify, bool, asArray } from '../lib/response.js';
import { all, first, run, buildWhere, paginateQuery } from '../lib/db.js';

export const RESOURCES = {
  categories: { table:'categories', search:['name','nameEn','slug'], defaults:{ isActive:1, sortOrder:0 } },
  brands: { table:'brands', search:['name','nameEn','slug'], defaults:{ isActive:1, sortOrder:0 } },
  banners: { table:'banners', search:['title','subtitle'], defaults:{ isActive:1, sortOrder:0 } },
  'shipping-zones': { table:'shipping_zones', search:['name','nameEn'], defaults:{ isActive:1, sortOrder:0 } },
  'shipping-companies': { table:'shipping_companies', search:['name','nameEn','code'], defaults:{ isActive:1, sortOrder:0 } },
  governorates: { table:'governorates', search:['name','nameEn','code'], defaults:{ isActive:1, sortOrder:0 } },
  'payment-methods': { table:'payment_methods', search:['name','nameEn','code'], defaults:{ isActive:1, isVisible:1, sortOrder:0 } },
  pages: { table:'pages', search:['title','titleEn','slug'], defaults:{ isActive:1, status:'published', sortOrder:0, data:'{}', showInFooter:1 } },
  'home-sections': { table:'home_sections', search:['title','titleEn','type'], defaults:{ isActive:1, sortOrder:0, data:'{}' } },
  popups: { table:'popups', search:['title'], defaults:{ isActive:1, sortOrder:0, data:'{}' } },
  'flash-sales': { table:'flash_sales', search:['name','nameEn'], defaults:{ isActive:1, products:[], data:'{}' } },
  testimonials: { table:'testimonials', search:['name','nameEn','content'], defaults:{ isActive:1, sortOrder:0, rating:5 } },
  'instagram-posts': { table:'instagram_posts', search:['caption'], defaults:{ isActive:1, sortOrder:0 } },
  'return-reasons': { table:'return_reasons', search:['name','nameEn'], defaults:{ isActive:1, sortOrder:0 } },
  'theme-presets': { table:'theme_presets', search:['name','description'], defaults:{ isActive:0, sortOrder:0, theme:{} } },
  'email-templates': { table:'email_templates', search:['name','key','subject'], defaults:{ isActive:1, variables:[] } },
  countries: { table:'countries', search:['name','nameEn','code'], defaults:{ isActive:1, isDefault:0, sortOrder:0, shipping:'{}' } }
};

/**
 * قائمة بيضاء بأعمدة كل جدول.
 * كل ما يخرج عنها يذهب إلى عمود data (JSON) — وهذا يحل مشكلتين معاً:
 *   1) كانت الواجهة ترسل حقولاً (key/subtitle/source/limit/sections/faqs/order…)
 *      لا أعمدة لها في D1 فتفشل INSERT/UPDATE بـ "no column named …".
 *   2) يمنع حقن أعمدة عشوائية من أي payload (تحصين إضافي).
 */
export const TABLE_COLUMNS = {
  categories: ['id','name','nameEn','slug','image','description','descriptionEn','parent','metaTitle','metaDescription','keywords','isActive','sortOrder','createdAt','updatedAt'],
  brands: ['id','name','nameEn','slug','logo','description','descriptionEn','metaTitle','metaDescription','keywords','isActive','sortOrder','createdAt','updatedAt'],
  banners: ['id','title','titleEn','subtitle','subtitleEn','image','link','buttonText','buttonTextEn','position','sortOrder','isActive','startDate','endDate','createdAt','updatedAt'],
  'shipping-zones': ['id','name','nameEn','governorateIds','cost','freeThreshold','estimatedDaysMin','estimatedDaysMax','isActive','sortOrder','createdAt','updatedAt'],
  'shipping-companies': ['id','code','name','nameEn','trackingUrl','isActive','sortOrder','config','createdAt','updatedAt'],
  /* Gate 2: countryCode كان غائباً من القائمة ⇒ كل إمارة تُنشأ من الإدارة تُسقط
     بلدها ويستلم عمود D1 الافتراضي 'EG' فتُسجَّل مصرية (إصلاح Gate 0/RC-admin). */
  governorates: ['id','code','name','nameEn','countryCode','isActive','sortOrder','shippingCost','codEnabled','zoneId','createdAt','updatedAt'],
  'payment-methods': ['id','code','name','nameEn','description','instructions','logo','type','isActive','isVisible','requiresProof','requiresReference','feeType','feeValue','sortOrder','config','createdAt','updatedAt'],
  pages: ['id','title','titleEn','slug','content','contentEn','status','isActive','metaTitle','metaDescription','sortOrder','showInFooter','data','createdAt','updatedAt'],
  'home-sections': ['id','type','title','titleEn','isActive','sortOrder','data','createdAt','updatedAt'],
  popups: ['id','title','content','image','link','startDate','endDate','isActive','sortOrder','data','createdAt','updatedAt'],
  'flash-sales': ['id','name','nameEn','startsAt','endsAt','isActive','products','data','createdAt','updatedAt'],
  testimonials: ['id','name','nameEn','rating','content','contentEn','avatar','isActive','sortOrder','createdAt','updatedAt'],
  'instagram-posts': ['id','image','caption','link','isActive','sortOrder','createdAt','updatedAt'],
  'return-reasons': ['id','name','nameEn','isActive','sortOrder','createdAt','updatedAt'],
  'theme-presets': ['id','name','nameEn','description','slug','theme','isActive','sortOrder','createdAt','updatedAt'],
  'email-templates': ['id','key','name','subject','body','isActive','variables','sortOrder','createdAt','updatedAt'],
  /* البلدان: بلا عمود id — المفتاح الأساسي هو code */
  countries: ['code','name','nameEn','currency','currencySymbol','currencySymbolEn','currencyPosition','shipping','isActive','isDefault','sortOrder','createdAt','updatedAt']
};

/** عمود المفتاح الأساسي لكل مورد — countries يُعرَّف بـ code لا id */
const pkCol = (resource) => (TABLE_COLUMNS[resource]?.includes('id') ? 'id' : 'code');

/** أعمدة JSON تُحفظ كسلسلة نصية */
const JSON_COLUMNS = {
  categories:['keywords'], brands:['keywords'], 'shipping-zones':['governorateIds'], 'payment-methods':['config'],
  pages:['data'], 'home-sections':['data'], popups:['data'], 'flash-sales':['products','data'],
  'theme-presets':['theme'], 'email-templates':['variables'], 'shipping-companies':['config'], banners:[],
  countries:['shipping']
};

/** الحقول الحرة (غير الموجودة كأعمدة) تُحفظ داخل data بدل رفضها */
const DATA_VIRTUAL_FIELDS = new Set([
  // page builder / home sections
  'key','subtitle','subtitleEn','source','category','limit','layout','viewAllLink','html',
  'image','mobileImage','buttonText','buttonTextEn','buttonUrl','background','textColor','overlayColor','overlayOpacity',
  'textAlign','imagePosition','paddingTop','paddingBottom','paddingTopMobile','paddingBottomMobile','radius',
  'columnsDesktop','columnsMobile','animation','status','titleAr','titleEn2','description','descriptionEn','items','body','bodyEn',
  'heading','headingEn','question','questionEn','answer','answerEn','icon','spacing','style','showCountdown','repeatAfterHours','delaySeconds','showOn',
  // pages UI
  'sections','faqs'
]);

const parseStoredData = (row) => {
  if (!row) return row;
  const data = parseJson(row.data, {});
  const cfg = parseJson(row.config, {});
  const merged = {};
  if (data && typeof data === 'object' && !Array.isArray(data)) Object.assign(merged, data);
  if (cfg && typeof cfg === 'object' && !Array.isArray(cfg)) Object.assign(merged, cfg);
  return Object.keys(merged).length ? { ...merged, ...row } : row;
};

/** عمود JSON الحر لكل مورد (config لطرق الدفع، data لغيره) */
const jsonColumnOf = (resource) =>
  resource === 'payment-methods' || resource === 'shipping-companies' ? 'config' : 'data';

const normalize = (resource, payload, existing = {}) => {
  const columns = TABLE_COLUMNS[resource] || [];
  const out = {};
  const dataObj = {};
  for (const [k, v] of Object.entries(existing)) {
    if (k === '_id' || k === 'id' || k === 'createdAt' || k === 'updatedAt') continue;
    if (columns.includes(k)) out[k] = v;
    else if (k === 'data' || k === 'config') { /* يُعالج أدناه */ }
    else dataObj[k] = v;
  }
  const jsonColumn = jsonColumnOf(resource);
  const oldData = parseJson(existing[jsonColumn], {});
  if (oldData && typeof oldData === 'object' && !Array.isArray(oldData)) Object.assign(dataObj, oldData);

  for (const [k, v] of Object.entries(payload || {})) {
    if (['id', '_id', 'createdAt', 'updatedAt'].includes(k)) continue;
    if (v === undefined || v === null) continue;
    if (columns.includes(k)) {
      if (['isActive','isVisible','freeShipping','requiresProof','requiresReference','codEnabled','showInFooter','isDefault'].includes(k)) out[k] = bool(v) ? 1 : 0;
      else if (JSON_COLUMNS[resource]?.includes(k)) out[k] = typeof v === 'string' ? v : stringify(v);
      else if (['shippingCost','feeValue','cost','freeThreshold','estimatedDaysMin','estimatedDaysMax','sortOrder'].includes(k)) out[k] = Number(v) || 0;
      else out[k] = v;
    } else if (k === 'order') {
      out.sortOrder = Number(v) || 0;
    } else if (DATA_VIRTUAL_FIELDS.has(k)) {
      dataObj[k] = v;
    } else if (Array.isArray(v) || (typeof v === 'object' && v !== null)) {
      // أي كائن/مصفوفة مجهول يذهب إلى عمود JSON الحر — لا يسمح بأعمدة غير موجودة إطلاقاً
      dataObj[k] = v;
    } else {
      // قيم أولية مجهولة: تُحفظ في عمود JSON الحر بدل كسر الجملة
      dataObj[k] = v;
    }
  }

  if (resource === 'categories' || resource === 'brands') {
    out.slug = slugify(out.slug || out.nameEn || out.name || '');
    if (!out.name && out.title) out.name = out.title;
  }
  if (resource === 'pages') {
    out.slug = slugify(out.slug || out.titleEn || out.title || '');
  }
  if (resource === 'governorates' && !out.code) out.code = String(out.nameEn||out.name||'').toUpperCase().replace(/\s+/g,'-').slice(0,20) || uuid();
  /* Gate 2: بلد المحافظة/الإمارة مقيّد برمزين معروفين — مصر تبقى EG والإمارات تبقى AE */
  if (resource === 'governorates') {
    out.countryCode = String(out.countryCode || 'EG').trim().toUpperCase();
    if (!['EG', 'AE'].includes(out.countryCode)) out.countryCode = 'EG';
  }
  if (resource === 'shipping-zones' && !out.governorateIds) out.governorateIds = '[]';
  /* البلدان: تحققات صارمة للكود والعملة — جدول حرج للمتجر كله */
  if (resource === 'countries') {
    out.code = String(out.code || '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(out.code)) throw Object.assign(new Error('كود البلد يجب أن يكون حرفين لاتينيين كبيرين (مثال: EG)'), { status: 400, friendly: true });
    out.currency = String(out.currency || '').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(out.currency)) throw Object.assign(new Error('كود العملة يجب أن يكون ثلاثة أحرف (مثال: EGP أو AED)'), { status: 400, friendly: true });
    if (!out.name || !out.nameEn) throw Object.assign(new Error('اسم البلد بالعربية والإنجليزية مطلوب'), { status: 400, friendly: true });
    if (out.currencyPosition && !['after','before'].includes(out.currencyPosition)) out.currencyPosition = 'after';
    if (!out.shipping || typeof out.shipping !== 'string') out.shipping = stringify(out.shipping || {});
  }

  /* الحقول الحرة تُحفظ في عمود JSON الحر الخاص بالمورد
     (config لطرق الدفع وشركات الشحن، data لغيرهما) */
  if (columns.includes(jsonColumn)) {
    out[jsonColumn] = stringify(dataObj);
  }
  return out;
};

export async function listResource(env, resource, query = {}) {
  const def = RESOURCES[resource]; if (!def) throw new Error('unknown-resource');
  const { page, limit, offset } = paginateQuery(query, resource === 'governorates' ? 200 : 20, 200);
  const where = []; const params = {};
  if (query.isActive !== undefined && query.isActive !== '') { where.push('isActive = @isActive'); params.isActive = bool(query.isActive) ? 1 : 0; }
  if (query.status) { where.push('status = @status'); params.status = query.status; }
  if (query.q) { where.push(`(${def.search.map((s,i)=>`${s} LIKE @q${i}`).join(' OR ')})`); def.search.forEach((s,i)=>params[`q${i}`]=`%${query.q}%`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const safeWhere = whereSql.replaceAll('@isActive','?').replaceAll('@status','?').replace(/@q\d+/g,'?');
  const bindVals = [];
  if (query.isActive !== undefined && query.isActive !== '') bindVals.push(bool(query.isActive)?1:0);
  if (query.status) bindVals.push(query.status);
  if (query.q) def.search.forEach(()=>bindVals.push(`%${query.q}%`));
  const total = (await env.DB.prepare(`SELECT COUNT(*) n FROM ${def.table} ${safeWhere}`).bind(...bindVals).first()).n;
  /* جداول بلا عمود sortOrder (مثل flash_sales) كانت تكسر الاستعلام بـ no such column */
  const orderBy = TABLE_COLUMNS[resource]?.includes('sortOrder') ? 'sortOrder ASC, createdAt DESC' : 'createdAt DESC';
  const items = await all(env.DB.prepare(`SELECT * FROM ${def.table} ${safeWhere} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).bind(...bindVals, limit, offset));
  return { items: items.map(parseStoredData), [resource]: items.map(parseStoredData), page, limit, total, pages: Math.max(1, Math.ceil(total/limit)) };
}

/** بعد كتابة دولة افتراضية: بلد افتراضي واحد فقط في النظام كله. */
async function enforceSingleDefault(env, row) {
  if (Number(row?.isDefault) === 1) await run(env.DB.prepare('UPDATE countries SET isDefault=0 WHERE code<>?').bind(row.code));
}

export async function getResource(env, resource, id) { return parseStoredData(await first(env.DB.prepare(`SELECT * FROM ${RESOURCES[resource].table} WHERE ${pkCol(resource)}=?`).bind(id))); }
/** يحوّل أخطاء UNIQUE من رسالة D1 خام إلى خطأ ودّي (409) للمستخدم. */
const guardUnique = (e) => {
  const m = String(e?.message || '').match(/UNIQUE constraint failed: (\w+)\.(\w+)/);
  if (m) throw Object.assign(new Error(`قيمة «${m[2]}» مستخدمة مسبقاً — استخدم قيمة أخرى`), { status: 409, friendly: true });
  throw e;
};

export async function createResource(env, resource, payload) {
  const def = RESOURCES[resource]; const row = normalize(resource, { ...def.defaults, ...payload });
  const pk = pkCol(resource);
  if (pk === 'id') row.id = uuid();
  row.createdAt = nowIso(); row.updatedAt = row.createdAt;
  const cols = Object.keys(row).filter(c => TABLE_COLUMNS[resource]?.includes(c));
  const vals = cols.map(c=>row[c]);
  try {
    await run(env.DB.prepare(`INSERT INTO ${def.table} (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`).bind(...vals));
  } catch (e) { guardUnique(e); }
  if (resource === 'countries') await enforceSingleDefault(env, row);
  return getResource(env, resource, row[pk]);
}
export async function updateResource(env, resource, id, payload) {
  const pk = pkCol(resource);
  const old = await first(env.DB.prepare(`SELECT * FROM ${RESOURCES[resource].table} WHERE ${pk}=?`).bind(id));
  if (!old) return null;
  const row = normalize(resource, payload, old); row.updatedAt = nowIso();
  const cols = Object.keys(row).filter(c => TABLE_COLUMNS[resource]?.includes(c) && c !== pk && c !== 'id');
  try {
    await run(env.DB.prepare(`UPDATE ${defTable(resource)} SET ${cols.map(c=>`${c}=?`).join(',')} WHERE ${pk}=?`).bind(...cols.map(c=>row[c]), id));
  } catch (e) { guardUnique(e); }
  if (resource === 'countries') await enforceSingleDefault(env, { ...row, code: id });
  return getResource(env, resource, id);
}
export async function deleteResource(env, resource, id) { await run(env.DB.prepare(`DELETE FROM ${defTable(resource)} WHERE ${pkCol(resource)}=?`).bind(id)); return true; }
const defTable = (r) => RESOURCES[r].table;
export async function reorderResource(env, resource, items = []) {
  const pk = pkCol(resource);
  const now = nowIso(); const stmts = items.map((it,i)=>env.DB.prepare(`UPDATE ${defTable(resource)} SET sortOrder=?, updatedAt=? WHERE ${pk}=?`).bind(Number(i), now, it.id || it._id || it.code));
  if (stmts.length) await env.DB.batch(stmts); return true;
}
export async function toggleResource(env, resource, id, field) {
  const pk = pkCol(resource);
  const old = await getResource(env, resource, id); if (!old) return null;
  const next = old[field] ? 0 : 1;
  await run(env.DB.prepare(`UPDATE ${defTable(resource)} SET ${field}=?, updatedAt=? WHERE ${pk}=?`).bind(next, nowIso(), id));
  if (resource === 'countries' && field === 'isDefault' && next === 1) await enforceSingleDefault(env, { code: id, isDefault: 1 });
  return getResource(env, resource, id);
}
