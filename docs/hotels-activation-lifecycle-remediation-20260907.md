# Hotels activation lifecycle — partial local implementation, NOT a rollout

> Historical 7 September diagnosis. The resumed global implementation and current
> test results are in `hotels-capability-lifecycle-validation-20260908.md`.
> Statuses below describe the earlier 114470-only checkpoint, not the successor.

Baseline `bd382df5695e8e9dbcedcaeb2dad226377be28f6` on
`feature/hotels-admin-partner-functional-completion`. The user reports production
114415; production was not accessed. This report supersedes no historical PASS
and must not be read as full lifecycle completion.

**Overall result: FAIL / incomplete.** Exact diagnosis and the separately approved
Partner onboarding authorization are implemented/tested. The global flag
successor contract, its UI integration and full enabled forward chain are NOT
implemented. No production-ready package or 100% readiness is claimed.

## Exact rejection graph and classification

These are the actual installed sources in the local accepted-through-114450
fixture, not merely text from a superseded migration.

| Contract | Actual rejection / effect | Classification |
|---|---|---|
| `hotel_v2_public_quote_seven_arches(jsonb)` / `hotel_v2_public_create_seven_arches_booking(jsonb)` | Rooms false: `42501:hotels_v2_public_booking_disabled`, before quote issuance/booking writes | INTENDED_CURRENT_SAFETY_GUARD |
| Public quote core → reviewed pricing authority → receipt chain → independent topology | Rooms true: `55000:hotels_v2_seven_arches_public_quote_authority_invalid`, notice `BASE_TOPOLOGY` | MISSING_FUTURE_ACTIVATION_STAGE |
| `hotel_v2_seven_arches_pricing_scoped_lineage()` | Requires Rooms/Instant/Stripe false and exact historical permission snapshot/version 1; returns NULL otherwise | INTENDED_CURRENT_SAFETY_GUARD at the frozen boundary; requires an explicit successor |
| `hotel_v2_seven_arches_independent_pricing_activation_lineage()` / `...independent_pricing_legacy_projection()` | Reject changed lifecycle before accepting predecessor projections | MISSING_FUTURE_ACTIVATION_STAGE |
| `hotel_v2_external_calendar_site_settings_fingerprint()` (114425) | Requires Rooms/Instant/Stripe false; returns NULL for changed values; accepts either exact external boolean | MISSING_FUTURE_ACTIVATION_STAGE, not permission to remove the test |
| `hotel_v2_external_calendar_provider_lineage_bridge_is_exact()` | Pins lifecycle hash `9d385718…`, helper source, scoped lineage and immutable provider receipt | INTENDED_CURRENT_SAFETY_GUARD; a new audited bridge is needed |
| `hotel_v2_external_calendar_stage2_compatible_fingerprints()` / Task2 canonical snapshot / Task2 validator / ADMIN-D snapshot | Carry the same predecessor boundary in protected-map or current-safe validation | MISSING_FUTURE_ACTIVATION_STAGE |
| `hotel_v2_external_calendar_guard_source()` | Source changes require external true and other three flags false | INTENDED_CURRENT_SAFETY_GUARD; do not break calendar source writes by changing only topology |
| `hotel_v2_h3_2a_require_partner_hotel_access(uuid,uuid,text,boolean)` | `55000:hotels_v2_h3_2a_public_activation_guard` after exact membership/capability checks if Rooms/Instant/Stripe enabled | MISSING_FUTURE_ACTIVATION_STAGE |
| `hotel_v2_partner_list_assigned_properties(uuid)` / `hotel_v2_h3_2b_flags_off()` | Same legacy-only boundary; the latter also guards mutation paths | INTENDED_CURRENT_SAFETY_GUARD; must not redefine it broadly as true |
| `hotel_v2_partner_get_workspace(uuid,uuid,date,date)` | Emits literal false for Rooms/Instant/Stripe in its current contract | STALE_LIFECYCLE_ASSUMPTION for a future enabled DTO, not correct current-state output after activation |
| `hotel_v2_admin_c_validate_pricing_graph(uuid)` | Rooms true raises `23514:hotels_v2_admin_c_7k_new_pricing_must_remain_inactive` | MISSING_FUTURE_ACTIVATION_STAGE |
| Generic Admin guest/property/room/pricing/permission Apply guards and historical preparation | Intentionally disallow public flags; must not be opened incidentally by a broad flags helper rewrite | INTENDED_CURRENT_SAFETY_GUARD |
| Partner Core `validateWorkspace`, Admin Core permission/pricing/activation validators | Require exact false for Rooms/Instant/Stripe; Partner additionally requires legacy/public invariants | STALE_LIFECYCLE_ASSUMPTION only for a new versioned enabled contract |

