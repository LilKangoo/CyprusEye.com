# HE Shop Decision

Status: **Shop remains EXCLUDED from public HE**.

Final live commit: `92c7c73`. This final partial HE production state does not
change the Shop decision: Shop/cart/checkout/payment stay excluded and EN/LTR.

This document does not enable Shop HE, global HE, Blog HE public, SEO HE,
sitemap HE, hreflang HE, canonical HE, indexing HE or public `/he/` routes. It
does not change booking/payment, transport deposit flow, partner fulfillment or
Stripe webhook logic.

## Decision

Recommendation for the current launch path: **Option A - keep Shop fully
excluded from the first public HE launch**.

Operational safety behavior: Shop may use **EN/LTR fallback only** when a user
arrives with `?lang=he`, but this is a block/fallback safety path, not a Shop
HE launch.

Future path: **Option C - dedicated full Shop HE rollout** after product,
cart, checkout, payment, shipping, discount, email and legal copy are manually
translated and QA-tested.

## Current Runtime Safety

Shop has multiple independent HE guards:

- `js/i18n.js` marks `shop` as `excluded` in the HE page readiness registry.
- `js/he-beta-rollout-config.js` keeps `shopEnabled:false`.
- `shop.html` uses `data-seo-page="shop"` and
  `data-disable-hidden-language="true"`.
- `js/shop.js` suppresses hidden languages through `normalizeShopLang(...)` and
  `getCurrentLang(...)`, so `?lang=he` resolves to EN/LTR on Shop.
- `buildLocalizedUrl('/shop.html', 'he')` resolves to `/shop.html?lang=en`.
- `js/blog-cta-resolver.js` forces Shop CTA links to `lang=en` for HE source
  pages.
- Cart and checkout UI labels are PL/EN-only through `shopText(...)`; Shop
  checkout is not an HE surface.

Safety expectation:

- `shop.html?lang=he` remains EN/LTR.
- Shop language switcher does not show HE.
- Home/nav/CTA links to Shop do not carry `lang=he`.
- Cart, checkout, shipping, payment and order confirmation never inherit RTL.

## Translation Readiness

Review pack sources:

- `translations/manual-review/shop-review.json`
- `translations/manual-review/static-ui-review.json`
- `translations/manual-review/email-template-review.json`
- `translations/manual-review/same-as-en-review.json`
- `translations/manual-review/dynamic-content-review.json`

Static Shop pack:

| Metric | Count |
| --- | ---: |
| Shop review records | 96 |
| Missing EN | 0 |
| Missing HE | 3 |
| Same-as-EN HE | 0 |
| Human review required | 96 |
| Placeholder issues | 0 |
| Safe to auto-apply | 0 |

Shop-related email/payment/order records:

| Metric | Count |
| --- | ---: |
| Records | 3 |
| Missing EN | 0 |
| Missing HE | 3 |
| Human review required | 3 |
| Placeholder issues | 0 |

Dynamic Shop records:

| Module | Records |
| --- | ---: |
| `shop_products` | 10 |
| `shop_categories` | 3 |
| `shop_shipping` | 3 |
| `shop_vendors` | 2 |
| **Total** | **18** |

All 18 dynamic Shop records are currently technical `he_ready` in the review
pack, but all 18 are `same_as_en`. Treat them as manual review debt, not as
approved Hebrew content.

## Checkout / Payment Risk

Shop checkout is payment-sensitive and must not enter public HE until the whole
flow is reviewed:

- cart labels and empty states,
- shipping method and delivery copy,
- discount/coupon labels and validation,
- order summary,
- payment required / payment failed / payment success states,
- confirmation and cancellation copy,
- customer/admin/order notification emails,
- return/refund/legal copy.

Current decision: keep every checkout/payment surface EN/LTR until a dedicated
Shop HE stage completes manual translation, Stripe sandbox QA and regression
tests.

Note: success/cancel URLs may preserve the original query string if a user
manually enters `shop.html?lang=he`, but the returned Shop page still resolves
to EN/LTR through the page guard. A later Shop-hardening stage may normalize
those return URLs to `lang=en` explicitly if needed.

