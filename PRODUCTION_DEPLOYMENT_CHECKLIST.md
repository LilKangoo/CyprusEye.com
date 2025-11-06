# 🚀 Production Deployment Checklist - Car Rentals

## ⚠️ CRITICAL: Migracje które MUSZĄ być uruchomione na production Supabase

**Jeśli rezerwacje NIE działają na https://cypruseye.com, wykonaj poniższe kroki:**

---

## 📋 KROK 1: Sprawdź czy tabele istnieją w Supabase Dashboard

1. Zaloguj się do **Supabase Dashboard**: https://supabase.com/dashboard
2. Wybierz projekt: `daoohnbnnowmmcizgvrq`
3. Kliknij **Table Editor** (lewa strona menu)
4. Sprawdź czy istnieją tabele:
   - ✅ `car_offers` - oferty aut
   - ✅ `car_bookings` - rezerwacje

**Jeśli NIE MA tych tabel** → przejdź do KROK 2

**Jeśli tabele ISTNIEJĄ** → przejdź do KROK 3

---

## 📋 KROK 2: Uruchom migracje SQL na production

### A) Przez Supabase Dashboard SQL Editor

1. W Supabase Dashboard kliknij **SQL Editor** (lewa strona)
2. Kliknij **New Query**
3. Uruchom **KOLEJNO** poniższe migracje:

#### **Migration 1: Car Offers Table**
```sql
-- Lokalizacja: supabase/migrations/002_update_car_system.sql
-- Uruchom całą zawartość tego pliku
```

👉 **Skopiuj całą zawartość** z `supabase/migrations/002_update_car_system.sql` i uruchom w SQL Editor

---

#### **Migration 2: Car Images Support**
```sql
-- Lokalizacja: supabase/migrations/006_car_images_support.sql
-- Uruchom całą zawartość tego pliku
```

👉 **Skopiuj całą zawartość** z `supabase/migrations/006_car_images_support.sql` i uruchom

---

#### **Migration 3: Car Images Storage**
```sql
-- Lokalizacja: supabase/migrations/007_car_images_storage.sql
-- Uruchom całą zawartość tego pliku
```

👉 **Skopiuj całą zawartość** z `supabase/migrations/007_car_images_storage.sql` i uruchom

---

#### **Migration 4: Car Bookings Table** ⭐ **NAJWAŻNIEJSZE**
```sql
-- Lokalizacja: supabase/migrations/008_car_bookings_table.sql
-- Uruchom całą zawartość tego pliku
```

👉 **Skopiuj całą zawartość** z `supabase/migrations/008_car_bookings_table.sql` i uruchom

**Ta migracja tworzy:**
- ✅ Tabelę `car_bookings` do przechowywania rezerwacji
- ✅ RLS policies pozwalające anonymous users na INSERT
- ✅ RLS policies dla adminów (SELECT, UPDATE, DELETE)
- ✅ Triggery `updated_at`
- ✅ Funkcję statystyk `admin_get_car_booking_stats()`

---

#### **Migration 5: Fix Car Offers Public Access** ⭐ **KRYTYCZNE**
```sql
-- Lokalizacja: supabase/migrations/009_fix_car_offers_public_access.sql
-- Uruchom całą zawartość tego pliku
```

👉 **Skopiuj całą zawartość** z `supabase/migrations/009_fix_car_offers_public_access.sql` i uruchom

**Ta migracja:**
- ✅ Pozwala anonymous users (niezalogowanym) czytać `car_offers`
- ✅ Bez tego **auta NIE BĘDĄ się ładować** na stronie publicznej

---

### B) Weryfikacja po migracji

W SQL Editor uruchom:

```sql
-- Sprawdź czy tabele istnieją
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('car_offers', 'car_bookings');

-- Sprawdź RLS policies dla car_offers
SELECT * FROM pg_policies WHERE tablename = 'car_offers';

-- Sprawdź RLS policies dla car_bookings
SELECT * FROM pg_policies WHERE tablename = 'car_bookings';
```

**Powinno zwrócić:**
- ✅ 2 tabele (car_offers, car_bookings)
- ✅ Policy: "car_offers_public_select" dla anon
- ✅ Policy: "Anyone can create bookings" dla anon na car_bookings

