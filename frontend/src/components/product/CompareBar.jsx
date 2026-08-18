import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiBarChart2, FiX } from 'react-icons/fi';
import SmartImage from '@/components/ui/SmartImage';
import { useI18n } from '@/i18n';
import { useCompareStore } from '@/store/compareStore';
import { localized } from '@/utils/helpers';

/**
 * شريط المقارنة العائم.
 *
 * يظهر فقط عند وجود منتج واحد على الأقل في المقارنة، ويبقى في متناول
 * المستخدم أثناء تصفّح المنتجات. على الجوال نرفعه فوق شريط الإجراءات
 * الثابت في صفحة المنتج حتى لا يتداخلا.
 */
export default function CompareBar() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const items = useCompareStore((s) => s.items);
  const remove = useCompareStore((s) => s.remove);
  const clear = useCompareStore((s) => s.clear);

  return (
    <AnimatePresence>
      {items.length > 0 ? (
        <motion.div
          initial={{ y: 90, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 90, opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-white/95 backdrop-blur lg:bottom-4 lg:inset-x-auto lg:end-4 lg:w-auto lg:rounded-2xl lg:border"
          style={{ boxShadow: 'var(--shadow-lg)' }}
          role="region"
          aria-label={t('compare.title')}
        >
          <div className="container-x flex items-center gap-3 py-3 lg:container-none lg:px-4">
            <span className="hidden shrink-0 items-center gap-2 text-xs font-bold text-ink sm:inline-flex">
              <FiBarChart2 size={15} className="text-rose" aria-hidden="true" />
              {t('compare.title')}
            </span>

            <ul className="flex flex-1 items-center gap-2 overflow-x-auto no-scrollbar">
              {items.map((p) => (
                <li key={p.productId} className="relative shrink-0">
                  <div className="h-12 w-12 overflow-hidden rounded-lg border border-black/10 bg-blush">
                    <SmartImage src={p.image} alt={localized(p, lang)} className="h-full w-full object-cover" />
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(p.productId)}
                    className="absolute -end-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink text-white transition hover:bg-red-600"
                    aria-label={`${t('common.delete')} ${localized(p, lang)}`}
                  >
                    <FiX size={10} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={clear}
                className="hidden text-xs font-semibold text-ink-muted transition hover:text-red-600 sm:block"
              >
                {t('compare.clearAll')}
              </button>
              <button
                type="button"
                onClick={() => navigate('/compare')}
                disabled={items.length < 2}
                className="btn btn-sm bg-ink text-white hover:bg-rose disabled:opacity-50"
              >
                {t('compare.view')}
                <span className="font-en">({items.length})</span>
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
