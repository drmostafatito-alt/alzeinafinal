import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import client from '@/api/client';
import { setCurrency } from '@/utils/format';
import { localizedBrandName } from '@/utils/helpers';
import { useI18n, registerExtraTranslations } from '@/i18n';
import { useCartStore } from '@/store/cartStore';
import { useThemeStore } from '@/store/themeStore';
import { findPreset } from './themePresets';
import { fontHref } from './fonts';

/**
 * يحمّل إعدادات المتجر من الخادم مرة واحدة عند الإقلاع.
 * كل ما يخص الهوية والألوان والخطوط وطرق الدفع والمحافظات يأتي من هنا،
 * فلا توجد أي قيمة مكتوبة في الكود يحتاج المالك لتعديلها.
 */
const ConfigContext = createContext(null);

const FALLBACK = {
  settings: {
    siteName: 'Store',
    siteNameAr: 'المتجر',
    tagline: '',
    logo: '',
    favicon: '',
    theme: {
      primary: '#111111',
      accent: '#C89A8B',
      cream: '#FFF8F5',
      blush: '#F8E8EA',
      surface: '#FFFFFF',
      fontAr: 'Cairo',
      fontEn: 'Poppins',
      defaultLang: 'ar'
    },
    contact: {},
    social: {},
    shipping: { enabled: true, codEnabled: true, defaultCost: 0, freeShippingEnabled: false, freeShippingThreshold: 0 },
    payment: { currency: 'EGP', currencySymbol: 'ج.م', currencySymbolEn: 'EGP', taxEnabled: false, taxRate: 0 },
    seo: {},
    analytics: {},
    features: { wishlist: true, reviews: true, newsletter: true, testimonials: true, popups: true },
    footer: {}
  },
  paymentMethods: [],
  governorates: [],
  pages: [],
  sections: [],
  popups: [],
  flashSales: []
};

const hexToRgb = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ''));
  return m ? `${parseInt(m[1], 16)} ${parseInt(m[2], 16)} ${parseInt(m[3], 16)}` : null;
};

/**
 * كل لون قابل للتحكم من لوحة الإدارة ← متغيّر CSS.
 * المفتاح = اسم الحقل في إعدادات الثيم، القيمة = اسم متغيّر CSS.
 * الألوان التي تحتاج شفافية (bg-ink/50) تحصل أيضاً على نسخة RGB.
 */
const COLOR_VARS = {
  primary: { css: '--color-ink', rgb: '--rgb-ink' },
  accent: { css: '--color-rose', rgb: '--rgb-rose' },
  cream: { css: '--color-cream', rgb: '--rgb-cream' },
  blush: { css: '--color-blush', rgb: '--rgb-blush' },
  surface: { css: '--color-surface', rgb: '--rgb-surface' },
  secondary: { css: '--color-secondary', rgb: '--rgb-secondary' },
  text: { css: '--color-text', rgb: '--rgb-text' },
  textMuted: { css: '--color-text-muted' },
  heading: { css: '--color-heading' },
  link: { css: '--color-link' },
  buttonBg: { css: '--color-btn-bg' },
  buttonText: { css: '--color-btn-text' },
  buttonHoverBg: { css: '--color-btn-hover-bg' },
  headerBg: { css: '--color-header-bg' },
  headerText: { css: '--color-header-text' },
  topBarBg: { css: '--color-topbar-bg' },
  topBarText: { css: '--color-topbar-text' },
  footerBg: { css: '--color-footer-bg' },
  footerText: { css: '--color-footer-text' },
  cardBg: { css: '--color-card-bg' },
  cardBorder: { css: '--color-card-border' },
  border: { css: '--color-border' },
  bodyBg: { css: '--color-body-bg' },
  sectionBg: { css: '--color-section-bg' },
  heroBg: { css: '--color-hero-bg' },
  promoBg: { css: '--color-promo-bg' },
  promoText: { css: '--color-promo-text' },
  badgeBg: { css: '--color-badge-bg' },
  badgeText: { css: '--color-badge-text' },
  priceColor: { css: '--color-price' },
  saleColor: { css: '--color-sale' }
};

const IMAGE_VARS = {
  bodyBgImage: '--bg-body-image',
  heroBgImage: '--bg-hero-image',
  sectionBgImage: '--bg-section-image',
  promoBgImage: '--bg-promo-image',
  footerBgImage: '--bg-footer-image',
  watermark: '--bg-watermark'
};

