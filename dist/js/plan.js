import { showToast } from './toast.js';

let sb = typeof window !== 'undefined' && typeof window.getSupabase === 'function' ? window.getSupabase() : null;

async function ensureSupabase({ timeoutMs = 5000, stepMs = 100 } = {}) {
  if (sb) return sb;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (typeof window !== 'undefined' && typeof window.getSupabase === 'function') {
      sb = window.getSupabase();
      if (sb) return sb;
    }
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return null;
}

async function waitForAuthReadySafe({ timeoutMs = 4500 } = {}) {
  try {
    const fn = typeof window !== 'undefined' ? window.waitForAuthReady : null;
    if (typeof fn !== 'function') return null;

    const timeout = new Promise((resolve) => {
      window.setTimeout(() => resolve(null), timeoutMs);
    });
    return await Promise.race([Promise.resolve(fn()), timeout]);
  } catch (_) {
    return null;
  }
}

function formHasCars(fd) {
  const has = String(fd.get('has_cars') || '').trim();
  return !!has;
}

const el = (id) => document.getElementById(id);

const planListEl = () => el('planList');
const createStatusEl = () => el('planCreateStatus');

const emptyStateEl = () => el('planEmptyState');
const detailsWrapEl = () => el('planDetails');
const daysEl = () => el('planDays');
const catalogDaySelectEl = () => el('planCatalogDaySelect');
const catalogEl = () => el('planCatalog');
const costSummaryEl = () => el('planCostSummary');
const requestBookingBtnEl = () => el('planRequestBookingBtn');
const requestBookingStatusEl = () => el('planRequestBookingStatus');

const saveStatusEl = () => el('planSaveStatus');

let currentPlan = null;
let dayItemsByDayId = new Map();
let planDaysById = new Map();
let catalogActiveTab = 'trips';
let catalogSearch = '';
let catalogData = {
  trips: [],
  hotels: [],
  cars: [],
  pois: [],
};
let catalogLoadedForPlanId = null;
let catalogLangWired = false;

