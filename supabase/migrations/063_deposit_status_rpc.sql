CREATE OR REPLACE FUNCTION public.get_service_deposit_status(p_id uuid)
RETURNS TABLE(
  id uuid,
  status text,
  paid_at timestamptz,
  amount numeric,
  currency text,
  fulfillment_reference text,
  fulfillment_summary text,
  resource_type text,
  booking_id uuid,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.status,
    r.paid_at,
    r.amount,
    r.currency,
    r.fulfillment_reference,
    r.fulfillment_summary,
    r.resource_type,
    r.booking_id,
    r.stripe_checkout_session_id,
    r.stripe_payment_intent_id
  FROM public.service_deposit_requests r
  WHERE r.id = p_id;
$$;

REVOKE ALL ON FUNCTION public.get_service_deposit_status(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_service_deposit_status(uuid) TO anon, authenticated;
