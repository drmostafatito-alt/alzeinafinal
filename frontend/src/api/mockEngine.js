/**
 * محرّك يحاكي سلوك الـ Backend (فلترة، ترتيب، ترقيم صفحات، CRUD)
 * فوق البيانات التجريبية — يستخدم فقط عندما لا يكون السيرفر متاحاً.
 */
import {
  mockBanners,
  mockBrands,
  mockCategories,
  mockCoupons,
  mockDashboard,
  mockInstagram,
  mockMessages,
  mockOrders,
  mockProducts,
  mockReviews,
  mockSettings,
  mockTestimonials,
  mockUsers,
} from './mockData';

/** نُسخ قابلة للتعديل (حتى تعمل عمليات CRUD في لوحة الإدارة) */
const db = {
  products: [...mockProducts],
  categories: [...mockCategories],
  brands: [...mockBrands],
  banners: [...mockBanners],
  coupons: [...mockCoupons],
  users: [...mockUsers],
  orders: [...mockOrders],
  reviews: [...mockReviews],
  messages: [...mockMessages],
  settings: { ...mockSettings },
};

export const getDb = () => db;

const nextId = (prefix, list) => `${prefix}${Date.now().toString(36)}${list.length}`;

const matchText = (p, q) => {
  const s = q.toLowerCase().trim();
  return (
    p.name.toLowerCase().includes(s) ||
    (p.nameEn || '').toLowerCase().includes(s) ||
    (p.description || '').toLowerCase().includes(s) ||
    (p.brand?.name || '').toLowerCase().includes(s) ||
    (p.brand?.nameEn || '').toLowerCase().includes(s) ||
    (p.category?.name || '').toLowerCase().includes(s) ||
    (p.category?.nameEn || '').toLowerCase().includes(s) ||
    (p.sku || '').toLowerCase().includes(s)
  );
};

export const mockGetProducts = (params = {}) => {
  const {
    page = 1,
    limit = 12,
    sort = 'newest',
    category,
    brand,
    minPrice,
    maxPrice,
    rating,
    discount,
    inStock,
    search,
    featured,
    bestSeller,
    newArrival,
  } = params;

  let list = db.products.filter((p) => p.isActive);

  if (search) list = list.filter((p) => matchText(p, search));
  if (category) {
    const cats = String(category).split(',');
    list = list.filter((p) => cats.includes(p.category?.slug) || cats.includes(p.category?._id));
  }
  if (brand) {
    const brs = String(brand).split(',');
    list = list.filter((p) => brs.includes(p.brand?.slug) || brs.includes(p.brand?._id));
  }
  if (minPrice) list = list.filter((p) => p.price >= Number(minPrice));
  if (maxPrice) list = list.filter((p) => p.price <= Number(maxPrice));
  if (rating) list = list.filter((p) => p.rating >= Number(rating));
  if (discount === 'true' || discount === true) list = list.filter((p) => p.discount > 0);
  else if (discount) list = list.filter((p) => p.discount >= Number(discount));
  if (inStock === 'true' || inStock === true) list = list.filter((p) => p.stock > 0);
  if (featured === 'true' || featured === true) list = list.filter((p) => p.isFeatured);
  if (bestSeller === 'true' || bestSeller === true) list = list.filter((p) => p.isBestSeller);
  if (newArrival === 'true' || newArrival === true) list = list.filter((p) => p.isNewArrival);

  const sorters = {
    'price-asc': (a, b) => a.price - b.price,
    'price-desc': (a, b) => b.price - a.price,
    rating: (a, b) => b.rating - a.rating,
    bestSeller: (a, b) => (b.soldCount || 0) - (a.soldCount || 0),
    discount: (a, b) => b.discount - a.discount,
    newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  };
  list = [...list].sort(sorters[sort] || sorters.newest);

  const total = list.length;
  const p = Number(page) || 1;
  const l = Number(limit) || 12;
  const products = list.slice((p - 1) * l, p * l);

  return {
    products,
    pagination: { page: p, limit: l, total, pages: Math.max(1, Math.ceil(total / l)) },
  };
};

export const mockGetProduct = (idOrSlug) => {
  const product =
    db.products.find((p) => p._id === idOrSlug) || db.products.find((p) => p.slug === idOrSlug);
  if (!product) throw Object.assign(new Error('المنتج غير موجود'), { status: 404 });
  return { product };
};

export const mockGetRelated = (idOrSlug, limit = 8) => {
  const { product } = mockGetProduct(idOrSlug);
  const related = db.products
    .filter((p) => p._id !== product._id && p.isActive)
    .sort((a, b) => {
      const score = (x) =>
        (x.category?._id === product.category?._id ? 2 : 0) + (x.brand?._id === product.brand?._id ? 1 : 0);
      return score(b) - score(a) || b.rating - a.rating;
    })
    .slice(0, limit);
  return { products: related };
};

