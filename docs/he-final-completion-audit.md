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
- Stage 26 adds a central page readiness registry in `js/i18n.js`; HE surfaces
  now require both rollout permission and page readiness permission.
- `shop.html` has `data-disable-hidden-language="true"` and is also marked
  `excluded` in the page registry, so active HE and HE switcher exposure are
  blocked for Shop/checkout/payment.

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
| Shop | EN/LTR, HE option blocked by page registry | EN/LTR | Shop HE active language and switcher exposure are blocked. |
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
| `shop.html` | 23 Shop static keys still missing by design | Shop aggregate 0% HE | HE intentionally blocked | HE off | Page registry excludes HE | SHOULD STAY HIDDEN | Paid checkout/content risk. |
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
- Stage 26 centrally models page readiness, but public HE is still disabled and
  the registry must be verified on live/staging before page-gated launch.
- Switcher behavior now has a central page gate; final public exposure still
  requires choosing which `partial` pages can use EN fallback.
- Several pages still rely on local or legacy switcher surfaces rather than one
  final language source.
- SEO is intentionally disabled and not ready for HE.
- `/he/` routes are intentionally redirected; public route strategy is not
  implemented.

## Stage 26 Page-Gated Registry Snapshot

| Registry status | Pages / flows | Runtime decision |
| --- | --- | --- |
| READY | `transport` | HE may be shown after rollout enables the page-gated switcher; SEO still off. |
| PARTIAL | `home`, `car`, `trips`, `trip`, `poiMap`; `hotels`, `hotel`, `recommendations` until Stage25 SQL | HE may be allowed only with safe EN fallback; SEO remains blocked. |
| BLOCKED | `blog`, `blogPost`, `plan`, `community`, `accountAuth`, `legal`, `notFound`, unknown pages | HE hidden; `?lang=he` normalizes to EN/LTR. |
| EXCLUDED | `shop`, `partners`, `admin` | HE always blocked. |

Stage25 dependency:

- `hotels`, `hotel` and `recommendations` become ready only after
  `supabase/manual/he_public_ready_dynamic_stage25.sql` is applied and verified.
- Until then, they remain `partial` and must not be treated as globally ready.

## Stage 28 Stage25 SQL Status

Stage25 SQL result: **applied manually and verified for the page-gated scope**.

Reviewed files:

- `supabase/manual/he_public_ready_dynamic_stage25.sql`
- `supabase/manual/he_public_ready_dynamic_stage25_verify.sql`

Safety findings:

- The apply SQL is additive/idempotent for the intended scope.
- It adds only `hotel_amenities.name_he` if missing.
- It updates HE-only fields/dictionaries and uses existing HE values when they
  are already present.
- It does not overwrite PL/EN source content.
- It does not activate public HE, global switcher HE, SEO HE, sitemap HE,
  hreflang HE, canonical HE, indexing HE or public `/he/` routes.

Verified dynamic audit after Stage25:

| Scope | Result |
| --- | ---: |
| Transport | 44/44 complete |
| Hotels | 2/2 complete |
| Hotel amenities dictionary | 48/48 complete |
| Recommendations | 10/10 complete |
| POI categories | 23/23 complete |
| Recommendation categories | 15/15 complete |

Readiness after verified Stage25 SQL and `stage25SqlApplied:true`:

| Status | Pages / flows |
| --- | --- |
| READY | `transport`, `hotels`, `hotel`, `recommendations` |
| PARTIAL-safe | `home`, `car`, `trips`, `trip`, `poiMap` |
| BLOCKED | `blog`, `blogPost`, `plan`, `community`, `accountAuth`, `legal`, `notFound`, unknown |
| EXCLUDED | `shop`, `partners`, `admin` |

## Stage 29 Controlled Page-Gated Public HE

Stage29 runtime status: **controlled page-gated HE for READY pages only**.

Public HE is allowed only where the page registry status is `ready`:

- `transport.html`
- `hotels.html`
- `hotel.html`
- `recommendations.html`

The runtime config uses:

- `mode: "partial_public"`
- `pageGated: true`
- `stage25SqlApplied: true`
- `allowPartialPagesPublic: false`
- HE SEO/sitemap/hreflang/canonical/indexing: `false`

Partial-safe pages are intentionally not public HE yet:

- `home`
- `car`
- `trips`
- `trip`
- `poiMap`

