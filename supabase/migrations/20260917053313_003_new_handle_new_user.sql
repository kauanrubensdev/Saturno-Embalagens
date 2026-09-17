-- ============================================================
-- handle_new_user_v2: função nova com SET row_security = off
-- para bypassar a RLS ao criar profile automaticamente.
-- Trigger novo (v2) associado a auth.users.
-- A função/trigger originais permanecem intocados.
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user_v2()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  INSERT INTO profiles (id, name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'phone',
    'customer'
  );
  RETURN NEW;
END;
$$;

-- Remove trigger antigo (se existir) e associa o novo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created_v2
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_v2();
