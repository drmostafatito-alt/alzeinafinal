/**
 * بيانات تجريبية كاملة تُستخدم كـ fallback عندما يكون الـ Backend غير متاح.
 * الشكل مطابق تماماً لاستجابات الـ API الحقيقية (Mongo-like documents).
 */

const img = (seed, w = 600, h = 600) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

export const mockCategories = [
  {
    _id: 'cat1',
    name: 'الشامبو والبلسم',
    nameEn: 'Shampoo & Conditioner',
    slug: 'shampoo-conditioner',
    description: 'مجموعة متنوعة من الشامبو والبلسم للعناية بالشعر',
    descriptionEn: 'Shampoos and conditioners for every hair type',
    image: img('shampoo-cat', 800, 800),
    icon: 'droplet',
    order: 1,
    isActive: true,
    productCount: 12,
  },
  {
    _id: 'cat2',
    name: 'كريمات الشعر والزيوت',
    nameEn: 'Hair Creams & Oils',
    slug: 'hair-creams-oils',
    description: 'كريمات وزيوت طبيعية لتغذية وترطيب الشعر',
    descriptionEn: 'Natural creams and oils to nourish your hair',
    image: img('hairoil-cat', 800, 800),
    icon: 'leaf',
    order: 2,
    isActive: true,
    productCount: 9,
  },
  {
    _id: 'cat3',
    name: 'العناية بالبشرة',
    nameEn: 'Skincare',
    slug: 'skincare',
    description: 'منتجات العناية بالبشرة من غسول ومرطب وواقي شمس',
    descriptionEn: 'Cleansers, moisturizers and sunscreens',
    image: img('skincare-cat', 800, 800),
    icon: 'sparkles',
    order: 3,
    isActive: true,
    productCount: 15,
  },
  {
    _id: 'cat4',
    name: 'المكياج',
    nameEn: 'Makeup',
    slug: 'makeup',
    description: 'أحدث منتجات المكياج لإطلالة متألقة',
    descriptionEn: 'The latest makeup for a radiant look',
    image: img('makeup-cat', 800, 800),
    icon: 'brush',
    order: 4,
    isActive: true,
    productCount: 18,
  },
  {
    _id: 'cat5',
    name: 'العطور والجسم',
    nameEn: 'Fragrances & Body',
    slug: 'fragrances-body',
    description: 'عطور ومنتجات العناية بالجسم',
    descriptionEn: 'Perfumes and body care essentials',
    image: img('perfume-cat', 800, 800),
    icon: 'flower',
    order: 5,
    isActive: true,
    productCount: 11,
  },
  {
    _id: 'cat6',
    name: 'العناية بالأظافر',
    nameEn: 'Nail Care',
    slug: 'nail-care',
    description: 'كل ما يخص العناية بالأظافر والمناكير',
    descriptionEn: 'Everything for beautiful nails',
    image: img('nails-cat', 800, 800),
    icon: 'star',
    order: 6,
    isActive: true,
    productCount: 7,
  },
];

export const mockBrands = [
  { _id: 'br1', name: 'لوريال', nameEn: "L'Oréal", slug: 'loreal', logo: img('loreal-logo', 300, 160), isActive: true, description: 'ماركة فرنسية عالمية' },
  { _id: 'br2', name: 'نيفيا', nameEn: 'Nivea', slug: 'nivea', logo: img('nivea-logo', 300, 160), isActive: true, description: 'العناية الألمانية بالبشرة' },
  { _id: 'br3', name: 'غارنييه', nameEn: 'Garnier', slug: 'garnier', logo: img('garnier-logo', 300, 160), isActive: true, description: 'جمال طبيعي' },
  { _id: 'br4', name: 'مايبيلين', nameEn: 'Maybelline', slug: 'maybelline', logo: img('maybelline-logo', 300, 160), isActive: true, description: 'مكياج نيويورك' },
  { _id: 'br5', name: 'ايف روشيه', nameEn: 'Yves Rocher', slug: 'yves-rocher', logo: img('yves-logo', 300, 160), isActive: true, description: 'نباتي 100%' },
  { _id: 'br6', name: 'ذا أورديناري', nameEn: 'The Ordinary', slug: 'the-ordinary', logo: img('ordinary-logo', 300, 160), isActive: true, description: 'مكونات فعّالة' },
  { _id: 'br7', name: 'سيرافي', nameEn: 'CeraVe', slug: 'cerave', logo: img('cerave-logo', 300, 160), isActive: true, description: 'موصى به من أطباء الجلدية' },
  { _id: 'br8', name: 'بيوديرما', nameEn: 'Bioderma', slug: 'bioderma', logo: img('bioderma-logo', 300, 160), isActive: true, description: 'علم البيولوجيا في خدمة البشرة' },
];

