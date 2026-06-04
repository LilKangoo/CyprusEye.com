# HE Beta GO / NO-GO

Generated: 2026-05-31T22:45:19.979Z

HE remains internal/page-gated only. This document does not enable global public
HE, sitemap, hreflang, canonical metadata, SEO, indexing, the global public
language switcher, Shop HE, or public `/he/` routes.

## Dynamic Content Decision Table

| Module | Status | Decision |
| --- | --- | --- |
| Trips | PARTIAL | Trips: page-gated only with explicit EN fallback acceptance; do not expose all records as fully Hebrew. |
| Hotels | READY | Hotels: can enter controlled beta for HE preview, with remaining fallback tracked. |
| Cars | PARTIAL | Cars: beta only with explicit EN fallback acceptance; translate top records before broader beta. |
| Transport | READY | Transport: can enter controlled beta for HE preview, with remaining fallback tracked. |
| Blog | BLOCKED | Blog: keep blocked until public HE read/RLS and top post translations are intentionally opened. |
| POI | PARTIAL | POI/map: page-gated only for top translated POI with safe EN fallback. |
| Recommendations | READY | Recommendations: can enter controlled beta for HE preview, with remaining fallback tracked. |
| Shop | BLOCKED | Shop: hide from first HE beta or keep EN-only until dynamic HE content is added. |

## Page-Gated READY Now

- Hotels
- Transport
- Recommendations

These modules can be exercised through page-gated HE only within the existing
`partial_public` guard for READY pages. SEO and global full-site switcher remain
off.

## Stage 30 Live GO / NO-GO

Status: **GO for current page-gated production scope**.

Approved live scope:

- `transport.html`
- `hotels.html`
- `hotel.html`
- `recommendations.html`

Still not approved:

- Global public HE
- HE SEO/sitemap/hreflang/canonical/indexing
- Public `/he/` routes
- Shop/cart/checkout/payment HE
- Blog public HE
- PARTIAL pages as public HE without an explicit future gate

Live checks passed for:

- READY pages activating HE/RTL.
- PARTIAL, BLOCKED and EXCLUDED pages blocking public `?lang=he`.
- Shop remaining EN/LTR.
- Blog remaining blocked.
- `/he/` falling back safely to `/?lang=en`.
- Sitemap and checked page metadata remaining free of HE SEO URLs.

## Stage 31 Expansion GO / NO-GO

Current page-gated READY scope: **GO**.

Expansion beyond READY pages: **NO-GO until Stage 32 work is completed**.

Reasons:

- Home, Cars, Trips, Trip detail and POI/map are still `partial`, not `ready`.
- Some HE navigation links from READY pages still point at non-ready
  destinations with `?lang=he`; the guard blocks them, but link generation
  should be cleaned up before rollout expansion.
- Blog remains blocked by content/read policy/routing readiness.
- Shop remains excluded by checkout/payment and dynamic content readiness.

Stage31 monitoring passed for:

- READY HE rendering.
- HE -> EN -> PL switching.
- Cross-navigation back to LTR on non-ready pages.
- Shop and Blog remaining blocked.
- SEO HE remaining off.
- Referral and recommendations tracking sanity.

Recommended next gate:

- Stage32 should complete PARTIAL-safe content and link behavior before enabling
  any additional public HE surfaces.

## Stage 34 Record-Gated Expansion Gate

Status: **data gate passed; public expansion still requires a separate rollout
approval**.

Required before any new record-gated public HE surface:

- `supabase/manual/he_partial_pages_stage33.sql` preview rows show trips `3`,
  cars `5`, POI `10`.
- Hebrew values are human-reviewed.
- The final `ROLLBACK` is manually replaced with `COMMIT` and applied in
  Supabase SQL Editor.
- `supabase/manual/he_partial_pages_stage33_verify.sql` passes cleanly.
- `scripts/verify-he-stage33-data.js` confirms the same selected records through
  read-only Supabase anon reads.
