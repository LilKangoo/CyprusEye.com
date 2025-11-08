/**
 * APP CORE V3 - Mapa używająca tylko danych z Supabase
 * Całkowicie przebudowana funkcjonalność dla mapy niezależna od panelu
 */

console.log('🔵 App Core V3 - START');

(function() {
  'use strict';

  // Globalne zmienne mapy
  let mapInstance = null;
  let markersLayer = null;
  // User location state
  let userLocationMarker = null;
  let userAccuracyCircle = null;
  let userLocationInitialized = false;
  
  /**
   * Czeka na PLACES_DATA z Supabase
   */
  async function waitForPlacesData() {
    console.log('⏳ Czekam na PLACES_DATA z Supabase...');
    
    for (let i = 0; i < 100; i++) {
      if (window.PLACES_DATA && Array.isArray(window.PLACES_DATA) && window.PLACES_DATA.length > 0) {
        console.log(`✅ PLACES_DATA gotowe: ${window.PLACES_DATA.length} POI z Supabase`);
        console.log('📍 Przykładowe ID:', window.PLACES_DATA.slice(0, 3).map(p => p.id));
        return window.PLACES_DATA;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.error('❌ PLACES_DATA nie załadowane po 10 sekundach');
    console.error('→ window.PLACES_DATA:', window.PLACES_DATA);
    return [];
  }
  
  // Funkcja komentarzy została usunięta - komentarze dostępne tylko w panelu pod mapą
  
  /**
   * Inicjalizuje mapę
   */
  async function initializeMap() {
    console.log('🗺️ Inicjalizuję mapę...');
    
    const mapElement = document.getElementById('map');
    if (!mapElement) {
      console.log('ℹ️ Brak elementu #map na tej stronie');
      return;
    }
    
    // Sprawdź Leaflet
    if (typeof L === 'undefined') {
      console.error('❌ Leaflet nie załadowany!');
      return;
    }
    
    // Nie blokuj inicjalizacji mapy na danych – uruchom mapę i geolokalizację od razu
    const hasPlacesNow = Array.isArray(window.PLACES_DATA) && window.PLACES_DATA.length > 0;
    
    // Stwórz mapę jeśli nie istnieje
    if (!mapInstance) {
      console.log('🗺️ Tworzę instancję mapy...');
      
      // Sprawdź czy element mapy nie jest już zainicjalizowany
      if (mapElement._leaflet_id) {
        console.log('⚠️ Mapa już istnieje - używam istniejącej instancji');
        mapInstance = mapElement._leaflet_map || mapElement._leaflet;
        if (!mapInstance) {
          console.error('❌ Nie mogę odnaleźć instancji mapy!');
          return;
        }
      } else {
        mapInstance = L.map('map').setView([35.095, 33.203], 9);
      }
      
      // Dodaj kafelki
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(mapInstance);
      
      // Stwórz warstwę dla markerów
      markersLayer = L.layerGroup().addTo(mapInstance);

      // Uruchom śledzenie lokalizacji użytkownika natychmiast
      startLiveLocation();
      // Dodaj kontrolkę centrowania na użytkowniku
      addLocateControl();
      
      console.log('✅ Mapa utworzona');
    }
    
    // Dodaj markery jeśli dane już są; w przeciwnym razie poczekaj asynchronicznie
    if (hasPlacesNow) {
      addMarkers();
    } else {
      // Poczekaj asynchronicznie aż PLACES_DATA będzie dostępne i wtedy dodaj markery
      waitForPlacesData().then(() => {
        if (mapInstance && markersLayer) addMarkers();
      });
    }
    
    // Nasłuchuj na refresh
    console.log('📡 Dodaję listener dla poisDataRefreshed');
    window.addEventListener('poisDataRefreshed', (event) => {
      console.log('🔔 Otrzymano event poisDataRefreshed:', event.detail);
      console.log('🔄 Odświeżam markery...');
      addMarkers();
    });
    
    console.log('✅ Mapa zainicjalizowana');
  }
  
  /**
   * Dodaje markery na mapę - TYLKO dane z Supabase
   */
  function addMarkers() {
    console.log('📍 Dodaję markery z Supabase...');
    console.log('   - mapInstance:', mapInstance ? 'OK' : 'NULL');
    console.log('   - markersLayer:', markersLayer ? 'OK' : 'NULL');
    console.log('   - PLACES_DATA:', window.PLACES_DATA ? window.PLACES_DATA.length : 'UNDEFINED');
    
    if (!mapInstance || !markersLayer) {
      console.error('❌ Mapa nie gotowa');
      return;
    }
    
    if (!window.PLACES_DATA || window.PLACES_DATA.length === 0) {
      console.error('❌ Brak PLACES_DATA');
      return;
    }
    
    // Wyczyść stare markery
    markersLayer.clearLayers();
    console.log('✅ Wyczyszczono stare markery');
    
    // Custom ikona (niebieski marker)
    const customIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });
    
    // Dodaj każdy POI z Supabase
    let addedCount = 0;
    let skippedCount = 0;
    
    window.PLACES_DATA.forEach((poi, index) => {
      // Walidacja ID z Supabase
      if (!poi.id) {
        console.warn(`⚠️ [${index}] POI bez ID - pomijam`);
        skippedCount++;
        return;
      }
      
      // Normalizacja współrzędnych (obsługa różnych pól)
      const lat = (typeof poi.lat === 'number') ? poi.lat
                 : (typeof poi.latitude === 'number') ? poi.latitude
                 : parseFloat(poi.lat ?? poi.latitude);
      const lng = (typeof poi.lng === 'number') ? poi.lng
                 : (typeof poi.lon === 'number') ? poi.lon
                 : (typeof poi.longitude === 'number') ? poi.longitude
                 : parseFloat(poi.lng ?? poi.lon ?? poi.longitude);

      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) {
        console.warn(`⚠️ [${index}] POI ${poi.id} bez prawidłowych współrzędnych - pomijam`);
        skippedCount++;
        return;
      }
      
      // Nazwa z Supabase
      const name = poi.nameFallback || poi.name || poi.id;
      
      console.log(`📍 [${index}] Dodaję marker: ${name} (ID: ${poi.id}) [${lat}, ${lng}]`);
      
      // Stwórz marker
      const marker = L.marker([lat, lng], { icon: customIcon });
      
      // Link Google Maps
      const googleMapsUrl = typeof window.getPoiGoogleUrl === 'function'
        ? (window.getPoiGoogleUrl(poi) || `https://maps.google.com/?q=${lat},${lng}`)
        : (poi.googleMapsUrl || poi.googleMapsURL || poi.google_url || `https://maps.google.com/?q=${lat},${lng}`);
      
      // Popup z podstawowymi informacjami
      marker.bindPopup(`
        <div style="min-width: 220px;">
          <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #2563eb;">${name}</h3>
          <p style="margin: 0 0 12px 0; font-size: 14px;">⭐ ${poi.xp || 100} XP</p>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <a href="${googleMapsUrl}" target="_blank" rel="noopener" style="display: inline-block; padding: 6px 10px; background: #2563eb; color: white; text-decoration: none; border-radius: 4px; font-size: 13px;">Google Maps →</a>
          </div>
        </div>
      `, { maxWidth: 270 });

      // Kliknięcie markera - sync z panelem pod mapą
      marker.on('click', () => {
        console.log('🖱️ Kliknięto marker POI:', poi.id);
        if (typeof window.setCurrentPlace === 'function') {
          window.setCurrentPlace(poi.id, { scroll: true });
        }
      });
      
      // Dodaj marker do mapy
      marker.addTo(markersLayer);
      addedCount++;
    });
    
    console.log(`✅ Dodano ${addedCount} markerów z Supabase`);
    if (skippedCount > 0) {
      console.warn(`⚠️ Pominięto ${skippedCount} POI (brak ID lub współrzędnych)`);
    }
    
    if (addedCount === 0) {
      console.error('❌ ŻADEN MARKER NIE ZOSTAŁ DODANY!');
      console.error('→ Sprawdź czy POI w Supabase mają status="published"');
      console.error('→ Sprawdź czy POI mają współrzędne (lat, lng)');
    }
  }
  
  /**
   * Live user location: creates/updates a marker and accuracy circle
   */
  function getUserAvatarUrl() {
    // Spróbuj znaleźć avatar użytkownika jeśli istnieje globalny kontekst
    try {
      const p = (window.CE_USER && window.CE_USER.profile) || window.USER_PROFILE || window.currentUser || {};
      return p.avatar_url || p.avatar || null;
    } catch (_) { return null; }
  }

  function createUserIcon() {
    const avatar = getUserAvatarUrl();
    const url = avatar || '/assets/cyprus_logo-1000x1054.png';
    // Użyj markeru typu divIcon z okrągłym obrazkiem
    return L.divIcon({
      className: 'ce-user-location-icon',
      html: `<div style="width:36px;height:36px;border-radius:50%;overflow:hidden;box-shadow:0 0 0 3px rgba(37,99,235,.4);background:#fff;display:flex;align-items:center;justify-content:center;">
               <img src="${url}" alt="me" style="width:100%;height:100%;object-fit:cover;"/>
             </div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });
  }

  // Wspólna aktualizacja markera/okręgu i centrowania
  function applyUserLocation(lat, lng, accuracy) {
    console.log('[GEO] applyUserLocation', { lat, lng, accuracy });
    const latlng = [lat, lng];
    if (!userLocationMarker) {
      // Bardzo widoczny punkt w markerPane (zIndexOffset wysoki), bez obrazków
      const icon = L.divIcon({
        className: 'ce-user-dot',
        html: '<div style="width:16px;height:16px;border-radius:50%;background:#2563eb;border:2px solid #fff;box-shadow:0 0 0 3px rgba(37,99,235,.25);"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
      userLocationMarker = L.marker(latlng, { icon, zIndexOffset: 10000 }).addTo(mapInstance);
    } else {
      userLocationMarker.setLatLng(latlng);
      try { userLocationMarker.setZIndexOffset(10000); } catch (_) {}
    }
    // Upewnij się, że znacznik jest nad innymi warstwami
    try { userLocationMarker.bringToFront(); } catch (_) {}
    if (!userAccuracyCircle) {
      userAccuracyCircle = L.circle(latlng, {
        radius: Math.max(accuracy || 30, 10),
        color: '#2563eb',
        weight: 2,
        opacity: 0.65,
        fillOpacity: 0.08
      }).addTo(mapInstance);
    } else {
      userAccuracyCircle.setLatLng(latlng);
      userAccuracyCircle.setRadius(Math.max(accuracy || 30, 10));
    }
    if (!userLocationInitialized) {
      userLocationInitialized = true;
      try { mapInstance.setView(latlng, Math.max(mapInstance.getZoom(), 13), { animate: true }); } catch (_) {}
    }
    window.CURRENT_POSITION = { lat, lng, accuracy };
  }

  function startLiveLocation() {
    if (!mapInstance) return;

    // 1) Native Geolocation API (primary)
    if (navigator.geolocation) {
      const options = { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 };
      try {
        navigator.geolocation.watchPosition(
          (pos) => { console.log('[GEO] watchPosition fix'); applyUserLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy); },
          (err) => console.warn('[GEO] watchPosition error:', err && err.message),
          options
        );

        // Dodatkowy refresh co 15s dla urządzeń, gdzie watch potrafi przestać działać
        if (!window.__ceGeoRefresh) {
          window.__ceGeoRefresh = setInterval(() => {
            try {
              navigator.geolocation.getCurrentPosition(
                (pos) => { console.log('[GEO] periodic getCurrentPosition fix'); applyUserLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy); },
                (e) => console.warn('[GEO] periodic getCurrentPosition error:', e?.message),
                { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
              );
            } catch (_) {}
          }, 15000);
        }
      } catch (e) {
        console.warn('[GEO] watchPosition threw:', e?.message);
      }
    } else {
      console.warn('[GEO] navigator.geolocation not available');
    }

    // 2) Leaflet fallback using map.locate (handles some iOS cases)
    try {
      mapInstance.on('locationfound', (e) => { console.log('[GEO] leaflet locationfound'); applyUserLocation(e.latlng.lat, e.latlng.lng, e.accuracy); });
      mapInstance.on('locationerror', (e) => console.warn('[GEO] Leaflet locate error:', e?.message));
      mapInstance.locate({ setView: false, watch: true, enableHighAccuracy: true, maxZoom: 15 });
    } catch (e) {
      console.warn('[GEO] map.locate failed:', e?.message);
    }

    // Fallback: jeżeli po 5 sekundach wciąż brak pozycji, wymuś jednorazowe locate z centrowaniem
    if (!window.__ceForcedLocate) {
      window.__ceForcedLocate = true;
      setTimeout(() => {
        if (!userLocationInitialized) {
          console.log('[GEO] forcing single locate with setView');
          try { mapInstance.locate({ setView: true, watch: false, enableHighAccuracy: true, maxZoom: 15 }); } catch (_) {}
        }
      }, 5000);
    }
  }

  // Dodaj przycisk "Centruj na mnie" jako kontrolkę Leaflet
  function addLocateControl() {
    if (!mapInstance || L.Control.CeLocate) return;
    L.Control.CeLocate = L.Control.extend({
      onAdd() {
        const btn = L.DomUtil.create('button', 'leaflet-bar');
        btn.title = 'Pokaż moją lokalizację';
        btn.innerHTML = '🎯';
        btn.style.cssText = 'background:#fff;border:none;width:34px;height:34px;cursor:pointer;font-size:18px;line-height:34px;text-align:center;';
        L.DomEvent.on(btn, 'click', (e) => {
          L.DomEvent.stopPropagation(e);
          L.DomEvent.preventDefault(e);
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
              applyUserLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
              try { mapInstance.setView([pos.coords.latitude, pos.coords.longitude], Math.max(mapInstance.getZoom(), 14), { animate: true }); } catch (_) {}
            }, () => requestLocationPermission(), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
          } else {
            requestLocationPermission();
          }
        });
        return btn;
      },
      onRemove() {}
    });
    L.control.ceLocate = function(opts){ return new L.Control.CeLocate(opts); };
    L.control.ceLocate({ position: 'topleft' }).addTo(mapInstance);
  }

  /**
   * Renderuje listę POI pod mapą
   */
  async function renderLocationsList() {
    console.log('📋 Renderuję listę lokalizacji...');
    
    const locationsList = document.getElementById('locationsList');
    if (!locationsList) {
      console.log('ℹ️ Element #locationsList nie znaleziony');
      return;
    }
    
    // Czekaj na dane
    await waitForPlacesData();
    
    if (!window.PLACES_DATA || window.PLACES_DATA.length === 0) {
      locationsList.innerHTML = '<li style="padding: 1rem; color: #666;">Brak dostępnych lokalizacji</li>';
      return;
    }
    
    // Wyczyść listę
    locationsList.innerHTML = '';
    
    // Pokaż pierwsze 3 POI
    const previewCount = 3;
    const poisToShow = window.PLACES_DATA.slice(0, previewCount);
    
    poisToShow.forEach(poi => {
      const name = poi.nameFallback || poi.name || poi.id || 'Unnamed';
      const xp = poi.xp || 100;
      
      const li = document.createElement('li');
      li.className = 'location-card';
      li.innerHTML = `
        <div class="location-info">
          <h3 class="location-name">${name}</h3>
          <p class="location-xp">✨ ${xp} XP</p>
        </div>
        <button class="location-action secondary" onclick="focusPlaceOnMap('${poi.id}')">
          📍 Pokaż na mapie
        </button>
      `;
      locationsList.appendChild(li);
    });
    
    console.log(`✅ Lista renderowana: ${poisToShow.length} lokalizacji`);
  }
  
  /**
   * Fokusuje mapę na POI
   */
  window.focusPlaceOnMap = function(placeId) {
    const poi = window.PLACES_DATA?.find(p => p.id === placeId);
    if (!poi || !mapInstance) return;
    
    mapInstance.setView([poi.lat, poi.lng], 14, { animate: true });
    
    // Znajdź i otwórz popup
    setTimeout(() => {
      markersLayer.eachLayer(layer => {
        if (layer instanceof L.Marker) {
          const latLng = layer.getLatLng();
          if (Math.abs(latLng.lat - poi.lat) < 0.0001 && 
              Math.abs(latLng.lng - poi.lng) < 0.0001) {
            layer.openPopup();
          }
        }
      });
    }, 500);
  };
  
  /**
   * Export dla manualnego użycia
   */
  window.addMarkers = addMarkers;
  window.mapInstance = mapInstance;
  window.markersLayer = markersLayer;
  
  /**
   * Inicjalizacja główna
   */
  function createLocationPromptUI(onClick) {
    const id = 'ce-location-prompt';
    if (document.getElementById(id)) return;
    const bar = document.createElement('div');
    bar.id = id;
    bar.setAttribute('role', 'dialog');
    bar.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:10000;padding:12px 14px;background:#0ea5e9;color:#fff;border-radius:12px;box-shadow:0 10px 30px rgba(2,6,23,.25);display:flex;gap:12px;align-items:center;justify-content:space-between;';
    bar.innerHTML = `
      <div style="display:flex;gap:10px;align-items:center;">
        <span style="font-size:18px">📍</span>
        <div>
          <div style="font-weight:700;">Włącz lokalizację</div>
          <div style="font-size:13px;opacity:.95">Pokażemy Twoją pozycję na mapie, aby łatwiej zdobywać punkty.</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <button id="ceLocationEnableBtn" style="appearance:none;border:0;background:#fff;color:#0ea5e9;font-weight:700;padding:8px 12px;border-radius:10px;cursor:pointer;">Włącz teraz</button>
        <button id="ceLocationCloseBtn" aria-label="Zamknij" style="appearance:none;border:0;background:transparent;color:#fff;font-size:20px;opacity:.9;cursor:pointer;">×</button>
      </div>`;
    document.body.appendChild(bar);
    const btn = document.getElementById('ceLocationEnableBtn');
    const close = document.getElementById('ceLocationCloseBtn');
    if (btn) btn.addEventListener('click', () => onClick && onClick());
    if (close) close.addEventListener('click', () => bar.remove());
  }

  async function requestLocationPermission() {
    try {
      if (!navigator.geolocation) return;
      await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => { console.log('[GEO] getCurrentPosition initial fix'); window.__lastInitialFix = pos; resolve(pos); },
          (err) => { console.warn('[GEO] getCurrentPosition error:', err?.message); resolve(null); },
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
        );
      });
      // Uruchom ponownie śledzenie po interakcji
      startLiveLocation();
      // Schowaj pasek jeśli istnieje
      const bar = document.getElementById('ce-location-prompt');
      if (bar) bar.remove();
    } catch (e) {
      console.warn('[GEO] requestLocationPermission error:', e?.message);
    }
  }

  async function checkGeolocationPermission() {
    if (!('permissions' in navigator)) {
      // Brak Permissions API – pokaż przycisk dla bezpieczeństwa
      createLocationPromptUI(requestLocationPermission);
      return;
    }
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' });
      if (status.state === 'granted') {
        console.log('[GEO] permission already granted');
        // Upewnij się, że tracking startuje
        startLiveLocation();
        return;
      }
      if (status.state === 'prompt') {
        createLocationPromptUI(requestLocationPermission);
      } else if (status.state === 'denied') {
        // Pokaż pasek z informacją i przyciskiem (może otworzyć prompt w niektórych przeglądarkach)
        createLocationPromptUI(requestLocationPermission);
      }
      // Reaguj na zmiany
      status.onchange = () => {
        if (status.state === 'granted') {
          const bar = document.getElementById('ce-location-prompt');
          if (bar) bar.remove();
          startLiveLocation();
        }
      };
    } catch (e) {
      console.warn('permissions.query failed:', e?.message);
      createLocationPromptUI(requestLocationPermission);
    }
  }

  async function initialize() {
    console.log('🚀 Inicjalizuję aplikację...');
    
    // Inicjalizuj mapę
    await initializeMap();
    
    // Renderuj listę POI
    await renderLocationsList();

    // Jeżeli pozycja nie jest jeszcze znana, zaproponuj włączenie lokalizacji (user gesture)
    checkGeolocationPermission();
    
    // Przyciski komentarzy na mapie zostały usunięte
    // Komentarze dostępne są tylko w panelu pod mapą
    
    console.log('✅ Aplikacja zainicjalizowana');
  }
  
  // Start po załadowaniu DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
  
  console.log('🔵 App Core V3 - GOTOWY (mapa bez komentarzy, komentarze dostępne w panelu poniżej)');
})();
