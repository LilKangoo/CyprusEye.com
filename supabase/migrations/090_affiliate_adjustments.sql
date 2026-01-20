-- =====================================================
-- Affiliate adjustments (admin bonus/deduction)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.affiliate_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  reason text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  payout_id uuid REFERENCES public.affiliate_payouts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS affiliate_adjustments_partner_idx
  ON public.affiliate_adjustments (partner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS affiliate_adjustments_payout_idx
  ON public.affiliate_adjustments (payout_id);

ALTER TABLE public.affiliate_adjustments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.affiliate_adjustments FROM anon, authenticated;
REVOKE ALL ON TABLE public.affiliate_adjustments FROM public;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.affiliate_adjustments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.affiliate_adjustments TO authenticated;

DROP POLICY IF EXISTS affiliate_adjustments_admin_all ON public.affiliate_adjustments;
CREATE POLICY affiliate_adjustments_admin_all
ON public.affiliate_adjustments
FOR ALL
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS affiliate_adjustments_partner_read ON public.affiliate_adjustments;
CREATE POLICY affiliate_adjustments_partner_read
ON public.affiliate_adjustments
FOR SELECT
TO authenticated
USING (public.is_partner_user(partner_id));

CREATE OR REPLACE FUNCTION public.affiliate_admin_create_adjustment(
  p_partner_id uuid,
  p_amount numeric,
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_amount numeric(12,2);
  v_reason text;
  settings RECORD;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_partner_id IS NULL THEN
    RAISE EXCEPTION 'partner_required';
  END IF;

  v_amount := round(COALESCE(p_amount, 0)::numeric, 2);
  IF v_amount = 0 THEN
    RAISE EXCEPTION 'amount_required';
  END IF;

  v_reason := NULLIF(trim(COALESCE(p_reason, '')), '');

  SELECT * INTO settings
  FROM public.affiliate_program_settings
  WHERE id = 1;

  INSERT INTO public.affiliate_adjustments (partner_id, amount, currency, reason, created_by)
  VALUES (p_partner_id, v_amount, COALESCE(settings.currency, 'EUR'), v_reason, auth.uid())
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.affiliate_admin_create_adjustment(uuid, numeric, text) TO authenticated;
