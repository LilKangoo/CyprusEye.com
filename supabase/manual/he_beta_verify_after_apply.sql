-- Stage 17: verify controlled HE beta content after manual apply.
-- Read-only checks for Supabase SQL Editor.
-- This does not enable public HE, SEO, sitemap, hreflang, canonical, indexing,
-- public switchers, or public /he/ routes.

-- 1) Blog beta posts.
SELECT
  p.id,
  COALESCE(he.slug, en.slug, pl.slug, p.id::text) AS slug,
  he.title AS he_title,
  he.meta_description AS he_meta_description,
  he.summary AS he_summary,
  he.lead AS he_lead,
  LEFT(REGEXP_REPLACE(COALESCE(he.content_html, ''), '<[^>]*>', ' ', 'g'), 160) AS he_content_preview,
  p.categories_he,
  p.tags_he,
  CASE
    WHEN NULLIF(BTRIM(he.slug), '') IS NOT NULL
      AND NULLIF(BTRIM(he.title), '') IS NOT NULL
      AND NULLIF(BTRIM(he.meta_description), '') IS NOT NULL
      AND NULLIF(BTRIM(he.summary), '') IS NOT NULL
      AND NULLIF(BTRIM(he.lead), '') IS NOT NULL
      AND NULLIF(BTRIM(he.content_html), '') IS NOT NULL
      AND COALESCE(CARDINALITY(p.categories_he), 0) > 0
      THEN 'he_complete'
    WHEN he.blog_post_id IS NOT NULL THEN 'he_partial'
    WHEN en.blog_post_id IS NOT NULL THEN 'en_fallback'
    WHEN pl.blog_post_id IS NOT NULL THEN 'pl_fallback'
    ELSE 'missing'
  END AS fallback_status
FROM public.blog_posts p
LEFT JOIN public.blog_post_translations he
  ON he.blog_post_id = p.id AND he.lang = 'he'
LEFT JOIN public.blog_post_translations en
  ON en.blog_post_id = p.id AND en.lang = 'en'
LEFT JOIN public.blog_post_translations pl
  ON pl.blog_post_id = p.id AND pl.lang = 'pl'
WHERE p.id IN (
  '0477e103-ee8a-47b3-9b54-69757dfbc07f',
  '2a59c0a7-52fd-498f-b4fe-d0d76617c882',
  '2e88f39b-5b5c-4e04-82b5-c125f19920b3',
  'a021f1d4-79e9-4c9e-a6ac-d36c13bd16ef',
  '1c1f8eb6-c709-4302-8611-6322b5ed5fad'
)
ORDER BY p.updated_at DESC NULLS LAST;

-- 2) Transport locations.
SELECT
  id,
  code AS slug,
  name_he AS he_field,
  name AS fallback_name,
  CASE
    WHEN NULLIF(BTRIM(name_he), '') IS NOT NULL THEN 'he_complete'
    WHEN NULLIF(BTRIM(name), '') IS NOT NULL THEN 'en_fallback'
    ELSE 'missing'
  END AS fallback_status
FROM public.transport_locations
WHERE code IN (
  'larnaca',
  'larnaca_airport',
  'paphos',
  'paphos_airport',
  'ayia_napa',
  'protaras',
  'limassol',
  'nicosia',
  'lefkara'
)
ORDER BY code;

-- 3) POI beta records.
SELECT
  id,
  id AS slug,
  name_i18n->>'he' AS he_name,
  description_i18n->>'he' AS he_description,
  badge_i18n->>'he' AS he_badge,
  COALESCE(name_i18n->>'en', name) AS fallback_name,
  CASE
    WHEN NULLIF(BTRIM(name_i18n->>'he'), '') IS NOT NULL
      AND NULLIF(BTRIM(description_i18n->>'he'), '') IS NOT NULL
      AND NULLIF(BTRIM(badge_i18n->>'he'), '') IS NOT NULL
      THEN 'he_complete'
    WHEN NULLIF(BTRIM(name_i18n->>'he'), '') IS NOT NULL
      OR NULLIF(BTRIM(description_i18n->>'he'), '') IS NOT NULL
      OR NULLIF(BTRIM(badge_i18n->>'he'), '') IS NOT NULL
      THEN 'he_partial'
    WHEN NULLIF(BTRIM(COALESCE(name_i18n->>'en', name)), '') IS NOT NULL THEN 'en_fallback'
    ELSE 'missing'
  END AS fallback_status
FROM public.pois
WHERE id IN (
  'larnaca-beach',
  'limassol-marina',
  'nicosia-old-town',
  'Love-Bridge',
  'konnos-bay-beach',
  'cape-greco-sea-caves',
  'Cyclops-Cave',
  'saint-lazarus-church',
  'famagusta-old-town',
  'larnaca-castle'
)
ORDER BY id;

