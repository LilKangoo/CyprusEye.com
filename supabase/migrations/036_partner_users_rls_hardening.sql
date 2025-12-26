DROP POLICY IF EXISTS partner_users_partner_read ON partner_users;
DROP POLICY IF EXISTS partner_users_self_read ON partner_users;

CREATE POLICY partner_users_self_read
ON partner_users
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
