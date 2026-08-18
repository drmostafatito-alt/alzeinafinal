import { create } from 'zustand';
import { authService } from '@/services';
import { STORAGE_KEYS } from '@/utils/constants';
import { notifyGenderChange } from '@/i18n';
import { readStorage, removeStorage, writeStorage } from '@/utils/helpers';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';

/**
 * ينسب السلة والمفضلة للمستخدم الحالي.
 * يُفرغهما تلقائياً فقط عند تبديل الحساب على نفس الجهاز،
 * ولا يمسّ بيانات الزائر غير المسجَّل.
 */
const bindUserData = (userId) => {
  if (!userId) return;
  useCartStore.getState().syncOwner(userId);
  useWishlistStore.getState().syncOwner?.(userId);
};

/** تنظيف صريح عند تسجيل الخروج — السلة والمفضلة لا تبقيان للمستخدم التالي */
const clearUserData = () => {
  useCartStore.getState().clearForLogout();
  useWishlistStore.getState().clearForLogout?.();
};

export const useAuthStore = create((set, get) => ({
  user: readStorage(STORAGE_KEYS.user),
  token: readStorage(STORAGE_KEYS.token),
  loading: false,
  initialized: false,

  isAuthenticated: () => Boolean(get().token && get().user),
  isAdmin: () => ['admin', 'moderator'].includes(get().user?.role),

  setSession: (user, token) => {
    writeStorage(STORAGE_KEYS.user, user);
    if (token) writeStorage(STORAGE_KEYS.token, token);
    set({ user, token: token || get().token });
    bindUserData(user?._id || user?.id);
    /**
     * صيغة المخاطبة العربية تتبع الملف الشخصي.
     * نكتبها في التخزين مباشرة (لا عبر i18n) لأن المتجر قد يستدعي
     * setSession خارج شجرة React؛ مزوّد i18n يقرأ نفس المفتاح.
     */
    if (user?.gender === 'male' || user?.gender === 'female') {
      writeStorage(STORAGE_KEYS.gender, user.gender);
      notifyGenderChange(user.gender);
    }
  },

  login: async (credentials) => {
    set({ loading: true });
    try {
      const { data } = await authService.login(credentials);
      get().setSession(data.user, data.token);
      return data.user;
    } finally {
      set({ loading: false });
    }
  },

  /** التسجيل يُنشئ الحساب ويسجّل الدخول فوراً — بلا تفعيل بريد */
  register: async (payload) => {
    set({ loading: true });
    try {
      const res = await authService.register(payload);
      const data = res.data || {};
      get().setSession(data.user, data.token);
      return { user: data.user };
    } finally {
      set({ loading: false });
    }
  },

  /** دخول لوحة الإدارة عبر مسار منفصل يرفض حسابات العملاء */
  adminLogin: async (credentials) => {
    set({ loading: true });
    try {
      const { data } = await authService.adminLogin(credentials);
      get().setSession(data.user, data.token);
      return data.user;
    } finally {
      set({ loading: false });
    }
  },

  /**
   * تسجيل خروج آمن: نُعلم الخادم لإبطال الجلسة/الكوكي، ثم ننظّف
   * كل أثر محلي للمستخدم (توكن + بيانات + سلة + مفضلة).
   * التنظيف المحلي يحدث دائماً حتى لو فشل طلب الخادم.
   */
  logout: async () => {
    try {
      if (get().token) await authService.logout();
    } catch {
      /* الجلسة تُنظَّف محلياً على أي حال */
    } finally {
      removeStorage(STORAGE_KEYS.token);
      removeStorage(STORAGE_KEYS.user);
      set({ user: null, token: null });
      clearUserData();
    }
  },

  updateProfile: async (payload) => {
    const { data } = await authService.updateMe(payload);
    const user = data.user || { ...get().user, ...payload };
    writeStorage(STORAGE_KEYS.user, user);
    set({ user });
    return user;
  },

  refresh: async () => {
    if (!get().token) {
      set({ initialized: true });
      return;
    }
    try {
      const { data } = await authService.me();
      if (data?.user) {
        writeStorage(STORAGE_KEYS.user, data.user);
        set({ user: data.user });
        bindUserData(data.user._id || data.user.id);
      }
    } catch (err) {
      // توكن منتهٍ/ملغى → ننهي الجلسة بدل إبقاء واجهة "مسجّل دخول" معطلة
      if (err?.response?.status === 401) {
        removeStorage(STORAGE_KEYS.token);
        removeStorage(STORAGE_KEYS.user);
        set({ user: null, token: null });
        clearUserData();
      }
      // أي خطأ آخر (شبكة/خادم) نُبقي معه الجلسة المحلية كما هي
    } finally {
      set({ initialized: true });
    }
  },
}));
