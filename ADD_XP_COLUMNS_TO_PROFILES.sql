-- =====================================================
-- Dodaj kolumny XP i LEVEL do istniejącej tabeli profiles
-- Uruchom TYLKO jeśli tych kolumn jeszcze nie ma
-- =====================================================

-- Sprawdź czy kolumny już istnieją
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('xp', 'level', 'visited_places')
ORDER BY column_name;

-- Jeśli wynik jest pusty lub brakuje kolumn, uruchom poniższe:

-- Dodaj kolumnę XP (jeśli nie istnieje)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'xp'
  ) THEN
    ALTER TABLE profiles ADD COLUMN xp INTEGER DEFAULT 0;
    RAISE NOTICE '✅ Dodano kolumnę xp';
  ELSE
    RAISE NOTICE 'ℹ️ Kolumna xp już istnieje';
  END IF;
END $$;

-- Dodaj kolumnę LEVEL (jeśli nie istnieje)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'level'
  ) THEN
    ALTER TABLE profiles ADD COLUMN level INTEGER DEFAULT 1;
    RAISE NOTICE '✅ Dodano kolumnę level';
  ELSE
    RAISE NOTICE 'ℹ️ Kolumna level już istnieje';
  END IF;
END $$;

-- Dodaj kolumnę VISITED_PLACES (tablica odwiedzonych miejsc)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'visited_places'
  ) THEN
    ALTER TABLE profiles ADD COLUMN visited_places TEXT[] DEFAULT '{}';
    RAISE NOTICE '✅ Dodano kolumnę visited_places';
  ELSE
    RAISE NOTICE 'ℹ️ Kolumna visited_places już istnieje';
  END IF;
END $$;

-- Sprawdź wynik
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('xp', 'level', 'visited_places')
ORDER BY column_name;

-- =====================================================
-- Gotowe! Kolumny dodane.
-- =====================================================

SELECT '✅ Sprawdzono i dodano brakujące kolumny do profiles' as status;

-- =====================================================
-- SEKCJA NAPRAWCZA: Popraw typy kolumn i przelicz level'e
-- Uruchom jeśli kolumny XP/LEVEL są typu TEXT zamiast INTEGER
-- lub jeśli level'e są źle obliczone
-- =====================================================

-- Krok 1: Napraw typ kolumny XP (z TEXT na INTEGER jeśli trzeba)
DO $$ 
BEGIN
  -- Sprawdź czy XP jest typu TEXT
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
      AND column_name = 'xp' 
      AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE profiles 
      ALTER COLUMN xp TYPE INTEGER USING xp::integer;
    RAISE NOTICE '✅ Zmieniono typ kolumny xp z TEXT na INTEGER';
  ELSE
    RAISE NOTICE 'ℹ️ Kolumna xp już jest typu INTEGER';
  END IF;
END $$;

-- Krok 2: Napraw typ kolumny LEVEL (z TEXT na INTEGER jeśli trzeba)
-- LEVEL może być "generated column" - musimy najpierw usunąć tę definicję
DO $$ 
BEGIN
  -- Sprawdź czy LEVEL jest generated column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
      AND column_name = 'level' 
      AND is_generated = 'ALWAYS'
  ) THEN
    -- Usuń status generated column
    ALTER TABLE profiles 
      ALTER COLUMN level DROP EXPRESSION;
    RAISE NOTICE '⚙️ Usunięto status generated column z kolumny level';
  END IF;
  
  -- Sprawdź czy LEVEL jest typu TEXT
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
      AND column_name = 'level' 
      AND data_type IN ('text', 'character varying')
  ) THEN
    ALTER TABLE profiles 
      ALTER COLUMN level TYPE INTEGER USING level::integer;
    RAISE NOTICE '✅ Zmieniono typ kolumny level z TEXT na INTEGER';
  ELSE
    RAISE NOTICE 'ℹ️ Kolumna level już jest typu INTEGER';
  END IF;
END $$;

-- Krok 3: Ustaw domyślne wartości (jeśli nie są ustawione)
ALTER TABLE profiles 
  ALTER COLUMN xp SET DEFAULT 0;

ALTER TABLE profiles 
  ALTER COLUMN level SET DEFAULT 1;

-- Krok 4: Napraw NULL wartości
UPDATE profiles
SET 
  xp = 0,
  level = 1,
  updated_at = NOW()
WHERE xp IS NULL OR level IS NULL;

-- Krok 5: PRZELICZ WSZYSTKIE LEVEL'E według poprawnej formuły
-- Formuła: level = floor(xp / 1000) + 1
-- Przykłady:
--   0 XP → Level 1
--   500 XP → Level 1
--   1000 XP → Level 2
--   1390 XP → Level 2
--   2000 XP → Level 3

UPDATE profiles
SET 
  level = GREATEST(1, FLOOR(xp / 1000.0) + 1),
  updated_at = NOW()
WHERE xp IS NOT NULL;

-- =====================================================
-- Weryfikacja naprawy
-- =====================================================

-- Pokaż wszystkie profile z obliczonym poprawnym levelem
SELECT 
  email,
  username,
  xp,
  level as current_level,
  GREATEST(1, FLOOR(xp / 1000.0) + 1) as correct_level,
  CASE 
    WHEN level = GREATEST(1, FLOOR(xp / 1000.0) + 1) THEN '✅ OK'
    ELSE '❌ BŁĘDNY (przed naprawą)'
  END as status
FROM profiles
ORDER BY xp DESC;

-- Pokaż typy kolumn po naprawie
SELECT 
  column_name, 
  data_type,
  column_default,
  CASE 
    WHEN column_name = 'xp' AND data_type = 'integer' THEN '✅ OK'
    WHEN column_name = 'level' AND data_type = 'integer' THEN '✅ OK'
    ELSE '⚠️ Sprawdź typ'
  END as type_status
FROM information_schema.columns
WHERE table_name = 'profiles' 
  AND column_name IN ('xp', 'level')
ORDER BY ordinal_position;

SELECT '✅ Naprawa typów i level''ów zakończona' as final_status;
