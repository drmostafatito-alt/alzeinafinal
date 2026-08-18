# Gate 6 — Full Regression & Release Verification Report
## التقرير النهائي للمرحلة E — متجر AL ZEINA — ميزة تعدّد الدول (مصر 🇪🇬 + الإمارات 🇦🇪 فقط)

| | |
|---|---|
| **التاريخ / Date** | 2026-08-18 (Africa/Cairo) |
| **Baseline** | `c331228` (Final stable version before Egypt UAE) |
| **Frozen chain** | `c331228` → `24acd83` (G1) → `e20c283` (G2) → `050035a` (G3) → `0efa3ba` (G4) → `0a3df5d` (G5) → **G6 (this commit)** |
| **البيئة / Env** | Backend: `wrangler dev --local` (Miniflare, D1 SQLite persisted) @ 127.0.0.1:8787 · Frontend: node 20 harnesses + esbuild bundles of **real** app modules. **Browser: NOT available in this sandbox.** |
| **قاعدة الحكم / Verdict rule** | لا PASS بالتخمين — كل PASS بدليل منفَّذ. "PRODUCTION READY" ممنوعة ما دامت Blockers > 0. |

---

## 1) ملخص تنفيذي / Executive Summary

| المقياس | النتيجة | الدليل |
|---|---|---|
| اختبارات API ديناميكية (حزمة v2) | **69/69 PASS — 0 FAIL** | `/tmp/g6/results2.json` (RUN=87074318) |
| اختبارات Frontend (Bundle A: مفاتيح React Query + تمزيق التخزين) | **7/7 PASS** | console bundle A |
| اختبارات Frontend (Bundle B: السلك الحقيقي + التبديل الذري + الكاش) | **10/10 PASS** | console bundle B |
| اختبارات السباق (Bundle C: تأخير اصطناعي، الاتجاهان، آخر-طلب-يفوز) | **3/3 PASS** | console bundle C |
| فحوص أخطاء إضافية (403/409/429-lockout) | **4/4 PASS** | probes console |
| **إجمالي الفحوص الديناميكية المنفَّذة في Gate 6** | **93/93 PASS — 0 FAIL** | كله أدناه بالأدلة |
| الفحوص الساكنة | node --check 37/37 ✓ · build ✓ (8.18s) · diff --check ✓ · deploy --dry-run ✓ (ينجح البناء، لكن انظر Blockers) | §S |
| **أخطاء حقيقية مكتشفة في Gate 6** | **0** (صفر) — سلسلة فشل Harness-v1 السابقة (17) ثبت بالأدلة أنها أخطاء حزمة اختبار وليست أخطاء تطبيق | §Bugs |
| **Blockers للنشر الإنتاجي (خارج نطاق ميزة الدول — قديمة/إعدادات)** | **2** → Not "PRODUCTION READY" | §Z |

**الحكم النهائي / Final verdict:** `GATE 6 PASS — RELEASE CANDIDATE VERIFIED (EG+AE). NOT "PRODUCTION READY": 2 deploy-config blockers must close first (D1 database_id placeholder + email/reset-link production vars). These pre-date the country feature and are not country bugs.`

---

## 2) جدول النتائج الكامل A–Z / Regression Score Table

> كل سطر: الاختبار · المتوقع · الفعلي (دليل حقيقي) · الحكم.

