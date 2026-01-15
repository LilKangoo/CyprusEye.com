CREATE OR REPLACE FUNCTION public.partner_get_service_deposit_amounts(p_partner_id uuid)
RETURNS TABLE(
  fulfillment_id uuid,
  status text,
  paid_at timestamptz,
  amount numeric,
  currency text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.fulfillment_id,
    r.status,
    r.paid_at,
    r.amount,
    r.currency
  FROM public.service_deposit_requests r
  JOIN public.partner_service_fulfillments f
    ON f.id = r.fulfillment_id
  WHERE f.partner_id = p_partner_id
    AND public.is_partner_user(p_partner_id)
    AND f.status = 'accepted';
$$;

REVOKE ALL ON FUNCTION public.partner_get_service_deposit_amounts(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.partner_get_service_deposit_amounts(uuid) TO authenticated;
