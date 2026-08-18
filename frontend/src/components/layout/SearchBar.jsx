import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiClock, FiSearch, FiTrendingUp, FiX } from 'react-icons/fi';
import { AnimatePresence, motion } from 'framer-motion';
import { useClickOutside, useDebounce, useRecentSearches, useSearchSuggestions } from '@/hooks';
import { useConfig } from '@/config/ConfigProvider';
import { useI18n } from '@/i18n';
import { formatPrice } from '@/utils/format';
import { cn, localized } from '@/utils/helpers';
import SmartImage from '@/components/ui/SmartImage';

const DEFAULT_POPULAR = {
  ar: ['سيروم فيتامين سي', 'ماسكارا', 'واقي شمس', 'زيت الأرجان', 'كريم مرطب'],
  en: ['Vitamin C serum', 'Mascara', 'Sunscreen', 'Argan oil', 'Moisturiser'],
};

export default function SearchBar({ onNavigate, autoFocus = false, className }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const debounced = useDebounce(term, 300);
  const { suggestions, isLoading } = useSearchSuggestions(debounced);
  const { items: recent, add: addRecent, clear: clearRecent } = useRecentSearches();

  /* إعدادات البحث من لوحة الإدارة: نص التلميح والبحث الشائع */
  const { settings } = useConfig();
  const sConf = settings.search || {};
  const POPULAR = {
    ar: Array.isArray(sConf.popularAr) && sConf.popularAr.length ? sConf.popularAr : DEFAULT_POPULAR.ar,
    en: Array.isArray(sConf.popularEn) && sConf.popularEn.length ? sConf.popularEn : DEFAULT_POPULAR.en,
  };
  const placeholder = (lang === 'ar' ? sConf.placeholderAr : sConf.placeholderEn) || t('common.search');

  const containerRef = useClickOutside(useCallback(() => setOpen(false), []));

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const go = (q) => {
    const query = (q ?? term).trim();
    if (!query) return;
    addRecent(query);
    setOpen(false);
    setTerm('');
    onNavigate?.();
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  const hasResults =
    suggestions.products?.length || suggestions.categories?.length || suggestions.brands?.length;

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
      >
        <div className="relative">
          <FiSearch className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-ink-muted" size={17} />
          <input
            ref={inputRef}
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="h-12 w-full rounded-full border border-ink/10 bg-white ps-11 pe-24 text-sm outline-none transition placeholder:text-ink-muted/70 focus:border-rose focus:ring-2 focus:ring-rose/15"
            aria-label={t('common.searchShort')}
          />
          {term ? (
            <button
              type="button"
              onClick={() => {
                setTerm('');
                inputRef.current?.focus();
              }}
              className="absolute end-[86px] top-1/2 -translate-y-1/2 text-ink-muted transition hover:text-ink"
              aria-label="clear"
            >
              <FiX size={16} />
            </button>
          ) : null}
          <button
            type="submit"
            className="absolute end-1.5 top-1/2 h-9 -translate-y-1/2 rounded-full bg-ink px-4 text-xs font-bold text-white transition hover:bg-rose"
          >
            {t('common.searchShort')}
          </button>
        </div>
      </form>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-x-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-black/5 bg-white p-4 shadow-lift"
          >
            {debounced.length >= 2 ? (
              <>
                {isLoading ? (
                  <p className="py-6 text-center text-sm text-ink-muted">{t('common.loading')}</p>
                ) : hasResults ? (
                  <div className="space-y-4">
                    {suggestions.products?.length ? (
                      <div>
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                          {t('nav.shop')}
                        </p>
                        <div className="space-y-1">
                          {suggestions.products.map((p) => (
                            <Link
                              key={p._id}
                              to={`/product/${p.slug || p._id}`}
                              onClick={() => {
                                setOpen(false);
                                setTerm('');
                                onNavigate?.();
                              }}
                              className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-blush"
                            >
                              <SmartImage
                                src={p.mainImage}
                                alt=""
                                className="h-12 w-12 shrink-0 rounded-lg object-cover"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="clamp-1 text-sm font-semibold text-ink">{localized(p, lang)}</p>
                                <p className="text-[11px] text-ink-muted">{localized(p.brand, lang)}</p>
                              </div>
                              <span className="shrink-0 text-sm font-bold text-rose">
                                {formatPrice(p.price, lang)}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {suggestions.categories?.length ? (
                      <div>
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                          {t('nav.categories')}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {suggestions.categories.map((c) => (
                            <Link
                              key={c._id}
                              to={`/shop?category=${c.slug}`}
                              onClick={() => {
                                setOpen(false);
                                onNavigate?.();
                              }}
                              className="rounded-full bg-blush px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-rose hover:text-white"
                            >
                              {localized(c, lang)}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {suggestions.brands?.length ? (
                      <div>
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                          {t('nav.brands')}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {suggestions.brands.map((b) => (
                            <Link
                              key={b._id}
                              to={`/shop?brand=${b.slug}`}
                              onClick={() => {
                                setOpen(false);
                                onNavigate?.();
                              }}
                              className="rounded-full border border-ink/10 px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-rose hover:text-rose"
                            >
                              {localized(b, lang)}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => go()}
                      className="w-full rounded-xl bg-ink py-2.5 text-xs font-bold text-white transition hover:bg-rose"
                    >
                      {t('search.resultsFor')} “{debounced}”
                    </button>
                  </div>
                ) : (
                  <p className="py-6 text-center text-sm text-ink-muted">{t('search.noResults')}</p>
                )}
              </>
            ) : (
              <div className="space-y-4">
                {recent.length ? (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                        <FiClock size={12} /> {t('search.recent')}
                      </p>
                      <button
                        type="button"
                        onClick={clearRecent}
                        className="text-[11px] font-semibold text-rose hover:underline"
                      >
                        {t('search.clearRecent')}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {recent.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => go(r)}
                          className="rounded-full bg-black/5 px-3 py-1.5 text-xs text-ink transition hover:bg-blush"
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                    <FiTrendingUp size={12} /> {t('search.popular')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {POPULAR[lang].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => go(p)}
                        className="rounded-full bg-blush px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-rose hover:text-white"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
