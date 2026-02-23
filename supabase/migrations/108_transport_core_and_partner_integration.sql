-- =====================================================
-- Transport core tables + partner/admin integration
-- =====================================================

CREATE TABLE IF NOT EXISTS public.transport_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL,
  location_type text NOT NULL DEFAULT 'city'
    CHECK (location_type IN ('city', 'airport', 'port', 'station', 'hotel', 'landmark', 'custom')),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS transport_locations_code_uq
  ON public.transport_locations ((lower(code)));
CREATE INDEX IF NOT EXISTS transport_locations_sort_idx
  ON public.transport_locations (sort_order, name);
CREATE INDEX IF NOT EXISTS transport_locations_active_idx
  ON public.transport_locations (is_active, sort_order, name);

CREATE TABLE IF NOT EXISTS public.transport_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_location_id uuid NOT NULL REFERENCES public.transport_locations(id) ON DELETE RESTRICT,
  destination_location_id uuid NOT NULL REFERENCES public.transport_locations(id) ON DELETE RESTRICT,
  day_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (day_price >= 0),
  night_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (night_price >= 0),
  currency text NOT NULL DEFAULT 'EUR',
  included_passengers integer NOT NULL DEFAULT 2 CHECK (included_passengers >= 1),
  included_bags integer NOT NULL DEFAULT 2 CHECK (included_bags >= 0),
  max_passengers integer NOT NULL DEFAULT 8 CHECK (max_passengers >= 1),
  max_bags integer NOT NULL DEFAULT 8 CHECK (max_bags >= 0),
  owner_partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transport_routes_not_same_points CHECK (origin_location_id <> destination_location_id),
  CONSTRAINT transport_routes_capacity_check CHECK (max_passengers >= included_passengers AND max_bags >= included_bags)
);

CREATE UNIQUE INDEX IF NOT EXISTS transport_routes_origin_destination_uq
  ON public.transport_routes (origin_location_id, destination_location_id);
CREATE INDEX IF NOT EXISTS transport_routes_sort_idx
  ON public.transport_routes (sort_order, created_at DESC);
CREATE INDEX IF NOT EXISTS transport_routes_active_idx
  ON public.transport_routes (is_active, sort_order, created_at DESC);
CREATE INDEX IF NOT EXISTS transport_routes_owner_partner_idx
  ON public.transport_routes (owner_partner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.transport_pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.transport_routes(id) ON DELETE CASCADE,
  extra_passenger_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK (extra_passenger_fee >= 0),
  extra_bag_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK (extra_bag_fee >= 0),
  oversize_bag_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK (oversize_bag_fee >= 0),
  child_seat_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK (child_seat_fee >= 0),
  booster_seat_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK (booster_seat_fee >= 0),
  waiting_included_minutes integer NOT NULL DEFAULT 0 CHECK (waiting_included_minutes >= 0),
  waiting_fee_per_minute numeric(12,2) NOT NULL DEFAULT 0 CHECK (waiting_fee_per_minute >= 0),
  night_start time without time zone NOT NULL DEFAULT '22:00',
  night_end time without time zone NOT NULL DEFAULT '06:00',
  valid_from date,
  valid_to date,
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transport_pricing_rules_validity_check CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
);

CREATE INDEX IF NOT EXISTS transport_pricing_rules_route_idx
  ON public.transport_pricing_rules (route_id, is_active, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS transport_pricing_rules_validity_idx
  ON public.transport_pricing_rules (valid_from, valid_to, is_active, priority);

CREATE TABLE IF NOT EXISTS public.transport_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid REFERENCES public.transport_routes(id) ON DELETE SET NULL,
  origin_location_id uuid REFERENCES public.transport_locations(id) ON DELETE SET NULL,
  destination_location_id uuid REFERENCES public.transport_locations(id) ON DELETE SET NULL,
  travel_date date NOT NULL,
  travel_time time without time zone NOT NULL,
  num_passengers integer NOT NULL DEFAULT 1 CHECK (num_passengers >= 1),
  num_bags integer NOT NULL DEFAULT 0 CHECK (num_bags >= 0),
  num_oversize_bags integer NOT NULL DEFAULT 0 CHECK (num_oversize_bags >= 0),
  child_seats integer NOT NULL DEFAULT 0 CHECK (child_seats >= 0),
  booster_seats integer NOT NULL DEFAULT 0 CHECK (booster_seats >= 0),
  waiting_minutes integer NOT NULL DEFAULT 0 CHECK (waiting_minutes >= 0),
  pickup_address text,
  dropoff_address text,
  flight_number text,
  notes text,
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text,
  lang text,
  base_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (base_price >= 0),
  extras_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (extras_price >= 0),
  total_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_price >= 0),
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','awaiting_payment','completed','cancelled')),
  payment_status text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending','paid','failed','refunded','not_required')),
  paid_at timestamptz,
  deposit_paid_at timestamptz,
  deposit_amount numeric(12,2),
  deposit_currency text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transport_bookings_route_idx
  ON public.transport_bookings (route_id, travel_date, travel_time);
CREATE INDEX IF NOT EXISTS transport_bookings_created_idx
  ON public.transport_bookings (created_at DESC);
CREATE INDEX IF NOT EXISTS transport_bookings_status_idx
  ON public.transport_bookings (status, created_at DESC);
CREATE INDEX IF NOT EXISTS transport_bookings_payment_status_idx
  ON public.transport_bookings (payment_status, created_at DESC);
