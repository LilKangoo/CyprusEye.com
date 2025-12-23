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
    <div class="booking-popup" role="dialog" aria-modal="true">
      <button type="button" class="booking-popup-close" aria-label="Close">×</button>
      <div class="booking-popup-icon">
        ${type === 'success' ? '✓' : '✕'}
      </div>
      <h3 class="booking-popup-title">${title}</h3>
      <p class="booking-popup-message">${message}</p>
    </div>
  `;
  
  document.body.appendChild(overlay);

  const closePopup = () => {
    if (!overlay || !overlay.isConnected) return;
    overlay.classList.remove('active');
    setTimeout(() => {
      if (overlay && overlay.isConnected) overlay.remove();
    }, 300);
    document.removeEventListener('keydown', onKeyDown);
  };

  const onKeyDown = (e) => {
    if (e && e.key === 'Escape') {
      closePopup();
    }
  };

  // Animate in
  setTimeout(() => overlay.classList.add('active'), 10);

  // Click outside / close button
  overlay.addEventListener('click', closePopup);
  const closeBtn = overlay.querySelector('.booking-popup-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closePopup();
    });
  }

  document.addEventListener('keydown', onKeyDown);
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
