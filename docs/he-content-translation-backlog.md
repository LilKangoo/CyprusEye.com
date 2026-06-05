# HE Content Translation Backlog

Generated: 2026-05-31

This backlog tracks content work required before Hebrew can become a complete
public site feature. It does not activate public HE.

## Static Translation Backlog

Current source: `docs/he-translation-readiness.md`.

| Group | Priority | Missing | Same-as-EN risk | Launch action |
| --- | --- | ---: | ---: | --- |
| Critical UI / navigation | P0 | 0 | 5 | Review same-as-EN labels and keep brands if intentional. |
| Errors / validation | P0 | 0 | 26 | Review validation/status copy for forms and booking flows. |
| Booking flows | P0 | 0 | 27 | Review placeholders and labels. |
| Auth/account | P0 | 0 | 4 | Review account/profile placeholders. |
| Checkout / Shop | P0 | 3 | 0 | Remaining long Shop copy/page title needs human review; keep Shop hidden from HE. |
| Partner / advertise | P1 | 160 | 4 | Short form labels completed; long partner marketing copy still requires manual review. |
| Blog / public content shell | P1 | 0 | 5 | Stage 24 completed missing public static keys; remaining same-as-EN values are mostly abbreviations/brands and need review. |
| SEO/static meta | P1 | 53 | 20 | Required before HE indexing. |
| Admin/dashboard | P2 | 0 | 0 | Short dashboard labels completed in Stage43. |
| Low priority/internal | P3 | 0 | 462 | Triage after public scope is stable. |

Stage 24 static UI completion reduced missing HE keys from 645 to 317 and
same-as-EN keys from 682 to 553. Stage43 reduced missing HE keys from 317 to
216 and same-as-EN keys from 553 to 547 by filling short, public-safe UI labels
for Shop basics, Dashboard and partner form fields. Remaining missing roots are
intentionally deferred: long `advertise` copy, hidden `seo` keys and long Shop
copy.

### Stage 43 Static Cleanup

Completed:

- Short Shop labels: footer links, shipping ETA labels, hero badges/cards and
  basic shop title/subtitle.
- Dashboard/user labels: navigation, reservations, content, referral and
  settings text.
- Partner/advertise form labels: fields, placeholders, partner types, package
  labels, submit/sending text and short package CTA labels.
- Small same-as-EN cleanup for short `advertise` and `attractions` labels.

Deferred for human review:

- Long partner marketing/advertise sections.
- SEO/static meta.
- Long Shop about/hero copy and page title.
- Blog content and post bodies.
- Email templates.

## Dynamic Content Backlog

### Blog

Current status:

- Records: 21 published/beta-readable posts.
- HE complete: 0.
- HE partial: 5.
- EN fallback-only: 16.
- Field readiness: 7.7%.
- Taxonomy HE exists on 5 posts, but full HE post rows are not complete.

Required work:

- Complete reviewed HE rows in `blog_post_translations` for every launch post:
  slug, title, meta_description, summary, lead, content_html and content_json
  where required by the editor.
- Complete `blog_posts.categories_he` and `blog_posts.tags_he`.
- Decide whether non-translated posts are hidden from HE blog lists or shown as
  EN fallback.

Admin path:

- Prefer Admin/Partner editor for body content so HTML and editor JSON stay
  consistent.
- SQL import is acceptable for taxonomy and simple fields, but long body content
  should be reviewed manually.

### Trips

Current status:

- Records: 12.
- HE complete: 3.
- EN fallback-only: 9.
- Readiness: 25.0%.

Required work:

- Translate title and description for all 12 trips for global launch.
- If itinerary/highlights/FAQ fields exist for a row, add HE variants or JSON
  `he` values.
- Smoke test trip listing, detail and booking summary.

Admin/schema path:

- Current JSON localized title/description structure supports HE.
- No aggressive schema change is needed unless itinerary/highlights/FAQ are
  still non-localized in admin.

### Hotels

Current status:

