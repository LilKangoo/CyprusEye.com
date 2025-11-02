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
