import { Link, Navigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiCheck, FiClock, FiCopy, FiPackage, FiShoppingBag } from 'react-icons/fi';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import { useI18n, registerExtraTranslations } from '@/i18n';
import { paymentTranslations } from '@/i18n/paymentTranslations';
import { formatDate, formatPrice } from '@/utils/format';
import { ORDER_STATUS_META } from '@/utils/constants';
import WhatsAppOrderButton from '@/components/common/WhatsAppOrderButton';

import SmartImage from '@/components/ui/SmartImage';

registerExtraTranslations('payments', paymentTranslations);

export default function OrderSuccess() {
  const { t, lang } = useI18n();
  const { state } = useLocation();
  const order = state?.order;

  if (!order) return <Navigate to="/" replace />;

  const statusMeta = ORDER_STATUS_META[order.orderStatus] || ORDER_STATUS_META.pending;
  /* دفع يدوي / غير COD: الطلب قيد مراجعة الدفع والتأكيد (ينطبق على كلا البلدين) */
  const isNonCod = String(order.paymentMethod || '').toLowerCase() !== 'cod';
  const awaitingVerification = isNonCod;

  return (
    <div className="container-x py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-2xl"
      >
        <div className="rounded-2xl border border-black/5 bg-white p-8 text-center shadow-soft">
          {awaitingVerification ? (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 12, delay: 0.15 }}
              className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-sky-100 text-sky-600"
            >
              <FiClock size={38} strokeWidth={2.4} />
            </motion.span>
          ) : (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 12, delay: 0.15 }}
              className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-emerald-600"
            >
              <FiCheck size={38} strokeWidth={3} />
            </motion.span>
          )}

          <h1 className="text-2xl font-bold text-ink md:text-3xl">
            {awaitingVerification ? t('payment.underReview') : t('checkout.success')}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
            {awaitingVerification ? t('payment.underReviewDesc') : t('checkout.successDesc')}
          </p>

          <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-3 rounded-xl bg-cream px-5 py-3">
            <span className="text-xs text-ink-muted">{t('checkout.orderNumber')}:</span>
            <span className="font-en text-base font-bold text-ink">{order.orderNumber}</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(order.orderNumber);
                toast.success(t('common.copied'));
              }}
              className="rounded-lg p-1.5 text-ink-muted transition hover:bg-white hover:text-rose"
              aria-label={t('common.copy')}
            >
              <FiCopy size={14} />
            </button>
          </div>

          <div className="mt-6 grid gap-3 text-start sm:grid-cols-2">
            {[
              { label: t('orders.orderDate'), value: formatDate(order.createdAt, lang, true) },
              { label: t('common.status'), value: statusMeta[lang] },
              { label: t('orders.paymentMethod'), value: t(`checkout.${order.paymentMethod}`) },
              { label: t('cart.total'), value: formatPrice(order.total, lang) },
            ].map((row) => (
              <div key={row.label} className="rounded-xl border border-black/5 p-3">
                <p className="text-[11px] text-ink-muted">{row.label}</p>
                <p className="mt-0.5 text-sm font-bold text-ink">{row.value}</p>
              </div>
            ))}
          </div>

          {order.items?.length ? (
            <ul className="mt-6 divide-y divide-black/5 text-start">
              {order.items.map((item) => (
                <li key={item._id} className="flex items-center gap-3 py-3">
                  <SmartImage
                    src={item.product?.mainImage || item.image}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="clamp-1 text-sm font-semibold text-ink">{item.name}</p>
                    <p className="text-xs text-ink-muted">× {item.quantity}</p>
                  </div>
                  <span className="text-sm font-bold text-ink">{formatPrice(item.total || item.price * item.quantity, lang)}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {awaitingVerification ? (
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button to="/orders" icon={FiPackage}>
                {t('orders.title')}
              </Button>
              <WhatsAppOrderButton orderNumber={order.orderNumber} order={order} size="lg" />
              <Button to="/shop" variant="outline" icon={FiShoppingBag}>
                {t('cart.continueShopping')}
              </Button>
            </div>
          ) : (
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button to="/orders" icon={FiPackage}>
                {t('orders.title')}
              </Button>
              <Button to="/shop" variant="outline" icon={FiShoppingBag}>
                {t('cart.continueShopping')}
              </Button>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-ink-muted">
          {t('contact.subtitle')} —{' '}
          <Link to="/contact" className="font-semibold text-rose hover:underline">
            {t('footer.contactUs')}
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
