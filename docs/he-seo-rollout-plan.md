# HE SEO Rollout Plan

Status: **locked partial HE production state at `92c7c73`**.

Final live commit: `92c7c73` (`Fix Hebrew trip SEO canonical guard`). This
state includes:

- `6000d46` - visual HE translation cleanup.
- `51dd163` - car HE canonical/OpenGraph guard.
- `92c7c73` - trip HE canonical/OpenGraph guard and HE fallback no longer
  dropping to PL.

This document controls SEO, sitemap, hreflang, canonical, OpenGraph and
structured-data rules for Hebrew. Stage 48 activates HE SEO only for pages and
records that already passed page-gated HE rollout.

Global public HE remains disabled:

- public `/he/` routes remain disabled and redirected.
- Blog HE public remains disabled.
- Shop/cart/checkout/payment remain excluded.
- global language rollout surfaces still do not expose HE.

Stage 48 controlled SEO flags are enabled inside the server-side SEO guard only:

- `seoEnabled:true`
- `sitemapEnabled:true`
- `hreflangEnabled:true`
- `canonicalEnabled:true`
- `canonicalHeEnabled:true`
- `indexingEnabled:true`

These flags are still constrained by page and record readiness. They do not
make `he` a global public language.

## Central Guard

Server-side HE SEO preparation is centralized in
`functions/_utils/heSeoReadiness.js`.

HE SEO can be generated only when all conditions are true:

1. requested language is `he`,
2. page is not `blocked` or `excluded`,
3. page is indexable,
4. record-scoped pages pass an explicit `recordReady:true`,
5. the relevant SEO surface flag is enabled by the Stage48 guard,
6. rollout mode is public-capable (`partial_public` or `full_public`).

The main UI rollout config remains separate and still keeps Blog/Shop/global HE
out of public exposure.

## Stage 48 Activated Scope

HE SEO is active only for:

| Page | Scope | Notes |
| --- | --- | --- |
| Home | page | `/?lang=he` |
| `transport.html` | page | `/transport.html?lang=he` |
| `hotels.html` | page | `/hotels.html?lang=he` |
| `hotel.html` | record | `/hotel.html?slug=<HE-ready-hotel>&lang=he` only when the hotel record has HE title and description. |
| `recommendations.html` | page | `/recommendations.html?lang=he` |
| `car.html` | record-gated collection | `/car.html?lang=he` only as the record-gated safe collection. |
| `trips.html` | record-gated collection | `/trips.html?lang=he` only as the HE-ready trip list. |
| `trip.html` | record | `/trip.html?slug=<HE-ready-trip>&lang=he` only when the trip record has HE title and description. |

`poiMap` remains UI-ready but **not SEO-indexable** until a standalone route and
indexing strategy are approved.

## SEO Blocked Pages

No HE SEO may be generated for these surfaces until a later stage explicitly
unblocks them:

- `blog.html`
- `/blog/*`
- `plan.html`
- community/account/auth surfaces
- legal pages
- 404/notFound/unknown pages

Blog requires manually reviewed `public_ready` HE rows before any public HE read
or SEO activation.

## SEO Excluded Pages

No HE SEO may be generated for these surfaces in the current launch path:

- `shop.html`
- cart/checkout/payment
- partners
- admin

Shop requires a separate full Shop HE stage before it can enter any SEO plan.

## Canonical Strategy

Recommended first HE SEO URL model: `?lang=he`.

Reason: public `/he/` routes are intentionally disabled and redirected. Moving
to `/he/` should be a separate routing migration after sitemap, canonical and
cache behavior are designed end to end.

Do not generate canonical HE for:

- Blog until reviewed public-ready rows exist,
- Shop/cart/checkout/payment,
- admin/partner surfaces,
- fallback-only pages where visible content is primarily EN,
- record detail pages whose record is not HE-ready.

## Hreflang Strategy

Future hreflang for SEO-ready pages should include:

- `pl`
- `en`
- `he`
- `x-default`

Do not add `hreflang="he"` for:

- blocked or excluded pages,
- record detail pages whose record is not HE-ready,
- Blog posts without reviewed `public_ready` HE rows,
- Shop/cart/checkout/payment,
- pages that show EN fallback instead of reviewed HE.

## Sitemap Strategy

Static HE sitemap URLs enabled in Stage48:

- `https://www.cypruseye.com/?lang=he`
- `https://www.cypruseye.com/transport.html?lang=he`
- `https://www.cypruseye.com/hotels.html?lang=he`
- `https://www.cypruseye.com/recommendations.html?lang=he`
- `https://www.cypruseye.com/car.html?lang=he`
- `https://www.cypruseye.com/trips.html?lang=he`

Dynamic sitemap may add only:

- HE-ready hotel detail records.
- HE-ready trip detail records.

It must not include:

- Blog,
- Shop/cart/checkout/payment,
- admin/partners,
- plan/community/legal until manually reviewed,
- not-ready records,
- EN fallback pages pretending to be HE pages.

## OpenGraph And Structured Data

HE OpenGraph and JSON-LD may be generated only for Stage48 SEO-ready pages and
HE-ready detail records. Do not generate HE OpenGraph or JSON-LD for
fallback-only pages.

Blog and Shop structured data remain excluded.

## Rollback

