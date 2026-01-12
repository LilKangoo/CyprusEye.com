ALTER TABLE IF EXISTS public.partner_service_fulfillments
ADD COLUMN IF NOT EXISTS details jsonb;

CREATE OR REPLACE FUNCTION public.trg_partner_service_fulfillment_from_trip_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fid UUID;
  details_json JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF NEW.trip_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  SELECT public.upsert_partner_service_fulfillment_from_booking(
    'trips',
    NEW.id,
    NEW.trip_id,
    COALESCE(NEW.trip_date, NEW.arrival_date),
    NEW.departure_date,
    NEW.total_price,
    'EUR',
    NEW.customer_name,
    NEW.customer_email,
    NEW.customer_phone,
    CONCAT('TRIP-', SUBSTRING(NEW.id::text, 1, 8)),
    'Trip booking',
    NEW.created_at
  ) INTO fid;

  details_json := jsonb_strip_nulls(jsonb_build_object(
    'preferred_date', NEW.trip_date,
    'arrival_date', NEW.arrival_date,
    'departure_date', NEW.departure_date,
    'num_adults', NEW.num_adults,
    'num_children', NEW.num_children
  ));

  IF fid IS NOT NULL THEN
    UPDATE public.partner_service_fulfillments
    SET details = details_json
    WHERE id = fid;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partner_service_fulfillment_from_trip_booking_ins ON public.trip_bookings;
CREATE TRIGGER trg_partner_service_fulfillment_from_trip_booking_ins
  AFTER INSERT ON public.trip_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_partner_service_fulfillment_from_trip_booking();

DROP TRIGGER IF EXISTS trg_partner_service_fulfillment_from_trip_booking_upd ON public.trip_bookings;
CREATE TRIGGER trg_partner_service_fulfillment_from_trip_booking_upd
  AFTER UPDATE OF trip_id, trip_date, arrival_date, departure_date, total_price, customer_name, customer_email, customer_phone, status, num_adults, num_children ON public.trip_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_partner_service_fulfillment_from_trip_booking();

UPDATE public.partner_service_fulfillments f
SET details = jsonb_strip_nulls(jsonb_build_object(
  'preferred_date', b.trip_date,
  'arrival_date', b.arrival_date,
  'departure_date', b.departure_date,
  'num_adults', b.num_adults,
  'num_children', b.num_children
))
FROM public.trip_bookings b
WHERE f.resource_type = 'trips'
  AND f.booking_id = b.id
  AND (f.details IS NULL OR f.details = '{}'::jsonb);
