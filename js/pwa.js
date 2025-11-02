/**
 * PWA Registration and Update Handling
 */

let swRegistration = null;
let updateAvailable = false;

/**
 * Register service worker
 */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('[PWA] Service Workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/',
    });

    swRegistration = registration;

    console.log('[PWA] Service Worker registered:', registration.scope);

    // Check for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      console.log('[PWA] New service worker found');

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          updateAvailable = true;
          console.log('[PWA] Update available');
          showUpdateNotification();
        }
      });
    });

    // Check for updates periodically
    setInterval(() => {
      registration.update();
    }, 60 * 60 * 1000); // Check every hour

    return registration;
  } catch (error) {
    console.error('[PWA] Service Worker registration failed:', error);
    return null;
  }
}

/**
 * Show update notification
 */
function showUpdateNotification() {
  if (typeof window.showToast === 'function') {
    window.showToast('Nowa wersja dostępna! Odśwież stronę aby zaktualizować.', {
      type: 'info',
      duration: 10000,
      closable: true,
    });
  } else {
    console.log('[PWA] Update available - please refresh');
  }
}

/**
 * Skip waiting and activate new service worker
 */
export function updateServiceWorker() {
  if (!swRegistration || !swRegistration.waiting) {
    return;
  }

  swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });

  // Reload page when new SW is activated
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}

/**
 * Check if app is running in standalone mode (installed)
 */
export function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://')
  );
}

/**
 * Show install prompt
 */
let deferredPrompt = null;

export function setupInstallPrompt() {
  // Capture the beforeinstallprompt event
  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('[PWA] 🎯 beforeinstallprompt event fired!');
    
    // Prevent default browser mini-infobar
    e.preventDefault();
    
    // Store the event for later use
    deferredPrompt = e;
    
    console.log('[PWA] ✅ Install prompt captured and ready!');
    console.log('[PWA] Button will now trigger native install dialog');
    
    // Show the install button
    showInstallButton();
  });

  // Handle successful installation
  window.addEventListener('appinstalled', (e) => {
    console.log('[PWA] 🎉 App successfully installed!');
    console.log('[PWA] Event:', e);
    
    // Clear the deferred prompt
    deferredPrompt = null;
    
    // Hide the install button
    hideInstallButton();
  });
  
  // Log current state for debugging
  console.log('[PWA] Install prompt listeners registered');
  console.log('[PWA] Waiting for beforeinstallprompt event...');
}

/**
 * Show install button
 */
function showInstallButton() {
  const container = document.getElementById('pwa-header-container');
  const installBtn = document.getElementById('pwa-install-btn');
  
  if (container) {
    container.style.display = 'flex';
  }
  
  if (installBtn) {
    installBtn.style.display = 'inline-flex';
    installBtn.disabled = false;
    console.log('[PWA] Install button enabled');
  }
}

/**
 * Hide install button
 */
function hideInstallButton() {
  const container = document.getElementById('pwa-header-container');
  
  if (container) {
    container.style.display = 'none';
  }
  
  console.log('[PWA] Install button hidden (app already installed)');
}

/**
 * Prompt user to install - DIRECT NATIVE PROMPT ONLY
 */
export async function promptInstall(event) {
  if (event) {
    event.preventDefault();
  }
  
  console.log('[PWA] 🚀 Install button clicked!');
  console.log('[PWA] Deferred prompt available:', !!deferredPrompt);
  
  // ONLY try native prompt - NO fallback messages!
  if (deferredPrompt) {
    try {
      console.log('[PWA] ✅ Showing native install dialog...');
      
      // Show the native install prompt
      await deferredPrompt.prompt();
      
      // Wait for user's choice
      const { outcome } = await deferredPrompt.userChoice;
      
      console.log(`[PWA] 📱 User choice: ${outcome}`);
      
      if (outcome === 'accepted') {
        console.log('[PWA] 🎉 Installation accepted!');
        deferredPrompt = null;
      } else {
        console.log('[PWA] ❌ Installation dismissed');
      }
      
    } catch (error) {
      console.error('[PWA] ⚠️ Error showing prompt:', error);
      console.log('[PWA] Error details:', {
        name: error.name,
        message: error.message,
        hasDeferredPrompt: !!deferredPrompt
      });
    }
  } else {
    // Native prompt not available - just log, NO user messages
    console.log('[PWA] ⚠️ Native prompt not available yet');
    console.log('[PWA] This is normal - prompt will be available after page fully loads with HTTPS');
    console.log('[PWA] Current URL protocol:', window.location.protocol);
    console.log('[PWA] Service Worker registered:', !!navigator.serviceWorker.controller);
  }
}

/**
 * Initialize PWA features
 */
export function initializePWA() {
  console.log('[PWA] Initializing...');

  // Register service worker
  registerServiceWorker();

  // Setup install prompt
  setupInstallPrompt();

  // Setup button click handler
  const installBtn = document.getElementById('pwa-install-btn');
  if (installBtn) {
    installBtn.addEventListener('click', promptInstall);
    console.log('[PWA] Button click handler attached');
  }

  // Check if already installed
  if (isStandalone()) {
    console.log('[PWA] Running in standalone mode - hiding install button');
    document.body.dataset.standalone = 'true';
    hideInstallButton();
  } else {
    console.log('[PWA] Not installed - showing install button');
    showInstallButton();
  }

  console.log('[PWA] Initialized');
}

// Auto-initialize if loaded as module
if (typeof window !== 'undefined') {
  window.addEventListener('load', initializePWA);
}
