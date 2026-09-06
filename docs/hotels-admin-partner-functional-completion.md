# Hotels Admin + Partner functional completion — local evidence

Baseline: `785b6353d2003956fae366d96394be700c1af7b4`.
Branch: `feature/hotels-admin-partner-functional-completion`.
Production boundary 114415 is user-reported, not re-queried during this task.
No production access, Stripe API call, new migration, push, merge or deployment.

## Admin Build server Review

| Step | Exact implementation / contract |
|---|---|
| Button | `admin/hotels-v2-workspace.js`, `openSevenArchesReviewedPricingEditor`, external submit button targeting `sevenArchesReviewedPricingAdminForm` |
| Handler | Form `submit`, `preventDefault`, checked tier rows only; now guarded by `buildInFlight` |
| Builder | Hotel, Room Type, Room Rate, schedule, tier identities and coordinates from validated loaded rows; numeric before/requested price; trimmed reason; action `accept` |
| Request | `hotels_v2_seven_arches_reviewed_pricing_admin_request_v1`, `{p_request: request}` |
| Repository | `previewSevenArchesReviewedPricing` validates request, runs exactly one `client.rpc`, validates Preview, retains exact reviewed plan |
| RPC | `public.hotel_v2_admin_preview_seven_arches_reviewed_pricing(jsonb)` |
| Transport | Supabase JS RPC POST `/rest/v1/rpc/hotel_v2_admin_preview_seven_arches_reviewed_pricing`; existing `window.getSupabase()` / `sb` client session, no token extraction |
| Required stage | **114415**, not 114420 |
| Server auth | `hotel_v2_h2a_require_admin()` and non-null `auth.uid()` before request planning |
| Response | `hotels_v2_seven_arches_reviewed_pricing_admin_preview_v1`, generated proposal UUID/version, canonical items, impacts, exact EUR10 commission, 30-minute Review |
| Service worker | `admin/sw.js` ignores non-GET and cross-origin requests; it cannot intercept this POST. No SW changes |
| Save boundary | Separate explicit Apply; no automatic Apply/retry |

**Production root cause remains unproven.** “Failed to fetch” identifies a transport symptom, not an HTTP code, auth failure, missing migration, timeout or server SQLSTATE. The user has not supplied the exact failed request's status, timing and safe response. A catalog query cannot establish CORS, offline state, a VPN/extension block or a lost response.

Locally proven defects and correction:

1. Two `requestSubmit()` events while Preview was pending produced **two** RPC calls despite a disabled button. A per-form in-flight guard now produces **one**. This is independent evidence, **not attributed as the cause of the live failure**.
2. A transport rejection could reach the toast as the raw error message. For this exact Preview RPC, an ambiguous response now shows a bounded safe message. It does **not** claim the server stored nothing, does not expose the response, and does not retry.

Important: Admin-initiated Preview **writes a pending proposal, proposal items and an Admin Review** (114415 lines around 1430–1515), but does not update active pricing. “Preview no mutation” means **no active-price mutation**, not zero database writes. An interrupted Preview may have committed a Review. Do not automatically repeat it.

The old E2E mock was not a real server envelope: it used a null Admin proposal ID/version and an expiry decades later. The new real-parser transport fixture uses the generated UUID/version and exactly 30 minutes as SQL specifies. Production Core validation was **not weakened**.

Required human evidence: inspect the already failed Network entry; return only RPC name, method, HTTP status (or absence), duration, content-type, safe SQLSTATE/message, and whether CORS/connection errors are shown. Do not export HAR, Authorization, cookies, snapshot tokens, or full plans. No new Preview is authorized by this document.

## Partner pricing

- Active matrices: validated `hotel_v2_partner_get_workspace`; two independent schedules, 27 tiers each.
- Dedicated Get: `hotel_v2_partner_get_seven_arches_reviewed_pricing(uuid,uuid)` is created by **114420**.
- Preview/Submit: `hotel_v2_partner_preview_seven_arches_pricing_proposal(jsonb)` and `hotel_v2_partner_submit_seven_arches_pricing_proposal(jsonb,uuid,text)` are created by **114415**.
- `Core.buildSevenArchesReviewedPricingDraft` supports 1–54 changed tiers, refuses no-op, duplicate/foreign tiers, wrong coordinates/currency/identity, numeric strings and invalid money.
- Exact client range: EUR, two decimals, requested price from 10 through 9,999,999,999.99; guests 2/3/4, nights thresholds 2–10. No new commercial rule was added.
- UI detects differences before building items. Upper/Ground selection preserves independent draft values.
- Submit consumes the locally cached plan once and creates the reviewed proposal path; no generic active-price Apply. Pending proposal remains an Admin decision.
- At 114415 the missing dedicated Get must continue to disable proposals. No polling or substitute Get was added.

