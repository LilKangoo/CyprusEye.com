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
