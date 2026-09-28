-- ==============================================================================
-- Migration: 20260926003500_calculate_order_shipping_rpc.sql
-- Description: RPC segura para cálculo de frete por CEP baseado em shipping_zones
-- Executa com SECURITY DEFINER e valida se o endereço pertence ao usuário autenticado
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.calculate_order_shipping(
  p_address_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_raw_zip TEXT;
  v_normalized_zip TEXT;
  v_zone RECORD;
BEGIN
  -- 1. Validar autenticação
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado: usuário não autenticado.' USING ERRCODE = '42501';
  END IF;

  -- 2. Validar parâmetro de endereço
  IF p_address_id IS NULL THEN
    RAISE EXCEPTION 'ID do endereço é obrigatório.' USING ERRCODE = '22023';
  END IF;

  -- 3. Buscar endereço garantindo que pertence ao usuário autenticado
  SELECT zip_code
  INTO v_raw_zip
  FROM public.addresses
  WHERE id = p_address_id AND user_id = v_caller_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Endereço não encontrado ou não pertence ao usuário autenticado.' USING ERRCODE = 'P0002';
  END IF;

  -- 4. Normalizar CEP (remover caracteres não-numéricos)
  v_normalized_zip := regexp_replace(COALESCE(v_raw_zip, ''), '\D', '', 'g');

  -- 5. Validar formato de 8 dígitos do CEP
  IF length(v_normalized_zip) != 8 OR v_normalized_zip !~ '^[0-9]{8}$' THEN
    RAISE EXCEPTION 'CEP do endereço é inválido (deve conter exatamente 8 dígitos numéricos).' USING ERRCODE = '22023';
  END IF;

  -- 6. Buscar zona correspondente com ordenação determinística
  SELECT 
    id,
    name,
    region_label,
    price,
    estimated_days_min,
    estimated_days_max
  INTO v_zone
  FROM public.shipping_zones
  WHERE is_active = true
    AND zip_start IS NOT NULL
    AND zip_end IS NOT NULL
    AND zip_start <= v_normalized_zip
    AND zip_end >= v_normalized_zip
  ORDER BY
    (zip_end::bigint - zip_start::bigint) ASC,
    price ASC,
    updated_at DESC,
    id ASC
  LIMIT 1;

  -- 7. Retorno estruturado
  IF FOUND THEN
    RETURN jsonb_build_object(
      'available', true,
      'shipping_cost', v_zone.price,
      'region_label', v_zone.region_label,
      'zone_id', v_zone.id,
      'zone_name', v_zone.name,
      'estimated_days_min', v_zone.estimated_days_min,
      'estimated_days_max', v_zone.estimated_days_max,
      'zip_code', v_normalized_zip
    );
  ELSE
    RETURN jsonb_build_object(
      'available', false,
      'shipping_cost', NULL,
      'region_label', NULL,
      'zone_id', NULL,
      'zone_name', NULL,
      'estimated_days_min', NULL,
      'estimated_days_max', NULL,
      'zip_code', v_normalized_zip
    );
  END IF;
END;
$$;

-- 8. Configurar permissões de segurança
REVOKE ALL ON FUNCTION public.calculate_order_shipping(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_order_shipping(UUID) TO authenticated;
