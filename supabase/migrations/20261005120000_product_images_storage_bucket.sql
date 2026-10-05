-- ============================================================
-- Migration: Criar Bucket de Storage para Imagens de Produtos
-- Bucket: product-images
-- ============================================================

-- 1. Criar ou atualizar o bucket product-images
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

-- 2. Garantir RLS habilitado na tabela de objetos do Storage
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Políticas RLS para storage.objects (bucket: product-images)

-- Leitura pública para todos (anônimo e autenticado)
DROP POLICY IF EXISTS "Public Access product-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read for product-images" ON storage.objects;
DROP POLICY IF EXISTS "Give public access to product-images" ON storage.objects;

CREATE POLICY "Public Access product-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- Upload permitido somente para administradores autenticados
DROP POLICY IF EXISTS "Admin Upload product-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow admin upload to product-images" ON storage.objects;
DROP POLICY IF EXISTS "Admin upload product-images" ON storage.objects;

CREATE POLICY "Admin Upload product-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

-- Atualização permitida somente para administradores
DROP POLICY IF EXISTS "Admin Update product-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow admin update to product-images" ON storage.objects;

CREATE POLICY "Admin Update product-images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
)
WITH CHECK (
  bucket_id = 'product-images'
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

-- Exclusão permitida somente para administradores
DROP POLICY IF EXISTS "Admin Delete product-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow admin delete from product-images" ON storage.objects;

CREATE POLICY "Admin Delete product-images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);
