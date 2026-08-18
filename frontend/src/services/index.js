import client, { withFallback } from '@/api/client';
import * as M from '@/api/mockEngine';
import { STORAGE_KEYS } from '@/utils/constants';
import { readStorage } from '@/utils/helpers';

/* ============ Products ============ */
export const productService = {
  list: (params = {}) =>
    withFallback(() => client.get('/products', { params }), () => M.mockGetProducts(params)),

  featured: (limit = 8) =>
    withFallback(
      () => client.get('/products/featured', { params: { limit } }),
      () => M.mockGetProducts({ featured: true, limit })
    ),

  bestSellers: (limit = 8) =>
    withFallback(
      () => client.get('/products/best-sellers', { params: { limit } }),
      () => M.mockGetProducts({ bestSeller: true, limit, sort: 'bestSeller' })
    ),

  newArrivals: (limit = 8) =>
    withFallback(
      () => client.get('/products/new-arrivals', { params: { limit } }),
      () => M.mockGetProducts({ newArrival: true, limit, sort: 'newest' })
    ),

  onSale: (limit = 8) =>
    withFallback(
      () => client.get('/products', { params: { discount: 1, limit, sort: 'discount' } }),
      () => M.mockGetProducts({ discount: true, limit, sort: 'discount' })
    ),

  bySlug: (slug) =>
    withFallback(() => client.get(`/products/slug/${slug}`), () => M.mockGetProduct(slug)),

  byId: (id) => withFallback(() => client.get(`/products/${id}`), () => M.mockGetProduct(id)),

  byIds: (ids = []) =>
    withFallback(
      () => client.get('/products/ids', { params: { ids: ids.join(',') } }),
      () => ({ products: M.mockGetProducts({ limit: 50 }).products.filter((p) => ids.includes(p._id || p.id)) })
    ),

  related: (id, limit = 8) =>
    withFallback(
      () => client.get(`/products/${id}/related`, { params: { limit } }),
      () => M.mockGetRelated(id, limit)
    ),

  suggestions: (q) =>
    withFallback(
      () => client.get('/products/search/suggestions', { params: { q, search: q } }),
      () => M.mockSearchSuggestions(q)
    ),
};

/* ============ Taxonomy ============ */
export const categoryService = {
  list: () => withFallback(() => client.get('/categories'), () => M.mockGetCategories()),
  bySlug: (slug) =>
    withFallback(
      () => client.get(`/categories/${slug}`),
      () => {
        const { categories } = M.mockGetCategories();
        const category = categories.find((c) => c.slug === slug);
        if (!category) throw Object.assign(new Error('القسم غير موجود'), { status: 404 });
        return { category, products: M.mockGetProducts({ category: slug, limit: 20 }).products };
      }
    ),
};

export const brandService = {
  list: () => withFallback(() => client.get('/brands'), () => M.mockGetBrands()),
  bySlug: (slug) =>
    withFallback(
      () => client.get(`/brands/${slug}`),
      () => {
        const { brands } = M.mockGetBrands();
        const brand = brands.find((b) => b.slug === slug);
        if (!brand) throw Object.assign(new Error('الماركة غير موجودة'), { status: 404 });
        return { brand };
      }
    ),
};

export const bannerService = {
  list: (position) =>
    withFallback(
      () => client.get('/banners', { params: position ? { position } : {} }),
      () => M.mockGetBanners(position)
    ),
};

/* ============ Content ============ */
export const contentService = {
  testimonials: () => withFallback(() => client.get('/testimonials'), () => M.mockTestimonialsList()),
  instagram: () => withFallback(() => client.get('/instagram'), () => M.mockInstagramList()),
  settings: () => withFallback(() => client.get('/settings'), () => M.mockGetSettings()),
  subscribe: (email) =>
    withFallback(() => client.post('/newsletter/subscribe', { email }), () => ({ message: 'ok' })),
  contact: (payload) =>
    withFallback(() => client.post('/contact', payload), () => {
      M.mockAdmin.messages.create({ ...payload, isRead: false });
      return { message: 'ok' };
    }),
};

/* ============ Auth ============ */
/**
 * المصادقة تتصل بالخادم دائماً — بلا أي بيانات تجريبية أو حسابات وهمية.
 * السماح بمصادقة "احتياطية" في المتصفح يعني أن أي شخص يستطيع الدخول
 * بلا تحقق حقيقي، لذلك لا نستخدم withFallback هنا إطلاقاً.
 */
export const authService = {
  login: async (payload) => {
    const res = await client.post('/auth/login', payload);
    return { data: res.data?.data ?? res.data, raw: res.data };
  },
  register: async (payload) => {
    const res = await client.post('/auth/register', payload);
    return { data: res.data?.data ?? res.data, raw: res.data };
  },
  /** دخول لوحة الإدارة — مسار منفصل على الخادم */
  adminLogin: async (payload) => {
    const res = await client.post('/auth/admin/login', payload);
    return { data: res.data?.data ?? res.data, raw: res.data };
  },
  me: async () => {
    const res = await client.get('/auth/me');
    return { data: res.data?.data ?? res.data, raw: res.data };
  },
  updateMe: async (payload) => {
    const res = await client.put('/auth/me', payload);
    return { data: res.data?.data ?? res.data, raw: res.data };
  },
  changePassword: (payload) => client.put('/auth/change-password', payload),
  forgotPassword: (payload) => client.post('/auth/forgot-password', payload),
  passwordResetRequirements: (email) => client.get('/auth/password-reset-requirements', { params: { email } }),
  resetPassword: (payload) => client.post('/auth/reset-password', payload),
  /** يُبطل جلسة الخادم والكوكي — التنظيف المحلي يتم في authStore */
  logout: () => client.post('/auth/logout'),
};

