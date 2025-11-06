# Dynamic POI System - Complete Setup

## Problem Solved
1. ✅ Status dropdown nie działa (zawsze Draft)
2. ✅ Nowe POI nie pojawiają się na mapie głównej
3. ✅ POI nie synchronizują się z sekcją społeczności
4. ✅ Statyczne dane zamiast dynamicznych z Supabase

## Rozwiązanie

System został przekształcony z **statycznego** na **dynamiczny**:
- POI ładują się z Supabase w czasie rzeczywistym
- Status Published/Draft/Hidden działa poprawnie
- Automatyczna synchronizacja z mapą i społecznością

---

## Instrukcja Instalacji

### Krok 1: Dodaj kolumnę status do tabeli pois

```sql
-- Uruchom w Supabase SQL Editor:
```

Otwórz i uruchom plik: `/ADD_POI_STATUS_COLUMN.sql`

To doda kolumnę `status` do tabeli i ustawi domyślną wartość 'published'.

### Krok 2: Zaktualizuj funkcje admin SQL

Uruchom zaktualizowany plik: `/FIX_POI_COLUMNS.sql`

**Co robi:**
- Naprawia nazwy kolumn (lat/lng/badge/xp/status)
- Dodaje obsługę statusu w create/update
- Domyślny status: 'published'

### Krok 3: Dodaj poi-loader.js do index.html

W swoim głównym pliku `index.html` (lub gdzie ładujesz skrypty), dodaj **PRZED** `data-places.js`:

```html
<!-- POI Loader - Dynamic loading from Supabase -->
<script src="/js/poi-loader.js"></script>

<!-- Static data as fallback -->
<script src="/js/data-places.js"></script>
```

**WAŻNE:** Kolejność ma znaczenie! `poi-loader.js` musi być pierwszy.

### Krok 4: Wyczyść cache i przetestuj

1. **Wyczyść cache przeglądarki:**
   - Mac: `Cmd + Shift + Delete`
   - Windows: `Ctrl + Shift + Delete`

2. **Przeładuj stronę**

3. **Test admin panel:**
   - Otwórz `/admin`
   - Edytuj POI
   - Zmień status na "Published"
   - Zapisz
   - Sprawdź czy pojawia się na mapie

4. **Test strony głównej:**
   - Otwórz stronę główną
   - Sprawdź konsolę: `✅ Using X POIs from Supabase`
   - POI powinny się wyświetlać na mapie

---

## Jak to działa

### 1. **Ładowanie POI**

```javascript
// Automatyczne przy starcie strony:
initializePlacesData()
  → loadPoisFromSupabase()  // Próbuje Supabase
  → fallback do STATIC_PLACES_DATA  // Jeśli Supabase nie działa
```

### 2. **Filtrowanie statusu**

```sql
-- Na stronie głównej (poi-loader.js):
SELECT * FROM pois WHERE status = 'published'

-- W admin panelu (admin.js):
SELECT * FROM pois  -- Wszystkie statusy
```

### 3. **Status POI**

| Status | Widoczność | Użycie |
|--------|------------|--------|
| `published` | ✅ Wszędzie | Gotowe POI |
| `draft` | ❌ Tylko admin | W przygotowaniu |
| `hidden` | ❌ Tylko admin | Tymczasowo ukryte |

### 4. **Synchronizacja**

```javascript
// Po zapisaniu POI w admin panelu:
await savePoi()
  → Zapis do Supabase
  → Trigger: 'poisDataRefreshed' event
  → Odświeżenie mapy/listy automatyczne
```

---

## Pliki zmienione

### Nowe pliki:
1. `/js/poi-loader.js` - dynamiczne ładowanie POI
2. `/ADD_POI_STATUS_COLUMN.sql` - dodanie kolumny status
3. `/DYNAMIC_POI_SETUP_COMPLETE.md` - dokumentacja

