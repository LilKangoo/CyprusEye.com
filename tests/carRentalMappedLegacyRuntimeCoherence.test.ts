import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

function read(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
}

function moduleToScript(relative: string) {
  return read(relative)
    .replace(/import[\s\S]*?from\s+['"][^'"]+['"];\s*/g, '')
    .replace(/\bexport\s+(?=(?:async\s+)?function|const|let|class)/g, '');
}

function loadContract(): any {
  const context: Record<string, unknown> = {};
  vm.createContext(context);
  vm.runInContext(moduleToScript('js/car-pricing.js'), context, { filename: 'js/car-pricing.js' });
  vm.runInContext(`${moduleToScript('js/car-rental-mapped-legacy-pricing.js')}
    globalThis.MappedLegacyPricing = {
      isMappedLegacyOffer,
      resolveMappedLegacyPricingContext,
      calculateMappedLegacyCarRentalQuote,
    };`, context, { filename: 'js/car-rental-mapped-legacy-pricing.js' });
  return context.MappedLegacyPricing;
}

const contract = loadContract();

function mappedOffer(overrides: Record<string, unknown> = {}) {
  const offer = {
    id: 'offer-exact',
    pricing_strategy: 'legacy_compat',
    availability_mode: 'mapped',
    location: 'larnaca',
    price_per_day: 50,
    price_3days: 150,
    price_4_6days: 50,
    price_7_10days: 50,
    price_10plus_days: 50,
    young_driver_fee: true,
    young_driver_cost: 10,
    ...overrides,
  } as any;
  offer.pricingContext = {
    offerId: offer.id,
    availabilityMode: 'mapped',
    pricingStrategy: 'legacy_compat',
    calculatorKey: 'larnaca',
    legacyBookingLocation: 'larnaca',
    pickupCityCode: 'paphos',
    returnCityCode: 'paphos',
    pickupLegacyPricingLocation: 'paphos',
    returnLegacyPricingLocation: 'paphos',
    pickupFeeMode: 'override',
    returnFeeMode: 'override',
    pickupFeePerDirection: 0,
    returnFeePerDirection: 25,
  };
  return offer;
}

function quote(offerRow = mappedOffer(), overrides: Record<string, unknown> = {}) {
  return contract.calculateMappedLegacyCarRentalQuote({
    offerRow,
    carModel: 'Exact mapped offer',
    pickupDateStr: '2026-09-01',
    returnDateStr: '2026-09-04',
    pickupTimeStr: '10:00',
    returnTimeStr: '10:00',
    pickupCityCode: 'paphos',
    returnCityCode: 'paphos',
    pickupLocation: 'paphos',
    returnLocation: 'paphos',
    ...overrides,
  });
}

