import { AnimatePresence, motion } from 'framer-motion';
import { FiArrowUp } from 'react-icons/fi';
import { useScrolled } from '@/hooks';

export default function BackToTop() {
  const visible = useScrolled(500);
  return (
    <AnimatePresence>
      {visible ? (
        <motion.button
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 end-6 z-30 grid h-11 w-11 place-items-center rounded-full bg-ink text-white shadow-lift transition hover:bg-rose"
          aria-label="back to top"
        >
          <FiArrowUp size={18} />
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}