Blocked/excluded pages remain protected:

- Blog and Blog detail remain blocked until HE blog public read/RLS and top post
  content are intentionally opened.
- Shop remains excluded; checkout/cart/payment must stay EN/LTR.
- Partners and Admin remain excluded from public HE.

## Stage 30 Live Monitoring Result

Stage30 live status: **GO for controlled page-gated HE on READY pages only**.

Live production checks confirmed:

| Area | Result |
| --- | --- |
| Deploy/config | Production serves `mode: "partial_public"`, `pageGated:true`, `stage25SqlApplied:true`, `allowPartialPagesPublic:false`. |
| READY pages | `transport.html`, `hotels.html`, `hotel.html`, `recommendations.html` activate HE/RTL and expose HE in the switcher. |
| PARTIAL pages | Home, car, trips and trip remain EN/LTR for public `?lang=he`; HE switcher hidden. |
| BLOCKED pages | Blog, blog detail and plan remain EN/LTR for public `?lang=he`; HE switcher hidden. |
| EXCLUDED pages | Shop, partners and admin do not expose public HE. |
| Shop | `shop.html?lang=he` remains EN/LTR; checkout/cart/payment are not HE/RTL. |
| Blog | Blog remains blocked until public HE blog content/read policy is intentionally opened. |
| `/he/` safety | `/he/` and `/he/transport.html` fall back to `/?lang=en` without broken `/he/js/...` assets. |
| SEO safety | Sitemap has no HE URLs; checked pages have no HE hreflang/canonical/OpenGraph URLs. |

Monitoring notes:

- Headless live smoke observed aborted Cloudflare RUM and Google Analytics
  requests; these are external telemetry aborts, not app crashes.
- `admin/?lang=he` redirects to the admin login surface and does not load the
  public rollout snapshot, which is acceptable for public HE exclusion.

## Stage 31 Live Stability Result

Stage31 live status: **current READY scope remains stable; no expansion yet**.

Verified live:

| Check | Result |
| --- | --- |
| READY pages | Transport, Hotels, Hotel detail and Recommendations render HE/RTL with HE in the switcher. |
| Dynamic content | HE content is visible on READY pages; no `undefined`/`null` text found in monitored pages. |
| Layout | No horizontal overflow found at desktop monitoring width. |
| Console/request health | No critical app console errors, broken Supabase calls or same-origin 4xx/5xx failures found in monitored READY pages. |
| Language switching | HE -> EN -> PL works on all READY pages. |
| Cross-navigation | READY HE -> Shop/Blog/Plan/Car/Home safely returns to LTR and hides HE. |
| Blocked/excluded pages | Shop, Blog, Blog detail, Plan, Partners and Admin remain unavailable for public HE. |
| SEO safety | Sitemap, hreflang, canonical, OpenGraph and indexing remain HE-off. |
| Tracking sanity | Referral `?ref=` capture works in HE Transport and persists to HE Recommendations; GA/GTM/Cloudflare telemetry requests are present; Recommendations tracking functions are available. |

Known issue to address before expansion:

- Stage32 has tightened READY-page navigation: `buildLocalizedUrl()` now checks
  destination readiness and rewrites HE links to public-disabled PARTIAL,
  BLOCKED or EXCLUDED pages back to `lang=en`.

Expansion verdict:

- Option A is directionally right, but not immediately: expand to PARTIAL-safe
  pages only after minimal dynamic HE content and link cleanup.
- Option B should remain a later separate Blog stage.
- Option C should remain separate and Shop should stay excluded from HE until
  checkout/payment has full content and QA.

## Stage 32 PARTIAL Page Audit

Stage32 does not activate additional public HE pages. It prepares the next
expansion by fixing language-aware link generation and documenting the remaining
content gaps.

| Page/module | Stage32 status | Main blocker | Recommended next action |
| --- | --- | --- | --- |
| Home | PARTIAL | Home mixes ready modules with Cars, Trips, POI/map and links to blocked/excluded pages. | Curate visible modules and keep HE hidden until incomplete sections are gated. |
| Cars | Candidate after review | All 27 car records are partial; feature/options/descriptions need HE review. | Review top cars and dynamic labels before page-gated exposure. |
| Trips | PARTIAL | 3 of 12 trips are complete; the listing would show heavy EN fallback. | Either translate more trips or gate the listing to translated records. |
| Trip detail | Candidate per record | Detail is safe only for translated trip records. | Add record-level readiness before exposing HE detail pages. |
| POI/map | PARTIAL | 10 of 139 POI have HE. | Limit HE map surfaces to reviewed/top POI or complete more POI content. |

