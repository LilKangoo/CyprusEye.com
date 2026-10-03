/* Home map presentation. Existing catalog modules retain ownership of data and actions. */
(() => {
  "use strict";
  const root = document.getElementById("current-objective");
  if (!root) return;
  const KEY = "ce_home_map_preferences_v1";
  const types = ["poi", "recommendation", "hotel"];
  let prefs = {};
  try {
    prefs = JSON.parse(localStorage.getItem(KEY)) || {};
  } catch (_) {}
  const state = {
    layer: ["road", "satellite", "hybrid"].includes(prefs.layer)
      ? prefs.layer
      : "hybrid",
    collapsed: typeof prefs.collapsed === "boolean" ? prefs.collapsed : true,
    types: Array.isArray(prefs.types)
      ? prefs.types.filter((t) => types.includes(t))
      : [...types],
    categories: Array.isArray(prefs.categories)
      ? prefs.categories.filter((c) => typeof c === "string").slice(0, 100)
      : [],
    dismissed: prefs.dismissed === true,
    saved: false,
    sortOrigin: null,
    position: null,
    query: "",
  };
  const copy = {
    pl: {
      map: "Interaktywna mapa Cypru",
      search: "Szukaj miejsca lub miasta",
      categories: "Kategorie",
      saved: "Zapisane",
      collapse: "Zwiń",
      expand: "Rozwiń",
      close: "Zamknij",
      poi: "Do odwiedzenia",
      recommendation: "Polecane",
      hotel: "Polecane hotele",
      all: "Pokaż wszystkie",
      done: "Pokaż miejsca",
      multi: "Możesz wybrać kilka",
      themes: "Kategorie miejsc",
      layers: "Widok mapy",
      road: "Mapa drogowa",
      satellite: "Satelita",
      hybrid: "Satelita + opisy",
      locate: "Moja lokalizacja",
      plus: "Przybliż",
      minus:
        "Oddal — przytrzymaj, aby zobaczyć cały Cypr (klawiatura: Shift+Enter)",
      empty: "Brak miejsc dla wybranych filtrów.",
      searchEmpty: "Nie znaleziono miejsca. Spróbuj innej nazwy.",
      denied:
        "Dostęp do lokalizacji jest zablokowany. Włącz go w ustawieniach przeglądarki.",
      unavailable:
        "Lokalizacja jest chwilowo niedostępna. Sprawdź usługi lokalizacji urządzenia i spróbuj ponownie.",
      timeout: "Ustalanie lokalizacji trwało zbyt długo. Spróbuj ponownie.",
      unsupported: "Ta przeglądarka nie udostępnia lokalizacji.",
      recent: "Używam ostatniej pozycji uzyskanej w ciągu ostatniej minuty.",
      locating: "Ustalam lokalizację…",
      distance: "Odległość w linii prostej",
      group: "miejsc — przybliż grupę",
      description: "Opis miejsca",
      uncategorized: "Inne",
      landmark: "Zabytki",
      beach: "Plaże",
      nature: "Natura",
      viewpoint: "Punkty widokowe",
      food: "Jedzenie",
      shopping: "Zakupy",
      activity: "Aktywności",
      airport: "Lotniska",
    },
    en: {
      map: "Interactive map of Cyprus",
      search: "Search places or towns",
      categories: "Categories",
      saved: "Saved",
      collapse: "Collapse",
      expand: "Expand",
      close: "Close",
      poi: "Places to visit",
      recommendation: "Recommended",
      hotel: "Recommended hotels",
      all: "Show all",
      done: "Show places",
      multi: "Choose more than one",
      themes: "Place categories",
      layers: "Map style",
      road: "Road map",
      satellite: "Satellite",
      hybrid: "Satellite + labels",
      locate: "My location",
      plus: "Zoom in",
      minus: "Zoom out — hold for all Cyprus (keyboard: Shift+Enter)",
      empty: "No places match these filters.",
      searchEmpty: "No places found. Try another name.",
      denied: "Location access is blocked. Enable it in your browser settings.",
      unavailable:
        "Location is temporarily unavailable. Check your device location services and try again.",
      timeout: "Finding your location timed out. Please try again.",
      unsupported: "This browser does not support location access.",
      recent: "Using your last position obtained within the past minute.",
      locating: "Finding your location…",
      distance: "Straight-line distance",
      group: "places — zoom into group",
      description: "Place description",
      uncategorized: "Other",
      landmark: "Landmarks",
      beach: "Beaches",
      nature: "Nature",
      viewpoint: "Viewpoints",
      food: "Food",
      shopping: "Shopping",
      activity: "Activities",
      airport: "Airports",
    },
    he: {
      map: "מפה אינטראקטיבית של קפריסין",
      search: "חיפוש מקום או עיר",
      categories: "קטגוריות",
      saved: "שמורים",
      collapse: "צמצום",
      expand: "הרחבה",
      close: "סגירה",
      poi: "מקומות לביקור",
      recommendation: "מומלצים",
      hotel: "מלונות מומלצים",
      all: "הצגת הכול",
      done: "הצגת מקומות",
      multi: "אפשר לבחור כמה קטגוריות",
      themes: "קטגוריות מקומות",
      layers: "תצוגת מפה",
      road: "מפת כבישים",
      satellite: "לוויין",
      hybrid: "לוויין עם תוויות",
      locate: "המיקום שלי",
      plus: "התקרבות",
      minus: "התרחקות — לחיצה ארוכה להצגת כל קפריסין (Shift+Enter)",
      empty: "אין מקומות התואמים למסננים.",
      searchEmpty: "לא נמצאו מקומות. נסו שם אחר.",
      denied: "הגישה למיקום חסומה. אפשרו אותה בהגדרות הדפדפן.",
      unavailable:
        "המיקום אינו זמין כרגע. בדקו את שירותי המיקום במכשיר ונסו שוב.",
      timeout: "תם הזמן לאיתור המיקום. נסו שוב.",
      unsupported: "הדפדפן הזה אינו תומך בגישה למיקום.",
      recent: "נעשה שימוש במיקום האחרון שהתקבל בדקה האחרונה.",
      locating: "מאתר את המיקום…",
      distance: "מרחק בקו אווירי",
      group: "מקומות — הגדלת הקבוצה",
      description: "תיאור המקום",
      uncategorized: "אחר",
      landmark: "אתרים",
      beach: "חופים",
      nature: "טבע",
      viewpoint: "תצפיות",
      food: "אוכל",
      shopping: "קניות",
      activity: "פעילויות",
      airport: "שדות תעופה",
    },
  };
  Object.assign(copy.he, {
    caffe: "בתי קפה",
    "religious-sites": "אתרי דת",
    restaurants: "מסעדות",
    shop: "חנויות",
    tattoo: "קעקועים",
    shipwreck: "ספינות טרופות",
  });
  const lang = () =>
    ["pl", "en", "he"].includes(document.documentElement.lang.slice(0, 2))
      ? document.documentElement.lang.slice(0, 2)
      : "en";
  const t = (key) => copy[lang()][key] || copy.en[key] || key;
  const q = (selector) => root.querySelector(selector);
  const key = (item) => `${item.type}:${item.id}`;
  const normalize = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  let map,
    api,
    clusterLayer,
    layers,
    activeLayer,
    frame,
    cameraOnUser = false,
    locating = false,
    selectionTouched = false,
    warmTimer,
    warmGeneration = 0,
    allItems = [],
    visibleItems = [],
    initialized = false;
  // Resolve a saved POI only after the catalog arrives. Do not let old
  // category/saved filters hide the target of an explicit navigation link.
  let linkedPoiId = new URLSearchParams(window.location?.search || "").get("poi");
  const boundMarkers = new WeakSet();
  const island = [
    [34.625019, 32.271739],
    [35.691962, 34.59254],
  ];
  function save() {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          layer: state.layer,
          collapsed: state.collapsed,
          types: state.types,
          categories: state.categories,
          dismissed: state.dismissed,
        }),
      );
    } catch (_) {}
  }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(id, text, action) {
    const node = element("button", "hm-button", text);
    node.type = "button";
    node.id = id;
    if (action) node.addEventListener("click", action);
    return node;
  }
  function data(item) {
    const source =
      item.type === "poi"
        ? window.PLACES_DATA
        : item.type === "hotel"
          ? window.getMapHotelsData?.()
          : window.getMapRecommendationsData?.();
    return (source || []).find((row) => String(row.id) === String(item.id));
  }
  function coords(item) {
    const row = data(item);
    const lat = parseFloat(row?.lat ?? row?.latitude),
      lng = parseFloat(row?.lng ?? row?.lon ?? row?.longitude);
    return Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180
      ? L.latLng(lat, lng)
      : null;
  }
  function name(item) {
    const row = data(item) || {};
    if (item.type === "poi" && window.getPoiName) return window.getPoiName(row);
    return (
      row.name_i18n?.[lang()] ||
      row.title_i18n?.[lang()] ||
      row[`name_${lang()}`] ||
      row[`title_${lang()}`] ||
      row.name ||
      row.title ||
      row.name_en ||
      row.name_pl ||
      row.id
    );
  }
  function category(item) {
    if (item.type === "hotel")
      return { slug: "hotel", icon: "🏨", name: t("hotel"), color: "#f59e0b" };
    const row = data(item) || {};
    const meta =
      item.type === "poi"
        ? api?.category(row)
        : window.getRecommendationCategoryMeta?.(row);
    const slug =
      meta?.slug || row.category_slug || row.category || "uncategorized";
    const entry = (window.POI_CATEGORIES_DATA || []).find(
      (c) => c.slug === slug,
    );
    return {
      slug,
      color:
        meta?.color ||
        entry?.color ||
        row.category_color ||
        (item.type === "recommendation" ? "#22c55e" : "#1f6feb"),
      icon:
        meta?.icon ||
        row.category_icon ||
        (item.type === "recommendation" ? "⭐" : "📍"),
      name:
        entry?.[`name_${lang()}`] || copy[lang()][slug] || meta?.name || slug,
    };
  }
  function matches(item) {
    if (!state.types.includes(item.type)) return false;
    if (
      item.type !== "hotel" &&
      state.categories.length &&
      !state.categories.includes(category(item).slug)
    )
      return false;
    if (
      state.saved &&
      !window.CE_SAVED_CATALOG?.isSaved(item.type, String(item.id))
    )
      return false;
    return true;
  }
  function matchesQuery(item) {
    if (state.query) {
      const row = data(item) || {};
      const words = [
        name(item),
        ...Object.values(row.name_i18n || {}),
        ...Object.values(row.title_i18n || {}),
        row.name,
        row.name_pl,
        row.name_en,
        row.name_he,
        row.title,
        row.title_pl,
        row.title_en,
        row.title_he,
        row.city,
        row.region,
        row.location,
      ];
      if (!normalize(words.join(" ")).includes(normalize(state.query)))
        return false;
    }
    return true;
  }
  let routeSignature = "";
  let routeKeys = [];
  function filterItems(items) {
    allItems = items;
    if (linkedPoiId && items.some(item => item.type === "poi" && String(item.id) === linkedPoiId)) {
      state.types = [...types];
      state.categories = [];
      state.saved = false;
      state.query = "";
    }
    const candidates = items.filter(matches).map((item) => ({
      item,
      id: key(item),
      point: coords(item),
    }));
    // Selection and background GPS fixes must never reshuffle the route.
    const signature = JSON.stringify([
      state.sortOrigin && [state.sortOrigin.lat, state.sortOrigin.lng],
      candidates.map(({ id, point }) => [id, point?.lat, point?.lng]),
    ]);
    if (signature !== routeSignature) {
      const remaining = candidates
        .filter(({ point }) => point)
        .sort((a, b) => a.id.localeCompare(b.id));
      routeKeys = [];
      let origin = state.sortOrigin;
      if (!origin && remaining.length) {
        origin = remaining.reduce(
          (west, entry) =>
            entry.point.lng < west.lng ||
            (entry.point.lng === west.lng && entry.point.lat < west.lat)
              ? entry.point
              : west,
          remaining[0].point,
        );
      }
      // Build once: each step visits the closest unvisited place, not the
      // next distance from the user's original location on the opposite side.
      while (remaining.length) {
        let nearest = 0;
        let distance = Infinity;
        remaining.forEach((entry, index) => {
          const nextDistance = origin.distanceTo(entry.point);
          if (nextDistance < distance) {
            nearest = index;
            distance = nextDistance;
          }
        });
        const [next] = remaining.splice(nearest, 1);
        routeKeys.push(next.id);
        origin = next.point;
      }
      routeKeys.push(
        ...candidates.filter(({ point }) => !point).map(({ id }) => id),
      );
      routeSignature = signature;
    }
    const byKey = new Map(candidates.map(({ id, item }) => [id, item]));
    visibleItems = routeKeys.map((id) => byKey.get(id));
    schedule();
    return visibleItems;
  }
  function refresh() {
    save();
    api.refresh();
    requestAnimationFrame(() => center());
  }
  function selected() {
    return (
      window.currentMapItem ||
      (window.currentPlaceId
        ? { type: "poi", id: window.currentPlaceId }
        : null)
    );
  }
  function center(
    item = selected(),
    zoom = map?.getZoom(),
    onUser = arguments.length === 0 && cameraOnUser,
  ) {
    if (!map) return;
    // Keep location focus through card/layout updates until a place is explicitly selected.
    const target = onUser
      ? state.position
      : item && (api.getMarker(item)?.getLatLng() || coords(item));
    cameraOnUser = onUser;
    if (!target) return;
    map.stop();
    map.invalidateSize({ pan: false });
    const mobile = root.clientWidth <= 600;
    const cardHeight = q("#currentPlaceSection").getBoundingClientRect().height;
    // getBoundsZoom clamps to the current minimum; clear it before fitting a smaller screen.
    map.setMinZoom(0);
    map.setMinZoom(
      map.getBoundsZoom(
        L.latLngBounds(island),
        false,
        mobile ? L.point(80, 160 + cardHeight) : L.point(60, 170),
      ),
    );
    const size = map.getSize(),
      rect = root.getBoundingClientRect(),
      card = q("#currentPlaceSection").getBoundingClientRect();
    let desired = size.divideBy(2);
    if (!state.collapsed) {
      if (rect.width <= 600)
        desired.y = (110 + Math.max(130, card.top - rect.top)) / 2;
      else
        desired.x =
          card.left + card.width / 2 < rect.left + rect.width / 2
            ? (card.right - rect.left + size.x) / 2
            : (card.left - rect.left) / 2;
    }
    const offset = desired.subtract(size.divideBy(2));
    const actualZoom = Math.max(
      map.getMinZoom(),
      Math.min(map.getMaxZoom(), zoom),
    );
    const targetCenter = map.unproject(
      map.project(target, actualZoom).subtract(offset),
      actualZoom,
    );
    map.setView(targetCenter, actualZoom, {
      animate: !matchMedia("(prefers-reduced-motion: reduce)").matches,
      duration: 0.3,
    });
  }
  function overview(animate = true) {
    if (!map) return;
    cameraOnUser = false;
    if (animate) {
      state.collapsed = true;
      save();
      renderCard();
    }
    map.stop();
    map.invalidateSize({ pan: false });
    const mobile = root.clientWidth <= 600;
    const cardHeight = q("#currentPlaceSection").getBoundingClientRect().height;
    const padding = mobile ? L.point(80, 160 + cardHeight) : L.point(60, 170);
    map.setMinZoom(0);
    const zoom = map.getBoundsZoom(L.latLngBounds(island), false, padding);
    map.setMinZoom(zoom);
    const offset = mobile
      ? L.point(0, (110 - cardHeight - 50) / 2)
      : L.point(0, 0);
    const target = map.unproject(
      map.project(L.latLngBounds(island).getCenter(), zoom).subtract(offset),
      zoom,
    );
    map.setView(target, zoom, {
      animate:
        animate && !matchMedia("(prefers-reduced-motion: reduce)").matches,
      duration: 0.3,
    });
  }
  function collapse(value) {
    if (state.collapsed === value) return;
    state.collapsed = value;
    save();
    renderCard();
    requestAnimationFrame(() => center());
  }
  function renderCard() {
    const card = q("#currentPlaceSection");
    card.classList.toggle("hm-collapsed", state.collapsed);
    const toggle = q("#hm-collapse");
    toggle.textContent =
      t(state.collapsed ? "expand" : "collapse") +
      (state.collapsed ? " ↑" : " ↓");
    toggle.setAttribute("aria-expanded", String(!state.collapsed));
    q("#currentPlaceContent").hidden = state.collapsed;
    q("#prevPlaceBtn").textContent = lang() === "he" ? "→" : "←";
    q("#nextPlaceBtn").textContent = lang() === "he" ? "←" : "→";
    const distance = q("#hm-distance"),
      point = selected() && coords(selected());
    distance.textContent =
      point && state.position
        ? `${(point.distanceTo(state.position) / 1000).toLocaleString(lang(), { maximumFractionDigits: 1 })} km · ${t("distance")}`
        : "";
  }
  function closeMenus(focus = false) {
    for (const [menu, trigger] of [
      ["hm-categories", "hm-category"],
      ["hm-layers", "hm-layer"],
    ]) {
      const node = q("#" + menu),
        btn = q("#" + trigger);
      if (!node.hidden && focus) btn.focus();
      node.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    }
  }
  function toggleMenu(id, trigger) {
    const open = q("#" + id).hidden;
    closeMenus();
    q("#" + id).hidden = !open;
    q("#" + trigger).setAttribute("aria-expanded", String(open));
    if (open) {
      if (id === "hm-categories") renderCategories();
      collapse(true);
      const prompt = q(".map-location-prompt");
      if (prompt) prompt.hidden = true;
      q("#" + id)
        .querySelector("button,input")
        ?.focus();
    }
  }
  function reset() {
    state.types = [...types];
    state.categories = [];
    state.saved = false;
    state.query = "";
    q("#hm-search").value = "";
    refresh();
  }
  function renderCategories() {
    if (q("#hm-categories").hidden) return;
    const list = q("#hm-category-list");
    const focused = document.activeElement?.dataset?.filterKey;
    const scroll = list.scrollTop;
    list.replaceChildren();
    const row = (value, icon, label, count, checked, type) => {
      const line = element("label", "hm-category-row"),
        input = element("input");
      input.type = "checkbox";
      input.checked = checked;
      input.dataset.filterKey = type + ":" + value;
      input.addEventListener("change", () => {
        const arr = state[type];
        state[type] = input.checked
          ? [...arr, value]
          : arr.filter((v) => v !== value);
        refresh();
      });
      line.append(
        input,
        element("span", "hm-emoji", icon),
        element("span", "hm-category-label", label),
        element("span", "hm-count", count),
      );
      list.append(line);
    };
    for (const type of types)
      row(
        type,
        { poi: "📍", recommendation: "⭐", hotel: "🏨" }[type],
        t(type),
        allItems.filter((i) => i.type === type).length,
        state.types.includes(type),
        "types",
      );
    list.append(element("h4", "", t("themes")));
    const cats = new Map();
    allItems
      .filter((i) => i.type !== "hotel" && state.types.includes(i.type))
      .forEach((item) => {
        const c = category(item);
        const old = cats.get(c.slug);
        cats.set(c.slug, { ...c, count: (old?.count || 0) + 1 });
      });
    [...cats.values()]
      .sort((a, b) => a.name.localeCompare(b.name, lang()))
      .forEach((c) =>
        row(
          c.slug,
          c.icon,
          c.name,
          c.count,
          state.categories.includes(c.slug),
          "categories",
        ),
      );
    list.scrollTop = scroll;
    if (focused)
      [...list.querySelectorAll("input")]
        .find((n) => n.dataset.filterKey === focused)
        ?.focus({ preventScroll: true });
    q("#hm-category-done").textContent =
      `${t("done")} (${visibleItems.length})`;
  }
  function select(item) {
    selectionTouched = true;
    state.query = "";
    q("#hm-search").value = "";
    window.setCurrentMapItem?.(item, {
      focus: false,
      scroll: false,
      force: true,
    });
    q("#hm-results").hidden = true;
    q("#hm-search").blur();
    center(item);
  }
  function searchResults() {
    return visibleItems.filter(matchesQuery);
  }
  function renderResults() {
    const list = q("#hm-results");
    // Do not replace a suggestion while it has keyboard focus.
    if (list.contains(document.activeElement)) return;
    list.replaceChildren();
    list.hidden =
      !state.query ||
      (document.activeElement !== q("#hm-search") &&
        !list.contains(document.activeElement));
    if (!state.query) return;
    const results = searchResults();
    if (!results.length) list.append(element("p", "", t("searchEmpty")));
    results.slice(0, 8).forEach((item) => {
      const b = button("", `${category(item).icon} ${name(item)}`, () =>
        select(item),
      );
      list.append(b);
    });
  }
  function schedule() {
    if (!initialized || frame) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      render();
    });
  }
  function renderMarkers() {
    clusterLayer.clearLayers();
    const allowed = new Set(visibleItems.map(key)),
      active = selected(),
      activeKey = active ? key(active) : "";
    const candidates = [];
    for (const item of allItems) {
      const marker = api.getMarker(item),
        node = marker?.getElement();
      if (!node) continue;
      node.setAttribute("aria-label", name(item));
      if (!boundMarkers.has(marker)) {
        marker.on("click", () => requestAnimationFrame(() => center(item)));
        boundMarkers.add(marker);
      }
      const show = allowed.has(key(item));
      node.style.display = show ? "" : "none";
      const color = category(item).color;
      node.style.setProperty(
        "--hm-marker-color",
        CSS.supports("color", color) ? color : "#1f6feb",
      );
      node.classList.toggle("hm-selected", key(item) === activeKey);
      marker.setZIndexOffset(key(item) === activeKey ? 25000 : 1000);
      if (show && key(item) !== activeKey && map.getZoom() < 15)
        candidates.push({
          item,
          marker,
          node,
          point: map.latLngToLayerPoint(marker.getLatLng()),
        });
    }
    const groups = [];
    for (const candidate of candidates) {
      let group = groups.find(
        (g) => g[0].point.distanceTo(candidate.point) < 58,
      );
      if (!group) {
        group = [];
        groups.push(group);
      }
      group.push(candidate);
    }
    for (const group of groups) {
      if (group.length < 2) continue;
      group.forEach((c) => {
        c.node.style.display = "none";
      });
      const composition = [...new Set(group.map((c) => category(c.item).icon))]
        .slice(0, 3)
        .join("");
      const content = element("div", "hm-cluster-content");
      content.append(
        element("strong", "", group.length),
        element("span", "", composition),
      );
      const bounds = L.latLngBounds(group.map((c) => c.marker.getLatLng()));
      const marker = L.marker(bounds.getCenter(), {
        icon: L.divIcon({
          className: "hm-cluster",
          html: content,
          iconSize: [58, 48],
          iconAnchor: [29, 24],
        }),
        title: `${group.length} ${t("group")}`,
        zIndexOffset: 2000,
      });
      marker.on("click", () => {
        const targetZoom = Math.min(
          16,
          Math.max(
            map.getZoom() + 1,
            map.getBoundsZoom(bounds, false, [120, 160]),
          ),
        );
        map.setView(bounds.getCenter(), targetZoom, {
          animate: !matchMedia("(prefers-reduced-motion: reduce)").matches,
        });
      });
      marker.addTo(clusterLayer);
    }
  }
  function openPoi(id) {
    if (!initialized || !id) return false;
    linkedPoiId = String(id);
    api.refresh();
    // Refresh supplies the existing catalog synchronously. Render now rather
    // than waiting for a new document or another map event.
    render();
    root.scrollIntoView({ block: "start", behavior: "instant" });
    return true;
  }
  function render() {
    if (linkedPoiId && typeof window.setCurrentMapItem === "function") {
      const target = visibleItems.find(item => item.type === "poi" && String(item.id) === linkedPoiId);
      if (target) {
        linkedPoiId = null;
        select(target);
        collapse(false);
        center(target, Math.max(map.getZoom(), 13));
      }
    }
    // Late-arriving hotels/recommendations can be nearer than the first POI batch.
    if (
      !selectionTouched &&
      visibleItems.length &&
      key(selected() || {}) !== key(visibleItems[0])
    )
      window.setCurrentMapItem?.(visibleItems[0], {
        focus: false,
        scroll: false,
        force: true,
      });
    root.dir = lang() === "he" ? "rtl" : "ltr";
    q("#map").setAttribute("aria-label", t("map"));
    q("#currentPlaceName").title = q("#currentPlaceName").textContent;
    renderCard();
    renderCategories();
    renderResults();
    renderMarkers();
    root.querySelectorAll("[data-hm-copy]").forEach((node) => {
      node.textContent = t(node.dataset.hmCopy);
    });
    q("#hm-saved").setAttribute("aria-pressed", String(state.saved));
    q("#hm-search").placeholder = t("search");
    q("#hm-search").setAttribute("aria-label", t("search"));
    q("#hm-category").textContent =
      `${t("categories")}${state.categories.length || state.types.length !== 3 ? " · " + visibleItems.length : ""} ▾`;
    q("#hm-empty").hidden = visibleItems.length > 0;
    q("#hm-empty-text").textContent = t("empty");
    q("#hm-locate").title = t("locate");
    q("#hm-locate").setAttribute("aria-label", t("locate"));
    q("#hm-plus").title = t("plus");
    q("#hm-plus").setAttribute("aria-label", t("plus"));
    q("#hm-minus").title = t("minus");
    q("#hm-minus").setAttribute("aria-label", t("minus"));
    q("#hm-layer").title = t("layers");
    q("#hm-layer").setAttribute("aria-label", t("layers"));
    q("#hm-description").setAttribute("aria-label", t("description"));
    q(".hm-prompt-close")?.setAttribute("aria-label", t("close"));
    q("#hm-status-close")?.setAttribute("aria-label", t("close"));
    root
      .querySelectorAll(".hm-menu-close")
      .forEach((node) => node.setAttribute("aria-label", t("close")));
    root
      .querySelectorAll("[data-hm-layer]")
      .forEach((node) =>
        node.setAttribute(
          "aria-pressed",
          String(node.dataset.hmLayer === state.layer),
        ),
      );
  }
  // Warm only the next viewport after the visible map has finished loading.
  // Bounded concurrency avoids competing with current tiles or filling memory on rapid clicks.
  const warmedTiles = new Set();
  function scheduleTileWarmup() {
    clearTimeout(warmTimer);
    const generation = ++warmGeneration;
    if (
      !map ||
      map.getZoom() < 12 ||
      document.hidden ||
      navigator.connection?.saveData
    )
      return;
    warmTimer = setTimeout(() => warmNextViewport(generation), 350);
  }
  function warmNextViewport(generation) {
    if (generation !== warmGeneration || !visibleItems.length) return;
    const tileLayers = activeLayer instanceof L.TileLayer ? [activeLayer] : [];
    if (!tileLayers.length)
      activeLayer?.eachLayer((layer) => {
        if (layer instanceof L.TileLayer) tileLayers.push(layer);
      });
    if (tileLayers.some((layer) => layer.isLoading())) return;
    const index = visibleItems.findIndex(
      (item) => key(item) === key(selected() || {}),
    );
    const next = visibleItems[(Math.max(0, index) + 1) % visibleItems.length];
    const target = api.getMarker(next)?.getLatLng() || coords(next);
    if (!target) return;
    const urls = [];
    for (const layer of tileLayers) {
      const zoom = Math.min(
        map.getZoom(),
        layer.options.maxNativeZoom ?? map.getZoom(),
      );
      const size = layer.getTileSize().x;
      const point = map.project(target, zoom);
      const half = map
        .getSize()
        .divideBy(2 * Math.pow(2, map.getZoom() - zoom));
      const candidates = [];
      for (
        let y = Math.floor((point.y - half.y) / size) - 1;
        y <= Math.floor((point.y + half.y) / size) + 1;
        y++
      ) {
        for (
          let x = Math.floor((point.x - half.x) / size) - 1;
          x <= Math.floor((point.x + half.x) / size) + 1;
          x++
        ) {
          if (
            x < 0 ||
            y < 0 ||
            x >= Math.pow(2, zoom) ||
            y >= Math.pow(2, zoom)
          )
            continue;
          candidates.push({ x, y, z: zoom });
        }
      }
      candidates.sort(
        (a, b) =>
          Math.hypot(a.x + 0.5 - point.x / size, a.y + 0.5 - point.y / size) -
          Math.hypot(b.x + 0.5 - point.x / size, b.y + 0.5 - point.y / size),
      );
      for (const tile of candidates.slice(0, 16)) {
        const url = layer.getTileUrl(tile);
        if (!warmedTiles.has(url)) urls.push(url);
      }
    }
    let cursor = 0;
    const worker = () => {
      if (
        generation !== warmGeneration ||
        cursor >= urls.length ||
        document.hidden
      )
        return;
      const url = urls[cursor++];
      const img = new Image();
      img.decoding = "async";
      img.fetchPriority = "low";
      img.onload = () => {
        warmedTiles.add(url);
        if (warmedTiles.size > 192)
          warmedTiles.delete(warmedTiles.values().next().value);
        worker();
      };
      img.onerror = worker;
      img.src = url;
    };
    worker();
    worker();
  }
  function setLayer(value) {
    if (activeLayer) map.removeLayer(activeLayer);
    state.layer = value;
    activeLayer = layers[value];
    activeLayer.addTo(map);
    scheduleTileWarmup();
    save();
    schedule();
  }
  function setStatus(message) {
    const status = q("#hm-status");
    status.replaceChildren();
    if (!message) return;
    const text = element("span");
    qCopy(text, message);
    const close = button("hm-status-close", "×", () => setStatus(null));
    close.setAttribute("aria-label", t("close"));
    status.append(text, close);
  }
  function updateUserPosition(coords) {
    const firstFix = !state.sortOrigin;
    state.position = L.latLng(coords.latitude, coords.longitude);
    if (firstFix) {
      state.sortOrigin = state.position;
      api.refresh();
      // Start at the nearest place, unless the visitor has already chosen a place.
      if (!selectionTouched && visibleItems.length)
        window.setCurrentMapItem?.(visibleItems[0], {
          focus: false,
          scroll: false,
          force: true,
        });
    }
    schedule();
  }
  function locate() {
    if (locating) return;
    setStatus("locating");
    const prompt = q(".map-location-prompt");
    if (prompt) prompt.hidden = true;
    if (!navigator.geolocation) {
      setStatus("unsupported");
      return;
    }
    locating = true;
    const finish = () => {
      locating = false;
      q("#hm-locate").disabled = false;
    };
    q("#hm-locate").disabled = true;
    const success = (position, recent = false) => {
      const originalTimestamp = window.currentUserLocation?.timestamp;
      finish();
      setStatus(recent ? "recent" : null);
      updateUserPosition(position.coords);
      state.sortOrigin = state.position;
      api.refresh();
      state.dismissed = true;
      api.setUserLocation(position.coords);
      if (recent && window.currentUserLocation)
        window.currentUserLocation.timestamp = originalTimestamp;
      save();
      const prompt = q(".map-location-prompt");
      if (prompt) prompt.hidden = true;
      // Explicit GPS focus keeps the current selection and refreshes distance ordering.
      center(null, Math.max(map.getZoom(), 14), true);
      schedule();
    };
    const failure = (error) => {
      // A denied permission must never be bypassed with a cached position.
      const recent = window.currentUserLocation;
      if (
        error?.code !== 1 &&
        recent &&
        Date.now() - recent.timestamp <= 60000 &&
        Number.isFinite(recent.lat) &&
        Number.isFinite(recent.lng)
      ) {
        success(
          {
            coords: {
              latitude: recent.lat,
              longitude: recent.lng,
              accuracy: recent.accuracy,
            },
          },
          true,
        );
        return;
      }
      finish();
      setStatus(
        error?.code === 1
          ? "denied"
          : error?.code === 3
            ? "timeout"
            : "unavailable",
      );
    };
    navigator.geolocation.getCurrentPosition(
      success,
      (error) => {
        if (error?.code === 1) return failure(error);
        navigator.geolocation.getCurrentPosition(success, failure, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0,
        });
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 },
    );
  }
  function makeUI() {
    root.classList.add("hm-ready");
    const card = q("#currentPlaceSection"),
      content = q("#currentPlaceContent"),
      heading = element("div", "hm-card-heading");
    const toggle = button("hm-collapse", "", () => collapse(!state.collapsed));
    toggle.setAttribute("aria-controls", "currentPlaceContent");
    heading.append(q("#currentPlaceName"), toggle);
    card.prepend(heading);
    const description = element("div", "hm-description");
    description.id = "hm-description";
    description.tabIndex = 0;
    description.setAttribute("role", "region");
    description.append(q("#currentPlaceDescription"));
    content.querySelector(".place-badges").after(description);
    description.append(element("p", "hm-distance"));
    description.lastChild.id = "hm-distance";
    const checkInStatus = q("#currentPlaceCheckInStatus");
    description.prepend(checkInStatus);
    new MutationObserver(() => {
      description.scrollTop = 0;
    }).observe(checkInStatus, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    card.append(q(".current-place-navigation"));
    const top = element("div", "hm-top"),
      search = element("input");
    search.type = "search";
    search.id = "hm-search";
    search.autocomplete = "off";
    const results = element("div", "hm-results");
    results.id = "hm-results";
    results.hidden = true;
    search.setAttribute("aria-controls", "hm-results");
    search.addEventListener("input", () => {
      state.query = search.value.trim();
      renderResults();
    });
    search.addEventListener("focus", () => {
      if (root.clientWidth <= 600) collapse(true);
      const prompt = q(".map-location-prompt");
      if (prompt) prompt.hidden = true;
      renderResults();
    });
    search.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        results.querySelector("button")?.focus();
        e.preventDefault();
      }
      if (e.key === "Escape") {
        results.hidden = true;
        search.blur();
      }
      if (e.key === "Enter" && state.query) {
        const first = searchResults()[0];
        if (first) select(first);
      }
    });
    top.append(search);
    const filters = element("div", "hm-filters");
    filters.append(
      button("hm-category", "", () =>
        toggleMenu("hm-categories", "hm-category"),
      ),
      button("hm-saved", "", () => {
        state.saved = !state.saved;
        refresh();
      }),
    );
    qCopy(filters.children[1], "saved");
    top.append(filters);
    root.append(top);
    const cats = element("section", "hm-menu hm-categories");
    cats.id = "hm-categories";
    cats.hidden = true;
    const catsHead = element("div", "hm-menu-heading");
    catsHead.append(
      element("strong", "", t("categories")),
      button("hm-category-close", "×", () => closeMenus(true)),
    );
    catsHead.lastChild.classList.add("hm-menu-close");
    const hint = element("p", "hm-menu-hint");
    qCopy(hint, "multi");
    const list = element("div", "hm-category-list");
    list.id = "hm-category-list";
    const footer = element("div", "hm-menu-footer");
    footer.append(
      button("hm-category-reset", "", reset),
      button("hm-category-done", "", () => closeMenus(true)),
    );
    qCopy(footer.firstChild, "all");
    cats.append(catsHead, hint, list, footer);
    root.append(cats);
    qCopy(catsHead.firstChild, "categories");
    const tools = element("div", "hm-tools");
    tools.append(
      button("hm-locate", "⌖", locate),
      button("hm-plus", "+", () => {
        if (selected()) center(selected(), map.getZoom() + 1);
        else map.zoomIn();
      }),
      button("hm-minus", "−"),
      button("hm-layer", "", () => toggleMenu("hm-layers", "hm-layer")),
    );
    const thumb = element("img");
    thumb.src =
      "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/12/1622/2435";
    thumb.alt = "";
    tools.lastChild.append(thumb);
    root.append(tools);
    const layerMenu = element("section", "hm-menu hm-layers");
    layerMenu.id = "hm-layers";
    layerMenu.hidden = true;
    const layerHead = element("div", "hm-menu-heading");
    layerHead.append(
      element("strong"),
      button("hm-layer-close", "×", () => closeMenus(true)),
    );
    qCopy(layerHead.firstChild, "layers");
    layerHead.lastChild.classList.add("hm-menu-close");
    layerMenu.append(layerHead);
    for (const layer of ["road", "satellite", "hybrid"]) {
      const b = button("", undefined, () => {
        setLayer(layer);
        closeMenus(true);
      });
      b.dataset.hmLayer = layer;
      const picture = element("span", "hm-layer-picture"),
        img = element("img");
      img.alt = "";
      img.loading = "lazy";
      img.src =
        layer === "road"
          ? "https://tile.openstreetmap.org/12/2435/1622.png"
          : thumb.src;
      picture.append(img);
      if (layer === "hybrid") {
        const overlay = element("img");
        overlay.alt = "";
        overlay.src =
          "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/12/1622/2435";
        picture.append(overlay);
      }
      const label = element("span");
      qCopy(label, layer);
      b.append(picture, label, element("span", "hm-tick", "✓"));
      layerMenu.append(b);
    }
    root.append(layerMenu);
    for (const [id, control] of [
      ["hm-category", "hm-categories"],
      ["hm-layer", "hm-layers"],
    ]) {
      q("#" + id).setAttribute("aria-controls", control);
      q("#" + id).setAttribute("aria-expanded", "false");
    }
    const empty = element("div", "hm-empty");
    empty.id = "hm-empty";
    empty.hidden = true;
    empty.append(element("span"), button("hm-reset", "", reset));
    empty.firstChild.id = "hm-empty-text";
    qCopy(empty.lastChild, "all");
    root.append(empty);
    const status = element("div", "hm-status");
    status.id = "hm-status";
    status.setAttribute("role", "status");
    top.append(status, results);
    let timer,
      held = false,
      start;
    const minus = q("#hm-minus");
    const cancel = () => {
      clearTimeout(timer);
      start = null;
      minus.classList.remove("hm-holding");
    };
    minus.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      held = false;
      start = [e.clientX, e.clientY];
      minus.setPointerCapture(e.pointerId);
      minus.classList.add("hm-holding");
      timer = setTimeout(() => {
        held = true;
        overview();
        cancel();
      }, 600);
    });
    minus.addEventListener("pointermove", (e) => {
      if (
        start &&
        Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 10
      ) {
        held = true;
        cancel();
      }
    });
    for (const event of [
      "pointerup",
      "pointercancel",
      "lostpointercapture",
      "blur",
    ])
      minus.addEventListener(event, cancel);
    minus.addEventListener("click", (e) => {
      if (!held) {
        if (e.shiftKey) overview();
        else if (selected()) center(selected(), map.getZoom() - 1);
        else map.zoomOut();
      }
      held = false;
    });
    minus.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("blur", cancel);
    root.addEventListener("click", (e) => {
      if (e.target.closest("#prevPlaceBtn,#nextPlaceBtn,.leaflet-marker-icon"))
        selectionTouched = true;
    });
    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeMenus(true);
        results.hidden = true;
      }
    });
    document.addEventListener("pointerdown", (e) => {
      if (!e.target.closest(".hm-menu,#hm-category,#hm-layer")) closeMenus();
      if (!e.target.closest(".hm-top")) results.hidden = true;
    });
    const promptObserver = new MutationObserver(() => {
      const prompt = q(".map-location-prompt");
      if (!prompt || prompt.querySelector(".hm-prompt-close")) return;
      const close = button("hm-prompt-close", "×", () => {
        state.dismissed = true;
        save();
        prompt.hidden = true;
        q("#hm-locate").focus();
      });
      close.classList.add("hm-prompt-close");
      close.setAttribute("aria-label", t("close"));
      prompt.prepend(close);
      if (state.dismissed) prompt.hidden = true;
    });
    promptObserver.observe(root, { childList: true });
  }
  function qCopy(node, k) {
    node.dataset.hmCopy = k;
    node.textContent = t(k);
  }
  function init(instance, adapter) {
    if (initialized) return;
    map = instance;
    api = adapter;
    makeUI();
    // The map chrome changes the panel size; refresh Leaflet before projecting coordinates.
    map.invalidateSize({ pan: false });
    map.zoomControl?.remove();
    map.attributionControl?.setPrefix(false);
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) map.removeLayer(layer);
    });
    const tile = (url, attribution, maxNativeZoom = 19) =>
      L.tileLayer(url, {
        attribution,
        maxNativeZoom,
        maxZoom: 24,
        keepBuffer: 3,
        updateWhenZooming: false,
      }).on("load", scheduleTileWarmup);
    const imagery =
      "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
    const attribution =
      "Tiles © Esri — Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community";
    layers = {
      road: tile(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      ),
      satellite: tile(imagery, attribution),
    };
    layers.hybrid = L.layerGroup([
      tile(imagery, attribution),
      tile(
        "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        "Labels: Esri, HERE, Garmin, © OpenStreetMap contributors, and the GIS user community",
        18,
      ),
      tile(
        "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
        "",
        18,
      ),
    ]);
    map.setMaxZoom(24);
    clusterLayer = L.layerGroup().addTo(map);
    initialized = true;
    window.CE_HOME_MAP.ready = true;
    setLayer(state.layer);
    overview(false);
    map.on("zoomend moveend", schedule);
    map.on("movestart zoomstart", () => {
      clearTimeout(warmTimer);
      warmGeneration++;
    });
    map.on("moveend zoomend", scheduleTileWarmup);
    window.addEventListener("ce:map-item-selected", () => {
      q("#hm-description").scrollTop = 0;
      scheduleTileWarmup();
      schedule();
    });
    for (const event of [
      "mapVisibleItemsChanged",
      "mapHotelMarkersUpdated",
      "mapRecommendationMarkersUpdated",
      "poisDataRefreshed",
    ])
      window.addEventListener(event, schedule);
    window.addEventListener("mapVisibleItemsChanged", scheduleTileWarmup);
    window.addEventListener("languageChanged", schedule);
    document.addEventListener("wakacjecypr:languagechange", schedule);
    window.CE_SAVED_CATALOG?.subscribe(() => {
      refresh();
    });
    let width = root.clientWidth,
      height = root.clientHeight;
    new ResizeObserver(() => {
      if (width === root.clientWidth && height === root.clientHeight) return;
      width = root.clientWidth;
      height = root.clientHeight;
      const previous = map.getZoom();
      const wasOnUser = cameraOnUser;
      const wasOverview = Math.abs(previous - map.getMinZoom()) < 0.1;
      map.invalidateSize({ pan: false });
      overview(false);
      if (!wasOverview && previous > map.getMinZoom())
        center(selected(), previous, wasOnUser);
    }).observe(root);
    new ResizeObserver(() => {
      root.style.setProperty(
        "--hm-card-height",
        `${q("#currentPlaceSection").getBoundingClientRect().height}px`,
      );
      if (initialized && !state.collapsed)
        requestAnimationFrame(() => center());
    }).observe(q("#currentPlaceSection"));
    schedule();
  }
  window.CE_HOME_MAP = {
    init,
    filterItems,
    openPoi,
    center,
    locate,
    updateUserPosition,
    locationDismissed: () => state.dismissed,
    ready: false,
  };
})();
