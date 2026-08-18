-- 0016_manual_payments.sql
-- Round 5 — Manual Payment Verification (InstaPay / Vodafone Cash / Etisalat Cash / Orange Cash / Meeza)
--
-- 1) جدول تتبع مراجعات الدفع اليدوي: كل إيصال رُفع = صف مستقل،
--    فيدعم إعادة الرفع بعد الرفض مع تاريخ كامل دون فقدان القديم.
--    orders.paymentVerification (JSON) يبقى محدَّثاً كنسخة ملخص للتوافق.
-- 2) بذر وسائل الدفع الجديدة ببيانات افتراضية آمنة — أرقام الحسابات/المحافظ
--    تُدخل من لوحة الإدارة حصراً (config JSON) ولا توجد هنا.

CREATE TABLE IF NOT EXISTS payment_verifications (
  id TEXT PRIMARY KEY,
  orderId TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  userId TEXT,
  paymentMethodId TEXT,
  paymentMethodCode TEXT,
  amount REAL NOT NULL DEFAULT 0,
  receiptKey TEXT,
  receiptMimeType TEXT,
  receiptSize INTEGER,
  receiptUrl TEXT,
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  customerNote TEXT,
  adminNote TEXT,
  reviewedAt TEXT,
  reviewedBy TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pv_order ON payment_verifications(orderId);
CREATE INDEX IF NOT EXISTS idx_pv_status ON payment_verifications(status, createdAt);

-- وسائل دفع جديدة (idempotent). أرقام المحافظ/الحسابات تُدار من Admin ← Payments.
-- ملاحظة: عمود الوصف موجود باسم description فقط (لا يوجد descriptionEn في هذا الجدول).
INSERT OR IGNORE INTO payment_methods(id, code, name, nameEn, description, instructions, logo, type, isActive, isVisible, requiresProof, requiresReference, feeType, feeValue, sortOrder, config, createdAt, updatedAt) VALUES
('pm-etisalat', 'etisalat-cash', 'إتصالات كاش', 'Etisalat Cash',
 'الدفع عبر محفظة إتصالات كاش',
 'حوّلي المبلغ إلى رقم محفظة إتصالات كاش الموضح، ثم ارفعي صورة الإيصال لإتمام الطلب.',
 '', 'manual', 1, 1, 1, 0, 'fixed', 0, 4, '{}', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
('pm-orange', 'orange-cash', 'أورنج كاش', 'Orange Cash',
 'الدفع عبر محفظة أورنج كاش',
 'حوّلي المبلغ إلى رقم محفظة أورنج كاش الموضح، ثم ارفعي صورة الإيصال لإتمام الطلب.',
 '', 'manual', 1, 1, 1, 0, 'fixed', 0, 5, '{}', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
('pm-meeza', 'meeza', 'ميزة', 'Meeza',
 'الدفع عبر بطاقة ميزة أو تطبيق ميزة',
 'حوّلي المبلغ إلى رقم ميزة الموضح، ثم ارفعي صورة الإيصال لإتمام الطلب.',
 '', 'manual', 1, 1, 1, 0, 'fixed', 0, 6, '{}', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z');
