/**
 * POI LOADER V2 - Uproszczona wersja która NA PEWNO DZIAŁA
 * Ładuje POI z Supabase i udostępnia globalnie jako PLACES_DATA
 */

try {
  if (typeof localStorage !== 'undefined' && localStorage.getItem('CE_DEBUG') === 'true') {
    console.log('🔵 POI Loader V2 - START');
  }
} catch (_) {}

// Globalna zmienna dla POI
window.PLACES_DATA = [];
window.PLACES_DATA_LOADED = false;
window.POI_CATEGORIES_DATA = [];

const CE_DEBUG_POI_LOADER = typeof localStorage !== 'undefined' && localStorage.getItem('CE_DEBUG') === 'true';
function ceLog(...args) {
  if (CE_DEBUG_POI_LOADER) console.log(...args);
}

const POIS_CACHE_KEY = 'ce_cache_pois_transformed_v1';
const POIS_CACHE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_POI_CATEGORY_SLUG = 'uncategorized';
const DEFAULT_POI_CATEGORY_ICON = '📍';
const DEFAULT_POI_CATEGORY_COLOR = '#2563eb';

function readPoisCache() {
  try {
    const raw = localStorage.getItem(POIS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.data)) return null;
    return parsed.data;
  } catch (_) {
    return null;
  }
}

