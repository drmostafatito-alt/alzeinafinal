import { lazy, Suspense, useMemo } from 'react';
import HeroSlider from '@/components/home/HeroSlider';
import FeaturesStrip from '@/components/home/FeaturesStrip';
import CategoriesGrid from '@/components/home/CategoriesGrid';
import CollectionSection from '@/components/home/CollectionSection';
import StoreEmptyNotice from '@/components/home/StoreEmptyNotice';
import { SectionShell, BannerBlock, TextBlock, ImageTextBlock, FaqBlock, CtaBlock, SpacerBlock } from '@/components/home/blocks';
import { useBestSellers, useFeaturedProducts, useNewArrivals, useOnSaleProducts, useProductsByIds } from '@/hooks';
import { useQuery } from '@tanstack/react-query';
import { useConfig } from '@/config/ConfigProvider';
import { useCountryStore } from '@/store/countryStore';
import { productService } from '@/services';
import { applyGender, useI18n } from '@/i18n';
import { localized } from '@/utils/helpers';

const OffersSection = lazy(() => import('@/components/home/OffersSection'));
const BrandsStrip = lazy(() => import('@/components/home/BrandsStrip'));
const Testimonials = lazy(() => import('@/components/home/Testimonials'));
const InstagramFeed = lazy(() => import('@/components/home/InstagramFeed'));

/**
 * ترتيب احتياطي يُستخدم فقط إذا كانت قاعدة البيانات بلا أقسام
 * (تثبيت قديم لم يُشغّل `npm run init` بعد). يطابق السلوك السابق
 * حرفياً حتى لا يرى أي متجر قائم صفحة فارغة.
 */
const FALLBACK_SECTIONS = [
  { key: 'hero', type: 'hero', order: 1, isActive: true },
  { key: 'features', type: 'features', order: 2, isActive: true },
  { key: 'categories', type: 'categories', order: 3, isActive: true },
  { key: 'featured', type: 'products', source: 'featured', order: 4, isActive: true, viewAllLink: '/shop?featured=true' },
  { key: 'offers', type: 'offers', order: 5, isActive: true },
  { key: 'bestSellers', type: 'products', source: 'bestSellers', order: 6, isActive: true, viewAllLink: '/shop?sort=bestSeller' },
  { key: 'newArrivals', type: 'products', source: 'newArrivals', order: 7, isActive: true, viewAllLink: '/shop?sort=newest' },
  { key: 'brands', type: 'brands', order: 8, isActive: true },
  { key: 'testimonials', type: 'testimonials', order: 9, isActive: true },
  { key: 'newsletter', type: 'newsletter', order: 11, isActive: true },
];

/**
 * الصفحة الرئيسية — تُبنى بالكامل من قاعدة البيانات.
 * كل بلوك: ظهوره وترتيبه ونصوصه وتصميمه تأتي من home_sections (D1)
 * عبر /storefront/config. لا عنوان واحد مكتوب في هذا الملف.
 */
