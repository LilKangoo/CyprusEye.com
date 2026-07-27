import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

type Listener = (event: Record<string, unknown>) => void;

class FakeClassList {
  values = new Set<string>();

  toggle(name: string, force?: boolean) {
    const enabled = force === undefined ? !this.values.has(name) : force;
    if (enabled) this.values.add(name);
    else this.values.delete(name);
    return enabled;
  }

  contains(name: string) {
    return this.values.has(name);
  }
}

class FakeElement {
  attributes = new Map<string, string>();
  classList = new FakeClassList();
  hidden = false;
  tabIndex = -1;
  focused = false;
  listeners = new Map<string, Listener[]>();

  setAttribute(name: string, value: string) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name: string) {
    return this.attributes.get(name) || null;
  }

  addEventListener(type: string, listener: Listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  focus() {
    this.focused = true;
  }

  dispatch(type: string, event: Record<string, unknown> = {}) {
    (this.listeners.get(type) || []).forEach((listener) => listener(event));
  }
}

type NavigationApi = {
  DEFAULT_TAB: string;
  STORAGE_KEY: string;
  TAB_DEFINITIONS: Array<{ key: string; tabId: string; panelId: string }>;
  create: (options: Record<string, unknown>) => {
    activate: (key: string, options?: Record<string, unknown>) => string;
    getActiveTab: () => string;
    initialize: () => unknown;
  };
};

function loadNavigation(): NavigationApi {
  const filename = path.join(process.cwd(), 'admin/transport-admin-navigation.js');
  const source = fs.readFileSync(filename, 'utf8');
  const context: Record<string, unknown> = {};
  vm.runInNewContext(source, context, { filename });
  return context.TransportAdminNavigation as NavigationApi;
}

function createHarness(core: NavigationApi, storedTab = '') {
  const elements = new Map<string, FakeElement>();
  core.TAB_DEFINITIONS.forEach((definition) => {
    elements.set(definition.tabId, new FakeElement());
    elements.set(definition.panelId, new FakeElement());
  });
  const storageValues = new Map<string, string>();
  if (storedTab) storageValues.set(core.STORAGE_KEY, storedTab);
  const storage = {
    getItem: (key: string) => storageValues.get(key) || null,
    setItem: (key: string, value: string) => storageValues.set(key, value),
  };
  const document = {
    getElementById: (id: string) => elements.get(id) || null,
  };
  const navigation = core.create({ document, storage, mountLayout: false });
  navigation.initialize();
  return { document, elements, navigation, storageValues };
}

describe('Transport Admin Stage 1B navigation', () => {
  const core = loadNavigation();

  test('Routes is the default and only visible panel', () => {
    const harness = createHarness(core);

    expect(harness.navigation.getActiveTab()).toBe('routes');
    core.TAB_DEFINITIONS.forEach((definition) => {
      const tab = harness.elements.get(definition.tabId)!;
      const panel = harness.elements.get(definition.panelId)!;
      const selected = definition.key === 'routes';
      expect(tab.getAttribute('aria-selected')).toBe(selected ? 'true' : 'false');
      expect(tab.tabIndex).toBe(selected ? 0 : -1);
      expect(panel.hidden).toBe(!selected);
    });
  });

  test.each([
    'routes',
    'locations',
    'advancedPricing',
    'quoteTester',
    'globalSettings',
    'bookings',
    'legacyTools',
  ])('activates %s without invoking data callbacks', (key) => {
    const harness = createHarness(core);
    const definition = core.TAB_DEFINITIONS.find((entry) => entry.key === key)!;

    harness.elements.get(definition.tabId)!.dispatch('click');

    expect(harness.navigation.getActiveTab()).toBe(key);
    expect(harness.elements.get(definition.panelId)!.hidden).toBe(false);
    expect(harness.storageValues.get(core.STORAGE_KEY)).toBe(key);
  });

  test('supports ArrowLeft, ArrowRight, Home, End, Enter, and Space', () => {
    const harness = createHarness(core);
    const preventDefault = jest.fn();
    const routesTab = harness.elements.get('transportAdminV2TabRoutes')!;

    routesTab.dispatch('keydown', { key: 'ArrowRight', preventDefault });
    expect(harness.navigation.getActiveTab()).toBe('locations');
    expect(harness.elements.get('transportAdminV2TabLocations')!.focused).toBe(true);

    harness.elements.get('transportAdminV2TabLocations')!.dispatch('keydown', { key: 'ArrowLeft', preventDefault });
    expect(harness.navigation.getActiveTab()).toBe('routes');

    routesTab.dispatch('keydown', { key: 'End', preventDefault });
    expect(harness.navigation.getActiveTab()).toBe('legacyTools');

    harness.elements.get('transportAdminV2TabLegacyTools')!.dispatch('keydown', { key: 'Home', preventDefault });
    expect(harness.navigation.getActiveTab()).toBe('routes');

    harness.elements.get('transportAdminV2TabBookings')!.dispatch('keydown', { key: 'Enter', preventDefault });
    expect(harness.navigation.getActiveTab()).toBe('bookings');

    harness.elements.get('transportAdminV2TabQuoteTester')!.dispatch('keydown', { key: ' ', preventDefault });
    expect(harness.navigation.getActiveTab()).toBe('quoteTester');
    expect(preventDefault).toHaveBeenCalledTimes(6);
  });

  test('preserves the active panel across repeated initialization and session recreation', () => {
    const first = createHarness(core);
    first.navigation.activate('globalSettings');
    first.navigation.initialize();
    expect(first.navigation.getActiveTab()).toBe('globalSettings');

    const second = createHarness(core, first.storageValues.get(core.STORAGE_KEY));
    expect(second.navigation.getActiveTab()).toBe('globalSettings');
    expect(second.elements.get('transportAdminV2PanelGlobalSettings')!.hidden).toBe(false);
  });
});
