/**
 * Hotel Booking Service
 * Handles hotel booking submissions to Supabase
 * Uses VITE_* environment variables for authentication
 */

import { supabase } from '../lib/supabase.js';

/**
 * Submit hotel booking form to Supabase
 * @param {HTMLFormElement} form - The booking form element
 * @returns {Promise<any>} Inserted booking data
 * @throws {Error} If submission fails with detailed error info
 */
export async function submitHotelBooking(form) {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  // Get form data
  const fd = new FormData(form);
  
  // Get dates
  const arrivalDate = fd.get('arrival_date');
  const departureDate = fd.get('departure_date');
  
  // Validate required fields
  if (!fd.get('name') || !fd.get('email')) {
    throw new Error('Imię i email są wymagane');
  }
  
  if (!arrivalDate || !departureDate) {
    throw new Error('Daty przyjazdu i wyjazdu są wymagane');
  }
  
  // Calculate nights between dates
  const nights = calculateNights(arrivalDate, departureDate);
  
  // Get current hotel data from global (set by openHotelModalHome)
  const currentHotel = window.homeCurrentHotel;
  
  if (!currentHotel) {
    throw new Error('Nie wybrano hotelu');
  }
  
  // Get form values
  const adults = Number(fd.get('adults') || 2);
  const children = Number(fd.get('children') || 0);
  const totalPersons = adults + children;
  
  // Calculate price
  const totalPrice = calculatePrice(currentHotel, totalPersons, nights);
  
  // Build payload matching database schema exactly
  const payload = {
    // Hotel references
    hotel_id: currentHotel.id || null,
    hotel_slug: currentHotel.slug || null,
    category_id: currentHotel.category_id || null,
    
    // Customer info (match DB column names)
    customer_name: fd.get('name'),
    customer_email: fd.get('email'),
    customer_phone: fd.get('phone') || null,
    
    // Stay details
    arrival_date: arrivalDate,
    departure_date: departureDate,
    num_adults: adults,
    num_children: children,
    nights: nights,
    notes: fd.get('notes') || null,
    
    // Pricing
    total_price: totalPrice,
    
    // Status
    status: 'pending'
  };
  
  // Remove undefined values
  Object.keys(payload).forEach(key => {
    if (payload[key] === undefined) {
      delete payload[key];
    }
  });
  
  console.log('📤 Submitting hotel booking to Supabase:', payload);
  
  // Insert into Supabase with proper error handling
  const { data, error } = await supabase
    .from('hotel_bookings')
    .insert([payload])
    .select();
  
  if (error) {
    // Log detailed error information
    console.error('❌ Supabase error details:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      status: error.status
    });
    
    // Build user-friendly error message
    let errorMsg = error.message || 'Błąd podczas zapisywania rezerwacji';
    
    if (error.code === '42501') {
      errorMsg = 'Brak uprawnień do zapisu. Sprawdź polityki RLS w Supabase.';
    } else if (error.code === '23502') {
      errorMsg = `Brak wymaganego pola: ${error.details || 'sprawdź formularz'}`;
    } else if (error.code === '23503') {
      errorMsg = `Błąd relacji: ${error.details || 'nieprawidłowy hotel'}`;
    }
    
    if (error.details) {
      errorMsg += ` — ${error.details}`;
    }
    if (error.hint) {
      errorMsg += ` (${error.hint})`;
    }
    
    throw new Error(errorMsg);
  }
  
  console.log('✅ Hotel booking created successfully:', data);
  return data;
}

/**
 * Calculate nights between two dates
 * @param {string} arrival - Arrival date (YYYY-MM-DD)
 * @param {string} departure - Departure date (YYYY-MM-DD)
 * @returns {number} Number of nights
 */
function calculateNights(arrival, departure) {
  if (!arrival || !departure) return 1;
  
  const arrivalDate = new Date(arrival);
  const departureDate = new Date(departure);
  const diffTime = departureDate - arrivalDate;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(1, diffDays);
}

// Helper: Znajdź tier po liczbie osób
function findTierByPersons(tiers, persons) {
  let rule = tiers.find(r => Number(r.persons) === persons);
  if (rule) return rule;
  const lowers = tiers.filter(r => Number(r.persons) <= persons);
  if (lowers.length) {
    return lowers.sort((a, b) => Number(b.persons) - Number(a.persons))[0];
  }
  return null;
}

// Helper: Znajdź najlepszy tier dla długości pobytu (flat_per_night)
function findBestTierByNights(tiers, nights) {
  const matching = tiers
    .filter(r => !r.min_nights || Number(r.min_nights) <= nights)
    .sort((a, b) => (Number(b.min_nights) || 0) - (Number(a.min_nights) || 0));
  return matching[0] || tiers[0];
}

// Helper: Znajdź najlepszy tier dla osób I nocy (tiered_by_nights)
function findBestTierByPersonsAndNights(tiers, persons, nights) {
  let personTiers = tiers.filter(r => Number(r.persons) === persons);
  if (!personTiers.length) {
    const lowers = tiers.filter(r => Number(r.persons) <= persons);
    if (lowers.length) {
      const maxPersons = Math.max(...lowers.map(r => Number(r.persons)));
      personTiers = lowers.filter(r => Number(r.persons) === maxPersons);
    }
  }
  if (!personTiers.length) return null;
  const matching = personTiers
    .filter(r => !r.min_nights || Number(r.min_nights) <= nights)
    .sort((a, b) => (Number(b.min_nights) || 0) - (Number(a.min_nights) || 0));
  return matching[0] || personTiers[0];
}

/**
 * Calculate hotel price based on pricing model and tiers
 * @param {object} hotel - Hotel data with pricing_model and pricing_tiers
 * @param {number} persons - Total number of persons
 * @param {number} nights - Number of nights
 * @returns {object} { total, pricePerNight, billableNights, tier }
 */
function calculatePrice(hotel, persons, nights) {
  const model = hotel.pricing_model || 'per_person_per_night';
  const tiers = hotel.pricing_tiers?.rules || [];
  if (!tiers.length) return { total: 0, pricePerNight: 0, billableNights: nights, tier: null };
  
  persons = Number(persons) || 1;
  nights = Number(nights) || 1;
  let rule = null;
  
  switch (model) {
    case 'flat_per_night':
      rule = findBestTierByNights(tiers, nights);
      break;
    case 'tiered_by_nights':
      rule = findBestTierByPersonsAndNights(tiers, persons, nights);
      break;
    case 'per_person_per_night':
    case 'category_per_night':
    default:
      rule = findTierByPersons(tiers, persons);
      break;
  }
  
  if (!rule) {
    rule = tiers.sort((a, b) => Number(a.price_per_night) - Number(b.price_per_night))[0];
  }
  
  const pricePerNight = Number(rule.price_per_night || 0);
  const minNights = Number(rule.min_nights || 0);
  const billableNights = minNights ? Math.max(minNights, nights) : nights;
  const total = billableNights * pricePerNight;
  
  return { total, pricePerNight, billableNights, tier: rule };
}
