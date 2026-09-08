# Clean checkpoint reconciliation and exact scope

Base: `c439ae465b66184179cf1abc86bc6a4275cc4ca2`.
Branch: `feature/hotels-functional-rollout-clean`.

This is a new current report, not the 171-line historical document.
`docs/hotels-admin-partner-functional-completion.md` is absent.
`docs/hotels-admin-pricing-review-action.md` and
`tests/hotelsV2SevenArchesReviewedPricingPartnerClient.test.ts` are unchanged from main.
Their old ancestry is not imported.

## Explained old-manifest differences

The old bd382df-based manifest is evidence only, not the new source authority.
The new source hashes deliberately retain current main behavior.

| Path | Old manifest SHA-256 | New canonical SHA-256 | Reason | Semantic validation |
|---|---|---|---|---|
| admin/hotels-v2-workspace-repository.js | b87c36fb7c74ef048a669d7b7fe6addad797df31717d34cd58624cf7c8c4d918 | 8d2de2898b5e0b1528e1fc1931e674874a3082bbab88b7b9480b7d2fb51ad408 | Omit the historical four-line Review error override; current main Repository behavior plus approved lifecycle methods. | Lifecycle fresh-state/no-retry Jest; Admin error/single-flight E2E. |
| admin/hotels-v2-workspace.js | 17a19a0bea38fff5a2e21009f37be6211d6e9320691c8a3206686c3c4ab52dfd | 68d051bcf756f8b8385f52c8db7da0ce0bf81128d8aca91886c5805975d6b060 | Retain c439ae localized bounded error feedback; historical raw error handling is not restored. | Main Admin editor byte comparison; bulk/no-op/error/recovery E2E. |
| dist/admin/hotels-v2-workspace-repository.js | a8ef1ae770c43c21bd4e4316b7fea91cd87a414847b68b375ff445a45aa02a4d | e7c0b8599d05f149a8a3bb049dbc150410db6387ab0ea771e5b841fec1d0feb3 | Normal Terser build of the reconciled Repository, not the old minified blob. | Exact source/dist reproduction; corresponding source tests. |
| dist/admin/hotels-v2-workspace.js | 72b0d849a640a40cf56eec0b043b6168fec06dae20b222a6583f6b0a5046ca24 | 60011a739e059bfef8b1e441cc3745ac399eae54617b8a973df76f1366c57f10 | Normal Terser build of the reconciled Workspace with current main feedback. | Exact source/dist reproduction; corresponding source tests. |
| dist/js/hotels-v2-partner-workspace.js | 299b53d0965f7095eb10868d2ce84325548ce1e97a4c9d6b7f10fe71af022c13 | 928be7eedec7ca4620b338b4b94d3dbc451c579d94b0b92efe7f651a3bd9bc0a | Normal build copies the reconciled Partner source, not historical source. | Exact source/dist copy equality; Partner source tests. |
| js/hotels-v2-partner-workspace.js | 299b53d0965f7095eb10868d2ce84325548ce1e97a4c9d6b7f10fe71af022c13 | 928be7eedec7ca4620b338b4b94d3dbc451c579d94b0b92efe7f651a3bd9bc0a | Do not import older booking-scope copy from 323e932; preserve main presentation and approved lifecycle/Stripe additions. | Partner bookings, lifecycle matrix, six verified Stripe states and no implicit mutation E2E. |
| tests/e2e/hotels-v2-seven-arches-reviewed-pricing-ui.spec.ts | 1f932bed843587f73553afcf3d9185d8c2144a70ef54e7b4a890423d8f7c8d46 | 0f0f51fd77c3beeabb2bb38f82bdb53e11321954a94667284c4bbe18de64606f | Retain main error-feedback and explicit recovery assertions; omit seven older Partner cases absent from main. Approved lifecycle tests remain. | Full reconciled reviewed-pricing suite PASS; total four-file E2E 101/101. |
| tests/e2e/partner-hotels-v2-h3-2b-workspace.spec.ts | 29a28da863b97d354103b0dfc4c867f2e2fbe2c58484e073b8b0396e73417894 | ff7eddd276beeb3b6d44c3c96b2851e626d0bc77f8aa68f917153ed08e0371ca | Omit the two historical assertions absent from main; main tests plus approved lifecycle matrix remain. | Full Partner suite PASS; Stripe disabled/no-implicit-mutation cases remain separately covered. |

UNEXPLAINED_HASH_MISMATCHES=0. No lifecycle or Stripe executable hunk is removed.
Main's Admin editor, including bulk selection, no-op, single-flight and bounded
localized error handling, is compared byte-for-byte with its c439ae function.
No old hashes are forced by restoring stale code.

## Net scope: exactly 60 files

The old historical report is replaced one-for-one by this current report.
New detached manifest SHA-256 values are calculated after documentation and
validation are final. The manifest is external to its input files to avoid
recursive self-hashing. See the runbook for its exact artifact path.

