/**
 * إعادة ضبط بيانات المتجر (Store Reset Center)
 * ============================================
 * حماية مزدوجة: (1) JWT + RBAC من وسطاء الإدارة الحاليين،
 * (2) تحقق صريح داخل كل معالج: سوبر أدمن فقط + كلمة مرور + عبارة تأكيد دقيقة.
 *
 * لا يمس هذا النظام إطلاقاً:
 *   - حسابات الإدارة (admin/moderator) ولا جلساتها
 *   - settings (كل المفاتيح: النظام/التواصل/الترجمات/الثيمات/الفونتات/شريط الإعلانات…)
 *   - payment_methods / shipping_zones / shipping_companies / governorates / return_reasons
 *   - theme_presets / banners / pages / home_sections / popups / flash_sales / testimonials
 *     / instagram_posts / email_templates (تكوين الواجهة و CMS)
 *   - media التي لا تخص السجلات المحذوفة
 *   - audit_logs / error_logs / jobs / api_metrics / sessions / schema / migrations
 *   - دلو R2 نفسه (تحذف فقط الملفات التابعة للسجلات المحذوفة)
 *
 * ترتيب الحذف دائماً من التابع إلى الأصل للحفاظ على التكامل المرجعي.
 */
import { Hono } from 'hono';
import { all, first, run } from '../lib/db.js';
import { ok, fail, nowIso, parseJson, stringify } from '../lib/response.js';
import { verifyPassword } from '../lib/crypto.js';
import { auditLog } from '../services/paymentVerification.js';

const app = new Hono();

/* ------------------------------------------------------------------ */
/* عبارات التأكيد — تُعرض في الواجهة ويجب كتابتها حرفياً               */
/* ------------------------------------------------------------------ */
export const RESET_PHRASES = {
  orders: 'DELETE ORDERS',
  products: 'DELETE PRODUCTS',
  categories: 'DELETE CATEGORIES',
  brands: 'DELETE BRANDS',
  reviews: 'DELETE REVIEWS',
  returns: 'DELETE RETURNS',
  coupons: 'DELETE COUPONS',
  customers: 'DELETE CUSTOMERS',
  notifications: 'DELETE NOTIFICATIONS',
  'payment-verifications': 'DELETE PAYMENT VERIFICATIONS',
  inventory: 'DELETE INVENTORY',
  'store-reset': 'RESET AL ZEINA'
};

/* ------------------------------------------------------------------ */
/* سوبر أدمن؟ (نفس منطق الأدوار الموجود — بلا نظام مصادقة ثانٍ)        */
/* ------------------------------------------------------------------ */
const isSuperAdmin = (user, env) =>
  Boolean(user) &&
  user.role === 'admin' &&
  (user.staffRole === 'super-admin' ||
    String(user.email || '').toLowerCase() === String(env.ADMIN_EMAIL || 'admin@alzeina.com').toLowerCase());

const requireResetAuth = async (c, group) => {
  const user = c.get('user');
  if (!user) return c.json({ status: 'error', message: 'غير مصرح به. يرجى تسجيل الدخول.' }, 401);
  if (!isSuperAdmin(user, c.env)) {
    return c.json({ status: 'error', message: 'إعادة ضبط البيانات متاحة للمدير الأعلى فقط.' }, 403);
  }
  let body = {};
  try { body = await c.req.json().catch(() => ({})); } catch { body = {}; }
  if (body.acknowledge !== true) return fail(c, 'يجب تأكيد فهمك أن الحذف نهائي ولا يمكن التراجع عنه.', 400);
  const phrase = RESET_PHRASES[group];
  if (!String(body.confirmPhrase || '').trim() || String(body.confirmPhrase || '').trim() !== phrase) {
    return fail(c, `عبارة التأكيد غير صحيحة. اكتب: ${phrase}`, 400);
  }
  if (!String(body.password || '')) return fail(c, 'كلمة مرور المدير الأعلى مطلوبة.', 400);
  // إعادة التحقق من كلمة المرور رغم وجود جلسة صالحة (متطلب أمني)
  const dbUser = await first(c.env.DB.prepare('SELECT * FROM users WHERE id=?').bind(user.id));
  if (!dbUser || !dbUser.passwordHash) return fail(c, 'تعذر التحقق من الحساب.', 400);
  const match = await verifyPassword(String(body.password), dbUser.passwordHash);
  if (!match) {
    await auditLog(c.env, c, { action: `store_reset_${group}_denied`, entity: 'system', label: group, message: 'كلمة مرور غير صحيحة', success: false });
    return fail(c, 'كلمة المرور غير صحيحة.', 400);
  }
  return null; // اجتاز كل الشروط
};

