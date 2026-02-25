CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.trg_kick_admin_notification_worker()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  call_url TEXT := 'https://daoohnbnnowmmcizgvrq.functions.supabase.co/process-admin-notifications?limit=25';
  secret TEXT := '';
  headers JSONB;
BEGIN
  IF TG_OP = 'UPDATE'
     AND COALESCE(NEW.status, '') = COALESCE(OLD.status, '')
     AND COALESCE(NEW.next_attempt_at, 'epoch'::timestamptz) = COALESCE(OLD.next_attempt_at, 'epoch'::timestamptz)
  THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.status, '') NOT IN ('pending', 'failed') THEN
    RETURN NEW;
  END IF;

  IF NEW.next_attempt_at IS NOT NULL AND NEW.next_attempt_at > now() THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(admin_notify_secret, '')
  INTO secret
  FROM public.shop_settings
  WHERE id = 1;

  headers := jsonb_build_object('content-type', 'application/json')
    || CASE WHEN secret <> '' THEN jsonb_build_object('x-admin-notify-worker-secret', secret) ELSE '{}'::jsonb END;

  PERFORM net.http_post(
    url := call_url,
    body := '{}'::jsonb,
    headers := headers
  );

  RETURN NEW;
EXCEPTION WHEN undefined_function OR invalid_schema_name OR undefined_table THEN
  RETURN NEW;
WHEN others THEN
  RETURN NEW;
END;
$fn$;

DO $$
BEGIN
  IF to_regclass('public.admin_notification_jobs') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_kick_admin_notification_worker_insupd ON public.admin_notification_jobs';
    EXECUTE 'CREATE TRIGGER trg_kick_admin_notification_worker_insupd
      AFTER INSERT OR UPDATE OF status, next_attempt_at
      ON public.admin_notification_jobs
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_kick_admin_notification_worker()';
  END IF;
END;
$$;
