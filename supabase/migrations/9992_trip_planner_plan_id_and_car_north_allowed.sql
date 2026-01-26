DO $$
BEGIN
  IF to_regclass('public.car_offers') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'car_offers'
        AND column_name = 'north_allowed'
    ) THEN
      ALTER TABLE public.car_offers
        ADD COLUMN north_allowed boolean NOT NULL DEFAULT false;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.car_offers') IS NOT NULL THEN
    UPDATE public.car_offers
    SET north_allowed = true
    WHERE lower(coalesce(location, '')) = 'larnaca'
      AND coalesce(north_allowed, false) = false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_car_offers_north_allowed ON public.car_offers(north_allowed);

DO $$
BEGIN
  IF to_regclass('public.user_plans') IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('public.car_bookings') IS NOT NULL THEN
    ALTER TABLE public.car_bookings
      ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.user_plans(id) ON DELETE SET NULL;

    ALTER TABLE public.car_bookings
      ADD COLUMN IF NOT EXISTS source text DEFAULT 'website',
      ADD COLUMN IF NOT EXISTS created_by uuid;

    UPDATE public.car_bookings
    SET source = 'website'
    WHERE source IS NULL OR btrim(source) = '';

    CREATE INDEX IF NOT EXISTS idx_car_bookings_plan_id ON public.car_bookings(plan_id);
  END IF;

  IF to_regclass('public.trip_bookings') IS NOT NULL THEN
    ALTER TABLE public.trip_bookings
      ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.user_plans(id) ON DELETE SET NULL;

    ALTER TABLE public.trip_bookings
      ADD COLUMN IF NOT EXISTS source text DEFAULT 'website',
      ADD COLUMN IF NOT EXISTS created_by uuid;

    ALTER TABLE public.trip_bookings
      ADD COLUMN IF NOT EXISTS user_id uuid;

    UPDATE public.trip_bookings
    SET user_id = created_by
    WHERE user_id IS NULL
      AND created_by IS NOT NULL;

    UPDATE public.trip_bookings
    SET source = 'website'
    WHERE source IS NULL OR btrim(source) = '';

    CREATE INDEX IF NOT EXISTS idx_trip_bookings_plan_id ON public.trip_bookings(plan_id);
  END IF;

  IF to_regclass('public.hotel_bookings') IS NOT NULL THEN
    ALTER TABLE public.hotel_bookings
      ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.user_plans(id) ON DELETE SET NULL;

    ALTER TABLE public.hotel_bookings
      ADD COLUMN IF NOT EXISTS source text DEFAULT 'website',
      ADD COLUMN IF NOT EXISTS created_by uuid;

    ALTER TABLE public.hotel_bookings
      ADD COLUMN IF NOT EXISTS user_id uuid;

    UPDATE public.hotel_bookings
    SET user_id = created_by
    WHERE user_id IS NULL
      AND created_by IS NOT NULL;

    UPDATE public.hotel_bookings
    SET source = 'website'
    WHERE source IS NULL OR btrim(source) = '';

    CREATE INDEX IF NOT EXISTS idx_hotel_bookings_plan_id ON public.hotel_bookings(plan_id);
  END IF;
END $$;
