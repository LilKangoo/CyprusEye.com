// Home page hotels section loader
// Loads and displays hotels from Supabase on the main page (mirrors trips home panel)

let homeHotelsData = [];
let homeHotelsCurrentCity = 'all';
let homeHotelsDisplay = [];
let homeCurrentHotel = null;
let homeHotelIndex = null;

async function loadHomeHotels(){
  try{
    const { supabase } = await import('/js/supabaseClient.js');
    if(!supabase) throw new Error('Supabase client not available');

    const { data, error } = await supabase
      .from('hotels')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false });
    if(error) throw error;
    homeHotelsData = data || [];
    renderHomeHotelsTabs();
    renderHomeHotels();
  }catch(err){
    console.error('❌ Failed to load hotels:', err);
    const grid = document.getElementById('hotelsHomeGrid');
    if(grid){ grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:#ef4444;">Błąd ładowania hoteli</div>'; }
  }
}

function getHotelCities(){
  const s = new Set();
  homeHotelsData.forEach(h=>{ if(h.city) s.add(h.city); });
  return Array.from(s).sort();
}

function renderHomeHotelsTabs(){
  const tabsWrap = document.getElementById('hotelsHomeTabs');
  if(!tabsWrap) return;
  const tabs = ['<button class="hotels-home-tab active" data-city="all" style="padding:8px 16px;background:#10b981;color:white;border:none;border-radius:20px;font-weight:600;cursor:pointer;white-space:nowrap;transition:.2s;">Wszystkie miasta</button>'];
  getHotelCities().forEach(c=>{
    tabs.push(`<button class="hotels-home-tab" data-city="${c}" style="padding:8px 16px;background:#f3f4f6;color:#374151;border:none;border-radius:20px;font-weight:600;cursor:pointer;white-space:nowrap;transition:.2s;">${c}</button>`);
  });
  tabsWrap.innerHTML = tabs.join('');
  initHomeHotelsTabs();
}

function renderHomeHotels(){
  const grid = document.getElementById('hotelsHomeGrid');
  if(!grid) return;
  let list = homeHotelsData;
  if(homeHotelsCurrentCity !== 'all'){
    list = homeHotelsData.filter(h=>h.city===homeHotelsCurrentCity);
  }
  const display = list.slice(0,6);
  homeHotelsDisplay = display;
  if(!display.length){
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:#9ca3af;">Brak hoteli w tym mieście</div>';
    return;
  }
  grid.innerHTML = display.map((h, index)=>{
    const image = h.cover_image_url || (Array.isArray(h.photos)&&h.photos[0]) || '/assets/cyprus_logo-1000x1054.png';
    const title = h.title?.pl || h.title?.en || h.slug || 'Hotel';
    let price = '';
    const tiers = h.pricing_tiers?.rules || [];
    if(tiers.length){
      const for2 = tiers.find(r=>Number(r.persons)===2 && r.price_per_night!=null);
      const p = for2? Number(for2.price_per_night): Math.min(...tiers.map(r=>Number(r.price_per_night||Infinity)));
      if(isFinite(p)) price = `${p.toFixed(2)} € / noc`;
    }
    return `
      <a href="#" onclick="openHotelModalHome(${index}); return false;" class="hotel-home-card" style="position:relative;height:200px;border-radius:12px;overflow:hidden;cursor:pointer;transition:transform .3s,box-shadow .3s;box-shadow:0 4px 6px rgba(0,0,0,.1);text-decoration:none;display:block;"
         onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 12px rgba(0,0,0,0.15)'"
         onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px rgba(0,0,0,0.1)'">
        <img src="${image}" alt="${title}" style="width:100%;height:100%;object-fit:cover;" onerror="this.src='/assets/cyprus_logo-1000x1054.png'" />
        <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top,rgba(0,0,0,.9) 0%, rgba(0,0,0,.6) 70%, transparent 100%);padding:16px;color:white;">
          <h3 style="margin:0 0 4px;font-size:1.1rem;font-weight:700;line-height:1.3;">${title}</h3>
          <p style="margin:0;font-size:.85rem;opacity:.98;color:#ffffff;text-shadow:0 1px 2px rgba(0,0,0,.35);">${h.city||''} ${price? '• '+price: ''}</p>
        </div>
      </a>
    `;
  }).join('');
}

