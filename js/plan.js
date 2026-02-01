import { showToast } from './toast.js';

let sb = typeof window !== 'undefined' && typeof window.getSupabase === 'function' ? window.getSupabase() : null;

let catalogData = {
  trips: [],
  hotels: [],
  cars: [],
  pois: [],
  recommendations: [],
  recommendationCategories: [],
};

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

async function ensureSupabaseSessionFromPersistedSnapshot({ timeoutMs = 5000, stepMs = 150 } = {}) {
  const client = sb || (typeof window !== 'undefined' && typeof window.getSupabase === 'function' ? window.getSupabase() : null);
  if (!client?.auth?.getSession || !client?.auth?.setSession) {
    return false;
  }

  try {
    const current = await client.auth.getSession();
    if (current?.data?.session) {
      return true;
    }
  } catch (_) {}

  const ceAuth = typeof window !== 'undefined' ? window.CE_AUTH : null;
  if (!ceAuth || typeof ceAuth.readPersistedSession !== 'function') {
    return false;
  }

  let snapshot = null;
  try {
    snapshot = ceAuth.readPersistedSession();
  } catch (_) {
    snapshot = null;
  }

  const snapSession = snapshot?.session;
  const access_token = typeof snapSession?.access_token === 'string' ? snapSession.access_token.trim() : '';
  const refresh_token = typeof snapSession?.refresh_token === 'string' ? snapSession.refresh_token.trim() : '';
  if (!access_token || !refresh_token) {
    return false;
  }

  try {
    await client.auth.setSession({ access_token, refresh_token });
  } catch (_) {
    return false;
  }

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const { data } = await client.auth.getSession();
      if (data?.session) {
        return true;
      }
    } catch (_) {}
    await new Promise((r) => setTimeout(r, stepMs));
  }

  return false;
}

function getRecommendationLatLngForItem(it) {
  const d = it?.data && typeof it.data === 'object' ? it.data : null;
  const lat = d && d.lat != null ? Number(d.lat) : null;
  const lng = d && d.lng != null ? Number(d.lng) : null;
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };

  const sourceId = d && d.source_id != null ? String(d.source_id) : null;
  const refId = it?.ref_id != null ? String(it.ref_id) : null;
  const match = catalogData.recommendations.find((r) => String(r?.id) === String(refId || sourceId));
  const ml = match && match.latitude != null ? Number(match.latitude) : null;
  const mg = match && match.longitude != null ? Number(match.longitude) : null;
  if (Number.isFinite(ml) && Number.isFinite(mg)) return { lat: ml, lng: mg };
  return null;
}

function getMapLatLngForItem(it) {
  const type = String(it?.item_type || '').trim();
  if (type === 'recommendation') return getRecommendationLatLngForItem(it);
  return getPoiLatLngForItem(it);
}

function buildPlanExportModel() {
  const plan = currentPlan;
  if (!plan || !plan.id) return null;
  const days = Array.from(planDaysById.values())
    .slice()
    .sort((a, b) => Number(a?.day_index || 0) - Number(b?.day_index || 0));

  const formatTimeRangeLabel = (data) => {
    const d = data && typeof data === 'object' ? data : {};
    const start = String(d.start_time || '').trim();
    const end = String(d.end_time || '').trim();
    if (start && end) return `${start}–${end}`;
    if (start) return start;
    return '';
  };

  const labelForType = (type) => {
    if (type === 'trip') return t('plan.ui.itemType.trip', 'Trip');
    if (type === 'hotel') return t('plan.ui.itemType.hotel', 'Hotel');
    if (type === 'car') return t('plan.ui.itemType.car', 'Car');
    if (type === 'poi') return t('plan.ui.itemType.poi', 'Place to see');
    if (type === 'note') return t('plan.ui.itemType.note', 'Note');
    return t('plan.ui.itemType.item', 'Item');
  };

  const dayModels = days.map((d) => {
    const items = Array.isArray(dayItemsByDayId.get(d.id)) ? dayItemsByDayId.get(d.id) : [];
    const rows = (items || [])
      .filter(Boolean)
      .sort((a, b) => Number(a?.sort_order || 0) - Number(b?.sort_order || 0))
      .map((it) => {
        const data = it?.data && typeof it.data === 'object' ? it.data : {};
        const resolved = resolveItemDisplay(it);
        const title = String(resolved?.title || data?.name || it?.title || '').trim();
        const subtitle = String(resolved?.subtitle || '').trim();
        const description = String(resolved?.description || '').trim();
        const price = String(resolved?.price || '').trim();
        const url = String(resolved?.url || '').trim();
        const notes = String(data?.notes || it?.notes || '').trim();
        const timeLabel = formatTimeRangeLabel(data);
        return {
          type: labelForType(it?.item_type),
          rawType: String(it?.item_type || ''),
          title: title || labelForType(it?.item_type),
          timeLabel,
          subtitle,
          description,
          price,
          url,
          notes,
        };
      });
    return {
      dayIndex: Number(d?.day_index || 0) || 0,
      date: d?.date ? String(d.date) : '',
      city: d?.city ? String(d.city) : '',
      notes: d?.notes ? String(d.notes) : '',
      items: rows,
    };
  });

  const party = getPartyForPlan(plan);
  const people = Math.max(1, Number(plan?.people_count || (party.adults + party.children) || 1) || 1);

  return {
    plan: {
      id: String(plan.id),
      title: String(plan?.title || '').trim(),
      baseCity: String(plan?.base_city || '').trim(),
      startDate: String(plan?.start_date || '').trim(),
      endDate: String(plan?.end_date || '').trim(),
      includeNorth: !!plan?.include_north,
      people,
      adults: Math.max(0, Number(party.adults || 0) || 0),
      children: Math.max(0, Number(party.children || 0) || 0),
    },
    days: dayModels,
  };
}

