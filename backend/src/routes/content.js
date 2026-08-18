import { Hono } from 'hono';
import { all, first, run } from '../lib/db.js';
import { ok, created, nowIso, uuid, parseJson } from '../lib/response.js';
import { getSettings, publicSettings, updateSettings } from '../services/settings.js';
import { verifyJwt } from '../lib/crypto.js';

const app = new Hono();

app.get('/settings', async c => ok(c, publicSettings(await getSettings(c.env))));

/** هل يحق للطلب رؤية المسودات؟ رمز أدمن صالح + ?preview=1 فقط. */
async function canPreview(c) {
  if (c.req.query('preview') !== '1') return false;
  const auth = c.req.header('authorization') || c.req.header('Authorization') || '';
  if (!auth.startsWith('Bearer')) return false;
  try {
    const secret = c.env.JWT_SECRET || 'dev-secret-change-me';
    const payload = await verifyJwt(auth.split(' ')[1], secret);
    if (!payload) return false;
    const u = await first(c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(payload.id));
    return Boolean(u && ['admin','moderator'].includes(u.role));
  } catch { return false; }
}

app.get('/storefront/config', async c => {
  const s = await getSettings(c.env);
  const preview = await canPreview(c);
  const rows = await all(c.env.DB.prepare('SELECT * FROM home_sections WHERE isActive=1 ORDER BY sortOrder ASC, createdAt ASC'));
  const sections = rows
    .map((row) => {
      const data = parseJson(row.data, {});
      return { ...data, ...row, _id: row.id, key: data.key || row.id, order: row.sortOrder };
    })
    .filter((sec) => preview || sec.status !== 'draft')
    .map(({ data, ...rest }) => rest);
  const popups = await all(c.env.DB.prepare('SELECT * FROM popups WHERE isActive=1 ORDER BY sortOrder ASC, createdAt DESC'));
  const popupRows = popups.map((row) => {
    const data = parseJson(row.data, {});
    const shaped = { ...data, ...row, _id: row.id };
    delete shaped.data;
    return shaped;
  });
  const flashSales = await all(c.env.DB.prepare('SELECT * FROM flash_sales WHERE isActive=1 ORDER BY createdAt DESC'));
  const flashRows = flashSales.map((row) => {
    const data = parseJson(row.data, {});
    const shaped = { ...data, ...row, _id: row.id, endDate: row.endsAt, startDate: row.startsAt, products: parseJson(row.products, []) };
    delete shaped.data;
    return shaped;
  });
  const data = {
    settings: publicSettings(s),
    config: {
      store: { name: s.siteName, nameAr: s.siteNameAr, logo: s.logo, currency: s.payment.currency, currencySymbol: s.payment.currencySymbol },
      features: s.features, flags: s.flags, locale: s.locale, branding: s.branding
    },
    paymentMethods: (await all(c.env.DB.prepare('SELECT * FROM payment_methods WHERE isActive=1 AND isVisible=1 ORDER BY sortOrder'))).map((m) => {
      /* تفكيك config JSON (أرقام الحسابات/المحافظ/QR/الأيقونة) إلى أعلى الكائن
         حتى تقرأها واجهة الدفع مباشرة — البيانات من D1 حصراً لا من الكود */
      const cfg = parseJson(m.config, {});
      return { ...m, ...cfg, _id: m.id, config: cfg };
    }),
    governorates: await all(c.env.DB.prepare('SELECT * FROM governorates WHERE isActive=1 ORDER BY sortOrder,name')),
    banners: await all(c.env.DB.prepare('SELECT * FROM banners WHERE isActive=1 ORDER BY sortOrder')),
    pages: await all(c.env.DB.prepare("SELECT id,title,titleEn,slug,showInFooter FROM pages WHERE isActive=1 AND status='published' ORDER BY sortOrder,title")),
    sections,
    popups: popupRows,
    flashSales: flashRows
  };
  return ok(c, data);
});
app.get('/storefront/payment-methods', async c => ok(c,{ paymentMethods:(await all(c.env.DB.prepare('SELECT * FROM payment_methods WHERE isActive=1 AND isVisible=1 ORDER BY sortOrder ASC'))).map(m=>{ const cfg=parseJson(m.config,{}); return {...m,...cfg,_id:m.id,config:cfg}; }) }));
app.get('/storefront/shipping/quote', async c => { const s=await getSettings(c.env); const code=c.req.query('governorateCode') || c.req.query('governorate') || c.req.query('governorateId'); const rows=await all(c.env.DB.prepare('SELECT * FROM governorates WHERE isActive=1 ORDER BY sortOrder,name')); const governorate=rows.find(g=>g.code===code || g.id===code);
  if (!governorate) return c.json({status:'error',message:'المحافظة غير متاحة'},400); const cost = governorate?.shippingCost ?? s.shipping.defaultCost; const threshold=s.shipping.freeShippingThreshold; const subtotal=Number(c.req.query('subtotal'))||0; return ok(c,{ cost: s.shipping.freeShippingEnabled && subtotal>=threshold ? 0 : cost, free: subtotal>=threshold, threshold, governorate, estimatedDays:{min:s.shipping.estimatedDaysMin,max:s.shipping.estimatedDaysMax} }); });
