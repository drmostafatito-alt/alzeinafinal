import { useEffect, useState } from 'react';
import { FiChevronDown, FiX } from 'react-icons/fi';
import { motion } from 'framer-motion';
import Rating from '@/components/ui/Rating';
import { useBrands, useCategories } from '@/hooks';
import { useI18n } from '@/i18n';
import { formatPrice } from '@/utils/format';
import { cn, localized } from '@/utils/helpers';

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-black/5 py-4 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-sm font-bold text-ink"
      >
        {title}
        <FiChevronDown size={16} className={cn('text-ink-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="overflow-hidden">
          <div className="pt-3">{children}</div>
        </motion.div>
      ) : null}
    </div>
  );
}

export default function ProductFilters({ filters, onChange, onReset, maxPriceLimit = 1000 }) {
  const { t, lang } = useI18n();
  const { categories } = useCategories();
  const { brands } = useBrands();

  const [localMin, setLocalMin] = useState(filters.minPrice || '');
  const [localMax, setLocalMax] = useState(filters.maxPrice || '');

  useEffect(() => {
    setLocalMin(filters.minPrice || '');
    setLocalMax(filters.maxPrice || '');
  }, [filters.minPrice, filters.maxPrice]);

  const selectedCats = filters.category ? String(filters.category).split(',').filter(Boolean) : [];
  const selectedBrands = filters.brand ? String(filters.brand).split(',').filter(Boolean) : [];

  const toggleList = (key, value, current) => {
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    onChange({ [key]: next.join(','), page: 1 });
  };

  const activeCount =
    selectedCats.length +
    selectedBrands.length +
    (filters.minPrice ? 1 : 0) +
    (filters.maxPrice ? 1 : 0) +
    (filters.rating ? 1 : 0) +
    (filters.inStock ? 1 : 0) +
    (filters.discount ? 1 : 0);

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between pb-2">
        <h3 className="flex items-center gap-2 text-base font-bold text-ink">
          {t('shop.filters')}
          {activeCount > 0 ? (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-rose px-1.5 text-[10px] font-bold text-white">
              {activeCount}
            </span>
          ) : null}
        </h3>
        {activeCount > 0 ? (
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1 text-xs font-semibold text-rose transition hover:underline"
          >
            <FiX size={13} />
            {t('shop.clearFilters')}
          </button>
        ) : null}
      </div>

      <Section title={t('common.category')}>
        <ul className="max-h-60 space-y-1.5 overflow-y-auto pe-1">
          {categories.map((c) => (
            <li key={c._id}>
              <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-1 py-1 text-sm text-ink-soft transition hover:text-rose">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedCats.includes(c.slug)}
                    onChange={() => toggleList('category', c.slug, selectedCats)}
                    className="h-4 w-4 rounded border-ink/25 accent-rose"
                  />
                  <span className="clamp-1">{localized(c, lang)}</span>
                </span>
                <span className="shrink-0 text-[11px] text-ink-muted">{c.productCount || 0}</span>
              </label>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t('common.brandLabel')}>
        <ul className="max-h-56 space-y-1.5 overflow-y-auto pe-1">
          {brands.map((b) => (
            <li key={b._id}>
              <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-1 py-1 text-sm text-ink-soft transition hover:text-rose">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedBrands.includes(b.slug)}
                    onChange={() => toggleList('brand', b.slug, selectedBrands)}
                    className="h-4 w-4 rounded border-ink/25 accent-rose"
                  />
                  <span className="clamp-1">{localized(b, lang)}</span>
                </span>
                <span className="shrink-0 text-[11px] text-ink-muted">{b.productCount || 0}</span>
              </label>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t('shop.priceRange')}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={localMin}
              onChange={(e) => setLocalMin(e.target.value)}
              placeholder={t('shop.minPrice')}
              className="input py-2 text-xs"
              min={0}
            />
            <span className="text-ink-muted">—</span>
            <input
              type="number"
              value={localMax}
              onChange={(e) => setLocalMax(e.target.value)}
              placeholder={t('shop.maxPrice')}
              className="input py-2 text-xs"
              min={0}
            />
          </div>
          <input
            type="range"
            min={0}
            max={maxPriceLimit}
            step={10}
            value={localMax || maxPriceLimit}
            onChange={(e) => setLocalMax(e.target.value)}
            className="w-full accent-rose"
          />
          <div className="flex justify-between text-[11px] text-ink-muted">
            <span>{formatPrice(0, lang)}</span>
            <span>{formatPrice(maxPriceLimit, lang)}</span>
          </div>
          <button
            type="button"
            onClick={() => onChange({ minPrice: localMin, maxPrice: localMax, page: 1 })}
            className="btn btn-sm w-full bg-ink text-white hover:bg-rose"
          >
            {t('common.apply')}
          </button>
        </div>
      </Section>

      <Section title={t('shop.rating')}>
        <ul className="space-y-1.5">
          {[4, 3, 2, 1].map((r) => (
            <li key={r}>
              <button
                type="button"
                onClick={() => onChange({ rating: filters.rating === String(r) ? '' : r, page: 1 })}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition',
                  String(filters.rating) === String(r) ? 'bg-blush text-rose' : 'hover:bg-blush/60'
                )}
              >
                <Rating value={r} size={13} />
                <span className="text-xs text-ink-muted">{t('shop.andUp')}</span>
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t('shop.availability')}>
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={Boolean(filters.inStock)}
              onChange={(e) => onChange({ inStock: e.target.checked ? 'true' : '', page: 1 })}
              className="h-4 w-4 rounded border-ink/25 accent-rose"
            />
            {t('shop.inStockOnly')}
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={Boolean(filters.discount)}
              onChange={(e) => onChange({ discount: e.target.checked ? 'true' : '', page: 1 })}
              className="h-4 w-4 rounded border-ink/25 accent-rose"
            />
            {t('shop.onSaleOnly')}
          </label>
        </div>
      </Section>
    </div>
  );
}
