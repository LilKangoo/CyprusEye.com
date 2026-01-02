DO $$
BEGIN
  IF to_regclass('public.hotel_bookings') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.hotel_bookings ENABLE ROW LEVEL SECURITY';

  EXECUTE 'GRANT USAGE ON SCHEMA public TO anon';
  EXECUTE 'GRANT USAGE ON SCHEMA public TO authenticated';

  EXECUTE 'GRANT INSERT ON TABLE public.hotel_bookings TO anon';
  EXECUTE 'GRANT INSERT ON TABLE public.hotel_bookings TO authenticated';

  EXECUTE 'DROP POLICY IF EXISTS "Anyone can create hotel bookings" ON public.hotel_bookings';
  EXECUTE 'DROP POLICY IF EXISTS hotel_bookings_anon_insert ON public.hotel_bookings';
  EXECUTE 'DROP POLICY IF EXISTS hotel_bookings_authenticated_insert ON public.hotel_bookings';

  EXECUTE 'CREATE POLICY hotel_bookings_anon_insert ON public.hotel_bookings FOR INSERT TO anon WITH CHECK (true)';
  EXECUTE 'CREATE POLICY hotel_bookings_authenticated_insert ON public.hotel_bookings FOR INSERT TO authenticated WITH CHECK (true)';
END $$;
