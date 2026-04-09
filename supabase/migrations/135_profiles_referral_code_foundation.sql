ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referral_code_normalized text;

COMMENT ON COLUMN public.profiles.referral_code IS 'Immutable public referral code used in referral links and manual referral entry.';
COMMENT ON COLUMN public.profiles.referral_code_normalized IS 'Lower-cased referral code for case-insensitive lookup.';

CREATE OR REPLACE FUNCTION public.normalize_referral_code(p_code text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_code text := NULLIF(trim(COALESCE(p_code, '')), '');
BEGIN
  IF v_code IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_code !~ '^[A-Za-z0-9_]+$' THEN
    RETURN NULL;
  END IF;

  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_profile_referral_code(
  p_profile_id uuid,
  p_preferred text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_candidate text;
  v_exists boolean;
BEGIN
  IF p_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_candidate := public.normalize_referral_code(p_preferred);
  IF v_candidate IS NOT NULL AND length(v_candidate) >= 3 AND length(v_candidate) <= 64 THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id <> p_profile_id
        AND lower(trim(COALESCE(p.referral_code_normalized, p.referral_code, ''))) = lower(v_candidate)
    ) INTO v_exists;

    IF NOT v_exists THEN
      RETURN v_candidate;
    END IF;
  END IF;

  v_candidate := 'CE_' || upper(substr(replace(p_profile_id::text, '-', ''), 1, 10));
  RETURN v_candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_profiles_referral_code_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_code text;
  v_old_code text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_old_code := NULLIF(trim(COALESCE(OLD.referral_code, '')), '');
    v_new_code := NULLIF(trim(COALESCE(NEW.referral_code, '')), '');

    IF v_old_code IS NOT NULL AND lower(v_old_code) IS DISTINCT FROM lower(COALESCE(v_new_code, '')) THEN
      RAISE EXCEPTION 'referral_code_immutable';
    END IF;
  END IF;

  IF NULLIF(trim(COALESCE(NEW.referral_code, '')), '') IS NULL THEN
    NEW.referral_code := public.generate_profile_referral_code(NEW.id, NEW.username);
  ELSE
    NEW.referral_code := public.normalize_referral_code(NEW.referral_code);
    IF NEW.referral_code IS NULL THEN
      RAISE EXCEPTION 'invalid_referral_code_format';
    END IF;
  END IF;

  NEW.referral_code_normalized := lower(NEW.referral_code);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_referral_code_defaults ON public.profiles;
CREATE TRIGGER trg_profiles_referral_code_defaults
BEFORE INSERT OR UPDATE OF referral_code, username
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trg_profiles_referral_code_defaults();

DO $$
DECLARE
  rec record;
  v_code text;
BEGIN
  FOR rec IN
    SELECT p.id, p.username
    FROM public.profiles p
    WHERE NULLIF(trim(COALESCE(p.referral_code, '')), '') IS NULL
    ORDER BY p.created_at ASC NULLS FIRST, p.id ASC
  LOOP
    v_code := public.generate_profile_referral_code(rec.id, rec.username);

    UPDATE public.profiles p
    SET
      referral_code = v_code,
      referral_code_normalized = lower(v_code)
    WHERE p.id = rec.id;
  END LOOP;

  UPDATE public.profiles p
  SET referral_code_normalized = lower(trim(p.referral_code))
  WHERE NULLIF(trim(COALESCE(p.referral_code, '')), '') IS NOT NULL
    AND (
      p.referral_code_normalized IS NULL
      OR p.referral_code_normalized <> lower(trim(p.referral_code))
    );
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_normalized_uidx
  ON public.profiles (referral_code_normalized)
  WHERE referral_code_normalized IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_referral_code_idx
  ON public.profiles (referral_code);

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
    WHERE COALESCE(p.username_normalized, '') = lower(v_code)
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

CREATE OR REPLACE FUNCTION public.validate_referral_code_public(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match record;
BEGIN
  SELECT *
  INTO v_match
  FROM public.resolve_referral_code(p_code)
  LIMIT 1;

  IF v_match.referrer_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'invalid_referral_code'
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'referral_code', v_match.referral_code,
    'matched_by', v_match.matched_by
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_referral_code_public(text) TO anon, authenticated;