const catRef = (id) => {
  const c = mockCategories.find((x) => x._id === id);
  return { _id: c._id, name: c.name, nameEn: c.nameEn, slug: c.slug };
};
const brandRef = (id) => {
  const b = mockBrands.find((x) => x._id === id);
  return { _id: b._id, name: b.name, nameEn: b.nameEn, slug: b.slug, logo: b.logo };
};

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

const rawProducts = [
  ['شامبو إلفيف للشعر التالف', 'Elvive Total Repair Shampoo', 'br1', 'cat1', 185, 240, 45, 4.6, 128, { f: true, b: true, n: false }, 3],
  ['بلسم فروكتيز للشعر الجاف', 'Fructis Nourishing Conditioner', 'br3', 'cat1', 145, 180, 60, 4.4, 96, { f: false, b: true, n: false }, 8],
  ['شامبو بالكيراتين المصلح', 'Keratin Smooth Shampoo', 'br1', 'cat1', 220, null, 32, 4.7, 210, { f: true, b: true, n: false }, 12],
  ['شامبو الأعشاب الطبيعية', 'Botanic Herbal Shampoo', 'br5', 'cat1', 260, 320, 18, 4.3, 54, { f: false, b: false, n: true }, 4],
  ['بلسم مكثف للشعر الخفيف', 'Volume Boost Conditioner', 'br3', 'cat1', 165, 195, 25, 4.2, 41, { f: false, b: false, n: true }, 6],
  ['زيت الأرجان المغربي', 'Moroccan Argan Hair Oil', 'br1', 'cat2', 310, 395, 28, 4.8, 264, { f: true, b: true, n: false }, 2],
  ['ماسك الشعر بزبدة الشيا', 'Shea Butter Hair Mask', 'br3', 'cat2', 195, 250, 40, 4.5, 132, { f: true, b: false, n: false }, 15],
  ['سيروم أطراف الشعر', 'Split Ends Repair Serum', 'br1', 'cat2', 175, null, 3, 4.1, 38, { f: false, b: false, n: true }, 9],
  ['كريم تصفيف بدون شطف', 'Leave-in Styling Cream', 'br5', 'cat2', 230, 285, 16, 4.4, 67, { f: false, b: true, n: false }, 5],
  ['زيت جوز الهند العضوي', 'Organic Coconut Hair Oil', 'br5', 'cat2', 140, 175, 35, 4.6, 145, { f: false, b: true, n: true }, 20],
  ['كريم مرطب للبشرة الجافة', 'Rich Moisturising Cream', 'br2', 'cat3', 125, 160, 50, 4.7, 320, { f: true, b: true, n: false }, 7],
  ['غسول الوجه المنقي', 'Purifying Face Wash', 'br2', 'cat3', 95, 120, 65, 4.3, 187, { f: false, b: true, n: false }, 11],
  ['سيروم فيتامين سي 15%', 'Vitamin C Serum 15%', 'br6', 'cat3', 385, 470, 30, 4.9, 412, { f: true, b: true, n: true }, 1],
  ['سيروم النياسيناميد 10%', 'Niacinamide 10% + Zinc', 'br6', 'cat3', 295, 340, 25, 4.8, 356, { f: true, b: true, n: false }, 3],
  ['واقي شمس SPF 50', 'Photoderm Max SPF 50+', 'br8', 'cat3', 520, 640, 20, 4.7, 198, { f: true, b: false, n: true }, 6],
  ['لوشن مرطب للوجه والجسم', 'Moisturising Lotion', 'br7', 'cat3', 340, 410, 24, 4.6, 224, { f: false, b: true, n: false }, 14],
  ['ماء ميسيلار للتنظيف', 'Sensibio H2O Micellar Water', 'br8', 'cat3', 380, null, 18, 4.8, 289, { f: true, b: true, n: false }, 10],
  ['كريم العين المضاد للهالات', 'Eye Repair Cream', 'br7', 'cat3', 275, 330, 2, 4.4, 76, { f: false, b: false, n: true }, 8],
  ['ماسكارا لاش سنسيشنال', 'Lash Sensational Mascara', 'br4', 'cat4', 245, 300, 55, 4.7, 398, { f: true, b: true, n: false }, 2],
  ['أحمر شفاه كولور سنسيشنال', 'Color Sensational Lipstick', 'br4', 'cat4', 165, 210, 70, 4.5, 276, { f: true, b: true, n: false }, 5],
  ['كريم أساس فيت مي', 'Fit Me Matte Foundation', 'br4', 'cat4', 285, 350, 42, 4.6, 341, { f: true, b: true, n: false }, 4],
  ['ليب تنت سوبر ستاي', 'SuperStay Matte Ink', 'br4', 'cat4', 225, 275, 38, 4.4, 189, { f: false, b: true, n: true }, 3],
  ['قلم تحديد العيون', 'Master Precise Eyeliner', 'br4', 'cat4', 135, 165, 48, 4.3, 154, { f: false, b: false, n: false }, 16],
  ['باليت ظلال العيون', 'Nude Eyeshadow Palette', 'br1', 'cat4', 420, 520, 20, 4.6, 112, { f: true, b: false, n: true }, 7],
  ['بلاشر بودرة', 'Powder Blush', 'br4', 'cat4', 155, null, 5, 4.2, 88, { f: false, b: false, n: false }, 13],
  ['بودرة تثبيت شفافة', 'Translucent Setting Powder', 'br1', 'cat4', 265, 320, 26, 4.5, 97, { f: false, b: true, n: true }, 9],
  ['عطر ليلة الياسمين', 'Jasmine Night Eau de Parfum', 'br5', 'cat5', 680, 850, 12, 4.8, 143, { f: true, b: true, n: true }, 3],
  ['بادي سبلاش بالفواكه', 'Fruity Body Splash', 'br5', 'cat5', 185, 230, 40, 4.4, 167, { f: false, b: true, n: false }, 12],
  ['لوشن الجسم باللافندر', 'Lavender Body Lotion', 'br5', 'cat5', 210, 260, 35, 4.5, 121, { f: false, b: false, n: false }, 18],
  ['مزيل عرق للبشرة الحساسة', 'Sensitive Roll-on Deodorant', 'br2', 'cat5', 85, 105, 80, 4.3, 234, { f: false, b: true, n: false }, 25],
  ['سكراب الجسم بالسكر', 'Sugar Body Scrub', 'br5', 'cat5', 195, 245, 22, 4.6, 89, { f: true, b: false, n: true }, 6],
  ['زبدة الجسم الغنية', 'Rich Body Butter', 'br2', 'cat5', 165, 200, 45, 4.7, 178, { f: false, b: true, n: false }, 11],
  ['طلاء أظافر لامع', 'Gel Shine Nail Polish', 'br4', 'cat6', 95, 125, 60, 4.2, 143, { f: false, b: true, n: false }, 8],
  ['مقوي الأظافر', 'Nail Strengthener Base', 'br1', 'cat6', 125, 155, 28, 4.4, 67, { f: false, b: false, n: true }, 5],
  ['مزيل طلاء الأظافر اللطيف', 'Gentle Nail Polish Remover', 'br3', 'cat6', 65, 85, 0, 4.1, 92, { f: false, b: false, n: false }, 22],
  ['كريم اليدين والأظافر', 'Hand & Nail Cream', 'br2', 'cat6', 78, 95, 55, 4.5, 201, { f: false, b: true, n: false }, 17],
];

