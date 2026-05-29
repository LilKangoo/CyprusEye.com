-- Stage 11.5: verify migration 179 without destructive changes.
-- Run in Supabase SQL Editor. The final block uses ROLLBACK.

-- 1) Constraint must allow pl, en, he.
SELECT
  conname,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.blog_post_translations'::regclass
  AND conname = 'blog_post_translations_lang_check';

-- Expected: CHECK includes 'pl', 'en', and 'he'.

-- 2) Public read policy should still hide HE from anonymous/public reads.
SELECT
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'blog_post_translations'
ORDER BY policyname;

-- Expected:
-- - blog_post_translations_public_read contains lang IN ('pl', 'en')
-- - staff/partner manage policies are still present.

-- 3) Transactional HE insert/update/select smoke.
-- Replace <draft-blog-post-id> with a non-public draft/test blog_posts.id.
-- If you do not have a draft id yet, run the SELECT below and create one in Admin first.
SELECT id, status, submission_status, title, updated_at
FROM public.blog_posts
ORDER BY updated_at DESC NULLS LAST
LIMIT 10;

BEGIN;

INSERT INTO public.blog_post_translations (
  blog_post_id,
  lang,
  slug,
  title,
  meta_description,
  summary,
  lead,
  content_json,
  content_html
) VALUES (
  '<draft-blog-post-id>',
  'he',
  'he-internal-stage-11-5-smoke',
  'בדיקת טיוטה',
  'Internal Hebrew draft smoke test.',
  'Internal Hebrew draft smoke test.',
  'Internal Hebrew draft smoke test.',
  '{"type":"doc","content":[]}'::jsonb,
  ''
)
ON CONFLICT (blog_post_id, lang) DO UPDATE SET
  slug = EXCLUDED.slug,
  title = EXCLUDED.title,
  meta_description = EXCLUDED.meta_description,
  summary = EXCLUDED.summary,
  lead = EXCLUDED.lead,
  content_json = EXCLUDED.content_json,
  content_html = EXCLUDED.content_html,
  updated_at = now()
RETURNING blog_post_id, lang, slug, title, updated_at;

SELECT blog_post_id, lang, slug, title, lead
FROM public.blog_post_translations
WHERE blog_post_id = '<draft-blog-post-id>'
  AND lang = 'he';

ROLLBACK;

-- Expected: INSERT/SELECT returns one HE row inside transaction, then ROLLBACK leaves no test data.
