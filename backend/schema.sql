-- AL-ZEINA Cloudflare D1 schema
-- String UUIDs are used for portability. JSON columns preserve the previous API contract.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  firstName TEXT,
  lastName TEXT,
  email TEXT UNIQUE NOT NULL COLLATE NOCASE,
  passwordHash TEXT,
  googleId TEXT,
  facebookId TEXT,
  authProvider TEXT NOT NULL DEFAULT 'local',
  phone TEXT,
  gender TEXT NOT NULL DEFAULT 'female',
  role TEXT NOT NULL DEFAULT 'user',
  staffRole TEXT NOT NULL DEFAULT '',
  isActive INTEGER NOT NULL DEFAULT 1,
  avatar TEXT NOT NULL DEFAULT '',
  resetPasswordToken TEXT,
  resetPasswordExpires TEXT,
  sessionsValidFrom TEXT NOT NULL,
  lastActivityAt TEXT NOT NULL,
  lastLogin TEXT,
  failedLoginAttempts INTEGER NOT NULL DEFAULT 0,
  lockedUntil TEXT,
  adminNotes TEXT NOT NULL DEFAULT '[]',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS addresses (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT, governorate TEXT, city TEXT, district TEXT, street TEXT,
  buildingNumber TEXT, floor TEXT, apartment TEXT, landmark TEXT, phone TEXT,
  isDefault INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(userId);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, nameEn TEXT, slug TEXT UNIQUE NOT NULL,
  image TEXT, description TEXT, descriptionEn TEXT, parent TEXT,
  metaTitle TEXT, metaDescription TEXT, keywords TEXT NOT NULL DEFAULT '[]',
  isActive INTEGER NOT NULL DEFAULT 1, sortOrder INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent);

CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, nameEn TEXT, slug TEXT UNIQUE NOT NULL,
  logo TEXT, description TEXT, descriptionEn TEXT,
  metaTitle TEXT, metaDescription TEXT, keywords TEXT NOT NULL DEFAULT '[]',
  isActive INTEGER NOT NULL DEFAULT 1, sortOrder INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL, nameEn TEXT, slug TEXT UNIQUE NOT NULL, sku TEXT UNIQUE,
  description TEXT, descriptionEn TEXT, ingredients TEXT, howToUse TEXT,
  category TEXT REFERENCES categories(id) ON DELETE SET NULL,
  brand TEXT REFERENCES brands(id) ON DELETE SET NULL,
  price REAL NOT NULL DEFAULT 0, oldPrice REAL, cost REAL NOT NULL DEFAULT 0, discount INTEGER NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0, trackInventory INTEGER NOT NULL DEFAULT 1,
  mainImage TEXT, images TEXT NOT NULL DEFAULT '[]',
  variants TEXT NOT NULL DEFAULT '[]', colors TEXT NOT NULL DEFAULT '[]', sizes TEXT NOT NULL DEFAULT '[]', tags TEXT NOT NULL DEFAULT '[]',
  rating REAL NOT NULL DEFAULT 0, reviewsCount INTEGER NOT NULL DEFAULT 0, soldCount INTEGER NOT NULL DEFAULT 0,
  isFeatured INTEGER NOT NULL DEFAULT 0, isBestSeller INTEGER NOT NULL DEFAULT 0, isNewArrival INTEGER NOT NULL DEFAULT 0,
  isActive INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'published', publishAt TEXT,
  metaTitle TEXT, metaDescription TEXT, metaKeywords TEXT NOT NULL DEFAULT '[]',
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_active_created ON products(isActive, createdAt);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(isActive, category, price);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(isActive, brand);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(isActive, isFeatured);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock);

