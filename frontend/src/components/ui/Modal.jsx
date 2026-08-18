import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { FiX } from 'react-icons/fi';
import { useEscapeKey, useLockBodyScroll } from '@/hooks';
import { cn } from '@/utils/helpers';

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
  full: 'max-w-[95vw]',
};

export default function Modal({ open, onClose, title, children, size = 'md', footer, className }) {
  const { pathname, search } = useLocation();
  useEscapeKey(() => onClose?.(), open);
  useLockBodyScroll(open);

  // إغلاق المودال تلقائياً عند تغيير المسار حتى لا تبقى طبقة معلّقة فوق الصفحة
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (open) onClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className={cn(
              'relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-lift',
              sizes[size],
              className
            )}
            role="dialog"
            aria-modal="true"
          >
            {title ? (
              <div className="flex items-center justify-between border-b border-black/5 px-6 py-4">
                <h3 className="text-lg font-bold text-ink">{title}</h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-2 text-ink-muted transition hover:bg-blush hover:text-ink"
                  aria-label="close"
                >
                  <FiX size={18} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="absolute end-4 top-4 z-20 rounded-full bg-white/90 p-2 text-ink shadow-soft transition hover:bg-blush"
                aria-label="close"
              >
                <FiX size={18} />
              </button>
            )}
            <div className="flex-1 overflow-y-auto">{children}</div>
            {footer ? <div className="border-t border-black/5 px-6 py-4">{footer}</div> : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmText, cancelText, danger }) {
  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="p-6 text-center">
        <h3 className="mb-2 text-lg font-bold text-ink">{title}</h3>
        {message ? <p className="mb-6 text-sm text-ink-muted">{message}</p> : null}
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-outline flex-1">
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm?.();
              onClose?.();
            }}
            className={cn('btn flex-1 text-white', danger ? 'bg-red-600 hover:bg-red-700' : 'bg-ink hover:bg-rose')}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
