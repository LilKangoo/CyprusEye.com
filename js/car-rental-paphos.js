// Car Rental Paphos - Dynamic Fleet Loading
import { supabase } from './supabaseClient.js';

let paphosFleet = [];
let pricing = {};

// Load Paphos fleet from database
async function loadPaphosFleet() {
  try {
    console.log('Loading Paphos fleet from database...');

    const { data: cars, error } = await supabase
      .from('car_offers')
      .select('*')
      .eq('location', 'paphos')
      .eq('is_available', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error loading fleet:', error);
      return;
    }

    paphosFleet = cars || [];
    console.log(`Loaded ${paphosFleet.length} cars from Paphos`);

    // Build pricing object for calculator
    pricing = {};
    paphosFleet.forEach(car => {
      pricing[car.car_model] = [
        car.price_3days || 130,
        car.price_4_6days || 34,
        car.price_7_10days || 32,
        car.price_10plus_days || 30
      ];
    });

    // Render fleet
    renderFleet();
    updateCalculatorOptions();
    updateStats();

  } catch (e) {
    console.error('Failed to load fleet:', e);
  }
}

// Render fleet cards
function renderFleet() {
  const grid = document.getElementById('paphosCarsGrid');
  if (!grid) {
    console.error('Could not find #paphosCarsGrid element');
    return;
  }
  
  if (paphosFleet.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #64748b;"><p>Brak dostępnych samochodów w Paphos</p></div>';
    return;
  }

  grid.innerHTML = paphosFleet.map(car => {
    const features = Array.isArray(car.features) ? car.features : [];
    const transmission = car.transmission === 'automatic' ? 'Automat' : 'Manual';
    const seats = car.max_passengers || 5;
    
    // Calculate display price (use 10+ days rate as "from" price)
    const fromPrice = car.price_10plus_days || car.price_per_day || 30;

    // Get image or use placeholder
    const imageUrl = car.image_url || 'https://placehold.co/400x250/1e293b/ffffff?text=' + encodeURIComponent(car.car_model);

    return `
      <article class="card auto-card">
        ${car.image_url ? `<img src="${escapeHtml(car.image_url)}" alt="${escapeHtml(car.car_model)}" class="auto-card-image" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px 8px 0 0;">` : ''}
        <header class="auto-card-header">
          <span class="auto-card-price">Od ${fromPrice}€/dzień</span>
          <div class="auto-card-title">
            <h3>${escapeHtml(car.car_model)}<span>${transmission} • ${seats} os. • AC</span></h3>
          </div>
        </header>
        <ul class="auto-card-specs">
          <li>${transmission}</li>
          <li>${seats} ${seats === 1 ? 'osoba' : seats < 5 ? 'osoby' : 'osób'}</li>
          <li>AC</li>
          <li>${car.fuel_type === 'petrol' ? 'Paliwo 95' : car.fuel_type === 'diesel' ? 'Diesel' : car.fuel_type}</li>
        </ul>
        ${car.description ? `<p class="auto-card-note">${escapeHtml(car.description)}</p>` : ''}
        ${features.length > 0 ? `
          <ul class="auto-card-features" style="font-size: 12px; color: #64748b; margin: 8px 0;">
            ${features.slice(0, 3).map(f => `<li>✓ ${escapeHtml(f)}</li>`).join('')}
          </ul>
        ` : ''}
        <button type="button" class="btn btn-secondary secondary" data-select-car="${escapeHtml(car.car_model)}">Zarezerwuj to auto</button>
      </article>
    `;
  }).join('');

  // Attach event listeners to new buttons
  attachCarSelectButtons();
}

// Update calculator select options
function updateCalculatorOptions() {
  const select = document.getElementById('car');
  const resSelect = document.getElementById('res_car');
  
  if (paphosFleet.length === 0) return;

  const optionsHTML = paphosFleet.map(car => {
    const transmission = car.transmission === 'automatic' ? 'Automat' : 'Manual';
    const seats = car.max_passengers || 5;
    return `<option value="${escapeHtml(car.car_model)}">${escapeHtml(car.car_model)} — ${transmission} • ${seats} os.</option>`;
  }).join('');

  // Update calculator select
  if (select) {
    select.innerHTML = optionsHTML;
  }

  // Update reservation select
  if (resSelect) {
    resSelect.innerHTML = optionsHTML;
  }
}

// Update stats in hero
function updateStats() {
  const carsCount = document.querySelector('.standalone-hero-stats li:first-child strong');
  if (carsCount) {
    carsCount.textContent = paphosFleet.length;
  }

  // Find lowest price
  if (paphosFleet.length > 0) {
    const lowestPrice = Math.min(...paphosFleet.map(c => c.price_10plus_days || c.price_per_day || 30));
    const priceEl = document.querySelector('.standalone-hero-stats li:nth-child(2) strong');
    if (priceEl) {
      priceEl.textContent = `${lowestPrice} €`;
    }
  }
}

// Calculate price function (updated)
window.calculatePrice = function() {
  const car = document.getElementById("car").value;
  const pickupDateStr = document.getElementById("pickup_date").value;
  const returnDateStr = document.getElementById("return_date").value;
  const pickupTimeStr = document.getElementById("pickup_time").value || "10:00";
  const returnTimeStr = document.getElementById("return_time").value || "10:00";
  const airportPickup = document.getElementById("airport_pickup")?.checked || false;
  const airportReturn = document.getElementById("airport_return")?.checked || false;
  const fullInsurance = document.getElementById("full_insurance")?.checked || false;

  const pickupDate = new Date(pickupDateStr + 'T' + pickupTimeStr);
  const returnDate = new Date(returnDateStr + 'T' + returnTimeStr);

  if (isNaN(pickupDate.getTime()) || isNaN(returnDate.getTime())) {
    alert("Proszę wybrać poprawne daty i godziny.");
    return;
  }

  const hours = (returnDate - pickupDate) / 36e5;
  if (hours < 72) { 
    alert("Minimalny czas wynajmu to 3 dni"); 
    return; 
  }
  const days = Math.ceil(hours / 24);

  // Use pricing from database
  const carPricing = pricing[car];
  if (!carPricing) {
    alert("Proszę wybrać auto z listy");
    return;
  }

  let basePrice = 0, dailyRate = 0;

  if (days === 3) {
    basePrice = carPricing[0];
  } else if (days >= 4 && days <= 6) {
    dailyRate = carPricing[1]; 
    basePrice = dailyRate * days;
  } else if (days >= 7 && days <= 10) {
    dailyRate = carPricing[2]; 
    basePrice = dailyRate * days;
  } else if (days > 10) {
    dailyRate = carPricing[3]; 
    basePrice = dailyRate * days;
  }

  let totalPrice = basePrice;

  // Airport fees only if rental < 7 days
  const airportFeesApplicable = days < 7;
  const pickupFee = (airportPickup && airportFeesApplicable) ? 10 : 0;
  const returnFee = (airportReturn && airportFeesApplicable) ? 10 : 0;
  const insuranceCost = fullInsurance ? 17 * days : 0;

  totalPrice += pickupFee + returnFee + insuranceCost;

  document.getElementById("total_price").innerHTML = "Całkowita cena wynajmu: " + totalPrice + "€";
  if (days === 3) {
    document.getElementById("days_price").innerHTML = "Cena pakietu na 3 dni: " + basePrice + "€";
  } else {
    const rateText = dailyRate ? " (" + dailyRate + "€/dzień)" : "";
    document.getElementById("days_price").innerHTML = "Cena za " + days + " dni" + rateText + ": " + basePrice + "€";
  }

  // Show fee breakdown
  let breakdown = [];
  if (pickupFee > 0) breakdown.push(`Odbiór lotnisko: ${pickupFee}€`);
  if (returnFee > 0) breakdown.push(`Zwrot lotnisko: ${returnFee}€`);
  if (insuranceCost > 0) breakdown.push(`Ubezpieczenie AC: ${insuranceCost}€`);
  if (breakdown.length > 0) {
    document.getElementById("days_price").innerHTML += `<br><small style="color: #64748b;">${breakdown.join(' | ')}</small>`;
  }
};

// Attach car select buttons
function attachCarSelectButtons() {
  document.querySelectorAll('[data-select-car]').forEach((button) => {
    button.addEventListener('click', () => {
      const carName = button.getAttribute('data-select-car');
      const carSelect = document.getElementById('car');
      if (carSelect && carName) {
        carSelect.value = carName;
        window.calculatePrice();
        carSelect.focus({ preventScroll: true });
      }

      const calculatorBlock = document.getElementById('carRentalCalculatorBlock');
      if (calculatorBlock) {
        calculatorBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

// Escape HTML to prevent XSS
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadPaphosFleet();
});

export { loadPaphosFleet, paphosFleet };
