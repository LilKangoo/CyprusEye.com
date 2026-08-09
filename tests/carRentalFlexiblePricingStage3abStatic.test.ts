import fs from 'node:fs';
import path from 'node:path';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Stage 3A/3B flexible Cars foundation static guards', () => {
  const publicationMigration = read('supabase/migrations/20260809120000_car_rental_publication_safety.sql');
  const pricingMigration = read('supabase/migrations/20260809130000_car_rental_flexible_pricing_foundation.sql');
  const paymentMigration = read('supabase/migrations/20260809140000_car_booking_partial_payment_status.sql');
  const verify = read('supabase/manual/car_rental_flexible_pricing_stage3ab_verify.sql');
  const core = read('admin/car-rental-multicity-core.js');
  const repository = read('admin/car-rental-multicity-repository.js');
  const ui = read('admin/car-rental-multicity-ui.js');
  const admin = read('admin/admin.js');
  const integrationBase = read('tests/integration/car-rental-flexible-pricing-stage3ab-base.sql');
  const integrationGate = read('tests/integration/car-rental-flexible-pricing-stage3ab-postgrest-gate.mjs');

  test('publication safety requires available and published in policy and every public catalogue query', () => {
    expect(publicationMigration).toContain('using (is_available is true and is_published is true)');
    expect(publicationMigration).toContain('Anyone can view available car offers');
    expect(publicationMigration).toContain('Authenticated users can view all offers');
    for (const file of ['js/car-rental-paphos.js', 'js/home-cars.js', 'js/plan.js', 'js/dashboard.js']) {
      const source = read(file);
      const publicQueries = source.split(".from('car_offers')").slice(1);
      expect(publicQueries.length).toBeGreaterThan(0);
      publicQueries.forEach((query) => {
        expect(query.slice(0, 700)).toContain(".eq('is_published', true)");
      });
    }
  });

  test('the unpublished production offer is never special-cased or mutated', () => {
    const exactUnpublishedId = 'df21eabb-1cd3-4723-9e66-9b81ae583191';
    expect(`${publicationMigration}\n${pricingMigration}`).not.toContain(exactUnpublishedId);
    expect(publicationMigration).not.toMatch(/\b(update|delete)\s+public\.car_offers\b/i);
  });

  test('pricing foundation is additive, transacted and inert', () => {
    expect(pricingMigration).toMatch(/^begin;/i);
    expect(pricingMigration.trim()).toMatch(/commit;$/i);
    expect(pricingMigration).toContain("add column if not exists pricing_strategy text not null default 'legacy_compat'");
    expect(pricingMigration).toContain("add column if not exists car_threshold_daily_rates_enabled boolean not null default false");
    expect(pricingMigration).toContain("where pricing_strategy <> 'legacy_compat'");
    expect(pricingMigration).toContain('where car_threshold_daily_rates_enabled is true');
    expect(pricingMigration).toContain("where availability_mode <> 'legacy'");
    expect(pricingMigration).not.toMatch(/insert\s+into\s+public\.car_offer_daily_rate_tiers/i);
    expect(pricingMigration).not.toMatch(/update\s+public\.car_offers\s+set\s+pricing_strategy/i);
  });

  test('tiers store daily rate and select one threshold for every rental day', () => {
    expect(pricingMigration).toContain('daily_rate numeric(12,2) not null');
    expect(pricingMigration).toContain('unique (offer_id, threshold_days)');
    expect(pricingMigration).toContain('order by tier.threshold_days desc');
    expect(pricingMigration).toContain('round(v_tier.daily_rate * v_days, 2)');
    expect(pricingMigration).toContain('Daily rate, not total tier price.');
    expect(pricingMigration).toContain('rates are never blended');
    expect(core).toContain('baseRentalPrice: normalizeMoney(tier.daily_rate * days)');
  });

  test('lowest active tier synchronizes and validates offer minimum', () => {
    expect(pricingMigration).toContain('select min(tier.threshold_days)');
    expect(pricingMigration).toContain('set min_rental_days = v_lowest');
    expect(pricingMigration).toContain('threshold_daily_rate_min_must_equal_lowest_tier');
    expect(core).toContain('Minimum rental days must equal the lowest active price threshold.');
    expect(ui).toContain('Effective minimum rental');
    expect(pricingMigration).toContain('alter column max_rental_days drop not null');
    expect(pricingMigration).toContain('alter column max_rental_days set default null');
  });

  test('pricing and location are decoupled only for threshold strategy', () => {
    expect(pricingMigration).toContain("where offer.pricing_strategy = 'legacy_compat'");
    expect(pricingMigration).toContain("if v_strategy = 'threshold_daily_rate' then");
    expect(core).toContain("const thresholdStrategy = normalizeCode(draft?.pricing?.strategy) === 'threshold_daily_rate'");
    expect(repository).toContain("core.normalizeCode(request.payload.pricing_strategy || 'legacy_compat') === 'legacy_compat'");
  });

  test('new kinds and structured exact-offer fields exist without offer seeds', () => {
    expect(pricingMigration).toContain("'scooter'");
    expect(pricingMigration).toContain("'bicycle'");
    expect(pricingMigration).toContain('engine_capacity_cc integer');
    expect(pricingMigration).toContain('required_licence_category text');
    expect(pricingMigration).toContain('minimum_driver_age integer');
    expect(pricingMigration).not.toMatch(/insert\s+into\s+public\.car_offers/i);
  });

  test('insurance and young-driver controls are exact offer fields with no profile restriction', () => {
    expect(core).toContain("'insurance_mode'");
    expect(core).toContain("'insurance_per_day'");
    expect(core).toContain("'young_driver_fee'");
    expect(core).toContain("'young_driver_cost'");
    expect(ui).toContain('Young driver allowed for this exact offer');
    expect(ui).toContain('Insurance configuration');
    const exactOfferOptions = ui.slice(ui.indexOf('function renderExactOfferOptions'), ui.indexOf('function renderThresholdTierEditor'));
    expect(exactOfferOptions).not.toContain("normalizeCode(profile?.code) === 'paphos'");
  });

  test('deposit action deep-links to the existing exact Cars override editor', () => {
    expect(ui).toContain('options.openDepositSettings?.(exactOfferId)');
    expect(admin).toContain('async function openCarDepositSettings(exactOfferId)');
    expect(admin).toContain("type.value = 'cars'");
    expect(admin).toContain('search.value = offerId');
    expect(repository).not.toMatch(/from\(TABLES\.depositRules\)\.(?:insert|update|upsert|delete)/);
    expect(repository).not.toMatch(/from\(TABLES\.depositOverrides\)\.(?:insert|update|upsert|delete)/);
  });

  test('captured part-payment no longer means the full total is paid', () => {
    expect(paymentMigration).toMatch(/^begin;/i);
    expect(paymentMigration.trim()).toMatch(/commit;$/i);
    expect(paymentMigration).toContain("then 'partial'");
    expect(paymentMigration).toContain("else 'paid'");
    expect(paymentMigration).toContain('new.amount');
    const carsPaymentBranch = paymentMigration.split('-- Transport semantics')[0];
    expect(carsPaymentBranch).toContain('set payment_status = v_payment_status');
    expect(carsPaymentBranch).not.toMatch(/(^|[^_a-z])status\s*=/im);
    expect(paymentMigration).not.toMatch(/update\s+public\.service_deposit_(?:rules|overrides)/i);
    expect(paymentMigration).not.toMatch(/update\s+public\.car_bookings\s+set\s+.*where\s+true/is);
  });

  test('server validator is disabled by the database flag and validates exact offer base price', () => {
    expect(pricingMigration).toContain('resolve_car_threshold_daily_rate_quote');
    expect(pricingMigration).toContain('offer.id = p_offer_id');
    expect(pricingMigration).toContain("offer.pricing_strategy = 'threshold_daily_rate'");
    expect(pricingMigration).toContain('setting.car_threshold_daily_rates_enabled is true');
    expect(pricingMigration).toContain('submitted_base_matches');
  });

  test('tier table has RLS, exact-ID optimistic concurrency and no public writes', () => {
    expect(pricingMigration).toContain('alter table public.car_offer_daily_rate_tiers enable row level security');
    expect(pricingMigration).toContain('car_offer_daily_rate_tiers_admin_all');
    expect(repository).toContain(".eq('id', id)");
    expect(repository).toContain(".eq('offer_id', offerId)");
    expect(repository).toContain(".eq('updated_at', request.expectedUpdatedAt)");
    expect(pricingMigration).not.toMatch(/create policy car_offer_daily_rate_tiers_public.*for (insert|update|delete)/is);
  });

  test('real integration fixture is loopback-only, synthetic and exercises RLS plus cleanup', () => {
    expect(integrationBase).toContain('Synthetic identifiers only');
    expect(integrationBase).not.toMatch(/customer_(?:name|email|phone)/i);
    expect(integrationGate).toContain('refuses non-loopback PostgREST URL');
    expect(integrationGate).toContain('unpublishedAnonRows');
    expect(integrationGate).toContain('duplicateThresholdRejected');
    expect(integrationGate).toContain("partPayment: 'partial'");
    expect(integrationGate).toContain('exactOfferIdsPreserved');
    expect(integrationGate).toContain('thresholdFlag: false');
  });

  test('verify is one-row read-only and checks all activation guards', () => {
    expect(verify).toContain('car-rental-flexible-pricing-stage3ab-verify-v1');
    expect(verify).toContain('stage3ab_foundation_safe');
    expect(verify).toContain('threshold_strategy_count = 0');
    expect(verify).toContain('mapped_offer_count = 0');
    expect(verify).toContain('tier.tier_count = 0');
    expect(verify).toContain('flags.threshold_enabled is false');
    expect(verify).toContain('flags.mapped_enabled is false');
    expect(verify).not.toMatch(/\b(insert|update|delete|upsert|merge|alter|create|drop|truncate|grant|revoke|call|do)\b/i);
  });
});