function safeUuid() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch (_) {}
  return `r_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

async function waitForPlacesData({ timeoutMs = 1200, stepMs = 100 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (Array.isArray(window.PLACES_DATA) && window.PLACES_DATA.length) return true;
    if (window.PLACES_DATA_LOADED === true) return Array.isArray(window.PLACES_DATA) && window.PLACES_DATA.length;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return Array.isArray(window.PLACES_DATA) && window.PLACES_DATA.length;
}

async function loadPoisForCatalog() {
  const ok = await waitForPlacesData({ timeoutMs: 1500, stepMs: 150 });
  if (ok) return { data: window.PLACES_DATA, error: null };

  if (!sb) return { data: [], error: null };
  return sb.from('pois').select('*').eq('status', 'published').order('created_at', { ascending: false }).range(0, 199);
}

function formatPlanLabel(plan) {
  const title = (plan?.title || '').trim() || 'Untitled plan';
  const start = plan?.start_date ? String(plan.start_date) : '';
  const end = plan?.end_date ? String(plan.end_date) : '';
  const range = start && end ? `${start} → ${end}` : (start || end);
  return range ? `${title} · ${range}` : title;
}

function setStatus(targetEl, msg, type) {
  if (!(targetEl instanceof HTMLElement)) return;
  targetEl.textContent = msg || '';
  if (type) {
    targetEl.dataset.tone = type;
  } else {
    delete targetEl.dataset.tone;
  }
}

function formatMoney(amount, currency = 'EUR') {
  const a = Number(amount || 0);
  const c = String(currency || 'EUR').toUpperCase();
  if (!Number.isFinite(a)) return `${c} 0.00`;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(a);
  } catch (_) {
    return `${c} ${a.toFixed(2)}`;
  }
}

function partyStorageKey(planId) {
  return planId ? `ce_plan_party_${planId}` : 'ce_plan_party_';
}

function getPartyForPlan(plan) {
  const planId = plan?.id ? String(plan.id) : '';
  const people = Math.max(1, Number(plan?.people_count || 1) || 1);
  if (!planId) return { adults: people, children: 0 };

  try {
    const raw = localStorage.getItem(partyStorageKey(planId));
    const parsed = raw ? JSON.parse(raw) : null;
    const a = Math.max(0, Number(parsed?.adults || 0) || 0);
    const c = Math.max(0, Number(parsed?.children || 0) || 0);
    if (a + c > 0) return { adults: a, children: c };
  } catch (_) {}

  return { adults: people, children: 0 };
}

function savePartyForPlan(planId, party) {
  if (!planId) return;
  const a = Math.max(0, Number(party?.adults || 0) || 0);
  const c = Math.max(0, Number(party?.children || 0) || 0);
  try {
    localStorage.setItem(partyStorageKey(String(planId)), JSON.stringify({ adults: a, children: c }));
  } catch (_) {}
}

function parseHashPlanId() {
  const hash = String(window.location.hash || '').trim();
  const m = hash.match(/^#plan:([0-9a-fA-F-]{36})$/);
  return m ? m[1] : null;
}

function setHashPlanId(id) {
  if (!id) {
    if (window.location.hash) window.location.hash = '';
    return;
  }
  window.location.hash = `plan:${id}`;
}

async function getCurrentUser() {
  if (!sb) return null;

  await waitForAuthReadySafe();
  try {
    const stateUser = window?.CE_STATE?.session?.user || null;
    if (stateUser) return stateUser;
  } catch (_) {}

  for (let i = 0; i < 6; i += 1) {
    const { data, error } = await sb.auth.getSession();
    if (!error && data?.session?.user) return data.session.user;
    await new Promise((r) => setTimeout(r, 120));
  }
  return null;
}

function daysBetweenInclusive(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000);
  if (!Number.isFinite(diffDays) || diffDays < 0) return null;
  return diffDays + 1;
}

function addDays(dateStr, offsetDays) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + offsetDays);
  const iso = d.toISOString().slice(0, 10);
  return iso;
}

function currentLang() {
  const lang = (window.appI18n && window.appI18n.language) || document.documentElement.lang || 'pl';
  return String(lang || 'pl');
}

function pickI18nValue(i18nObj, fallback) {
  if (!i18nObj || typeof i18nObj !== 'object') return fallback || '';
  const lang = currentLang();
  return i18nObj[lang] || i18nObj.en || i18nObj.pl || fallback || '';
}

function normalizeStr(v) {
  return String(v || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function cityMatches(a, b) {
  const aa = normalizeStr(a);
  const bb = normalizeStr(b);
  if (!aa || !bb) return false;
  return aa === bb || aa.includes(bb) || bb.includes(aa);
}

function cityToCarLocation(city) {
  const c = normalizeStr(city);
  if (!c) return null;
  if (c.includes('paphos') || c.includes('pafos') || c.includes('πάφος')) return 'paphos';
  if (c.includes('larnaca') || c.includes('larnaka') || c.includes('lάρνακα')) return 'larnaca';
  if (c.includes('ayia napa') || c.includes('agia napa') || c.includes('napa')) return 'larnaca';
  if (c.includes('protaras') || c.includes('paralimni')) return 'larnaca';
  return null;
}

function getCatalogContext() {
  const selectedDayId = getCatalogSelectedDayId();
  const day = selectedDayId ? planDaysById.get(selectedDayId) : null;
  const city = (day?.city || currentPlan?.base_city || '').trim();
  const includeNorth = !!currentPlan?.include_north;
  const carLocation = cityToCarLocation(city) || cityToCarLocation(currentPlan?.base_city);
  return {
    selectedDayId,
    city,
    includeNorth,
    carLocation,
  };
}

function getTripTitle(trip) {
  if (typeof window.getTripName === 'function') return window.getTripName(trip);
  return trip?.title?.pl || trip?.title?.en || trip?.title || trip?.slug || 'Trip';
}

function getHotelTitle(hotel) {
  if (typeof window.getHotelName === 'function') return window.getHotelName(hotel);
  return hotel?.title?.pl || hotel?.title?.en || hotel?.title || hotel?.slug || 'Hotel';
}

function getHotelCity(hotel) {
  if (!hotel || typeof hotel !== 'object') return '';
  const raw =
    hotel.city_i18n ||
    hotel.location_i18n ||
    hotel.town_i18n ||
    hotel.area_i18n ||
    hotel.destination_i18n ||
    hotel.city ||
    hotel.location ||
    hotel.town ||
    hotel.area ||
    hotel.destination ||
    (hotel.address && typeof hotel.address === 'object' ? hotel.address.city : '') ||
    '';

  if (raw && typeof raw === 'object') {
    const picked = pickI18nValue(raw, '');
    return String(picked || '').trim();
  }
  return String(raw || '').trim();
}

function isUuid(v) {
  const s = String(v || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function getCarTitle(car) {
  if (typeof window.getCarName === 'function') return window.getCarName(car);
  return car?.car_model || car?.car_type || 'Car';
}

function getPoiTitle(poi) {
  const name = pickI18nValue(poi?.name_i18n, poi?.name || 'POI');
  return name || 'POI';
}

function calcTripTotal(trip, { adults = 1, children = 0, hours = 1, days = 1 } = {}) {
  adults = Number(adults || 0) || 0;
  children = Number(children || 0) || 0;
  hours = Number(hours || 0) || 0;
  days = Number(days || 0) || 0;

  const pm = trip?.pricing_model || 'per_person';
  if (pm === 'per_person') {
    const per = Number(trip?.price_per_person || 0) || 0;
    return per * (adults + children);
  }
  if (pm === 'base_plus_extra') {
    const base = Number(trip?.price_base || 0) || 0;
    const included = Number(trip?.included_people || 0) || 0;
    const extra = Number(trip?.price_extra_person || 0) || 0;
    const totalPeople = adults + children;
    const extraPeople = Math.max(0, totalPeople - included);
    return base + extraPeople * extra;
  }
  if (pm === 'per_hour') {
    const hourly = Number(trip?.price_base || trip?.hourly_rate || 0) || 0;
    const minH = Number(trip?.min_hours || 1) || 1;
    const billable = Math.max(minH, hours || 0);
    return billable * hourly;
  }
  if (pm === 'per_day') {
    const daily = Number(trip?.price_base || trip?.daily_rate || 0) || 0;
    const billableDays = Math.max(1, days || 0);
    return billableDays * daily;
  }
  return Number(trip?.price_base || 0) || Number(trip?.price_per_person || 0) || 0;
}

function calculateHotelPrice(hotel, persons, nights) {
  const model = hotel?.pricing_model || 'per_person_per_night';
  const tiers = hotel?.pricing_tiers?.rules || [];
  if (!tiers.length) return { total: 0, pricePerNight: 0, billableNights: nights, tier: null };

  persons = Number(persons) || 1;
  nights = Number(nights) || 1;

  const findTierByPersons = () => {
    let rule = tiers.find((r) => Number(r.persons) === persons);
    if (rule) return rule;
    const lowers = tiers.filter((r) => Number(r.persons) <= persons);
    if (lowers.length) {
      return lowers.sort((a, b) => Number(b.persons) - Number(a.persons))[0];
    }
    return null;
  };

  const findBestTierByNights = () => {
    const matching = tiers
      .filter((r) => !r.min_nights || Number(r.min_nights) <= nights)
      .sort((a, b) => (Number(b.min_nights) || 0) - (Number(a.min_nights) || 0));
    return matching[0] || tiers[0];
  };

  const findBestTierByPersonsAndNights = () => {
    let personTiers = tiers.filter((r) => Number(r.persons) === persons);
    if (!personTiers.length) {
      const lowers = tiers.filter((r) => Number(r.persons) <= persons);
      if (lowers.length) {
        const maxPersons = Math.max(...lowers.map((r) => Number(r.persons)));
        personTiers = lowers.filter((r) => Number(r.persons) === maxPersons);
      }
    }
    if (!personTiers.length) return null;
    const matching = personTiers
      .filter((r) => !r.min_nights || Number(r.min_nights) <= nights)
      .sort((a, b) => (Number(b.min_nights) || 0) - (Number(a.min_nights) || 0));
    return matching[0] || personTiers[0];
  };

  let rule = null;
  switch (model) {
    case 'flat_per_night':
      rule = findBestTierByNights();
      break;
    case 'tiered_by_nights':
      rule = findBestTierByPersonsAndNights();
      break;
    case 'per_person_per_night':
    case 'category_per_night':
    default:
      rule = findTierByPersons();
      break;
  }

  if (!rule) {
    rule = tiers.sort((a, b) => Number(a.price_per_night) - Number(b.price_per_night))[0];
  }

  const pricePerNight = Number(rule.price_per_night || 0);
  const minNights = Number(rule.min_nights || 0);
  const billableNights = minNights ? Math.max(minNights, nights) : nights;
  const total = billableNights * pricePerNight;
  return { total, pricePerNight, billableNights, tier: rule };
}

function calcCarTotal(carOffer, { location, days } = {}) {
  const loc = String(location || carOffer?.location || '').toLowerCase();
  const d = Math.max(1, Number(days || 0) || 1);
  const billableDays = Math.max(3, d);

  if (loc === 'paphos') {
    const p3 = Number(carOffer?.price_3days || 0) || 0;
    if (billableDays === 3 && p3 > 0) return p3;

    let rate = Number(carOffer?.price_4_6days || 0) || 0;
    if (billableDays >= 7 && billableDays <= 10) rate = Number(carOffer?.price_7_10days || 0) || rate;
    if (billableDays >= 10) rate = Number(carOffer?.price_10plus_days || 0) || rate;
    if (!rate) rate = Number(carOffer?.price_per_day || 0) || 0;
    return (Number(rate) || 0) * billableDays;
  }

  const perDay =
    Number(carOffer?.price_per_day || 0) ||
    Number(carOffer?.price_10plus_days || 0) ||
    Number(carOffer?.price_7_10days || 0) ||
    Number(carOffer?.price_4_6days || 0) ||
    0;
  return perDay * billableDays;
}

function getHotelMinPricePerNight(hotel) {
  const rules = hotel?.pricing_tiers?.rules || [];
  if (!rules.length) return null;
  let min = Infinity;
  rules.forEach((r) => {
    const p = Number(r?.price_per_night);
    if (Number.isFinite(p) && p < min) min = p;
  });
  return Number.isFinite(min) ? min : null;
}

function getCarFromPricePerDay(carOffer) {
  const loc = String(carOffer?.location || '').toLowerCase();
  if (loc === 'paphos') {
    const from = Number(carOffer?.price_10plus_days || carOffer?.price_per_day || 0) || 0;
    return from || null;
  }
  const from =
    Number(carOffer?.price_per_day || 0) ||
    Number(carOffer?.price_10plus_days || 0) ||
    Number(carOffer?.price_7_10days || 0) ||
    Number(carOffer?.price_4_6days || 0) ||
    null;
  return from;
}

function computePlanCostSummary() {
  const currency = (currentPlan?.currency || 'EUR').toUpperCase();
  const party = getPartyForPlan(currentPlan);
  const people = Math.max(1, Number(currentPlan?.people_count || (party.adults + party.children) || 1) || 1);

  let tripsTotal = 0;
  let hotelsTotal = 0;
  let carsTotal = 0;

  const byRange = new Map();
  const allItems = [];
  dayItemsByDayId.forEach((items) => {
    (Array.isArray(items) ? items : []).forEach((it) => {
      if (!it || !it.item_type || it.item_type === 'note' || it.item_type === 'poi') return;
      allItems.push(it);
    });
  });

  allItems.forEach((it) => {
    const d = it?.data && typeof it.data === 'object' ? it.data : {};
    const rangeId = d.range_id ? String(d.range_id) : '';
    if (rangeId) {
      if (!byRange.has(rangeId)) byRange.set(rangeId, it);
      return;
    }

    if (it.item_type === 'trip') {
      const ref = catalogData.trips.find((t) => String(t?.id) === String(it.ref_id)) || null;
      tripsTotal += calcTripTotal(ref || {}, { adults: party.adults, children: party.children, hours: 1, days: 1 });
    }
  });

  byRange.forEach((it) => {
    const d = it?.data && typeof it.data === 'object' ? it.data : {};
    const start = Number(d.range_start_day_index || 0) || 0;
    const end = Number(d.range_end_day_index || 0) || 0;
    const days = start > 0 && end > 0 ? Math.max(1, Math.abs(end - start) + 1) : 1;

    if (it.item_type === 'hotel') {
      const ref = catalogData.hotels.find((h) => String(h?.id) === String(it.ref_id)) || null;
      const nights = Math.max(1, days - 1);
      const res = calculateHotelPrice(ref || {}, people, nights);
      hotelsTotal += Number(res.total || 0) || 0;
      return;
    }

    if (it.item_type === 'car') {
      const ref = catalogData.cars.find((c) => String(c?.id) === String(it.ref_id)) || null;
      carsTotal += calcCarTotal(ref || {}, { location: ref?.location, days });
    }
  });

  const total = tripsTotal + hotelsTotal + carsTotal;
  return {
    currency,
    people,
    tripsTotal,
    hotelsTotal,
    carsTotal,
    total,
  };
}

function renderPlanCostSummary() {
  const wrap = costSummaryEl();
  if (!wrap) return;
  if (!currentPlan?.id) {
    wrap.innerHTML = '<div style="color:#64748b;">Select a plan and add services to see totals.</div>';
    return;
  }

  const s = computePlanCostSummary();
  wrap.innerHTML = `
    <div style="display:flex; justify-content:space-between; gap:0.75rem;"><span style="color:#64748b;">Trips</span><strong>${escapeHtml(formatMoney(s.tripsTotal, s.currency))}</strong></div>
    <div style="display:flex; justify-content:space-between; gap:0.75rem;"><span style="color:#64748b;">Cars</span><strong>${escapeHtml(formatMoney(s.carsTotal, s.currency))}</strong></div>
    <div style="display:flex; justify-content:space-between; gap:0.75rem;"><span style="color:#64748b;">Accommodation</span><strong>${escapeHtml(formatMoney(s.hotelsTotal, s.currency))}</strong></div>
    <div style="border-top:1px solid #e2e8f0; margin-top:0.25rem; padding-top:0.5rem; display:flex; justify-content:space-between; gap:0.75rem;">
      <span style="color:#0f172a; font-weight:700;">Total</span>
      <span style="color:#0f172a; font-weight:800;">${escapeHtml(formatMoney(s.total, s.currency))}</span>
    </div>
    <div style="color:#64748b; font-size:12px;">People: ${escapeHtml(String(s.people))}. Hotels: nights = (range days − 1). Cars: minimum 3 days.</div>
  `;
}

function getCarLink(car) {
  const location = String(car?.location || '').toLowerCase();
  if (location === 'paphos') return 'autopfo.html';
  if (location === 'larnaca') return 'car-rental.html';
  return 'car-rental-landing.html';
}

function getServiceTypeLabel(type) {
  if (type === 'trip') return 'Trip';
  if (type === 'hotel') return 'Hotel';
  if (type === 'car') return 'Car';
  if (type === 'poi') return 'Place';
  return type || 'Item';
}

async function loadServiceCatalog(planId) {
  if (!sb) return;
  if (!planId) {
    const wrap = catalogEl();
    if (wrap) wrap.innerHTML = '';
    catalogLoadedForPlanId = null;
    return;
  }

  if (catalogLoadedForPlanId === planId && (catalogData.trips.length || catalogData.hotels.length || catalogData.cars.length || catalogData.pois.length)) {
    renderServiceCatalog();
    return;
  }

  const wrap = catalogEl();
  if (wrap) {
    wrap.innerHTML = '<div style="color:#64748b;">Loading services…</div>';
  }

  if (!catalogLangWired) {
    window.addEventListener('languageChanged', () => {
      renderServiceCatalog();
    });
    catalogLangWired = true;
  }

  const loadTrips = async () => {
    let res = await sb
      .from('trips')
      .select('*')
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .range(0, 99);
    if (res?.error && String(res.error.message || '').toLowerCase().includes('sort_order')) {
      res = await sb
        .from('trips')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .range(0, 99);
    }
    return res;
  };

  const loadHotels = async () => {
    let res = await sb
      .from('hotels')
      .select('*')
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .range(0, 99);
    if (res?.error && String(res.error.message || '').toLowerCase().includes('sort_order')) {
      res = await sb
        .from('hotels')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .range(0, 99);
    }
    return res;
  };

  const loadCars = async () => {
    let res = await sb
      .from('car_offers')
      .select('*')
      .eq('is_available', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .range(0, 99);
    if (res?.error && String(res.error.message || '').toLowerCase().includes('sort_order')) {
      res = await sb
        .from('car_offers')
        .select('*')
        .eq('is_available', true)
        .order('created_at', { ascending: false })
        .range(0, 99);
    }
    return res;
  };

  const [tripsRes, hotelsRes, carsRes, poisRes] = await Promise.all([loadTrips(), loadHotels(), loadCars(), loadPoisForCatalog()]);

  if (tripsRes.error) console.warn('Failed to load trips catalog', tripsRes.error);
  if (hotelsRes.error) console.warn('Failed to load hotels catalog', hotelsRes.error);
  if (carsRes.error) console.warn('Failed to load cars catalog', carsRes.error);
  if (poisRes.error) console.warn('Failed to load POI catalog', poisRes.error);

  catalogData = {
    trips: Array.isArray(tripsRes.data) ? tripsRes.data : [],
    hotels: Array.isArray(hotelsRes.data) ? hotelsRes.data : [],
    cars: Array.isArray(carsRes.data) ? carsRes.data : [],
    pois: Array.isArray(poisRes.data) ? poisRes.data : [],
  };
  catalogLoadedForPlanId = planId;
  renderServiceCatalog();
}

function getCatalogSelectedDayId() {
  const sel = catalogDaySelectEl();
  return sel instanceof HTMLSelectElement ? sel.value : '';
}

async function addServiceItemToDay({ dayId, itemType, refId, data }) {
  if (!sb) return;
  if (!dayId) {
    showToast('Select a day first.', 'info');
    return;
  }
  if (!itemType) return;

  const safeRefId = isUuid(refId) ? String(refId) : null;
  const payloadData = data && typeof data === 'object' ? { ...data } : null;
  if (payloadData && safeRefId === null && refId != null && String(refId).trim()) {
    payloadData.source_id = String(refId);
  }

  const payload = {
    plan_day_id: dayId,
    item_type: itemType,
    ref_id: safeRefId,
    data: payloadData,
    sort_order: Math.floor(Date.now() / 1000),
  };

  const { error } = await sb
    .from('user_plan_items')
    .insert([payload]);

  if (error) {
    console.error('Failed to add service item', error);
    showToast(error.message || 'Failed to add item', 'error');
    return;
  }

  await loadPlanDays(currentPlan?.id);

  const label = getServiceTypeLabel(itemType);
  showToast(`${label} added to your plan.`, 'success');
}

async function addServiceRangeToDays({ startDayId, endDayId, itemType, refId, data }) {
  if (!sb) return;
  if (!startDayId || !endDayId) {
    showToast('Select start and end day.', 'info');
    return;
  }
  if (!itemType) return;

  const start = planDaysById.get(startDayId);
  const end = planDaysById.get(endDayId);
  const startIndex = start?.day_index;
  const endIndex = end?.day_index;
  if (!start || !end || !Number.isFinite(Number(startIndex)) || !Number.isFinite(Number(endIndex))) {
    showToast('Invalid day range.', 'error');
    return;
  }

  const min = Math.min(Number(startIndex), Number(endIndex));
  const max = Math.max(Number(startIndex), Number(endIndex));
  const days = Array.from(planDaysById.values()).filter((d) => Number(d?.day_index) >= min && Number(d?.day_index) <= max);
  if (!days.length) {
    showToast('Invalid day range.', 'error');
    return;
  }

  const rangeId = safeUuid();
  const safeRefId = isUuid(refId) ? String(refId) : null;
  const baseData = data && typeof data === 'object' ? { ...data } : {};
  if (safeRefId === null && refId != null && String(refId).trim()) {
    baseData.source_id = String(refId);
  }
  baseData.range_id = rangeId;
  baseData.range_start_day_id = startDayId;
  baseData.range_end_day_id = endDayId;
  baseData.range_start_day_index = min;
  baseData.range_end_day_index = max;

  const payloads = days.map((d) => ({
    plan_day_id: d.id,
    item_type: itemType,
    ref_id: safeRefId,
    data: { ...baseData },
    sort_order: Math.floor(Date.now() / 1000),
  }));

  const { error } = await sb.from('user_plan_items').insert(payloads);
  if (error) {
    console.error('Failed to add range items', error);
    showToast(error.message || 'Failed to add range', 'error');
    return;
  }

  await loadPlanDays(currentPlan?.id);

  const label = getServiceTypeLabel(itemType);
  showToast(`${label} added to your plan (Day ${min}–Day ${max}).`, 'success');
}

async function deleteRangeItems(rangeId) {
  if (!sb || !rangeId) return false;
  const { error } = await sb.from('user_plan_items').delete().contains('data', { range_id: rangeId });
  if (error) {
    console.error('Failed to delete range', error);
    showToast(error.message || 'Failed to delete range', 'error');
    return false;
  }
  return true;
}

function renderServiceCatalog() {
  const wrap = catalogEl();
  if (!wrap) return;

  const ctx = getCatalogContext();

  const dayOptions = Array.from(planDaysById.values())
    .sort((a, b) => Number(a?.day_index || 0) - Number(b?.day_index || 0))
    .map((d) => {
      const label = d?.date ? `Day ${d.day_index} · ${d.date}` : `Day ${d.day_index}`;
      return `<option value="${escapeHtml(d.id)}">${escapeHtml(label)}</option>`;
    })
    .join('');

  const tabBtn = (key, label) => {
    const isActive = catalogActiveTab === key;
    return `<button type="button" class="btn ${isActive ? 'btn-primary primary' : ''}" data-catalog-tab="${key}">${escapeHtml(label)}</button>`;
  };

  const counts = {
    trips: catalogData.trips.length,
    hotels: catalogData.hotels.length,
    cars: catalogData.cars.length,
    pois: catalogData.pois.length,
  };

  const q = catalogSearch.trim().toLowerCase();
  const matches = (text) => {
    if (!q) return true;
    return String(text || '').toLowerCase().includes(q);
  };

  let list = [];
  if (catalogActiveTab === 'trips') {
    list = catalogData.trips
      .map((t) => {
        const title = getTripTitle(t);
        const city = t?.start_city || '';
        const party = getPartyForPlan(currentPlan);
        const total = calcTripTotal(t, { adults: party.adults, children: party.children, hours: 1, days: 1 });
        const price = total ? `${Number(total).toFixed(2)} €` : '';
        const slug = t?.slug || '';
        const url = slug ? `trip.html?slug=${encodeURIComponent(slug)}` : 'trips.html';
        return { id: t?.id, title, subtitle: city, price, url, lat: null, lng: null };
      })
      .filter((x) => (ctx.city ? (!x.subtitle || cityMatches(x.subtitle, ctx.city)) : true))
      .filter((x) => matches(`${x.title} ${x.subtitle}`));
  } else if (catalogActiveTab === 'hotels') {
    list = catalogData.hotels
      .map((h) => {
        const title = getHotelTitle(h);
        const city = getHotelCity(h);
        const min = getHotelMinPricePerNight(h);
        const price = min != null ? `${Number(min).toFixed(2)} € / night` : '';
        const slug = h?.slug || '';
        const url = slug ? `hotel.html?slug=${encodeURIComponent(slug)}` : 'hotels.html';
        return { id: h?.id, title, subtitle: city, price, url, lat: null, lng: null };
      })
      .filter((x) => (ctx.city ? (!x.subtitle || cityMatches(x.subtitle, ctx.city)) : true))
      .filter((x) => matches(`${x.title} ${x.subtitle}`));
  } else if (catalogActiveTab === 'cars') {
    list = catalogData.cars
      .map((c) => {
        const title = getCarTitle(c);
        const location = c?.location || '';
        const url = getCarLink(c);
        const north = c?.north_allowed ? 'north ok' : '';
        const from = getCarFromPricePerDay(c);
        const price = from != null ? `From ${Number(from).toFixed(0)}€ / day` : '';
        return { id: c?.id, title, subtitle: [location, north].filter(Boolean).join(' • '), location, price, url, lat: null, lng: null };
      })
      .filter((x) => {
        if (ctx.includeNorth) {
          const ref = catalogData.cars.find((c) => String(c?.id) === String(x.id));
          if (ref && ref.north_allowed === false) return false;
        }
        return true;
      })
      .filter((x) => (ctx.carLocation ? cityMatches(x.location, ctx.carLocation) : true))
      .filter((x) => matches(`${x.title} ${x.subtitle}`));
  } else if (catalogActiveTab === 'pois') {
    list = catalogData.pois
      .map((p) => {
        const title = getPoiTitle(p);
        const url = p?.google_url || p?.google_maps_url || (p?.lat != null && p?.lng != null ? `https://www.google.com/maps?q=${p.lat},${p.lng}` : '');
        return { id: p?.id, title, subtitle: '', price: '', url, lat: p?.lat ?? null, lng: p?.lng ?? null };
      })
      .filter((x) => matches(`${x.title}`));
  }

  const rowsHtml = list.length
    ? `<div style="display:grid; gap:0.5rem;">
        ${list
          .slice(0, 100)
          .map((x) => {
            const addAttr = `data-catalog-add="1" data-item-type="${catalogActiveTab.slice(0, -1)}" data-ref-id="${escapeHtml(x.id || '')}" data-title="${escapeHtml(x.title || '')}" data-subtitle="${escapeHtml(x.subtitle || '')}" data-url="${escapeHtml(x.url || '')}" data-price="${escapeHtml(x.price || '')}"`;
            const poiAttrs = x.lat != null && x.lng != null ? ` data-lat="${escapeHtml(String(x.lat))}" data-lng="${escapeHtml(String(x.lng))}"` : '';
            const link = x.url ? `<a href="${escapeHtml(x.url)}" target="_blank" rel="noopener" class="btn btn-sm">Open</a>` : '';
            const isRange = catalogActiveTab === 'hotels' || catalogActiveTab === 'cars';
            const daySel = dayOptions
              ? (isRange
                ? `<select data-catalog-range-start="1" class="btn btn-sm" style="max-width: 220px;">${dayOptions}</select>
                   <select data-catalog-range-end="1" class="btn btn-sm" style="max-width: 220px;">${dayOptions}</select>`
                : `<select data-catalog-add-day="1" class="btn btn-sm" style="max-width: 220px;">${dayOptions}</select>`)
              : '';
            return `
              <div class="card" style="padding:0.75rem; border:1px solid #e2e8f0; display:flex; gap:0.75rem; align-items:flex-start; justify-content:space-between;">
                <div style="min-width:0;">
                  <div style="font-weight:600;">${escapeHtml(x.title)}</div>
                  ${x.subtitle ? `<div style=\"color:#64748b; font-size:12px;\">${escapeHtml(x.subtitle)}</div>` : ''}
                  ${x.price ? `<div style=\"color:#0f172a; font-size:12px;\">${escapeHtml(x.price)}</div>` : ''}
                </div>
                <div style="display:flex; gap:0.5rem; flex-wrap:wrap; justify-content:flex-end;">
                  ${link}
                  ${daySel}
                  <button type="button" class="btn btn-sm btn-primary primary" ${addAttr}${poiAttrs}>${isRange ? 'Add range' : 'Add'}</button>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>`
    : '<div style="color:#64748b;">No services found.</div>';

  wrap.innerHTML = `
    <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
      ${tabBtn('trips', `Trips (${counts.trips})`)}
      ${tabBtn('hotels', `Hotels (${counts.hotels})`)}
      ${tabBtn('cars', `Cars (${counts.cars})`)}
      ${tabBtn('pois', `Places to see (${counts.pois})`)}
      <div style="flex:1 1 200px;"></div>
      <span style="color:#64748b; font-size:12px;">${escapeHtml(ctx.city || 'All cities')}${ctx.includeNorth ? ' • north' : ''}</span>
      <input id="planCatalogSearch" type="text" value="${escapeHtml(catalogSearch)}" placeholder="Search…" style="max-width:280px;" />
      <button type="button" class="btn" data-catalog-refresh="1">Refresh</button>
    </div>
    <div style="margin-top:0.75rem;">
      ${rowsHtml}
    </div>
  `;

  wrap.querySelectorAll('[data-catalog-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-catalog-tab');
      if (!tab) return;
      catalogActiveTab = tab;
      renderServiceCatalog();
    });
  });

  const searchEl = wrap.querySelector('#planCatalogSearch');
  if (searchEl instanceof HTMLInputElement) {
    searchEl.addEventListener('input', () => {
      catalogSearch = searchEl.value;
      renderServiceCatalog();
    });
  }

  wrap.querySelectorAll('[data-catalog-refresh]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      catalogLoadedForPlanId = null;
      await loadServiceCatalog(currentPlan?.id);
    });
  });

  wrap.querySelectorAll('[data-catalog-add]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('.card');
      const startSel = row ? row.querySelector('[data-catalog-range-start]') : null;
      const endSel = row ? row.querySelector('[data-catalog-range-end]') : null;
      const rowDaySel = row ? row.querySelector('[data-catalog-add-day]') : null;
      const dayId = rowDaySel instanceof HTMLSelectElement ? rowDaySel.value : getCatalogSelectedDayId();
      const type = btn.getAttribute('data-item-type');
      const refId = btn.getAttribute('data-ref-id') || null;
      const title = btn.getAttribute('data-title') || '';
      const subtitle = btn.getAttribute('data-subtitle') || '';
      const url = btn.getAttribute('data-url') || '';
      const price = btn.getAttribute('data-price') || '';
      const latAttr = btn.getAttribute('data-lat');
      const lngAttr = btn.getAttribute('data-lng');
      const lat = latAttr != null && latAttr !== '' ? Number(latAttr) : null;
      const lng = lngAttr != null && lngAttr !== '' ? Number(lngAttr) : null;
      const baseData = { title, subtitle, url, price };
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        baseData.lat = lat;
        baseData.lng = lng;
      }

      if ((type === 'hotel' || type === 'car') && startSel instanceof HTMLSelectElement && endSel instanceof HTMLSelectElement) {
        await addServiceRangeToDays({
          startDayId: startSel.value,
          endDayId: endSel.value,
          itemType: type,
          refId,
          data: baseData,
        });
        return;
      }

      await addServiceItemToDay({ dayId, itemType: type, refId, data: baseData });
    });
  });
}

function getPoiLatLngForItem(it) {
  const d = it?.data && typeof it.data === 'object' ? it.data : null;
  const lat = d && d.lat != null ? Number(d.lat) : null;
  const lng = d && d.lng != null ? Number(d.lng) : null;
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };

  const sourceId = d && d.source_id != null ? String(d.source_id) : null;
  const refId = it?.ref_id != null ? String(it.ref_id) : null;
  const match = catalogData.pois.find((p) => String(p?.id) === String(refId || sourceId));
  if (match && match.lat != null && match.lng != null) {
    const ml = Number(match.lat);
    const mg = Number(match.lng);
    if (Number.isFinite(ml) && Number.isFinite(mg)) return { lat: ml, lng: mg };
  }
  return null;
}

function renderDayMap(dayId, poiItems) {
  try {
    if (typeof L === 'undefined') return;
  } catch (_) {
    return;
  }

  const elMap = document.getElementById(`dayMap_${dayId}`);
  if (!(elMap instanceof HTMLElement)) return;

  const points = (poiItems || []).map(getPoiLatLngForItem).filter(Boolean);
  if (!points.length) {
    elMap.style.display = 'none';
    return;
  }
  elMap.style.display = 'block';

  if (elMap.dataset.inited === '1') return;
  elMap.dataset.inited = '1';

  const first = points[0];
  const map = L.map(elMap, { zoomControl: true, attributionControl: true }).setView([first.lat, first.lng], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
  }).addTo(map);

  const bounds = [];
  for (const p of points) {
    const m = L.marker([p.lat, p.lng]).addTo(map);
    bounds.push([p.lat, p.lng]);
    void m;
  }
  if (bounds.length > 1) {
    map.fitBounds(bounds, { padding: [20, 20] });
  }
}

function setCurrentYear() {
  try {
    document.querySelectorAll('[data-current-year]').forEach((node) => {
      if (node instanceof HTMLElement) {
        node.textContent = String(new Date().getFullYear());
      }
    });
  } catch (_) {}
}

async function fetchPlanItemsForDays(dayIds) {
  if (!sb) return new Map();
  if (!Array.isArray(dayIds) || !dayIds.length) return new Map();

  const { data, error } = await sb
    .from('user_plan_items')
    .select('id,plan_day_id,item_type,ref_id,data,sort_order,estimated_price,currency,created_at')
    .in('plan_day_id', dayIds)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to load plan items', error);
    showToast(error.message || 'Failed to load plan items', 'error');
    return new Map();
  }

  const rows = Array.isArray(data) ? data : [];
  const grouped = new Map();
  for (const row of rows) {
    const key = row.plan_day_id;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  return grouped;
}

async function updateDayField(dayId, patch) {
  if (!sb || !dayId) return null;

  const { data, error } = await sb
    .from('user_plan_days')
    .update(patch)
    .eq('id', dayId)
    .select('id,day_index,date,city,notes')
    .single();

  if (error) {
    console.error('Failed to update day', error);
    showToast(error.message || 'Failed to update day', 'error');
    return null;
  }

  return data;
}

async function addDayNoteItem(planDayId, text) {
  if (!sb || !planDayId) return null;
  const clean = String(text || '').trim();
  if (!clean) return null;

  const payload = {
    plan_day_id: planDayId,
    item_type: 'note',
    data: { text: clean },
    sort_order: 0,
  };

  const { data, error } = await sb
    .from('user_plan_items')
    .insert([payload])
    .select('id,plan_day_id,item_type,ref_id,data,sort_order,estimated_price,currency,created_at')
    .single();

  if (error) {
    console.error('Failed to add note item', error);
    showToast(error.message || 'Failed to add note', 'error');
    return null;
  }
  return data;
}

async function updatePlanItemData(itemId, nextData) {
  if (!sb || !itemId) return null;
  const safe = nextData && typeof nextData === 'object' ? nextData : {};
  const { data, error } = await sb
    .from('user_plan_items')
    .update({ data: safe })
    .eq('id', itemId)
    .select('id,plan_day_id,item_type,ref_id,data,sort_order,estimated_price,currency,created_at')
    .single();

  if (error) {
    console.error('Failed to update plan item', error);
    showToast(error.message || 'Failed to update item', 'error');
    return null;
  }
  return data;
}

function parseTimeToMinutes(t) {
  const s = String(t || '').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Math.max(0, Math.min(23, Number(m[1])));
  const mm = Math.max(0, Math.min(59, Number(m[2])));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

function formatPoiTimeLabel(it) {
  const d = it?.data && typeof it.data === 'object' ? it.data : {};
  const start = String(d.start_time || '').trim();
  const end = String(d.end_time || '').trim();
  if (start && end) return `${start}–${end}`;
  if (start) return start;
  return '';
}

async function deleteDayItem(itemId) {
  if (!sb || !itemId) return false;
  const { error } = await sb
    .from('user_plan_items')
    .delete()
    .eq('id', itemId);

  if (error) {
    console.error('Failed to delete item', error);
    showToast(error.message || 'Failed to delete item', 'error');
    return false;
  }
  return true;
}

async function loadPlans({ selectId } = {}) {
  if (!sb) return;

  const user = await getCurrentUser();
  if (!user) {
    if (planListEl()) planListEl().innerHTML = '';
    currentPlan = null;
    renderPlanDetails(null);
    return;
  }

  const { data, error } = await sb
    .from('user_plans')
    .select('id,title,start_date,end_date,days_count,base_city,include_north,status,created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load plans', error);
    showToast(error.message || 'Failed to load plans', 'error');
    return;
  }

  const plans = Array.isArray(data) ? data : [];
  const list = planListEl();
  if (list) {
    if (!plans.length) {
      list.innerHTML = '<div style="color:#64748b;">No plans yet. Create your first plan above.</div>';
    } else {
      list.innerHTML = plans
        .map((plan) => {
          const label = formatPlanLabel(plan);
          const isActive = currentPlan?.id && plan.id === currentPlan.id;
          return `
            <button
              type="button"
              class="btn ${isActive ? 'btn-primary primary' : ''}"
              data-plan-id="${plan.id}"
              style="text-align:left; width:100%; justify-content:flex-start; white-space:normal;"
            >${escapeHtml(label)}</button>
          `;
        })
        .join('');

      list.querySelectorAll('[data-plan-id]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-plan-id');
          if (id) {
            setHashPlanId(id);
            await selectPlanById(id);
          }
        });
      });
    }
  }

  const desiredId = selectId || parseHashPlanId() || currentPlan?.id || null;
  if (desiredId) {
    const match = plans.find((p) => p.id === desiredId);
    if (match) {
      await selectPlanById(match.id, { skipListReload: true });
      return;
    }
  }

  if (plans.length && !currentPlan) {
    await selectPlanById(plans[0].id, { skipListReload: true });
  }
}

async function selectPlanById(id, { skipListReload = false } = {}) {
  if (!sb || !id) return;

  const { data, error } = await sb
    .from('user_plans')
    .select('id,user_id,title,start_date,end_date,days_count,base_city,include_north,currency,status,people_count,created_at,updated_at')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Failed to load plan', error);
    showToast(error.message || 'Failed to load plan', 'error');
    return;
  }

  if (!data) {
    currentPlan = null;
    renderPlanDetails(null);
    if (!skipListReload) await loadPlans();
    return;
  }

  currentPlan = data;
  renderPlanDetails(currentPlan);
  await loadPlanDays(currentPlan.id);
  await loadServiceCatalog(currentPlan.id);

  if (!skipListReload) {
    await loadPlans({ selectId: currentPlan.id });
  }
}

async function loadPlanDays(planId) {
  if (!sb || !planId) return;

  const { data, error } = await sb
    .from('user_plan_days')
    .select('id,day_index,date,city,notes')
    .eq('plan_id', planId)
    .order('day_index', { ascending: true });

  if (error) {
    console.error('Failed to load plan days', error);
    showToast(error.message || 'Failed to load plan days', 'error');
    return;
  }

  const rows = Array.isArray(data) ? data : [];
  const container = daysEl();
  if (!container) return;

  planDaysById = new Map(rows.map((d) => [d.id, d]));

  const daySel = catalogDaySelectEl();
  if (daySel instanceof HTMLSelectElement) {
    if (!rows.length) {
      daySel.innerHTML = '';
    } else {
      const existingValue = daySel.value;
      daySel.innerHTML = rows
        .map((d) => {
          const label = d.date ? `Day ${d.day_index} · ${d.date}` : `Day ${d.day_index}`;
          return `<option value="${d.id}">${escapeHtml(label)}</option>`;
        })
        .join('');
      const hasExisting = rows.some((d) => d.id === existingValue);
      daySel.value = hasExisting ? existingValue : rows[0].id;
    }

    if (!daySel.dataset.wired) {
      daySel.addEventListener('change', () => {
        renderServiceCatalog();
      });
      daySel.dataset.wired = '1';
    }
  }

  if (!rows.length) {
    container.innerHTML = '<div style="color:#64748b;">No days generated yet.</div>';
    return;
  }

  const dayIds = rows.map((r) => r.id).filter(Boolean);
  dayItemsByDayId = await fetchPlanItemsForDays(dayIds);

  container.innerHTML = rows
    .map((d) => {
      const label = d.date ? `Day ${d.day_index} · ${d.date}` : `Day ${d.day_index}`;
      const city = (d.city || '').trim();
      const notes = (d.notes || '').trim();
      const items = Array.isArray(dayItemsByDayId.get(d.id)) ? dayItemsByDayId.get(d.id) : [];
      const noteItems = items.filter((it) => it && it.item_type === 'note');
      const serviceItems = items.filter((it) => it && it.item_type && it.item_type !== 'note');
      const poiItems = serviceItems.filter((it) => it && it.item_type === 'poi');
      const nonPoiServiceItems = serviceItems.filter((it) => it && it.item_type && it.item_type !== 'poi');
      const servicesHtml = serviceItems.length
        ? `
          <div style="border-top: 1px solid #e2e8f0; padding-top:0.5rem;">
            <div style="font-size:12px; color:#64748b; margin-bottom:0.25rem;">Services</div>
            <div style="display:grid; gap:0.5rem;">
              ${nonPoiServiceItems
                .map((it) => {
                  const t = getServiceTypeLabel(it.item_type);
                  const title = it?.data && typeof it.data === 'object' ? String(it.data.title || '') : '';
                  const subtitle = it?.data && typeof it.data === 'object' ? String(it.data.subtitle || '') : '';
                  const url = it?.data && typeof it.data === 'object' ? String(it.data.url || '') : '';
                  const price = it?.data && typeof it.data === 'object' ? String(it.data.price || '') : '';
                  const rangeStart = it?.data && typeof it.data === 'object' ? Number(it.data.range_start_day_index || 0) : 0;
                  const rangeEnd = it?.data && typeof it.data === 'object' ? Number(it.data.range_end_day_index || 0) : 0;
                  const rangeId = it?.data && typeof it.data === 'object' ? String(it.data.range_id || '') : '';
                  const rangeBadge = rangeId && rangeStart > 0 && rangeEnd > 0 ? ` (Day ${rangeStart}–Day ${rangeEnd})` : '';
                  const link = url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="btn btn-sm">Open</a>` : '';
                  return `
                    <div style="display:flex; gap:0.5rem; align-items:flex-start; justify-content:space-between;">
                      <div style="flex:1 1 auto; min-width:0;">
                        <div style="font-size:12px; color:#64748b;">${escapeHtml(t)}</div>
                        <div style="color:#0f172a; font-weight:600;">${escapeHtml(title)}${escapeHtml(rangeBadge)}</div>
                        ${subtitle ? `<div style=\"color:#64748b; font-size:12px;\">${escapeHtml(subtitle)}</div>` : ''}
                        ${price ? `<div style=\"color:#0f172a; font-size:12px;\">${escapeHtml(price)}</div>` : ''}
                      </div>
                      <div style="display:flex; gap:0.5rem; flex-wrap:wrap; justify-content:flex-end;">
                        ${link}
                        <button type="button" class="btn btn-sm" data-day-item-delete="${it.id}" data-range-id="${escapeHtml(rangeId)}" aria-label="Delete">✕</button>
                      </div>
                    </div>
                  `;
                })
                .join('')}
            </div>
          </div>
        `
        : '';

      const poiHtml = poiItems.length
        ? (() => {
          const sorted = [...poiItems].sort((a, b) => {
            const am = parseTimeToMinutes(a?.data?.start_time);
            const bm = parseTimeToMinutes(b?.data?.start_time);
            if (am == null && bm == null) return 0;
            if (am == null) return 1;
            if (bm == null) return -1;
            return am - bm;
          });

          return `
            <div style="border-top: 1px solid #e2e8f0; padding-top:0.5rem;">
              <div style="font-size:12px; color:#64748b; margin-bottom:0.25rem;">Places (schedule)</div>
              <div style="display:grid; gap:0.5rem;">
                ${sorted
                  .map((it) => {
                    const title = it?.data && typeof it.data === 'object' ? String(it.data.title || '') : '';
                    const url = it?.data && typeof it.data === 'object' ? String(it.data.url || '') : '';
                    const timeLabel = formatPoiTimeLabel(it);
                    const link = url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="btn btn-sm">Open</a>` : '';
                    const startV = it?.data && typeof it.data === 'object' ? String(it.data.start_time || '') : '';
                    const endV = it?.data && typeof it.data === 'object' ? String(it.data.end_time || '') : '';
                    return `
                      <div style="display:flex; gap:0.5rem; align-items:flex-start; justify-content:space-between;">
                        <div style="flex:1 1 auto; min-width:0;">
                          <div style="display:flex; gap:0.5rem; align-items:baseline; flex-wrap:wrap;">
                            <div style="color:#0f172a; font-weight:600;">${escapeHtml(title || 'Place')}</div>
                            ${timeLabel ? `<div style=\"color:#64748b; font-size:12px;\">${escapeHtml(timeLabel)}</div>` : ''}
                          </div>
                          <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.25rem;">
                            <label style="display:flex; gap:0.25rem; align-items:center; font-size:12px; color:#0f172a;">
                              Start
                              <input type="time" value="${escapeHtml(startV)}" data-poi-time-start="${it.id}" style="max-width:120px;" />
                            </label>
                            <label style="display:flex; gap:0.25rem; align-items:center; font-size:12px; color:#0f172a;">
                              End
                              <input type="time" value="${escapeHtml(endV)}" data-poi-time-end="${it.id}" style="max-width:120px;" />
                            </label>
                            <button type="button" class="btn btn-sm" data-poi-time-save="${it.id}">Save time</button>
                          </div>
                        </div>
                        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; justify-content:flex-end;">
                          ${link}
                          <button type="button" class="btn btn-sm" data-day-item-delete="${it.id}" aria-label="Delete">✕</button>
                        </div>
                      </div>
                    `;
                  })
                  .join('')}
              </div>
            </div>
          `;
        })()
        : '';
      const itemsHtml = noteItems.length
        ? `
          <div style="margin-top:0.5rem; display:grid; gap:0.5rem;">
            ${noteItems
              .map((it) => {
                const text = it?.data && typeof it.data === 'object' ? String(it.data.text || '').trim() : '';
                return `
                  <div style="display:flex; gap:0.5rem; align-items:flex-start;">
                    <div style="flex:1 1 auto; color:#475569;">${escapeHtml(text)}</div>
                    <button type="button" class="btn btn-sm" data-day-item-delete="${it.id}" aria-label="Delete">✕</button>
                  </div>
                `;
              })
              .join('')}
          </div>
        `
        : '';
      return `
        <div class="card" style="padding: 0.75rem; border: 1px solid #e2e8f0;">
          <div style="display:flex; justify-content:space-between; gap:0.75rem; flex-wrap:wrap;">
            <strong>${escapeHtml(label)}</strong>
            <span style="color:#64748b;">${escapeHtml(city)}</span>
          </div>
          <div style="margin-top:0.5rem; display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
            <button type="button" class="btn btn-sm" data-day-quick-add="trip" data-day-id="${d.id}">Add trip</button>
            <button type="button" class="btn btn-sm" data-day-quick-add="hotel" data-day-id="${d.id}">Add hotel</button>
            <button type="button" class="btn btn-sm" data-day-quick-add="car" data-day-id="${d.id}">Add car</button>
            <button type="button" class="btn btn-sm" data-day-quick-add="pois" data-day-id="${d.id}">Add places</button>
          </div>
          <div style="margin-top:0.5rem; display:grid; gap:0.5rem;">
            <div style="display:grid; gap:0.25rem;">
              <label style="font-size:12px; color:#64748b;" for="dayCity_${d.id}">City</label>
              <input id="dayCity_${d.id}" type="text" value="${escapeHtml(city)}" data-day-city="${d.id}" placeholder="City" list="ceCityOptions" />
            </div>
            <div style="display:grid; gap:0.25rem;">
              <label style="font-size:12px; color:#64748b;" for="dayNotes_${d.id}">Day notes</label>
              <textarea id="dayNotes_${d.id}" rows="2" data-day-notes="${d.id}" placeholder="Notes">${escapeHtml(notes)}</textarea>
            </div>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
              <button type="button" class="btn btn-sm" data-day-save="${d.id}">Save day</button>
              <span style="color:#64748b; font-size:12px;" data-day-status="${d.id}"></span>
            </div>
            ${servicesHtml}
            ${poiHtml}
            <div id="dayMap_${d.id}" style="height: 180px; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; display:none;"></div>
            ${itemsHtml}
          </div>
        </div>
      `;
    })
    .join('');

  rows.forEach((d) => {
    const items = Array.isArray(dayItemsByDayId.get(d.id)) ? dayItemsByDayId.get(d.id) : [];
    const serviceItems = items.filter((it) => it && it.item_type && it.item_type !== 'note');
    const poiItems = serviceItems.filter((it) => it && it.item_type === 'poi');
    renderDayMap(d.id, poiItems);
  });

  container.querySelectorAll('[data-day-save]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const dayId = btn.getAttribute('data-day-save');
      if (!dayId) return;

      const cityInput = container.querySelector(`[data-day-city="${dayId}"]`);
      const notesInput = container.querySelector(`[data-day-notes="${dayId}"]`);
      const statusEl = container.querySelector(`[data-day-status="${dayId}"]`);

      const city = cityInput instanceof HTMLInputElement ? cityInput.value.trim() : '';
      const notes = notesInput instanceof HTMLTextAreaElement ? notesInput.value.trim() : '';

      if (statusEl instanceof HTMLElement) statusEl.textContent = 'Saving…';
      const updated = await updateDayField(dayId, { city: city || null, notes: notes || null });
      if (updated) {
        if (statusEl instanceof HTMLElement) statusEl.textContent = 'Saved.';
        const prev = planDaysById.get(dayId) || {};
        planDaysById.set(dayId, { ...prev, ...updated });
        renderServiceCatalog();
      } else {
        if (statusEl instanceof HTMLElement) statusEl.textContent = 'Error.';
      }
    });
  });

  container.querySelectorAll('[data-day-city]').forEach((input) => {
    if (!(input instanceof HTMLInputElement)) return;
    input.addEventListener('input', () => {
      const dayId = input.getAttribute('data-day-city');
      if (!dayId) return;
      const prev = planDaysById.get(dayId) || {};
      planDaysById.set(dayId, { ...prev, city: input.value.trim() || null });
      renderServiceCatalog();
    });
  });

  container.querySelectorAll('[data-day-quick-add]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dayId = btn.getAttribute('data-day-id');
      const tab = btn.getAttribute('data-day-quick-add');
      if (!dayId || !tab) return;

      const daySel = catalogDaySelectEl();
      if (daySel instanceof HTMLSelectElement) {
        daySel.value = dayId;
      }
      catalogActiveTab = tab;
      renderServiceCatalog();

      const catWrap = catalogEl();
      if (catWrap && typeof catWrap.scrollIntoView === 'function') {
        catWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  container.querySelectorAll('[data-day-item-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const itemId = btn.getAttribute('data-day-item-delete');
      if (!itemId) return;
      const rangeId = btn.getAttribute('data-range-id');
      const ok = rangeId ? await deleteRangeItems(rangeId) : await deleteDayItem(itemId);
      if (ok) {
        await loadPlanDays(planId);
      }
    });
  });

  container.querySelectorAll('[data-poi-time-save]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const itemId = btn.getAttribute('data-poi-time-save');
      if (!itemId) return;
      const startEl = container.querySelector(`[data-poi-time-start="${itemId}"]`);
      const endEl = container.querySelector(`[data-poi-time-end="${itemId}"]`);
      const start = startEl instanceof HTMLInputElement ? startEl.value.trim() : '';
      const end = endEl instanceof HTMLInputElement ? endEl.value.trim() : '';

      const dayId = rows.find((r) => {
        const its = Array.isArray(dayItemsByDayId.get(r.id)) ? dayItemsByDayId.get(r.id) : [];
        return its.some((it) => String(it?.id) === String(itemId));
      })?.id;
      if (!dayId) return;

      const items = Array.isArray(dayItemsByDayId.get(dayId)) ? dayItemsByDayId.get(dayId) : [];
      const target = items.find((it) => String(it?.id) === String(itemId));
      if (!target) return;
      const prevData = target?.data && typeof target.data === 'object' ? target.data : {};

      const nextData = { ...prevData, start_time: start || null, end_time: end || null };
      const updated = await updatePlanItemData(itemId, nextData);
      if (updated) {
        await loadPlanDays(planId);
      }
    });
  });

  renderPlanCostSummary();
}

