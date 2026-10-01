import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { test } from "node:test";

// Exercise the actual controller with deterministic geolocation, projection and catalog adapters.
const source = readFileSync(
  new URL("../../js/home-map.js", import.meta.url),
  "utf8",
).replace(
  "  window.CE_HOME_MAP = {",
  `  window.testMap = { locate, center, state, reset,
    connect: (instance, adapter) => { map = instance; api = adapter; } };
  window.CE_HOME_MAP = {`,
);
const catalog = [
  { id: "far", lat: 20, lng: 20, category: "beach" },
  { id: "near", lat: 1, lng: 1, category: "nature" },
  { id: "middle", lat: 5, lng: 5, category: "beach" },
];
const entries = catalog.map(({ id }) => ({ type: "poi", id }));
function setup(responses, prefs = null) {
  const nodes = new Map();
  const node = () => ({
    textContent: "",
    dataset: {},
    children: [],
    disabled: false,
    hidden: false,
    getBoundingClientRect: () => ({
      top: 400,
      left: 0,
      right: 300,
      width: 300,
      height: 100,
    }),
    setAttribute() {},
    addEventListener() {},
    blur() {},
    append(...children) {
      this.children.push(...children);
    },
    replaceChildren() {
      this.children = [];
    },
  });
  const get = (id) => {
    if (!nodes.has(id)) nodes.set(id, node());
    return nodes.get(id);
  };
  const root = {
    clientWidth: 1000,
    querySelector: get,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000 }),
  };
  const point = (x, y) => ({
    x,
    y,
    divideBy: (n) => point(x / n, y / n),
    subtract: (p) => point(x - p.x, y - p.y),
  });
  const latLng = (lat, lng) => ({
    lat,
    lng,
    distanceTo: (p) => Math.hypot(lat - p.lat, lng - p.lng),
  });
  const views = [],
    requests = [],
    queue = [];
  const map = {
    stop() {},
    invalidateSize() {},
    setMinZoom() {},
    getMinZoom: () => 0,
    getMaxZoom: () => 24,
    getZoom: () => 10,
    getBoundsZoom: () => 0,
    getSize: () => point(1000, 600),
    project: (p) => point(p.lng, p.lat),
    unproject: (p) => latLng(p.y, p.x),
    setView: (p, z) => views.push({ p, z }),
  };
  const window = {
    PLACES_DATA: catalog,
    currentMapItem: entries[0],
    setCurrentMapItem(item) {
      this.currentMapItem = item;
    },
  };
  vm.runInNewContext(source, {
    window,
    document: {
      getElementById: () => root,
      documentElement: { lang: "pl" },
      createElement: node,
    },
    localStorage: { getItem: () => prefs, setItem() {} },
    L: { latLng, point, latLngBounds: (x) => x },
    requestAnimationFrame: (fn) => queue.push(fn),
    matchMedia: () => ({ matches: true }),
    Date,
    navigator: {
      geolocation: {
        getCurrentPosition(ok, fail, options) {
          requests.push(options);
          const response = responses.shift();
          if (response?.code) fail(response);
          else ok(response || { coords: { latitude: 0, longitude: 0 } });
        },
      },
    },
  });
  const api = window.testMap;
  api.connect(map, {
    getMarker: () => null,
    refresh: () => window.CE_HOME_MAP.filterItems(entries),
    setUserLocation: (c) => {
      window.currentUserLocation = {
        lat: c.latitude,
        lng: c.longitude,
        timestamp: Date.now(),
      };
    },
    category: (r) => ({ slug: r.category }),
  });
  return {
    api,
    window,
    views,
    requests,
    flush: () => {
      while (queue.length) queue.shift()();
    },
    status: () => get("#hm-status").children[0]?.dataset.hmCopy,
    get,
    order: () =>
      Array.from(window.CE_HOME_MAP.filterItems(entries), (x) => x.id),
  };
}
test("repeated Near me selects nearest, retains ascending order and respects filters", () => {
  const h = setup([]);
  for (let i = 0; i < 3; i++) {
    h.api.locate();
    h.flush();
    assert.equal(h.window.currentMapItem.id, "near");
    assert.deepEqual(h.order(), ["near", "middle", "far"]);
  }
  h.window.currentMapItem = entries[0];
  h.api.locate();
  h.flush();
  assert.equal(h.window.currentMapItem.id, "near");
  const filtered = setup([], JSON.stringify({ categories: ["beach"] }));
  filtered.api.locate();
  assert.equal(filtered.window.currentMapItem.id, "middle");
});
test("location control preserves selection and centers GPS through deferred layout work", () => {
  const h = setup([]);
  h.api.locate("user");
  h.flush();
  h.api.center();
  assert.equal(h.window.currentMapItem.id, "far");
  assert.equal(h.views.at(-1).p.lat, 0);
  assert.equal(h.views.at(-1).p.lng, 0);
  h.api.center(entries[2]);
  assert.equal(h.views.at(-1).p.lat, 5);
});
test("temporary provider error retries with high accuracy and then succeeds", () => {
  const h = setup([{ code: 2 }]);
  h.api.locate();
  assert.equal(h.requests.length, 2);
  assert.equal(h.requests[1].enableHighAccuracy, true);
  assert.equal(h.window.currentMapItem.id, "near");
  assert.equal(h.status(), undefined);
});
test("permission denial is not retried or bypassed with cached coordinates", () => {
  const h = setup([{ code: 1 }]);
  h.window.currentUserLocation = { lat: 0, lng: 0, timestamp: Date.now() };
  h.api.locate();
  assert.equal(h.requests.length, 1);
  assert.equal(h.status(), "denied");
  assert.equal(h.views.length, 0);
  assert.equal(h.get("#hm-near").disabled, false);
});
test("timeout and unavailable errors are distinct and do not fabricate positions", () => {
  for (const [code, message] of [
    [2, "unavailable"],
    [3, "timeout"],
  ]) {
    const h = setup([{ code }, { code }]);
    h.api.locate();
    assert.equal(h.status(), message);
    assert.equal(h.views.length, 0);
    assert.equal(h.get("#hm-locate").disabled, false);
  }
});
test("recent fallback is disclosed and does not renew the old position timestamp", () => {
  const h = setup([{ code: 2 }, { code: 2 }]);
  const timestamp = Date.now() - 30000;
  h.window.currentUserLocation = { lat: 0, lng: 0, timestamp };
  h.api.locate();
  assert.equal(h.status(), "recent");
  assert.equal(h.window.currentUserLocation.timestamp, timestamp);
  const stale = setup([{ code: 2 }, { code: 2 }]);
  stale.window.currentUserLocation = {
    lat: 0,
    lng: 0,
    timestamp: Date.now() - 61000,
  };
  stale.api.locate();
  assert.equal(stale.status(), "unavailable");
});
