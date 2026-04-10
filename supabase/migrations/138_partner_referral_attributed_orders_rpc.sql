CREATE OR REPLACE FUNCTION public.partner_get_referral_attributed_orders(
  p_partner_id uuid,
  p_limit integer DEFAULT 40
)
RETURNS TABLE (
  booking_id uuid,
  service_type text,
  service_id uuid,
  service_slug text,
  service_date text,
  customer_name text,
  booking_status text,
  payment_status text,
  total_amount numeric,
  currency text,
  referral_code text,
  referral_source text,
  referral_captured_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := greatest(1, least(coalesce(p_limit, 40), 200));
BEGIN
  IF p_partner_id IS NULL THEN
    RAISE EXCEPTION 'missing_partner_id';
  END IF;

  IF NOT (public.is_current_user_admin() OR public.is_partner_user(p_partner_id)) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
  WITH attributed_orders AS (
    SELECT
      hb.id AS booking_id,
      'hotels'::text AS service_type,
      hb.hotel_id AS service_id,
      hb.hotel_slug AS service_slug,
      coalesce(hb.arrival_date::text, hb.created_at::date::text) AS service_date,
      hb.customer_name,
      hb.status AS booking_status,
      null::text AS payment_status,
      coalesce(hb.total_price, hb.final_price, hb.base_price, 0)::numeric AS total_amount,
      'EUR'::text AS currency,
      hb.referral_code,
      hb.referral_source,
      hb.referral_captured_at,
      hb.created_at
    FROM public.hotel_bookings hb
    WHERE hb.referral_partner_id = p_partner_id

    UNION ALL

    SELECT
      tb.id AS booking_id,
      'trips'::text AS service_type,
      tb.trip_id AS service_id,
      tb.trip_slug AS service_slug,
      coalesce(tb.trip_date::text, tb.arrival_date::text, tb.created_at::date::text) AS service_date,
      tb.customer_name,
      tb.status AS booking_status,
      null::text AS payment_status,
      coalesce(tb.total_price, tb.final_price, tb.base_price, 0)::numeric AS total_amount,
      'EUR'::text AS currency,
      tb.referral_code,
      tb.referral_source,
      tb.referral_captured_at,
      tb.created_at
    FROM public.trip_bookings tb
    WHERE tb.referral_partner_id = p_partner_id

    UNION ALL

    SELECT
      cb.id AS booking_id,
      'cars'::text AS service_type,
      cb.offer_id AS service_id,
      null::text AS service_slug,
      coalesce(cb.pickup_date::text, cb.created_at::date::text) AS service_date,
      cb.customer_name,
      cb.status AS booking_status,
      null::text AS payment_status,
      coalesce(cb.total_price, 0)::numeric AS total_amount,
      'EUR'::text AS currency,
      cb.referral_code,
      cb.referral_source,
      cb.referral_captured_at,
      cb.created_at
    FROM public.car_bookings cb
    WHERE cb.referral_partner_id = p_partner_id

    UNION ALL

    SELECT
      trb.id AS booking_id,
      'transport'::text AS service_type,
      trb.route_id AS service_id,
      null::text AS service_slug,
      coalesce(trb.travel_date::text, trb.created_at::date::text) AS service_date,
      trb.customer_name,
      trb.status AS booking_status,
      trb.payment_status,
      coalesce(trb.total_price, 0)::numeric AS total_amount,
      coalesce(nullif(trb.currency, ''), 'EUR')::text AS currency,
      trb.referral_code,
      trb.referral_source,
      trb.referral_captured_at,
      trb.created_at
    FROM public.transport_bookings trb
    WHERE trb.referral_partner_id = p_partner_id
  )
  SELECT
    ao.booking_id,
    ao.service_type,
    ao.service_id,
    ao.service_slug,
    ao.service_date,
    ao.customer_name,
    ao.booking_status,
    ao.payment_status,
    ao.total_amount,
    ao.currency,
    ao.referral_code,
    ao.referral_source,
    ao.referral_captured_at,
    ao.created_at
  FROM attributed_orders ao
  ORDER BY ao.created_at DESC NULLS LAST, ao.booking_id DESC
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.partner_get_referral_attributed_orders(uuid, integer) TO authenticated;
