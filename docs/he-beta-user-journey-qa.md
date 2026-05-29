# HE Beta User Journey QA

Generated: 2026-05-29

HE remains internal/beta-only. This QA plan does not enable public HE, the
public language switcher, sitemap, hreflang, canonical metadata, SEO, indexing,
or public `/he/` routes.

## Runtime Mode

- Hidden preview URL: `?ce_he_preview=1&lang=he`
- Public `?lang=he`: must stay blocked unless beta allowlist/runtime config permits it.
- Public `/he/`: must redirect or fail safely without `/he/js/` or `/he/assets/` broken paths.
- Shop: excluded from first HE beta.

## Content State

| Area | Stage 16 status | Runtime note |
| --- | --- | --- |
| Blog | 5 HE beta drafts prepared in `supabase/manual/he_beta_content_pack_stage16.sql` | Pending SQL/Admin apply and human review |
| Transport | 9 HE location names prepared | Pending SQL apply and form smoke |
| POI | 10 HE names/descriptions/badges prepared | Pending SQL apply and map smoke |
| Recommendations | 5 HE cards prepared | Pending SQL apply and map/recommendation smoke |
| Trips | 3 HE title/description drafts prepared | Pending SQL apply and booking smoke |
| Hotels | 2 HE title/description drafts prepared | Pending SQL apply and booking smoke |
| Cars | 5 HE feature sets prepared | Pending SQL apply; model names already fallback-safe |
| Shop | Excluded | Do not run paid HE checkout beta |

All Stage 16 content is marked `needs human review`. Nothing in this document
marks the content as public-launch reviewed.

## Journey Checklist

Run after the Stage 16 content pack is reviewed and applied on staging/beta.

| Step | URL / action | Expected result |
| ---: | --- | --- |
| 1 | Open `/?ce_he_preview=1&lang=he` | `html[lang="he"][dir="rtl"]`, no HE public selector, no horizontal overflow |
| 2 | Home navigation | Header, nav pills, CTAs and cards stay RTL-safe; no `undefined` labels |
| 3 | Open map/recommendations | Map loads, selected POI/recommendation cards show HE for scoped records |
| 4 | Open selected POI | `name_i18n.he`, `description_i18n.he`, `badge_i18n.he` visible for scoped POI |
| 5 | Open selected recommendation | `title_he`, `description_he`, category HE and offer/discount HE visible |
| 6 | Open selected trip | HE title/description render; booking labels come from static P0 keys |
| 7 | Open selected hotel | HE title/description render; amenities may still fallback unless translated separately |
| 8 | Open selected car | HE feature labels render; car model remains brand/model name |
| 9 | Booking form | Required labels, validation and summaries are RTL-safe and not blank |
| 10 | Summary/deposit path | No Shop checkout; no public HE SEO/indexing surfaces |

## Checks To Actively Fail On

- HE preview falls back directly to PL while EN exists.
- Blank dynamic cards or `undefined` / `null` labels.
- Horizontal overflow on mobile.
- Reversed or hidden close buttons in modals.
- Dropdowns or map overlays opening outside viewport.
- Shop appears as a Hebrew customer checkout experience.
- HE appears in public switcher, sitemap, hreflang, canonical metadata, SEO or `/he/`.

## Current QA Result

Before applying the Stage 16 content pack, hidden HE smoke can validate RTL and
fallback behavior only. Full content QA is pending staging application of:

- `supabase/manual/he_beta_content_pack_stage16.sql`

Automated hidden HE smoke on the current codebase:

| Check | Result |
| --- | --- |
| Public `?lang=he` remains blocked | Passed |
| Hidden `?ce_he_preview=1&lang=he` renders RTL on desktop routes | Passed |
| Hidden HE mobile preview has no horizontal overflow | Passed |
| PL/EN public languages remain stable | Passed |
| `/he/` does not load as broken SPA route | Passed |
| Car page does not request legacy root `/app.js` | Passed |
| Beta allowlist mode can expose HE without SEO surfaces | Passed |

Expected invite-only beta readiness after content pack apply and human review:

| Area | Expected selected-record readiness |
| --- | ---: |
| Blog | 5 / 5 |
| Transport locations | 9 / 9 |
| POI | 10 / 10 |
| Recommendations | 5 / 5 |
| Trips | 3 / 3 |
| Hotels | 2 / 2 |
| Cars | 5 / 5 feature-label coverage |
| Shop | Excluded |
