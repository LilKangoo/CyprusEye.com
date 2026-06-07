# HE Public Launch Roadmap

Generated: 2026-05-31

This roadmap prepares the full Hebrew launch but does not activate public HE,
sitemap, hreflang, canonical metadata, SEO indexing, public `/he/` routes, or
Shop checkout in Hebrew.

## Current Stable Production State

Final live commit: `92c7c73` (`Fix Hebrew trip SEO canonical guard`).
This is the locked partial HE production state after the visual cleanup
(`6000d46`) and the two final SEO guard hotfixes (`51dd163`, `92c7c73`).

- HE UI live: Home, transport, hotels, hotel, recommendations, car, trips,
  trip, and POI/map flow.
- HE SEO live: Stage 49 allowed scope only, currently 19 HE URLs in
  `sitemap.xml`.
- Blog UI and blog detail routes are `record-gated`: the blog shell can switch
  to HE, while post content remains manual and only explicitly
  `public_ready` HE rows may render in HE.
- Blog SEO remains blocked and Blog is absent from HE sitemap/canonical/hreflang.
- Shop, cart, checkout, payment, partners, and admin remain `EXCLUDED`.
- Public `/he/` routes remain non-public redirects/fallbacks to `/?lang=en`.
- Booking/payment/deposit flow is locked and must not be changed by HE launch
  work.
- `translations/manual-review/*` remains excluded from the public build.

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

## Stage 36 Controlled Record-Gated Rollout

Stage36 expands page-gated HE only to verified record-gated pages. It does not
activate Home, Blog, Shop, SEO, sitemap, hreflang, canonical, indexing or public
`/he/` routes.

Enabled by config:

- `stage33SqlApplied:true`
- `recordGatedPagesPublic:true`
- `allowPartialPagesPublic:false`

Pages now eligible for public HE:

- Existing READY: Transport, Hotels, Hotel detail, Recommendations.
- Record-gated: Car, Trips, Trip detail for ready records, POI/map filtered to
  ready records.

Pages still blocked/excluded:

- Home remains PARTIAL.
- Blog and Blog post remain BLOCKED.
- Shop/cart/checkout/payment remain EXCLUDED.
- Plan, Community, Account/Auth, Legal, Partners/Admin and unknown pages remain
  blocked or excluded.

Stage36 rollback:

1. Set `recordGatedPagesPublic:false`.
2. Keep `allowPartialPagesPublic:false`.
3. Redeploy and purge Cloudflare cache if live pages retain stale config.
4. If READY pages are also affected, return mode to `beta_users` or
   `internal_only`.

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

## Stage 37 Record-Gated Deployment And Monitoring

Stage37 scope: deploy and monitor the already prepared record-gated HE expansion
for Car, Trips, Trip detail and POI/map. This is still not a global HE launch.

Local verification on 2026-06-02:

- `scripts/verify-he-stage33-data.js`: passed against Supabase.
- Stage33 selected records: Trips `3/3`, Cars `5/5`, POI `10/10`.
- `npm run i18n:audit`: passed.
- `npm run i18n:he-readiness`: passed.
- `npm run i18n:test`: passed.
- `npm run seo:audit`: passed with 0 items requiring review.
- `npm run build`: passed and generated `dist/`.
- `npm test`: passed, including deposit and transport notification reliability
  tests.
- Playwright `he-hidden-rollout.spec.ts`: `20/20` passed.

Production verification on 2026-06-02:

- Production `js/he-beta-rollout-config.js` serves
  `recordGatedPagesPublic:true`, `stage33SqlApplied:true` and
  `allowPartialPagesPublic:false`.
- Existing READY pages are live HE/RTL and keep HE in the switcher.
- Record-gated Car, Trips and HE-ready Trip detail are live HE/RTL.
- Unready Trip detail with `?lang=he` normalizes to EN/LTR.
- Home, Blog, Shop, Plan, Partners/Admin and `/he/` remain blocked or
  excluded.
- Cross-navigation from HE pages sends Shop, Blog, Plan and Home links to
  EN/LTR while retaining HE for approved record-gated or READY destinations.
