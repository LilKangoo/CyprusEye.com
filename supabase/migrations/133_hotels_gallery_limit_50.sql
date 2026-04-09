-- =====================================================
-- HOTELS: align gallery trigger limit with admin UI (50 photos)
-- =====================================================

CREATE OR REPLACE FUNCTION public.validate_hotels_photos_len()
RETURNS TRIGGER AS $$
DECLARE
  photos_count int;
BEGIN
  IF NEW.photos IS NOT NULL THEN
    SELECT jsonb_array_length(NEW.photos) INTO photos_count;
    IF photos_count > 50 THEN
      RAISE EXCEPTION 'photos array can contain at most 50 items (got %)', photos_count;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.validate_hotels_photos_len() IS 'Validate hotels.photos array length (max 50 items).';
COMMENT ON COLUMN public.hotels.photos IS 'Array of public image URLs (max 50)';
