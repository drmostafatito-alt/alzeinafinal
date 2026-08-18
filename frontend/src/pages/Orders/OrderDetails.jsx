import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FiAlertTriangle, FiCheck, FiClock, FiFileText, FiMapPin, FiPackage, FiRotateCcw, FiShield, FiTruck } from 'react-icons/fi';
import { toast } from 'react-toastify';
import client from '@/api/client';
import { useConfig } from '@/config/ConfigProvider';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/common/PageHeader';
import { PageSpinner } from '@/components/ui/Spinner';
import { orderService } from '@/services';
import { registerExtraTranslations, useI18n } from '@/i18n';
import { paymentTranslations } from '@/i18n/paymentTranslations';
import WhatsAppOrderButton from '@/components/common/WhatsAppOrderButton';
import ReceiptResubmit from '@/components/checkout/ReceiptResubmit';

registerExtraTranslations('payments', paymentTranslations);
import { formatDate, formatPrice } from '@/utils/format';
import { ORDER_STATUS_FLOW, ORDER_STATUS_META, PAYMENT_STATUS_META } from '@/utils/constants';
import { cn } from '@/utils/helpers';
import NotFound from '@/pages/NotFound';
import SmartImage from '@/components/ui/SmartImage';

export default function OrderDetails() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const { settings } = useConfig();
  const qc = useQueryClient();
  const invoiceAllowed = settings.invoice?.customerDownload !== false;

  /** يفتح الفاتورة بتوكن المصادقة في تبويب جديد */
  const downloadInvoice = async () => {
    try {
      const res = await client.get(`/orders/${id}/invoice`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      toast.error(e?.response?.data?.message || t('common.error'));
    }
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['order', id],
    queryFn: () => orderService.byId(id),
  });
  const order = data?.data?.order;

  /* آخر مراجعة دفع يدوي لهذا الطلب (مصدر حالة العميل) */
  const { data: verificationData, refetch: refetchVerification } = useQuery({
    queryKey: ['order-verification', id],
    queryFn: () => client.get(`/orders/${id}/verification`).then((r) => r.data?.data?.verification || null),
    enabled: Boolean(id)
  });
  const verification = verificationData ?? null;
  const manualMethod = order && String(order.paymentMethod || '').toLowerCase() !== 'cod';

  if (isLoading) return <PageSpinner label={t('common.loading')} />;
  if (isError || !order) return <NotFound />;

  const meta = ORDER_STATUS_META[order.orderStatus] || ORDER_STATUS_META.pending;
  const payMeta = PAYMENT_STATUS_META[order.paymentStatus] || PAYMENT_STATUS_META.pending;
  const cancelled = ['cancelled', 'returned'].includes(order.orderStatus);
  const currentStep = ORDER_STATUS_FLOW.indexOf(order.orderStatus);

  const addr = order.shippingAddress || {};

  return (
    <>
      <PageHeader
        title={`${t('orders.orderNumber')} ${order.orderNumber}`}
        subtitle={formatDate(order.createdAt, lang, true)}
        breadcrumbs={[{ to: '/orders', label: t('orders.title') }, { label: order.orderNumber }]}
      >
        <Badge className={meta.color}>{meta[lang]}</Badge>
      </PageHeader>

      <div className="container-x py-8">
        {/* لوحة حالة الدفع اليدوي — لا تعرض نجاحاً كاذباً قبل موافقة الأدمن */}
        {manualMethod ? (
          <div className="mb-6">
            {verification?.status === 'pending' || (order.paymentStatus === 'awaiting-verification' && !verification) ? (
              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sky-100 text-sky-600">
                    <FiClock size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-sky-800">{t('payment.underReview')}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-sky-700">{t('payment.underReviewDesc')}</p>
                  </div>
                  <WhatsAppOrderButton orderNumber={order.orderNumber} />
                </div>
              </div>
            ) : null}

            {verification?.status === 'approved' ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                    <FiShield size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-emerald-800">{t('payment.paymentConfirmed')}</p>
                  </div>
                </div>
              </div>
            ) : null}

            {verification?.status === 'rejected' ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                <div className="flex flex-wrap items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-red-100 text-red-600">
                    <FiAlertTriangle size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-red-800">{t('payment.paymentRejected')}</p>
                    {verification.adminNote ? (
                      <p className="mt-1 text-xs leading-relaxed text-red-700">
                        {t('payment.rejectionReason')}: {verification.adminNote}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-red-600">{t('payment.resubmitHint')}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <ReceiptResubmit
                    orderId={order._id}
                    className="w-full sm:w-96"
                    onSuccess={() => {
                      refetchVerification();
                      qc.invalidateQueries({ queryKey: ['order', id] });
                    }}
                  />
                  <WhatsAppOrderButton orderNumber={order.orderNumber} className="self-start" />
                </div>
              </div>
            ) : null}

            {/* دفع يدوي بلا إيصال بعد: ارفعيه من هنا */}
            {!verification && manualMethod && order.paymentStatus !== 'awaiting-verification' && !['paid'].includes(order.paymentStatus) ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <p className="text-sm font-bold text-amber-800">{t('payment.uploadNewReceipt')}</p>
                <p className="mt-1 text-xs text-amber-700">{t('payment.receiptReceivedDesc')}</p>
                <ReceiptResubmit
                  orderId={order._id}
                  className="mt-4 w-full sm:w-96"
                  onSuccess={() => {
                    refetchVerification();
                    qc.invalidateQueries({ queryKey: ['order', id] });
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Tracking */}
            {!cancelled ? (
              <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
                <h3 className="mb-6 flex items-center gap-2 text-base font-bold text-ink">
                  <FiTruck className="text-rose" /> {t('orders.tracking')}
                </h3>
                <ol className="relative flex justify-between">
                  <span className="absolute inset-x-0 top-4 -z-0 h-0.5 bg-black/8" />
                  <span
                    className="absolute top-4 -z-0 h-0.5 bg-rose transition-all duration-700 ltr:left-0 rtl:right-0"
                    style={{ width: `${(Math.max(0, currentStep) / (ORDER_STATUS_FLOW.length - 1)) * 100}%` }}
                  />
                  {ORDER_STATUS_FLOW.map((s, i) => {
                    const done = i <= currentStep;
                    return (
                      <li key={s} className="relative z-10 flex flex-1 flex-col items-center gap-2">
                        <span
                          className={cn(
                            'grid h-8 w-8 place-items-center rounded-full border-2 bg-white transition',
                            done ? 'border-rose bg-rose text-white' : 'border-black/10 text-ink-muted'
                          )}
                        >
                          {done ? <FiCheck size={14} /> : <span className="text-[11px] font-bold">{i + 1}</span>}
                        </span>
                        <span className={cn('text-center text-[10px] font-semibold', done ? 'text-ink' : 'text-ink-muted')}>
                          {ORDER_STATUS_META[s][lang]}
                        </span>
                      </li>
                    );
                  })}
                </ol>
                {order.trackingNumber ? (
                  <p className="mt-6 rounded-xl bg-cream p-3 text-center text-xs">
                    {t('orders.trackingNumber')}:{' '}
                    <span className="font-en font-bold text-ink">{order.trackingNumber}</span>
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-6">
                <p className="text-sm font-bold text-red-700">{meta[lang]}</p>
                {order.cancellationReason ? (
                  <p className="mt-1 text-xs text-red-600">
                    {t('orders.cancelReason')}: {order.cancellationReason}
                  </p>
                ) : null}
              </div>
            )}

            {/* Items */}
            <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
              <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-ink">
                <FiPackage className="text-rose" /> {t('orders.orderItems')}
              </h3>
              <ul className="divide-y divide-black/5">
                {order.items?.map((item) => (
                  <li key={item._id} className="flex items-center gap-4 py-4">
                    <Link
                      to={`/product/${item.product?.slug || item.product?._id || ''}`}
                      className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-blush"
                    >
                      <SmartImage
                        src={item.product?.mainImage || item.image}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <p className="clamp-2 text-sm font-semibold text-ink">{item.name}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {formatPrice(item.price, lang)} × {item.quantity}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-ink">
                      {formatPrice(item.total || item.price * item.quantity, lang)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
              <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-ink">
                <FiMapPin className="text-rose" /> {t('orders.shippingAddress')}
              </h3>
              <div className="space-y-1 text-sm text-ink-soft">
                {addr.name ? <p className="font-semibold text-ink">{addr.name}</p> : null}
                <p dir="ltr" className="rtl:text-end">
                  {addr.phone}
                </p>
                <p className="leading-relaxed">
                  {[addr.street, addr.district, addr.city, addr.governorate].filter(Boolean).join('، ')}
                </p>
                {addr.buildingNumber || addr.floor || addr.apartment ? (
                  <p className="text-xs text-ink-muted">
                    {[
                      addr.buildingNumber && `${t('checkout.building')}: ${addr.buildingNumber}`,
                      addr.floor && `${t('checkout.floor')}: ${addr.floor}`,
                      addr.apartment && `${t('checkout.apartment')}: ${addr.apartment}`,
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
              <h3 className="mb-4 text-base font-bold text-ink">{t('cart.orderSummary')}</h3>
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-muted">{t('cart.subtotal')}</dt>
                  <dd className="font-semibold">{formatPrice(order.subtotal, lang)}</dd>
                </div>
                {order.couponDiscount > 0 ? (
                  <div className="flex justify-between text-emerald-600">
                    <dt>{t('cart.discount')}</dt>
                    <dd className="font-semibold">− {formatPrice(order.couponDiscount, lang)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt className="text-ink-muted">{t('cart.shipping')}</dt>
                  <dd className="font-semibold">
                    {order.shippingCost === 0 ? (
                      <span className="text-emerald-600">{t('common.free')}</span>
                    ) : (
                      formatPrice(order.shippingCost, lang)
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between border-t border-black/5 pt-3">
                  <dt className="font-bold text-ink">{t('cart.total')}</dt>
                  <dd className="text-lg font-bold text-rose">{formatPrice(order.total, lang)}</dd>
                </div>
              </dl>

              <div className="mt-4 space-y-2 border-t border-black/5 pt-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">{t('orders.paymentMethod')}</span>
                  <span className="font-semibold text-ink">{t(`checkout.${order.paymentMethod}`)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">{t('common.status')}</span>
                  <Badge className={payMeta.color}>{payMeta[lang]}</Badge>
                </div>
              </div>
            </div>

            {invoiceAllowed ? (
              <Button variant="outline" fullWidth icon={FiFileText} onClick={downloadInvoice}>
                {t('admin.invoiceDownload')}
              </Button>
            ) : null}

            {order.orderStatus === 'delivered' ? (
              <Button to={`/returns/new/${order._id}`} variant="rose" fullWidth icon={FiRotateCcw}>
                {t('returns.request')}
              </Button>
            ) : null}

            <Button to="/orders" variant="outline" fullWidth>
              {t('common.back')}
            </Button>
          </aside>
        </div>
      </div>
    </>
  );
}
