-- =====================================================
-- Affiliate adjustments integration (balances/payouts/overview)
-- =====================================================

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
    COALESCE((SELECT sum(e.commission_amount) FROM public.affiliate_commission_events e WHERE e.partner_id = p_partner_id AND e.payout_id IS NULL), 0)
      + COALESCE((SELECT sum(a.amount) FROM public.affiliate_adjustments a WHERE a.partner_id = p_partner_id AND a.payout_id IS NULL), 0)
      AS unpaid_total,
    COALESCE((SELECT sum(e.commission_amount) FROM public.affiliate_commission_events e WHERE e.partner_id = p_partner_id AND e.payout_id IS NOT NULL), 0)
      + COALESCE((SELECT sum(a.amount) FROM public.affiliate_adjustments a WHERE a.partner_id = p_partner_id AND a.payout_id IS NOT NULL), 0)
      AS paid_total,
    COALESCE(settings.payout_threshold, 70) AS payout_threshold,
    COALESCE(settings.currency, 'EUR') AS currency;
END;
$$;

GRANT EXECUTE ON FUNCTION public.affiliate_get_partner_balance(uuid) TO authenticated;

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
    COALESCE((SELECT sum(e.commission_amount) FROM public.affiliate_commission_events e WHERE e.partner_id = p_partner_id AND e.payout_id IS NULL), 0)
      + COALESCE((SELECT sum(a.amount) FROM public.affiliate_adjustments a WHERE a.partner_id = p_partner_id AND a.payout_id IS NULL), 0)
      AS unpaid_total,
    COALESCE((
      SELECT sum(e.commission_amount)
      FROM public.affiliate_commission_events e
      JOIN public.affiliate_payouts ap ON ap.id = e.payout_id
      WHERE e.partner_id = p_partner_id
        AND ap.status = 'pending'
    ), 0)
      + COALESCE((
        SELECT sum(a.amount)
        FROM public.affiliate_adjustments a
        JOIN public.affiliate_payouts ap ON ap.id = a.payout_id
        WHERE a.partner_id = p_partner_id
          AND ap.status = 'pending'
      ), 0)
      AS pending_total,
    COALESCE((
      SELECT sum(e.commission_amount)
      FROM public.affiliate_commission_events e
      JOIN public.affiliate_payouts ap ON ap.id = e.payout_id
      WHERE e.partner_id = p_partner_id
        AND ap.status = 'paid'
    ), 0)
      + COALESCE((
        SELECT sum(a.amount)
        FROM public.affiliate_adjustments a
        JOIN public.affiliate_payouts ap ON ap.id = a.payout_id
        WHERE a.partner_id = p_partner_id
          AND ap.status = 'paid'
      ), 0)
      AS paid_total,
    COALESCE(settings.payout_threshold, 70) AS payout_threshold,
    COALESCE(settings.currency, 'EUR') AS currency;
END;
$$;

GRANT EXECUTE ON FUNCTION public.affiliate_get_partner_balance_v2(uuid) TO authenticated;

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
    ), 0)
      + COALESCE((
        SELECT sum(a.amount)
        FROM public.affiliate_adjustments a
        WHERE a.partner_id = p_partner_id
          AND a.payout_id IS NULL
      ), 0)
      AS unpaid_total,
    COALESCE((
      SELECT sum(e.commission_amount)
      FROM public.affiliate_commission_events e
      JOIN public.affiliate_payouts ap ON ap.id = e.payout_id
      WHERE e.partner_id = p_partner_id
        AND e.referrer_user_id = uid
        AND ap.status = 'pending'
    ), 0)
      + COALESCE((
        SELECT sum(a.amount)
        FROM public.affiliate_adjustments a
        JOIN public.affiliate_payouts ap ON ap.id = a.payout_id
        WHERE a.partner_id = p_partner_id
          AND ap.status = 'pending'
      ), 0)
      AS pending_total,
    COALESCE((
      SELECT sum(e.commission_amount)
      FROM public.affiliate_commission_events e
      JOIN public.affiliate_payouts ap ON ap.id = e.payout_id
      WHERE e.partner_id = p_partner_id
        AND e.referrer_user_id = uid
        AND ap.status = 'paid'
    ), 0)
      + COALESCE((
        SELECT sum(a.amount)
        FROM public.affiliate_adjustments a
        JOIN public.affiliate_payouts ap ON ap.id = a.payout_id
        WHERE a.partner_id = p_partner_id
          AND ap.status = 'paid'
      ), 0)
      AS paid_total,
    COALESCE(settings.payout_threshold, 70) AS payout_threshold,
    COALESCE(settings.currency, 'EUR') AS currency;
