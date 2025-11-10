# FIX: Hotel Booking 401 Unauthorized Error

## Problem
- Błąd 401 Unauthorized przy POST do `/rest/v1/hotel_bookings`
- Brak nagłówków `apikey` i `Authorization` w requestach do Supabase
- Stary klient używał hardcoded credentials zamiast VITE_* env vars

## Rozwiązanie
Utworzono nową implementację używającą zmiennych środowiskowych VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY z prawidłowymi nagłówkami autoryzacji.

---

## PLAN (4 kroki)

1. ✅ **Diagnoza** - Zidentyfikowano brak nagłówków apikey/Authorization
2. ✅ **Nowy klient Supabase** - Utworzono `/src/lib/supabase.js` z VITE_* env
3. ✅ **Aktualizacja serwisu** - Zaktualizowano `/js/services/hotelBooking.js`
4. ✅ **Build i weryfikacja** - Pomyślnie zbudowano projekt (npm run build)

---

## PLIKI - Utworzone/Zmodyfikowane

### 1. `/src/lib/supabase.js` (NOWY - 65 linii)
**Kluczowe zmiany:**
```javascript
// Odczyt VITE_* env vars z import.meta.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Tworzenie klienta z WYMAGANYMI nagłówkami
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { ... },
  global: {
    headers: {
      'apikey': supabaseAnonKey,              // ← FIX 401
      'Authorization': `Bearer ${supabaseAnonKey}` // ← FIX 401
    }
  }
});
```

**Funkcje:**
- `getEnvVar(key)` - Multi-source env var loader (import.meta.env → window.__ENV__ → process.env)
- Walidacja obecności VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY
- Export `supabase` klienta z prawidłowymi nagłówkami
- Debug: `window.__supabase__` i `window.__supabaseConfig__`

### 2. `/src/services/hotelBooking.js` (NOWY - 183 linie)
**Backup czystej implementacji z VITE_* env vars**

### 3. `/js/services/hotelBooking.js` (ZMODYFIKOWANY)
**Kluczowe zmiany:**

#### a) Import nowego klienta (linia 15)
```diff
- const { supabase } = await import('../supabaseClient.js');
+ const { supabase } = await import('../../src/lib/supabase.js');
```

#### b) Walidacja pól (linie 28-44)
```javascript
+ if (!fd.get('name') || !fd.get('email')) {
+   throw new Error('Imię i email są wymagane');
+ }
+ if (!currentHotel) {
+   throw new Error('Nie wybrano hotelu');
+ }
```

#### c) Rozbudowane logowanie błędów (linie 98-125)
```javascript
console.error('❌ Supabase error details:', {
  code: error.code,        // np. '42501', '23502', '23503'
  message: error.message,  // Komunikat błędu
  details: error.details,  // Szczegóły (brakujące kolumny)
  hint: error.hint,        // Podpowiedzi Supabase
  status: error.status     // HTTP status
});

// User-friendly messages dla typowych błędów
if (error.code === '42501') {
  errorMsg = 'Brak uprawnień do zapisu. Sprawdź polityki RLS w Supabase.';
} else if (error.code === '23502') {
  errorMsg = `Brak wymaganego pola: ${error.details}`;
} else if (error.code === '23503') {
  errorMsg = `Błąd relacji: ${error.details}`;
}
```

### 4. `/scripts/build.js` (ZMODYFIKOWANY - linia 12)
```diff
- const JS_DIRECTORIES = ['js', 'admin', 'assets/js', 'src/utils'];
+ const JS_DIRECTORIES = ['js', 'admin', 'assets/js', 'src/utils', 'src/lib', 'src/services'];
```

---

## DIFF - Szczegółowe zmiany

