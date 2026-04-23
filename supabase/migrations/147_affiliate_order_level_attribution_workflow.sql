ALTER TABLE public.affiliate_commission_events
  ALTER COLUMN referred_user_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.affiliate_get_partner_owner_user_id(p_partner_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT pu.user_id
  FROM public.partner_users pu
  JOIN public.partners p ON p.id = pu.partner_id
  WHERE pu.partner_id = p_partner_id
    AND COALESCE(p.affiliate_enabled, false) = true
    AND COALESCE(p.status, 'active') = 'active'
  ORDER BY (pu.role = 'owner') DESC, pu.created_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.affiliate_get_booking_referral_for_deposit(
  p_resource_type text,
  p_booking_id uuid
)
RETURNS TABLE(
  referral_referrer_user_id uuid,
  referral_partner_id uuid,
  referral_code text,
  referral_source text,
  referral_captured_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF p_booking_id IS NULL THEN
    RETURN;
  END IF;

  IF p_resource_type = 'cars' THEN
    RETURN QUERY
    SELECT b.referral_referrer_user_id,
           b.referral_partner_id,
           b.referral_code,
           b.referral_source,
           b.referral_captured_at
    FROM public.car_bookings b
    WHERE b.id = p_booking_id
    LIMIT 1;
    RETURN;
  END IF;

  IF p_resource_type = 'trips' THEN
    RETURN QUERY
    SELECT b.referral_referrer_user_id,
           b.referral_partner_id,
           b.referral_code,
           b.referral_source,
           b.referral_captured_at
    FROM public.trip_bookings b
    WHERE b.id = p_booking_id
    LIMIT 1;
    RETURN;
  END IF;

  IF p_resource_type = 'hotels' THEN
    RETURN QUERY
    SELECT b.referral_referrer_user_id,
           b.referral_partner_id,
           b.referral_code,
           b.referral_source,
           b.referral_captured_at
    FROM public.hotel_bookings b
    WHERE b.id = p_booking_id
    LIMIT 1;
    RETURN;
  END IF;

  IF p_resource_type = 'transport' THEN
    RETURN QUERY
    SELECT b.referral_referrer_user_id,
           b.referral_partner_id,
           b.referral_code,
           b.referral_source,
           b.referral_captured_at
    FROM public.transport_bookings b
    WHERE b.id = p_booking_id
    LIMIT 1;
    RETURN;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.affiliate_resolve_deposit_context(
  p_deposit_request_id uuid,
  p_force_referrer_user_id uuid DEFAULT NULL,
  p_force_payer_user_id uuid DEFAULT NULL,
  p_force_partner_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  dep RECORD;
  payer_user_id uuid;
  referrer_user_id uuid;
  partner_id uuid;
  order_referrer_user_id uuid;
  order_partner_id uuid;
  order_referral_code text;
  order_referral_source text;
  order_referral_captured_at timestamptz;
  source text;
  reason text;
BEGIN
  SELECT *
  INTO dep
  FROM public.service_deposit_requests
  WHERE id = p_deposit_request_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'deposit_not_found');
  END IF;

  IF dep.status <> 'paid' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'deposit_not_paid',
      'deposit_request_id', dep.id,
      'status', dep.status
    );
  END IF;

  payer_user_id := p_force_payer_user_id;
  IF payer_user_id IS NULL AND NULLIF(trim(COALESCE(dep.customer_email, '')), '') IS NOT NULL THEN
    SELECT p.id
    INTO payer_user_id
    FROM public.profiles p
    WHERE lower(trim(COALESCE(p.email, ''))) = lower(trim(dep.customer_email))
    ORDER BY p.created_at DESC
    LIMIT 1;
  END IF;

  SELECT br.referral_referrer_user_id,
         br.referral_partner_id,
         br.referral_code,
         br.referral_source,
         br.referral_captured_at
  INTO order_referrer_user_id,
       order_partner_id,
       order_referral_code,
       order_referral_source,
       order_referral_captured_at
  FROM public.affiliate_get_booking_referral_for_deposit(dep.resource_type, dep.booking_id)
       AS br(referral_referrer_user_id, referral_partner_id, referral_code, referral_source, referral_captured_at)
  LIMIT 1;

  referrer_user_id := p_force_referrer_user_id;
  IF referrer_user_id IS NOT NULL THEN
    source := 'manual';
  END IF;

  IF referrer_user_id IS NULL AND p_force_partner_id IS NOT NULL THEN
    referrer_user_id := public.affiliate_get_partner_owner_user_id(p_force_partner_id);
    IF referrer_user_id IS NOT NULL THEN
      source := 'manual_partner_owner';
    END IF;
  END IF;

  IF referrer_user_id IS NULL AND payer_user_id IS NOT NULL THEN
    referrer_user_id := public.affiliate_get_referrer_user_id(payer_user_id);
    IF referrer_user_id IS NOT NULL THEN
      source := 'lifetime_profile';
    END IF;
  END IF;

  IF referrer_user_id IS NULL AND order_referrer_user_id IS NOT NULL THEN
    referrer_user_id := order_referrer_user_id;
    source := 'order_referral';
  END IF;

  IF referrer_user_id IS NULL AND order_partner_id IS NOT NULL THEN
    referrer_user_id := public.affiliate_get_partner_owner_user_id(order_partner_id);
    IF referrer_user_id IS NOT NULL THEN
      source := 'order_referral_partner_owner';
    END IF;
  END IF;

  IF referrer_user_id IS NULL THEN
    reason := CASE
      WHEN payer_user_id IS NULL AND order_referrer_user_id IS NULL AND order_partner_id IS NULL
        THEN 'no_profile_or_order_referral'
      WHEN payer_user_id IS NULL
        THEN 'no_referrer_for_guest'
      ELSE 'no_referrer'
    END;

    RETURN jsonb_build_object(
      'ok', false,
      'reason', reason,
      'deposit_request_id', dep.id,
      'resource_type', dep.resource_type,
      'booking_id', dep.booking_id,
      'customer_email', dep.customer_email,
      'payer_user_id', payer_user_id,
      'order_referrer_user_id', order_referrer_user_id,
      'order_partner_id', order_partner_id,
      'referral_code', order_referral_code,
      'referral_source', order_referral_source
    );
  END IF;

  IF payer_user_id IS NOT NULL AND payer_user_id = referrer_user_id THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'self_referral_blocked',
      'deposit_request_id', dep.id,
      'payer_user_id', payer_user_id,
      'referrer_user_id', referrer_user_id
    );
  END IF;

  partner_id := NULL;
  IF p_force_partner_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.partner_users pu
      JOIN public.partners p ON p.id = pu.partner_id
      WHERE pu.partner_id = p_force_partner_id
        AND pu.user_id = referrer_user_id
        AND COALESCE(p.affiliate_enabled, false) = true
        AND COALESCE(p.status, 'active') = 'active'
    ) THEN
      partner_id := p_force_partner_id;
    ELSE
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'forced_partner_not_allowed_for_referrer',
        'deposit_request_id', dep.id,
        'referrer_user_id', referrer_user_id,
        'forced_partner_id', p_force_partner_id
      );
    END IF;
  END IF;

  IF partner_id IS NULL
     AND order_partner_id IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.partner_users pu
       JOIN public.partners p ON p.id = pu.partner_id
       WHERE pu.partner_id = order_partner_id
         AND pu.user_id = referrer_user_id
         AND COALESCE(p.affiliate_enabled, false) = true
         AND COALESCE(p.status, 'active') = 'active'
     )
  THEN
    partner_id := order_partner_id;
  END IF;

  IF partner_id IS NULL THEN
    partner_id := public.affiliate_get_user_partner_id(referrer_user_id);
  END IF;

  IF partner_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'no_affiliate_partner',
      'deposit_request_id', dep.id,
      'referrer_user_id', referrer_user_id,
      'payer_user_id', payer_user_id,
      'source', COALESCE(source, 'unknown')
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'deposit_request_id', dep.id,
    'payer_user_id', payer_user_id,
    'referrer_user_id', referrer_user_id,
    'partner_id', partner_id,
    'source', COALESCE(source, 'unknown'),
    'resource_type', dep.resource_type,
    'booking_id', dep.booking_id,
    'customer_email', dep.customer_email,
    'order_referrer_user_id', order_referrer_user_id,
    'order_partner_id', order_partner_id,
    'referral_code', order_referral_code,
    'referral_source', order_referral_source,
    'referral_captured_at', order_referral_captured_at,
    'can_auto_apply', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.affiliate_insert_commission_events_for_deposit(
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
  ctx jsonb;
  payer_user_id uuid;
  ref1 uuid;
  ref2 uuid;
  ref3 uuid;
  ref_user uuid;
  ref_partner_id uuid;
  preferred_partner_id uuid;
  lvl smallint;
  bps integer;
  commission numeric(12,2);
  inserted_count integer := 0;
  row_count integer := 0;
BEGIN
  ctx := public.affiliate_resolve_deposit_context(
    p_deposit_request_id,
    p_force_referrer_user_id,
    p_force_payer_user_id,
    p_force_partner_id
  );

  IF COALESCE((ctx->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN ctx;
  END IF;

  SELECT *
  INTO dep
  FROM public.service_deposit_requests
  WHERE id = p_deposit_request_id;

  payer_user_id := NULLIF(ctx->>'payer_user_id', '')::uuid;
  ref1 := NULLIF(ctx->>'referrer_user_id', '')::uuid;
  preferred_partner_id := NULLIF(ctx->>'partner_id', '')::uuid;

  IF ref1 IS NULL THEN
    RETURN ctx || jsonb_build_object('ok', false, 'reason', 'no_referrer');
  END IF;

  ref2 := public.affiliate_get_referrer_user_id(ref1);
  IF ref2 IS NOT NULL THEN
    ref3 := public.affiliate_get_referrer_user_id(ref2);
  END IF;

  FOR lvl IN 1..3 LOOP
    IF lvl = 1 THEN
      ref_user := ref1;
      ref_partner_id := preferred_partner_id;
    ELSIF lvl = 2 THEN
      ref_user := ref2;
      ref_partner_id := NULL;
    ELSE
      ref_user := ref3;
      ref_partner_id := NULL;
    END IF;

    IF ref_user IS NULL THEN
      CONTINUE;
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

    GET DIAGNOSTICS row_count = ROW_COUNT;
    inserted_count := inserted_count + row_count;
  END LOOP;

  RETURN ctx || jsonb_build_object('ok', true, 'inserted', inserted_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.affiliate_handle_service_deposit_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'paid' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'paid'
       AND OLD.paid_at IS NOT DISTINCT FROM NEW.paid_at
    THEN
      RETURN NEW;
    END IF;
  END IF;

  BEGIN
    PERFORM public.affiliate_insert_commission_events_for_deposit(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_affiliate_on_service_deposit_paid ON public.service_deposit_requests;
CREATE TRIGGER trg_affiliate_on_service_deposit_paid
  AFTER INSERT OR UPDATE OF status, paid_at ON public.service_deposit_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.affiliate_handle_service_deposit_paid();

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
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN public.affiliate_insert_commission_events_for_deposit(
    p_deposit_request_id,
    p_force_referrer_user_id,
    p_force_payer_user_id,
    p_force_partner_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.affiliate_admin_resolve_deposit_attribution(
  p_deposit_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN public.affiliate_resolve_deposit_context(p_deposit_request_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.affiliate_admin_list_unattributed_deposits_v1(
  p_limit integer DEFAULT 200
)
RETURNS TABLE(
  id uuid,
  status text,
  amount numeric,
  currency text,
  resource_type text,
  booking_id uuid,
  fulfillment_id uuid,
  partner_id uuid,
  customer_email text,
  customer_name text,
  paid_at timestamptz,
  created_at timestamptz,
  suggested_referrer_user_id uuid,
  suggested_referrer_label text,
  suggested_partner_id uuid,
  suggested_partner_name text,
  suggested_payer_user_id uuid,
  suggested_payer_label text,
  attribution_source text,
  attribution_reason text,
  can_auto_apply boolean,
  referral_code text,
  referral_source text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  dep RECORD;
  ctx jsonb;
  v_limit integer := greatest(1, least(COALESCE(p_limit, 200), 500));
  v_referrer_id uuid;
  v_partner_id uuid;
  v_payer_id uuid;
  v_referrer_label text;
  v_partner_name text;
  v_payer_label text;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  FOR dep IN
    SELECT d.*
    FROM public.service_deposit_requests d
    WHERE d.status = 'paid'
      AND NOT EXISTS (
        SELECT 1
        FROM public.affiliate_commission_events e
        WHERE e.deposit_request_id = d.id
      )
    ORDER BY COALESCE(d.paid_at, d.created_at) DESC
    LIMIT v_limit
  LOOP
    ctx := public.affiliate_resolve_deposit_context(dep.id);

    v_referrer_id := NULLIF(ctx->>'referrer_user_id', '')::uuid;
    v_partner_id := NULLIF(ctx->>'partner_id', '')::uuid;
    v_payer_id := NULLIF(ctx->>'payer_user_id', '')::uuid;

    SELECT COALESCE(p.username, p.email, p.name, left(p.id::text, 8))
    INTO v_referrer_label
    FROM public.profiles p
    WHERE p.id = v_referrer_id;

    SELECT COALESCE(p.name, p.slug, left(p.id::text, 8))
    INTO v_partner_name
    FROM public.partners p
    WHERE p.id = v_partner_id;

    SELECT COALESCE(p.username, p.email, p.name, left(p.id::text, 8))
    INTO v_payer_label
    FROM public.profiles p
    WHERE p.id = v_payer_id;

    id := dep.id;
    status := dep.status;
    amount := dep.amount;
    currency := dep.currency;
    resource_type := dep.resource_type;
    booking_id := dep.booking_id;
    fulfillment_id := dep.fulfillment_id;
    partner_id := dep.partner_id;
    customer_email := dep.customer_email;
    customer_name := dep.customer_name;
    paid_at := dep.paid_at;
    created_at := dep.created_at;
    suggested_referrer_user_id := v_referrer_id;
    suggested_referrer_label := v_referrer_label;
    suggested_partner_id := v_partner_id;
    suggested_partner_name := v_partner_name;
    suggested_payer_user_id := v_payer_id;
    suggested_payer_label := v_payer_label;
    attribution_source := COALESCE(ctx->>'source', 'none');
    attribution_reason := COALESCE(ctx->>'reason', CASE WHEN COALESCE((ctx->>'ok')::boolean, false) THEN 'ready' ELSE 'unknown' END);
    can_auto_apply := COALESCE((ctx->>'ok')::boolean, false);
    referral_code := ctx->>'referral_code';
    referral_source := ctx->>'referral_source';

    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.affiliate_get_partner_owner_user_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_admin_recompute_commissions_for_deposit(uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_admin_resolve_deposit_attribution(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_admin_list_unattributed_deposits_v1(integer) TO authenticated;

REVOKE ALL ON FUNCTION public.affiliate_get_booking_referral_for_deposit(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.affiliate_resolve_deposit_context(uuid, uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.affiliate_insert_commission_events_for_deposit(uuid, uuid, uuid, uuid) FROM PUBLIC;
