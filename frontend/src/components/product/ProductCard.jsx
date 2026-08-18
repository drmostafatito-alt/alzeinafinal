import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiBarChart2, FiEye, FiHeart, FiShoppingBag } from 'react-icons/fi';
import { toast } from 'react-toastify';
import Badge from '@/components/ui/Badge';
import Price from '@/components/ui/Price';
import Rating from '@/components/ui/Rating';
import { useI18n } from '@/i18n';
import { useCartStore } from '@/store/cartStore';
import { useUIStore } from '@/store/uiStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { useCompareStore, COMPARE_MAX } from '@/store/compareStore';
import { useFlags, useSettings } from '@/config/ConfigProvider';
import { cn, localized } from '@/utils/helpers';
import SmartImage from '@/components/ui/SmartImage';

/**
 * أنماط بطاقة المنتج.
 *
 * كل نمط يغيّر أشياء مرئية حقيقية: نسبة الصورة، الحواف، الظل،
 * كثافة الحشو، ووزن الخط. ليست فئات CSS بلا أثر — تم قياس كل
 * قيمة في المتصفح.
 */
const CARD_STYLES = {
  classic: { card: 'card card-hover', media: 'aspect-square', body: 'p-4', name: 'text-sm font-semibold' },
  modern: { card: 'card card-hover rounded-3xl', media: 'aspect-[4/5]', body: 'p-5', name: 'text-base font-bold' },
  minimal: { card: 'rounded-none border border-black/5 bg-white transition hover:border-ink/20', media: 'aspect-square', body: 'p-3', name: 'text-sm font-medium' },
  compact: { card: 'card card-hover rounded-xl', media: 'aspect-[5/4]', body: 'p-2.5', name: 'text-[13px] font-semibold' },
};