export const mockProducts = rawProducts.map((p, i) => {
  const [name, nameEn, brandId, catId, price, oldPrice, stock, rating, reviewsCount, flags, ageDays] = p;
  const slug = nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const discount = oldPrice ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;
  return {
    _id: `p${i + 1}`,
    name,
    nameEn,
    slug,
    brand: brandRef(brandId),
    category: catRef(catId),
    description: `${name} — منتج أصلي 100% من ${brandRef(brandId).name}. تركيبة غنية ومُختبرة من أطباء الجلدية، مناسبة للاستخدام اليومي وتمنحك نتائج ملحوظة من الأسبوع الأول. خالٍ من البارابين والسلفات الضارة.`,
    descriptionEn: `${nameEn} — 100% authentic from ${brandRef(brandId).nameEn}. A dermatologically tested, rich formula suitable for daily use with visible results from the first week. Free from parabens and harsh sulfates.`,
    shortDescription: `${name} بتركيبة غنية ونتائج سريعة`,
    shortDescriptionEn: `${nameEn} with a rich formula and fast results`,
    price,
    oldPrice: oldPrice || undefined,
    discount,
    stock,
    sku: `AZ-${String(i + 1).padStart(4, '0')}`,
    mainImage: img(`${slug}-main`),
    images: [img(`${slug}-main`), img(`${slug}-2`), img(`${slug}-3`), img(`${slug}-4`)],
    ingredients:
      'ماء نقي، جلسرين نباتي، زيت الأرجان، فيتامين E، بانثينول، مستخلص الصبار، حمض الهيالورونيك.',
    ingredientsEn: 'Aqua, Glycerin, Argan Oil, Vitamin E, Panthenol, Aloe Vera Extract, Hyaluronic Acid.',
    usage: 'يوضع كمية مناسبة على المنطقة المستهدفة مرتين يومياً صباحاً ومساءً بحركات دائرية لطيفة.',
    usageEn: 'Apply an appropriate amount twice daily, morning and evening, with gentle circular motions.',
    benefits: 'ترطيب عميق يدوم 24 ساعة • تحسين الملمس والمظهر • حماية من العوامل الخارجية • نتائج من الأسبوع الأول',
    benefitsEn: '24h deep hydration • Improved texture • Protection from external factors • Results from week one',
    colors: catId === 'cat4' ? ['#C89A8B', '#8B3A3A', '#D96C7B', '#5C4033'] : [],
    sizes: catId === 'cat1' || catId === 'cat5' ? ['100ml', '250ml', '400ml'] : [],
    variants: [],
    tags: ['أصلي', 'الأكثر مبيعاً'],
    rating,
    reviewsCount,
    isFeatured: flags.f,
    isBestSeller: flags.b,
    isNewArrival: flags.n,
    isActive: true,
    soldCount: Math.round(reviewsCount * 2.6),
    createdAt: daysAgo(ageDays * 3 + 1),
    updatedAt: daysAgo(1),
  };
});

