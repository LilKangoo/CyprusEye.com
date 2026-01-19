CREATE OR REPLACE FUNCTION public.affiliate_get_user_partner_id(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT pu.partner_id
  FROM public.partner_users pu
  JOIN public.partners p ON p.id = pu.partner_id
  WHERE pu.user_id = p_user_id
    AND COALESCE(p.affiliate_enabled, false) = true
  ORDER BY (pu.role = 'owner') DESC, pu.created_at ASC
  LIMIT 1;
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
    BEGIN
      ref1 := public.affiliate_get_referrer_user_id(payer_user_id);
    EXCEPTION WHEN undefined_function THEN
      SELECT referred_by INTO ref1
      FROM public.profiles
      WHERE id = payer_user_id;
    END;
  END IF;

  IF ref1 IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_referrer', 'payer_user_id', payer_user_id);
  END IF;

  BEGIN
    ref2 := public.affiliate_get_referrer_user_id(ref1);
    ref3 := public.affiliate_get_referrer_user_id(ref2);
  EXCEPTION WHEN undefined_function THEN
    SELECT referred_by INTO ref2
    FROM public.profiles
    WHERE id = ref1;

    SELECT referred_by INTO ref3
    FROM public.profiles
    WHERE id = ref2;
  END;

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

    ref_partner_id := NULL;

    IF p_force_partner_id IS NOT NULL AND lvl = 1 THEN
      IF EXISTS (
        SELECT 1
        FROM public.partner_users pu
        JOIN public.partners p ON p.id = pu.partner_id
        WHERE pu.partner_id = p_force_partner_id
          AND pu.user_id = ref_user
          AND COALESCE(p.affiliate_enabled, false) = true
      ) THEN
        ref_partner_id := p_force_partner_id;
      END IF;
    END IF;

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

GRANT EXECUTE ON FUNCTION public.affiliate_get_user_partner_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_admin_recompute_commissions_for_deposit(uuid, uuid, uuid, uuid) TO authenticated;
