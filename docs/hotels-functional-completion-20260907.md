# Current Hotels functional package — clean checkpoint

Baseline: `c439ae465b66184179cf1abc86bc6a4275cc4ca2`.
Branch: `feature/hotels-functional-rollout-clean`.
This replaces the earlier branch-specific narrative with the current release scope.

## Included functionality

1. Partner-owned Standard OAuth connection, signed webhook reconciliation,
   actor-bound expiring single-use state, server-verified account association,
   sanitized six-state status and no automatic network retry.
2. Separate audited Admin authorization for Partner onboarding.
3. Audited global lifecycle for Rooms/Stripe, preserving legacy public architecture
   and separate disabled public-booking/Instant capabilities.
4. Admin and Partner lifecycle presentation, fresh state before an explicit
   decision, and read-only/unavailable behavior when future contracts are absent.
5. Offline, client, browser, schema-security, rollback, concurrency and forward
   chain regression coverage; no production execution authorization.

## Current main is authoritative

Admin Pricing keeps Select all, Clear all, Select changed, changed-selected-only
payloads, no-op feedback, single-flight Preview and bounded localized error
handling from c439ae. No historical Repository error patch replaces that behavior.
Apply is separate and never automatically retried.

Partner code retains main's booking presentation. The older extra booking-scope
copy and its historical assertion are not silently imported. Lifecycle/Stripe
additions remain unchanged. Existing independent Room pricing, 27/27 matrices
and proposal-before-Apply boundaries are validated locally.

## Deferred operations

No real account connection, live Stripe API, money-routing implementation, new
booking, pricing change, proposal or global flag change is authorized here.
Production was not accessed. The user-reported production boundary is 114415;
it was not re-queried during reconciliation. A feature Preview and human approval
are still required before any separately authorized rollout.
