-- إضافة أعمدة الترجمة الإنجليزية لجدول البانرات.
-- ملاحظة إصلاح: كانت النسخة السابقة تعيد إضافة subtitle وbuttonText
-- الموجودين أصلاً في 0001_init.sql، فتفشل الـ migration بالكامل على أي
-- قاعدة جديدة بـ "duplicate column name" — نضيف الأعمدة الجديدة فقط.
ALTER TABLE banners ADD COLUMN titleEn TEXT NOT NULL DEFAULT '';
ALTER TABLE banners ADD COLUMN subtitleEn TEXT NOT NULL DEFAULT '';
ALTER TABLE banners ADD COLUMN buttonTextEn TEXT NOT NULL DEFAULT '';