New local tests cover Upper 1/5/27, Ground 1/5/27 and both 54 changes, unchanged workspace, invalid identity/value/currency/access, exactly one Preview and one explicit Submit, zero Apply/generic mutation. Browser fixtures verify rendering/transport contracts; they are **not new proof of the complete server receipt chain**. Existing SQL/PostgREST gates remain unchanged and were not rerun.

## Booking visibility: a projection gap, not proof of no bookings

Legacy and 114420 V2 public bookings both use `public.hotel_bookings`. 114420 additionally persists exact public-pricing/booking snapshots and allocation fields; its `source='website'` alone does not distinguish legacy from V2. The booking snapshot contract marker does.

Current Admin and Partner repositories call `presentationFromAvailability`, not a history RPC. Partner `refresh()` requests today through today+30 days; server workspace permits at most 61 days. ADMIN-D's availability includes overlapping allocations and pending/confirmed unmapped blockers. Completed history and later future stays are outside that contract. Expanding a browser filter cannot recover rows the server never returned.

The Partner UI now explicitly labels this as an incomplete availability projection with its loaded dates. It must not imply an empty result means an empty Hotel history. No bookings, totals or Room bindings are invented.

Existing secure operational RPC:
`partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)` in `20260811150000_hotels_v2_h1a_partner_security_bridge.sql`.

- Auth: current Admin or `is_partner_user(p_partner_id)`.
- Binding: booking ID + `resource_type='hotels'` + fulfillment Partner + fulfillment resource ID equal booking Hotel ID.
- Returns non-PII booking context, legacy room/rate IDs as text; no customer identity.
- Nullable date bounds support historical/future rows **with that fulfillment**.
- Limit ≤1000; no keyset cursor, so it cannot guarantee all history at arbitrary scale.
- It is not equivalent to current H3.2A per-user resource/capability/co-owner assignment authorization. Do not silently substitute it as an unrestricted history reader or use a direct table fallback.

Disposable PG16 tests execute the **unchanged real operational RPC** with explicitly mocked membership: historical+future authorized rows returned (2), cross-Partner/Hotel rows hidden, another Partner rejected, unscoped query rejected. A fourth booking without fulfillment is intentionally missing. This demonstrates the limitation; it is not a production lineage conclusion or proof of real membership predicates.

The read-only booking diagnostic measures exact Hotel binding, active allocations, legacy Room identity, fulfillment coverage, current assignment+fulfillment coverage, date/status classes and deposit-record presence without PII. Its result must settle whether observed missing history is already covered by the existing contract or requires a new paginated H3.2A-authorized projection.

**No new migration yet:** production historical coverage and the exact current co-owner/fulfillment visibility relationship remain unverified. Do not manufacture fulfillment/backfill mappings. If a new projection is required, use a separately reviewed unused version after 114450, current access/capability checks, keyset pagination, exact Hotel joins, whitelist fields, owner/ACL/search_path checks and real role/isolation tests. Never edit applied stages to add this feature.

## Stripe / Payments architecture

Repository evidence:

- `supabase/functions/create-subscription/index.ts`: Stripe SDK, platform customers/subscription Checkout.
- `partner-fulfillment-action/index.ts`, `trip-date-selection/index.ts`: platform Checkout for service deposits, off-session setup and metadata; no `Stripe-Account`, `transfer_data` or `application_fee` routing in the inspected Checkout path.
- `stripe-webhook/index.ts`: signed webhook verification, deposit/payment-intent/session reconciliation; booking/fulfillment linkage. Underscored `stripe_webhook` is a compatibility proxy, not an independent Connect implementation.
- `service_deposit_requests`: Stripe customer/session/intent/payment-method references. `partner_payout_details` stores manual bank payout details, **not a connected-account binding**.
- No implemented account creation/link/OAuth flow, connected-account mapping, Connect event reconciliation or Partner account-state RPC was found in the audited functions/frontend/migrations.
- H3.2B reports `stripe_onboarding.available=false`, `status=future_stage`; Payments shows not configured, exact commission and no fabricated financial summary.

`STRIPE_CONNECT_MODEL_REQUIRES_BUSINESS_DECISION=YES`. Minimum decision: must existing independently controlled Partner Stripe accounts be connected, or should CyprusEye onboard platform-connected accounts? Confirm dashboard/control model and responsibility for requirements, fees and negative balances; confirm the legal Partner/account binding. This cannot be inferred from platform deposit Checkout.