/* ============ Reviews ============ */
export const reviewService = {
  byProduct: (productId) =>
    withFallback(() => client.get(`/reviews/product/${productId}`), () => M.mockGetReviews(productId)),
  create: (payload) =>
    withFallback(
      () => client.post('/reviews', payload),
      () => M.mockAddReview({ ...payload, user: readStorage(STORAGE_KEYS.user) })
    ),
};

/* ============ Coupons ============ */
export const couponService = {
  validate: (code) =>
    withFallback(() => client.get(`/coupons/validate/${code}`), () => M.mockValidateCoupon(code)),
};

/* ============ Orders ============ */
export const orderService = {
  create: (payload) =>
    withFallback(
      () => client.post('/orders', payload),
      () => M.mockCreateOrder({ ...payload, user: readStorage(STORAGE_KEYS.user) })
    ),
  list: () =>
    withFallback(
      () => client.get('/orders'),
      () => M.mockGetOrders(readStorage(STORAGE_KEYS.user)?._id)
    ),
  byId: (id) => withFallback(() => client.get(`/orders/${id}`), () => M.mockGetOrder(id)),
  cancel: (id, reason) =>
    withFallback(() => client.put(`/orders/${id}/cancel`, { reason }), () => M.mockCancelOrder(id, reason)),
};

/* ============ Users ============ */
export const userService = {
  /** حفظ دولة المستخدم (Phase D) — لا ترويسة X-Country على مسارات /users */
  updateCountry: async (country) => {
    const res = await client.put('/users/me/country', { country });
    return { data: res.data?.data ?? res.data };
  },
};

/* ============ Addresses ============ */
export const addressService = {
  list: () =>
    withFallback(
      () => client.get('/users/addresses'),
      () => ({ addresses: readStorage('alzeina_addresses', []) })
    ),
  create: (payload) =>
    withFallback(
      () => client.post('/users/addresses', payload),
      () => ({ address: { ...payload, _id: `a${Date.now().toString(36)}` } })
    ),
  update: (id, payload) =>
    withFallback(() => client.put(`/users/addresses/${id}`, payload), () => ({ address: { ...payload, _id: id } })),
  remove: (id) =>
    withFallback(() => client.delete(`/users/addresses/${id}`), () => ({ message: 'ok' })),
  setDefault: (id) =>
    withFallback(() => client.put(`/users/addresses/${id}/default`), () => ({ message: 'ok' })),
};

/* ============ Admin ============ */
const adminResource = (path, mockRes, key) => ({
  list: () => withFallback(() => client.get(`/admin/${path}`), () => mockRes.list()),
  create: (payload) =>
    withFallback(() => client.post(`/admin/${path}`, payload), () => mockRes.create(payload)),
  update: (id, payload) =>
    withFallback(() => client.put(`/admin/${path}/${id}`, payload), () => mockRes.update(id, payload)),
  remove: (id) =>
    withFallback(() => client.delete(`/admin/${path}/${id}`), () => mockRes.remove(id)),
  key,
});

export const adminService = {
  dashboard: () =>
    withFallback(() => client.get('/admin/dashboard'), () => M.mockAdmin.dashboard()),
  products: adminResource('products', M.mockAdmin.products, 'products'),
  categories: adminResource('categories', M.mockAdmin.categories, 'categories'),
  brands: adminResource('brands', M.mockAdmin.brands, 'brands'),
  coupons: adminResource('coupons', M.mockAdmin.coupons, 'coupons'),
  banners: adminResource('banners', M.mockAdmin.banners, 'banners'),
  users: adminResource('users', M.mockAdmin.users, 'users'),
  reviews: adminResource('reviews', M.mockAdmin.reviews, 'reviews'),
  messages: {
    ...adminResource('messages', M.mockAdmin.messages, 'messages'),
    markRead: (id) =>
      withFallback(() => client.put(`/admin/messages/${id}/read`), () => M.mockAdmin.messages.markRead(id)),
  },
  orders: {
    list: () => withFallback(() => client.get('/admin/orders'), () => M.mockAdmin.orders.list()),
    updateStatus: (id, status) =>
      withFallback(
        () => client.put(`/admin/orders/${id}/status`, { status, orderStatus: status }),
        () => M.mockAdmin.orders.updateStatus(id, status)
      ),
  },
  settings: {
    get: () => withFallback(() => client.get('/admin/settings'), () => M.mockGetSettings()),
    update: (payload) =>
      withFallback(() => client.put('/admin/settings', payload), () => M.mockUpdateSettings(payload)),
  },
  inventory: {
    low: () =>
      withFallback(
        () => client.get('/admin/inventory/low'),
        () => ({ products: M.getDb().products.filter((p) => p.stock <= 5) })
      ),
    update: (productId, stock) =>
      withFallback(
        () => client.put('/admin/inventory/update', { productId, stock }),
        () => M.mockAdmin.products.update(productId, { stock })
      ),
  },
};

/* ============ Upload ============ */
export const uploadService = {
  image: async (file, folder = 'products') => {
    const form = new FormData();
    form.append('image', file);
    form.append('folder', folder);
    try {
      const res = await client.post('/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return { url: res.data?.data?.url || res.data?.url, isMock: false };
    } catch {
      // Fallback: عرض الصورة محلياً كـ base64
      const url = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
      return { url, isMock: true };
    }
  },
};
