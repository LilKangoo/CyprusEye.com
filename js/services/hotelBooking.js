/**
 * Hotel Booking Service
 * Handles hotel booking submissions to Supabase
 */

/**
 * Submit hotel booking form to Supabase
 * @param {HTMLFormElement} form - The booking form element
 * @returns {Promise<any>} Inserted booking data
 * @throws {Error} If submission fails
 */
export async function submitHotelBooking(form) {
  // Import Supabase client
  const { supabase } = await import('../supabaseClient.js');
  
  if (!supabase) {
    throw new Error('Supabase client not available');
  }

  // Get form data
  const fd = new FormData(form);
  
  // Map form fields to database columns
  // Form uses: name, email, phone, arrival_date, departure_date, adults, children, notes
  // DB expects: customer_name, customer_email, customer_phone, arrival_date, departure_date, 
  //             num_adults, num_children, notes, nights, total_price
  
  const arrivalDate = fd.get('arrival_date');
  const departureDate = fd.get('departure_date');
  
  // Calculate nights between dates
  const nights = calculateNights(arrivalDate, departureDate);
  
  // Get current hotel data from the modal (set by openHotelModalHome)
  const currentHotel = window.homeCurrentHotel;
  
  // Build payload matching database schema
  const payload = {
    hotel_id: currentHotel?.id || null,
    hotel_slug: currentHotel?.slug || null,
    category_id: currentHotel?.category_id || null,
    customer_name: fd.get('name'),
    customer_email: fd.get('email'),
    customer_phone: fd.get('phone') || null,
    arrival_date: arrivalDate,
    departure_date: departureDate,
    num_adults: Number(fd.get('adults') || 2),
    num_children: Number(fd.get('children') || 0),
    nights: nights,
    notes: fd.get('notes') || null,
    total_price: currentHotel ? calculatePrice(currentHotel, Number(fd.get('adults') || 2) + Number(fd.get('children') || 0), nights) : 0,
    status: 'pending'
  };
  
  // Remove undefined values
  Object.keys(payload).forEach(key => {
    if (payload[key] === undefined) {
      delete payload[key];
    }
  });
  
  console.log('📤 Submitting hotel booking:', payload);
  
  // Insert into Supabase
  const { data, error } = await supabase
    .from('hotel_bookings')
    .insert([payload])
    .select();
  
  if (error) {
    console.error('❌ Supabase error:', error);
    const errorMsg = error.message || 'Insert failed';
    const details = error.details ? ` — ${error.details}` : '';
    const hint = error.hint ? ` (${error.hint})` : '';
    throw new Error(errorMsg + details + hint);
  }
  
  console.log('✅ Booking created:', data);
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
