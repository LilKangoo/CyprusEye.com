# Final remaining Hotels rollout — authoritative predecessor PASS

Parent checkpoint: `83b00502f69c6343ba8750ad2db635b4eed874ad`.
Branch: `feature/hotels-lineage-successor-final`.
The final local commit identity and current file hashes are in the detached
`/private/tmp/hotels-lineage-successor-final-manifest.json`.

**Full local validation PASS. Next human action: 114450 read-only preaction only.**
No production access, production SQL, repair, push, merge or deployment occurred.
Production remains human-reported through 114425. CLI 2.67.1 stays frozen.
Recovery evidence remains external: 09 Sep 2026 05:37:22 UTC, COMPLETED, PHYSICAL,
Restore available. No fresh backup status is inferred from local SQL.

## Provenance and corrected verifier baseline

The previous 114450 defect comprised two direct function catalog mismatches, one
overbroad universe mismatch, and 17 guard-suppressed NULL reads. Those 17 were not
independent production predicate failures.

Exact committed provenance (full file/source hashes and metadata are in
`hotels-remaining-rollout-provenance.json`):

- Generic Apply: 113700 hotfix, ancestor 078d3a4, followed by the exact 114350 external-sync
  guard evolution gives `775dcbb181fd52e8eba2e5a741beff28ed9c06c5d72cc209ee7bbfb5f74f0752`.
  Human-reported 114350/114410 historical receipt comparisons independently match.
- Admin helper: 042 supersedes 037; 153 and 164/165/166 provide search_path and ACL
  hardening. Exact body `581f1801056e5aee65c0144151b41dea41910d2c8e22639873ff659487e8a255`;
  PL/pgSQL, STABLE, SECURITY DEFINER, postgres owner, search_path=public,
  anon/authenticated/postgres/service_role EXECUTE without PUBLIC/grant option.
  Fixture and standalone setup scripts are not applied-migration authority.
- Booking ownership helper: exact 111800 source `4bf9032e832df802166f0919ee447099193aad32b1d407e9f75460e31471ab8e`;
  it is a protected BEFORE INSERT hotel_bookings trigger, **not unrelated functionality**.

A new disposable PG16.13 fixture restored these authoritative definitions before any
immutable receipts were created. On the same unchanged post-114425 database, the old
gate from 83b00502 returned exactly 20 failures; corrected gate returned zero.
98/98 tables, including history, were unchanged during this comparison.

Protected function universe: public hotel_v2_ functions, both explicit security
dependencies, and all functions in the four Hotels private schemas.
Unknown protected functions, missing functions, source/ACL/owner/search_path/security
drift fail closed. An unrelated public application function is allowed.
The 111800 booking trigger topology is additionally pinned.

## Authorized minimal 114470 correction

The first corrected-predecessor run exposed a real stale fixture pin in the
**unapplied** 114470 migration. The human separately authorized its correction.
Only its is_current_user_admin source/security prerequisite changed:

| Field | Obsolete fixture expectation | Authoritative expectation |
|---|---|---|
| source | 9d9cc165c5d19e4d6d5c4543a91e02e6e83c2fa3e87fc5162b900cf298ef86d5 | 581f1801056e5aee65c0144151b41dea41910d2c8e22639873ff659487e8a255 |
| language | sql | plpgsql |
| search_path | pg_catalog, public, auth | public |

Existing postgres owner, STABLE and SECURITY DEFINER checks remain.
Exact direct ACL/grantor/grantability and effective PUBLIC/anon/authenticated/service
execution checks were added for this helper only. No permission is granted by this check.

Old migration SHA `7eda4c43fcd4374e30221a0c7d3606090a3414ba4f9d2cf27363474bba1875c0`
is **OBSOLETE**.
New SHA `4c411a16b84475d465909daad23ceaa0770202b325344978b21b486a31636d60`, 279 lines.
`/private/tmp/hotels_v2_prod_114470.sql` is byte-identical.
Everything from the first CREATE TABLE through the end of 114470 is byte-identical
to 83b00502. Runtime functions, business logic, timeouts and all other migrations are unchanged.
114480 requires no source change. Only the two 114470 gate headers needed its new file identity.

## Fresh complete chain

