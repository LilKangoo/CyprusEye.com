-- =====================================================
-- HOTEL CATEGORIES TABLE
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='hotel_categories'
  ) THEN
    CREATE TABLE public.hotel_categories (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      hotel_id uuid REFERENCES public.hotels(id) ON DELETE CASCADE,
      name text NOT NULL,
      capacity_adults integer NOT NULL,
      capacity_children integer NOT NULL DEFAULT 0,
      price_per_person_per_night numeric(10,2),
      extra_person_price_per_night numeric(10,2),
      min_nights integer DEFAULT 1,
      is_active boolean DEFAULT true,
      is_published boolean DEFAULT true,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS hotel_categories_hotel_id_idx ON public.hotel_categories(hotel_id);
CREATE INDEX IF NOT EXISTS hotel_categories_is_published_idx ON public.hotel_categories(is_published);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_hotel_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_hotel_categories_updated_at'
  ) THEN
    CREATE TRIGGER trg_update_hotel_categories_updated_at
    BEFORE UPDATE ON public.hotel_categories
    FOR EACH ROW
    EXECUTE FUNCTION public.update_hotel_categories_updated_at();
  END IF;
END $$;
