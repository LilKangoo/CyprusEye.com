ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS registration_completed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS registration_completed_at timestamptz;

UPDATE public.profiles
SET registration_completed = true
WHERE registration_completed IS DISTINCT FROM true;

UPDATE public.profiles
SET registration_completed_at = COALESCE(registration_completed_at, now())
WHERE registration_completed = true
  AND registration_completed_at IS NULL;

CREATE OR REPLACE FUNCTION public.profiles_set_registration_completed_default()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_provider text;
BEGIN
  IF NEW.id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT lower(trim(COALESCE(u.raw_app_meta_data->>'provider', '')))
  INTO v_provider
  FROM auth.users u
  WHERE u.id = NEW.id;

  IF NEW.registration_completed IS NULL THEN
    NEW.registration_completed := true;
  END IF;

  IF v_provider = 'google' THEN
    NEW.registration_completed := false;
    NEW.registration_completed_at := NULL;
  ELSIF NEW.registration_completed = true AND NEW.registration_completed_at IS NULL THEN
    NEW.registration_completed_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_set_registration_completed_default ON public.profiles;
CREATE TRIGGER trg_profiles_set_registration_completed_default
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_set_registration_completed_default();

CREATE OR REPLACE FUNCTION public.complete_oauth_registration(
  p_name text,
  p_username text,
  p_referral_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_name text;
  v_username text;
  v_ref_code text;
  v_referrer uuid;
  v_profile record;
  v_has_username_normalized boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_name := NULLIF(trim(COALESCE(p_name, '')), '');
  v_username := NULLIF(trim(COALESCE(p_username, '')), '');
  v_ref_code := NULLIF(trim(COALESCE(p_referral_code, '')), '');

  SELECT p.*
  INTO v_profile
  FROM public.profiles p
  WHERE p.id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  IF COALESCE(v_profile.registration_completed, false) = true THEN
    RETURN jsonb_build_object('ok', true, 'already_completed', true);
  END IF;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'missing_name';
  END IF;

  IF v_username IS NULL THEN
    RAISE EXCEPTION 'missing_username';
  END IF;

  IF length(v_username) < 3 OR length(v_username) > 15 THEN
    RAISE EXCEPTION 'invalid_username_length';
  END IF;

  IF v_username !~ '^[a-zA-Z0-9_]+$' THEN
    RAISE EXCEPTION 'invalid_username_format';
  END IF;

  IF v_ref_code IS NULL THEN
    RAISE EXCEPTION 'missing_referral_code';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'profiles'
      AND c.column_name = 'username_normalized'
  ) INTO v_has_username_normalized;

  IF v_has_username_normalized THEN
    IF EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id <> v_user_id
        AND (
          p.username_normalized = lower(v_username)
          OR lower(trim(COALESCE(p.username, ''))) = lower(v_username)
        )
    ) THEN
      RAISE EXCEPTION 'username_taken';
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id <> v_user_id
        AND lower(trim(COALESCE(p.username, ''))) = lower(v_username)
    ) THEN
      RAISE EXCEPTION 'username_taken';
    END IF;
  END IF;

  SELECT p.id INTO v_referrer
  FROM public.profiles p
  WHERE p.id <> v_user_id
    AND lower(trim(COALESCE(p.username, ''))) = lower(v_ref_code)
  ORDER BY p.created_at ASC
  LIMIT 1;

  IF v_referrer IS NULL THEN
    RAISE EXCEPTION 'invalid_referral_code';
  END IF;

  IF v_has_username_normalized THEN
    UPDATE public.profiles p
    SET
      name = v_name,
      username = v_username,
      username_normalized = lower(v_username),
      referred_by = COALESCE(p.referred_by, v_referrer),
      registration_completed = true,
      registration_completed_at = now()
    WHERE p.id = v_user_id;
  ELSE
    UPDATE public.profiles p
    SET
      name = v_name,
      username = v_username,
      referred_by = COALESCE(p.referred_by, v_referrer),
      registration_completed = true,
      registration_completed_at = now()
    WHERE p.id = v_user_id;
  END IF;

  IF to_regclass('public.referrals') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.referrals r
      WHERE r.referred_id = v_user_id
    ) THEN
      INSERT INTO public.referrals(referrer_id, referred_id, status)
      VALUES (COALESCE(v_profile.referred_by, v_referrer), v_user_id, 'pending');
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'completed', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_oauth_registration(text, text, text) TO authenticated;