CREATE INDEX IF NOT EXISTS transport_bookings_travel_date_idx
  ON public.transport_bookings (travel_date, travel_time, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_transport_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transport_locations_updated_at ON public.transport_locations;
CREATE TRIGGER trg_transport_locations_updated_at
  BEFORE UPDATE ON public.transport_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_transport_updated_at();

DROP TRIGGER IF EXISTS trg_transport_routes_updated_at ON public.transport_routes;
CREATE TRIGGER trg_transport_routes_updated_at
  BEFORE UPDATE ON public.transport_routes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_transport_updated_at();

DROP TRIGGER IF EXISTS trg_transport_pricing_rules_updated_at ON public.transport_pricing_rules;
CREATE TRIGGER trg_transport_pricing_rules_updated_at
  BEFORE UPDATE ON public.transport_pricing_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_transport_updated_at();

DROP TRIGGER IF EXISTS trg_transport_bookings_updated_at ON public.transport_bookings;
CREATE TRIGGER trg_transport_bookings_updated_at
  BEFORE UPDATE ON public.transport_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_transport_updated_at();

ALTER TABLE public.transport_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS transport_locations_admin_all ON public.transport_locations;
CREATE POLICY transport_locations_admin_all
ON public.transport_locations
FOR ALL
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS transport_locations_public_read ON public.transport_locations;
CREATE POLICY transport_locations_public_read
ON public.transport_locations
FOR SELECT
TO anon, authenticated
USING (is_active = true OR public.is_current_user_admin());

DROP POLICY IF EXISTS transport_routes_admin_all ON public.transport_routes;
CREATE POLICY transport_routes_admin_all
ON public.transport_routes
FOR ALL
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS transport_routes_public_read ON public.transport_routes;
CREATE POLICY transport_routes_public_read
ON public.transport_routes
FOR SELECT
TO anon, authenticated
USING (is_active = true OR public.is_current_user_admin());

DROP POLICY IF EXISTS transport_pricing_rules_admin_all ON public.transport_pricing_rules;
CREATE POLICY transport_pricing_rules_admin_all
ON public.transport_pricing_rules
FOR ALL
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS transport_pricing_rules_public_read ON public.transport_pricing_rules;
CREATE POLICY transport_pricing_rules_public_read
ON public.transport_pricing_rules
FOR SELECT
TO anon, authenticated
USING (is_active = true OR public.is_current_user_admin());

DROP POLICY IF EXISTS transport_bookings_admin_all ON public.transport_bookings;
CREATE POLICY transport_bookings_admin_all
ON public.transport_bookings
FOR ALL
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS transport_bookings_public_insert ON public.transport_bookings;
CREATE POLICY transport_bookings_public_insert
ON public.transport_bookings
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS transport_bookings_partner_read ON public.transport_bookings;
CREATE POLICY transport_bookings_partner_read
ON public.transport_bookings
FOR SELECT
TO authenticated
USING (
  public.is_current_user_admin()
  OR EXISTS (
    SELECT 1
    FROM public.partner_service_fulfillments f
    WHERE f.resource_type = 'transport'
      AND f.booking_id = public.transport_bookings.id
      AND public.is_partner_user(f.partner_id)
  )
  OR EXISTS (
    SELECT 1
    FROM public.partner_resources pr
    WHERE pr.resource_type = 'transport'
      AND pr.resource_id = public.transport_bookings.route_id
      AND public.is_partner_user(pr.partner_id)
  )
);

REVOKE ALL ON TABLE public.transport_locations FROM anon, authenticated;
REVOKE ALL ON TABLE public.transport_routes FROM anon, authenticated;
REVOKE ALL ON TABLE public.transport_pricing_rules FROM anon, authenticated;
REVOKE ALL ON TABLE public.transport_bookings FROM anon, authenticated;

GRANT SELECT ON TABLE public.transport_locations TO anon, authenticated;
GRANT SELECT ON TABLE public.transport_routes TO anon, authenticated;
GRANT SELECT ON TABLE public.transport_pricing_rules TO anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.transport_bookings TO anon, authenticated;
GRANT UPDATE, DELETE ON TABLE public.transport_bookings TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.transport_locations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.transport_routes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.transport_pricing_rules TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.transport_bookings TO service_role;

ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS can_manage_transport boolean NOT NULL DEFAULT false;

DO $$
DECLARE
  q text;
BEGIN
  IF to_regclass('public.partner_service_fulfillments') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.partner_service_fulfillments
    DROP CONSTRAINT IF EXISTS partner_service_fulfillments_resource_type_check;

  SELECT string_agg(format('ALTER TABLE public.partner_service_fulfillments DROP CONSTRAINT %I;', c.conname), ' ')
  INTO q
  FROM pg_constraint c
  WHERE c.conrelid = 'public.partner_service_fulfillments'::regclass
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%resource_type%'
    AND pg_get_constraintdef(c.oid) ILIKE '%cars%'
    AND pg_get_constraintdef(c.oid) ILIKE '%trips%'
    AND pg_get_constraintdef(c.oid) ILIKE '%hotels%';

  IF q IS NOT NULL THEN
    EXECUTE q;
  END IF;

  ALTER TABLE public.partner_service_fulfillments
    ADD CONSTRAINT partner_service_fulfillments_resource_type_check
    CHECK (resource_type IN ('cars','trips','hotels','transport'));
END $$;

DO $$
DECLARE
  q text;
BEGIN
  IF to_regclass('public.service_deposit_rules') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.service_deposit_rules
    DROP CONSTRAINT IF EXISTS service_deposit_rules_resource_type_check;

  SELECT string_agg(format('ALTER TABLE public.service_deposit_rules DROP CONSTRAINT %I;', c.conname), ' ')
  INTO q
  FROM pg_constraint c
  WHERE c.conrelid = 'public.service_deposit_rules'::regclass
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%resource_type%'
    AND pg_get_constraintdef(c.oid) ILIKE '%cars%'
    AND pg_get_constraintdef(c.oid) ILIKE '%trips%'
    AND pg_get_constraintdef(c.oid) ILIKE '%hotels%';

  IF q IS NOT NULL THEN
    EXECUTE q;
  END IF;

  ALTER TABLE public.service_deposit_rules
    ADD CONSTRAINT service_deposit_rules_resource_type_check
    CHECK (resource_type IN ('cars','trips','hotels','transport'));
END $$;

DO $$
DECLARE
  q text;
BEGIN
  IF to_regclass('public.service_deposit_overrides') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.service_deposit_overrides
    DROP CONSTRAINT IF EXISTS service_deposit_overrides_resource_type_check;

  SELECT string_agg(format('ALTER TABLE public.service_deposit_overrides DROP CONSTRAINT %I;', c.conname), ' ')
  INTO q
  FROM pg_constraint c
  WHERE c.conrelid = 'public.service_deposit_overrides'::regclass
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%resource_type%'
    AND pg_get_constraintdef(c.oid) ILIKE '%cars%'
    AND pg_get_constraintdef(c.oid) ILIKE '%trips%'
    AND pg_get_constraintdef(c.oid) ILIKE '%hotels%';

  IF q IS NOT NULL THEN
    EXECUTE q;
  END IF;

  ALTER TABLE public.service_deposit_overrides
    ADD CONSTRAINT service_deposit_overrides_resource_type_check
    CHECK (resource_type IN ('cars','trips','hotels','transport'));
END $$;

DO $$
DECLARE
  q text;
BEGIN
  IF to_regclass('public.service_deposit_requests') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.service_deposit_requests
    DROP CONSTRAINT IF EXISTS service_deposit_requests_resource_type_check;

  SELECT string_agg(format('ALTER TABLE public.service_deposit_requests DROP CONSTRAINT %I;', c.conname), ' ')
  INTO q
  FROM pg_constraint c
  WHERE c.conrelid = 'public.service_deposit_requests'::regclass
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%resource_type%'
    AND pg_get_constraintdef(c.oid) ILIKE '%cars%'
    AND pg_get_constraintdef(c.oid) ILIKE '%trips%'
    AND pg_get_constraintdef(c.oid) ILIKE '%hotels%';

  IF q IS NOT NULL THEN
    EXECUTE q;
  END IF;

  ALTER TABLE public.service_deposit_requests
    ADD CONSTRAINT service_deposit_requests_resource_type_check
    CHECK (resource_type IN ('cars','trips','hotels','transport'));
END $$;

DO $$
DECLARE
  q text;
BEGIN
  IF to_regclass('public.affiliate_commission_events') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.affiliate_commission_events
    DROP CONSTRAINT IF EXISTS affiliate_commission_events_resource_type_check;

  SELECT string_agg(format('ALTER TABLE public.affiliate_commission_events DROP CONSTRAINT %I;', c.conname), ' ')
  INTO q
  FROM pg_constraint c
  WHERE c.conrelid = 'public.affiliate_commission_events'::regclass
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%resource_type%'
    AND pg_get_constraintdef(c.oid) ILIKE '%cars%'
    AND pg_get_constraintdef(c.oid) ILIKE '%trips%'
    AND pg_get_constraintdef(c.oid) ILIKE '%hotels%';

  IF q IS NOT NULL THEN
    EXECUTE q;
  END IF;

  ALTER TABLE public.affiliate_commission_events
    ADD CONSTRAINT affiliate_commission_events_resource_type_check
    CHECK (resource_type IN ('cars','trips','hotels','transport'));
END $$;

DO $$
BEGIN
  IF to_regclass('public.partner_service_fulfillments') IS NULL THEN
    RETURN;
  END IF;

  DROP INDEX IF EXISTS public.partner_service_fulfillments_unique_trips_hotels;
  DROP INDEX IF EXISTS public.partner_service_fulfillments_unique_active_trips_hotels;

  CREATE UNIQUE INDEX IF NOT EXISTS partner_service_fulfillments_unique_trips_hotels
    ON public.partner_service_fulfillments (resource_type, booking_id, partner_id)
    WHERE resource_type IN ('trips','hotels','transport');

  CREATE UNIQUE INDEX IF NOT EXISTS partner_service_fulfillments_unique_active_trips_hotels
    ON public.partner_service_fulfillments (resource_type, booking_id)
    WHERE resource_type IN ('trips','hotels','transport')
      AND status IN ('awaiting_payment','accepted');
END $$;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY resource_type, booking_id
      ORDER BY accepted_at NULLS LAST, created_at, id
    ) AS rn
  FROM public.partner_service_fulfillments
  WHERE resource_type IN ('trips','hotels','transport')
    AND status IN ('awaiting_payment','accepted')
)
UPDATE public.partner_service_fulfillments f
SET status = 'closed',
    updated_at = now()