/* ------------------------------------------------------------------ */
/* أدوات R2 آمنة: نحذف فقط مفاتيح السجلات المحذوفة غير المرتبطة        */
/* بأي تكوين/أصل محفوظ آخر                                           */
/* ------------------------------------------------------------------ */
const keyOf = (value) => {
  const s = String(value || '').trim();
  if (!s) return null;
  if (/^(https?:|data:|blob:)/i.test(s)) return null; // خارجي أو data-URI — لا نلمسه
  // يقبل الشكلين: مفتاح خام ('proofs/x.png') أو رابط '/uploads/proofs/x.png'
  const key = s.startsWith('/uploads/') ? s.slice('/uploads/'.length) : s;
  if (!key || key.includes('..') || key.startsWith('/')) return null;
  return key;
};
const keysOf = (value) => {
  let arr = [];
  try { const p = parseJson(value, null); if (Array.isArray(p)) arr = p; } catch { arr = []; }
  if (!Array.isArray(arr)) arr = [];
  const out = [];
  for (const v of arr) { const k = keyOf(v); if (k) out.push(k); }
  return out;
};

/** كل النصوص الخام في الجداول المحفوظة (لتحديد المفاتيح/الروابط المستخدمة) */
async function preservedReferenceStrings(env, { excludeMedia = false } = {}) {
  const sources = [
    'SELECT image AS v FROM banners',
    'SELECT image AS v FROM categories',
    'SELECT logo AS v FROM brands',
    'SELECT avatar AS v FROM testimonials',
    'SELECT image AS v FROM instagram_posts',
    'SELECT image AS v FROM popups',
    'SELECT content AS v FROM pages',
    'SELECT contentEn AS v FROM pages',
    'SELECT data AS v FROM pages',
    'SELECT data AS v FROM home_sections',
    'SELECT theme AS v FROM theme_presets',
    'SELECT config AS v FROM payment_methods',
    'SELECT config AS v FROM shipping_companies',
    'SELECT value AS v FROM settings',
    'SELECT mainImage AS v FROM products',
    'SELECT images AS v FROM products',
    'SELECT paymentProof AS v FROM orders',
  ];
  if (!excludeMedia) sources.push('SELECT filename AS v FROM media', 'SELECT url AS v FROM media', 'SELECT thumbnailUrl AS v FROM media');
  const strs = [];
  for (const sql of sources) {
    try {
      const rows = await all(env.DB.prepare(sql));
      for (const r of rows) { if (r.v != null) strs.push(String(r.v)); }
    } catch { /* جدول/عمود غير موجود؟ نكمل بأمان */ }
  }
  return strs;
}

/** هل المفتاح مستخدم في أي أصل محفوظ؟ (تستثنى صفوف media المملوكة للسجل المحذوف) */
async function isKeyReferencedElsewhere(env, key) {
  const refs = await preservedReferenceStrings(env, { excludeMedia: true });
  return refs.some((s) => s.includes(`/uploads/${key}`) || s === key);
}

/** يحذف مفاتيح R2 غير المرتبطة بأي أصل محفوظ */
async function deleteR2KeysSafe(env, keys) {
  const uniq = [...new Set(keys.map(keyOf).filter(Boolean))];
  if (!uniq.length || !env.R2) return { scanned: uniq.length, deleted: 0, kept: 0 };
  let deleted = 0, kept = 0;
  for (const key of uniq) {
    const used = await isKeyReferencedElsewhere(env, key);
    if (used) { kept++; continue; }
    try { await env.R2.delete(key); deleted++; } catch { kept++; }
  }
  return { scanned: uniq.length, deleted, kept };
}

