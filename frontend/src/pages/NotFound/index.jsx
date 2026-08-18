import { motion } from 'framer-motion';
import { FiHome, FiSearch, FiShoppingBag } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import { useI18n } from '@/i18n';

export default function NotFound() {
  const { t } = useI18n();

  return (
    <div className="container-x relative flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
      {/* توهج زخرفي خلف الرقم يعطي عمقاً بدل خلفية مسطّحة */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/3 h-64 w-64 -translate-y-1/2 rounded-full bg-rose/10 blur-3xl"
      />
      <motion.p
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="font-en bg-gradient-to-b from-rose/40 to-rose/10 bg-clip-text text-[120px] font-black leading-none text-transparent md:text-[180px]"
      >
        404
      </motion.p>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <h1 className="-mt-6 text-2xl font-bold text-ink md:text-3xl">{t('notFound.title')}</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-muted">{t('notFound.desc')}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button to="/" icon={FiHome}>
            {t('notFound.home')}
          </Button>
          <Button to="/shop" variant="outline" icon={FiShoppingBag}>
            {t('nav.shop')}
          </Button>
          <Button to="/search" variant="ghost" icon={FiSearch}>
            {t('common.searchShort')}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
