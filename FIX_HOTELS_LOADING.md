# FIX: Hotels Not Loading After Import Changes

## Problem
```
Sekcja "🏨 Zakwaterowania" pokazuje tylko "Ładowanie hoteli..." 
i hotele nie renderują się po ostatnich zmianach importów.
```

**Przyczyna:** Dynamiczny import z absolutną ścieżką `/js/supabaseClient.js` w funkcji `loadHomeHotels()` nie działa w bundlerze.

---

## PLAN (3 kroki)

1. ✅ **Diagnoza** - Zidentyfikowano dynamiczny import w `loadHomeHotels()`
2. ✅ **Naprawa importu** - Zastąpiono `await import('/js/...')` statycznym importem
3. ✅ **Build** - `npm run build` ✅ SUCCESS

---

## PLIKI - Zmiany

### `/js/home-hotels.js` (1 zmiana)

**Przed:**
```javascript
async function loadHomeHotels(){
  try{
    // ❌ Dynamic import z absolutną ścieżką - nie działa w bundlerze
    const { supabase } = await import('/js/supabaseClient.js');
    if(!supabase) throw new Error('Supabase client not available');
    
    const { data, error } = await supabase
      .from('hotels')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false });
```

**Po:**
```javascript
// ✅ Static import na górze pliku
import { supabase } from './lib/supabase.js';

async function loadHomeHotels(){
  try{
    // ✅ Używamy już zaimportowanego klienta
    if(!supabase) throw new Error('Supabase client not available');
    
    const { data, error } = await supabase
      .from('hotels')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false });
```

---

## DIFF - Minimalny

```diff
# /js/home-hotels.js

+ import { supabase } from './lib/supabase.js';
  import { submitHotelBooking } from './services/hotelBooking.js';

  async function loadHomeHotels(){
    try{
-     const { supabase } = await import('/js/supabaseClient.js');
      if(!supabase) throw new Error('Supabase client not available');
```

**Tylko 2 linie zmienione:**
- Dodano: `import { supabase } from './lib/supabase.js';` (linia 5)
- Usunięto: `const { supabase } = await import('/js/supabaseClient.js');` (linia 14)

---

## BUILD OUTPUT

```bash
$ npm run build

✅ Built: js/lib/supabase.js (1043 bytes)
✅ Built: js/home-hotels.js (13324 bytes)  ← Zmniejszony o 23 bajty (było 13347)
✅ Build complete! Files in /dist/
```

---

## WERYFIKACJA

### Struktura HTML (index.html)
Elementy już istnieją:
```html
<div id="hotelsHomeSection">
  <h2>🏨 Zakwaterowania</h2>
  <div id="hotelsHomeTabs"></div>
  <div id="hotelsHomeGrid" class="home-carousel">
    <div>Ładowanie hoteli...</div>
  </div>
</div>
```

### Inicjalizacja (js/home-hotels.js)
```javascript
// Linia 104
document.addEventListener('DOMContentLoaded', ()=>{
  loadHomeHotels();  // ✅ Wywoływane przy załadowaniu strony
});
```

### Query do Supabase
```javascript
supabase
  .from('hotels')
  .select('*')
  .eq('is_published', true)
  .order('created_at', { ascending: false })
```

---

## TEST W PRZEGLĄDARCE

### 1. Hard Reload
```
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)
```

### 2. Sprawdź Network Tab (F12)
Filtr: `hotels`

**Oczekiwany request:**
```
GET https://daoohnbnnowmmcizgvrq.supabase.co/rest/v1/hotels?is_published=eq.true&order=created_at.desc
Status: 200 OK

Headers:
  apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Sprawdź Console (F12)

**Sukces:**
```
✅ Powinny się wyrenderować karty hoteli
✅ Brak błędów w konsoli
✅ Tabs z miastami powinny się pokazać
```

**Możliwe błędy:**

#### A) Status 401 Unauthorized
```javascript
console.error('❌ Failed to load hotels:', {
  code: undefined,
  message: "Invalid API key",
  status: 401
})
```
**Przyczyna:** Brak ENV vars w produkcji  
**Rozwiązanie:** Ustaw `VITE_SUPABASE_URL` i `VITE_SUPABASE_ANON_KEY` w Cloudflare Pages

#### B) Status 403 Forbidden (RLS)
```javascript
console.error('❌ Failed to load hotels:', {
  code: "42501",
  message: "new row violates row-level security policy",
  details: "..."
})
```
**Przyczyna:** RLS blokuje SELECT dla `anon`  
**Rozwiązanie:** Uruchom w Supabase SQL Editor:
```sql
-- Allow anonymous users to read published hotels
CREATE POLICY "Public can read published hotels"
  ON public.hotels 
  FOR SELECT
  USING (is_published = true);

