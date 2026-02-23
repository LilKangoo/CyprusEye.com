-- =====================================================
-- Transport locations: optional local-language label
-- =====================================================

DO $$
BEGIN
  IF to_regclass('public.transport_locations') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.transport_locations
    ADD COLUMN IF NOT EXISTS name_local text;
END $$;

