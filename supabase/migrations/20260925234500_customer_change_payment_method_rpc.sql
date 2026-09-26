-- ============================================================
-- MIGRATION: RPC para Troca Segura de Forma de Pagamento pelo Cliente
-- 1. Permite que o cliente autenticado altere SOMENTE a forma de pagamento (payment_method)
--    de um pedido próprio que esteja com status = 'pending' e payment_status != 'paid'.
-- 2. Não permite alterar user_id, status, payment_status, total, itens, estoque ou endereços.
-- 3. Utiliza SECURITY DEFINER com search_path seguro e bloqueio FOR UPDATE.
-- 4. Revoga execução pública e concede exclusivamente para 'authenticated'.
-- ============================================================

CREATE OR REPLACE FUNCTION public.customer_change_pending_payment_method(
  p_order_id UUID,
  p_payment_method TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_order_user_id UUID;
  v_order_status TEXT;
  v_order_payment_status TEXT;
BEGIN
  -- 1. Validar usuário autenticado
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado: usuário não autenticado.';
  END IF;

  -- 2. Validar método de pagamento permitido no projeto
  IF p_payment_method IS NULL OR p_payment_method NOT IN ('pix', 'credit_card', 'cash_on_delivery', 'stripe_online', 'abacate_pix') THEN
    RAISE EXCEPTION 'Método de pagamento inválido: %', p_payment_method;
  END IF;

  -- 3. Localizar o pedido com bloqueio exclusivo de linha (FOR UPDATE)
  SELECT user_id, status, payment_status
  INTO v_order_user_id, v_order_status, v_order_payment_status
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  -- 4. Verificar se o pedido existe
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido com ID % não foi encontrado.', p_order_id;
  END IF;

  -- 5. Verificar se o pedido pertence ao usuário autenticado
  IF v_order_user_id != v_caller_id THEN
    RAISE EXCEPTION 'Acesso negado: o pedido não pertence ao usuário autenticado.';
  END IF;

  -- 6. Garantir que o pedido ainda esteja em status 'pending'
  IF v_order_status != 'pending' THEN
    RAISE EXCEPTION 'Não é possível alterar a forma de pagamento de um pedido com status %.', v_order_status;
  END IF;

  -- 7. Garantir que o pagamento não esteja concluído, cancelado ou reembolsado
  IF v_order_payment_status = 'paid' THEN
    RAISE EXCEPTION 'Este pedido já está pago e não pode ter a forma de pagamento alterada.';
  END IF;

  IF v_order_payment_status IN ('cancelled', 'refunded') THEN
    RAISE EXCEPTION 'Não é possível alterar a forma de pagamento de um pedido cancelado ou reembolsado.';
  END IF;

  -- 8. Atualizar ESTRITAMENTE o payment_method e updated_at
  UPDATE public.orders
  SET payment_method = p_payment_method,
      updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Forma de pagamento atualizada com sucesso.',
    'order_id', p_order_id,
    'payment_method', p_payment_method
  );
END;
$$;

-- 5. Proteger permissões de execução da RPC
REVOKE ALL ON FUNCTION public.customer_change_pending_payment_method(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_change_pending_payment_method(UUID, TEXT) TO authenticated;

-- 6. Notificar PostgREST para recarregar o schema cache
NOTIFY pgrst, 'reload schema';
