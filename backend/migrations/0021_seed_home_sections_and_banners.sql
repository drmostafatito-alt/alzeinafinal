-- Idempotent seed for default banners and default home sections.
-- Preserves existing DB content: INSERT ... WHERE NOT EXISTS ensures no overwrites or duplicates.

INSERT INTO banners (id, title, titleEn, subtitle, subtitleEn, image, link, buttonText, buttonTextEn, position, sortOrder, isActive, createdAt, updatedAt)
SELECT 'bn1', 'مجموعة الصيف الجديدة', 'The New Summer Collection', 'اكتشفي أحدث منتجات العناية بالبشرة بخصم يصل إلى 40%', 'Discover the latest skincare with up to 40% off', 'https://picsum.photos/seed/hero-summer/1600/800', '/shop?sort=newest', 'تسوّقي الآن', 'Shop now', 'hero', 1, 1, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM banners WHERE id = 'bn1');

INSERT INTO banners (id, title, titleEn, subtitle, subtitleEn, image, link, buttonText, buttonTextEn, position, sortOrder, isActive, createdAt, updatedAt)
SELECT 'bn2', 'عناية فاخرة بالشعر', 'Luxury Hair Care', 'زيوت وماسكات طبيعية تعيد الحياة لشعرك', 'Natural oils and masks that bring hair back to life', 'https://picsum.photos/seed/hero-hair/1600/800', '/shop?category=hair-creams-oils', 'اكتشفي المجموعة', 'Explore collection', 'hero', 2, 1, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM banners WHERE id = 'bn2');

INSERT INTO banners (id, title, titleEn, subtitle, subtitleEn, image, link, buttonText, buttonTextEn, position, sortOrder, isActive, createdAt, updatedAt)
SELECT 'bn3', 'مكياج يدوم طوال اليوم', 'Makeup That Lasts All Day', 'ماركات عالمية أصلية بأسعار لا تُقاوم', 'Authentic global brands at irresistible prices', 'https://picsum.photos/seed/hero-makeup/1600/800', '/shop?category=makeup', 'تسوّقي المكياج', 'Shop makeup', 'hero', 3, 1, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM banners WHERE id = 'bn3');

INSERT INTO banners (id, title, titleEn, subtitle, subtitleEn, image, link, buttonText, buttonTextEn, position, sortOrder, isActive, createdAt, updatedAt)
SELECT 'bn4', 'خصم 25% على العطور', '25% Off Fragrances', 'لفترة محدودة', 'For a limited time', 'https://picsum.photos/seed/promo-perfume/900/500', '/shop?category=fragrances-body', 'اطلبي الآن', 'Order now', 'featured', 1, 1, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM banners WHERE id = 'bn4');

INSERT INTO banners (id, title, titleEn, subtitle, subtitleEn, image, link, buttonText, buttonTextEn, position, sortOrder, isActive, createdAt, updatedAt)
SELECT 'bn5', 'روتين البشرة الكامل', 'Complete Skincare Routine', 'وفّري حتى 200 ج.م', 'Save up to 200 EGP', 'https://picsum.photos/seed/promo-skin/900/500', '/shop?category=skincare', 'اكتشفي', 'Discover', 'featured', 2, 1, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM banners WHERE id = 'bn5');

-- Default Home Sections
INSERT INTO home_sections (id, type, title, titleEn, data, isActive, sortOrder, createdAt, updatedAt)
SELECT 'sec-hero', 'hero', 'البطل', 'Hero', '{"key":"hero","status":"published"}', 1, 1, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM home_sections WHERE id = 'sec-hero');

INSERT INTO home_sections (id, type, title, titleEn, data, isActive, sortOrder, createdAt, updatedAt)
SELECT 'sec-features', 'features', 'مميزات المتجر', 'Store Features', '{"key":"features","status":"published"}', 1, 2, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM home_sections WHERE id = 'sec-features');

INSERT INTO home_sections (id, type, title, titleEn, data, isActive, sortOrder, createdAt, updatedAt)
SELECT 'sec-categories', 'categories', 'تسوقي حسب القسم', 'Shop by Category', '{"key":"categories","status":"published"}', 1, 3, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM home_sections WHERE id = 'sec-categories');

INSERT INTO home_sections (id, type, title, titleEn, data, isActive, sortOrder, createdAt, updatedAt)
SELECT 'sec-featured', 'products', 'منتجات مختارة', 'Featured Products', '{"key":"featured","source":"featured","limit":10,"layout":"carousel","viewAllLink":"/shop?featured=true","status":"published"}', 1, 4, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM home_sections WHERE id = 'sec-featured');

INSERT INTO home_sections (id, type, title, titleEn, data, isActive, sortOrder, createdAt, updatedAt)
SELECT 'sec-offers', 'offers', 'عروض خاصة', 'Special Offers', '{"key":"offers","status":"published"}', 1, 5, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM home_sections WHERE id = 'sec-offers');

INSERT INTO home_sections (id, type, title, titleEn, data, isActive, sortOrder, createdAt, updatedAt)
SELECT 'sec-bestSellers', 'products', 'الأكثر مبيعاً', 'Best Sellers', '{"key":"bestSellers","source":"bestSellers","limit":10,"layout":"grid","viewAllLink":"/shop?sort=bestSeller","status":"published"}', 1, 6, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM home_sections WHERE id = 'sec-bestSellers');

INSERT INTO home_sections (id, type, title, titleEn, data, isActive, sortOrder, createdAt, updatedAt)
SELECT 'sec-newArrivals', 'products', 'وصل حديثاً', 'New Arrivals', '{"key":"newArrivals","source":"newArrivals","limit":10,"layout":"grid","viewAllLink":"/shop?sort=newest","status":"published"}', 1, 7, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM home_sections WHERE id = 'sec-newArrivals');

INSERT INTO home_sections (id, type, title, titleEn, data, isActive, sortOrder, createdAt, updatedAt)
SELECT 'sec-brands', 'brands', 'ماركاتنا العالمية', 'Our Brands', '{"key":"brands","status":"published"}', 1, 8, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM home_sections WHERE id = 'sec-brands');

INSERT INTO home_sections (id, type, title, titleEn, data, isActive, sortOrder, createdAt, updatedAt)
SELECT 'sec-testimonials', 'testimonials', 'آراء عميلاتنا', 'Testimonials', '{"key":"testimonials","status":"published"}', 1, 9, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM home_sections WHERE id = 'sec-testimonials');

INSERT INTO home_sections (id, type, title, titleEn, data, isActive, sortOrder, createdAt, updatedAt)
SELECT 'sec-newsletter', 'newsletter', 'النشرة البريدية', 'Newsletter', '{"key":"newsletter","status":"published"}', 1, 10, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM home_sections WHERE id = 'sec-newsletter');
