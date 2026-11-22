-- ============================================================
-- MIGRATION: RPCs Seguras para Enfileiramento de order_created
-- Data: 2026-11-21
-- Arquitetura em 3 Níveis:
--   1. public.internal_enqueue_order_created(p_order_id UUID, p_enqueued_by TEXT):
--      Função central interna com a lógica de negócio e inserção na fila.
--      NÃO exposta para clientes (permissões revogadas de authenticated e anon).
--      Utilizada pelo SQL Editor do Supabase e chamada internamente pelas RPCs públicas.
--
--   2. public.customer_enqueue_order_created(p_order_id UUID):
--      RPC exposta para o checkout web. Exige auth.uid() e valida estritamente
--      a propriedade do pedido com IS DISTINCT FROM (ou perfil admin).
--
--   3. public.admin_enqueue_order_created(p_order_id UUID):
--      RPC exposta para a interface administrativa (Painel Admin).
--      Exige auth.uid() e validação confiável de public.is_admin().
-- ============================================================

-- ------------------------------------------------------------
-- 1. Função Central Interna (SQL Editor / Background / RPCs)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.internal_enqueue_order_created(
  p_order_id UUID,
  p_enqueued_by TEXT DEFAULT 'internal_system'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order RECORD;
  v_items_count INTEGER;
  v_recipient_email TEXT;
  v_email_regex CONSTANT TEXT := '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$';
  v_enqueued_id UUID;
  v_existing_queue RECORD;
BEGIN
  -- 1. Validação estrita dos valores permitidos para p_enqueued_by
  IF p_enqueued_by IS NULL OR p_enqueued_by NOT IN (
    'customer_checkout',
    'admin_ui',
    'sql_editor_recovery',
    'batch_sql_recovery',
    'internal_system'
  ) THEN
    RAISE EXCEPTION 'Origem de enfileiramento inválida: %', p_enqueued_by;
  END IF;

  -- 2. Validação do pedido
  SELECT id, user_id, status, payment_status, customer_email, created_at
    INTO v_order
    FROM public.orders
   WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido informado (%) não encontrado.', p_order_id;
  END IF;

  -- 3. Validação de estado do pedido:
  -- Impede envio de confirmação de criação para pedidos cancelados ou já entregues
  IF v_order.status IN ('cancelled', 'delivered') THEN
    RAISE EXCEPTION 'Estado do pedido (%) incompatível para envio de confirmação de criação.', v_order.status;
  END IF;

  -- 4. Validação de integridade: exige que o pedido possua itens gravados
  SELECT COUNT(*)
    INTO v_items_count
    FROM public.order_items
   WHERE order_id = p_order_id;

  IF v_items_count = 0 THEN
    RAISE EXCEPTION 'Inconsistência de dados: o pedido % não possui itens registrados em order_items.', p_order_id;
  END IF;

  -- 5. Resolução padronizada do destinatário
  -- Prioridade 1: orders.customer_email
  IF v_order.customer_email IS NOT NULL AND btrim(v_order.customer_email) != '' THEN
    IF btrim(v_order.customer_email) ~* v_email_regex THEN
      v_recipient_email := btrim(v_order.customer_email);
    END IF;
  END IF;

  -- Prioridade 2: auth.users
  IF v_recipient_email IS NULL AND v_order.user_id IS NOT NULL THEN
    SELECT btrim(u.email)
      INTO v_recipient_email
      FROM auth.users u
     WHERE u.id = v_order.user_id
       AND u.email IS NOT NULL
       AND btrim(u.email) ~* v_email_regex
     LIMIT 1;
  END IF;

  -- 6. Inserção na fila com idempotência estrita
  IF v_recipient_email IS NOT NULL THEN
    INSERT INTO public.order_email_queue (
      order_id,
      email_type,
      recipient_email,
      status,
      attempts,
      max_attempts,
      payload
    ) VALUES (
      p_order_id,
      'order_created',
      v_recipient_email,
      'pending',
      0,
      3,
      jsonb_build_object(
        'enqueued_by', p_enqueued_by,
        'enqueued_at', now()
      )
    )
    ON CONFLICT (order_id, email_type) DO NOTHING
    RETURNING id INTO v_enqueued_id;

    -- Se já existia registro na fila para (order_id, email_type), recupera os dados reais existentes
    IF v_enqueued_id IS NULL THEN
      SELECT id, status, recipient_email
        INTO v_existing_queue
        FROM public.order_email_queue
       WHERE order_id = p_order_id
         AND email_type = 'order_created';

      RETURN jsonb_build_object(
        'success', true,
        'enqueued', false,
        'queue_id', v_existing_queue.id,
        'status', v_existing_queue.status,
        'recipient_email', v_existing_queue.recipient_email,
        'message', 'Evento já existente na fila (idempotente).'
      );
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'enqueued', true,
      'queue_id', v_enqueued_id,
      'status', 'pending',
      'recipient_email', v_recipient_email
    );
  ELSE
    -- Diagnóstico sem mascarar: registra como skipped na fila
    INSERT INTO public.order_email_queue (
      order_id,
      email_type,
      recipient_email,
      status,
      attempts,
      max_attempts,
      error_message,
      payload
    ) VALUES (
      p_order_id,
      'order_created',
      '',
      'skipped',
      0,
      3,
      'Destinatário ausente: customer_email não informado e auth.users não possui e-mail válido para o user_id.',
      jsonb_build_object(
        'enqueued_by', p_enqueued_by,
        'enqueued_at', now(),
        'missing_recipient', true
      )
    )
    ON CONFLICT (order_id, email_type) DO NOTHING
    RETURNING id INTO v_enqueued_id;

    IF v_enqueued_id IS NULL THEN
      SELECT id, status, recipient_email
        INTO v_existing_queue
        FROM public.order_email_queue
       WHERE order_id = p_order_id
         AND email_type = 'order_created';

      RETURN jsonb_build_object(
        'success', true,
        'enqueued', false,
        'queue_id', v_existing_queue.id,
        'status', v_existing_queue.status,
        'message', 'Evento já existente na fila (idempotente).'
      );
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'enqueued', true,
      'queue_id', v_enqueued_id,
      'status', 'skipped',
      'message', 'Pedido registrado na fila como skipped por ausência de e-mail.'
    );
  END IF;
