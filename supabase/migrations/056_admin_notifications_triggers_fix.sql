create extension if not exists pg_net;

ALTER TABLE IF EXISTS public.shop_settings
  ADD COLUMN IF NOT EXISTS admin_notify_secret TEXT;

CREATE OR REPLACE FUNCTION public.trg_notify_admin_new_car_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload JSONB;
  url TEXT := 'https://daoohnbnnowmmcizgvrq.functions.supabase.co/send-admin-notification';
  url_call TEXT;
  secret TEXT;
  headers JSONB;
BEGIN
  SELECT COALESCE(admin_notify_secret, '')
  INTO secret
  FROM public.shop_settings
  WHERE id = 1;

  url_call := url || CASE WHEN secret <> '' THEN ('?secret=' || secret) ELSE '' END;

  headers := jsonb_build_object('content-type', 'application/json') ||
    CASE WHEN secret <> '' THEN jsonb_build_object('x-admin-notify-secret', secret) ELSE '{}'::jsonb END;

  payload := jsonb_build_object(
    'category', 'cars',
    'record_id', NEW.id::text,
    'event', 'created',
    'table', 'car_bookings',
    'record', to_jsonb(NEW)
  );

  PERFORM net.http_post(
    url := url_call,
    body := payload,
    headers := headers
  );

  RETURN NEW;
EXCEPTION WHEN undefined_function OR invalid_schema_name OR undefined_table THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_new_car_booking_ins ON public.car_bookings;
CREATE TRIGGER trg_notify_admin_new_car_booking_ins
  AFTER INSERT ON public.car_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_admin_new_car_booking();

CREATE OR REPLACE FUNCTION public.trg_notify_admin_new_trip_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload JSONB;
  url TEXT := 'https://daoohnbnnowmmcizgvrq.functions.supabase.co/send-admin-notification';
  url_call TEXT;
  secret TEXT;
  headers JSONB;
BEGIN
  SELECT COALESCE(admin_notify_secret, '')
  INTO secret
  FROM public.shop_settings
  WHERE id = 1;

  url_call := url || CASE WHEN secret <> '' THEN ('?secret=' || secret) ELSE '' END;

  headers := jsonb_build_object('content-type', 'application/json') ||
    CASE WHEN secret <> '' THEN jsonb_build_object('x-admin-notify-secret', secret) ELSE '{}'::jsonb END;

  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'record', to_jsonb(NEW)
  );

  PERFORM net.http_post(
    url := url_call,
    body := payload,
    headers := headers
  );

  RETURN NEW;
EXCEPTION WHEN undefined_function OR invalid_schema_name OR undefined_table THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_new_trip_booking_ins ON public.trip_bookings;
CREATE TRIGGER trg_notify_admin_new_trip_booking_ins
  AFTER INSERT ON public.trip_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_admin_new_trip_booking();

CREATE OR REPLACE FUNCTION public.trg_notify_admin_new_hotel_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload JSONB;
  url TEXT := 'https://daoohnbnnowmmcizgvrq.functions.supabase.co/send-admin-notification';
  url_call TEXT;
  secret TEXT;
  headers JSONB;
BEGIN
  SELECT COALESCE(admin_notify_secret, '')
  INTO secret
  FROM public.shop_settings
  WHERE id = 1;

  url_call := url || CASE WHEN secret <> '' THEN ('?secret=' || secret) ELSE '' END;

  headers := jsonb_build_object('content-type', 'application/json') ||
    CASE WHEN secret <> '' THEN jsonb_build_object('x-admin-notify-secret', secret) ELSE '{}'::jsonb END;

  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'record', to_jsonb(NEW)
  );

  PERFORM net.http_post(
    url := url_call,
    body := payload,
    headers := headers
  );

  RETURN NEW;
EXCEPTION WHEN undefined_function OR invalid_schema_name OR undefined_table THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_new_hotel_booking_ins ON public.hotel_bookings;
CREATE TRIGGER trg_notify_admin_new_hotel_booking_ins
  AFTER INSERT ON public.hotel_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_admin_new_hotel_booking();

CREATE OR REPLACE FUNCTION public.trg_notify_admin_shop_order_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload JSONB;
  url TEXT := 'https://daoohnbnnowmmcizgvrq.functions.supabase.co/send-admin-notification';
  to_status TEXT;
  already_sent BOOLEAN;
  url_call TEXT;
  secret TEXT;
  headers JSONB;
BEGIN
  to_status := LOWER(COALESCE(NEW.to_status, ''));
  already_sent := COALESCE(NEW.notification_sent, false);

  IF to_status <> 'confirmed' THEN
    RETURN NEW;
  END IF;

  IF already_sent THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(admin_notify_secret, '')
  INTO secret
  FROM public.shop_settings
  WHERE id = 1;

  url_call := url || CASE WHEN secret <> '' THEN ('?secret=' || secret) ELSE '' END;

  headers := jsonb_build_object('content-type', 'application/json') ||
    CASE WHEN secret <> '' THEN jsonb_build_object('x-admin-notify-secret', secret) ELSE '{}'::jsonb END;

  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'record', to_jsonb(NEW)
  );

  PERFORM net.http_post(
    url := url_call,
    body := payload,
    headers := headers
  );

  RETURN NEW;
EXCEPTION WHEN undefined_function OR invalid_schema_name OR undefined_table THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_shop_order_paid_ins ON public.shop_order_history;
CREATE TRIGGER trg_notify_admin_shop_order_paid_ins
  AFTER INSERT ON public.shop_order_history
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_admin_shop_order_paid();