export const mockBanners = [
  {
    _id: 'bn1',
    title: 'مجموعة الصيف الجديدة',
    titleEn: 'The New Summer Collection',
    subtitle: 'اكتشفي أحدث منتجات العناية بالبشرة بخصم يصل إلى 40%',
    subtitleEn: 'Discover the latest skincare with up to 40% off',
    image: 'https://picsum.photos/seed/hero-summer/1600/800',
    link: '/shop?sort=newest',
    buttonText: 'تسوّقي الآن',
    buttonTextEn: 'Shop now',
    position: 'hero',
    order: 1,
    isActive: true,
  },
  {
    _id: 'bn2',
    title: 'عناية فاخرة بالشعر',
    titleEn: 'Luxury Hair Care',
    subtitle: 'زيوت وماسكات طبيعية تعيد الحياة لشعرك',
    subtitleEn: 'Natural oils and masks that bring hair back to life',
    image: 'https://picsum.photos/seed/hero-hair/1600/800',
    link: '/shop?category=hair-creams-oils',
    buttonText: 'اكتشفي المجموعة',
    buttonTextEn: 'Explore collection',
    position: 'hero',
    order: 2,
    isActive: true,
  },
  {
    _id: 'bn3',
    title: 'مكياج يدوم طوال اليوم',
    titleEn: 'Makeup That Lasts All Day',
    subtitle: 'ماركات عالمية أصلية بأسعار لا تُقاوم',
    subtitleEn: 'Authentic global brands at irresistible prices',
    image: 'https://picsum.photos/seed/hero-makeup/1600/800',
    link: '/shop?category=makeup',
    buttonText: 'تسوّقي المكياج',
    buttonTextEn: 'Shop makeup',
    position: 'hero',
    order: 3,
    isActive: true,
  },
  {
    _id: 'bn4',
    title: 'خصم 25% على العطور',
    titleEn: '25% Off Fragrances',
    subtitle: 'لفترة محدودة',
    subtitleEn: 'For a limited time',
    image: 'https://picsum.photos/seed/promo-perfume/900/500',
    link: '/shop?category=fragrances-body',
    buttonText: 'اطلبي الآن',
    buttonTextEn: 'Order now',
    position: 'featured',
    order: 1,
    isActive: true,
  },
  {
    _id: 'bn5',
    title: 'روتين البشرة الكامل',
    titleEn: 'Complete Skincare Routine',
    subtitle: 'وفّري حتى 200 ج.م',
    subtitleEn: 'Save up to 200 EGP',
    image: 'https://picsum.photos/seed/promo-skin/900/500',
    link: '/shop?category=skincare',
    buttonText: 'اكتشفي',
    buttonTextEn: 'Discover',
    position: 'featured',
    order: 2,
    isActive: true,
  },
];

