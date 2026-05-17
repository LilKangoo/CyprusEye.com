BEGIN;

-- Keep public.profiles.email aligned with the confirmed Supabase Auth email.
-- Pending email_change is intentionally ignored until Supabase confirms it and updates auth.users.email.
CREATE OR REPLACE FUNCTION public.sync_profile_email_from_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.id IS NULL OR NULLIF(trim(COALESCE(NEW.email, '')), '') IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.profiles p
  SET
    email = NEW.email,
    updated_at = now()
  WHERE p.id = NEW.id
    AND lower(COALESCE(p.email, '')) IS DISTINCT FROM lower(COALESCE(NEW.email, ''));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auth_users_sync_profile_email ON auth.users;
CREATE TRIGGER trg_auth_users_sync_profile_email
AFTER INSERT OR UPDATE OF email
ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_email_from_auth_user();

-- One-time safe backfill: use only the currently confirmed auth email, never pending email_change.
UPDATE public.profiles p
SET
  email = u.email,
  updated_at = now()
FROM auth.users u
WHERE u.id = p.id
  AND NULLIF(trim(COALESCE(u.email, '')), '') IS NOT NULL
  AND lower(COALESCE(p.email, '')) IS DISTINCT FROM lower(COALESCE(u.email, ''));

CREATE TABLE IF NOT EXISTS public.profile_referral_code_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referral_code text NOT NULL,
  referral_code_normalized text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text
);

ALTER TABLE public.profile_referral_code_aliases ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS profile_referral_code_aliases_active_uidx
  ON public.profile_referral_code_aliases (referral_code_normalized)
  WHERE retired_at IS NULL;

CREATE INDEX IF NOT EXISTS profile_referral_code_aliases_user_idx
  ON public.profile_referral_code_aliases (user_id);

REVOKE ALL ON TABLE public.profile_referral_code_aliases FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profile_referral_code_aliases TO service_role;

COMMENT ON TABLE public.profile_referral_code_aliases IS
  'Retired referral codes/usernames that should keep resolving after a profile username/referral code change.';

CREATE OR REPLACE FUNCTION public.trg_profiles_referral_code_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_code text;
  v_old_code text;
  v_allow_referral_update boolean := COALESCE(current_setting('app.allow_referral_code_update', true), '') = 'on';
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_old_code := NULLIF(trim(COALESCE(OLD.referral_code, '')), '');
    v_new_code := NULLIF(trim(COALESCE(NEW.referral_code, '')), '');

    IF v_old_code IS NOT NULL
      AND lower(v_old_code) IS DISTINCT FROM lower(COALESCE(v_new_code, ''))
      AND NOT v_allow_referral_update
    THEN
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

CREATE OR REPLACE FUNCTION public.update_my_username_and_referral_code(p_username text)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_username text := NULLIF(trim(COALESCE(p_username, '')), '');
  v_code text;
  v_profile public.profiles%ROWTYPE;
  v_old_code text;
  v_old_username text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF v_username IS NULL
    OR length(v_username) < 3
    OR length(v_username) > 30
    OR v_username !~ '^[A-Za-z0-9_]+$'
  THEN
    RAISE EXCEPTION 'invalid_username_format';
  END IF;

  v_code := public.normalize_referral_code(v_username);
  IF v_code IS NULL THEN
    RAISE EXCEPTION 'invalid_referral_code_format';
  END IF;

  SELECT *
  INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id <> v_user_id
      AND (
        lower(trim(COALESCE(p.referral_code, ''))) = lower(v_code)
        OR lower(trim(COALESCE(p.username, ''))) = lower(v_code)
      )
  ) OR EXISTS (
    SELECT 1
    FROM public.profile_referral_code_aliases a
    WHERE a.user_id <> v_user_id
      AND a.retired_at IS NULL
      AND a.referral_code_normalized = lower(v_code)
  ) THEN
    RAISE EXCEPTION 'username_or_referral_code_taken';
  END IF;

  v_old_code := NULLIF(trim(COALESCE(v_profile.referral_code, '')), '');
  v_old_username := NULLIF(trim(COALESCE(v_profile.username, '')), '');

  IF v_old_code IS NOT NULL AND lower(v_old_code) <> lower(v_code) THEN
    INSERT INTO public.profile_referral_code_aliases (
      user_id,
      referral_code,
      referral_code_normalized,
      created_by,
      reason
    )
    SELECT
      v_user_id,
      v_old_code,
      lower(v_old_code),
      v_user_id,
      'username_referral_code_change'
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.profile_referral_code_aliases a
      WHERE a.referral_code_normalized = lower(v_old_code)
        AND a.retired_at IS NULL
    );
  END IF;

  IF v_old_username IS NOT NULL
    AND lower(v_old_username) <> lower(v_code)
    AND (v_old_code IS NULL OR lower(v_old_username) <> lower(v_old_code))
    AND NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id <> v_user_id
        AND (
          lower(trim(COALESCE(p.referral_code, ''))) = lower(v_old_username)
          OR lower(trim(COALESCE(p.username, ''))) = lower(v_old_username)
        )
    )
  THEN
    INSERT INTO public.profile_referral_code_aliases (
      user_id,
      referral_code,
      referral_code_normalized,
      created_by,
      reason
    )
    SELECT
      v_user_id,
      v_old_username,
      lower(v_old_username),
      v_user_id,
      'username_change'
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.profile_referral_code_aliases a
      WHERE a.referral_code_normalized = lower(v_old_username)
        AND a.retired_at IS NULL
    );
  END IF;

  PERFORM set_config('app.allow_referral_code_update', 'on', true);

  UPDATE public.profiles
  SET
    username = v_username,
    referral_code = v_code,
    referral_code_normalized = lower(v_code),
    updated_at = now()
  WHERE id = v_user_id
  RETURNING * INTO v_profile;

  PERFORM set_config('app.allow_referral_code_update', '', true);

  RETURN v_profile;
EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('app.allow_referral_code_update', '', true);
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_username_and_referral_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_username_and_referral_code(text) TO authenticated, service_role;

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

    UNION ALL

    SELECT
      p.id AS referrer_user_id,
      public.affiliate_get_user_partner_id(p.id) AS partner_id,
      p.referral_code,
      'referral_alias'::text AS matched_by,
      4 AS priority,
      a.created_at
    FROM public.profile_referral_code_aliases a
    JOIN public.profiles p ON p.id = a.user_id
    WHERE a.retired_at IS NULL
      AND a.referral_code_normalized = lower(v_code)
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

COMMENT ON FUNCTION public.update_my_username_and_referral_code(text) IS
  'Authenticated profile username update that also rotates referral_code and preserves old codes as aliases.';

COMMIT;
