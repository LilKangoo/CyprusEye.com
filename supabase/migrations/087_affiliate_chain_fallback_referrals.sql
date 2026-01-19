CREATE OR REPLACE FUNCTION public.affiliate_get_referrer_user_id(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_ref uuid;
  has_referrer_id boolean;
  has_referred_id boolean;
  has_status boolean;
  has_created_at boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p.referred_by INTO v_ref
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF v_ref IS NOT NULL THEN
    RETURN v_ref;
  END IF;

  IF to_regclass('public.referrals') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'referrals'
        AND c.column_name = 'referrer_id'
    ) INTO has_referrer_id;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'referrals'
        AND c.column_name = 'referred_id'
    ) INTO has_referred_id;

    IF has_referrer_id AND has_referred_id THEN
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = 'referrals'
          AND c.column_name = 'status'
      ) INTO has_status;

      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = 'referrals'
          AND c.column_name = 'created_at'
      ) INTO has_created_at;

      IF has_status AND has_created_at THEN
        SELECT r.referrer_id INTO v_ref
        FROM public.referrals r
        WHERE r.referred_id = p_user_id
          AND COALESCE(r.status, '') IN ('confirmed', 'pending')
        ORDER BY (r.status = 'confirmed') DESC, r.created_at DESC
        LIMIT 1;
      ELSIF has_status THEN
        SELECT r.referrer_id INTO v_ref
        FROM public.referrals r
        WHERE r.referred_id = p_user_id
          AND COALESCE(r.status, '') IN ('confirmed', 'pending')
        ORDER BY (r.status = 'confirmed') DESC
        LIMIT 1;
      ELSIF has_created_at THEN
        SELECT r.referrer_id INTO v_ref
        FROM public.referrals r
        WHERE r.referred_id = p_user_id
        ORDER BY r.created_at DESC
        LIMIT 1;
      ELSE
        SELECT r.referrer_id INTO v_ref
        FROM public.referrals r
        WHERE r.referred_id = p_user_id
        LIMIT 1;
      END IF;
    END IF;
  END IF;

  RETURN v_ref;
END;
$$;

GRANT EXECUTE ON FUNCTION public.affiliate_get_referrer_user_id(uuid) TO authenticated;

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

  ref1 := public.affiliate_get_referrer_user_id(payer_user_id);
  IF ref1 IS NULL THEN
    RETURN NEW;
  END IF;

  ref2 := public.affiliate_get_referrer_user_id(ref1);
  ref3 := public.affiliate_get_referrer_user_id(ref2);

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

CREATE OR REPLACE FUNCTION public.affiliate_admin_recompute_commissions_for_deposit(
  p_deposit_request_id uuid,
  p_force_referrer_user_id uuid DEFAULT NULL,
  p_force_payer_user_id uuid DEFAULT NULL,
  p_force_partner_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dep RECORD;
  payer_user_id uuid;
  ref1 uuid;
  ref2 uuid;
  ref3 uuid;
  ref_user uuid;
  lvl smallint;
  ref_partner_id uuid;
  bps integer;
  commission numeric(12,2);
  inserted_count integer := 0;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO dep
  FROM public.service_deposit_requests
  WHERE id = p_deposit_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'deposit_not_found';
  END IF;

  IF dep.status <> 'paid' THEN
    RAISE EXCEPTION 'deposit_not_paid';
  END IF;

  payer_user_id := p_force_payer_user_id;
  IF payer_user_id IS NULL THEN
    IF dep.customer_email IS NULL OR length(trim(dep.customer_email)) = 0 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'missing_customer_email');
    END IF;

    SELECT p.id INTO payer_user_id
    FROM public.profiles p
    WHERE lower(trim(p.email)) = lower(trim(dep.customer_email))
    ORDER BY p.created_at DESC
    LIMIT 1;
  END IF;

  IF payer_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'payer_not_found');
  END IF;

  ref1 := p_force_referrer_user_id;
  IF ref1 IS NULL THEN
    ref1 := public.affiliate_get_referrer_user_id(payer_user_id);
  END IF;

  IF ref1 IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_referrer', 'payer_user_id', payer_user_id);
  END IF;

  ref2 := public.affiliate_get_referrer_user_id(ref1);
  ref3 := public.affiliate_get_referrer_user_id(ref2);

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

    ref_partner_id := p_force_partner_id;
    IF ref_partner_id IS NULL THEN
      ref_partner_id := public.affiliate_get_user_partner_id(ref_user);
    END IF;

    IF ref_partner_id IS NULL THEN
      CONTINUE;
    END IF;

    bps := public.affiliate_effective_bps(ref_partner_id, ref_user, lvl);
    IF COALESCE(bps, 0) <= 0 THEN
      CONTINUE;
    END IF;

    commission := round((dep.amount * bps) / 10000.0, 2);
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
      dep.id,
      lvl,
      ref_user,
      payer_user_id,
      dep.resource_type,
      dep.booking_id,
      dep.fulfillment_id,
      dep.paid_at,
      dep.amount,
      bps,
      commission,
      COALESCE(dep.currency, 'EUR')
    ) ON CONFLICT (deposit_request_id, level) DO NOTHING;

    IF FOUND THEN
      inserted_count := inserted_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'deposit_request_id', dep.id,
    'payer_user_id', payer_user_id,
    'referrer_user_id', ref1,
    'inserted', inserted_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.affiliate_admin_recompute_commissions_for_deposit(uuid, uuid, uuid, uuid) TO authenticated;
