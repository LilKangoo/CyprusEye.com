import { supabase } from './supabaseClient.js';

const LOCATION_TYPE_LABELS = {
  city: 'City',
  airport: 'Airport',
  port: 'Port',
  station: 'Station',
  hotel: 'Hotel',
  landmark: 'Landmark',
  custom: 'Custom',
};

const state = {
  locations: [],
  routes: [],
  pricingRules: [],
  locationById: new Map(),
  routeById: new Map(),
  activeRoute: null,
  activeRule: null,
  activeReturnRoute: null,
  activeReturnRule: null,
  lastQuote: null,
  lastTripTypeSelection: 'one_way',
  loading: false,
};

const els = {};
const QUOTE_ROW_HIDE_ANIMATION_MS = 240;
const quoteRowHideTimers = new WeakMap();

function byId(id) {
  return document.getElementById(id);
}

function notify(message, type = 'info') {
  if (typeof window.showToast === 'function') {
    window.showToast(message, type);
    return;
  }
  if (type === 'error') {
    console.error(message);
    return;
  }
  console.log(message);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeTripType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'round_trip' ? 'round_trip' : 'one_way';
}

function isRoundTripSelected() {
  return normalizeTripType(els.tripTypeSelect?.value || 'one_way') === 'round_trip';
}

function toNonNegativeInt(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return Math.max(0, Math.trunc(fallback));
  return Math.max(0, Math.trunc(num));
}

function toNonNegativeNumber(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return Math.max(0, Number(fallback) || 0);
  return Math.max(0, num);
}

function round2(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100) / 100;
}

function money(value, currency = 'EUR') {
  const amount = round2(value);
  const code = String(currency || 'EUR').trim().toUpperCase() || 'EUR';
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: code }).format(amount);
  } catch (_error) {
    if (code === 'EUR') return `€${amount.toFixed(2)}`;
    return `${amount.toFixed(2)} ${code}`;
  }
}

function parseTimeToMinutes(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return (hh * 60) + mm;
}

function addDaysToIsoDate(isoDate, days) {
  const raw = String(isoDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '';
  const dt = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return '';
  dt.setDate(dt.getDate() + Number(days || 0));
  return dt.toISOString().slice(0, 10);
}

function dateLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  try {
    const dt = new Date(`${raw}T00:00:00`);
    if (Number.isNaN(dt.getTime())) return raw;
    return dt.toLocaleDateString('en-GB');
  } catch (_error) {
    return raw;
  }
}

function timeInNightWindow(timeMinutes, startMinutes, endMinutes) {
  if (!Number.isFinite(timeMinutes) || !Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
    return false;
  }
  if (startMinutes === endMinutes) return false;
  if (startMinutes < endMinutes) {
    return timeMinutes >= startMinutes && timeMinutes < endMinutes;
  }
  return timeMinutes >= startMinutes || timeMinutes < endMinutes;
}

function routeAllowsRoundTrip(route) {
  if (!route || typeof route !== 'object') return false;
  if (route.allows_round_trip === true) return true;
  if (route.allows_round_trip === false) return false;
  return normalizeTripType(route.trip_mode) === 'round_trip';
}

function routeRoundTripMultiplier(route) {
  const raw = toNonNegativeNumber(route?.round_trip_multiplier, 2);
  return raw >= 1 ? raw : 1;
}

function getLocationLabel(row) {
  if (!row || typeof row !== 'object') return 'Location';
  const name = String(row.name || '').trim();
  const local = String(row.name_local || '').trim();
  const code = String(row.code || '').trim();
  const type = LOCATION_TYPE_LABELS[String(row.location_type || '').trim().toLowerCase()] || 'Point';
  const base = name || local || code || 'Location';
  const localSuffix = local && local.toLowerCase() !== base.toLowerCase() ? ` / ${local}` : '';
  return `${base}${localSuffix} (${type})`;
}

function getLocationShortLabelById(locationId) {
  const id = String(locationId || '').trim();
  if (!id) return 'Location';
  const row = state.locationById.get(id);
  if (!row) return id.slice(0, 8);
  const name = String(row.name || '').trim();
  const local = String(row.name_local || '').trim();
  return name || local || String(row.code || '').trim() || id.slice(0, 8);
}

function getRouteLabel(route) {
  if (!route || typeof route !== 'object') return 'Route';
  const origin = getLocationShortLabelById(route.origin_location_id);
  const destination = getLocationShortLabelById(route.destination_location_id);
  return `${origin} → ${destination}`;
}

function normalizeLocationType(value) {
  return String(value || '').trim().toLowerCase();
}

function isAirportLocationById(locationId) {
  const id = String(locationId || '').trim();
  if (!id) return false;
  const row = state.locationById.get(id);
  return normalizeLocationType(row?.location_type) === 'airport';
}

function getLegLocationSelection(legKey = 'outbound') {
  const normalizedLeg = String(legKey || '').trim().toLowerCase() === 'return' ? 'return' : 'outbound';
  const originId = String(
    normalizedLeg === 'return'
      ? (els.returnOriginSelect?.value || '')
      : (els.originSelect?.value || ''),
  ).trim();
  const destinationId = String(
    normalizedLeg === 'return'
      ? (els.returnDestinationSelect?.value || '')
      : (els.destinationSelect?.value || ''),
  ).trim();
  const originAirport = isAirportLocationById(originId);
  const destinationAirport = isAirportLocationById(destinationId);

  return {
    legKey: normalizedLeg,
    originId,
    destinationId,
    originAirport,
    destinationAirport,
    airportSelected: originAirport || destinationAirport,
  };
}

function getLegContactRequirements(legKey = 'outbound') {
  const selection = getLegLocationSelection(legKey);

  if (!selection.airportSelected) {
    return {
      ...selection,
      pickupAddressRequired: true,
      dropoffAddressRequired: true,
      flightNumberRequired: false,
    };
  }

  return {
    ...selection,
    pickupAddressRequired: selection.destinationAirport,
    dropoffAddressRequired: selection.originAirport,
    flightNumberRequired: true,
  };
}

function getLegContactValues(legKey = 'outbound') {
  const normalizedLeg = String(legKey || '').trim().toLowerCase() === 'return' ? 'return' : 'outbound';
  if (normalizedLeg === 'return') {
    return {
      pickupAddress: String(els.returnPickupAddressInput?.value || '').trim(),
      dropoffAddress: String(els.returnDropoffAddressInput?.value || '').trim(),
      flightNumber: String(els.returnFlightNumberInput?.value || '').trim(),
    };
  }
  return {
    pickupAddress: String(els.pickupAddressInput?.value || '').trim(),
    dropoffAddress: String(els.dropoffAddressInput?.value || '').trim(),
    flightNumber: String(els.flightNumberInput?.value || '').trim(),
  };
}

function getLegContactGuidance(requirements, legLabel = 'Outbound') {
  const label = String(legLabel || '').trim() || 'Trip';
  if (!requirements || typeof requirements !== 'object') {
    return `${label}: add exact pickup/drop-off details to avoid delays.`;
  }

  if (!requirements.airportSelected) {
    return `${label}: no airport selected. Add both pickup and drop-off address. Flight number is optional.`;
  }

  if (requirements.originAirport && requirements.destinationAirport) {
    return `${label}: airport to airport. Flight number and both addresses are required.`;
  }

  if (requirements.originAirport) {
    return `${label}: pickup is airport. Flight number and drop-off address are required.`;
  }

  if (requirements.destinationAirport) {
    return `${label}: destination is airport. Flight number and pickup address are required.`;
  }

  return `${label}: add exact pickup/drop-off details to avoid delays.`;
}

function setFieldRequirement(fieldId, labelText, required) {
  const field = byId(fieldId);
  if (field && typeof field.required === 'boolean') {
    field.required = Boolean(required);
  }
  const label = document.querySelector(`label[for="${fieldId}"]`);
  if (label) {
    label.textContent = required ? `${labelText} *` : labelText;
  }
}

function syncTransportContactRequirements() {
  const outboundRequirements = getLegContactRequirements('outbound');
  setFieldRequirement('transportFlightNumber', 'Outbound flight number', outboundRequirements.flightNumberRequired);
  setFieldRequirement('transportPickupAddress', 'Outbound pickup address', outboundRequirements.pickupAddressRequired);
  setFieldRequirement('transportDropoffAddress', 'Outbound drop-off address', outboundRequirements.dropoffAddressRequired);
  if (els.outboundContactHint) {
    els.outboundContactHint.textContent = getLegContactGuidance(outboundRequirements, 'Outbound');
  }

  if (isRoundTripSelected()) {
    const returnRequirements = getLegContactRequirements('return');
    setFieldRequirement('transportReturnFlightNumber', 'Return flight number', returnRequirements.flightNumberRequired);
    setFieldRequirement('transportReturnPickupAddress', 'Return pickup address', returnRequirements.pickupAddressRequired);
    setFieldRequirement('transportReturnDropoffAddress', 'Return drop-off address', returnRequirements.dropoffAddressRequired);
    if (els.returnContactHint) {
      els.returnContactHint.textContent = getLegContactGuidance(returnRequirements, 'Return');
    }
    return;
  }

  setFieldRequirement('transportReturnFlightNumber', 'Return flight number', false);
  setFieldRequirement('transportReturnPickupAddress', 'Return pickup address', false);
  setFieldRequirement('transportReturnDropoffAddress', 'Return drop-off address', false);
  if (els.returnContactHint) {
    els.returnContactHint.textContent = 'Return details are shown only when trip type is set to Round trip.';
  }
}

