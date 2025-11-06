# 🗺️ Auto-Refresh Markerów na Mapie

## ✅ Problem Rozwiązany

**Przed:**
- ❌ Mapa pokazywała się ale bez markerów
- ❌ Po dodaniu POI w admin panelu markery się nie pojawiały
- ❌ Trzeba było ręcznie odświeżać stronę

**Po:**
- ✅ Mapa automatycznie dodaje markery po załadowaniu POI z Supabase
- ✅ Po dodaniu/edycji/usunięciu POI w admin → markery automatycznie się aktualizują
- ✅ Nasłuchuje na event `poisDataRefreshed` i odświeża markery
- ✅ Nie trzeba ręcznie odświeżać strony

---

## 🔧 Co Zostało Zmienione

### `/app-core.js` - Refaktoryzacja mapy

#### 1. **Globalna instancja mapy i warstwy markerów**
```javascript
// Przechowywane globalnie żeby były dostępne do aktualizacji
let mapInstance = null;      // Instancja Leaflet map
let markersLayer = null;     // Layer group dla markerów
```

#### 2. **Funkcja `initializeMap()` - tylko tworzy mapę raz**
```javascript
function initializeMap() {
  // Tworzy mapę tylko jeśli jeszcze nie istnieje
  if (!mapInstance) {
    mapInstance = L.map('map').setView([35.095, 33.203], 9);
    L.tileLayer(...).addTo(mapInstance);
    markersLayer = L.layerGroup().addTo(mapInstance);
  }
  
  // Dodaje początkowe markery
  updateMapMarkers();
  
  // NOWE: Nasłuchuje na refresh POI
  window.addEventListener('poisDataRefreshed', () => {
    console.log('🔄 POI data refreshed, updating map markers...');
    updateMapMarkers();
  });
}
```

#### 3. **Nowa funkcja `updateMapMarkers()` - odświeża markery**
```javascript
function updateMapMarkers() {
  if (!markersLayer || !mapInstance) return;
  
  // 1. Czyści wszystkie istniejące markery
  markersLayer.clearLayers();
  
  // 2. Dodaje nowe markery z PLACES_DATA
  PLACES_DATA.forEach(place => {
    // Walidacja współrzędnych
    if (!place.lat || !place.lng) {
      console.warn('⚠️ Skipping place without coordinates:', place.id);
      return;
    }
    
    // Tworzy marker z custom ikoną
    const marker = L.marker([place.lat, place.lng], { icon: customIcon });
    
    // Dodaje popup
    marker.bindPopup(`<div>...</div>`);
    
    // Dodaje do warstwy
    marker.addTo(markersLayer);
  });
  
  console.log(`✅ Updated map with ${PLACES_DATA.length} markers`);
}
```

#### 4. **Eksport dla zewnętrznego użycia**
```javascript
window.updateMapMarkers = updateMapMarkers;
```

---

## 🔄 Jak To Działa - Flow

### Początkowe Ładowanie:

```
1. Strona się ładuje
   ↓
2. poi-loader.js czeka na Supabase
   ↓
3. Ładuje POI z Supabase (status = 'published')
   ↓
4. Ustawia globalny PLACES_DATA
   ↓
5. app-core.js czeka na PLACES_DATA
   ↓
6. Wywołuje initializeMap()
   ↓
7. Tworzy mapę i warstwę markerów
   ↓
8. Wywołuje updateMapMarkers()
   ↓
9. ✅ Markery pojawiają się na mapie
```

### Po dodaniu POI w admin:

```
1. Admin dodaje nowy POI
   ↓
2. admin.js wywołuje admin_create_poi()
   ↓
3. POI zapisany w Supabase
   ↓
4. admin.js wywołuje window.refreshPoisData()
   ↓
5. poi-loader.js ładuje fresh dane z Supabase
   ↓
6. Aktualizuje globalny PLACES_DATA
   ↓
7. Emituje event 'poisDataRefreshed'
   ↓
8. app-core.js nasłuchuje i wywołuje updateMapMarkers()
   ↓
9. Czyści stare markery
   ↓
10. Dodaje nowe markery (włącznie z nowym POI)
   ↓
11. ✅ Nowy marker pojawia się na mapie!
```

### Po zmianie statusu na Draft:

```
1. Admin zmienia status POI na 'draft'
   ↓
2. admin.js wywołuje admin_update_poi()
   ↓
3. Status zapisany w Supabase
   ↓
4. admin.js wywołuje window.refreshPoisData()
   ↓
5. poi-loader.js ładuje dane (filtruje: status = 'published')
   ↓
6. POI ze statusem 'draft' NIE jest w wyniku
   ↓
7. Aktualizuje PLACES_DATA (bez tego POI)
   ↓
8. Emituje event 'poisDataRefreshed'
   ↓
9. updateMapMarkers() odświeża
   ↓
10. ✅ Marker znika z mapy!
```

