import { FiHeart, FiShoppingBag, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/common/PageHeader';
import ProductGrid from '@/components/product/ProductGrid';
import { useI18n } from '@/i18n';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';

export default function Wishlist() {
  const { t } = useI18n();
  const items = useWishlistStore((s) => s.items);
  const clear = useWishlistStore((s) => s.clear);
  const addItem = useCartStore((s) => s.addItem);

  const products = items.map((i) => ({
    _id: i.productId,
    slug: i.slug,
    name: i.name,
    nameEn: i.nameEn,
    mainImage: i.image,
    price: i.price,
    oldPrice: i.oldPrice,
    discount: i.discount,
    rating: i.rating,
    reviewsCount: i.reviewsCount,
    stock: i.stock ?? 10,
    brand: i.brand,
    category: i.category,
  }));

  const moveAll = () => {
    const available = products.filter((p) => p.stock > 0);
    available.forEach((p) => addItem(p, 1));
    toast.success(`${available.length} ${t('cart.items')} → ${t('cart.title')}`);
  };

  return (
    <>
      <PageHeader
        title={t('wishlist.title')}
        subtitle={items.length ? t('wishlist.count', { n: items.length }) : undefined}
        breadcrumbs={[{ label: t('wishlist.title') }]}
      >
        {items.length ? (
          <div className="flex flex-wrap gap-2">
            <Button onClick={moveAll} size="sm" icon={FiShoppingBag}>
              {t('wishlist.moveAllToCart')}
            </Button>
            <Button
              onClick={() => {
                clear();
                toast.info(t('common.clear'));
              }}
              size="sm"
              variant="outline"
              icon={FiTrash2}
            >
              {t('common.clear')}
            </Button>
          </div>
        ) : null}
      </PageHeader>

      <div className="container-x py-8">
        {items.length ? (
          <ProductGrid products={products} />
        ) : (
          <div className="rounded-2xl border border-black/5 bg-white shadow-soft">
            <EmptyState
              icon={FiHeart}
              title={t('wishlist.empty')}
              description={t('wishlist.emptyDesc')}
              actionLabel={t('cart.startShopping')}
              actionTo="/shop"
              secondaryLabel={t('nav.newArrivals')}
              secondaryTo="/shop?sort=newest"
            />
          </div>
        )}
      </div>
    </>
  );
}
