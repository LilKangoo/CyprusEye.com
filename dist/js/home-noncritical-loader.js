(function () {
  'use strict';

  const page = String(document.body?.dataset?.seoPage || '').toLowerCase();
  if (page !== 'home') return;

  const queue = [
    'js/seo.js',
    'js/header-stats.js?v=2',
  ];

  let started = false;

  function loadSequential(index = 0) {
    if (index >= queue.length) return;

    const src = String(queue[index] || '').trim();
    if (!src) {
      loadSequential(index + 1);
      return;
    }

    if (document.querySelector(`script[data-home-noncritical-src="${src}"]`)) {
      loadSequential(index + 1);
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.setAttribute('data-home-noncritical-src', src);
    script.addEventListener('load', () => loadSequential(index + 1), { once: true });
    script.addEventListener('error', () => loadSequential(index + 1), { once: true });
    document.body.appendChild(script);
  }

  function start() {
    if (started) return;
    started = true;
    loadSequential(0);
  }

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(start, { timeout: 2200 });
  } else {
    window.setTimeout(start, 1200);
  }

  window.addEventListener('load', () => {
    window.setTimeout(start, 0);
  }, { once: true });
})();
