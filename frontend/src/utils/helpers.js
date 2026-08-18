export const cn = (...classes) => classes.filter(Boolean).join(' ');

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const getId = (obj) => obj?._id || obj?.id || '';

/** يرجع الاسم حسب اللغة الحالية مع fallback */
export const localized = (obj, lang, field = 'name') => {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  if (lang === 'en') return obj[`${field}En`] || obj[field] || '';
  return obj[field] || obj[`${field}En`] || '';
};

/**
 * اسم المتجر حسب اللغة — المنطق الموحّد الوحيد لعرض اسم المتجر في كل الواجهة.
 *
 * - العربية:   AR إن وُجد، ثم EN كـfallback، ثم الافتراضي الآمن 'المتجر'.
 * - الإنجليزية: EN إن وُجد، ثم AR كـfallback، ثم الافتراضي الآمن 'Store'.
 *
 * كان كل مكوّن (Logo/Footer/WhatsApp/عنوان المتصفح) يطبّق سلسلة fallback
 * مختلفة، وكان الشعار يعرض الاسم الإنجليزي دائماً مع 'STORE' صلبة —
 * فيظهر "Al Zeina" في المتجر العربي ويظهر "STORE" عند حذف الاسم الإنجليزي
 * رغم وجود الاسم العربي. هذا المصدر الوحيد للحقيقة الآن.
 */
export const localizedBrandName = (nameEn, nameAr, lang = 'ar') => {
  const en = String(nameEn || '').trim();
  const ar = String(nameAr || '').trim();
  if (lang === 'en') return en || ar || 'Store';
  return ar || en || 'المتجر';
};

export const readStorage = (key, fallback = null) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

export const writeStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota errors */
  }
};

export const removeStorage = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* noop */
  }
};

export const debounce = (fn, wait = 300) => {
  let t;
  const debounced = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
  debounced.cancel = () => clearTimeout(t);
  return debounced;
};

export const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

export const range = (n) => Array.from({ length: n }, (_, i) => i);

export const uid = () => Math.random().toString(36).slice(2, 10);

export const scrollTop = (behavior = 'smooth') => {
  try {
    window.scrollTo({ top: 0, behavior });
  } catch {
    window.scrollTo(0, 0);
  }
};

export const buildQuery = (params = {}) => {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '' || v === false) return;
    if (Array.isArray(v)) {
      if (v.length) sp.set(k, v.join(','));
    } else {
      sp.set(k, String(v));
    }
  });
  return sp.toString();
};

export const parseQuery = (search) => Object.fromEntries(new URLSearchParams(search).entries());

/** صورة بديلة لو الصورة الأصلية فشلت */
export const FALLBACK_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#F8E8EA"/><text x="50%" y="50%" font-family="sans-serif" font-size="20" fill="#C89A8B" text-anchor="middle" dy=".35em">Al Zeina</text></svg>`
  );

export const onImgError = (e) => {
  if (e.currentTarget.src !== FALLBACK_IMG) e.currentTarget.src = FALLBACK_IMG;
};