Blog remains BLOCKED. Shop remains EXCLUDED. HE SEO, sitemap, hreflang,
canonical, indexing and public `/he/` routes remain off.

## Stage 33 Record-Gated PARTIAL Preparation

Stage33 prepares the remaining PARTIAL-safe pages for a future expansion without
changing their public rollout status.

| Surface | Result | Remaining blocker before public page-gated HE |
| --- | --- | --- |
| Car | CANDIDATE READY in code | Apply/verify Stage33 top 5 car HE fields and complete human review. |
| Trips listing | RECORD-GATED READY in code | Apply/verify Stage33 top 3 trips and expose only those records in HE. |
| Trip detail | RECORD-GATED READY in code | Direct HE works only for a loaded trip that passes record readiness. |
| Home | PARTIAL | Needs section curation: Blog preview hidden/fallback decision, Shop preview hidden/fallback decision, gated child modules only. |
| POI/map | RECORD-GATED READY in code | Apply/verify Stage33 top 10 POI and keep the map limited to HE-ready records. |

Prepared SQL:

- `supabase/manual/he_partial_pages_stage33.sql` ends with `ROLLBACK` and is safe
  to preview before manual review.
- `supabase/manual/he_partial_pages_stage33_verify.sql` checks the selected trip,
  car and POI records after a human-approved COMMIT.

No Blog public read/RLS, Shop checkout, SEO, sitemap, hreflang, canonical,
indexing or public `/he/` route changes are part of Stage33.

## Stage 34 Apply Gate

Stage34 is an apply/verify/smoke gate, not a public rollout.

Current status: **Stage33 manually applied and verified for the selected
record-level scope**.

Expected data readiness after a successful manual apply:

| Scope | Expected verified records | Gate after verify |
| --- | ---: | --- |
| Trips top records | 3 | Trip listing/detail may become record-gated candidates only for ready records. |
| Cars top records | 5 | Car page may become a candidate with HE-ready top cars and safe model-name fallback. |
| POI top records | 10 | POI/map may become a record-gated candidate limited to ready POI. |

Home remains PARTIAL. Blog remains BLOCKED. Shop remains EXCLUDED. HE SEO,
sitemap, hreflang, canonical, indexing and public `/he/` routes remain off.

## Stage 35 Record-Gated Audit Result

Stage35 adds a read-only runtime confirmation of the manually applied Stage33
data. The check performs no writes and does not activate new public HE surfaces.

Verification sources:

- Manual Supabase COMMIT and `he_partial_pages_stage33_verify.sql`.
- `scripts/verify-he-stage33-data.js`, which checks the exact Stage33 IDs via
  Supabase anon reads.

| Area | Verified ready records | Completion for selected scope |
| --- | ---: | ---: |
| Trips | 3 of 3 selected | 100% |
| Cars | 5 of 5 selected | 100% |
| POI/map | 10 of 10 selected | 100% |

Readiness proposal:

- Car: **RECORD-GATED READY candidate**, still not public without Etap 36
  approval.
- Trips: **RECORD-GATED READY candidate**, listing must filter to HE-ready
  records.
- Trip detail: **RECORD-GATED READY per record**, unready records must fall
  back to EN/LTR.
- POI/map: **RECORD-GATED READY candidate**, limited to the verified POI set.
- Home: **PARTIAL**, because Blog/Shop previews and aggregated sections remain
  unresolved.

Launch blockers unchanged: Blog remains BLOCKED, Shop remains EXCLUDED and HE
SEO/sitemap/hreflang/canonical/indexing/public `/he/` routes remain off.

## Stage 36 Record-Gated Rollout Status

Stage36 turns the verified Stage33 data into a controlled page-gated expansion
for record-gated pages only.

