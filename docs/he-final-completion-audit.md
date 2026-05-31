# HE Final Completion Audit

Generated: 2026-05-31

This audit is a finish-plan input only. It does not enable public Hebrew,
public switchers, `/he/` routes, sitemap entries, hreflang, canonical metadata,
SEO indexing, or Shop checkout in Hebrew.

## Current Rollout State

- Runtime guard exists in `js/i18n.js` through `window.CELanguageRollout`.
- Live beta config currently sets HE to `mode: "beta_users"` in
  `js/he-beta-rollout-config.js`.
- `hiddenPreview` is false.
- SEO, sitemap, hreflang, canonical and indexing are false for HE.
- `/he`, `/he/` and `/he/*` are redirected to `/?lang=en` in `_redirects`.
- `shop.html` has `data-disable-hidden-language="true"` and keeps active
  language at EN/LTR, but an allowlisted beta user can still see the HE option
  in the switcher surface. This is not acceptable for final consistency.

## Where HE Currently Appears

Runtime smoke against live-ready code showed:

| Surface | Beta/allowlisted `?lang=he` | Non-beta `?lang=he` | Notes |
| --- | --- | --- | --- |
| Home | HE/RTL | EN/LTR | Home recheck passed; first full sweep had a navigation timeout. |
| Blog list | HE/RTL | EN/LTR | UI shell works; dynamic content is not globally ready. |
| Blog detail | HE/RTL | EN/LTR | URL preserves `?lang=he`; content still needs full HE rows. |
| Trips | HE/RTL | EN/LTR | Only 3 of 12 trip records complete. |
| Trip detail | HE/RTL | EN/LTR | Selected beta trip can render HE; not all trips are ready. |
| Hotels | HE/RTL | EN/LTR | 2 of 2 hotel records complete; amenities dictionary still falls back. |
| Hotel detail | HE/RTL | EN/LTR | Runtime shell works; amenities still need HE. |
| Car rental | HE/RTL | EN/LTR | Dynamic car data is partial. |
| Transport | HE/RTL | EN/LTR | Dynamic route/location labels are ready. |
| Recommendations | HE/RTL | EN/LTR | Only selected recommendations/POI are ready. |
| Shop | EN/LTR, HE option visible | EN/LTR | Shop HE active language is blocked, but switcher consistency is not final. |
| Plan | EN/LTR | EN/LTR | No HE rollout config; 39 page keys missing. |
| Partners public | EN/LTR | EN/LTR | No HE rollout config. |
| Auth | EN/LTR | EN/LTR | No HE rollout config; SEO keys missing. |
| Account | EN/LTR redirect to auth when anonymous | EN/LTR | Needs logged-in flow QA before public HE. |
| Terms | EN/LTR | EN/LTR | No HE rollout config; SEO/legal keys missing. |
| 404 | HE/RTL for beta | EN/LTR | 404 can become HE through fallback shell; needs final copy review. |
| Community | EN/LTR | EN/LTR | No HE rollout config; dynamic/community keys missing. |
| Attractions | EN/LTR | EN/LTR | No HE rollout config; several values still same as EN. |
| Packing | EN/LTR | EN/LTR | No HE rollout config; live smoke saw a `car-rental.js` MIME error unrelated to HE. |
| VIP | EN/LTR | EN/LTR | No HE rollout config. |

## Page Readiness Matrix

