import { methodAvailableInCountry } from '../src/services/country.js';
import { invoiceHtml, waybillHtml } from '../src/lib/documents.js';
import { applyFreeShipping, calculateShipping } from '../src/services/pricing.js';
import { resolveCorsOrigin } from '../src/index.js';

const assert = (c, m) => { if (!c) throw new Error(m); };

const instapay = { config: JSON.stringify({ countries: ['EG'] }) };
const aani = { config: JSON.stringify({ countries: ['AE'] }) };
assert(methodAvailableInCountry(instapay, 'EG') === true, 'EG+EG');
assert(methodAvailableInCountry(instapay, 'AE') === false, 'AE+EG-only');
assert(methodAvailableInCountry(aani, 'AE') === true, 'AE+AE');
assert(methodAvailableInCountry(aani, 'EG') === false, 'EG+AE-only');

const order = {
  id: 'o1', orderNumber: 'AZ-20260819-0001', createdAt: '2026-08-19T10:00:00.000Z',
  paymentMethod: 'cod', paymentStatus: 'pending', total: 250, subtotal: 200, shippingCost: 50, tax: 0, couponDiscount: 0,
  customerName: 'Test User', customerPhone: '01000000000',
  shippingAddress: {
    name: 'Test User', phone: '01000000000', email: 'a@b.c', street: 'Tahrir', city: 'Cairo',
    district: 'Downtown', buildingNumber: '1', floor: '2', apartment: '3',
    governorateName: 'القاهرة', countryCode: 'EG', notes: 'ring'
  },
  financialSnapshot: { country: 'EG', currency: 'EGP', currencySymbol: 'ج.م' },
  items: [{ name: 'Dress', sku: 'D1', quantity: 1, price: 200, total: 200 }]
};
const inv = invoiceHtml(order, { siteNameAr: 'الزينة', invoice: { prefix: 'INV' } });
assert(inv.includes('AZ-20260819-0001'), 'invoice order number');
assert(inv.includes('INV-AZ-20260819-0001'), 'invoice number');
assert(inv.includes('Test User'), 'invoice name');
assert(inv.includes('01000000000'), 'invoice phone');
assert(inv.includes('ج.م'), 'invoice currency');
assert(inv.includes('الدفع عند الاستلام'), 'cod invoice');
assert(inv.includes('المبلغ المطلوب تحصيله'), 'cod collect');
assert(inv.includes('الطابق'), 'floor label');
assert(!inv.includes('مدفوع بالكامل'), 'cod not fully paid');

const ae = {
  ...order, paymentMethod: 'aani', paymentStatus: 'awaiting-verification',
  financialSnapshot: { country: 'AE', currency: 'AED', currencySymbol: 'د.إ' },
  shippingAddress: { ...order.shippingAddress, countryCode: 'AE', governorateName: 'دبي' }
};
const invAe = invoiceHtml(ae, {});
assert(invAe.includes('د.إ'), 'ae currency');
assert(invAe.includes('قيد مراجعة الدفع'), 'pending prepaid');
assert(!invAe.includes('مدفوع بالكامل'), 'not fully paid');

const way = waybillHtml(ae, { siteNameAr: 'الزينة' });
assert(way.includes('مدفوع مسبقًا'), 'prepaid waybill');
assert(way.includes('قيد مراجعة الدفع'), 'pending waybill');
assert(way.includes('دبي'), 'emirate');
const wayCod = waybillHtml(order, {});
assert(wayCod.includes('الدفع عند الاستلام'), 'cod waybill');
assert(wayCod.includes('المبلغ المطلوب تحصيله') || wayCod.includes('المطلوب تحصيله'), 'cod collect waybill');

const xss = invoiceHtml({ ...order, shippingAddress: { ...order.shippingAddress, name: '<img src=x onerror=alert(1)>' } }, {});
assert(!xss.includes('<img src=x onerror'), 'xss escaped');
assert(xss.includes('&lt;img'), 'escaped name');

assert(applyFreeShipping({ freeShippingEnabled: false, freeShippingThreshold: 1000 }, 5000, 75).cost === 75, 'EG free OFF');
assert(applyFreeShipping({ freeShippingEnabled: true, freeShippingThreshold: 1000 }, 1000, 75).free === true, 'EG ON exact');
assert(resolveCorsOrigin('https://evil.com', { ENVIRONMENT: 'production', CORS_ORIGINS: '*' }) === null, 'cors star');

