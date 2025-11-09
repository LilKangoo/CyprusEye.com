-- =====================================================
-- HOTEL CATEGORIES RLS POLICIES
-- =====================================================

ALTER TABLE public.hotel_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view published hotel categories" ON public.hotel_categories;
DROP POLICY IF EXISTS "Authenticated users can view all hotel categories" ON public.hotel_categories;
DROP POLICY IF EXISTS "Admins can insert hotel categories" ON public.hotel_categories;
DROP POLICY IF EXISTS "Admins can update hotel categories" ON public.hotel_categories;
DROP POLICY IF EXISTS "Admins can delete hotel categories" ON public.hotel_categories;

-- Public can view categories only if both category and parent hotel are published and active
CREATE POLICY "Anyone can view published hotel categories"
  ON public.hotel_categories FOR SELECT
  USING (
    is_published = true AND is_active = true AND EXISTS (
      SELECT 1 FROM public.hotels h
      WHERE h.id = hotel_categories.hotel_id
      AND h.is_published = true
    )
  );

-- Authenticated users (admin app) can view all
CREATE POLICY "Authenticated users can view all hotel categories"
  ON public.hotel_categories FOR SELECT
  TO authenticated
  USING (true);

-- Admin-only write
CREATE POLICY "Admins can insert hotel categories"
  ON public.hotel_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.is_admin = true
    )
  );

CREATE POLICY "Admins can update hotel categories"
  ON public.hotel_categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.is_admin = true
    )
  );

CREATE POLICY "Admins can delete hotel categories"
  ON public.hotel_categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.is_admin = true
    )
  );

-- Grants
GRANT SELECT ON public.hotel_categories TO authenticated;
GRANT INSERT ON public.hotel_categories TO authenticated;
GRANT UPDATE ON public.hotel_categories TO authenticated;
GRANT DELETE ON public.hotel_categories TO authenticated;
GRANT SELECT ON public.hotel_categories TO anon;
