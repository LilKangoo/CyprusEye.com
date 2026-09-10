# 114485: scoped Admin/Partner runtime consistency

Baseline: d78456d9eed9f68215dcde467243e5ac7fa6f9ab (through 114484).
Local-only validation; no production connection, push or deployment.

## Proven leaves and scope

* H3.2A assigned-properties discovery deliberately returns `foundation_only=true`
  and `workspace_available=false` (113200, lines 963–995). The Partner client
  validates those historical constants but its Open workspace button is not
  gated by them (`js/partners.js`, renderAssignedHotels). Operational access is
  independently checked by H3.2B. No Partner contract/source change is needed.
* The frozen ADMIN-B content GET still contains `hotel_rooms_v2_enabled or false`
  after 114350 removed only the external-sync rejection. An authenticated local
  read with an audited Rooms ON decision reproduces exactly 55000 /
  `hotels_v2_admin_b_public_activation_guard`. Its assignment GET dependency
  already supports current flags. The browser had two additional all-off checks.
* Add only `hotel_v2_admin_get_content_control_114485(uuid)`, using the exact
  historical read body with one guard replacement. Do not rewrite any existing
  function, source adapter, receipt, or writer. Preserve Admin authorization,
  null/foreign ID errors, singleton settings, DTO fields, owner, ACL and STABLE
  security-definer metadata. Rooms must match the audited lifecycle; public
  booking/instant/Stripe remain false. External sync must be a boolean. The
  client uses this new read only; permission mutation validation stays unchanged
  by default. Deployment must follow installation of 114485; there is no fallback
  to the incompatible historical RPC and no write retry.
* The ADMIN-B property writer already compares amenities with DISTINCT/sorted
  values (113400, around lines 2463–2467). `normalizeAmenities` also treats them
  as a set. Partner Review instead used order-sensitive array serialization.
  Only its comparison copies are now deduplicated/sorted; both original arrays,
  all canonical data, and all submitted reviewed plans retain their values.

## Targeted results

* PostgreSQL 16 loopback 127.0.0.1:55489, database hotels_114485_test: 18/18.
  Exact baseline error; preaction 8/8; installation zero business changes;
  unchanged predecessor metadata; postinstall 9/9; current-flags read succeeds;
  replay/auth/identity/unsafe-flag negatives; actual Partner submit -> Admin
  reject preserves the full canonical Hotel. Proposal flow rolls back fully.
* Jest: 29/29 across 114485 consistency, ADMIN-B core and property-proposal Admin
  client suites. Includes default write validation, malformed flags, mismatched
  nested flags, foreign Hotel, 19 reordered amenities, actual additions/removals,
  and existing reviewed-cache burn/no-retry checks.
* Chromium: 3/3: real Review renderer + repository with mocked transport;
  existing Partner property-photo submit and commercial-owner workspace cases.
* Normal build passes. Only the three corresponding Admin dist mirrors change.

The SQL harness requires a disposable synthetic boundary with recorded 114484
and an audited Rooms ON decision. It accepts no arbitrary database URL. Run with
`HOTELS_114485_PSQL=<local-pg16>/bin/psql node tests/integration/hotels-v2-114485-content-read-gate.mjs`.
It removes only the test successor from that named synthetic database to exercise
installation. Never point a test at production.

## Manual handoff (not executed by this task)

The two committed `supabase/manual/hotels_v2_114485_*_readonly.sql` gates have
byte-identical `/private/tmp` copies. Both use READ ONLY / REPEATABLE READ and
ROLLBACK with one result set. Preaction expects 8 true rows, postinstall 9.
Postinstall is designed before separately authorized history reconciliation.
Human preaction is the next boundary, not authorization to install or deploy.
