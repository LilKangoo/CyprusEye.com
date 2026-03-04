(function initCyprusEyeMediaViewer(global) {
  if (!global || global.CE_MEDIA_VIEWER) {
    return;
  }

  var PANORAMA_MARKER = 'ce360';
  var PANNELLUM_JS = 'https://unpkg.com/pannellum@2.5.6/build/pannellum.js';
  var PANNELLUM_CSS = 'https://unpkg.com/pannellum@2.5.6/build/pannellum.css';

  var pannellumReadyPromise = null;
  var activePanoramaByContainer = new WeakMap();

  function toMediaString(input) {
    if (input == null) return '';
    if (typeof input === 'string') return input.trim();
    if (typeof input === 'object') {
      var objectUrl = input.photo_url || input.url || input.src || input.image_url || '';
      return String(objectUrl || '').trim();
    }
    return String(input).trim();
  }

  function splitHash(raw) {
    var value = toMediaString(raw);
    if (!value) {
      return { base: '', hash: '' };
    }
    var hashIndex = value.indexOf('#');
    if (hashIndex < 0) {
      return { base: value, hash: '' };
    }
    return {
      base: value.slice(0, hashIndex),
      hash: value.slice(hashIndex + 1),
    };
  }

  function parseHashTokens(hash) {
    if (!hash) return [];
    return hash
      .split(/[,&]/)
      .map(function mapToken(token) { return token.trim().toLowerCase(); })
      .filter(Boolean);
  }

  function hasPanoramaMarker(raw) {
    var split = splitHash(raw);
    var tokens = parseHashTokens(split.hash);
    return tokens.indexOf(PANORAMA_MARKER) >= 0;
  }

  function parseMedia(raw) {
    var input = toMediaString(raw);
    if (!input) {
      return {
        raw: '',
        url: '',
        hash: '',
        isPanorama: false,
      };
    }

    var split = splitHash(input);
    var isPanorama = hasPanoramaMarker(input);

    return {
      raw: input,
      url: split.base,
      hash: split.hash,
      isPanorama: isPanorama,
    };
  }

  function setPanoramaMarker(raw, enabled) {
    var split = splitHash(raw);
    if (!split.base) return '';

    var tokens = parseHashTokens(split.hash);
    var filtered = tokens.filter(function keep(token) {
      return token !== PANORAMA_MARKER;
    });

    if (enabled) {
      filtered.push(PANORAMA_MARKER);
    }

    if (!filtered.length) {
      return split.base;
    }

    return split.base + '#' + filtered.join('&');
  }

  function normalizeForCompare(raw) {
    return parseMedia(raw).url;
  }

  function getDisplayUrl(raw) {
    return parseMedia(raw).url;
  }

  function ensurePannellumStylesheet() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('ce-pannellum-css')) return;

    var link = document.createElement('link');
    link.id = 'ce-pannellum-css';
    link.rel = 'stylesheet';
    link.href = PANNELLUM_CSS;
    document.head.appendChild(link);
  }

  function ensurePannellumScript() {
    return new Promise(function onScriptPromise(resolve, reject) {
      if (global.pannellum && typeof global.pannellum.viewer === 'function') {
        resolve(global.pannellum);
        return;
      }

      var existing = document.getElementById('ce-pannellum-js');
      if (existing) {
        existing.addEventListener('load', function onLoad() {
          resolve(global.pannellum);
        }, { once: true });
        existing.addEventListener('error', function onError() {
          reject(new Error('Failed to load pannellum script'));
        }, { once: true });
        return;
      }

      var script = document.createElement('script');
      script.id = 'ce-pannellum-js';
      script.src = PANNELLUM_JS;
      script.async = true;
      script.onload = function handleLoad() {
        if (global.pannellum && typeof global.pannellum.viewer === 'function') {
          resolve(global.pannellum);
          return;
        }
        reject(new Error('Pannellum loaded without viewer API'));
      };
      script.onerror = function handleError() {
        reject(new Error('Failed to load pannellum script'));
      };
      document.head.appendChild(script);
    });
  }

  function ensurePannellum() {
    if (global.pannellum && typeof global.pannellum.viewer === 'function') {
      return Promise.resolve(global.pannellum);
    }

    if (!pannellumReadyPromise) {
      ensurePannellumStylesheet();
      pannellumReadyPromise = ensurePannellumScript().catch(function onError(err) {
        pannellumReadyPromise = null;
        throw err;
      });
    }

    return pannellumReadyPromise;
  }

  function destroyPanorama(container) {
    if (!container) return;

    var active = activePanoramaByContainer.get(container);
    if (active && active.viewer && typeof active.viewer.destroy === 'function') {
      try {
        active.viewer.destroy();
      } catch (_) {
        // ignore
      }
    }

    activePanoramaByContainer.delete(container);
    container.innerHTML = '';
    container.dataset.cePanoramaActive = '0';
  }

  function isPanoramaActive(container) {
    if (!container) return false;
    return container.dataset.cePanoramaActive === '1';
  }

  async function mountPanorama(container, rawUrl, options) {
    var media = parseMedia(rawUrl);
    if (!container || !media.url) {
      return {
        isPanorama: false,
        destroy: function noop() {},
      };
    }

    var configOptions = options || {};
    await ensurePannellum();

    destroyPanorama(container);

    var stage = document.createElement('div');
    stage.className = 'ce-panorama-stage';
    stage.setAttribute('data-ce-panorama-stage', '1');
    container.appendChild(stage);

    var viewerConfig = {
      type: 'equirectangular',
      panorama: media.url,
      autoLoad: true,
      showZoomCtrl: true,
      showFullscreenCtrl: false,
      showControls: true,
      draggable: true,
      mouseZoom: true,
      keyboardZoom: true,
      friction: 0.16,
      hfov: Number(configOptions.hfov) || 100,
      minHfov: 50,
      maxHfov: 120,
      compass: false,
    };

    if (configOptions.viewerConfig && typeof configOptions.viewerConfig === 'object') {
      Object.assign(viewerConfig, configOptions.viewerConfig);
    }

    var viewer = global.pannellum.viewer(stage, viewerConfig);
    activePanoramaByContainer.set(container, {
      viewer: viewer,
      stage: stage,
      mediaUrl: media.url,
    });
    container.dataset.cePanoramaActive = '1';

    return {
      isPanorama: true,
      viewer: viewer,
      destroy: function destroyMountedPanorama() {
        destroyPanorama(container);
      },
    };
  }

  global.CE_MEDIA_VIEWER = {
    marker: PANORAMA_MARKER,
    parseMedia: parseMedia,
    isPanorama: hasPanoramaMarker,
    hasPanoramaMarker: hasPanoramaMarker,
    setPanoramaMarker: setPanoramaMarker,
    withPanoramaMarker: function withPanoramaMarker(raw) {
      return setPanoramaMarker(raw, true);
    },
    withoutPanoramaMarker: function withoutPanoramaMarker(raw) {
      return setPanoramaMarker(raw, false);
    },
    getDisplayUrl: getDisplayUrl,
    normalizeForCompare: normalizeForCompare,
    ensurePannellum: ensurePannellum,
    mountPanorama: mountPanorama,
    destroyPanorama: destroyPanorama,
    isPanoramaActive: isPanoramaActive,
    toMediaString: toMediaString,
  };
})(window);
