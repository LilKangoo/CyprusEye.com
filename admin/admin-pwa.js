const ADMIN_SW_URL = '/admin/sw.js?v=20260209_2';

function isIos() {
  const ua = navigator.userAgent || '';
  return /iphone|ipad|ipod/i.test(ua);
}

function isStandalone() {
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  return Boolean((navigator).standalone);
}

function ensureUpdateBanner() {
  let banner = document.getElementById('adminPwaUpdateBanner');
  if (banner) return banner;

  banner = document.createElement('div');
  banner.id = 'adminPwaUpdateBanner';
  banner.className = 'admin-pwa-update-banner';
  banner.hidden = true;
  banner.innerHTML = `
    <div class="admin-pwa-update-banner__inner">
      <div class="admin-pwa-update-banner__text">Update available</div>
      <button type="button" class="btn-secondary admin-pwa-update-banner__btn" id="adminPwaReloadBtn">Reload</button>
    </div>
  `;
  document.body.appendChild(banner);
  return banner;
}

function showUpdateBanner(registration) {
  const banner = ensureUpdateBanner();
  banner.hidden = false;

  const btn = document.getElementById('adminPwaReloadBtn');
  if (btn && !btn.dataset.bound) {
    btn.dataset.bound = 'true';
    btn.addEventListener('click', async () => {
      try {
        const waiting = registration?.waiting;
        if (waiting) {
          waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      } catch (_e) {
      }

      window.location.reload();
    });
  }
}

function setupInstallUi() {
  const installBtn = document.getElementById('btnAdminInstallApp');
  const iosHint = document.getElementById('adminIosInstallHint');
  const statusEl = document.getElementById('adminInstallStatus');

  let deferredPrompt = null;

  const setStatus = (text) => {
    if (statusEl) statusEl.textContent = text;
  };

  const updateUi = () => {
    const standalone = isStandalone();

    if (standalone) {
      if (installBtn) installBtn.hidden = true;
      if (iosHint) iosHint.hidden = true;
      setStatus('Installed');
      return;
    }

    if (isIos()) {
      if (installBtn) installBtn.hidden = true;
      if (iosHint) iosHint.hidden = false;
      setStatus('Not installed');
      return;
    }

    if (installBtn) installBtn.hidden = !deferredPrompt;
    if (iosHint) iosHint.hidden = true;
    setStatus('Not installed');
  };

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    updateUi();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    updateUi();
  });

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      try {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
      } catch (_e) {
      }
      deferredPrompt = null;
      updateUi();
    });
  }

  updateUi();
}

async function registerAdminServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  if (!window.isSecureContext) return null;

  try {
    const registration = await navigator.serviceWorker.register(ADMIN_SW_URL, { scope: '/admin/' });

    if (registration.waiting) {
      showUpdateBanner(registration);
    }

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateBanner(registration);
        }
      });
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      const banner = document.getElementById('adminPwaUpdateBanner');
      if (banner) banner.hidden = true;
    });

    return registration;
  } catch (e) {
    return null;
  }
}

function bootAdminPwa() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootAdminPwa);
    return;
  }

  setupInstallUi();
  registerAdminServiceWorker();
}

bootAdminPwa();
