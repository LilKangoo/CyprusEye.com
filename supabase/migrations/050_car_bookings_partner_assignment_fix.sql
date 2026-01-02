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
  ids UUID[];
BEGIN
  loc := LOWER(NULLIF(TRIM(COALESCE(p_location, '')), ''));

  IF loc IN ('airport_pfo','pfo','paphos_airport') THEN
    loc := 'paphos';
  ELSIF loc IN ('airport_lca','lca','larnaca_airport') THEN
    loc := 'larnaca';
  END IF;

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

  IF pid IS NOT NULL THEN
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
  END IF;

  IF pid IS NULL THEN
    IF has_loc_fn THEN
      pid := public.partner_service_fulfillment_partner_id_for_car_location(loc);
    ELSE
      ids := NULL;
      SELECT array_agg(s.id)
      INTO ids
      FROM (
        SELECT p.id
        FROM public.partners p
        WHERE p.status = 'active'
          AND p.can_manage_cars = true
          AND (
            (loc IN ('paphos','larnaca') AND p.cars_locations @> ARRAY[loc]::text[])
            OR (loc = 'all-cyprus' AND array_length(p.cars_locations, 1) IS NOT NULL)
          )
        ORDER BY p.created_at ASC
        LIMIT 2
      ) s;

      IF ids IS NOT NULL AND array_length(ids, 1) = 1 THEN
        pid := ids[1];
      END IF;
    END IF;
  END IF;

  RETURN pid;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_partner_service_fulfillment_from_car_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  j JSONB;
  offer_uuid UUID;
  matched_offer_id UUID;
  pid UUID;
  loc TEXT;
  total_price NUMERIC;
  customer_name TEXT;
  customer_email TEXT;
  customer_phone TEXT;
  summary TEXT;
  currency TEXT;
  car_model_txt TEXT;
  fid UUID;
  details_json JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  j := to_jsonb(NEW);
  offer_uuid := public.try_uuid(j->>'offer_id');
  loc := COALESCE(NULLIF(j->>'location', ''), NULLIF(j->>'pickup_location', ''));

  IF LOWER(COALESCE(loc, '')) IN ('airport_pfo','pfo','paphos_airport') THEN
    loc := 'paphos';
  ELSIF LOWER(COALESCE(loc, '')) IN ('airport_lca','lca','larnaca_airport') THEN
    loc := 'larnaca';
  END IF;

  matched_offer_id := NULL;
  car_model_txt := NULLIF(j->>'car_model', '');
  IF offer_uuid IS NULL AND car_model_txt IS NOT NULL AND LOWER(loc) IN ('paphos','larnaca') THEN
    matched_offer_id := public.match_car_offer_id(loc, car_model_txt);
    offer_uuid := COALESCE(offer_uuid, matched_offer_id);
  END IF;

  pid := public.partner_service_fulfillment_partner_id_for_car_booking(offer_uuid, loc);

  IF pid IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('cancelled', 'no_show') THEN
    RETURN NEW;
  END IF;

  total_price := COALESCE(
    public.try_numeric(j->>'final_price'),
    public.try_numeric(j->>'quoted_price'),
    public.try_numeric(j->>'total_price')
  );
  currency := COALESCE(NULLIF(j->>'currency', ''), 'EUR');
  customer_name := COALESCE(NULLIF(j->>'customer_name', ''), NULLIF(j->>'full_name', ''));
  customer_email := COALESCE(NULLIF(j->>'customer_email', ''), NULLIF(j->>'email', ''));
  customer_phone := COALESCE(NULLIF(j->>'customer_phone', ''), NULLIF(j->>'phone', ''));
  summary := COALESCE(NULLIF(j->>'car_model', ''), NULLIF(j->>'car_type', ''), 'Car booking');

  SELECT public.upsert_partner_service_fulfillment_from_booking_with_partner(
    pid,
    'cars',
    NEW.id,
    offer_uuid,
    NEW.pickup_date,
    NEW.return_date,
    total_price,
    currency,
    customer_name,
    customer_email,
    customer_phone,
    CONCAT('CAR-', SUBSTRING(NEW.id::text, 1, 8)),
    summary,
    NEW.created_at
  ) INTO fid;

  details_json := jsonb_strip_nulls(jsonb_build_object(
    'duration_days', CASE
      WHEN NEW.pickup_date IS NOT NULL AND NEW.return_date IS NOT NULL
        THEN GREATEST((NEW.return_date - NEW.pickup_date)::int, 0)
      ELSE NULL
    END,
    'pickup_location', NULLIF(j->>'pickup_location', ''),
    'return_location', NULLIF(j->>'return_location', ''),
    'pickup_location_fee', public.try_numeric(j->>'pickup_location_fee'),
    'return_location_fee', public.try_numeric(j->>'return_location_fee'),
    'insurance_cost', public.try_numeric(j->>'insurance_cost'),
    'young_driver_cost', public.try_numeric(j->>'young_driver_cost'),
    'insurance_added', CASE
      WHEN lower(COALESCE(NULLIF(j->>'insurance_added',''), 'false')) IN ('true','t','1','yes') THEN true
      WHEN lower(COALESCE(NULLIF(j->>'insurance_added',''), 'false')) IN ('false','f','0','no') THEN false
      ELSE NULL
    END,
    'young_driver_fee', CASE
      WHEN lower(COALESCE(NULLIF(j->>'young_driver_fee',''), 'false')) IN ('true','t','1','yes') THEN true
      WHEN lower(COALESCE(NULLIF(j->>'young_driver_fee',''), 'false')) IN ('false','f','0','no') THEN false
      ELSE NULL
    END
  ));

  IF fid IS NOT NULL THEN
    UPDATE public.partner_service_fulfillments
    SET details = details_json
    WHERE id = fid;
  END IF;

  RETURN NEW;
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

