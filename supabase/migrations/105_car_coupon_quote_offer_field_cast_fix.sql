-- =====================================================
-- Patch car_coupon_quote for mixed text/jsonb offer fields
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
      lower(trim(coalesce(
        nullif(to_jsonb(location)#>>'{}', ''),
        ''
      ))),
      lower(trim(coalesce(
        nullif(to_jsonb(car_model)#>>'{en}', ''),
        nullif(to_jsonb(car_model)#>>'{pl}', ''),
        nullif(to_jsonb(car_model)#>>'{el}', ''),
        nullif(to_jsonb(car_model)#>>'{he}', ''),
        nullif(to_jsonb(car_model)#>>'{}', ''),
        ''
      ))),
      lower(trim(coalesce(
        nullif(to_jsonb(car_type)#>>'{en}', ''),
        nullif(to_jsonb(car_type)#>>'{pl}', ''),
        nullif(to_jsonb(car_type)#>>'{el}', ''),
        nullif(to_jsonb(car_type)#>>'{he}', ''),
        nullif(to_jsonb(car_type)#>>'{}', ''),
        ''
      )))
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

REVOKE ALL ON FUNCTION public.car_coupon_quote(text, numeric, timestamptz, timestamptz, uuid, text, text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.car_coupon_quote(text, numeric, timestamptz, timestamptz, uuid, text, text, text, uuid, text) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.car_coupon_quote(text, numeric, timestamptz, timestamptz, uuid, text, text, text, uuid, text)
IS 'Validates a car coupon and returns discounted rental totals for a given booking context. Coupon affects rental total only.';
