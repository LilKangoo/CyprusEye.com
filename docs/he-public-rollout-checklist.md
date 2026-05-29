# HE Public Rollout Checklist

Status: HE is internal/hidden. Do not expose HE in the public switcher, selectors, sitemap, hreflang, canonical metadata, public SEO, indexing, or `/he/` routes until every launch gate below is explicitly passed.

## Static Translation Gates

- [ ] `npm run i18n:audit` reports `0` missing critical HE keys for P0 groups.
- [ ] `translations/he-readiness-report.json` has no P0 `missing` blockers.
- [ ] P0 `needs_human_review` keys are reviewed by a Hebrew speaker.
- [ ] Placeholders, HTML tags and `{{variables}}` are preserved.
- [ ] No public HE page depends on PL fallback before launch.
- [ ] Long marketing copy is not published if it is only machine translated.

## Dynamic Content Readiness

| Module | HE storage | Schema ready | Editing ready | Public fallback | Manual work before public launch |
| --- | --- | --- | --- | --- | --- |
| Blog posts | `blog_post_translations.lang = 'he'` for title, slug, summary, lead, content, meta; `blog_posts.categories_he`, `blog_posts.tags_he` for taxonomy | Partial in repo: taxonomy HE exists; verify remote allows `lang = 'he'` on `blog_post_translations` before launch | Admin/partner forms expose internal HE fields | Frontend fallback should remain HE -> EN -> PL | Translate top posts, slugs, titles, summaries, lead, content, meta, OG alt text, categories and tags; verify save/reload on staging |
| Trips | Existing localized JSON fields such as title/description/meta where supported by admin | Mostly JSON-based; verify every displayed trip field accepts `he` | Admin i18n component supports HE where fields are JSON-based | Central fallback helper | Translate top trip titles, descriptions, booking labels, meta descriptions, itinerary/location snippets |
| Hotels | Existing localized JSON fields such as title/description/meta/room type copy where supported | Mostly JSON-based; verify amenities and room/rate plan copy are HE-capable | Admin i18n component supports HE where fields are JSON-based | Central fallback helper | Translate top hotels, room types, rate plan names, cancellation/deposit notes, meta descriptions and amenities |
| Car offer display fields | `cars.description_i18n` / existing localized car offer fields where present | Requires schema check per active car table/view | Admin has HE-aware i18n extraction for localized descriptions where supported | Central fallback helper | Translate car model descriptions, feature labels that are data-driven, pickup/return display labels |
| Recommendations | `recommendations.title_he`, `description_he`, `discount_text_he`, `offer_text_he`; categories `name_he` | Ready from existing recommendations schema plus Stage 3 fields | Admin recommendation form supports HE | Central fallback helper | Translate active recommendations, categories, badges, offer/discount text and CTA-facing labels |
| POI | `pois.name_i18n.he`, `description_i18n.he`, `badge_i18n.he`; `poi_categories.name_he` | Ready from migration 178 | Admin POI i18n form supports HE | Central fallback helper | Translate POI names, descriptions, badges and category names; verify map overlays and card truncation |
| Shop products/categories | `shop_products.*_he`, `shop_categories.*_he`, `shop_vendors.*_he`, variants and supporting shop tables from migration 178 | Ready after migration 178 | Admin shop forms support HE for products, categories, vendors, discounts, shipping and email templates | Central fallback helper | Translate active products, short/long descriptions, variants, categories, vendors, shipping classes/methods, discounts and customer-facing meta |
| Transport location names | `transport_locations.name_he` | Ready after migration 178 | Admin transport/location editor supports HE where exposed | Central fallback helper | Translate all active pickup/drop-off names; verify dropdown width, sorting and booking summary |
| Email templates | `shop_email_templates.subject_he`, `body_html_he`; other notification/email templates need schema-specific check | Shop email templates ready; non-shop templates require inventory before public HE email launch | Admin shop template editor supports HE fields | Runtime fallback must remain EN before PL | Translate customer-facing subjects and bodies; verify RTL email rendering and links |
| Partner-facing onboarding/content | Partner blog HE fields, categories/tags HE, partner previews | Blog taxonomy ready; blog translation constraint must be verified | Partner panel exposes internal HE fields and copy-from-EN flow | Internal preview only until launch | Translate partner onboarding/help copy, partner blog content and partner-owned public content before exposure |

