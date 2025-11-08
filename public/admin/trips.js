// Admin Trips management
import { sb, supabase } from '/js/supabaseClient.js';

const $ = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>r.querySelectorAll(s);

function toast(msg){ if(window.showToast) window.showToast(msg); else console.log('[TRIPS]', msg); }

async function getAuthHeader(){
  const client = sb || supabase || window.sb || window.supabase;
  const { data: { session } } = await client.auth.getSession();
  if (!session || !session.access_token) throw new Error('No session');
  return `Bearer ${session.access_token}`;
}

async function api(path, opts={}){
  const headers = opts.headers || {};
  if (!headers['Content-Type'] && opts.body) headers['Content-Type'] = 'application/json';
  headers['Authorization'] = await getAuthHeader();
  const res = await fetch(path, { ...opts, headers });
  const isJson = (res.headers.get('content-type')||'').includes('application/json');
  const data = isJson ? await res.json() : await res.text();
  if (!res.ok) throw new Error(data?.error || data || 'API error');
  return data;
}

// State
const state = {
  trips: [],
  selectedId: null,
};

function categoriesToValue(arr){
  if (!Array.isArray(arr)) return '';
  return arr.join(', ');
}
function valueToCategories(val){
  const s = (val||'').trim();
  if (!s) return [];
  return s.split(',').map(v=>v.trim()).filter(Boolean);
}

function renderTripsTable(){
  const tbody = $('#tripsTable');
  if (!tbody) return;
  if (!state.trips.length){
    tbody.innerHTML = '<tr><td colspan="6" class="table-loading">No trips</td></tr>';
    return;
  }
  tbody.innerHTML = state.trips.map(t=>`
    <tr class="${state.selectedId===t.id?'row-selected':''}">
      <td>${t.slug}</td>
      <td>${t.start_city||''}</td>
      <td>${t.pricing_model}</td>
      <td>${t.status}</td>
      <td>${t.updated_at ? new Date(t.updated_at).toLocaleString() : ''}</td>
      <td style="display:flex;gap:6px;">
        <button class="btn-secondary" data-act="edit" data-id="${t.id}">Edit</button>
        <button class="btn-secondary" data-act="bookings" data-id="${t.id}">Bookings</button>
        ${t.status!=='published'?`<button class="btn-primary" data-act="publish" data-id="${t.id}">Publish</button>`:''}
      </td>
    </tr>
  `).join('');
}

function setFormFromTrip(t){
  const f = $('#tripForm');
  if (!f) return;
  f.id.value = t.id || '';
  f.slug.value = t.slug || '';
  f.start_city.value = t.start_city || '';
  f.categories.value = categoriesToValue(t.categories);
  f.display_mode.value = t.display_mode || 'auto';
  f.display_label.value = t.display_label || '';
  f.cover_image_url.value = t.cover_image_url || '';
  // i18n (Polish only for now)
  f.title_pl.value = (t.title && (t.title.pl || t.title.en || '')) || '';
  f.description_pl.value = (t.description && (t.description.pl || t.description.en || '')) || '';
  f.pricing_model.value = t.pricing_model || 'per_person';
  renderPriceFields(t.pricing_model, t);
}

function clearForm(){
  const f = $('#tripForm');
  f.reset();
  f.id.value='';
  renderPriceFields($('#pricingModel').value);
  $('#bookingsTable').innerHTML = '<tr><td colspan="5" class="table-loading">Select a trip to load bookings</td></tr>';
  state.selectedId = null;
  renderTripsTable();
}

function renderPriceFields(model, t={}){
  const c = $('#priceFields');
  if (!c) return;
  const getVal = (k, d='')=> t[k] ?? d;
  if (model==='per_person'){
    c.innerHTML = `
      <label>Price per person<input name="price_per_person" type="number" step="0.01" value="${getVal('price_per_person','')}"/></label>
    `;
  } else if (model==='base_plus_extra'){
    c.innerHTML = `
      <label>Base price<input name="price_base" type="number" step="0.01" value="${getVal('price_base','')}"/></label>
      <label>Included people<input name="included_people" type="number" step="1" value="${getVal('included_people','')}"/></label>
      <label>Extra per person<input name="price_extra_person" type="number" step="0.01" value="${getVal('price_extra_person','')}"/></label>
    `;
  } else if (model==='per_hour'){
    c.innerHTML = `
      <label>Price per hour<input name="price_base" type="number" step="0.01" value="${getVal('price_base','')}"/></label>
      <label>Min hours<input name="min_hours" type="number" step="1" value="${getVal('min_hours','')}"/></label>
    `;
  } else if (model==='per_day'){
    c.innerHTML = `
      <label>Price per day<input name="price_base" type="number" step="0.01" value="${getVal('price_base','')}"/></label>
    `;
  } else {
    c.innerHTML = '';
  }
}