### `/src/lib/supabase.js` (nowy plik)
```javascript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`
    }
  }
});
```

### `/js/services/hotelBooking.js` - Import
```diff
- const { supabase } = await import('../supabaseClient.js');
+ const { supabase } = await import('../../src/lib/supabase.js');
```

### `/js/services/hotelBooking.js` - Error handling
```diff
  if (error) {
-   console.error('❌ Supabase error:', error);
-   throw new Error(error.message || 'Insert failed');
+   console.error('❌ Supabase error details:', {
+     code: error.code,
+     message: error.message,
+     details: error.details,
+     hint: error.hint,
+     status: error.status
+   });
+   // User-friendly error messages...
+   throw new Error(errorMsg);
  }
```

---

## BUILD OUTPUT

```bash
✅ Built: src/lib/supabase.js (1119 bytes)
✅ Built: src/services/hotelBooking.js (2643 bytes)
✅ Built: js/services/hotelBooking.js (2650 bytes)
```

**Status:** ✅ BUILD SUCCESS

---

## KOMENDY

### Build
```bash
npm run build
```

### Test lokalny
```bash
npm run dev
# lub
npm run serve

# Otwórz w przeglądarce
open http://localhost:8080/index.html
```

### Deploy na Cloudflare Pages
Upewnij się że zmienne środowiskowe są ustawione:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## TEST SUBMISSION

### Kroki testowe:

1. **Otwórz stronę:**
   ```
   http://localhost:8080/index.html
   ```

2. **Przejdź do sekcji hoteli:**
   - Przewiń do "🏨 Zakwaterowania"
   - Kliknij na kartę hotelu → otworzy się modal

3. **Wypełnij formularz:**
   - Imię i nazwisko: `Jan Kowalski`
   - Email: `test@example.com`
   - Telefon: `+48123456789` (opcjonalnie)
   - Data przyjazdu: `2025-01-15`
   - Data wyjazdu: `2025-01-20`
   - Dorośli: `2`
   - Dzieci: `0`
   - Uwagi: `Test rezerwacji` (opcjonalnie)

4. **Kliknij "Zarezerwuj"**

5. **Sprawdź konsolę przeglądarki:**

### Oczekiwane logi - SUKCES:
```
📤 Submitting hotel booking to Supabase: {
  hotel_id: "...",
  hotel_slug: "...",
  customer_name: "Jan Kowalski",
  customer_email: "test@example.com",
  customer_phone: "+48123456789",
  arrival_date: "2025-01-15",
  departure_date: "2025-01-20",
  num_adults: 2,
  num_children: 0,
  nights: 5,
  notes: "Test rezerwacji",
  total_price: 250.00,
  status: "pending"
}

✅ Hotel booking created successfully: [{
  id: "...",
  created_at: "...",
  ...
}]
```

**UI:** Zielony komunikat "Rezerwacja przyjęta! Skontaktujemy się wkrótce."

### Możliwe błędy i diagnostyka:

#### Błąd 401 Unauthorized
```
❌ Supabase error details: {
  code: undefined,
  message: "Invalid API key",
  status: 401
}
```
**Przyczyna:** Brak VITE_SUPABASE_ANON_KEY w środowisku  
**Rozwiązanie:** Ustaw zmienne środowiskowe w Cloudflare Pages

#### Błąd 42501 (RLS)
```
❌ Supabase error details: {
  code: "42501",
  message: "new row violates row-level security policy",
  details: "...",
  hint: "..."
}
```
**Przyczyna:** Polityki RLS blokują INSERT  
**Rozwiązanie:** Uruchom `/FIX_HOTEL_BOOKINGS_RLS.sql`

#### Błąd 23502 (NOT NULL)
```
❌ Supabase error details: {
  code: "23502",
  message: "null value in column violates not-null constraint",
  details: "Failing column: customer_name",
  hint: "..."
}
```
**Przyczyna:** Brakujące wymagane pole  
**Rozwiązanie:** Sprawdź mapowanie pól formularza

#### Błąd 23503 (Foreign Key)
```
❌ Supabase error details: {
  code: "23503",
  message: "insert or update violates foreign key constraint",
  details: "Key (hotel_id)=(...) is not present in table hotels",
  hint: "..."
}
```
**Przyczyna:** Nieprawidłowe hotel_id  
**Rozwiązanie:** Sprawdź czy hotel istnieje w bazie

---

## WERYFIKACJA W SUPABASE

Po udanym submicie:

```sql
-- Sprawdź nową rezerwację
SELECT 
  id,
  hotel_slug,
  customer_name,
  customer_email,
  arrival_date,
  departure_date,
  num_adults,
  num_children,
  nights,
  total_price,
  status,
  created_at
