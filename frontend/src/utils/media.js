import { API_BASE } from '@/api/client';

/**
 * يحوّل مسار وسائط مخزَّن في قاعدة البيانات إلى رابط قابل للعرض.
 *
 * نخزّن المسارات نسبية (/uploads/...) حتى لا تنكسر الصور عند تغيير
 * اسم النطاق أو النقل بين بيئات التطوير والإنتاج. عند تشغيل الواجهة
 * على نطاق مختلف عن الـ API نضيف أصل الـ API تلقائياً.
 */
const apiOrigin = () => {
  try {
    // VITE_API_URL قد يكون مطلقاً (https://api.site.com/api/v1) أو نسبياً (/api/v1)
    if (/^https?:\/\//i.test(API_BASE)) return new URL(API_BASE).origin;
  } catch {
    /* تجاهل ونستخدم نفس الأصل */
  }
  return '';
};

export const mediaUrl = (path) => {
  if (!path) return '';
  const value = String(path);
  // روابط خارجية أو data URI تُترك كما هي
  if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) return value;
  if (value.startsWith('/uploads/')) return `${apiOrigin()}${value}`;
  return value;
};

/** يحوّل رابطاً كاملاً إلى مسار نسبي قبل الحفظ في قاعدة البيانات */
export const toStoredPath = (url) => {
  if (!url) return '';
  const idx = String(url).indexOf('/uploads/');
  return idx > -1 ? String(url).slice(idx) : String(url);
};
