import { useI18n } from '@/i18n';
import { formatPrice } from '@/utils/format';
import { cn } from '@/utils/helpers';

export default function Price({ value, oldValue, size = 'md', className, inline = true }) {
  const { lang } = useI18n();
  const sizes = {
    sm: { now: 'text-sm', old: 'text-[11px]' },
    md: { now: 'text-base', old: 'text-xs' },
    lg: { now: 'text-2xl', old: 'text-sm' },
    xl: { now: 'text-3xl', old: 'text-base' },
  }[size];

  return (
    <div className={cn(inline ? 'flex items-center gap-2' : 'flex flex-col', className)}>
      <span className={cn('font-bold text-ink', sizes.now)}>{formatPrice(value, lang)}</span>
      {oldValue && oldValue > value ? (
        <span className={cn('font-medium text-ink-muted line-through', sizes.old)}>
          {formatPrice(oldValue, lang)}
        </span>
      ) : null}
    </div>
  );
}