DO $$
BEGIN
  IF to_regclass('public.partner_service_fulfillments') IS NULL OR to_regclass('public.car_bookings') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.partner_service_fulfillments(
    partner_id,
    resource_type,
    booking_id,
    resource_id,
    status,
    sla_deadline_at,
    reference,
    summary,
    start_date,
    end_date,
    total_price,
    currency,
    created_at
  )
  SELECT
    public.partner_service_fulfillment_partner_id_for_car_booking(
      COALESCE(cb.offer_id, mo.matched_offer_id),
      COALESCE(cb.location, cb.pickup_location)
    ) AS partner_id,
    'cars',
    cb.id,
    COALESCE(cb.offer_id, mo.matched_offer_id) AS resource_id,
    'pending_acceptance',
    COALESCE(cb.created_at, NOW()) + INTERVAL '4 hours',
    CONCAT('CAR-', SUBSTRING(cb.id::text, 1, 8)),
    COALESCE(NULLIF(to_jsonb(cb)->>'car_model', ''), NULLIF(to_jsonb(cb)->>'car_type', ''), 'Car booking'),
    cb.pickup_date,
    cb.return_date,
    COALESCE(
      cb.final_price,
      cb.quoted_price,
      cb.total_price
    ),
    COALESCE(NULLIF(to_jsonb(cb)->>'currency', ''), 'EUR'),
    COALESCE(cb.created_at, NOW())
  FROM public.car_bookings cb
  LEFT JOIN LATERAL (
    SELECT public.match_car_offer_id(
      CASE
        WHEN LOWER(NULLIF(TRIM(COALESCE(cb.location, cb.pickup_location, '')), '')) IN ('airport_pfo','pfo','paphos_airport') THEN 'paphos'
        WHEN LOWER(NULLIF(TRIM(COALESCE(cb.location, cb.pickup_location, '')), '')) IN ('airport_lca','lca','larnaca_airport') THEN 'larnaca'
        ELSE NULLIF(TRIM(COALESCE(cb.location, cb.pickup_location, '')), '')
      END,
      cb.car_model
    ) AS matched_offer_id
  ) mo ON TRUE
  WHERE cb.status NOT IN ('cancelled', 'no_show')
    AND public.partner_service_fulfillment_partner_id_for_car_booking(
      COALESCE(cb.offer_id, mo.matched_offer_id),
      COALESCE(cb.location, cb.pickup_location)
    ) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.partner_service_fulfillments f
      WHERE f.resource_type = 'cars'
        AND f.booking_id = cb.id
    )
  ON CONFLICT (resource_type, booking_id) DO NOTHING;

  IF to_regclass('public.partner_service_fulfillment_contacts') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.partner_service_fulfillment_contacts(
    fulfillment_id,
    customer_name,
    customer_email,
    customer_phone,
    created_at
  )
  SELECT
    f.id,
    COALESCE(NULLIF(to_jsonb(cb)->>'customer_name', ''), NULLIF(to_jsonb(cb)->>'full_name', '')),
    COALESCE(NULLIF(to_jsonb(cb)->>'customer_email', ''), NULLIF(to_jsonb(cb)->>'email', '')),
    COALESCE(NULLIF(to_jsonb(cb)->>'customer_phone', ''), NULLIF(to_jsonb(cb)->>'phone', '')),
    COALESCE(cb.created_at, NOW())
  FROM public.partner_service_fulfillments f
  JOIN public.car_bookings cb
    ON cb.id = f.booking_id
  WHERE f.resource_type = 'cars'
  ON CONFLICT (fulfillment_id) DO NOTHING;
EXCEPTION WHEN others THEN
  NULL;
END $$;
