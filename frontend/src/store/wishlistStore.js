import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { STORAGE_KEYS } from '@/utils/constants';

export const useWishlistStore = create()(
  persist(
    (set, get) => ({
      items: [],

      toggle: (product) => {
        const id = product._id || product.id;
        const exists = get().items.some((i) => i.productId === id);
        if (exists) {
          set({ items: get().items.filter((i) => i.productId !== id) });
          return false;
        }
        set({
          items: [
            {
              productId: id,
              slug: product.slug,
              name: product.name,
              nameEn: product.nameEn,
              image: product.mainImage || product.image,
              price: product.price,
              oldPrice: product.oldPrice,
              discount: product.discount,
              rating: product.rating,
              reviewsCount: product.reviewsCount,
              stock: product.stock,
              brand: product.brand,
              category: product.category,
              addedAt: new Date().toISOString(),
            },
            ...get().items,
          ],
        });
        return true;
      },

      remove: (productId) => set({ items: get().items.filter((i) => i.productId !== productId) }),
      clear: () => set({ items: [] }),
      has: (productId) => get().items.some((i) => i.productId === productId),
      count: () => get().items.length,

      /**
       * المفضلة تخص المستخدم الحالي فقط.
       * لا نمسّ مفضلة الزائر (userId = null) — تنظيف الخروج عبر clearForLogout.
       */
      syncOwner: (userId) => {
        const { ownerId } = get();
        if (!userId) return;
        if (ownerId && ownerId !== userId) {
          set({ items: [], ownerId: userId });
          return;
        }
        if (ownerId !== userId) set({ ownerId: userId });
      },

      /** تُستدعى عند تسجيل الخروج فقط */
      clearForLogout: () => set({ items: [], ownerId: null }),
      ownerId: null,
    }),
    {
      name: STORAGE_KEYS.wishlist,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ items: s.items, ownerId: s.ownerId }),
    }
  )
);
