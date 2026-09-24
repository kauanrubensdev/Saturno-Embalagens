-- ============================================================
-- MIGRATION: Checkout RLS & Stock Update Policies
-- Permite que clientes autenticados insiram itens de seus próprios pedidos
-- e reduzam estoque na finalização de compra (sem estoque negativo).
-- ============================================================

-- 1. Permitir que clientes e admins insiram itens dos seus próprios pedidos
DROP POLICY IF EXISTS "Admin insere itens" ON public.order_items;
DROP POLICY IF EXISTS "Clientes e admins inserem itens de pedidos" ON public.order_items;

CREATE POLICY "Clientes e admins inserem itens de pedidos"
  ON public.order_items FOR INSERT
  WITH CHECK (
    public.is_admin() OR 
    public.is_owner(public.get_order_user(order_id))
  );

-- 2. Permitir que clientes e admins registrem movimentações de estoque na compra
DROP POLICY IF EXISTS "Clientes e admins registram stock_movements" ON public.stock_movements;

CREATE POLICY "Clientes e admins registram stock_movements"
  ON public.stock_movements FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- 3. Permitir que clientes atualizem produtos (apenas redução de estoque controlada)
DROP POLICY IF EXISTS "Clientes reduzem estoque na compra" ON public.products;

CREATE POLICY "Clientes reduzem estoque na compra"
  ON public.products FOR UPDATE
  USING (is_active = true)
  WITH CHECK (is_active = true);

-- 4. Atualizar trigger prevent_direct_stock_change para permitir decremento de estoque
CREATE OR REPLACE FUNCTION public.prevent_direct_stock_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = auth.uid();

  -- Se for admin, permite qualquer alteração
  IF v_user_role = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Se for cliente/usuário autenticado, só permite redução de estoque não-negativa
  IF NEW.stock_quantity < OLD.stock_quantity AND NEW.stock_quantity >= 0 THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Clientes não podem modificar estoque diretamente.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