export const mockTestimonials = [
  {
    _id: 't1',
    name: 'منى عبد الرحمن',
    nameEn: 'Mona Abdelrahman',
    city: 'القاهرة',
    cityEn: 'Cairo',
    avatar: img('avatar-mona', 200, 200),
    rating: 5,
    text: 'تجربة شراء ممتازة! المنتجات أصلية ووصلت في يومين بس. سيروم فيتامين سي غيّر بشرتي تماماً.',
    textEn: 'Excellent shopping experience! Products are authentic and arrived in just two days. The vitamin C serum completely transformed my skin.',
  },
  {
    _id: 't2',
    name: 'سارة الشناوي',
    nameEn: 'Sara El Shenawy',
    city: 'الإسكندرية',
    cityEn: 'Alexandria',
    avatar: img('avatar-sara', 200, 200),
    rating: 5,
    text: 'أفضل متجر تعاملت معاه للمكياج. الأسعار أرخص من المحلات والتغليف كان راقي جداً.',
    textEn: 'The best makeup store I have dealt with. Prices are better than physical shops and the packaging was so elegant.',
  },
  {
    _id: 't3',
    name: 'نورهان محمود',
    nameEn: 'Nourhan Mahmoud',
    city: 'الجيزة',
    cityEn: 'Giza',
    avatar: img('avatar-nourhan', 200, 200),
    rating: 4,
    text: 'خدمة العملاء سريعة ومحترمة، ساعدوني أختار المنتج المناسب لنوع بشرتي. هطلب تاني أكيد.',
    textEn: 'Customer service is fast and respectful, they helped me pick the right product for my skin type. Ordering again for sure.',
  },
  {
    _id: 't4',
    name: 'هبة كمال',
    nameEn: 'Heba Kamal',
    city: 'المنصورة',
    cityEn: 'Mansoura',
    avatar: img('avatar-heba', 200, 200),
    rating: 5,
    text: 'زيت الأرجان المغربي رهيب! شعري بقى ناعم من أول استخدام. والشحن للمنصورة كان سريع.',
    textEn: 'The Moroccan argan oil is amazing! My hair became soft from the first use. Shipping to Mansoura was fast too.',
  },
  {
    _id: 't5',
    name: 'دينا فؤاد',
    nameEn: 'Dina Fouad',
    city: 'طنطا',
    cityEn: 'Tanta',
    avatar: img('avatar-dina', 200, 200),
    rating: 5,
    text: 'بطلب من الزينة من سنة تقريباً، مفيش مرة اتأخر طلب أو وصل غلط. ثقة كاملة.',
    textEn: "I've been ordering from Al Zeina for about a year, never a late or wrong order. Complete trust.",
  },
];

export const mockInstagram = Array.from({ length: 8 }, (_, i) => ({
  _id: `ig${i + 1}`,
  image: img(`instagram-${i + 1}`, 500, 500),
  link: 'https://instagram.com',
  likes: 240 + i * 37,
}));

