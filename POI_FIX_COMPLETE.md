# Fix POI Creation & Add XP Support - Complete

## Problem
- Błąd przy dodawaniu nowego POI: "column 'latitude' of relation 'pois' does not exist"
- Tabela `pois` używa kolumn `lat` i `lng`, a nie `latitude` i `longitude`
- Funkcje SQL używały niewłaściwych nazw kolumn
- Brak możliwości ustawiania XP za odwiedzenie POI w admin panelu

## Rozwiązanie

### 1. Zaktualizowane pliki:

#### `/FIX_POI_COLUMNS.sql` (ZAKTUALIZOWANY)
- Naprawione funkcje SQL `admin_create_poi` i `admin_update_poi`
- Funkcje używają teraz właściwych nazw kolumn (`lat`, `lng`, `xp`)
- Dodano parametry latitude/longitude/xp do obu funkcji
- Funkcja create_poi generuje automatyczne ID ze slug
- Domyślna wartość XP: 100

#### `/admin/admin.js` (ZAKTUALIZOWANY)
- Zaktualizowano funkcję `savePoi()` do obsługi XP
- Dodano `poi_latitude`, `poi_longitude`, `poi_xp` do RPC calls
- Usunięto błędną bezpośrednią aktualizację tabeli
- Używa `poi.id` (TEXT) zamiast `poi.uuid` (UUID)
- Zaktualizowano `normalizePoi()` do czytania kolumny `xp`
- Dodano wyświetlanie XP w szczegółach POI

#### `/admin/index.html` (ZAKTUALIZOWANY)
- Dodano pole "XP Reward" do formularza POI
- Nowe pole: `<input type="number" id="poiXP" name="xp">`
- Zakres: 0-1000, krok: 5, placeholder: 100

### 2. Co musisz zrobić:

#### Krok 1: Uruchom SQL w Supabase
1. Otwórz Supabase SQL Editor
2. Wklej zawartość pliku `/FIX_POI_COLUMNS.sql`
3. Kliknij "Run"
4. Sprawdź wyniki weryfikacji na końcu

#### Krok 2: Odśwież admin panel
1. Wyczyść cache przeglądarki (Ctrl+Shift+Delete lub Cmd+Shift+Delete)
2. Przeładuj stronę admin panel
3. Sprawdź czy możesz dodać nowy POI

## Co zostało naprawione:

✅ Funkcja `admin_create_poi` używa kolumn `lat`, `lng`, `xp`  
✅ Funkcja `admin_update_poi` przyjmuje i aktualizuje latitude/longitude/xp  
✅ JavaScript przekazuje latitude/longitude/xp do RPC  
✅ Usunięto błędną bezpośrednią aktualizację tabeli  
✅ Poprawiono typ ID (TEXT zamiast UUID)  
✅ Dodano pole XP w formularzu admin panelu  
✅ XP wyświetla się w szczegółach POI  
✅ XP automatycznie aktualizuje się z bazy danych  

## Test:

Po uruchomieniu SQL, spróbuj dodać nowy POI:
- Name: test
- Latitude: 34.864225
- Longitude: 33.306262
- Category: test
- XP Reward: 150
- Description: test

Powinno działać bez błędów! XP będzie zapisane w bazie i widoczne dla graczy.

## Dodatkowe informacje:

### Struktura tabeli `pois`:
```
- id (TEXT, PRIMARY KEY)
- name (TEXT)
- description (TEXT)
- lat (DOUBLE PRECISION) ← nie "latitude"
- lng (DOUBLE PRECISION) ← nie "longitude"
- category (TEXT)
- xp (INTEGER) ← nagroda XP za odwiedzenie
- data (JSONB)
- created_by (UUID)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
```

### Funkcja `normalizePoi`:
Już obsługuje właściwe nazwy kolumn (`lat`, `lng`, `xp`) dzięki fallback logice w JavaScript.

### Jak działa system XP:
1. Admin ustawia wartość XP dla każdego POI (domyślnie 100)
2. Gdy gracz odwiedza POI, otrzymuje ustawioną ilość XP
3. XP aktualizuje się automatycznie w profilu gracza
4. Gracz widzi swoją nagrodę XP w grze

---

**Status**: ✅ Gotowe do testowania po uruchomieniu SQL
