# Booking Payment Flow Regression

## Root Cause

The transport partner-acceptance path decided whether a deposit was required only from `transport_bookings.payment_status` and `transport_bookings.deposit_amount`.

If a transport booking had no `deposit_amount` stored, or had an incorrect `payment_status = not_required`, the fulfillment moved directly to `accepted`. That set `partner_service_fulfillments.contact_revealed_at` immediately, so the partner could see the customer contact before payment and no customer deposit email was generated.

The hotfix now resolves transport deposit requirements server-side from:

- the quoted booking `deposit_amount`, if present
- the active `transport_pricing_rules` deposit settings for the route
- the global deposit enabled flag

Transport acceptance now goes to `awaiting_payment` when a required deposit can be calculated, creates/updates a `service_deposit_requests` row, creates the Stripe checkout link, queues the customer deposit email, and keeps `contact_revealed_at = null`.

## Correct Flow

1. Customer creates a booking.
2. Partner/admin sees the request, but customer contact is locked.
3. Partner accepts.
4. If a deposit is required, the fulfillment becomes `awaiting_payment`.
5. A Stripe checkout link is created and the customer deposit email is queued.
6. Customer contact remains locked while payment is pending.
7. Stripe confirmation marks the deposit paid.
8. The fulfillment becomes `accepted`, `contact_revealed_at` is set, and partner/admin/customer paid notifications are queued.

## Status Model

- `pending_acceptance`: partner has not accepted or rejected yet
- `awaiting_payment`: partner accepted, customer deposit is pending
- `accepted`: deposit is paid or no deposit is required
- `rejected`: partner rejected
- `closed`: another partner claimed the fulfillment
- `expired`: payment or acceptance window expired

Transport booking payment states use:

- `pending`: deposit/payment expected
- `not_required`: no deposit is required
- `paid`: deposit/payment confirmed

## Contact Lock

Partner contact visibility is gated by `partner_service_fulfillments.contact_revealed_at`.

Before payment, the partner panel shows operational details only:

- service/route
- date and time
- passenger/luggage information
- pickup/dropoff operational fields
- total/deposit status

Hidden until payment:

- customer name
- customer email
- customer phone
- direct contact data

The partner frontend no longer selects transport customer contact fields from `transport_bookings` for pre-payment booking snapshots. Contact rows and form snapshots remain protected by RLS policies that require `contact_revealed_at IS NOT NULL`.

Residual backend risk: `transport_bookings` still has row-level partner read access for operational data. A stricter future hardening step should move partner transport reads to a masked view/RPC so contact columns are never available through direct table reads before payment.

## Payment Email

The customer deposit email is queued through `enqueue_admin_notification` with event `customer_deposit_requested`.

Required payload references:

- `resource_type`
- `booking_id`
- `fulfillment_id`
- `deposit_request_id`
- `partner_id`

Language fallback remains `pl -> pl`, otherwise `en`. Hebrew templates are not required for this hotfix; unsupported languages must fall back to EN and must not generate blank templates.

## Payment Confirmation

Stripe webhook deposit handling is idempotent through `service_deposit_requests` and notification dedupe keys.

On paid deposit:

- `service_deposit_requests.status = paid`
- `partner_service_fulfillments.status = accepted`
- `partner_service_fulfillments.contact_revealed_at` is set
- service booking deposit fields are updated
- transport bookings are explicitly synced to `payment_status = paid`, `status = confirmed`
- partner/admin/customer deposit-paid notifications are queued

## Services Checked

- Transport: hotfixed and covered by regression checks.
- Cars: existing deposit rule flow retained.
- Trips: existing date-selection and deposit flow retained.
- Hotels: existing deposit rule flow retained.
- Shop/orders: separate checkout/partner acceptance flow, not changed by this hotfix.

## Manual Live Test

Transport:

1. Create a transport booking on a route with deposit rules enabled.
2. Open partner panel and confirm customer contact is hidden.
3. Accept the booking as partner.
4. Confirm status is waiting for customer payment.
5. Confirm customer receives the deposit payment email with amount, currency and Stripe link.
6. Confirm customer contact is still hidden.
7. Pay the deposit through Stripe test/live-safe flow.
8. Confirm booking is marked paid/confirmed.
9. Confirm partner contact is unlocked.
10. Confirm partner and admin receive deposit-paid notifications.

Regression:

1. Car/trip/hotel partner acceptance still creates or waits for deposits according to existing rules.
2. Shop checkout and payment remain unchanged.
3. Replayed Stripe webhook does not send duplicate paid notifications.
