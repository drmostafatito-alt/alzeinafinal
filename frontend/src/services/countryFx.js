import client from '@/api/client';
import { userService } from '@/services';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { useCountryStore } from '@/store/countryStore';
import { STORAGE_KEYS } from '@/utils/constants';
import { readStorage, writeStorage } from '@/utils/helpers';

/**
 * Gate 5 — تبديل الدولة داخل الجلسة (EG ↔ AE) بلا أي تحديث للصفحة.
 *
 * هذه الوحدة هي المنسّق المركزي الوحيد، وهي وحدة طرفية (leaf) تستورد
 * المتاجر فلا تُنشئ أي دورة استيراد. ترتيب التنفيذ:
 *
 *   1. setCountry (المصدر الوحيد) — تتغيّر مفاتيح React Query فوراً (Gate 3)
 *   2. ConfigProvider يلتقط التغيير ويعيد تحميل الإعدادات بشاشة تحميل
 *      كاملة ⇒ لا لحظة نصف-دولة (Gate 2 يرسل X-Country تلقائياً)
 *   3. الزائر: تفضيل محلي فقط. المسجّل: PUT /users/me/country أولاً؛
 *      الفشل ⇒ تراجع كامل إلى الدولة السابقة (لا اختلاف صامت)
 *   4. السلة تُعاد مزامنتها من الخادم عبر /products/ids (بوابة Phase D:
 *      يسقط غير المتاح ويعيد الأسعار — بلا أي تحويل عملة) + تصفير
 *      المحافظة/الإمارة المختارة + إسقاط الكوبون (الخادم يعيد تحققه)
 *   5. Recently Viewed يُعاد بناؤه بنفس بيانات الخادم (B4)
 *
 * حارس السباق: كل خطوة async تتحقق أن الدولة الهدف ما زالت هي الفعلية؛
 * تبديل لاحق (EG→AE→EG سريع) يجعل هذه الدورة تتوقف دون كتابة أي حالة.
 */

const isCurrent = (target) => useCountryStore.getState().country === target;

/** يمهر وقتاً بزمن الخادم لأسطر السلة + سجل المشاهدة في طلب واحد */
const fetchProductsForIds = async (ids) => {
  if (!ids.length) return [];
  const res = await client.get('/products/ids', { params: { ids: ids.join(',') } });
  return res.data?.data?.products || res.data?.products || [];
};

const syncRecentViewed = (products) => {
  const byId = new Map(products.map((p) => [String(p._id || p.id), p]));
  const prev = readStorage(STORAGE_KEYS.recent, []);
  if (!Array.isArray(prev) || !prev.length) return;
  /* نفس الحقول التي تبنيها useRecentlyViewed.add — صورة متوافقة تماماً */
  const next = prev
    .map((r) => {
      const p = byId.get(String(r._id || r.id));
      if (!p) return null; // أصبح غير متاح في الدولة الجديدة ⇒ لا يُعرض
      return {
        _id: p._id || p.id,
        slug: p.slug,
        name: p.name,
        nameEn: p.nameEn,
        mainImage: p.mainImage || p.image,
        price: p.price,
        oldPrice: p.oldPrice,
        discount: p.discount,
        rating: p.rating,
        reviewsCount: p.reviewsCount,
        stock: p.stock,
        brand: p.brand,
      };
    })
    .filter(Boolean);
  writeStorage(STORAGE_KEYS.recent, next);
  /* إخطار الشريط المفتوح حالياً ليعيد القراءة فوراً بدل انتظار إعادة التحميل */
  try {
    window.dispatchEvent(new CustomEvent('alzeina:recent-refresh'));
  } catch {
    /* بيئات بلا window — آمن */
  }
};

/**
 * ينفّذ التبديل الكامل. يعيد true عند النجاح/البقاء، وfalse إذا التراجع.
 * @param {string} code 'EG' | 'AE'
 */
export const switchCountry = async (code) => {
  const store = useCountryStore.getState();
  const target = String(code || '').toUpperCase();
  const prev = store.country;
  const prevExplicit = store.explicit;

  /* لا شيء إذا رفضه المتجر (غير نشطة) أو هي نفسها الحالية */
  const applied = store.setCountry(target);
  if (applied !== target) return false;
  if (applied === prev) return true;

  const user = useAuthStore.getState().user;
  const token = useAuthStore.getState().token;

  /* المسجّل: نحفظ أولاً على الخادم، وعند الفشل نرجع كاملاً */
  if (token && user) {
    try {
      await userService.updateCountry(target);
      const updated = { ...useAuthStore.getState().user, country: target };
      writeStorage(STORAGE_KEYS.user, updated);
      useAuthStore.setState({ user: updated });
    } catch (err) {
      /* تراجع صريح: لا اختلاف بين الواجهة والخادم */
      useCountryStore.setState({ country: prev, explicit: prevExplicit });
      return false;
    }
  }

  /* السلة: لا تُصدَّق أسعار localStorage أبداً — المرجع طلب الخادم */
  const cart = useCartStore.getState();
  const cartIds = cart.items.map((i) => String(i.productId));
  const recent = readStorage(STORAGE_KEYS.recent, []);
  const recentIds = Array.isArray(recent) ? recent.map((r) => String(r._id || r.id)) : [];
  const unionIds = [...new Set([...cartIds, ...recentIds])];

  try {
    const products = await fetchProductsForIds(unionIds);
    if (!isCurrent(target)) return true; // تبديل أحدث سبقنا — نتوقف بصمت
    cart.syncWithServer(products);
    /* محافظة مصر لا تصلح إمارة والعكس — اختيار جديد إجباري */
    cart.setShippingGovernorate(null);
    /* الكوبون لا تُفترض صلاحيته عبر الدول — الخادم يعيد تحققه عند الطلب */
    cart.removeCoupon();
    if (!isCurrent(target)) return true;
    syncRecentViewed(products);
  } catch (err) {
    /**
     * فشل مزامنة السلة: الإعدادات تُعاد تحميلها بشاشة كاملة (ConfigProvider)
     * وسلة المستخدم تبقى، لكن أسعارها غير موثوقة للدولة الجديدة.
     * الخادم هو المرجع عند إنشاء الطلب فيرفض أي سعر/شحن قديم.
     */
    if (import.meta.env.DEV) console.warn('[country] cart reprice failed', err);
  }
  return true;
};
