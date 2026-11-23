# Hotels V2 — incremental release map (2026-11-23)

STATUS: ENGINEERING RELEASE MAP ONLY. NO LIVE DATABASE CHANGES; DO NOT ENABLE PUBLIC BOOKING BASED ON THIS DOCUMENT.

## Verified state (production read-only)

Pilot hotel: `9b6d99a0-923a-4fbc-be54-c066e856e6ca` (7 Kamares).
- The installed function `hotel_v2_public_get_stay_options_114494(jsonb)` calls `require_safety` and `quote_core` and appends `can_submit` from `public_booking_state()`.
- `hotel_v2_public_create_quote_114494(jsonb)` and `hotel_v2_public_begin_booking_114494(uuid,text,jsonb)` both call `require_enabled()`. Current `public_booking_enabled=false`.
- `hotel_v2_partner_accept_booking_114494(uuid,uuid)` requires membership, one known assignment, permission `process_bookings`, and an order whose mode is `A`. `confirm_core` revalidates availability and atomically commits real inventory allocations.
- `quote_core` returns A when calendar coverage is not usable, B when coverage is usable but no verified partner Stripe, and C when coverage is usable and Stripe is verified.
- `calendar_ready` demands successful fresh sync, a bound secret and a **verified coverage approval** (separate from calendar source creation), not merely a configured URL.
- `public_booking_enabled=false`, `audit_chain_exact=true`, and inspected pricing, policy, allocation safety checks are true.
- `hotel.html` deliberately hides the booking form for the converted pilot via `isHotelPageDisplayOnly`. Other hotels still use a legacy direct insert; **never redirect pilot submissions through that old insert**.
- Partner workspace `renderBookings` currently presents read-only booking rows/links and does not call `hotel_v2_partner_accept_booking_114494`. Its existing presentation is derived from a read envelope and is not a vetted queue for private `_114494` orders.
- `_114496` direct iCal RPC is not yet installed. Main branch still sends calendar operations to `pending_admin_review`. Draft PR #190 stages new backend/client/UI with OFF-by-default release gate.

## Two independent approvals

1. Partner adds private Booking.com/Airbnb/generic ICS source **without Admin per-source approval**. Verify partner assignment, room scope, Vault secrecy, worker SSRF hardening, and actual import. Do not display 'Connected' until persisted blocks and fresh health succeed.
2. Without verified connected external calendars, a customer can submit a **request** (mode A) requiring hotel Partner acceptance, with atomic availability re-check. This does NOT require calendar-source Admin approval. This is independent from the Partner's approval of customer booking.

Do not conflate calendar configuration with customer request acceptance.

## Release boundaries

### R1 — Customer request + Partner approval (A only)

- Preserve `_114494` pricing, quotes, idempotency, `request_pending`, authenticated Partner membership and `confirm_core`.
- Implement a **reviewed, server-enforced A-only activation gate**. Do not simply set the existing global `public_booking_enabled=true` while B/C are unaccepted, because that same flag gates charge-enabled booking modes.
- Build 7 Kamares public booking form around `get_stay_options`, `create_quote`, `begin_booking` and `booking_status`, respecting actual request contract (arrival/departure, adults, exact child ages, room choice/extras); do not use legacy `hotel_bookings.insert` for converted pilot.
- Supply a new authorized, minimal Partner inbox read of outstanding mode-A orders; never expose lookup tokens or unrelated customer's data. Add Accept action using existing `hotel_v2_partner_accept_booking_114494` and a separate reject/cancel action only after implementing and auditing a real backend path (the inspected _114494 public functions include Accept, not an established Reject RPC).
- Notifications: do not claim email delivery until queue/provider integration and test prove it.
- Test anonymous vs authenticated requests, wrong Partner, revoked process_bookings, stale quote, wrong room, concurrent claims, unavailable dates at acceptance, replay/duplicate submissions, no Stripe/charge side effects.
- Do not enable legacy direct insert or Stripe along with mode A.

### R2 — Partner-owned external iCal

- Complete real authenticated PostgreSQL tests for `_114496` with exact installed `_114493` functions and sealed catalog, not simulated helpers.
- Preserve one hotel-wide manual-primary calendar (room NULL) and one enabled external ICS per Room; do not silently add parallel Booking/Airbnb ICS feeds to the same Room until multi-source rule reviewed.
- Finish wizard PL/EN/HE, 4-step direct review/apply sequence (source -> secret -> enable -> trigger), one separately reviewed operation per action; do not expose secret URL to result/logs.
- Worker tests: redirects, SSRF/private hosts/DNS rebinding, timeout, oversized/non-ICS content, parse failures, retries, failure health; prove dates blocked before marking synced.
- Source self-service must not be blocked by a per-source Admin approval, but **booking-coverage safety checks** remain separate.

### R3 — Automatic modes B/C

- When fresh, valid calendar coverage exists, reject unavailable dates automatically.
- For dates available without Partner Stripe connection: preserve the reviewed payment/reconciliation contract of B; no premature confirmation.
- With verified Partner Stripe: preserve C and payment idempotency/compensation. The user-approved customer flow and payment splits must be tested before activation.
- Release each mode with explicit server-side gates and rollback, not frontend flags alone.

## Go/no-go

For each release: production backup/recovery plan; exact SQL source/ACL/epoch gate; isolated real-DB positive + negative tests; frontend browser/mobile/RTL; no data leakage; existing customer orders unchanged; one controlled pilot; metrics + rollback; then release approval. Absence of any gate = NO GO.

**This file is not release authorization.** PR #190 remains DRAFT and must not be merged or deployed based solely on static tests.
