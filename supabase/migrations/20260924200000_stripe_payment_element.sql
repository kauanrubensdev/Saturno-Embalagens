-- ============================================================
-- MIGRATION: Integração Stripe Payment Element
-- Adiciona 'stripe_online' como método de pagamento válido
-- As colunas PIX são preservadas para reativação futura
-- ============================================================

-- 1. Atualizar constraint de payment_method para incluir 'stripe_online'
--    Mantém: pix, credit_card, cash_on_delivery (legado)
--    Adiciona: stripe_online (novo método unificado via Payment Element)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check
  CHECK (
    payment_method IS NULL OR
    payment_method IN ('pix', 'credit_card', 'cash_on_delivery', 'stripe_online')
  );

-- Notificar PostgREST para recarregar o schema cache
NOTIFY pgrst, 'reload schema';
