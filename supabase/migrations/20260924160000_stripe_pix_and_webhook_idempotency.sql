-- ============================================================
-- MIGRATION: Suporte a PIX via Stripe e Idempotência de Webhook
-- Adiciona colunas para dados do PIX e tabela para registro de eventos Stripe
-- ============================================================

-- 1. Adicionar colunas de dados PIX na tabela orders (se não existirem)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'pix_qr_code_url'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN pix_qr_code_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'pix_copy_paste'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN pix_copy_paste TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'pix_expires_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN pix_expires_at TIMESTAMPTZ;
  END IF;
END $$;

-- 2. Tabela para registro idempotente de eventos de webhook do Stripe
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id TEXT PRIMARY KEY, -- Stripe Event ID (ex: evt_1234567890)
  event_type TEXT NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS em stripe_webhook_events
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ler o log de eventos do Stripe
DROP POLICY IF EXISTS "Admin lê webhook events" ON public.stripe_webhook_events;
CREATE POLICY "Admin lê webhook events"
  ON public.stripe_webhook_events FOR SELECT
  USING (public.is_admin());

-- 3. RPC Atômica para confirmar pagamento via Webhook com proteção estrita contra duplicidade
CREATE OR REPLACE FUNCTION public.confirm_stripe_payment(
  p_order_id UUID,
  p_payment_intent_id TEXT,
  p_event_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_payment_status TEXT;
  v_already_processed BOOLEAN;
BEGIN
  -- 1. Verificar se o evento do Stripe já foi processado anteriormente (idempotência)
  SELECT EXISTS (
    SELECT 1 FROM public.stripe_webhook_events
    WHERE id = p_event_id
  ) INTO v_already_processed;

  IF v_already_processed THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'message', 'Evento do Stripe já processado anteriormente.'
    );
  END IF;

  -- 2. Bloquear a linha do pedido (FOR UPDATE)
  SELECT payment_status INTO v_current_payment_status
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido com ID % não foi encontrado.', p_order_id;
  END IF;

  -- 3. Atualizar o status do pagamento para 'paid'
  UPDATE public.orders
  SET payment_status = 'paid',
      stripe_payment_intent_id = COALESCE(p_payment_intent_id, stripe_payment_intent_id),
      updated_at = NOW()
  WHERE id = p_order_id;

  -- 4. Registrar o evento do Stripe para garantir idempotência futura
  INSERT INTO public.stripe_webhook_events (
    id,
    event_type,
    order_id,
    payload
  ) VALUES (
    p_event_id,
    'payment_intent.succeeded',
    p_order_id,
    jsonb_build_object('payment_intent_id', p_payment_intent_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_processed', false,
    'message', 'Pagamento confirmado com sucesso.',
    'order_id', p_order_id,
    'payment_status', 'paid'
  );
END;
$$;

-- Notificar PostgREST para recarregar o schema cache
NOTIFY pgrst, 'reload schema';