Official references: [controller properties](https://docs.stripe.com/connect/migrate-to-controller-properties), [OAuth for Standard accounts](https://docs.stripe.com/connect/oauth-standard-accounts), [hosted onboarding](https://docs.stripe.com/connect/express-accounts). The onboarding return redirect is not evidence of completion; Account Links are single-use. These references inform the design questions, not a selected model.

Future implementation requirements, after that decision: server-owned account ID binding, authenticated Partner+assignment checks, allowlisted return/refresh URLs, single-use CSRF/state protection where applicable, idempotent account creation, authenticated account-state reads, signature-verified/deduplicated Connect events, no secrets/account-link URLs in logs, no automatic onboarding polling, no arbitrary browser account IDs. Status must come from verified Stripe account capabilities/requirements, not return-URL parameters.

Account onboarding is distinct from settlement. Do not infer destination charges/transfers or convert EUR10 per allocated Room/night to a percentage. A settlement decision must not become a pretext to block a clearly selected onboarding design; here the **account model itself** is still undecided. No speculative server endpoint/button/schema was added. Flag stays false. Mock Connect onboarding is N/A until a model is approved; disabled-state UI tests do run.

## Rollout freeze and readiness

No migration changed. Current main candidates, recalculated:

| Stage | SHA-256 |
|---|---|
| 114420 | `a047bf49ec88d24684139f2e831dd831de90e86ca53eded0405f5684d80082c4` |
| 114425 | `d72c244840bd21a5c5e7e46f654c8b3a7466f80f1d18ebac3ca938ab43163ee5` |
| 114450 | `b679b8f65200d345ce154ef99343f1488dbb93394b65dab9fbf1d17c16688c84` |

114420 provides the Partner Get/public booking bridge, not the already-installed Admin Preview. 114425 concerns external-calendar settings compatibility; 114450 provides reviewed provider types. Neither completes historical booking authorization or Stripe onboarding. All are gated by the existing recovery-point, prewrite, install, history-reconciliation and postinstall procedures, never an automatic continuation of this task.

## Conservative completion matrix

`READY_LOCALLY` means local client/static evidence (not fresh production mutation proof). Existing accepted behavior is not promoted to a new backend validation result. Readiness percentage is unweighted rows marked DONE/READY_LOCALLY, not a claim that production is that percentage tested.

| Area | Capability | Status | Evidence / remaining gate |
|---|---|---|---|
| Admin | Overview/status | READY_LOCALLY | Real-parser workspace harness |
| Admin | Property review | READY_LOCALLY | Existing accepted path; unchanged this phase |
| Admin | Room review | READY_LOCALLY | Existing accepted path; unchanged this phase |
| Admin | Pricing Build server Review | BLOCKED_BY_PRODUCTION_DIAGNOSTIC | Local path passes; live transport cause unknown |
| Admin | Pricing Preview | BLOCKED_BY_PRODUCTION_DIAGNOSTIC | Same live request; do not duplicate Preview |
| Admin | Pricing Accept/Reject | READY_LOCALLY | Existing focused client/E2E, separate Apply |
| Admin | Calendar | BLOCKED_BY_114450 | Reviewed provider stage |
| Admin | Bookings | BLOCKED_BY_PRODUCTION_DIAGNOSTIC | Availability is not full history |
| Admin | Payments | BLOCKED_BY_STRIPE_CONFIGURATION | No complete payment/Connect projection |
| Partner | Overview | DONE | Human-approved/live visual system; local regression |
| Partner | Property | READY_LOCALLY | Existing reviewed edit tests |
| Partner | Rooms | READY_LOCALLY | Existing reviewed edit tests |
| Partner | Pricing load | BLOCKED_BY_114420 | Dedicated control absent; active tiers still visible |
| Partner | Pricing edit | BLOCKED_BY_114420 | Local changed-only matrix passes |
| Partner | Pricing Preview | BLOCKED_BY_114420 | 114415 RPC exists; 114420 Get gates UI |
| Partner | Pricing Submit | BLOCKED_BY_114420 | Local one-submit proposal flow passes |
| Partner | Calendar | BLOCKED_BY_114450 | Provider configuration still gated |
| Partner | Historical bookings | BLOCKED_BY_PRODUCTION_DIAGNOSTIC | Fulfillment/assignment coverage |
| Partner | Future bookings | BLOCKED_BY_PRODUCTION_DIAGNOSTIC | Same projection gap, no guessed backfill |
| Partner | Payments | BLOCKED_BY_STRIPE_CONFIGURATION | Safe unavailable state, not fake totals |
| Partner | Stripe Connect | BLOCKED_BY_STRIPE_CONFIGURATION | Account model decision precedes config |
| System | Permissions | READY_LOCALLY | Existing strict client boundaries; no grants changed |
| System | Multi-owner | BLOCKED_BY_HUMAN_AUTHORIZATION | Real assignment/membership acceptance still required |
| System | Cross-Hotel isolation | READY_LOCALLY | Strict client projection + scoped RPC mock-membership tests |
| System | Pricing authority | READY_LOCALLY | Independent 27/27 preserved; no pricing SQL changed |
| System | Commission | READY_LOCALLY | Exact EUR10 validators/fixtures; no SQL changes |
| System | Payment policy | READY_LOCALLY | Frozen backend; no payment payload introduced |
| System | Booking visibility | BLOCKED_BY_PRODUCTION_DIAGNOSTIC | Not all history is represented |
| System | Calendar sync | BLOCKED_BY_114450 | No sync invoked |
| System | Feature flags | READY_LOCALLY | Disabled public/Stripe controls; no flag mutation |
| System | Languages/mobile | READY_LOCALLY | Existing EN/PL/HE responsive harness |

Admin 4/9 = 44.4%; Partner 3/12 = 25.0%; combined UI 7/21 = 33.3%; system 7/10 = 70.0%; overall matrix 14/31 = 45.2% ready-or-done. These deliberately conservative gates must not be presented as 100% functional production.

## Diagnostic handoff and scope of local validation

Files under `/private/tmp` are not production execution authorization and are not included in this repository checkpoint. Each starts `BEGIN; SET TRANSACTION READ ONLY;`, returns one result table and ends `ROLLBACK;`. No timeout override, mutating helper, provider cleanup Get, account data or secret is read.

| Artifact | SHA-256 | Lines | Expected rows |
|---|---|---:|---|
| `hotels_v2_admin_build_review_diagnostic_readonly.sql` | `cdc4c27e02b7d6c909bf7c682a4807b3b20820990f00c454c03d45d54d73d3e4` | 71 | 12 + relevant role/database timeout entries |
| `hotels_v2_partner_bookings_visibility_readonly.sql` | `7d691370c811ed296d6f3026ef9900230367209789cf4e8ade1b5bd8e2713f7b` | 55 | 5 + source/status/date groups; local 7 |
| `hotels_v2_stripe_connect_readiness_readonly.sql` | `01e8cdb6fa0eccd2acc36534c9b3abba4f16855c7d3cc9e69d795f21c3258dc6` | 30 | 8 + site_settings rows; local 9 |

Local PG16 validation uses synthetic tables and the existing operational booking function, not a full 114415 installation. Diagnostic metadata correctly reports absent pricing functions in that schema-only fixture; this is syntax/read-only validation, not production source validation. Data/schema dump hash before and after: `8a2032b77cff368e2c2244138946792a450ee2a266104fd866574ce2f4493b57`. Only pg_dump's freshly randomized `restrict/unrestrict` header keys were excluded, after identifying them as the sole dump differences.

The full protected PG/PostgREST forward-chain suites were not run; no server code changed. Do not claim server proposal/receipt/concurrency FULL PASS from browser stubs. Full completion remains blocked by the specific production observations and Stripe account-model decision above.

## Validation recorded in this phase

- Jest: **40/40**, five focused suites (reviewed Admin, reviewed Partner, Workspace Help, Partner Repository, Partner Redesign); `tsc -p tsconfig.jest.json` PASS.
- Playwright: **65/65** in the two Admin/Partner suites, grep `Partner|Admin|redesign|visual fidelity V2|V2 Property`, loopback port 4317. Includes 12 new functional cases, existing failure/permission/RTL/mobile checks, incomplete-history notice and no Connect action when disabled.
- Admin transport tests use the real Repository/Core with a transport stub, not the production API. Partner proposal UI tests use the established local repository fixture. No mock is shipped in runtime code.
- Standalone strict TS across the combined E2E inputs retains **two baseline diagnostics**: literal schedule-ID assignment and missing esm.sh declaration. Compiler-host comparison to exact baseline source established identical diagnostic codes/messages; no new diagnostics. Do not call the combined strict check a clean PASS or fix unrelated baseline files.
- Build PASS. Partner mirror is byte-identical (normal static copy); Admin mirrors match the normal Terser options, not unminified source bytes. No CSS or service-worker change.
- PG16.13: all three diagnostic files execute with transaction_read_only=on and identical data/schema before/after; one result set each. Existing booking context RPC isolated assertions **4/4**, with mocked membership explicitly noted above.
- Local PostgREST full pricing chain: **not run**. Stripe mock onboarding: **not implemented**, pending account-model decision. Disabled Stripe UI is covered by the browser suite.
- All **238** tracked migration files byte-identical to baseline, including 114420/425/450. Owner file SHA and binary diff SHA exact. No runtime fake data introduced.
- Diagnostic fixture materials retained only under `/private/tmp/hotels-functional-pg16.j8r7go`; its dedicated server is stopped after validation. Existing clusters are not altered.
- `git diff --check`: PASS. No push/merge/deployment; any local checkpoint is feature-branch-only.
