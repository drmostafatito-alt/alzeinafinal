-- Production guard against overselling during concurrent order creation.
-- D1/Workers do not expose SELECT ... FOR UPDATE, so a trigger enforces non-negative stock.
CREATE TRIGGER IF NOT EXISTS products_stock_nonnegative_update
BEFORE UPDATE OF stock ON products
FOR EACH ROW
WHEN NEW.stock < 0
BEGIN
  SELECT RAISE(ABORT, 'INSUFFICIENT_STOCK');
END;
