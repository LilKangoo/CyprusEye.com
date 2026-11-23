# Reviewed direct Partner calendar apply — 114496 DRAFT

**STATUS: DESIGN / SQL DRAFT ONLY — NO PRODUCTION INSTALLATION, NO SQL EXECUTION.**

The owner has explicitly chosen **self-service connections without per-calendar Admin approval**. The current public RPC `hotel_v2_partner_apply_external_calendar_plan_114493` places operations into `pending_admin_review`; the new RPC in the accompanying `.sql` is a proposed, separate entrypoint which calls the **existing reviewed** `hotel_v2_external_calendar_apply_common_114493('partner',...)`. It does not replace or mutate reviewed 114489/114493 functions.

## Source facts reconciled

- Production preflight: Hotel `9b6d99a0-923a-4fbc-be54-c066e856e6ca` has `rooms_v2`, one site_settings row, global external sync enabled and scheduler-ready = true; two active room types.
- Both active rooms have 0 external sources and 0 reviewed/enabled sources.
- Hotel-wide count 1 refers to `manual-primary`, source ID `7416941f-b183-4ead-8a7c-4cea93c5b229`, `source_type=manual`, `room_type_id=NULL`, enabled/reviewed. This is **not** an orphaned ICS source. The reviewed provider predicate `hotel_v2_external_calendar_ics_source_type_is_supported` returns true only for `booking_com,airbnb,ical`. External control/worker use this predicate. **Preserve the existing manual record.**
- Enabling a second active external source assigned to the SAME room currently fails a source guard; multi-feed support is a separate reviewed task.

## Mandatory before merging a live migration

1. Prove this new public entrypoint does not disturb installed certificate/catalog lineage or privilege posture; check the _114493 seal with a fresh isolated DB snapshot.
2. Confirm _114493 `apply_common` has the exact inspected production source hash/ACL and works under a new security-definer wrapper, without granting caller direct EXECUTE on that common helper.
3. Test every action via pre-existing partner preview RPC, with real authenticated JWT and a full valid assignment: `calendar_source/create`, `ical_secret/set` (private HTTPS ICS), `calendar_source/enable`, `calendar_sync/trigger`. Every stage is a distinct reviewed plan with a fresh snapshot/idempotency key, **not** an unreviewed multi-step transaction.
4. Prove forbidden partner / unassigned hotel / wrong room / wrong actor / no manage_availability / revocation mid-step / stale preview / replay / duplicate source all reject with zero writes. Verify receipt/log state and no secrets in response.
5. Test ICS URL safety against SSRF, redirects, rebinding, private/loopback addresses, timeouts, non-ICS response and oversized responses, including server fetcher. **The input HTTPS regex alone is not enough.**
6. Test worker outage or global sync OFF; no optimistic 'Connected'. Only a successful fetch / parsed availability / committed day blocks qualifies for connected state.
7. Confirm manual source `manual-primary` is unchanged before/after and no automatic booking, public quote mode, email or Stripe activates.
8. Package migration under `supabase/migrations/` only after reviews and isolated DB test; do **not** copy this draft into production SQL Editor.
9. Implement a separate, idempotent client wizard orchestration with a secure URL field. The current frontend still sends Admin proposals and must not be switched to this RPC without separate browser + auth tests.
10. Confirm approved rollback and audit/incident procedure, and close negative access tests tracked in #178.

## Current release

`PUBLIC_BOOKING=OFF` · `MANUAL_REQUEST=OFF` · `STRIPE_CHARGES=OFF` · `INSTANT_BOOKING=OFF` · `RELEASE=INCOMPLETE_DO_NOT_APPLY`.

## Pinned provenance / SQL no-write preflight

The reviewed 20260811449300 SQL migration source contains the exact PostgreSQL `prosrc` bytes for three common helpers (SHA-256 UTF-8 of their source bodies): `apply_common_114493=062355e3b34d98b3eeacff83cfc2f472b24eafe33dffe1a78bb5196a5dfc7a52`; `preview_common_114493=f500acc85f39bbe0ccb8b62aa6c210f753cd0aadc7ce48f1a5fbfb00f4f2ce5d`; `control_common_114493=c0c62169383c97ead607f532a95096da55c03b5f5d1fe8d9736bbb2449398891`. These are **local source calculations**, not production observations. Run the separate **read-only** SQL file and require installed+hash+owner/path match before considering a live migration. Confirm `_114495` migration status separately; do not run an unshipped migration as a side effect.

This PR has synthetic no-write Node source/security tests. They are **not a substitute** for authenticated PostgreSQL execution or worker acceptance.

## Independent source-gate additions

- `114496_READ_ONLY_SOURCE_GATE.sql` compares exact SHA-256 and security posture of existing control/preview/apply helper functions and the two public partner wrappers. This SQL **does not execute any hotel function** and must not be confused with installing `114496`.
- `114496_DIRECT_APPLY_STATIC_GATE.test.mjs` asserts the reviewed draft leaves historical functions and site settings alone, uses `auth.uid()`, hardcodes the partner actor, whitelists only calendar operations, and never writes the URL in metadata or public logs.
- `114493_EXPECTED_SOURCE_HASHES.json` pins expected source hashes derived from the reviewed uploaded `114493` migration. **Current production source and ACL for preview/apply common have not been verified**; this is a required stop gate.
- The static tests establish **shape only**, not authorization behavior. Before any migration to production, run isolated real auth/negative-write tests and inspect actual `pg_proc.prosrc` + the seal. A migration is not release-ready merely because these tests pass.

