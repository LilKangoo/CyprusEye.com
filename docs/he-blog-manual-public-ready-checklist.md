# HE Blog Manual Public Ready Checklist

Blog remains `BLOCKED`. This checklist prepares manual review and
`public_ready` marking only. It does not activate Blog HE globally, SEO HE for
Blog, sitemap HE for Blog, or public `/he/` routes.

## Current Stable Production State

Final live commit: `92c7c73`. Blog remains manual and blocked in this final
partial HE production state.

- HE UI live: Home, transport, hotels, hotel, recommendations, car, trips,
  trip, and POI/map flow.
- HE SEO live: Stage 49 allowed scope only, currently 19 HE URLs in
  `sitemap.xml`.
- Blog and blog detail remain `BLOCKED` until a human-reviewed post is
  explicitly marked `public_ready` and verified.
- Shop, cart, checkout, payment, partners, and admin remain `EXCLUDED`.
- Public `/he/` routes remain non-public redirects/fallbacks to `/?lang=en`.
- Booking/payment/deposit flow is locked and must not be changed by Blog HE
  work.

## Pick A Blog Post

Choose one post at a time. Prefer posts that already have:

- published parent post
- `submission_status = approved`
- stable EN/PL slug
- complete HE candidate row
- safe CTA destinations

Do not mark a post public-ready if its Hebrew text has not been manually
reviewed.

## Required HE Fields

Before marking a post `public_ready`, confirm:

- HE title
- HE slug
- HE meta title
- HE meta description
- HE summary
- HE lead
- HE content HTML
- HE categories
- HE tags
- cover image works for RTL layout
- author/byline is correct
- CTA links are safe

CTA rules:

- links to READY/record-gated HE destinations may keep `lang=he`
- links to Blog posts without `public_ready` must not keep `lang=he`
- links to Shop, checkout, payment, Plan, Community, Legal, Partners or Admin
  must normalize to EN/LTR

## Slug Check

Before public-ready marking:

1. Confirm the HE slug is non-empty.
2. Confirm it does not duplicate another HE blog slug.
3. Confirm it does not collide with EN/PL routes.
4. Confirm direct `?lang=he` for a non-ready slug still returns EN/LTR or safe
   blocked output.

## Preview Check

Use admin/partner preview first.

Verify:

- title/lead/content render in HE
- `dir="rtl"` works
- images/lists/quotes do not overflow
- CTA links do not send HE into Shop/blocked pages
- no `undefined`, `null`, empty cards or broken fallback

## SQL Workflow

1. Run `supabase/manual/he_blog_stage41_public_read_verify.sql`.
2. Confirm the selected post has complete HE fields and no slug duplicates.
3. Run `supabase/manual/he_blog_stage42_mark_top5_public_ready_draft.sql` only
   as a preview.
4. Review returned rows manually.
5. Use `supabase/manual/he_blog_stage42_mark_top5_public_ready_apply.sql` only
   after human review is complete and explicitly approved.
6. Run `supabase/manual/he_blog_stage42_public_ready_verify.sql`.
7. Only after verify passes can a later stage move Blog from `BLOCKED` to
   record-gated public HE.

## When Not To Mark Public Ready

Do not mark `public_ready` if:

- HE content is machine-translated and not reviewed
- any required field is empty
- CTA goes to Shop/checkout/payment or another blocked page with `lang=he`
- slug is duplicated
- parent post is draft, pending, rejected or unpublished
- post depends on SEO HE activation
- legal/payment/medical-style claims need review

## Rollback

If a post is wrong after marking:

1. Change its HE `review_status` away from `public_ready` using the approved
   rollback SQL or SQL Editor.
2. Purge Cloudflare cache if it was publicly visible.
3. Keep Blog page readiness blocked until verify passes again.
4. Re-run Blog public-ready verify.

## Manual SQL To Run In Supabase

| Filename | Purpose | When | Verify file | Expected result |
| --- | --- | --- | --- | --- |
| `supabase/manual/he_blog_stage41_public_read_verify.sql` | Read-only readiness and slug check | Run before review and after edits | same file | Shows complete fields and no unsafe public rows |
| `supabase/manual/he_blog_stage42_mark_top5_public_ready_draft.sql` | Preview marking reviewed top posts | Only after manual text review; preview first | `supabase/manual/he_blog_stage42_public_ready_verify.sql` | Shows which rows would be marked |
| `supabase/manual/he_blog_stage42_mark_top5_public_ready_apply.sql` | Apply `public_ready` to reviewed rows | Only after explicit human approval | `supabase/manual/he_blog_stage42_public_ready_verify.sql` | Reviewed rows become public-ready, no drafts/pending rows exposed |
| `supabase/manual/he_blog_stage42_public_ready_verify.sql` | Verify public-ready rows | After apply | same file | Only reviewed, published, approved HE posts are public-ready |