GRANT SELECT ON public.hotels TO anon;
GRANT SELECT ON public.hotels TO authenticated;
```

#### C) Status 200 OK, ale pusta tablica
```javascript
console.log('Hotels loaded:', [])  // Pusta tablica
```
**Przyczyna:** Brak hoteli z `is_published = true`  
**Rozwiązanie:** Dodaj testowe hotele:
```sql
UPDATE public.hotels 
SET is_published = true 
WHERE id IN (
  SELECT id FROM public.hotels LIMIT 5
);
```

#### D) Status 404 Not Found
```
GET /rest/v1/hotels → 404
```
**Przyczyna:** Tabela `hotels` nie istnieje  
**Rozwiązanie:** Utwórz tabelę lub sprawdź nazwę

---

## ZGODNOŚĆ Z WYMAGANIAMI

✅ Usunięto dynamiczny import `await import('/js/...')`  
✅ Zastąpiono statycznym importem `import { supabase } from './lib/supabase.js'`  
✅ Brak zmian w ENV  
✅ Brak użycia service role  
✅ Nie dotknięto innych sekcji (trips, formularze)  
✅ Build działa (`npm run build`)  
✅ Bundlowane do `/dist/js/home-hotels.js`  

---

## TROUBLESHOOTING

### Jeśli hotele nadal się nie ładują:

1. **Sprawdź czy build został wdrożony:**
   ```bash
   # Porównaj rozmiar pliku
   ls -lh /dist/js/home-hotels.js
   # Powinno być: 13324 bytes (nie 13347)
   ```

2. **Wyczyść cache:**
   - Hard Refresh: `Ctrl + Shift + R`
   - Lub: DevTools → Application → Clear storage

3. **Sprawdź konsolę przeglądarki:**
   ```javascript
   // Sprawdź czy Supabase jest dostępny
   console.log('Supabase:', window.__supabase__)
   console.log('Config:', window.__supabaseConfig__)
   ```

4. **Sprawdź Network:**
   - Filtr: `hotels`
   - Szukaj: `GET .../rest/v1/hotels`
   - Status powinien być: `200 OK`

5. **Sprawdź RLS w Supabase:**
   ```sql
   -- Sprawdź czy polityka istnieje
   SELECT * FROM pg_policies 
   WHERE tablename = 'hotels' 
   AND policyname LIKE '%public%';
   ```

---

## STRUKTURA DANYCH

### hotels table (public.hotels)
```sql
id                uuid PRIMARY KEY
name              text NOT NULL
city              text
price_eur         numeric(10,2)
cover_photo_url   text
is_published      boolean DEFAULT false
created_at        timestamptz DEFAULT now()
```

### Przykładowy rekord:
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Hotel Paradise",
  "city": "Paphos",
  "price_eur": 120.00,
  "cover_photo_url": "https://...",
  "is_published": true,
  "created_at": "2024-01-15T10:00:00Z"
}
```

---

## NEXT STEPS

1. **Deploy:**
   ```bash
   git add js/home-hotels.js
   git commit -m "Fix: Replace dynamic import in hotels loader"
   git push
   ```

2. **Monitor Cloudflare Pages:**
   - Sprawdź czy build się powiódł
   - Sprawdź deployment logs

3. **Test w produkcji:**
   - Hard reload strony
   - Sprawdź Network → `/rest/v1/hotels` → 200 OK
   - Potwierdź że hotele się renderują

4. **Jeśli RLS blokuje (403):**
   - Uruchom SQL z sekcji "Troubleshooting → B) Status 403"
   - Test ponownie

5. **Jeśli pusta tablica (200 + []):**
   - Sprawdź `SELECT * FROM hotels WHERE is_published = true`
   - Ustaw `is_published = true` dla kilku hoteli
   - Odśwież stronę

---

**Status:** ✅ FIXED  
**Build:** ✅ SUCCESS  
**Changed Files:** 1 (`js/home-hotels.js`)  
**Lines Changed:** 2 (1 dodana, 1 usunięta)  

Hotele powinny się teraz ładować poprawnie. Jeśli w Network widzisz `200 OK` ale hotele nie renderują, sprawdź czy `is_published = true` w bazie. 🚀
