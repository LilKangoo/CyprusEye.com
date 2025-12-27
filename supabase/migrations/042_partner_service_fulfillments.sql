CREATE TABLE IF NOT EXISTS public.partner_service_fulfillments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('cars','trips','hotels')),
  booking_id UUID NOT NULL,
  resource_id UUID,
  status TEXT NOT NULL DEFAULT 'pending_acceptance' CHECK (status IN ('pending_acceptance','accepted','rejected','expired')),
  sla_deadline_at TIMESTAMPTZ,
  sla_alerted_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rejected_reason TEXT,
  contact_revealed_at TIMESTAMPTZ,
  reference TEXT,
  summary TEXT,
  start_date DATE,
  end_date DATE,
  total_price DECIMAL(12,2),
  currency TEXT DEFAULT 'EUR',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(resource_type, booking_id)
);

CREATE TABLE IF NOT EXISTS public.partner_service_fulfillment_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_id UUID NOT NULL REFERENCES public.partner_service_fulfillments(id) ON DELETE CASCADE,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fulfillment_id)
);

ALTER TABLE public.partner_service_fulfillments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_service_fulfillment_contacts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  user_admin BOOLEAN;
  meta_admin BOOLEAN;
BEGIN
  BEGIN
    meta_admin := COALESCE((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, FALSE);
  EXCEPTION WHEN others THEN
    meta_admin := FALSE;
  END;

  IF meta_admin THEN
    RETURN TRUE;
  END IF;

  IF auth.uid() = '15f3d442-092d-4eb8-9627-db90da0283eb'::uuid THEN
    RETURN TRUE;
  END IF;

  SELECT is_admin INTO user_admin
  FROM profiles
  WHERE id = auth.uid();

  RETURN COALESCE(user_admin, FALSE);
END;
$$;

DROP POLICY IF EXISTS partner_service_fulfillments_admin_all ON public.partner_service_fulfillments;
CREATE POLICY partner_service_fulfillments_admin_all
ON public.partner_service_fulfillments
FOR ALL
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS partner_service_fulfillments_partner_read ON public.partner_service_fulfillments;
CREATE POLICY partner_service_fulfillments_partner_read
ON public.partner_service_fulfillments
FOR SELECT
TO authenticated
USING (public.is_partner_user(partner_id));

DROP POLICY IF EXISTS partner_service_fulfillment_contacts_admin_all ON public.partner_service_fulfillment_contacts;
CREATE POLICY partner_service_fulfillment_contacts_admin_all
ON public.partner_service_fulfillment_contacts
FOR ALL
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS partner_service_fulfillment_contacts_partner_read ON public.partner_service_fulfillment_contacts;
CREATE POLICY partner_service_fulfillment_contacts_partner_read
ON public.partner_service_fulfillment_contacts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.partner_service_fulfillments f
    WHERE f.id = fulfillment_id
      AND public.is_partner_user(f.partner_id)
      AND f.status = 'accepted'
  )
);

GRANT SELECT ON public.partner_service_fulfillments TO authenticated;
GRANT SELECT ON public.partner_service_fulfillment_contacts TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='partners' AND column_name='cars_locations'
  ) THEN
    ALTER TABLE public.partners
      ADD COLUMN cars_locations TEXT[] NOT NULL DEFAULT '{}'::text[]
      CHECK (cars_locations <@ ARRAY['paphos','larnaca']::text[]);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_partner_service_fulfillments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS partner_service_fulfillments_updated_at_trigger ON public.partner_service_fulfillments;
CREATE TRIGGER partner_service_fulfillments_updated_at_trigger
  BEFORE UPDATE ON public.partner_service_fulfillments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_partner_service_fulfillments_updated_at();

