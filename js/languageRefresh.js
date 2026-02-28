/**
 * GLOBAL LANGUAGE REFRESH SYSTEM
 * Provides auto-refresh functionality for all content when language changes
 */

// Per-callback debounce timeouts
const languageChangeHandlers = new Map();
let languageRefreshListenersAttached = false;
let lastLanguageEvent = { code: '', at: 0 };
const LANGUAGE_EVENT_DEDUPE_MS = 350;

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
      const nextCode = String(language || '').trim().toLowerCase();
      if (!nextCode) {
        return;
      }

      const now = Date.now();
      if (
        lastLanguageEvent.code === nextCode &&
        (now - lastLanguageEvent.at) < LANGUAGE_EVENT_DEDUPE_MS
      ) {
        return;
      }

      lastLanguageEvent = { code: nextCode, at: now };

      languageChangeHandlers.forEach((entry) => {
        if (!entry || typeof entry.callback !== 'function') return;
        if (entry.timeoutId) {
          clearTimeout(entry.timeoutId);
        }
        entry.timeoutId = setTimeout(() => {
          entry.callback(nextCode);
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

}

// Export globally
window.registerLanguageChangeHandler = registerLanguageChangeHandler;
