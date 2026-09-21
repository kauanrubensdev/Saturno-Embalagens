-- ============================================================
-- Correção do trigger cart_touch_on_item_change para suportar DELETE
-- Em operações DELETE, NEW é NULL no PostgreSQL, portanto usamos OLD.cart_id.
-- ============================================================

CREATE OR REPLACE FUNCTION cart_touch_on_item_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE cart SET updated_at = NOW() WHERE id = OLD.cart_id;
    RETURN OLD;
  ELSE
    UPDATE cart SET updated_at = NOW() WHERE id = NEW.cart_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;
