/**
 * Header Scroll Synchronization
 * Synchronizes the horizontal scroll position of the top tabs and bottom chips
 * in the mobile header navigation.
 */

(function() {
  function initHeaderScroll() {
    const tabs = document.querySelector('.nav-modern__tabs');
    const chips = document.querySelector('.nav-modern__chips');

    if (!tabs || !chips) {
        console.warn('Header scroll elements not found');
        return;
    }

    console.log('✅ Header scroll synchronization initialized');

    let isSyncing = false;

    function sync(source, target) {
      // If we are already in a sync operation initiated by the other element, skip
      if (isSyncing) return;

      // If positions are already close enough, don't update.
      // This breaks the loop if the scroll event fires later asynchronously.
      if (Math.abs(source.scrollLeft - target.scrollLeft) < 2) return;

      isSyncing = true;
      target.scrollLeft = source.scrollLeft;
      
      // Reset the flag after a short delay to allow the scroll event to fire and be ignored
      window.requestAnimationFrame(() => {
        isSyncing = false;
      });
    }

    tabs.addEventListener('scroll', () => sync(tabs, chips), { passive: true });
    chips.addEventListener('scroll', () => sync(chips, tabs), { passive: true });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeaderScroll);
  } else {
    initHeaderScroll();
  }
})();
