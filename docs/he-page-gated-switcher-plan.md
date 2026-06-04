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

## Stage 31 Live Monitoring And Expansion Decision

Live monitoring status: **stable for the current READY page scope**.

READY page checks:

| Page | Result |
| --- | --- |
| `transport.html?lang=he` | HE/RTL active, HE visible in switcher, dynamic HE visible, no overflow, no critical console/request errors. |
| `hotels.html?lang=he` | HE/RTL active, HE visible in switcher, dynamic HE visible, no overflow, no critical console/request errors. |
| `hotel.html?slug=rgb-cabins-larnaka-centrum&lang=he` | HE/RTL active, HE visible in switcher, dynamic HE visible, no overflow, no critical console/request errors. |
| `recommendations.html?lang=he` | HE/RTL active, HE visible in switcher, dynamic HE visible, no overflow, no critical console/request errors. |

Language switching on READY pages:

- HE -> EN -> PL works on Transport, Hotels, Hotel detail and Recommendations.
- HE uses `dir="rtl"`; EN and PL use `dir="ltr"`.

Cross-navigation checks:

| Flow | Result |
| --- | --- |
| Transport HE -> Shop | Normalizes to EN/LTR; HE switcher hidden; Shop remains excluded. |
| Hotels HE -> Blog | Normalizes to EN/LTR; HE switcher hidden; Blog remains blocked. |
| Recommendations HE -> Plan | Normalizes to EN/LTR; HE switcher hidden; Plan remains blocked. |
| Hotel HE -> Car | Normalizes to EN/LTR; HE switcher hidden; Car remains partial/internal-only. |
| Recommendations HE -> Home | Normalizes to EN/LTR; HE switcher hidden; Home remains partial/internal-only. |

Blocked/excluded regression checks:

- `shop.html?lang=he`, `blog.html?lang=he`, blog detail, `plan.html?lang=he`,
  `partners/?lang=he` and `admin/?lang=he` do not expose public HE.
- Admin redirects to the login surface and does not load the public rollout
  snapshot, which is acceptable for public exclusion.

SEO and tracking sanity:

- Sitemap, hreflang, canonical, OpenGraph and indexing remain free of HE public
  launch changes.
- `/he/` and `/he/transport.html` still fall back to `/?lang=en`.
- GA/GTM/Cloudflare telemetry requests were observed on READY pages.
- Referral capture from `?ref=` works on HE Transport and persists into HE
  Recommendations.
- Recommendations tracking functions (`trackView`, `trackClick`) are available
  in HE page-gated mode.

## Stage 32 Link Builder Cleanup

Status: **implemented in code, not used to expand public HE scope**.

The READY-page link issue from Stage31 is addressed centrally:

- `js/i18n.js` exposes `buildLocalizedUrl(targetUrl, currentLang)`.
- The helper resolves the destination page through the HE readiness registry
  before deciding whether `lang=he` may be carried.
- READY destinations may keep `lang=he`.
- PARTIAL destinations may keep `lang=he` only if fallback is explicitly allowed
  and the rollout mode permits partial public pages. Current production config
  keeps `allowPartialPagesPublic:false`, so public links normalize to `lang=en`.
- BLOCKED and EXCLUDED destinations normalize to `lang=en`.
- `updateInternalLinks()` rewrites same-origin anchors and `data-page-url`
  targets after translation and again after language-change handlers render late
  links.
- Header cart/auth URL builders now delegate to `window.CELanguage.buildLocalizedUrl`
  where available, so Shop and Auth do not accidentally inherit HE from READY
  pages.

Cross-navigation expectation after Stage32:

| Source state | Destination readiness | Link behavior |
| --- | --- | --- |
| READY page in HE | READY | Keep `lang=he`. |
| READY page in HE | PARTIAL public-disabled | Rewrite to `lang=en`. |
| READY page in HE | BLOCKED | Rewrite to `lang=en`. |
| READY page in HE | EXCLUDED | Rewrite to `lang=en`. |

Expansion recommendation:

