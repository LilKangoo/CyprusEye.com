-- Add offer_id to car_bookings so we can deterministically assign car bookings to the correct partner

ALTER TABLE public.car_bookings
ADD COLUMN IF NOT EXISTS offer_id UUID;

DO $$
BEGIN
  IF to_regclass('public.car_offers') IS NOT NULL THEN
    BEGIN
      ALTER TABLE public.car_bookings
      ADD CONSTRAINT car_bookings_offer_id_fkey
      FOREIGN KEY (offer_id)
      REFERENCES public.car_offers(id)
      ON DELETE SET NULL;
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_car_bookings_offer_id
ON public.car_bookings(offer_id);
