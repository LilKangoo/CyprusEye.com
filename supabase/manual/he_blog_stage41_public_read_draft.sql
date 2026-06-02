-- Stage 41 DRAFT: reviewed Blog HE public-read gate.
-- Keep the final ROLLBACK until Stage 41 is explicitly approved.
--
-- This draft does not enable global HE, SEO HE, sitemap HE, hreflang HE,
-- canonical HE, indexing HE, Shop HE, or public /he/ routes.
--
-- If committed, it still exposes HE blog translations only when each HE
-- translation is explicitly marked review_status = 'public_ready' and the
-- parent post is published/approved. It does not mark any row public_ready.

BEGIN;

ALTER TABLE public.blog_post_translations
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;

DO $$
BEGIN
  ALTER TABLE public.blog_post_translations
    DROP CONSTRAINT IF EXISTS blog_post_translations_review_status_chk;

  ALTER TABLE public.blog_post_translations
    ADD CONSTRAINT blog_post_translations_review_status_chk
    CHECK (review_status IN ('draft', 'needs_review', 'reviewed', 'public_ready'));
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

DROP POLICY IF EXISTS blog_post_translations_public_read ON public.blog_post_translations;

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

-- Do not uncomment this until human editorial review is complete.
-- UPDATE public.blog_post_translations
-- SET review_status = 'public_ready', reviewed_at = now()
-- WHERE lang = 'he'
--   AND blog_post_id IN (
--     '0477e103-ee8a-47b3-9b54-69757dfbc07f',
--     '2a59c0a7-52fd-498f-b4fe-d0d76617c882',
--     '2e88f39b-5b5c-4e04-82b5-c125f19920b3',
--     'a021f1d4-79e9-4c9e-a6ac-d36c13bd16ef',
--     '1c1f8eb6-c709-4302-8611-6322b5ed5fad'
--   );

SELECT
  'stage41_public_read_draft_policy' AS check_name,
  policyname,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'blog_post_translations'
  AND policyname = 'blog_post_translations_public_read';

SELECT
  'stage41_he_rows_public_ready_in_transaction' AS check_name,
  COUNT(*) AS public_ready_he_rows
FROM public.blog_post_translations
WHERE lang = 'he'
  AND review_status = 'public_ready';

-- Keep as ROLLBACK until Stage 41 approval.
ROLLBACK;
