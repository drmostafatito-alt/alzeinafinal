import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { first, all } from '../lib/db.js';
import { ok, parseJson, stringify, round2 } from '../lib/response.js';
import { couponDiscount, couponValid } from '../services/pricing.js';
import { optionalAuth } from '../middleware/auth.js';
import { countryMiddleware } from '../services/country.js';
import { productAvailableInCountry, unitPriceForCountry } from './catalog.js';

const CART_COOKIE = 'alzeina_cart';

function readCart(c) {
  try { return parseJson(getCookie(c, CART_COOKIE), { items: [], coupon:null }); } catch { return { items:[], coupon:null }; }
}
function writeCart(c, cart) { setCookie(c, CART_COOKIE, stringify(cart), { httpOnly:true, sameSite:'Lax', secure:c.env.ENVIRONMENT==='production', path:'/', maxAge:60*60*24*7 }); }
function totals(cart) {
  let subtotal=0,totalItems=0;
  for (const i of cart.items) { subtotal += (Number(i.price)||0)*Number(i.quantity||0); totalItems += Number(i.quantity)||0; }
  cart.subtotal = round2(subtotal); cart.totalItems = totalItems;
  cart.total = round2(Math.max(0, subtotal - Number(cart.coupon?.discount||0)));
  return cart;
}

const app = new Hono();
app.use('*', optionalAuth);
/* المرحلة D: البلد يُحسم خادمياً لكل قراءات/كتابات السلة — أسعار البلد هي المرجع */
app.use('*', countryMiddleware);
app.get('/', async c => {
  let cart = readCart(c);
  const country = c.get('country');
  const ids = cart.items.map(i=>i.productId);
  const products = ids.length ? await all(c.env.DB.prepare(`SELECT * FROM products WHERE id IN (${ids.map(()=>'?').join(',')}) AND isActive=1`).bind(...ids)) : [];
  /* أي منتج غير متاح في هذا البلد يُحذف من السلة؛ الأسعار تُعاد كتابتها من D1 دائماً
     — لا يبقى سعر مصري في سلة إماراتية ولا العكس. */
  cart.items = cart.items.map(i=>{ const p=products.find(x=>x.id===i.productId); if (!p || !productAvailableInCountry(p, country)) return null; const v=parseJson(p.variants,[]).find(v=>v.sku===i.variantSku || v.sku===i.variant); return { ...i, name: p.name, nameEn:p.nameEn, image:p.mainImage, price:unitPriceForCountry(p, v, country), oldPrice:String(country).toUpperCase()==='AE' ? (p.oldPriceAE ?? null) : p.oldPrice, discount:p.discount, inStock:p.stock>=i.quantity, stock:p.stock }; }).filter(Boolean);
  totals(cart); writeCart(c, cart); return ok(c,{ country, cart });
});
app.post('/add', async c => {
  const { productId, quantity=1, variant=null } = await c.req.json();
  const country = c.get('country');
  const p = await first(c.env.DB.prepare('SELECT * FROM products WHERE id=?').bind(productId));
  if (!p?.isActive || !productAvailableInCountry(p, country)) return c.json({status:'error',message:'المنتج غير موجود'},404);
  const variants=parseJson(p.variants,[]); const v=variant?variants.find(x=>x.sku===variant||x.name===variant):null; const price=unitPriceForCountry(p, v, country); const stock=v?.stock??p.stock; if (stock<quantity) return c.json({status:'error',message:'الكمية غير متوفرة'},400);
  const cart=readCart(c); const existing=cart.items.find(i=>i.productId===productId && i.variantSku===(v?.sku||null));
  if (existing) { if (stock<existing.quantity+quantity) return c.json({status:'error',message:'الكمية غير متوفرة'},400); existing.quantity+=quantity; } else cart.items.push({ productId, name:p.name, price, quantity, variant:v?.name||null, variantSku:v?.sku||null, image:p.mainImage, sku:v?.sku||p.sku });
  totals(cart); writeCart(c, cart); return ok(c,{ cart },'تمت إضافة المنتج إلى السلة');
});
app.put('/update', async c => { const { productId, quantity, variant=null }=await c.req.json(); const cart=readCart(c); const idx=cart.items.findIndex(i=>i.productId===productId && i.variantSku===(variant?.sku||variant)); if(idx<0) return c.json({status:'error',message:'المنتج غير موجود في السلة'},404); if(quantity<=0) cart.items.splice(idx,1); else cart.items[idx].quantity=quantity; totals(cart); writeCart(c,cart); return ok(c,{cart},'تم تحديث السلة'); });
app.delete('/remove/:productId', async c => { const variant=c.req.query('variant'); const cart=readCart(c); cart.items=cart.items.filter(i=>!(i.productId===c.req.param('productId') && String(i.variantSku||i.variant||'')===String(variant||''))); totals(cart); writeCart(c,cart); return ok(c,{cart},'تم حذف المنتج'); });
app.delete('/clear', async c => { const cart={items:[],coupon:null,subtotal:0,total:0,totalItems:0}; writeCart(c,cart); return ok(c,{cart},'تم تفريغ السلة'); });
app.post('/apply-coupon', async c => { const { code }=await c.req.json(); const coupon=await first(c.env.DB.prepare('SELECT * FROM coupons WHERE code=? AND isActive=1').bind(String(code||'').toUpperCase())); if(!coupon) return c.json({status:'error',message:'الكوبون غير موجود'},404); if (!(await couponValid(c.env, coupon, c.get('user')?.id))) return c.json({status:'error',message:'الكوبون غير صالح أو منتهي الصلاحية'},400); const cart=readCart(c); totals(cart); const discount=couponDiscount(coupon,cart.subtotal); if(discount<=0 && coupon.discountType!=='free-shipping') return c.json({status:'error',message:'الكوبون غير قابل للتطبيق'},400); cart.coupon={ _id:coupon.id, id:coupon.id, code:coupon.code, discount, discountType:coupon.discountType, discountValue:coupon.discountValue, maxDiscount:coupon.maxDiscount, freeShipping:coupon.freeShipping, minOrderAmount:coupon.minOrderAmount }; totals(cart); writeCart(c,cart); return ok(c,{cart},'تم تطبيق الكوبون'); });
app.delete('/remove-coupon', async c => { const cart=readCart(c); cart.coupon=null; totals(cart); writeCart(c,cart); return ok(c,{cart},'تم إزالة الكوبون'); });

export default app;