/** حذف صفوف media التي تحمل مفاتيح السجلات المحذوفة وغير المستخدمة في مكان آخر */
async function deleteMediaRowsForKeys(env, keys) {
  const uniq = [...new Set(keys.map(keyOf).filter(Boolean))];
  if (!uniq.length) return 0;
  let removed = 0;
  for (const key of uniq) {
    const used = await isKeyReferencedElsewhere(env, key);
    if (used) continue;
    const m = await first(env.DB.prepare('SELECT id FROM media WHERE filename=? OR url=?').bind(key, `/uploads/${key}`));
    if (m) { await run(env.DB.prepare('DELETE FROM media WHERE id=?').bind(m.id)); removed++; }
  }
  return removed;
}

/* ------------------------------------------------------------------ */
/* عدادات المعاينة                                                    */
/* ------------------------------------------------------------------ */
async function countsOf(env, group) {
  const n = async (sql, ...b) => Number((await env.DB.prepare(sql).bind(...b).first())?.n || 0);
  switch (group) {
    case 'orders': {
      const orderIds = (await all(env.DB.prepare('SELECT id FROM orders'))).map((r) => r.id);
      const receiptKeys = [
        ...(await all(env.DB.prepare('SELECT receiptKey, receiptUrl FROM payment_verifications WHERE orderId IN (SELECT id FROM orders)'))).flatMap((r) => [r.receiptKey, r.receiptUrl]),
        ...(await all(env.DB.prepare('SELECT paymentProof FROM orders WHERE paymentProof IS NOT NULL'))).map((r) => r.paymentProof)
      ];
      return {
        orders: await n('SELECT COUNT(*) n FROM orders'),
        orderItems: await n('SELECT COUNT(*) n FROM order_items'),
        paymentVerifications: await n('SELECT COUNT(*) n FROM payment_verifications'),
        returnRequests: await n('SELECT COUNT(*) n FROM return_requests'),
        notifications: await n("SELECT COUNT(*) n FROM notifications WHERE refModel='Order'"),
        couponUsage: await n('SELECT COUNT(*) n FROM coupon_users'),
        stockMovements: await n("SELECT COUNT(*) n FROM stock_movements WHERE referenceType='order'"),
        receiptFiles: [...new Set(receiptKeys.map(keyOf).filter(Boolean))].length,
        _orderIds: orderIds
      };
    }
    case 'products': {
      const rows = await all(env.DB.prepare('SELECT mainImage, images, variants FROM products'));
      const keys = rows.flatMap((p) => [keyOf(p.mainImage), ...keysOf(p.images)]);
      return {
        products: await n('SELECT COUNT(*) n FROM products'),
        variants: rows.reduce((s, p) => s + parseJson(p.variants, []).length, 0),
        productImages: rows.reduce((s, p) => s + parseJson(p.images, []).length + (keyOf(p.mainImage) ? 1 : 0), 0),
        stockMovements: await n('SELECT COUNT(*) n FROM stock_movements'),
        reviews: await n('SELECT COUNT(*) n FROM reviews'),
        wishlist: await n('SELECT COUNT(*) n FROM wishlist'),
        productViews: await n('SELECT COUNT(*) n FROM product_views'),
        r2Files: [...new Set(keys.filter(Boolean))].length
      };
    }
    case 'categories':
      return {
        categories: await n('SELECT COUNT(*) n FROM categories'),
        productsLinked: await n('SELECT COUNT(*) n FROM products WHERE category IS NOT NULL')
      };
    case 'brands':
      return {
        brands: await n('SELECT COUNT(*) n FROM brands'),
        productsLinked: await n('SELECT COUNT(*) n FROM products WHERE brand IS NOT NULL')
      };
    case 'reviews':
      return { reviews: await n('SELECT COUNT(*) n FROM reviews'), affectedProducts: await n('SELECT COUNT(*) n FROM products WHERE rating!=0 OR reviewsCount!=0') };
    case 'returns': {
      const rows = await all(env.DB.prepare('SELECT images FROM return_requests'));
      return { returns: rows.length, r2Files: [...new Set(rows.flatMap((r) => keysOf(r.images)).filter(Boolean))].length };
    }
    case 'coupons':
      return { coupons: await n('SELECT COUNT(*) n FROM coupons'), couponUsage: await n('SELECT COUNT(*) n FROM coupon_users') };
    case 'customers':
      return {
        customers: await n("SELECT COUNT(*) n FROM users WHERE role='user'"),
        addresses: await n("SELECT COUNT(*) n FROM addresses WHERE userId IN (SELECT id FROM users WHERE role='user')"),
        orders: await n("SELECT COUNT(*) n FROM orders WHERE userId IN (SELECT id FROM users WHERE role='user')"),
        carts: await n("SELECT COUNT(*) n FROM carts WHERE userId IN (SELECT id FROM users WHERE role='user')"),
        wishlist: await n("SELECT COUNT(*) n FROM wishlist WHERE userId IN (SELECT id FROM users WHERE role='user')"),
        reviews: await n("SELECT COUNT(*) n FROM reviews WHERE userId IN (SELECT id FROM users WHERE role='user')"),
        notifications: await n("SELECT COUNT(*) n FROM notifications WHERE userId IN (SELECT id FROM users WHERE role='user')"),
        couponUsage: await n("SELECT COUNT(*) n FROM coupon_users WHERE userId IN (SELECT id FROM users WHERE role='user')")
      };
    case 'notifications':
      return { notifications: await n('SELECT COUNT(*) n FROM notifications') };
    case 'payment-verifications': {
      const rows = await all(env.DB.prepare('SELECT receiptKey, receiptUrl FROM payment_verifications'));
      return {
        paymentVerifications: rows.length,
        receiptFiles: [...new Set(rows.flatMap((r) => [keyOf(r.receiptKey), keyOf(r.receiptUrl)]).filter(Boolean))].length,
        ordersToReset: await n("SELECT COUNT(*) n FROM orders WHERE paymentStatus='awaiting-verification' OR paymentProof IS NOT NULL")
      };
    }
    case 'inventory':
      return { products: await n('SELECT COUNT(*) n FROM products'), stockMovements: await n('SELECT COUNT(*) n FROM stock_movements'), totalStock: Number((await env.DB.prepare('SELECT COALESCE(SUM(stock),0) s FROM products').first())?.s || 0) };
    default:
      return {};
  }
}

