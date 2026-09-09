# Final remaining Hotels rollout validation

Source checkpoint before this supplement: `f8fe3765a431246adae09c8fc30418ba5cd86371`.
Branch: `feature/hotels-lineage-successor-final`.

This is local package readiness, not authorization to execute production writes. Human-reported production remains recorded through **114425**. Production was not accessed. CLI 2.67.1 remains frozen.

The external recovery evidence is human-confirmed: **09 Sep 2026 05:37:22 UTC**, COMPLETED, PHYSICAL, Restore available. No SQL result is used to infer backup status.

## Sealed clean forward chain

One fresh owned PostgreSQL 16.13 database was rebuilt from the accepted fixture through 114425. The exact frozen four migrations then ran in order with each preaction, physical install, postinstall, local history simulation and next preaction. Gates were not changed during this final run. No stage was skipped.

| Stage | Preaction passing leaves / output rows | Postinstall passing leaves / output rows | Negatives | Existing table snapshots preserved | Install ms |
|---|---|---|---|---|---|
| 114450 | 451 / 452 | 478 / 479 | 25/25 | 96 | 20900.59 |
| 114460 | 478 / 479 | 485 / 486 | 29/29 | 100 | 16662.312 |
| 114470 | 485 / 486 | 492 / 493 | 29/29 | 103 | 35127.864 |
| 114480 | 492 / 493 | 520 / 521 | 28/28 | 104 | 26029.761 |

Output row counts include one summary row. Every postinstall requires the current stage **unrecorded**. After local recording, each postinstall failed only its current `recorded_<stage>` leaf; those four intentional failures prove the before-repair boundary rather than an installation defect.

All old successor-receipt rows were preserved; 114450/114480 append only their authorized certificates. All earlier protected public/auth/private table rows were hash-identical before/after each install, including historical receipts, prices, payment, commission, permissions and flags. Foundation/new table row counts were independently asserted.

## Canonical migration and execution copies

| Stage | Committed filename under supabase/migrations | SHA-256 | Lines |
|---|---|---|---|
| 114450 | 20260811445000_hotels_v2_external_calendar_provider_types.sql | `6151c12a14022e64f6e30421fca6646bc2a540cc111b399b88ac80934174a5d3` | 3029 |
| 114460 | 20260811446000_hotels_v2_partner_stripe_connect.sql | `1e94ad30e9ebdd4d4ca0318ba30c521f3e7e12af5443557f5dfaf06b9f438d14` | 248 |
| 114470 | 20260811447000_hotels_v2_partner_stripe_onboarding_authorization.sql | `7eda4c43fcd4374e30221a0c7d3606090a3414ba4f9d2cf27363474bba1875c0` | 265 |
| 114480 | 20260811448000_hotels_v2_audited_capability_lifecycle.sql | `2bce4cc9d2cef073acce9c416a2b6a5cd681cd24e100c5b1501ee276e3a173fa` | 420 |

All migration bytes match the source checkpoint. Manual files `/private/tmp/hotels_v2_prod_<stage>.sql` are byte-identical, with no added wrapper or concatenation. These manual files were not executed. Only repository migrations were used on disposable local databases. A stale pre-successor temporary 114450 copy was replaced with the exact final candidate; no repository migration was edited.

## Canonical read-only gates

| Stage | Phase | Repository path | SHA-256 | Lines | Expected rows |
|---|---|---|---|---|---|
| 114450 | preaction | supabase/manual/hotels_v2_114450_preaction_readonly.sql | `ead599bc7ddffb657903ee699dc28b0fdc7840f4bc2c9356260a1ba4e2d3fcd6` | 952 | 452 |
| 114450 | postinstall | supabase/manual/hotels_v2_114450_postinstall_readonly.sql | `5272283ddd3d7d5ed5a1824e0a6f09c3fe181d5cb24b064bcd2524414367f238` | 1027 | 479 |
| 114460 | preaction | supabase/manual/hotels_v2_114460_preaction_readonly.sql | `f0ae96ef64917e357789d4f83356d164cacff968db65ffba260bec96a6638673` | 1027 | 479 |
| 114460 | postinstall | supabase/manual/hotels_v2_114460_postinstall_readonly.sql | `892d014ec904fffb20bd0749ddee689af7e582879bc41589fe1b45640ae831c4` | 1065 | 486 |
| 114470 | preaction | supabase/manual/hotels_v2_114470_preaction_readonly.sql | `2690712af4479fa1bd29884111ad31a146a023ec037239424c1307fa4f62f954` | 1065 | 486 |
| 114470 | postinstall | supabase/manual/hotels_v2_114470_postinstall_readonly.sql | `c7195f1a65fb4703c4a8e91fa307be7fb4b9ede2b6a7d84a2ea7171767612189` | 1083 | 493 |
| 114480 | preaction | supabase/manual/hotels_v2_114480_preaction_readonly.sql | `6eff7a76cce1762d99dd073441f5240c609284103f18a3c9493c11be7d2b6e92` | 1083 | 493 |
| 114480 | postinstall | supabase/manual/hotels_v2_114480_postinstall_readonly.sql | `5064fb3dd47c1d1d0ff6267cb9e75619355d24db08554b9c01027e22fda8d412` | 1168 | 521 |