## Hidden HE QA Gates

- [ ] `?ce_he_preview=1&lang=he` renders hidden HE/RTL on desktop without horizontal overflow.
- [ ] `?ce_he_preview=1&lang=he` renders hidden HE/RTL on mobile widths without broken sticky headers, modals or drawers.
- [ ] `?lang=he` alone is ignored publicly.
- [ ] PL and EN smoke tests pass after HE content is present.
- [ ] Admin save/reload HE passes for blog, recommendations, POI, shop, transport and email templates.
- [ ] Partner panel save/reload HE passes for partner blog, categories/tags, copy from EN and optional clear.

## SEO Preparation Gates

- [ ] Decide final URL model before indexing: current architecture favors `?lang=he`; `/he/` requires a separate routing/canonical project.
- [ ] Add HE `hreflang` only after critical HE content and metadata are reviewed.
- [ ] Keep canonical pointing to the correct language URL only after HE is public.
- [ ] Do not index HE pages with missing critical content; keep them hidden or noindex until content is ready.
- [ ] Prepare HE meta title/description for homepage, blog list/detail, trips, hotels, cars, shop, recommendations and transport.
- [ ] Regenerate sitemap only after the public HE switch is approved.

## Final Public Activation Steps

- [ ] Flip public language registry/switcher to include HE.
- [ ] Enable public RTL rendering outside hidden preview.
- [ ] Add HE sitemap entries.
- [ ] Add HE hreflang entries.
- [ ] Add HE canonical behavior.
- [ ] Run `npm run i18n:audit`.
- [ ] Run `npm run i18n:test`.
- [ ] Run `npm run seo:audit`.
- [ ] Run `npm run build`.
- [ ] Run Playwright smoke for PL, EN and public HE desktop/mobile.

## Controlled Launch Architecture

Central guard files:

- Browser/runtime guard: `js/i18n.js` exposes `window.CELanguageRollout`.
- Server/build guard: `functions/_utils/languageRollout.js`.
- SEO runtime reads the browser guard in `js/seo.js`.
- Sitemap generation reads the server guard in `functions/_utils/sitemap.js`.

Current HE state:

- `mode`: `internal_only`
- `switcher`: off
- `seo`: off
- `sitemap`: off
- `hreflang`: off
- `canonical`: off
- `routes`: off
- `publicApi`: off in guarded app/server flows
- `indexing`: off
- hidden preview remains limited to `?ce_he_preview=1&lang=he`

Supported rollout modes for the final launch path:

- `internal_only`: staff/dev preview only; no public exposure.
- `beta_users`: allowlisted user/session path only; no SEO/sitemap/indexing.
- `partial_public`: selected public surfaces only, for example switcher without indexing.
- `full_public`: switcher, routes, SEO, sitemap, hreflang, canonical and indexing enabled together after QA.

Direct Supabase table access note: RLS can hide rows, but it does not hide individual columns on public-readable tables. The Stage 9 blog migration keeps `blog_post_translations.lang = 'he'` out of public reads. Other `*_he` columns in public-readable tables should not contain confidential pre-launch copy unless a later column-grant/view strategy is approved.

## Pre-Launch Phase

- [ ] Apply migration/manual SQL `179_blog_translations_he_internal_guard`.
- [ ] Confirm `blog_post_translations_lang_check` allows `pl`, `en`, `he`.
- [ ] Confirm public blog translation reads still return only `pl/en`.
- [ ] Confirm hidden HE preview works on homepage, blog, cars, transport, shop and recommendations.
- [ ] Confirm public `?lang=he` does not activate HE.
- [ ] Complete P0 static translation review.
- [ ] Complete top dynamic content review.
- [ ] Run PL/EN smoke tests after final HE content import.

## Soft Launch Phase

