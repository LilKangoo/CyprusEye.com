// POI Loader - Dynamic loading from Supabase
// This replaces static PLACES_DATA with live database data

let PLACES_DATA = []; // Will be populated from Supabase
let poisLoadedFromSupabase = false;

/**
 * Load POIs from Supabase database
 * @returns {Promise<Array>} Array of POI objects
 */
async function loadPoisFromSupabase() {
  console.log('🔄 Loading POIs from Supabase...');
  
  try {
    // Get Supabase client - try multiple methods
    const supabaseClient = window.supabaseClient || window.sb || (window.getSupabase && window.getSupabase());
    
    if (!supabaseClient) {
      console.warn('⚠️ Supabase client not available, using fallback');
      return [];
    }

    console.log('✅ Supabase client found, fetching POIs...');

    // Fetch ONLY published POIs from database (for public view)
    const { data: pois, error} = await supabaseClient
      .from('pois')
      .select('*')
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error loading POIs from Supabase:', error);
      return [];
    }

    if (!pois || pois.length === 0) {
      console.log('ℹ️ No POIs found in database');
      return [];
    }

    console.log(`✅ Loaded ${pois.length} POIs from Supabase`);
    
    // Transform database POIs to app format
    const transformedPois = pois.map(poi => transformPoiFromDatabase(poi));
    
    return transformedPois;
  } catch (error) {
    console.error('❌ Failed to load POIs:', error);
    return [];
  }
}

/**
 * Transform POI from database format to app format
 * @param {Object} dbPoi - POI object from database
 * @returns {Object} Transformed POI object
 */
function transformPoiFromDatabase(dbPoi) {
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
    xp: parseInt(dbPoi.xp) || 100,
    requiredLevel: parseInt(dbPoi.required_level) || 1,
    source: 'supabase',
    raw: dbPoi
  };
}

/**
 * Wait for Supabase to be available
 * @returns {Promise<Object|null>} Supabase client or null
 */
async function waitForSupabase() {
  let attempts = 0;
  const maxAttempts = 50; // 5 seconds max
  
  while (attempts < maxAttempts) {
    const client = window.supabaseClient || window.sb || (window.getSupabase && window.getSupabase());
    if (client) {
      console.log('✅ Supabase client ready');
      return client;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  
  console.warn('⚠️ Supabase client not available after waiting');
  return null;
}

/**
 * Initialize POI data - try Supabase first, fallback to static
 * @returns {Promise<Array>} Array of POI objects
 */
async function initializePlacesData() {
  console.log('🚀 Initializing places data...');
  
  try {
    // Wait for Supabase to be ready
    await waitForSupabase();
    
    // Try loading from Supabase
    const supabasePois = await loadPoisFromSupabase();
    
    if (supabasePois && supabasePois.length > 0) {
      PLACES_DATA = supabasePois;
      poisLoadedFromSupabase = true;
      console.log(`✅ Using ${PLACES_DATA.length} POIs from Supabase`);
      return PLACES_DATA;
    }
    
    // Fallback to static data if available
    if (typeof STATIC_PLACES_DATA !== 'undefined' && STATIC_PLACES_DATA.length > 0) {
      PLACES_DATA = STATIC_PLACES_DATA;
      poisLoadedFromSupabase = false;
      console.log(`ℹ️ Using ${PLACES_DATA.length} POIs from static data (fallback)`);
      return PLACES_DATA;
    }
    
    console.warn('⚠️ No POI data available');
    return [];
  } catch (error) {
    console.error('❌ Error initializing places data:', error);
    
    // Try fallback
    if (typeof STATIC_PLACES_DATA !== 'undefined') {
      PLACES_DATA = STATIC_PLACES_DATA;
      return PLACES_DATA;
    }
    
    return [];
  }
}

/**
 * Refresh POIs from Supabase (call after admin changes)
 */
async function refreshPoisData() {
  console.log('🔄 Refreshing POIs data...');
  const newData = await loadPoisFromSupabase();
  
  if (newData && newData.length > 0) {
    PLACES_DATA = newData;
    poisLoadedFromSupabase = true;
    
    // Trigger refresh events
    if (typeof window.onPoisDataRefreshed === 'function') {
      window.onPoisDataRefreshed(PLACES_DATA);
    }
    
    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('poisDataRefreshed', { 
      detail: { pois: PLACES_DATA, source: 'supabase' } 
    }));
    
    console.log(`✅ Refreshed ${PLACES_DATA.length} POIs`);
  }
  
  return PLACES_DATA;
}

// Export functions globally
window.loadPoisFromSupabase = loadPoisFromSupabase;
window.initializePlacesData = initializePlacesData;
window.refreshPoisData = refreshPoisData;
window.transformPoiFromDatabase = transformPoiFromDatabase;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePlacesData);
} else {
  // DOM already loaded
  initializePlacesData();
}

console.log('✅ POI Loader initialized');
