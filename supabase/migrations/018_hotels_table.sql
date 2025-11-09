-- =====================================================
-- HOTELS TABLE
-- =====================================================

-- Drop and recreate if needed (idempotent guard)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='hotels'
  ) THEN
    CREATE TABLE public.hotels (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

      -- Optional linkage to POI
      poi_id text REFERENCES public.pois(id) ON DELETE SET NULL,

      -- Content
      slug text UNIQUE NOT NULL,
      title jsonb,
      description jsonb,
      city text,
      cover_image_url text,

      -- Pricing model for hotels
      pricing_model text DEFAULT 'per_person_per_night' CHECK (
        pricing_model IN ('per_person_per_night','category_per_night')
      ),

      -- Status/visibility
      is_published boolean DEFAULT false,
      status text DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),

      -- Timestamps
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
  END IF;
END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS hotels_city_idx ON public.hotels(city);
CREATE INDEX IF NOT EXISTS hotels_is_published_idx ON public.hotels(is_published);
CREATE INDEX IF NOT EXISTS hotels_updated_at_idx ON public.hotels(updated_at DESC);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_hotels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_hotels_updated_at'
  ) THEN
    CREATE TRIGGER trg_update_hotels_updated_at
    BEFORE UPDATE ON public.hotels
    FOR EACH ROW
    EXECUTE FUNCTION public.update_hotels_updated_at();
  END IF;
END $$;
