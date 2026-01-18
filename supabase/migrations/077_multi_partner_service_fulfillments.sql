DO $$
BEGIN
  IF to_regclass('public.partner_service_fulfillments') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.partner_service_fulfillments
    DROP CONSTRAINT IF EXISTS partner_service_fulfillments_resource_type_booking_id_key;

  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS partner_service_fulfillments_unique_cars ON public.partner_service_fulfillments (resource_type, booking_id) WHERE resource_type = ''cars''';
  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS partner_service_fulfillments_unique_trips_hotels ON public.partner_service_fulfillments (resource_type, booking_id, partner_id) WHERE resource_type IN (''trips'', ''hotels'')';
END $$;

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

  IF p_resource_type = 'cars' THEN
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
    ON CONFLICT (resource_type, booking_id) WHERE resource_type = 'cars'
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
  ELSE
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
    ON CONFLICT (resource_type, booking_id, partner_id) WHERE resource_type IN ('trips','hotels')
    DO UPDATE SET
      resource_id = EXCLUDED.resource_id,
      reference = EXCLUDED.reference,
      summary = EXCLUDED.summary,
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      total_price = EXCLUDED.total_price,
      currency = EXCLUDED.currency
    RETURNING id INTO fid;
  END IF;

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

CREATE OR REPLACE FUNCTION public.upsert_partner_service_fulfillment_from_booking(
  p_resource_type TEXT,
  p_booking_id UUID,
  p_resource_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
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
  fid UUID;
BEGIN
  SELECT public.upsert_partner_service_fulfillment_from_booking(
    p_resource_type,
    p_booking_id,
    p_resource_id,
    p_start_date::date,
    p_end_date::date,
    p_total_price,
    p_currency,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    p_reference,
    p_summary,
    p_created_at
  )
  INTO fid;

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

  IF p_resource_type = 'cars' THEN
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
    ON CONFLICT (resource_type, booking_id) WHERE resource_type = 'cars'
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
  ELSE
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
    ON CONFLICT (resource_type, booking_id, partner_id) WHERE resource_type IN ('trips','hotels')
    DO UPDATE SET
      resource_id = EXCLUDED.resource_id,
      reference = EXCLUDED.reference,
      summary = EXCLUDED.summary,
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      total_price = EXCLUDED.total_price,
      currency = EXCLUDED.currency
    RETURNING id INTO fid;
  END IF;

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

CREATE OR REPLACE FUNCTION public.partner_service_fulfillment_partner_ids_for_resource(
  p_resource_type TEXT,
  p_resource_id UUID
)
RETURNS TABLE(partner_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rel REGCLASS;
  has_owner BOOLEAN;
BEGIN
  IF p_resource_id IS NULL THEN
    RETURN;
  END IF;

  IF p_resource_type = 'trips' THEN
    rel := to_regclass('public.trips');
    IF rel IS NULL THEN
      RETURN;
    END IF;

    has_owner := EXISTS (
      SELECT 1
      FROM pg_attribute a
      WHERE a.attrelid = rel
        AND a.attname = 'owner_partner_id'
        AND a.attisdropped = false
    );

    RETURN QUERY
    SELECT DISTINCT pid
    FROM (
      SELECT pid
      FROM (
        SELECT CASE WHEN has_owner THEN (t.owner_partner_id) ELSE NULL END AS pid
        FROM public.trips t
        WHERE t.id = p_resource_id
      ) o
      WHERE pid IS NOT NULL
      UNION ALL
      SELECT pr.partner_id AS pid
      FROM public.partner_resources pr
      WHERE pr.resource_type = 'trips'
        AND pr.resource_id = p_resource_id
    ) s
    WHERE pid IS NOT NULL;

    RETURN;
  END IF;

  IF p_resource_type = 'hotels' THEN
    rel := to_regclass('public.hotels');
    IF rel IS NULL THEN
      RETURN;
    END IF;

    has_owner := EXISTS (
      SELECT 1
      FROM pg_attribute a
      WHERE a.attrelid = rel
        AND a.attname = 'owner_partner_id'
        AND a.attisdropped = false
    );

    RETURN QUERY
    SELECT DISTINCT pid
    FROM (
      SELECT pid
      FROM (
        SELECT CASE WHEN has_owner THEN (h.owner_partner_id) ELSE NULL END AS pid
        FROM public.hotels h
        WHERE h.id = p_resource_id
      ) o
      WHERE pid IS NOT NULL
      UNION ALL
      SELECT pr.partner_id AS pid
      FROM public.partner_resources pr
      WHERE pr.resource_type = 'hotels'
        AND pr.resource_id = p_resource_id
    ) s
    WHERE pid IS NOT NULL;

    RETURN;
  END IF;

  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_partner_service_fulfillments_for_resource_partners(
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
  p_created_at TIMESTAMPTZ,
  p_details JSONB DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid UUID;
  fid UUID;
  cnt INTEGER := 0;
  has_details BOOLEAN;
BEGIN
  has_details := EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'partner_service_fulfillments'
      AND column_name = 'details'
  );

  FOR pid IN
    SELECT partner_id
    FROM public.partner_service_fulfillment_partner_ids_for_resource(p_resource_type, p_resource_id)
  LOOP
    SELECT public.upsert_partner_service_fulfillment_from_booking_with_partner(
      pid,
      p_resource_type,
      p_booking_id,
      p_resource_id,
      p_start_date,
      p_end_date,
      p_total_price,
      p_currency,
      p_customer_name,
      p_customer_email,
      p_customer_phone,
      p_reference,
      p_summary,
      p_created_at
    )
    INTO fid;

    IF fid IS NOT NULL THEN
      cnt := cnt + 1;
      IF has_details AND p_details IS NOT NULL THEN
        UPDATE public.partner_service_fulfillments
        SET details = p_details
        WHERE id = fid;
      END IF;
    END IF;
  END LOOP;

  RETURN cnt;
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

  PERFORM public.upsert_partner_service_fulfillments_for_resource_partners(
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
    NEW.created_at,
    details_json
  );

  RETURN NEW;
END;
$$;

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

  PERFORM public.upsert_partner_service_fulfillments_for_resource_partners(
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
    NEW.created_at,
    NULL
  );

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
  j JSONB;
  offer_uuid UUID;
  matched_offer_id UUID;
  loc TEXT;
  car_model_txt TEXT;
  total_price NUMERIC;
  currency TEXT;
  customer_name TEXT;
  customer_email TEXT;
  customer_phone TEXT;
  summary TEXT;
  fid UUID;
  pid UUID;
  has_offer_id BOOLEAN;
  has_details BOOLEAN;
  has_match_offer_fn BOOLEAN;
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

      PERFORM public.upsert_partner_service_fulfillments_for_resource_partners(
        'trips',
        b.id,
        b.trip_id,
        COALESCE(b.trip_date, b.arrival_date),
        b.departure_date,
        b.total_price,
        'EUR',
        b.customer_name,
        b.customer_email,
        b.customer_phone,
        CONCAT('TRIP-', SUBSTRING(b.id::text, 1, 8)),
        'Trip booking',
        b.created_at,
        details_json
      );
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
      PERFORM public.upsert_partner_service_fulfillments_for_resource_partners(
        'hotels',
        b.id,
        b.hotel_id,
        b.arrival_date,
        b.departure_date,
        b.total_price,
        'EUR',
        b.customer_name,
        b.customer_email,
        b.customer_phone,
        CONCAT('HOTEL-', SUBSTRING(b.id::text, 1, 8)),
        'Hotel booking',
        b.created_at,
        NULL
      );
    END LOOP;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.partner_resources') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'DROP TRIGGER IF EXISTS trg_partner_resources_backfill_service_fulfillments_ins ON public.partner_resources';
  EXECUTE 'CREATE TRIGGER trg_partner_resources_backfill_service_fulfillments_ins AFTER INSERT OR UPDATE ON public.partner_resources FOR EACH ROW EXECUTE FUNCTION public.trg_partner_resources_backfill_service_fulfillments()';
END $$;

CREATE OR REPLACE FUNCTION public.admin_backfill_partner_service_fulfillments_for_resource(
  p_resource_type TEXT,
  p_resource_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b RECORD;
  details_json JSONB;
  total_cnt INTEGER := 0;
  cnt INTEGER;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_resource_type = 'trips' THEN
    IF to_regclass('public.trip_bookings') IS NULL THEN
      RETURN 0;
    END IF;

    FOR b IN
      SELECT *
      FROM public.trip_bookings
      WHERE trip_id = p_resource_id
        AND status IS DISTINCT FROM 'cancelled'
    LOOP
      details_json := jsonb_strip_nulls(jsonb_build_object(
        'preferred_date', b.trip_date,
        'arrival_date', b.arrival_date,
        'departure_date', b.departure_date,
        'num_adults', b.num_adults,
        'num_children', b.num_children
      ));

      SELECT public.upsert_partner_service_fulfillments_for_resource_partners(
        'trips',
        b.id,
        b.trip_id,
        COALESCE(b.trip_date, b.arrival_date),
        b.departure_date,
        b.total_price,
        'EUR',
        b.customer_name,
        b.customer_email,
        b.customer_phone,
        CONCAT('TRIP-', SUBSTRING(b.id::text, 1, 8)),
        'Trip booking',
        b.created_at,
        details_json
      )
      INTO cnt;

      total_cnt := total_cnt + COALESCE(cnt, 0);
    END LOOP;

    RETURN total_cnt;
  END IF;

  IF p_resource_type = 'hotels' THEN
    IF to_regclass('public.hotel_bookings') IS NULL THEN
      RETURN 0;
    END IF;

    FOR b IN
      SELECT *
      FROM public.hotel_bookings
      WHERE hotel_id = p_resource_id
        AND status IS DISTINCT FROM 'cancelled'
    LOOP
      SELECT public.upsert_partner_service_fulfillments_for_resource_partners(
        'hotels',
        b.id,
        b.hotel_id,
        b.arrival_date,
        b.departure_date,
        b.total_price,
        'EUR',
        b.customer_name,
        b.customer_email,
        b.customer_phone,
        CONCAT('HOTEL-', SUBSTRING(b.id::text, 1, 8)),
        'Hotel booking',
        b.created_at,
        NULL
      )
      INTO cnt;

      total_cnt := total_cnt + COALESCE(cnt, 0);
    END LOOP;

    RETURN total_cnt;
  END IF;

  RETURN 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_backfill_partner_service_fulfillments_for_resource(TEXT, UUID) TO authenticated;
