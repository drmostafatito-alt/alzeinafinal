import { CURRENCY } from './constants';

/**
 * رمز العملة يأتي من إعدادات لوحة الإدارة.
 * ConfigProvider يحدّثه عند الإقلاع عبر setCurrency، والقيم أدناه احتياطية فقط.
 */
let currency = { ar: CURRENCY.symbol.ar, en: CURRENCY.symbol.en, position: 'auto' };

export const setCurrency = ({ symbol, symbolEn, position } = {}) => {
  if (symbol) currency.ar = symbol;
  if (symbolEn) currency.en = symbolEn;
  /* موضع الرمز من الدولة (Phase D: EG=after, AE=before). 'auto' = السلوك القديم */
  currency.position = position === 'before' || position === 'after' ? position : 'auto';
};

export const formatPrice = (value, lang = 'ar') => {
  const n = Number(value || 0);
  const num = new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
  /* الدولة إن قالت before (الإمارات): الرمز أولاً في اللغتين.
     وإلا نحفظ سلوك مصر القائم حرفياً: عربي بعد، إنجليزي قبل. */
  if (currency.position === 'before') {
    return lang === 'ar' ? `${currency.ar} ${num}` : `${currency.en} ${num}`;
  }
  return lang === 'ar' ? `${num} ${currency.ar}` : `${currency.en} ${num}`;
};

export const formatNumber = (value, lang = 'ar') =>
  new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-US').format(Number(value || 0));

export const formatDate = (date, lang = 'ar', withTime = false) => {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(d);
};

export const timeAgo = (date, lang = 'ar') => {
  /*
    تحصين إلزامي: تاريخ غير صالح (صيغة غير ISO من أنظمة قديمة/استيراد،
    صيغة SQLite 'YYYY-MM-DD HH:MM:SS' التي تفشل في Safari/WebKit، أو فراغ)
    كان يجعل Math.round(diff)=NaN ثم Intl.RelativeTimeFormat.format(NaN)
    يرمي RangeError: Value need to be finite number — فيسقط صفحة كاملة
    (مركز الإشعارات) داخل ErrorBoundary.
  */
  const d = new Date(date);
  const t = d.getTime();
  if (!Number.isFinite(t)) return '—';
  const diff = (t - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(lang === 'ar' ? 'ar-EG' : 'en', { numeric: 'auto' });
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ];
  for (const [unit, secs] of units) {
    if (Math.abs(diff) >= secs || unit === 'second') {
      return rtf.format(Math.round(diff / secs), unit);
    }
  }
  return '—';
};

export const discountPercent = (price, oldPrice) => {
  if (!oldPrice || oldPrice <= price) return 0;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
};

export const truncate = (str = '', n = 80) => (str.length > n ? `${str.slice(0, n)}…` : str);

export const slugify = (str = '') =>
  str
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-+/g, '-');
