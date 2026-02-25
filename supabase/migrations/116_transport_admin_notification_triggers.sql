ALTER TABLE IF EXISTS public.transport_bookings
  ADD COLUMN IF NOT EXISTS customer_received_email_sent_at TIMESTAMPTZ;

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
