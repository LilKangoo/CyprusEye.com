-- =====================================================
-- Service coupons: quote RPC + enforced booking snapshots
-- Applies to: trips, hotels, transport
-- =====================================================

CREATE OR REPLACE FUNCTION public.service_coupon_quote(
  p_service_type text,
  p_coupon_code text,
  p_base_total numeric,
  p_service_at timestamptz DEFAULT NULL,
  p_resource_id uuid DEFAULT NULL,
  p_category_keys text[] DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_user_email text DEFAULT NULL
)
RETURNS TABLE (
  is_valid boolean,
  message text,
  coupon_id uuid,
  coupon_code text,
  discount_type text,
  discount_value numeric,
  base_total numeric,
  discount_amount numeric,
  final_total numeric,
  currency text,
  partner_id uuid,
  partner_commission_bps_override integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service text := lower(trim(coalesce(p_service_type, '')));
  v_code text := upper(trim(coalesce(p_coupon_code, '')));
  v_coupon public.service_coupons%ROWTYPE;
  v_base numeric := round(greatest(coalesce(p_base_total, 0), 0), 2);
  v_discount numeric := 0;
  v_final numeric := 0;
  v_service_date date := COALESCE((p_service_at AT TIME ZONE 'UTC')::date, (now() AT TIME ZONE 'UTC')::date);
  v_scope_mode text := 'all';
  v_category_keys text[] := ARRAY[]::text[];
  v_resource_ids text[] := ARRAY[]::text[];
  v_input_categories text[] := ARRAY[]::text[];
  v_match boolean := false;
  v_total_uses integer := 0;
  v_user_uses integer := 0;
  v_user_email_norm text := lower(trim(coalesce(p_user_email, '')));
BEGIN
  is_valid := false;
  message := 'Invalid coupon';
  coupon_id := NULL;
  coupon_code := NULL;
  discount_type := NULL;
  discount_value := NULL;
  base_total := v_base;
  discount_amount := 0;
  final_total := v_base;
  currency := 'EUR';
  partner_id := NULL;
  partner_commission_bps_override := NULL;

  IF v_service NOT IN ('trips', 'hotels', 'transport', 'shop') THEN
    message := 'Unsupported service type';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_code = '' THEN
    message := 'Enter a coupon code';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_base <= 0 THEN
    message := 'Booking total must be greater than zero';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT *
  INTO v_coupon
  FROM public.service_coupons
  WHERE service_type = v_service
    AND upper(code) = v_code
  LIMIT 1;

  IF v_coupon.id IS NULL THEN
    message := 'Coupon not found';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_coupon.status <> 'active' OR v_coupon.is_active IS NOT TRUE THEN
    message := 'Coupon is not active';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_coupon.starts_at IS NOT NULL
     AND v_service_date < (v_coupon.starts_at AT TIME ZONE 'UTC')::date THEN
    message := 'Coupon is not valid yet';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_coupon.expires_at IS NOT NULL
     AND v_service_date > (v_coupon.expires_at AT TIME ZONE 'UTC')::date THEN
    message := 'Coupon has expired';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_coupon.min_order_total IS NOT NULL AND v_base < v_coupon.min_order_total THEN
    message := format('Minimum order total for this coupon is %.2f EUR', v_coupon.min_order_total);
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_coupon.rules IS NOT NULL AND jsonb_typeof(v_coupon.rules) = 'object' THEN
    v_scope_mode := lower(trim(coalesce(v_coupon.rules->>'scope_mode', 'all')));

    SELECT ARRAY(
      SELECT DISTINCT lower(trim(value))
      FROM jsonb_array_elements_text(coalesce(v_coupon.rules->'category_keys', '[]'::jsonb)) AS value
      WHERE trim(value) <> ''
    )
    INTO v_category_keys;

    SELECT ARRAY(
      SELECT DISTINCT trim(value)
      FROM jsonb_array_elements_text(coalesce(v_coupon.rules->'resource_ids', '[]'::jsonb)) AS value
      WHERE trim(value) <> ''
    )
    INTO v_resource_ids;
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT lower(trim(value))
    FROM unnest(coalesce(p_category_keys, ARRAY[]::text[])) AS value
    WHERE trim(value) <> ''
  )
  INTO v_input_categories;

  IF v_scope_mode = 'resource' THEN
    IF array_length(v_resource_ids, 1) IS NULL THEN
      message := 'Coupon resource scope is empty';
      RETURN NEXT;
      RETURN;
    END IF;
    IF p_resource_id IS NULL OR NOT (p_resource_id::text = ANY(v_resource_ids)) THEN
      message := 'Coupon does not apply to this item';
      RETURN NEXT;
      RETURN;
    END IF;
  ELSIF v_scope_mode = 'category' THEN
    IF array_length(v_category_keys, 1) IS NULL THEN
      message := 'Coupon category scope is empty';
      RETURN NEXT;
      RETURN;
    END IF;
    IF array_length(v_input_categories, 1) IS NULL THEN
      message := 'Coupon requires category match';
      RETURN NEXT;
      RETURN;
    END IF;
    SELECT EXISTS (
      SELECT 1
      FROM unnest(v_input_categories) AS c
      WHERE c = ANY(v_category_keys)
    )
    INTO v_match;
    IF NOT v_match THEN
      message := 'Coupon does not apply to this category';
      RETURN NEXT;
      RETURN;
    END IF;
  ELSE
    IF array_length(v_category_keys, 1) IS NOT NULL THEN
      IF array_length(v_input_categories, 1) IS NULL THEN
        message := 'Coupon requires category match';
        RETURN NEXT;
        RETURN;
      END IF;
      SELECT EXISTS (
        SELECT 1
        FROM unnest(v_input_categories) AS c
        WHERE c = ANY(v_category_keys)
      )
      INTO v_match;
      IF NOT v_match THEN
        message := 'Coupon does not apply to this category';
        RETURN NEXT;
        RETURN;
      END IF;
    END IF;
  END IF;

  SELECT count(*)::integer
  INTO v_total_uses
  FROM public.service_coupon_redemptions r
  WHERE r.coupon_id = v_coupon.id;

  IF v_coupon.usage_limit_total IS NOT NULL
     AND v_total_uses >= v_coupon.usage_limit_total THEN
    message := 'Coupon usage limit reached';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_coupon.usage_limit_per_user IS NOT NULL THEN
    IF p_user_id IS NOT NULL THEN
      SELECT count(*)::integer
      INTO v_user_uses
      FROM public.service_coupon_redemptions r
      WHERE r.coupon_id = v_coupon.id
        AND r.user_id = p_user_id;
    ELSIF v_user_email_norm <> '' THEN
      SELECT count(*)::integer
      INTO v_user_uses
      FROM public.service_coupon_redemptions r
      WHERE r.coupon_id = v_coupon.id
        AND lower(coalesce(r.user_email, '')) = v_user_email_norm;
    ELSE
      message := 'Coupon requires customer email to validate per-user limit';
      RETURN NEXT;
      RETURN;
    END IF;

    IF v_user_uses >= v_coupon.usage_limit_per_user THEN
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
  base_total := v_base;
  discount_amount := v_discount;
  final_total := v_final;
  currency := coalesce(nullif(v_coupon.currency, ''), 'EUR');
  partner_id := v_coupon.partner_id;
  partner_commission_bps_override := v_coupon.partner_commission_bps_override;

  RETURN NEXT;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.service_coupon_quote(text, text, numeric, timestamptz, uuid, text[], uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.service_coupon_quote(text, text, numeric, timestamptz, uuid, text[], uuid, text) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.service_coupon_quote(text, text, numeric, timestamptz, uuid, text[], uuid, text)
IS 'Validates service coupons (trips/hotels/transport/shop) and returns authoritative totals.';

CREATE OR REPLACE FUNCTION public.trg_apply_service_coupon_trip_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := upper(trim(coalesce(NEW.coupon_code, '')));
  v_base numeric;
  v_quote record;
  v_trip_slug text;
  v_trip_start_city text;
  v_service_at timestamptz;
  v_categories text[];
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  v_base := round(greatest(coalesce(
    NEW.base_price,
    NEW.final_price + coalesce(NEW.coupon_discount_amount, 0),
    NEW.total_price,
    0
  ), 0), 2);

  IF v_code = '' AND NEW.coupon_id IS NOT NULL THEN
    SELECT upper(trim(coalesce(code, '')))
    INTO v_code
    FROM public.service_coupons
    WHERE id = NEW.coupon_id
      AND service_type = 'trips'
    LIMIT 1;
  END IF;

  IF v_code = '' THEN
    NEW.coupon_id := NULL;
    NEW.coupon_code := NULL;
    NEW.coupon_discount_amount := 0;
    NEW.coupon_partner_id := NULL;
    NEW.coupon_partner_commission_bps := NULL;
    NEW.base_price := coalesce(NEW.base_price, v_base);
    NEW.final_price := coalesce(NEW.final_price, NEW.total_price, NEW.base_price, v_base);
    NEW.total_price := coalesce(NEW.final_price, NEW.total_price, v_base);
    RETURN NEW;
  END IF;

  IF NEW.trip_id IS NOT NULL THEN
    SELECT slug, start_city
    INTO v_trip_slug, v_trip_start_city
    FROM public.trips
    WHERE id = NEW.trip_id
    LIMIT 1;
  END IF;

  v_categories := array_remove(ARRAY[
    lower(nullif(NEW.trip_slug, '')),
    lower(nullif(v_trip_slug, '')),
    lower(nullif(v_trip_start_city, ''))
  ], NULL);

  v_service_at := COALESCE(
    NEW.trip_date::timestamptz,
    NEW.arrival_date::timestamptz,
    NEW.created_at,
    now()
  );

  SELECT *
  INTO v_quote
  FROM public.service_coupon_quote(
    'trips',
    v_code,
    v_base,
    v_service_at,
    NEW.trip_id,
    v_categories,
    public.try_uuid(to_jsonb(NEW)->>'user_id'),
    NEW.customer_email
  );

  IF coalesce(v_quote.is_valid, false) IS NOT TRUE THEN
    RAISE EXCEPTION '%', coalesce(v_quote.message, 'Invalid coupon');
  END IF;

  NEW.coupon_id := v_quote.coupon_id;
  NEW.coupon_code := v_quote.coupon_code;
  NEW.coupon_discount_amount := round(coalesce(v_quote.discount_amount, 0), 2);
  NEW.coupon_partner_id := v_quote.partner_id;
  NEW.coupon_partner_commission_bps := v_quote.partner_commission_bps_override;
  NEW.base_price := round(coalesce(v_quote.base_total, v_base), 2);
  NEW.final_price := round(coalesce(v_quote.final_total, v_base), 2);
  NEW.total_price := NEW.final_price;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_apply_service_coupon_hotel_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := upper(trim(coalesce(NEW.coupon_code, '')));
  v_base numeric;
  v_quote record;
  v_hotel_slug text;
  v_hotel_city text;
  v_service_at timestamptz;
  v_categories text[];
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  v_base := round(greatest(coalesce(
    NEW.base_price,
    NEW.final_price + coalesce(NEW.coupon_discount_amount, 0),
    NEW.total_price,
    0
  ), 0), 2);

  IF v_code = '' AND NEW.coupon_id IS NOT NULL THEN
    SELECT upper(trim(coalesce(code, '')))
    INTO v_code
    FROM public.service_coupons
    WHERE id = NEW.coupon_id
      AND service_type = 'hotels'
    LIMIT 1;
  END IF;

  IF v_code = '' THEN
    NEW.coupon_id := NULL;
    NEW.coupon_code := NULL;
    NEW.coupon_discount_amount := 0;
    NEW.coupon_partner_id := NULL;
    NEW.coupon_partner_commission_bps := NULL;
    NEW.base_price := coalesce(NEW.base_price, v_base);
    NEW.final_price := coalesce(NEW.final_price, NEW.total_price, NEW.base_price, v_base);
    NEW.total_price := coalesce(NEW.final_price, NEW.total_price, v_base);
    RETURN NEW;
  END IF;

  IF NEW.hotel_id IS NOT NULL THEN
    SELECT slug, city
    INTO v_hotel_slug, v_hotel_city
    FROM public.hotels
    WHERE id = NEW.hotel_id
    LIMIT 1;
  END IF;

  v_categories := array_remove(ARRAY[
    lower(nullif(NEW.hotel_slug, '')),
    lower(nullif(v_hotel_slug, '')),
    lower(nullif(v_hotel_city, ''))
  ], NULL);

  v_service_at := COALESCE(
    NEW.arrival_date::timestamptz,
    NEW.created_at,
    now()
  );

  SELECT *
  INTO v_quote
  FROM public.service_coupon_quote(
    'hotels',
    v_code,
    v_base,
    v_service_at,
    NEW.hotel_id,
    v_categories,
    public.try_uuid(to_jsonb(NEW)->>'user_id'),
    NEW.customer_email
  );

  IF coalesce(v_quote.is_valid, false) IS NOT TRUE THEN
    RAISE EXCEPTION '%', coalesce(v_quote.message, 'Invalid coupon');
  END IF;

  NEW.coupon_id := v_quote.coupon_id;
  NEW.coupon_code := v_quote.coupon_code;
  NEW.coupon_discount_amount := round(coalesce(v_quote.discount_amount, 0), 2);
  NEW.coupon_partner_id := v_quote.partner_id;
  NEW.coupon_partner_commission_bps := v_quote.partner_commission_bps_override;
  NEW.base_price := round(coalesce(v_quote.base_total, v_base), 2);
  NEW.final_price := round(coalesce(v_quote.final_total, v_base), 2);
  NEW.total_price := NEW.final_price;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_apply_service_coupon_transport_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := upper(trim(coalesce(NEW.coupon_code, '')));
  v_base numeric;
  v_quote record;
  v_origin_name text;
  v_origin_code text;
  v_destination_name text;
  v_destination_code text;
  v_service_at timestamptz;
  v_categories text[];
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  v_base := round(greatest(coalesce(
    NEW.total_price + coalesce(NEW.coupon_discount_amount, 0),
    NEW.base_price + coalesce(NEW.extras_price, 0),
    NEW.total_price,
    0
  ), 0), 2);

  IF v_code = '' AND NEW.coupon_id IS NOT NULL THEN
    SELECT upper(trim(coalesce(code, '')))
    INTO v_code
    FROM public.service_coupons
    WHERE id = NEW.coupon_id
      AND service_type = 'transport'
    LIMIT 1;
  END IF;

  IF v_code = '' THEN
    NEW.coupon_id := NULL;
    NEW.coupon_code := NULL;
    NEW.coupon_discount_amount := 0;
    NEW.coupon_partner_id := NULL;
    NEW.coupon_partner_commission_bps := NULL;
    NEW.total_price := coalesce(NEW.total_price, v_base);
    IF NEW.deposit_amount IS NOT NULL THEN
      NEW.deposit_amount := round(least(greatest(NEW.deposit_amount, 0), coalesce(NEW.total_price, 0)), 2);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.route_id IS NOT NULL THEN
    SELECT
      lo.name,
      lo.code,
      ld.name,
      ld.code
    INTO v_origin_name, v_origin_code, v_destination_name, v_destination_code
    FROM public.transport_routes r
    LEFT JOIN public.transport_locations lo ON lo.id = r.origin_location_id
    LEFT JOIN public.transport_locations ld ON ld.id = r.destination_location_id
    WHERE r.id = NEW.route_id
    LIMIT 1;
  END IF;

  v_categories := array_remove(ARRAY[
    lower(nullif(v_origin_name, '')),
    lower(nullif(v_origin_code, '')),
    lower(nullif(v_destination_name, '')),
    lower(nullif(v_destination_code, ''))
  ], NULL);

  v_service_at := COALESCE(
    NEW.travel_date::timestamptz,
    NEW.created_at,
    now()
  );

  SELECT *
  INTO v_quote
  FROM public.service_coupon_quote(
    'transport',
    v_code,
    v_base,
    v_service_at,
    NEW.route_id,
    v_categories,
    public.try_uuid(to_jsonb(NEW)->>'user_id'),
    NEW.customer_email
  );

  IF coalesce(v_quote.is_valid, false) IS NOT TRUE THEN
    RAISE EXCEPTION '%', coalesce(v_quote.message, 'Invalid coupon');
  END IF;

  NEW.coupon_id := v_quote.coupon_id;
  NEW.coupon_code := v_quote.coupon_code;
  NEW.coupon_discount_amount := round(coalesce(v_quote.discount_amount, 0), 2);
  NEW.coupon_partner_id := v_quote.partner_id;
  NEW.coupon_partner_commission_bps := v_quote.partner_commission_bps_override;
  NEW.total_price := round(coalesce(v_quote.final_total, v_base), 2);
  IF NEW.deposit_amount IS NOT NULL THEN
    NEW.deposit_amount := round(least(greatest(NEW.deposit_amount, 0), NEW.total_price), 2);
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.trip_bookings') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_apply_service_coupon_trip_booking_biu ON public.trip_bookings';
    EXECUTE 'CREATE TRIGGER trg_apply_service_coupon_trip_booking_biu BEFORE INSERT OR UPDATE ON public.trip_bookings FOR EACH ROW EXECUTE FUNCTION public.trg_apply_service_coupon_trip_booking()';
  END IF;

  IF to_regclass('public.hotel_bookings') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_apply_service_coupon_hotel_booking_biu ON public.hotel_bookings';
    EXECUTE 'CREATE TRIGGER trg_apply_service_coupon_hotel_booking_biu BEFORE INSERT OR UPDATE ON public.hotel_bookings FOR EACH ROW EXECUTE FUNCTION public.trg_apply_service_coupon_hotel_booking()';
  END IF;

  IF to_regclass('public.transport_bookings') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_apply_service_coupon_transport_booking_biu ON public.transport_bookings';
    EXECUTE 'CREATE TRIGGER trg_apply_service_coupon_transport_booking_biu BEFORE INSERT OR UPDATE ON public.transport_bookings FOR EACH ROW EXECUTE FUNCTION public.trg_apply_service_coupon_transport_booking()';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.trg_service_coupon_redemption_from_trip_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_base numeric;
  v_discount numeric;
  v_final numeric;
  v_user_id uuid;
  v_source text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.service_coupon_redemptions
    WHERE service_type = 'trips'
      AND booking_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.coupon_id IS NULL THEN
    DELETE FROM public.service_coupon_redemptions
    WHERE service_type = 'trips'
      AND booking_id = NEW.id;
    RETURN NEW;
  END IF;

  v_email := lower(trim(coalesce(NEW.customer_email, '')));
  v_base := coalesce(
    NEW.base_price,
    NEW.final_price + coalesce(NEW.coupon_discount_amount, 0),
    NEW.total_price
  );
  v_discount := coalesce(
    NEW.coupon_discount_amount,
    greatest(coalesce(v_base, 0) - coalesce(NEW.final_price, NEW.total_price, 0), 0)
  );
  v_final := coalesce(
    NEW.final_price,
    greatest(coalesce(v_base, 0) - coalesce(v_discount, 0), 0),
    NEW.total_price
  );
  v_user_id := public.try_uuid(to_jsonb(NEW)->>'user_id');
  v_source := CASE
    WHEN lower(coalesce(to_jsonb(NEW)->>'source', '')) LIKE 'admin%' THEN 'admin'
    ELSE 'booking'
  END;

  DELETE FROM public.service_coupon_redemptions
  WHERE service_type = 'trips'
    AND booking_id = NEW.id
    AND coupon_id <> NEW.coupon_id;

  INSERT INTO public.service_coupon_redemptions(
    coupon_id,
    service_type,
    booking_id,
    booking_reference,
    user_id,
    user_email,
    base_total,
    discount_amount,
    final_total,
    currency,
    source
  )
  VALUES (
    NEW.coupon_id,
    'trips',
    NEW.id,
    CONCAT('TRIP-', SUBSTRING(NEW.id::text, 1, 8)),
    v_user_id,
    nullif(v_email, ''),
    round(coalesce(v_base, 0), 2),
    round(coalesce(v_discount, 0), 2),
    round(coalesce(v_final, 0), 2),
    'EUR',
    v_source
  )
  ON CONFLICT (coupon_id, booking_id)
  DO UPDATE SET
    service_type = EXCLUDED.service_type,
    booking_reference = EXCLUDED.booking_reference,
    user_id = EXCLUDED.user_id,
    user_email = EXCLUDED.user_email,
    base_total = EXCLUDED.base_total,
    discount_amount = EXCLUDED.discount_amount,
    final_total = EXCLUDED.final_total,
    currency = EXCLUDED.currency,
    source = EXCLUDED.source;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_service_coupon_redemption_from_hotel_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_base numeric;
  v_discount numeric;
  v_final numeric;
  v_user_id uuid;
  v_source text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.service_coupon_redemptions
    WHERE service_type = 'hotels'
      AND booking_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.coupon_id IS NULL THEN
    DELETE FROM public.service_coupon_redemptions
    WHERE service_type = 'hotels'
      AND booking_id = NEW.id;
    RETURN NEW;
  END IF;

  v_email := lower(trim(coalesce(NEW.customer_email, '')));
  v_base := coalesce(
    NEW.base_price,
    NEW.final_price + coalesce(NEW.coupon_discount_amount, 0),
    NEW.total_price
  );
  v_discount := coalesce(
    NEW.coupon_discount_amount,
    greatest(coalesce(v_base, 0) - coalesce(NEW.final_price, NEW.total_price, 0), 0)
  );
  v_final := coalesce(
    NEW.final_price,
    greatest(coalesce(v_base, 0) - coalesce(v_discount, 0), 0),
    NEW.total_price
  );
  v_user_id := public.try_uuid(to_jsonb(NEW)->>'user_id');
  v_source := CASE
    WHEN lower(coalesce(to_jsonb(NEW)->>'source', '')) LIKE 'admin%' THEN 'admin'
    ELSE 'booking'
  END;

  DELETE FROM public.service_coupon_redemptions
  WHERE service_type = 'hotels'
    AND booking_id = NEW.id
    AND coupon_id <> NEW.coupon_id;

  INSERT INTO public.service_coupon_redemptions(
    coupon_id,
    service_type,
    booking_id,
    booking_reference,
    user_id,
    user_email,
    base_total,
    discount_amount,
    final_total,
    currency,
    source
  )
  VALUES (
    NEW.coupon_id,
    'hotels',
    NEW.id,
    CONCAT('HOTEL-', SUBSTRING(NEW.id::text, 1, 8)),
    v_user_id,
    nullif(v_email, ''),
    round(coalesce(v_base, 0), 2),
    round(coalesce(v_discount, 0), 2),
    round(coalesce(v_final, 0), 2),
    'EUR',
    v_source
  )
  ON CONFLICT (coupon_id, booking_id)
  DO UPDATE SET
    service_type = EXCLUDED.service_type,
    booking_reference = EXCLUDED.booking_reference,
    user_id = EXCLUDED.user_id,
    user_email = EXCLUDED.user_email,
    base_total = EXCLUDED.base_total,
    discount_amount = EXCLUDED.discount_amount,
    final_total = EXCLUDED.final_total,
    currency = EXCLUDED.currency,
    source = EXCLUDED.source;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_service_coupon_redemption_from_transport_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_base numeric;
  v_discount numeric;
  v_final numeric;
  v_user_id uuid;
  v_source text;
  v_currency text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.service_coupon_redemptions
    WHERE service_type = 'transport'
      AND booking_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.coupon_id IS NULL THEN
    DELETE FROM public.service_coupon_redemptions
    WHERE service_type = 'transport'
      AND booking_id = NEW.id;
    RETURN NEW;
  END IF;

  v_email := lower(trim(coalesce(NEW.customer_email, '')));
  v_base := coalesce(
    NEW.total_price + coalesce(NEW.coupon_discount_amount, 0),
    NEW.base_price + coalesce(NEW.extras_price, 0),
    NEW.total_price
  );
  v_discount := coalesce(
    NEW.coupon_discount_amount,
    greatest(coalesce(v_base, 0) - coalesce(NEW.total_price, 0), 0)
  );
  v_final := coalesce(
    NEW.total_price,
    greatest(coalesce(v_base, 0) - coalesce(v_discount, 0), 0)
  );
  v_user_id := public.try_uuid(to_jsonb(NEW)->>'user_id');
  v_source := CASE
    WHEN lower(coalesce(to_jsonb(NEW)->>'source', '')) LIKE 'admin%' THEN 'admin'
    ELSE 'booking'
  END;
  v_currency := coalesce(nullif(NEW.currency, ''), 'EUR');

  DELETE FROM public.service_coupon_redemptions
  WHERE service_type = 'transport'
    AND booking_id = NEW.id
    AND coupon_id <> NEW.coupon_id;

  INSERT INTO public.service_coupon_redemptions(
    coupon_id,
    service_type,
    booking_id,
    booking_reference,
    user_id,
    user_email,
    base_total,
    discount_amount,
    final_total,
    currency,
    source
  )
  VALUES (
    NEW.coupon_id,
    'transport',
    NEW.id,
    CONCAT('TRANSPORT-', SUBSTRING(NEW.id::text, 1, 8)),
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
    service_type = EXCLUDED.service_type,
    booking_reference = EXCLUDED.booking_reference,
    user_id = EXCLUDED.user_id,
    user_email = EXCLUDED.user_email,
    base_total = EXCLUDED.base_total,
    discount_amount = EXCLUDED.discount_amount,
    final_total = EXCLUDED.final_total,
    currency = EXCLUDED.currency,
    source = EXCLUDED.source;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.trip_bookings') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_service_coupon_redemption_from_trip_booking_ins ON public.trip_bookings';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_service_coupon_redemption_from_trip_booking_upd ON public.trip_bookings';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_service_coupon_redemption_from_trip_booking_del ON public.trip_bookings';
    EXECUTE 'CREATE TRIGGER trg_service_coupon_redemption_from_trip_booking_ins AFTER INSERT ON public.trip_bookings FOR EACH ROW EXECUTE FUNCTION public.trg_service_coupon_redemption_from_trip_booking()';
    EXECUTE 'CREATE TRIGGER trg_service_coupon_redemption_from_trip_booking_upd AFTER UPDATE ON public.trip_bookings FOR EACH ROW EXECUTE FUNCTION public.trg_service_coupon_redemption_from_trip_booking()';
    EXECUTE 'CREATE TRIGGER trg_service_coupon_redemption_from_trip_booking_del AFTER DELETE ON public.trip_bookings FOR EACH ROW EXECUTE FUNCTION public.trg_service_coupon_redemption_from_trip_booking()';
  END IF;

  IF to_regclass('public.hotel_bookings') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_service_coupon_redemption_from_hotel_booking_ins ON public.hotel_bookings';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_service_coupon_redemption_from_hotel_booking_upd ON public.hotel_bookings';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_service_coupon_redemption_from_hotel_booking_del ON public.hotel_bookings';
    EXECUTE 'CREATE TRIGGER trg_service_coupon_redemption_from_hotel_booking_ins AFTER INSERT ON public.hotel_bookings FOR EACH ROW EXECUTE FUNCTION public.trg_service_coupon_redemption_from_hotel_booking()';
    EXECUTE 'CREATE TRIGGER trg_service_coupon_redemption_from_hotel_booking_upd AFTER UPDATE ON public.hotel_bookings FOR EACH ROW EXECUTE FUNCTION public.trg_service_coupon_redemption_from_hotel_booking()';
    EXECUTE 'CREATE TRIGGER trg_service_coupon_redemption_from_hotel_booking_del AFTER DELETE ON public.hotel_bookings FOR EACH ROW EXECUTE FUNCTION public.trg_service_coupon_redemption_from_hotel_booking()';
  END IF;

  IF to_regclass('public.transport_bookings') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_service_coupon_redemption_from_transport_booking_ins ON public.transport_bookings';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_service_coupon_redemption_from_transport_booking_upd ON public.transport_bookings';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_service_coupon_redemption_from_transport_booking_del ON public.transport_bookings';
    EXECUTE 'CREATE TRIGGER trg_service_coupon_redemption_from_transport_booking_ins AFTER INSERT ON public.transport_bookings FOR EACH ROW EXECUTE FUNCTION public.trg_service_coupon_redemption_from_transport_booking()';
    EXECUTE 'CREATE TRIGGER trg_service_coupon_redemption_from_transport_booking_upd AFTER UPDATE ON public.transport_bookings FOR EACH ROW EXECUTE FUNCTION public.trg_service_coupon_redemption_from_transport_booking()';
    EXECUTE 'CREATE TRIGGER trg_service_coupon_redemption_from_transport_booking_del AFTER DELETE ON public.transport_bookings FOR EACH ROW EXECUTE FUNCTION public.trg_service_coupon_redemption_from_transport_booking()';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.trg_sync_trip_coupon_to_fulfillment()
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
        'final_price', NEW.final_price
      )
    ),
    updated_at = now()
  WHERE f.resource_type IN ('trips', 'trip')
    AND f.booking_id = NEW.id;

  RETURN NEW;
