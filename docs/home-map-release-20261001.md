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
