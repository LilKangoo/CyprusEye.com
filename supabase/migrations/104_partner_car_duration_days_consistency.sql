-- =====================================================
-- Ensure partner car fulfillment duration_days uses started-day logic
-- =====================================================

CREATE OR REPLACE FUNCTION public.car_booking_rental_days(
  p_pickup_date date,
  p_pickup_time text,
  p_return_date date,
  p_return_time text
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_pickup_time text := trim(coalesce(p_pickup_time, ''));
  v_return_time text := trim(coalesce(p_return_time, ''));
  v_pickup_ts timestamp;
  v_return_ts timestamp;
  v_days integer;
BEGIN
  IF p_pickup_date IS NULL OR p_return_date IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_pickup_time !~ '^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$' THEN
    v_pickup_time := '10:00';
  END IF;
  IF v_return_time !~ '^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$' THEN
    v_return_time := v_pickup_time;
  END IF;

  IF length(v_pickup_time) = 5 THEN v_pickup_time := v_pickup_time || ':00'; END IF;
  IF length(v_return_time) = 5 THEN v_return_time := v_return_time || ':00'; END IF;

  v_pickup_ts := (p_pickup_date::text || ' ' || v_pickup_time)::timestamp;
  v_return_ts := (p_return_date::text || ' ' || v_return_time)::timestamp;

  IF v_return_ts <= v_pickup_ts THEN
    RETURN greatest((p_return_date - p_pickup_date)::integer, 0);
  END IF;

  v_days := ceil(extract(epoch from (v_return_ts - v_pickup_ts)) / 86400.0)::integer;
  IF v_days < 1 THEN v_days := 1; END IF;
  RETURN greatest(v_days, 3);
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_partner_car_duration_days_from_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  v_days := public.car_booking_rental_days(
    NEW.pickup_date,
    NEW.pickup_time::text,
    NEW.return_date,
    NEW.return_time::text
  );

  UPDATE public.partner_service_fulfillments f
  SET details = jsonb_set(
    coalesce(f.details, '{}'::jsonb),
    '{duration_days}',
    to_jsonb(v_days),
    true
  )
  WHERE f.resource_type = 'cars'
    AND f.booking_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_partner_car_duration_days_from_booking_ins ON public.car_bookings;
CREATE TRIGGER trg_sync_partner_car_duration_days_from_booking_ins
  AFTER INSERT ON public.car_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_partner_car_duration_days_from_booking();

DROP TRIGGER IF EXISTS trg_sync_partner_car_duration_days_from_booking_upd ON public.car_bookings;
CREATE TRIGGER trg_sync_partner_car_duration_days_from_booking_upd
  AFTER UPDATE OF pickup_date, pickup_time, return_date, return_time ON public.car_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_partner_car_duration_days_from_booking();

DO $$
BEGIN
  IF to_regclass('public.partner_service_fulfillments') IS NOT NULL AND to_regclass('public.car_bookings') IS NOT NULL THEN
    UPDATE public.partner_service_fulfillments f
    SET details = jsonb_set(
      coalesce(f.details, '{}'::jsonb),
      '{duration_days}',
      to_jsonb(public.car_booking_rental_days(
        cb.pickup_date,
        cb.pickup_time::text,
        cb.return_date,
        cb.return_time::text
      )),
      true
    )
    FROM public.car_bookings cb
    WHERE f.resource_type = 'cars'
      AND f.booking_id = cb.id
      AND coalesce(f.details->>'duration_days', '') IS DISTINCT FROM coalesce(public.car_booking_rental_days(
        cb.pickup_date,
        cb.pickup_time::text,
        cb.return_date,
        cb.return_time::text
      )::text, '');
  END IF;
END $$;
