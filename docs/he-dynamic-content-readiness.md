# HE Dynamic Content Readiness

Generated: 2026-05-31T22:45:19.979Z
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
| Recommendations | 10 | 10 | 0 | 0 | 0 | 100.0% |
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
| Recommendations | 10 | 10 | 0 | 0 | 100.0% | READY after Stage 25 SQL completes remaining active records and category labels. |
| POI | 139 | 10 | 0 | 129 | 7.2% | PARTIAL: expose only the top 10 translated POI; global map still needs more HE content. |
| Shop | 30 | 0 | 0 | 30 | 0.0% | EXCLUDED from first public HE launch; checkout/payment remain EN/LTR. |

Stage 25 manual SQL:

- Apply/top-up: `supabase/manual/he_public_ready_dynamic_stage25.sql`
- Verify after apply: `supabase/manual/he_public_ready_dynamic_stage25_verify.sql`

Stage 28 status:

- Stage25 SQL was manually applied and verified for the page-gated scope.
- Runtime config now uses `stage25SqlApplied:true`.
- Transport, Hotels, Hotel detail and Recommendations can be treated as READY
  for page-gated HE tests.
- Home, Cars, Trips, Trip detail and POI/map remain PARTIAL-safe only.
- Blog, Plan, Community, Account/Auth, Legal, 404 and unknown pages remain
  BLOCKED.
- Shop, Partners and Admin remain EXCLUDED.
- SEO HE, sitemap HE, hreflang HE, canonical HE, indexing HE and public `/he/`
  routes remain off.

Stage 29 page-gated rollout status:

- READY pages can expose HE publicly through the page-gated switcher:
  - Transport
  - Hotels
  - Hotel detail
  - Recommendations
- PARTIAL-safe modules remain internal/beta-only:
  - Home aggregate modules
  - Cars
  - Trips
  - Trip detail
  - POI/map flow
- BLOCKED dynamic modules remain blocked:
  - Blog and Blog detail
  - Plan/community/account/legal/404/unknown flows
- EXCLUDED modules remain excluded:
  - Shop/cart/checkout/payment
  - Partners
  - Admin

## Stage 32 PARTIAL Page Gap Table

Stage32 prepares, but does not activate, the next page-gated expansion.

| Module/page | Missing HE fields/content | Safe EN fallback fields | Human review needed | Schema gap | Ready after small fix |
| --- | --- | --- | --- | --- | --- |
| Home | Mixed child modules: Cars, Trips, POI/map and links to blocked/excluded pages. | Static UI and READY module links can fallback safely. | Yes, for visible module selection and CTA wording. | No. | No, needs module curation. |
| Cars | Car feature/options/descriptions and booking copy review across 27 partial records. | Brand/model names can remain unchanged. | Yes. | No known schema gap. | Yes, if top cars are curated. |
| Trips listing | 9 of 12 trip records still fallback to EN. | Prices/location labels and static booking UI fallback safely. | Yes, for top trip copy and listing visibility. | No known schema gap. | No, unless listing is record-gated. |
| Trip detail | Only selected/top trip details are HE-ready. | Non-translated itinerary/highlights/FAQ can fallback technically, but should not be broad public HE. | Yes. | No known schema gap. | Yes for translated records only. |
| POI/map | 129 of 139 POI fallback to EN; map/category surfaces need gating. | Top 10 POI and ready recommendations are safe. | Yes. | No known schema gap. | No for global map; yes for a limited top-POI view. |

Link behavior after Stage32:

- READY -> READY links may keep `lang=he`.
- READY -> PARTIAL public-disabled, BLOCKED or EXCLUDED links normalize to
  `lang=en`.
- Blog remains BLOCKED and Shop remains EXCLUDED.
- SEO HE remains off.

## Stage 33 Record-Gated Content Scope

Stage33 prepares selected dynamic records for the next page-gated expansion. It
does not enable these pages publicly yet.

Prepared SQL:

- `supabase/manual/he_partial_pages_stage33.sql`
- `supabase/manual/he_partial_pages_stage33_verify.sql`

| Module/page | Selected scope | HE requirement | Runtime gate |
| --- | ---: | --- | --- |
| Cars | 5 top car records | `features.he` required; brand/model fallback accepted; optional `description_i18n.he` if schema exists. | `filterRecordsReadyForLanguage(records, 'car', 'he')` |
| Trips listing | 3 top trip records | `title.he` and `description.he` required; itinerary/highlights/FAQ required only if those fields exist. | `filterRecordsReadyForLanguage(records, 'trip', 'he')` |
| Trip detail | Per loaded slug | Same trip readiness check as listing. | Direct HE for unready slug normalizes to EN. |
| POI/map | 10 top POI | `name_i18n.he`, `description_i18n.he`, `badge_i18n.he` required. | `filterRecordsReadyForLanguage(records, 'poi', 'he')` |
| Home | Aggregates child modules | Home may reuse gated cars/trips/POI and READY destinations only. | Keep PARTIAL until Blog/Shop previews are curated. |

