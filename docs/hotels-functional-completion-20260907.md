# Hotels functional completion — local continuation, 7 September 2026

> Historical report. See `hotels-capability-lifecycle-validation-20260908.md`
> for the subsequently authorized global lifecycle implementation and its tests.
> Public booking/history/routing remain separate deferred scopes.

Branch: `feature/hotels-admin-partner-functional-completion`.
Baseline: `bd382df5695e8e9dbcedcaeb2dad226377be28f6`.
The user reports production frontend `c439ae465b66184179cf1abc86bc6a4275cc4ca2`
and database boundary 114415. Neither was queried in this task.
This is uncommitted local WIP, not a production release or write authorization.

## Result and remaining blocker

**Full functional completion is NOT PASS.** Lack of backup did not prevent local
work. A newly reproduced lifecycle-contract incompatibility does prevent an
honest “backup → execute everything → complete” handoff:

| Local synthetic state | Actual public quote result |
|---|---|
| `hotel_rooms_v2_enabled=false` | `42501:hotels_v2_public_booking_disabled` |
| `hotel_rooms_v2_enabled=true` | `55000:hotels_v2_seven_arches_public_quote_authority_invalid`; `BASE_TOPOLOGY` |
| Rooms false, Stripe true | Independent topology returns false: existing topology requires Stripe false |

The 114420 wrapper correctly checks the Rooms flag before any quote/booking
write. Its downstream reviewed-pricing authority still requires the exact
pre-public lifecycle. The frozen 114410 topology, evolved by 114415/114450,
requires Rooms, Instant Booking and Stripe false. The existing Partner Core
workspace validator also explicitly requires these three flags false.

Reproducer: `tests/integration/hotels-v2-public-enable-boundary-diagnostic.sql`.
It refuses databases not named `hotels_functional_*`, changes flags only inside
a local transaction, records both exact failures, and rolls back. It is NOT a
production diagnostic. No receipt, price, booking, payment or immutable
foundation was changed to bypass this failure.

Required follow-up: a separately reviewed, additive lifecycle compatibility
design that preserves historical receipts and exact current security while
authorizing each future enabled state. Do not mask flags as false, bypass
topology, or edit applied migrations. Public booking and integrated Stripe
enablement must remain blocked until that design and full forward regression
pass. No money-routing architecture has been selected.

## Implemented local work

### Admin / Partner pricing

- Existing exact 114415 Admin and 114420 Partner contracts retained.
- Local UI coverage includes one/many Upper/Ground/both tiers, 27+27 identities,
  one Preview on submit, explicit accept/reject, no generic price mutation.
- Added a shared synthetic Partner-submitted proposal passed to the Admin UI.
  Prices remain unchanged through Partner submission and Admin Preview. Only
  explicit accepted Apply changes its selected tier; rejection changes none.
- Real loopback PostgREST independently verifies server authorization, private
  ACL boundaries, Partner Preview/Submit, Admin Preview/Apply and replay rules.
  Mock UI assertions are not substituted for database authorization evidence.
- Fixed test-fixture correlation IDs to be fresh per PostgREST run; the previous
  fixed IDs collided with already committed SQL fixture receipts. Replay tests
  deliberately reuse the fresh IDs within the run; no server rule changed.

### Calendar

The 114450 Admin provider-review Get is VOLATILE: it can expire proposals and
clean staged secrets. Removed it from automatic calendar-range loading.
Availability/control reads remain automatic; provider-review refresh is now an
explicit, explained action, coalesced while in flight and never retried
automatically. An error clears stale proposals and never displays raw server
text. No calendar sync, private URL or mutation RPC runs from passive loading.
EN/PL/HE copy was added without redesigning the approved layout.

Real provider PostgREST gate passed: 53 requests, 44 security/redaction checks,
three accepted and one rejected synthetic proposal, replay/identity conflicts,
and concurrent decision handling. Local pg_net dispatch was disabled and bound
to the empty `postgres` database; synthetic `.example.test` URLs were never
fetched. The production Edge package was not deployed.

