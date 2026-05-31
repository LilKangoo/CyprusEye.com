# HE Page-Gated Switcher Plan

Generated: 2026-05-31

This plan prepares the Hebrew switcher architecture only. It does not enable
global public HE, sitemap entries, hreflang, canonical metadata, SEO indexing,
public `/he/` routes, or Shop checkout in Hebrew.

## Central Rule

HE can be offered only when both gates pass:

1. The central rollout config allows HE for the requested surface.
2. The current page is allowed by the HE page readiness registry.

The page registry is implemented in `js/i18n.js` and exposed through:

- `window.CELanguageRollout.getHePageReadiness()`
- `window.CELanguageRollout.isLanguageEnabledForSurface('he', surface)`
- `window.CELanguageRollout.snapshot().he.pageReadiness`

## Page Readiness Table

| Page / flow | Registry key | Status | Fallback allowed | Notes |
| --- | --- | --- | --- | --- |
| Home | `home` | `partial` | yes | Aggregates ready and partial modules. |
| Transport | `transport` | `ready` | no | Transport static and dynamic location/route content are HE-ready. |
| Hotels listing | `hotels` | `ready` after verified Stage25 SQL | no | `hotel_amenities.name_he` is available after Stage25. |
| Hotel detail | `hotel` | `ready` after verified Stage25 SQL | no | Amenity dictionary HE is available after Stage25. |
| Recommendations | `recommendations` | `ready` after verified Stage25 SQL | no | Active recommendations and category labels are HE-ready after Stage25. |
| Car rental | `car` | `partial` | yes | Top cars can render with HE/EN fallback; full fleet still partial. |
| Trips listing | `trips` | `partial` | yes | Only selected trip records are HE-ready. |
| Trip detail | `trip` | `partial` | yes | Safe only for translated records plus EN fallback. |
| POI / map | `poiMap` | `partial` | yes | Top POI only; full POI catalog is not ready. |
| Blog list | `blog` | `blocked` | no | Public HE blog translations remain hidden from anon/public read. |
| Blog detail | `blogPost` | `blocked` | no | Public HE post rows are not exposed yet. |
| Plan | `plan` | `blocked` | no | Planner dynamic content is not HE-ready. |
| Community / attractions / packing / VIP / tasks / coupon | `community` | `blocked` | no | Needs separate dynamic and RTL QA. |
| Account / auth | `accountAuth` | `blocked` | no | Needs logged-in RTL QA. |
| Legal | `legal` | `blocked` | no | Legal copy and HE SEO are not reviewed. |
| Partners / advertise | `partners` | `excluded` | no | Not public HE launch scope. |
| Admin | `admin` | `excluded` | no | Internal-only. |
| Shop / checkout / payment | `shop` | `excluded` | no | Shop remains outside first HE rollout. |
| 404 | `notFound` | `blocked` | no | Needs final routing/copy QA. |
| Unknown pages | `unknown` | `blocked` | no | Conservative default. |

## Switcher Behavior

| Registry status | Switcher behavior | `?lang=he` behavior | SEO behavior |
| --- | --- | --- | --- |
| `ready` | HE may be shown when rollout allows the switcher surface. | HE/RTL may activate when rollout allows routes. | Still off until explicit HE SEO phase. |
| `partial` | HE may be shown only when fallback is explicitly allowed. | HE/RTL may activate with safe EN fallback. | HE SEO remains blocked. |
| `blocked` | HE is hidden. | Normalizes to EN/LTR. | HE SEO blocked. |
| `excluded` | HE is hidden. | Normalizes to EN/LTR. | HE SEO blocked. |

## Stage25 SQL Status

Stage25 SQL status: **applied manually and verified for the page-gated scope**.

These pages now resolve as `ready` when `stage25SqlApplied:true` is present in
the rollout config:

- `hotels`
- `hotel`
- `recommendations`

Current rollout config includes:

```js
window.CE_LANGUAGE_ROLLOUT_CONFIG = {
  he: {
    stage25SqlApplied: true
  }
};
```

This still does not enable HE SEO or global public HE.

## Stage 29 Page-Gated Public HE Scope

Stage 29 enables controlled page-gated HE only for pages marked `ready`. This
is not a global Hebrew launch.

Runtime config:

```js
window.CE_LANGUAGE_ROLLOUT_CONFIG = {
  he: {
    mode: 'partial_public',
    switcher: true,
    routes: true,
    publicApi: true,
    seo: false,
    sitemap: false,
    hreflang: false,
    canonical: false,
    indexing: false,
    hiddenPreview: false,
    pageGated: true,
    stage25SqlApplied: true,
    allowPartialPagesPublic: false
  }
};
```

Public HE is allowed only on:

- `transport.html`
- `hotels.html`
- `hotel.html`
- `recommendations.html`

Partial-safe pages remain internal/beta-only:

- `index.html`
- `car.html`
- `trips.html`
- `trip.html`
- POI/map flow

Blocked and excluded pages must normalize `?lang=he` to EN/LTR and must not
show HE in the switcher.

## Stage 27 SQL Apply Checklist

Stage 25 SQL review status: **applied manually and verified**.

The reviewed apply file:

- adds `public.hotel_amenities.name_he` if missing;
- fills only missing HE fields through `COALESCE` / existing-value checks;
- updates only HE fields/dictionaries for the narrow public-ready scope;
- does not overwrite PL/EN source fields;
- does not change SEO, sitemap, hreflang, canonical, indexing, public `/he/`
  routes, or switcher mode.

