import { cn } from '@/utils/helpers';

/**
 * هياكل التحميل (Skeletons).
 *
 * القاعدة: يجب أن يطابق الهيكل شكل المحتوى النهائي وأبعاده بدقة،
 * وإلا يقفز التخطيط لحظة وصول البيانات (Cumulative Layout Shift).
 * لذلك تستخدم كل الهياكل هنا نفس الحواف والمسافات والنِسَب
 * المستخدمة في المكوّنات الحقيقية.
 */
export default function Skeleton({ className, rounded = 'rounded-lg' }) {
  return <div className={cn('skeleton', rounded, className)} aria-hidden="true" />;
}

export function ProductCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      {/* نفس نسبة صورة ProductCard تماماً */}
      <Skeleton className="aspect-square w-full" rounded="rounded-none" />
      <div className="space-y-2.5 p-4">
        <Skeleton className="h-2.5 w-1/3" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
        <div className="flex items-center gap-1.5 pt-1">
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-9 w-9" rounded="rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }) {
  return (
    <div
      className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">جاري تحميل المنتجات…</span>
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div className="card overflow-hidden" role="status" aria-busy="true">
      <span className="sr-only">جاري تحميل البيانات…</span>
      {/* صف الترويسة */}
      <div className="flex gap-4 border-b border-black/5 bg-cream/60 px-4 py-3">
        {Array.from({ length: cols }, (_, c) => (
          <Skeleton key={c} className="h-3 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-black/5">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-4">
            {Array.from({ length: cols }, (_, c) => (
              <Skeleton key={c} className={cn('h-4 flex-1', c === 0 && 'max-w-[36px] shrink-0')} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** هيكل صفحة تفاصيل المنتج */
export function ProductDetailSkeleton() {
  return (
    <div className="container-x py-8" role="status" aria-busy="true">
      <span className="sr-only">جاري تحميل المنتج…</span>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          <Skeleton className="aspect-square w-full" rounded="rounded-2xl" />
          <div className="flex gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-20 w-20" rounded="rounded-xl" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-20 w-full" rounded="rounded-xl" />
          <div className="flex gap-3 pt-2">
            <Skeleton className="h-12 flex-1" rounded="rounded-full" />
            <Skeleton className="h-12 w-12" rounded="rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** هيكل بطاقات الإحصائيات في لوحة الإدارة */
export function StatCardsSkeleton({ count = 4 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" role="status" aria-busy="true">
      <span className="sr-only">جاري تحميل الإحصائيات…</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card flex items-center justify-between p-5">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="h-11 w-11" rounded="rounded-xl" />
        </div>
      ))}
    </div>
  );
}