- Record-gated smoke confirms:
  - Car only exposes HE-ready top records, with no `undefined`/`null`.
  - Trips listing only exposes HE-ready trips.
  - Trip detail blocks unready slugs back to EN/LTR.
  - POI/map only exposes HE-ready POI or explicitly approved fallback.

Still excluded from this gate:

- Home public HE expansion
- Blog public HE
- Shop/cart/checkout/payment HE
- SEO/sitemap/hreflang/canonical/indexing HE
- Public `/he/` routes

## Stage 35 GO / NO-GO

Decision: **GO for Etap 36A planning only; NO-GO for unapproved public
expansion in Etap 35**.

Passed:

- Stage33 data is applied and verified.
- Trips top 3 are HE-ready.
- Cars top 5 are HE-ready by localized features.
- POI top 10 are HE-ready by name, description and badge.
- Existing page-gated guard still keeps Blog blocked, Shop excluded and SEO HE
  off.

Remaining gates before exposing the next public pages:

- Confirm record-gated runtime behavior in the actual rollout config for Car,
  Trips, Trip detail and POI/map.
- Keep Home partial until Blog/Shop previews are curated.
- Keep Blog public HE blocked until public read/RLS/content/routing/SEO are
  solved separately.
- Keep Shop/cart/checkout/payment excluded until a dedicated Shop HE QA stage.

## Stage 36 GO / NO-GO

Decision target: **GO only for record-gated Car, Trips, Trip detail and POI/map
after smoke tests pass**.

Configured scope:

- `recordGatedPagesPublic:true`
- `stage33SqlApplied:true`
- `allowPartialPagesPublic:false`

GO conditions:

- `car.html?lang=he` shows HE/RTL and only HE-ready fleet records.
- `trips.html?lang=he` shows only HE-ready trips.
- `trip.html` renders HE only for ready slugs and blocks unready slugs to
  EN/LTR.
- POI/map uses HE-ready POI only.
- Home, Blog, Shop, Plan, Partner/Admin and unknown pages remain blocked or
  excluded.
- SEO HE remains off.

Rollback condition:

- Any undefined/null content, unready record in HE, RTL break in booking/map
  flow or accidental Shop/Blog HE exposure should set
  `recordGatedPagesPublic:false` before redeploy.

## PARTIAL-safe With Explicit Fallback

- Cars
- Trips
- POI/map

## Blocked Or Excluded

- Blog
- Shop
- Plan
- Community
- Account/Auth
- Legal
- Partners/Admin

## GO Conditions For Etap 15+

- HE remains hidden from public switchers and SEO surfaces until explicitly approved.
- Top dynamic records in beta scope have HE or an accepted EN fallback.
- Shop is not included in first customer beta until product, category, vendor,
  shipping and discount labels are reviewed.
- Blog is not treated as a Hebrew blog experience until public read/RLS for HE
  rows is intentionally opened and selected posts are reviewed.
- POI/map page-gated HE must stay scoped to translated records and safe EN
  fallback.

## NO-GO Conditions

- Any module shows blank cards, undefined labels, or PL-first fallback for HE.
- HE routes, sitemap, hreflang, canonical or public SEO become visible before final approval.
- Shop checkout uses untranslated dynamic product/shipping/discount labels in a paid beta flow.
- Blog has no HE translation for the tested post but is presented as Hebrew content.

## Overall Recommendation

Controlled HE beta can continue for layout/runtime validation, but the first
content beta should be scoped narrowly. Use EN fallback only where explicitly
accepted by the tester group and keep shop/blog as gated or EN-only until their
dynamic records are translated.

## Stage 37 GO / NO-GO

Decision target: **GO for live-monitored record-gated pages only**.

GO conditions satisfied locally on 2026-06-02:

- Stage33 Supabase verification passed for Trips `3/3`, Cars `5/5` and POI
  `10/10`.
- Page-gated and record-gated Playwright smoke passed.
- Shop remains excluded.
- Blog remains blocked.
- Home remains partial.
- SEO HE remains off.
- `/he/` does not serve a broken SPA route.

