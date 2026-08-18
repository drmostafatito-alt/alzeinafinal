import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiShoppingBag, FiTag, FiTrash2, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/common/PageHeader';
import QuantitySelector from '@/components/ui/QuantitySelector';
import { ConfirmDialog } from '@/components/ui/Modal';
import { couponService } from '@/services';
import { useI18n } from '@/i18n';
import { useCartStore } from '@/store/cartStore';
import { formatPrice } from '@/utils/format';
import { localized } from '@/utils/helpers';
import { SHIPPING } from '@/utils/constants';
import SmartImage from '@/components/ui/SmartImage';

export default function Cart() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();

  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clear = useCartStore((s) => s.clear);
  const coupon = useCartStore((s) => s.coupon);
  const applyCoupon = useCartStore((s) => s.applyCoupon);
  const removeCoupon = useCartStore((s) => s.removeCoupon);
  const subtotal = useCartStore((s) => s.subtotal());
  const couponDiscount = useCartStore((s) => s.couponDiscount());
  const shippingCost = useCartStore((s) => s.shippingCost());
  const total = useCartStore((s) => s.total());
  const savings = useCartStore((s) => s.savings());
  const freeLeft = useCartStore((s) => s.freeShippingRemaining());

  const [code, setCode] = useState('');
  const [applying, setApplying] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleCoupon = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setApplying(true);
    try {
      const { data } = await couponService.validate(code.trim().toUpperCase());
      if (data.isValid && data.coupon) {
        if (data.coupon.minOrderAmount && subtotal < data.coupon.minOrderAmount) {
          toast.error(
            `${t('cart.couponInvalid')} — ${t('shop.minPrice')} ${formatPrice(data.coupon.minOrderAmount, lang)}`
          );
          return;
        }
        applyCoupon(data.coupon);
        toast.success(t('cart.couponApplied'));
        setCode('');
      } else {
        toast.error(t('cart.couponInvalid'));
      }
    } catch {
      toast.error(t('cart.couponInvalid'));
    } finally {
      setApplying(false);
    }
  };

  if (!items.length) {
    return (
      <>
        <PageHeader title={t('cart.title')} breadcrumbs={[{ label: t('cart.title') }]} />
        <div className="container-x py-10">
          <div className="rounded-2xl border border-black/5 bg-white shadow-soft">
            <EmptyState
              icon={FiShoppingBag}
              title={t('cart.empty')}
              description={t('cart.emptyDesc')}
              actionLabel={t('cart.startShopping')}
              actionTo="/shop"
            />
          </div>
        </div>
      </>
    );
  }

  const progress = Math.min(100, (subtotal / SHIPPING.freeThreshold) * 100);

  return (
    <>
      <PageHeader
        title={t('cart.title')}
        subtitle={`${items.length} ${items.length === 1 ? t('cart.item') : t('cart.items')}`}
        breadcrumbs={[{ label: t('cart.title') }]}
      />

      <div className="container-x py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Items */}
          <div className="lg:col-span-2">
            {/* Free shipping bar */}
            <div className="mb-5 rounded-2xl border border-black/5 bg-white p-4 shadow-soft">
              <p className="mb-2 text-sm font-semibold text-ink">
                {freeLeft > 0
                  ? t('cart.freeShippingLeft', { amount: formatPrice(freeLeft, lang) })
                  : t('cart.freeShippingEarned')}
              </p>
              <div className="h-2 overflow-hidden rounded-full bg-blush">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rose-300 to-rose transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <ul className="space-y-3">
              {items.map((item) => (
                <li key={item.key} className="rounded-2xl border border-black/5 bg-white p-4 shadow-soft">
                  <div className="flex gap-4">
                    <Link
                      to={`/product/${item.slug || item.productId}`}
                      className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-blush sm:h-28 sm:w-28"
                    >
                      <SmartImage src={item.image} alt="" className="h-full w-full object-cover" />
                    </Link>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link to={`/product/${item.slug || item.productId}`}>
                            <p className="clamp-2 text-sm font-bold text-ink transition hover:text-rose">
                              {localized(item, lang)}
                            </p>
                          </Link>
                          {item.variant ? <p className="mt-0.5 text-xs text-ink-muted">{item.variant}</p> : null}
                          <p className="mt-0.5 text-[11px] text-ink-muted">{item.sku}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            removeItem(item.key);
                            toast.info(t('cart.removed'));
                          }}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-muted transition hover:bg-red-50 hover:text-red-600"
                          aria-label={t('cart.remove')}
                        >
                          <FiTrash2 size={15} />
                        </button>
                      </div>

                      <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-3">
                        <QuantitySelector
                          value={item.quantity}
                          onChange={(q) => updateQuantity(item.key, q)}
                          max={item.stock || 99}
                        />
                        <div className="text-end">
                          {item.oldPrice && item.oldPrice > item.price ? (
                            <p className="text-[11px] text-ink-muted line-through">
                              {formatPrice(item.oldPrice * item.quantity, lang)}
                            </p>
                          ) : null}
                          <p className="text-base font-bold text-ink">
                            {formatPrice(item.price * item.quantity, lang)}
                          </p>
                          <p className="text-[11px] text-ink-muted">
                            {formatPrice(item.price, lang)} × {item.quantity}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="outline" to="/shop">
                {t('cart.continueShopping')}
              </Button>
              <Button variant="ghost" onClick={() => setConfirmClear(true)} icon={FiTrash2} className="text-red-600 hover:bg-red-50">
                {t('cart.clear')}
              </Button>
            </div>
          </div>

          {/* Summary */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
              <h3 className="mb-5 text-lg font-bold text-ink">{t('cart.orderSummary')}</h3>

              {/* Coupon */}
              {coupon ? (
                <div className="mb-5 flex items-center justify-between gap-2 rounded-xl bg-emerald-50 p-3">
                  <span className="flex min-w-0 items-center gap-2 text-xs font-bold text-emerald-700">
                    <FiTag size={14} className="shrink-0" />
                    <span className="clamp-1">{coupon.code}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      removeCoupon();
                      toast.info(t('cart.couponRemoved'));
                    }}
                    className="shrink-0 rounded-full p-1 text-emerald-700 transition hover:bg-emerald-100"
                    aria-label="remove coupon"
                  >
                    <FiX size={14} />
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCoupon} className="mb-5 flex gap-2">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder={t('cart.couponPlaceholder')}
                    className="input py-2.5 text-xs uppercase"
                  />
                  <Button type="submit" size="sm" loading={applying} className="shrink-0">
                    {t('cart.applyCoupon')}
                  </Button>
                </form>
              )}

              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-muted">{t('cart.subtotal')}</dt>
                  <dd className="font-semibold text-ink">{formatPrice(subtotal, lang)}</dd>
                </div>
                {savings > 0 ? (
                  <div className="flex justify-between text-emerald-600">
                    <dt>{t('product.save')}</dt>
                    <dd className="font-semibold">− {formatPrice(savings, lang)}</dd>
                  </div>
                ) : null}
                {couponDiscount > 0 ? (
                  <div className="flex justify-between text-emerald-600">
                    <dt>{t('cart.discount')}</dt>
                    <dd className="font-semibold">− {formatPrice(couponDiscount, lang)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt className="text-ink-muted">{t('cart.shipping')}</dt>
                  <dd className="font-semibold text-ink">
                    {shippingCost === 0 ? (
                      <span className="text-emerald-600">{t('common.free')}</span>
                    ) : (
                      formatPrice(shippingCost, lang)
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between border-t border-black/5 pt-3">
                  <dt className="text-base font-bold text-ink">{t('cart.total')}</dt>
                  <dd className="text-xl font-bold text-rose">{formatPrice(total, lang)}</dd>
                </div>
              </dl>

              <Button onClick={() => navigate('/checkout')} size="lg" fullWidth className="mt-6">
                {t('cart.checkout')}
              </Button>

              <p className="mt-4 text-center text-[11px] leading-relaxed text-ink-muted">
                {t('home.features.returnsDesc')} • {t('home.features.originalDesc')}
              </p>
            </div>
          </aside>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => {
          clear();
          toast.info(t('cart.cleared'));
        }}
        title={t('cart.clear')}
        message={t('admin.confirmDelete')}
        confirmText={t('common.confirm')}
        cancelText={t('common.cancel')}
        danger
      />
    </>
  );
}
