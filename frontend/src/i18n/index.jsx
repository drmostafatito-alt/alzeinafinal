import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { translations } from './translations';
import { STORAGE_KEYS } from '@/utils/constants';
import { readStorage, writeStorage } from '@/utils/helpers';

const I18nContext = createContext(null);

/**
 * حزم ترجمة إضافية تُحمَّل عند الطلب (مثل لوحة الإدارة).
 *
 * لماذا العدّاد؟ لأن `t` مُذكَّرة على `lang` فقط؛ فلو دمجنا مفاتيح
 * جديدة بعد أول تصيير لن يُعاد حساب أي شيء وستظهر المفاتيح الخام.
 * زيادة العدّاد تُخطر كل المشتركين بإعادة التصيير مرة واحدة.
 */
const extraListeners = new Set();
const registeredPacks = new Set();

export function registerExtraTranslations(name, pack, { force = false } = {}) {
  /**
   * الحزم الثابتة (مثل ترجمات اللوحة) تُسجَّل مرة واحدة.
   * تجاوزات المدير القادمة من القاعدة تحتاج force: تتغيّر مع كل حفظ،
   * ولو منعناها بالحارس لما رأى المدير تعديله إلا بعد إعادة تحميل كاملة.
   */
  if (!force && registeredPacks.has(name)) return;
  registeredPacks.add(name);

  let changed = false;
  Object.keys(pack || {}).forEach((lng) => {
    const incoming = pack[lng];
    if (!incoming || typeof incoming !== 'object') return;
    // نتخطّى الدمج إن لم يتغيّر شيء فعلاً — يمنع إعادة تصيير بلا سبب
    const current = translations[lng] || {};
    const diff = Object.keys(incoming).some((k) => current[k] !== incoming[k]);
    if (!diff) return;
    translations[lng] = { ...current, ...incoming };
    changed = true;
  });

  if (changed || !force) extraListeners.forEach((fn) => fn());
}

/**
 * صيغة المخاطبة حسب جنس المستخدم.
 *
 * الصياغة داخل ملفات الترجمة: {{مذكّر|مؤنّث}}
 * مثال: 'مرحباً {{بك|بكِ}}' ⇒ رجل: "مرحباً بك" · امرأة: "مرحباً بكِ"
 *
 * لماذا علامة داخل النص بدل قاموسين منفصلين؟
 * فقط ~42 نصاً من أصل ~1500 يحمل تصريفاً جنسانياً. تكرار القاموس
 * كاملاً كان سيضاعف حجم الحزمة (+83 كيلوبايت) مقابل بضعة أحرف
 * مختلفة، وسيجبر المترجم على مزامنة نسختين من كل نص إلى الأبد.
 * العلامة تُبقي النص الواحد مصدراً واحداً للحقيقة.
 *
 * الأداء: الاستبدال يتم فقط عندما يحتوي النص على '{{' فعلاً، فلا
 * تدفع بقية النصوص أي تكلفة.
 */
const GENDER_RE = /\{\{([^{}|]*)\|([^{}|]*)\}\}/g;

/**
 * جسر بين المتاجر خارج React (authStore) ومزوّد i18n.
 * كتابة التخزين وحدها لا تُعيد التصيير، فنُخطر المشتركين صراحةً.
 */
const genderListeners = new Set();
export const notifyGenderChange = (g) => genderListeners.forEach((fn) => fn(g));

export const applyGender = (text, gender) => {
  if (typeof text !== 'string' || !text.includes('{{')) return text;
  // الافتراضي مؤنّث: هو السلوك الأصلي للمشروع قبل إضافة هذه الميزة
  return text.replace(GENDER_RE, (_, male, female) => (gender === 'male' ? male : female));
};

const getInitialLang = () => {
  const saved = readStorage(STORAGE_KEYS.lang);
  if (saved === 'ar' || saved === 'en') return saved;
  /* لا اختيار محفوظ: اللغة حُددت تلقائياً — يسجَّل ذلك حتى يستطيع
     إعداد defaultLanguage في لوحة الإدارة تجاوز لغة المتصفح في الزيارة الأولى. */
  try { sessionStorage.setItem('alzeina_lang_auto', '1'); } catch { /* noop */ }
  if (typeof navigator !== 'undefined' && navigator.language?.startsWith('en')) return 'en';
  return 'ar';
};

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(getInitialLang);
  /**
   * صيغة المخاطبة. تُضبط من ملف المستخدم عبر setGender بعد تسجيل
   * الدخول؛ الزائر غير المسجَّل يبقى على الافتراضي (مؤنّث) وهو
   * سلوك المشروع الأصلي بلا تغيير.
   */
  const [gender, setGenderState] = useState(() => readStorage(STORAGE_KEYS.gender) || 'female');
  // يتغيّر عند تسجيل حزمة ترجمة إضافية، فيُعاد بناء `t`
  const [packVersion, setPackVersion] = useState(0);

  useEffect(() => {
    const bump = () => setPackVersion((v) => v + 1);
    extraListeners.add(bump);
    return () => extraListeners.delete(bump);
  }, []);

  // تسجيل الدخول/الخروج يغيّر صيغة المخاطبة من خارج شجرة React
  useEffect(() => {
    const onGender = (g) => setGenderState(g === 'male' ? 'male' : 'female');
    genderListeners.add(onGender);
    return () => genderListeners.delete(onGender);
  }, []);

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    writeStorage(STORAGE_KEYS.lang, lang);
  }, [lang, dir]);

  const t = useCallback(
    (key, vars) => {
      let text = translations[lang]?.[key] ?? translations.ar?.[key] ?? key;
      if (vars) {
        Object.entries(vars).forEach(([k, v]) => {
          text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        });
      }
      // التصريف الجنساني يُطبَّق أخيراً حتى يشمل النصوص المُدرَجة عبر vars
      return applyGender(text, gender);
    },
    // packVersion مقصود: يُجبر إعادة البناء بعد دمج حزمة جديدة
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, packVersion, gender]
  );

  const toggleLang = useCallback(() => {
    try {
      sessionStorage.setItem('alzeina_lang_toggled', '1');
      sessionStorage.removeItem('alzeina_lang_auto');
    } catch { /* noop */ }
    setLang((l) => (l === 'ar' ? 'en' : 'ar'));
  }, []);

  /** يُستدعى بعد تسجيل الدخول وعند تغيير التفضيل من الملف الشخصي */
  const setGender = useCallback((g) => {
    const next = g === 'male' ? 'male' : 'female';
    setGenderState(next);
    writeStorage(STORAGE_KEYS.gender, next);
  }, []);

  const value = useMemo(
    () => ({ lang, dir, isRTL: dir === 'rtl', t, setLang, toggleLang, gender, setGender }),
    [lang, dir, t, toggleLang, gender, setGender]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

/** shorthand */
export function useT() {
  return useI18n().t;
}
