# 🔍 DEBUG - Brak Markerów na Mapie

## ❌ Problem:
1. Mapa nie pokazuje markerów
2. Trzeba odświeżać stronę ręcznie żeby POI się pojawił
3. W konsoli błędy CSP

## 🔧 Co zostało dodane - DEBUG LOGS:

### Dodane szczegółowe logi w 3 miejscach:

#### 1. `app-core.js` - `updateMapMarkers()`
```javascript
console.log('🔄 updateMapMarkers() called');
console.log('   - mapInstance:', mapInstance ? 'exists' : 'NULL');
console.log('   - markersLayer:', markersLayer ? 'exists' : 'NULL');
console.log('   - PLACES_DATA:', PLACES_DATA ? PLACES_DATA.length + ' items' : 'UNDEFINED');
console.log('   📍 Adding marker for: [name] at [lat, lng]');
console.log(`✅ Updated map with X markers (from Y places)`);
```

#### 2. `app-core.js` - Event Listener
```javascript
console.log('📡 Adding event listener for poisDataRefreshed');
window.addEventListener('poisDataRefreshed', (event) => {
  console.log('🔔 poisDataRefreshed event received!', event.detail);
  console.log('🔄 Updating map markers...');
  updateMapMarkers();
});
```

#### 3. `poi-loader.js` - `refreshPoisData()`
```javascript
console.log('🔄 Refreshing POIs data...');
console.log(`✅ Refreshed X POIs from Supabase`);
console.log('   Sample POI:', PLACES_DATA[0]);
console.log('🔔 Dispatching poisDataRefreshed event');
console.log('✅ Event dispatched, listeners should update now');
```

---

## 📝 CO MUSISZ TERAZ ZROBIĆ:

### KROK 1: Wyczyść Cache (KRYTYCZNE!) ⚠️

**NOWE pliki muszą się załadować!**

```
1. Cmd+Shift+Delete (Mac) lub Ctrl+Shift+Delete (Win)
2. Zaznacz "Cached images and files"
3. Clear data
4. ZAMKNIJ wszystkie karty cypruseye.com
5. Zamknij całą przeglądarkę
6. Otwórz ponownie
```

---

### KROK 2: Sprawdź Logi w Konsoli

```
1. Otwórz stronę główną (localhost:3002)
2. Otwórz konsolę (Cmd+Option+J)
3. Hard refresh (Cmd+Shift+R)
4. Sprawdź logi i SKOPIUJ je WSZYSTKIE
```

---

## 🔍 Sprawdzanie - Co Powinno Być w Konsoli:

### ✅ **Prawidłowe Ładowanie (sukces):**

```
✅ POI Loader initialized
🚀 Initializing places data...
✅ Supabase client ready
🔄 Loading POIs from Supabase...
✅ Supabase client found, fetching POIs...
✅ Loaded X POIs from Supabase
✅ Using X POIs from Supabase
✅ All data loaded: Places: X

🗺️ Initializing map...
✅ Map instance created
🔄 updateMapMarkers() called
   - mapInstance: exists
   - markersLayer: exists
   - PLACES_DATA: X items
✅ Cleared existing markers
   📍 Adding marker for: [name1] at [lat, lng]
   📍 Adding marker for: [name2] at [lat, lng]
   📍 Adding marker for: [name3] at [lat, lng]
✅ Updated map with X markers (from X places)
📡 Adding event listener for poisDataRefreshed
✅ Map initialized with X markers
```

---

### ❌ **Problem 1: PLACES_DATA undefined**

**Logi:**
```
⚠️ No PLACES_DATA available for markers
   - typeof PLACES_DATA: undefined
```

**Przyczyna:**
- poi-loader.js się nie wykonał
- Supabase nie załadował się
- Timing problem

**Rozwiązanie:**
```javascript
// W konsoli sprawdź:
console.log(window.PLACES_DATA);

// Jeśli undefined:
// 1. Sprawdź czy poi-loader.js się załadował (Network tab)
// 2. Sprawdź czy są błędy w konsoli
// 3. Uruchom ręcznie: await window.initializePlacesData()
```

---

### ❌ **Problem 2: Brak współrzędnych**

**Logi:**
```
⚠️ Skipping place without coordinates: [id] {lat: undefined, lng: undefined}
```

**Przyczyna:**
- Dane z Supabase nie mają lat/lng
- Transformacja nie działa

**Rozwiązanie:**
```javascript
// Sprawdź dane:
console.log(window.PLACES_DATA[0]);

// Powinno być:
{
  id: "test",
  lat: 34.864225,
  lng: 33.306262,
  nameFallback: "test",
  ...
}

// Jeśli lat/lng są null:
// → Problem z danymi w Supabase
// → Sprawdź SQL: SELECT id, lat, lng FROM pois;
```

---

### ❌ **Problem 3: Mapa nie istnieje**

**Logi:**
```
⚠️ Map not ready for marker update
   - mapInstance: NULL
   - markersLayer: NULL
```

**Przyczyna:**
- initializeMap() się nie wykonał
- Leaflet nie załadował się
- Element `<div id="map">` nie istnieje

**Rozwiązanie:**
```javascript
// Sprawdź Leaflet:
console.log(typeof L);  // Powinno być "object"

// Sprawdź element mapy:
console.log(document.getElementById('map'));  // Powinien istnieć

// Sprawdź instancję:
console.log(window.mapInstance);  // Jeśli null - mapa nie stworzona
```

---

### ❌ **Problem 4: Event nie działa**

