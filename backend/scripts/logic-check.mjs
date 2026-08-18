import { methodAvailableInCountry } from '../src/services/country.js';
import { invoiceHtml, waybillHtml } from '../src/lib/documents.js';
import { applyFreeShipping } from '../src/services/pricing.js';
import { resolveCorsOrigin } from '../src/index.js';

const instapay = { config: JSON.stringify({ countries: ['EG'] }) };
const aani = { config: JSON.stringify({ countries: ['AE'] }) };
const both = { config: JSON.stringify({ countries: ['EG', 'AE'] }) };
const none = { config: JSON.stringify({ countries: [] }) };
const legacy = { config: '{}' };

const assert = (c, m) => { if (!c) throw new Error(m); };

assert(methodAvailableInCountry(instapay, 'EG') === true, 'EG+EG');
assert(methodAvailableInCountry(instapay, 'AE') === false, 'AE+EG-only');
assert(methodAvailableInCountry(aani, 'AE') === true, 'AE+AE');
assert(methodAvailableInCountry(aani, 'EG') === false, 'EG+AE-only');
assert(methodAvailableInCountry(both, 'EG') === true, 'EG+both');
assert(methodAvailableInCountry(both, 'AE') === true, 'AE+both');
assert(methodAvailableInCountry(none, 'EG') === false, 'empty list');
assert(methodAvailableInCountry(legacy, 'AE') === true, 'legacy all');

const order = {
  id: 'o1', orderNumber: 'AZ-20260819-0001', createdAt: '2026-08-19T10:00:00.000Z',
  paymentMethod: 'cod', paymentStatus: 'pending', total: 250, subtotal: 200, shippingCost: 50, tax: 0, couponDiscount: 0,
  customerName: 'Test User', customerPhone: '01000000000',
  shippingAddress: { name: 'Test User', phone: '01000000000', street: 'Tahrir', city: 'Cairo', governorateName: 'القاهرة', countryCode: 'EG' },
  financialSnapshot: { country: 'EG', currency: 'EGP', currencySymbol: 'ج.م' },
  items: [{ name: 'Dress', sku: 'D1', quantity: 1, price: 200, total: 200 }]
};
const inv = invoiceHtml(order, { siteNameAr: 'الزينة' });
assert(inv.includes('AZ-20260819-0001'), 'invoice number');
assert(inv.includes('Test User'), 'invoice name');
assert(inv.includes('ج.م'), 'invoice currency');
assert(!inv.includes('<script>'), 'invoice no auto-print script');

const ae = { ...order, paymentMethod: 'aani', paymentStatus: 'awaiting-verification', financialSnapshot: { country: 'AE', currency: 'AED', currencySymbol: 'د.إ' }, shippingAddress: { ...order.shippingAddress, countryCode: 'AE', governorateName: 'دبي' } };
const way = waybillHtml(ae, { siteNameAr: 'الزينة' });
assert(way.includes('مدفوع مسبقًا'), 'prepaid waybill');
assert(way.includes('لا يتم تحصيل'), 'no collect');
const wayCod = waybillHtml(order, {});
assert(wayCod.includes('الدفع عند الاستلام'), 'cod waybill');
assert(wayCod.includes('المطلوب تحصيله'), 'cod collect');

const xss = invoiceHtml({ ...order, shippingAddress: { ...order.shippingAddress, name: '<img src=x onerror=alert(1)>' } }, {});
assert(!xss.includes('<img src=x onerror'), 'xss escaped');
assert(xss.includes('&lt;img'), 'escaped name');

const egOff = applyFreeShipping({ freeShippingEnabled: false, freeShippingThreshold: 1000 }, 5000, 75);
assert(egOff.cost === 75 && egOff.free === false, 'EG free OFF');
const egBelow = applyFreeShipping({ freeShippingEnabled: true, freeShippingThreshold: 1000 }, 999, 75);
assert(egBelow.cost === 75 && egBelow.free === false, 'EG ON below');
const egExact = applyFreeShipping({ freeShippingEnabled: true, freeShippingThreshold: 1000 }, 1000, 75);
assert(egExact.cost === 0 && egExact.free === true, 'EG ON exact');
const egAbove = applyFreeShipping({ freeShippingEnabled: true, freeShippingThreshold: 1000 }, 1500, 75);
assert(egAbove.cost === 0 && egAbove.free === true, 'EG ON above');
const aeOff = applyFreeShipping({ freeShippingEnabled: false, freeShippingThreshold: 300 }, 9999, 25);
assert(aeOff.cost === 25 && aeOff.free === false, 'AE free OFF');
const aeBelow = applyFreeShipping({ freeShippingEnabled: true, freeShippingThreshold: 300 }, 299, 25);
assert(aeBelow.cost === 25 && aeBelow.free === false, 'AE ON below');
const aeExact = applyFreeShipping({ freeShippingEnabled: true, freeShippingThreshold: 300 }, 300, 25);
assert(aeExact.cost === 0 && aeExact.free === true, 'AE ON exact');
const aeAbove = applyFreeShipping({ freeShippingEnabled: true, freeShippingThreshold: 300 }, 301, 25);
assert(aeAbove.cost === 0 && aeAbove.free === true, 'AE ON above');

const prodEnv = { ENVIRONMENT: 'production', CORS_ORIGINS: 'https://store.pages.dev,https://alzeina.com' };
assert(resolveCorsOrigin('https://store.pages.dev', prodEnv) === 'https://store.pages.dev', 'cors allow listed');
assert(resolveCorsOrigin('https://evil.com', prodEnv) === null, 'cors reject unlisted');
assert(resolveCorsOrigin('https://evil.com', { ENVIRONMENT: 'production', CORS_ORIGINS: '*' }) === null, 'cors reject star in prod');
assert(resolveCorsOrigin('http://localhost:5173', { ENVIRONMENT: 'development', CORS_ORIGINS: '' }) === 'http://localhost:5173', 'cors localhost dev');

console.log('LOGIC_CHECKS_PASS');