function writePoisCache(data) {
  try {
    if (!Array.isArray(data)) return;
    localStorage.setItem(POIS_CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch (_) {}
}

try {
  const cached = readPoisCache();
  if (cached && cached.length > 0) {
    window.PLACES_DATA = cached;
    window.PLACES_DATA_LOADED = true;
    ceLog(`✅ POI załadowane z cache: ${cached.length}`);
  }
} catch (_) {}

/**
 * Czeka na Supabase client
 * UWAGA: Nazwa zmieniona z waitForSupabase na waitForSupabaseClient
 * aby uniknąć konfliktu z footer-referral.js
 */
async function waitForSupabaseClient(maxAttempts = 50) {
  ceLog('⏳ Czekam na Supabase client...');
  
  for (let i = 0; i < maxAttempts; i++) {
    // Sprawdź różne sposoby dostępu
    const client = window.supabaseClient || 
                   window.sb || 
                   window.__SB__ ||
                   (window.getSupabase && window.getSupabase());
    
    if (client) {
      ceLog(`✅ Supabase client znaleziony (próba ${i + 1})`);
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
  ceLog('📥 Ładuję POI z Supabase...');
  
  try {
    // Czekaj na Supabase
    const supabase = await waitForSupabaseClient();
    
    if (!supabase) {
      console.error('❌ Brak Supabase client - używam fallback');
      return useFallbackData();
    }

    const poiCategoryMap = await loadPoiCategoriesFromSupabase(supabase);
    window.POI_CATEGORIES_DATA = Array.from(poiCategoryMap.values());
    
    // Pobierz POI z bazy (tylko Published)
    ceLog('🔍 Zapytanie: SELECT * FROM pois WHERE status = published');
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
    
    ceLog(`✅ Pobrano ${pois.length} POI z Supabase`);
    
    // Transformuj dane
    const transformedPOIs = pois.map(poi => transformPOI(poi, poiCategoryMap));
    
    ceLog('✅ Transformacja zakończona');
    ceLog('📍 Przykładowy POI:', transformedPOIs[0]);
    
    return transformedPOIs;
    
  } catch (err) {
    console.error('❌ Wyjątek podczas ładowania POI:', err);
    return useFallbackData();
  }
}

/**
 * Get translation from i18n JSONB field
 */
function getTranslation(i18nObj, fallback = '') {
  if (!i18nObj || typeof i18nObj !== 'object') {
    return fallback;
  }
  
  // Get current language
  const currentLang = window.appI18n?.language || 'pl';
  
  // Fallback chain: current → en → pl → fallback
  return i18nObj[currentLang] || i18nObj.en || i18nObj.pl || fallback;
}

function normalizePoiCategorySlug(value) {
  const slug = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return slug || DEFAULT_POI_CATEGORY_SLUG;
}

function normalizePoiCategoryRecord(row) {
  if (!row || typeof row !== 'object') return null;
  const slug = normalizePoiCategorySlug(row.slug || row.name_en || row.name_pl || row.id);
  const iconRaw = String(row.icon || DEFAULT_POI_CATEGORY_ICON).trim();
  return {
    id: String(row.id || '').trim() || null,
    slug,
    name_en: String(row.name_en || '').trim() || slug,
    name_pl: String(row.name_pl || '').trim() || null,
    icon: Array.from(iconRaw).slice(0, 2).join('') || DEFAULT_POI_CATEGORY_ICON,
    color: String(row.color || DEFAULT_POI_CATEGORY_COLOR).trim() || DEFAULT_POI_CATEGORY_COLOR,
    active: row.active !== false,
  };
}

function getPoiCategoryMapFromWindow() {
  const map = new Map();
  const categories = Array.isArray(window.POI_CATEGORIES_DATA) ? window.POI_CATEGORIES_DATA : [];
  categories.forEach((row) => {
    const normalized = normalizePoiCategoryRecord(row);
    if (!normalized) return;
    map.set(normalized.slug, normalized);
    if (normalized.id) map.set(`id:${normalized.id}`, normalized);
  });
  return map;
}

async function loadPoiCategoriesFromSupabase(supabase) {
  const map = new Map();
  if (!supabase) return map;

  try {
    const { data, error } = await supabase
      .from('poi_categories')
      .select('id, slug, name_en, name_pl, icon, color, active, display_order')
      .eq('active', true)
      .order('display_order', { ascending: true })
      .order('name_en', { ascending: true });

    if (error) throw error;

    (Array.isArray(data) ? data : []).forEach((row) => {
      const normalized = normalizePoiCategoryRecord(row);
      if (!normalized) return;
      map.set(normalized.slug, normalized);
      if (normalized.id) map.set(`id:${normalized.id}`, normalized);
    });
  } catch (error) {
    const message = String(error?.message || '');
    if (!/poi_categories|category_id|does not exist|Could not find the table/i.test(message)) {
      console.warn('⚠️ Could not load POI categories:', error);
    }
  }

  return map;
}

/**
 * Transformuje POI z formatu bazy do formatu aplikacji
 */
function transformPOI(dbPoi, poiCategoryMap = null) {
  // Use i18n fields if available, otherwise fallback to old fields
  const nameFallback = String(dbPoi.name || dbPoi.name_pl || dbPoi.name_en || dbPoi.title || 'Unnamed Place').trim() || 'Unnamed Place';
  const descriptionFallback = String(dbPoi.description || dbPoi.description_pl || dbPoi.description_en || '').trim();
  const badgeFallback = String(dbPoi.badge || dbPoi.badge_pl || dbPoi.badge_en || 'Explorer').trim() || 'Explorer';
  const name = getTranslation(dbPoi.name_i18n, nameFallback);
  const description = getTranslation(dbPoi.description_i18n, descriptionFallback);
  const badge = getTranslation(dbPoi.badge_i18n, badgeFallback);
  const categorySlug = normalizePoiCategorySlug(dbPoi.category || dbPoi.poi_category || dbPoi.badge || DEFAULT_POI_CATEGORY_SLUG);
  const categoryId = String(dbPoi.category_id || '').trim() || null;
  const categories = poiCategoryMap instanceof Map ? poiCategoryMap : getPoiCategoryMapFromWindow();
  const categoryMeta = categories.get(`id:${categoryId}`) || categories.get(categorySlug) || null;
  const categoryIcon = categoryMeta?.icon || DEFAULT_POI_CATEGORY_ICON;
  const categoryColor = categoryMeta?.color || DEFAULT_POI_CATEGORY_COLOR;

  let photos = dbPoi.photos || [];
  if (typeof photos === 'string') {
    try {
      photos = JSON.parse(photos);
    } catch (_) {
      photos = [];
    }
  }
  photos = Array.isArray(photos) ? photos.map((u) => String(u || '').trim()).filter(Boolean).slice(0, 12) : [];

  const mainImageUrl = (
    dbPoi.main_image_url
    || dbPoi.image_url
    || dbPoi.cover_image_url
    || (photos.length ? photos[0] : '')
    || ''
  );
  
  return {
    id: dbPoi.id,
    name: name, // Direct translated value
    nameFallback: name,  // For backward compatibility
    nameKey: `places.${dbPoi.id}.name`, // Keep for legacy
    description: description,
    descriptionFallback: description,
    descriptionKey: `places.${dbPoi.id}.description`,
    badge: badge,
    badgeFallback: badge,
    badgeKey: `places.${dbPoi.id}.badge`,
    lat: parseFloat(dbPoi.lat) || 0,
    lng: parseFloat(dbPoi.lng) || 0,
    // Canonical Google link: prefer dedicated column, fallback to lat/lng
    google_url: dbPoi.google_url || dbPoi.google_maps_url || `https://www.google.com/maps?q=${dbPoi.lat},${dbPoi.lng}`,
    // Backwards-compatible aliases commonly used around the site
    googleMapsUrl: dbPoi.google_url || dbPoi.google_maps_url || `https://www.google.com/maps?q=${dbPoi.lat},${dbPoi.lng}`,
    googleMapsURL: dbPoi.google_url || dbPoi.google_maps_url || `https://www.google.com/maps?q=${dbPoi.lat},${dbPoi.lng}`,
    main_image_url: mainImageUrl,
    photos: photos,
    category: categorySlug,
    category_id: categoryMeta?.id || categoryId || null,
    category_icon: categoryIcon,
    category_name_en: categoryMeta?.name_en || categorySlug,
    category_name_pl: categoryMeta?.name_pl || null,
    category_color: categoryColor,
    xp: parseInt(dbPoi.xp) || 100,
    requiredLevel: parseInt(dbPoi.required_level) || 1,
    source: 'supabase',
    status: dbPoi.status,
    raw: dbPoi // Keep raw data for re-transform on language change
  };
}

/**
 * Używa danych statycznych jako fallback
 */
function useFallbackData() {
  ceLog('ℹ️ Używam fallback data (STATIC_PLACES_DATA)');
  
  if (typeof window.STATIC_PLACES_DATA !== 'undefined' && window.STATIC_PLACES_DATA.length > 0) {
    ceLog(`✅ Znaleziono ${window.STATIC_PLACES_DATA.length} POI w STATIC_PLACES_DATA`);
    return window.STATIC_PLACES_DATA;
  }
  
  console.warn('⚠️ Brak STATIC_PLACES_DATA - zwracam pustą tablicę');
  return [];
}

/**
 * Inicjalizuje dane POI
 */
async function initializePOIs() {
  ceLog('🚀 Inicjalizuję POI...');
  
  try {
    // Załaduj z Supabase
    const pois = await loadPOIsFromSupabase();
    
    // Ustaw globalnie
    window.PLACES_DATA = pois;
    window.PLACES_DATA_LOADED = true;
    
    writePoisCache(pois);
    ceLog(`✅ PLACES_DATA załadowane: ${pois.length} POI`);
    
    // Emit event
    const event = new CustomEvent('poisDataRefreshed', {
      detail: {
        count: pois.length,
        source: pois.length > 0 && pois[0].source === 'supabase' ? 'supabase' : 'fallback'
      }
    });
    window.dispatchEvent(event);
    ceLog('📡 Event "poisDataRefreshed" emitowany');
    
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
  ceLog('🔄 Odświeżam POI...');
  
  const pois = await loadPOIsFromSupabase();
  window.PLACES_DATA = pois;
  writePoisCache(pois);
  
  ceLog(`✅ POI odświeżone: ${pois.length} elementów`);
  
  // Emit event
  const event = new CustomEvent('poisDataRefreshed', {
    detail: {
      count: pois.length,
      source: pois.length > 0 && pois[0].source === 'supabase' ? 'supabase' : 'fallback'
    }
  });
  window.dispatchEvent(event);
  ceLog('📡 Event "poisDataRefreshed" emitowany');
  
  return pois;
}

// Export globalnie
window.initializePOIs = initializePOIs;
window.refreshPOIs = refreshPOIs;
window.refreshPoisData = refreshPOIs; // Alias dla kompatybilności

// Helper: unified Google link getter for any POI-like object
window.getPoiGoogleUrl = function getPoiGoogleUrl(poi) {
  if (!poi) return null;
  const lat = poi.lat ?? poi.latitude;
  const lng = poi.lng ?? poi.lon ?? poi.longitude;
  const direct = poi.google_url || poi.googleMapsUrl || poi.googleMapsURL;
  if (direct && typeof direct === 'string' && direct.trim().length > 0) {
    return direct.trim();
  }
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }
  return null;
};

// Auto-init
ceLog('⏰ Planowanie auto-init...');
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    ceLog('📄 DOMContentLoaded - uruchamiam initializePOIs');
    initializePOIs();
  });
} else {
  ceLog('📄 DOM już załadowany - uruchamiam initializePOIs natychmiast');
  initializePOIs();
}

// Listen for language change
document.addEventListener('wakacjecypr:languagechange', (event) => {
  const newLanguage = event.detail.language;
  ceLog(`🌍 Język zmieniony na: ${newLanguage}`);
  
  // Re-transform POIs with new language
  if (window.PLACES_DATA && window.PLACES_DATA.length > 0) {
    const categoryMap = getPoiCategoryMapFromWindow();
    window.PLACES_DATA = window.PLACES_DATA.map(poi => {
      if (poi.raw) {
        return transformPOI(poi.raw, categoryMap);
      }
      return poi;
    });
    
    // Emit refresh event
    window.dispatchEvent(new CustomEvent('poisDataRefreshed', {
      detail: { 
        count: window.PLACES_DATA.length,
        language: newLanguage 
      }
    }));
    
    ceLog(`✅ POI przetłumaczone na: ${newLanguage}`);
  }
});

ceLog('🔵 POI Loader V2 - GOTOWY');