### Stripe: confirmed business model, implemented future connection package

One **Partner-owned Standard account**, full Stripe Dashboard, shared across the
Partner's assigned Hotels. Stripe-hosted Standard OAuth allows an existing
account or Stripe signup. No Express account creation and no account-per-Hotel.
This follows the explicit business decision; Stripe's general recommendation
for new platforms is Connect Onboarding, so OAuth availability/configuration
must be confirmed in the platform Dashboard before production setup.

Sources: [Standard OAuth](https://docs.stripe.com/connect/oauth-standard-accounts),
[OAuth reference](https://docs.stripe.com/connect/oauth-reference),
[Connect hosted onboarding](https://docs.stripe.com/connect/hosted-onboarding).

Existing architecture remains unchanged:

| Area | Existing repository contract |
|---|---|
| Subscription | Platform Checkout in `create-subscription` |
| Service deposits | Platform Checkout / PaymentIntent in `partner-fulfillment-action` and `trip-date-selection` |
| Webhook | Existing platform `stripe-webhook`, plus compatibility proxy `stripe_webhook` |
| Stored payment references | `service_deposit_requests`; existing session/intent/customer/payment-method references |
| Partner bank data | `partner_payout_details`, not a Connect binding |
| Hotels commission | EUR 10 per allocated Room per rental night; not a percentage |

New future migration:
`supabase/migrations/20260811446000_hotels_v2_partner_stripe_connect.sql`.
114460 was absent from the tracked migration inventory and is after 114450.
It does not rewrite any existing function or migration, enable a flag, create
a connected account, or change a price/payment/commission.

- Private schema, three PostgreSQL-owned RLS/FORCE-RLS tables, no browser or raw
  service-role table access. Accounts keyed by Partner, account ID globally
  unique. Ephemeral OAuth states and webhook deduplication are private.
- One Edge-only RPC: `hotel_v2_stripe_connect_service(text,jsonb)`. Authenticated
  and anon cannot execute it. Edge uses `auth.getUser()` before passing the
  verified actor; server storage checks owner membership, active Partner,
  assigned Hotel and existing `initiate_stripe_onboarding` permission again.
- Exact boolean Stripe flag gates connection. Flag remains false in production.
  Storage status does not acquire mutation-grade locks; state transitions use
  per-Partner serialization.
- 32-byte random state, actor/Partner/Hotel binding, 10-minute expiry, atomic
  single-use claim before OAuth exchange, fixed redirect, request idempotency,
  bounded outstanding states, no browser-trusted account ID, no silent account
  replacement or cross-Partner linking.
- No access/refresh token storage or logging. Standard account/type/mode/scope
  and real account readiness are verified server-side. UI receives only status
  and verification time, never account IDs or tokens.
- Signed Connect webhook with a separate signing secret; SDK signature and
  timestamp checks, event deduplication, revision checks and sticky deauthorization.
  No automatic OAuth/network retries. A failed callback requires a fresh explicit
  connection attempt, not reusing the URL.
- States: NOT_CONNECTED, ONBOARDING_INCOMPLETE, CONNECTED, RESTRICTED,
  ACTION_REQUIRED, DISABLED. CONNECTED only follows verified Stripe/server state.
- Separate localized Partner connection page and return page. Callback query is
  removed before SDK import; no analytics or token storage. PWA excludes these
  pages from Cache Storage, headers specify no-store/no-referrer. Future rollout
  must activate the new service worker before any OAuth flow is enabled.
- Partner Payments links to the scoped connection page only for the existing
  onboarding capability. Existing workspace feature-flag validation is NOT
  relaxed. Integrated global flag activation is still blocked as noted above.
- Trusted service-role / postgres administration remains a trust boundary;
  this is not cryptographic exclusion of privileged direct SQL.

Payment routing, split settlement, charges/transfers, fee deduction, payout
scheduling and refunds were not implemented or inferred. These require a later
commercial/technical decision. Existing commission/deposit/payment contracts
remain untouched. Unsupported payment aggregates stay unavailable, not invented.

## Validation evidence

| Gate | Result |
|---|---|
| Final Admin/Partner/Stripe Playwright | 98/98 PASS, four suites; includes mobile EN/PL/HE/RTL |
| Focused Jest | 53/53 PASS, five suites |
| `tsc -p tsconfig.jest.json` | PASS |
| Edge `deno check` | PASS; pinned SDK types only, no function execution |
| Stripe Node mock/static | 21/21 PASS |
| Real Stripe SDK signature test | 1/1 PASS; altered signature/body and expired timestamp rejected before storage; runtime networking denied |
| Final Stripe PostgreSQL install | PASS; three private relation/security contracts, empty install state |
| Stripe PostgreSQL negatives | 15/15 PASS; raw/browser ACL, disabled flag, staff/cross-scope, expiry, replay, account uniqueness/replacement |
| Same Partner/co-owner/two Hotels | PASS; one account reused, no account-per-Hotel |
| Stripe SQL rollback | PASS; accounts/states/events empty and Stripe false restored |
| Migration replay | Rejected at existing private schema; transaction rolled back |
| Final Stripe real PostgREST + mock Stripe | PASS; 10 denials, one exchange, one verified account read, one account/two Hotels, prices/payment/commission unchanged |
| Real reviewed-pricing PostgREST | PASS; 53 requests: 13 auth denials, 18 raw ACL denials, 6 private helper denials, 2 bypass denials, Partner/Admin lifecycle, 3 identity conflicts, 7 postconditions |
| Real provider PostgREST | PASS; 53 requests / 44 security-redaction checks, concurrency and lifecycle |
| Committed provider verifier | PASS after local reviewed-pricing evolution; lineage/security/topology mismatches 0/0/0, provider-safe true |
| Full SQL forward gate | NOT PASS: stops at public-enabled authority contradiction; no false success sentinel emitted |
| New booking creation/visibility | BLOCKED by the exact public lifecycle contradiction; UI projection mocks are not real booking proof |
| Normal build | PASS; normal `/js` copy and Admin/PWA minification preserved |
| Existing migration freeze | 238/238 tracked migration files byte-identical to baseline |
| Unrelated owner preflight | Preserved exactly, including its existing binary diff |

The old full fixture also lacked the already accepted 113700 digest qualification.
The application-bridge test now restores only that exact source transformation,
with BEFORE `d6cec064…` and AFTER `3f954c52…` guards. 114420 itself is unchanged.
The updated public-positive fixture enables Rooms only in its rolled-back test
transaction; that exposed the real topology incompatibility above. The provider
chain was subsequently installed in its supported preinstalled-chain mode,
not misreported as a complete uninterrupted forward PASS.

## Capability readiness

| Capability | Status |
|---|---|
| Admin Property/Rooms/pricing/control | DONE_LOCAL; production permission remains separate |
| Partner Property/Rooms/draft Room | DONE_LOCAL |
| Partner pricing application Get | DONE_LOCAL / BLOCKED_BY_114420 in production |
| Partner → Admin accept/reject | DONE_LOCAL |
| Calendar provider workflow | DONE_LOCAL / BLOCKED_BY_114425 / BLOCKED_BY_114450 |
| Calendar Edge package | READY_FOR_PRODUCTION preparation only / BLOCKED_BY_HUMAN_AUTH |
| Stripe account connection module | DONE_LOCAL / BLOCKED_BY_STRIPE_CONFIG / BLOCKED_BY_HUMAN_AUTH |
| Integrated public/Stripe enabled lifecycle | BLOCKED_BY_LOCAL_CONTRACT — must be corrected before flag activation |
| Payment records / totals | Existing authorized projection only; unavailable fields stay unavailable. Full new-booking linkage proof pending |
| New booking check | NOT YET READY_FOR_FINAL_CONTROLLED_TEST; local creator blocked |
| Booking history/backfill | DEFERRED |
| Production DB execution | BLOCKED_BY_BACKUP and explicit staged authorization; backup alone is insufficient |

No defensible “100%” is claimed. Readiness percentages without an agreed weighted
denominator would hide these failures, so they are reported as NOT_SCORED. The
binary gates and exact passing test counts above are the authoritative matrix.

## Final task status

```text
HOTELS_LOCAL_FUNCTIONAL_COMPLETION=FAIL
ADMIN_LOCAL_READINESS_PERCENT=NOT_SCORED
PARTNER_LOCAL_READINESS_PERCENT=NOT_SCORED
PRODUCTION_EXECUTION_READINESS_PERCENT=NOT_SCORED
ADMIN_PRICING_LOCAL_E2E=PASS
PARTNER_PRICING_LOCAL_E2E=PASS
CROSS_FLOW_LOCAL_E2E=PASS
CALENDAR_LOCAL_READINESS=PASS (UI + real provider RPCs; public quote coverage blocked)
EDGE_PACKAGE_READY=YES (preparation only)
STRIPE_ARCHITECTURE=existing platform payments unchanged; separate future Standard OAuth binding
STRIPE_CONNECT_MODEL=PARTNER_OWNED_STANDARD_ONE_ACCOUNT_PER_PARTNER
STRIPE_CONNECT_BUSINESS_DECISION_REQUIRED=NO
STRIPE_CONNECT_LOCAL_IMPLEMENTATION=PASS (connection package, not global flag activation)
STRIPE_CONNECT_LOCAL_TESTS=21 Node + 1 signed webhook + 13 UI + 15 SQL negatives + real PostgREST PASS
PAYMENTS_LOCAL_READINESS=PARTIAL (supported projections only; routing undecided, new booking linkage unproven)
NEW_BOOKING_VISIBILITY_LOCAL_TEST=FAIL (creator blocked before booking insertion)
BOOKING_HISTORY=DEFERRED
114420_SHA=a047bf49ec88d24684139f2e831dd831de90e86ca53eded0405f5684d80082c4
114425_SHA=d72c244840bd21a5c5e7e46f654c8b3a7466f80f1d18ebac3ca938ab43163ee5
114450_SHA=b679b8f65200d345ce154ef99343f1488dbb93394b65dab9fbf1d17c16688c84
NEW_FUTURE_MIGRATIONS=20260811446000 (uncommitted, unapplied)
FOCUSED_E2E=98/98 PASS
FOCUSED_JEST=53/53 PASS
FOCUSED_TYPESCRIPT=PASS
LOCAL_POSTGRES=TARGETED PASS; FULL FORWARD GATE FAIL
LOCAL_POSTGREST=PRICING PASS / PROVIDER PASS / STRIPE PASS
MOCK_STRIPE=PASS
BUILD=PASS
GIT_DIFF_CHECK=PASS
OWNER_PREFLIGHT_UNTOUCHED=YES
MIGRATION_FREEZE=238/238 PASS
PRODUCTION_SQL_EXECUTED=NO
PRODUCTION_WRITE_EXECUTED=NO
MIGRATION_REPAIR_EXECUTED=NO
EDGE_DEPLOY_EXECUTED=NO
LIVE_STRIPE_CALL_EXECUTED=NO
PUSH_EXECUTED=NO
MERGE_EXECUTED=NO
REMAINING_PRODUCTION_BLOCKERS=enabled-lifecycle compatibility; backup; gated 114420/425/450; reviewed Stripe package/configuration; human authorization; controlled new booking proof
ESTIMATED_REMAINING_CONTROLLED_WORK=one additive lifecycle compatibility design/validation batch, then separately gated execution/configuration and live smoke; no reliable duration yet
READY_FOR_BACKUP_THEN_FINAL_ROLLOUT=NO
NEXT_EXACT_HUMAN_STEP=review the exact public/Stripe flag topology blocker before authorizing a narrowly scoped additive compatibility batch
```

See `hotels-functional-rollout-runbook-20260907.md` for prepared artifacts and
strict execution boundaries. Nothing in that runbook was executed in production.
