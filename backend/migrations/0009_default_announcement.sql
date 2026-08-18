UPDATE settings SET value = json_set(value, '$.announcement.enabled', json('true'))
WHERE key='site' AND json_extract(value,'$.announcement.enabled') IS NULL;
UPDATE settings SET value = json_set(value, '$.announcement.items', json('[{"text":"شحن مجاني للطلبات فوق 1000 جنيه","textEn":"Free shipping over 1000 EGP","icon":"🚚","enabled":true},{"text":"خصم 20% لفترة محدودة","textEn":"20% off for a limited time","icon":"✨","enabled":true},{"text":"الدفع عند الاستلام متاح","textEn":"Cash on delivery available","icon":"💳","enabled":true}]'), '$.announcement.speed', json('"normal"'), '$.announcement.direction', json('"rtl"'))
WHERE key='site' AND (json_extract(value,'$.announcement.items') IS NULL OR json_array_length(json_extract(value,'$.announcement.items'))=0);
