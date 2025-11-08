-- Add or adapt column poi_id to match pois.id type (TEXT) and add FK

DO $$
BEGIN
  -- Add column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='trips' AND column_name='poi_id'
  ) THEN
    ALTER TABLE public.trips ADD COLUMN poi_id text;
  END IF;

  -- If column exists but type is not text, convert to text
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='trips' AND column_name='poi_id' AND data_type <> 'text'
  ) THEN
    ALTER TABLE public.trips ALTER COLUMN poi_id TYPE text USING poi_id::text;
  END IF;

  -- Drop previous FK if exists (name may vary)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_schema='public' AND table_name='trips' AND constraint_type='FOREIGN KEY' AND constraint_name='trips_poi_id_fkey'
  ) THEN
    ALTER TABLE public.trips DROP CONSTRAINT trips_poi_id_fkey;
  END IF;

  -- Create FK to pois(id)
  ALTER TABLE public.trips
    ADD CONSTRAINT trips_poi_id_fkey FOREIGN KEY (poi_id) REFERENCES public.pois(id) ON DELETE SET NULL;
END $$;

-- Optional index to speed up lookups by poi
CREATE INDEX IF NOT EXISTS trips_poi_id_idx ON public.trips(poi_id);