/* ------------------------------------------------------------------ */
/* تنفيذ عمليات الإعادة — كل دالة ترجع عدادات الحذف الفعلي              */
/* ------------------------------------------------------------------ */
/**
 * حذف بكميات مجزّأة (chunked) من جدول عبر قائمة معرّفات.
 *
 * إصلاح جذري لخطأ حقيقي: D1 يحدّ عدد المعاملات المرتبطة في الجملة
 * الواحدة بـ 100، فكان أي IN (...) بأكثر من 100 معرّف (مثلاً 128 عميلاً
 * أو مئات الطلبات) يفشل بالكامل بـ "D1_ERROR: too many SQL variables"
 * ويكسر إعادة الضبط الفردية والشاملة بعد منتصف التنفيذ.
 * الآن كل كتلة ≤ 50 معرّفاً — نفس السلوك والنتيجة بلا أي حد عملي.
 */
const CHUNK = 50;
async function deleteInChunks(env, table, column, ids) {
  if (!ids || !ids.length) return 0;
  let total = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = ids.slice(i, i + CHUNK);
    const ph = part.map(() => '?').join(',');
    const res = await run(env.DB.prepare(`DELETE FROM ${table} WHERE ${column} IN (${ph})`).bind(...part));
    total += res.meta?.changes || 0;
  }
  return total;
}
/** تحديث بكميات مجزّأة (نفس سبب الحذف أعلاه) */
async function updateInChunks(env, table, column, setSql, ids, extra = []) {
  if (!ids || !ids.length) return 0;
  let total = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = ids.slice(i, i + CHUNK);
    const ph = part.map(() => '?').join(',');
    const res = await run(env.DB.prepare(`UPDATE ${table} SET ${setSql} WHERE ${column} IN (${ph})`).bind(...extra, ...part));
    total += res.meta?.changes || 0;
  }
  return total;
}