export const mockReviews = [
  {
    _id: 'r1',
    product: 'p13',
    user: { _id: 'u2', name: 'منى عبد الرحمن', avatar: img('avatar-mona', 100, 100) },
    rating: 5,
    title: 'أفضل سيروم جربته',
    comment: 'استخدمته لمدة شهر والفرق واضح جداً في توحيد لون البشرة وإخفاء آثار الحبوب.',
    createdAt: daysAgo(4),
    isActive: true,
  },
  {
    _id: 'r2',
    product: 'p13',
    user: { _id: 'u3', name: 'سارة الشناوي', avatar: img('avatar-sara', 100, 100) },
    rating: 4,
    title: 'ممتاز لكن الرائحة قوية',
    comment: 'النتيجة رائعة بس الرائحة محتاجة تعوّد شوية. عموماً أنصح بيه.',
    createdAt: daysAgo(9),
    isActive: true,
  },
  {
    _id: 'r3',
    product: 'p19',
    user: { _id: 'u4', name: 'نورهان محمود', avatar: img('avatar-nourhan', 100, 100) },
    rating: 5,
    title: 'ماسكارا خيالية',
    comment: 'بتدي كثافة وطول من غير ما تتكتل. بتفضل طول اليوم من غير ما تنزل.',
    createdAt: daysAgo(2),
    isActive: true,
  },
  {
    _id: 'r4',
    product: 'p6',
    user: { _id: 'u5', name: 'هبة كمال', avatar: img('avatar-heba', 100, 100) },
    rating: 5,
    title: 'زيت رائع للشعر الجاف',
    comment: 'شعري كان تالف جداً من الصبغة، بقى أحسن بكتير بعد شهر استخدام.',
    createdAt: daysAgo(15),
    isActive: true,
  },
];

export const mockUsers = [
  {
    // بيانات عرض فقط لجداول لوحة التحكم — ليست حساباً ولا يمكن الدخول بها
    _id: 'u1',
    name: 'عميل تجريبي',
    nameEn: 'Sample Customer',
    email: 'customer1@example.invalid',
    phone: '+200000000000',
    role: 'user',
    isActive: true,
    avatar: img('avatar-admin', 200, 200),
    createdAt: daysAgo(400),
    ordersCount: 0,
    totalSpent: 0,
  },
  {
    _id: 'u2',
    name: 'منى عبد الرحمن',
    email: 'customer2@example.invalid',
    phone: '+201112223334',
    role: 'user',
    isActive: true,
    avatar: img('avatar-mona', 200, 200),
    createdAt: daysAgo(180),
    ordersCount: 7,
    totalSpent: 4380,
  },
  {
    _id: 'u3',
    name: 'سارة الشناوي',
    email: 'sara@example.invalid',
    phone: '+201223334445',
    role: 'user',
    isActive: true,
    avatar: img('avatar-sara', 200, 200),
    createdAt: daysAgo(120),
    ordersCount: 4,
    totalSpent: 2150,
  },
  {
    _id: 'u4',
    name: 'نورهان محمود',
    email: 'nourhan@example.invalid',
    phone: '+201556667778',
    role: 'user',
    isActive: true,
    avatar: img('avatar-nourhan', 200, 200),
    createdAt: daysAgo(75),
    ordersCount: 3,
    totalSpent: 1690,
  },
  {
    _id: 'u5',
    name: 'هبة كمال',
    email: 'heba@example.invalid',
    phone: '+201009998887',
    role: 'user',
    isActive: true,
    avatar: img('avatar-heba', 200, 200),
    createdAt: daysAgo(40),
    ordersCount: 2,
    totalSpent: 890,
  },
  {
    _id: 'u6',
    name: 'دينا فؤاد',
    email: 'dina@example.invalid',
    phone: '+201115556667',
    role: 'user',
    isActive: false,
    avatar: img('avatar-dina', 200, 200),
    createdAt: daysAgo(20),
    ordersCount: 1,
    totalSpent: 320,
  },
];

