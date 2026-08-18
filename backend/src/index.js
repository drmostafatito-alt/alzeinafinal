import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCookie } from 'hono/cookie';
import auth from './routes/auth.js';
import { products, categories, brands, banners } from './routes/catalog.js';
import cart from './routes/cart.js';
import orders from './routes/orders.js';
import users from './routes/user.js';
import reviews from './routes/reviews.js';
import coupons from './routes/coupons.js';
import wishlist from './routes/wishlist.js';
import upload from './routes/upload.js';
import returns from './routes/returns.js';
import tickets from './routes/tickets.js';
import content from './routes/content.js';
import adminCore from './routes/adminCore.js';
import adminExtra from './routes/adminExtra.js';
import adminSupport from './routes/adminSupport.js';
import adminSystem from './routes/adminSystem.js';
import adminBranding from './routes/adminBranding.js';
import adminBanners from './routes/adminBanners.js';
import adminLocale from './routes/adminLocale.js';
import adminStaff from './routes/adminStaff.js';
import adminReset from './routes/adminReset.js';
import media from './routes/media.js';
import { loadUser, protect, admin, adminOrModerator } from './middleware/auth.js';
import { enforcePermissions } from './middleware/permissions.js';
import { randomToken } from './lib/crypto.js';
import { runScheduledJobs } from './cron.js';

const isProd = (env) => (env.ENVIRONMENT || 'development') === 'production';
const corsOrigin = (origin, c) => {
  const allowed = (c.env.CORS_ORIGINS || c.env.FRONTEND_URL || (isProd(c.env) ? '' : '*')).split(',').map(s => s.trim()).filter(Boolean);
  if (allowed.includes('*')) return origin || '*';
  if (origin && allowed.includes(origin)) return origin;
  return allowed[0] || origin || null;
};

const app = new Hono();
app.use('*', async (c, next) => cors({
  origin: (origin) => corsOrigin(origin, c),
  allowMethods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowHeaders: ['Content-Type','Authorization','X-Requested-With','X-CSRF-Token'],
  credentials: true,
  exposeHeaders: ['Content-Disposition']
})(c, next));
app.use('*', loadUser);
app.use('*', async (c, next) => {
  if (['POST','PUT','PATCH','DELETE'].includes(c.req.method)) {
    const authHeader = c.req.header('authorization') || c.req.header('Authorization');
    if (!authHeader) {
      const token = c.req.header('x-csrf-token');
      const cookie = getCookie(c, 'csrfToken');
      if (!cookie || token !== cookie) return c.json({ status:'error', message:'CSRF token missing or invalid. Call /api/v1/csrf-token first.' }, 403);
    }
  }
  await next();
});
app.get('/api/v1/csrf-token', (c) => {
  let token = getCookie(c, 'csrfToken');
  if (!token) {
    token = randomToken(18);
    c.header('Set-Cookie', `csrfToken=${token}; Path=/; Max-Age=604800; SameSite=Lax${isProd(c.env) ? '; Secure' : ''}`);
  }
  return c.json({ status:'success', data:{ csrfToken:token } });
});

/* Gate 1 (F3): استجابات JSON العامة المعتمدة على البلد تحمل Vary: X-Country + Cache-Control: no-store.
   بدون Vary كان أي كاش وسيط (Proxy/Cloudflare/متصفح توفيقي) يستطيع خلط محتوى بلدين على
   نفس الـURL — أحد التفسيرات المرشّحة لبلاغ «المتجر يفرغ بعد العودة لمصر» (تدقيق Gate 0/RC-2).
   النطاق = نفس مسارات سياق البلد المعتمدة (products/categories/storefront/cart/orders/coupons).
   لا يمس /uploads/* (وسائط R2 — سياسة أسبوعية معمول بها) ولا auth/admin ولا Service Worker. */
const COUNTRY_SCOPED_API = /^\/api\/v1\/(products|categories|storefront|cart|orders|coupons)(\/|$)/;
app.use('/api/v1/*', async (c, next) => {
  await next();
  if (!COUNTRY_SCOPED_API.test(c.req.path)) return;
  c.res.headers.set('Cache-Control', 'no-store');
  const vary = c.res.headers.get('Vary');
  if (!vary) c.res.headers.set('Vary', 'X-Country');
  else if (!/x-country/i.test(vary)) c.res.headers.set('Vary', `${vary}, X-Country`);
});
/* Multi-Country (المرحلة D) — وسيط البلد الوحيد countryMiddleware (src/services/country.js)
   مُركَّب داخل الموجّهات العامة المعتمدة على البلد حصراً: products/categories (catalog.js)،
   storefront/* (content.js)، cart (cart.js)، orders (routes/orders.js).
   تركيبه داخل الموجّهات — لا عالمياً هنا — مقصود: يمنع أي تسرّب إلى auth/admin/uploads/csrf
   ويبقى resolveCountry(c) المرجع الوحيد للحسم (X-Country ← ?country ← users.country ← الافتراضي). */
app.route('/api/v1/auth', auth);
app.route('/api/v1/products', products);
app.route('/api/v1/categories', categories);
app.route('/api/v1/brands', brands);
app.route('/api/v1/banners', banners);
app.route('/api/v1/cart', cart);
app.route('/api/v1/orders', orders);
app.route('/api/v1/users', users);
app.route('/api/v1/reviews', reviews);
app.route('/api/v1/coupons', coupons);
app.route('/api/v1/wishlist', wishlist);
app.route('/api/v1/upload', upload);
app.route('/api/v1/returns', returns);
app.route('/api/v1/tickets', tickets);
app.route('/api/v1', content);

app.use('/api/v1/admin/media/*', protect, adminOrModerator);
app.use('/api/v1/admin/*', protect, adminOrModerator, enforcePermissions);
app.route('/api/v1/admin/media', media);
app.route('/api/v1/admin', adminSystem);
app.route('/api/v1/admin/banners', adminBanners);
app.route('/api/v1/admin', adminReset);
app.route('/api/v1/admin', adminBranding);
app.route('/api/v1/admin', adminLocale);
app.route('/api/v1/admin', adminStaff);
app.route('/api/v1/admin', adminCore);
app.route('/api/v1/admin', adminExtra);
app.route('/api/v1/admin', adminSupport);

app.get('/uploads/*', async c => {
  const key = decodeURIComponent(c.req.path.replace(/^\/uploads\//, ''));
  if (!key || key.includes('..') || key.startsWith('/')) return c.json({status:'error',message:'not found'},404);
  const obj = await c.env.R2.get(key);
  if (!obj) return c.json({status:'error',message:'not found'},404);
  return new Response(obj.body, { headers: {
    'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
    'Cache-Control': 'public, max-age=604800',
    'X-Content-Type-Options': 'nosniff'
  }});
});
app.get('/', c => c.text('AL-ZEINA Cloudflare Worker API'));
app.onError((err, c) => {
  console.error(err);
  return c.json({ status:'error', message: err.message || 'Internal Server Error' }, err.status || 500);
});
app.notFound(c => c.json({status:'error',message:'Not found'},404));

export default {
  fetch: app.fetch,
  async scheduled(event, env, ctx) { ctx.waitUntil(runScheduledJobs(env)); }
};
