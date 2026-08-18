import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { SHIPPING, STORAGE_KEYS } from '@/utils/constants';

const lineKey = (productId, variant) => `${productId}::${variant || 'default'}`;

/** أقصى كمية للصنف الواحد حين لا يعرف المتجر المخزون بعد */
const MAX_QTY = 99;

const normalizeQty = (n, stock) => {
  const q = Math.floor(Number(n));
  if (!Number.isFinite(q) || q < 1) return 1;
  return Math.min(q, Math.max(1, Number(stock) || MAX_QTY));
};

export const useCartStore = create()(
  persist(
    (set, get) => ({
      items: [],
      coupon: null,
      shippingGovernorate: null,
      /** صاحب السلة الحالية — يمنع تسرّب سلة مستخدم إلى آخر */
      ownerId: null,

      /* ---------- actions ---------- */
      addItem: (product, quantity = 1, variant = null) => {
        const id = product._id || product.id;
        const key = lineKey(id, variant?.sku || variant);
        const items = [...get().items];
        const idx = items.findIndex((i) => i.key === key);
        const stock = variant?.stock ?? product.stock ?? 99;

        if (idx > -1) {
          // نفس المنتج/الخيار = سطر واحد فقط (يمنع تكرار المنتجات في السلة)
          items[idx] = {
            ...items[idx],
            stock,
            quantity: normalizeQty(items[idx].quantity + quantity, stock),
          };
        } else {
          items.push({
            key,
            productId: id,
            slug: product.slug,
            name: product.name,
            nameEn: product.nameEn,
            image: product.mainImage || product.image,
            price: variant?.price ?? product.price,
            oldPrice: product.oldPrice,
            quantity: normalizeQty(quantity, stock),
            stock,
            variant: variant?.name || variant || null,
            variantSku: variant?.sku || null,
            sku: product.sku,
          });
        }
        set({ items });
      },

      updateQuantity: (key, quantity) => {
        const q = Math.floor(Number(quantity));
        if (!Number.isFinite(q) || q <= 0) return get().removeItem(key);
        set({
          items: get().items.map((i) =>
            i.key === key ? { ...i, quantity: normalizeQty(q, i.stock) } : i
          ),
        });
      },

      increment: (key) => {
        const item = get().items.find((i) => i.key === key);
        if (item) get().updateQuantity(key, item.quantity + 1);
      },

      decrement: (key) => {
        const item = get().items.find((i) => i.key === key);
        if (item) get().updateQuantity(key, item.quantity - 1);
      },

      removeItem: (key) => set({ items: get().items.filter((i) => i.key !== key) }),

      clear: () => set({ items: [], coupon: null }),

      applyCoupon: (coupon) => set({ coupon }),
      removeCoupon: () => set({ coupon: null }),
      setShippingGovernorate: (gov) => set({ shippingGovernorate: gov }),

      /**
       * تربط السلة بالمستخدم الحالي.
       *
       * • دخول مستخدم مختلف عن صاحب السلة المحفوظة → تُفرَّغ السلة،
       *   حتى لا يرى المستخدم الجديد منتجات من جلسة سابقة على نفس الجهاز.
       * • دخول أول مرة لزائر كان يتسوّق (ownerId = null) → نحتفظ بسلته
       *   وننسبها له، فلا يفقد ما اختاره قبل التسجيل.
       * • زائر بلا حساب (userId = null) → لا نمسّ السلة إطلاقاً.
       *   إفراغ سلة الزائر هنا كان يمحو السلة عند كل تحميل للصفحة.
       *   تنظيف الخروج يتم عبر clearForLogout() صراحةً.
       */
      syncOwner: (userId) => {
        const { ownerId } = get();
        if (!userId) return;
        if (ownerId && ownerId !== userId) {
          set({ items: [], coupon: null, ownerId: userId });
          return;
        }
        if (ownerId !== userId) set({ ownerId: userId });
      },

      /** تُستدعى عند تسجيل الخروج فقط — السلة لا تتبع الجهاز بعد الخروج */
      clearForLogout: () => set({ items: [], coupon: null, ownerId: null }),

      /** يوفّق أسعار/مخزون السلة مع أحدث بيانات الخادم ويحذف المنتجات المحذوفة */
      syncWithServer: (products = []) => {
        const byId = new Map(products.map((p) => [String(p._id || p.id), p]));
        set({
          items: get()
            .items.filter((i) => byId.has(String(i.productId)))
            .map((i) => {
              const p = byId.get(String(i.productId));
              const stock = p.stock ?? i.stock ?? MAX_QTY;
              return {
                ...i,
                name: p.name ?? i.name,
                nameEn: p.nameEn ?? i.nameEn,
                slug: p.slug ?? i.slug,
                image: p.mainImage || p.image || i.image,
                price: i.variantSku ? i.price : p.price ?? i.price,
                oldPrice: p.oldPrice ?? i.oldPrice,
                stock,
                quantity: normalizeQty(i.quantity, stock),
              };
            }),
        });
      },

      /* ---------- selectors ---------- */
      count: () => get().items.reduce((s, i) => s + i.quantity, 0),

      subtotal: () => get().items.reduce((s, i) => s + i.price * i.quantity, 0),

      couponDiscount: () => {
        const { coupon } = get();
        if (!coupon) return 0;
        const sub = get().subtotal();
        if (coupon.minOrderAmount && sub < coupon.minOrderAmount) return 0;
        let d = coupon.discountType === 'percentage' ? (sub * coupon.discountValue) / 100 : coupon.discountValue;
        if (coupon.maxDiscount) d = Math.min(d, coupon.maxDiscount);
        return Math.round(Math.min(d, sub) * 100) / 100;
      },

      /**
       * قواعد الشحن تأتي من إعدادات المتجر (قاعدة البيانات) عبر setShippingRules.
       * القيم في SHIPPING مجرد احتياطي قبل تحميل الإعدادات — والخادم يبقى
       * المرجع النهائي عند إنشاء الطلب.
       */
      shippingRules: { ...SHIPPING, freeEnabled: true },

      setShippingRules: (rules = {}) =>
        set({
          shippingRules: {
            defaultCost: Number(rules.defaultCost ?? SHIPPING.defaultCost) || 0,
            freeThreshold: Number(rules.freeShippingThreshold ?? SHIPPING.freeThreshold) || 0,
            freeEnabled: rules.freeShippingEnabled !== false,
          },
        }),

      shippingCost: () => {
        const { freeThreshold, freeEnabled, defaultCost } = get().shippingRules;
        const sub = get().subtotal() - get().couponDiscount();
        if (sub <= 0) return 0;
        if (freeEnabled && freeThreshold > 0 && sub >= freeThreshold) return 0;
        return get().shippingGovernorate?.shipping ?? defaultCost;
      },

      total: () => {
        const t = get().subtotal() - get().couponDiscount() + get().shippingCost();
        return Math.max(0, Math.round(t * 100) / 100);
      },

      savings: () =>
        get().items.reduce(
          (s, i) => s + (i.oldPrice && i.oldPrice > i.price ? (i.oldPrice - i.price) * i.quantity : 0),
          0
        ),

      freeShippingRemaining: () => {
        const { freeThreshold, freeEnabled } = get().shippingRules;
        if (!freeEnabled || freeThreshold <= 0) return 0;
        const remaining = freeThreshold - (get().subtotal() - get().couponDiscount());
        return remaining > 0 ? Math.round(remaining * 100) / 100 : 0;
      },

      hasItem: (productId) => get().items.some((i) => i.productId === productId),
      itemQuantity: (productId) =>
        get().items.filter((i) => i.productId === productId).reduce((s, i) => s + i.quantity, 0),
    }),
    {
      name: STORAGE_KEYS.cart,
      storage: createJSONStorage(() => localStorage),
      // لا نحفظ shippingRules: تُحمَّل دائماً من إعدادات الخادم عند الإقلاع
      partialize: (s) => ({
        items: s.items,
        coupon: s.coupon,
        shippingGovernorate: s.shippingGovernorate,
        ownerId: s.ownerId,
      }),
    }
  )
);
