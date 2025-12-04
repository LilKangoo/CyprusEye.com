/**
 * Footer Referral - CyprusEye
 * Handles referral sharing in footer
 */

const SHARE_TEXT = "🌴 Dołącz do CyprusEye i odkryj najlepsze miejsca na Cyprze! Planuj wakacje, zdobywaj punkty i wygrywaj nagrody!";
const SHARE_TEXT_EN = "🌴 Join CyprusEye and discover the best places in Cyprus! Plan your vacation, earn points and win prizes!";

/**
 * Initialize footer referral on page load
 */
function initFooterReferral() {
  const container = document.getElementById('footerReferral');
  const copyBtn = document.getElementById('footerCopyRef');
  const fbBtn = document.getElementById('footerShareFb');
  
  if (!container) return;
  
  // Check if user is logged in
  checkUserAndShowReferral(container, copyBtn, fbBtn);
}

/**
 * Check user login status and setup buttons
 */
async function checkUserAndShowReferral(container, copyBtn, fbBtn) {
  try {
    const supabase = window.getSupabase ? window.getSupabase() : null;
    if (!supabase) {
      container.style.display = 'none';
      return;
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      // Not logged in - hide or show login prompt
      container.style.display = 'none';
      return;
    }
    
    // Get username from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();
    
    const username = profile?.username;
    
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

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFooterReferral);
} else {
  initFooterReferral();
}
