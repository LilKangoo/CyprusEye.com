// Home page hotels section loader
// Loads and displays hotels from Supabase on the main page (mirrors trips home panel)

let homeHotelsData = [];
let homeHotelsCurrentCity = 'all';

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
  if(!display.length){
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:#9ca3af;">Brak hoteli w tym mieście</div>';
    return;
  }
  grid.innerHTML = display.map(h=>{
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
      <a href="hotels.html#${h.slug}" class="hotel-home-card" style="position:relative;height:200px;border-radius:12px;overflow:hidden;cursor:pointer;transition:transform .3s,box-shadow .3s;box-shadow:0 4px 6px rgba(0,0,0,.1);text-decoration:none;display:block;"
         onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 12px rgba(0,0,0,0.15)'"
         onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px rgba(0,0,0,0.1)'">
        <img src="${image}" alt="${title}" style="width:100%;height:100%;object-fit:cover;" onerror="this.src='/assets/cyprus_logo-1000x1054.png'" />
        <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top,rgba(0,0,0,.9) 0%, rgba(0,0,0,.6) 70%, transparent 100%);padding:16px;color:white;">
          <h3 style="margin:0 0 4px;font-size:1.1rem;font-weight:700;line-height:1.3;">${title}</h3>
          <p style="margin:0;font-size:.85rem;opacity:.95;">${h.city||''} ${price? '• '+price: ''}</p>
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
});