| Area | Stage36 status | Notes |
| --- | --- | --- |
| Car | RECORD-GATED READY | Public HE can render only the HE-ready filtered fleet. |
| Trips listing | RECORD-GATED READY | Public HE can render only the three HE-ready trips. |
| Trip detail | RECORD-GATED READY per record | Unready loaded records must fall back to EN/LTR. |
| POI/map | RECORD-GATED READY | Public HE data is limited to verified HE-ready POI. |
| Home | PARTIAL | Still blocked from public HE. |
| Blog | BLOCKED | Public HE read/routing/SEO remain unsolved. |
| Shop | EXCLUDED | Cart/checkout/payment remain EN/LTR. |
| SEO HE | OFF | Sitemap, hreflang, canonical, indexing and public `/he/` stay off. |

This improves page-gated readiness, but full public launch still requires Home,
Blog, Shop and final SEO work.

## Overall Status

| Area | Estimated readiness | Notes |
| --- | ---: | --- |
| Technical HE foundation | 75% | Fallback, RTL foundation and rollout guard exist; page consistency is missing. |
| Static translations raw presence | 97.3% | 317 missing of 2815 EN keys. |
| Static translations review-adjusted | 77.7% | Same-as-EN keys still need triage. |
| Dynamic content global readiness | ~44.7% | Unweighted average across audited modules. |
| Public switcher readiness | 65% | Central guard and page registry exist; page-gated rollout still needs live/staging QA. |
| SEO HE readiness | 20% | PL/EN SEO is healthy, but HE meta/hreflang/sitemap are intentionally off. |
| Full public launch readiness | 58% | Static public UI and page-gated guard improved; dynamic content, Shop and SEO still block full launch. |

## Audit Verdict

Do not move to a global public HE switcher yet.

The safest direction is to finish static P0/P1, complete dynamic content in the
high-traffic public modules, then enable HE per ready surface or only after all
public surfaces pass final QA. Shop should block a true full-site public launch
until its product and checkout content is reviewed.

## Stage 37 Record-Gated Readiness Check

Status on 2026-06-02: **record-gated scope is live verified, but still not a
global launch**.

Verified record-gated data:

| Scope | Ready records | Status |
| --- | ---: | --- |
| Trips top records | 3/3 | Ready for record-gated listing/detail. |
| Cars top records | 5/5 | Ready for record-gated car page with model-name fallback. |
| POI/map top records | 10/10 | Ready for filtered POI/map HE flow. |

Automated local checks passed:

- i18n audit/readiness/fallback tests.
- SEO audit with no HE sitemap, hreflang, canonical or OpenGraph exposure.
- Build.
- Jest, including booking deposit and transport notification reliability tests.
- Playwright HE rollout smoke for page-gated, record-gated, blocked/excluded
  and `/he/` safety.

Current launch posture:

- Technical HE foundation for approved pages: **GO for monitored page-gated
  expansion**.
- Full-site public HE: **NO-GO**.
- Home: PARTIAL.
- Blog: BLOCKED.
- Shop/cart/checkout/payment: EXCLUDED.
- SEO HE: OFF.

Live Stage37 checks confirmed that existing READY pages and record-gated pages
render HE/RTL, while Home, Blog, Shop, Plan, Partners/Admin and public `/he/`
routes remain blocked or excluded.

One live issue was fixed before redeploy: Trips had HE-ready records but card
titles rendered through a legacy helper that still returned EN. The helper now
uses the central rollout guard, and local smoke confirms Hebrew trip titles.

## Stage 38 Home Aggregation Audit

Status: **Home prepared, still PARTIAL**. No global HE, SEO HE, Blog HE, Shop HE
or public `/he/` route is enabled.

Home aggregation findings:

| Section | Static HE | Dynamic HE | Stage38 decision |
| --- | --- | --- | --- |
| Header / language switcher | Strong public UI coverage | N/A | Home stays PARTIAL, so public HE switcher remains hidden on Home. |
| Navigation / mobile nav | Strong public UI coverage | N/A | Links are normalized through central page readiness; blocked links go EN/LTR. |
| Transport preview/form | Ready | Transport locations/routes ready | Visible candidate; booking/payment flow unchanged. |
| Hotels preview | Ready | Hotels/amenities ready after Stage25 | Visible candidate. |
| Recommendations preview | Ready | Active recommendations ready after Stage25 | Visible candidate. |
| Cars preview | Ready with some EN fallback | Stage33 top 5 record-gated | Visible only through record-gated content. |
| Trips preview | Ready with some EN fallback | Stage33 top 3 record-gated | Visible only through record-gated content. |
| POI/map | Ready shell | Stage33 top 10 record-gated | Visible only through HE-ready POI/map gating. |
| Blog preview | Static shell translated | Blog public HE blocked | Hidden on HE Home. |
| Shop/cart/checkout | Static shell partial, dynamic 0% | Shop excluded | Excluded; links normalize to EN/LTR. |
| Plan/community/packing/tasks shortcuts | Static shell mostly translated | Separate pages not HE-gated | Hidden or EN/LTR until separately prepared. |
| Footer/legal | Static shell translated | Legal copy not reviewed | Legal link normalizes to EN/LTR. |

