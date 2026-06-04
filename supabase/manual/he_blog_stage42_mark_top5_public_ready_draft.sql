-- Stage 42 DRAFT: mark reviewed top-five Blog HE translations public_ready.
-- Safe preview only. This file ends with ROLLBACK.
--
-- Run only after:
-- 1) supabase/manual/he_blog_stage41_public_read_apply.sql has been committed,
-- 2) every Hebrew value below has been reviewed by a human/native speaker,
-- 3) Blog list/detail record-gating has passed local tests.
--
-- This does not enable global HE, SEO HE, sitemap HE, hreflang HE,
-- canonical HE, indexing HE, Shop HE, or public /he/ routes.
--
-- It touches only blog_post_translations rows with lang='he' for the selected
-- top-five posts. It does not modify PL/EN rows or parent blog post data.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'blog_post_translations'
      AND column_name = 'review_status'
  ) THEN
    RAISE EXCEPTION
      'Missing blog_post_translations.review_status. Run he_blog_stage41_public_read_apply.sql first.';
  END IF;
END $$;

WITH selected_posts(id, label, source_slug) AS (
  VALUES
    ('0477e103-ee8a-47b3-9b54-69757dfbc07f'::uuid, 'affiliate_tourism', 'how-to-earn-from-tourism-in-cyprus-cypruseye-affiliate-system'),
    ('2a59c0a7-52fd-498f-b4fe-d0d76617c882'::uuid, 'etias_cyprus_2026', 'etias-cyprus-2026'),
    ('2e88f39b-5b5c-4e04-82b5-c125f19920b3'::uuid, 'cyprus_in_7_days', 'cyprus-in-7-days-itinerary'),
    ('a021f1d4-79e9-4c9e-a6ac-d36c13bd16ef'::uuid, 'car_rental_no_deposit', 'car-rental-cyprus-no-deposit'),
    ('1c1f8eb6-c709-4302-8611-6322b5ed5fad'::uuid, 'larnaca_vs_paphos', 'larnaca-or-paphos-where-to-stay')
)
SELECT
  'stage42_top5_pre_mark_review' AS check_name,
  sp.label,
  p.id,
  COALESCE(en.slug, pl.slug, sp.source_slug, p.id::text) AS source_slug,
  he.slug AS he_slug,
  NULLIF(BTRIM(he.title), '') IS NOT NULL AS has_he_title,
  NULLIF(BTRIM(he.meta_title), '') IS NOT NULL AS has_he_meta_title,
  NULLIF(BTRIM(he.meta_description), '') IS NOT NULL AS has_he_meta_description,
  NULLIF(BTRIM(he.summary), '') IS NOT NULL AS has_he_summary,
  NULLIF(BTRIM(he.lead), '') IS NOT NULL AS has_he_lead,
  NULLIF(BTRIM(he.content_html), '') IS NOT NULL AS has_he_content,
  COALESCE(CARDINALITY(p.categories_he), 0) > 0 AS has_categories_he,
  COALESCE(CARDINALITY(p.tags_he), 0) > 0 AS has_tags_he,
  COALESCE(he.review_status, 'missing') AS current_review_status,
  CASE
    WHEN p.cta_services::text ILIKE '%shop%' THEN 'review_cta_shop_normalized_to_en'
    WHEN p.cta_services::text ILIKE '%blog%' THEN 'review_cta_blog_record_gate'
    WHEN p.cta_services IS NULL THEN 'no_cta'
    ELSE 'cta_safe_or_ready_destination'
  END AS cta_review_status,
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
      THEN 'ready_to_mark_after_human_review'
    ELSE 'do_not_mark_public_ready'
  END AS mark_decision
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

WITH selected_posts(id) AS (
  VALUES
    ('0477e103-ee8a-47b3-9b54-69757dfbc07f'::uuid),
    ('2a59c0a7-52fd-498f-b4fe-d0d76617c882'::uuid),
    ('2e88f39b-5b5c-4e04-82b5-c125f19920b3'::uuid),
    ('a021f1d4-79e9-4c9e-a6ac-d36c13bd16ef'::uuid),
    ('1c1f8eb6-c709-4302-8611-6322b5ed5fad'::uuid)
),
complete_candidates AS (
  SELECT p.id
  FROM selected_posts sp
  JOIN public.blog_posts p
    ON p.id = sp.id
  JOIN public.blog_post_translations he
    ON he.blog_post_id = p.id AND he.lang = 'he'
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
)
UPDATE public.blog_post_translations he
SET
  review_status = 'public_ready',
  reviewed_at = COALESCE(he.reviewed_at, now())
FROM complete_candidates c
WHERE he.blog_post_id = c.id
  AND he.lang = 'he'
RETURNING
  'stage42_marked_public_ready_preview' AS check_name,
  he.blog_post_id,
  he.slug,
  he.review_status,
  he.reviewed_at;

WITH selected_posts(id) AS (
  VALUES
    ('0477e103-ee8a-47b3-9b54-69757dfbc07f'::uuid),
    ('2a59c0a7-52fd-498f-b4fe-d0d76617c882'::uuid),
    ('2e88f39b-5b5c-4e04-82b5-c125f19920b3'::uuid),
    ('a021f1d4-79e9-4c9e-a6ac-d36c13bd16ef'::uuid),
    ('1c1f8eb6-c709-4302-8611-6322b5ed5fad'::uuid)
)
SELECT
  'stage42_public_ready_in_transaction' AS check_name,
  COUNT(*) AS selected_posts,
  COUNT(*) FILTER (WHERE he.review_status = 'public_ready') AS public_ready_he_rows
FROM selected_posts sp
LEFT JOIN public.blog_post_translations he
  ON he.blog_post_id = sp.id AND he.lang = 'he';

-- Keep as ROLLBACK until Stage42 human review is approved.
ROLLBACK;