- Sitemap, hreflang, canonical, OpenGraph and indexing still expose no HE.

Follow-up fix before redeploy:

- Live monitoring found that `trips.html?lang=he` was RTL and record-filtered
  but still displayed EN trip titles because `languageSwitcher.js`
  `getCurrentLanguage()` did not honor page-gated public HE. The helper now
  checks the central rollout guard, and local smoke confirms the three Stage33
  trip cards render Hebrew titles.

Record-gated pages now monitored in production:

- `car.html?lang=he`
- `trips.html?lang=he`
- `trip.html?slug=<HE-ready-trip>&lang=he`
- `trip.html?slug=<not-ready-trip>&lang=he`
- POI/map flow with HE-ready POI

Current constraints after deploy:

- Existing READY pages remain public HE: Transport, Hotels, Hotel detail,
  Recommendations.
- Record-gated pages expose HE only for verified records.
- Home remains PARTIAL and public HE stays blocked.
- Blog remains BLOCKED.
- Shop/cart/checkout/payment remain EXCLUDED and EN/LTR.
- HE SEO, sitemap, hreflang, canonical, indexing and public `/he/` remain off.

Booking/payment safety:

- Stage37 does not modify transport deposits, partner fulfillment, Stripe
  webhook handling or booking/payment status transitions.
- Regression coverage is limited to existing automated tests unless a separate
  P0 booking task is opened.

Rollback:

1. Set `recordGatedPagesPublic:false`.
2. Keep `allowPartialPagesPublic:false`.
3. Keep existing READY pages active unless live monitoring shows a shared
   regression.
4. Purge Cloudflare cache after redeploy if the old config remains cached.

## Stage 38 Home Aggregation Preparation

Stage38 prepares Home for a future page-gated expansion but does **not** expose
Home HE publicly.

Current Home status:

- `home`: still `PARTIAL`
- `allowPartialPagesPublic:false`
- Blog remains `BLOCKED`
- Shop/cart/checkout/payment remain `EXCLUDED`
- HE SEO/sitemap/hreflang/canonical/indexing remain off

Implemented preparation:

1. Home uses a dedicated aggregation guard for future/test HE rendering.
2. Blog preview and blocked shortcut cards are hidden when Home is explicitly
   rendered in HE.
3. Links to READY or record-gated pages keep `lang=he`; links to Blog, Shop,
   Plan, Community, Packing, Tasks and Legal normalize to EN/LTR.
4. Mobile nav and Home map fallback redirects now use the central
   `buildLocalizedUrl(...)` helper.
5. Transport booking/deposit/payment code is not changed.

Home can move from `PARTIAL` to `CANDIDATE READY` only after live/local smoke
confirms:

- no visible Blog/Shop HE fragments,
- car/trips/POI aggregates show only record-gated content,
- blocked/excluded links normalize to EN/LTR,
- mobile RTL has no overflow,
- booking/payment regression tests still pass.

Recommended next stage:

**Stage 39A: deploy and live-monitor Home HE only if the Stage38 smoke remains
clean.** If any section shows mixed or broken content, keep Home PARTIAL and fix
that section first.

## Stage 39 Controlled Home Deployment

Stage39 moves Home from prepared-only to a controlled page-gated rollout while
keeping all global launch surfaces off.

Config posture:

- Home is allowed by `pageReadiness.home.status:"ready"` only.
- `allowPartialPagesPublic:false` remains in force.
- Existing READY pages remain public HE: Transport, Hotels, Hotel detail and
  Recommendations.
- Existing record-gated pages remain public HE only for verified records: Car,
  Trips, Trip detail and POI/map.
- Blog, Blog post, Plan, Community, account/auth, legal and unknown pages remain
  BLOCKED.
- Shop/cart/checkout/payment, Partners and Admin remain EXCLUDED.
- HE sitemap, hreflang, canonical, OpenGraph, indexing and public `/he/` routes
  remain off.

Home launch rules:

1. Show only HE-ready or record-gated modules.
2. Hide Blog preview until Blog public HE read/routing/SEO are solved.
3. Hide or normalize Shop and checkout-related links to EN/LTR.
4. Normalize Plan, Community, Packing, Tasks and Legal links to EN/LTR.
5. Keep booking/payment/deposit code untouched; Home transport remains covered
   only by regression tests.

Rollback:

1. Remove the Home readiness override or set Home back to `partial`.
2. Keep `recordGatedPagesPublic:true` unless record-gated pages regress.
3. Keep Blog/Shop blocked or excluded.
4. Purge Cloudflare cache after deploy if stale Home config persists.

Next strategic blocker after Home:

- Blog HE public readiness is the next large blocker for moving toward a wider
  public HE experience.
- Shop HE should remain a separate decision because checkout/payment copy and
  dynamic product data require dedicated QA.

## Stage 40 Blog HE Readiness Plan

Decision: **keep Blog and Blog detail BLOCKED** until public read, content
quality and record-gated runtime are explicitly completed.

Current architecture:

- `blog_post_translations.lang = 'he'` is allowed internally after migration
  179.
- Public RLS still hides HE translations and exposes only PL/EN translations.
- Cloudflare Blog routes normalize language through the server rollout guard,
  which currently does not include page-level Blog HE readiness.
- Blog list/detail code still has PL/EN taxonomy and URL assumptions.
- Blog SEO helpers generate PL/EN canonical and hreflang only. This is correct
  while SEO HE remains off.

Recommended public-read strategy:

1. Add a review gate on `blog_post_translations`, preferably
   `review_status IN ('draft', 'needs_review', 'reviewed', 'public_ready')`.
2. Keep PL/EN public reads unchanged.
3. Allow public HE reads only when:
   - parent post is `status='published'`;
   - parent `submission_status='approved'`;
   - `published_at <= now()`;
   - translation `lang='he'`;
   - translation `review_status='public_ready'`;
   - slug, title, meta title, meta description, summary, lead and content HTML
     are non-empty.
4. Do not expose fallback-heavy HE blog pages. If a post is not public-ready,
   it should not appear in the HE list and direct `?lang=he` should normalize to
   EN/LTR.

Prepared files:

- `supabase/manual/he_blog_stage40_readiness_verify.sql` - read-only readiness
  and policy audit.
- `supabase/manual/he_blog_stage41_public_read_draft.sql` - draft migration
  with `ROLLBACK`; do not commit until Stage41 approval.

Recommended Stage41:

**Apply Blog HE review/public-read gate only after the Stage40 verify output
confirms the top five rows are complete and reviewed, then test Blog list/detail
record-gating without enabling HE SEO.**

## Stage 41 Blog Record-Gated Preparation

Decision: **Blog stays BLOCKED after Stage41**. This stage prepares the
mechanism needed for a later Blog rollout, but it does not expose Blog HE
through the public switcher, sitemap, hreflang, canonical, OpenGraph, indexing
or public `/he/` routes.

Completed preparation:

- Added a non-destructive manual apply script:
  `supabase/manual/he_blog_stage41_public_read_apply.sql`.
- Reworked the draft SQL so it uses `ALTER POLICY` / `CREATE POLICY if missing`
  and does not use `DROP POLICY` or `DROP CONSTRAINT`.
- Added `supabase/manual/he_blog_stage41_public_read_verify.sql` for
  post-apply checks.
- Prepared server and browser Blog list/detail code to use strict
  `review_status='public_ready'` HE record-gating.
- Prepared Blog CTA normalization so Shop and non-ready Blog destinations do
  not carry HE.

Manual SQL sequence for the next stage:

1. Run `he_blog_stage40_readiness_verify.sql` and confirm the top five rows are
   complete.
2. Run `he_blog_stage41_public_read_draft.sql` as a ROLLBACK preview.
3. After editorial approval, run
   `he_blog_stage41_public_read_apply.sql` manually.
4. Run `he_blog_stage41_public_read_verify.sql`.
5. Proceed only if `public_ready_he_rows = 5`, duplicate HE slugs return zero
   rows and CTA risks are accepted.

