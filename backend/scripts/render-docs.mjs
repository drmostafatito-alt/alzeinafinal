import { writeFileSync, mkdirSync } from 'node:fs';
import { invoiceHtml, waybillHtml } from '../src/lib/documents.js';

const settings = {
  siteNameAr: 'الزينة — AL ZEINA',
  invoice: { prefix: 'INV', companyName: 'الزينة — AL ZEINA', companyPhone: '01000000000', companyAddress: 'القاهرة', companyEmail: 'hello@alzeina.com' },
  contact: { phone: '01000000000', email: 'hello@alzeina.com', address: 'القاهرة' },
};

const baseEg = {
  id: 'ord-eg-1',
  orderNumber: 'AZ-20260819-0001',
  createdAt: '2026-08-19T10:00:00.000Z',
  paymentMethod: 'cod',
  paymentStatus: 'pending',
  subtotal: 900,
  couponDiscount: 50,
  shippingCost: 50,
  tax: 0,
  paymentFee: 0,
  total: 900,
  customerName: 'سارة أحمد',
  customerPhone: '01011112222',
  customerEmail: 'sara@example.com',
  shippingAddress: {
    name: 'سارة أحمد',
    phone: '01011112222',
    email: 'sara@example.com',
    countryCode: 'EG',
    governorateName: 'القاهرة',
    city: 'مدينة نصر',
    district: 'حي السرايات',
    street: 'شارع عباس العقاد',
    buildingNumber: '12',
    floor: '3',
    apartment: '8',
    postalCode: '11765',
    notes: 'الاتصال قبل الوصول',
  },
  financialSnapshot: { country: 'EG', currency: 'EGP', currencySymbol: 'ج.م' },
  items: [{ name: 'فستان سهرة', sku: 'DRS-01', quantity: 1, price: 900, total: 900 }],
};

const cases = {
  'eg-cod': baseEg,
  'eg-instapay-pending': { ...baseEg, id: 'ord-eg-2', orderNumber: 'AZ-20260819-0002', paymentMethod: 'instapay', paymentStatus: 'awaiting-verification' },
  'eg-guest-partial': {
    ...baseEg,
    id: 'ord-eg-g',
    orderNumber: 'AZ-20260819-0003',
    userId: null,
    customerName: 'ضيف المتجر',
    customerEmail: 'guest@example.com',
    guestEmail: 'guest@example.com',
    guestPhone: '01200000000',
    shippingAddress: { name: 'ضيف المتجر', phone: '01200000000', email: 'guest@example.com', countryCode: 'EG', city: 'الجيزة', street: 'الهرم', governorateName: 'الجيزة' },
  },
  'eg-free-ship-discount': { ...baseEg, id: 'ord-eg-f', orderNumber: 'AZ-20260819-0004', shippingCost: 0, couponDiscount: 100, total: 800 },
  'ae-cod': {
    ...baseEg,
    id: 'ord-ae-1',
    orderNumber: 'AZ-20260819-0101',
    paymentMethod: 'cod',
    paymentStatus: 'pending',
    subtotal: 180,
    shippingCost: 19,
    couponDiscount: 0,
    total: 199,
    shippingAddress: {
      name: 'Fatima Ali',
      phone: '971500000001',
      email: 'fatima@example.com',
      countryCode: 'AE',
      governorateName: 'دبي',
      city: 'دبي',
      district: 'جميرا',
      street: 'شارع الوصل',
      buildingNumber: '7',
      floor: '10',
      apartment: '1004',
      postalCode: '00000',
      notes: 'بوابة 2',
    },
    customerName: 'Fatima Ali',
    customerPhone: '971500000001',
    customerEmail: 'fatima@example.com',
    financialSnapshot: { country: 'AE', currency: 'AED', currencySymbol: 'د.إ' },
    items: [{ name: 'Serum', sku: 'SR-AE', quantity: 1, price: 180, total: 180 }],
  },
  'ae-aani-pending': {
    ...baseEg,
    id: 'ord-ae-2',
    orderNumber: 'AZ-20260819-0102',
    paymentMethod: 'aani',
    paymentStatus: 'awaiting-verification',
    subtotal: 180,
    shippingCost: 19,
    total: 199,
    customerName: 'Mariam Hassan',
    customerPhone: '971500000002',
    customerEmail: '',
    shippingAddress: {
      name: 'Mariam Hassan',
      phone: '971500000002',
      countryCode: 'AE',
      governorateName: 'أبوظبي',
      city: 'أبوظبي',
      district: 'الخالدية',
      street: 'كورنيش',
      buildingNumber: '3',
      floor: '1',
      apartment: '2',
    },
    financialSnapshot: { country: 'AE', currency: 'AED', currencySymbol: 'د.إ' },
    items: [{ name: 'Oil', sku: 'OIL-1', quantity: 2, price: 90, total: 180 }],
  },
  'xss': {
    ...baseEg,
    id: 'ord-xss',
    orderNumber: 'AZ-XSS-1',
    shippingAddress: {
      name: '<img src=x onerror=alert(1)>',
      phone: '0100',
      street: '<script>alert(1)</script>',
      city: 'Cairo',
      governorateName: 'القاهرة',
      countryCode: 'EG',
      notes: '<b>hack</b>',
    },
    items: [{ name: '<svg onload=alert(1)>', sku: 'X', quantity: 1, price: 1, total: 1 }],
  },
};

const outDir = '/home/user/zo/docs-preview';
mkdirSync(outDir, { recursive: true });

for (const [key, order] of Object.entries(cases)) {
  writeFileSync(`${outDir}/invoice-${key}.html`, invoiceHtml(order, settings));
  writeFileSync(`${outDir}/waybill-${key}.html`, waybillHtml(order, settings));
}

const xssInv = invoiceHtml(cases.xss, settings);
if (xssInv.includes('<img src=x') || xssInv.includes('<script>alert')) {
  throw new Error('XSS leak in invoice');
}
console.log('WROTE', Object.keys(cases).length * 2, 'html files');
