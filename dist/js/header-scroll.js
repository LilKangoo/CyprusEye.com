/**
 * Header Scroll Synchronization
 * Synchronizes the horizontal scroll position of the top tabs and bottom chips
 * in the mobile header navigation.
 */

document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelector('.nav-modern__tabs');
  const chips = document.querySelector('.nav-modern__chips');

  if (!tabs || !chips) return;

  let activeSource = null;
  let scrollTimeout = null;

  // Function to handle scroll synchronization
  function syncScroll(source, target, sourceName) {
    if (activeSource !== null && activeSource !== sourceName) return;
    
    activeSource = sourceName;
    
    // Sync the scroll position
    if (target.scrollLeft !== source.scrollLeft) {
      target.scrollLeft = source.scrollLeft;
    }

    // Clear existing timeout
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }

    // Reset active source after scrolling stops
    scrollTimeout = setTimeout(() => {
      activeSource = null;
    }, 150);
  }

  // Add listeners
  tabs.addEventListener('scroll', () => syncScroll(tabs, chips, 'tabs'), { passive: true });
  chips.addEventListener('scroll', () => syncScroll(chips, tabs, 'chips'), { passive: true });
  
  console.log('✅ Header scroll synchronization initialized');
});
