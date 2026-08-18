/**
 * تسجيل Service Worker وإدارة التثبيت.
 *
 * قواعد أمان مقصودة:
 *   • لا نسجّل في وضع التطوير — يعقّد إعادة التحميل السريع ويخفي التغييرات.
 *   • لا نسجّل داخل لوحة الإدارة — لا نريد تخزين أي شيء إداري.
 *   • أي فشل هنا صامت تماماً: PWA تحسين إضافي لا يجوز أن يكسر المتجر.
 */

let deferredPrompt = null;
const listeners = new Set();

const notify = () => listeners.forEach((fn) => { try { fn(Boolean(deferredPrompt)); } catch { /* noop */ } });

/** يشترك في تغيّر إمكانية التثبيت */
export const onInstallAvailable = (fn) => {
  listeners.add(fn);
  fn(Boolean(deferredPrompt));
  return () => listeners.delete(fn);
};

export const canInstall = () => Boolean(deferredPrompt);

/** هل التطبيق يعمل مثبَّتاً؟ */
export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true);

/** يعرض نافذة التثبيت — يجب أن تُستدعى من تفاعل مستخدم مباشر */
export const promptInstall = async () => {
  if (!deferredPrompt) return { outcome: 'unavailable' };
  const prompt = deferredPrompt;
  deferredPrompt = null;
  notify();
  try {
    prompt.prompt();
    const choice = await prompt.userChoice;
    return choice;
  } catch {
    return { outcome: 'error' };
  }
};

export const registerServiceWorker = () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  if (import.meta.env?.DEV) {
    /*
     * وضع التطوير: لا نسجّل عامل خدمة — والأهم أن نلغي أي عامل قديم
     * مسجَّل لنفس الأصل (من بناء إنتاج/معاينة سابق على نفس البورت).
     *
     * عامل الخدمة القديم كان يظل متحكماً بالصفحة حتى في التطوير ويخدم
     * ملفات JS/CSS قديمة من الكاش (cache-first)، فتظهر الصفحة بيضاء
     * أو بأخطاء وحدات بعد كل تحديث للكود — ولا يحلّها أي تعديل كود
     * ما دام العامل القديم مسجَّلاً.
     */
    navigator.serviceWorker
      .getRegistrations?.()
      .then((regs) => Promise.all((regs || []).map((r) => r.unregister())))
      .catch(() => {});
    return;
  }
  if (window.location.pathname.startsWith('/admin')) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        // عند توفّر نسخة جديدة نفعّلها مباشرة في التحميل التالي
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              sw.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(() => {
        // فشل التسجيل لا يعني شيئاً للمستخدم — المتجر يعمل بلا PWA
      });
  });

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
};

export default registerServiceWorker;
