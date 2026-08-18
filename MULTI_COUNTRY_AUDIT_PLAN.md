# AL ZEINA — Multi-Country (EG + UAE) — Phase 0 Audit & Implementation Plan

Baseline: `c331228` — “Final stable version before Egypt UAE”. Read-only audit performed; **no code was modified**.

---

## 1. Current Architecture (what exists)

### Backend — Cloudflare Workers + Hono + D1 + R2 (`backend/src`)
| Area | File(s) | Summary |
|---|---|---|
| Entry | `index.js` | Hono app; CORS allowlist; double-submit CSRF on mutating requests; mounts public + admin routers; `/uploads/*` serves R2. |
| DB helpers | `lib/db.js` | D1 `all/first/run`, `hydrate()` boolean coercion, `paginateQuery`. |
| Response utils | `lib/response.js` | `ok/created/fail`, `parseJson/stringify`, `uuid`, `round2`, `slugify`. |
| Settings | `services/settings.js` | KV table (`settings`) + deep-merged `DEFAULT_SETTINGS`; `publicSettings()` whitelist. **Single currency** (`payment.currency=EGP`, `currencySymbol=ج.م`) and **single shipping config** (`shipping.*`). |
| Pricing | `services/pricing.js` | `calculateShipping()` (governorates + optional zones, global threshold), `calculatePaymentFee()`, `calculateTax()`, coupon helpers. Single-country aware (governorate only). |
| Catalog | `routes/catalog.js` | Public product list/detail; `listProducts()` filters/sorts on `price` (single price); `saveProduct()`/`normalizeProductInput()` handle admin writes (price, oldPrice, cost…). |
| Orders | `routes/orders.js` | **Already server-authoritative**: prices re-read from D1, shipping recomputed from governorate, payment fee/tax/coupon recomputed, client `shippingCost` drift rejected (>0.01). Stock guarded by conditional UPDATE + trigger. Snapshots: `order_items` (price, currency, currencySymbol) + `orders.financialSnapshot` JSON. |
| Manual payments | `services/paymentVerification.js`, `routes/orders.js` | Receipt upload (type/size/extension validated, R2), `payment_verifications` table, approve/reject flow. **Untouched by this project.** |
| Cart (server) | `routes/cart.js` | Cookie cart — frontend actually uses localStorage zustand cart; cart cookie API is legacy/alternate. |
| Content | `routes/content.js` | `/settings`, `/storefront/config` (settings + paymentMethods + governorates + banners + pages + sections + popups + flashSales), `/storefront/shipping/quote`, `/storefront/governorates`, pages, contact, newsletter, manifest. |
| Admin | `adminCore.js` (products/orders/customers/reviews/coupons/messages/inventory), `adminExtra.js` (generic `RESOURCES` CRUD incl. governorates/shipping-zones/shipping-companies/payment-methods + settings + themes + backup), `adminSystem.js`, `adminLocale.js`, `adminReset.js` (Reset Center — whitelisted, never touches config tables), `adminStaff/Banners/Branding/Support.js`. |
| Resource engine | `services/resource.js` | `RESOURCES` + `TABLE_COLUMNS` whitelist per table; unknown fields → `data`/`config` JSON column. |
| Auth | `routes/auth.js`, `routes/user.js`, `middleware/auth.js` | PBKDF2-SHA256 + JWT, lockout, password reset (SHA-256 token), sessions. `users` table has **no country**. |
| Cron | `cron.js` | scheduled jobs (coupons/stock/publish/analytics/logs). |

### D1 Schema / Migrations
- 18 migrations `0001`–`0019` (no `0005` file — numbering gap only). `schema.sql` mirrors final shape (structure reference).
- `governorates`: 27 Egyptian rows seeded in `0007_egypt_governorates.sql` (with `shippingCost`, `codEnabled`, `zoneId`). **Preserved as-is.**
- `payment_methods`: cod / instapay / vodafone-cash (0002) + etisalat-cash / orange-cash / meeza (0016). Fee config + `config` JSON.
- `products`: single `price REAL`, `oldPrice REAL`, `cost`, `discount`, variants JSON (variant-level `price`).
- `orders`: `governorate` (id), totals, `financialSnapshot` JSON; `order_items` carry `currency`/`currencySymbol` snapshot. **No country/currency columns on `orders`.**

