import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiArrowRight } from 'react-icons/fi';
import PageHeader from '@/components/common/PageHeader';
import Skeleton from '@/components/ui/Skeleton';
import { useBrands, useCategories } from '@/hooks';
import { useI18n } from '@/i18n';
import { localized } from '@/utils/helpers';
import SmartImage from '@/components/ui/SmartImage';

export default function Categories() {
  const { t, lang, isRTL } = useI18n();
  const { categories, isLoading } = useCategories();
  const { brands } = useBrands();
  const Arrow = isRTL ? FiArrowLeft : FiArrowRight;

  return (
    <>
      <PageHeader
        title={t('categories.title')}
        subtitle={t('categories.subtitle')}
        breadcrumbs={[{ label: t('categories.title') }]}
      />

      <div className="container-x py-8">
        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-64" rounded="rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c, i) => (
              <motion.div
                key={c._id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
              >
                <Link
                  to={`/shop?category=${c.slug}`}
                  className="group relative block h-64 overflow-hidden rounded-2xl bg-ink shadow-soft transition hover:shadow-card"
                >
                  <SmartImage
                    src={c.image}
                    alt={localized(c, lang)}
                    loading="lazy"
                    className="h-full w-full object-cover opacity-80 transition duration-700 group-hover:scale-110 group-hover:opacity-70"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-6">
                    <h3 className="text-lg font-bold text-white">{localized(c, lang)}</h3>
                    <p className="clamp-2 mt-1.5 text-xs text-white/65">{localized(c, lang, 'description')}</p>
                    <span className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-rose-200 transition group-hover:text-white">
                      {c.productCount || 0} {t('categories.products')}
                      <Arrow size={14} className="transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}

        {/* Brands */}
        <section className="mt-14">
          <h2 className="mb-6 text-xl font-bold text-ink">{t('home.brands.title')}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {brands.map((b) => (
              <Link
                key={b._id}
                to={`/shop?brand=${b.slug}`}
                className="group flex h-20 flex-col items-center justify-center rounded-xl border border-black/5 bg-white px-3 shadow-soft transition hover:border-rose/40 hover:shadow-card"
              >
                <span className="text-center text-sm font-bold text-ink transition group-hover:text-rose">
                  {b.nameEn || b.name}
                </span>
                <span className="mt-1 text-[10px] text-ink-muted">
                  {b.productCount || 0} {t('categories.products')}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
