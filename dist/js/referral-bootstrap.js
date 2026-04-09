(function initCyprusEyeReferralBootstrap(global) {
  if (!global || global.CE_REFERRAL_BOOTSTRAP) {
    return;
  }

  var STORAGE_KEY = 'cypruseye_referral_code';
  var COOKIE_KEY = 'ce_ref';
  var TTL_DAYS = 90;
  var CODE_PATTERN = /^[A-Za-z0-9_]+$/;

  function normalizeCode(code) {
    var raw = String(code || '').trim();
    if (!raw || !CODE_PATTERN.test(raw)) {
      return '';
    }
    return raw;
  }

  function buildData(code) {
    var now = Date.now();
    return {
      code: code,
      capturedAt: now,
      expiresAt: now + TTL_DAYS * 24 * 60 * 60 * 1000,
    };
  }

  function writeCookie(data) {
    try {
      if (!data || !data.code || !data.expiresAt) {
        document.cookie = COOKIE_KEY + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax';
        return;
      }
      var expiresAt = new Date(data.expiresAt);
      document.cookie =
        COOKIE_KEY +
        '=' +
        encodeURIComponent(JSON.stringify(data)) +
        '; expires=' +
        expiresAt.toUTCString() +
        '; path=/; SameSite=Lax';
    } catch (_error) {
    }
  }

  function readCookie() {
    try {
      var match = document.cookie.match(new RegExp('(?:^|; )' + COOKIE_KEY.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
      if (!match) return null;
      var parsed = JSON.parse(decodeURIComponent(match[1]));
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_error) {
      return null;
    }
  }

  function writeLocalStorage(data) {
    try {
      if (!data) {
        global.localStorage.removeItem(STORAGE_KEY);
        return;
      }
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_error) {
    }
  }

  function readLocalStorage() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_error) {
      return null;
    }
  }

  function isValidData(data) {
    var code = normalizeCode(data && data.code);
    var expiresAt = Number(data && data.expiresAt);
    if (!code || !Number.isFinite(expiresAt)) {
      return false;
    }
    if (Date.now() > expiresAt) {
      return false;
    }
    return true;
  }

  function clearReferralCode() {
    writeLocalStorage(null);
    writeCookie(null);
  }

  function getStoredData() {
    var localData = readLocalStorage();
    if (isValidData(localData)) {
      return localData;
    }

    var cookieData = readCookie();
    if (isValidData(cookieData)) {
      writeLocalStorage(cookieData);
      return cookieData;
    }

    clearReferralCode();
    return null;
  }

  function getStoredCode() {
    var data = getStoredData();
    return data ? data.code : null;
  }

  function storeReferralCode(code, options) {
    var cleanCode = normalizeCode(code);
    if (!cleanCode) {
      return false;
    }

    var overwrite = !options || options.overwrite !== false;
    var existing = getStoredData();
    if (!overwrite && existing && existing.code) {
      return true;
    }

    var data = buildData(cleanCode);
    writeLocalStorage(data);
    writeCookie(data);
    return true;
  }

  function captureFromCurrentUrl(options) {
    try {
      var params = new URLSearchParams(global.location.search);
      var code = normalizeCode(params.get('ref'));
      if (!code) {
        return null;
      }
      storeReferralCode(code, { overwrite: !options || options.overwrite !== false });
      return code;
    } catch (_error) {
      return null;
    }
  }

  global.CE_REFERRAL_BOOTSTRAP = {
    STORAGE_KEY: STORAGE_KEY,
    COOKIE_KEY: COOKIE_KEY,
    TTL_DAYS: TTL_DAYS,
    normalizeCode: normalizeCode,
    getStoredData: getStoredData,
    getStoredCode: getStoredCode,
    storeReferralCode: storeReferralCode,
    clearReferralCode: clearReferralCode,
    captureFromCurrentUrl: captureFromCurrentUrl,
  };

  captureFromCurrentUrl({ overwrite: true });
})(window);
