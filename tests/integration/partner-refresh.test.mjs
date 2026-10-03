import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const source = fs.readFileSync("js/partner-car-location.js", "utf8");
const context = {};
vm.runInNewContext(source, context);
const location = context.CEPartnerCarLocation.locationForSide;
test("Pickup flight corrects hotel label without changing the city", () =>
  assert.equal(
    location({
      location: "larnaca_hotel",
      flightNumber: "Pickup: W123",
      side: "pickup",
    }),
    "larnaca airport",
  ));
test("Return flight never changes hotel pickup", () =>
  assert.equal(
    location({
      location: "hotel",
      flightNumber: "Return: W123",
      side: "pickup",
    }),
    "hotel",
  ));
test("Tagged return corrects the return location", () =>
  assert.equal(
    location({
      location: "paphos_hotel",
      flightNumber: "Return: W123",
      side: "return",
    }),
    "paphos airport",
  ));
test("An untagged legacy return flight does not mislabel pickup", () =>
  assert.equal(
    location({
      location: "hotel",
      otherLocation: "airport_pfo",
      flightNumber: "W123",
    }),
    "hotel",
  ));
test("An untagged pickup flight corrects legacy hotel display", () =>
  assert.equal(
    location({ location: "hotel", flightNumber: "W123" }),
    "airport",
  ));
test("No flight preserves the original location", () =>
  assert.equal(location({ location: "hotel", flightNumber: "  " }), "hotel"));
test("Existing airport code resolves to its named city", () =>
  assert.equal(
    location({ location: "airport_lca", flightNumber: "W123" }),
    "larnaca airport",
  ));
const partner = fs.readFileSync("js/partners.js", "utf8");
test("Search contacts require server release flag", () =>
  assert.match(
    partner,
    /row\.contact_revealed_at \? state\.contactsByFulfillmentId/,
  ));
test("Capability checks and suspended actions remain present", () => {
  assert.match(partner, /Boolean\(partner\?\.can_manage_cars\)/);
  assert.match(partner, /Boolean\(partner\?\.can_manage_hotels\)/);
  assert.match(partner, /isSuspended \? 'disabled'/);
});

