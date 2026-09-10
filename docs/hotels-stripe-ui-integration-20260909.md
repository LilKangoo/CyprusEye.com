# Stripe Admin / Partner final local completion — 2026-09-10

This report supersedes the earlier WIP blocker report. Production was NOT accessed.
The user-reported production boundary remains 114480; 114481 is local-only and must
pass its human-run preactivation gate before any separately authorized installation.

## Source and scope

Branch: codex/hotels-stripe-ui-final-integration.
Checkpoint parent: 4f73589177a70d23cbafd52a0549495f83401737.
No push, main merge, deployment, Stripe call or production operation is authorized.

Historical completion files from the earlier 114480 task are preserved separately:
docs/hotels-admin-partner-completion-20260909.md,
supabase/manual/hotels_v2_admin_partner_completion_preactivation_readonly.sql,
supabase/manual/hotels_v2_admin_partner_completion_postactivation_readonly.sql,
tests/integration/hotels-v2-admin-partner-completion-static.mjs.
Those older gates are NOT the new 114481 handoff.

## Minimal successor

20260811448100_hotels_v2_stripe_readonly_dto_successor.sql adds a private,
immutable successor certificate and exact BEFORE/AFTER source bindings.
Only six existing functions evolve: Admin authorization Get, private Partner
connection DTO, lifecycle catalog_snapshot/predecessor_source and lineage
predecessor/successors_are_exact. The public Partner workspace signature/body
and all mutation RPCs remain unchanged.

The historical lifecycle/reconciliation receipts and original bindings are not
rewritten. Projection authenticates exact live source+metadata before returning
the historical representation. New helper source and relation topology are
checked, including explicit kernel pins and rejection of an emptied assertion
function through the public Admin Get. Private helpers have no browser/service
EXECUTE or schema access.

Admin receives account_exists and an enumerated account_status, never account_id.
Partner receives platform_ready and MISSING/NOT_READY/STALE/READY.
Ready means the latest attestation has the existing contract version, ready=true,
and is newer than 15 minutes. Exactly 15 minutes is STALE. No at-rest business
column, account, authorization, feature flag or money-routing change is made.

The existing can_connect server field remains its scope decision; UI additionally
requires the explicit fresh readiness fields before showing Connect. Old DTOs are
recognized without inventing readiness/account state: UNKNOWN, no Connect link.
Admin grant/revoke keeps fresh Get, reason, separate confirmation, one Set/no retry.

## Focused validation

Disposable PostgreSQL 16.13: /private/tmp/hotels-114481-local.wqm7wz, loopback port
55489. Closest existing 114416 fixture had historical source mismatches, so the
authorized existing synthetic fixture chain was replayed with committed source
authority before immutable receipts. The new exact baseline reached 114480,
anchor=true, public booking=false and payment lineage=true.

Targeted SQL/PostgREST gate: 54/54 PASS, including installation/replay,
predecessor history/security rejection, exact DTOs, role/Partner/Hotel denial,
readiness boundaries, five account states, source/ACL/RLS/trigger/kernel drift,
immutable certificates and complete rollback of synthetic probes.
Real loopback PostgREST returns 200 for authorized read RPCs and 403 for rejected
Admin/Partner reads. Its ephemeral test process exits after the gate.

Jest: 88/88 PASS in five relevant suites.
Playwright: 12/12 PASS, including real Admin renderer/binder with mocked Get/Set
and all Partner readiness states. No external service calls.
Build: PASS. Four source/dist mirrors: PASS.
Baseline CSS test now pins the authoritative source/build 20260831_2 release,
including the two already-updated Admin scripts. The guest test runs the actual
renderer in PL/EN/HE for null, undefined, zero and six; table labels and mobile
omission preserve the approved presentation without inventing guest counts.

## Human handoff and containment

Only the new compact READ ONLY files are relevant:
- hotels_v2_114481_preactivation_readonly.sql: 12 rows.
- hotels_v2_114481_postinstall_readonly.sql: 23 rows, BEFORE history repair.
Both have byte-identical /private/tmp copies and end in ROLLBACK.
They inspect pinned sources/security, not production user impersonation.
Cross-Partner runtime behavior is independently tested locally.

The postinstall certificate comparison checks every pre-existing table in the
protected schema families against its pre-install hash. This is a single opaque
comparison, not a new 500-row catalog audit; no row payload leaves the gate.
EUR10 commission has an explicit independent postinstall leaf.

242 historical migration files remain byte-identical. Owner preflight file/diff:
dad6e570779fac4519e3cfe67874357d1ccbf6fc549b62fab0378e765e304d62 /
ceaaace06ea57701cb8f99634d3468f851b38c1eaa8b3b41fc08cf8c35b20a54.

Stripe/public booking remain OFF. No automatic Partner grant.
No production account, Review, pricing, payment, booking or secret action occurred.
A local checkpoint is not permission to push, deploy, install SQL or enable Stripe.
