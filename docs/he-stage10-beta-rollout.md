# HE Stage 10 Beta Rollout Preparation

Status: HE remains non-public. Stage 10 prepares controlled beta access only. Do not enable HE sitemap, hreflang, canonical metadata, public SEO, indexing, or `/he/` routes.

## Migration 179 Verification

The manual SQL for migration 179 can be verified in Supabase SQL Editor with:

```sql
select
  conname,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.blog_post_translations'::regclass
  and conname = 'blog_post_translations_lang_check';
```

Expected: `CHECK ((lang = ANY (ARRAY['pl'::text, 'en'::text, 'he'::text])))` or equivalent.

```sql
select
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'blog_post_translations'
order by policyname;
```

Expected for `blog_post_translations_public_read`: public read remains limited to `lang IN ('pl', 'en')`. Staff and partner manage policies should remain present from earlier migrations.

Optional non-destructive smoke check:

```sql
begin;

select id, status, submission_status
from public.blog_posts
order by updated_at desc nulls last
limit 5;

-- Use a draft/staging post id only. Roll back immediately.
insert into public.blog_post_translations (
  blog_post_id,
  lang,
  slug,
  title,
  meta_description,
  summary,
  lead,
  content_json,
  content_html
) values (
  '<draft-blog-post-id>',
  'he',
  'he-internal-smoke-test',
  'בדיקת טיוטה',
  'Internal Hebrew draft smoke test.',
  'Internal Hebrew draft smoke test.',
  'Internal Hebrew draft smoke test.',
  '{"type":"doc","content":[]}'::jsonb,
  ''
)
on conflict (blog_post_id, lang) do update set
  title = excluded.title,
  updated_at = now()
returning blog_post_id, lang, slug, title;

rollback;
```

## Blog Admin Runtime Fix

The Stage 10 admin blocker was in taxonomy suggestions, not in SQL 179. `admin/blog-admin.js` now initializes suggestion buckets from `BLOG_TAXONOMY_LANGUAGES`, so `pl`, `en`, and `he` are all present before the form opens.

Manual admin QA after deployment:

- Open Blog Admin.
- Click `New post`.
- Confirm the modal opens without `Cannot read properties of undefined (reading 'add')`.
- Fill HE title, slug, summary, lead and content on a draft.
- Save, close, reopen.
- Confirm HE fields reload.
- Confirm PL/EN fields were not overwritten.
- Confirm public blog pages still do not expose HE.

## Controlled Beta Config

Default remains:

```js
he: {
  mode: 'internal_only',
  switcher: false,
  routes: false,
  publicApi: false,
  seo: false,
  sitemap: false,
  hreflang: false,
  canonical: false,
  indexing: false,
}
```

Browser beta can be prepared by injecting this before `js/i18n.js` loads:

```js
window.CE_LANGUAGE_ROLLOUT_CONFIG = {
  he: {
    mode: 'beta',
    switcher: true,
    routes: true,
    publicApi: true,
    seo: false,
    sitemap: false,
    hreflang: false,
    canonical: false,
    indexing: false,
    betaUserIds: ['<supabase-user-id>'],
    betaEmails: ['tester@example.com'],
  },
};

// Prefer setting this only after an authenticated allowlist check.
window.CE_HE_BETA_USER = true;
```

Local developer override is still allowed on localhost/internal preview only:

```js
localStorage.setItem('ce_he_beta', 'true');
localStorage.setItem('ce_he_rollout_mode', 'beta');
```

Server/build functions can be prepared with:

```bash
CE_HE_ROLLOUT_MODE=internal_only
CE_LANGUAGE_ROLLOUT_CONFIG='{"he":{"mode":"beta","switcher":true,"routes":true,"publicApi":true,"seo":false,"sitemap":false,"hreflang":false,"canonical":false,"indexing":false}}'
```

Do not set `seo`, `sitemap`, `hreflang`, `canonical`, or `indexing` to `true` during beta.

## Beta Smoke Flow

- Non-beta: `/index.html?lang=he` falls back to EN/PL public behavior and does not switch `<html lang>` to `he`.
- Internal preview: `/index.html?ce_he_preview=1&lang=he` renders RTL HE preview and keeps HE out of public selectors.
- Beta user: after authenticated beta gate, `/index.html?lang=he` may render HE and show the HE switcher option.
- SEO remains off in every beta mode: no HE sitemap, hreflang, canonical, indexing or public SEO alternates.

## Full Public Launch Blockers

- `translations/he.json` still has P0 gaps and review work.
- Dynamic HE content still needs manual QA for blog, trips, hotels, recommendations, POI, shop, transport and email templates.
- Real admin/partner save-reload must pass on staging after SQL 179.
- HE SEO metadata and the final URL strategy are not approved.
- Direct public-readable `*_he` columns remain a governance risk for confidential pre-launch copy; avoid storing confidential text there until column grants/views are reviewed.