Each execution copy has the identical basename under `/private/tmp`, and all eight compare byte-for-byte with the repository files. Offline regeneration also matches 8/8.

All gates begin with BEGIN, SET TRANSACTION READ ONLY, and SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, and end with ROLLBACK. They return one consolidated result set and do not override statement_timeout. PostgreSQL parser validation passes for every outer statement and embedded SELECT. No DDL, DML, write lock, Preview, Submit, Apply, cleanup or lifecycle mutation is called. Exact function identities in catalog comparisons are metadata, not invocation.

## Source and security scope

The complete created/replaced function signatures, BEFORE/AFTER source pins, tables, triggers, RLS, ACL and receipt changes are in `hotels-remaining-rollout-scope-audit.json`. The compact catalog fixture contains synthetic schema metadata only, not data, credentials or plans. Unqualified regprocedure signatures in that inventory are public functions. The test-only `hotels_h2a_fixture_updated_at()` is explicitly excluded from production requirements.

- 114450: four new private provider tables; 17 persistent new functions and 24 evolved functions; four triggers; provider foundation receipt and successor certificate. The temporary private evolve_function(text,text,text,integer) installation helper is dropped before commit. Only the new receipt table receives installation seal columns. The four provider tables intentionally have RLS/FORCE RLS false as committed; exact private-schema permissions, revoked table/column/effective ACLs and immutable triggers are enforced. No policy is added.
- 114460: new private Stripe schema, accounts/oauth_states/events tables and two functions. All three tables have RLS/FORCE RLS; no browser table access. The service RPC is service-role-only. No connected account, OAuth state or event is inserted by installation.
- 114470: one immutable per-Partner onboarding_authorizations table, five new/two evolved functions and two triggers. Admin Get/Set are explicitly authenticated and Admin-checked. Installation grants nobody onboarding permission and does not rewrite the 114360 permission receipt.
- 114480: five lifecycle tables, 17 new/31 evolved functions, eight triggers including the public.site_settings transition guard, 31 source bindings, one foundation row and successor certificate. RLS/FORCE RLS and private ACLs are exact. Decisions/context/Stripe readiness remain empty. Only the new Admin lifecycle Set has its committed function-scoped 60s timeout; there is no global configuration change. Public booking remains unsupported/false and no capability is activated.

All four installations: FLAGS_MUTATION=NO, PRICING_MUTATION=NO, BOOKING_CREATION=NO, PAYMENT_POLICY_MUTATION=NO, COMMISSION_MUTATION=NO, PERMISSION_MUTATION=NO, STRIPE_EXTERNAL_CALL=NO, EXTERNAL_CALENDAR_RUNTIME_CALL=NO. No policy creation or environment/secret change occurs.

## Negative and non-recursion coverage

111/111 stage negatives passed. Every stage covers history, premature recording, missing/wrong predecessor evidence, source/security/ACL/owner/search_path, flags, pricing, commission, payment lineage, booking/quote/context residue, a real foreign-backend writer lock, future function-universe collision, new-table owner/ACL/RLS/policy and new-schema owner/ACL. Known later ledger versions are tested where present. At 114480, no later authorized ledger version exists; a future function collision remains tested.