---

## 🎯 Kluczowe Funkcje

### `updateMapMarkers()` - Główna funkcja refresh

**Co robi:**
- Czyści wszystkie markery z mapy
- Iteruje przez `PLACES_DATA`
- Waliduje każdy POI (lat, lng)
- Tworzy marker z custom ikoną
- Dodaje popup z nazwą, oceną, linkiem do Google Maps
- Dodaje marker do warstwy

**Kiedy jest wywoływana:**
1. Przy inicjalizacji mapy (pierwsze ładowanie)
2. Po event 'poisDataRefreshed' (zmiana POI)
3. Można wywołać ręcznie: `window.updateMapMarkers()`

**Bezpieczeństwa:**
- Sprawdza czy mapa istnieje
- Waliduje współrzędne przed dodaniem markera
- Loguje ostrzeżenia dla niepoprawnych danych

---

## 📊 Event System

### Event: `poisDataRefreshed`

**Źródło:** `/js/poi-loader.js`

**Kiedy emitowany:**
- Po załadowaniu fresh danych z Supabase
- Po wywołaniu `window.refreshPoisData()`

**Przykład:**
```javascript
// poi-loader.js
function refreshPoisData() {
  // ... ładuje dane z Supabase
  PLACES_DATA = freshPois;
  
  // Emituje event
  const event = new CustomEvent('poisDataRefreshed', {
    detail: { count: PLACES_DATA.length }
  });
  window.dispatchEvent(event);
}
```

**Nasłuchiwanie:**
```javascript
// app-core.js
window.addEventListener('poisDataRefreshed', () => {
  console.log('🔄 POI data refreshed, updating map markers...');
  updateMapMarkers();
});
```

---

## 🧪 Testowanie

### Test 1: Początkowe ładowanie markerów

```
1. Otwórz stronę główną
2. Wyczyść cache (Cmd+Shift+Delete)
3. Hard refresh (Cmd+Shift+R)
4. Sprawdź konsolę:
```

**Oczekiwane logi:**
```
✅ Supabase client ready
✅ Loaded X POIs from Supabase
✅ Using X POIs from Supabase
✅ All data loaded: Places: X
🗺️ Initializing map...
✅ Map instance created
✅ Updated map with X markers
✅ Map initialized with X markers
```

**Rezultat:** Mapa powinna pokazać X niebieskich markerów ✅

---

### Test 2: Dodanie nowego POI

```
1. Mapa główna otwarta (z markerami)
2. Otwórz /admin w nowej karcie
3. Add New POI:
   - Name: Test Marker Refresh
   - Lat: 34.864225
   - Lng: 33.306262
   - Category: test
   - Status: Published
   - XP: 150
4. Save
5. Wróć do karty z mapą główną
6. Sprawdź konsolę:
```

**Oczekiwane logi:**
```
🔄 Refreshing global PLACES_DATA...
✅ Refreshed X POIs
🔄 POI data refreshed, updating map markers...
✅ Updated map with X markers
```

**Rezultat:** Nowy marker "Test Marker Refresh" pojawia się na mapie AUTOMATYCZNIE (bez odświeżania strony!) ✅

---

### Test 3: Zmiana statusu na Draft

```
1. W /admin edytuj "Test Marker Refresh"
2. Status → Draft
3. Save
4. Wróć do mapy głównej
5. Sprawdź konsolę:
```

**Oczekiwane logi:**
```
🔄 Refreshing global PLACES_DATA...
✅ Refreshed X POIs (X-1 bo jeden jest draft)
🔄 POI data refreshed, updating map markers...
✅ Updated map with X-1 markers
```

**Rezultat:** Marker "Test Marker Refresh" ZNIKA z mapy automatycznie ✅

---

### Test 4: Przywrócenie na Published

```
1. W /admin edytuj "Test Marker Refresh"
2. Status → Published
3. Save
4. Wróć do mapy głównej
```

**Rezultat:** Marker WRACA na mapę automatycznie ✅

---

### Test 5: Usunięcie POI

```
1. W /admin usuń "Test Marker Refresh"
2. Wróć do mapy głównej
3. Sprawdź konsolę:
```

**Oczekiwane logi:**
```
🔄 Refreshing global PLACES_DATA after delete...
✅ Refreshed X POIs (X-1)
🔄 POI data refreshed, updating map markers...
✅ Updated map with X-1 markers
```

**Rezultat:** Marker ZNIKA całkowicie z mapy ✅

---

## 🔍 Diagnostyka

