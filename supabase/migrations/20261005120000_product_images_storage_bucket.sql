-- ============================================================
-- Migration: Criar Bucket de Storage para Imagens de Produtos
-- Bucket: product-images
-- ============================================================

-- 1. Criar o bucket product-images caso não exista
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- 2. Políticas RLS para storage.objects
-- Leitura pública para todos (anônimo e autenticado)
DROP POLICY IF EXISTS "Public Access product-images" ON storage.objects;
CREATE POLICY "Public Access product-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- Upload permitido somente para administradores autenticados
DROP POLICY IF EXISTS "Admin Upload product-images" ON storage.objects;
CREATE POLICY "Admin Upload product-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (public.is_admin())
);

-- Atualização permitida somente para administradores
DROP POLICY IF EXISTS "Admin Update product-images" ON storage.objects;
CREATE POLICY "Admin Update product-images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (public.is_admin())
)
WITH CHECK (
  bucket_id = 'product-images'
  AND (public.is_admin())
);

-- Exclusão permitida somente para administradores
DROP POLICY IF EXISTS "Admin Delete product-images" ON storage.objects;
CREATE POLICY "Admin Delete product-images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (public.is_admin())
);
