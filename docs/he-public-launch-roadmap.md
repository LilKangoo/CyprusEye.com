# HE Public Launch Roadmap

Generated: 2026-05-31

This roadmap prepares the full Hebrew launch but does not activate public HE,
sitemap, hreflang, canonical metadata, SEO indexing, public `/he/` routes, or
Shop checkout in Hebrew.

## Launch Principles

- One central language registry controls every public surface.
- A page can show HE only if both the global rollout and page/module readiness
  allow it.
- Missing HE content falls back to EN, then PL, then first available value, but
  SEO-indexable HE pages must not be mostly fallback EN.
- Shop checkout cannot be silently half-translated.
- Public SEO is the last phase, after content and visual QA.

## Phase A - Complete Static Translations

Goal: close public P0 and P1 keys required for a real public launch.

Current Stage 24 status:

1. Public P0/P1 static UI shells are complete for the selected public pages.
2. Remaining missing keys are intentionally deferred:
   - `shop`: 23 keys, blocked until Shop dynamic content and checkout copy are
     ready.
   - `seo`: 53 keys, blocked until HE SEO launch is approved.
   - `advertise`: 214 keys, partner/advertise copy needs a separate pass.
   - `dashboard`: 27 keys, internal/admin dashboard copy is not public launch
     scope.
3. Fill P1 SEO keys only during the final SEO phase:
   - 53 missing `seo.*` keys.
4. Triage 553 same-as-EN keys:
   - Keep brands/acronyms as same-as-EN where correct.
   - Translate real copy.
   - Mark remaining same-as-EN as accepted fallback only if intentional.

Exit criteria:

- P0 missing = 0.
- P1 missing for launch pages = 0.
- Same-as-EN list reduced or explicitly reviewed.
- `npm run i18n:audit` and `npm run i18n:he-readiness` are clean enough for
  the selected launch scope.

## Phase B - Complete Dynamic Content For Top Pages

Goal: public HE must feel like Hebrew content, not an English fallback wrapper.

Priority order:

1. Blog:
   - Complete all launch posts, or hide posts without HE from HE blog lists.
   - Required fields: slug, title, meta description, summary, lead, body,
     categories, tags.
   - Current blocker: migration 179 keeps public anon reads limited to PL/EN.
     Do not open HE blog translations publicly until the final launch gate.
2. Trips:
   - Complete all 12 trips for global launch, or gate HE to the 3 translated
     records.
3. Cars:
   - Review 27 partial car records: model can remain brand text, but type,
     features and descriptions need HE.
4. POI:
   - Expand beyond 10/139. For global launch, map should not be mostly EN.
   - Translate `name_i18n.he`, `description_i18n.he`, `badge_i18n.he`.
5. Recommendations:
   - Stage 25 prepares the remaining 5 active records and all categories.
6. Hotels:
   - Stage 25 prepares `hotel_amenities.name_he` and all 48 amenity labels.
7. Transport:
   - Dynamic route/location data is ready; keep regression tests.
8. Shop:
   - Complete product/category/vendor/shipping/discount/attribute content before
     full-site launch.

Exit criteria:

- No public HE page presents blank cards, undefined labels or PL-first fallback.
- Top public paths have reviewed HE dynamic records.
- Admin/manual SQL path exists for every remaining content gap.

### Public-ready Dynamic Content Scope

| Module | Public launch decision | Requirement before switcher |
| --- | --- | --- |
| Transport | READY | Route/location smoke on live/staging. |
| Hotels | READY TECH after Stage 25 SQL | Apply and verify `he_public_ready_dynamic_stage25.sql`; confirm amenity chips use `name_he`. |
| Blog | BLOCKED | Verify top 5 HE rows in SQL Editor, then prepare explicit RLS/public read launch migration later. |
| Trips | PAGE-GATED | Show HE only for the 3 translated trip records. |
| Cars | PAGE-GATED | Show HE only for top 5 reviewed cars; keep Shop/checkout separate. |
| Recommendations | READY after Stage 25 SQL | Verify all 10 active records and categories have HE. |
| POI / map | PARTIAL | Show only top 10 translated POI in HE surfaces; do not expose all 139 as HE. |
| Shop | EXCLUDED | Keep EN/LTR and remove HE option from Shop until a separate Shop HE stage passes. |

## Phase C - Enable HE Switcher Only On Ready Pages

Goal: no inconsistent "HE exists here but not there" behavior.

Recommended implementation:

