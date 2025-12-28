ALTER TABLE public.partner_service_fulfillments
ADD COLUMN IF NOT EXISTS details jsonb;

ALTER TABLE public.trip_bookings
ADD COLUMN IF NOT EXISTS source text DEFAULT 'website',
ADD COLUMN IF NOT EXISTS created_by uuid;

ALTER TABLE public.hotel_bookings
ADD COLUMN IF NOT EXISTS source text DEFAULT 'website',
ADD COLUMN IF NOT EXISTS created_by uuid;

UPDATE public.trip_bookings
SET source = 'website'
WHERE source IS NULL OR btrim(source) = '';

UPDATE public.hotel_bookings
SET source = 'website'
WHERE source IS NULL OR btrim(source) = '';

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

  matched_offer_id := NULL;
  car_model_txt := NULLIF(j->>'car_model', '');
  IF offer_uuid IS NULL AND car_model_txt IS NOT NULL AND LOWER(loc) IN ('paphos','larnaca') THEN
    matched_offer_id := public.match_car_offer_id(loc, car_model_txt);
    offer_uuid := COALESCE(offer_uuid, matched_offer_id);
  END IF;

  pid := COALESCE(
    public.partner_service_fulfillment_partner_id_for_resource('cars', offer_uuid),
    public.partner_service_fulfillment_partner_id_for_car_location(loc)
  );

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