describe('mapped legacy exact-offer runtime coherence', () => {
  test('preserves exact zero/custom directional fee overrides when the quote is recomputed', () => {
    expect(quote()).toEqual(expect.objectContaining({
      basePrice: 150,
      pickupFee: 0,
      returnFee: 25,
      total: 175,
    }));
    expect(quote(mappedOffer(), { fullInsurance: true })).toEqual(expect.objectContaining({
      pickupFee: 0,
      returnFee: 25,
      insuranceCost: 51,
      total: 226,
    }));
  });

  test('uses inherited legacy fees only when context says inherit', () => {
    const offer = mappedOffer();
    offer.pricingContext = {
      ...offer.pricingContext,
      pickupCityCode: 'ayia-napa',
      returnCityCode: 'ayia-napa',
      pickupLegacyPricingLocation: 'ayia-napa',
      returnLegacyPricingLocation: 'ayia-napa',
      pickupFeeMode: 'inherit',
      returnFeeMode: 'inherit',
      pickupFeePerDirection: 15,
      returnFeePerDirection: 15,
    };
    expect(quote(offer, {
      pickupCityCode: 'ayia-napa',
      returnCityCode: 'ayia-napa',
      pickupLocation: 'ayia-napa',
      returnLocation: 'ayia-napa',
    })).toEqual(expect.objectContaining({ pickupFee: 15, returnFee: 15, total: 180 }));
  });

  test('fails closed for a context belonging to another offer or route', () => {
    const wrongOffer = mappedOffer();
    wrongOffer.pricingContext = { ...wrongOffer.pricingContext, offerId: 'another-offer' };
    expect(quote(wrongOffer)).toBeNull();
    expect(quote(mappedOffer(), { pickupCityCode: 'larnaca' })).toBeNull();
    expect(quote(mappedOffer(), { pickupLocation: 'hotel' })).toEqual(expect.objectContaining({
      pickupLoc: 'paphos',
      pickupFee: 0,
    }));
  });

  test('entry points share the exact mapped legacy quote seam and booking emits exact city codes', () => {
    const carPage = read('js/car-rental-paphos.js');
    const modal = read('js/car-offer-modal.js');
    const reservation = read('js/car-reservation.js');
    expect(carPage).toContain('calculateMappedLegacyCarRentalQuote');
    expect(modal).toContain('calculateMappedLegacyCarRentalQuote');
    expect(reservation).toContain('calculateMappedLegacyCarRentalQuote');
    expect(reservation).toContain('const mappedBooking = thresholdBooking || mappedLegacyBooking;');
    expect(reservation).toContain('if (mappedBooking) {');
    expect(reservation).toContain('data.pickup_city_code = pickupCityCode;');
    expect(reservation).toContain('data.return_city_code = returnCityCode;');
  });

  test('configured city catalog requires mapped capability but not threshold capability', () => {
    const source = read('js/car-location-options.js');
    expect(source).toContain("if (flags?.mappedEnabled !== true) {");
    expect(source).not.toContain("flags?.mappedEnabled !== true || flags?.thresholdDailyRatesEnabled !== true");
  });

  test('public booking submission reaches the exact mapped-legacy server route guard', () => {
    const bookingRpc = read('supabase/migrations/20260810170000_car_booking_public_reference.sql');
    const fleetOperations = read('supabase/migrations/20260811120000_car_fleet_operations.sql');
    expect(bookingRpc).toContain("'pickup_city_code'");
    expect(bookingRpc).toContain("'return_city_code'");
    expect(bookingRpc).toContain('pickup_city_code,');
    expect(bookingRpc).toContain('return_city_code,');
    expect(fleetOperations).toContain('create or replace function public.car_mapped_legacy_offer_route_is_booking_eligible(');
    expect(fleetOperations).toContain("elsif v_strategy = 'legacy_compat'");
    expect(fleetOperations).toContain("and v_availability_mode = 'mapped'");
    expect(fleetOperations).toContain('new.pickup_city_code,');
    expect(fleetOperations).toContain('new.return_city_code');
    expect(fleetOperations).toContain("message = 'mapped_legacy_booking_offer_or_route_not_public_eligible'");
  });

  test('mapped-legacy route admission is status-neutral and cannot represent partner acceptance', () => {
    const fleetOperations = read('supabase/migrations/20260811120000_car_fleet_operations.sql');
    const start = fleetOperations.indexOf(
      'create or replace function public.car_mapped_legacy_offer_route_is_booking_eligible(',
    );
    const end = fleetOperations.indexOf(
      'comment on function public.car_mapped_legacy_offer_route_is_booking_eligible',
      start,
    );
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const routeGuard = fleetOperations.slice(start, end);
    expect(routeGuard).toContain("offer.pricing_strategy = 'legacy_compat'");
    expect(routeGuard).toContain("offer.availability_mode = 'mapped'");
    expect(routeGuard).toContain('availability.pickup_enabled');
    expect(routeGuard).toContain('availability.return_enabled');
    expect(routeGuard).toContain('car_multicity_directional_availability_is_valid');
    expect(routeGuard).not.toMatch(/\b(?:insert|update|delete)\s+/i);
    expect(routeGuard).not.toMatch(/accepted|confirmed/i);
  });
});