Live conditions satisfied on 2026-06-02:

- Production serves `recordGatedPagesPublic:true`.
- Existing READY pages remain HE/RTL.
- Car, Trips and HE-ready Trip detail work as record-gated HE.
- Unready Trip detail normalizes to EN/LTR.
- Home, Blog, Shop, Plan, Partners/Admin and `/he/` remain blocked or
  excluded.
- SEO surfaces remain off for HE.

Resolved before next deploy:

- Trips initially rendered EN card titles in HE mode because the legacy
  `languageSwitcher.js` helper did not recognize page-gated public HE. This was
  fixed by delegating hidden-language route checks to the central rollout guard.

Not part of this GO:

- Full global HE.
- Home HE.
- Blog HE public read/routing/SEO.
- Shop/cart/checkout/payment HE.
- Sitemap, hreflang, canonical, indexing or public `/he/` routes.

Live NO-GO conditions after deploy:

- Any record-gated page shows unready records in HE.
- Any blocked/excluded page keeps `dir="rtl"` or HE switcher state.
- Shop checkout/cart/payment enter HE/RTL.
- Blog becomes publicly HE-readable.
- SEO audit finds HE sitemap, hreflang, canonical, OpenGraph or indexing
  exposure.

Rollback: set `recordGatedPagesPublic:false`, redeploy and purge Cloudflare
cache if stale assets continue to expose record-gated HE.

## Stage 38 Home Aggregation Gate

Decision target: **NO-GO for public Home HE until a dedicated Home smoke passes**.

Stage38 preparation is acceptable because it does not activate Home HE publicly:

- Home remains `PARTIAL`.
- Blog preview is hidden during HE Home rendering.
- Shop/cart/checkout/payment remain excluded and EN/LTR.
- Blocked shortcut cards are hidden during HE Home rendering.
- Links to Blog, Shop, Plan, Community, Packing, Tasks and Legal normalize to
  EN/LTR.
- READY and record-gated links may keep `lang=he`.

GO criteria for the next Home stage:

1. Home HE desktop/mobile smoke has no overflow or `undefined/null`.
2. Blog and Shop are not visible as broken HE fragments.
3. Cross-navigation from Home HE keeps HE only for READY/record-gated pages.
4. Booking/payment regression tests pass because Home transport remains present.
5. SEO HE remains off.

NO-GO conditions:

- Any Home section links to Blog/Shop/Plan/Community with `lang=he`.
- Any Shop/cart/checkout/payment surface enters RTL/HE.
- Any non-ready car/trip/POI record appears as broken HE.
- Booking/payment regression tests fail.

## Stage 39 Home GO / NO-GO

Decision target: **GO only for controlled Home page-gated rollout**.

GO conditions:

- Home is enabled by `pageReadiness.home.status:"ready"` only.
- `allowPartialPagesPublic:false` remains unchanged.
- Blog preview is hidden on HE Home.
- Shop/cart/checkout/payment remain excluded and EN/LTR.
- Plan, Community, Packing, Tasks and Legal links normalize to EN/LTR.
- READY and record-gated Home modules render without `undefined/null`.
- Mobile Home has no horizontal overflow.
- Existing READY and record-gated pages keep working.
- SEO HE remains off.
- Booking/payment regression tests continue to pass.

NO-GO conditions:

- Home exposes Blog, Shop, checkout/payment, Plan or Community as HE before
  those pages are approved.
- Any blocked/excluded destination keeps `dir="rtl"` after navigation from Home.
- `allowPartialPagesPublic` is set to `true`.
- HE sitemap, hreflang, canonical, OpenGraph, indexing or public `/he/` routes
  become visible.
- Booking/payment regression tests fail.

Rollback:

1. Remove `pageReadiness.home` or set it to `partial`.
2. Keep existing READY and record-gated pages unchanged unless the regression is
   shared.
3. Keep Blog BLOCKED, Shop EXCLUDED and SEO HE OFF.

## Stage 40 Blog Gate

