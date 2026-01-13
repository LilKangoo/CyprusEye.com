ALTER TABLE IF EXISTS public.partners
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS notification_email TEXT;

CREATE OR REPLACE FUNCTION public.trg_enqueue_partner_pending_service_fulfillment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  payload JSONB;
  category TEXT;
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
    ELSE 'trips'
  END;

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

DROP TRIGGER IF EXISTS trg_enqueue_partner_pending_service_fulfillment_ins ON public.partner_service_fulfillments;
DROP TRIGGER IF EXISTS trg_enqueue_partner_pending_service_fulfillment_upd ON public.partner_service_fulfillments;

CREATE TRIGGER trg_enqueue_partner_pending_service_fulfillment_ins
  AFTER INSERT ON public.partner_service_fulfillments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enqueue_partner_pending_service_fulfillment();

CREATE TRIGGER trg_enqueue_partner_pending_service_fulfillment_upd
  AFTER UPDATE OF status ON public.partner_service_fulfillments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enqueue_partner_pending_service_fulfillment();

CREATE OR REPLACE FUNCTION public.trg_enqueue_partner_pending_shop_fulfillment()
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

  IF NEW.status <> 'pending_acceptance' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(OLD.status, '') = COALESCE(NEW.status, '') THEN
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'category', 'shop',
    'record_id', NEW.id::text,
    'event', 'partner_pending_acceptance',
    'table', 'shop_order_fulfillments',
    'record', to_jsonb(NEW)
  );

  PERFORM public.enqueue_admin_notification(
    'shop',
    'partner_pending_acceptance',
    NEW.id::text,
    'shop_order_fulfillments',
    payload,
    'partner_pending_acceptance:shop:' || NEW.id::text
  );

  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_enqueue_partner_pending_shop_fulfillment_ins ON public.shop_order_fulfillments;
DROP TRIGGER IF EXISTS trg_enqueue_partner_pending_shop_fulfillment_upd ON public.shop_order_fulfillments;

CREATE TRIGGER trg_enqueue_partner_pending_shop_fulfillment_ins
  AFTER INSERT ON public.shop_order_fulfillments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enqueue_partner_pending_shop_fulfillment();

CREATE TRIGGER trg_enqueue_partner_pending_shop_fulfillment_upd
  AFTER UPDATE OF status ON public.shop_order_fulfillments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enqueue_partner_pending_shop_fulfillment();
