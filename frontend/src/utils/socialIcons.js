import { FiFacebook, FiInstagram, FiTwitter, FiYoutube } from 'react-icons/fi';

/**
 * أيقونات التواصل الاجتماعي — مصدر واحد.
 *
 * كانت هذه الخريطة معرّفة داخل الفوتر فقط، فلمّا احتاجتها صفحة
 * الصيانة كان البديل نسخها. النسخ يعني أن إضافة شبكة جديدة تتطلّب
 * تعديل ملفين ويُنسى أحدهما.
 *
 * المفاتيح تطابق حقول settings.social بالضبط.
 */
export const SOCIAL_ICONS = {
  instagram: FiInstagram,
  facebook: FiFacebook,
  twitter: FiTwitter,
  youtube: FiYoutube,
};

/** يحوّل settings.social إلى قائمة جاهزة للعرض (يتجاهل الفارغ) */
export const socialLinks = (social = {}) =>
  Object.entries(social)
    .filter(([key, url]) => url && SOCIAL_ICONS[key])
    .map(([key, url]) => ({ key, icon: SOCIAL_ICONS[key], href: url, label: key }));

export default SOCIAL_ICONS;
