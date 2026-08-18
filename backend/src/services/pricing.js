import { first, all } from '../lib/db.js';
import { parseJson, round2 } from '../lib/response.js';
import { shippingForCountry } from './country.js';

/**
 * حساب الشحن — المرحلة D: البلد يُمرَّر صراحة (country = الكود، countryRow = صف D1).
 * المحافظة/الإمارة تُطابَق داخل بلدها فقط، فلا تتسرب إمارة إماراتية إلى طلب مصري
 * ولا محافظة مصرية إلى طلب إماراتي. قواعد الشحن تأتي من إعدادات المتجر مدمجةً
 * مع تجاوزات البلد (countries.shipping) — كل بلد بأرقامه الصريحة، بلا تحويل عملة.
 * عند إغفال البلد (نداءات قديمة) يُستخدم سلوك مصر التاريخي حرفياً.
 */
export async function calculateShipping(env, settings, { governorateCode, governorateId, subtotal, country, countryRow }) {
  const amount = Number(subtotal) || 0;
  const ship = countryRow ? shippingForCountry(settings.shipping, countryRow) : (settings.shipping || {});
  let governorate = null;
  const targetCode = governorateCode || governorateId;

  if (targetCode) {
    if (country) {
      governorate = governorateId
        ? await first(env.DB.prepare('SELECT * FROM governorates WHERE id=? AND countryCode=? AND isActive=1').bind(governorateId, country))
        : await first(env.DB.prepare('SELECT * FROM governorates WHERE code=? AND countryCode=? AND isActive=1').bind(governorateCode, country));
    } else {
      governorate = governorateId
        ? await first(env.DB.prepare('SELECT * FROM governorates WHERE id=? AND isActive=1').bind(governorateId))
        : await first(env.DB.prepare('SELECT * FROM governorates WHERE code=? AND isActive=1').bind(governorateCode));
    }
    // إذا تم تمرير محافظة من بلد آخر أو غير مفعّلة/غير موجودة ← مرفوضة صراحة
    if (!governorate) {
      return { cost: 0, free: false, governorate: null, invalid: true, estimate: { min: ship.estimatedDaysMin || 2, max: ship.estimatedDaysMax || 5 } };
    }
  }

  const estimate = { min: ship.estimatedDaysMin || 2, max: ship.estimatedDaysMax || 5 };
  let cost = Number(ship.defaultCost) || 0;

  if (governorate && governorate.shippingCost !== undefined && governorate.shippingCost !== null) {
    cost = Number(governorate.shippingCost) || 0;
  }

  if (governorate && governorate.zoneId) {
    const z = await first(env.DB.prepare('SELECT * FROM shipping_zones WHERE id=? AND isActive=1').bind(governorate.zoneId));
    if (z) {
      cost = z.cost;
      if (z.freeThreshold && amount >= z.freeThreshold) cost = 0;
      if (z.estimatedDaysMin) estimate.min = z.estimatedDaysMin;
      if (z.estimatedDaysMax) estimate.max = z.estimatedDaysMax;
    }
  }

  const zones = await all(env.DB.prepare('SELECT * FROM shipping_zones WHERE isActive=1'));
  for (const z of zones) {
    const ids = parseJson(z.governorateIds, []);
    if (ids.includes(governorate?.id) || ids.includes(governorate?.code) || ids.includes(governorateCode)) {
      cost = z.cost;
      if (z.freeThreshold && amount >= z.freeThreshold) cost = 0;
      if (z.estimatedDaysMin) estimate.min = z.estimatedDaysMin;
      if (z.estimatedDaysMax) estimate.max = z.estimatedDaysMax;
      break;
    }
  }

  // الشحن المجاني فقط عند تفعيل صريح + عتبة > 0 + بلوغ العتبة. التعطيل لا يُسقط السعر أبداً.
  const freeThreshold = Number(ship.freeShippingThreshold) || 0;
  const freeOn = ship.freeShippingEnabled === true || ship.freeShippingEnabled === 1;
  const isFree = freeOn && freeThreshold > 0 && amount >= freeThreshold;
  if (isFree) {
    return { cost: 0, free: true, governorate, estimate };
  }

  return { cost: round2(cost), free: cost === 0, governorate, estimate };
}

export async function calculatePaymentFee(env, { methodCode, methodId, amount }) {
  const method = methodId ? await first(env.DB.prepare('SELECT * FROM payment_methods WHERE id=?').bind(methodId)) : await first(env.DB.prepare('SELECT * FROM payment_methods WHERE code=? AND isActive=1 AND isVisible=1').bind(String(methodCode||'cod').toLowerCase()));
  if (!method) return { fee:0, method:null };
  const fee = method.feeType === 'percentage' ? round2((amount * (Number(method.feeValue)||0))/100) : round2(Number(method.feeValue)||0);
  return { fee, method };
}

export function calculateTax(settings, taxableAmount) {
  if (!settings.payment?.taxEnabled) return 0;
  const rate = Number(settings.payment.taxRate) || 0;
  return round2(settings.payment.taxIncluded ? 0 : (taxableAmount * rate)/100);
}

export async function couponValid(env, coupon, userId, orderId = null) {
  const now = new Date();
  if (!coupon?.isActive) return false;
  if (now < new Date(coupon.startDate) || now > new Date(coupon.endDate)) return false;
  if ((coupon.usedCount||0) >= (coupon.usageLimit||1)) return false;
  if (userId && coupon.perUserLimit) {
    const row = await env.DB.prepare('SELECT COUNT(*) n FROM coupon_users WHERE couponId=? AND userId=? AND (? IS NULL OR orderId<>?)').bind(coupon.id, userId, orderId, orderId).first();
    if ((row?.n || 0) >= coupon.perUserLimit) return false;
  }
  return true;
}

export function couponDiscount(coupon, amount) {
  amount = Number(amount)||0;
  if (!coupon || amount < Number(coupon.minOrderAmount||0)) return 0;
  if (coupon.discountType === 'free-shipping') return 0;
  let d = coupon.discountType === 'percentage' ? amount * Number(coupon.discountValue)/100 : Number(coupon.discountValue);
  if (coupon.maxDiscount) d = Math.min(d, Number(coupon.maxDiscount));
  return round2(Math.min(d, amount));
}

export function couponApplies(coupon, product) {
  if (!coupon) return true;
  const ids = parseJson(coupon.products,[]), cats=parseJson(coupon.categories,[]), brands=parseJson(coupon.brands,[]), excluded=parseJson(coupon.excludedProducts,[]);
  if (excluded.includes(product.id)) return false;
  if (!ids.length && !cats.length && !brands.length) return true;
  return ids.includes(product.id) || cats.includes(product.category) || brands.includes(product.brand);
}
