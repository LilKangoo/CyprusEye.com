-- =====================================================
-- HOTELS: dynamic pricing tiers and up to 10 photos
-- =====================================================

DO $$
BEGIN
  -- Add photos jsonb array if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='hotels' AND column_name='photos'
  ) THEN
    ALTER TABLE public.hotels ADD COLUMN photos jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Add pricing_tiers jsonb if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='hotels' AND column_name='pricing_tiers'
  ) THEN
    ALTER TABLE public.hotels ADD COLUMN pricing_tiers jsonb DEFAULT '{"currency":"EUR","rules":[]}'::jsonb;
  END IF;
END $$;

-- Helper check: limit photos array length to 10 via trigger
CREATE OR REPLACE FUNCTION public.validate_hotels_photos_len()
RETURNS TRIGGER AS $$
DECLARE
  photos_count int;
BEGIN
  IF NEW.photos IS NOT NULL THEN
    SELECT jsonb_array_length(NEW.photos) INTO photos_count;
    IF photos_count > 10 THEN
      RAISE EXCEPTION 'photos array can contain at most 10 items (got %)', photos_count;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_validate_hotels_photos_len') THEN
    CREATE TRIGGER trg_validate_hotels_photos_len
    BEFORE INSERT OR UPDATE ON public.hotels
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_hotels_photos_len();
  END IF;
END $$;

COMMENT ON COLUMN public.hotels.photos IS 'Array of public image URLs (max 10)';
COMMENT ON COLUMN public.hotels.pricing_tiers IS 'JSON schema: {currency:"EUR", rules:[{persons:int, price_per_night:numeric, min_nights:int}] }';
