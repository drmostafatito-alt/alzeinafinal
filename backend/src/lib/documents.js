import { qrSvgDataUri } from '../utils/qr.js';

const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const paymentLabel = (method) => {
  const m = String(method || '').toLowerCase();
  const map = {
    cod: 'الدفع عند الاستلام',
    instapay: 'InstaPay',
    aani: 'آني',
    vodafone: 'فودافون كاش',
    'vodafone-cash': 'فودافون كاش',
    etisalat: 'اتصالات كاش',
    'etisalat-cash': 'اتصالات كاش',
    orange: 'أورنج كاش',
    'orange-cash': 'أورنج كاش',
    meeza: 'ميزة',
  };
  return map[m] || method || '—';
};

const isCod = (order) => String(order?.paymentMethod || '').toLowerCase() === 'cod';
const isPaid = (order) => ['paid', 'approved', 'confirmed'].includes(String(order?.paymentStatus || '').toLowerCase());
const isAeOrder = (order, addr = {}) => {
  const fin = order.financialSnapshot || {};
  return fin.country === 'AE' || addr.countryCode === 'AE' || order.countryCode === 'AE' || fin.currency === 'AED';
};

export function moneyParts(order) {
  const fin = order.financialSnapshot || {};
  const ae = isAeOrder(order, order.shippingAddress || {});
  return {
    symbol: fin.currencySymbol || (ae ? 'د.إ' : 'ج.م'),
    currency: fin.currency || (ae ? 'AED' : 'EGP'),
    country: ae ? 'AE' : 'EG',
  };
}

export function formatMoney(amount, order) {
  const { symbol } = moneyParts(order);
  const n = Number(amount);
  const val = Number.isFinite(n) ? (Number.isInteger(n) ? String(n) : n.toFixed(2)) : '0';
  return `${val} ${symbol}`;
}

export function resolveCustomer(order) {
  const addr = order.shippingAddress && typeof order.shippingAddress === 'object' ? order.shippingAddress : {};
  const name = addr.name || order.customerName || order.guestName || '';
  const phone = addr.phone || order.customerPhone || order.guestPhone || '';
  const email = addr.email || order.customerEmail || order.guestEmail || '';
  return {
    name: name || 'عميل المتجر',
    phone: phone || '—',
    email: email || '—',
    whatsapp: phone || '—',
  };
}

export function resolveAddress(order) {
  const addr = order.shippingAddress && typeof order.shippingAddress === 'object' ? order.shippingAddress : {};
  const fin = order.financialSnapshot || {};
  const ae = isAeOrder(order, addr);
  return {
    country: ae ? 'الإمارات العربية المتحدة' : 'جمهورية مصر العربية',
    countryFlag: ae ? '🇦🇪 الإمارات' : '🇪🇬 مصر',
    govLabel: ae ? 'الإمارة' : 'المحافظة',
    gov: addr.governorateName || fin.governorate?.name || addr.governorate || '',
    city: addr.city || '',
    district: addr.district || '',
    street: addr.street || '',
    building: addr.buildingNumber || addr.building || '',
    floor: addr.floor || '',
    apartment: addr.apartment || addr.unit || '',
    postal: addr.postalCode || addr.zip || '',
    notes: addr.notes || addr.deliveryNotes || order.notes || '',
  };
}

function paymentBanner(order) {
  const due = formatMoney(order.total, order);
  if (isCod(order)) {
    return {
      cls: 'pay-cod',
      title: 'الدفع عند الاستلام',
      sub: `المبلغ المطلوب تحصيله: ${due}`,
    };
  }
  if (isPaid(order)) {
    return {
      cls: 'pay-ok',
      title: 'مدفوع مسبقًا',
      sub: 'لا يتم تحصيل مبلغ عند التسليم',
    };
  }
  return {
    cls: 'pay-review',
    title: 'مدفوع مسبقًا / قيد مراجعة الدفع',
    sub: 'الدفع المسبق — قيد مراجعة الدفع',
  };
}

function paymentStatusText(order) {
  if (isCod(order)) return 'الدفع عند الاستلام';
  if (isPaid(order)) return 'مدفوع مسبقًا';
  return 'قيد مراجعة الدفع';
}

