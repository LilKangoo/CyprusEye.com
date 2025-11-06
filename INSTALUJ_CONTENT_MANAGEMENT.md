# 🔧 Instalacja Content Management - Instrukcja Krok po Kroku

## ❌ Problem
Panel admin Content Management nie ładuje danych i pokazuje błędy w konsoli.

## ✅ Rozwiązanie

### Krok 1: Otwórz Supabase SQL Editor

1. Przejdź do: https://supabase.com/dashboard
2. Wybierz swój projekt CyprusEye
3. W menu bocznym kliknij **SQL Editor**
4. Kliknij **New query** (nowe zapytanie)

### Krok 2: Uruchom Instalację

1. Otwórz plik: **`ADMIN_CONTENT_COMPLETE_INSTALL.sql`**
2. Skopiuj CAŁĄ zawartość pliku (Ctrl+A, Ctrl+C)
3. Wklej do SQL Editor w Supabase (Ctrl+V)
4. Kliknij **RUN** (lub naciśnij F5)

### Krok 3: Sprawdź Wyniki

Po uruchomieniu powinieneś zobaczyć komunikaty:

```
NOTICE:  ✅ Function is_current_user_admin() created
NOTICE:  ✅ Table admin_actions created
NOTICE:  ✅ All 8 content management functions created
NOTICE:  
NOTICE:  =====================================================
NOTICE:  ✅ INSTALLATION COMPLETE!
NOTICE:  =====================================================
```

### Krok 4: Zweryfikuj Instalację

Uruchom to zapytanie w SQL Editor:

```sql
-- Sprawdź czy wszystkie funkcje istnieją
SELECT 
  proname as function_name
FROM pg_proc
WHERE proname IN (
  'is_current_user_admin',
  'admin_get_all_comments',
  'admin_get_comment_details',
  'admin_update_comment',
  'admin_delete_comment_photo',
  'admin_delete_comment',
  'admin_get_all_photos',
  'admin_get_detailed_content_stats',
  'admin_bulk_comment_operation'
)
ORDER BY proname;
```

Powinno zwrócić **9 wierszy** (wszystkie funkcje).

### Krok 5: Sprawdź Admin Permissions

```sql
-- Sprawdź czy jesteś adminem
SELECT 
  id,
  email,
  username,
  is_admin
FROM profiles
WHERE email = 'lilkangoomedia@gmail.com';
```

**is_admin** musi być **TRUE** (true).

Jeśli jest FALSE, ustaw na TRUE:

```sql
UPDATE profiles
SET is_admin = TRUE
WHERE email = 'lilkangoomedia@gmail.com';
```

### Krok 6: Testuj Panel Admin

1. Otwórz: https://cypruseye.com/admin
2. Zaloguj się jako lilkangoomedia@gmail.com
3. Kliknij zakładkę **Content**
4. Powinieneś zobaczyć:
   - ✅ 4 karty ze statystykami (zamiast "Loading...")
   - ✅ Listę komentarzy (zamiast błędu)
   - ✅ Search bar działający
   - ✅ Przyciski akcji na każdym komentarzu

### Krok 7: Testuj Funkcje

Spróbuj:

1. **Wyszukiwanie**: Wpisz coś w search bar i kliknij Search
2. **View Details**: Kliknij ikonę oka 👁️ przy komentarzu
3. **Edit**: Kliknij ikonę ołówka ✏️ i zmień tekst
4. **Delete**: Kliknij ikonę kosza 🗑️ (potwierdź usunięcie)

---

## 🐛 Troubleshooting

### Problem: "Function is_current_user_admin does not exist"

**Rozwiązanie:**
1. Upewnij się że uruchomiłeś CAŁY plik `ADMIN_CONTENT_COMPLETE_INSTALL.sql`
2. Sprawdź czy nie było błędów podczas wykonywania
3. Spróbuj uruchomić ponownie

### Problem: "Table admin_actions does not exist"

**Rozwiązanie:**
Tabela została stworzona w pliku instalacyjnym. Sprawdź:

```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'admin_actions'
);
```