- Keep `LANGUAGE_REGISTRY` and `window.CELanguageRollout` as the central source.
- Add a public page/module readiness registry, for example:
  - `home`, `blog`, `blogPost`, `trips`, `trip`, `hotels`, `hotel`, `car`,
    `transport`, `recommendations`, `shop`, `plan`, `auth`, `account`,
    `legal`, `community`.
- The switcher asks both:
  - Is HE globally public for the requested surface?
  - Is this page/module HE-ready?
- If a page is not HE-ready:
  - Do not show HE in the switcher for that page.
  - If user lands with `?lang=he`, redirect or normalize to EN/LTR.
  - Keep SEO/canonical on EN/PL only.

Shop rule:

- Until Shop is complete, `shop.html` must not show HE in the switcher and must
  keep EN/LTR for `?lang=he`.

Exit criteria:

- Every public page uses the same switcher component/source.
- No page-local list can expose HE independently.
- Non-ready pages cannot activate HE through query params.

## Switcher Consistency Requirements Before Launch

Before HE can be shown publicly, the switcher must be made deterministic across
all public pages:

1. Every public HTML page that can show a language switcher must load the same
   rollout config before `js/i18n.js`.
2. Every switcher surface must use the same language registry and
   `window.CELanguageRollout` decision, not local hardcoded language lists.
3. HE can be offered only when both conditions are true:
   - HE is enabled for the current rollout surface.
   - The current page/module is marked HE-ready.
4. Pages outside the HE launch scope must normalize `?lang=he` to EN/LTR and
   must not display an HE option.
5. Shop must keep `data-disable-hidden-language="true"` and must not show HE in
   its switcher until Shop dynamic content and checkout copy are reviewed.
6. Blog, trips, POI, recommendations and Shop must support per-record readiness
   decisions so fallback-heavy records are not presented as complete Hebrew
   content.
7. Public SEO surfaces must remain independent from the visual switcher. Showing
   HE in the switcher must not automatically add sitemap, hreflang, canonical or
   indexing until Phase E explicitly enables them.

Known current gaps:

- Some public pages still do not load `js/he-beta-rollout-config.js`, so their
  behavior is EN/LTR even for allowlisted HE runtime checks.
- Shop blocks active HE correctly, but an allowlisted/beta switcher surface can
  still expose the HE option. This must be removed before any public switcher.
- `plan`, `community`, `terms`, `auth`, `account`, `packing`, `vip`, `tasks` and
  similar secondary pages need a final page-readiness registry before HE can be
  offered consistently.

## Stage 26 Page-Gated Switcher Registry

Stage 26 adds the page readiness gate in `js/i18n.js`. This is architecture
only; it does not enable global public HE.

Central runtime APIs:

- `window.CELanguageRollout.getHePageReadiness()`
- `window.CELanguageRollout.isLanguageEnabledForSurface('he', surface)`
- `window.CELanguageRollout.snapshot().he.pageReadiness`

Current registry decisions:

| Status | Pages |
| --- | --- |
| `ready` | `transport`, `hotels`, `hotel`, `recommendations` |
| `partial` | `home`, `car`, `trips`, `trip`, `poiMap` |
| `blocked` | `blog`, `blogPost`, `plan`, `community`, `accountAuth`, `legal`, `notFound`, unknown pages |
| `excluded` | `shop`, `partners`, `admin` |

`hotels`, `hotel` and `recommendations` depended on
`supabase/manual/he_public_ready_dynamic_stage25.sql`. Stage25 is now applied
and verified for the page-gated scope, and the runtime config sets
`stage25SqlApplied:true`.

Page behavior:

- `ready`: HE can appear only if rollout allows the surface.
- `partial`: HE can appear only with explicit safe EN fallback; HE SEO remains
  blocked.
- `blocked`: HE is hidden and `?lang=he` normalizes to EN/LTR.
- `excluded`: HE is always hidden; Shop, checkout, admin and partner surfaces
  stay outside public HE.

Stage 28 status:

- `supabase/manual/he_public_ready_dynamic_stage25.sql` was applied manually in
  Supabase SQL Editor and verified for the page-gated scope.
- Dynamic audit now shows Hotels 2/2, Hotel amenities 48/48, Recommendations
  10/10, POI categories 23/23 and Recommendation categories 15/15.
- The runtime config now sets `stage25SqlApplied:true`.
- HE SEO, sitemap, hreflang, canonical, indexing, public `/he/` routes and
  global public HE remain disabled.