export const mockSearchSuggestions = (q, limit = 6) => {
  if (!q?.trim()) return { products: [], categories: [], brands: [] };
  const s = q.toLowerCase().trim();
  return {
    products: db.products.filter((p) => matchText(p, s)).slice(0, limit),
    categories: db.categories
      .filter((c) => c.name.toLowerCase().includes(s) || (c.nameEn || '').toLowerCase().includes(s))
      .slice(0, 3),
    brands: db.brands
      .filter((b) => b.name.toLowerCase().includes(s) || (b.nameEn || '').toLowerCase().includes(s))
      .slice(0, 3),
  };
};

export const mockGetCategories = () => ({
  categories: db.categories.map((c) => ({
    ...c,
    productCount: db.products.filter((p) => p.category?._id === c._id && p.isActive).length,
  })),
});

export const mockGetBrands = () => ({
  brands: db.brands.map((b) => ({
    ...b,
    productCount: db.products.filter((p) => p.brand?._id === b._id && p.isActive).length,
  })),
});

export const mockGetBanners = (position) => ({
  banners: db.banners
    .filter((b) => b.isActive && (!position || b.position === position))
    .sort((a, b) => a.order - b.order),
});

export const mockGetReviews = (productId) => ({
  reviews: db.reviews.filter((r) => r.product === productId && r.isActive),
});

export const mockAddReview = (payload) => {
  const review = {
    _id: nextId('r', db.reviews),
    product: payload.productId,
    user: payload.user || { _id: 'guest', name: 'زائر' },
    rating: payload.rating,
    title: payload.title,
    comment: payload.comment,
    createdAt: new Date().toISOString(),
    isActive: true,
  };
  db.reviews.unshift(review);
  return { review };
};

export const mockValidateCoupon = (code) => {
  const coupon = db.coupons.find((c) => c.code === String(code).toUpperCase());
  if (!coupon) throw Object.assign(new Error('الكوبون غير موجود'), { status: 404 });
  const now = Date.now();
  const isValid =
    coupon.isActive &&
    new Date(coupon.startDate).getTime() <= now &&
    new Date(coupon.endDate).getTime() >= now &&
    coupon.usedCount < coupon.usageLimit;
  return { coupon, isValid };
};

export const mockTestimonialsList = () => ({ testimonials: mockTestimonials });
export const mockInstagramList = () => ({ posts: mockInstagram });
export const mockGetSettings = () => ({ settings: db.settings });
export const mockUpdateSettings = (payload) => {
  db.settings = { ...db.settings, ...payload };
  return { settings: db.settings };
};

/* ---------- Auth ---------- */
/**
 * لا توجد مصادقة تجريبية إطلاقاً.
 *
 * المصادقة تتم على الخادم فقط: لا حسابات جاهزة، ولا بيانات دخول مكتوبة
 * في الكود، ولا إمكانية للدخول ببريد عشوائي. أي محاولة لاستخدام
 * المصادقة في وضع العرض التجريبي تُرفض صراحةً.
 */
const authUnavailable = () => {
  throw Object.assign(new Error('تسجيل الدخول يتطلب الاتصال بالخادم'), { status: 503 });
};

export const mockLogin = authUnavailable;
export const mockRegister = authUnavailable;
export const mockGetMe = authUnavailable;

/* ---------- Orders ---------- */
export const mockGetOrders = (userId) => ({
  orders: userId ? db.orders.filter((o) => o.user?._id === userId) : db.orders,
});

export const mockGetOrder = (id) => {
  const order = db.orders.find((o) => o._id === id || o.orderNumber === id);
  if (!order) throw Object.assign(new Error('الطلب غير موجود'), { status: 404 });
  return { order };
};