Next recommended stage: **Stage42A - apply Blog HE public-read SQL + record-gated
Blog smoke**. If the top five content rows are not human-reviewed, use
**Stage42B - complete/review top five Blog HE content** instead.

## Stage 42 Blog Human Review + Public-Ready Marking

Decision: **Blog remains BLOCKED until manual public-ready marking is verified**.

Observed pre-apply state:

- Stage41 draft preview reported `public_ready_he_rows = 0`.
- This confirms the public-read mechanism can exist without exposing any HE
  blog rows until specific translations are marked `public_ready`.

Prepared Stage42 files:

- `supabase/manual/he_blog_stage42_mark_top5_public_ready_draft.sql`
- `supabase/manual/he_blog_stage42_mark_top5_public_ready_apply.sql`
- `supabase/manual/he_blog_stage42_public_ready_verify.sql`

Completion gate before Blog rollout:

1. Top five posts have complete HE title, slug, meta title, meta description,
   summary, lead, content, `categories_he` and `tags_he`.
2. Human/native editorial review approves those five posts.
3. Stage42 apply marks exactly those complete HE rows `public_ready`.
4. Stage42 verify reports `public_ready_he_rows = 5`.
5. Blog list/detail smoke confirms only public-ready HE posts render.
6. SEO HE, sitemap, hreflang, canonical, OpenGraph and indexing remain off.

Rollback if Stage42 creates issues:

- Set the top-five HE translations back to `review_status='reviewed'` or
  `needs_review`.
- Keep `blog` and `blogPost` as `blocked` in the page readiness registry.
- Leave Home/READY/record-gated non-Blog pages unchanged.

## Stage 43 HE Completion System

Decision: **finish system/workflow first; do not publish unreviewed long
content**.

Static translation state after Stage43:

- Missing HE keys: 216.
- Same-as-EN keys: 547.
- Completed short UI labels for Shop basics, Dashboard and partner form fields.
- Remaining missing groups:
  - `advertise`: 160 long/public partner copy keys.
  - `seo`: 53 hidden meta keys; keep for SEO stage.
  - `shop`: 3 long/page-title keys; Shop remains excluded.

Manual content workflow:

- New guide: `docs/he-manual-translation-admin-guide.md`.
- Blog HE content must be entered and reviewed manually.
- Codex must not mark Blog translations `public_ready` without explicit human
  review confirmation.
- Dynamic content modules should use admin UI where available; SQL imports are
  reserved for narrow reviewed fields and verify scripts.

Recommended next public-HE path:

1. Keep existing Home/READY/record-gated pages live.
2. Manually translate/review selected Blog posts.
3. Apply Stage41/Stage42 SQL only after review.
4. Run record-gated Blog smoke.
5. Defer Shop and HE SEO to separate stages.

## Stage 44 Static Translation Gate

Decision: **GO for tri-lingual static UI structure; NO-GO for global HE, Blog,
Shop or SEO activation**.

Stage44 adds a required launch gate:

1. Run `npm run i18n:tri-audit`.
2. Confirm `PL keys missing EN = 0`.
3. Confirm placeholder and HTML tag mismatches are `0`.
4. Confirm remaining HE gaps are documented review groups, not accidental UI
   omissions.
5. Keep Blog `BLOCKED`, Shop `EXCLUDED` and SEO HE `OFF` until their dedicated
   stages pass.

Current Stage44 results:

- PL keys missing EN: `0`.
- PL/EN keys missing HE: `216`.
- Placeholder mismatches: `0`.
- HTML tag mismatches: `0`.
- Remaining HE groups: `advertise.*`, `seo.*`, long Shop copy.

Public launch implication:

- Page-gated HE can continue on already approved pages.
- Static UI no longer blocks EN fallback integrity.
- Full public HE still requires manual Blog/dynamic content review, Shop
  decision and SEO HE planning.

## Stage 45 Manual Translation Operations Gate

Decision: **GO for manual review workflow; NO-GO for automatic content
publication**.

Operational workflow:

1. Run `npm run i18n:tri-audit`.
2. Run `npm run i18n:review-export`.
3. Translate/review packs in `translations/manual-review/`.
4. Run `npm run i18n:review-import -- --input=<pack>` as dry-run.
5. Apply only reviewed static JSON keys with explicit `--apply`.
6. Use admin UI or reviewed SQL for dynamic/database content.
7. Mark Blog rows `public_ready` only with explicit human approval and Stage42
   SQL/verify.

Current Stage45 pack counts:

- Static UI: `801`.
- Advertise: `235`.
- SEO: `122`.
- Shop: `96`.
- Email/payment templates: `506`.
- Same-as-EN HE: `690`.
- Dynamic content: `237`.
- Blog: `21`.

Launch impact:

- Blog remains `BLOCKED`.
- Shop remains `EXCLUDED`.
- SEO HE remains `OFF`.
- Global HE remains off.
- Public `/he/` routes remain disabled.
- Existing page-gated HE pages are unchanged.

## Stage 46 Shop Decision And Checkout Safety

Decision: **do not include Shop in the current public HE rollout**.

Recommended path:

1. Keep Shop **EXCLUDED** for the first public HE launch.
2. Allow only EN/LTR fallback when a user manually lands on Shop with
   `?lang=he`.
3. Treat full Shop HE as a later dedicated stage after manual translation and
   payment QA.

Current guards:

- `shopEnabled:false`
- page readiness `shop: excluded`
- `shop.html` uses `data-disable-hidden-language="true"`
- Shop links generated through `buildLocalizedUrl(...)` normalize to EN/LTR
- Blog CTA links to Shop normalize to EN/LTR
- cart/checkout/payment remain outside RTL/HE

Manual review requirements before any future Shop HE:

- 96 static Shop records reviewed.
- 3 Shop email/payment/order records reviewed.
- 18 dynamic Shop product/category/vendor/shipping records reviewed.
- Stripe sandbox checkout success/cancel/failure smoke.
- Cart, checkout, shipping, discount, order and notification copy approved.

SEO note:

Shop exclusion does not block SEO preparation for already approved HE pages, but
Shop must not enter sitemap, hreflang, canonical, indexing or public `/he/`
routes until a separate Shop HE launch is approved.

## Stage 47 HE SEO Preparation

Status: **SEO HE remains OFF**.

Reference: `docs/he-seo-rollout-plan.md`.

Prepared architecture:

- `functions/_utils/heSeoReadiness.js` defines a central HE SEO readiness guard.
- `npm run seo:he-guard` verifies that HE does not enter sitemap, hreflang,
  canonical, OpenGraph or SEO output while rollout flags are off.
- SEO activation requires explicit page readiness, record readiness when
  applicable and explicit surface flags.

SEO candidate-ready:

- Home
- `transport.html`
- `hotels.html`
- `hotel.html` for HE-ready hotel records only
- `recommendations.html`
- `car.html` under record-gated safety
- `trips.html` under record-gated safety
- `trip.html` for HE-ready trip records only

SEO blocked:

- Blog and `/blog/*`
- `plan.html`
- community/account/auth/legal/notFound/unknown

SEO excluded:

- Shop/cart/checkout/payment
- partners
- admin

Recommended first HE SEO URL model is `?lang=he`. Public `/he/` routes remain
disabled and redirected until a separate routing migration is approved.

## Stage 48 Controlled HE SEO Activation

Status: **GO for SEO HE on ready pages only**.

Reference: `docs/he-seo-rollout-plan.md`.

Activated HE SEO scope:

- Home: `/?lang=he`
- Transport: `/transport.html?lang=he`
- Hotels: `/hotels.html?lang=he`
- Hotel detail: `/hotel.html?slug=<HE-ready-hotel>&lang=he`
- Recommendations: `/recommendations.html?lang=he`
- Car record-gated collection: `/car.html?lang=he`
- Trips record-gated collection: `/trips.html?lang=he`
- Trip detail: `/trip.html?slug=<HE-ready-trip>&lang=he`

Still excluded from HE SEO:

- Blog and `/blog/*`
- Shop, cart, checkout and payment
- Plan, community, account/auth, legal, 404/unknown
- Partners and admin
- not-ready hotel/trip records
- fallback-only EN pages

