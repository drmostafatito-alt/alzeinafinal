import { Suspense, useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { PageSpinner } from '@/components/ui/Spinner';
import { FiArrowLeft, FiArrowRight } from 'react-icons/fi';
import Logo from '@/components/ui/Logo';
import SmartImage from '@/components/ui/SmartImage';
import { useConfig } from '@/config/ConfigProvider';
import { useI18n } from '@/i18n';
import { cn, localized } from '@/utils/helpers';

const RADIUS = { sharp: 'rounded-none', soft: 'rounded-xl', rounded: 'rounded-2xl', pill: 'rounded-[2rem]' };
const SHADOW = { none: 'shadow-none', soft: 'shadow-soft', card: 'shadow-card', lift: 'shadow-lift' };

/**
 * صفحة دخول العملاء.
 *
 * كانت تعرض صورة ثابتة من picsum.photos وإحصاءات مكتوبة في الكود
 * ("+12K عميلة"، "تقييم 4.9") — أرقام غير حقيقية تظهر لكل زائر في
 * كل متجر. حُذفت: عرض أرقام مختلقة على صفحة الدخول يضر بالمصداقية،
 * والاعتماد على خدمة صور خارجية يكسر الصفحة بلا إنترنت.
 *
 * كل شيء الآن يأتي من الإعدادات (settings.loginPage) ويُدار من
 * لوحة الإدارة. القيم الفارغة ترجع للتصميم الافتراضي، فالمتاجر
 * القائمة لا ترى أي تغيير حتى تخصّص صراحةً.
 */
export default function AuthLayout() {
  const { t, isRTL, lang, toggleLang } = useI18n();
  const { settings } = useConfig();
  const Back = isRTL ? FiArrowRight : FiArrowLeft;

  const lp = settings.loginPage || {};
  const slides = Array.isArray(lp.slideshow) ? lp.slideshow.filter(Boolean) : [];
  const [slide, setSlide] = useState(0);

  /* عرض الشرائح — يتوقف تلقائياً مع صورة واحدة أو أقل */
  useEffect(() => {
    if (slides.length < 2) return undefined;
    const ms = Math.max(2, Number(lp.slideshowSeconds) || 6) * 1000;
    const id = setInterval(() => setSlide((i) => (i + 1) % slides.length), ms);
    return () => clearInterval(id);
  }, [slides.length, lp.slideshowSeconds]);

  const heroImage = slides.length ? slides[slide % slides.length] : lp.background || '';
  const title = localized(lp, lang, 'welcomeTitle') || settings.tagline || '';
  const subtitle = localized(lp, lang, 'welcomeSubtitle') || '';
  const footerText = localized(lp, lang, 'footerText') || '';

  const overlayStyle = {
    backgroundColor: lp.overlayColor || '#111111',
    opacity: Math.min(100, Math.max(0, Number(lp.overlayOpacity ?? 45))) / 100
  };

  /*
    البطاقة تأخذ شكلها من الإعدادات عندما يضبط المالك خلفية أو تأثيراً
    زجاجياً. cardBg كان محفوظاً بلا استخدام — أي عنصر تحكّم وهمي.
  */
  const styledCard = Boolean(lp.glassEffect || lp.cardBg);
  const cardClass = cn(
    'w-full max-w-md',
    styledCard && 'p-6',
    lp.glassEffect && 'bg-white/70 backdrop-blur-xl ring-1 ring-white/40',
    styledCard && (RADIUS[lp.cardRadius] || RADIUS.rounded),
    styledCard && (SHADOW[lp.cardShadow] || SHADOW.lift)
  );
  const cardStyle = lp.cardBg && !lp.glassEffect ? { backgroundColor: lp.cardBg } : undefined;

  /*
    ألوان زر الدخول: نمرّرها كمتغيّرات CSS على حاوية النموذج بدل
    تعديل كل زر — الأزرار تقرأ --color-btn-* أصلاً من الثيم.
  */
  const buttonVars = {};
  if (lp.buttonBg) buttonVars['--color-btn-bg'] = lp.buttonBg;
  if (lp.buttonText) buttonVars['--color-btn-text'] = lp.buttonText;

  return (
    <div className={cn('grid min-h-screen lg:grid-cols-2', lp.darkVersion && 'dark')}>
      {/* الجانب البصري — يظهر فقط عند وجود صورة، فلا مساحة سوداء فارغة */}
      {heroImage ? (
        <div className="relative hidden overflow-hidden bg-ink lg:block">
          <SmartImage
            src={heroImage}
            alt=""
            className={cn(
              'h-full w-full object-cover',
              lp.animations !== false && 'transition-opacity duration-700'
            )}
          />
          <div className="absolute inset-0" style={overlayStyle} />

          <div className="absolute inset-x-0 bottom-0 p-12">
            {lp.showLogo !== false ? (
              <Logo variant="light" size="lg" asLink={false} src={lp.logo || undefined} />
            ) : null}

            {lp.showWelcome !== false && title ? (
              <h2 className="mt-6 max-w-md text-3xl font-bold leading-tight text-white">{title}</h2>
            ) : null}
            {lp.showWelcome !== false && subtitle ? (
              <p className="mt-3 max-w-md text-sm text-white/75">{subtitle}</p>
            ) : null}
          </div>

          {/* مؤشّرات الشرائح */}
          {slides.length > 1 ? (
            <div className="absolute bottom-4 flex w-full justify-center gap-1.5">
              {slides.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    i === slide % slides.length ? 'w-5 bg-white' : 'w-1.5 bg-white/40'
                  )}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* جانب النموذج */}
      <div className={cn('flex flex-col bg-cream', !heroImage && 'lg:col-span-2')}>
        <div className="flex items-center justify-between p-6">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold text-ink transition hover:text-rose">
            <Back size={16} />
            {t('common.back')}
          </Link>
          <button
            type="button"
            onClick={toggleLang}
            className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-bold text-ink transition hover:border-rose hover:text-rose"
          >
            {lang === 'ar' ? 'EN' : 'ع'}
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center p-6 pb-16">
          <div className={cardClass} style={{ ...cardStyle, ...buttonVars }}>
            {lp.showLogo !== false ? (
              <div className={cn('mb-8 flex justify-center', heroImage && 'lg:hidden')}>
                <Logo size="lg" src={lp.logo || undefined} />
              </div>
            ) : null}

            {/*
              🔴 نص الترحيب فوق النموذج عندما لا توجد صورة خلفية.
              كان يُعرض داخل اللوحة البصرية فقط، وتلك اللوحة تظهر فقط
              مع صورة — فيضبط المالك «عنوان صفحة الدخول» ويحفظ ولا يرى
              شيئاً إطلاقاً ما لم يرفع خلفية أيضاً. هذا يجعل الإعداد
              يبدو معطّلاً وهو سليم.
              الآن: بلا صورة يظهر النص فوق النموذج مباشرة؛ ومع صورة
              يبقى مكانه السابق داخل اللوحة (بلا أي تغيير بصري).
            */}
            {!heroImage && lp.showWelcome !== false && (title || subtitle) ? (
              <div className="mb-6 text-center">
                {title ? <h2 className="text-2xl font-bold text-ink md:text-3xl">{title}</h2> : null}
                {subtitle ? <p className="mt-2 text-sm text-ink-muted">{subtitle}</p> : null}
              </div>
            ) : null}

            <Suspense fallback={<PageSpinner />}>
              <Outlet />
            </Suspense>
          </div>
        </div>

        {lp.showFooter !== false && footerText ? (
          <p className="px-6 pb-6 text-center text-xs text-ink-muted">{footerText}</p>
        ) : null}
      </div>
    </div>
  );
}
