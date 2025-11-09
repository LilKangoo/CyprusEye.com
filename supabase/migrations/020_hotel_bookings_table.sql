-- =====================================================
-- HOTEL BOOKINGS TABLE
-- =====================================================

DROP TABLE IF EXISTS public.hotel_bookings CASCADE;

CREATE TABLE public.hotel_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  hotel_id uuid REFERENCES public.hotels(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.hotel_categories(id) ON DELETE SET NULL,
  hotel_slug text,

  -- Customer information
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,

  -- Stay details
  arrival_date date NOT NULL,
  departure_date date NOT NULL,
  num_adults integer DEFAULT 1,
  num_children integer DEFAULT 0,
  nights integer,
  notes text,

  -- Pricing
  total_price numeric(10,2),

  -- Status
  status text DEFAULT 'pending' CHECK (status IN (
    'pending', 'confirmed', 'completed', 'cancelled'
  )),

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_email ON public.hotel_bookings(customer_email);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_hotel_id ON public.hotel_bookings(hotel_id);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_category_id ON public.hotel_bookings(category_id);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_created ON public.hotel_bookings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_status ON public.hotel_bookings(status);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION public.update_hotel_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_hotel_bookings_updated_at
BEFORE UPDATE ON public.hotel_bookings
FOR EACH ROW
EXECUTE FUNCTION public.update_hotel_bookings_updated_at();
