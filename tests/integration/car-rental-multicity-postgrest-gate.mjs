import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createClient } from '@supabase/supabase-js';
import { TOKENS } from './car-rental-multicity-postgrest-auth.mjs';

const URL = process.env.CAR_MULTICITY_POSTGREST_URL || 'http://127.0.0.1:52999';
const OFFER_LARNACA = 'ca300001-0000-4000-8000-000000000001';
const OFFER_PAPHOS = 'ca300001-0000-4000-8000-000000000002';
const PROFILE_LARNACA = 'ca210001-0000-4000-8000-000000000001';
const PROFILE_PAPHOS = 'ca210001-0000-4000-8000-000000000002';
const CITY_LARNACA = 'ca200001-0000-4000-8000-000000000001';
const CITY_NICOSIA = 'ca200001-0000-4000-8000-000000000002';
const KIND_CAR = 'ca220001-0000-4000-8000-000000000001';
const KIND_QUAD = 'ca220001-0000-4000-8000-000000000002';
const PARTNER_LARNACA = 'ca2f0000-0000-4000-8000-000000000001';
const PARTNER_PAPHOS = 'ca2f0000-0000-4000-8000-000000000002';
const TEMP_OFFER = 'ca3f0000-0000-4000-8000-000000000001';
const TEMP_MAPPED_OFFER = 'ca3f0000-0000-4000-8000-000000000002';
const TEMP_CONSTRAINT_OFFER = 'ca3f0000-0000-4000-8000-000000000003';
const TEMP_PROFILE = 'ca3f1000-0000-4000-8000-000000000001';

const protectedFields = [
  'id', 'price_per_day', 'price_3days', 'price_4_6days', 'price_7_10days',
  'price_10plus_days', 'currency', 'location', 'owner_partner_id',
  'deposit_amount', 'insurance_per_day', 'young_driver_fee', 'young_driver_cost',
  'stock_count', 'north_allowed', 'is_available', 'is_published', 'submission_status',
];