async function regeneratePlanDays() {
  if (!sb || !currentPlan?.id) return;

  const startEl = el('planEditStart');
  const endEl = el('planEditEnd');
  const baseCityEl = el('planEditBaseCity');

  const startDate = startEl instanceof HTMLInputElement ? startEl.value.trim() : '';
  const endDate = endEl instanceof HTMLInputElement ? endEl.value.trim() : '';
  const baseCity = baseCityEl instanceof HTMLInputElement ? baseCityEl.value.trim() : '';

  if (!startDate || !endDate) {
    showToast('Set start and end date first.', 'info');
    return;
  }

  const daysCount = daysBetweenInclusive(startDate, endDate);
  if (!daysCount) {
    showToast('Invalid dates.', 'error');
    return;
  }

  const sure = window.confirm('Regenerate days? This will remove existing days and their items.');
  if (!sure) return;

  setStatus(saveStatusEl(), 'Regenerating…', 'info');

  const { data: existing, error: loadErr } = await sb
    .from('user_plan_days')
    .select('id')
    .eq('plan_id', currentPlan.id);

  if (loadErr) {
    console.error('Failed to load existing days', loadErr);
    setStatus(saveStatusEl(), loadErr.message || 'Failed to load days', 'error');
    return;
  }

  const existingIds = (Array.isArray(existing) ? existing : []).map((d) => d.id).filter(Boolean);

  if (existingIds.length) {
    const { error: itemsDelErr } = await sb
      .from('user_plan_items')
      .delete()
      .in('plan_day_id', existingIds);

    if (itemsDelErr) {
      console.warn('Failed to delete day items before regen', itemsDelErr);
    }

    const { error: daysDelErr } = await sb
      .from('user_plan_days')
      .delete()
      .eq('plan_id', currentPlan.id);

    if (daysDelErr) {
      console.error('Failed to delete existing days', daysDelErr);
      setStatus(saveStatusEl(), daysDelErr.message || 'Failed to delete days', 'error');
      return;
    }
  }

  const dayRows = [];
  for (let i = 0; i < daysCount; i += 1) {
    const date = addDays(startDate, i);
    dayRows.push({
      plan_id: currentPlan.id,
      day_index: i + 1,
      date: date,
      city: baseCity || null,
      notes: null,
    });
  }

  const { error: insertErr } = await sb
    .from('user_plan_days')
    .insert(dayRows);

  if (insertErr) {
    console.error('Failed to regenerate days', insertErr);
    setStatus(saveStatusEl(), insertErr.message || 'Failed to regenerate', 'error');
    return;
  }

  const { error: planErr } = await sb
    .from('user_plans')
    .update({
      start_date: startDate || null,
      end_date: endDate || null,
      days_count: daysCount || null,
      base_city: baseCity || null,
    })
    .eq('id', currentPlan.id);

  if (planErr) {
    console.warn('Failed to update plan after day regen', planErr);
  }

  await loadPlans({ selectId: currentPlan.id });
  await loadPlanDays(currentPlan.id);
  renderServiceCatalog();
  setStatus(saveStatusEl(), 'Days regenerated.', 'success');
}

