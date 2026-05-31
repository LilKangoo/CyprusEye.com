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
| Hotels listing | `hotels` | `partial` now, `ready` after Stage25 SQL | yes until SQL | Requires `hotel_amenities.name_he`. |
| Hotel detail | `hotel` | `partial` now, `ready` after Stage25 SQL | yes until SQL | Requires amenity dictionary HE. |
| Recommendations | `recommendations` | `partial` now, `ready` after Stage25 SQL | yes until SQL | Remaining active recommendations/categories require Stage25 SQL. |
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

## Stage25 SQL Dependency

These pages remain `partial` until
`supabase/manual/he_public_ready_dynamic_stage25.sql` is applied and verified:

- `hotels`
- `hotel`
- `recommendations`

After manual verification, rollout config may set:

```js
window.CE_LANGUAGE_ROLLOUT_CONFIG = {
  he: {
    stage25SqlApplied: true
  }
};
```

This still does not enable HE SEO or global public HE.

## Shop Exclusion

Shop remains excluded from first HE rollout:

- `shop.html` does not show HE in the switcher.
- `shop.html?lang=he` normalizes to EN/LTR.
- Checkout, cart, shipping and payment must not enter RTL/HE.
- Shop can join HE only after a separate Shop translation and checkout QA stage.

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