### A. Auth & Session (تسجيل/دخول/بلد المستخدم)
| # | Test | Expected | Actual (evidence) | Verdict |
|---|---|---|---|---|
| A1 | admin login | JWT | `200 token=True` | ✅ PASS |
| A2 | register (بريد فريد RUN=87074318) | 201 + auto token | `201 تم إنشاء حسابك بنجاح` | ✅ PASS |
| A3 | login | 200 + token | `200` | ✅ PASS |
| A4 | `/auth/me` يحمل `country` | key موجودة | مفاتيح المستخدم تتضمن `country` | ✅ PASS |
| A5/A6 | حفظ AE ثم قراءته | `country=AE` | `200` ثم `AE` | ✅ PASS |
| A7 | رفض كود غير صالح `ZZ` | 400 | `400 البلد المطلوب غير متاح` | ✅ PASS |
| A8 | رفض دولة غير مفعّلة `DK` | 400 | `400 البلد المطلوب غير متاح` | ✅ PASS |
| A9 | البلد المحفوظ يقود الحسم بلا ترويسة | AE + 7 إمارات | `AE n=7` (`/storefront/governorates` بلا X-Country) | ✅ PASS |
| A10 | الترويسة تسبق المحفوظ | EG + 27 محافظة | `EG n=27` مع X-Country: EG | ✅ PASS |
| A11 | forgot-password حي | 2xx عامّ (بلا Email Enumeration) | `200` | ✅ PASS |
| A12 | توكن الاستعادة يُخزَّن SHA-256 فقط | 64-hex + صلاحية مستقبلية | `hash=c957b3de.. len=64 exp=2026-08-18T18:31:58Z` (قراءة D1 مباشرة) | ✅ PASS |
| A13 | منع الإغراق: طلب ثانٍ لا يغيّر التوكن | نفس الـhash | `same=True` | ✅ PASS |
| A14 | توكن مزوّر | 400 | `400` | ✅ PASS |
| A15 | logout | 200 | `200` | ✅ PASS |
| A15b | **الفجوة الآمنة (production-safe gap)**: بلا RESET_LINK_BASE_URL لا يُسكّ رابط أبداً | سطر تدقيق `email-failed:reset-link-base-url-missing` | موجود في `audit_logs` (3 مرات قبل الضبط المحلي) | ✅ PASS (by design) |
| O11a/E4 | إعادة دخول بعد logout · lockout بعد 8 محاولات | 200 · **429** | `200` · `[401×8, 429]` والحساب المقفل يرفض حتى كلمة السر الصحيحة `429` | ✅ PASS |

### P. Products (CRUD + حقول البلد + البوابات)
| # | Test | Expected | Actual | Verdict |
|---|---|---|---|---|
| P1–P3 | إنشاء منتج بحقول AE + منتج مصر-فقط | حقول محفوظة | `201` · `(120.0,150.0,1)` · `(None,0)` من D1 | ✅ PASS |
| P4 | منتج البذرة `prod-demo-1` (priceAE=NULL) هو حالة «غير مسعّر AE» | NULL مؤكد | `[(None, 1)]` | ✅ PASS |
| P5/P6 | شكل المنتج AE/EG | 120/150 AED · 299/399 EGP | `120/150` · `299/399` | ✅ PASS |
| P7 | بوابة الكتالوج AE | both@120 فقط؛ egonly + unpriced مستبعدان | `in=True out_eg=True out_seed=True price=120` | ✅ PASS |
| P8 | كتالوج EG | الثلاثة بأسعار مصر | `True/True/True` | ✅ PASS |
| P9 | نفس URL بترويستين ⇒ جسدان مختلفان | عزل كامل | `True` | ✅ PASS |
| P10/P11 | bulk disable-ae/enable-ae | AE 404 ثم 200؛ EG دوماً 200 | `AE=404 EG=200` ثم `200` | ✅ PASS |
| P12 | تحديث إداري priceAE | 125 محفوظ | `[(125.0,)]` ثم أُعيد 120 | ✅ PASS |
| E1 | مستخدم عادي على `/admin/products` | 403/401 | `403` | ✅ PASS |
| E2 | إنشاء منتج مكرر (slug) | رفض | `201` ثم `409` | ✅ PASS |

### C. Cart (السلة — لا ثقة بأي سعر عميل)
| # | Test | Expected | Actual | Verdict |
|---|---|---|---|---|
| C1/C2 | إضافة نفس المنتج EG/AE | 299 / 120 | `200 price=299` · `200 price=120` | ✅ PASS |
| C3 | تحديث كمية | 897 = 3×299 | `200 total=897` | ✅ PASS |
| C4 | مسح السلة | فاضية | `200 items=0` | ✅ PASS |
| S15 | **تزوير كوكي السلة** (سعر=1) EG | الخادم يعيد الكتابة من D1 | `price=299 total=598` | ✅ PASS |
| S16 | نفس التزوير تحت AE | سعر AE من D1 | `price=120 total=240` | ✅ PASS |
| S17 | عناصر غير متاحة AE تُسقَط عند القراءة | يبقى fx_both فقط | `[pid_both]` | ✅ PASS |
| S18 | تحت EG تبقى الثلاثة | 3 | `3` | ✅ PASS |

