-- =====================================================
-- CAR BOOKINGS: partner visibility + admin notifications
-- =====================================================

create extension if not exists pg_net;

CREATE OR REPLACE FUNCTION public.partner_service_fulfillment_partner_id_for_car_booking(
  p_offer_id UUID,
  p_location TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid UUID;
  loc TEXT;
BEGIN
  loc := LOWER(NULLIF(TRIM(COALESCE(p_location, '')), ''));

  IF p_offer_id IS NOT NULL THEN
    BEGIN
      SELECT LOWER(NULLIF(TRIM(COALESCE(co.location, '')), ''))
      INTO loc
      FROM public.car_offers co
      WHERE co.id = p_offer_id
      LIMIT 1;
    EXCEPTION WHEN others THEN
      -- keep fallback loc
      loc := loc;
    END;
  END IF;

  IF loc IS NULL THEN
    RETURN NULL;
  END IF;

  IF loc NOT IN ('paphos','larnaca','all-cyprus') THEN
    RETURN NULL;
  END IF;

  SELECT p.id
  INTO pid
  FROM public.partners p
  WHERE p.status = 'active'
    AND p.can_manage_cars = true
    AND (
      (loc IN ('paphos','larnaca') AND p.cars_locations @> ARRAY[loc]::text[])
      OR (loc = 'all-cyprus' AND array_length(p.cars_locations, 1) IS NOT NULL)
    )
  ORDER BY COALESCE(array_length(p.cars_locations, 1), 999999) ASC,
           p.created_at ASC
  LIMIT 1;

  RETURN pid;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_partner_service_fulfillment_from_car_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  j JSONB;
  offer_uuid UUID;
  matched_offer_id UUID;
  pid UUID;
  loc TEXT;
  total_price NUMERIC;
  customer_name TEXT;
  customer_email TEXT;
  customer_phone TEXT;
  summary TEXT;
  currency TEXT;
  car_model_txt TEXT;
  fid UUID;
  details_json JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  j := to_jsonb(NEW);
  offer_uuid := public.try_uuid(j->>'offer_id');
  loc := COALESCE(NULLIF(j->>'location', ''), NULLIF(j->>'pickup_location', ''));

  matched_offer_id := NULL;
  car_model_txt := NULLIF(j->>'car_model', '');
  IF offer_uuid IS NULL AND car_model_txt IS NOT NULL AND LOWER(loc) IN ('paphos','larnaca') THEN
    matched_offer_id := public.match_car_offer_id(loc, car_model_txt);
    offer_uuid := COALESCE(offer_uuid, matched_offer_id);
  END IF;

  pid := public.partner_service_fulfillment_partner_id_for_car_booking(offer_uuid, loc);

  IF pid IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('cancelled', 'no_show') THEN
    RETURN NEW;
  END IF;

  total_price := COALESCE(
    public.try_numeric(j->>'final_price'),
    public.try_numeric(j->>'quoted_price'),
    public.try_numeric(j->>'total_price')
  );
  currency := COALESCE(NULLIF(j->>'currency', ''), 'EUR');
  customer_name := COALESCE(NULLIF(j->>'customer_name', ''), NULLIF(j->>'full_name', ''));
  customer_email := COALESCE(NULLIF(j->>'customer_email', ''), NULLIF(j->>'email', ''));
  customer_phone := COALESCE(NULLIF(j->>'customer_phone', ''), NULLIF(j->>'phone', ''));
  summary := COALESCE(NULLIF(j->>'car_model', ''), NULLIF(j->>'car_type', ''), 'Car booking');

  SELECT public.upsert_partner_service_fulfillment_from_booking_with_partner(
    pid,
    'cars',
    NEW.id,
    offer_uuid,
    NEW.pickup_date,
    NEW.return_date,
    total_price,
    currency,
    customer_name,
    customer_email,
    customer_phone,
    CONCAT('CAR-', SUBSTRING(NEW.id::text, 1, 8)),
    summary,
    NEW.created_at
  ) INTO fid;

  details_json := jsonb_strip_nulls(jsonb_build_object(
    'duration_days', CASE
      WHEN NEW.pickup_date IS NOT NULL AND NEW.return_date IS NOT NULL
        THEN GREATEST((NEW.return_date - NEW.pickup_date)::int, 0)
      ELSE NULL
    END,
    'pickup_location', NULLIF(j->>'pickup_location', ''),
    'return_location', NULLIF(j->>'return_location', ''),
    'pickup_location_fee', public.try_numeric(j->>'pickup_location_fee'),
    'return_location_fee', public.try_numeric(j->>'return_location_fee'),
    'insurance_cost', public.try_numeric(j->>'insurance_cost'),
    'young_driver_cost', public.try_numeric(j->>'young_driver_cost'),
    'insurance_added', CASE
      WHEN lower(COALESCE(NULLIF(j->>'insurance_added',''), 'false')) IN ('true','t','1','yes') THEN true
      WHEN lower(COALESCE(NULLIF(j->>'insurance_added',''), 'false')) IN ('false','f','0','no') THEN false
      ELSE NULL
    END,
    'young_driver_fee', CASE
      WHEN lower(COALESCE(NULLIF(j->>'young_driver_fee',''), 'false')) IN ('true','t','1','yes') THEN true
      WHEN lower(COALESCE(NULLIF(j->>'young_driver_fee',''), 'false')) IN ('false','f','0','no') THEN false
      ELSE NULL
    END
  ));

  IF fid IS NOT NULL THEN
    UPDATE public.partner_service_fulfillments
    SET details = details_json
    WHERE id = fid;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partner_service_fulfillment_from_car_booking_ins ON public.car_bookings;
CREATE TRIGGER trg_partner_service_fulfillment_from_car_booking_ins
  AFTER INSERT ON public.car_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_partner_service_fulfillment_from_car_booking();

DROP TRIGGER IF EXISTS trg_partner_service_fulfillment_from_car_booking_upd ON public.car_bookings;
CREATE TRIGGER trg_partner_service_fulfillment_from_car_booking_upd
  AFTER UPDATE ON public.car_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_partner_service_fulfillment_from_car_booking();

CREATE OR REPLACE FUNCTION public.trg_notify_admin_new_car_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload JSONB;
  url TEXT := 'https://daoohnbnnowmmcizgvrq.functions.supabase.co/send-admin-notification';
BEGIN
  payload := jsonb_build_object(
    'category', 'cars',
    'record_id', NEW.id::text,
    'event', 'created',
    'table', 'car_bookings',
    'record', to_jsonb(NEW)
  );

  PERFORM net.http_post(
    url := url,
    body := payload,
    headers := jsonb_build_object('Content-Type', 'application/json')
  );

  RETURN NEW;
EXCEPTION WHEN undefined_function OR invalid_schema_name OR undefined_table THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_new_car_booking_ins ON public.car_bookings;
CREATE TRIGGER trg_notify_admin_new_car_booking_ins
  AFTER INSERT ON public.car_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_admin_new_car_booking();

DO $$
DECLARE
  pol RECORD;
  has_email BOOLEAN;
  has_customer_email BOOLEAN;
  has_admin_fn BOOLEAN;
  has_is_admin_fn BOOLEAN;
BEGIN
  IF to_regclass('public.car_bookings') IS NULL THEN
    RETURN;
  END IF;

  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'car_bookings'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.car_bookings', pol.policyname);
  END LOOP;

  ALTER TABLE public.car_bookings ENABLE ROW LEVEL SECURITY;

  GRANT INSERT ON public.car_bookings TO anon, authenticated;
  GRANT SELECT ON public.car_bookings TO authenticated;

  EXECUTE 'CREATE POLICY car_bookings_anon_insert ON public.car_bookings FOR INSERT TO anon, authenticated WITH CHECK (true)';

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'car_bookings' AND column_name = 'email'
  ) INTO has_email;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'car_bookings' AND column_name = 'customer_email'
  ) INTO has_customer_email;

  IF has_email THEN
    EXECUTE 'CREATE POLICY car_bookings_user_select ON public.car_bookings FOR SELECT TO authenticated USING (LOWER(email) = LOWER(auth.jwt() ->> ''email''))';
  ELSIF has_customer_email THEN
    EXECUTE 'CREATE POLICY car_bookings_user_select ON public.car_bookings FOR SELECT TO authenticated USING (LOWER(customer_email) = LOWER(auth.jwt() ->> ''email''))';
  END IF;

  has_admin_fn := (to_regprocedure('public.is_current_user_admin()') IS NOT NULL);
  has_is_admin_fn := (to_regprocedure('public.is_admin()') IS NOT NULL);

  IF has_admin_fn THEN
    EXECUTE 'CREATE POLICY car_bookings_admin_select ON public.car_bookings FOR SELECT TO authenticated USING (public.is_current_user_admin())';
    EXECUTE 'CREATE POLICY car_bookings_admin_update ON public.car_bookings FOR UPDATE TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin())';
    EXECUTE 'CREATE POLICY car_bookings_admin_delete ON public.car_bookings FOR DELETE TO authenticated USING (public.is_current_user_admin())';
  ELSIF has_is_admin_fn THEN
    EXECUTE 'CREATE POLICY car_bookings_admin_select ON public.car_bookings FOR SELECT TO authenticated USING (public.is_admin())';
    EXECUTE 'CREATE POLICY car_bookings_admin_update ON public.car_bookings FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
    EXECUTE 'CREATE POLICY car_bookings_admin_delete ON public.car_bookings FOR DELETE TO authenticated USING (public.is_admin())';
  ELSE
    EXECUTE 'CREATE POLICY car_bookings_admin_select ON public.car_bookings FOR SELECT TO authenticated USING ((auth.jwt() -> ''user_metadata'' ->> ''is_admin'')::boolean = true)';
    EXECUTE 'CREATE POLICY car_bookings_admin_update ON public.car_bookings FOR UPDATE TO authenticated USING ((auth.jwt() -> ''user_metadata'' ->> ''is_admin'')::boolean = true) WITH CHECK ((auth.jwt() -> ''user_metadata'' ->> ''is_admin'')::boolean = true)';
    EXECUTE 'CREATE POLICY car_bookings_admin_delete ON public.car_bookings FOR DELETE TO authenticated USING ((auth.jwt() -> ''user_metadata'' ->> ''is_admin'')::boolean = true)';
  END IF;
END $$;

DO $$
DECLARE
  cb RECORD;
  new_pid UUID;
BEGIN
  IF to_regclass('public.partner_service_fulfillments') IS NULL OR to_regclass('public.car_bookings') IS NULL THEN
    RETURN;
  END IF;

  FOR cb IN
    SELECT f.id AS fulfillment_id,
           f.resource_id,
           cb.location,
           cb.pickup_location,
           f.partner_id
    FROM public.partner_service_fulfillments f
    JOIN public.car_bookings cb
      ON cb.id = f.booking_id
    WHERE f.resource_type = 'cars'
  LOOP
    new_pid := public.partner_service_fulfillment_partner_id_for_car_booking(cb.resource_id, COALESCE(cb.location, cb.pickup_location));
    IF new_pid IS NOT NULL AND cb.partner_id IS DISTINCT FROM new_pid THEN
      UPDATE public.partner_service_fulfillments
      SET partner_id = new_pid
      WHERE id = cb.fulfillment_id;
    END IF;
  END LOOP;
EXCEPTION WHEN others THEN
  -- ignore backfill errors
  NULL;
END $$;
