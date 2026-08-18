import { Link } from 'react-router-dom';
import { FiArrowLeft, FiArrowRight } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useI18n } from '@/i18n';
import { cn } from '@/utils/helpers';

export default function SectionHeader({ title, subtitle, viewAllTo, align = 'between', className }) {
  const { t, isRTL } = useI18n();
  const Arrow = isRTL ? FiArrowLeft : FiArrowRight;

  return (
    <div
      className={cn(
        'mb-8 flex gap-4',
        align === 'center' ? 'flex-col items-center text-center' : 'flex-wrap items-end justify-between',
        className
      )}
    >
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.45 }}
      >
        <div className={cn('mb-2 flex items-center gap-3', align === 'center' && 'justify-center')}>
          <span className="h-px w-8 bg-rose" />
          <h2 className="section-title">{title}</h2>
          {align === 'center' ? <span className="h-px w-8 bg-rose" /> : null}
        </div>
        {subtitle ? <p className="text-sm text-ink-muted">{subtitle}</p> : null}
      </motion.div>

      {viewAllTo ? (
        <Link
          to={viewAllTo}
          className="group inline-flex items-center gap-2 text-sm font-semibold text-ink transition hover:text-rose"
        >
          {t('common.viewAll')}
          <Arrow className="transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
        </Link>
      ) : null}
    </div>
  );
}
