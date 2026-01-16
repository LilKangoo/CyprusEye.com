/**
 * Referral System - CyprusEye
 * Handles referral link capture and storage
 */

const REFERRAL_STORAGE_KEY = 'cypruseye_referral_code';
const REFERRAL_EXPIRY_DAYS = 14;

// IMMEDIATE CAPTURE - runs as soon as script parses, before anything else can redirect
(function immediateCapture() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    
    if (refCode && refCode.trim()) {
      const cleanCode = refCode.trim();
      
      const referralData = {
        code: cleanCode,
        capturedAt: Date.now(),
        expiresAt: Date.now() + (REFERRAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
      };
      
      localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(referralData));
      console.log(`✅ [IMMEDIATE] Referral code captured and saved: ${cleanCode}`);
    }
  } catch (e) {
    console.warn('Immediate referral capture failed:', e);
  }
})();

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
      
      // Clean URL (remove ref parameter) - delay to ensure storage completes
      setTimeout(() => {
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('ref');
          window.history.replaceState({}, '', url.toString());
        } catch (e) {}
      }, 150);
      
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
 * Wait for profile to exist in database
 */
async function waitForProfile(sb, userId, maxAttempts = 5) {
  for (let i = 0; i < maxAttempts; i++) {
    const { data } = await sb
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    
    if (data) return true;
    
    // Wait before next attempt (500ms, 1s, 1.5s, 2s, 2.5s)
    await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
  }
  return false;
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

    try {
      const { data: sessionData } = await sb.auth.getSession();
      const sessionUserId = sessionData?.session?.user?.id;
      if (!sessionUserId) {
        console.log('ℹ️ No auth session yet, deferring referral processing');
        return null;
      }
    } catch (_e) {
      return null;
    }
    
    // Wait for the profile to be created by the database trigger
    console.log('⏳ Waiting for profile to be created...');
    const profileExists = await waitForProfile(sb, newUserId);
    if (!profileExists) {
      console.warn('Profile not created in time, saving referral for later');
      // Don't clear the code - user might need to retry
      return null;
    }
    console.log('✅ Profile found, processing referral...');

    try {
      const { data: existingProfile, error: existingProfileError } = await sb
        .from('profiles')
        .select('id, referred_by')
        .eq('id', newUserId)
        .maybeSingle();

      if (!existingProfileError && existingProfile?.referred_by) {
        console.log('ℹ️ User already has referred_by set, skipping referral link');
        clearStoredReferralCode();
        return null;
      }
    } catch (_e) {
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
    try {
      const { error: updateError } = await sb
        .from('profiles')
        .update({ referred_by: referrer.id })
        .eq('id', newUserId);
      if (updateError) {
        console.warn('Could not set referred_by on profile:', updateError);
      }
    } catch (updateErr) {
      console.warn('Could not set referred_by on profile:', updateErr);
    }
    
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
