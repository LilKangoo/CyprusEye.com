CREATE TABLE IF NOT EXISTS public.partner_payout_details (
  partner_id uuid PRIMARY KEY REFERENCES public.partners(id) ON DELETE CASCADE,
  account_holder_name text,
  bank_name text,
  iban text,
  bic text,
  notes text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_payout_details_updated_at_idx
  ON public.partner_payout_details (updated_at DESC);

CREATE OR REPLACE FUNCTION public.is_partner_owner(p_partner_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.partner_users pu
    WHERE pu.partner_id = p_partner_id
      AND pu.user_id = auth.uid()
      AND pu.role = 'owner'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.partner_payout_details_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partner_payout_details_set_updated_at ON public.partner_payout_details;
CREATE TRIGGER trg_partner_payout_details_set_updated_at
  BEFORE INSERT OR UPDATE ON public.partner_payout_details
  FOR EACH ROW
  EXECUTE FUNCTION public.partner_payout_details_set_updated_at();

ALTER TABLE public.partner_payout_details ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.partner_payout_details FROM anon, authenticated;
REVOKE ALL ON TABLE public.partner_payout_details FROM public;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.partner_payout_details TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.partner_payout_details TO authenticated;

DROP POLICY IF EXISTS partner_payout_details_admin_all ON public.partner_payout_details;
CREATE POLICY partner_payout_details_admin_all
ON public.partner_payout_details
FOR ALL
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS partner_payout_details_partner_read ON public.partner_payout_details;
CREATE POLICY partner_payout_details_partner_read
ON public.partner_payout_details
FOR SELECT
TO authenticated
USING (public.is_partner_owner(partner_id));

DROP POLICY IF EXISTS partner_payout_details_partner_insert ON public.partner_payout_details;
CREATE POLICY partner_payout_details_partner_insert
ON public.partner_payout_details
FOR INSERT
TO authenticated
WITH CHECK (public.is_partner_owner(partner_id));

DROP POLICY IF EXISTS partner_payout_details_partner_update ON public.partner_payout_details;
CREATE POLICY partner_payout_details_partner_update
ON public.partner_payout_details
FOR UPDATE
TO authenticated
USING (public.is_partner_owner(partner_id))
WITH CHECK (public.is_partner_owner(partner_id));
