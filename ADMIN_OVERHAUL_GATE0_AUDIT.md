# GATE 0 — FULL AUDIT REPORT (READ-ONLY)
## مرحلة «Admin Control Overhaul» — تدقيق كامل بلا أي تعديل كود

| | |
|---|---|
| **التاريخ** | 2026-08-18 (Africa/Cairo) |
| **المرجع** | HEAD = `2d08320` (Gate 6 مُثبَت) — السلسلة المجمّدة سليمة، الشجرة نظيفة (`git status` = 0) |
| **الالتزام بالقواعد** | صفر تعديل كود · صفر migration · صفر بناء يعدّل المصدر · صفر بيانات دائمة (كل الفحوص في /tmp أو stub محلي) |
| **أدوات التحقق** | قراءة كاملة للمصدر + إعادة إنتاج jsdom حقيقية (React 18 + React Query 5 حقيقيان + شجرة `main.jsx` الأصلية حرفياً + خادم stub يسجّل `X-Country` على السلك) — سكربتات مؤقتة **حُذفت** بعد الاستخدام |

---

## 1) البنية الدقيقة الحالية / Exact Architecture

### طبقة البلد (سليمة ومُثبتة في Gate 6)
```
CountrySelector (TopBar/MobileMenu)
  → switchCountry()            frontend/src/services/countryFx.js   (منسّق ذري: rollback + cart reprice + race guard)
  → useCountryStore            frontend/src/store/countryStore.js   (مصدر وحيد: explicit>users.country>localStorage>EG)
  → ConfigProvider             frontend/src/config/ConfigProvider.jsx (genRef guard + country-effect + AppLoader gating)
  → axios interceptor          frontend/src/api/client.js          (X-Country على whitelist فقط)
  → resolveCountry/…           backend/src/services/country.js      (header>query>users.country>default — الخادم الحَكَم)
  → بوابات المنتج/الشحن/الدفع  catalog.js / pricing.js / orders.js  (حاسمة — مثبتة 93/93)
```

### المكدّس
React 18.3.1 + react-router 6.30.4 + React Query 5.101.4 (عميل مركزي: `staleTime 60s, retry 1`, هوكس المنتجات: `staleTime 5min`) · zustand 4.5.7 · Vite · Hono + D1 + R2 على Cloudflare Worker.

### التطبيق
- `App.jsx`: `if (loading) → <AppLoader/>` (شاشة كاملة) · `if (configError) → <BackendUnavailable/>` (شاشة كاملة مع زر إعادة) · ثم `<AppRoutes/>`.
- `pages/Home/index.jsx`: يُبنى من `config.sections` (D1 home_sections — **عالمي، غير مقيّد بالبلد**) + هوكس `featured/bestSellers/newArrivals/onSale` (مفاتيحها `[key, country, limit]`)؛ حالة `isStoreEmpty = !stillLoading && كل القوائم فارغة` ⇒ تعرض `hero + features + <StoreEmptyNotice/>` فقط.
- Service Worker (`public/sw.js`): **لا يخزّن /api/ إطلاقاً** — مستبعَد كسبب.

---

## 2) قدرات إدارة البلد الموجودة فعلاً / Current Capabilities

