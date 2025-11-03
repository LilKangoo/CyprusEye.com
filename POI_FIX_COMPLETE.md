# Fix POI Creation - Complete

## Problem
- Błąd przy dodawaniu nowego POI: "column 'latitude' of relation 'pois' does not exist"
- Tabela `pois` używa kolumn `lat` i `lng`, a nie `latitude` i `longitude`
- Funkcje SQL używały niewłaściwych nazw kolumn

## Rozwiązanie

### 1. Zaktualizowane pliki:

#### `/FIX_POI_COLUMNS.sql` (NOWY)
- Naprawione funkcje SQL `admin_create_poi` i `admin_update_poi`
- Funkcje używają teraz właściwych nazw kolumn (`lat`, `lng`)
- Dodano parametry latitude/longitude do `admin_update_poi`
- Funkcja create_poi generuje automatyczne ID ze slug

#### `/admin/admin.js`
- Zaktualizowano funkcję `savePoi()` 
- Dodano `poi_latitude` i `poi_longitude` do wywołania `admin_update_poi`
- Usunięto błędną bezpośrednią aktualizację tabeli
- Używa `poi.id` (TEXT) zamiast `poi.uuid` (UUID)

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

✅ Funkcja `admin_create_poi` używa kolumn `lat`, `lng`  
✅ Funkcja `admin_update_poi` przyjmuje i aktualizuje latitude/longitude  
✅ JavaScript przekazuje latitude/longitude do RPC  
✅ Usunięto błędną bezpośrednią aktualizację tabeli  
✅ Poprawiono typ ID (TEXT zamiast UUID)  

## Test:

Po uruchomieniu SQL, spróbuj dodać nowy POI:
- Name: test
- Latitude: 34.864225
- Longitude: 33.306262
- Category: test
- Description: test

Powinno działać bez błędów!

## Dodatkowe informacje:

### Struktura tabeli `pois`:
```
- id (TEXT, PRIMARY KEY)
- name (TEXT)
- description (TEXT)
- lat (DOUBLE PRECISION) ← nie "latitude"
- lng (DOUBLE PRECISION) ← nie "longitude"
- category (TEXT)
- data (JSONB)
- created_by (UUID)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
```

### Funkcja `normalizePoi`:
Już obsługuje właściwe nazwy kolumn (`lat`, `lng`) dzięki fallback logice w JavaScript.

---

**Status**: ✅ Gotowe do testowania po uruchomieniu SQL
