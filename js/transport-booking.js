import { supabase } from './supabaseClient.js';
import { quoteServiceCoupon } from './service-coupons.js';

const LOCATION_TYPE_FALLBACK_LABELS = {
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
  lastQuoteRaw: null,
  lastTripTypeSelection: 'one_way',
  coupon: {
    applied: null,
  },
  loading: false,
  languageListenerBound: false,
};

const els = {};
const QUOTE_ROW_HIDE_ANIMATION_MS = 240;
const quoteRowHideTimers = new WeakMap();

function dispatchTransportEvent(name, detail = {}) {
  try {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  } catch (_error) {
  }
}

function getTranslationEntry(translations, key) {
  if (!key || !translations || typeof translations !== 'object') return null;
  if (Object.prototype.hasOwnProperty.call(translations, key)) {
    return translations[key];
  }
  if (!key.includes('.')) return null;
  const parts = key.split('.');
  let current = translations;
  for (const part of parts) {
    if (!current || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, part)) {
      return null;
    }
    current = current[part];
  }
  return current;
}

function interpolateTemplate(text, params = {}) {
  let output = String(text ?? '');
  Object.entries(params || {}).forEach(([key, value]) => {
    const token = new RegExp(`{{\\s*${String(key)}\\s*}}`, 'g');
    output = output.replace(token, String(value ?? ''));
  });
  return output;
}

function t(key, fallback, params = {}) {
  const lang = String(window.appI18n?.language || document.documentElement?.lang || 'en').toLowerCase();
  const translations = window.appI18n?.translations?.[lang] || null;
  const entry = getTranslationEntry(translations, key);
  let value = null;
  if (typeof entry === 'string') value = entry;
  if (!value && entry && typeof entry === 'object') {
    if (typeof entry.text === 'string') value = entry.text;
    if (!value && typeof entry.html === 'string') value = entry.html;
  }
  const resolved = typeof value === 'string' ? value : String(fallback ?? '');
  return interpolateTemplate(resolved, params);
}

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

