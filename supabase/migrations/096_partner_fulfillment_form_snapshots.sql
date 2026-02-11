CREATE TABLE IF NOT EXISTS public.partner_service_fulfillment_form_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_id UUID NOT NULL REFERENCES public.partner_service_fulfillments(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fulfillment_id)
);

CREATE TABLE IF NOT EXISTS public.shop_order_fulfillment_form_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_id UUID NOT NULL REFERENCES public.shop_order_fulfillments(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fulfillment_id)
);

ALTER TABLE public.partner_service_fulfillment_form_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_order_fulfillment_form_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS partner_service_fulfillment_form_snapshots_admin_all ON public.partner_service_fulfillment_form_snapshots;
CREATE POLICY partner_service_fulfillment_form_snapshots_admin_all
ON public.partner_service_fulfillment_form_snapshots
FOR ALL
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS partner_service_fulfillment_form_snapshots_partner_read ON public.partner_service_fulfillment_form_snapshots;
CREATE POLICY partner_service_fulfillment_form_snapshots_partner_read
ON public.partner_service_fulfillment_form_snapshots
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.partner_service_fulfillments f
    WHERE f.id = fulfillment_id
      AND public.is_partner_user(f.partner_id)
      AND f.contact_revealed_at IS NOT NULL
  )
);

DROP POLICY IF EXISTS shop_order_fulfillment_form_snapshots_admin_all ON public.shop_order_fulfillment_form_snapshots;
CREATE POLICY shop_order_fulfillment_form_snapshots_admin_all
ON public.shop_order_fulfillment_form_snapshots
FOR ALL
TO authenticated
USING (is_shop_admin())
WITH CHECK (is_shop_admin());

DROP POLICY IF EXISTS shop_order_fulfillment_form_snapshots_partner_read ON public.shop_order_fulfillment_form_snapshots;
CREATE POLICY shop_order_fulfillment_form_snapshots_partner_read
ON public.shop_order_fulfillment_form_snapshots
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.shop_order_fulfillments f
    WHERE f.id = fulfillment_id
      AND f.partner_id IS NOT NULL
      AND public.is_partner_user(f.partner_id)
      AND f.contact_revealed_at IS NOT NULL
  )
);

