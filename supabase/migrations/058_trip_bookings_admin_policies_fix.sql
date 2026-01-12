DO $$
DECLARE
  r record;
  has_admin_fn boolean;
BEGIN
  IF to_regclass('public.trip_bookings') IS NULL THEN
    RETURN;
  END IF;

  has_admin_fn := (to_regprocedure('public.is_current_user_admin()') IS NOT NULL);

  -- Drop all existing SELECT/UPDATE/DELETE policies to avoid mismatched admin checks
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'trip_bookings'
      AND cmd IN ('SELECT', 'UPDATE', 'DELETE', 'ALL')
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.trip_bookings', r.policyname);
  END LOOP;

  -- Recreate user SELECT policy
  EXECUTE $policy$
    CREATE POLICY trip_bookings_user_select
    ON public.trip_bookings
    FOR SELECT
    TO authenticated
    USING (customer_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  $policy$;

  -- Recreate admin policies (prefer central helper used elsewhere)
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

  -- Ensure grants required by Admin UI actions
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.trip_bookings TO authenticated';
  EXECUTE 'GRANT INSERT ON TABLE public.trip_bookings TO anon';
END $$;
