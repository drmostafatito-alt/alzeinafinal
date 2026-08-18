import { FiStar } from 'react-icons/fi';
import { cn } from '@/utils/helpers';

export default function Rating({ value = 0, count, size = 14, className, showValue = false, interactive = false, onChange }) {
  const stars = [1, 2, 3, 4, 5];

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      <div className="flex items-center gap-0.5">
        {stars.map((s) => {
          const filled = value >= s - 0.5;
          const Star = (
            <FiStar
              key={s}
              size={size}
              className={cn(
                'transition-colors',
                filled ? 'fill-amber-400 text-amber-400' : 'text-ink/20',
                interactive && 'cursor-pointer hover:scale-110'
              )}
            />
          );
          if (!interactive) return Star;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onChange?.(s)}
              className="p-0.5"
              aria-label={`${s} stars`}
            >
              {Star}
            </button>
          );
        })}
      </div>
      {showValue && value > 0 ? (
        <span className="text-xs font-semibold text-ink-soft">{Number(value).toFixed(1)}</span>
      ) : null}
      {count !== undefined ? <span className="text-xs text-ink-muted">({count})</span> : null}
    </div>
  );
}
