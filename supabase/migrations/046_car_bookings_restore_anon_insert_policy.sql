ALTER TABLE IF EXISTS public.car_bookings ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON TABLE public.car_bookings TO anon;
GRANT INSERT ON TABLE public.car_bookings TO authenticated;

DO $$
BEGIN
  IF to_regclass('public.car_bookings') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'car_bookings'
      AND policyname = 'car_bookings_anon_insert'
  ) THEN
    EXECUTE 'CREATE POLICY car_bookings_anon_insert ON public.car_bookings FOR INSERT TO anon, authenticated WITH CHECK (true)';
  END IF;
END $$;
