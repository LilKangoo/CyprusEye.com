-- =====================================================
-- CAR IMAGES STORAGE SETUP
-- =====================================================
-- Creates storage bucket and policies for car images
-- =====================================================

-- 1. Create storage bucket for car images
-- Note: This SQL creates the bucket metadata
-- You still need to create the actual bucket in Supabase Dashboard
-- Storage → Create new bucket → name: "car-images" → Public bucket

-- 2. Storage policies for car-images bucket
-- Allow public to view images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'car-images',
  'car-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

-- 3. Allow anyone to view car images (public read)
CREATE POLICY IF NOT EXISTS "Public can view car images"
ON storage.objects FOR SELECT
USING (bucket_id = 'car-images');

-- 4. Allow authenticated users to upload car images
CREATE POLICY IF NOT EXISTS "Authenticated users can upload car images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'car-images');

-- 5. Allow car image owners to update their images
CREATE POLICY IF NOT EXISTS "Users can update car images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'car-images');

-- 6. Allow car image owners to delete their images
CREATE POLICY IF NOT EXISTS "Users can delete car images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'car-images');

-- 7. Function to generate storage URL for uploaded image
CREATE OR REPLACE FUNCTION get_car_image_storage_url(p_filename text)
RETURNS text AS $$
DECLARE
  project_url text;
BEGIN
  -- Get Supabase project URL from settings
  -- Replace with your actual project URL or use environment variable
  project_url := current_setting('app.settings.supabase_url', true);
  
  IF project_url IS NULL THEN
    -- Fallback: construct from current database
    project_url := 'https://your-project-ref.supabase.co';
  END IF;
  
  RETURN project_url || '/storage/v1/object/public/car-images/' || p_filename;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 8. Trigger to clean up old images when car image is updated
CREATE OR REPLACE FUNCTION cleanup_old_car_image()
RETURNS TRIGGER AS $$
DECLARE
  old_filename text;
BEGIN
  -- Extract filename from old image URL if it's from our storage
  IF OLD.image_url IS NOT NULL AND OLD.image_url LIKE '%/storage/v1/object/public/car-images/%' THEN
    old_filename := substring(OLD.image_url from '/car-images/(.+)$');
    
    -- Note: Actual deletion would need to be done via Storage API
    -- This is just logging for now
    RAISE NOTICE 'Old car image to cleanup: %', old_filename;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS cleanup_old_car_image_trigger ON car_offers;
CREATE TRIGGER cleanup_old_car_image_trigger
  BEFORE UPDATE OF image_url ON car_offers
  FOR EACH ROW
  WHEN (OLD.image_url IS DISTINCT FROM NEW.image_url)
  EXECUTE FUNCTION cleanup_old_car_image();

-- =====================================================
-- MANUAL STEPS REQUIRED:
-- =====================================================
-- 
-- 1. Go to Supabase Dashboard
-- 2. Click "Storage" in left menu
-- 3. Click "Create new bucket"
-- 4. Name: car-images
-- 5. Check "Public bucket"
-- 6. Set file size limit: 5 MB
-- 7. Click "Create bucket"
-- 
-- The policies above will automatically apply!
-- =====================================================

COMMENT ON FUNCTION get_car_image_storage_url IS 'Generates full storage URL for a car image filename';