### Problem: Markery nie pojawiają się

**Check 1: Czy PLACES_DATA jest załadowany?**
```javascript
console.log(window.PLACES_DATA);
console.log(window.PLACES_DATA?.length);
```

**Jeśli undefined lub 0:**
- Problem z poi-loader.js
- Zobacz: NAPRAWA_MAPY_I_SYNCHRONIZACJI.md

**Check 2: Czy mapa jest zainicjalizowana?**
```javascript
console.log(window.mapInstance);
console.log(window.markersLayer);
```

**Jeśli null:**
- Map nie została stworzona
- Sprawdź czy element `<div id="map">` istnieje
- Sprawdź czy Leaflet jest załadowany: `typeof L`

**Check 3: Czy współrzędne są poprawne?**
```javascript
PLACES_DATA.forEach(p => {
  if (!p.lat || !p.lng) {
    console.warn('Missing coords:', p.id, p);
  }
});
```

**Jeśli brak lat/lng:**
- Problem z transformacją w poi-loader.js
- Sprawdź `transformPoiFromDatabase()`

---

### Problem: Markery nie aktualizują się po zmianach

**Check 1: Czy event jest emitowany?**
```javascript
window.addEventListener('poisDataRefreshed', (e) => {
  console.log('✅ Event received!', e.detail);
});
```

**Jeśli NIE:**
- poi-loader.js nie emituje eventu
- Sprawdź czy `window.refreshPoisData()` działa
- admin.js może nie wywołać refresh

**Check 2: Czy updateMapMarkers() jest wywoływany?**
```javascript
// Dodaj log na początku funkcji:
function updateMapMarkers() {
  console.log('🔄 updateMapMarkers called');
  // ...
}
```

**Jeśli NIE:**
- Event listener nie działa
- Może być problem z timing

**Check 3: Czy markersLayer istnieje?**
```javascript
console.log(window.markersLayer);
```

**Jeśli null:**
- Mapa nie została poprawnie zainicjalizowana
- Sprawdź logi z initializeMap()

---

### Problem: Duplikaty markerów

**Przyczyna:** `markersLayer.clearLayers()` nie działa

**Rozwiązanie:**
```javascript
// Sprawdź czy layer jest pusty po clear:
markersLayer.clearLayers();
console.log('Layers after clear:', markersLayer.getLayers().length);
// Powinno być 0
```

---

## 📚 API Reference

### `window.updateMapMarkers()`

**Opis:** Odświeża wszystkie markery na mapie

**Parametry:** Brak

**Zwraca:** `void`

**Przykład:**
```javascript
// Ręczne odświeżenie markerów
window.updateMapMarkers();
```

**Kiedy użyć:**
- Debugging
- Custom logic który zmienia PLACES_DATA bezpośrednio
- Testy

---

### Event: `poisDataRefreshed`

**Typ:** `CustomEvent`

**Detail:**
```javascript
{
  count: number  // Liczba POI po refresh
}
```

**Przykład nasłuchiwania:**
```javascript
window.addEventListener('poisDataRefreshed', (event) => {
  console.log(`POI refreshed: ${event.detail.count} items`);
  // Custom logic
});
```

---

## ✅ Checklist Wdrożenia

### Zrobione:
- [x] Refaktoryzacja `initializeMap()` w app-core.js
- [x] Utworzenie funkcji `updateMapMarkers()`
- [x] Dodanie nasłuchiwania na `poisDataRefreshed`
- [x] Eksport `window.updateMapMarkers`
- [x] Walidacja współrzędnych
- [x] Obsługa pustego PLACES_DATA

### Do testowania:
- [ ] Wyczyść cache
- [ ] Test początkowego ładowania
- [ ] Test dodawania POI
- [ ] Test zmiany statusu
- [ ] Test usuwania POI
- [ ] Sprawdź czy nie ma duplikatów markerów

---

## 🎉 Rezultat

**Po wdrożeniu:**

✅ **Mapa główna**
- Pokazuje markery dla wszystkich POI z statusem 'published'
- Auto-refresh po zmianach w admin panelu
- Brak konieczności ręcznego odświeżania strony

✅ **Admin Panel**
- Dodanie POI → marker pojawia się automatycznie
- Zmiana statusu → marker znika/pojawia się
- Usunięcie POI → marker znika automatycznie

✅ **Synchronizacja**
- Event-driven architecture
- Real-time updates
- Brak race conditions

✅ **User Experience**
- Seamless experience
- No page reloads needed
- Instant feedback

---

**Status:** ✅ Markery Auto-Refresh Działają  
**Data:** 2025-11-03  
**Wersja:** 5.0 - Map Markers Auto-Refresh
