# HE Beta GO / NO-GO

Generated: 2026-05-29T19:32:24.297Z

HE remains internal/beta-only. This document does not enable public HE,
sitemap, hreflang, canonical metadata, SEO, indexing, the public language
switcher, or public `/he/` routes.

## Dynamic Content Decision Table

| Module | Status | Decision |
| --- | --- | --- |
| Trips | BLOCKED | Trips: hide from first HE beta or keep EN-only until dynamic HE content is added. |
| Hotels | PARTIAL | Hotels: beta only with explicit EN fallback acceptance; translate top records before broader beta. |
| Cars | PARTIAL | Cars: beta only with explicit EN fallback acceptance; translate top records before broader beta. |
| Transport | BLOCKED | Transport: hide from first HE beta or keep EN-only until dynamic HE content is added. |
| Blog | BLOCKED | Blog: hide from first HE beta or keep EN-only until dynamic HE content is added. |
| POI | PARTIAL | POI: beta only with explicit EN fallback acceptance; translate top records before broader beta. |
| Recommendations | PARTIAL | Recommendations: beta only with explicit EN fallback acceptance; translate top records before broader beta. |
| Shop | BLOCKED | Shop: hide from first HE beta or keep EN-only until dynamic HE content is added. |

## Controlled Beta Now

- None as a full Hebrew dynamic-content experience.

These modules can be exercised in controlled beta only within the existing
internal/beta guard and with hidden HE preview/allowlist behavior.

## Requires Translation Before Wider Beta

- Hotels
- Cars
- POI
- Recommendations

## Hide Or Keep EN-Only In First HE Beta

- Trips
- Transport
- Blog
- Shop

## GO Conditions For Etap 15+

- HE remains hidden from public switchers and SEO surfaces until explicitly approved.
- Top dynamic records in beta scope have HE or an accepted EN fallback.
- Shop is not included in first customer beta until product, category, vendor,
  shipping and discount labels are reviewed.
- Blog is not treated as a Hebrew blog experience until HE rows exist in
  `blog_post_translations` for selected posts.
- POI/recommendations/map beta needs HE names/descriptions/categories for the top visible records.

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
