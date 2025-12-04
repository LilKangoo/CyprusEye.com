/**
 * Footer Referral - CyprusEye
 * Handles referral sharing in footer (only for logged-in users)
 */

const SHARE_TEXT = "🌴 Dołącz do CyprusEye Quest & Travel przez mój link polecający i odkryj Cypr jak nigdy wcześniej!";
const SHARE_TEXT_EN = "🌴 Join us in the CyprusEye Quest & Travel and explore Cyprus like never before!";

/**
 * Update translations for footer referral elements
 * @param {string} forceLang - Optional language code to force (from event)
 */
function updateFooterReferralTranslations(forceLang) {
  const container = document.getElementById('footerReferral');
  if (!container) {
    console.log('🌐 Footer referral: container not found, skipping translation update');
    return;
  }
  
  // Get current language - prefer forceLang, then document.documentElement.lang, then appI18n
  const currentLang = forceLang || document.documentElement.lang || window.appI18n?.language || 'pl';
  console.log('🌐 Footer referral: Updating translations for lang =', currentLang);
  
  // Update text elements with data-i18n attributes
  const inviteText = container.querySelector('[data-i18n="footer.referral.invite"]');
  const copyText = container.querySelector('[data-i18n="footer.referral.copy"]');
  const fbText = container.querySelector('[data-i18n="footer.referral.facebook"]');
  
  const inviteTranslation = getTranslationForLang('footer.referral.invite', currentLang, 'Zaproś znajomych i zdobądź bonusy!');
  const copyTranslation = getTranslationForLang('footer.referral.copy', currentLang, 'Kopiuj link');
  const fbTranslation = getTranslationForLang('footer.referral.facebook', currentLang, 'Facebook');
  
  console.log('🌐 Footer referral translations:', { lang: currentLang, invite: inviteTranslation, copy: copyTranslation, fb: fbTranslation });
  
  if (inviteText) inviteText.textContent = inviteTranslation;
  if (copyText) copyText.textContent = copyTranslation;
  if (fbText) fbText.textContent = fbTranslation;
}

/**
 * Get translation for specific language
 */
function getTranslationForLang(key, lang, fallback) {
  try {
    const i18n = window.appI18n;
    if (i18n && i18n.translations) {
      const langData = i18n.translations[lang];
      
      if (!langData) {
        console.log('🌐 No translation data for lang:', lang);
        return fallback;
      }
      
      // First try: flat key (key with dots as literal string)
      if (typeof langData[key] === 'string') {
        return langData[key];
      }
      
      // Second try: nested lookup
      const keys = key.split('.');
      let value = langData;
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          value = undefined;
          break;
        }
      }
      if (typeof value === 'string') return value;
      
      // Third try: search in all nested objects for flat key
      const searchFlat = (obj) => {
        if (!obj || typeof obj !== 'object') return null;
        if (typeof obj[key] === 'string') return obj[key];
        for (const k of Object.keys(obj)) {
          if (typeof obj[k] === 'object') {
            const found = searchFlat(obj[k]);
            if (found) return found;
          }
        }
        return null;
      };
      const found = searchFlat(langData);
      if (found) return found;
    }
  } catch (e) {
    console.warn('Footer referral getTranslationForLang error:', e);
  }
  return fallback;
}

/**
 * Wait for Supabase to be available
 */
function waitForSupabase(callback, maxAttempts = 20) {
  let attempts = 0;
  const check = () => {
    attempts++;
    if (window.getSupabase) {
      callback();
    } else if (attempts < maxAttempts) {
      setTimeout(check, 250);
    } else {
      console.log('Footer referral: Supabase not available');
    }
  };
  check();
}

/**
 * Initialize footer referral on page load
 */
function initFooterReferral() {
  const container = document.getElementById('footerReferral');
  const copyBtn = document.getElementById('footerCopyRef');
  const fbBtn = document.getElementById('footerShareFb');
  
  if (!container) {
    console.log('Footer referral: container not found');
    return;
  }
  
  // Wait for Supabase then check user
  waitForSupabase(() => {
    checkUserAndShowReferral(container, copyBtn, fbBtn);
  });
}

/**
 * Check user login status and setup buttons
 */