### Frontend — React 18 + Vite + zustand + React Query (`frontend/src`)
- `ConfigProvider.jsx`: fetches `/storefront/config` **once at boot**; exposes `settings/paymentMethods/governorates/…`; calls `setCurrency()` (global symbol) and `setShippingRules()`.
- `utils/format.js`: `formatPrice(value, lang)` — **global** currency symbol (EGP/ج.م), `ar-EG`/`en-US` number locales.
- `utils/constants.js`: hardcoded `CURRENCY=EGP` + legacy `GOVERNORATES` demo list (27) — demo fallback only; live data comes from config.
- `cartStore.js`: localStorage cart with **price snapshots from listing data**, `shippingGovernorate`, `shippingRules` from settings; `syncWithServer()` re-prices from fetched products.
- React-Query keys have **no country dimension** (`['products', params]`, `['featured', limit]`, `['newArrivals', limit]`, `['product', slug]`…).
- Checkout: 3-step; governorates + payment methods from `useConfig()`; posts `governorateCode`, coupon, paymentMethod; server recomputes everything (with drift check on shipping).
- i18n: ar/en, gender forms, lang persisted in `localStorage` — **language is already independent of anything else**.
- Admin pages: Products (price/oldPrice/cost), Shipping (general/governorates/zones/companies), Payments, Settings (incl. LocalizationPanel = locale + single currency), ResetCenter, PaymentVerification, DesignStudio/Themes, PageBuilder, System.
- Demo/mock layer (`api/mockData.js`, `mockEngine.js`) only active with `VITE_ENABLE_DEMO_DATA=true`.

**Zero occurrences</b> of `country`/multi-country code exist anywhere — clean slate, confirming the “start fresh” premise.**

### Reusable as-is
- Server-authoritative order pipeline (prices/shipping/fees/coupons recomputed, drift checks, stock guards, idempotent-ish order numbering).
- Manual payment verification system (spec: keep intact).
- Generic admin resource engine (governorates etc.) — new columns drop into `TABLE_COLUMNS`.
- Payment method `config` JSON (absorbs per-country enablement without schema change).
- Theme/i18n/Reset/R2/upload systems — orthogonal.

---

## 2. What must change

| # | Change | Why |
|---|---|---|
| 1 | First-class `countries` (EG, AE) with per-country currency + shipping overrides | Egypt keeps EGP+global settings; UAE needs AED + own shipping/thresholds. |
| 2 | Country resolution **server-side** (header/param → user’s saved country → default EG), validated against D1 | “Server authority”; never trust client country/currency. |
| 3 | Country-aware catalog pricing (AE price/oldPrice + per-country availability) | No FX conversion; admin-set UAE prices. |
| 4 | Country-aware shipping (governorates tagged by country; 7 emirates seeded; per-country thresholds) | Dubai ≠ Cairo pricing/thresholds. |
| 5 | Country-aware payment methods (config `countries` list; filter + enforce at checkout) | InstaPay/Vodafone/Meeza are EG-only; AE gets its own enabled set. |
| 6 | Orders snapshot: `countryCode`, `currency`, `currencySymbol` (+ region info already present) | Historical orders immutable. |
| 7 | User profile country (`users.country`) + persistence API | “Logged-in customer whose saved country is UAE → UAE”. |
| 8 | Frontend **CountryProvider/store** + Country Selector (TopBar + mobile menu) + react-query keys get `country`; cart re-priced on switch | Central context; persistence across refresh; no stale cache/data. |
| 9 | Admin: Countries resource; product AE-price fields; shipping gov/zone country filters; payment country checkboxes | Single admin system, no second admin. |

---

## 3. Proposed database changes — one migration `0020_multi_country.sql` (additive, ordered, reversible-by-backup)

