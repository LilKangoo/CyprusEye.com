/**
 * GLOBAL LANGUAGE REFRESH SYSTEM
 * Provides auto-refresh functionality for all content when language changes
 */

// Per-callback debounce timeouts
const languageChangeHandlers = new Map();
let languageRefreshListenersAttached = false;

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

  if (!languageChangeHandlers.has(callback)) {
    languageChangeHandlers.set(callback, { callback, debounceMs, timeoutId: null });
  } else {
    const entry = languageChangeHandlers.get(callback);
    if (entry) entry.debounceMs = debounceMs;
  }

  if (!languageRefreshListenersAttached) {
    languageRefreshListenersAttached = true;

    const handleLanguageChange = (language) => {
      console.log('🌐 Language changed to:', language);

      languageChangeHandlers.forEach((entry) => {
        if (!entry || typeof entry.callback !== 'function') return;
        if (entry.timeoutId) {
          clearTimeout(entry.timeoutId);
        }
        entry.timeoutId = setTimeout(() => {
          console.log('🔄 Executing language change callback');
          entry.callback(language);
        }, entry.debounceMs);
      });
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
  }

  console.log('✅ Language change handler registered');
}

// Export globally
window.registerLanguageChangeHandler = registerLanguageChangeHandler;

console.log('✅ Global Language Refresh System loaded');
