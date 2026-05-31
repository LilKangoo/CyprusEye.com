-- Stage 25: public-ready dynamic HE content top-up.
-- Review status: needs human review for every Hebrew value before public launch.
--
-- Run manually in Supabase SQL Editor after editorial review.
-- This file is additive/idempotent:
-- - never overwrites PL/EN source content,
-- - fills only missing HE fields,
-- - does not enable public HE, switchers, SEO, sitemap, hreflang, canonical,
--   indexing, or public /he/ routes.
--
-- Expected prerequisite:
-- - supabase/manual/he_beta_content_pack_stage17_apply.sql has already been
--   reviewed and applied for the narrow beta scope.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Hotel amenities dictionary: schema + 48 HE labels.
-- ---------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.hotel_amenities
  ADD COLUMN IF NOT EXISTS name_he text;

COMMENT ON COLUMN public.hotel_amenities.name_he IS
  'Internal Hebrew hotel amenity label. Hidden until controlled Hebrew public rollout.';

UPDATE public.hotel_amenities
SET name_he = CASE
  WHEN NULLIF(BTRIM(name_he), '') IS NOT NULL THEN name_he
  ELSE CASE code
    WHEN 'wifi' THEN 'Wi-Fi חינם'
    WHEN 'parking' THEN 'חניה חינם'
    WHEN 'pool' THEN 'בריכת שחייה'
    WHEN 'breakfast' THEN 'ארוחת בוקר כלולה'
    WHEN 'air_conditioning' THEN 'מיזוג אוויר'
    WHEN 'elevator' THEN 'מעלית'
    WHEN 'family_rooms' THEN 'חדרי משפחה'
    WHEN 'non_smoking' THEN 'חדרים ללא עישון'
    WHEN 'accessibility' THEN 'נגיש לכיסאות גלגלים'
    WHEN 'luggage_storage' THEN 'שמירת מזוודות'
    WHEN 'spa' THEN 'ספא'
    WHEN 'hot_tub' THEN 'ג׳קוזי / אמבט עיסוי'
    WHEN 'sauna' THEN 'סאונה'
    WHEN 'gym' THEN 'חדר כושר'
    WHEN 'massage' THEN 'עיסוי'
    WHEN 'restaurant' THEN 'מסעדה'
    WHEN 'bar' THEN 'בר'
    WHEN 'room_service' THEN 'שירות חדרים'
    WHEN 'coffee_shop' THEN 'בית קפה'
    WHEN 'buffet' THEN 'מזנון ארוחת בוקר'
    WHEN 'private_bathroom' THEN 'חדר רחצה פרטי'
    WHEN 'balcony' THEN 'מרפסת'
    WHEN 'sea_view' THEN 'נוף לים'
    WHEN 'mountain_view' THEN 'נוף להרים'
    WHEN 'tv' THEN 'טלוויזיה עם מסך שטוח'
    WHEN 'safe' THEN 'כספת בחדר'
    WHEN 'minibar' THEN 'מיני-בר'
    WHEN 'coffee_maker' THEN 'מכונת קפה'
    WHEN 'hairdryer' THEN 'מייבש שיער'
    WHEN 'electric_bike' THEN 'אופניים חשמליים'
    WHEN 'iron' THEN 'מגהץ'
    WHEN 'kitchen' THEN 'מטבח / מטבחון'
    WHEN 'beach_access' THEN 'גישה לחוף'
    WHEN 'beachfront' THEN 'על חוף הים'
    WHEN 'garden' THEN 'גינה'
    WHEN 'terrace' THEN 'טרסה'
    WHEN 'bbq' THEN 'מתקני ברביקיו'
    WHEN 'tennis' THEN 'מגרש טניס'
    WHEN 'playground' THEN 'מגרש משחקים'
    WHEN 'reception_24h' THEN 'קבלה 24 שעות'
    WHEN 'concierge' THEN 'קונסיירז׳'
    WHEN 'airport_shuttle' THEN 'הסעה משדה התעופה'
    WHEN 'car_rental' THEN 'השכרת רכב'
    WHEN 'pets_allowed' THEN 'מותר להכניס חיות מחמד'
    WHEN 'laundry' THEN 'שירותי כביסה'
    WHEN 'daily_housekeeping' THEN 'ניקיון יומי'
    WHEN 'babysitting' THEN 'שירותי שמרטפות'
    WHEN 'kids_club' THEN 'מועדון ילדים'
    ELSE name_he
  END
