# HE Production Monitoring Checklist

Stage 50 status: current HE production scope is a stable partial launch. This
checklist does not activate Blog HE, Shop HE, public `/he/` routes, or any new
SEO surface.

## Current Stable Production State

- HE UI live: Home, transport, hotels, hotel, recommendations, car, trips,
  trip, and POI/map flow.
- HE SEO live: Stage 49 allowed scope only, currently 19 HE URLs in
  `sitemap.xml`.
- Blog and blog detail remain `BLOCKED`.
- Shop, cart, checkout, payment, partners, and admin remain `EXCLUDED`.
- Public `/he/` routes remain non-public redirects/fallbacks to `/?lang=en`.
- Booking/payment/deposit flow is locked and must not be changed by HE work.

## Current Live HE UI Scope

Public/page-gated HE UI is allowed only for:

- Home: `/?lang=he`
- `transport.html?lang=he`
- `hotels.html?lang=he`
- HE-ready hotel details
- `recommendations.html?lang=he`
- `car.html?lang=he`
- `trips.html?lang=he`
- HE-ready trip details
- POI/map flow inside the existing record-gated UI

## Current Live HE SEO Scope

HE SEO is allowed only for:

- `https://www.cypruseye.com/?lang=he`
- `https://www.cypruseye.com/transport.html?lang=he`
- `https://www.cypruseye.com/hotels.html?lang=he`
- `https://www.cypruseye.com/recommendations.html?lang=he`
- `https://www.cypruseye.com/car.html?lang=he`
- `https://www.cypruseye.com/trips.html?lang=he`
- `https://www.cypruseye.com/hotel.html?slug=7-ukow&lang=he`
- the 12 HE-ready trip detail URLs currently emitted in `sitemap.xml`

## Must Stay Blocked Or Excluded

Blocked:

- Blog and `/blog/*`
- `plan.html`
- community
- account/auth
- legal
- 404/unknown

Excluded:

- Shop
- cart
- checkout
- payment
- partners
- admin

Non-public:

- `/he/` routes

## Daily Checks For First 7 Days

1. Open `https://www.cypruseye.com/sitemap.xml`.
2. Confirm it contains HE URLs only for the current allowed scope.
3. Confirm it does not contain `blog`, `shop`, `checkout`, `cart`, `payment`,
   `partners`, `admin`, `plan`, `community`, `legal`, or `/he/` with `lang=he`.
4. Open `/?lang=he`, `transport.html?lang=he`, `hotels.html?lang=he`,
   `recommendations.html?lang=he`, `car.html?lang=he`, `trips.html?lang=he`,
   one HE-ready hotel, and one HE-ready trip.
5. Confirm each allowed page has:
   - `lang="he"`
   - `dir="rtl"`
   - HE canonical
   - `hreflang="he"`
   - `og:url` with `lang=he`
6. Open blocked/excluded pages with `?lang=he`.
7. Confirm Blog, Shop, Plan, Partners and Admin return EN/LTR or safe blocked
   output with no HE canonical, hreflang or OpenGraph.
8. Check `/he/`, `/he/transport.html`, and `/he/shop.html`.
9. Confirm all redirect/fallback to `/?lang=en` and do not request `/he/js/` or
   `/he/assets/`.
10. Scan browser console on representative pages for critical errors, broken
    assets, infinite redirects, or layout overflows.

## Checks After Every Deploy

Run:

```bash
npm run seo:he-guard
npm run seo:audit
npm run seo:production -- --origin=https://www.cypruseye.com
npm run i18n:tri-audit
npm run i18n:test
npm test
```

Then run the HE Playwright smoke:

```bash
npx playwright test tests/e2e/he-hidden-rollout.spec.ts --workers=1
```

Required results:

- `seo:production`: 0 errors, 0 warnings
- `seo:he-guard`: pass
- `npm test`: pass, including `depositRequestReliability` and
  `transportNotificationReliability`
- Playwright HE smoke: pass

## Search Console Follow-up

After Google has time to recrawl:

1. Inspect the HE sitemap URLs.
2. Confirm indexed HE URLs match only the allowed scope.
3. Confirm Blog/Shop/checkout/payment are not discovered as HE URLs.
4. Watch canonical selection for `?lang=he` pages.
5. Watch duplicate-content warnings where a page is mostly fallback EN.
6. If any blocked/excluded URL appears as HE, rollback HE SEO flags and purge
   Cloudflare cache.

## Rollback

If HE SEO leaks beyond scope:

1. Set `CE_HE_SEO_ENABLED=false`, or disable `seoEnabled`, `sitemapEnabled`,
   `hreflangEnabled`, `canonicalEnabled`, `canonicalHeEnabled` and
   `indexingEnabled` through `CE_HE_SEO_ROLLOUT_CONFIG`.
2. Keep current HE UI enabled if UI is healthy.
3. Keep Blog blocked and Shop excluded.
4. Purge Cloudflare cache.
5. Re-run `npm run seo:he-guard`, `npm run seo:audit`, and
   `npm run seo:production -- --origin=https://www.cypruseye.com`.

## Manual SQL To Run In Supabase

No new SQL required for this checklist.