Missing/non-boolean flags, invalid cardinality, changed membership or permissions,
source/ACL/RLS/trigger drift remain real errors, not a supported lifecycle.
There is no existing canonical Admin Rooms/Stripe flag activation controller
in the inspected accepted runtime. Do not use direct `site_settings` DML as one.

The diagnostic isolated an additional permission boundary:

- 114360 owner capabilities contain `initiate_stripe_onboarding=false`.
- `hotel_v2_seven_arches_pricing_scoped_lineage()` compares the complete current
  permission snapshot with `v_owner.after_permission` and requires version 1.
- 114460 originally required `permission.initiate_stripe_onboarding IS TRUE`.
- Stripe true alone still denies the owner. Changing the Hotel permission alone
  while all flags stay false independently makes scoped lineage NULL.

The user subsequently explicitly approved a **separate auditable Admin decision
per Partner**, never an automatic install/global-flag grant. This is the only new
server capability implemented in this turn.

## Flag semantics and minimum safe dependency graph

| Flag | Exact current meaning / safe future rule |
|---|---|
| `hotel_rooms_v2_enabled` | The existing explicit public quote + request-booking API gate. It is NOT needed merely to use the Admin/Partner backend. Retain that public meaning; do not relabel it backend readiness or enable it as an internal prerequisite. |
| `hotel_external_sync_enabled` | Independent scheduler/worker/source activation gate. A true flag is insufficient without reviewed enabled source, private binding, worker/scheduler readiness and exact provider lineage. Preserve the current true value. |
| `hotel_stripe_connect_enabled` | Platform connection capability only. Requires 114460, signed webhook/configuration readiness, exact authorization and the yet-unimplemented compatible lifecycle. Does not imply a connected account, payments routing or public booking. |
| `hotel_instant_booking_enabled` | Must remain false. No implemented compatible instant-booking lifecycle or approved routing/settlement contract was established. A new controller must reject enabling it until a separately specified and tested contract exists. |

Do not add another public flag simply to work around the existing gate. Backend
readiness can already be derived from installed contracts and exact current-safe
checks. A public request-booking API is distinct from immediate confirmation,
and from publishing a customer-facing UI. Do not change Hotel architecture or
publication as a side effect of either Stripe or Rooms activation.

Required future order, not execution authorization:

```text
114415 reviewed independent pricing
  → 114420 application/public booking infrastructure (Rooms remains false)
  → 114425 settings compatibility → 114450 providers
  → 114460 Partner Standard Connect storage/Edge contract
  → 114470 explicit Partner onboarding permission (installed with zero grants)
  → MISSING: audited global lifecycle successor + versioned client compatibility
  → local full enabled-chain / UI / security validation
  → separately authorized Edge/configuration readiness verification
       ├─ explicit platform Stripe capability enable
       ├─ explicit Admin grant to a named Partner (may precede platform enable)
       └─ both true + owner/Hotel authorization → server-verified Standard OAuth

Reviewed prices + allocation + calendar + payment/commission + booking lineage
  → separate human public-rollout approval → existing Rooms/public gate

Instant booking: blocked; no implicit dependency on or activation by Connect.
```

Stripe account connection is Partner-scoped, not per Hotel. Public bookings need
not require Stripe when the authoritative payment policy supports other methods.
EUR 10 per allocated Room/night remains unchanged; no percentage fee or routing
architecture is inferred. No existing connected account is required to enable
the platform capability, otherwise the first Partner could never onboard.

## New 114470 — approved Partner permission only

`20260811447000` was absent from the repository chronology before creation; the
latest Hotels candidate was the untracked 114460. It is a future migration after
114450/114460, not a patch to any of the 238 tracked migrations.

- Private append-only per-Partner authorization ledger, RLS/FORCE RLS, no raw
  PUBLIC/anon/authenticated/service_role access or policies.
- Hash-linked decisions include Partner, monotonic version, previous/current
  boolean, Admin, request UUID, reason, and timezone-normalized timestamp.
- Admin-only Get and Set RPCs use the existing authenticated Admin predicate,
  postgres ownership, protected search_path and exact ACLs.
- Explicit expected version and request identity; same-actor replay does not
  insert again, conflicting request rejects, competing version has one winner.
- Replay of an old grant after revocation reports current=false and cannot
  regrant. Revocation is permitted for an inactive/unassigned Partner.
- No automatic grants; initial ledger empty. No global flag change, account
  creation, pricing/payment/commission write or historical receipt rewrite.
- Evolves ONLY the unapplied 114460 scope/writer with exact BEFORE source and
  metadata guards. All owner membership and exact Hotel assignment checks stay.
