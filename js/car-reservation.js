// Car Reservation Form Handler
import { supabase } from './supabaseClient.js';
import { showToast } from './toast.js';

let reservationData = {};

// Prefill form fields from logged-in user session
async function prefillFromUserSession() {
  try {
    // Wait for auth to be ready
    if (typeof window.waitForAuthReady === 'function') {
      await window.waitForAuthReady();
    }
    
    const session = window.CE_STATE?.session;
    const profile = window.CE_STATE?.profile;
    
    // Prefill email from session
    if (session?.user?.email) {
      const emailField = document.getElementById('res_email');
      if (emailField && !emailField.value) {
        emailField.value = session.user.email;
        // Visual indicator (green flash) that email was auto-filled
        emailField.style.backgroundColor = '#f0fdf4';
        setTimeout(() => { emailField.style.backgroundColor = ''; }, 2000);
      }
    }
    
    // Prefill name from profile (if available)
    if (profile?.full_name || profile?.username || profile?.name) {
      const nameField = document.getElementById('res_full_name');
      if (nameField && !nameField.value) {
        nameField.value = profile.full_name || profile.name || profile.username || '';
        nameField.style.backgroundColor = '#f0fdf4';
        setTimeout(() => { nameField.style.backgroundColor = ''; }, 2000);
      }
    }
    
    // Prefill phone from profile (if available)
    if (profile?.phone) {
      const phoneField = document.getElementById('res_phone');
      if (phoneField && !phoneField.value) {
        phoneField.value = profile.phone;
        phoneField.style.backgroundColor = '#f0fdf4';
        setTimeout(() => { phoneField.style.backgroundColor = ''; }, 2000);
      }
    }
  } catch (err) {
    console.warn('Could not prefill user data:', err);
  }
}

// Initialize form
export function initReservationForm() {
  const form = document.getElementById('localReservationForm');
  if (!form) return;

  // Populate form with calculator data if available
  populateFromCalculator();
  
  // Prefill user data from session (email, name, phone)
  prefillFromUserSession();

  // Form submission
  form.addEventListener('submit', handleReservationSubmit);

  // Auto-fill from calculator button
  const btnFillFromCalc = document.getElementById('btnFillFromCalculator');
  if (btnFillFromCalc) {
    btnFillFromCalc.addEventListener('click', () => {
      populateFromCalculator();
      // Scroll to form and focus first field
      const formEl = document.getElementById('localReservationForm');
      if (formEl) {
        formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const firstInput = document.getElementById('res_full_name') || formEl.querySelector('input, select, textarea');
        firstInput?.focus?.({ preventScroll: true });
      }
    });
  }
}

