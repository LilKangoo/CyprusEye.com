# Clean functional rollout runbook — prepared only

Baseline: `c439ae465b66184179cf1abc86bc6a4275cc4ca2`.
Branch: `feature/hotels-functional-rollout-clean`.
No push, merge, deployment, SQL or history repair is authorized by this document.

User-confirmed recovery point: **08 Sep 2026 05:38:06 UTC, COMPLETED,
Restore available**. POST_114415_RECOVERY_POINT_CONFIRMED=YES.
This is user evidence, not a fresh database inspection or write authorization.

## Required order and migration identity

| Stage | Filename under supabase/migrations/ | SHA-256 | Lines |
|---|---|---|---:|
| 114420 | 20260811442000_hotels_v2_seven_arches_application_pricing_bridge.sql | a047bf49ec88d24684139f2e831dd831de90e86ca53eded0405f5684d80082c4 | 1299 |
| 114425 | 20260811442500_hotels_v2_external_calendar_site_settings_compatibility.sql | d72c244840bd21a5c5e7e46f654c8b3a7466f80f1d18ebac3ca938ab43163ee5 | 306 |
| 114450 | 20260811445000_hotels_v2_external_calendar_provider_types.sql | b679b8f65200d345ce154ef99343f1488dbb93394b65dab9fbf1d17c16688c84 | 3016 |
| 114460 | 20260811446000_hotels_v2_partner_stripe_connect.sql | 1e94ad30e9ebdd4d4ca0318ba30c521f3e7e12af5443557f5dfaf06b9f438d14 | 248 |
| 114470 | 20260811447000_hotels_v2_partner_stripe_onboarding_authorization.sql | 7eda4c43fcd4374e30221a0c7d3606090a3414ba4f9d2cf27363474bba1875c0 | 265 |
| 114480 | 20260811448000_hotels_v2_audited_capability_lifecycle.sql | 90b7eadeb7486684865a9745b24a4dcb9bfaef8b04f61e1b6b0ddf4814335399 | 416 |

114470 needs the 114460 Partner account/service contract; 114480 follows the
provider and Partner permission contracts. None of these stages authorizes
public booking, Instant, Stripe configuration, account connection or Edge deployment.

## Verifiers

114420 uses the separately prepared temporary operator gates:
`/private/tmp/hotels_v2_114420_prod_prewrite_readonly.sql` and
`/private/tmp/hotels_v2_114420_prod_postinstall_readonly.sql`.
These ephemeral files must be rehashed and re-reviewed against the accepted
release before use; their existence or currency is not asserted by this rebase.

The remaining prewrite/postinstall files are under `supabase/manual/`:

| Stage | Prewrite | Postinstall |
|---|---|---|
| 114425 | hotels_v2_external_calendar_site_settings_compatibility_preflight.sql | hotels_v2_external_calendar_site_settings_compatibility_verify.sql |
| 114450 | hotels_v2_external_calendar_provider_types_preflight.sql | hotels_v2_external_calendar_provider_types_verify.sql |
| 114460 | hotels_v2_partner_stripe_connect_prewrite_readonly.sql | hotels_v2_partner_stripe_connect_postinstall_readonly.sql |
| 114470 | hotels_v2_partner_stripe_authorization_prewrite_readonly.sql | hotels_v2_partner_stripe_authorization_postinstall_readonly.sql |
| 114480 | hotels_v2_capability_lifecycle_prewrite_readonly.sql | hotels_v2_capability_lifecycle_postinstall_readonly.sql |

Inspect wrappers and exact source contracts before selecting an SQL Editor-ready
gate. Do not substitute local mutation fixtures for production read-only checks.

## Later execution boundary

After human checkpoint/Preview approval, obtain explicit authorization separately
for each migration. Verify exact release, project, migration history, source hashes,
current recovery point, and no blocking operation. Execute only one exact migration
with its committed transaction wrapper. Require atomic success and embedded checks.
Then separately authorized history reconciliation and the matching verifier follow.

Prepared history commands only; do not run as one script:

```sh
supabase migration repair 20260811442000 --status applied --linked
supabase migration repair 20260811442500 --status applied --linked
supabase migration repair 20260811445000 --status applied --linked
supabase migration repair 20260811446000 --status applied --linked
supabase migration repair 20260811447000 --status applied --linked
supabase migration repair 20260811448000 --status applied --linked
```

After each authorized repair inspect history and STOP for stage verification.
Any SQL error, ambiguous result, unexpected history, receipt, permission, payment
or commission drift means STOP. Never blindly retry or mark failed SQL applied.

## Separate Stripe / public release boundaries

Keep Stripe false during installation. Platform readiness attestation, global
Stripe enablement, Partner-specific grant and verified account connection are
separate decisions. Credentials, callbacks and webhook configuration require
separate authorization; no secret values are included here. No payment routing
is inferred. Public booking/Instant remain blocked; no customer booking is a
smoke test. Pricing Preview and proposal submission write Reviews and are not
read-only checks. Edge releases and live Stripe calls are not part of this checkpoint.

## Canonical manifest

The release artifact is the detached JSON manifest at
`/private/tmp/hotels-functional-rollout-clean-manifest-20260908.json`.
It enumerates every one of the 60 changed repository files with SHA-256 and line
count, the exact base and final commit. Keeping it outside its own input set avoids
an impossible self-referential file hash. Its SHA is supplied with the final report.
If the artifact is absent, regenerate it from the exact accepted commit and verify
all 60 paths before release. The old bd382df-based hash manifest is not authoritative.
