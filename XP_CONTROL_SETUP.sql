-- =====================================================
-- XP CONTROL PANEL - SUPABASE SETUP
-- =====================================================
-- Run this SQL in Supabase SQL Editor
-- This creates the xp_config table and extends xp_rules
-- =====================================================

-- 1. Create xp_config table for global XP settings
CREATE TABLE IF NOT EXISTS xp_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- 2. Add RLS policies for xp_config
ALTER TABLE xp_config ENABLE ROW LEVEL SECURITY;

-- Allow admins to read xp_config
CREATE POLICY "Admins can read xp_config" ON xp_config
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (is_admin = true OR is_staff = true)
    )
  );

-- Allow admins to update xp_config
CREATE POLICY "Admins can update xp_config" ON xp_config
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND is_admin = true
    )
  );

-- Allow admins to insert xp_config
CREATE POLICY "Admins can insert xp_config" ON xp_config
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND is_admin = true
    )
  );

-- Allow all authenticated users to read xp_config (for frontend)
CREATE POLICY "Authenticated users can read xp_config" ON xp_config
  FOR SELECT USING (auth.role() = 'authenticated');

-- 3. Insert default XP configuration
INSERT INTO xp_config (key, value, description) VALUES
  ('level_formula', '{"type": "simple", "divisor": 1000}', 'Level = XP / divisor. Simple formula matching current Supabase function.'),
  ('max_level', '100', 'Maximum achievable level'),
  ('xp_multiplier', '1.0', 'Global XP multiplier (1.0 = normal, 2.0 = double XP event)')
ON CONFLICT (key) DO NOTHING;

-- 4. Extend xp_rules table with additional columns (if they don't exist)
DO $$ 
BEGIN
  -- Add description column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'xp_rules' AND column_name = 'description') THEN
    ALTER TABLE xp_rules ADD COLUMN description TEXT;
  END IF;
  
  -- Add is_active column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'xp_rules' AND column_name = 'is_active') THEN
    ALTER TABLE xp_rules ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
  
  -- Add category column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'xp_rules' AND column_name = 'category') THEN
    ALTER TABLE xp_rules ADD COLUMN category TEXT DEFAULT 'general';
  END IF;
  
  -- Add updated_at column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'xp_rules' AND column_name = 'updated_at') THEN
    ALTER TABLE xp_rules ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- 5. Update existing xp_rules with descriptions and categories
UPDATE xp_rules SET 
  description = 'XP awarded for uploading a photo',
  category = 'social',
  is_active = true
WHERE event_key = 'bonus_photo_upload' AND description IS NULL;

UPDATE xp_rules SET 
  description = 'XP awarded for daily login',
  category = 'daily',
  is_active = true
WHERE event_key = 'daily_login' AND description IS NULL;

UPDATE xp_rules SET 
  description = 'XP awarded for visiting a POI',
  category = 'poi',
  is_active = true
WHERE event_key = 'visit_poi' AND description IS NULL;

-- 6. Add RLS policies for xp_rules if not exist
ALTER TABLE xp_rules ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Anyone can read xp_rules" ON xp_rules;
DROP POLICY IF EXISTS "Admins can manage xp_rules" ON xp_rules;

-- Allow anyone to read xp_rules
CREATE POLICY "Anyone can read xp_rules" ON xp_rules
  FOR SELECT USING (true);

-- Allow admins to manage xp_rules
CREATE POLICY "Admins can manage xp_rules" ON xp_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND is_admin = true
    )
  );

-- 7. Create function to get XP config value
CREATE OR REPLACE FUNCTION get_xp_config(config_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT value INTO result FROM xp_config WHERE key = config_key;
  RETURN result;
END;
$$;

-- 8. Create function to update XP config (admin only)
CREATE OR REPLACE FUNCTION admin_update_xp_config(
  config_key TEXT,
  config_value JSONB,
  config_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  -- Upsert the config
  INSERT INTO xp_config (key, value, description, updated_at, updated_by)
  VALUES (config_key, config_value, config_description, NOW(), auth.uid())
  ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = COALESCE(EXCLUDED.description, xp_config.description),
    updated_at = NOW(),
    updated_by = auth.uid();
  
  RETURN jsonb_build_object('success', true, 'key', config_key);
END;
$$;

-- 9. Create function to update XP rule (admin only)
CREATE OR REPLACE FUNCTION admin_update_xp_rule(
  p_event_key TEXT,
  p_xp_delta INTEGER,
  p_description TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  -- Upsert the rule
  INSERT INTO xp_rules (event_key, xp_delta, description, category, is_active, updated_at)
  VALUES (p_event_key, p_xp_delta, p_description, p_category, p_is_active, NOW())
  ON CONFLICT (event_key) DO UPDATE SET
    xp_delta = EXCLUDED.xp_delta,
    description = COALESCE(EXCLUDED.description, xp_rules.description),
    category = COALESCE(EXCLUDED.category, xp_rules.category),
    is_active = EXCLUDED.is_active,
    updated_at = NOW();
  
  RETURN jsonb_build_object('success', true, 'event_key', p_event_key, 'xp_delta', p_xp_delta);
END;
$$;

-- 10. Create function to delete XP rule (admin only)
CREATE OR REPLACE FUNCTION admin_delete_xp_rule(p_event_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
  
  DELETE FROM xp_rules WHERE event_key = p_event_key;
  
  RETURN jsonb_build_object('success', true, 'deleted', p_event_key);
END;
$$;

-- 11. Create function to get XP statistics
CREATE OR REPLACE FUNCTION get_xp_statistics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_users', (SELECT COUNT(*) FROM profiles WHERE xp > 0),
    'total_xp_awarded', (SELECT COALESCE(SUM(xp), 0) FROM profiles),
    'avg_xp', (SELECT COALESCE(AVG(xp)::INTEGER, 0) FROM profiles WHERE xp > 0),
    'max_xp', (SELECT COALESCE(MAX(xp), 0) FROM profiles),
    'max_level', (SELECT COALESCE(MAX(level), 0) FROM profiles),
    'level_distribution', (
      SELECT jsonb_object_agg(level::TEXT, cnt)
      FROM (
        SELECT level, COUNT(*) as cnt 
        FROM profiles 
        WHERE level > 0
        GROUP BY level 
        ORDER BY level
      ) sub
    ),
    'recent_events_count', (
      SELECT COUNT(*) FROM user_xp_events 
      WHERE created_at > NOW() - INTERVAL '7 days'
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- =====================================================
-- VERIFICATION
-- =====================================================
-- After running this SQL, verify by checking:
-- 1. SELECT * FROM xp_config;
-- 2. SELECT * FROM xp_rules;
-- 3. SELECT get_xp_statistics();

SELECT 'XP Control Setup Complete!' AS status;
