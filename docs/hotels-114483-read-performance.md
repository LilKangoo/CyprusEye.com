# 114483 — three successor Admin reads

Local-only validation, predecessor HEAD `9ddd8907748d6d6cafc579f00c41dbdbf78c4982`.
No production connection, production SQL, push, deployment, or timeout change.

## Proven bottleneck

PG16.13, exact disposable successor fixture through 114482. `EXPLAIN
(ANALYZE, BUFFERS)` and transaction-local `track_functions=all` measured the
three existing RPCs, not mock implementations. The fixture is synthetic;
these are local timings, not a claim about future production latency.

| Original RPC | Execution ms | Shared buffer hits | Payment lineage calls | Lifecycle catalog calls |
| --- | ---: | ---: | ---: | ---: |
| shadow preparation state | 3076.507 | 447910 | 16 | 62 |
| pricing activation Get | 4317.717 | 613054 | 22 | 88 |
| legacy promotion Get | 5445.014 | 786098 | 28 | 113 |

Repeated payment checks inspect the same payment policy/terms/activity chain
and `pg_proc`, `pg_policy`, `pg_depend`, `pg_constraint`, and `pg_trigger`.
Repeated lifecycle/lineage catalogs re-hash sources/definitions and inspect
ACLs, columns, constraints, policies and triggers. Predecessor-source reads
occurred 9864/13541/17503 times. Allocation was recomputed 30/45/59 times.
The legacy promotion wrapper additionally builds the activation snapshot.
No missing-index claim or index change is made: redundant graph evaluation
is the independently reproduced cause addressed here.

## Narrow additive boundary

All existing functions, applied migration files and historical receipts remain
unchanged. Three new public GET names append `_114483` to the existing names.
The frontend changes only these three read mappings. Mutation RPC mappings
are unchanged. There is no automatic fallback or retry. **Install and verify
114483 before releasing this frontend mapping.** Neither action is performed
by this local checkpoint.

The new private schema compiles 29 context-aware read bodies from exactly
pinned predecessors. Substitutions change only executable dependency calls;
quoted SQL/source manifests are untouched. Source hashes, full definition
hashes and security metadata are required before any compilation. Each source
span and resulting body SHA is checked. Original search paths are preserved:
changing deparser search paths was explicitly rejected in the disposable
prototype because it changed exact catalog comparisons.

Up to 45 STABLE scalar dependencies are evaluated once, in dependency order,
per invocation. A PL/pgSQL-local JSONB context holds their values. Each
evaluation is forced by a MATERIALIZED CTE. SQL NULL is separately tagged
from JSON null. Arrays, numeric values, strings and booleans are not coerced
into a different semantic type. Every original branch/comparison remains in
the compiled bodies. Public entry points authenticate before evaluation;
private schemas/projectors cannot be executed by browser roles. Foreign Hotel
requests use the original authorized behavior, never the 7 Arches context.

There is no persistent result cache, GUC cache, temporary table, session
state, timestamp exemption, timeout override or omitted protected predicate.
STABLE evaluation uses the current statement's MVCC snapshot. The new
certificate pins both predecessor and compiled function/security metadata;
it is not a cache of current business-state safety. Current receipts, flags,
prices and other business rows are read on every request.

The private projectors let a privileged human SQL Editor run the read-only
gates without impersonating an Admin or exposing snapshot tokens. Public RPC
authorization remains separate and mandatory.

## Final focused local results

| RPC | Before wall ms | Successor wall ms, three samples |
| --- | ---: | --- |
| shadow | 3195.062 | 383.932, 382.051, 379.209 |
| activation | 4286.297 | 367.616, 368.852, 373.466 |
| legacy promotion | 5594.468 | 397.699, 389.365, 397.865 |

Complete parsed DTO equality includes the existing snapshot tokens, not just
selected display fields. Successor shadow remains `SUCCESSOR_ALREADY_COMPLETE`
with mutation false. Independent authority remains 54 rows, 27 per room;
parity is 100/0 and guest-one 20/0. EUR10 commission and payment lineage pass.
All protected business-row hashes remain unchanged.

SQL regression: 29 checks pass, including deterministic recompilation,
source/security drift, private context denial, unauthorized actors, tier and
inventory drift, immutable certificate protections, install/replay behavior,
and a real rollback-only audited Rooms-ON transition immediately reflected
as BLOCKED by the next read. No stale cross-request result survives.

Focused Jest: 40/40, three suites. Mocked successor/activation Playwright:
6/6. The additional historical H3.1P legacy-promotion test fails at line 3030:
it looks for `[data-seven-kamares-pricing-promotion-card]` inside the Rooms
panel, where the current UI no longer renders it. The EXACT same failure
was independently reproduced on clean predecessor HEAD `9ddd8907748d6d6cafc579f00c41dbdbf78c4982`
in `/private/tmp/hotels-114483-baseline.N3jnAS`, with the original test and
original RPC mappings. Commands: `PORT=3198 ./node_modules/.bin/playwright test
tests/e2e/admin-hotels-v2-h2a-workspace.spec.ts --grep 'H3.1P reviews exact legacy
pricing parity' --workers=1`, exit 1; expected text `Legacy pricing Review
unavailable`, actual `element(s) not found`. The human subsequently authorized
this one baseline exception subject to an independent final comparison.
That comparison ran once on clean predecessor checkout
`/private/tmp/hotels-114483-final-baseline.qHdeML` and once on current WIP:
both exited 1 at line 3030 with the same absent card, expected text and
5000 ms timeout. The assertion block is byte-identical (SHA-256
`4f10064dfbc9436c7d0939dcdaf477862bf29f94e17ea1df16999af6ff889b91`).
The historical assertion was not edited. Its only existing WIP changes are
two read-RPC name mappings. The exception is therefore verified and accepted.

The final focused current successor UI test passes: `SUCCESSOR_ALREADY_COMPLETE`,
`2 apartments prepared`, `Successor configuration verified`, no historical
Prepare or Save mutation. The previous broader mocked run was 6/6; the final
rerun deliberately covers only this current test and the one baseline test.
Final SQL rerun: 29/29, including 3/3 performance/semantic comparisons.
Final Jest rerun: 40/40 across three suites. Final timings below are local
wall-clock measurements; successor values are medians of three executions.

| RPC | Final before ms | Final successor median ms |
| --- | ---: | ---: |
| shadow | 3430.559 | 398.318 |
| activation | 5334.006 | 451.594 |
| legacy promotion | 7505.613 | 485.958 |

The narrow performance change does not redesign the historical test.
The verified exception permits the separately authorized local-only commit.
Normal frontend build passes; only the corresponding repository dist mirror
changes. Historical migration freeze is 244/244; owner preflight is preserved.

Preaction: 9 boolean rows. Postinstall: 10 boolean rows. Both run under READ
ONLY / REPEATABLE READ and end with ROLLBACK. The postinstall business hash
compares against installation state and intentionally fails closed if any
business row changed before the human runs it; it is not used as a runtime
cache or as a substitute for the current safety graph.

No production runtime success is claimed. Next authorized human action is
reviewing and running the preaction file, not installing or enabling anything
automatically.
