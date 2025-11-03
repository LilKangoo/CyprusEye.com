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
      mapInstance = L.map('map').setView([35.095, 33.203], 9);
      
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
      // Walidacja
      if (!poi.lat || !poi.lng || poi.lat === 0 || poi.lng === 0) {
        console.warn(`⚠️ [${index}] Pomijam POI bez współrzędnych:`, poi.id, poi);
        skippedCount++;
        return;
      }
      
      // Nazwa
      const name = poi.nameFallback || poi.name || poi.id || 'Unnamed';
      
      console.log(`📍 [${index}] Dodaję: ${name} [${poi.lat}, ${poi.lng}]`);
      
      // Stwórz marker
      const marker = L.marker([poi.lat, poi.lng], { icon: customIcon });
      
      // Popup
      const googleMapsUrl = poi.googleMapsUrl || poi.googleMapsURL || `https://maps.google.com/?q=${poi.lat},${poi.lng}`;
      
      marker.bindPopup(`
        <div style="min-width: 200px;">
          <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #2563eb;">${name}</h3>
          <p style="margin: 0 0 8px 0; font-size: 14px;">⭐ ${poi.xp || 100} XP</p>
          <a href="${googleMapsUrl}" target="_blank" rel="noopener" style="display: inline-block; padding: 6px 10px; background: #2563eb; color: white; text-decoration: none; border-radius: 4px; font-size: 13px;">Google Maps →</a>
        </div>
      `, { maxWidth: 250 });
      
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