- Do not enable `allowPartialPagesPublic` yet.
- Next step should be PARTIAL-safe content completion and navigation cleanup for
  Home, Cars, Trips, Trip detail and POI/map.
- Blog should remain a separate content/RLS/routing stage.
- Shop should remain excluded until a dedicated Shop/checkout HE stage.

## Stage 32 PARTIAL Page Readiness

No PARTIAL page is promoted to public READY in Stage32.

| Page/module | Current recommendation | Missing before public HE | Safe fallback notes |
| --- | --- | --- | --- |
| Home / `index.html` | Keep PARTIAL | Aggregates Cars, Trips, POI/map and links into blocked/excluded modules; needs module-level hiding or more content. | EN fallback is technically safe, but mixed-module homepage should not be public HE until visible sections are curated. |
| `car.html` | Candidate after small content/review pass | 27 cars are partial; features/options/descriptions need HE review. | Brand/model names can remain as-is; user-facing labels must be HE or reviewed EN fallback. |
| `trips.html` | Keep PARTIAL | Only 3 of 12 trips have HE; listing needs either record gating or more translated trips. | EN fallback is safe but too visible for public launch without gating. |
| `trip.html` | Candidate only for translated trip records | Detail page is safe only for the 3 translated trip records; itinerary/highlights/FAQ need per-record review. | Needs slug/record gating before public switcher exposure. |
| POI/map flow | Keep PARTIAL | Only top 10 of 139 POI have HE; global map would show heavy EN fallback. | Can become candidate if the HE map view is limited to translated/top POI. |

## Stage 33 Record-Level Gating

Status: **prepared in code and SQL draft; no new public pages enabled**.

Runtime changes:

- `js/i18n.js` exposes `isRecordReadyForLanguage(record, type, language)` and
  `filterRecordsReadyForLanguage(records, type, language)`.
- `trips.html` and `js/home-trips.js` filter HE trip lists to records with
  reviewed HE title/description and optional HE itinerary/highlights/FAQ when
  those fields exist.
- `trip.html` blocks direct HE rendering for an unready trip record by
  normalizing the URL/runtime language back to EN.
- `js/car-rental-paphos.js` and `js/home-cars.js` gate HE car fleet rendering to
  records with localized HE features; model names may remain brand/model text.
- `js/poi-loader.js` keeps `PLACES_DATA_ALL` as the full source and exposes
  `PLACES_DATA` filtered to HE-ready POI when HE is active.

Prepared manual SQL:

- Draft/top-up: `supabase/manual/he_partial_pages_stage33.sql`
- Verify after manual COMMIT: `supabase/manual/he_partial_pages_stage33_verify.sql`

Stage33.5 verify fix:

- The first verify draft failed in Supabase SQL Editor because
  `COALESCE(car_model, car_type, car_model_new, car_type_new, id::text)` mixed
  JSONB and text columns.
- The verify script now normalizes each car model candidate through
  `pg_temp.he_stage33_text_label(to_jsonb(...))` before `COALESCE`.
- Stage33 is not considered verified until the repaired
  `he_partial_pages_stage33_verify.sql` passes after a human-reviewed COMMIT of
  the Stage33 content pack.

Safe Stage34 apply flow:

1. Run `supabase/manual/he_partial_pages_stage33.sql` as-is and confirm preview
   counts: trips `3`, cars `5`, POI `10`.
2. Review every Hebrew value with a human/native speaker.
3. Replace only the final `ROLLBACK` with `COMMIT` after review.
4. Run the repaired `supabase/manual/he_partial_pages_stage33_verify.sql`.
5. Move to rollout testing only if verify shows trips `3/3`, cars `5/5` and
   POI `10/10` HE-ready records.

Candidate scope after Stage33:

| Page/module | Stage33 status | Reason |
| --- | --- | --- |
| Car | CANDIDATE READY after Stage33 SQL + human review | Top 5 car records can be gated; booking/static labels already use HE fallback helpers. |
| Trips listing | RECORD-GATED READY after Stage33 SQL + human review | Listing can show only the 3 HE-ready trips. |
| Trip detail | RECORD-GATED READY after Stage33 SQL + human review | Direct HE is allowed only when the loaded trip passes record readiness. |
| Home | PARTIAL | Home can reuse gated cars/trips/POI, but blog/shop preview decisions still need a separate UI pass. |
| POI/map | RECORD-GATED READY after Stage33 SQL + human review | HE view can be limited to top 10 HE-ready POI; full map remains partial. |

## Stage 34 Manual Apply And Record-Gated Smoke

Status: **applied + verified manually in Supabase**. No public status changes
were made by Stage34; the applied data only prepares record-level HE candidates.

Manual apply gate:

1. Run `supabase/manual/he_partial_pages_stage33.sql` unchanged with the final
   `ROLLBACK`.
2. Confirm preview rows:
   - `stage33_trips_top3_he = 3`
   - `stage33_cars_top5_he_features = 5`
   - `stage33_poi_top10_he = 10`
3. Review every Hebrew value with a human/native speaker.
4. Replace only the final `ROLLBACK` with `COMMIT` and run the reviewed SQL in
   Supabase SQL Editor.
5. Run `supabase/manual/he_partial_pages_stage33_verify.sql`.
6. Treat Stage33 as applied + verified only if verify shows:
   - trips top 3 selected and HE-ready
   - cars top 5 selected and HE-ready features present
   - POI top 10 selected and HE-ready name/description/badge present

Record-gated smoke expectations after verify:

| Surface | Expected behavior after verified data | Public status now |
| --- | --- | --- |
| Car | HE view can be limited to HE-ready top car records; booking popup must stay free of `undefined`/`null`. | Keep PARTIAL until a separate rollout approval. |
| Trips listing | HE listing can show only the 3 HE-ready trips. | Keep PARTIAL until record-gated rollout approval. |
| Trip detail | HE allowed only for loaded trip records that pass readiness; unready slug normalizes to EN/LTR. | Keep PARTIAL until record-gated rollout approval. |
| POI/map | HE map can expose only top HE-ready POI or an explicitly approved fallback set. | Keep PARTIAL until record-gated rollout approval. |
| Home | Remains PARTIAL because Blog/Shop previews and aggregated modules still need curation. | No public HE expansion. |

## Stage 35 Record-Gated Smoke Decision

Status: **data verified; record-gated rollout can be considered in the next
stage, but is not enabled here**.

Stage33 data verification:

- Manual Supabase COMMIT was completed for `he_partial_pages_stage33.sql`.
- `he_partial_pages_stage33_verify.sql` ran without the previous JSONB/text
  COALESCE error.
- Additional read-only runtime verification through
  `scripts/verify-he-stage33-data.js` confirmed:
  - Trips top 3: `3/3` found and HE-ready.
  - Cars top 5: `5/5` found and HE-ready by `features.he`.
  - POI top 10: `10/10` found and HE-ready by name/description/badge.

Record-gated status after Stage35:

| Page/module | Stage35 recommendation | Reason |
| --- | --- | --- |
| Car | RECORD-GATED READY candidate | Top 5 cars have `features.he`; model names can remain brand/model labels. Keep page status PARTIAL until explicit rollout approval. |
| Trips listing | RECORD-GATED READY candidate | Top 3 trips have HE title and description; listing must expose only ready trip records in HE. |
| Trip detail | RECORD-GATED READY per record | HE is safe only when the loaded trip passes record readiness; unready slugs must normalize to EN/LTR. |
| POI/map | RECORD-GATED READY candidate | Top 10 POI have HE name, description and badge; full POI set is still not HE-ready. |
| Home | PARTIAL | Aggregates Blog/Shop and multiple partial modules; do not expose Home HE until section-level curation is complete. |

Public exclusions remain unchanged: Blog is BLOCKED, Shop/cart/checkout/payment
are EXCLUDED, SEO/sitemap/hreflang/canonical/indexing HE are off, and public
`/he/` routes remain disabled.

