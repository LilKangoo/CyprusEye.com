-- =====================================================
-- PARTNER LOCATIONS (CARS) + PARTNER RESOURCE VISIBILITY
-- =====================================================

-- 1) Partners: allow selecting one or more car locations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='partners' AND column_name='cars_locations'
  ) THEN
    ALTER TABLE public.partners
      ADD COLUMN cars_locations TEXT[] NOT NULL DEFAULT '{}'::text[]
      CHECK (cars_locations <@ ARRAY['paphos','larnaca']::text[]);
  END IF;
END $$;

-- 2) Allow partners to read car offers for their locations (published offers)
-- NOTE: this complements existing policies (ownership + published).
DROP POLICY IF EXISTS car_offers_partner_location_select ON public.car_offers;
CREATE POLICY car_offers_partner_location_select
  ON public.car_offers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.partners p
      WHERE public.is_partner_user(p.id)
        AND p.can_manage_cars = true
        AND array_length(p.cars_locations, 1) IS NOT NULL
        AND public.car_offers.location = ANY(p.cars_locations)
        AND public.car_offers.is_published = true
    )
  );

-- 3) Allow partners to read explicitly assigned resources (for UI listing / calendar)
DROP POLICY IF EXISTS car_offers_partner_assigned_select ON public.car_offers;
CREATE POLICY car_offers_partner_assigned_select
  ON public.car_offers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.partner_resources pr
      WHERE pr.resource_type = 'cars'
        AND pr.resource_id = public.car_offers.id
        AND public.is_partner_user(pr.partner_id)
    )
  );

DROP POLICY IF EXISTS trips_partner_assigned_select ON public.trips;
CREATE POLICY trips_partner_assigned_select
  ON public.trips FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.partner_resources pr
      WHERE pr.resource_type = 'trips'
        AND pr.resource_id = public.trips.id
        AND public.is_partner_user(pr.partner_id)
    )
  );

DROP POLICY IF EXISTS hotels_partner_assigned_select ON public.hotels;
CREATE POLICY hotels_partner_assigned_select
  ON public.hotels FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.partner_resources pr
      WHERE pr.resource_type = 'hotels'
        AND pr.resource_id = public.hotels.id
        AND public.is_partner_user(pr.partner_id)
    )
  );

-- 4) Shop: allow partner to read products for their vendor (so dropdown can show names)
DROP POLICY IF EXISTS shop_products_partner_select ON public.shop_products;
CREATE POLICY shop_products_partner_select
  ON public.shop_products FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.partners p
      WHERE public.is_partner_user(p.id)
        AND p.can_manage_shop = true
        AND p.shop_vendor_id IS NOT NULL
        AND public.shop_products.vendor_id = p.shop_vendor_id
    )
  );
