# Exact successor contract — local proof

No production installation is authorized by this document.

## Directed dependency graph and rejected cycle

The complete installed 53-function graph, including CALLS, CALLED_BY, receipt
reads, catalog reads and scoped re-entry classification, is in
`hotels-114416-successor-dependency-graph.json`. Literal dynamic SQL is traced;
PostgreSQL's 63-byte identifier truncation is accounted for. Unresolved dynamic
SQL in the selected closure: zero.

Rejected, never-installed edge:

```text
public.hotel_v2_seven_arches_pricing_scoped_lineage()
 → hotels_lineage_private.current_anchor_is_exact()
 → [REJECTED] public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()
 → public.hotel_v2_seven_arches_pricing_scoped_lineage()
```

The graph test inserts that edge in memory and detects re-entry. It never
installs a recursive function. The real graph has no scoped-lineage cycle.

## Non-recursive validation boundary

```text
scoped lineage
 → current_anchor_is_exact
   → successors_are_exact
     → fixed successor_manifest
     → raw successor/provider/lifecycle receipt rows
     → predecessor (raw pg_proc and exact metadata, hashes only)
     → pinned lifecycle catalog_snapshot → pinned metadata/hash
   → function_map (virtual predecessor hashes, exact current metadata)
   → private catalog_fingerprint (raw catalog; predecessor definition hashes)
   → exact permission/audit evidence and immutable historical receipt hashes
```

The read path never invokes provider_bridge, provider_safe, topology,
receipt_chain, lifecycle chain_state, Preview, Submit or Apply.
The catalog projector reads their definitions; reading code is not executing it.
The lifecycle projector's entire callable low-level closure is pinned before
invocation, including the exact invoker/definer and STRICT distinctions.

`seal_successor(integer)` is an installation-only private entry point. It may
validate the current anchor after inserting a certificate; the anchor cannot
call it. All helpers and receipt tables are postgres-owned, RLS protected where
applicable, and unavailable to browser/service roles.

## Finite BEFORE/AFTER contracts

`hotels-114416-successor-pin-manifest.json` lists all 55 exact entries:
24 for 114450 and 31 for 114480, spanning 49 distinct signatures.

Each entry includes BEFORE/AFTER SHA-256 of prosrc and pg_get_functiondef,
plus exact owner, language, function kind, definer, volatility, strictness,
leakproofness, parallel state, return-set state, configuration, ACL and effective
execution privileges. Only the explicitly manifested 114450 Partner external
Apply SQL → PL/pgSQL language evolution changes metadata.

The projection processes certificates newest-first (114480 then 114450),
requires each actual AFTER source/definition/metadata to match, and projects
only its fixed BEFORE hashes. Unknown source, metadata, binding, stage or
catalog state fails closed. Every manifested current function is validated,
including worker seams outside the historical pricing catalog.

## Immutable linked receipt model

```text
unchanged 114360 / 114410 / 114415 historical receipts
 → 114416 reconciliation receipt (audited permission delta + exact catalog)
 → 114450 successor receipt (previous_hash = reconciliation evidence_hash)
 → 114480 successor receipt (previous_hash = 114450 receipt_hash)
```

Each successor also validates its corresponding provider evolution receipt or
lifecycle foundation/bindings. Self-consistent tampering does not suffice:
bindings must equal the static source manifest. Missing/reordered/skipped
certificates and replay are rejected. No historical receipt is resealed.

## Mathematically necessary undeployed changes

| File/stage | Direct dependency adjustment |
|---|---|
| 114420 | Two exact predecessor source pins only (topology and reviewed chain). |
| 114450 | Exact 114416 predecessor pins/catalog; replace obsolete historical fallback fragments with receipt-bound projection; retain exact audited permission v2 in ADMIN-D; seal fixed successor before composites. Establish its already-required private bridge ACL before sealing. |
| 114480 | Four changed BEFORE/AFTER source entries and their exact patch sites/counts; remove three obsolete caching replacements for fallback fragments no longer present; seal the second successor atomically before final checks. |
| Provider preflight/verify | Direct source/catalog predecessor pins only. |
| New post-reconciliation 114420 preaction | Original 109 scalar conditions retained; two evolved source pins; three additional exact reconciliation conditions. |
| Two existing static tests | Update only assertions directly tied to the changed future 114420/114450 source/file pins. |

114425, 114460 and 114470 remain byte-identical. Applied migrations through
114415 remain byte-identical. No application or frontend changes.

### Key source-pin cascade

| Function | 114415 | after 114416 | after 114450 | after 114480 |
|---|---|---|---|---|
| scoped lineage | 5d8e3118… | 196c9b7f… | unchanged | 11f6a865… |
| reviewed receipt chain | e895de1e… | b3693dea… | 92745114… | ca914b81… |
| topology | c93374ec… | 8657d02b… | 9c891fee… | unchanged |
| ADMIN-D snapshot | 2ed412e4… | unchanged | d5fc70d1… | 677c8fba… |
| provider bridge | absent | absent | d5715bd2… | 93cfd999… |

Full hashes and metadata are in the machine-readable manifest and migration.
Old hashes retained inside 114416 are explicit predecessor evidence; earlier
applied-phase preflights/verifiers remain frozen-phase references, not current
post-reconciliation authorities. No mixed stale authoritative pin remains in
the changed future-stage paths.

## Proof and performance

- Physical same-constraint PostgreSQL deparse under two search paths: 2/2
  qualification positives; semantic predicate mutation rejected.
- Reconciliation fault tests: 17/17; successor faults: 67/67; replay/unknown
  successor stage: 3/3; fault-injection rows preserved 110/110.
- Runtime: one scoped call; zero provider-bridge calls in the adapter path.
- Post-114416 preaction: 126/126, ready=true, blockers=[] (read-only).
- Fresh full chain through 114480 passes; explicit stage matrix checks lineage,
  topology, receipts, activation-safe, 100/0 parity, 20/0 guest-one, allocation,
  EUR10 commission, payment lineage, 54 authority rows and legacy architecture.
- Flags retained: rooms=false, external=true, instant=false, stripe=false.
- Local PostgREST authenticated read-only Gets: 69.458ms / 22.005ms, HTTP200;
  anonymous Admin request HTTP401; no Preview/Submit/Apply.
- Measured local installations: 114450 19.637s; 114460 16.076s;
  114470 33.705s; 114480 installation plus verifier 27.102s.
  Slowest separate read-only verifier across both final runs: 38.104s.
  The explicit seven-stage matrix also passed on a second fresh clone.
  All below 60s without a timeout
  change. These are synthetic-fixture measurements, not production SLA claims.
- Focused Jest: 39 passed, one pre-existing optional legacy-artifact test skipped.
  Build passed; frontend/dist unchanged.

Next step is human package/hash review, not production execution.