function initHomeHotelsTabs(){
  const tabs = document.querySelectorAll('.hotels-home-tab');
  tabs.forEach(tab=>{
    tab.addEventListener('click', function(){
      const city = this.getAttribute('data-city');
      tabs.forEach(t=>{ t.classList.remove('active'); t.style.background='#f3f4f6'; t.style.color='#374151'; });
      this.classList.add('active');
      this.style.background = '#10b981';
      this.style.color = 'white';
      homeHotelsCurrentCity = city;
      renderHomeHotels();
    });
  });
}

// init
document.addEventListener('DOMContentLoaded', ()=>{
  loadHomeHotels();
  // init carousel arrows for hotels
  const prev = document.querySelector('.home-carousel-container .home-carousel-nav.prev[data-target="#hotelsHomeGrid"]');
  const next = document.querySelector('.home-carousel-container .home-carousel-nav.next[data-target="#hotelsHomeGrid"]');
  const grid = document.getElementById('hotelsHomeGrid');
  const scrollBy = () => Math.round(grid.clientWidth * 0.85);
  const updateArrows = () => {
    if (!prev || !next || !grid) return;
    const maxScroll = grid.scrollWidth - grid.clientWidth - 1;
    const atStart = grid.scrollLeft <= 1;
    const atEnd = grid.scrollLeft >= maxScroll;
    prev.hidden = atStart;
    next.hidden = atEnd;
    const noOverflow = grid.scrollWidth <= grid.clientWidth + 1;
    if (noOverflow) { prev.hidden = true; next.hidden = true; }
  };
  if (prev && grid) prev.addEventListener('click', () => { grid.scrollBy({left: -scrollBy(), behavior: 'smooth'}); setTimeout(updateArrows, 350); });
  if (next && grid) next.addEventListener('click', () => { grid.scrollBy({left: scrollBy(), behavior: 'smooth'}); setTimeout(updateArrows, 350); });
  if (grid) grid.addEventListener('scroll', updateArrows, { passive: true });
  window.addEventListener('resize', updateArrows);
  updateArrows();

  // Backdrop close
  const modal = document.getElementById('hotelModal');
  if (modal) modal.addEventListener('click', (e)=>{ if (e.target === modal) closeHotelModal(); });

  // Form submit (1:1 with /hotels.html)
  const form = document.getElementById('hotelBookingForm');
  if (form) form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const msg = document.getElementById('hotelBookingMessage');
    const btn = e.target.querySelector('.booking-submit');
    try{
      if(!homeCurrentHotel) throw new Error('Brak oferty');
      btn.disabled=true; btn.textContent='Wysyłanie...';
      const fd = new FormData(e.target);
      const a = fd.get('arrival_date');
      const d = fd.get('departure_date');
      const nights = nightsBetween(a,d);
      const adults = Number(fd.get('adults')||0);
      const children = Number(fd.get('children')||0);
      const persons = adults + children;
      const maxPersons = Number(homeCurrentHotel.max_persons||0) || null;
      if (maxPersons && persons > maxPersons) {
        throw new Error(`Maksymalna liczba osób: ${maxPersons}`);
      }
      const total = calculateHotelPrice(homeCurrentHotel, persons, nights);
      const payload = {
        hotel_id: homeCurrentHotel.id,
        hotel_slug: homeCurrentHotel.slug,
        customer_name: fd.get('name'),
        customer_email: fd.get('email'),
        customer_phone: fd.get('phone'),
        arrival_date: a,
        departure_date: d,
        num_adults: adults,
        num_children: children,
        nights,
        notes: fd.get('notes'),
        total_price: total,
        status: 'pending'
      };
      const { data, error } = await window.supabase.from('hotel_bookings').insert([payload]).select().single();
      if(error) throw error;
      msg.className='booking-message success';
      msg.textContent='Rezerwacja przyjęta! Skontaktujemy się wkrótce.';
      msg.style.display='block';
      e.target.reset();
      updateHotelLivePrice();
    }catch(err){
      console.error(err);
      msg.className='booking-message error';
      msg.textContent= err.message || 'Błąd podczas rezerwacji.';
      msg.style.display='block';
    }finally{
      btn.disabled=false; btn.textContent='Zarezerwuj';
    }
  });

  // Nav arrows
  const prevBtn = document.getElementById('hotelModalPrev');
  const nextBtn = document.getElementById('hotelModalNext');
  if (prevBtn) prevBtn.addEventListener('click', ()=>{ if (homeHotelIndex==null) return; const i=Math.max(0, homeHotelIndex-1); openHotelModalHome(i); });
  if (nextBtn) nextBtn.addEventListener('click', ()=>{ if (homeHotelIndex==null) return; const i=Math.min(homeHotelsDisplay.length-1, homeHotelIndex+1); openHotelModalHome(i); });

  // Lightbox controls
  const lb = document.getElementById('imgLightbox');
  const lbClose = document.getElementById('lbClose');
  const lbPrev = document.getElementById('lbPrev');
  const lbNext = document.getElementById('lbNext');
  if (lbClose) lbClose.addEventListener('click', closeHotelLightbox);
  if (lbPrev) lbPrev.addEventListener('click', ()=> showHotelLightbox(lbIndex-1));
  if (lbNext) lbNext.addEventListener('click', ()=> showHotelLightbox(lbIndex+1));
  if (lb) lb.addEventListener('click', (e)=>{ if (e.target === lb) closeHotelLightbox(); });
});