Decision target: **NO-GO for public Blog HE in Stage40**.

GO criteria for a future Stage41 Blog record-gated rollout:

1. `he_blog_stage40_readiness_verify.sql` reports all five top posts as
   complete candidates.
2. A review/public-ready field exists on `blog_post_translations`.
3. Public read policy exposes HE only for `review_status='public_ready'` and
   published/approved parent posts.
4. Blog list filters to HE-ready posts only and uses `categories_he/tags_he`.
5. Blog detail renders HE only for HE-ready slugs; non-ready slugs normalize to
   EN/LTR.
6. Blog CTA links do not carry HE into Shop, Plan, Community, Legal or other
   blocked/excluded pages.
7. HE SEO remains off during the record-gated Blog test.

NO-GO conditions:

- Any HE blog row is publicly readable without an explicit reviewed/public-ready
  gate.
- Blog list shows EN fallback posts as a Hebrew archive.
- Blog detail shows mixed or empty HE content.
- Related posts include non-ready HE posts.
- Shop/cart/checkout/payment links carry `lang=he`.
- Sitemap, hreflang, canonical, OpenGraph or indexing expose HE.

Prepared files:

- `supabase/manual/he_blog_stage40_readiness_verify.sql`
- `supabase/manual/he_blog_stage41_public_read_draft.sql`

Rollback for a future Stage41 test: restore the migration-179 public policy
that limits `blog_post_translations_public_read` to `lang IN ('pl', 'en')`,
then set Blog/BlogPost back to `blocked` in the page registry.

## Stage 41 Blog Record-Gated Gate

Decision target: **GO only for preparation; NO-GO for public Blog HE activation**.

Stage41 GO conditions:

- Stage41 SQL exists in draft/apply/verify form.
- Draft/apply SQL is additive and does not use destructive `DROP` operations.
- Blog list/detail code has strict HE record-gating.
- Blog CTA links do not carry HE into Shop or non-ready Blog destinations.
- Blog and BlogPost remain BLOCKED in the live page registry.
- SEO HE remains off.
- Shop remains excluded.
- Booking/payment tests are not affected.

Stage42 GO conditions:

- Human review has approved top five HE posts.
- `he_blog_stage41_public_read_apply.sql` has been manually run.
- `he_blog_stage41_public_read_verify.sql` reports:
  - review columns present;
  - public policy gated by `review_status='public_ready'`;
  - `public_ready_he_rows = 5`;
  - duplicate HE slug query returns zero rows.
- Blog list/detail record-gated smoke passes with SEO HE still off.

Stage42 NO-GO conditions:

- Any HE blog row is public-readable without `public_ready`.
- Blog list shows EN fallback posts in HE.
- Blog detail falls back to EN for a non-ready HE slug.
- Shop/cart/checkout/payment receives `lang=he`.
- Sitemap, hreflang, canonical, OpenGraph or indexing expose HE.

## Stage 42 Blog Human Review Gate

Current decision: **NO-GO for Blog HE public activation; GO for manual SQL
preparation**.

Observed state:

- Supabase preview currently reports `public_ready_he_rows = 0`.
- Blog and BlogPost must remain `blocked` until top-five public-ready marking is
  applied and verified.

Prepared Stage42 files:

- `supabase/manual/he_blog_stage42_mark_top5_public_ready_draft.sql`
- `supabase/manual/he_blog_stage42_mark_top5_public_ready_apply.sql`
- `supabase/manual/he_blog_stage42_public_ready_verify.sql`

Stage42 GO for record-gated Blog smoke requires:

1. `he_blog_stage41_public_read_apply.sql` committed.
2. Human/native review accepted for all five top posts.
3. `he_blog_stage42_mark_top5_public_ready_apply.sql` committed manually.
4. `he_blog_stage42_public_ready_verify.sql` reports
   `public_ready_he_rows = 5`.
5. Duplicate HE slug check returns zero rows.
6. Parent-not-public check returns zero rows.
7. SEO HE and Shop HE remain off.

