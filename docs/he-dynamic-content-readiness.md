# HE Dynamic Content Readiness

Generated: 2026-05-31T18:53:40.374Z
Source: read-only Supabase anon queries against public/beta-visible records.

HE remains internal/beta-only. This audit does not enable HE in the public
switcher, sitemap, hreflang, canonical metadata, SEO, indexing, or public
`/he/` routes.

Field readiness is calculated as translated HE fields divided by expected
localized dynamic fields. "EN fallback-only" means the record has no HE dynamic
fields but can fall back to EN/PL source content without blank UI.

## Module Summary

| Module | Records | HE complete | HE partial | EN fallback-only | Missing/no fallback | Field readiness |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Trips | 12 | 3 | 0 | 9 | 0 | 25.0% |
| Hotels | 2 | 2 | 0 | 0 | 0 | 100.0% |
| Cars | 27 | 0 | 27 | 0 | 0 | 54.2% |
| Transport | 44 | 44 | 0 | 0 | 0 | 100.0% |
| Blog | 21 | 0 | 5 | 16 | 0 | 7.7% |
| POI | 139 | 10 | 0 | 129 | 0 | 7.2% |
| Recommendations | 10 | 5 | 3 | 2 | 0 | 63.6% |
| Shop | 30 | 0 | 0 | 30 | 0 | 0.0% |

## Public-ready Dynamic Content Scope

Stage 25 does not enable public HE. It defines the first content scope that can
be considered for page-gated HE after manual SQL/editorial review.

| Module | Total records | HE complete | HE partial | EN fallback | Readiness | Public launch decision |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Transport | 44 | 44 | 0 | 0 | 100.0% | READY after route/location smoke; dynamic labels resolve from `transport_locations.name_he`. |
| Hotels | 2 | 2 | 0 | 0 | 100.0% | READY TECH after Stage 25 amenity dictionary SQL; keep SEO off until final phase. |
| Blog | 21 | 0 | 5 | 16 | 7.7% | BLOCKED for public read until reviewed HE rows exist for launch posts and RLS/public policy is intentionally opened. |
| Trips | 12 | 3 | 0 | 9 | 25.0% | PARTIAL: page-gate to 3 translated trips; do not expose all 12 as HE. |
| Cars | 27 | 0 | 27 | 0 | 54.2% | PARTIAL: page-gate to 5 reviewed cars; brand/model fallback is acceptable, features/descriptions need review. |
| Recommendations | 10 | 5 | 3 | 2 | 63.6% | READY after Stage 25 SQL completes remaining active records and category labels. |
| POI | 139 | 10 | 0 | 129 | 7.2% | PARTIAL: expose only the top 10 translated POI; global map still needs more HE content. |
| Shop | 30 | 0 | 0 | 30 | 0.0% | EXCLUDED from first public HE launch; checkout/payment remain EN/LTR. |

Stage 25 manual SQL:

- Apply/top-up: `supabase/manual/he_public_ready_dynamic_stage25.sql`
- Verify after apply: `supabase/manual/he_public_ready_dynamic_stage25_verify.sql`

## Requested Area Notes

### Trips

- Records visible to public/beta read: 12
- Fields audited: title, description, itinerary/highlights/FAQ only when those fields exist on rows.
- Current schema/data probe: itinerary/highlights/FAQ HE fields were not present on returned rows.
- Booking labels are static P0 keys and are covered by Etap 13 tests.

### Hotels

- Records visible to public/beta read: 2
- Fields audited: title, description, booking policy/stay info, pricing extras, room type labels and rate-plan labels.
- Amenities are stored as hotel amenity codes/dictionary records; see support table readiness below.
- Room descriptions/rate-plan text are included when present in `room_types`.

### Cars

- Records visible to public/beta read: 27
- Fields audited: car model, car type, description and features.
- Rental conditions, extras and insurance amounts are mostly static/numeric UI copy; static P0 is covered separately.

### Transport

- Active locations visible to public/beta read: 9
- Routes visible to public/beta read: 44
- Dynamic HE coverage is driven by `transport_locations.name_he`.
- Forms and confirmations are static P0 keys and were translated in Etap 13.

### Blog

- Published posts visible to public/beta read: 21
- Public translations visible to read: 42
- Full HE blog translations: 0
- Partial HE blog translations/taxonomy visible to anon audit: 5
- EN/PL fallback-only blog posts in anon audit: 16
- Posts with categories_he: 5
- Posts with tags_he: 5
- Fields audited: HE translation title, slug, summary, lead, content_html, categories_he and tags_he.
- Note: migration 179 intentionally keeps `blog_post_translations.lang = 'he'`
  hidden from public anon reads until the final public rollout gate.

### POI

- Records visible to public/beta read: 139
- Fields audited: `name_i18n.he`, `description_i18n.he`, `badge_i18n.he`.
- Category dictionary coverage is shown in support tables.

### Recommendations

- Records visible to public/beta read: 10
- Fields audited: title_he, description_he, category name_he, discount_text_he and offer_text_he when source text exists.
- CTA labels are static UI and remain governed by P0 static translations.

### Shop

Shop is the highest-risk module because customer-visible copy is split across
products, categories, variants, vendors, attributes, shipping and discounts.

| Shop entity | Records | HE complete | HE partial | EN fallback-only | Missing/no fallback | Field readiness |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Products | 10 | 0 | 0 | 10 | 0 | 0.0% |
| Categories | 3 | 0 | 0 | 3 | 0 | 0.0% |
| Variants | 0 | 0 | 0 | 0 | 0 | 0.0% |
| Vendors | 2 | 0 | 0 | 2 | 0 | 0.0% |
| Shipping classes | 4 | 0 | 0 | 4 | 0 | 0.0% |
| Shipping zones | 3 | 0 | 0 | 3 | 0 | 0.0% |
| Shipping methods | 3 | 0 | 0 | 3 | 0 | 0.0% |
| Discount labels | 0 | 0 | 0 | 0 | 0 | 0.0% |
| Attributes | 1 | 0 | 0 | 1 | 0 | 0.0% |
| Attribute values | 4 | 0 | 0 | 4 | 0 | 0.0% |

## Support Dictionaries

| Dictionary / support table | Records | HE complete | HE partial | EN fallback-only | Missing/no fallback | Field readiness |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Transport locations | 9 | 9 | 0 | 0 | 0 | 100.0% |
| Hotel amenities dictionary | 48 | 0 | 0 | 48 | 0 | 0.0% |
| POI categories | 23 | 6 | 0 | 17 | 0 | 26.1% |
| Recommendation categories | 15 | 10 | 0 | 5 | 0 | 66.7% |

## Main Risks

- Blog has no full HE post experience unless blog_post_translations contains reviewed lang=he rows for selected posts.
- Shop should remain out of the first HE beta unless EN fallback is explicitly accepted; paid checkout copy must not depend on unreviewed dynamic labels.
- POI/recommendations map flows need HE names/descriptions/categories before they feel like a Hebrew experience.
- Hotel amenities dictionary currently lacks name_he schema support, so amenities fall back even if hotel title/description are translated.
- Trips/hotels/cars can technically render via fallback, but top offer records still need manual HE for content-quality beta.

## Next Dynamic Translation Order

1. Blog HE translations for top posts: title, slug, lead, summary, content and categories/tags.
2. Shop product/category/vendor/shipping/discount labels, because checkout is customer-facing.
3. POI names/descriptions/badges and POI category labels for map/recommendations flows.
4. Recommendations titles/descriptions/categories and offer/discount text.
5. Transport location names, then route smoke tests.
6. Trips/hotels/cars top records and room/offer detail labels.
