/**
 * APP CORE V2 - Uproszczona wersja z gwarancją działania markerów
 */

console.log('🔵 App Core V2 - START');

(function() {
  'use strict';

  // Globalne zmienne mapy
  let mapInstance = null;
  let markersLayer = null;
  
  /**
   * Czeka na PLACES_DATA
   */
  async function waitForPlacesData() {
    console.log('⏳ Czekam na PLACES_DATA...');
    
    for (let i = 0; i < 100; i++) {
      if (window.PLACES_DATA && window.PLACES_DATA.length > 0) {
        console.log(`✅ PLACES_DATA gotowe (${window.PLACES_DATA.length} POI)`);
        return window.PLACES_DATA;
      }

  /**
   * Bezpieczne otwarcie modala komentarzy dla danego POI.
   * Czeka na: dane POI, załadowanie modułu community/ui.js i funkcję window.openPoiComments.
   */
  async function safeOpenComments(poiId) {
    try {
      if (!poiId) return false;
      // Upewnij się, że dane POI są dostępne (spójne ID z Supabase)
      await waitForPlacesData();

      // Poczekaj maks 5s aż funkcja będzie dostępna (module load)
      let tries = 0;
      while (typeof window.openPoiComments !== 'function' && tries < 50) {
        await new Promise(r => setTimeout(r, 100));
        tries++;
      }
      if (typeof window.openPoiComments !== 'function') {
        console.error('❌ openPoiComments not ready');
        return false;
      }
      console.log('🟢 safeOpenComments →', poiId);
      await window.openPoiComments(poiId);
      return true;
    } catch (e) {
      console.error('❌ safeOpenComments error:', e);
      return false;
    }
  }
  // Export helper for other scripts if needed
  window.safeOpenComments = safeOpenComments;
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.error('❌ PLACES_DATA nie załadowane po 10 sekundach');
    console.error('→ window.PLACES_DATA:', window.PLACES_DATA);
    return [];
  }
  
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
    
    // Czekaj na dane
    await waitForPlacesData();
    
    if (!window.PLACES_DATA || window.PLACES_DATA.length === 0) {
      console.error('❌ Brak PLACES_DATA - nie mogę dodać markerów');
      console.error('→ Sprawdź czy są POI w bazie z statusem "published"');
      console.error('→ Uruchom CHECK_DATABASE.sql w Supabase');
      return;
    }
    
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
      
      console.log('✅ Mapa utworzona');
    }
    
    // Dodaj markery
    addMarkers();
    
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
   * Dodaje markery na mapę
   */
  function addMarkers() {
    console.log('📍 Dodaję markery...');
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
    
    // Dodaj każdy POI
    let addedCount = 0;
    let skippedCount = 0;
    
    window.PLACES_DATA.forEach((poi, index) => {
      // Normalizacja współrzędnych (obsługa różnych pól)
      const lat = (typeof poi.lat === 'number') ? poi.lat
                 : (typeof poi.latitude === 'number') ? poi.latitude
                 : parseFloat(poi.lat ?? poi.latitude);
      const lng = (typeof poi.lng === 'number') ? poi.lng
                 : (typeof poi.lon === 'number') ? poi.lon
                 : (typeof poi.longitude === 'number') ? poi.longitude
                 : parseFloat(poi.lng ?? poi.lon ?? poi.longitude);

      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) {
        console.warn(`⚠️ [${index}] Pomijam POI bez prawidłowych współrzędnych:`, poi.id, { lat: poi.lat, lng: poi.lng, lon: poi.lon, longitude: poi.longitude });
        skippedCount++;
        return;
      }
      
      // Nazwa
      const name = poi.nameFallback || poi.name || poi.id || 'Unnamed';
      
      console.log(`📍 [${index}] Dodaję: ${name} [${poi.lat}, ${poi.lng}]`);
      
      // Stwórz marker
      const marker = L.marker([lat, lng], { icon: customIcon });
      
      // Popup
      const googleMapsUrl = typeof window.getPoiGoogleUrl === 'function'
        ? (window.getPoiGoogleUrl(poi) || `https://maps.google.com/?q=${lat},${lng}`)
        : (poi.googleMapsUrl || poi.googleMapsURL || `https://maps.google.com/?q=${lat},${lng}`);
      
      marker.bindPopup(`
        <div style="min-width: 220px;">
          <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #2563eb;">${name}</h3>
          <p style="margin: 0 0 12px 0; font-size: 14px;">⭐ ${poi.xp || 100} XP</p>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <a href="${googleMapsUrl}" target="_blank" rel="noopener" style="display: inline-block; padding: 6px 10px; background: #2563eb; color: white; text-decoration: none; border-radius: 4px; font-size: 13px;">Google Maps →</a>
            <button type="button" data-poi-id="${poi.id}" class="popup-comments-btn" style="padding:6px 10px; background:#f3f4f6; color:#111827; border:1px solid #e5e7eb; border-radius:4px; font-size:13px; cursor:pointer;">💬 Komentarze</button>
          </div>
        </div>
      `, { maxWidth: 270 });

      // Sync current place when marker is clicked
      marker.on('click', () => {
        if (typeof window.setCurrentPlace === 'function') {
          window.setCurrentPlace(poi.id, { scroll: true });
        }
      });

      // Wire comments button on popup open (scope to this popup only)
      marker.on('popupopen', (ev) => {
        try {
          const popupEl = ev && ev.popup && typeof ev.popup.getElement === 'function'
            ? ev.popup.getElement()
            : null;
          const btn = popupEl ? popupEl.querySelector('.popup-comments-btn[data-poi-id="' + poi.id + '"]')
                               : document.querySelector('.popup-comments-btn[data-poi-id="' + poi.id + '"]');
          if (!btn) {
            console.warn('⚠️ Nie znaleziono przycisku Komentarze w popup dla', poi.id);
            return;
          }
          // Remove previous listener if re-opening the same popup
          btn.replaceWith(btn.cloneNode(true));
          const freshBtn = (popupEl ? popupEl.querySelector('.popup-comments-btn[data-poi-id="' + poi.id + '"]')
                                    : document.querySelector('.popup-comments-btn[data-poi-id="' + poi.id + '"]')) || btn;
          freshBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await safeOpenComments(poi.id);
          });
        } catch (err) {
          console.error('❌ Błąd podczas podpinania przycisku Komentarze do popup:', err);
        }
      });
      
      // Dodaj do warstwy
      marker.addTo(markersLayer);
      addedCount++;
    });
    
    console.log(`✅ Dodano ${addedCount} markerów`);
    if (skippedCount > 0) {
      console.warn(`⚠️ Pominięto ${skippedCount} POI bez współrzędnych`);
    }
    
    // Status do UI
    if (addedCount === 0) {
      console.error('❌ ŻADEN MARKER NIE ZOSTAŁ DODANY!');
      console.error('→ Sprawdź czy POI mają współrzędne (lat, lng)');
      console.error('→ Uruchom CHECK_DATABASE.sql');
    }
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
  async function initialize() {
    console.log('🚀 Inicjalizuję aplikację...');
    
    // Inicjalizuj mapę
    await initializeMap();
    
    // Renderuj listę POI
    await renderLocationsList();
    
    // Globalny delegowany handler dla kliknięć w przycisk Komentarze w popupach
    if (!window.__popupCommentsBound) {
      window.__popupCommentsBound = true;
      document.addEventListener('click', (e) => {
        const target = e.target instanceof Element ? e.target : null;
        if (!target) return;
        const btn = target.closest && target.closest('.popup-comments-btn[data-poi-id]');
        if (!btn) return;
        const poiId = btn.getAttribute('data-poi-id');
        if (!poiId) return;
        e.preventDefault();
        e.stopPropagation();
        console.log('🟢 [delegated] Klik w Komentarze (map popup) dla POI:', poiId);
        if (typeof window.openPoiComments === 'function') {
          window.openPoiComments(poiId);
        } else {
          console.warn('openPoiComments not available (delegated)');
        }
      }, true);
    }
    
    console.log('✅ Aplikacja zainicjalizowana');
  }
  
  // Start po załadowaniu DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
  
  console.log('🔵 App Core V2 - GOTOWY');
})();