---

## 📋 KROK 3: Dodaj przykładowe auta (jeśli tabela jest pusta)

W SQL Editor uruchom:

```sql
-- Sprawdź ile aut jest w bazie
SELECT COUNT(*) FROM car_offers WHERE location = 'paphos';
```

**Jeśli zwróci 0** → dodaj przykładowe auta:

```sql
-- Przykładowe auto dla Paphos
INSERT INTO car_offers (
  location,
  car_type,
  car_model,
  transmission,
  fuel_type,
  seats,
  base_price,
  price_3_days,
  price_4_6_days,
  price_7_10_days,
  price_10plus_days,
  is_available,
  features,
  description
) VALUES (
  'paphos',
  'Economy',
  'Mitsubishi Mirage',
  'Automatic',
  'Petrol',
  4,
  35.00,
  35.00,
  32.00,
  30.00,
  28.00,
  true,
  '["Air Conditioning", "Bluetooth", "4 Doors", "ABS", "Airbags"]',
  'Perfect for city driving and exploring Cyprus'
);

-- Dodaj więcej aut według potrzeby...
```

---

## 📋 KROK 4: Sprawdź Storage dla zdjęć aut

1. W Supabase Dashboard kliknij **Storage** (lewa strona)
2. Sprawdź czy istnieje bucket: `car-images`
3. **Jeśli NIE MA** → utwórz:
   - Kliknij "New Bucket"
   - Name: `car-images`
   - Public: **YES** ✅ (ważne!)
   - Kliknij "Create bucket"

4. Ustaw **Public access policy**:

Przejdź do **Policies** dla `car-images` bucket i dodaj:

```sql
-- Allow public access to car-images
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'car-images');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'car-images');
```

---

## 📋 KROK 5: Deploy kodu na production

### A) Build lokalnie

```bash
cd /Users/kangur/Documents/GitHub/CyprusEye.com/CyprusEye.com
npm run build
```

**Sprawdź czy w `/dist/` są:**
- ✅ `autopfo.html`
- ✅ `js/car-rental-paphos.js`
- ✅ `js/car-reservation.js`
- ✅ `js/supabaseClient.js`
- ✅ `js/config.js`
- ✅ `_headers`

---

### B) Deploy na Netlify/Cloudflare

```bash
git add -A
git commit -m "Fix production deployment - add car rentals"
git push origin main
```

**Cloudflare Pages automatycznie zdeployuje** z `main` branch.

---

## 📋 KROK 6: Testowanie na production

### A) Test ładowania aut

1. Otwórz https://cypruseye.com/autopfo.html
2. **Otwórz DevTools** (F12)
3. **Kliknij Console**
4. Odśwież stronę (Ctrl+R / Cmd+R)

**Sprawdź w konsoli:**

✅ **DOBRE znaki:**
```
Fleet loaded: [{...}, {...}]  // Array z autami
```

❌ **ZŁE znaki:**
```
Error loading fleet: ...
RLS policy violation
CORS error
```

**Jeśli błędy CORS/RLS** → wróć do KROK 2 Migration 5

---

### B) Test formularza rezerwacji

1. Na https://cypruseye.com/autopfo.html przewiń do formularza
2. Wypełnij wszystkie pola:
   - Imię: Jan Testowy
   - Email: test@example.com
   - Telefon: +48 123 456 789
   - Auto: (wybierz z listy)
   - Daty: dzisiaj + 7 dni
3. Kliknij **"Wyślij rezerwację"**

**Oczekiwany rezultat:**
✅ Toast: "Rezerwacja wysłana pomyślnie!"
✅ Numer rezerwacji: `#ABC12345`

**Jeśli błąd:**
❌ Check konsoli DevTools
❌ Sprawdź czy Migration 4 (car_bookings) jest uruchomiona

---

### C) Test panelu admin

1. Zaloguj się: https://cypruseye.com/admin/
2. Kliknij **Cars** w menu
3. Sprawdź zakładkę **Bookings**

**Powinno być widać:**
✅ Rezerwację testową z kroku B
✅ Dane klienta
✅ Przycisk "View"

---

## 🔍 DIAGNOZOWANIE PROBLEMÓW

### Problem: "Auta nie ładują się na stronie"

