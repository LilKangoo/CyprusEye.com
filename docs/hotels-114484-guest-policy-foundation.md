# 114484 — reviewed Guest Policy foundation successor

Local-only work on predecessor `cf23005682b6bacc6df3c5644021189151d85403`.
No production connection, historical migration edit, frontend edit, push or deployment.

## Exact mutable set

The existing Admin Guest Policy RPC exposes Property `children_policy` and
`minimum_child_age`, and Room `children_policy_override` and
`minimum_child_age_override`. These are category A shadow guest metadata while
the property remains legacy/public booking disabled. Only the two **Property**
columns occur in the affected 114415 unrelated Hotel projection and are
normalized by this successor. Room override handling/validation is unchanged;
this migration does not introduce a Room-field exclusion.

Pricing, schedules, tiers, currency, capacity/allocation fields are category B;
legacy pricing/public booking behavior is category C; Hotel/Room identity,
architecture, feature flags and concurrency/version fields are category D.
None is newly excluded. The existing `pricing_tiers` and `updated_at` exclusions
remain exactly the predecessor's exclusions, not new mutable permissions.

## Reproduced failure and successor

At age 15 the current independent pricing graph passes. The real Admin RPC
15→16 returns, but COMMIT invokes the deferred
`hotels_admin_c_pricing_dependency_guard` →
`hotel_v2_admin_c_cross_domain_constraint_trigger()` →
`hotel_v2_admin_c_validate_cross_domain_hotel(uuid)` →
`hotel_v2_admin_c_validate_pricing_graph(uuid)`.
`pricing_activation_current_is_safe()` becomes false because reviewed pricing's
`unrelated_fingerprint` no longer matches the original foundation. Every other
ORACLE_COMMERCIAL leaf remains true. The transaction rolls back to age 15.

The new private immutable receipt retains the original 114415 receipt verbatim
and its SHA-256, the exact two-column mutable set, the original Hotel projection,
the normalized protected Hotel hash, pre-existing Guest Policy activity IDs,
source bindings, helper/security catalog and installation business hash.

The protected Hotel projection rejects every difference outside the approved
Property Guest Policy fields. Allowed changes must also form an exact chain of
existing Admin Guest Policy audit rows: original before-state, allowed delta,
valid policy, Admin actor/correlation, and current after-state. An unlogged direct
age change is rejected. No receipt is rewritten and no blanket TRUE bypass exists.
For historical pricing fingerprint verification only, the projector restores the
two original Guest Policy values in its returned JSON; it never writes Hotel data.
The current authoritative workspace continues reading the real current values.

The original current-state projector and its 114483 compiled counterpart receive
this one projection substitution. Seven provenance/metadata adapter functions
are evolved solely to attest exact BEFORE against pinned live AFTER definitions.
Their source, full definition and security checks are retained. No pricing,
allocation, parity, commission, payment or deferred-trigger predicate is removed.
The original receipt/current-safe validators and triggers are not rewritten.

## Focused proof

The loopback synthetic PG16 harness is
`tests/integration/hotels-v2-114484-foundation-gate.mjs` with
`HOTELS_114484_PSQL` pointing to local psql. It refuses non-loopback configuration.
Use a fresh `hotels_114484_test` at 114483 on port 55489. `--generate` emits the
migration; `--preaction` and `--postinstall` emit the compact read-only SQL files.
Generate the preaction from the clean predecessor fixture before installing.

Final local run: 28/28 checks. Preaction 12/12, postinstall 10/10; real reviewed
15→16 COMMIT and authoritative reload=16, then 16→15 COMMIT and reload=15.
All three optimized 114483 reads pass at age 16. Complete pricing-state equality
and per-table protected hashes pass at both ages. The latter allow only the two
guest metadata fields/updated_at and the two precisely identified Admin activity
rows; all other rows, including old receipts, bookings, payments and flags match.

Eighteen negative checks cover stale Review; forbidden price, schedule, tier,
commission, payment, flags, booking, public-booking and arbitrary Hotel payloads;
direct unrelated Hotel drift; unreviewed age change; old/new receipt UPDATE and
DELETE; bound function definition drift; and successor EXECUTE privilege drift.
Every failed transaction rolls back. Focused existing Guest Policy Jest: 3/3.
No Playwright is needed because no frontend file changes.

Installation itself performs zero business-row mutation. The postinstall is an
immediate installation gate: its business hash is intentionally not reusable
after a later authorized Guest Policy action creates audit rows.

Human rollout has NOT run. Preaction is read-only; installation and a later
production 15→16 smoke require separate human action/authorization.
