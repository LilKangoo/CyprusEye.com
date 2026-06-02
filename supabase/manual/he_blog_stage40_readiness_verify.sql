-- Stage 40: Blog HE public-readiness verification.
-- Read-only checks for Supabase SQL Editor.
--
-- This does not enable public Blog HE, global HE, SEO HE, sitemap HE,
-- hreflang HE, canonical HE, indexing HE, Shop HE, or public /he/ routes.

-- 1) Confirm migration 179 shape: lang='he' is allowed for internal rows.
SELECT
  'blog_translation_lang_constraint' AS check_name,
  conname,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.blog_post_translations'::regclass
  AND conname = 'blog_post_translations_lang_check';

-- Expected: CHECK includes pl, en and he.

-- 2) Confirm current public read policy still blocks HE.
SELECT
  'blog_translation_public_policy' AS check_name,
  policyname,
  cmd,
  roles,
  qual,
  CASE
    WHEN qual ILIKE '%lang%he%' OR qual ILIKE '%he%lang%' THEN 'review_policy_for_he_exposure'
    WHEN qual ILIKE '%pl%' AND qual ILIKE '%en%' THEN 'he_still_blocked_by_policy'
    ELSE 'manual_review_required'
  END AS expected_status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'blog_post_translations'
  AND policyname = 'blog_post_translations_public_read';

-- 3) Check whether a review/public-ready field already exists.
SELECT
  'blog_translation_review_columns' AS check_name,
  COUNT(*) FILTER (WHERE column_name = 'review_status') AS has_review_status,
  COUNT(*) FILTER (WHERE column_name = 'reviewed_at') AS has_reviewed_at,
  COUNT(*) FILTER (WHERE column_name = 'reviewed_by') AS has_reviewed_by
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'blog_post_translations'
  AND column_name IN ('review_status', 'reviewed_at', 'reviewed_by');

-- 4) Top 5 Blog HE readiness. These rows were prepared for narrow beta, but
-- remain internal until public read and page-gated Blog rollout are approved.
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
  he.meta_title AS he_meta_title,
  he.meta_description AS he_meta_description,
  he.summary AS he_summary,
  he.lead AS he_lead,
  LENGTH(REGEXP_REPLACE(COALESCE(he.content_html, ''), '<[^>]*>', ' ', 'g')) AS he_plain_text_length,
  p.categories_he,
  p.tags_he,
  p.status,
  p.submission_status,
  p.published_at,
  CASE
    WHEN p.status = 'published'
      AND p.submission_status = 'approved'
      AND p.published_at IS NOT NULL
      AND p.published_at <= now()
      AND he.lang = 'he'
      AND NULLIF(BTRIM(he.slug), '') IS NOT NULL
      AND NULLIF(BTRIM(he.title), '') IS NOT NULL
      AND NULLIF(BTRIM(he.meta_title), '') IS NOT NULL
      AND NULLIF(BTRIM(he.meta_description), '') IS NOT NULL
      AND NULLIF(BTRIM(he.summary), '') IS NOT NULL
      AND NULLIF(BTRIM(he.lead), '') IS NOT NULL
      AND NULLIF(BTRIM(he.content_html), '') IS NOT NULL
      AND COALESCE(CARDINALITY(p.categories_he), 0) > 0
      AND COALESCE(CARDINALITY(p.tags_he), 0) > 0
      THEN 'candidate_complete_needs_public_ready_gate'
    WHEN he.blog_post_id IS NOT NULL THEN 'he_partial_or_unreviewed'
    WHEN en.blog_post_id IS NOT NULL THEN 'en_fallback_only'
    WHEN pl.blog_post_id IS NOT NULL THEN 'pl_fallback_only'
    ELSE 'missing'
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

