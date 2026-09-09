# Final successor-compatible 114420 postinstall verifier

This supplement starts from accepted checkpoint
`b2d814c61eaffc1ac7206d6a87598a9840ed2916` on
`feature/hotels-lineage-successor-final`. No migration bytes changed.

## Artifact and boundary

Canonical file: `supabase/manual/hotels_v2_114420_postinstall_readonly.sql`.
Manual byte-identical copy: `/private/tmp/hotels_v2_114420_postinstall_readonly.sql`.

SHA-256: `7fd15e2faf1e71649aa694a42c2ac516adbdca44267f982ed045460a777c51e1`.
450 lines; one result table containing 134 required leaves and one summary.
PASS means `POSTINSTALL_READY=true`, `blocker_codes=[]`, 134/134.

Run only AFTER physical 114420 installation and BEFORE its history repair.
The verifier requires 114416 recorded and 114420/114425/114450/114460/114470/114480
unrecorded. It is intentionally invalid after recording 114420.

Migration remains 1299 lines with SHA-256
`7026d08e220887f4f71553c3d7e53384f89b23bbc686ae3bd51a24e7b2aee879`.
No obsolete pre-114416 postinstall artifact was reused.

## Construction and safety

The offline builder retains final successor preaction dependency, pricing,
history and maintenance checks, replacing pre-install collisions with exact
post-install catalogs. Expected columns, constraints, foreign keys, indexes,
function metadata and triggers were read from the exact migration installed in
a disposable synthetic PG16 fixture. All ten new/replaced function bodies were
independently SHA-matched to the committed migration. Source files are parsed,
not executed, by the offline contract module.

The verifier uses BEGIN, READ ONLY, REPEATABLE READ, a catalog-stable search_path,
one SELECT and final ROLLBACK. No timeout override, DDL, DML, mutation RPC,
explicit relation lock, Preview, Submit, Apply or cleanup call is present.
All 120 fixed query_to_xml inputs parsed as individual SELECT statements, with
no data-modifying CTE, SELECT INTO, locking clause or mutating function call.
The remaining 14 leaves are exact successor dependency source/security pins.
Missing required objects or non-exact pinned helper sources fail closed.
SQL errors also stop the handoff; a missing result is never PASS.

The exact ten function catalogs include arguments, results, owner, language,
volatility, definer mode, configuration/search_path, full ACL/grantability,
effective privileges, strictness, parallel safety and source SHA. New table
security ignores only implicit/default owner ACL representation. New table
column sets, defaults, checks/FKs, and actual indexes are exact. The eight booking
columns, three checks and absence of unexpected constraints touching those
columns are checked separately. All four triggers and unexpected bridge triggers
are checked. No fixed guessed index names were introduced.

Partner Get source pins preserve manage_prices, Hotel/Partner/assignment scope,
owner membership handling, proposal isolation and workspace composite tokens.
No mutation RPC was called to prove rejection of a raw Admin-C token: the exact
Get and preserved Preview/Submit source contracts supply that static proof.
The live local read check independently compares Get's token to the workspace
token without printing either. Public quote/create source pins prove that the
Rooms V2 TRUE guard precedes writes; the current flag remains false.

## Fresh local validation (2026-09-09)

Only owned synthetic database `hotels_114416_successor_post420_20260909a` on
127.0.0.1:55479 was used. Real PG16.13 and loopback PostgREST were used; no
production connection, credentials, user data or HTTP endpoints were accessed.

The fixture was recreated from the accepted local baseline through 114415,
using equal EUR100 readiness rates and external sync true. The existing local
authorized permission transition and qualification prelude were applied, then
the real 114416 and exact 114420 migrations. No later migration was installed.

| Check | Result |
|---|---|
| 114416 local installation, preservation and replay rejection | PASS |
| 114420 local atomic install | PASS; approximately 1104 ms |
| Existing relation contents before/after install | 94/94 unchanged |
| Added quote/context/receipt rows and new priced bookings | 0/0/0/0 |
| New postinstall before history recording | 134/134; 135 rows; approximately 1101 ms |
| 114416 anchor/historical receipts/scoped lineage | PASS |
| Reviewed receipt chain/independent topology/activation safe | PASS |
| Pricing | Upper EUR100 / Ground EUR100; 27/27 tiers; 54 authority rows |
| Parity / guest-one | 100/0 and 20/0 |
| Allocation / EUR10 commission / payment lineage | PASS |
| Flags / architecture | false/true/false/false; legacy; public booking disabled |
| Schema/security/history negatives | 21/21 fail closed |
| Partner reviewed-pricing Get | HTTP 200; 54 rows; composite token exact |
| Partner workspace Get | HTTP 200; exact four-argument contract |
| Anonymous / foreign Hotel / foreign Partner | 401/42501; 500/55000; 403/42501; fail closed |
| All read-only checks and rolled-back negative probes | 97/97 protected relations unchanged |
| Simulated local history recording, then same verifier | Expected FAIL only recorded_114420; 133/134 |
| Existing 114425 preflight after simulated recording | PASS; compatibility_preflight_v2 |
| Preview / Submit / Apply / quote / booking RPC calls | 0 / 0 / 0 / 0 / 0 |

The 21 transaction-rolled-back local negatives cover four non-owner grants,
grantability, column ACL, owner, RLS, FORCE RLS, extra policy, extra column,
nullability, default, missing check, extra index, disabled trigger, function
definer mode, search_path, function ACL, future schema and wrong history.
The full verifier is rerun after simulated recording to prove the before-repair
boundary. The unchanged 114425 preflight remains transaction-read-only; it ends
with its committed COMMIT and does not install 114425.

Two test-harness assumptions were corrected from committed source before final
PASS: workspace Get requires explicit date arguments; foreign Hotel is rejected
with source-defined 55000/HTTP500, not an authorization HTTP403. No verifier
comparison or migration was weakened to accommodate these test corrections.

Reproduction entry point:
`tests/integration/hotels-v2-114420-postinstall-gate.mjs`, with
HOTELS_RECONCILIATION_DB, HOTELS_RECONCILIATION_PSQL and
HOTELS_RECONCILIATION_POSTGREST pointing only to the disposable loopback fixture.
The harness refuses any database outside its explicit synthetic name prefix
and address. The fixture must start post-physical-install/pre-history-repair;
the harness finishes with 114420 recorded in its synthetic ledger.
The owned PostgREST process is stopped in finally; the owned database is
disposed after validation. No preserved cluster is stopped.

## Human handoff

Recovery evidence supplied by the human: 09 Sep 2026 05:37:22 UTC, COMPLETED,
PHYSICAL, Restore available. SQL does not prove backups or authorize writes.

Human reviews the new hash/package first. Physical 114420 installation requires
separate authorization. Then this verifier must pass before separately
authorized history recording. No push, merge, deployment, production SQL,
history repair or next-stage execution occurred during this task.