function toLocalIsoDate(dateObj) {
  if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return '';
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseIsoDateLocal(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const yyyy = Number(match[1]);
  const mm = Number(match[2]);
  const dd = Number(match[3]);
  if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return null;
  const dt = new Date(yyyy, mm - 1, dd);
  if (Number.isNaN(dt.getTime())) return null;
  if (dt.getFullYear() !== yyyy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) return null;
  return dt;
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
  const dt = parseIsoDateLocal(isoDate);
  if (!dt) return '';
  dt.setDate(dt.getDate() + Number(days || 0));
  return toLocalIsoDate(dt);
}

function dateLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  try {
    const dt = parseIsoDateLocal(raw);
    if (!dt) return raw;
    const language = String(document.documentElement.lang || window.appI18n?.language || 'en').toLowerCase();
    const locale = language.startsWith('pl')
      ? 'pl-PL'
      : language.startsWith('el')
        ? 'el-GR'
        : language.startsWith('he')
          ? 'he-IL'
          : 'en-GB';
    return dt.toLocaleDateString(locale);
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
  if (!row || typeof row !== 'object') return t('transport.booking.common.location', 'Location');
  const name = String(row.name || '').trim();
  const local = String(row.name_local || '').trim();
  const code = String(row.code || '').trim();
  const locationType = String(row.location_type || '').trim().toLowerCase();
  const typeFallback = LOCATION_TYPE_FALLBACK_LABELS[locationType] || t('transport.booking.locationType.point', 'Point');
  const type = t(`transport.booking.locationType.${locationType}`, typeFallback);
  const base = name || local || code || t('transport.booking.common.location', 'Location');
  const localSuffix = local && local.toLowerCase() !== base.toLowerCase() ? ` / ${local}` : '';
  return `${base}${localSuffix} (${type})`;
}

function getLocationShortLabelById(locationId) {
  const id = String(locationId || '').trim();
  if (!id) return t('transport.booking.common.location', 'Location');
  const row = state.locationById.get(id);
  if (!row) return id.slice(0, 8);
  const name = String(row.name || '').trim();
  const local = String(row.name_local || '').trim();
  return name || local || String(row.code || '').trim() || id.slice(0, 8);
}

function getRouteLabel(route) {
  if (!route || typeof route !== 'object') return t('transport.booking.common.route', 'Route');
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

function getLegLabel(legKey = 'outbound') {
  const normalizedLeg = String(legKey || '').trim().toLowerCase() === 'return' ? 'return' : 'outbound';
  if (normalizedLeg === 'return') {
    return t('transport.booking.legs.return', 'Return');
  }
  return t('transport.booking.legs.outbound', 'Outbound');
}

function getLegContactGuidance(requirements, legKey = 'outbound') {
  const label = getLegLabel(legKey);
  if (!requirements || typeof requirements !== 'object') {
    return t(
      'transport.booking.guidance.generic',
      '{{leg}}: add exact pickup/drop-off details to avoid delays.',
      { leg: label },
    );
  }

  if (!requirements.airportSelected) {
    return t(
      'transport.booking.guidance.noAirport',
      '{{leg}}: no airport selected. Add both pickup and drop-off address. Flight number is optional.',
      { leg: label },
    );
  }

  if (requirements.originAirport && requirements.destinationAirport) {
    return t(
      'transport.booking.guidance.airportToAirport',
      '{{leg}}: airport to airport. Flight number and both addresses are required.',
      { leg: label },
    );
  }

  if (requirements.originAirport) {
    return t(
      'transport.booking.guidance.originAirport',
      '{{leg}}: pickup is airport. Flight number and drop-off address are required.',
      { leg: label },
    );
  }

  if (requirements.destinationAirport) {
    return t(
      'transport.booking.guidance.destinationAirport',
      '{{leg}}: destination is airport. Flight number and pickup address are required.',
      { leg: label },
    );
  }

  return t(
    'transport.booking.guidance.generic',
    '{{leg}}: add exact pickup/drop-off details to avoid delays.',
    { leg: label },
  );
}

const FIELD_REQUIREMENT_LABELS = {
  transportFlightNumber: { key: 'transport.booking.fields.flightNumber.label', fallback: 'Outbound flight number' },
  transportPickupAddress: { key: 'transport.booking.fields.pickupAddress.label', fallback: 'Outbound pickup address' },
  transportDropoffAddress: { key: 'transport.booking.fields.dropoffAddress.label', fallback: 'Outbound drop-off address' },
  transportReturnFlightNumber: { key: 'transport.booking.fields.returnFlightNumber.label', fallback: 'Return flight number' },
  transportReturnPickupAddress: { key: 'transport.booking.fields.returnPickupAddress.label', fallback: 'Return pickup address' },
  transportReturnDropoffAddress: { key: 'transport.booking.fields.returnDropoffAddress.label', fallback: 'Return drop-off address' },
};

function setFieldRequirement(fieldId, fallbackLabel, required) {
  const field = byId(fieldId);
  if (field && typeof field.required === 'boolean') {
    field.required = Boolean(required);
  }
  const label = document.querySelector(`label[for="${fieldId}"]`);
  if (label) {
    const config = FIELD_REQUIREMENT_LABELS[fieldId] || null;
    const baseLabel = config ? t(config.key, config.fallback || fallbackLabel) : String(fallbackLabel || '');
    label.textContent = required ? `${baseLabel} *` : baseLabel;
  }
}

function syncTransportContactRequirements() {
  const outboundRequirements = getLegContactRequirements('outbound');
  setFieldRequirement('transportFlightNumber', 'Outbound flight number', outboundRequirements.flightNumberRequired);
  setFieldRequirement('transportPickupAddress', 'Outbound pickup address', outboundRequirements.pickupAddressRequired);
  setFieldRequirement('transportDropoffAddress', 'Outbound drop-off address', outboundRequirements.dropoffAddressRequired);
  if (els.outboundContactHint) {
    els.outboundContactHint.textContent = getLegContactGuidance(outboundRequirements, 'outbound');
  }

  if (isRoundTripSelected()) {
    const returnRequirements = getLegContactRequirements('return');
    setFieldRequirement('transportReturnFlightNumber', 'Return flight number', returnRequirements.flightNumberRequired);
    setFieldRequirement('transportReturnPickupAddress', 'Return pickup address', returnRequirements.pickupAddressRequired);
    setFieldRequirement('transportReturnDropoffAddress', 'Return drop-off address', returnRequirements.dropoffAddressRequired);
    if (els.returnContactHint) {
      els.returnContactHint.textContent = getLegContactGuidance(returnRequirements, 'return');
    }
    return;
  }

  setFieldRequirement('transportReturnFlightNumber', 'Return flight number', false);
  setFieldRequirement('transportReturnPickupAddress', 'Return pickup address', false);
  setFieldRequirement('transportReturnDropoffAddress', 'Return drop-off address', false);
  if (els.returnContactHint) {
    els.returnContactHint.textContent = t(
      'transport.booking.guidance.returnOnlyWhenRoundTrip',
      'Return details are shown only when trip type is set to Round trip.',
    );
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
  setStatus(t('transport.booking.status.loadingCatalog', 'Loading active transport routes and pricing rules...'), 'info');

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
    setStatus(t('transport.booking.status.noActiveRoutes', 'No active transport routes are available yet. Please try again later.'), 'error');
    updateSubmitState();
    return;
  }

  setStatus(t('transport.booking.status.selectRouteToQuote', 'Select route details to calculate your quote.'), 'info');
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

  els.originSelect.innerHTML = `<option value="">${escapeHtml(t('transport.booking.fields.origin.placeholder', 'Select pickup'))}</option>${options}`;
  els.destinationSelect.innerHTML = `<option value="">${escapeHtml(t('transport.booking.fields.destination.placeholder', 'Select destination'))}</option>${options}`;
  if (els.returnOriginSelect instanceof HTMLSelectElement) {
    els.returnOriginSelect.innerHTML = `<option value="">${escapeHtml(t('transport.booking.fields.returnOrigin.placeholder', 'Select return pickup'))}</option>${options}`;
  }
  if (els.returnDestinationSelect instanceof HTMLSelectElement) {
    els.returnDestinationSelect.innerHTML = `<option value="">${escapeHtml(t('transport.booking.fields.returnDestination.placeholder', 'Select return destination'))}</option>${options}`;
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

  const todayIso = toLocalIsoDate(new Date());
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

function isReturnUsingSameExtras() {
  if (!(els.returnSameExtrasCheckbox instanceof HTMLInputElement)) return true;
  return Boolean(els.returnSameExtrasCheckbox.checked);
}

function syncReturnExtrasFromOutbound(options = {}) {
  const force = Boolean(options?.force);
  const mappings = [
    [els.passengersInput, els.returnPassengersInput, '1'],
    [els.bagsInput, els.returnBagsInput, '0'],
    [els.oversizeBagsInput, els.returnOversizeBagsInput, '0'],
    [els.childSeatsInput, els.returnChildSeatsInput, '0'],
    [els.boosterSeatsInput, els.returnBoosterSeatsInput, '0'],
    [els.waitingMinutesInput, els.returnWaitingMinutesInput, '0'],
  ];

  mappings.forEach(([source, target, fallback]) => {
    if (!(target instanceof HTMLInputElement)) return;
    const sourceValue = String(source?.value || fallback).trim();
    const targetValue = String(target.value || '').trim();
    if (force || !targetValue) {
      target.value = sourceValue || fallback;
    }
  });
}

function syncReturnExtrasVisibility(options = {}) {
  const roundTrip = isRoundTripSelected();
  if (els.returnExtrasMode) {
    els.returnExtrasMode.hidden = !roundTrip;
  }

  if (!roundTrip) {
    if (els.returnExtrasSection) {
      els.returnExtrasSection.hidden = true;
    }
    if (els.returnSameExtrasCheckbox instanceof HTMLInputElement) {
      els.returnSameExtrasCheckbox.checked = true;
    }
    syncReturnExtrasFromOutbound({ force: true });
    return;
  }

  const switchedFromOneWay = Boolean(options?.switchedFromOneWay);
  if (switchedFromOneWay && els.returnSameExtrasCheckbox instanceof HTMLInputElement) {
    els.returnSameExtrasCheckbox.checked = true;
  }

  const sameExtras = isReturnUsingSameExtras();
  if (els.returnExtrasSection) {
    els.returnExtrasSection.hidden = sameExtras;
  }

  if (sameExtras) {
    syncReturnExtrasFromOutbound({ force: Boolean(options?.force || switchedFromOneWay) });
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

  const switchedFromOneWay = state.lastTripTypeSelection !== 'round_trip';

  if (roundTrip) {
    autoPopulateReturnLeg({ force: Boolean(options?.force || switchedFromOneWay) });
    syncReturnContactFromOutbound({ force: Boolean(options?.force || switchedFromOneWay) });
  }

  syncReturnExtrasVisibility({
    force: Boolean(options?.force),
    switchedFromOneWay,
  });

  state.lastTripTypeSelection = roundTrip ? 'round_trip' : 'one_way';
}

function setDefaultTravelDateTime() {
  if (!(els.travelDateInput instanceof HTMLInputElement) || !(els.travelTimeInput instanceof HTMLInputElement)) return;

  const now = new Date();
  const todayIso = toLocalIsoDate(now);
  els.travelDateInput.min = todayIso;

  if (!els.travelDateInput.value) {
    const nextDay = new Date(now);
    nextDay.setDate(nextDay.getDate() + 1);
    els.travelDateInput.value = toLocalIsoDate(nextDay);
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

function getReturnScenarioOverrides() {
  if (!isRoundTripSelected()) return null;
  if (isReturnUsingSameExtras()) return null;

  return {
    passengers: Math.max(1, toNonNegativeInt(els.returnPassengersInput?.value, toNonNegativeInt(els.passengersInput?.value, 2))),
    bags: toNonNegativeInt(els.returnBagsInput?.value, toNonNegativeInt(els.bagsInput?.value, 2)),
    oversizeBags: toNonNegativeInt(els.returnOversizeBagsInput?.value, toNonNegativeInt(els.oversizeBagsInput?.value, 0)),
    childSeats: toNonNegativeInt(els.returnChildSeatsInput?.value, toNonNegativeInt(els.childSeatsInput?.value, 0)),
    boosterSeats: toNonNegativeInt(els.returnBoosterSeatsInput?.value, toNonNegativeInt(els.boosterSeatsInput?.value, 0)),
    waitingMinutes: toNonNegativeInt(els.returnWaitingMinutesInput?.value, toNonNegativeInt(els.waitingMinutesInput?.value, 0)),
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
    warnings.push(
      t(
        'transport.booking.warnings.passengersExceedLimit',
        'Passengers exceed route limit ({{max}}).',
        { max: maxPassengers },
      ),
    );
  }
  if (totalLuggageCount > maxBags) {
    warnings.push(
      t(
        'transport.booking.warnings.luggageExceedLimit',
        'Total luggage exceeds route limit ({{max}}).',
        { max: maxBags },
      ),
    );
  }

  let tripType = normalizeTripType(scenario.tripType || 'one_way');
  const allowsRoundTrip = routeAllowsRoundTrip(route);
  const roundTripMultiplier = routeRoundTripMultiplier(route);
  if (tripType === 'round_trip' && !allowsRoundTrip) {
    tripType = 'one_way';
    warnings.push(t('transport.booking.warnings.roundTripNotEnabled', 'Round trip is not enabled for this route.'));
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

  const text = String(message || t('transport.booking.status.checkDetails', 'Please check booking details.')).trim();
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

function normalizeCouponCodeInput(value) {
  return String(value || '').trim().toUpperCase();
}

function getCouponCodeInputValue() {
  return normalizeCouponCodeInput(els.couponCodeInput?.value || '');
}

function setCouponStatus(message = '', type = 'info') {
  if (!els.couponStatus) return;
  const text = String(message || '').trim();
  if (!text) {
    els.couponStatus.hidden = true;
    els.couponStatus.textContent = '';
    els.couponStatus.classList.remove('is-error', 'is-success', 'is-info');
    return;
  }
  els.couponStatus.hidden = false;
  els.couponStatus.textContent = text;
  els.couponStatus.classList.remove('is-error', 'is-success', 'is-info');
  if (type === 'error') {
    els.couponStatus.classList.add('is-error');
  } else if (type === 'success') {
    els.couponStatus.classList.add('is-success');
  } else {
    els.couponStatus.classList.add('is-info');
  }
}

function syncCouponControls() {
  const hasCode = Boolean(getCouponCodeInputValue());
  const hasApplied = Boolean(state.coupon?.applied);
  if (els.couponApplyButton instanceof HTMLButtonElement) {
    els.couponApplyButton.disabled = !hasCode || !state.lastQuoteRaw || state.loading;
  }
  if (els.couponClearButton instanceof HTMLButtonElement) {
    els.couponClearButton.hidden = !hasCode && !hasApplied;
  }
}

function clearAppliedCoupon(options = {}) {
  const clearInput = options.clearInput !== false;
  const silent = options.silent === true;

  state.coupon.applied = null;
  if (clearInput && els.couponCodeInput instanceof HTMLInputElement) {
    els.couponCodeInput.value = '';
  }
  if (!silent) {
    setCouponStatus('', 'info');
  }
  syncCouponControls();
}

function invalidateAppliedCouponAfterQuoteChange() {
  if (!state.coupon.applied) return;
  state.coupon.applied = null;
  const code = getCouponCodeInputValue();
  if (code) {
    setCouponStatus(
      t('transport.booking.coupon.reapply', 'Route or passengers changed. Re-apply coupon for updated quote.'),
      'info',
    );
  } else {
    setCouponStatus('', 'info');
  }
}

function getPrimaryQuoteLeg(summary) {
  const legs = Array.isArray(summary?.legs) ? summary.legs : [];
  return legs[0] || null;
}

function buildQuoteFingerprint(summary) {
  if (!summary || !Array.isArray(summary.legs)) return '';
  const legs = summary.legs.map((leg) => {
    const routeId = String(leg?.route?.id || '').trim();
    const travelDate = String(leg?.travelDate || '').trim();
    const travelTime = String(leg?.travelTime || '').trim().slice(0, 5);
    const legTotal = round2(toNonNegativeNumber(leg?.quote?.total, 0));
    return `${routeId}|${travelDate}|${travelTime}|${legTotal}`;
  });
  return `${round2(toNonNegativeNumber(summary.total, 0))}|${legs.join('||')}`;
}

function getTransportCouponCategoryKeys(route) {
  if (!route || typeof route !== 'object') return [];
  const origin = state.locationById.get(String(route.origin_location_id || '').trim()) || null;
  const destination = state.locationById.get(String(route.destination_location_id || '').trim()) || null;
  const values = [
    origin?.name,
    origin?.name_local,
    origin?.code,
    destination?.name,
    destination?.name_local,
    destination?.code,
  ];
  return Array.from(new Set(
    values
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter(Boolean),
  ));
}

function buildTransportCouponQuoteParams(summary, couponCode) {
  const primaryLeg = getPrimaryQuoteLeg(summary);
  const route = primaryLeg?.route || state.activeRoute || null;
  const travelDate = String(primaryLeg?.travelDate || '').trim();
  const travelTime = String(primaryLeg?.travelTime || '').trim().slice(0, 5);
  const dateTimeIso = travelDate
    ? `${travelDate}T${travelTime || '12:00'}:00`
    : null;
  const userEmail = String(els.customerEmailInput?.value || '').trim().toLowerCase() || null;
  return {
    serviceType: 'transport',
    couponCode,
    baseTotal: round2(toNonNegativeNumber(summary?.total, 0)),
    serviceAt: dateTimeIso,
    resourceId: String(route?.id || '').trim() || null,
    categoryKeys: getTransportCouponCategoryKeys(route),
    userEmail,
  };
}

function decorateSummaryWithCoupon(summaryRaw) {
  if (!summaryRaw || !Array.isArray(summaryRaw.legs) || !summaryRaw.legs.length) {
    return null;
  }

  const baseTotal = round2(toNonNegativeNumber(summaryRaw.total, 0));
  const baseDeposit = round2(toNonNegativeNumber(summaryRaw.depositAmount, 0));
  const decorated = {
    ...summaryRaw,
    totalBeforeCoupon: baseTotal,
    total: baseTotal,
    couponId: null,
    couponCode: '',
    couponDiscountAmount: 0,
    couponPartnerId: null,
    couponPartnerCommissionBps: null,
    depositAmountBeforeCoupon: baseDeposit,
    depositAmount: baseDeposit,
  };

  const applied = state.coupon?.applied;
  const inputCode = getCouponCodeInputValue();
  if (!applied || !inputCode || normalizeCouponCodeInput(applied.couponCode) !== inputCode) {
    decorated.depositEnabled = decorated.depositAmount > 0;
    return decorated;
  }

  const discount = round2(Math.min(baseTotal, toNonNegativeNumber(applied.discountAmount, 0)));
  const finalTotal = round2(Math.max(0, baseTotal - discount));
  const finalDeposit = round2(Math.min(baseDeposit, finalTotal));

  decorated.total = finalTotal;
  decorated.couponId = applied.couponId || null;
  decorated.couponCode = normalizeCouponCodeInput(applied.couponCode || inputCode);
  decorated.couponDiscountAmount = discount;
  decorated.couponPartnerId = applied.partnerId || null;
  decorated.couponPartnerCommissionBps = Number.isFinite(Number(applied.partnerCommissionBpsOverride))
    ? Number(applied.partnerCommissionBpsOverride)
    : null;
  decorated.depositAmount = finalDeposit;
  decorated.depositEnabled = finalDeposit > 0;
  return decorated;
}

function applyCurrentQuoteDecorationAndRender() {
  const decorated = decorateSummaryWithCoupon(state.lastQuoteRaw);
  state.lastQuote = decorated;
  renderQuote(decorated);
  updateSubmitState();
  emitQuoteUpdated(decorated);
}

async function applyCouponForCurrentQuote(options = {}) {
  const code = normalizeCouponCodeInput(options.code || getCouponCodeInputValue());
  if (!code) {
    setCouponStatus(t('transport.booking.coupon.enterCode', 'Enter coupon code first.'), 'error');
    syncCouponControls();
    return false;
  }
  if (!state.lastQuoteRaw || !state.lastQuoteRaw.isBookable) {
    setCouponStatus(
      t('transport.booking.coupon.completeQuoteFirst', 'Complete route and passengers first to validate coupon.'),
      'error',
    );
    syncCouponControls();
    return false;
  }
  if (hasBlockingCapacityWarning(state.lastQuoteRaw)) {
    setCouponStatus(
      t('transport.booking.coupon.capacityBlock', 'Adjust passengers or luggage before applying coupon.'),
      'error',
    );
    syncCouponControls();
    return false;
  }

  const params = buildTransportCouponQuoteParams(state.lastQuoteRaw, code);
  if (!Number.isFinite(params.baseTotal) || params.baseTotal <= 0) {
    setCouponStatus(
      t('transport.booking.coupon.noBaseTotal', 'Quote total must be above zero to apply coupon.'),
      'error',
    );
    syncCouponControls();
    return false;
  }

  if (els.couponApplyButton instanceof HTMLButtonElement) {
    els.couponApplyButton.disabled = true;
  }
  if (els.couponCodeInput instanceof HTMLInputElement) {
    els.couponCodeInput.value = code;
  }

  try {
    const response = await quoteServiceCoupon(params);
    if (!response?.ok || !response.result) {
      clearAppliedCoupon({ clearInput: false, silent: true });
      setCouponStatus(String(response?.message || t('transport.booking.coupon.invalid', 'Coupon is not valid.')), 'error');
      applyCurrentQuoteDecorationAndRender();
      return false;
    }

    state.coupon.applied = {
      couponId: response.result.couponId || null,
      couponCode: normalizeCouponCodeInput(response.result.couponCode || code),
      discountAmount: round2(toNonNegativeNumber(response.result.discountAmount, 0)),
      baseTotal: round2(toNonNegativeNumber(response.result.baseTotal, params.baseTotal)),
      finalTotal: round2(toNonNegativeNumber(response.result.finalTotal, params.baseTotal)),
      partnerId: response.result.partnerId || null,
      partnerCommissionBpsOverride: response.result.partnerCommissionBpsOverride ?? null,
    };
    setCouponStatus(
      t('transport.booking.coupon.applied', 'Coupon applied. Discount: {{amount}}', {
        amount: money(state.coupon.applied.discountAmount, state.lastQuoteRaw?.currency || 'EUR'),
      }),
      'success',
    );
    applyCurrentQuoteDecorationAndRender();
    return true;
  } catch (error) {
    console.error('Failed to apply transport coupon:', error);
    clearAppliedCoupon({ clearInput: false, silent: true });
    setCouponStatus(String(error?.message || t('transport.booking.coupon.failed', 'Failed to validate coupon.')), 'error');
    applyCurrentQuoteDecorationAndRender();
    return false;
  } finally {
    syncCouponControls();
  }
}

function handleApplyCouponClick() {
  void applyCouponForCurrentQuote();
}

function handleClearCouponClick() {
  clearAppliedCoupon({ clearInput: true, silent: true });
  setCouponStatus('', 'info');
  applyCurrentQuoteDecorationAndRender();
  syncCouponControls();
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
  setQuoteBreakdownRow(els.quoteRowCoupon, els.quoteCoupon, { visible: false });
  setDepositNotice(false, '—');
}

function clearQuoteView() {
  resetQuoteBreakdownRows();
  if (els.routeMeta) {
    els.routeMeta.hidden = true;
    els.routeMeta.textContent = '';
  }
  if (els.quoteWarnings) {
    els.quoteWarnings.innerHTML = '';
  }
  if (els.quoteTotal) {
    els.quoteTotal.textContent = '—';
  }
  syncCouponControls();
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
    summary.warnings.push(t(
      'transport.booking.warnings.mixedCurrencies',
      'Selected legs use different currencies. Choose routes with the same currency.',
    ));
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
  setQuoteBreakdownRow(els.quoteRowCoupon, els.quoteCoupon, {
    visible: round2(summary.couponDiscountAmount) > 0,
    text: `−${money(summary.couponDiscountAmount, summary.currency)}`,
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

  syncCouponControls();
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
      els.submitHint.textContent = t('transport.booking.submit.hint.selectRoute', 'Select route and schedule first.');
    } else if (!hasQuote) {
      els.submitHint.textContent = t('transport.booking.submit.hint.completeRoute', 'Complete all required route fields to calculate final quote.');
    } else if (hasBlockingWarning) {
      els.submitHint.textContent = t('transport.booking.submit.hint.adjustCapacity', 'Adjust passengers/luggage: current selection exceeds route limits.');
    } else if (!hasQuoteReview) {
      els.submitHint.textContent = t('transport.booking.submit.hint.reviewQuote', 'Review full quote and confirm it below to unlock booking.');
    } else if (!hasPolicy) {
      els.submitHint.textContent = t('transport.booking.submit.hint.acceptConsent', 'Accept contact consent checkbox to continue.');
    } else {
      els.submitHint.textContent = t('transport.booking.submit.hint.ready', 'All set. You can submit booking now.');
    }
  }

  if (els.miniState) {
    els.miniState.classList.remove('is-ok', 'is-warn');
    if (!hasRoute) {
      els.miniState.textContent = t('transport.booking.mini.state.selectRoute', 'Select route and schedule first.');
    } else if (!hasQuote) {
      els.miniState.textContent = t('transport.booking.mini.state.completeRoute', 'Complete route details for final quote.');
      els.miniState.classList.add('is-warn');
    } else if (hasBlockingWarning) {
      els.miniState.textContent = t('transport.booking.mini.state.capacityExceeded', 'Route limit exceeded. Update passengers/luggage.');
      els.miniState.classList.add('is-warn');
    } else if (!hasQuoteReview) {
      els.miniState.textContent = t('transport.booking.mini.state.reviewQuote', 'Open full quote and confirm calculation.');
    } else if (!hasPolicy) {
      els.miniState.textContent = t('transport.booking.mini.state.confirmConsent', 'Confirm contact consent to continue.');
    } else {
      els.miniState.textContent = t('transport.booking.mini.state.ready', 'Ready to book.');
      els.miniState.classList.add('is-ok');
    }
  }
}

function resetQuoteReviewConfirmation() {
  if (els.quoteReviewCheckbox instanceof HTMLInputElement) {
    els.quoteReviewCheckbox.checked = false;
  }
}

function emitQuoteUpdated(summary) {
  dispatchTransportEvent('ce:transport:quote-updated', {
    quote: summary || null,
    hasRoute: Boolean(state.activeRoute),
    hasReturnRoute: Boolean(state.activeReturnRoute),
    isRoundTrip: isRoundTripSelected(),
  });
}

function refreshQuote() {
  syncTransportContactRequirements();
  const previousFingerprint = buildQuoteFingerprint(state.lastQuoteRaw);

  if (state.loading) {
    state.lastQuote = null;
    state.lastQuoteRaw = null;
    updateSubmitState();
    emitQuoteUpdated(null);
    syncCouponControls();
    return null;
  }

  const originId = String(els.originSelect?.value || '').trim();
  const destinationId = String(els.destinationSelect?.value || '').trim();

  state.activeRoute = null;
  state.activeRule = null;
  state.activeReturnRoute = null;
  state.activeReturnRule = null;
  state.lastQuote = null;
  state.lastQuoteRaw = null;

  if (!originId || !destinationId) {
    invalidateAppliedCouponAfterQuoteChange();
    setStatus(t('transport.booking.status.selectPickupDestination', 'Select pickup and destination to start quote calculation.'), 'info');
    clearQuoteView();
    updateSubmitState();
    emitQuoteUpdated(null);
    return null;
  }

  if (originId === destinationId) {
    invalidateAppliedCouponAfterQuoteChange();
    setStatus(t('transport.booking.status.pickupDestinationDifferent', 'Pickup and destination must be different.'), 'error');
    clearQuoteView();
    updateSubmitState();
    emitQuoteUpdated(null);
    return null;
  }

  const outboundRoute = getSelectedRoute();
  if (!outboundRoute) {
    invalidateAppliedCouponAfterQuoteChange();
    setStatus(t('transport.booking.status.routeUnavailable', 'This route is not available yet. Choose another location pair.'), 'error');
    clearQuoteView();
    updateSubmitState();
    emitQuoteUpdated(null);
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
    label: t('transport.booking.legs.outbound', 'Outbound'),
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
      if (summary) summary.warnings.push(t('transport.booking.warnings.returnLegIncomplete', 'Return leg is incomplete. Select pickup, destination, date and time.'));
      statusMessage = t('transport.booking.status.completeReturnLeg', 'Complete return leg fields to reserve both rides.');
      statusType = 'error';
    } else if (returnOriginId === returnDestinationId) {
      summary = buildQuoteSummary([outboundLeg], { isBookable: false });
      if (summary) summary.warnings.push(t('transport.booking.warnings.returnPickupDestinationDifferent', 'Return pickup and destination must be different.'));
      statusMessage = t('transport.booking.status.returnPickupDestinationDifferent', 'Return pickup and destination must be different.');
      statusType = 'error';
    } else {
      const returnRoute = findRouteByLocations(returnOriginId, returnDestinationId);
      if (!returnRoute) {
        summary = buildQuoteSummary([outboundLeg], { isBookable: false });
        if (summary) summary.warnings.push(t('transport.booking.warnings.returnRouteUnavailable', 'Return route is not available for selected locations.'));
        statusMessage = t('transport.booking.status.returnRouteUnavailable', 'Return route is not available yet. Choose another return pair.');
        statusType = 'error';
      } else {
        const returnRule = getBestPricingRuleForRoute(returnRoute.id, returnDate);
        const returnScenarioOverrides = getReturnScenarioOverrides();
        const returnScenario = getScenario(returnRoute, {
          tripType: 'one_way',
          travelTime: returnTime,
          ...(returnScenarioOverrides || {}),
        });
        const returnQuote = calculateQuote(returnRoute, returnRule, returnScenario);
        const returnLeg = {
          key: 'return',
          label: t('transport.booking.legs.return', 'Return'),
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

  const nextFingerprint = buildQuoteFingerprint(summary);
  if (previousFingerprint !== nextFingerprint) {
    invalidateAppliedCouponAfterQuoteChange();
  }
  state.lastQuoteRaw = summary;
  applyCurrentQuoteDecorationAndRender();

  if (!summary) {
    setStatus(t('transport.booking.status.quoteFailed', 'Failed to calculate quote. Check route details.'), 'error');
    return null;
  }

  if (hasBlockingCapacityWarning(summary)) {
    setStatus(t('transport.booking.status.capacityExceeded', 'Passengers or total luggage exceed route limits on at least one leg.'), 'error');
  } else if (statusMessage) {
    setStatus(statusMessage, statusType);
  } else {
    const hasReturnLeg = summary.legs.length > 1;
    const rateLabel = hasReturnLeg
      ? t('transport.booking.status.twoLegQuote', 'Two-leg quote calculated.')
      : (
        outboundQuote.basePeriod === 'night'
          ? t('transport.booking.status.nightRate', 'Night rate active.')
          : t('transport.booking.status.dayRate', 'Day rate active.')
      );
    const depositLabel = summary.depositEnabled
      ? t('transport.booking.status.depositDueNow', 'Deposit due now: {{amount}}', {
        amount: money(summary.depositAmount, summary.currency),
      })
      : t('transport.booking.status.noDeposit', 'No deposit required for selected route(s).');
    setStatus(`${rateLabel} ${depositLabel}`, 'info');
  }

  return state.lastQuote;
}

function validateContactFieldsForLeg(legKey = 'outbound') {
  const normalizedLeg = String(legKey || '').trim().toLowerCase() === 'return' ? 'return' : 'outbound';
  const prefix = normalizedLeg === 'return'
    ? t('transport.booking.validation.returnPrefix', 'Return trip: ')
    : t('transport.booking.validation.outboundPrefix', 'Outbound trip: ');
  const requirements = getLegContactRequirements(normalizedLeg);
  const values = getLegContactValues(normalizedLeg);

  if (requirements.flightNumberRequired && !values.flightNumber) {
    return `${prefix}${t('transport.booking.validation.flightNumberRequiredAirport', 'flight number is required when an airport location is selected.')}`;
  }
  if (requirements.pickupAddressRequired && !values.pickupAddress) {
    if (requirements.destinationAirport) {
      return `${prefix}${t('transport.booking.validation.pickupAddressRequiredDestinationAirport', 'pickup address is required when destination is airport.')}`;
    }
    return `${prefix}${t('transport.booking.validation.pickupAddressRequired', 'pickup address is required.')}`;
  }
  if (requirements.dropoffAddressRequired && !values.dropoffAddress) {
    if (requirements.originAirport) {
      return `${prefix}${t('transport.booking.validation.dropoffAddressRequiredOriginAirport', 'drop-off address is required when pickup is airport.')}`;
    }
    return `${prefix}${t('transport.booking.validation.dropoffAddressRequired', 'drop-off address is required.')}`;
  }

  return '';
}

function validateRequiredFields() {
  const name = String(els.customerNameInput?.value || '').trim();
  const phone = String(els.customerPhoneInput?.value || '').trim();
  const date = String(els.travelDateInput?.value || '').trim();
  const time = String(els.travelTimeInput?.value || '').trim();

  if (!name) return t('transport.booking.validation.fullNameRequired', 'Full name is required.');
  if (!phone) return t('transport.booking.validation.phoneRequired', 'Phone number is required.');
  if (!date) return t('transport.booking.validation.travelDateRequired', 'Travel date is required.');
  if (!time) return t('transport.booking.validation.travelTimeRequired', 'Travel time is required.');

  const email = String(els.customerEmailInput?.value || '').trim();
  if (email) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) return t('transport.booking.validation.emailInvalid', 'Email format looks invalid.');
  }

  const outboundContactError = validateContactFieldsForLeg('outbound');
  if (outboundContactError) return outboundContactError;

  if (isRoundTripSelected()) {
    const returnOrigin = String(els.returnOriginSelect?.value || '').trim();
    const returnDestination = String(els.returnDestinationSelect?.value || '').trim();
    const returnDate = String(els.returnDateInput?.value || '').trim();
    const returnTime = String(els.returnTimeInput?.value || '').trim();

    if (!returnOrigin || !returnDestination) {
      return t('transport.booking.validation.returnPickupDestinationRequired', 'Return pickup and destination are required for round trip.');
    }
    if (returnOrigin === returnDestination) {
      return t('transport.booking.validation.returnPickupDestinationDifferent', 'Return pickup and destination must be different.');
    }
    if (!returnDate) return t('transport.booking.validation.returnDateRequired', 'Return date is required for round trip.');
    if (!returnTime) return t('transport.booking.validation.returnTimeRequired', 'Return time is required for round trip.');
    if (date && returnDate < date) {
      return t('transport.booking.validation.returnDateBeforeOutbound', 'Return date cannot be earlier than outbound date.');
    }

    const returnContactError = validateContactFieldsForLeg('return');
    if (returnContactError) return returnContactError;
  }

  if (!els.quoteReviewCheckbox?.checked) {
    return t('transport.booking.validation.quoteReviewRequired', 'Please review full quote and confirm it before booking.');
  }

  if (!els.policyCheckbox?.checked) {
    return t('transport.booking.validation.contactConsentRequired', 'Please confirm the contact consent checkbox.');
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

function getScenarioSnapshotForBooking(scenario = {}) {
  return {
    passengers: Math.max(1, toNonNegativeInt(scenario?.passengers, 1)),
    bags: toNonNegativeInt(scenario?.bags, 0),
    oversizeBags: toNonNegativeInt(scenario?.oversizeBags, 0),
    childSeats: toNonNegativeInt(scenario?.childSeats, 0),
    boosterSeats: toNonNegativeInt(scenario?.boosterSeats, 0),
    waitingMinutes: toNonNegativeInt(scenario?.waitingMinutes, 0),
  };
}

function scenarioSnapshotKey(snapshot = {}) {
  return [
    Math.max(1, toNonNegativeInt(snapshot?.passengers, 1)),
    toNonNegativeInt(snapshot?.bags, 0),
    toNonNegativeInt(snapshot?.oversizeBags, 0),
    toNonNegativeInt(snapshot?.childSeats, 0),
    toNonNegativeInt(snapshot?.boosterSeats, 0),
    toNonNegativeInt(snapshot?.waitingMinutes, 0),
  ].join('|');
}

function buildReturnScenarioNotes(snapshot = {}) {
  return [
    t('transport.booking.returnNotes.title', '[Return trip passengers & extras]'),
    `${t('transport.booking.returnNotes.passengers', 'Passengers')}: ${Math.max(1, toNonNegativeInt(snapshot?.passengers, 1))}`,
    `${t('transport.booking.returnNotes.bags', 'Small backpacks')}: ${toNonNegativeInt(snapshot?.bags, 0)}`,
    `${t('transport.booking.returnNotes.oversizeBags', 'Large bags (15kg+)')}: ${toNonNegativeInt(snapshot?.oversizeBags, 0)}`,
    `${t('transport.booking.returnNotes.childSeats', 'Child seats')}: ${toNonNegativeInt(snapshot?.childSeats, 0)}`,
    `${t('transport.booking.returnNotes.boosterSeats', 'Booster seats')}: ${toNonNegativeInt(snapshot?.boosterSeats, 0)}`,
    `${t('transport.booking.returnNotes.waitingMinutes', 'Driver waiting (minutes)')}: ${toNonNegativeInt(snapshot?.waitingMinutes, 0)}`,
  ].join('\n');
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
    coupon_id: quote?.couponId || null,
    coupon_code: quote?.couponCode || null,
    coupon_discount_amount: round2(toNonNegativeNumber(quote?.couponDiscountAmount, 0)),
    coupon_partner_id: quote?.couponPartnerId || null,
    coupon_partner_commission_bps: Number.isFinite(Number(quote?.couponPartnerCommissionBps))
      ? Number(quote.couponPartnerCommissionBps)
      : null,
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

    const outboundScenarioSnapshot = getScenarioSnapshotForBooking(outboundLeg?.quote?.scenario || {});
    const returnScenarioSnapshot = getScenarioSnapshotForBooking(returnQuote?.scenario || {});
    if (scenarioSnapshotKey(outboundScenarioSnapshot) !== scenarioSnapshotKey(returnScenarioSnapshot)) {
      const baseNotes = String(payload.notes || '').trim();
      const returnNotes = buildReturnScenarioNotes(returnScenarioSnapshot);
      payload.notes = baseNotes ? `${baseNotes}\n\n${returnNotes}` : returnNotes;
    }
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
  if (els.returnPassengersInput) els.returnPassengersInput.value = '2';
  if (els.returnBagsInput) els.returnBagsInput.value = '2';
  if (els.returnOversizeBagsInput) els.returnOversizeBagsInput.value = '0';
  if (els.returnChildSeatsInput) els.returnChildSeatsInput.value = '0';
  if (els.returnBoosterSeatsInput) els.returnBoosterSeatsInput.value = '0';
  if (els.returnWaitingMinutesInput) els.returnWaitingMinutesInput.value = '0';
  if (els.returnSameExtrasCheckbox instanceof HTMLInputElement) {
    els.returnSameExtrasCheckbox.checked = true;
  }
  if (els.quoteReviewCheckbox instanceof HTMLInputElement) {
    els.quoteReviewCheckbox.checked = false;
  }

  clearAppliedCoupon({ clearInput: true, silent: true });
  setCouponStatus('', 'info');

  syncReturnLegVisibility({ force: false });
  void prefillCustomerFromSession();
}

async function handleSubmit(event) {
  event.preventDefault();

  if (!(els.submitButton instanceof HTMLButtonElement)) return;

  if (!state.activeRoute) {
    setStatus(t('transport.booking.submit.error.selectRouteFirst', 'Select an available route first.'), 'error');
    return;
  }

  const quote = refreshQuote();
  if (!quote || !state.activeRoute) {
    return;
  }

  if (!quote.isBookable || !Array.isArray(quote.legs) || !quote.legs.length) {
    setStatus(t('transport.booking.submit.error.completeRouteBeforeSubmit', 'Complete route settings before submitting booking.'), 'error');
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
    setStatus(t('transport.booking.submit.error.capacityExceeded', 'Passengers or total luggage exceed route limits. Please adjust before submitting.'), 'error');
    updateSubmitState();
    return;
  }

  const couponCode = getCouponCodeInputValue();
  const appliedCouponCode = normalizeCouponCodeInput(state.coupon?.applied?.couponCode || '');
  if (couponCode && couponCode !== appliedCouponCode) {
    const applied = await applyCouponForCurrentQuote({ code: couponCode });
    if (!applied || !state.lastQuote) {
      updateSubmitState();
      return;
    }
  }

  const latestQuote = state.lastQuote || quote;
  const payload = buildTransportBookingPayload(latestQuote);
  if (!payload) {
    setStatus(t('transport.booking.submit.error.preparePayloadFailed', 'Failed to prepare booking payload. Please refresh and try again.'), 'error');
    updateSubmitState();
    return;
  }

  const initialButtonText = els.submitButton.textContent || t('transport.booking.submit.button', 'Reserve transport');
  els.submitButton.disabled = true;
  els.submitButton.textContent = t('transport.booking.submit.sending', 'Sending booking...');

  try {
    let data = null;
    let submitError = null;
    let insertPayload = { ...payload };
    const strippedColumns = [];
    const isRoundTrip = Array.isArray(latestQuote?.legs) && latestQuote.legs.length > 1;
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
      throw new Error(
        t(
          'transport.booking.submit.error.roundTripSchemaRequired',
          'Round-trip booking requires latest transport schema. Run migration "120_transport_round_trip_columns_schema_cache_fix.sql" and refresh this page.',
        ),
      );
    }

    if (submitError) throw submitError;

    const rows = Array.isArray(data) ? data : [];
    const shortIds = rows
      .map((row) => String(row?.id || '').trim())
      .filter(Boolean)
      .map((id) => id.slice(0, 8).toUpperCase());
    const isRoundTripSuccess = latestQuote.legs.length > 1;
    const firstId = shortIds[0] || '--------';
    const strippedColumnsHint = strippedColumns.length
      ? `<div style="margin-top:6px; font-size:12px; opacity:0.85;">${escapeHtml(t(
        'transport.booking.submit.success.compatibilityHint',
        'Saved with compatibility mode (missing optional schema columns: {{columns}}).',
        { columns: strippedColumns.join(', ') },
      ))}</div>`
      : '';

    if (els.submitSuccess) {
      els.submitSuccess.hidden = false;
      if (isRoundTripSuccess) {
        els.submitSuccess.innerHTML = t(
          'transport.booking.submit.success.roundTrip',
          'Round-trip booking <strong>#{{id}}</strong> was sent successfully. Total: <strong>{{total}}</strong>.',
          {
            id: escapeHtml(firstId),
            total: escapeHtml(money(latestQuote.total, latestQuote.currency)),
          },
        ) + strippedColumnsHint;
      } else {
        els.submitSuccess.innerHTML = t(
          'transport.booking.submit.success.oneWay',
          'Booking request <strong>#{{id}}</strong> was sent successfully. Total: <strong>{{total}}</strong>. We will contact you shortly.',
          {
            id: escapeHtml(firstId),
            total: escapeHtml(money(latestQuote.total, latestQuote.currency)),
          },
        ) + strippedColumnsHint;
      }
    }

    if (isRoundTripSuccess) {
      notify(
        t('transport.booking.submit.toast.roundTripCreated', 'Round-trip transport booking #{{id}} created', {
          id: firstId,
        }),
        'success',
      );
    } else {
      notify(
        t('transport.booking.submit.toast.oneWayCreated', 'Transport booking #{{id}} created', {
          id: firstId,
        }),
        'success',
      );
    }
    setStatus(t('transport.booking.submit.success.status', 'Booking submitted successfully. We will review and confirm shortly.'), 'info');
    resetAfterSubmit();
    refreshQuote();
    dispatchTransportEvent('ce:transport:booking-submitted', {
      bookingId: firstId,
      isRoundTrip: isRoundTripSuccess,
      total: round2(toNonNegativeNumber(latestQuote?.total, 0)),
      currency: String(latestQuote?.currency || 'EUR').trim().toUpperCase() || 'EUR',
    });
  } catch (error) {
    console.error('Failed to create transport booking:', error);
    const message = String(error?.message || t('transport.booking.submit.error.submitFailed', 'Failed to submit booking request.'));
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
    els.returnPassengersInput,
    els.returnBagsInput,
    els.returnOversizeBagsInput,
    els.returnChildSeatsInput,
    els.returnBoosterSeatsInput,
    els.returnWaitingMinutesInput,
  ].filter(Boolean);

  quoteInputs.forEach((input) => {
    const onQuoteInputChange = () => {
      if (isRoundTripSelected() && isReturnUsingSameExtras()) {
        syncReturnExtrasFromOutbound({ force: true });
      }
      invalidateAppliedCouponAfterQuoteChange();
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

  if (els.returnSameExtrasCheckbox instanceof HTMLInputElement) {
    els.returnSameExtrasCheckbox.addEventListener('change', () => {
      syncReturnExtrasVisibility({ force: true, switchedFromOneWay: false });
      resetQuoteReviewConfirmation();
      refreshQuote();
    });
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
      const quotePanel = byId('transportQuotePanel') || document.querySelector('.transport-quote');
      if (quotePanel && typeof quotePanel.scrollIntoView === 'function') {
        quotePanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  if (els.form instanceof HTMLFormElement) {
    els.form.addEventListener('submit', handleSubmit);
  }

  if (els.couponCodeInput instanceof HTMLInputElement) {
    const onCouponInput = () => {
      const normalized = normalizeCouponCodeInput(els.couponCodeInput.value);
      if (els.couponCodeInput.value !== normalized) {
        els.couponCodeInput.value = normalized;
      }
      const appliedCode = normalizeCouponCodeInput(state.coupon?.applied?.couponCode || '');
      if (appliedCode && normalized !== appliedCode) {
        state.coupon.applied = null;
        applyCurrentQuoteDecorationAndRender();
      }
      if (!normalized) {
        setCouponStatus('', 'info');
      }
      syncCouponControls();
    };

    els.couponCodeInput.addEventListener('input', onCouponInput);
    els.couponCodeInput.addEventListener('change', onCouponInput);
    els.couponCodeInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void applyCouponForCurrentQuote();
      }
    });
  }

  if (els.couponApplyButton instanceof HTMLButtonElement) {
    els.couponApplyButton.addEventListener('click', handleApplyCouponClick);
  }
  if (els.couponClearButton instanceof HTMLButtonElement) {
    els.couponClearButton.addEventListener('click', handleClearCouponClick);
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
  els.returnExtrasMode = byId('transportReturnExtrasMode');
  els.returnSameExtrasCheckbox = byId('transportReturnSameExtras');
  els.returnExtrasSection = byId('transportReturnExtrasSection');
  els.returnPassengersInput = byId('transportReturnPassengers');
  els.returnBagsInput = byId('transportReturnBags');
  els.returnOversizeBagsInput = byId('transportReturnOversizeBags');
  els.returnChildSeatsInput = byId('transportReturnChildSeats');
  els.returnBoosterSeatsInput = byId('transportReturnBoosterSeats');
  els.returnWaitingMinutesInput = byId('transportReturnWaitingMinutes');
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
  els.quoteRowCoupon = byId('transportQuoteRowCoupon');
  els.quoteDepositNotice = byId('transportDepositNotice');
  els.quoteOutbound = byId('transportQuoteOutbound');
  els.quoteReturn = byId('transportQuoteReturn');
  els.quoteBase = byId('transportQuoteBase');
  els.quotePassengers = byId('transportQuotePassengers');
  els.quoteBags = byId('transportQuoteBags');
  els.quoteOversize = byId('transportQuoteOversize');
  els.quoteSeats = byId('transportQuoteSeats');
  els.quoteWaiting = byId('transportQuoteWaiting');
  els.quoteCoupon = byId('transportQuoteCoupon');
  els.quoteDeposit = byId('transportQuoteDeposit');
  els.quoteRemainingDue = byId('transportQuoteRemainingDue');
  els.quoteTotal = byId('transportQuoteTotal');
  els.quoteWarnings = byId('transportQuoteWarnings');
  els.couponCodeInput = byId('transportCouponCode');
  els.couponApplyButton = byId('transportApplyCoupon');
  els.couponClearButton = byId('transportClearCoupon');
  els.couponStatus = byId('transportCouponStatus');
}

function exposeTransportBookingApi() {
  if (typeof window === 'undefined') return;
  window.CE_TRANSPORT_BOOKING = {
    isReady: () => Boolean(els.form),
    refreshQuote: () => refreshQuote(),
    updateSubmitState: () => updateSubmitState(),
    syncReturnLegVisibility: (options = {}) => syncReturnLegVisibility(options),
    isRoundTripSelected: () => isRoundTripSelected(),
    getLastQuote: () => state.lastQuote,
    getActiveRoute: () => state.activeRoute,
    getActiveReturnRoute: () => state.activeReturnRoute,
    getStateSnapshot: () => ({
      hasRoute: Boolean(state.activeRoute),
      hasReturnRoute: Boolean(state.activeReturnRoute),
      lastQuote: state.lastQuote || null,
      isRoundTrip: isRoundTripSelected(),
    }),
  };
}

async function initTransportBookingPage() {
  initElements();
  exposeTransportBookingApi();
  if (!els.form) return;

  if (!state.languageListenerBound) {
    document.addEventListener('wakacjecypr:languagechange', () => {
      populateLocationSelects();
      syncTransportContactRequirements();
      refreshQuote();
      updateSubmitState();
    });
    state.languageListenerBound = true;
  }

  setDefaultTravelDateTime();
  bindInputs();
  syncReturnLegVisibility({ force: false });
  clearQuoteView();
  clearAppliedCoupon({ clearInput: true, silent: true });
  setCouponStatus('', 'info');
  syncCouponControls();
  updateSubmitState();

  try {
    await loadTransportCatalog();
    syncReturnLegVisibility({ force: false });
    await prefillCustomerFromSession();
  } catch (error) {
    console.error('Failed to initialize transport booking page:', error);
    const message = String(error?.message || t('transport.booking.status.catalogLoadFailed', 'Failed to load transport catalog.'));
    setStatus(message, 'error');
    notify(message, 'error');
  }

  refreshQuote();
}

document.addEventListener('DOMContentLoaded', () => {
  void initTransportBookingPage();
});
