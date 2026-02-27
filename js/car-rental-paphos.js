// Car Rental Paphos - Dynamic Fleet Loading
import { supabase } from './supabaseClient.js';
import { calculateCarRentalQuote } from './car-pricing.js';

let paphosFleet = [];
let pricing = {};

function getI18nLanguage() {
  const fromApp = (window.appI18n?.language || '').toLowerCase();
  if (fromApp) return fromApp;
  const fromGlobal = (typeof window.getCurrentLanguage === 'function' ? window.getCurrentLanguage() : '').toLowerCase();
  return fromGlobal || 'pl';
}

function getI18nTranslations() {
  const lang = getI18nLanguage();
  const pack = window.appI18n?.translations?.[lang];
  return pack && typeof pack === 'object' ? pack : {};
}

function getI18nEntry(translations, key) {
  if (!key || !translations) return null;
  if (Object.prototype.hasOwnProperty.call(translations, key)) {
    return translations[key];
  }
  if (key.indexOf('.') === -1) return null;
  const parts = key.split('.');
  let current = translations;
  for (const part of parts) {
    if (current && typeof current === 'object' && Object.prototype.hasOwnProperty.call(current, part)) {
      current = current[part];
    } else {
      return null;
    }
  }
  return current;
}

function getI18nString(key) {
  const translations = getI18nTranslations();
  const entry = getI18nEntry(translations, key);
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry === 'object') {
    if (typeof entry.text === 'string') return entry.text;
    if (typeof entry.html === 'string') return entry.html;
  }
  return null;
}

function applyReplacements(template, replacements) {
  if (!template || !replacements) return template;
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, token) => {
    if (!Object.prototype.hasOwnProperty.call(replacements, token)) return '';
    return String(replacements[token]);
  });
}

function i18n(key, replacements, fallback = '') {
  const template = getI18nString(key);
  const base = typeof template === 'string' ? template : fallback;
  return applyReplacements(base, replacements);
}

function getPageLocation() {
  const loc = (document.body?.dataset?.carLocation || '').toLowerCase();
  return loc === 'larnaca' ? 'larnaca' : 'paphos';
}

function isLandingCarRentalPage() {
  return String(document.body?.dataset?.seoPage || '').toLowerCase() === 'carrentallanding';
}

function calculateQuoteForSelection({
  offer,
  carModel,
  pickupDateStr,
  returnDateStr,
  pickupTimeStr = '10:00',
  returnTimeStr = '10:00',
  pickupLocation = '',
  returnLocation = '',
  fullInsurance = false,
  youngDriver = false,
}) {
  const selectedCar = String(carModel || '').trim();
  const carPricing = selectedCar ? pricing[selectedCar] : null;
  return calculateCarRentalQuote({
    pricingMatrix: carPricing,
    offer,
    carModel: selectedCar,
    pickupDateStr,
    returnDateStr,
    pickupTimeStr,
    returnTimeStr,
    pickupLocation,
    returnLocation,
    fullInsurance,
    youngDriver,
  });
}

function shortLocationLabel(locationValue) {
  if (locationValue === 'airport_pfo') {
    return i18n('carRental.locations.paphos-airport.short', null, 'Paphos Airport');
  }
  if (locationValue === 'city_center') {
    return i18n('carRental.page.reservation.fields.pickupLocation.city', null, 'Centrum miasta');
  }
  if (locationValue === 'hotel') {
    return i18n('carRental.page.reservation.fields.pickupLocation.hotel', null, 'Hotel');
  }
  if (locationValue === 'other') {
    return i18n('carRental.page.reservation.fields.other', null, 'Inne');
  }
  return i18n(`carRental.locations.${locationValue}.short`, null, locationValue || '');
}

function parsePassengerCount(value, fallback = 1) {
  const normalizedFallback = Number.isFinite(Number(fallback)) && Number(fallback) > 0
    ? Math.floor(Number(fallback))
    : 1;
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed < 1) return normalizedFallback;
  return parsed;
}

function getRequiredPassengers() {
  const calculatorValue = document.getElementById('rentalPassengers')?.value;
  const reservationValue = document.getElementById('res_passengers')?.value;
  return parsePassengerCount(calculatorValue || reservationValue, 1);
}

function getFleetFilteredByPassengers() {
  const requiredPassengers = getRequiredPassengers();
  const filteredFleet = paphosFleet.filter((car) => {
    const capacity = Number(car?.max_passengers || 0);
    if (!Number.isFinite(capacity) || capacity <= 0) return true;
    return capacity >= requiredPassengers;
  });
  return { requiredPassengers, filteredFleet };
}