END;
$$;

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
        'final_price', NEW.final_price
      )
    ),
    updated_at = now()
  WHERE f.resource_type = 'hotels'
    AND f.booking_id = NEW.id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_transport_coupon_to_fulfillment()
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
        'final_price', NEW.total_price
      )
    ),
    updated_at = now()
  WHERE f.resource_type = 'transport'
    AND f.booking_id = NEW.id;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.partner_service_fulfillments') IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('public.trip_bookings') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS zz_trg_sync_trip_coupon_to_fulfillment_aiu ON public.trip_bookings';
    EXECUTE 'CREATE TRIGGER zz_trg_sync_trip_coupon_to_fulfillment_aiu AFTER INSERT OR UPDATE ON public.trip_bookings FOR EACH ROW EXECUTE FUNCTION public.trg_sync_trip_coupon_to_fulfillment()';
  END IF;

  IF to_regclass('public.hotel_bookings') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS zz_trg_sync_hotel_coupon_to_fulfillment_aiu ON public.hotel_bookings';
    EXECUTE 'CREATE TRIGGER zz_trg_sync_hotel_coupon_to_fulfillment_aiu AFTER INSERT OR UPDATE ON public.hotel_bookings FOR EACH ROW EXECUTE FUNCTION public.trg_sync_hotel_coupon_to_fulfillment()';
  END IF;

  IF to_regclass('public.transport_bookings') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS zz_trg_sync_transport_coupon_to_fulfillment_aiu ON public.transport_bookings';
    EXECUTE 'CREATE TRIGGER zz_trg_sync_transport_coupon_to_fulfillment_aiu AFTER INSERT OR UPDATE ON public.transport_bookings FOR EACH ROW EXECUTE FUNCTION public.trg_sync_transport_coupon_to_fulfillment()';
  END IF;
END $$;

