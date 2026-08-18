import { memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiX } from 'react-icons/fi';
import { useI18n } from '@/i18n';

/**
 * شريط الإجراءات الجماعية — يظهر فقط عند تحديد عناصر.
 * مُغلَّف بـ memo لأنه يُصيَّر داخل صفحات بها جداول كبيرة.
 */
function BulkBar({ count, onClear, children }) {
  const { t } = useI18n();

  return (
    <AnimatePresence>
      {count > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.18 }}
          className="sticky bottom-4 z-20 mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-ink/10 bg-ink p-3 text-white shadow-lift"
          role="region"
          aria-label={t('a3.bulkActions')}
        >
          <span className="ms-1 flex items-center gap-2 text-sm font-bold">
            <span className="grid h-6 min-w-6 place-items-center rounded-full bg-white px-1.5 text-xs text-ink">
              {count}
            </span>
            {t('a3.selected')}
          </span>

          <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>

          <button
            type="button"
            onClick={onClear}
            className="grid h-8 w-8 place-items-center rounded-lg text-white/70 transition hover:bg-white/15 hover:text-white"
            aria-label={t('a3.clearSelection')}
            title={t('a3.clearSelection')}
          >
            <FiX size={16} />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default memo(BulkBar);
