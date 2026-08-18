import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiCheck, FiHeart, FiShoppingBag } from 'react-icons/fi';
import { toast } from 'react-toastify';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Price from '@/components/ui/Price';
import QuantitySelector from '@/components/ui/QuantitySelector';
import Rating from '@/components/ui/Rating';
import { useI18n } from '@/i18n';
import { useCartStore } from '@/store/cartStore';
import { useUIStore } from '@/store/uiStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { cn, localized } from '@/utils/helpers';
import SmartImage from '@/components/ui/SmartImage';

export default function QuickViewModal() {
  const { t, lang } = useI18n();
  const product = useUIStore((s) => s.quickViewProduct);
  const close = useUIStore((s) => s.closeQuickView);
  const addItem = useCartStore((s) => s.addItem);
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const inWishlist = useWishlistStore((s) => (product ? s.items.some((i) => i.productId === product._id) : false));

  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [color, setColor] = useState(null);
  const [size, setSize] = useState(null);
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    setQty(1);
    setActiveImg(0);
    setColor(null);
    setSize(null);
    setAdding(false);
    setJustAdded(false);
  }, [product?._id]);

  if (!product) return null;

  const name = localized(product, lang);
  const images = product.images?.length ? product.images : [product.mainImage];
  const outOfStock = product.stock <= 0;

  const handleAdd = () => {
    if (outOfStock || adding) return;
    setAdding(true);
    // نمرّر الخيار المختار كما تفعل صفحة المنتج الكاملة
    const variant =
      color || size
        ? {
            name: [color, size].filter(Boolean).join(' / '),
            price: product.price,
            stock: product.stock,
            sku: product.sku
          }
        : null;
    addItem(product, qty, variant);
    toast.success(t('product.added'));
    setJustAdded(true);
    // نُبقي النافذة مفتوحة لحظة ليرى المستخدم التأكيد ثم نغلقها
    setTimeout(() => {
      setAdding(false);
      close();
    }, 700);
  };

  return (
    <Modal open={Boolean(product)} onClose={close} size="lg">
      <div className="grid gap-6 p-6 md:grid-cols-2 md:gap-8">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-blush">
            {product.discount > 0 ? (
              <Badge variant="danger" className="absolute start-3 top-3 z-10">
                -{product.discount}%
              </Badge>
            ) : null}
            <SmartImage src={images[activeImg]} alt={name} className="h-full w-full object-cover" />
          </div>
          {images.length > 1 ? (
            <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
              {images.slice(0, 5).map((img, i) => (
                <button
                  key={img + i}
                  type="button"
                  onClick={() => setActiveImg(i)}
                  className={cn(
                    'h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition',
                    i === activeImg ? 'border-rose' : 'border-transparent opacity-70 hover:opacity-100'
                  )}
                >
                  <SmartImage src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wide text-rose">
            {localized(product.brand, lang)}
          </span>
          <h2 className="mt-1.5 text-xl font-bold text-ink md:text-2xl">{name}</h2>
          <Rating value={product.rating} count={product.reviewsCount} className="mt-2" showValue />

          <div className="mt-4">
            <Price value={product.price} oldValue={product.oldPrice} size="lg" />
          </div>

          <p className="clamp-3 mt-4 text-sm leading-relaxed text-ink-muted">
            {localized(product, lang, 'shortDescription') || localized(product, lang, 'description')}
          </p>

          <div className="mt-4 flex items-center gap-2 text-xs">
            <span className="text-ink-muted">{t('product.sku')}:</span>
            <span className="font-semibold text-ink">{product.sku}</span>
            <span
              className={cn(
                'ms-2 rounded-full px-2 py-0.5 font-bold',
                outOfStock ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
              )}
            >
              {outOfStock ? t('product.outOfStock') : t('product.inStock')}
            </span>
          </div>

          {/* اختيار اللون والمقاس داخل النافذة — بلا مغادرة صفحة المنتجات */}
          {product.colors?.length ? (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-ink">
                {t('product.color')}
                {color ? <span className="ms-2 font-normal text-ink-muted">{color}</span> : null}
              </p>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(color === c ? null : c)}
                    className={cn(
                      'h-8 w-8 rounded-full border-2 transition hover:scale-110',
                      color === c ? 'border-ink ring-2 ring-rose ring-offset-2' : 'border-black/10'
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                    aria-pressed={color === c}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {product.sizes?.length ? (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-ink">{t('product.size')}</p>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setSize(size === sz ? null : sz)}
                    aria-pressed={size === sz}
                    className={cn(
                      'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition',
                      size === sz
                        ? 'border-rose bg-rose text-white'
                        : 'border-ink/15 text-ink hover:border-rose hover:text-rose'
                    )}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <QuantitySelector value={qty} onChange={setQty} max={Math.max(1, product.stock)} />
            <Button
              onClick={handleAdd}
              disabled={outOfStock || adding}
              loading={adding && !justAdded}
              icon={justAdded ? FiCheck : FiShoppingBag}
              className={cn('flex-1', justAdded && '!bg-emerald-600 hover:!bg-emerald-600')}
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
                'grid h-12 w-12 place-items-center rounded-full border transition',
                inWishlist ? 'border-rose bg-rose text-white' : 'border-ink/10 hover:border-rose hover:text-rose'
              )}
              aria-label={t('product.addToWishlist')}
            >
              <FiHeart size={18} className={inWishlist ? 'fill-current' : ''} />
            </button>
          </div>

          <Link
            to={`/product/${product.slug || product._id}`}
            onClick={close}
            className="mt-5 text-center text-sm font-semibold text-rose hover:underline"
          >
            {t('orders.viewDetails')} →
          </Link>
        </div>
      </div>
    </Modal>
  );
}