Rollback:

- Reset the affected top-five HE rows from `public_ready` to `reviewed` or
  `needs_review`.
- Keep Blog/BlogPost as `blocked`.
- Existing Home, READY and record-gated non-Blog HE pages remain unchanged.

## Stage 43 Manual Translation Gate

Decision: **GO for system/workflow completion; NO-GO for automatic Blog
publication**.

Rules:

- Codex must not auto-translate full Blog posts.
- Codex must not mark Blog rows `public_ready` without explicit human review
  confirmation.
- Blog list/detail stay blocked until reviewed rows are manually marked and
  verified.
- Shop remains excluded.
- SEO HE remains off.

GO conditions for a future Blog rollout:

1. Human/native review completed for specific Blog posts.
2. Stage41 public-read gate applied.
3. Stage42 public-ready marking applied only for reviewed posts.
4. Stage42 verify shows the expected public-ready count and zero safety issues.
5. Blog smoke tests pass for list/detail/not-ready fallbacks.

NO-GO conditions:

- A post is machine-translated but not reviewed.
- A long text is incomplete, fallback-heavy or mixed EN/HE.
- CTA links carry HE to Shop or blocked pages.
- Any SEO HE surface is generated before the SEO stage.

## Stage 44 Tri-Lingual Static UI Gate

Decision: **GO for static UI structure; NO-GO for unreviewed content
publication**.

Stage44 GO checks:

- `PL keys missing EN = 0`.
- `placeholderMismatches = 0`.
- `htmlTagMismatches = 0`.
- No empty or null translation values.
- Existing page-gated HE pages remain unchanged.

Stage44 NO-GO checks for broader launch:

- Remaining HE missing keys are still `216`.
- Same-as-EN HE keys are `690`; many are legacy/static fleet labels now visible
  after EN fallback completion and require human review.
- Blog remains blocked until `public_ready` is manually applied and verified.
- Shop remains excluded.
- SEO HE remains off.

Next gate before broader public HE:

1. Manual review and content completion for Blog/dynamic content.
2. Dedicated Shop decision.
3. SEO HE sitemap/hreflang/canonical stage only after real HE content is ready.

## Stage 45 Manual Review Workflow Gate

Decision: **GO for review tooling; NO-GO for automatic publication**.

GO:

- `translations/manual-review/` packs are generated.
- Static import is dry-run by default.
- Placeholder and HTML tag validation run before static JSON apply.
- Dynamic/database content remains admin UI or reviewed SQL only.

NO-GO:

- Any Blog row marked `public_ready` without human review.
- Any Shop checkout/payment HE activation.
- Any SEO/sitemap/hreflang/canonical/indexing HE activation.
- Any booking/payment/transport deposit code change as part of translation work.

Current pack summary:

| Area | Records |
| --- | ---: |
| Static UI | 801 |
| Advertise | 235 |
| SEO | 122 |
| Shop | 96 |
| Email/payment templates | 506 |
| Dynamic content | 237 |
| Blog | 21 |

Blog remains `BLOCKED`, Shop remains `EXCLUDED`, and SEO HE remains `OFF`.

## Stage 46 Shop GO / NO-GO

Decision: **NO-GO for Shop HE; GO for keeping Shop safely excluded**.

GO conditions satisfied for current safety posture:

- Shop remains `excluded` in the page readiness registry.
- `shopEnabled:false` remains in the rollout config.
- `shop.html?lang=he` resolves to EN/LTR.
- Shop switcher does not expose HE.
- Cart, checkout, shipping, discount, payment and order confirmation do not
  enter RTL/HE.
- Home/nav/CTA links to Shop normalize to EN/LTR.
- Booking/payment, transport deposit, partner fulfillment and Stripe webhook
  logic were not changed.

NO-GO conditions for future Shop HE:

- Any checkout/payment surface shows HE before manual review.
- Any dynamic Shop record is treated as Hebrew solely because it has
  same-as-EN fallback text.