// Populate form from calculator
function populateFromCalculator() {
  // Autopfo calculator IDs
  const calcCarPfo = document.getElementById('car')?.value;
  const calcPickupDatePfo = document.getElementById('pickup_date')?.value;
  const calcPickupTimePfo = document.getElementById('pickup_time')?.value;
  const calcReturnDatePfo = document.getElementById('return_date')?.value;
  const calcReturnTimePfo = document.getElementById('return_time')?.value;
  const calcAirportPickupPfo = document.getElementById('airport_pickup')?.checked;
  const calcAirportReturnPfo = document.getElementById('airport_return')?.checked;
  const calcInsurancePfo = document.getElementById('full_insurance')?.checked;

  // Larnaca calculator IDs (car-rental.html)
  const calcCarLca = document.getElementById('rentalCarSelect')?.value;
  const calcPickupDateLca = document.getElementById('pickupDate')?.value;
  const calcPickupTimeLca = document.getElementById('pickupTime')?.value;
  const calcReturnDateLca = document.getElementById('returnDate')?.value;
  const calcReturnTimeLca = document.getElementById('returnTime')?.value;
  const calcPickupLocLca = document.getElementById('pickupLocation')?.value;
  const calcReturnLocLca = document.getElementById('returnLocation')?.value;
  const calcInsuranceLca = document.getElementById('fullInsurance')?.checked;
  const calcYoungDriverLca = document.getElementById('youngDriver')?.checked;

  // Prefer Larnaca values when available, otherwise use Paphos
  const calcCar = calcCarLca || calcCarPfo;
  const calcPickupDate = calcPickupDateLca || calcPickupDatePfo;
  const calcPickupTime = calcPickupTimeLca || calcPickupTimePfo;
  const calcReturnDate = calcReturnDateLca || calcReturnDatePfo;
  const calcReturnTime = calcReturnTimeLca || calcReturnTimePfo;

  if (calcCar) document.getElementById('res_car').value = calcCar;
  if (calcPickupDate) document.getElementById('res_pickup_date').value = calcPickupDate;
  if (calcPickupTime) document.getElementById('res_pickup_time').value = calcPickupTime;
  if (calcReturnDate) document.getElementById('res_return_date').value = calcReturnDate;
  if (calcReturnTime) document.getElementById('res_return_time').value = calcReturnTime;

  // Map locations
  const pageLocation = (document.body?.dataset?.carLocation || '').toLowerCase();
  if (calcPickupLocLca) {
    // Direct pass-through of city ID from calculator (larnaca, nicosia, ayia-napa, protaras, limassol, paphos)
    document.getElementById('res_pickup_location').value = calcPickupLocLca;
  } else if (calcAirportPickupPfo) {
    // Fallback for Paphos calculator checkbox
    document.getElementById('res_pickup_location').value = pageLocation === 'larnaca' ? 'larnaca' : 'paphos';
  }
  if (calcReturnLocLca) {
    document.getElementById('res_return_location').value = calcReturnLocLca;
  } else if (calcAirportReturnPfo) {
    document.getElementById('res_return_location').value = pageLocation === 'larnaca' ? 'larnaca' : 'paphos';
  }

  // Insurance
  const insuranceChecked = !!(calcInsuranceLca || calcInsurancePfo);
  if (insuranceChecked) {
    document.getElementById('res_insurance').checked = true;
  }
  
  // Young driver
  if (calcYoungDriverLca) {
    const youngDriverField = document.getElementById('res_young_driver');
    if (youngDriverField) youngDriverField.checked = true;
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

// Validation messages in multiple languages
function getValidationMessages() {
  const lang = (typeof window.getCurrentLanguage === 'function') ? window.getCurrentLanguage() : 'pl';
  
  const messages = {
    pl: {
      fullName: 'Proszę podać imię i nazwisko',
      email: 'Proszę podać poprawny adres email',
      phone: 'Proszę podać numer telefonu',
      pickupDate: 'Proszę wybrać datę odbioru',
      returnDate: 'Proszę wybrać datę zwrotu',
      car: 'Proszę wybrać samochód',
      pickupLocation: 'Proszę wybrać miejsce odbioru',
      returnLocation: 'Proszę wybrać miejsce zwrotu'
    },
    en: {
      fullName: 'Please enter your full name',
      email: 'Please enter a valid email address',
      phone: 'Please enter your phone number',
      pickupDate: 'Please select pickup date',
      returnDate: 'Please select return date',
      car: 'Please select a car',
      pickupLocation: 'Please select pickup location',
      returnLocation: 'Please select return location'
    },
    el: {
      fullName: 'Παρακαλώ εισάγετε το ονοματεπώνυμό σας',
      email: 'Παρακαλώ εισάγετε έγκυρη διεύθυνση email',
      phone: 'Παρακαλώ εισάγετε τον αριθμό τηλεφώνου σας',
      pickupDate: 'Παρακαλώ επιλέξτε ημερομηνία παραλαβής',
      returnDate: 'Παρακαλώ επιλέξτε ημερομηνία επιστροφής',
      car: 'Παρακαλώ επιλέξτε αυτοκίνητο',
      pickupLocation: 'Παρακαλώ επιλέξτε τοποθεσία παραλαβής',
      returnLocation: 'Παρακαλώ επιλέξτε τοποθεσία επιστροφής'
    },
    he: {
      fullName: 'אנא הזן את שמך המלא',
      email: 'אנא הזן כתובת אימייל תקינה',
      phone: 'אנא הזן את מספר הטלפון שלך',
      pickupDate: 'אנא בחר תאריך איסוף',
      returnDate: 'אנא בחר תאריך החזרה',
      car: 'אנא בחר רכב',
      pickupLocation: 'אנא בחר מיקום איסוף',
      returnLocation: 'אנא בחר מיקום החזרה'
    }
  };
  
  return messages[lang] || messages.pl;
}

// Validate form fields
function validateReservationForm(formData) {
  const msgs = getValidationMessages();
  const errors = [];
  
  // Required fields validation
  const fullName = formData.get('full_name')?.trim();
  if (!fullName) errors.push({ field: 'res_full_name', message: msgs.fullName });
  
  const email = formData.get('email')?.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) errors.push({ field: 'res_email', message: msgs.email });
  
  const phone = formData.get('phone')?.trim();
  if (!phone) errors.push({ field: 'res_phone', message: msgs.phone });
  
  const pickupDate = formData.get('pickup_date');
  if (!pickupDate) errors.push({ field: 'res_pickup_date', message: msgs.pickupDate });
  
  const returnDate = formData.get('return_date');
  if (!returnDate) errors.push({ field: 'res_return_date', message: msgs.returnDate });
  
  const car = formData.get('car');
  if (!car) errors.push({ field: 'res_car', message: msgs.car });
  
  const pickupLocation = formData.get('pickup_location');
  if (!pickupLocation) errors.push({ field: 'res_pickup_location', message: msgs.pickupLocation });
  
  const returnLocation = formData.get('return_location');
  if (!returnLocation) errors.push({ field: 'res_return_location', message: msgs.returnLocation });
  
  return errors;
}

// Show validation errors on form fields
function showValidationErrors(errors) {
  // Clear previous errors
  document.querySelectorAll('.field-error').forEach(el => el.remove());
  document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
  
  errors.forEach(err => {
    const field = document.getElementById(err.field);
    if (field) {
      field.classList.add('input-error');
      const errorSpan = document.createElement('span');
      errorSpan.className = 'field-error';
      errorSpan.textContent = err.message;
      errorSpan.style.cssText = 'color: #dc2626; font-size: 12px; display: block; margin-top: 4px;';
      field.parentNode.appendChild(errorSpan);
    }
  });
  
  // Scroll to first error
  if (errors.length > 0) {
    const firstField = document.getElementById(errors[0].field);
    if (firstField) {
      firstField.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstField.focus();
    }
  }
}

// Handle form submission
async function handleReservationSubmit(event) {
  event.preventDefault();

  const form = event.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  const errorDiv = document.getElementById('reservationError');

  // Collect form data
  const formData = new FormData(form);
  
  // Validate form
  const validationErrors = validateReservationForm(formData);
  if (validationErrors.length > 0) {
    showValidationErrors(validationErrors);
    return;
  }
  
  // Clear any previous validation errors
  document.querySelectorAll('.field-error').forEach(el => el.remove());
  document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));

  try {
    if (submitBtn) submitBtn.disabled = true;
    if (errorDiv) errorDiv.hidden = true;
    
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
      location: (document.body?.dataset?.carLocation || (location?.href?.includes('autopfo') ? 'paphos' : 'larnaca')).toLowerCase(),
      status: 'pending',
      source: (document.body?.dataset?.carLocation || '').toLowerCase() === 'paphos' ? 'website_autopfo' : 'website_car_rental'
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
    
    const youngDriver = formData.get('young_driver');
    if (youngDriver === 'on') data.young_driver = true;
    
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
