import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import SectionHeader from '@/components/ui/SectionHeader';
import Skeleton from '@/components/ui/Skeleton';
import { useCategories } from '@/hooks';
import { useI18n } from '@/i18n';
import { localized } from '@/utils/helpers';
import SmartImage from '@/components/ui/SmartImage';

/**
 * العنوان والوصف يأتيان من قاعدة البيانات (بانى الصفحة الرئيسية).
 * القيم الفارغة ترجع للترجمة الافتراضية، فلا ينكسر أي تثبيت قائم.
 */
export default function CategoriesGrid({ title, subtitle } = {}) {
  const { t, lang } = useI18n();
  const { categories, isLoading } = useCategories();

  /**
   * لا نعرض عنوان "تسوّقي حسب القسم" فوق شبكة فارغة.
   * القسم يختفي بالكامل حتى يضيف المدير أقساماً — أثناء التحميل يبقى
   * ظاهراً بالهياكل العظمية حتى لا يقفز التخطيط.
   */
  if (!isLoading && !categories.length) return null;

  return (
    <section className="section">
      <div className="container-x">
        <SectionHeader
          title={title || t('home.categories.title')}
          subtitle={subtitle || t('home.categories.subtitle')}
          viewAllTo="/categories"
        />

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="aspect-[4/5]" rounded="rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {categories.slice(0, 6).map((c, i) => (
              <motion.div
                key={c._id}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
              >
                <Link
                  to={`/shop?category=${c.slug}`}
                  className="group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-blush shadow-soft transition hover:shadow-card"
                >
                  <SmartImage
                    src={c.image}
                    alt={localized(c, lang)}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3 text-center">
                    <p className="clamp-2 text-xs font-bold text-white sm:text-sm">{localized(c, lang)}</p>
                    <p className="mt-1 text-[10px] text-white/60">
                      {c.productCount || 0} {t('categories.products')}
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
