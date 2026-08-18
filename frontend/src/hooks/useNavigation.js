import { useMemo } from 'react';
import { useConfig } from '@/config/ConfigProvider';
import { applyGender, useI18n } from '@/i18n';

/**
 * قائمة التنقّل — مصدر واحد لسطح المكتب والموبايل.
 *
 * كانت الروابط مكتوبة مرتين (Navbar.jsx و MobileMenu.jsx)، فلا يستطيع
 * المالك إضافة رابط أو حذفه أو إعادة ترتيبه، وأي تعديل يدوي كان يجب
 * أن يُكرَّر في ملفين ويُنسى أحدهما.
 *
 * السلوك:
 *  • `navigation.items` فارغة ⇒ القائمة الافتراضية المترجمة (سلوك
 *    المشروع الأصلي حرفياً، فلا يتغيّر شيء لأي متجر قائم).
 *  • غير فارغة ⇒ قائمة المالك بالكامل، بترتيبها وقواعد ظهورها.
 *
 * `device` يرشّح حسب showDesktop/showMobile حتى يستطيع المالك إظهار
 * رابط على الموبايل فقط (مثل "اتصل بنا") أو العكس.
 */
export function useNavigation(device = 'desktop') {
  const { t, lang, gender } = useI18n();
  const { settings } = useConfig();

  return useMemo(() => {
    const raw = settings?.navigation?.items;

    /* القائمة الافتراضية — تبقى مترجمة وقابلة للتجاوز من مركز الترجمة */
    if (!Array.isArray(raw) || !raw.length) {
      return [
        { id: 'home', to: '/', label: t('nav.home'), end: true },
        { id: 'shop', to: '/shop', label: t('nav.shop') },
        { id: 'new', to: '/shop?sort=newest', label: t('nav.newArrivals') },
        { id: 'best', to: '/shop?sort=bestSeller', label: t('nav.bestSellers') },
        { id: 'offers', to: '/shop?discount=true', label: t('nav.offers'), highlight: true },
        { id: 'about', to: '/about', label: t('nav.about') },
        { id: 'contact', to: '/contact', label: t('nav.contact') },
      ];
    }

    /** يبني الرابط النهائي حسب نوع العنصر */
    const hrefOf = (it) => {
      const v = (it.url || '').trim();
      switch (it.type) {
        case 'category': return `/shop?category=${v}`;
        case 'brand': return `/shop?brand=${v}`;
        case 'page': return `/page/${v.replace(/^\/?page\//, '')}`;
        case 'external': return v;
        default: return v.startsWith('/') ? v : `/${v}`;
      }
    };

    const visible = (it) => (device === 'mobile' ? it.showMobile !== false : it.showDesktop !== false);

    const map = (it) => ({
      id: it.id || it.url || it.label,
      to: hrefOf(it),
      /* نصوص المالك تمرّ بمحلّل صيغة المخاطبة مثل بقية المحتوى */
      label: applyGender((lang === 'ar' ? it.label : it.labelEn) || it.label || '', gender),
      external: it.type === 'external',
      newTab: Boolean(it.newTab),
      icon: it.icon || '',
      highlight: Boolean(it.highlight),
      children: (Array.isArray(it.children) ? it.children : []).filter(visible).map(map),
    });

    return raw.filter((it) => it && it.label && visible(it)).map(map);
  }, [settings?.navigation?.items, device, t, lang, gender]);
}

export default useNavigation;