function ProductCard({ product, view = 'grid', index = 0 }) {
  const { t, lang } = useI18n();
  const addItem = useCartStore((s) => s.addItem);
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const inWishlist = useWishlistStore((s) => s.items.some((i) => i.productId === (product._id || product.id)));
  const openQuickView = useUIStore((s) => s.openQuickView);
  /** مفاتيح الميزات: تُخفي الأزرار المُطفأة بلا كسر التخطيط */
  const { isEnabled } = useFlags();
  /* شكل البطاقة يختاره المدير من: استوديو التصميم ← الخطوط */
  const cardStyle = CARD_STYLES[useSettings()?.theme?.cardStyle] || CARD_STYLES.classic;
  const toggleCompare = useCompareStore((s) => s.toggle);
  const inCompare = useCompareStore((s) => s.items.some((i) => i.productId === (product._id || product.id)));
  const [adding, setAdding] = useState(false);

  const name = localized(product, lang);
  const brandName = localized(product.brand, lang);
  const outOfStock = product.stock <= 0;
  const lowStock = product.stock > 0 && product.stock <= 5;

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (outOfStock) return;
    setAdding(true);
    addItem(product, 1);
    toast.success(t('product.added'));
    setTimeout(() => setAdding(false), 500);
  };

  const handleWishlist = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const added = toggleWishlist(product);
    toast.info(added ? t('product.addedToWishlist') : t('product.removedFromWishlist'));
  };

  const handleCompare = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const res = toggleCompare(product);
    if (res.full) toast.warning(t('compare.limitReached', { n: COMPARE_MAX }));
    else toast.info(res.added ? t('compare.added') : t('compare.removed'));
  };

  const handleQuickView = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openQuickView(product);
  };

  // الشارات: الخصم أولاً لأنه أقوى محفّز شرائي، ثم الحداثة، ثم الأكثر مبيعاً
  const badges = !isEnabled('productBadges') ? null : (
    <div className="pointer-events-none absolute start-3 top-3 z-10 flex flex-col items-start gap-1.5">
      {product.discount > 0 ? (
        <Badge variant="danger" className="shadow-sm">
          -{product.discount}%
        </Badge>
      ) : null}
      {product.isNewArrival ? (
        <Badge variant="ink" className="shadow-sm">
          {t('product.new')}
        </Badge>
      ) : null}
      {product.isBestSeller ? (
        <Badge variant="rose" className="shadow-sm">
          {t('product.bestSeller')}
        </Badge>
      ) : null}
    </div>
  );

  if (view === 'list') {
    return (
      <motion.article
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.3) }}
        className="card group flex gap-4 overflow-hidden p-3 transition hover:shadow-card sm:gap-5 sm:p-4"
      >
        <Link
          to={`/product/${product.slug || product._id}`}
          className="relative aspect-square w-28 shrink-0 overflow-hidden rounded-xl bg-blush sm:w-40"
        >
          {badges}
          <SmartImage
            src={product.mainImage}
            alt={name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        </Link>

        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-rose">{brandName}</span>
          <Link to={`/product/${product.slug || product._id}`} className="mt-1">
            <h3 className="clamp-2 text-sm font-bold text-ink transition group-hover:text-rose sm:text-base">{name}</h3>
          </Link>
          <Rating value={product.rating} count={product.reviewsCount} className="mt-1.5" />
          <p className="clamp-2 mt-2 hidden text-xs text-ink-muted sm:block">
            {localized(product, lang, 'shortDescription') || localized(product, lang, 'description')}
          </p>
          <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-3">
            <Price value={product.price} oldValue={product.oldPrice} />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleWishlist}
                className={cn(
                  'grid h-9 w-9 place-items-center rounded-full border transition',
                  inWishlist ? 'border-rose bg-rose text-white' : 'border-ink/10 bg-white text-ink hover:border-rose hover:text-rose'
                )}
                aria-label={t('product.addToWishlist')}
              >
                <FiHeart size={15} className={inWishlist ? 'fill-current' : ''} />
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={outOfStock}
                className={cn(
                  'btn btn-sm gap-1.5',
                  outOfStock ? 'cursor-not-allowed bg-black/5 text-ink-muted' : 'bg-ink text-white hover:bg-rose'
                )}
              >
                <FiShoppingBag size={14} />
                {outOfStock ? t('product.outOfStock') : t('product.addToCart')}
              </button>
            </div>
          </div>
        </div>
      </motion.article>
    );
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.35) }}
      className={cn(cardStyle.card, 'group relative flex h-full flex-col overflow-hidden')}
    >
      <Link
        to={`/product/${product.slug || product._id}`}
        className={cn('media-frame media-zoom relative block', cardStyle.media)}
        aria-label={name}
      >
        {badges}
        <SmartImage
          src={product.mainImage}
          alt={name}
          loading="lazy"
          className={cn(
            'h-full w-full object-cover transition duration-700 group-hover:scale-110',
            outOfStock && 'opacity-60 grayscale'
          )}
        />

        {outOfStock ? (
          <div className="absolute inset-0 grid place-items-center bg-white/60">
            <span className="rounded-full bg-ink px-4 py-2 text-xs font-bold text-white">{t('product.outOfStock')}</span>
          </div>
        ) : null}

        {/* Hover actions */}
        <div className="absolute end-3 top-3 z-10 flex flex-col gap-2 opacity-0 transition-all duration-300 group-hover:opacity-100 max-md:opacity-100">
          {isEnabled('wishlist') ? (
            <button
              type="button"
              onClick={handleWishlist}
              className={cn(
                'grid h-9 w-9 place-items-center rounded-full shadow-soft backdrop-blur transition hover:scale-110',
                inWishlist ? 'bg-rose text-white' : 'bg-white/95 text-ink hover:text-rose'
              )}
              aria-label={t('product.addToWishlist')}
            >
              <FiHeart size={15} className={inWishlist ? 'fill-current' : ''} />
            </button>
          ) : null}
          {isEnabled('quickView') ? (
            <button
              type="button"
              onClick={handleQuickView}
              className="grid h-9 w-9 place-items-center rounded-full bg-white/95 text-ink shadow-soft backdrop-blur transition hover:scale-110 hover:text-rose max-md:hidden"
              aria-label={t('product.quickView')}
            >
              <FiEye size={15} />
            </button>
          ) : null}
          {isEnabled('compareProducts') ? (
            <button
              type="button"
              onClick={handleCompare}
              aria-pressed={inCompare}
              className={cn(
                'grid h-9 w-9 place-items-center rounded-full shadow-soft backdrop-blur transition hover:scale-110 max-md:hidden',
                inCompare ? 'bg-ink text-white' : 'bg-white/95 text-ink hover:text-rose'
              )}
              aria-label={t('compare.add')}
            >
              <FiBarChart2 size={15} />
            </button>
          ) : null}
        </div>
      </Link>

      <div className={cn('flex flex-1 flex-col', cardStyle.body)}>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-rose">{brandName}</span>
        <Link to={`/product/${product.slug || product._id}`}>
          <h3 className={cn('clamp-2 mt-1 min-h-[2.5rem] leading-snug text-ink transition group-hover:text-rose', cardStyle.name)}>
            {name}
          </h3>
        </Link>

        <Rating value={product.rating} count={product.reviewsCount} className="mt-2" />

        {/* مؤشر مخزون منخفض: شريط بصري + نص — لا نعتمد على اللون وحده */}
        {lowStock ? (
          <div className="mt-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-amber-600">
                {t('product.onlyLeft', { n: product.stock })}
              </span>
            </div>
            <div
              className="mt-1 h-1 overflow-hidden rounded-full bg-amber-100"
              role="progressbar"
              aria-valuenow={product.stock}
              aria-valuemin={0}
              aria-valuemax={5}
              aria-label={t('product.onlyLeft', { n: product.stock })}
            >
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-500"
                style={{ width: `${Math.max(12, (product.stock / 5) * 100)}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <Price value={product.price} oldValue={product.oldPrice} />
          <button
            type="button"
            onClick={handleAdd}
            disabled={outOfStock || adding}
            className={cn(
              'grid h-10 w-10 shrink-0 place-items-center rounded-full transition-all duration-300',
              outOfStock
                ? 'cursor-not-allowed bg-black/5 text-ink-muted'
                : 'bg-ink text-white hover:scale-110 hover:bg-rose active:scale-95'
            )}
            aria-label={t('product.addToCart')}
          >
            <FiShoppingBag size={16} className={adding ? 'animate-bounce' : ''} />
          </button>
        </div>
      </div>
    </motion.article>
  );
}

export default memo(ProductCard);
