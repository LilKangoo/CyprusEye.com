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
  
  if (!deferredPrompt) {
    console.log('[PWA] Native prompt not available - showing instructions');
    showInstallInstructions();
    return;
  }

  try {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] Install prompt outcome:', outcome);
    
    if (outcome === 'accepted') {
      deferredPrompt = null;
    }
  } catch (error) {
    console.error('[PWA] Install prompt error:', error);
    showInstallInstructions();
  }
}

/**
 * Show manual install instructions
 */
function showInstallInstructions() {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  
  let message = '';
  
  if (isIOS) {
    message = '📱 Aby zainstalować:\n1. Kliknij przycisk Udostępnij (⬆️)\n2. Wybierz "Dodaj do ekranu głównego"';
  } else if (isMobile) {
    message = '📱 Aby zainstalować:\n1. Otwórz menu przeglądarki (⋮)\n2. Wybierz "Dodaj do ekranu głównego"';
  } else {
    message = '💻 Aby zainstalować:\n1. Sprawdź ikonę w pasku adresu\n2. Lub otwórz menu przeglądarki\n3. Wybierz "Zainstaluj CyprusEye"';
  }
  
  alert(message);
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
