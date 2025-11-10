/**
 * Hotel Booking Service
 * Submits hotel bookings to Supabase public.hotel_bookings table
 */

/**
 * Submit hotel booking form to Supabase
 * @param {HTMLFormElement} form - The booking form element
 * @returns {Promise<any>} Inserted booking data
 * @throws {Error} If submission fails with detailed error info
 */
export async function submitHotelBooking(form) {
  // Import Supabase client with VITE_* env vars
  const { supabase } = await import('../lib/supabase.js');
  
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

/**
 * Calculate hotel price based on pricing tiers
 * @param {object} hotel - Hotel data with pricing_tiers
 * @param {number} persons - Total number of persons
 * @param {number} nights - Number of nights
 * @returns {number} Total price
 */
function calculatePrice(hotel, persons, nights) {
  const tiers = hotel.pricing_tiers?.rules || [];
  if (!tiers.length) return 0;
  
  // Find matching tier for number of persons
  let rule = tiers.find(r => Number(r.persons) === persons);
  
  // If no exact match, find closest lower tier
  if (!rule) {
    const lowerTiers = tiers.filter(r => Number(r.persons) <= persons);
    if (lowerTiers.length) {
      rule = lowerTiers.sort((a, b) => Number(b.persons) - Number(a.persons))[0];
    }
  }
  
  // If still no match, use cheapest tier
  if (!rule) {
    rule = tiers.sort((a, b) => Number(a.price_per_night) - Number(b.price_per_night))[0];
  }
  
  const pricePerNight = Number(rule.price_per_night || 0);
  const minNights = Number(rule.min_nights || 0);
  const billableNights = minNights ? Math.max(minNights, nights) : nights;
  
  return billableNights * pricePerNight;
}
