/**
 * Mobile Tabbar Navigation
 * Handles clicks on mobile bottom navigation bar
 */

(function() {
  'use strict';

  /**
   * Initialize mobile tabbar navigation
   */
  function initMobileTabbar() {
    const tabbar = document.querySelector('.mobile-tabbar');
    if (!tabbar) {
      console.warn('Mobile tabbar not found');
      return;
    }

    // Add click handlers to all buttons with data-page-url
    const buttons = tabbar.querySelectorAll('.mobile-tabbar-btn[data-page-url]');
    console.log(`🔧 Mobile tabbar: Found ${buttons.length} navigation buttons`);

    buttons.forEach(button => {
      const pageUrl = button.dataset.pageUrl;
      if (!pageUrl) return;

      button.addEventListener('click', (e) => {
        e.preventDefault();
        console.log(`📱 Mobile tabbar: Navigating to ${pageUrl}`);
        
        // Navigate to the page
        window.location.href = pageUrl;
      });

      // Make button focusable and keyboard accessible
      button.setAttribute('role', 'link');
      button.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          window.location.href = pageUrl;
        }
      });
    });

    console.log('✅ Mobile tabbar initialized');
  }

  /**
   * Set active button based on current page
   */
  function setActiveButton() {
    const tabbar = document.querySelector('.mobile-tabbar');
    if (!tabbar) return;

    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const buttons = tabbar.querySelectorAll('.mobile-tabbar-btn');

    buttons.forEach(button => {
      const pageUrl = button.dataset.pageUrl;
      const isActive = pageUrl && pageUrl.includes(currentPage.replace('.html', ''));
      
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initMobileTabbar();
      setActiveButton();
    });
  } else {
    initMobileTabbar();
    setActiveButton();
  }
})();