const cairo = { id: 'gov-cairo', code: 'EG-C', countryCode: 'EG', isActive: 1, shippingCost: 60, zoneId: 'z1' };
const dubai = { id: 'gov-dubai', code: 'AE-DXB', countryCode: 'AE', isActive: 1, shippingCost: 25, zoneId: 'z2' };
const zoneBypass = { id: 'z1', cost: 60, freeThreshold: 1, isActive: 1, governorateIds: '["gov-cairo"]', estimatedDaysMin: 2, estimatedDaysMax: 4 };
const zoneAe = { id: 'z2', cost: 25, freeThreshold: 1, isActive: 1, governorateIds: '["gov-dubai"]' };

const stmt = (rowOrRows) => {
  const first = async () => (Array.isArray(rowOrRows) ? rowOrRows[0] : rowOrRows) || null;
  const all = async () => ({ results: Array.isArray(rowOrRows) ? rowOrRows : (rowOrRows ? [rowOrRows] : []) });
  return { bind: () => ({ first, all }), first, all };
};
const mockEnv = (gov, zones) => ({
  DB: {
    prepare(sql) {
      if (sql.includes('FROM governorates')) {
        return {
          bind(a, b) {
            const hit = gov && ((gov.id === a || gov.code === a) && (!b || gov.countryCode === b)) ? gov : null;
            return stmt(hit);
          }
        };
      }
      if (sql.includes('FROM shipping_zones WHERE id=')) {
        return { bind(id) { return stmt(zones.find((z) => z.id === id) || null); } };
      }
      if (sql.includes('FROM shipping_zones')) return stmt(zones);
      return stmt(null);
    }
  }
});

const egRow = { code: 'EG', shipping: JSON.stringify({ defaultCost: 50, freeShippingEnabled: false, freeShippingThreshold: 1000 }) };
const aeRow = { code: 'AE', shipping: JSON.stringify({ defaultCost: 20, freeShippingEnabled: false, freeShippingThreshold: 300 }) };

const paid = await calculateShipping(mockEnv(cairo, [zoneBypass]), { shipping: {} }, { governorateCode: 'EG-C', subtotal: 9999, country: 'EG', countryRow: egRow });
assert(paid.invalid !== true && paid.cost === 60 && paid.free === false, 'EG OFF + zone threshold must stay paid');

const egOn = { ...egRow, shipping: JSON.stringify({ defaultCost: 50, freeShippingEnabled: true, freeShippingThreshold: 1000 }) };
const egBelow = await calculateShipping(mockEnv(cairo, [zoneBypass]), { shipping: {} }, { governorateCode: 'EG-C', subtotal: 999, country: 'EG', countryRow: egOn });
assert(egBelow.cost === 60 && egBelow.free === false, 'EG ON below');
const egExact = await calculateShipping(mockEnv(cairo, [zoneBypass]), { shipping: {} }, { governorateCode: 'EG-C', subtotal: 1000, country: 'EG', countryRow: egOn });
assert(egExact.cost === 0 && egExact.free === true, 'EG ON exact');
const egAbove = await calculateShipping(mockEnv(cairo, [zoneBypass]), { shipping: {} }, { governorateCode: 'EG-C', subtotal: 1500, country: 'EG', countryRow: egOn });
assert(egAbove.cost === 0 && egAbove.free === true, 'EG ON above');

const aeOn = { ...aeRow, shipping: JSON.stringify({ defaultCost: 20, freeShippingEnabled: true, freeShippingThreshold: 300 }) };
const aeOffPaid = await calculateShipping(mockEnv(dubai, [zoneAe]), { shipping: {} }, { governorateCode: 'AE-DXB', subtotal: 9999, country: 'AE', countryRow: aeRow });
assert(aeOffPaid.cost === 25 && aeOffPaid.free === false, 'AE OFF stays paid');
const aeBelow = await calculateShipping(mockEnv(dubai, [zoneAe]), { shipping: {} }, { governorateCode: 'AE-DXB', subtotal: 299, country: 'AE', countryRow: aeOn });
assert(aeBelow.cost === 25 && aeBelow.free === false, 'AE ON below');
const aeExact = await calculateShipping(mockEnv(dubai, [zoneAe]), { shipping: {} }, { governorateCode: 'AE-DXB', subtotal: 300, country: 'AE', countryRow: aeOn });
assert(aeExact.cost === 0 && aeExact.free === true, 'AE ON exact');

const cross = await calculateShipping(mockEnv(cairo, [zoneBypass]), { shipping: {} }, { governorateCode: 'EG-C', subtotal: 50, country: 'AE', countryRow: aeOn });
assert(cross.invalid === true && cross.free === false, 'EG gov under AE is invalid not free');

const missing = await calculateShipping(mockEnv(cairo, []), { shipping: {} }, { governorateCode: 'NOPE', subtotal: 50, country: 'EG', countryRow: egOn });
assert(missing.invalid === true && missing.free === false, 'missing gov invalid');

console.log('LOGIC_CHECKS_PASS');