## Stage 36 Controlled Record-Gated Expansion

Status: **prepared in runtime config and registry for record-gated pages only**.
This is not a global HE launch.

Rollout flags:

- `mode: "partial_public"`
- `pageGated: true`
- `stage25SqlApplied: true`
- `stage33SqlApplied: true`
- `recordGatedPagesPublic: true`
- `allowPartialPagesPublic: false`
- SEO/sitemap/hreflang/canonical/indexing remain `false`.

Final page status for Stage36:

| Page/module | Status | Public HE behavior |
| --- | --- | --- |
| Transport | READY | HE switcher/routes allowed. |
| Hotels | READY | HE switcher/routes allowed after Stage25. |
| Hotel detail | READY | HE switcher/routes allowed after Stage25. |
| Recommendations | READY | HE switcher/routes allowed after Stage25. |
| Car | RECORD-GATED READY | HE switcher/routes allowed only because Stage33 is verified; runtime filters to HE-ready car records. |
| Trips listing | RECORD-GATED READY | HE switcher/routes allowed only because Stage33 is verified; listing filters to HE-ready trips. |
| Trip detail | RECORD-GATED READY per record | HE route may open, but unready loaded trip records normalize back to EN/LTR. |
| POI/map | RECORD-GATED READY | HE map data is filtered to HE-ready POI. |
| Home | PARTIAL | Public HE remains blocked. |
| Blog / Blog post | BLOCKED | Public HE remains blocked. |
| Shop / checkout / payment | EXCLUDED | HE remains blocked and EN/LTR. |
| Partners / Admin | EXCLUDED | No public HE exposure. |

Rollback:

1. Set `recordGatedPagesPublic:false` in `js/he-beta-rollout-config.js`.
2. Keep `stage33SqlApplied:true` for data history, but the pages return to
   blocked public HE because the public record-gated flag is off.
3. Existing READY pages stay unchanged unless a regression is found.
4. If a broader issue appears, set `mode:"beta_users"` or
   `mode:"internal_only"` and redeploy/purge Cloudflare cache.

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

## Stage 37 Record-Gated Live Deployment

Status on 2026-06-02: **GO - production is serving the record-gated config and
live smoke passed for the scoped pages**.

Pre-deploy config confirmed:

- `mode:"partial_public"`
- `pageGated:true`
- `stage25SqlApplied:true`
- `stage33SqlApplied:true`
- `recordGatedPagesPublic:true`
- `allowPartialPagesPublic:false`
- HE SEO/sitemap/hreflang/canonical/indexing remain `false`.

Stage33 data verification passed against Supabase:

| Scope | Verified ready records |
| --- | ---: |
| Trips top 3 | 3/3 |
| Cars top 5 | 5/5 |
| POI top 10 | 10/10 |

Record-gated pages eligible after deploy:

- `car.html`
- `trips.html`
- `trip.html` only for HE-ready records
- POI/map flow only for HE-ready POI

Still blocked or excluded:

- Home remains PARTIAL.
- Blog and Blog post remain BLOCKED.
- Shop/cart/checkout/payment remain EXCLUDED.
- Partners/Admin remain EXCLUDED.
- Public `/he/` routes remain disabled.

Live monitoring result:

1. `js/he-beta-rollout-config.js` on production contains
   `recordGatedPagesPublic:true` and `stage33SqlApplied:true`.
2. Existing READY pages pass live HE/RTL smoke: Transport, Hotels, Hotel
   detail, Recommendations.
3. Record-gated pages pass live HE/RTL smoke: Car, Trips and HE-ready Trip
   detail.
4. Unready Trip detail normalizes back to EN/LTR.
5. Home, Blog, Shop, Plan, Partners/Admin and `/he/` remain blocked or
   excluded.
6. Sitemap, hreflang, canonical, OpenGraph and indexing still expose no HE
   surface.

Issue found and fixed before the next deploy:

