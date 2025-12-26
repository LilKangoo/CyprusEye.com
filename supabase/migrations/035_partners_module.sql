CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  shop_vendor_id UUID REFERENCES shop_vendors(id) ON DELETE SET NULL,
  can_manage_shop BOOLEAN NOT NULL DEFAULT false,
  can_manage_cars BOOLEAN NOT NULL DEFAULT false,
  can_manage_trips BOOLEAN NOT NULL DEFAULT false,
  can_manage_hotels BOOLEAN NOT NULL DEFAULT false,
  can_create_offers BOOLEAN NOT NULL DEFAULT false,
  can_view_stats BOOLEAN NOT NULL DEFAULT true,
  can_view_payouts BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'staff')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(partner_id, user_id)
);

CREATE OR REPLACE FUNCTION update_partners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS partners_updated_at_trigger ON partners;
CREATE TRIGGER partners_updated_at_trigger
  BEFORE UPDATE ON partners
  FOR EACH ROW
  EXECUTE FUNCTION update_partners_updated_at();

CREATE OR REPLACE FUNCTION is_partner_user(p_partner_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM partner_users pu
    WHERE pu.partner_id = p_partner_id
      AND pu.user_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION partner_accept_fulfillment(p_fulfillment_id UUID)
RETURNS TABLE(order_id UUID, fulfillment_id UUID, partner_id UUID, all_accepted BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f RECORD;
  now_ts TIMESTAMPTZ := NOW();
  any_rejected BOOLEAN := FALSE;
BEGIN
  SELECT * INTO f
  FROM shop_order_fulfillments
  WHERE id = p_fulfillment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'fulfillment_not_found';
  END IF;

  IF f.partner_id IS NULL THEN
    RAISE EXCEPTION 'fulfillment_has_no_partner';
  END IF;

  IF NOT is_partner_user(f.partner_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE shop_order_fulfillments
  SET
    status = 'accepted',
    accepted_at = COALESCE(accepted_at, now_ts),
    accepted_by = COALESCE(accepted_by, auth.uid()),
    contact_revealed_at = COALESCE(contact_revealed_at, now_ts),
    rejected_at = NULL,
    rejected_by = NULL,
    rejected_reason = NULL
  WHERE id = p_fulfillment_id;

  INSERT INTO partner_audit_log(partner_id, actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (f.partner_id, auth.uid(), 'fulfillment_accepted', 'shop_order_fulfillment', f.id, jsonb_build_object('order_id', f.order_id));

  SELECT EXISTS(
    SELECT 1
    FROM shop_order_fulfillments
    WHERE order_id = f.order_id
      AND partner_id IS NOT NULL
      AND status = 'rejected'
  ) INTO any_rejected;

  SELECT COALESCE(bool_and(
    CASE
      WHEN partner_id IS NULL THEN TRUE
      ELSE status = 'accepted'
    END
  ), TRUE)
  INTO all_accepted
  FROM shop_order_fulfillments
  WHERE order_id = f.order_id;

  UPDATE shop_orders
  SET
    partner_acceptance_status = CASE
      WHEN any_rejected THEN 'rejected'
      WHEN all_accepted THEN 'accepted'
      ELSE 'pending'
    END,
    partner_acceptance_updated_at = now_ts
  WHERE id = f.order_id;

  order_id := f.order_id;
  fulfillment_id := f.id;
  partner_id := f.partner_id;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION partner_reject_fulfillment(p_fulfillment_id UUID, p_reason TEXT)
RETURNS TABLE(order_id UUID, fulfillment_id UUID, partner_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f RECORD;
  now_ts TIMESTAMPTZ := NOW();
BEGIN
  SELECT * INTO f
  FROM shop_order_fulfillments
  WHERE id = p_fulfillment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'fulfillment_not_found';
  END IF;

  IF f.partner_id IS NULL THEN
    RAISE EXCEPTION 'fulfillment_has_no_partner';
  END IF;

  IF NOT is_partner_user(f.partner_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE shop_order_fulfillments
  SET
    status = 'rejected',
    rejected_at = COALESCE(rejected_at, now_ts),
    rejected_by = COALESCE(rejected_by, auth.uid()),
    rejected_reason = NULLIF(TRIM(COALESCE(p_reason, '')), '')
  WHERE id = p_fulfillment_id;

  INSERT INTO partner_audit_log(partner_id, actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (f.partner_id, auth.uid(), 'fulfillment_rejected', 'shop_order_fulfillment', f.id, jsonb_build_object('order_id', f.order_id, 'reason', p_reason));

  UPDATE shop_orders
  SET
    partner_acceptance_status = 'rejected',
    partner_acceptance_updated_at = now_ts
  WHERE id = f.order_id;

  order_id := f.order_id;
  fulfillment_id := f.id;
  partner_id := f.partner_id;
  RETURN NEXT;
END;
$$;

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS partners_admin_all ON partners;
CREATE POLICY partners_admin_all
ON partners
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS partners_self_read ON partners;
CREATE POLICY partners_self_read
ON partners
FOR SELECT
TO authenticated
USING (is_partner_user(id));

DROP POLICY IF EXISTS partner_users_admin_all ON partner_users;
CREATE POLICY partner_users_admin_all
ON partner_users
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS partner_users_partner_read ON partner_users;
CREATE POLICY partner_users_partner_read
ON partner_users
FOR SELECT
TO authenticated
USING (is_partner_user(partner_id));

ALTER TABLE shop_orders
  ADD COLUMN IF NOT EXISTS partner_acceptance_status TEXT NOT NULL DEFAULT 'none' CHECK (partner_acceptance_status IN ('none', 'pending', 'accepted', 'rejected'));

ALTER TABLE shop_orders
  ADD COLUMN IF NOT EXISTS partner_acceptance_updated_at TIMESTAMPTZ;

ALTER TABLE shop_orders
  ADD COLUMN IF NOT EXISTS customer_payment_email_sent_at TIMESTAMPTZ;

ALTER TABLE shop_orders
  ADD COLUMN IF NOT EXISTS customer_confirmed_email_sent_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS shop_order_fulfillments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
  order_number TEXT,
  order_created_at TIMESTAMPTZ,
  partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES shop_vendors(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'awaiting_payment' CHECK (status IN ('awaiting_payment', 'pending_acceptance', 'accepted', 'rejected', 'expired')),
  sla_deadline_at TIMESTAMPTZ,
  sla_alerted_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rejected_reason TEXT,
  contact_revealed_at TIMESTAMPTZ,
  subtotal DECIMAL(12,2) DEFAULT 0,
  total_allocated DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE shop_order_fulfillments
  ADD COLUMN IF NOT EXISTS order_number TEXT;

ALTER TABLE shop_order_fulfillments
  ADD COLUMN IF NOT EXISTS order_created_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS shop_order_fulfillment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_id UUID NOT NULL REFERENCES shop_order_fulfillments(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES shop_order_items(id) ON DELETE CASCADE,
  product_name TEXT,
  variant_name TEXT,
  quantity INTEGER,
  unit_price DECIMAL(12,2),
  subtotal DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fulfillment_id, order_item_id)
);

CREATE TABLE IF NOT EXISTS shop_order_fulfillment_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_id UUID NOT NULL REFERENCES shop_order_fulfillments(id) ON DELETE CASCADE,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  shipping_address JSONB,
  billing_address JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fulfillment_id)
);

CREATE OR REPLACE FUNCTION update_shop_order_fulfillments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS shop_order_fulfillments_updated_at_trigger ON shop_order_fulfillments;
CREATE TRIGGER shop_order_fulfillments_updated_at_trigger
  BEFORE UPDATE ON shop_order_fulfillments
  FOR EACH ROW
  EXECUTE FUNCTION update_shop_order_fulfillments_updated_at();

CREATE INDEX IF NOT EXISTS idx_shop_order_fulfillments_order_id ON shop_order_fulfillments(order_id);
CREATE INDEX IF NOT EXISTS idx_shop_order_fulfillments_partner_id ON shop_order_fulfillments(partner_id);
CREATE INDEX IF NOT EXISTS idx_shop_order_fulfillments_status ON shop_order_fulfillments(status);
CREATE INDEX IF NOT EXISTS idx_shop_order_fulfillments_sla_deadline ON shop_order_fulfillments(sla_deadline_at);

ALTER TABLE shop_order_fulfillments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_order_fulfillment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_order_fulfillment_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shop_order_fulfillments_admin_all ON shop_order_fulfillments;
CREATE POLICY shop_order_fulfillments_admin_all
ON shop_order_fulfillments
FOR ALL
TO authenticated
USING (is_shop_admin());

DROP POLICY IF EXISTS shop_order_fulfillments_partner_read ON shop_order_fulfillments;
CREATE POLICY shop_order_fulfillments_partner_read
ON shop_order_fulfillments
FOR SELECT
TO authenticated
USING (
  partner_id IS NOT NULL
  AND is_partner_user(partner_id)
);

DROP POLICY IF EXISTS shop_order_fulfillment_items_admin_all ON shop_order_fulfillment_items;
CREATE POLICY shop_order_fulfillment_items_admin_all
ON shop_order_fulfillment_items
FOR ALL
TO authenticated
USING (is_shop_admin());

DROP POLICY IF EXISTS shop_order_fulfillment_items_partner_read ON shop_order_fulfillment_items;
CREATE POLICY shop_order_fulfillment_items_partner_read
ON shop_order_fulfillment_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM shop_order_fulfillments f
    WHERE f.id = fulfillment_id
      AND f.partner_id IS NOT NULL
      AND is_partner_user(f.partner_id)
  )
);

DROP POLICY IF EXISTS shop_order_fulfillment_contacts_admin_all ON shop_order_fulfillment_contacts;
CREATE POLICY shop_order_fulfillment_contacts_admin_all
ON shop_order_fulfillment_contacts
FOR ALL
TO authenticated
USING (is_shop_admin());

DROP POLICY IF EXISTS shop_order_fulfillment_contacts_partner_read ON shop_order_fulfillment_contacts;
CREATE POLICY shop_order_fulfillment_contacts_partner_read
ON shop_order_fulfillment_contacts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM shop_order_fulfillments f
    WHERE f.id = fulfillment_id
      AND f.partner_id IS NOT NULL
      AND is_partner_user(f.partner_id)
      AND f.status = 'accepted'
  )
);

CREATE TABLE IF NOT EXISTS partner_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE partner_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS partner_audit_log_admin_all ON partner_audit_log;
CREATE POLICY partner_audit_log_admin_all
ON partner_audit_log
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS partner_audit_log_partner_read ON partner_audit_log;
CREATE POLICY partner_audit_log_partner_read
ON partner_audit_log
FOR SELECT
TO authenticated
USING (is_partner_user(partner_id));

CREATE TABLE IF NOT EXISTS partner_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(partner_id, entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS partner_thread_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES partner_threads(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK (author_type IN ('admin', 'partner', 'system')),
  author_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE partner_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_thread_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS partner_threads_admin_all ON partner_threads;
CREATE POLICY partner_threads_admin_all
ON partner_threads
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS partner_threads_partner_read ON partner_threads;
CREATE POLICY partner_threads_partner_read
ON partner_threads
FOR SELECT
TO authenticated
USING (is_partner_user(partner_id));

DROP POLICY IF EXISTS partner_threads_partner_insert ON partner_threads;
CREATE POLICY partner_threads_partner_insert
ON partner_threads
FOR INSERT
TO authenticated
WITH CHECK (is_partner_user(partner_id));

DROP POLICY IF EXISTS partner_thread_messages_admin_all ON partner_thread_messages;
CREATE POLICY partner_thread_messages_admin_all
ON partner_thread_messages
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS partner_thread_messages_partner_read ON partner_thread_messages;
CREATE POLICY partner_thread_messages_partner_read
ON partner_thread_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM partner_threads t
    WHERE t.id = thread_id
      AND is_partner_user(t.partner_id)
  )
);

DROP POLICY IF EXISTS partner_thread_messages_partner_insert ON partner_thread_messages;
CREATE POLICY partner_thread_messages_partner_insert
ON partner_thread_messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM partner_threads t
    WHERE t.id = thread_id
      AND is_partner_user(t.partner_id)
  )
);

CREATE TABLE IF NOT EXISTS partner_availability_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_block_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_partner_availability_partner ON partner_availability_blocks(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_availability_resource ON partner_availability_blocks(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_partner_availability_dates ON partner_availability_blocks(start_date, end_date);

ALTER TABLE partner_availability_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS partner_availability_admin_all ON partner_availability_blocks;
CREATE POLICY partner_availability_admin_all
ON partner_availability_blocks
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS partner_availability_partner_all ON partner_availability_blocks;
CREATE POLICY partner_availability_partner_all
ON partner_availability_blocks
FOR ALL
TO authenticated
USING (is_partner_user(partner_id))
WITH CHECK (is_partner_user(partner_id));