-- 4) Recommendations beta records.
SELECT
  r.id,
  r.id AS slug,
  r.title_he AS he_title,
  r.description_he AS he_description,
  r.discount_text_he AS he_discount,
  r.offer_text_he AS he_offer,
  c.name_he AS he_category,
  COALESCE(r.title_en, r.title_pl) AS fallback_title,
  CASE
    WHEN NULLIF(BTRIM(r.title_he), '') IS NOT NULL
      AND NULLIF(BTRIM(r.description_he), '') IS NOT NULL
      AND NULLIF(BTRIM(c.name_he), '') IS NOT NULL
      THEN 'he_complete'
    WHEN NULLIF(BTRIM(r.title_he), '') IS NOT NULL
      OR NULLIF(BTRIM(r.description_he), '') IS NOT NULL
      OR NULLIF(BTRIM(c.name_he), '') IS NOT NULL
      THEN 'he_partial'
    WHEN NULLIF(BTRIM(COALESCE(r.title_en, r.title_pl)), '') IS NOT NULL THEN 'en_fallback'
    ELSE 'missing'
  END AS fallback_status
FROM public.recommendations r
LEFT JOIN public.recommendation_categories c
  ON c.id = r.category_id
WHERE r.id IN (
  'c085ebc6-1de8-4963-954a-8c67b56db892',
  '6013a7c6-f8a1-4259-8286-fb43a88f3a53',
  'feaf6154-bc82-4208-a0c6-21d6ada9e5af',
  '7451b6d5-9f5e-466e-8256-acb401650c3b',
  'd7bf97d4-7175-4fee-bbea-eb491d72e101'
)
ORDER BY r.id;

-- 5) Trips beta records.
SELECT
  id,
  slug,
  title->>'he' AS he_title,
  description->>'he' AS he_description,
  COALESCE(title->>'en', title->>'pl') AS fallback_title,
  CASE
    WHEN NULLIF(BTRIM(title->>'he'), '') IS NOT NULL
      AND NULLIF(BTRIM(description->>'he'), '') IS NOT NULL
      THEN 'he_complete'
    WHEN NULLIF(BTRIM(title->>'he'), '') IS NOT NULL
      OR NULLIF(BTRIM(description->>'he'), '') IS NOT NULL
      THEN 'he_partial'
    WHEN NULLIF(BTRIM(title->>'en'), '') IS NOT NULL THEN 'en_fallback'
    WHEN NULLIF(BTRIM(title->>'pl'), '') IS NOT NULL THEN 'pl_fallback'
    ELSE 'missing'
  END AS fallback_status
FROM public.trips
WHERE id IN (
  '47fd4793-647b-45fd-a2ce-1ecaa4b95922',
  '2d937b4f-3da7-4fed-bc06-bdc66eb25612',
  'b0a24297-89f9-4f60-a1d6-b59d84bee877'
)
ORDER BY slug;

-- 6) Hotels beta records.
SELECT
  id,
  slug,
  title->>'he' AS he_title,
  description->>'he' AS he_description,
  COALESCE(title->>'en', title->>'pl') AS fallback_title,
  CASE
    WHEN NULLIF(BTRIM(title->>'he'), '') IS NOT NULL
      AND NULLIF(BTRIM(description->>'he'), '') IS NOT NULL
      THEN 'he_complete'
    WHEN NULLIF(BTRIM(title->>'he'), '') IS NOT NULL
      OR NULLIF(BTRIM(description->>'he'), '') IS NOT NULL
      THEN 'he_partial'
    WHEN NULLIF(BTRIM(title->>'en'), '') IS NOT NULL THEN 'en_fallback'
    WHEN NULLIF(BTRIM(title->>'pl'), '') IS NOT NULL THEN 'pl_fallback'
    ELSE 'missing'
  END AS fallback_status
FROM public.hotels
WHERE id IN (
  'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1',
  '9b6d99a0-923a-4fbc-be54-c066e856e6ca'
)
ORDER BY slug;

-- 7) Cars beta records.
SELECT
  id,
  id AS slug,
  car_model->>'he' AS he_model,
  features->'he' AS he_features,
  COALESCE(car_model->>'en', car_model->>'pl') AS fallback_model,
  CASE
    WHEN NULLIF(BTRIM(car_model->>'he'), '') IS NOT NULL
      AND jsonb_typeof(features->'he') = 'array'
      AND jsonb_array_length(features->'he') > 0
      THEN 'he_complete'
    WHEN NULLIF(BTRIM(car_model->>'he'), '') IS NOT NULL
      OR (jsonb_typeof(features->'he') = 'array' AND jsonb_array_length(features->'he') > 0)
      THEN 'he_partial'
    WHEN NULLIF(BTRIM(car_model->>'en'), '') IS NOT NULL THEN 'en_fallback'
    WHEN NULLIF(BTRIM(car_model->>'pl'), '') IS NOT NULL THEN 'pl_fallback'
    ELSE 'missing'
  END AS fallback_status
FROM public.car_offers
WHERE id IN (
  '353d8c79-eb1f-4c1e-9c4a-59febf2ea7ca',
  'b4f784d3-22d2-421a-829f-2394e3a72a76',
  '8a1158af-6b05-4723-b2eb-93b130d22f24',
  '5ba581c3-08c6-47cd-ab29-4d2b9213cebc',
  '64981eb1-e9a3-41a4-bd93-1fd4c78581d7'
)
ORDER BY id;
