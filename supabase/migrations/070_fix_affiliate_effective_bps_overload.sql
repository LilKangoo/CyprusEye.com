CREATE OR REPLACE FUNCTION public.affiliate_effective_bps(
  p_partner_id uuid,
  p_referrer_user_id uuid,
  p_level integer
)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.affiliate_effective_bps(p_partner_id, p_referrer_user_id, p_level::smallint);
$$;

GRANT EXECUTE ON FUNCTION public.affiliate_effective_bps(uuid, uuid, integer) TO authenticated;