export default function Home() {
  const { t, lang, gender } = useI18n();
  const { sections: dbSections } = useConfig();

  /* مصادر المنتجات — تُجلب مرة واحدة وتُوزَّع على الأقسام حسب source */
  const featured = useFeaturedProducts(12);
  const bestSellers = useBestSellers(12);
  const newArrivals = useNewArrivals(12);
  const onSale = useOnSaleProducts(12);

  /* أقسام manual: نجمع كل معرّفات المنتجات في طلب واحد */
  const manualIds = useMemo(() => {
    const list = Array.isArray(dbSections) ? dbSections : [];
    return [...new Set(list.filter((s) => s.source === 'manual' && Array.isArray(s.products)).flatMap((s) => s.products))];
  }, [dbSections]);
  const manual = useProductsByIds(manualIds);

  const sections = useMemo(() => {
    const list = Array.isArray(dbSections) && dbSections.length ? dbSections : FALLBACK_SECTIONS;
    return list
      .filter((s) => s && s.isActive !== false)
      .slice()
      .sort((a, b) => (a.order ?? a.sortOrder ?? 0) - (b.order ?? b.sortOrder ?? 0));
  }, [dbSections]);

  /* Gate 3B: «المتجر فارغ» تُحسم من كتالوج البلد المحسوم خادمياً نفسه،
     لا من ثلاث قوائم موسومة. سابقاً كان غياب featured/bestSeller/newArrival
     وحده يطوي الصفحة كلها إلى StoreEmptyNotice — فبدت صفحة الإمارات «فارغة»
     وهي تحمل أقساماً وماركات ومحتوى؛ وأي بلد بمنتجات غير موسومة كان سينهار
     بنفس الطريقة. مجسّ مخصص بلا staleTime حتى لا يبقى القرار قديماً بعد
     إجراءات الإدارة (قوائم المتجر العامة لها staleTime خمس دقائق): البلد من
     countryStore ومفتاح الاستعلام يحمله، والخادم هو الذي يحسم العدد —
     لا يوجد أي فلترة محلية لبيانات بلد آخر. الانهيار فقط عندما لا يملك
     بلدُ الطلب أي منتج متاح إطلاقاً، والأقسام الفارغة المفردة تُخفى
     ذاتياً كما هو مصمم (CollectionSection يرجع null). */
  const country = useCountryStore((s) => s.country);
  const catalogProbe = useQuery({
    queryKey: ['products', country, 'catalog-empty-probe'],
    queryFn: () => productService.list({ limit: 1 })
  });
  const catalogTotal = catalogProbe.data?.data?.pagination?.total;
  const isStoreEmpty = !catalogProbe.isLoading && catalogTotal === 0;

  /** يختار مجموعة المنتجات المناسبة لمصدر القسم */
  const sourceFor = (source) => {
    switch (source) {
      case 'bestSellers': return bestSellers;
      case 'newArrivals': return newArrivals;
      case 'onSale': return onSale;
      case 'manual': return manual;
      case 'featured':
      default: return featured;
    }
  };

  const renderSection = (s) => {
    /* نصوص قاعدة البيانات تمرّ بمحلّل صيغة المخاطبة أيضاً */
    const title = applyGender(localized(s, lang, 'title'), gender);
    const subtitle = applyGender(localized(s, lang, 'subtitle'), gender);

    let body;
    switch (s.type) {
      case 'hero':
        body = <HeroSlider key={s.key} />;
        break;

      case 'features':
        body = <FeaturesStrip key={s.key} items={s.items} title={title} subtitle={subtitle} />;
        break;

      case 'categories':
        body = <CategoriesGrid key={s.key} title={title} subtitle={subtitle} />;
        break;

      case 'products': {
        const src = sourceFor(s.source);
        const products = s.source === 'manual'
          ? src.products.slice(0, s.limit || 10)
          : src.products.slice(0, s.limit || 10);
        body = (
          <CollectionSection
            key={s.key}
            title={title || t('home.featured.title')}
            subtitle={subtitle}
            viewAllTo={s.viewAllLink || '/shop'}
            products={products}
            loading={src.isLoading}
            autoplay={s.layout === 'carousel'}
            layout={s.layout}
            columnsDesktop={s.columnsDesktop}
            columnsMobile={s.columnsMobile}
          />
        );
        break;
      }

      case 'offers':
        body = (
          <Suspense key={s.key} fallback={null}>
            <OffersSection title={title} subtitle={subtitle} />
          </Suspense>
        );
        break;

      case 'brands':
        body = (
          <Suspense key={s.key} fallback={null}>
            <BrandsStrip title={title} subtitle={subtitle} />
          </Suspense>
        );
        break;

      case 'testimonials':
        body = (
          <Suspense key={s.key} fallback={null}>
            <Testimonials title={title} subtitle={subtitle} />
          </Suspense>
        );
        break;

      case 'instagram':
        body = (
          <Suspense key={s.key} fallback={null}>
            <InstagramFeed title={title} subtitle={subtitle} />
          </Suspense>
        );
        break;

      case 'newsletter':
        /* شريط النشرة يظهر في الفوتر على كل الصفحات (سلوك قائم) */
        body = null;
        break;

      case 'banner':
      case 'banners':
        body = <BannerBlock key={s.key} s={s} />;
        break;

      case 'text':
        body = <TextBlock key={s.key} s={s} />;
        break;

      case 'imageText':
        body = <ImageTextBlock key={s.key} s={s} />;
        break;

      case 'faq':
        body = <FaqBlock key={s.key} s={s} />;
        break;

      case 'cta':
        body = <CtaBlock key={s.key} s={s} />;
        break;

      case 'spacer':
      case 'divider':
        body = <SpacerBlock key={s.key} s={s} />;
        break;

      case 'custom':
      case 'customHtml':
        /* محتوى حر يكتبه المدير — يُنظَّف على الخادم قبل الحفظ */
        if (!s.html) body = null;
        else {
          body = (
            <section key={s.key} className="section">
              <div className="container-x" dangerouslySetInnerHTML={{ __html: s.html }} />
            </section>
          );
        }
        break;

      default:
        body = null;
    }

    if (!body) return null;
    return <SectionShell key={`shell-${s.key}`} s={s}>{body}</SectionShell>;
  };

  /*
    على متجر بلا منتجات نعرض الترويسة والمزايا ثم رسالة واحدة واضحة،
    بدل سلسلة أقسام فارغة.
  */
  if (isStoreEmpty) {
    return (
      <>
        {sections.filter((s) => ['hero', 'features'].includes(s.type)).map(renderSection)}
        <StoreEmptyNotice />
      </>
    );
  }

  return <>{sections.map(renderSection)}</>;
}
