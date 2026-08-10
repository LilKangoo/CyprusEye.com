import fs from 'node:fs';
import path from 'node:path';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Stage 3C/3D runtime and authoritative validation static guards', () => {
  const authoritativeMigration = read('supabase/migrations/20260809150000_car_rental_threshold_authoritative_booking.sql');
  const paymentMigration = read('supabase/migrations/20260809140000_car_booking_partial_payment_status.sql');
  const verify = read('supabase/manual/car_rental_flexible_pricing_stage3cd_verify.sql');
  const reservation = read('js/car-reservation.js');
  const adapter = read('js/car-rental-availability-adapter.js');
  const repository = read('js/car-rental-availability-repository.js');
  const thresholdPricing = read('js/car-rental-threshold-pricing.js');
  const duration = read('js/car-rental-duration-contract.js');
  const admin = read('admin/admin.js');
  const fulfillmentAction = read('supabase/functions/partner-fulfillment-action/index.ts');
  const stripeWebhook = read('supabase/functions/stripe-webhook/index.ts');
  const partnerUi = read('js/partners.js');
  const locationOptions = read('js/car-location-options.js');
  const integrationGate = read('tests/integration/car-rental-flexible-pricing-stage3cd-postgrest-gate.mjs');
  const integrationBase = read('tests/integration/car-rental-flexible-pricing-stage3cd-base.sql');
  const finalPreflight = read('supabase/manual/car_rental_flexible_pricing_final_preflight.sql');
  const finalVerify = read('supabase/manual/car_rental_flexible_pricing_final_verify.sql');

  test('both activation flags remain fail-closed and no production offer is activated', () => {
    expect(authoritativeMigration).toContain('car_multi_city_mapped_enabled is true');
    expect(authoritativeMigration).toContain('car_threshold_daily_rates_enabled is true');
    expect(authoritativeMigration).toContain("where pricing_strategy <> 'legacy_compat'");
    expect(authoritativeMigration).toContain("or availability_mode <> 'legacy'");
    expect(authoritativeMigration).not.toMatch(/update\s+public\.site_settings/i);
    expect(authoritativeMigration).not.toMatch(/update\s+public\.car_offers/i);
    expect(authoritativeMigration).not.toMatch(/insert\s+into\s+public\.car_offer_daily_rate_tiers/i);
  });

  test('one shared threshold calculator uses one daily rate for every rental day', () => {
    expect(thresholdPricing).toContain('selectThresholdDailyRateTier');
    expect(thresholdPricing).toContain('tier.dailyRate * rentalDays');
    expect(thresholdPricing).not.toMatch(/interpolat|blend/i);
    expect(adapter).toContain('calculateThresholdCarRentalQuote');
    expect(reservation).toContain('calculateThresholdCarRentalQuote');
  });

  test('server quote validates every monetary component from exact database state', () => {
    expect(authoritativeMigration).toContain('resolve_car_threshold_authoritative_quote');
    expect(authoritativeMigration).toContain("offer.id = p_offer_id");
    expect(authoritativeMigration).toContain("offer.pricing_strategy = 'threshold_daily_rate'");
    expect(authoritativeMigration).toContain("offer.availability_mode = 'mapped'");
    expect(authoritativeMigration).toContain('v_tier.daily_rate * v_rental_days');
    expect(authoritativeMigration).toContain('v_pickup_availability.fee_mode');
    expect(authoritativeMigration).toContain('v_return_availability.fee_mode');
    expect(authoritativeMigration).toContain('v_offer.insurance_per_day');
    expect(authoritativeMigration).toContain('v_offer.young_driver_cost');
    expect(authoritativeMigration).toContain('public.car_coupon_quote(');
    expect(authoritativeMigration).toContain('v_pre_discount');
    expect(authoritativeMigration).toContain('v_final');
  });

  test('the booking write boundary rejects bypass and financial tampering', () => {
    expect(authoritativeMigration).toContain('car_bookings_validate_threshold_financials');
    expect(authoritativeMigration).toContain('before insert or update of');
    expect(authoritativeMigration).toContain('threshold_booking_financial_tamper_detected');
    expect(authoritativeMigration).toContain('car_booking_public_insert_requires_exact_offer');
    expect(authoritativeMigration).toContain("v_request_role in ('anon', 'authenticated')");
    expect(authoritativeMigration).toContain('coalesce(new.full_insurance, false) is distinct from v_quote.insurance_selected');
    expect(authoritativeMigration).toContain('new.pricing_snapshot is distinct from v_quote.pricing_snapshot');
    expect(reservation).toContain('requestAuthoritativeThresholdQuote');
    expect(reservation).toContain('p_offer_id: String(offerRow.id)');
    expect(reservation).toContain("const BOOKING_SUBMIT_RPC_NAME = 'submit_car_booking_request'");
    expect(reservation).toContain('p_submission_key: submissionKey');
    expect(reservation).not.toMatch(/\.from\(['"]car_bookings['"]\)\s*\n?\s*\.insert/);
    expect(reservation).not.toContain('maxRetries');
  });

  test('the authoritative migration adds the live-missing financial snapshot columns itself', () => {
    for (const contract of [
      'add column if not exists currency text',
      'add column if not exists pickup_location_fee numeric(12,2)',
      'add column if not exists return_location_fee numeric(12,2)',
      'add column if not exists insurance_added boolean',
      'add column if not exists insurance_cost numeric(12,2)',
      'add column if not exists young_driver_fee boolean',
      'add column if not exists young_driver_cost numeric(12,2)',
    ]) {
      expect(authoritativeMigration).toContain(contract);
      expect(integrationBase).not.toContain(contract);
    }
    expect(authoritativeMigration).toContain('car_threshold_authoritative_booking_column_type_mismatch');
    expect(authoritativeMigration).toContain('car_bookings_pickup_location_fee_check');
    expect(authoritativeMigration).toContain('car_bookings_young_driver_cost_check');
  });

  test('price validation is explicitly separate from partner acceptance', () => {
    expect(authoritativeMigration).toContain('threshold_booking_must_enter_partner_workflow_pending');
    expect(authoritativeMigration).toContain("coalesce(new.status, '') <> 'pending'");
    expect(authoritativeMigration).toContain('threshold_booking_must_enter_payment_workflow_unpaid');
    expect(authoritativeMigration).toContain("coalesce(new.payment_status, 'unpaid') <> 'unpaid'");
    expect(authoritativeMigration).not.toMatch(/new\.status\s*:=\s*'confirmed'/i);
    expect(authoritativeMigration).not.toMatch(/update\s+public\.partner_service_fulfillments/i);
    const carsPaymentBranch = paymentMigration.split('-- Transport semantics')[0];
    expect(carsPaymentBranch).toContain('set payment_status = v_payment_status');
    expect(carsPaymentBranch).not.toMatch(/(^|[^_a-z])status\s*=/im);
  });

  test('partial and full payment statuses never auto-accept the booking or fulfillment', () => {
    expect(integrationGate).toContain('bookingTotal: 490');
    expect(integrationGate).toContain('paidNow: 73.5');
    expect(integrationGate).toContain('remaining: 416.5');
    expect(integrationGate).toContain("bookingStatusAfterEitherPayment: 'pending'");
    expect(integrationGate).toContain("partnerStatusAfterEitherPayment: 'pending_acceptance'");
    expect(integrationGate).toContain("status: 'pending_acceptance'");
    expect(admin).not.toContain('syncCarsBookingStatesFromPaidDeposits');
    const effectiveState = admin.slice(
      admin.indexOf('function getCarsBookingEffectiveState'),
      admin.indexOf('async function loadCarsData'),
    );
    expect(effectiveState).toContain("status: currentStatus || 'pending'");
    expect(effectiveState).toContain("paymentStatus: currentPaymentStatus || 'unpaid'");
    expect(effectiveState).not.toMatch(/hasPaidDeposit[\s\S]*\?\s*'confirmed'/);
    const loadCars = admin.slice(
      admin.indexOf('async function loadCarsData'),
      admin.indexOf('async function viewCarBookingDetails'),
    );
    expect(loadCars).not.toMatch(/\.from\(['"]car_bookings['"]\)[\s\S]{0,180}\.update\(/);
    expect(stripeWebhook.match(/\.eq\("status", "awaiting_payment"\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(stripeWebhook.match(/\.not\("accepted_at", "is", null\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(partnerUi).toContain('Payment is displayed independently. It cannot stand in for');
    expect(partnerUi).not.toMatch(/paidMap[\s\S]{0,500}status:\s*'confirmed'/);
  });

  test('quote identity is bound to the JWT principal and anonymous callers cannot impersonate a user', () => {
    expect(authoritativeMigration).toContain('(v_authenticated_user_id is null and p_user_id is not null)');
    expect(authoritativeMigration).toContain('p_user_id is distinct from v_authenticated_user_id');
    expect(authoritativeMigration).toContain('v_effective_user_id := v_authenticated_user_id');
    expect(authoritativeMigration).toContain("auth.jwt() ->> 'email'");
    expect(integrationGate).toContain('anonymous callers cannot quote as an authenticated user');
    expect(integrationGate).toContain('authenticated callers cannot quote with another email');
    expect(integrationGate).toContain('authenticated email impersonation');
    expect(integrationGate).toContain('forged paid status');
  });

  test('deposit checkout is created only after an explicit partner accept transition', () => {
    expect(fulfillmentAction).toContain('.eq("status", "pending_acceptance")');
    expect(fulfillmentAction).toContain('accepted_by: userId');
    expect(fulfillmentAction).toContain('const shouldCreateDepositNow = depositDecision.requiresImmediateDeposit');
    expect(fulfillmentAction).toContain('&& serviceNextStatus === "awaiting_payment"');
  });

  test('exact 24-hour duration has the same Europe/Nicosia contract in JS and SQL', () => {
    expect(duration).toContain("CAR_RENTAL_TIME_ZONE = 'Europe/Nicosia'");
    expect(duration).toContain('Math.ceil(elapsedMilliseconds / RENTAL_DAY_MILLISECONDS)');
    expect(authoritativeMigration).toContain("at time zone 'Europe/Nicosia'");
    expect(authoritativeMigration).toContain('car_rental_duration_days_24h');
    expect(authoritativeMigration).toContain('survive an exact timezone round trip');
    expect(integrationGate).toContain("nonexistentSpringTime: 'rejected'");
    expect(integrationGate).toContain('repeatedAutumnHourUsesStandardTime: 1');
  });

  test('availability selects candidates while exact pricing strategy selects price', () => {
    expect(adapter).toContain("pricingStrategy === CAR_THRESHOLD_PRICING_STRATEGY");
    expect(adapter).toContain('pickupAvailability');
    expect(adapter).toContain('returnAvailability');
    expect(adapter).toContain('dailyRateTiers');
    expect(repository).toContain(".filter((offer) => String(offer?.pricing_strategy || 'legacy_compat') === 'threshold_daily_rate')");
    const thresholdBranch = adapter.slice(
      adapter.indexOf('if (pricingStrategy === CAR_THRESHOLD_PRICING_STRATEGY)'),
      adapter.indexOf('const profileId = text(offer.pricing_profile_id)'),
    );
    expect(thresholdBranch).not.toContain('mappingFor(');
  });

  test('active custom cities are loaded only for the fully enabled mapped threshold runtime', () => {
    expect(locationOptions).toContain('hydrateCarRentalCityCatalogForActiveRuntime');
    expect(locationOptions).toContain('flags?.mappedEnabled !== true || flags?.thresholdDailyRatesEnabled !== true');
    expect(locationOptions).toContain('repository.getActiveCities');
    expect(repository).toContain(".from('car_rental_cities')");
    expect(repository).toContain(".eq('is_active', true)");
    expect(adapter).toContain('LEGACY_AVAILABILITY_CITY_KEYS.has(input.pickupCityCode)');
    expect(adapter).toContain('const hybridLegacyOffers = legacyRouteSupported ? legacyOffers : []');
  });

  test('hybrid customer order remains final quote total ascending', () => {
    expect(adapter).toContain('const leftTotal = Number(left?.quote?.total)');
    expect(adapter).toContain('return leftTotal - rightTotal');
    expect(adapter).toContain("normalized(legacyOffer?.availability_mode) !== 'legacy'");
  });

  test('tampered payload matrix covers all required fail-closed cases', () => {
    for (const label of [
      'altered daily rate',
      'altered base price',
      'altered rental days',
      'altered city fee',
      'altered insurance selection',
      'altered final total',
      'altered discount',
      'threshold that does not exist',
      'duration below minimum',
      'duration above maximum',
      'forged paid status',
      'authenticated email impersonation',
      'public booking without exact offer',
    ]) {
      expect(integrationGate).toContain(label);
    }
  });

  test('verify is one-row read-only and checks inert runtime plus workflow separation', () => {
    expect(verify).toContain('car-rental-flexible-pricing-stage3cd-verify-v1');
    expect(verify).toContain('stage3cd_runtime_foundation_safe');
    expect(verify).toContain('payment_status_separate_from_partner_confirmation');
    expect(verify).toContain('threshold_pricing_offers = 0');
    expect(verify).toContain('mapped_offers = 0');
    expect(verify).toContain('flags.threshold_enabled is false');
    expect(verify).toContain('flags.mapped_enabled is false');
    expect(verify).not.toMatch(/\b(insert|update|delete|upsert|merge|alter|create|drop|truncate|grant|revoke|call|do)\b/i);
  });

  test('final manual preflight and verify are one-row read-only production guards', () => {
    expect(finalPreflight).toContain('car-rental-flexible-pricing-final-preflight-v1');
    expect(finalPreflight).toContain('stage3_final_preflight_pass');
    expect(finalPreflight).toContain('ec3e29a35f249c92279d7b15f400ef0f');
    expect(finalPreflight).toContain('objects.present_count = objects.expected_count');
    expect(finalPreflight).not.toMatch(/\b(insert\s+into|update\s+public\.|delete\s+from|alter\s+table|create\s+(?:table|function|policy|trigger)|drop\s+)\b/i);
    expect(finalVerify).toContain('car-rental-flexible-pricing-final-verify-v1');
    expect(finalVerify).toContain('stage3_final_production_safe');
    expect(finalVerify).toContain('cars_payment_does_not_confirm_booking');
    expect(finalVerify).toContain('quote_identity_bound');
    expect(finalVerify).toContain('offers.legacy_offer_count = 27');
    expect(finalVerify).not.toMatch(/\b(insert\s+into|update\s+public\.|delete\s+from|alter\s+table|create\s+(?:table|function|policy|trigger)|drop\s+)\b/i);
  });
});
