import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { PageSpinner } from '@/components/ui/Spinner';
import Header from '@/components/layout/Header';
import Navbar from '@/components/layout/Navbar';
import TopBar from '@/components/layout/TopBar';
import { useConfig } from '@/config/ConfigProvider';
import Footer from '@/components/layout/Footer';
import MobileMenu from '@/components/layout/MobileMenu';
import CartDrawer from '@/components/cart/CartDrawer';
import QuickViewModal from '@/components/product/QuickViewModal';
import BackToTop from '@/components/common/BackToTop';
import WhatsAppButton from '@/components/common/WhatsAppButton';
import PopupAd from '@/components/common/PopupAd';
import CompareBar from '@/components/product/CompareBar';
import DemoBanner from '@/components/common/DemoBanner';
import AnnouncementBar from '@/components/common/AnnouncementBar';
import { useFlags } from '@/config/ConfigProvider';

export default function MainLayout() {
  /* إظهار/إخفاء الشريط العلوي من: استوديو التصميم ← الترويسة */
  const hdr = useConfig().settings.header || {};
  /**
   * مفاتيح الميزات: نُخفي المكوّنات المُطفأة بلطف.
   * الإخفاء لا يترك مساحة فارغة ولا يكسر التخطيط.
   */
  const { isEnabled } = useFlags();

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      {/*
        رابط "تخطي إلى المحتوى" — أول عنصر قابل للتركيز في الصفحة.
        مخفي بصرياً ويظهر عند التنقل بلوحة المفاتيح، فيتيح لمستخدمي
        القارئات تجاوز الهيدر والقوائم مباشرة إلى المحتوى.
      */}
      <a href="#main-content" className="sr-only focus-reveal">
        تخطي إلى المحتوى
      </a>
      {isEnabled('announcementBar') ? <AnnouncementBar /> : null}
      <DemoBanner />
      {hdr.showTopBar === false ? null : <TopBar />}
      <Header />
      <Navbar />

      {/*
        حدود Suspense داخل التخطيط لا خارجه.
        لو كانت حول <Routes> كلها، فإن أي تنقل لصفحة كسولة يفكّ تركيب
        التخطيط بالكامل (هيدر/فوتر/دروَر السلة) بينما تبقى طبقة الدروَر
        المنقولة عبر Portal في <body> — فيتجمد الموقع خلف طبقة سوداء.
      */}
      <main id="main-content" className="flex-1" tabIndex={-1}>
        <Suspense fallback={<PageSpinner />}>
          <Outlet />
        </Suspense>
      </main>

      <Footer />

      <MobileMenu />
      <CartDrawer />
      <QuickViewModal />
      <BackToTop />
      <WhatsAppButton />
      <PopupAd />
      {isEnabled('compareProducts') ? <CompareBar /> : null}
    </div>
  );
}
