-- =====================================================
-- HOTELS: room types, rate plans, location fields, and booking snapshots
-- =====================================================

DO $$
BEGIN
  IF to_regclass('public.hotels') IS NOT NULL THEN
    ALTER TABLE public.hotels
      ADD COLUMN IF NOT EXISTS address_line text,
      ADD COLUMN IF NOT EXISTS district text,
      ADD COLUMN IF NOT EXISTS postal_code text,
      ADD COLUMN IF NOT EXISTS country text DEFAULT 'Cyprus',
      ADD COLUMN IF NOT EXISTS latitude double precision,
      ADD COLUMN IF NOT EXISTS longitude double precision,
      ADD COLUMN IF NOT EXISTS google_maps_url text,
      ADD COLUMN IF NOT EXISTS google_place_id text,
      ADD COLUMN IF NOT EXISTS room_types jsonb DEFAULT '[]'::jsonb;

    UPDATE public.hotels
    SET country = COALESCE(NULLIF(country, ''), 'Cyprus')
    WHERE country IS NULL OR country = '';

    UPDATE public.hotels
    SET room_types = '[]'::jsonb
    WHERE room_types IS NULL;
  END IF;

  IF to_regclass('public.hotel_bookings') IS NOT NULL THEN
    ALTER TABLE public.hotel_bookings
      ADD COLUMN IF NOT EXISTS room_type_id text,
      ADD COLUMN IF NOT EXISTS room_type_name jsonb DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS rate_plan_id text,
      ADD COLUMN IF NOT EXISTS rate_plan_name jsonb DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS cancellation_policy_type text;

    UPDATE public.hotel_bookings
    SET room_type_name = '{}'::jsonb
    WHERE room_type_name IS NULL;

    UPDATE public.hotel_bookings
    SET rate_plan_name = '{}'::jsonb
    WHERE rate_plan_name IS NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.hotels.address_line IS 'Customer-facing hotel street or address line';
COMMENT ON COLUMN public.hotels.district IS 'District, neighbourhood, or area label';
COMMENT ON COLUMN public.hotels.postal_code IS 'Postal code for hotel location';
COMMENT ON COLUMN public.hotels.country IS 'Country label used in hotel location summary';
COMMENT ON COLUMN public.hotels.latitude IS 'Hotel latitude for maps and directions';
COMMENT ON COLUMN public.hotels.longitude IS 'Hotel longitude for maps and directions';
COMMENT ON COLUMN public.hotels.google_maps_url IS 'Explicit Google Maps URL for the hotel';
COMMENT ON COLUMN public.hotels.google_place_id IS 'Optional Google Place ID for future integrations';
COMMENT ON COLUMN public.hotels.room_types IS 'JSON schema: [{id,name:{pl,en,...},summary:{...},cover_image_url,max_persons,pricing_model,pricing_tiers:{currency,rules:[...]},rate_plans:[{id,name:{pl,en,...},summary:{...},deposit_note:{...},cancellation_policy_type:standard|non_refundable_before_deposit,price_adjustment_type:none|fixed_per_night|percent,price_adjustment_value:numeric,is_default:boolean}]}]';

COMMENT ON COLUMN public.hotel_bookings.room_type_id IS 'Selected hotel room type ID snapshot';
COMMENT ON COLUMN public.hotel_bookings.room_type_name IS 'Selected hotel room type localized name snapshot';
COMMENT ON COLUMN public.hotel_bookings.rate_plan_id IS 'Selected hotel rate plan ID snapshot';
COMMENT ON COLUMN public.hotel_bookings.rate_plan_name IS 'Selected hotel rate plan localized name snapshot';
COMMENT ON COLUMN public.hotel_bookings.cancellation_policy_type IS 'Selected hotel cancellation rule snapshot';