If HE SEO causes any issue:

1. Set `CE_HE_SEO_ROLLOUT_CONFIG` to disable `seoEnabled`, `sitemapEnabled`,
   `hreflangEnabled`, `canonicalEnabled`, `canonicalHeEnabled` and
   `indexingEnabled`.
2. Or set `CE_HE_SEO_ENABLED=false` as the coarse rollback switch.
3. Keep `/he/` redirects active.
4. Purge Cloudflare cache.
5. Re-run `npm run seo:he-guard` and `npm run seo:audit`.

## Manual SQL

No new SQL required for this stage.

## Stage 49 Live SEO HE Monitoring

Status: **GO and locked at `92c7c73`; scope remains ready pages only**.

Live Stage49 checks must confirm that sitemap, canonical, hreflang, OpenGraph
and JSON-LD expose HE only for:

- Home,
- `transport.html`,
- `hotels.html`,
- HE-ready hotel detail records,
- `recommendations.html`,
- `car.html`,
- `trips.html`,
- HE-ready trip detail records.

Live monitoring found two guard issues before final GO:

- server-rendered HE pages had `lang="he"` but still carried `dir="ltr"`;
- blocked Blog detail could resolve a Hebrew sibling translation and leak HE
  canonical/OpenGraph metadata.

Final visual verification then found two allowed-scope SEO regressions after
`6000d46`:

- `car.html?lang=he` kept HE UI/RTL and hreflang but client-side SEO rewrote
  canonical/OpenGraph away from `?lang=he`; fixed in `51dd163`.
- HE-ready `trip.html?slug=...&lang=he` kept HE UI/RTL and hreflang but the
  inline trip SEO updater rewrote canonical/OpenGraph to PL; fixed in
  `92c7c73`.

The hotfix keeps Blog public HE blocked by:

- setting server-rendered `dir="rtl"` only when the resolved SEO payload
  language is `he`,
- preserving raw `pl/en/he` blog translation language values internally,
- preventing non-HE Blog pages from falling back to HE translations,
- forcing Cloudflare Blog list/detail functions through the `blog` /
  `blogPost` SEO page guard,
- adding `seo:he-guard` regressions for both cases.

Blog, Shop/cart/checkout/payment, partners/admin, public `/he/` routes and
not-ready records remain outside HE SEO.

Rollback remains unchanged: disable HE SEO flags, purge Cloudflare cache and
re-run `npm run seo:he-guard` plus `npm run seo:audit`.

Final live result after hotfix: **GO**.

Live sitemap HE URLs:

- `https://www.cypruseye.com/?lang=he`
- `https://www.cypruseye.com/car.html?lang=he`
- `https://www.cypruseye.com/hotel.html?slug=7-ukow&lang=he`
- `https://www.cypruseye.com/hotels.html?lang=he`
- `https://www.cypruseye.com/recommendations.html?lang=he`
- `https://www.cypruseye.com/transport.html?lang=he`
- `https://www.cypruseye.com/trips.html?lang=he`
- `https://www.cypruseye.com/trip.html?slug=rejs-indywidualny&lang=he`
- `https://www.cypruseye.com/trip.html?slug=trasa-blue-lagoon&lang=he`
- `https://www.cypruseye.com/trip.html?slug=trasa-gory-trodos-i-lefkara&lang=he`
- `https://www.cypruseye.com/trip.html?slug=trasa-kanion-avakas&lang=he`
- `https://www.cypruseye.com/trip.html?slug=trasa-skaa-afrodyty&lang=he`
- `https://www.cypruseye.com/trip.html?slug=trasa-w-dzikich-gorach-trodos&lang=he`
- `https://www.cypruseye.com/trip.html?slug=wyjazd-indywidualny-5h&lang=he`
- `https://www.cypruseye.com/trip.html?slug=wyjazd-indywidualny-8h&lang=he`
- `https://www.cypruseye.com/trip.html?slug=wyjazd-indywidualny-do-10h&lang=he`
- `https://www.cypruseye.com/trip.html?slug=wyjazdy-na-motorze-kierowca&lang=he`
- `https://www.cypruseye.com/trip.html?slug=wyjazdy-na-motorze&lang=he`
- `https://www.cypruseye.com/trip.html?slug=zabawa-off-roadowa-na-powyspie-akamas&lang=he`

Live blocked/excluded checks confirmed no HE canonical, hreflang or OpenGraph
for Blog, Shop, Plan, Partners, Admin, not-ready records or public `/he/`
routes.

## Stage 50 Monitoring Lock

Stage50 freezes the current SEO scope after the Stage49 GO.

Do not expand HE SEO beyond the live allowed URLs until a separate approved
stage changes this document and `functions/_utils/heSeoReadiness.js`.

Operational monitoring is now tracked in:

- `docs/he-production-monitoring-checklist.md`

Required standing checks:

- sitemap must contain only the Stage49 HE URLs;
- Blog and `/blog/*` must remain absent from HE sitemap/canonical/hreflang/OG;
- Shop/cart/checkout/payment must remain absent from HE sitemap/canonical/
  hreflang/OG;
- `/he/` routes must remain redirect/fallback routes;
- not-ready records must not produce HE canonical/hreflang/OpenGraph.

No SQL is required for this monitoring lock.
