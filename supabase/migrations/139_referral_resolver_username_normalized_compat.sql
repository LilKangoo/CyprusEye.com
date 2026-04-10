CREATE OR REPLACE FUNCTION public.resolve_referral_code(p_code text)
RETURNS TABLE(
  referrer_user_id uuid,
  partner_id uuid,
  referral_code text,
  matched_by text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := NULLIF(trim(COALESCE(p_code, '')), '');
BEGIN
  IF v_code IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH matches AS (
    SELECT
      p.id AS referrer_user_id,
      public.affiliate_get_user_partner_id(p.id) AS partner_id,
      p.referral_code,
      'referral_code'::text AS matched_by,
      1 AS priority,
      p.created_at
    FROM public.profiles p
    WHERE p.referral_code_normalized = lower(v_code)

    UNION ALL

    SELECT
      p.id AS referrer_user_id,
      public.affiliate_get_user_partner_id(p.id) AS partner_id,
      p.referral_code,
      'username'::text AS matched_by,
      2 AS priority,
      p.created_at
    FROM public.profiles p
    WHERE lower(trim(COALESCE(p.username, ''))) = lower(v_code)

    UNION ALL

    SELECT
      p.id AS referrer_user_id,
      public.affiliate_get_user_partner_id(p.id) AS partner_id,
      p.referral_code,
      'username_normalized'::text AS matched_by,
      3 AS priority,
      p.created_at
    FROM public.profiles p
    WHERE COALESCE(to_jsonb(p)->>'username_normalized', '') = lower(v_code)
  )
  SELECT
    m.referrer_user_id,
    m.partner_id,
    COALESCE(m.referral_code, public.generate_profile_referral_code(m.referrer_user_id, NULL)) AS referral_code,
    m.matched_by
  FROM matches m
  ORDER BY m.priority ASC, m.created_at ASC NULLS LAST, m.referrer_user_id ASC
  LIMIT 1;
END;
$$;
