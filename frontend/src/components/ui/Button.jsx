import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/utils/helpers';
import Spinner from './Spinner';

const variants = {
  primary: 'bg-ink text-white hover:bg-rose hover:shadow-card',
  rose: 'bg-rose text-white hover:bg-rose-600 hover:shadow-card',
  outline: 'border border-ink/15 bg-white text-ink hover:border-rose hover:text-rose',
  ghost: 'text-ink hover:bg-blush',
  soft: 'bg-blush text-ink hover:bg-rose-100',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  white: 'bg-white text-ink hover:bg-blush shadow-soft',
  link: 'text-rose hover:text-rose-700 underline-offset-4 hover:underline !px-0 !py-0',
};

const sizes = {
  xs: 'px-3 py-1.5 text-[11px]',
  sm: 'px-4 py-2 text-xs',
  md: 'px-6 py-3 text-sm',
  lg: 'px-8 py-3.5 text-base',
  icon: 'h-10 w-10 p-0',
  iconSm: 'h-9 w-9 p-0',
};

const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    className,
    loading = false,
    disabled,
    fullWidth,
    icon: Icon,
    iconEnd: IconEnd,
    to,
    href,
    type = 'button',
    ...props
  },
  ref
) {
  const classes = cn(
    'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-300',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-rose/40 focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-60',
    variants[variant],
    sizes[size],
    fullWidth && 'w-full',
    className
  );

  const content = (
    <>
      {loading ? <Spinner size={size === 'lg' ? 20 : 16} /> : Icon ? <Icon className="shrink-0 text-[1.1em]" /> : null}
      {children}
      {IconEnd && !loading ? <IconEnd className="shrink-0 text-[1.1em]" /> : null}
    </>
  );

  if (to) {
    return (
      <Link ref={ref} to={to} className={classes} {...props}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a ref={ref} href={href} className={classes} target="_blank" rel="noreferrer" {...props}>
        {content}
      </a>
    );
  }
  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || loading} {...props}>
      {content}
    </button>
  );
});

export default Button;