/**
 * يطبّق ألوان/خطوط/خلفيات المدير على متغيرات CSS الحية.
 *
 * مهم: نحذف المتغيّر عند إفراغ القيمة (removeProperty) بدل تجاهلها.
 * كان تجاهل القيم الفارغة يعني أن إزالة لون من لوحة الإدارة لا تنعكس
 * على الموقع أبداً حتى إعادة تحميل كاملة — وهو سبب شكوى
 * "تغيير الألوان لا يحدّث الموقع".
 */
/**
 * يطبّق متغيّرات الثيم على الصفحة.
 * مُصدَّر ليستخدمه المعاينة الحية في لوحة الإدارة بنفس المنطق تماماً،
 * فلا يختلف ما يراه المدير عمّا سيُحفظ فعلياً.
 */
export const applyThemeVars = (theme = {}, modeOverride = null) => {
  const root = document.documentElement;
  const preset = theme && theme.preset ? findPreset(theme.preset) : null;
  if (preset) { root.dataset.themePreset=preset.slug; } else { root.removeAttribute('data-theme-preset'); }
  const effective = preset ? { ...preset.theme, ...theme } : theme;

  Object.entries(COLOR_VARS).forEach(([key, { css, rgb }]) => {
    const value = effective[key];
    if (value) {
      root.style.setProperty(css, value);
      if (rgb) {
        const parsed = hexToRgb(value);
        if (parsed) root.style.setProperty(rgb, parsed);
      }
    } else {
      root.style.removeProperty(css);
      if (rgb) root.style.removeProperty(rgb);
    }
  });

  Object.entries(IMAGE_VARS).forEach(([key, cssVar]) => {
    const url = effective[key];
    if (url) root.style.setProperty(cssVar, `url("${url}")`);
    else root.style.removeProperty(cssVar);
  });

  /**
   * ضبط العلامة المائية.
   * تُعرض فقط عند رفع صورة فعلاً — بلا صورة نُخفي الطبقة تماماً
   * حتى لا نضيف عنصراً زائداً على كل صفحة بلا داعٍ.
   */
  if (theme.watermark) {
    root.style.setProperty('--watermark-display', 'block');
    root.style.setProperty('--watermark-opacity', String((Number(theme.watermarkOpacity) || 8) / 100));
    /*
      'auto' (الافتراضي) يترك CSS يحسب حجماً متجاوباً عبر clamp، فتبدو
      العلامة صحيحة من الموبايل حتى شاشات 4K. الحجم الثابت بالبكسل
      يبقى متاحاً لمن يحتاجه — وكان هو السلوك الوحيد سابقاً، وهو سبب
      ظهورها صغيرة جداً على الشاشات الكبيرة.
    */
    if (theme.watermarkScale === 'fixed' && Number(theme.watermarkSize) > 0) {
      root.style.setProperty('--watermark-size', `${Number(theme.watermarkSize)}px`);
    } else {
      root.style.removeProperty('--watermark-size');
    }
    root.style.setProperty('--watermark-position', theme.watermarkPosition || 'center');
    root.style.setProperty('--watermark-repeat', theme.watermarkRepeat ? 'repeat' : 'no-repeat');
  } else {
    ['--watermark-display', '--watermark-opacity', '--watermark-size', '--watermark-position', '--watermark-repeat']
      .forEach((v) => root.style.removeProperty(v));
  }

  /**
   * ضبط خلفية الموقع (ملاءمة/تكرار/تثبيت/طبقة قراءة).
   * تُطبَّق فقط عند وجود صورة خلفية فعلاً.
   */
  if (theme.bodyBgImage) {
    root.style.setProperty('--bg-body-size', theme.bodyBgFit || 'cover');
    root.style.setProperty('--bg-body-repeat', theme.bodyBgRepeat ? 'repeat' : 'no-repeat');
    root.style.setProperty('--bg-body-attachment', theme.bodyBgFixed === false ? 'scroll' : 'fixed');
    const ov = Number(theme.bodyBgOverlayOpacity) || 0;
    if (ov > 0) {
      root.style.setProperty('--bg-overlay-display', 'block');
      root.style.setProperty('--bg-overlay-color', theme.bodyBgOverlay || '#000000');
      root.style.setProperty('--bg-overlay-opacity', String(Math.min(100, ov) / 100));
    } else {
      root.style.removeProperty('--bg-overlay-display');
    }
  } else {
    ['--bg-body-size', '--bg-body-repeat', '--bg-body-attachment', '--bg-overlay-display',
     '--bg-overlay-color', '--bg-overlay-opacity'].forEach((v) => root.style.removeProperty(v));
  }

  // الوضع الليلي يُدار بكلاس على <html> ليستفيد منه Tailwind وCSS معاً
  // modeOverride = اختيار الزائر، وإلا نتبع إعداد المدير
  const mode = modeOverride || effective.mode || 'light';
  root.classList.toggle('dark', mode === 'dark');
  root.dataset.theme = mode;

  if (effective.radius) {
    const radii = { none: '0px', small: '.5rem', rounded: '1rem', pill: '9999px' };
    root.style.setProperty('--radius-base', radii[effective.radius] || effective.radius);
  }

  /**
   * نظام الخطوط.
   *
   * - fontAr / fontEn: خط النص الأساسي لكل لغة.
   * - fontHeadingAr / fontHeadingEn (اختياري): خط العناوين لكل لغة —
   *   يسمح لكل ثيم بهوية مطبعية حقيقية (عنوان Serif مع نص Sans مثلاً).
   *
   * مهم: لا نضبط --font-heading أو --font-body inline هنا أبداً.
   * كان الكود القديم يفرضهما inline على <html> بالخط العربي دائماً،
   * فيتجاوز قواعد premium.css المعتمدة على dir ويظهر الموقع بخط واحد
   * في الاتجاهين — وهذا كان السبب الحقيقي لمشكلة "النظام يستخدم Font واحد".
   * الآن premium.css يشتق العناوين والنص من هذه المتغيرات حسب الاتجاه.
   */
  const fontStack = (f) => `'${f}', system-ui, sans-serif, var(--font-emoji)`;
  if (effective.fontAr) root.style.setProperty('--font-ar', fontStack(effective.fontAr));
  else root.style.removeProperty('--font-ar');
  if (effective.fontEn) root.style.setProperty('--font-en', fontStack(effective.fontEn));
  else root.style.removeProperty('--font-en');
  if (effective.fontHeadingAr) root.style.setProperty('--font-heading-ar', fontStack(effective.fontHeadingAr));
  else root.style.removeProperty('--font-heading-ar');
  if (effective.fontHeadingEn) root.style.setProperty('--font-heading-en', fontStack(effective.fontHeadingEn));
  else root.style.removeProperty('--font-heading-en');
  root.style.removeProperty('--font-heading');
  root.style.removeProperty('--font-body');
  // تحميل الخطوط من Google Fonts تلقائياً عند اختيار خط غير محمّل
  loadWebFonts([effective.fontAr, effective.fontEn, effective.fontHeadingAr, effective.fontHeadingEn]);
};

