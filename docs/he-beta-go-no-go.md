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
