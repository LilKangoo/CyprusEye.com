CREATE TABLE IF NOT EXISTS public.email_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  deposit_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.email_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.service_deposit_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type text NOT NULL CHECK (resource_type IN ('cars','trips','hotels')),
  mode text NOT NULL CHECK (mode IN ('per_day','per_person','flat')),
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  include_children boolean NOT NULL DEFAULT true,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(resource_type)
);

CREATE TABLE IF NOT EXISTS public.service_deposit_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type text NOT NULL CHECK (resource_type IN ('cars','trips','hotels')),
  resource_id uuid NOT NULL,
  mode text NOT NULL CHECK (mode IN ('per_day','per_person','flat')),
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  include_children boolean NOT NULL DEFAULT true,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(resource_type, resource_id)
);

CREATE TABLE IF NOT EXISTS public.service_deposit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_id uuid NOT NULL REFERENCES public.partner_service_fulfillments(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  resource_type text NOT NULL CHECK (resource_type IN ('cars','trips','hotels')),
  booking_id uuid NOT NULL,
  resource_id uuid,
  fulfillment_reference text,
  fulfillment_summary text,
  customer_name text,
  customer_email text,
  customer_phone text,
  lang text,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired','cancelled')),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  checkout_url text,
  email_sent_at timestamptz,
  partner_email_sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(fulfillment_id)
);

CREATE INDEX IF NOT EXISTS service_deposit_requests_status_idx
  ON public.service_deposit_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS service_deposit_requests_booking_idx
  ON public.service_deposit_requests (resource_type, booking_id);

DO $$
DECLARE
  status_constraint_name text;
BEGIN
  IF to_regclass('public.car_bookings') IS NOT NULL THEN
    ALTER TABLE public.car_bookings
      ADD COLUMN IF NOT EXISTS lang text,
      ADD COLUMN IF NOT EXISTS deposit_paid_at timestamptz,
      ADD COLUMN IF NOT EXISTS deposit_amount numeric(12,2),
      ADD COLUMN IF NOT EXISTS deposit_currency text;
  END IF;

  IF to_regclass('public.trip_bookings') IS NOT NULL THEN
    ALTER TABLE public.trip_bookings
      ADD COLUMN IF NOT EXISTS lang text,
      ADD COLUMN IF NOT EXISTS deposit_paid_at timestamptz,
      ADD COLUMN IF NOT EXISTS deposit_amount numeric(12,2),
      ADD COLUMN IF NOT EXISTS deposit_currency text;
  END IF;

  IF to_regclass('public.hotel_bookings') IS NOT NULL THEN
    ALTER TABLE public.hotel_bookings
      ADD COLUMN IF NOT EXISTS lang text,
      ADD COLUMN IF NOT EXISTS deposit_paid_at timestamptz,
      ADD COLUMN IF NOT EXISTS deposit_amount numeric(12,2),
      ADD COLUMN IF NOT EXISTS deposit_currency text;
  END IF;

  IF to_regclass('public.partner_service_fulfillments') IS NOT NULL THEN
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
      CHECK (status IN ('pending_acceptance','awaiting_payment','accepted','rejected','expired'));
  END IF;
