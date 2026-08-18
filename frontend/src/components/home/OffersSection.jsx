import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiArrowRight, FiZap } from 'react-icons/fi';
import ProductCarousel from '@/components/product/ProductCarousel';
import SectionHeader from '@/components/ui/SectionHeader';
import { useBanners, useCountdown, useOnSaleProducts } from '@/hooks';
import { useConfig } from '@/config/ConfigProvider';
import { useI18n } from '@/i18n';
import { localized } from '@/utils/helpers';
import SmartImage from '@/components/ui/SmartImage';

function CountdownBox({ value, label }) {
  return (
    <div className="flex min-w-[58px] flex-col items-center rounded-xl bg-white/10 px-3 py-2 backdrop-blur">
      <span className="font-en text-xl font-bold text-white tabular-nums md:text-2xl">
        {String(value).padStart(2, '0')}
      </span>
      <span className="mt-0.5 text-[10px] font-medium text-white/60">{label}</span>
    </div>
  );
}

/**
 * العنوان والوصف يأتيان من قاعدة البيانات (بانى الصفحة الرئيسية).
 * القيم الفارغة ترجع للترجمة الافتراضية، فلا ينكسر أي تثبيت قائم.
 */
export default function OffersSection({ title, subtitle } = {}) {
  const { t, lang, isRTL } = useI18n();
  const { products, isLoading } = useOnSaleProducts(10);
  const { banners } = useBanners('featured');
  const { flashSales } = useConfig();
  const Arrow = isRTL ? FiArrowLeft : FiArrowRight;

  /**
   * العدّاد التنازلي كان مزيّفاً: تاريخ ثابت "بعد 3 أيام من الآن" يُحسب
   * عند كل تحميل، فيرى الزائر عرضاً لا ينتهي أبداً ويُعاد ضبطه كلما
   * حدّث الصفحة. هذا يضر بالمصداقية ويُعد نمطاً مظلماً (dark pattern).
   *
   * الآن نقرأ عرض الفلاش الحقيقي الذي أنشأه المدير (له تاريخ انتهاء
   * فعلي في قاعدة البيانات). لا يوجد عرض فعّال ⇒ لا عدّاد أصلاً.
   */
  const liveSale = (flashSales || []).find((s) => s.showCountdown !== false && s.endDate);
  const { days, hours, minutes, seconds, isExpired } = useCountdown(liveSale?.endDate || null);
  const showCountdown = Boolean(liveSale) && !isExpired;

  /** قسم العروض بلا منتجات مخفّضة ولا بانرات = لا شيء يستحق العرض. */
  if (!isLoading && !products.length && !banners.length) return null;

  return (
    <section className="section bg-white">
      <div className="container-x">
        {/*
          لافتة العروض: تظهر عند وجود عرض فلاش حقيقي أو منتجات مخفّضة.
          بلا الاثنين كانت تعلن "خصومات حتى 50%" بلا خصم واحد فعلي.
        */}
        {showCountdown || products.length ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="promo-band mb-10 overflow-hidden rounded-2xl bg-gradient-to-l from-rose-700 via-rose-600 to-rose p-6 shadow-card md:p-8 rtl:bg-gradient-to-r"
        >
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold text-white backdrop-blur">
                <FiZap size={12} className="fill-white" />
                {t('home.offers.title')}
              </span>
              <h3 className="mt-3 text-2xl font-bold text-white md:text-3xl">
                {/* اسم عرض الفلاش الحقيقي إن وُجد، وإلا العنوان العام */}
                {liveSale ? localized(liveSale, lang) : t('home.offers.subtitle')}
              </h3>
              {showCountdown ? (
                <p className="mt-1.5 text-sm text-white/70">{t('home.countdown.title')}</p>
              ) : null}
            </div>

            {/* العدّاد يظهر فقط مع عرض حقيقي له تاريخ انتهاء فعلي */}
            {showCountdown ? (
              /* dir=ltr: نفس علّة انعكاس العدّاد في RTL (يوم/ساعة/دقيقة/ثانية) */
              <div dir="ltr" className="flex items-center gap-2">
                <CountdownBox value={days} label={t('home.countdown.days')} />
                <CountdownBox value={hours} label={t('home.countdown.hours')} />
                <CountdownBox value={minutes} label={t('home.countdown.minutes')} />
                <CountdownBox value={seconds} label={t('home.countdown.seconds')} />
              </div>
            ) : null}

            {/* لا نرسل الزائر إلى صفحة عروض فارغة */}
            {products.length ? (
              <Link
                to="/shop?discount=true"
                className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-ink transition hover:bg-ink hover:text-white"
              >
                {t('common.viewAll')}
                <Arrow className="transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
              </Link>
            ) : null}
          </div>
        </motion.div>
        ) : null}

        {/* العنوان والشريط يظهران فقط عند وجود منتجات مخفّضة فعلاً */}
        {isLoading || products.length ? (
          <>
            <SectionHeader
              title={t('home.offers.title')}
              subtitle={t('home.offers.subtitle')}
              viewAllTo={products.length ? '/shop?discount=true' : undefined}
            />
            <ProductCarousel products={products} loading={isLoading} />
          </>
        ) : null}

        {/* Promo banners */}
        {banners.length ? (
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {banners.slice(0, 2).map((b, i) => (
              <motion.div
                key={b._id}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.1 }}
              >
                <Link
                  to={b.link || '/shop'}
                  className="group relative flex h-48 items-center overflow-hidden rounded-2xl bg-ink md:h-56"
                >
                  <SmartImage
                    src={b.image}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover opacity-70 transition duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-l from-ink/90 via-ink/40 to-transparent rtl:bg-gradient-to-r" />
                  <div className="relative z-10 p-7">
                    <h4 className="text-xl font-bold text-white md:text-2xl">{localized(b, lang, 'title')}</h4>
                    <p className="mt-1.5 text-sm text-white/70">{localized(b, lang, 'subtitle')}</p>
                    <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-rose-200 transition group-hover:text-white">
                      {localized(b, lang, 'buttonText')}
                      <Arrow size={15} className="transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