app.get('/storefront/governorates', async c => ok(c,{ governorates: await all(c.env.DB.prepare('SELECT * FROM governorates WHERE isActive=1 ORDER BY sortOrder,name')) }));
app.get('/storefront/pages', async c => ok(c,{ pages: await all(c.env.DB.prepare("SELECT id,title,titleEn,slug,status,showInFooter FROM pages WHERE isActive=1 AND status='published' ORDER BY sortOrder,title")) }));
app.get('/storefront/pages/:slug', async c => {
  const page = await first(c.env.DB.prepare('SELECT * FROM pages WHERE slug=? AND isActive=1').bind(c.req.param('slug')));
  if (!page) return ok(c, { page: null });
  const data = parseJson(page.data, {});
  return ok(c, { page: { ...page, sections: Array.isArray(data.sections) ? data.sections : [], faqs: Array.isArray(data.faqs) ? data.faqs : [] } });
});
app.get('/testimonials', async c => ok(c,{ testimonials: await all(c.env.DB.prepare('SELECT * FROM testimonials WHERE isActive=1 ORDER BY sortOrder,createdAt DESC')) }));
app.get('/instagram', async c => ok(c,{ posts: await all(c.env.DB.prepare('SELECT * FROM instagram_posts WHERE isActive=1 ORDER BY sortOrder,createdAt DESC')) }));
app.post('/contact', async c => { const b=await c.req.json(); const id=uuid(), now=nowIso(); await run(c.env.DB.prepare('INSERT INTO messages(id,name,email,phone,subject,message,createdAt) VALUES(?,?,?,?,?,?,?)').bind(id,b.name||'',b.email||'',b.phone||'',b.subject||'',b.message||'',now)); const s=await getSettings(c.env); if (s.support?.ticketsFromContact) { const tid=uuid(); await run(c.env.DB.prepare('INSERT INTO tickets(id,guestName,guestEmail,subject,category,priority,status,messages,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(tid,b.name||'',b.email||'',b.subject||b.message.slice(0,80),'general','normal','open',JSON.stringify([{from:'customer',message:b.message,at:now}]),now,now)); } return created(c,{message:'تم إرسال الرسالة'},'تم الإرسال'); });
app.post('/newsletter/subscribe', async c => { const b=await c.req.json(); if(!b.email) return c.json({status:'error',message:'البريد مطلوب'},400); await run(c.env.DB.prepare('INSERT OR IGNORE INTO subscribers(id,email,isActive,source,createdAt) VALUES(?,?,1,?,?)').bind(uuid(),String(b.email).toLowerCase(),'site',nowIso())); return created(c,{subscribed:true}); });
app.get('/manifest.webmanifest', async c => { const s=await getSettings(c.env); const b=s.branding||{}; return c.json({ name:b.pwaName||s.siteName||'Al Zeina', short_name:b.pwaShortName||s.siteNameAr||'AL-ZEINA', start_url:'/', display:'standalone', background_color:b.pwaBackgroundColor||'#ffffff', theme_color:b.pwaThemeColor||'#111111', icons:[{src:b.pwaIcon192||s.favicon||'/favicon.svg',sizes:'192x192',type:'image/svg+xml'},{src:b.pwaIcon512||b.pwaIcon192||s.favicon||'/favicon.svg',sizes:'512x512',type:'image/svg+xml'}] }); });
export default app;