async function checkUserAndShowReferral(container, copyBtn, fbBtn) {
  try {
    const supabase = window.getSupabase();
    if (!supabase) {
      console.log('Footer referral: No supabase client');
      return;
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    console.log('Footer referral: user =', user ? user.email : 'not logged in');
    
    if (!user) {
      // Not logged in - keep hidden
      return;
    }
    
    // Get username from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();
    
    const username = profile?.username;
    console.log('Footer referral: username =', username);
    
    // Check if username is valid (not UUID)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(username);
    
    if (!username || isUUID) {
      container.style.display = 'none';
      return;
    }
    
    // Show referral section
    container.style.display = 'block';
    
    // Apply translations to the section
    updateFooterReferralTranslations();
    
    const refLink = `https://cypruseye.com/?ref=${encodeURIComponent(username)}`;
    
    // Setup copy button
    if (copyBtn) {
      copyBtn.addEventListener('click', () => copyRefLink(copyBtn, refLink));
    }
    
    // Setup Facebook button
    if (fbBtn) {
      fbBtn.addEventListener('click', () => shareOnFacebook(refLink));
    }
    
  } catch (err) {
    console.warn('Footer referral error:', err);
    container.style.display = 'none';
  }
}

/**
 * Copy referral link to clipboard
 */
async function copyRefLink(button, link) {
  try {
    await navigator.clipboard.writeText(link);
    
    // Show success feedback with translated text
    const originalHTML = button.innerHTML;
    const currentLang = document.documentElement.lang || 'pl';
    const copiedText = getTranslationForLang('footer.referral.copied', currentLang, 'Skopiowano!');
    button.innerHTML = `<span>✓</span> <span>${copiedText}</span>`;
    button.classList.add('btn-success');
    
    setTimeout(() => {
      button.innerHTML = originalHTML;
      button.classList.remove('btn-success');
    }, 2000);
    
  } catch (err) {
    console.error('Could not copy:', err);
  }
}

/**
 * Share on Facebook with pre-filled text
 */
function shareOnFacebook(refLink) {
  // Detect language
  const lang = document.documentElement.lang || 'pl';
  const text = lang === 'en' ? SHARE_TEXT_EN : SHARE_TEXT;
  
  // Facebook sharer URL with quote
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(refLink)}&quote=${encodeURIComponent(text)}`;
  
  // Open in popup
  window.open(fbUrl, 'facebook-share', 'width=600,height=400,menubar=no,toolbar=no');
}

/**
 * Show referral section with given username (no supabase call needed)
 */
function showReferralWithUsername(username) {
  const container = document.getElementById('footerReferral');
  const copyBtn = document.getElementById('footerCopyRef');
  const fbBtn = document.getElementById('footerShareFb');
  
  if (!container || !username) return;
  
  // Check if username is valid (not UUID)
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(username);
  if (isUUID) {
    console.log('Footer referral: username is UUID, hiding');
    return;
  }
  
  const refLink = `https://cypruseye.com/?ref=${encodeURIComponent(username)}`;
  console.log('Footer referral: showing with link =', refLink);
  
  // Show referral section
  container.style.display = 'block';
  
  // Apply translations to the section
  updateFooterReferralTranslations();
  
  // Setup copy button
  if (copyBtn) {
    copyBtn.onclick = () => copyRefLink(copyBtn, refLink);
  }
  
  // Setup Facebook button
  if (fbBtn) {
    fbBtn.onclick = () => shareOnFacebook(refLink);
  }
}

/**
 * Setup auth state listener to show/hide referral on login/logout
 */
function setupAuthListener() {
  // Listen for custom CyprusEye auth event (fires immediately on login)
  document.addEventListener('ce-auth:state', (e) => {
    const state = e.detail;
    console.log('Footer referral: ce-auth:state =', state?.status, 'profile =', state?.profile?.username);
    
    if (state?.status === 'authenticated' && state?.profile?.username) {
      // User logged in - show referral immediately using profile from state
      showReferralWithUsername(state.profile.username);
    } else if (state?.status === 'anonymous') {
      // User logged out - hide referral
      const container = document.getElementById('footerReferral');
      if (container) container.style.display = 'none';
    }
  });
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initFooterReferral();
    setupAuthListener();
    setupLanguageListener();
  });
} else {
  initFooterReferral();
  setupAuthListener();
  setupLanguageListener();
}

/**
 * Setup listener for language changes
 */
function setupLanguageListener() {
  // Listen for languageChanged event from languageSwitcher.js (on window)
  window.addEventListener('languageChanged', (e) => {
    const lang = e.detail?.language;
    console.log('🌐 Footer referral: languageChanged event, lang =', lang);
    updateFooterReferralTranslations(lang);
  });
  
  // Also listen for wakacjecypr:languagechange on document (backup)
  document.addEventListener('wakacjecypr:languagechange', (e) => {
    const lang = e.detail?.language;
    console.log('🌐 Footer referral: wakacjecypr:languagechange event, lang =', lang);
    updateFooterReferralTranslations(lang);
  });
  
  console.log('✅ Footer referral: Language listeners registered');
}
