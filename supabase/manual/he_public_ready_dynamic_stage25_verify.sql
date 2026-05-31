-- Stage 25: verify public-ready dynamic HE scope after manual apply.
-- Read-only checks for Supabase SQL Editor.
-- This does not enable public HE, SEO, sitemap, hreflang, canonical, indexing,
-- public switchers, or public /he/ routes.

-- 1) Transport: all active route endpoint labels should resolve through
-- transport_locations.name_he.
SELECT
  'transport_routes_he' AS check_name,
  COUNT(*) AS total_routes,
  COUNT(*) FILTER (
    WHERE NULLIF(BTRIM(o.name_he), '') IS NOT NULL
      AND NULLIF(BTRIM(d.name_he), '') IS NOT NULL
  ) AS he_ready_routes
FROM public.transport_routes r
JOIN public.transport_locations o ON o.id = r.origin_location_id
JOIN public.transport_locations d ON d.id = r.destination_location_id
WHERE COALESCE(r.is_active, true) = true;

-- 2) Hotels: records plus amenity dictionary.
SELECT
  'hotels_he_records' AS check_name,
  COUNT(*) AS total_hotels,
  COUNT(*) FILTER (
    WHERE NULLIF(BTRIM(title->>'he'), '') IS NOT NULL
      AND NULLIF(BTRIM(description->>'he'), '') IS NOT NULL
  ) AS he_ready_hotels
FROM public.hotels
WHERE COALESCE(is_published, true) = true;

SELECT
  'hotel_amenities_he' AS check_name,
  COUNT(*) AS total_amenities,
  COUNT(*) FILTER (WHERE NULLIF(BTRIM(name_he), '') IS NOT NULL) AS he_ready_amenities
FROM public.hotel_amenities
WHERE COALESCE(is_active, true) = true;

-- 3) Blog: selected top posts. This verifies stored internal HE rows, but public
-- anon read remains intentionally blocked by migration 179 until final launch.
WITH selected_posts(id) AS (
  VALUES
    ('0477e103-ee8a-47b3-9b54-69757dfbc07f'::uuid),
    ('2a59c0a7-52fd-498f-b4fe-d0d76617c882'::uuid),
    ('2e88f39b-5b5c-4e04-82b5-c125f19920b3'::uuid),
    ('a021f1d4-79e9-4c9e-a6ac-d36c13bd16ef'::uuid),
    ('1c1f8eb6-c709-4302-8611-6322b5ed5fad'::uuid)
)
SELECT
  'blog_top5_he_internal' AS check_name,
  COUNT(*) AS selected_posts,
  COUNT(*) FILTER (
    WHERE t.lang = 'he'
      AND NULLIF(BTRIM(t.slug), '') IS NOT NULL
      AND NULLIF(BTRIM(t.title), '') IS NOT NULL
      AND NULLIF(BTRIM(t.meta_description), '') IS NOT NULL
      AND NULLIF(BTRIM(t.summary), '') IS NOT NULL
      AND NULLIF(BTRIM(t.lead), '') IS NOT NULL
      AND NULLIF(BTRIM(t.content_html), '') IS NOT NULL
      AND COALESCE(CARDINALITY(p.categories_he), 0) > 0
  ) AS he_ready_posts
FROM selected_posts s
JOIN public.blog_posts p ON p.id = s.id
LEFT JOIN public.blog_post_translations t
  ON t.blog_post_id = p.id
 AND t.lang = 'he';

-- 4) Trips: selected top 3.
SELECT
  'trips_top3_he' AS check_name,
  COUNT(*) AS selected_trips,
  COUNT(*) FILTER (
    WHERE NULLIF(BTRIM(title->>'he'), '') IS NOT NULL
      AND NULLIF(BTRIM(description->>'he'), '') IS NOT NULL
  ) AS he_ready_trips
FROM public.trips
WHERE id IN (
  '47fd4793-647b-45fd-a2ce-1ecaa4b95922',
  '2d937b4f-3da7-4fed-bc06-bdc66eb25612',
  'b0a24297-89f9-4f60-a1d6-b59d84bee877'
);

-- 5) Cars: selected top 5. Model names may intentionally remain brand/model
-- strings; features and optional description_i18n.he are the quality fields.
SELECT
  'cars_top5_he' AS check_name,
  COUNT(*) AS selected_cars,
  COUNT(*) FILTER (
    WHERE jsonb_typeof(COALESCE(features->'he', 'null'::jsonb)) = 'array'
      AND jsonb_array_length(features->'he') > 0
  ) AS he_feature_ready_cars
FROM public.car_offers
WHERE id IN (
  '353d8c79-eb1f-4c1e-9c4a-59febf2ea7ca',
  'b4f784d3-22d2-421a-829f-2394e3a72a76',
  '8a1158af-6b05-4723-b2eb-93b130d22f24',
  '5ba581c3-08c6-47cd-ab29-4d2b9213cebc',
  '64981eb1-e9a3-41a4-bd93-1fd4c78581d7'
);

-- 6) POI and category labels.
SELECT
  'poi_top10_he' AS check_name,
  COUNT(*) AS selected_poi,
  COUNT(*) FILTER (
    WHERE NULLIF(BTRIM(name_i18n->>'he'), '') IS NOT NULL
      AND NULLIF(BTRIM(description_i18n->>'he'), '') IS NOT NULL
      AND NULLIF(BTRIM(badge_i18n->>'he'), '') IS NOT NULL
  ) AS he_ready_poi
FROM public.pois
WHERE id IN (
  'larnaca-beach', 'limassol-marina', 'nicosia-old-town', 'Love-Bridge',
  'konnos-bay-beach', 'cape-greco-sea-caves', 'Cyclops-Cave',
  'saint-lazarus-church', 'famagusta-old-town', 'larnaca-castle'
);

SELECT
  'poi_categories_he' AS check_name,
  COUNT(*) AS total_categories,
  COUNT(*) FILTER (WHERE NULLIF(BTRIM(name_he), '') IS NOT NULL) AS he_ready_categories
FROM public.poi_categories
WHERE COALESCE(active, true) = true;

-- 7) Recommendations: all active recommendations should have title/description
-- HE after Stage 25.
SELECT
  'recommendations_he_active' AS check_name,
  COUNT(*) AS active_recommendations,
  COUNT(*) FILTER (
    WHERE NULLIF(BTRIM(r.title_he), '') IS NOT NULL
      AND NULLIF(BTRIM(r.description_he), '') IS NOT NULL
      AND NULLIF(BTRIM(c.name_he), '') IS NOT NULL
  ) AS he_ready_recommendations
FROM public.recommendations r
LEFT JOIN public.recommendation_categories c ON c.id = r.category_id
WHERE COALESCE(r.active, true) = true;

-- 8) Shop must stay outside first public HE launch.
SELECT
  'shop_he_exclusion' AS check_name,
  'Shop remains excluded from first public HE launch; do not enable switcher/checkout HE.' AS decision;
