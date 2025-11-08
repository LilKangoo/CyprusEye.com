// Home page trips section loader
// Loads and displays trips from Supabase on the main page

let homeTripsData = [];
let homeTripsCurrentCity = 'all';

// Load trips from Supabase
async function loadHomeTrips() {
  try {
    const client = window.getSupabaseClient?.();
    if (!client) {
      console.log('Supabase client not ready, will retry...');
      setTimeout(loadHomeTrips, 500);
      return;
    }

    const { data: trips, error } = await client
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error loading trips:', error);
      document.getElementById('tripsHomeGrid').innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: #ef4444;">
          Błąd ładowania wycieczek
        </div>
      `;
      return;
    }

    homeTripsData = trips || [];
    renderHomeTrips();

  } catch (error) {
    console.error('Failed to load trips:', error);
  }
}

// Render trips grid
function renderHomeTrips() {
  const grid = document.getElementById('tripsHomeGrid');
  if (!grid) return;

  let filteredTrips = homeTripsData;

  // Filter by city if not 'all'
  if (homeTripsCurrentCity !== 'all') {
    filteredTrips = homeTripsData.filter(trip => 
      trip.start_city === homeTripsCurrentCity || 
      (trip.start_city === 'All Cities' && homeTripsCurrentCity === 'all')
    );
  }

  // Limit to 6 trips on home page
  const displayTrips = filteredTrips.slice(0, 6);

  if (displayTrips.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: #9ca3af;">
        Brak wycieczek w tym mieście
      </div>
    `;
    return;
  }

  grid.innerHTML = displayTrips.map(trip => {
    const imageUrl = trip.cover_image_url || '/assets/cyprus_logo-1000x1054.png';
    const price = trip.base_price_per_person || trip.base_price_total || trip.hourly_rate || trip.daily_rate || 0;
    const pricingModel = trip.pricing_model || 'per_person';
    
    let priceLabel = '';
    if (pricingModel === 'per_person') {
      priceLabel = `${price.toFixed(2)} € / os.`;
    } else if (pricingModel === 'base_plus_extra') {
      priceLabel = `od ${trip.base_price_total?.toFixed(2) || 0} €`;
    } else if (pricingModel === 'per_hour') {
      priceLabel = `${trip.hourly_rate?.toFixed(2) || 0} € / godz.`;
    } else if (pricingModel === 'per_day') {
      priceLabel = `${trip.daily_rate?.toFixed(2) || 0} € / dzień`;
    }

    return `
      <a 
        href="trips.html#${trip.slug}" 
        class="trip-home-card"
        style="
          position: relative;
          height: 200px;
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          transition: transform 0.3s, box-shadow 0.3s;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          text-decoration: none;
          display: block;
        "
        onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 12px rgba(0,0,0,0.15)'"
        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px rgba(0,0,0,0.1)'"
      >
        <img 
          src="${imageUrl}" 
          alt="${trip.title || 'Trip'}"
          style="
            width: 100%;
            height: 100%;
            object-fit: cover;
          "
          onerror="this.src='/assets/cyprus_logo-1000x1054.png'"
        />
        <div style="
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 70%, transparent 100%);
          padding: 16px;
          color: white;
        ">
          <h3 style="
            margin: 0 0 4px;
            font-size: 1.1rem;
            font-weight: 700;
            line-height: 1.3;
          ">${trip.title || 'Wycieczka'}</h3>
          <p style="
            margin: 0;
            font-size: 0.85rem;
            opacity: 0.95;
          ">${trip.start_city || ''} · ${priceLabel}</p>
        </div>
      </a>
    `;
  }).join('');
}

// Handle city tab clicks
function initHomeTripsTabs() {
  const tabs = document.querySelectorAll('.trips-home-tab');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', function() {
      const city = this.getAttribute('data-city');
      
      // Update active state
      tabs.forEach(t => {
        t.classList.remove('active');
        t.style.background = '#f3f4f6';
        t.style.color = '#374151';
      });
      this.classList.add('active');
      this.style.background = '#667eea';
      this.style.color = 'white';
      
      // Update current city and re-render
      homeTripsCurrentCity = city;
      renderHomeTrips();
    });
  });
}

// Initialize when DOM is ready and Supabase client is available
document.addEventListener('DOMContentLoaded', function() {
  // Wait a bit for Supabase client to be ready
  setTimeout(() => {
    loadHomeTrips();
    initHomeTripsTabs();
  }, 1000);
});

// Also try to load when Supabase client signals ready
if (window.addEventListener) {
  window.addEventListener('supabase-ready', function() {
    loadHomeTrips();
  });
}
