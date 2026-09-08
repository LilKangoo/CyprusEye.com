# Canonical c439ae-based checkpoint audit

BASE_MAIN=c439ae465b66184179cf1abc86bc6a4275cc4ca2
CLEAN_BRANCH=feature/hotels-functional-rollout-clean

The first four clean commits are preserved:
0bfcdb01f917d7dc3cebdd5231379a62a41cedfe,
452149f2a7e6d8894d36bcdbdbe4a130d9abf9a0,
458559f4f90512bc708a9f4cc6b56bca45519103,
0d3314d14881bd8b4b24c49d5127c2757e991c8f.
A new fifth documentation/test commit replaces the conflicted old fifth commit.

## Old fifth commit hunk classification

All hunks of ddb49be are accounted for below; it is not cherry-picked wholesale.

| Old path under docs/ or tests/integration/ | Classification | Treatment |
|---|---|---|
| docs/hotels-activation-lifecycle-remediation-20260907.md | CURRENT_REPORT_REQUIRED | New current lifecycle contract summary; historical diagnosis not restored |
| docs/hotels-admin-partner-functional-completion.md | HISTORICAL_DOC_DEPENDENCY | Omitted entirely, including the five-line append and 171-line predecessor |
| docs/hotels-capability-lifecycle-validation-20260908.md | CURRENT_REPORT_REQUIRED, STALE_HASH_UPDATE | New evidence-boundary and exact current latency report |
| docs/hotels-functional-completion-20260907.md | CURRENT_REPORT_REQUIRED | New c439ae-based functionality/safety report |
| docs/hotels-functional-rollout-runbook-20260907.md | RUNBOOK_REQUIRED, STALE_HASH_UPDATE | New current release order, hashes and separate authorization boundaries |
| docs/hotels-lifecycle-checkpoint-audit-20260908.md | MANIFEST_REQUIRED, CURRENT_REPORT_REQUIRED, STALE_HASH_UPDATE | New audit and detached-manifest contract |
| tests/integration/hotels-v2-activation-lifecycle-boundary-postgres-gate.sql | TEST_REQUIRED | Exact local predecessor-boundary regression; not a production gate |
| tests/integration/hotels-v2-public-enable-boundary-diagnostic.sql | TEST_REQUIRED | Exact synthetic rollback diagnostic; not a current production blocker |
| tests/integration/hotels-v2-seven-arches-application-pricing-bridge-postgres-gate.sql | TEST_REQUIRED | Exact qualified-digest fixture and rollback-contained flag probes |
| tests/integration/hotels-v2-seven-arches-reviewed-pricing-postgrest-gate.mjs | TEST_REQUIRED | Exact fresh per-run IDs; replay probes retain those IDs |

The removed historical-report path is replaced, one-for-one, by
`docs/hotels-clean-checkpoint-reconciliation-20260908.md`.
This preserves a 60-file net scope without importing the old report.
The two ancestry-only paths (Admin pricing action report and Partner pricing
client test) remain byte-identical to main and are outside the checkpoint.

## Manifest and source preservation

The detached canonical manifest hashes the complete final 60-file tree, including
these newly written reports. No old hash is restored to force a match.
All 238 historical migrations remain byte-identical to main; all six rollout
migration hashes remain exact. Primary-worktree owner preflight and deno.lock
are excluded and preserved. No secrets or generated fixture output enter the commit.

The eight explained source/test/dist differences are recorded in the reconciliation
report with old/new hashes and semantic coverage. Main Admin Pricing feedback,
selection, no-op, single-flight and explicit Apply separation remain authoritative.

## Local validation

Validation results are finalized below before committing. Backend chain and
latency evidence may be reused only after byte comparisons; client regressions
are rerun on the clean source, not inferred from old test counts.

- TypeScript Jest compilation PASS. Focused Jest **54/54 PASS**, four suites:
  capability lifecycle, Admin Pricing, Partner Pricing and Workspace Help.
- Focused Playwright **101/101 PASS**, four suites: reviewed Admin/Partner pricing,
  Partner workspace, Admin availability and Stripe UI. Retries=0; synthetic fixtures
  only. Seven older Partner cases from excluded ancestry are not counted.
- Offline Stripe mock/static/platform-handler **31/31 PASS**, plus lifecycle
  latency static safety **1/1 PASS**; no live Stripe or database call.
- Normal build PASS on Node 22.17.1. All ten scoped source/dist mirrors match:
  four normal Terser outputs and six copied static files.
- Initial sandbox E2E startup was blocked by listen EPERM; the same local suite
  passed with the required local-server permission. No product code was changed
  to bypass that host restriction.
- All 522 Supabase files match the previously tested checkpoint exactly. Four
  selected integration tests also match exactly. The prior local PG/PostgREST
  forward chain and latency evidence are reused, not rerun or claimed as new.
- Full main Admin editor function is byte-identical. The eight source/test/dist
  hash differences are explained by the new baseline and normal build.
- Historical migrations: 238/238 unchanged. Excluded primary owner preflight
  file hash dad6e570779fac4519e3cfe67874357d1ccbf6fc549b62fab0378e765e304d62
  and binary-diff hash ceaaace06ea57701cb8f99634d3468f851b38c1eaa8b3b41fc08cf8c35b20a54
  are retained. No unrelated fixture, dependency symlink or deno.lock is staged.

No production access, SQL execution, Stripe call, push, merge or deployment.
