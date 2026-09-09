# 114416 reconciliation — local validation record

Base: `2d7277fba6edf75107b8a8835561dde260ec157c`.
Worktree: `/private/tmp/hotels-114416-lineage-reconciliation`.
This record does not authorize production execution. No production connection,
SQL, migration repair, commit, push, merge or deployment was performed.

## Proven divergence and scope

The user-proven, Admin-audited permission version 1 → 2 transition changes only
`initiate_stripe_onboarding` and `request_booking_changes` from false to true
for the same Hotel, Partner and assignment. The activity, action receipt,
outbox, actor attribution, before/after values and permission writer source
must agree. The immutable 114360 receipt is not rewritten.

The second accepted difference is only the recognized owner-membership
constraint's PostgreSQL qualification representation. The validator checks its
exact identity, metadata, validated state, structure, literals and actual
`extensions.digest(bytea,text)` dependency. It does not normalize arbitrary
catalog changes.

## Fixture fidelity

The fresh baseline installs the real historical 113700 permission writer before
workspace receipt capture. A real local Admin permission operation creates the
audited delta. The production-shaped variant uses the existing synthetic
Stage2F fixture, with a non-running fake cron table, and keeps external sync true.
It supplies EUR100/EUR100 to the real local activation before receipts exist,
then installs 114410/114415 with no reviewed-pricing mutations. No historical
receipt or current pricing row is rewritten to satisfy a test.

Before 114416: scoped lineage NULL, reviewed chain/topology/activation-safe false.
After 114416: all pass, and all 92 pre-existing protected relations are unchanged.
Replay fails at the exact boundary guard.

## Final candidate

Migration: `20260811441600_hotels_v2_seven_arches_authorized_lineage_reconciliation.sql`
SHA-256: `cc9eb2f619c4c710ea6dd792a86957a6dba41757cc8c0fced1369082b80a3881`
Lines: 724.

The predecessor projection returns hashes and exact metadata, never function
bodies to execute. Finite 114450 and 114480 manifests are sealed in the 114416
source. Each immutable successor receipt links its predecessor and the exact
manifest. The read path does not call the provider bridge or high-level
composites. See `hotels-114416-successor-contract.md` and the complete JSON
dependency graph and pin manifest.

## Completed evidence

- PostgreSQL 16.13, real local Vault/pg_net extensions; no worker invocation.
- Fresh local chain 114416 → 114420 → 114425 → 114450 → 114460 → 114470 → 114480 passes.
- Exact post-114416 preaction: 126/126 leaves, ready true, blockers empty,
  transaction read-only. All original 109 scalar conditions retained.
- 17/17 permission/catalog negatives; 2/2 qualification positives; 1/1
  semantic negative. Same physical PostgreSQL constraint produces both
  qualification forms under two search paths; both accepted.
- 67/67 successor negatives, including every one of 49 distinct manifested
  current functions; 3/3 replay/unknown-stage rejections.
- All 110 final protected relations unchanged after fault injection.
- 53-function static graph: no scoped cycle, no unresolved dynamic SQL.
  The in-memory rejected fallback test detects its cycle.
- Runtime transaction counters: one scoped call, zero provider-bridge calls.
- Loopback PostgREST: reviewed-pricing Get 200 (69.458ms); capability Get 200
  (22.005ms); anonymous Admin request 401. No Preview/Submit/Apply calls.
- Ten historical receipt tables and nine pricing/commercial/settings tables
  compare byte-exact as JSON rows between pre-reconciliation baseline and
  completed forward chain (19/19).
- Focused Jest: 39 passing, one existing optional legacy-artifact test skipped.
- Normal build passes, with no frontend/dist tracked diff.
- Applied migrations through 114415 remain unmodified.

The primary worktree remains untouched, including its existing `deno.lock`.
Owner-preflight file SHA remains
`dad6e570779fac4519e3cfe67874357d1ccbf6fc549b62fab0378e765e304d62`;
binary-diff SHA remains
`ceaaace06ea57701cb8f99634d3468f851b38c1eaa8b3b41fc08cf8c35b20a54`.

Historical backup evidence is external user input, not a new backup verification.
Any future production write requires separate human review of the final package,
current production preconditions and recovery coverage. No old diagnostic SHA
or earlier WIP SHA identifies this candidate.
