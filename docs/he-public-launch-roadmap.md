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

Tasks:

1. Fill remaining P0 missing keys:
   - 2 booking/coupon recommendation SEO keys.
   - 23 Shop keys, or explicitly mark Shop out of launch.
2. Fill P1 public content keys:
   - `plan`: 145 missing keys.
   - `community`: 45 missing keys.
   - `blogUi`: 23 missing keys.
   - `home`: 16 missing keys.
   - `sos`: 18 missing keys.
   - `tasks`: 20 missing keys.
   - `map` and `recommendations`: 14 combined missing keys.
3. Fill P1 SEO keys:
   - 53 missing `seo.*` keys.
4. Triage 682 same-as-EN keys:
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
   - Complete remaining 5 records and all categories.
6. Hotels:
   - Records are ready, but hotel amenity dictionary has 0% HE. Add schema or
     dictionary values for amenity names.
7. Transport:
   - Dynamic route/location data is ready; keep regression tests.
8. Shop:
   - Complete product/category/vendor/shipping/discount/attribute content before
     full-site launch.

Exit criteria:

- No public HE page presents blank cards, undefined labels or PL-first fallback.
- Top public paths have reviewed HE dynamic records.
- Admin/manual SQL path exists for every remaining content gap.

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