function renderPlanDetails(plan) {
  const empty = emptyStateEl();
  const wrap = detailsWrapEl();

  const delBtn = el('planDeleteBtn');
  const refreshBtn = el('planRefreshBtn');
  const saveBtn = el('planSaveBtn');

  if (delBtn instanceof HTMLButtonElement) {
    delBtn.disabled = !plan;
  }
  if (refreshBtn instanceof HTMLButtonElement) {
    refreshBtn.disabled = !plan;
  }
  if (saveBtn instanceof HTMLButtonElement) {
    saveBtn.disabled = !plan;
  }

  if (!plan) {
    if (wrap) wrap.hidden = true;
    if (empty) empty.hidden = false;
    const cat = catalogEl();
    if (cat) cat.innerHTML = '';
    const daySel = catalogDaySelectEl();
    if (daySel instanceof HTMLSelectElement) daySel.innerHTML = '';
    planDaysById = new Map();
    return;
  }

  if (empty) empty.hidden = true;
  if (wrap) wrap.hidden = false;

  const titleEl = el('planEditTitle');
  const baseCityEl = el('planEditBaseCity');
  const startEl = el('planEditStart');
  const endEl = el('planEditEnd');
  const includeNorthEl = el('planEditIncludeNorth');
  const peopleEl = el('planEditPeople');
  const adultsEl = el('planEditAdults');
  const childrenEl = el('planEditChildren');

  if (titleEl instanceof HTMLInputElement) titleEl.value = plan.title || '';
  if (baseCityEl instanceof HTMLInputElement) baseCityEl.value = plan.base_city || '';
  if (startEl instanceof HTMLInputElement) startEl.value = plan.start_date || '';
  if (endEl instanceof HTMLInputElement) endEl.value = plan.end_date || '';
  if (includeNorthEl instanceof HTMLInputElement) includeNorthEl.checked = !!plan.include_north;
  if (peopleEl instanceof HTMLInputElement) peopleEl.value = plan.people_count != null ? String(plan.people_count) : '1';

  const party = getPartyForPlan(plan);
  if (adultsEl instanceof HTMLInputElement) adultsEl.value = String(party.adults ?? 0);
  if (childrenEl instanceof HTMLInputElement) childrenEl.value = String(party.children ?? 0);

  if (!peopleEl?.dataset?.partyWired) {
    if (peopleEl instanceof HTMLInputElement && adultsEl instanceof HTMLInputElement && childrenEl instanceof HTMLInputElement) {
      const syncFromAdultsChildren = () => {
        if (!currentPlan?.id) return;
        const a = Math.max(0, Math.floor(Number(adultsEl.value || 0) || 0));
        const c = Math.max(0, Math.floor(Number(childrenEl.value || 0) || 0));
        const sum = Math.max(1, a + c);
        peopleEl.value = String(sum);
        savePartyForPlan(currentPlan.id, { adults: a, children: c });
        renderPlanCostSummary();
        renderServiceCatalog();
      };

      const syncFromPeople = () => {
        if (!currentPlan?.id) return;
        const p = Math.max(1, Math.floor(Number(peopleEl.value || 0) || 1));
        const a = Math.max(0, Math.min(p, Math.floor(Number(adultsEl.value || 0) || 0)));
        const c = Math.max(0, p - a);
        adultsEl.value = String(a);
        childrenEl.value = String(c);
        savePartyForPlan(currentPlan.id, { adults: a, children: c });
        renderPlanCostSummary();
        renderServiceCatalog();
      };

      adultsEl.addEventListener('input', syncFromAdultsChildren);
      childrenEl.addEventListener('input', syncFromAdultsChildren);
      peopleEl.addEventListener('input', syncFromPeople);
      peopleEl.dataset.partyWired = '1';
    }
  }

  setStatus(saveStatusEl(), '', null);

  renderPlanCostSummary();
}

