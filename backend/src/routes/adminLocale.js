import { Hono } from 'hono';
import { ok } from '../lib/response.js';
import { admin, adminOrModerator } from '../middleware/auth.js';
import { getSettings, updateSettings } from '../services/settings.js';

/**
 * مركز التعريب — واجهة locale + التجاوزات.
 * المصدر الوحيد للحقيقة: settings.locale و settings.translationOverrides (D1)
 * — لا يوجد أي تخزين ترجمات ثانٍ. المحرران (مركز التعريب + الإعدادات ← النصوص)
 * يقرآن ويكتبان المخزن نفسه.
 */

/** بيانات عرض ثابتة للغات المدعومة — عرضية فقط ولا تُخزَّن */
const LANG_META = {
  ar: { name: 'العربية', nameEn: 'Arabic', dir: 'rtl' },
  en: { name: 'الإنجليزية', nameEn: 'English', dir: 'ltr' },
};

const TIMEZONES = [
  'Africa/Cairo', 'Africa/Casablanca', 'Africa/Tunis', 'Africa/Algiers',
  'Asia/Riyadh', 'Asia/Dubai', 'Asia/Amman', 'Europe/London', 'Europe/Paris', 'America/New_York',
];

/** تنسيق تاريخ بسيط حسب النمط (dd/MM/yyyy | MM/dd/yyyy | yyyy-MM-dd | dd MMM yyyy) */
const formatDateExample = (pattern, d = new Date()) => {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  const MMM = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  switch (pattern) {
    case 'MM/dd/yyyy': return `${mm}/${dd}/${yyyy}`;
    case 'yyyy-MM-dd': return `${yyyy}-${mm}-${dd}`;
    case 'dd MMM yyyy': return `${dd} ${MMM} ${yyyy}`;
    default: return `${dd}/${mm}/${yyyy}`;
  }
};

/** شكل موحّد يعيده GET/PUT — نفس العقد الذي تستهلكه الواجهة تماماً */
const localeShape = (s) => {
  const locale = s.locale || {};
  const codes = Array.isArray(locale.languages) ? locale.languages : ['ar', 'en'];
  const languages = codes.map((code) => (LANG_META[code] ? { code, ...LANG_META[code] } : null)).filter(Boolean);
  const currency = {
    code: s.payment?.currency || 'EGP',
    symbol: s.payment?.currencySymbol || '',
    symbolEn: s.payment?.currencySymbolEn || '',
    position: s.payment?.currencyPosition || 'after',
  };
  const timezone = locale.timezone || 'Africa/Cairo';
  const timezones = TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES];
  const nd = Math.min(4, Math.max(0, Number(locale.numberDecimals) || 0));
  const sample = 1234.5;
  const numFmt = new Intl.NumberFormat('en', { minimumFractionDigits: nd, maximumFractionDigits: nd });
  const number = numFmt.format(sample);
  const now = new Date();
  const preview = {
    number,
    currency: currency.position === 'before' ? `${currency.symbol} ${number}` : `${number} ${currency.symbol}`,
    date: formatDateExample(locale.dateFormat || 'dd/MM/yyyy', now),
    time: new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(now),
  };
  const dateFormats = ['dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd', 'dd MMM yyyy'].map((value) => ({ value, example: formatDateExample(value, now) }));
  return { locale, currency, languages, timezones, dateFormats, preview };
};

const translationsShape = (overrides) => {
  const ov = overrides || {};
  return {
    overrides: ov,
    counts: { ar: Object.keys(ov.ar || {}).length, en: Object.keys(ov.en || {}).length },
  };
};

const app = new Hono();

app.get('/locale', adminOrModerator, async c => ok(c, localeShape(await getSettings(c.env))));

app.put('/locale', admin, async c => {
  const b = await c.req.json().catch(() => ({}));
  const payload = {};
  if (b.locale && typeof b.locale === 'object') payload.locale = b.locale;
  /* العملة تُحفظ في إعدادات الدفع (مصدرها الوحيد) — لا مخزن ثانٍ */
  if (b.currency && typeof b.currency === 'object') {
    const cur = b.currency;
    const payment = {};
    if (typeof cur.code === 'string' && cur.code.trim()) payment.currency = cur.code.trim().toUpperCase();
    if (typeof cur.symbol === 'string') payment.currencySymbol = cur.symbol;
    if (typeof cur.symbolEn === 'string') payment.currencySymbolEn = cur.symbolEn;
    if (['before', 'after'].includes(cur.position)) payment.currencyPosition = cur.position;
    if (Object.keys(payment).length) payload.payment = payment;
  }
  const s = await updateSettings(c.env, payload);
  return ok(c, localeShape(s));
});

app.get('/locale/translations', adminOrModerator, async c =>
  ok(c, translationsShape((await getSettings(c.env)).translationOverrides)));

app.put('/locale/translations', admin, async c => {
  const body = await c.req.json().catch(() => ({}));
  /* تقبُّل الشكلين: {overrides:{...}} من لوحة التعريب، أو الخريطة مباشرة */
  const raw = body && typeof body.overrides === 'object' && body.overrides !== null ? body.overrides : body;
  const clean = {};
  for (const [lng, pack] of Object.entries(raw || {})) {
    if (!pack || typeof pack !== 'object' || Array.isArray(pack)) continue;
    clean[lng] = {};
    for (const [k, v] of Object.entries(pack)) {
      const key = String(k).replaceAll('__', '.').trim();
      if (!key || key.length > 120) continue;
      clean[lng][key] = typeof v === 'string' ? v : String(v ?? '');
    }
  }
  const overrides = (await updateSettings(c.env, { translationOverrides: clean })).translationOverrides;
  return ok(c, translationsShape(overrides));
});

app.post('/locale/translations/reset', admin, async c => {
  /* إعادة التعيين = حذف صف الإعداد فيرجع الافتراضي من DEFAULT_SETTINGS.
     (إرسال {} عبر updateSettings كان لا يمسح شيئاً بسبب الدمج العميق) */
  await c.env.DB.prepare("DELETE FROM settings WHERE key='translationOverrides'").run();
  const overrides = (await getSettings(c.env)).translationOverrides || {};
  return ok(c, translationsShape(overrides));
});

export default app;
