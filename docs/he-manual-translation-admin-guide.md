# HE Manual Translation Admin Guide

Status: manual workflow only. This guide does not activate global HE, Blog HE
public, Shop HE, SEO HE, sitemap HE, hreflang HE, canonical HE, indexing HE, or
public `/he/` routes.

## Core Rule

Hebrew content is public only when both conditions are true:

1. The page/module is allowed by the page-gated HE registry.
2. The specific dynamic record is reviewed and passes its module gate.

For Blog, this means `blog_post_translations.lang = 'he'` is not enough. A post
must also have `review_status = 'public_ready'`, complete required HE fields,
and a published/approved parent post.

## Blog Translation Workflow

Use the admin Blog editor for long body content so editor HTML stays consistent.

1. Open Admin -> Blog.
2. Edit the post.
3. Open the Hebrew / internal language tab.
4. Fill:
   - HE title
   - HE slug
   - HE summary
   - HE lead
   - HE meta title
   - HE meta description
   - HE content
   - HE cover alt text, if relevant
5. Fill localized taxonomy:
   - `categories_he`
   - `tags_he`
6. Use preview to check RTL layout, title wrapping, lead and body content.
7. Check CTA/service links:
   - links to READY or record-gated HE pages may keep HE;
   - links to Shop, Plan, blocked Blog posts, Legal or other blocked pages must
     normalize to EN/LTR;
   - do not use Shop/cart/checkout/payment as HE destinations.
8. Save and reload the post.
9. Run the verify SQL.
10. Only after human/native review, mark the post public-ready through the
    manual SQL gate.

Do not mark a Blog post public-ready if any of these are missing:

- HE slug
- HE title
- HE summary
- HE lead
- HE meta title
- HE meta description
- HE content
- `categories_he`
- `tags_he`
- published/approved parent status
- human/native review

## Blog Review Status

Current statuses:

- `draft`: internal or incomplete translation.
- `needs_review`: translated but waiting for review.
- `reviewed`: reviewed internally but not public.
- `public_ready`: allowed for public HE read when the parent post is published
  and approved.

The admin UI can edit HE content, taxonomy and preview RTL. A future small UI
enhancement should add a clear per-language review control:

- show HE completion checklist;
- show current `review_status`;
- allow `draft -> needs_review -> reviewed`;
- allow `public_ready` only for admins/super admins after all required fields
  pass validation;
- show a rollback button to move `public_ready -> reviewed`.

Until that UI exists, use the manual SQL files listed below.

## Blog Slug Review

Before marking a Blog post public-ready:

1. Use lowercase URL-safe slugs.
2. Avoid spaces and special punctuation.
3. Check duplicate HE slugs with the verify SQL.
4. Keep the HE slug stable after public launch unless you also plan redirects.

## Trip Translation Workflow

Use Admin trip fields or JSON localized fields, depending on the existing form.

Required for public HE:

- title HE
- description HE
- highlights HE, if visible
- itinerary HE, if visible
- FAQ HE, if visible
- booking CTA/labels through static translations

Record-gated trip rollout currently allows only HE-ready records. Do not expose
non-ready trips in HE lists.

## Hotel Translation Workflow

Required for public HE:

- hotel title/description HE
- amenity labels HE
- room/price labels HE, if visible
- badge/location labels HE, if visible

Hotels are already page-gated HE-ready after Stage25 SQL, but review content
quality before SEO launch.

## Car Translation Workflow

Required for public HE:

- feature labels HE
- option/insurance labels HE, if visible
- pickup/return labels through static translations
- descriptions HE, if present

Vehicle brand/model names may remain Latin text. Do not force-translate model
names.

## POI Translation Workflow

Use Admin POI i18n form.

Required for public HE:

- `name_i18n.he`
- `description_i18n.he`
- `badge_i18n.he`
- category label HE

Current map rollout is record-gated: only reviewed top POI should appear in HE
unless a future decision explicitly allows EN fallback.

## Recommendation Translation Workflow

Use Admin recommendation i18n form.

Required for public HE:

- title/name HE
- short description HE
- category HE
- badge/CTA HE, if visible
- offer/discount text HE, if visible

Review CTA destinations with `buildLocalizedUrl(...)` rules before public HE.

## Shop Translation Workflow

Shop remains excluded.

Do not activate HE for:

- product grid
- product modal
- cart
- checkout
- shipping
- payment

Before a future Shop HE stage, translate and QA:

- products
- categories
- variants
- vendors
- shipping methods/classes
- discounts/coupons
- cart labels
- checkout labels
- payment confirmations

Shop checkout/payment requires a separate full QA stage.

## Email Template Translation Workflow

Do not bulk-translate email templates automatically.

For each email template:

- translate subject HE;
- translate body HE;
- preserve variables and links exactly;
- send a test email;
- verify fallback is HE -> EN -> PL and never blank/undefined.

Payment/deposit emails must not be changed in HE translation stages without
booking/payment regression tests.

## Manual SQL To Run In Supabase