async function handleCreatePlan(event) {
  event.preventDefault();
  if (!sb) return;

  const user = await getCurrentUser();
  if (!user) {
    showToast('Please log in first.', 'info');
    return;
  }

  const form = el('planCreateForm');
  if (!(form instanceof HTMLFormElement)) return;

  setStatus(createStatusEl(), 'Creating…', 'info');

  const title = String(new FormData(form).get('title') || '').trim();
  const baseCity = String(new FormData(form).get('base_city') || '').trim();
  const startDate = String(new FormData(form).get('start_date') || '').trim();
  const endDate = String(new FormData(form).get('end_date') || '').trim();
  const includeNorth = String(new FormData(form).get('include_north') || '') === 'on';

  const daysCount = startDate && endDate ? daysBetweenInclusive(startDate, endDate) : null;
  if ((startDate && endDate) && !daysCount) {
    setStatus(createStatusEl(), 'Invalid dates.', 'error');
    return;
  }

  const payload = {
    user_id: user.id,
    title: title || null,
    base_city: baseCity || null,
    start_date: startDate || null,
    end_date: endDate || null,
    days_count: daysCount || null,
    include_north: includeNorth,
    currency: 'EUR',
    people_count: 1,
  };

  let created = null;
  let error = null;
  {
    const res = await sb.from('user_plans').insert([payload]).select('*').single();
    created = res.data;
    error = res.error;
  }
  if (error && String(error.message || '').toLowerCase().includes('people_count')) {
    const payload2 = { ...payload };
    delete payload2.people_count;
    const res2 = await sb.from('user_plans').insert([payload2]).select('*').single();
    created = res2.data;
    error = res2.error;
  }

  if (error) {
    console.error('Failed to create plan', error);
    setStatus(createStatusEl(), error.message || 'Failed to create plan', 'error');
    showToast(error.message || 'Failed to create plan', 'error');
    return;
  }

  if (created?.id && daysCount && startDate) {
    const dayRows = [];
    for (let i = 0; i < daysCount; i += 1) {
      const date = addDays(startDate, i);
      dayRows.push({
        plan_id: created.id,
        day_index: i + 1,
        date: date,
        city: baseCity || null,
      });
    }

    const { error: dayErr } = await sb
      .from('user_plan_days')
      .insert(dayRows);

    if (dayErr) {
      console.warn('Failed to create plan days', dayErr);
    }
  }

  setStatus(createStatusEl(), 'Created.', 'success');
  form.reset();

  if (created?.id) {
    setHashPlanId(created.id);
    await selectPlanById(created.id, { skipListReload: true });
  }
  await loadPlans({ selectId: created?.id || null });
}

