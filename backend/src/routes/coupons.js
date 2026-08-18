import { Hono } from 'hono';
import { first } from '../lib/db.js';
import { ok, fail } from '../lib/response.js';
import { couponValid, couponDiscount } from '../services/pricing.js';
const app = new Hono();
app.get('/validate/:code', async c => {
  const coupon = await first(c.env.DB.prepare('SELECT * FROM coupons WHERE code=? AND isActive=1').bind(c.req.param('code').toUpperCase()));
  if (!coupon || !(await couponValid(c.env, coupon, c.get('user')?.id))) return fail(c,'الكوبون غير صالح أو منتهي الصلاحية',400);
  return ok(c,{ coupon: { ...coupon, _id:coupon.id, discount: couponDiscount(coupon, 0) }, valid:true });
});
export default app;
