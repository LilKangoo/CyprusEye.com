-- =====================================================
-- HOTELS: add max_persons limit for bookings
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='hotels' AND column_name='max_persons'
  ) THEN
    ALTER TABLE public.hotels ADD COLUMN max_persons integer CHECK (max_persons >= 1) DEFAULT NULL;
  END IF;
END $$;
