(function attachMapHotels(globalScope) {
  'use strict';

  let mapHotels = [];
  let hotelMarkers = new Map();
  let hotelMapById = new Map();
  let hotelMapInstance = null;
  let hotelMarkersVisible = true;
  const HOTEL_MARKER_Z_INDEX_BASE = 4100;
  const hotelMarkerIconCache = new Map();

  function getSupabaseClient() {
    return (
      globalScope.supabase
      || globalScope.sb
      || globalScope.__SB__
      || (typeof globalScope.getSupabase === 'function' ? globalScope.getSupabase() : null)
      || null
    );
  }

  async function waitForSupabaseClient(maxAttempts = 40) {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const client = getSupabaseClient();
      if (client) return client;
      await new Promise((resolve) => globalScope.setTimeout(resolve, 120));
    }
    return null;
  }

  function normalizeHotelId(value) {
    return String(value || '').trim();
  }

  function sanitizeCoordinate(value) {
    const num = Number(value);
    return Number.isFinite(num) ? Number(num.toFixed(6)) : null;
  }

  function normalizeHotelForMap(row) {
    const hotel = row && typeof row === 'object' ? row : {};
    const id = normalizeHotelId(hotel.id);
    if (!id) return null;
    const latitude = sanitizeCoordinate(hotel.latitude ?? hotel.lat);
    const longitude = sanitizeCoordinate(hotel.longitude ?? hotel.lng ?? hotel.lon);
    return {
      ...hotel,
      id,
      latitude,
      longitude,
    };
  }

  function setMapHotelsData(nextHotels) {
    const normalized = (Array.isArray(nextHotels) ? nextHotels : [])
      .map(normalizeHotelForMap)
      .filter(Boolean);
    mapHotels = normalized;
    hotelMapById = new Map(normalized.map((hotel) => [hotel.id, hotel]));
  }

  function getMapHotelsData() {
    return Array.isArray(mapHotels) ? [...mapHotels] : [];
  }

  function getHomeHotelsData() {
    if (typeof globalScope.getHomeHotelsData === 'function') {
      const data = globalScope.getHomeHotelsData();
      if (Array.isArray(data) && data.length) {
        return data;
      }
    }
    return [];
  }

  function getHotelMarkerIcon() {
    if (typeof globalScope.L === 'undefined' || typeof globalScope.L.divIcon !== 'function') {
      return null;
    }
    const cacheKey = 'hotel';
    if (hotelMarkerIconCache.has(cacheKey)) {
      return hotelMarkerIconCache.get(cacheKey);
    }
    const icon = globalScope.L.divIcon({
      className: 'ce-poi-marker ce-poi-marker--emoji ce-hotel-marker',
      html: '<span class="ce-poi-marker__emoji ce-poi-marker__emoji--hotel" aria-hidden="true">🏨</span>',
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -14],
    });
    hotelMarkerIconCache.set(cacheKey, icon);
    return icon;
  }

  function getHotelMarkerById(hotelId) {
    const id = normalizeHotelId(hotelId);
    if (!id) return null;
    return hotelMarkers.get(id) || null;
  }

  function applyHotelMarkerVisibility(mapInstance = hotelMapInstance) {
    const targetMap = mapInstance || hotelMapInstance;
    if (!targetMap || typeof targetMap.hasLayer !== 'function') {
      return;
    }
    hotelMarkers.forEach((marker) => {
      if (!marker) return;
      if (hotelMarkersVisible) {
        if (!targetMap.hasLayer(marker)) {
          marker.addTo(targetMap);
        }
      } else if (targetMap.hasLayer(marker)) {
        targetMap.removeLayer(marker);
      }
    });
  }

  function getHotelMarkersStats(mapInstance = hotelMapInstance) {
    const targetMap = mapInstance || hotelMapInstance;
    let visibleCount = 0;
    hotelMarkers.forEach((marker) => {
      if (!marker || !hotelMarkersVisible) return;
      if (targetMap && typeof targetMap.hasLayer === 'function') {
        if (targetMap.hasLayer(marker)) {
          visibleCount += 1;
        }
      } else {
        visibleCount += 1;
      }
    });
    return {
      total: mapHotels.filter((hotel) => Number.isFinite(hotel.latitude) && Number.isFinite(hotel.longitude)).length,
      rendered: hotelMarkers.size,
      visible: hotelMarkersVisible ? visibleCount : 0,
      isVisible: hotelMarkersVisible,
    };
  }

  function getVisibleHotelIdsForMap(mapInstance = hotelMapInstance) {
    if (!hotelMarkersVisible) {
      return [];
    }
    const targetMap = mapInstance || hotelMapInstance;
    const visibleIds = [];
    hotelMarkers.forEach((marker, hotelId) => {
      if (!marker) return;
      if (targetMap && typeof targetMap.hasLayer === 'function') {
        if (targetMap.hasLayer(marker)) {
          visibleIds.push(hotelId);
        }
        return;
      }
      visibleIds.push(hotelId);
    });
    return visibleIds;
  }

  function dispatchHotelMarkersUpdate(mapInstance = hotelMapInstance) {
    try {
      globalScope.dispatchEvent(new CustomEvent('mapHotelMarkersUpdated', {
        detail: getHotelMarkersStats(mapInstance),
      }));
    } catch (_) {}
  }

  function setHotelMarkersVisibility(mapInstance, visible = true) {
    hotelMarkersVisible = Boolean(visible);
    const targetMap = mapInstance || hotelMapInstance;
    if (targetMap) {
      applyHotelMarkerVisibility(targetMap);
      dispatchHotelMarkersUpdate(targetMap);
      return;
    }
    dispatchHotelMarkersUpdate();
  }

  function focusHotelOnMap(hotelId, mapInstance = hotelMapInstance, options = {}) {
    const hotel = hotelMapById.get(normalizeHotelId(hotelId));
    const targetMap = mapInstance || hotelMapInstance;
    if (!hotel || !targetMap || typeof targetMap.setView !== 'function') {
      return;
    }
    const latitude = Number(hotel.latitude);
    const longitude = Number(hotel.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }
    const zoom = Math.max(13, Number(options.zoom || targetMap.getZoom?.() || 14));
    try {
      if (typeof targetMap.project === 'function' && typeof targetMap.unproject === 'function') {
        const isMobile = globalScope.innerWidth <= 768;
        const offsetY = isMobile ? (globalScope.innerHeight * 0.25) : 100;
        const point = targetMap.project([latitude, longitude], zoom);
        point.y += offsetY;
        const center = targetMap.unproject(point, zoom);
        targetMap.setView(center, zoom, { animate: true });
        return;
      }
    } catch (_) {}
    targetMap.setView([latitude, longitude], zoom, { animate: true });
  }

  function syncHotelMarkers(mapInstance) {
    if (!mapInstance || typeof globalScope.L === 'undefined') {
      return;
    }
    hotelMapInstance = mapInstance;

    const icon = getHotelMarkerIcon();
    if (!icon) {
      dispatchHotelMarkersUpdate(mapInstance);
      return;
    }

    mapHotels.forEach((hotel) => {
      const latitude = Number(hotel.latitude);
      const longitude = Number(hotel.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      const hotelId = normalizeHotelId(hotel.id);
      if (!hotelId) return;

      const existing = hotelMarkers.get(hotelId);
      if (existing) {
        if (typeof existing.setIcon === 'function') {
          existing.setIcon(icon);
        }
        existing.setZIndexOffset(HOTEL_MARKER_Z_INDEX_BASE);
        if (hotelMarkersVisible && !mapInstance.hasLayer(existing)) {
          existing.addTo(mapInstance);
        } else if (!hotelMarkersVisible && mapInstance.hasLayer(existing)) {
          mapInstance.removeLayer(existing);
        }
        return;
      }

      const marker = globalScope.L.marker([latitude, longitude], {
        icon,
        zIndexOffset: HOTEL_MARKER_Z_INDEX_BASE,
      });
      if (hotelMarkersVisible) {
        marker.addTo(mapInstance);
      }
      marker.unbindPopup();
      marker.on('click', () => {
        try {
          globalScope.dispatchEvent(new CustomEvent('ce:map-item-selected', {
            detail: { type: 'hotel', id: hotelId },
          }));
        } catch (_) {}
        if (typeof globalScope.setCurrentMapItem === 'function') {
          globalScope.setCurrentMapItem(
            { type: 'hotel', id: hotelId },
            { focus: false, scroll: false, force: true }
          );
        }
      });
      hotelMarkers.set(hotelId, marker);
    });

    hotelMarkers.forEach((marker, hotelId) => {
      if (hotelMapById.has(hotelId)) return;
      try {
        if (mapInstance.hasLayer(marker)) {
          mapInstance.removeLayer(marker);
        }
      } catch (_) {}
      hotelMarkers.delete(hotelId);
    });

    applyHotelMarkerVisibility(mapInstance);
    dispatchHotelMarkersUpdate(mapInstance);
  }

  async function loadHotelsForMap() {
    const homeHotels = getHomeHotelsData();
    if (homeHotels.length) {
      setMapHotelsData(homeHotels);
      dispatchHotelMarkersUpdate(hotelMapInstance);
      return getMapHotelsData();
    }

    try {
      const client = await waitForSupabaseClient();
      if (!client) {
        return getMapHotelsData();
      }
      const response = await client
        .from('hotels')
        .select('*')
        .eq('is_published', true)
        .order('sort_order', { ascending: true })
        .order('updated_at', { ascending: false });

      if (response.error) {
        throw response.error;
      }

      setMapHotelsData(response.data || []);
      return getMapHotelsData();
    } catch (error) {
      console.warn('[map-hotels] Failed to load hotels:', error);
      return getMapHotelsData();
    }
  }

  async function initMapHotels(mapInstance) {
    hotelMapInstance = mapInstance || hotelMapInstance;
    await loadHotelsForMap();
    if (hotelMapInstance && typeof globalScope.L !== 'undefined') {
      syncHotelMarkers(hotelMapInstance);
    } else {
      dispatchHotelMarkersUpdate();
    }
    return getMapHotelsData();
  }

  globalScope.addEventListener('homeHotelsDataRefreshed', () => {
    const homeHotels = getHomeHotelsData();
    if (!homeHotels.length) return;
    setMapHotelsData(homeHotels);
    if (hotelMapInstance && typeof globalScope.L !== 'undefined') {
      syncHotelMarkers(hotelMapInstance);
    } else {
      dispatchHotelMarkersUpdate();
    }
  });

  globalScope.initMapHotels = initMapHotels;
  globalScope.setHotelMarkersVisibility = setHotelMarkersVisibility;
  globalScope.getHotelMarkersStats = getHotelMarkersStats;
  globalScope.getVisibleHotelIdsForMap = getVisibleHotelIdsForMap;
  globalScope.getHotelMarkerById = getHotelMarkerById;
  globalScope.getMapHotelsData = getMapHotelsData;
  globalScope.focusHotelOnMap = focusHotelOnMap;
})(typeof window !== 'undefined' ? window : globalThis);
