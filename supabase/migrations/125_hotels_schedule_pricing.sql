-- =====================================================
-- HOTELS: schedule-aware pricing tiers and pricing model compatibility
-- =====================================================

DO $$
BEGIN
  IF to_regclass('public.hotels') IS NULL THEN
    RETURN;
  END IF;

  BEGIN
    ALTER TABLE public.hotels DROP CONSTRAINT IF EXISTS hotels_pricing_model_check;
  EXCEPTION
    WHEN undefined_object THEN
      NULL;
  END;

  BEGIN
    ALTER TABLE public.hotels
      ADD CONSTRAINT hotels_pricing_model_check
      CHECK (pricing_model IN ('per_person_per_night', 'category_per_night', 'tiered_by_nights', 'flat_per_night'));
  EXCEPTION
    WHEN duplicate_object THEN
      NULL;
  END;
END $$;

COMMENT ON COLUMN public.hotels.pricing_tiers IS 'JSON schema: {currency:"EUR", rules:[{persons:int, price_per_night:numeric, min_nights:int, weekday_prices:{mon..sun:numeric}, month_prices:{jan..dec:numeric}}] }';
