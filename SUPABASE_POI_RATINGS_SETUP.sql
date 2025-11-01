-- ============================================
-- SYSTEM OCEN MIEJSC - SUPABASE SQL
-- ============================================
-- Data: 1 Listopad 2025
-- 
-- Ten plik zawiera SQL do utworzenia systemu ocen/polubień miejsc
-- Wykonaj ten kod w Supabase SQL Editor
-- ============================================

-- 1. TABELA OCEN MIEJSC
CREATE TABLE IF NOT EXISTS poi_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poi_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Jeden użytkownik może ocenić dane miejsce tylko raz
  UNIQUE(poi_id, user_id)
);

-- 2. INDEKSY DLA WYDAJNOŚCI
CREATE INDEX IF NOT EXISTS idx_poi_ratings_poi_id ON poi_ratings(poi_id);
CREATE INDEX IF NOT EXISTS idx_poi_ratings_user_id ON poi_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_poi_ratings_created_at ON poi_ratings(created_at DESC);

-- 3. ROW LEVEL SECURITY (RLS)
ALTER TABLE poi_ratings ENABLE ROW LEVEL SECURITY;

-- Usuń istniejące polityki jeśli istnieją
DROP POLICY IF EXISTS "Anyone can view ratings" ON poi_ratings;
DROP POLICY IF EXISTS "Authenticated users can insert their own ratings" ON poi_ratings;
DROP POLICY IF EXISTS "Users can update their own ratings" ON poi_ratings;
DROP POLICY IF EXISTS "Users can delete their own ratings" ON poi_ratings;

-- Polityka: Wszyscy mogą czytać oceny
CREATE POLICY "Anyone can view ratings"
  ON poi_ratings
  FOR SELECT
  USING (true);

-- Polityka: Zalogowani użytkownicy mogą dodawać oceny
CREATE POLICY "Authenticated users can insert their own ratings"
  ON poi_ratings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Polityka: Użytkownicy mogą aktualizować swoje własne oceny
CREATE POLICY "Users can update their own ratings"
  ON poi_ratings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Polityka: Użytkownicy mogą usuwać swoje własne oceny
CREATE POLICY "Users can delete their own ratings"
  ON poi_ratings
  FOR DELETE
  USING (auth.uid() = user_id);

-- 4. FUNKCJA DO AUTOMATYCZNEGO AKTUALIZOWANIA updated_at
CREATE OR REPLACE FUNCTION update_poi_ratings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. TRIGGER DO AUTOMATYCZNEGO AKTUALIZOWANIA updated_at
DROP TRIGGER IF EXISTS poi_ratings_updated_at_trigger ON poi_ratings;
CREATE TRIGGER poi_ratings_updated_at_trigger
  BEFORE UPDATE ON poi_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_poi_ratings_updated_at();

-- 6. WIDOK DO STATYSTYK OCEN (agregacja)
CREATE OR REPLACE VIEW poi_rating_stats AS
SELECT 
  poi_id,
  COUNT(*) as total_ratings,
  ROUND(AVG(rating)::numeric, 2) as average_rating,
  COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star,
  COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star,
  COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star,
  COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star,
  COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star,
  MAX(updated_at) as last_rated_at
FROM poi_ratings
GROUP BY poi_id;

-- 7. GRANT PERMISSIONS NA WIDOK
GRANT SELECT ON poi_rating_stats TO authenticated;
GRANT SELECT ON poi_rating_stats TO anon;

-- ============================================
-- ZAKOŃCZONO INSTALACJĘ
-- ============================================

-- WERYFIKACJA:
-- Uruchom to aby sprawdzić czy tabela została utworzona:
SELECT 
  table_name, 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'poi_ratings' 
ORDER BY ordinal_position;

-- Sprawdź widok:
SELECT * FROM poi_rating_stats LIMIT 5;

-- ============================================
-- PRZYKŁADOWE UŻYCIE (dla testów)
-- ============================================

-- Dodaj testową ocenę (zamień user_id na prawdziwy UUID z auth.users):
-- INSERT INTO poi_ratings (poi_id, user_id, rating)
-- VALUES ('nissi-beach', 'twój-user-uuid-tutaj', 5);

-- Pobierz statystyki dla miejsca:
-- SELECT * FROM poi_rating_stats WHERE poi_id = 'nissi-beach';

-- Pobierz ocenę użytkownika dla miejsca:
-- SELECT rating FROM poi_ratings 
-- WHERE poi_id = 'nissi-beach' AND user_id = 'twój-user-uuid-tutaj';