END
WHERE code IN (
  'wifi', 'parking', 'pool', 'breakfast', 'air_conditioning', 'elevator',
  'family_rooms', 'non_smoking', 'accessibility', 'luggage_storage', 'spa',
  'hot_tub', 'sauna', 'gym', 'massage', 'restaurant', 'bar', 'room_service',
  'coffee_shop', 'buffet', 'private_bathroom', 'balcony', 'sea_view',
  'mountain_view', 'tv', 'safe', 'minibar', 'coffee_maker', 'hairdryer',
  'electric_bike', 'iron', 'kitchen', 'beach_access', 'beachfront', 'garden',
  'terrace', 'bbq', 'tennis', 'playground', 'reception_24h', 'concierge',
  'airport_shuttle', 'car_rental', 'pets_allowed', 'laundry',
  'daily_housekeeping', 'babysitting', 'kids_club'
);

-- ---------------------------------------------------------------------------
-- 2) Map/category dictionaries used by POI and recommendations.
-- ---------------------------------------------------------------------------

UPDATE public.poi_categories
SET name_he = CASE
  WHEN NULLIF(BTRIM(name_he), '') IS NOT NULL THEN name_he
  ELSE CASE slug
    WHEN 'uncategorized' THEN 'ללא קטגוריה'
    WHEN 'photo-video' THEN 'צילום | וידאו'
    WHEN 'shipwreck' THEN 'ספינות טרופות'
    WHEN 'religious-sites' THEN 'אתרים דתיים'
    WHEN 'accommodation' THEN 'לינה'
    WHEN 'shop' THEN 'חנויות'
    WHEN 'caffe' THEN 'בתי קפה'
    WHEN 'coffe' THEN 'בתי קפה'
    WHEN 'restaurants' THEN 'מסעדות'
    WHEN 'car-rentals' THEN 'השכרת רכב'
    WHEN 'beaches' THEN 'חופים'
    WHEN 'activities' THEN 'פעילויות'
    WHEN 'shopping' THEN 'קניות'
    WHEN 'tattoo' THEN 'קעקועים'
    WHEN 'nightlife' THEN 'חיי לילה'
    WHEN 'services' THEN 'שירותים'
    WHEN 'landmark' THEN 'אתר מרכזי'
    WHEN 'beach' THEN 'חוף'
    WHEN 'nature' THEN 'טבע'
    WHEN 'viewpoint' THEN 'נקודת תצפית'
    WHEN 'food' THEN 'אוכל ושתייה'
    WHEN 'activity' THEN 'פעילות'
    WHEN 'airport' THEN 'שדה תעופה'
    ELSE name_he
  END
END
WHERE slug IN (
  'uncategorized', 'photo-video', 'shipwreck', 'religious-sites',
  'accommodation', 'shop', 'caffe', 'coffe', 'restaurants', 'car-rentals',
  'beaches', 'activities', 'shopping', 'tattoo', 'nightlife', 'services',
  'landmark', 'beach', 'nature', 'viewpoint', 'food', 'activity', 'airport'
);

