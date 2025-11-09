-- =====================================================
-- HOTEL BOOKINGS RLS POLICIES
-- =====================================================

ALTER TABLE public.hotel_bookings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can view hotel bookings" ON public.hotel_bookings;
DROP POLICY IF EXISTS "Admins can update hotel bookings" ON public.hotel_bookings;
DROP POLICY IF EXISTS "Admins can delete hotel bookings" ON public.hotel_bookings;
DROP POLICY IF EXISTS "Anyone can create hotel bookings" ON public.hotel_bookings;

-- SELECT (admin app)
CREATE POLICY "Authenticated users can view hotel bookings"
  ON public.hotel_bookings FOR SELECT
  TO authenticated
  USING (true);

-- UPDATE (admin-only)
CREATE POLICY "Admins can update hotel bookings"
  ON public.hotel_bookings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.is_admin = true
    )
  );

-- DELETE (admin-only)
CREATE POLICY "Admins can delete hotel bookings"
  ON public.hotel_bookings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.is_admin = true
    )
  );

-- Optional: Allow anonymous inserts from public site
CREATE POLICY "Anyone can create hotel bookings"
  ON public.hotel_bookings FOR INSERT
  WITH CHECK (true);

-- Grants
GRANT SELECT ON public.hotel_bookings TO authenticated;
GRANT INSERT ON public.hotel_bookings TO authenticated;
GRANT UPDATE ON public.hotel_bookings TO authenticated;
GRANT DELETE ON public.hotel_bookings TO authenticated;
GRANT SELECT ON public.hotel_bookings TO anon;
GRANT INSERT ON public.hotel_bookings TO anon;
