// Shared Detail Modal for Trips and Hotels
// Minimal, modern, accessible; writes bookings into Supabase admin tables

let detailModalOpen = false;
let lastFocusedEl = null;

function qs(sel, root=document) { return root.querySelector(sel); }
function qsa(sel, root=document) { return Array.from(root.querySelectorAll(sel)); }

function normalizeAuthUiError(message, fallback = 'Wystąpił błąd.') {
  const raw = (typeof message === 'string' ? message : String(message?.message || message || '')).trim();
  if (!raw) return fallback;
  const authUtils = (typeof window !== 'undefined' && window.CE_AUTH_UTILS && typeof window.CE_AUTH_UTILS.toUserMessage === 'function')
    ? window.CE_AUTH_UTILS
    : null;
  if (authUtils && typeof authUtils.toUserMessage === 'function') {
    return authUtils.toUserMessage(raw, 'Session expired. Please sign in again.');
  }
  return raw;
}

function escapeInlineHtml(value) {
  const raw = String(value || '');
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function lockScroll(lock){
  document.body.classList.toggle('modal-open', !!lock);
  document.body.style.overflow = lock ? 'hidden' : '';
}

function trapFocus(modal){
  const focusables = qsa('a,button,input,select,textarea,[tabindex]:not([tabindex="-1"])', modal).filter(el=>!el.disabled && el.offsetParent!==null);
  if (!focusables.length) return;
  const [first,last] = [focusables[0], focusables[focusables.length-1]];
  modal.addEventListener('keydown', (e)=>{
    if (e.key === 'Tab'){
      if (e.shiftKey && document.activeElement === first){ last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last){ first.focus(); e.preventDefault(); }
    } else if (e.key === 'Escape'){
      closeDetailModal();
    }
  });
  first.focus();
}

function openSkeleton(){
  const modal = qs('#detailModal');
  const body = qs('#detailModalBody');
  body.innerHTML = `
    <div class="detail-skeleton">
      <div class="sk-media"></div>
      <div class="sk-lines">
        <div class="sk-line"></div>
        <div class="sk-line"></div>
        <div class="sk-line short"></div>
      </div>
    </div>
  `;
  modal.hidden = false;
  detailModalOpen = true;
  lockScroll(true);
  trapFocus(modal);
}

export async function openDetailModal(opts){
  try{
    lastFocusedEl = document.activeElement;
    openSkeleton();
    const { type, slug } = opts;
    const data = type === 'trip' ? await fetchTripBySlug(slug) : await fetchHotelBySlug(slug);
    if (!data) throw new Error('Brak danych');
    const vm = type === 'trip' ? mapTrip(data) : mapHotel(data);
    renderDetail(type, vm);
    if (window.dataLayer) window.dataLayer.push({event:'modal_open', type, slug});
  }catch(err){
    console.error(err);
    const body = qs('#detailModalBody');
    const msg = normalizeAuthUiError(err, 'Nie udało się wczytać danych.');
    body.innerHTML = `<div style="padding:1rem;color:#dc2626;">${escapeInlineHtml(msg)}</div>`;
  }
}

export function closeDetailModal(){
  const modal = qs('#detailModal');
  modal.hidden = true;
  detailModalOpen = false;
  lockScroll(false);
  if (lastFocusedEl) lastFocusedEl.focus();
}

// Data
async function fetchTripBySlug(slug){
  const { supabase } = await import('/js/supabaseClient.js');
  const { data, error } = await supabase.from('trips').select('*').eq('slug', slug).single();
  if (error) throw error;
  return data;
}
async function fetchHotelBySlug(slug){
  const { supabase } = await import('/js/supabaseClient.js');
  const { data, error } = await supabase.from('hotels').select('*').eq('slug', slug).single();
  if (error) throw error;
  return data;
}

// Mapping
function priceLabelFromTrip(t){
  const pm = t.pricing_model || 'per_person';
  if (pm==='per_person' && t.price_per_person) return `${Number(t.price_per_person).toFixed(2)} € / os.`;
  if (t.price_base) return `${Number(t.price_base).toFixed(2)} € baza`;
  if (t.hourly_rate) return `${Number(t.hourly_rate).toFixed(2)} € / godz.`;
  if (t.daily_rate) return `${Number(t.daily_rate).toFixed(2)} € / dzień`;
  return '';
}
function mapTrip(t){
  return {
    id: t.id,
    slug: t.slug,
    title: t.title?.pl || t.title?.en || t.title || t.slug,
    city: t.start_city || 'All Cities',
    priceLabel: priceLabelFromTrip(t),
    duration: t.duration || null,
    images: [t.cover_image_url].filter(Boolean).concat(Array.isArray(t.gallery)? t.gallery: []),
    highlights: Array.isArray(t.highlights)? t.highlights: [],
    raw: t,
  };
}
function hotelMinPrice(h){
  const rules = h.pricing_tiers?.rules || [];
  if (!rules.length) return '';
  let min = Infinity;
  rules.forEach(r=>{ const p=Number(r.price_per_night); if(isFinite(p) && p<min) min=p; });
  return isFinite(min) ? `${min.toFixed(2)} € / noc` : '';
}
function mapHotel(h){
  const photos = Array.isArray(h.photos)? h.photos: [];
  return {
    id: h.id,
    slug: h.slug,
    title: window.getHotelName ? window.getHotelName(h) : (h.title?.pl || h.title?.en || h.slug),
    city: h.city || '',
    priceLabel: hotelMinPrice(h),
    images: [h.cover_image_url].filter(Boolean).concat(photos),
    amenities: Array.isArray(h.amenities)? h.amenities: [],
    max_persons: h.max_persons || null,
    raw: h,
  };
}

// Price calculations
function calcTripTotal(t, {adults=1, children=0, hours=1, days=1}){
  const pm = t.pricing_model || 'per_person';
  if (pm==='per_person' && t.price_per_person){
    const per = Number(t.price_per_person)||0;
    return per*(adults+children);
  }
  if (t.hourly_rate) return (Number(t.hourly_rate)||0)*hours;
  if (t.daily_rate) return (Number(t.daily_rate)||0)*days;
  if (t.price_base) return Number(t.price_base)||0;
  return 0;
}
function calcHotelTotal(h, persons, nights){
  const model = h.pricing_model || 'per_person_per_night';
  const tiers = h.pricing_tiers?.rules || [];
  if (!tiers.length) return 0;
  
  persons = Number(persons) || 1;
  nights = Number(nights) || 1;
  let rule = null;
  
  // Helper functions inline
  const findByPersons = () => {
    let r = tiers.find(t => Number(t.persons) === persons);
    if (r) return r;
    const lowers = tiers.filter(t => Number(t.persons) <= persons);
    if (lowers.length) return lowers.sort((a, b) => Number(b.persons) - Number(a.persons))[0];
    return null;
  };
  
  const findByNights = () => {
    const matching = tiers
      .filter(r => !r.min_nights || Number(r.min_nights) <= nights)
      .sort((a, b) => (Number(b.min_nights) || 0) - (Number(a.min_nights) || 0));
    return matching[0] || tiers[0];
  };
  
  const findByPersonsAndNights = () => {
    let personTiers = tiers.filter(r => Number(r.persons) === persons);
    if (!personTiers.length) {
      const lowers = tiers.filter(r => Number(r.persons) <= persons);
      if (lowers.length) {
        const maxP = Math.max(...lowers.map(r => Number(r.persons)));
        personTiers = lowers.filter(r => Number(r.persons) === maxP);
      }
    }
    if (!personTiers.length) return null;
    const matching = personTiers
      .filter(r => !r.min_nights || Number(r.min_nights) <= nights)
      .sort((a, b) => (Number(b.min_nights) || 0) - (Number(a.min_nights) || 0));
    return matching[0] || personTiers[0];
  };
  
  switch (model) {
    case 'flat_per_night':
      rule = findByNights();
      break;
    case 'tiered_by_nights':
      rule = findByPersonsAndNights();
      break;
    default:
      rule = findByPersons();
      break;
  }
  
  if (!rule) {
    rule = tiers.sort((a, b) => Number(a.price_per_night) - Number(b.price_per_night))[0];
  }
  
  const pricePerNight = Number(rule.price_per_night || 0);
  const minN = Number(rule.min_nights || 0);
  const billableNights = minN ? Math.max(minN, nights) : nights;
  
  return billableNights * pricePerNight;
}

// Render
function renderDetail(type, vm){
  const body = qs('#detailModalBody');
  const hero = (vm.images && vm.images[0]) ? `<img src="${vm.images[0]}" alt="${vm.title}">` : '';
  const chips = [vm.city, vm.priceLabel, vm.duration].filter(Boolean).map(x=>`<span class="chip">${x}</span>`).join('');

  const commonTop = `
    <div class="detail-content">
      <figure class="detail-hero">${hero}</figure>
      <section class="detail-info">
        <h3 style="margin:0; font-size:1.3rem; font-weight:800;">${vm.title}</h3>
        <div class="detail-chips">${chips}</div>
        ${vm.highlights? `<ul style="margin:.25rem 0 0; padding-left:1.1rem; color:#374151;">${vm.highlights.slice(0,5).map(h=>`<li>${h}</li>`).join('')}</ul>`: ''}
      </section>
    </div>`;

  let booking = '';
  if (type==='trip'){
    booking = `
      <form class="detail-booking" id="detailBookingForm" data-type="trip" novalidate>
        <div class="row">
          <label>Imię i nazwisko<input name="name" required></label>
          <label>E-mail<input name="email" type="email" required></label>
        </div>
        <div class="row">
          <label>Telefon<input name="phone" required></label>
          <label>Data wycieczki<input type="date" name="trip_date" required></label>
        </div>
        <div class="row">
          <label>Dorośli<select name="adults"><option>1</option><option>2</option><option>3</option><option>4</option></select></label>
          <label>Dzieci<select name="children"><option>0</option><option>1</option><option>2</option></select></label>
        </div>
        <div class="row">
          <label>Godziny<input type="number" name="hours" min="1" value="1"></label>
          <label>Dni<input type="number" name="days" min="1" value="1"></label>
        </div>
        <label>Uwagi<textarea name="notes" rows="3" placeholder="Dodatkowe informacje"></textarea></label>
        <div class="row">
          <label>Kod kuponu<input name="coupon_code" id="detailCouponCode" maxlength="64" autocomplete="off" placeholder="Wpisz kod kuponu"></label>
          <label>Cena końcowa<input id="detailTotalPreview" readonly value="0.00 €"></label>
        </div>
        <div class="row">
          <button class="btn btn-primary" type="button" id="detailApplyCoupon">Zastosuj kupon</button>
          <button class="btn btn-primary" type="button" id="detailClearCoupon" hidden style="background:#475569;">Wyczyść kupon</button>
        </div>
        <p id="detailDiscountPreview" style="margin:0;color:#64748b;font-size:12px;">Brak rabatu</p>
        <p class="booking-message" id="detailCouponMsg" style="display:none;"></p>
        <p class="booking-message" id="detailBookingMsg"></p>
        <button class="btn btn-primary primary booking-submit" type="submit">Zarezerwuj</button>
      </form>`;
  } else {
    booking = `
      <form class="detail-booking" id="detailBookingForm" data-type="hotel" novalidate>
        <div class="row">
          <label>Imię i nazwisko<input name="name" required></label>
          <label>E-mail<input name="email" type="email" required></label>
        </div>
        <div class="row">
          <label>Telefon<input name="phone" required></label>
          <span></span>
        </div>
        <div class="row">
          <label>Przyjazd<input type="date" name="arrival_date" required></label>
          <label>Wyjazd<input type="date" name="departure_date" required></label>
        </div>
        <div class="row">
          <label>Dorośli<select name="adults"><option>1</option><option>2</option><option>3</option><option>4</option></select></label>
          <label>Dzieci<select name="children"><option>0</option><option>1</option><option>2</option></select></label>
        </div>
        <label>Uwagi<textarea name="notes" rows="3" placeholder="Preferencje, pytania..."></textarea></label>
        <div class="row">
          <label>Kod kuponu<input name="coupon_code" id="detailCouponCode" maxlength="64" autocomplete="off" placeholder="Wpisz kod kuponu"></label>
          <label>Cena końcowa<input id="detailTotalPreview" readonly value="0.00 €"></label>
        </div>
        <div class="row">
          <button class="btn btn-primary" type="button" id="detailApplyCoupon">Zastosuj kupon</button>
          <button class="btn btn-primary" type="button" id="detailClearCoupon" hidden style="background:#475569;">Wyczyść kupon</button>
        </div>
        <p id="detailDiscountPreview" style="margin:0;color:#64748b;font-size:12px;">Brak rabatu</p>
        <p class="booking-message" id="detailCouponMsg" style="display:none;"></p>
        <p class="booking-message" id="detailBookingMsg"></p>
        <button class="btn btn-primary primary booking-submit" type="submit">Zarezerwuj nocleg</button>
      </form>`;
  }

  body.innerHTML = commonTop + booking;

  // header title
  const titleEl = qs('#detailModalTitle');
  titleEl.textContent = vm.title;

  const form = qs('#detailBookingForm');
  const detailCouponState = { applied: null };

  const normalizeDetailCouponCode = (value) => String(value || '').trim().toUpperCase();
  const detailMoney = (value) => `${Number(value || 0).toFixed(2)} €`;
  const extractMissingColumn = (error) => {
    const message = String(error?.message || '');
    const match = message.match(/Could not find the ['"]([^'"]+)['"] column/i);
    return match && match[1] ? String(match[1]).trim() : '';
  };

  const couponInput = qs('#detailCouponCode', form);
  const couponApplyBtn = qs('#detailApplyCoupon', form);
  const couponClearBtn = qs('#detailClearCoupon', form);
  const couponMsg = qs('#detailCouponMsg', form);
  const totalPreviewInput = qs('#detailTotalPreview', form);
  const discountPreviewEl = qs('#detailDiscountPreview', form);

  const setCouponStatus = (message = '', type = 'info') => {
    if (!couponMsg) return;
    const text = String(message || '').trim();
    if (!text) {
      couponMsg.style.display = 'none';
      couponMsg.textContent = '';
      couponMsg.className = 'booking-message';
      return;
    }
    couponMsg.style.display = 'block';
    couponMsg.textContent = text;
    if (type === 'error') {
      couponMsg.className = 'booking-message error';
    } else if (type === 'success') {
      couponMsg.className = 'booking-message success';
    } else {
      couponMsg.className = 'booking-message';
    }
  };

  const syncCouponControls = () => {
    const code = normalizeDetailCouponCode(couponInput?.value || '');
    if (couponApplyBtn instanceof HTMLButtonElement) couponApplyBtn.disabled = !code;
    if (couponClearBtn instanceof HTMLButtonElement) couponClearBtn.hidden = !code && !detailCouponState.applied;
  };

  const clearCouponState = (options = {}) => {
    const clearInput = options.clearInput !== false;
    detailCouponState.applied = null;
    if (clearInput && couponInput) couponInput.value = '';
    setCouponStatus('', 'info');
    syncCouponControls();
  };

  const getBaseTotal = () => {
    const fd = new FormData(form);
    if (form.dataset.type === 'trip') {
      const t = vm.raw;
      return calcTripTotal(t, {
        adults: Number(fd.get('adults') || 1),
        children: Number(fd.get('children') || 0),
        hours: Number(fd.get('hours') || 1),
        days: Number(fd.get('days') || 1),
      });
    }
    const h = vm.raw;
    const a = fd.get('arrival_date');
    const d = fd.get('departure_date');
    const toDate = (value) => new Date(value);
    const nights = Math.max(1, Math.round((toDate(d) - toDate(a)) / (1000 * 60 * 60 * 24)));
    const adults = Number(fd.get('adults') || 1);
    const children = Number(fd.get('children') || 0);
    return calcHotelTotal(h, adults + children, nights);
  };

  const getCouponContext = (baseTotal) => {
    const base = Number(baseTotal || 0);
    const code = normalizeDetailCouponCode(couponInput?.value || '');
    const appliedCode = normalizeDetailCouponCode(detailCouponState.applied?.couponCode || '');
    const hasApplied = Boolean(detailCouponState.applied && code && code === appliedCode);
    const discount = hasApplied ? Math.min(base, Number(detailCouponState.applied?.discountAmount || 0)) : 0;
    return {
      code,
      hasApplied,
      discount,
      baseTotal: base,
      finalTotal: Math.max(0, base - discount),
    };
  };

  const renderQuotePreview = () => {
    const baseTotal = Number(getBaseTotal() || 0);
    const coupon = getCouponContext(baseTotal);
    if (totalPreviewInput) totalPreviewInput.value = detailMoney(coupon.finalTotal);
    if (discountPreviewEl) {
      discountPreviewEl.textContent = coupon.hasApplied
        ? `Rabat: -${detailMoney(coupon.discount)} (cena bazowa ${detailMoney(coupon.baseTotal)})`
        : `Cena bazowa: ${detailMoney(coupon.baseTotal)}`;
    }
    syncCouponControls();
  };

  const invalidateCouponAfterQuoteChange = () => {
    if (!detailCouponState.applied) return;
    detailCouponState.applied = null;
    const code = normalizeDetailCouponCode(couponInput?.value || '');
    if (code) {
      setCouponStatus('Zmieniły się dane rezerwacji. Zastosuj kupon ponownie.', 'info');
    } else {
      setCouponStatus('', 'info');
    }
  };

  const applyCouponForCurrentForm = async () => {
    const code = normalizeDetailCouponCode(couponInput?.value || '');
    if (!code) {
      setCouponStatus('Wpisz kod kuponu.', 'error');
      syncCouponControls();
      return false;
    }

    const baseTotal = Number(getBaseTotal() || 0);
    if (!(baseTotal > 0)) {
      setCouponStatus('Uzupełnij dane rezerwacji, aby przeliczyć kupon.', 'error');
      syncCouponControls();
      return false;
    }

    if (couponApplyBtn instanceof HTMLButtonElement) couponApplyBtn.disabled = true;
    try {
      const fd = new FormData(form);
      const { quoteServiceCoupon } = await import('/js/service-coupons.js');
      const isTrip = form.dataset.type === 'trip';
      const row = vm.raw;
      const response = await quoteServiceCoupon({
        serviceType: isTrip ? 'trips' : 'hotels',
        couponCode: code,
        baseTotal,
        serviceAt: isTrip ? (fd.get('trip_date') || null) : (fd.get('arrival_date') || null),
        resourceId: row.id,
        categoryKeys: isTrip
          ? [row.slug, row.start_city].map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean)
          : [row.slug, row.city].map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean),
        userEmail: String(fd.get('email') || '').trim().toLowerCase() || null,
      });
      if (!response?.ok || !response.result) {
        detailCouponState.applied = null;
        setCouponStatus(String(response?.message || 'Kupon nie działa dla tej rezerwacji.'), 'error');
        renderQuotePreview();
        return false;
      }

      detailCouponState.applied = {
        couponId: response.result.couponId || null,
        couponCode: normalizeDetailCouponCode(response.result.couponCode || code),
        discountAmount: Number(response.result.discountAmount || 0),
        partnerId: response.result.partnerId || null,
        partnerCommissionBpsOverride: response.result.partnerCommissionBpsOverride ?? null,
      };
      setCouponStatus(`Kupon zastosowany. Zniżka: ${detailMoney(detailCouponState.applied.discountAmount)}`, 'success');
      renderQuotePreview();
      return true;
    } catch (error) {
      console.error('Failed to validate detail modal coupon:', error);
      detailCouponState.applied = null;
      setCouponStatus(normalizeAuthUiError(error, 'Nie udało się zweryfikować kuponu.'), 'error');
      renderQuotePreview();
      return false;
    } finally {
      syncCouponControls();
    }
  };

  const insertWithFallback = async (tableName, payload) => {
    const { supabase } = await import('/js/supabaseClient.js');
    let workingPayload = { ...payload };
    const removedColumns = new Set();
    while (true) {
      const { error } = await supabase.from(tableName).insert([workingPayload]);
      if (!error) return;
      const missingColumn = extractMissingColumn(error);
      if (missingColumn && !removedColumns.has(missingColumn) && Object.prototype.hasOwnProperty.call(workingPayload, missingColumn)) {
        removedColumns.add(missingColumn);
        delete workingPayload[missingColumn];
        continue;
      }
      throw error;
    }
  };

  if (couponInput instanceof HTMLInputElement) {
    couponInput.addEventListener('input', () => {
      const normalized = normalizeDetailCouponCode(couponInput.value);
      if (couponInput.value !== normalized) couponInput.value = normalized;
      const appliedCode = normalizeDetailCouponCode(detailCouponState.applied?.couponCode || '');
      if (appliedCode && normalized !== appliedCode) {
        detailCouponState.applied = null;
        setCouponStatus('', 'info');
      }
      renderQuotePreview();
    });
    couponInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void applyCouponForCurrentForm();
      }
    });
  }
  couponApplyBtn?.addEventListener('click', () => { void applyCouponForCurrentForm(); });
  couponClearBtn?.addEventListener('click', () => {
    clearCouponState({ clearInput: true });
    renderQuotePreview();
  });

  form.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
    if (target.name === 'coupon_code') return;
    if (['trip_date', 'arrival_date', 'departure_date', 'adults', 'children', 'hours', 'days', 'email'].includes(target.name)) {
      invalidateCouponAfterQuoteChange();
    }
    renderQuotePreview();
  });
  renderQuotePreview();

  // wire booking submit
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const msg = qs('#detailBookingMsg');
    const btn = form.querySelector('.booking-submit');
    msg.style.display = 'none';
    btn.disabled = true; btn.textContent = 'Wysyłanie...';
    try{
      const fd = new FormData(form);
      const baseTotal = Number(getBaseTotal() || 0);
      const enteredCoupon = normalizeDetailCouponCode(fd.get('coupon_code'));
      const appliedCouponCode = normalizeDetailCouponCode(detailCouponState.applied?.couponCode || '');
      if (enteredCoupon && enteredCoupon !== appliedCouponCode) {
        const applied = await applyCouponForCurrentForm();
        if (!applied) {
          throw new Error('Zastosuj poprawny kupon albo wyczyść pole kuponu.');
        }
      }
      const coupon = getCouponContext(baseTotal);

      if (form.dataset.type==='trip'){
        const t = vm.raw;
        const payload = {
          trip_id: t.id,
          trip_slug: t.slug,
          customer_name: fd.get('name'),
          customer_email: fd.get('email'),
          customer_phone: fd.get('phone'),
          trip_date: fd.get('trip_date'),
          arrival_date: fd.get('trip_date'), // redundant but matches schema defaults
          departure_date: fd.get('trip_date'),
          num_adults: Number(fd.get('adults')||1),
          num_children: Number(fd.get('children')||0),
          num_hours: Number(fd.get('hours')||1),
          num_days: Number(fd.get('days')||1),
          notes: fd.get('notes'),
          base_price: coupon.baseTotal,
          final_price: coupon.finalTotal,
          total_price: coupon.finalTotal,
          coupon_id: coupon.hasApplied ? (detailCouponState.applied?.couponId || null) : null,
          coupon_code: coupon.hasApplied ? (detailCouponState.applied?.couponCode || coupon.code || null) : null,
          coupon_discount_amount: coupon.hasApplied ? Number(coupon.discount || 0) : 0,
          coupon_partner_id: coupon.hasApplied ? (detailCouponState.applied?.partnerId || null) : null,
          coupon_partner_commission_bps: coupon.hasApplied ? (detailCouponState.applied?.partnerCommissionBpsOverride ?? null) : null,
          status: 'pending'
        };
        await insertWithFallback('trip_bookings', payload);
      } else {
        const h = vm.raw;
        const a = fd.get('arrival_date');
        const d = fd.get('departure_date');
        const toDate = (s)=> new Date(s);
        const nights = Math.max(1, Math.round((toDate(d)-toDate(a)) / (1000*60*60*24)));
        const adults = Number(fd.get('adults')||1);
        const children = Number(fd.get('children')||0);
        const persons = adults+children;
        if (h.max_persons && persons > Number(h.max_persons)) throw new Error(`Maksymalna liczba osób: ${h.max_persons}`);
        const payload = {
          hotel_id: h.id,
          hotel_slug: h.slug,
          customer_name: fd.get('name'),
          customer_email: fd.get('email'),
          customer_phone: fd.get('phone'),
          arrival_date: a,
          departure_date: d,
          num_adults: adults,
          num_children: children,
          nights,
          notes: fd.get('notes'),
          base_price: coupon.baseTotal,
          final_price: coupon.finalTotal,
          total_price: coupon.finalTotal,
          coupon_id: coupon.hasApplied ? (detailCouponState.applied?.couponId || null) : null,
          coupon_code: coupon.hasApplied ? (detailCouponState.applied?.couponCode || coupon.code || null) : null,
          coupon_discount_amount: coupon.hasApplied ? Number(coupon.discount || 0) : 0,
          coupon_partner_id: coupon.hasApplied ? (detailCouponState.applied?.partnerId || null) : null,
          coupon_partner_commission_bps: coupon.hasApplied ? (detailCouponState.applied?.partnerCommissionBpsOverride ?? null) : null,
          status: 'pending'
        };
        await insertWithFallback('hotel_bookings', payload);
      }
      msg.className = 'booking-message success';
      msg.textContent = coupon.hasApplied
        ? `Rezerwacja przyjęta! Cena po kuponie: ${detailMoney(coupon.finalTotal)} (zniżka ${detailMoney(coupon.discount)}).`
        : `Rezerwacja przyjęta! Suma: ${detailMoney(coupon.finalTotal)}.`;
      msg.style.display = 'block';
      form.reset();
      clearCouponState({ clearInput: true });
      renderQuotePreview();
      if (window.dataLayer) window.dataLayer.push({event:'booking_created'});
    }catch(err){
      console.error(err);
      const msg = qs('#detailBookingMsg');
      msg.className = 'booking-message error';
      msg.textContent = normalizeAuthUiError(err, 'Błąd podczas rezerwacji.');
      msg.style.display = 'block';
    }finally{
      const btn = form.querySelector('.booking-submit');
      btn.disabled = false; btn.textContent = form.dataset.type==='trip' ? 'Zarezerwuj' : 'Zarezerwuj nocleg';
    }
  });
}

// Close interactions
window.addEventListener('DOMContentLoaded', ()=>{
  qs('[data-close-detail]')?.addEventListener('click', closeDetailModal);
  qs('#detailModal')?.addEventListener('click', (e)=>{ if (e.target.id==='detailModal') closeDetailModal(); });

  // Delegate clicks from home grids
  const tripGrid = qs('#tripsHomeGrid');
  const hotelGrid = qs('#hotelsHomeGrid');
  if (tripGrid){
    tripGrid.addEventListener('click', (e)=>{
      const a = e.target.closest('a.trip-home-card');
      if (!a) return;
      const hash = (a.getAttribute('href')||'').split('#')[1];
      if (!hash) return;
      e.preventDefault();
      openDetailModal({type:'trip', slug: hash});
    });
  }
  if (hotelGrid){
    hotelGrid.addEventListener('click', (e)=>{
      const a = e.target.closest('a.hotel-home-card');
      if (!a) return;
      const hash = (a.getAttribute('href')||'').split('#')[1];
      if (!hash) return;
      e.preventDefault();
      openDetailModal({type:'hotel', slug: hash});
    });
  }
});

// expose for manual calls if needed
window.openDetailModal = openDetailModal;
window.closeDetailModal = closeDetailModal;