function clientFor(token) {
  return createClient(URL, TOKENS.anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

const clients = Object.freeze({
  anon: clientFor(TOKENS.anon),
  nonAdmin: clientFor(TOKENS.nonAdmin),
  admin: clientFor(TOKENS.admin),
  service: clientFor(TOKENS.service),
});

async function http(path, token, options = {}) {
  const headers = {
    apikey: TOKENS.anon,
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    ...(options.prefer ? { Prefer: options.prefer } : {}),
  };
  const response = await fetch(`${URL}/${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  return { ok: response.ok, status: response.status, body, headers: Object.fromEntries(response.headers.entries()) };
}

function assertDatabaseError(result, marker) {
  assert.equal(result.ok, false, `Expected database rejection for ${marker}, received ${result.status}`);
  assert.ok([400, 409].includes(result.status), `Expected 400/409 for ${marker}, received ${result.status}`);
  assert.match(JSON.stringify(result.body), new RegExp(marker));
}

async function selectOne(table, id) {
  const { data, error } = await clients.service.from(table).select('*').eq('id', id).limit(1);
  assert.ifError(error);
  return data?.[0] || null;
}

async function protectedSnapshot() {
  const { data, error } = await clients.service
    .from('car_offers')
    .select(protectedFields.join(','))
    .in('id', [OFFER_LARNACA, OFFER_PAPHOS])
    .order('id');
  assert.ifError(error);
  return data;
}

function loadRepository() {
  const context = {};
  for (const relative of [
    'admin/car-rental-multicity-core.js',
    'admin/car-rental-multicity-repository.js',
  ]) {
    vm.runInNewContext(fs.readFileSync(relative, 'utf8'), context, { filename: relative });
  }
  return {
    core: context.CarRentalMulticityCore,
    repositoryApi: context.CarRentalMulticityRepository,
  };
}

async function resetFoundationRows() {
  const service = clients.service;
  await service.from('car_offer_city_availability').delete().in('offer_id', [
    OFFER_LARNACA, OFFER_PAPHOS, TEMP_OFFER, TEMP_MAPPED_OFFER, TEMP_CONSTRAINT_OFFER,
  ]);
  await service.from('car_offers').delete().in('id', [TEMP_OFFER, TEMP_MAPPED_OFFER, TEMP_CONSTRAINT_OFFER]);
  await service.from('car_pricing_profile_cities').delete().eq('pricing_profile_id', TEMP_PROFILE);
  await service.from('car_pricing_profiles').delete().eq('id', TEMP_PROFILE);
  await service.from('car_rental_cities').delete().in('code', ['integration-city', 'service-city']);
  await service.from('car_pricing_profile_cities').update({
    pickup_supported: true,
    return_supported: true,
    legacy_pricing_city_key: 'nicosia',
    is_active: true,
  }).eq('pricing_profile_id', PROFILE_LARNACA).eq('city_id', CITY_NICOSIA);
  await service.from('car_pricing_profile_cities').update({
    pickup_supported: true,
    return_supported: true,
    legacy_pricing_city_key: 'larnaca',
    is_active: true,
  }).eq('pricing_profile_id', PROFILE_LARNACA).eq('city_id', CITY_LARNACA);
  await service.from('car_rental_cities').update({ is_active: true }).eq('id', CITY_LARNACA);
  await service.from('car_pricing_profiles').update({ is_active: true }).eq('id', PROFILE_LARNACA);
  await service.from('car_offers').update({
    location: 'larnaca',
    pricing_profile_id: PROFILE_LARNACA,
    availability_mode: 'legacy',
    vehicle_kind_id: KIND_CAR,
    owner_partner_id: PARTNER_LARNACA,
    stock_count: 2,
    is_available: true,
    is_published: true,
  }).eq('id', OFFER_LARNACA);
  await service.from('car_offers').update({
    location: 'paphos',
    pricing_profile_id: PROFILE_PAPHOS,
    availability_mode: 'legacy',
    vehicle_kind_id: KIND_CAR,
    owner_partner_id: PARTNER_PAPHOS,
    stock_count: 1,
    is_available: true,
    is_published: true,
  }).eq('id', OFFER_PAPHOS);
  await service.from('site_settings').update({ car_multi_city_mapped_enabled: false }).eq('id', 1);
}

const summary = {
  environment: { postgrestUrl: URL },
  rls: {},
  adminCrud: [],
  constraints: [],
  concurrency: [],
  cleanup: null,
};

await resetFoundationRows();
const baseline = await protectedSnapshot();

try {
  for (const [table, expectedCount] of [
    ['car_rental_cities', 6],
    ['car_pricing_profiles', 2],
    ['car_vehicle_kinds', 5],
  ]) {
    const result = await http(`${table}?select=id`, TOKENS.anon);
    assert.equal(result.status, 200);
    assert.equal(result.body.length, expectedCount);
    const authenticatedResult = await http(`${table}?select=id`, TOKENS.nonAdmin);
    assert.equal(authenticatedResult.status, 200);
    assert.equal(authenticatedResult.body.length, expectedCount);
  }
  const anonAvailability = await http('car_offer_city_availability?select=*', TOKENS.anon);
  assert.equal(anonAvailability.status, 200);
  assert.deepEqual(anonAvailability.body, []);
  const anonDeniedInsert = await http('car_rental_cities', TOKENS.anon, {
    method: 'POST', prefer: 'return=representation',
    body: { code: 'anon-denied', name_i18n: { pl: 'x', en: 'x', he: 'x' }, place_types: ['city'], is_active: false, sort_order: 9000 },
  });
  const anonDeniedUpdate = await http(`car_rental_cities?id=eq.${CITY_LARNACA}`, TOKENS.anon, {
    method: 'PATCH', prefer: 'return=representation', body: { sort_order: 9000 },
  });
  const anonDeniedDelete = await http(`car_rental_cities?id=eq.${CITY_LARNACA}`, TOKENS.anon, {
    method: 'DELETE', prefer: 'return=representation',
  });
  for (const denied of [anonDeniedInsert, anonDeniedUpdate, anonDeniedDelete]) {
    assert.equal(denied.ok, false);
    assert.ok([401, 403].includes(denied.status));
  }
  summary.rls.anon = {
    reads: 'PASS',
    deniedInsertStatus: anonDeniedInsert.status,
    deniedUpdateStatus: anonDeniedUpdate.status,
    deniedDeleteStatus: anonDeniedDelete.status,
  };

  const nonAdminDeniedInsert = await http('car_rental_cities', TOKENS.nonAdmin, {
    method: 'POST', prefer: 'return=representation',
    body: { code: 'nonadmin-denied', name_i18n: { pl: 'x', en: 'x', he: 'x' }, place_types: ['city'], is_active: false, sort_order: 9001 },
  });
  assert.equal(nonAdminDeniedInsert.ok, false);
  assert.equal(nonAdminDeniedInsert.status, 403);
  const nonAdminDeniedUpdate = await http(
    `car_offers?id=eq.${OFFER_LARNACA}`,
    TOKENS.nonAdmin,
    { method: 'PATCH', prefer: 'return=representation', body: { stock_count: 99 } },
  );
  assert.equal(nonAdminDeniedUpdate.status, 200);
  assert.deepEqual(nonAdminDeniedUpdate.body, []);
  assert.equal((await selectOne('car_offers', OFFER_LARNACA)).stock_count, 2);
  const nonAdminDeniedMapping = await http(
    `car_pricing_profile_cities?pricing_profile_id=eq.${PROFILE_LARNACA}&city_id=eq.${CITY_NICOSIA}`,
    TOKENS.nonAdmin,
    { method: 'PATCH', prefer: 'return=representation', body: { return_supported: false } },
  );
  assert.equal(nonAdminDeniedMapping.status, 200);
  assert.deepEqual(nonAdminDeniedMapping.body, []);
  const nonAdminDeniedAvailability = await http('car_offer_city_availability', TOKENS.nonAdmin, {
    method: 'POST', prefer: 'return=representation',
    body: { offer_id: OFFER_LARNACA, city_id: CITY_NICOSIA, pickup_enabled: true, return_enabled: false, is_active: true },
  });
  assert.equal(nonAdminDeniedAvailability.status, 403);
  const nonAdminDeniedProfile = await http(`car_pricing_profiles?id=eq.${PROFILE_LARNACA}`, TOKENS.nonAdmin, {
    method: 'PATCH', prefer: 'return=representation', body: { name: 'Denied profile rename' },
  });
  assert.equal(nonAdminDeniedProfile.status, 200);
  assert.deepEqual(nonAdminDeniedProfile.body, []);
  const nonAdminDeniedKind = await http(`car_vehicle_kinds?id=eq.${KIND_CAR}`, TOKENS.nonAdmin, {
    method: 'PATCH', prefer: 'return=representation', body: { sort_order: 9999 },
  });
  assert.equal(nonAdminDeniedKind.status, 200);
  assert.deepEqual(nonAdminDeniedKind.body, []);
  const nonAdminDeniedDelete = await http(`car_rental_cities?id=eq.${CITY_LARNACA}`, TOKENS.nonAdmin, {
    method: 'DELETE', prefer: 'return=representation',
  });
  assert.equal(nonAdminDeniedDelete.status, 200);
  assert.deepEqual(nonAdminDeniedDelete.body, []);
  summary.rls.nonAdmin = {
    reads: 'PASS',
    deniedInsertStatus: nonAdminDeniedInsert.status,
    deniedUpdateStatus: nonAdminDeniedUpdate.status,
    deniedUpdateRows: 0,
    deniedMappingUpdateStatus: nonAdminDeniedMapping.status,
    deniedAvailabilityInsertStatus: nonAdminDeniedAvailability.status,
    deniedProfileUpdateStatus: nonAdminDeniedProfile.status,
    deniedVehicleKindUpdateStatus: nonAdminDeniedKind.status,
    deniedDeleteStatus: nonAdminDeniedDelete.status,
  };

  const cityInsert = await http('car_rental_cities', TOKENS.admin, {
    method: 'POST', prefer: 'return=representation',
    body: {
      code: 'integration-city', name_i18n: { pl: 'Integracja', en: 'Integration', he: 'בדיקה' },
      place_types: ['city'], is_active: false, sort_order: 9100,
    },
  });
  assert.equal(cityInsert.status, 201);
  assert.equal(cityInsert.body[0].is_active, false);
  const tempCityId = cityInsert.body[0].id;
  const cityUpdate = await http(`car_rental_cities?id=eq.${tempCityId}`, TOKENS.admin, {
    method: 'PATCH', prefer: 'return=representation', body: { sort_order: 9101 },
  });
  assert.equal(cityUpdate.status, 200);
  assert.equal(cityUpdate.body.length, 1);
  const cityDelete = await http(`car_rental_cities?id=eq.${tempCityId}`, TOKENS.admin, {
    method: 'DELETE', prefer: 'return=representation',
  });
  assert.equal(cityDelete.status, 200);
  assert.equal(cityDelete.body.length, 1);
  summary.adminCrud.push('city exact-ID CRUD');

  const profileInsert = await http('car_pricing_profiles', TOKENS.admin, {
    method: 'POST', prefer: 'return=representation',
    body: {
      id: TEMP_PROFILE, code: 'integration-larnaca', name: 'Integration profile',
      calculator_key: 'larnaca', legacy_booking_location: 'larnaca', is_active: true,
    },
  });
  assert.equal(profileInsert.status, 201);
  const mappingInsert = await http('car_pricing_profile_cities', TOKENS.admin, {
    method: 'POST', prefer: 'return=representation',
    body: {
      pricing_profile_id: TEMP_PROFILE, city_id: CITY_NICOSIA,
      pickup_supported: true, return_supported: true,
      legacy_pricing_city_key: 'nicosia', is_active: true,
    },
  });
  assert.equal(mappingInsert.status, 201);
  const mappingUpdate = await http(
    `car_pricing_profile_cities?pricing_profile_id=eq.${TEMP_PROFILE}&city_id=eq.${CITY_NICOSIA}`,
    TOKENS.admin,
    { method: 'PATCH', prefer: 'return=representation', body: { return_supported: false } },
  );
  assert.equal(mappingUpdate.status, 200);
  assert.equal(mappingUpdate.body.length, 1);
  const mappingDelete = await http(
    `car_pricing_profile_cities?pricing_profile_id=eq.${TEMP_PROFILE}&city_id=eq.${CITY_NICOSIA}`,
    TOKENS.admin,
    { method: 'DELETE', prefer: 'return=representation' },
  );
  assert.equal(mappingDelete.status, 200);
  assert.equal(mappingDelete.body.length, 1);
  await http(`car_pricing_profiles?id=eq.${TEMP_PROFILE}`, TOKENS.admin, { method: 'DELETE', prefer: 'return=representation' });
  summary.adminCrud.push('profile-city exact composite-key CRUD');

  const availabilityInsert = await http('car_offer_city_availability', TOKENS.admin, {
    method: 'POST', prefer: 'return=representation',
    body: {
      offer_id: OFFER_LARNACA, city_id: CITY_NICOSIA,
      pickup_enabled: true, return_enabled: false, is_active: true,
    },
  });
  assert.equal(availabilityInsert.status, 201);
  assert.deepEqual(
    Object.fromEntries(['offer_id', 'city_id', 'pickup_enabled', 'return_enabled', 'is_active'].map((key) => [key, availabilityInsert.body[0][key]])),
    { offer_id: OFFER_LARNACA, city_id: CITY_NICOSIA, pickup_enabled: true, return_enabled: false, is_active: true },
  );
  assert.deepEqual(
    (await http(`car_offer_city_availability?offer_id=eq.${OFFER_LARNACA}&select=*`, TOKENS.anon)).body,
    [],
  );
  await http(
    `car_offer_city_availability?offer_id=eq.${OFFER_LARNACA}&city_id=eq.${CITY_NICOSIA}`,
    TOKENS.admin,
    { method: 'DELETE', prefer: 'return=representation' },
  );
  assert.deepEqual(await protectedSnapshot(), baseline);
  summary.adminCrud.push('independent pickup/return availability');

  let offer = await selectOne('car_offers', OFFER_LARNACA);
  const vehicleUpdate = await http(
    `car_offers?id=eq.${OFFER_LARNACA}&updated_at=eq.${encodeURIComponent(offer.updated_at)}`,
    TOKENS.admin,
    { method: 'PATCH', prefer: 'return=representation', body: { vehicle_kind_id: KIND_QUAD } },
  );
  assert.equal(vehicleUpdate.status, 200);
  assert.equal(vehicleUpdate.body.length, 1);
  assert.deepEqual(vehicleUpdate.body[0].car_type, offer.car_type);
  assert.equal(vehicleUpdate.body[0].price_per_day, offer.price_per_day);
  offer = vehicleUpdate.body[0];
  const vehicleRestore = await http(
    `car_offers?id=eq.${OFFER_LARNACA}&updated_at=eq.${encodeURIComponent(offer.updated_at)}`,
    TOKENS.admin,
    { method: 'PATCH', prefer: 'return=representation', body: { vehicle_kind_id: KIND_CAR } },
  );
  assert.equal(vehicleRestore.body.length, 1);
  summary.adminCrud.push('vehicle kind exact-ID update');

  offer = await selectOne('car_offers', OFFER_LARNACA);
  const pricesBeforeProfile = Object.fromEntries(protectedFields.filter((field) => field.startsWith('price_')).map((field) => [field, offer[field]]));
  const profileUpdate = await http(
    `car_offers?id=eq.${OFFER_LARNACA}&updated_at=eq.${encodeURIComponent(offer.updated_at)}`,
    TOKENS.admin,
    { method: 'PATCH', prefer: 'return=representation', body: { pricing_profile_id: PROFILE_PAPHOS, location: 'paphos' } },
  );
  assert.equal(profileUpdate.body.length, 1);
  assert.equal(profileUpdate.body[0].pricing_profile_id, PROFILE_PAPHOS);
  assert.equal(profileUpdate.body[0].location, 'paphos');
  assert.deepEqual(
    Object.fromEntries(Object.keys(pricesBeforeProfile).map((field) => [field, profileUpdate.body[0][field]])),
    pricesBeforeProfile,
  );
  const profileRestore = await http(
    `car_offers?id=eq.${OFFER_LARNACA}&updated_at=eq.${encodeURIComponent(profileUpdate.body[0].updated_at)}`,
    TOKENS.admin,
    { method: 'PATCH', prefer: 'return=representation', body: { pricing_profile_id: PROFILE_LARNACA, location: 'larnaca' } },
  );
  assert.equal(profileRestore.body.length, 1);
  summary.adminCrud.push('atomic pricing profile/location update with price preservation');

  offer = await selectOne('car_offers', OFFER_LARNACA);
  const partnerUpdate = await http(
    `car_offers?id=eq.${OFFER_LARNACA}&updated_at=eq.${encodeURIComponent(offer.updated_at)}`,
    TOKENS.admin,
    { method: 'PATCH', prefer: 'return=representation', body: { owner_partner_id: PARTNER_PAPHOS } },
  );
  assert.equal(partnerUpdate.body.length, 1);
  const partnerRestore = await http(
    `car_offers?id=eq.${OFFER_LARNACA}&updated_at=eq.${encodeURIComponent(partnerUpdate.body[0].updated_at)}`,
    TOKENS.admin,
    { method: 'PATCH', prefer: 'return=representation', body: { owner_partner_id: PARTNER_LARNACA } },
  );
  assert.equal(partnerRestore.body.length, 1);
  summary.adminCrud.push('partner exact-ID update independent of availability');

  const createOfferBody = {
    id: TEMP_OFFER,
    location: 'larnaca', pricing_profile_id: PROFILE_LARNACA,
    availability_mode: 'legacy', vehicle_kind_id: KIND_CAR,
    car_type: { pl: 'Test', en: 'Test', he: 'בדיקה' },
    car_model: { pl: 'Nowe testowe', en: 'New test', he: 'חדש בדיקה' },
    description: { pl: '', en: '', he: '' }, features: { pl: [], en: [], he: [] },
    transmission: 'manual', fuel_type: 'petrol', max_passengers: 4, max_luggage: 1,
    stock_count: 1, sort_order: 9000, price_per_day: 40,
    price_3days: 120, price_4_6days: 39, price_7_10days: 37, price_10plus_days: 35,
    currency: 'EUR', deposit_amount: 200, insurance_per_day: 17,
    young_driver_fee: true, young_driver_cost: 10,
    owner_partner_id: PARTNER_LARNACA, north_allowed: true,
    is_available: true, is_published: false, submission_status: 'approved',
  };
  const offerInsert = await http('car_offers', TOKENS.admin, {
    method: 'POST', prefer: 'return=representation', body: createOfferBody,
  });
  assert.equal(offerInsert.status, 201);
  assert.equal(offerInsert.body[0].id, TEMP_OFFER);
  assert.equal(offerInsert.body[0].availability_mode, 'legacy');
  const createAvailability = await http('car_offer_city_availability', TOKENS.admin, {
    method: 'POST', prefer: 'return=representation',
    body: { offer_id: TEMP_OFFER, city_id: CITY_LARNACA, pickup_enabled: true, return_enabled: true, is_active: true },
  });
  assert.equal(createAvailability.status, 201);
  const { data: setting, error: settingError } = await clients.admin.from('site_settings').select('car_multi_city_mapped_enabled').eq('id', 1).single();
  assert.ifError(settingError);
  assert.equal(setting.car_multi_city_mapped_enabled, false);
  await http(`car_offers?id=eq.${TEMP_OFFER}`, TOKENS.admin, { method: 'DELETE', prefer: 'return=representation' });
  summary.adminCrud.push('new exact legacy offer plus conscious availability');

  const serviceCity = await http('car_rental_cities', TOKENS.service, {
    method: 'POST', prefer: 'return=representation',
    body: { code: 'service-city', name_i18n: { pl: 'S', en: 'S', he: 'ס' }, place_types: ['city'], is_active: false, sort_order: 9200 },
  });
  assert.equal(serviceCity.status, 201);
  const serviceCityId = serviceCity.body[0].id;
  assert.equal((await http(`car_rental_cities?id=eq.${serviceCityId}`, TOKENS.service, { method: 'PATCH', prefer: 'return=representation', body: { sort_order: 9201 } })).body.length, 1);
  assert.equal((await http(`car_rental_cities?id=eq.${serviceCityId}`, TOKENS.service, { method: 'DELETE', prefer: 'return=representation' })).body.length, 1);
  summary.rls.admin = { approvedCrud: 'PASS' };
  summary.rls.serviceRole = { approvedCrud: 'PASS' };

  const immutable = await http(`car_offers?id=eq.${OFFER_LARNACA}`, TOKENS.service, {
    method: 'PATCH', prefer: 'return=representation',
    body: { id: 'ca3f9999-0000-4000-8000-000000000001' },
  });
  assertDatabaseError(immutable, 'car_offer_id_is_immutable');
  summary.constraints.push('immutable offer ID');

  const mappedWithoutProfile = await http('car_offers', TOKENS.service, {
    method: 'POST', prefer: 'return=representation',
    body: { ...createOfferBody, id: TEMP_CONSTRAINT_OFFER, pricing_profile_id: null, availability_mode: 'mapped' },
  });
  assertDatabaseError(mappedWithoutProfile, 'mapped_car_offer_requires_pricing_profile');
  summary.constraints.push('mapped requires profile');

  const mismatchedProfile = await http(`car_offers?id=eq.${OFFER_LARNACA}`, TOKENS.service, {
    method: 'PATCH', prefer: 'return=representation', body: { pricing_profile_id: PROFILE_PAPHOS },
  });
  assertDatabaseError(mismatchedProfile, 'car_offer_pricing_profile_location_mismatch');
  summary.constraints.push('profile/location match');

  const paphosCrossCity = await http('car_pricing_profile_cities', TOKENS.service, {
    method: 'POST', prefer: 'return=representation',
    body: { pricing_profile_id: PROFILE_PAPHOS, city_id: CITY_NICOSIA, pickup_supported: true, return_supported: true, legacy_pricing_city_key: 'nicosia', is_active: true },
  });
  assertDatabaseError(paphosCrossCity, 'paphos_profile_cross_city_mapping_forbidden');
  summary.constraints.push('Paphos cross-city mapping');

  let nicosiaMapping = (await http(
    `car_pricing_profile_cities?pricing_profile_id=eq.${PROFILE_LARNACA}&city_id=eq.${CITY_NICOSIA}`,
    TOKENS.service,
  )).body[0];
  await http(
    `car_pricing_profile_cities?pricing_profile_id=eq.${PROFILE_LARNACA}&city_id=eq.${CITY_NICOSIA}&updated_at=eq.${encodeURIComponent(nicosiaMapping.updated_at)}`,
    TOKENS.service,
    { method: 'PATCH', prefer: 'return=representation', body: { pickup_supported: false } },
  );
  const unsupportedPickup = await http('car_offer_city_availability', TOKENS.service, {
    method: 'POST', prefer: 'return=representation',
    body: { offer_id: OFFER_LARNACA, city_id: CITY_NICOSIA, pickup_enabled: true, return_enabled: false, is_active: true },
  });
  assertDatabaseError(unsupportedPickup, 'car_offer_pickup_not_supported_by_profile');
  nicosiaMapping = (await http(
    `car_pricing_profile_cities?pricing_profile_id=eq.${PROFILE_LARNACA}&city_id=eq.${CITY_NICOSIA}`,
    TOKENS.service,
  )).body[0];
  await http(
    `car_pricing_profile_cities?pricing_profile_id=eq.${PROFILE_LARNACA}&city_id=eq.${CITY_NICOSIA}&updated_at=eq.${encodeURIComponent(nicosiaMapping.updated_at)}`,
    TOKENS.service,
    { method: 'PATCH', prefer: 'return=representation', body: { pickup_supported: true, return_supported: false } },
  );
  const unsupportedReturn = await http('car_offer_city_availability', TOKENS.service, {
    method: 'POST', prefer: 'return=representation',
    body: { offer_id: OFFER_LARNACA, city_id: CITY_NICOSIA, pickup_enabled: false, return_enabled: true, is_active: true },
  });
  assertDatabaseError(unsupportedReturn, 'car_offer_return_not_supported_by_profile');
  await http(
    `car_pricing_profile_cities?pricing_profile_id=eq.${PROFILE_LARNACA}&city_id=eq.${CITY_NICOSIA}`,
    TOKENS.service,
    { method: 'PATCH', prefer: 'return=representation', body: { pickup_supported: true, return_supported: true } },
  );
  summary.constraints.push('unsupported pickup/return');

  const noDirectionsInsert = await http('car_offers', TOKENS.service, {
    method: 'POST', prefer: 'return=representation', body: { ...createOfferBody, id: TEMP_CONSTRAINT_OFFER },
  });
  assert.equal(noDirectionsInsert.status, 201);
  const noDirectionsMapped = await http(`car_offers?id=eq.${TEMP_CONSTRAINT_OFFER}`, TOKENS.service, {
    method: 'PATCH', prefer: 'return=representation', body: { availability_mode: 'mapped' },
  });
  assertDatabaseError(noDirectionsMapped, 'mapped_car_offer_requires_active_pickup_and_return');
  assert.equal((await selectOne('car_offers', TEMP_CONSTRAINT_OFFER)).availability_mode, 'legacy');
  const oneDirectionAvailability = await http('car_offer_city_availability', TOKENS.service, {
    method: 'POST', prefer: 'return=representation',
    body: {
      offer_id: TEMP_CONSTRAINT_OFFER, city_id: CITY_LARNACA,
      pickup_enabled: true, return_enabled: false, is_active: true,
    },
  });
  assert.equal(oneDirectionAvailability.status, 201);
  const missingReturnMapped = await http(`car_offers?id=eq.${TEMP_CONSTRAINT_OFFER}`, TOKENS.service, {
    method: 'PATCH', prefer: 'return=representation', body: { availability_mode: 'mapped' },
  });
  assertDatabaseError(missingReturnMapped, 'mapped_car_offer_requires_active_pickup_and_return');
  assert.equal((await selectOne('car_offers', TEMP_CONSTRAINT_OFFER)).availability_mode, 'legacy');
  const returnOnlyAvailability = await http(
    `car_offer_city_availability?offer_id=eq.${TEMP_CONSTRAINT_OFFER}&city_id=eq.${CITY_LARNACA}`,
    TOKENS.service,
    { method: 'PATCH', prefer: 'return=representation', body: { pickup_enabled: false, return_enabled: true } },
  );
  assert.equal(returnOnlyAvailability.body.length, 1);
  const missingPickupMapped = await http(`car_offers?id=eq.${TEMP_CONSTRAINT_OFFER}`, TOKENS.service, {
    method: 'PATCH', prefer: 'return=representation', body: { availability_mode: 'mapped' },
  });
  assertDatabaseError(missingPickupMapped, 'mapped_car_offer_requires_active_pickup_and_return');
  assert.equal((await selectOne('car_offers', TEMP_CONSTRAINT_OFFER)).availability_mode, 'legacy');
  await http(`car_offers?id=eq.${TEMP_CONSTRAINT_OFFER}`, TOKENS.service, { method: 'DELETE', prefer: 'return=representation' });
  summary.constraints.push('mapped requires active pickup and return (none, pickup-only, return-only)');

  const mappedOfferInsert = await http('car_offers', TOKENS.service, {
    method: 'POST', prefer: 'return=representation', body: { ...createOfferBody, id: TEMP_MAPPED_OFFER, is_published: true },
  });
  assert.equal(mappedOfferInsert.status, 201);
  assert.equal((await http('car_offer_city_availability', TOKENS.service, {
    method: 'POST', prefer: 'return=representation',
    body: { offer_id: TEMP_MAPPED_OFFER, city_id: CITY_LARNACA, pickup_enabled: true, return_enabled: true, is_active: true },
  })).status, 201);
  assert.equal((await http(`car_offers?id=eq.${TEMP_MAPPED_OFFER}`, TOKENS.service, {
    method: 'PATCH', prefer: 'return=representation', body: { availability_mode: 'mapped' },
  })).body.length, 1);
  const anonMapped = await http(`car_offer_city_availability?offer_id=eq.${TEMP_MAPPED_OFFER}&select=*`, TOKENS.anon);
  assert.equal(anonMapped.body.length, 1);
  const authenticatedMapped = await http(`car_offer_city_availability?offer_id=eq.${TEMP_MAPPED_OFFER}&select=*`, TOKENS.nonAdmin);
  assert.equal(authenticatedMapped.body.length, 1);
  await http(`car_offers?id=eq.${TEMP_MAPPED_OFFER}`, TOKENS.service, { method: 'PATCH', prefer: 'return=representation', body: { is_available: false } });
  assert.equal((await http(`car_offer_city_availability?offer_id=eq.${TEMP_MAPPED_OFFER}&select=*`, TOKENS.anon)).body.length, 0);
  await http(`car_offers?id=eq.${TEMP_MAPPED_OFFER}`, TOKENS.service, { method: 'PATCH', prefer: 'return=representation', body: { is_available: true } });
  await http(`car_offers?id=eq.${TEMP_MAPPED_OFFER}`, TOKENS.service, { method: 'PATCH', prefer: 'return=representation', body: { is_published: false } });
  assert.equal((await http(`car_offer_city_availability?offer_id=eq.${TEMP_MAPPED_OFFER}&select=*`, TOKENS.anon)).body.length, 0);
  await http(`car_offers?id=eq.${TEMP_MAPPED_OFFER}`, TOKENS.service, { method: 'PATCH', prefer: 'return=representation', body: { is_published: true } });

  const profileDeactivate = await http(`car_pricing_profiles?id=eq.${PROFILE_LARNACA}`, TOKENS.service, {
    method: 'PATCH', prefer: 'return=representation', body: { is_active: false },
  });
  assertDatabaseError(profileDeactivate, 'active_mapped_offer_requires_active_pricing_profile');
  const cityDeactivate = await http(`car_rental_cities?id=eq.${CITY_LARNACA}`, TOKENS.service, {
    method: 'PATCH', prefer: 'return=representation', body: { is_active: false },
  });
  assertDatabaseError(cityDeactivate, 'car_city_used_by_active_mapped_offer');
  const mappingDeactivate = await http(
    `car_pricing_profile_cities?pricing_profile_id=eq.${PROFILE_LARNACA}&city_id=eq.${CITY_LARNACA}`,
    TOKENS.service,
    { method: 'PATCH', prefer: 'return=representation', body: { is_active: false } },
  );
  assertDatabaseError(mappingDeactivate, 'car_profile_city_change_breaks_mapped_offer');
  summary.constraints.push('mapped profile/city/mapping deactivation protection');
  await http(`car_offers?id=eq.${TEMP_MAPPED_OFFER}`, TOKENS.service, { method: 'DELETE', prefer: 'return=representation' });

  const { core, repositoryApi } = loadRepository();
  const repository = repositoryApi.create({ client: clients.admin, core });
  const context = await repository.getOfferContext(OFFER_LARNACA);
  const firstWrite = await repository.updateVehicleDetails({
    offerId: OFFER_LARNACA,
    expectedUpdatedAt: context.offer.updated_at,
    payload: { vehicle_kind_id: KIND_QUAD },
  });
  assert.equal(firstWrite.id, OFFER_LARNACA);
  await assert.rejects(
    repository.updateVehicleDetails({
      offerId: OFFER_LARNACA,
      expectedUpdatedAt: context.offer.updated_at,
      payload: { vehicle_kind_id: KIND_CAR },
    }),
    (error) => error?.code === 'car_multicity_stale_conflict',
  );
  const readBack = await repository.getOfferById(OFFER_LARNACA);
  assert.equal(readBack.vehicle_kind_id, KIND_QUAD);
  await repository.updateVehicleDetails({
    offerId: OFFER_LARNACA,
    expectedUpdatedAt: readBack.updated_at,
    payload: { vehicle_kind_id: KIND_CAR },
  });
  summary.concurrency.push('exact-ID expectedUpdatedAt update and stale zero-row conflict');
} finally {
  await resetFoundationRows();
}

const after = await protectedSnapshot();
assert.deepEqual(after, baseline);
const { data: allOffers, error: allOffersError } = await clients.service.from('car_offers').select('id').order('id');
assert.ifError(allOffersError);
assert.deepEqual(allOffers.map((row) => row.id), [OFFER_LARNACA, OFFER_PAPHOS]);
const { count: availabilityCount, error: availabilityError } = await clients.service
  .from('car_offer_city_availability')
  .select('*', { count: 'exact', head: true });
assert.ifError(availabilityError);
assert.equal(availabilityCount, 0);
summary.cleanup = {
  protectedFingerprintEquivalent: true,
  exactOfferIds: allOffers.map((row) => row.id),
  availabilityRows: availabilityCount,
  foundationSeedsPreserved: true,
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
