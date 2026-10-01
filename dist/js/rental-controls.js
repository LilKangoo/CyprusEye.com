import { cyprusNow, validRentalDateTime } from "./rental-date-values.js";
// Progressive presentation: existing inputs and their change handlers remain authoritative.
const byId = (id) => document.getElementById(id);
let activeLanguage = (
  new URLSearchParams(location.search).get("lang") ||
  document.documentElement.lang ||
  "en"
).split("-")[0];
const language = () => activeLanguage;
const words = {
  pl: [
    "Trasa i pasażerowie",
    "Termin wynajmu",
    "Dopasuj ofertę",
    "Odbiór pojazdu",
    "Zwrot pojazdu",
    "Szukaj",
    "Brak wyników",
    "Czas lokalny na Cyprze",
    "Godzina",
    "Minuty",
    "Zastosuj termin",
    "Anuluj",
    "Poprzedni miesiąc",
    "Następny miesiąc",
    "Wybierz przyszły termin. Zwrot musi być późniejszy niż odbiór.",
    "Wybierz datę i godzinę",
  ],
  en: [
    "Route and passengers",
    "Rental dates",
    "Tailor your rental",
    "Vehicle pickup",
    "Vehicle return",
    "Search",
    "No results",
    "Local Cyprus time",
    "Hour",
    "Minutes",
    "Apply date and time",
    "Cancel",
    "Previous month",
    "Next month",
    "Choose a future time. Return must be after pickup.",
    "Choose date and time",
  ],
  he: [
    "מסלול ונוסעים",
    "מועדי השכרה",
    "התאמת ההצעה",
    "איסוף הרכב",
    "החזרת הרכב",
    "חיפוש",
    "אין תוצאות",
    "שעון מקומי בקפריסין",
    "שעה",
    "דקות",
    "אישור המועד",
    "ביטול",
    "החודש הקודם",
    "החודש הבא",
    "בחרו מועד עתידי. ההחזרה חייבת להיות אחרי האיסוף.",
    "בחירת תאריך ושעה",
  ],
};
const t = (i) => (words[language()] || words.en)[i];
const locale = () =>
  ({ pl: "pl-PL", en: "en-GB", he: "he-IL" })[language()] || "en-GB";