Stage33 decisions:

- Car can become **CANDIDATE READY** after Stage33 SQL is committed and reviewed.
- Trips and Trip detail can become **RECORD-GATED READY** after Stage33 SQL is
  committed and reviewed.
- POI/map can become **RECORD-GATED READY** only as a limited HE-ready POI view.
- Home remains **PARTIAL** until section-level visibility is finalized.
- Blog remains **BLOCKED**. Shop remains **EXCLUDED**.

Stage33.5 verify status:

- Initial verify SQL failed on the car detail query because the model label
  expression mixed JSONB model fields with text fallback fields in one
  `COALESCE`.
- `supabase/manual/he_partial_pages_stage33_verify.sql` now converts each model
  candidate to text via `to_jsonb(...)` plus a temporary text-label helper.
- Stage33 content is still only prepared; it is not verified until the repaired
  verify script passes in Supabase after a reviewed COMMIT.

Stage34 apply/verify status:

- Stage33 preview has shown the expected counts: trips `3`, cars `5`, POI `10`.
- Stage33 data was manually committed in Supabase after human review.
- `supabase/manual/he_partial_pages_stage33_verify.sql` passed cleanly after
  the JSONB/text COALESCE fix.
- Blog remains BLOCKED and Shop remains EXCLUDED from this data pack.

Stage35 dynamic verification:

- `scripts/verify-he-stage33-data.js` performs a read-only Supabase anon check
  of the exact Stage33 selected records.
- It confirmed trips `3/3`, cars `5/5` and POI `10/10` are HE-ready for the
  narrow record-gated scope.
- No public HE switcher, global HE, SEO, sitemap, hreflang, canonical,
  indexing, Blog HE or Shop HE was enabled by this verification.

| Module/page | Verified HE-ready scope | Stage35 recommendation |
| --- | ---: | --- |
| Cars | 5 top car records | RECORD-GATED READY candidate; keep page status PARTIAL until Etap 36 approval. |
| Trips listing | 3 top trip records | RECORD-GATED READY candidate with list filtering. |
| Trip detail | 3 selected slugs only | RECORD-GATED READY per record; unready slugs must fall back to EN/LTR. |
| POI/map | 10 top POI | RECORD-GATED READY candidate limited to the verified POI set. |
| Home | Aggregated modules | Keep PARTIAL until Blog/Shop preview decisions are solved. |

## Stage 36 Record-Gated Public Scope

Stage36 uses the verified Stage33 records for a controlled public page-gated
expansion without enabling all PARTIAL pages.

Runtime rules:

- Cars: filter to HE-ready car records; current verified top scope is `5/5`.
- Trips: filter listing to HE-ready trip records; current verified top scope is
  `3/3`.
- Trip detail: allow HE only for loaded records that pass the trip readiness
  helper; unready records normalize to EN/LTR.
- POI/map: filter POI data to HE-ready POI; current verified top scope is
  `10/10`.
- Home stays PARTIAL and public HE remains blocked.
- Blog stays BLOCKED and Shop stays EXCLUDED.

Dynamic content still needed before full launch:

- Remaining 9 trips outside the top 3.
- Remaining car records outside the top 5 if the full fleet should appear in HE.
- Remaining POI outside the top 10 if the full map should appear in HE.
- Blog translations and Shop product/checkout content remain separate blockers.

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
| Hotel amenities dictionary | 48 | 48 | 0 | 0 | 0 | 100.0% |
| POI categories | 23 | 23 | 0 | 0 | 0 | 100.0% |
| Recommendation categories | 15 | 15 | 0 | 0 | 0 | 100.0% |

## Main Risks

- Blog has no full HE post experience unless blog_post_translations contains reviewed lang=he rows for selected posts.
- Shop should remain out of the first HE beta unless EN fallback is explicitly accepted; paid checkout copy must not depend on unreviewed dynamic labels.
- POI/map flow is still partial because only 10 of 139 POI are fully HE-ready,
  even though category dictionaries are now complete.
- Hotel amenities dictionary is now HE-ready after Stage25; keep hotel runtime
  smoke in the page-gated QA checklist.
- Trips/hotels/cars can technically render via fallback, but top offer records still need manual HE for content-quality beta.

## Next Dynamic Translation Order

1. Blog HE translations for top posts: title, slug, lead, summary, content and categories/tags.
2. Shop product/category/vendor/shipping/discount labels, because checkout is customer-facing.
3. POI names/descriptions/badges and POI category labels for map/recommendations flows.
4. Recommendations titles/descriptions/categories and offer/discount text.
5. Transport location names, then route smoke tests.
6. Trips/hotels/cars top records and room/offer detail labels.

