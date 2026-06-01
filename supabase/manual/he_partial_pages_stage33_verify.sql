-- Stage 33: read-only verification for PARTIAL page record-level HE readiness.
-- Run after supabase/manual/he_partial_pages_stage33.sql is committed manually.
--
-- This file does not enable public HE, SEO HE, sitemap HE, hreflang HE,
-- canonical HE, indexing HE, Shop HE, Blog HE, or public /he/ routes.

-- 1) Trips: only these 3 records should be considered HE-ready for the first
-- record-gated trip expansion.
SELECT
  'stage33_trips_top3' AS check_name,
  COUNT(*) AS selected_records,
  COUNT(*) FILTER (
    WHERE NULLIF(BTRIM(title->>'he'), '') IS NOT NULL
      AND NULLIF(BTRIM(description->>'he'), '') IS NOT NULL
  ) AS he_ready_records
FROM public.trips
WHERE id IN (
  '47fd4793-647b-45fd-a2ce-1ecaa4b95922',
  '2d937b4f-3da7-4fed-bc06-bdc66eb25612',
  'b0a24297-89f9-4f60-a1d6-b59d84bee877'
);

SELECT
  id,
  slug,
  title->>'he' AS title_he,
  LEFT(REGEXP_REPLACE(COALESCE(description->>'he', ''), '\s+', ' ', 'g'), 180) AS description_he_preview,
  CASE
    WHEN NULLIF(BTRIM(title->>'he'), '') IS NOT NULL
      AND NULLIF(BTRIM(description->>'he'), '') IS NOT NULL
    THEN 'he_ready'
    ELSE 'missing_he'
  END AS readiness
FROM public.trips
WHERE id IN (
  '47fd4793-647b-45fd-a2ce-1ecaa4b95922',
  '2d937b4f-3da7-4fed-bc06-bdc66eb25612',
  'b0a24297-89f9-4f60-a1d6-b59d84bee877'
)
ORDER BY sort_order NULLS LAST, created_at DESC NULLS LAST;

-- 2) Cars: model names may stay brand/model strings, but features.he must be
-- present for candidate-ready HE car rendering.
SELECT
  'stage33_cars_top5' AS check_name,
  COUNT(*) AS selected_records,
  COUNT(*) FILTER (
    WHERE jsonb_typeof(COALESCE(features->'he', 'null'::jsonb)) = 'array'
      AND jsonb_array_length(features->'he') > 0
  ) AS he_ready_records
FROM public.car_offers
WHERE id IN (
  '353d8c79-eb1f-4c1e-9c4a-59febf2ea7ca',
  '5ba581c3-08c6-47cd-ab29-4d2b9213cebc',
  '64981eb1-e9a3-41a4-bd93-1fd4c78581d7',
  '8a1158af-6b05-4723-b2eb-93b130d22f24',
  'b4f784d3-22d2-421a-829f-2394e3a72a76'
);

SELECT
  id,
  COALESCE(car_model, car_type, car_model_new, car_type_new, id::text) AS model_label,
  features->'he' AS features_he,
  CASE
    WHEN jsonb_typeof(COALESCE(features->'he', 'null'::jsonb)) = 'array'
      AND jsonb_array_length(features->'he') > 0
    THEN 'he_ready'
    ELSE 'missing_he_features'
  END AS readiness
FROM public.car_offers
WHERE id IN (
  '353d8c79-eb1f-4c1e-9c4a-59febf2ea7ca',
  '5ba581c3-08c6-47cd-ab29-4d2b9213cebc',
  '64981eb1-e9a3-41a4-bd93-1fd4c78581d7',
  '8a1158af-6b05-4723-b2eb-93b130d22f24',
  'b4f784d3-22d2-421a-829f-2394e3a72a76'
)
ORDER BY sort_order NULLS LAST, created_at DESC NULLS LAST;

-- 3) POI/map: only these 10 POI should be shown in a future record-gated HE
-- map unless a conscious fallback decision is made.
SELECT
  'stage33_poi_top10' AS check_name,
  COUNT(*) AS selected_records,
  COUNT(*) FILTER (
    WHERE NULLIF(BTRIM(name_i18n->>'he'), '') IS NOT NULL
      AND NULLIF(BTRIM(description_i18n->>'he'), '') IS NOT NULL
      AND NULLIF(BTRIM(badge_i18n->>'he'), '') IS NOT NULL
  ) AS he_ready_records
FROM public.pois
WHERE id IN (
  'larnaca-beach', 'limassol-marina', 'nicosia-old-town', 'Love-Bridge',
  'konnos-bay-beach', 'cape-greco-sea-caves', 'Cyclops-Cave',
  'saint-lazarus-church', 'famagusta-old-town', 'larnaca-castle'
);

SELECT
  id,
  name_i18n->>'he' AS name_he,
  LEFT(REGEXP_REPLACE(COALESCE(description_i18n->>'he', ''), '\s+', ' ', 'g'), 160) AS description_he_preview,
  badge_i18n->>'he' AS badge_he,
  CASE
    WHEN NULLIF(BTRIM(name_i18n->>'he'), '') IS NOT NULL
      AND NULLIF(BTRIM(description_i18n->>'he'), '') IS NOT NULL
      AND NULLIF(BTRIM(badge_i18n->>'he'), '') IS NOT NULL
    THEN 'he_ready'
    ELSE 'missing_he'
  END AS readiness
FROM public.pois
WHERE id IN (
  'larnaca-beach', 'limassol-marina', 'nicosia-old-town', 'Love-Bridge',
  'konnos-bay-beach', 'cape-greco-sea-caves', 'Cyclops-Cave',
  'saint-lazarus-church', 'famagusta-old-town', 'larnaca-castle'
)
ORDER BY id;

-- 4) Public launch exclusions remain intentional.
SELECT
  'stage33_exclusions' AS check_name,
  'Blog remains BLOCKED; Shop/cart/checkout/payment remain EXCLUDED; SEO HE remains off.' AS decision;
