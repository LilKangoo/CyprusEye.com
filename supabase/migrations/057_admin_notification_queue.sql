create extension if not exists pgcrypto;

CREATE TABLE IF NOT EXISTS public.admin_notification_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  category text NOT NULL,
  event text NOT NULL,
  record_id text NOT NULL,
  table_name text,
  dedupe_key text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

 ALTER TABLE public.admin_notification_jobs ENABLE ROW LEVEL SECURITY;

 REVOKE ALL ON TABLE public.admin_notification_jobs FROM anon, authenticated;
 REVOKE ALL ON TABLE public.admin_notification_jobs FROM public;
 GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_notification_jobs TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS admin_notification_jobs_dedupe_key_uq
  ON public.admin_notification_jobs (dedupe_key);

CREATE INDEX IF NOT EXISTS admin_notification_jobs_status_next_idx
  ON public.admin_notification_jobs (status, next_attempt_at);

CREATE INDEX IF NOT EXISTS admin_notification_jobs_created_at_idx
  ON public.admin_notification_jobs (created_at);

CREATE OR REPLACE FUNCTION public.admin_notification_jobs_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_notification_jobs_set_updated_at ON public.admin_notification_jobs;
CREATE TRIGGER trg_admin_notification_jobs_set_updated_at
  BEFORE UPDATE ON public.admin_notification_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.admin_notification_jobs_set_updated_at();

CREATE OR REPLACE FUNCTION public.enqueue_admin_notification(
  p_category text,
  p_event text,
  p_record_id text,
  p_table_name text,
  p_payload jsonb,
  p_dedupe_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.admin_notification_jobs (category, event, record_id, table_name, payload, dedupe_key)
  VALUES (
    COALESCE(NULLIF(p_category, ''), 'shop'),
    COALESCE(NULLIF(p_event, ''), 'created'),
    COALESCE(NULLIF(p_record_id, ''), ''),
    NULLIF(p_table_name, ''),
    COALESCE(p_payload, '{}'::jsonb),
    NULLIF(p_dedupe_key, '')
  )
  ON CONFLICT (dedupe_key)
  DO UPDATE SET
    updated_at = now(),
    category = EXCLUDED.category,
    event = EXCLUDED.event,
    record_id = EXCLUDED.record_id,
    table_name = EXCLUDED.table_name,
    payload = EXCLUDED.payload,
    status = CASE WHEN admin_notification_jobs.status = 'sent' THEN 'sent' ELSE 'pending' END,
    next_attempt_at = CASE WHEN admin_notification_jobs.status = 'sent' THEN admin_notification_jobs.next_attempt_at ELSE now() END,
    last_error = CASE WHEN admin_notification_jobs.status = 'sent' THEN admin_notification_jobs.last_error ELSE NULL END
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_admin_notification(text, text, text, text, jsonb, text) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_admin_notification_jobs(p_limit int DEFAULT 10)
RETURNS SETOF public.admin_notification_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT id
    FROM public.admin_notification_jobs
    WHERE (status IN ('pending', 'failed') AND next_attempt_at <= now())
      OR (status = 'processing' AND updated_at < (now() - interval '10 minutes'))
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(p_limit, 0)
  ), upd AS (
    UPDATE public.admin_notification_jobs j
    SET status = 'processing',
        attempts = j.attempts + 1,
        updated_at = now()
    FROM picked
    WHERE j.id = picked.id
    RETURNING j.*
  )
  SELECT * FROM upd;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_admin_notification_jobs(int) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_admin_notification_job(
  p_id uuid,
  p_ok boolean,
  p_error text DEFAULT NULL,
  p_retry_seconds int DEFAULT 60
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_ok THEN
    UPDATE public.admin_notification_jobs
    SET status = 'sent',
        processed_at = now(),
        last_error = NULL,
        next_attempt_at = now(),
        updated_at = now()
    WHERE id = p_id;
  ELSE
    UPDATE public.admin_notification_jobs
    SET status = 'failed',
        last_error = p_error,
        next_attempt_at = now() + make_interval(secs => GREATEST(COALESCE(p_retry_seconds, 60), 10)),
        updated_at = now()
    WHERE id = p_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_admin_notification_job(uuid, boolean, text, int) TO service_role;

CREATE OR REPLACE FUNCTION public.trg_notify_admin_new_car_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload JSONB;
BEGIN
  payload := jsonb_build_object(
    'category', 'cars',
    'record_id', NEW.id::text,
    'event', 'created',
    'table', 'car_bookings',
    'record', to_jsonb(NEW)
  );

  PERFORM public.enqueue_admin_notification(
    'cars',
    'created',
    NEW.id::text,
    'car_bookings',
    payload,
    'cars_created:' || NEW.id::text
  );

  RETURN NEW;
EXCEPTION WHEN others THEN
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
BEGIN
  payload := jsonb_build_object(
    'category', 'trips',
    'record_id', NEW.id::text,
    'event', 'created',
    'table', 'trip_bookings',
    'record', to_jsonb(NEW)
  );

  PERFORM public.enqueue_admin_notification(
    'trips',
    'created',
    NEW.id::text,
    'trip_bookings',
    payload,
    'trips_created:' || NEW.id::text
  );

  RETURN NEW;
EXCEPTION WHEN others THEN
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
BEGIN
  payload := jsonb_build_object(
    'category', 'hotels',
    'record_id', NEW.id::text,
    'event', 'created',
    'table', 'hotel_bookings',
    'record', to_jsonb(NEW)
  );

  PERFORM public.enqueue_admin_notification(
    'hotels',
    'created',
    NEW.id::text,
    'hotel_bookings',
    payload,
    'hotels_created:' || NEW.id::text
  );

  RETURN NEW;
EXCEPTION WHEN others THEN
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
  to_status TEXT;
  already_sent BOOLEAN;
  order_id_text TEXT;
BEGIN
  to_status := LOWER(COALESCE(NEW.to_status, ''));
  already_sent := COALESCE(NEW.notification_sent, false);
  order_id_text := COALESCE(NEW.order_id::text, '');

  IF to_status <> 'confirmed' THEN
    RETURN NEW;
  END IF;

  IF already_sent THEN
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'category', 'shop',
    'record_id', order_id_text,
    'event', 'paid',
    'table', 'shop_order_history',
    'record', to_jsonb(NEW)
  );

  PERFORM public.enqueue_admin_notification(
    'shop',
    'paid',
    order_id_text,
    'shop_order_history',
    payload,
    'shop_paid:' || order_id_text
  );

  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_shop_order_paid_ins ON public.shop_order_history;
CREATE TRIGGER trg_notify_admin_shop_order_paid_ins
  AFTER INSERT ON public.shop_order_history
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_admin_shop_order_paid();
