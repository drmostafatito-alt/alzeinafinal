import { Link } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useConfig } from '@/config/ConfigProvider';
import { cn, localizedBrandName } from '@/utils/helpers';
import { mediaUrl } from '@/utils/media';

/**
 * @param {string} [src] شعار مخصّص يتقدّم على شعار الإعدادات —
 *   تستخدمه صفحة الدخول التي يمكن أن يكون لها شعار مختلف.
 */
export default function Logo({ className, variant = 'dark', size = 'md', asLink = true, src }) {
  const { lang } = useI18n();
  const { settings } = useConfig();
  const light = variant === 'light';
  const imageSrc = src || (light ? settings.logoLight || settings.logo : settings.logo);
  /*
   * اسم المتجر حسب اللغة — مصدر واحد موحّد.
   * كان السطر الرئيسي يعرض الاسم الإنجليزي دائماً (nameEn.toUpperCase())
   * فيظهر "AL ZEINA" في المتجر العربي بدل "الزينة"، وعند حذف الاسم
   * الإنجليزي يظهر "STORE" رغم وجود الاسم العربي.
   */
  const brand = localizedBrandName(settings.siteName, settings.siteNameAr, lang);
  const nameAr = localizedBrandName(settings.siteName, settings.siteNameAr, 'ar');
  const sizes = {
    sm: { mark: 'h-8 w-8 text-base', title: 'text-base', sub: 'text-[9px]' },
    md: { mark: 'h-9 w-9 text-base sm:h-10 sm:w-10 sm:text-lg', title: 'text-lg sm:text-xl', sub: 'text-[9px] sm:text-[10px]' },
    lg: { mark: 'h-12 w-12 text-xl', title: 'text-2xl', sub: 'text-[11px]' },
  }[size];

  // شعار مرفوع من لوحة الإدارة يتقدّم على الشعار النصي
  if (imageSrc) {
    const heights = { sm: 'h-8', md: 'h-10', lg: 'h-12' };
    const img = (
      <img
        src={mediaUrl(imageSrc)}
        alt={brand}
        className={cn('w-auto object-contain', heights[size], className)}
      />
    );
    return asLink ? (
      <Link to="/" aria-label={brand}>
        {img}
      </Link>
    ) : (
      img
    );
  }

  const content = (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'grid place-items-center rounded-xl font-black leading-none',
          sizes.mark,
          light ? 'bg-white text-ink' : 'bg-ink text-white'
        )}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="h-[60%] w-[60%]" fill="none">
          <path
            d="M12 3c1.9 3.1 4.6 4.3 4.6 7.4A4.6 4.6 0 0 1 12 15a4.6 4.6 0 0 1-4.6-4.6C7.4 7.3 10.1 6.1 12 3Z"
            fill="#C89A8B"
          />
          <path d="M7 18.5h10M9 21h6" stroke="#C89A8B" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            'whitespace-nowrap font-bold tracking-wide',
            sizes.title,
            /* الخط اللاتيني للاسم الإنجليزي فقط — الاسم العربي يبقى بخطه العربي */
            lang !== 'ar' && 'font-en',
            light ? 'text-white' : 'text-ink'
          )}
        >
          {lang === 'ar' ? brand : String(brand).toUpperCase()}
        </span>
        <span className={cn('mt-1 font-medium tracking-[0.2em]', sizes.sub, light ? 'text-white/60' : 'text-rose')}>
          {/*
            الشعار النصّي تحت الاسم: الشعار النصّي أولاً بلغته، ثم الاسم كبديل.
          */}
          {lang === 'ar'
            ? settings.tagline || nameAr
            : settings.taglineEn || settings.tagline || brand}
        </span>
      </span>
    </span>
  );

  if (!asLink) return content;
  return (
    <Link to="/" aria-label={brand}>
      {content}
    </Link>
  );
}