async function handleSavePlan() {
  if (!sb || !currentPlan?.id) return;

  const user = await getCurrentUser();
  if (!user) return;

  const titleEl = el('planEditTitle');
  const baseCityEl = el('planEditBaseCity');
  const startEl = el('planEditStart');
  const endEl = el('planEditEnd');
  const includeNorthEl = el('planEditIncludeNorth');
  const peopleEl = el('planEditPeople');
  const adultsEl = el('planEditAdults');
  const childrenEl = el('planEditChildren');

  const title = titleEl instanceof HTMLInputElement ? titleEl.value.trim() : '';
  const baseCity = baseCityEl instanceof HTMLInputElement ? baseCityEl.value.trim() : '';
  const startDate = startEl instanceof HTMLInputElement ? startEl.value.trim() : '';
  const endDate = endEl instanceof HTMLInputElement ? endEl.value.trim() : '';
  const includeNorth = includeNorthEl instanceof HTMLInputElement ? includeNorthEl.checked : false;
  const peopleCount = peopleEl instanceof HTMLInputElement ? Number(peopleEl.value || 0) : 0;
  const cleanPeople = Number.isFinite(peopleCount) && peopleCount > 0 ? Math.floor(peopleCount) : 1;

  if (adultsEl instanceof HTMLInputElement && childrenEl instanceof HTMLInputElement) {
    const aRaw = Math.max(0, Math.floor(Number(adultsEl.value || 0) || 0));
    const cRaw = Math.max(0, Math.floor(Number(childrenEl.value || 0) || 0));
    const sum = aRaw + cRaw;
    const a = sum > 0 ? aRaw : cleanPeople;
    const c = sum > 0 ? cRaw : 0;
    savePartyForPlan(currentPlan.id, { adults: a, children: c });
  }

  const daysCount = startDate && endDate ? daysBetweenInclusive(startDate, endDate) : null;
  if ((startDate && endDate) && !daysCount) {
    setStatus(saveStatusEl(), 'Invalid dates.', 'error');
    return;
  }

  setStatus(saveStatusEl(), 'Saving…', 'info');

  const patch = {
    title: title || null,
    base_city: baseCity || null,
    start_date: startDate || null,
    end_date: endDate || null,
    days_count: daysCount || null,
    include_north: includeNorth,
    people_count: cleanPeople,
  };

  let updated = null;
  let error = null;
  {
    const res = await sb.from('user_plans').update(patch).eq('id', currentPlan.id).select('*').single();
    updated = res.data;
    error = res.error;
  }
  if (error && String(error.message || '').toLowerCase().includes('people_count')) {
    const patch2 = { ...patch };
    delete patch2.people_count;
    const res2 = await sb.from('user_plans').update(patch2).eq('id', currentPlan.id).select('*').single();
    updated = res2.data;
    error = res2.error;
  }

  if (error) {
    console.error('Failed to save plan', error);
    setStatus(saveStatusEl(), error.message || 'Failed to save', 'error');
    showToast(error.message || 'Failed to save', 'error');
    return;
  }

  currentPlan = updated || currentPlan;
  setStatus(saveStatusEl(), 'Saved.', 'success');
  await loadPlans({ selectId: currentPlan.id });
  await loadPlanDays(currentPlan.id);
  renderServiceCatalog();
  renderPlanCostSummary();
}

async function handleDeletePlan() {
  if (!sb || !currentPlan?.id) return;
  const sure = window.confirm('Delete this plan? This cannot be undone.');
  if (!sure) return;

  const { error } = await sb
    .from('user_plans')
    .delete()
    .eq('id', currentPlan.id);

  if (error) {
    console.error('Failed to delete plan', error);
    showToast(error.message || 'Failed to delete plan', 'error');
    return;
  }

  showToast('Plan deleted.', 'success');
  currentPlan = null;
  setHashPlanId(null);
  renderPlanDetails(null);
  await loadPlans();
}

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function bookingDialogEl() {
  return el('planBookingDialog');
}
function bookingFormEl() {
  return el('planBookingForm');
}
function bookingFormBodyEl() {
  return el('planBookingFormBody');
}
function bookingFormStatusEl() {
  return el('planBookingFormStatus');
}
function bookingCloseBtnEl() {
  return el('planBookingCloseBtn');
}
function bookingSubmitBtnEl() {
  return el('planBookingSubmitBtn');
}

function plannerCustomerStorageKey() {
  return 'ce_plan_booking_customer_v1';
}

function getSavedPlannerCustomer() {
  try {
    const raw = localStorage.getItem(plannerCustomerStorageKey());
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      name: String(parsed.name || '').trim(),
      email: String(parsed.email || '').trim(),
      phone: String(parsed.phone || '').trim(),
      country: String(parsed.country || '').trim(),
    };
  } catch (_) {
    return null;
  }
}

function savePlannerCustomer(customer) {
  const payload = {
    name: String(customer?.name || '').trim(),
    email: String(customer?.email || '').trim(),
    phone: String(customer?.phone || '').trim(),
    country: String(customer?.country || '').trim(),
    savedAt: Date.now(),
  };
  try {
    localStorage.setItem(plannerCustomerStorageKey(), JSON.stringify(payload));
  } catch (_) {}
}

async function getPrefillCustomerFromSession() {
  const saved = getSavedPlannerCustomer();
  let sessionEmail = '';
  try {
    await waitForAuthReadySafe();
    if (sb?.auth?.getUser) {
      const res = await sb.auth.getUser();
      sessionEmail = String(res?.data?.user?.email || '').trim();
    }
  } catch (_) {}

  return {
    name: saved?.name || '',
    email: saved?.email || sessionEmail || '',
    phone: saved?.phone || '',
    country: saved?.country || '',
  };
}

function wirePlannerBookingDynamicAddressRequirements() {
  const body = bookingFormBodyEl();
  if (!body) return;

  const update = () => {
    const carsCountEl = body.querySelector('input[name="count_cars"]');
    const count = Math.max(0, Math.floor(Number(carsCountEl?.value || 0) || 0));
    for (let i = 0; i < count; i += 1) {
      const pickupSel = body.querySelector(`select[name="car_pickup_location_${i}"]`);
      const returnSel = body.querySelector(`select[name="car_return_location_${i}"]`);
      const pickupAddr = body.querySelector(`input[name="car_pickup_address_${i}"]`);
      const returnAddr = body.querySelector(`input[name="car_return_address_${i}"]`);

      const pickupVal = String(pickupSel?.value || '');
      const returnVal = String(returnSel?.value || '');
      const pickupNeeds = pickupVal === 'hotel' || pickupVal === 'other';
      const returnNeeds = returnVal === 'hotel' || returnVal === 'other';

      if (pickupAddr instanceof HTMLInputElement) pickupAddr.required = pickupNeeds;
      if (returnAddr instanceof HTMLInputElement) returnAddr.required = returnNeeds;
    }
  };

  body.addEventListener('change', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.matches('select[name^="car_pickup_location_"]') || t.matches('select[name^="car_return_location_"]')) {
      update();
    }
  });
  update();
}

function buildDayIndexToDateMap() {
  const m = new Map();
  planDaysById.forEach((d) => {
    const idx = Number(d?.day_index || 0) || 0;
    const date = d?.date ? String(d.date) : '';
    if (idx > 0 && date) m.set(idx, date);
  });
  return m;
}

