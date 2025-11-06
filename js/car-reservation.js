// Car Reservation Form Handler
import { supabase } from './supabaseClient.js';
import { showToast } from './toast.js';

let reservationData = {};

// Initialize form
export function initReservationForm() {
  const form = document.getElementById('localReservationForm');
  if (!form) return;

  // Populate form with calculator data if available
  populateFromCalculator();

  // Form submission
  form.addEventListener('submit', handleReservationSubmit);

  // Auto-fill from calculator button
  const btnFillFromCalc = document.getElementById('btnFillFromCalculator');
  if (btnFillFromCalc) {
    btnFillFromCalc.addEventListener('click', populateFromCalculator);
  }
}

// Populate form from calculator
function populateFromCalculator() {
  const calcCar = document.getElementById('car')?.value;
  const calcPickupDate = document.getElementById('pickup_date')?.value;
  const calcPickupTime = document.getElementById('pickup_time')?.value;
  const calcReturnDate = document.getElementById('return_date')?.value;
  const calcReturnTime = document.getElementById('return_time')?.value;
  const calcAirportPickup = document.getElementById('airport_pickup')?.checked;
  const calcAirportReturn = document.getElementById('airport_return')?.checked;
  const calcInsurance = document.getElementById('full_insurance')?.checked;

  if (calcCar) document.getElementById('res_car').value = calcCar;
  if (calcPickupDate) document.getElementById('res_pickup_date').value = calcPickupDate;
  if (calcPickupTime) document.getElementById('res_pickup_time').value = calcPickupTime;
  if (calcReturnDate) document.getElementById('res_return_date').value = calcReturnDate;
  if (calcReturnTime) document.getElementById('res_return_time').value = calcReturnTime;
  
  if (calcAirportPickup) {
    document.getElementById('res_pickup_location').value = 'airport_pfo';
  }
  if (calcAirportReturn) {
    document.getElementById('res_return_location').value = 'airport_pfo';
  }
  if (calcInsurance) {
    document.getElementById('res_insurance').checked = true;
  }

  // Calculate and show estimated price
  calculateEstimatedPrice();

  showToast('Dane z kalkulatora zostały przeniesione!', 'success');
}

// Calculate estimated price
function calculateEstimatedPrice() {
  const pickupDate = document.getElementById('res_pickup_date')?.value;
  const returnDate = document.getElementById('res_return_date')?.value;
  
  if (!pickupDate || !returnDate) return;

  const pickup = new Date(pickupDate);
  const returnD = new Date(returnDate);
  const days = Math.ceil((returnD - pickup) / (1000 * 60 * 60 * 24));

  if (days < 3) {
    document.getElementById('estimatedPrice').textContent = 'Minimalny wynajem: 3 dni';
    return;
  }

  // Show estimated price message
  document.getElementById('estimatedPrice').textContent = 
    `Szacunkowy czas wynajmu: ${days} dni. Ostateczną cenę otrzymasz po potwierdzeniu dostępności.`;
}

