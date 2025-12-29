DO $$
BEGIN
  IF to_regclass('public.car_bookings') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.car_bookings ENABLE ROW LEVEL SECURITY';

  EXECUTE 'GRANT USAGE ON SCHEMA public TO anon';
  EXECUTE 'GRANT USAGE ON SCHEMA public TO authenticated';

  EXECUTE 'GRANT INSERT ON TABLE public.car_bookings TO anon';
  EXECUTE 'GRANT INSERT ON TABLE public.car_bookings TO authenticated';

  EXECUTE 'DROP POLICY IF EXISTS "Anyone can create bookings" ON public.car_bookings';
  EXECUTE 'DROP POLICY IF EXISTS car_bookings_anon_insert ON public.car_bookings';
  EXECUTE 'DROP POLICY IF EXISTS car_bookings_authenticated_insert ON public.car_bookings';

  EXECUTE 'CREATE POLICY car_bookings_anon_insert ON public.car_bookings FOR INSERT TO anon WITH CHECK (true)';
  EXECUTE 'CREATE POLICY car_bookings_authenticated_insert ON public.car_bookings FOR INSERT TO authenticated WITH CHECK (true)';
END $$;
