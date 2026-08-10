// Car Rental Multi-City Stage 2D: public read-only PostgREST repository.

const CITY_SELECT = 'id,code,name_i18n,is_active,sort_order';
const PROFILE_SELECT = 'id,code,name,calculator_key,legacy_booking_location,is_active';
const PROFILE_CITY_SELECT = [
  'pricing_profile_id',
  'city_id',
  'pickup_supported',
  'return_supported',
  'legacy_pricing_city_key',
  'is_active',
].join(',');
const AVAILABILITY_SELECT = [
  'offer_id',
  'city_id',
  'pickup_enabled',
  'return_enabled',
  'is_active',
  'fee_mode',
  'fee_per_direction',
].join(',');
const DAILY_RATE_TIER_SELECT = [
  'id',
  'offer_id',
  'threshold_days',
  'daily_rate',
  'is_active',
  'updated_at',
].join(',');
const OFFER_SELECT = [
  'id',
  'location',
  'pricing_profile_id',
  'pricing_strategy',
  'availability_mode',
  'vehicle_kind_id',
  'car_model',
  'car_type',
  'description',
  'features',
  'transmission',
  'fuel_type',
  'engine_capacity_cc',
  'required_licence_category',
  'minimum_driver_age',
  'max_passengers',
  'max_luggage',
  'stock_count',
  'sort_order',
  'is_available',
  'is_published',
  'submission_status',
  'north_allowed',
  'image_url',
  'price_per_day',
  'price_3days',
  'price_4_6days',
  'price_7_10days',
  'price_10plus_days',
  'currency',
  'deposit_amount',
  'insurance_per_day',
  'insurance_mode',
  'young_driver_fee',
  'young_driver_cost',
  'min_rental_days',
  'max_rental_days',
  'owner_partner_id',
].join(',');

function uniqueStrings(values) {
  return [...new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean))];
}

function estimateBytes(value) {
  const serialized = JSON.stringify(value == null ? null : value);
  if (typeof TextEncoder === 'function') {
    return new TextEncoder().encode(serialized).byteLength;
  }
  return serialized.length;
}

function createMetrics() {
  return {
    requests: 0,
    responseBytes: 0,
    durationMs: 0,
    queries: [],
  };
}

