import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { test } from "node:test";
const code = readFileSync(
  new URL("../../js/home-map.js", import.meta.url),
  "utf8",
);
const items = [
  { type: "poi", id: "a" },
  { type: "poi", id: "b" },
  { type: "recommendation", id: "r" },
  { type: "hotel", id: "h" },
];
function setup(preferences, saved = false, search = "") {
  const window = {
    location: {search},
    PLACES_DATA: [
      { id: "a", name: "Áyia Napa", category: "beach" },
      { id: "b", name: "Troodos", category: "nature" },
    ],
    getMapRecommendationsData: () => [
      { id: "r", name: "Restaurant", category: "food" },
    ],
    getMapHotelsData: () => [{ id: "h", name: "Hotel" }],
    CE_SAVED_CATALOG: {
      isSaved: (type, id) => saved && type === "poi" && id === "b",
    },
  };
  vm.runInNewContext(code, {
    window,
    URLSearchParams,
    document: { getElementById: () => ({}), documentElement: { lang: "pl" } },
    localStorage: { getItem: () => preferences },
    console,
  });
  return (entries) =>
    JSON.parse(JSON.stringify(window.CE_HOME_MAP.filterItems(entries)));
}
test("all original catalog item types remain available", () =>
  assert.deepEqual(setup(null)(items), items));
test("multi-select categories uses OR and keeps hotels independent of POI categories", () =>
  assert.deepEqual(
    setup(JSON.stringify({ categories: ["beach", "food"] }))(items),
    [items[0], items[2], items[3]],
  ));
test("multi-select catalog types excludes only unchecked types", () =>
  assert.deepEqual(setup(JSON.stringify({ types: ["poi", "hotel"] }))(items), [
    items[0],
    items[1],
    items[3],
  ]));
test("explicit empty type selection stays empty instead of falling back to all", () =>
  assert.deepEqual(setup(JSON.stringify({ types: [] }))(items), []));
test("malformed preferences recover safely", () =>
  assert.deepEqual(setup("{invalid")(items), items));
test("unknown stored types cannot add phantom entries", () =>
  assert.deepEqual(setup(JSON.stringify({ types: ["bad", "hotel"] }))(items), [
    items[3],
  ]));
test("valid empty result does not substitute unfiltered records", () =>
  assert.deepEqual(
    setup(JSON.stringify({ categories: ["missing"], types: ["poi"] }))(items),
    [],
  ));

test("saved POI navigation clears conflicting filters after its catalog entry arrives", () => {
  const filter = setup(JSON.stringify({types:["hotel"],categories:["food"],saved:true}),true,"?poi=b");
  assert.deepEqual(filter(items),items);
});
test("missing saved POI does not reset filters or introduce a phantom result", () => {
  const filter = setup(JSON.stringify({types:["hotel"]}),false,"?poi=missing");
  assert.deepEqual(filter(items),[items[3]]);
});
