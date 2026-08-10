import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const admin = fs.readFileSync(path.join(root, 'admin/admin.js'), 'utf8');

function loadPricingHelpers() {
  const start = admin.indexOf('function normalizeAdminCarPricingSnapshot');
  const end = admin.indexOf('async function viewCarBookingDetails');
  if (start < 0 || end <= start) throw new Error('Admin threshold pricing helpers not found');
  const source = admin.slice(start, end);
  return Function(`${source}\nreturn { normalizeAdminCarPricingSnapshot, isAdminThresholdCarBooking, formatAdminThresholdDailyRate, getAdminThresholdBookingPriceView };`)();
}

describe('Admin threshold booking pricing display', () => {
  test('normalizes the authoritative JSONB snapshot without losing daily-rate precision', () => {
    const helpers = loadPricingHelpers();
    const booking = {
      offer_id: '2817e6de-25ba-5237-b721-dbc0460a7de4',
      pricing_validated_at: '2026-08-10T00:00:00.000Z',
      pricing_snapshot: JSON.stringify({
        version: 'car-threshold-authoritative-v1',
        pricing_strategy: 'threshold_daily_rate',
        offer_id: '2817e6de-25ba-5237-b721-dbc0460a7de4',
        tier_id: '177d85ab-4c2d-5eea-bce6-9bd06adc397a',
        threshold_days: 3,
        rental_days: 3,
        daily_rate: 90.000000,
        base_rental_price: 270,
        pickup_city_code: 'ayia-napa',
        return_city_code: 'ayia-napa',
        pickup_location_fee: 0,
        return_location_fee: 0,
        insurance_mode: 'included',
        insurance_selected: false,
        insurance_cost: 0,
        young_driver_selected: false,
        young_driver_cost: 0,
        pre_discount_total: 270,
        discount_amount: 0,
        final_rental_price: 270,
        currency: 'EUR',
      }),
    };

    const view = helpers.getAdminThresholdBookingPriceView(booking);
    expect(helpers.isAdminThresholdCarBooking(booking)).toBe(true);
    expect(view).toMatchObject({
      offerId: booking.offer_id,
      tierId: '177d85ab-4c2d-5eea-bce6-9bd06adc397a',
      thresholdDays: 3,
      rentalDays: 3,
      dailyRate: 90,
      baseRentalPrice: 270,
      pickupLocationFee: 0,
      returnLocationFee: 0,
      finalRentalPrice: 270,
      pricingValidatedAt: booking.pricing_validated_at,
    });
    expect(helpers.formatAdminThresholdDailyRate(93.333333, 'EUR')).toBe('EUR 93.333333');
    expect(helpers.formatAdminThresholdDailyRate(50, 'EUR')).toBe('EUR 50');
  });

  test('threshold booking details use exact stored snapshot and never the legacy regional calculator', () => {
    const start = admin.indexOf('async function viewCarBookingDetails');
    const end = admin.indexOf('// Open edit booking modal', start);
    const details = admin.slice(start, end);

    expect(details).toContain('if (!thresholdBooking && booking.offer_id)');
    expect(details).toContain(".eq('id', booking.offer_id)");
    expect(details).toContain('if (!thresholdBooking)');
    expect(details).toContain('buildPricingMatrixForOfferRow(carPricing, location)');
    expect(details).toContain('Authoritative Threshold Pricing Snapshot');
    expect(details).toContain('This is the stored authoritative booking snapshot');
    expect(details).toContain('Threshold booking prices are server-validated and immutable');
    expect(details).toContain("${thresholdBooking ? `");
    expect(details).not.toMatch(/thresholdBooking\s*\?[\s\S]{0,300}buildPricingMatrixForOfferRow/);
  });

  test('malformed threshold rows fail closed instead of falling back to a Larnaca quote', () => {
    const helpers = loadPricingHelpers();
    const booking = { pricing_snapshot: null, offer_id: 'offer-1' };
    expect(helpers.isAdminThresholdCarBooking(booking, { pricing_strategy: 'threshold_daily_rate' })).toBe(true);
    expect(helpers.getAdminThresholdBookingPriceView(booking)).toBeNull();
    expect(admin).toContain('Authoritative threshold snapshot unavailable.');
    expect(admin).toContain('Admin has deliberately not applied the legacy Larnaca/Paphos calculator');
  });
});