export const mockCreateOrder = (payload) => {
  const order = {
    _id: nextId('o', db.orders),
    orderNumber: `ORD-${Date.now().toString(36).toUpperCase()}`,
    user: payload.user || { _id: 'guest', name: payload.shippingAddress?.name || 'زائر' },
    items: (payload.items || []).map((it, idx) => ({
      _id: `oi-${idx}`,
      product: it.product || { _id: it.productId, name: it.name, mainImage: it.image },
      name: it.name,
      price: it.price,
      quantity: it.quantity,
      total: it.price * it.quantity,
    })),
    subtotal: payload.subtotal || 0,
    discount: 0,
    couponDiscount: payload.couponDiscount || 0,
    shippingCost: payload.shippingCost || 0,
    tax: 0,
    total: payload.total || 0,
    paymentMethod: payload.paymentMethod || 'cod',
    paymentStatus: 'pending',
    orderStatus: 'pending',
    shippingAddress: payload.shippingAddress,
    notes: payload.notes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.orders.unshift(order);
  return { order };
};

export const mockCancelOrder = (id, reason) => {
  const order = db.orders.find((o) => o._id === id || o.orderNumber === id);
  if (!order) throw Object.assign(new Error('الطلب غير موجود'), { status: 404 });
  order.orderStatus = 'cancelled';
  order.cancellationReason = reason;
  order.cancelledAt = new Date().toISOString();
  return { order };
};

export const mockUpdateOrderStatus = (id, status) => {
  const order = db.orders.find((o) => o._id === id);
  if (!order) throw Object.assign(new Error('الطلب غير موجود'), { status: 404 });
  order.orderStatus = status;
  if (status === 'delivered') order.paymentStatus = 'paid';
  order.updatedAt = new Date().toISOString();
  return { order };
};

/* ---------- Admin CRUD ---------- */
const crud = (key, prefix) => ({
  list: () => ({ [key]: db[key] }),
  create: (payload) => {
    const item = { _id: nextId(prefix, db[key]), createdAt: new Date().toISOString(), isActive: true, ...payload };
    db[key].unshift(item);
    return { [key.slice(0, -1)]: item };
  },
  update: (id, payload) => {
    const idx = db[key].findIndex((x) => x._id === id);
    if (idx === -1) throw Object.assign(new Error('غير موجود'), { status: 404 });
    db[key][idx] = { ...db[key][idx], ...payload, updatedAt: new Date().toISOString() };
    return { [key.slice(0, -1)]: db[key][idx] };
  },
  remove: (id) => {
    db[key] = db[key].filter((x) => x._id !== id);
    return { message: 'تم الحذف' };
  },
});

export const mockAdmin = {
  dashboard: () => mockDashboard(),
  products: {
    ...crud('products', 'p'),
    create: (payload) => {
      const cat = db.categories.find((c) => c._id === (payload.category?._id || payload.category));
      const br = db.brands.find((b) => b._id === (payload.brand?._id || payload.brand));
      const item = {
        _id: nextId('p', db.products),
        rating: 0,
        reviewsCount: 0,
        soldCount: 0,
        images: [],
        isActive: true,
        createdAt: new Date().toISOString(),
        ...payload,
        category: cat ? { _id: cat._id, name: cat.name, nameEn: cat.nameEn, slug: cat.slug } : payload.category,
        brand: br ? { _id: br._id, name: br.name, nameEn: br.nameEn, slug: br.slug, logo: br.logo } : payload.brand,
        discount:
          payload.oldPrice && payload.oldPrice > payload.price
            ? Math.round(((payload.oldPrice - payload.price) / payload.oldPrice) * 100)
            : 0,
      };
      db.products.unshift(item);
      return { product: item };
    },
    update: (id, payload) => {
      const idx = db.products.findIndex((x) => x._id === id);
      if (idx === -1) throw Object.assign(new Error('غير موجود'), { status: 404 });
      const cat = db.categories.find((c) => c._id === (payload.category?._id || payload.category));
      const br = db.brands.find((b) => b._id === (payload.brand?._id || payload.brand));
      const merged = {
        ...db.products[idx],
        ...payload,
        ...(cat ? { category: { _id: cat._id, name: cat.name, nameEn: cat.nameEn, slug: cat.slug } } : {}),
        ...(br ? { brand: { _id: br._id, name: br.name, nameEn: br.nameEn, slug: br.slug, logo: br.logo } } : {}),
        updatedAt: new Date().toISOString(),
      };
      merged.discount =
        merged.oldPrice && merged.oldPrice > merged.price
          ? Math.round(((merged.oldPrice - merged.price) / merged.oldPrice) * 100)
          : 0;
      db.products[idx] = merged;
      return { product: merged };
    },
  },
  categories: crud('categories', 'cat'),
  brands: crud('brands', 'br'),
  coupons: crud('coupons', 'c'),
  banners: crud('banners', 'bn'),
  users: crud('users', 'u'),
  reviews: crud('reviews', 'r'),
  messages: {
    ...crud('messages', 'm'),
    markRead: (id) => {
      const m = db.messages.find((x) => x._id === id);
      if (m) m.isRead = true;
      return { message: m };
    },
  },
  orders: {
    list: () => ({ orders: db.orders }),
    updateStatus: mockUpdateOrderStatus,
  },
};