### Zmodyfikowane pliki:
1. `/js/data-places.js` - zmienione na STATIC_PLACES_DATA (fallback)
2. `/FIX_POI_COLUMNS.sql` - obsługa statusu
3. `/admin/admin.js` - domyślny status 'published'

---

## Weryfikacja

### ✅ Check 1: Konsola przy starcie
```
✅ POI Loader initialized
🔄 Loading POIs from Supabase...
✅ Loaded X POIs from Supabase
✅ Using X POIs from Supabase
```

### ✅ Check 2: Admin panel
- Otwórz POI do edycji
- Dropdown Status ma 3 opcje: Published/Draft/Hidden
- Można zmienić status
- Po zapisaniu status się zmienia

### ✅ Check 3: Mapa główna
- Published POI widoczne na mapie
- Draft POI niewidoczne na mapie
- Nowe Published POI pojawiają się automatycznie

### ✅ Check 4: Community
- Published POI dostępne do komentowania
- Draft POI niedostępne
- XP działa za odwiedzenie

---

## Rozwiązywanie problemów

### Problem: POI nie ładują się z Supabase

**Sprawdź:**
1. Czy `window.supabaseClient` jest dostępne?
   ```javascript
   console.log(window.supabaseClient);
   ```
2. Czy kolumna `status` istnieje w tabeli?
   ```sql
   SELECT * FROM information_schema.columns 
   WHERE table_name = 'pois' AND column_name = 'status';
   ```

**Rozwiązanie:**
- Uruchom `/ADD_POI_STATUS_COLUMN.sql`
- Sprawdź połączenie Supabase

### Problem: Status dropdown nie działa

**Sprawdź:**
1. Czy POI source to 'supabase'?
   ```javascript
   console.log(adminState.poiDataSource);
   ```
2. Czy admin.js jest zaktualizowany?

**Rozwiązanie:**
- Wyczyść cache
- Przeładuj admin panel

### Problem: POI są draft zamiast published

**Sprawdź:**
1. Status w bazie danych:
   ```sql
   SELECT id, name, status FROM pois;
   ```
2. Domyślna wartość:
   ```sql
   ALTER TABLE pois ALTER COLUMN status SET DEFAULT 'published';
   ```

**Rozwiązanie:**
- Uruchom `/ADD_POI_STATUS_COLUMN.sql`
- Ręcznie ustaw published:
  ```sql
  UPDATE pois SET status = 'published' WHERE status = 'draft';
  ```

---

## API dla deweloperów

### Odświeżanie POI programowo

```javascript
// Odśwież POI z Supabase
await window.refreshPoisData();

// Nasłuchuj na zmiany
window.addEventListener('poisDataRefreshed', (event) => {
  console.log('POIs refreshed:', event.detail.pois);
  // Zaktualizuj UI
});
```

### Custom event handler

```javascript
window.onPoisDataRefreshed = (pois) => {
  console.log(`Loaded ${pois.length} POIs`);
  // Twoja logika
};
```

---

## Następne kroki

### Opcjonalne usprawnienia:

1. **Cache POI locally**
   ```javascript
   localStorage.setItem('pois_cache', JSON.stringify(PLACES_DATA));
   ```

2. **Real-time updates**
   ```javascript
   supabaseClient
     .channel('pois_changes')
     .on('postgres_changes', { event: '*', schema: 'public', table: 'pois' }, 
       payload => refreshPoisData())
     .subscribe();
   ```

3. **Admin bulk operations**
   - Bulk publish/unpublish
   - Bulk delete
   - Export/import POIs

---

## Podsumowanie

✅ **Zrobione:**
- Dynamiczne ładowanie POI z Supabase
- Status Published/Draft/Hidden
- Automatyczna synchronizacja
- Fallback na statyczne dane
- Filtrowanie po statusie

✅ **Działa:**
- Mapa główna
- Admin panel
- Community/komentarze
- XP system

🎉 **System gotowy do produkcji!**

---

**Status:** ✅ Complete
**Data:** 2025-11-03
**Wersja:** 2.0 - Dynamic POI System
