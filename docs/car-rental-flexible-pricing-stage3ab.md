# Car Rental Flexible Pricing Stage 3A/3B

This stage is an additive, inactive foundation. Existing offers remain on
`legacy_compat`; public threshold pricing remains disabled by
`site_settings.car_threshold_daily_rates_enabled = false`.

## Daily-rate threshold contract

`car_offer_daily_rate_tiers.daily_rate` is a daily rate, never a total tier
price. For an exact offer and a positive rental-day count, select the active
tier with the greatest `threshold_days` not exceeding the rental duration.
That one rate applies to every rental day:

`base_rental_price = selected_daily_rate * rental_days`

Rates are never blended or interpolated. The highest active threshold remains
in force until an optional `max_rental_days` rejects the duration. The lowest
active threshold is the structural `car_offers.min_rental_days` value for a
threshold offer.

## Exact 24-hour duration contract

The shared browser seam and PostgreSQL function operate on absolute instants,
not timezone-less local strings. One rental day is exactly 86,400 elapsed
seconds and the result is `ceil(elapsed_seconds / 86400)`.

- `10:00 -> 10:00` on the following day is one rental day.
- `10:00 -> 10:30` on the following day is two rental days.
- Europe/Nicosia daylight-saving transitions are resolved when the local
  pickup/return values are converted to explicit-offset or UTC instants. The
  elapsed-instant calculation is then identical in JavaScript and PostgreSQL.

Stage 3A/3B does not connect this seam to the existing legacy booking runtime.
That integration belongs to the next checkpoint and requires the
server-authoritative quote validator.

## Legacy and activation invariants

- Existing public minimum remains three days in the legacy runtime.
- No legacy offer receives automatic tier rows or a strategy conversion.
- Existing fixed price columns, offer IDs, city coverage, partners, coupons,
  deposits, fulfillment, and booking payloads remain authoritative.
- Availability is profile-based only for `legacy_compat`. A future
  `threshold_daily_rate` mapped offer is validated from its exact city rows and
  exact fees, independently of its legacy pricing profile.
- Deposit configuration remains solely in `service_deposit_rules` and
  `service_deposit_overrides`.
