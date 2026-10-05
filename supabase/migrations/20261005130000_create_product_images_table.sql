-- ============================================================
-- Migration: Criar Tabela de Múltiplas Imagens de Produtos
-- Tabela: product_images
-- ============================================================

-- 1. Criar a tabela product_images
CREATE TABLE IF NOT EXISTS public.product_images (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url    TEXT NOT NULL,
  storage_path TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_primary   BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Índices para performance em buscas e ordenação
CREATE INDEX IF NOT EXISTS product_images_product_id_idx ON public.product_images(product_id);
CREATE INDEX IF NOT EXISTS product_images_sort_order_idx ON public.product_images(product_id, sort_order);

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS para public.product_images

-- Leitura pública para todos os visitantes e clientes
DROP POLICY IF EXISTS "Public product_images select" ON public.product_images;
CREATE POLICY "Public product_images select"
ON public.product_images FOR SELECT
USING (true);

-- Upload/Inserção permitida somente para admin autenticado
DROP POLICY IF EXISTS "Admin product_images insert" ON public.product_images;
CREATE POLICY "Admin product_images insert"
ON public.product_images FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Atualização (reordenar, alterar principal) permitida somente para admin
DROP POLICY IF EXISTS "Admin product_images update" ON public.product_images;
CREATE POLICY "Admin product_images update"
ON public.product_images FOR UPDATE
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

-- Exclusão de imagens permitida somente para admin
DROP POLICY IF EXISTS "Admin product_images delete" ON public.product_images;
CREATE POLICY "Admin product_images delete"
ON public.product_images FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 5. Migração Segura: Popular imagens existentes de products.image_url para product_images
INSERT INTO public.product_images (product_id, image_url, sort_order, is_primary)
SELECT id, image_url, 0, true
FROM public.products
WHERE image_url IS NOT NULL 
  AND trim(image_url) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.product_images pi WHERE pi.product_id = products.id
  );