CREATE OR REPLACE FUNCTION public.try_uuid(p_text TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_text IS NULL OR NULLIF(BTRIM(p_text), '') IS NULL THEN
    RETURN NULL;
  END IF;
  BEGIN
    RETURN p_text::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.try_numeric(p_text TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_text IS NULL OR NULLIF(BTRIM(p_text), '') IS NULL THEN
    RETURN NULL;
  END IF;
  BEGIN
    RETURN p_text::numeric;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$;

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
BEGIN
  IF p_resource_id IS NULL THEN
    RETURN NULL;
  END IF;

  has_pr := (to_regclass('public.partner_resources') IS NOT NULL);

  IF p_resource_type = 'cars' THEN
    IF has_pr THEN
      EXECUTE
        'SELECT COALESCE(public.try_uuid(to_jsonb(co) ->> ''owner_partner_id''), pr.partner_id)
         FROM public.car_offers co
         LEFT JOIN public.partner_resources pr
           ON pr.resource_type = ''cars''
          AND pr.resource_id = co.id
         WHERE co.id = $1
         LIMIT 1'
      INTO pid
      USING p_resource_id;
    ELSE
      EXECUTE
        'SELECT public.try_uuid(to_jsonb(co) ->> ''owner_partner_id'')
         FROM public.car_offers co
         WHERE co.id = $1
         LIMIT 1'
      INTO pid
      USING p_resource_id;
    END IF;
    RETURN pid;
  END IF;

  IF p_resource_type = 'trips' THEN
    IF has_pr THEN
      EXECUTE
        'SELECT COALESCE(public.try_uuid(to_jsonb(t) ->> ''owner_partner_id''), pr.partner_id)
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
        'SELECT public.try_uuid(to_jsonb(t) ->> ''owner_partner_id'')
         FROM public.trips t
         WHERE t.id = $1
         LIMIT 1'
      INTO pid
      USING p_resource_id;
    END IF;
    RETURN pid;
  END IF;

  IF p_resource_type = 'hotels' THEN
    IF has_pr THEN
      EXECUTE
        'SELECT COALESCE(public.try_uuid(to_jsonb(h) ->> ''owner_partner_id''), pr.partner_id)
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
        'SELECT public.try_uuid(to_jsonb(h) ->> ''owner_partner_id'')
         FROM public.hotels h
         WHERE h.id = $1
         LIMIT 1'
      INTO pid
      USING p_resource_id;
    END IF;
    RETURN pid;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_partner_service_fulfillment_from_booking(
  p_resource_type TEXT,
  p_booking_id UUID,
  p_resource_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_total_price NUMERIC,
  p_currency TEXT,
  p_customer_name TEXT,
  p_customer_email TEXT,
  p_customer_phone TEXT,
  p_reference TEXT,
  p_summary TEXT,
  p_created_at TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid UUID;
  fid UUID;
  deadline TIMESTAMPTZ;
BEGIN
  pid := public.partner_service_fulfillment_partner_id_for_resource(p_resource_type, p_resource_id);
  IF pid IS NULL THEN
    RETURN NULL;
  END IF;

  deadline := COALESCE(p_created_at, NOW()) + INTERVAL '4 hours';

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
  VALUES (
    pid,
    p_resource_type,
    p_booking_id,
    p_resource_id,
    'pending_acceptance',
    deadline,
    p_reference,
    p_summary,
    p_start_date,
    p_end_date,
    p_total_price,
    COALESCE(NULLIF(p_currency, ''), 'EUR'),
    COALESCE(p_created_at, NOW())
  )
  ON CONFLICT (resource_type, booking_id)
  DO UPDATE SET
    partner_id = EXCLUDED.partner_id,
    resource_id = EXCLUDED.resource_id,
    reference = EXCLUDED.reference,
    summary = EXCLUDED.summary,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    total_price = EXCLUDED.total_price,
    currency = EXCLUDED.currency
  RETURNING id INTO fid;

  INSERT INTO public.partner_service_fulfillment_contacts(
    fulfillment_id,
    customer_name,
    customer_email,
    customer_phone,
    created_at
  )
  VALUES (
    fid,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    COALESCE(p_created_at, NOW())
  )
  ON CONFLICT (fulfillment_id)
  DO UPDATE SET
    customer_name = EXCLUDED.customer_name,
    customer_email = EXCLUDED.customer_email,
    customer_phone = EXCLUDED.customer_phone;

  RETURN fid;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_partner_service_fulfillment_from_booking_with_partner(
  p_partner_id UUID,
  p_resource_type TEXT,
  p_booking_id UUID,
  p_resource_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_total_price NUMERIC,
  p_currency TEXT,
  p_customer_name TEXT,
  p_customer_email TEXT,
  p_customer_phone TEXT,
  p_reference TEXT,
  p_summary TEXT,
  p_created_at TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid UUID;
  fid UUID;
  deadline TIMESTAMPTZ;
BEGIN
  pid := COALESCE(p_partner_id, public.partner_service_fulfillment_partner_id_for_resource(p_resource_type, p_resource_id));
  IF pid IS NULL THEN
    RETURN NULL;
  END IF;

  deadline := COALESCE(p_created_at, NOW()) + INTERVAL '4 hours';

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
  VALUES (
    pid,
    p_resource_type,
    p_booking_id,
    p_resource_id,
    'pending_acceptance',
    deadline,
    p_reference,
    p_summary,
    p_start_date,
    p_end_date,
    p_total_price,
    COALESCE(NULLIF(p_currency, ''), 'EUR'),
    COALESCE(p_created_at, NOW())
  )
  ON CONFLICT (resource_type, booking_id)
  DO UPDATE SET
    partner_id = EXCLUDED.partner_id,
    resource_id = EXCLUDED.resource_id,
    reference = EXCLUDED.reference,
    summary = EXCLUDED.summary,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    total_price = EXCLUDED.total_price,
    currency = EXCLUDED.currency
  RETURNING id INTO fid;

  INSERT INTO public.partner_service_fulfillment_contacts(
    fulfillment_id,
    customer_name,
    customer_email,
    customer_phone,
    created_at
  )
  VALUES (
    fid,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    COALESCE(p_created_at, NOW())
  )
  ON CONFLICT (fulfillment_id)
  DO UPDATE SET
    customer_name = EXCLUDED.customer_name,
    customer_email = EXCLUDED.customer_email,
    customer_phone = EXCLUDED.customer_phone;

  RETURN fid;
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
    SELECT co.id
    INTO matched_offer_id
    FROM public.car_offers co
    WHERE LOWER(COALESCE(co.car_model, '')) = LOWER(car_model_txt)
      AND LOWER(COALESCE(co.location, '')) = LOWER(loc)
    LIMIT 1;
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
    public.try_numeric(j->>'total_price'),
    public.try_numeric(j->>'final_price'),
    public.try_numeric(j->>'quoted_price')
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

CREATE OR REPLACE FUNCTION public.trg_partner_service_fulfillment_from_trip_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  PERFORM public.upsert_partner_service_fulfillment_from_booking(
    'trips',
    NEW.id,
    NEW.trip_id,
    COALESCE(NEW.trip_date, NEW.arrival_date),
    NEW.departure_date,
    NEW.total_price,
    'EUR',
    NEW.customer_name,
    NEW.customer_email,
    NEW.customer_phone,
    CONCAT('TRIP-', SUBSTRING(NEW.id::text, 1, 8)),
    'Trip booking',
    NEW.created_at
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partner_service_fulfillment_from_trip_booking_ins ON public.trip_bookings;
CREATE TRIGGER trg_partner_service_fulfillment_from_trip_booking_ins
  AFTER INSERT ON public.trip_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_partner_service_fulfillment_from_trip_booking();

DROP TRIGGER IF EXISTS trg_partner_service_fulfillment_from_trip_booking_upd ON public.trip_bookings;
CREATE TRIGGER trg_partner_service_fulfillment_from_trip_booking_upd
  AFTER UPDATE OF trip_id, trip_date, arrival_date, departure_date, total_price, customer_name, customer_email, customer_phone, status ON public.trip_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_partner_service_fulfillment_from_trip_booking();

CREATE OR REPLACE FUNCTION public.trg_partner_service_fulfillment_from_hotel_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  PERFORM public.upsert_partner_service_fulfillment_from_booking(
    'hotels',
    NEW.id,
    NEW.hotel_id,
    NEW.arrival_date,
    NEW.departure_date,
    NEW.total_price,
    'EUR',
    NEW.customer_name,
    NEW.customer_email,
    NEW.customer_phone,
    CONCAT('HOTEL-', SUBSTRING(NEW.id::text, 1, 8)),
    'Hotel booking',
    NEW.created_at
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partner_service_fulfillment_from_hotel_booking_ins ON public.hotel_bookings;
CREATE TRIGGER trg_partner_service_fulfillment_from_hotel_booking_ins
  AFTER INSERT ON public.hotel_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_partner_service_fulfillment_from_hotel_booking();

DROP TRIGGER IF EXISTS trg_partner_service_fulfillment_from_hotel_booking_upd ON public.hotel_bookings;
CREATE TRIGGER trg_partner_service_fulfillment_from_hotel_booking_upd
  AFTER UPDATE OF hotel_id, arrival_date, departure_date, total_price, customer_name, customer_email, customer_phone, status ON public.hotel_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_partner_service_fulfillment_from_hotel_booking();

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
  pid,
  'cars',
  cb.id,
  offer_uuid,
  'pending_acceptance',
  COALESCE(cb.created_at, NOW()) + INTERVAL '4 hours',
  CONCAT('CAR-', SUBSTRING(cb.id::text, 1, 8)),
  COALESCE(NULLIF(j->>'car_model', ''), NULLIF(j->>'car_type', ''), 'Car booking'),
  cb.pickup_date,
  cb.return_date,
  COALESCE(public.try_numeric(j->>'total_price'), public.try_numeric(j->>'final_price'), public.try_numeric(j->>'quoted_price')),
  COALESCE(NULLIF(j->>'currency', ''), 'EUR'),
  COALESCE(cb.created_at, NOW())
FROM public.car_bookings cb
CROSS JOIN LATERAL (SELECT to_jsonb(cb) AS j) x
CROSS JOIN LATERAL (
  SELECT
    COALESCE(
      public.try_uuid(x.j->>'offer_id'),
      (
        SELECT co.id
        FROM public.car_offers co
        WHERE LOWER(COALESCE(co.car_model, '')) = LOWER(NULLIF(x.j->>'car_model', ''))
          AND LOWER(COALESCE(co.location, '')) = LOWER(COALESCE(NULLIF(x.j->>'location', ''), NULLIF(x.j->>'pickup_location', '')))
        LIMIT 1
      )
    ) AS offer_uuid,
    COALESCE(
      public.partner_service_fulfillment_partner_id_for_resource(
        'cars',
        COALESCE(
          public.try_uuid(x.j->>'offer_id'),
          (
            SELECT co2.id
            FROM public.car_offers co2
            WHERE LOWER(COALESCE(co2.car_model, '')) = LOWER(NULLIF(x.j->>'car_model', ''))
              AND LOWER(COALESCE(co2.location, '')) = LOWER(COALESCE(NULLIF(x.j->>'location', ''), NULLIF(x.j->>'pickup_location', '')))
            LIMIT 1
          )
        )
      ),
      public.partner_service_fulfillment_partner_id_for_car_location(COALESCE(NULLIF(x.j->>'location', ''), NULLIF(x.j->>'pickup_location', '')))
    ) AS pid
) y
WHERE y.pid IS NOT NULL
  AND cb.status NOT IN ('cancelled', 'no_show')
ON CONFLICT (resource_type, booking_id) DO NOTHING;

INSERT INTO public.partner_service_fulfillment_contacts(
  fulfillment_id,
  customer_name,
  customer_email,
  customer_phone,
  created_at
)
SELECT
  f.id,
  COALESCE(NULLIF(j->>'customer_name', ''), NULLIF(j->>'full_name', '')),
  COALESCE(NULLIF(j->>'customer_email', ''), NULLIF(j->>'email', '')),
  COALESCE(NULLIF(j->>'customer_phone', ''), NULLIF(j->>'phone', '')),
  COALESCE(cb.created_at, NOW())
FROM public.partner_service_fulfillments f
JOIN public.car_bookings cb
  ON cb.id = f.booking_id
CROSS JOIN LATERAL (SELECT to_jsonb(cb) AS j) x
WHERE f.resource_type = 'cars'
ON CONFLICT (fulfillment_id) DO NOTHING;

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
  public.partner_service_fulfillment_partner_id_for_resource('trips', tb.trip_id) AS partner_id,
  'trips',
  tb.id,
  tb.trip_id,
  'pending_acceptance',
  COALESCE(tb.created_at, NOW()) + INTERVAL '4 hours',
  CONCAT('TRIP-', SUBSTRING(tb.id::text, 1, 8)),
  'Trip booking',
  COALESCE(tb.trip_date, tb.arrival_date),
  tb.departure_date,
  tb.total_price,
  'EUR',
  COALESCE(tb.created_at, NOW())
FROM public.trip_bookings tb
WHERE tb.trip_id IS NOT NULL
  AND tb.status <> 'cancelled'
  AND public.partner_service_fulfillment_partner_id_for_resource('trips', tb.trip_id) IS NOT NULL
ON CONFLICT (resource_type, booking_id) DO NOTHING;

INSERT INTO public.partner_service_fulfillment_contacts(
  fulfillment_id,
  customer_name,
  customer_email,
  customer_phone,
  created_at
)
SELECT
  f.id,
  tb.customer_name,
  tb.customer_email,
  tb.customer_phone,
  COALESCE(tb.created_at, NOW())
FROM public.partner_service_fulfillments f
JOIN public.trip_bookings tb
  ON tb.id = f.booking_id
WHERE f.resource_type = 'trips'
ON CONFLICT (fulfillment_id) DO NOTHING;

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
  public.partner_service_fulfillment_partner_id_for_resource('hotels', hb.hotel_id) AS partner_id,
  'hotels',
  hb.id,
  hb.hotel_id,
  'pending_acceptance',
  COALESCE(hb.created_at, NOW()) + INTERVAL '4 hours',
  CONCAT('HOTEL-', SUBSTRING(hb.id::text, 1, 8)),
  'Hotel booking',
  hb.arrival_date,
  hb.departure_date,
  hb.total_price,
  'EUR',
  COALESCE(hb.created_at, NOW())
FROM public.hotel_bookings hb
WHERE hb.hotel_id IS NOT NULL
  AND hb.status <> 'cancelled'
  AND public.partner_service_fulfillment_partner_id_for_resource('hotels', hb.hotel_id) IS NOT NULL
ON CONFLICT (resource_type, booking_id) DO NOTHING;

INSERT INTO public.partner_service_fulfillment_contacts(
  fulfillment_id,
  customer_name,
  customer_email,
  customer_phone,
  created_at
)
SELECT
  f.id,
  hb.customer_name,
  hb.customer_email,
  hb.customer_phone,
  COALESCE(hb.created_at, NOW())
FROM public.partner_service_fulfillments f
JOIN public.hotel_bookings hb
  ON hb.id = f.booking_id
WHERE f.resource_type = 'hotels'
ON CONFLICT (fulfillment_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.partner_accept_service_fulfillment(p_fulfillment_id UUID)
RETURNS TABLE(fulfillment_id UUID, partner_id UUID, resource_type TEXT, booking_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f RECORD;
  now_ts TIMESTAMPTZ := NOW();
BEGIN
  SELECT * INTO f
  FROM public.partner_service_fulfillments
  WHERE id = p_fulfillment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'fulfillment_not_found';
  END IF;

  IF NOT public.is_partner_user(f.partner_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF f.status <> 'pending_acceptance' THEN
    fulfillment_id := f.id;
    partner_id := f.partner_id;
    resource_type := f.resource_type;
    booking_id := f.booking_id;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.partner_service_fulfillments
  SET
    status = 'accepted',
    accepted_at = COALESCE(accepted_at, now_ts),
    accepted_by = COALESCE(accepted_by, auth.uid()),
    contact_revealed_at = COALESCE(contact_revealed_at, now_ts),
    rejected_at = NULL,
    rejected_by = NULL,
    rejected_reason = NULL
  WHERE id = p_fulfillment_id;

  INSERT INTO public.partner_audit_log(partner_id, actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (
    f.partner_id,
    auth.uid(),
    'fulfillment_accepted',
    'service_fulfillment',
    f.id,
    jsonb_build_object('resource_type', f.resource_type, 'booking_id', f.booking_id)
  );

  fulfillment_id := f.id;
  partner_id := f.partner_id;
  resource_type := f.resource_type;
  booking_id := f.booking_id;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.partner_reject_service_fulfillment(p_fulfillment_id UUID, p_reason TEXT)
RETURNS TABLE(fulfillment_id UUID, partner_id UUID, resource_type TEXT, booking_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f RECORD;
  now_ts TIMESTAMPTZ := NOW();
BEGIN
  SELECT * INTO f
  FROM public.partner_service_fulfillments
  WHERE id = p_fulfillment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'fulfillment_not_found';
  END IF;

  IF NOT public.is_partner_user(f.partner_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF f.status <> 'pending_acceptance' THEN
    fulfillment_id := f.id;
    partner_id := f.partner_id;
    resource_type := f.resource_type;
    booking_id := f.booking_id;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.partner_service_fulfillments
  SET
    status = 'rejected',
    rejected_at = COALESCE(rejected_at, now_ts),
    rejected_by = COALESCE(rejected_by, auth.uid()),
    rejected_reason = NULLIF(p_reason, '')
  WHERE id = p_fulfillment_id;

  INSERT INTO public.partner_audit_log(partner_id, actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (
    f.partner_id,
    auth.uid(),
    'fulfillment_rejected',
    'service_fulfillment',
    f.id,
    jsonb_build_object('resource_type', f.resource_type, 'booking_id', f.booking_id, 'reason', p_reason)
  );

  fulfillment_id := f.id;
  partner_id := f.partner_id;
  resource_type := f.resource_type;
  booking_id := f.booking_id;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.partner_accept_service_fulfillment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.partner_reject_service_fulfillment(UUID, TEXT) TO authenticated;
