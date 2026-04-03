-- =====================================================
-- HOTELS: booking settings, extras, and partner-reviewed booking snapshots
-- =====================================================

DO $$
BEGIN
  IF to_regclass('public.hotels') IS NOT NULL THEN
    ALTER TABLE public.hotels
      ADD COLUMN IF NOT EXISTS booking_settings jsonb DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS pricing_extras jsonb DEFAULT '{"currency":"EUR","items":[]}'::jsonb;

    UPDATE public.hotels
    SET booking_settings = '{}'::jsonb
    WHERE booking_settings IS NULL;

    UPDATE public.hotels
    SET pricing_extras = '{"currency":"EUR","items":[]}'::jsonb
    WHERE pricing_extras IS NULL;
  END IF;

  IF to_regclass('public.hotel_bookings') IS NOT NULL THEN
    ALTER TABLE public.hotel_bookings
      ADD COLUMN IF NOT EXISTS extras_price numeric(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS selected_extras jsonb DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS pricing_breakdown jsonb DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS booking_details jsonb DEFAULT '{}'::jsonb;

    ALTER TABLE public.hotel_bookings
      DROP CONSTRAINT IF EXISTS hotel_bookings_extras_price_check;

    ALTER TABLE public.hotel_bookings
      ADD CONSTRAINT hotel_bookings_extras_price_check
      CHECK (extras_price >= 0);

    UPDATE public.hotel_bookings
    SET selected_extras = '[]'::jsonb
    WHERE selected_extras IS NULL;

    UPDATE public.hotel_bookings
    SET pricing_breakdown = '{}'::jsonb
    WHERE pricing_breakdown IS NULL;

    UPDATE public.hotel_bookings
    SET booking_details = '{}'::jsonb
    WHERE booking_details IS NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.hotels.booking_settings IS 'JSON schema: {check_in_from:"15:00", check_out_until:"11:00", cancellation_policy:{pl,en,...}, stay_info:{pl,en,...}}';
COMMENT ON COLUMN public.hotels.pricing_extras IS 'JSON schema: {currency:"EUR", items:[{id,label:{pl,en}, amount:numeric, charge_type:per_stay|per_night|per_person_per_stay|per_person_per_night, is_mandatory:boolean, sort_order:int}]}';
COMMENT ON COLUMN public.hotel_bookings.extras_price IS 'Mandatory + selected optional hotel extras in EUR';
COMMENT ON COLUMN public.hotel_bookings.selected_extras IS 'Array of selected hotel extra IDs at booking time';
COMMENT ON COLUMN public.hotel_bookings.pricing_breakdown IS 'Room/extras/nightly-rate snapshot used for hotel booking total';
COMMENT ON COLUMN public.hotel_bookings.booking_details IS 'Booking policies snapshot and public booking metadata';

CREATE OR REPLACE FUNCTION public.trg_sync_hotel_coupon_to_fulfillment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  UPDATE public.partner_service_fulfillments f
  SET
    total_price = NEW.total_price,
    details = jsonb_strip_nulls(
      coalesce(f.details, '{}'::jsonb)
      || jsonb_build_object(
        'coupon_id', NEW.coupon_id,
        'coupon_code', NEW.coupon_code,
        'coupon_discount_amount', NEW.coupon_discount_amount,
        'base_price', NEW.base_price,
        'extras_price', NEW.extras_price,
        'final_price', NEW.final_price,
        'selected_extras', NEW.selected_extras,
        'pricing_breakdown', NEW.pricing_breakdown,
        'booking_details', NEW.booking_details
      )
    ),
    updated_at = now()
  WHERE f.resource_type = 'hotels'
    AND f.booking_id = NEW.id;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_sync_hotel_coupon_to_fulfillment() IS 'Sync hotel coupon, extras, and pricing snapshots into partner_service_fulfillments while keeping booking requests partner-reviewed.';