Home remains `PARTIAL` because it still depends on section-level UX decisions
for Blog, Shop and blocked utility pages. The new guard makes future/test Home
HE safer, but does not by itself make Home public-ready.

## Stage 39 Home Status Update

Status: **controlled page-gated Home rollout ready for deploy**.

Home is promoted through runtime config only:

- Base registry still describes Home as an aggregator.
- `js/he-beta-rollout-config.js` adds a page-specific
  `pageReadiness.home.status:"ready"` override.
- `allowPartialPagesPublic:false` remains unchanged, so other partial pages are
  not opened by this Home rollout.
- HE SEO, sitemap, hreflang, canonical, OpenGraph, indexing and public `/he/`
  routes remain off.

Home sections after Stage39:

| Section | Stage39 public HE decision |
| --- | --- |
| Header / navigation / language switcher | Visible on Home HE only. |
| Transport | Visible; transport content is READY and booking/payment code is unchanged. |
| Hotels | Visible; Stage25 data is READY. |
| Recommendations | Visible; Stage25 data is READY. |
| Cars | Visible through Stage33 record-gated content. |
| Trips | Visible through Stage33 record-gated content. |
| POI/map | Visible through Stage33 record-gated content. |
| Blog preview | Hidden; Blog remains BLOCKED. |
| Shop/cart/checkout/payment | Excluded; links normalize to EN/LTR. |
| Plan/community/packing/tasks/legal | Hidden or linked to EN/LTR until separately prepared. |

Launch posture after Stage39:

- Page-gated public HE scope expands to Home plus existing READY and
  record-gated pages.
- Full global HE remains NO-GO.
- Blog HE public remains BLOCKED.
- Shop HE remains EXCLUDED.
- SEO HE remains OFF.

## Stage 40 Blog HE Blocker Analysis

Status: **BLOCKED, but now scoped for a safe future record-gated rollout**.

Why Blog is blocked:

1. Migration 179 allowed internal HE translations but intentionally changed the
   public read policy to expose only PL/EN translations.
2. Blog list and detail code do not yet include `categories_he` / `tags_he` in
   public selects.
3. The current Blog list can fallback to EN for non-PL languages, which is not
   acceptable for a public HE content experience.
4. Blog detail lookup falls back by slug if a localized row is not found; that
   needs an HE record gate so non-ready posts do not render mixed content.
5. CTA resolution can still build links to Shop or blocked destinations with the
   requested language unless Blog-specific link normalization is added.
6. Blog SEO is intentionally PL/EN-only. HE canonical, hreflang, sitemap and
   OpenGraph must stay off until the SEO phase.

Top 5 HE candidates:

| Post | Candidate state | Public-safe now |
| --- | --- | --- |
| Affiliate / earning from tourism | Internal HE row prepared in Stage17 pack; verify required. | No |
| ETIAS Cyprus 2026 | Internal HE row prepared in Stage17 pack; verify required. | No |
| Cyprus in 7 days | Internal HE row prepared in Stage17 pack; verify required. | No |
| Car rental without deposit | Internal HE row prepared in Stage17 pack; verify required. | No |
| Larnaca vs Paphos | Internal HE row prepared in Stage17 pack; verify required. | No |

Public readiness requirements:

- Run `supabase/manual/he_blog_stage40_readiness_verify.sql`.
- Confirm all five candidates are complete, published, approved and human
  reviewed.
- Add the review/public-ready gate from the Stage41 draft before changing RLS.
- Implement Blog list/detail record-gating before setting Blog to
  `record-gated` in the page registry.
- Keep Blog HE SEO OFF until a later SEO rollout.

Current verdict: Blog stays `BLOCKED`; next work is Stage41 public-read and
record-gating preparation, not a public launch.

## Stage 41 Blog Record-Gated Readiness