function buildPlanPrintHtml(model) {
  const p = model?.plan || {};
  const title = p.title || t('plan.print.title', 'Trip plan');
  const subtitle = [p.baseCity ? `${t('plan.print.base', 'Base')}: ${p.baseCity}` : '', p.startDate ? `${p.startDate} → ${p.endDate || ''}`.trim() : '']
    .filter(Boolean)
    .join(' • ');

  const brandLogoUrl = 'https://cypruseye.com/assets/cyprus_logo-1000x1054.png';

  const daysHtml = (model?.days || [])
    .map((d) => {
      const head = `${escapeHtml(t('plan.print.day', 'Day'))} ${escapeHtml(String(d.dayIndex || ''))}${d.date ? ` · ${escapeHtml(d.date)}` : ''}${d.city ? ` · ${escapeHtml(d.city)}` : ''}`;
      const items = (d.items || [])
        .map((it) => {
          const meta = [it.timeLabel, it.type, it.subtitle, it.price].filter(Boolean).join(' • ');
          const link = it.url ? `<div class="meta"><a href="${escapeHtml(it.url)}" target="_blank" rel="noopener">${escapeHtml(it.url)}</a></div>` : '';
          const desc = it.description ? `<div class="meta">${escapeHtml(it.description)}</div>` : '';
          const notes = it.notes ? `<div class="meta">${escapeHtml(it.notes)}</div>` : '';
          return `<div class="row">
            <div class="name">${escapeHtml(it.title || '')}</div>
            ${meta ? `<div class="meta">${escapeHtml(meta)}</div>` : ''}
            ${desc}
            ${link}
            ${notes}
          </div>`;
        })
        .join('');

      const dayNotes = d.notes ? `<div class="day-notes">${escapeHtml(d.notes)}</div>` : '';
      return `<section class="day">
        <h2>${head}</h2>
        ${dayNotes}
        ${items || `<div class="empty">${escapeHtml(t('plan.print.noItems', 'No items.'))}</div>`}
      </section>`;
    })
    .join('');

  const partyLine = `${escapeHtml(t('plan.print.people', 'People'))}: ${escapeHtml(String(p.people || 1))}${Number(p.adults) || Number(p.children) ? ` (${escapeHtml(t('plan.print.adults', 'Adults'))} ${escapeHtml(String(p.adults))}, ${escapeHtml(t('plan.print.children', 'Children'))} ${escapeHtml(String(p.children))})` : ''}`;

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(title)}</title>
      <style>
        :root{--fg:#0f172a;--muted:#475569;--border:#e2e8f0;--bg:#ffffff;}
        *{box-sizing:border-box;}
        body{margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color:var(--fg); background:var(--bg);}
        .wrap{max-width:920px; margin:0 auto; padding:28px;}
        header{display:flex; gap:12px; align-items:flex-start; justify-content:space-between; border-bottom:1px solid var(--border); padding-bottom:16px; margin-bottom:18px;}
        .hgroup h1{margin:0; font-size:22px; letter-spacing:-0.02em;}
        .hgroup .sub{margin-top:6px; color:var(--muted); font-size:12px;}
        .badge{display:inline-flex; align-items:center; gap:6px; font-size:12px; color:var(--muted);}
        .logo{height:34px; width:auto; display:block;}
        .day{border:1px solid var(--border); border-radius:14px; padding:14px 14px; margin:12px 0; break-inside:avoid;}
        .day h2{margin:0 0 10px; font-size:14px;}
        .day-notes{color:var(--muted); font-size:12px; margin-bottom:10px;}
        .row{padding:10px 10px; border:1px solid var(--border); border-radius:12px; margin:8px 0;}
        .name{font-weight:700; font-size:13px;}
        .meta{color:var(--muted); font-size:12px; margin-top:4px; word-break:break-word;}
        .empty{color:var(--muted); font-size:12px; padding:8px 0;}
        a{color:#2563eb; text-decoration:none;}
        @media print{
          .wrap{padding:0;}
          header{border:none; margin-bottom:12px; padding-bottom:0;}
          .day{page-break-inside:avoid;}
        }
      </style>
    </head>
    <body>
      <div class="wrap">
        <header>
          <div class="hgroup">
            <h1>${escapeHtml(title)}</h1>
            <div class="sub">${escapeHtml(subtitle)}</div>
            <div class="sub">${escapeHtml(partyLine)}</div>
          </div>
          <div style="display:grid; gap:8px; justify-items:end;">
            <img class="logo" src="${escapeHtml(brandLogoUrl)}" alt="CyprusEye" />
            <div class="badge">${escapeHtml(t('plan.print.generated', 'Generated'))}: ${escapeHtml(new Date().toISOString().slice(0, 10))}</div>
          </div>
        </header>
        ${daysHtml || ''}
      </div>
      <script>window.addEventListener('load', () => { setTimeout(() => { try { window.print(); } catch(e){} }, 120); });</script>
    </body>
  </html>`;
}

function downloadPlanPdf() {
  const model = buildPlanExportModel();
  if (!model) {
    showToast(t('plan.ui.toast.selectPlanFirst', 'Select a plan first.'), 'info');
    return;
  }
  const html = buildPlanPrintHtml(model);
  const w = window.open('', '_blank');
  if (!w) {
    showToast(t('plan.ui.toast.popupBlocked', 'Popup blocked. Allow popups to download PDF.'), 'error');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

async function emailPlanToUser() {
  if (!sb || !currentPlan?.id) {
    showToast(t('plan.ui.toast.selectPlanFirst', 'Select a plan first.'), 'info');
    return;
  }

  await waitForAuthReadySafe();
  try {
    const btn = el('planEmailBtn');
    if (btn instanceof HTMLButtonElement) {
      btn.disabled = true;
      btn.textContent = t('plan.ui.email.sending', 'Sending…');
    }
    const { data, error } = await sb.functions.invoke('send-plan-email', {
      body: { plan_id: String(currentPlan.id), lang: currentLang() },
    });
    if (error) throw error;
    if (data?.simulated) {
      showToast(t('plan.ui.toast.emailSimulated', 'Email simulated (SMTP not configured).'), 'info');
    } else {
      showToast(t('plan.ui.toast.emailSent', 'Plan emailed to your address.'), 'success');
    }
  } catch (e) {
    console.error('Failed to send plan email', e);
    const msg = String(e?.message || '').toLowerCase();
    if (msg.includes('failed to fetch') || msg.includes('cors') || msg.includes('functions')) {
      showToast(t('plan.ui.toast.emailFunctionUnavailable', 'Email function is not available (Edge Function not deployed or blocked).'), 'error');
    } else {
      showToast(e?.message || t('plan.ui.toast.emailFailed', 'Failed to send email.'), 'error');
    }
  } finally {
    const btn = el('planEmailBtn');
    if (btn instanceof HTMLButtonElement) {
      btn.disabled = false;
      btn.textContent = t('plan.actions.email', 'Email plan');
    }
  }
}

async function waitForSupabaseUser({ timeoutMs = 15000, stepMs = 250 } = {}) {
  const start = Date.now();

  try {
    await waitForAuthReadySafe({ timeoutMs: Math.min(7000, timeoutMs) });
  } catch (_) {}

  while (Date.now() - start < timeoutMs) {
    try {
      const stateUser = window?.CE_STATE?.session?.user || null;
      if (stateUser) return stateUser;
    } catch (_) {}

    try {
      if (sb?.auth?.getSession) {
        const { data, error } = await sb.auth.getSession();
        if (!error && data?.session?.user) return data.session.user;
      }
    } catch (_) {}

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
let recommendationsCategoryFilter = '';
let catalogLoadedForPlanId = null;
let catalogLangWired = false;

let lastSelectedDayIdForCatalog = '';

let hotelAmenitiesMap = {};
let hotelAmenitiesLoaded = false;

async function loadHotelAmenitiesForDisplay() {
  if (!sb || hotelAmenitiesLoaded) return;
  hotelAmenitiesLoaded = true;
  try {
    const { data } = await sb
      .from('hotel_amenities')
      .select('code, icon, name_en, name_pl, is_popular')
      .eq('is_active', true);
    if (Array.isArray(data)) {
      const next = {};
      data.forEach((a) => {
        if (a && a.code) next[String(a.code)] = a;
      });
      hotelAmenitiesMap = next;
    }
  } catch (e) {
    console.warn('Failed to load hotel amenities', e);
  }
}

function renderHotelAmenitiesChips(hotel) {
  const amenities = Array.isArray(hotel?.amenities) ? hotel.amenities : [];
  if (!amenities.length) return '';
  const lang = currentLang();
  const items = amenities
    .map((code) => hotelAmenitiesMap[String(code)] || null)
    .filter(Boolean)
    .sort((a, b) => (b.is_popular ? 1 : 0) - (a.is_popular ? 1 : 0))
    .slice(0, 12);
  if (!items.length) return '';
  return `<div class="ce-hotel-amenities">${items
    .map((a) => {
      const name = lang === 'en' ? a.name_en : (a.name_pl || a.name_en);
      const label = `${a.icon || ''} ${name || ''}`.trim();
      return label ? `<span class="ce-detail-chip">${escapeHtml(label)}</span>` : '';
    })
    .filter(Boolean)
    .join('')}</div>`;
}

function renderPlanDaysUi(planId, rows) {
  const container = daysEl();
  if (!container) return;

  const expandStorageKey = currentPlan?.id ? `cePlanExpand:${String(currentPlan.id)}` : '';
  const readExpandedState = () => {
    if (!expandStorageKey) return {};
    try {
      const raw = localStorage.getItem(expandStorageKey);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  };
  const writeExpandedState = (next) => {
    if (!expandStorageKey) return;
    try {
      localStorage.setItem(expandStorageKey, JSON.stringify(next && typeof next === 'object' ? next : {}));
    } catch (_) {
      // ignore
    }
  };
  const expandedState = readExpandedState();

  const isProbablyMapsUrl = (u) => {
    const s = String(u || '').toLowerCase();
    if (!s) return false;
    return s.includes('google.com/maps') || s.includes('maps.app.goo.gl') || s.includes('goo.gl/maps') || s.includes('openstreetmap.org');
  };
  const mapsUrlForItem = (it, src, resolved) => {
    const type = String(it?.item_type || '').trim();
    const s = src && typeof src === 'object' ? src : {};
    if (type === 'recommendation') {
      const lat = s?.latitude != null ? Number(s.latitude) : (s?.lat != null ? Number(s.lat) : null);
      const lng = s?.longitude != null ? Number(s.longitude) : (s?.lng != null ? Number(s.lng) : null);
      const fallback = Number.isFinite(lat) && Number.isFinite(lng) ? `https://www.google.com/maps?q=${lat},${lng}` : '';
      return String(s?.google_url || s?.google_maps_url || fallback || '').trim();
    }
    if (type === 'poi') {
      const d = it?.data && typeof it.data === 'object' ? it.data : {};
      const lat = d?.lat != null ? Number(d.lat) : null;
      const lng = d?.lng != null ? Number(d.lng) : null;
      const fallback = Number.isFinite(lat) && Number.isFinite(lng) ? `https://www.google.com/maps?q=${lat},${lng}` : '';
      const u = String(resolved?.url || '').trim();
      return String(fallback || (isProbablyMapsUrl(u) ? u : '') || '').trim();
    }
    const u = String(resolved?.url || '').trim();
    return isProbablyMapsUrl(u) ? u : '';
  };
  const websiteUrlForItem = (it, src, resolved) => {
    const type = String(it?.item_type || '').trim();
    const s = src && typeof src === 'object' ? src : {};
    if (type === 'recommendation') {
      return String(s?.website_url || s?.url || '').trim();
    }
    const u = String(resolved?.url || '').trim();
    return isProbablyMapsUrl(u) ? '' : u;
  };
  const quickActionsHtml = (it, src, resolved) => {
    const mapsUrl = mapsUrlForItem(it, src, resolved);
    const webUrl = websiteUrlForItem(it, src, resolved);
    if (!mapsUrl && !webUrl) return '';
    return `
      <div class="ce-quick-actions" aria-label="${escapeHtml(t('plan.ui.common.actions', 'Actions'))}">
        ${mapsUrl ? `<a href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener" class="ce-qa" aria-label="${escapeHtml(t('plan.ui.recommendations.openMaps', 'Open in maps'))}">📍</a>` : ''}
        ${webUrl ? `<a href="${escapeHtml(webUrl)}" target="_blank" rel="noopener" class="ce-qa" aria-label="${escapeHtml(t('plan.ui.common.open', 'Open'))}">🔗</a>` : ''}
      </div>
    `;
  };

  const safeRows = Array.isArray(rows) ? rows : [];
  if (!safeRows.length) {
    container.innerHTML = `<div style="color:#64748b;">${escapeHtml(t('plan.ui.days.noDays', 'No days generated yet.'))}</div>`;
    return;
  }

  container.innerHTML = safeRows
    .map((d) => {
      const dayWord = t('plan.ui.common.day', 'Day');
      const label = d.date ? `${dayWord} ${d.day_index} · ${d.date}` : `${dayWord} ${d.day_index}`;
      const city = (d.city || '').trim();
      const notes = (d.notes || '').trim();
      const items = Array.isArray(dayItemsByDayId.get(d.id)) ? dayItemsByDayId.get(d.id) : [];
      const noteItems = items.filter((it) => it && it.item_type === 'note');
      const serviceItems = items.filter((it) => it && it.item_type && it.item_type !== 'note');
      const poiItems = serviceItems.filter((it) => it && it.item_type === 'poi');
      const mapItems = serviceItems.filter((it) => it && (it.item_type === 'poi' || it.item_type === 'recommendation'));
      const nonPoiServiceItems = serviceItems.filter((it) => it && it.item_type && it.item_type !== 'poi');
      const servicesHtml = serviceItems.length
        ? `
          <div style="border-top: 1px solid #e2e8f0; padding-top:0.5rem;">
            <div style="font-size:12px; color:#64748b; margin-bottom:0.25rem;">${escapeHtml(t('plan.ui.days.services', 'Services'))}</div>
            <div class="ce-day-dnd-list" data-day-dnd-list="services" data-day-id="${escapeHtml(String(d.id || ''))}" style="display:grid; gap:0.5rem;">
              ${nonPoiServiceItems
                .map((it) => {
                  const typeLabel = getServiceTypeLabel(it.item_type);
                  const resolved = resolveItemDisplay(it);
                  const title = String(resolved?.title || '');
                  const subtitle = String(resolved?.subtitle || '');
                  const description = String(resolved?.description || '');
                  const url = String(resolved?.url || '');
                  const price = String(resolved?.price || '');
                  const image = String(resolved?.image || '');
                  const src = resolveCatalogEntryForItem(it);
                  const panelId = `ceDayDetail_${String(it.id || '').replace(/[^a-zA-Z0-9_-]/g, '')}`;
                  const isPanelOpen = !!expandedState[panelId];
                  const rangeStart = it?.data && typeof it.data === 'object' ? Number(it.data.range_start_day_index || 0) : 0;
                  const rangeEnd = it?.data && typeof it.data === 'object' ? Number(it.data.range_end_day_index || 0) : 0;
                  const rangeId = it?.data && typeof it.data === 'object' ? String(it.data.range_id || '') : '';
                  const rangeBadge = rangeId && rangeStart > 0 && rangeEnd > 0 ? ` (${escapeHtml(t('plan.print.day', 'Day'))} ${rangeStart}–${escapeHtml(t('plan.print.day', 'Day'))} ${rangeEnd})` : '';
                  const thumb = image ? `<a href="${escapeHtml(image)}" target="_blank" rel="noopener"><img src="${escapeHtml(image)}" alt="" loading="lazy" style="width:64px; height:48px; object-fit:cover; border-radius:8px; border:1px solid #e2e8f0;" /></a>` : '';
                  const preview = (it.item_type === 'hotel' || it.item_type === 'trip' || it.item_type === 'recommendation') ? '' : (description ? `<div style=\"color:#475569; font-size:12px;\">${escapeHtml(description)}</div>` : '');
                  const more = src ? renderExpandablePanel({ panelId, type: it.item_type, src, resolved, open: isPanelOpen }) : '';
                  const qa = quickActionsHtml(it, src, resolved);
                  return `
                    <div class="ce-day-item-row" data-dnd-item-id="${escapeHtml(String(it.id || ''))}" data-dnd-day-id="${escapeHtml(String(d.id || ''))}" data-dnd-kind="services" style="display:flex; gap:0.5rem; align-items:flex-start; justify-content:space-between;">
                      ${thumb ? `<div style="flex:0 0 auto;">${thumb}</div>` : ''}
                      <div class="ce-day-item-main" style="flex:1 1 auto; min-width:0;">
                        <div style="font-size:12px; color:#64748b;">${escapeHtml(typeLabel)}</div>
                        <div style="color:#0f172a; font-weight:600;">${escapeHtml(title)}${escapeHtml(rangeBadge)}</div>
                        ${subtitle ? `<div style=\"color:#64748b; font-size:12px;\">${escapeHtml(subtitle)}</div>` : ''}
                        ${preview}
                        ${more}
                        ${price ? `<div style=\"color:#0f172a; font-size:12px;\">${escapeHtml(price)}</div>` : ''}
                      </div>
                      <div class="ce-day-item-actions" style="display:flex; gap:0.5rem; flex-wrap:wrap; justify-content:flex-end;">
                        <button type="button" class="btn btn-sm" data-order-move="up" aria-label="${escapeHtml(t('plan.ui.common.moveUp', 'Move up'))}">↑</button>
                        <button type="button" class="btn btn-sm" data-order-move="down" aria-label="${escapeHtml(t('plan.ui.common.moveDown', 'Move down'))}">↓</button>
                        ${qa}
                        <button type="button" class="btn btn-sm" data-day-item-delete="${it.id}" data-range-id="${escapeHtml(rangeId)}" aria-label="${escapeHtml(t('plan.ui.common.delete', 'Delete'))}">✕</button>
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
          const sorted = [...poiItems];
          return `
            <div style="border-top: 1px solid #e2e8f0; padding-top:0.5rem;">
              <div style="font-size:12px; color:#64748b; margin-bottom:0.25rem;">${escapeHtml(t('plan.ui.days.placesSchedule', 'Places (schedule)'))}</div>
              <div class="ce-day-dnd-list" data-day-dnd-list="pois" data-day-id="${escapeHtml(String(d.id || ''))}" style="display:grid; gap:0.5rem;">
                ${sorted
                  .map((it) => {
                    const resolved = resolveItemDisplay(it);
                    const title = String(resolved?.title || '');
                    const description = String(resolved?.description || '');
                    const url = String(resolved?.url || '');
                    const image = String(resolved?.image || '');
                    const src = resolveCatalogEntryForItem(it);
                    const panelId = `ceDayPoiDetail_${String(it.id || '').replace(/[^a-zA-Z0-9_-]/g, '')}`;
                    const isPanelOpen = !!expandedState[panelId];
                    const timeLabel = formatPoiTimeLabel(it);
                    const thumb = image ? `<a href="${escapeHtml(image)}" target="_blank" rel="noopener"><img src="${escapeHtml(image)}" alt="" loading="lazy" style="width:64px; height:48px; object-fit:cover; border-radius:8px; border:1px solid #e2e8f0;" /></a>` : '';
                    const startV = it?.data && typeof it.data === 'object' ? String(it.data.start_time || '') : '';
                    const endV = it?.data && typeof it.data === 'object' ? String(it.data.end_time || '') : '';
                    const preview = description ? `<div style=\"color:#475569; font-size:12px; margin-top:0.25rem;\">${escapeHtml(description)}</div>` : '';
                    const more = src ? renderExpandablePanel({ panelId, type: 'poi', src, resolved, open: isPanelOpen }) : '';
                    const qa = quickActionsHtml(it, src, resolved);
                    return `
                      <div class="ce-day-item-row ce-day-item-row--poi" data-dnd-item-id="${escapeHtml(String(it.id || ''))}" data-dnd-day-id="${escapeHtml(String(d.id || ''))}" data-dnd-kind="pois" style="display:flex; gap:0.5rem; align-items:flex-start; justify-content:space-between;">
                        ${thumb ? `<div style="flex:0 0 auto;">${thumb}</div>` : ''}
                        <div class="ce-day-item-main" style="flex:1 1 auto; min-width:0;">
                          <div style="display:flex; gap:0.5rem; align-items:baseline; flex-wrap:wrap;">
                            <div style="color:#0f172a; font-weight:600;">${escapeHtml(title || t('plan.ui.days.placeFallback', 'Place'))}</div>
                            ${timeLabel ? `<div style=\"color:#64748b; font-size:12px;\">${escapeHtml(timeLabel)}</div>` : ''}
                          </div>
                          ${preview}
                          ${more}
                          <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.25rem;">
                            <label style="display:flex; gap:0.25rem; align-items:center; font-size:12px; color:#0f172a;">
                              ${escapeHtml(t('plan.ui.days.start', 'Start'))}
                              <input type="time" value="${escapeHtml(startV)}" data-poi-time-start="${it.id}" style="max-width:120px;" />
                            </label>
                            <label style="display:flex; gap:0.25rem; align-items:center; font-size:12px; color:#0f172a;">
                              ${escapeHtml(t('plan.ui.days.end', 'End'))}
                              <input type="time" value="${escapeHtml(endV)}" data-poi-time-end="${it.id}" style="max-width:120px;" />
                            </label>
                            <button type="button" class="btn btn-sm" data-poi-time-save="${it.id}">${escapeHtml(t('plan.ui.days.saveTime', 'Save time'))}</button>
                          </div>
                        </div>
                        <div class="ce-day-item-actions" style="display:flex; gap:0.5rem; flex-wrap:wrap; justify-content:flex-end;">
                          <button type="button" class="btn btn-sm" data-order-move="up" aria-label="${escapeHtml(t('plan.ui.common.moveUp', 'Move up'))}">↑</button>
                          <button type="button" class="btn btn-sm" data-order-move="down" aria-label="${escapeHtml(t('plan.ui.common.moveDown', 'Move down'))}">↓</button>
                          ${qa}
                          <button type="button" class="btn btn-sm" data-day-item-delete="${it.id}" aria-label="${escapeHtml(t('plan.ui.common.delete', 'Delete'))}">✕</button>
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
          <div class="ce-day-dnd-list" data-day-dnd-list="notes" data-day-id="${escapeHtml(String(d.id || ''))}" style="margin-top:0.5rem; display:grid; gap:0.5rem;">
            ${noteItems
              .map((it) => {
                const text = it?.data && typeof it.data === 'object' ? String(it.data.text || '').trim() : '';
                return `
                  <div class="ce-day-item-row ce-day-item-row--note" data-dnd-item-id="${escapeHtml(String(it.id || ''))}" data-dnd-day-id="${escapeHtml(String(d.id || ''))}" data-dnd-kind="notes" style="display:flex; gap:0.5rem; align-items:flex-start;">
                    <div style="display:flex; flex-direction:column; gap:0.25rem;">
                      <button type="button" class="btn btn-sm" data-order-move="up" aria-label="${escapeHtml(t('plan.ui.common.moveUp', 'Move up'))}">↑</button>
                      <button type="button" class="btn btn-sm" data-order-move="down" aria-label="${escapeHtml(t('plan.ui.common.moveDown', 'Move down'))}">↓</button>
                    </div>
                    <div style="flex:1 1 auto; color:#475569;">${escapeHtml(text)}</div>
                    <button type="button" class="btn btn-sm" data-day-item-delete="${it.id}" aria-label="${escapeHtml(t('plan.ui.common.delete', 'Delete'))}">✕</button>
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
            <button type="button" class="btn btn-sm" data-day-quick-add="trip" data-day-id="${d.id}">${escapeHtml(t('plan.ui.days.addTrip', 'Add trip'))}</button>
            <button type="button" class="btn btn-sm" data-day-quick-add="hotel" data-day-id="${d.id}">${escapeHtml(t('plan.ui.days.addHotel', 'Add hotel'))}</button>
            <button type="button" class="btn btn-sm" data-day-quick-add="car" data-day-id="${d.id}">${escapeHtml(t('plan.ui.days.addCar', 'Add car'))}</button>
            <button type="button" class="btn btn-sm" data-day-quick-add="pois" data-day-id="${d.id}">${escapeHtml(t('plan.ui.days.addPlaces', 'Add places'))}</button>
            <button type="button" class="btn btn-sm" data-day-map-open="${d.id}">🗺️ ${escapeHtml(t('plan.ui.days.map', 'Map'))}</button>
          </div>
          <div style="margin-top:0.5rem; display:grid; gap:0.5rem;">
            <div style="display:grid; gap:0.25rem;">
              <label style="font-size:12px; color:#64748b;" for="dayCity_${d.id}">${escapeHtml(t('plan.ui.days.city', 'City'))}</label>
              <input id="dayCity_${d.id}" type="text" value="${escapeHtml(city)}" data-day-city="${d.id}" placeholder="${escapeHtml(t('plan.ui.days.city', 'City'))}" list="ceCityOptions" />
            </div>
            <div style="display:grid; gap:0.25rem;">
              <label style="font-size:12px; color:#64748b;" for="dayNotes_${d.id}">${escapeHtml(t('plan.ui.days.dayNotes', 'Day notes'))}</label>
              <textarea id="dayNotes_${d.id}" rows="2" data-day-notes="${d.id}" placeholder="${escapeHtml(t('plan.ui.days.notesPlaceholder', 'Notes'))}">${escapeHtml(notes)}</textarea>
            </div>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
              <button type="button" class="btn btn-sm" data-day-save="${d.id}">${escapeHtml(t('plan.ui.days.saveDay', 'Save day'))}</button>
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

  safeRows.forEach((d) => {
    const items = Array.isArray(dayItemsByDayId.get(d.id)) ? dayItemsByDayId.get(d.id) : [];
    const serviceItems = items.filter((it) => it && it.item_type && it.item_type !== 'note');
    const mapItems = serviceItems.filter((it) => it && (it.item_type === 'poi' || it.item_type === 'recommendation'));
    renderDayMap(d.id, mapItems);
  });

  container.querySelectorAll('[data-day-save]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const dayId = btn.getAttribute('data-day-save');
      if (!dayId) return;
      const cityEl = container.querySelector(`[data-day-city="${dayId}"]`);
      const notesEl = container.querySelector(`[data-day-notes="${dayId}"]`);
      const statusEl = container.querySelector(`[data-day-status="${dayId}"]`);

      const city = cityEl instanceof HTMLInputElement ? cityEl.value.trim() : '';
      const notes = notesEl instanceof HTMLTextAreaElement ? notesEl.value.trim() : '';

      if (statusEl instanceof HTMLElement) statusEl.textContent = t('plan.ui.status.saving', 'Saving…');
      const updated = await updateDayField(dayId, { city: city || null, notes: notes || null });
      if (updated) {
        if (statusEl instanceof HTMLElement) statusEl.textContent = t('plan.ui.status.saved', 'Saved.');
        const prev = planDaysById.get(dayId) || {};
        planDaysById.set(dayId, { ...prev, ...updated });
        renderServiceCatalog();
      } else {
        if (statusEl instanceof HTMLElement) statusEl.textContent = t('plan.ui.status.error', 'Error.');
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

      lastSelectedDayIdForCatalog = dayId;
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

  // Expand / collapse details panels (modern UI)
  container.querySelectorAll('[data-expand-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-expand-toggle');
      if (!target) return;
      const panel = container.querySelector(`#${CSS.escape(target)}`);
      if (!(panel instanceof HTMLElement)) return;
      const isHidden = panel.hasAttribute('hidden');
      const nextState = readExpandedState();
      if (isHidden) {
        panel.removeAttribute('hidden');
        panel.classList.add('ce-expand-panel--open');
        panel.style.maxHeight = '0px';
        panel.offsetHeight;
        const inner = panel.querySelector('.ce-expand-panel__inner');
        const h = inner instanceof HTMLElement ? inner.scrollHeight : panel.scrollHeight;
        panel.style.maxHeight = `${Math.max(120, h)}px`;
        window.setTimeout(() => {
          if (panel.classList.contains('ce-expand-panel--open')) {
            panel.style.maxHeight = 'none';
          }
        }, 220);
        nextState[target] = true;
      } else {
        const inner = panel.querySelector('.ce-expand-panel__inner');
        const h = inner instanceof HTMLElement ? inner.scrollHeight : panel.scrollHeight;
        panel.style.maxHeight = `${Math.max(120, h)}px`;
        panel.offsetHeight;
        panel.style.maxHeight = '0px';
        window.setTimeout(() => {
          panel.classList.remove('ce-expand-panel--open');
          panel.setAttribute('hidden', '');
        }, 180);
        delete nextState[target];
      }
      writeExpandedState(nextState);
      btn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
      const icon = btn.querySelector('.ce-expand-btn__icon');
      if (icon instanceof HTMLElement) icon.textContent = isHidden ? '−' : '+';
    });
  });

  container.querySelectorAll('[data-expand-toggle]').forEach((btn) => {
    const target = btn.getAttribute('data-expand-toggle');
    if (!target) return;
    if (!expandedState[target]) return;
    const panel = container.querySelector(`#${CSS.escape(target)}`);
    if (!(panel instanceof HTMLElement)) return;
    if (!panel.hasAttribute('hidden')) return;
    panel.removeAttribute('hidden');
    panel.classList.add('ce-expand-panel--open');
    panel.style.maxHeight = 'none';
    btn.setAttribute('aria-expanded', 'true');
    const icon = btn.querySelector('.ce-expand-btn__icon');
    if (icon instanceof HTMLElement) icon.textContent = '−';
  });

  // Promo code reveal (login-gated) for recommendation cards inside day panels
  container.querySelectorAll('[data-rec-promo-btn]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const promo = btn.getAttribute('data-rec-promo-btn') || '';
      if (!promo) return;
      const card = btn.closest('[data-rec-card]');
      const codeEl = card ? card.querySelector('[data-rec-promo-code]') : null;
      if (!(codeEl instanceof HTMLElement)) return;
      if (codeEl.dataset.visible === '1') return;

      await ensureLoggedInForPromo(() => {
        codeEl.textContent = promo;
        codeEl.dataset.visible = '1';
      });
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

      const prev = findDayItem(itemId);
      const prevData = prev?.data && typeof prev.data === 'object' ? prev.data : {};
      const nextData = { ...prevData, start_time: start || null, end_time: end || null };
      const updated = await updatePlanItemData(itemId, nextData);
      if (updated) {
        await loadPlanDays(planId);
      }
    });
  });

  renderPlanCostSummary();

  container.querySelectorAll('[data-day-map-open]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dayId = btn.getAttribute('data-day-map-open');
      if (!dayId) return;
      const items = Array.isArray(dayItemsByDayId.get(dayId)) ? dayItemsByDayId.get(dayId) : [];
      const serviceItems = items.filter((it) => it && it.item_type && it.item_type !== 'note');
      const mapItems = serviceItems.filter((it) => it && (it.item_type === 'poi' || it.item_type === 'recommendation'));
      openDayMapOverlay(dayId, mapItems);
    });
  });

  wirePlanItemsReorderButtons(container);
}

function wirePlanItemsReorderButtons(container) {
  if (!(container instanceof HTMLElement)) return;

  container.querySelectorAll('[data-order-move]').forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const dir = String(btn.getAttribute('data-order-move') || '').trim();
      const row = btn.closest('[data-dnd-item-id]');
      const list = btn.closest('[data-day-dnd-list]');
      if (!(row instanceof HTMLElement) || !(list instanceof HTMLElement)) return;

      const kind = String(list.getAttribute('data-day-dnd-list') || '').trim();
      const dayId = String(list.getAttribute('data-day-id') || '').trim();
      if (!kind || !dayId) return;

      const sib = dir === 'up' ? row.previousElementSibling : row.nextElementSibling;
      if (!(sib instanceof HTMLElement)) return;
      if (sib.getAttribute('data-dnd-item-id') == null) return;

      if (dir === 'up') {
        list.insertBefore(row, sib);
      } else {
        const after = sib.nextElementSibling;
        list.insertBefore(row, after);
      }

      const ok = await persistDndListOrder({ dayId, kind, listEl: list });
      if (ok) {
        await loadPlanDays(currentPlan?.id);
      }
    });
  });
}

let cePlanDndState = { draggingId: '', fromDayId: '', kind: '', el: null };

function dndSortBase(kind) {
  if (kind === 'notes') return 0;
  if (kind === 'services') return 1000000;
  if (kind === 'pois') return 2000000;
  return 1000000;
}

async function persistDndListOrder({ dayId, kind, listEl }) {
  if (!sb || !dayId || !(listEl instanceof HTMLElement)) return false;
  const rows = Array.from(listEl.querySelectorAll('[data-dnd-item-id]'));
  const ids = rows
    .map((r) => (r instanceof HTMLElement ? String(r.getAttribute('data-dnd-item-id') || '').trim() : ''))
    .filter(Boolean);
  const base = dndSortBase(kind);
  const payloads = ids.map((id, idx) => ({ id, plan_day_id: dayId, sort_order: base + idx * 10 }));
  if (!payloads.length) return true;
  try {
    for (const p of payloads) {
      const { error } = await sb
        .from('user_plan_items')
        .update({ plan_day_id: p.plan_day_id, sort_order: p.sort_order })
        .eq('id', p.id);
      if (error) {
        showToast(error.message || t('plan.ui.toast.failedToUpdateItem', 'Failed to update item'), 'error');
        return false;
      }
    }
    return true;
  } catch (e) {
    showToast(String(e?.message || e || t('plan.ui.toast.failedToUpdateItem', 'Failed to update item')), 'error');
    return false;
  }
}

