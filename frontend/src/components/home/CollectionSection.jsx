import SectionHeader from '@/components/ui/SectionHeader';
import ProductCarousel from '@/components/product/ProductCarousel';
import ProductGrid from '@/components/product/ProductGrid';
import { cn } from '@/utils/helpers';

/**
 * أعمدة الشبكة من بانى الصفحة (Desktop/Mobile).
 * خريطة ثابتة حتى يلتقطها Tailwind JIT (أسماء الفئات كاملة في المصدر).
 */
const DESKTOP_COLS = {
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
};
const MOBILE_COLS = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
};

export default function CollectionSection({
  title,
  subtitle,
  viewAllTo,
  products = [],
  loading = false,
  autoplay = false,
  layout = 'carousel',
  columnsDesktop,
  columnsMobile,
  className,
}) {
  // أثناء التحميل نُبقي القسم ظاهراً كي يحجز مساحته ولا يقفز التخطيط.
  const hasProducts = products.length > 0;
  if (!loading && !hasProducts) return null;

  const desktop = DESKTOP_COLS[Number(columnsDesktop)] || DESKTOP_COLS[4];
  const mobile = MOBILE_COLS[Number(columnsMobile)] || MOBILE_COLS[2];

  return (
    <section className={cn('section', className)}>
      <div className="container-x">
        <SectionHeader
          title={title}
          subtitle={subtitle}
          /* الرابط يظهر فقط عندما توجد منتجات فعلاً يقود إليها */
          viewAllTo={hasProducts ? viewAllTo : undefined}
        />
        {layout === 'grid' ? (
          <ProductGrid products={products} loading={loading} colClass={cn('md:grid-cols-3', mobile, desktop)} />
        ) : (
          <ProductCarousel products={products} loading={loading} autoplay={autoplay} />
        )}
      </div>
    </section>
  );
}
