-- ============================================================
-- MIGRATION: Infraestrutura de E-mails Transacionais (Resend + Supabase)
-- Data: 2026-11-21
-- Descrição:
--   1. Adiciona coluna customer_email na tabela public.orders
--   2. Cria tabela public.order_email_queue para controle e idempotência
--   3. Configura CHECK constraints para email_type, status e tentativas
--   4. Cria constraint UNIQUE (order_id, email_type)
--   5. Cria índices para performance de busca e polling
--   6. Configura trigger de updated_at automático
--   7. Configura RLS com políticas restritivas
-- ============================================================

-- 1. Coluna customer_email na tabela public.orders (idempotente)
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS customer_email TEXT NULL;

COMMENT ON COLUMN public.orders.customer_email IS 'E-mail do cliente registrado no momento da criação do pedido';

-- 2. Tabela public.order_email_queue
CREATE TABLE IF NOT EXISTS public.order_email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  error_message TEXT NULL,
  resend_id TEXT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ NULL,

  -- CHECK constraints
  CONSTRAINT order_email_queue_email_type_check CHECK (
    email_type IN (
      'order_created',
      'payment_approved',
      'preparing',
      'ready_for_pickup',
      'shipped',
      'delivered',
      'cancelled'
    )
  ),
  CONSTRAINT order_email_queue_status_check CHECK (
    status IN (
      'pending',
      'processing',
      'sent',
      'failed',
      'skipped'
    )
  ),
  CONSTRAINT order_email_queue_attempts_check CHECK (
    attempts >= 0
  ),
  CONSTRAINT order_email_queue_max_attempts_check CHECK (
    max_attempts > 0
  ),

  -- Constraint de idempotência: apenas 1 e-mail de cada tipo por pedido
  CONSTRAINT order_email_queue_order_id_email_type_key UNIQUE (
    order_id,
    email_type
  )
);

-- 3. Índices para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_order_email_queue_order_id
  ON public.order_email_queue (order_id);

CREATE INDEX IF NOT EXISTS idx_order_email_queue_status
  ON public.order_email_queue (status);

CREATE INDEX IF NOT EXISTS idx_order_email_queue_created_at
  ON public.order_email_queue (created_at);

CREATE INDEX IF NOT EXISTS idx_order_email_queue_email_type
  ON public.order_email_queue (email_type);

CREATE INDEX IF NOT EXISTS idx_order_email_queue_pending
  ON public.order_email_queue (status, created_at)
  WHERE status = 'pending';

-- 4. Trigger para updated_at automático
DROP TRIGGER IF EXISTS set_order_email_queue_updated_at ON public.order_email_queue;
CREATE TRIGGER set_order_email_queue_updated_at
  BEFORE UPDATE ON public.order_email_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 5. Row Level Security (RLS)
ALTER TABLE public.order_email_queue ENABLE ROW LEVEL SECURITY;

-- Remove políticas anteriores caso existam
DROP POLICY IF EXISTS "Admins podem visualizar toda a fila de emails" ON public.order_email_queue;
DROP POLICY IF EXISTS "Clientes podem visualizar emails de seus proprios pedidos" ON public.order_email_queue;

-- Política de leitura: exclusivamente administradores
CREATE POLICY "Admins podem visualizar toda a fila de emails"
  ON public.order_email_queue FOR SELECT
  USING (public.is_admin());

-- Permissões explícitas:
-- anon não tem acesso algum
REVOKE ALL ON public.order_email_queue FROM anon;

-- authenticated só pode ler se for admin via política RLS acima (sem INSERT, UPDATE, DELETE direto)
REVOKE INSERT, UPDATE, DELETE ON public.order_email_queue FROM authenticated;
GRANT SELECT ON public.order_email_queue TO authenticated;

-- Service role possui bypass de RLS nativo e permissões completas para as Edge Functions

-- Notifica o PostgREST para recarregar o schema cache
NOTIFY pgrst, 'reload schema';
