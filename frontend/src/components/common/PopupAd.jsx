import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiX } from 'react-icons/fi';
import { useConfig } from '@/config/ConfigProvider';
import { useI18n } from '@/i18n';
import { readStorage, writeStorage } from '@/utils/helpers';
import SmartImage from '@/components/ui/SmartImage';

const KEY = 'alzeina_popup_seen';

/** إعلان منبثق يديره المدير بالكامل (المحتوى، التوقيت، التكرار، مكان الظهور) */
export default function PopupAd() {
  const { popups, settings } = useConfig();
  const { lang } = useI18n();
  const { pathname } = useLocation();
  const [active, setActive] = useState(null);

  useEffect(() => {
    if (settings.features?.popups === false || !popups?.length) return undefined;

    const page = pathname === '/' ? 'home' : pathname.startsWith('/shop') ? 'shop'
      : pathname.startsWith('/product') ? 'product' : 'other';

    const seen = readStorage(KEY, {});
    const candidate = popups.find((p) => {
      if (p.showOn !== 'all' && p.showOn !== page) return false;
      const last = seen[p._id];
      if (last && Date.now() - last < (p.repeatAfterHours ?? 24) * 3600 * 1000) return false;
      return true;
    });
    if (!candidate) return undefined;

    const timer = setTimeout(() => setActive(candidate), (candidate.delaySeconds ?? 3) * 1000);
    return () => clearTimeout(timer);
  }, [popups, pathname, settings.features]);

  const close = () => {
    if (active) writeStorage(KEY, { ...readStorage(KEY, {}), [active._id]: Date.now() });
    setActive(null);
  };

  return (
    <AnimatePresence>
      {active ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 22 }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-lift"
          >
            <button
              type="button"
              onClick={close}
              className="absolute end-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-ink shadow-soft transition hover:bg-blush"
              aria-label="close"
            >
              <FiX size={18} />
            </button>

            {active.image ? (
              <SmartImage src={active.image} alt="" className="h-48 w-full object-cover" />
            ) : null}

            <div className="p-6 text-center">
              <h3 className="text-xl font-bold text-ink">
                {(lang === 'ar' ? active.title : active.titleEn) || active.title}
              </h3>
              {active.body ? (
                <p className="mt-2 text-sm text-ink-muted">
                  {(lang === 'ar' ? active.body : active.bodyEn) || active.body}
                </p>
              ) : null}

              {active.link ? (
                <Link to={active.link} onClick={close} className="btn-rose mt-5 inline-flex">
                  {(lang === 'ar' ? active.buttonText : active.buttonTextEn) || active.buttonText || '→'}
                </Link>
              ) : null}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