- Records: 2.
- HE complete: 2.
- Readiness: 100.0%.
- Hotel amenities dictionary: 48 records, 0% HE.
- Stage 25 prepared `supabase/manual/he_public_ready_dynamic_stage25.sql`
  to add `hotel_amenities.name_he` and fill all 48 active amenity labels.

Required work:

- Review existing hotel title/description HE.
- Add HE for hotel amenity dictionary or add schema support if `name_he` is not
  available in the live table.
- Review room/rate-plan labels if visible.

Admin/schema path:

- Hotel records are ready.
- Amenity dictionary needs the Stage 25 manual SQL applied and reviewed.
- Frontend hotel amenity loaders now tolerate missing `name_he` and will use it
  once the column exists.

### Cars

Current status:

- Records: 27.
- HE complete: 0.
- HE partial: 27.
- Readiness: 54.2%.

Required work:

- Review car model fields; brand/model names can remain Latin text.
- Translate car type, features and descriptions.
- Smoke test car cards, popup booking modal, price summary and validation.

Admin/schema path:

- Existing localized JSON/fields can store HE.
- No pricing/order logic changes should be mixed with translation work.

### Transport

Current status:

- Routes: 44.
- HE complete: 44.
- Transport locations: 9, 100% HE.
- Readiness: 100.0%.

Required work:

- Review Hebrew location names.
- Run full transport booking form and summary QA in HE.
- Complete static SEO/legal keys for transport before public SEO.

Admin/schema path:

- `transport_locations.name_he` is ready.
- No schema change required for the current launch scope.

### POI

Current status:

- Records: 139.
- HE complete: 10.
- EN fallback-only: 129.
- Readiness: 7.2%.
- POI categories: 23 records, 6 complete, 17 fallback.
- Stage 25 prepared category label top-up for all 23 active POI categories.

Required work:

- Translate `name_i18n.he`, `description_i18n.he`, `badge_i18n.he`.
- Translate POI category `name_he`.
- Prioritize high-traffic map markers and recommendation-linked POI first.

Admin/schema path:

- JSONB i18n fields support HE.
- Use admin POI i18n form for manual review.

### Recommendations

Current status:

- Records: 10.
- HE complete: 5.
- HE partial: 3.
- EN fallback-only: 2.
- Readiness: 63.6%.
- Recommendation categories: 15 records, 10 complete, 5 fallback.
- Stage 25 prepared a top-up for the remaining 5 active recommendations and all
  15 recommendation category labels.

Required work:

- Complete remaining title/description/category HE fields.
- Review discount and offer text.
- Smoke test cards, modal/details, map overlays and CTA labels.

Admin/schema path:

- `recommendations.*_he` and `recommendation_categories.name_he` are available.

### Public-ready Dynamic Content Scope

Stage 25 narrows first public-ready content to pages that can be made coherent
without translating the whole database.

| Module | Public launch decision | Content action |
| --- | --- | --- |
| Transport | READY after smoke QA | 9 locations / 44 routes already resolve through `name_he`. |
| Hotels | READY TECH after manual SQL | Apply Stage 25 amenity dictionary SQL, then smoke `hotels.html` and `hotel.html`. |
| Blog | BLOCKED until RLS/public policy launch gate | 5 top posts have internal taxonomy/translation pack, but anon public read intentionally hides `lang='he'`. |
| Trips | PARTIAL / page-gated | Expose only the 3 translated trip records until all 12 are translated. |
| Cars | PARTIAL / page-gated | Expose top 5 reviewed cars; keep model names as Latin brand text where appropriate. |
| Recommendations | READY after manual SQL | Stage 25 completes remaining 5 active recommendations and categories. |
| POI / map | PARTIAL / scoped | Expose only top 10 translated POI; global map remains mostly EN fallback. |
| Shop | EXCLUDED | Keep Shop EN/LTR and outside first public HE launch. |

### Shop

Current status:

- Aggregate records: 30.
- HE complete: 0.
- EN fallback-only: 30.
- Readiness: 0.0%.