A second new database was built from the authoritative predecessor, not reused from
the failed run. Then every stage ran preaction → install → postinstall → local
history recording. No gates changed during this run.

| Stage | Preaction leaves / rows | Postinstall leaves / rows | Stage checks | Guard checks | Preserved tables | Install ms |
|---|---|---|---|---|---|---|
| 114450 | 453 / 454 | 480 / 481 | 37/37 | 0 | 96 | 19954.427 |
| 114460 | 480 / 481 | 487 / 488 | 41/41 | 0 | 100 | 16665.372 |
| 114470 | 487 / 488 | 494 / 495 | 41/41 | 10 | 103 | 33940.002 |
| 114480 | 494 / 495 | 522 / 523 | 40/40 | 0 | 104 | 21959.759 |

All complete catalogs were independently recaptured and matched the corrected expectations.
After each local recording, postinstall rejected **only** its current recorded-stage leaf,
proving that postinstall belongs before repair. No partial installation or mixed pins remain.

## Security and non-recursion

169/169 stage/guard checks passed: 165 rejection cases plus four unrelated-function
positive cases. This includes all prior stage negatives and the ten new actual
114470 install-guard negatives: stale fixture, wrong source/language/search_path,
PUBLIC grant, missing anon grant, grant option, wrong owner/definer/volatility.
Each guard rejection rolled back; the original definition and table snapshots remained exact.

Stripe negatives cover unauthorized Partner, global capability without Partner permission,
Partner permission without global capability, and connected-account mismatch.
All were local rolled-back tests, with zero Stripe API calls.

67/67 final successor negatives and 3/3 replay/unknown-stage rejects passed.
110/110 final protected table snapshots remained unchanged.
Static reachable graph: 53 functions, zero cycles, zero unresolved dynamic SQL;
the naive reentry trap is detected.
Runtime READ ONLY trace: scoped_calls=1, provider_bridge_calls=0.

Owned loopback PostgREST Partner Get/workspace returned HTTP200 and an exact shared
pricing snapshot token, with 54 pricing items. Anonymous/foreign Hotel/foreign Partner
requests fail closed. Preview/Submit/Apply/quote/booking calls in this transport smoke=0.
The ephemeral local PostgREST child was stopped.

## Final integrity

Upper=27 and Ground=27 tiers; authority=54; base rates EUR100/EUR100.
Parity=100/0; guest-one=20/0; allocation exact; commission EUR10 per allocated Room/night;
payment lineage exact. Reconciliation/bridge/settings fingerprint/provider lineage,
Stripe foundation, authorization and lifecycle are exact through 114480.
Flags: rooms=false, external=true, instant=false, stripe=false.
Architecture legacy; public booking disabled.

No existing business or historical receipt rows changed during remaining-stage installation.
No bookings/quotes created by these migrations; no payment routing or commission mutation.
No automatic Partner onboarding authorization. New Stripe account/OAuth/event/authorization
and lifecycle decision/context/readiness inventories remain empty.

## Canonical gates

All paths use `supabase/manual/hotels_v2_<stage>_<phase>_readonly.sql`.
Each temporary execution copy has the same basename under /private/tmp.

| Stage | Phase | SHA-256 | Lines | Expected rows |
|---|---|---|---|---|
| 114450 | preaction | 5a9254bcbc55246a89e99462e5583e89d250afea8d3c040ba52b102bd9fc2c91 | 957 | 454 |
| 114450 | postinstall | f0cc66161bef58168e1a8164816171b582b5577a5374c03916024ba1ab4a215f | 1032 | 481 |
| 114460 | preaction | f195756ba126df6d6b52f9e9b382c102a5d9e28e7c9140ecdaeb17cc4002d5f0 | 1032 | 481 |
| 114460 | postinstall | 90028907172c999eb9539c5f64536f91383aac1b8969a5ddefdbdd2303bcfb95 | 1070 | 488 |
| 114470 | preaction | f0c46271bbd637afe61ecfc550322d5a269b331012de155718c9ca0133876a84 | 1070 | 488 |
| 114470 | postinstall | a6c0e4e173bd75ba9521c2b37f8a7728105f5da316d314a6f46b51e818c958dd | 1088 | 495 |
| 114480 | preaction | 17ea983a332a90a3b184253fabd50c48528c0db5bf12689e9245097ef7431571 | 1088 | 495 |
| 114480 | postinstall | 17985a514c7f459f5681d24ce3c910d45b5251c5e0bb064bc636cb93cd56085e | 1173 | 523 |

