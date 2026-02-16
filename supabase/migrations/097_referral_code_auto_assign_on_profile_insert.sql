CREATE OR REPLACE FUNCTION public.apply_referral_code_from_auth_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_code text;
  v_referrer uuid;
  has_username_normalized boolean := false;
BEGIN
  IF NEW.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.referred_by IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT NULLIF(trim(COALESCE(u.raw_user_meta_data->>'referral_code', '')), '')
  INTO v_code
  FROM auth.users u
  WHERE u.id = NEW.id;

  IF v_code IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'profiles'
      AND c.column_name = 'username_normalized'
  ) INTO has_username_normalized;

  IF has_username_normalized THEN
    SELECT p.id INTO v_referrer
    FROM public.profiles p
    WHERE p.id <> NEW.id
      AND (
        p.username_normalized = lower(v_code)
        OR lower(trim(COALESCE(p.username, ''))) = lower(v_code)
      )
    ORDER BY (p.username_normalized = lower(v_code)) DESC, p.created_at ASC
    LIMIT 1;
  ELSE
    SELECT p.id INTO v_referrer
    FROM public.profiles p
    WHERE p.id <> NEW.id
      AND lower(trim(COALESCE(p.username, ''))) = lower(v_code)
    ORDER BY p.created_at ASC
    LIMIT 1;
  END IF;

  IF v_referrer IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.referred_by := v_referrer;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_apply_referral_code ON public.profiles;
CREATE TRIGGER trg_profiles_apply_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_referral_code_from_auth_metadata();

CREATE OR REPLACE FUNCTION public.sync_referrals_from_profiles_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS NULL OR NEW.referred_by IS NULL OR NEW.referred_by = NEW.id THEN
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
CREATE TRIGGER trg_profiles_sync_referrals_insert
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_referrals_from_profiles_insert();

