-- ============================================================
-- MIGRATION: Estrutura de Pagamentos e RPC para Atualização de Status de Pagamento
-- Suporta:
-- Métodos: pix, credit_card, cash_on_delivery
-- Status: pending, paid, failed, cancelled, refunded
-- ============================================================

-- 1. Atualizar constraint de payment_status para incluir 'cancelled'
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check 
  CHECK (payment_status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded'));

-- 2. Garantir constraint de payment_method (pix, credit_card, cash_on_delivery)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check 
  CHECK (payment_method IS NULL OR payment_method IN ('pix', 'credit_card', 'cash_on_delivery'));

-- 3. RPC segura para o Admin atualizar payment_status
CREATE OR REPLACE FUNCTION public.admin_update_payment_status(
  p_order_id UUID,
  p_new_payment_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_status TEXT;
BEGIN
  -- 1. Validar que o usuário é administrador
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar o status de pagamento.';
  END IF;

  -- 2. Validar que o status é permitido
  IF p_new_payment_status NOT IN ('pending', 'paid', 'failed', 'cancelled', 'refunded') THEN
    RAISE EXCEPTION 'Status de pagamento inválido: %', p_new_payment_status;
  END IF;

  -- 3. Atualizar o pedido
  UPDATE public.orders
  SET payment_status = p_new_payment_status,
      updated_at = NOW()
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido com ID % não foi encontrado.', p_order_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Status de pagamento atualizado com sucesso.',
    'payment_status', p_new_payment_status
  );
END;
$$;

-- Notificar PostgREST para recarregar o schema cache
NOTIFY pgrst, 'reload schema';
