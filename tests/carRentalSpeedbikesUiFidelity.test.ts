import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

function read(relative: string): string {
  return fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
}

function loadCore(): any {
  const context: Record<string, unknown> = {};
  vm.runInNewContext(read('admin/car-rental-multicity-core.js'), context, {
    filename: 'admin/car-rental-multicity-core.js',
  });
  return context.CarRentalMulticityCore;
}

const core = loadCore();

function bicycleContext() {
  return {
    offer: {
      id: 'speedbikes-bicycle-b',
      updated_at: '2026-08-10T10:00:00Z',
      vehicle_kind_id: 'kind-bicycle',
      pricing_strategy: 'threshold_daily_rate',
      availability_mode: 'legacy',
      pricing_profile_id: 'profile-larnaca',
      location: 'larnaca',
      car_model: { pl: 'Rower grupa B', en: 'Bicycle Group B', he: 'אופניים קבוצה B' },
      car_type: { pl: 'Rower', en: 'Bicycle', he: 'אופניים' },
      description: { pl: 'Opis', en: 'Description', he: 'תיאור' },
      features: { pl: ['7 biegów'], en: ['7 gears'], he: ['7 הילוכים'] },
      transmission: null,
      fuel_type: null,
      engine_capacity_cc: null,
      required_licence_category: null,
      minimum_driver_age: 18,
      max_passengers: null,
      max_luggage: null,
      stock_count: 0,
      sort_order: 220,
      is_available: false,
      is_published: false,
      north_allowed: false,
      image_url: null,
      currency: 'EUR',
      insurance_mode: 'not_offered',
      insurance_per_day: 0,
      young_driver_fee: false,
      young_driver_cost: 0,
      min_rental_days: 1,
      max_rental_days: null,
      owner_partner_id: 'speedbikes-partner',
    },
    profiles: [{
      id: 'profile-larnaca', code: 'larnaca', calculator_key: 'larnaca',
      legacy_booking_location: 'larnaca', is_active: true,
    }],
    profileCities: [],
    cities: [],
    availability: [],
    dailyRateTiers: [{
      id: 'tier-1', offer_id: 'speedbikes-bicycle-b', threshold_days: 1,
      daily_rate: 15, is_active: true, updated_at: '2026-08-10T10:00:00Z',
    }],
    vehicleKinds: [{ id: 'kind-bicycle', code: 'bicycle', is_active: true }],
    partners: [{ id: 'speedbikes-partner', status: 'active', can_manage_cars: true }],
    partnerResources: [],
    siteSetting: {
      car_multi_city_mapped_enabled: false,
      car_threshold_daily_rates_enabled: false,
    },
  };
}

describe('SpeedBikes Admin and public content fidelity', () => {
  test('an imported bicycle preserves unknown passenger and luggage capacity as NULL', () => {
    const context = bicycleContext();
    const draft = core.createDraft(context, { mode: 'vehicle' });

    expect(draft.vehicle.maxPassengers).toBeNull();
    expect(draft.vehicle.maxLuggage).toBeNull();
    expect(core.validateDraft(draft, context).errors).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'maxPassengers' }),
      expect.objectContaining({ field: 'maxLuggage' }),
    ]));
    expect(core.vehiclePayload(draft)).toEqual(expect.objectContaining({
      max_passengers: null,
      max_luggage: null,
      transmission: null,
      fuel_type: null,
      engine_capacity_cc: null,
      required_licence_category: null,
    }));
  });

  test('the new vehicle editor exposes translated features without flattening JSONB', () => {
    const source = read('admin/car-rental-multicity-ui.js');
    expect(source).toContain("i18nListInput('content.features', 'Features'");
    expect(source).toContain('data-i18n-list-field=');
    expect(source).toContain("setPath(state.draft, `${i18nListField}.${target.dataset.language}`, items)");
    expect(source).not.toContain('Features remain unchanged in this simplified editor');
  });

  test('public mapped reads include the exact structured SpeedBikes fields', () => {
    const source = read('js/car-rental-availability-repository.js');
    expect(source).toContain("'engine_capacity_cc'");
    expect(source).toContain("'required_licence_category'");
    expect(source).toContain("'minimum_driver_age'");
  });

  test('threshold UI does not fabricate seats, AC or free child seats', () => {
    const admin = read('admin/admin.js');
    const modal = read('js/car-offer-modal.js');
    const cards = read('js/car-rental-paphos.js');
    const home = read('js/home-cars.js');

    expect(modal).toContain('getConfirmedPassengerCapacity');
    expect(modal).toContain("const childSeatsField = thresholdOffer\n    ? ''");
    expect(modal).toContain("thresholdOffer ? '' : '<span class=\"ce-car-home-pill\">❄️ AC</span>'");
    expect(modal).toContain('engine_capacity_cc');
    expect(modal).toContain('required_licence_category');
    expect(modal).toContain('minimum_driver_age');
    expect(cards).toContain("[transmission, seatsText, thresholdOffer ? '' : 'AC']");
    expect(home).toContain('Optional insurance (availability and price depend on the vehicle)');
    expect(home).toContain("const seats = Number(car?.max_passengers)");
    expect(admin).toContain("const passengerLabel = Number.isInteger(passengerCount) && passengerCount > 0");
    expect(admin).not.toContain('${car.max_passengers} seats');
  });
});
