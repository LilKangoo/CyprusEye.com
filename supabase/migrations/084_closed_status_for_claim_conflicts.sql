DO $$
BEGIN
  IF to_regclass('public.partner_service_fulfillments') IS NULL THEN
    RETURN;
  END IF;
END $$;

DO $$
DECLARE
  status_constraint_name text;
BEGIN
  IF to_regclass('public.partner_service_fulfillments') IS NULL THEN
    RETURN;
  END IF;

  SELECT c.conname
  INTO status_constraint_name
  FROM pg_constraint c
  WHERE c.conrelid = 'public.partner_service_fulfillments'::regclass
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%status%IN%pending_acceptance%accepted%rejected%expired%'
  LIMIT 1;

  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.partner_service_fulfillments'::regclass
      AND c.contype = 'c'
      AND c.conname = 'partner_service_fulfillments_status_check'
  ) THEN
    EXECUTE 'ALTER TABLE public.partner_service_fulfillments DROP CONSTRAINT partner_service_fulfillments_status_check';
  END IF;

  IF status_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.partner_service_fulfillments DROP CONSTRAINT %I', status_constraint_name);
  END IF;

  ALTER TABLE public.partner_service_fulfillments
    ADD CONSTRAINT partner_service_fulfillments_status_check
    CHECK (status IN ('pending_acceptance','awaiting_payment','accepted','rejected','expired','closed'));
END $$;

CREATE OR REPLACE FUNCTION public.trg_partner_service_fulfillments_sync_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_active UUID;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.resource_type NOT IN ('trips', 'hotels') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('awaiting_payment', 'accepted') THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('partner_service_fulfillments:' || NEW.resource_type),
    hashtext(NEW.booking_id::text)
  );

  SELECT f.id
  INTO existing_active
  FROM public.partner_service_fulfillments f
  WHERE f.resource_type = NEW.resource_type
    AND f.booking_id = NEW.booking_id
    AND f.id <> NEW.id
    AND f.status IN ('awaiting_payment', 'accepted')
  ORDER BY f.accepted_at NULLS LAST, f.created_at, f.id
  LIMIT 1;

  IF existing_active IS NOT NULL THEN
    NEW.status := 'closed';
    NEW.updated_at := now();
    NEW.accepted_at := OLD.accepted_at;
    NEW.accepted_by := OLD.accepted_by;
    NEW.contact_revealed_at := OLD.contact_revealed_at;
    RETURN NEW;
  END IF;

  WITH to_expire AS (
    SELECT f.id
    FROM public.partner_service_fulfillments f
    WHERE f.resource_type = NEW.resource_type
      AND f.booking_id = NEW.booking_id
      AND f.id <> NEW.id
      AND f.status = 'pending_acceptance'
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.partner_service_fulfillments f
  SET status = 'closed',
      updated_at = now()
  FROM to_expire e
  WHERE f.id = e.id;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.partner_service_fulfillments') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'DROP TRIGGER IF EXISTS trg_partner_service_fulfillments_sync_status ON public.partner_service_fulfillments';
  EXECUTE 'CREATE TRIGGER trg_partner_service_fulfillments_sync_status BEFORE UPDATE OF status ON public.partner_service_fulfillments FOR EACH ROW EXECUTE FUNCTION public.trg_partner_service_fulfillments_sync_status()';
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
  AND (
    f.status = 'pending_acceptance'
    OR (f.status = 'expired' AND f.accepted_at IS NULL)
  );
