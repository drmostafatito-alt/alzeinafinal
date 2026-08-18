import { motion } from 'framer-motion';
import { FiTrendingDown, FiTrendingUp } from 'react-icons/fi';
import { cn } from '@/utils/helpers';

const tones = {
  rose: 'bg-rose/10 text-rose',
  emerald: 'bg-emerald-100 text-emerald-600',
  sky: 'bg-sky-100 text-sky-600',
  amber: 'bg-amber-100 text-amber-600',
  violet: 'bg-violet-100 text-violet-600',
};

export default function StatCard({ icon: Icon, label, value, growth, tone = 'rose', delay = 0 }) {
  const up = growth >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="rounded-2xl border border-black/5 bg-white p-5 shadow-soft"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-ink-muted">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold text-ink">{value}</p>
        </div>
        <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl', tones[tone])}>
          <Icon size={20} />
        </span>
      </div>
      {growth !== undefined && growth !== null ? (
        <p
          className={cn(
            'mt-3 inline-flex items-center gap-1 text-xs font-bold',
            up ? 'text-emerald-600' : 'text-red-600'
          )}
        >
          {up ? <FiTrendingUp size={13} /> : <FiTrendingDown size={13} />}
          {Math.abs(growth)}%
        </p>
      ) : null}
    </motion.div>
  );
}