| الكيان | دعم Schema | دعم Backend API | ملاحظات |
|---|---|---|---|
| **products** | ✅ كامل: `priceAE, oldPriceAE, isActiveAE` (0020) | ✅ إنشاء/تعديل يقبل الحقول (مُثبت P12) · bulk: `enable-ae/disable-ae/copy-eg-to-ae-price` (adminCore.js:204-207) | بوابات الواجهة حاسمة EG/AE |
| **countries** | ✅ جدول كامل (عملة/رمز/موضع/overrides شحن) | ✅ **generic resource CRUD** عبر `RESOURCES.countries` (resource.js:21) + تحقق كود البلد | جاهز خلفياً بالكامل |
| **payment_methods** | ✅ `config.countries` JSON | ✅ نفس الـresource (config عمود قابل للتعديل) | الفلترة Server-side تعمل (I1) |
| **governorates** | ✅ `countryCode` (0020) | ⚠️ جزئي: قراءة/تعديل يعملان، **لكن `countryCode` ليس في TABLE_COLUMNS** (resource.js) ⇒ إنشاء إمارة جديدة من اللوحة يسقط افتراضياً إلى `EG` (resource.js:132)؛ وbulk `adminExtra.js:57` يتجاهل `countryCode` أيضاً | فجوة خلفية صغيرة محددة |
| **orders/users** | ✅ snapshots `countryCode/currency/currencySymbol` | ✅ يعملان | لا حاجة لتعديل |
| **categories / brands / banners / home_sections / popups / flash_sales / testimonials / instagram** | ❌ **لا أعمدة بلد — عالمية هيكلياً اليوم** | نفس الـgeneric resource (عالمي) | التصنيف المبدئي: **GLOBAL** (انظر §3/§10) |

---

## 3) القدرات المفقودة في Admin / Missing Admin Capabilities