// Execute the actual functions from the shipped runtime against isolated partner fixtures.
import ts from "typescript";
import { execFileSync } from "node:child_process";
function fn(name, text = partner) {
  const tree = ts.createSourceFile(
    "source.js",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  let result;
  const visit = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === name)
      result = n.getText(tree);
    ts.forEachChild(n, visit);
  };
  visit(tree);
  assert.ok(result, `Function ${name} exists`);
  return result;
}
const previous = execFileSync("git", ["show", "1069a4e0:js/partners.js"], {
  encoding: "utf8",
});
for (const name of [
  "getSelectedPartnerCapabilities",
  "loadCalendarResourcesForType",
  "normalizeAssignedHotelsEnvelope",
  "loadFulfillments",
  "callFulfillmentAction",
  "callServiceFulfillmentAction",
  "dispatchTripDateOptionsToCustomer",
  "enablePartnerPushNotifications",
  "disablePartnerPushNotifications",
].filter((name) => partner.includes(`function ${name}(`))) {
  test(`Existing backend and access contract unchanged: ${name}`, () =>
    assert.equal(fn(name), fn(name, previous)));
}
test("Cars-only and Hotels-only partners keep separate capabilities; affiliate-only gets neither", () => {
  const c = {
    state: {
      selectedPartnerId: "p",
      partnersById: { p: { can_manage_cars: true } },
      fulfillments: [],
    },
  };
  vm.createContext(c);
  vm.runInContext(fn("getSelectedPartnerCapabilities"), c);
  assert.equal(c.getSelectedPartnerCapabilities().canCars, true);
  assert.equal(c.getSelectedPartnerCapabilities().canHotels, false);
  c.state.partnersById.p = { can_manage_hotels: true };
  assert.equal(c.getSelectedPartnerCapabilities().canCars, false);
  assert.equal(c.getSelectedPartnerCapabilities().canHotels, true);
  c.state.partnersById.p = { affiliate_enabled: true };
  assert.equal(c.getSelectedPartnerCapabilities().isAffiliateOnly, true);
  assert.equal(
    c.getSelectedPartnerCapabilities().hasAnyServicePermission,
    false,
  );
});
function searchFixture() {
  const c = {
    state: {
      orders: { status: "all", search: "", sort: "date", filterDate: "" },
      contactsByFulfillmentId: {
        a: { customer_email: "hidden@example.test" },
        b: {
          customer_name: "Test Customer",
          customer_email: "released@example.test",
        },
      },
      selectedCategory: "all",
      transportBookingsById: {},
      fulfillments: [
        {
          id: "a",
          reference: "CAR-100",
          __source: "service",
          resource_type: "cars",
          summary: "Test car",
          status: "pending_acceptance",
          start_date: "2026-10-05",
          end_date: "2026-10-09",
          total_price: 200,
          created_at: "2026-10-02",
        },
        {
          id: "b",
          reference: "CAR-101",
          __source: "service",
          resource_type: "cars",
          summary: "Test buggy",
          status: "accepted",
          contact_revealed_at: "2026-10-01",
          start_date: "2026-10-07",
          end_date: "2026-10-11",
          total_price: 350,
          created_at: "2026-10-01",
        },
      ],
    },
    resolveServiceOrderStatus: (r) => r.status,
    getCarsFulfillmentPricing: (r) => ({ amount: r.total_price }),
    getPartnerTransportEffectiveAmount: (r) => r.total_price,
  };
  vm.createContext(c);
  for (const name of [
    "localDateIso",
    "normalizeServiceResourceType",
    "filteredFulfillmentsForSelectedCategory",
    "normalizeOrdersStatus",
    "normalizeIsoDateValue",
    "detailsObjectFromFulfillment",
    "fulfillmentCategoryForOrders",
    "fulfillmentStatusForOrders",
    "firstIsoFromCandidates",
    "fulfillmentScheduleRange",
    "orderLabelForFulfillment",
    "filteredFulfillmentsForOrdersPanel",
  ])
    vm.runInContext(fn(name), c);
  return c;
}
test("Search never matches unreleased contact, but does match released email and order reference", () => {
  const c = searchFixture();
  c.state.orders.search = "hidden@example.test";
  assert.equal(c.filteredFulfillmentsForOrdersPanel().length, 0);
  c.state.orders.search = "released@example.test";
  assert.equal(c.filteredFulfillmentsForOrdersPanel()[0].id, "b");
  c.state.orders.search = "CAR-100";
  assert.equal(c.filteredFulfillmentsForOrdersPanel()[0].id, "a");
});
test("Date, category, status and price filters compose without mutating source data", () => {
  const c = searchFixture();
  c.state.orders.filterDate = "2026-10-10";
  assert.equal(c.filteredFulfillmentsForOrdersPanel()[0].id, "b");
  c.state.orders.filterDate = "";
  c.state.orders.status = "pending_acceptance";
  assert.equal(c.filteredFulfillmentsForOrdersPanel()[0].id, "a");
  c.state.orders.status = "all";
  c.state.orders.sort = "price";
  assert.equal(c.filteredFulfillmentsForOrdersPanel()[0].id, "b");
  assert.equal(c.state.fulfillments[0].id, "a");
  c.state.selectedCategory = "hotels";
  assert.equal(c.filteredFulfillmentsForOrdersPanel().length, 0);
});
const carSource = fs.readFileSync("js/car-reservation.js", "utf8");
test("New car submissions preserve which side the flight belongs to", () => {
  class Input {
    value = "";
    required = false;
    hidden = false;
  }
  const fields = Object.fromEntries(
    [
      "pickupFlightField",
      "returnFlightField",
      "res_pickup_flight",
      "res_return_flight",
      "res_flight",
    ].map((id) => [id, new Input()]),
  );
  const c = {
    document: { getElementById: (id) => fields[id] },
    HTMLInputElement: Input,
    HTMLElement: Input,
  };
  vm.createContext(c);
  vm.runInContext(fn("syncFlightNumberField", carSource), c);
  fields.res_pickup_flight.value = "W123";
  fields.res_return_flight.value = "W456";
  assert.equal(c.syncFlightNumberField("airport", "hotel"), "Pickup: W123");
  assert.equal(c.syncFlightNumberField("hotel", "airport"), "Return: W456");
  assert.equal(
    c.syncFlightNumberField("airport", "airport"),
    "Pickup: W123 | Return: W456",
  );
  assert.equal(c.syncFlightNumberField("hotel", "hotel"), "");
  assert.equal(fields.res_flight.value, "");
});

