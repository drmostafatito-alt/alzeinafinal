import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
import { FiMessageCircle } from 'react-icons/fi';
import 'swiper/css';
import 'swiper/css/pagination';
import Rating from '@/components/ui/Rating';
import SectionHeader from '@/components/ui/SectionHeader';
import { useTestimonials } from '@/hooks';
import { useI18n } from '@/i18n';
import { localized } from '@/utils/helpers';
import SmartImage from '@/components/ui/SmartImage';

/**
 * العنوان والوصف يأتيان من قاعدة البيانات (بانى الصفحة الرئيسية).
 * القيم الفارغة ترجع للترجمة الافتراضية، فلا ينكسر أي تثبيت قائم.
 */
export default function Testimonials({ title, subtitle } = {}) {
  const { t, lang, isRTL } = useI18n();
  const { testimonials, isLoading } = useTestimonials();

  if (isLoading || !testimonials.length) return null;

  return (
    <section className="section bg-blush/40">
      <div className="container-x">
        <SectionHeader title={title || t('home.testimonials.title')} subtitle={subtitle || t('home.testimonials.subtitle')} align="center" />

        <Swiper
          key={isRTL ? 'rtl' : 'ltr'}
          dir={isRTL ? 'rtl' : 'ltr'}
          modules={[Autoplay, Pagination]}
          autoplay={{ delay: 4500, disableOnInteraction: false }}
          pagination={{ clickable: true }}
          spaceBetween={20}
          slidesPerView={1}
          breakpoints={{ 640: { slidesPerView: 2 }, 1024: { slidesPerView: 3 } }}
          className="!pb-12"
        >
          {testimonials.map((item) => (
            <SwiperSlide key={item._id} className="!h-auto">
              <figure className="flex h-full flex-col rounded-2xl bg-white p-6 shadow-soft">
                <FiMessageCircle className="mb-4 text-rose" size={26} />
                <blockquote className="flex-1 text-sm leading-relaxed text-ink-soft">
                  “{localized(item, lang, 'content')}”
                </blockquote>
                <Rating value={item.rating} className="mt-4" />
                <figcaption className="mt-4 flex items-center gap-3 border-t border-black/5 pt-4">
                  <SmartImage
                    src={item.avatar}
                    alt=""
                    className="h-11 w-11 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-sm font-bold text-ink">{localized(item, lang)}</p>
                  </div>
                </figcaption>
              </figure>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}
