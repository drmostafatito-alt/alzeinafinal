-- 0015_page_cms.sql
-- Round 4 — Page Builder / CMS:
--  1) pages.data     — JSON حقل حر يخزّن أقسام الصفحة (sections/faqs) وغيرها من إعدادات CMS.
--  2) pages.showInFooter — هل تظهر الصفحة في روابط الفوتر (كان يُرسل من الواجهة ويُرفض من قاعدة البيانات).
-- لا نلمس أعمدة قائمة ولا بيانات قائمة — إضافة أعمدة فقط بافتراضات آمنة.
-- home_sections يحتاج لا شيء: عمود data موجود منذ البداية وسيصبح مخزن إعدادات
-- كل بلوك في بانى الصفحة (key/subtitle/source/layout/colors/... ).

ALTER TABLE pages ADD COLUMN data TEXT NOT NULL DEFAULT '{}';
ALTER TABLE pages ADD COLUMN showInFooter INTEGER NOT NULL DEFAULT 1;