END $$;

 CREATE OR REPLACE FUNCTION public.partner_accept_service_fulfillment(p_fulfillment_id UUID)
 RETURNS TABLE(fulfillment_id UUID, partner_id UUID, resource_type TEXT, booking_id UUID)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
 AS $$
 DECLARE
   f RECORD;
   now_ts TIMESTAMPTZ := NOW();
   deposit_enabled BOOLEAN := TRUE;
 BEGIN
   BEGIN
     SELECT COALESCE(es.deposit_enabled, TRUE) INTO deposit_enabled
     FROM public.email_settings es
     WHERE es.id = 1;
   EXCEPTION WHEN others THEN
     deposit_enabled := TRUE;
   END;

   SELECT * INTO f
   FROM public.partner_service_fulfillments
   WHERE id = p_fulfillment_id;

   IF NOT FOUND THEN
     RAISE EXCEPTION 'fulfillment_not_found';
   END IF;

   IF NOT public.is_partner_user(f.partner_id) THEN
     RAISE EXCEPTION 'forbidden';
   END IF;

   IF f.status <> 'pending_acceptance' THEN
     fulfillment_id := f.id;
     partner_id := f.partner_id;
     resource_type := f.resource_type;
     booking_id := f.booking_id;
     RETURN NEXT;
     RETURN;
   END IF;

   UPDATE public.partner_service_fulfillments
   SET
     status = CASE WHEN deposit_enabled THEN 'awaiting_payment' ELSE 'accepted' END,
     accepted_at = COALESCE(accepted_at, now_ts),
     accepted_by = COALESCE(accepted_by, auth.uid()),
     contact_revealed_at = CASE WHEN deposit_enabled THEN contact_revealed_at ELSE COALESCE(contact_revealed_at, now_ts) END,
     rejected_at = NULL,
     rejected_by = NULL,
     rejected_reason = NULL
   WHERE id = p_fulfillment_id;

   INSERT INTO public.partner_audit_log(partner_id, actor_user_id, action, entity_type, entity_id, metadata)
   VALUES (
     f.partner_id,
     auth.uid(),
     'fulfillment_accepted',
     'service_fulfillment',
     f.id,
     jsonb_build_object('resource_type', f.resource_type, 'booking_id', f.booking_id)
   );

   fulfillment_id := f.id;
   partner_id := f.partner_id;
   resource_type := f.resource_type;
   booking_id := f.booking_id;
   RETURN NEXT;
 END;
 $$;

 GRANT EXECUTE ON FUNCTION public.partner_accept_service_fulfillment(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_deposit_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_deposit_rules_updated_at ON public.service_deposit_rules;
CREATE TRIGGER trg_service_deposit_rules_updated_at
  BEFORE UPDATE ON public.service_deposit_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_deposit_updated_at();

DROP TRIGGER IF EXISTS trg_service_deposit_overrides_updated_at ON public.service_deposit_overrides;
CREATE TRIGGER trg_service_deposit_overrides_updated_at
  BEFORE UPDATE ON public.service_deposit_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_deposit_updated_at();

DROP TRIGGER IF EXISTS trg_service_deposit_requests_updated_at ON public.service_deposit_requests;
CREATE TRIGGER trg_service_deposit_requests_updated_at
  BEFORE UPDATE ON public.service_deposit_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_deposit_updated_at();

INSERT INTO public.service_deposit_rules (resource_type, mode, amount, currency, include_children, enabled)
VALUES
  ('cars', 'per_day', 5, 'EUR', true, true),
  ('hotels', 'per_day', 10, 'EUR', true, true),
  ('trips', 'per_person', 10, 'EUR', true, true)
ON CONFLICT (resource_type) DO NOTHING;

ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_deposit_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_deposit_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_deposit_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.email_settings FROM anon, authenticated;
REVOKE ALL ON TABLE public.service_deposit_rules FROM anon, authenticated;
REVOKE ALL ON TABLE public.service_deposit_overrides FROM anon, authenticated;
REVOKE ALL ON TABLE public.service_deposit_requests FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.email_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.service_deposit_rules TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.service_deposit_overrides TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.service_deposit_requests TO service_role;

DROP POLICY IF EXISTS email_settings_admin_all ON public.email_settings;
CREATE POLICY email_settings_admin_all
ON public.email_settings
FOR ALL
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS service_deposit_rules_admin_all ON public.service_deposit_rules;
CREATE POLICY service_deposit_rules_admin_all
ON public.service_deposit_rules
FOR ALL
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS service_deposit_overrides_admin_all ON public.service_deposit_overrides;
CREATE POLICY service_deposit_overrides_admin_all
ON public.service_deposit_overrides
FOR ALL
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS service_deposit_requests_admin_all ON public.service_deposit_requests;
CREATE POLICY service_deposit_requests_admin_all
ON public.service_deposit_requests
FOR ALL
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

DO $$
BEGIN
  IF to_regclass('public.partner_service_fulfillment_contacts') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS partner_service_fulfillment_contacts_partner_read ON public.partner_service_fulfillment_contacts';
    EXECUTE $p$
      CREATE POLICY partner_service_fulfillment_contacts_partner_read
      ON public.partner_service_fulfillment_contacts
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.partner_service_fulfillments f
          WHERE f.id = fulfillment_id
            AND public.is_partner_user(f.partner_id)
            AND f.contact_revealed_at IS NOT NULL
        )
      )
    $p$;
  END IF;

  IF to_regclass('public.shop_order_fulfillment_contacts') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS shop_order_fulfillment_contacts_partner_read ON public.shop_order_fulfillment_contacts';
    EXECUTE $p$
      CREATE POLICY shop_order_fulfillment_contacts_partner_read
      ON public.shop_order_fulfillment_contacts
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.shop_order_fulfillments f
          WHERE f.id = fulfillment_id
            AND f.partner_id IS NOT NULL
            AND public.is_partner_user(f.partner_id)
            AND f.contact_revealed_at IS NOT NULL
        )
      )
    $p$;
  END IF;
END $$;