window.CE_CAR_COMPUTE_QUOTE = calculateQuoteForSelection;
window.CE_CAR_LOAD_FLEET = loadPaphosFleet;

// Load fleet from database (Paphos default, supports Larnaca)
async function loadPaphosFleet() {
  try {
    const pageLocation = getPageLocation();
    console.log(`Loading ${pageLocation} fleet from database...`);

    const requireNorthAllowed = pageLocation === 'larnaca';

    async function fetchFleet(withNorthAllowed) {
      let q = supabase
        .from('car_offers')
        .select('*')
        .eq('location', pageLocation)
        .eq('is_available', true);

      if (withNorthAllowed) {
        q = q.eq('north_allowed', requireNorthAllowed);
      }

      return q.order('sort_order', { ascending: true });
    }

    let { data: cars, error } = await fetchFleet(true);

    if (error) {
      const msg = String(error.message || '');
      const missingNorthAllowed =
        /north_allowed/i.test(msg)
        && (/does not exist/i.test(msg) || /could not find/i.test(msg));

      if (missingNorthAllowed) {
        ({ data: cars, error } = await fetchFleet(false));
      }
    }

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

    window.CE_CAR_PRICING = pricing;
    window.CE_CAR_LOCATION = pageLocation;

    // Render fleet
    renderFleet();
    updateCalculatorOptions();
    updateStats();

  } catch (e) {
    console.error('Failed to load fleet:', e);
  }
}

