import { Link } from 'react-router-dom';
import { FiBarChart2, FiCheck, FiShoppingBag, FiTrash2, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/common/PageHeader';
import Price from '@/components/ui/Price';
import Rating from '@/components/ui/Rating';
import SmartImage from '@/components/ui/SmartImage';
import { useI18n } from '@/i18n';
import { useCartStore } from '@/store/cartStore';
import { useCompareStore } from '@/store/compareStore';
import { cn, localized } from '@/utils/helpers';

/**
 * صفحة مقارنة المنتجات.
 *
 * التخطيط: جدول أفقي قابل للتمرير — كل منتج عمود، كل خاصية صف.
 * على الجوال يبقى عمود الخصائص ثابتاً (sticky) ليعرف المستخدم
 * أي صف يقرأ أثناء التمرير الأفقي.
 */
export default function ComparePage() {
  const { t, lang } = useI18n();
  const items = useCompareStore((s) => s.items);
  const remove = useCompareStore((s) => s.remove);
  const clear = useCompareStore((s) => s.clear);
  const addItem = useCartStore((s) => s.addItem);

  if (!items.length) {
    return (
      <>
        <PageHeader title={t('compare.title')} breadcrumbs={[{ label: t('compare.title') }]} />
        <div className="container-x py-10">
          <EmptyState
            icon={FiBarChart2}
            title={t('compare.empty')}
            description={t('compare.emptyDesc')}
            actionLabel={t('cart.startShopping')}
            actionTo="/shop"
          />
        </div>
      </>
    );
  }

  /** صفوف المقارنة — القيمة دالة حتى نتحكم في طريقة العرض لكل خاصية */
  const rows = [
    {
      key: 'price',
      label: t('common.price'),
      render: (p) => <Price value={p.price} oldValue={p.oldPrice} />
    },
    {
      key: 'rating',
      label: t('product.rating'),
      render: (p) =>
        p.reviewsCount ? (
          <Rating value={p.rating} count={p.reviewsCount} size={13} showValue />
        ) : (
          <span className="text-xs text-ink-muted">—</span>
        )
    },
    {
      key: 'brand',
      label: t('common.brandLabel'),
      render: (p) => <span className="text-sm text-ink">{localized(p.brand, lang) || '—'}</span>
    },
    {
      key: 'category',
      label: t('common.category'),
      render: (p) => <span className="text-sm text-ink">{localized(p.category, lang) || '—'}</span>
    },
    {
      key: 'stock',
      label: t('admin.stock'),
      render: (p) =>
        p.stock > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <FiCheck size={13} aria-hidden="true" />
            {p.stock <= 5 ? t('product.onlyLeft', { n: p.stock }) : t('product.inStock')}
          </span>
        ) : (
          <span className="text-xs font-semibold text-red-600">{t('product.outOfStock')}</span>
        )
    },
    {
      key: 'sku',
      label: t('product.sku'),
      render: (p) => <span className="font-en text-xs text-ink-muted">{p.sku || '—'}</span>
    },
    {
      key: 'options',
      label: t('compare.options'),
      render: (p) => {
        const opts = [...(p.colors || []), ...(p.sizes || [])];
        return opts.length ? (
          <div className="flex flex-wrap gap-1">
            {opts.slice(0, 6).map((o) => (
              <span key={o} className="rounded-md bg-blush/70 px-2 py-0.5 text-[10px] text-ink-soft">
                {o}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-ink-muted">—</span>
        );
      }
    },
    {
      key: 'tags',
      label: t('product.tags'),
      render: (p) =>
        p.tags?.length ? (
          <div className="flex flex-wrap gap-1">
            {p.tags.slice(0, 4).map((tg) => (
              <span key={tg} className="rounded-md bg-cream px-2 py-0.5 text-[10px] text-ink-soft">
                #{tg}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-ink-muted">—</span>
        )
    }
  ];

  return (
    <>
      <PageHeader
        title={t('compare.title')}
        breadcrumbs={[{ label: t('compare.title') }]}
      />

      <div className="container-x py-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-ink-muted">{t('compare.count', { n: items.length })}</p>
          <Button variant="outline" size="sm" icon={FiTrash2} onClick={clear}>
            {t('compare.clearAll')}
          </Button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white">
          <table className="w-full min-w-[640px] border-collapse">
            <caption className="sr-only">{t('compare.title')}</caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky start-0 z-10 w-32 bg-white p-4 text-start text-xs font-bold text-ink-muted"
                >
                  {t('compare.product')}
                </th>
                {items.map((p) => (
                  <th key={p.productId} scope="col" className="min-w-[180px] border-s border-black/5 p-4 align-top">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => remove(p.productId)}
                        className="absolute -end-1 -top-1 z-10 grid h-7 w-7 place-items-center rounded-full bg-white text-ink-muted shadow-soft transition hover:bg-red-50 hover:text-red-600"
                        aria-label={t('common.delete')}
                      >
                        <FiX size={13} aria-hidden="true" />
                      </button>
                      <Link to={`/product/${p.slug || p.productId}`} className="block">
                        <div className="media-frame aspect-square rounded-xl">
                          <SmartImage src={p.image} alt={localized(p, lang)} loading="lazy" />
                        </div>
                        <p className="clamp-2 mt-2 text-start text-xs font-bold text-ink hover:text-rose">
                          {localized(p, lang)}
                        </p>
                      </Link>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-black/5">
              {rows.map((row) => (
                <tr key={row.key} className="align-middle">
                  <th
                    scope="row"
                    className="sticky start-0 z-10 bg-white p-4 text-start text-xs font-semibold text-ink-muted"
                  >
                    {row.label}
                  </th>
                  {items.map((p) => (
                    <td key={p.productId + row.key} className="border-s border-black/5 p-4">
                      {row.render(p)}
                    </td>
                  ))}
                </tr>
              ))}

              <tr>
                <th scope="row" className="sticky start-0 z-10 bg-white p-4" />
                {items.map((p) => (
                  <td key={p.productId + 'action'} className="border-s border-black/5 p-4">
                    <Button
                      size="sm"
                      icon={FiShoppingBag}
                      disabled={p.stock <= 0}
                      onClick={() => {
                        addItem({ ...p, _id: p.productId, mainImage: p.image }, 1);
                        toast.success(t('product.added'));
                      }}
                      className={cn('w-full', p.stock <= 0 && 'opacity-60')}
                    >
                      {p.stock > 0 ? t('product.addToCart') : t('product.outOfStock')}
                    </Button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
