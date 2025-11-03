/**
 * CyprusEye Core Application
 * Simple vanilla JavaScript - no ES6 modules
 * All data loaded from separate JS files
 */

(function() {
  'use strict';

  console.log('🚀 CyprusEye Core starting...');

  // Wait for all data to load
  function waitForData() {
    if (typeof PLACES_DATA === 'undefined' || 
        typeof TASKS_DATA === 'undefined' || 
        typeof PACKING_GUIDE === 'undefined') {
      console.log('⏳ Waiting for data to load...');
      setTimeout(waitForData, 100);
      return;
    }
    
    console.log('✅ All data loaded:');
    console.log('   - Places:', PLACES_DATA.length);
    console.log('   - Tasks:', TASKS_DATA.length);
    console.log('   - Packing seasons:', PACKING_GUIDE.seasons.length);
    
    initialize();
  }

  // Current place state
  let currentPlaceIndex = 0;

  function initialize() {
    console.log('🎯 Initializing application...');

    // Initialize each module
    initializeMap();
    initializeCurrentPlace(); // New: current place section
    initializeMapLocationsList(); // List below map
    initializeAttractions();
    initializePackingPlanner();
    initializeTasks();
    initializeUserStats(); // NEW: Load user stats

    console.log('✅ Application initialized!');
  }

  // Initialize and display user stats
  async function initializeUserStats() {
    const sb = window.getSupabase ? window.getSupabase() : null;
    if (!sb) return;

    try {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) {
        console.log('ℹ️ No user logged in');
        return;
      }

      // Fetch and display user stats
      await updateUserStatsDisplay(user.id);

      // Listen for auth state changes
      sb.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          updateUserStatsDisplay(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          clearUserStatsDisplay();
        }
      });

    } catch (error) {
      console.error('Error initializing user stats:', error);
    }
  }

  // Fetch and display user stats from Supabase
  async function updateUserStatsDisplay(userId) {
    const sb = window.getSupabase();
    if (!sb || !userId) return;

    try {
      const { data: profile, error } = await sb
        .from('profiles')
        .select('xp, level, visited_places')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      const xp = profile?.xp || 0;
      const level = profile?.level || 1;
      const visitedPlaces = profile?.visited_places || [];
      const visitedCount = visitedPlaces.length;

      console.log('✅ User stats fetched:', { xp, level, visitedCount, visitedPlaces });

      // Update header metrics (poziom, doświadczenie, odznaki)
      updateHeaderMetrics(xp, level, visitedCount);

      // Store in window for global access
      window.currentUserStats = { xp, level, visitedPlaces, visitedCount };

      // Refresh current place display to show updated visited status
      if (typeof renderCurrentPlace === 'function') {
        renderCurrentPlace();
      }

    } catch (error) {
      console.error('Error updating user stats:', error);
    }
  }

  // Clear user stats
  function clearUserStatsDisplay() {
    window.currentUserStats = null;
  }

  // Update header metrics display
  function updateHeaderMetrics(xp, level, visitedCount) {
    // Update level
    const levelEl = document.getElementById('headerLevelNumber');
    if (levelEl) {
      levelEl.textContent = level;
    }

    // Update XP points
    const xpEl = document.getElementById('headerXpPoints');
    if (xpEl) {
      xpEl.textContent = xp;
    }

    // Calculate XP progress
    const currentLevelXP = (level - 1) * 1000;
    const nextLevelXP = level * 1000;
    const xpInCurrentLevel = xp - currentLevelXP;
    const xpNeededForLevel = nextLevelXP - currentLevelXP;
    const xpToNextLevel = nextLevelXP - xp;
    const percentage = Math.min(100, Math.max(0, (xpInCurrentLevel / xpNeededForLevel) * 100));

    // Update progress bar
    const progressBar = document.getElementById('headerXpFill');
    if (progressBar) {
      progressBar.style.width = `${percentage}%`;
      progressBar.classList.remove('is-width-zero');
      if (percentage > 0) {
        progressBar.style.opacity = '1';
      }
    }

    // Update progress text
    const progressText = document.getElementById('headerXpProgressText');
    if (progressText) {
      progressText.textContent = `${xpInCurrentLevel} / ${xpNeededForLevel} XP do kolejnego poziomu`;
    }

    // Update badges count
    const badgesEl = document.getElementById('headerBadgesCount');
    if (badgesEl) {
      badgesEl.textContent = visitedCount;
    }

    // Update level status text
    const levelStatus = document.getElementById('headerLevelStatus');
    if (levelStatus && visitedCount > 0) {
      levelStatus.textContent = `${visitedCount} ${visitedCount === 1 ? 'miejsce odwiedzone' : 'miejsca odwiedzone'}!`;
    }

    console.log('✅ Header metrics updated:', { xp, level, visitedCount, percentage: percentage.toFixed(1) + '%' });
  }

  // Export for use by other functions and modules
  window.updateUserStatsDisplay = updateUserStatsDisplay;
  window.updateHeaderMetrics = updateHeaderMetrics;

  // Store map instance globally
  let mapInstance = null;
  let markersLayer = null;

  function initializeMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement) {
      console.log('ℹ️ Map element not found on this page');
      return;
    }

    console.log('🗺️ Initializing map...');
    
    // Check if Leaflet is loaded
    if (typeof L === 'undefined') {
      console.error('❌ Leaflet not loaded!');
      return;
    }

    try {
      // Create map only if it doesn't exist
      if (!mapInstance) {
        mapInstance = L.map('map').setView([35.095, 33.203], 9);
        
        // Store map reference for later use
        mapElement._leaflet_map = mapInstance;
        
        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(mapInstance);

        // Create layer group for markers
        markersLayer = L.layerGroup().addTo(mapInstance);

        console.log('✅ Map instance created');
      }

      // Update markers
      updateMapMarkers();

      // Listen for POI data refresh
      window.addEventListener('poisDataRefreshed', () => {
        console.log('🔄 POI data refreshed, updating map markers...');
        updateMapMarkers();
      });

      console.log('✅ Map initialized with', PLACES_DATA.length, 'markers');
    } catch (error) {
      console.error('❌ Error initializing map:', error);
    }
  }

  function updateMapMarkers() {
    if (!markersLayer || !mapInstance) {
      console.warn('⚠️ Map not ready for marker update');
      return;
    }

    // Clear existing markers
    markersLayer.clearLayers();

    // Create custom icon for better visibility
    const customIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    // Add markers for each place
    if (PLACES_DATA && PLACES_DATA.length > 0) {
      PLACES_DATA.forEach(function(place) {
        // Validate coordinates
        if (!place.lat || !place.lng) {
          console.warn('⚠️ Skipping place without coordinates:', place.id);
          return;
        }

        const marker = L.marker([place.lat, place.lng], { icon: customIcon });
        
        // Get translated name or fallback
        const placeName = getPlaceName(place);
        const placeDescription = getPlaceDescription(place);
        
        // Create more readable popup - no Level, just name and rating
        marker.bindPopup(`
          <div class="map-popup" style="min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #2563eb;">${placeName}</h3>
            <p style="margin: 0 0 8px 0; font-size: 14px;">⭐ Ocena: <span id="rating-${place.id}">Brak ocen</span></p>
            <a href="${place.googleMapsUrl}" target="_blank" rel="noopener" style="display: inline-block; padding: 6px 10px; background: #2563eb; color: white; text-decoration: none; border-radius: 4px; font-size: 13px;">Google Maps →</a>
          </div>
        `, { maxWidth: 250 });

        // Add to markers layer
        marker.addTo(markersLayer);
      });

      console.log(`✅ Updated map with ${PLACES_DATA.length} markers`);
    } else {
      console.warn('⚠️ No PLACES_DATA available for markers');
    }
  }

  // Export for external use
  window.updateMapMarkers = updateMapMarkers;

  function initializeCurrentPlace() {
    const section = document.getElementById('currentPlaceSection');
    if (!section) {
      console.log('ℹ️ Current place section not found on this page');
      return;
    }

    console.log('🎯 Initializing current place section...');
    
    // Start with first place
    currentPlaceIndex = 0;
    renderCurrentPlace();
    
    console.log('✅ Current place section initialized');
  }

  function renderCurrentPlace() {
    if (currentPlaceIndex < 0) currentPlaceIndex = PLACES_DATA.length - 1;
    if (currentPlaceIndex >= PLACES_DATA.length) currentPlaceIndex = 0;
    
    const place = PLACES_DATA[currentPlaceIndex];
    if (!place) {
      console.error('❌ No place found at index:', currentPlaceIndex);
      return;
    }
    
    console.log('📍 Rendering place:', place.id);
    console.log('   - nameFallback:', place.nameFallback);
    console.log('   - descriptionFallback:', place.descriptionFallback);
    
    // Store current place ID globally for button callbacks
    window.currentPlaceId = place.id;
    
    // Update content
    const nameEl = document.getElementById('currentPlaceName');
    const descEl = document.getElementById('currentPlaceDescription');
    const ratingEl = document.getElementById('currentPlaceRating');
    const commentsEl = document.getElementById('currentPlaceComments');
    const xpEl = document.getElementById('currentPlaceXP');
    
    // Get texts directly from fallback
    const placeName = getPlaceName(place);
    const placeDescription = getPlaceDescription(place);
    
    console.log('   - Final name:', placeName);
    console.log('   - Final description:', placeDescription);
    
    if (nameEl) {
      nameEl.textContent = placeName;
      console.log('   ✅ Name set to:', nameEl.textContent);
    }
    if (descEl) {
      descEl.textContent = placeDescription;
      descEl.style.display = placeDescription ? 'block' : 'none';
      console.log('   ✅ Description set, length:', placeDescription.length);
    }
    
    // Check if user has visited this place
    const hasVisited = window.currentUserStats?.visitedPlaces?.includes(place.id);
    if (xpEl) {
      if (hasVisited) {
        xpEl.innerHTML = `<span style="color: #10b981;">✓ ${place.xp} XP (odwiedzone)</span>`;
      } else {
        xpEl.textContent = place.xp + ' XP';
      }
    }
    
    // Fetch real data from Supabase
    fetchPlaceStats(place.id, ratingEl, commentsEl);
    
    // Update map to show this place (without scrolling)
    updateMapForPlace(place);
  }

  async function fetchPlaceStats(poiId, ratingEl, commentsEl) {
    try {
      const sb = window.getSupabase ? window.getSupabase() : null;
      if (!sb) {
        console.warn('Supabase not available');
        return;
      }

      // Fetch rating stats
      const { data: ratingData, error: ratingError } = await sb
        .from('poi_rating_stats')
        .select('average_rating, total_ratings')
        .eq('poi_id', poiId)
        .single();

      if (!ratingError && ratingData && ratingData.total_ratings > 0) {
        const avgRating = ratingData.average_rating.toFixed(1);
        const stars = '⭐'.repeat(Math.round(ratingData.average_rating));
        if (ratingEl) {
          ratingEl.textContent = `${stars} ${avgRating} (${ratingData.total_ratings})`;
        }
      } else {
        if (ratingEl) ratingEl.textContent = 'Brak ocen';
      }

      // Fetch comment count
      const { count: commentCount, error: commentError } = await sb
        .from('poi_comments')
        .select('*', { count: 'exact', head: true })
        .eq('poi_id', poiId);

      if (!commentError && commentCount !== null) {
        if (commentsEl) {
          if (commentCount === 0) {
            commentsEl.textContent = '0 komentarzy';
          } else if (commentCount === 1) {
            commentsEl.textContent = '1 komentarz';
          } else if (commentCount < 5) {
            commentsEl.textContent = `${commentCount} komentarze`;
          } else {
            commentsEl.textContent = `${commentCount} komentarzy`;
          }
        }
      } else {
        if (commentsEl) commentsEl.textContent = '0 komentarzy';
      }

    } catch (error) {
      console.error('Error fetching place stats:', error);
    }
  }

  function updateMapForPlace(place) {
    const mapElement = document.getElementById('map');
    if (!mapElement || !mapElement._leaflet_map) return;
    
    const map = mapElement._leaflet_map;
    
    // Center map on the place with animation (no scroll)
    map.setView([place.lat, place.lng], 16, {
      animate: true,
      duration: 1
    });
    
    // Wait for animation, then open popup
    setTimeout(function() {
      map.eachLayer(function(layer) {
        if (layer instanceof L.Marker) {
          const latLng = layer.getLatLng();
          if (Math.abs(latLng.lat - place.lat) < 0.0001 && 
              Math.abs(latLng.lng - place.lng) < 0.0001) {
            layer.openPopup();
          }
        }
      });
    }, 1000);
  }

  function initializeMapLocationsList() {
    const locationsList = document.getElementById('locationsList');
    const toggleButton = document.getElementById('locationsToggle');
    
    if (!locationsList) {
      console.log('ℹ️ Locations list not found on this page');
      return;
    }

    console.log('🗺️ Initializing map locations list...');

    // Show first 3 places
    const previewCount = 3;
    const previewPlaces = PLACES_DATA.slice(0, previewCount);
    
    locationsList.innerHTML = '';
    previewPlaces.forEach(function(place) {
      const li = createLocationListItem(place);
      locationsList.appendChild(li);
    });

    // Handle "Show more" button
    if (toggleButton) {
      let showingAll = false;
      
      toggleButton.onclick = function() {
        if (!showingAll) {
          // Show all places
          locationsList.innerHTML = '';
          PLACES_DATA.forEach(function(place) {
            const li = createLocationListItem(place);
            locationsList.appendChild(li);
          });
          toggleButton.textContent = 'Pokaż mniej atrakcji';
          showingAll = true;
        } else {
          // Show only first 3
          locationsList.innerHTML = '';
          previewPlaces.forEach(function(place) {
            const li = createLocationListItem(place);
            locationsList.appendChild(li);
          });
          toggleButton.textContent = 'Pokaż więcej atrakcji';
          showingAll = false;
        }
      };
    }

    console.log('✅ Map locations list initialized with', previewCount, 'preview places');
  }

  function createLocationListItem(place) {
    const li = document.createElement('li');
    li.className = 'location-card';
    
    const placeName = getPlaceName(place);
    
    li.innerHTML = `
      <div class="location-info">
        <h3 class="location-name">${placeName}</h3>
        <p class="location-xp">✨ ${place.xp} XP</p>
      </div>
      <button class="location-action secondary" onclick="focusPlaceOnMap('${place.id}')">
        📍 Pokaż na mapie
      </button>
    `;
    
    return li;
  }

  function initializeAttractions() {
    const catalogElement = document.getElementById('attractionsCatalog');
    if (!catalogElement) {
      console.log('ℹ️ Attractions catalog not found on this page');
      return;
    }

    console.log('🎯 Initializing attractions catalog...');
    
    // Clear existing content
    catalogElement.innerHTML = '';

    // Render each place as a card
    PLACES_DATA.forEach(function(place) {
      const card = createAttractionCard(place);
      catalogElement.appendChild(card);
    });

    // Update results count
    const resultsElement = document.getElementById('attractionsResultsCount');
    if (resultsElement) {
      resultsElement.textContent = `${PLACES_DATA.length} atrakcji`;
    }

    console.log('✅ Attractions catalog initialized with', PLACES_DATA.length, 'places');
  }

  function createAttractionCard(place) {
    const li = document.createElement('li');
    li.className = 'card attractions-card';
    
    const placeName = getPlaceName(place);
    const placeDescription = getPlaceDescription(place);
    const placeBadge = getPlaceBadge(place);

    li.innerHTML = `
      <h3>${placeName}</h3>
      <p>${placeDescription}</p>
      <div class="attractions-meta">
        <span>🏅 ${placeBadge}</span>
        <span>✨ ${place.xp} XP</span>
      </div>
      <div class="attractions-actions">
        <button class="secondary" onclick="showOnMap('${place.id}')">🗺️ Zobacz na mapie</button>
        <button class="secondary" onclick="showCommunity('${place.id}')">💬 Komentarze</button>
        <a href="${place.googleMapsUrl}" target="_blank" rel="noopener" class="ghost-link">Google Maps</a>
      </div>
    `;

    return li;
  }

  function initializePackingPlanner() {
    const packingElement = document.getElementById('packingChecklist');
    if (!packingElement) {
      console.log('ℹ️ Packing planner not found on this page');
      return;
    }

    console.log('🎒 Initializing packing planner...');

    // Initialize season toggle
    const toggleElement = document.getElementById('packingSeasonToggle');
    if (toggleElement) {
      toggleElement.innerHTML = '';
      
      PACKING_GUIDE.seasons.forEach(function(season) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'packing-season-button';
        button.textContent = `${season.emoji} ${season.label}`;
        button.onclick = function() {
          renderPackingForSeason(season);
        };
        toggleElement.appendChild(button);
      });
    }

    // Render first season by default
    if (PACKING_GUIDE.seasons.length > 0) {
      renderPackingForSeason(PACKING_GUIDE.seasons[0]);
    }

    console.log('✅ Packing planner initialized');
  }

  function renderPackingForSeason(season) {
    const packingElement = document.getElementById('packingChecklist');
    if (!packingElement) return;

    packingElement.innerHTML = `
      <div class="packing-season-header">
        <h3>${season.emoji} ${season.label}</h3>
        <p>${season.summary}</p>
      </div>
      <div class="packing-lists">
        <section class="packing-list-section">
          <h4>Uniwersalne niezbędniki</h4>
          <ul class="packing-checklist">
            ${PACKING_GUIDE.universal.map((item, index) => `
              <li>
                <input type="checkbox" id="universal-${index}">
                <label for="universal-${index}" class="packing-check-label">
                  <div class="packing-check-main">
                    <span>${item.label}</span>
                  </div>
                  ${item.hint ? `<small class="packing-hint">${item.hint}</small>` : ''}
                </label>
              </li>
            `).join('')}
          </ul>
        </section>
        <section class="packing-list-section">
          <h4>Dodatki sezonowe</h4>
          <ul class="packing-checklist">
            ${season.items.map((item, index) => `
              <li>
                <input type="checkbox" id="season-${index}">
                <label for="season-${index}" class="packing-check-label">
                  <div class="packing-check-main">
                    <span>${item.label}</span>
                    ${item.optional ? '<span class="packing-optional">opcjonalnie</span>' : ''}
                  </div>
                  ${item.hint ? `<small class="packing-hint">${item.hint}</small>` : ''}
                </label>
              </li>
            `).join('')}
          </ul>
        </section>
      </div>
    `;

    // Update active button
    const buttons = document.querySelectorAll('.packing-season-button');
    buttons.forEach(function(btn) {
      btn.classList.remove('is-active');
    });
    event.target.classList.add('is-active');
  }

  /**
   * Initialize Tasks - Uses external tasks-manager.js module
   * Falls back to simple list if module not available
   */
  async function initializeTasks() {
    const tasksElement = document.getElementById('tasksList');
    if (!tasksElement) {
      console.log('ℹ️ Tasks list not found on this page');
      return;
    }

    console.log('🎯 Initializing tasks system...');

    // Try to use the dedicated tasks-manager module
    try {
      const tasksModule = await import('./js/tasks-manager.js?v=2.3');
      if (tasksModule && tasksModule.initTasks) {
        // Przekaż TASKS_DATA do modułu, żeby uniknąć problemów z globalnym scope
        await tasksModule.initTasks(TASKS_DATA);
        console.log('✅ Tasks initialized via tasks-manager module');
        return;
      }
    } catch (error) {
      console.warn('Tasks manager module not available, using fallback:', error);
    }

    // Fallback: Simple task list without interactivity
    console.log('⚠️ Using fallback tasks display (no completion tracking)');
    tasksElement.innerHTML = '';
    
    TASKS_DATA.forEach(function(task) {
      const li = document.createElement('li');
      li.className = 'task-card card';
      
      const title = getTaskTitle(task);
      const description = getTaskDescription(task);
      
      li.innerHTML = `
        <h3 class="task-title">${title}</h3>
        <p class="task-description">${description}</p>
        <div class="task-meta">
          <span class="task-xp">✨ ${task.xp} XP</span>
          <button type="button" class="btn btn-secondary task-action-btn" disabled>
            Wymaga logowania
          </button>
        </div>
      `;
      
      tasksElement.appendChild(li);
    });
    
    console.log(`✅ Tasks list displayed (${TASKS_DATA.length} tasks, read-only mode)`);
  }

  // Translation helpers - always prefer fallback values
  function getPlaceName(place) {
    // Always use fallback - it contains proper names
    return place.nameFallback || place.id;
  }

  function getPlaceDescription(place) {
    // Always use fallback - it contains proper descriptions
    return place.descriptionFallback || '';
  }

  function getPlaceBadge(place) {
    // Always use fallback - it contains proper badge names
    return place.badgeFallback || '';
  }

  function getTaskTitle(task) {
    const key = `tasks.items.${task.id}.title`;
    if (window.appI18n && window.appI18n.translations) {
      const lang = window.appI18n.language || 'pl';
      const translations = window.appI18n.translations[lang] || {};
      return translations[key] || task.id;
    }
    return task.id;
  }

  function getTaskDescription(task) {
    const key = `tasks.items.${task.id}.description`;
    if (window.appI18n && window.appI18n.translations) {
      const lang = window.appI18n.language || 'pl';
      const translations = window.appI18n.translations[lang] || {};
      return translations[key] || '';
    }
    return '';
  }

  // Navigation functions (exposed globally)
  window.showOnMap = function(placeId) {
    // Redirect to main page with place parameter
    window.location.href = `index.html?place=${placeId}`;
  };

  window.showCommunity = function(placeId) {
    // Redirect to community page with place parameter
    window.location.href = `community.html?place=${placeId}`;
  };

  window.navigatePlace = function(direction) {
    currentPlaceIndex += direction;
    renderCurrentPlace();
  };

  // Check-in function
  window.checkInAtPlace = async function(placeId) {
    console.log('🎯 Check-in attempt for:', placeId);
    
    const place = PLACES_DATA.find(p => p.id === placeId);
    if (!place) {
      alert('Błąd: Miejsce nie znalezione');
      return;
    }

    // Check if user is authenticated
    const sb = window.getSupabase ? window.getSupabase() : null;
    if (!sb) {
      alert('Błąd: Brak połączenia z bazą danych');
      return;
    }

    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
      alert('Musisz być zalogowany, aby się zameldować!\n\nZaloguj się przez menu w prawym górnym rogu.');
      return;
    }

    // Request user location
    if (!navigator.geolocation) {
      // No geolocation support - ask for manual confirmation
      showManualCheckInDialog(place, user.id);
      return;
    }

    // Show loading message
    const loadingMsg = document.createElement('div');
    loadingMsg.id = 'checkInLoading';
    loadingMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 10000; text-align: center;';
    loadingMsg.innerHTML = '<p style="margin: 0; font-size: 1.1rem;">📍 Sprawdzam Twoją lokalizację...</p>';
    document.body.appendChild(loadingMsg);

    navigator.geolocation.getCurrentPosition(
      async function(position) {
        document.getElementById('checkInLoading')?.remove();
        
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        const distance = calculateDistance(userLat, userLng, place.lat, place.lng);
        
        console.log('📍 User location:', userLat, userLng);
        console.log('📍 Place location:', place.lat, place.lng);
        console.log('📏 Distance:', distance.toFixed(2), 'km');
        
        if (distance <= 1.0) {
          // Within 1km - auto check-in
          await performCheckIn(place, user.id, true, distance);
        } else {
          // Too far - show distance and manual option
          showDistanceDialog(place, user.id, distance);
        }
      },
      function(error) {
        document.getElementById('checkInLoading')?.remove();
        console.error('Geolocation error:', error);
        
        let errorMsg = 'Nie udało się pobrać lokalizacji.\n\n';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg += 'Odrzuciłeś dostęp do lokalizacji. Włącz lokalizację w ustawieniach przeglądarki.\n\n';
        }
        errorMsg += 'Czy chcesz zaznaczyć ręcznie, że jesteś na miejscu?';
        
        if (confirm(errorMsg)) {
          showManualCheckInDialog(place, user.id);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  // Calculate distance between two coordinates (Haversine formula)
  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function toRad(deg) {
    return deg * (Math.PI / 180);
  }

  // Show distance dialog
  function showDistanceDialog(place, userId, distance) {
    const placeName = getPlaceName(place);
    const distanceKm = distance.toFixed(2);
    const distanceM = (distance * 1000).toFixed(0);
    
    const dialog = document.createElement('div');
    dialog.id = 'distanceDialog';
    dialog.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 1rem;';
    
    dialog.innerHTML = `
      <div style="background: white; padding: 2rem; border-radius: 12px; max-width: 400px; width: 100%;">
        <h3 style="margin: 0 0 1rem 0; color: #2563eb;">📍 Sprawdzam lokalizację</h3>
        <p style="margin: 0 0 1rem 0; font-size: 1.1rem;"><strong>${placeName}</strong></p>
        <p style="margin: 0 0 1.5rem 0; color: #666;">
          Jesteś ${distance < 1 ? distanceM + ' metrów' : distanceKm + ' km'} od tego miejsca.
        </p>
        <p style="margin: 0 0 1.5rem 0; padding: 1rem; background: #fef3c7; border-radius: 8px; font-size: 0.9rem;">
          ⚠️ Aby automatycznie się zameldować, musisz być w promieniu <strong>1 km</strong> od miejsca.
        </p>
        <p style="margin: 0 0 1.5rem 0; font-size: 0.9rem; color: #666;">
          Jeśli masz problemy z lokalizacją, ale jesteś na miejscu, możesz potwierdzić ręcznie.
        </p>
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <button onclick="performManualCheckIn('${place.id}', '${userId}')" class="btn primary" style="flex: 1; padding: 0.75rem;">
            ✅ Jestem na miejscu
          </button>
          <button onclick="closeDistanceDialog()" class="btn secondary" style="flex: 1; padding: 0.75rem;">
            ❌ Anuluj
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
  }

  // Show manual check-in dialog
  function showManualCheckInDialog(place, userId) {
    const placeName = getPlaceName(place);
    
    const dialog = document.createElement('div');
    dialog.id = 'manualCheckInDialog';
    dialog.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 1rem;';
    
    dialog.innerHTML = `
      <div style="background: white; padding: 2rem; border-radius: 12px; max-width: 400px; width: 100%;">
        <h3 style="margin: 0 0 1rem 0; color: #2563eb;">📍 Potwierdzenie lokalizacji</h3>
        <p style="margin: 0 0 1rem 0; font-size: 1.1rem;"><strong>${placeName}</strong></p>
        <p style="margin: 0 0 1.5rem 0; color: #666;">
          Nie możemy automatycznie sprawdzić Twojej lokalizacji.
        </p>
        <p style="margin: 0 0 1.5rem 0; padding: 1rem; background: #fef3c7; border-radius: 8px; font-size: 0.9rem;">
          ⚠️ Potwierdź, że jesteś rzeczywiście na miejscu. Fałszywe zameldowania mogą skutkować zablokowaniem konta.
        </p>
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <button onclick="performManualCheckIn('${place.id}', '${userId}')" class="btn primary" style="flex: 1; padding: 0.75rem;">
            ✅ Jestem na miejscu
          </button>
          <button onclick="closeManualCheckInDialog()" class="btn secondary" style="flex: 1; padding: 0.75rem;">
            ❌ Anuluj
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
  }

  window.performManualCheckIn = async function(placeId, userId) {
    const place = PLACES_DATA.find(p => p.id === placeId);
    closeDistanceDialog();
    closeManualCheckInDialog();
    await performCheckIn(place, userId, false, null);
  };

  window.closeDistanceDialog = function() {
    document.getElementById('distanceDialog')?.remove();
  };

  window.closeManualCheckInDialog = function() {
    document.getElementById('manualCheckInDialog')?.remove();
  };

  // Perform actual check-in
  async function performCheckIn(place, userId, isAutomatic, distance) {
    console.log('✅ Performing check-in:', place.id, 'for user:', userId);
    
    const sb = window.getSupabase();
    if (!sb) {
      alert('Błąd: Brak połączenia z bazą danych');
      return;
    }

    try {
      // Get current user profile
      console.log('🔍 Fetching profile for user:', userId);
      
      const { data: profile, error: profileError } = await sb
        .from('profiles')
        .select('id, xp, level, visited_places')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('❌ Profile fetch error:', profileError);
        console.error('❌ Error code:', profileError.code);
        console.error('❌ Error message:', profileError.message);
        console.error('❌ Error details:', profileError.details);
        
        // If column doesn't exist in SELECT
        if (profileError.code === '42703' || (profileError.message && profileError.message.includes('column'))) {
          throw new Error('COLUMN_ERROR');
        }
        
        throw new Error('Nie można pobrać profilu użytkownika');
      }

      console.log('✅ Profile fetched successfully');
      console.log('📊 Current profile:', profile);

      // Get current values with fallbacks
      const currentXP = profile?.xp ?? 0;
      const currentLevel = profile?.level ?? 1;
      const visitedPlaces = profile?.visited_places ?? [];

      console.log('📊 Current XP:', currentXP, 'Level:', currentLevel, 'Visited:', visitedPlaces);

      // Check if already visited this place
      if (Array.isArray(visitedPlaces) && visitedPlaces.includes(place.id)) {
        alert('✅ Już odwiedziłeś to miejsce!\n\nSzukaj innych atrakcji, aby zdobyć więcej XP.');
        return;
      }

      const newXP = currentXP + place.xp;

      // Calculate new level (simple formula: level = floor(xp / 1000) + 1)
      const newLevel = Math.floor(newXP / 1000) + 1;
      const leveledUp = newLevel > currentLevel;

      // Add place to visited list
      const newVisitedPlaces = Array.isArray(visitedPlaces) 
        ? [...visitedPlaces, place.id] 
        : [place.id];

      console.log('📊 New values:', { newXP, newLevel, newVisitedPlaces });

      // Prepare update - DON'T update 'level' as it's a generated column
      const updateData = {
        xp: newXP,
        visited_places: newVisitedPlaces
      };

      console.log('📊 Updating with:', updateData);
      console.log('ℹ️ Level will be auto-calculated from XP (generated column)');

      // Update user profile
      const { error: updateError } = await sb
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      if (updateError) {
        console.error('Update error:', updateError);
        console.error('Update error details:', JSON.stringify(updateError, null, 2));
        
        // Check if it's a column error
        if (updateError.message && (updateError.message.includes('column') || updateError.message.includes('xp') || updateError.message.includes('level') || updateError.message.includes('visited_places'))) {
          throw new Error('COLUMN_ERROR');
        }
        
        throw updateError;
      }

      console.log('✅ Profile updated successfully!');

      // Refresh user stats display immediately
      if (typeof window.updateUserStatsDisplay === 'function') {
        await window.updateUserStatsDisplay(userId);
      }

      // Show success message
      showSuccessDialog(place, place.xp, newXP, newLevel, leveledUp);

    } catch (error) {
      console.error('❌ Check-in error:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      
      // Detailed error messages
      if (error.message === 'COLUMN_ERROR') {
        alert('⚠️ Brak kolumn XP w bazie danych.\n\nUruchom w Supabase SQL Editor:\n\nALTER TABLE profiles\n  ADD COLUMN xp INTEGER DEFAULT 0,\n  ADD COLUMN level INTEGER DEFAULT 1,\n  ADD COLUMN visited_places TEXT[] DEFAULT \'{}\';');
      } else if (error.message && error.message.includes('profil')) {
        alert(error.message);
      } else if (error.code === '42703') {
        // PostgreSQL error code for undefined column
        alert('⚠️ Brak kolumn w tabeli profiles.\n\nKolumny xp, level lub visited_places nie istnieją.\n\nUruchom QUICK_SQL_SETUP.sql w Supabase!');
      } else {
        alert('Błąd podczas zameldowania:\n\n' + (error.message || 'Nieznany błąd') + '\n\nSprawdź konsolę (F12) aby zobaczyć szczegóły.');
      }
    }
  }

  // Show success dialog
  function showSuccessDialog(place, earnedXP, totalXP, level, leveledUp) {
    const placeName = getPlaceName(place);
    
    const dialog = document.createElement('div');
    dialog.id = 'successDialog';
    dialog.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 1rem;';
    
    const levelUpHTML = leveledUp ? `
      <div style="margin: 1rem 0; padding: 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; color: white; text-align: center;">
        <p style="margin: 0; font-size: 1.5rem; font-weight: bold;">🎉 LEVEL UP!</p>
        <p style="margin: 0.5rem 0 0 0; font-size: 1.2rem;">Jesteś teraz na poziomie ${level}!</p>
      </div>
    ` : '';
    
    dialog.innerHTML = `
      <div style="background: white; padding: 2rem; border-radius: 12px; max-width: 400px; width: 100%; text-align: center;">
        <div style="font-size: 4rem; margin-bottom: 1rem;">✅</div>
        <h3 style="margin: 0 0 1rem 0; color: #2563eb;">Zameldowanie udane!</h3>
        <p style="margin: 0 0 0.5rem 0; font-size: 1.1rem;"><strong>${placeName}</strong></p>
        
        ${levelUpHTML}
        
        <div style="margin: 1.5rem 0; padding: 1rem; background: #f0f9ff; border-radius: 8px;">
          <p style="margin: 0 0 0.5rem 0; font-size: 1.3rem; color: #2563eb; font-weight: bold;">
            +${earnedXP} XP
          </p>
          <p style="margin: 0; font-size: 0.9rem; color: #666;">
            Razem: ${totalXP} XP | Poziom: ${level}
          </p>
        </div>
        
        <button onclick="closeSuccessDialog()" class="btn primary" style="width: 100%; padding: 0.75rem; margin-top: 1rem;">
          🎉 Super!
        </button>
      </div>
    `;
    
    document.body.appendChild(dialog);
  }

  window.closeSuccessDialog = function() {
    document.getElementById('successDialog')?.remove();
  };

  window.focusPlaceOnMap = function(placeId) {
    const place = PLACES_DATA.find(p => p.id === placeId);
    if (!place) {
      console.error('Place not found:', placeId);
      return;
    }

    const mapElement = document.getElementById('map');
    if (!mapElement || !mapElement._leaflet_map) {
      console.error('Map not initialized');
      return;
    }

    const map = mapElement._leaflet_map;

    // Scroll to map smoothly
    mapElement.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center' 
    });

    // Wait for scroll, then focus on place
    setTimeout(function() {
      // Center map on the place with animation
      map.setView([place.lat, place.lng], 16, {
        animate: true,
        duration: 1
      });

      // Wait for animation, then open popup
      setTimeout(function() {
        map.eachLayer(function(layer) {
          if (layer instanceof L.Marker) {
            const latLng = layer.getLatLng();
            if (Math.abs(latLng.lat - place.lat) < 0.0001 && 
                Math.abs(latLng.lng - place.lng) < 0.0001) {
              layer.openPopup();
            }
          }
        });
      }, 1000);
    }, 300);
  };

  // Check if we should focus on a specific place (from URL parameter)
  function checkAndFocusPlace() {
    const urlParams = new URLSearchParams(window.location.search);
    const placeId = urlParams.get('place');
    
    if (placeId && typeof L !== 'undefined') {
      const place = PLACES_DATA.find(p => p.id === placeId);
      if (place) {
        console.log('🎯 Focusing on place:', placeId);
        
        // Get the map instance
        const mapElement = document.getElementById('map');
        if (mapElement && mapElement._leaflet_map) {
          const map = mapElement._leaflet_map;
          
          // First, scroll the map into view (center of screen)
          setTimeout(function() {
            mapElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            });
            
            // Then focus on the place
            setTimeout(function() {
              // Center map on the place with higher zoom for better visibility
              map.setView([place.lat, place.lng], 16, {
                animate: true,
                duration: 1
              });
              
              // Wait for animation, then open popup
              setTimeout(function() {
                // Find and open the marker popup
                map.eachLayer(function(layer) {
                  if (layer instanceof L.Marker) {
                    const latLng = layer.getLatLng();
                    // More precise matching
                    if (Math.abs(latLng.lat - place.lat) < 0.0001 && 
                        Math.abs(latLng.lng - place.lng) < 0.0001) {
                      layer.openPopup();
                    }
                  }
                });
              }, 1000);
            }, 500);
          }, 300);
        }
      }
    }
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForData);
  } else {
    waitForData();
  }

  // After initialization, check if we need to focus on a place
  setTimeout(checkAndFocusPlace, 1000);

})();
