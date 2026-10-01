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
  `  window.testMap = { locate, center, state, reset, searchResults, select, warmNextViewport,
    warmLayer: layer => { activeLayer = layer; }, cancelWarmup: () => { warmGeneration++; },
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
  const images = [];
  class TileLayer {
    options = { maxNativeZoom: 19 };
    loading = false;
    isLoading() {
      return this.loading;
    }
    getTileSize() {
      return { x: 256 };
    }
    getTileUrl(c) {
      return `${c.z}/${c.x}/${c.y}`;
    }
  }
  vm.runInNewContext(source, {
    window,
    document: {
      getElementById: () => root,
      documentElement: { lang: "pl" },
      createElement: node,
    },
    localStorage: { getItem: () => prefs, setItem() {} },
    L: { latLng, point, latLngBounds: (x) => x, TileLayer },
    Image: class {
      constructor() {
        images.push(this);
      }
    },
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
    images,
    TileLayer,
    map,
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
test("proximity is automatic on the first location fix, with stable ordering during GPS updates", () => {
  const h = setup([]);
  h.window.CE_HOME_MAP.updateUserPosition({ latitude: 0, longitude: 0 });
  assert.equal(h.window.currentMapItem.id, "near");
  assert.deepEqual(h.order(), ["near", "middle", "far"]);
  h.window.CE_HOME_MAP.updateUserPosition({ latitude: 20, longitude: 20 });
  assert.deepEqual(h.order(), ["near", "middle", "far"]);
  const filtered = setup([], JSON.stringify({ categories: ["beach"] }));
  filtered.window.CE_HOME_MAP.updateUserPosition({ latitude: 0, longitude: 0 });
  assert.equal(filtered.window.currentMapItem.id, "middle");
});
test("GPS focus preserves a user-chosen place and centers location through layout updates", () => {
  const h = setup([]);
  h.api.select(entries[0]);
  h.api.locate();
  h.flush();
  h.api.center();
  assert.equal(h.window.currentMapItem.id, "far");
  assert.equal(h.views.at(-1).p.lat, 0);
  assert.equal(h.views.at(-1).p.lng, 0);
  h.api.center(entries[2]);
  assert.equal(h.views.at(-1).p.lat, 5);
});
test("without GPS the catalog is ordered west to east, including after filter reset", () => {
  const h = setup([]);
  assert.deepEqual(h.order(), ["near", "middle", "far"]);
  h.window.CE_HOME_MAP.updateUserPosition({ latitude: 20, longitude: 20 });
  h.api.reset();
  assert.deepEqual(h.order(), ["far", "middle", "near"]);
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
  assert.equal(h.get("#hm-locate").disabled, false);
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

test("search jumps to a catalog position without narrowing the navigation list", () => {
  const h = setup([]);
  h.order();
  h.api.state.query = "middle";
  assert.deepEqual(h.order(), ["near", "middle", "far"]);
  const results = h.api.searchResults();
  assert.deepEqual(
    Array.from(results, (x) => x.id),
    ["middle"],
  );
  h.api.select(results[0]);
  assert.equal(h.window.currentMapItem.id, "middle");
  assert.equal(h.order().indexOf(h.window.currentMapItem.id), 1);
  assert.equal(h.order().length, 3);
  assert.equal(h.api.state.query, "");
  h.api.state.query = "missing";
  assert.equal(h.api.searchResults().length, 0);
  assert.equal(h.order().length, 3);
});

test("tile warming waits for current map, limits concurrency, and cancels stale work", () => {
  const h = setup([]);
  h.order();
  const layer = new h.TileLayer();
  h.api.warmLayer(layer);
  layer.loading = true;
  h.api.warmNextViewport(0);
  assert.equal(h.images.length, 0);
  layer.loading = false;
  h.api.warmNextViewport(0);
  assert.equal(h.images.length, 2);
  assert.equal(h.images[0].fetchPriority, "low");
  h.images[0].onload();
  assert.equal(h.images.length, 3);
  h.api.cancelWarmup();
  h.images[1].onload();
  h.images[2].onload();
  assert.equal(h.images.length, 3);
});
test("tile warming uses native tile zoom and has a finite request budget", () => {
  const h = setup([]);
  h.order();
  h.map.getZoom = () => 24;
  const layer = new h.TileLayer();
  h.api.warmLayer(layer);
  h.api.warmNextViewport(0);
  for (let i = 0; i < h.images.length; i++) {
    assert.ok(i < 16);
    assert.match(h.images[i].src, /^19\//);
    h.images[i].onload();
  }
  assert.ok(h.images.length <= 16);
});