function getSelectedServicesForBooking() {
  const all = [];
  dayItemsByDayId.forEach((items) => {
    (Array.isArray(items) ? items : []).forEach((it) => {
      if (!it || !it.item_type || it.item_type === 'note' || it.item_type === 'poi') return;
      all.push(it);
    });
  });

  const dayById = new Map();
  planDaysById.forEach((d) => dayById.set(String(d.id), d));
  const dayIndexToDate = buildDayIndexToDateMap();

  const byRange = new Map();
  const trips = [];

  all.forEach((it) => {
    const d = it?.data && typeof it.data === 'object' ? it.data : {};
    const rangeId = d.range_id ? String(d.range_id) : '';
    if (rangeId) {
      if (!byRange.has(rangeId)) byRange.set(rangeId, it);
      return;
    }
    if (it.item_type === 'trip') {
      const day = dayById.get(String(it.plan_day_id)) || null;
      const date = day?.date ? String(day.date) : '';
      const ref = catalogData.trips.find((t) => String(t?.id) === String(it.ref_id)) || null;
      trips.push({ item: it, day, date, trip: ref });
    }
  });

  const hotels = [];
  const cars = [];

  byRange.forEach((it) => {
    const d = it?.data && typeof it.data === 'object' ? it.data : {};
    const startIdx = Number(d.range_start_day_index || 0) || 0;
    const endIdx = Number(d.range_end_day_index || 0) || 0;
    const startDate = startIdx > 0 ? (dayIndexToDate.get(startIdx) || '') : '';
    const endDate = endIdx > 0 ? (dayIndexToDate.get(endIdx) || '') : '';

    if (it.item_type === 'hotel') {
      const ref = catalogData.hotels.find((h) => String(h?.id) === String(it.ref_id)) || null;
      hotels.push({ item: it, startIdx, endIdx, startDate, endDate, hotel: ref });
      return;
    }
    if (it.item_type === 'car') {
      const ref = catalogData.cars.find((c) => String(c?.id) === String(it.ref_id)) || null;
      cars.push({ item: it, startIdx, endIdx, startDate, endDate, car: ref });
    }
  });

  return { trips, hotels, cars };
}

async function renderPlannerBookingForm() {
  const body = bookingFormBodyEl();
  if (!body) return;
  if (!currentPlan?.id) {
    body.innerHTML = '<div style="color:#64748b;">Select a plan first.</div>';
    return;
  }

  const selected = getSelectedServicesForBooking();
  const party = getPartyForPlan(currentPlan);

  const customer = await getPrefillCustomerFromSession();

  const hasTrips = selected.trips.length > 0;
  const hasHotels = selected.hotels.length > 0;
  const hasCars = selected.cars.length > 0;

  if (!hasTrips && !hasHotels && !hasCars) {
    body.innerHTML = '<div style="color:#64748b;">Add at least one service to your plan to request booking.</div>';
    return;
  }

  const tripRows = selected.trips
    .map((x, i) => {
      const t = x.trip || {};
      const title = x.item?.data?.title || getTripTitle(t) || 'Trip';
      const date = x.date || '';
      const pm = t?.pricing_model || 'per_person';
      const showHours = pm === 'per_hour';
      const showDays = pm === 'per_day';
      return `
        <div class="card" style="padding:0.75rem; border:1px solid #e2e8f0;">
          <div style="font-weight:700;">${escapeHtml(title)}</div>
          <div style="color:#64748b; font-size:12px;">${escapeHtml(date ? `Date: ${date}` : 'Date: (set in plan day)')}</div>
          <input type="hidden" name="trip_ref_id_${i}" value="${escapeHtml(t?.id || x.item?.ref_id || '')}" />
          <input type="hidden" name="trip_date_${i}" value="${escapeHtml(date)}" />
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 0.5rem;">
            <label style="display:grid; gap:0.25rem; font-size:12px; color:#0f172a;">
              Adults
              <input type="number" name="trip_adults_${i}" min="0" step="1" value="${escapeHtml(String(party.adults || 0))}" />
            </label>
            <label style="display:grid; gap:0.25rem; font-size:12px; color:#0f172a;">
              Children
              <input type="number" name="trip_children_${i}" min="0" step="1" value="${escapeHtml(String(party.children || 0))}" />
            </label>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 0.5rem;">
            <label style="display:grid; gap:0.25rem; font-size:12px; color:#0f172a; ${showHours ? '' : 'opacity:0.6;'}">
              Hours
              <input type="number" name="trip_hours_${i}" min="1" step="1" value="1" ${showHours ? '' : 'disabled'} />
            </label>
            <label style="display:grid; gap:0.25rem; font-size:12px; color:#0f172a; ${showDays ? '' : 'opacity:0.6;'}">
              Days
              <input type="number" name="trip_days_${i}" min="1" step="1" value="1" ${showDays ? '' : 'disabled'} />
            </label>
          </div>
          <label style="display:grid; gap:0.25rem; font-size:12px; color:#0f172a; margin-top:0.5rem;">
            Notes
            <textarea name="trip_notes_${i}" rows="2" placeholder="Additional info"></textarea>
          </label>
        </div>
      `;
    })
    .join('');

  const hotelRows = selected.hotels
    .map((x, i) => {
      const h = x.hotel || {};
      const title = x.item?.data?.title || (window.getHotelName ? window.getHotelName(h) : (h?.title?.pl || h?.title?.en || h?.slug)) || 'Hotel';
      const arrival = x.startDate || '';
      const departure = x.endDate || '';
      return `
        <div class="card" style="padding:0.75rem; border:1px solid #e2e8f0;">
          <div style="font-weight:700;">${escapeHtml(title)}</div>
          <div style="color:#64748b; font-size:12px;">${escapeHtml(arrival && departure ? `Dates: ${arrival} → ${departure}` : 'Dates: (set via range in plan)')}</div>
          <input type="hidden" name="hotel_ref_id_${i}" value="${escapeHtml(h?.id || x.item?.ref_id || '')}" />
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 0.5rem;">
            <label style="display:grid; gap:0.25rem; font-size:12px; color:#0f172a;">
              Arrival
              <input type="date" name="hotel_arrival_${i}" value="${escapeHtml(arrival)}" required />
            </label>
            <label style="display:grid; gap:0.25rem; font-size:12px; color:#0f172a;">
              Departure
              <input type="date" name="hotel_departure_${i}" value="${escapeHtml(departure)}" required />
            </label>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 0.5rem;">
            <label style="display:grid; gap:0.25rem; font-size:12px; color:#0f172a;">
              Adults
              <input type="number" name="hotel_adults_${i}" min="0" step="1" value="${escapeHtml(String(party.adults || 0))}" />
            </label>
            <label style="display:grid; gap:0.25rem; font-size:12px; color:#0f172a;">
              Children
              <input type="number" name="hotel_children_${i}" min="0" step="1" value="${escapeHtml(String(party.children || 0))}" />
            </label>
          </div>
          <label style="display:grid; gap:0.25rem; font-size:12px; color:#0f172a; margin-top:0.5rem;">
            Notes
            <textarea name="hotel_notes_${i}" rows="2" placeholder="Preferences, questions..."></textarea>
          </label>
        </div>
      `;
    })
    .join('');

  const defaultAirport = cityToCarLocation(currentPlan?.base_city) === 'larnaca' ? 'airport_lca' : 'airport_pfo';

  const carRows = selected.cars
    .map((x, i) => {
      const c = x.car || {};
      const title = x.item?.data?.title || c?.car_model || c?.car_type || 'Car';
      const pickup = x.startDate || '';
      const ret = x.endDate || '';
      const loc = String(c?.location || '').toLowerCase() || 'paphos';
      const people = Math.max(1, Number(currentPlan?.people_count || 1) || 1);
      return `
        <div class="card" style="padding:0.75rem; border:1px solid #e2e8f0;">
          <div style="font-weight:700;">${escapeHtml(title)}${loc ? ` <span style="color:#64748b; font-weight:400;">(${escapeHtml(loc)})</span>` : ''}</div>
          <input type="hidden" name="car_ref_id_${i}" value="${escapeHtml(c?.id || x.item?.ref_id || '')}" />
          <input type="hidden" name="car_location_${i}" value="${escapeHtml(loc)}" />
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 0.5rem;">
            <label style="display:grid; gap:0.25rem; font-size:12px; color:#0f172a;">
              Pickup date
              <input type="date" name="car_pickup_date_${i}" value="${escapeHtml(pickup)}" required />
            </label>
            <label style="display:grid; gap:0.25rem; font-size:12px; color:#0f172a;">
              Return date
              <input type="date" name="car_return_date_${i}" value="${escapeHtml(ret)}" required />
            </label>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 0.5rem;">
            <label style="display:grid; gap:0.25rem; font-size:12px; color:#0f172a;">
              Pickup time
              <input type="time" name="car_pickup_time_${i}" value="10:00" />
            </label>
            <label style="display:grid; gap:0.25rem; font-size:12px; color:#0f172a;">
              Return time
              <input type="time" name="car_return_time_${i}" value="10:00" />
            </label>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 0.5rem;">
            <label style="display:grid; gap:0.25rem; font-size:12px; color:#0f172a;">
              Pickup location
              <select name="car_pickup_location_${i}">
                <option value="airport_pfo" ${defaultAirport === 'airport_pfo' ? 'selected' : ''}>Airport (PFO)</option>
                <option value="airport_lca" ${defaultAirport === 'airport_lca' ? 'selected' : ''}>Airport (LCA)</option>
                <option value="hotel">Hotel</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label style="display:grid; gap:0.25rem; font-size:12px; color:#0f172a;">
              Return location
              <select name="car_return_location_${i}">
                <option value="airport_pfo" ${defaultAirport === 'airport_pfo' ? 'selected' : ''}>Airport (PFO)</option>
                <option value="airport_lca" ${defaultAirport === 'airport_lca' ? 'selected' : ''}>Airport (LCA)</option>
                <option value="hotel">Hotel</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 0.5rem;">
            <label style="display:grid; gap:0.25rem; font-size:12px; color:#0f172a;">
              Pickup address (optional)
              <input type="text" name="car_pickup_address_${i}" />
            </label>
            <label style="display:grid; gap:0.25rem; font-size:12px; color:#0f172a;">
              Return address (optional)
              <input type="text" name="car_return_address_${i}" />
            </label>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 0.5rem;">
            <label style="display:grid; gap:0.25rem; font-size:12px; color:#0f172a;">
              Passengers
              <input type="number" name="car_num_passengers_${i}" min="1" step="1" value="${escapeHtml(String(people))}" />
            </label>
            <label style="display:grid; gap:0.25rem; font-size:12px; color:#0f172a;">
              Child seats
              <input type="number" name="car_child_seats_${i}" min="0" step="1" value="0" />
            </label>
          </div>
          <label style="display:flex; gap:0.5rem; align-items:center; margin-top:0.5rem;">
            <input type="checkbox" name="car_full_insurance_${i}" />
            Full insurance
          </label>
          <label style="display:grid; gap:0.25rem; font-size:12px; color:#0f172a; margin-top:0.5rem;">
            Flight number (optional)
            <input type="text" name="car_flight_number_${i}" />
          </label>
          <label style="display:grid; gap:0.25rem; font-size:12px; color:#0f172a; margin-top:0.5rem;">
            Special requests
            <textarea name="car_special_requests_${i}" rows="2"></textarea>
          </label>
        </div>
      `;
    })
    .join('');

  body.innerHTML = `
    <div class="card" style="padding: 0.75rem; border:1px solid #e2e8f0;">
      <div style="font-weight:700; margin-bottom:0.5rem;">Customer</div>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <label style="display:grid; gap:0.25rem; font-size:12px; color:#0f172a;">
          Full name
          <input name="customer_name" required value="${escapeHtml(customer.name)}" />
        </label>
        <label style="display:grid; gap:0.25rem; font-size:12px; color:#0f172a;">
          Email
          <input name="customer_email" type="email" required value="${escapeHtml(customer.email)}" />
        </label>
      </div>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top:0.5rem;">
        <label style="display:grid; gap:0.25rem; font-size:12px; color:#0f172a;">
          Phone
          <input name="customer_phone" required value="${escapeHtml(customer.phone)}" />
        </label>
        ${hasCars ? `<label style="display:grid; gap:0.25rem; font-size:12px; color:#0f172a;">Country (for car booking)<input name="customer_country" required value="${escapeHtml(customer.country)}" /></label>` : '<span></span>'}
      </div>
      <label style="display:grid; gap:0.25rem; font-size:12px; color:#0f172a; margin-top:0.5rem;">
        Notes for our team (applies to all)
        <textarea name="customer_global_notes" rows="2" placeholder="Anything important about your trip..."></textarea>
      </label>
    </div>
    ${hasTrips ? `<div style="font-weight:800;">Trips</div>${tripRows}` : ''}
    ${hasHotels ? `<div style="font-weight:800;">Accommodation</div>${hotelRows}` : ''}
    ${hasCars ? `<div style="font-weight:800;">Cars</div>${carRows}` : ''}
    <input type="hidden" name="has_trips" value="${hasTrips ? '1' : ''}" />
    <input type="hidden" name="has_hotels" value="${hasHotels ? '1' : ''}" />
    <input type="hidden" name="has_cars" value="${hasCars ? '1' : ''}" />
    <input type="hidden" name="count_trips" value="${escapeHtml(String(selected.trips.length))}" />
    <input type="hidden" name="count_hotels" value="${escapeHtml(String(selected.hotels.length))}" />
    <input type="hidden" name="count_cars" value="${escapeHtml(String(selected.cars.length))}" />
  `;
}