URL model remains `?lang=he`. Public `/he/` routes stay disabled and redirected.
Global HE remains off; this stage does not change public Blog or Shop status.

Rollback:

1. Set `CE_HE_SEO_ENABLED=false`, or disable all HE SEO flags through
   `CE_HE_SEO_ROLLOUT_CONFIG`.
2. Purge Cloudflare cache.
3. Re-run `npm run seo:he-guard`, `npm run seo:audit` and the HE page-gated
   Playwright smoke.

## Stage 49 Live SEO HE Deploy

Decision target: **GO only if live sitemap/meta match the ready-page scope**.

Live SEO HE scope stays limited to:

- Home,
- transport,
- hotels and HE-ready hotel details,
- recommendations,
- car,
- trips and HE-ready trip details.

Stage49 does not expand:

- global HE,
- Blog HE public read,
- Shop/cart/checkout/payment HE,
- public `/he/` routes,
- Plan/Community/Account/Auth/Legal/404,
- partners/admin.

Initial live monitoring found and fixed two SEO/rendering regressions before
final GO:

1. allowed HE pages were rendered by the server with `dir="ltr"`;
2. blocked Blog detail could leak an HE sibling slug/title into canonical and
   OpenGraph metadata.

The fix is code-only and does not alter content, Supabase data, Blog
`public_ready`, Shop, booking/payment or Stripe webhook behavior.

Final live result: **Stage49 GO**.

- Production sitemap contains 19 HE URLs and no forbidden Blog/Shop/checkout,
  admin/partner, plan/community/legal or `/he/` URLs.
- Allowed HE pages return `lang="he"` and `dir="rtl"` with HE canonical,
  hreflang and OpenGraph URL.
- Blog, Blog detail, Shop, Plan, Partners and Admin return EN/LTR or safe
  blocked output with no HE SEO.
- `/he/`, `/he/transport.html` and `/he/shop.html` redirect to `/?lang=en`.
- Production SEO audit reports 0 errors and 0 warnings.

## Stage 50 Final Partial Launch Lock

Decision: **current production HE scope is stable and locked**.

Current public HE UI scope:

- Home
- transport
- hotels
- HE-ready hotel detail
- recommendations
- car
- trips
- HE-ready trip detail
- POI/map flow

Current HE SEO scope:

- the Stage49 sitemap URLs only

Still blocked:

- Blog and Blog detail
- Plan
- Community
- account/auth/legal/404/unknown

Still excluded:

- Shop/cart/checkout/payment
- partners/admin

Next work should be manual content workflow, not accidental rollout expansion:

1. Use review packs and admin guide for Blog/dynamic content.
2. Mark Blog `public_ready` only after human review and SQL verify.
3. Keep Shop excluded until a separate Shop HE stage passes checkout/payment QA.
4. Keep `/he/` routing as a future dedicated migration.

Monitoring checklist: `docs/he-production-monitoring-checklist.md`.
Blog checklist: `docs/he-blog-manual-public-ready-checklist.md`.
Shop checklist: `docs/he-shop-future-rollout-checklist.md`.

## Final Cleanup Before Documentation Commit

Scope: **safe UI/i18n cleanup only**.

Locked behavior:

- Stable HE public UI scope remains Home, transport, hotels, hotel,
  recommendations, car, trips, trip and POI/map.
- Stable HE SEO scope remains the Stage49 allowed sitemap URLs only.
- Blog dynamic content remains manual and blocked until specific rows are
  reviewed and marked `public_ready`.
- Shop/cart/checkout/payment remain excluded from HE and HE SEO.
- Public `/he/` routes remain disabled.
- Booking/payment/deposit and Stripe webhook logic remain out of scope.

Cleanup requirements before final documentation commit:

1. Keep PL/EN/HE UI keys structurally aligned.
2. Enforce `HE -> EN -> PL -> first available` fallback in UI helpers.
3. Keep first-visit language selection PL/EN/HE.
4. Keep partner `Copy HE` referral links gated by page/record readiness.
5. Keep review packs current for manual Blog/Shop/SEO/email/dynamic content
   translation.
