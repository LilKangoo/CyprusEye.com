# Audited Hotels capability lifecycle — local validation

> Historical functional-pass evidence before the latency checkpoint. The current
> migration identity, performance remediation, rerun results and complete scoped
> manifest are in `hotels-lifecycle-checkpoint-audit-20260908.md`. The former
> 57.066s sample and 882d091c migration hash below are BEFORE evidence only.

Scope: continuation of the approved missing global lifecycle stage, not public
booking activation or production rollout. Baseline
`bd382df5695e8e9dbcedcaeb2dad226377be28f6`, branch
`feature/hotels-admin-partner-functional-completion`. Production boundary 114415
is user-reported; production was not accessed. No commit, stage, push or deploy.

Final gate status: **LOCAL LIFECYCLE PASS**. The uninterrupted final forward gate,
final-source real PostgREST matrix and rollback-contained security matrix passed.
This is scoped lifecycle readiness, not public release or whole-platform approval.

## Root cause and exact rejection graph

`MISSING_FUTURE_ACTIVATION_STAGE`. Historical scoped pricing, independent
topology, Task2/Stage2, ADMIN-D foundation, Partner access and provider projections
pin the pre-public flags. Directly changing Rooms/Stripe makes that lineage
invalid. Changing the old 114360 Hotel permission would likewise invalidate its
immutable owner receipt. Neither is an authorized activation path.

114480 adds a new installation foundation and append-only versioned decision
chain. Each predecessor source projection requires the exact installed AFTER
source hash and owner/language/security/volatility/search_path/ACL contract,
then exposes the bound BEFORE definition only to the predecessor validator.
Unrelated functions remain unprojected. The manifest explicitly records 31
BEFORE/AFTER source contracts. It is not a copied production fingerprint or an
unconditional true validator. Real client DTOs report actual feature flags.

The complete new catalog is sealed, including source/metadata, role execution,
private relation identity/RLS/ACL, column types/defaults, constraints, policies,
triggers and 114470 dependencies. Decisions bind actor, request, reason, version,
before/after state, prior receipt hash and epoch timestamp. Existing eleven
foundation/evolution receipts remain byte-equivalent during transitions. The
trusted service-role server and privileged postgres are explicit trust boundaries.

## Meanings and independent decisions

| Capability | Meaning / supported transition |
|---|---|
| Rooms | Backend Rooms capability; explicit audited enable/disable. Does not publish Hotel architecture, change prices or activate customer booking. |
| External | Existing reviewed source/worker capability; current true is retained. Global toggling is unavailable here because it has a separate source lifecycle. |
| Stripe | Platform Standard Connect connection capability; explicit enable/disable. Enabling requires a recent server configuration attestation. Does not grant Partner permission, create/connect an account or route money. |
| Instant | False. Enable rejects `instant_booking_contract_not_installed`. |
| Public booking | Separate lifecycle contract, false. Both public quote and booking entry points require it in addition to Rooms. Enable rejects `public_booking_release_contract_not_installed`. |

One Standard account belongs to one Partner business and is reused across its
authorized Hotels. 114470 grants/revokes onboarding separately per Partner.
Owner membership and exact Hotel authorization are rechecked. Browser account
IDs are never trusted. Account state is server-derived; disconnected, incomplete,
connected, restricted/action-required/disabled remain distinguishable. Disabling
the platform does not delete the account or modify the Partner grant.

Public booking intentionally remains unavailable under this stage. A separate
future approved contract is needed for public release/instant confirmation and
new-customer-booking smoke. That is not permission to turn Rooms into a public
flag again. Booking history/backfill and payment-routing design remain deferred.
EUR10 per allocated Room/night and authoritative payment terms are unchanged.

## New artifacts

114470 remains unchanged, 265 lines:
`7eda4c43fcd4374e30221a0c7d3606090a3414ba4f9d2cf27363474bba1875c0`.
114460 is a required predecessor; the actual sequence cannot skip it.
114480 was unused after local 114470 in the inspected migration chronology.

`supabase/migrations/20260811448000_hotels_v2_audited_capability_lifecycle.sql`
has 410 lines, SHA-256
`882d091c7af603176e86bf64d7ca84a92b32a81e35f5f4f0f5827085c7a4a2ed`.
Install enables no flag, creates no Partner grant/account and runs no activation.
An existing lifecycle schema is a hard replay rejection.

| Read-only file under supabase/manual | SHA-256 | Lines | Result rows |
|---|---|---:|---:|
| hotels_v2_partner_stripe_authorization_prewrite_readonly.sql | 2aace5cfa94917d6fdecbd41693b51a0307550aea600bef8c390940158eea387 | 29 | 1 |
| hotels_v2_partner_stripe_authorization_postinstall_readonly.sql | 5f0b51adc88261428b2f859648b359e38a8ba729bc76e7f8eae350b76433cb50 | 72 | 1 |
| hotels_v2_capability_lifecycle_prewrite_readonly.sql | fe8192e10977fbd8bcf3006eb5665762444636c1a90bf9800ed842c0acaa5044 | 17 | 1 |
| hotels_v2_capability_lifecycle_postinstall_readonly.sql | 223a2cf62272d8876abe9d61538bcfb93c7dc1b50a8577a3288e761fb37acdc7 | 21 | 1 |

All four begin BEGIN, set transaction READ ONLY, use a bounded timeout, emit one
result set and end ROLLBACK. Installation postchecks require zero decisions;
they are not post-activation replay scripts. Production copies were not prepared
or executed. Any later production immediate gate must separately recheck current
history, backup, locks/jobs and exact accepted artifact hashes.

## Executed test evidence

