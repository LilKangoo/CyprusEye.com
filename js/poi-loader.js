/**
 * POI LOADER V2 - Uproszczona wersja która NA PEWNO DZIAŁA
 * Ładuje POI z Supabase i udostępnia globalnie jako PLACES_DATA
 */

console.log('🔵 POI Loader V2 - START');

// Globalna zmienna dla POI
window.PLACES_DATA = [];
window.PLACES_DATA_LOADED = false;

/**
 * Czeka na Supabase client
 */
async function waitForSupabase(maxAttempts = 50) {
  console.log('⏳ Czekam na Supabase client...');
  
  for (let i = 0; i < maxAttempts; i++) {
    // Sprawdź różne sposoby dostępu
    const client = window.supabaseClient || 
                   window.sb || 
                   window.__SB__ ||
                   (window.getSupabase && window.getSupabase());
    
    if (client) {
      console.log(`✅ Supabase client znaleziony (próba ${i + 1})`);
      return client;
    }
    
    // Czekaj 100ms
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.error('❌ Supabase client nie dostępny po 5 sekundach');
  return null;
}

/**
 * Ładuje POI z Supabase
 */
async function loadPOIsFromSupabase() {
  console.log('📥 Ładuję POI z Supabase...');
  
  try {
    // Czekaj na Supabase
    const supabase = await waitForSupabase();
    
    if (!supabase) {
      console.error('❌ Brak Supabase client - używam fallback');
      return useFallbackData();
    }
    
    // Pobierz POI z bazy (tylko Published)
    console.log('🔍 Zapytanie: SELECT * FROM pois WHERE status = published');
    const { data: pois, error } = await supabase
      .from('pois')
      .select('*')
      .eq('status', 'published')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Błąd Supabase:', error);
      return useFallbackData();
    }
    
    if (!pois || pois.length === 0) {
      console.warn('⚠️ BRAK POI w bazie z statusem "published"');
      console.warn('→ Uruchom: UPDATE pois SET status = \'published\';');
      return useFallbackData();
    }
    
    console.log(`✅ Pobrano ${pois.length} POI z Supabase`);
    
    // Transformuj dane
    const transformedPOIs = pois.map(poi => transformPOI(poi));
    
    console.log('✅ Transformacja zakończona');
    console.log('📍 Przykładowy POI:', transformedPOIs[0]);
    
    return transformedPOIs;
    
  } catch (err) {
    console.error('❌ Wyjątek podczas ładowania POI:', err);
    return useFallbackData();
  }
}

/**
 * Transformuje POI z formatu bazy do formatu aplikacji
 */
function transformPOI(dbPoi) {
  return {
    id: dbPoi.id,
    nameKey: `places.${dbPoi.id}.name`,
    nameFallback: dbPoi.name || 'Unnamed Place',
    descriptionKey: `places.${dbPoi.id}.description`,
    descriptionFallback: dbPoi.description || '',
    badgeKey: `places.${dbPoi.id}.badge`,
    badgeFallback: dbPoi.badge || 'Explorer',
    lat: parseFloat(dbPoi.lat) || 0,
    lng: parseFloat(dbPoi.lng) || 0,
    googleMapsUrl: dbPoi.google_maps_url || `https://maps.google.com/?q=${dbPoi.lat},${dbPoi.lng}`,
    googleMapsURL: dbPoi.google_maps_url || `https://maps.google.com/?q=${dbPoi.lat},${dbPoi.lng}`,
    xp: parseInt(dbPoi.xp) || 100,
    requiredLevel: parseInt(dbPoi.required_level) || 1,
    source: 'supabase',
    status: dbPoi.status,
    raw: dbPoi
  };
}

/**
 * Używa danych statycznych jako fallback
 */
function useFallbackData() {
  console.log('ℹ️ Używam fallback data (STATIC_PLACES_DATA)');
  
  if (typeof window.STATIC_PLACES_DATA !== 'undefined' && window.STATIC_PLACES_DATA.length > 0) {
    console.log(`✅ Znaleziono ${window.STATIC_PLACES_DATA.length} POI w STATIC_PLACES_DATA`);
    return window.STATIC_PLACES_DATA;
  }
  
  console.warn('⚠️ Brak STATIC_PLACES_DATA - zwracam pustą tablicę');
  return [];
}

/**
 * Inicjalizuje dane POI
 */
async function initializePOIs() {
  console.log('🚀 Inicjalizuję POI...');
  
  try {
    // Załaduj z Supabase
    const pois = await loadPOIsFromSupabase();
    
    // Ustaw globalnie
    window.PLACES_DATA = pois;
    window.PLACES_DATA_LOADED = true;
    
    console.log(`✅ PLACES_DATA załadowane: ${pois.length} POI`);
    console.log('📊 window.PLACES_DATA:', window.PLACES_DATA);
    
    // Emit event
    const event = new CustomEvent('poisDataRefreshed', {
      detail: {
        count: pois.length,
        source: pois.length > 0 && pois[0].source === 'supabase' ? 'supabase' : 'fallback'
      }
    });
    window.dispatchEvent(event);
    console.log('📡 Event "poisDataRefreshed" emitowany');
    
    return pois;
    
  } catch (err) {
    console.error('❌ Błąd inicjalizacji POI:', err);
    window.PLACES_DATA = [];
    window.PLACES_DATA_LOADED = true;
    return [];
  }
}

/**
 * Refresh POI (po zmianach w admin)
 */
async function refreshPOIs() {
  console.log('🔄 Odświeżam POI...');
  
  const pois = await loadPOIsFromSupabase();
  window.PLACES_DATA = pois;
  
  console.log(`✅ POI odświeżone: ${pois.length} elementów`);
  
  // Emit event
  const event = new CustomEvent('poisDataRefreshed', {
    detail: {
      count: pois.length,
      source: pois.length > 0 && pois[0].source === 'supabase' ? 'supabase' : 'fallback'
    }
  });
  window.dispatchEvent(event);
  console.log('📡 Event "poisDataRefreshed" emitowany');
  
  return pois;
}

// Export globalnie
window.initializePOIs = initializePOIs;
window.refreshPOIs = refreshPOIs;
window.refreshPoisData = refreshPOIs; // Alias dla kompatybilności

// Auto-init
console.log('⏰ Planowanie auto-init...');
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOMContentLoaded - uruchamiam initializePOIs');
    initializePOIs();
  });
} else {
  console.log('📄 DOM już załadowany - uruchamiam initializePOIs natychmiast');
  initializePOIs();
}

console.log('🔵 POI Loader V2 - GOTOWY');