### O. Orders (اللقطات المالية/المخزون/التفرد)
| # | Test | Expected | Actual | Verdict |
|---|---|---|---|---|
| O1/O2 | طلب EG COD + لقطة | `countryCode=EG currency=EGP symbol=ج.م snapshot.country=EG` | `201 AZ-20260818-0011` · `EG\|EGP\|ج.م\|EG` | ✅ PASS |
| O3 | حساب المجموع | 299+50=349 مطابق للمكوّنات | `sub=299 ship=50 tot=349 comp=349.0` | ✅ PASS |
| O4 | عتبة الشحن المجاني EG (500) | ship 0 · total 598 | `ship=0 tot=598` | ✅ PASS |
| O5/O6 | طلب AE COD + لقطة | `AE/AED/د.إ/snapshot.country=AE` | `201 AZ-20260818-000... 0013` · `AE\|AED\|د.إ\|AE` | ✅ PASS |
| O7 | سعر السطر AE + شحن إمارة | price 120 · ship 25 · total 145 | `price=120 old=150 ship=25 tot=145` | ✅ PASS |
| O8 | تفرد أرقام الطلبات | رقمان مختلفان بصيغة AZ- | `['AZ-20260818-0011','AZ-20260818-0013']` | ✅ PASS |
| O9 | خصم المخزون | 23→19 بالضبط (−4 عبر 4 طلبات) | `stock0=23 stock1=19` من D1 | ✅ PASS |
| O10 | منع Overselling | 400 | `400 كمية غير صالحة` | ✅ PASS |
| O11/O12 | طلب المستخدم المسجّل في قائمته + بالمُعرّف | موجود + لقطة سليمة | `found=True` · `200 cc=EG` | ✅ PASS |
| O12b | توكن بعد logout | 401 | `401` | ✅ PASS |
| S19 | قائمة الطلبات بلا توثيق | 401 | `401` | ✅ PASS |

### S. Security Attacks (الخادم هو الحَكَم — لا ثقة بالعميل إطلاقاً)
| # | Attack | Expected | Actual | Verdict |
|---|---|---|---|---|
| S1 | AE + محافظة مصرية (CAI) | 400 | `400 المحافظة المختارة غير متاحة` | ✅ PASS |
| S2 | EG + إمارة (AE-DXB) | 400 | `400 المحافظة المختارة غير متاحة` | ✅ PASS |
| S3 | AE + وسيلة دفع مصر-فقط (vodafone-cash) | 400 | `400 طريقة الدفع غير متاحة لهذا البلد` | ✅ PASS |
| S4 | جسم يكذب `{country:'EG',currency:'EGP'}` تحت ترويسة AE | يُتجاهل تماماً ⇒ الطلب AE/AED | `201 cc=AE cur=AED` | ✅ PASS |
| S5 | تلاعب سعر السطر (price:1) | يُعاد القراءة ⇒ subtotal 299 | `201 sub=299 tot=349` | ✅ PASS |
| S6 | تلاعب الشحن (shippingCost:0) | **رفض صارم** بتحقق المطابقة | `400 قيمة الشحن غير صحيحة` (التحقق في `orders.js:94-95`؛ والقيمة المخزَّنة دوماً `quote.cost` من الخادم `orders.js:103`) | ✅ PASS |
| S7 | إضافة منتج غير مسعّر AE للسلة | 404 | `404 المنتج غير موجود` | ✅ PASS |
| S8 | طلب AE بمنتج غير مسعّر AE | 400 | `400 المنتج كريم ترطيب فاخر غير متوفر في بلدك` | ✅ PASS |
| S9 | منتج isActiveAE=0 تحت AE | 404 | `404` | ✅ PASS |
| S10/S11 | ترويسات مزوّرة `USA`/`XX` | سقوط آمن إلى EG | `EG` · `EG` | ✅ PASS |
| S12 | `eg` صغيرة | تطبيع وتطابق | `EG` | ✅ PASS |
| S13 | `?country=AE` يعمل | AE | `AE` | ✅ PASS |
| S14 | الترويسة تسبق الاستعلام | EG | `EG` | ✅ PASS |