async function submitPlannerBookingForm(event) {
  event.preventDefault();
  if (!sb || !currentPlan?.id) return;

  const form = bookingFormEl();
  if (!(form instanceof HTMLFormElement)) return;

  const fd = new FormData(form);
  const statusEl = bookingFormStatusEl();
  const btn = bookingSubmitBtnEl();
  setStatus(statusEl, '', null);

  const customerName = String(fd.get('customer_name') || '').trim();
  const customerEmail = String(fd.get('customer_email') || '').trim();
  const customerPhone = String(fd.get('customer_phone') || '').trim();
  const customerCountry = String(fd.get('customer_country') || '').trim();
  const hasCars = formHasCars(fd);
  const globalNotes = String(fd.get('customer_global_notes') || '').trim();

  if (!customerName || !customerEmail || !customerPhone) {
    setStatus(statusEl, 'Please fill in customer name, email and phone.', 'error');
    return;
  }
  if (hasCars && !customerCountry) {
    setStatus(statusEl, 'Country is required for car booking requests.', 'error');
    return;
  }

  savePlannerCustomer({ name: customerName, email: customerEmail, phone: customerPhone, country: customerCountry });

  const user = await getCurrentUser();
  const createdBy = user?.id || null;

  const selected = getSelectedServicesForBooking();

  if (btn instanceof HTMLButtonElement) {
    btn.disabled = true;
    btn.textContent = 'Sending…';
  }

  try {
    const tripRows = [];
    selected.trips.forEach((x, i) => {
      const t = x.trip || {};
      const tripId = String(fd.get(`trip_ref_id_${i}`) || t?.id || x.item?.ref_id || '').trim();
      const tripDate = String(fd.get(`trip_date_${i}`) || x.date || '').trim();
      const adults = Math.max(0, Math.floor(Number(fd.get(`trip_adults_${i}`) || 0) || 0));
      const children = Math.max(0, Math.floor(Number(fd.get(`trip_children_${i}`) || 0) || 0));
      const hours = Math.max(1, Math.floor(Number(fd.get(`trip_hours_${i}`) || 1) || 1));
      const days = Math.max(1, Math.floor(Number(fd.get(`trip_days_${i}`) || 1) || 1));
      const notes = String(fd.get(`trip_notes_${i}`) || '').trim();
      const mergedNotes = [notes, globalNotes].filter(Boolean).join('\n');

      const total = calcTripTotal(t, { adults, children, hours, days });
      tripRows.push({
        trip_id: tripId || null,
        trip_slug: t?.slug || null,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone || null,
        trip_date: tripDate || null,
        arrival_date: tripDate || null,
        departure_date: tripDate || null,
        num_adults: adults,
        num_children: children,
        num_hours: hours,
        num_days: days,
        notes: mergedNotes || null,
        total_price: Number(total || 0) || 0,
        status: 'pending',
        plan_id: currentPlan.id,
        source: 'planner',
        created_by: createdBy,
        user_id: createdBy,
      });
    });

    const hotelRows = [];
    selected.hotels.forEach((x, i) => {
      const h = x.hotel || {};
      const hotelId = String(fd.get(`hotel_ref_id_${i}`) || h?.id || x.item?.ref_id || '').trim();
      const arrival = String(fd.get(`hotel_arrival_${i}`) || x.startDate || '').trim();
      const departure = String(fd.get(`hotel_departure_${i}`) || x.endDate || '').trim();
      const adults = Math.max(0, Math.floor(Number(fd.get(`hotel_adults_${i}`) || 0) || 0));
      const children = Math.max(0, Math.floor(Number(fd.get(`hotel_children_${i}`) || 0) || 0));
      const notes = String(fd.get(`hotel_notes_${i}`) || '').trim();
      const mergedNotes = [notes, globalNotes].filter(Boolean).join('\n');

      const nights = Math.max(1, nightsBetween(arrival, departure));
      const persons = adults + children;
      const res = calculateHotelPrice(h, Math.max(1, persons), nights);
      const total = Number(res?.total || 0) || 0;

      hotelRows.push({
        hotel_id: hotelId || null,
        category_id: h?.category_id || null,
        hotel_slug: h?.slug || null,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone || null,
        arrival_date: arrival,
        departure_date: departure,
        num_adults: adults,
        num_children: children,
        nights,
        notes: mergedNotes || null,
        total_price: total,
        status: 'pending',
        plan_id: currentPlan.id,
        source: 'planner',
        created_by: createdBy,
        user_id: createdBy,
      });
    });

    const carRows = [];
    const defaultAirport = cityToCarLocation(currentPlan?.base_city) === 'larnaca' ? 'airport_lca' : 'airport_pfo';
    selected.cars.forEach((x, i) => {
      const c = x.car || {};
      const pickupDate = String(fd.get(`car_pickup_date_${i}`) || x.startDate || '').trim();
      const returnDate = String(fd.get(`car_return_date_${i}`) || x.endDate || '').trim();
      const pickupTime = String(fd.get(`car_pickup_time_${i}`) || '10:00').trim() || '10:00';
      const returnTime = String(fd.get(`car_return_time_${i}`) || '10:00').trim() || '10:00';
      const pickupLoc = String(fd.get(`car_pickup_location_${i}`) || defaultAirport).trim() || defaultAirport;
      const returnLoc = String(fd.get(`car_return_location_${i}`) || defaultAirport).trim() || defaultAirport;
      const pickupAddr = String(fd.get(`car_pickup_address_${i}`) || '').trim();
      const returnAddr = String(fd.get(`car_return_address_${i}`) || '').trim();
      const passengers = Math.max(1, Math.floor(Number(fd.get(`car_num_passengers_${i}`) || 1) || 1));
      const childSeats = Math.max(0, Math.floor(Number(fd.get(`car_child_seats_${i}`) || 0) || 0));
      const fullInsurance = String(fd.get(`car_full_insurance_${i}`) || '') === 'on';
      const flightNumber = String(fd.get(`car_flight_number_${i}`) || '').trim();
      const special = String(fd.get(`car_special_requests_${i}`) || '').trim();
      const mergedSpecial = [special, globalNotes].filter(Boolean).join('\n');
      const loc = String(fd.get(`car_location_${i}`) || c?.location || 'paphos').toLowerCase() || 'paphos';

      const carModel = String(c?.car_model || c?.car_type || x.item?.data?.title || '').trim() || 'Car';

      carRows.push({
        full_name: customerName,
        email: customerEmail,
        phone: customerPhone,
        country: customerCountry,
        car_model: carModel,
        location: loc,
        pickup_date: pickupDate,
        pickup_time: pickupTime,
        pickup_location: pickupLoc,
        pickup_address: pickupAddr || null,
        return_date: returnDate,
        return_time: returnTime,
        return_location: returnLoc,
        return_address: returnAddr || null,
        num_passengers: passengers,
        child_seats: childSeats,
        full_insurance: fullInsurance,
        flight_number: flightNumber || null,
        special_requests: mergedSpecial || null,
        status: 'pending',
        source: 'planner',
        plan_id: currentPlan.id,
        created_by: createdBy,
        currency: (currentPlan?.currency || 'EUR').toUpperCase(),
      });
    });

    if (tripRows.length) {
      const { error } = await sb.from('trip_bookings').insert(tripRows);
      if (error) throw error;
    }
    if (hotelRows.length) {
      const { error } = await sb.from('hotel_bookings').insert(hotelRows);
      if (error) throw error;
    }
    if (carRows.length) {
      const { error } = await sb.from('car_bookings').insert(carRows);
      if (error) throw error;
    }

    setStatus(statusEl, 'Request sent. We will contact you shortly.', 'success');
    showToast('Booking request sent.', 'success');
    const dialog = bookingDialogEl();
    if (dialog && typeof dialog.close === 'function') dialog.close();
  } catch (e) {
    console.error('Planner booking submit failed', e);
    setStatus(statusEl, e?.message || 'Failed to send request.', 'error');
    showToast(e?.message || 'Failed to send request.', 'error');
  } finally {
    if (btn instanceof HTMLButtonElement) {
      btn.disabled = false;
      btn.textContent = 'Send request';
    }
  }
}

function wireEvents() {
  const form = el('planCreateForm');
  if (form instanceof HTMLFormElement) {
    form.addEventListener('submit', handleCreatePlan);
  }

  const refreshBtn = el('planRefreshBtn');
  if (refreshBtn instanceof HTMLButtonElement) {
    refreshBtn.addEventListener('click', async () => {
      if (currentPlan?.id) {
        await selectPlanById(currentPlan.id, { skipListReload: true });
        await loadPlans({ selectId: currentPlan.id });
      } else {
        await loadPlans();
      }
    });
  }

  const saveBtn = el('planSaveBtn');
  if (saveBtn instanceof HTMLButtonElement) {
    saveBtn.addEventListener('click', handleSavePlan);
  }

  const regenBtn = el('planRegenDaysBtn');
  if (regenBtn instanceof HTMLButtonElement) {
    regenBtn.addEventListener('click', regeneratePlanDays);
  }

  const delBtn = el('planDeleteBtn');
  if (delBtn instanceof HTMLButtonElement) {
    delBtn.addEventListener('click', handleDeletePlan);
  }

  const reqBtn = requestBookingBtnEl();
  if (reqBtn instanceof HTMLButtonElement && !reqBtn.dataset.wired) {
    reqBtn.addEventListener('click', async () => {
      if (!currentPlan?.id) return;
      const dialog = bookingDialogEl();
      if (!dialog || typeof dialog.showModal !== 'function') {
        const s = computePlanCostSummary();
        setStatus(requestBookingStatusEl(), `Collected: Trips ${formatMoney(s.tripsTotal, s.currency)}, Cars ${formatMoney(s.carsTotal, s.currency)}, Hotels ${formatMoney(s.hotelsTotal, s.currency)}.`, 'info');
        showToast('Booking form unavailable in this browser.', 'info');
        return;
      }
      await renderPlannerBookingForm();
      wirePlannerBookingDynamicAddressRequirements();
      setStatus(bookingFormStatusEl(), '', null);
      dialog.showModal();
    });
    reqBtn.dataset.wired = '1';
  }

  const closeBtn = bookingCloseBtnEl();
  if (closeBtn instanceof HTMLButtonElement && !closeBtn.dataset.wired) {
    closeBtn.addEventListener('click', () => {
      const dialog = bookingDialogEl();
      if (dialog && typeof dialog.close === 'function') dialog.close();
    });
    closeBtn.dataset.wired = '1';
  }

  const bookingForm = bookingFormEl();
  if (bookingForm instanceof HTMLFormElement && !bookingForm.dataset.wired) {
    bookingForm.addEventListener('submit', submitPlannerBookingForm);
    bookingForm.dataset.wired = '1';
  }

  window.addEventListener('hashchange', async () => {
    const id = parseHashPlanId();
    if (id) {
      await selectPlanById(id);
    }
  });
}

async function init() {
  const ok = await ensureSupabase();
  if (!ok) {
    setStatus(createStatusEl(), 'Supabase not ready. Please refresh the page.', 'error');
    setStatus(saveStatusEl(), 'Supabase not ready. Please refresh the page.', 'error');
    return;
  }

  setCurrentYear();

  wireEvents();

  try {
    sb.auth.onAuthStateChange(async () => {
      currentPlan = null;
      renderPlanDetails(null);
      await loadPlans();
    });
  } catch (_) {}

  await loadPlans();

  const hashId = parseHashPlanId();
  if (hashId) {
    await selectPlanById(hashId);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  void init();
}