```sql
-- 1) Countries (2 rows only, ever)
CREATE TABLE IF NOT EXISTS countries (
  code TEXT PRIMARY KEY,               -- 'EG' | 'AE'
  name TEXT NOT NULL, nameEn TEXT NOT NULL,
  currency TEXT NOT NULL,              -- 'EGP' | 'AED'
  currencySymbol TEXT NOT NULL,        -- 'ج.م' | 'د.إ'
  currencySymbolEn TEXT NOT NULL,      -- 'EGP' | 'AED'
  currencyPosition TEXT NOT NULL DEFAULT 'after',
  shipping TEXT NOT NULL DEFAULT '{}', -- optional per-country overrides of settings.shipping
  isActive INTEGER NOT NULL DEFAULT 1,
  isDefault INTEGER NOT NULL DEFAULT 0, -- EG = 1
  sortOrder INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
INSERT OR IGNORE INTO countries(code, name, nameEn, currency, currencySymbol, currencySymbolEn,
  currencyPosition, isActive, isDefault, sortOrder, shipping, createdAt, updatedAt) VALUES
 ('EG','مصر','Egypt','EGP','ج.م','EGP','after',1,1,1,'{}', …),
 ('AE','الإمارات','UAE','AED','د.إ','AED','before',1,0,2,'{}', …);

-- 2) Governorates → country. Existing 27 rows become EG automatically (default).
ALTER TABLE governorates ADD COLUMN countryCode TEXT NOT NULL DEFAULT 'EG';
CREATE INDEX IF NOT EXISTS idx_governorates_country ON governorates(countryCode, isActive);
INSERT OR IGNORE INTO governorates(id, code, name, nameEn, isActive, sortOrder,
  shippingCost, codEnabled, countryCode, createdAt, updatedAt) VALUES
 ('ae-abu-dhabi','AE-AUH','أبوظبي','Abu Dhabi',1,101,0, 1,'AE',…),
 ('ae-dubai','AE-DXB','دبي','Dubai',1,102,0,1,'AE',…),
 ('ae-sharjah','AE-SHJ','الشارقة','Sharjah',1,103,0,1,'AE',…),
 ('ae-ajman','AE-AJM','عجمان','Ajman',1,104,0,1,'AE',…),
 ('ae-uq','AE-UAQ','أم القيوين','Umm Al Quwain',1,105,0,1,'AE',…),
 ('ae-rak','AE-RAK','رأس الخيمة','Ras Al Khaimah',1,106,0,1,'AE',…),
 ('ae-fujairah','AE-FUJ','الفجيرة','Fujairah',1,107,0,1,'AE',…);

-- 3) Products: independent UAE pricing + per-country availability. EG price untouched.
ALTER TABLE products ADD COLUMN priceAE REAL;          -- NULL ⇒ not offered in AE until admin sets it
ALTER TABLE products ADD COLUMN oldPriceAE REAL;
ALTER TABLE products ADD COLUMN isActiveAE INTEGER NOT NULL DEFAULT 1;

-- 4) Orders: immutable country/currency snapshot columns (plus financialSnapshot extension)
ALTER TABLE orders ADD COLUMN countryCode TEXT NOT NULL DEFAULT 'EG';
ALTER TABLE orders ADD COLUMN currency TEXT NOT NULL DEFAULT 'EGP';
ALTER TABLE orders ADD COLUMN currencySymbol TEXT NOT NULL DEFAULT 'ج.م';
CREATE INDEX IF NOT EXISTS idx_orders_country ON orders(countryCode, createdAt);

-- 5) Users: saved country preference (NULL ⇒ default country)
ALTER TABLE users ADD COLUMN country TEXT;
```

- **No data deleted or rewritten.** Existing `products.price` is the EG price exactly as stored. Payment methods get country scoping in `config` JSON (`config.countries = ["EG"]` seeded via `UPDATE … WHERE code IN ('instapay','vodafone-cash','etisalat-cash','orange-cash','meeza')`; COD gets `["EG","AE"]`) — JSON updates, no column changes.
- Migration tested twice: on a **fresh local D1** (0001→0020) and as an **upgrade on a copy of current schema**.
- Reset Center needs no change: it deletes whole rows only from transactional tables and never touches `countries/governorates/payment_methods`.

**Design decision (flagged):** a product appears in the UAE catalog only when `isActiveAE=1 AND priceAE IS NOT NULL`. No fallback to the EG number (that would be implicit carryover). Admin gets (a) per-product AE fields and (b) a bulk “Copy EG price → AE price” action so opening the UAE market is explicit but not tedious.

---

## 4. Proposed API changes (additive; EG behavior unchanged when country=EG/omitted)

**Country resolution (new service `services/country.js` + tiny middleware)**
- `resolveCountry(c)`: `X-Country` header or `?country=` → validated against active countries → else authenticated `user.country` → else default (EG). Result stashed in `c.var.countryRow` + `c.var.country` code.
- Axios interceptor adds `X-Country` from the country store on **every** request.