- Any Shop email/payment/order template has missing HE or placeholder mismatch.
- Any Shop link carries `lang=he` from Home, Blog, Recommendations or POI before
  Shop is explicitly approved.

Manual review debt before Shop HE:

| Area | Count |
| --- | ---: |
| Static Shop review records | 96 |
| Missing static HE | 3 |
| Shop email/payment/order records | 3 |
| Dynamic Shop records requiring review | 18 |

Next allowed Shop-related stage is planning/review only, or a dedicated Shop HE
implementation stage after full manual content review and payment QA.

## Stage 47 SEO GO / NO-GO

Decision: **GO for SEO architecture preparation; NO-GO for SEO activation**.

GO:

- Central guard exists in `functions/_utils/heSeoReadiness.js`.
- `npm run seo:he-guard` verifies that HE SEO remains hidden while flags are
  disabled.
- SEO candidate pages are defined.
- Blog remains blocked.
- Shop/cart/checkout/payment remain excluded.
- `/he/` routes remain non-public.

NO-GO:

- Turning on `seoEnabled`, `sitemapEnabled`, `hreflangEnabled`,
  `canonicalEnabled` or `indexingEnabled` before a dedicated SEO activation
  stage.
- Adding HE sitemap entries for Blog, Shop, checkout/payment, admin/partners or
  fallback-only pages.
- Adding `hreflang="he"` for record detail pages whose record is not HE-ready.
- Adding Blog HE SEO before manually reviewed `public_ready` rows exist.

Rollback for a future SEO activation:

1. Set every HE SEO flag back to `false`.
2. Keep `/he/` redirects active.
3. Purge Cloudflare cache.
4. Re-run `npm run seo:he-guard` and `npm run seo:audit`.

## Stage 48 SEO GO / NO-GO

Decision: **GO for controlled SEO HE on ready pages only**.

GO:

- HE sitemap includes only Home, transport, hotels, recommendations, car and
  trips static ready URLs.
- HE canonical and `hreflang="he"` are generated only for allowed pages and
  HE-ready detail records.
- Blog and BlogPost remain excluded from HE SEO.
- Shop/cart/checkout/payment remain excluded from HE SEO.
- `/he/` routes remain non-public.
- not-ready records do not generate HE SEO.
- `npm run seo:he-guard`, `npm run seo:audit`, `npm test` and HE page-gated
  Playwright smoke passed.

NO-GO:

- Global HE.
- Blog HE public read or Blog HE SEO.
- Shop HE, checkout/cart/payment RTL or Shop HE SEO.
- Sitemap/hreflang/canonical HE for not-ready records.
- Any public `/he/` route.

Rollback:

1. Set `CE_HE_SEO_ENABLED=false` or disable HE SEO surfaces in
   `CE_HE_SEO_ROLLOUT_CONFIG`.
2. Purge Cloudflare cache.
3. Verify with `npm run seo:he-guard` and `npm run seo:audit`.

## Stage 49 Live SEO GO / NO-GO

Decision target: **GO only after production sitemap/canonical/hreflang/OG prove
that HE SEO is limited to ready pages**.

GO criteria:

- sitemap contains HE only for Home, transport, hotels, HE-ready hotel detail,
  recommendations, car, trips and HE-ready trip detail;
- Blog and `/blog/*` have no HE sitemap, canonical, hreflang or OpenGraph;
- Shop/cart/checkout/payment have no HE sitemap, canonical, hreflang or
  OpenGraph;
- public `/he/` routes redirect/fallback and do not serve assets from `/he/js`;
- server HTML for allowed HE pages has `lang="he"` and `dir="rtl"`;
- not-ready records do not generate HE SEO;
- booking/payment regression tests still pass.

NO-GO:

- any Blog HE canonical/OG/hreflang before manual `public_ready` review;
- any Shop/checkout/payment HE or RTL exposure;
- any `/he/` route in sitemap;
- any not-ready record indexed as HE.

Stage49 hotfix adds regression coverage for server RTL and blocked Blog detail
HE metadata leakage.
