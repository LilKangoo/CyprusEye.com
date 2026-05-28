-- Allow internal Hebrew blog translations without public exposure.
-- This does not enable Hebrew in public UI, routing, sitemap, hreflang, canonical, or SEO.

DO $$
BEGIN
  IF to_regclass('public.blog_post_translations') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.blog_post_translations
    DROP CONSTRAINT IF EXISTS blog_post_translations_lang_check;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.blog_post_translations'::regclass
      AND conname = 'blog_post_translations_lang_check'
  ) THEN
    ALTER TABLE public.blog_post_translations
      ADD CONSTRAINT blog_post_translations_lang_check
      CHECK (lang IN ('pl', 'en', 'he'));
  END IF;
END $$;

COMMENT ON COLUMN public.blog_post_translations.lang IS
  'Blog translation language. Hebrew is allowed for internal/hidden content only until controlled public rollout.';

DROP POLICY IF EXISTS blog_post_translations_public_read ON public.blog_post_translations;
CREATE POLICY blog_post_translations_public_read
  ON public.blog_post_translations
  FOR SELECT
  TO anon, authenticated
  USING (
    lang IN ('pl', 'en')
    AND EXISTS (
      SELECT 1
      FROM public.blog_posts p
      WHERE p.id = blog_post_translations.blog_post_id
        AND p.status = 'published'
        AND p.submission_status = 'approved'
        AND p.published_at IS NOT NULL
        AND p.published_at <= now()
    )
  );
