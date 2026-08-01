(function registerTransportAdminNavigation(root) {
  'use strict';

  const STORAGE_KEY = 'ce_transport_admin_v2_active_tab';
  const DEFAULT_TAB = 'routes';
  const TAB_DEFINITIONS = Object.freeze([
    Object.freeze({ key: 'routes', tabId: 'transportAdminV2TabRoutes', panelId: 'transportAdminV2PanelRoutes' }),
    Object.freeze({ key: 'locations', tabId: 'transportAdminV2TabLocations', panelId: 'transportAdminV2PanelLocations' }),
    Object.freeze({ key: 'advancedPricing', tabId: 'transportAdminV2TabAdvancedPricing', panelId: 'transportAdminV2PanelAdvancedPricing' }),
    Object.freeze({ key: 'quoteTester', tabId: 'transportAdminV2TabQuoteTester', panelId: 'transportAdminV2PanelQuoteTester' }),
    Object.freeze({ key: 'globalSettings', tabId: 'transportAdminV2TabGlobalSettings', panelId: 'transportAdminV2PanelGlobalSettings' }),
    Object.freeze({ key: 'bookings', tabId: 'transportAdminV2TabBookings', panelId: 'transportAdminV2PanelBookings' }),
    Object.freeze({ key: 'legacyTools', tabId: 'transportAdminV2TabLegacyTools', panelId: 'transportAdminV2PanelLegacyTools' }),
  ]);

  const TAB_BY_KEY = new Map(TAB_DEFINITIONS.map((definition) => [definition.key, definition]));
  let singleton = null;

  function normalizeTabKey(value) {
    const key = String(value || '').trim();
    return TAB_BY_KEY.has(key) ? key : DEFAULT_TAB;
  }

  function readStoredTab(storage) {
    if (!storage || typeof storage.getItem !== 'function') return '';
    try {
      const key = String(storage.getItem(STORAGE_KEY) || '').trim();
      return TAB_BY_KEY.has(key) ? key : '';
    } catch (_error) {
      return '';
    }
  }

  function writeStoredTab(storage, key) {
    if (!storage || typeof storage.setItem !== 'function') return;
    try {
      storage.setItem(STORAGE_KEY, key);
    } catch (_error) {
    }
  }

  function associateControlsWithForm(element, formId) {
    if (!element || !formId || typeof element.querySelectorAll !== 'function') return;
    element.querySelectorAll('button, input, select, textarea').forEach((control) => {
      if (typeof control.setAttribute === 'function' && !control.getAttribute('form')) {
        control.setAttribute('form', formId);
      }
    });
  }

  function moveElement(documentRef, elementId, panelId, options = {}) {
    const element = documentRef?.getElementById?.(elementId);
    const panel = documentRef?.getElementById?.(panelId);
    if (!element || !panel || element.parentNode === panel) return false;
    associateControlsWithForm(element, options.formId || '');
    panel.appendChild(element);
    return true;
  }

  function moveChildren(documentRef, sourceId, panelId) {
    const source = documentRef?.getElementById?.(sourceId);
    const panel = documentRef?.getElementById?.(panelId);
    if (!source || !panel) return false;
    while (source.firstChild) panel.appendChild(source.firstChild);
    return true;
  }

  function mountInformationArchitecture(documentRef) {
    const view = documentRef?.getElementById?.('viewTransport');
    if (!view || view.dataset?.transportAdminV2Mounted === '1') return;

    const globalPanelId = 'transportAdminV2PanelGlobalSettings';
    moveElement(documentRef, 'transportRouteGlobalCapacityPanel', globalPanelId, { formId: 'transportRouteForm' });
    moveElement(documentRef, 'transportPricingGlobalLuggagePanel', globalPanelId, { formId: 'transportPricingForm' });
    moveElement(documentRef, 'transportPricingDepositGlobalControls', globalPanelId, { formId: 'transportPricingForm' });
    moveElement(documentRef, 'transportRouteSetBuilderPanel', globalPanelId);
    moveElement(documentRef, 'transportRouteCityBulkPanel', globalPanelId);
    moveElement(documentRef, 'transportPricingCityBulkPanel', globalPanelId, { formId: 'transportPricingForm' });

    moveChildren(documentRef, 'transportTabLocations', 'transportAdminV2PanelLocations');
    moveElement(documentRef, 'transportLegacyRouteEditor', 'transportAdminV2PanelLegacyTools');
    moveElement(documentRef, 'transportRoutesList', 'transportAdminV2PanelLegacyTools');
    moveElement(documentRef, 'transportPricingEditor', 'transportAdminV2PanelAdvancedPricing');
    moveElement(documentRef, 'transportPricingList', 'transportAdminV2PanelAdvancedPricing');
    moveElement(documentRef, 'transportAdvancedPricingMatrix', 'transportAdminV2PanelAdvancedPricing');
    moveChildren(documentRef, 'transportTabBookings', 'transportAdminV2PanelBookings');

    moveElement(documentRef, 'transportLegacyModeControls', 'transportAdminV2PanelLegacyTools');
    moveElement(documentRef, 'transportLegacyWorkflowStrip', 'transportAdminV2PanelLegacyTools');
    moveElement(documentRef, 'transportGuidedPanel', 'transportAdminV2PanelLegacyTools');
    moveElement(documentRef, 'transportLegacyControlCenter', 'transportAdminV2PanelQuoteTester');

    if (view.dataset) view.dataset.transportAdminV2Mounted = '1';
  }

  function create(options = {}) {
    const documentRef = options.document || root.document || null;
    const storage = options.storage === undefined ? root.sessionStorage : options.storage;
    const shouldMount = options.mountLayout !== false;
    let activeTab = DEFAULT_TAB;
    let initialized = false;

    function getElements() {
      return TAB_DEFINITIONS.map((definition) => ({
        ...definition,
        tab: documentRef?.getElementById?.(definition.tabId) || null,
        panel: documentRef?.getElementById?.(definition.panelId) || null,
      }));
    }

    function activate(rawKey, activationOptions = {}) {
      const key = normalizeTabKey(rawKey);
      const elements = getElements();
      if (!elements.some((entry) => entry.key === key && entry.tab && entry.panel)) return activeTab;

      activeTab = key;
      elements.forEach((entry) => {
        if (!entry.tab || !entry.panel) return;
        const selected = entry.key === key;
        entry.tab.setAttribute('aria-selected', selected ? 'true' : 'false');
        entry.tab.tabIndex = selected ? 0 : -1;
        entry.tab.classList?.toggle?.('is-active', selected);
        entry.panel.hidden = !selected;
      });

      if (activationOptions.persist !== false) writeStoredTab(storage, key);
      if (activationOptions.focus === true) {
        const activeEntry = elements.find((entry) => entry.key === key);
        activeEntry?.tab?.focus?.();
      }
      return activeTab;
    }

    function handleKeydown(event, currentIndex) {
      const key = String(event?.key || '');
      let targetIndex = currentIndex;
      if (key === 'ArrowRight') targetIndex = (currentIndex + 1) % TAB_DEFINITIONS.length;
      else if (key === 'ArrowLeft') targetIndex = (currentIndex - 1 + TAB_DEFINITIONS.length) % TAB_DEFINITIONS.length;
      else if (key === 'Home') targetIndex = 0;
      else if (key === 'End') targetIndex = TAB_DEFINITIONS.length - 1;
      else if (key === 'Enter' || key === ' ') {
        event.preventDefault?.();
        activate(TAB_DEFINITIONS[currentIndex].key, { focus: true });
        return;
      } else {
        return;
      }

      event.preventDefault?.();
      activate(TAB_DEFINITIONS[targetIndex].key, { focus: true });
    }

    function initialize() {
      if (initialized) return api;
      if (shouldMount) mountInformationArchitecture(documentRef);

      getElements().forEach((entry, index) => {
        if (!entry.tab) return;
        entry.tab.addEventListener?.('click', () => activate(entry.key));
        entry.tab.addEventListener?.('keydown', (event) => handleKeydown(event, index));
      });

      initialized = true;
      activate(readStoredTab(storage) || DEFAULT_TAB, { persist: false });
      return api;
    }

    function getActiveTab() {
      return activeTab;
    }

    const api = Object.freeze({ activate, getActiveTab, initialize });
    return api;
  }

  function initialize(options = {}) {
    if (!singleton) singleton = create(options);
    return singleton.initialize();
  }

  function activate(key, options = {}) {
    return initialize().activate(key, options);
  }

  function getActiveTab() {
    return singleton?.getActiveTab?.() || DEFAULT_TAB;
  }

  const api = Object.freeze({
    DEFAULT_TAB,
    STORAGE_KEY,
    TAB_DEFINITIONS,
    activate,
    create,
    getActiveTab,
    initialize,
  });

  Object.defineProperty(root, 'TransportAdminNavigation', {
    value: api,
    configurable: false,
    enumerable: true,
    writable: false,
  });
})(globalThis);
