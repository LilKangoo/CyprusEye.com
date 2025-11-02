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
  const installBtn = document.getElementById('pwa-install-btn');
  if (installBtn) {
    installBtn.hidden = false;
    installBtn.addEventListener('click', promptInstall);
  }
}

/**
 * Hide install button
 */
function hideInstallButton() {
  const installBtn = document.getElementById('pwa-install-btn');
  if (installBtn) {
    installBtn.hidden = true;
  }
}

/**
 * Prompt user to install
 */
export async function promptInstall() {
  if (!deferredPrompt) {
    console.log('[PWA] Install prompt not available');
    return;
  }

  deferredPrompt.prompt();

  const { outcome } = await deferredPrompt.userChoice;
  console.log('[PWA] Install prompt outcome:', outcome);

  deferredPrompt = null;
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

  // Log standalone mode
  if (isStandalone()) {
    console.log('[PWA] Running in standalone mode');
    document.body.dataset.standalone = 'true';
  }

  console.log('[PWA] Initialized');
}

// Auto-initialize if loaded as module
if (typeof window !== 'undefined') {
  window.addEventListener('load', initializePWA);
}