- `trips.html?lang=he` filtered to the correct three Stage33 trip records, but
  legacy `getTripName()` read `getCurrentLanguage()` from
  `languageSwitcher.js`, which still treated HE as hidden-preview-only. The
  helper now delegates hidden-language route access to the central rollout guard,
  so record-gated trips render Hebrew titles while Home/Blog/Shop stay blocked.

Stage37 rollback:

1. Set `recordGatedPagesPublic:false`.
2. Keep `stage33SqlApplied:true` as data history.
3. Leave existing READY pages active unless they regress.
4. Purge Cloudflare cache or redeploy the previous config if stale assets keep
   exposing record-gated pages.

## Stage 38 Home Aggregation Preparation

Status: **prepared, not public**. Home remains `PARTIAL`; this stage does not
enable Home HE, global HE, Blog HE, Shop HE, HE SEO or public `/he/` routes.

Runtime preparation:

- Added `js/home-aggregation-guard.js` for future/test Home HE rendering only.
- The guard hides blocked Home sections when Home is explicitly rendered in HE:
  Blog preview, future Shop preview containers if present, Packing shortcut,
  Tasks shortcut, Plan shortcut and Blog shortcut.
- Visible Home modules may remain visible only when they point to READY or
  record-gated pages: Transport, Hotels, Recommendations, Car, Trips and
  POI/map.
- Home links are normalized through the central `buildLocalizedUrl(...)`
  helper:
  - READY and record-gated destinations may keep `lang=he`.
  - Blog, Shop, Plan, Community, Packing, Tasks, Legal and other blocked or
    excluded destinations normalize to `lang=en`.
- Mobile bottom navigation now also uses the central localized URL helper,
  preventing `?lang=he` from being carried to blocked mobile links.
- Home map/community fallback redirects now use the central helper, preserving
  HE for Recommendations/Hotels and normalizing Community fallback to EN/LTR.

Home section decision:

| Home section | Stage38 policy |
| --- | --- |
| Header / switcher | Home stays PARTIAL, so HE switcher remains hidden publicly. |
| Transport preview/form | Can stay visible; Transport is READY. Booking/payment flow is unchanged. |
| Hotels preview | Can stay visible; Hotels are READY after Stage25. |
| Recommendations preview | Can stay visible; Recommendations are READY after Stage25. |
| Cars preview | Can stay visible only through Stage33 record-gated cars. |
| Trips preview | Can stay visible only through Stage33 top HE-ready trips. |
| POI/map | Can stay visible only through HE-ready POI/map gating. |
| Blog preview | Hidden on HE Home until Blog public HE is solved. |
| Shop/cart/checkout/payment | Excluded; links normalize to EN/LTR and checkout remains outside HE. |
| Plan / Community / Packing / Tasks shortcuts | Hidden on HE Home or linked to EN/LTR until separately prepared. |
| Footer/legal | Legal links normalize to EN/LTR until Legal HE is reviewed. |

Rollback for Home preparation:

1. Remove `js/home-aggregation-guard.js` from `index.html`.
2. Leave existing READY and record-gated pages unchanged.
3. Keep Home `PARTIAL`, Blog `BLOCKED`, Shop `EXCLUDED`, and HE SEO off.

## Stage 39 Controlled Home HE Rollout

Status: **deploy-ready controlled rollout**. Home is enabled only through a
page-specific readiness override in `js/he-beta-rollout-config.js`; this does
not enable global HE and does not set `allowPartialPagesPublic:true`.

Runtime config:

- `mode:"partial_public"`
- `pageGated:true`
- `stage25SqlApplied:true`
- `stage33SqlApplied:true`
- `recordGatedPagesPublic:true`
- `allowPartialPagesPublic:false`
- `pageReadiness.home.status:"ready"`
- HE SEO, sitemap, hreflang, canonical and indexing remain `false`.

Home visible in HE:

- Header, navigation, mobile navigation and footer shell.
- Transport preview/form.
- Hotels preview.
- Recommendations preview.
- Record-gated Cars preview.
- Record-gated Trips preview.
- Record-gated POI/map entry points.
- Coupon/referral widgets if their links normalize through the central helper.