## Stage 37 Record-Gated Dynamic Scope

Status on 2026-06-02: **Stage33 dynamic content is verified and live-monitored
for the selected record-gated scope**.

| Module | Verified HE-ready records | Public decision |
| --- | ---: | --- |
| Cars | 5 | Eligible for record-gated HE after deploy. |
| Trips listing | 3 | Eligible for record-gated HE after deploy; non-ready trips stay hidden from HE links. |
| Trip detail | 3 | Eligible per record; unready slugs must normalize to EN/LTR. |
| POI/map | 10 | Eligible for filtered HE flow; remaining POI are not globally HE-ready. |

Live Stage37 smoke confirmed Car, Trips and HE-ready Trip detail in HE/RTL.
Unready Trip detail normalized back to EN/LTR. Existing READY pages were
unchanged.

Runtime note: the first live smoke showed Trips using EN titles despite HE-ready
data. The issue was the legacy language helper, not Supabase content. After
updating `languageSwitcher.js` to use the central rollout guard, local smoke
shows the Stage33 trip titles in Hebrew.

Modules unchanged:

- Transport, Hotels, Hotel detail and Recommendations remain READY from the
  existing page-gated rollout.
- Home remains PARTIAL because it aggregates Blog, Shop and mixed module
  previews.
- Blog remains BLOCKED until public HE read/content/routing/SEO gates are
  explicitly solved.
- Shop remains EXCLUDED; cart, checkout and payment must stay EN/LTR.

Dynamic rollback for Stage37:

- Turn `recordGatedPagesPublic:false` to return Cars, Trips, Trip detail and
  POI/map to non-public partial status.
- Do not remove Stage33 HE data; it is additive and can remain in Supabase.

## Stage 38 Home Aggregation Dynamic Scope

Status: **prepared, not public**. Home remains PARTIAL and public `?lang=he`
continues to normalize away unless a future stage explicitly allows partial Home.

Home dynamic aggregation policy:

| Home module | Dynamic source | Stage38 policy |
| --- | --- | --- |
| Transport | `transport_locations`, route/quote UI | Visible candidate; data is READY. Deposit/payment flow unchanged. |
| Hotels | `hotels`, `hotel_amenities` | Visible candidate; Stage25 data is READY. |
| Recommendations | `recommendations`, `recommendation_categories` | Visible candidate; Stage25 data is READY. |
| Cars | car offers | Visible only through Stage33 top 5 / record-gated filtering. |
| Trips | trip records | Visible only through Stage33 top 3 / record-gated filtering. |
| POI/map | POI and category data | Visible only through Stage33 top 10 / record-gated filtering. |
| Blog preview | `blog_posts`, `blog_post_translations` | Hidden on HE Home until Blog public HE is solved. |
| Shop preview/cart | products/cart/checkout | Excluded from HE Home; links normalize to EN/LTR. |
| Plan/community/tasks/packing | utility pages | Hidden or EN/LTR until separately prepared. |

Dynamic readiness impact:

- Existing READY and record-gated modules are unchanged.
- Home is now a stronger **CANDIDATE** from a link/visibility standpoint, but it
  should remain `PARTIAL` until an explicit Home deploy smoke passes.
- Blog and Shop dynamic content remain the main blockers for full Home HE.

## Stage 39 Home Dynamic Rollout Scope

Status: **controlled Home rollout scope prepared**.

Home uses only dynamic modules that are already READY or record-gated:

| Home module | Stage39 dynamic policy |
| --- | --- |
| Transport | Visible; dynamic location/route labels are READY. |
| Hotels | Visible; hotel and amenity data are READY after Stage25. |
| Recommendations | Visible; active recommendation/category data are READY after Stage25. |
| Cars | Visible through Stage33 top-record gating; unready records must not create broken HE cards. |
| Trips | Visible through Stage33 top-record gating; unready records must not create HE links. |
| POI/map | Visible through Stage33 top 10 POI and category gating. |
| Blog preview | Hidden on Home HE because Blog remains BLOCKED. |
| Shop/cart/checkout/payment | Excluded and normalized to EN/LTR. |
| Plan/community/packing/tasks/legal | Hidden or normalized to EN/LTR until separately prepared. |

Dynamic content still blocking wider launch:

- Blog posts and Blog post detail need public HE read, reviewed content and SEO
  routing before they can leave BLOCKED.
- Shop needs product/category/vendor/shipping/discount and checkout/payment QA
  before it can leave EXCLUDED.
- Full POI/map remains partial because only selected POI are HE-ready.

Rollback for Home dynamic scope:

- Set Home back to `partial` in the rollout config.
- Keep Stage25/Stage33 data in Supabase; the data is additive and should not be
  removed during UI rollback.
