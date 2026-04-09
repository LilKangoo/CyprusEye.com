CREATE OR REPLACE FUNCTION public.sync_referrals_from_profiles_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS NULL OR NEW.referred_by IS NULL OR NEW.referred_by = NEW.id THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.referred_by IS NOT DISTINCT FROM OLD.referred_by THEN
    RETURN NEW;
  END IF;

  IF to_regclass('public.referrals') IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.referrals r
    WHERE r.referred_id = NEW.id
  ) THEN
    INSERT INTO public.referrals(referrer_id, referred_id, status)
    VALUES (NEW.referred_by, NEW.id, 'pending');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_sync_referrals_insert ON public.profiles;
DROP TRIGGER IF EXISTS trg_profiles_sync_referrals_assignment ON public.profiles;
CREATE TRIGGER trg_profiles_sync_referrals_assignment
AFTER INSERT OR UPDATE OF referred_by
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_referrals_from_profiles_assignment();

CREATE OR REPLACE FUNCTION public.apply_referral_code_to_profile_if_missing(
  p_user_id uuid,
  p_referral_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile record;
  v_match record;
  v_assigned uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_user_id');
  END IF;

  SELECT p.id, p.referred_by
  INTO v_profile
  FROM public.profiles p
  WHERE p.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'profile_not_found');
  END IF;

  IF v_profile.referred_by IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'applied', false,
      'reason', 'already_assigned',
      'referred_by', v_profile.referred_by
    );
  END IF;

  SELECT *
  INTO v_match
  FROM public.resolve_referral_code(p_referral_code)
  LIMIT 1;

  IF v_match.referrer_user_id IS NULL OR v_match.referrer_user_id = p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_referral_code');
  END IF;

  UPDATE public.profiles p
  SET referred_by = v_match.referrer_user_id
  WHERE p.id = p_user_id
    AND p.referred_by IS NULL
  RETURNING p.referred_by INTO v_assigned;

  IF v_assigned IS NULL THEN
    SELECT p.referred_by
    INTO v_assigned
    FROM public.profiles p
    WHERE p.id = p_user_id;

    RETURN jsonb_build_object(
      'ok', true,
      'applied', false,
      'reason', 'already_assigned',
      'referred_by', v_assigned
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'applied', true,
    'referred_by', v_assigned,
    'partner_id', v_match.partner_id,
    'referral_code', v_match.referral_code,
    'matched_by', v_match.matched_by
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_referral_code_to_profile_if_missing(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_referral_code_from_auth_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_code text;
  v_match record;
BEGIN
  IF NEW.id IS NULL OR NEW.referred_by IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT NULLIF(trim(COALESCE(u.raw_user_meta_data->>'referral_code', '')), '')
  INTO v_code
  FROM auth.users u
  WHERE u.id = NEW.id;

  IF v_code IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO v_match
  FROM public.resolve_referral_code(v_code)
  LIMIT 1;

  IF v_match.referrer_user_id IS NULL OR v_match.referrer_user_id = NEW.id THEN
    RETURN NEW;
  END IF;

  NEW.referred_by := COALESCE(NEW.referred_by, v_match.referrer_user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_apply_referral_code ON public.profiles;
CREATE TRIGGER trg_profiles_apply_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_referral_code_from_auth_metadata();

CREATE OR REPLACE FUNCTION public.complete_oauth_registration(
  p_name text,
  p_username text,
  p_referral_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_name text;
  v_username text;
  v_ref_code text;
  v_profile record;
  v_has_username_normalized boolean := false;
  v_apply_result jsonb := NULL;
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
    INSERT INTO public.profiles (id, email, name, registration_completed, registration_completed_at)
    SELECT
      u.id,
      NULLIF(trim(COALESCE(u.email, '')), ''),
      NULLIF(trim(COALESCE(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name', '')), ''),
      false,
      NULL
    FROM auth.users u
    WHERE u.id = v_user_id
    ON CONFLICT (id) DO NOTHING;

    SELECT p.*
    INTO v_profile
    FROM public.profiles p
    WHERE p.id = v_user_id
    FOR UPDATE;
  END IF;

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

  IF v_has_username_normalized THEN
    UPDATE public.profiles p
    SET
      name = v_name,
      username = v_username,
      username_normalized = lower(v_username),
      registration_completed = true,
      registration_completed_at = now()
    WHERE p.id = v_user_id;
  ELSE
    UPDATE public.profiles p
    SET
      name = v_name,
      username = v_username,
      registration_completed = true,
      registration_completed_at = now()
    WHERE p.id = v_user_id;
  END IF;

  IF v_ref_code IS NOT NULL AND v_profile.referred_by IS NULL THEN
    v_apply_result := public.apply_referral_code_to_profile_if_missing(v_user_id, v_ref_code);
    IF COALESCE((v_apply_result->>'ok')::boolean, false) = false THEN
      IF COALESCE(v_apply_result->>'reason', '') = 'invalid_referral_code' THEN
        RAISE EXCEPTION 'invalid_referral_code';
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'completed', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_oauth_registration(text, text, text) TO authenticated;
