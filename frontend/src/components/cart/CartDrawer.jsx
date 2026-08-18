import { Link, useNavigate } from 'react-router-dom';
import { FiShoppingBag, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import Drawer from '@/components/ui/Drawer';
import EmptyState from '@/components/ui/EmptyState';
import QuantitySelector from '@/components/ui/QuantitySelector';
import { useI18n } from '@/i18n';
import { useCartStore } from '@/store/cartStore';
import { useUIStore } from '@/store/uiStore';
import { formatPrice } from '@/utils/format';
import { localized } from '@/utils/helpers';
import SmartImage from '@/components/ui/SmartImage';

export default function CartDrawer() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const open = useUIStore((s) => s.cartDrawerOpen);
  const close = useUIStore((s) => s.closeCartDrawer);

  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const subtotal = useCartStore((s) => s.subtotal());
  const freeLeft = useCartStore((s) => s.freeShippingRemaining());
  // عتبة الشحن المجاني تأتي من إعدادات المتجر لا من ثابت في الكود
  const shippingRules = useCartStore((s) => s.shippingRules);

  const go = (to) => {
    close();
    navigate(to);
  };

  const threshold = shippingRules.freeEnabled ? shippingRules.freeThreshold : 0;
  const progress = threshold > 0 ? Math.min(100, (subtotal / threshold) * 100) : 0;

  return (
    <Drawer
      open={open}
      onClose={close}
      title={`${t('cart.title')} (${items.length})`}
      footer={
        items.length ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-muted">{t('cart.subtotal')}</span>
              <span className="text-lg font-bold text-ink">{formatPrice(subtotal, lang)}</span>
            </div>
            <p className="text-[11px] text-ink-muted">{t('cart.calculatedAtCheckout')}</p>
            <button
              type="button"
              onClick={() => go('/checkout')}
              className="btn w-full bg-ink text-white hover:bg-rose"
            >
              {t('cart.checkout')}
            </button>
            <button
              type="button"
              onClick={() => go('/cart')}
              className="btn w-full border border-ink/15 bg-white text-ink hover:border-rose hover:text-rose"
            >
              {t('cart.title')}
            </button>
          </div>
        ) : null
      }
    >
      {items.length === 0 ? (
        <EmptyState
          icon={FiShoppingBag}
          title={t('cart.empty')}
          description={t('cart.emptyDesc')}
          actionLabel={t('cart.startShopping')}
          onAction={() => go('/shop')}
        />
      ) : (
        <div className="p-4">
          {/* شريط تقدّم الشحن المجاني — يظهر فقط إن كانت الميزة مفعّلة */}
          {threshold > 0 ? (
            <div className="mb-4 rounded-xl bg-cream p-3">
              <p className="mb-2 text-xs font-semibold text-ink">
                {freeLeft > 0
                  ? t('cart.freeShippingLeft', { amount: formatPrice(freeLeft, lang) })
                  : t('cart.freeShippingEarned')}
              </p>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-white"
                role="progressbar"
                aria-valuenow={Math.round(progress)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rose-300 to-rose transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : null}

          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.key} className="flex gap-3 rounded-xl border border-black/5 p-3">
                <Link
                  to={`/product/${item.slug || item.productId}`}
                  onClick={close}
                  className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-blush"
                >
                  <SmartImage
                    src={item.image}
                    alt={localized(item, lang)}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link to={`/product/${item.slug || item.productId}`} onClick={close}>
                    <p className="clamp-2 text-xs font-semibold text-ink hover:text-rose">
                      {localized(item, lang)}
                    </p>
                  </Link>
                  {item.variant ? <p className="mt-0.5 text-[11px] text-ink-muted">{item.variant}</p> : null}
                  <p className="mt-1 text-sm font-bold text-rose">{formatPrice(item.price, lang)}</p>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                    <QuantitySelector
                      value={item.quantity}
                      onChange={(q) => updateQuantity(item.key, q)}
                      max={item.stock || 99}
                      size="sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        removeItem(item.key);
                        toast.info(t('cart.removed'));
                      }}
                      className="grid h-8 w-8 place-items-center rounded-full text-ink-muted transition hover:bg-red-50 hover:text-red-600"
                      aria-label={t('cart.remove')}
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Drawer>
  );
}
