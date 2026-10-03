/* Display-only correction. The city comes from the booking, never from a flight number. */
(function (root) {
  function airportCity(value) {
    const text = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ");
    if (/\b(larnaca|larnaka|lca)\b/.test(text)) return "larnaca";
    if (/\b(paphos|pafos|pfo)\b/.test(text)) return "paphos";
    return "";
  }
  function isAirport(value) {
    return (
      /airport|lotnisko/i.test(String(value || "")) ||
      /^(lca|pfo)$/i.test(String(value || "").trim())
    );
  }
  function locationForSide({
    location,
    otherLocation,
    flightNumber,
    cityCode,
    bookingLocation,
    side = "pickup",
  }) {
    const raw = String(location || "").trim();
    const flight = String(flightNumber || "").trim();
    const tagged = /(?:pickup|return)\s*:/i.test(flight);
    const hasSideFlight =
      !!flight &&
      (tagged
        ? new RegExp(`(?:^|\\|)\\s*${side}\\s*:\\s*[^|\\s]`, "i").test(flight)
        : side === "pickup" && !isAirport(otherLocation));
    if (!isAirport(raw) && !hasSideFlight) return raw;
    const legacyGenericPlace = /^(airport|hotel|city[_ ]center)$/i.test(raw);
    const city =
      airportCity(raw) ||
      airportCity(cityCode) ||
      (legacyGenericPlace ? airportCity(bookingLocation) : "");
    // An unspecified legacy airport remains unspecified rather than borrowing the other side's city.
    return city ? `${city} airport` : "airport";
  }
  root.CEPartnerCarLocation = { locationForSide };
})(typeof window === "undefined" ? globalThis : window);