Entity backlog:

| Entity | Records | Current HE readiness | Required work |
| --- | ---: | ---: | --- |
| Products | 10 | 0.0% | name, short description, description, meta fields. |
| Categories | 3 | 0.0% | name, description, meta fields. |
| Vendors | 2 | 0.0% | name, description. |
| Shipping classes | 4 | 0.0% | name, description. |
| Shipping zones | 3 | 0.0% | name. |
| Shipping methods | 3 | 0.0% | name, description. |
| Attributes | 1 | 0.0% | name. |
| Attribute values | 4 | 0.0% | value. |
| Product variants | 0 | n/a | Add HE pattern before variants are used. |
| Discount labels | 0 | n/a | Audit live discount records before launch. |

Required work:

- Complete dynamic HE before including Shop in global HE.
- Translate checkout/cart/shipping/payment status copy.
- Translate order/customer emails or keep checkout out of HE.
- Run paid-flow dry-run/sandbox QA before public exposure.

Launch decision:

- Full-site HE launch should wait for full Shop HE.
- Phased HE launch may exclude Shop entirely and force EN/LTR on Shop.

### Email Templates

Current status:

- Schema support exists for `shop_email_templates.subject_he`,
  `shop_email_templates.body_html_he` and `email_template_versions.content.he`.
- Tables are not readable through anon API, so counts require admin SQL or
  service-role audit.

Required work:

- Run admin SQL count of catalog/templates/versions.
- Fill customer-facing templates first:
  - booking confirmations,
  - payment/deposit confirmations,
  - shop order received/confirmed,
  - transport/trip date messages.
- Keep internal admin notifications lower priority unless they are exposed to
  partners/customers.

### Coupon / Discount Texts

Current status:

- Static coupon keys are translated for Stage 24 public UI. Remaining coupon
  follow-up is human review and dynamic discount/coupon copy, not missing static
  keys.
- Service coupon and recommendation discount text need dynamic review.

Required work:

- Translate dynamic `discount_text_he`, `offer_text_he` and coupon labels.
- Confirm coupon validation/status messages are reviewed.
- Smoke test coupon application on trips, hotels, cars and transport.

### Partner-Facing Content

Current status:

- Partner/admin forms can store HE internally.
- Partner/advertise static group has 214 missing keys after Stage 24.

Required work:

- Decide whether partner-facing pages are part of the public HE launch.
- If yes, complete `advertise.*`, `partner.*`, `partners.*` keys.
- Review partner blog HE save/reload.
- Keep admin-only copy out of public launch gating unless it affects content
  entry quality.

## Completion Order

1. Static P0 leftovers, especially Shop if Shop is in scope.
2. Static P1 public content shell for pages that will show HE.
3. Blog top/all launch posts.
4. Trips remaining 9 records.
5. POI and POI categories.
6. Recommendations remaining records/categories.
7. Cars review for all partial records.
8. Hotel amenities dictionary.
9. Shop full content and checkout/email copy.
10. HE SEO/meta/hreflang/sitemap only after page content passes QA.

## Definition Of Done

- No missing P0/P1 keys for the launch scope.
- No unreviewed same-as-EN copy in critical user flows.
- Dynamic content is reviewed for each page that exposes HE.
- Shop is either fully translated or explicitly excluded from HE.
- Switcher only shows HE on ready pages.
- SEO indexes only real HE content, not EN fallback pages.

## Stage 44 PL/EN/HE Static UI Backlog

Status: **EN fallback complete for PL UI keys; HE remaining backlog is review-gated**.

Tri-lingual report:

- `translations/audit-pl-en-he.json`

Current structural state after Stage44:

| Check | Count |
| --- | ---: |
| PL keys missing EN | 0 |
| PL/EN keys missing HE | 216 |
| Placeholder mismatches | 0 |
| HTML tag mismatches | 0 |
| Empty strings / null values | 0 |

Completed in Stage44:

