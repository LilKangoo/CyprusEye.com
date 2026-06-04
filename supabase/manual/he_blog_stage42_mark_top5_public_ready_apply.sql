-- Stage 42 APPLY: mark reviewed top-five Blog HE translations public_ready.
-- Run manually in Supabase SQL Editor only after human/native review accepts
-- every Hebrew value in the top-five candidate posts.
--
-- Required prior step: he_blog_stage41_public_read_apply.sql must already be
-- committed so review_status/reviewed_at/reviewed_by and the gated public-read
-- policy exist.
--
-- This does not enable global HE, SEO HE, sitemap HE, hreflang HE,
-- canonical HE, indexing HE, Shop HE, or public /he/ routes.
--
-- It touches only blog_post_translations rows with lang='he' for the selected
-- top-five posts. It does not modify PL/EN rows or parent blog post data.

BEGIN;

DO $$
DECLARE
  complete_count integer;
  duplicate_slug_count integer;
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

  WITH selected_posts(id) AS (
    VALUES
      ('0477e103-ee8a-47b3-9b54-69757dfbc07f'::uuid),
      ('2a59c0a7-52fd-498f-b4fe-d0d76617c882'::uuid),
      ('2e88f39b-5b5c-4e04-82b5-c125f19920b3'::uuid),
      ('a021f1d4-79e9-4c9e-a6ac-d36c13bd16ef'::uuid),
      ('1c1f8eb6-c709-4302-8611-6322b5ed5fad'::uuid)
  )
  SELECT COUNT(*)
    INTO complete_count
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
    AND COALESCE(CARDINALITY(p.tags_he), 0) > 0;

  IF complete_count <> 5 THEN
    RAISE EXCEPTION
      'Expected 5 complete reviewed HE blog candidates before marking public_ready, got %.',
      complete_count;
  END IF;

  SELECT COUNT(*)
    INTO duplicate_slug_count
  FROM (
    SELECT slug
    FROM public.blog_post_translations
    WHERE lang = 'he'
      AND NULLIF(BTRIM(slug), '') IS NOT NULL
    GROUP BY slug
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_slug_count <> 0 THEN
    RAISE EXCEPTION
      'Cannot mark Blog HE public_ready while duplicate HE slugs exist. Duplicate groups: %.',
      duplicate_slug_count;
  END IF;
END $$;

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
  reviewed_at = now()
FROM complete_candidates c
WHERE he.blog_post_id = c.id
  AND he.lang = 'he'
RETURNING
  'stage42_marked_public_ready' AS check_name,
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
  'stage42_public_ready_after_apply' AS check_name,
  COUNT(*) AS selected_posts,
  COUNT(*) FILTER (WHERE he.review_status = 'public_ready') AS public_ready_he_rows
FROM selected_posts sp
LEFT JOIN public.blog_post_translations he
  ON he.blog_post_id = sp.id AND he.lang = 'he';

COMMIT;
