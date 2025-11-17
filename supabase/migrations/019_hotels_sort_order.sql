-- Add sort_order column to hotels for manual ordering on homepage and admin
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'hotels' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE public.hotels ADD COLUMN sort_order integer DEFAULT 1000;
  END IF;
END $$;

-- Optional: backfill existing rows with incremental sort_order based on created_at
UPDATE public.hotels h
SET sort_order = x.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM public.hotels
) AS x
WHERE x.id = h.id
  AND (h.sort_order IS NULL OR h.sort_order = 1000);