- Added missing EN fallback keys for PL-only short UI.
- Added HE for short profile, plan, community comment, nav/auth and status UI.
- Fixed runtime placeholder mismatches in auth, challenge/streak, places,
  notifications, sync, VIP and XP labels.
- Preserved variables such as `{{username}}`, `{{xp}}`, `{{amount}}`,
  `{{found}}`, `{{total}}`, `{{title}}` and `{{name}}`.

Remaining HE backlog:

| Group | Missing HE | Handling |
| --- | ---: | --- |
| `advertise.*` | 160 | Long public partner/advertising copy. Manual human review before any public HE exposure. |
| `seo.*` | 53 | Keep off until the dedicated SEO HE stage. Do not auto-publish. |
| `shop.*` | 3 | Long Shop page copy/title. Shop remains excluded; review in a Shop-specific stage. |

Same-as-EN note:

- Same-as-EN count is now higher because Stage44 filled missing EN fallback for
  legacy/static car-rental fleet keys that were already stored in HE as English.
- Treat those values as review debt, not as public-ready Hebrew copy.
- Do not activate Shop/Blog/SEO because of static UI completion alone.

### Email and Notification Translation Backlog

Stage44 did not bulk-translate email templates.

Payment/booking-critical templates that require manual review before HE email
rollout:

- deposit/payment requested,
- payment pending,
- payment/deposit paid,
- booking confirmed,
- partner accepted,
- contact locked/unlocked,
- partner/admin paid notifications,
- customer confirmation after payment,
- shop order and shipping emails.

Rules:

- Preserve every placeholder exactly.
- Test delivery before public use.
- Fallback must be HE -> EN -> PL and never blank.
- Do not change transport deposit/payment, partner fulfillment or Stripe webhook
  logic while translating email copy.

## Stage 45 Manual Review Packs

Status: **review/export workflow prepared; no content was published**.

Generated review packs live in `translations/manual-review/`:

| Pack | Records | Handling |
| --- | ---: | --- |
| `static-ui-review.json` | 801 | Manual static UI review and dry-run import input. |
| `advertise-review.json` | 235 | Long advertise/partner copy. Manual review only. |
| `seo-review.json` | 122 | SEO copy preparation. SEO HE remains off. |
| `shop-review.json` | 96 | Shop copy backlog. Shop remains excluded. |
| `email-template-review.json` | 506 | Email/payment templates; 11 payment-critical records and 16 placeholder issues require review. |
| `same-as-en-review.json` | 690 | Same-as-EN HE review debt. |
| `dynamic-content-review.json` | 237 | Read-only Supabase dynamic content export. |
| `blog-review.json` | 21 | Blog manual translation backlog. No `public_ready` automation. |

Same-as-EN classification:

| Classification | Records |
| --- | ---: |
| Needs translation | 537 |
| Allowed same-as-EN candidate | 19 |
| Needs human review | 134 |

Dynamic record counts:

| Module | Records |
| --- | ---: |
| Blog | 21 |
| Trips | 12 |
| Hotels | 1 |
| Cars | 27 |
| POI | 139 |
| Recommendations | 10 |
| Transport | 9 |
| Shop products/categories/vendors/shipping | 18 |

Current review rules:

- Blog remains `BLOCKED` until manually translated rows are explicitly marked
  `public_ready`.
- Shop remains `EXCLUDED`; checkout/payment copy stays out of HE.
- SEO HE remains `OFF`; translation review does not enable sitemap,
  hreflang, canonical, OpenGraph or indexing.
- Booking/payment/transport deposit flow was not changed.

## Stage 46 Shop HE Manual Review Requirements

Decision: **Shop remains EXCLUDED from the first public HE launch**.

Reference: `docs/he-shop-decision.md`.

Static Shop review pack status:

| Metric | Count |
| --- | ---: |
| Shop review records | 96 |
| Missing EN | 0 |
| Missing HE | 3 |
| Same-as-EN HE | 0 |
| Human review required | 96 |
| Placeholder issues | 0 |

