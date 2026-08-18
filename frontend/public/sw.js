/* eslint-disable no-restricted-globals */
/**
 * Service Worker — Al Zeina
 *
 * استراتيجيات مقصودة:
 *   • الملفات الثابتة (JS/CSS/خطوط/صور) → cache-first: أسرع تحميل ممكن.
 *   • التنقّل بين الصفحات (SPA)         → network-first ثم offline.html.
 *   • طلبات الـ API                     → لا تُخزَّن إطلاقاً.
 *
 * ⚠️ قاعدة حرجة: لا نخزّن أبداً أي استجابة من /api/.
 * تخزين بيانات السلة أو الطلبات أو الجلسة يعني تسريب بيانات مستخدم
 * لمستخدم آخر على نفس الجهاز، وعرض أسعار/مخزون قديمة.
 */

const VERSION = 'v4.0.0';
const STATIC_CACHE = `alzeina-static-${VERSION}`;
const RUNTIME_CACHE = `alzeina-runtime-${VERSION}`;
const OFFLINE_URL = '/offline.html';

/** أقل ما يلزم لعرض صفحة عدم الاتصال */
const PRECACHE = [OFFLINE_URL, '/favicon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      // addAll تفشل كلياً لو فشل مورد واحد — نضيف كلاً على حدة
      .then((cache) => Promise.all(PRECACHE.map((u) => cache.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('alzeina-') && k !== STATIC_CACHE && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

/** هل هذا طلب API؟ لا يُخزَّن أبداً */
const isApi = (url) => url.pathname.startsWith('/api/');

/** ملفات قابلة للتخزين طويل الأمد */
const isStaticAsset = (url) =>
  /\.(js|css|woff2?|ttf|otf|eot|svg|png|jpe?g|gif|webp|avif|ico)$/i.test(url.pathname) ||
  url.pathname.startsWith('/assets/');

/** صور المنتجات المرفوعة — نخزّنها بحذر مع حد أقصى */
const isUpload = (url) => url.pathname.startsWith('/uploads/');

const MAX_RUNTIME_ENTRIES = 120;

/** يقصّ الكاش حتى لا يتضخّم بلا حدود */
const trimCache = async (name, max) => {
  try {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    if (keys.length <= max) return;
    // نحذف الأقدم (ترتيب الإدراج)
    await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
  } catch { /* تجاهل */ }
};

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // GET فقط — لا نتدخّل في POST/PUT/DELETE إطلاقاً
  if (request.method !== 'GET') return;

  let url;
  try { url = new URL(request.url); } catch { return; }

  // نتجاهل النطاقات الخارجية والامتدادات
  if (url.origin !== self.location.origin) return;

  // 🔒 لا تخزين لأي شيء من الـ API
  if (isApi(url)) return;

  /* 1) التنقّل بين الصفحات: الشبكة أولاً ثم صفحة عدم الاتصال */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // نحتفظ بنسخة من الغلاف لعرضها لاحقاً عند الانقطاع
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          return offline || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        })
    );
    return;
  }

  /* 2) الملفات الثابتة: الكاش أولاً */
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request)
            .then((res) => {
              if (res && res.ok && res.status === 200) {
                const copy = res.clone();
                caches.open(STATIC_CACHE).then((c) => c.put(request, copy)).catch(() => {});
              }
              return res;
            })
            .catch(() => cached)
      )
    );
    return;
  }

  /* 3) صور المرفوعات: الكاش أولاً مع تحديث في الخلفية وحد أقصى */
  if (isUpload(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(RUNTIME_CACHE).then(async (c) => {
                await c.put(request, copy);
                trimCache(RUNTIME_CACHE, MAX_RUNTIME_ENTRIES);
              }).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});

/** يسمح للتطبيق بطلب التفعيل الفوري بعد التحديث */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING' || event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CLEAR_CACHES') {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
  }
});
