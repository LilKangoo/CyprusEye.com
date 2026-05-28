-- Manual Stage 9 SQL for internal Hebrew blog translations.
-- Safe to run in Supabase SQL Editor after 177/178.
-- Additive/guarded: no data deletion, no public Hebrew activation.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.blog_post_translations') IS NULL THEN
    RAISE NOTICE 'Skipping: public.blog_post_translations does not exist.';
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

COMMIT;

-- Verification:
-- 1) Constraint allows he:
-- select conname, pg_get_constraintdef(oid)
-- from pg_constraint
-- where conrelid = 'public.blog_post_translations'::regclass
--   and conname = 'blog_post_translations_lang_check';
--
-- 2) Public policy still hides HE translations:
-- select policyname, roles, cmd, qual
-- from pg_policies
-- where schemaname = 'public'
--   and tablename = 'blog_post_translations'
--   and policyname = 'blog_post_translations_public_read';
--
-- 3) Internal save/reload can use lang='he' only through staff/partner policies.
-- Do not add HE to public switcher, sitemap, hreflang, canonical, SEO, or routes.
