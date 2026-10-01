import { supabase } from "/js/supabaseClient.js";
const labels = {
  pl: [
    "Rodzaj pojazdu",
    "Możesz wybrać kilka. Brak zaznaczenia = wszystkie rodzaje.",
    "Jadę na północ Cypru",
    "Nie udało się pobrać rodzajów pojazdów. Odśwież stronę.",
  ],
  en: [
    "Vehicle type",
    "Choose several. No selection means all types.",
    "Travelling to northern Cyprus",
    "Could not load vehicle types. Refresh the page.",
  ],
  he: [
    "סוג כלי רכב",
    "אפשר לבחור כמה. ללא בחירה מוצגים כל הסוגים.",
    "נוסעים לצפון קפריסין",
    "לא ניתן לטעון סוגי כלי רכב. רעננו את הדף.",
  ],
};
let kinds = [],
  failed = false;
function render() {
  const root = document.getElementById("rentalVehicleKinds");
  if (!root) return;
  const lang = (
      window.appI18n?.language ||
      document.documentElement.lang ||
      "en"
    ).split("-")[0],
    t = labels[lang] || labels.en;
  const selected = new Set(
    Array.from(root.querySelectorAll("input:checked")).map((el) => el.value),
  );
  root.replaceChildren();
  const legend = document.createElement("legend");
  legend.textContent = t[0];
  const hint = document.createElement("p");
  hint.textContent = failed ? t[3] : t[1];
  const options = document.createElement("div");
  options.className = "vehicle-kind-options";
  for (const kind of kinds) {
    const label = document.createElement("label"),
      input = document.createElement("input"),
      text = document.createElement("span");
    input.type = "checkbox";
    input.value = kind.id;
    input.checked = selected.has(kind.id);
    text.textContent = `${{ car: "🚗", quad: "🛞", buggy: "🏎️", scooter: "🛵", bicycle: "🚲" }[kind.code] || "◈"} ${kind.name_i18n?.[lang] || kind.name_i18n?.en || kind.code}`;
    label.append(input, text);
    options.append(label);
  }
  root.append(legend, hint, options);
  const north = document.querySelector("[data-rental-north-label]");
  if (north) {
    const input = north.querySelector("input");
    north.replaceChildren();
    if (input) north.append(input);
    north.append(document.createTextNode(t[2]));
  }
}
try {
  const result = await supabase
    .from("car_vehicle_kinds")
    .select("id,code,name_i18n,is_active,sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("code", { ascending: true });
  failed = !!result.error;
  kinds = result.error ? [] : result.data || [];
} catch {
  failed = true;
}
render();
new MutationObserver(render).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["lang"],
});
