import { FiPackage } from 'react-icons/fi';
import EmptyState from '@/components/ui/EmptyState';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';
import ProductCard from './ProductCard';
import { useI18n } from '@/i18n';
import { cn } from '@/utils/helpers';

export default function ProductGrid({
  products = [],
  loading = false,
  view = 'grid',
  skeletonCount = 8,
  emptyTitle,
  emptyDescription,
  emptyAction,
  className,
  cols = 'default',
  colClass = null,
}) {
  const { t } = useI18n();

  if (loading) return <ProductGridSkeleton count={skeletonCount} />;

  if (!products.length) {
    return (
      <EmptyState
        icon={FiPackage}
        title={emptyTitle || t('shop.noProducts')}
        description={emptyDescription || t('shop.noProductsDesc')}
        actionLabel={emptyAction?.label}
        actionTo={emptyAction?.to}
        onAction={emptyAction?.onClick}
      />
    );
  }

  if (view === 'list') {
    return (
      <div className={cn('flex flex-col gap-4', className)}>
        {products.map((p, i) => (
          <ProductCard key={p._id || p.id} product={p} view="list" index={i} />
        ))}
      </div>
    );
  }

  const colClasses = colClass || {
    default: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
    three: 'grid-cols-2 md:grid-cols-3',
    five: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
  }[cols];

  return (
    <div className={cn('grid gap-4 sm:gap-5', colClasses, className)}>
      {products.map((p, i) => (
        <ProductCard key={p._id || p.id} product={p} index={i} />
      ))}
    </div>
  );
}