- The newly authorized Partner-level right is distinct from the preserved
  historical Hotel permission column. That old column is not set true or used
  as a bypass. The new ledger is the authority for future connection permission.
- Grant/revoke shares the Partner row lock with the connection writer; writer
  rechecks scope after its lock. Status reads do not acquire mutation locks.
- Trusted service-role server and privileged postgres remain trust boundaries;
  this is not cryptographic exclusion of superuser changes.

RPCs (LOCAL WIP, no production invocation):

```text
hotel_v2_admin_get_partner_stripe_onboarding_authorization(uuid)
hotel_v2_admin_set_partner_stripe_onboarding_authorization(uuid,boolean,bigint,uuid,text)
```

Source evolution:

| Function | BEFORE prosrc SHA-256 | AFTER prosrc SHA-256 |
|---|---|---|
| `hotel_stripe_connect_private.scope(uuid,uuid,uuid)` | `38c1f9e1448f6632712ea5e4ba22b2ccc9fd481d784b5b1f586e17a07b71e100` | `58c64002fd15b8690a7e2e89b64120225763415517674c9a2e0a350b07b16eda` |
| `hotel_v2_stripe_connect_service(text,jsonb)` | `51edcefdd3a898db8550aff6b290b1d6b3c8f633f3684458ed1fbf17d5558f32` | `72869ca7d965c802b5ad67f6235cbbe1712f56c1961fd5beaadb35f200aac0c4` |

## Tests actually run this turn

- PG16.13 local copied fixture at loopback 55479, not production.
- Eight Rooms/Stripe/Instant combinations with external=true: exact current
  rejection graph reproduced. This is diagnosis PASS, not enablement PASS.
- Two additional negatives independently prove flag != permission and permission
  changes invalidate the historical preset. Entire matrix ROLLBACK and restored
  provider-safe/flags/permission/empty Stripe tables confirmed.
- Exact final 114460 → 114470 installation and both read-only verifiers PASS.
  Both verifiers reported `transaction_read_only=on` and ended with ROLLBACK;
  postinstall zero authorization receipts, no flag enabled.
- Replay of 114470 rejected before writes with
  `hotel_stripe_authorization_install_boundary_invalid` (psql exit 3).
- Real loopback PostgREST permission gate PASS: 20 negatives, one concurrent
  winner, exactly two grant/revoke receipts, final permission false. No account
  created, no live Stripe call. The same granted Partner covers two assigned
  Hotels and a co-owner; staff/foreign Partner/foreign Hotel denied.
- Exact business and old permission/owner-receipt JSON fingerprints unchanged;
  provider-safe remains true with global flags restored false.
- Old 238 migrations and unrelated owner preflight/file binary diff preserved.
- No frontend code changed in this turn. Prior E2E 98 / Jest 53 / build PASS
  are historical results, NOT coverage of a new enabled lifecycle. Not rerun.

## Exact files and hashes

| Artifact | SHA-256 | Lines |
|---|---|---:|
| `supabase/migrations/20260811447000_hotels_v2_partner_stripe_onboarding_authorization.sql` | `7eda4c43fcd4374e30221a0c7d3606090a3414ba4f9d2cf27363474bba1875c0` | 265 |
| `supabase/manual/hotels_v2_partner_stripe_authorization_prewrite_readonly.sql` | `2aace5cfa94917d6fdecbd41693b51a0307550aea600bef8c390940158eea387` | 29 |
| `supabase/manual/hotels_v2_partner_stripe_authorization_postinstall_readonly.sql` | `5f0b51adc88261428b2f859648b359e38a8ba729bc76e7f8eae350b76433cb50` | 72 |
| `tests/integration/hotels-v2-activation-lifecycle-boundary-postgres-gate.sql` | `43a6313f5593879de6c353f8c374e91dae4916de07fe2e38df36e2675566f7d8` | 139 |
| `tests/integration/hotels-v2-stripe-authorization-postgrest-gate.mjs` | `49e6f49fc73dcf954447d5302061d40db1b8b6adceca426acd745c6983384b7a` | 126 |

## Remaining implementation — do not skip

The exact unresolved implementation is a non-recursive audited successor bridge
for enabled flags and all immutable predecessor fingerprints/source contracts.
It must prove the actual enabled state, not return a false flag object as current
truth, rewrite old receipts, remove exact comparisons, or blindly accept hashes.
It also needs guarded explicit Admin platform transitions with concurrency and
idempotency, honest versioned Admin/Partner DTOs, unchanged generic-pricing freeze,
calendar compatibility, and full enabled booking/Stripe/UI regression.

