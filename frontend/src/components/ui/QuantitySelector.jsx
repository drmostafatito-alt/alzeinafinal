import { FiMinus, FiPlus } from 'react-icons/fi';
import { cn } from '@/utils/helpers';

export default function QuantitySelector({ value = 1, onChange, min = 1, max = 99, size = 'md', className }) {
  const sizes = {
    sm: { btn: 'h-8 w-8', text: 'w-8 text-xs', icon: 12 },
    md: { btn: 'h-10 w-10', text: 'w-12 text-sm', icon: 14 },
    lg: { btn: 'h-12 w-12', text: 'w-14 text-base', icon: 16 },
  }[size];

  const set = (v) => onChange?.(Math.max(min, Math.min(max, v)));

  return (
    <div className={cn('inline-flex items-center overflow-hidden rounded-full border border-ink/10 bg-white', className)}>
      <button
        type="button"
        onClick={() => set(value - 1)}
        disabled={value <= min}
        className={cn(sizes.btn, 'flex items-center justify-center text-ink transition hover:bg-blush disabled:opacity-30')}
        aria-label="decrease"
      >
        <FiMinus size={sizes.icon} />
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => set(Number(e.target.value) || min)}
        className={cn(sizes.text, 'border-x border-ink/10 bg-transparent py-2 text-center font-bold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none')}
        min={min}
        max={max}
        aria-label="quantity"
      />
      <button
        type="button"
        onClick={() => set(value + 1)}
        disabled={value >= max}
        className={cn(sizes.btn, 'flex items-center justify-center text-ink transition hover:bg-blush disabled:opacity-30')}
        aria-label="increase"
      >
        <FiPlus size={sizes.icon} />
      </button>
    </div>
  );
}
