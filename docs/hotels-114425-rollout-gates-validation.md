# Final successor-compatible 114425 rollout gates

Starting checkpoint: `c081653a7806651f5d5f06c704420bb976652030`.
Branch: `feature/hotels-lineage-successor-final`.
This supplement changes verifiers, focused test support and documentation only.
No migration bytes change. No production action is authorized by these files.

## Exact artifacts

| Artifact | SHA-256 | Lines | Rows on success |
|---|---|---:|---:|
| `supabase/manual/hotels_v2_114425_preaction_readonly.sql` | `80b83c4a2f21680591a5a766ad99595b9d297aec2c742d9989f0452ede095ae6` | 668 | 145 |
| `supabase/manual/hotels_v2_114425_postinstall_readonly.sql` | `706be05b1bdd36823e8d69ea6db6a786df00b04558fe90903666974d94f22042` | 687 | 148 |
| `supabase/migrations/20260811442500_hotels_v2_external_calendar_site_settings_compatibility.sql` | `d72c244840bd21a5c5e7e46f654c8b3a7466f80f1d18ebac3ca938ab43163ee5` | 306 | N/A |

Byte-identical manual verifier copies use the same basenames under `/private/tmp`.
The existing `/private/tmp/hotels_v2_prod_114425.sql` remains unchanged and exact.

Both gates require history 114416=1, 114420=1, 114425=0, and
114450/114460/114470/114480=0. Postinstall runs AFTER physical installation but
BEFORE history recording. Neither a successful gate nor the manual copy grants
permission to execute the migration or repair history.

## Derivation, checks and safety

The offline builder pins the accepted 114420 postinstall artifact by SHA and
retains all bridge catalogs, successor source/security contracts, history,
commercial, pricing, flags, maintenance and residue checks. Only its stage
expectation changes: 114420 must now be recorded. The previous 114425 helper
absence leaf is replaced with complete function-name/overload and relation/type
collision checks. No obsolete d98d2ff temporary wrapper is used.

All nine legacy 114425 readiness guards are accounted for: eight are converted
without weakening into named scalar SELECT leaves, and the old helper-absence
guard is superseded by the broader collision checks. Null conditions fail
closed. The legacy source file is pinned and remains unchanged.

Preaction has 130 scalar leaves plus 14 source/security pins: 144/144.
Postinstall adds exact function metadata and canonical behavior checks plus a
helper source/security pin: 147/147. Each emits one result table with one final
summary row, readiness, blocker_codes, required_leaf_count and passed_leaf_count.

The helper must have no arguments, return text, use plpgsql/STABLE/SECURITY
DEFINER, belong to postgres, and retain only `search_path=pg_catalog, public`.
Its full source SHA is
`e297f1b640f544644d695b36b4aca0b2dc90385e83709e8a494044aabc3b95bd`.
PUBLIC/anon/authenticated/service_role execution remains revoked; direct
non-owner ACLs and unintended overloads fail closed. The exact source accepts
external sync false or true, requires the other three flags false, validates
historical external-calendar receipt integrity and function lineage, and
fingerprints a fixed Hotels-only semantic projection, not unrelated settings.
Operational gates still require the actual accepted external sync value TRUE.

Both files use BEGIN / READ ONLY / REPEATABLE READ, a stable catalog search_path,
one SELECT and final ROLLBACK. No timeout override, DDL, DML, mutating RPC,
Preview/Submit/Apply, cleanup or explicit lock statement is present. All 130/132
embedded queries parsed as single SELECTs; no modifying CTE, SELECT INTO or
locking clause exists. Pinned mutation function names are inspected, not called.
The new helper behavior is not executed when its source/security pin fails.

## Disposable local validation, 2026-09-09

Owned synthetic database: `hotels_114416_successor_post425_20260909a`, loopback
127.0.0.1:55479, PostgreSQL 16.13 (Postgres.app). No production access occurred.
The accepted synthetic baseline was recreated through 114415 with equal EUR100
rates and external sync true; the existing permission-transition and physical
qualification fixture, exact 114416 and exact 114420 were then installed.
Only this owned database was changed. No unrelated cluster was stopped.

| Check | Result |
|---|---|
| Preaction | PASS 144/144; 145 rows; approximately 1083 ms |
| Exact local 114425 install, once | PASS; 22.818 ms |
| Previous function definitions unchanged | 358/358 |
| Added functions | Exactly `hotel_v2_external_calendar_site_settings_fingerprint()` |
| Table contents unchanged across 114425 | 97/97 |
| Postinstall before recording | PASS 147/147; 148 rows; approximately 1095 ms |
| External sync false / true | Identical expected canonical fingerprint; 2/2 PASS |
| Unrelated synthetic settings column/value | Same canonical fingerprint; PASS |
| Rooms / Instant Booking / Stripe enabled | Helper returns NULL; 3/3 fail closed |
| Catalog/history/source/residue negatives | 23/23 fail closed |
| Total focused negatives | 26/26 PASS |
| Simulated local history recording | Same postinstall rejects only recorded_114425; 146/147 |
| Existing read-only 114450 preflight after recording | PASS, preflight_v3; no 114450 installation |
| 114416 anchor / lineage / receipt chain / topology / activation safe | PASS |
| Tiers / authority / base rates | 27 / 27 / 54; EUR100 / EUR100 |
| Parity / guest-one / allocation | 100/0; 20/0; exact |
| Commission / payment lineage | EUR10 per allocated Room per rental night; exact |
| Flags / public booking | false/true/false/false; disabled |
| Quote / new bridge booking / context / receipt rows | 0 / 0 / 0 / 0 |

The 23 negatives cover wrong 114420 history, early 114425 history (both stages),
missing 114416 anchor, wrong bridge source, wrong topology, commission, external,
instant and Stripe flags, public booking enabled, unexpected synthetic booking
and quote rows, preaction overload/relation collision, wrong helper owner,
definer mode, search_path, ACL, source, postinstall overload, premature 114450
history and premature provider receipt relation. These are rollback-contained
fault injections in the disposable fixture, never actions performed by a gate.

The minimal fixture contains only id and four lifecycle flags. An initial test
harness assumption about an `updated_at` column failed; the test was corrected
to add/populate an unrelated synthetic column inside a rolled-back transaction.
Neither migration nor gate comparisons changed. Both supported external states
and the unrelated-settings behavior subsequently passed.

Reproduce with the existing baseline/fixture/prelude/probe harnesses, then
`tests/integration/hotels-v2-114425-rollout-gate.mjs` using
HOTELS_114425_TEST_PHASE in order: prepare, preaction, install, postinstall, record.
HOTELS_RECONCILIATION_DB must match the owned post425 synthetic prefix and the
PSQL executable must connect only to loopback port 55479. Install is a separate
phase so failed tests never automatically reinstall the migration. The owned
database is disposed after validation; other fixture databases are preserved.

## Human sequence and recovery evidence

1. Human executes final preaction; require PREACTION_READY=true, blockers empty.
2. Obtain separate authorization, then physically install 114425 once.
3. Immediately run final postinstall BEFORE repair; require POSTINSTALL_READY=true.
4. Only after PASS, obtain separate repair authorization and verify history.
5. Only then consider 114450; no later-stage installation is authorized here.

Recovery point remains the human-confirmed 09 Sep 2026 05:37:22 UTC, COMPLETED,
PHYSICAL, Restore available. SQL does not establish backups. No push, merge,
deployment, production SQL, migration repair or production mutation occurred.
