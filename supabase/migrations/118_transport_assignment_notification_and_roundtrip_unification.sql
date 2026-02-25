-- Transport: enforce assignment-first partner notifications and support single-record round trips.

DO $$
BEGIN
  IF to_regclass('public.transport_bookings') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.transport_bookings
    ADD COLUMN IF NOT EXISTS trip_type text NOT NULL DEFAULT 'one_way',
    ADD COLUMN IF NOT EXISTS return_route_id uuid REFERENCES public.transport_routes(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS return_origin_location_id uuid REFERENCES public.transport_locations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS return_destination_location_id uuid REFERENCES public.transport_locations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS return_travel_date date,
    ADD COLUMN IF NOT EXISTS return_travel_time time without time zone,
    ADD COLUMN IF NOT EXISTS return_pickup_address text,
    ADD COLUMN IF NOT EXISTS return_dropoff_address text,
    ADD COLUMN IF NOT EXISTS return_flight_number text,
    ADD COLUMN IF NOT EXISTS return_base_price numeric(12,2),
    ADD COLUMN IF NOT EXISTS return_extras_price numeric(12,2),
    ADD COLUMN IF NOT EXISTS return_total_price numeric(12,2);
END $$;

DO $$
BEGIN
  IF to_regclass('public.transport_bookings') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.transport_bookings'::regclass
      AND c.conname = 'transport_bookings_trip_type_check'
  ) THEN
    ALTER TABLE public.transport_bookings
      DROP CONSTRAINT transport_bookings_trip_type_check;
  END IF;

  ALTER TABLE public.transport_bookings
    ADD CONSTRAINT transport_bookings_trip_type_check
    CHECK (trip_type IN ('one_way', 'round_trip'));

  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.transport_bookings'::regclass
      AND c.conname = 'transport_bookings_return_price_non_negative_check'
  ) THEN
    ALTER TABLE public.transport_bookings
      DROP CONSTRAINT transport_bookings_return_price_non_negative_check;
  END IF;

  ALTER TABLE public.transport_bookings
    ADD CONSTRAINT transport_bookings_return_price_non_negative_check
    CHECK (
      (return_base_price IS NULL OR return_base_price >= 0)
      AND (return_extras_price IS NULL OR return_extras_price >= 0)
      AND (return_total_price IS NULL OR return_total_price >= 0)
    );

  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.transport_bookings'::regclass
      AND c.conname = 'transport_bookings_round_trip_fields_check'
  ) THEN
    ALTER TABLE public.transport_bookings
      DROP CONSTRAINT transport_bookings_round_trip_fields_check;
  END IF;

  ALTER TABLE public.transport_bookings
    ADD CONSTRAINT transport_bookings_round_trip_fields_check
    CHECK (
      trip_type <> 'round_trip'
      OR (
        return_route_id IS NOT NULL
        AND return_origin_location_id IS NOT NULL
        AND return_destination_location_id IS NOT NULL
        AND return_travel_date IS NOT NULL
        AND return_travel_time IS NOT NULL
      )
    );
END $$;

UPDATE public.transport_bookings
SET trip_type = CASE
  WHEN trip_type = 'round_trip'
    OR return_route_id IS NOT NULL
    OR return_travel_date IS NOT NULL
    OR return_travel_time IS NOT NULL
    OR COALESCE(NULLIF(trim(COALESCE(return_pickup_address, '')), ''), NULL) IS NOT NULL
    OR COALESCE(NULLIF(trim(COALESCE(return_dropoff_address, '')), ''), NULL) IS NOT NULL
    OR COALESCE(NULLIF(trim(COALESCE(return_flight_number, '')), ''), NULL) IS NOT NULL
  THEN 'round_trip'
  ELSE 'one_way'
END
WHERE trip_type IS DISTINCT FROM CASE
  WHEN trip_type = 'round_trip'
    OR return_route_id IS NOT NULL
    OR return_travel_date IS NOT NULL
    OR return_travel_time IS NOT NULL
    OR COALESCE(NULLIF(trim(COALESCE(return_pickup_address, '')), ''), NULL) IS NOT NULL
    OR COALESCE(NULLIF(trim(COALESCE(return_dropoff_address, '')), ''), NULL) IS NOT NULL
    OR COALESCE(NULLIF(trim(COALESCE(return_flight_number, '')), ''), NULL) IS NOT NULL
  THEN 'round_trip'
  ELSE 'one_way'
