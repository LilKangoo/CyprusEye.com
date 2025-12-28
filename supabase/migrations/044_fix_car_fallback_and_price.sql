DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'car_bookings'
      AND column_name = 'total_price'
  ) THEN
    ALTER TABLE public.car_bookings
      ADD COLUMN total_price numeric(10,2);
  END IF;
END $$;

DO $$
DECLARE
  has_final boolean;
  has_quoted boolean;
  sql text;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'car_bookings'
      AND column_name = 'final_price'
  ) INTO has_final;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'car_bookings'
      AND column_name = 'quoted_price'
  ) INTO has_quoted;

  IF COALESCE(has_final, false) OR COALESCE(has_quoted, false) THEN
    sql := 'UPDATE public.car_bookings SET total_price = COALESCE(total_price';
    IF COALESCE(has_final, false) THEN
      sql := sql || ', final_price';
    END IF;
    IF COALESCE(has_quoted, false) THEN
      sql := sql || ', quoted_price';
    END IF;
    sql := sql || ') WHERE total_price IS NULL;';
    EXECUTE sql;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.partner_service_fulfillment_partner_id_for_car_location(
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
BEGIN
  loc := LOWER(NULLIF(TRIM(COALESCE(p_location, '')), ''));
  IF loc IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p.id
  INTO pid
  FROM public.partners p
  WHERE p.status = 'active'
    AND p.can_manage_cars = true
    AND (
      (loc IN ('paphos','larnaca') AND p.cars_locations @> ARRAY[loc]::text[])
      OR (loc = 'all-cyprus' AND array_length(p.cars_locations, 1) IS NOT NULL)
    )
  ORDER BY p.created_at ASC
  LIMIT 1;

  RETURN pid;
END;
$$;

CREATE OR REPLACE FUNCTION public.partner_service_fulfillment_partner_id_for_resource(
  p_resource_type TEXT,
  p_resource_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid UUID;
  has_pr BOOLEAN;
  rel REGCLASS;
  has_owner BOOLEAN;
BEGIN
  IF p_resource_id IS NULL THEN
    RETURN NULL;
  END IF;

  has_pr := (to_regclass('public.partner_resources') IS NOT NULL);

  IF p_resource_type = 'cars' THEN
    rel := to_regclass('public.car_offers');
    IF rel IS NULL THEN
      RETURN NULL;
    END IF;

    has_owner := EXISTS (
      SELECT 1
      FROM pg_attribute a
      WHERE a.attrelid = rel
        AND a.attname = 'owner_partner_id'
        AND a.attisdropped = false
    );

    IF has_pr THEN
      IF has_owner THEN
        EXECUTE
          'SELECT COALESCE(co.owner_partner_id, pr.partner_id)
           FROM public.car_offers co
           LEFT JOIN public.partner_resources pr
             ON pr.resource_type = ''cars''
            AND pr.resource_id = co.id
           WHERE co.id = $1
           ORDER BY pr.created_at ASC NULLS LAST
           LIMIT 1'
        INTO pid
        USING p_resource_id;
      ELSE
        EXECUTE
          'SELECT pr.partner_id
           FROM public.partner_resources pr
           WHERE pr.resource_type = ''cars''
             AND pr.resource_id = $1
           ORDER BY pr.created_at ASC
           LIMIT 1'
        INTO pid
        USING p_resource_id;
      END IF;
    ELSE
      IF has_owner THEN
        EXECUTE
          'SELECT co.owner_partner_id
           FROM public.car_offers co
           WHERE co.id = $1
           LIMIT 1'
        INTO pid
        USING p_resource_id;
      ELSE
        RETURN NULL;
      END IF;
    END IF;
    RETURN pid;
  END IF;

  IF p_resource_type = 'trips' THEN
    rel := to_regclass('public.trips');
    IF rel IS NULL THEN
      RETURN NULL;
    END IF;

    has_owner := EXISTS (
      SELECT 1
      FROM pg_attribute a
      WHERE a.attrelid = rel
        AND a.attname = 'owner_partner_id'
        AND a.attisdropped = false
    );

    IF has_pr THEN
      IF has_owner THEN
        EXECUTE
          'SELECT COALESCE(t.owner_partner_id, pr.partner_id)
           FROM public.trips t
           LEFT JOIN public.partner_resources pr
             ON pr.resource_type = ''trips''
            AND pr.resource_id = t.id
           WHERE t.id = $1
           LIMIT 1'
        INTO pid
        USING p_resource_id;
      ELSE
        EXECUTE
          'SELECT pr.partner_id
           FROM public.partner_resources pr
           WHERE pr.resource_type = ''trips''
             AND pr.resource_id = $1
           LIMIT 1'
        INTO pid
        USING p_resource_id;
      END IF;
    ELSE
      IF has_owner THEN
        EXECUTE
          'SELECT t.owner_partner_id
           FROM public.trips t
           WHERE t.id = $1
           LIMIT 1'
        INTO pid
        USING p_resource_id;
      ELSE
        RETURN NULL;
      END IF;
    END IF;
    RETURN pid;
  END IF;

  IF p_resource_type = 'hotels' THEN
    rel := to_regclass('public.hotels');
    IF rel IS NULL THEN
      RETURN NULL;
    END IF;

    has_owner := EXISTS (
      SELECT 1
      FROM pg_attribute a
      WHERE a.attrelid = rel
        AND a.attname = 'owner_partner_id'
        AND a.attisdropped = false
    );

    IF has_pr THEN
      IF has_owner THEN
        EXECUTE
          'SELECT COALESCE(h.owner_partner_id, pr.partner_id)
           FROM public.hotels h
           LEFT JOIN public.partner_resources pr
             ON pr.resource_type = ''hotels''
            AND pr.resource_id = h.id
           WHERE h.id = $1
           LIMIT 1'
        INTO pid
        USING p_resource_id;
      ELSE
        EXECUTE
          'SELECT pr.partner_id
           FROM public.partner_resources pr
           WHERE pr.resource_type = ''hotels''
             AND pr.resource_id = $1
           LIMIT 1'
        INTO pid
        USING p_resource_id;
      END IF;
    ELSE
      IF has_owner THEN
        EXECUTE
          'SELECT h.owner_partner_id
           FROM public.hotels h
           WHERE h.id = $1
           LIMIT 1'
        INTO pid
        USING p_resource_id;
      ELSE
        RETURN NULL;
      END IF;
    END IF;
    RETURN pid;
  END IF;

  RETURN NULL;
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

  PERFORM public.upsert_partner_service_fulfillment_from_booking_with_partner(
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
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partner_service_fulfillment_from_car_booking_ins ON public.car_bookings;
CREATE TRIGGER trg_partner_service_fulfillment_from_car_booking_ins
  AFTER INSERT ON public.car_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_partner_service_fulfillment_from_car_booking();

DROP TRIGGER IF EXISTS trg_partner_service_fulfillment_from_car_booking_upd ON public.car_bookings;
CREATE TRIGGER trg_partner_service_fulfillment_from_car_booking_upd
  AFTER UPDATE ON public.car_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_partner_service_fulfillment_from_car_booking();