export const mockCoupons = [
  {
    _id: 'c1',
    code: 'ZEINA10',
    description: 'خصم 10% على أول طلب',
    discountType: 'percentage',
    discountValue: 10,
    minOrderAmount: 300,
    maxDiscount: 150,
    startDate: daysAgo(30),
    endDate: new Date(Date.now() + 60 * 86400000).toISOString(),
    usageLimit: 1000,
    usedCount: 342,
    perUserLimit: 1,
    isActive: true,
  },
  {
    _id: 'c2',
    code: 'SUMMER25',
    description: 'خصم 25% على مجموعة الصيف',
    discountType: 'percentage',
    discountValue: 25,
    minOrderAmount: 700,
    maxDiscount: 300,
    startDate: daysAgo(10),
    endDate: new Date(Date.now() + 20 * 86400000).toISOString(),
    usageLimit: 500,
    usedCount: 128,
    perUserLimit: 1,
    isActive: true,
  },
  {
    _id: 'c3',
    code: 'FREESHIP',
    description: 'شحن مجاني لأي طلب',
    discountType: 'fixed',
    discountValue: 50,
    minOrderAmount: 200,
    startDate: daysAgo(60),
    endDate: new Date(Date.now() + 90 * 86400000).toISOString(),
    usageLimit: 2000,
    usedCount: 876,
    perUserLimit: 3,
    isActive: true,
  },
  {
    _id: 'c4',
    code: 'WELCOME50',
    description: 'خصم 50 جنيه للعملاء الجدد',
    discountType: 'fixed',
    discountValue: 50,
    minOrderAmount: 250,
    startDate: daysAgo(90),
    endDate: daysAgo(5),
    usageLimit: 300,
    usedCount: 300,
    perUserLimit: 1,
    isActive: false,
  },
];

const buildOrder = (i, userId, status, itemsSpec, ago) => {
  const items = itemsSpec.map(([pid, qty]) => {
    const p = mockProducts.find((x) => x._id === pid);
    return {
      _id: `oi${i}-${pid}`,
      product: { _id: p._id, name: p.name, nameEn: p.nameEn, slug: p.slug, mainImage: p.mainImage },
      name: p.name,
      price: p.price,
      quantity: qty,
      total: p.price * qty,
    };
  });
  const subtotal = items.reduce((s, it) => s + it.total, 0);
  const shippingCost = subtotal >= 500 ? 0 : 50;
  const user = mockUsers.find((u) => u._id === userId);
  return {
    _id: `o${i}`,
    orderNumber: `ORD-2026${String(1000 + i)}`,
    user: { _id: user._id, name: user.name, email: user.email, phone: user.phone },
    items,
    subtotal,
    discount: 0,
    couponDiscount: 0,
    shippingCost,
    tax: 0,
    total: subtotal + shippingCost,
    paymentMethod: i % 3 === 0 ? 'card' : 'cod',
    paymentStatus: status === 'delivered' ? 'paid' : i % 3 === 0 ? 'paid' : 'pending',
    orderStatus: status,
    shippingAddress: {
      governorate: 'القاهرة',
      city: 'مدينة نصر',
      district: 'الحي السابع',
      street: `${10 + i} شارع مصطفى النحاس`,
      buildingNumber: String(5 + i),
      floor: String(2 + (i % 5)),
      apartment: String(3 + (i % 8)),
      phone: user.phone,
    },
    trackingNumber: ['shipped', 'delivered'].includes(status) ? `EG${900000 + i * 137}` : undefined,
    createdAt: daysAgo(ago),
    updatedAt: daysAgo(Math.max(0, ago - 2)),
  };
};

export const mockOrders = [
  buildOrder(1, 'u2', 'delivered', [['p13', 1], ['p11', 2]], 22),
  buildOrder(2, 'u3', 'shipped', [['p19', 1], ['p20', 2], ['p21', 1]], 5),
  buildOrder(3, 'u2', 'processing', [['p6', 1]], 3),
  buildOrder(4, 'u4', 'pending', [['p27', 1], ['p31', 1]], 1),
  buildOrder(5, 'u5', 'delivered', [['p1', 2], ['p2', 1]], 34),
  buildOrder(6, 'u3', 'cancelled', [['p24', 1]], 18),
  buildOrder(7, 'u2', 'delivered', [['p15', 1], ['p17', 1]], 48),
  buildOrder(8, 'u6', 'confirmed', [['p33', 3]], 2),
  buildOrder(9, 'u4', 'delivered', [['p14', 1], ['p12', 1], ['p16', 1]], 60),
  buildOrder(10, 'u5', 'shipped', [['p28', 2]], 4),
  buildOrder(11, 'u2', 'delivered', [['p22', 1], ['p23', 2]], 71),
  buildOrder(12, 'u3', 'delivered', [['p7', 1], ['p10', 1]], 90),
];