// Handle form submission
async function handleReservationSubmit(event) {
  event.preventDefault();

  const form = event.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  const errorDiv = document.getElementById('reservationError');

  try {
    if (submitBtn) submitBtn.disabled = true;
    if (errorDiv) errorDiv.hidden = true;

    // Collect form data
    const formData = new FormData(form);
    
    // Build data object with only essential fields
    const data = {
      // Personal info (REQUIRED)
      full_name: formData.get('full_name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      
      // Rental details (REQUIRED)
      car_model: formData.get('car'),
      pickup_date: formData.get('pickup_date'),
      pickup_time: formData.get('pickup_time') || '10:00',
      pickup_location: formData.get('pickup_location'),
      return_date: formData.get('return_date'),
      return_time: formData.get('return_time') || '10:00',
      return_location: formData.get('return_location'),
      
      // Metadata
      location: 'paphos',
      status: 'pending',
      source: 'website_autopfo'
    };
    
    // Add optional fields only if they have values
    const country = formData.get('country');
    if (country) data.country = country;
    
    const pickupAddr = formData.get('pickup_address');
    if (pickupAddr) data.pickup_address = pickupAddr;
    
    const returnAddr = formData.get('return_address');
    if (returnAddr) data.return_address = returnAddr;
    
    const numPass = parseInt(formData.get('num_passengers'));
    if (numPass && numPass > 0) data.num_passengers = numPass;
    
    const childSeats = parseInt(formData.get('child_seats'));
    if (childSeats && childSeats > 0) data.child_seats = childSeats;
    
    const insurance = formData.get('insurance');
    if (insurance === 'on') data.full_insurance = true;
    
    const flightNum = formData.get('flight_number');
    if (flightNum) data.flight_number = flightNum;
    
    const requests = formData.get('special_requests');
    if (requests) data.special_requests = requests;

    console.log('Submitting reservation:', data);
    console.log('Supabase client:', supabase);
    console.log('Data keys:', Object.keys(data));

    // Save to Supabase
    const { data: booking, error } = await supabase
      .from('car_bookings')
      .insert([data])
      .select()
      .single();
    
    console.log('Insert result - booking:', booking);
    console.log('Insert result - error:', error);

    if (error) {
      console.error('Booking error:', error);
      throw new Error(error.message || 'Nie udało się zapisać rezerwacji');
    }

    console.log('Booking created:', booking);

    // Show success message
    showSuccessMessage(booking);
    
    // Show visible confirmation
    const confirmDiv = document.getElementById('formSubmitConfirmation');
    if (confirmDiv) {
      confirmDiv.hidden = false;
      confirmDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    // Reset form
    form.reset();
    
    // Show toast
    if (typeof showToast === 'function') {
      showToast('🎉 Gratulacje! Twój formularz został wysłany!', 'success');
    } else {
      console.warn('showToast function not available');
    }

  } catch (e) {
    console.error('Reservation error:', e);
    
    if (errorDiv) {
      errorDiv.textContent = 'Błąd: ' + (e.message || 'Nie udało się wysłać rezerwacji. Spróbuj ponownie lub napisz na WhatsApp.');
      errorDiv.hidden = false;
    }
    
    showToast('Błąd wysyłania rezerwacji. Spróbuj ponownie.', 'error');
    
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

// Show success message
function showSuccessMessage(booking) {
  const successDiv = document.getElementById('reservationSuccess');
  if (!successDiv) return;

  successDiv.innerHTML = `
    <div style="background: #10b981; color: white; padding: 20px; border-radius: 8px; margin-top: 16px;">
      <h4 style="margin: 0 0 8px; font-size: 18px;">✅ Rezerwacja wysłana!</h4>
      <p style="margin: 0; opacity: 0.9;">
        Numer rezerwacji: <strong>#${booking.id.slice(0, 8)}</strong><br>
        Skontaktujemy się z Tobą w ciągu 24h, aby potwierdzić dostępność i przesłać umowę.
      </p>
      <p style="margin: 12px 0 0; font-size: 14px; opacity: 0.8;">
        Sprawdź email: <strong>${booking.email}</strong>
      </p>
    </div>
  `;
  successDiv.hidden = false;

  // Scroll to success message
  successDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Show/hide address fields based on location
function handleLocationChange(selectElement) {
  const locationValue = selectElement.value;
  const addressFieldId = selectElement.id === 'res_pickup_location' 
    ? 'pickupAddressField' 
    : 'returnAddressField';
  
  const addressField = document.getElementById(addressFieldId);
  if (!addressField) return;

  // Show address field if "other" or "hotel" is selected
  if (locationValue === 'hotel' || locationValue === 'other') {
    addressField.hidden = false;
    addressField.querySelector('input').required = true;
  } else {
    addressField.hidden = true;
    addressField.querySelector('input').required = false;
  }
}

// Initialize location change handlers
document.addEventListener('DOMContentLoaded', () => {
  const pickupLocation = document.getElementById('res_pickup_location');
  const returnLocation = document.getElementById('res_return_location');

  if (pickupLocation) {
    pickupLocation.addEventListener('change', (e) => handleLocationChange(e.target));
  }
  if (returnLocation) {
    returnLocation.addEventListener('change', (e) => handleLocationChange(e.target));
  }

  // Auto-calculate price on date change
  const pickupDate = document.getElementById('res_pickup_date');
  const returnDate = document.getElementById('res_return_date');
  
  if (pickupDate) pickupDate.addEventListener('change', calculateEstimatedPrice);
  if (returnDate) returnDate.addEventListener('change', calculateEstimatedPrice);

  // Initialize form
  initReservationForm();
});

export { handleReservationSubmit, populateFromCalculator };
