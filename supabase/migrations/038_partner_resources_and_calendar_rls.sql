CREATE TABLE IF NOT EXISTS partner_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(partner_id, resource_type, resource_id)
);

ALTER TABLE partner_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS partner_resources_admin_all ON partner_resources;
CREATE POLICY partner_resources_admin_all
ON partner_resources
FOR ALL
TO authenticated
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

DROP POLICY IF EXISTS partner_resources_partner_read ON partner_resources;
CREATE POLICY partner_resources_partner_read
ON partner_resources
FOR SELECT
TO authenticated
USING (is_partner_user(partner_id));

CREATE TABLE IF NOT EXISTS partner_user_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_user_id UUID NOT NULL REFERENCES partner_users(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(partner_user_id, resource_type, resource_id)
);

ALTER TABLE partner_user_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS partner_user_resources_admin_all ON partner_user_resources;
CREATE POLICY partner_user_resources_admin_all
ON partner_user_resources
FOR ALL
TO authenticated
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

DROP POLICY IF EXISTS partner_user_resources_self_read ON partner_user_resources;
CREATE POLICY partner_user_resources_self_read
ON partner_user_resources
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM partner_users pu
    WHERE pu.id = partner_user_id
      AND pu.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS partner_availability_admin_all ON partner_availability_blocks;
CREATE POLICY partner_availability_admin_all
ON partner_availability_blocks
FOR ALL
TO authenticated
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());
