DO $$
BEGIN
  IF to_regclass('public.hotel_bookings') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.hotel_bookings ENABLE ROW LEVEL SECURITY';

  EXECUTE 'GRANT USAGE ON SCHEMA public TO authenticated';
  EXECUTE 'GRANT SELECT ON TABLE public.hotel_bookings TO authenticated';
  EXECUTE 'GRANT UPDATE ON TABLE public.hotel_bookings TO authenticated';
  EXECUTE 'GRANT DELETE ON TABLE public.hotel_bookings TO authenticated';

  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can view hotel bookings" ON public.hotel_bookings';
  EXECUTE 'DROP POLICY IF EXISTS "Admins can update hotel bookings" ON public.hotel_bookings';
  EXECUTE 'DROP POLICY IF EXISTS "Admins can delete hotel bookings" ON public.hotel_bookings';

  EXECUTE 'CREATE POLICY "Authenticated users can view hotel bookings" ON public.hotel_bookings FOR SELECT TO authenticated USING (true)';

  EXECUTE 'CREATE POLICY "Admins can update hotel bookings" ON public.hotel_bookings FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true))';

  EXECUTE 'CREATE POLICY "Admins can delete hotel bookings" ON public.hotel_bookings FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true))';
END $$;