async function resetOrders(env, c) {
  const orderIds = (await all(env.DB.prepare('SELECT id FROM orders'))).map((r) => r.id);
  const receiptKeys = [
    ...(await all(env.DB.prepare('SELECT receiptKey, receiptUrl FROM payment_verifications'))).flatMap((r) => [r.receiptKey, r.receiptUrl]),
    ...(await all(env.DB.prepare('SELECT paymentProof FROM orders WHERE paymentProof IS NOT NULL'))).map((r) => r.paymentProof)
  ];
  let out = { orders: orderIds.length, orderItems: 0, paymentVerifications: 0, returnRequests: 0, notifications: 0, couponUsage: 0, stockMovements: 0 };
  // روابط لا تتطلب قائمة معرّفات (تنظيف حتى لو كانت الطلبات فارغة فعلاً)
  out.notifications = (await run(env.DB.prepare("DELETE FROM notifications WHERE refModel='Order'"))).meta?.changes || 0;
  out.stockMovements = (await run(env.DB.prepare("DELETE FROM stock_movements WHERE referenceType='order'"))).meta?.changes || 0;
  if (orderIds.length) {
    out.returnRequests = await deleteInChunks(env, 'return_requests', 'orderId', orderIds);
    out.paymentVerifications = await deleteInChunks(env, 'payment_verifications', 'orderId', orderIds);
    out.orderItems = await deleteInChunks(env, 'order_items', 'orderId', orderIds);
    out.couponUsage = await deleteInChunks(env, 'coupon_users', 'orderId', orderIds);
    await deleteInChunks(env, 'orders', 'id', orderIds);
  }
  const r2 = await deleteR2KeysSafe(env, receiptKeys);
  out.receiptFilesDeleted = r2.deleted;
  out.receiptFilesKept = r2.kept;
  return out;
}

async function resetProducts(env, c) {
  const rows = await all(env.DB.prepare('SELECT id, mainImage, images, variants FROM products'));
  const keys = rows.flatMap((p) => [p.mainImage, ...parseJson(p.images, [])]);
  const ids = rows.map((r) => r.id);
  let out = { products: ids.length, variants: 0, reviews: 0, wishlist: 0, productViews: 0, stockMovements: 0, mediaRows: 0 };
  out.variants = rows.reduce((s, p) => s + parseJson(p.variants, []).length, 0);
  if (ids.length) {
    out.reviews = await deleteInChunks(env, 'reviews', 'productId', ids);
    out.wishlist = await deleteInChunks(env, 'wishlist', 'productId', ids);
    out.productViews = await deleteInChunks(env, 'product_views', 'productId', ids);
    out.stockMovements = await deleteInChunks(env, 'stock_movements', 'productId', ids);
    await deleteInChunks(env, 'products', 'id', ids);
  }
  out.mediaRows = await deleteMediaRowsForKeys(env, keys);
  const r2 = await deleteR2KeysSafe(env, keys);
  out.r2FilesDeleted = r2.deleted;
  out.r2FilesKept = r2.kept;
  return out;
}

async function resetCategories(env) {
  const rows = await all(env.DB.prepare('SELECT id, image FROM categories'));
  const keys = rows.map((r) => r.image);
  const res = await run(env.DB.prepare('DELETE FROM categories'));
  const mediaRows = await deleteMediaRowsForKeys(env, keys);
  const r2 = await deleteR2KeysSafe(env, keys);
  return { categories: res.meta?.changes || 0, mediaRows, r2FilesDeleted: r2.deleted, r2FilesKept: r2.kept };
}

async function resetBrands(env) {
  const rows = await all(env.DB.prepare('SELECT id, logo FROM brands'));
  const keys = rows.map((r) => r.logo);
  const res = await run(env.DB.prepare('DELETE FROM brands'));
  const mediaRows = await deleteMediaRowsForKeys(env, keys);
  const r2 = await deleteR2KeysSafe(env, keys);
  return { brands: res.meta?.changes || 0, mediaRows, r2FilesDeleted: r2.deleted, r2FilesKept: r2.kept };
}

async function resetReviews(env) {
  const res = await run(env.DB.prepare('DELETE FROM reviews'));
  const upd = await run(env.DB.prepare('UPDATE products SET rating=0, reviewsCount=0, updatedAt=?').bind(nowIso()));
  return { reviews: res.meta?.changes || 0, productsRecalculated: upd.meta?.changes || 0 };
}

async function resetReturns(env) {
  const rows = await all(env.DB.prepare('SELECT images FROM return_requests'));
  const keys = rows.flatMap((r) => parseJson(r.images, []));
  const res = await run(env.DB.prepare('DELETE FROM return_requests'));
  const r2 = await deleteR2KeysSafe(env, keys);
  return { returns: res.meta?.changes || 0, r2FilesDeleted: r2.deleted, r2FilesKept: r2.kept };
}

