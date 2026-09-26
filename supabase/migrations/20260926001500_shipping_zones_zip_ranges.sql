-- ==============================================================================
-- Migration: 20260926001500_shipping_zones_zip_ranges.sql
-- Description: Adiciona suporte a faixas de CEP e prazos na tabela shipping_zones
-- Mantém compatibilidade total com registros legados (permite NULL nos novos campos)
-- ==============================================================================

-- 1. Adicionar novas colunas na tabela public.shipping_zones
ALTER TABLE public.shipping_zones
  ADD COLUMN IF NOT EXISTS zip_start TEXT,
  ADD COLUMN IF NOT EXISTS zip_end TEXT,
  ADD COLUMN IF NOT EXISTS region_label TEXT,
  ADD COLUMN IF NOT EXISTS estimated_days_min INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS estimated_days_max INTEGER DEFAULT 3;

-- 2. Adicionar constraints flexíveis para validação de formato e integridade
DO $$
BEGIN
  -- Validar formato do CEP inicial (8 dígitos numéricos ou NULL)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shipping_zones_zip_start_format_chk'
  ) THEN
    ALTER TABLE public.shipping_zones
      ADD CONSTRAINT shipping_zones_zip_start_format_chk
      CHECK (zip_start IS NULL OR zip_start ~ '^[0-9]{8}$');
  END IF;

  -- Validar formato do CEP final (8 dígitos numéricos ou NULL)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shipping_zones_zip_end_format_chk'
  ) THEN
    ALTER TABLE public.shipping_zones
      ADD CONSTRAINT shipping_zones_zip_end_format_chk
      CHECK (zip_end IS NULL OR zip_end ~ '^[0-9]{8}$');
  END IF;

  -- Validar que zip_start <= zip_end quando ambos forem informados
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shipping_zones_zip_range_chk'
  ) THEN
    ALTER TABLE public.shipping_zones
      ADD CONSTRAINT shipping_zones_zip_range_chk
      CHECK (
        (zip_start IS NULL AND zip_end IS NULL) OR
        (zip_start IS NOT NULL AND zip_end IS NOT NULL AND zip_start <= zip_end)
      );
  END IF;

  -- Validar que prazos estimados são não-negativos e min <= max
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shipping_zones_estimated_days_chk'
  ) THEN
    ALTER TABLE public.shipping_zones
      ADD CONSTRAINT shipping_zones_estimated_days_chk
      CHECK (
        (estimated_days_min IS NULL OR estimated_days_min >= 0) AND
        (estimated_days_max IS NULL OR estimated_days_min IS NULL OR estimated_days_max >= estimated_days_min)
      );
  END IF;
END $$;

-- 3. Criar índice para busca rápida por faixa de CEP
CREATE INDEX IF NOT EXISTS shipping_zones_zip_range_idx 
  ON public.shipping_zones (zip_start, zip_end) 
  WHERE is_active = true AND zip_start IS NOT NULL AND zip_end IS NOT NULL;
