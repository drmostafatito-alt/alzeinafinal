import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { useI18n } from '@/i18n';
import { cn } from '@/utils/helpers';

export default function Pagination({ page = 1, pages = 1, onChange, className }) {
  const { isRTL } = useI18n();
  if (pages <= 1) return null;

  const Prev = isRTL ? FiChevronRight : FiChevronLeft;
  const Next = isRTL ? FiChevronLeft : FiChevronRight;

  const build = () => {
    const list = [];
    const push = (v) => list.push(v);
    push(1);
    const start = Math.max(2, page - 1);
    const end = Math.min(pages - 1, page + 1);
    if (start > 2) push('…');
    for (let i = start; i <= end; i += 1) push(i);
    if (end < pages - 1) push('…');
    if (pages > 1) push(pages);
    return list;
  };

  const btn = 'flex h-10 min-w-10 items-center justify-center rounded-xl px-3 text-sm font-semibold transition';

  return (
    <nav className={cn('flex flex-wrap items-center justify-center gap-2', className)} aria-label="pagination">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className={cn(btn, 'border border-ink/10 bg-white text-ink hover:border-rose hover:text-rose disabled:opacity-40 disabled:hover:border-ink/10 disabled:hover:text-ink')}
        aria-label="previous page"
      >
        <Prev size={18} />
      </button>

      {build().map((p, i) =>
        p === '…' ? (
          <span key={`e${i}`} className="px-1 text-ink-muted">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={cn(
              btn,
              p === page
                ? 'bg-ink text-white shadow-soft'
                : 'border border-ink/10 bg-white text-ink hover:border-rose hover:text-rose'
            )}
            aria-current={p === page ? 'page' : undefined}
          >
            {p}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= pages}
        className={cn(btn, 'border border-ink/10 bg-white text-ink hover:border-rose hover:text-rose disabled:opacity-40 disabled:hover:border-ink/10 disabled:hover:text-ink')}
        aria-label="next page"
      >
        <Next size={18} />
      </button>
    </nav>
  );
}
