(function () {
  'use strict';

  const page = String(document.body?.dataset?.seoPage || '').toLowerCase();
  if (page !== 'home') return;

  const seen = new Set();
  let transportBootRequested = false;

  function loadScriptOnce(definition) {
    const key = String(definition?.src || '').trim();
    if (!key || seen.has(key)) return;
    seen.add(key);

    if (document.querySelector(`script[data-home-lazy-src="${key}"]`)) return;

    const script = document.createElement('script');
    script.setAttribute('data-home-lazy-src', key);
    if (definition.type === 'module') script.type = 'module';
    script.src = key;
    script.async = false;
    document.body.appendChild(script);
  }

  function loadTransportScripts() {
    if (transportBootRequested) return;
    transportBootRequested = true;

    const transportModuleSrc = 'js/transport-booking.js?v=20260227_1';
    const wizardSrc = 'js/home-transport-wizard.js?v=1';

    if (document.querySelector(`script[data-home-lazy-src="${wizardSrc}"]`)) {
      return;
    }

    const loadWizard = () => {
      loadScriptOnce({ src: wizardSrc });
    };

    if (document.querySelector(`script[data-home-lazy-src="${transportModuleSrc}"]`)) {
      loadWizard();
      return;
    }

    const moduleScript = document.createElement('script');
    moduleScript.type = 'module';
    moduleScript.src = transportModuleSrc;
    moduleScript.async = false;
    moduleScript.setAttribute('data-home-lazy-src', transportModuleSrc);
    moduleScript.addEventListener('load', loadWizard, { once: true });
    moduleScript.addEventListener('error', loadWizard, { once: true });
    document.body.appendChild(moduleScript);
  }

  function whenSectionNearViewport(selector, callback, fallbackDelay = 4500) {
    const target = document.querySelector(selector);
    if (!target || typeof callback !== 'function') {
      callback?.();
      return;
    }

    let done = false;
    const run = () => {
      if (done) return;
      done = true;
      callback();
    };

    const fallbackTimer = window.setTimeout(run, Math.max(1000, Number(fallbackDelay) || 4500));

    if (!('IntersectionObserver' in window)) {
      run();
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting || entry.intersectionRatio > 0) {
          window.clearTimeout(fallbackTimer);
          observer.disconnect();
          run();
          return;
        }
      }
    }, { rootMargin: '650px 0px' });

    observer.observe(target);
  }

  const deferredSections = [
    { selector: '#tripsHomeGrid', src: 'js/home-trips.js?v=16' },
    { selector: '#hotelsHomeGrid', src: 'js/home-hotels.js?v=16' },
    { selector: '#carsHomeGrid', src: 'js/home-cars.js?v=15', type: 'module' },
    { selector: '#recommendationsHomeGrid', src: 'js/home-recommendations.js?v=9', type: 'module' },
  ];

  deferredSections.forEach((entry) => {
    whenSectionNearViewport(entry.selector, () => loadScriptOnce(entry));
  });

  whenSectionNearViewport('#homeTransportBookingPanel', loadTransportScripts);
})();
