-- =====================================================
-- CAR IMAGES SUPPORT
-- =====================================================
-- Adds support for car images in fleet management
-- =====================================================

-- 1. Ensure image_url column exists (should already exist, but let's be sure)
ALTER TABLE car_offers 
ADD COLUMN IF NOT EXISTS image_url text;

-- 2. Add image storage bucket helper comments
COMMENT ON COLUMN car_offers.image_url IS 'URL to car image - can be Supabase Storage, external CDN, or any public URL';

-- 3. Create a function to generate placeholder image URLs
CREATE OR REPLACE FUNCTION get_car_placeholder_image(p_car_type text)
RETURNS text AS $$
BEGIN
  -- Return a placeholder service URL based on car type
  -- You can replace this with your own placeholder service
  RETURN 'https://placehold.co/600x400/333/FFF?text=' || 
         REPLACE(COALESCE(p_car_type, 'Car'), ' ', '+');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Optional: Update existing cars without images to have placeholders
-- (Commented out - uncomment if you want to auto-generate placeholders)
/*
UPDATE car_offers 
SET image_url = get_car_placeholder_image(car_type)
WHERE image_url IS NULL OR image_url = '';
*/

-- =====================================================
-- Supabase Storage Setup Instructions
-- =====================================================
-- 
-- To use Supabase Storage for car images:
-- 
-- 1. In Supabase Dashboard, go to Storage
-- 2. Create a new bucket called "car-images"
-- 3. Set it to PUBLIC (or create RLS policies)
-- 4. Upload images via dashboard or API
-- 5. Use URLs like: https://your-project.supabase.co/storage/v1/object/public/car-images/filename.jpg
-- 
-- Example RLS policy for public read:
-- 
-- CREATE POLICY "Public can view car images"
-- ON storage.objects FOR SELECT
-- USING (bucket_id = 'car-images');
-- 
-- CREATE POLICY "Admins can upload car images"
-- ON storage.objects FOR INSERT
-- WITH CHECK (
--   bucket_id = 'car-images' AND
--   auth.uid() IN (SELECT id FROM profiles WHERE is_admin = true)
-- );
-- 
-- =====================================================

-- 5. Helper view for cars with image info
CREATE OR REPLACE VIEW car_offers_with_images AS
SELECT 
  co.*,
  CASE 
    WHEN co.image_url IS NOT NULL AND co.image_url != '' THEN co.image_url
    ELSE get_car_placeholder_image(co.car_type)
  END as display_image_url,
  CASE 
    WHEN co.image_url IS NOT NULL AND co.image_url != '' THEN true
    ELSE false
  END as has_custom_image
FROM car_offers co;

COMMENT ON VIEW car_offers_with_images IS 'Car offers with automatic placeholder images for cars without custom images';

-- =====================================================
-- Done! Image support added
-- =====================================================