GRANT SELECT ON public.partner_service_fulfillment_form_snapshots TO authenticated;
GRANT SELECT ON public.shop_order_fulfillment_form_snapshots TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_service_fulfillment_form_snapshots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_order_fulfillment_form_snapshots TO service_role;

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
  form_json JSONB;
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

  form_json := jsonb_strip_nulls(jsonb_build_object(
    'full_name', NULLIF(j->>'full_name', ''),
    'email', NULLIF(j->>'email', ''),
    'phone', NULLIF(j->>'phone', ''),
    'country', NULLIF(j->>'country', ''),
    'car_model', NULLIF(j->>'car_model', ''),
    'location', NULLIF(j->>'location', ''),
    'offer_id', offer_uuid,
    'pickup_date', NEW.pickup_date,
    'pickup_time', NEW.pickup_time,
    'pickup_location', NULLIF(j->>'pickup_location', ''),
    'pickup_address', NULLIF(j->>'pickup_address', ''),
    'return_date', NEW.return_date,
    'return_time', NEW.return_time,
    'return_location', NULLIF(j->>'return_location', ''),
    'return_address', NULLIF(j->>'return_address', ''),
    'num_passengers', NEW.num_passengers,
    'child_seats', NEW.child_seats,
    'full_insurance', NEW.full_insurance,
    'flight_number', NULLIF(j->>'flight_number', ''),
    'special_requests', NULLIF(j->>'special_requests', ''),
    'airport_pickup', j->'airport_pickup',
    'airport_return', j->'airport_return',
    'airport_pickup_fee', public.try_numeric(j->>'airport_pickup_fee'),
    'airport_return_fee', public.try_numeric(j->>'airport_return_fee'),
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

    INSERT INTO public.partner_service_fulfillment_form_snapshots(
      fulfillment_id,
      payload,
      created_at
    )
    VALUES (
      fid,
      COALESCE(form_json, '{}'::jsonb),
      COALESCE(NEW.created_at, NOW())
    )
    ON CONFLICT (fulfillment_id)
    DO UPDATE SET
      payload = EXCLUDED.payload;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_partner_service_fulfillment_from_trip_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  details_json JSONB;
  form_json JSONB;
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

  details_json := jsonb_strip_nulls(jsonb_build_object(
    'preferred_date', NEW.trip_date,
    'arrival_date', NEW.arrival_date,
    'departure_date', NEW.departure_date,
    'num_adults', NEW.num_adults,
    'num_children', NEW.num_children
  ));

  form_json := jsonb_strip_nulls(jsonb_build_object(
    'trip_id', NEW.trip_id,
    'trip_slug', NULLIF(NEW.trip_slug, ''),
    'customer_name', NEW.customer_name,
    'customer_email', NEW.customer_email,
    'customer_phone', NEW.customer_phone,
    'trip_date', NEW.trip_date,
    'arrival_date', NEW.arrival_date,
    'departure_date', NEW.departure_date,
    'num_adults', NEW.num_adults,
    'num_children', NEW.num_children,
    'num_hours', NEW.num_hours,
    'num_days', NEW.num_days,
    'notes', NULLIF(NEW.notes, ''),
    'total_price', NEW.total_price
  ));

  PERFORM public.upsert_partner_service_fulfillments_for_resource_partners(
    'trips',
    NEW.id,
    NEW.trip_id,
    COALESCE(NEW.trip_date::date, NEW.arrival_date::date),
    NEW.departure_date::date,
    NEW.total_price,
    'EUR',
    NEW.customer_name,
    NEW.customer_email,
    NEW.customer_phone,
    CONCAT('TRIP-', SUBSTRING(NEW.id::text, 1, 8)),
    'Trip booking',
    NEW.created_at::timestamptz,
    details_json
  );

  INSERT INTO public.partner_service_fulfillment_form_snapshots(
    fulfillment_id,
    payload,
    created_at
  )
  SELECT
    f.id,
    COALESCE(form_json, '{}'::jsonb),
    COALESCE(NEW.created_at, NOW())
  FROM public.partner_service_fulfillments f
  WHERE f.resource_type = 'trips'
    AND f.booking_id = NEW.id
  ON CONFLICT (fulfillment_id)
  DO UPDATE SET
    payload = EXCLUDED.payload;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_partner_service_fulfillment_from_hotel_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  details_json JSONB;
  form_json JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF NEW.hotel_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  details_json := jsonb_strip_nulls(jsonb_build_object(
    'arrival_date', NEW.arrival_date,
    'departure_date', NEW.departure_date,
    'num_adults', NEW.num_adults,
    'num_children', NEW.num_children,
    'nights', NEW.nights
  ));

  form_json := jsonb_strip_nulls(jsonb_build_object(
    'hotel_id', NEW.hotel_id,
    'category_id', NEW.category_id,
    'hotel_slug', NULLIF(NEW.hotel_slug, ''),
    'customer_name', NEW.customer_name,
    'customer_email', NEW.customer_email,
    'customer_phone', NEW.customer_phone,
    'arrival_date', NEW.arrival_date,
    'departure_date', NEW.departure_date,
    'num_adults', NEW.num_adults,
    'num_children', NEW.num_children,
    'nights', NEW.nights,
    'notes', NULLIF(NEW.notes, ''),
    'total_price', NEW.total_price
  ));

  PERFORM public.upsert_partner_service_fulfillments_for_resource_partners(
    'hotels',
    NEW.id,
    NEW.hotel_id,
    NEW.arrival_date::date,
    NEW.departure_date::date,
    NEW.total_price,
    'EUR',
    NEW.customer_name,
    NEW.customer_email,
    NEW.customer_phone,
    CONCAT('HOTEL-', SUBSTRING(NEW.id::text, 1, 8)),
    'Hotel booking',
    NEW.created_at::timestamptz,
    details_json
  );

  INSERT INTO public.partner_service_fulfillment_form_snapshots(
    fulfillment_id,
    payload,
    created_at
  )
  SELECT
    f.id,
    COALESCE(form_json, '{}'::jsonb),
    COALESCE(NEW.created_at, NOW())
  FROM public.partner_service_fulfillments f
  WHERE f.resource_type = 'hotels'
    AND f.booking_id = NEW.id
  ON CONFLICT (fulfillment_id)
  DO UPDATE SET
    payload = EXCLUDED.payload;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_partner_resources_backfill_service_fulfillments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b RECORD;
  details_json JSONB;
  form_json JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.partner_id IS NOT DISTINCT FROM OLD.partner_id
      AND NEW.resource_type IS NOT DISTINCT FROM OLD.resource_type
      AND NEW.resource_id IS NOT DISTINCT FROM OLD.resource_id
    THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.resource_type = 'trips' THEN
    IF to_regclass('public.trip_bookings') IS NULL THEN
      RETURN NEW;
    END IF;

    FOR b IN
      SELECT *
      FROM public.trip_bookings
      WHERE trip_id = NEW.resource_id
        AND status IS DISTINCT FROM 'cancelled'
    LOOP
      details_json := jsonb_strip_nulls(jsonb_build_object(
        'preferred_date', b.trip_date,
        'arrival_date', b.arrival_date,
        'departure_date', b.departure_date,
        'num_adults', b.num_adults,
        'num_children', b.num_children
      ));

      form_json := jsonb_strip_nulls(jsonb_build_object(
        'trip_id', b.trip_id,
        'trip_slug', NULLIF(b.trip_slug, ''),
        'customer_name', b.customer_name,
        'customer_email', b.customer_email,
        'customer_phone', b.customer_phone,
        'trip_date', b.trip_date,
        'arrival_date', b.arrival_date,
        'departure_date', b.departure_date,
        'num_adults', b.num_adults,
        'num_children', b.num_children,
        'num_hours', b.num_hours,
        'num_days', b.num_days,
        'notes', NULLIF(b.notes, ''),
        'total_price', b.total_price
      ));

      PERFORM public.upsert_partner_service_fulfillments_for_resource_partners(
        'trips',
        b.id,
        b.trip_id,
        COALESCE(b.trip_date::date, b.arrival_date::date),
        b.departure_date::date,
        b.total_price,
        'EUR',
        b.customer_name,
        b.customer_email,
        b.customer_phone,
        CONCAT('TRIP-', SUBSTRING(b.id::text, 1, 8)),
        'Trip booking',
        b.created_at::timestamptz,
        details_json
      );

      INSERT INTO public.partner_service_fulfillment_form_snapshots(fulfillment_id, payload, created_at)
      SELECT
        f.id,
        COALESCE(form_json, '{}'::jsonb),
        COALESCE(b.created_at, NOW())
      FROM public.partner_service_fulfillments f
      WHERE f.resource_type = 'trips'
        AND f.booking_id = b.id
      ON CONFLICT (fulfillment_id)
      DO UPDATE SET
        payload = EXCLUDED.payload;
    END LOOP;

    RETURN NEW;
  END IF;

  IF NEW.resource_type = 'hotels' THEN
    IF to_regclass('public.hotel_bookings') IS NULL THEN
      RETURN NEW;
    END IF;

    FOR b IN
      SELECT *
      FROM public.hotel_bookings
      WHERE hotel_id = NEW.resource_id
        AND status IS DISTINCT FROM 'cancelled'
    LOOP
      details_json := jsonb_strip_nulls(jsonb_build_object(
        'arrival_date', b.arrival_date,
        'departure_date', b.departure_date,
        'num_adults', b.num_adults,
        'num_children', b.num_children,
        'nights', b.nights
      ));

      form_json := jsonb_strip_nulls(jsonb_build_object(
        'hotel_id', b.hotel_id,
        'category_id', b.category_id,
        'hotel_slug', NULLIF(b.hotel_slug, ''),
        'customer_name', b.customer_name,
        'customer_email', b.customer_email,
        'customer_phone', b.customer_phone,
        'arrival_date', b.arrival_date,
        'departure_date', b.departure_date,
        'num_adults', b.num_adults,
        'num_children', b.num_children,
        'nights', b.nights,
        'notes', NULLIF(b.notes, ''),
        'total_price', b.total_price
      ));

      PERFORM public.upsert_partner_service_fulfillments_for_resource_partners(
        'hotels',
        b.id,
        b.hotel_id,
        b.arrival_date::date,
        b.departure_date::date,
        b.total_price,
        'EUR',
        b.customer_name,
        b.customer_email,
        b.customer_phone,
        CONCAT('HOTEL-', SUBSTRING(b.id::text, 1, 8)),
        'Hotel booking',
        b.created_at::timestamptz,
        details_json
      );

      INSERT INTO public.partner_service_fulfillment_form_snapshots(fulfillment_id, payload, created_at)
      SELECT
        f.id,
        COALESCE(form_json, '{}'::jsonb),
        COALESCE(b.created_at, NOW())
      FROM public.partner_service_fulfillments f
      WHERE f.resource_type = 'hotels'
        AND f.booking_id = b.id
      ON CONFLICT (fulfillment_id)
      DO UPDATE SET
        payload = EXCLUDED.payload;
    END LOOP;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.partner_service_fulfillments') IS NOT NULL AND to_regclass('public.car_bookings') IS NOT NULL THEN
    INSERT INTO public.partner_service_fulfillment_form_snapshots(fulfillment_id, payload, created_at)
    SELECT
      f.id,
      jsonb_strip_nulls(jsonb_build_object(
        'full_name', NULLIF(to_jsonb(cb)->>'full_name', ''),
        'email', NULLIF(to_jsonb(cb)->>'email', ''),
        'phone', NULLIF(to_jsonb(cb)->>'phone', ''),
        'country', NULLIF(to_jsonb(cb)->>'country', ''),
        'car_model', NULLIF(to_jsonb(cb)->>'car_model', ''),
        'location', NULLIF(to_jsonb(cb)->>'location', ''),
        'offer_id', public.try_uuid(to_jsonb(cb)->>'offer_id'),
        'pickup_date', cb.pickup_date,
        'pickup_time', cb.pickup_time,
        'pickup_location', NULLIF(to_jsonb(cb)->>'pickup_location', ''),
        'pickup_address', NULLIF(to_jsonb(cb)->>'pickup_address', ''),
        'return_date', cb.return_date,
        'return_time', cb.return_time,
        'return_location', NULLIF(to_jsonb(cb)->>'return_location', ''),
        'return_address', NULLIF(to_jsonb(cb)->>'return_address', ''),
        'num_passengers', cb.num_passengers,
        'child_seats', cb.child_seats,
        'full_insurance', cb.full_insurance,
        'flight_number', NULLIF(to_jsonb(cb)->>'flight_number', ''),
        'special_requests', NULLIF(to_jsonb(cb)->>'special_requests', ''),
        'airport_pickup', to_jsonb(cb)->'airport_pickup',
        'airport_return', to_jsonb(cb)->'airport_return',
        'airport_pickup_fee', public.try_numeric(to_jsonb(cb)->>'airport_pickup_fee'),
        'airport_return_fee', public.try_numeric(to_jsonb(cb)->>'airport_return_fee'),
        'pickup_location_fee', public.try_numeric(to_jsonb(cb)->>'pickup_location_fee'),
        'return_location_fee', public.try_numeric(to_jsonb(cb)->>'return_location_fee'),
        'insurance_cost', public.try_numeric(to_jsonb(cb)->>'insurance_cost'),
        'young_driver_cost', public.try_numeric(to_jsonb(cb)->>'young_driver_cost'),
        'insurance_added', to_jsonb(cb)->'insurance_added',
        'young_driver_fee', to_jsonb(cb)->'young_driver_fee'
      )),
      COALESCE(cb.created_at, NOW())
    FROM public.partner_service_fulfillments f
    JOIN public.car_bookings cb ON cb.id = f.booking_id
    WHERE f.resource_type = 'cars'
    ON CONFLICT (fulfillment_id)
    DO UPDATE SET
      payload = EXCLUDED.payload;
  END IF;

  IF to_regclass('public.partner_service_fulfillments') IS NOT NULL AND to_regclass('public.trip_bookings') IS NOT NULL THEN
    INSERT INTO public.partner_service_fulfillment_form_snapshots(fulfillment_id, payload, created_at)
    SELECT
      f.id,
      jsonb_strip_nulls(jsonb_build_object(
        'trip_id', tb.trip_id,
        'trip_slug', NULLIF(tb.trip_slug, ''),
        'customer_name', tb.customer_name,
        'customer_email', tb.customer_email,
        'customer_phone', tb.customer_phone,
        'trip_date', tb.trip_date,
        'arrival_date', tb.arrival_date,
        'departure_date', tb.departure_date,
        'num_adults', tb.num_adults,
        'num_children', tb.num_children,
        'num_hours', tb.num_hours,
        'num_days', tb.num_days,
        'notes', NULLIF(tb.notes, ''),
        'total_price', tb.total_price
      )),
      COALESCE(tb.created_at, NOW())
    FROM public.partner_service_fulfillments f
    JOIN public.trip_bookings tb ON tb.id = f.booking_id
    WHERE f.resource_type = 'trips'
    ON CONFLICT (fulfillment_id)
    DO UPDATE SET
      payload = EXCLUDED.payload;
  END IF;

  IF to_regclass('public.partner_service_fulfillments') IS NOT NULL AND to_regclass('public.hotel_bookings') IS NOT NULL THEN
    INSERT INTO public.partner_service_fulfillment_form_snapshots(fulfillment_id, payload, created_at)
    SELECT
      f.id,
      jsonb_strip_nulls(jsonb_build_object(
        'hotel_id', hb.hotel_id,
        'category_id', hb.category_id,
        'hotel_slug', NULLIF(hb.hotel_slug, ''),
        'customer_name', hb.customer_name,
        'customer_email', hb.customer_email,
        'customer_phone', hb.customer_phone,
        'arrival_date', hb.arrival_date,
        'departure_date', hb.departure_date,
        'num_adults', hb.num_adults,
        'num_children', hb.num_children,
        'nights', hb.nights,
        'notes', NULLIF(hb.notes, ''),
        'total_price', hb.total_price
      )),
      COALESCE(hb.created_at, NOW())
    FROM public.partner_service_fulfillments f
    JOIN public.hotel_bookings hb ON hb.id = f.booking_id
    WHERE f.resource_type = 'hotels'
    ON CONFLICT (fulfillment_id)
    DO UPDATE SET
      payload = EXCLUDED.payload;
  END IF;

  IF to_regclass('public.shop_order_fulfillments') IS NOT NULL AND to_regclass('public.shop_orders') IS NOT NULL THEN
    INSERT INTO public.shop_order_fulfillment_form_snapshots(fulfillment_id, payload, created_at)
    SELECT
      f.id,
      jsonb_strip_nulls(jsonb_build_object(
        'customer_name', o.customer_name,
        'customer_email', o.customer_email,
        'customer_phone', o.customer_phone,
        'shipping_address', o.shipping_address,
        'billing_address', o.billing_address,
        'shipping_method_name', NULLIF(o.shipping_method_name, ''),
        'estimated_delivery_date', o.estimated_delivery_date,
        'customer_notes', NULLIF(o.customer_notes, ''),
        'shipping_details', to_jsonb(o)->'shipping_details',
        'gift_message', NULLIF(o.gift_message, ''),
        'is_gift', o.is_gift
      )),
      COALESCE(o.created_at, NOW())
    FROM public.shop_order_fulfillments f
    JOIN public.shop_orders o ON o.id = f.order_id
    ON CONFLICT (fulfillment_id)
    DO UPDATE SET
      payload = EXCLUDED.payload;
  END IF;
END $$;
