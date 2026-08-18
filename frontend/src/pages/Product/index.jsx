import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  FiAward,
  FiCheck,
  FiCopy,
  FiHeart,
  FiMinus,
  FiRefreshCw,
  FiShare2,
  FiShield,
  FiShoppingBag,
  FiTruck,
} from 'react-icons/fi';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import Badge from '@/components/ui/Badge';
import Breadcrumbs from '@/components/common/Breadcrumbs';
import Button from '@/components/ui/Button';
import Price from '@/components/ui/Price';
import ProductCarousel from '@/components/product/ProductCarousel';
import ProductGallery from '@/components/product/ProductGallery';
import QuantitySelector from '@/components/ui/QuantitySelector';
import Rating from '@/components/ui/Rating';
import SectionHeader from '@/components/ui/SectionHeader';
import Skeleton from '@/components/ui/Skeleton';
import ProductReviews from './ProductReviews';
import { useProduct, useRecentlyViewed, useRelatedProducts } from '@/hooks';
import { useConfig } from '@/config/ConfigProvider';
import { useI18n } from '@/i18n';
import { useCartStore } from '@/store/cartStore';
import { useUIStore } from '@/store/uiStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { formatPrice } from '@/utils/format';
import { cn, localized } from '@/utils/helpers';
import NotFound from '@/pages/NotFound';
import SmartImage from '@/components/ui/SmartImage';

const TABS = ['description', 'ingredients', 'usage', 'benefits'];

/** عتبة "كمية محدودة" — تُطابق افتراضي الخادم (features.lowStockThreshold) */
const LOW_STOCK_THRESHOLD = 5;

