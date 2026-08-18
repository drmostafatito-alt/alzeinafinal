/**
 * Multi-Country — Phase D: واحد مُحدِّد بلد موثوق لكل الطلبات.
 *
 * resolveCountry(c) هو المرجع الوحيد لتحديد البلد — ممنوع تكرار منطق التحديد
 * في أي مسار. الخادم وحده سلطة الحقيقة: لا يُصدَّق أي بلد قادم من العميل
 * إلا بعد مطابقته مع جدول countries في D1.
 *
 * الأولوية (كل مرشّح يُتحقق منه؛ غير الصالح/غير المفعّل يُتجاوز بأمان للمرشّح التالي):
 *   1) ترويسة X-Country
 *   2) معامل الاستعلام ?country=
 *   3) البلد المحفوظ للمستخدم المسجَّل (users.country)
 *   4) البلد الافتراضي المفعّل من D1 (حالياً مصر)
 *
 * النتيجة على سياق Hono:
 *   c.var.country     — الكود ('EG' | 'AE')
 *   c.var.countryRow  — الصف الكامل من جدول countries (العملة/الرموز/تجاوزات الشحن)
 */
import { first, all } from '../lib/db.js';
import { parseJson } from '../lib/response.js';

export const DEFAULT_COUNTRY_CODE = 'EG';

const validCodes = (rows) => rows.map((r) => String(r.code).toUpperCase());

/** كل الدول المفعّلة من D1 — جدول من صفّين، قراءة رخيصة لكل طلب. */
export async function listActiveCountries(env) {
  const rows = await all(env.DB.prepare('SELECT * FROM countries WHERE isActive=1 ORDER BY sortOrder ASC, code ASC'));
  return rows;
}

/**
 * يطابق كود بلد خام مرشّح ضد الدول المفعّلة. يرجع الصف أو null — بلا أخطاء إطلاقاً:
 * المدخل السيّئ لا يكسر المتجر، يُسقط المرشّح فقط فلا تتسرّب بيانات بلد آخر.
 */
function matchCountry(rows, raw) {
  if (raw === undefined || raw === null) return null;
  const code = String(raw).trim().toUpperCase();
  if (!/^[A-Z]{2,3}$/.test(code)) return null;
  return rows.find((r) => String(r.code).toUpperCase() === code) || null;
}

export async function resolveCountry(c) {
  const env = c.env;
  const rows = await listActiveCountries(env);

  // (1) الترويسة
  let row = matchCountry(rows, c.req.header('x-country') || c.req.header('X-Country'));
  // (2) معامل الاستعلام
  if (!row) row = matchCountry(rows, c.req.query('country'));
  // (3) البلد المحفوظ للمستخدم المسجَّل (loadUser وضع الصف الكامل في السياق)
  if (!row) {
    const saved = c.get('user')?.country;
    row = matchCountry(rows, saved);
  }
  // (4) افتراضي المتجر المفعّل، وإلا أول دولة مفعّلة (لا توقف للمتجر أبداً)
  if (!row) row = rows.find((r) => r.isDefault) || rows[0] || null;

  // الحالة المستحيلة عملياً (لا دول مفعّلة إطلاقاً): نبني صف مصر الاحتياطي
  // حتى تبقى القراءات آمنة، مع بقاء التخزين مرجع الحقيقة دائماً.
  if (!row) {
    row = {
      code: DEFAULT_COUNTRY_CODE, name: 'مصر', nameEn: 'Egypt',
      currency: 'EGP', currencySymbol: 'ج.م', currencySymbolEn: 'EGP',
      currencyPosition: 'after', shipping: '{}', isActive: 1, isDefault: 1, sortOrder: 1
    };
  }
  return { row, countries: rows };
}

/** وسيط البلد — يُركَّب فقط على موجّهات المتجر العامة المعتمدة على البلد. */
export async function countryMiddleware(c, next) {
  const { row, countries } = await resolveCountry(c);
  c.set('country', row.code);
  c.set('countryRow', row);
  c.set('countries', countries);
  await next();
}

/** يدمج إعدادات الشحن العامة مع تجاوزات البلد (أرقام صريحة لكل بلد — بلا تحويل عملات). */
export function shippingForCountry(baseShipping = {}, countryRow) {
  const overrides = parseJson(countryRow?.shipping, {});
  const merged = { ...baseShipping, ...overrides };
  // تطبيع الرقمية — صف JSON قد يحمل أرقاماً كنصوص من لوحة الإدارة
  for (const k of ['defaultCost', 'freeShippingThreshold', 'estimatedDaysMin', 'estimatedDaysMax']) {
    if (merged[k] !== undefined && merged[k] !== null && merged[k] !== '') merged[k] = Number(merged[k]);
  }
  if (merged.codEnabled !== undefined) merged.codEnabled = merged.codEnabled === true || merged.codEnabled === 1 ? true : false;
  if (merged.freeShippingEnabled !== undefined) merged.freeShippingEnabled = merged.freeShippingEnabled !== false;
  return merged;
}

/**
 * هل وسيلة الدفع متاحة في هذا البلد؟
 * النطاق محفوظ في payment_methods.config JSON تحت المفتاح "countries".
 * غياب المفتاح = متاحة في كل البلاد (السلوك التاريخي — توافق خلفي آمن).
 */
export function methodAvailableInCountry(method, countryCode) {
  if (!method) return false;
  const cfg = typeof method.config === 'string' ? parseJson(method.config, {}) : (method.config || {});
  const list = Array.isArray(cfg.countries) ? cfg.countries : null;
  if (!list || !list.length) return true;
  return list.map(String).map((s) => s.toUpperCase()).includes(String(countryCode).toUpperCase());
}

/** يرشّح قائمة وسائل الدفع حسب البلد. */
export function filterMethodsForCountry(methods, countryCode) {
  return (methods || []).filter((m) => methodAvailableInCountry(m, countryCode));
}
