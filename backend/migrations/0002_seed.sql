-- Seed data. Password hash below is PBKDF2-SHA256 for "Admin@123456".
-- Replace immediately in production by changing the admin password after first login.
INSERT OR IGNORE INTO users(id,name,email,passwordHash,role,staffRole,isActive,authProvider,sessionsValidFrom,lastActivityAt,createdAt,updatedAt)
VALUES ('00000000-0000-0000-0000-000000000001','Super Admin','admin@alzeina.com','pbkdf2-sha256$210000$WsLG_Fd2YD-4gcRAGsvNDA$1gjvOrSbFx-RkOiE1Q6YqMXwh2nxDCXY2NE_A7uThW4','admin','super-admin',1,'local','2024-01-01T00:00:00.000Z','2024-01-01T00:00:00.000Z','2024-01-01T00:00:00.000Z','2024-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO categories(id,name,nameEn,slug,isActive,sortOrder,createdAt,updatedAt,keywords) VALUES
('cat-skincare','العناية بالبشرة','Skincare','skincare',1,1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z','[]'),
('cat-makeup','المكياج','Makeup','makeup',1,2,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z','[]'),
('cat-perfume','العطور','Perfume','perfume',1,3,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z','[]');

INSERT OR IGNORE INTO brands(id,name,nameEn,slug,isActive,sortOrder,createdAt,updatedAt,keywords) VALUES
('brand-azeina','الزينة','AL-ZEINA','al-zeina',1,1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z','[]');

INSERT OR IGNORE INTO products(id,name,nameEn,slug,sku,description,category,brand,price,oldPrice,cost,stock,mainImage,images,variants,colors,sizes,tags,isFeatured,isBestSeller,isNewArrival,isActive,status,createdAt,updatedAt) VALUES
('prod-demo-1','كريم ترطيب فاخر','Luxury Moisturizer','luxury-moisturizer','AZ-MOIST-1','كريم ترطيب للبشرة الجافة','cat-skincare','brand-azeina',299,399,140,25,'','[]','[]','[]','[]','["skincare"]',1,1,1,1,'published','2024-01-01T00:00:00Z','2024-01-01T00:00:00Z');

INSERT OR IGNORE INTO payment_methods(id,code,name,nameEn,description,isActive,isVisible,requiresProof,requiresReference,feeType,feeValue,sortOrder,createdAt,updatedAt,config) VALUES
('pm-cod','cod','الدفع عند الاستلام','Cash on Delivery','ادفع نقداً عند الاستلام',1,1,0,0,'fixed',0,1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z','{}'),
('pm-instapay','instapay','إنستاباي','InstaPay','تحويل عبر إنستاباي مع رفع الإيصال',1,1,1,1,'percentage',0,2,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z','{}'),
('pm-vodafone','vodafone-cash','فودافون كاش','Vodafone Cash','تحويل فودافون كاش مع رفع الإيصال',1,1,1,1,'fixed',0,3,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z','{}');

INSERT OR IGNORE INTO governorates(id,code,name,nameEn,isActive,sortOrder,createdAt,updatedAt) VALUES
('gov-cairo','CAI','القاهرة','Cairo',1,1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z'),
('gov-giza','GIZ','الجيزة','Giza',1,2,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z'),
('gov-alx','ALX','الإسكندرية','Alexandria',1,3,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z');

INSERT OR IGNORE INTO coupons(id,code,description,discountType,discountValue,freeShipping,minOrderAmount,startDate,endDate,usageLimit,perUserLimit,userIds,categories,brands,products,excludedProducts,isActive,createdAt,updatedAt) VALUES
('welcome10','WELCOME10','خصم ترحيبي 10%','percentage',10,0,200,'2024-01-01T00:00:00Z','2030-12-31T23:59:59Z',1000,1,'[]','[]','[]','[]','[]',1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z');

INSERT OR IGNORE INTO pages(id,title,titleEn,slug,content,contentEn,status,isActive,sortOrder,createdAt,updatedAt) VALUES
('page-about','من نحن','About','about','<p>AL-ZEINA beauty store</p>','<p>AL-ZEINA beauty store</p>','published',1,1,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z'),
('page-policy','سياسة الخصوصية','Privacy Policy','privacy-policy','<p>Privacy policy</p>','<p>Privacy policy</p>','published',1,2,'2024-01-01T00:00:00Z','2024-01-01T00:00:00Z');