| Page / flow | Static translations | Dynamic content | RTL | SEO | Switcher | Status | Blockers |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `index.html` | 0 launch-critical public UI keys missing; same-as-EN review remains in content/tool roots | Mixed modules: Trips 25%, Hotels 100%, Cars 54.2%, Transport 100%, POI 7.2%, Recommendations 63.6%, Shop 0% | Smoke OK | HE off | Beta-only now | PARTIAL | Home aggregates incomplete dynamic modules. |
| `blog.html` | 0 public shell keys missing; small same-as-EN review remains | Blog: 21 posts, 0 full HE, 5 partial, 16 fallback | Smoke OK | HE off | Beta-only now | NEEDS CONTENT | Blog archive is not a Hebrew content experience yet. |
| `blog-post.html` / `/blog/*` | 0 public shell keys missing; small same-as-EN review remains | HE rows need verification/completion for all launch posts | Smoke OK | HE off | Beta-only now | NEEDS CONTENT | Full post translation rows and taxonomy required. |
| `trips.html` | 0 launch-critical public UI keys missing | 12 trips: 3 complete, 9 fallback | Smoke OK | HE off, trip SEO keys missing | Beta-only now | PARTIAL | 9 trip records still fallback. |
| `trip.html` | 0 launch-critical public UI keys missing | Selected 3 trips ready; not all trips | Smoke OK | HE off | Beta-only now | PARTIAL | Detail is safe only for translated records. |
| `hotels.html` | 0 launch-critical public UI keys missing | 2 hotels: 2 complete | Smoke OK | HE off, hotel SEO keys missing | Beta-only now | READY TECH / PARTIAL SEO | Hotel amenities dictionary is 0% HE. |
| `hotel.html` | 0 launch-critical public UI keys missing | Hotel records complete; amenities fallback | Smoke OK | HE off | Beta-only now | READY TECH / PARTIAL CONTENT | Amenity labels need HE schema/content. |
| `car.html` | 0 launch-critical public UI keys missing; car naming/features need review | 27 cars: all partial, 54.2% field readiness | Smoke OK | HE off | Beta-only now | PARTIAL | Car types/features/descriptions need review. |
| `transport.html` | 0 launch-critical public UI keys missing | 44 routes complete, locations 100% | Smoke OK | HE off, transport SEO keys missing | Beta-only now | READY TECH / PARTIAL SEO | HE SEO remains disabled until launch. |
| `recommendations.html` / map flow | 0 launch-critical public UI keys missing | 10 recommendations: 5 complete, 3 partial, 2 fallback; POI 10/139 complete | Smoke OK | HE off | Beta-only now | PARTIAL | Most POI and categories still fallback. |
| `shop.html` | 23 Shop static keys still missing by design | Shop aggregate 0% HE | HE intentionally blocked | HE off | HE option still visible for beta | SHOULD STAY HIDDEN | Paid checkout/content risk. |
| `plan.html` | 0 launch-critical public UI keys missing after Stage 24 | Plan data depends on recommendations/trips/cars | Not enabled | HE off | No HE config | SHOULD STAY HIDDEN | Needs rollout config and RTL smoke before inclusion. |
| `partners.html` | 214 advertise/partner-facing keys still missing | Partner-facing business copy mostly internal | Not enabled | Not prepared | No HE config | SHOULD STAY HIDDEN | Public partner/advertise copy needs separate HE pass. |
| `auth/index.html` | 0 launch-critical auth keys missing; minor account/profile same-as-EN review | Account/auth static only | Not enabled | HE off | No HE config | PARTIAL / HIDDEN | Add config only after auth RTL QA. |
| `account/index.html` | 0 launch-critical account keys missing; profile same-as-EN review remains | Requires authenticated profile QA | Not enabled | HE off | No switcher | SHOULD STAY HIDDEN | Logged-in account flow not fully audited. |
| `terms.html` | 0 legal shell keys missing after Stage 24 | Static legal content | Not enabled | HE off, legal SEO missing | No HE config | PARTIAL / HIDDEN | Legal copy needs human review. |
| `404.html` | 0 404 keys missing after Stage 24 | Static | Smoke OK in beta | HE off | Beta shell can show HE | PARTIAL | Final switcher/page gating still required. |
| `community.html` | 0 community UI keys missing after Stage 24; 1 same-as-EN key remains | POI/community data mostly fallback | Not enabled | HE off | No HE config | SHOULD STAY HIDDEN | POI/community content coverage remains low. |
| `attractions.html` | 0 public shell keys missing; same-as-EN review remains | POI-driven | Not enabled | HE off | No HE config | SHOULD STAY HIDDEN | Uses POI/category content that is not globally ready. |
| `packing.html` | 0 missing; 75 packing values still same-as-EN | Static/tool data | Not enabled | HE off | No HE config | PARTIAL / HIDDEN | Same-as-EN review plus live MIME error. |
| `vip.html` | 0 missing; 73 VIP values still same-as-EN | Static | Not enabled | HE off | No HE config | PARTIAL / HIDDEN | Needs translation review and RTL smoke before inclusion. |
| `tasks.html` | 0 task UI keys missing after Stage 24 | Gamification/referral dynamic | Not enabled | HE off | No HE config | SHOULD STAY HIDDEN | Needs rollout config and RTL smoke before inclusion. |
| `kupon.html` | 0 coupon keys missing after Stage 24; 4 same-as-EN keys remain | Coupon/static hybrid | Not enabled | HE off | No HE config | PARTIAL / HIDDEN | Coupon terms need human review. |
| `deposit.html` | No page i18n keys in scan | Payment/support flow | Not enabled | Not prepared | No switcher | SHOULD STAY HIDDEN | Needs separate payment-flow HE audit. |
| `trip-date-selection.html` | No page i18n keys in scan | Date selection flow | Not enabled | Not prepared | No switcher | SHOULD STAY HIDDEN | Needs standalone flow audit. |

## Static Translation Status

Source: `translations/audit-he-vs-en.json` and `docs/he-translation-readiness.md`.

| Metric | Count |
| --- | ---: |
| EN keys | 2815 |
| HE keys | 2739 |
| Missing HE keys | 317 |
| Extra HE keys needing triage | 241 |
| HE keys identical to EN | 553 |
| Raw static key presence | 97.3% |
| Review-adjusted static readiness | 77.7% |

