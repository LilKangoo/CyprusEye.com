# Final successor checkpoint audit

This document records repository-only preparation. The canonical detached manifest
contains the final commit, every changed path/classification/hash, seven migration
identities and unchanged verifier dependencies. No production inspection or SQL
execution took place during this checkpoint task.

## Why each future migration must change

### 114420 — two prerequisite pins only

Objects: `hotel_v2_seven_arches_independent_pricing_topology_is_exact()` and
`hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()`.
BEFORE: source pins c93374ec… and e895de1e… require unreconciled 114415 functions.
AFTER: exact 114416 pins 8657d02b… and b3693dea….
No function body, pricing, booking, lock, timeout or ACL change in this migration.
Without these two replacements, the exact prerequisite rejects the authorized
114416 definitions before installation. No alternative broad acceptance was added.

### 114450 — exact provider successor of the reconciliation anchor

Objects: installation guards; provider lineage bridge; ADMIN-D foundation snapshot;
independent pricing topology; reviewed pricing receipt chain; successor receipt.
BEFORE: v1 live owner-preset equality and unreconciled source/catalog pins, with
provider-bridge fallbacks patched into catalog/topology checks.
AFTER: exact audited permission evidence under the immutable 114416 anchor;
scoped/topology/chain prerequisite pins 196c9b7f…/8657d02b…/b3693dea…;
prior catalog bound to 114416 evidence; retained provider attribution normalization;
low-level predecessor projection instead of obsolete catalog/topology fallback
patches. Resulting topology 9c891fee… and provider bridge d5715bd2… are pinned.

The fixed 24-binding 114450 successor certificate is sealed before high-level
final checks. The bridge's already-intended private ACL is established before
sealing, preserving the final ACL while rejecting transient PUBLIC execution.
Otherwise the strict 114416 raw function map would reject the legitimate provider
evolution, and accepting it by calling the provider composite would recurse.
The original receipt, audit-chain, Property, payment, commission and pricing checks
remain; neither a historical receipt nor the live permission row is rewritten.

### 114480 — second finite successor, not reuse of the first certificate

Objects: exact pre/post stage guards and four existing lifecycle manifest entries:
pricing scoped lineage, ADMIN-D current foundation snapshot, reviewed-pricing
receipt chain, and provider lineage bridge. The full old/new source and definition
pins are in `hotels-114416-successor-pin-manifest.json` and the fixed SQL manifests.
The receipt-chain patch count changes 16→15 because the predecessor projection
already replaced that source seam; three obsolete cache patches against removed
provider fallback expressions are removed. All other manifest entries remain exact.
The fixed 31-binding 114480 certificate links to 114450 before final checks.
Without this second certificate the raw map correctly rejects lifecycle evolution.
No new lifecycle decision, flag enablement or unrelated caching policy is introduced.

114425, 114460 and 114470 are unmodified. UNRELATED_MIGRATION_CHANGES=0.

## Non-recursion and immutable chain

Rejected path: pricing_scoped_lineage → current_anchor_is_exact →
external_calendar_provider_lineage_bridge_is_exact → pricing_scoped_lineage.
The final anchor uses raw catalog/source evidence and finite private manifests,
never the provider composite. A low-level lifecycle catalog closure is pinned
before invocation. Accepted graph: 53 functions, zero scoped cycles, zero unresolved
dynamic SQL. Accepted runtime: scoped calls=1, provider bridge calls=0.

Historical receipts → 114416 reconciliation receipt → 114450 successor receipt →
114480 successor receipt. The latter contain exact prior hashes, fixed source,
definition and metadata bindings, and immutable security topology. No earlier
receipt is updated. Replay and unknown stage fail closed.

## Validation provenance and limits

All 25 accepted WIP inputs and seven migration files are byte-identical to the
tested candidate. Reused: PG16.13, two forward chains, stage matrix, 17/17
reconciliation negatives, 67/67 successor security negatives, 3/3 replay/stage
negatives, physical representation 2 positive/1 negative, PostgREST safe reads,
39 focused Jest passes (one documented optional legacy-artifact skip), and build.
The post-114416 114420 gate remains the tested exact file: 126/126 leaves, ready=true,
blockers=[], 127 output rows. No frontend changes; no build rerun.

New package-only checks: offline Node static tests and PostgreSQL/PLpgSQL parser
validation of four read-only wrappers. They produce one final safe result table
each, use READ ONLY / REPEATABLE READ, end ROLLBACK, and add no timeout override,
mutation-grade lock or mutation RPC. These wrappers have not been executed on a
database. Runtime evidence applies to their unchanged protected helper contracts.

The previously reported 231-file freeze is retained as historical proof input,
not repeated as the final count. This audit independently includes legacy 9991–9994:
235 repository files, 233 distinct version strings, all unchanged from main.
Live production ledger count was not queried. Owner preflight and primary worktree
remain outside this clean branch and are preserved byte-for-byte.

Performance: 33.705491s was 114470 install, not 114416; worst separate verifier
38.103684s. No timeout changes. Local observed margin remains valid for the same
bytes; current production maintenance and recovery confirmation are future gates.

The user-confirmed recovery point remains valid on supplied evidence, but must be
reconfirmed before any separately authorized write. Start with 114416 prewrite,
never skip directly to 114420. Do not push, merge, deploy or execute this package
on the basis of a local checkpoint alone.
