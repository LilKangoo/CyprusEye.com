/**
 * Footer Referral - CyprusEye
 * Handles referral sharing in footer (only for logged-in users)
 */

const SHARE_TEXT = "🌴 Dołącz do CyprusEye Quest & Travel przez mój link polecający i odkryj Cypr jak nigdy wcześniej!";
const SHARE_TEXT_EN = "🌴 Join us in the CyprusEye Quest & Travel and explore Cyprus like never before!";

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
    
    // Show success feedback
    const originalHTML = button.innerHTML;
    button.innerHTML = '<span>✓</span> <span>Skopiowano!</span>';
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
 * Setup auth state listener to show/hide referral on login/logout
 */
function setupAuthListener() {
  waitForSupabase(() => {
    const supabase = window.getSupabase();
    if (!supabase) return;
    
    supabase.auth.onAuthStateChange((event, session) => {
      console.log('Footer referral: auth state changed =', event);
      
      if (event === 'SIGNED_IN' && session?.user) {
        // User just logged in - show referral
        initFooterReferral();
      } else if (event === 'SIGNED_OUT') {
        // User logged out - hide referral
        const container = document.getElementById('footerReferral');
        if (container) container.style.display = 'none';
      }
    });
  });
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initFooterReferral();
    setupAuthListener();
  });
} else {
  initFooterReferral();
  setupAuthListener();
}
