/**
 * سجلّ الخطوط المعتمد — مصدر الحقيقة الوحيد لنظام الخطوط.
 *
 * لكل خط: الأوزان المتاحة فعلاً على Google Fonts (طلب وزن غير موجود عبر
 * css2 قد يعيد ملفاً فارغاً أو خطأ فيرجع المتصفح للخط الافتراضي بصمت).
 *
 * تستخدمه:
 *  - ConfigProvider.loadWebFonts لتحميل الخط بالأوزان الصحيحة.
 *  - DesignStudio لعرض قوائم اختيار حقيقية بدل حقل نصي حر.
 */

export const ARABIC_FONTS = [
  { family: 'Tajawal',              weights: '300;400;500;700;800' },
  { family: 'Cairo',                weights: '300;400;500;600;700;800' },
  { family: 'IBM Plex Sans Arabic', weights: '300;400;500;600;700' },
  { family: 'Noto Kufi Arabic',     weights: '300;400;500;600;700;800' },
  { family: 'Noto Sans Arabic',     weights: '300;400;500;600;700;800' },
  { family: 'Almarai',              weights: '300;400;700;800' },
  { family: 'Readex Pro',           weights: '300;400;500;600;700' },
  { family: 'Changa',               weights: '300;400;500;600;700;800' },
];

export const ENGLISH_FONTS = [
  { family: 'Jost',                weights: '300;400;500;600;700' },
  { family: 'Inter',               weights: '300;400;500;600;700;800' },
  { family: 'Montserrat',          weights: '300;400;500;600;700;800' },
  { family: 'Poppins',             weights: '300;400;500;600;700' },
  { family: 'DM Sans',             weights: '300;400;500;600;700' },
  { family: 'Manrope',             weights: '300;400;500;600;700;800' },
  { family: 'Playfair Display',    weights: '400;500;600;700;800' },
  { family: 'Cormorant Garamond',  weights: '400;500;600;700' },
];

const ALL = [...ARABIC_FONTS, ...ENGLISH_FONTS];

/** الأوزان الصحيحة لعائلة معيّنة، مع احتياط معقول للخطوط غير المسجلة */
export function fontWeights(family) {
  return ALL.find((f) => f.family === family)?.weights || '400;500;600;700';
}

/** رابط Google Fonts css2 لعائلة واحدة بأوزانها الصحيحة */
export function fontHref(family) {
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${fontWeights(family)}&display=swap`;
}

/** خيارات جاهزة لقوائم الاختيار في لوحة الإدارة */
export const ARABIC_FONT_OPTIONS = ARABIC_FONTS.map((f) => ({ value: f.family, label: f.family }));
export const ENGLISH_FONT_OPTIONS = ENGLISH_FONTS.map((f) => ({ value: f.family, label: f.family }));
