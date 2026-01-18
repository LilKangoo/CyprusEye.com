DO $$
BEGIN
  IF to_regclass('public.partner_service_fulfillments') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.partner_service_fulfillments
    ADD COLUMN IF NOT EXISTS details jsonb;

  ALTER TABLE public.partner_service_fulfillments
    DROP CONSTRAINT IF EXISTS partner_service_fulfillments_resource_type_booking_id_key;

  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS partner_service_fulfillments_unique_cars ON public.partner_service_fulfillments (resource_type, booking_id) WHERE resource_type = ''cars''';
  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS partner_service_fulfillments_unique_trips_hotels ON public.partner_service_fulfillments (resource_type, booking_id, partner_id) WHERE resource_type IN (''trips'', ''hotels'')';
END $$;

DO $$
DECLARE
  status_constraint_name text;
BEGIN
  IF to_regclass('public.partner_service_fulfillments') IS NULL THEN
    RETURN;
  END IF;

  SELECT c.conname
  INTO status_constraint_name
  FROM pg_constraint c
  WHERE c.conrelid = 'public.partner_service_fulfillments'::regclass
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%status%IN%pending_acceptance%accepted%rejected%expired%'
  LIMIT 1;

  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.partner_service_fulfillments'::regclass
      AND c.contype = 'c'
      AND c.conname = 'partner_service_fulfillments_status_check'
  ) THEN
    EXECUTE 'ALTER TABLE public.partner_service_fulfillments DROP CONSTRAINT partner_service_fulfillments_status_check';
  END IF;

  IF status_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.partner_service_fulfillments DROP CONSTRAINT %I', status_constraint_name);
  END IF;

  ALTER TABLE public.partner_service_fulfillments
    ADD CONSTRAINT partner_service_fulfillments_status_check
    CHECK (status IN ('pending_acceptance','awaiting_payment','accepted','rejected','expired','closed'));

  WITH ranked AS (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY resource_type, booking_id
        ORDER BY accepted_at NULLS LAST, created_at, id
      ) AS rn
    FROM public.partner_service_fulfillments
    WHERE resource_type IN ('trips','hotels')
      AND status IN ('awaiting_payment','accepted')
  )
  UPDATE public.partner_service_fulfillments f
  SET status = 'closed',
      updated_at = now()
  FROM ranked r
  WHERE f.id = r.id
    AND r.rn > 1;

  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS partner_service_fulfillments_unique_active_trips_hotels ON public.partner_service_fulfillments (resource_type, booking_id) WHERE resource_type IN (''trips'',''hotels'') AND status IN (''awaiting_payment'',''accepted'')';
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

   RETURN NEW;
 END;
 $$;

 DO $$
 BEGIN
   IF to_regclass('public.trip_bookings') IS NULL THEN
     RETURN;
   END IF;

   EXECUTE 'DROP TRIGGER IF EXISTS trg_partner_service_fulfillment_from_trip_booking_ins ON public.trip_bookings';
   EXECUTE 'CREATE TRIGGER trg_partner_service_fulfillment_from_trip_booking_ins AFTER INSERT ON public.trip_bookings FOR EACH ROW EXECUTE FUNCTION public.trg_partner_service_fulfillment_from_trip_booking()';

   EXECUTE 'DROP TRIGGER IF EXISTS trg_partner_service_fulfillment_from_trip_booking_upd ON public.trip_bookings';
   EXECUTE 'CREATE TRIGGER trg_partner_service_fulfillment_from_trip_booking_upd AFTER UPDATE OF trip_id, trip_date, arrival_date, departure_date, total_price, customer_name, customer_email, customer_phone, status, num_adults, num_children ON public.trip_bookings FOR EACH ROW EXECUTE FUNCTION public.trg_partner_service_fulfillment_from_trip_booking()';
 END $$;

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
     NULL
   );

   RETURN NEW;
 END;
 $$;

 DO $$
 BEGIN
   IF to_regclass('public.hotel_bookings') IS NULL THEN
     RETURN;
   END IF;

   EXECUTE 'DROP TRIGGER IF EXISTS trg_partner_service_fulfillment_from_hotel_booking_ins ON public.hotel_bookings';
   EXECUTE 'CREATE TRIGGER trg_partner_service_fulfillment_from_hotel_booking_ins AFTER INSERT ON public.hotel_bookings FOR EACH ROW EXECUTE FUNCTION public.trg_partner_service_fulfillment_from_hotel_booking()';

   EXECUTE 'DROP TRIGGER IF EXISTS trg_partner_service_fulfillment_from_hotel_booking_upd ON public.hotel_bookings';
   EXECUTE 'CREATE TRIGGER trg_partner_service_fulfillment_from_hotel_booking_upd AFTER UPDATE OF hotel_id, arrival_date, departure_date, total_price, customer_name, customer_email, customer_phone, status ON public.hotel_bookings FOR EACH ROW EXECUTE FUNCTION public.trg_partner_service_fulfillment_from_hotel_booking()';
 END $$;

 CREATE OR REPLACE FUNCTION public.trg_partner_resources_backfill_service_fulfillments()
 RETURNS TRIGGER
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
 AS $$
 DECLARE
   b RECORD;
   details_json JSONB;
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

 CREATE OR REPLACE FUNCTION public.trg_partner_service_fulfillments_sync_status()
 RETURNS TRIGGER
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
 AS $$
 DECLARE
   existing_active UUID;
 BEGIN
   IF pg_trigger_depth() > 1 THEN
     RETURN NEW;
   END IF;

   IF NEW.resource_type NOT IN ('trips', 'hotels') THEN
     RETURN NEW;
   END IF;

   IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
     RETURN NEW;
   END IF;

   IF NEW.status NOT IN ('awaiting_payment', 'accepted') THEN
     RETURN NEW;
   END IF;

   -- Serialize claim for a (resource_type, booking_id) without row-lock deadlocks
   PERFORM pg_advisory_xact_lock(
     hashtext('partner_service_fulfillments:' || NEW.resource_type),
     hashtext(NEW.booking_id::text)
   );

   SELECT f.id
   INTO existing_active
   FROM public.partner_service_fulfillments f
   WHERE f.resource_type = NEW.resource_type
     AND f.booking_id = NEW.booking_id
     AND f.id <> NEW.id
     AND f.status IN ('awaiting_payment', 'accepted')
   ORDER BY f.accepted_at NULLS LAST, f.created_at, f.id
   LIMIT 1;

   IF existing_active IS NOT NULL THEN
     -- Someone already claimed this booking; convert this update into a closed state.
     NEW.status := 'closed';
     NEW.updated_at := now();
     NEW.accepted_at := OLD.accepted_at;
     NEW.accepted_by := OLD.accepted_by;
     NEW.contact_revealed_at := OLD.contact_revealed_at;
     RETURN NEW;
   END IF;

   WITH to_expire AS (
     SELECT f.id
     FROM public.partner_service_fulfillments f
     WHERE f.resource_type = NEW.resource_type
       AND f.booking_id = NEW.booking_id
       AND f.id <> NEW.id
       AND f.status = 'pending_acceptance'
     FOR UPDATE SKIP LOCKED
   )
   UPDATE public.partner_service_fulfillments f
   SET status = 'closed',
       updated_at = now()
   FROM to_expire e
   WHERE f.id = e.id;

   RETURN NEW;
 END;
 $$;

 DO $$
 BEGIN
   IF to_regclass('public.partner_service_fulfillments') IS NULL THEN
     RETURN;
   END IF;

   EXECUTE 'DROP TRIGGER IF EXISTS trg_partner_service_fulfillments_sync_status ON public.partner_service_fulfillments';
   EXECUTE 'CREATE TRIGGER trg_partner_service_fulfillments_sync_status BEFORE UPDATE OF status ON public.partner_service_fulfillments FOR EACH ROW EXECUTE FUNCTION public.trg_partner_service_fulfillments_sync_status()';
 END $$;

 DO $$
 DECLARE
   b RECORD;
   details_json JSONB;
 BEGIN
   IF to_regclass('public.trip_bookings') IS NOT NULL THEN
     FOR b IN
       SELECT *
       FROM public.trip_bookings
       WHERE trip_id IS NOT NULL
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
     END LOOP;
   END IF;

   IF to_regclass('public.hotel_bookings') IS NOT NULL THEN
     FOR b IN
       SELECT *
       FROM public.hotel_bookings
       WHERE hotel_id IS NOT NULL
         AND status IS DISTINCT FROM 'cancelled'
     LOOP
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
         NULL
       );
     END LOOP;
  END IF;
 END $$;
