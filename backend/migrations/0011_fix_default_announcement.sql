-- إصلاح migration 0009: كانت تستهدف key='site' بينما نظام الإعدادات يخزن
-- كل مجموعة تحت مفتاحها الخاص (theme / announcement / ...)، فلم تُفعَّل
-- رسائل الشريط الافتراضية أبداً. INSERT OR IGNORE = آمنة للتكرار ولا تمس
-- أي إعدادات كتبها المدير لاحقاً.
INSERT OR IGNORE INTO settings(key, value, groupName, updatedAt) VALUES (
  'announcement',
  '{"enabled":true,"speed":"normal","direction":"auto","dismissible":true,"items":[{"text":"شحن مجاني للطلبات فوق 500 جنيه","textEn":"Free shipping over 500 EGP","icon":"🚚","enabled":true},{"text":"منتجات أصلية 100%","textEn":"100% authentic products","icon":"✨","enabled":true},{"text":"الدفع عند الاستلام متاح","textEn":"Cash on delivery available","icon":"💳","enabled":true}]}',
  'general',
  '2024-01-01T00:00:00Z'
);
