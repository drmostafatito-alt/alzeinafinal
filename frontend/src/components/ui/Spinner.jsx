import { cn } from '@/utils/helpers';

export default function Spinner({ size = 20, className }) {
  return (
    <span
      className={cn('inline-block animate-spin rounded-full border-2 border-current border-t-transparent', className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="loading"
    />
  );
}

export function PageSpinner({ label }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-rose">
      <Spinner size={40} />
      {label ? <p className="text-sm text-ink-muted">{label}</p> : null}
    </div>
  );
}