At each Stripe-capable stage, four additional rolled-back local negatives prove: unauthorized actor fails; global enabled without Partner permission fails; Partner permission without global enabled fails; connected-account mismatch fails. This synthetic testing makes no live Stripe call and leaves all data unchanged. Installation itself never changes a flag or grants permission.

67/67 successor source/security negatives and 3/3 replay/unknown-stage rejects pass, preserving 110/110 table snapshots. Static reachable lineage graph: 53 functions, zero scoped cycles, zero unresolved dynamic SQL; the naive recursion trap is detected. Runtime READ ONLY trace: scoped_calls=1, provider_bridge_calls=0; the anchor does not re-enter either composite.

## Final read-only Partner transport proof

Owned loopback PostgREST 12.2.12: reviewed-pricing Get HTTP 200 with 54 items (1865.862 ms), workspace Get HTTP 200 (148.641 ms), exact composite pricing token equality. Anonymous 401/42501, foreign Hotel 500/55000, foreign Partner 403/42501 all fail closed. No tokens or identities are retained in results. Preview=0, Submit=0, Apply=0, quote=0, booking=0. All 110 table snapshots unchanged. The ephemeral local PostgREST child was stopped.

## Final integrity and containment

Final local state: Upper 27 / Ground 27 tiers, 54 authority rows, EUR100/EUR100, parity 100/0, guest-one 20/0, allocation exact, commission EUR10 per allocated Room/night exact, payment lineage exact. Reconciliation anchor, reviewed receipt chain, independent topology, activation current-safe, 114420 pricing bridge, 114425 settings fingerprint and provider successor lineage all pass the final gate. Flags remain rooms=false/external=true/instant=false/stripe=false, architecture legacy, public booking disabled. No quotes or bookings were created by these migrations. New Stripe account/OAuth/event/authorization inventories and lifecycle decision/context/readiness inventories remain zero.

Four synthetic databases created for this task were dropped after validation. No existing PostgreSQL server, unrelated fixture, preserved postmaster, Docker, kernel setting or SHM resource was modified. No local test payloads or credentials are packaged.

## Operator sequence and stop boundary

For each stage: canonical PREACTION → exact physical install → canonical POSTINSTALL **before recording** → separately authorized history repair → history verify → next stage. Any false leaf, missing row, source/security mismatch or unexpected history state means STOP; do not mark a failed install applied. Gates deliberately enforce the exact inert boundary and are not broad compatibility waivers.

Next human action is **114450 preaction only**, not installation authorization. No SQL or CLI operation was executed against production during this task. No push, merge, deployment or flag activation occurred.

The rollout plan requires a later separately authorized compatible `hotels-v2-external-calendar-sync` redeploy **after 114450 installation, successful postinstall and history reconciliation**, before approving/enqueuing new provider-type sources. It need not wait for 114480 or enable Rooms/Stripe/Instant. Source supports booking_com, airbnb and ical with the existing worker RPC transport. The deployed worker version was not inspected. No Edge deployment now.

Owner-preflight preservation: file SHA `dad6e570779fac4519e3cfe67874357d1ccbf6fc549b62fab0378e765e304d62`; primary binary-diff SHA `ceaaace06ea57701cb8f99634d3468f851b38c1eaa8b3b41fc08cf8c35b20a54`. It is excluded from the checkpoint.

## Machine-readable local evidence