function wirePlanItemsDragDrop(container) {
  if (!(container instanceof HTMLElement)) return;

  container.querySelectorAll('[data-dnd-item-id]').forEach((row) => {
    if (!(row instanceof HTMLElement)) return;
    const handle = row.querySelector('.ce-dnd-handle');
    if (handle instanceof HTMLElement) {
      wireTouchDndHandle({ container, row, handle });
    }
    row.addEventListener('dragstart', (e) => {
      const id = String(row.getAttribute('data-dnd-item-id') || '').trim();
      const dayId = String(row.getAttribute('data-dnd-day-id') || '').trim();
      const kind = String(row.getAttribute('data-dnd-kind') || '').trim();
      if (!id || !dayId || !kind) return;
      cePlanDndState = { draggingId: id, fromDayId: dayId, kind, el: row };
      row.classList.add('ce-dnd-dragging');
      try {
        if (e && e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', id);
        }
      } catch (_) {}
    });

    row.addEventListener('dragend', () => {
      row.classList.remove('ce-dnd-dragging');
      cePlanDndState = { draggingId: '', fromDayId: '', kind: '', el: null };
    });
  });

  container.querySelectorAll('[data-day-dnd-list]').forEach((list) => {
    if (!(list instanceof HTMLElement)) return;
    list.addEventListener('dragleave', () => {
      list.classList.remove('ce-dnd-over');
    });
    list.addEventListener('dragover', (e) => {
      if (!cePlanDndState.draggingId) return;
      const kind = String(list.getAttribute('data-day-dnd-list') || '').trim();
      if (kind !== cePlanDndState.kind) return;
      e.preventDefault();
      list.classList.add('ce-dnd-over');
      try {
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      } catch (_) {}

      const draggingEl = cePlanDndState.el;
      if (!(draggingEl instanceof HTMLElement)) return;

      const targetRow = (e.target instanceof HTMLElement) ? e.target.closest('[data-dnd-item-id]') : null;
      if (!(targetRow instanceof HTMLElement) || targetRow === draggingEl) {
        if (draggingEl.parentElement === list) {
          list.appendChild(draggingEl);
        }
        return;
      }

      const rect = targetRow.getBoundingClientRect();
      const before = e.clientY < rect.top + rect.height / 2;
      if (before) list.insertBefore(draggingEl, targetRow);
      else list.insertBefore(draggingEl, targetRow.nextSibling);
    });

    list.addEventListener('drop', async (e) => {
      if (!cePlanDndState.draggingId) return;
      const kind = String(list.getAttribute('data-day-dnd-list') || '').trim();
      if (kind !== cePlanDndState.kind) return;
      e.preventDefault();
      list.classList.remove('ce-dnd-over');
      const toDayId = String(list.getAttribute('data-day-id') || '').trim();
      const fromDayId = cePlanDndState.fromDayId;
      const draggingEl = cePlanDndState.el;
      if (!(draggingEl instanceof HTMLElement) || !toDayId || !fromDayId) return;

      draggingEl.setAttribute('data-dnd-day-id', toDayId);
      const fromList = container.querySelector(`[data-day-dnd-list="${escapeCss(kind)}"][data-day-id="${escapeCss(fromDayId)}"]`);

      const ok1 = await persistDndListOrder({ dayId: toDayId, kind, listEl: list });
      const ok2 = (fromList instanceof HTMLElement) ? await persistDndListOrder({ dayId: fromDayId, kind, listEl: fromList }) : true;
      if (ok1 && ok2) {
        await loadPlanDays(currentPlan?.id);
      }
    });
  });
}

function wireTouchDndHandle({ container, row, handle }) {
  if (!(container instanceof HTMLElement)) return;
  if (!(row instanceof HTMLElement)) return;
  if (!(handle instanceof HTMLElement)) return;

  let active = false;
  let startTimer = 0;

  const clear = () => {
    active = false;
    if (startTimer) window.clearTimeout(startTimer);
    startTimer = 0;
    row.classList.remove('ce-dnd-dragging');
    cePlanDndState = { draggingId: '', fromDayId: '', kind: '', el: null };
  };

  const start = () => {
    const id = String(row.getAttribute('data-dnd-item-id') || '').trim();
    const dayId = String(row.getAttribute('data-dnd-day-id') || '').trim();
    const kind = String(row.getAttribute('data-dnd-kind') || '').trim();
    if (!id || !dayId || !kind) return;
    active = true;
    cePlanDndState = { draggingId: id, fromDayId: dayId, kind, el: row };
    row.classList.add('ce-dnd-dragging');
  };

  const findListAtPoint = (x, y) => {
    try {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      const el = document.elementFromPoint(x, y);
      if (!(el instanceof HTMLElement)) return null;
      return el.closest('[data-day-dnd-list]');
    } catch (_) {
      return null;
    }
  };

  const move = (x, y) => {
    if (!active) return;
    const list = findListAtPoint(x, y);
    if (!(list instanceof HTMLElement)) return;
    const kind = String(list.getAttribute('data-day-dnd-list') || '').trim();
    if (!kind || kind !== cePlanDndState.kind) return;

    let at = null;
    try {
      at = document.elementFromPoint(x, y);
    } catch (_) {
      at = null;
    }
    const targetRow = (at instanceof HTMLElement) ? at.closest('[data-dnd-item-id]') : null;
    if (!(targetRow instanceof HTMLElement) || targetRow === row) {
      if (row.parentElement === list) list.appendChild(row);
      else list.appendChild(row);
      return;
    }
    try {
      const rect = targetRow.getBoundingClientRect();
      const before = y < rect.top + rect.height / 2;
      if (before) list.insertBefore(row, targetRow);
      else list.insertBefore(row, targetRow.nextSibling);
    } catch (_) {}
  };

  const end = async (x, y) => {
    if (!active) {
      clear();
      return;
    }
    const list = findListAtPoint(x, y);
    const kind = cePlanDndState.kind;
    const fromDayId = cePlanDndState.fromDayId;
    const toDayId = list instanceof HTMLElement ? String(list.getAttribute('data-day-id') || '').trim() : '';
    if (list instanceof HTMLElement && toDayId && kind) {
      row.setAttribute('data-dnd-day-id', toDayId);
      const fromList = container.querySelector(`[data-day-dnd-list="${escapeCss(kind)}"][data-day-id="${escapeCss(fromDayId)}"]`);
      const ok1 = await persistDndListOrder({ dayId: toDayId, kind, listEl: list });
      const ok2 = (fromList instanceof HTMLElement) ? await persistDndListOrder({ dayId: fromDayId, kind, listEl: fromList }) : true;
      if (ok1 && ok2) {
        await loadPlanDays(currentPlan?.id);
      }
    }
    clear();
  };

  const getXY = (ev) => {
    if (ev && ev.touches && ev.touches[0]) return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
    if (ev && ev.changedTouches && ev.changedTouches[0]) return { x: ev.changedTouches[0].clientX, y: ev.changedTouches[0].clientY };
    return { x: ev.clientX, y: ev.clientY };
  };

  handle.addEventListener('touchstart', (ev) => {
    if (startTimer) window.clearTimeout(startTimer);
    startTimer = window.setTimeout(() => {
      start();
    }, 160);
    void ev;
  }, { passive: true });

  handle.addEventListener('touchmove', (ev) => {
    if (!active) return;
    ev.preventDefault();
    const { x, y } = getXY(ev);
    move(x, y);
  }, { passive: false });

  handle.addEventListener('touchend', async (ev) => {
    if (startTimer) window.clearTimeout(startTimer);
    startTimer = 0;
    const { x, y } = getXY(ev);
    await end(x, y);
  }, { passive: true });

  handle.addEventListener('touchcancel', () => {
    clear();
  }, { passive: true });
}

