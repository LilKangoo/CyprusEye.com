-- =====================================================
-- Tabela completed_tasks - zadania ukończone przez użytkowników
-- Uruchom w Supabase SQL Editor
-- =====================================================

-- Utwórz tabelę completed_tasks
CREATE TABLE IF NOT EXISTS completed_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, task_id)
);

-- Index dla szybkich zapytań
CREATE INDEX IF NOT EXISTS idx_completed_tasks_user_id ON completed_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_completed_tasks_task_id ON completed_tasks(task_id);

-- RLS (Row Level Security)
ALTER TABLE completed_tasks ENABLE ROW LEVEL SECURITY;

-- Usuń stare policies jeśli istnieją
DROP POLICY IF EXISTS "Users can view own completed tasks" ON completed_tasks;
DROP POLICY IF EXISTS "Users can insert own completed tasks" ON completed_tasks;
DROP POLICY IF EXISTS "Users can delete own completed tasks" ON completed_tasks;

-- Policy: Użytkownik może odczytać tylko swoje zadania
CREATE POLICY "Users can view own completed tasks"
  ON completed_tasks
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Użytkownik może dodawać swoje zadania
CREATE POLICY "Users can insert own completed tasks"
  ON completed_tasks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Użytkownik może usuwać swoje zadania
CREATE POLICY "Users can delete own completed tasks"
  ON completed_tasks
  FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- RPC Function: award_task - przyznaj XP za zadanie
-- =====================================================

CREATE OR REPLACE FUNCTION award_task(p_task_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_task_xp INTEGER;
  v_current_xp INTEGER;
  v_new_xp INTEGER;
  v_current_level INTEGER;
  v_new_level INTEGER;
BEGIN
  -- Pobierz ID zalogowanego użytkownika
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Sprawdź czy zadanie jest w completed_tasks
  -- (Frontend wstawia je PRZED wywołaniem tej funkcji)
  IF NOT EXISTS (
    SELECT 1 FROM completed_tasks 
    WHERE user_id = v_user_id AND task_id = p_task_id
  ) THEN
    RAISE EXCEPTION 'Task not found in completed_tasks. Frontend should INSERT first.';
  END IF;

  -- Mapowanie task_id na XP (zgodne z js/data-tasks.js)
  v_task_xp := CASE p_task_id
    WHEN 'sunrise-challenge' THEN 80
    WHEN 'taste-halloumi' THEN 95
    WHEN 'nicosia-day-trip' THEN 130
    WHEN 'troodos-wine-route' THEN 180
    WHEN 'sea-adventure' THEN 220
    WHEN 'nicosia-green-line-walk' THEN 140
    WHEN 'loukoumi-workshop' THEN 150
    WHEN 'akamas-jeep-safari' THEN 210
    WHEN 'zenobia-dive-challenge' THEN 260
    WHEN 'troodos-stargazing' THEN 180
    WHEN 'limassol-bike-promenade' THEN 160
    WHEN 'larnaca-art-walk' THEN 175
    WHEN 'karpaz-donkey-care' THEN 190
    WHEN 'halloumi-farm-visit' THEN 200
    WHEN 'sunset-yoga-nissi' THEN 150
    WHEN 'premium-car-rental' THEN 210
    WHEN 'private-blue-lagoon-charter' THEN 240
    WHEN 'troodos-private-tour' THEN 220
    WHEN 'nicosia-famagusta-combo' THEN 230
    WHEN 'family-waterpark-day' THEN 185
    WHEN 'ayia-napa-sunset-cruise' THEN 215
    WHEN 'wedding-photoshoot-cyprus' THEN 250
    ELSE 0
  END;

  IF v_task_xp = 0 THEN
    RAISE EXCEPTION 'Invalid task_id: %', p_task_id;
  END IF;

  -- Frontend już wstawił do completed_tasks, więc pomijamy INSERT
  -- (Frontend robi INSERT przed wywołaniem tej funkcji)

  -- Pobierz obecne XP i level
  SELECT xp, level INTO v_current_xp, v_current_level
  FROM profiles
  WHERE id = v_user_id;

  -- Oblicz nowe XP
  v_new_xp := COALESCE(v_current_xp, 0) + v_task_xp;

  -- Oblicz nowy level (formuła: 1000 XP na level, zgodnie z frontendem)
  v_new_level := GREATEST(1, FLOOR(v_new_xp / 1000.0) + 1);

  -- Zaktualizuj profil
  UPDATE profiles
  SET 
    xp = v_new_xp,
    level = v_new_level,
    updated_at = NOW()
  WHERE id = v_user_id;

  -- Opcjonalnie: zapisz do xp_events (jeśli tabela istnieje)
  BEGIN
    INSERT INTO xp_events (user_id, event_type, xp_amount, related_id)
    VALUES (v_user_id, 'task_completed', v_task_xp, p_task_id);
  EXCEPTION
    WHEN undefined_table THEN
      NULL; -- Tabela nie istnieje, pomiń
  END;

END;
$$;

-- =====================================================
-- Weryfikacja instalacji
-- =====================================================

SELECT '✅ Tabela completed_tasks utworzona pomyślnie' as status
UNION ALL
SELECT '✅ RPC function award_task utworzona pomyślnie' as status;

-- Sprawdź strukturę tabeli
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'completed_tasks'
ORDER BY ordinal_position;

-- Sprawdź RLS policies
SELECT 
  schemaname,
  tablename, 
  policyname, 
  cmd::text as command,
  roles
FROM pg_policies
WHERE tablename = 'completed_tasks';