UPDATE public.recommendation_categories
SET name_he = CASE
  WHEN NULLIF(BTRIM(name_he), '') IS NOT NULL THEN name_he
  ELSE CASE name_en
    WHEN 'Shipwreck' THEN 'ספינות טרופות'
    WHEN 'Religious Sites' THEN 'אתרים דתיים'
    WHEN 'Photo | Video' THEN 'צילום | וידאו'
    WHEN 'Shop' THEN 'חנויות'
    WHEN 'Accommodation' THEN 'לינה'
    WHEN 'Restaurants' THEN 'מסעדות'
    WHEN 'Coffe' THEN 'בתי קפה'
    WHEN 'Caffe' THEN 'בתי קפה'
    WHEN 'Car Rentals' THEN 'השכרת רכב'
    WHEN 'Beaches' THEN 'חופים'
    WHEN 'Activities' THEN 'פעילויות'
    WHEN 'Shopping' THEN 'קניות'
    WHEN 'Tattoo' THEN 'קעקועים'
    WHEN 'Nightlife' THEN 'חיי לילה'
    WHEN 'Services' THEN 'שירותים'
    ELSE name_he
  END
END
WHERE name_en IN (
  'Shipwreck', 'Religious Sites', 'Photo | Video', 'Shop', 'Accommodation',
  'Restaurants', 'Coffe', 'Caffe', 'Car Rentals', 'Beaches', 'Activities',
  'Shopping', 'Tattoo', 'Nightlife', 'Services'
);

-- ---------------------------------------------------------------------------
-- 3) Complete the remaining 5 active recommendations.
-- Existing 5 featured recommendations are already covered by Stage 17.
-- ---------------------------------------------------------------------------

UPDATE public.recommendations
SET
  title_he = COALESCE(NULLIF(BTRIM(title_he), ''), 'Easy Rider Tattoo & Piercing'),
  description_he = COALESCE(NULLIF(BTRIM(description_he), ''), 'אחד מסטודיואי הקעקועים והפירסינג הגדולים והמקצועיים בקפריסין, פעיל מאז 1996 ומציע שירות בטוח, אמנים מנוסים ומגוון סגנונות.'),
  discount_text_he = COALESCE(NULLIF(BTRIM(discount_text_he), ''), '20% הנחה על קעקועים ופירסינג'),
  offer_text_he = COALESCE(NULLIF(BTRIM(offer_text_he), ''), 'הציגו את הקוד בעת הזמנה בסטודיו כדי לקבל 20% הנחה על קעקועים ופירסינג.')
WHERE id = 'fa995ace-aa71-4b83-985d-c03608807d67';

UPDATE public.recommendations
SET
  title_he = COALESCE(NULLIF(BTRIM(title_he), ''), 'LilKangooMedia'),
  description_he = COALESCE(NULLIF(BTRIM(description_he), ''), 'צלם עם 16 שנות ניסיון. צילומים מותאמים לצרכים שלכם, למיקום ולזמן הצילום בקפריסין.'),
  discount_text_he = COALESCE(NULLIF(BTRIM(discount_text_he), ''), '10% הנחה על צילומים'),
  offer_text_he = COALESCE(NULLIF(BTRIM(offer_text_he), ''), 'מסרו את קוד ההנחה בעת הזמנת הצילומים.')
WHERE id = 'd04e3a1d-1e2a-43b1-a413-7cffc5193fe8';

UPDATE public.recommendations
SET
  title_he = COALESCE(NULLIF(BTRIM(title_he), ''), 'Jello Cafe Restaurant'),
  description_he = COALESCE(NULLIF(BTRIM(description_he), ''), 'מסעדה טובה באיה נאפה עם מבחר רחב של אוכל, מתאימה לעצירה נוחה במהלך יום טיול באזור.'),
  discount_text_he = COALESCE(NULLIF(BTRIM(discount_text_he), ''), discount_text_he),
  offer_text_he = COALESCE(NULLIF(BTRIM(offer_text_he), ''), offer_text_he)
WHERE id = '26387276-f65b-4528-8bc8-8cd0977e2651';