function isMissingColumn(error, columnName) {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes(String(columnName || '').toLowerCase());
}

function extractMissingColumnName(error) {
  const candidates = [
    String(error?.message || ''),
    String(error?.details || ''),
    String(error?.hint || ''),
  ].filter(Boolean);

  const patterns = [
    /could not find the '([^']+)' column/i,
    /column ['"]([^'"]+)['"] does not exist/i,
    /column ([a-zA-Z0-9_]+) does not exist/i,
  ];

  for (const source of candidates) {
    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (!match || !match[1]) continue;
      const col = String(match[1] || '').trim();
      if (col) return col;
    }
  }

  return '';
}

const ROUND_TRIP_CRITICAL_BOOKING_COLUMNS = new Set([
  'trip_type',
  'return_route_id',
  'return_origin_location_id',
  'return_destination_location_id',
  'return_travel_date',
  'return_travel_time',
  'return_pickup_address',
  'return_dropoff_address',
  'return_flight_number',
]);

async function loadRoutesSafe() {
  let result = await supabase
    .from('transport_routes')
    .select('id, origin_location_id, destination_location_id, day_price, night_price, currency, included_passengers, included_bags, included_large_bags, max_passengers, max_bags, allows_round_trip, round_trip_multiplier, is_active, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(2000);

  if (result.error && isMissingColumn(result.error, 'included_large_bags')) {
    result = await supabase
      .from('transport_routes')
      .select('id, origin_location_id, destination_location_id, day_price, night_price, currency, included_passengers, included_bags, max_passengers, max_bags, allows_round_trip, round_trip_multiplier, is_active, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(2000);
  }

  if (result.error && (isMissingColumn(result.error, 'allows_round_trip') || isMissingColumn(result.error, 'round_trip_multiplier'))) {
    result = await supabase
      .from('transport_routes')
      .select('id, origin_location_id, destination_location_id, day_price, night_price, currency, included_passengers, included_bags, included_large_bags, max_passengers, max_bags, is_active, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(2000);
  }

  if (result.error && isMissingColumn(result.error, 'included_large_bags')) {
    result = await supabase
      .from('transport_routes')
      .select('id, origin_location_id, destination_location_id, day_price, night_price, currency, included_passengers, included_bags, max_passengers, max_bags, is_active, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(2000);
  }

  return result;
}

async function loadPricingSafe() {
  let result = await supabase
    .from('transport_pricing_rules')
    .select('id, route_id, extra_passenger_fee, extra_bag_fee, oversize_bag_fee, child_seat_fee, booster_seat_fee, waiting_included_minutes, waiting_fee_per_hour, waiting_fee_per_minute, night_start, night_end, valid_from, valid_to, priority, is_active, deposit_enabled, deposit_mode, deposit_value, deposit_base_floor, updated_at, created_at')
    .eq('is_active', true)
    .order('priority', { ascending: true })
    .order('updated_at', { ascending: false })
    .limit(4000);

  if (
    result.error
    && (
      isMissingColumn(result.error, 'waiting_fee_per_hour')
      || isMissingColumn(result.error, 'deposit_enabled')
      || isMissingColumn(result.error, 'deposit_mode')
      || isMissingColumn(result.error, 'deposit_value')
      || isMissingColumn(result.error, 'deposit_base_floor')
    )
  ) {
    result = await supabase
      .from('transport_pricing_rules')
      .select('id, route_id, extra_passenger_fee, extra_bag_fee, oversize_bag_fee, child_seat_fee, booster_seat_fee, waiting_included_minutes, waiting_fee_per_minute, night_start, night_end, valid_from, valid_to, priority, is_active, updated_at, created_at')
      .eq('is_active', true)
      .order('priority', { ascending: true })
      .order('updated_at', { ascending: false })
      .limit(4000);
  }

  return result;
}

async function loadTransportCatalog() {
  state.loading = true;
  setStatus('Loading active transport routes and pricing rules...', 'info');

  const locationsPromise = supabase
    .from('transport_locations')
    .select('id, name, name_local, code, location_type, sort_order, is_active')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
    .limit(2000);

  const [locationsRes, routesRes, pricingRes] = await Promise.all([
    locationsPromise,
    loadRoutesSafe(),
    loadPricingSafe(),
  ]);

  if (locationsRes.error) throw locationsRes.error;
  if (routesRes.error) throw routesRes.error;
  if (pricingRes.error) throw pricingRes.error;

  state.locations = Array.isArray(locationsRes.data) ? locationsRes.data : [];
  state.routes = Array.isArray(routesRes.data) ? routesRes.data : [];
  state.pricingRules = Array.isArray(pricingRes.data) ? pricingRes.data : [];

  state.locationById = new Map();
  state.routeById = new Map();
  state.locations.forEach((row) => {
    const id = String(row?.id || '').trim();
    if (!id) return;
    state.locationById.set(id, row);
  });
  state.routes.forEach((row) => {
    const id = String(row?.id || '').trim();
    if (!id) return;
    state.routeById.set(id, row);
  });

  populateLocationSelects();
  state.loading = false;

  if (!state.locations.length || !state.routes.length) {
    setStatus('No active transport routes are available yet. Please try again later.', 'error');
    updateSubmitState();
    return;
  }

  setStatus('Select route details to calculate your quote.', 'info');
}

function populateLocationSelects() {
  if (!(els.originSelect instanceof HTMLSelectElement) || !(els.destinationSelect instanceof HTMLSelectElement)) return;

  const previousOrigin = String(els.originSelect.value || '').trim();
  const previousDestination = String(els.destinationSelect.value || '').trim();
  const previousReturnOrigin = String(els.returnOriginSelect?.value || '').trim();
  const previousReturnDestination = String(els.returnDestinationSelect?.value || '').trim();
  const options = state.locations.map((location) => {
    const id = String(location?.id || '').trim();
    if (!id) return '';
    return `<option value="${escapeHtml(id)}">${escapeHtml(getLocationLabel(location))}</option>`;
  }).join('');

  els.originSelect.innerHTML = `<option value="">Select pickup</option>${options}`;
  els.destinationSelect.innerHTML = `<option value="">Select destination</option>${options}`;
  if (els.returnOriginSelect instanceof HTMLSelectElement) {
    els.returnOriginSelect.innerHTML = `<option value="">Select return pickup</option>${options}`;
  }
  if (els.returnDestinationSelect instanceof HTMLSelectElement) {
    els.returnDestinationSelect.innerHTML = `<option value="">Select return destination</option>${options}`;
  }

  const ids = new Set(state.locations.map((row) => String(row?.id || '').trim()).filter(Boolean));
  if (previousOrigin && ids.has(previousOrigin)) {
    els.originSelect.value = previousOrigin;
  }
  if (previousDestination && ids.has(previousDestination)) {
    els.destinationSelect.value = previousDestination;
  }
  if (els.returnOriginSelect instanceof HTMLSelectElement && previousReturnOrigin && ids.has(previousReturnOrigin)) {
    els.returnOriginSelect.value = previousReturnOrigin;
  }
  if (els.returnDestinationSelect instanceof HTMLSelectElement && previousReturnDestination && ids.has(previousReturnDestination)) {
    els.returnDestinationSelect.value = previousReturnDestination;
  }

  if (!els.originSelect.value && state.locations.length) {
    els.originSelect.value = String(state.locations[0].id || '');
  }
  if (!els.destinationSelect.value && state.locations.length > 1) {
    els.destinationSelect.value = String(state.locations[1].id || '');
  }
  if (!els.destinationSelect.value && state.locations.length) {
    els.destinationSelect.value = String(state.locations[0].id || '');
  }

  syncReturnDateConstraints();
}

function syncReturnDateConstraints() {
  if (!(els.returnDateInput instanceof HTMLInputElement)) return;

  const outboundDate = String(els.travelDateInput?.value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(outboundDate)) {
    els.returnDateInput.min = outboundDate;
    if (els.returnDateInput.value && els.returnDateInput.value < outboundDate) {
      els.returnDateInput.value = outboundDate;
    }
    return;
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  els.returnDateInput.min = todayIso;
}

function autoPopulateReturnLeg(options = {}) {
  if (!isRoundTripSelected()) return;
  const force = Boolean(options?.force);
  const outboundOrigin = String(els.originSelect?.value || '').trim();
  const outboundDestination = String(els.destinationSelect?.value || '').trim();
  const outboundDate = String(els.travelDateInput?.value || '').trim();
  const outboundTime = String(els.travelTimeInput?.value || '').trim().slice(0, 5);

  if (els.returnOriginSelect instanceof HTMLSelectElement) {
    const shouldSetOrigin = force || !String(els.returnOriginSelect.value || '').trim();
    if (shouldSetOrigin && outboundDestination) {
      els.returnOriginSelect.value = outboundDestination;
    }
  }

  if (els.returnDestinationSelect instanceof HTMLSelectElement) {
    const shouldSetDestination = force || !String(els.returnDestinationSelect.value || '').trim();
    if (shouldSetDestination && outboundOrigin) {
      els.returnDestinationSelect.value = outboundOrigin;
    }
  }

  if (els.returnDateInput instanceof HTMLInputElement) {
    const shouldSetDate = force || !String(els.returnDateInput.value || '').trim();
    if (shouldSetDate) {
      const suggestedReturnDate = addDaysToIsoDate(outboundDate, 2) || outboundDate;
      if (suggestedReturnDate) {
        els.returnDateInput.value = suggestedReturnDate;
      }
    }
  }

  if (els.returnTimeInput instanceof HTMLInputElement) {
    const shouldSetTime = force || !String(els.returnTimeInput.value || '').trim();
    if (shouldSetTime) {
      els.returnTimeInput.value = outboundTime || '12:00';
    }
  }

  syncReturnDateConstraints();
}

function syncReturnContactFromOutbound(options = {}) {
  if (!isRoundTripSelected()) return;
  const force = Boolean(options?.force);
  const outboundPickup = String(els.pickupAddressInput?.value || '').trim();
  const outboundDropoff = String(els.dropoffAddressInput?.value || '').trim();
  const returnPickupCurrent = String(els.returnPickupAddressInput?.value || '').trim();
  const returnDropoffCurrent = String(els.returnDropoffAddressInput?.value || '').trim();

  if (els.returnPickupAddressInput instanceof HTMLInputElement) {
    const shouldSetReturnPickup = force || !returnPickupCurrent;
    if (shouldSetReturnPickup && outboundDropoff) {
      els.returnPickupAddressInput.value = outboundDropoff;
    }
  }

  if (els.returnDropoffAddressInput instanceof HTMLInputElement) {
    const shouldSetReturnDropoff = force || !returnDropoffCurrent;
    if (shouldSetReturnDropoff && outboundPickup) {
      els.returnDropoffAddressInput.value = outboundPickup;
    }
  }
}

function syncReturnLegVisibility(options = {}) {
  const roundTrip = isRoundTripSelected();
  if (els.returnLegSection) {
    els.returnLegSection.hidden = !roundTrip;
  }
  if (els.returnContactSection) {
    els.returnContactSection.hidden = !roundTrip;
  }

  if (roundTrip) {
    const switchedFromOneWay = state.lastTripTypeSelection !== 'round_trip';
    autoPopulateReturnLeg({ force: Boolean(options?.force || switchedFromOneWay) });
    syncReturnContactFromOutbound({ force: Boolean(options?.force || switchedFromOneWay) });
  }

  state.lastTripTypeSelection = roundTrip ? 'round_trip' : 'one_way';
}

function setDefaultTravelDateTime() {
  if (!(els.travelDateInput instanceof HTMLInputElement) || !(els.travelTimeInput instanceof HTMLInputElement)) return;

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  els.travelDateInput.min = todayIso;

  if (!els.travelDateInput.value) {
    const nextDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    els.travelDateInput.value = nextDay.toISOString().slice(0, 10);
  }

  if (!els.travelTimeInput.value) {
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = now.getMinutes() >= 30 ? '30' : '00';
    els.travelTimeInput.value = `${hh}:${mm}`;
  }

  if (els.returnDateInput instanceof HTMLInputElement && !els.returnDateInput.value) {
    const suggestedReturnDate = addDaysToIsoDate(els.travelDateInput.value, 2) || els.travelDateInput.value;
    if (suggestedReturnDate) {
      els.returnDateInput.value = suggestedReturnDate;
    }
  }

  if (els.returnTimeInput instanceof HTMLInputElement && !els.returnTimeInput.value) {
    els.returnTimeInput.value = els.travelTimeInput.value || '12:00';
  }

  syncReturnDateConstraints();
}

async function prefillCustomerFromSession() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user || null;
    if (!user) return;

    if (els.customerEmailInput && !els.customerEmailInput.value && user.email) {
      els.customerEmailInput.value = String(user.email);
    }

    const metadata = user.user_metadata || {};
    const metaName = String(metadata.full_name || metadata.name || '').trim();
    if (els.customerNameInput && !els.customerNameInput.value && metaName) {
      els.customerNameInput.value = metaName;
    }

    const userId = String(user.id || '').trim();
    if (!userId) return;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('name, phone')
      .eq('id', userId)
      .maybeSingle();

    if (error || !profile) return;

    const profileName = String(profile.name || '').trim();
    if (els.customerNameInput && !els.customerNameInput.value && profileName) {
      els.customerNameInput.value = profileName;
    }

    const profilePhone = String(profile.phone || '').trim();
    if (els.customerPhoneInput && !els.customerPhoneInput.value && profilePhone) {
      els.customerPhoneInput.value = profilePhone;
    }
  } catch (_error) {
  }
}

function findRouteByLocations(originIdRaw, destinationIdRaw) {
  const originId = String(originIdRaw || '').trim();
  const destinationId = String(destinationIdRaw || '').trim();
  if (!originId || !destinationId) return null;
  return state.routes.find((route) => (
    String(route?.origin_location_id || '').trim() === originId
    && String(route?.destination_location_id || '').trim() === destinationId
    && route?.is_active !== false
  )) || null;
}

function getSelectedRoute() {
  const originId = String(els.originSelect?.value || '').trim();
  const destinationId = String(els.destinationSelect?.value || '').trim();
  return findRouteByLocations(originId, destinationId);
}

function isRuleValidForDate(rule, dateIso) {
  const date = String(dateIso || '').trim();
  if (!date) return true;
  const from = String(rule?.valid_from || '').trim();
  const to = String(rule?.valid_to || '').trim();
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function getBestPricingRuleForRoute(routeId, travelDateIso) {
  const id = String(routeId || '').trim();
  if (!id) return null;

  const active = state.pricingRules
    .filter((rule) => String(rule?.route_id || '').trim() === id && rule?.is_active !== false)
    .slice()
    .sort((a, b) => {
      const priorityDiff = Number(a?.priority || 0) - Number(b?.priority || 0);
      if (priorityDiff !== 0) return priorityDiff;
      const aTs = new Date(a?.updated_at || a?.created_at || 0).getTime() || 0;
      const bTs = new Date(b?.updated_at || b?.created_at || 0).getTime() || 0;
      return bTs - aTs;
    });

  if (!active.length) return null;

  const dateScoped = active.filter((rule) => isRuleValidForDate(rule, travelDateIso));
  return dateScoped.length ? dateScoped[0] : active[0];
}

function getScenario(route, overrides = {}) {
  const passengersDefault = Math.max(1, toNonNegativeInt(route?.included_passengers, 2));
  const backpacksDefault = toNonNegativeInt(route?.included_bags, 2);
  const largeBagsDefault = toNonNegativeInt(route?.included_large_bags, 0);
  const scenarioTripType = normalizeTripType(overrides.tripType ?? els.tripTypeSelect?.value ?? 'one_way');
  const scenarioTravelTime = String(overrides.travelTime ?? els.travelTimeInput?.value ?? '12:00').trim().slice(0, 5);

  return {
    rateMode: 'auto',
    tripType: scenarioTripType,
    travelTime: scenarioTravelTime,
    passengers: Math.max(1, toNonNegativeInt(overrides.passengers ?? els.passengersInput?.value, passengersDefault)),
    bags: toNonNegativeInt(overrides.bags ?? els.bagsInput?.value, backpacksDefault),
    oversizeBags: toNonNegativeInt(overrides.oversizeBags ?? els.oversizeBagsInput?.value, largeBagsDefault),
    childSeats: toNonNegativeInt(overrides.childSeats ?? els.childSeatsInput?.value, 0),
    boosterSeats: toNonNegativeInt(overrides.boosterSeats ?? els.boosterSeatsInput?.value, 0),
    waitingMinutes: toNonNegativeInt(overrides.waitingMinutes ?? els.waitingMinutesInput?.value, 0),
  };
}

function calculateQuote(route, rule, scenario) {
  const pricingRule = rule || {};

  const currency = String(route?.currency || 'EUR').trim().toUpperCase() || 'EUR';
  const baseDay = toNonNegativeNumber(route?.day_price, 0);
  const baseNight = toNonNegativeNumber(route?.night_price, 0);
  const includedPassengers = Math.max(1, toNonNegativeInt(route?.included_passengers, 1));
  const includedBackpacks = toNonNegativeInt(route?.included_bags, 2);
  const includedLargeBags = toNonNegativeInt(route?.included_large_bags, 0);
  const maxPassengers = Math.max(1, toNonNegativeInt(route?.max_passengers, includedPassengers));
  const includedTotalLuggage = includedBackpacks + includedLargeBags;
  const maxBags = Math.max(includedTotalLuggage, toNonNegativeInt(route?.max_bags, includedTotalLuggage));

  const nightStartRaw = String(pricingRule?.night_start || '22:00').trim().slice(0, 5) || '22:00';
  const nightEndRaw = String(pricingRule?.night_end || '06:00').trim().slice(0, 5) || '06:00';
  const nightStart = parseTimeToMinutes(nightStartRaw);
  const nightEnd = parseTimeToMinutes(nightEndRaw);
  const travelTimeMinutes = parseTimeToMinutes(scenario.travelTime);
  const basePeriod = timeInNightWindow(travelTimeMinutes, nightStart, nightEnd) ? 'night' : 'day';

  const baseFare = basePeriod === 'night' ? baseNight : baseDay;
  const extraPassengerFee = toNonNegativeNumber(pricingRule?.extra_passenger_fee, 0);
  const extraBagFee = toNonNegativeNumber(pricingRule?.extra_bag_fee, 0);
  const oversizeBagFee = toNonNegativeNumber(pricingRule?.oversize_bag_fee, 0);
  const childSeatFee = toNonNegativeNumber(pricingRule?.child_seat_fee, 0);
  const boosterSeatFee = toNonNegativeNumber(pricingRule?.booster_seat_fee, 0);
  const waitingIncluded = toNonNegativeInt(pricingRule?.waiting_included_minutes, 0);

  let waitingFeePerHour = toNonNegativeNumber(pricingRule?.waiting_fee_per_hour, 0);
  if (!(waitingFeePerHour > 0)) {
    waitingFeePerHour = round2(toNonNegativeNumber(pricingRule?.waiting_fee_per_minute, 0) * 60);
  }

  const extraPassengerCount = Math.max(0, scenario.passengers - includedPassengers);
  const extraBagCount = Math.max(0, scenario.bags - includedBackpacks);
  const extraLargeBagCount = Math.max(0, scenario.oversizeBags - includedLargeBags);
  const totalLuggageCount = toNonNegativeInt(scenario.bags, 0) + toNonNegativeInt(scenario.oversizeBags, 0);
  const waitingChargedMinutes = Math.max(0, scenario.waitingMinutes - waitingIncluded);
  const waitingChargedHours = waitingChargedMinutes > 0 ? Math.ceil(waitingChargedMinutes / 60) : 0;

  const extraPassengersCost = round2(extraPassengerCount * extraPassengerFee);
  const extraBagsCost = round2(extraBagCount * extraBagFee);
  const oversizeCost = round2(extraLargeBagCount * oversizeBagFee);
  const seatsCost = round2((scenario.childSeats * childSeatFee) + (scenario.boosterSeats * boosterSeatFee));
  const waitingCost = round2(waitingChargedHours * waitingFeePerHour);
  const extrasTotal = round2(extraPassengersCost + extraBagsCost + oversizeCost + seatsCost + waitingCost);
  const oneWayTotal = round2(baseFare + extrasTotal);

  const warnings = [];
  if (scenario.passengers > maxPassengers) {
    warnings.push(`Passengers exceed route limit (${maxPassengers}).`);
  }
  if (totalLuggageCount > maxBags) {
    warnings.push(`Total luggage exceeds route limit (${maxBags}).`);
  }

  let tripType = normalizeTripType(scenario.tripType || 'one_way');
  const allowsRoundTrip = routeAllowsRoundTrip(route);
  const roundTripMultiplier = routeRoundTripMultiplier(route);
  if (tripType === 'round_trip' && !allowsRoundTrip) {
    tripType = 'one_way';
    warnings.push('Round trip is not enabled for this route.');
  }

  const tripMultiplier = tripType === 'round_trip' ? roundTripMultiplier : 1;
  const total = round2(oneWayTotal * tripMultiplier);

  const depositEnabled = Boolean(pricingRule?.deposit_enabled);
  const depositModeRaw = String(pricingRule?.deposit_mode || 'percent_total').trim().toLowerCase();
  const depositMode = ['fixed_amount', 'percent_total', 'per_person'].includes(depositModeRaw)
    ? depositModeRaw
    : 'percent_total';
  const depositValue = toNonNegativeNumber(pricingRule?.deposit_value, 0);
  const depositBaseFloor = toNonNegativeNumber(pricingRule?.deposit_base_floor, 0);

  let depositDynamicAmount = 0;
  if (depositEnabled) {
    if (depositMode === 'fixed_amount') depositDynamicAmount = depositValue;
    if (depositMode === 'percent_total') depositDynamicAmount = (total * depositValue) / 100;
    if (depositMode === 'per_person') depositDynamicAmount = scenario.passengers * depositValue;
  }
  depositDynamicAmount = round2(Math.min(Math.max(depositDynamicAmount, 0), total));
  const depositAmount = round2(Math.min(Math.max(Math.max(depositBaseFloor, depositDynamicAmount), 0), total));
  const depositAppliedMode = depositAmount === depositBaseFloor && depositBaseFloor > depositDynamicAmount
    ? 'base_floor'
    : (depositEnabled ? depositMode : (depositBaseFloor > 0 ? 'base_floor' : 'none'));
  const hasDeposit = depositAmount > 0;

  return {
    currency,
    basePeriod,
    baseFare,
    tripType,
    tripMultiplier,
    allowsRoundTrip,
    roundTripMultiplier,
    includedPassengers,
    includedBags: includedBackpacks,
    includedLargeBags,
    maxPassengers,
    maxBags,
    totalLuggageCount,
    nightStartRaw,
    nightEndRaw,
    waitingIncluded,
    waitingFeePerHour,
    extraPassengersCost,
    extraBagsCost,
    extraLargeBagCount,
    oversizeCost,
    seatsCost,
    waitingCost,
    extrasTotal,
    oneWayTotal,
    depositEnabled: hasDeposit,
    depositMode,
    depositValue,
    depositBaseFloor,
    depositDynamicAmount,
    depositAppliedMode,
    depositAmount,
    total,
    warnings,
    scenario,
  };
}

function setStatus(message, type = 'info') {
  if (!els.quoteStatus) return;
  const isError = type === 'error';
  if (!isError) {
    els.quoteStatus.hidden = true;
    els.quoteStatus.textContent = '';
    els.quoteStatus.classList.remove('is-error');
    return;
  }

  const text = String(message || 'Please check booking details.').trim();
  els.quoteStatus.hidden = false;
  els.quoteStatus.textContent = text;
  els.quoteStatus.classList.add('is-error');
}

function clearQuoteRowHideTimer(rowEl) {
  if (!rowEl) return;
  const timerId = quoteRowHideTimers.get(rowEl);
  if (timerId) {
    window.clearTimeout(timerId);
    quoteRowHideTimers.delete(rowEl);
  }
}

function setQuoteBreakdownRow(rowEl, valueEl, options = {}) {
  const visible = Boolean(options?.visible);
  const text = String(options?.text ?? '—');
  if (valueEl) {
    valueEl.textContent = visible ? text : '—';
  }
  if (!rowEl) return;

  clearQuoteRowHideTimer(rowEl);

  if (visible) {
    rowEl.hidden = false;
    rowEl.setAttribute('aria-hidden', 'false');
    window.requestAnimationFrame(() => {
      rowEl.classList.add('is-visible');
    });
    return;
  }

  rowEl.setAttribute('aria-hidden', 'true');
  rowEl.classList.remove('is-visible');
  const timerId = window.setTimeout(() => {
    if (!rowEl.classList.contains('is-visible')) {
      rowEl.hidden = true;
    }
    quoteRowHideTimers.delete(rowEl);
  }, QUOTE_ROW_HIDE_ANIMATION_MS);
  quoteRowHideTimers.set(rowEl, timerId);
}

function setDepositNotice(visible, amountText = '—', remainingText = '—') {
  if (els.quoteDeposit) {
    els.quoteDeposit.textContent = visible ? String(amountText || '—') : '—';
  }
  if (els.quoteRemainingDue) {
    els.quoteRemainingDue.textContent = visible ? String(remainingText || '—') : '—';
  }
  if (!els.quoteDepositNotice) return;
  els.quoteDepositNotice.hidden = !visible;
}

function resetQuoteBreakdownRows() {
  setQuoteBreakdownRow(els.quoteRowOutbound, els.quoteOutbound, { visible: false });
  setQuoteBreakdownRow(els.quoteRowReturn, els.quoteReturn, { visible: false });
  setQuoteBreakdownRow(els.quoteRowBase, els.quoteBase, { visible: false });
  setQuoteBreakdownRow(els.quoteRowPassengers, els.quotePassengers, { visible: false });
  setQuoteBreakdownRow(els.quoteRowBags, els.quoteBags, { visible: false });
  setQuoteBreakdownRow(els.quoteRowOversize, els.quoteOversize, { visible: false });
  setQuoteBreakdownRow(els.quoteRowSeats, els.quoteSeats, { visible: false });
  setQuoteBreakdownRow(els.quoteRowWaiting, els.quoteWaiting, { visible: false });
  setDepositNotice(false, '—');
}

function clearQuoteView() {
  resetQuoteBreakdownRows();
  if (els.quoteTotal) {
    els.quoteTotal.textContent = '—';
  }
  if (els.routeMeta) {
    els.routeMeta.hidden = true;
    els.routeMeta.textContent = '';
  }
  if (els.quoteWarnings) {
    els.quoteWarnings.innerHTML = '';
  }
  renderInlineQuote(null);
  renderMiniSummary(null);
}

function buildQuoteSummary(legs, options = {}) {
  const list = Array.isArray(legs) ? legs.filter(Boolean) : [];
  if (!list.length) return null;

  const currencies = Array.from(new Set(
    list.map((leg) => String(leg?.quote?.currency || '').trim().toUpperCase()).filter(Boolean),
  ));
  const currency = currencies[0] || 'EUR';
  const mixedCurrencies = currencies.length > 1;

  const summary = {
    legs: list,
    currency,
    mixedCurrencies,
    outboundTotal: 0,
    returnTotal: 0,
    baseFare: 0,
    extraPassengersCost: 0,
    extraBagsCost: 0,
    oversizeCost: 0,
    seatsCost: 0,
    waitingCost: 0,
    total: 0,
    depositAmount: 0,
    depositEnabled: false,
    warnings: [],
    hasBlockingCapacity: false,
    isBookable: options.isBookable !== false,
  };

  list.forEach((leg, index) => {
    const quote = leg?.quote || {};
    const legTotal = round2(toNonNegativeNumber(quote.total, 0));
    if (index === 0) summary.outboundTotal = legTotal;
    if (index === 1) summary.returnTotal = legTotal;

    summary.baseFare = round2(summary.baseFare + toNonNegativeNumber(quote.baseFare, 0));
    summary.extraPassengersCost = round2(summary.extraPassengersCost + toNonNegativeNumber(quote.extraPassengersCost, 0));
    summary.extraBagsCost = round2(summary.extraBagsCost + toNonNegativeNumber(quote.extraBagsCost, 0));
    summary.oversizeCost = round2(summary.oversizeCost + toNonNegativeNumber(quote.oversizeCost, 0));
    summary.seatsCost = round2(summary.seatsCost + toNonNegativeNumber(quote.seatsCost, 0));
    summary.waitingCost = round2(summary.waitingCost + toNonNegativeNumber(quote.waitingCost, 0));
    summary.total = round2(summary.total + legTotal);
    summary.depositAmount = round2(summary.depositAmount + toNonNegativeNumber(quote.depositAmount, 0));
    summary.depositEnabled = summary.depositEnabled || Boolean(quote.depositEnabled);

    if (scenarioExceedsCapacity(quote)) {
      summary.hasBlockingCapacity = true;
    }

    const legWarnings = Array.isArray(quote?.warnings) ? quote.warnings : [];
    legWarnings.forEach((warning) => {
      summary.warnings.push(`${leg.label}: ${warning}`);
    });
  });

  if (mixedCurrencies) {
    summary.isBookable = false;
    summary.warnings.push('Selected legs use different currencies. Choose routes with the same currency.');
  }

  return summary;
}

function renderQuote(summary) {
  if (!summary || !Array.isArray(summary.legs) || !summary.legs.length) {
    clearQuoteView();
    return;
  }

  const hasReturnLeg = summary.legs.length > 1;
  setQuoteBreakdownRow(els.quoteRowOutbound, els.quoteOutbound, {
    visible: hasReturnLeg,
    text: money(summary.outboundTotal, summary.currency),
  });
  setQuoteBreakdownRow(els.quoteRowReturn, els.quoteReturn, {
    visible: hasReturnLeg,
    text: money(summary.returnTotal, summary.currency),
  });
  setQuoteBreakdownRow(els.quoteRowBase, els.quoteBase, {
    visible: true,
    text: money(summary.baseFare, summary.currency),
  });
  setQuoteBreakdownRow(els.quoteRowPassengers, els.quotePassengers, {
    visible: round2(summary.extraPassengersCost) > 0,
    text: money(summary.extraPassengersCost, summary.currency),
  });
  setQuoteBreakdownRow(els.quoteRowBags, els.quoteBags, {
    visible: round2(summary.extraBagsCost) > 0,
    text: money(summary.extraBagsCost, summary.currency),
  });
  setQuoteBreakdownRow(els.quoteRowOversize, els.quoteOversize, {
    visible: round2(summary.oversizeCost) > 0,
    text: money(summary.oversizeCost, summary.currency),
  });
  setQuoteBreakdownRow(els.quoteRowSeats, els.quoteSeats, {
    visible: round2(summary.seatsCost) > 0,
    text: money(summary.seatsCost, summary.currency),
  });
  setQuoteBreakdownRow(els.quoteRowWaiting, els.quoteWaiting, {
    visible: round2(summary.waitingCost) > 0,
    text: money(summary.waitingCost, summary.currency),
  });
  const showDepositNotice = summary.depositEnabled && round2(summary.depositAmount) > 0;
  const remainingDue = round2(Math.max(0, toNonNegativeNumber(summary.total, 0) - toNonNegativeNumber(summary.depositAmount, 0)));
  setDepositNotice(
    showDepositNotice,
    money(summary.depositAmount, summary.currency),
    money(remainingDue, summary.currency),
  );
  if (els.quoteTotal) els.quoteTotal.textContent = money(summary.total, summary.currency);

  if (els.routeMeta) {
    els.routeMeta.hidden = true;
    els.routeMeta.textContent = '';
  }

  if (els.quoteWarnings) {
    const warnings = Array.isArray(summary.warnings) ? summary.warnings : [];
    els.quoteWarnings.innerHTML = warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('');
  }

  renderInlineQuote(summary);
  renderMiniSummary(summary);
}

function scenarioExceedsCapacity(quote) {
  if (!quote || !quote.scenario) return true;
  const totalLuggage = toNonNegativeInt(quote?.scenario?.bags, 0) + toNonNegativeInt(quote?.scenario?.oversizeBags, 0);
  return quote.scenario.passengers > quote.maxPassengers || totalLuggage > quote.maxBags;
}

function hasBlockingCapacityWarning(summary) {
  if (!summary) return true;
  return Boolean(summary.hasBlockingCapacity);
}

function renderMiniSummary(summary) {
  if (!els.miniSummary) return;
  if (!summary || !Array.isArray(summary.legs) || !summary.legs.length) {
    els.miniSummary.hidden = true;
    return;
  }

  els.miniSummary.hidden = false;

  if (els.miniTotal) {
    els.miniTotal.textContent = money(summary.total, summary.currency);
  }
}

function renderInlineQuote(summary) {
  if (!els.inlineQuote || !els.inlineQuoteTotal) return;
  if (!summary || !Array.isArray(summary.legs) || !summary.legs.length) {
    els.inlineQuote.hidden = true;
    return;
  }

  els.inlineQuote.hidden = false;
  els.inlineQuoteTotal.textContent = money(summary.total, summary.currency);

  const showDeposit = Boolean(summary.depositEnabled) && round2(summary.depositAmount) > 0;
  if (els.inlineQuoteDepositWrap) {
    els.inlineQuoteDepositWrap.hidden = !showDeposit;
  }
  if (els.inlineQuoteDeposit) {
    els.inlineQuoteDeposit.textContent = showDeposit ? money(summary.depositAmount, summary.currency) : '—';
  }
}

function updateSubmitState() {
  if (!(els.submitButton instanceof HTMLButtonElement)) return;

  const hasRoute = Boolean(state.activeRoute) && (!isRoundTripSelected() || Boolean(state.activeReturnRoute));
  const hasQuote = Boolean(state.lastQuote && state.lastQuote.isBookable);
  const hasPolicy = Boolean(els.policyCheckbox?.checked);
  const hasQuoteReview = Boolean(els.quoteReviewCheckbox?.checked);
  const hasBlockingWarning = hasBlockingCapacityWarning(state.lastQuote);

  els.submitButton.disabled = !(hasRoute && hasQuote && hasPolicy && hasQuoteReview && !hasBlockingWarning);

  if (els.submitHint) {
    if (!hasRoute) {
      els.submitHint.textContent = 'Select route and schedule first.';
    } else if (!hasQuote) {
      els.submitHint.textContent = 'Complete all required route fields to calculate final quote.';
    } else if (hasBlockingWarning) {
      els.submitHint.textContent = 'Adjust passengers/luggage: current selection exceeds route limits.';
    } else if (!hasQuoteReview) {
      els.submitHint.textContent = 'Review full quote and confirm it below to unlock booking.';
    } else if (!hasPolicy) {
      els.submitHint.textContent = 'Accept contact consent checkbox to continue.';
    } else {
      els.submitHint.textContent = 'All set. You can submit booking now.';
    }
  }

  if (els.miniState) {
    els.miniState.classList.remove('is-ok', 'is-warn');
    if (!hasRoute) {
      els.miniState.textContent = 'Select route and schedule first.';
    } else if (!hasQuote) {
      els.miniState.textContent = 'Complete route details for final quote.';
      els.miniState.classList.add('is-warn');
    } else if (hasBlockingWarning) {
      els.miniState.textContent = 'Route limit exceeded. Update passengers/luggage.';
      els.miniState.classList.add('is-warn');
    } else if (!hasQuoteReview) {
      els.miniState.textContent = 'Open full quote and confirm calculation.';
    } else if (!hasPolicy) {
      els.miniState.textContent = 'Confirm contact consent to continue.';
    } else {
      els.miniState.textContent = 'Ready to book.';
      els.miniState.classList.add('is-ok');
    }
  }
}

function resetQuoteReviewConfirmation() {
  if (els.quoteReviewCheckbox instanceof HTMLInputElement) {
    els.quoteReviewCheckbox.checked = false;
  }
}

function refreshQuote() {
  syncTransportContactRequirements();

  if (state.loading) {
    updateSubmitState();
    return null;
  }

  const originId = String(els.originSelect?.value || '').trim();
  const destinationId = String(els.destinationSelect?.value || '').trim();

  state.activeRoute = null;
  state.activeRule = null;
  state.activeReturnRoute = null;
  state.activeReturnRule = null;
  state.lastQuote = null;

  if (!originId || !destinationId) {
    setStatus('Select pickup and destination to start quote calculation.', 'info');
    clearQuoteView();
    updateSubmitState();
    return null;
  }

  if (originId === destinationId) {
    setStatus('Pickup and destination must be different.', 'error');
    clearQuoteView();
    updateSubmitState();
    return null;
  }

  const outboundRoute = getSelectedRoute();
  if (!outboundRoute) {
    setStatus('This route is not available yet. Choose another location pair.', 'error');
    clearQuoteView();
    updateSubmitState();
    return null;
  }

  const travelDate = String(els.travelDateInput?.value || '').trim();
  const travelTime = String(els.travelTimeInput?.value || '').trim().slice(0, 5);
  const outboundRule = getBestPricingRuleForRoute(outboundRoute.id, travelDate);
  const outboundScenario = getScenario(outboundRoute, { tripType: 'one_way', travelTime });
  const outboundQuote = calculateQuote(outboundRoute, outboundRule, outboundScenario);

  state.activeRoute = outboundRoute;
  state.activeRule = outboundRule;

  const outboundLeg = {
    key: 'outbound',
    label: 'Outbound',
    route: outboundRoute,
    rule: outboundRule,
    quote: outboundQuote,
    travelDate,
    travelTime,
  };

  const tripType = normalizeTripType(els.tripTypeSelect?.value || 'one_way');
  const isRoundTrip = tripType === 'round_trip';
  let summary = null;
  let statusMessage = '';
  let statusType = 'info';

  if (!isRoundTrip) {
    summary = buildQuoteSummary([outboundLeg], { isBookable: true });
  } else {
    syncReturnDateConstraints();
    const returnOriginId = String(els.returnOriginSelect?.value || '').trim();
    const returnDestinationId = String(els.returnDestinationSelect?.value || '').trim();
    const returnDate = String(els.returnDateInput?.value || '').trim();
    const returnTime = String(els.returnTimeInput?.value || '').trim().slice(0, 5);

    if (!returnOriginId || !returnDestinationId || !returnDate || !returnTime) {
      summary = buildQuoteSummary([outboundLeg], { isBookable: false });
      if (summary) summary.warnings.push('Return leg is incomplete. Select pickup, destination, date and time.');
      statusMessage = 'Complete return leg fields to reserve both rides.';
      statusType = 'error';
    } else if (returnOriginId === returnDestinationId) {
      summary = buildQuoteSummary([outboundLeg], { isBookable: false });
      if (summary) summary.warnings.push('Return pickup and destination must be different.');
      statusMessage = 'Return pickup and destination must be different.';
      statusType = 'error';
    } else {
      const returnRoute = findRouteByLocations(returnOriginId, returnDestinationId);
      if (!returnRoute) {
        summary = buildQuoteSummary([outboundLeg], { isBookable: false });
        if (summary) summary.warnings.push('Return route is not available for selected locations.');
        statusMessage = 'Return route is not available yet. Choose another return pair.';
        statusType = 'error';
      } else {
        const returnRule = getBestPricingRuleForRoute(returnRoute.id, returnDate);
        const returnScenario = getScenario(returnRoute, { tripType: 'one_way', travelTime: returnTime });
        const returnQuote = calculateQuote(returnRoute, returnRule, returnScenario);
        const returnLeg = {
          key: 'return',
          label: 'Return',
          route: returnRoute,
          rule: returnRule,
          quote: returnQuote,
          travelDate: returnDate,
          travelTime: returnTime,
        };
        summary = buildQuoteSummary([outboundLeg, returnLeg], { isBookable: true });
        state.activeReturnRoute = returnRoute;
        state.activeReturnRule = returnRule;
      }
    }
  }

  state.lastQuote = summary;
  renderQuote(summary);

  if (!summary) {
    setStatus('Failed to calculate quote. Check route details.', 'error');
    updateSubmitState();
    return null;
  }

  if (hasBlockingCapacityWarning(summary)) {
    setStatus('Passengers or total luggage exceed route limits on at least one leg.', 'error');
  } else if (statusMessage) {
    setStatus(statusMessage, statusType);
  } else {
    const hasReturnLeg = summary.legs.length > 1;
    const rateLabel = hasReturnLeg ? 'Two-leg quote calculated.' : (outboundQuote.basePeriod === 'night' ? 'Night rate active.' : 'Day rate active.');
    const depositLabel = summary.depositEnabled
      ? `Deposit due now: ${money(summary.depositAmount, summary.currency)}`
      : 'No deposit required for selected route(s).';
    setStatus(`${rateLabel} ${depositLabel}`, 'info');
  }

  updateSubmitState();
  return summary;
}

function validateContactFieldsForLeg(legKey = 'outbound') {
  const normalizedLeg = String(legKey || '').trim().toLowerCase() === 'return' ? 'return' : 'outbound';
  const prefix = normalizedLeg === 'return' ? 'Return ' : '';
  const requirements = getLegContactRequirements(normalizedLeg);
  const values = getLegContactValues(normalizedLeg);

  if (requirements.flightNumberRequired && !values.flightNumber) {
    return `${prefix}flight number is required when an airport location is selected.`;
  }
  if (requirements.pickupAddressRequired && !values.pickupAddress) {
    if (requirements.destinationAirport) {
      return `${prefix}pickup address is required when destination is airport.`;
    }
    return `${prefix}pickup address is required.`;
  }
  if (requirements.dropoffAddressRequired && !values.dropoffAddress) {
    if (requirements.originAirport) {
      return `${prefix}dropoff address is required when pickup is airport.`;
    }
    return `${prefix}dropoff address is required.`;
  }

  return '';
}

function validateRequiredFields() {
  const name = String(els.customerNameInput?.value || '').trim();
  const phone = String(els.customerPhoneInput?.value || '').trim();
  const date = String(els.travelDateInput?.value || '').trim();
  const time = String(els.travelTimeInput?.value || '').trim();

  if (!name) return 'Full name is required.';
  if (!phone) return 'Phone number is required.';
  if (!date) return 'Travel date is required.';
  if (!time) return 'Travel time is required.';

  const email = String(els.customerEmailInput?.value || '').trim();
  if (email) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) return 'Email format looks invalid.';
  }

  const outboundContactError = validateContactFieldsForLeg('outbound');
  if (outboundContactError) return outboundContactError;

  if (isRoundTripSelected()) {
    const returnOrigin = String(els.returnOriginSelect?.value || '').trim();
    const returnDestination = String(els.returnDestinationSelect?.value || '').trim();
    const returnDate = String(els.returnDateInput?.value || '').trim();
    const returnTime = String(els.returnTimeInput?.value || '').trim();

    if (!returnOrigin || !returnDestination) {
      return 'Return pickup and destination are required for round trip.';
    }
    if (returnOrigin === returnDestination) {
      return 'Return pickup and destination must be different.';
    }
    if (!returnDate) return 'Return date is required for round trip.';
    if (!returnTime) return 'Return time is required for round trip.';
    if (date && returnDate < date) {
      return 'Return date cannot be earlier than outbound date.';
    }

    const returnContactError = validateContactFieldsForLeg('return');
    if (returnContactError) return returnContactError;
  }

  if (!els.quoteReviewCheckbox?.checked) {
    return 'Please review full quote and confirm it before booking.';
  }

  if (!els.policyCheckbox?.checked) {
    return 'Please confirm the contact consent checkbox.';
  }

  return '';
}

function buildBookingPayloadForLeg(leg) {
  const route = leg?.route || null;
  const quote = leg?.quote || {};
  const scenario = quote?.scenario || {};
  const tripMultiplier = toNonNegativeNumber(quote?.tripMultiplier, 1) || 1;
  const basePrice = round2(toNonNegativeNumber(quote?.baseFare, 0) * tripMultiplier);
  const extrasPrice = round2(toNonNegativeNumber(quote?.extrasTotal, 0) * tripMultiplier);
  const totalPrice = round2(toNonNegativeNumber(quote?.total, 0));
  const currency = String(quote?.currency || route?.currency || 'EUR').trim().toUpperCase() || 'EUR';
  const baseNotes = String(els.notesInput?.value || '').trim();
  const legKey = String(leg?.key || '').trim().toLowerCase() === 'return' ? 'return' : 'outbound';
  const legContact = getLegContactValues(legKey);

  return {
    route_id: String(route?.id || '').trim() || null,
    origin_location_id: String(route?.origin_location_id || '').trim() || null,
    destination_location_id: String(route?.destination_location_id || '').trim() || null,
    travel_date: String(leg?.travelDate || '').trim(),
    travel_time: String(leg?.travelTime || '').trim().slice(0, 5),
    num_passengers: Math.max(1, toNonNegativeInt(scenario.passengers, 1)),
    num_bags: toNonNegativeInt(scenario.bags, 0),
    num_oversize_bags: toNonNegativeInt(scenario.oversizeBags, 0),
    child_seats: toNonNegativeInt(scenario.childSeats, 0),
    booster_seats: toNonNegativeInt(scenario.boosterSeats, 0),
    waiting_minutes: toNonNegativeInt(scenario.waitingMinutes, 0),
    pickup_address: legContact.pickupAddress || null,
    dropoff_address: legContact.dropoffAddress || null,
    flight_number: legContact.flightNumber || null,
    notes: baseNotes || null,
    customer_name: String(els.customerNameInput?.value || '').trim(),
    customer_email: String(els.customerEmailInput?.value || '').trim() || null,
    customer_phone: String(els.customerPhoneInput?.value || '').trim(),
    lang: String(document.documentElement.lang || navigator.language || 'en').slice(0, 8),
    base_price: basePrice,
    extras_price: extrasPrice,
    total_price: totalPrice,
    currency,
    status: 'pending',
    payment_status: quote?.depositEnabled ? 'pending' : 'not_required',
    deposit_amount: quote?.depositEnabled ? round2(quote?.depositAmount || 0) : null,
    deposit_currency: quote?.depositEnabled ? currency : null,
  };
}

function buildTransportBookingPayload(quote) {
  const legs = Array.isArray(quote?.legs) ? quote.legs.filter(Boolean) : [];
  if (!legs.length) return null;

  const outboundLeg = legs[0];
  const outboundPayload = buildBookingPayloadForLeg(outboundLeg);
  if (!outboundPayload) return null;

  const outboundCurrency = String(outboundPayload.currency || 'EUR').trim().toUpperCase() || 'EUR';
  const extrasTotal = toNonNegativeNumber(quote?.extraPassengersCost, 0)
    + toNonNegativeNumber(quote?.extraBagsCost, 0)
    + toNonNegativeNumber(quote?.oversizeCost, 0)
    + toNonNegativeNumber(quote?.seatsCost, 0)
    + toNonNegativeNumber(quote?.waitingCost, 0);

  const payload = {
    ...outboundPayload,
    trip_type: legs.length > 1 ? 'round_trip' : 'one_way',
    base_price: round2(toNonNegativeNumber(quote?.baseFare, outboundPayload.base_price)),
    extras_price: round2(toNonNegativeNumber(extrasTotal, outboundPayload.extras_price)),
    total_price: round2(toNonNegativeNumber(quote?.total, outboundPayload.total_price)),
    currency: String(quote?.currency || outboundCurrency).trim().toUpperCase() || outboundCurrency,
    payment_status: quote?.depositEnabled ? 'pending' : 'not_required',
    deposit_amount: quote?.depositEnabled ? round2(toNonNegativeNumber(quote?.depositAmount, 0)) : null,
    deposit_currency: quote?.depositEnabled
      ? (String(quote?.currency || outboundCurrency).trim().toUpperCase() || outboundCurrency)
      : null,
    return_route_id: null,
    return_origin_location_id: null,
    return_destination_location_id: null,
    return_travel_date: null,
    return_travel_time: null,
    return_pickup_address: null,
    return_dropoff_address: null,
    return_flight_number: null,
    return_base_price: null,
    return_extras_price: null,
    return_total_price: null,
  };

  if (legs.length > 1) {
    const returnLeg = legs[1];
    const returnRoute = returnLeg?.route || null;
    const returnQuote = returnLeg?.quote || {};
    const returnContact = getLegContactValues('return');

    payload.return_route_id = String(returnRoute?.id || '').trim() || null;
    payload.return_origin_location_id = String(returnRoute?.origin_location_id || '').trim() || null;
    payload.return_destination_location_id = String(returnRoute?.destination_location_id || '').trim() || null;
    payload.return_travel_date = String(returnLeg?.travelDate || '').trim() || null;
    payload.return_travel_time = String(returnLeg?.travelTime || '').trim().slice(0, 5) || null;
    payload.return_pickup_address = returnContact.pickupAddress || null;
    payload.return_dropoff_address = returnContact.dropoffAddress || null;
    payload.return_flight_number = returnContact.flightNumber || null;
    payload.return_base_price = round2(toNonNegativeNumber(returnQuote?.baseFare, 0));
    payload.return_extras_price = round2(toNonNegativeNumber(returnQuote?.extrasTotal, 0));
    payload.return_total_price = round2(toNonNegativeNumber(returnQuote?.total, 0));
  }

  return payload;
}

function resetAfterSubmit() {
  const preserved = {
    origin: String(els.originSelect?.value || '').trim(),
    destination: String(els.destinationSelect?.value || '').trim(),
    date: String(els.travelDateInput?.value || '').trim(),
    time: String(els.travelTimeInput?.value || '').trim(),
    tripType: String(els.tripTypeSelect?.value || 'one_way').trim(),
    returnOrigin: String(els.returnOriginSelect?.value || '').trim(),
    returnDestination: String(els.returnDestinationSelect?.value || '').trim(),
    returnDate: String(els.returnDateInput?.value || '').trim(),
    returnTime: String(els.returnTimeInput?.value || '').trim(),
  };

  if (els.form instanceof HTMLFormElement) {
    els.form.reset();
  }

  setDefaultTravelDateTime();

  if (els.originSelect) els.originSelect.value = preserved.origin;
  if (els.destinationSelect) els.destinationSelect.value = preserved.destination;
  if (els.travelDateInput) els.travelDateInput.value = preserved.date;
  if (els.travelTimeInput) els.travelTimeInput.value = preserved.time;
  if (els.tripTypeSelect) els.tripTypeSelect.value = normalizeTripType(preserved.tripType);
  if (els.returnOriginSelect) els.returnOriginSelect.value = preserved.returnOrigin;
  if (els.returnDestinationSelect) els.returnDestinationSelect.value = preserved.returnDestination;
  if (els.returnDateInput) els.returnDateInput.value = preserved.returnDate;
  if (els.returnTimeInput) els.returnTimeInput.value = preserved.returnTime;

  if (els.passengersInput) els.passengersInput.value = '2';
  if (els.bagsInput) els.bagsInput.value = '2';
  if (els.oversizeBagsInput) els.oversizeBagsInput.value = '0';
  if (els.childSeatsInput) els.childSeatsInput.value = '0';
  if (els.boosterSeatsInput) els.boosterSeatsInput.value = '0';
  if (els.waitingMinutesInput) els.waitingMinutesInput.value = '0';
  if (els.quoteReviewCheckbox instanceof HTMLInputElement) {
    els.quoteReviewCheckbox.checked = false;
  }

  syncReturnLegVisibility({ force: false });
  void prefillCustomerFromSession();
}

async function handleSubmit(event) {
  event.preventDefault();

  if (!(els.submitButton instanceof HTMLButtonElement)) return;

  if (!state.activeRoute) {
    setStatus('Select an available route first.', 'error');
    return;
  }

  const quote = refreshQuote();
  if (!quote || !state.activeRoute) {
    return;
  }

  if (!quote.isBookable || !Array.isArray(quote.legs) || !quote.legs.length) {
    setStatus('Complete route settings before submitting booking.', 'error');
    updateSubmitState();
    return;
  }

  const validationError = validateRequiredFields();
  if (validationError) {
    setStatus(validationError, 'error');
    notify(validationError, 'error');
    updateSubmitState();
    return;
  }

  if (hasBlockingCapacityWarning(quote)) {
    setStatus('Passengers or total luggage exceed route limits. Please adjust before submitting.', 'error');
    updateSubmitState();
    return;
  }

  const payload = buildTransportBookingPayload(quote);
  if (!payload) {
    setStatus('Failed to prepare booking payload. Please refresh and try again.', 'error');
    updateSubmitState();
    return;
  }

  const initialButtonText = els.submitButton.textContent || 'Reserve transport';
  els.submitButton.disabled = true;
  els.submitButton.textContent = 'Sending booking...';

  try {
    let data = null;
    let submitError = null;
    let insertPayload = { ...payload };
    const strippedColumns = [];
    const isRoundTrip = Array.isArray(quote?.legs) && quote.legs.length > 1;
    let requiresLegacyMultiInsert = false;

    for (let attempt = 0; attempt < 16; attempt += 1) {
      const insertResult = await supabase
        .from('transport_bookings')
        .insert([insertPayload])
        .select('id, created_at');
      data = insertResult.data;
      submitError = insertResult.error;

      if (!submitError) break;

      const missingColumn = extractMissingColumnName(submitError);
      if (!missingColumn || !Object.prototype.hasOwnProperty.call(insertPayload, missingColumn)) {
        break;
      }

      if (isRoundTrip && ROUND_TRIP_CRITICAL_BOOKING_COLUMNS.has(missingColumn)) {
        requiresLegacyMultiInsert = true;
        break;
      }

      delete insertPayload[missingColumn];
      strippedColumns.push(missingColumn);
    }

    if (requiresLegacyMultiInsert) {
      throw new Error('Round-trip booking requires latest transport schema. Run migration "120_transport_round_trip_columns_schema_cache_fix.sql" and refresh this page.');
    }

    if (submitError) throw submitError;

    const rows = Array.isArray(data) ? data : [];
    const shortIds = rows
      .map((row) => String(row?.id || '').trim())
      .filter(Boolean)
      .map((id) => id.slice(0, 8).toUpperCase());
    const isRoundTripSuccess = quote.legs.length > 1;
    const firstId = shortIds[0] || '--------';
    const strippedColumnsHint = strippedColumns.length
      ? `<div style="margin-top:6px; font-size:12px; opacity:0.85;">Saved with compatibility mode (missing optional schema columns: ${escapeHtml(strippedColumns.join(', '))}).</div>`
      : '';

    if (els.submitSuccess) {
      els.submitSuccess.hidden = false;
      if (isRoundTripSuccess) {
        els.submitSuccess.innerHTML = `Round-trip booking <strong>#${escapeHtml(firstId)}</strong> was sent successfully. Total: <strong>${escapeHtml(money(quote.total, quote.currency))}</strong>.${strippedColumnsHint}`;
      } else {
        els.submitSuccess.innerHTML = `Booking request <strong>#${escapeHtml(firstId)}</strong> was sent successfully. Total: <strong>${escapeHtml(money(quote.total, quote.currency))}</strong>. We will contact you shortly.${strippedColumnsHint}`;
      }
    }

    if (isRoundTripSuccess) {
      notify(`Round-trip transport booking #${firstId} created`, 'success');
    } else {
      notify(`Transport booking #${firstId} created`, 'success');
    }
    setStatus('Booking submitted successfully. We will review and confirm shortly.', 'info');
    resetAfterSubmit();
    refreshQuote();
  } catch (error) {
    console.error('Failed to create transport booking:', error);
    const message = String(error?.message || 'Failed to submit booking request.');
    setStatus(message, 'error');
    notify(message, 'error');
  } finally {
    els.submitButton.textContent = initialButtonText;
    updateSubmitState();
  }
}

function bindInputs() {
  const quoteInputs = [
    els.originSelect,
    els.destinationSelect,
    els.travelDateInput,
    els.travelTimeInput,
    els.returnOriginSelect,
    els.returnDestinationSelect,
    els.returnDateInput,
    els.returnTimeInput,
    els.passengersInput,
    els.bagsInput,
    els.oversizeBagsInput,
    els.childSeatsInput,
    els.boosterSeatsInput,
    els.waitingMinutesInput,
  ].filter(Boolean);

  quoteInputs.forEach((input) => {
    const onQuoteInputChange = () => {
      resetQuoteReviewConfirmation();
      refreshQuote();
    };
    input.addEventListener('input', onQuoteInputChange);
    input.addEventListener('change', onQuoteInputChange);
  });

  if (els.tripTypeSelect instanceof HTMLSelectElement) {
    els.tripTypeSelect.addEventListener('change', () => {
      resetQuoteReviewConfirmation();
      syncReturnLegVisibility();
      refreshQuote();
    });
  }

  if (els.travelDateInput instanceof HTMLInputElement) {
    els.travelDateInput.addEventListener('change', () => {
      resetQuoteReviewConfirmation();
      syncReturnDateConstraints();
      if (isRoundTripSelected() && !String(els.returnDateInput?.value || '').trim()) {
        autoPopulateReturnLeg({ force: false });
      }
    });
  }

  if (els.destinationSelect instanceof HTMLSelectElement || els.originSelect instanceof HTMLSelectElement) {
    const syncReturnFromOutbound = () => {
      if (!isRoundTripSelected()) return;
      const returnOriginEmpty = !String(els.returnOriginSelect?.value || '').trim();
      const returnDestinationEmpty = !String(els.returnDestinationSelect?.value || '').trim();
      if (returnOriginEmpty || returnDestinationEmpty) {
        autoPopulateReturnLeg({ force: false });
      }
    };
    els.destinationSelect?.addEventListener('change', syncReturnFromOutbound);
    els.originSelect?.addEventListener('change', syncReturnFromOutbound);
  }

  if (els.pickupAddressInput instanceof HTMLInputElement || els.dropoffAddressInput instanceof HTMLInputElement) {
    const syncReturnContact = () => {
      if (!isRoundTripSelected()) return;
      syncReturnContactFromOutbound({ force: false });
    };
    els.pickupAddressInput?.addEventListener('input', syncReturnContact);
    els.dropoffAddressInput?.addEventListener('input', syncReturnContact);
    els.pickupAddressInput?.addEventListener('change', syncReturnContact);
    els.dropoffAddressInput?.addEventListener('change', syncReturnContact);
  }

  if (els.policyCheckbox) {
    els.policyCheckbox.addEventListener('change', () => {
      updateSubmitState();
    });
  }

  if (els.quoteReviewCheckbox) {
    els.quoteReviewCheckbox.addEventListener('change', () => {
      updateSubmitState();
    });
  }

  if (els.miniOpenQuoteButton) {
    els.miniOpenQuoteButton.addEventListener('click', () => {
      const quotePanel = document.querySelector('.transport-quote');
      if (quotePanel && typeof quotePanel.scrollIntoView === 'function') {
        quotePanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  if (els.form instanceof HTMLFormElement) {
    els.form.addEventListener('submit', handleSubmit);
  }
}

function initElements() {
  els.form = byId('transportBookingForm');
  els.originSelect = byId('transportOrigin');
  els.destinationSelect = byId('transportDestination');
  els.travelDateInput = byId('transportTravelDate');
  els.travelTimeInput = byId('transportTravelTime');
  els.tripTypeSelect = byId('transportTripType');
  els.returnLegSection = byId('transportReturnLegSection');
  els.returnOriginSelect = byId('transportReturnOrigin');
  els.returnDestinationSelect = byId('transportReturnDestination');
  els.returnDateInput = byId('transportReturnDate');
  els.returnTimeInput = byId('transportReturnTime');
  els.returnContactSection = byId('transportReturnContactSection');
  els.returnPickupAddressInput = byId('transportReturnPickupAddress');
  els.returnDropoffAddressInput = byId('transportReturnDropoffAddress');
  els.returnFlightNumberInput = byId('transportReturnFlightNumber');
  els.passengersInput = byId('transportPassengers');
  els.bagsInput = byId('transportBags');
  els.oversizeBagsInput = byId('transportOversizeBags');
  els.childSeatsInput = byId('transportChildSeats');
  els.boosterSeatsInput = byId('transportBoosterSeats');
  els.waitingMinutesInput = byId('transportWaitingMinutes');
  els.customerNameInput = byId('transportCustomerName');
  els.customerEmailInput = byId('transportCustomerEmail');
  els.customerPhoneInput = byId('transportCustomerPhone');
  els.pickupAddressInput = byId('transportPickupAddress');
  els.dropoffAddressInput = byId('transportDropoffAddress');
  els.flightNumberInput = byId('transportFlightNumber');
  els.outboundContactHint = byId('transportOutboundContactHint');
  els.returnContactHint = byId('transportReturnContactHint');
  els.notesInput = byId('transportNotes');
  els.policyCheckbox = byId('transportAgreePolicy');
  els.quoteReviewCheckbox = byId('transportConfirmQuote');
  els.submitHint = byId('transportSubmitHint');
  els.inlineQuote = byId('transportInlineQuote');
  els.inlineQuoteTotal = byId('transportInlineQuoteTotal');
  els.inlineQuoteDepositWrap = byId('transportInlineQuoteDepositWrap');
  els.inlineQuoteDeposit = byId('transportInlineQuoteDeposit');
  els.miniSummary = byId('transportMiniSummary');
  els.miniTotal = byId('transportMiniTotal');
  els.miniState = byId('transportMiniState');
  els.miniOpenQuoteButton = byId('transportMiniOpenQuote');
  els.submitButton = byId('transportSubmitBooking');
  els.submitSuccess = byId('transportSubmitSuccess');

  els.quoteStatus = byId('transportQuoteStatus');
  els.routeMeta = byId('transportRouteMeta');
  els.quoteRowOutbound = byId('transportQuoteRowOutbound');
  els.quoteRowReturn = byId('transportQuoteRowReturn');
  els.quoteRowBase = byId('transportQuoteRowBase');
  els.quoteRowPassengers = byId('transportQuoteRowPassengers');
  els.quoteRowBags = byId('transportQuoteRowBags');
  els.quoteRowOversize = byId('transportQuoteRowOversize');
  els.quoteRowSeats = byId('transportQuoteRowSeats');
  els.quoteRowWaiting = byId('transportQuoteRowWaiting');
  els.quoteDepositNotice = byId('transportDepositNotice');
  els.quoteOutbound = byId('transportQuoteOutbound');
  els.quoteReturn = byId('transportQuoteReturn');
  els.quoteBase = byId('transportQuoteBase');
  els.quotePassengers = byId('transportQuotePassengers');
  els.quoteBags = byId('transportQuoteBags');
  els.quoteOversize = byId('transportQuoteOversize');
  els.quoteSeats = byId('transportQuoteSeats');
  els.quoteWaiting = byId('transportQuoteWaiting');
  els.quoteDeposit = byId('transportQuoteDeposit');
  els.quoteRemainingDue = byId('transportQuoteRemainingDue');
  els.quoteTotal = byId('transportQuoteTotal');
  els.quoteWarnings = byId('transportQuoteWarnings');
}

async function initTransportBookingPage() {
  initElements();
  if (!els.form) return;

  setDefaultTravelDateTime();
  bindInputs();
  syncReturnLegVisibility({ force: false });
  clearQuoteView();
  updateSubmitState();

  try {
    await loadTransportCatalog();
    syncReturnLegVisibility({ force: false });
    await prefillCustomerFromSession();
  } catch (error) {
    console.error('Failed to initialize transport booking page:', error);
    const message = String(error?.message || 'Failed to load transport catalog.');
    setStatus(message, 'error');
    notify(message, 'error');
  }

  refreshQuote();
}

document.addEventListener('DOMContentLoaded', () => {
  void initTransportBookingPage();
});