```json
{
  "checkpoint_before": "f8fe3765a431246adae09c8fc30418ba5cd86371",
  "postgres": "16.13 Postgres.app aarch64-apple-darwin21.6.0",
  "postgrest": "12.2.12 loopback only",
  "sealed_chain": [
    {
      "stage": 114450,
      "local_only": true,
      "negatives": [
        {
          "name": "wrong_predecessor_history",
          "leaf": "recorded_114425",
          "pass": true
        },
        {
          "name": "premature_stage_recording",
          "leaf": "recorded_114450",
          "pass": true
        },
        {
          "name": "missing_predecessor_receipt",
          "leaf": "one_114416_receipt",
          "pass": true
        },
        {
          "name": "wrong_predecessor_hash",
          "leaf": "reconciliation_anchor_exact",
          "pass": true
        },
        {
          "name": "source_drift",
          "leaf": "hotel_v2_external_calendar_site_settings_fingerprint()",
          "pass": true
        },
        {
          "name": "security_drift",
          "leaf": "hotel_v2_external_calendar_site_settings_fingerprint()",
          "pass": true
        },
        {
          "name": "wrong_acl",
          "leaf": "hotel_v2_external_calendar_site_settings_fingerprint()",
          "pass": true
        },
        {
          "name": "wrong_owner",
          "leaf": "hotel_v2_external_calendar_site_settings_fingerprint()",
          "pass": true
        },
        {
          "name": "wrong_search_path",
          "leaf": "hotel_v2_external_calendar_site_settings_fingerprint()",
          "pass": true
        },
        {
          "name": "wrong_flag",
          "leaf": "hotel_rooms_v2_enabled",
          "pass": true
        },
        {
          "name": "pricing_drift",
          "leaf": "upper_rate_exact",
          "pass": true
        },
        {
          "name": "commission_drift",
          "leaf": "commission_EUR10_exact",
          "pass": true
        },
        {
          "name": "payment_lineage_drift",
          "leaf": "hotel_v2_seven_arches_payment_policy_lineage_is_exact()",
          "pass": true
        },
        {
          "name": "unexpected_booking",
          "leaf": "no_114420_priced_booking_rows",
          "pass": true
        },
        {
          "name": "unexpected_quote",
          "leaf": "hotel_seven_arches_public_quote_issuances_empty",
          "pass": true
        },
        {
          "name": "unexpected_context",
          "leaf": "hotel_seven_arches_public_booking_transaction_context_empty",
          "pass": true
        },
        {
          "name": "dangerous_foreign_writer_lock",
          "pass": true
        },
        {
          "name": "future_stage_recording",
          "leaf": "recorded_114460",
          "pass": true
        },
        {
          "name": "future_function_universe_collision",
          "pass": true
        },
        {
          "name": "new_table_owner",
          "pass": true
        },
        {
          "name": "new_table_acl",
          "pass": true
        },
        {
          "name": "new_table_rls",
          "pass": true
        },
        {
          "name": "new_table_policy",
          "pass": true
        },
        {
          "name": "new_schema_owner",
          "pass": true
        },
        {
          "name": "new_schema_acl",
          "pass": true
        }
      ],
      "production_access": false,
      "preaction": {
        "rows": 452,
        "leaves": 451,
        "passed": 451,
        "failed": [],
        "elapsed_ms": 2296.125
      },
      "preaction_after_negatives": {
        "rows": 452,
        "leaves": 451,
        "passed": 451,
        "failed": [],
        "elapsed_ms": 1260.9
      },
      "install_ms": 20900.59,
      "historical_successor_rows_preserved": true,
      "postinstall": {
        "rows": 479,
        "leaves": 478,
        "passed": 478,
        "failed": [],
        "elapsed_ms": 20673.999
      },
      "integrity": {
        "flags": [
          false,
          true,
          false,
          false
        ],
        "stage": 114450,
        "oracle": {
          "core_case_count": 100,
          "contract_version": "hotels_v2_seven_arches_reviewed_pricing_oracle_v1",
          "total_case_count": 120,
          "core_mismatch_count": 0,
          "guest_one_case_count": 20,
          "guest_one_mismatch_count": 0
        },
        "topology": true,
        "allocation": true,
        "architecture": "legacy",
        "scoped_lineage": true,
        "activation_safe": true,
        "authority_count": 54,
        "payment_lineage": true,
        "successor_count": 1,
        "commission_exact": true,
        "reconciliation_anchor": true,
        "reviewed_receipt_chain": true
      },
      "preserved_existing_tables": 96,
      "after_recording": {
        "rows": 479,
        "leaves": 478,
        "passed": 477,
        "failed": [
          "recorded_114450"
        ],
        "elapsed_ms": 21524.646
      }
    },
    {
      "stage": 114460,
      "local_only": true,
      "negatives": [
        {
          "name": "wrong_predecessor_history",
          "leaf": "recorded_114450",
          "pass": true
        },
        {
          "name": "premature_stage_recording",
          "leaf": "recorded_114460",
          "pass": true
        },
        {
          "name": "missing_predecessor_receipt",
          "leaf": "one_114416_receipt",
          "pass": true
        },
        {
          "name": "wrong_predecessor_hash",
          "leaf": "reconciliation_anchor_exact",
          "pass": true
        },
        {
          "name": "source_drift",
          "leaf": "hotel_v2_external_calendar_site_settings_fingerprint()",
          "pass": true
        },
        {
          "name": "security_drift",
          "leaf": "hotel_v2_external_calendar_site_settings_fingerprint()",
          "pass": true
        },
        {
          "name": "wrong_acl",
          "leaf": "hotel_v2_external_calendar_site_settings_fingerprint()",
          "pass": true
        },
        {
          "name": "wrong_owner",
          "leaf": "hotel_v2_external_calendar_site_settings_fingerprint()",
          "pass": true
        },
        {
          "name": "wrong_search_path",
          "leaf": "hotel_v2_external_calendar_site_settings_fingerprint()",
          "pass": true
        },
        {
          "name": "wrong_flag",
          "leaf": "hotel_rooms_v2_enabled",
          "pass": true
        },
        {
          "name": "pricing_drift",
          "leaf": "upper_rate_exact",
          "pass": true
        },
        {
          "name": "commission_drift",
          "leaf": "commission_EUR10_exact",
          "pass": true
        },
        {
          "name": "payment_lineage_drift",
          "leaf": "hotel_v2_seven_arches_payment_policy_lineage_is_exact()",
          "pass": true
        },
        {
          "name": "unexpected_booking",
          "leaf": "no_114420_priced_booking_rows",
          "pass": true
        },
        {
          "name": "unexpected_quote",
          "leaf": "hotel_seven_arches_public_quote_issuances_empty",
          "pass": true
        },
        {
          "name": "unexpected_context",
          "leaf": "hotel_seven_arches_public_booking_transaction_context_empty",
          "pass": true
        },
        {
          "name": "dangerous_foreign_writer_lock",
          "pass": true
        },
        {
          "name": "future_stage_recording",
          "leaf": "recorded_114470",
          "pass": true
        },
        {
          "name": "future_function_universe_collision",
          "pass": true
        },
        {
          "name": "new_table_owner",
          "pass": true
        },
        {
          "name": "new_table_acl",
          "pass": true
        },
        {
          "name": "new_table_rls",
          "pass": true
        },
        {
          "name": "new_table_policy",
          "pass": true
        },
        {
          "name": "new_schema_owner",
          "pass": true
        },
        {
          "name": "new_schema_acl",
          "pass": true
        },
        {
          "name": "unauthorized_partner_onboarding",
          "expected_error": "hotel_stripe_connect_access_denied",
          "pass": true,
          "external_calls": 0
        },
        {
          "name": "global_without_partner_permission",
          "expected_error": "hotel_stripe_connect_access_denied",
          "pass": true,
          "external_calls": 0
        },
        {
          "name": "partner_permission_without_global_capability",
          "expected_error": "hotel_stripe_connect_disabled",
          "pass": true,
          "external_calls": 0
        },
        {
          "name": "connected_account_identity_mismatch",
          "expected_error": "hotel_stripe_connect_revision_conflict",
          "pass": true,
          "external_calls": 0
        }
      ],
      "production_access": false,
      "preaction": {
        "rows": 479,
        "leaves": 478,
        "passed": 478,
        "failed": [],
        "elapsed_ms": 21688.076
      },
      "preaction_after_negatives": {
        "rows": 479,
        "leaves": 478,
        "passed": 478,
        "failed": [],
        "elapsed_ms": 20933.316
      },
      "install_ms": 16662.312,
      "historical_successor_rows_preserved": true,
      "postinstall": {
        "rows": 486,
        "leaves": 485,
        "passed": 485,
        "failed": [],
        "elapsed_ms": 21061.077
      },
      "integrity": {
        "flags": [
          false,
          true,
          false,
          false
        ],
        "stage": 114460,
        "oracle": {
          "core_case_count": 100,
          "contract_version": "hotels_v2_seven_arches_reviewed_pricing_oracle_v1",
          "total_case_count": 120,
          "core_mismatch_count": 0,
          "guest_one_case_count": 20,
          "guest_one_mismatch_count": 0
        },
        "topology": true,
        "allocation": true,
        "architecture": "legacy",
        "scoped_lineage": true,
        "activation_safe": true,
        "authority_count": 54,
        "payment_lineage": true,
        "successor_count": 1,
        "commission_exact": true,
        "reconciliation_anchor": true,
        "reviewed_receipt_chain": true
      },
      "preserved_existing_tables": 100,
      "postinstall_after_stripe_negatives": {
        "rows": 486,
        "leaves": 485,
        "passed": 485,
        "failed": [],
        "elapsed_ms": 22916.657
      },
      "after_recording": {
        "rows": 486,
        "leaves": 485,
        "passed": 484,
        "failed": [
          "recorded_114460"
        ],
        "elapsed_ms": 20447.315
      }
    },
    {
      "stage": 114470,
      "local_only": true,
      "negatives": [
        {
          "name": "wrong_predecessor_history",
          "leaf": "recorded_114460",
          "pass": true
        },
        {
          "name": "premature_stage_recording",
          "leaf": "recorded_114470",
          "pass": true
        },
        {
          "name": "missing_predecessor_receipt",
          "leaf": "one_114416_receipt",
          "pass": true
        },
        {
          "name": "wrong_predecessor_hash",
          "leaf": "reconciliation_anchor_exact",
          "pass": true
        },
        {
          "name": "source_drift",
          "leaf": "hotel_v2_external_calendar_site_settings_fingerprint()",
          "pass": true
        },
        {
          "name": "security_drift",
          "leaf": "hotel_v2_external_calendar_site_settings_fingerprint()",
          "pass": true
        },
        {
          "name": "wrong_acl",
          "leaf": "hotel_v2_external_calendar_site_settings_fingerprint()",
          "pass": true
        },
        {
          "name": "wrong_owner",
          "leaf": "hotel_v2_external_calendar_site_settings_fingerprint()",
          "pass": true
        },
        {
          "name": "wrong_search_path",
          "leaf": "hotel_v2_external_calendar_site_settings_fingerprint()",
          "pass": true
        },
        {
          "name": "wrong_flag",
          "leaf": "hotel_rooms_v2_enabled",
          "pass": true
        },
        {
          "name": "pricing_drift",
          "leaf": "upper_rate_exact",
          "pass": true
        },
        {
          "name": "commission_drift",
          "leaf": "commission_EUR10_exact",
          "pass": true
        },
        {
          "name": "payment_lineage_drift",
          "leaf": "hotel_v2_seven_arches_payment_policy_lineage_is_exact()",
          "pass": true
        },
        {
          "name": "unexpected_booking",
          "leaf": "no_114420_priced_booking_rows",
          "pass": true
        },
        {
          "name": "unexpected_quote",
          "leaf": "hotel_seven_arches_public_quote_issuances_empty",
          "pass": true
        },
        {
          "name": "unexpected_context",
          "leaf": "hotel_seven_arches_public_booking_transaction_context_empty",
          "pass": true
        },
        {
          "name": "dangerous_foreign_writer_lock",
          "pass": true
        },
        {
          "name": "future_stage_recording",
          "leaf": "recorded_114480",
          "pass": true
        },
        {
          "name": "future_function_universe_collision",
          "pass": true
        },
        {
          "name": "new_table_owner",
          "pass": true
        },
        {
          "name": "new_table_acl",
          "pass": true
        },
        {
          "name": "new_table_rls",
          "pass": true
        },
        {
          "name": "new_table_policy",
          "pass": true
        },
        {
          "name": "new_schema_owner",
          "pass": true
        },
        {
          "name": "new_schema_acl",
          "pass": true
        },
        {
          "name": "unauthorized_partner_onboarding",
          "expected_error": "hotel_stripe_connect_access_denied",
          "pass": true,
          "external_calls": 0
        },
        {
          "name": "global_without_partner_permission",
          "expected_error": "hotel_stripe_connect_access_denied",
          "pass": true,
          "external_calls": 0
        },
        {
          "name": "partner_permission_without_global_capability",
          "expected_error": "hotel_stripe_connect_disabled",
          "pass": true,
          "external_calls": 0
        },
        {
          "name": "connected_account_identity_mismatch",
          "expected_error": "hotel_stripe_connect_revision_conflict",
          "pass": true,
          "external_calls": 0
        }
      ],
      "production_access": false,
      "preaction": {
        "rows": 486,
        "leaves": 485,
        "passed": 485,
        "failed": [],
        "elapsed_ms": 20710.564
      },
      "preaction_after_negatives": {
        "rows": 486,
        "leaves": 485,
        "passed": 485,
        "failed": [],
        "elapsed_ms": 22201.241
      },
      "install_ms": 35127.864,
      "historical_successor_rows_preserved": true,
      "postinstall": {
        "rows": 493,
        "leaves": 492,
        "passed": 492,
        "failed": [],
        "elapsed_ms": 21763.567
      },
      "integrity": {
        "flags": [
          false,
          true,
          false,
          false
        ],
        "stage": 114470,
        "oracle": {
          "core_case_count": 100,
          "contract_version": "hotels_v2_seven_arches_reviewed_pricing_oracle_v1",
          "total_case_count": 120,
          "core_mismatch_count": 0,
          "guest_one_case_count": 20,
          "guest_one_mismatch_count": 0
        },
        "topology": true,
        "allocation": true,
        "architecture": "legacy",
        "scoped_lineage": true,
        "activation_safe": true,
        "authority_count": 54,
        "payment_lineage": true,
        "successor_count": 1,
        "commission_exact": true,
        "reconciliation_anchor": true,
        "reviewed_receipt_chain": true
      },
      "preserved_existing_tables": 103,
      "postinstall_after_stripe_negatives": {
        "rows": 493,
        "leaves": 492,
        "passed": 492,
        "failed": [],
        "elapsed_ms": 20522.053
      },
      "after_recording": {
        "rows": 493,
        "leaves": 492,
        "passed": 491,
        "failed": [
          "recorded_114470"
        ],
        "elapsed_ms": 22441.198
      }
    },
    {
      "stage": 114480,
      "local_only": true,
      "negatives": [
        {
          "name": "wrong_predecessor_history",
          "leaf": "recorded_114470",
          "pass": true
        },
        {
          "name": "premature_stage_recording",
          "leaf": "recorded_114480",
          "pass": true
        },
        {
          "name": "missing_predecessor_receipt",
          "leaf": "one_114416_receipt",
          "pass": true
        },
        {
          "name": "wrong_predecessor_hash",
          "leaf": "reconciliation_anchor_exact",
          "pass": true
        },
        {
          "name": "source_drift",
          "leaf": "hotel_v2_external_calendar_site_settings_fingerprint()",
          "pass": true
        },
        {
          "name": "security_drift",
          "leaf": "hotel_v2_external_calendar_site_settings_fingerprint()",
          "pass": true
        },
        {
          "name": "wrong_acl",
          "leaf": "hotel_v2_external_calendar_site_settings_fingerprint()",
          "pass": true
        },
        {
          "name": "wrong_owner",
          "leaf": "hotel_v2_external_calendar_site_settings_fingerprint()",
          "pass": true
        },
        {
          "name": "wrong_search_path",
          "leaf": "hotel_v2_external_calendar_site_settings_fingerprint()",
          "pass": true
        },
        {
          "name": "wrong_flag",
          "leaf": "hotel_rooms_v2_enabled",
          "pass": true
        },
        {
          "name": "pricing_drift",
          "leaf": "upper_rate_exact",
          "pass": true
        },
        {
          "name": "commission_drift",
          "leaf": "commission_EUR10_exact",
          "pass": true
        },
        {
          "name": "payment_lineage_drift",
          "leaf": "hotel_v2_seven_arches_payment_policy_lineage_is_exact()",
          "pass": true
        },
        {
          "name": "unexpected_booking",
          "leaf": "no_114420_priced_booking_rows",
          "pass": true
        },
        {
          "name": "unexpected_quote",
          "leaf": "hotel_seven_arches_public_quote_issuances_empty",
          "pass": true
        },
        {
          "name": "unexpected_context",
          "leaf": "hotel_seven_arches_public_booking_transaction_context_empty",
          "pass": true
        },
        {
          "name": "dangerous_foreign_writer_lock",
          "pass": true
        },
        {
          "name": "future_function_universe_collision",
          "pass": true
        },
        {
          "name": "new_table_owner",
          "pass": true
        },
        {
          "name": "new_table_acl",
          "pass": true
        },
        {
          "name": "new_table_rls",
          "pass": true
        },
        {
          "name": "new_table_policy",
          "pass": true
        },
        {
          "name": "new_schema_owner",
          "pass": true
        },
        {
          "name": "new_schema_acl",
          "pass": true
        },
        {
          "name": "unauthorized_partner_onboarding",
          "expected_error": "hotel_stripe_connect_access_denied",
          "pass": true,
          "external_calls": 0
        },
        {
          "name": "global_without_partner_permission",
          "expected_error": "hotel_stripe_connect_access_denied",
          "pass": true,
          "external_calls": 0
        },
        {
          "name": "partner_permission_without_global_capability",
          "expected_error": "hotel_stripe_connect_disabled",
          "pass": true,
          "external_calls": 0
        },
        {
          "name": "connected_account_identity_mismatch",
          "expected_error": "hotel_stripe_connect_revision_conflict",
          "pass": true,
          "external_calls": 0
        }
      ],
      "production_access": false,
      "preaction": {
        "rows": 493,
        "leaves": 492,
        "passed": 492,
        "failed": [],
        "elapsed_ms": 21304.049
      },
      "preaction_after_negatives": {
        "rows": 493,
        "leaves": 492,
        "passed": 492,
        "failed": [],
        "elapsed_ms": 21869.117
      },
      "install_ms": 26029.761,
      "historical_successor_rows_preserved": true,
      "postinstall": {
        "rows": 521,
        "leaves": 520,
        "passed": 520,
        "failed": [],
        "elapsed_ms": 10538.637
      },
      "integrity": {
        "flags": [
          false,
          true,
          false,
          false
        ],
        "stage": 114480,
        "oracle": {
          "core_case_count": 100,
          "contract_version": "hotels_v2_seven_arches_reviewed_pricing_oracle_v1",
          "total_case_count": 120,
          "core_mismatch_count": 0,
          "guest_one_case_count": 20,
          "guest_one_mismatch_count": 0
        },
        "topology": true,
        "allocation": true,
        "architecture": "legacy",
        "scoped_lineage": true,
        "activation_safe": true,
        "authority_count": 54,
        "payment_lineage": true,
        "successor_count": 2,
        "commission_exact": true,
        "reconciliation_anchor": true,
        "reviewed_receipt_chain": true
      },
      "preserved_existing_tables": 104,
      "postinstall_after_stripe_negatives": {
        "rows": 521,
        "leaves": 520,
        "passed": 520,
        "failed": [],
        "elapsed_ms": 10614.36
      },
      "after_recording": {
        "rows": 521,
        "leaves": 520,
        "passed": 519,
        "failed": [
          "recorded_114480"
        ],
        "elapsed_ms": 12175.058
      }
    }
  ],
  "parser": {
    "gates": 8,
    "passed": 8,
    "select_only": true,
    "result_sets_per_gate": 1,
    "read_only": true,
    "repeatable_read": true,
    "rollback": true,
    "timeout_overridden": false
  },
  "deterministic_regeneration": 8,
  "gate_temp_cmp": 8,
  "installation_temp_cmp": 4,
  "successor_security": {
    "negatives": 67,
    "passed": 67,
    "replay_unknown": 3,
    "rows_preserved": 110,
    "runtime_non_recursion": "PASS",
    "scoped_calls": 1,
    "provider_bridge_calls": 0,
    "transaction_read_only": "on"
  },
  "graph": {
    "scoped_cycles": [],
    "naive_recursion_trap_detected": true,
    "unresolved_dynamic_sql": [],
    "functions": 53
  },
  "partner_read": {
    "partner_composite_token_exact": true,
    "results": [
      {
        "rpc": "reviewed_pricing",
        "http": 200,
        "items": 54,
        "elapsed_ms": 1865.862
      },
      {
        "rpc": "workspace",
        "http": 200,
        "elapsed_ms": 148.641
      },
      {
        "name": "anonymous",
        "http": 401,
        "code": "42501",
        "fail_closed": true
      },
      {
        "name": "foreign_hotel",
        "http": 500,
        "code": "55000",
        "fail_closed": true
      },
      {
        "name": "foreign_partner",
        "http": 403,
        "code": "42501",
        "fail_closed": true
      }
    ],
    "protected_tables_unchanged": 110,
    "preview_calls": 0,
    "submit_calls": 0,
    "apply_calls": 0,
    "quote_calls": 0,
    "booking_calls": 0,
    "production_access": false
  },
  "disposable_databases_removed": 4,
  "owned_databases_remaining": 0,
  "production_access": false,
  "migrations_changed": false
}
```
