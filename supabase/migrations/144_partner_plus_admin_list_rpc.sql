CREATE OR REPLACE FUNCTION public.admin_list_partner_plus_applications(p_limit integer DEFAULT 500)
RETURNS SETOF public.partner_plus_applications
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_limit integer := greatest(1, least(coalesce(p_limit, 500), 1000));
BEGIN
  IF NOT coalesce(public.is_admin(), false) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.partner_plus_applications
  ORDER BY created_at DESC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_partner_plus_applications(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_list_partner_plus_applications(integer) TO authenticated;