const node = (tag, cls, text) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  return el;
};
const button = (cls, text) => {
  const el = node("button", cls, text);
  el.type = "button";
  return el;
};
const emit = (el) => el.dispatchEvent(new Event("change", { bubbles: true }));
const dateOf = (value) => new Date(`${value}T12:00:00`);
const dateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const openPickers = new Set();
const dateViews = new Map();
function enhanceSelect(select) {
  if (!select || select.dataset.rentalStyled) return;
  select.dataset.rentalStyled = "1";
  const oldLabel = select.closest("label");
  let field = select.closest(".auto-field");
  if (oldLabel) {
    field = node("div", "city-picker");
    const caption = node(
      "span",
      "city-caption",
      oldLabel.querySelector("span")?.textContent,
    );
    caption.id = select.id + "Caption";
    oldLabel.after(field);
    field.append(caption, select);
    oldLabel.remove();
  } else {
    if (!field) return;
    field.classList.add("booking-picker");
  }
  select.classList.add("rental-native");
  select.tabIndex = -1;
  select.setAttribute("aria-hidden", "true");
  const trigger = button("city-trigger");
  trigger.id = select.id + "Trigger";
  const display = node("span");
  display.id = select.id + "Display";
  trigger.append(display, node("span", "", "⌄"));
  const label = field.querySelector("label,.city-caption");
  if (label) {
    label.id = select.id + "Caption";
    trigger.setAttribute("aria-labelledby", `${label.id} ${display.id}`);
  }
  const panel = node("div", oldLabel ? "city-choices" : "booking-choice-list");
  panel.hidden = true;
  panel.id = select.id + "Choices";
  const search = node("input");
  search.type = "search";
  search.placeholder = t(5);
  search.setAttribute("aria-label", t(5));
  const list = node("div", "city-options");
  panel.append(search, list);
  field.append(trigger, panel);
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-controls", panel.id);
  const optionText = (opt) => {
    if (
      opt &&
      !opt.value &&
      [
        "pickupLocation",
        "returnLocation",
        "carsFinderPickupLocation",
        "carsFinderReturnLocation",
      ].includes(select.id)
    ) {
      return (
        { pl: "Wybierz miasto", en: "Choose city", he: "בחרו עיר" }[
          language()
        ] || "Choose city"
      );
    }
    return opt?.textContent || "—";
  };
  const update = () => {
    display.textContent = optionText(select.selectedOptions[0]);
    trigger.disabled = select.disabled;
  };
  const close = () => {
    panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    openPickers.delete(close);
  };
  const draw = () => {
    list.replaceChildren();
    for (const opt of select.options) {
      if (
        opt.hidden ||
        !optionText(opt)
          .toLocaleLowerCase()
          .includes(search.value.toLocaleLowerCase())
      )
        continue;
      const item = button("", optionText(opt));
      item.disabled = opt.disabled;
      item.setAttribute("aria-pressed", String(opt.selected));
      item.onclick = () => {
        select.value = opt.value;
        emit(select);
        update();
        close();
        if (trigger.isConnected) trigger.focus();
      };
      list.append(item);
    }
    if (!list.children.length) list.append(node("p", "", t(6)));
  };
  trigger.onclick = () => {
    const opening = panel.hidden;
    for (const closeOther of openPickers) closeOther();
    if (!opening) return;
    search.placeholder = t(5);
    search.value = "";
    draw();
    panel.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    openPickers.add(close);
    search.focus();
  };
  search.oninput = draw;
  field.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) {
      e.preventDefault();
      e.stopPropagation();
      close();
      trigger.focus();
    }
    if (e.key === "Enter" && e.target === search) {
      e.preventDefault();
      list.querySelector("button:not(:disabled)")?.click();
    }
    if (e.key === "ArrowDown" && e.target === search) {
      e.preventDefault();
      list.querySelector("button:not(:disabled)")?.focus();
    }
  });
  field.addEventListener("focusout", (e) => {
    if (e.relatedTarget && !field.contains(e.relatedTarget)) close();
  });
  select.addEventListener("focus", () => trigger.focus());
  select.addEventListener("invalid", (e) => {
    e.preventDefault();
    trigger.focus();
    trigger.setAttribute("aria-invalid", "true");
  });
  select.addEventListener("change", () => {
    trigger.removeAttribute("aria-invalid");
    update();
  });
  update();
  // Disconnected selects are collected with their observer; no document-wide per-field listeners.
  new MutationObserver(() => {
    update();
    if (!panel.hidden) draw();
  }).observe(select, {
    childList: true,
    subtree: true,
    attributes: true,
  });
}
function openCalendar(inputs, side, opener) {
  document.querySelector(".rental-date-dialog")?.remove();
  const date = byId(inputs[side][0]),
    time = byId(inputs[side][1]);
  if (!date || !time) return;
  const dialog = node("dialog", "rental-date-dialog");
  dialog.dir = language() === "he" ? "rtl" : "ltr";
  dialog.setAttribute("aria-labelledby", "rental-date-title");
  const header = node("header"),
    heading = node("div");
  heading.append(node("small", "", t(7)));
  const title = node("h2", "", t(side === "Pickup" ? 3 : 4));
  title.id = "rental-date-title";
  heading.append(title);
  const x = button("date-cancel", "×");
  x.setAttribute("aria-label", t(11));
  header.append(heading, x);
  const nav = node("div", "calendar-nav"),
    prev = button("", language() === "he" ? "›" : "‹"),
    next = button("", language() === "he" ? "‹" : "›"),
    monthLabel = node("strong");
  prev.setAttribute("aria-label", t(12));
  next.setAttribute("aria-label", t(13));
  nav.append(prev, monthLabel, next);
  const week = node("div", "calendar-week"),
    days = node("div", "calendar-days");
  for (let i = 0; i < 7; i++)
    week.append(
      node(
        "span",
        "",
        new Intl.DateTimeFormat(locale(), { weekday: "short" }).format(
          new Date(2026, 0, 5 + i),
        ),
      ),
    );
  const times = node("div", "time-choice");
  const makeTime = (count, index) => {
    const label = node("label", "", t(index)),
      select = node("select");
    select.setAttribute("aria-label", t(index));
    for (let i = 0; i < count; i++) {
      const opt = node("option", "", String(i).padStart(2, "0"));
      select.append(opt);
    }
    label.append(select);
    times.append(label);
    return select;
  };
  const hour = makeTime(24, 8),
    minute = makeTime(60, 9);
  const error = node("p", "date-validation");
  error.setAttribute("role", "alert");
  const footer = node("footer"),
    cancel = button("date-cancel", t(11)),
    apply = button("apply-date", t(10));
  footer.append(cancel, apply);
  dialog.append(header, nav, week, days, times, error, footer);
  const minimum = () => {
    const now = cyprusNow();
    let min = `${now.date}T${now.time}`;
    if (side === "Return") {
      const pickup = `${byId(inputs.Pickup[0])?.value}T${byId(inputs.Pickup[1])?.value}`;
      if (pickup > min) min = pickup;
    }
    return min;
  };
  let selected = date.value || minimum().slice(0, 10);
  if (selected < minimum().slice(0, 10)) selected = minimum().slice(0, 10);
  let month = dateOf(selected);
  [hour.value, minute.value] = (time.value || "10:00").split(":");
  const valid = () =>
    validRentalDateTime(selected, `${hour.value}:${minute.value}`, minimum());
  const validate = () => {
    apply.disabled = !valid();
    error.textContent = valid() ? "" : t(14);
  };
  const draw = () => {
    monthLabel.textContent = new Intl.DateTimeFormat(locale(), {
      month: "long",
      year: "numeric",
    }).format(month);
    days.replaceChildren();
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    for (let i = 0; i < (first.getDay() + 6) % 7; i++)
      days.append(node("span"));
    const count = new Date(
      month.getFullYear(),
      month.getMonth() + 1,
      0,
    ).getDate();
    for (let d = 1; d <= count; d++) {
      const key = dateKey(new Date(month.getFullYear(), month.getMonth(), d));
      const b = button("", d);
      b.disabled = key < minimum().slice(0, 10);
      b.setAttribute("aria-pressed", String(key === selected));
      b.setAttribute(
        "aria-label",
        new Intl.DateTimeFormat(locale(), { dateStyle: "full" }).format(
          dateOf(key),
        ),
      );
      if (key === cyprusNow().date) b.classList.add("is-today");
      b.onclick = () => {
        selected = key;
        draw();
      };
      days.append(b);
    }
    prev.disabled =
      dateKey(new Date(month.getFullYear(), month.getMonth(), 1)).slice(0, 7) <=
      minimum().slice(0, 7);
    validate();
  };
  prev.onclick = () => {
    month = new Date(month.getFullYear(), month.getMonth() - 1, 1);
    draw();
  };
  next.onclick = () => {
    month = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    draw();
  };
  hour.onchange = minute.onchange = validate;
  cancel.onclick = x.onclick = () => dialog.close();
  apply.onclick = () => {
    if (!valid()) {
      validate();
      return;
    }
    date.value = selected;
    time.value = `${hour.value}:${minute.value}`;
    emit(date);
    emit(time);
    dialog.close();
  };
  dialog.addEventListener("close", () => {
    dialog.remove();
    if (opener.isConnected) opener.focus();
  });
  document.body.append(dialog);
  draw();
  dialog.showModal();
}
function datePanel(parent, inputs, side) {
  const date = byId(inputs[side][0]),
    time = byId(inputs[side][1]);
  if (!date || !time || date.dataset.rentalStyled) return;
  date.dataset.rentalStyled = "1";
  const panel = node("section", "date-time-panel booking-date-panel"),
    title = node("h4", "", t(side === "Pickup" ? 3 : 4));
  title.dataset.rentalWord = String(side === "Pickup" ? 3 : 4);
  const control = button("date-open"),
    display = node("span", "date-display"),
    clock = node("span", "time-display");
  control.append(display, clock, node("span", "", "⌄"));
  panel.append(title, control);
  for (const input of [date, time]) {
    const field = input.closest("label,.auto-field");
    input.classList.add("rental-native");
    input.tabIndex = -1;
    input.setAttribute("aria-hidden", "true");
    panel.append(input);
    field?.remove();
    input.addEventListener("focus", () => control.focus());
    input.addEventListener("invalid", (e) => {
      e.preventDefault();
      control.focus();
      control.setAttribute("aria-invalid", "true");
    });
  }
  parent.append(panel);
  const update = () => {
    title.textContent = t(side === "Pickup" ? 3 : 4);
    display.textContent = date.value
      ? new Intl.DateTimeFormat(locale(), {
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(dateOf(date.value))
      : t(15);
    clock.textContent = time.value || "—";
    control.setAttribute(
      "aria-label",
      `${title.textContent}: ${display.textContent} ${clock.textContent}`,
    );
    control.removeAttribute("aria-invalid");
  };
  panel.onclick = (e) => {
    if (!e.target.matches("input")) openCalendar(inputs, side, control);
  };
  dateViews.set(date, update);
  date.addEventListener("change", update);
  time.addEventListener("change", update);
  update();
}
function switches(root) {
  for (const input of root.querySelectorAll(
    ".auto-checkbox input[type=checkbox]",
  )) {
    const label = root.querySelector(`label[for="${input.id}"]`);
    if (label) {
      label.classList.add("booking-switch");
      input.classList.add("rental-native");
    }
  }
}

function enhanceFinder() {
  const home = byId("carsHomeFinder"),
    landing = byId("carRentalCalculator");
  const root = home || landing;
  if (!root) return;
  const grid = root.querySelector(
    ".home-cars-finder-grid,.auto-calculator-grid",
  );
  if (!grid || grid.dataset.rentalLayout) return;
  grid.dataset.rentalLayout = "1";
  grid.classList.add("rental-finder-grid");
  root.classList.add("rental-ui");
  const ids = home
    ? {
        Pickup: ["carsFinderPickupDate", "carsFinderPickupTime"],
        Return: ["carsFinderReturnDate", "carsFinderReturnTime"],
      }
    : {
        Pickup: ["pickupDate", "pickupTime"],
        Return: ["returnDate", "returnTime"],
      };
  const routes = home
    ? [
        "carsFinderPickupLocation",
        "carsFinderReturnLocation",
        "carsFinderPassengers",
      ]
    : ["pickupLocation", "returnLocation", "rentalPassengers"];
  const kinds = grid.querySelector(".vehicle-kind-filter");
  if (kinds) grid.prepend(kinds);
  const blocks = [];
  for (let i = 0; i < 3; i++) {
    const block = node(
      "section",
      ["route-block", "dates-block", "extras-block"][i],
    );
    const heading = node("h3", "block-heading", t(i));
    heading.dataset.rentalWord = String(i);
    block.append(heading);
    const fields = node(
      "div",
      ["route-fields", "date-fields", "extras-fields"][i],
    );
    block.append(fields);
    blocks.push(fields);
    grid.append(block);
  }
  for (const id of routes) {
    const el = byId(id);
    const field = el?.closest("label,.auto-field");
    if (field) blocks[0].append(field);
  }
  for (const side of ["Pickup", "Return"]) datePanel(blocks[1], ids, side);
  if (home) {
    const extras = grid.querySelector(".home-cars-finder-field--extras");
    if (extras) blocks[2].append(extras);
  } else {
    grid
      .querySelectorAll(":scope > .auto-checkbox")
      .forEach((el) => blocks[2].append(el));
    switches(root);
  }
  routes.slice(0, 2).forEach((id) => enhanceSelect(byId(id)));
}
function enhanceModal() {
  const modal = byId("carHomeModal");
  if (!modal) return;
  const ids = {
    Pickup: ["res_pickup_date", "res_pickup_time"],
    Return: ["res_return_date", "res_return_time"],
  };
  for (const side of ["Pickup", "Return"]) {
    const date = byId(ids[side][0]);
    const row = date?.closest(".auto-form-date-row");
    if (row) datePanel(row, ids, side);
  }
  ["res_pickup_place_type", "res_return_place_type", "res_car"].forEach((id) =>
    enhanceSelect(byId(id)),
  );
  switches(modal);
}
function enhance() {
  for (const date of dateViews.keys())
    if (!date.isConnected) dateViews.delete(date);
  enhanceFinder();
  enhanceModal();
}
if (typeof document !== "undefined") {
  new MutationObserver(() => {
    activeLanguage = (document.documentElement.lang || "en").split("-")[0];
    document
      .querySelectorAll("[data-rental-word]")
      .forEach((el) => (el.textContent = t(Number(el.dataset.rentalWord))));
    for (const [date, update] of dateViews) {
      if (date.isConnected) update();
      else dateViews.delete(date);
    }
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"],
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".city-picker,.booking-picker"))
      for (const close of openPickers) close();
  });
  const start = () => {
    enhance();
    const finder = byId("carsHomeFinder") || byId("carRentalCalculator");
    if (finder)
      new MutationObserver(enhanceFinder).observe(finder, {
        childList: true,
        subtree: true,
      });
  };
  const watchModal = () => {
    const modal = byId("carHomeModal");
    if (!modal || modal.dataset.rentalObserved) return !!modal;
    modal.dataset.rentalObserved = "1";
    enhanceModal();
    new MutationObserver(enhanceModal).observe(modal, {
      childList: true,
      subtree: true,
    });
    return true;
  };
  if (!watchModal()) {
    const discover = new MutationObserver(() => {
      if (watchModal()) discover.disconnect();
    });
    discover.observe(document.body, { childList: true });
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
}