export default function ProductPage() {
  const { slug } = useParams();
  const { t, lang } = useI18n();
  const { product, isLoading, isError } = useProduct(slug);
  const { settings, paymentMethods } = useConfig();
  const { products: related } = useRelatedProducts(product?._id, 10);
  const { items: recentItems, add: addRecent } = useRecentlyViewed();

  const addItem = useCartStore((s) => s.addItem);
  const openCart = useUIStore((s) => s.openCartDrawer);
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const inWishlist = useWishlistStore((s) => (product ? s.items.some((i) => i.productId === product._id) : false));

  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [activeTab, setActiveTab] = useState('description');
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [copied, setCopied] = useState(false);
  // يمنع النقر المزدوج ويعطي إحساساً بالاستجابة الفورية
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    setQty(1);
    setActiveImg(0);
    setActiveTab('description');
    setSelectedColor(null);
    setSelectedSize(null);
  }, [product?._id]);

  useEffect(() => {
    if (product) {
      addRecent(product);
      document.title = `${localized(product, lang)} | Al Zeina`;
    }
    return () => {
      document.title = 'Al Zeina | الزينة — متجر الجمال والعناية';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?._id, lang]);

  const images = useMemo(
    () => (product?.images?.length ? product.images : product ? [product.mainImage] : []),
    [product]
  );

  const recentOthers = useMemo(
    () => (recentItems || []).filter((r) => r._id !== product?._id).slice(0, 8),
    [recentItems, product?._id]
  );

  if (isLoading) {
    return (
      <div className="container-x py-10">
        <div className="grid gap-10 lg:grid-cols-2">
          <Skeleton className="aspect-square w-full" rounded="rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-12 w-full" rounded="rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !product) return <NotFound />;

  const name = localized(product, lang);
  const outOfStock = product.stock <= 0;
  const lowStock = product.stock > 0 && product.stock <= 5;
  const savings = product.oldPrice ? product.oldPrice - product.price : 0;

  // كل هذه القيم تأتي من إعدادات لوحة الإدارة لا من ثوابت الكود
  const shipCfg = settings.shipping || {};
  const freeShippingAt = shipCfg.freeShippingEnabled ? Number(shipCfg.freeShippingThreshold) || 0 : 0;
  const dMin = shipCfg.estimatedDaysMin ?? 2;
  const dMax = shipCfg.estimatedDaysMax ?? 5;
  const deliveryEstimate = t('product.deliveryIn', { min: dMin, max: dMax });
  const returnsEnabled = settings.returns?.enabled !== false;
  const returnWindow = settings.returns?.windowDays ?? 14;
  const payMethods = paymentMethods || [];

  const handleAdd = (buyNow = false) => {
    if (outOfStock || adding) return;
    setAdding(true);
    const variant =
      selectedColor || selectedSize
        ? { name: [selectedColor, selectedSize].filter(Boolean).join(' / '), price: product.price, stock: product.stock, sku: product.sku }
        : null;
    addItem(product, qty, variant);
    toast.success(t('product.added'));

    if (buyNow) {
      window.location.assign('/checkout');
      return;
    }

    // علامة نجاح قصيرة على الزر ثم فتح السلة — تأكيد بصري واضح
    setJustAdded(true);
    setTimeout(() => {
      setAdding(false);
      openCart();
    }, 320);
    setTimeout(() => setJustAdded(false), 1600);
  };

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: name, url });
        return;
      } catch {
        /* user cancelled */
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success(t('common.copied'));
    setTimeout(() => setCopied(false), 2000);
  };

  /**
   * الشارات ديناميكية بالكامل من بيانات المنتج والإعدادات —
   * لا شيء مكتوب في الكود. الترتيب حسب قوة التأثير الشرائي.
   */
  const galleryBadges = (
    <div className="pointer-events-none absolute start-4 top-4 z-20 flex flex-col items-start gap-1.5">
      {product.discount > 0 ? <Badge variant="danger">-{product.discount}%</Badge> : null}
      {product.isNewArrival ? <Badge variant="ink">{t('product.new')}</Badge> : null}
      {product.isBestSeller ? <Badge variant="rose">{t('product.bestSeller')}</Badge> : null}
      {product.isFeatured ? <Badge variant="blush">{t('admin.featured')}</Badge> : null}
      {lowStock ? <Badge variant="warning">{t('product.limitedStock')}</Badge> : null}
      {outOfStock ? <Badge variant="neutral">{t('product.outOfStock')}</Badge> : null}
    </div>
  );

  const tabContent = {
    description: localized(product, lang, 'description'),
    ingredients: localized(product, lang, 'ingredients'),
    usage: localized(product, lang, 'usage'),
    benefits: localized(product, lang, 'benefits'),
  };

  return (
    <>
      <div className="border-b border-black/5 bg-white">
        <div className="container-x py-4">
          <Breadcrumbs
            items={[
              { to: '/shop', label: t('nav.shop') },
              { to: `/shop?category=${product.category?.slug}`, label: localized(product.category, lang) },
              { label: name },
            ]}
          />
        </div>
      </div>

      <div className="container-x py-8 md:py-10">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          {/* Gallery — معرض احترافي: تكبير، ملء شاشة، سحب، لوحة مفاتيح */}
          <ProductGallery images={images} alt={name} badges={galleryBadges} />

          {/* Info */}
          <div>
            <Link
              to={`/shop?brand=${product.brand?.slug}`}
              className="text-xs font-bold uppercase tracking-wider text-rose transition hover:underline"
            >
              {localized(product.brand, lang)}
            </Link>

            <h1 className="mt-2 text-2xl font-bold leading-snug text-ink md:text-3xl">{name}</h1>

            <div className="mt-3 flex flex-wrap items-center gap-4">
              <Rating value={product.rating} count={product.reviewsCount} showValue size={15} />
              <span className="text-xs text-ink-muted">
                {t('product.sku')}: <span className="font-semibold text-ink">{product.sku}</span>
              </span>
            </div>

            <div className="mt-5 flex flex-wrap items-end gap-3">
              <Price value={product.price} oldValue={product.oldPrice} size="xl" />
              {savings > 0 ? (
                <Badge variant="success" className="mb-1">
                  {t('product.save')} {formatPrice(savings, lang)}
                </Badge>
              ) : null}
            </div>

            <p className="mt-4 text-sm leading-relaxed text-ink-muted">
              {localized(product, lang, 'shortDescription')}
            </p>

            {/* مؤشر المخزون: شارة + شريط تقدّم عند اقتراب النفاد */}
            <div className="mt-5">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold',
                  outOfStock
                    ? 'bg-red-100 text-red-700'
                    : lowStock
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700'
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    outOfStock ? 'bg-red-600' : lowStock ? 'bg-amber-500' : 'bg-emerald-600'
                  )}
                  aria-hidden="true"
                />
                {outOfStock
                  ? t('product.outOfStock')
                  : lowStock
                  ? t('product.onlyLeft', { n: product.stock })
                  : t('product.inStock')}
              </span>

              {lowStock ? (
                <div className="mt-2.5 max-w-xs">
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-amber-100"
                    role="progressbar"
                    aria-valuenow={product.stock}
                    aria-valuemin={0}
                    aria-valuemax={LOW_STOCK_THRESHOLD}
                    aria-label={t('product.onlyLeft', { n: product.stock })}
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-700"
                      style={{ width: `${Math.max(10, (product.stock / LOW_STOCK_THRESHOLD) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] font-medium text-amber-700">{t('product.hurryLowStock')}</p>
                </div>
              ) : null}
            </div>

            {/* بيانات المنتج: القسم والوسوم */}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-muted">
              {product.category ? (
                <span>
                  {t('common.category')}:{' '}
                  <Link
                    to={`/shop?category=${product.category?.slug}`}
                    className="font-semibold text-ink transition hover:text-rose"
                  >
                    {localized(product.category, lang)}
                  </Link>
                </span>
              ) : null}
            </div>

            {product.tags?.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {product.tags.slice(0, 8).map((tag) => (
                  <Link
                    key={tag}
                    to={`/search?q=${encodeURIComponent(tag)}`}
                    className="rounded-full bg-blush/70 px-2.5 py-1 text-[11px] font-medium text-ink-soft transition hover:bg-rose hover:text-white"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            ) : null}

            {/* Colors */}
            {product.colors?.length ? (
              <div className="mt-6">
                <p className="mb-2.5 text-sm font-semibold text-ink">
                  {t('product.color')}
                  {selectedColor ? <span className="ms-2 text-xs font-normal text-ink-muted">{selectedColor}</span> : null}
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {product.colors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedColor(selectedColor === c ? null : c)}
                      className={cn(
                        'h-9 w-9 rounded-full border-2 transition hover:scale-110',
                        selectedColor === c ? 'border-ink ring-2 ring-rose ring-offset-2' : 'border-black/10'
                      )}
                      style={{ backgroundColor: c }}
                      aria-label={c}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {/* Sizes */}
            {product.sizes?.length ? (
              <div className="mt-6">
                <p className="mb-2.5 text-sm font-semibold text-ink">{t('product.size')}</p>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSelectedSize(selectedSize === s ? null : s)}
                      className={cn(
                        'rounded-full border px-4 py-2 text-xs font-semibold transition',
                        selectedSize === s
                          ? 'border-rose bg-rose text-white'
                          : 'border-ink/15 text-ink hover:border-rose hover:text-rose'
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Actions */}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <QuantitySelector value={qty} onChange={setQty} max={Math.max(1, product.stock)} size="lg" />
              <Button
                onClick={() => handleAdd(false)}
                disabled={outOfStock || adding}
                loading={adding && !justAdded}
                icon={justAdded ? FiCheck : FiShoppingBag}
                size="lg"
                className={cn('min-w-[180px] flex-1', justAdded && '!bg-emerald-600 hover:!bg-emerald-600')}
              >
                {outOfStock ? t('product.outOfStock') : justAdded ? t('product.added') : t('product.addToCart')}
              </Button>
              <button
                type="button"
                onClick={() => {
                  const added = toggleWishlist(product);
                  toast.info(added ? t('product.addedToWishlist') : t('product.removedFromWishlist'));
                }}
                className={cn(
                  'grid h-[52px] w-[52px] place-items-center rounded-full border transition',
                  inWishlist ? 'border-rose bg-rose text-white' : 'border-ink/15 text-ink hover:border-rose hover:text-rose'
                )}
                aria-label={t('product.addToWishlist')}
              >
                <FiHeart size={19} className={inWishlist ? 'fill-current' : ''} />
              </button>
              <button
                type="button"
                onClick={share}
                className="grid h-[52px] w-[52px] place-items-center rounded-full border border-ink/15 text-ink transition hover:border-rose hover:text-rose"
                aria-label={t('product.share')}
              >
                {copied ? <FiCheck size={19} className="text-emerald-600" /> : <FiShare2 size={18} />}
              </button>
            </div>

            {!outOfStock ? (
              <Button onClick={() => handleAdd(true)} variant="rose" size="lg" fullWidth className="mt-3">
                {t('product.buyNow')}
              </Button>
            ) : null}

            {/*
              الشحن والإرجاع والدفع — كل القيم من إعدادات المتجر،
              فلا يحتاج المالك لتعديل الكود لتغيير المهلة أو العتبة.
            */}
            <div className="mt-7 overflow-hidden rounded-2xl border border-black/5 bg-white">
              <ul className="divide-y divide-black/5">
                <li className="flex items-start gap-3 p-4">
                  <FiTruck className="mt-0.5 shrink-0 text-rose" size={18} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-ink">{t('product.shippingInfo')}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">
                      {deliveryEstimate}
                      {freeShippingAt > 0 ? ` — ${t('product.freeShippingOver', { amount: formatPrice(freeShippingAt, lang) })}` : ''}
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3 p-4">
                  <FiRefreshCw className="mt-0.5 shrink-0 text-rose" size={18} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-ink">{t('product.returnsInfo')}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">
                      {returnsEnabled
                        ? t('product.returnWindowDays', { n: returnWindow })
                        : t('product.returnsUnavailable')}
                      {' · '}
                      <Link to="/returns-policy" className="font-semibold text-rose hover:underline">
                        {t('product.readPolicy')}
                      </Link>
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3 p-4">
                  <FiShield className="mt-0.5 shrink-0 text-rose" size={18} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-ink">{t('product.securePayment')}</p>
                    {payMethods.length ? (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {payMethods.slice(0, 6).map((m) => (
                          <span
                            key={m._id || m.code}
                            className="rounded-md border border-black/10 bg-cream px-2 py-1 text-[10px] font-semibold text-ink-soft"
                          >
                            {(lang === 'ar' ? m.name : m.nameEn) || m.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-0.5 text-[11px] text-ink-muted">{t('product.securePaymentDesc')}</p>
                    )}
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-12 rounded-2xl border border-black/5 bg-white shadow-soft">
          <div className="flex flex-wrap gap-1 border-b border-black/5 p-2">
            {TABS.filter((tab) => tabContent[tab]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'rounded-xl px-5 py-2.5 text-sm font-semibold transition',
                  activeTab === tab ? 'bg-ink text-white' : 'text-ink-muted hover:bg-blush hover:text-ink'
                )}
              >
                {t(`product.${tab}`)}
              </button>
            ))}
          </div>
          <div className="p-6">
            {activeTab === 'benefits' && tabContent.benefits?.includes('•') ? (
              <ul className="space-y-2.5">
                {tabContent.benefits.split('•').filter(Boolean).map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm leading-relaxed text-ink-soft">
                    <FiCheck className="mt-0.5 shrink-0 text-rose" size={16} />
                    {b.trim()}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="whitespace-pre-line text-sm leading-loose text-ink-soft">{tabContent[activeTab]}</p>
            )}
          </div>
        </div>

        {/* Reviews */}
        <ProductReviews product={product} />

        {/* Related */}
        {related.length ? (
          <section className="mt-14">
            <SectionHeader title={t('product.related')} />
            <ProductCarousel products={related} />
          </section>
        ) : null}

        {/* Recently viewed */}
        {recentOthers.length ? (
          <section className="mt-14">
            <SectionHeader title={t('product.recentlyViewed')} />
            <ProductCarousel products={recentOthers} />
          </section>
        ) : null}
      </div>

      {/*
        شريط الإجراءات الثابت على الجوال.
        على الشاشات الصغيرة يختفي زر الشراء عند التمرير لأسفل،
        فنُبقيه دائماً في المتناول — نمط قياسي في المتاجر العالمية.
      */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 p-3 shadow-lift backdrop-blur lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="clamp-1 text-[11px] font-medium text-ink-muted">{name}</p>
            <Price value={product.price} oldValue={product.oldPrice} />
          </div>
          <QuantitySelector value={qty} onChange={setQty} max={Math.max(1, product.stock)} size="sm" />
          <Button
            onClick={() => handleAdd(false)}
            disabled={outOfStock || adding}
            loading={adding && !justAdded}
            icon={justAdded ? FiCheck : FiShoppingBag}
            className={cn('shrink-0', justAdded && '!bg-emerald-600 hover:!bg-emerald-600')}
          >
            {outOfStock ? t('product.outOfStock') : t('product.addToCart')}
          </Button>
        </div>
      </div>

      {/* مساحة تعويضية حتى لا يغطي الشريط الثابت آخر المحتوى */}
      <div className="h-24 lg:hidden" aria-hidden="true" />
    </>
  );
}
