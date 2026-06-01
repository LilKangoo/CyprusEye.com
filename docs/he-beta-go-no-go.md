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