**Public**
| Route | Change |
|---|---|
| `GET /storefront/config` | + `countries` list, + `country` (resolved); `governorates` and `paymentMethods` filtered by country; `settings.shipping` merged with country overrides; `payment.currency*` resolved from country. |
| `GET /storefront/governorates` | filter by resolved country. |
| `GET /storefront/shipping/quote` | resolves governorate **within the resolved country**; country overrides applied; rejects cross-country governorate. |
| `GET /products*` (list/featured/best-sellers/new-arrivals/search/slug/related/ids) | AE: filters `isActiveAE=1 AND priceAE IS NOT NULL`, shapes `price = priceAE`, `oldPrice = oldPriceAE`. EG: **byte-identical behavior to today**. |
| `GET /cart` | re-prices items with country pricing, drops unavailable items. |
| `POST /orders` | resolves + validates country server-side; governorate must belong to country; payment method must be enabled for country; all money recomputed with country currency; writes snapshot columns; rejects tampered `country`/currency/payment/shipping (existing drift checks kept). |
| `GET /orders*` | unchanged reads (snapshots already stored). |
| `PUT /users/me/country` (new) + include `country` in `/auth/login`, `/auth/me`, `/users/me` | persist preference. |

**Admin (same single admin)**
| Route | Change |
|---|---|
| `RESOURCES` | register `countries` (table + `TABLE_COLUMNS`) → full CRUD/toggle/reorder for free. |
| `POST/PUT /admin/countries/:id/default` (small handler) | set default country (transactionally unsets others). |
| `listProducts` (admin mode) | include AE fields (`priceAE/oldPriceAE/isActiveAE`); `saveProduct` normalize accepts them. |
| `POST /admin/products/bulk` | new actions `copy-eg-to-ae-price`, `enable-ae`, `disable-ae`. |

---

## 5. Frontend changes

1. **`store/countryStore.js` (new)** — zustand + persisted `alzeina_country`; holds `{ country, countries }`; actions `setCountry()`, `initFromConfig()`. Independent from i18n (all 4 combinations work).
2. **Axios client** — inject `X-Country`; on `countryStore` change: persist → invalidate country-dependent query keys → `ConfigProvider.reload()`.
3. **`ConfigProvider`** — currency (`setCurrency`) + shipping rules now come from the **resolved country**; add country to a context; expose `countries`, `country`, `currency` info; cart governorate reset on switch; `cartStore.repriceForCountry(products)` drops/re-prices items.
4. **Query keys** — `['products', country, params]`, `['featured', country, limit]`, `['newArrivals', country, limit]`, `['bestSellers'…]`, `['product', country, slug]`, `['related', country, id]`, `['suggestions', country, q]`. Categories/brands/banners stay global (spec: single catalog).
5. **`CountrySelector` component** — in `TopBar` (desktop) and `MobileMenu`; premium dropdown w/ flags (SVG inline, no network), shows currency; persists via store.
6. **`format.js`** — currency becomes an object keyed per country set via `setCurrency({code, ar, en, position})`; `formatPrice` uses active country currency (position honored).
7. **Checkout** — governorate options already from config (now country-filtered); send only `governorateCode`/coupon/method (server derives country); displayed currency follows country.
8. **Admin**
   - Products form: “UAE pricing” group: `priceAE`, `oldPriceAE`, `isActiveAE` toggle + bulk actions UI.
   - Shipping page: country filter tabs (Egypt/UAE) for governorates; zones picker filters by country; per-country threshold hint.
   - Payments page: per-method country checkboxes (EG/AE) stored in `config.countries`.
   - Settings: new “Countries” section (uses countries resource) — enable/disable, default, per-country shipping override fields.
   - Orders list/detail: country + currency badge (read from order columns).
9. **Translations** — ~15 new keys (country, Egypt, UAE, currency, region/emirate, select country…), ar + en + admin packs.
10. **Profile/Addresses** — emirates supported via governorate string (no schema change); label shows region list for active country.

---

## 6. Files likely to change