export const mockMessages = [
  {
    _id: 'm1',
    name: 'أحمد سمير',
    email: 'ahmed@example.invalid',
    phone: '+201234567890',
    subject: 'استفسار عن توفر منتج',
    message: 'هل سيرم فيتامين سي متوفر بحجم 60 مل؟ وهل يوجد خصم على الكميات؟',
    isRead: false,
    createdAt: daysAgo(1),
  },
  {
    _id: 'm2',
    name: 'مريم حسن',
    email: 'mariam@example.invalid',
    phone: '+201098765432',
    subject: 'مشكلة في الطلب',
    message: 'طلبي رقم ORD-20261005 وصل ناقص منتج. برجاء المتابعة.',
    isRead: false,
    createdAt: daysAgo(2),
  },
  {
    _id: 'm3',
    name: 'ليلى عادل',
    email: 'laila@example.invalid',
    phone: '+201555444333',
    subject: 'شكر وتقدير',
    message: 'شكراً على الخدمة الممتازة والتغليف الجميل. تجربة رائعة فعلاً!',
    isRead: true,
    createdAt: daysAgo(6),
  },
  {
    _id: 'm4',
    name: 'رنا مصطفى',
    email: 'rana@example.invalid',
    phone: '+201777888999',
    subject: 'طلب تعاون',
    message: 'أنا مؤثرة على إنستجرام ومهتمة بالتعاون مع متجركم. برجاء التواصل.',
    isRead: true,
    createdAt: daysAgo(11),
  },
];

export const mockSettings = {
  siteName: 'Al Zeina',
  siteNameAr: 'الزينة',
  logo: '',
  tagline: 'جمالك يبدأ من هنا',
  email: 'info@alzeina.com',
  phone: '+20 100 123 4567',
  whatsapp: '+201001234567',
  address: 'القاهرة، مصر',
  social: {
    facebook: 'https://facebook.com',
    instagram: 'https://instagram.com',
    twitter: 'https://twitter.com',
    tiktok: 'https://tiktok.com',
    youtube: 'https://youtube.com',
  },
  shipping: {
    defaultCost: 50,
    freeThreshold: 500,
    estimatedDays: '2-5',
  },
  payment: {
    cod: true,
    card: true,
    wallet: true,
  },
  seo: {
    metaTitle: 'Al Zeina | متجر الجمال والعناية',
    metaDescription: 'منتجات تجميل وعناية أصلية 100% بأفضل الأسعار في مصر',
    keywords: 'مكياج، عناية بالبشرة، عطور، شامبو، الزينة',
  },
};

/** إحصائيات لوحة الإدارة */
export const mockDashboard = () => {
  const totalSales = mockOrders
    .filter((o) => o.orderStatus !== 'cancelled')
    .reduce((s, o) => s + o.total, 0);
  const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    return {
      label: monthNames[d.getMonth()],
      labelEn: monthNamesEn[d.getMonth()],
      sales: Math.round(18000 + Math.sin(i / 1.7) * 9000 + i * 1400 + (i % 3) * 2200),
      orders: Math.round(60 + Math.cos(i / 2) * 22 + i * 4),
    };
  });
  const statusCounts = mockOrders.reduce((acc, o) => {
    acc[o.orderStatus] = (acc[o.orderStatus] || 0) + 1;
    return acc;
  }, {});
  const revenueByCategory = mockCategories.map((c) => ({
    name: c.name,
    nameEn: c.nameEn,
    value: mockProducts
      .filter((p) => p.category._id === c._id)
      .reduce((s, p) => s + p.price * (p.soldCount || 0) * 0.1, 0),
  }));
  return {
    stats: {
      totalSales: Math.round(totalSales),
      totalOrders: mockOrders.length,
      totalProducts: mockProducts.length,
      totalCustomers: mockUsers.filter((u) => u.role === 'user').length,
      salesGrowth: 12.4,
      ordersGrowth: 8.1,
      productsGrowth: 4.6,
      customersGrowth: 15.2,
    },
    monthly,
    statusCounts,
    revenueByCategory,
    recentOrders: mockOrders.slice(0, 6),
    topProducts: [...mockProducts].sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0)).slice(0, 6),
    lowStock: mockProducts.filter((p) => p.stock <= 5).slice(0, 8),
  };
};