async function resetCoupons(env) {
  const ids = (await all(env.DB.prepare('SELECT id FROM coupons'))).map((r) => r.id);
  let out = { coupons: ids.length, couponUsage: 0, ordersDetached: 0, cartsCleared: 0 };
  if (ids.length) {
    out.couponUsage = await deleteInChunks(env, 'coupon_users', 'couponId', ids);
    out.ordersDetached = await updateInChunks(env, 'orders', 'couponId', 'couponId=NULL', ids);
    await deleteInChunks(env, 'coupons', 'id', ids);
    // سلال محفوظة تشير لكوبون محذوف
    const carts = await all(env.DB.prepare('SELECT id, coupon FROM carts WHERE coupon IS NOT NULL'));
    for (const cart of carts) {
      try {
        const cp = parseJson(cart.coupon, null);
        if (cp && ids.includes(cp.id || cp._id)) {
          await run(env.DB.prepare('UPDATE carts SET coupon=NULL WHERE id=?').bind(cart.id));
          out.cartsCleared++;
        }
      } catch { /* coupon JSON تالف — نتركه */ }
    }
  }
  return out;
}

async function resetCustomers(env) {
  const ids = (await all(env.DB.prepare("SELECT id FROM users WHERE role='user'"))).map((r) => r.id);
  let out = { customers: ids.length, addresses: 0, carts: 0, wishlist: 0, couponUsage: 0, notifications: 0, paymentVerificationsDetached: 0 };
  if (ids.length) {
    out.addresses = await deleteInChunks(env, 'addresses', 'userId', ids);
    out.carts = await deleteInChunks(env, 'carts', 'userId', ids);
    out.wishlist = await deleteInChunks(env, 'wishlist', 'userId', ids);
    out.couponUsage = await deleteInChunks(env, 'coupon_users', 'userId', ids);
    out.notifications = await deleteInChunks(env, 'notifications', 'userId', ids);
    out.paymentVerificationsDetached = await updateInChunks(env, 'payment_verifications', 'userId', 'userId=NULL', ids);
    /* حذف مستخدمين فقط (دور user) — مع الحفاظ على معاملات مجزّأة */
    for (let i = 0; i < ids.length; i += CHUNK) {
      const part = ids.slice(i, i + CHUNK);
      const ph = part.map(() => '?').join(',');
      await run(env.DB.prepare(`DELETE FROM users WHERE id IN (${ph}) AND role='user'`).bind(...part));
    }
  }
  return out;
}

async function resetNotifications(env) {
  const res = await run(env.DB.prepare('DELETE FROM notifications'));
  return { notifications: res.meta?.changes || 0 };
}

async function resetPaymentVerifications(env) {
  const rows = await all(env.DB.prepare('SELECT id, orderId, receiptKey, receiptUrl FROM payment_verifications'));
  const keys = rows.flatMap((r) => [r.receiptKey, r.receiptUrl]);
  const res = await run(env.DB.prepare('DELETE FROM payment_verifications'));
  const upd = await run(env.DB.prepare(
    "UPDATE orders SET paymentProof=NULL, paymentReference=NULL, paymentVerification='{\"state\":\"none\",\"history\":[]}', paymentStatus=CASE WHEN paymentStatus='awaiting-verification' THEN 'pending' ELSE paymentStatus END, updatedAt=?"
  ).bind(nowIso()));
  const r2 = await deleteR2KeysSafe(env, keys);
  return { paymentVerifications: res.meta?.changes || 0, ordersReset: upd.meta?.changes || 0, r2FilesDeleted: r2.deleted, r2FilesKept: r2.kept };
}

async function resetInventory(env) {
  const mov = await run(env.DB.prepare('DELETE FROM stock_movements'));
  const upd = await run(env.DB.prepare('UPDATE products SET stock=0, updatedAt=?').bind(nowIso()));
  return { stockMovements: mov.meta?.changes || 0, productsZeroed: upd.meta?.changes || 0 };
}

/* إعادة الضبط الشامل: تسلسل آمن من التابع إلى الأصل */
const FULL_SEQUENCE = [
  ['payment-verifications', resetPaymentVerifications],
  ['returns', resetReturns],
  ['orders', resetOrders],
  ['reviews', resetReviews],
  ['products', resetProducts],
  ['coupons', resetCoupons],
  ['customers', resetCustomers],
  ['notifications', resetNotifications],
  ['categories', resetCategories],
  ['brands', resetBrands],
  ['inventory', resetInventory]
];