114420/114425/114450 need no edit based on this diagnosis: their frozen-stage
checks are intentional. A further additive global lifecycle stage is required.
No migration version for that unfinished stage has been allocated or file made.
114470 alone does **not** fix the Rooms/Stripe true topology and is not a safe
substitute for that stage. Do not deploy this partial batch.

```text
HOTELS_ACTIVATION_LIFECYCLE_REMEDIATION=FAIL (incomplete)
ROOMS_ENABLE_REJECTOR=reviewed authority → BASE_TOPOLOGY → predecessor lifecycle
STRIPE_ENABLE_REJECTOR=predecessor lifecycle + independent Partner permission
ROOT_CAUSE=MISSING_FUTURE_ACTIVATION_STAGE
ROOMS_FLAG_SEMANTICS=EXISTING_PUBLIC_QUOTE_AND_REQUEST_BOOKING_GATE
STRIPE_FLAG_SEMANTICS=PLATFORM_CONNECT_CAPABILITY_NOT_PARTNER_PERMISSION
INSTANT_FLAG_SEMANTICS=UNSUPPORTED_KEEP_FALSE
PUBLIC_BOOKING_GATE=hotel_rooms_v2_enabled; no new redundant public flag
SAFE_ACTIVATION_ORDER=see graph; global successor remains missing
114420_CHANGE_REQUIRED=NO
114425_CHANGE_REQUIRED=NO
114450_CHANGE_REQUIRED=NO
NEW_POST_114450_ACTIVATION_MIGRATION_REQUIRED=YES (global stage remains missing)
NEW_MIGRATION_FILES=20260811447000_hotels_v2_partner_stripe_onboarding_authorization.sql (permission only)
NEW_MIGRATION_SHA=7eda4c43fcd4374e30221a0c7d3606090a3414ba4f9d2cf27363474bba1875c0
NEW_MIGRATION_LINES=265
INSTALL_AUTO_ENABLES_ROOMS=NO
INSTALL_AUTO_ENABLES_STRIPE=NO
INSTALL_AUTO_ENABLES_PUBLIC_BOOKING=NO
INSTALL_AUTO_ENABLES_INSTANT=NO
ROOMS_ENABLE_LOCAL_TEST=FAIL (existing rejection reproduced)
STRIPE_ENABLE_LOCAL_TEST=FAIL (global lifecycle; separate authorization gate PASS)
INVALID_COMBINATIONS_FAIL_CLOSED=PASS (current eight-case boundary)
PUBLIC_BOOKING_REMAINS_OFF=PASS
FULL_FORWARD_CHAIN_LOCAL=FAIL (not complete; local 114460→114470 PASS)
PREWRITE_VERIFIER=supabase/manual/hotels_v2_partner_stripe_authorization_prewrite_readonly.sql
PREWRITE_SHA=2aace5cfa94917d6fdecbd41693b51a0307550aea600bef8c390940158eea387
POSTINSTALL_VERIFIER=supabase/manual/hotels_v2_partner_stripe_authorization_postinstall_readonly.sql
POSTINSTALL_SHA=5f0b51adc88261428b2f859648b359e38a8ba729bc76e7f8eae350b76433cb50
FOCUSED_E2E=NOT_RUN_THIS_TURN
FOCUSED_JEST=NOT_RUN_THIS_TURN
LOCAL_POSTGRES=PASS_FOR_DIAGNOSIS_AND_114470; NOT_FULL_LIFECYCLE
LOCAL_POSTGREST=PASS_FOR_114470; 20_NEGATIVES; ONE_CONCURRENT_WINNER
BUILD=NOT_RUN_THIS_TURN (no asset change)
GIT_DIFF_CHECK=PASS
MIGRATION_FREEZE_OLD_238=PASS
OWNER_PREFLIGHT_UNTOUCHED=PASS
LOCAL_COMMITS=NONE
PUSH_EXECUTED=NO
MERGE_EXECUTED=NO
DEPLOYMENT_EXECUTED=NO
PRODUCTION_ACCESSED=NO
PRODUCTION_SQL_EXECUTED=NO
ADMIN_LOCAL_READINESS_PERCENT=NOT_SCORED_NOT_100
PARTNER_LOCAL_READINESS_PERCENT=NOT_SCORED_NOT_100
ACTIVATION_LIFECYCLE_READINESS_PERCENT=NOT_SCORED_NOT_100
PRODUCTION_EXECUTION_READINESS_PERCENT=NOT_SCORED_NOT_100
READY_FOR_BACKUP_THEN_FINAL_ROLLOUT=NO
REMAINING_BLOCKERS=enabled-state immutable-lineage successor and integration not implemented
NEXT_EXACT_HUMAN_STEP=do not roll out; review this partial result, not a final release
```