Status: **BLOCKED, with record-gated foundation prepared**.

What changed:

- Blog public-read SQL now has a safe manual apply path:
  `supabase/manual/he_blog_stage41_public_read_apply.sql`.
- The Stage41 draft no longer drops existing policy or constraint objects; it
  previews the same logic with `ROLLBACK`.
- Verify SQL now checks the actual gate needed for launch:
  `public_ready_he_rows`, duplicate HE slugs and CTA risk.
- Server-side Blog list/detail code now has an HE-only path that refuses
  fallback-heavy content.
- Browser Blog list/detail code has the same dormant record-gated behavior for
  a later page registry change.

Top 5 public-ready requirement:

| Requirement | Status |
| --- | --- |
| HE candidate rows exist | Verify in Supabase with Stage40/Stage41 SQL |
| Complete title/slug/meta/summary/lead/content | Verify required |
| `categories_he` / `tags_he` present | Verify required |
| `review_status='public_ready'` | Not set by code; must be editorial/manual |
| Duplicate HE slugs | Must be zero |
| CTA destinations safe | Verify and review required |

Launch posture after Stage41:

- Blog and Blog detail remain `BLOCKED`.
- Shop remains `EXCLUDED`.
- HE SEO remains `OFF`.
- Booking/payment flow was not touched.

Next decision: run the manual SQL apply/verify only after human review of the
top five HE posts, then perform a dedicated record-gated Blog rollout smoke.

## Stage 42 Blog Human Review Status

Status: **BLOCKED; public-ready marking prepared but not executed by code**.

The Stage42 pre-apply screenshot from Supabase showed
`public_ready_he_rows = 0`. This means no HE blog post is currently safe to
expose as public Blog HE, even though the record-gated code path and policy gate
are prepared.

Prepared manual files:

- `supabase/manual/he_blog_stage42_mark_top5_public_ready_draft.sql`
- `supabase/manual/he_blog_stage42_mark_top5_public_ready_apply.sql`
- `supabase/manual/he_blog_stage42_public_ready_verify.sql`

Blog can move from `BLOCKED` to `RECORD-GATED READY candidate` only after:

1. Human/native review accepts all five top posts.
2. Stage42 apply is run manually.
3. Stage42 verify reports five public-ready rows and no duplicate HE slugs.
4. Blog list/detail smoke confirms non-ready posts normalize to EN/LTR.

SEO HE, sitemap, hreflang, canonical, indexing, Shop HE and public `/he/`
remain off.

## Stage 43 Completion System Audit

Status: **technical workflow ready, content publication still gated**.

Static translation cleanup:

| Metric | Before Stage43 | After Stage43 |
| --- | ---: | ---: |
| Missing HE keys | 317 | 216 |
| Same-as-EN keys | 553 | 547 |

Completed static groups:

- Shop short labels and footer/shipping basics, while Shop stays excluded.
- Dashboard/user-facing account dashboard labels.
- Partner/advertise form labels and short CTA/package labels.

Deferred groups:

- Long `advertise` public marketing copy.
- SEO/static meta.
- Long Shop copy and page title.
- Blog post bodies and long dynamic content.
- Email templates.

Manual workflow:

- Added `docs/he-manual-translation-admin-guide.md`.
- Blog content is not auto-translated or auto-marked.
- `public_ready` is a manual human review gate.

Current launch state:

- Existing Home/READY/record-gated HE pages remain available.
- Blog remains `BLOCKED`.
- Shop remains `EXCLUDED`.
- SEO HE remains `OFF`.
- Booking/payment flow remains untouched.

## Stage 44 PL/EN/HE Static Completeness

Status: **static UI structure is tri-lingual; long/review-heavy copy remains
manual**.

Source reports:

- `translations/audit-pl-en-he.json`
- `translations/audit-he-vs-en.json`
- `translations/he-readiness-report.json`

Metrics:

| Metric | Before Stage44 | After Stage44 |
| --- | ---: | ---: |
| PL keys missing EN | 301 | 0 |
| PL/EN keys missing HE | 283 | 216 |
| Placeholder mismatches | 33 | 0 |
| HTML tag mismatches | 1 | 0 |
| Empty/null translation values | 0 | 0 |
| Same-as-EN HE keys | 547 | 690 |

