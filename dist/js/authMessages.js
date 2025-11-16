function setAria(msg, tone = 'info') {
  const el = document.getElementById('authMessage');
  if (!el) {
    return;
  }

  const message = typeof msg === 'string' ? msg.trim() : '';
  if (!message) {
    el.textContent = '';
    el.removeAttribute('data-tone');
    el.setAttribute('aria-live', 'polite');
    return;
  }

  el.textContent = message;
  el.dataset.tone = tone;
  el.setAttribute('aria-live', tone === 'error' ? 'assertive' : 'polite');
}

function callToast(msg, type = 'info', ttl) {
  if (window.Toast?.show) {
    window.Toast.show(msg, type, ttl);
  }
}

export function showInfo(msg, ttl) {
  callToast(msg, 'info', ttl);
  setAria(msg, 'info');
}

export function showOk(msg, ttl) {
  callToast(msg, 'success', ttl);
  setAria(msg, 'success');
}

export function showErr(msg, ttl) {
  callToast(msg, 'error', ttl);
  setAria(msg, 'error');
}

export { setAria };

