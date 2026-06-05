# HE Shop Future Rollout Checklist

Shop remains `EXCLUDED` from the current HE launch. This checklist is for a
future dedicated Shop HE stage only. It does not activate Shop HE, checkout HE,
payment HE, sitemap HE, hreflang HE, canonical HE or public `/he/` routes.

## Current Decision

Current decision: **Option A now, Option C later**.

- Now: Shop stays completely excluded from the HE launch.
- Later: full Shop HE only after manual translation and full checkout/cart/
  payment QA.

## Translation Scope

Manual review is required for:

- product names and descriptions
- product categories
- variants
- vendor text
- shipping methods/classes
- discounts and coupons
- cart drawer labels
- checkout form labels
- address and delivery copy
- payment status copy
- order confirmation/cancellation copy
- customer/admin/order emails
- legal/payment terms

Do not auto-translate payment, checkout, legal or order copy.

## Checkout And Payment Safety

Before any Shop HE stage:

1. Cart drawer works in RTL.
2. Checkout modal works in RTL.
3. Shipping address fields render correctly.
4. Delivery method selection is translated and tested.
5. Discount code flow is translated and tested.
6. Order summary totals are correct.
7. Stripe checkout payload is unchanged except user-facing language where
   explicitly approved.
8. Success/cancel return pages are translated and tested.
9. Emails keep all placeholders and payment links.
10. No customer can enter checkout with mixed broken HE.

Payment logic must not be changed during translation review.

## Must Stay EN/LTR Until Approved

Keep Shop EN/LTR if:

- any checkout/payment copy is not reviewed
- any email/order notification is missing HE
- any placeholder mismatch exists
- any shipping/discount dynamic text is missing HE
- Stripe sandbox smoke has not passed
- cart drawer or checkout modal overflows in RTL

## Review Packs

Use:

- `translations/manual-review/shop-review.json`
- `translations/manual-review/dynamic-content-review.json`
- `translations/manual-review/email-template-review.json`
- `translations/manual-review/same-as-en-review.json`

Stage45 counts:

- Shop static review records: 96
- Shop static missing HE: 3
- Shop static records requiring human review: 96
- Dynamic Shop records in review pack: 18
- Email/payment records requiring human review: 506
- Payment-critical email/template records: 11

## Required Tests For Future Shop HE

Minimum test set:

```bash
npm run i18n:tri-audit
npm run i18n:test
npm run seo:he-guard
npm run seo:audit
npm run build
npm test
npx playwright test tests/e2e/he-hidden-rollout.spec.ts --workers=1
```

Add dedicated Shop HE tests before activation:

- `shop.html?lang=he` renders RTL only when Shop is explicitly allowed
- cart drawer RTL
- checkout modal RTL
- checkout success/cancel return
- discount code messages
- shipping method labels
- payment failure/success messages
- Shop remains excluded from sitemap until SEO Shop stage is approved

## Rollback

If a future Shop HE stage fails:

1. Set Shop page readiness back to `excluded`.
2. Set `shopEnabled:false`.
3. Remove Shop HE from switcher.
4. Remove Shop HE from sitemap/hreflang/canonical if it was enabled.
5. Keep cart/checkout/payment EN/LTR.
6. Purge Cloudflare cache.
7. Re-run Shop safety smoke.

## Manual SQL To Run In Supabase

No new SQL required for the current Stage50 checklist. Future Shop dynamic
content imports must be prepared as a separate, reviewed SQL/import stage.
