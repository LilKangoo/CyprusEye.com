CREATE OR REPLACE FUNCTION public.affiliate_get_partner_balance_v2(p_partner_id uuid)
RETURNS TABLE(
  partner_id uuid,
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
    COALESCE((
      SELECT sum(e.commission_amount)
      FROM public.affiliate_commission_events e
      JOIN public.affiliate_payouts ap ON ap.id = e.payout_id
      WHERE e.partner_id = p_partner_id
        AND ap.status = 'pending'
    ), 0) AS pending_total,
    COALESCE((
      SELECT sum(e.commission_amount)
      FROM public.affiliate_commission_events e
      JOIN public.affiliate_payouts ap ON ap.id = e.payout_id
      WHERE e.partner_id = p_partner_id
        AND ap.status = 'paid'
    ), 0) AS paid_total,
    COALESCE(settings.payout_threshold, 70) AS payout_threshold,
    COALESCE(settings.currency, 'EUR') AS currency;
END;
$$;

GRANT EXECUTE ON FUNCTION public.affiliate_get_partner_balance_v2(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.affiliate_admin_unmark_payout_paid(
  p_payout_id uuid
)
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
  SET status = 'pending',
      paid_by = NULL,
      paid_at = NULL
  WHERE id = p_payout_id;

  IF to_regclass('public.admin_activity_log') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'admin_activity_log'
        AND column_name = 'target_user_id'
    ) THEN
      INSERT INTO public.admin_activity_log(actor_id, target_user_id, action, details)
      VALUES (
        auth.uid(),
        auth.uid(),
        'affiliate_unmark_payout_paid',
        jsonb_build_object('payout_id', p_payout_id)
      );
    ELSE
      INSERT INTO public.admin_activity_log(actor_id, action, details)
      VALUES (
        auth.uid(),
        'affiliate_unmark_payout_paid',
        jsonb_build_object('payout_id', p_payout_id)
      );
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.affiliate_admin_unmark_payout_paid(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.affiliate_admin_reset_commissions_for_deposit(
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
  has_paid_events boolean;
  res jsonb;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT EXISTS(
    SELECT 1
    FROM public.affiliate_commission_events e
    WHERE e.deposit_request_id = p_deposit_request_id
      AND e.payout_id IS NOT NULL
  ) INTO has_paid_events;

  IF COALESCE(has_paid_events, false) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_paid');
  END IF;

  DELETE FROM public.affiliate_commission_events
  WHERE deposit_request_id = p_deposit_request_id;

  res := public.affiliate_admin_recompute_commissions_for_deposit(
    p_deposit_request_id := p_deposit_request_id,
    p_force_referrer_user_id := p_force_referrer_user_id,
    p_force_payer_user_id := p_force_payer_user_id,
    p_force_partner_id := p_force_partner_id
  );

  IF to_regclass('public.admin_activity_log') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'admin_activity_log'
        AND column_name = 'target_user_id'
    ) THEN
      INSERT INTO public.admin_activity_log(actor_id, target_user_id, action, details)
      VALUES (
        auth.uid(),
        COALESCE(p_force_payer_user_id, p_force_referrer_user_id, auth.uid()),
        'affiliate_reset_commissions_for_deposit',
        jsonb_build_object(
          'deposit_request_id', p_deposit_request_id,
          'force_referrer_user_id', p_force_referrer_user_id,
          'force_payer_user_id', p_force_payer_user_id,
          'force_partner_id', p_force_partner_id,
          'result', res
        )
      );
    ELSE
      INSERT INTO public.admin_activity_log(actor_id, action, details)
      VALUES (
        auth.uid(),
        'affiliate_reset_commissions_for_deposit',
        jsonb_build_object(
          'deposit_request_id', p_deposit_request_id,
          'force_referrer_user_id', p_force_referrer_user_id,
          'force_payer_user_id', p_force_payer_user_id,
          'force_partner_id', p_force_partner_id,
          'result', res
        )
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'reset', true, 'result', res);
END;
$$;

GRANT EXECUTE ON FUNCTION public.affiliate_admin_reset_commissions_for_deposit(uuid, uuid, uuid, uuid) TO authenticated;
