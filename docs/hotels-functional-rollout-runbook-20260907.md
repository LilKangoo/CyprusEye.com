# Definitive lineage successor rollout package — prepared only

Base main: `2d7277fba6edf75107b8a8835561dde260ec157c`.
Branch: `feature/hotels-lineage-successor-final`, reconstructed directly from main.
The final local commit and every package hash are in
`/private/tmp/hotels-lineage-successor-final-manifest.json`.
This replaces the earlier six-stage runbook and its obsolete 114420/114450/114480 hashes.
No execution, push, deployment or history repair is authorized by this document.

## Exact dependency order and migration identities

114416 → 114420 → 114425 → 114450 → 114460 → 114470 → 114480.

| Migration path | SHA-256 | Lines |
|---|---|---:|
| supabase/migrations/20260811441600_hotels_v2_seven_arches_authorized_lineage_reconciliation.sql | cc9eb2f619c4c710ea6dd792a86957a6dba41757cc8c0fced1369082b80a3881 | 724 |
| supabase/migrations/20260811442000_hotels_v2_seven_arches_application_pricing_bridge.sql | 7026d08e220887f4f71553c3d7e53384f89b23bbc686ae3bd51a24e7b2aee879 | 1299 |
| supabase/migrations/20260811442500_hotels_v2_external_calendar_site_settings_compatibility.sql | d72c244840bd21a5c5e7e46f654c8b3a7466f80f1d18ebac3ca938ab43163ee5 | 306 |
| supabase/migrations/20260811445000_hotels_v2_external_calendar_provider_types.sql | 6151c12a14022e64f6e30421fca6646bc2a540cc111b399b88ac80934174a5d3 | 3029 |
| supabase/migrations/20260811446000_hotels_v2_partner_stripe_connect.sql | 1e94ad30e9ebdd4d4ca0318ba30c521f3e7e12af5443557f5dfaf06b9f438d14 | 248 |
| supabase/migrations/20260811447000_hotels_v2_partner_stripe_onboarding_authorization.sql | 7eda4c43fcd4374e30221a0c7d3606090a3414ba4f9d2cf27363474bba1875c0 | 265 |
| supabase/migrations/20260811448000_hotels_v2_audited_capability_lifecycle.sql | 2bce4cc9d2cef073acce9c416a2b6a5cd681cd24e100c5b1501ee276e3a173fa | 420 |

114425, 114460 and 114470 are unchanged from main. All seven are byte-identical
to the accepted local forward-chain candidate. Never substitute an earlier package hash.

## Human recovery-point boundary

Accepted human evidence: **08 Sep 2026 05:38:06 UTC, COMPLETED, Restore available**;
the user reports no subsequent production database writes. The recovery point
remains valid on that evidence, not on a new remote inspection.
Before any eventual write, the human must reopen Backups and reconfirm this or a
newer completed recovery point. Every stage requires separate authorization.

## 114416 operator handoff

All repository paths below are relative to this clean checkout.

1. Confirm exact release, project `daoohnbnnowmmcizgvrq`, accepted history through
   114415, recovery point and maintenance clearance.
2. Run only `supabase/manual/hotels_v2_114416_prewrite_readonly.sql` after separate
   authorization. It returns one row, sentinel `HOTELS_114416_PREWRITE_OK`, or
   fails closed. No tokens, private permission evidence or plans are returned.
3. After explicit install approval, use only `/private/tmp/hotels_v2_prod_114416.sql`.
   It is byte-identical to the 724-line committed 114416 migration. Add no wrapper;
   execute once in a new SQL Editor query. Require atomic COMMIT and embedded checks.
4. Run `supabase/manual/hotels_v2_114416_postinstall_readonly.sql` only with separate
   permission. Require one `HOTELS_114416_POSTINSTALL_OK` row, one reconciliation
   receipt, no successor receipts, exact sources/security/catalog and commercial state.
   It intentionally permits history to be unrecorded or recorded once.
5. Only after successful install/verification and separate authorization, record the
   exact 114416 version. Inspect history and STOP.
6. The ONLY current 114420 preaction gate is
   `supabase/manual/hotels_v2_114420_after_lineage_reconciliation_preaction_readonly.sql`.
   Run AFTER recorded 114416. Expected 127 rows: 126 required leaves PASS plus
   summary ready=true, blockers=[]. Earlier temporary pre-114416 gates are obsolete.

