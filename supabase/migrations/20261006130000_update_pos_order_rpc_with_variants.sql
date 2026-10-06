-- ============================================================
-- Migration: Atualização Segura da RPC admin_create_pos_order
-- Suporte completo a produtos simples e com variações (product_variants)
-- Execução com SECURITY DEFINER e busca segura (pg_temp)
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_create_pos_order(
  p_items JSONB,
  p_payment_method TEXT,
  p_customer_name TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_customer_id UUID DEFAULT NULL,
  p_customer_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id UUID;
  v_raw_item JSONB;
  v_consolidated RECORD;
  v_current_stock INTEGER;
  v_prod_name TEXT;
  v_prod_price DECIMAL(10,2);
  v_prod_is_active BOOLEAN;
  v_var_name TEXT;
  v_var_price DECIMAL(10,2);
  v_var_stock INTEGER;
  v_var_is_active BOOLEAN;
  v_effective_name TEXT;
  v_effective_price DECIMAL(10,2);
  v_subtotal DECIMAL(10,2) := 0;
  v_item_total DECIMAL(10,2);
  v_order_id UUID;
  v_created_at TIMESTAMPTZ;
  v_items_count INTEGER := 0;
  v_profile_name TEXT;
  v_profile_phone TEXT;
BEGIN
  -- 1. Validar que o executor é administrador
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem criar vendas no PDV.';
  END IF;

  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado: administrador não autenticado.';
  END IF;

  -- 2. Validar formato e integridade do array de itens recebido
  IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Carrinho vazio ou formato de itens inválido.';
  END IF;

  -- Validar individualmente cada item antes da agregação
  FOR v_raw_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF (v_raw_item->>'product_id') IS NULL OR TRIM(v_raw_item->>'product_id') = '' THEN
      RAISE EXCEPTION 'Item inválido: product_id é obrigatório em todos os itens.';
    END IF;

    IF (v_raw_item->>'quantity') IS NULL OR (v_raw_item->>'quantity')::INTEGER <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida para o item: deve ser maior que zero.';
    END IF;
  END LOOP;

  -- 3. Validar forma de pagamento suportada no PDV
  IF p_payment_method IS NULL OR p_payment_method NOT IN ('cash', 'pix_pos', 'debit_card', 'credit_card', 'pix', 'cash_on_delivery') THEN
    RAISE EXCEPTION 'Forma de pagamento inválida para venda presencial: %', p_payment_method;
  END IF;

  -- 4. Validar cliente cadastrado (se informado)
  IF p_customer_id IS NOT NULL THEN
    SELECT name, phone INTO v_profile_name, v_profile_phone
    FROM public.profiles
    WHERE id = p_customer_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cliente com ID % não encontrado.', p_customer_id;
    END IF;
  END IF;

  -- 5. Primeira passagem: Consolidar por (product_id, variant_id), travar estoque (FOR UPDATE), validar status ativo/estoque e calcular subtotal confiável
  FOR v_consolidated IN 
    SELECT 
      (item->>'product_id')::UUID AS product_id,
      NULLIF(TRIM(item->>'variant_id'), '')::UUID AS variant_id,
      SUM((item->>'quantity')::INTEGER)::INTEGER AS total_qty
    FROM jsonb_array_elements(p_items) AS item
    GROUP BY (item->>'product_id')::UUID, NULLIF(TRIM(item->>'variant_id'), '')::UUID
  LOOP
    IF v_consolidated.total_qty <= 0 THEN
      RAISE EXCEPTION 'Quantidade consolidada inválida: deve ser maior que zero.';
    END IF;

    -- Travar produto principal com FOR UPDATE para isolamento e concorrência
    SELECT name, price, stock_quantity, is_active
    INTO v_prod_name, v_prod_price, v_current_stock, v_prod_is_active
    FROM public.products
    WHERE id = v_consolidated.product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto com ID % não foi encontrado.', v_consolidated.product_id;
    END IF;

    IF NOT v_prod_is_active THEN
      RAISE EXCEPTION 'O produto "%" está inativo e não pode ser vendido.', v_prod_name;
    END IF;

    -- Se item possui variação
    IF v_consolidated.variant_id IS NOT NULL THEN
      SELECT name, price, stock_quantity, is_active
      INTO v_var_name, v_var_price, v_var_stock, v_var_is_active
      FROM public.product_variants
      WHERE id = v_consolidated.variant_id AND product_id = v_consolidated.product_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Variação não encontrada para o produto "%".', v_prod_name;
      END IF;

      IF NOT v_var_is_active THEN
        RAISE EXCEPTION 'A variação "%" do produto "%" está inativa.', v_var_name, v_prod_name;
      END IF;

      IF v_var_stock < v_consolidated.total_qty THEN
        RAISE EXCEPTION 'Estoque insuficiente para a variação "%" de "%". Disponível: %, Solicitado: %.',
          v_var_name, v_prod_name, v_var_stock, v_consolidated.total_qty;
      END IF;

      v_item_total := ROUND(v_var_price * v_consolidated.total_qty, 2);
    ELSE
      -- Produto simples sem variação
      IF v_current_stock < v_consolidated.total_qty THEN
        RAISE EXCEPTION 'Estoque insuficiente para "%". Disponível: %, Solicitado: %.', 
          v_prod_name, v_current_stock, v_consolidated.total_qty;
      END IF;

      v_item_total := ROUND(v_prod_price * v_consolidated.total_qty, 2);
    END IF;

    v_subtotal := v_subtotal + v_item_total;
    v_items_count := v_items_count + 1;
  END LOOP;

  -- 6. Inserir pedido no banco com origin = 'pos', delivery_type = 'pickup', shipping_cost = 0, payment_status = 'paid', status = 'delivered'
  INSERT INTO public.orders (
    user_id,
    customer_name,
    customer_phone,
    origin,
    status,
    payment_status,
    payment_method,
    delivery_type,
    shipping_cost,
    subtotal,
    total,
    customer_note
  ) VALUES (
    p_customer_id,
    COALESCE(NULLIF(TRIM(p_customer_name), ''), v_profile_name),
    COALESCE(NULLIF(TRIM(p_customer_phone), ''), v_profile_phone),
    'pos',
    'delivered',
    'paid',
    p_payment_method,
    'pickup',
    0,
    v_subtotal,
    v_subtotal,
    NULLIF(TRIM(p_customer_note), '')
  )
  RETURNING id, created_at INTO v_order_id, v_created_at;

  -- 7. Segunda passagem: Inserir order_items, decrementar estoque e registrar stock_movements
  FOR v_consolidated IN 
    SELECT 
      (item->>'product_id')::UUID AS product_id,
      NULLIF(TRIM(item->>'variant_id'), '')::UUID AS variant_id,
      SUM((item->>'quantity')::INTEGER)::INTEGER AS total_qty
    FROM jsonb_array_elements(p_items) AS item
    GROUP BY (item->>'product_id')::UUID, NULLIF(TRIM(item->>'variant_id'), '')::UUID
  LOOP
    SELECT name, price, stock_quantity
    INTO v_prod_name, v_prod_price, v_current_stock
    FROM public.products
    WHERE id = v_consolidated.product_id;

    IF v_consolidated.variant_id IS NOT NULL THEN
      SELECT name, price, stock_quantity
      INTO v_var_name, v_var_price, v_var_stock
      FROM public.product_variants
      WHERE id = v_consolidated.variant_id;

      v_effective_name := v_prod_name || ' (' || v_var_name || ')';
      v_effective_price := v_var_price;
      v_item_total := ROUND(v_var_price * v_consolidated.total_qty, 2);

      -- Decrementar estoque da variação
      UPDATE public.product_variants
      SET stock_quantity = stock_quantity - v_consolidated.total_qty,
          updated_at = NOW()
      WHERE id = v_consolidated.variant_id;
    ELSE
      v_effective_name := v_prod_name;
      v_effective_price := v_prod_price;
      v_item_total := ROUND(v_prod_price * v_consolidated.total_qty, 2);
    END IF;

    -- Inserir snapshot do item no pedido
    INSERT INTO public.order_items (
      order_id,
      product_id,
      product_name,
      product_price,
      quantity,
      total_price
    ) VALUES (
      v_order_id,
      v_consolidated.product_id,
      v_effective_name,
      v_effective_price,
      v_consolidated.total_qty,
      v_item_total
    );

    -- Decrementar estoque do produto principal
    UPDATE public.products
    SET stock_quantity = stock_quantity - v_consolidated.total_qty,
        updated_at = NOW()
    WHERE id = v_consolidated.product_id;

    -- Registrar movimentação em stock_movements
    INSERT INTO public.stock_movements (
      product_id,
      quantity,
      movement_type,
      reason,
      reference,
      performed_by
    ) VALUES (
      v_consolidated.product_id,
      v_consolidated.total_qty,
      'out',
      'Venda Presencial (PDV) #' || UPPER(SUBSTRING(v_order_id::TEXT FROM 1 FOR 8)) || COALESCE(' - ' || v_var_name, ''),
      v_order_id::TEXT,
      v_admin_id
    );
  END LOOP;

  -- 8. Retornar resultado estruturado
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'created_at', v_created_at,
    'origin', 'pos',
    'status', 'delivered',
    'payment_status', 'paid',
    'payment_method', p_payment_method,
    'subtotal', v_subtotal,
    'shipping_cost', 0,
    'total', v_subtotal,
    'customer_name', COALESCE(NULLIF(TRIM(p_customer_name), ''), v_profile_name),
    'customer_phone', COALESCE(NULLIF(TRIM(p_customer_phone), ''), v_profile_phone),
    'items_count', v_items_count
  );
END;
$$;

-- Permissões
REVOKE ALL ON FUNCTION public.admin_create_pos_order(JSONB, TEXT, TEXT, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_pos_order(JSONB, TEXT, TEXT, TEXT, UUID, TEXT) TO authenticated;

-- Notificação para recarregar PostgREST schema cache
NOTIFY pgrst, 'reload schema';
