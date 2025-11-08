// Home page trips section loader
// Loads and displays trips from Supabase on the main page

let homeTripsData = [];
let homeTripsCurrentCity = 'all';

// Load trips from Supabase (exactly like trips.html)
async function loadHomeTrips() {
  try {
    // Import Supabase client (same as trips.html)
    const { supabase } = await import('/js/supabaseClient.js');
    
    if (!supabase) {
      throw new Error('Supabase client not available');
    }

    // Fetch published trips (same as trips.html)
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    homeTripsData = data || [];
    console.log('✅ Loaded trips:', homeTripsData.length, homeTripsData);
    renderHomeTrips();

  } catch (err) {
    console.error('❌ Failed to load trips:', err);
    document.getElementById('tripsHomeGrid').innerHTML = '<p style="text-align:center;color:#ef4444;">Błąd ładowania wycieczek</p>';
  }
}

// Render trips grid
function renderHomeTrips() {
  const grid = document.getElementById('tripsHomeGrid');
  if (!grid) return;

  let filteredTrips = homeTripsData;

  // Filter by city if not 'all' (same logic as trips.html)
  if (homeTripsCurrentCity !== 'all') {
    filteredTrips = homeTripsData.filter(trip => 
      trip.start_city === homeTripsCurrentCity || 
      trip.start_city === 'All Cities'  // Include "All Cities" trips in every category
    );
  }

  // Limit to 6 trips on home page
  const displayTrips = filteredTrips.slice(0, 6);
  
  console.log('Current city:', homeTripsCurrentCity);
  console.log('Filtered trips:', filteredTrips.length);
  console.log('Display trips:', displayTrips.length);

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
    
    // Get title (support multilingual or slug)
    const title = trip.title?.pl || trip.title?.en || trip.title || trip.slug || 'Wycieczka';
    
    // Get price based on pricing model (same as trips.html)
    const pricingModel = trip.pricing_model || 'per_person';
    let priceLabel = '';
    
    if (pricingModel === 'per_person' && trip.price_per_person) {
      priceLabel = `${Number(trip.price_per_person).toFixed(2)} €`;
    } else if (trip.price_base) {
      priceLabel = `${Number(trip.price_base).toFixed(2)} €`;
    } else if (trip.hourly_rate) {
      priceLabel = `${Number(trip.hourly_rate).toFixed(2)} € / godz.`;
    } else if (trip.daily_rate) {
      priceLabel = `${Number(trip.daily_rate).toFixed(2)} € / dzień`;
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
          alt="${title}"
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
          ">${title}</h3>
          <p style="
            margin: 0;
            font-size: 0.85rem;
            opacity: 0.95;
          ">${trip.start_city || ''} ${priceLabel ? '• ' + priceLabel : ''}</p>
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
      console.log('Filtering by city:', city);
      renderHomeTrips();
    });
  });
}

// Initialize when DOM is ready (exactly like trips.html)
document.addEventListener('DOMContentLoaded', function() {
  loadHomeTrips();
  initHomeTripsTabs();
});
