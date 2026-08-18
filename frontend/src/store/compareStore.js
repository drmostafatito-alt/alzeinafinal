import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { STORAGE_KEYS } from '@/utils/constants';

/** أقصى عدد منتجات في المقارنة — أكثر من ذلك يصبح الجدول غير مقروء على الجوال */
export const COMPARE_MAX = 4;

/**
 * مقارنة المنتجات.
 *
 * نخزّن لقطة من بيانات المنتج (لا المرجع فقط) حتى تبقى المقارنة
 * قابلة للعرض فوراً بعد إعادة تحميل الصفحة دون انتظار الشبكة.
 */
export const useCompareStore = create()(
  persist(
    (set, get) => ({
      items: [],

      /** يضيف أو يزيل — يرجع وصفاً للنتيجة لتعرضه الواجهة */
      toggle: (product) => {
        const id = product._id || product.id;
        const exists = get().items.some((i) => i.productId === id);

        if (exists) {
          set({ items: get().items.filter((i) => i.productId !== id) });
          return { added: false };
        }

        if (get().items.length >= COMPARE_MAX) {
          return { added: false, full: true };
        }

        set({
          items: [
            ...get().items,
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
              sku: product.sku,
              brand: product.brand,
              category: product.category,
              tags: product.tags || [],
              colors: product.colors || [],
              sizes: product.sizes || []
            }
          ]
        });
        return { added: true };
      },

      remove: (productId) => set({ items: get().items.filter((i) => i.productId !== productId) }),
      clear: () => set({ items: [] }),
      has: (productId) => get().items.some((i) => i.productId === productId),
      count: () => get().items.length
    }),
    {
      name: STORAGE_KEYS.compare,
      storage: createJSONStorage(() => localStorage)
    }
  )
);
