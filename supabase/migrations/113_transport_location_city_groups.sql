-- =====================================================
-- Transport locations: city group for shared city/airport/hotel pricing bundles
-- =====================================================

DO $$
BEGIN
  IF to_regclass('public.transport_locations') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.transport_locations
    ADD COLUMN IF NOT EXISTS city_group text;
END $$;

DO $$
BEGIN
  IF to_regclass('public.transport_locations') IS NULL THEN
    RETURN;
  END IF;

  -- Backfill city groups from existing code values.
  -- Example: larnaca_airport -> larnaca, ayia_napa_hotel -> ayia_napa
  UPDATE public.transport_locations
  SET city_group = NULLIF(
    regexp_replace(
      lower(trim(COALESCE(code, ''))),
      '(_airport|_hotel|_city|_port|_station|_landmark|_center|_centre|_downtown|_pickup|_dropoff)$',
      '',
      'g'
    ),
    ''
  )
  WHERE (city_group IS NULL OR trim(city_group) = '')
    AND trim(COALESCE(code, '')) <> '';

  -- Final fallback if a suffix-strip removed everything.
  UPDATE public.transport_locations
  SET city_group = lower(trim(COALESCE(code, '')))
  WHERE (city_group IS NULL OR trim(city_group) = '')
    AND trim(COALESCE(code, '')) <> '';
END $$;

CREATE INDEX IF NOT EXISTS transport_locations_city_group_idx
  ON public.transport_locations ((lower(city_group)));
