CREATE OR REPLACE FUNCTION public.partner_service_fulfillment_partner_id_for_car_booking(
  p_offer_id UUID,
  p_location TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid UUID;
  loc TEXT;
  has_resource_fn BOOLEAN;
  has_loc_fn BOOLEAN;
BEGIN
  loc := LOWER(NULLIF(TRIM(COALESCE(p_location, '')), ''));

  IF p_offer_id IS NOT NULL THEN
    BEGIN
      SELECT LOWER(NULLIF(TRIM(COALESCE(co.location, '')), ''))
      INTO loc
      FROM public.car_offers co
      WHERE co.id = p_offer_id
      LIMIT 1;
    EXCEPTION WHEN others THEN
      loc := loc;
    END;
  END IF;

  IF loc IS NULL THEN
    RETURN NULL;
  END IF;

  IF loc NOT IN ('paphos','larnaca','all-cyprus') THEN
    RETURN NULL;
  END IF;

  has_resource_fn := (to_regprocedure('public.partner_service_fulfillment_partner_id_for_resource(text,uuid)') IS NOT NULL);
  has_loc_fn := (to_regprocedure('public.partner_service_fulfillment_partner_id_for_car_location(text)') IS NOT NULL);

  pid := NULL;
  IF p_offer_id IS NOT NULL AND has_resource_fn THEN
    pid := public.partner_service_fulfillment_partner_id_for_resource('cars', p_offer_id);
  END IF;

  IF pid IS NULL AND has_loc_fn THEN
    pid := public.partner_service_fulfillment_partner_id_for_car_location(loc);
  END IF;

  IF pid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p.id
  INTO pid
  FROM public.partners p
  WHERE p.id = pid
    AND p.status = 'active'
    AND p.can_manage_cars = true
    AND (
      (loc IN ('paphos','larnaca') AND p.cars_locations @> ARRAY[loc]::text[])
      OR (loc = 'all-cyprus' AND array_length(p.cars_locations, 1) IS NOT NULL)
    )
  LIMIT 1;

  RETURN pid;
END;
$$;

DO $$
DECLARE
  r RECORD;
  new_pid UUID;
BEGIN
  IF to_regclass('public.partner_service_fulfillments') IS NULL OR to_regclass('public.car_bookings') IS NULL THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT f.id AS fulfillment_id,
           f.resource_id,
           cb.location,
           cb.pickup_location,
           f.partner_id
    FROM public.partner_service_fulfillments f
    JOIN public.car_bookings cb
      ON cb.id = f.booking_id
    WHERE f.resource_type = 'cars'
  LOOP
    new_pid := public.partner_service_fulfillment_partner_id_for_car_booking(
      r.resource_id,
      COALESCE(r.location, r.pickup_location)
    );

    IF new_pid IS NOT NULL AND r.partner_id IS DISTINCT FROM new_pid THEN
      UPDATE public.partner_service_fulfillments
      SET partner_id = new_pid
      WHERE id = r.fulfillment_id;
    END IF;
  END LOOP;
EXCEPTION WHEN others THEN
  NULL;
END $$;
