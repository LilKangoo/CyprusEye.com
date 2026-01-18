DO $$
BEGIN
  IF to_regclass('public.partner_service_fulfillments') IS NULL THEN
    RETURN;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.trg_partner_service_fulfillments_expire_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_active UUID;
BEGIN
  IF NEW.resource_type NOT IN ('trips', 'hotels') THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM 'pending_acceptance' THEN
    RETURN NEW;
  END IF;

  SELECT f.id
  INTO existing_active
  FROM public.partner_service_fulfillments f
  WHERE f.resource_type = NEW.resource_type
    AND f.booking_id = NEW.booking_id
    AND f.status IN ('awaiting_payment', 'accepted')
  ORDER BY f.accepted_at NULLS LAST, f.created_at, f.id
  LIMIT 1;

  IF existing_active IS NOT NULL THEN
    NEW.status := 'closed';
    NEW.updated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.partner_service_fulfillments') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'DROP TRIGGER IF EXISTS trg_partner_service_fulfillments_expire_on_insert ON public.partner_service_fulfillments';
  EXECUTE 'CREATE TRIGGER trg_partner_service_fulfillments_expire_on_insert BEFORE INSERT ON public.partner_service_fulfillments FOR EACH ROW EXECUTE FUNCTION public.trg_partner_service_fulfillments_expire_on_insert()';
END $$;

WITH active AS (
  SELECT resource_type, booking_id
  FROM public.partner_service_fulfillments
  WHERE resource_type IN ('trips', 'hotels')
    AND status IN ('awaiting_payment', 'accepted')
)
UPDATE public.partner_service_fulfillments f
SET status = 'closed',
    updated_at = now()
FROM active a
WHERE f.resource_type = a.resource_type
  AND f.booking_id = a.booking_id
  AND f.status = 'pending_acceptance';
