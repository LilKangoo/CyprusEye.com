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
