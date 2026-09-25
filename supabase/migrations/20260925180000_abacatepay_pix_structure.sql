-- ============================================================
-- MIGRATION: Estrutura para Integração AbacatePay PIX
-- Etapa 1: Banco de dados e idempotência de webhook
-- ============================================================

-- 1. Atualizar constraint de payment_method na tabela orders
--    Preserva todos os métodos existentes:
--    - pix, credit_card, cash_on_delivery, stripe_online
--    Adiciona o novo método:
--    - abacate_pix
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check
  CHECK (
    payment_method IS NULL OR
    payment_method IN ('pix', 'credit_card', 'cash_on_delivery', 'stripe_online', 'abacate_pix')
  );

-- 2. Adicionar colunas específicas para cobrança PIX da AbacatePay em public.orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'abacate_pix_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN abacate_pix_id TEXT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'abacate_pix_br_code'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN abacate_pix_br_code TEXT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'abacate_pix_qr_code'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN abacate_pix_qr_code TEXT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'abacate_pix_expires_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN abacate_pix_expires_at TIMESTAMPTZ NULL;
  END IF;
END $$;

-- 3. Criar índice para busca rápida por abacate_pix_id (consultas de webhook e reconciliação)
CREATE INDEX IF NOT EXISTS orders_abacate_pix_id_idx ON public.orders(abacate_pix_id);

-- 4. Tabela para registro idempotente de eventos de webhook da AbacatePay
CREATE TABLE IF NOT EXISTS public.abacatepay_webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  order_id UUID NULL REFERENCES public.orders(id) ON DELETE SET NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Índice para order_id na tabela de eventos de webhook
CREATE INDEX IF NOT EXISTS abacatepay_webhook_events_order_id_idx ON public.abacatepay_webhook_events(order_id);

-- 6. Configurar RLS em abacatepay_webhook_events
--    - RLS ativado: nenhum usuário anônimo ou cliente autenticado comum possui acesso de leitura ou escrita
--    - Apenas administradores podem ler registros para auditoria via painel/queries autenticadas
--    - Inserções/processamento serão realizados com service_role_key nas Edge Functions
ALTER TABLE public.abacatepay_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin lê webhook events abacatepay" ON public.abacatepay_webhook_events;
CREATE POLICY "Admin lê webhook events abacatepay"
  ON public.abacatepay_webhook_events FOR SELECT
  USING (public.is_admin());

-- 7. Notificar PostgREST para recarregar o schema cache
NOTIFY pgrst, 'reload schema';
