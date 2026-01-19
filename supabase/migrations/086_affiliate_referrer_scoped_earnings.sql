CREATE INDEX IF NOT EXISTS affiliate_commission_events_referrer_idx
  ON public.affiliate_commission_events (referrer_user_id, partner_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.affiliate_get_referrer_balance_v1(p_partner_id uuid)
RETURNS TABLE(
  partner_id uuid,
  referrer_user_id uuid,
  unpaid_total numeric,
  pending_total numeric,
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
  uid uuid;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT (public.is_current_user_admin() OR public.is_partner_user(p_partner_id)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO settings
  FROM public.affiliate_program_settings
  WHERE id = 1;

  RETURN QUERY
  SELECT
    p_partner_id AS partner_id,
    uid AS referrer_user_id,
    COALESCE((
      SELECT sum(e.commission_amount)
      FROM public.affiliate_commission_events e
      WHERE e.partner_id = p_partner_id
        AND e.referrer_user_id = uid
        AND e.payout_id IS NULL
    ), 0) AS unpaid_total,
    COALESCE((
      SELECT sum(e.commission_amount)
      FROM public.affiliate_commission_events e
      JOIN public.affiliate_payouts ap ON ap.id = e.payout_id
      WHERE e.partner_id = p_partner_id
        AND e.referrer_user_id = uid
        AND ap.status = 'pending'
    ), 0) AS pending_total,
    COALESCE((
      SELECT sum(e.commission_amount)
      FROM public.affiliate_commission_events e
      JOIN public.affiliate_payouts ap ON ap.id = e.payout_id
      WHERE e.partner_id = p_partner_id
        AND e.referrer_user_id = uid
        AND ap.status = 'paid'
    ), 0) AS paid_total,
    COALESCE(settings.payout_threshold, 70) AS payout_threshold,
    COALESCE(settings.currency, 'EUR') AS currency;
END;
$$;

GRANT EXECUTE ON FUNCTION public.affiliate_get_referrer_balance_v1(uuid) TO authenticated;

DROP POLICY IF EXISTS affiliate_commission_events_partner_read ON public.affiliate_commission_events;
CREATE POLICY affiliate_commission_events_partner_read
ON public.affiliate_commission_events
FOR SELECT
TO authenticated
USING (
  public.is_partner_user(partner_id)
  AND referrer_user_id = auth.uid()
);

DROP POLICY IF EXISTS affiliate_cashout_requests_partner_read ON public.affiliate_cashout_requests;
CREATE POLICY affiliate_cashout_requests_partner_read
ON public.affiliate_cashout_requests
FOR SELECT
TO authenticated
USING (
  public.is_current_user_admin()
  OR (public.is_partner_user(partner_id) AND requested_by = auth.uid())
);

CREATE OR REPLACE FUNCTION public.affiliate_request_cashout(p_partner_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bal RECORD;
  unpaid numeric(12,2);
  pending_payouts int;
  existing_req uuid;
  settings RECORD;
  v_req_id uuid;
  v_partner_name text;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT (public.is_current_user_admin() OR public.is_partner_user(p_partner_id)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO settings
  FROM public.affiliate_program_settings
  WHERE id = 1;

  BEGIN
    SELECT * INTO bal
    FROM public.affiliate_get_referrer_balance_v1(p_partner_id);
  EXCEPTION WHEN undefined_function THEN
    SELECT * INTO bal
    FROM public.affiliate_get_partner_balance_v2(p_partner_id);
  END;

  unpaid := COALESCE(bal.unpaid_total, 0);

  SELECT count(*)::int INTO pending_payouts
  FROM public.affiliate_payouts ap
  WHERE ap.partner_id = p_partner_id
    AND ap.status = 'pending';

  IF pending_payouts > 0 THEN
    RAISE EXCEPTION 'payout_already_pending';
  END IF;

  SELECT id INTO existing_req
  FROM public.affiliate_cashout_requests r
  WHERE r.partner_id = p_partner_id
    AND r.status = 'pending'
    AND r.requested_by = v_user_id
  ORDER BY r.created_at DESC
  LIMIT 1;

  IF existing_req IS NOT NULL THEN
    RETURN existing_req;
  END IF;

  IF unpaid < COALESCE(bal.payout_threshold, COALESCE(settings.payout_threshold, 70)) THEN
    RAISE EXCEPTION 'threshold_not_met';
  END IF;

  SELECT p.name INTO v_partner_name
  FROM public.partners p
  WHERE p.id = p_partner_id;

  INSERT INTO public.affiliate_cashout_requests (
    partner_id,
    requested_by,
    requested_amount,
    currency,
    balance_at_request,
    threshold_at_request,
    status
  ) VALUES (
    p_partner_id,
    v_user_id,
    unpaid,
    COALESCE(bal.currency, COALESCE(settings.currency, 'EUR')),
    unpaid,
    COALESCE(bal.payout_threshold, COALESCE(settings.payout_threshold, 70)),
    'pending'
  ) RETURNING id INTO v_req_id;

  PERFORM public.enqueue_admin_notification(
    'partners',
    'affiliate_cashout_requested',
    v_req_id::text,
    'affiliate_cashout_requests',
    jsonb_build_object(
      'category', 'partners',
      'event', 'affiliate_cashout_requested',
      'record_id', v_req_id::text,
      'table', 'affiliate_cashout_requests',
      'record', jsonb_build_object(
        'id', v_req_id::text,
        'partner_id', p_partner_id::text,
        'partner_name', COALESCE(v_partner_name, ''),
        'requested_amount', unpaid,
        'currency', COALESCE(bal.currency, COALESCE(settings.currency, 'EUR')),
        'threshold', COALESCE(bal.payout_threshold, COALESCE(settings.payout_threshold, 70)),
        'requested_by', COALESCE(v_user_id::text, ''),
        'created_at', now()::text
      )
    ),
    'partners_affiliate_cashout_requested:' || p_partner_id::text || ':' || v_user_id::text || ':' || v_req_id::text
  );

  RETURN v_req_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.affiliate_request_cashout(uuid) TO authenticated;