export function createCarRentalAvailabilityRepository({ supabase } = {}) {
  if (!supabase || typeof supabase.from !== 'function') {
    throw new Error('A Supabase/PostgREST client is required for the availability reader.');
  }

  const metrics = createMetrics();

  async function read(label, query) {
    const startedAt = typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now();
    const { data, error } = await query;
    const finishedAt = typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now();
    const durationMs = Math.max(0, finishedAt - startedAt);
    metrics.requests += 1;
    metrics.responseBytes += estimateBytes(data);
    metrics.durationMs += durationMs;
    metrics.queries.push({ label, durationMs, rows: Array.isArray(data) ? data.length : data ? 1 : 0 });
    if (error) {
      const repositoryError = new Error(`Car availability read failed: ${label}`);
      repositoryError.code = error.code || 'CAR_AVAILABILITY_READ_FAILED';
      repositoryError.details = error.details || error.message || '';
      throw repositoryError;
    }
    return data;
  }

  async function getFeatureFlags() {
    const row = await read(
      'site_settings Cars runtime flags',
      supabase
        .from('site_settings')
        .select('car_multi_city_mapped_enabled,car_threshold_daily_rates_enabled')
        .eq('id', 1)
        .maybeSingle(),
    );
    return Object.freeze({
      mappedEnabled: row?.car_multi_city_mapped_enabled === true,
      thresholdDailyRatesEnabled: row?.car_threshold_daily_rates_enabled === true,
    });
  }

  async function getFeatureFlag() {
    return (await getFeatureFlags()).mappedEnabled;
  }

  async function getActiveCities() {
    return await read(
      'active public city catalog',
      supabase
        .from('car_rental_cities')
        .select(CITY_SELECT)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('code', { ascending: true }),
    ) || [];
  }

  async function readMappedContext({ pickupCityCode, returnCityCode } = {}) {
    const cityCodes = uniqueStrings([pickupCityCode, returnCityCode]);
    if (
      !String(pickupCityCode || '').trim()
      || !String(returnCityCode || '').trim()
      || (pickupCityCode !== returnCityCode && cityCodes.length !== 2)
    ) {
      return { cities: [], availability: [], offers: [], profiles: [], profileCities: [], dailyRateTiers: [], metrics: getMetrics() };
    }

    const cities = await read(
      'active cities by exact code',
      supabase
        .from('car_rental_cities')
        .select(CITY_SELECT)
        .in('code', cityCodes)
        .eq('is_active', true),
    ) || [];
    const cityIds = uniqueStrings(cities.map((city) => city.id));
    if (!cityIds.length) {
      return { cities, availability: [], offers: [], profiles: [], profileCities: [], dailyRateTiers: [], metrics: getMetrics() };
    }

    const availability = await read(
      'active availability for exact endpoint cities',
      supabase
        .from('car_offer_city_availability')
        .select(AVAILABILITY_SELECT)
        .in('city_id', cityIds)
        .eq('is_active', true),
    ) || [];

    const pickupCity = cities.find((city) => city.code === pickupCityCode) || null;
    const returnCity = cities.find((city) => city.code === returnCityCode) || null;
    const pickupIds = new Set(
      availability
        .filter((row) => row.city_id === pickupCity?.id && row.pickup_enabled === true)
        .map((row) => String(row.offer_id)),
    );
    const returnIds = new Set(
      availability
        .filter((row) => row.city_id === returnCity?.id && row.return_enabled === true)
        .map((row) => String(row.offer_id)),
    );
    const offerIds = [...pickupIds].filter((offerId) => returnIds.has(offerId)).sort();
    if (!offerIds.length) {
      return { cities, availability, offers: [], profiles: [], profileCities: [], dailyRateTiers: [], metrics: getMetrics() };
    }

    const offers = await read(
      'mapped offers by exact IDs',
      supabase
        .from('car_offers')
        .select(OFFER_SELECT)
        .in('id', offerIds),
    ) || [];
    const profileIds = uniqueStrings(offers
      .filter((offer) => String(offer?.pricing_strategy || 'legacy_compat') === 'legacy_compat')
      .map((offer) => offer.pricing_profile_id));
    const thresholdOfferIds = uniqueStrings(offers
      .filter((offer) => String(offer?.pricing_strategy || 'legacy_compat') === 'threshold_daily_rate')
      .map((offer) => offer.id));
    let profiles = [];
    let profileCities = [];
    let dailyRateTiers = [];
    let publicEligibleThresholdOfferIds = [];
    const reads = [];
    if (profileIds.length) {
      reads.push(Promise.all([
        read(
          'active pricing profiles by exact IDs',
          supabase
            .from('car_pricing_profiles')
            .select(PROFILE_SELECT)
            .in('id', profileIds)
            .eq('is_active', true),
        ),
        read(
          'active profile-city mappings by exact composite scope',
          supabase
            .from('car_pricing_profile_cities')
            .select(PROFILE_CITY_SELECT)
            .in('pricing_profile_id', profileIds)
            .in('city_id', cityIds)
            .eq('is_active', true),
        ),
      ]).then(([profileRows, mappingRows]) => {
        profiles = profileRows || [];
        profileCities = mappingRows || [];
      }));
    }
    if (thresholdOfferIds.length) {
      reads.push(Promise.all([
        read(
          'active daily-rate tiers by exact offer IDs',
          supabase
            .from('car_offer_daily_rate_tiers')
            .select(DAILY_RATE_TIER_SELECT)
            .in('offer_id', thresholdOfferIds)
            .eq('is_active', true)
            .order('threshold_days', { ascending: true }),
        ),
        read(
          'authoritative public threshold eligibility by exact route',
          supabase.rpc('resolve_public_threshold_offer_ids', {
            p_pickup_city_code: String(pickupCityCode || '').trim().toLowerCase(),
            p_return_city_code: String(returnCityCode || '').trim().toLowerCase(),
          }),
        ),
      ]).then(([tierRows, eligibilityRows]) => {
        dailyRateTiers = tierRows || [];
        const allowed = new Set(thresholdOfferIds);
        publicEligibleThresholdOfferIds = uniqueStrings((eligibilityRows || [])
          .map((row) => row?.offer_id))
          .filter((offerId) => allowed.has(offerId));
      }));
    }
    await Promise.all(reads);

    return {
      cities,
      availability,
      offers,
      profiles,
      profileCities,
      dailyRateTiers,
      publicEligibleThresholdOfferIds,
      thresholdEligibilityAuthoritative: thresholdOfferIds.length > 0,
      metrics: getMetrics(),
    };
  }

  function getMetrics() {
    return {
      requests: metrics.requests,
      responseBytes: metrics.responseBytes,
      durationMs: Number(metrics.durationMs.toFixed(3)),
      queries: metrics.queries.map((entry) => ({ ...entry, durationMs: Number(entry.durationMs.toFixed(3)) })),
    };
  }

  return Object.freeze({
    getFeatureFlag,
    getFeatureFlags,
    getActiveCities,
    readMappedContext,
    getMetrics,
  });
}

export const CAR_RENTAL_AVAILABILITY_PUBLIC_SELECTS = Object.freeze({
  cities: CITY_SELECT,
  profiles: PROFILE_SELECT,
  profileCities: PROFILE_CITY_SELECT,
  availability: AVAILABILITY_SELECT,
  offers: OFFER_SELECT,
  dailyRateTiers: DAILY_RATE_TIER_SELECT,
});
