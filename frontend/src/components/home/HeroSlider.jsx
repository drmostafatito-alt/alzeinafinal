import { Link } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, EffectFade, Navigation, Pagination } from 'swiper/modules';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiArrowRight } from 'react-icons/fi';
import 'swiper/css';
import 'swiper/css/effect-fade';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import { useBanners } from '@/hooks';
import { useI18n } from '@/i18n';
import Skeleton from '@/components/ui/Skeleton';
import { localized } from '@/utils/helpers';
import SmartImage from '@/components/ui/SmartImage';

export default function HeroSlider() {
  const { t, lang, isRTL } = useI18n();
  const { banners, isLoading } = useBanners('hero');
  const Arrow = isRTL ? FiArrowLeft : FiArrowRight;

  if (isLoading) return <Skeleton className="h-[420px] w-full md:h-[560px]" rounded="rounded-none" />;
  if (!banners.length) return null;

  return (
    <section className="relative">
      <Swiper
        key={isRTL ? 'rtl' : 'ltr'}
        dir={isRTL ? 'rtl' : 'ltr'}
        modules={[Autoplay, EffectFade, Navigation, Pagination]}
        effect="fade"
        fadeEffect={{ crossFade: true }}
        autoplay={{ delay: 5500, disableOnInteraction: false }}
        loop={banners.length > 1}
        navigation
        pagination={{ clickable: true }}
        className="h-[440px] md:h-[560px] lg:h-[620px]"
      >
        {banners.map((b, idx) => (
          <SwiperSlide key={b._id}>
            {({ isActive }) => (
              <div className="relative h-full w-full overflow-hidden bg-ink">
                <SmartImage
                  src={b.image}
                  alt={localized(b, lang, 'title')}
                  loading={idx === 0 ? 'eager' : 'lazy'}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-l from-ink/85 via-ink/45 to-transparent rtl:bg-gradient-to-r" />

                <div className="absolute inset-0">
                  <div className="container-x flex h-full items-center">
                    <div className="max-w-xl">
                      <motion.span
                        initial={{ opacity: 0, y: 20 }}
                        animate={isActive ? { opacity: 1, y: 0 } : {}}
                        transition={{ delay: 0.15, duration: 0.5 }}
                        className="inline-flex items-center gap-2 rounded-full bg-rose/20 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-rose-100 backdrop-blur"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-rose" />
                        {t('home.hero.badge')}
                      </motion.span>

                      <motion.h1
                        initial={{ opacity: 0, y: 28 }}
                        animate={isActive ? { opacity: 1, y: 0 } : {}}
                        transition={{ delay: 0.28, duration: 0.6 }}
                        className="mt-5 text-3xl font-bold leading-tight text-white text-balance sm:text-4xl md:text-5xl lg:text-6xl"
                      >
                        {localized(b, lang, 'title')}
                      </motion.h1>

                      <motion.p
                        initial={{ opacity: 0, y: 24 }}
                        animate={isActive ? { opacity: 1, y: 0 } : {}}
                        transition={{ delay: 0.42, duration: 0.6 }}
                        className="mt-4 max-w-lg text-sm leading-relaxed text-white/75 md:text-base"
                      >
                        {localized(b, lang, 'subtitle')}
                      </motion.p>

                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={isActive ? { opacity: 1, y: 0 } : {}}
                        transition={{ delay: 0.56, duration: 0.5 }}
                        className="mt-8 flex flex-wrap gap-3"
                      >
                        <Link
                          to={b.link || '/shop'}
                          className="group inline-flex items-center gap-2 rounded-full bg-rose px-7 py-3.5 text-sm font-bold text-white shadow-card transition hover:bg-white hover:text-ink"
                        >
                          {localized(b, lang, 'buttonText') || t('home.hero.cta')}
                          <Arrow className="transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
                        </Link>
                        <Link
                          to="/categories"
                          className="inline-flex items-center rounded-full border border-white/30 px-7 py-3.5 text-sm font-bold text-white backdrop-blur transition hover:border-white hover:bg-white/10"
                        >
                          {t('home.hero.secondary')}
                        </Link>
                      </motion.div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}
