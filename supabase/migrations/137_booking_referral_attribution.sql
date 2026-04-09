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
BEGIN
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

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'hotel_bookings',
    'trip_bookings',
    'car_bookings',
    'transport_bookings'
  ]
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I
         ADD COLUMN IF NOT EXISTS referral_code text,
         ADD COLUMN IF NOT EXISTS referral_referrer_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
         ADD COLUMN IF NOT EXISTS referral_partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
         ADD COLUMN IF NOT EXISTS referral_source text,
         ADD COLUMN IF NOT EXISTS referral_captured_at timestamptz',
      table_name
    );

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (referral_code)',
      table_name || '_referral_code_idx',
      table_name
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (referral_referrer_user_id)',
      table_name || '_referral_referrer_user_id_idx',
      table_name
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (referral_partner_id)',
      table_name || '_referral_partner_id_idx',
      table_name
    );

    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I ON public.%I',
      'trg_' || table_name || '_apply_referral_attribution',
      table_name
    );
    EXECUTE format(
      'CREATE TRIGGER %I
         BEFORE INSERT OR UPDATE OF referral_code, referral_source, referral_captured_at
         ON public.%I
         FOR EACH ROW
         EXECUTE FUNCTION public.trg_apply_booking_referral_attribution()',
      'trg_' || table_name || '_apply_referral_attribution',
      table_name
    );
  END LOOP;
END;
$$;