**Backend (8 touch + 2 new)**
- `migrations/0020_multi_country.sql` **(new)**
- `src/services/country.js` **(new)** — resolve/validate, shipping override merge, price shaping helper.
- `src/index.js` — country middleware mount.
- `src/routes/content.js` — config/governorates/quote country-aware.
- `src/services/pricing.js` — `calculateShipping`/`calculateTax` country param + country overrides.
- `src/routes/catalog.js` — country in `listProducts`/`productShape`, normalize AE fields, suggestions/related.
- `src/routes/orders.js` — authoritative country validation + snapshot columns.
- `src/routes/cart.js` — country re-pricing.
- `src/routes/user.js` + `auth.js` — expose/persist `users.country`.
- `src/services/resource.js` + `routes/adminCore.js` — countries resource, AE product fields, bulk actions, admin orders/list show country.

**Frontend (2 new + ~15 touch)**
- NEW `store/countryStore.js`, `components/common/CountrySelector.jsx`.
- `api/client.js`, `config/ConfigProvider.jsx`, `utils/format.js`, `hooks/useProducts.js`, `store/cartStore.js`, `pages/Checkout/index.jsx`, `components/layout/TopBar.jsx`, `components/layout/MobileMenu.jsx`, `components/ui/Price.jsx` (minor), Admin: `Products.jsx`, `Shipping.jsx`, `Payments.jsx`, `Settings.jsx` (+new Countries panel), `Orders.jsx`, i18n packs (`translations.js`, `adminTranslations.js`, `paymentTranslations.js`).

**Estimated footprint:** backend ≈ +450/-80 LOC; frontend ≈ +600/-120 LOC; 1 migration.

---

## 7. Security model (unchanged principles, extended to country)

Server is the only source of truth for: price, currency, shipping, fees, totals, payment method availability, **and country resolution**. Attack cases (UAE+EGP, EG+AED, wrong governorate↔country, wrong payment↔country, tampered price/shipping/currency/country) are rejected or corrected server-side:
- country resolved from server-validated sources only (header whitelist → user record → default);
- governorate↔country membership verified at quote & order time;
- client-sent totals are sanity-compared only (existing drift rejection); all authoritative math from D1 rows;
- orders store the resolved country/currency immutably.

---

## 8. Test strategy (per mandated phases)

- Local D1 via `wrangler d1 --local`: fresh build (0001→0020) **and** upgrade on a copy of current schema.
- Backend API test script (node, targeted, temp files deleted): Egypt regression, UAE flows, country-switch, the 10 attack cases.
- Frontend: `vite build`, plus smoke of country selector combos (EG/AR, EG/EN, AE/AR, AE/EN).
- Workspace hygiene: no screenshots/logs kept; `node_modules` excluded from snapshots; repo stays ~3 MB.

---

## 9. Risks / notes
1. **Coupons** are currency-agnostic numbers; a fixed-value EGP coupon could under/over-apply in AED. Spec doesn’t require coupon country rules — flagged as a known limitation (server still controls the discount math).
2. **Variants** carry their own `price` in JSON (shared across countries); per-country UAE variant pricing is out of scope (variants inherit product-level AE pricing rule defaults — variant price used as-is only for EG). *Recommend: use product-level AE pricing; AE + variant price uses `variant.price` only if we extend variants JSON — decision needed.*
3. `shipping_zones` are country-implicit (via member governorates); admin UI will segment them per country to avoid mixed zones.
4. Admin dashboards/analytics sum mixed currencies after UAE orders exist — display uses order currency snapshot; multi-currency totals are inherently approximate. Flagged as display-only.

---

## 10. Phase execution map (B→O)
- **B** DB: migration 0020 + fresh/upgrade tests → **C** Egypt regression (before any further change) → **D** UAE (countries, regions, admin availability) → **E** switching (state, cache, cart repricing) → **F** pricing → **G** shipping → **H** payments → **I** checkout → **J** orders/snapshots → **K** admin → **L** mobile → **M** RTL/LTR → **N** themes → **O** build + `node --check` + `wrangler deploy --dry-run`.

**Sequencing rule:** no phase starts while an earlier phase is failing. Egypt regression runs after every DB/server change.

---

## Approval needed before Phase B
1. OK to adopt the “UAE catalog gate” = `isActiveAE=1 AND priceAE set` (no silent EG→AE price carryover), with a bulk copy action for admins?
2. OK with scoped variant rule (7.2): AE uses product-level AE price; variant overrides remain EG-only for now (variants are unused in seed data)?
3. OK to persist per-visitor country in `localStorage` + `X-Country` header, and `users.country` for logged-in customers?

Stopping here per instructions — **no code has been modified**. Awaiting go-ahead to start Phase B (database changes).