/**
 * يحقن روابط Google Fonts للخطوط التي يختارها المدير.
 * الأوزان تأتي من سجلّ الخطوط (fonts.js) — طلب وزن غير موجود للعائلة
 * كان يجعل بعض الخطوط (Tajawal 600، Almarai 500...) تفشل بصمت
 * ويرجع المتصفح للخط الافتراضي.
 */
const loadWebFonts = (families = []) => {
  [...new Set(families.filter(Boolean))].forEach((family) => {
    const id = `font-${String(family).replace(/\s+/g, '-').toLowerCase()}`;
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = fontHref(family);
    document.head.appendChild(link);
  });
};

const setMeta = (attr, key, content) => {
  if (!content) return;
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
};

/** يحقن سكربتات التحليلات فقط عند إدخال المعرفات في لوحة الإدارة */
const injectAnalytics = (analytics = {}) => {
  const once = (id, build) => {
    if (!id || document.getElementById(`an-${id}`)) return;
    build(id);
  };

  once(analytics.googleAnalyticsId, (id) => {
    const s1 = document.createElement('script');
    s1.id = `an-${id}`;
    s1.async = true;
    s1.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
    document.head.appendChild(s1);
    const s2 = document.createElement('script');
    s2.text = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`;
    document.head.appendChild(s2);
  });

  once(analytics.googleTagManagerId, (id) => {
    const s = document.createElement('script');
    s.id = `an-${id}`;
    s.text = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id}');`;
    document.head.appendChild(s);
  });

  once(analytics.metaPixelId, (id) => {
    const s = document.createElement('script');
    s.id = `an-${id}`;
    s.text = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');fbq('track','PageView');`;
    document.head.appendChild(s);
  });

  once(analytics.tiktokPixelId, (id) => {
    const s = document.createElement('script');
    s.id = `an-${id}`;
    s.text = `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${id}');ttq.page();}(window,document,'ttq');`;
    document.head.appendChild(s);
  });

  if (analytics.googleSiteVerification) {
    setMeta('name', 'google-site-verification', analytics.googleSiteVerification);
  }
};

