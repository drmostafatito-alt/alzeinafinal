import axios from 'axios';
import { STORAGE_KEYS } from '@/utils/constants';
import { readStorage, removeStorage } from '@/utils/helpers';
import { useCountryStore, DEFAULT_COUNTRY } from '@/store/countryStore';

/**
 * عنوان الـ API الأساسي.
 *
 * - الإنتاج (Cloudflare Pages): يُبنى تلقائياً على عنوان الـ Worker المطلق.
 *   طلب نسبي مثل /api/v1 كان يُحل على نطاق Pages (al-zeina-store.pages.dev)
 *   فيفشل بـ 405 بدلاً من الوصول للـ Worker. يمكن تجاوز العنوان بـ
 *   VITE_API_URL فقط إذا كان مطلقاً (https://…) — عناوين نسبية في الإنتاج
 *   تُتجاهل عمداً حتى لا تعود المشكلة.
 * - التطوير المحلي: يبقى عبر البروكسي كما هو (/api/v1 → VITE_PROXY_TARGET
 *   في vite.config.js)، ما لم يُضبط VITE_API_URL صراحةً.
 */
const PROD_API_BASE = 'https://al-zeina-api.michiamo-tito.workers.dev/api/v1';
export const API_BASE = import.meta.env.PROD
  ? (/^https?:\/\//i.test(String(import.meta.env.VITE_API_URL || ''))
      ? String(import.meta.env.VITE_API_URL).replace(/\/+$/, '')
      : PROD_API_BASE)
  : (import.meta.env.VITE_API_URL || '/api/v1');

const client = axios.create({
  baseURL: API_BASE,
  timeout: 12000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * المسارات التي يحكمها سياق الدولة (Phase D): الكتالوج، واجهة المتجر،
 * السلة، الطلبات، والكوبونات. أي مسار آخر — auth/admin/users/uploads/
 * csrf — لا يرى X-Country إطلاقاً. الترويسة «اقتراح» والخادم authority.
 */
const COUNTRY_PATHS = /^\/(products|categories|storefront|cart|orders|coupons)(\/|\?|$)/;

const isCountryPath = (url = '') => {
  const path = String(url).replace(/^https?:\/\/[^/]+/i, '');
  const rel = path.startsWith(API_BASE) ? path.slice(API_BASE.length) : path;
  return COUNTRY_PATHS.test(rel);
};

/** لا تخرج أي قيمة غير نشطة عن الواجهة — المتجر غير الجاهز/التالف ⇒ EG */
const resolveCountryHeader = () => {
  try {
    const { country, activeCodes } = useCountryStore.getState();
    return activeCodes.includes(country) ? country : DEFAULT_COUNTRY;
  } catch {
    return DEFAULT_COUNTRY;
  }
};

/** يقرأ قيمة كوكي غير httpOnly */
const readCookie = (name) => {
  const match = document.cookie.match(new RegExp(`(^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[2]) : null;
};

/**
 * توكن CSRF محفوظ في الذاكرة لبقية الجلسة.
 * عند فصل النطاقات (الواجهة على Pages والـ API على Workers) لا يمكن قراءة
 * كوكي csrfToken عبر document.cookie لأن الكوكي يُضبط على نطاق الـ API فقط،
 * لذا نعتمد على التوكن الذي يرجع في جسم استجابة GET /csrf-token.
 */
let cachedCsrfToken = null;

const UNSAFE = ['post', 'put', 'patch', 'delete'];

client.interceptors.request.use(async (config) => {
  const token = readStorage(STORAGE_KEYS.token);
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // سياق الدولة للطلبات التي تعتمد عليه فقط (whitelist صارم)
  if (isCountryPath(config.url)) {
    config.headers['X-Country'] = resolveCountryHeader();
  }

  // الخادم يطبّق double-submit CSRF على الطلبات المغيّرة للحالة
  if (UNSAFE.includes(String(config.method).toLowerCase())) {
    let csrf = readCookie('csrfToken') || cachedCsrfToken;
    if (!csrf) {
      try {
        const res = await axios.get(`${API_BASE}/csrf-token`, { withCredentials: true });
        csrf = res?.data?.data?.csrfToken || readCookie('csrfToken');
        if (csrf) cachedCsrfToken = csrf;
      } catch {
        /* الخادم قد يكون معطّلاً للحماية — نكمل بدون رمز */
      }
    }
    if (csrf) config.headers['X-CSRF-Token'] = csrf;
  }
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    if (status === 401) {
      const url = error.config?.url || '';
      // لا نطرد المستخدم أثناء محاولات تسجيل الدخول نفسها
      if (!url.includes('/auth/login') && !url.includes('/auth/register')) {
        removeStorage(STORAGE_KEYS.token);
        removeStorage(STORAGE_KEYS.user);
      }
    }
    return Promise.reject(error);
  }
);

/** هل الخطأ يعني أن الـ backend غير متاح (وليس خطأ منطقي)؟ */
export const isNetworkError = (error) =>
  !error?.response ||
  error.code === 'ECONNABORTED' ||
  error.code === 'ERR_NETWORK' ||
  error.response?.status >= 500 ||
  error.response?.status === 404;

/**
 * يتحقق أن الاستجابة فعلاً JSON من الـ API وليست صفحة HTML.
 * مهم عند النشر على استضافة تعيد index.html لأي مسار غير معروف (SPA rewrite)،
 * وإلا سيظهر الموقع فارغاً بصمت بدل الرجوع للبيانات التجريبية.
 */
const isValidApiPayload = (res) => {
  const ct = String(res?.headers?.['content-type'] || '');
  if (ct && !ct.includes('json')) return false;
  const body = res?.data;
  if (typeof body === 'string') return false;
  return body !== null && typeof body === 'object';
};

export const apiErrorMessage = (error, fallback = 'حدث خطأ ما') =>
  error?.response?.data?.message ||
  error?.response?.data?.errors?.[0]?.msg ||
  error?.message ||
  fallback;

/**
 * وضع العرض التجريبي: مُعطَّل افتراضياً.
 * في الإنتاج يجب ألا يعرض المتجر بيانات وهمية أبداً — نفضّل رسالة خطأ صريحة
 * على منتجات غير حقيقية. يُفعَّل فقط بـ VITE_ENABLE_DEMO_DATA=true.
 */
export const DEMO_DATA_ENABLED = import.meta.env.VITE_ENABLE_DEMO_DATA === 'true';

/**
 * ينفّذ طلب API. عند تفعيل وضع العرض التجريبي فقط، يرجع بيانات تجريبية
 * إذا كان الخادم غير متاح.
 * @param {Function} request - دالة ترجع Promise من axios
 * @param {Function} mockFn - دالة ترجع البيانات التجريبية
 */
export async function withFallback(request, mockFn) {
  try {
    const res = await request();
    if (!isValidApiPayload(res)) {
      // استجابة ليست JSON (غالباً index.html) → نعاملها كأن السيرفر غير متاح
      throw Object.assign(new Error('Invalid API response'), { code: 'ERR_NETWORK' });
    }
    return { data: res.data?.data ?? res.data, isMock: false };
  } catch (error) {
    if (DEMO_DATA_ENABLED && isNetworkError(error) && typeof mockFn === 'function') {
      // eslint-disable-next-line no-console
      if (import.meta.env.DEV) console.info('[Al Zeina] Backend unavailable → using demo data');
      return { data: await mockFn(), isMock: true };
    }
    throw error;
  }
}

export default client;
