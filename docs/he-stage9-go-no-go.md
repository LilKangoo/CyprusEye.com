# HE Stage 9 GO / NO-GO Report

Status: NO-GO for public HE activation. GO for controlled beta preparation after migration 179 is applied and verified.

HE remains hidden from the public switcher, selectors, sitemap, hreflang, canonical metadata, public SEO, indexing and `/he/` routes.

## Controlled Rollout Architecture

Ready:

- Browser/runtime language gate lives in `js/i18n.js` and exposes `window.CELanguageRollout`.
- Server/build language gate lives in `functions/_utils/languageRollout.js`.
- `js/seo.js` reads the runtime guard before emitting SEO alternates.
- `functions/_utils/sitemap.js` reads the server guard before generating dynamic sitemap languages.
- Current HE mode is `internal_only`; every public surface is off.

Supported launch modes:

- `internal_only`
- `beta_users`
- `partial_public`
- `full_public`

## Module Readiness

| Module | Status | Notes |
| --- | --- | --- |
| Static `he.json` | BLOCKED | 1503 missing keys and 936 same-as-EN keys still need translation/review. |
| Runtime fallback | READY | HE fallback chain remains HE -> EN -> PL -> first available. |
| Public switcher/selector | READY hidden | HE is not exposed publicly. |
| SEO runtime | READY hidden | Guard keeps HE out of public SEO surfaces. |
| Sitemap | READY hidden | Guard keeps HE out of sitemap language sources. |
| Blog posts | PARTIAL | Migration 179 is prepared to allow `lang='he'` while keeping public reads PL/EN-only. Must be applied and verified. |
| Trips | PARTIAL | JSON/localized fields support HE where wired; top content still needs manual translation/review. |
| Hotels | PARTIAL | JSON/localized fields support HE where wired; room/rate/amenity coverage needs content QA. |
| Recommendations | PARTIAL | Schema/admin support exists; active content requires manual HE review. |
| POI | PARTIAL | `*_i18n.he` and category `name_he` are ready; active POI content requires translation/review. |
| Shop | PARTIAL | HE columns and admin fields exist; active product/category/shipping/email copy requires translation/review. |
| Transport | PARTIAL | `transport_locations.name_he` exists; all active route/location labels need review. |
| Email templates | PARTIAL | Shop email templates have HE fields; broader notification/email inventory still needs review. |
| Public API exposure | PARTIAL | App/server guards hide HE. Direct Supabase public-readable `*_he` columns remain a governance risk unless column grants/views are refactored. Blog translation rows are protected by migration 179. |

## P0 Blockers Before Public Launch

- Apply and verify `supabase/migrations/179_blog_translations_he_internal_guard.sql` or `supabase/manual/manual_he_rollout_179_blog_translations.sql`.
- Finish/review P0 static keys: critical UI, booking flows, auth, checkout/shop, errors/validation.
- Review same-as-EN HE keys that are public-facing.
- Translate top dynamic content for blog, trips, hotels, recommendations, POI, shop, transport and email templates.
- Decide final HE URL strategy: current architecture favors `?lang=he`; `/he/` is a separate routing project.
- Prepare HE SEO metadata for launch pages before any indexing.

## Edge QA Focus For Beta

- Long Hebrew strings in buttons, cards, chips and badges.
- Mixed Hebrew/English text with numbers, dates and EUR prices.
- Mobile sticky headers, drawers and nested modals.
- Car rental popup and validation flow.
- Transport step flow and route dropdowns.
- Shop product modal, cart, checkout and shipping labels.
- Blog content with images, lists, quotes and related CTA cards.
- Map overlays and recommendation cards.

## Rollback Readiness

Rollback should be config-first:

- Return HE mode to `internal_only`.
- Hide switcher/selector options.
- Disable HE SEO/sitemap/hreflang/canonical/indexing.
- Purge Cloudflare cache for HTML, JS, translation JSON and sitemap.
- Keep HE content in the database; do not delete translations as a rollback mechanism.

## Decision

Proceed to Etap 10 only as controlled beta rollout preparation after migration 179 is applied and the hidden HE smoke tests pass on staging. Do not proceed to full public HE until content and SEO blockers are closed.