/** يحدّث العنوان والأيقونة ووسوم SEO من الإعدادات */
const applyHead = (settings, lang) => {
  /* اسم المتجر الموحّد حسب اللغة — نفس منطق Logo/Footer/WhatsApp تماماً */
  const name = localizedBrandName(settings.siteName, settings.siteNameAr, lang);
  const seo = settings.seo || {};
  const brand = settings.branding || {};

  /**
   * عنوان تبويب المتصفح.
   *
   * كانت حقول branding.browserTitle / browserTitleEn / titleSeparator
   * قابلة للتعديل في: المنصّة ← العلامة البيضاء، لكن لا أحد يقرأها —
   * أي أن المدير يغيّرها ولا يتغيّر شيء إطلاقاً (إعداد وهمي).
   *
   * ترتيب الأولوية مقصود:
   *   1. عنوان العلامة البيضاء الصريح (الأكثر تحديداً)
   *   2. عنوان SEO
   *   3. اسم المتجر + الشعار النصي (السلوك القديم — يبقى افتراضاً)
   */
  const customTitle = (lang === 'ar' ? brand.browserTitle : brand.browserTitleEn)
    || brand.browserTitle || '';
  const sep = brand.titleSeparator || '|';
  document.title = customTitle
    || seo.metaTitle
    || `${name}${settings.tagline ? ` ${sep} ${settings.tagline}` : ''}`;

  setMeta('name', 'description', seo.metaDescription || settings.tagline);
  setMeta('name', 'keywords', seo.keywords);
  setMeta('name', 'robots', seo.robots || 'index,follow');
  setMeta('property', 'og:title', seo.metaTitle || name);
  setMeta('property', 'og:description', seo.metaDescription || settings.tagline);
  setMeta('property', 'og:type', 'website');
  if (seo.ogImage) setMeta('property', 'og:image', seo.ogImage);
  setMeta('name', 'twitter:card', 'summary_large_image');
  if (seo.twitterHandle) setMeta('name', 'twitter:site', seo.twitterHandle);
  setMeta('name', 'theme-color', settings.theme?.accent);

  if (settings.favicon) {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = settings.favicon;
  }
};

