-- ============================================================
-- MIGRATION: Estrutura de Vendas Presenciais (PDV / Caixa) e RPC Atômica
-- 1. Adiciona coluna origin ('ecommerce', 'pos') com DEFAULT 'ecommerce'
-- 2. Torna orders.user_id NULLABLE para permitir vendas balcão sem cadastro
-- 3. Adiciona customer_name e customer_phone em public.orders
-- 4. Atualiza constraint de payment_method para suportar métodos do PDV
-- 5. Cria a RPC atômica e segura public.admin_create_pos_order(...)
-- ============================================================

-- 1. Adicionar origin em public.orders com default 'ecommerce'
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'ecommerce';

ALTER TABLE public.orders 
  DROP CONSTRAINT IF EXISTS orders_origin_check;

ALTER TABLE public.orders 
  ADD CONSTRAINT orders_origin_check 
  CHECK (origin IN ('ecommerce', 'pos'));

CREATE INDEX IF NOT EXISTS orders_origin_idx ON public.orders(origin);

-- 2. Tornar orders.user_id NULLABLE e adicionar customer_name / customer_phone
ALTER TABLE public.orders 
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS customer_name TEXT NULL;

ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS customer_phone TEXT NULL;

-- 3. Atualizar constraint de payment_method para suportar e-commerce e PDV
-- Métodos e-commerce: pix, abacate_pix, credit_card, cash_on_delivery
-- Métodos PDV: cash, pix_pos, debit_card, credit_card
ALTER TABLE public.orders 
  DROP CONSTRAINT IF EXISTS orders_payment_method_check;

ALTER TABLE public.orders 
  ADD CONSTRAINT orders_payment_method_check 
  CHECK (
    payment_method IS NULL OR 
    payment_method IN (
      'pix',
      'abacate_pix',
      'credit_card',
      'cash_on_delivery',
      'cash',
      'pix_pos',
      'debit_card'
    )
  );

-- 4. Ajustar policy de inserção para garantir que clientes comuns criem apenas pedidos 'ecommerce'
DROP POLICY IF EXISTS "Clientes criam pedidos" ON public.orders;

CREATE POLICY "Clientes criam pedidos"
  ON public.orders FOR INSERT
  WITH CHECK (
    public.is_owner(user_id) AND 
    (origin = 'ecommerce' OR origin IS NULL)
  );

-- 5. Criar a RPC segura e atômica public.admin_create_pos_order
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
  v_item JSONB;
  v_product_id UUID;
  v_qty INTEGER;
  v_current_stock INTEGER;
  v_prod_name TEXT;
  v_prod_price DECIMAL(10,2);
  v_prod_is_active BOOLEAN;
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

  -- 2. Validar itens recebidos
  IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Carrinho vazio ou formato de itens inválido.';
  END IF;

  -- 3. Validar forma de pagamento
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

  -- 5. Primeira passagem: Validar existência, status ativo, travar estoque (FOR UPDATE) e calcular subtotal confiável
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::INTEGER;

    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'Item inválido: product_id é obrigatório.';
    END IF;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida para o produto %: deve ser maior que zero.', v_product_id;
    END IF;

    -- Travar linha com FOR UPDATE para concorrência
    SELECT name, price, stock_quantity, is_active
    INTO v_prod_name, v_prod_price, v_current_stock, v_prod_is_active
    FROM public.products
    WHERE id = v_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto com ID % não foi encontrado.', v_product_id;
    END IF;

    IF NOT v_prod_is_active THEN
      RAISE EXCEPTION 'O produto "%" está inativo e não pode ser vendido.', v_prod_name;
    END IF;

    IF v_current_stock < v_qty THEN
      RAISE EXCEPTION 'Estoque insuficiente para "%". Disponível: %, Solicitado: %.', v_prod_name, v_current_stock, v_qty;
    END IF;

    v_item_total := ROUND(v_prod_price * v_qty, 2);
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
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::INTEGER;

    SELECT name, price, stock_quantity
    INTO v_prod_name, v_prod_price, v_current_stock
    FROM public.products
    WHERE id = v_product_id;

    v_item_total := ROUND(v_prod_price * v_qty, 2);

    -- Inserir item no pedido (snapshot)
    INSERT INTO public.order_items (
      order_id,
      product_id,
      product_name,
      product_price,
      quantity,
      total_price
    ) VALUES (
      v_order_id,
      v_product_id,
      v_prod_name,
      v_prod_price,
      v_qty,
      v_item_total
    );

    -- Decrementar estoque atômico
    UPDATE public.products
    SET stock_quantity = stock_quantity - v_qty,
        updated_at = NOW()
    WHERE id = v_product_id;

    -- Registrar movimentação em stock_movements
    INSERT INTO public.stock_movements (
      product_id,
      quantity,
      movement_type,
      reason,
      reference,
      performed_by
    ) VALUES (
      v_product_id,
      v_qty,
      'out',
      'Venda Presencial (PDV) #' || UPPER(SUBSTRING(v_order_id::TEXT FROM 1 FOR 8)),
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

-- 6. Configurar permissões da RPC
REVOKE ALL ON FUNCTION public.admin_create_pos_order(JSONB, TEXT, TEXT, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_pos_order(JSONB, TEXT, TEXT, TEXT, UUID, TEXT) TO authenticated;

-- 7. Notificar PostgREST para recarregar o schema cache
NOTIFY pgrst, 'reload schema';