- [ ] Keep HE unavailable in sitemap/hreflang/canonical/indexing.
- [ ] Enable only an internal or beta route gate.
- [ ] Verify fallback HE -> EN -> PL on live data.
- [ ] Confirm no blank cards, undefined labels or broken CTA buttons.
- [ ] Confirm Cloudflare/browser caches do not serve stale language registries.
- [ ] Keep rollback as a config-only change where possible.

## Beta Launch Phase

- [ ] Enable `beta_users` mode only for approved accounts/sessions.
- [ ] Keep public switcher hidden unless beta UX explicitly requires it.
- [ ] Keep HE `noindex` / no sitemap / no hreflang during beta.
- [ ] Monitor console errors, 404s, booking submissions and checkout errors.
- [ ] Check analytics segmentation for `lang=he` preview/beta traffic.
- [ ] Verify admin/partner save/reload does not overwrite PL/EN.

## Production Launch Phase

- [ ] Move HE to public switcher only after GO approval.
- [ ] Enable public RTL outside hidden preview.
- [ ] Enable HE route handling.
- [ ] Enable HE SEO metadata.
- [ ] Enable HE hreflang.
- [ ] Enable HE sitemap entries.
- [ ] Enable canonical behavior for the chosen URL model.
- [ ] Purge Cloudflare cache after deployment.
- [ ] Re-run SEO audit against production URLs.

## Rollback Steps

- [ ] Return HE rollout mode to `internal_only`.
- [ ] Remove HE from public switcher/selector registry.
- [ ] Disable HE sitemap/hreflang/canonical/indexing.
- [ ] Purge Cloudflare cache for HTML, `js/i18n.js`, `js/seo.js`, sitemap and translation JSON.
- [ ] Keep HE content in the database; do not delete translated data during rollback.
- [ ] Re-run public PL/EN smoke tests.

## Rollback Conditions

- [ ] Any checkout/cart calculation regression.
- [ ] Booking flow submission failure.
- [ ] Public HE pages indexing with missing/incorrect content.
- [ ] Widespread 404/canonical/hreflang errors.
- [ ] Broken mobile navigation or blocking modal overflow.
- [ ] PL/EN regression in public critical paths.

## Post-Launch Smoke Tests

- [ ] Homepage desktop/mobile HE.
- [ ] Blog list/detail HE.
- [ ] Trips listing/detail HE.
- [ ] Hotels listing/detail HE.
- [ ] Car rental finder and popup HE.
- [ ] Transport route/summary/validation HE.
- [ ] Shop product/cart/checkout HE.
- [ ] Recommendations/map overlays HE.
- [ ] Auth/account/profile HE.
- [ ] Admin/partner internal save/reload still works.

## Monitoring And Analytics

- [ ] Track `lang=he` page views separately.
- [ ] Track booking/cart/checkout conversion by language.
- [ ] Track JS errors by language and route.
- [ ] Track 404s and failed dynamic slugs.
- [ ] Track Supabase/API errors involving HE fields.
- [ ] Review Core Web Vitals and layout shifts on mobile HE.

## Cloudflare And Cache Sequence

- [ ] Deploy code with HE still hidden.
- [ ] Apply database migration and content updates.
- [ ] Run smoke tests against non-cached/staging URL.
- [ ] Enable chosen rollout mode.
- [ ] Purge Cloudflare cache for HTML, JS, translation JSON, sitemap and edge functions.
- [ ] Verify production response headers and no stale sitemap.
- [ ] Keep rollback cache purge command ready.

## Current Stage 9 Decision

HE remains hidden. Controlled beta rollout can be prepared after migration 179 is applied and verified, but public enablement should wait until P0 static keys, top dynamic content and SEO metadata are reviewed.

## Stage 10 Beta Preparation Notes

- Browser beta config is documented in `docs/he-stage10-beta-rollout.md`.
- Server/build rollout config can read `CE_LANGUAGE_ROLLOUT_CONFIG` or `CE_HE_ROLLOUT_MODE`, but defaults keep HE `internal_only`.
- Beta mode may expose HE only for authenticated/allowlisted beta users or local/internal developer preview.
- During beta, keep `seo`, `sitemap`, `hreflang`, `canonical`, and `indexing` false.
- Full public mode remains blocked until P0 translations, dynamic content, save/reload QA and SEO metadata are complete.
