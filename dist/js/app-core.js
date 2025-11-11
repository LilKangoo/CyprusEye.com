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
      
      // Nazwa z Supabase (with i18n support)
      const name = window.getPoiName ? window.getPoiName(poi) : (poi.nameFallback || poi.name || poi.id);
      
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
      const name = window.getPoiName ? window.getPoiName(poi) : (poi.nameFallback || poi.name || poi.id || 'Unnamed');
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