// Render fleet grid
function renderFleet() {
  const loc = getPageLocation();
  const grid =
    (loc === 'larnaca' ? (document.getElementById('larnacaCarsGrid') || document.getElementById('carRentalGrid')) : null) ||
    document.getElementById('paphosCarsGrid') ||
    document.getElementById('carRentalGrid');
  
  console.log('🚗 renderFleet() called - Location:', loc, 'Grid found:', !!grid);
  
  if (!grid) {
    console.error('❌ Could not find fleet grid element for location', loc);
    return;
  }
  
  if (paphosFleet.length === 0) {
    const cityLabel = i18n(`carRental.locations.${loc}.short`, null, loc);
    const message = i18n('carRental.page.fleet.empty', { city: cityLabel }, `Brak dostępnych samochodów: ${cityLabel}`);
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #64748b;"><p>${escapeHtml(message)}</p></div>`;
    return;
  }

  const { requiredPassengers, filteredFleet } = getFleetFilteredByPassengers();
  const isEn = getI18nLanguage().startsWith('en');
  if (filteredFleet.length === 0) {
    const fallbackMessage = isEn
      ? `No cars available for ${requiredPassengers} passengers. Reduce passengers or change route.`
      : `Brak aut dla ${requiredPassengers} pasażerów. Zmniejsz liczbę pasażerów lub zmień trasę.`;
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #64748b;"><p>${escapeHtml(fallbackMessage)}</p></div>`;
    return;
  }

  const landingQuoteContext = isLandingCarRentalPage() && window.CE_CAR_LANDING_QUOTE_CTX && typeof window.CE_CAR_LANDING_QUOTE_CTX === 'object'
    ? window.CE_CAR_LANDING_QUOTE_CTX
    : null;

  grid.innerHTML = filteredFleet.map(car => {
    // Get translated features using i18n helper
    const features = window.getCarFeatures ? window.getCarFeatures(car) : (Array.isArray(car.features) ? car.features : []);

    const transmission = car.transmission === 'automatic'
      ? i18n('carRental.common.transmission.automatic', null, 'Automat')
      : i18n('carRental.common.transmission.manual', null, 'Manual');
    
    const seats = car.max_passengers || 5;
    const seatsText = i18n('carRental.common.seats', { count: seats }, `${seats} miejsc`);
    
    // Calculate display price (use 10+ days rate as "from" price)
    const fromPrice = car.price_10plus_days || car.price_per_day || 30;

    // Get translated car model name
    const carModelName = window.getCarName ? window.getCarName(car) : car.car_model;
    
    // Get image or use placeholder
    const imageUrl = car.image_url || 'https://placehold.co/400x250/1e293b/ffffff?text=' + encodeURIComponent(carModelName);

    let priceLabel = i18n('carRental.common.priceFromPerDay', { price: `${fromPrice}€` }, `Od ${fromPrice}€ / dzień`);
    let priceBreakdown = '';

    if (landingQuoteContext) {
      const quote = calculateQuoteForSelection({
        offer: loc,
        carModel: carModelName,
        pickupDateStr: landingQuoteContext.pickupDate,
        returnDateStr: landingQuoteContext.returnDate,
        pickupTimeStr: landingQuoteContext.pickupTime,
        returnTimeStr: landingQuoteContext.returnTime,
        pickupLocation: landingQuoteContext.pickupLocation,
        returnLocation: landingQuoteContext.returnLocation,
        fullInsurance: !!landingQuoteContext.fullInsurance,
        youngDriver: !!landingQuoteContext.youngDriver,
      });

      if (quote) {
        const extrasTotal = quote.pickupFee + quote.returnFee + quote.insuranceCost + quote.youngDriverCost;
        const daysLabel = i18n('carRental.common.daysLabel', null, isEn ? 'days' : 'dni');
        priceLabel = isEn
          ? `Total ${quote.total.toFixed(2)}€`
          : `Razem ${quote.total.toFixed(2)}€`;
        priceBreakdown = isEn
          ? `${quote.days} ${daysLabel} • base ${quote.basePrice.toFixed(2)}€ • extras ${extrasTotal.toFixed(2)}€`
          : `${quote.days} ${daysLabel} • baza ${quote.basePrice.toFixed(2)}€ • dodatki ${extrasTotal.toFixed(2)}€`;
      }
    }

    const reserveLabel = i18n('carRental.common.reserveCar', null, 'Zarezerwuj to auto');

    const fuelKey = car.fuel_type === 'petrol'
      ? 'carRental.common.fuel.petrol95'
      : car.fuel_type === 'diesel'
        ? 'carRental.common.fuel.diesel'
        : car.fuel_type === 'hybrid'
          ? 'carRental.common.fuel.hybrid'
          : car.fuel_type === 'electric'
            ? 'carRental.common.fuel.electric'
            : '';
    const fuelText = fuelKey ? i18n(fuelKey, null, car.fuel_type) : (car.fuel_type || '');
    
    return `
      <article class="card auto-card">
        ${car.image_url ? `<img src="${escapeHtml(car.image_url)}" alt="${escapeHtml(carModelName)}" class="auto-card-image" data-preview-title="${escapeHtml(carModelName)}" role="button" tabindex="0" aria-label="${escapeHtml(reserveLabel)}" aria-haspopup="dialog" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px 8px 0 0;">` : ''}
        <header class="auto-card-header">
          <span class="auto-card-price">${escapeHtml(priceLabel)}</span>
          <div class="auto-card-title">
            <h3>${escapeHtml(carModelName)}<span>${escapeHtml(transmission)} • ${escapeHtml(seatsText)} • AC</span></h3>
          </div>
        </header>
        <ul class="auto-card-specs">
          <li>${escapeHtml(transmission)}</li>
          <li>${escapeHtml(seatsText)}</li>
          <li>AC</li>
          <li>${escapeHtml(fuelText)}</li>
        </ul>
        ${priceBreakdown ? `<p class="auto-card-note" style="margin-top: 8px;">${escapeHtml(priceBreakdown)}</p>` : ''}
        ${window.getCarDescription ? `<p class="auto-card-note">${escapeHtml(window.getCarDescription(car))}</p>` : (car.description ? `<p class="auto-card-note">${escapeHtml(car.description)}</p>` : '')}
        ${features.length > 0 ? `
          <ul class="auto-card-features" style="font-size: 12px; color: #64748b; margin: 8px 0;">
            ${features.slice(0, 3).map(f => `<li>✓ ${escapeHtml(f)}</li>`).join('')}
          </ul>
        ` : ''}
        <button type="button" class="btn btn-secondary secondary" data-select-car="${escapeHtml(carModelName)}" data-select-car-offer-id="${escapeHtml(car.id)}">${reserveLabel}</button>
      </article>
    `;
  }).join('');

  // Attach event listeners to new buttons
  attachCarSelectButtons();
}

window.CE_CAR_RERENDER_FLEET = renderFleet;
window.CE_CAR_UPDATE_CALC_OPTIONS = updateCalculatorOptions;

// Update calculator select options
function updateCalculatorOptions() {
  const select = document.getElementById('car') || document.getElementById('rentalCarSelect');
  const resSelect = document.getElementById('res_car');
  if (paphosFleet.length === 0) return;

  const { requiredPassengers, filteredFleet } = getFleetFilteredByPassengers();
  const isEn = getI18nLanguage().startsWith('en');
  const previousSelectValue = String(select?.value || '').trim();
  const previousReservationValue = String(resSelect?.value || '').trim();

  if (filteredFleet.length === 0) {
    const noCarsLabel = isEn
      ? `No cars for ${requiredPassengers} passengers`
      : `Brak aut dla ${requiredPassengers} pasażerów`;
    const noCarsOption = `<option value="">${escapeHtml(noCarsLabel)}</option>`;
    if (select) select.innerHTML = noCarsOption;
    if (resSelect) resSelect.innerHTML = noCarsOption;
    return;
  }

  const optionsHTML = filteredFleet.map(car => {
    const transmission = car.transmission === 'automatic'
      ? i18n('carRental.common.transmission.automatic', null, 'Automat')
      : i18n('carRental.common.transmission.manual', null, 'Manual');
    const seats = car.max_passengers || 5;
    const carModelName = window.getCarName ? window.getCarName(car) : car.car_model;
    const seatsText = i18n('carRental.common.seats', { count: seats }, `${seats} miejsc`);
    return `<option value="${escapeHtml(carModelName)}" data-offer-id="${escapeHtml(car.id)}">${escapeHtml(carModelName)} — ${escapeHtml(transmission)} • ${escapeHtml(seatsText)}</option>`;
  }).join('');

  // Update calculator select
  if (select) {
    select.innerHTML = optionsHTML;
    const calcOptions = Array.from(select.options || []);
    const matchedCurrent = calcOptions.find((opt) => opt.value === previousSelectValue);
    if (matchedCurrent) {
      select.value = previousSelectValue;
    } else if (calcOptions.length > 0) {
      select.value = calcOptions[0].value;
    }
  }

  // Update reservation select
  if (resSelect) {
    resSelect.innerHTML = optionsHTML;
    const reservationOptions = Array.from(resSelect.options || []);
    const preferredValue = String(select?.value || previousReservationValue || '').trim();
    const matchedCurrent = reservationOptions.find((opt) => opt.value === preferredValue);
    if (matchedCurrent) {
      resSelect.value = preferredValue;
    } else if (reservationOptions.length > 0) {
      resSelect.value = reservationOptions[0].value;
    }
  }

  // Populate Larnaca pickup/return location selects if present
  const pickupSelect = document.getElementById('pickupLocation');
  const returnSelect = document.getElementById('returnLocation');
  if (pickupSelect && returnSelect && !isLandingCarRentalPage()) {
    const locationOptions = [
      { id: 'larnaca', fee: 0 },
      { id: 'nicosia', fee: 15 },
      { id: 'ayia-napa', fee: 15 },
      { id: 'protaras', fee: 20 },
      { id: 'limassol', fee: 20 },
      { id: 'paphos', fee: 40 },
    ];
    const locHTML = locationOptions
      .map((opt) => {
        const fallback = opt.id === 'larnaca'
          ? 'Larnaka (bez opłaty)'
          : opt.id === 'nicosia'
            ? 'Nikozja (+15€)'
            : opt.id === 'ayia-napa'
              ? 'Ayia Napa (+15€)'
              : opt.id === 'protaras'
                ? 'Protaras (+20€)'
                : opt.id === 'limassol'
                  ? 'Limassol (+20€)'
                  : opt.id === 'paphos'
                    ? 'Pafos (+40€)'
                    : opt.id;
        const label = i18n(`carRental.locations.${opt.id}.label`, null, fallback);
        return `<option value="${escapeHtml(opt.id)}">${escapeHtml(label)}</option>`;
      })
      .join('');
    pickupSelect.innerHTML = locHTML;
    returnSelect.innerHTML = locHTML;
  }
}

// Update stats in hero
function updateStats() {
  if (isLandingCarRentalPage()) {
    return;
  }

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
      alert(i18n('carRental.calculator.errors.invalidDates', null, 'Proszę wybrać poprawne daty i godziny.'));
      return;
    }

    const hours = (returnDate - pickupDate) / 36e5;
    const days = Math.ceil(hours / 24);
    if (days < 3) {
      const daysLabel = i18n('carRental.common.daysLabel', null, 'dni');
      alert(i18n('carRental.calculator.errors.minimumDays', { days: 3, daysLabel }, 'Minimalny czas wynajmu to 3 dni'));
      return;
    }

    const carPricing = pricing[car];
    if (!carPricing) {
      alert(i18n('carRental.calculator.errors.selectCar', null, 'Proszę wybrać auto z listy'));
      return;
    }

    const quote = calculateQuoteForSelection({
      offer: loc,
      carModel: car,
      pickupDateStr,
      returnDateStr,
      pickupTimeStr,
      returnTimeStr,
      pickupLocation: airportPickup ? 'airport_pfo' : '',
      returnLocation: airportReturn ? 'airport_pfo' : '',
      fullInsurance,
      youngDriver: false,
    });
    if (!quote) {
      alert(i18n('carRental.calculator.errors.invalidDates', null, 'Proszę wybrać poprawne daty i godziny.'));
      return;
    }

    const basePrice = quote.basePrice;
    const dailyRate = quote.dailyRate;
    const pickupFee = quote.pickupFee;
    const returnFee = quote.returnFee;
    const insuranceCost = quote.insuranceCost;
    const totalPrice = quote.total;

    window.CE_CAR_PRICE_QUOTE = {
      total: Number(totalPrice.toFixed(2)),
      currency: 'EUR',
      breakdown: {
        location: quote.offer,
        days: quote.days,
        basePrice: quote.basePrice,
        dailyRate: quote.dailyRate,
        pickupFee,
        returnFee,
        insuranceCost,
        youngDriverCost: quote.youngDriverCost,
        car: quote.car,
      },
    };

    const totalEl = document.getElementById('total_price');
    if (totalEl) {
      totalEl.textContent = i18n('carRental.calculator.total', { price: `${totalPrice}€` }, `Całkowita cena wynajmu: ${totalPrice}€`);
    }

    const daysEl = document.getElementById('days_price');
    if (daysEl) {
      const daysLabel = i18n('carRental.common.daysLabel', null, 'dni');
      const rateText = dailyRate
        ? i18n('carRental.common.pricePerDay', { price: `${dailyRate}€` }, `${dailyRate}€/dzień`)
        : '';

      const baseLine = quote.days === 3
        ? i18n('carRental.calculator.breakdown.package3', { total: `${basePrice}€` }, `Pakiet 3 dni: ${basePrice}€`)
        : i18n(
          'carRental.calculator.breakdown.tiered',
          { rate: rateText, days: quote.days, daysLabel, total: `${basePrice}€` },
          `${dailyRate}€ × ${quote.days} ${daysLabel} = ${basePrice}€`
        );

      const breakdownLines = [];

      const airportLabel = i18n('carRental.locations.paphos-airport.short', null, 'Paphos Airport');
      if (pickupFee > 0) {
        breakdownLines.push(
          i18n(
            'carRental.calculator.breakdown.pickupWithFee',
            { location: airportLabel, price: `${pickupFee}€` },
            `Odbiór: ${airportLabel} +${pickupFee}€`
          )
        );
      }
      if (returnFee > 0) {
        breakdownLines.push(
          i18n(
            'carRental.calculator.breakdown.returnWithFee',
            { location: airportLabel, price: `${returnFee}€` },
            `Zwrot: ${airportLabel} +${returnFee}€`
          )
        );
      }
      if (insuranceCost > 0) {
        const insurancePerDay = i18n('carRental.common.pricePerDay', { price: '17€' }, '17€/dzień');
        breakdownLines.push(
          i18n(
            'carRental.calculator.breakdown.fullInsurance',
            { pricePerDay: insurancePerDay, days: quote.days, daysLabel, total: `${insuranceCost}€` },
            `Ubezpieczenie: ${insurancePerDay} × ${quote.days} ${daysLabel} = ${insuranceCost}€`
          )
        );
      }

      if (breakdownLines.length > 0) {
        daysEl.innerHTML = `${escapeHtml(baseLine)}<br><small style="color: #64748b;">${breakdownLines.map(escapeHtml).join(' | ')}</small>`;
      } else {
        daysEl.textContent = baseLine;
      }
    }
    return;
  }

  // Landing calculator (car.html)
  const landingCarSelect = document.getElementById('rentalCarSelect');
  if (isLandingCarRentalPage() && landingCarSelect) {
    const car = landingCarSelect.value;
    const pickupDateStr = document.getElementById('pickupDate')?.value;
    const returnDateStr = document.getElementById('returnDate')?.value;
    const pickupTimeStr = document.getElementById('pickupTime')?.value || '10:00';
    const returnTimeStr = document.getElementById('returnTime')?.value || '10:00';
    const pickupLoc = document.getElementById('pickupLocation')?.value || '';
    const returnLoc = document.getElementById('returnLocation')?.value || '';
    const fullInsurance = document.getElementById('fullInsurance')?.checked || false;
    const youngDriver = document.getElementById('youngDriver')?.checked || false;

    const pickupDate = new Date(`${pickupDateStr || ''}T${pickupTimeStr}`);
    const returnDate = new Date(`${returnDateStr || ''}T${returnTimeStr}`);
    if (Number.isNaN(pickupDate.getTime()) || Number.isNaN(returnDate.getTime())) {
      setCalculatorMessage(i18n('carRental.calculator.errors.invalidDates', null, 'Proszę wybrać poprawne daty i godziny.'), true);
      return;
    }

    const hours = (returnDate.getTime() - pickupDate.getTime()) / 36e5;
    const days = Math.ceil(hours / 24);
    if (!Number.isFinite(days) || hours <= 0 || days < 3) {
      const daysLabel = i18n('carRental.common.daysLabel', null, 'dni');
      setCalculatorMessage(i18n('carRental.calculator.errors.minimumDays', { days: 3, daysLabel }, 'Minimalny czas wynajmu to 3 dni'), true);
      return;
    }

    const carPricing = pricing[car];
    if (!carPricing) {
      setCalculatorMessage(i18n('carRental.calculator.errors.selectCar', null, 'Proszę wybrać auto z listy'), true);
      return;
    }

    const quote = calculateQuoteForSelection({
      offer: loc,
      carModel: car,
      pickupDateStr,
      returnDateStr,
      pickupTimeStr,
      returnTimeStr,
      pickupLocation: pickupLoc,
      returnLocation: returnLoc,
      fullInsurance,
      youngDriver,
    });

    if (!quote) {
      setCalculatorMessage(i18n('carRental.calculator.errors.invalidDates', null, 'Proszę wybrać poprawne daty i godziny.'), true);
      return;
    }

    window.CE_CAR_PRICE_QUOTE = {
      total: quote.total,
      currency: 'EUR',
      breakdown: {
        location: quote.offer,
        days: quote.days,
        basePrice: quote.basePrice,
        dailyRate: quote.dailyRate,
        pickupFee: quote.pickupFee,
        returnFee: quote.returnFee,
        insuranceCost: quote.insuranceCost,
        youngDriverCost: quote.youngDriverCost,
        car: quote.car,
        pickupLoc: quote.pickupLoc,
        returnLoc: quote.returnLoc,
      },
    };

    const resultEl = document.getElementById('carRentalResult');
    const breakdownEl = document.getElementById('carRentalBreakdown');
    const messageEl = document.getElementById('carRentalMessage');

    if (resultEl) {
      resultEl.textContent = i18n('carRental.calculator.total', { price: `${quote.total.toFixed(2)}€` }, `Całkowita cena wynajmu: ${quote.total.toFixed(2)}€`);
    }

    const parts = [];
    const daysLabel = i18n('carRental.common.daysLabel', null, 'dni');
    const rateText = quote.dailyRate
      ? i18n('carRental.common.pricePerDay', { price: `${quote.dailyRate.toFixed(2)}€` }, `${quote.dailyRate.toFixed(2)}€/dzień`)
      : '';

    if (quote.days === 3) {
      parts.push(i18n('carRental.calculator.breakdown.package3', { total: `${quote.basePrice.toFixed(2)}€` }, `Pakiet 3 dni: ${quote.basePrice.toFixed(2)}€`));
    } else {
      parts.push(
        i18n(
          'carRental.calculator.breakdown.tiered',
          { rate: rateText, days: quote.days, daysLabel, total: `${quote.basePrice.toFixed(2)}€` },
          `${quote.dailyRate.toFixed(2)}€ × ${quote.days} ${daysLabel} = ${quote.basePrice.toFixed(2)}€`
        )
      );
    }

    const pickupLabel = shortLocationLabel(quote.pickupLoc);
    const returnLabel = shortLocationLabel(quote.returnLoc);
    if (quote.pickupFee) {
      parts.push(i18n('carRental.calculator.breakdown.pickupWithFee', { location: pickupLabel, price: `${quote.pickupFee}€` }, `Odbiór: ${pickupLabel} +${quote.pickupFee}€`));
    } else {
      parts.push(i18n('carRental.calculator.breakdown.pickupIncluded', { location: pickupLabel }, `Odbiór: ${pickupLabel} – w cenie`));
    }
    if (quote.returnFee) {
      parts.push(i18n('carRental.calculator.breakdown.returnWithFee', { location: returnLabel, price: `${quote.returnFee}€` }, `Zwrot: ${returnLabel} +${quote.returnFee}€`));
    } else {
      parts.push(i18n('carRental.calculator.breakdown.returnIncluded', { location: returnLabel }, `Zwrot: ${returnLabel} – w cenie`));
    }

    if (quote.insuranceCost) {
      const insurancePerDay = i18n('carRental.common.pricePerDay', { price: '17€' }, '17€/dzień');
      parts.push(
        i18n(
          'carRental.calculator.breakdown.fullInsurance',
          { pricePerDay: insurancePerDay, days: quote.days, daysLabel, total: `${quote.insuranceCost}€` },
          `Ubezpieczenie: ${insurancePerDay} × ${quote.days} ${daysLabel} = ${quote.insuranceCost}€`
        )
      );
    }

    if (quote.youngDriverCost) {
      const youngDriverPerDay = i18n('carRental.common.pricePerDay', { price: '10€' }, '10€/dzień');
      parts.push(
        i18n(
          'carRental.calculator.breakdown.youngDriver',
          { pricePerDay: youngDriverPerDay, days: quote.days, daysLabel, total: `${quote.youngDriverCost}€` },
          `Młody kierowca: ${youngDriverPerDay} × ${quote.days} ${daysLabel} = ${quote.youngDriverCost}€`
        )
      );
    }

    if (breakdownEl) breakdownEl.innerHTML = parts.map(p => `<div>${escapeHtml(p)}</div>`).join('');
    if (messageEl) {
      messageEl.textContent = '';
      messageEl.classList.remove('is-error');
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
    setCalculatorMessage(i18n('carRental.calculator.errors.invalidDates', null, 'Proszę wybrać poprawne daty i godziny.'), true);
    return;
  }
  const hours = (returnDate - pickupDate) / 36e5;
  const days = Math.ceil(hours / 24);
  if (days < 3) {
    const daysLabel = i18n('carRental.common.daysLabel', null, 'dni');
    setCalculatorMessage(i18n('carRental.calculator.errors.minimumDays', { days: 3, daysLabel }, 'Minimalny czas wynajmu to 3 dni'), true);
    return;
  }

  const carPricing = pricing[car];
  if (!carPricing) {
    setCalculatorMessage(i18n('carRental.calculator.errors.selectCar', null, 'Proszę wybrać auto z listy'), true);
    return;
  }

  const quote = calculateQuoteForSelection({
    offer: loc,
    carModel: car,
    pickupDateStr,
    returnDateStr,
    pickupTimeStr,
    returnTimeStr,
    pickupLocation: pickupLoc,
    returnLocation: returnLoc,
    fullInsurance,
    youngDriver,
  });
  if (!quote) {
    setCalculatorMessage(i18n('carRental.calculator.errors.invalidDates', null, 'Proszę wybrać poprawne daty i godziny.'), true);
    return;
  }

  const basePrice = quote.basePrice;
  const dailyRate = quote.dailyRate;
  const pickupFee = quote.pickupFee;
  const returnFee = quote.returnFee;
  const insuranceCost = quote.insuranceCost;
  const youngDriverCost = quote.youngDriverCost;
  const totalPrice = quote.total;

  window.CE_CAR_PRICE_QUOTE = {
    total: Number(totalPrice.toFixed(2)),
    currency: 'EUR',
    breakdown: {
      location: quote.offer,
      days: quote.days,
      basePrice: quote.basePrice,
      dailyRate: quote.dailyRate,
      pickupFee,
      returnFee,
      insuranceCost,
      youngDriverCost,
      car: quote.car,
      pickupLoc: quote.pickupLoc,
      returnLoc: quote.returnLoc,
    },
  };

  const resultEl = document.getElementById('carRentalResult');
  const breakdownEl = document.getElementById('carRentalBreakdown');
  const messageEl = document.getElementById('carRentalMessage');

  if (resultEl) {
    resultEl.textContent = i18n('carRental.calculator.total', { price: `${totalPrice}€` }, `Całkowita cena wynajmu: ${totalPrice}€`);
  }

  const parts = [];
  const daysLabel = i18n('carRental.common.daysLabel', null, 'dni');
  const rateText = dailyRate
    ? i18n('carRental.common.pricePerDay', { price: `${dailyRate}€` }, `${dailyRate}€/dzień`)
    : '';

  if (quote.days === 3) {
    parts.push(i18n('carRental.calculator.breakdown.package3', { total: `${basePrice}€` }, `Pakiet 3 dni: ${basePrice}€`));
  } else {
    parts.push(
      i18n(
        'carRental.calculator.breakdown.tiered',
        { rate: rateText, days: quote.days, daysLabel, total: `${basePrice}€` },
        `${dailyRate}€ × ${quote.days} ${daysLabel} = ${basePrice}€`
      )
    );
  }

  const pickupLabel = i18n(`carRental.locations.${quote.pickupLoc}.short`, null, quote.pickupLoc);
  const returnLabel = i18n(`carRental.locations.${quote.returnLoc}.short`, null, quote.returnLoc);
  if (pickupFee) {
    parts.push(i18n('carRental.calculator.breakdown.pickupWithFee', { location: pickupLabel, price: `${pickupFee}€` }, `Odbiór: ${pickupLabel} +${pickupFee}€`));
  } else {
    parts.push(i18n('carRental.calculator.breakdown.pickupIncluded', { location: pickupLabel }, `Odbiór: ${pickupLabel} – w cenie`));
  }
  if (returnFee) {
    parts.push(i18n('carRental.calculator.breakdown.returnWithFee', { location: returnLabel, price: `${returnFee}€` }, `Zwrot: ${returnLabel} +${returnFee}€`));
  } else {
    parts.push(i18n('carRental.calculator.breakdown.returnIncluded', { location: returnLabel }, `Zwrot: ${returnLabel} – w cenie`));
  }

  if (insuranceCost) {
    const insurancePerDay = i18n('carRental.common.pricePerDay', { price: '17€' }, '17€/dzień');
    parts.push(
      i18n(
        'carRental.calculator.breakdown.fullInsurance',
        { pricePerDay: insurancePerDay, days: quote.days, daysLabel, total: `${insuranceCost}€` },
        `Ubezpieczenie: ${insurancePerDay} × ${quote.days} ${daysLabel} = ${insuranceCost}€`
      )
    );
  }
  if (youngDriverCost) {
    const youngDriverPerDay = i18n('carRental.common.pricePerDay', { price: '10€' }, '10€/dzień');
    parts.push(
      i18n(
        'carRental.calculator.breakdown.youngDriver',
        { pricePerDay: youngDriverPerDay, days: quote.days, daysLabel, total: `${youngDriverCost}€` },
        `Młody kierowca: ${youngDriverPerDay} × ${quote.days} ${daysLabel} = ${youngDriverCost}€`
      )
    );
  }
  if (breakdownEl) breakdownEl.innerHTML = parts.map(p => `<div>${escapeHtml(p)}</div>`).join('');
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
      const offerId = button.getAttribute('data-select-car-offer-id');
      const pfoSelect = document.getElementById('car');
      const lcaSelect = document.getElementById('rentalCarSelect');
      const resSelect = document.getElementById('res_car');

      const setSelectByOfferId = (selectEl) => {
        if (!selectEl || !offerId) return false;
        const opts = Array.from(selectEl.options || []);
        const match = opts.find((opt) => String(opt?.dataset?.offerId || '') === String(offerId));
        if (!match) return false;
        selectEl.value = match.value;
        return true;
      };

      const setSelectByModel = (selectEl) => {
        if (!selectEl || !carName) return;
        selectEl.value = carName;
      };

      if (pfoSelect && carName) {
        if (!setSelectByOfferId(pfoSelect)) setSelectByModel(pfoSelect);
      }
      if (lcaSelect && carName) {
        if (!setSelectByOfferId(lcaSelect)) setSelectByModel(lcaSelect);
      }
      if (resSelect && carName) {
        if (!setSelectByOfferId(resSelect)) setSelectByModel(resSelect);
      }
      if (isLandingCarRentalPage() && typeof window.CE_CAR_ON_CARD_SELECT === 'function') {
        try {
          window.CE_CAR_ON_CARD_SELECT({ carName, offerId });
        } catch (e) {
          console.warn('Landing card select callback failed:', e);
        }
      }
      window.calculatePrice();
      const scrollTarget = isLandingCarRentalPage()
        ? (document.getElementById('carReservationForm') || document.getElementById('carRentalCalculatorBlock'))
        : document.getElementById('carRentalCalculatorBlock');
      if (scrollTarget) {
        scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      (lcaSelect || pfoSelect || resSelect)?.focus?.({ preventScroll: true });
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
  
  // Register language change handler (uses global helper if available)
  if (typeof window.registerLanguageChangeHandler === 'function') {
    window.registerLanguageChangeHandler((language) => {
      console.log('🚗 Car rental: Re-rendering for language:', language);
      
      // Only re-render if fleet is loaded
      if (paphosFleet && paphosFleet.length > 0) {
        renderFleet();
        updateCalculatorOptions();
        
        // Re-calculate prices if calculator exists
        if (typeof window.calculatePrice === 'function') {
          window.calculatePrice();
        }
        
        console.log('✅ Car rental re-rendered');
      }
    });
  }
});

export { loadPaphosFleet, paphosFleet };
