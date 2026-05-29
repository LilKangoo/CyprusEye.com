# HE P0 Translation Plan

Prepared: 2026-05-29
Source audit: `translations/audit-he-vs-en.json`
Machine-readable readiness: `translations/he-readiness-report.json`

HE remains internal/hidden. This plan does not enable HE in the public switcher,
selectors, sitemap, hreflang, canonical metadata, public SEO, indexing, or `/he/`
routes.

## Current Static Translation Baseline

| Metric | Count |
| --- | ---: |
| EN base keys | 2815 |
| HE keys | 1557 |
| HE keys matching EN keys | 1312 |
| Missing HE keys | 1503 |
| Extra HE keys | 245 |
| HE keys identical to EN and needing review | 936 |

Static key coverage against EN is `46.6%` by key existence
(`1312 / 2815`). Conservative review-adjusted coverage is `13.4%`
(`376 / 2815`) because the report currently treats same-as-EN values as
`needs_human_review`.

## Rollout Priority Counts

These counts use the same exclusive grouping model as
`scripts/report-he-readiness.js`. Each key is counted once.

| Priority | Scope | Total EN keys | Present in HE | Missing HE | Same as EN / review | Coverage |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| P0 | Critical beta user paths | 1486 | 603 | 883 | 376 | 40.6% |
| P1 | Public content shell, partner, SEO prep | 785 | 192 | 593 | 89 | 24.5% |
| P2 | Admin/internal dashboard copy | 27 | 0 | 27 | 0 | 0.0% |
| P3 | Low-priority/internal remainder | 517 | 517 | 0 | 471 | 100.0% |

## P0 Breakdown

P0 is the controlled-beta blocker. These groups should be completed before a
real Hebrew beta is shown to testers as a Hebrew experience.

| P0 group | Missing HE | Same as EN / review | User impact | Beta decision |
| --- | ---: | ---: | --- | --- |
| Critical UI / navigation | 107 | 10 | Header, navigation, global buttons, modals, mobile nav, accessibility labels. | Required for beta. No blank or English-first chrome in primary navigation. |
| Errors / validation | 196 | 83 | Form validation, loading states, status text, errors and success messages across flows. | Required for beta. Users must understand blocking states and submissions. |
| Booking flows | 380 | 251 | Transport, cars, trips, hotels, coupons and booking steps. | Required for beta on any enabled booking path. |
| Auth | 110 | 32 | Sign in, reset, account, profile and referral entry points. | Required for beta if testers sign in or save data. |
| Checkout / shop | 90 | 0 | Cart, checkout, product, shipping and purchase labels. | Required before shop is included in HE beta. |

Exact key lists are intentionally kept in JSON instead of duplicating 883 lines
in Markdown:

- `translations/he-readiness-report.json -> missingKeyGroups.*.keys`
- `translations/he-readiness-report.json -> keysByStatus.missing`
- `translations/he-readiness-report.json -> keysByStatus.needs_human_review`

## Functional Translation Order

This is the recommended work order for translators and review. The validation
row is cross-cutting and overlaps with the functional modules, so it is a QA
slice, not an additive total.

| Rank | Module / slice | Missing keys | Review keys | Priority | Notes |
| ---: | --- | ---: | ---: | --- | --- |
| 1 | Navigation/global UI | 107 | 10 | P0 | First visible impression: header, nav, mobile, common buttons, modals. |
| 2 | Auth/account | 120 | 55 | P0 | Required for logged-in beta, partner/admin handoff and user state. |
| 3 | Validation/status/errors | 203 | 84 | P0 | Translate together after each module batch to avoid mixed-language blockers. |
| 4 | Checkout/shop | 94 | 0 | P0 | Shop has no HE static coverage yet; keep shop out of beta until done. |
| 5 | Transport booking | 205 | 0 | P0 | High-risk form flow with many labels, statuses and quote messages. |
| 6 | Cars | 222 | 176 | P0 | Large review load; booking modal, coupon, estimates and validation. |
| 7 | Trips/hotels booking | 32 | 0 | P0 | Smaller static set, but dynamic content still needs manual HE. |
| 8 | Coupon/booking support | 36 | 77 | P0 | Coupon nav/status copy used inside booking and checkout contexts. |
| 9 | Blog / public content shell | 377 | 74 | P1 | Can fall back to EN in controlled beta, but public launch needs review. |
| 10 | SEO/static meta | 53 | 20 | P1 | Prepare only. Do not activate HE SEO yet. |
| 11 | Partner panel | 228 | 4 | P1/P2 depending on beta scope | Required only if partner users are in HE beta. |
| 12 | Admin/internal | 29 | 0 | P2 | Internal only; can stay EN during customer-facing beta. |

## Required vs Fallback vs Internal

### Absolutely required before controlled HE beta

- P0 missing keys: `883`
- P0 same-as-EN review keys: `376`
- Total P0 translation/review work items: `1259`

Required key families:

- `accessibility`, `common`, `header`, `language`, `mobile`, `modal`, `nav`
- `auth`, `account`, `profile`, `resetPage`
- `transport.booking.*`
- `carRental.*`, `carRentalLanding.*`, `carRentalPfo.*`
- `shop.cart.*`, `shop.checkout.*`, visible shop labels
- `hotels.booking.*`, `trips.*` booking-visible labels
- all visible `error`, `validation`, `required`, `invalid`, `loading`,
  `success`, `failed`, `warning`, `status`, `message` keys in enabled beta flows

