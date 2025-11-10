// Success/Error Popup Modal
// Beautiful centered popup for booking confirmations

function showSuccessPopup(title, message) {
  showPopup(title, message, 'success');
}

function showErrorPopup(title, message) {
  showPopup(title, message, 'error');
}

function showPopup(title, message, type) {
  // Remove existing popup if any
  const existing = document.getElementById('bookingPopup');
  if (existing) existing.remove();
  
  // Create popup overlay
  const overlay = document.createElement('div');
  overlay.id = 'bookingPopup';
  overlay.className = `booking-popup-overlay ${type}`;
  
  overlay.innerHTML = `
    <div class="booking-popup">
      <div class="booking-popup-icon">
        ${type === 'success' ? '✓' : '✕'}
      </div>
      <h3 class="booking-popup-title">${title}</h3>
      <p class="booking-popup-message">${message}</p>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Animate in
  setTimeout(() => overlay.classList.add('active'), 10);
  
  // Auto close after 3 seconds
  setTimeout(() => {
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 300);
  }, 3000);
  
  // Click to close
  overlay.addEventListener('click', () => {
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 300);
  });
}

function clearFormValidation(form) {
  // Clear HTML5 validation messages
  if (!form) return;
  
  // Reset custom validity on all inputs
  const inputs = form.querySelectorAll('input, textarea, select');
  inputs.forEach(input => {
    if (input.setCustomValidity) {
      input.setCustomValidity('');
    }
    // Remove invalid class if exists
    input.classList.remove('invalid');
  });
}

// Export functions
if (typeof window !== 'undefined') {
  window.showSuccessPopup = showSuccessPopup;
  window.showErrorPopup = showErrorPopup;
  window.clearFormValidation = clearFormValidation;
}