8/8 byte-identical copies and deterministic regenerations pass. AST parser validates
all outer statements and 1176 embedded SELECTs; no DDL/DML, write lock, mutation RPC or
timeout override. BEGIN, READ ONLY, REPEATABLE READ, final ROLLBACK remain exact.
Three offline corrupt-provenance-pin negatives pass.
The old failure-root diagnostic is retained unchanged as historical diagnostic evidence,
not a final gate or production authority.

## Reproduction and containment

Use owned loopback 127.0.0.1:55479 with HOTELS_REMAINING_AUTHORITATIVE_PREDECESSOR=1:
reconciliation baseline0external → fixture → successor prelude → reconciliation probe →
114425 prepare/install/record → remaining-rollout-root-proof →
remaining-rollout-gate for 114450/114460/114470/114480 →
successor-security-gate → successor-graph → remaining-rollout-partner-read-gate.
Offline parser: PYTHONPATH=/private/tmp/hotels-114420-parser.6UlBhb node
tests/integration/hotels-v2-remaining-rollout-static-gate.mjs.

The database `hotels_114416_successor_post425_remaining_guard_b` was dropped after validation.
No existing cluster/process was stopped. Owner-preflight file and binary diff remain
byte-identical and excluded. Only 114470 changes migration bytes.

This package does not authorize installation or history repair. Human must first run the
corrected 114450 preaction and obtain all passing leaves. Stop on any discrepancy.
A later external-calendar Edge redeploy remains separately authorized, after 114450
installation/postinstall/history verification; no deployment occurred here.

## Machine-readable local evidence

