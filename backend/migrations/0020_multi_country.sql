-- 0020_multi_country.sql
-- Multi-Country (Egypt + UAE) — Phase B (Database only).
--
-- Guarantees:
--   * ADDITIVE ONLY — no data is deleted, rewritten, or re-priced.
--   * products.price stays the exact Egypt price (no EGP→AED conversion anywhere).
--   * The existing 27 Egyptian governorates stay Egypt (new column defaults to 'EG').
--   * Payment methods are untouched structurally; country scope lives inside the
--     existing config JSON (json_set preserves every other stored key).
--   * Existing orders backfill to EG/EGP — correct because the store was Egypt-only.
--
-- Idempotency notes:
--   * CREATE TABLE/INDEX: IF NOT EXISTS. INSERTs: OR IGNORE. JSON updates: json_set (repeatable).
--   * ALTER TABLE ADD COLUMN has no IF NOT EXISTS in SQLite/D1 (same as 0007/0010/0015):
--     a second raw execution fails fast with "duplicate column name" — NON-destructive.
--     Wrangler's migrations tracking applies this file exactly once per database.

PRAGMA foreign_keys = ON;

-- ======================================================================
-- 1) countries — exactly two rows, ever: EG (default) + AE.
--    `shipping` JSON holds optional per-country overrides of settings.shipping
--    (defaultCost/freeShippingEnabled/freeShippingThreshold/estimatedDays*/codEnabled).
--    Empty object = inherit global settings (Egypt keeps today's behavior exactly).
-- ======================================================================
CREATE TABLE IF NOT EXISTS countries (
  code TEXT PRIMARY KEY,                 -- 'EG' | 'AE'
  name TEXT NOT NULL,
  nameEn TEXT NOT NULL,
  currency TEXT NOT NULL,                -- 'EGP' | 'AED'
  currencySymbol TEXT NOT NULL,          -- 'ج.م' | 'د.إ'
  currencySymbolEn TEXT NOT NULL,        -- 'EGP' | 'AED'
  currencyPosition TEXT NOT NULL DEFAULT 'after',
  shipping TEXT NOT NULL DEFAULT '{}',
  isActive INTEGER NOT NULL DEFAULT 1,
  isDefault INTEGER NOT NULL DEFAULT 0,
  sortOrder INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

INSERT OR IGNORE INTO countries
  (code, name, nameEn, currency, currencySymbol, currencySymbolEn, currencyPosition, shipping, isActive, isDefault, sortOrder, createdAt, updatedAt)
VALUES
  ('EG', 'مصر', 'Egypt', 'EGP', 'ج.م', 'EGP', 'after', '{}', 1, 1, 1, '2026-08-18T00:00:00.000Z', '2026-08-18T00:00:00.000Z'),
  ('AE', 'الإمارات', 'UAE', 'AED', 'د.إ', 'AED', 'before', '{}', 1, 0, 2, '2026-08-18T00:00:00.000Z', '2026-08-18T00:00:00.000Z');

-- ======================================================================
-- 2) governorates → country ownership.
--    The 27 existing rows become 'EG' automatically via the column default.
--    Then seed the 7 UAE emirates (sortOrder 101+ keeps them after Egypt).
--    Default shippingCost 25 (AED) is a non-zero starting point for the store
--    owner; every emirate stays fully editable from Admin ← Shipping.
-- ======================================================================
ALTER TABLE governorates ADD COLUMN countryCode TEXT NOT NULL DEFAULT 'EG';
CREATE INDEX IF NOT EXISTS idx_governorates_country ON governorates(countryCode, isActive);

INSERT OR IGNORE INTO governorates
  (id, code, name, nameEn, isActive, sortOrder, shippingCost, codEnabled, zoneId, countryCode, createdAt, updatedAt)
VALUES
  ('gov-ae-abu-dhabi',    'AE-AUH', 'أبوظبي',       'Abu Dhabi',      1, 101, 25, 1, NULL, 'AE', '2026-08-18T00:00:00.000Z', '2026-08-18T00:00:00.000Z'),
  ('gov-ae-dubai',        'AE-DXB', 'دبي',          'Dubai',          1, 102, 25, 1, NULL, 'AE', '2026-08-18T00:00:00.000Z', '2026-08-18T00:00:00.000Z'),
  ('gov-ae-sharjah',      'AE-SHJ', 'الشارقة',       'Sharjah',        1, 103, 25, 1, NULL, 'AE', '2026-08-18T00:00:00.000Z', '2026-08-18T00:00:00.000Z'),
  ('gov-ae-ajman',        'AE-AJM', 'عجمان',         'Ajman',          1, 104, 25, 1, NULL, 'AE', '2026-08-18T00:00:00.000Z', '2026-08-18T00:00:00.000Z'),
  ('gov-ae-umm-al-quwain','AE-UAQ', 'أم القيوين',    'Umm Al Quwain',  1, 105, 25, 1, NULL, 'AE', '2026-08-18T00:00:00.000Z', '2026-08-18T00:00:00.000Z'),
  ('gov-ae-ras-al-khaimah','AE-RAK','رأس الخيمة',    'Ras Al Khaimah', 1, 106, 25, 1, NULL, 'AE', '2026-08-18T00:00:00.000Z', '2026-08-18T00:00:00.000Z'),
  ('gov-ae-fujairah',     'AE-FUJ', 'الفجيرة',       'Fujairah',       1, 107, 25, 1, NULL, 'AE', '2026-08-18T00:00:00.000Z', '2026-08-18T00:00:00.000Z');

-- ======================================================================
-- 3) products — independent UAE pricing + per-country availability.
--    priceAE stays NULL after migration ⇒ product is NOT offered in the UAE
--    catalog until the admin explicitly sets an AE price (the approved gate:
--    isActiveAE = 1 AND priceAE IS NOT NULL). Egypt reads are untouched.
-- ======================================================================
ALTER TABLE products ADD COLUMN priceAE REAL;
ALTER TABLE products ADD COLUMN oldPriceAE REAL;
ALTER TABLE products ADD COLUMN isActiveAE INTEGER NOT NULL DEFAULT 1;