UPDATE public.recommendations
SET
  title_he = COALESCE(NULLIF(BTRIM(title_he), ''), 'Zephyros - טברנת דגים ופירות ים בלרנקה'),
  description_he = COALESCE(NULLIF(BTRIM(description_he), ''), 'טברנת דגים מוכרת בלרנקה, ידועה בפירות ים טריים ובמזה דגים מסורתי. מקום טוב לארוחת צהריים או ערב מקומית ליד נמל הדייגים.'),
  discount_text_he = COALESCE(NULLIF(BTRIM(discount_text_he), ''), discount_text_he),
  offer_text_he = COALESCE(NULLIF(BTRIM(offer_text_he), ''), offer_text_he)
WHERE id = '449d6d6f-3153-4778-b8d6-d0ece7c264df';

UPDATE public.recommendations
SET
  title_he = COALESCE(NULLIF(BTRIM(title_he), ''), 'מטבח קפריסאי'),
  description_he = COALESCE(NULLIF(BTRIM(description_he), ''), 'מקום מצוין לטעום מזה קפריסאי מסורתי. מטבח מקומי אותנטי, מוכן מחומרי גלם מקומיים ומוגש בסגנון אי קלאסי.'),
  discount_text_he = COALESCE(NULLIF(BTRIM(discount_text_he), ''), discount_text_he),
  offer_text_he = COALESCE(NULLIF(BTRIM(offer_text_he), ''), offer_text_he)
WHERE id = '55f9272f-0539-4649-8eee-9d27a9c08a6e';

-- ---------------------------------------------------------------------------
-- Verification reads inside the transaction.
-- ---------------------------------------------------------------------------

SELECT 'hotel_amenities_he' AS check_name, COUNT(*) AS ready_rows
FROM public.hotel_amenities
WHERE code IN (
  'wifi', 'parking', 'pool', 'breakfast', 'air_conditioning', 'elevator',
  'family_rooms', 'non_smoking', 'accessibility', 'luggage_storage', 'spa',
  'hot_tub', 'sauna', 'gym', 'massage', 'restaurant', 'bar', 'room_service',
  'coffee_shop', 'buffet', 'private_bathroom', 'balcony', 'sea_view',
  'mountain_view', 'tv', 'safe', 'minibar', 'coffee_maker', 'hairdryer',
  'electric_bike', 'iron', 'kitchen', 'beach_access', 'beachfront', 'garden',
  'terrace', 'bbq', 'tennis', 'playground', 'reception_24h', 'concierge',
  'airport_shuttle', 'car_rental', 'pets_allowed', 'laundry',
  'daily_housekeeping', 'babysitting', 'kids_club'
)
  AND NULLIF(BTRIM(name_he), '') IS NOT NULL;

SELECT 'poi_categories_he' AS check_name, COUNT(*) AS ready_rows
FROM public.poi_categories
WHERE slug IN (
  'uncategorized', 'photo-video', 'shipwreck', 'religious-sites',
  'accommodation', 'shop', 'caffe', 'coffe', 'restaurants', 'car-rentals',
  'beaches', 'activities', 'shopping', 'tattoo', 'nightlife', 'services',
  'landmark', 'beach', 'nature', 'viewpoint', 'food', 'activity', 'airport'
)
  AND NULLIF(BTRIM(name_he), '') IS NOT NULL;

SELECT 'recommendation_categories_he' AS check_name, COUNT(*) AS ready_rows
FROM public.recommendation_categories
WHERE name_en IN (
  'Shipwreck', 'Religious Sites', 'Photo | Video', 'Shop', 'Accommodation',
  'Restaurants', 'Coffe', 'Caffe', 'Car Rentals', 'Beaches', 'Activities',
  'Shopping', 'Tattoo', 'Nightlife', 'Services'
)
  AND NULLIF(BTRIM(name_he), '') IS NOT NULL;

SELECT 'recommendations_he_all_active' AS check_name, COUNT(*) AS ready_rows
FROM public.recommendations
WHERE active = true
  AND NULLIF(BTRIM(title_he), '') IS NOT NULL
  AND NULLIF(BTRIM(description_he), '') IS NOT NULL;

COMMIT;
