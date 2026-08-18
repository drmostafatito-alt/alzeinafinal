import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const STORAGE_KEY = 'alzeina_theme_mode';

/**
 * وضع العرض (فاتح/ليلي).
 *
 * الأولوية: اختيار المستخدم ← الوضع الافتراضي من إعدادات المدير.
 * `userChoice` يبقى null حتى يضغط المستخدم الزر، فيظل المتجر تابعاً
 * لإعدادات لوحة التحكم لكل زائر جديد.
 */
export const useThemeStore = create()(
  persist(
    (set, get) => ({
      /** null = اتبع إعدادات المتجر | 'light' | 'dark' */
      userChoice: null,
      /** الوضع الافتراضي القادم من إعدادات المدير */
      adminDefault: 'light',

      setAdminDefault: (mode) => {
        if (get().adminDefault !== mode) set({ adminDefault: mode || 'light' });
      },

      /** الوضع الفعلي المطبَّق حالياً */
      resolved: () => get().userChoice || get().adminDefault || 'light',

      toggle: () => set({ userChoice: get().resolved() === 'dark' ? 'light' : 'dark' }),

      /** العودة لاتباع إعدادات المتجر */
      reset: () => set({ userChoice: null })
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ userChoice: s.userChoice })
    }
  )
);
