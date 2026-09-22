-- ============================================================
-- FIX: Renomear variável local current_role para v_user_role
-- na função prevent_direct_stock_change para evitar conflito
-- com o identificador/função de sistema CURRENT_ROLE do PostgreSQL.
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_direct_stock_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_user_role != 'admin' THEN
    RAISE EXCEPTION 'Clientes não podem modificar estoque diretamente.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
