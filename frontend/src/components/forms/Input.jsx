import { forwardRef, useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { cn } from '@/utils/helpers';

const Input = forwardRef(function Input(
  { label, error, hint, icon: Icon, type = 'text', className, containerClassName, required, ...props },
  ref
) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (show ? 'text' : 'password') : type;

  return (
    <div className={cn('w-full', containerClassName)}>
      {label ? (
        <label className="label">
          {label} {required ? <span className="text-rose">*</span> : null}
        </label>
      ) : null}
      <div className="relative">
        {Icon ? (
          <Icon className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-muted" size={16} />
        ) : null}
        <input
          ref={ref}
          type={inputType}
          className={cn(
            'input',
            Icon && 'ps-10',
            isPassword && 'pe-10',
            error && 'border-red-400 focus:border-red-500 focus:ring-red-200',
            className
          )}
          {...props}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute end-3 top-1/2 -translate-y-1/2 text-ink-muted transition hover:text-rose"
            tabIndex={-1}
            aria-label="toggle password"
          >
            {show ? <FiEyeOff size={16} /> : <FiEye size={16} />}
          </button>
        ) : null}
      </div>
      {error ? <p className="field-error">{error}</p> : hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
});

export default Input;

export const Textarea = forwardRef(function Textarea(
  { label, error, hint, className, containerClassName, required, rows = 4, ...props },
  ref
) {
  return (
    <div className={cn('w-full', containerClassName)}>
      {label ? (
        <label className="label">
          {label} {required ? <span className="text-rose">*</span> : null}
        </label>
      ) : null}
      <textarea
        ref={ref}
        rows={rows}
        className={cn('input resize-y', error && 'border-red-400 focus:border-red-500 focus:ring-red-200', className)}
        {...props}
      />
      {error ? <p className="field-error">{error}</p> : hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
});

export const Select = forwardRef(function Select(
  { label, error, hint, options = [], placeholder, className, containerClassName, required, children, ...props },
  ref
) {
  return (
    <div className={cn('w-full', containerClassName)}>
      {label ? (
        <label className="label">
          {label} {required ? <span className="text-rose">*</span> : null}
        </label>
      ) : null}
      <select
        ref={ref}
        className={cn(
          'input cursor-pointer appearance-none bg-[length:16px] bg-no-repeat pe-10',
          error && 'border-red-400 focus:border-red-500',
          className
        )}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236B6B6B' stroke-width='2'><polyline points='6 9 12 15 18 9'/></svg>\")",
          backgroundPosition: 'left 0.9rem center',
        }}
        {...props}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {children}
      </select>
      {error ? <p className="field-error">{error}</p> : hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
});

export const Checkbox = forwardRef(function Checkbox({ label, error, className, containerClassName, ...props }, ref) {
  return (
    <div className={cn('w-full', containerClassName)}>
      <label className={cn('flex cursor-pointer items-start gap-2.5 text-sm text-ink-soft', className)}>
        <input
          ref={ref}
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-ink/25 text-rose accent-rose focus:ring-rose/30"
          {...props}
        />
        <span>{label}</span>
      </label>
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
});

export const RadioCard = forwardRef(function RadioCard(
  { label, description, icon: Icon, checked, className, ...props },
  ref
) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition',
        checked ? 'border-rose bg-blush/50 shadow-soft' : 'border-ink/10 bg-white hover:border-rose/40',
        className
      )}
    >
      <input ref={ref} type="radio" className="mt-1 h-4 w-4 accent-rose" checked={checked} {...props} />
      <span className="flex-1">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          {Icon ? <Icon className="text-rose" size={16} /> : null}
          {label}
        </span>
        {description ? <span className="mt-1 block text-xs text-ink-muted">{description}</span> : null}
      </span>
    </label>
  );
});