FROM ranked r
WHERE f.id = r.id
  AND r.rn > 1;

CREATE OR REPLACE FUNCTION public.partner_service_fulfillment_partner_id_for_resource(
  p_resource_type text,
  p_resource_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid uuid;
  has_pr boolean;
  rel regclass;
  has_owner boolean;
BEGIN
  IF p_resource_id IS NULL THEN
    RETURN NULL;
  END IF;

  has_pr := (to_regclass('public.partner_resources') IS NOT NULL);

  IF p_resource_type = 'cars' THEN
    rel := to_regclass('public.car_offers');
    IF rel IS NULL THEN
      RETURN NULL;
    END IF;

    has_owner := EXISTS (
      SELECT 1
      FROM pg_attribute a
      WHERE a.attrelid = rel
        AND a.attname = 'owner_partner_id'
        AND a.attisdropped = false
    );

    IF has_pr THEN
      IF has_owner THEN
        EXECUTE
          'SELECT COALESCE(co.owner_partner_id, pr.partner_id)
           FROM public.car_offers co
           LEFT JOIN public.partner_resources pr
             ON pr.resource_type = ''cars''
            AND pr.resource_id = co.id
           WHERE co.id = $1
           ORDER BY pr.created_at ASC NULLS LAST
           LIMIT 1'
        INTO pid
        USING p_resource_id;
      ELSE
        EXECUTE
          'SELECT pr.partner_id
           FROM public.partner_resources pr
           WHERE pr.resource_type = ''cars''
             AND pr.resource_id = $1
           ORDER BY pr.created_at ASC
           LIMIT 1'
        INTO pid
        USING p_resource_id;
      END IF;
    ELSE
      IF has_owner THEN
        EXECUTE
          'SELECT co.owner_partner_id
           FROM public.car_offers co
           WHERE co.id = $1
           LIMIT 1'
        INTO pid
        USING p_resource_id;
      ELSE
        RETURN NULL;
      END IF;
    END IF;
    RETURN pid;
  END IF;

  IF p_resource_type = 'trips' THEN
    rel := to_regclass('public.trips');
    IF rel IS NULL THEN
      RETURN NULL;
    END IF;

    has_owner := EXISTS (
      SELECT 1
      FROM pg_attribute a
      WHERE a.attrelid = rel
        AND a.attname = 'owner_partner_id'
        AND a.attisdropped = false
    );

    IF has_pr THEN
      IF has_owner THEN
        EXECUTE
          'SELECT COALESCE(t.owner_partner_id, pr.partner_id)
           FROM public.trips t
           LEFT JOIN public.partner_resources pr
             ON pr.resource_type = ''trips''
            AND pr.resource_id = t.id
           WHERE t.id = $1
           ORDER BY pr.created_at ASC NULLS LAST
           LIMIT 1'
        INTO pid
        USING p_resource_id;
      ELSE
        EXECUTE
          'SELECT pr.partner_id
           FROM public.partner_resources pr
           WHERE pr.resource_type = ''trips''
             AND pr.resource_id = $1
           ORDER BY pr.created_at ASC
           LIMIT 1'
        INTO pid
        USING p_resource_id;
      END IF;
    ELSE
      IF has_owner THEN
        EXECUTE
          'SELECT t.owner_partner_id
           FROM public.trips t
           WHERE t.id = $1
           LIMIT 1'
        INTO pid
        USING p_resource_id;
      ELSE
        RETURN NULL;
      END IF;
    END IF;
    RETURN pid;
  END IF;

  IF p_resource_type = 'hotels' THEN
    rel := to_regclass('public.hotels');
    IF rel IS NULL THEN
      RETURN NULL;
    END IF;

    has_owner := EXISTS (
      SELECT 1
      FROM pg_attribute a
      WHERE a.attrelid = rel
        AND a.attname = 'owner_partner_id'
        AND a.attisdropped = false
    );

    IF has_pr THEN
      IF has_owner THEN
        EXECUTE
          'SELECT COALESCE(h.owner_partner_id, pr.partner_id)
           FROM public.hotels h
           LEFT JOIN public.partner_resources pr
             ON pr.resource_type = ''hotels''
            AND pr.resource_id = h.id
           WHERE h.id = $1
           ORDER BY pr.created_at ASC NULLS LAST
           LIMIT 1'
        INTO pid
        USING p_resource_id;
      ELSE
        EXECUTE
          'SELECT pr.partner_id
           FROM public.partner_resources pr
           WHERE pr.resource_type = ''hotels''
             AND pr.resource_id = $1
           ORDER BY pr.created_at ASC
           LIMIT 1'
        INTO pid
        USING p_resource_id;
      END IF;
    ELSE
      IF has_owner THEN
        EXECUTE
          'SELECT h.owner_partner_id
           FROM public.hotels h
           WHERE h.id = $1
           LIMIT 1'
        INTO pid
        USING p_resource_id;
      ELSE
        RETURN NULL;
      END IF;
    END IF;
    RETURN pid;
  END IF;

  IF p_resource_type = 'transport' THEN
    rel := to_regclass('public.transport_routes');
    IF rel IS NULL THEN
      RETURN NULL;
    END IF;

    has_owner := EXISTS (
      SELECT 1
      FROM pg_attribute a
      WHERE a.attrelid = rel
        AND a.attname = 'owner_partner_id'
        AND a.attisdropped = false
    );

    IF has_pr THEN
      IF has_owner THEN
        EXECUTE
          'SELECT COALESCE(r.owner_partner_id, pr.partner_id)
           FROM public.transport_routes r
           LEFT JOIN public.partner_resources pr
             ON pr.resource_type = ''transport''
            AND pr.resource_id = r.id
           WHERE r.id = $1
           ORDER BY pr.created_at ASC NULLS LAST
           LIMIT 1'
        INTO pid
        USING p_resource_id;
      ELSE
        EXECUTE
          'SELECT pr.partner_id
           FROM public.partner_resources pr
           WHERE pr.resource_type = ''transport''
             AND pr.resource_id = $1
           ORDER BY pr.created_at ASC
           LIMIT 1'
        INTO pid
        USING p_resource_id;
      END IF;
    ELSE
      IF has_owner THEN
        EXECUTE
          'SELECT r.owner_partner_id
           FROM public.transport_routes r
           WHERE r.id = $1
           LIMIT 1'
        INTO pid
        USING p_resource_id;
      ELSE
        RETURN NULL;
      END IF;
    END IF;
    RETURN pid;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.partner_service_fulfillment_partner_ids_for_resource(
  p_resource_type text,
  p_resource_id uuid
)
RETURNS TABLE(partner_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rel regclass;
  has_owner boolean;
BEGIN
  IF p_resource_id IS NULL THEN
    RETURN;
  END IF;

  IF p_resource_type = 'trips' THEN
    rel := to_regclass('public.trips');
    IF rel IS NULL THEN
      RETURN;
    END IF;

    has_owner := EXISTS (
      SELECT 1
      FROM pg_attribute a
      WHERE a.attrelid = rel
        AND a.attname = 'owner_partner_id'
        AND a.attisdropped = false
    );

    RETURN QUERY
    SELECT DISTINCT pid
    FROM (
      SELECT pid
      FROM (
        SELECT CASE WHEN has_owner THEN (t.owner_partner_id) ELSE NULL END AS pid
        FROM public.trips t
        WHERE t.id = p_resource_id
      ) o
      WHERE pid IS NOT NULL
      UNION ALL
      SELECT pr.partner_id AS pid
      FROM public.partner_resources pr
      WHERE pr.resource_type = 'trips'
        AND pr.resource_id = p_resource_id
    ) s
    WHERE pid IS NOT NULL;

    RETURN;
  END IF;

  IF p_resource_type = 'hotels' THEN
    rel := to_regclass('public.hotels');
    IF rel IS NULL THEN
      RETURN;
    END IF;

    has_owner := EXISTS (
      SELECT 1
      FROM pg_attribute a
      WHERE a.attrelid = rel
        AND a.attname = 'owner_partner_id'
        AND a.attisdropped = false
    );

    RETURN QUERY
    SELECT DISTINCT pid
    FROM (
      SELECT pid
      FROM (
        SELECT CASE WHEN has_owner THEN (h.owner_partner_id) ELSE NULL END AS pid
        FROM public.hotels h
        WHERE h.id = p_resource_id
      ) o
      WHERE pid IS NOT NULL
      UNION ALL
      SELECT pr.partner_id AS pid
      FROM public.partner_resources pr
      WHERE pr.resource_type = 'hotels'
        AND pr.resource_id = p_resource_id
    ) s
    WHERE pid IS NOT NULL;

    RETURN;
  END IF;

  IF p_resource_type = 'transport' THEN
    rel := to_regclass('public.transport_routes');
    IF rel IS NULL THEN
      RETURN;
    END IF;

    has_owner := EXISTS (
      SELECT 1
      FROM pg_attribute a
      WHERE a.attrelid = rel
        AND a.attname = 'owner_partner_id'
        AND a.attisdropped = false
    );

    RETURN QUERY
    SELECT DISTINCT pid
    FROM (
      SELECT pid
      FROM (
        SELECT CASE WHEN has_owner THEN (r.owner_partner_id) ELSE NULL END AS pid
        FROM public.transport_routes r
        WHERE r.id = p_resource_id
      ) o
      WHERE pid IS NOT NULL
      UNION ALL
      SELECT pr.partner_id AS pid
      FROM public.partner_resources pr
      WHERE pr.resource_type = 'transport'
        AND pr.resource_id = p_resource_id
    ) s
    WHERE pid IS NOT NULL;

    RETURN;
  END IF;

  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_partner_service_fulfillment_from_booking(
  p_resource_type text,
  p_booking_id uuid,
  p_resource_id uuid,
  p_start_date date,
  p_end_date date,
  p_total_price numeric,
  p_currency text,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_reference text,
  p_summary text,
  p_created_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid uuid;
  fid uuid;
  deadline timestamptz;
BEGIN
  pid := public.partner_service_fulfillment_partner_id_for_resource(p_resource_type, p_resource_id);
  IF pid IS NULL THEN
    RETURN NULL;
  END IF;

  deadline := COALESCE(p_created_at, NOW()) + INTERVAL '4 hours';

  IF p_resource_type = 'cars' THEN
    INSERT INTO public.partner_service_fulfillments(
      partner_id,
      resource_type,
      booking_id,
      resource_id,
      status,
      sla_deadline_at,
      reference,
      summary,
      start_date,
      end_date,
      total_price,
      currency,
      created_at
    )
    VALUES (
      pid,
      p_resource_type,
      p_booking_id,
      p_resource_id,
      'pending_acceptance',
      deadline,
      p_reference,
      p_summary,
      p_start_date,
      p_end_date,
      p_total_price,
      COALESCE(NULLIF(p_currency, ''), 'EUR'),
      COALESCE(p_created_at, NOW())
    )
    ON CONFLICT (resource_type, booking_id) WHERE resource_type = 'cars'
    DO UPDATE SET
      partner_id = EXCLUDED.partner_id,
      resource_id = EXCLUDED.resource_id,
      reference = EXCLUDED.reference,
      summary = EXCLUDED.summary,
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      total_price = EXCLUDED.total_price,
      currency = EXCLUDED.currency
    RETURNING id INTO fid;
  ELSE
    INSERT INTO public.partner_service_fulfillments(
      partner_id,
      resource_type,
      booking_id,
      resource_id,
      status,
      sla_deadline_at,
      reference,
      summary,
      start_date,
      end_date,
      total_price,
      currency,
      created_at
    )
    VALUES (
      pid,
      p_resource_type,
      p_booking_id,
      p_resource_id,
      'pending_acceptance',
      deadline,
      p_reference,
      p_summary,
      p_start_date,
      p_end_date,
      p_total_price,
      COALESCE(NULLIF(p_currency, ''), 'EUR'),
      COALESCE(p_created_at, NOW())
    )
    ON CONFLICT (resource_type, booking_id, partner_id) WHERE resource_type IN ('trips','hotels','transport')
    DO UPDATE SET
      resource_id = EXCLUDED.resource_id,
      reference = EXCLUDED.reference,
      summary = EXCLUDED.summary,
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      total_price = EXCLUDED.total_price,
      currency = EXCLUDED.currency
    RETURNING id INTO fid;
  END IF;

  INSERT INTO public.partner_service_fulfillment_contacts(
    fulfillment_id,
    customer_name,
    customer_email,
    customer_phone,
    created_at
  )
  VALUES (
    fid,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    COALESCE(p_created_at, NOW())
  )
  ON CONFLICT (fulfillment_id)
  DO UPDATE SET
    customer_name = EXCLUDED.customer_name,
    customer_email = EXCLUDED.customer_email,
    customer_phone = EXCLUDED.customer_phone;

  RETURN fid;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_partner_service_fulfillment_from_booking(
  p_resource_type text,
  p_booking_id uuid,
  p_resource_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_total_price numeric,
  p_currency text,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_reference text,
  p_summary text,
  p_created_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fid uuid;
BEGIN
  SELECT public.upsert_partner_service_fulfillment_from_booking(
    p_resource_type,
    p_booking_id,
    p_resource_id,
    p_start_date::date,
    p_end_date::date,
    p_total_price,
    p_currency,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    p_reference,
    p_summary,
    p_created_at
  )
  INTO fid;

  RETURN fid;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_partner_service_fulfillment_from_booking_with_partner(
  p_partner_id uuid,
  p_resource_type text,
  p_booking_id uuid,
  p_resource_id uuid,
  p_start_date date,
  p_end_date date,
  p_total_price numeric,
  p_currency text,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_reference text,
  p_summary text,
  p_created_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid uuid;
  fid uuid;
  deadline timestamptz;
BEGIN
  pid := COALESCE(p_partner_id, public.partner_service_fulfillment_partner_id_for_resource(p_resource_type, p_resource_id));
  IF pid IS NULL THEN
    RETURN NULL;
  END IF;

  deadline := COALESCE(p_created_at, NOW()) + INTERVAL '4 hours';

  IF p_resource_type = 'cars' THEN
    INSERT INTO public.partner_service_fulfillments(
      partner_id,
      resource_type,
      booking_id,
      resource_id,
      status,
      sla_deadline_at,
      reference,
      summary,
      start_date,
      end_date,
      total_price,
      currency,
      created_at
    )
    VALUES (
      pid,
      p_resource_type,
      p_booking_id,
      p_resource_id,
      'pending_acceptance',
      deadline,
      p_reference,
      p_summary,
      p_start_date,
      p_end_date,
      p_total_price,
      COALESCE(NULLIF(p_currency, ''), 'EUR'),
      COALESCE(p_created_at, NOW())
    )
    ON CONFLICT (resource_type, booking_id) WHERE resource_type = 'cars'
    DO UPDATE SET
      partner_id = EXCLUDED.partner_id,
      resource_id = EXCLUDED.resource_id,
      reference = EXCLUDED.reference,
      summary = EXCLUDED.summary,
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      total_price = EXCLUDED.total_price,
      currency = EXCLUDED.currency
    RETURNING id INTO fid;
  ELSE
    INSERT INTO public.partner_service_fulfillments(
      partner_id,
      resource_type,
      booking_id,
      resource_id,
      status,
      sla_deadline_at,
      reference,
      summary,
      start_date,
      end_date,
      total_price,
      currency,
      created_at
    )
    VALUES (
      pid,
      p_resource_type,
      p_booking_id,
      p_resource_id,
      'pending_acceptance',
      deadline,
      p_reference,
      p_summary,
      p_start_date,
      p_end_date,
      p_total_price,
      COALESCE(NULLIF(p_currency, ''), 'EUR'),
      COALESCE(p_created_at, NOW())
    )
    ON CONFLICT (resource_type, booking_id, partner_id) WHERE resource_type IN ('trips','hotels','transport')
    DO UPDATE SET
      resource_id = EXCLUDED.resource_id,
      reference = EXCLUDED.reference,
      summary = EXCLUDED.summary,
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      total_price = EXCLUDED.total_price,
      currency = EXCLUDED.currency
    RETURNING id INTO fid;
  END IF;

  INSERT INTO public.partner_service_fulfillment_contacts(
    fulfillment_id,
    customer_name,
    customer_email,
    customer_phone,
    created_at
  )
  VALUES (
    fid,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    COALESCE(p_created_at, NOW())
  )
  ON CONFLICT (fulfillment_id)
  DO UPDATE SET
    customer_name = EXCLUDED.customer_name,
    customer_email = EXCLUDED.customer_email,
    customer_phone = EXCLUDED.customer_phone;

  RETURN fid;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_partner_service_fulfillments_sync_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_active uuid;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.resource_type NOT IN ('trips', 'hotels', 'transport') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('awaiting_payment', 'accepted') THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('partner_service_fulfillments:' || NEW.resource_type),
    hashtext(NEW.booking_id::text)
  );

  SELECT f.id
  INTO existing_active
  FROM public.partner_service_fulfillments f
  WHERE f.resource_type = NEW.resource_type
    AND f.booking_id = NEW.booking_id
    AND f.id <> NEW.id
    AND f.status IN ('awaiting_payment', 'accepted')
  ORDER BY f.accepted_at NULLS LAST, f.created_at, f.id
  LIMIT 1;

  IF existing_active IS NOT NULL THEN
    NEW.status := 'closed';
    NEW.updated_at := now();
    NEW.accepted_at := OLD.accepted_at;
    NEW.accepted_by := OLD.accepted_by;
    NEW.contact_revealed_at := OLD.contact_revealed_at;
    RETURN NEW;
  END IF;

  WITH to_expire AS (
    SELECT f.id
    FROM public.partner_service_fulfillments f
    WHERE f.resource_type = NEW.resource_type
      AND f.booking_id = NEW.booking_id
      AND f.id <> NEW.id
      AND f.status = 'pending_acceptance'
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.partner_service_fulfillments f
  SET status = 'closed',
      updated_at = now()
  FROM to_expire e
  WHERE f.id = e.id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_partner_service_fulfillments_expire_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_active uuid;
BEGIN
  IF NEW.resource_type NOT IN ('trips', 'hotels', 'transport') THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM 'pending_acceptance' THEN
    RETURN NEW;
  END IF;

  SELECT f.id
  INTO existing_active
  FROM public.partner_service_fulfillments f
  WHERE f.resource_type = NEW.resource_type
    AND f.booking_id = NEW.booking_id
    AND f.status IN ('awaiting_payment', 'accepted')
  ORDER BY f.accepted_at NULLS LAST, f.created_at, f.id
  LIMIT 1;

  IF existing_active IS NOT NULL THEN
    NEW.status := 'closed';
    NEW.updated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.partner_service_fulfillments') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'DROP TRIGGER IF EXISTS trg_partner_service_fulfillments_sync_status ON public.partner_service_fulfillments';
  EXECUTE 'CREATE TRIGGER trg_partner_service_fulfillments_sync_status BEFORE UPDATE OF status ON public.partner_service_fulfillments FOR EACH ROW EXECUTE FUNCTION public.trg_partner_service_fulfillments_sync_status()';

  EXECUTE 'DROP TRIGGER IF EXISTS trg_partner_service_fulfillments_expire_on_insert ON public.partner_service_fulfillments';
  EXECUTE 'CREATE TRIGGER trg_partner_service_fulfillments_expire_on_insert BEFORE INSERT ON public.partner_service_fulfillments FOR EACH ROW EXECUTE FUNCTION public.trg_partner_service_fulfillments_expire_on_insert()';
END $$;

WITH active AS (
  SELECT resource_type, booking_id
  FROM public.partner_service_fulfillments
  WHERE resource_type IN ('trips', 'hotels', 'transport')
    AND status IN ('awaiting_payment', 'accepted')
)
UPDATE public.partner_service_fulfillments f
SET status = 'closed',
    updated_at = now()
FROM active a
WHERE f.resource_type = a.resource_type
  AND f.booking_id = a.booking_id
  AND (
    f.status = 'pending_acceptance'
    OR (f.status = 'expired' AND f.accepted_at IS NULL)
  );

CREATE OR REPLACE FUNCTION public.trg_partner_service_fulfillment_from_transport_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  details_json jsonb;
  form_json jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF NEW.route_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  details_json := jsonb_strip_nulls(jsonb_build_object(
    'travel_date', NEW.travel_date,
    'travel_time', NEW.travel_time,
    'num_passengers', NEW.num_passengers,
    'num_bags', NEW.num_bags,
    'num_oversize_bags', NEW.num_oversize_bags,
    'child_seats', NEW.child_seats,
    'booster_seats', NEW.booster_seats,
    'waiting_minutes', NEW.waiting_minutes,
    'pickup_address', NULLIF(NEW.pickup_address, ''),
    'dropoff_address', NULLIF(NEW.dropoff_address, ''),
    'flight_number', NULLIF(NEW.flight_number, ''),
    'notes', NULLIF(NEW.notes, ''),
    'origin_location_id', NEW.origin_location_id,
    'destination_location_id', NEW.destination_location_id
  ));

  form_json := jsonb_strip_nulls(jsonb_build_object(
    'route_id', NEW.route_id,
    'origin_location_id', NEW.origin_location_id,
    'destination_location_id', NEW.destination_location_id,
    'travel_date', NEW.travel_date,
    'travel_time', NEW.travel_time,
    'num_passengers', NEW.num_passengers,
    'num_bags', NEW.num_bags,
    'num_oversize_bags', NEW.num_oversize_bags,
    'child_seats', NEW.child_seats,
    'booster_seats', NEW.booster_seats,
    'waiting_minutes', NEW.waiting_minutes,
    'pickup_address', NULLIF(NEW.pickup_address, ''),
    'dropoff_address', NULLIF(NEW.dropoff_address, ''),
    'flight_number', NULLIF(NEW.flight_number, ''),
    'notes', NULLIF(NEW.notes, ''),
    'customer_name', NULLIF(NEW.customer_name, ''),
    'customer_email', NULLIF(NEW.customer_email, ''),
    'customer_phone', NULLIF(NEW.customer_phone, ''),
    'base_price', NEW.base_price,
    'extras_price', NEW.extras_price,
    'total_price', NEW.total_price,
    'currency', NEW.currency,
    'lang', NEW.lang
  ));

  PERFORM public.upsert_partner_service_fulfillments_for_resource_partners(
    'transport',
    NEW.id,
    NEW.route_id,
    NEW.travel_date::date,
    NEW.travel_date::date,
    NEW.total_price,
    COALESCE(NULLIF(NEW.currency, ''), 'EUR'),
    NEW.customer_name,
    NEW.customer_email,
    NEW.customer_phone,
    CONCAT('TRANSPORT-', SUBSTRING(NEW.id::text, 1, 8)),
    'Transport booking',
    NEW.created_at::timestamptz,
    details_json
  );

  INSERT INTO public.partner_service_fulfillment_form_snapshots(
    fulfillment_id,
    payload,
    created_at
  )
  SELECT
    f.id,
    COALESCE(form_json, '{}'::jsonb),
    COALESCE(NEW.created_at, NOW())
  FROM public.partner_service_fulfillments f
  WHERE f.resource_type = 'transport'
    AND f.booking_id = NEW.id
  ON CONFLICT (fulfillment_id)
  DO UPDATE SET
    payload = EXCLUDED.payload;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.transport_bookings') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'DROP TRIGGER IF EXISTS trg_partner_service_fulfillment_from_transport_booking_ins ON public.transport_bookings';
  EXECUTE 'CREATE TRIGGER trg_partner_service_fulfillment_from_transport_booking_ins AFTER INSERT ON public.transport_bookings FOR EACH ROW EXECUTE FUNCTION public.trg_partner_service_fulfillment_from_transport_booking()';

  EXECUTE 'DROP TRIGGER IF EXISTS trg_partner_service_fulfillment_from_transport_booking_upd ON public.transport_bookings';
  EXECUTE 'CREATE TRIGGER trg_partner_service_fulfillment_from_transport_booking_upd AFTER UPDATE OF route_id, origin_location_id, destination_location_id, travel_date, travel_time, num_passengers, num_bags, num_oversize_bags, child_seats, booster_seats, waiting_minutes, pickup_address, dropoff_address, flight_number, notes, customer_name, customer_email, customer_phone, total_price, currency, status ON public.transport_bookings FOR EACH ROW EXECUTE FUNCTION public.trg_partner_service_fulfillment_from_transport_booking()';
END $$;

CREATE OR REPLACE FUNCTION public.trg_partner_resources_backfill_transport_fulfillments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b record;
  details_json jsonb;
  form_json jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF NEW.resource_type IS DISTINCT FROM 'transport' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.partner_id IS NOT DISTINCT FROM OLD.partner_id
      AND NEW.resource_type IS NOT DISTINCT FROM OLD.resource_type
      AND NEW.resource_id IS NOT DISTINCT FROM OLD.resource_id
    THEN
      RETURN NEW;
    END IF;
  END IF;

  IF to_regclass('public.transport_bookings') IS NULL THEN
    RETURN NEW;
  END IF;

  FOR b IN
    SELECT *
    FROM public.transport_bookings
    WHERE route_id = NEW.resource_id
      AND status IS DISTINCT FROM 'cancelled'
  LOOP
    details_json := jsonb_strip_nulls(jsonb_build_object(
      'travel_date', b.travel_date,
      'travel_time', b.travel_time,
      'num_passengers', b.num_passengers,
      'num_bags', b.num_bags,
      'num_oversize_bags', b.num_oversize_bags,
      'child_seats', b.child_seats,
      'booster_seats', b.booster_seats,
      'waiting_minutes', b.waiting_minutes,
      'pickup_address', NULLIF(b.pickup_address, ''),
      'dropoff_address', NULLIF(b.dropoff_address, ''),
      'flight_number', NULLIF(b.flight_number, ''),
      'notes', NULLIF(b.notes, ''),
      'origin_location_id', b.origin_location_id,
      'destination_location_id', b.destination_location_id
    ));

    form_json := jsonb_strip_nulls(jsonb_build_object(
      'route_id', b.route_id,
      'origin_location_id', b.origin_location_id,
      'destination_location_id', b.destination_location_id,
      'travel_date', b.travel_date,
      'travel_time', b.travel_time,
      'num_passengers', b.num_passengers,
      'num_bags', b.num_bags,
      'num_oversize_bags', b.num_oversize_bags,
      'child_seats', b.child_seats,
      'booster_seats', b.booster_seats,
      'waiting_minutes', b.waiting_minutes,
      'pickup_address', NULLIF(b.pickup_address, ''),
      'dropoff_address', NULLIF(b.dropoff_address, ''),
      'flight_number', NULLIF(b.flight_number, ''),
      'notes', NULLIF(b.notes, ''),
      'customer_name', NULLIF(b.customer_name, ''),
      'customer_email', NULLIF(b.customer_email, ''),
      'customer_phone', NULLIF(b.customer_phone, ''),
      'base_price', b.base_price,
      'extras_price', b.extras_price,
      'total_price', b.total_price,
      'currency', b.currency,
      'lang', b.lang
    ));

    PERFORM public.upsert_partner_service_fulfillments_for_resource_partners(
      'transport',
      b.id,
      b.route_id,
      b.travel_date::date,
      b.travel_date::date,
      b.total_price,
      COALESCE(NULLIF(b.currency, ''), 'EUR'),
      b.customer_name,
      b.customer_email,
      b.customer_phone,
      CONCAT('TRANSPORT-', SUBSTRING(b.id::text, 1, 8)),
      'Transport booking',
      b.created_at::timestamptz,
      details_json
    );

    INSERT INTO public.partner_service_fulfillment_form_snapshots(fulfillment_id, payload, created_at)
    SELECT
      f.id,
      COALESCE(form_json, '{}'::jsonb),
      COALESCE(b.created_at, NOW())
    FROM public.partner_service_fulfillments f
    WHERE f.resource_type = 'transport'
      AND f.booking_id = b.id
    ON CONFLICT (fulfillment_id)
    DO UPDATE SET
      payload = EXCLUDED.payload;
  END LOOP;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.partner_resources') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'DROP TRIGGER IF EXISTS trg_partner_resources_backfill_transport_fulfillments_ins ON public.partner_resources';
  EXECUTE 'CREATE TRIGGER trg_partner_resources_backfill_transport_fulfillments_ins AFTER INSERT OR UPDATE ON public.partner_resources FOR EACH ROW WHEN (NEW.resource_type = ''transport'') EXECUTE FUNCTION public.trg_partner_resources_backfill_transport_fulfillments()';
END $$;

CREATE OR REPLACE FUNCTION public.admin_backfill_partner_service_fulfillments_for_resource(
  p_resource_type text,
  p_resource_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b record;
  details_json jsonb;
  form_json jsonb;
  total_cnt integer := 0;
  cnt integer;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_resource_type = 'trips' THEN
    IF to_regclass('public.trip_bookings') IS NULL THEN
      RETURN 0;
    END IF;

    FOR b IN
      SELECT *
      FROM public.trip_bookings
      WHERE trip_id = p_resource_id
        AND status IS DISTINCT FROM 'cancelled'
    LOOP
      details_json := jsonb_strip_nulls(jsonb_build_object(
        'preferred_date', b.trip_date,
        'arrival_date', b.arrival_date,
        'departure_date', b.departure_date,
        'num_adults', b.num_adults,
        'num_children', b.num_children
      ));

      SELECT public.upsert_partner_service_fulfillments_for_resource_partners(
        'trips',
        b.id,
        b.trip_id,
        COALESCE(b.trip_date, b.arrival_date),
        b.departure_date,
        b.total_price,
        'EUR',
        b.customer_name,
        b.customer_email,
        b.customer_phone,
        CONCAT('TRIP-', SUBSTRING(b.id::text, 1, 8)),
        'Trip booking',
        b.created_at,
        details_json
      )
      INTO cnt;

      total_cnt := total_cnt + COALESCE(cnt, 0);
    END LOOP;

    RETURN total_cnt;
  END IF;

  IF p_resource_type = 'hotels' THEN
    IF to_regclass('public.hotel_bookings') IS NULL THEN
      RETURN 0;
    END IF;

    FOR b IN
      SELECT *
      FROM public.hotel_bookings
      WHERE hotel_id = p_resource_id
        AND status IS DISTINCT FROM 'cancelled'
    LOOP
      SELECT public.upsert_partner_service_fulfillments_for_resource_partners(
        'hotels',
        b.id,
        b.hotel_id,
        b.arrival_date,
        b.departure_date,
        b.total_price,
        'EUR',
        b.customer_name,
        b.customer_email,
        b.customer_phone,
        CONCAT('HOTEL-', SUBSTRING(b.id::text, 1, 8)),
        'Hotel booking',
        b.created_at,
        NULL
      )
      INTO cnt;

      total_cnt := total_cnt + COALESCE(cnt, 0);
    END LOOP;

    RETURN total_cnt;
  END IF;

  IF p_resource_type = 'transport' THEN
    IF to_regclass('public.transport_bookings') IS NULL THEN
      RETURN 0;
    END IF;

    FOR b IN
      SELECT *
      FROM public.transport_bookings
      WHERE route_id = p_resource_id
        AND status IS DISTINCT FROM 'cancelled'
    LOOP
      details_json := jsonb_strip_nulls(jsonb_build_object(
        'travel_date', b.travel_date,
        'travel_time', b.travel_time,
        'num_passengers', b.num_passengers,
        'num_bags', b.num_bags,
        'num_oversize_bags', b.num_oversize_bags,
        'child_seats', b.child_seats,
        'booster_seats', b.booster_seats,
        'waiting_minutes', b.waiting_minutes,
        'pickup_address', NULLIF(b.pickup_address, ''),
        'dropoff_address', NULLIF(b.dropoff_address, ''),
        'flight_number', NULLIF(b.flight_number, ''),
        'notes', NULLIF(b.notes, ''),
        'origin_location_id', b.origin_location_id,
        'destination_location_id', b.destination_location_id
      ));

      SELECT public.upsert_partner_service_fulfillments_for_resource_partners(
        'transport',
        b.id,
        b.route_id,
        b.travel_date::date,
        b.travel_date::date,
        b.total_price,
        COALESCE(NULLIF(b.currency, ''), 'EUR'),
        b.customer_name,
        b.customer_email,
        b.customer_phone,
        CONCAT('TRANSPORT-', SUBSTRING(b.id::text, 1, 8)),
        'Transport booking',
        b.created_at,
        details_json
      )
      INTO cnt;

      total_cnt := total_cnt + COALESCE(cnt, 0);

      form_json := jsonb_strip_nulls(jsonb_build_object(
        'route_id', b.route_id,
        'origin_location_id', b.origin_location_id,
        'destination_location_id', b.destination_location_id,
        'travel_date', b.travel_date,
        'travel_time', b.travel_time,
        'num_passengers', b.num_passengers,
        'num_bags', b.num_bags,
        'num_oversize_bags', b.num_oversize_bags,
        'child_seats', b.child_seats,
        'booster_seats', b.booster_seats,
        'waiting_minutes', b.waiting_minutes,
        'pickup_address', NULLIF(b.pickup_address, ''),
        'dropoff_address', NULLIF(b.dropoff_address, ''),
        'flight_number', NULLIF(b.flight_number, ''),
        'notes', NULLIF(b.notes, ''),
        'customer_name', NULLIF(b.customer_name, ''),
        'customer_email', NULLIF(b.customer_email, ''),
        'customer_phone', NULLIF(b.customer_phone, ''),
        'base_price', b.base_price,
        'extras_price', b.extras_price,
        'total_price', b.total_price,
        'currency', b.currency,
        'lang', b.lang
      ));

      INSERT INTO public.partner_service_fulfillment_form_snapshots(fulfillment_id, payload, created_at)
      SELECT
        f.id,
        COALESCE(form_json, '{}'::jsonb),
        COALESCE(b.created_at, NOW())
      FROM public.partner_service_fulfillments f
      WHERE f.resource_type = 'transport'
        AND f.booking_id = b.id
      ON CONFLICT (fulfillment_id)
      DO UPDATE SET
        payload = EXCLUDED.payload;
    END LOOP;

    RETURN total_cnt;
  END IF;

  RETURN 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_backfill_partner_service_fulfillments_for_resource(text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_enqueue_partner_pending_service_fulfillment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  payload jsonb;
  category text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF NEW.status <> 'pending_acceptance' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(OLD.status, '') = COALESCE(NEW.status, '') THEN
    RETURN NEW;
  END IF;

  category := CASE
    WHEN NEW.resource_type = 'cars' THEN 'cars'
    WHEN NEW.resource_type = 'trips' THEN 'trips'
    WHEN NEW.resource_type = 'hotels' THEN 'hotels'
    WHEN NEW.resource_type = 'transport' THEN 'transport'
    ELSE 'trips'
  END;

  payload := jsonb_build_object(
    'category', category,
    'record_id', NEW.id::text,
    'event', 'partner_pending_acceptance',
    'table', 'partner_service_fulfillments',
    'record', to_jsonb(NEW)
  );

  PERFORM public.enqueue_admin_notification(
    category,
    'partner_pending_acceptance',
    NEW.id::text,
    'partner_service_fulfillments',
    payload,
    'partner_pending_acceptance:service:' || NEW.id::text
  );

  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.sync_car_booking_status_from_deposit_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_car_payment_status boolean := false;
BEGIN
  IF NEW.resource_type NOT IN ('cars', 'transport') THEN
    RETURN NEW;
  END IF;

  IF NEW.booking_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.status, '') <> 'paid' AND NEW.paid_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.resource_type = 'cars' THEN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'car_bookings'
        AND column_name = 'payment_status'
    )
    INTO has_car_payment_status;

    IF has_car_payment_status THEN
      UPDATE public.car_bookings cb
      SET
        payment_status = 'paid',
        status = CASE
          WHEN COALESCE(cb.status, '') IN ('pending', 'message_sent') THEN 'confirmed'
          ELSE cb.status
        END
      WHERE cb.id = NEW.booking_id;
    ELSE
      UPDATE public.car_bookings cb
      SET
        status = CASE
          WHEN COALESCE(cb.status, '') IN ('pending', 'message_sent') THEN 'confirmed'
          ELSE cb.status
        END
      WHERE cb.id = NEW.booking_id;
    END IF;

    RETURN NEW;
  END IF;

  IF to_regclass('public.transport_bookings') IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.transport_bookings tb
  SET
    payment_status = 'paid',
    paid_at = COALESCE(tb.paid_at, NEW.paid_at, now()),
    status = CASE
      WHEN COALESCE(tb.status, '') IN ('pending', 'awaiting_payment') THEN 'confirmed'
      ELSE tb.status
    END
  WHERE tb.id = NEW.booking_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_car_booking_status_from_deposit_paid ON public.service_deposit_requests;
CREATE TRIGGER trg_sync_car_booking_status_from_deposit_paid
AFTER INSERT OR UPDATE OF status, paid_at ON public.service_deposit_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_car_booking_status_from_deposit_paid();

INSERT INTO public.service_deposit_rules (resource_type, mode, amount, currency, include_children, enabled)
VALUES ('transport', 'per_person', 10, 'EUR', true, true)
ON CONFLICT (resource_type) DO NOTHING;

DO $$
DECLARE
  b record;
  details_json jsonb;
  form_json jsonb;
BEGIN
  IF to_regclass('public.transport_bookings') IS NOT NULL THEN
    FOR b IN
      SELECT *
      FROM public.transport_bookings
      WHERE route_id IS NOT NULL
        AND status IS DISTINCT FROM 'cancelled'
    LOOP
      details_json := jsonb_strip_nulls(jsonb_build_object(
        'travel_date', b.travel_date,
        'travel_time', b.travel_time,
        'num_passengers', b.num_passengers,
        'num_bags', b.num_bags,
        'num_oversize_bags', b.num_oversize_bags,
        'child_seats', b.child_seats,
        'booster_seats', b.booster_seats,
        'waiting_minutes', b.waiting_minutes,
        'pickup_address', NULLIF(b.pickup_address, ''),
        'dropoff_address', NULLIF(b.dropoff_address, ''),
        'flight_number', NULLIF(b.flight_number, ''),
        'notes', NULLIF(b.notes, ''),
        'origin_location_id', b.origin_location_id,
        'destination_location_id', b.destination_location_id
      ));

      PERFORM public.upsert_partner_service_fulfillments_for_resource_partners(
        'transport',
        b.id,
        b.route_id,
        b.travel_date::date,
        b.travel_date::date,
        b.total_price,
        COALESCE(NULLIF(b.currency, ''), 'EUR'),
        b.customer_name,
        b.customer_email,
        b.customer_phone,
        CONCAT('TRANSPORT-', SUBSTRING(b.id::text, 1, 8)),
        'Transport booking',
        b.created_at::timestamptz,
        details_json
      );

      form_json := jsonb_strip_nulls(jsonb_build_object(
        'route_id', b.route_id,
        'origin_location_id', b.origin_location_id,
        'destination_location_id', b.destination_location_id,
        'travel_date', b.travel_date,
        'travel_time', b.travel_time,
        'num_passengers', b.num_passengers,
        'num_bags', b.num_bags,
        'num_oversize_bags', b.num_oversize_bags,
        'child_seats', b.child_seats,
        'booster_seats', b.booster_seats,
        'waiting_minutes', b.waiting_minutes,
        'pickup_address', NULLIF(b.pickup_address, ''),
        'dropoff_address', NULLIF(b.dropoff_address, ''),
        'flight_number', NULLIF(b.flight_number, ''),
        'notes', NULLIF(b.notes, ''),
        'customer_name', NULLIF(b.customer_name, ''),
        'customer_email', NULLIF(b.customer_email, ''),
        'customer_phone', NULLIF(b.customer_phone, ''),
        'base_price', b.base_price,
        'extras_price', b.extras_price,
        'total_price', b.total_price,
        'currency', b.currency,
        'lang', b.lang
      ));

      INSERT INTO public.partner_service_fulfillment_form_snapshots(fulfillment_id, payload, created_at)
      SELECT
        f.id,
        COALESCE(form_json, '{}'::jsonb),
        COALESCE(b.created_at, NOW())
      FROM public.partner_service_fulfillments f
      WHERE f.resource_type = 'transport'
        AND f.booking_id = b.id
      ON CONFLICT (fulfillment_id)
      DO UPDATE SET
        payload = EXCLUDED.payload;
    END LOOP;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.transport_bookings') IS NOT NULL
     AND to_regclass('public.service_deposit_requests') IS NOT NULL THEN
    UPDATE public.transport_bookings tb
    SET
      payment_status = 'paid',
      paid_at = COALESCE(tb.paid_at, dr.paid_at, now()),
      status = CASE
        WHEN COALESCE(tb.status, '') IN ('pending', 'awaiting_payment') THEN 'confirmed'
        ELSE tb.status
      END
    FROM public.service_deposit_requests dr
    WHERE dr.resource_type = 'transport'
      AND dr.booking_id = tb.id
      AND (COALESCE(dr.status, '') = 'paid' OR dr.paid_at IS NOT NULL);
  END IF;
END $$;
