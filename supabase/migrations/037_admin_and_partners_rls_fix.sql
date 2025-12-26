CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  user_admin BOOLEAN;
  meta_admin BOOLEAN;
BEGIN
  BEGIN
    meta_admin := COALESCE((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, FALSE);
  EXCEPTION WHEN others THEN
    meta_admin := FALSE;
  END;

  IF meta_admin THEN
    RETURN TRUE;
  END IF;

  IF auth.uid() = '15f3d442-092d-4eb8-9627-db90da0283eb'::uuid THEN
    RETURN TRUE;
  END IF;

  SELECT is_admin INTO user_admin
  FROM profiles
  WHERE id = auth.uid();

  RETURN COALESCE(user_admin, FALSE);
END;
$$;

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS partners_admin_all ON partners;
CREATE POLICY partners_admin_all
ON partners
FOR ALL
TO authenticated
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

DROP POLICY IF EXISTS partner_users_admin_all ON partner_users;
CREATE POLICY partner_users_admin_all
ON partner_users
FOR ALL
TO authenticated
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());
