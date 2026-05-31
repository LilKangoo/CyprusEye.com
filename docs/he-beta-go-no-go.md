# HE Beta GO / NO-GO

Generated: 2026-05-31T17:56:55.607Z

HE remains internal/beta-only. This document does not enable public HE,
sitemap, hreflang, canonical metadata, SEO, indexing, the public language
switcher, or public `/he/` routes.

## Dynamic Content Decision Table

| Module | Status | Decision |
| --- | --- | --- |
| Trips | BLOCKED | Trips: hide from first HE beta or keep EN-only until dynamic HE content is added. |
| Hotels | READY | Hotels: can enter controlled beta for HE preview, with remaining fallback tracked. |
| Cars | PARTIAL | Cars: beta only with explicit EN fallback acceptance; translate top records before broader beta. |
| Transport | READY | Transport: can enter controlled beta for HE preview, with remaining fallback tracked. |
| Blog | PARTIAL | Blog: beta only with explicit EN fallback acceptance; translate top records before broader beta. |
| POI | BLOCKED | POI: hide from first HE beta or keep EN-only until dynamic HE content is added. |
| Recommendations | PARTIAL | Recommendations: beta only with explicit EN fallback acceptance; translate top records before broader beta. |
| Shop | BLOCKED | Shop: hide from first HE beta or keep EN-only until dynamic HE content is added. |

## Controlled Beta Now

- Hotels
- Transport

These modules can be exercised in controlled beta only within the existing
internal/beta guard and with hidden HE preview/allowlist behavior.

## Requires Translation Before Wider Beta

- Cars
- Blog
- Recommendations

## Hide Or Keep EN-Only In First HE Beta

- Trips
- POI
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
