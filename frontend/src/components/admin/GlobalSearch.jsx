import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiCreditCard, FiLayers, FiPackage, FiSearch, FiShoppingCart, FiTag, FiUsers, FiX
} from 'react-icons/fi';
import client from '@/api/client';
import { useDebounced } from '@/hooks/useDebounced';
import { useI18n } from '@/i18n';
import { cn } from '@/utils/helpers';

const TYPE_META = {
  product: { icon: FiPackage, tone: 'bg-violet-100 text-violet-600' },
  order: { icon: FiShoppingCart, tone: 'bg-sky-100 text-sky-600' },
  customer: { icon: FiUsers, tone: 'bg-emerald-100 text-emerald-600' },
  category: { icon: FiLayers, tone: 'bg-amber-100 text-amber-600' },
  brand: { icon: FiTag, tone: 'bg-rose/15 text-rose' },
  coupon: { icon: FiCreditCard, tone: 'bg-indigo-100 text-indigo-600' }
};

/**
 * بحث شامل في لوحة الإدارة.
 * • مؤجَّل (debounced) حتى لا يُرسل طلباً مع كل حرف.
 * • تنقّل كامل بلوحة المفاتيح: ↑ ↓ Enter Escape.
 * • يُفتح بـ Ctrl/Cmd + K من أي مكان في اللوحة.
 */
export default function GlobalSearch() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const debounced = useDebounced(query, 300);

  const { data, isFetching } = useQuery({
    queryKey: ['admin', 'global-search', debounced],
    queryFn: () => client.get('/admin/search', { params: { q: debounced } }).then((r) => r.data?.data),
    enabled: open && debounced.trim().length >= 2,
    staleTime: 20000
  });

  const results = useMemo(() => data?.results || [], [data]);

  // اختصار عام لفتح البحث
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
    else { setQuery(''); setActive(0); }
  }, [open]);

  useEffect(() => setActive(0), [debounced]);

  const go = useCallback(
    (item) => {
      if (!item) return;
      setOpen(false);
      navigate(item.link);
    },
    [navigate]
  );

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(results[active]);
    }
  };

  // إبقاء العنصر النشط ظاهراً
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 items-center gap-2 rounded-xl border border-black/10 px-3 text-sm text-ink-muted transition hover:border-rose hover:text-rose"
        aria-label={t('a3.globalSearch')}
        title="Ctrl + K"
      >
        <FiSearch size={16} />
        <span className="hidden lg:inline">{t('a3.globalSearch')}</span>
        <kbd className="font-en hidden rounded border border-black/10 bg-cream px-1.5 py-0.5 text-[10px] font-bold xl:inline">
          ⌘K
        </kbd>
      </button>

      <AnimatePresence>
        {open ? (
          <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[10vh]">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              role="dialog"
              aria-modal="true"
              aria-label={t('a3.globalSearch')}
              className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-black/5 bg-white shadow-lift"
            >
              <div className="flex items-center gap-3 border-b border-black/5 px-4">
                <FiSearch className="shrink-0 text-ink-muted" size={18} />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={t('a3.searchEverything')}
                  aria-label={t('a3.searchEverything')}
                  className="h-14 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-ink-muted"
                />
                {isFetching ? (
                  <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-rose border-t-transparent" />
                ) : null}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-muted transition hover:bg-blush"
                  aria-label={t('common.close')}
                >
                  <FiX size={16} />
                </button>
              </div>

              <div ref={listRef} className="max-h-[55vh] overflow-y-auto">
                {debounced.trim().length < 2 ? (
                  <p className="p-8 text-center text-xs text-ink-muted">{t('a3.searchHint')}</p>
                ) : results.length === 0 && !isFetching ? (
                  <p className="p-8 text-center text-xs text-ink-muted">{t('a3.noResults')}</p>
                ) : (
                  <ul className="p-2">
                    {results.map((r, i) => {
                      const meta = TYPE_META[r.type] || TYPE_META.product;
                      const Icon = meta.icon;
                      return (
                        <li key={`${r.type}-${r.id}`}>
                          <button
                            type="button"
                            data-idx={i}
                            onMouseEnter={() => setActive(i)}
                            onClick={() => go(r)}
                            className={cn(
                              'flex w-full items-center gap-3 rounded-xl p-2.5 text-start transition',
                              active === i ? 'bg-blush' : 'hover:bg-cream'
                            )}
                          >
                            <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', meta.tone)}>
                              <Icon size={15} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="clamp-1 block text-sm font-semibold text-ink">
                                {lang === 'en' && r.titleEn ? r.titleEn : r.title}
                              </span>
                              {r.subtitle ? (
                                <span className="clamp-1 block text-[11px] text-ink-muted">{r.subtitle}</span>
                              ) : null}
                            </span>
                            <span className="shrink-0 rounded-full bg-cream px-2 py-0.5 text-[10px] font-bold text-ink-muted">
                              {t(`admin.${r.type === 'customer' ? 'customers' : `${r.type}s`}`)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
