-- ============================================================
-- MIGRATION: Políticas de Leitura Pública para Settings e Shipping Zones
-- 1. Permite leitura pública (SELECT) apenas de configurações da loja necessárias para o Checkout e catálogo
-- 2. Mantém configurações administrativas (como orders_stock e integrações internas) estritamente privadas
-- 3. Permite leitura pública (SELECT) de zonas de frete ativas (is_active = true)
-- 4. Preserva integralmente o gerenciamento administrativo completo (is_admin) em ambas as tabelas
-- ============================================================

-- 1. Tabela public.settings: permitir leitura pública apenas para chaves públicas permitidas
DROP POLICY IF EXISTS "Configurações públicas da loja são legíveis" ON public.settings;

CREATE POLICY "Configurações públicas da loja são legíveis"
  ON public.settings FOR SELECT
  USING (
    key IN (
      'store_info',
      'store_name',
      'pickup_address',
      'delivery_settings',
      'free_shipping',
      'payment_methods'
    )
  );

-- 2. Tabela public.shipping_zones: permitir leitura pública apenas para zonas ativas
DROP POLICY IF EXISTS "Zonas de frete ativas são públicas" ON public.shipping_zones;

CREATE POLICY "Zonas de frete ativas são públicas"
  ON public.shipping_zones FOR SELECT
  USING (is_active = true);

-- 3. Notificar PostgREST para recarregar o schema cache
NOTIFY pgrst, 'reload schema';