END;

CREATE INDEX IF NOT EXISTS transport_bookings_return_travel_idx
  ON public.transport_bookings (return_travel_date, return_travel_time, created_at DESC);

DO $$
BEGIN
  IF to_regclass('public.transport_bookings') IS NULL THEN
    RETURN;
  END IF;

  DROP POLICY IF EXISTS transport_bookings_partner_read ON public.transport_bookings;
  CREATE POLICY transport_bookings_partner_read
  ON public.transport_bookings
  FOR SELECT
  TO authenticated
  USING (
    public.is_transport_admin_user()
    OR (
      public.transport_bookings.assigned_partner_id IS NOT NULL
      AND public.is_partner_user(public.transport_bookings.assigned_partner_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.partner_service_fulfillments f
      WHERE f.resource_type = 'transport'
        AND f.booking_id = public.transport_bookings.id
        AND public.transport_bookings.assigned_partner_id IS NOT NULL
        AND f.partner_id = public.transport_bookings.assigned_partner_id
        AND public.is_partner_user(f.partner_id)
    )
  );
END $$;

CREATE OR REPLACE FUNCTION public.trg_partner_service_fulfillment_from_transport_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  details_json jsonb;
  form_json jsonb;
  fid uuid;
  assigned_pid uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF NEW.route_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  assigned_pid := NEW.assigned_partner_id;

  details_json := jsonb_strip_nulls(jsonb_build_object(
    'trip_type', COALESCE(NULLIF(NEW.trip_type, ''), 'one_way'),
    'travel_date', NEW.travel_date,
    'travel_time', NEW.travel_time,
    'num_passengers', NEW.num_passengers,
    'num_bags', NEW.num_bags,
    'num_oversize_bags', NEW.num_oversize_bags,
    'child_seats', NEW.child_seats,
    'booster_seats', NEW.booster_seats,
    'waiting_minutes', NEW.waiting_minutes,
    'pickup_address', NULLIF(NEW.pickup_address, ''),
    'dropoff_address', NULLIF(NEW.dropoff_address, ''),
    'flight_number', NULLIF(NEW.flight_number, ''),
    'return_route_id', NEW.return_route_id,
    'return_origin_location_id', NEW.return_origin_location_id,
    'return_destination_location_id', NEW.return_destination_location_id,
    'return_travel_date', NEW.return_travel_date,
    'return_travel_time', NEW.return_travel_time,
    'return_pickup_address', NULLIF(NEW.return_pickup_address, ''),
    'return_dropoff_address', NULLIF(NEW.return_dropoff_address, ''),
    'return_flight_number', NULLIF(NEW.return_flight_number, ''),
    'return_base_price', NEW.return_base_price,
    'return_extras_price', NEW.return_extras_price,
    'return_total_price', NEW.return_total_price,
    'notes', NULLIF(NEW.notes, ''),
    'origin_location_id', NEW.origin_location_id,
    'destination_location_id', NEW.destination_location_id
  ));

  form_json := jsonb_strip_nulls(jsonb_build_object(
    'trip_type', COALESCE(NULLIF(NEW.trip_type, ''), 'one_way'),
    'route_id', NEW.route_id,
    'origin_location_id', NEW.origin_location_id,
    'destination_location_id', NEW.destination_location_id,
    'travel_date', NEW.travel_date,
    'travel_time', NEW.travel_time,
    'num_passengers', NEW.num_passengers,
    'num_bags', NEW.num_bags,
    'num_oversize_bags', NEW.num_oversize_bags,
    'child_seats', NEW.child_seats,
    'booster_seats', NEW.booster_seats,
    'waiting_minutes', NEW.waiting_minutes,
    'pickup_address', NULLIF(NEW.pickup_address, ''),
    'dropoff_address', NULLIF(NEW.dropoff_address, ''),
    'flight_number', NULLIF(NEW.flight_number, ''),
    'return_route_id', NEW.return_route_id,
    'return_origin_location_id', NEW.return_origin_location_id,
    'return_destination_location_id', NEW.return_destination_location_id,
    'return_travel_date', NEW.return_travel_date,
    'return_travel_time', NEW.return_travel_time,
    'return_pickup_address', NULLIF(NEW.return_pickup_address, ''),
    'return_dropoff_address', NULLIF(NEW.return_dropoff_address, ''),
    'return_flight_number', NULLIF(NEW.return_flight_number, ''),
    'return_base_price', NEW.return_base_price,
    'return_extras_price', NEW.return_extras_price,
    'return_total_price', NEW.return_total_price,
    'notes', NULLIF(NEW.notes, ''),
    'customer_name', NULLIF(NEW.customer_name, ''),
    'customer_email', NULLIF(NEW.customer_email, ''),
    'customer_phone', NULLIF(NEW.customer_phone, ''),
    'base_price', NEW.base_price,
    'extras_price', NEW.extras_price,
    'total_price', NEW.total_price,
    'currency', NEW.currency,
    'lang', NEW.lang
  ));

  IF assigned_pid IS NOT NULL THEN
    UPDATE public.partner_service_fulfillments f
    SET status = 'closed',
        updated_at = now()
    WHERE f.resource_type = 'transport'
      AND f.booking_id = NEW.id
      AND f.partner_id IS DISTINCT FROM assigned_pid
      AND f.status IN ('pending_acceptance','awaiting_payment','accepted','expired');

    SELECT public.upsert_partner_service_fulfillment_from_booking_with_partner(
      assigned_pid,
      'transport',
      NEW.id,
      NEW.route_id,
      NEW.travel_date::date,
      COALESCE(NEW.return_travel_date, NEW.travel_date)::date,
      NEW.total_price,
      COALESCE(NULLIF(NEW.currency, ''), 'EUR'),
      NEW.customer_name,
      NEW.customer_email,
      NEW.customer_phone,
      CONCAT('TRANSPORT-', SUBSTRING(NEW.id::text, 1, 8)),
      'Transport booking',
      NEW.created_at::timestamptz
    )
    INTO fid;

    IF fid IS NOT NULL THEN
      UPDATE public.partner_service_fulfillments
      SET details = details_json,
          status = CASE
            WHEN status IN ('closed','rejected','expired') THEN 'pending_acceptance'
            ELSE status
          END,
          accepted_at = CASE
            WHEN status IN ('closed','rejected','expired') THEN NULL
            ELSE accepted_at
          END,
          accepted_by = CASE
            WHEN status IN ('closed','rejected','expired') THEN NULL
            ELSE accepted_by
          END,
          rejected_at = CASE
            WHEN status IN ('closed','rejected','expired') THEN NULL
            ELSE rejected_at
          END,
          rejected_by = CASE
            WHEN status IN ('closed','rejected','expired') THEN NULL
            ELSE rejected_by
          END,
          rejected_reason = CASE
            WHEN status IN ('closed','rejected','expired') THEN NULL
            ELSE rejected_reason
          END,
          contact_revealed_at = CASE
            WHEN status IN ('closed','rejected','expired') THEN NULL
            ELSE contact_revealed_at
          END,
          updated_at = now()
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
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.assigned_partner_id IS NOT NULL
     AND NEW.assigned_partner_id IS NULL
  THEN
    UPDATE public.partner_service_fulfillments f
    SET status = 'closed',
        updated_at = now()
    WHERE f.resource_type = 'transport'
      AND f.booking_id = NEW.id
      AND f.status IN ('pending_acceptance','awaiting_payment','accepted','expired');
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.transport_bookings') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'DROP TRIGGER IF EXISTS trg_partner_service_fulfillment_from_transport_booking_ins ON public.transport_bookings';
  EXECUTE 'CREATE TRIGGER trg_partner_service_fulfillment_from_transport_booking_ins AFTER INSERT ON public.transport_bookings FOR EACH ROW EXECUTE FUNCTION public.trg_partner_service_fulfillment_from_transport_booking()';

  EXECUTE 'DROP TRIGGER IF EXISTS trg_partner_service_fulfillment_from_transport_booking_upd ON public.transport_bookings';
  EXECUTE $sql$
    CREATE TRIGGER trg_partner_service_fulfillment_from_transport_booking_upd
    AFTER UPDATE OF route_id, origin_location_id, destination_location_id, travel_date, travel_time,
                    num_passengers, num_bags, num_oversize_bags, child_seats, booster_seats,
                    waiting_minutes, pickup_address, dropoff_address, flight_number, notes,
                    customer_name, customer_email, customer_phone, total_price, currency, status,
                    assigned_partner_id, assigned_at, assigned_by, assignment_note, trip_type,
                    return_route_id, return_origin_location_id, return_destination_location_id,
                    return_travel_date, return_travel_time, return_pickup_address,
                    return_dropoff_address, return_flight_number, return_base_price,
                    return_extras_price, return_total_price
    ON public.transport_bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_partner_service_fulfillment_from_transport_booking()
  $sql$;
END $$;

CREATE OR REPLACE FUNCTION public.trg_partner_resources_backfill_transport_fulfillments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b record;
  details_json jsonb;
  form_json jsonb;
  fid uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF NEW.resource_type IS DISTINCT FROM 'transport' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.partner_id IS NOT DISTINCT FROM OLD.partner_id
      AND NEW.resource_type IS NOT DISTINCT FROM OLD.resource_type
      AND NEW.resource_id IS NOT DISTINCT FROM OLD.resource_id
    THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.partner_id IS NULL OR NEW.resource_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF to_regclass('public.transport_bookings') IS NULL THEN
    RETURN NEW;
  END IF;

  FOR b IN
    SELECT *
    FROM public.transport_bookings
    WHERE route_id = NEW.resource_id
      AND status IS DISTINCT FROM 'cancelled'
      AND assigned_partner_id = NEW.partner_id
  LOOP
    details_json := jsonb_strip_nulls(jsonb_build_object(
      'trip_type', COALESCE(NULLIF(b.trip_type, ''), 'one_way'),
      'travel_date', b.travel_date,
      'travel_time', b.travel_time,
      'num_passengers', b.num_passengers,
      'num_bags', b.num_bags,
      'num_oversize_bags', b.num_oversize_bags,
      'child_seats', b.child_seats,
      'booster_seats', b.booster_seats,
      'waiting_minutes', b.waiting_minutes,
      'pickup_address', NULLIF(b.pickup_address, ''),
      'dropoff_address', NULLIF(b.dropoff_address, ''),
      'flight_number', NULLIF(b.flight_number, ''),
      'return_route_id', b.return_route_id,
      'return_origin_location_id', b.return_origin_location_id,
      'return_destination_location_id', b.return_destination_location_id,
      'return_travel_date', b.return_travel_date,
      'return_travel_time', b.return_travel_time,
      'return_pickup_address', NULLIF(b.return_pickup_address, ''),
      'return_dropoff_address', NULLIF(b.return_dropoff_address, ''),
      'return_flight_number', NULLIF(b.return_flight_number, ''),
      'return_base_price', b.return_base_price,
      'return_extras_price', b.return_extras_price,
      'return_total_price', b.return_total_price,
      'notes', NULLIF(b.notes, ''),
      'origin_location_id', b.origin_location_id,
      'destination_location_id', b.destination_location_id
    ));

    form_json := jsonb_strip_nulls(jsonb_build_object(
      'trip_type', COALESCE(NULLIF(b.trip_type, ''), 'one_way'),
      'route_id', b.route_id,
      'origin_location_id', b.origin_location_id,
      'destination_location_id', b.destination_location_id,
      'travel_date', b.travel_date,
      'travel_time', b.travel_time,
      'num_passengers', b.num_passengers,
      'num_bags', b.num_bags,
      'num_oversize_bags', b.num_oversize_bags,
      'child_seats', b.child_seats,
      'booster_seats', b.booster_seats,
      'waiting_minutes', b.waiting_minutes,
      'pickup_address', NULLIF(b.pickup_address, ''),
      'dropoff_address', NULLIF(b.dropoff_address, ''),
      'flight_number', NULLIF(b.flight_number, ''),
      'return_route_id', b.return_route_id,
      'return_origin_location_id', b.return_origin_location_id,
      'return_destination_location_id', b.return_destination_location_id,
      'return_travel_date', b.return_travel_date,
      'return_travel_time', b.return_travel_time,
      'return_pickup_address', NULLIF(b.return_pickup_address, ''),
      'return_dropoff_address', NULLIF(b.return_dropoff_address, ''),
      'return_flight_number', NULLIF(b.return_flight_number, ''),
      'return_base_price', b.return_base_price,
      'return_extras_price', b.return_extras_price,
      'return_total_price', b.return_total_price,
      'notes', NULLIF(b.notes, ''),
      'customer_name', NULLIF(b.customer_name, ''),
      'customer_email', NULLIF(b.customer_email, ''),
      'customer_phone', NULLIF(b.customer_phone, ''),
      'base_price', b.base_price,
      'extras_price', b.extras_price,
      'total_price', b.total_price,
      'currency', b.currency,
      'lang', b.lang
    ));

    SELECT public.upsert_partner_service_fulfillment_from_booking_with_partner(
      NEW.partner_id,
      'transport',
      b.id,
      b.route_id,
      b.travel_date::date,
      COALESCE(b.return_travel_date, b.travel_date)::date,
      b.total_price,
      COALESCE(NULLIF(b.currency, ''), 'EUR'),
      b.customer_name,
      b.customer_email,
      b.customer_phone,
      CONCAT('TRANSPORT-', SUBSTRING(b.id::text, 1, 8)),
      'Transport booking',
      b.created_at::timestamptz
    )
    INTO fid;

    IF fid IS NULL THEN
      CONTINUE;
    END IF;

    UPDATE public.partner_service_fulfillments
    SET details = details_json,
        status = CASE
          WHEN status IN ('closed','rejected','expired') THEN 'pending_acceptance'
          ELSE status
        END,
        accepted_at = CASE
          WHEN status IN ('closed','rejected','expired') THEN NULL
          ELSE accepted_at
        END,
        accepted_by = CASE
          WHEN status IN ('closed','rejected','expired') THEN NULL
          ELSE accepted_by
        END,
        rejected_at = CASE
          WHEN status IN ('closed','rejected','expired') THEN NULL
          ELSE rejected_at
        END,
        rejected_by = CASE
          WHEN status IN ('closed','rejected','expired') THEN NULL
          ELSE rejected_by
        END,
        rejected_reason = CASE
          WHEN status IN ('closed','rejected','expired') THEN NULL
          ELSE rejected_reason
        END,
        contact_revealed_at = CASE
          WHEN status IN ('closed','rejected','expired') THEN NULL
          ELSE contact_revealed_at
        END,
        updated_at = now()
    WHERE id = fid;

    INSERT INTO public.partner_service_fulfillment_form_snapshots(fulfillment_id, payload, created_at)
    VALUES (fid, COALESCE(form_json, '{}'::jsonb), COALESCE(b.created_at, NOW()))
    ON CONFLICT (fulfillment_id)
    DO UPDATE SET
      payload = EXCLUDED.payload;
  END LOOP;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.partner_resources') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'DROP TRIGGER IF EXISTS trg_partner_resources_backfill_transport_fulfillments_ins ON public.partner_resources';
  EXECUTE $sql$
    CREATE TRIGGER trg_partner_resources_backfill_transport_fulfillments_ins
    AFTER INSERT OR UPDATE ON public.partner_resources
    FOR EACH ROW
    WHEN (NEW.resource_type = 'transport')
    EXECUTE FUNCTION public.trg_partner_resources_backfill_transport_fulfillments()
  $sql$;
END $$;

DO $$
BEGIN
  IF to_regclass('public.partner_service_fulfillments') IS NULL
     OR to_regclass('public.transport_bookings') IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.partner_service_fulfillments f
  SET status = 'closed',
      updated_at = now()
  FROM public.transport_bookings tb
  WHERE f.resource_type = 'transport'
    AND f.booking_id = tb.id
    AND f.status IN ('pending_acceptance','awaiting_payment','accepted','expired')
    AND (
      tb.assigned_partner_id IS NULL
      OR f.partner_id IS DISTINCT FROM tb.assigned_partner_id
    );
END $$;

DO $$
DECLARE
  b record;
  details_json jsonb;
  form_json jsonb;
  fid uuid;
BEGIN
  IF to_regclass('public.transport_bookings') IS NULL
     OR to_regclass('public.partner_service_fulfillments') IS NULL THEN
    RETURN;
  END IF;

  FOR b IN
    SELECT *
    FROM public.transport_bookings
    WHERE assigned_partner_id IS NOT NULL
      AND status IS DISTINCT FROM 'cancelled'
  LOOP
    details_json := jsonb_strip_nulls(jsonb_build_object(
      'trip_type', COALESCE(NULLIF(b.trip_type, ''), 'one_way'),
      'travel_date', b.travel_date,
      'travel_time', b.travel_time,
      'num_passengers', b.num_passengers,
      'num_bags', b.num_bags,
      'num_oversize_bags', b.num_oversize_bags,
      'child_seats', b.child_seats,
      'booster_seats', b.booster_seats,
      'waiting_minutes', b.waiting_minutes,
      'pickup_address', NULLIF(b.pickup_address, ''),
      'dropoff_address', NULLIF(b.dropoff_address, ''),
      'flight_number', NULLIF(b.flight_number, ''),
      'return_route_id', b.return_route_id,
      'return_origin_location_id', b.return_origin_location_id,
      'return_destination_location_id', b.return_destination_location_id,
      'return_travel_date', b.return_travel_date,
      'return_travel_time', b.return_travel_time,
      'return_pickup_address', NULLIF(b.return_pickup_address, ''),
      'return_dropoff_address', NULLIF(b.return_dropoff_address, ''),
      'return_flight_number', NULLIF(b.return_flight_number, ''),
      'return_base_price', b.return_base_price,
      'return_extras_price', b.return_extras_price,
      'return_total_price', b.return_total_price,
      'notes', NULLIF(b.notes, ''),
      'origin_location_id', b.origin_location_id,
      'destination_location_id', b.destination_location_id
    ));

    form_json := jsonb_strip_nulls(jsonb_build_object(
      'trip_type', COALESCE(NULLIF(b.trip_type, ''), 'one_way'),
      'route_id', b.route_id,
      'origin_location_id', b.origin_location_id,
      'destination_location_id', b.destination_location_id,
      'travel_date', b.travel_date,
      'travel_time', b.travel_time,
      'num_passengers', b.num_passengers,
      'num_bags', b.num_bags,
      'num_oversize_bags', b.num_oversize_bags,
      'child_seats', b.child_seats,
      'booster_seats', b.booster_seats,
      'waiting_minutes', b.waiting_minutes,
      'pickup_address', NULLIF(b.pickup_address, ''),
      'dropoff_address', NULLIF(b.dropoff_address, ''),
      'flight_number', NULLIF(b.flight_number, ''),
      'return_route_id', b.return_route_id,
      'return_origin_location_id', b.return_origin_location_id,
      'return_destination_location_id', b.return_destination_location_id,
      'return_travel_date', b.return_travel_date,
      'return_travel_time', b.return_travel_time,
      'return_pickup_address', NULLIF(b.return_pickup_address, ''),
      'return_dropoff_address', NULLIF(b.return_dropoff_address, ''),
      'return_flight_number', NULLIF(b.return_flight_number, ''),
      'return_base_price', b.return_base_price,
      'return_extras_price', b.return_extras_price,
      'return_total_price', b.return_total_price,
      'notes', NULLIF(b.notes, ''),
      'customer_name', NULLIF(b.customer_name, ''),
      'customer_email', NULLIF(b.customer_email, ''),
      'customer_phone', NULLIF(b.customer_phone, ''),
      'base_price', b.base_price,
      'extras_price', b.extras_price,
      'total_price', b.total_price,
      'currency', b.currency,
      'lang', b.lang
    ));

    SELECT public.upsert_partner_service_fulfillment_from_booking_with_partner(
      b.assigned_partner_id,
      'transport',
      b.id,
      b.route_id,
      b.travel_date::date,
      COALESCE(b.return_travel_date, b.travel_date)::date,
      b.total_price,
      COALESCE(NULLIF(b.currency, ''), 'EUR'),
      b.customer_name,
      b.customer_email,
      b.customer_phone,
      CONCAT('TRANSPORT-', SUBSTRING(b.id::text, 1, 8)),
      'Transport booking',
      b.created_at::timestamptz
    )
    INTO fid;

    IF fid IS NULL THEN
      CONTINUE;
    END IF;

    UPDATE public.partner_service_fulfillments
    SET details = details_json,
        status = CASE
          WHEN status IN ('closed','rejected','expired') THEN 'pending_acceptance'
          ELSE status
        END,
        accepted_at = CASE
          WHEN status IN ('closed','rejected','expired') THEN NULL
          ELSE accepted_at
        END,
        accepted_by = CASE
          WHEN status IN ('closed','rejected','expired') THEN NULL
          ELSE accepted_by
        END,
        rejected_at = CASE
          WHEN status IN ('closed','rejected','expired') THEN NULL
          ELSE rejected_at
        END,
        rejected_by = CASE
          WHEN status IN ('closed','rejected','expired') THEN NULL
          ELSE rejected_by
        END,
        rejected_reason = CASE
          WHEN status IN ('closed','rejected','expired') THEN NULL
          ELSE rejected_reason
        END,
        contact_revealed_at = CASE
          WHEN status IN ('closed','rejected','expired') THEN NULL
          ELSE contact_revealed_at
        END,
        updated_at = now()
    WHERE id = fid;

    INSERT INTO public.partner_service_fulfillment_form_snapshots(fulfillment_id, payload, created_at)
    VALUES (fid, COALESCE(form_json, '{}'::jsonb), COALESCE(b.created_at, NOW()))
    ON CONFLICT (fulfillment_id)
    DO UPDATE SET
      payload = EXCLUDED.payload;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.trg_enqueue_partner_pending_service_fulfillment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  payload JSONB;
  category TEXT;
  assigned_transport_partner uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF NEW.status <> 'pending_acceptance' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(OLD.status, '') = COALESCE(NEW.status, '') THEN
    RETURN NEW;
  END IF;

  category := CASE
    WHEN NEW.resource_type = 'cars' THEN 'cars'
    WHEN NEW.resource_type = 'trips' THEN 'trips'
    WHEN NEW.resource_type = 'hotels' THEN 'hotels'
    WHEN NEW.resource_type = 'transport' THEN 'transport'
    ELSE 'trips'
  END;

  IF NEW.resource_type = 'transport' THEN
    IF NEW.booking_id IS NULL OR NEW.partner_id IS NULL THEN
      RETURN NEW;
    END IF;

    BEGIN
      SELECT tb.assigned_partner_id
      INTO assigned_transport_partner
      FROM public.transport_bookings tb
      WHERE tb.id = NEW.booking_id;
    EXCEPTION WHEN undefined_table THEN
      assigned_transport_partner := NULL;
    END;

    IF assigned_transport_partner IS NULL OR assigned_transport_partner IS DISTINCT FROM NEW.partner_id THEN
      RETURN NEW;
    END IF;
  END IF;

  payload := jsonb_build_object(
    'category', category,
    'record_id', NEW.id::text,
    'event', 'partner_pending_acceptance',
    'table', 'partner_service_fulfillments',
    'record', to_jsonb(NEW)
  );

  PERFORM public.enqueue_admin_notification(
    category,
    'partner_pending_acceptance',
    NEW.id::text,
    'partner_service_fulfillments',
    payload,
    'partner_pending_acceptance:service:' || NEW.id::text
  );

  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$fn$;
