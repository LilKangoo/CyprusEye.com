CREATE TABLE IF NOT EXISTS public.affiliate_cashout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  balance_at_request numeric(12,2) NOT NULL DEFAULT 0,
  threshold_at_request numeric(12,2) NOT NULL DEFAULT 70,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','paid','cancelled')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS affiliate_cashout_requests_partner_idx
  ON public.affiliate_cashout_requests (partner_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.affiliate_cashout_requests_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_affiliate_cashout_requests_set_updated_at ON public.affiliate_cashout_requests;
CREATE TRIGGER trg_affiliate_cashout_requests_set_updated_at
  BEFORE UPDATE ON public.affiliate_cashout_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.affiliate_cashout_requests_set_updated_at();

ALTER TABLE public.affiliate_cashout_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.affiliate_cashout_requests FROM anon, authenticated;
REVOKE ALL ON TABLE public.affiliate_cashout_requests FROM public;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.affiliate_cashout_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.affiliate_cashout_requests TO authenticated;

DROP POLICY IF EXISTS affiliate_cashout_requests_admin_all ON public.affiliate_cashout_requests;
CREATE POLICY affiliate_cashout_requests_admin_all
ON public.affiliate_cashout_requests
FOR ALL
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS affiliate_cashout_requests_partner_read ON public.affiliate_cashout_requests;
CREATE POLICY affiliate_cashout_requests_partner_read
ON public.affiliate_cashout_requests
FOR SELECT
TO authenticated
USING (public.is_partner_user(partner_id));

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
BEGIN
  IF NOT (public.is_current_user_admin() OR public.is_partner_user(p_partner_id)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO settings
  FROM public.affiliate_program_settings
  WHERE id = 1;

  BEGIN
    SELECT * INTO bal
    FROM public.affiliate_get_partner_balance_v2(p_partner_id);
  EXCEPTION WHEN undefined_function THEN
    SELECT * INTO bal
    FROM public.affiliate_get_partner_balance(p_partner_id);
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
    auth.uid(),
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
        'requested_by', COALESCE(auth.uid()::text, ''),
        'created_at', now()::text
      )
    ),
    'partners_affiliate_cashout_requested:' || p_partner_id::text || ':' || v_req_id::text
  );

  RETURN v_req_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.affiliate_request_cashout(uuid) TO authenticated;
