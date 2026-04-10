CREATE OR REPLACE FUNCTION public.trg_apply_booking_referral_attribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := NULLIF(trim(COALESCE(NEW.referral_code, '')), '');
  v_match record;
  v_source text := NULLIF(lower(trim(COALESCE(NEW.referral_source, ''))), '');
  v_customer_email text := NULLIF(lower(trim(COALESCE(NEW.customer_email, ''))), '');
  v_existing_referred_by uuid;
BEGIN
  IF v_customer_email IS NOT NULL THEN
    SELECT p.referred_by
    INTO v_existing_referred_by
    FROM public.profiles p
    WHERE lower(trim(COALESCE(p.email, ''))) = v_customer_email
      AND p.referred_by IS NOT NULL
    LIMIT 1;

    IF v_existing_referred_by IS NOT NULL THEN
      NEW.referral_code := NULL;
      NEW.referral_referrer_user_id := NULL;
      NEW.referral_partner_id := NULL;
      NEW.referral_source := NULL;
      NEW.referral_captured_at := NULL;
      RETURN NEW;
    END IF;
  END IF;

  IF v_code IS NULL THEN
    NEW.referral_code := NULL;
    NEW.referral_referrer_user_id := NULL;
    NEW.referral_partner_id := NULL;
    NEW.referral_source := NULL;
    NEW.referral_captured_at := NULL;
    RETURN NEW;
  END IF;

  SELECT *
  INTO v_match
  FROM public.resolve_referral_code(v_code)
  LIMIT 1;

  IF v_match.referrer_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_referral_code';
  END IF;

  NEW.referral_code := v_match.referral_code;
  NEW.referral_referrer_user_id := v_match.referrer_user_id;
  NEW.referral_partner_id := v_match.partner_id;
  NEW.referral_source := COALESCE(v_source, 'unknown');
  NEW.referral_captured_at := COALESCE(NEW.referral_captured_at, now());

  RETURN NEW;
END;
$$;