END;
$$;

ALTER FUNCTION public.internal_enqueue_order_created(UUID, TEXT) OWNER TO postgres;

-- Permissões estritas da função interna:
-- Totalmente inacessível via API pública (anon e authenticated NÃO têm permissão)
REVOKE ALL ON FUNCTION public.internal_enqueue_order_created(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.internal_enqueue_order_created(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.internal_enqueue_order_created(UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.internal_enqueue_order_created(UUID, TEXT) TO service_role;


-- ------------------------------------------------------------
-- 2. RPC para o fluxo do Cliente (Checkout)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.customer_enqueue_order_created(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_is_admin BOOLEAN := FALSE;
  v_order_user_id UUID;
BEGIN
  -- 1. Validação de autenticação obrigatória do cliente
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: operação requer usuário autenticado.';
  END IF;

  -- 2. Validação de perfil de administrador utilizando o padrão oficial do projeto
  v_is_admin := public.is_admin();

  -- 3. Consulta de propriedade do pedido
  SELECT user_id
    INTO v_order_user_id
    FROM public.orders
   WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido informado (%) não encontrado.', p_order_id;
  END IF;

  -- 4. Validação segura de propriedade:
  -- Utiliza IS DISTINCT FROM para impedir que user_id NULL permita bypass.
  -- Permite apenas o dono do pedido ou administrador autenticado.
  IF (v_order_user_id IS DISTINCT FROM v_caller_id) AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Acesso negado: você não tem permissão para enfileirar este pedido.';
  END IF;

  -- 5. Delega para a função central interna
  RETURN public.internal_enqueue_order_created(p_order_id, 'customer_checkout');
END;
$$;

ALTER FUNCTION public.customer_enqueue_order_created(p_order_id UUID) OWNER TO postgres;

-- Permissões do Checkout:
REVOKE ALL ON FUNCTION public.customer_enqueue_order_created(p_order_id UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.customer_enqueue_order_created(p_order_id UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.customer_enqueue_order_created(p_order_id UUID) TO authenticated, service_role;


-- ------------------------------------------------------------
-- 3. RPC para Recuperação Administrativa via Painel Admin (UI)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_enqueue_order_created(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
BEGIN
  -- 1. Exige usuário autenticado
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: operação requer usuário autenticado.';
  END IF;

  -- 2. Validação estrita de privilégio administrativo via auth.uid()
  -- Não utiliza current_user; depende exclusivamente da role do usuário em profiles
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem executar esta operação.';
  END IF;

  -- 3. Delega para a função central interna
  RETURN public.internal_enqueue_order_created(p_order_id, 'admin_ui');
END;
$$;

ALTER FUNCTION public.admin_enqueue_order_created(p_order_id UUID) OWNER TO postgres;

-- Permissões Administrativas do Painel:
REVOKE ALL ON FUNCTION public.admin_enqueue_order_created(p_order_id UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_enqueue_order_created(p_order_id UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_enqueue_order_created(p_order_id UUID) TO authenticated, service_role;