Home blocked or normalized to EN/LTR:

- Blog preview remains hidden because Blog and Blog post are still BLOCKED.
- Shop/cart/checkout/payment remain EXCLUDED and must not enter RTL/HE.
- Plan, Community, Packing, Tasks and Legal links normalize to EN/LTR until
  those pages receive their own HE readiness gates.

Cross-navigation rule:

- READY and record-gated destinations may preserve `lang=he`.
- BLOCKED or EXCLUDED destinations must drop HE and load EN/LTR.
- `dir="rtl"` must not persist after navigating from Home HE to blocked or
  excluded pages.

Rollback:

1. Remove the `pageReadiness.home` override or set it back to `partial`.
2. Keep `allowPartialPagesPublic:false`.
3. Leave existing READY and record-gated pages unchanged.
4. Redeploy and purge Cloudflare cache if stale Home assets keep exposing HE.

## Stage 40 Blog HE Public Readiness

Status: **Blog remains BLOCKED**. Stage40 is an audit and preparation step only;
it does not enable public Blog HE, global HE, HE SEO, sitemap, hreflang,
canonical, indexing, Shop HE, or public `/he/` routes.

Root blocker:

- Migration `179_blog_translations_he_internal_guard.sql` correctly allows
  `blog_post_translations.lang = 'he'` for internal/admin/partner content.
- The same migration intentionally keeps the public read policy restricted to
  `lang IN ('pl', 'en')`, so anon/public clients cannot read HE blog
  translations yet.
- Blog list/detail runtime still has PL/EN assumptions: taxonomy selects
  `categories_pl/categories_en` and `tags_pl/tags_en`, article URLs are built
  only for PL/EN, and current detail fallback can resolve a non-HE row by slug.

Top 5 HE content candidates:

| Post | Candidate id | Stage40 status |
| --- | --- | --- |
| Affiliate / earning from tourism | `0477e103-ee8a-47b3-9b54-69757dfbc07f` | Verify with `he_blog_stage40_readiness_verify.sql`; needs human review gate. |
| ETIAS Cyprus 2026 | `2a59c0a7-52fd-498f-b4fe-d0d76617c882` | Verify with `he_blog_stage40_readiness_verify.sql`; needs human review gate. |
| Cyprus in 7 days | `2e88f39b-5b5c-4e04-82b5-c125f19920b3` | Verify with `he_blog_stage40_readiness_verify.sql`; needs human review gate. |
| Car rental without deposit | `a021f1d4-79e9-4c9e-a6ac-d36c13bd16ef` | Verify with `he_blog_stage40_readiness_verify.sql`; needs human review gate. |
| Larnaca vs Paphos | `1c1f8eb6-c709-4302-8611-6322b5ed5fad` | Verify with `he_blog_stage40_readiness_verify.sql`; needs human review gate. |

Required before Blog can leave `blocked`:

1. Run `supabase/manual/he_blog_stage40_readiness_verify.sql` in Supabase SQL
   Editor and confirm `blog_top5_he_readiness.candidate_complete = 5`.
2. Add a public-read review gate for HE translations. Draft:
   `supabase/manual/he_blog_stage41_public_read_draft.sql`.
3. Implement Blog list record-gating: HE list shows only `review_status =
   'public_ready'` posts and uses `categories_he/tags_he`.
4. Implement Blog detail record-gating: HE detail works only for HE-ready slugs;
   non-ready posts normalize to EN/LTR.
5. Normalize Blog CTA links through page readiness so Shop/blocked destinations
   do not carry `lang=he`.
6. Keep HE SEO off until the separate SEO phase.

## Stage 41 Blog Record-Gated Readiness

Status: **prepared, still BLOCKED**. Stage41 adds the missing pieces for a
future record-gated Blog rollout, but it does not change the page registry to
ready/record-gated and does not enable Blog HE publicly.

Prepared runtime behavior:

- Cloudflare Blog helpers now have a strict HE path for list/detail:
  `lang='he'` requires `review_status='public_ready'`.
