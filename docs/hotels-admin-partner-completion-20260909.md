# Admin + Partner completion: zero-write safe branch

## Evidence and limits

Accepted local HEAD: `4f73589177a70d23cbafd52a0549495f83401737`.
Human reports physical installation, postinstall, repair and history verification through
`20260811448000`. This task did not access production, run any SQL (including local SQL),
operate the browser, or verify those current database facts independently.

Selected immediate plan: **zero activation writes**, retain flags
`rooms=false, external=true, instant=false, stripe=false`, legacy architecture,
public booking disabled. No customer Hotels activation, backfill, booking creation,
Stripe connection, payment movement, or new provider source activation.

The package is statically validated, but final human production completion is NOT proven.
The supplied installation evidence is not evidence of current Partner permissions,
deployed Edge runtime, Stripe server configuration, or authenticated UI success.

## Exact target and authority

Hotel `9b6d99a0-923a-4fbc-be54-c066e856e6ca`.
Partner `0a321bfe-da6b-43f6-8e0b-7c68546a8b18`.
Assignment `a082c085-a6ea-46fd-8548-c8d9c6ee2c34`.
Do not alter other legitimate owner memberships, assignments or permissions.

114360 `hotel_v2_seven_arches_owner_capabilities()` establishes ten true capabilities
and two false capabilities. 114416 `hotels_lineage_private.permission_evidence()`
accepts exactly permission version 1 -> 2, with ONLY `request_booking_changes` and
`initiate_stripe_onboarding` changing false -> true and complete historical provenance.
Therefore the accepted current target is permission version 2 with all twelve true:

`edit_property_content`, `edit_property_photos`, `edit_room_content`,
`edit_room_photos`, `create_rooms`, `edit_room_structure`, `manage_prices`,
`manage_availability`, `process_bookings`, `request_booking_changes`,
`view_payment_status`, `initiate_stripe_onboarding`.

This is a provenance-derived expectation, NOT a fresh database observation.
The preactivation verifier checks the exact three IDs and outputs only safe capability
booleans/version. A mismatch is a STOP, not permission to blanket-grant or overwrite.

## Activation matrix

| Area | Required existing authority | Immediate global change |
|---|---|---|
| Admin Property / Rooms | authenticated server-verified Admin; existing reviewed control RPCs | none |
| Admin Pricing | exact reviewed 54-row control; fresh Review only for an explicitly authorized change | none |
| Admin calendar | Admin access, provider lineage, existing external=true; compatible worker for sync | none |
| Partner workspace | active Partner, can_manage_hotels=true, exact assignment, owner membership or separately scoped staff | none |
| Partner property / rooms | exact assignment capabilities above; proposal/review flow rather than bypass | none |
| Partner prices | manage_prices=true; reviewed pricing proposal contract | none |
| Partner calendar | manage_availability=true; provider proposal flow and external=true | none |
| Booking visibility | process_bookings=true; real existing data only; backfill deferred | none |
| Payments view | view_payment_status=true; existing presentation contract | none |
| Stripe status view | lifecycle DTO and server-derived account status | none; platform disabled is expected |
| Real Stripe onboarding | separate Partner grant + verified server readiness + global Stripe decision + owner/Hotel scope | NOT READY; deferred |

### Five separate Stripe concepts

A. Global/site capability: `hotel_stripe_connect_enabled=false` stays false now.
B. Assignment capability: legacy `initiate_stripe_onboarding=true` does NOT equal C.
C. 114470 audited Partner authorization: default `{version:0, enabled:false}`. Scope
evolution explicitly replaces the old capability test with `authorization_state(partner)`.
One Partner account serves all its Hotels; Hotel scope and owner membership are still required.
D. Platform readiness: 114480 requires a server attestation for
`hotels_standard_connect_server_v1`, fresh within 15 minutes. Installation does not create it.
E. Account: no connection is inferred. Only server-verified stored state may display CONNECTED.
With no account row, NOT_CONNECTED is a truthful status, not an error to repair.