function escapeCss(v) {
  return String(v || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

let ceDayMapOverlayState = {
  map: null,
  markers: [],
  watchId: null,
  userMarker: null,
  userAccuracyCircle: null,
  lastUserLatLng: null,
  lastUserAccuracyM: null,
  follow: false,
  animFrame: null,
  animFrom: null,
  animTo: null,
  animStartedAt: 0,
  animDurationMs: 650,
};

function ensureDayMapOverlay() {
  if (typeof document === 'undefined') return null;
  let root = document.getElementById('ceDayMapOverlay');
  if (root) return root;
  root = document.createElement('div');
  root.id = 'ceDayMapOverlay';
  root.hidden = true;
  root.innerHTML = `
    <div class="ce-map-ov__backdrop" data-ce-map-ov-close="1"></div>
    <div class="ce-map-ov__panel" role="dialog" aria-modal="true">
      <div class="ce-map-ov__top">
        <div class="ce-map-ov__title" data-ce-map-ov-title="1"></div>
        <div class="ce-map-ov__actions">
          <button type="button" class="btn btn-sm" data-ce-map-ov-follow="1">🧭</button>
          <button type="button" class="btn btn-sm" data-ce-map-ov-locate="1">📍</button>
          <button type="button" class="btn btn-sm" data-ce-map-ov-recenter="1">🎯</button>
          <button type="button" class="btn btn-sm" data-ce-map-ov-close="1">✕</button>
        </div>
      </div>
      <div class="ce-map-ov__body">
        <div class="ce-map-ov__map" id="ceDayMapOverlayMap"></div>
        <div class="ce-map-ov__list" id="ceDayMapOverlayList"></div>
      </div>
    </div>
  `;
  document.body.appendChild(root);
  return root;
}

function closeDayMapOverlay() {
  const root = document.getElementById('ceDayMapOverlay');
  if (!(root instanceof HTMLElement)) return;
  root.hidden = true;
  document.body.classList.remove('ce-map-ov-open');
  ceDayMapOverlayState.follow = false;
  if (ceDayMapOverlayState.animFrame != null) {
    try {
      cancelAnimationFrame(ceDayMapOverlayState.animFrame);
    } catch (_) {}
  }
  ceDayMapOverlayState.animFrame = null;
  ceDayMapOverlayState.animFrom = null;
  ceDayMapOverlayState.animTo = null;
  if (ceDayMapOverlayState.watchId != null && typeof navigator !== 'undefined' && navigator.geolocation) {
    try {
      navigator.geolocation.clearWatch(ceDayMapOverlayState.watchId);
    } catch (_) {
    }
  }
  ceDayMapOverlayState.watchId = null;
}

function openDayMapOverlay(dayId, items) {
  const root = ensureDayMapOverlay();
  if (!(root instanceof HTMLElement)) return;

  const titleEl = root.querySelector('[data-ce-map-ov-title]');
  const dayModel = planDaysById.get(dayId) || {};
  const dayWord = t('plan.ui.common.day', 'Day');
  const label = dayModel?.date ? `${dayWord} ${dayModel?.day_index} · ${dayModel?.date}` : `${dayWord} ${dayModel?.day_index || ''}`.trim();
  if (titleEl instanceof HTMLElement) titleEl.textContent = label;

  root.hidden = false;
  document.body.classList.add('ce-map-ov-open');

  const mapEl = root.querySelector('#ceDayMapOverlayMap');
  const listEl = root.querySelector('#ceDayMapOverlayList');
  if (!(mapEl instanceof HTMLElement) || !(listEl instanceof HTMLElement)) return;

  const points = (items || [])
    .map((it) => {
      const ll = getMapLatLngForItem(it);
      if (!ll) return null;
      const resolved = resolveItemDisplay(it);
      const type = String(it?.item_type || '').trim();
      const title = String(resolved?.title || '').trim() || (type === 'poi' ? t('plan.ui.days.placeFallback', 'Place') : t('plan.ui.common.item', 'Item'));
      return { id: String(it?.id || ''), type, title, lat: ll.lat, lng: ll.lng };
    })
    .filter(Boolean);

  if (!points.length) {
    listEl.innerHTML = `<div style="color:#64748b; padding:0.75rem;">${escapeHtml(t('plan.ui.days.noMapPoints', 'No map points for this day.'))}</div>`;
    return;
  }

  const first = points[0];
  const ensureMap = () => {
    try {
      if (typeof L === 'undefined') return null;
    } catch (_) {
      return null;
    }
    if (ceDayMapOverlayState.map) return ceDayMapOverlayState.map;
    const map = L.map(mapEl, { zoomControl: true, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    ceDayMapOverlayState.map = map;
    return map;
  };

  const map = ensureMap();
  if (!map) return;
  map.setView([first.lat, first.lng], 12);
  window.setTimeout(() => {
    try {
      map.invalidateSize();
    } catch (_) {
    }
  }, 120);

  for (const m of ceDayMapOverlayState.markers) {
    try {
      map.removeLayer(m);
    } catch (_) {
    }
  }
  ceDayMapOverlayState.markers = [];

  const bounds = [];
  points.forEach((p, idx) => {
    const num = idx + 1;
    const icon = L.divIcon({
      className: 'ce-map-ov__pin',
      html: `<div class="ce-map-ov__pin-inner">${num}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    const marker = L.marker([p.lat, p.lng], { icon }).addTo(map);
    marker.bindPopup(escapeHtml(p.title));
    ceDayMapOverlayState.markers.push(marker);
    bounds.push([p.lat, p.lng]);
  });
  if (bounds.length > 1) {
    try {
      map.fitBounds(bounds, { padding: [30, 30] });
    } catch (_) {
    }
  }

  const rowIcon = (type) => {
    if (type === 'poi') return '📌';
    if (type === 'recommendation') return '⭐';
    return '•';
  };

  const persistMapPointsOrder = async (nextPoints) => {
    if (!sb || !dayId) return false;
    const ids = Array.isArray(nextPoints) ? nextPoints.map((p) => String(p?.id || '').trim()).filter(Boolean) : [];
    if (!ids.length) return true;
    const base = 1500000;
    const payloads = ids.map((id, idx) => ({ id, plan_day_id: dayId, sort_order: base + idx * 10 }));
    try {
      for (const p of payloads) {
        const { error } = await sb
          .from('user_plan_items')
          .update({ plan_day_id: p.plan_day_id, sort_order: p.sort_order })
          .eq('id', p.id);
        if (error) {
          showToast(error.message || t('plan.ui.toast.failedToUpdateItem', 'Failed to update item'), 'error');
          return false;
        }
      }
      return true;
    } catch (e) {
      showToast(String(e?.message || e || t('plan.ui.toast.failedToUpdateItem', 'Failed to update item')), 'error');
      return false;
    }
  };

  listEl.innerHTML = `
    <div class="ce-map-ov__list-head">${escapeHtml(t('plan.ui.days.points', 'Points'))}</div>
    <div class="ce-map-ov__list-items">
      ${points
        .map((p, idx) => {
          const num = idx + 1;
          return `
            <div class="ce-map-ov__row" style="display:flex; gap:0.5rem; align-items:center;">
              <button type="button" class="ce-map-ov__row-focus" data-ce-map-ov-focus="${escapeHtml(String(idx))}" style="display:flex; gap:0.5rem; align-items:center; flex:1 1 auto; min-width:0;">
                <span class="ce-map-ov__row-num">${escapeHtml(String(num))}</span>
                <span class="ce-map-ov__row-ico" aria-hidden="true">${escapeHtml(rowIcon(p.type))}</span>
                <span class="ce-map-ov__row-title" style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(p.title)}</span>
              </button>
              <span class="ce-map-ov__row-move" style="display:flex; gap:0.25rem;">
                <button type="button" class="btn btn-sm" data-ce-map-ov-move="up" data-ce-map-ov-idx="${escapeHtml(String(idx))}" aria-label="${escapeHtml(t('plan.ui.common.moveUp', 'Move up'))}">↑</button>
                <button type="button" class="btn btn-sm" data-ce-map-ov-move="down" data-ce-map-ov-idx="${escapeHtml(String(idx))}" aria-label="${escapeHtml(t('plan.ui.common.moveDown', 'Move down'))}">↓</button>
              </span>
            </div>
          `;
        })
        .join('')}
    </div>
  `;

  const onFocusClick = (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const mv = t.closest('[data-ce-map-ov-move]');
    if (mv instanceof HTMLElement) {
      e.preventDefault();
      e.stopPropagation();
      const dir = String(mv.getAttribute('data-ce-map-ov-move') || '').trim();
      const idx = Number(mv.getAttribute('data-ce-map-ov-idx'));
      if (!Number.isFinite(idx)) return;
      const next = points.slice();
      const to = dir === 'up' ? idx - 1 : idx + 1;
      if (to < 0 || to >= next.length) return;
      const tmp = next[idx];
      next[idx] = next[to];
      next[to] = tmp;
      (async () => {
        const ok = await persistMapPointsOrder(next);
        if (!ok) return;
        await loadPlanDays(currentPlan?.id);
        const refreshed = Array.isArray(dayItemsByDayId.get(dayId)) ? dayItemsByDayId.get(dayId) : [];
        const refreshedServices = refreshed.filter((it) => it && it.item_type && it.item_type !== 'note');
        const refreshedMapItems = refreshedServices.filter((it) => it && (it.item_type === 'poi' || it.item_type === 'recommendation'));
        openDayMapOverlay(dayId, refreshedMapItems);
      })();
      return;
    }
    const btn = t.closest('[data-ce-map-ov-focus]');
    if (!(btn instanceof HTMLElement)) return;
    const i = Number(btn.getAttribute('data-ce-map-ov-focus'));
    if (!Number.isFinite(i) || i < 0 || i >= points.length) return;
    const p = points[i];
    try {
      map.setView([p.lat, p.lng], Math.max(14, map.getZoom() || 14), { animate: true });
      const marker = ceDayMapOverlayState.markers[i];
      if (marker) marker.openPopup();
    } catch (_) {
    }
  };
  listEl.onclick = onFocusClick;

  const closeBtns = root.querySelectorAll('[data-ce-map-ov-close]');
  closeBtns.forEach((b) => {
    b.onclick = () => closeDayMapOverlay();
  });

  const recenterBtn = root.querySelector('[data-ce-map-ov-recenter]');
  if (recenterBtn instanceof HTMLElement) {
    recenterBtn.onclick = () => {
      try {
        if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30] });
        else map.setView([first.lat, first.lng], 13, { animate: true });
      } catch (_) {
      }
    };
  }

  const locateBtn = root.querySelector('[data-ce-map-ov-locate]');
  if (locateBtn instanceof HTMLElement) {
    locateBtn.onclick = () => {
      startUserLocationWatch(map);
      if (ceDayMapOverlayState.lastUserLatLng) {
        const u = ceDayMapOverlayState.lastUserLatLng;
        try {
          map.setView([u.lat, u.lng], Math.max(15, map.getZoom() || 15), { animate: true });
        } catch (_) {
        }
      }
    };
  }

  const followBtn = root.querySelector('[data-ce-map-ov-follow]');
  if (followBtn instanceof HTMLElement) {
    followBtn.setAttribute('aria-pressed', ceDayMapOverlayState.follow ? 'true' : 'false');
    followBtn.onclick = () => {
      ceDayMapOverlayState.follow = !ceDayMapOverlayState.follow;
      followBtn.setAttribute('aria-pressed', ceDayMapOverlayState.follow ? 'true' : 'false');
      if (ceDayMapOverlayState.follow) {
        startUserLocationWatch(map);
        if (ceDayMapOverlayState.lastUserLatLng) {
          const u = ceDayMapOverlayState.lastUserLatLng;
          try {
            map.setView([u.lat, u.lng], Math.max(15, map.getZoom() || 15), { animate: true });
          } catch (_) {}
        }
      }
    };
  }
}

function startUserLocationWatch(map) {
  if (!map) return;
  if (ceDayMapOverlayState.watchId != null) return;
  if (typeof navigator === 'undefined' || !navigator.geolocation) return;

  const icon = (typeof L !== 'undefined')
    ? L.divIcon({
      className: 'ce-map-ov__me',
      html: `<div class="ce-map-ov__me-avatar" data-ce-map-me="1"></div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    })
    : null;

  const setAccuracyCircle = (lat, lng, accuracyM) => {
    if (typeof L === 'undefined') return;
    if (!Number.isFinite(Number(accuracyM)) || Number(accuracyM) <= 0) return;
    ceDayMapOverlayState.lastUserAccuracyM = Number(accuracyM);
    if (!ceDayMapOverlayState.userAccuracyCircle) {
      try {
        ceDayMapOverlayState.userAccuracyCircle = L.circle([lat, lng], {
          radius: Math.max(10, Math.min(500, Number(accuracyM))),
          color: 'rgba(56,189,248,.65)',
          weight: 1,
          fillColor: 'rgba(56,189,248,.20)',
          fillOpacity: 0.35,
        }).addTo(map);
      } catch (_) {}
      return;
    }
    try {
      ceDayMapOverlayState.userAccuracyCircle.setLatLng([lat, lng]);
      ceDayMapOverlayState.userAccuracyCircle.setRadius(Math.max(10, Math.min(500, Number(accuracyM))));
    } catch (_) {}
  };

  const smoothSetUserLatLng = (lat, lng) => {
    const next = { lat: Number(lat), lng: Number(lng) };
    if (!Number.isFinite(next.lat) || !Number.isFinite(next.lng)) return;

    if (!icon) {
      ceDayMapOverlayState.lastUserLatLng = next;
      return;
    }

    if (!ceDayMapOverlayState.userMarker) {
      try {
        ceDayMapOverlayState.userMarker = L.marker([next.lat, next.lng], { icon }).addTo(map);
      } catch (_) {}
      ceDayMapOverlayState.lastUserLatLng = next;
      return;
    }

    const prev = ceDayMapOverlayState.lastUserLatLng || next;
    ceDayMapOverlayState.animFrom = { lat: prev.lat, lng: prev.lng };
    ceDayMapOverlayState.animTo = { lat: next.lat, lng: next.lng };
    ceDayMapOverlayState.animStartedAt = performance && typeof performance.now === 'function' ? performance.now() : Date.now();

    if (ceDayMapOverlayState.animFrame != null) {
      try {
        cancelAnimationFrame(ceDayMapOverlayState.animFrame);
      } catch (_) {}
    }

    const step = () => {
      const now = performance && typeof performance.now === 'function' ? performance.now() : Date.now();
      const t = Math.max(0, Math.min(1, (now - ceDayMapOverlayState.animStartedAt) / ceDayMapOverlayState.animDurationMs));
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const a = ceDayMapOverlayState.animFrom;
      const b = ceDayMapOverlayState.animTo;
      if (!a || !b) return;
      const ilat = a.lat + (b.lat - a.lat) * ease;
      const ilng = a.lng + (b.lng - a.lng) * ease;
      try {
        ceDayMapOverlayState.userMarker.setLatLng([ilat, ilng]);
      } catch (_) {}
      if (ceDayMapOverlayState.follow) {
        try {
          map.panTo([ilat, ilng], { animate: true });
        } catch (_) {}
      }
      if (t < 1) {
        ceDayMapOverlayState.animFrame = requestAnimationFrame(step);
      } else {
        ceDayMapOverlayState.animFrame = null;
        ceDayMapOverlayState.lastUserLatLng = { lat: b.lat, lng: b.lng };
      }
    };

    ceDayMapOverlayState.animFrame = requestAnimationFrame(step);
  };

  try {
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos?.coords?.latitude;
        const lng = pos?.coords?.longitude;
        const acc = pos?.coords?.accuracy;
        if (typeof lat !== 'number' || typeof lng !== 'number') return;
        smoothSetUserLatLng(lat, lng);
        if (typeof acc === 'number') setAccuracyCircle(lat, lng, acc);
      },
      () => {
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 12000 }
    );
    ceDayMapOverlayState.watchId = id;
  } catch (_) {
  }
}

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

const LAST_SELECTED_PLAN_KEY = 'ce_last_selected_plan_id_v1';

function getLastSelectedPlanId() {
  try {
    const v = localStorage.getItem(LAST_SELECTED_PLAN_KEY);
    return v && isUuid(v) ? v : null;
  } catch (_) {
    return null;
  }
}

function setLastSelectedPlanId(id) {
  try {
    if (!id) {
      localStorage.removeItem(LAST_SELECTED_PLAN_KEY);
      return;
    }
    localStorage.setItem(LAST_SELECTED_PLAN_KEY, String(id));
  } catch (_) {}
}

async function getCurrentUser() {
  if (!sb) return null;

  return await waitForSupabaseUser();
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
  const viaDom = document.documentElement.lang || '';
  const viaSwitcher = typeof window.getCurrentLanguage === 'function' ? window.getCurrentLanguage() : '';
  const lang = viaDom || viaSwitcher || (window.appI18n && window.appI18n.language) || 'pl';
  return String(lang || 'pl');
}

function t(key, fallback) {
  const lang = currentLang();
  const dict = window.appI18n && window.appI18n.translations ? window.appI18n.translations[lang] : null;
  if (!dict || typeof dict !== 'object') return fallback;

  if (key && typeof dict[key] === 'string') {
    return dict[key];
  }

  const parts = String(key || '').split('.').filter(Boolean);
  let cur = dict;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return fallback;
    cur = cur[p];
  }
  return typeof cur === 'string' ? cur : fallback;
}

function pickI18nValue(i18nObj, fallback) {
  const fallbackStr = typeof fallback === 'string' ? fallback : '';
  if (!i18nObj || typeof i18nObj !== 'object') return fallbackStr;
  const lang = currentLang();
  const v = i18nObj[lang] || i18nObj.en || i18nObj.pl || fallbackStr;
  return typeof v === 'string' ? v : fallbackStr;
}

function normalizeStr(v) {
  return String(v || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function cityKey(v) {
  const s = normalizeStr(v);
  if (!s) return '';
  if (s.includes('paphos') || s.includes('pafos') || s.includes('πάφος')) return 'paphos';
  if (s.includes('larnaca') || s.includes('larnaka') || s.includes('λάρνακα') || s.includes('lάρνακα')) return 'larnaca';
  if (s.includes('limassol') || s.includes('lemesos') || s.includes('lemessos') || s.includes('λιμεσός')) return 'limassol';
  if (s.includes('nicosia') || s.includes('lefkosia') || s.includes('λευκωσία')) return 'nicosia';
  if (s.includes('ayia napa') || s.includes('agia napa') || s.includes('napa')) return 'ayia napa';
  if (s.includes('protaras') || s.includes('paralimni')) return 'protaras';
  return s;
}

function cityMatches(a, b) {
  const aa = cityKey(a);
  const bb = cityKey(b);
  if (!aa || !bb) return false;
  return aa === bb || aa.includes(bb) || bb.includes(aa);
}

function isAllCitiesLabel(v) {
  const s = normalizeStr(v);
  if (!s) return false;
  return s === 'all cities' || s === 'all city' || s === 'wszystkie miasta';
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
  const selectedDayId = lastSelectedDayIdForCatalog || '';
  const day = selectedDayId ? planDaysById.get(selectedDayId) : null;
  const city = (day?.city || currentPlan?.base_city || '').trim();
  const includeNorth = !!currentPlan?.include_north;
  return { city, includeNorth };
}

function getTripTitle(trip) {
  if (typeof window.getTripName === 'function') return window.getTripName(trip);
  return trip?.title?.pl || trip?.title?.en || trip?.title || trip?.slug || t('plan.ui.itemType.trip', 'Trip');
}

function getTripDescriptionText(trip) {
  if (!trip || typeof trip !== 'object') return '';
  const parseI18nString = (maybeJsonStr) => {
    if (typeof maybeJsonStr !== 'string') return null;
    const s = String(maybeJsonStr || '').trim();
    if (!s) return null;
    if (!(s.startsWith('{') || s.startsWith('['))) return null;
    try {
      const parsed = JSON.parse(s);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (_) {}
    return null;
  };
  if (typeof window.getTripDescription === 'function') {
    const d = window.getTripDescription(trip);
    if (d && String(d).trim()) {
      const parsed = parseI18nString(d);
      if (parsed && typeof parsed === 'object') {
        const picked = pickI18nValue(parsed, '');
        if (picked && String(picked).trim()) return String(picked);
      }
      return String(d);
    }
  }
  const descObjRaw = trip.description_i18n || trip.description;
  const descObj =
    (descObjRaw && typeof descObjRaw === 'object')
      ? descObjRaw
      : parseI18nString(descObjRaw);
  if (descObj && typeof descObj === 'object') {
    const d = pickI18nValue(descObj, '');
    if (d && String(d).trim()) return String(d);
  }
  if (typeof trip.description === 'string') {
    const parsed = parseI18nString(trip.description);
    if (parsed && typeof parsed === 'object') {
      const d = pickI18nValue(parsed, '');
      if (d && String(d).trim()) return String(d);
    }
    return trip.description;
  }
  return '';
}

function getHotelTitle(hotel) {
  if (typeof window.getHotelName === 'function') return window.getHotelName(hotel);
  return hotel?.title?.pl || hotel?.title?.en || hotel?.title || hotel?.slug || t('plan.ui.itemType.hotel', 'Hotel');
}

function getHotelDescriptionText(hotel) {
  if (!hotel || typeof hotel !== 'object') return '';
  if (typeof window.getHotelDescription === 'function') {
    const d = window.getHotelDescription(hotel);
    if (d && String(d).trim()) return String(d);
  }
  const descObj = hotel.description_i18n || hotel.description;
  if (descObj && typeof descObj === 'object') {
    const d = pickI18nValue(descObj, '');
    if (d && String(d).trim()) return String(d);
  }
  if (typeof hotel.description === 'string') return hotel.description;
  return '';
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
  return car?.car_model || car?.car_type || t('plan.ui.itemType.car', 'Car');
}

function getCarDescription(car) {
  return pickI18nValue(car?.description_i18n, car?.description || '');
}

function getPoiTitle(poi) {
  const raw = poi && typeof poi === 'object' && poi.raw && typeof poi.raw === 'object' ? poi.raw : null;
  const name = pickI18nValue((raw && raw.name_i18n) || poi?.name_i18n, (raw && raw.name) || poi?.name || t('plan.ui.itemType.poiShort', 'POI'));
  return name || t('plan.ui.itemType.poiShort', 'POI');
}

function getPoiDescription(poi) {
  const raw = poi && typeof poi === 'object' && poi.raw && typeof poi.raw === 'object' ? poi.raw : null;
  return pickI18nValue((raw && raw.description_i18n) || poi?.description_i18n, (raw && raw.description) || poi?.description || '');
}

function getPoiCategory(poi) {
  const raw = poi && typeof poi === 'object' && poi.raw && typeof poi.raw === 'object' ? poi.raw : null;
  const val =
    pickI18nValue((raw && raw.category_i18n) || poi?.category_i18n, (raw && raw.category) || poi?.category || '') ||
    String((raw && (raw.area || raw.region || raw.city_area)) || poi?.area || poi?.region || '').trim();
  return String(val || '').trim();
}

function getItemSourceRef(it) {
  if (!it) return null;
  const refId = it?.ref_id != null ? String(it.ref_id) : '';
  if (refId) return refId;
  const d = it?.data && typeof it.data === 'object' ? it.data : null;
  const sourceId = d && d.source_id != null ? String(d.source_id) : '';
  return sourceId || null;
}

function resolveCatalogEntryForItem(it) {
  const itemType = String(it?.item_type || '').trim();
  const ref = getItemSourceRef(it);
  if (!ref) return null;

  if (itemType === 'trip') return catalogData.trips.find((x) => String(x?.id) === ref) || null;
  if (itemType === 'hotel') return catalogData.hotels.find((x) => String(x?.id) === ref) || null;
  if (itemType === 'car') return catalogData.cars.find((x) => String(x?.id) === ref) || null;
  if (itemType === 'poi') return catalogData.pois.find((x) => String(x?.id) === ref) || null;
  if (itemType === 'recommendation') return catalogData.recommendations.find((x) => String(x?.id) === ref) || null;
  return null;
}

function resolveItemDisplay(it) {
  const d = it?.data && typeof it.data === 'object' ? it.data : {};
  const itemType = String(it?.item_type || '').trim();
  const src = resolveCatalogEntryForItem(it);

  const currency = (currentPlan?.currency || 'EUR').toUpperCase();
  const party = getPartyForPlan(currentPlan);
  const people = Math.max(1, Number(currentPlan?.people_count || (party.adults + party.children) || 1) || 1);
  const rangeStart = Number(d.range_start_day_index || 0) || 0;
  const rangeEnd = Number(d.range_end_day_index || 0) || 0;
  const rangeDays = rangeStart > 0 && rangeEnd > 0 ? Math.max(1, Math.abs(rangeEnd - rangeStart) + 1) : 1;

  if (itemType === 'trip' && src) {
    const total = calcTripTotal(src, { adults: party.adults, children: party.children, hours: 1, days: 1 });
    return {
      title: getTripTitle(src),
      subtitle: String(src?.start_city || '').trim(),
      description: getTripDescriptionText(src),
      url: d.url ? String(d.url) : (src?.slug ? `trip.html?slug=${encodeURIComponent(String(src.slug))}` : ''),
      price: total ? String(formatMoney(total, currency)).trim() : '',
      image: String(d.image || getServiceImageUrl('trip', src) || '').trim(),
    };
  }

  if (itemType === 'hotel' && src) {
    const nights = Math.max(1, rangeDays - 1);
    const res = calculateHotelPrice(src || {}, people, nights);
    const total = Number(res?.total || 0) || 0;
    const slug = src?.slug ? String(src.slug) : '';
    const urlFallback = slug ? `hotel.html?slug=${encodeURIComponent(slug)}` : 'hotels.html';
    return {
      title: getHotelTitle(src),
      subtitle: getHotelCity(src),
      description: getHotelDescriptionText(src),
      url: String(d.url || urlFallback).trim(),
      price: total ? String(formatMoney(total, currency)).trim() : '',
      image: String(d.image || getServiceImageUrl('hotel', src) || '').trim(),
    };
  }

  if (itemType === 'car' && src) {
    const location = String(src?.location || '').trim();
    const north = src?.north_allowed ? t('plan.ui.catalog.northOk', 'north ok') : '';
    const total = calcCarTotal(src || {}, { location: src?.location, days: rangeDays });
    const computed = total ? String(formatMoney(total, currency)).trim() : '';
    const from = getCarFromPricePerDay(src);
    const fromOnly = from != null ? `${Number(from).toFixed(0)}€ ${t('plan.ui.pricing.perDay', '/ day')}` : '';
    return {
      title: getCarTitle(src),
      subtitle: [location, north].filter(Boolean).join(' • '),
      description: getCarDescription(src),
      url: String(d.url || getCarLink(src) || '').trim(),
      price: String(computed || d.price || fromOnly).trim(),
      image: String(d.image || getServiceImageUrl('car', src) || '').trim(),
    };
  }

  if (itemType === 'poi' && src) {
    const urlFallback =
      src?.google_url ||
      src?.google_maps_url ||
      (src?.lat != null && src?.lng != null ? `https://www.google.com/maps?q=${src.lat},${src.lng}` : '');
    return {
      title: getPoiTitle(src),
      subtitle: '',
      description: getPoiDescription(src),
      url: String(d.url || urlFallback || '').trim(),
      price: String(d.price || '').trim(),
      image: String(d.image || getServiceImageUrl('poi', src) || '').trim(),
    };
  }

  if (itemType === 'recommendation' && src) {
    const lang = currentLang();
    const isPolish = lang === 'pl';
    const title = isPolish ? (src?.title_pl || src?.title_en || '') : (src?.title_en || src?.title_pl || '');
    const description = isPolish
      ? (src?.description_pl || src?.description_en || '')
      : (src?.description_en || src?.description_pl || '');
    const discountText = isPolish
      ? (src?.discount_text_pl || src?.discount_text_en || '')
      : (src?.discount_text_en || src?.discount_text_pl || '');

    const lat = src?.latitude != null ? Number(src.latitude) : (src?.lat != null ? Number(src.lat) : null);
    const lng = src?.longitude != null ? Number(src.longitude) : (src?.lng != null ? Number(src.lng) : null);
    const mapsFallback = Number.isFinite(lat) && Number.isFinite(lng) ? `https://www.google.com/maps?q=${lat},${lng}` : '';
    const mapsUrl = String(src?.google_url || src?.google_maps_url || mapsFallback || '').trim();
    const websiteUrl = String(src?.website_url || src?.url || '').trim();
    const url = String(d.url || mapsUrl || websiteUrl || '').trim();

    const cat = src?.recommendation_categories && typeof src.recommendation_categories === 'object' ? src.recommendation_categories : {};
    const catName = isPolish ? (cat?.name_pl || cat?.name_en || '') : (cat?.name_en || cat?.name_pl || '');
    const catIcon = cat?.icon || '📍';
    const subtitle = [catIcon, catName].filter(Boolean).join(' ').trim();

    return {
      title: String(title || '').trim(),
      subtitle: subtitle,
      description: String(description || '').trim(),
      url,
      price: String(discountText || d.price || '').trim(),
      image: String(d.image || getServiceImageUrl('recommendation', src) || '').trim(),
    };
  }

  return {
    title: String(d.title || '').trim(),
    subtitle: String(d.subtitle || '').trim(),
    description: String(d.description || '').trim(),
    url: String(d.url || '').trim(),
    price: String(d.price || '').trim(),
    image: String(d.image || '').trim(),
  };
}

function getServiceImageUrl(type, obj) {
  try {
    const photos = obj && Array.isArray(obj.photos) ? obj.photos : null;
    const gallery = obj && Array.isArray(obj.gallery) ? obj.gallery : null;
    const direct = obj && (obj.cover_image_url || obj.image_url || obj.thumbnail_url || obj.main_image_url || obj.featured_image_url || obj.photo_url || obj.image || obj.cover || obj.thumbnail);
    const arrFirst = (photos && photos[0]) || (gallery && gallery[0]) || null;
    const val = direct || arrFirst;
    return val ? String(val) : '';
  } catch (_) {
    return '';
  }
}

function getServiceImageUrls(type, obj) {
  try {
    const urls = [];
    const direct = obj && (obj.cover_image_url || obj.main_image_url || obj.featured_image_url || obj.image_url || obj.thumbnail_url || obj.photo_url || obj.image || obj.cover || obj.thumbnail);
    if (direct) urls.push(String(direct));

    const photos = obj && Array.isArray(obj.photos) ? obj.photos : null;
    const gallery = obj && Array.isArray(obj.gallery) ? obj.gallery : null;
    const extras = (photos || []).concat(gallery || []);
    extras.forEach((u) => {
      if (!u) return;
      urls.push(String(u));
    });

    const seen = new Set();
    return urls
      .map((u) => String(u).trim())
      .filter(Boolean)
      .filter((u) => {
        const key = u;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 12);
  } catch (_) {
    return [];
  }
}

function renderGalleryHtml(urls, { alt = '' } = {}) {
  const list = Array.isArray(urls) ? urls.filter(Boolean) : [];
  if (!list.length) return '';
  return `
    <div class="ce-detail-gallery" role="group" aria-label="Gallery">
      ${list
        .map(
          (u) =>
            `<button type="button" class="ce-detail-gallery__item" data-ce-gallery-item="1"><img src="${escapeHtml(
              u
            )}" alt="${escapeHtml(alt)}" loading="lazy" /></button>`
        )
        .join('')}
    </div>
  `;
}

let ceLightboxState = { urls: [], index: 0 };

function ensureCeLightbox() {
  if (typeof document === 'undefined') return null;
  let root = document.getElementById('ceLightbox');
  if (root) return root;
  root = document.createElement('div');
  root.id = 'ceLightbox';
  root.hidden = true;
  root.innerHTML = `
    <div class="ce-lightbox__backdrop" data-ce-lightbox-close="1"></div>
    <div class="ce-lightbox__panel" role="dialog" aria-modal="true">
      <button type="button" class="ce-lightbox__close" aria-label="Close" data-ce-lightbox-close="1">×</button>
      <button type="button" class="ce-lightbox__nav ce-lightbox__prev" aria-label="Previous" data-ce-lightbox-prev="1">‹</button>
      <button type="button" class="ce-lightbox__nav ce-lightbox__next" aria-label="Next" data-ce-lightbox-next="1">›</button>
      <img class="ce-lightbox__img" alt="" />
    </div>
  `;
  document.body.appendChild(root);

  const close = () => {
    root.hidden = true;
    document.body.classList.remove('ce-lightbox-open');
  };
  const show = () => {
    const img = root.querySelector('.ce-lightbox__img');
    if (!(img instanceof HTMLImageElement)) return;
    const u = ceLightboxState.urls[ceLightboxState.index] || '';
    img.src = u;
  };

  root.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.closest('[data-ce-lightbox-close]')) {
      close();
      return;
    }
    if (t.closest('[data-ce-lightbox-prev]')) {
      if (ceLightboxState.urls.length) {
        ceLightboxState.index = (ceLightboxState.index - 1 + ceLightboxState.urls.length) % ceLightboxState.urls.length;
        show();
      }
      return;
    }
    if (t.closest('[data-ce-lightbox-next]')) {
      if (ceLightboxState.urls.length) {
        ceLightboxState.index = (ceLightboxState.index + 1) % ceLightboxState.urls.length;
        show();
      }
      return;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (root.hidden) return;
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (e.key === 'ArrowLeft') {
      if (ceLightboxState.urls.length) {
        ceLightboxState.index = (ceLightboxState.index - 1 + ceLightboxState.urls.length) % ceLightboxState.urls.length;
        show();
      }
      return;
    }
    if (e.key === 'ArrowRight') {
      if (ceLightboxState.urls.length) {
        ceLightboxState.index = (ceLightboxState.index + 1) % ceLightboxState.urls.length;
        show();
      }
    }
  });

  root.__ceShow = show;
  return root;
}

let ceLightboxWired = false;

function wireCeLightboxDelegation() {
  if (ceLightboxWired) return;
  ceLightboxWired = true;

  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    const coverBtn = t.closest('[data-ce-lightbox-urls]');
    if (coverBtn instanceof HTMLElement) {
      const rawUrls = coverBtn.getAttribute('data-ce-lightbox-urls') || '';
      if (rawUrls) {
        try {
          const decoded = decodeURIComponent(rawUrls);
          const urls = JSON.parse(decoded);
          const idx = Number(coverBtn.getAttribute('data-ce-lightbox-index') || 0) || 0;
          if (Array.isArray(urls) && urls.length) {
            ceLightboxState = { urls: urls.map((u) => String(u || '')).filter(Boolean), index: Math.max(0, Math.min(idx, urls.length - 1)) };
            const lb = ensureCeLightbox();
            if (!lb) return;
            document.body.classList.add('ce-lightbox-open');
            lb.hidden = false;
            if (typeof lb.__ceShow === 'function') lb.__ceShow();
            return;
          }
        } catch (_) {
          // ignore
        }
      }
    }

    const btn = t.closest('[data-ce-gallery-item]');
    if (!(btn instanceof HTMLElement)) return;
    const gallery = btn.closest('.ce-detail-gallery');
    if (!(gallery instanceof HTMLElement)) return;
    const imgs = Array.from(gallery.querySelectorAll('img'));
    const urls = imgs.map((im) => (im instanceof HTMLImageElement ? im.currentSrc || im.src : '')).filter(Boolean);
    if (!urls.length) return;
    const clickedImg = btn.querySelector('img');
    const clickedSrc = clickedImg instanceof HTMLImageElement ? (clickedImg.currentSrc || clickedImg.src) : '';
    let idx = clickedSrc ? urls.indexOf(clickedSrc) : -1;
    if (idx < 0) idx = 0;
    ceLightboxState = { urls, index: idx };
    const lb = ensureCeLightbox();
    if (!lb) return;
    document.body.classList.add('ce-lightbox-open');
    lb.hidden = false;
    if (typeof lb.__ceShow === 'function') lb.__ceShow();
  });
}

function renderDetailsHtml(type, src, resolved) {
  const safeType = String(type || '').trim();
  const s = src && typeof src === 'object' ? src : {};
  const r = resolved && typeof resolved === 'object' ? resolved : {};
  const title = String(r.title || '').trim();
  const desc = String(r.description || '').trim();

  const techDetails = (rowsHtml) => {
    const inner = String(rowsHtml || '').trim();
    if (!inner) return '';
    const label = t('plan.ui.details.technical', 'Technical details');
    return `<details class="ce-detail-tech"><summary>${escapeHtml(label)}</summary><div class="ce-detail-tech__body">${inner}</div></details>`;
  };

  const kv = (label, value) => {
    const v = String(value || '').trim();
    if (!v) return '';
    return `<div class="ce-detail-row"><div class="ce-detail-row__k">${escapeHtml(label)}</div><div class="ce-detail-row__v">${escapeHtml(v)}</div></div>`;
  };

  const list = (label, arr) => {
    const items = Array.isArray(arr) ? arr.map((x) => String(x || '').trim()).filter(Boolean) : [];
    if (!items.length) return '';
    return `
      <div class="ce-detail-row">
        <div class="ce-detail-row__k">${escapeHtml(label)}</div>
        <div class="ce-detail-row__v">
          <div class="ce-detail-chips">${items.map((x) => `<span class="ce-detail-chip">${escapeHtml(x)}</span>`).join('')}</div>
        </div>
      </div>
    `;
  };

  const images = getServiceImageUrls(safeType, s);
  const gallery = renderGalleryHtml(images, { alt: title });

  if (safeType === 'car') {
    const features = (typeof window !== 'undefined' && typeof window.getCarFeatures === 'function') ? window.getCarFeatures(s) : (Array.isArray(s.features) ? s.features : []);
    const model = (typeof window !== 'undefined' && typeof window.getCarName === 'function') ? window.getCarName(s) : String(s.car_model || '');
    const carType = (typeof window !== 'undefined' && typeof window.getCarType === 'function') ? window.getCarType(s) : String(s.car_type || '');
    const from = getCarFromPricePerDay(s);
    const fromText = from != null ? `${Number(from).toFixed(0)}€ ${t('plan.ui.pricing.perDay', '/ day')}` : '';
    return `
      ${gallery}
      ${desc ? `<div class="ce-detail-desc">${escapeHtml(desc)}</div>` : ''}
      <div class="ce-detail-grid">
        ${kv(t('plan.ui.details.location', 'Location'), s.location)}
        ${kv(t('plan.ui.details.fromPrice', 'From'), fromText)}
        ${kv(t('plan.ui.details.model', 'Model'), model)}
        ${kv(t('plan.ui.details.type', 'Type'), carType)}
        ${kv(t('plan.ui.details.deposit', 'Deposit'), s.deposit)}
        ${kv(t('plan.ui.details.transmission', 'Transmission'), s.transmission || s.gearbox)}
        ${kv(t('plan.ui.details.fuel', 'Fuel'), s.fuel)}
        ${kv(t('plan.ui.details.seats', 'Seats'), s.seats)}
      </div>
      ${list(t('plan.ui.details.features', 'Features'), features)}
    `;
  }

  if (safeType === 'hotel') {
    const city = getHotelCity(s);
    const descTitle = t('plan.ui.details.descriptionTitle', 'Description');
    const descHtml = desc ? escapeHtml(desc).replace(/\n/g, '<br/>') : '';
    const amenitiesHtml = renderHotelAmenitiesChips(s);
    return `
      ${gallery}
      <div class="ce-hotel-head">
        ${title ? `<div class="ce-hotel-title">${escapeHtml(title)}</div>` : ''}
        ${city ? `<div class="ce-hotel-city">${escapeHtml(city)}</div>` : ''}
      </div>
      ${descHtml ? `<div class="ce-hotel-section"><div class="ce-hotel-section__title">${escapeHtml(descTitle)}</div><div class="ce-detail-desc">${descHtml}</div></div>` : ''}
      ${amenitiesHtml}
    `;
  }

  if (safeType === 'trip') {
    const duration = s.duration || s.duration_hours || s.duration_label;
    const startCity = s.start_city || s.city;
    const includes = s.includes || s.included || s.inclusions;
    const excludes = s.excludes || s.not_included || s.exclusions;
    const descTitle = t('plan.ui.details.descriptionTitle', 'Description');
    const descHtml = desc ? escapeHtml(desc).replace(/\n/g, '<br/>') : '';
    return `
      ${gallery}
      ${descHtml ? `<div class="ce-detail-section"><div class="ce-detail-section__title">${escapeHtml(descTitle)}</div><div class="ce-detail-desc">${descHtml}</div></div>` : ''}
      <div class="ce-detail-grid">
        ${kv(t('plan.ui.details.startCity', 'Start city'), startCity)}
        ${kv(t('plan.ui.details.duration', 'Duration'), duration)}
        ${kv(t('plan.ui.details.price', 'Price'), r.price)}
      </div>
      ${typeof includes === 'string' && includes.trim() ? `<div class="ce-detail-section"><div class="ce-detail-section__title">${escapeHtml(t('plan.ui.details.included', 'Included'))}</div><div class="ce-detail-desc">${escapeHtml(includes)}</div></div>` : ''}
      ${typeof excludes === 'string' && excludes.trim() ? `<div class="ce-detail-section"><div class="ce-detail-section__title">${escapeHtml(t('plan.ui.details.notIncluded', 'Not included'))}</div><div class="ce-detail-desc">${escapeHtml(excludes)}</div></div>` : ''}
    `;
  }

  if (safeType === 'recommendation') {
    const lang = currentLang();
    const isPolish = lang === 'pl';
    const rawPromo = String(s?.promo_code || '').trim();
    const discountText = isPolish
      ? String(s?.discount_text_pl || s?.discount_text_en || '').trim()
      : String(s?.discount_text_en || s?.discount_text_pl || '').trim();

    const cat = s?.recommendation_categories && typeof s.recommendation_categories === 'object' ? s.recommendation_categories : {};
    const catName = isPolish
      ? String(cat?.name_pl || cat?.name_en || '').trim()
      : String(cat?.name_en || cat?.name_pl || '').trim();
    const catIcon = String(cat?.icon || '').trim();
    const catLabel = [catIcon, catName].filter(Boolean).join(' ').trim();

    const lat = s?.latitude != null ? Number(s.latitude) : (s?.lat != null ? Number(s.lat) : null);
    const lng = s?.longitude != null ? Number(s.longitude) : (s?.lng != null ? Number(s.lng) : null);
    const mapsFallback = Number.isFinite(lat) && Number.isFinite(lng) ? `https://www.google.com/maps?q=${lat},${lng}` : '';
    const mapsUrl = String(s?.google_url || s?.google_maps_url || mapsFallback || '').trim();
    const websiteUrl = String(s?.website_url || r?.url || '').trim();

    const showCodeLabel = t('plan.ui.recommendations.showCode', isPolish ? 'Pokaż kod' : 'Show code');
    const mapsLabel = t('plan.ui.recommendations.openMaps', isPolish ? 'Otwórz w mapach' : 'Open in maps');
    const openLabel = t('plan.ui.common.open', 'Open');

    const promoHtml = rawPromo && discountText
      ? `
        <div class="rec-card-promo" data-rec-card="1">
          <div class="rec-card-promo-label">${escapeHtml(discountText)}</div>
          <div class="rec-card-promo-code" data-rec-promo-code="1" data-visible="0"></div>
          <button type="button" class="rec-btn rec-btn-secondary" data-rec-promo-btn="${escapeHtml(rawPromo)}">${escapeHtml(showCodeLabel)}</button>
        </div>
      `
      : '';

    const links = `
      <div class="ce-detail-actions">
        ${mapsUrl ? `<a href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener" class="btn btn-sm ce-detail-actionbtn">${escapeHtml(mapsLabel)}</a>` : ''}
        ${websiteUrl ? `<a href="${escapeHtml(websiteUrl)}" target="_blank" rel="noopener" class="btn btn-sm ce-detail-actionbtn">${escapeHtml(openLabel)}</a>` : ''}
      </div>
    `;

    const tech = techDetails(
      `${Number.isFinite(lat) && Number.isFinite(lng) ? kv(t('plan.ui.details.coordinates', 'Coordinates'), `${lat}, ${lng}`) : ''}`
    );

    return `
      ${gallery}
      ${desc ? `<div class="ce-detail-desc">${escapeHtml(desc)}</div>` : ''}
      ${catLabel ? `<div class="ce-detail-badges"><span class="ce-detail-badge">${escapeHtml(catLabel)}</span></div>` : ''}
      ${promoHtml}
      ${links}
      ${tech}
    `;
  }

  // POI + fallback
  const poiCategory = getPoiCategory(s);
  const tech = techDetails(`${s?.lat != null && s?.lng != null ? kv(t('plan.ui.details.coordinates', 'Coordinates'), `${s.lat}, ${s.lng}`) : ''}`);
  return `
    ${gallery}
    ${desc ? `<div class="ce-detail-desc">${escapeHtml(desc)}</div>` : ''}
    ${poiCategory ? `<div class="ce-detail-badges"><span class="ce-detail-badge">${escapeHtml(poiCategory)}</span></div>` : ''}
    ${tech}
  `;
}

function renderExpandablePanel({ panelId, type, src, resolved, open = false }) {
  const pid = String(panelId || '').trim();
  if (!pid) return '';
  const content = renderDetailsHtml(type, src, resolved);
  if (!String(content || '').trim()) return '';

  const safeType = String(type || '').trim();
  const typeLabel = safeType ? getServiceTypeLabel(safeType) : '';
  const title = String(resolved?.title || '').trim();
  const head = (typeLabel || title)
    ? `<div class="ce-detail-head"><span class="ce-detail-head__type">${escapeHtml(typeLabel || '')}</span>${title ? `<span class="ce-detail-head__title">${escapeHtml(title)}</span>` : ''}</div>`
    : '';

  const isOpen = !!open;
  return `
    <div class="ce-expand" data-expand-wrap="1">
      <button type="button" class="ce-expand-btn" data-expand-toggle="${escapeHtml(pid)}" aria-expanded="${isOpen ? 'true' : 'false'}">
        <span>${escapeHtml(t('plan.ui.common.moreInfo', 'More info'))}</span>
        <span class="ce-expand-btn__icon" aria-hidden="true">${isOpen ? '−' : '+'}</span>
      </button>
      <div id="${escapeHtml(pid)}" class="ce-expand-panel${isOpen ? ' ce-expand-panel--open' : ''}"${isOpen ? '' : ' hidden'} style="${isOpen ? 'max-height:none;' : ''}">
        <div class="ce-expand-panel__inner">
          ${head}
          ${content}
        </div>
      </div>
    </div>
  `;
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
    wrap.innerHTML = `<div style="color:#64748b;">${escapeHtml(t('plan.cost.empty', 'Select a plan and add services to see totals.'))}</div>`;
    return;
  }

  const s = computePlanCostSummary();
  wrap.innerHTML = `
    <div style="display:flex; justify-content:space-between; gap:0.75rem;"><span style="color:#64748b;">${escapeHtml(t('plan.ui.cost.trips', 'Trips'))}</span><strong>${escapeHtml(formatMoney(s.tripsTotal, s.currency))}</strong></div>
    <div style="display:flex; justify-content:space-between; gap:0.75rem;"><span style="color:#64748b;">${escapeHtml(t('plan.ui.cost.cars', 'Cars'))}</span><strong>${escapeHtml(formatMoney(s.carsTotal, s.currency))}</strong></div>
    <div style="display:flex; justify-content:space-between; gap:0.75rem;"><span style="color:#64748b;">${escapeHtml(t('plan.ui.cost.accommodation', 'Accommodation'))}</span><strong>${escapeHtml(formatMoney(s.hotelsTotal, s.currency))}</strong></div>
    <div style="border-top:1px solid #e2e8f0; margin-top:0.25rem; padding-top:0.5rem; display:flex; justify-content:space-between; gap:0.75rem;">
      <span style="color:#0f172a; font-weight:700;">${escapeHtml(t('plan.ui.cost.total', 'Total'))}</span>
      <span style="color:#0f172a; font-weight:800;">${escapeHtml(formatMoney(s.total, s.currency))}</span>
    </div>
    <div style="color:#64748b; font-size:12px;">${escapeHtml(t('plan.ui.cost.peopleLinePrefix', 'People'))}: ${escapeHtml(String(s.people))}. ${escapeHtml(t('plan.ui.cost.note', 'Hotels: nights = (range days − 1). Cars: minimum 3 days.'))}</div>
  `;
}

function getCarLink(car) {
  const location = String(car?.location || '').toLowerCase();
  if (location === 'paphos') return 'autopfo.html';
  if (location === 'larnaca') return 'car-rental.html';
  return 'car-rental-landing.html';
}

function getServiceTypeLabel(type) {
  if (type === 'trip') return t('plan.ui.itemType.trip', 'Trip');
  if (type === 'hotel') return t('plan.ui.itemType.hotel', 'Hotel');
  if (type === 'car') return t('plan.ui.itemType.car', 'Car');
  if (type === 'poi') return t('plan.ui.itemType.place', 'Place');
  if (type === 'recommendation') return t('plan.ui.itemType.recommendation', 'Recommendation');
  return t('plan.ui.itemType.item', 'Item');
}

async function loadServiceCatalog(planId) {
  if (!planId) {
    const wrap = catalogEl();
    if (wrap) wrap.innerHTML = '';
    catalogLoadedForPlanId = null;
    return;
  }

  if (!sb) {
    sb = await ensureSupabase();
  }
  if (!sb) {
    const wrap = catalogEl();
    if (wrap) {
      wrap.innerHTML = `<div style="color:#ef4444;">${escapeHtml(t('plan.ui.catalog.failedToLoad', 'Failed to load services.'))}</div>`;
    }
    return;
  }

  if (catalogLoadedForPlanId === planId && (catalogData.trips.length || catalogData.hotels.length || catalogData.cars.length || catalogData.pois.length)) {
    renderServiceCatalog();
    return;
  }

  const wrap = catalogEl();
  if (wrap) {
    wrap.innerHTML = `<div style="color:#64748b;">${escapeHtml(t('plan.ui.catalog.loadingServices', 'Loading services…'))}</div>`;
  }

  if (!catalogLangWired) {
    let raf = 0;
    document.addEventListener('wakacjecypr:languagechange', () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        renderServiceCatalog();
      });
      setTimeout(() => {
        if (!raf) renderServiceCatalog();
      }, 80);
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
    const errMsg = String(res?.error?.message || '').toLowerCase();
    const missingPublished = res?.error && (errMsg.includes('is_published') || errMsg.includes('column') || errMsg.includes('does not exist'));
    if (missingPublished || (!res?.error && Array.isArray(res?.data) && res.data.length === 0)) {
      let alt = await sb
        .from('hotels')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })
        .range(0, 99);
      if (alt?.error && String(alt.error.message || '').toLowerCase().includes('sort_order')) {
        alt = await sb.from('hotels').select('*').order('created_at', { ascending: false }).range(0, 99);
      }
      if (!alt?.error && Array.isArray(alt?.data)) res = alt;
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

  const loadRecommendationCategories = async () => {
    try {
      return await sb
        .from('recommendation_categories')
        .select('*')
        .eq('active', true)
        .order('display_order', { ascending: true });
    } catch (e) {
      return { data: [], error: e };
    }
  };

  const loadRecommendations = async () => {
    try {
      return await sb
        .from('recommendations')
        .select('*, recommendation_categories(name_pl, name_en, icon, color)')
        .eq('active', true)
        .order('featured', { ascending: false })
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false })
        .range(0, 99);
    } catch (e) {
      return { data: [], error: e };
    }
  };

  try {
    const [tripsRes, hotelsRes, carsRes, poisRes, recCatsRes, recsRes] = await Promise.all([
      loadTrips(),
      loadHotels(),
      loadCars(),
      loadPoisForCatalog(),
      loadRecommendationCategories(),
      loadRecommendations(),
    ]);

    if (tripsRes.error) console.warn('Failed to load trips catalog', tripsRes.error);
    if (hotelsRes.error) console.warn('Failed to load hotels catalog', hotelsRes.error);
    if (carsRes.error) console.warn('Failed to load cars catalog', carsRes.error);
    if (poisRes.error) console.warn('Failed to load POI catalog', poisRes.error);
    if (recCatsRes.error) console.warn('Failed to load recommendation categories', recCatsRes.error);
    if (recsRes.error) console.warn('Failed to load recommendations', recsRes.error);

    catalogData = {
      trips: Array.isArray(tripsRes.data) ? tripsRes.data : [],
      hotels: Array.isArray(hotelsRes.data) ? hotelsRes.data : [],
      cars: Array.isArray(carsRes.data) ? carsRes.data : [],
      pois: Array.isArray(poisRes.data) ? poisRes.data : [],
      recommendations: Array.isArray(recsRes.data) ? recsRes.data : [],
      recommendationCategories: Array.isArray(recCatsRes.data) ? recCatsRes.data : [],
    };
    catalogLoadedForPlanId = planId;
    renderServiceCatalog();
  } catch (e) {
    console.error('Failed to load services catalog', e);
    const wrap = catalogEl();
    if (wrap) {
      wrap.innerHTML = `<div style="color:#ef4444;">${escapeHtml(t('plan.ui.catalog.failedToLoad', 'Failed to load services.'))}</div>`;
    }
  }
}

async function ensureLoggedInForPromo(onAuthenticated) {
  try {
    let session = null;
    const maybeSession = await waitForAuthReadySafe({ timeoutMs: 2000 });
    if (maybeSession && maybeSession.user) session = maybeSession;
    const state = typeof window !== 'undefined' ? (window.CE_STATE || {}) : {};
    if (state.session && state.session.user) session = state.session;
    if (session && session.user) {
      if (typeof onAuthenticated === 'function') onAuthenticated(session);
      return true;
    }
    if (typeof window !== 'undefined' && typeof window.openAuthModal === 'function') {
      window.openAuthModal('login');
    } else {
      const opener = document.querySelector('[data-open-auth]');
      if (opener instanceof HTMLElement) opener.click();
    }
    return false;
  } catch (e) {
    console.warn('[plan] ensureLoggedInForPromo failed', e);
    return false;
  }
}

function ensureCatalogDaySelectionDefaults() {
  if (lastSelectedDayIdForCatalog && planDaysById.has(lastSelectedDayIdForCatalog)) return;
  const first = Array.from(planDaysById.keys())[0] || '';
  lastSelectedDayIdForCatalog = first;
}

function buildDayOptionsHtml() {
  const days = Array.from(planDaysById.values())
    .slice()
    .sort((a, b) => Number(a?.day_index || 0) - Number(b?.day_index || 0));
  return days
    .map((d) => {
      const dayWord = t('plan.ui.common.day', 'Day');
      const label = d?.date ? `${dayWord} ${d.day_index} · ${d.date}` : `${dayWord} ${d.day_index}`;
      const selected = String(d?.id || '') === String(lastSelectedDayIdForCatalog || '') ? ' selected' : '';
      return `<option value="${escapeHtml(String(d?.id || ''))}"${selected}>${escapeHtml(label)}</option>`;
    })
    .join('');
}

async function addServiceItemToDay({ dayId, itemType, refId, data }) {
  if (!sb) return;
  if (!dayId) {
    showToast(t('plan.ui.toast.selectDayFirst', 'Select a day first.'), 'info');
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
    showToast(error.message || t('plan.ui.toast.failedToAddItem', 'Failed to add item'), 'error');
    return;
  }

  await loadPlanDays(currentPlan?.id);

  const label = getServiceTypeLabel(itemType);
  showToast(`${label} ${t('plan.ui.toast.addedToPlan', 'added to your plan.')}`, 'success');
}

async function addServiceRangeToDays({ startDayId, endDayId, itemType, refId, data }) {
  if (!sb) return;
  if (!startDayId || !endDayId) {
    showToast(t('plan.ui.toast.selectStartEndDay', 'Select start and end day.'), 'info');
    return;
  }
  if (!itemType) return;

  const start = planDaysById.get(startDayId);
  const end = planDaysById.get(endDayId);
  const startIndex = start?.day_index;
  const endIndex = end?.day_index;
  if (!start || !end || !Number.isFinite(Number(startIndex)) || !Number.isFinite(Number(endIndex))) {
    showToast(t('plan.ui.toast.invalidDayRange', 'Invalid day range.'), 'error');
    return;
  }

  const min = Math.min(Number(startIndex), Number(endIndex));
  const max = Math.max(Number(startIndex), Number(endIndex));
  if (itemType === 'car') {
    const rangeDays = Math.max(1, Math.abs(max - min) + 1);
    if (rangeDays < 3) {
      showToast(t('plan.ui.toast.carMinimumDays', 'Cars: minimum rental is 3 days.'), 'info');
      return;
    }
  }
  const days = Array.from(planDaysById.values()).filter((d) => Number(d?.day_index) >= min && Number(d?.day_index) <= max);
  if (!days.length) {
    showToast(t('plan.ui.toast.invalidDayRange', 'Invalid day range.'), 'error');
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
    showToast(error.message || t('plan.ui.toast.failedToAddRange', 'Failed to add range'), 'error');
    return;
  }

  await loadPlanDays(currentPlan?.id);

  const label = getServiceTypeLabel(itemType);
  showToast(`${label} ${t('plan.ui.toast.addedToPlanRangePrefix', 'added to your plan (Day')} ${min}–${max}).`, 'success');
}

async function deleteRangeItems(rangeId) {
  if (!sb || !rangeId) return false;
  const { error } = await sb.from('user_plan_items').delete().contains('data', { range_id: rangeId });
  if (error) {
    console.error('Failed to delete range', error);
    showToast(error.message || t('plan.ui.toast.failedToDeleteRange', 'Failed to delete range'), 'error');
    return false;
  }
  return true;
}

function renderServiceCatalog() {
  const wrap = catalogEl();
  if (!wrap) return;

  ensureCatalogDaySelectionDefaults();

  const active = typeof document !== 'undefined' ? document.activeElement : null;
  const hadSearchFocus = active instanceof HTMLInputElement && active.id === 'planCatalogSearch';
  const caretStart = hadSearchFocus ? active.selectionStart : null;
  const caretEnd = hadSearchFocus ? active.selectionEnd : null;

  const ctx = getCatalogContext();

  const dayOptions = Array.from(planDaysById.values())
    .sort((a, b) => Number(a?.day_index || 0) - Number(b?.day_index || 0))
    .map((d) => {
      const dayWord = t('plan.ui.common.day', 'Day');
      const label = d?.date ? `${dayWord} ${d.day_index} · ${d.date}` : `${dayWord} ${d.day_index}`;
      return `<option value="${escapeHtml(d.id)}">${escapeHtml(label)}</option>`;
    })
    .join('');

  const getDayIndexById = (id) => {
    try {
      const d = id ? planDaysById.get(id) : null;
      return d && d.day_index != null ? Number(d.day_index) : null;
    } catch (_) {
      return null;
    }
  };

  const getDayIdByIndex = (idx) => {
    const want = Number(idx);
    if (!Number.isFinite(want)) return null;
    for (const d of planDaysById.values()) {
      if (Number(d?.day_index) === want) return d?.id || null;
    }
    return null;
  };

  const tabBtn = (key, label) => {
    const isActive = catalogActiveTab === key;
    return `<button type="button" class="btn ${isActive ? 'btn-primary primary' : ''}" data-catalog-tab="${key}">${escapeHtml(label)}</button>`;
  };

  const counts = {
    trips: catalogData.trips.length,
    hotels: catalogData.hotels.length,
    cars: catalogData.cars.length,
    pois: catalogData.pois.length,
    recommendations: catalogData.recommendations.length,
  };

  const q = catalogSearch.trim().toLowerCase();
  const matches = (text) => {
    if (!q) return true;
    return String(text || '').toLowerCase().includes(q);
  };

  const renderRecommendationsFilters = () => {
    if (catalogActiveTab !== 'recommendations') return '';
    const cats = Array.isArray(catalogData.recommendationCategories) ? catalogData.recommendationCategories : [];
    const recs = Array.isArray(catalogData.recommendations) ? catalogData.recommendations : [];
    if (!cats.length || !recs.length) return '';

    const lang = currentLang();
    const isPolish = lang === 'pl';
    const active = String(recommendationsCategoryFilter || '');

    const items = cats
      .map((c) => {
        const id = c?.id;
        if (!id) return null;
        const count = recs.filter((r) => String(r?.category_id) === String(id)).length;
        if (!count) return null;
        const name = isPolish ? (c?.name_pl || c?.name_en || '') : (c?.name_en || c?.name_pl || '');
        return { id: String(id), icon: c?.icon || '📍', name, count };
      })
      .filter(Boolean);

    if (!items.length) return '';

    const clearLabel = t('recommendations.home.filters.clear', 'Wyczyść filtry');
    const titleLabel = t('recommendations.home.filters.title', 'Wybierz kategorię');

    return `
      <div class="filters-container" style="background: white; border-radius: 16px; padding: 14px 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.06); margin: 14px 0 18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:0.75rem; margin-bottom: 10px;">
          <div style="font-size: 14px; font-weight: 700; color:#111827;">${escapeHtml(titleLabel)}</div>
          <button type="button" class="btn-text" data-rec-clear="1" style="${active ? '' : 'display:none;'} background:none; border:none; color:#667eea; font-weight:600; cursor:pointer; font-size: 13px; padding: 6px 10px; border-radius: 8px;">
            ${escapeHtml(clearLabel)}
          </button>
        </div>
        <div class="filters-grid" id="planRecommendationsCategories" style="display:flex; flex-wrap:wrap; gap:8px;">
          ${items
            .map((c) => {
              const isActive = active && active === c.id;
              return `
                <button type="button" class="filter-btn ${isActive ? 'active' : ''}" data-rec-cat="${escapeHtml(c.id)}">
                  <span class="filter-icon">${escapeHtml(String(c.icon || '📍'))}</span>
                  <span class="filter-label">${escapeHtml(String(c.name || ''))}</span>
                  <span class="filter-count">${escapeHtml(String(c.count || 0))}</span>
                </button>
              `;
            })
            .join('')}
        </div>
      </div>
    `;
  };

  let list = [];
  if (catalogActiveTab === 'trips') {
    list = catalogData.trips
      .map((t) => {
        const title = getTripTitle(t);
        const city = t?.start_city || '';
        const description = getTripDescriptionText(t);
        const image = getServiceImageUrl('trip', t);
        const party = getPartyForPlan(currentPlan);
        const total = calcTripTotal(t, { adults: party.adults, children: party.children, hours: 1, days: 1 });
        const price = total ? `${Number(total).toFixed(2)} €` : '';
        const slug = t?.slug || '';
        const url = slug ? `trip.html?slug=${encodeURIComponent(slug)}` : 'trips.html';
        return { id: t?.id, title, subtitle: city, description, price, url, image, lat: null, lng: null, raw: t };
      })
      .filter((x) => {
        if (!ctx.city) return true;
        if (!x.subtitle) return true;
        if (isAllCitiesLabel(x.subtitle)) return true;
        return cityMatches(x.subtitle, ctx.city);
      })
      .filter((x) => matches(`${x.title} ${x.subtitle}`));
  } else if (catalogActiveTab === 'hotels') {
    const baseHotels = catalogData.hotels.map((h) => {
      const title = getHotelTitle(h);
      const city = getHotelCity(h);
      const description = getHotelDescriptionText(h);
      const image = getServiceImageUrl('hotel', h);
      const min = getHotelMinPricePerNight(h);
      const price = min != null ? `${t('plan.ui.pricing.from', 'From')}: ${Number(min).toFixed(2)} € ${t('plan.ui.pricing.perNight', '/ night')}` : '';
      const slug = h?.slug || '';
      const url = slug ? `hotel.html?slug=${encodeURIComponent(slug)}` : 'hotels.html';
      return { id: h?.id, title, subtitle: city, description, price, url, image, lat: null, lng: null, raw: h };
    });

    const byCity = ctx.city ? baseHotels.filter((x) => (!x.subtitle ? true : cityMatches(x.subtitle, ctx.city))) : baseHotels;
    list = byCity.filter((x) => matches(`${x.title} ${x.subtitle}`));
    if (ctx.city && list.length === 0 && baseHotels.length) {
      list = baseHotels.filter((x) => matches(`${x.title} ${x.subtitle}`));
    }
  } else if (catalogActiveTab === 'cars') {
    list = catalogData.cars
      .map((c) => {
        const title = getCarTitle(c);
        const location = c?.location || '';
        const url = getCarLink(c);
        const description = getCarDescription(c);
        const image = getServiceImageUrl('car', c);
        const north = c?.north_allowed ? t('plan.ui.catalog.northOk', 'north ok') : '';
        const from = getCarFromPricePerDay(c);
        const price = from != null ? `${t('plan.ui.pricing.from', 'From')}: ${Number(from).toFixed(0)}€ ${t('plan.ui.pricing.perDay', '/ day')}` : '';
        return { id: c?.id, title, subtitle: [location, north].filter(Boolean).join(' • '), description, location, price, url, image, lat: null, lng: null, raw: c };
      })
      .filter((x) => {
        if (ctx.includeNorth) {
          const ref = catalogData.cars.find((c) => String(c?.id) === String(x.id));
          if (ref && ref.north_allowed === false) return false;
        }
        return true;
      })
      .filter((x) => (ctx.city ? cityMatches(x.location, ctx.city) : true))
      .filter((x) => matches(`${x.title} ${x.subtitle}`));
  } else if (catalogActiveTab === 'pois') {
    list = catalogData.pois
      .map((p) => {
        const title = getPoiTitle(p);
        const description = getPoiDescription(p);
        const category = getPoiCategory(p);
        const image = getServiceImageUrl('poi', p);
        const url = p?.google_url || p?.google_maps_url || (p?.lat != null && p?.lng != null ? `https://www.google.com/maps?q=${p.lat},${p.lng}` : '');
        // Avoid showing description twice: keep it only for preview + details panel.
        return { id: p?.id, title, subtitle: category, description, price: '', url, image, lat: p?.lat ?? null, lng: p?.lng ?? null, raw: p };
      })
      .filter((x) => matches(`${x.title}`));
  } else if (catalogActiveTab === 'recommendations') {
    const lang = currentLang();
    const isPolish = lang === 'pl';
    const activeCat = String(recommendationsCategoryFilter || '');
    const catLookup = new Map();
    (Array.isArray(catalogData.recommendationCategories) ? catalogData.recommendationCategories : []).forEach((c) => {
      if (c && c.id != null) catLookup.set(String(c.id), c);
    });

    list = (Array.isArray(catalogData.recommendations) ? catalogData.recommendations : [])
      .filter((r) => {
        if (!activeCat) return true;
        return String(r?.category_id) === activeCat;
      })
      .map((r) => {
        const cat = catLookup.get(String(r?.category_id || '')) || r?.recommendation_categories || {};
        const catName = isPolish ? (cat?.name_pl || cat?.name_en || '') : (cat?.name_en || cat?.name_pl || '');
        const catIcon = cat?.icon || '📍';
        const title = isPolish ? (r?.title_pl || r?.title_en || '') : (r?.title_en || r?.title_pl || '');
        const descriptionFull = isPolish ? (r?.description_pl || r?.description_en || '') : (r?.description_en || r?.description_pl || '');
        const description = String(descriptionFull || '').trim();
        const subtitle = [catIcon, catName].filter(Boolean).join(' ').trim();
        const image = String(r?.image_url || '').trim();
        const url = String(r?.website_url || r?.google_url || '').trim();
        const lat = r?.latitude != null ? Number(r.latitude) : null;
        const lng = r?.longitude != null ? Number(r.longitude) : null;

        const discount = isPolish
          ? (r?.discount_text_pl || r?.discount_text_en || '')
          : (r?.discount_text_en || r?.discount_text_pl || '');

        return {
          id: r?.id,
          title: String(title || '').trim(),
          subtitle,
          description,
          price: '',
          url,
          image,
          lat: Number.isFinite(lat) ? lat : null,
          lng: Number.isFinite(lng) ? lng : null,
          raw: {
            ...r,
            recommendation_categories: cat,
            __discount: discount,
          },
        };
      })
      .filter((x) => matches(`${x.title} ${x.subtitle} ${x.description}`));
  }

  const rowsHtml = list.length
    ? `<div class="ce-catalog-grid">
        ${list
          .slice(0, 120)
          .map((x) => {
            const itemType = catalogActiveTab === 'recommendations' ? 'recommendation' : catalogActiveTab.slice(0, -1);
            const addAttr = `data-catalog-add="1" data-item-type="${escapeHtml(itemType)}" data-ref-id="${escapeHtml(x.id || '')}" data-title="${escapeHtml(x.title || '')}" data-subtitle="${escapeHtml(x.subtitle || '')}" data-description="${escapeHtml(x.description || '')}" data-url="${escapeHtml(x.url || '')}" data-price="${escapeHtml(x.price || '')}" data-image="${escapeHtml(x.image || '')}"`;
            const poiAttrs = x.lat != null && x.lng != null ? ` data-lat="${escapeHtml(String(x.lat))}" data-lng="${escapeHtml(String(x.lng))}"` : '';
            const isRange = catalogActiveTab === 'hotels' || catalogActiveTab === 'cars';
            const link = x.url ? `<a href="${escapeHtml(x.url)}" target="_blank" rel="noopener" class="btn btn-sm ce-catalog-open">${escapeHtml(t('plan.ui.common.open', 'Open'))}</a>` : '';
            const dayPickWrap = isRange
              ? (catalogActiveTab === 'cars'
                ? `<div class="ce-catalog-days" data-car-range="1" hidden>
                     <div class="ce-catalog-days__inner" style="display:grid; gap:0.5rem;">
                       <label style="display:grid; gap:0.25rem; font-size:12px; color:#64748b;">
                         ${escapeHtml(t('plan.ui.catalog.pickupDay', 'Dzień odbioru'))}
                         <select data-catalog-range-start="1" class="btn btn-sm ce-catalog-select">${dayOptions}</select>
                       </label>
                       <label style="display:grid; gap:0.25rem; font-size:12px; color:#64748b;">
                         ${escapeHtml(t('plan.ui.catalog.dropoffDay', 'Dzień zwrotu'))}
                         <select data-catalog-range-end="1" class="btn btn-sm ce-catalog-select">${dayOptions}</select>
                       </label>
                       <div data-car-range-days style="font-size:12px; color:#64748b;"></div>
                     </div>
                   </div>`
                : `<div class="ce-catalog-days" data-hotel-range="1" hidden>
                     <div class="ce-catalog-days__inner" style="display:grid; gap:0.5rem;">
                       <label style="display:grid; gap:0.25rem; font-size:12px; color:#64748b;">
                         ${escapeHtml(t('plan.ui.catalog.checkInDay', 'Dzień zameldowania'))}
                         <select data-catalog-range-start="1" class="btn btn-sm ce-catalog-select">${dayOptions}</select>
                       </label>
                       <label style="display:grid; gap:0.25rem; font-size:12px; color:#64748b;">
                         ${escapeHtml(t('plan.ui.catalog.checkOutDay', 'Dzień wymeldowania'))}
                         <select data-catalog-range-end="1" class="btn btn-sm ce-catalog-select">${dayOptions}</select>
                       </label>
                     </div>
                   </div>`)
              : `<div class="ce-catalog-days" data-item-day-pick="1" hidden>
                   <div class="ce-catalog-days__inner" style="display:grid; gap:0.25rem;">
                     <label style="display:grid; gap:0.25rem; font-size:12px; color:#64748b;">
                       ${escapeHtml(t('plan.catalog.addToDay', 'Add to day'))}
                       <select data-catalog-add-day="1" class="btn btn-sm ce-catalog-select">${dayOptions}</select>
                     </label>
                   </div>
                 </div>`;
            const addLabel = isRange
              ? escapeHtml(t('plan.ui.catalog.addRange', 'Dodaj zakres'))
              : escapeHtml(t('plan.ui.catalog.add', 'Add'));

            if (catalogActiveTab === 'recommendations') {
              const lang = currentLang();
              const isPolish = lang === 'pl';
              const raw = x.raw && typeof x.raw === 'object' ? x.raw : {};
              const promo = String(raw?.promo_code || '').trim();
              const discount = String(raw?.__discount || '').trim();
              const showCodeLabel = t('plan.ui.recommendations.showCode', isPolish ? 'Pokaż kod' : 'Show code');

              const mapsLabel = t('plan.ui.recommendations.openMaps', isPolish ? 'Otwórz w mapach' : 'Open in maps');
              const mapsUrl = String(raw?.google_url || '').trim();
              const mapsBtn = mapsUrl
                ? `<a href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener" class="btn btn-sm ce-catalog-open">${escapeHtml(mapsLabel)}</a>`
                : '';

              const promoHtml = promo && discount
                ? `
                  <div class="rec-card-promo" data-rec-card="1" style="margin-top: 10px;">
                    <div class="rec-card-promo-label">${escapeHtml(discount)}</div>
                    <div class="rec-card-promo-code" data-rec-promo-code="1" data-visible="0"></div>
                    <button type="button" class="rec-btn rec-btn-secondary" data-rec-promo-btn="${escapeHtml(promo)}">${escapeHtml(showCodeLabel)}</button>
                  </div>
                `
                : '';

              const description = String(x.description || '').trim();
              const descHtml = description ? `<div class="ce-catalog-preview">${escapeHtml(description)}</div>` : '';

              const img = x.image
                ? `<img src="${escapeHtml(x.image)}" alt="" loading="lazy" class="rec-card-image" style="width:100%; height:120px; object-fit:cover; border-radius:10px; border:1px solid #e2e8f0; margin-bottom: 0.5rem;" />`
                : '';

              return `
                <div class="card ce-catalog-tile" style="padding:0.65rem; border:1px solid #e2e8f0;" data-rec-card="1">
                  ${img}
                  <div class="ce-catalog-title">${escapeHtml(x.title)}</div>
                  <div class="ce-catalog-meta">
                    ${x.subtitle ? `<span class=\"ce-catalog-sub\">${escapeHtml(x.subtitle)}</span>` : ''}
                  </div>
                  ${descHtml}
                  ${promoHtml}
                  <div class="ce-catalog-actions">
                    ${mapsBtn}
                    ${link}
                    ${dayPickWrap}
                    <button type="button" class="btn btn-sm btn-primary primary ce-catalog-add" ${addAttr}${poiAttrs}>${addLabel}</button>
                  </div>
                </div>
              `;
            }

            const raw = x.raw && typeof x.raw === 'object' ? x.raw : null;
            const imgUrls = raw ? getServiceImageUrls(itemType, raw) : (x.image ? [x.image] : []);
            const imgUrlsAttr = imgUrls.length ? escapeHtml(encodeURIComponent(JSON.stringify(imgUrls))) : '';
            const img = x.image
              ? `<button type="button" class="ce-catalog-cover" data-ce-lightbox-urls="${imgUrlsAttr}" data-ce-lightbox-index="0" style="display:block; width:100%; padding:0; border:0; background:transparent; margin-bottom:0.5rem; cursor:pointer;">
                   <img src="${escapeHtml(x.image)}" alt="" loading="lazy" style="width:100%; height:120px; object-fit:cover; border-radius:10px; border:1px solid #e2e8f0;" />
                 </button>`
              : '';
            const panelId = `ceCatDetail_${catalogActiveTab}_${String(x.id || '').replace(/[^a-zA-Z0-9_-]/g, '')}`;
            const preview =
              catalogActiveTab === 'pois'
                ? (() => {
                  const prefix = t('plan.ui.poi.areaPrefix', 'Area Of:');
                  const line = x.subtitle ? `${prefix} ${x.subtitle}` : '';
                  return line ? `<div class="ce-catalog-preview">${escapeHtml(line)}</div>` : '';
                })()
                : ((catalogActiveTab === 'hotels' || catalogActiveTab === 'trips') ? '' : (x.description ? `<div class="ce-catalog-preview">${escapeHtml(x.description)}</div>` : ''));
            const more = raw ? renderExpandablePanel({ panelId, type: itemType, src: raw, resolved: x }) : '';
            const showSubtitleMeta = catalogActiveTab !== 'pois';

            return `
              <div class="card ce-catalog-tile" style="padding:0.65rem; border:1px solid #e2e8f0;">
                ${img}
                <div class="ce-catalog-title">${escapeHtml(x.title)}</div>
                <div class="ce-catalog-meta">
                  ${showSubtitleMeta && x.subtitle ? `<span class=\"ce-catalog-sub\">${escapeHtml(x.subtitle)}</span>` : ''}
                  ${x.price ? `<span class=\"ce-catalog-price\">${escapeHtml(x.price)}</span>` : ''}
                </div>
                ${preview}
                ${more}
                <div class="ce-catalog-actions">
                  ${link}
                  ${dayPickWrap}
                  <button type="button" class="btn btn-sm btn-primary primary ce-catalog-add" ${addAttr}${poiAttrs}>${addLabel}</button>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>`
    : `<div style="color:#64748b;">${escapeHtml(t('plan.ui.catalog.noServices', 'No services found.'))}</div>`;

  const recFiltersHtml = renderRecommendationsFilters();

  wrap.innerHTML = `
    <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
      ${tabBtn('trips', `${t('plan.ui.catalog.tabs.trips', 'Trips')} (${counts.trips})`)}
      ${tabBtn('hotels', `${t('plan.ui.catalog.tabs.hotels', 'Hotels')} (${counts.hotels})`)}
      ${tabBtn('cars', `${t('plan.ui.catalog.tabs.cars', 'Cars')} (${counts.cars})`)}
      ${tabBtn('recommendations', `${t('plan.ui.catalog.tabs.recommendations', 'Recommendations')} (${counts.recommendations})`)}
      ${tabBtn('pois', `${t('plan.ui.catalog.tabs.pois', 'Places to see')} (${counts.pois})`)}
      <div style="flex:1 1 200px;"></div>
      <span style="color:#64748b; font-size:12px;">${escapeHtml(ctx.city || t('plan.ui.catalog.allCities', 'All cities'))}${ctx.includeNorth ? ` • ${escapeHtml(t('plan.ui.catalog.north', 'north'))}` : ''}</span>
      <input id="planCatalogSearch" type="text" value="${escapeHtml(catalogSearch)}" placeholder="${escapeHtml(t('plan.ui.catalog.searchPlaceholder', 'Search…'))}" style="max-width:280px;" />
      <button type="button" class="btn" data-catalog-refresh="1">${escapeHtml(t('plan.actions.refresh', 'Refresh'))}</button>
    </div>
    <div class="ce-catalog-results" style="margin-top:0.75rem;">
      ${recFiltersHtml}
      ${rowsHtml}
    </div>
  `;

  wrap.querySelectorAll('[data-catalog-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-catalog-tab');
      if (!tab) return;
      catalogActiveTab = tab;
      if (tab !== 'recommendations') {
        recommendationsCategoryFilter = '';
      }
      renderServiceCatalog();
    });
  });

  // Recommendation category filters
  if (catalogActiveTab === 'recommendations') {
    wrap.querySelectorAll('[data-rec-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-rec-cat') || '';
        recommendationsCategoryFilter = String(id || '');
        renderServiceCatalog();
      });
    });
    const clearBtn = wrap.querySelector('[data-rec-clear]');
    if (clearBtn instanceof HTMLElement) {
      clearBtn.addEventListener('click', () => {
        recommendationsCategoryFilter = '';
        renderServiceCatalog();
      });
    }
  }

  const searchEl = wrap.querySelector('#planCatalogSearch');
  if (searchEl instanceof HTMLInputElement) {
    searchEl.addEventListener('input', () => {
      catalogSearch = searchEl.value;
      renderServiceCatalog();
    });
  }

  if (hadSearchFocus) {
    const next = wrap.querySelector('#planCatalogSearch');
    if (next instanceof HTMLInputElement) {
      try {
        next.focus();
        if (caretStart != null && caretEnd != null) {
          next.setSelectionRange(caretStart, caretEnd);
        }
      } catch (_) {
      }
    }
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
      const type = btn.getAttribute('data-item-type');

      const isRange = type === 'hotel' || type === 'car';
      const dayPickWrap = row ? row.querySelector('[data-item-day-pick]') : null;
      if (!isRange) {
        // First click reveals day picker, second click confirms.
        if (dayPickWrap instanceof HTMLElement && dayPickWrap.hasAttribute('hidden')) {
          dayPickWrap.removeAttribute('hidden');
          btn.textContent = t('plan.ui.catalog.confirmAdd', 'Potwierdź dodanie');
          return;
        }
      }

      const dayId = rowDaySel instanceof HTMLSelectElement ? rowDaySel.value : (lastSelectedDayIdForCatalog || '');
      if (rowDaySel instanceof HTMLSelectElement) {
        lastSelectedDayIdForCatalog = rowDaySel.value;
      }
      const refId = btn.getAttribute('data-ref-id') || null;
      const title = btn.getAttribute('data-title') || '';
      const subtitle = btn.getAttribute('data-subtitle') || '';
      const description = btn.getAttribute('data-description') || '';
      const url = btn.getAttribute('data-url') || '';
      const price = btn.getAttribute('data-price') || '';
      const image = btn.getAttribute('data-image') || '';
      const latAttr = btn.getAttribute('data-lat');
      const lngAttr = btn.getAttribute('data-lng');
      const lat = latAttr != null && latAttr !== '' ? Number(latAttr) : null;
      const lng = lngAttr != null && lngAttr !== '' ? Number(lngAttr) : null;
      const baseData = { title, subtitle, description, url, price, image };
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        baseData.lat = lat;
        baseData.lng = lng;
      }

      if (type === 'car') {
        const rangeWrap = row ? row.querySelector('[data-car-range]') : null;
        if (rangeWrap instanceof HTMLElement && rangeWrap.hasAttribute('hidden')) {
          rangeWrap.removeAttribute('hidden');
          btn.textContent = t('plan.ui.catalog.confirmRange', 'Potwierdź zakres');
          return;
        }
      }

      if (type === 'hotel') {
        const rangeWrap = row ? row.querySelector('[data-hotel-range]') : null;
        if (rangeWrap instanceof HTMLElement && rangeWrap.hasAttribute('hidden')) {
          rangeWrap.removeAttribute('hidden');
          btn.textContent = t('plan.ui.catalog.confirmRange', 'Potwierdź zakres');
          return;
        }
      }

      if ((type === 'hotel' || type === 'car') && startSel instanceof HTMLSelectElement && endSel instanceof HTMLSelectElement) {
        await addServiceRangeToDays({
          startDayId: startSel.value,
          endDayId: endSel.value,
          itemType: type,
          refId,
          data: baseData,
        });

        if (type === 'car') {
          const rangeWrap = row ? row.querySelector('[data-car-range]') : null;
          if (rangeWrap instanceof HTMLElement) {
            rangeWrap.setAttribute('hidden', '');
          }
          btn.textContent = t('plan.ui.catalog.addRange', 'Dodaj zakres');
        }

        if (type === 'hotel') {
          const rangeWrap = row ? row.querySelector('[data-hotel-range]') : null;
          if (rangeWrap instanceof HTMLElement) {
            rangeWrap.setAttribute('hidden', '');
          }
          btn.textContent = t('plan.ui.catalog.addRange', 'Dodaj zakres');
        }
        return;
      }

      await addServiceItemToDay({ dayId, itemType: type, refId, data: baseData });

      // Reset per-item day picker UI for non-range items.
      if (!isRange) {
        if (dayPickWrap instanceof HTMLElement) {
          dayPickWrap.setAttribute('hidden', '');
        }
        btn.textContent = t('plan.ui.catalog.add', 'Add');
      }
    });
  });

  // Promo code reveal (login-gated) for recommendation cards
  wrap.querySelectorAll('[data-rec-promo-btn]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const promo = btn.getAttribute('data-rec-promo-btn') || '';
      if (!promo) return;
      const card = btn.closest('[data-rec-card]');
      const codeEl = card ? card.querySelector('[data-rec-promo-code]') : null;
      if (!(codeEl instanceof HTMLElement)) return;
      if (codeEl.dataset.visible === '1') return;

      await ensureLoggedInForPromo(() => {
        codeEl.textContent = promo;
        codeEl.dataset.visible = '1';
      });
    });
  });

  // Cars: make rental range selection obvious and enforce min 3 days in the UI.
  if (catalogActiveTab === 'cars') {
    const selectedDayId = lastSelectedDayIdForCatalog || '';
    wrap.querySelectorAll('.card').forEach((card) => {
      if (!(card instanceof HTMLElement)) return;
      const addBtn = card.querySelector('[data-catalog-add]');
      const type = addBtn instanceof HTMLElement ? addBtn.getAttribute('data-item-type') : null;
      if (type !== 'car') return;

      const startSel = card.querySelector('[data-catalog-range-start]');
      const endSel = card.querySelector('[data-catalog-range-end]');
      if (!(startSel instanceof HTMLSelectElement) || !(endSel instanceof HTMLSelectElement)) return;

      const daysLabelEl = card.querySelector('[data-car-range-days]');

      const setDaysLabel = () => {
        const sIdx = getDayIndexById(startSel.value);
        const eIdx = getDayIndexById(endSel.value);
        if (!Number.isFinite(sIdx) || !Number.isFinite(eIdx)) {
          if (daysLabelEl instanceof HTMLElement) daysLabelEl.textContent = '';
          return;
        }
        const min = Math.min(sIdx, eIdx);
        const max = Math.max(sIdx, eIdx);
        const d = Math.max(1, Math.abs(max - min) + 1);
        if (daysLabelEl instanceof HTMLElement) {
          const word = t('plan.ui.catalog.daysCount', 'dni');
          daysLabelEl.textContent = `${d} ${word} (min 3)`;
        }
      };

      const ensureMin3 = () => {
        const sIdx = getDayIndexById(startSel.value);
        if (!Number.isFinite(sIdx)) return;
        const desiredEnd = getDayIdByIndex(sIdx + 2) || endSel.value;
        const eIdx = getDayIndexById(endSel.value);
        if (!Number.isFinite(eIdx) || Math.abs(Number(eIdx) - Number(sIdx)) + 1 < 3) {
          if (desiredEnd) endSel.value = desiredEnd;
        }
        setDaysLabel();
      };

      // Default start = selected day; default end = start+2 (3 days) when possible.
      if (selectedDayId && startSel.value !== selectedDayId) {
        startSel.value = selectedDayId;
      }
      ensureMin3();

      if (!startSel.dataset.wiredMin3) {
        startSel.addEventListener('change', () => ensureMin3());
        startSel.dataset.wiredMin3 = '1';
      }
      if (!endSel.dataset.wiredMin3) {
        endSel.addEventListener('change', () => ensureMin3());
        endSel.dataset.wiredMin3 = '1';
      }
    });
  }

  // Expand / collapse details panels (modern UI)
  wrap.querySelectorAll('[data-expand-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-expand-toggle');
      if (!target) return;
      const panel = wrap.querySelector(`#${CSS.escape(target)}`);
      if (!(panel instanceof HTMLElement)) return;
      const isHidden = panel.hasAttribute('hidden');
      if (isHidden) {
        panel.removeAttribute('hidden');
        panel.classList.add('ce-expand-panel--open');
        panel.style.maxHeight = '0px';
        panel.offsetHeight;
        const inner = panel.querySelector('.ce-expand-panel__inner');
        const h = inner instanceof HTMLElement ? inner.scrollHeight : panel.scrollHeight;
        panel.style.maxHeight = `${Math.max(120, h)}px`;
        window.setTimeout(() => {
          if (panel.classList.contains('ce-expand-panel--open')) {
            panel.style.maxHeight = 'none';
          }
        }, 220);
      } else {
        const inner = panel.querySelector('.ce-expand-panel__inner');
        const h = inner instanceof HTMLElement ? inner.scrollHeight : panel.scrollHeight;
        panel.style.maxHeight = `${Math.max(120, h)}px`;
        panel.offsetHeight;
        panel.style.maxHeight = '0px';
        window.setTimeout(() => {
          panel.classList.remove('ce-expand-panel--open');
          panel.setAttribute('hidden', '');
        }, 180);
      }
      btn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
      const icon = btn.querySelector('.ce-expand-btn__icon');
      if (icon instanceof HTMLElement) icon.textContent = isHidden ? '−' : '+';
    });
  });

  wrap.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const btn = t.closest('[data-ce-gallery-item]');
    if (!(btn instanceof HTMLElement)) return;
    const gallery = btn.closest('.ce-detail-gallery');
    if (!(gallery instanceof HTMLElement)) return;
    const imgs = Array.from(gallery.querySelectorAll('img'));
    const urls = imgs.map((im) => (im instanceof HTMLImageElement ? im.currentSrc || im.src : '')).filter(Boolean);
    if (!urls.length) return;
    const clickedImg = btn.querySelector('img');
    const clickedSrc = clickedImg instanceof HTMLImageElement ? (clickedImg.currentSrc || clickedImg.src) : '';
    let idx = clickedSrc ? urls.indexOf(clickedSrc) : -1;
    if (idx < 0) idx = 0;
    ceLightboxState = { urls, index: idx };
    const lb = ensureCeLightbox();
    if (!lb) return;
    document.body.classList.add('ce-lightbox-open');
    lb.hidden = false;
    if (typeof lb.__ceShow === 'function') lb.__ceShow();
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

  const points = (poiItems || []).map(getMapLatLngForItem).filter(Boolean);
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
    showToast(error.message || t('plan.ui.toast.failedToLoadPlanItems', 'Failed to load plan items'), 'error');
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
    showToast(error.message || t('plan.ui.toast.failedToUpdateDay', 'Failed to update day'), 'error');
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
    showToast(error.message || t('plan.ui.toast.failedToAddNote', 'Failed to add note'), 'error');
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
    showToast(error.message || t('plan.ui.toast.failedToUpdateItem', 'Failed to update item'), 'error');
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
    showToast(error.message || t('plan.ui.toast.failedToDeleteItem', 'Failed to delete item'), 'error');
    return false;
  }
  return true;
}

