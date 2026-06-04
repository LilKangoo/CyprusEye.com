-- Stage 41 APPLY: reviewed Blog HE public-read gate.
-- Run manually in Supabase SQL Editor only after:
-- 1) top 5 HE blog rows are complete,
-- 2) human editorial review is accepted,
-- 3) Blog list/detail record-gating has passed tests.
--
-- This does not enable global HE, SEO HE, sitemap HE, hreflang HE,
-- canonical HE, indexing HE, Shop HE, or public /he/ routes.
--
-- This file does not mark any row public_ready. It only creates the review
-- columns and updates the public read policy so HE rows are readable only when
-- they are explicitly marked review_status = 'public_ready'.

BEGIN;

ALTER TABLE public.blog_post_translations
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;

DO $$
DECLARE
  existing_definition text;
BEGIN
  SELECT pg_get_constraintdef(oid)
    INTO existing_definition
  FROM pg_constraint
  WHERE conrelid = 'public.blog_post_translations'::regclass
    AND conname = 'blog_post_translations_review_status_chk';

  IF existing_definition IS NULL THEN
    ALTER TABLE public.blog_post_translations
      ADD CONSTRAINT blog_post_translations_review_status_chk
      CHECK (review_status IN ('draft', 'needs_review', 'reviewed', 'public_ready'));
  ELSIF existing_definition NOT ILIKE '%draft%'
    OR existing_definition NOT ILIKE '%needs_review%'
    OR existing_definition NOT ILIKE '%reviewed%'
    OR existing_definition NOT ILIKE '%public_ready%' THEN
    RAISE EXCEPTION
      'Existing blog_post_translations_review_status_chk is incompatible: %',
      existing_definition;
  END IF;
END $$;

COMMENT ON COLUMN public.blog_post_translations.review_status IS
  'Editorial review state for translated blog content. HE public read requires public_ready.';

COMMENT ON COLUMN public.blog_post_translations.reviewed_at IS
  'Timestamp of the last editorial review for translated blog content.';

COMMENT ON COLUMN public.blog_post_translations.reviewed_by IS
  'Reviewer user id for translated blog content, if available.';

CREATE INDEX IF NOT EXISTS idx_blog_post_translations_he_public_ready
  ON public.blog_post_translations (blog_post_id, slug)
  WHERE lang = 'he' AND review_status = 'public_ready';

DO $$
DECLARE
  policy_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'blog_post_translations'
      AND policyname = 'blog_post_translations_public_read'
  ) INTO policy_exists;

  IF policy_exists THEN
    ALTER POLICY blog_post_translations_public_read
      ON public.blog_post_translations
      USING (
        EXISTS (
          SELECT 1
          FROM public.blog_posts p
          WHERE p.id = blog_post_translations.blog_post_id
            AND p.status = 'published'
            AND p.submission_status = 'approved'
            AND p.published_at IS NOT NULL
            AND p.published_at <= now()
        )
        AND (
          lang IN ('pl', 'en')
          OR (
            lang = 'he'
            AND review_status = 'public_ready'
            AND NULLIF(BTRIM(slug), '') IS NOT NULL
            AND NULLIF(BTRIM(title), '') IS NOT NULL
            AND NULLIF(BTRIM(meta_title), '') IS NOT NULL
            AND NULLIF(BTRIM(meta_description), '') IS NOT NULL
            AND NULLIF(BTRIM(summary), '') IS NOT NULL
            AND NULLIF(BTRIM(lead), '') IS NOT NULL
            AND NULLIF(BTRIM(content_html), '') IS NOT NULL
          )
        )
      );
  ELSE
    CREATE POLICY blog_post_translations_public_read
      ON public.blog_post_translations
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.blog_posts p
          WHERE p.id = blog_post_translations.blog_post_id
            AND p.status = 'published'
            AND p.submission_status = 'approved'
            AND p.published_at IS NOT NULL
            AND p.published_at <= now()
        )
        AND (
          lang IN ('pl', 'en')
          OR (
            lang = 'he'
            AND review_status = 'public_ready'
            AND NULLIF(BTRIM(slug), '') IS NOT NULL
            AND NULLIF(BTRIM(title), '') IS NOT NULL
            AND NULLIF(BTRIM(meta_title), '') IS NOT NULL
            AND NULLIF(BTRIM(meta_description), '') IS NOT NULL
            AND NULLIF(BTRIM(summary), '') IS NOT NULL
            AND NULLIF(BTRIM(lead), '') IS NOT NULL
            AND NULLIF(BTRIM(content_html), '') IS NOT NULL
          )
        )
      );
  END IF;
END $$;

SELECT
  'stage41_public_read_policy' AS check_name,
  policyname,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'blog_post_translations'
  AND policyname = 'blog_post_translations_public_read';

SELECT
  'stage41_he_rows_public_ready_after_apply' AS check_name,
  COUNT(*) AS public_ready_he_rows
FROM public.blog_post_translations
WHERE lang = 'he'
  AND review_status = 'public_ready';

COMMIT;
