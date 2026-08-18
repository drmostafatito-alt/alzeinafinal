import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiSearch } from 'react-icons/fi';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/common/PageHeader';
import Pagination from '@/components/ui/Pagination';
import ProductGrid from '@/components/product/ProductGrid';
import SearchBar from '@/components/layout/SearchBar';
import { useProducts } from '@/hooks';
import { useI18n } from '@/i18n';
import { SORT_OPTIONS } from '@/utils/constants';
import { scrollTop } from '@/utils/helpers';

export default function Search() {
  const { t, lang } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const sort = searchParams.get('sort') || 'newest';
  const page = Number(searchParams.get('page')) || 1;

  const params = useMemo(() => ({ search: q, sort, page, limit: 12 }), [q, sort, page]);
  const { products, pagination, isLoading } = useProducts(params);

  const update = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, String(v)) : next.delete(k)));
    setSearchParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader
        title={q ? `${t('search.resultsFor')} “${q}”` : t('search.title')}
        subtitle={q && !isLoading ? `${pagination.total} ${t('common.results')}` : undefined}
        breadcrumbs={[{ label: t('search.title') }]}
      />

      <div className="container-x py-8">
        <div className="mx-auto mb-8 max-w-2xl">
          <SearchBar />
        </div>

        {!q ? (
          <EmptyState icon={FiSearch} title={t('search.typeToSearch')} description={t('search.noResultsDesc')} />
        ) : (
          <>
            {products.length ? (
              <div className="mb-5 flex justify-end">
                <select
                  value={sort}
                  onChange={(e) => update({ sort: e.target.value, page: 1 })}
                  className="cursor-pointer rounded-full border border-ink/10 bg-white px-4 py-2 text-xs font-semibold text-ink outline-none transition hover:border-rose focus:border-rose"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {t('common.sort')}: {o[lang]}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <ProductGrid
              products={products}
              loading={isLoading}
              emptyTitle={t('search.noResults')}
              emptyDescription={t('search.noResultsDesc')}
              emptyAction={{ label: t('nav.shop'), to: '/shop' }}
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
          </>
        )}
      </div>
    </>
  );
}