Manual apply flow for repeat/staging environments:

1. Open `supabase/manual/he_public_ready_dynamic_stage25.sql`.
2. Review Hebrew values one final time.
3. Run the full file. It already ends with `COMMIT;`.
4. Open and run `supabase/manual/he_public_ready_dynamic_stage25_verify.sql`.
5. Treat the apply as successful only when verify counts match the expected
   scope below.

Expected verify signals:

| Check | Expected result |
| --- | ---: |
| `transport_routes_he` | all active routes have HE origin and destination labels |
| `hotels_he_records` | all published hotel records ready |
| `hotel_amenities_he` | 48 active amenities ready |
| `recommendations_he_active` | all active recommendations ready |
| `poi_categories_he` | 23 selected/active category labels ready |
| `recommendation_categories_he` | 15 selected/active category labels ready |

If verify does not match in another environment:

- do not set `stage25SqlApplied:true`;
- keep `hotels`, `hotel` and `recommendations` as `partial`;
- inspect missing rows from the verify output;
- apply a small HE-only corrective SQL patch;
- rerun verify before enabling page-gated switcher on those pages.

Stage 28 verified dynamic audit signals:

| Check | Verified result |
| --- | ---: |
| Hotels | 2/2 complete |
| Hotel amenities dictionary | 48/48 complete |
| Recommendations | 10/10 complete |
| POI categories | 23/23 complete |
| Recommendation categories | 15/15 complete |
| Transport | 44/44 complete |

## Shop Exclusion

Shop remains excluded from first HE rollout:

- `shop.html` does not show HE in the switcher.
- `shop.html?lang=he` normalizes to EN/LTR.
- Checkout, cart, shipping and payment must not enter RTL/HE.
- Shop can join HE only after a separate Shop translation and checkout QA stage.

## Rollback For Page-Gated Rollout

Fast rollback without touching content:

1. Set `he.mode` back to `beta_users` or `internal_only`.
2. Keep `seo`, `sitemap`, `hreflang`, `canonical`, `indexing` and `/he/` routes
   disabled.
3. Keep `shopEnabled:false`.
4. Purge Cloudflare cache after deploy/runtime config change if the config is
   cached.
5. Smoke test:
   - `transport.html?lang=he` no longer activates for anonymous users.
   - `shop.html?lang=he` stays EN/LTR.
   - `blog.html?lang=he` stays EN/LTR.
   - `seo:audit` remains clean.

## Stage 30 Live Deployment And Monitoring

Live deploy status: **GO for controlled page-gated HE on READY pages only**.

Production files verified:

- `js/he-beta-rollout-config.js` serves `mode: 'partial_public'`.
- `js/i18n.js` serves the page-gated guard with `allowPartialPagesPublic`.
- `seo`, `sitemap`, `hreflang`, `canonical` and `indexing` remain disabled for HE.

Live READY page smoke:

| URL | Result |
| --- | --- |
| `/transport.html?lang=he` | HE/RTL active, switcher exposes HE, no horizontal overflow. |
| `/hotels.html?lang=he` | HE/RTL active, switcher exposes HE, no horizontal overflow. |
| `/hotel.html?slug=rgb-cabins-larnaka-centrum&lang=he` | HE/RTL active, switcher exposes HE, no horizontal overflow. |
| `/recommendations.html?lang=he` | HE/RTL active, switcher exposes HE, no horizontal overflow. |

Live blocked/excluded smoke:

| Scope | Result |
| --- | --- |
| PARTIAL pages: home, car, trips, trip | `?lang=he` normalizes to EN/LTR; HE switcher hidden. |
| BLOCKED pages: blog, blog detail, plan | `?lang=he` normalizes to EN/LTR; HE switcher hidden. |
| EXCLUDED pages: shop, partners, admin | HE remains unavailable; Shop checkout/payment stay EN/LTR. |
| `/he/` and `/he/transport.html` | Redirect/fallback to `/?lang=en`; no `/he/js/...` asset paths. |

Live SEO safety:

- `sitemap.xml` contains no HE URLs.
- Checked pages contain no HE hreflang/canonical/OpenGraph URLs.
- Local `npm run seo:audit` reports 0 issues.

Known monitoring notes:

- Cloudflare RUM and Google Analytics requests may appear as aborted in headless
  smoke tests. They were not treated as application failures.
- `admin/?lang=he` redirects to `admin/login.html`, which does not load the
  public rollout snapshot. This is expected and confirms no public HE exposure.

## Blog Blocker

Blog remains blocked because public/anon reads for HE blog translations are not
part of the current launch gate. Before Blog can become `ready`:

1. Complete reviewed HE rows for selected launch posts.
2. Verify `blog_post_translations.lang = 'he'` save/reload.
3. Add a separate, reviewed public read/RLS launch migration.
4. Confirm blog list and detail pages do not expose fallback-heavy content.
5. Run RTL and SEO QA for blog.

## Rollout Steps

1. Keep HE rollout in beta/internal mode while content remains partial.
2. Apply and verify Stage25 SQL.
3. Mark Stage25 as applied only after verification.
4. Enable page-gated switcher only for `ready` or approved `partial` pages.
5. Keep Shop, Blog, Plan, Account/Auth, Legal, Admin and Partner pages blocked
   or excluded until their own gates pass.
6. Enable HE SEO/sitemap/hreflang/canonical only in the final SEO phase.