// ----- Modal helpers (1:1 with /hotels) -----
function nightsBetween(a,b){
  if(!a||!b) return 1;
  const da=new Date(a), db=new Date(b);
  const diff = Math.round((db - da)/(1000*60*60*24));
  return Math.max(1, diff);
}

function calculateHotelPrice(h, persons, nights){
  const tiers = h.pricing_tiers?.rules || [];
  if(!tiers.length) return 0;
  persons = Number(persons)||1;
  nights = Number(nights)||1;
  let rule = tiers.find(r=>Number(r.persons)===persons);
  if(!rule){
    const lowers = tiers.filter(r=>Number(r.persons)<=persons);
    if(lowers.length) rule = lowers.sort((a,b)=>Number(b.persons)-Number(a.persons))[0];
  }
  if(!rule){
    rule = tiers.sort((a,b)=>Number(a.price_per_night)-Number(b.price_per_night))[0];
  }
  const minN = Number(rule.min_nights||0);
  const billNights = minN? Math.max(minN, nights): nights;
  return billNights * Number(rule.price_per_night||0);
}

function updateHotelLivePrice(){
  if(!homeCurrentHotel) return;
  const modal = document.getElementById('hotelModal');
  const form = modal ? modal.querySelector('#hotelBookingForm') : null;
  if (!form) return;
  const a = (form.querySelector('#arrivalDate')||{}).value || '';
  const d = (form.querySelector('#departureDate')||{}).value || '';
  const adults = Number((form.querySelector('#bookingAdults')||{}).value||0);
  const children = Number((form.querySelector('#bookingChildren')||{}).value||0);
  const persons = adults + children;
  const maxPersons = Number(homeCurrentHotel.max_persons||0) || null;
  const nights = nightsBetween(a,d);
  let limitedPersons = persons;
  const note = modal ? modal.querySelector('#hotelPriceNote') : null;
  let notes = [];
  if (maxPersons && persons > maxPersons) {
    limitedPersons = maxPersons;
    notes.push(`Limit osób dla tego obiektu to ${maxPersons}. Cena policzona dla ${maxPersons} os.`);
  }
  const price = calculateHotelPrice(homeCurrentHotel, limitedPersons, nights);
  const priceEl = modal ? modal.querySelector('#modalHotelPrice') : null;
  if (priceEl) priceEl.textContent = `${price.toFixed(2)} €`;
  const tiers = homeCurrentHotel.pricing_tiers?.rules||[];
  const match = tiers.find(r=>Number(r.persons)===limitedPersons);
  if(match && match.min_nights && nights < Number(match.min_nights)){
    notes.push(`Minimalna liczba nocy dla ${limitedPersons} os. to ${match.min_nights}. Cena naliczona za ${match.min_nights} nocy.`);
  }
  if (note){ if (notes.length){ note.style.display='block'; note.className='booking-message'; note.textContent = notes.join(' ');} else { note.style.display='none'; } }
}