END;
$$;

GRANT EXECUTE ON FUNCTION public.affiliate_get_referrer_balance_v1(uuid) TO authenticated;

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

  SELECT
    COALESCE((SELECT sum(e.commission_amount) FROM public.affiliate_commission_events e WHERE e.partner_id = p_partner_id AND e.payout_id IS NULL), 0)
      + COALESCE((SELECT sum(a.amount) FROM public.affiliate_adjustments a WHERE a.partner_id = p_partner_id AND a.payout_id IS NULL), 0)
  INTO unpaid_total;

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

  UPDATE public.affiliate_adjustments
  SET payout_id = v_payout_id
  WHERE partner_id = p_partner_id
    AND payout_id IS NULL;

  RETURN v_payout_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.affiliate_admin_create_payout(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.affiliate_admin_get_partner_balances_v1()
RETURNS TABLE(
  partner_id uuid,
  partner_name text,
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
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO settings
  FROM public.affiliate_program_settings
  WHERE id = 1;

  RETURN QUERY
  WITH affiliate_partners AS (
    SELECT p.id AS partner_id, p.name AS partner_name
    FROM public.partners p
    WHERE COALESCE(p.affiliate_enabled, false) = true
  ),
  e_unpaid AS (
    SELECT e.partner_id, sum(e.commission_amount) AS total
    FROM public.affiliate_commission_events e
    WHERE e.payout_id IS NULL
    GROUP BY e.partner_id
  ),
  e_pending AS (
    SELECT e.partner_id, sum(e.commission_amount) AS total
    FROM public.affiliate_commission_events e
    JOIN public.affiliate_payouts ap ON ap.id = e.payout_id
    WHERE ap.status = 'pending'
    GROUP BY e.partner_id
  ),
  e_paid AS (
    SELECT e.partner_id, sum(e.commission_amount) AS total
    FROM public.affiliate_commission_events e
    JOIN public.affiliate_payouts ap ON ap.id = e.payout_id
    WHERE ap.status = 'paid'
    GROUP BY e.partner_id
  ),
  a_unpaid AS (
    SELECT a.partner_id, sum(a.amount) AS total
    FROM public.affiliate_adjustments a
    WHERE a.payout_id IS NULL
    GROUP BY a.partner_id
  ),
  a_pending AS (
    SELECT a.partner_id, sum(a.amount) AS total
    FROM public.affiliate_adjustments a
    JOIN public.affiliate_payouts ap ON ap.id = a.payout_id
    WHERE ap.status = 'pending'
    GROUP BY a.partner_id
  ),
  a_paid AS (
    SELECT a.partner_id, sum(a.amount) AS total
    FROM public.affiliate_adjustments a
    JOIN public.affiliate_payouts ap ON ap.id = a.payout_id
    WHERE ap.status = 'paid'
    GROUP BY a.partner_id
  )
  SELECT
    ap.partner_id,
    ap.partner_name,
    COALESCE(eu.total, 0) + COALESCE(au.total, 0) AS unpaid_total,
    COALESCE(ep.total, 0) + COALESCE(apn.total, 0) AS pending_total,
    COALESCE(epd.total, 0) + COALESCE(apd.total, 0) AS paid_total,
    COALESCE(settings.payout_threshold, 70) AS payout_threshold,
    COALESCE(settings.currency, 'EUR') AS currency
  FROM affiliate_partners ap
  LEFT JOIN e_unpaid eu ON eu.partner_id = ap.partner_id
  LEFT JOIN e_pending ep ON ep.partner_id = ap.partner_id
  LEFT JOIN e_paid epd ON epd.partner_id = ap.partner_id
  LEFT JOIN a_unpaid au ON au.partner_id = ap.partner_id
  LEFT JOIN a_pending apn ON apn.partner_id = ap.partner_id
  LEFT JOIN a_paid apd ON apd.partner_id = ap.partner_id
  ORDER BY (COALESCE(eu.total, 0) + COALESCE(au.total, 0)) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.affiliate_admin_get_partner_balances_v1() TO authenticated;
