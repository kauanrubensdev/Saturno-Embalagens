-- ============================================================
-- MIGRATION: Decremento Seguro de Estoque no Checkout (RPC)
-- 1. Remove a policy permissiva que permitia UPDATE direto de clientes em public.products
-- 2. Restringe o trigger prevent_direct_stock_change() estritamente para administradores
-- 3. Cria a RPC atômica, idempotente e segura decrement_checkout_stock() para uso no checkout
-- 4. Define permissões restritas (REVOKE PUBLIC, GRANT authenticated)
-- ============================================================

-- 1. Remover policy permissiva de UPDATE direto para clientes em products
DROP POLICY IF EXISTS "Clientes reduzem estoque na compra" ON public.products;

-- 2. Restringir prevent_direct_stock_change() para permitir UPDATE direto SOMENTE para administradores
CREATE OR REPLACE FUNCTION public.prevent_direct_stock_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = auth.uid();

  -- Apenas administradores podem modificar a tabela products diretamente
  IF v_user_role != 'admin' THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem modificar produtos e estoque diretamente.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 3. Criar a RPC segura e idempotente decrement_checkout_stock
CREATE OR REPLACE FUNCTION public.decrement_checkout_stock(
  p_product_id UUID,
  p_quantity INTEGER,
  p_order_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_stock INTEGER;
  v_is_active BOOLEAN;
  v_caller_id UUID;
  v_new_stock INTEGER;
  v_reason TEXT;
BEGIN
  -- 1. Validar usuário autenticado
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado: usuário não autenticado.';
  END IF;

  -- 2. Validar quantidade
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida: deve ser um número inteiro maior que zero.';
  END IF;

  -- 3. Localizar o produto com bloqueio exclusivo de linha (FOR UPDATE) contra concorrência
  SELECT stock_quantity, is_active
  INTO v_current_stock, v_is_active
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  -- 4. Verificar se o produto existe
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto com ID % não foi encontrado.', p_product_id;
  END IF;

  -- 5. Verificar se o produto está ativo
  IF NOT v_is_active THEN
    RAISE EXCEPTION 'O produto selecionado está inativo e não pode ser comprado.';
  END IF;

  -- 6. Idempotência: verificar se já existe saída registrada para este mesmo pedido e produto
  IF p_order_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.stock_movements
      WHERE reference = p_order_id::TEXT
        AND product_id = p_product_id
        AND movement_type = 'out'
    ) THEN
      RETURN jsonb_build_object(
        'success', true,
        'already_decremented', true,
        'product_id', p_product_id,
        'current_stock', v_current_stock
      );
    END IF;
  END IF;

  -- 7. Verificar estoque suficiente
  IF v_current_stock < p_quantity THEN
    RAISE EXCEPTION 'Estoque insuficiente para o produto. Disponível: %, Solicitado: %.', v_current_stock, p_quantity;
  END IF;

  -- 8. Decrementar SOMENTE stock_quantity e updated_at
  v_new_stock := v_current_stock - p_quantity;

  UPDATE public.products
  SET stock_quantity = v_new_stock,
      updated_at = NOW()
  WHERE id = p_product_id;

  -- 9. Registrar movimentação em stock_movements
  IF p_order_id IS NOT NULL THEN
    v_reason := 'Pedido #' || UPPER(SUBSTRING(p_order_id::TEXT FROM 1 FOR 8));
  ELSE
    v_reason := 'Venda / Checkout';
  END IF;

  INSERT INTO public.stock_movements (
    product_id,
    quantity,
    movement_type,
    reason,
    reference,
    performed_by
  ) VALUES (
    p_product_id,
    p_quantity,
    'out',
    v_reason,
    CASE WHEN p_order_id IS NOT NULL THEN p_order_id::TEXT ELSE NULL END,
    v_caller_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_decremented', false,
    'product_id', p_product_id,
    'previous_stock', v_current_stock,
    'quantity_decremented', p_quantity,
    'new_stock', v_new_stock
  );
END;
$$;

-- 4. Definir permissões estritas da RPC
REVOKE ALL ON FUNCTION public.decrement_checkout_stock(UUID, INTEGER, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrement_checkout_stock(UUID, INTEGER, UUID) TO authenticated;

-- 5. Notificar PostgREST para recarregar o schema cache
NOTIFY pgrst, 'reload schema';
