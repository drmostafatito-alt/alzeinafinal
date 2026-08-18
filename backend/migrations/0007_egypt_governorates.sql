ALTER TABLE governorates ADD COLUMN shippingCost REAL NOT NULL DEFAULT 50;
ALTER TABLE governorates ADD COLUMN codEnabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE governorates ADD COLUMN zoneId TEXT REFERENCES shipping_zones(id) ON DELETE SET NULL;

INSERT OR IGNORE INTO governorates(id,code,name,nameEn,isActive,sortOrder,shippingCost,codEnabled,createdAt,updatedAt) VALUES
('gov-cairo','CAI','القاهرة','Cairo',1,1,50,1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z'),
('gov-giza','GIZ','الجيزة','Giza',1,2,55,1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z'),
('gov-alexandria','ALX','الإسكندرية','Alexandria',1,3,65,1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z'),
('gov-dakahlia','DKH','الدقهلية','Dakahlia',1,4,75,1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z'),
('gov-red-sea','RS','البحر الأحمر','Red Sea',1,5,90,1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z'),
('gov-beheira','BH','البحيرة','Beheira',1,6,75,1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z'),
('gov-faiyum','FYM','الفيوم','Faiyum',1,7,70,1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z'),
('gov-gharbia','GH','الغربية','Gharbia',1,8,75,1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z'),
('gov-ismailia','IS','الإسماعيلية','Ismailia',1,9,75,1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z'),
('gov-monufia','MNF','المنوفية','Monufia',1,10,75,1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z'),
('gov-minya','MN','المنيا','Minya',1,11,85,1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z'),
('gov-qalyubia','KB','القليوبية','Qalyubia',1,12,65,1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z'),
('gov-new-valley','WAD','الوادي الجديد','New Valley',1,13,100,1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z'),
('gov-suez','SUZ','السويس','Suez',1,14,70,1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z'),
('gov-aswan','ASN','أسوان','Aswan',1,15,100,1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z'),
('gov-assiut','AST','أسيوط','Assiut',1,16,90,1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z'),
('gov-beni-suef','BNS','بني سويف','Beni Suef',1,17,80,1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z'),
('gov-port-said','PTS','بورسعيد','Port Said',1,18,70,1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z'),
('gov-damietta','DMT','دمياط','Damietta',1,19,75,1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z'),
('gov-sharqia','SHR','الشرقية','Sharqia',1,20,75,1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z'),
('gov-south-sinai','JS','جنوب سيناء','South Sinai',1,21,95,1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z'),
('gov-kafr-el-sheikh','KFS','كفر الشيخ','Kafr El Sheikh',1,22,80,1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z'),
('gov-matrouh','MTR','مطروح','Matrouh',1,23,100,1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z'),
('gov-luxor','LX','الأقصر','Luxor',1,24,95,1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z'),
('gov-qena','QN','قنا','Qena',1,25,95,1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z'),
('gov-north-sinai','SIN','شمال سيناء','North Sinai',1,26,95,1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z'),
('gov-sohag','SHG','سوهاج','Sohag',1,27,90,1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z');

UPDATE governorates SET code='CAI', sortOrder=1 WHERE id='gov-cairo';
UPDATE governorates SET code='GIZ', sortOrder=2 WHERE id='gov-giza';
UPDATE governorates SET code='ALX', sortOrder=3 WHERE id='gov-alexandria';
