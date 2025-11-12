// Car Rental Paphos - Dynamic Fleet Loading
import { supabase } from './supabaseClient.js';

let paphosFleet = [];
let pricing = {};

function getPageLocation() {
  const loc = (document.body?.dataset?.carLocation || '').toLowerCase();
  return loc === 'larnaca' ? 'larnaca' : 'paphos';
}

// Load fleet from database (Paphos default, supports Larnaca)
async function loadPaphosFleet() {
  try {
    const pageLocation = getPageLocation();
    console.log(`Loading ${pageLocation} fleet from database...`);

    const { data: cars, error } = await supabase
      .from('car_offers')
      .select('*')
      .eq('location', pageLocation)
      .eq('is_available', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error loading fleet:', error);
      return;
    }

    paphosFleet = cars || [];
    console.log(`Loaded ${paphosFleet.length} cars from ${pageLocation}`);

    // Build pricing object for calculator (tiered for paphos, per-day for larnaca)
    pricing = {};
    paphosFleet.forEach(car => {
      const carModelName = window.getCarName ? window.getCarName(car) : car.car_model;
      if (pageLocation === 'larnaca') {
        const perDay = car.price_per_day || car.price_10plus_days || car.price_7_10days || car.price_4_6days || 35;
        pricing[carModelName] = [perDay * 3, perDay, perDay, perDay];
      } else {
        pricing[carModelName] = [
          car.price_3days || 130,
          car.price_4_6days || 34,
          car.price_7_10days || 32,
          car.price_10plus_days || 30
        ];
      }
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
  const loc = getPageLocation();
  const grid =
    (loc === 'larnaca' ? (document.getElementById('larnacaCarsGrid') || document.getElementById('carRentalGrid')) : null) ||
    document.getElementById('paphosCarsGrid') ||
    document.getElementById('carRentalGrid');
  if (!grid) {
    console.error('Could not find fleet grid element for location', loc);
    return;
  }
  
  if (paphosFleet.length === 0) {
    const cityLabel = getPageLocation() === 'larnaca' ? 'Larnace' : 'Paphos';
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #64748b;"><p>Brak dostępnych samochodów w ${cityLabel}</p></div>`;
    return;
  }

  grid.innerHTML = paphosFleet.map(car => {
    // Get translated features using i18n helper
    const features = window.getCarFeatures ? window.getCarFeatures(car) : (Array.isArray(car.features) ? car.features : []);
    
    // Get current language for translations
    const currentLang = window.getCurrentLanguage ? window.getCurrentLanguage() : 'pl';
    
    // Translate transmission
    const transmission = car.transmission === 'automatic' 
      ? (currentLang === 'en' ? 'Automatic' : currentLang === 'pl' ? 'Automat' : 'Automatic')
      : (currentLang === 'en' ? 'Manual' : currentLang === 'pl' ? 'Manual' : 'Manual');
    
    const seats = car.max_passengers || 5;
    
    // Calculate display price (use 10+ days rate as "from" price)
    const fromPrice = car.price_10plus_days || car.price_per_day || 30;

    // Get translated car model name
    const carModelName = window.getCarName ? window.getCarName(car) : car.car_model;
    
    // Get image or use placeholder
    const imageUrl = car.image_url || 'https://placehold.co/400x250/1e293b/ffffff?text=' + encodeURIComponent(carModelName);

    return `
      <article class="card auto-card">
        ${car.image_url ? `<img src="${escapeHtml(car.image_url)}" alt="${escapeHtml(carModelName)}" class="auto-card-image" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px 8px 0 0;">` : ''}
        <header class="auto-card-header">
          <span class="auto-card-price">Od ${fromPrice}€/dzień</span>
          <div class="auto-card-title">
            <h3>${escapeHtml(carModelName)}<span>${transmission} • ${seats} os. • AC</span></h3>
          </div>
        </header>
        <ul class="auto-card-specs">
          <li>${transmission}</li>
          <li>${seats} ${currentLang === 'en' ? (seats === 1 ? 'seat' : 'seats') : (seats === 1 ? 'osoba' : seats < 5 ? 'osoby' : 'osób')}</li>
          <li>AC</li>
          <li>${car.fuel_type === 'petrol' ? (currentLang === 'en' ? 'Petrol 95' : 'Paliwo 95') : car.fuel_type === 'diesel' ? 'Diesel' : car.fuel_type}</li>
        </ul>
        ${window.getCarDescription ? `<p class="auto-card-note">${escapeHtml(window.getCarDescription(car))}</p>` : (car.description ? `<p class="auto-card-note">${escapeHtml(car.description)}</p>` : '')}
        ${features.length > 0 ? `
          <ul class="auto-card-features" style="font-size: 12px; color: #64748b; margin: 8px 0;">
            ${features.slice(0, 3).map(f => `<li>✓ ${escapeHtml(f)}</li>`).join('')}
          </ul>
        ` : ''}
        <button type="button" class="btn btn-secondary secondary" data-select-car="${escapeHtml(carModelName)}">Zarezerwuj to auto</button>
      </article>
    `;
  }).join('');

  // Attach event listeners to new buttons
  attachCarSelectButtons();
}

// Update calculator select options
function updateCalculatorOptions() {
  const select = document.getElementById('car') || document.getElementById('rentalCarSelect');
  const resSelect = document.getElementById('res_car');
  
  if (paphosFleet.length === 0) return;

  const optionsHTML = paphosFleet.map(car => {
    const currentLang = window.getCurrentLanguage ? window.getCurrentLanguage() : 'pl';
    const transmission = car.transmission === 'automatic' 
      ? (currentLang === 'en' ? 'Automatic' : 'Automat')
      : (currentLang === 'en' ? 'Manual' : 'Manual');
    const seats = car.max_passengers || 5;
    const carModelName = window.getCarName ? window.getCarName(car) : car.car_model;
    const seatsLabel = currentLang === 'en' ? (seats === 1 ? 'seat' : 'seats') : 'os.';
    return `<option value="${escapeHtml(carModelName)}">${escapeHtml(carModelName)} — ${transmission} • ${seats} ${seatsLabel}</option>`;
  }).join('');

  // Update calculator select
  if (select) {
    select.innerHTML = optionsHTML;
  }

  // Update reservation select
  if (resSelect) {
    resSelect.innerHTML = optionsHTML;
  }

  // Populate Larnaca pickup/return location selects if present
  const pickupSelect = document.getElementById('pickupLocation');
  const returnSelect = document.getElementById('returnLocation');
  if (pickupSelect && returnSelect) {
    const locationOptions = [
      { id: 'larnaca', label: 'Larnaka (bez opłaty)', fee: 0 },
      { id: 'nicosia', label: 'Nikozja (+15€)', fee: 15 },
      { id: 'ayia-napa', label: 'Ayia Napa (+15€)', fee: 15 },
      { id: 'protaras', label: 'Protaras (+20€)', fee: 20 },
      { id: 'limassol', label: 'Limassol (+20€)', fee: 20 },
      { id: 'paphos', label: 'Pafos (+40€)', fee: 40 },
    ];
    const locHTML = locationOptions.map(opt => `<option value="${opt.id}">${opt.label}</option>`).join('');
    pickupSelect.innerHTML = locHTML;
    returnSelect.innerHTML = locHTML;
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
    const loc = getPageLocation();
    const lowestPrice = Math.min(
      ...paphosFleet.map(c => (loc === 'larnaca' ? (c.price_per_day || 35) : (c.price_10plus_days || c.price_per_day || 30)))
    );
    const priceEl = document.querySelector('.standalone-hero-stats li:nth-child(2) strong');
    if (priceEl) {
      priceEl.textContent = `${lowestPrice} €`;
    }
  }
}

// Calculate price function (updated)
window.calculatePrice = function() {
  const loc = getPageLocation();
  // Paphos legacy calculator (autopfo.html)
  const pfoCar = document.getElementById('car');
  if (loc === 'paphos' && pfoCar) {
    const car = pfoCar.value;
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
    const days = Math.ceil(hours / 24);
    if (days < 3) { alert("Minimalny czas wynajmu to 3 dni"); return; }

    const carPricing = pricing[car];
    if (!carPricing) { alert("Proszę wybrać auto z listy"); return; }

    let basePrice = 0, dailyRate = 0;
    if (days === 3) basePrice = carPricing[0];
    else if (days >= 4 && days <= 6) { dailyRate = carPricing[1]; basePrice = dailyRate * days; }
    else if (days >= 7 && days <= 10) { dailyRate = carPricing[2]; basePrice = dailyRate * days; }
    else if (days > 10) { dailyRate = carPricing[3]; basePrice = dailyRate * days; }

    let totalPrice = basePrice;
    const airportFeesApplicable = days < 7;
    const pickupFee = (airportPickup && airportFeesApplicable) ? 10 : 0;
    const returnFee = (airportReturn && airportFeesApplicable) ? 10 : 0;
    const insuranceCost = fullInsurance ? 17 * days : 0;

    totalPrice += pickupFee + returnFee + insuranceCost;

    document.getElementById("total_price").innerHTML = "Całkowita cena wynajmu: " + totalPrice + "€";
    if (days === 3) document.getElementById("days_price").innerHTML = "Cena pakietu na 3 dni: " + basePrice + "€";
    else {
      const rateText = dailyRate ? " (" + dailyRate + "€/dzień)" : "";
      document.getElementById("days_price").innerHTML = "Cena za " + days + " dni" + rateText + ": " + basePrice + "€";
    }

    let breakdown = [];
    if (pickupFee > 0) breakdown.push(`Odbiór lotnisko: ${pickupFee}€`);
    if (returnFee > 0) breakdown.push(`Zwrot lotnisko: ${returnFee}€`);
    if (insuranceCost > 0) breakdown.push(`Ubezpieczenie AC: ${insuranceCost}€`);
    if (breakdown.length > 0) {
      document.getElementById("days_price").innerHTML += `<br><small style="color: #64748b;">${breakdown.join(' | ')}</small>`;
    }
    return;
  }

  // Larnaca calculator (car-rental.html)
  const lcaCarSelect = document.getElementById('rentalCarSelect');
  if (!lcaCarSelect) return;

  const car = lcaCarSelect.value;
  const pickupDateStr = document.getElementById('pickupDate').value;
  const returnDateStr = document.getElementById('returnDate').value;
  const pickupTimeStr = document.getElementById('pickupTime').value || '10:00';
  const returnTimeStr = document.getElementById('returnTime').value || '10:00';
  const pickupLoc = document.getElementById('pickupLocation').value;
  const returnLoc = document.getElementById('returnLocation').value;
  const fullInsurance = document.getElementById('fullInsurance')?.checked || false;
  const youngDriver = document.getElementById('youngDriver')?.checked || false;

  const pickupDate = new Date(pickupDateStr + 'T' + pickupTimeStr);
  const returnDate = new Date(returnDateStr + 'T' + returnTimeStr);
  if (isNaN(pickupDate.getTime()) || isNaN(returnDate.getTime())) {
    setCalculatorMessage('Proszę wybrać poprawne daty i godziny.', true);
    return;
  }
  const hours = (returnDate - pickupDate) / 36e5;
  const days = Math.ceil(hours / 24);
  if (days < 3) {
    setCalculatorMessage('Minimalny czas wynajmu to 3 dni', true);
    return;
  }

  const carPricing = pricing[car];
  if (!carPricing) {
    setCalculatorMessage('Proszę wybrać auto z listy', true);
    return;
  }

  let basePrice = 0, dailyRate = 0;
  if (days === 3) basePrice = carPricing[0];
  else if (days >= 4 && days <= 6) { dailyRate = carPricing[1]; basePrice = dailyRate * days; }
  else if (days >= 7 && days <= 10) { dailyRate = carPricing[2]; basePrice = dailyRate * days; }
  else if (days > 10) { dailyRate = carPricing[3]; basePrice = dailyRate * days; }

  const feeFor = (city) => {
    switch (city) {
      case 'nicosia':
      case 'ayia-napa':
        return 15;
      case 'protaras':
      case 'limassol':
        return 20;
      case 'paphos':
        return 40;
      default:
        return 0; // larnaca or unknown
    }
  };

  const pickupFee = feeFor(pickupLoc);
  const returnFee = feeFor(returnLoc);
  const insuranceCost = fullInsurance ? 17 * days : 0;
  const youngDriverCost = youngDriver ? 10 * days : 0;

  const totalPrice = basePrice + pickupFee + returnFee + insuranceCost + youngDriverCost;

  const resultEl = document.getElementById('carRentalResult');
  const breakdownEl = document.getElementById('carRentalBreakdown');
  const messageEl = document.getElementById('carRentalMessage');

  if (resultEl) resultEl.textContent = `Całkowita cena wynajmu: ${totalPrice}€`;

  const parts = [];
  if (days === 3) parts.push(`Pakiet 3 dni: ${basePrice}€`);
  else parts.push(`Cena za ${days} dni${dailyRate ? ` (${dailyRate}€/dzień)` : ''}: ${basePrice}€`);
  if (pickupFee) parts.push(`Odbiór poza Larnaką: ${pickupFee}€`);
  if (returnFee) parts.push(`Zwrot poza Larnaką: ${returnFee}€`);
  if (insuranceCost) parts.push(`Ubezpieczenie AC: ${insuranceCost}€`);
  if (youngDriverCost) parts.push(`Młody kierowca: ${youngDriverCost}€`);
  if (breakdownEl) breakdownEl.innerHTML = parts.map(p => `<div>${p}</div>`).join('');
  if (messageEl) { messageEl.textContent = ''; messageEl.classList.remove('is-error'); }
};

function setCalculatorMessage(text, isError) {
  const messageEl = document.getElementById('carRentalMessage');
  if (!messageEl) return;
  messageEl.textContent = text;
  messageEl.classList.toggle('is-error', !!isError);
}

// Attach car select buttons
function attachCarSelectButtons() {
  document.querySelectorAll('[data-select-car]').forEach((button) => {
    button.addEventListener('click', () => {
      const carName = button.getAttribute('data-select-car');
      const pfoSelect = document.getElementById('car');
      const lcaSelect = document.getElementById('rentalCarSelect');
      if (pfoSelect && carName) {
        pfoSelect.value = carName;
      }
      if (lcaSelect && carName) {
        lcaSelect.value = carName;
      }
      window.calculatePrice();
      const calculatorBlock = document.getElementById('carRentalCalculatorBlock');
      if (calculatorBlock) {
        calculatorBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      (lcaSelect || pfoSelect)?.focus?.({ preventScroll: true });
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
  loadPaphosFleet().then(() => {
    // Wire Larnaca calculator events, if present
    const lcaForm = document.getElementById('carRentalCalculator');
    if (lcaForm) {
      lcaForm.addEventListener('submit', (e) => { e.preventDefault(); window.calculatePrice(); });
      lcaForm.addEventListener('change', () => window.calculatePrice());
      // Initial calculation when data ready
      window.calculatePrice();
    }
  });
});

export { loadPaphosFleet, paphosFleet };
