DROP FUNCTION IF EXISTS public.get_service_deposit_status(uuid);

CREATE OR REPLACE FUNCTION public.get_service_deposit_status(p_id uuid)
RETURNS TABLE(
  id uuid,
  status text,
  paid_at timestamptz,
  amount numeric,
  currency text,
  fulfillment_reference text,
  fulfillment_summary text,
  resource_type text,
  booking_id uuid,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  fulfillment_id uuid,
  fulfillment_total_price numeric,
  booking_total_price numeric,
  trip_title_en text,
  trip_title_pl text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.status,
    r.paid_at,
    r.amount,
    r.currency,
    r.fulfillment_reference,
    r.fulfillment_summary,
    r.resource_type,
    r.booking_id,
    r.stripe_checkout_session_id,
    r.stripe_payment_intent_id,
    r.fulfillment_id,
    f.total_price AS fulfillment_total_price,
    CASE
      WHEN lower(coalesce(r.resource_type, '')) IN ('trips', 'trip')
        THEN tb.total_price
      WHEN lower(coalesce(r.resource_type, '')) IN ('cars', 'car')
        THEN COALESCE(
          cb.total_price,
          public.try_numeric(to_jsonb(cb)->>'final_price'),
          public.try_numeric(to_jsonb(cb)->>'quoted_price')
        )
      WHEN lower(coalesce(r.resource_type, '')) IN ('hotels', 'hotel')
        THEN hb.total_price
      WHEN lower(coalesce(r.resource_type, '')) IN ('transport', 'transports', 'transfer', 'transfers')
        THEN CASE
          WHEN coalesce(public.try_numeric(to_jsonb(tr)->>'return_total_price'), 0) > 0
            THEN coalesce(tr.total_price, 0) + coalesce(public.try_numeric(to_jsonb(tr)->>'return_total_price'), 0)
          ELSE tr.total_price
        END
      ELSE NULL
    END AS booking_total_price,
    COALESCE(
      nullif(trim(coalesce(t.title->>'en', '')), ''),
      nullif(trim(coalesce(t.title->>'pl', '')), ''),
      nullif(trim(coalesce(t.slug, '')), ''),
      nullif(trim(coalesce(tb.trip_slug, '')), ''),
      nullif(trim(coalesce(r.fulfillment_summary, '')), '')
    ) AS trip_title_en,
    COALESCE(
      nullif(trim(coalesce(t.title->>'pl', '')), ''),
      nullif(trim(coalesce(t.title->>'en', '')), ''),
      nullif(trim(coalesce(t.slug, '')), ''),
      nullif(trim(coalesce(tb.trip_slug, '')), ''),
      nullif(trim(coalesce(r.fulfillment_summary, '')), '')
    ) AS trip_title_pl
  FROM public.service_deposit_requests r
  LEFT JOIN public.partner_service_fulfillments f
    ON f.id = r.fulfillment_id
  LEFT JOIN public.trip_bookings tb
    ON tb.id = r.booking_id
  LEFT JOIN public.trips t
    ON t.id = tb.trip_id
  LEFT JOIN public.car_bookings cb
    ON cb.id = r.booking_id
  LEFT JOIN public.hotel_bookings hb
    ON hb.id = r.booking_id
  LEFT JOIN public.transport_bookings tr
    ON tr.id = r.booking_id
  WHERE r.id = p_id;
$$;

REVOKE ALL ON FUNCTION public.get_service_deposit_status(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_service_deposit_status(uuid) TO anon, authenticated;