Same-as-EN increased because Stage44 made missing EN fallback explicit for
legacy/static car-rental fleet keys that were previously present only in PL and
HE. Those HE values are now visible as review debt and must not be treated as
human-reviewed Hebrew copy.

Closed groups:

- PL-only short UI now has EN fallback.
- Profile/account short labels.
- Plan/catalog/detail short labels.
- Community comment loading/sending states.
- Auth/nav close/profile labels.
- Runtime placeholders in auth, notifications, places, streak/challenge, sync,
  VIP and XP labels.

Deferred groups:

- `advertise.*`: long partner/advertising copy.
- `seo.*`: hidden until SEO HE stage.
- Long Shop copy/title and checkout/payment language.
- Email templates and payment/booking email copy.
- Blog posts and long dynamic content.

Launch state after Stage44:

- Home, READY and record-gated HE pages remain unchanged.
- Blog remains `BLOCKED`.
- Shop remains `EXCLUDED`.
- SEO HE remains `OFF`.
- Booking/payment flow remains untouched.

## Stage 45 Manual Translation Workflow

Status: **manual export/import workflow prepared; no publication change**.

Added tooling:

- `scripts/export-translation-review-pack.js`
- `scripts/import-reviewed-translations.js`
- package scripts `i18n:review-export` and `i18n:review-import`
- `docs/he-manual-translation-export-import-workflow.md`

Generated review packs:

| Pack | Records |
| --- | ---: |
| Static UI | 801 |
| Advertise | 235 |
| SEO | 122 |
| Shop | 96 |
| Email/payment templates | 506 |
| Same-as-EN HE | 690 |
| Dynamic content | 237 |
| Blog | 21 |

Safety result:

- No database updates were made.
- No Blog translation was marked `public_ready`.
- Blog remains `BLOCKED`.
- Shop remains `EXCLUDED`.
- SEO HE remains `OFF`.
- Booking/payment flow remains untouched.

RLS note:

- Live read of `email_template_catalog` and `email_template_versions` is
  restricted, so the email review pack includes local catalog fallback records
  from migration 173 for manual review visibility.

## Stage 46 Shop HE Decision

Status: **Shop remains EXCLUDED**.

Reference: `docs/he-shop-decision.md`.

Decision:

- Current launch path uses Option A: keep Shop outside first public HE launch.
- `shop.html?lang=he` may fall back to EN/LTR as a safety behavior, but this is
  not treated as Shop HE.
- Option C, a dedicated full Shop HE rollout, is required before Shop can be
  part of a true full-site HE launch.

Runtime safety confirmed in code:

- `js/i18n.js` marks Shop as `excluded`.
- `js/he-beta-rollout-config.js` keeps `shopEnabled:false`.
- `shop.html` has `data-disable-hidden-language="true"`.
- `js/shop.js` suppresses hidden languages and resolves HE to EN/LTR.
- `buildLocalizedUrl('/shop.html', 'he')` normalizes links to `lang=en`.
- `js/blog-cta-resolver.js` forces Shop CTA links to EN when source language is
  HE.

Review debt:

| Area | Count / status |
| --- | ---: |
| Static Shop review records | 96 |
| Static Shop missing HE | 3 |
| Static Shop human review required | 96 |
| Shop email/payment/order records needing review | 3 |
| Dynamic Shop records | 18 |
| Dynamic Shop records requiring review | 18 |

All 18 dynamic Shop records are `same_as_en`; they are not approved Hebrew
content. Cart, checkout, shipping, payment and order confirmation remain EN/LTR
until a dedicated Shop HE stage passes manual translation and payment QA.

No booking/payment, transport deposit, partner fulfillment or Stripe webhook
logic was changed.

## Stage 47 SEO / Sitemap / Hreflang Preparation

Status: **HE SEO OFF; architecture prepared only**.

Reference: `docs/he-seo-rollout-plan.md`.

New neutral guard:

- `functions/_utils/heSeoReadiness.js`

The guard classifies HE SEO readiness as:

- `candidate_ready`
- `record_gated_ready`
- `blocked`
- `excluded`

Current SEO candidate-ready pages:

| Page | Status |
| --- | --- |
| Home | candidate ready |
| transport | candidate ready |
| hotels | candidate ready |
| hotel detail | candidate ready per HE-ready record |
| recommendations | candidate ready |
| car | record-gated ready |
| trips | record-gated ready |
| trip detail | record-gated ready per HE-ready record |

