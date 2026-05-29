-- Stage 15: narrow HE beta dynamic content draft.
-- This file is intentionally non-destructive and ends with ROLLBACK.
-- Review all Hebrew text with a native speaker before replacing ROLLBACK with COMMIT.
-- It does not enable public HE, sitemap, hreflang, canonical, SEO, indexing,
-- public switchers, or public /he/ routes.

BEGIN;

-- 1) Transport location names for narrow beta.
-- Safe additive update: fills only missing name_he, never PL/EN source names.
UPDATE public.transport_locations
SET name_he = CASE
  WHEN NULLIF(BTRIM(name_he), '') IS NOT NULL THEN name_he
  ELSE CASE code
    WHEN 'larnaca' THEN 'לרנקה'
    WHEN 'larnaca_airport' THEN 'נמל התעופה לרנקה'
    WHEN 'paphos' THEN 'פאפוס'
    WHEN 'paphos_airport' THEN 'נמל התעופה פאפוס'
    WHEN 'ayia_napa' THEN 'איה נאפה'
    WHEN 'protaras' THEN 'פרוטארס'
    WHEN 'limassol' THEN 'לימסול'
    WHEN 'nicosia' THEN 'ניקוסיה'
    WHEN 'lefkara' THEN 'לפקרה'
    ELSE name_he
  END
END
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
);

SELECT code, name, name_he
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

-- 2) Blog taxonomy for selected beta posts.
-- These are taxonomy labels only. Full HE post body should be entered through Admin/Partner.
UPDATE public.blog_posts
SET
  categories_he = CASE WHEN COALESCE(CARDINALITY(categories_he), 0) = 0 THEN ARRAY['אפיליאציה']::text[] ELSE categories_he END,
  tags_he = CASE WHEN COALESCE(CARDINALITY(tags_he), 0) = 0 THEN ARRAY['קפריסין', 'תיירות', 'אפיליאציה']::text[] ELSE tags_he END
WHERE id = '0477e103-ee8a-47b3-9b54-69757dfbc07f';

UPDATE public.blog_posts
SET
  categories_he = CASE WHEN COALESCE(CARDINALITY(categories_he), 0) = 0 THEN ARRAY['ETIAS']::text[] ELSE categories_he END,
  tags_he = CASE WHEN COALESCE(CARDINALITY(tags_he), 0) = 0 THEN ARRAY['קפריסין', 'ETIAS', 'כניסה']::text[] ELSE tags_he END
WHERE id = '2a59c0a7-52fd-498f-b4fe-d0d76617c882';

UPDATE public.blog_posts
SET
  categories_he = CASE WHEN COALESCE(CARDINALITY(categories_he), 0) = 0 THEN ARRAY['מדריך', 'לרנקה', 'איה נאפה', 'רכב', 'פאפוס', 'טרודוס', 'ניקוסיה']::text[] ELSE categories_he END,
  tags_he = CASE WHEN COALESCE(CARDINALITY(tags_he), 0) = 0 THEN ARRAY['קפריסין', 'טיולים', 'מדריך']::text[] ELSE tags_he END
WHERE id = '2e88f39b-5b5c-4e04-82b5-c125f19920b3';

UPDATE public.blog_posts
SET
  categories_he = CASE WHEN COALESCE(CARDINALITY(categories_he), 0) = 0 THEN ARRAY['רכב']::text[] ELSE categories_he END,
  tags_he = CASE WHEN COALESCE(CARDINALITY(tags_he), 0) = 0 THEN ARRAY['השכרת רכב', 'קפריסין', 'פיקדון']::text[] ELSE tags_he END
WHERE id = 'a021f1d4-79e9-4c9e-a6ac-d36c13bd16ef';

UPDATE public.blog_posts
SET
  categories_he = CASE WHEN COALESCE(CARDINALITY(categories_he), 0) = 0 THEN ARRAY['מדריך', 'לרנקה', 'פאפוס']::text[] ELSE categories_he END,
  tags_he = CASE WHEN COALESCE(CARDINALITY(tags_he), 0) = 0 THEN ARRAY['קפריסין', 'לרנקה', 'פאפוס']::text[] ELSE tags_he END
WHERE id = '1c1f8eb6-c709-4302-8611-6322b5ed5fad';

SELECT id, categories_en, categories_he, tags_en, tags_he
FROM public.blog_posts
WHERE id IN (
  '0477e103-ee8a-47b3-9b54-69757dfbc07f',
  '2a59c0a7-52fd-498f-b4fe-d0d76617c882',
  '2e88f39b-5b5c-4e04-82b5-c125f19920b3',
  'a021f1d4-79e9-4c9e-a6ac-d36c13bd16ef',
  '1c1f8eb6-c709-4302-8611-6322b5ed5fad'
)
ORDER BY updated_at DESC NULLS LAST;

-- 3) Blog HE body translations.
-- Prefer Admin/Partner editor for these rows so content_json/content_html stay consistent.
-- Required fields per post:
-- slug, title, meta_description, summary, lead, content_json, content_html.
--
-- Selected posts:
-- 0477e103-ee8a-47b3-9b54-69757dfbc07f affiliate/tourism
-- 2a59c0a7-52fd-498f-b4fe-d0d76617c882 ETIAS
-- 2e88f39b-5b5c-4e04-82b5-c125f19920b3 Cyprus in 7 days
-- a021f1d4-79e9-4c9e-a6ac-d36c13bd16ef car rental without deposit
-- 1c1f8eb6-c709-4302-8611-6322b5ed5fad Larnaca vs Paphos

-- 4) POI/recommendations.
-- Do not paste placeholder descriptions into production.
-- Use Admin/manual reviewed updates for selected records listed in:
-- docs/he-beta-dynamic-content-scope.md

-- Keep this rollback until all values are reviewed.
ROLLBACK;