**Rozwiązanie:**
1. Sprawdź Console w DevTools
2. Jeśli: `RLS policy violation` → Migration 5 nie jest uruchomiona
3. Jeśli: `CORS error` → Sprawdź `_headers` file deployment
4. Jeśli: `Table doesn't exist` → Migration 2 nie jest uruchomiona

---

### Problem: "Formularz nie działa - błąd przy submit"

**Rozwiązanie:**
1. Sprawdź Console w DevTools
2. Jeśli: `relation "car_bookings" does not exist` → Migration 4 nie jest uruchomiona
3. Jeśli: `RLS policy violation` → RLS policy "Anyone can create bookings" brakuje
4. Uruchom ponownie Migration 4

---

### Problem: "Admin panel nie pokazuje rezerwacji"

**Rozwiązanie:**
1. Sprawdź czy użytkownik ma `is_admin = true` w tabeli `profiles`
2. SQL:
```sql
-- Ustaw siebie jako admina
UPDATE profiles 
SET is_admin = true 
WHERE email = 'twoj-email@example.com';
```
3. Wyloguj się i zaloguj ponownie

---

### Problem: "CSP errors w konsoli"

**Rozwiązanie:**
1. Sprawdź czy `_headers` jest w `/dist/`
2. Sprawdź deployment na Cloudflare - czy headers są aktywne
3. CSP powinien zawierać:
   - `https://esm.sh` - dla ES modules
   - `https://*.supabase.co` - dla Supabase
   - `'unsafe-inline'` - dla inline scripts

---

## ✅ CHECKLIST KOŃCOWY

**Przed powiedzeniem "działa na production", upewnij się że:**

- [ ] Migration 2 (car_offers) uruchomiona ✅
- [ ] Migration 4 (car_bookings) uruchomiona ✅
- [ ] Migration 5 (public access) uruchomiona ✅
- [ ] Bucket `car-images` istnieje i jest publiczny ✅
- [ ] Przynajmniej 1 auto w `car_offers` ✅
- [ ] `_headers` zdeployowany z CSP ✅
- [ ] Build wykonany (`npm run build`) ✅
- [ ] Kod wypushowany na GitHub ✅
- [ ] Cloudflare zdeployował (check Deployments) ✅
- [ ] Test: Auta ładują się na /autopfo.html ✅
- [ ] Test: Formularz wysyła rezerwację ✅
- [ ] Test: Rezerwacja pojawia się w admin panel ✅

---

## 📞 KONTAKT W RAZIE PROBLEMÓW

Jeśli po wykonaniu wszystkich kroków nadal nie działa:

1. **Sprawdź logi Cloudflare Pages:**
   - Dashboard → Pages → cypruseye → Deployments
   - Kliknij na najnowszy deployment
   - Sprawdź "Build logs" i "Deployment logs"

2. **Sprawdź Network tab w DevTools:**
   - F12 → Network
   - Odśwież stronę
   - Szukaj requestów do Supabase (czerwone = błąd)
   - Kliknij na błędny request → Response → sprawdź szczegóły

3. **Export błędu:**
   - Skopiuj błąd z konsoli
   - Zrób screenshot Network tab
   - Wyślij do developera

---

## 🎯 SZYBKI TEST PRODUCTION

**1 minuta test:**

```bash
# Terminal
curl https://cypruseye.com/autopfo.html | grep "car-rental-paphos.js"
# Powinno zwrócić: <script type="module" src="js/car-rental-paphos.js"></script>

# DevTools Console (na https://cypruseye.com/autopfo.html)
window.supabase
# Powinno zwrócić: Object {from: ƒ, ...}

# Test ładowania
fetch('https://daoohnbnnowmmcizgvrq.supabase.co/rest/v1/car_offers?select=*&is_available=eq.true&location=eq.paphos', {
  headers: {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhb29obmJubm93bW1jaXpndnJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjkwNDksImV4cCI6MjA3NjM0NTA0OX0.AJrmxrk18yWxL1_Ejk_SZ1-X04YxN4C8LXCn9c3yFSM'
  }
}).then(r => r.json()).then(console.log)
# Powinno zwrócić: Array z autami
```

---

**Good luck! 🚀**
