DO $$
BEGIN
  IF to_regclass('public.trip_bookings') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.trip_bookings ENABLE ROW LEVEL SECURITY';

  EXECUTE 'GRANT USAGE ON SCHEMA public TO anon';
  EXECUTE 'GRANT USAGE ON SCHEMA public TO authenticated';

  EXECUTE 'GRANT INSERT ON TABLE public.trip_bookings TO anon';
  EXECUTE 'GRANT INSERT ON TABLE public.trip_bookings TO authenticated';

  EXECUTE 'DROP POLICY IF EXISTS "Anyone can create trip bookings" ON public.trip_bookings';
  EXECUTE 'DROP POLICY IF EXISTS trip_bookings_anon_insert ON public.trip_bookings';
  EXECUTE 'DROP POLICY IF EXISTS trip_bookings_authenticated_insert ON public.trip_bookings';

  EXECUTE 'CREATE POLICY trip_bookings_anon_insert ON public.trip_bookings FOR INSERT TO anon WITH CHECK (true)';
  EXECUTE 'CREATE POLICY trip_bookings_authenticated_insert ON public.trip_bookings FOR INSERT TO authenticated WITH CHECK (true)';
END $$;
