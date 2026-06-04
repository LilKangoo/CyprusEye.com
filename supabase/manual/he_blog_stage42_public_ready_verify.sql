-- Stage 42: verify Blog HE top-five public_ready rows after manual apply.
-- Read-only checks for Supabase SQL Editor.
--
-- This does not enable global HE, SEO HE, sitemap HE, hreflang HE,
-- canonical HE, indexing HE, Shop HE, or public /he/ routes.

-- 1) Top-five public-ready state. Expected: public_ready_he_rows = 5.
WITH selected_posts(id, label, source_slug) AS (
  VALUES
    ('0477e103-ee8a-47b3-9b54-69757dfbc07f'::uuid, 'affiliate_tourism', 'how-to-earn-from-tourism-in-cyprus-cypruseye-affiliate-system'),
    ('2a59c0a7-52fd-498f-b4fe-d0d76617c882'::uuid, 'etias_cyprus_2026', 'etias-cyprus-2026'),
    ('2e88f39b-5b5c-4e04-82b5-c125f19920b3'::uuid, 'cyprus_in_7_days', 'cyprus-in-7-days-itinerary'),
    ('a021f1d4-79e9-4c9e-a6ac-d36c13bd16ef'::uuid, 'car_rental_no_deposit', 'car-rental-cyprus-no-deposit'),
    ('1c1f8eb6-c709-4302-8611-6322b5ed5fad'::uuid, 'larnaca_vs_paphos', 'larnaca-or-paphos-where-to-stay')
)
SELECT
  sp.label,
  p.id,
  COALESCE(en.slug, pl.slug, sp.source_slug, p.id::text) AS source_slug,
  he.slug AS he_slug,
  he.title AS he_title,
  he.lead AS he_lead,
  LEFT(REGEXP_REPLACE(COALESCE(he.content_html, ''), '<[^>]*>', ' ', 'g'), 160) AS he_content_preview,
  p.categories_he,
  p.tags_he,
  COALESCE(he.review_status, 'missing') AS review_status,
  he.reviewed_at,
  p.status,
  p.submission_status,
  p.published_at,
  CASE
    WHEN p.status = 'published'
      AND p.submission_status = 'approved'
      AND p.published_at IS NOT NULL
      AND p.published_at <= now()
      AND he.lang = 'he'
      AND he.review_status = 'public_ready'
      AND NULLIF(BTRIM(he.slug), '') IS NOT NULL
      AND NULLIF(BTRIM(he.title), '') IS NOT NULL
      AND NULLIF(BTRIM(he.meta_title), '') IS NOT NULL
      AND NULLIF(BTRIM(he.meta_description), '') IS NOT NULL
      AND NULLIF(BTRIM(he.summary), '') IS NOT NULL
      AND NULLIF(BTRIM(he.lead), '') IS NOT NULL
      AND NULLIF(BTRIM(he.content_html), '') IS NOT NULL
      AND COALESCE(CARDINALITY(p.categories_he), 0) > 0
      AND COALESCE(CARDINALITY(p.tags_he), 0) > 0
      THEN 'public_ready'
    WHEN he.blog_post_id IS NOT NULL THEN 'not_public_ready'
    ELSE 'missing_he'
  END AS readiness
FROM selected_posts sp
LEFT JOIN public.blog_posts p
  ON p.id = sp.id
LEFT JOIN public.blog_post_translations he
  ON he.blog_post_id = p.id AND he.lang = 'he'
LEFT JOIN public.blog_post_translations en
  ON en.blog_post_id = p.id AND en.lang = 'en'
LEFT JOIN public.blog_post_translations pl
  ON pl.blog_post_id = p.id AND pl.lang = 'pl'
ORDER BY sp.label;

-- 2) Summary. Expected: selected_posts=5, he_rows=5, public_ready_he_rows=5.
WITH selected_posts(id) AS (
  VALUES
    ('0477e103-ee8a-47b3-9b54-69757dfbc07f'::uuid),
    ('2a59c0a7-52fd-498f-b4fe-d0d76617c882'::uuid),
    ('2e88f39b-5b5c-4e04-82b5-c125f19920b3'::uuid),
    ('a021f1d4-79e9-4c9e-a6ac-d36c13bd16ef'::uuid),
    ('1c1f8eb6-c709-4302-8611-6322b5ed5fad'::uuid)
)
SELECT
  'stage42_blog_top5_public_ready' AS check_name,
  COUNT(*) AS selected_posts,
  COUNT(*) FILTER (WHERE he.lang = 'he') AS he_rows,
  COUNT(*) FILTER (
    WHERE p.status = 'published'
      AND p.submission_status = 'approved'
      AND p.published_at IS NOT NULL
      AND p.published_at <= now()
      AND he.review_status = 'public_ready'
      AND NULLIF(BTRIM(he.slug), '') IS NOT NULL
      AND NULLIF(BTRIM(he.title), '') IS NOT NULL
      AND NULLIF(BTRIM(he.meta_title), '') IS NOT NULL
      AND NULLIF(BTRIM(he.meta_description), '') IS NOT NULL
      AND NULLIF(BTRIM(he.summary), '') IS NOT NULL
      AND NULLIF(BTRIM(he.lead), '') IS NOT NULL
      AND NULLIF(BTRIM(he.content_html), '') IS NOT NULL
      AND COALESCE(CARDINALITY(p.categories_he), 0) > 0
      AND COALESCE(CARDINALITY(p.tags_he), 0) > 0
  ) AS public_ready_he_rows
FROM selected_posts sp
LEFT JOIN public.blog_posts p
  ON p.id = sp.id
LEFT JOIN public.blog_post_translations he
  ON he.blog_post_id = p.id AND he.lang = 'he';

-- 3) HE duplicate slugs. Expected: zero rows.
SELECT
  'stage42_blog_he_duplicate_slugs' AS check_name,
  lang,
  slug,
  COUNT(*) AS duplicate_count
FROM public.blog_post_translations
WHERE lang = 'he'
  AND NULLIF(BTRIM(slug), '') IS NOT NULL
GROUP BY lang, slug
HAVING COUNT(*) > 1
ORDER BY slug;

-- 4) Draft/pending/internal HE rows must not become public-ready. Expected: zero rows.
SELECT
  'stage42_blog_public_ready_parent_not_public' AS check_name,
  he.blog_post_id,
  he.slug,
  p.status,
  p.submission_status,
  p.published_at,
  he.review_status
FROM public.blog_post_translations he
JOIN public.blog_posts p
  ON p.id = he.blog_post_id
WHERE he.lang = 'he'
  AND he.review_status = 'public_ready'
  AND (
    p.status <> 'published'
    OR p.submission_status <> 'approved'
    OR p.published_at IS NULL
    OR p.published_at > now()
  )
ORDER BY he.slug;

-- 5) Decision helper.
SELECT
  'stage42_blog_record_gated_decision' AS check_name,
  'Proceed to Blog record-gated smoke only when stage42_blog_top5_public_ready.public_ready_he_rows = 5, duplicate slug check returns zero rows, and parent_not_public check returns zero rows. SEO HE remains off.' AS decision;
