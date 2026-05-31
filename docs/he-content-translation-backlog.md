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
| Booking flows | P0 | 2 | 87 | Fill coupon recommendation SEO keys; review placeholders and labels. |
| Auth/account | P0 | 0 | 4 | Review account/profile placeholders. |
| Checkout / Shop | P0 | 23 | 0 | Required if Shop is in launch; otherwise keep Shop hidden from HE. |
| Partner / advertise | P1 | 223 | 4 | Needed before partner-facing public HE. |
| Blog / public content shell | P1 | 317 | 65 | Required before global switcher. |
| SEO/static meta | P1 | 53 | 20 | Required before HE indexing. |
| Admin/dashboard | P2 | 27 | 0 | Internal, not a public launch blocker. |
| Low priority/internal | P3 | 0 | 471 | Triage after public scope is stable. |

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

Required work:

- Review existing hotel title/description HE.
- Add HE for hotel amenity dictionary or add schema support if `name_he` is not
  available in the live table.
- Review room/rate-plan labels if visible.

Admin/schema path:

- Hotel records are ready.
- Amenity dictionary needs schema/content confirmation.

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

Required work:

- Complete remaining title/description/category HE fields.
- Review discount and offer text.
- Smoke test cards, modal/details, map overlays and CTA labels.

Admin/schema path:

- `recommendations.*_he` and `recommendation_categories.name_he` are available.

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

- Static coupon keys are mostly translated, but `coupon.recommendations.seo.*`
  still has 2 missing P0 keys.
- Service coupon and recommendation discount text need dynamic review.

Required work:

- Translate dynamic `discount_text_he`, `offer_text_he` and coupon labels.
- Confirm coupon validation/status messages are reviewed.
- Smoke test coupon application on trips, hotels, cars and transport.

### Partner-Facing Content

Current status:

- Partner/admin forms can store HE internally.
- Partner/advertise static group has 223 missing P1 keys.

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
