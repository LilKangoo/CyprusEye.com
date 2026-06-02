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
