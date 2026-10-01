# Home map usability release — 2026-10-01

Scope: only the homepage map presentation and navigation, based on production
commit 32270762. No copied mockup header, logo, language switcher, example catalog,
authentication, booking or database changes. Existing POI, recommendation and hotel
modules retain their detail, saved-item, check-in and route actions.

The home-only adapter provides a dismissible location prompt, a bounded scrolling
card with persistent previous/next navigation, wrapping selection, camera framing
for collapsed/mobile/desktop/RTL layouts, selected-point zoom, island overview
(short minus = one step, hold or Shift+Enter = overview), three imagery styles,
multi-select categories with live counts, search, saved filtering, nearby sorting,
category-aware clusters, reduced-motion support and versioned UI preferences.
Precise user coordinates are never persisted. Required tile-source attribution
remains inside the map; the optional Leaflet prefix is removed.

Validation:
- Production build completed successfully; only map-related generated files differ.
- Seven Node filter regressions passed, including OR categories, multiple catalog
  types, empty selection, corrupted storage and stale filters.
- Syntax checks and scoped ESLint: no errors (nine existing warnings in legacy files).
- All existing language fallback / internal Hebrew / rollout guard tests passed.
- Browser checks with the real public catalog: 139 POIs, 11 recommendations, 1 hotel.
- PL/EN/HE, both loop boundaries, zero/one result, search, native hotel details,
  satellite/labels/road layers, saved empty state and preferences after reload checked.
- Horizontal bounds measured at 320, 360, 390, 430, 768, 1024 and 1440 CSS pixels;
  RTL additionally measured at 320, 390, 768 and 1440. Map controls, card, category
  panel and layer picker stay inside the map (minimum side margin 12 px).
- Long hotel content scrolls internally (524 px content in a 171 px viewport in
  one mobile case), while actions and arrows remain visible; single-item arrows disabled.
- Camera checks after zoom and selection: stable final anchor within about 2 px
  of the intended free-area center. Mobile anchor remains above the expanded card.
- Synthetic Paphos geolocation and permission denial checked using a temporary
  local-only harness, without accessing the user's real location. No console errors.
- Repository-wide TypeScript check has 158 pre-existing errors. A clean worktree
  at 32270762 produces exactly the same diagnostics; no new TypeScript regression.

Rollback: revert this map-only commit and rebuild. No database rollback is needed.


## Location and selection regression fix

- Near me is an idempotent action: sort matching catalog items by straight-line distance and select the nearest. Repeated clicks and returning after arrow navigation retain this behavior. Equal distances have a deterministic catalog-key tie break. Show all clears proximity mode.
- Explicit location requests center the real user coordinate, preserving the selected catalog item; card/layout updates retain this camera target. Initial background geolocation still does not pan the overview. Explicit requests and existing tracking share one dot. Homepage-only CSS removes the community avatar offset from its anchor.
- Selected emoji uses a circular ring in the existing category color (hotels retain amber), with no rectangular wrapper outline or old blue pulsing overlay.
- Location errors distinguish permission denial, provider unavailability and timeout in PL/EN/HE. Transient failures retry once with high accuracy. A last known position is used only if obtained within the past minute and permission was not denied, with an explicit message; fallback does not renew its age. Precise coordinates are not persisted.
- Dismissible status and search results share normal document flow. Result lists scroll in the space above the card. On narrow screens focusing search collapses the card.

Validation: 14 Node map regression tests pass, scoped ESLint has no errors (2 existing core warnings), all three language test suites pass, production build passes. Browser tests use synthetic Paphos coordinates, never a fabricated successful browser permission: repeated Near me selects Tombs of the Kings (1.437 km), then archaeological park (2.155 km), castle (2.367 km), ascending among all 151 records. User-dot and selected-point anchors are within 2 CSS pixels of their intended free-map center. Mobile 320/390 and desktop 1440 checks cover expanded/collapsed cards, PL/EN/HE including RTL, search during a simulated provider failure, dismissal, retry recovery and category-color computed styles. Real OS location service availability remains browser/device dependent.

Search follow-up: name/city search now filters only suggestions, not the map catalog or arrow navigation. Choosing a suggestion (or Enter) selects its actual catalog position, clears the query and keeps the full category/saved-filtered sequence and loop available. Searching without a match leaves the current selection and count intact.


## Default proximity order and detailed-map loading

Proximity is now the automatic order once a location is available; there is no Near me toggle. Without location, items sort geographically west to east. Existing category/saved filters and wraparound remain. Background GPS updates do not reshuffle the browsing sequence; explicit location refresh updates the origin. First position selects the nearest item unless the visitor has already selected one.

Detailed tile loading: reproduced gray map after navigation at zoom 16; observed uncached tile requests around 0.4–0.9 seconds. The next item's viewport is now warmed after visible layers finish loading, at zoom 12+, with low priority, two concurrent image requests and at most 16 tiles per active layer (48 for hybrid). Work is invalidated on movement/zoom and skipped for hidden documents or Data Saver. Three tile rows of nearby history are retained; intermediate animated zoom levels do not request tiles. Warmed zoom-16 and zoom-17 transitions showed imagery immediately in browser checks. Uncached imagery on a slow network can still take time, especially during rapid navigation before warmup completes.

Map-only work reduction: do not fetch/poll rating/comment counters absent from the current card; use the local auth session only for check-in button presentation (the real check-in still verifies the user); rebuild category rows only while the menu is open. Six successive synthetic-Paphos navigation actions took 1.2–4.8 ms synchronous handling and 9.8–15.8 ms to the next animation frame on the test machine, with zero unused stats/user requests. These timings exclude remote satellite tile latency.

Validation: 17 map tests pass including first GPS fix, preserved manual selection, west-to-east fallback, stable GPS order, search, error recovery, prefetch concurrency/cancellation/native zoom/request cap. Production build, language suites and scoped lint pass (existing bridge warnings only). Browser checks cover auto location, nearby arrow progression, detailed satellite zoom 16/17, permission denial, Hebrew RTL and category menu.

## Stable adjacent-place browsing

Replaced radial distance ordering with a cached nearest-unvisited sequence, starting at the nearest item to the frozen user origin (westernmost item without GPS). Ties use catalog type/id; coordinate-less items remain last. Search/selection and background GPS updates preserve the sequence. Catalog/filter/origin changes rebuild it; next-tile warming consumes the same sequence.

Validation: 18 scoped map integration tests passed, including opposite-side zigzag, GPS stability, search and category changes; controller ESLint passed, i18n tests and production build passed. Local browser with synthetic Paphos location: next/back 1→2→1, reverse/forward loop 1→151→1, search Protaras selects 127/151. No layout or other homepage sections changed.
