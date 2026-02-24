-- =====================================================
-- Transport: separate included large bags (15kg+) in route base allowance
-- =====================================================

DO $$
BEGIN
  IF to_regclass('public.transport_routes') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.transport_routes
    ADD COLUMN IF NOT EXISTS included_large_bags integer NOT NULL DEFAULT 0;
END $$;

DO $$
BEGIN
  IF to_regclass('public.transport_routes') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.transport_routes'::regclass
      AND c.conname = 'transport_routes_included_large_bags_check'
  ) THEN
    ALTER TABLE public.transport_routes
      ADD CONSTRAINT transport_routes_included_large_bags_check
      CHECK (included_large_bags >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.transport_routes') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.transport_routes
    DROP CONSTRAINT IF EXISTS transport_routes_capacity_check;

  ALTER TABLE public.transport_routes
    ADD CONSTRAINT transport_routes_capacity_check
    CHECK (
      max_passengers >= included_passengers
      AND max_bags >= (included_bags + included_large_bags)
    );
END $$;
