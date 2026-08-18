import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import { useI18n } from '@/i18n';
import ProductCard from './ProductCard';
import { ProductCardSkeleton } from '@/components/ui/Skeleton';

export default function ProductCarousel({ products = [], loading = false, autoplay = false, slidesPerView }) {
  const { isRTL } = useI18n();

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!products.length) return null;

  return (
    <Swiper
      key={isRTL ? 'rtl' : 'ltr'}
      dir={isRTL ? 'rtl' : 'ltr'}
      modules={[Navigation, ...(autoplay ? [Autoplay] : [])]}
      navigation
      spaceBetween={20}
      slidesPerView={1.3}
      autoplay={autoplay ? { delay: 3800, disableOnInteraction: false, pauseOnMouseEnter: true } : false}
      breakpoints={
        slidesPerView || {
          480: { slidesPerView: 2, spaceBetween: 16 },
          768: { slidesPerView: 3, spaceBetween: 20 },
          1100: { slidesPerView: 4, spaceBetween: 20 },
        }
      }
      className="!pb-2"
    >
      {products.map((p, i) => (
        <SwiperSlide key={p._id || p.id} className="!h-auto pb-2">
          <div className="h-full">
            <ProductCard product={p} index={i} />
          </div>
        </SwiperSlide>
      ))}
    </Swiper>
  );
}