const RUNNERS = {
  orders: resetOrders,
  products: resetProducts,
  categories: resetCategories,
  brands: resetBrands,
  reviews: resetReviews,
  returns: resetReturns,
  coupons: resetCoupons,
  customers: resetCustomers,
  notifications: resetNotifications,
  'payment-verifications': resetPaymentVerifications,
  inventory: resetInventory
};

/* ------------------------------------------------------------------ */
/* المسارات                                                           */
/* ------------------------------------------------------------------ */

/** معاينة عدادات — بلا أي حذف */
app.get('/system/reset/preview', async (c) => {
  const user = c.get('user');
  if (!isSuperAdmin(user, c.env)) return c.json({ status: 'error', message: 'إعادة ضبط البيانات متاحة للمدير الأعلى فقط.' }, 403);
  const groups = {};
  for (const g of Object.keys(RESET_PHRASES)) groups[g] = await countsOf(c.env, g);
  return ok(c, { counts: groups, phrases: RESET_PHRASES, protectedTables: [
    'users (admin accounts)', 'settings', 'payment_methods', 'shipping_zones', 'shipping_companies', 'governorates',
    'return_reasons', 'theme_presets', 'banners', 'pages', 'home_sections', 'popups', 'flash_sales',
    'testimonials', 'instagram_posts', 'email_templates', 'audit_logs', 'error_logs', 'jobs', 'sessions', 'schema/migrations'
  ] });
});

/** إعادة ضبط فردية — POST فقط، حماية كاملة */
for (const [group, runner] of Object.entries(RUNNERS)) {
  app.post(`/system/reset/${group}`, async (c) => {
    const guard = await requireResetAuth(c, group);
    if (guard) return guard;
    try {
      const counts = await runner(c.env, c);
      const isEmpty = Object.values(counts).every((v) => typeof v !== 'number' || v === 0);
      await auditLog(c.env, c, {
        action: `store_reset_${group}`,
        entity: 'system',
        label: group,
        message: 'إعادة ضبط بيانات',
        changes: counts
      });
      return ok(c, { group, deleted: counts }, isEmpty ? 'لا توجد بيانات لحذفها' : 'تم حذف البيانات بنجاح');
    } catch (e) {
      await auditLog(c.env, c, { action: `store_reset_${group}_failed`, entity: 'system', label: group, message: String(e?.message || e).slice(0, 300), success: false });
      throw e;
    }
  });
}

/** إعادة الضبط الشامل */
app.post('/system/reset/store-reset', async (c) => {
  const guard = await requireResetAuth(c, 'store-reset');
  if (guard) return guard;
  try {
    const deleted = {};
    for (const [g, fn] of FULL_SEQUENCE) deleted[g] = await fn(c.env, c);
    // سلات ومفضلة ومشاهدات متبقية (بيانات متجر انتقالية)
    deleted.carts = (await run(c.env.DB.prepare('DELETE FROM carts'))).meta?.changes || 0;
    deleted.wishlist = (await run(c.env.DB.prepare('DELETE FROM wishlist'))).meta?.changes || 0;
    deleted.productViews = (await run(c.env.DB.prepare('DELETE FROM product_views'))).meta?.changes || 0;
    const isEmpty = Object.values(deleted).every((v) => {
      if (typeof v === 'number') return v === 0;
      if (v && typeof v === 'object') return Object.values(v).every((x) => typeof x !== 'number' || x === 0);
      return true;
    });
    await auditLog(c.env, c, {
      action: 'store_reset_full',
      entity: 'system',
      label: 'store-reset',
      message: 'إعادة ضبط شاملة لبيانات المتجر',
      changes: deleted
    });
    return ok(c, { group: 'store-reset', deleted }, isEmpty ? 'لا توجد بيانات لحذفها' : 'تم حذف البيانات بنجاح');
  } catch (e) {
    await auditLog(c.env, c, { action: 'store_reset_full_failed', entity: 'system', label: 'store-reset', message: String(e?.message || e).slice(0, 300), success: false });
    throw e;
  }
});

export default app;
