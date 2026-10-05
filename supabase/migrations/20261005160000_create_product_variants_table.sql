-- ============================================================
-- Migration: Criar Tabela de Variações de Produtos
-- Tabela: product_variants
-- Permite ao ADMIN gerenciar preços, tamanhos, SKU e estoque por variação
-- ============================================================

-- 1. Criar a tabela product_variants
CREATE TABLE IF NOT EXISTS public.product_variants (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  sku            TEXT,
  price          DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  is_active      BOOLEAN NOT NULL DEFAULT true,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Índices para buscas rápidas e ordenação
CREATE INDEX IF NOT EXISTS product_variants_product_id_idx ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS product_variants_sort_order_idx ON public.product_variants(product_id, sort_order);

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS para public.product_variants

-- Leitura pública para todos os visitantes e clientes
DROP POLICY IF EXISTS "Public product_variants select" ON public.product_variants;
CREATE POLICY "Public product_variants select"
ON public.product_variants FOR SELECT
USING (true);

-- Inserção permitida somente para admin autenticado
DROP POLICY IF EXISTS "Admin product_variants insert" ON public.product_variants;
CREATE POLICY "Admin product_variants insert"
ON public.product_variants FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Atualização permitida somente para admin
DROP POLICY IF EXISTS "Admin product_variants update" ON public.product_variants;
CREATE POLICY "Admin product_variants update"
ON public.product_variants FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Exclusão de variações permitida somente para admin
DROP POLICY IF EXISTS "Admin product_variants delete" ON public.product_variants;
CREATE POLICY "Admin product_variants delete"
ON public.product_variants FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