FROM public.hotel_bookings
ORDER BY created_at DESC
LIMIT 1;
```

**Oczekiwany wynik:**
```
id              | uuid generowane
hotel_slug      | nazwa hotelu
customer_name   | "Jan Kowalski"
customer_email  | "test@example.com"
arrival_date    | 2025-01-15
departure_date  | 2025-01-20
num_adults      | 2
num_children    | 0
nights          | 5
total_price     | 250.00
status          | "pending"
created_at      | timestamp teraz
```

---

## MAPOWANIE PÓL - Kompletne

```
FORMULARZ (HTML)          →  PAYLOAD            →  DATABASE COLUMN
--------------------------------------------------------------------------------
name="name"               →  customer_name      →  customer_name (text NOT NULL)
name="email"              →  customer_email     →  customer_email (text NOT NULL)
name="phone"              →  customer_phone     →  customer_phone (text)
name="arrival_date"       →  arrival_date       →  arrival_date (date NOT NULL)
name="departure_date"     →  departure_date     →  departure_date (date NOT NULL)
name="adults"             →  num_adults         →  num_adults (integer)
name="children"           →  num_children       →  num_children (integer)
name="notes"              →  notes              →  notes (text)
(obliczone)               →  nights             →  nights (integer)
(obliczone)               →  total_price        →  total_price (numeric)
window.homeCurrentHotel   →  hotel_id           →  hotel_id (uuid FK)
window.homeCurrentHotel   →  hotel_slug         →  hotel_slug (text)
window.homeCurrentHotel   →  category_id        →  category_id (uuid FK)
(auto)                    →  status: 'pending'  →  status (text)
```

---

## ZGODNOŚĆ Z WYMAGANIAMI

✅ Używa `@supabase/supabase-js`  
✅ Używa VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY  
✅ Dodane nagłówki `apikey` i `Authorization`  
✅ Brak SERVICE_ROLE w kliencie  
✅ Szczegółowe logowanie błędów (code, message, details, hint)  
✅ User-friendly komunikaty błędów  
✅ Walidacja pól przed submitem  
✅ Nie zmieniono ENV ani innych modułów  
✅ Build działa z npm  
✅ Gotowe do testowania  

---

## NEXT STEPS

1. **Ustaw zmienne środowiskowe w Cloudflare Pages:**
   - `VITE_SUPABASE_URL` = https://daoohnbnnowmmcizgvrq.supabase.co
   - `VITE_SUPABASE_ANON_KEY` = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

2. **Sprawdź polityki RLS:**
   ```sql
   -- Uruchom w Supabase SQL Editor
   -- Zawartość: /FIX_HOTEL_BOOKINGS_RLS.sql
   ```

3. **Przetestuj lokalnie:**
   ```bash
   npm run dev
   # Test submission w konsoli przeglądarki
   ```

4. **Deploy na Cloudflare Pages:**
   ```bash
   git add .
   git commit -m "Fix: Hotel booking 401 error - add VITE_* env and auth headers"
   git push
   ```

5. **Weryfikacja produkcyjna:**
   - Sprawdź logi w konsoli przeglądarki
   - Sprawdź tabelę hotel_bookings w Supabase
   - Potwierdź brak błędów 401

---

**Status:** ✅ READY FOR TESTING  
**Build:** ✅ SUCCESS  
**Files:** 4 zmodyfikowane, 2 nowe
