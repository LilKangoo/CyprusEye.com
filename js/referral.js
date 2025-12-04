/**
 * Referral System - CyprusEye
 * Handles referral link capture and storage
 */

const REFERRAL_STORAGE_KEY = 'cypruseye_referral_code';
const REFERRAL_EXPIRY_DAYS = 14;

/**
 * Capture referral code from URL parameter (?ref=username)
 * Called on every page load
 */
export function captureReferralFromUrl() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    
    if (refCode && refCode.trim()) {
      const cleanCode = refCode.trim();
      
      // Store with expiry timestamp
      const referralData = {
        code: cleanCode,
        capturedAt: Date.now(),
        expiresAt: Date.now() + (REFERRAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
      };
      
      localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(referralData));
      console.log(`✅ Referral code captured: ${cleanCode}`);
      
      // Clean URL (remove ref parameter)
      const url = new URL(window.location.href);
      url.searchParams.delete('ref');
      window.history.replaceState({}, '', url.toString());
      
      return cleanCode;
    }
  } catch (err) {
    console.warn('Could not capture referral code:', err);
  }
  return null;
}

/**
 * Get stored referral code if not expired
 */
export function getStoredReferralCode() {
  try {
    const stored = localStorage.getItem(REFERRAL_STORAGE_KEY);
    if (!stored) return null;
    
    const referralData = JSON.parse(stored);
    
    // Check if expired
    if (referralData.expiresAt && Date.now() > referralData.expiresAt) {
      localStorage.removeItem(REFERRAL_STORAGE_KEY);
      console.log('⏰ Referral code expired, removed');
      return null;
    }
    
    return referralData.code;
  } catch (err) {
    console.warn('Could not get stored referral code:', err);
    return null;
  }
}

/**
 * Clear stored referral code (after successful registration)
 */
export function clearStoredReferralCode() {
  try {
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
    console.log('🗑️ Referral code cleared');
  } catch (err) {
    console.warn('Could not clear referral code:', err);
  }
}

/**
 * Process referral after user registration
 * Links the new user to the referrer
 */
export async function processReferralAfterRegistration(newUserId) {
  const referralCode = getStoredReferralCode();
  if (!referralCode) return null;
  
  try {
    const sb = window.getSupabase();
    if (!sb) {
      console.warn('Supabase not available for referral processing');
      return null;
    }
    
    // Find referrer by username
    const { data: referrer, error: referrerError } = await sb
      .from('profiles')
      .select('id, username')
      .eq('username', referralCode)
      .single();
    
    if (referrerError || !referrer) {
      console.warn('Referrer not found:', referralCode);
      clearStoredReferralCode();
      return null;
    }
    
    // Don't allow self-referral
    if (referrer.id === newUserId) {
      console.warn('Self-referral not allowed');
      clearStoredReferralCode();
      return null;
    }
    
    // Create referral record
    const { error: insertError } = await sb
      .from('referrals')
      .insert({
        referrer_id: referrer.id,
        referred_id: newUserId,
        status: 'pending'
      });
    
    if (insertError) {
      // Might be duplicate (user already has referrer)
      console.warn('Could not create referral:', insertError);
      clearStoredReferralCode();
      return null;
    }
    
    // Update new user's profile with referred_by
    await sb
      .from('profiles')
      .update({ referred_by: referrer.id })
      .eq('id', newUserId);
    
    console.log(`✅ Referral processed: ${referralCode} -> new user`);
    clearStoredReferralCode();
    
    // Auto-confirm the referral (awards XP to referrer)
    try {
      const { data: confirmResult } = await sb.rpc('confirm_referral', {
        referral_id: (await sb
          .from('referrals')
          .select('id')
          .eq('referred_id', newUserId)
          .single()
        ).data?.id
      });
      console.log('Referral confirmation:', confirmResult);
    } catch (confirmErr) {
      console.warn('Auto-confirm failed, will be confirmed manually:', confirmErr);
    }
    
    return referrer;
  } catch (err) {
    console.error('Error processing referral:', err);
    clearStoredReferralCode();
    return null;
  }
}

/**
 * Generate referral link for current user
 */
export function generateReferralLink(username) {
  if (!username) return '';
  const baseUrl = window.location.origin || 'https://cypruseye.com';
  return `${baseUrl}/?ref=${encodeURIComponent(username)}`;
}

/**
 * Initialize referral capture on page load
 */
export function initReferralCapture() {
  // Run on DOMContentLoaded or immediately if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', captureReferralFromUrl);
  } else {
    captureReferralFromUrl();
  }
}

// Auto-initialize
initReferralCapture();
