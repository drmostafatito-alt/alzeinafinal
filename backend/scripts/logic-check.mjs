import { methodAvailableInCountry } from '../src/services/country.js';
import { invoiceHtml, waybillHtml } from '../src/lib/documents.js';

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
assert(way.includes('مدفوع مسبقاً'), 'prepaid waybill');
assert(way.includes('لا يتم تحصيل'), 'no collect');
const wayCod = waybillHtml(order, {});
assert(wayCod.includes('الدفع عند الاستلام'), 'cod waybill');
assert(wayCod.includes('المطلوب تحصيله'), 'cod collect');

const xss = invoiceHtml({ ...order, shippingAddress: { ...order.shippingAddress, name: '<img src=x onerror=alert(1)>' } }, {});
assert(!xss.includes('<img src=x onerror'), 'xss escaped');
assert(xss.includes('&lt;img'), 'escaped name');

console.log('LOGIC_CHECKS_PASS');
