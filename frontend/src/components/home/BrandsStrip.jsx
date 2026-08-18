import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import SectionHeader from '@/components/ui/SectionHeader';
import Skeleton from '@/components/ui/Skeleton';
import { useBrands } from '@/hooks';
import { useI18n } from '@/i18n';
import { localized } from '@/utils/helpers';

/**
 * العنوان والوصف يأتيان من قاعدة البيانات (بانى الصفحة الرئيسية).
 * القيم الفارغة ترجع للترجمة الافتراضية، فلا ينكسر أي تثبيت قائم.
 */
export default function BrandsStrip({ title, subtitle } = {}) {
  const { t, lang } = useI18n();
  const { brands, isLoading } = useBrands();

  /** شريط الماركات بلا ماركات = عنوان فوق فراغ. نخفيه بالكامل. */
  if (!isLoading && !brands.length) return null;

  return (
    <section className="section">
      <div className="container-x">
        <SectionHeader title={title || t('home.brands.title')} subtitle={subtitle || t('home.brands.subtitle')} align="center" />

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-20" rounded="rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {brands.slice(0, 8).map((b, i) => (
              <motion.div
                key={b._id}
                initial={{ opacity: 0, scale: 0.94 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.05 }}
              >
                <Link
                  to={`/shop?brand=${b.slug}`}
                  className="group flex h-20 items-center justify-center rounded-xl border border-black/5 bg-white px-3 shadow-soft transition hover:border-rose/40 hover:shadow-card"
                >
                  <span className="text-center text-sm font-bold text-ink-muted transition group-hover:text-rose">
                    {lang === 'ar' ? b.nameEn || b.name : b.nameEn || b.name}
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