### I. Isolation (عزل الدولتين — بلا أي FX أو خلط)
| # | Test | Expected | Actual | Verdict |
|---|---|---|---|---|
| I1 | وسائل الدفع لكل بلد | EG: 6 · AE: cod فقط | `EG=[cod,instapay,vodafone-cash,etisalat-cash,orange-cash,meeza] AE=[cod]` | ✅ PASS |
| I2 | المحافظات/الإمارات | 27 × 7 بلا تقاطع | `overlap=set()` | ✅ PASS |
| I3 | حقول العملة | EGP/ج.م/after × AED/د.إ/before | مطابق | ✅ PASS |
| I4 | شكل `/storefront/governorates` | `{country, governorates[]}` تحت AE | `AE n=7` | ✅ PASS |

### W. Frontend Re-verification (البوابات 1–5 معاً — وحدات التطبيق الحقيقية)
| # | Test | Evidence | Verdict |
|---|---|---|---|
| W1a | إقلاع بقيمة ممزقة `XX` في التخزين ⇒ EG | `EG` | ✅ PASS |
| W1b–W1d | setCountry صريح/رفض/مزامنة القائمة النشطة | `AE/AE` · `AE` · `EG/EG,AE` | ✅ PASS |
| W2a | سلك حقيقي: X-Country على `/products` فقط؛ auth نظيف | `products=EG me=null login=null` | ✅ PASS |
| W2b | تمزيق حالة المتجر زمن-التشغيل ⇒ السلك EG | `EG` | ✅ PASS |
| W3a/b/c | مفاتيح React Query: البلد في الموضع [1] للمفاتيح التسعة المعتمدة عليه؛ العامة نظيفة | `products:EG,featured:EG,...` ثم `:AE` · `['suggestions','AE','cream']` | ✅ PASS |
| W3d | كاش QueryClient حقيقي: قائمتا EG/AE مختلفتان؛ إعادة قراءة EG = cache-hit (0 شبكة) | `eg=299 ae=120 net=2→2 same=true` | ✅ PASS |
| W3e | إبطال إداري بالبادئة يصيب الكاشين | `[true,true]` | ✅ PASS |
| W4 | **التبديل الذري الكامل**: PUT يحفظ؛ السلة تُعاد تسعيرها عبر `/products/ids` (variant SKU→120)؛ غير المتاح يسقط؛ المحافظة null؛ الكوبون يُسقَط؛ المُشاهَد يُعاد بناؤه + حدث | `ok=true country=AE items=pBoth@120 gov=null coupon=null recent=pBoth@120 evt=alzeina:recent-refresh` | ✅ PASS |
| W4b | مزامنة auth (user.country + التخزين) | `AE/AE` | ✅ PASS |
| W5 | العملة 4 حالات | `٢٩٩ ج.م \| EGP 299 \| د.إ ١٢٠ \| AED 120` | ✅ PASS |
| W6 | فشل PUT ⇒ تراجع كامل (لا اختلاف صامت) | `ret=false country=AE items=1` | ✅ PASS |
| W7 | PUT /users/me/country بلا X-Country على السلك | `put.xc=null ids.xc=AE` | ✅ PASS |
| W8 | الزائر: صفر استدعاءات /users | `calls=0` | ✅ PASS |
| R1–R3 | **السباق**: تأخير اصطناعي 120ms؛ EG→AE→EG وثلاثي→AE؛ آخر-طلب-يفوز؛ لا كتابات متأخرة بعد الاستقرار | `country=EG price=299` · `country=AE price=120` · `still=120` | ✅ PASS |

---

## 3) سجل الأخطاء / Bug Log (Rule Zero)