`partner_connection()` returns can_connect only when platform enabled AND owner/Partner
authorization valid AND account absent/onboarding incomplete. The Partner Payments link
is rendered only for server `can_connect=true` (`js/hotels-v2-partner-workspace.js`).

114480 keeps public booking disabled even across supported lifecycle decisions. However
114420 public quote RPC checks `hotel_rooms_v2_enabled`; 114480 does not add the public
booking gate to that quote RPC. Thus rooms remains FALSE: do not enable it for internal UI.
Instant/public_booking decisions are rejected by the installed lifecycle contract.

## Minimum writes

ACTIVATION_WRITE_COUNT=0. ACTIVATION_WRITES=[] for the immediate retained-flags plan.
WHY: management/read capabilities already have an accepted per-assignment contract;
Stripe account connection is not required for Payments view.
OBJECT: none. OLD_VALUE=NEW_VALUE (all flags and permissions retained).
PUBLIC_BOOKING_IMPACT=none; STRIPE_EXTERNAL_CALL=NO; MONEY_MOVEMENT=NO.

Do not grant Stripe authorization merely to test a disabled button: it cannot enable the
hosted flow with platform=false. For a separately approved real onboarding phase the exact
audited grant RPC is
`public.hotel_v2_admin_set_partner_stripe_onboarding_authorization(uuid,boolean,bigint,uuid,text)`.
It requires target Partner, enabled=true, FRESH expected version, unique request ID and
reviewed trimmed reason (10..1000 characters). No request/version is invented here.
The global setter is separately versioned and requires server readiness plus explicit
`CONFIRM_HOTELS_CAPABILITY_CHANGE`. Neither setter is included in an executable payload.

Static search found no invocation of the Partner Stripe authorization Get/Set RPC in
current `admin/` or `js/` runtime files. The DB contract exists, but a dedicated Admin
grant UI is not established. Do not conflate the generic permission checkbox with this
grant. No frontend change or alternate privileged execution path was made in this task.

## Read-only handoff

Both repository files have byte-identical copies directly under `/private/tmp/`:

- `supabase/manual/hotels_v2_admin_partner_completion_preactivation_readonly.sql`
- `supabase/manual/hotels_v2_admin_partner_completion_postactivation_readonly.sql`

Each has 544 result rows: 529 required leaves, 14 report-only rows, one summary.
They reuse the exact committed successor-compatible 114480 metadata/security gates,
changing only the current history expectation from unrecorded to recorded and adding
the exact target checks/safe inventory/paired baseline hashes. No old migration pins
were learned from production or weakened. Original eight rollout gates remain unchanged.

Both begin BEGIN / READ ONLY / REPEATABLE READ and finish ROLLBACK. One result set;
no DDL/DML, mutating RPC, explicit locks, timeout override, Preview, Submit or Apply.
Local validation is OFFLINE PostgreSQL AST parsing, not SQL execution or live type/runtime proof.

Order for a separately authorized human read-only check:

1. Run only preactivation in a new SQL Editor query. Require 544 rows, all 529 required
   leaves true and PREACTIVATION_DB_SAFE=true. Retain safe reports and baseline hashes.
2. Check exact Partner permissions and fresh authorization/readiness/account inventory.
   The zero-write variant requires no authorization/account/OAuth rows and initial lifecycle.
   If legitimate state differs, stop for review; never delete or normalize it.
3. Perform only the no-op/read-only checklist below. No activation writes in between.
4. Run postactivation. Require POSTACTIVATION_DB_SAFE=true and compare ALL eight
   baseline_sha256 rows with preactivation. These cover all assignments/permission rows
   (including unrelated owners), rates, plans, schedules, tiers, pricing authority and commission.
   Historical receipts and payment lineage are additionally checked by required gates.
5. Completion requires BOTH DB_SAFE results AND paired baseline equality AND human smoke.
   A DB_SAFE summary alone is NOT a proof that only authorized changes occurred between runs.

External Stripe/money activity cannot be established by a database-only read. This task
made zero such calls; do not claim historical external activity from empty local tables.
No private row data, user identity, account ID, token, provider URL or secret is returned.