-- 5) Top 5 summary. Stage 41 should not proceed unless candidate_complete = 5.
WITH selected_posts(id) AS (
  VALUES
    ('0477e103-ee8a-47b3-9b54-69757dfbc07f'::uuid),
    ('2a59c0a7-52fd-498f-b4fe-d0d76617c882'::uuid),
    ('2e88f39b-5b5c-4e04-82b5-c125f19920b3'::uuid),
    ('a021f1d4-79e9-4c9e-a6ac-d36c13bd16ef'::uuid),
    ('1c1f8eb6-c709-4302-8611-6322b5ed5fad'::uuid)
)
SELECT
  'blog_top5_he_readiness' AS check_name,
  COUNT(*) AS selected_posts,
  COUNT(*) FILTER (WHERE he.lang = 'he') AS he_rows,
  COUNT(*) FILTER (
    WHERE p.status = 'published'
      AND p.submission_status = 'approved'
      AND p.published_at IS NOT NULL
      AND p.published_at <= now()
      AND NULLIF(BTRIM(he.slug), '') IS NOT NULL
      AND NULLIF(BTRIM(he.title), '') IS NOT NULL
      AND NULLIF(BTRIM(he.meta_title), '') IS NOT NULL
      AND NULLIF(BTRIM(he.meta_description), '') IS NOT NULL
      AND NULLIF(BTRIM(he.summary), '') IS NOT NULL
      AND NULLIF(BTRIM(he.lead), '') IS NOT NULL
      AND NULLIF(BTRIM(he.content_html), '') IS NOT NULL
      AND COALESCE(CARDINALITY(p.categories_he), 0) > 0
      AND COALESCE(CARDINALITY(p.tags_he), 0) > 0
  ) AS candidate_complete,
  COUNT(*) FILTER (
    WHERE p.status = 'published'
      AND p.submission_status = 'approved'
      AND p.published_at IS NOT NULL
      AND p.published_at <= now()
  ) AS parent_public_ready
FROM selected_posts sp
LEFT JOIN public.blog_posts p
  ON p.id = sp.id
LEFT JOIN public.blog_post_translations he
  ON he.blog_post_id = p.id AND he.lang = 'he';

-- 6) Slug safety for HE rows.
SELECT
  'blog_he_duplicate_slugs' AS check_name,
  lang,
  slug,
  COUNT(*) AS duplicate_count
FROM public.blog_post_translations
WHERE lang = 'he'
  AND NULLIF(BTRIM(slug), '') IS NOT NULL
GROUP BY lang, slug
HAVING COUNT(*) > 1
ORDER BY slug;

-- Expected: zero rows.

-- 7) CTA risk for top 5. Shop/blocked CTAs must be normalized to EN/LTR or
-- filtered before Blog HE becomes public.
WITH selected_posts(id, label) AS (
  VALUES
    ('0477e103-ee8a-47b3-9b54-69757dfbc07f'::uuid, 'affiliate_tourism'),
    ('2a59c0a7-52fd-498f-b4fe-d0d76617c882'::uuid, 'etias_cyprus_2026'),
    ('2e88f39b-5b5c-4e04-82b5-c125f19920b3'::uuid, 'cyprus_in_7_days'),
    ('a021f1d4-79e9-4c9e-a6ac-d36c13bd16ef'::uuid, 'car_rental_no_deposit'),
    ('1c1f8eb6-c709-4302-8611-6322b5ed5fad'::uuid, 'larnaca_vs_paphos')
)
SELECT
  sp.label,
  p.id,
  p.cta_services,
  CASE
    WHEN p.cta_services::text ILIKE '%shop%' THEN 'contains_shop_or_product_cta_review_required'
    WHEN p.cta_services::text ILIKE '%blog%' THEN 'contains_blog_cta_review_required'
    WHEN p.cta_services IS NULL THEN 'no_cta'
    ELSE 'cta_ok_or_ready_page'
  END AS cta_risk
FROM selected_posts sp
JOIN public.blog_posts p
  ON p.id = sp.id
ORDER BY sp.label;

-- 8) Current Stage 40 decision.
SELECT
  'stage40_blog_public_decision' AS check_name,
  'Blog remains BLOCKED until top 5 rows are reviewed, public-read is gated by review_status, list/detail record-gating is implemented, and SEO HE remains off.' AS decision;