| Path | Purpose |
|---|---|
| _headers | STRIPE_CONNECT_RUNTIME |
| admin/hotels-v2-workspace-core.js | ADMIN_UI |
| admin/hotels-v2-workspace-repository.js | ADMIN_UI |
| admin/hotels-v2-workspace.js | ADMIN_UI |
| dist/_headers | STRIPE_CONNECT_RUNTIME |
| dist/admin/hotels-v2-workspace-core.js | ADMIN_UI |
| dist/admin/hotels-v2-workspace-repository.js | ADMIN_UI |
| dist/admin/hotels-v2-workspace.js | ADMIN_UI |
| dist/js/hotels-stripe-connect-page.js | STRIPE_CONNECT_RUNTIME |
| dist/js/hotels-v2-partner-workspace-core.js | PARTNER_UI |
| dist/js/hotels-v2-partner-workspace.js | PARTNER_UI |
| dist/partners/stripe-connect-return.html | STRIPE_CONNECT_RUNTIME |
| dist/partners/stripe-connect.html | STRIPE_CONNECT_RUNTIME |
| dist/partners/sw.js | STRIPE_CONNECT_RUNTIME |
| docs/hotels-activation-lifecycle-remediation-20260907.md | DOC |
| docs/hotels-capability-lifecycle-validation-20260908.md | DOC |
| docs/hotels-clean-checkpoint-reconciliation-20260908.md | DOC |
| docs/hotels-functional-completion-20260907.md | DOC |
| docs/hotels-functional-rollout-runbook-20260907.md | RUNBOOK |
| docs/hotels-lifecycle-checkpoint-audit-20260908.md | DOC |
| js/hotels-stripe-connect-page.js | STRIPE_CONNECT_RUNTIME |
| js/hotels-v2-partner-workspace-core.js | PARTNER_UI |
| js/hotels-v2-partner-workspace.js | PARTNER_UI |
| partners/stripe-connect-return.html | STRIPE_CONNECT_RUNTIME |
| partners/stripe-connect.html | STRIPE_CONNECT_RUNTIME |
| partners/sw.js | STRIPE_CONNECT_RUNTIME |
| supabase/functions/hotels-stripe-connect/index.ts | STRIPE_CONNECT_RUNTIME |
| supabase/functions/hotels-stripe-connect/service.mjs | STRIPE_CONNECT_RUNTIME |
| supabase/manual/hotels_v2_capability_lifecycle_postinstall_readonly.sql | VERIFIER |
| supabase/manual/hotels_v2_capability_lifecycle_prewrite_readonly.sql | VERIFIER |
| supabase/manual/hotels_v2_partner_stripe_authorization_postinstall_readonly.sql | VERIFIER |
| supabase/manual/hotels_v2_partner_stripe_authorization_prewrite_readonly.sql | VERIFIER |
| supabase/manual/hotels_v2_partner_stripe_connect_postinstall_readonly.sql | VERIFIER |
| supabase/manual/hotels_v2_partner_stripe_connect_prewrite_readonly.sql | VERIFIER |
| supabase/migrations/20260811446000_hotels_v2_partner_stripe_connect.sql | STRIPE_CONNECT_SCHEMA |
| supabase/migrations/20260811447000_hotels_v2_partner_stripe_onboarding_authorization.sql | STRIPE_PARTNER_PERMISSION_114470 |
| supabase/migrations/20260811448000_hotels_v2_audited_capability_lifecycle.sql | GLOBAL_LIFECYCLE_114480 |
| tests/e2e/admin-hotels-v2-admin-d-availability.spec.ts | TEST |
| tests/e2e/hotels-v2-seven-arches-reviewed-pricing-ui.spec.ts | TEST |
| tests/e2e/hotels-v2-stripe-connect.spec.ts | STRIPE_CONNECT_TEST |
| tests/e2e/partner-hotels-v2-h3-2b-workspace.spec.ts | TEST |
| tests/hotelsV2CapabilityLifecycle.test.ts | TEST |
| tests/integration/hotels-v2-activation-lifecycle-boundary-postgres-gate.sql | TEST |
| tests/integration/hotels-v2-capability-lifecycle-client-postgrest-gate.mjs | TEST |
| tests/integration/hotels-v2-capability-lifecycle-forward-postgres-gate.sql | TEST |
| tests/integration/hotels-v2-capability-lifecycle-latency-postgrest-gate.mjs | TEST |
| tests/integration/hotels-v2-capability-lifecycle-latency-static-gate.mjs | TEST |
| tests/integration/hotels-v2-capability-lifecycle-postgrest-gate.mjs | TEST |
| tests/integration/hotels-v2-capability-lifecycle-security-postgres-gate.sql | TEST |
| tests/integration/hotels-v2-capability-lifecycle-timeout-postgrest-gate.mjs | TEST |
| tests/integration/hotels-v2-public-enable-boundary-diagnostic.sql | TEST |
| tests/integration/hotels-v2-seven-arches-application-pricing-bridge-postgres-gate.sql | TEST |
| tests/integration/hotels-v2-seven-arches-reviewed-pricing-postgrest-gate.mjs | TEST |
| tests/integration/hotels-v2-stripe-authorization-postgrest-gate.mjs | STRIPE_CONNECT_TEST |
| tests/integration/hotels-v2-stripe-connect-mock-gate.mjs | STRIPE_CONNECT_TEST |
| tests/integration/hotels-v2-stripe-connect-postgres-gate.sql | STRIPE_CONNECT_TEST |
| tests/integration/hotels-v2-stripe-connect-postgrest-gate.mjs | STRIPE_CONNECT_TEST |
| tests/integration/hotels-v2-stripe-connect-signature.deno.ts | STRIPE_CONNECT_TEST |
| tests/integration/hotels-v2-stripe-connect-static-gate.mjs | STRIPE_CONNECT_TEST |
| tests/integration/hotels-v2-stripe-platform-readiness-handler-gate.mjs | STRIPE_CONNECT_TEST |

Four integration tests from the old fifth commit are byte-identical; all reports
are newly written on the current baseline. Reconciliation modifies no migration,
backend/Edge source, price, payment contract or feature flag.
