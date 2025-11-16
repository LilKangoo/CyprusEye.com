-- Add sort_order column to trips for manual ordering on homepage and admin
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'trips' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE public.trips ADD COLUMN sort_order integer DEFAULT 1000;
  END IF;
END $$;

-- Optional: backfill existing rows with incremental sort_order based on created_at
UPDATE public.trips t
SET sort_order = x.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM public.trips
) AS x
WHERE x.id = t.id
  AND (t.sort_order IS NULL OR t.sort_order = 1000);
