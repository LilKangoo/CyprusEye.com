/**
 * Header Navigation Dropdown
 * Handles the toggle behavior for the mobile navigation menu.
 */

document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('navToggleBtn');
  const linksRow = document.getElementById('navLinksRow');

  if (!toggleBtn || !linksRow) return;

  toggleBtn.addEventListener('click', () => {
    const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
    
    // Toggle state
    toggleBtn.setAttribute('aria-expanded', !isExpanded);
    
    // Toggle visibility class
    if (!isExpanded) {
      linksRow.classList.add('is-open');
    } else {
      linksRow.classList.remove('is-open');
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (event) => {
    const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
    if (isExpanded && !toggleBtn.contains(event.target) && !linksRow.contains(event.target)) {
      toggleBtn.setAttribute('aria-expanded', 'false');
      linksRow.classList.remove('is-open');
    }
  });
  
  console.log('✅ Header dropdown initialized');
});
