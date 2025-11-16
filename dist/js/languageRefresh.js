/**
 * GLOBAL LANGUAGE REFRESH SYSTEM
 * Provides auto-refresh functionality for all content when language changes
 */

// Global debounce timeout
let globalLanguageChangeTimeout = null;

/**
 * Register a callback to be called when language changes
 * @param {Function} callback - Function to call on language change (receives language code)
 * @param {Number} debounceMs - Debounce delay in milliseconds (default: 200)
 */
function registerLanguageChangeHandler(callback, debounceMs = 200) {
  if (typeof callback !== 'function') {
    console.error('registerLanguageChangeHandler: callback must be a function');
    return;
  }

  // Handler function with debounce
  const handleLanguageChange = (language) => {
    console.log('🌐 Language changed to:', language);
    
    // Clear previous timeout
    if (globalLanguageChangeTimeout) {
      clearTimeout(globalLanguageChangeTimeout);
    }
    
    // Debounce execution
    globalLanguageChangeTimeout = setTimeout(() => {
      console.log('🔄 Executing language change callback');
      callback(language);
    }, debounceMs);
  };
  
  // Listen for both language change events
  // languageSwitcher.js uses 'languageChanged' on window
  window.addEventListener('languageChanged', (e) => {
    handleLanguageChange(e.detail.language);
  });
  
  // i18n.js uses 'wakacjecypr:languagechange' on document
  document.addEventListener('wakacjecypr:languagechange', (e) => {
    handleLanguageChange(e.detail.language);
  });
  
  console.log('✅ Language change handler registered');
}

// Export globally
window.registerLanguageChangeHandler = registerLanguageChangeHandler;

console.log('✅ Global Language Refresh System loaded');
