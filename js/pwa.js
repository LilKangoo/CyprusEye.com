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
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log('[PWA] Install prompt available');
    showInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed');
    deferredPrompt = null;
    hideInstallButton();
  });
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
 * Prompt user to install
 */
export async function promptInstall() {
  console.log('[PWA] Install button clicked!');
  
  // Try native prompt first
  if (deferredPrompt) {
    try {
      console.log('[PWA] Showing native install prompt...');
      deferredPrompt.prompt();
      
      const { outcome } = await deferredPrompt.userChoice;
      console.log('[PWA] Install prompt outcome:', outcome);
      
      if (outcome === 'accepted') {
        console.log('[PWA] User accepted installation!');
        deferredPrompt = null;
        // Button will auto-hide on 'appinstalled' event
      } else {
        console.log('[PWA] User dismissed installation');
      }
      return;
    } catch (error) {
      console.error('[PWA] Native prompt error:', error);
    }
  }
  
  // Fallback: Try to trigger browser's native install
  console.log('[PWA] Deferred prompt not available, checking alternatives...');
  
  // For some browsers, the prompt might be available via other means
  if (window.BeforeInstallPromptEvent) {
    console.log('[PWA] Browser supports install prompts, waiting for event...');
  }
  
  // Last resort: minimal guidance
  console.log('[PWA] Native install not available - user needs to use browser menu');
  showMinimalInstallHint();
}

/**
 * Show minimal install hint (only when native prompt unavailable)
 */
function showMinimalInstallHint() {
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isMobile = /Android/i.test(navigator.userAgent);
  
  // Very minimal, non-intrusive hint
  if (isIOS) {
    console.log('[PWA] iOS detected - user should use Share → Add to Home Screen');
  } else if (isMobile) {
    console.log('[PWA] Android detected - user should use browser menu');
  } else {
    console.log('[PWA] Desktop detected - user should use browser install icon');
  }
  
  // No alert! Just console message for developers
  // Native prompt should work on production with HTTPS
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