- Jest: 80/80, six focused lifecycle/activation/reviewed-pricing/Partner suites.
- Playwright: 108/108, four Admin/Partner/calendar/Stripe suites. Ten dedicated
  lifecycle cases include explicit confirmation, lost response, stale version,
  four Rooms/Stripe states, permission denial, incomplete/connected/restricted.
- Local Stripe mock/static: 21/21; real Edge-handler offline configuration
  attestation: 10/10 (Admin/auth/origin/mode/webhook/browser-value negatives);
  real SDK signature-only Deno: 1/1 cached, zero external API calls.
- Admin lifecycle uses a fresh Get and exactly one explicit decision RPC. Lost
  responses are not retried; stale state sends zero writes. Pricing Preview,
  pricing Apply and generic pricing mutations remain zero in lifecycle tests.
- PostgREST matrix: 24 negative outcomes, one concurrent winner, four versioned
  decision receipts, zero transaction context. Rooms and Stripe each enable and
  disable; global Stripe does not create a grant/account. Separate 114470 grant
  precedes a service-only synthetic connection, no Stripe API. Public calls fail
  before bookings; business/eleven-predecessor-receipt hash remains unchanged.
- Current reviewed pricing oracle is 100/0 and guest-one 20/0; allocation true.
  The older independent oracle reports 7/2 differences in this fixture because
  its accepted 114415 price-evolution test data already changed tiers. The current
  reviewed oracle, not obsolete initial prices, is authoritative. Lifecycle
  before/after complete business hashes remain equal.
- Final source schema/owner/ACL/grantability/default/source security and direct
  flag/receipt DML negatives: **26/26 PASS**, each subtransaction rolled back,
  including after the four lifecycle decisions; complete outer ROLLBACK.
- Uninterrupted 114420 → 114425 → 114450 → 114460 → 114470 → 114480: **PASS**,
  `HOTELS_CAPABILITY_FULL_FORWARD_CHAIN_PASS`. Both 114470 and 114480 manual
  prewrite/postinstall gates passed in READ ONLY and ended ROLLBACK.
- Final source PostgREST matrix: **PASS**, 24 denied outcomes, one concurrent
  winner, four audit decisions, no leaked context or business changes.
- Actual loopback lifecycle/Partner DTOs and pricing lifecycle envelope validate
  in both source and dist parsers. The complete historical SQL pricing DTO still
  fails the pre-existing frozen seed hash check (`5ef5f181…`, already present in
  the unmodified 114415 template, versus the production-client `7208ab4e…` pin).
  The read gate explicitly expects that refusal; no source/data pin was changed
  to hide it. Full accepted-price DTO parsing is covered by the canonical client
  fixtures in Jest/E2E. This is not evidence of a live production discrepancy.
- Normal build PASS. Three Admin dist assets match the normal Terser output;
  Partner core/workspace/Stripe page mirrors are byte-identical source copies.

Local setup: PostgreSQL16.13, real Vault and pg_net extensions, loopback55479;
PostgREST12.2.12, loopback53079. Only synthetic fixture databases are used. The
preserved PostgreSQL40407 cluster on55463 was not stopped or modified.

One fixture setup initially encountered an already-present synthetic coupon
trigger/function, fixed only in the isolated test setup. Another local migration
read was interrupted by editing its input file: the transaction rolled back.
The uninterrupted final gate uses fixed inputs; no production or historical
migration change was used to resolve either fixture issue.

## Runtime budget, not a global timeout change

Profiling a provider-safe check showed repeated accepted validations, including
187 payment-lineage calls and 608 lifecycle catalog checks. Protected before/after
maps were retained. Final explicit global Admin transitions measured 48.913,
57.066, 47.153 and 46.052 seconds in the synthetic chain. This new RPC alone
declares statement_timeout=60s;
search_path, authorization and all checks remain. No function-level lock_timeout
was introduced, and database/role configuration was not changed.

A separate ordinary synthetic RPC with no exemption canceled with57014 at
8032ms under an8-second loopback connection default (earlier control8072ms). The real Admin decision
completed under the same connection default. The test-only probe was dropped.
Any future busy production window is still a stop condition, not grounds for an
automatic retry or removing validation. No production performance claim is made.
The57.1-second observed maximum leaves limited headroom: measure the later
read-only production prerequisites under a controlled maintenance window and
do not interpret local PASS as an unconditional production timing guarantee.

## Freeze and release boundary

All238 tracked migrations have no diff, including114400/405/406/407/410/415 and
undeployed114420/425/450. Owner preflight remains excluded and untouched:
fileSHA `dad6e570779fac4519e3cfe67874357d1ccbf6fc549b62fab0378e765e304d62`,
binarydiffSHA `ceaaace06ea57701cb8f99634d3468f851b38c1eaa8b3b41fc08cf8c35b20a54`.

No local commit/stage, push, merge, deployment, production access, production
SQL, real Stripe, credential extraction or live flag/action occurred. The
pre-existing functional WIP is preserved and must receive a scoped checkpoint
audit before any release. Do not interpret lifecycle PASS as completion of every
historical Hotels feature or authorization for public bookings.

Next human step: review the scoped local diff and release runbook, then authorize
checkpointing separately. Production needs a clean accepted release, fresh
user-confirmed recovery point and separate stage-by-stage authorization.

The task-owned loopback PostgREST was stopped after validation. Four intermediate
synthetic global databases were removed; they can be regenerated from the
preserved predecessor fixture and committed/WIP gates. Final synthetic database
`hotels_functional_global_verified_20260908` is retained on the existing local
55479 fixture for checkpoint audit, with four exact lifecycle decisions and no
public booking. No other database or preserved cluster was removed or stopped.