for (const [code, city] of [
  ["airport_lca", "larnaca"],
  ["airport_pfo", "paphos"],
  ["LCA", "larnaca"],
  ["PFO", "paphos"],
  ["paphos_airport", "paphos"],
]) {
  test(`Explicit airport ${code} displays the correct city`, () =>
    assert.equal(location({ location: code }), `${city} airport`));
}
test("City code fills generic hotel label for a tagged airport pickup", () =>
  assert.equal(
    location({
      location: "hotel",
      cityCode: "paphos",
      flightNumber: "Pickup: W123",
    }),
    "paphos airport",
  ));
test("A return flight uses its own city, never the pickup city", () =>
  assert.equal(
    location({
      location: "hotel",
      cityCode: "larnaca",
      otherLocation: "airport_pfo",
      flightNumber: "Return: W123",
      side: "return",
    }),
    "larnaca airport",
  ));
test("An unknown airport city is not guessed from flight or opposite location", () =>
  assert.equal(
    location({
      location: "hotel",
      otherLocation: "paphos",
      flightNumber: "Pickup: PFO123",
    }),
    "airport",
  ));
test("All existing partner control IDs survive the redesign without duplicates", () => {
  const html = fs.readFileSync("partners/index.html", "utf8");
  const original = execFileSync(
    "git",
    ["show", "1069a4e0:partners/index.html"],
    { encoding: "utf8" },
  );
  const ids = (text) => [...text.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  const actual = ids(html);
  for (const id of ids(original))
    assert.ok(actual.includes(id), `Missing control: ${id}`);
  assert.equal(new Set(actual).size, actual.length);
});
test("Booking submission and validation are unchanged apart from flight-side serialization", () => {
  const old = execFileSync("git", ["show", "1069a4e0:js/car-reservation.js"], {
    encoding: "utf8",
  });
  const expected = old
    .replace(
      "    combined = pickupFlight;",
      "    combined = pickupFlight ? `Pickup: ${pickupFlight}` : '';",
    )
    .replace(
      "    combined = returnFlight;",
      "    combined = returnFlight ? `Return: ${returnFlight}` : '';",
    );
  assert.equal(carSource, expected);
});

test("Legacy Paphos hotel plus flight resolves using the saved booking city", () =>
  assert.equal(
    location({
      location: "hotel",
      bookingLocation: "paphos",
      flightNumber: "Pickup: W123",
    }),
    "paphos airport",
  ));
test("Explicit Larnaca return is not replaced by the Paphos offer city", () =>
  assert.equal(
    location({
      location: "airport_lca",
      bookingLocation: "paphos",
      flightNumber: "Return: W123",
      side: "return",
    }),
    "larnaca airport",
  ));
test("Return city code takes priority over legacy offer city", () =>
  assert.equal(
    location({
      location: "hotel",
      cityCode: "larnaca",
      bookingLocation: "paphos",
      flightNumber: "Return: W123",
      side: "return",
    }),
    "larnaca airport",
  ));

test("Reservation titles use the requested stored language without changing booking data", () => {
  let lang = "en";
  const c = {
    getPartnerUiLanguage: () => lang,
    normalizeServiceResourceType: (x) => x,
    normalizeTitleJson: (value, language) =>
      value?.[language] || value?.en || "",
    state: {
      hotelResourcesById: {
        h: { title: { en: "7 Arches", pl: "7 Łuków" }, city: "Lefkara" },
      },
    },
  };
  vm.createContext(c);
  vm.runInContext(fn("localizedOrderSummary"), c);
  const trip = {
    resource_type: "trips",
    summary: "Private tour / Wycieczka — Paphos",
    __tripTitleEn: "Private tour",
    __tripTitlePl: "Wycieczka",
  };
  const hotel = {
    resource_type: "hotels",
    resource_id: "h",
    summary: "7 Łuków — Lefkara",
  };
  assert.equal(c.localizedOrderSummary(trip), "Private tour — Paphos");
  assert.equal(c.localizedOrderSummary(hotel), "7 Arches — Lefkara");
  lang = "pl";
  assert.equal(c.localizedOrderSummary(trip), "Wycieczka — Paphos");
  assert.equal(c.localizedOrderSummary(hotel), "7 Łuków — Lefkara");
  assert.equal(trip.summary, "Private tour / Wycieczka — Paphos");
  assert.equal(
    c.localizedOrderSummary({ resource_type: "cars", summary: "Nissan Note" }),
    "Nissan Note",
  );
});
