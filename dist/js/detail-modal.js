// Shared Detail Modal for Trips and Hotels
// Minimal, modern, accessible; writes bookings into Supabase admin tables

let detailModalOpen = false;
let lastFocusedEl = null;

function qs(sel, root=document) { return root.querySelector(sel); }
function qsa(sel, root=document) { return Array.from(root.querySelectorAll(sel)); }

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
    body.innerHTML = `<div style="padding:1rem;color:#dc2626;">${err.message||'Nie udało się wczytać danych.'}</div>`;
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
  const rules = h.pricing_tiers?.rules || [];
  if (!rules.length) return 0;
  // pick rule for persons if available else min
  let candidate = null;
  let min = Infinity;
  rules.forEach(r=>{
    const rp = Number(r.price_per_night);
    if (!isFinite(rp)) return;
    if (Number(r.persons)===persons) candidate = rp;
    if (rp < min) min = rp;
  });
  const price = candidate ?? min;
  return (isFinite(price)? price: 0) * nights;
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
        <p class="booking-message" id="detailBookingMsg"></p>
        <button class="btn btn-primary primary booking-submit" type="submit">Zarezerwuj nocleg</button>
      </form>`;
  }

  body.innerHTML = commonTop + booking;

  // header title
  const titleEl = qs('#detailModalTitle');
  titleEl.textContent = vm.title;

  // wire booking submit
  const form = qs('#detailBookingForm');
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const msg = qs('#detailBookingMsg');
    const btn = form.querySelector('.booking-submit');
    btn.disabled = true; btn.textContent = 'Wysyłanie...';
    try{
      const fd = new FormData(form);
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
          total_price: calcTripTotal(t, {
            adults: Number(fd.get('adults')||1),
            children: Number(fd.get('children')||0),
            hours: Number(fd.get('hours')||1),
            days: Number(fd.get('days')||1)
          }),
          status: 'pending'
        };
        const { supabase } = await import('/js/supabaseClient.js');
        const { error } = await supabase.from('trip_bookings').insert([payload]);
        if (error) throw error;
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
          total_price: calcHotelTotal(h, persons, nights),
          status: 'pending'
        };
        const { supabase } = await import('/js/supabaseClient.js');
        const { error } = await supabase.from('hotel_bookings').insert([payload]);
        if (error) throw error;
      }
      msg.className = 'booking-message success';
      msg.textContent = 'Rezerwacja przyjęta! Skontaktujemy się wkrótce.';
      msg.style.display = 'block';
      form.reset();
      if (window.dataLayer) window.dataLayer.push({event:'booking_created'});
    }catch(err){
      console.error(err);
      const msg = qs('#detailBookingMsg');
      msg.className = 'booking-message error';
      msg.textContent = err.message || 'Błąd podczas rezerwacji.';
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
