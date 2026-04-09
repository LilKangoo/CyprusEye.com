-- =====================================================
-- SERVICE OFFER SEO FIELDS
-- Adds per-offer meta description (localized JSONB) and
-- optional social preview image URL for direct hotel/trip pages.
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'hotels'
      AND column_name = 'meta_description'
  ) THEN
    ALTER TABLE public.hotels
      ADD COLUMN meta_description jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'hotels'
      AND column_name = 'meta_image_url'
  ) THEN
    ALTER TABLE public.hotels
      ADD COLUMN meta_image_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'meta_description'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN meta_description jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'meta_image_url'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN meta_image_url text;
  END IF;
END $$;

COMMENT ON COLUMN public.hotels.meta_description IS 'Localized share preview description used by direct hotel links. Expected JSON object like {pl,en,...}.';
COMMENT ON COLUMN public.hotels.meta_image_url IS 'Optional social preview image URL for direct hotel links. Falls back to cover_image_url when empty.';
COMMENT ON COLUMN public.trips.meta_description IS 'Localized share preview description used by direct trip links. Expected JSON object like {pl,en,...}.';
COMMENT ON COLUMN public.trips.meta_image_url IS 'Optional social preview image URL for direct trip links. Falls back to cover_image_url when empty.';