Missing keys by rollout group:

| Group | Priority | Missing |
| --- | --- | ---: |
| Critical UI / navigation | P0 | 0 |
| Errors / validation | P0 | 0 |
| Booking flows | P0 | 0 |
| Auth | P0 | 0 |
| Checkout / Shop | P0 | 23 |
| Partner panel / advertise | P1/P2 | 214 |
| Blog / public content shell | P1 | 0 |
| SEO / static meta | P1 before public launch | 53 |
| Admin / dashboard | P2 | 27 |

Launch blockers:

- P0 Shop static keys are still missing because Shop remains outside HE launch
  until dynamic checkout content is ready.
- P1 public content shell missing keys were closed in Stage 24, but same-as-EN
  values still need review.
- HE SEO/static meta has 53 missing keys and must stay off.
- 553 same-as-EN keys need triage; many are legitimate names/brands, but many
  are still unreviewed English fallback.

## Dynamic Content Status

Source: `docs/he-dynamic-content-readiness.md`, generated from read-only
Supabase anon queries.

| Module | Records | HE complete | HE partial | EN fallback-only | Readiness |
| --- | ---: | ---: | ---: | ---: | ---: |
| Trips | 12 | 3 | 0 | 9 | 25.0% |
| Hotels | 2 | 2 | 0 | 0 | 100.0% |
| Cars | 27 | 0 | 27 | 0 | 54.2% |
| Transport | 44 | 44 | 0 | 0 | 100.0% |
| Blog | 21 | 0 | 5 | 16 | 7.7% |
| POI | 139 | 10 | 0 | 129 | 7.2% |
| Recommendations | 10 | 5 | 3 | 2 | 63.6% |
| Shop | 30 | 0 | 0 | 30 | 0.0% |

Support dictionaries:

| Dictionary | Records | HE complete | EN fallback-only | Readiness |
| --- | ---: | ---: | ---: | ---: |
| Transport locations | 9 | 9 | 0 | 100.0% |
| Hotel amenities dictionary | 48 | 0 | 48 | 0.0% |
| POI categories | 23 | 6 | 17 | 26.1% |
| Recommendation categories | 15 | 10 | 5 | 66.7% |

Email templates are not publicly readable through anon API. Schema support
exists for `shop_email_templates.subject_he`, `shop_email_templates.body_html_he`
and `email_template_versions.content.he`, but final counts require an admin SQL
or service-role audit.

## Shop Decision

Recommendation for final full-site launch: **C) launch full public HE only after
Shop HE is complete**.

Why:

- Shop dynamic readiness is 0%.
- Paid checkout has product, shipping, discount, vendor, attribute, order and
  email copy that must not be mixed accidentally.
- Current guard prevents active HE in Shop, but beta users can still see an HE
  option on Shop. That must be fixed before any global switcher.
- EN fallback in checkout is acceptable only as a deliberate phased-launch
  decision, not as a silent global HE launch.

Acceptable phased alternative:

- Launch HE on ready content pages first and explicitly hide Shop from HE nav,
  force Shop to EN/LTR, and document Shop as outside HE. This is not a full-site
  HE launch.

## Main Technical Gaps

- HE rollout config is not loaded consistently on all public pages.
- Switcher behavior is page-inconsistent: beta pages can show HE, hidden pages
  do not, and Shop blocks active HE while still exposing a beta HE option.
- Page readiness is not centrally modeled. The system knows language rollout
  status, but it does not yet have a final page/module readiness gate.
- Several pages still rely on local or legacy switcher surfaces rather than one
  final language source.
- SEO is intentionally disabled and not ready for HE.
- `/he/` routes are intentionally redirected; public route strategy is not
  implemented.

## Overall Status

| Area | Estimated readiness | Notes |
| --- | ---: | --- |
| Technical HE foundation | 75% | Fallback, RTL foundation and rollout guard exist; page consistency is missing. |
| Static translations raw presence | 97.3% | 317 missing of 2815 EN keys. |
| Static translations review-adjusted | 77.7% | Same-as-EN keys still need triage. |
| Dynamic content global readiness | ~44.7% | Unweighted average across audited modules. |
| Public switcher readiness | 40% | Central guard exists, final page gating and consistency do not. |
| SEO HE readiness | 20% | PL/EN SEO is healthy, but HE meta/hreflang/sitemap are intentionally off. |
| Full public launch readiness | 55% | Static public UI improved; dynamic content, Shop and SEO still block full launch. |

## Audit Verdict

Do not move to a global public HE switcher yet.

The safest direction is to finish static P0/P1, complete dynamic content in the
high-traffic public modules, then enable HE per ready surface or only after all
public surfaces pass final QA. Shop should block a true full-site public launch
until its product and checkout content is reviewed.
