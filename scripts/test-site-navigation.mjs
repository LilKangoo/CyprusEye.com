import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const read = (p) => readFile(new URL("../" + p, import.meta.url), "utf8");
const pages = JSON.parse(await read("config/site-navigation-pages.json"));
const config = JSON.parse(await read("config/site-navigation.json"));
for (const [page, { mode }] of Object.entries(pages))
  test(`Navigation contract: ${page} (${mode})`, async () => {
    const html = await read(page);
    const full = !["workspace", "transaction", "redirect"].includes(mode);
    assert.equal(
      (html.match(/data-site-navigation(?:\s|>)/g) || []).length,
      full ? 1 : 0,
    );
    if (!full) return;
    if (mode !== "campaign") assert.match(html, /i18n\.js\?v=20261001_navigation1/, `${page}: translation cache version`);
    for (const id of [
      "ce-site-menu",
      "sosToggle",
      "btnOpenCart",
      "cartCount",
      "headerUserAvatar",
      "headerLevelNumber",
      "headerXpPoints",
      "headerXpFill",
      "headerBadgesCount",
      "compactProfileMenu",
    ])
      assert.equal(
        (html.match(new RegExp(`id=["']${id}["']`, "g")) || []).length,
        1,
        `${page}: ${id}`,
      );
    for (const name of [
      "site-navigation.js",
      "site-navigation-labels.js",
      "compact-header.js",
      "header-stats.js",
      "header-dropdown.js",
    ])
      assert.equal(
        (
          html.match(
            new RegExp(
              "src=[\"'][^\"']*" + name.replaceAll(".", "\\.") + "[^\"']*[\"']",
              "g",
            ),
          ) || []
        ).length,
        1,
        `${page}: ${name}`,
      );
    assert.match(html, /site-navigation\.css/);
    assert.ok(
      html.indexOf("data-site-navigation") < html.indexOf("site-navigation.js"),
    );
    for (const item of config.items)
      assert.ok(html.includes(`data-ce-route="${item.id}"`), item.id);
    if (mode === "campaign")
      for (const lang of ["pl", "en", "he"])
        assert.ok(html.includes(`data-special-offer-lang="${lang}"`));
  });
test("Every navigation label translated in all three languages", () => {
  for (const [key, values] of Object.entries(config.labels))
    for (const lang of ["pl", "en", "he"])
      assert.ok(values[lang]?.trim(), key + " " + lang);
});
test("Every item destination exists", async () => {
  for (const item of config.items) {
    const file = item.href === "/blog" ? "blog.html" : item.href.slice(1);
    assert.ok(await read(file));
  }
});
test("Map implementation protected", async () => {
  for (const [file, hash] of Object.entries(
    JSON.parse(await read("config/site-navigation-protected.json")),
  ))
    assert.equal(
      execFileSync("git", ["hash-object", file], { encoding: "utf8" }).trim(),
      hash,
      file,
    );
});
test("Homepage content remains byte-for-byte unchanged", async () => {
  const before = execFileSync("git", ["show", "a876023f:index.html"], {
    encoding: "utf8",
  });
  const after = await read("index.html");
  const main = (s) => s.match(/<main\b[\s\S]*?<\/main>/)[0];
  assert.equal(main(after), main(before));
});
test("Generator is deterministic", () => {
  execFileSync(
    process.execPath,
    ["scripts/render-site-navigation.mjs", "--check"],
    { stdio: "pipe" },
  );
});
const { localizedTitle, savedDestination, loadSaved, loadNotifications } =
  await import("../js/site-navigation-data.js");
test("Saved titles respect localized POI and catalog schemas", () => {
  assert.equal(
    localizedTitle({ name_i18n: { he: "חוף", en: "Beach" } }, "he"),
    "חוף",
  );
  assert.equal(
    localizedTitle({ title: '{"pl":"Rejs","en":"Cruise"}' }, "en"),
    "Cruise",
  );
  assert.equal(localizedTitle({ name_pl: "Plaża" }, "pl"), "Plaża");
  assert.equal(localizedTitle({ name_en: "Beach" }, "he"), "Beach");
  assert.equal(
    savedDestination("trip", { id: "a", slug: "with space" }),
    "/trip.html?slug=with%20space",
  );
  assert.equal(savedDestination("hotel", { id: "a" }), "/hotels.html");
  assert.equal(
    savedDestination("poi", { id: "a&b" }),
    "/index.html?poi=a%26b#map",
  );
});
test("Saved catalog queries only current user and saved published records", async () => {
  const calls = [];
  const sb = {
    from(table) {
      const q = {
        select(v) {
          calls.push([table, "select", v]);
          return q;
        },
        eq(k, v) {
          calls.push([table, "eq", k, v]);
          return q;
        },
        in(k, v) {
          calls.push([table, "in", k, v]);
          return q;
        },
        then(fn) {
          return Promise.resolve({
            data:
              table === "user_saved_catalog_items"
                ? [{ item_type: "trip", ref_id: "t" }]
                : [{ id: "t", slug: "trip", title: { en: "Trip" } }],
          }).then(fn);
        },
      };
      return q;
    },
  };
  const rows = await loadSaved(sb, "user-a", "en");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, "Trip");
  assert.ok(
    calls.some(
      (x) =>
        x[0] === "user_saved_catalog_items" &&
        x[2] === "user_id" &&
        x[3] === "user-a",
    ),
  );
  assert.ok(
    calls.some((x) => x[0] === "trips" && x[1] === "in" && x[3][0] === "t"),
  );
  assert.ok(
    calls.some(
      (x) => x[0] === "trips" && x[2] === "is_published" && x[3] === true,
    ),
  );
  assert.ok(!calls.some((x) => x[0] === "hotels"));
});
test("Saved errors propagate instead of displaying an empty success", async () => {
  const q = {
    select() {
      return q;
    },
    eq() {
      return q;
    },
    then(fn) {
      return Promise.resolve({ error: new Error("offline") }).then(fn);
    },
  };
  await assert.rejects(
    () => loadSaved({ from: () => q }, "user-a", "en"),
    /offline/,
  );
});
test("Public page content outside navigation retains its original main markup", async () => {
  for (const [file, { mode }] of Object.entries(pages)) {
    if (mode !== "standard") continue;
    const old = execFileSync("git", ["show", "a876023f:" + file], {
      encoding: "utf8",
    });
    const current = await read(file);
    const section = (s) => s.match(/<main\b[\s\S]*?<\/main>/)?.[0];
    // The approved rental filters are the only later addition inside car.html main.
    const rentalFilters = '\n              <fieldset class="vehicle-kind-filter" id="rentalVehicleKinds"></fieldset>\n              <div class="auto-checkbox"><input type="checkbox" id="rentalNorth"><label for="rentalNorth" data-rental-north-label>Jadę na północ Cypru</label></div>';
    const currentSection = file === "car.html" ? section(current)?.replace(rentalFilters, "") : section(current);
    assert.equal(currentSection, section(old), file);
  }
});

test("Saved vehicles use the model name in every language and retain their offer URL", () => {
  const car = {id:"car-1",car_model:{pl:"Auto PL",en:"Car EN",he:"רכב"},location:"larnaca"};
  for (const lang of ["pl","en","he"]) assert.equal(localizedTitle(car,lang),car.car_model[lang]);
  assert.equal(localizedTitle({car_model:'{"en":"Nissan Note"}'},"en"),"Nissan Note");
  assert.equal(savedDestination("car",car),"/car.html?offer_id=car-1&offer_location=larnaca");
});