### Can remain EN fallback during controlled beta

These should not block a limited beta as long as fallback is visibly EN, never
PL-first, and no blank/undefined UI appears:

- P1 missing keys: `593`
- P2 missing keys: `27`
- Non-P0 missing keys that can temporarily fall back to EN: `620`
- Non-P0 same-as-EN review keys: `560`

Safe beta fallback areas:

- Long-form blog/content shell outside the tested route.
- Marketing pages and low-risk editorial text.
- SEO/static meta, because HE SEO remains off.
- Admin/internal copy if testers are not using admin in HE.
- Partner copy if partner users are not included in the beta allowlist.

### Admin-only

Admin/internal keys are P2 for public beta:

- `admin`, `dashboard`
- Missing: `27`
- Same-as-EN review: `0`

They should be translated before a Hebrew admin workflow is required, but they
do not block customer-facing beta.

### Partner-only

Partner/business-facing keys are separate from customer beta:

- `advertise`, `partner`, `partners`, `referral`
- Missing: `228`
- Same-as-EN review: `4`

They become P0 only if Hebrew partner users are included in beta.

## Dynamic Content Readiness

| Module | Status | HE storage / editing | Public fallback | Manual HE required before public launch |
| --- | --- | --- | --- | --- |
| Trips | Partially ready | Localized JSON/i18n fields where present; admin i18n support exists for supported fields. | HE -> EN -> PL. | Top trip titles, descriptions, itinerary snippets, booking-facing labels and meta. |
| Hotels | Partially ready | Localized JSON/i18n fields where present; admin i18n support exists for supported fields. | HE -> EN -> PL. | Top hotel titles, descriptions, amenities, room/rate copy and meta. |
| Cars | Partially ready | Dynamic description/i18n paths exist, but active car offer display fields need per-table verification. | HE -> EN -> PL. | Car model descriptions, offer labels, pickup/return labels, feature text and top offer content. |
| Transport | Partially ready | `transport_locations.name_he` exists; admin has HE handling for locations. | HE -> EN -> PL. | All active pickup/drop-off names, route labels, quote/support copy and booking summaries. |
| Blog | Schema ready, content not ready | `blog_post_translations.lang = 'he'`; `categories_he` and `tags_he`; admin/partner forms expose HE. | Public reads still guarded; runtime fallback remains EN before PL. | Top posts, slugs, titles, leads, content, meta, categories and tags. |
| POI | Schema ready, content not ready | `pois.name_i18n.he`, `description_i18n.he`, `badge_i18n.he`; category `name_he`. | HE -> EN -> PL. | POI names, descriptions, badges and category names. |
| Recommendations | Schema ready, content not ready | `title_he`, `description_he`, `discount_text_he`, `offer_text_he`; categories `name_he`. | HE -> EN -> PL. | Active recommendations, badges, offer/discount text, categories and CTA-facing labels. |
| Shop | Schema ready, content not ready | Product/category/vendor/discount/shipping/email HE fields from migration 178. | HE -> EN -> PL. | Product names, short/long descriptions, categories, variants, vendors, shipping, discounts and customer emails. |

## Estimates

| Launch scope | Must translate | Must review | Can remain EN fallback | Readiness |
| --- | ---: | ---: | ---: | --- |
| Controlled beta, customer-facing only | 883 P0 missing | 376 P0 same-as-EN | 620 non-P0 missing | 40.6% by P0 key coverage; 15.3% review-adjusted |
| Controlled beta including partner users | 1111 missing | 380 same-as-EN | 392 non-P0 missing | Blocked until partner keys are added to the beta batch |
| Public tourist frontend without partner/admin UI | 1253 public missing | 461 public same-as-EN | 250 partner/admin missing | 46.6% overall static key coverage; 13.4% review-adjusted |
| Full platform public HE | 1503 missing | 936 same-as-EN | 0 critical fallback target | Not ready for public launch |

## Launch Gates Before Moving Beyond Beta

- P0 missing keys are `0`.
- P0 same-as-EN values are either reviewed as intentional or replaced.
- Hidden preview passes desktop/mobile smoke on top flows.
- Dynamic content for top routes is manually translated or explicitly accepted
  as EN fallback for beta.
- Admin/partner save-reload HE is confirmed for the beta scope.
- SEO HE remains off until separate SEO QA and rollout approval.

## Recommended Translation Sequence

1. Navigation/global UI.
2. Auth/account.
3. Validation/status/errors across all enabled beta flows.
4. Checkout/shop only if shop is in beta; otherwise keep shop fallback-only.
5. Transport booking.
6. Cars booking and car rental offer labels.
7. Trips/hotels booking-visible keys.
8. Coupon/booking support.
9. Blog/public shell and map/recommendation labels.
10. SEO/static meta preparation, still hidden.
11. Partner panel if beta includes partner users.
12. Admin/internal polish after customer beta paths are stable.

No mass auto-translation should be applied from this plan. Each batch should be
translated, placeholder-checked, RTL smoke-tested and marked reviewed before it
moves from beta fallback to public readiness.
