CREATE OR REPLACE FUNCTION public.trg_notify_admin_partner_plus_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload jsonb;
BEGIN
  payload := jsonb_build_object(
    'category', 'partners',
    'event', 'partner_plus_application_created',
    'record_id', NEW.id::text,
    'table', 'partner_plus_applications',
    'record', to_jsonb(NEW)
  );

  PERFORM public.enqueue_admin_notification(
    'partners',
    'partner_plus_application_created',
    NEW.id::text,
    'partner_plus_applications',
    payload,
    'partner_plus_application_created:' || NEW.id::text
  );

  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_partner_plus_application_ins
  ON public.partner_plus_applications;

CREATE TRIGGER trg_notify_admin_partner_plus_application_ins
  AFTER INSERT ON public.partner_plus_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_admin_partner_plus_application();