| Filename | Purpose | When to run | Verify file | Expected result |
| --- | --- | --- | --- | --- |
| `supabase/manual/he_blog_stage41_public_read_apply.sql` | Add review columns and gated public-read policy. Does not mark rows public-ready. | Run now only if these columns/policy are not already committed. | `supabase/manual/he_blog_stage41_public_read_verify.sql` | review columns exist; policy requires `review_status='public_ready'`; public-ready count can remain 0. |
| `supabase/manual/he_blog_stage41_public_read_verify.sql` | Check review columns, policy, top-five readiness, duplicate slugs and CTA risk. | Run after Stage41 apply and before any Blog rollout. | Same file | No duplicate HE slugs; no unexpected public exposure. |
| `supabase/manual/he_blog_stage42_mark_top5_public_ready_draft.sql` | Preview marking top-five HE posts public-ready. Ends with `ROLLBACK`. | Run only during manual review. Safe preview. | `supabase/manual/he_blog_stage42_public_ready_verify.sql` after apply | Preview should show exactly the reviewed rows that would be marked. |
| `supabase/manual/he_blog_stage42_mark_top5_public_ready_apply.sql` | Mark top-five complete HE rows as `public_ready`. | Run only after human/native review approves all five posts. | `supabase/manual/he_blog_stage42_public_ready_verify.sql` | `public_ready_he_rows = 5`; duplicate slug check returns zero rows. |
| `supabase/manual/he_blog_stage42_public_ready_verify.sql` | Verify top-five public-ready state and parent post safety. | Run after Stage42 apply. | Same file | 5 public-ready rows, zero duplicate slugs, zero parent-not-public rows. |

## Rollback

If a Blog HE post must be withdrawn:

1. Set the affected HE translation from `public_ready` to `reviewed` or
   `needs_review`.
2. Keep Blog/BlogPost page readiness blocked unless a later stage has
   explicitly moved it to record-gated.
3. Purge Cloudflare cache after deploy/config changes if stale pages are visible.
4. Do not remove HE content unless the translation itself is wrong and no audit
   trail is needed.

## Do Not Mark Public-Ready When

- The translation was machine-generated and not reviewed.
- The body content has not been read end to end.
- The slug is duplicated or unstable.
- CTA links point to blocked/excluded HE pages.
- The parent post is draft, pending, rejected, unpublished or future-dated.
- The post depends on Shop/cart/checkout/payment.
- SEO HE is assumed to exist. SEO is still a separate rollout stage.

## PL/EN/HE Structure Completeness Rules

Use `npm run i18n:tri-audit` before and after translation batches.

Rules:

- If a UI key exists in PL, EN must also exist. EN is the primary fallback for
  HE.
- If a UI key exists in EN, HE must exist unless it is explicitly parked for
  human review.
- If a key exists only in HE, verify whether it is legacy. If it is used in UI,
  add PL/EN ownership or move it into the correct structure.
- Preserve placeholders exactly: `{{name}}`, `{amount}`, `%s`, `%d`, links and
  HTML tags.
- Do not translate URLs, IDs, technical codes, brand names or payment provider
  names unless the product copy explicitly requires it.
- Long Blog content, SEO meta, email templates, legal/payment copy and long
  marketing copy require manual review before public use.

Stage44 baseline:

- `translations/audit-pl-en-he.json` is the structural source of truth.
- PL keys missing EN: `0`.
- PL/EN keys missing HE: `216`, all parked in manual review groups.
- Placeholder mismatches: `0`.
- HTML tag mismatches: `0`.

Manual review remains required for:

- `advertise.*` long partner/advertising copy,
- `seo.*` meta copy,
- long Shop copy and checkout/payment language,
- email templates,
- Blog posts and long dynamic content.

## Stage 45 Export / Import Workflow

Use the review pack workflow when you want to translate outside the admin UI.

Generate packs:

```bash
npm run i18n:tri-audit
npm run i18n:review-export
```

Main workflow doc:

- `docs/he-manual-translation-export-import-workflow.md`

Review pack folder:

- `translations/manual-review/`

Dry-run import example:

```bash
npm run i18n:review-import -- --input=translations/manual-review/static-ui-review.json
```

Apply is explicit:

```bash
npm run i18n:review-import -- --input=translations/manual-review/static-ui-review.json --apply
```

Importer safety:

- dry-run by default,
- validates placeholders and HTML tags,
- skips dynamic/database records,
- rejects `public_ready` changes,
- does not update Supabase,
- does not activate Blog, Shop or SEO HE.

For Blog posts, keep using admin/partner editor or reviewed SQL workflows.
Never use a static JSON import to mark Blog content public-ready.

## Stage 50 Manual Admin Next Steps

Use this order for future manual content work:

1. Blog posts:
   - use `docs/he-blog-manual-public-ready-checklist.md`;
   - translate title, slug, lead, summary, meta, content, categories and tags;
   - preview in admin;
   - mark `public_ready` only through the reviewed SQL workflow.
2. SEO copy:
   - use `translations/manual-review/seo-review.json`;
   - review length, duplicate slugs and canonical intent;
   - do not change SEO flags during translation.
3. Shop:
   - use `docs/he-shop-future-rollout-checklist.md`;
   - review cart/checkout/payment/order emails manually;
   - keep Shop EN/LTR until a dedicated Shop HE stage.
4. Email/payment templates:
   - use `translations/manual-review/email-template-review.json`;
   - preserve amount, currency, URL, booking reference and customer/partner
     placeholders;
   - do not change dispatch, partner fulfillment, Stripe webhook or deposit
     calculation.

Do not mark content public-ready when:

- a translation is unreviewed,
- a slug is duplicated,
- placeholders mismatch,
- CTA links send HE into Shop/blocked pages,
- parent record is draft/pending/rejected,
- the page still relies on EN fallback as primary content.
