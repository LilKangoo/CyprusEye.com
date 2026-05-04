-- Canonicalize POI Google Maps links without removing legacy compatibility.
-- Safe to run multiple times: it only adds missing columns and fills empty values.

ALTER TABLE public.pois
  ADD COLUMN IF NOT EXISTS google_maps_url text;

ALTER TABLE public.pois
  ADD COLUMN IF NOT EXISTS google_url text;

UPDATE public.pois
SET google_maps_url = NULLIF(BTRIM(google_url), '')
WHERE COALESCE(NULLIF(BTRIM(google_maps_url), ''), '') = ''
  AND COALESCE(NULLIF(BTRIM(google_url), ''), '') <> '';

UPDATE public.pois
SET google_url = NULLIF(BTRIM(google_maps_url), '')
WHERE COALESCE(NULLIF(BTRIM(google_url), ''), '') = ''
  AND COALESCE(NULLIF(BTRIM(google_maps_url), ''), '') <> '';

COMMENT ON COLUMN public.pois.google_maps_url IS 'Canonical Google Maps URL for POI navigation.';
COMMENT ON COLUMN public.pois.google_url IS 'Legacy alias kept in sync by admin code for backward compatibility.';
