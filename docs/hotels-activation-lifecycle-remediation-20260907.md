# Current lifecycle architecture — clean main-based checkpoint

Baseline: `c439ae465b66184179cf1abc86bc6a4275cc4ca2`.
Branch: `feature/hotels-functional-rollout-clean`.
This is a newly written current contract summary, not the earlier historical report.

## Independent decisions

- Installing 114460/114470/114480 does not enable a production capability.
- 114460 connects a Partner-owned Standard Stripe account, not an Express account
  per Hotel. Hotel use still checks Partner assignment and permission.
- 114470 adds a separate audited Admin grant per Partner. Installation and a
  global Stripe flag do not grant onboarding.
- 114480 adds separately confirmed global Rooms/Stripe decisions. Each uses a
  fresh version, reason and one mutation request. No automatic retry.
- Rooms means backend capability, not public booking. Public booking and Instant
  remain blocked by separate release contracts. External sync retains its
  independently reviewed lifecycle.
- Account connection does not decide payment routing, split settlement or fees.
  EUR 10 per allocated Room per rental night remains authoritative.

## Integrity and safety

The lifecycle seals 31 source/metadata contracts. It verifies actual current
definitions before projecting predecessor contracts for historical lineage.
Six STABLE validators reuse identical read-only inputs only within one invocation.
No persistent cache, BEFORE/AFTER sharing, dropped predicate or reduced lock set
is introduced. The accepted 60-second function timeout is unchanged.

The old 114360 owner preset remains immutable. New Partner grants do not rewrite
it. Permissions, global readiness, verified account status and Hotel authorization
remain distinct gates. Browser-supplied account identity is not trusted.

## Regression fixtures

`tests/integration/hotels-v2-activation-lifecycle-boundary-postgres-gate.sql`
and `hotels-v2-public-enable-boundary-diagnostic.sql` intentionally reproduce
pre-lifecycle rejection on synthetic local fixtures. Their direct flag probes
roll back. They are not production preflights and do not describe a remaining
post-114480 defect. Do not run them on production.

No SQL, pricing action, Stripe call, flag change or deployment was performed
during this source-control reconciliation.
