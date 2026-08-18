import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { STORAGE_KEYS } from '@/utils/constants';

/**
 * الدولة الحالية للمتجر (EG / AE فقط حالياً).
 *
 * هذا الملف هو المصدر الوحيد للحقيقة على الواجهة — لا Context ثانٍ
 * ولا state موازية في أي مكان آخر. القيمة هنا «اقتراح» فقط:
 * الخادم (Phase D) يبقى المرجع النهائي للأسعار والعملة والشحن
 * وطرق الدفع عبر ترويسة X-Country (Gate 2).
 *
 * أولوية التحديد (تصميم Phase E المعتمد):
 *   1. اختيار المستخدم الصريح ضمن هذه الجلسة (setCountry)
 *   2. دولة المستخدم المسجّل users.country (syncFromUser عند الدخول)
 *   3. القيمة المحفوظة محلياً للزائر (persist: alzeina_country)
 *   4. EG افتراضاً
 *
 * أي كود غير موجود أو غير نشط في قائمة countries القادمة من الخادم
 * يُتجاهَل وتُعاد الدولة إلى الافتراضية.
 */
export const DEFAULT_COUNTRY = 'EG';

/** الدولتان الوحيدتان المعروفتان قبل وصول قائمة الخادم */
const SEED_CODES = [DEFAULT_COUNTRY, 'AE'];

const normalize = (code) => {
  const c = String(code || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : null;
};

export const useCountryStore = create()(
  persist(
    (set, get) => ({
      country: DEFAULT_COUNTRY,
      /** أكواد الدول النشطة لدى الخادم — تُملأ من /storefront/config */
      activeCodes: SEED_CODES,
      /**
       * هل آخر تعيين كان اختياراً صريحاً في هذه الجلسة؟
       * لا تُحفَظ في localStorage عمداً: في جلسة لاحقة يجب أن تتقدّم
       * دولة المستخدم المسجَّل على تفضيل زائر قديم.
       */
      explicit: false,

      /**
       * اختيار صريح من المستخدم (Country Selector — Gate 4).
       * يتجاهل أي كود غير نشط لدى الخادم ويعيد الدولة الفعلية.
       */
      setCountry: (code) => {
        const c = normalize(code);
        if (!c || !get().activeCodes.includes(c)) return get().country;
        set({ country: c, explicit: true });
        return c;
      },

      /**
       * تُستدعى بعد login/me: دولة المستخدم المحفوظة في الخادم تتقدّم
       * على قيمة الزائر المحلية، ولا تتقدّم أبداً على اختيار صريح
       * تمّ خلال هذه الجلسة. قيمة غير صالحة أو غير نشطة ⇒ EG.
       */
      syncFromUser: (code) => {
        const c = normalize(code);
        if (!c) return; // المستخدم بلا دولة محفوظة — لا نغيّر شيئاً
        if (get().explicit) return;
        const { activeCodes } = get();
        set({ country: activeCodes.includes(c) ? c : DEFAULT_COUNTRY });
      },

      /**
       * قائمة الدول القادمة من /storefront/config هي الحدّ الأقصى المقبول.
       * دولة حالية صارت غير موجودة أو غير نشطة ⇒ نرجع إلى الافتراضية
       * المُعلنة من الخادم (أو EG) دون لمس ما اختاره المستخدم سواها.
       */
      setActiveCountries: (countries, { defaultCode } = {}) => {
        const codes = (Array.isArray(countries) ? countries : [])
          .map((c) => normalize(c?.code))
          .filter(Boolean);
        if (!codes.length) return;
        const next = { activeCodes: codes };
        if (!codes.includes(get().country)) {
          const def = normalize(defaultCode);
          next.country =
            def && codes.includes(def)
              ? def
              : codes.includes(DEFAULT_COUNTRY)
                ? DEFAULT_COUNTRY
                : codes[0];
        }
        set(next);
      },
    }),
    {
      name: STORAGE_KEYS.country,
      storage: createJSONStorage(() => localStorage),
      /* نحفظ اختيار الدولة فقط؛ activeCodes/explicit جلسة-فقط */
      partialize: (s) => ({ country: s.country }),
      /* قيمة محفوظة ملفَّقة أو بصيغة غريبة لا تدخل الحالة أبداً */
      merge: (persisted, current) => {
        const saved = normalize(persisted?.country);
        return {
          ...current,
          country: saved && SEED_CODES.includes(saved) ? saved : current.country,
        };
      },
    }
  )
);

/** اختصار قراءة فقط — ليس مصدر حقيقة ثانياً */
export const useCountry = () => useCountryStore((s) => s.country);
