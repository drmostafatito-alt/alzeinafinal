import { cn } from '@/utils/helpers';

const variants = {
  rose: 'bg-rose text-white',
  ink: 'bg-ink text-white',
  blush: 'bg-blush text-rose-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-600 text-white',
  neutral: 'bg-black/5 text-ink-soft',
  outline: 'border border-ink/15 bg-white text-ink-soft',
};

export default function Badge({ children, variant = 'rose', className, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold leading-none',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