Current blocked/excluded SEO surfaces:

- Blog and BlogPost remain `blocked`.
- Plan/community/account/auth/legal/notFound/unknown remain `blocked`.
- Shop/cart/checkout/payment remain `excluded`.
- Partners/admin remain `excluded`.

Activation is intentionally still blocked by rollout flags:

- `seoEnabled:false`
- `sitemapEnabled:false`
- `hreflangEnabled:false`
- `canonicalEnabled:false`
- `indexingEnabled:false`

No sitemap HE, hreflang HE, canonical HE, OpenGraph HE, indexing HE or public
`/he/` route was activated.

## Stage 48 Controlled SEO HE Activation

Status: **GO for ready-page SEO only; NO-GO for global HE**.

HE sitemap/canonical/hreflang/OpenGraph/structured-data are now guarded by
`functions/_utils/heSeoReadiness.js` and active only for the page-gated scope:

- Home
- transport
- hotels
- HE-ready hotel details
- recommendations
- car record-gated collection
- trips record-gated collection
- HE-ready trip details

The generated static sitemap contains these HE URLs:

- `https://www.cypruseye.com/?lang=he`
- `https://www.cypruseye.com/transport.html?lang=he`
- `https://www.cypruseye.com/hotels.html?lang=he`
- `https://www.cypruseye.com/recommendations.html?lang=he`
- `https://www.cypruseye.com/car.html?lang=he`
- `https://www.cypruseye.com/trips.html?lang=he`

Dynamic sitemap generation may add only HE-ready hotel and trip detail URLs.

Still blocked/excluded:

- Blog and BlogPost remain blocked and have no HE SEO.
- Shop/cart/checkout/payment remain excluded and have no HE SEO.
- Plan/community/account/auth/legal/notFound/unknown remain blocked.
- Partners/admin remain excluded.
- public `/he/` routes remain disabled.

Booking/payment and transport deposit flow were not changed.

## Stage 49 Live SEO HE Monitoring

Status: **live deploy verification for ready-page SEO only**.

Allowed live HE SEO URLs are limited to Home, transport, hotels, HE-ready hotel
details, recommendations, car, trips and HE-ready trip details.

Blocked/excluded surfaces remain:

- Blog and BlogPost,
- Shop/cart/checkout/payment,
- Plan/community/account/auth/legal/notFound/unknown,
- partners/admin,
- public `/he/` routes,
- not-ready hotel/trip records.

Stage49 live monitoring found two issues before final GO and fixed them in the
SEO/blog guard layer:

- HE HTML now gets server-rendered `dir="rtl"` alongside `lang="he"`;
- Blog detail no longer falls back to HE translations/canonical/OG when Blog HE
  is blocked and the resolved page language is EN/PL.

No booking/payment, transport deposit, Stripe webhook, Shop HE or Blog
`public_ready` data changes were made.

Final Stage49 status: **GO**.

Live checks confirmed:

- existing HE UI pages remain available in page-gated/record-gated scope;
- live sitemap contains only the allowed HE URLs;
- allowed pages have HE canonical, HE hreflang, HE OpenGraph URL, `lang="he"`
  and `dir="rtl"`;
- Blog and Blog detail remain blocked from HE SEO;
- Shop/cart/checkout/payment remain excluded from HE SEO and HE UI;
- not-ready record probes return EN/LTR/404 without HE SEO;
- public `/he/` routes remain redirects/fallbacks;
- booking/payment regression tests still pass.

## Stage 50 Final Production State

Status: **production-ready partial HE launch**.

HE UI active:

- Home
- transport
- hotels
- HE-ready hotel details
- recommendations
- car
- trips
- HE-ready trip details
- POI/map flow

HE SEO active:

- only the Stage49 allowed URLs listed in `docs/he-seo-rollout-plan.md`

Blocked:

- Blog and Blog detail
- Plan
- Community
- account/auth/legal/404/unknown

Excluded:

- Shop/cart/checkout/payment
- partners/admin

Non-public:

- `/he/` routes

Manual workflow lock:

- Blog content is translated and reviewed manually.
- Blog `public_ready` is never set automatically.
- Shop remains excluded until a dedicated future Shop HE stage.
- Email/payment templates remain manual-review items.
- Booking/payment and Stripe webhook logic are not part of HE content work.
