# ❌ PERMISSION DENIED FOR TABLE POIS

## 🔴 **BŁĄD:**
```
permission denied for table pois
```

## 🔍 **PRZYCZYNA:**

Admin panel używa **normalnego klienta Supabase** (anon key), który:
- Ma włączone Row Level Security (RLS)
- Nie ma uprawnień do UPDATE na tabeli `pois`
- Potrzebuje policy która pozwala adminom edytować POI

---

## 🔧 **ROZWIĄZANIE:**

### **OPCJA 1: Dodaj RLS Policy dla adminów (ZALECANE)**

Uruchom w **Supabase SQL Editor**:

```sql
-- Włącz RLS jeśli nie jest
ALTER TABLE pois ENABLE ROW LEVEL SECURITY;

-- Usuń stare policy jeśli istnieją
DROP POLICY IF EXISTS "Admin users can do everything on pois" ON pois;
DROP POLICY IF EXISTS "Everyone can view published pois" ON pois;

-- Policy 1: Wszyscy mogą czytać opublikowane POI
CREATE POLICY "Everyone can view published pois" 
ON pois 
FOR SELECT 
USING (status = 'published' OR auth.role() = 'authenticated');

-- Policy 2: Admini mogą wszystko
CREATE POLICY "Admin users can do everything on pois" 
ON pois 
FOR ALL 
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE is_admin = true
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM profiles WHERE is_admin = true
  )
);
```

### **OPCJA 2: Daj uprawnienia wszystkim zalogowanym (PROSTSZE, ALE MNIEJ BEZPIECZNE)**

```sql
-- Daj uprawnienia
GRANT SELECT, INSERT, UPDATE, DELETE ON pois TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Usuń RLS (opcjonalnie)
ALTER TABLE pois DISABLE ROW LEVEL SECURITY;
```

### **OPCJA 3: Tymczasowo wyłącz RLS (TYLKO DO TESTÓW!)**

```sql
-- ⚠️ NIE UŻYWAJ NA PRODUKCJI!
ALTER TABLE pois DISABLE ROW LEVEL SECURITY;
```

---

## 🔍 **JAK SPRAWDZIĆ CZY MASZ USTAWIONĄ KOLUMNĘ `is_admin`:**

```sql
-- Sprawdź czy kolumna istnieje
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name = 'is_admin';

-- Sprawdź swoją wartość is_admin
SELECT id, email, is_admin 
FROM profiles 
WHERE id = auth.uid();

-- Ustaw siebie jako admina
UPDATE profiles 
SET is_admin = true 
WHERE id = auth.uid();
```

---

## 📋 **KROK PO KROKU:**

### **1. Sprawdź czy masz kolumnę `is_admin` w tabeli `profiles`:**

```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'is_admin';
```

**Jeśli NIE MA kolumny:**
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
```

### **2. Ustaw siebie jako admina:**

```sql
-- Znajdź swój user ID
SELECT auth.uid();

-- Ustaw is_admin = true
UPDATE profiles 
SET is_admin = true 
WHERE id = auth.uid();

-- Sprawdź
SELECT id, email, is_admin FROM profiles WHERE is_admin = true;
```

### **3. Dodaj RLS Policy:**

```sql
-- Włącz RLS
ALTER TABLE pois ENABLE ROW LEVEL SECURITY;

-- Dodaj policy
CREATE POLICY "Admin users can do everything on pois" 
ON pois 
FOR ALL 
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE is_admin = true
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM profiles WHERE is_admin = true
  )
);
```

### **4. Przetestuj:**

Odśwież stronę i spróbuj edytować POI ponownie.

---

## 🧪 **WERYFIKACJA:**

### **Sprawdź obecne policies:**
```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'pois';
```

### **Sprawdź czy RLS jest włączone:**
```sql
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'pois';
```

### **Sprawdź uprawnienia:**
```sql
SELECT 
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'pois';
```

---

## ⚡ **SZYBKIE ROZWIĄZANIE (TESTOWE):**

Jeśli chcesz **szybko przetestować** bez RLS:

```sql
-- Wyłącz RLS na czas testów
ALTER TABLE pois DISABLE ROW LEVEL SECURITY;

-- Daj pełne uprawnienia
GRANT ALL ON pois TO authenticated;
```

⚠️ **UWAGA:** Pamiętaj żeby **włączyć RLS z powrotem** przed produkcją!

```sql
-- Włącz RLS z powrotem
ALTER TABLE pois ENABLE ROW LEVEL SECURITY;

-- Dodaj policy dla adminów
CREATE POLICY "Admin full access" 
ON pois 
FOR ALL 
USING (
  auth.uid() IN (SELECT id FROM profiles WHERE is_admin = true)
);
```

---

## 📁 **PLIKI DO URUCHOMIENIA:**

Stworzyłem plik: `FIX_POIS_PERMISSIONS.sql`

Uruchom go w **Supabase SQL Editor**.

---

## ✅ **PO NAPRAWIE:**

1. ✅ Odśwież stronę admin panelu
2. ✅ Spróbuj edytować POI
3. ✅ Powinno zapisać się bez błędu

---

**Data:** 2025-01-11 02:48 AM  
**Status:** ⚠️ CZEKA NA URUCHOMIENIE SQL