**Logi po dodaniu POI w admin:**
```
🔄 Refreshing global PLACES_DATA...
✅ Refreshed X POIs from Supabase
🔔 Dispatching poisDataRefreshed event
✅ Event dispatched, listeners should update now

// ALE BRAK:
🔔 poisDataRefreshed event received!
🔄 Updating map markers...
```

**Przyczyna:**
- Event listener nie został zarejestrowany
- Mapa nie została zainicjalizowana
- Event dispatch przed rejestracją listenera

**Rozwiązanie:**
```javascript
// Ręcznie wywołaj update:
window.updateMapMarkers();

// Sprawdź czy funkcja istnieje:
console.log(typeof window.updateMapMarkers);  // Powinno być "function"

// Jeśli undefined:
// → app-core.js się nie załadował
// → Wyczyść cache i odśwież
```

---

## 🧪 Quick Test Manual:

### Test 1: Sprawdź PLACES_DATA
```javascript
// W konsoli wpisz:
console.log(window.PLACES_DATA);
console.log(window.PLACES_DATA?.length);
console.log(window.PLACES_DATA?.[0]);
```

**Oczekiwane:**
```javascript
Array(X) [{id: "test", lat: 34.864225, lng: 33.306262, ...}, ...]
X
{id: "test", lat: 34.864225, lng: 33.306262, nameFallback: "test", ...}
```

---

### Test 2: Sprawdź mapę
```javascript
// W konsoli:
console.log(window.mapInstance);
console.log(window.markersLayer);
console.log(typeof window.updateMapMarkers);
```

**Oczekiwane:**
```javascript
Object {_leaflet_id: 1, ...}  // Leaflet map instance
Object {_leaflet_id: 2, ...}  // Layer group
"function"
```

---

### Test 3: Ręczne dodanie markerów
```javascript
// W konsoli:
window.updateMapMarkers();

// Sprawdź logi:
// Powinno wypisać: "🔄 updateMapMarkers() called"
// Powinno dodać markery
```

---

### Test 4: Sprawdź event listener
```javascript
// Dodaj testowy listener:
window.addEventListener('poisDataRefreshed', (e) => {
  console.log('✅ TEST: Event works!', e.detail);
});

// Potem w admin dodaj POI i sprawdź czy log się pojawi
```

---

## 📊 Checklist Diagnostyczny:

Sprawdź każdy punkt i zaznacz:

### Cache i Pliki:
- [ ] Cache wyczyszczony
- [ ] Przeglądarka zamknięta i otwarta ponownie
- [ ] Hard refresh wykonany (Cmd+Shift+R)
- [ ] app-core.js ładuje się (Network tab, status 200)
- [ ] poi-loader.js ładuje się (Network tab, status 200)

### Supabase:
- [ ] Supabase client dostępny: `console.log(window.getSupabase?.())`
- [ ] POI w bazie: `SELECT * FROM pois WHERE status='published'`
- [ ] POI mają współrzędne: `SELECT id, lat, lng FROM pois`
- [ ] SQL functions uruchomione (3 pliki)

### Dane:
- [ ] PLACES_DATA istnieje: `console.log(window.PLACES_DATA)`
- [ ] PLACES_DATA ma items: `console.log(window.PLACES_DATA?.length)`
- [ ] POI mają lat/lng: `console.log(window.PLACES_DATA?.[0])`

### Mapa:
- [ ] Leaflet załadowany: `console.log(typeof L)`
- [ ] Element mapy istnieje: `console.log(document.getElementById('map'))`
- [ ] mapInstance istnieje: `console.log(window.mapInstance)`
- [ ] markersLayer istnieje: `console.log(window.markersLayer)`
- [ ] updateMapMarkers istnieje: `console.log(typeof window.updateMapMarkers)`

### Event System:
- [ ] Event listener dodany (log: "📡 Adding event listener")
- [ ] Event działa testowo (patrz Test 4)
- [ ] refreshPoisData istnieje: `console.log(typeof window.refreshPoisData)`

---

## 🚑 Awaryjne Rozwiązania:

### Rozwiązanie 1: Ręczne dodanie markerów
```javascript
// Jeśli updateMapMarkers() nie działa automatycznie
// Wywołaj ręcznie w konsoli po załadowaniu strony:
window.updateMapMarkers();
```

### Rozwiązanie 2: Wymuś refresh po dodaniu POI
```javascript
// W admin.js po zapisaniu POI:
await window.refreshPoisData();
setTimeout(() => {
  if (window.updateMapMarkers) {
    window.updateMapMarkers();
  }
}, 500);
```

### Rozwiązanie 3: Pełny reload strony
```javascript
// Jeśli nic nie działa - full reload:
window.location.reload();
```

---

## 📚 Następne Kroki:

1. **Wyczyść cache** (najważniejsze!)
2. **Otwórz konsolę** i sprawdź logi
3. **Skopiuj WSZYSTKIE logi** z konsoli
4. **Uruchom testy** (1-4)
5. **Zaznacz checklist** diagnostyczny
6. **Prześlij logi** jeśli problem persystuje

---

**Status:** 🔍 Debug Mode Enabled  
**Data:** 2025-11-04  
**Wersja:** 5.1 - Debug Logging Added

## 🎯 Co Zrobić TERAZ:

1. **Wyczyść cache** (Cmd+Shift+Delete)
2. **Zamknij przeglądarkę**
3. **Otwórz na nowo**
4. **Otwórz konsolę** (Cmd+Option+J)
5. **Skopiuj WSZYSTKIE logi** z konsoli
6. **Prześlij logi** - wtedy będę mógł dokładnie zobaczyć problem
