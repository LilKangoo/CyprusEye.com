// Modal/Sheet utilities for iOS-safe modals
// Prevents body scroll, manages viewport height, removes scroll anchors

let scrollY = 0;

export function openSheet(modalElement) {
  if (!modalElement) return;
  
  // Save current scroll position
  scrollY = window.scrollY;
  
  // Lock body scroll
  document.body.classList.add('modal-open');
  document.body.style.top = `-${scrollY}px`;
  
  // Show modal
  modalElement.hidden = false;
  modalElement.classList.add('active');
  
  // Set CSS custom property for iOS viewport
  setViewportHeight();
}

export function closeSheet(modalElement) {
  if (!modalElement) return;
  
  // Hide modal
  modalElement.classList.remove('active');
  modalElement.hidden = true;
  
  // Unlock body scroll
  document.body.classList.remove('modal-open');
  document.body.style.top = '';
  
  // Restore scroll position (without triggering scroll events)
  window.scrollTo(0, scrollY);
}

function setViewportHeight() {
  // Fix for iOS viewport height bug
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

// Update on resize
window.addEventListener('resize', setViewportHeight);

// Initialize on load
if (typeof window !== 'undefined') {
  setViewportHeight();
  
  // Export to window for inline handlers
  window.openSheet = openSheet;
  window.closeSheet = closeSheet;
}
