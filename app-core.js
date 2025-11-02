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

  function initialize() {
    console.log('🎯 Initializing application...');
    
    // Initialize each module
    initializeMap();
    initializeAttractions();
    initializePackingPlanner();
    initializeTasks();
    
    console.log('✅ Application initialized!');
  }

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
      // Create map
      const map = L.map('map').setView([35.095, 33.203], 9);
      
      // Store map reference for later use
      mapElement._leaflet_map = map;
      
      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

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
      PLACES_DATA.forEach(function(place) {
        const marker = L.marker([place.lat, place.lng], { icon: customIcon }).addTo(map);
        
        // Get translated name or fallback
        const placeName = getPlaceName(place);
        const placeDescription = getPlaceDescription(place);
        
        // Create more readable popup
        marker.bindPopup(`
          <div class="map-popup" style="min-width: 250px;">
            <h3 style="margin: 0 0 10px 0; font-size: 18px; color: #2563eb;">${placeName}</h3>
            <p style="margin: 0 0 10px 0; font-size: 14px; line-height: 1.5;">${placeDescription}</p>
            <p style="margin: 0 0 10px 0;"><strong>✨ XP:</strong> ${place.xp}</p>
            <a href="${place.googleMapsUrl}" target="_blank" rel="noopener" style="display: inline-block; padding: 8px 12px; background: #2563eb; color: white; text-decoration: none; border-radius: 4px; font-size: 14px;">Google Maps →</a>
          </div>
        `, { maxWidth: 300 });
      });

      console.log('✅ Map initialized with', PLACES_DATA.length, 'markers');
    } catch (error) {
      console.error('❌ Error initializing map:', error);
    }
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

  function initializeTasks() {
    const tasksElement = document.getElementById('tasksList');
    if (!tasksElement) {
      console.log('ℹ️ Tasks list not found on this page');
      return;
    }

    console.log('✅ Initializing tasks...');

    tasksElement.innerHTML = '';

    TASKS_DATA.forEach(function(task) {
      const taskCard = createTaskCard(task);
      tasksElement.appendChild(taskCard);
    });

    console.log('✅ Tasks initialized with', TASKS_DATA.length, 'tasks');
  }

  function createTaskCard(task) {
    const li = document.createElement('li');
    li.className = 'task-card card';
    
    const taskTitle = getTaskTitle(task);
    const taskDescription = getTaskDescription(task);

    li.innerHTML = `
      <h3>${taskTitle}</h3>
      <p>${taskDescription}</p>
      <div class="task-meta">
        <span>✨ ${task.xp} XP</span>
        <span>📍 Level ${task.requiredLevel}</span>
      </div>
    `;

    return li;
  }

  // Translation helpers
  function getPlaceName(place) {
    if (window.appI18n && window.appI18n.translations) {
      const lang = window.appI18n.language || 'pl';
      const translations = window.appI18n.translations[lang] || {};
      return translations[place.nameKey] || place.nameFallback || place.id;
    }
    return place.nameFallback || place.id;
  }

  function getPlaceDescription(place) {
    if (window.appI18n && window.appI18n.translations) {
      const lang = window.appI18n.language || 'pl';
      const translations = window.appI18n.translations[lang] || {};
      return translations[place.descriptionKey] || place.descriptionFallback || '';
    }
    return place.descriptionFallback || '';
  }

  function getPlaceBadge(place) {
    if (window.appI18n && window.appI18n.translations) {
      const lang = window.appI18n.language || 'pl';
      const translations = window.appI18n.translations[lang] || {};
      return translations[place.badgeKey] || place.badgeFallback || '';
    }
    return place.badgeFallback || '';
  }

  function getTaskTitle(task) {
    const key = `tasks.${task.id}.title`;
    if (window.appI18n && window.appI18n.translations) {
      const lang = window.appI18n.language || 'pl';
      const translations = window.appI18n.translations[lang] || {};
      return translations[key] || task.id;
    }
    return task.id;
  }

  function getTaskDescription(task) {
    const key = `tasks.${task.id}.description`;
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
