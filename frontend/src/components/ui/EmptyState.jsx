import { FiInbox } from 'react-icons/fi';
import Button from './Button';
import { cn } from '@/utils/helpers';

/**
 * حالة فارغة.
 *
 * الحالة الفارغة ليست خطأ — هي فرصة لتوجيه المستخدم للخطوة التالية.
 * لذلك تدعم إجراءً رئيسياً وآخر ثانوياً، مع رسم زخرفي خفيف يجعلها
 * تبدو مقصودة بدل أن تبدو كصفحة معطّلة.
 */
export default function EmptyState({
  icon: Icon = FiInbox,
  title,
  description,
  actionLabel,
  actionTo,
  onAction,
  secondaryLabel,
  secondaryTo,
  onSecondary,
  compact = false,
  className,
  children
}) {
  return (
    <div
      className={cn(
        'animate-rise flex flex-col items-center justify-center px-6 text-center',
        compact ? 'py-10' : 'py-16',
        className
      )}
    >
      {/* هالة زخرفية خلف الأيقونة */}
      <div className="relative mb-5">
        <span
          aria-hidden="true"
          className="absolute inset-0 -z-10 animate-pulse rounded-full bg-rose/10 blur-2xl"
        />
        <div
          className={cn(
            'grid place-items-center rounded-full bg-gradient-to-br from-blush to-blush/50 text-rose ring-1 ring-rose/10',
            compact ? 'h-16 w-16' : 'h-20 w-20'
          )}
        >
          <Icon size={compact ? 26 : 32} aria-hidden="true" />
        </div>
      </div>

      <h3 className={cn('mb-2 font-bold text-ink', compact ? 'text-base' : 'text-xl')}>{title}</h3>

      {description ? (
        <p className="mb-6 max-w-sm text-sm leading-relaxed text-ink-muted">{description}</p>
      ) : null}

      {actionLabel || secondaryLabel ? (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {actionLabel ? (
            <Button to={actionTo} onClick={onAction} variant="primary">
              {actionLabel}
            </Button>
          ) : null}
          {secondaryLabel ? (
            <Button to={secondaryTo} onClick={onSecondary} variant="outline">
              {secondaryLabel}
            </Button>
          ) : null}
        </div>
      ) : null}

      {children}
    </div>
  );
}
