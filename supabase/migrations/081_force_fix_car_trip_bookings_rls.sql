DO $$
DECLARE
  r record;
  has_admin_fn boolean;
  email_col text;
  admin_check text;
  jwt_email_expr text;
BEGIN
  has_admin_fn := (to_regprocedure('public.is_current_user_admin()') IS NOT NULL);
  admin_check := CASE
    WHEN has_admin_fn THEN 'public.is_current_user_admin()'
    ELSE '(EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true))'
  END;

  jwt_email_expr := 'lower(coalesce(auth.jwt() ->> ''email'', auth.jwt() -> ''user_metadata'' ->> ''email'', ''''))';

  -- -----------------------------
  -- trip_bookings
  -- -----------------------------
  IF to_regclass('public.trip_bookings') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.trip_bookings ENABLE ROW LEVEL SECURITY';

    FOR r IN (
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'trip_bookings'
    ) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.trip_bookings', r.policyname);
    END LOOP;

    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.trip_bookings TO authenticated';
    EXECUTE 'GRANT INSERT ON TABLE public.trip_bookings TO anon';

    EXECUTE 'CREATE POLICY trip_bookings_anon_insert ON public.trip_bookings FOR INSERT TO anon WITH CHECK (true)';
    EXECUTE 'CREATE POLICY trip_bookings_auth_insert ON public.trip_bookings FOR INSERT TO authenticated WITH CHECK (true)';

    EXECUTE 'CREATE POLICY trip_bookings_user_select ON public.trip_bookings FOR SELECT TO authenticated USING (lower(customer_email) = ' || jwt_email_expr || ')';

    EXECUTE 'CREATE POLICY trip_bookings_admin_select ON public.trip_bookings FOR SELECT TO authenticated USING (' || admin_check || ')';
    EXECUTE 'CREATE POLICY trip_bookings_admin_update ON public.trip_bookings FOR UPDATE TO authenticated USING (' || admin_check || ') WITH CHECK (' || admin_check || ')';
    EXECUTE 'CREATE POLICY trip_bookings_admin_delete ON public.trip_bookings FOR DELETE TO authenticated USING (' || admin_check || ')';
  END IF;

  -- -----------------------------
  -- car_bookings
  -- -----------------------------
  IF to_regclass('public.car_bookings') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.car_bookings ENABLE ROW LEVEL SECURITY';

    FOR r IN (
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'car_bookings'
    ) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.car_bookings', r.policyname);
    END LOOP;

    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.car_bookings TO authenticated';
    EXECUTE 'GRANT INSERT ON TABLE public.car_bookings TO anon';

    EXECUTE 'CREATE POLICY car_bookings_anon_insert ON public.car_bookings FOR INSERT TO anon WITH CHECK (true)';
    EXECUTE 'CREATE POLICY car_bookings_auth_insert ON public.car_bookings FOR INSERT TO authenticated WITH CHECK (true)';

    email_col := NULL;
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'car_bookings'
        AND column_name = 'email'
    ) THEN
      email_col := 'email';
    ELSIF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'car_bookings'
        AND column_name = 'customer_email'
    ) THEN
      email_col := 'customer_email';
    END IF;

    IF email_col IS NOT NULL THEN
      EXECUTE format(
        'CREATE POLICY car_bookings_user_select ON public.car_bookings FOR SELECT TO authenticated USING (lower(%I) = %s)',
        email_col,
        jwt_email_expr
      );
    END IF;

    EXECUTE 'CREATE POLICY car_bookings_admin_select ON public.car_bookings FOR SELECT TO authenticated USING (' || admin_check || ')';
    EXECUTE 'CREATE POLICY car_bookings_admin_update ON public.car_bookings FOR UPDATE TO authenticated USING (' || admin_check || ') WITH CHECK (' || admin_check || ')';
    EXECUTE 'CREATE POLICY car_bookings_admin_delete ON public.car_bookings FOR DELETE TO authenticated USING (' || admin_check || ')';
  END IF;
END $$;