export function ConfigProvider({ children }) {
  const { lang, setLang } = useI18n();
  // إعادة الرسم عند تبديل الزائر للوضع الليلي
  const mode = useThemeStore((s) => s.userChoice);
  const [config, setConfig] = useState(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [maintenance, setMaintenance] = useState(null);
  /* الخادم غير متاح عند الإقلاع — كان يُبتلع بصمت فيُعرض المتجر بصفحة بيضاء فارغة.
     نحتفظ بالعلم لعرض شاشة تشخيص واضحة مع زر إعادة محاولة بدل الفراغ الصامت. */
  const [configError, setConfigError] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await client.get('/storefront/config');
      const data = res.data?.data;
      if (data?.settings) {
        /**
         * تجاوزات الترجمة التي كتبها المدير.
         * نُطبّقها قبل تحديث الحالة حتى لا يومض النص الأصلي ثم يتغيّر.
         */
        if (data.settings.translationOverrides) {
          try {
            /* فك ترميز قديم (نقطة ← __) إن وُجد — المفاتيح الصحيحة تُمرَّر كما هي */
            const decoded = {};
            Object.entries(data.settings.translationOverrides || {}).forEach(([lng, pack]) => {
              if (!pack || typeof pack !== 'object') return;
              decoded[lng] = {};
              Object.entries(pack).forEach(([k, v]) => { decoded[lng][String(k).replaceAll('__', '.')] = v; });
            });
            // force: التجاوزات تتغيّر مع كل حفظ من اللوحة
            registerExtraTranslations('db-overrides', decoded, { force: true });
          } catch { /* لا نكسر التحميل بسبب ترجمة */ }
        }
        setConfig({ ...FALLBACK, ...data, settings: { ...FALLBACK.settings, ...data.settings } });
        setMaintenance(null);
        setConfigError(false);
      }
    } catch (err) {
      if (err?.response?.status === 503 && err.response.data?.maintenance) {
        setMaintenance(err.response.data.message);
        setConfigError(false);
      } else if (!err?.response || err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK' || err.response?.status >= 500) {
        /* الخادم غير قابل للوصول (متعطّل/بطيء) — نُظهر شاشة واضحة بدل صفحة بيضاء */
        setConfigError(true);
      }
      // نُبقي القيم الافتراضية حتى لا تنهار الواجهة
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* لغة المتجر الافتراضية (locale.defaultLanguage) تتقدّم على لغة المتصفح
     في الزيارة الأولى فقط، ولا تُفرض على زائر بدّل اللغة بنفسه. */
  useEffect(() => {
    if (loading) return;
    try {
      const auto = sessionStorage.getItem('alzeina_lang_auto') === '1';
      const toggled = sessionStorage.getItem('alzeina_lang_toggled') === '1';
      if (auto && !toggled) {
        const defLang = config.settings.locale?.defaultLanguage || config.settings.theme?.defaultLang;
        if ((defLang === 'ar' || defLang === 'en') && defLang !== lang) setLang(defLang);
      }
    } catch { /* noop */ }
  }, [loading, config.settings.locale, config.settings.theme, lang, setLang]);

  useEffect(() => {
    if (loading) return;
    // الوضع الافتراضي يأتي من الإعدادات، واختيار الزائر يتقدّم عليه
    useThemeStore.getState().setAdminDefault(config.settings.theme?.mode || 'light');
    applyThemeVars(config.settings.theme, mode);
    injectAnalytics(config.settings.analytics);
    setCurrency({
      symbol: config.settings.payment?.currencySymbol,
      symbolEn: config.settings.payment?.currencySymbolEn
    });
    // قواعد الشحن تأتي من الإعدادات لا من ثوابت الكود
    useCartStore.getState().setShippingRules(config.settings.shipping || {});
  }, [loading, mode, config.settings.theme, config.settings.analytics, config.settings.payment, config.settings.shipping]);

  // عنوان الصفحة ووسوم SEO تتبع الإعدادات واللغة الحالية
  useEffect(() => {
    if (loading) return;
    applyHead(config.settings, lang);
  }, [loading, config.settings, lang]);

  const value = useMemo(
    () => ({
      ...config,
      loading,
      maintenance,
      configError,
      reload: load,
      applyHead: (lang) => applyHead(config.settings, lang),
      /** بحث سريع عن محافظة */
      findGovernorate: (code) => config.governorates.find((g) => g.code === code || g._id === code),
      /** هل الميزة مفعّلة */
      feature: (key) => Boolean(config.settings.features?.[key])
    }),
    [config, loading, maintenance, configError, load]
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfig must be used within ConfigProvider');
  return ctx;
}

/** اختصار للإعدادات فقط */
export function useSettings() {
  return useConfig().settings;
}

/**
 * مفاتيح تشغيل الميزات.
 *
 * قاعدة التوافق الخلفي: الغياب = مُفعَّل. أي تثبيت قديم بلا كائن
 * flags يستمر بعرض كل الميزات تماماً كما كان.
 *
 * @example
 *   const { isEnabled } = useFlags();
 *   if (!isEnabled('wishlist')) return null;
 */
export function useFlags() {
  const settings = useConfig().settings;
  const flags = settings?.flags || {};
  const isEnabled = (key) => flags[key] !== false;
  return { flags, isEnabled };
}

/** اختصار لمفتاح واحد */
export function useFeature(key) {
  return useFlags().isEnabled(key);
}

/**
 * يُخفي أبناءه عند إطفاء الميزة.
 * الإخفاء لطيف: لا رسالة خطأ ولا مساحة فارغة، الصفحة تبقى سليمة.
 */
export function Feature({ name, children, fallback = null }) {
  return useFlags().isEnabled(name) ? children : fallback;
}
