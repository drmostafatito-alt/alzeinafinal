import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { FiX } from 'react-icons/fi';
import { useEscapeKey, useLockBodyScroll } from '@/hooks';
import { useI18n } from '@/i18n';
import { cn } from '@/utils/helpers';

export default function Drawer({ open, onClose, title, children, footer, side = 'end', width = 'max-w-md' }) {
  const { isRTL } = useI18n();
  const { pathname, search } = useLocation();
  useEscapeKey(() => onClose?.(), open);
  useLockBodyScroll(open);

  /**
   * إغلاق تلقائي عند تغيير المسار.
   * أي رابط داخل الدروَر (روابط المنتجات، قائمة الجوال، …) كان يغيّر الصفحة
   * بينما يبقى الدروَر والطبقة السوداء فوقها، فيبدو الموقع "متجمداً".
   * نتجاهل أول تشغيل حتى لا نغلق الدروَر لحظة فتحه.
   */
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (open) onClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  // side "end" = يمين في LTR ويسار في RTL
  const physicalSide = side === 'end' ? (isRTL ? 'left' : 'right') : isRTL ? 'right' : 'left';
  const offscreen = physicalSide === 'right' ? '100%' : '-100%';

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[110]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: offscreen }}
            animate={{ x: 0 }}
            exit={{ x: offscreen }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className={cn(
              'absolute top-0 flex h-full w-full flex-col bg-white shadow-lift',
              width,
              physicalSide === 'right' ? 'right-0' : 'left-0'
            )}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-black/5 px-5 py-4">
              <h3 className="text-base font-bold text-ink">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-ink-muted transition hover:bg-blush hover:text-ink"
                aria-label="close"
              >
                <FiX size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{children}</div>
            {footer ? <div className="shrink-0 border-t border-black/5 bg-cream p-5">{footer}</div> : null}
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
