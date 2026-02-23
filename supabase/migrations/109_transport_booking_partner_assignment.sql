DO $$
BEGIN
  IF to_regclass('public.transport_bookings') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.transport_bookings
    ADD COLUMN IF NOT EXISTS assigned_partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
    ADD COLUMN IF NOT EXISTS assignment_note text;
END $$;

CREATE INDEX IF NOT EXISTS transport_bookings_assigned_partner_idx
  ON public.transport_bookings (assigned_partner_id, travel_date, travel_time);

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
    public.is_current_user_admin()
    OR (
      public.transport_bookings.assigned_partner_id IS NOT NULL
      AND public.is_partner_user(public.transport_bookings.assigned_partner_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.partner_service_fulfillments f
      WHERE f.resource_type = 'transport'
        AND f.booking_id = public.transport_bookings.id
        AND public.is_partner_user(f.partner_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.partner_resources pr
      WHERE pr.resource_type = 'transport'
        AND pr.resource_id = public.transport_bookings.route_id
        AND public.is_partner_user(pr.partner_id)
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
    'notes', NULLIF(NEW.notes, ''),
    'origin_location_id', NEW.origin_location_id,
    'destination_location_id', NEW.destination_location_id
  ));

  form_json := jsonb_strip_nulls(jsonb_build_object(
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
      NEW.travel_date::date,
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

  PERFORM public.upsert_partner_service_fulfillments_for_resource_partners(
    'transport',
    NEW.id,
    NEW.route_id,
    NEW.travel_date::date,
    NEW.travel_date::date,
    NEW.total_price,
    COALESCE(NULLIF(NEW.currency, ''), 'EUR'),
    NEW.customer_name,
    NEW.customer_email,
    NEW.customer_phone,
    CONCAT('TRANSPORT-', SUBSTRING(NEW.id::text, 1, 8)),
    'Transport booking',
    NEW.created_at::timestamptz,
    details_json
  );

  INSERT INTO public.partner_service_fulfillment_form_snapshots(
    fulfillment_id,
    payload,
    created_at
  )
  SELECT
    f.id,
    COALESCE(form_json, '{}'::jsonb),
    COALESCE(NEW.created_at, NOW())
  FROM public.partner_service_fulfillments f
  WHERE f.resource_type = 'transport'
    AND f.booking_id = NEW.id
  ON CONFLICT (fulfillment_id)
  DO UPDATE SET
    payload = EXCLUDED.payload;

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
                    assigned_partner_id, assigned_at, assigned_by, assignment_note
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

  IF to_regclass('public.transport_bookings') IS NULL THEN
    RETURN NEW;
  END IF;

  FOR b IN
    SELECT *
    FROM public.transport_bookings
    WHERE route_id = NEW.resource_id
      AND status IS DISTINCT FROM 'cancelled'
      AND assigned_partner_id IS NULL
  LOOP
    details_json := jsonb_strip_nulls(jsonb_build_object(
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
      'notes', NULLIF(b.notes, ''),
      'origin_location_id', b.origin_location_id,
      'destination_location_id', b.destination_location_id
    ));

    form_json := jsonb_strip_nulls(jsonb_build_object(
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

    PERFORM public.upsert_partner_service_fulfillments_for_resource_partners(
      'transport',
      b.id,
      b.route_id,
      b.travel_date::date,
      b.travel_date::date,
      b.total_price,
      COALESCE(NULLIF(b.currency, ''), 'EUR'),
      b.customer_name,
      b.customer_email,
      b.customer_phone,
      CONCAT('TRANSPORT-', SUBSTRING(b.id::text, 1, 8)),
      'Transport booking',
      b.created_at::timestamptz,
      details_json
    );

    INSERT INTO public.partner_service_fulfillment_form_snapshots(fulfillment_id, payload, created_at)
    SELECT
      f.id,
      COALESCE(form_json, '{}'::jsonb),
      COALESCE(b.created_at, NOW())
    FROM public.partner_service_fulfillments f
    WHERE f.resource_type = 'transport'
      AND f.booking_id = b.id
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
  IF to_regclass('public.transport_bookings') IS NULL OR to_regclass('public.partner_service_fulfillments') IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.transport_bookings tb
  SET assigned_partner_id = src.partner_id,
      assigned_at = COALESCE(src.accepted_at, src.created_at, tb.created_at)
  FROM (
    SELECT DISTINCT ON (f.booking_id)
      f.booking_id,
      f.partner_id,
      f.accepted_at,
      f.created_at
    FROM public.partner_service_fulfillments f
    WHERE f.resource_type = 'transport'
      AND f.status IN ('accepted', 'awaiting_payment')
      AND f.partner_id IS NOT NULL
    ORDER BY f.booking_id, f.accepted_at DESC NULLS LAST, f.created_at DESC, f.id DESC
  ) src
  WHERE tb.id = src.booking_id
    AND tb.assigned_partner_id IS NULL;
END $$;