-- ======================================================================
-- 4) orders — immutable country/currency snapshot columns.
--    All historical orders backfill to EG/EGP/ج.م (the store was Egypt-only).
--    order_items.currency / currencySymbol snapshots remain as-is as well.
-- ======================================================================
ALTER TABLE orders ADD COLUMN countryCode TEXT NOT NULL DEFAULT 'EG';
ALTER TABLE orders ADD COLUMN currency TEXT NOT NULL DEFAULT 'EGP';
ALTER TABLE orders ADD COLUMN currencySymbol TEXT NOT NULL DEFAULT 'ج.م';
CREATE INDEX IF NOT EXISTS idx_orders_country ON orders(countryCode, createdAt);

-- ======================================================================
-- 5) users — saved country preference.
--    NULL = not set ⇒ the store default country applies. Column is plain
--    TEXT so the store's exact EG/AE codes are enforced at the API layer.
-- ======================================================================
ALTER TABLE users ADD COLUMN country TEXT;

-- ======================================================================
-- 6) Payment country scope — inside the existing payment_methods.config JSON
--    (no new tables, no columns). json_set preserves all other stored keys
--    (account numbers, wallets, QR…). Missing `countries` later means
--    "available in every country" — the backward-compatible default.
--    * cod stays available in both countries.
--    * Egypt-only methods are scoped to EG explicitly.
-- ======================================================================
UPDATE payment_methods
   SET config = json_set(COALESCE(NULLIF(config, ''), '{}'), '$.countries', json('["EG","AE"]')),
       updatedAt = COALESCE(updatedAt, '2026-08-18T00:00:00.000Z')
 WHERE code = 'cod' AND json_valid(COALESCE(config, '{}'));

UPDATE payment_methods
   SET config = json_set(COALESCE(NULLIF(config, ''), '{}'), '$.countries', json('["EG"]')),
       updatedAt = COALESCE(updatedAt, '2026-08-18T00:00:00.000Z')
 WHERE code IN ('instapay', 'vodafone-cash', 'etisalat-cash', 'orange-cash', 'meeza')
   AND json_valid(COALESCE(config, '{}'));