- `blog.html` has a dormant HE list query that reads from
  `blog_post_translations` and shows only reviewed HE rows.
- Blog detail has a dormant HE detail query that returns `null` for non-ready
  slugs instead of falling back to EN/PL.
- Blog taxonomy is HE-specific on HE paths: `categories_he` and `tags_he`.
- Blog CTA links normalize Shop to EN/LTR and only keep HE blog links when the
  target translation is explicitly public-ready.

Prepared SQL:

- `supabase/manual/he_blog_stage41_public_read_draft.sql` remains a ROLLBACK
  preview.
- `supabase/manual/he_blog_stage41_public_read_apply.sql` is the manual COMMIT
  version.
- `supabase/manual/he_blog_stage41_public_read_verify.sql` checks review
  columns, public policy, top-five readiness, duplicate HE slugs and CTA risk.

Public readiness remains blocked until:

1. Human review marks the top five HE translations as ready.
2. The apply SQL has been run manually in Supabase SQL Editor.
3. The verify SQL reports `public_ready_he_rows = 5` and zero duplicate HE
   slugs.
4. A separate rollout stage updates Blog/BlogPost from `blocked` to
   record-gated and runs live smoke tests.
5. HE SEO remains off until a later SEO-specific stage.

## Stage 42 Blog Human Review Gate

Status: **manual gate prepared, Blog still BLOCKED**.

The Stage42 Supabase preview screenshot showed
`stage41_he_rows_public_ready_in_transaction.public_ready_he_rows = 0`. This is
expected before editorial approval, but it means Blog cannot be treated as
record-gated ready yet.

Prepared SQL:

- `supabase/manual/he_blog_stage42_mark_top5_public_ready_draft.sql` previews
  marking only the selected top-five HE translations and ends with `ROLLBACK`.
- `supabase/manual/he_blog_stage42_mark_top5_public_ready_apply.sql` is the
  manual `COMMIT` version. It raises if fewer than five selected posts are
  complete or if duplicate HE slugs exist.
- `supabase/manual/he_blog_stage42_public_ready_verify.sql` verifies the
  top-five public-ready rows, duplicate slug safety and parent post status.

Manual sequence:

1. Run `he_blog_stage41_public_read_apply.sql` if the review columns/policy are
   not already committed.
2. Run `he_blog_stage42_mark_top5_public_ready_draft.sql` and review every row.
3. Only after human/native review accepts the top five, run
   `he_blog_stage42_mark_top5_public_ready_apply.sql`.
4. Run `he_blog_stage42_public_ready_verify.sql` and proceed only if
   `public_ready_he_rows = 5` and the duplicate/parent checks return zero
   problem rows.

Current registry decision: keep `blog` and `blogPost` as `blocked`. Do not show
HE in the Blog switcher and do not allow `blog.html?lang=he` until a later
rollout stage changes the registry after clean verify and smoke tests.

## Stage 43 Manual Content Workflow

Status: **system workflow prepared; Blog remains BLOCKED**.

Stage43 changes the content policy: Codex must not auto-translate long Blog
posts or mark them `public_ready`. Blog HE becomes public only through manual
editorial review and manual SQL gating.

Static UI cleanup:

- Missing HE keys reduced from 317 to 216.
- Same-as-EN keys reduced from 553 to 547.
- Completed short UI labels for Shop basics, Dashboard and partner form fields.
- Deferred long partner marketing copy, SEO meta, email templates, Blog content
  and long Shop copy to human review.

Manual workflow doc:

- `docs/he-manual-translation-admin-guide.md`

Page registry decision:

- `home`, READY pages and current record-gated pages remain unchanged.
- `blog` and `blogPost` remain `blocked`.
- `shop` remains `excluded`.
- HE SEO remains off.

Future Blog registry change is allowed only after:

1. Human/native review accepts specific posts.
2. Stage41/Stage42 manual SQL is applied.
3. Stage42 verify reports public-ready rows only for reviewed posts.
4. Blog list/detail smoke confirms not-ready posts normalize to EN/LTR.

