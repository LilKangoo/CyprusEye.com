const PARTNERS_SW_URL = '/partners/sw.js?v=20260210_1';

let deferredPrompt = null;
let notifyInstallUi = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (typeof notifyInstallUi === 'function') notifyInstallUi();
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  if (typeof notifyInstallUi === 'function') notifyInstallUi();
});

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
  let banner = document.getElementById('partnerPwaUpdateBanner');
  if (banner) return banner;

  banner = document.createElement('div');
  banner.id = 'partnerPwaUpdateBanner';
  banner.className = 'admin-pwa-update-banner';
  banner.hidden = true;
  banner.innerHTML = `
    <div class="admin-pwa-update-banner__inner">
      <div class="admin-pwa-update-banner__text">Update available</div>
      <button type="button" class="btn-secondary admin-pwa-update-banner__btn" id="partnerPwaReloadBtn">Reload</button>
    </div>
  `;
  document.body.appendChild(banner);
  return banner;
}

function showUpdateBanner(registration) {
  const banner = ensureUpdateBanner();
  banner.hidden = false;

  const btn = document.getElementById('partnerPwaReloadBtn');
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
  const installBtn = document.getElementById('btnPartnerInstallApp');
  const hintEl = document.getElementById('partnerInstallHint');
  const statusEl = document.getElementById('partnerInstallStatus');

  const toast = (message) => {
    try {
      if (typeof window.showToast === 'function') {
        window.showToast(message, 'info', 6000);
      }
    } catch (_e) {
    }
  };

  const setStatus = (text) => {
    if (statusEl) statusEl.textContent = text;
  };

  const setHint = (html) => {
    if (!hintEl) return;
    const v = String(html || '').trim();
    if (!v) {
      hintEl.hidden = true;
      hintEl.innerHTML = '';
      return;
    }
    hintEl.hidden = false;
    hintEl.innerHTML = v;
  };

  const updateUi = () => {
    const standalone = isStandalone();

    if (standalone) {
      if (installBtn) installBtn.hidden = true;
      setHint('');
      setStatus('Installed');
      return;
    }

    if (isIos()) {
      if (installBtn) installBtn.hidden = false;
      setStatus('Not installed');
      setHint('On iPhone: open in Safari, tap <strong>Share</strong> → <strong>Add to Home Screen</strong>. Then open the app from the Home Screen.');
      return;
    }

    setStatus('Not installed');

    if (installBtn) installBtn.hidden = false;
    if (deferredPrompt) {
      setHint('Tap <strong>Install</strong> to add this app to your device.');
    } else {
      setHint('Tap <strong>Install</strong>. If no prompt appears, use your browser menu (e.g. <strong>Install app</strong> / <strong>Add to Home screen</strong>).');
    }
  };

  notifyInstallUi = updateUi;

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) {
        updateUi();
        if (isIos()) {
          toast('On iPhone: open in Safari → Share → Add to Home Screen.');
        } else {
          toast('If no install prompt appears, use your browser menu: “Install app” / “Add to Home screen”.');
        }
        try {
          if (hintEl) hintEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (_e) {
        }
        return;
      }
      try {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
      } catch (_e) {
      }
      deferredPrompt = null;
      updateUi();
    });
  }

  try {
    const mql = window.matchMedia ? window.matchMedia('(display-mode: standalone)') : null;
    if (mql && typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', updateUi);
    }
  } catch (_e) {
  }

  window.addEventListener('pageshow', updateUi);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) updateUi();
  });

  updateUi();
}

async function registerPartnersServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  if (!window.isSecureContext) return null;

  try {
    const registration = await navigator.serviceWorker.register(PARTNERS_SW_URL, { scope: '/partners/' });

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
      const banner = document.getElementById('partnerPwaUpdateBanner');
      if (banner) banner.hidden = true;
    });

    return registration;
  } catch (e) {
    return null;
  }
}

function bootPartnersPwa() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootPartnersPwa);
    return;
  }

  setupInstallUi();
  registerPartnersServiceWorker();
}

bootPartnersPwa();