## Requirements Before Shop HE

Do not enable Shop HE until all of these pass:

1. Manual review of every record in `shop-review.json`.
2. Manual review of Shop email/payment/order records.
3. Manual review of all 18 dynamic Shop records.
4. Confirmation that product, variant, vendor, category, shipping and discount
   fields have reviewed HE where needed.
5. Cart/checkout/payment Playwright smoke in EN, PL and HE.
6. Stripe sandbox checkout success, cancel and failure tests.
7. Order confirmation and notification email review.
8. Explicit config change to allow Shop HE.
9. Dedicated rollback plan and cache purge sequence.

## Rollback / Safety Plan

If Shop HE ever leaks accidentally:

1. Keep or restore `shopEnabled:false`.
2. Keep or restore `HE_PAGE_READINESS_REGISTRY.shop.status = 'excluded'`.
3. Keep `data-disable-hidden-language="true"` on `shop.html`.
4. Confirm `buildLocalizedUrl('/shop.html', 'he')` returns `lang=en`.
5. Purge Cloudflare cache after deploy.
6. Re-run Shop safety smoke:
   - `shop.html?lang=he` -> EN/LTR,
   - no HE switcher,
   - cart/checkout/payment remain LTR.

## Manual SQL To Run In Supabase

No new SQL required for this stage.

## Stage 47 SEO Exclusion

Shop is also excluded from HE SEO preparation.

Current rule:

- no Shop HE sitemap entries,
- no `hreflang="he"` for Shop,
- no HE canonical for Shop,
- no HE OpenGraph for Shop,
- no HE structured data for Shop,
- no indexing of Shop HE,
- no public `/he/shop` route.

This applies to:

- `shop.html`,
- cart,
- checkout,
- payment,
- order success/cancel/failure surfaces,
- Shop email/payment/order templates.

Future Shop HE requires a dedicated Shop stage with manual translation,
checkout/payment QA and a separate SEO decision. Existing HE SEO preparation for
Home, transport, hotels, recommendations, cars and trips must not pull Shop into
the indexed HE surface.

## Stage 48 HE SEO Exclusion Confirmation

Shop remains excluded after controlled HE SEO activation.

Stage48 must not and does not add:

- Shop HE sitemap URLs,
- Shop `hreflang="he"`,
- Shop HE canonical,
- Shop HE OpenGraph/Twitter metadata,
- Shop HE structured data,
- Shop indexing,
- public `/he/` Shop routes.

`shop.html?lang=he` remains EN/LTR and cart/checkout/payment remain outside HE.
Future Shop HE still requires a dedicated manual translation and checkout/payment
QA stage.

## Stage 49 SEO Confirmation

Shop remains excluded during live SEO HE deployment.

Stage49 SEO checks must continue to prove:

- no Shop HE sitemap URL,
- no Shop `hreflang="he"`,
- no Shop HE canonical,
- no Shop HE OpenGraph/Twitter metadata,
- no Shop HE structured data,
- no Shop indexing,
- no public `/he/shop` route,
- `shop.html?lang=he` remains EN/LTR,
- cart/checkout/payment never inherit HE/RTL from prior navigation.

No Shop code or checkout/payment logic is changed in Stage49.

Final Stage49 check: **Shop remains excluded**.

Live `shop.html?lang=he` returns EN/LTR with no HE canonical, hreflang or
OpenGraph. Sitemap contains no Shop HE URLs, and public `/he/shop.html`
redirects to `/?lang=en`.

## Stage 50 Shop Lock

Shop remains `EXCLUDED`.

Current rule:

- no Shop HE UI;
- no Shop HE SEO;
- no cart/checkout/payment RTL;
- no public `/he/` Shop route;
- no Shop dynamic content import;
- no checkout/payment language changes.

Future Shop HE work is tracked in:

- `docs/he-shop-future-rollout-checklist.md`

Until that future stage passes manual translation and checkout/payment QA,
Shop must remain EN/LTR even when the visitor came from an HE page.
