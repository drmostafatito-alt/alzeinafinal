import { Link } from 'react-router-dom';
import { FiPhone, FiTruck, FiRefreshCw, FiAward, FiMoon, FiSun } from 'react-icons/fi';
import { applyGender, useI18n } from '@/i18n';
import { useThemeStore } from '@/store/themeStore';
import { useConfig } from '@/config/ConfigProvider';
import CountrySelector from '@/components/common/CountrySelector';

export default function TopBar() {
  const { t, lang, gender, toggleLang } = useI18n();
  const themeMode = useThemeStore((s) => s.resolved());
  const toggleTheme = useThemeStore((s) => s.toggle);
  const { settings } = useConfig();
  const contact = settings.contact || {};
  const shipping = settings.shipping || {};

  const freeShippingText =
    shipping.freeShippingEnabled && shipping.freeShippingThreshold
      ? t('top.freeShipping').replace(/\d+/, shipping.freeShippingThreshold)
      : null;

  /**
   * عناصر الشريط العلوي.
   *
   * كانت مكتوبة هنا بأيقونات ثابتة، فلا يستطيع المالك تعديل نصّها أو
   * ترتيبها أو حذفها. الآن تأتي من settings.topBar.items، وتبقى
   * القائمة الافتراضية المترجمة عندما تكون فارغة (توافق خلفي كامل).
   */
  const tb = settings.topBar || {};
  const custom = Array.isArray(tb.items) ? tb.items.filter((i) => i && i.enabled !== false && (i.text || i.textEn)) : [];

  const items = custom.length
    ? custom.map((i) => ({
        icon: null,
        emoji: i.icon || '',
        text: applyGender((lang === 'ar' ? i.text : i.textEn) || i.text || '', gender),
        link: i.link || '',
      }))
    : [
        ...(freeShippingText ? [{ icon: FiTruck, text: freeShippingText }] : []),
        { icon: FiAward, text: t('top.original') },
        { icon: FiRefreshCw, text: t('top.returns') },
      ];

  /* إخفاء الشريط بالكامل من الإعدادات */
  if (tb.enabled === false) return null;

  return (
    <div className="bg-ink text-white">
      <div className="container-x flex h-10 items-center justify-between gap-4 text-[11px] sm:text-xs">
        {/* Rotating messages on mobile, all on desktop */}
        <div className="flex min-w-0 flex-1 items-center gap-6 overflow-hidden">
          {items.map(({ icon: Icon, emoji, text, link }, i) => {
            const inner = (
              <>
                {Icon ? <Icon size={13} className="text-rose" /> : null}
                {emoji ? <span aria-hidden="true">{emoji}</span> : null}
                <span className="truncate">{text}</span>
              </>
            );
            const cls = `flex shrink-0 items-center gap-1.5 text-white/80 ${i > 0 ? 'hidden md:flex' : ''}`;
            return link ? (
              <Link key={text + i} to={link} className={`${cls} transition hover:text-rose`}>{inner}</Link>
            ) : (
              <span key={text + i} className={cls}>{inner}</span>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-4">
          {contact.phone && tb.showPhone !== false ? (
            <a href={`tel:${contact.phone}`} className="hidden items-center gap-1.5 text-white/80 transition hover:text-rose sm:flex">
              <FiPhone size={13} className="text-rose" />
              <span dir="ltr">{contact.phone}</span>
            </a>
          ) : null}
          {tb.showTrackOrder !== false ? (
            <Link to="/orders" className="hidden text-white/80 transition hover:text-rose lg:block">
              {t('top.track')}
            </Link>
          ) : null}
          {/* اختيار الدولة (EG/AE) — سطح المكتب فقط؛ نسخة الجوال في MobileMenu */}
          <span className="hidden md:block">
            <CountrySelector tone="topbar" />
          </span>
          {/* تبديل الوضع الليلي — يظهر فقط إن سمح المدير بذلك */}
          {settings.theme?.allowUserToggle !== false ? (
            <button
              type="button"
              onClick={toggleTheme}
              className="grid h-6 w-6 place-items-center rounded-full text-white/80 transition hover:text-rose"
              aria-label={themeMode === 'dark' ? t('admin.lightMode') : t('admin.darkMode')}
              title={themeMode === 'dark' ? t('admin.lightMode') : t('admin.darkMode')}
            >
              {themeMode === 'dark' ? <FiSun size={14} /> : <FiMoon size={14} />}
            </button>
          ) : null}
          {/*
            زر تبديل اللغة يحترم locale.allowLanguageSwitch.
            كان الإعداد محفوظاً بلا استخدام: يطفئه المدير ويبقى الزر
            ظاهراً — إعداد وهمي. الغياب = مسموح (توافق خلفي).
          */}
          {settings.locale?.allowLanguageSwitch !== false ? (
            <button
              type="button"
              onClick={toggleLang}
              className="rounded-full border border-white/20 px-2.5 py-0.5 font-bold text-white transition hover:border-rose hover:bg-rose"
              aria-label="switch language"
            >
              {lang === 'ar' ? 'EN' : 'ع'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
