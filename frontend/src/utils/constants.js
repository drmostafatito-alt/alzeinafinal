export const BRAND = {
  name: 'Al Zeina',
  nameAr: 'الزينة',
  tagline: { ar: 'جمالك يبدأ من هنا', en: 'Where your beauty begins' },
  email: 'info@alzeina.com',
  phone: '+20 100 123 4567',
  whatsapp: '+201001234567',
  address: { ar: 'القاهرة، مصر', en: 'Cairo, Egypt' },
};

export const COLORS = {
  ink: '#111111',
  rose: '#C89A8B',
  cream: '#FFF8F5',
  blush: '#F8E8EA',
  white: '#FFFFFF',
};

export const CURRENCY = { code: 'EGP', symbol: { ar: 'ج.م', en: 'EGP' } };

export const SHIPPING = {
  defaultCost: 50,
  freeThreshold: 500,
};

export const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  RETURNED: 'returned',
};

export const ORDER_STATUS_FLOW = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.DELIVERED,
];

export const ORDER_STATUS_META = {
  /* دفع يدوي: أنشئ الطلب والإيصال بانتظار مراجعة الأدمن */
  'awaiting-payment': { ar: 'بانتظار تأكيد الدفع', en: 'Awaiting payment confirmation', color: 'bg-sky-100 text-sky-700' },
  pending: { ar: 'قيد الانتظار', en: 'Pending', color: 'bg-amber-100 text-amber-700' },
  confirmed: { ar: 'تم التأكيد', en: 'Confirmed', color: 'bg-sky-100 text-sky-700' },
  processing: { ar: 'قيد التجهيز', en: 'Processing', color: 'bg-indigo-100 text-indigo-700' },
  shipped: { ar: 'تم الشحن', en: 'Shipped', color: 'bg-violet-100 text-violet-700' },
  delivered: { ar: 'تم التوصيل', en: 'Delivered', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { ar: 'ملغي', en: 'Cancelled', color: 'bg-red-100 text-red-700' },
  returned: { ar: 'مرتجع', en: 'Returned', color: 'bg-stone-200 text-stone-700' },
};

export const PAYMENT_STATUS_META = {
  pending: { ar: 'بانتظار الدفع', en: 'Pending', color: 'bg-amber-100 text-amber-700' },
  paid: { ar: 'مدفوع', en: 'Paid', color: 'bg-emerald-100 text-emerald-700' },
  failed: { ar: 'فشل الدفع', en: 'Failed', color: 'bg-red-100 text-red-700' },
  refunded: { ar: 'مسترد', en: 'Refunded', color: 'bg-stone-200 text-stone-700' },
  /* الدفع اليدوي: رُفع الإيصال وبانتظار مراجعة الأدمن — ليس مدفوعاً بعد */
  'awaiting-verification': { ar: 'قيد مراجعة الدفع', en: 'Payment under review', color: 'bg-sky-100 text-sky-700' },
  rejected: { ar: 'دُفع مرفوض', en: 'Payment rejected', color: 'bg-red-100 text-red-700' },
};

export const PAYMENT_METHODS = {
  COD: 'cod',
  CARD: 'card',
  WALLET: 'wallet',
};

export const GOVERNORATES = [
  { value: 'cairo', ar: 'القاهرة', en: 'Cairo', shipping: 40 },
  { value: 'giza', ar: 'الجيزة', en: 'Giza', shipping: 45 },
  { value: 'alexandria', ar: 'الإسكندرية', en: 'Alexandria', shipping: 55 },
  { value: 'qalyubia', ar: 'القليوبية', en: 'Qalyubia', shipping: 50 },
  { value: 'dakahlia', ar: 'الدقهلية', en: 'Dakahlia', shipping: 60 },
  { value: 'sharqia', ar: 'الشرقية', en: 'Sharqia', shipping: 60 },
  { value: 'gharbia', ar: 'الغربية', en: 'Gharbia', shipping: 60 },
  { value: 'monufia', ar: 'المنوفية', en: 'Monufia', shipping: 60 },
  { value: 'beheira', ar: 'البحيرة', en: 'Beheira', shipping: 65 },
  { value: 'kafr-el-sheikh', ar: 'كفر الشيخ', en: 'Kafr El Sheikh', shipping: 65 },
  { value: 'damietta', ar: 'دمياط', en: 'Damietta', shipping: 65 },
  { value: 'port-said', ar: 'بورسعيد', en: 'Port Said', shipping: 65 },
  { value: 'ismailia', ar: 'الإسماعيلية', en: 'Ismailia', shipping: 65 },
  { value: 'suez', ar: 'السويس', en: 'Suez', shipping: 65 },
  { value: 'fayoum', ar: 'الفيوم', en: 'Fayoum', shipping: 70 },
  { value: 'beni-suef', ar: 'بني سويف', en: 'Beni Suef', shipping: 70 },
  { value: 'minya', ar: 'المنيا', en: 'Minya', shipping: 75 },
  { value: 'assiut', ar: 'أسيوط', en: 'Assiut', shipping: 80 },
  { value: 'sohag', ar: 'سوهاج', en: 'Sohag', shipping: 85 },
  { value: 'qena', ar: 'قنا', en: 'Qena', shipping: 90 },
  { value: 'luxor', ar: 'الأقصر', en: 'Luxor', shipping: 90 },
  { value: 'aswan', ar: 'أسوان', en: 'Aswan', shipping: 95 },
  { value: 'red-sea', ar: 'البحر الأحمر', en: 'Red Sea', shipping: 100 },
  { value: 'matrouh', ar: 'مطروح', en: 'Matrouh', shipping: 100 },
  { value: 'new-valley', ar: 'الوادي الجديد', en: 'New Valley', shipping: 110 },
  { value: 'north-sinai', ar: 'شمال سيناء', en: 'North Sinai', shipping: 110 },
  { value: 'south-sinai', ar: 'جنوب سيناء', en: 'South Sinai', shipping: 110 },
];

export const SORT_OPTIONS = [
  { value: 'newest', ar: 'الأحدث', en: 'Newest' },
  { value: 'price-asc', ar: 'السعر: من الأقل', en: 'Price: Low to High' },
  { value: 'price-desc', ar: 'السعر: من الأعلى', en: 'Price: High to Low' },
  { value: 'rating', ar: 'الأعلى تقييماً', en: 'Top Rated' },
  { value: 'bestSeller', ar: 'الأكثر مبيعاً', en: 'Best Sellers' },
  { value: 'discount', ar: 'أكبر خصم', en: 'Biggest Discount' },
];

export const PER_PAGE_OPTIONS = [12, 24, 48];

export const STORAGE_KEYS = {
  token: 'alzeina_token',
  user: 'alzeina_user',
  cart: 'alzeina_cart',
  /** الدولة المختارة (EG | AE) — المصدر الوحيد store/countryStore.js */
  country: 'alzeina_country',
  wishlist: 'alzeina_wishlist',
  lang: 'alzeina_lang',
  /** صيغة المخاطبة العربية (male | female) — تفضيل عرض فقط */
  gender: 'alzeina_gender',
  recent: 'alzeina_recent',
  compare: 'alzeina_compare',
};
