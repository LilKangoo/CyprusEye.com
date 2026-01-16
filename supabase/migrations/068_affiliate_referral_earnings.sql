CREATE TABLE IF NOT EXISTS public.affiliate_program_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  level1_bps_default integer NOT NULL DEFAULT 500,
  level2_bps_default integer NOT NULL DEFAULT 100,
  level3_bps_default integer NOT NULL DEFAULT 50,
  payout_threshold numeric(12,2) NOT NULL DEFAULT 70,
  currency text NOT NULL DEFAULT 'EUR',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.affiliate_program_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS affiliate_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS affiliate_level1_bps_override integer,
  ADD COLUMN IF NOT EXISTS affiliate_level2_bps_override integer,
  ADD COLUMN IF NOT EXISTS affiliate_level3_bps_override integer;

CREATE TABLE IF NOT EXISTS public.affiliate_referrer_overrides (
  referrer_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  level1_bps_override integer,
  level2_bps_override integer,
  level3_bps_override integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.update_affiliate_referrer_overrides_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_affiliate_referrer_overrides_updated_at ON public.affiliate_referrer_overrides;
CREATE TRIGGER trg_affiliate_referrer_overrides_updated_at
  BEFORE UPDATE ON public.affiliate_referrer_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_affiliate_referrer_overrides_updated_at();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    WHERE tc.constraint_schema = 'public'
      AND tc.table_name = 'profiles'
      AND tc.constraint_name = 'profiles_referred_by_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_referred_by_fkey
      FOREIGN KEY (referred_by)
      REFERENCES public.profiles(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS profiles_referred_by_idx ON public.profiles(referred_by);

CREATE OR REPLACE FUNCTION public.prevent_referred_by_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_current_user_admin() THEN
    RETURN NEW;
  END IF;

  IF OLD.referred_by IS NOT NULL AND NEW.referred_by IS DISTINCT FROM OLD.referred_by THEN
    RAISE EXCEPTION 'referred_by_immutable';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_prevent_referred_by_change ON public.profiles;
CREATE TRIGGER trg_profiles_prevent_referred_by_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_referred_by_change();

CREATE TABLE IF NOT EXISTS public.affiliate_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_at timestamptz,
  notes text
);

CREATE INDEX IF NOT EXISTS affiliate_payouts_partner_idx
  ON public.affiliate_payouts (partner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.affiliate_commission_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  deposit_request_id uuid NOT NULL REFERENCES public.service_deposit_requests(id) ON DELETE CASCADE,
  level smallint NOT NULL CHECK (level IN (1,2,3)),
  referrer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_type text NOT NULL CHECK (resource_type IN ('cars','trips','hotels')),
  booking_id uuid NOT NULL,
  fulfillment_id uuid NOT NULL,
  deposit_paid_at timestamptz,
  deposit_amount numeric(12,2) NOT NULL,
  commission_bps integer NOT NULL,
  commission_amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  payout_id uuid REFERENCES public.affiliate_payouts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(deposit_request_id, level)
);

CREATE INDEX IF NOT EXISTS affiliate_commission_events_partner_unpaid_idx
  ON public.affiliate_commission_events (partner_id, payout_id, created_at DESC);

CREATE INDEX IF NOT EXISTS affiliate_commission_events_partner_idx
  ON public.affiliate_commission_events (partner_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.affiliate_get_user_partner_id(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT pu.partner_id
  FROM public.partner_users pu
  WHERE pu.user_id = p_user_id
  ORDER BY (pu.role = 'owner') DESC, pu.created_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.affiliate_effective_bps(p_partner_id uuid, p_referrer_user_id uuid, p_level smallint)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  settings RECORD;
  p RECORD;
  uo RECORD;
  bps integer;
BEGIN
  SELECT * INTO settings
  FROM public.affiliate_program_settings
  WHERE id = 1;

  SELECT affiliate_enabled,
         affiliate_level1_bps_override,
         affiliate_level2_bps_override,
         affiliate_level3_bps_override
  INTO p
  FROM public.partners
  WHERE id = p_partner_id;

  SELECT level1_bps_override,
         level2_bps_override,
         level3_bps_override
  INTO uo
  FROM public.affiliate_referrer_overrides
  WHERE referrer_user_id = p_referrer_user_id;

  IF NOT COALESCE(p.affiliate_enabled, false) THEN
    RETURN 0;
  END IF;

  IF p_level = 1 THEN
    bps := COALESCE(uo.level1_bps_override, p.affiliate_level1_bps_override, settings.level1_bps_default);
  ELSIF p_level = 2 THEN
    bps := COALESCE(uo.level2_bps_override, p.affiliate_level2_bps_override, settings.level2_bps_default);
  ELSIF p_level = 3 THEN
    bps := COALESCE(uo.level3_bps_override, p.affiliate_level3_bps_override, settings.level3_bps_default);
  ELSE
    bps := 0;
  END IF;

  RETURN GREATEST(COALESCE(bps, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.affiliate_handle_service_deposit_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payer_user_id uuid;
  ref1 uuid;
  ref2 uuid;
  ref3 uuid;
  ref_user uuid;
  lvl smallint;
  ref_partner_id uuid;
  bps integer;
  commission numeric(12,2);
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status <> 'paid' THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'paid' THEN
    RETURN NEW;
  END IF;

  IF NEW.customer_email IS NULL OR length(trim(NEW.customer_email)) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT p.id INTO payer_user_id
  FROM public.profiles p
  WHERE lower(trim(p.email)) = lower(trim(NEW.customer_email))
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF payer_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT referred_by INTO ref1
  FROM public.profiles
  WHERE id = payer_user_id;

  IF ref1 IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT referred_by INTO ref2
  FROM public.profiles
  WHERE id = ref1;

  SELECT referred_by INTO ref3
  FROM public.profiles
  WHERE id = ref2;

  FOR lvl IN 1..3 LOOP
    IF lvl = 1 THEN
      ref_user := ref1;
    ELSIF lvl = 2 THEN
      ref_user := ref2;
    ELSE
      ref_user := ref3;
    END IF;

    IF ref_user IS NULL THEN
      CONTINUE;
    END IF;

    ref_partner_id := public.affiliate_get_user_partner_id(ref_user);
    IF ref_partner_id IS NULL THEN
      CONTINUE;
    END IF;

    bps := public.affiliate_effective_bps(ref_partner_id, ref_user, lvl);
    IF COALESCE(bps, 0) <= 0 THEN
      CONTINUE;
    END IF;

    commission := round((NEW.amount * bps) / 10000.0, 2);
    IF commission <= 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO public.affiliate_commission_events (
      partner_id,
      deposit_request_id,
      level,
      referrer_user_id,
      referred_user_id,
      resource_type,
      booking_id,
      fulfillment_id,
      deposit_paid_at,
      deposit_amount,
      commission_bps,
      commission_amount,
      currency
    ) VALUES (
      ref_partner_id,
      NEW.id,
      lvl,
      ref_user,
      payer_user_id,
      NEW.resource_type,
      NEW.booking_id,
      NEW.fulfillment_id,
      NEW.paid_at,
      NEW.amount,
      bps,
      commission,
      COALESCE(NEW.currency, 'EUR')
    ) ON CONFLICT (deposit_request_id, level) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_affiliate_on_service_deposit_paid ON public.service_deposit_requests;
CREATE TRIGGER trg_affiliate_on_service_deposit_paid
  AFTER UPDATE ON public.service_deposit_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.affiliate_handle_service_deposit_paid();

CREATE OR REPLACE FUNCTION public.affiliate_get_partner_balance(p_partner_id uuid)
RETURNS TABLE(
  partner_id uuid,
  unpaid_total numeric,
  paid_total numeric,
  payout_threshold numeric,
  currency text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  settings RECORD;
BEGIN
  IF NOT (public.is_current_user_admin() OR public.is_partner_user(p_partner_id)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO settings
  FROM public.affiliate_program_settings
  WHERE id = 1;

  RETURN QUERY
  SELECT
    p_partner_id AS partner_id,
    COALESCE((SELECT sum(e.commission_amount) FROM public.affiliate_commission_events e WHERE e.partner_id = p_partner_id AND e.payout_id IS NULL), 0) AS unpaid_total,
    COALESCE((SELECT sum(e.commission_amount) FROM public.affiliate_commission_events e WHERE e.partner_id = p_partner_id AND e.payout_id IS NOT NULL), 0) AS paid_total,
    COALESCE(settings.payout_threshold, 70) AS payout_threshold,
    COALESCE(settings.currency, 'EUR') AS currency;
END;
$$;

GRANT EXECUTE ON FUNCTION public.affiliate_get_partner_balance(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.affiliate_admin_create_payout(p_partner_id uuid, p_mark_paid boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  settings RECORD;
  unpaid_total numeric;
  v_payout_id uuid;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO settings
  FROM public.affiliate_program_settings
  WHERE id = 1;

  SELECT COALESCE(sum(e.commission_amount), 0) INTO unpaid_total
  FROM public.affiliate_commission_events e
  WHERE e.partner_id = p_partner_id
    AND e.payout_id IS NULL;

  IF unpaid_total < COALESCE(settings.payout_threshold, 70) THEN
    RAISE EXCEPTION 'threshold_not_met';
  END IF;

  INSERT INTO public.affiliate_payouts (
    partner_id,
    amount,
    currency,
    status,
    created_by,
    paid_by,
    paid_at
  ) VALUES (
    p_partner_id,
    unpaid_total,
    COALESCE(settings.currency, 'EUR'),
    CASE WHEN p_mark_paid THEN 'paid' ELSE 'pending' END,
    auth.uid(),
    CASE WHEN p_mark_paid THEN auth.uid() ELSE NULL END,
    CASE WHEN p_mark_paid THEN now() ELSE NULL END
  ) RETURNING id INTO v_payout_id;

  UPDATE public.affiliate_commission_events
  SET payout_id = v_payout_id
  WHERE partner_id = p_partner_id
    AND payout_id IS NULL;

  RETURN v_payout_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.affiliate_admin_create_payout(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.affiliate_admin_mark_payout_paid(p_payout_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.affiliate_payouts
  SET status = 'paid',
      paid_by = COALESCE(paid_by, auth.uid()),
      paid_at = COALESCE(paid_at, now())
  WHERE id = p_payout_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.affiliate_admin_mark_payout_paid(uuid) TO authenticated;

ALTER TABLE public.affiliate_program_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commission_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_referrer_overrides ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.affiliate_program_settings FROM anon, authenticated;
REVOKE ALL ON TABLE public.affiliate_commission_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.affiliate_payouts FROM anon, authenticated;
REVOKE ALL ON TABLE public.affiliate_referrer_overrides FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.affiliate_program_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.affiliate_commission_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.affiliate_payouts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.affiliate_referrer_overrides TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.affiliate_program_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.affiliate_commission_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.affiliate_payouts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.affiliate_referrer_overrides TO authenticated;

DROP POLICY IF EXISTS affiliate_program_settings_admin_all ON public.affiliate_program_settings;
CREATE POLICY affiliate_program_settings_admin_all
ON public.affiliate_program_settings
FOR ALL
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS affiliate_commission_events_admin_all ON public.affiliate_commission_events;
CREATE POLICY affiliate_commission_events_admin_all
ON public.affiliate_commission_events
FOR ALL
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS affiliate_commission_events_partner_read ON public.affiliate_commission_events;
CREATE POLICY affiliate_commission_events_partner_read
ON public.affiliate_commission_events
FOR SELECT
TO authenticated
USING (public.is_partner_user(partner_id));

DROP POLICY IF EXISTS affiliate_payouts_admin_all ON public.affiliate_payouts;
CREATE POLICY affiliate_payouts_admin_all
ON public.affiliate_payouts
FOR ALL
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS affiliate_payouts_partner_read ON public.affiliate_payouts;
CREATE POLICY affiliate_payouts_partner_read
ON public.affiliate_payouts
FOR SELECT
TO authenticated
USING (public.is_partner_user(partner_id));

DROP POLICY IF EXISTS affiliate_referrer_overrides_admin_all ON public.affiliate_referrer_overrides;
CREATE POLICY affiliate_referrer_overrides_admin_all
ON public.affiliate_referrer_overrides
FOR ALL
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());
