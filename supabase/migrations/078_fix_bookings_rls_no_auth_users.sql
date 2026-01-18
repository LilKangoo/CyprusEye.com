DO $$
DECLARE
  r record;
  has_admin_fn boolean;
  email_col text;
BEGIN
  IF to_regclass('public.trip_bookings') IS NOT NULL THEN
    has_admin_fn := (to_regprocedure('public.is_current_user_admin()') IS NOT NULL);

    EXECUTE 'ALTER TABLE public.trip_bookings ENABLE ROW LEVEL SECURITY';

    FOR r IN (
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'trip_bookings'
        AND cmd IN ('SELECT', 'UPDATE', 'DELETE', 'ALL')
    ) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.trip_bookings', r.policyname);
    END LOOP;

    EXECUTE $policy$
      CREATE POLICY trip_bookings_user_select
      ON public.trip_bookings
      FOR SELECT
      TO authenticated
      USING (lower(customer_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
    $policy$;

    IF has_admin_fn THEN
      EXECUTE $policy$
        CREATE POLICY trip_bookings_admin_select
        ON public.trip_bookings
        FOR SELECT
        TO authenticated
        USING (public.is_current_user_admin())
      $policy$;

      EXECUTE $policy$
        CREATE POLICY trip_bookings_admin_update
        ON public.trip_bookings
        FOR UPDATE
        TO authenticated
        USING (public.is_current_user_admin())
        WITH CHECK (public.is_current_user_admin())
      $policy$;

      EXECUTE $policy$
        CREATE POLICY trip_bookings_admin_delete
        ON public.trip_bookings
        FOR DELETE
        TO authenticated
        USING (public.is_current_user_admin())
      $policy$;
    ELSE
      EXECUTE $policy$
        CREATE POLICY trip_bookings_admin_select
        ON public.trip_bookings
        FOR SELECT
        TO authenticated
        USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true))
      $policy$;

      EXECUTE $policy$
        CREATE POLICY trip_bookings_admin_update
        ON public.trip_bookings
        FOR UPDATE
        TO authenticated
        USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true))
        WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true))
      $policy$;

      EXECUTE $policy$
        CREATE POLICY trip_bookings_admin_delete
        ON public.trip_bookings
        FOR DELETE
        TO authenticated
        USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true))
      $policy$;
    END IF;

    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.trip_bookings TO authenticated';
    EXECUTE 'GRANT INSERT ON TABLE public.trip_bookings TO anon';
  END IF;

  IF to_regclass('public.car_bookings') IS NOT NULL THEN
    has_admin_fn := (to_regprocedure('public.is_current_user_admin()') IS NOT NULL);

    EXECUTE 'ALTER TABLE public.car_bookings ENABLE ROW LEVEL SECURITY';

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

    FOR r IN (
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'car_bookings'
        AND cmd IN ('SELECT', 'UPDATE', 'DELETE', 'ALL')
    ) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.car_bookings', r.policyname);
    END LOOP;

    IF email_col IS NOT NULL THEN
      EXECUTE format(
        'CREATE POLICY car_bookings_user_select ON public.car_bookings FOR SELECT TO authenticated USING (lower(%I) = lower(coalesce(auth.jwt() ->> ''email'', '''')))',
        email_col
      );
    END IF;

    IF has_admin_fn THEN
      EXECUTE 'CREATE POLICY car_bookings_admin_select ON public.car_bookings FOR SELECT TO authenticated USING (public.is_current_user_admin())';
      EXECUTE 'CREATE POLICY car_bookings_admin_update ON public.car_bookings FOR UPDATE TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin())';
      EXECUTE 'CREATE POLICY car_bookings_admin_delete ON public.car_bookings FOR DELETE TO authenticated USING (public.is_current_user_admin())';
    ELSE
      EXECUTE 'CREATE POLICY car_bookings_admin_select ON public.car_bookings FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true))';
      EXECUTE 'CREATE POLICY car_bookings_admin_update ON public.car_bookings FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true))';
      EXECUTE 'CREATE POLICY car_bookings_admin_delete ON public.car_bookings FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true))';
    END IF;

    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.car_bookings TO authenticated';
    EXECUTE 'GRANT INSERT ON TABLE public.car_bookings TO anon';
  END IF;
END $$;