function invoiceNumber(order, s = {}) {
  if (order.invoiceNumber) return String(order.invoiceNumber);
  const prefix = String(s.invoice?.prefix || 'INV').replace(/-+$/, '');
  return `${prefix}-${order.orderNumber || order.id || ''}`;
}

const printCss = `
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Arial, Helvetica, sans-serif; margin: 0; padding: 16px; background: #ece8e4; color: #111; }
  .sheet { max-width: 210mm; margin: 0 auto; background: #fff; padding: 22px 26px; border: 1px solid #ddd; }
  .no-print { }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { border: none; max-width: none; padding: 0; box-shadow: none; }
    .no-print { display: none !important; }
    nav, header.admin, .admin-nav, button, .btn { display: none !important; }
  }
`;

export function invoiceHtml(order, s = {}) {
  const addr = resolveAddress(order);
  const cust = resolveCustomer(order);
  const money = moneyParts(order);
  const banner = paymentBanner(order);
  const invNo = invoiceNumber(order, s);
  const store = esc(s.invoice?.companyName || s.siteNameAr || 'الزينة — AL ZEINA');
  const logo = s.invoice?.logo || s.logo || '';
  const dateStr = order.createdAt ? new Date(order.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

  const rows = (order.items || []).map((i) => `
    <tr>
      <td><strong>${esc(i.name || 'منتج')}</strong></td>
      <td class="mono">${esc(i.sku || '—')}</td>
      <td class="num">${esc(i.quantity)}</td>
      <td class="num">${esc(formatMoney(i.price, order))}</td>
      <td class="num"><strong>${esc(formatMoney(i.total, order))}</strong></td>
    </tr>`).join('');

  const fee = Number(order.paymentFee) || 0;
  const tax = Number(order.tax) || 0;
  const disc = Number(order.couponDiscount || order.discount) || 0;

  return `<!doctype html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>فاتورة ${esc(order.orderNumber)}</title>
  <style>
    ${printCss}
    .head { display: flex; justify-content: space-between; gap: 16px; border-bottom: 3px solid #111; padding-bottom: 14px; }
    .brand { font-size: 26px; font-weight: 900; letter-spacing: .02em; }
    .muted { color: #555; font-size: 12px; line-height: 1.6; }
    .doc-title { text-align: left; }
    .doc-title h1 { margin: 0; font-size: 22px; }
    .mono { font-family: ui-monospace, Menlo, Consolas, monospace; }
    .meta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin: 16px 0; }
    .box { border: 1px solid #e6e0db; border-radius: 10px; padding: 12px 14px; background: #faf7f4; }
    .box h3 { margin: 0 0 8px; font-size: 12px; color: #7a5c4e; letter-spacing: .04em; }
    .box p { margin: 3px 0; font-size: 13px; }
    .banner { margin: 8px 0 16px; padding: 12px 14px; border-radius: 10px; font-weight: 800; text-align: center; }
    .pay-cod { background: #fef2f2; color: #991b1b; border: 2px solid #ef4444; }
    .pay-ok { background: #f0fdf4; color: #166534; border: 2px solid #22c55e; }
    .pay-review { background: #fff7ed; color: #9a3412; border: 2px solid #f97316; }
    table.items { width: 100%; border-collapse: collapse; font-size: 13px; }
    table.items th { background: #111; color: #fff; padding: 8px 10px; text-align: right; }
    table.items td { padding: 9px 10px; border-bottom: 1px solid #eee; }
    .num { text-align: left; white-space: nowrap; }
    .totals { width: 320px; margin: 16px 0 0 auto; font-size: 13px; }
    .totals div { display: flex; justify-content: space-between; padding: 5px 0; }
    .grand { border-top: 2px solid #111; margin-top: 6px; padding-top: 8px; font-size: 16px; font-weight: 900; }
    .logo { max-height: 56px; max-width: 140px; object-fit: contain; }
    .btn { background: #111; color: #fff; border: 0; padding: 10px 18px; border-radius: 999px; font-weight: 700; cursor: pointer; }
    .addr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; font-size: 13px; }
    .addr-grid span { color: #6b5a52; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="head">
      <div>
        ${logo ? `<img class="logo" src="${esc(logo)}" alt="">` : ''}
        <div class="brand">${store}</div>
        <div class="muted">
          ${esc(s.invoice?.companyAddress || s.contact?.address || '')}<br>
          هاتف: ${esc(s.invoice?.companyPhone || s.contact?.phone || '—')}
          ${s.contact?.email || s.invoice?.companyEmail ? ` · ${esc(s.contact?.email || s.invoice?.companyEmail)}` : ''}
        </div>
      </div>
      <div class="doc-title">
        <h1>فاتورة ضريبية / شراء</h1>
        <div class="mono">${esc(invNo)}</div>
        <div class="muted">طلب ${esc(order.orderNumber)} · ${esc(dateStr)}</div>
      </div>
    </div>

    <div class="banner ${banner.cls}">${esc(banner.title)} — ${esc(banner.sub)}</div>

    <div class="meta">
      <div class="box">
        <h3>العميل</h3>
        <p><strong>${esc(cust.name)}</strong></p>
        <p>الهاتف: <span class="mono" dir="ltr">${esc(cust.phone)}</span></p>
        <p>واتساب: <span class="mono" dir="ltr">${esc(cust.whatsapp)}</span></p>
        <p>البريد: ${esc(cust.email)}</p>
      </div>
      <div class="box">
        <h3>عنوان الشحن الكامل</h3>
        <div class="addr-grid">
          <div><span>الدولة:</span> ${esc(addr.countryFlag)}</div>
          <div><span>${esc(addr.govLabel)}:</span> ${esc(addr.gov || '—')}</div>
          <div><span>المدينة:</span> ${esc(addr.city || '—')}</div>
          <div><span>الحي:</span> ${esc(addr.district || '—')}</div>
          <div><span>الشارع:</span> ${esc(addr.street || '—')}</div>
          <div><span>المبنى:</span> ${esc(addr.building || '—')}</div>
          <div><span>الطابق:</span> ${esc(addr.floor || '—')}</div>
          <div><span>الشقة:</span> ${esc(addr.apartment || '—')}</div>
          <div><span>الرمز البريدي:</span> ${esc(addr.postal || '—')}</div>
        </div>
        ${addr.notes ? `<p style="margin-top:8px;color:#9a3412;">ملاحظات التوصيل: ${esc(addr.notes)}</p>` : ''}
      </div>
      <div class="box">
        <h3>الدفع والعملة</h3>
        <p>الطريقة: ${esc(paymentLabel(order.paymentMethod))}</p>
        <p>الحالة: ${esc(paymentStatusText(order))}</p>
        <p>العملة: ${esc(money.currency)} / ${esc(money.symbol)}</p>
        <p>الدولة: ${esc(addr.country)}</p>
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th>المنتج</th>
          <th>SKU</th>
          <th>الكمية</th>
          <th>سعر الوحدة</th>
          <th>الإجمالي</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="5">لا توجد أصناف</td></tr>'}</tbody>
    </table>

    <div class="totals">
      <div><span>المجموع الفرعي</span><span>${esc(formatMoney(order.subtotal, order))}</span></div>
      ${disc > 0 ? `<div style="color:#166534;"><span>الخصم</span><span>− ${esc(formatMoney(disc, order))}</span></div>` : ''}
      <div><span>الشحن</span><span>${Number(order.shippingCost) === 0 ? 'مجاني' : esc(formatMoney(order.shippingCost, order))}</span></div>
      ${tax > 0 ? `<div><span>الضريبة</span><span>${esc(formatMoney(tax, order))}</span></div>` : ''}
      ${fee > 0 ? `<div><span>رسوم الدفع</span><span>${esc(formatMoney(fee, order))}</span></div>` : ''}
      <div class="grand"><span>الإجمالي النهائي</span><span>${esc(formatMoney(order.total, order))}</span></div>
    </div>

    <div style="text-align:center;margin-top:18px;">
      <img src="${qrSvgDataUri(String(order.orderNumber || '') + ' ' + String(order.id || ''))}" alt="" width="88" height="88">
    </div>
    <div class="no-print" style="text-align:center;margin-top:14px;">
      <button class="btn" onclick="window.print()">طباعة / حفظ PDF</button>
    </div>
  </div>
</body>
</html>`;
}

export function waybillHtml(order, s = {}) {
  const addr = resolveAddress(order);
  const cust = resolveCustomer(order);
  const banner = paymentBanner(order);
  const store = esc(s.siteNameAr || 'AL ZEINA — الزينة');
  const items = (order.items || []).map((i) =>
    `<tr><td>${esc(i.name || 'منتج')}</td><td class="mono">${esc(i.sku || '—')}</td><td class="num"><strong>×${esc(i.quantity)}</strong></td></tr>`
  ).join('');

  return `<!doctype html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>بوليصة شحن ${esc(order.orderNumber)}</title>
  <style>
    ${printCss}
    .wb { border: 3px solid #111; padding: 16px 18px; }
    .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #111; padding-bottom: 10px; margin-bottom: 12px; }
    .store { font-size: 28px; font-weight: 900; }
    .onum { font-size: 26px; font-weight: 900; font-family: ui-monospace, Menlo, Consolas, monospace; letter-spacing: 1px; }
    .flag { font-size: 18px; font-weight: 800; }
    .banner { padding: 14px; text-align: center; font-size: 18px; font-weight: 900; border-radius: 8px; margin: 10px 0 14px; }
    .pay-cod { background: #fee2e2; color: #7f1d1d; border: 3px solid #dc2626; }
    .pay-ok { background: #dcfce7; color: #14532d; border: 3px solid #16a34a; }
    .pay-review { background: #ffedd5; color: #7c2d12; border: 3px solid #ea580c; }
    .who { background: #111; color: #fff; padding: 14px 16px; border-radius: 8px; margin-bottom: 12px; }
    .who .name { font-size: 24px; font-weight: 900; }
    .who .phone { font-size: 22px; font-weight: 900; direction: ltr; display: inline-block; font-family: ui-monospace, Menlo, Consolas, monospace; }
    .dest { border: 2px solid #111; padding: 12px 14px; }
    .dest h3 { margin: 0 0 8px; font-size: 13px; }
    .dest .line { font-size: 15px; margin: 4px 0; }
    .dest .big { font-size: 17px; font-weight: 800; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 14px; }
    th { text-align: right; border-bottom: 2px solid #111; padding: 6px; }
    td { padding: 6px; border-bottom: 1px solid #ddd; }
    .num { text-align: left; }
    .btn { background: #111; color: #fff; border: 0; padding: 10px 18px; border-radius: 999px; font-weight: 700; cursor: pointer; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="wb">
      <div class="top">
        <div>
          <div class="store">${store}</div>
          <div>بوليصة شحن / Shipping Waybill</div>
        </div>
        <div style="text-align:left;">
          <div class="flag">${esc(addr.countryFlag)}</div>
          <div>رقم الطلب</div>
          <div class="onum">${esc(order.orderNumber)}</div>
        </div>
      </div>

      <div class="banner ${banner.cls}">
        ${esc(banner.title)}<br>
        <span style="font-size:20px;">${esc(banner.sub)}</span>
      </div>

      <div class="who">
        <div>المستلم</div>
        <div class="name">${esc(cust.name)}</div>
        <div>هاتف / واتساب: <span class="phone">${esc(cust.phone)}</span></div>
      </div>

      <div class="dest">
        <h3>عنوان التسليم الكامل</h3>
        <div class="line big">الدولة: ${esc(addr.country)} — ${esc(addr.govLabel)}: ${esc(addr.gov || '—')}</div>
        <div class="line">المدينة: <strong>${esc(addr.city || '—')}</strong> · الحي: <strong>${esc(addr.district || '—')}</strong></div>
        <div class="line big">الشارع: ${esc(addr.street || '—')}</div>
        <div class="line">المبنى: ${esc(addr.building || '—')} · الطابق: ${esc(addr.floor || '—')} · الشقة: ${esc(addr.apartment || '—')} · الرمز البريدي: ${esc(addr.postal || '—')}</div>
        ${addr.notes ? `<div class="line" style="color:#9a3412;">ملاحظات التوصيل: ${esc(addr.notes)}</div>` : ''}
      </div>

      <table>
        <thead><tr><th>محتويات الشحنة</th><th>SKU</th><th>الكمية</th></tr></thead>
        <tbody>${items || '<tr><td colspan="3">—</td></tr>'}</tbody>
      </table>
      ${order.trackingNumber ? `<p><strong>رقم التتبع:</strong> ${esc(order.trackingNumber)}</p>` : ''}
    </div>
    <div class="no-print" style="text-align:center;margin-top:14px;">
      <button class="btn" onclick="window.print()">طباعة البوليصة / حفظ PDF</button>
    </div>
  </div>
</body>
</html>`;
}
