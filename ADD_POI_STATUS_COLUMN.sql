-- =====================================================
-- ADD STATUS COLUMN TO POIS TABLE
-- =====================================================
-- This adds a status column so POIs can be draft/published/hidden
-- =====================================================

-- Add status column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pois' AND column_name = 'status'
  ) THEN
    ALTER TABLE pois ADD COLUMN status TEXT DEFAULT 'published';
    RAISE NOTICE '✅ Added status column to pois table';
  ELSE
    RAISE NOTICE 'ℹ️ Status column already exists';
  END IF;
END $$;

-- Set default status to 'published' for existing POIs
UPDATE pois SET status = 'published' WHERE status IS NULL;

-- Create index for faster status queries
CREATE INDEX IF NOT EXISTS idx_pois_status ON pois(status);

-- Verify the change
DO $$
DECLARE
  total_count INTEGER;
  published_count INTEGER;
  draft_count INTEGER;
  hidden_count INTEGER;
BEGIN
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'published'),
    COUNT(*) FILTER (WHERE status = 'draft'),
    COUNT(*) FILTER (WHERE status = 'hidden')
  INTO total_count, published_count, draft_count, hidden_count
  FROM pois;
  
  RAISE NOTICE '✅ Status column setup complete';
  RAISE NOTICE 'Total POIs: %, Published: %, Draft: %, Hidden: %', 
    total_count, published_count, draft_count, hidden_count;
END $$;