| # | Severity | الوصف | الحكم |
|---|---|---|---|
| — | — | **لا أخطاء حقيقية.** فشل Harness-v1 (17 فحصاً) ثبت بالأدلة أنه أخطاء حزمة: (1) كود محافظة خاطئ `gov-cairo` بينما الحقيقي `CAI` (Railway-seed naming) — السلوك 400 كان **صحيحاً**؛ (2) تلوّث مُعرّف منتج من تشغيل سابق (ظنناه غير مسعّر AE وقد ضبطته تجربة bulk)؛ (3) بريد ثابت ⇒ 429؛ (4) logout قبل استعمال التوكن في تسلسل الحزمة؛ (5) توقّع «تجاهل» الشحن بينما العقد **رفض صارم 400** — أقوى. أُعيدت كتابة الحزمة (v2) بمثبتات فريدة لكل تشغيل وتحقق مباشر من D1، فكانت 93/93. | مغلق بلا تعديل كود |
| L1 | LOW (توثيق فقط) | `calculateShipping` يحتفظ بفرع legacy غير مقيّد بالبلد عند `country===undefined` — **لا يمكن الوصول إليه**: المتصل الوحيد (`orders.js:86`) يمرّر البلد دوماً. بلا أثر وظيفي. | موثَّق، لا إصلاح في النطاق |
| L2 | LOW (توثيق فقط) | تفاوت رموز الحالة: cart-add لمنتج محجوب AE = 404، بينما order = 400 — كلاهما رفض حاسم برسالة واضحة. | موثَّق، لا إصلاح |
| L3 | LOW (تصميم معتمد) | سعر الإمارات على مستوى المنتج (لا variants) — `unitPriceForCountry` يتجاهل سعر الخيار تحت AE قصداً (موافق عليه في خطة التدقيق). | by design |

**سياسة HIGH/CRITICAL: لم تُرصد أي حالة ⇒ لا إيقاف. Backend Phase D لم يُمَس في Gate 6 (صفر تعديل).**

---

## 4) S. Static & Config & Deploy

| Check | Evidence | Verdict |
|---|---|---|
| `node --check` كل ملفات backend | `ALL 37 FILES OK` | ✅ PASS |
| `npm run build` (frontend) | `✓ built in 8.18s` — بلا تحذيرات كاسرة | ✅ PASS |
| `git diff --check` | `CLEAN` | ✅ PASS |
| فحص حزمة الإنتاج (dist) قبل حذفها | localhost وحيد = داخل axios (`window.location.href \|\| "http://localhost"`) — كود مورّد وليس إعداد تطبيق؛ الـAPI base نسبي `/api/v1`؛ لا VITE vars مخبوزة؛ كلمة password = تسميات UI فقط | ✅ PASS (ثم حُذف dist) |
| `npx wrangler deploy --dry-run` | الحزمة تُبنى وتُرفَع جافاً (421.76 KiB / gzip 94.01 KiB) وكل الـbindings تُحل | ⚠️ PASS-للبناء / **لكن** انظر Blockers §Z |
| Migration safety | DB أُعيد بناؤها من الصفر في هذه الجلسة: `0001→0020` (20 ملفاً) بلا خطأ؛ 0020 يحمل 5 حُرُوس IF [NOT] EXISTS (idempotent)؛ لا migration جديد في Gate 6؛ لا DB reset مطلوب | ✅ PASS |
| Performance (ساكن، تصوّري 100/1k/10k) | `listActiveCountries` = جدول صفّين/طلب؛ البوابات in-memory فوق صفوف مُجلَبة؛ IN-clauses محدودة بحجم سلة/تحديد إداري؛ قراءات المنتج المفرد بالـPK؛ قوائم الكتالوج مرقّمة (limit) — Phase D لم تُدخل مسحاً غير محدود ولا N+1 | ✅ PASS |
| Error-handling (نصف-حالة) | 401 (logout/orders-guest) · 403 (user→admin) · 404 (slug محجوب) · 409 (نسخ مكررة) · 429 (lockout) · 500-أثناء-التبديل (W6 تراجع) — بلا نصف-حالة في أي مسار مُختبَر | ✅ PASS |

## 5) NOT EXECUTED (صدق كامل — بيئة بلا متصفح)