async function loadPlans({ selectId } = {}) {
  if (!sb) return;

  try {
    await ensureSupabaseSessionFromPersistedSnapshot({ timeoutMs: 4000 });
  } catch (_) {}

  let user = await getCurrentUser();
  if (!user) {
    // After refresh Supabase can briefly report no user while restoring INITIAL_SESSION.
    for (let i = 0; i < 10; i += 1) {
      await new Promise((r) => setTimeout(r, 200));
      user = await getCurrentUser();
      if (user) break;
    }
  }
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
    showToast(error.message || t('plan.ui.toast.failedToLoadPlans', 'Failed to load plans'), 'error');
    return;
  }

  const plans = Array.isArray(data) ? data : [];
  const list = planListEl();
  if (list) {
    if (!plans.length) {
      list.innerHTML = `<div style="color:#64748b;">${escapeHtml(t('plan.ui.plans.empty', 'No plans yet. Create your first plan above.'))}</div>`;
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
    showToast(error.message || t('plan.ui.toast.failedToLoadPlan', 'Failed to load plan'), 'error');
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

  setLastSelectedPlanId(currentPlan.id);

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
    showToast(error.message || t('plan.ui.toast.failedToLoadPlanDays', 'Failed to load plan days'), 'error');
    return;
  }

  const rows = Array.isArray(data) ? data : [];
  const container = daysEl();
  if (!container) return;

  planDaysById = new Map(rows.map((d) => [d.id, d]));

  ensureCatalogDaySelectionDefaults();

  if (!rows.length) {
    container.innerHTML = `<div style="color:#64748b;">${escapeHtml(t('plan.ui.days.noDays', 'No days generated yet.'))}</div>`;
    return;
  }

  const dayIds = rows.map((r) => r.id).filter(Boolean);
  dayItemsByDayId = await fetchPlanItemsForDays(dayIds);

  renderPlanDaysUi(planId, rows);
  return;

  container.innerHTML = rows
    .map((d) => {
      const dayWord = t('plan.ui.common.day', 'Day');
      const label = d.date ? `${dayWord} ${d.day_index} · ${d.date}` : `${dayWord} ${d.day_index}`;
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
            <div style="font-size:12px; color:#64748b; margin-bottom:0.25rem;">${escapeHtml(t('plan.ui.days.services', 'Services'))}</div>
            <div style="display:grid; gap:0.5rem;">
              ${nonPoiServiceItems
                .map((it) => {
                  const typeLabel = getServiceTypeLabel(it.item_type);
                  const resolved = resolveItemDisplay(it);
                  const title = String(resolved?.title || '');
                  const subtitle = String(resolved?.subtitle || '');
                  const description = String(resolved?.description || '');
                  const url = String(resolved?.url || '');
                  const price = String(resolved?.price || '');
                  const image = String(resolved?.image || '');
                  const rangeStart = it?.data && typeof it.data === 'object' ? Number(it.data.range_start_day_index || 0) : 0;
                  const rangeEnd = it?.data && typeof it.data === 'object' ? Number(it.data.range_end_day_index || 0) : 0;
                  const rangeId = it?.data && typeof it.data === 'object' ? String(it.data.range_id || '') : '';
                  const rangeBadge = rangeId && rangeStart > 0 && rangeEnd > 0 ? ` (${escapeHtml(t('plan.print.day', 'Day'))} ${rangeStart}–${escapeHtml(t('plan.print.day', 'Day'))} ${rangeEnd})` : '';
                  const link = url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="btn btn-sm">${escapeHtml(t('plan.ui.common.open', 'Open'))}</a>` : '';
                  const thumb = image ? `<a href="${escapeHtml(image)}" target="_blank" rel="noopener"><img src="${escapeHtml(image)}" alt="" loading="lazy" style="width:64px; height:48px; object-fit:cover; border-radius:8px; border:1px solid #e2e8f0;" /></a>` : '';
                  return `
                    <div style="display:flex; gap:0.5rem; align-items:flex-start; justify-content:space-between;">
                      ${thumb ? `<div style="flex:0 0 auto;">${thumb}</div>` : ''}
                      <div style="flex:1 1 auto; min-width:0;">
                        <div style="font-size:12px; color:#64748b;">${escapeHtml(typeLabel)}</div>
                        <div style="color:#0f172a; font-weight:600;">${escapeHtml(title)}${escapeHtml(rangeBadge)}</div>
                        ${subtitle ? `<div style=\"color:#64748b; font-size:12px;\">${escapeHtml(subtitle)}</div>` : ''}
                        ${(it.item_type === 'hotel' || it.item_type === 'trip') ? '' : (description ? `<div style=\"color:#475569; font-size:12px;\">${escapeHtml(description)}</div>` : '')}
                        ${price ? `<div style=\"color:#0f172a; font-size:12px;\">${escapeHtml(price)}</div>` : ''}
                      </div>
                      <div style="display:flex; gap:0.5rem; flex-wrap:wrap; justify-content:flex-end;">
                        ${link}
                        <button type="button" class="btn btn-sm" data-day-item-delete="${it.id}" data-range-id="${escapeHtml(rangeId)}" aria-label="${escapeHtml(t('plan.ui.common.delete', 'Delete'))}">✕</button>
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
              <div style="font-size:12px; color:#64748b; margin-bottom:0.25rem;">${escapeHtml(t('plan.ui.days.placesSchedule', 'Places (schedule)'))}</div>
              <div style="display:grid; gap:0.5rem;">
                ${sorted
                  .map((it) => {
                    const resolved = resolveItemDisplay(it);
                    const title = String(resolved?.title || '');
                    const description = String(resolved?.description || '');
                    const url = String(resolved?.url || '');
                    const image = String(resolved?.image || '');
                    const timeLabel = formatPoiTimeLabel(it);
                    const link = url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="btn btn-sm">${escapeHtml(t('plan.ui.common.open', 'Open'))}</a>` : '';
                    const thumb = image ? `<a href="${escapeHtml(image)}" target="_blank" rel="noopener"><img src="${escapeHtml(image)}" alt="" loading="lazy" style="width:64px; height:48px; object-fit:cover; border-radius:8px; border:1px solid #e2e8f0;" /></a>` : '';
                    const startV = it?.data && typeof it.data === 'object' ? String(it.data.start_time || '') : '';
                    const endV = it?.data && typeof it.data === 'object' ? String(it.data.end_time || '') : '';
                    return `
                      <div style="display:flex; gap:0.5rem; align-items:flex-start; justify-content:space-between;">
                        ${thumb ? `<div style="flex:0 0 auto;">${thumb}</div>` : ''}
                        <div style="flex:1 1 auto; min-width:0;">
                          <div style="display:flex; gap:0.5rem; align-items:baseline; flex-wrap:wrap;">
                            <div style="color:#0f172a; font-weight:600;">${escapeHtml(title || t('plan.ui.days.placeFallback', 'Place'))}</div>
                            ${timeLabel ? `<div style=\"color:#64748b; font-size:12px;\">${escapeHtml(timeLabel)}</div>` : ''}
                          </div>
                          ${description ? `<div style=\"color:#475569; font-size:12px; margin-top:0.25rem;\">${escapeHtml(description)}</div>` : ''}
                          <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.25rem;">
                            <label style="display:flex; gap:0.25rem; align-items:center; font-size:12px; color:#0f172a;">
                              ${escapeHtml(t('plan.ui.days.start', 'Start'))}
                              <input type="time" value="${escapeHtml(startV)}" data-poi-time-start="${it.id}" style="max-width:120px;" />
                            </label>
                            <label style="display:flex; gap:0.25rem; align-items:center; font-size:12px; color:#0f172a;">
                              ${escapeHtml(t('plan.ui.days.end', 'End'))}
                              <input type="time" value="${escapeHtml(endV)}" data-poi-time-end="${it.id}" style="max-width:120px;" />
                            </label>
                            <button type="button" class="btn btn-sm" data-poi-time-save="${it.id}">${escapeHtml(t('plan.ui.days.saveTime', 'Save time'))}</button>
                          </div>
                        </div>
                        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; justify-content:flex-end;">
                          ${link}
                          <button type="button" class="btn btn-sm" data-day-item-delete="${it.id}" aria-label="${escapeHtml(t('plan.ui.common.delete', 'Delete'))}">✕</button>
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
                    <button type="button" class="btn btn-sm" data-day-item-delete="${it.id}" aria-label="${escapeHtml(t('plan.ui.common.delete', 'Delete'))}">✕</button>
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
            <button type="button" class="btn btn-sm" data-day-quick-add="trip" data-day-id="${d.id}">${escapeHtml(t('plan.ui.days.addTrip', 'Add trip'))}</button>
            <button type="button" class="btn btn-sm" data-day-quick-add="hotel" data-day-id="${d.id}">${escapeHtml(t('plan.ui.days.addHotel', 'Add hotel'))}</button>
            <button type="button" class="btn btn-sm" data-day-quick-add="car" data-day-id="${d.id}">${escapeHtml(t('plan.ui.days.addCar', 'Add car'))}</button>
            <button type="button" class="btn btn-sm" data-day-quick-add="pois" data-day-id="${d.id}">${escapeHtml(t('plan.ui.days.addPlaces', 'Add places'))}</button>
          </div>
          <div style="margin-top:0.5rem; display:grid; gap:0.5rem;">
            <div style="display:grid; gap:0.25rem;">
              <label style="font-size:12px; color:#64748b;" for="dayCity_${d.id}">${escapeHtml(t('plan.ui.days.city', 'City'))}</label>
              <input id="dayCity_${d.id}" type="text" value="${escapeHtml(city)}" data-day-city="${d.id}" placeholder="${escapeHtml(t('plan.ui.days.city', 'City'))}" list="ceCityOptions" />
            </div>
            <div style="display:grid; gap:0.25rem;">
              <label style="font-size:12px; color:#64748b;" for="dayNotes_${d.id}">${escapeHtml(t('plan.ui.days.dayNotes', 'Day notes'))}</label>
              <textarea id="dayNotes_${d.id}" rows="2" data-day-notes="${d.id}" placeholder="${escapeHtml(t('plan.ui.days.notesPlaceholder', 'Notes'))}">${escapeHtml(notes)}</textarea>
            </div>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
              <button type="button" class="btn btn-sm" data-day-save="${d.id}">${escapeHtml(t('plan.ui.days.saveDay', 'Save day'))}</button>
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
    const poiItems = serviceItems.filter((it) => it && (it.item_type === 'poi' || it.item_type === 'recommendation'));
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

      if (statusEl instanceof HTMLElement) statusEl.textContent = t('plan.ui.status.saving', 'Saving…');
      const updated = await updateDayField(dayId, { city: city || null, notes: notes || null });
      if (updated) {
        if (statusEl instanceof HTMLElement) statusEl.textContent = t('plan.ui.status.saved', 'Saved.');
        const prev = planDaysById.get(dayId) || {};
        planDaysById.set(dayId, { ...prev, ...updated });
        renderServiceCatalog();
      } else {
        if (statusEl instanceof HTMLElement) statusEl.textContent = t('plan.ui.status.error', 'Error.');
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

      lastSelectedDayIdForCatalog = dayId;
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

let dayLangWired = false;

function wireDayLanguageRefresh() {
  if (dayLangWired) return;
  document.addEventListener('wakacjecypr:languagechange', () => {
    if (!currentPlan?.id) return;
    try {
      const rows = Array.from(planDaysById.values())
        .slice()
        .sort((a, b) => Number(a?.day_index || 0) - Number(b?.day_index || 0));
      renderPlanDaysUi(currentPlan.id, rows);
    } catch (e) {
      console.warn('Failed to refresh plan days after language change', e);
    }
  });
  dayLangWired = true;
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
    showToast(t('plan.ui.toast.setStartEndDateFirst', 'Set start and end date first.'), 'info');
    return;
  }

  const daysCount = daysBetweenInclusive(startDate, endDate);
  if (!daysCount) {
    showToast(t('plan.ui.toast.invalidDates', 'Invalid dates.'), 'error');
    return;
  }

  const sure = window.confirm(t('plan.ui.confirm.regenerateDays', 'Regenerate days? This will remove existing days and their items.'));
  if (!sure) return;

  setStatus(saveStatusEl(), t('plan.ui.status.regenerating', 'Regenerating…'), 'info');

  const { data: existing, error: loadErr } = await sb
    .from('user_plan_days')
    .select('id')
    .eq('plan_id', currentPlan.id);

  if (loadErr) {
    console.error('Failed to load existing days', loadErr);
    setStatus(saveStatusEl(), loadErr.message || t('plan.ui.toast.failedToLoadDays', 'Failed to load days'), 'error');
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
      setStatus(saveStatusEl(), daysDelErr.message || t('plan.ui.toast.failedToDeleteDays', 'Failed to delete days'), 'error');
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
    setStatus(saveStatusEl(), insertErr.message || t('plan.ui.toast.failedToRegenerate', 'Failed to regenerate'), 'error');
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
  setStatus(saveStatusEl(), t('plan.ui.status.daysRegenerated', 'Days regenerated.'), 'success');
}

function renderPlanDetails(plan) {
  const empty = emptyStateEl();
  const wrap = detailsWrapEl();

  const delBtn = el('planDeleteBtn');
  const refreshBtn = el('planRefreshBtn');
  const pdfBtn = el('planPdfBtn');
  const emailBtn = el('planEmailBtn');
  const saveBtn = el('planSaveBtn');

  if (delBtn instanceof HTMLButtonElement) {
    delBtn.disabled = !plan;
  }
  if (refreshBtn instanceof HTMLButtonElement) {
    refreshBtn.disabled = !plan;
  }
  if (pdfBtn instanceof HTMLButtonElement) {
    pdfBtn.disabled = !plan;
  }
  if (emailBtn instanceof HTMLButtonElement) {
    emailBtn.disabled = !plan;
  }
  if (saveBtn instanceof HTMLButtonElement) {
    saveBtn.disabled = !plan;
  }

  if (!plan) {
    if (wrap) wrap.hidden = true;
    if (empty) empty.hidden = false;
    const cat = catalogEl();
    if (cat) cat.innerHTML = '';
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
  if (!sb) {
    showToast(t('plan.ui.toast.supabaseNotReady', 'Supabase is not ready.'), 'info');
    return;
  }

  const user = await getCurrentUser();
  if (!user) {
    showToast(t('plan.ui.toast.loginFirst', 'Please log in first.'), 'info');
    return;
  }

  const form = el('planCreateForm');
  if (!(form instanceof HTMLFormElement)) return;

  setStatus(createStatusEl(), t('plan.ui.status.creating', 'Creating…'), 'info');

  const title = String(new FormData(form).get('title') || '').trim();
  const baseCity = String(new FormData(form).get('base_city') || '').trim();
  const startDate = String(new FormData(form).get('start_date') || '').trim();
  const endDate = String(new FormData(form).get('end_date') || '').trim();
  const includeNorth = String(new FormData(form).get('include_north') || '') === 'on';

  const aRaw = Math.max(0, Math.floor(Number(new FormData(form).get('adults') || 0) || 0));
  const cRaw = Math.max(0, Math.floor(Number(new FormData(form).get('children') || 0) || 0));
  const sum = aRaw + cRaw;
  const createAdults = sum > 0 ? aRaw : 1;
  const createChildren = sum > 0 ? cRaw : 0;
  const createPeople = Math.max(1, createAdults + createChildren);

  const daysCount = startDate && endDate ? daysBetweenInclusive(startDate, endDate) : null;
  if ((startDate && endDate) && !daysCount) {
    setStatus(createStatusEl(), t('plan.ui.toast.invalidDates', 'Invalid dates.'), 'error');
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
    people_count: createPeople,
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
    setStatus(createStatusEl(), error.message || t('plan.ui.toast.failedToCreatePlan', 'Failed to create plan'), 'error');
    showToast(error.message || t('plan.ui.toast.failedToCreatePlan', 'Failed to create plan'), 'error');
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

  if (created?.id) {
    savePartyForPlan(created.id, { adults: createAdults, children: createChildren });
  }

  setStatus(createStatusEl(), t('plan.ui.status.created', 'Created.'), 'success');
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
    setStatus(saveStatusEl(), t('plan.ui.toast.invalidDates', 'Invalid dates.'), 'error');
    return;
  }

  setStatus(saveStatusEl(), t('plan.ui.status.saving', 'Saving…'), 'info');

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
    setStatus(saveStatusEl(), error.message || t('plan.ui.toast.failedToSave', 'Failed to save'), 'error');
    showToast(error.message || t('plan.ui.toast.failedToSave', 'Failed to save'), 'error');
    return;
  }

  currentPlan = updated || currentPlan;
  setStatus(saveStatusEl(), t('plan.ui.status.saved', 'Saved.'), 'success');
  await loadPlans({ selectId: currentPlan.id });
  await loadPlanDays(currentPlan.id);
  renderServiceCatalog();
  renderPlanCostSummary();
}

async function handleDeletePlan() {
  if (!sb || !currentPlan?.id) return;
  const sure = window.confirm(t('plan.ui.confirm.deletePlan', 'Delete this plan? This cannot be undone.'));
  if (!sure) return;

  const { error } = await sb
    .from('user_plans')
    .delete()
    .eq('id', currentPlan.id);

  if (error) {
    console.error('Failed to delete plan', error);
    showToast(error.message || t('plan.ui.toast.failedToDeletePlan', 'Failed to delete plan'), 'error');
    return;
  }

  showToast(t('plan.ui.toast.planDeleted', 'Plan deleted.'), 'success');
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

    setStatus(statusEl, t('plan.ui.booking.requestSent', 'Request sent. We will contact you shortly.'), 'success');
    showToast(t('plan.ui.toast.bookingRequestSent', 'Booking request sent.'), 'success');
    const dialog = bookingDialogEl();
    if (dialog && typeof dialog.close === 'function') dialog.close();
  } catch (e) {
    console.error('Planner booking submit failed', e);
    setStatus(statusEl, e?.message || t('plan.ui.toast.failedToSendRequest', 'Failed to send request.'), 'error');
    showToast(e?.message || t('plan.ui.toast.failedToSendRequest', 'Failed to send request.'), 'error');
  } finally {
    if (btn instanceof HTMLButtonElement) {
      btn.disabled = false;
      btn.textContent = t('plan.booking.dialog.submit', 'Send request');
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

  const pdfBtn = el('planPdfBtn');
  if (pdfBtn instanceof HTMLButtonElement && !pdfBtn.dataset.wired) {
    pdfBtn.addEventListener('click', () => downloadPlanPdf());
    pdfBtn.dataset.wired = '1';
  }

  const emailBtn = el('planEmailBtn');
  if (emailBtn instanceof HTMLButtonElement && !emailBtn.dataset.wired) {
    emailBtn.addEventListener('click', () => emailPlanToUser());
    emailBtn.dataset.wired = '1';
  }

  const reqBtn = requestBookingBtnEl();
  if (reqBtn instanceof HTMLButtonElement && !reqBtn.dataset.wired) {
    reqBtn.addEventListener('click', async () => {
      if (!currentPlan?.id) return;
      const dialog = bookingDialogEl();
      if (!dialog || typeof dialog.showModal !== 'function') {
        const s = computePlanCostSummary();
        const msg = `${t('plan.ui.booking.collectedPrefix', 'Collected:')} ${t('plan.ui.cost.trips', 'Trips')} ${formatMoney(s.tripsTotal, s.currency)}, ${t('plan.ui.cost.cars', 'Cars')} ${formatMoney(s.carsTotal, s.currency)}, ${t('plan.ui.cost.accommodation', 'Hotels')} ${formatMoney(s.hotelsTotal, s.currency)}.`;
        setStatus(requestBookingStatusEl(), msg, 'info');
        showToast(t('plan.ui.toast.bookingFormUnavailable', 'Booking form unavailable in this browser.'), 'info');
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
  wireCeLightboxDelegation();
  const ok = await ensureSupabase();
  if (!ok) {
    setStatus(createStatusEl(), t('plan.ui.toast.supabaseNotReady', 'Supabase not ready. Please refresh the page.'), 'error');
    setStatus(saveStatusEl(), t('plan.ui.toast.supabaseNotReady', 'Supabase not ready. Please refresh the page.'), 'error');
    return;
  }

  try {
    await waitForAuthReadySafe({ timeoutMs: 7000 });
  } catch (_) {}
  try {
    await ensureSupabaseSessionFromPersistedSnapshot({ timeoutMs: 7000 });
  } catch (_) {}

  setCurrentYear();

  wireEvents();
  wireDayLanguageRefresh();

  try {
    sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        currentPlan = null;
        renderPlanDetails(null);
        setLastSelectedPlanId(null);
        await loadPlans();
        return;
      }

      if (event === 'INITIAL_SESSION' && !session) {
        const desired = parseHashPlanId() || getLastSelectedPlanId();
        await loadPlans({ selectId: desired || null });
        return;
      }

      if (!session) {
        await loadPlans();
        return;
      }

      if (currentPlan?.id) {
        return;
      }

      const desired = parseHashPlanId() || getLastSelectedPlanId();
      if (desired) {
        await selectPlanById(desired, { skipListReload: true });
      }
      await loadPlans({ selectId: desired || null });
    });
  } catch (_) {}

  await loadPlans();

  const desiredId = parseHashPlanId() || getLastSelectedPlanId();
  if (desiredId) {
    await selectPlanById(desiredId);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  void init();
}
