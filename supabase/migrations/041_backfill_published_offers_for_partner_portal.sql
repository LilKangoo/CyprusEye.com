-- =====================================================
-- BACKFILL: publish existing admin-managed offers
-- Purpose: after introducing is_published / owner_partner_id, old seed data
--          may remain is_published=false, causing partner portal car list to be empty.
-- =====================================================

DO $$
BEGIN
  -- Car offers: treat legacy offers (no owner) as published
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='car_offers' AND column_name='is_published'
  ) THEN
    UPDATE public.car_offers
    SET is_published = true
    WHERE owner_partner_id IS NULL
      AND is_published IS DISTINCT FROM true;
  END IF;

  -- Trips: legacy trips (no owner) as published
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='trips' AND column_name='is_published'
  ) THEN
    UPDATE public.trips
    SET is_published = true
    WHERE owner_partner_id IS NULL
      AND is_published IS DISTINCT FROM true;
  END IF;

  -- Hotels: legacy hotels (no owner) as published
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='hotels' AND column_name='is_published'
  ) THEN
    UPDATE public.hotels
    SET is_published = true
    WHERE owner_partner_id IS NULL
      AND is_published IS DISTINCT FROM true;
  END IF;
END $$;
