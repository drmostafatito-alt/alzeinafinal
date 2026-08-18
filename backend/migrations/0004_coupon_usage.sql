CREATE TABLE IF NOT EXISTS coupon_users (
  couponId TEXT NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  orderId TEXT REFERENCES orders(id) ON DELETE SET NULL,
  createdAt TEXT NOT NULL,
  PRIMARY KEY (couponId, userId, orderId)
);
CREATE INDEX IF NOT EXISTS idx_coupon_users_coupon ON coupon_users(couponId);
CREATE INDEX IF NOT EXISTS idx_coupon_users_user ON coupon_users(userId);