Shop-related email/payment/order records:

| Metric | Count |
| --- | ---: |
| Records | 3 |
| Missing HE | 3 |
| Human review required | 3 |

Dynamic Shop records in `dynamic-content-review.json`:

| Module | Records |
| --- | ---: |
| `shop_products` | 10 |
| `shop_categories` | 3 |
| `shop_shipping` | 3 |
| `shop_vendors` | 2 |
| **Total** | **18** |

All 18 dynamic Shop records are currently `same_as_en`, so they are not
approved Hebrew content. They require manual review before any Shop HE stage.

Launch rule:

- `shop.html?lang=he` must remain EN/LTR.
- Cart, checkout, shipping, discount, payment and order confirmation must remain
  outside HE.
- Shop links from Home, navigation, recommendations, POI and Blog CTA surfaces
  must normalize to EN/LTR.
- Full Shop HE requires a separate manual translation and checkout/payment QA
  stage.

## Stage 47 SEO Translation Backlog

SEO HE remains disabled. Translation review does not activate SEO.

Manual SEO translation/review is still required before future indexing for:

- Home meta title/description/OpenGraph copy,
- transport meta/OG copy,
- hotels and hotel detail meta/OG copy,
- recommendations meta/OG copy,
- car meta/OG copy,
- trips and trip detail meta/OG copy,
- structured-data fields where user-visible entity names/descriptions appear.

Do not prepare or publish HE SEO for:

- Blog until specific posts are manually reviewed and marked `public_ready`,
- Shop/cart/checkout/payment,
- plan/community/legal/account/auth until manually reviewed,
- any page or record that displays EN fallback as the primary content.

Reference: `docs/he-seo-rollout-plan.md`.

## Stage 48 SEO Activation And Backlog Boundary

Controlled SEO HE is active only for ready/page-gated URLs documented in
`docs/he-seo-rollout-plan.md`.

This does not reduce the manual review backlog for:

- Blog posts and Blog SEO,
- Shop/cart/checkout/payment,
- email/payment templates,
- long marketing copy,
- legal/account/community/plan pages,
- not-ready dynamic records.

Blog remains `BLOCKED`, Shop remains `EXCLUDED`, and `/he/` routes remain
non-public. Manual translation review and `public_ready` marking remain separate
future steps.

## Stage 50 Manual Review Backlog Lock

Current review pack baseline:

| Pack | Records | Missing HE | Same-as-EN HE | Human review |
| --- | ---: | ---: | ---: | ---: |
| Static UI review | 801 | 0 | 652 | 801 |
| Advertise review | 235 | see pack | see pack | 235 |
| SEO review | 122 | 53 | 20 | 122 |
| Shop review | 96 | 3 | 0 | 96 |
| Email/payment template review | 506 | 17 | 14 | 506 |
| Same-as-EN review | 690 | 0 | 690 | 690 |
| Dynamic content review | 237 | 16 | 76 | 237 |
| Blog review | 21 | 16 | 0 | 21 |

Email/payment template backlog:

- 506 records require human review.
- 17 records are missing HE.
- 16 records have placeholder/tag issues in the review pack and must be fixed
  before any live use.
- 11 records are payment-critical.
- Email catalog live reads reported permission warnings for
  `email_template_catalog` and `email_template_versions`; use Supabase/admin
  access for final email template review.

Manual workflow status:

- Export packs are read-only review files.
- Static import is dry-run by default and requires `--apply`.
- Static import does not update Supabase.
- Static import rejects `public_ready`.
- Dynamic/database records remain manual admin or SQL workflows.

Next manual tasks:

1. Review Blog posts one by one using
   `docs/he-blog-manual-public-ready-checklist.md`.
2. Review Shop with `docs/he-shop-future-rollout-checklist.md`.
3. Review SEO copy before any additional SEO expansion.
4. Review email/payment templates without touching dispatch, partner
   fulfillment, Stripe webhook or deposit logic.