## Edge compatibility boundary

The SQL checks installed worker RPC source/security, provider lineage and canonical
114425 fingerprint. It explicitly reports deployed Edge runtime as NOT_PROVEN_BY_SQL.
Expected Edge source: `supabase/functions/hotels-v2-external-calendar-sync/` with
booking_com / airbnb / ical support and the committed worker RPC contract.
Installed migrations are NOT evidence of deployed Edge bytes. Obtain existing human
deployment/version evidence before any new source approval, sync enqueue or trigger.
Do not deploy, enter URLs, invoke the worker, or change secrets in this task.

## Compact human E2E checklist — real production data only

Use authenticated Admin and legitimate Partner sessions manually; do not share tokens/PII.
All mutation controls below are inspection-only. A no-op must send zero mutation RPCs.

| Actor / section | Pass condition | Forbidden action |
|---|---|---|
| Admin Property | real 7 Arches identity, current content and controls load | Save/Apply content |
| Admin Rooms | real Upper/Ground IDs and relationships, no synthetic rows | create/delete room |
| Admin Pricing | 54 rows, 27 each, EUR100 bases, full tiers; selecting unchanged values sends no Preview/Apply | price edit or Review creation |
| Admin External calendar | current real sources/status or honest empty state; provider contract loads | URL entry, trigger/sync, proposal approval |
| Admin Partner & Access | exact three IDs, permission v2, all twelve booleans; other owners preserved | reassign, blanket grant |
| Admin Stripe authorization | do not accept legacy checkbox as audited grant; dedicated UI currently unproven/absent | grant, global toggle, readiness attestation |
| Admin Payments | real authorized status/empty state, EUR10 commission and payment terms unchanged | charge/refund/routing change |
| Partner Overview | real assigned Hotel only, accurate capabilities/status | fabricate KPI or account state |
| Partner Property | real content/photos, current proposal controls respect permission | submit proposal |
| Partner Rooms | correct real Upper/Ground data; scoped controls | create/edit/delete |
| Partner Rates | 54 authoritative rows, full matrix, unchanged input sends no Review | submit/Apply prices |
| Partner Calendar | existing real availability/provider status; truthful unavailable states | sync/proposal/URL |
| Partner Bookings | real authorized rows or honest empty state | create booking; backfill/history migration |
| Partner Payments | real authorized payment presentation or honest empty state | charge/refund |
| Partner Stripe | disabled platform shown; no Connect link at can_connect=false, no assumed CONNECTED | click Connect/refresh against Stripe |

Booking history/backfill=DEFERRED. Later new-booking visibility needs separate approval;
do not manufacture a production booking as a smoke test. Public/customer Hotels=OUT OF SCOPE/OFF.

## Source synchronization audit

Local origin/main tracking ref is `2d7277fba6edf75107b8a8835561dde260ec157c`.
No fetch/network was performed, so this is NOT a fresh remote HEAD attestation.
Against that accepted baseline: 5 commits, 63 committed changed files, 5 migration files.
Commits: b2d814c, c081653, f8fe376, 83b0050, 4f73589.
Migration files: 114416, 114420, 114450, 114470, 114480 (final successor corrections).
No frontend runtime/dist differences in this range. Cloudflare frontend deployment is
not required by its content. A later push may still trigger existing Git automation;
do not alter settings or push without authorization.

SOURCE_SYNC_REQUIRED=YES. The final authoritative migration/package range is local.
This task adds four uncommitted repository files: this document, two read-only verifiers
and their offline builder/static test. They are not included in the 63 committed files
or the previously sealed 92-entry manifest. That prior manifest is intentionally unchanged.

## Remaining completion evidence

Do not claim final completion until the new production read-only results, paired baseline
comparison and human no-op E2E exist. Real Stripe onboarding additionally needs a dedicated
audited grant UX/channel and independently approved/verified platform readiness and global
activation; it remains deferred, not silently enabled. Deployed worker compatibility also
needs external evidence. No migration/application/Edge source was modified here.