| # | الفجوة | الدليل |
|---|---|---|
| M1 | **واجهة منتج بلا أي حقول بلد**: فورم واحد بسعر مصر ضمنياً (`price/oldPrice`)؛ لا `priceAE/oldPriceAE/isActiveAE`؛ `grep` على كل `pages/Admin/*` = **صفر نتائج** | Products.jsx:139-224 |
| M2 | **جدول المنتجات بلا أعمدة بلد** (مصر/الإمارات/سعر كل بلد/الحالة) | Products.jsx:220-224 عمود سعر واحد |
| M3 | **لا bulk actions بلدية في الواجهة** رغم جاهزيتها خلفياً | Products.jsx:319-360 |
| M4 | **لا صفحة/قسم «الدول»** في القائمة (رغم CRUD الخلفي الجاهز): اسم/عملة/رمز/موضع/افتراضي/نشط/shipping overrides | AdminLayout.jsx (لا عنصر «الدول») |
| M5 | **Shipping.jsx بلا أي وعي بالبلد** (لا نص `country` إطلاقاً): لا بطاقتا «مصر: المحافظات/العتبة» مقابل «الإمارات: الإمارات/العتبة» | Shipping.jsx كامل |
| M6 | **Payments.jsx بلا واجهة نطاق بلد** (النطاق = JSON خام داخل config اليوم) | Payments.jsx كامل |
| M7 | **لا مُحدِّد بلد في ترويسة الإدارة** | components/admin/* |
| M8 | categories/banners/…: لا تبديل رؤية لكل بلد — لكن الخلفية **لا تملك أعمدة** ⇒ قرار تصميم (GLOBAL أم country-visibility) مؤجل لـGate 3 — انظر §10 | schema.sql §categories/banners |

> طقم مكوّنات الإدارة الحالي غني وجاهز لإعادة الاستخدام: `DataTable, BulkBar, FormModal(SettingsPanels), ImagePicker, LocalizationPanel...` — لا حاجة لبنية جديدة.

---

## 4) علّة «المتجر يفرغ بعد EG→AE→EG» — إعادة الإنتاج الدقيقة / Reproduction

**المنهج (دليل تنفيذي لا استنتاج):** شجرة `main.jsx` الفعلية (`ErrorBoundary>I18n>QueryClient>ConfigProvider>Router>App`) مرسومة في **jsdom حقيقي** مع QueryClient حقيقي وخادم stub يحاكي بيئة الإنتاج المُبلَّغ عنها (**EG كتالوج غير فارغ / AE كتالوج فارغ**) ويسجّل `X-Country` لكل طلب. اللقطات تسجّل DOM + حالة كل query + السلك.

### النتائج (9 سيناريوهات منفَّذة):

| # | السيناريو | النتيجة | الدليل الرقمي |
|---|---|---|---|
| V1 | EG إقلاع | ✅ يعمل | htmlLen=56509 · أسماء منتجات ×18 · queries success |
| V2 | EG→AE بطيء | ✅ يعمل | config AE مطبّق · egNames=0 (كتالوج AE فارغ = متوقَّع) |
| V3 | **AE→EG العودة (البلاغ)** | ✅ **تُستعاد مصر بالكامل** | htmlLen=56509 مطابق تماماً للإقلاع (A≡C) · ×18 اسم · الكاش سليم: featured/bestSellers/newArrivals/onSale EG=3 |
| V4 | سريع EG→AE→EG فوري | ✅ يعمل | آخر-طلب-يفوز، لا كتابات متأخرة |
| V5 | config بطيء 800ms + كل ما سبق | ✅ يعمل | نفس الاستعادة الكاملة |
| V6 | مستخدم مسجّل (مسار PUT) | ✅ يعمل | — |
| V7 | سريع + مستخدم + تأخير 300ms | ✅ يعمل | — |
| V8 | **فشل `/storefront/config` مرة واحدة أثناء العودة AE→EG** | ❌ **فراغ حاسم مُعاد إنتاجه** | `configError=true` ⇒ App يرسم **`<BackendUnavailable/>` ملء الشاشة**: `htmlLen=1617`، صفر ترويسة/فوتر/محتوى، `storeCountry=EG لكن config.country=AE` (نصف-دولة)، و**لا تعافٍ تلقائي** — يبقى كل شيء ميتاً حتى ضغطة «إعادة المحاولة» |
| V9 | V8 + تبديلات سريعة إضافية | ❌ نفس الالتصاق | `ConfigProvider.load()` لا يُستدعى مجدداً ذاتياً ⇒ شاشة الخطأ دائمة |

### ترجمة البلاغ
الشبكة السليمة ⇒ **لا يمكن كسر HEAD** (V1–V7). الفشل العابر الواحد في طلب الإعدادات أثناء التبديل ⇒ **واجهة مدمَّرة بالكامل حتى تدخّل يدوي** (V8–V9) — وهذا أقرب تفسير تقني داخل الكود لبلاغ «المتجر صار شبه فارغ بعد العودة» (يمتد خطأ عابر واحد ليبدو كأنه «اختفى المتجر»). وصف «الترويسة تبقى ظاهرة» قد يختلط في ذاكرة المُبلِّغ مع «شاشة شبه فارغة ببطاقة مركزية» — لا يمكن الجزم من الكود وحده؛ انظر البيانات البيئية المطلوبة §5.

---

## 5) السبب الجذري الدقيق / Root Cause

### RC-1 (داخل HEAD — مُثبت بإعادة الإنتاج V8/V9)
**فشل عابر في `GET /storefront/config` أثناء التبديل يدمّر شاشة المتجر كاملة بلا تعافٍ.**
- `ConfigProvider.jsx:150-153` (فرع catch): `setConfigError(true)` عند 5xx/شبكة — لا يميّز «إقلاع أول» (لا حالة صالحة) عن «أثناء تبديل» (توجد حالة صالحة سابقة!).
- `App.jsx:67` (ترتيب الحراس): `configError` يسبق رسم أي شيء ⇒ تدمير كامل للواجهة رغم أن `config` في الذاكرة ما زال يحمل آخر حالة صالحة (AE).
- لا auto-retry ولا back-off، و`load()` لا يعاد استدعاؤه إلا يدوياً (`reload` عبر الزر فقط) ⇒ خطأ شبكة عابر واحد = متجر ميّت ظاهرياً بشكل دائم.
- CountrySelector يكتب المتجر قبل نجاح الإعدادات ⇒ `storeCountry=EG / config=AE` (نصف-دولة مرئية للمشاهد المتيقظ).

### RC-2 (فجوة تصلّح سلكية داخل HEAD — مُثبت بفحص المصدر)
**لا `Vary: X-Country` ولا `Cache-Control` على استجابات API GET بلدية النطاق** (`grep` على backend كاملاً = صفر)؛ الـ`Cache-Control` الوحيد على `/uploads/*` (وسائط R2 — صحيح). أي طبقة كاش وسيطة في النشر (قواعد كاش Cloudflare/Pages proxy) تحترم HTTP قد تصطدم بلدَين على نفس URL فيقدَّم **محتوى AE الفارغ كردٍّ على طلبات EG** — مطابق تماماً لنمط «العودة تُفرغ المتجر». غير قابل للإثبات من المستودع وحده، والتحصين قياسي ورخيص.

### RC-3 (انحراف إصدار النشر — غير قابل للجزم)
جميع إصدارات HEAD المعتمدة على `0efa3ba+` اجتازت إعادة الإنتاج بالمحاكاة الوفية. لو كانت النسخة المنشورة فعلياً أقدم من هذه السلسلة فالسلوك مختلف كلياً.

### بيان بيئي واحد يحسم أيّهما وقع فعلاً عند المستخدم
1. SHA/زمن البناء المنشور فعلياً مقابل `2d08320`؛ و/أو
2. هل ظهرت عند المستخدم بطاقة «تعذّر الاتصال بخادم المتجر» في أي لحظة (RC-1)؛ و/أو
3. ترويسات استجابة `/api/v1/products/featured` المنشورة (وجود/غياب `Vary` + أي `Age`/كاش وسيط) (RC-2).

> **ملاحظة حاسمة:** حتى قبل جواب المستخدم، الإصلاحات الثلاثة في §7 تحصّن الأسباب الثلاثة كلها بتكلفة صغيرة.

---

## 6) الملفات المُتضمَّنة / Files Involved

| الملف | الدور | السطور الحرجة |
|---|---|---|
| `frontend/src/config/ConfigProvider.jsx` | genRef guard + catch semantics | 137-168 (load) · 396-413 (country effect) · 150-153 (configError) |
| `frontend/src/App.jsx` | ترتيب حُرُس الرسم | 60-99 |
| `frontend/src/pages/Home/index.jsx` | `isStoreEmpty` يحوّل أي فشل جلب لفراغ هيكلي | 78-82 · 203-212 |
| `frontend/src/api/client.js` | whitelist X-Country (سليم) | 22-36 · 44-69 |
| `frontend/src/hooks/useProducts.js` | مفاتيح البلد (سليمة) | 15-46 |
| `frontend/src/services/countryFx.js` | ترتيب SET قبل PUT (سليم + rollback) | 76-128 |
| `backend/src/index.js` | ترويسات الاستجابة | 40-68 (لا Vary/لا CC) |
| `backend/src/services/resource.js` | whitelist الأعمدة الإدارية | gov: لا `countryCode` (132 يُرجع EG) |
| `backend/src/routes/adminExtra.js` | تسجيل موارد عامة ديناميكياً | 28 · 57 (bulk gov بلا countryCode) |

---

## 7) أقل إصلاح آمن مقترح / Minimum Safe Fix (للمصادقة في Gate 1)

| # | التغيير | الملف | الحجم |
|---|---|---|---|
| F1 | في `load()` catch: لا ترفع `configError` إلا إذا **لا توجد حالة صالحة سابقة** (boot-fail). أثناء التبديل: احتفظ بالحالة الصالحة المعروضة **وأعد المحاولة تلقائياً بمهلة تصاعدية** (مثلاً 2s/5s/10s، بحد 3 محاولات) مع مؤشر صغير قابل للاسترداد بدل شاشة الموت | ConfigProvider.jsx | ~15 سطر |
| F2 | `App.jsx`: لا تستبدل الشجرة كاملة إلا في boot-fail؛ وإلا أبقِ آخر واجهة صالحة + شريط تنبيه | App.jsx | ~8 سطور |
| F3 | Backend: ترويستان على استجابات JSON العامة بلدية النطاق: `Vary: X-Country` و`Cache-Control: no-store` (لا تمس الكاش السليم للوسائط) | index.js (وسيط استجابة عام) | ~6 سطور |
| F4 | (احتياط سببي مباشر لـ RC-3) طباعة build-hash/وقت البناء في `index.html`/console لتأكيد الإصدار المنشور بسطر واحد عند الشكوى — اختياري | vite config/index.html | 1-3 سطور |

**ممنوع في Gate 1:** أي تغيير Admin، أي migration، أي إعادة تصميم للتبديل (النواة مُثبتة سليمة V1–V7).

---

## 8) تغييرات Backend مطلوبة لاحقاً (Gates 2-3)

| # | التغيير | السبب |
|---|---|---|
| B1 | إضافة `countryCode` إلى `TABLE_COLUMNS.governorates` + تمريره في bulk (adminExtra.js:57) | إنشاء/تعديل إمارات UAE من اللوحة دون JSON |
| B2 | ترويسات F3 أعلاه | RC-2 |
| B3 | (فقط إذا سُمح بميزة الرؤية — انظر §10) لا شيء خلفي: countries/payment-methods/products جاهزة بالكامل | إعادة استخدام كامل |

## 9) تغييرات Frontend مطلوبة لاحقاً

| Gate | التغيير |
|---|---|
| G2 | بطاقتا بلد داخل فورم المنتج (مصر 🇪🇬 / الإمارات 🇦🇪) بحقول `price/oldPrice/isActive` لكل بلد وعملة معلنة (ج.م/EGP · د.إ/AED) + حفظ موحّد في طلب واحد؛ أعمدة الجدول «مصر/الإمارات/السعران/الحالة»؛ أزرار bulk: تمكين/تعطيل الإمارات + «نسخ سعر مصر ← الإمارات» (نسخ رقمي صريح بلا تحويل) |
| G3 | قسم الدول (CRUD عبر resource الموجود)؛ بطاقتا شحن (محافظات مصر 27 / إمارات UAE 7 + عتبة الشحن المجاني لكل بلد من `countries.shipping`)؛ واجهة نطاق بلد لكل وسيلة دفع (chk مصر/الإمارات → `config.countries`) |
| G4 | تسميات عربية صافية («متاح في مصر»، «السعر في مصر»، «عملة السعر: جنيه/درهم») + مُحدِّد بلد سياقي في ترويسة الإدارة |

## 10) هل يلزم migration؟

| الحالة | القرار |
|---|---|
| المنتجات/الدول/الدفع/المحافظات/الطلبات | **لا migration إطلاقاً** — كل الأعمدة موجودة (0020) والموارد العامة تعمل |
| categories / brands / banners / home_sections | **التصنيف المبدئي المُوصى: GLOBAL اليوم ومقصود** — لا أعمدة بلد، والمواصفات نفسها تحذّر «لا تجعل كل المحتوى بلدياً أعمى». رؤية كل بلد لهذه الكيانات تحتاج عموداً جديداً => **migration إضافية 0021 (ADD COLUMN …countries/visibility JSON)** — **قرار منتج ينتظر تأكيد المالك في Gate 3، لا يُنفَّذ الآن** |
> حتى إن اعتُمدت 0021: تكون additive تماماً، بقيمة افتراضية تُبقي سلوك مصر القائم حرفياً (compat). لم تُنشأ في Gate 0.

## 11) وظائف يجب ألا تُمَس / Must Remain Untouched

بالأدلة القائمة تُعتبر خضراء ولا تُفتح إلا عند إثبات علة:
- نواة التبديل (`countryFx/countryStore/client interceptor` + بوابات الخادم) — 93/93 + V1–V7.
- بوابات الطلبات/الشحن/الدفع/العملة في الخادم + اللقطات المالية.
- Service Worker وسياساته (معفى API).
- `/uploads/*` Cache-Control.
- الثيمات الثلاثة وأقسام الإدارة كلها وبياناتها — صفر مسّاح في Gate 0.

---

## ملحق: حالة المستودع بعد التدقيق
- `git status` = 0 تعديل، `git log` = `2d08320` رأساً. هذا الملف **غير مُدرج في أي commit** (قرار التوثيق يُترك لما بعد المصادقة على الخطة). كل سكربتات /tmp المؤقتة **حُذفت**.

# ⏹️ STOP — Gate 0 مكتمل. لا Gate 1 إلا بتوجيهك.
