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

const el = (id) => document.getElementById(id);

const planListEl = () => el('planList');
const createStatusEl = () => el('planCreateStatus');

const emptyStateEl = () => el('planEmptyState');
const detailsWrapEl = () => el('planDetails');
const daysEl = () => el('planDays');
const catalogDaySelectEl = () => el('planCatalogDaySelect');
const catalogEl = () => el('planCatalog');

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
  const { data, error } = await sb.auth.getSession();
  if (error) return null;
  return data?.session?.user || null;
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
        const ppl = Number(currentPlan?.people_count || 0);
        const base = t?.price_per_person != null ? Number(t.price_per_person) : null;
        const price = base != null ? `${(ppl > 0 ? base * ppl : base).toFixed(2)} €${ppl > 0 ? ` (${ppl}×)` : ''}` : '';
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
        const slug = h?.slug || '';
        const url = slug ? `hotel.html?slug=${encodeURIComponent(slug)}` : 'hotels.html';
        return { id: h?.id, title, subtitle: city, price: '', url, lat: null, lng: null };
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
        return { id: c?.id, title, subtitle: [location, north].filter(Boolean).join(' • '), location, price: '', url, lat: null, lng: null };
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
    .select('id,user_id,title,start_date,end_date,days_count,base_city,include_north,currency,status,created_at,updated_at')
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
      const servicesHtml = serviceItems.length
        ? `
          <div style="border-top: 1px solid #e2e8f0; padding-top:0.5rem;">
            <div style="font-size:12px; color:#64748b; margin-bottom:0.25rem;">Services</div>
            <div style="display:grid; gap:0.5rem;">
              ${serviceItems
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

  if (titleEl instanceof HTMLInputElement) titleEl.value = plan.title || '';
  if (baseCityEl instanceof HTMLInputElement) baseCityEl.value = plan.base_city || '';
  if (startEl instanceof HTMLInputElement) startEl.value = plan.start_date || '';
  if (endEl instanceof HTMLInputElement) endEl.value = plan.end_date || '';
  if (includeNorthEl instanceof HTMLInputElement) includeNorthEl.checked = !!plan.include_north;
  if (peopleEl instanceof HTMLInputElement) peopleEl.value = plan.people_count != null ? String(plan.people_count) : '1';

  setStatus(saveStatusEl(), '', null);
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

  const title = titleEl instanceof HTMLInputElement ? titleEl.value.trim() : '';
  const baseCity = baseCityEl instanceof HTMLInputElement ? baseCityEl.value.trim() : '';
  const startDate = startEl instanceof HTMLInputElement ? startEl.value.trim() : '';
  const endDate = endEl instanceof HTMLInputElement ? endEl.value.trim() : '';
  const includeNorth = includeNorthEl instanceof HTMLInputElement ? includeNorthEl.checked : false;
  const peopleCount = peopleEl instanceof HTMLInputElement ? Number(peopleEl.value || 0) : 0;
  const cleanPeople = Number.isFinite(peopleCount) && peopleCount > 0 ? Math.floor(peopleCount) : 1;

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
