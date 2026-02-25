-- Transport notification flow hardening:
-- 1) Ensure transport booking creation and customer-received triggers exist.
-- 2) Gate partner pending notifications for transport by explicit assignment (assigned_at).
-- 3) Allow partner pending resend on reassignment with dedupe key that includes partner + assignment timestamp.

ALTER TABLE IF EXISTS public.transport_bookings
  ADD COLUMN IF NOT EXISTS customer_received_email_sent_at timestamptz;

CREATE OR REPLACE FUNCTION public.trg_notify_admin_new_transport_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  payload JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'category', 'transport',
    'record_id', NEW.id::text,
    'event', 'created',
    'table', 'transport_bookings',
    'record', to_jsonb(NEW)
  );

  PERFORM public.enqueue_admin_notification(
    'transport',
    'created',
    NEW.id::text,
    'transport_bookings',
    payload,
    'transport_created:' || NEW.id::text
  );

  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.trg_enqueue_customer_received_transport_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  payload JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'category', 'transport',
    'record_id', NEW.id::text,
    'event', 'customer_received',
    'table', 'transport_bookings',
    'record', to_jsonb(NEW)
  );

  PERFORM public.enqueue_admin_notification(
    'transport',
    'customer_received',
    NEW.id::text,
    'transport_bookings',
    payload,
    'transport_customer_received:' || NEW.id::text
  );

  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$fn$;

DO $$
BEGIN
  IF to_regclass('public.transport_bookings') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_notify_admin_new_transport_booking_ins ON public.transport_bookings';
    EXECUTE 'CREATE TRIGGER trg_notify_admin_new_transport_booking_ins
      AFTER INSERT ON public.transport_bookings
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_notify_admin_new_transport_booking()';

    EXECUTE 'DROP TRIGGER IF EXISTS trg_enqueue_customer_received_transport_booking_ins ON public.transport_bookings';
    EXECUTE 'CREATE TRIGGER trg_enqueue_customer_received_transport_booking_ins
      AFTER INSERT ON public.transport_bookings
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_enqueue_customer_received_transport_booking()';
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.transport_bookings') IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.transport_bookings
  SET assigned_at = COALESCE(assigned_at, updated_at, created_at, now())
  WHERE assigned_partner_id IS NOT NULL
    AND assigned_at IS NULL;
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
  assigned_transport_at timestamptz;
  dedupe_key text;
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

  dedupe_key := 'partner_pending_acceptance:service:' || NEW.id::text;

  IF NEW.resource_type = 'transport' THEN
    IF NEW.booking_id IS NULL OR NEW.partner_id IS NULL THEN
      RETURN NEW;
    END IF;

    BEGIN
      SELECT tb.assigned_partner_id, tb.assigned_at
      INTO assigned_transport_partner, assigned_transport_at
      FROM public.transport_bookings tb
      WHERE tb.id = NEW.booking_id;
    EXCEPTION WHEN undefined_table THEN
      assigned_transport_partner := NULL;
      assigned_transport_at := NULL;
    END;

    IF assigned_transport_partner IS NULL OR assigned_transport_partner IS DISTINCT FROM NEW.partner_id THEN
      RETURN NEW;
    END IF;

    -- Partner gets notification only after explicit assignment timestamp is present.
    IF assigned_transport_at IS NULL THEN
      RETURN NEW;
    END IF;

    dedupe_key := dedupe_key
      || ':' || NEW.partner_id::text
      || ':' || to_char(assigned_transport_at AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISSMS');
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
    dedupe_key
  );

  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$fn$;