```json
{
  "status": "PASS",
  "checkpoint_before": "83b00502f69c6343ba8750ad2db635b4eed874ad",
  "postgres": "16.13 (Postgres.app)",
  "fresh_fixture": "hotels_114416_successor_post425_remaining_guard_b",
  "fresh_fixture_removed": true,
  "root_fix": {
    "before": 20,
    "after": 0,
    "protected_tables_unchanged": 98
  },
  "migration_114470": {
    "old_sha": "7eda4c43fcd4374e30221a0c7d3606090a3414ba4f9d2cf27363474bba1875c0",
    "new_sha": "4c411a16b84475d465909daad23ceaa0770202b325344978b21b486a31636d60",
    "lines": 279,
    "business_runtime_body_unchanged": true,
    "manual_copy_exact": true,
    "guard_negatives": 10
  },
  "stages": [
    {
      "stage": 114450,
      "local_only": true,
      "negatives": [
        "wrong_predecessor_history",
        "premature_stage_recording",
        "missing_predecessor_receipt",
        "wrong_predecessor_hash",
        "missing_protected_function",
        "unexpected_protected_overload",
        "unexpected_private_function",
        "unrelated_public_application_function_allowed",
        "source_drift",
        "protected_universe_source_drift",
        "security_drift",
        "protected_universe_security_drift",
        "wrong_acl",
        "protected_universe_wrong_acl",
        "wrong_owner",
        "protected_universe_wrong_owner",
        "wrong_search_path",
        "protected_universe_wrong_search_path",
        "booking_owner_trigger_disabled",
        "booking_owner_helper_acl_drift",
        "admin_helper_public_acl_drift",
        "wrong_flag",
        "pricing_drift",
        "commission_drift",
        "payment_lineage_drift",
        "unexpected_booking",
        "unexpected_quote",
        "unexpected_context",
        "dangerous_foreign_writer_lock",
        "future_stage_recording",
        "future_function_universe_collision",
        "new_table_owner",
        "new_table_acl",
        "new_table_rls",
        "new_table_policy",
        "new_schema_owner",
        "new_schema_acl"
      ],
      "production_access": false,
      "preaction": {
        "rows": 454,
        "leaves": 453,
        "passed": 453,
        "failed": [],
        "elapsed_ms": 1186.15
      },
      "preaction_after_negatives": {
        "rows": 454,
        "leaves": 453,
        "passed": 453,
        "failed": [],
        "elapsed_ms": 1115.957
      },
      "install_ms": 19954.427,
      "full_catalog_recapture_exact": true,
      "historical_successor_rows_preserved": true,
      "postinstall": {
        "rows": 481,
        "leaves": 480,
        "passed": 480,
        "failed": [],
        "elapsed_ms": 21739.554
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
        "rows": 481,
        "leaves": 480,
        "passed": 479,
        "failed": [
          "recorded_114450"
        ],
        "elapsed_ms": 21341.68
      }
    },
    {
      "stage": 114460,
      "local_only": true,
      "negatives": [
        "wrong_predecessor_history",
        "premature_stage_recording",
        "missing_predecessor_receipt",
        "wrong_predecessor_hash",
        "missing_protected_function",
        "unexpected_protected_overload",
        "unexpected_private_function",
        "unrelated_public_application_function_allowed",
        "source_drift",
        "protected_universe_source_drift",
        "security_drift",
        "protected_universe_security_drift",
        "wrong_acl",
        "protected_universe_wrong_acl",
        "wrong_owner",
        "protected_universe_wrong_owner",
        "wrong_search_path",
        "protected_universe_wrong_search_path",
        "booking_owner_trigger_disabled",
        "booking_owner_helper_acl_drift",
        "admin_helper_public_acl_drift",
        "wrong_flag",
        "pricing_drift",
        "commission_drift",
        "payment_lineage_drift",
        "unexpected_booking",
        "unexpected_quote",
        "unexpected_context",
        "dangerous_foreign_writer_lock",
        "future_stage_recording",
        "future_function_universe_collision",
        "new_table_owner",
        "new_table_acl",
        "new_table_rls",
        "new_table_policy",
        "new_schema_owner",
        "new_schema_acl",
        "unauthorized_partner_onboarding",
        "global_without_partner_permission",
        "partner_permission_without_global_capability",
        "connected_account_identity_mismatch"
      ],
      "production_access": false,
      "preaction": {
        "rows": 481,
        "leaves": 480,
        "passed": 480,
        "failed": [],
        "elapsed_ms": 20924.782
      },
      "preaction_after_negatives": {
        "rows": 481,
        "leaves": 480,
        "passed": 480,
        "failed": [],
        "elapsed_ms": 26961.431
      },
      "install_ms": 16665.372,
      "full_catalog_recapture_exact": true,
      "historical_successor_rows_preserved": true,
      "postinstall": {
        "rows": 488,
        "leaves": 487,
        "passed": 487,
        "failed": [],
        "elapsed_ms": 27915.554
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
        "rows": 488,
        "leaves": 487,
        "passed": 487,
        "failed": [],
        "elapsed_ms": 21016.769
      },
      "after_recording": {
        "rows": 488,
        "leaves": 487,
        "passed": 486,
        "failed": [
          "recorded_114460"
        ],
        "elapsed_ms": 21279.891
      }
    },
    {
      "stage": 114470,
      "local_only": true,
      "negatives": [
        "wrong_predecessor_history",
        "premature_stage_recording",
        "missing_predecessor_receipt",
        "wrong_predecessor_hash",
        "missing_protected_function",
        "unexpected_protected_overload",
        "unexpected_private_function",
        "unrelated_public_application_function_allowed",
        "source_drift",
        "protected_universe_source_drift",
        "security_drift",
        "protected_universe_security_drift",
        "wrong_acl",
        "protected_universe_wrong_acl",
        "wrong_owner",
        "protected_universe_wrong_owner",
        "wrong_search_path",
        "protected_universe_wrong_search_path",
        "booking_owner_trigger_disabled",
        "booking_owner_helper_acl_drift",
        "admin_helper_public_acl_drift",
        "wrong_flag",
        "pricing_drift",
        "commission_drift",
        "payment_lineage_drift",
        "unexpected_booking",
        "unexpected_quote",
        "unexpected_context",
        "dangerous_foreign_writer_lock",
        "future_stage_recording",
        "future_function_universe_collision",
        "new_table_owner",
        "new_table_acl",
        "new_table_rls",
        "new_table_policy",
        "new_schema_owner",
        "new_schema_acl",
        "unauthorized_partner_onboarding",
        "global_without_partner_permission",
        "partner_permission_without_global_capability",
        "connected_account_identity_mismatch"
      ],
      "production_access": false,
      "preaction": {
        "rows": 488,
        "leaves": 487,
        "passed": 487,
        "failed": [],
        "elapsed_ms": 20533.805
      },
      "preaction_after_negatives": {
        "rows": 488,
        "leaves": 487,
        "passed": 487,
        "failed": [],
        "elapsed_ms": 23652.154
      },
      "install_guard_negatives": [
        {
          "name": "stale_fixture",
          "pass": true,
          "error": "hotel_stripe_authorization_source_security_drift"
        },
        {
          "name": "wrong_source",
          "pass": true,
          "error": "hotel_stripe_authorization_source_security_drift"
        },
        {
          "name": "wrong_language",
          "pass": true,
          "error": "hotel_stripe_authorization_source_security_drift"
        },
        {
          "name": "wrong_search_path",
          "pass": true,
          "error": "hotel_stripe_authorization_source_security_drift"
        },
        {
          "name": "public_acl",
          "pass": true,
          "error": "hotel_stripe_authorization_source_security_drift"
        },
        {
          "name": "missing_anon_acl",
          "pass": true,
          "error": "hotel_stripe_authorization_source_security_drift"
        },
        {
          "name": "grant_option_acl",
          "pass": true,
          "error": "hotel_stripe_authorization_source_security_drift"
        },
        {
          "name": "wrong_owner",
          "pass": true,
          "error": "hotel_stripe_authorization_source_security_drift"
        },
        {
          "name": "wrong_definer",
          "pass": true,
          "error": "hotel_stripe_authorization_source_security_drift"
        },
        {
          "name": "wrong_volatility",
          "pass": true,
          "error": "hotel_stripe_authorization_source_security_drift"
        }
      ],
      "preaction_after_install_guard_negatives": {
        "rows": 488,
        "leaves": 487,
        "passed": 487,
        "failed": [],
        "elapsed_ms": 20675.963
      },
      "install_ms": 33940.002,
      "full_catalog_recapture_exact": true,
      "historical_successor_rows_preserved": true,
      "postinstall": {
        "rows": 495,
        "leaves": 494,
        "passed": 494,
        "failed": [],
        "elapsed_ms": 22898.109
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
        "rows": 495,
        "leaves": 494,
        "passed": 494,
        "failed": [],
        "elapsed_ms": 20559.536
      },
      "after_recording": {
        "rows": 495,
        "leaves": 494,
        "passed": 493,
        "failed": [
          "recorded_114470"
        ],
        "elapsed_ms": 20219.717
      }
    },
    {
      "stage": 114480,
      "local_only": true,
      "negatives": [
        "wrong_predecessor_history",
        "premature_stage_recording",
        "missing_predecessor_receipt",
        "wrong_predecessor_hash",
        "missing_protected_function",
        "unexpected_protected_overload",
        "unexpected_private_function",
        "unrelated_public_application_function_allowed",
        "source_drift",
        "protected_universe_source_drift",
        "security_drift",
        "protected_universe_security_drift",
        "wrong_acl",
        "protected_universe_wrong_acl",
        "wrong_owner",
        "protected_universe_wrong_owner",
        "wrong_search_path",
        "protected_universe_wrong_search_path",
        "booking_owner_trigger_disabled",
        "booking_owner_helper_acl_drift",
        "admin_helper_public_acl_drift",
        "wrong_flag",
        "pricing_drift",
        "commission_drift",
        "payment_lineage_drift",
        "unexpected_booking",
        "unexpected_quote",
        "unexpected_context",
        "dangerous_foreign_writer_lock",
        "future_function_universe_collision",
        "new_table_owner",
        "new_table_acl",
        "new_table_rls",
        "new_table_policy",
        "new_schema_owner",
        "new_schema_acl",
        "unauthorized_partner_onboarding",
        "global_without_partner_permission",
        "partner_permission_without_global_capability",
        "connected_account_identity_mismatch"
      ],
      "production_access": false,
      "preaction": {
        "rows": 495,
        "leaves": 494,
        "passed": 494,
        "failed": [],
        "elapsed_ms": 20338.203
      },
      "preaction_after_negatives": {
        "rows": 495,
        "leaves": 494,
        "passed": 494,
        "failed": [],
        "elapsed_ms": 21871.354
      },
      "install_ms": 21959.759,
      "full_catalog_recapture_exact": true,
      "historical_successor_rows_preserved": true,
      "postinstall": {
        "rows": 523,
        "leaves": 522,
        "passed": 522,
        "failed": [],
        "elapsed_ms": 10453.215
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
        "rows": 523,
        "leaves": 522,
        "passed": 522,
        "failed": [],
        "elapsed_ms": 10366.688
      },
      "after_recording": {
        "rows": 523,
        "leaves": 522,
        "passed": 521,
        "failed": [
          "recorded_114480"
        ],
        "elapsed_ms": 10423.589
      }
    }
  ],
  "stage_and_guard_checks": 169,
  "positive_unrelated_function_cases": 4,
  "successor_security_negatives": 67,
  "replay_unknown_stage_negatives": 3,
  "non_recursion": {
    "cycles": 0,
    "functions": 53,
    "unresolved_dynamic_sql": 0,
    "naive_cycle_trap_detected": true,
    "scoped_calls": 1,
    "provider_bridge_calls": 0,
    "transaction_read_only": "on"
  },
  "final_tables_preserved": 110,
  "partner_read": {
    "partner_composite_token_exact": true,
    "results": [
      {
        "rpc": "reviewed_pricing",
        "http": 200,
        "items": 54,
        "elapsed_ms": 1866.202
      },
      {
        "rpc": "workspace",
        "http": 200,
        "elapsed_ms": 144.888
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
  "static": {
    "parser_readonly": "PASS",
    "gates": 8,
    "embedded_selects": 1176,
    "source_provenance_negative_tests": 3,
    "execution_copies_identical": 8,
    "migration_hashes_exact": 4,
    "migration_114470_business_body_unchanged": true,
    "migration_114470_manual_copy_exact": true,
    "artifacts": [
      {
        "stage": 114450,
        "phase": "preaction",
        "sha256": "5a9254bcbc55246a89e99462e5583e89d250afea8d3c040ba52b102bd9fc2c91",
        "lines": 957,
        "rows": 454
      },
      {
        "stage": 114450,
        "phase": "postinstall",
        "sha256": "f0cc66161bef58168e1a8164816171b582b5577a5374c03916024ba1ab4a215f",
        "lines": 1032,
        "rows": 481
      },
      {
        "stage": 114460,
        "phase": "preaction",
        "sha256": "f195756ba126df6d6b52f9e9b382c102a5d9e28e7c9140ecdaeb17cc4002d5f0",
        "lines": 1032,
        "rows": 481
      },
      {
        "stage": 114460,
        "phase": "postinstall",
        "sha256": "90028907172c999eb9539c5f64536f91383aac1b8969a5ddefdbdd2303bcfb95",
        "lines": 1070,
        "rows": 488
      },
      {
        "stage": 114470,
        "phase": "preaction",
        "sha256": "f0c46271bbd637afe61ecfc550322d5a269b331012de155718c9ca0133876a84",
        "lines": 1070,
        "rows": 488
      },
      {
        "stage": 114470,
        "phase": "postinstall",
        "sha256": "a6c0e4e173bd75ba9521c2b37f8a7728105f5da316d314a6f46b51e818c958dd",
        "lines": 1088,
        "rows": 495
      },
      {
        "stage": 114480,
        "phase": "preaction",
        "sha256": "17ea983a332a90a3b184253fabd50c48528c0db5bf12689e9245097ef7431571",
        "lines": 1088,
        "rows": 495
      },
      {
        "stage": 114480,
        "phase": "postinstall",
        "sha256": "17985a514c7f459f5681d24ce3c910d45b5251c5e0bb064bc636cb93cd56085e",
        "lines": 1173,
        "rows": 523
      }
    ],
    "production_access": false
  },
  "production_access": false
}
```
