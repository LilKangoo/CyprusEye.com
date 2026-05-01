(function () {
  'use strict';

  const page = String(document.body?.dataset?.seoPage || '').toLowerCase();
  if (page !== 'home') return;

  if (!window.CE_HOME_PROGRESSIVE) {
    const registry = new WeakMap();

    function resolveBatchSize(grid, options = {}) {
      const width = Math.max(
        Number(grid?.clientWidth || 0),
        Number(window.innerWidth || 0),
      );
      if (width <= 640) {
        return Math.max(1, Number(options.mobile || 2));
      }
      if (width <= 1024) {
        return Math.max(1, Number(options.tablet || 4));
      }
      return Math.max(1, Number(options.desktop || 6));
    }

    function renderState(state) {
      const grid = state.grid;
      const items = Array.isArray(state.items) ? state.items : [];
      const previousScrollLeft = Number(grid?.scrollLeft || 0);

      if (!grid) return;

      if (!items.length) {
        grid.innerHTML = typeof state.emptyHtml === 'function'
          ? state.emptyHtml()
          : String(state.emptyHtml || '');
        state.onRendered?.([]);
        state.updateArrows?.();
        return;
      }

      const visible = items.slice(0, state.renderCount);
      grid.innerHTML = state.renderItems(visible, state);
      state.onRendered?.(visible, state);

      window.requestAnimationFrame(() => {
        if (previousScrollLeft > 0) {
          grid.scrollLeft = previousScrollLeft;
        }
        state.updateArrows?.();
        maybeFillViewport(state);
      });
    }

    function maybeFillViewport(state) {
      if (!state?.grid || state.renderCount >= state.items.length) return;
      const threshold = Number(state.fillViewportThreshold || 12);
      if (state.grid.scrollWidth <= state.grid.clientWidth + threshold) {
        const nextCount = Math.min(state.items.length, state.renderCount + state.batchSize);
        if (nextCount !== state.renderCount) {
          state.renderCount = nextCount;
          renderState(state);
        }
      }
    }

    function maybeLoadMore(state) {
      if (!state?.grid || state.renderCount >= state.items.length) return;
      const remaining = state.grid.scrollWidth - (state.grid.scrollLeft + state.grid.clientWidth);
      const threshold = Number(state.scrollThreshold || 240);
      if (remaining > threshold) return;
      const nextCount = Math.min(state.items.length, state.renderCount + state.batchSize);
      if (nextCount === state.renderCount) return;
      state.renderCount = nextCount;
      renderState(state);
    }

    function ensureBound(state) {
      if (state.bound || !state.grid) return;
      state.bound = true;
      state.grid.addEventListener('scroll', () => {
        state.updateArrows?.();
        maybeLoadMore(state);
      }, { passive: true });
      window.addEventListener('resize', () => {
        state.batchSize = resolveBatchSize(state.grid, state.batchByViewport);
        state.updateArrows?.();
        maybeFillViewport(state);
      });
    }

    window.CE_HOME_PROGRESSIVE = {
      mount(config = {}) {
        const grid = config.grid;
        if (!grid) return null;

        let state = registry.get(grid);
        if (!state) {
          state = { grid };
          registry.set(grid, state);
        }

        state.items = Array.isArray(config.items) ? config.items.slice() : [];
        state.renderItems = typeof config.renderItems === 'function' ? config.renderItems : (() => '');
        state.emptyHtml = config.emptyHtml || '';
        state.onRendered = typeof config.onRendered === 'function' ? config.onRendered : null;
        state.updateArrows = typeof config.updateArrows === 'function' ? config.updateArrows : null;
        state.batchByViewport = config.batchByViewport || {};
        state.scrollThreshold = config.scrollThreshold;
        state.fillViewportThreshold = config.fillViewportThreshold;
        state.batchSize = resolveBatchSize(grid, state.batchByViewport);
        state.renderCount = Math.min(state.items.length, state.batchSize);
        grid.scrollLeft = 0;

        ensureBound(state);
        renderState(state);
        return state;
      },
      refresh(grid) {
        const state = registry.get(grid);
        if (!state) return;
        renderState(state);
      },
    };
  }

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
    { selector: '#tripsHomeGrid', src: 'js/home-trips.js?v=17' },
    { selector: '#hotelsHomeGrid', src: 'js/home-hotels.js?v=18' },
    { selector: '#carsHomeGrid', src: 'js/home-cars.js?v=17', type: 'module' },
    { selector: '#recommendationsHomeGrid', src: 'js/home-recommendations.js?v=10', type: 'module' },
    { selector: '#blogHomeGrid', src: 'js/home-blog.js?v=2', type: 'module' },
  ];

  deferredSections.forEach((entry) => {
    whenSectionNearViewport(entry.selector, () => loadScriptOnce(entry));
  });

  whenSectionNearViewport('#homeTransportBookingPanel', loadTransportScripts);
})();