CREATE TABLE IF NOT EXISTS coupons (
  id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, description TEXT,
  discountType TEXT NOT NULL, discountValue REAL NOT NULL DEFAULT 0, freeShipping INTEGER NOT NULL DEFAULT 0,
  minOrderAmount REAL NOT NULL DEFAULT 0, maxDiscount REAL,
  startDate TEXT NOT NULL, endDate TEXT NOT NULL,
  usageLimit INTEGER NOT NULL DEFAULT 1, usedCount INTEGER NOT NULL DEFAULT 0, perUserLimit INTEGER NOT NULL DEFAULT 1,
  userIds TEXT NOT NULL DEFAULT '[]', categories TEXT NOT NULL DEFAULT '[]', brands TEXT NOT NULL DEFAULT '[]',
  products TEXT NOT NULL DEFAULT '[]', excludedProducts TEXT NOT NULL DEFAULT '[]',
  isActive INTEGER NOT NULL DEFAULT 1, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS banners (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, titleEn TEXT NOT NULL DEFAULT '',
  subtitle TEXT NOT NULL DEFAULT '', subtitleEn TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL, link TEXT, buttonText TEXT NOT NULL DEFAULT '', buttonTextEn TEXT NOT NULL DEFAULT '',
  position TEXT NOT NULL DEFAULT 'hero', sortOrder INTEGER NOT NULL DEFAULT 0, isActive INTEGER NOT NULL DEFAULT 1,
  startDate TEXT, endDate TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, nameEn TEXT,
  description TEXT, instructions TEXT, logo TEXT, type TEXT NOT NULL DEFAULT 'manual',
  isActive INTEGER NOT NULL DEFAULT 1, isVisible INTEGER NOT NULL DEFAULT 1,
  requiresProof INTEGER NOT NULL DEFAULT 0, requiresReference INTEGER NOT NULL DEFAULT 0,
  feeType TEXT NOT NULL DEFAULT 'fixed', feeValue REAL NOT NULL DEFAULT 0,
  sortOrder INTEGER NOT NULL DEFAULT 0, config TEXT NOT NULL DEFAULT '{}',
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS governorates (
  id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, nameEn TEXT,
  isActive INTEGER NOT NULL DEFAULT 1, sortOrder INTEGER NOT NULL DEFAULT 0, shippingCost REAL NOT NULL DEFAULT 50, codEnabled INTEGER NOT NULL DEFAULT 1, zoneId TEXT REFERENCES shipping_zones(id) ON DELETE SET NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shipping_zones (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, nameEn TEXT, governorateIds TEXT NOT NULL DEFAULT '[]',
  cost REAL NOT NULL DEFAULT 0, freeThreshold REAL, estimatedDaysMin INTEGER, estimatedDaysMax INTEGER,
  isActive INTEGER NOT NULL DEFAULT 1, sortOrder INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shipping_companies (
  id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, nameEn TEXT,
  trackingUrl TEXT, isActive INTEGER NOT NULL DEFAULT 1, sortOrder INTEGER NOT NULL DEFAULT 0,
  config TEXT NOT NULL DEFAULT '{}', createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, orderNumber TEXT UNIQUE, userId TEXT REFERENCES users(id) ON DELETE SET NULL,
  guestEmail TEXT, guestPhone TEXT, shippingAddress TEXT NOT NULL,
  subtotal REAL NOT NULL, discount REAL NOT NULL DEFAULT 0, couponId TEXT, couponDiscount REAL NOT NULL DEFAULT 0,
  shippingCost REAL NOT NULL DEFAULT 0, paymentFee REAL NOT NULL DEFAULT 0, tax REAL NOT NULL DEFAULT 0, total REAL NOT NULL,
  paymentMethod TEXT NOT NULL, paymentMethodRef TEXT, paymentStatus TEXT NOT NULL DEFAULT 'pending', orderStatus TEXT NOT NULL DEFAULT 'pending',
  notes TEXT, trackingNumber TEXT, shippingCompany TEXT, governorate TEXT,
  paymentReference TEXT, paymentProof TEXT, paymentVerification TEXT NOT NULL DEFAULT '{"state":"none","history":[]}',
  financialSnapshot TEXT NOT NULL DEFAULT '{}', statusHistory TEXT NOT NULL DEFAULT '[]',
  activity TEXT NOT NULL DEFAULT '[]', adminNotes TEXT NOT NULL DEFAULT '[]',
  estimatedDeliveryFrom TEXT, estimatedDeliveryTo TEXT,
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(userId);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(orderStatus, paymentStatus);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(createdAt);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY, orderId TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  productId TEXT REFERENCES products(id) ON DELETE SET NULL, variant TEXT, name TEXT NOT NULL, sku TEXT,
  quantity INTEGER NOT NULL, price REAL NOT NULL, oldPrice REAL, discount REAL, total REAL NOT NULL, image TEXT,
  cost REAL NOT NULL DEFAULT 0, currency TEXT, currencySymbol TEXT, categoryName TEXT, brandName TEXT,
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(orderId);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY, productId TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE, userId TEXT REFERENCES users(id) ON DELETE SET NULL,
  userName TEXT, rating INTEGER NOT NULL, title TEXT, comment TEXT, images TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending', isActive INTEGER NOT NULL DEFAULT 1, reply TEXT, repliedAt TEXT,
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(productId, status);

CREATE TABLE IF NOT EXISTS wishlist (userId TEXT NOT NULL, productId TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE, createdAt TEXT NOT NULL, PRIMARY KEY(userId, productId));
CREATE TABLE IF NOT EXISTS carts (id TEXT PRIMARY KEY, userId TEXT UNIQUE, items TEXT NOT NULL DEFAULT '[]', coupon TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS return_requests (
  id TEXT PRIMARY KEY, orderId TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE, userId TEXT REFERENCES users(id) ON DELETE SET NULL,
  reasonId TEXT, reason TEXT, items TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'pending',
  refundMethod TEXT, refundAmount REAL NOT NULL DEFAULT 0, note TEXT, pickupAddress TEXT, pickupDate TEXT,
  images TEXT NOT NULL DEFAULT '[]', notes TEXT NOT NULL DEFAULT '[]', creditNote TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS return_reasons (id TEXT PRIMARY KEY, name TEXT NOT NULL, nameEn TEXT, isActive INTEGER NOT NULL DEFAULT 1, sortOrder INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY, userId TEXT REFERENCES users(id) ON DELETE SET NULL, guestName TEXT, guestEmail TEXT,
  subject TEXT NOT NULL, category TEXT, priority TEXT NOT NULL DEFAULT 'normal', status TEXT NOT NULL DEFAULT 'open',
  orderId TEXT, messages TEXT NOT NULL DEFAULT '[]', notes TEXT NOT NULL DEFAULT '[]', staffAssignee TEXT,
  lastReplyAt TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
, assignedTo TEXT REFERENCES users(id) ON DELETE SET NULL);

CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, name TEXT, email TEXT, phone TEXT, subject TEXT, message TEXT NOT NULL, isRead INTEGER NOT NULL DEFAULT 0, repliedAt TEXT, createdAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS subscribers (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, isActive INTEGER NOT NULL DEFAULT 1, source TEXT, createdAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, userId TEXT, type TEXT NOT NULL, title TEXT NOT NULL, body TEXT, link TEXT, refModel TEXT, refId TEXT, priority TEXT NOT NULL DEFAULT 'normal', isRead INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL DEFAULT '{}', createdAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, url TEXT NOT NULL, thumbnailUrl TEXT, filename TEXT NOT NULL, originalName TEXT, mimeType TEXT, size INTEGER NOT NULL DEFAULT 0, folder TEXT NOT NULL DEFAULT 'misc', title TEXT, alt TEXT, userId TEXT, width INTEGER, height INTEGER, usage TEXT NOT NULL DEFAULT '[]', createdAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, userId TEXT, userName TEXT, userEmail TEXT, userRole TEXT, action TEXT NOT NULL, entity TEXT NOT NULL, entityId TEXT, label TEXT, changes TEXT, method TEXT, path TEXT, status INTEGER, ip TEXT, userAgent TEXT, success INTEGER NOT NULL DEFAULT 1, message TEXT, createdAt TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, createdAt);
CREATE TABLE IF NOT EXISTS error_logs (id TEXT PRIMARY KEY, message TEXT NOT NULL, stack TEXT, type TEXT, severity TEXT, source TEXT, url TEXT, method TEXT, statusCode INTEGER, count INTEGER NOT NULL DEFAULT 1, firstSeenAt TEXT NOT NULL, lastSeenAt TEXT NOT NULL, resolved INTEGER NOT NULL DEFAULT 0, resolvedAt TEXT, data TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS stock_movements (id TEXT PRIMARY KEY, productId TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE, userId TEXT, type TEXT NOT NULL, quantity INTEGER NOT NULL, beforeStock INTEGER, afterStock INTEGER, reason TEXT, referenceType TEXT, referenceId TEXT, createdAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS product_views (id TEXT PRIMARY KEY, productId TEXT NOT NULL, userId TEXT, sessionId TEXT, ip TEXT, userAgent TEXT, createdAt TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, groupName TEXT NOT NULL DEFAULT 'general', updatedAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS pages (id TEXT PRIMARY KEY, title TEXT NOT NULL, titleEn TEXT, slug TEXT UNIQUE NOT NULL, content TEXT, contentEn TEXT, status TEXT NOT NULL DEFAULT 'published', isActive INTEGER NOT NULL DEFAULT 1, metaTitle TEXT, metaDescription TEXT, sortOrder INTEGER NOT NULL DEFAULT 0, showInFooter INTEGER NOT NULL DEFAULT 1, data TEXT NOT NULL DEFAULT '{}', createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS home_sections (id TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT, titleEn TEXT, data TEXT NOT NULL DEFAULT '{}', isActive INTEGER NOT NULL DEFAULT 1, sortOrder INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS popups (id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT, image TEXT, link TEXT, startDate TEXT, endDate TEXT, isActive INTEGER NOT NULL DEFAULT 1, sortOrder INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL DEFAULT '{}', createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS flash_sales (id TEXT PRIMARY KEY, name TEXT NOT NULL, nameEn TEXT, startsAt TEXT, endsAt TEXT, isActive INTEGER NOT NULL DEFAULT 1, products TEXT NOT NULL DEFAULT '[]', data TEXT NOT NULL DEFAULT '{}', createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS testimonials (id TEXT PRIMARY KEY, name TEXT NOT NULL, nameEn TEXT, rating INTEGER NOT NULL DEFAULT 5, content TEXT, contentEn TEXT, avatar TEXT, isActive INTEGER NOT NULL DEFAULT 1, sortOrder INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS instagram_posts (id TEXT PRIMARY KEY, image TEXT NOT NULL, caption TEXT, link TEXT, isActive INTEGER NOT NULL DEFAULT 1, sortOrder INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS email_templates (id TEXT PRIMARY KEY, key TEXT UNIQUE NOT NULL, name TEXT NOT NULL, subject TEXT, body TEXT, isActive INTEGER NOT NULL DEFAULT 1, variables TEXT NOT NULL DEFAULT '[]', sortOrder INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
-- ملاحظة إصلاح: كان هذا الموضع يحوي كتلة migration منسوخة
-- (theme_presets_new ثم INSERT..SELECT ثم DROP/RENAME) تفشل على قاعدة
-- جديدة لأن theme_presets غير موجود بعد. schema.sql مرجع بنية فقط.
CREATE TABLE IF NOT EXISTS theme_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  nameEn TEXT,
  description TEXT,
  slug TEXT UNIQUE,
  theme TEXT NOT NULL,
  isActive INTEGER NOT NULL DEFAULT 0,
  sortOrder INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, name TEXT NOT NULL, intervalMs INTEGER NOT NULL DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 1, lastRunAt TEXT, lastDuration INTEGER, lastResult TEXT, lastError TEXT, runs INTEGER NOT NULL DEFAULT 0, failures INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS payment_verifications (
  id TEXT PRIMARY KEY,
  orderId TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  userId TEXT,
  paymentMethodId TEXT,
  paymentMethodCode TEXT,
  amount REAL NOT NULL DEFAULT 0,
  receiptKey TEXT,
  receiptMimeType TEXT,
  receiptSize INTEGER,
  receiptUrl TEXT,
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  customerNote TEXT,
  adminNote TEXT,
  reviewedAt TEXT,
  reviewedBy TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pv_order ON payment_verifications(orderId);
CREATE INDEX IF NOT EXISTS idx_pv_status ON payment_verifications(status, createdAt);
CREATE TABLE IF NOT EXISTS api_metrics (id TEXT PRIMARY KEY, method TEXT, path TEXT, status INTEGER, duration INTEGER, ip TEXT, createdAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, userId TEXT NOT NULL, tokenId TEXT, ip TEXT, userAgent TEXT, expiresAt TEXT, revoked INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL);

-- Production guard against overselling during concurrent order creation.
CREATE TRIGGER IF NOT EXISTS products_stock_nonnegative_update
BEFORE UPDATE OF stock ON products
FOR EACH ROW
WHEN NEW.stock < 0
BEGIN
  SELECT RAISE(ABORT, 'INSUFFICIENT_STOCK');
END;
CREATE TABLE IF NOT EXISTS coupon_users (
  couponId TEXT NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  orderId TEXT REFERENCES orders(id) ON DELETE SET NULL,
  createdAt TEXT NOT NULL,
  PRIMARY KEY (couponId, userId, orderId)
);
CREATE INDEX IF NOT EXISTS idx_coupon_users_coupon ON coupon_users(couponId);
CREATE INDEX IF NOT EXISTS idx_coupon_users_user ON coupon_users(userId);
-- assignedTo أصبح ضمن CREATE TABLE tickets أدناه (كان ALTER يفشل عند التكرار).
