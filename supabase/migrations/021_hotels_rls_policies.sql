-- =====================================================
-- HOTELS RLS POLICIES (mirrors trips)
-- =====================================================

-- Enable RLS
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;

-- Drop if exist to avoid conflicts
DROP POLICY IF EXISTS "Anyone can view published hotels" ON public.hotels;
DROP POLICY IF EXISTS "Authenticated users can view all hotels" ON public.hotels;
DROP POLICY IF EXISTS "Admins can insert hotels" ON public.hotels;
DROP POLICY IF EXISTS "Admins can update hotels" ON public.hotels;
DROP POLICY IF EXISTS "Admins can delete hotels" ON public.hotels;

-- SELECT
CREATE POLICY "Anyone can view published hotels"
  ON public.hotels FOR SELECT
  USING (is_published = true);

CREATE POLICY "Authenticated users can view all hotels"
  ON public.hotels FOR SELECT
  TO authenticated
  USING (true);

-- INSERT
CREATE POLICY "Admins can insert hotels"
  ON public.hotels FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- UPDATE
CREATE POLICY "Admins can update hotels"
  ON public.hotels FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- DELETE
CREATE POLICY "Admins can delete hotels"
  ON public.hotels FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Grants
GRANT SELECT ON public.hotels TO authenticated;
GRANT INSERT ON public.hotels TO authenticated;
GRANT UPDATE ON public.hotels TO authenticated;
GRANT DELETE ON public.hotels TO authenticated;
GRANT SELECT ON public.hotels TO anon;

COMMENT ON TABLE public.hotels IS 'Hotels/accommodations with RLS similar to trips';
