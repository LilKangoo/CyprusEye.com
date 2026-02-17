-- =====================================================
-- Cars coupons: public quote RPC + partner details snapshot fields
-- =====================================================

CREATE OR REPLACE FUNCTION public.car_coupon_quote(
  p_coupon_code text,
  p_base_rental_price numeric,
  p_pickup_at timestamptz,
  p_return_at timestamptz,
  p_offer_id uuid DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_car_model text DEFAULT NULL,
  p_car_type text DEFAULT NULL,
  p_user_id uuid DEFAULT auth.uid(),
  p_user_email text DEFAULT NULL
)
RETURNS TABLE (
  is_valid boolean,
  message text,
  coupon_id uuid,
  coupon_code text,
  discount_type text,
  discount_value numeric,
  base_rental_price numeric,
  discount_amount numeric,
  final_rental_price numeric,
  currency text,
  partner_id uuid,
  partner_commission_bps_override integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon public.car_coupons%ROWTYPE;
  v_code text := upper(trim(coalesce(p_coupon_code, '')));
  v_base numeric := coalesce(p_base_rental_price, 0);
  v_pickup_date date;
  v_return_date date;
  v_rental_days integer;
  v_discount numeric := 0;
  v_final numeric := 0;
  v_location text := lower(trim(coalesce(p_location, '')));
  v_model text := lower(trim(coalesce(p_car_model, '')));
  v_type text := lower(trim(coalesce(p_car_type, '')));
  v_offer_location text;
  v_offer_model text;
  v_offer_type text;
  v_total_redemptions integer := 0;
  v_user_redemptions integer := 0;
  v_total_limit integer;
  v_user_limit integer;
  v_user_email text := lower(trim(coalesce(p_user_email, '')));
BEGIN
  is_valid := false;
  message := 'Invalid coupon';
  coupon_id := null;
  coupon_code := null;
  discount_type := null;
  discount_value := null;
  base_rental_price := null;
  discount_amount := 0;
  final_rental_price := null;
  currency := 'EUR';
  partner_id := null;
  partner_commission_bps_override := null;

  IF v_code = '' THEN
    message := 'Enter a coupon code';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_base <= 0 THEN
    message := 'Base rental price must be greater than zero';
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_pickup_at IS NULL OR p_return_at IS NULL OR p_return_at <= p_pickup_at THEN
    message := 'Invalid rental date range';
    RETURN NEXT;
    RETURN;
  END IF;

  v_pickup_date := (p_pickup_at AT TIME ZONE 'UTC')::date;
  v_return_date := (p_return_at AT TIME ZONE 'UTC')::date;
  v_rental_days := greatest(
    ceil(extract(epoch from (p_return_at - p_pickup_at)) / 86400.0)::integer,
    1
  );

  SELECT *
  INTO v_coupon
  FROM public.car_coupons
  WHERE upper(code) = v_code
  LIMIT 1;

  IF NOT FOUND THEN
    message := 'Coupon not found';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_coupon.status <> 'active' OR v_coupon.is_active IS NOT TRUE THEN
    message := 'Coupon is not active';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_coupon.starts_at IS NOT NULL AND v_pickup_date < (v_coupon.starts_at AT TIME ZONE 'UTC')::date THEN
    message := 'Coupon is not valid yet';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_coupon.expires_at IS NOT NULL AND v_pickup_date > (v_coupon.expires_at AT TIME ZONE 'UTC')::date THEN
    message := 'Coupon has expired for selected rental date';
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_offer_id IS NOT NULL THEN
    SELECT
      lower(trim(coalesce(location, ''))),
      lower(trim(coalesce(car_model, ''))),
      lower(trim(coalesce(car_type, '')))
    INTO
      v_offer_location,
      v_offer_model,
      v_offer_type
    FROM public.car_offers
    WHERE id = p_offer_id
    LIMIT 1;

    IF coalesce(v_location, '') = '' THEN v_location := coalesce(v_offer_location, ''); END IF;
    IF coalesce(v_model, '') = '' THEN v_model := coalesce(v_offer_model, ''); END IF;
    IF coalesce(v_type, '') = '' THEN v_type := coalesce(v_offer_type, ''); END IF;
  END IF;

  IF array_length(v_coupon.applicable_locations, 1) IS NOT NULL THEN
    IF coalesce(v_location, '') = '' OR NOT EXISTS (
      SELECT 1
      FROM unnest(v_coupon.applicable_locations) AS loc
      WHERE lower(trim(loc)) = v_location
    ) THEN
      message := 'Coupon does not apply to this location';
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  IF array_length(v_coupon.applicable_offer_ids, 1) IS NOT NULL THEN
    IF p_offer_id IS NULL OR NOT (p_offer_id = ANY(v_coupon.applicable_offer_ids)) THEN
      message := 'Coupon does not apply to this offer';
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  IF array_length(v_coupon.excluded_offer_ids, 1) IS NOT NULL THEN
    IF p_offer_id IS NOT NULL AND p_offer_id = ANY(v_coupon.excluded_offer_ids) THEN
      message := 'Coupon is excluded for this offer';
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  IF array_length(v_coupon.applicable_car_models, 1) IS NOT NULL THEN
    IF coalesce(v_model, '') = '' OR NOT EXISTS (
      SELECT 1
      FROM unnest(v_coupon.applicable_car_models) AS m
      WHERE lower(trim(m)) = v_model
    ) THEN
      message := 'Coupon does not apply to this car model';
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  IF array_length(v_coupon.excluded_car_models, 1) IS NOT NULL THEN
    IF coalesce(v_model, '') <> '' AND EXISTS (
      SELECT 1
      FROM unnest(v_coupon.excluded_car_models) AS m
      WHERE lower(trim(m)) = v_model
    ) THEN
      message := 'Coupon is excluded for this car model';
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  IF array_length(v_coupon.applicable_car_types, 1) IS NOT NULL THEN
    IF coalesce(v_type, '') = '' OR NOT EXISTS (
      SELECT 1
      FROM unnest(v_coupon.applicable_car_types) AS t
      WHERE lower(trim(t)) = v_type
    ) THEN
      message := 'Coupon does not apply to this car type';
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  IF array_length(v_coupon.excluded_car_types, 1) IS NOT NULL THEN
    IF coalesce(v_type, '') <> '' AND EXISTS (
      SELECT 1
      FROM unnest(v_coupon.excluded_car_types) AS t
      WHERE lower(trim(t)) = v_type
    ) THEN
      message := 'Coupon is excluded for this car type';
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  IF v_coupon.min_rental_days IS NOT NULL AND v_rental_days < v_coupon.min_rental_days THEN
    message := format('Minimum rental duration for this coupon is %s day(s)', v_coupon.min_rental_days);
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_coupon.min_rental_total IS NOT NULL AND v_base < v_coupon.min_rental_total THEN
    message := format('Minimum rental total for this coupon is %.2f EUR', v_coupon.min_rental_total);
    RETURN NEXT;
    RETURN;
  END IF;

  v_total_limit := v_coupon.usage_limit_total;
  v_user_limit := v_coupon.usage_limit_per_user;

  IF v_coupon.single_use THEN
    v_total_limit := 1;
    IF v_user_limit IS NULL OR v_user_limit > 1 THEN
      v_user_limit := 1;
    END IF;
  END IF;

  SELECT count(*)::integer
  INTO v_total_redemptions
  FROM public.car_coupon_redemptions
  WHERE coupon_id = v_coupon.id;

  IF v_total_limit IS NOT NULL AND v_total_redemptions >= v_total_limit THEN
    message := 'Coupon usage limit reached';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_user_limit IS NOT NULL THEN
    IF p_user_id IS NOT NULL THEN
      SELECT count(*)::integer
      INTO v_user_redemptions
      FROM public.car_coupon_redemptions
      WHERE coupon_id = v_coupon.id
        AND user_id = p_user_id;
    ELSE
      IF v_user_email = '' THEN
        message := 'Coupon requires customer email to validate per-user limit';
        RETURN NEXT;
        RETURN;
      END IF;

      SELECT count(*)::integer
      INTO v_user_redemptions
      FROM public.car_coupon_redemptions
      WHERE coupon_id = v_coupon.id
        AND lower(trim(coalesce(user_email, ''))) = v_user_email;
    END IF;

    IF v_user_redemptions >= v_user_limit THEN
      message := 'Per-user coupon limit reached';
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  IF v_coupon.discount_type = 'percent' THEN
    v_discount := round((v_base * coalesce(v_coupon.discount_value, 0)) / 100.0, 2);
  ELSE
    v_discount := round(coalesce(v_coupon.discount_value, 0), 2);
  END IF;

  IF v_discount < 0 THEN v_discount := 0; END IF;
  IF v_discount > v_base THEN v_discount := v_base; END IF;

  v_final := round(greatest(v_base - v_discount, 0), 2);

  is_valid := true;
  message := 'Coupon applied';
  coupon_id := v_coupon.id;
  coupon_code := v_coupon.code;
  discount_type := v_coupon.discount_type;
  discount_value := v_coupon.discount_value;
  base_rental_price := round(v_base, 2);
  discount_amount := v_discount;
  final_rental_price := v_final;
  currency := coalesce(nullif(v_coupon.currency, ''), 'EUR');
  partner_id := v_coupon.partner_id;
  partner_commission_bps_override := v_coupon.partner_commission_bps_override;

  RETURN NEXT;
  RETURN;
END;
$$;

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

CREATE OR REPLACE FUNCTION public.trg_car_coupon_redemption_from_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_base numeric;
  v_discount numeric;
  v_final numeric;
  v_currency text;
  v_user_id uuid;
  v_source text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF NEW.coupon_id IS NULL THEN
    DELETE FROM public.car_coupon_redemptions
    WHERE booking_id = NEW.id;
    RETURN NEW;
  END IF;

  v_email := lower(trim(coalesce(NEW.customer_email, NEW.email, '')));
  v_base := coalesce(
    NEW.base_rental_price,
    NEW.final_rental_price + coalesce(NEW.coupon_discount_amount, 0),
    NEW.final_price,
    NEW.quoted_price,
    NEW.total_price
  );
  v_discount := coalesce(
    NEW.coupon_discount_amount,
    CASE
      WHEN NEW.final_rental_price IS NOT NULL THEN greatest(v_base - NEW.final_rental_price, 0)
      ELSE 0
    END
  );
  v_final := coalesce(
    NEW.final_rental_price,
    greatest(v_base - coalesce(v_discount, 0), 0),
    NEW.final_price,
    NEW.quoted_price,
    NEW.total_price
  );
  v_currency := coalesce(nullif(NEW.currency, ''), 'EUR');
  v_user_id := public.try_uuid(to_jsonb(NEW)->>'user_id');
  v_source := CASE
    WHEN lower(coalesce(NEW.source, '')) LIKE 'admin%' THEN 'admin'
    ELSE 'booking'
  END;

  DELETE FROM public.car_coupon_redemptions
  WHERE booking_id = NEW.id
    AND coupon_id <> NEW.coupon_id;

  INSERT INTO public.car_coupon_redemptions(
    coupon_id,
    booking_id,
    user_id,
    user_email,
    base_rental_price,
    discount_amount,
    final_rental_price,
    currency,
    source
  )
  VALUES (
    NEW.coupon_id,
    NEW.id,
    v_user_id,
    nullif(v_email, ''),
    round(coalesce(v_base, 0), 2),
    round(coalesce(v_discount, 0), 2),
    round(coalesce(v_final, 0), 2),
    v_currency,
    v_source
  )
  ON CONFLICT (coupon_id, booking_id)
  DO UPDATE SET
    user_id = EXCLUDED.user_id,
    user_email = EXCLUDED.user_email,
    base_rental_price = EXCLUDED.base_rental_price,
    discount_amount = EXCLUDED.discount_amount,
    final_rental_price = EXCLUDED.final_rental_price,
    currency = EXCLUDED.currency,
    source = EXCLUDED.source;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_car_coupon_redemption_from_booking_ins ON public.car_bookings;
CREATE TRIGGER trg_car_coupon_redemption_from_booking_ins
  AFTER INSERT ON public.car_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_car_coupon_redemption_from_booking();

DROP TRIGGER IF EXISTS trg_car_coupon_redemption_from_booking_upd ON public.car_bookings;
CREATE TRIGGER trg_car_coupon_redemption_from_booking_upd
  AFTER UPDATE OF coupon_id, coupon_code, base_rental_price, coupon_discount_amount, final_rental_price, final_price, quoted_price, total_price, currency, email, customer_email, source ON public.car_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_car_coupon_redemption_from_booking();

REVOKE ALL ON FUNCTION public.car_coupon_quote(text, numeric, timestamptz, timestamptz, uuid, text, text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.car_coupon_quote(text, numeric, timestamptz, timestamptz, uuid, text, text, text, uuid, text) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.car_coupon_quote(text, numeric, timestamptz, timestamptz, uuid, text, text, text, uuid, text)
IS 'Validates a car coupon and returns discounted rental totals for a given booking context. Coupon affects rental total only.';


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
    'duration_days', public.car_booking_rental_days(
      NEW.pickup_date,
      NEW.pickup_time::text,
      NEW.return_date,
      NEW.return_time::text
    ),
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
    END,
    'coupon_id', public.try_uuid(j->>'coupon_id'),
    'coupon_code', NULLIF(j->>'coupon_code', ''),
    'base_rental_price', public.try_numeric(j->>'base_rental_price'),
    'coupon_discount_amount', public.try_numeric(j->>'coupon_discount_amount'),
    'final_rental_price', public.try_numeric(j->>'final_rental_price'),
    'coupon_partner_id', public.try_uuid(j->>'coupon_partner_id'),
    'coupon_partner_commission_bps', public.try_numeric(j->>'coupon_partner_commission_bps')
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
    END,
    'coupon_id', public.try_uuid(j->>'coupon_id'),
    'coupon_code', NULLIF(j->>'coupon_code', ''),
    'base_rental_price', public.try_numeric(j->>'base_rental_price'),
    'coupon_discount_amount', public.try_numeric(j->>'coupon_discount_amount'),
    'final_rental_price', public.try_numeric(j->>'final_rental_price'),
    'coupon_partner_id', public.try_uuid(j->>'coupon_partner_id'),
    'coupon_partner_commission_bps', public.try_numeric(j->>'coupon_partner_commission_bps')
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