## Stage 44 Switcher Impact

Status: **no readiness registry change**.

Stage44 only completes static translation structure and audit tooling. It does
not change:

- `home` readiness,
- READY pages,
- record-gated pages,
- Blog/BlogPost blocked state,
- Shop exclusion,
- SEO/sitemap/hreflang/canonical/indexing state.

Switcher rules remain:

- HE can appear only on currently allowed page-gated surfaces.
- Blog must not show HE until reviewed posts are marked `public_ready` and a
  dedicated rollout stage changes the registry.
- Shop/cart/checkout/payment remain excluded.
- Blocked/excluded destinations must normalize to EN/LTR through
  `buildLocalizedUrl(...)`.

Stage44 audit requirement before future switcher expansion:

- `npm run i18n:tri-audit`
- `PL keys missing EN = 0`
- `placeholderMismatches = 0`
- `htmlTagMismatches = 0`

## Stage 45 Switcher Impact

Status: **no readiness registry change**.

Stage45 adds manual translation export/import workflow only. It does not change:

- Home page-gated HE.
- READY pages.
- Record-gated car/trips/trip/POI map pages.
- Blog/BlogPost blocked state.
- Shop exclusion.
- SEO/sitemap/hreflang/canonical/indexing state.

Switcher expansion remains blocked by the same content gates:

- Blog requires manual `public_ready` review.
- Shop requires a separate Shop HE decision.
- SEO requires a dedicated SEO HE stage.

## Stage 47 SEO Guard Impact

Status: **no switcher readiness change**.

Stage47 prepares SEO-only guardrails and does not change page-gated UI rollout.

Current UI readiness stays:

- Home remains page-gated live.
- READY pages stay active.
- Record-gated pages stay active.
- Blog/BlogPost remain blocked.
- Shop remains excluded.

SEO readiness is tracked separately in
`functions/_utils/heSeoReadiness.js` and documented in
`docs/he-seo-rollout-plan.md`.

Important separation:

- A page can be UI-ready in HE without being SEO-indexable.
- `poiMap` is UI record-gated but not SEO-indexable yet.
- Blog must not become switcher/SEO-ready until manually reviewed
  `public_ready` rows exist.
- Shop/cart/checkout/payment must not become switcher/SEO-ready in the current
  launch path.

## Stage 48 SEO Activation Impact

Status: **SEO-only change; no switcher readiness change**.

Stage48 activates HE SEO only through `functions/_utils/heSeoReadiness.js` for
already page-gated pages and HE-ready records. It does not change the UI
readiness registry or public language switcher behavior.

UI status remains:

- Home is page-gated live.
- READY pages stay active.
- Record-gated car/trips/trip/POI map pages stay active.
- Blog/BlogPost remain blocked.
- Shop/cart/checkout/payment remain excluded.

SEO status now differs from switcher status:

- `poiMap` remains UI-ready but not SEO-indexable.
- Blog remains absent from HE sitemap, hreflang and canonical.
- Shop remains absent from HE sitemap, hreflang and canonical.
- `/he/` routes remain disabled.

Rollback of SEO HE does not require disabling existing page-gated HE UI. Set
`CE_HE_SEO_ENABLED=false` or disable HE SEO surfaces in
`CE_HE_SEO_ROLLOUT_CONFIG`, purge cache, and re-run SEO guard tests.

## Stage 49 SEO Monitoring Impact

Status: **no switcher readiness change**.

Stage49 only verifies and hardens SEO/live metadata. It does not change the
page-gated UI registry:

- Home remains active in page-gated HE.
- READY pages remain active.
- Record-gated car/trips/trip/POI map pages remain active.
- Blog/BlogPost remain blocked.
- Shop/cart/checkout/payment remain excluded.

The Stage49 hotfix prevents blocked Blog detail pages from leaking HE
canonical/OpenGraph metadata when `?lang=he` is requested. It also ensures
server-rendered HE pages carry `dir="rtl"`. Existing switcher gating and
`buildLocalizedUrl(...)` behavior remain unchanged.