Jeśli zwraca `false`, uruchom ponownie instalację.

### Problem: "Access denied: Admin only"

**Rozwiązanie:**
Nie masz uprawnień admina. Ustaw je:

```sql
UPDATE profiles
SET is_admin = TRUE
WHERE email = 'lilkangoomedia@gmail.com';
```

Potem wyloguj się i zaloguj ponownie.

### Problem: "No data displayed" / Puste statystyki

**Rozwiązanie:**
1. Otwórz Console przeglądarki (F12)
2. Przejdź do zakładki Console
3. Poszukaj błędów (czerwony tekst)
4. Skopiuj błąd i sprawdź który krok nie został wykonany

**Możliwe przyczyny:**
- Brak komentarzy w bazie (normalne jeśli świeża instalacja)
- Funkcje SQL nie zostały zainstalowane
- Brak połączenia z Supabase

---

## 📋 Checklist - Co Musi Być Zrobione

- [ ] Plik `ADMIN_CONTENT_COMPLETE_INSTALL.sql` uruchomiony w Supabase
- [ ] Wszystkie 9 funkcji istnieją (sprawdzone zapytaniem)
- [ ] Tabela `admin_actions` istnieje
- [ ] Twoje konto ma `is_admin = TRUE`
- [ ] Panel admin ładuje się bez błędów
- [ ] Zakładka Content pokazuje statystyki
- [ ] Lista komentarzy się wyświetla
- [ ] Możesz kliknąć View Details na komentarzu
- [ ] Możesz edytować komentarz
- [ ] Toast notifications działają

---

## 🎯 Szybki Test

Uruchom to w SQL Editor:

```sql
-- QUICK TEST - wszystko w jednym
DO $$
DECLARE
  admin_exists BOOLEAN;
  func_count INTEGER;
  table_exists BOOLEAN;
BEGIN
  -- Test 1: Admin user
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE email = 'lilkangoomedia@gmail.com' 
    AND is_admin = TRUE
  ) INTO admin_exists;
  
  -- Test 2: Functions
  SELECT COUNT(*) INTO func_count
  FROM pg_proc
  WHERE proname LIKE 'admin_%' OR proname = 'is_current_user_admin';
  
  -- Test 3: Table
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'admin_actions'
  ) INTO table_exists;
  
  -- Results
  RAISE NOTICE '================================================';
  RAISE NOTICE 'CONTENT MANAGEMENT - QUICK TEST';
  RAISE NOTICE '================================================';
  
  IF admin_exists THEN
    RAISE NOTICE '✅ Admin user configured';
  ELSE
    RAISE NOTICE '❌ Admin user NOT configured';
  END IF;
  
  RAISE NOTICE 'Functions installed: % (need at least 9)', func_count;
  
  IF func_count >= 9 THEN
    RAISE NOTICE '✅ All functions installed';
  ELSE
    RAISE NOTICE '❌ Missing functions - run ADMIN_CONTENT_COMPLETE_INSTALL.sql';
  END IF;
  
  IF table_exists THEN
    RAISE NOTICE '✅ admin_actions table exists';
  ELSE
    RAISE NOTICE '❌ admin_actions table missing';
  END IF;
  
  RAISE NOTICE '================================================';
  
  IF admin_exists AND func_count >= 9 AND table_exists THEN
    RAISE NOTICE '✅✅✅ ALL TESTS PASSED - Content Management is ready!';
  ELSE
    RAISE NOTICE '❌ SOME TESTS FAILED - See above for details';
  END IF;
  
  RAISE NOTICE '================================================';
END $$;
```

Jeśli wszystkie testy przechodzą ✅, panel powinien działać!

---

## 📞 Dalsze Problemy?

Jeśli nadal nie działa:

1. Wyczyść cache przeglądarki (Ctrl+Shift+Delete)
2. Wyloguj się i zaloguj ponownie
3. Sprawdź Console (F12) i skopiuj błędy
4. Sprawdź czy Supabase URL i ANON_KEY są prawidłowe w `/js/supabaseClient.js`

---

**Ostatnia aktualizacja:** 2024  
**Wersja:** 1.0
