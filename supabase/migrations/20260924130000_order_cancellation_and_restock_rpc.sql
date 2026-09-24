-- ============================================================
-- MIGRATION: RPC para Atualização de Status e Cancelamento com Devolução de Estoque
-- Função atômica e segura que devolve os itens ao estoque ao cancelar
-- com proteção estrita contra duplicidade.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_update_order_status(
  p_order_id UUID,
  p_new_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_status TEXT;
  v_item RECORD;
  v_already_restocked BOOLEAN;
  v_admin_id UUID;
  v_items_count INTEGER := 0;
  v_total_units INTEGER := 0;
BEGIN
  -- 1. Validar que o usuário é administrador
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar o status de pedidos.';
  END IF;

  v_admin_id := auth.uid();

  -- 2. Validar que o status é um dos permitidos
  IF p_new_status NOT IN ('pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'Status de pedido inválido: %', p_new_status;
  END IF;

  -- 3. Obter status atual com bloqueio exclusivo de linha (FOR UPDATE)
  SELECT status INTO v_current_status
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido com ID % não foi encontrado.', p_order_id;
  END IF;

  -- Se o pedido já estiver cancelado e a solicitação for para cancelar novamente,
  -- não reprocessa e não devolve estoque em duplicidade.
  IF v_current_status = 'cancelled' AND p_new_status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Pedido já estava cancelado. Nenhuma alteração de estoque foi duplicada.',
      'status', 'cancelled',
      'restocked', false,
      'items_count', 0
    );
  END IF;

  -- 4. Processamento de cancelamento com devolução de estoque
  IF p_new_status = 'cancelled' THEN
    -- Verificar se já existe registro de devolução para este pedido específico
    SELECT EXISTS (
      SELECT 1 FROM public.stock_movements
      WHERE reference = p_order_id::TEXT
        AND movement_type = 'in'
        AND reason = 'Devolução de estoque - pedido cancelado'
    ) INTO v_already_restocked;

    IF NOT v_already_restocked THEN
      -- Iterar sobre os itens do pedido para restaurar o estoque
      FOR v_item IN
        SELECT product_id, quantity
        FROM public.order_items
        WHERE order_id = p_order_id
      LOOP
        -- Incrementar o estoque do produto
        UPDATE public.products
        SET stock_quantity = stock_quantity + v_item.quantity,
            updated_at = NOW()
        WHERE id = v_item.product_id;

        -- Registrar a movimentação de entrada no estoque
        INSERT INTO public.stock_movements (
          product_id,
          quantity,
          movement_type,
          reason,
          reference,
          performed_by
        ) VALUES (
          v_item.product_id,
          v_item.quantity,
          'in',
          'Devolução de estoque - pedido cancelado',
          p_order_id::TEXT,
          v_admin_id
        );

        v_items_count := v_items_count + 1;
        v_total_units := v_total_units + v_item.quantity;
      END LOOP;
    END IF;
  END IF;

  -- 5. Atualizar o pedido para o novo status
  UPDATE public.orders
  SET status = p_new_status,
      updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', CASE
      WHEN p_new_status = 'cancelled' AND NOT v_already_restocked THEN
        format('Pedido cancelado com sucesso e %s unidades devolvidas ao estoque.', v_total_units)
      WHEN p_new_status = 'cancelled' AND v_already_restocked THEN
        'Pedido cancelado com sucesso (estoque já havia sido devolvido).'
      ELSE
        'Status do pedido atualizado com sucesso.'
    END,
    'status', p_new_status,
    'restocked', (p_new_status = 'cancelled' AND NOT v_already_restocked),
    'items_count', v_items_count,
    'total_units', v_total_units
  );
END;
$$;
