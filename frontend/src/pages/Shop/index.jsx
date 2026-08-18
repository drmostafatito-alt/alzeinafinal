import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiFilter, FiGrid, FiList, FiX } from 'react-icons/fi';
import PageHeader from '@/components/common/PageHeader';
import ProductFilters from '@/components/product/ProductFilters';
import ProductGrid from '@/components/product/ProductGrid';
import Drawer from '@/components/ui/Drawer';
import Pagination from '@/components/ui/Pagination';
import { useCategories, useLocalStorage, useProducts } from '@/hooks';
import { useI18n } from '@/i18n';
import { useUIStore } from '@/store/uiStore';
import { PER_PAGE_OPTIONS, SORT_OPTIONS } from '@/utils/constants';
import { cn, localized, scrollTop } from '@/utils/helpers';

export default function Shop() {
  const { t, lang } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useLocalStorage('alzeina_shop_view', 'grid');
  const filtersOpen = useUIStore((s) => s.filtersOpen);
  const toggleFilters = useUIStore((s) => s.toggleFilters);
  const closeFilters = useUIStore((s) => s.closeFilters);
  const { categories } = useCategories();

  const filters = useMemo(() => Object.fromEntries(searchParams.entries()), [searchParams]);

  const queryParams = useMemo(
    () => ({
      page: Number(filters.page) || 1,
      limit: Number(filters.limit) || 12,
      sort: filters.sort || 'newest',
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.brand ? { brand: filters.brand } : {}),
      ...(filters.minPrice ? { minPrice: filters.minPrice } : {}),
      ...(filters.maxPrice ? { maxPrice: filters.maxPrice } : {}),
      ...(filters.rating ? { rating: filters.rating } : {}),
      ...(filters.inStock ? { inStock: filters.inStock } : {}),
      ...(filters.discount ? { discount: filters.discount } : {}),
      ...(filters.featured ? { featured: filters.featured } : {}),
      ...(filters.q ? { search: filters.q } : {}),
    }),
    [filters]
  );

  const { products, pagination, isLoading } = useProducts(queryParams);

  const update = useCallback(
    (patch) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([k, v]) => {
        if (v === '' || v === undefined || v === null) next.delete(k);
        else next.set(k, String(v));
      });
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const reset = useCallback(() => setSearchParams({}, { replace: true }), [setSearchParams]);

  const activeCategory = categories.find((c) => c.slug === filters.category);
  const title = activeCategory ? localized(activeCategory, lang) : t('shop.title');

  const from = (pagination.page - 1) * pagination.limit + 1;
  const to = Math.min(pagination.page * pagination.limit, pagination.total);

  const chips = [];
  if (filters.category)
    filters.category.split(',').forEach((slug) => {
      const c = categories.find((x) => x.slug === slug);
      chips.push({
        key: `cat-${slug}`,
        label: c ? localized(c, lang) : slug,
        onRemove: () =>
          update({ category: filters.category.split(',').filter((s) => s !== slug).join(','), page: 1 }),
      });
    });
  if (filters.brand)
    filters.brand.split(',').forEach((slug) => {
      chips.push({
        key: `br-${slug}`,
        label: slug,
        onRemove: () => update({ brand: filters.brand.split(',').filter((s) => s !== slug).join(','), page: 1 }),
      });
    });
  if (filters.minPrice || filters.maxPrice)
    chips.push({
      key: 'price',
      label: `${filters.minPrice || 0} - ${filters.maxPrice || '∞'}`,
      onRemove: () => update({ minPrice: '', maxPrice: '', page: 1 }),
    });
  if (filters.rating)
    chips.push({ key: 'rating', label: `${filters.rating}★+`, onRemove: () => update({ rating: '', page: 1 }) });
  if (filters.inStock)
    chips.push({ key: 'stock', label: t('shop.inStockOnly'), onRemove: () => update({ inStock: '', page: 1 }) });
  if (filters.discount)
    chips.push({ key: 'sale', label: t('shop.onSaleOnly'), onRemove: () => update({ discount: '', page: 1 }) });

  const filterPanel = (
    <ProductFilters filters={filters} onChange={update} onReset={reset} maxPriceLimit={1000} />
  );

  return (
    <>
      <PageHeader
        title={title}
        subtitle={
          pagination.total > 0
            ? t('shop.showing', { from, to, total: pagination.total })
            : undefined
        }
        breadcrumbs={[
          { to: '/shop', label: t('nav.shop') },
          ...(activeCategory ? [{ label: localized(activeCategory, lang) }] : []),
        ]}
      />

      <div className="container-x py-8">
        <div className="flex gap-8">
          {/* Desktop filters */}
          <aside className="hidden w-72 shrink-0 lg:block">
            <div className="sticky top-24">{filterPanel}</div>
          </aside>

          <div className="min-w-0 flex-1">
            {/* Toolbar */}
            <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-black/5 bg-white p-3 shadow-soft">
              <button
                type="button"
                onClick={toggleFilters}
                className="flex items-center gap-2 rounded-full border border-ink/10 px-4 py-2 text-xs font-bold text-ink transition hover:border-rose hover:text-rose lg:hidden"
              >
                <FiFilter size={14} />
                {t('shop.filters')}
              </button>

              <select
                value={filters.sort || 'newest'}
                onChange={(e) => update({ sort: e.target.value, page: 1 })}
                className="cursor-pointer rounded-full border border-ink/10 bg-white px-4 py-2 text-xs font-semibold text-ink outline-none transition hover:border-rose focus:border-rose"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t('common.sort')}: {o[lang]}
                  </option>
                ))}
              </select>

              <select
                value={filters.limit || 12}
                onChange={(e) => update({ limit: e.target.value, page: 1 })}
                className="hidden cursor-pointer rounded-full border border-ink/10 bg-white px-4 py-2 text-xs font-semibold text-ink outline-none transition hover:border-rose focus:border-rose sm:block"
              >
                {PER_PAGE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} / {t('shop.perPage')}
                  </option>
                ))}
              </select>

              <span className="ms-auto hidden text-xs text-ink-muted md:block">
                {pagination.total} {t('common.results')}
              </span>

              <div className="flex items-center gap-1 rounded-full border border-ink/10 p-1">
                {[
                  { v: 'grid', icon: FiGrid },
                  { v: 'list', icon: FiList },
                ].map(({ v, icon: Icon }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    className={cn(
                      'grid h-8 w-8 place-items-center rounded-full transition',
                      view === v ? 'bg-ink text-white' : 'text-ink-muted hover:text-rose'
                    )}
                    aria-label={v}
                  >
                    <Icon size={15} />
                  </button>
                ))}
              </div>
            </div>

            {/* Active chips */}
            {chips.length ? (
              <div className="mb-5 flex flex-wrap items-center gap-2">
                {chips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={chip.onRemove}
                    className="flex items-center gap-1.5 rounded-full bg-blush px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose hover:text-white"
                  >
                    {chip.label}
                    <FiX size={12} />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={reset}
                  className="text-xs font-semibold text-ink-muted underline transition hover:text-rose"
                >
                  {t('shop.clearFilters')}
                </button>
              </div>
            ) : null}

            <ProductGrid
              products={products}
              loading={isLoading}
              view={view}
              skeletonCount={Number(filters.limit) || 12}
              emptyAction={{ label: t('shop.clearFilters'), onClick: reset }}
            />

            <Pagination
              page={pagination.page}
              pages={pagination.pages}
              onChange={(p) => {
                update({ page: p });
                scrollTop();
              }}
              className="mt-10"
            />
          </div>
        </div>
      </div>

      {/* Mobile filters drawer */}
      <Drawer open={filtersOpen} onClose={closeFilters} title={t('shop.filters')} side="start">
        <div className="p-4">{filterPanel}</div>
      </Drawer>
    </>
  );
}