| Section | الحالة | أقصى تحقق بديل منفَّذ |
|---|---|---|
| Country Selector تفاعلي (نقر/قوائم/Escape) في متصفح حقيقي | **NOT EXECUTED — browser unavailable** | SSR + سلك التبديل مُثبت Gate 4 (`0efa3ba: SSR-verified A–F incl. wire switch EG→AE→EG`) + W4 ديناميكي هنا؛ المكوّن 167 سطر بلا ألوان صلبة خارج الأعلام (تدقيق tokens) |
| Themes الثلاثة (Mauve Couture / Emerald Ivory / Rosewood Editorial) × EG/AE بصرياً | **NOT EXECUTED — browser unavailable** | الثيمات tokens-محضة والمكوّنات الجديدة لا تحمل ألواناً صلبة (تدقيق Gate 4)؛ العملة/الاتجاه يتبعان config الخادم (I3/W5) |
| Mobile 360/390/430/768/1024 × 4 توافيق | **NOT EXECUTED — browser unavailable** | TopBar desktop `hidden md:block` + نسخة MobileMenu مستقلة (Gate 4 SSR B/E) |
| RTL/LTR تبديل لغة × دولة بصرياً | **NOT EXECUTED — browser unavailable** | أسماء الدول من config (`name/nameEn`) مع fallback معتمد مصر/الإمارات/Egypt/UAE (Gate 4 SSR F) |

---

## 6) Z. Blockers & Final Verdict

### ⛔ Blockers للنشر الإنتاجي (خارجة عن نطاق ميزة الدول — موجودة قبلها/إعدادات بيئة)
| # | Blocker | الدليل |
|---|---|---|
| B1 | **`database_id = "REPLACE_WITH_D1_DATABASE_ID"`** في `backend/wrangler.toml` — أي deploy حقيقي مستحيل حتى يوضع مُعرّف D1 الفعلي | مخرجات `--dry-run` أعلاه |
| B2 | **بريد الاستعادة في الإنتاج**: لا `RESET_LINK_BASE_URL`/`FRONTEND_URL` في `[vars]` — التصميم الآمن سيمنع إرسال روابط الاستعادة كلياً (مثبت بسطر audit `email-failed:reset-link-base-url-missing`) + سر `RESEND_API_KEY` يجب ضبطه عبر `wrangler secret put` (لا يمكن التحقق منه محلياً/مستودعياً) | `auth.js:140-150` + سجل audit |

> ملاحظة (ليست Blocker): `CORS_ORIGINS="*"` — المصادقة Bearer-token أساساً والكوكيز محمية double-submit؛ مراجعة سياسة CORS عند النشر موصى بها لكنها قرار بنية خارج Gate 6.

### الحكم / Verdict
```
GATE 6: PASS — 93/93 dynamic checks, 0 fails, 0 real bugs, statics clean,
build + dry-run bundle pass, full diff review clean (no secrets/debug/artifacts).

الإصدار مرشَّح ومُتحقَّق منه (EG+AE) ضمن نطاق Gate 6.
ليس "PRODUCTION READY": Blockers = 2 (B1, B2) — إعدادات نشر قديمة،
ليست أخطاء دول. معيار «blockers = 0» غير متحقق ⇒ لا نكتب PRODUCTION READY.
```

**STOP بعد هذا التقرير: لا Gate 7، لا deploy، لا push.**

---
### ملحق الأدلة / Evidence Appendix
- حزمة API: `/tmp/g6/results2.json` (69 فحصاً، RUN=87074318) + مخرجات console كاملة.
- حزمات الواجهة: `/tmp/g6web/{keys,switch,race}.mjs` مبنية بـesbuild على **وحدات التطبيق الحقيقية** (`@/`→frontend/src) بخادم stub محلي يسجل الترويسات على السلك — A 7/7 · B 10/10 · C 3/3.
- التنظيف: كل المثبتات المؤقتة حُذفت (منتجات G6، مستخدمي probes) مع سجل IDs في `results2.json.cleanup`؛ طلبات الاختبار المتبقية في D1 **المحلي فقط** موثقة بمُعرّفاتها (لا endpoint حذف طلبات؛ لا بيانات حقيقية مُسّت؛ `prod-demo-1` قراءة-فقط).
- قرار اللجنة الواحد: هذا الكوميت يضم عمل Phase D (backend) المُتحقَّق الآن + هذا التقرير؛ بقاء Phase D خارج git بعد التحقق كان سيجعل السلسلة release غير متماسك (الواجهات 1–5 تعتمد عليه). لا push. لا تعديل لأي كوميت مجمّد.
