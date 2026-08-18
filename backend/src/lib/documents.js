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

const paymentStatusLabel = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'paid' || s === 'approved') return 'مدفوع';
  if (s === 'awaiting-verification' || s === 'pending') return 'بانتظار التأكيد';
  if (s === 'rejected') return 'مرفوض';
  return status || '—';
};

function addressParts(addr = {}) {
  return {
    name: addr.name || '',
    phone: addr.phone || '',
    email: addr.email || '',
    country: addr.countryCode === 'AE' || addr.country === 'AE' ? 'الإمارات العربية المتحدة' : 'جمهورية مصر العربية',
    gov: addr.governorateName || addr.governorate || '',
    city: addr.city || '',
    district: addr.district || '',
    street: addr.street || '',
    building: addr.buildingNumber || addr.building || '',
    floor: addr.floor || '',
    apartment: addr.apartment || '',
    notes: addr.notes || addr.deliveryNotes || '',
  };
}

export function invoiceHtml(order, s = {}) {
  const addr = order.shippingAddress || {};
  const a = addressParts(addr);
  const fin = order.financialSnapshot || {};
  const isAe = fin.country === 'AE' || addr.countryCode === 'AE';
  const sym = esc(fin.currencySymbol || (isAe ? 'د.إ' : 'ج.م'));
  const currency = esc(fin.currency || (isAe ? 'AED' : 'EGP'));
  const countryBadge = isAe ? '🇦🇪 الإمارات العربية المتحدة' : '🇪🇬 جمهورية مصر العربية';
  const invoiceNo = esc(order.invoiceNumber || order.orderNumber);
  const storeName = esc(s.invoice?.companyName || s.siteNameAr || 'الزينة — AL-ZEINA');

  const itemsRows = (order.items || []).map((i) => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #eee;">
        <strong>${esc(i.name || 'منتج')}</strong>
        ${i.sku ? `<br/><span style="font-size:11px;color:#666;">SKU: ${esc(i.sku)}</span>` : ''}
      </td>
      <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;">${esc(i.quantity)}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;text-align:left;">${esc(i.price)} ${sym}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;text-align:left;font-weight:bold;">${esc(i.total)} ${sym}</td>
    </tr>`).join('');

  const fullAddr = [
    a.street,
    a.building ? `مبنى ${a.building}` : null,
    a.floor ? `طابق ${a.floor}` : null,
    a.apartment ? `شقة ${a.apartment}` : null,
    a.district,
    a.city,
    a.gov
  ].filter(Boolean).map(esc).join('، ');

  const customerName = esc(addr.name || order.customerName || order.user?.name || order.guestEmail || 'عميل المتجر');
  const customerPhone = esc(addr.phone || order.customerPhone || order.guestPhone || '—');
  const customerEmail = esc(addr.email || order.customerEmail || order.guestEmail || order.user?.email || '—');

  return `<!doctype html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>فاتورة ${esc(order.orderNumber)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 24px; color: #111; background: #f9f9f9; }
    .invoice-card { max-width: 800px; margin: 0 auto; background: #fff; border-radius: 16px; border: 1px solid #eee; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 24px; }
    .company-title { font-size: 24px; font-weight: 800; margin: 0 0 4px; color: #111; }
    .meta-box { background: #fdf8f5; border-radius: 12px; padding: 16px; margin-bottom: 24px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
    th { background: #f5f5f5; padding: 10px; text-align: right; border-bottom: 2px solid #ddd; }
    .totals { width: 300px; margin-right: auto; margin-left: 0; margin-top: 16px; border-top: 2px solid #111; padding-top: 12px; font-size: 13px; }
    .totals-row { display: flex; justify-content: space-between; padding: 4px 0; }
    .grand-total { font-size: 16px; font-weight: 800; color: #c89a8b; border-top: 1px solid #ddd; padding-top: 8px; margin-top: 8px; }
    .actions { display: flex; gap: 12px; margin-top: 28px; border-top: 1px solid #eee; padding-top: 20px; }
    .btn { background: #111; color: #fff; border: none; padding: 10px 20px; border-radius: 99px; font-weight: bold; cursor: pointer; font-size: 13px; }
    @media print { body { padding: 0; background: #fff; } .invoice-card { border: none; box-shadow: none; padding: 0; } .actions { display: none !important; } }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="header">
      <div>
        <div class="company-title">${storeName}</div>
        <div style="font-size: 12px; color: #666;">${esc(s.invoice?.companyAddress || s.contact?.address || '')}</div>
        <div style="font-size: 12px; color: #666;">هاتف: ${esc(s.invoice?.companyPhone || s.contact?.phone || '')}</div>
      </div>
      <div style="text-align: left;">
        <div style="font-size: 20px; font-weight: bold;">فاتورة شراء</div>
        <div style="font-size: 14px; font-family: monospace; color: #333;">${esc(order.orderNumber)}</div>
        <div style="font-size: 12px; color: #555;">رقم الفاتورة: ${invoiceNo}</div>
        <div style="font-size: 11px; color: #888;">${esc(order.createdAt ? new Date(order.createdAt).toLocaleDateString('ar-EG') : '')}</div>
      </div>
    </div>

    <div class="meta-box">
      <div>
        <strong>العميل:</strong> ${customerName}<br/>
        <strong>الهاتف:</strong> ${customerPhone}<br/>
        <strong>البريد:</strong> ${customerEmail}<br/>
        <strong>ملاحظات التوصيل:</strong> ${esc(a.notes || '—')}
      </div>
      <div>
        <strong>الدولة:</strong> ${countryBadge}<br/>
        <strong>المحافظة / الإمارة:</strong> ${esc(a.gov || '—')}<br/>
        <strong>العنوان:</strong> ${fullAddr || '—'}<br/>
        <strong>طريقة الدفع:</strong> ${esc(paymentLabel(order.paymentMethod))}<br/>
        <strong>حالة الدفع:</strong> ${esc(paymentStatusLabel(order.paymentStatus))}<br/>
        <strong>العملة:</strong> ${currency} / ${sym}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>الصنف</th>
          <th style="text-align:center;">الكمية</th>
          <th style="text-align:left;">سعر الوحدة</th>
          <th style="text-align:left;">الإجمالي</th>
        </tr>
      </thead>
      <tbody>${itemsRows}</tbody>
    </table>

    <div class="totals">
      <div class="totals-row"><span>مجموع المنتجات:</span><span>${esc(order.subtotal)} ${sym}</span></div>
      ${Number(order.couponDiscount) > 0 ? `<div class="totals-row" style="color:green;"><span>الخصم:</span><span>− ${esc(order.couponDiscount)} ${sym}</span></div>` : ''}
      <div class="totals-row"><span>الشحن:</span><span>${Number(order.shippingCost) === 0 ? 'مجاني' : `${esc(order.shippingCost)} ${sym}`}</span></div>
      ${Number(order.tax) > 0 ? `<div class="totals-row"><span>الضريبة:</span><span>${esc(order.tax)} ${sym}</span></div>` : ''}
      <div class="totals-row grand-total"><span>الإجمالي النهائي:</span><span>${esc(order.total)} ${sym}</span></div>
    </div>

    <div style="margin-top: 24px; text-align: center;">
      <img src="${qrSvgDataUri(String(order.orderNumber || '') + ' ' + String(order.id || ''))}" alt="QR" style="width: 100px; height: 100px;" />
    </div>

    <div class="actions">
      <button class="btn" onclick="window.print()">طباعة الفاتورة / حفظ PDF</button>
    </div>
  </div>
</body>
</html>`;
}

export function waybillHtml(order, s = {}) {
  const addr = order.shippingAddress || {};
  const a = addressParts(addr);
  const fin = order.financialSnapshot || {};
  const isCod = String(order.paymentMethod).toLowerCase() === 'cod';
  const isAe = fin.country === 'AE' || addr.countryCode === 'AE';
  const sym = esc(fin.currencySymbol || (isAe ? 'د.إ' : 'ج.م'));
  const countryName = isAe ? 'الإمارات العربية المتحدة 🇦🇪' : 'جمهورية مصر العربية 🇪🇬';
  const itemsList = (order.items || []).map((i) => `<li>${esc(i.name)} (×${esc(i.quantity)})</li>`).join('');
  const storeName = esc(s.siteNameAr || 'الزينة — AL-ZEINA');
  const fullAddress = [
    a.street,
    a.building ? `مبنى ${a.building}` : null,
    a.floor ? `طابق ${a.floor}` : null,
    a.apartment ? `شقة ${a.apartment}` : null,
    a.district,
    a.city,
    a.gov
  ].filter(Boolean).map(esc).join('، ');

  const payBlock = isCod
    ? `<div class="payment-badge cod-badge">الدفع عند الاستلام — المطلوب تحصيله: ${esc(order.total)} ${sym}</div>`
    : `<div class="payment-badge prepaid-badge">مدفوع مسبقًا — لا يتم تحصيل مبلغ عند التسليم</div>`;

  return `<!doctype html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>بوليصة شحن ${esc(order.orderNumber)}</title>
  <style>
    @page { size: A4; margin: 10mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 16px; background: #f4f4f4; color: #111; }
    .label-card { max-width: 720px; margin: 0 auto; background: #fff; border: 2px solid #111; border-radius: 12px; padding: 24px; }
    .top-bar { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 16px; }
    .store-name { font-size: 20px; font-weight: 800; }
    .order-num { font-size: 22px; font-weight: 900; font-family: monospace; letter-spacing: 1px; }
    .payment-badge { display: block; text-align: center; font-size: 16px; font-weight: 800; padding: 12px; border-radius: 8px; margin-bottom: 16px; }
    .cod-badge { background: #fef2f2; color: #991b1b; border: 2px solid #f87171; }
    .prepaid-badge { background: #f0fdf4; color: #166534; border: 2px solid #4ade80; }
    .recipient-box { background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 16px; margin-bottom: 16px; font-size: 14px; line-height: 1.7; }
    .recipient-name { font-size: 18px; font-weight: 800; margin-bottom: 4px; }
    .phone { font-size: 18px; font-weight: 800; direction: ltr; display: inline-block; font-family: monospace; }
    .items-box { font-size: 13px; color: #334155; border-top: 1px dashed #ccc; padding-top: 12px; }
    .actions { margin-top: 20px; text-align: center; }
    .btn { background: #111; color: #fff; border: none; padding: 10px 24px; border-radius: 99px; font-weight: bold; cursor: pointer; font-size: 14px; }
    @media print { body { padding: 0; background: #fff; } .actions { display: none !important; } .label-card { border: 2px solid #000; max-width: 100%; } }
  </style>
</head>
<body>
  <div class="label-card">
    <div class="top-bar">
      <div>
        <div class="store-name">${storeName}</div>
        <div style="font-size:12px;color:#666;">هاتف المتجر: ${esc(s.contact?.phone || '—')}</div>
      </div>
      <div style="text-align:left;">
        <div style="font-size:12px;color:#666;">بوليصة شحن</div>
        <div class="order-num">${esc(order.orderNumber)}</div>
        <div style="font-size:12px;">حالة الدفع: ${esc(paymentStatusLabel(order.paymentStatus))}</div>
      </div>
    </div>
    ${payBlock}
    <div class="recipient-box">
      <div class="recipient-name">${esc(addr.name || order.customerName || order.user?.name || 'عميل المتجر')}</div>
      <div>هاتف المستلم: <span class="phone">${esc(addr.phone || order.customerPhone || order.guestPhone || '—')}</span></div>
      <div>الدولة: <strong>${countryName}</strong></div>
      <div>المحافظة / الإمارة: <strong>${esc(a.gov || '—')}</strong></div>
      <div>المدينة: <strong>${esc(a.city || '—')}</strong> — الحي: <strong>${esc(a.district || '—')}</strong></div>
      <div style="margin-top:6px;">العنوان: ${fullAddress || '—'}</div>
      ${a.notes ? `<div style="margin-top:6px;color:#b45309;">ملاحظات التوصيل: ${esc(a.notes)}</div>` : ''}
    </div>
    <div class="items-box">
      <strong>محتويات الشحنة (${esc((order.items || []).length)} صنف):</strong>
      <ul style="margin:4px 0 0;padding-right:20px;">${itemsList}</ul>
      ${order.trackingNumber ? `<p style="margin-top:8px;font-weight:bold;">رقم التتبع: ${esc(order.trackingNumber)}</p>` : ''}
    </div>
    <div class="actions">
      <button class="btn" onclick="window.print()">طباعة بوليصة الشحن</button>
    </div>
  </div>
</body>
</html>`;
}