Stage 29 controlled page-gated rollout:

- HE mode is `partial_public`, but the page registry allows anonymous/public HE
  only on `ready` pages.
- Ready pages with public HE switcher/routes:
  - `transport.html`
  - `hotels.html`
  - `hotel.html`
  - `recommendations.html`
- Partial pages remain internal/beta-only because `allowPartialPagesPublic:false`:
  - `index.html`
  - `car.html`
  - `trips.html`
  - `trip.html`
  - POI/map flow
- Blocked/excluded pages remain EN/LTR for `?lang=he`:
  - Blog, Blog detail, Plan, Community, Account/Auth, Legal, 404, unknown pages
  - Shop, Partners, Admin
- SEO HE, sitemap HE, hreflang HE, canonical HE, indexing HE and public `/he/`
  routes remain off.

Rollback:

- Change HE mode back to `beta_users` or `internal_only`.
- Leave content fields in place.
- Keep `/he/` redirect active.
- Purge Cloudflare cache if needed.
- Re-smoke ready, blocked and Shop pages.

Expected readiness after verified Stage25 SQL:

| Status | Pages |
| --- | --- |
| `ready` | `transport`, `hotels`, `hotel`, `recommendations` |
| `partial` | `home`, `car`, `trips`, `trip`, `poiMap` |
| `blocked` | `blog`, `blogPost`, `plan`, `community`, `accountAuth`, `legal`, `notFound`, unknown pages |
| `excluded` | `shop`, `partners`, `admin` |

## Phase D - Enable HE Globally

Goal: public language selection is available across all ready surfaces.

Tasks:

- Change HE rollout mode from `beta_users` to public only after Phase A-C pass.
- Remove beta-only tester assumptions from final public behavior.
- Keep `hiddenPreview` disabled unless intentionally needed for admin/internal.
- Verify PL/EN are unchanged.
- Run desktop and mobile RTL QA across the whole launch scope.

Exit criteria:

- Public switcher is consistent.
- `?lang=he` works only on approved pages.
- Shop behavior matches the launch decision.

## Phase E - Enable HE SEO / Sitemap / Hreflang

Goal: make only real Hebrew pages indexable.

URL strategy decision:

- Safest short-term: keep `?lang=he`, because the app already carries language
  through query params.
- Cleaner long-term SEO: implement `/he/` routes as a separate routing project.
  This requires Cloudflare rewrites, canonical rules and asset path hardening.

Recommended approach:

1. Finish UI/content using `?lang=he`.
2. Keep `/he/` redirected until a dedicated route implementation is built.
3. Enable SEO only for pages with reviewed HE content.
4. For pages using mostly EN fallback, keep them out of HE sitemap and do not
   add `hreflang=he`.

SEO tasks:

- Translate `seo.*` title/description/OpenGraph keys.
- Generate HE sitemap entries only for ready pages.
- Add `hreflang="he"` only where the HE page is real Hebrew content.
- Set canonical to the HE URL for indexable HE pages.
- Add OpenGraph locale/content for HE.
- Validate structured data names/descriptions.
- Keep robots/indexing off for partial/fallback-heavy pages.

Exit criteria:

- `npm run seo:audit` has a Hebrew-aware mode or checklist.
- No fallback-heavy HE page is indexable.
- Sitemap, hreflang and canonical agree.

## Phase F - Public Launch And Monitoring

Launch checklist:

- Purge Cloudflare cache after deploy.
- Smoke test EN, PL and HE on desktop/mobile.
- Check console errors and failed assets.
- Check RTL overflow and sticky/modal behavior.
- Check forms and validation messages.
- Check checkout if Shop is included.
- Check analytics/referral/affiliate events.
- Monitor Supabase errors and Cloudflare logs.

Rollback:

- Set HE rollout to `internal_only` or `off`.
- Remove HE from switcher surfaces.
- Keep `/he/` redirect active.
- Remove HE sitemap/hreflang if already deployed.
- Purge Cloudflare cache.

## Stage 30 Live Page-Gated Deployment

Stage30 status: **GO for page-gated HE on READY pages only**.

This is not a global HE launch. The live rollout remains:

- `mode: "partial_public"`
- `pageGated: true`
- `stage25SqlApplied: true`
- `allowPartialPagesPublic: false`
- HE SEO/sitemap/hreflang/canonical/indexing: off
- public `/he/` routes: off
- Shop HE and Blog HE public: off

Live monitoring results:

| Scope | Live result |
| --- | --- |
| READY: transport, hotels, hotel detail, recommendations | Public `?lang=he` activates HE/RTL and shows HE in the switcher. |
| PARTIAL: home, car, trips, trip, POI/map | Public `?lang=he` is blocked and normalizes to EN/LTR. |
| BLOCKED: blog, blog detail, plan and other unfinished flows | Public `?lang=he` is blocked and HE is hidden from the switcher. |
| EXCLUDED: shop, partners, admin | HE remains unavailable; Shop checkout/payment stay EN/LTR. |
| `/he/` and `/he/transport.html` | Safe redirect/fallback to `/?lang=en`; no broken `/he/js/...` assets. |
| SEO safety | No HE URLs in sitemap; no HE hreflang/canonical/OpenGraph on checked pages. |

Stage30 rollback:

1. Set `he.mode` to `beta_users` or `internal_only`.
2. Keep `allowPartialPagesPublic:false`.
3. Keep HE SEO/sitemap/hreflang/canonical/indexing off.
4. Keep `/he/` redirect active.
5. Purge Cloudflare cache if stale config is observed.
6. Re-smoke READY and blocked/excluded pages.

## Stage 31 Monitoring And Expansion Decision

Stage31 status: **monitoring OK, expansion should wait for PARTIAL-safe content
completion and link cleanup**.

Production monitoring confirmed:

- READY pages remain stable in HE/RTL: Transport, Hotels, Hotel detail,
  Recommendations.
- HE -> EN -> PL switching works on all READY pages.
- Cross-navigation from READY HE pages to Shop, Blog, Plan, Car and Home safely
  returns to LTR and hides HE from the switcher.
- Shop, Blog, Plan, Partners and Admin remain blocked/excluded for public HE.
- `/he/` routes remain redirected/fallbacked to `/?lang=en`.
- SEO HE remains off; sitemap/hreflang/canonical/OpenGraph do not expose HE.
- Referral capture and recommendations click/view tracking are not broken by
  page-gated HE.

Expansion decision:

1. Keep current page-gated public scope unchanged.
2. Do not enable `allowPartialPagesPublic` yet.
3. Prepare the next expansion around PARTIAL-safe pages only after content and
   link behavior are tightened:
   - Home
   - Cars
   - Trips
   - Trip detail
   - POI/map
4. Keep Blog as a separate stage because public HE blog content and read policy
   are still not ready.
5. Keep Shop excluded because checkout/payment copy and dynamic Shop content are
   not ready.

Recommended Stage 32:

**Stage 32C / 32A hybrid: PARTIAL-safe dynamic content completion plus
navigation/link cleanup for Home, Cars, Trips, Trip detail and POI/map.**

Exit criteria before making any PARTIAL page public:

- Visible dynamic records in scope have HE or explicitly accepted EN fallback.
- HE links to blocked/excluded pages are stripped or rewritten to safe EN/LTR
  destinations.
- Page-gated Playwright tests cover each newly approved page.
- SEO HE remains off until the later SEO phase.

## Stage 32 PARTIAL Expansion Preparation

Stage32 status: **link cleanup implemented, PARTIAL pages not yet public**.

What changed:

- `buildLocalizedUrl()` is now the central URL builder for language-aware links.
- READY HE pages no longer need to carry `?lang=he` into BLOCKED, EXCLUDED or
  public-disabled PARTIAL destinations.
- Cart/Auth URL builders use the same central helper so Shop/Auth stay EN/LTR
  while excluded or blocked.

PARTIAL page decision after Stage32:

| Page/module | Decision | Reason |
| --- | --- | --- |
| Home | Keep PARTIAL | It aggregates incomplete modules and links into blocked/excluded flows. |
| Cars | Candidate after content review | Car names can remain as models, but user-facing features/options/descriptions need review. |
| Trips | Keep PARTIAL | Only 3 of 12 trips are HE-ready; listing needs more HE or record gating. |
| Trip detail | Candidate for translated records only | Needs per-record gating for the 3 translated trips before public exposure. |
| POI/map | Keep PARTIAL | Top 10 POI are ready, but the full map still has heavy EN fallback. |

Recommended Stage 33:

**Stage 33B: complete/curate dynamic content and record gating for PARTIAL-safe
pages before enabling public HE on any additional page.**

## Stage 33 Dynamic Content And Record Gates

Stage33 status: **prepared for next expansion; not public yet**.

Prepared runtime gates:

- Trips listing and home trip preview can filter to HE-ready trip records.
- Trip detail can block HE for an unready slug and normalize back to EN/LTR.
- Car fleet can filter to HE-ready records with localized features.
- POI/map source data can expose only HE-ready POI while retaining the full
  `PLACES_DATA_ALL` source for PL/EN.

Prepared manual SQL:

- `supabase/manual/he_partial_pages_stage33.sql`
- `supabase/manual/he_partial_pages_stage33_verify.sql`

Stage33 launch decision:

| Module | Status after code prep | Data dependency | Public action |
| --- | --- | --- | --- |
| Car | CANDIDATE READY | Stage33 top 5 cars committed + reviewed. | Do not expose until Stage34 apply/verify and smoke. |
| Trips | RECORD-GATED READY | Stage33 top 3 trips committed + reviewed. | Expose only if listing is record-gated. |
| Trip detail | RECORD-GATED READY | Loaded slug must pass trip record readiness. | Expose only translated records. |
| Home | PARTIAL | Needs section-level decision for Blog/Shop previews. | Keep hidden until UI curation. |
| POI/map | RECORD-GATED READY | Stage33 top 10 POI committed + reviewed. | Expose only limited HE-ready POI set. |

Recommended Stage 34:

**Stage 34A: manually apply Stage33 SQL, run verify, then smoke-test
record-gated HE for car/trips/trip/POI before changing public readiness.**

Stage33.5 correction before Stage34:

- The first Stage33 verify script failed because the car model label
  `COALESCE` mixed JSONB (`car_model` / `car_type`) and text fallback values.
- The verify script now converts every car label candidate to text before
  `COALESCE`, so it can run against schemas where car labels are JSONB i18n
  payloads.
- Do not treat Stage33 as verified until the repaired verify script passes in
  Supabase after the Stage33 content pack is manually committed.

Stage34 apply sequence:

1. Run `supabase/manual/he_partial_pages_stage33.sql` unchanged to preview with
   `ROLLBACK`.
2. Human-review all Hebrew values in the previewed content.
3. Replace the final `ROLLBACK` with `COMMIT` only after review.
4. Run `supabase/manual/he_partial_pages_stage33_verify.sql`.
5. Continue only if trips show `3/3`, cars `5/5`, and POI `10/10` HE-ready.

Stage34 rollout decision:

- Current status is **Stage33 applied + verified for data only**.
- Do not change `allowPartialPagesPublic`, page readiness, switcher exposure or
  SEO surfaces during Stage34.
- Stage35 read-only verification confirmed trips `3/3`, cars `5/5` and POI
  `10/10` are HE-ready in the selected record-gated scope.
- The next stage may consider a controlled record-gated rollout for Car, Trips,
  Trip detail and POI/map.
- Home remains PARTIAL until Blog and Shop previews are curated.
- Blog remains BLOCKED; Shop/cart/checkout/payment remain EXCLUDED.

## Stage 35 Record-Gated Expansion Decision

Stage35 result: **GO to plan Etap 36A, no rollout activated yet**.

What is ready for a controlled record-gated expansion:

- `car.html`: top 5 cars can be shown in HE if runtime keeps filtering to
  HE-ready records.
- `trips.html`: only the 3 HE-ready trips can be shown in HE.
- `trip.html`: only the 3 selected trip records can render in HE; unready slugs
  must normalize back to EN/LTR.
- POI/map flow: only the 10 HE-ready POI can be shown in HE unless a reviewed
  fallback policy is explicitly approved.

What remains out of scope:

- Home remains PARTIAL until Blog/Shop previews and aggregated sections are
  curated.
- Blog remains BLOCKED until public HE read, content, routing and SEO gates are
  solved in a separate stage.
- Shop remains EXCLUDED until product/cart/checkout/payment HE is fully tested.
- HE SEO, sitemap, hreflang, canonical, indexing and public `/he/` routes remain
  off until the final SEO phase.

## Recommended Launch Strategy

Do not launch full-site HE in one step from the current state.

Recommended path:

1. Complete static P0/P1 for all public pages.
2. Complete dynamic content for Transport, Hotels, selected Trips/Cars, Blog
   top posts and Recommendations.
3. Launch HE switcher only on pages that pass content and RTL gates.
4. Keep Shop out until fully translated, or explicitly choose a non-full-site
   phased launch.
5. Enable HE SEO only after the visible HE pages are content-complete.

For a true "full site" launch, Shop must be completed before the global switcher
is exposed everywhere.