The four newly prepared read-only package verifiers were parser/static validated
only during checkpointing; no SQL was executed. Their invoked runtime predicates
are from the unchanged tested candidate. Their first production execution still
requires human authorization and a fail-closed result.

## Later stage verifier packages

Every listed file is under `supabase/manual/` and included in the detached manifest.

| Stage | Prewrite | Postinstall |
|---|---|---|
| 114425 | hotels_v2_external_calendar_site_settings_compatibility_preflight.sql | hotels_v2_external_calendar_site_settings_compatibility_verify.sql |
| 114450 | hotels_v2_external_calendar_provider_types_preflight.sql | hotels_v2_external_calendar_provider_types_verify.sql AND hotels_v2_114450_successor_postinstall_readonly.sql |
| 114460 | hotels_v2_partner_stripe_connect_prewrite_readonly.sql | hotels_v2_partner_stripe_connect_postinstall_readonly.sql |
| 114470 | hotels_v2_partner_stripe_authorization_prewrite_readonly.sql | hotels_v2_partner_stripe_authorization_postinstall_readonly.sql |
| 114480 | hotels_v2_capability_lifecycle_prewrite_readonly.sql | hotels_v2_capability_lifecycle_postinstall_readonly.sql AND hotels_v2_114480_successor_postinstall_readonly.sql |

114420 embeds atomic installation checks in the unchanged tested migration.
No unversioned old temporary postinstall wrapper is an authoritative package input.
Any additional 114420 operator-only postinstall query needs separate review.

The successor supplements each return one safe sentinel row. They pin all 15
statically defined reconciliation helper bodies, require exact certificate stage
sets/counts, validate fixed BEFORE/AFTER manifests, current metadata and sources,
root/predecessor/self hashes, linked provider/lifecycle receipts, and immutable
receipt topology via the protected accepted predicates. They never call a sealer.
Replay/unknown-stage rejection is additionally proven by accepted local negative
tests, not attempted by these read-only files.

## Prepared history commands — NOT executed

Do not run as a batch. Each command is authorized only after that exact migration
commits, its checks pass, and the human separately approves history reconciliation.

```sh
supabase migration repair 20260811441600 --status applied --linked
supabase migration repair 20260811442000 --status applied --linked
supabase migration repair 20260811442500 --status applied --linked
supabase migration repair 20260811445000 --status applied --linked
supabase migration repair 20260811446000 --status applied --linked
supabase migration repair 20260811447000 --status applied --linked
supabase migration repair 20260811448000 --status applied --linked
```

## Invariants and hard stops

Immutable historical receipts → immutable 114416 receipt → immutable 114450
successor receipt → immutable 114480 successor receipt. Never rewrite receipts.

Require exact stage order, pins, linked certificate chain, 54 authority rows,
100/0 parity, 20/0 guest-one, EUR10 per allocated Room/night, unchanged payment
policy, legacy architecture, and flags rooms=false/external=true/instant=false/
stripe=false. No installation activates public booking, Stripe, onboarding or
changes a price. Account connection and payment routing remain separate decisions.

On any unexpected history, source/catalog drift, mutation, blocker, missing
certificate, ambiguous result or SQL error: STOP. Never retry blindly, mark a
failed install applied, remove a receipt, weaken a gate or increase timeouts.

## Evidence and freeze interpretation

Accepted runtime evidence is in `docs/hotels-114416-successor-validation-results.json`.
It is historical local evidence, not a fresh execution. All 25 accepted candidate
inputs are copied byte-for-byte; only package documentation/verifiers/tests are new.
No frontend changed, so no rebuild is required.

The 33.705491s install measurement belongs to **114470**, not 114416.
Worst separate read-only verifier: **38.103684s**. Existing tested timeouts are
unchanged; this is local margin evidence, not a promise of production latency.

Repository freeze recount includes **235 files / 233 distinct version strings**
through accepted 114415, including legacy 9991–9994. The earlier local report's
231-file count omitted those four legacy filenames. All 235 are byte-identical
to main. No live production migration ledger was queried during checkpointing.

Primary owner-preflight file and its local binary diff remain excluded and intact.
The canonical detached manifest enumerates every changed path plus unchanged
migration/verifier dependencies and the physical 114416 install file. Its own
hash is reported separately to avoid self-reference.