function collectForm(){
  const f = $('#tripForm');
  const model = f.pricing_model.value;
  const base = (n)=>{ const v=f[n]?.value?.trim(); return v===''?null:Number(v); };
  const payload = {
    slug: f.slug.value.trim(),
    start_city: f.start_city.value.trim(),
    categories: valueToCategories(f.categories.value),
    display_mode: f.display_mode.value,
    display_label: f.display_label.value.trim()||null,
    cover_image_url: f.cover_image_url.value.trim()||null,
    pricing_model: model,
    title: { pl: f.title_pl.value.trim() },
    description: { pl: f.description_pl.value.trim() },
  };
  if (model==='per_person'){
    payload.price_per_person = base('price_per_person');
  } else if (model==='base_plus_extra'){
    payload.price_base = base('price_base');
    payload.included_people = base('included_people');
    payload.price_extra_person = base('price_extra_person');
  } else if (model==='per_hour'){
    payload.price_base = base('price_base');
    payload.min_hours = base('min_hours');
  } else if (model==='per_day'){
    payload.price_base = base('price_base');
  }
  return payload;
}

async function loadTrips(){
  const q = ($('#tripSearch').value||'').trim();
  const status = $('#tripStatusFilter').value||'';
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (status) params.set('status', status);
  const data = await api(`/admin/trips${params.toString()?`?${params.toString()}`:''}`);
  state.trips = data || [];
  renderTripsTable();
}

async function saveTrip(){
  const f = $('#tripForm');
  const id = f.id.value || null;
  const payload = collectForm();
  if (!payload.slug) { toast('Slug is required'); return; }
  if (!payload.start_city) { toast('Start city is required'); return; }

  if (id){
    const data = await api(`/admin/trips/${id}`, { method:'PUT', body: JSON.stringify(payload) });
    toast('Trip updated');
    state.selectedId = data.id;
  } else {
    const data = await api('/admin/trips', { method:'POST', body: JSON.stringify(payload) });
    toast('Trip created');
    state.selectedId = data.id;
  }
  await loadTrips();
  const selected = state.trips.find(t=>t.id===state.selectedId);
  if (selected) setFormFromTrip(selected);
}

async function publishTrip(){
  if (!state.selectedId){ toast('Select a trip first'); return; }
  await api(`/admin/trips/${state.selectedId}/publish`, { method:'POST' });
  toast('Trip published');
  await loadTrips();
}

async function loadBookingsForSelected(){
  const tbody = $('#bookingsTable');
  if (!state.selectedId){
    tbody.innerHTML = '<tr><td colspan="5" class="table-loading">Select a trip to load bookings</td></tr>';
    return;
  }
  const data = await api(`/admin/trips/${state.selectedId}/bookings`);
  if (!data?.length){
    tbody.innerHTML = '<tr><td colspan="5" class="table-loading">No bookings</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(b=>`
    <tr>
      <td>${b.id}</td>
      <td>${(b.customer_name||'')+' • '+(b.customer_email||'')}</td>
      <td>${(b.price_total!=null?Number(b.price_total).toFixed(2):'-')} ${b.price_currency||'EUR'}</td>
      <td>${b.status}</td>
      <td>${b.created_at?new Date(b.created_at).toLocaleString():''}</td>
    </tr>
  `).join('');
}

function bindEvents(){
  $('#btnRefreshTrips')?.addEventListener('click', loadTrips);
  $('#btnSearchTrips')?.addEventListener('click', loadTrips);
  $('#btnNewTrip')?.addEventListener('click', ()=>{ clearForm(); $('#tripFormTitle').textContent='New Trip'; });
  $('#btnResetForm')?.addEventListener('click', clearForm);
  $('#btnPublishTrip')?.addEventListener('click', publishTrip);
  $('#tripForm')?.addEventListener('submit', async (e)=>{ e.preventDefault(); await saveTrip(); await loadBookingsForSelected(); });
  $('#pricingModel')?.addEventListener('change', (e)=>{ renderPriceFields(e.target.value); });
  $('#tripsTable')?.addEventListener('click', async (e)=>{
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.dataset.id;
    const act = btn.dataset.act;
    const t = state.trips.find(x=>x.id===id);
    if (!t) return;
    if (act==='edit'){
      state.selectedId = id;
      $('#tripFormTitle').textContent = `Edit Trip · ${t.slug}`;
      setFormFromTrip(t);
      await loadBookingsForSelected();
      renderTripsTable();
    } else if (act==='bookings'){
      state.selectedId = id;
      await loadBookingsForSelected();
      renderTripsTable();
    } else if (act==='publish'){
      state.selectedId = id;
      await publishTrip();
    }
  });
}

async function ensureAuth(){
  const client = sb || supabase || window.sb || window.supabase;
  const { data: { session } } = await client.auth.getSession();
  if (!session || !session.user){
    window.location.replace('/admin/login.html');
    return false;
  }
  return true;
}

(async function init(){
  if (!(await ensureAuth())) return;
  bindEvents();
  renderPriceFields($('#pricingModel')?.value||'per_person');
  await loadTrips();
})();
