-- =====================================================
-- PARTNER-OWNED RESOURCES + ADMIN APPROVAL WORKFLOW
-- - partners can create/modify their own cars/trips/hotels
-- - resources are NOT public until admin publishes
-- =====================================================

-- -----------------
-- CAR OFFERS
-- -----------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='car_offers' AND column_name='owner_partner_id'
  ) THEN
    ALTER TABLE public.car_offers
      ADD COLUMN owner_partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='car_offers' AND column_name='is_published'
  ) THEN
    ALTER TABLE public.car_offers
      ADD COLUMN is_published BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='car_offers' AND column_name='submission_status'
  ) THEN
    ALTER TABLE public.car_offers
      ADD COLUMN submission_status TEXT DEFAULT 'draft'
      CHECK (submission_status IN ('draft','pending','approved','rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_car_offers_owner_partner ON public.car_offers(owner_partner_id);
CREATE INDEX IF NOT EXISTS idx_car_offers_is_published ON public.car_offers(is_published);
CREATE INDEX IF NOT EXISTS idx_car_offers_submission_status ON public.car_offers(submission_status);

ALTER TABLE public.car_offers ENABLE ROW LEVEL SECURITY;

-- Drop to avoid conflicts
DROP POLICY IF EXISTS car_offers_public_select ON public.car_offers;
DROP POLICY IF EXISTS car_offers_authenticated_select ON public.car_offers;
DROP POLICY IF EXISTS car_offers_admin_all ON public.car_offers;
DROP POLICY IF EXISTS car_offers_partner_select ON public.car_offers;
DROP POLICY IF EXISTS car_offers_partner_insert ON public.car_offers;
DROP POLICY IF EXISTS car_offers_partner_update ON public.car_offers;
DROP POLICY IF EXISTS car_offers_partner_delete ON public.car_offers;

-- Public: only published + available
CREATE POLICY car_offers_public_select
  ON public.car_offers FOR SELECT
  USING (is_available = true AND is_published = true);

-- Authenticated: admin OR owner OR published
CREATE POLICY car_offers_authenticated_select
  ON public.car_offers FOR SELECT
  TO authenticated
  USING (
    is_current_user_admin()
    OR (owner_partner_id IS NOT NULL AND is_partner_user(owner_partner_id))
    OR is_published = true
  );

-- Admin full control
CREATE POLICY car_offers_admin_all
  ON public.car_offers FOR ALL
  TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

-- Partners: create/update/delete ONLY their own unpublished offers
CREATE POLICY car_offers_partner_insert
  ON public.car_offers FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_partner_id IS NOT NULL
    AND is_partner_user(owner_partner_id)
    AND is_published = false
  );

CREATE POLICY car_offers_partner_update
  ON public.car_offers FOR UPDATE
  TO authenticated
  USING (
    owner_partner_id IS NOT NULL
    AND is_partner_user(owner_partner_id)
    AND is_published = false
  )
  WITH CHECK (
    owner_partner_id IS NOT NULL
    AND is_partner_user(owner_partner_id)
    AND is_published = false
  );

CREATE POLICY car_offers_partner_delete
  ON public.car_offers FOR DELETE
  TO authenticated
  USING (
    owner_partner_id IS NOT NULL
    AND is_partner_user(owner_partner_id)
    AND is_published = false
  );

-- -----------------
-- HOTELS
-- -----------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='hotels' AND column_name='owner_partner_id'
  ) THEN
    ALTER TABLE public.hotels
      ADD COLUMN owner_partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='hotels' AND column_name='submission_status'
  ) THEN
    ALTER TABLE public.hotels
      ADD COLUMN submission_status TEXT DEFAULT 'draft'
      CHECK (submission_status IN ('draft','pending','approved','rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_hotels_owner_partner ON public.hotels(owner_partner_id);
CREATE INDEX IF NOT EXISTS idx_hotels_submission_status ON public.hotels(submission_status);

ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view published hotels" ON public.hotels;
DROP POLICY IF EXISTS "Authenticated users can view all hotels" ON public.hotels;
DROP POLICY IF EXISTS "Admins can insert hotels" ON public.hotels;
DROP POLICY IF EXISTS "Admins can update hotels" ON public.hotels;
DROP POLICY IF EXISTS "Admins can delete hotels" ON public.hotels;
DROP POLICY IF EXISTS hotels_authenticated_select ON public.hotels;
DROP POLICY IF EXISTS hotels_admin_all ON public.hotels;
DROP POLICY IF EXISTS hotels_partner_insert ON public.hotels;
DROP POLICY IF EXISTS hotels_partner_update ON public.hotels;
DROP POLICY IF EXISTS hotels_partner_delete ON public.hotels;

CREATE POLICY "Anyone can view published hotels"
  ON public.hotels FOR SELECT
  USING (is_published = true);

CREATE POLICY hotels_authenticated_select
  ON public.hotels FOR SELECT
  TO authenticated
  USING (
    is_current_user_admin()
    OR (owner_partner_id IS NOT NULL AND is_partner_user(owner_partner_id))
    OR is_published = true
  );

CREATE POLICY hotels_admin_all
  ON public.hotels FOR ALL
  TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

CREATE POLICY hotels_partner_insert
  ON public.hotels FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_partner_id IS NOT NULL
    AND is_partner_user(owner_partner_id)
    AND is_published = false
  );

CREATE POLICY hotels_partner_update
  ON public.hotels FOR UPDATE
  TO authenticated
  USING (
    owner_partner_id IS NOT NULL
    AND is_partner_user(owner_partner_id)
    AND is_published = false
  )
  WITH CHECK (
    owner_partner_id IS NOT NULL
    AND is_partner_user(owner_partner_id)
    AND is_published = false
  );

CREATE POLICY hotels_partner_delete
  ON public.hotels FOR DELETE
  TO authenticated
  USING (
    owner_partner_id IS NOT NULL
    AND is_partner_user(owner_partner_id)
    AND is_published = false
  );

-- -----------------
-- TRIPS
-- -----------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='trips' AND column_name='owner_partner_id'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN owner_partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='trips' AND column_name='submission_status'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN submission_status TEXT DEFAULT 'draft'
      CHECK (submission_status IN ('draft','pending','approved','rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_trips_owner_partner ON public.trips(owner_partner_id);
CREATE INDEX IF NOT EXISTS idx_trips_submission_status ON public.trips(submission_status);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view published trips" ON public.trips;
DROP POLICY IF EXISTS "Authenticated users can view all trips" ON public.trips;
DROP POLICY IF EXISTS "Admins can insert trips" ON public.trips;
DROP POLICY IF EXISTS "Admins can update trips" ON public.trips;
DROP POLICY IF EXISTS "Admins can delete trips" ON public.trips;
DROP POLICY IF EXISTS trips_authenticated_select ON public.trips;
DROP POLICY IF EXISTS trips_admin_all ON public.trips;
DROP POLICY IF EXISTS trips_partner_insert ON public.trips;
DROP POLICY IF EXISTS trips_partner_update ON public.trips;
DROP POLICY IF EXISTS trips_partner_delete ON public.trips;

CREATE POLICY "Anyone can view published trips"
  ON public.trips FOR SELECT
  USING (is_published = true);

CREATE POLICY trips_authenticated_select
  ON public.trips FOR SELECT
  TO authenticated
  USING (
    is_current_user_admin()
    OR (owner_partner_id IS NOT NULL AND is_partner_user(owner_partner_id))
    OR is_published = true
  );

CREATE POLICY trips_admin_all
  ON public.trips FOR ALL
  TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

CREATE POLICY trips_partner_insert
  ON public.trips FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_partner_id IS NOT NULL
    AND is_partner_user(owner_partner_id)
    AND is_published = false
  );

CREATE POLICY trips_partner_update
  ON public.trips FOR UPDATE
  TO authenticated
  USING (
    owner_partner_id IS NOT NULL
    AND is_partner_user(owner_partner_id)
    AND is_published = false
  )
  WITH CHECK (
    owner_partner_id IS NOT NULL
    AND is_partner_user(owner_partner_id)
    AND is_published = false
  );

CREATE POLICY trips_partner_delete
  ON public.trips FOR DELETE
  TO authenticated
  USING (
    owner_partner_id IS NOT NULL
    AND is_partner_user(owner_partner_id)
    AND is_published = false
  );