window.openHotelModalHome = function(index){
  const h = homeHotelsDisplay[index];
  if(!h) return;
  homeCurrentHotel = h; homeHotelIndex = index;
  const title = h.title?.pl || h.title?.en || h.slug;
  const image = h.cover_image_url || (Array.isArray(h.photos)&&h.photos[0]) || '/assets/cyprus_logo-1000x1054.png';
  const imgEl = document.getElementById('modalHotelImage');
  imgEl.src = image;
  imgEl.onclick = () => openHotelLightbox();
  const thumbsWrap = document.getElementById('modalHotelThumbs');
  const photos = Array.isArray(h.photos)? h.photos: [];
  thumbsWrap.innerHTML = photos.map((u,i)=>`<img src="${u}" alt="miniatura" class="${i===0?'active':''}" data-src="${u}" />`).join('');
  thumbsWrap.querySelectorAll('img').forEach(el=>{
    el.addEventListener('click', ()=>{
      thumbsWrap.querySelectorAll('img').forEach(t=>t.classList.remove('active'));
      el.classList.add('active');
      imgEl.src = el.dataset.src;
    });
    el.ondblclick = ()=> openHotelLightbox();
  });
  document.getElementById('modalHotelTitle').textContent = title;
  document.getElementById('modalHotelSubtitle').textContent = h.city || '';
  document.getElementById('modalHotelDescription').innerHTML = (h.description?.pl||'').replace(/\n/g,'<br/>');

  const form = document.getElementById('hotelBookingForm');
  if (form){ form.reset(); const msg=document.getElementById('hotelBookingMessage'); if(msg) msg.style.display='none'; }
  // max persons
  const maxPersons = Number(h.max_persons||0) || null;
  const adultsEl = document.getElementById('bookingAdults');
  const childrenEl = document.getElementById('bookingChildren');
  if (maxPersons){ adultsEl.max = String(maxPersons); childrenEl.max = String(Math.max(0, maxPersons-1)); }
  else { adultsEl.removeAttribute('max'); childrenEl.removeAttribute('max'); }

  // bind price updates
  ['arrivalDate','departureDate','bookingAdults','bookingChildren'].forEach(id=>{
    const old = document.getElementById(id);
    if (!old) return;
    const clone = old.cloneNode(true);
    old.parentNode.replaceChild(clone, old);
    clone.addEventListener(id==='arrivalDate'||id==='departureDate'? 'change':'input', updateHotelLivePrice);
  });
  updateHotelLivePrice();

  const modalEl = document.getElementById('hotelModal');
  if (modalEl){ modalEl.hidden=false; modalEl.classList.add('active'); document.body.style.overflow='hidden'; }
  updateHotelModalArrows();
}

window.closeHotelModal = function(){
  const modalEl = document.getElementById('hotelModal');
  if (modalEl){ modalEl.classList.remove('active'); modalEl.hidden=true; document.body.style.overflow=''; }
  homeCurrentHotel = null; homeHotelIndex = null;
}

// Lightbox (gallery)
let lbIndex = 0;
function getHotelPhotos(){ return Array.isArray(homeCurrentHotel?.photos)? homeCurrentHotel.photos: []; }
function currentHotelPhotoIndex(){ const src=document.getElementById('modalHotelImage').src; const arr=getHotelPhotos(); const i=arr.findIndex(u=>src.includes(u)); return i>=0? i:0; }
function showHotelLightbox(i){ const arr=getHotelPhotos(); if(!arr.length) return; lbIndex=(i+arr.length)%arr.length; const img=document.getElementById('lbImg'); if(img) img.src=arr[lbIndex]; }
function openHotelLightbox(i){ const lb=document.getElementById('imgLightbox'); if(!lb) return; lb.hidden=false; lb.classList.add('active'); showHotelLightbox(typeof i==='number'? i: currentHotelPhotoIndex()); document.addEventListener('keydown', onHotelLbKey); }
function closeHotelLightbox(){ const lb=document.getElementById('imgLightbox'); if(!lb) return; lb.classList.remove('active'); lb.hidden=true; document.removeEventListener('keydown', onHotelLbKey); }
function onHotelLbKey(e){ if(e.key==='Escape') return closeHotelLightbox(); if(e.key==='ArrowRight') return showHotelLightbox(lbIndex+1); if(e.key==='ArrowLeft') return showHotelLightbox(lbIndex-1); }
window.openHotelLightbox = openHotelLightbox;
window.closeHotelLightbox = closeHotelLightbox;

function updateHotelModalArrows(){
  const prevBtn = document.getElementById('hotelModalPrev');
  const nextBtn = document.getElementById('hotelModalNext');
  if (!prevBtn || !nextBtn) return;
  const total = homeHotelsDisplay.length;
  const i = homeHotelIndex ?? 0;
  prevBtn.disabled = (i <= 0);
  nextBtn.disabled = (i >= total - 1);
}
