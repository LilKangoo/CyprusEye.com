-- =====================================================
-- Service coupons control center (trips/hotels/transport/shop)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.service_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type text NOT NULL CHECK (service_type IN ('trips', 'hotels', 'transport', 'shop')),
  code text NOT NULL,
  name text,
  description text,
  internal_notes text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'expired')),
  is_active boolean NOT NULL DEFAULT true,
  discount_type text NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent', 'fixed')),
  discount_value numeric(12,2) NOT NULL CHECK (discount_value > 0),
  currency text NOT NULL DEFAULT 'EUR',
  starts_at timestamptz,
  expires_at timestamptz,
  single_use boolean NOT NULL DEFAULT false,
  usage_limit_total integer,
  usage_limit_per_user integer,
  min_order_total numeric(12,2),
  partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  partner_commission_bps_override integer,
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_coupons_dates_check CHECK (expires_at IS NULL OR starts_at IS NULL OR expires_at >= starts_at),
  CONSTRAINT service_coupons_percent_check CHECK (discount_type <> 'percent' OR (discount_value > 0 AND discount_value <= 100)),
  CONSTRAINT service_coupons_usage_limits_check CHECK (
    (usage_limit_total IS NULL OR usage_limit_total > 0)
    AND (usage_limit_per_user IS NULL OR usage_limit_per_user > 0)
  ),
  CONSTRAINT service_coupons_min_total_check CHECK (min_order_total IS NULL OR min_order_total >= 0),
  CONSTRAINT service_coupons_partner_bps_check CHECK (
    partner_commission_bps_override IS NULL OR partner_commission_bps_override >= 0
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS service_coupons_service_code_unique_idx
  ON public.service_coupons (service_type, upper(code));

CREATE INDEX IF NOT EXISTS service_coupons_status_idx
  ON public.service_coupons (service_type, status, is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS service_coupons_partner_idx
  ON public.service_coupons (partner_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.service_coupons_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.code := upper(trim(COALESCE(NEW.code, '')));
  IF NEW.code = '' THEN
    RAISE EXCEPTION 'service_coupon_code_required';
  END IF;

  IF NEW.single_use THEN
    NEW.usage_limit_total := 1;
    IF NEW.usage_limit_per_user IS NULL OR NEW.usage_limit_per_user > 1 THEN
      NEW.usage_limit_per_user := 1;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_coupons_before_write ON public.service_coupons;
CREATE TRIGGER trg_service_coupons_before_write
  BEFORE INSERT OR UPDATE ON public.service_coupons
  FOR EACH ROW
  EXECUTE FUNCTION public.service_coupons_before_write();

CREATE TABLE IF NOT EXISTS public.service_coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.service_coupons(id) ON DELETE CASCADE,
  service_type text NOT NULL CHECK (service_type IN ('trips', 'hotels', 'transport', 'shop')),
  booking_id uuid,
  booking_reference text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  base_total numeric(12,2),
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  final_total numeric(12,2),
  currency text NOT NULL DEFAULT 'EUR',
  source text NOT NULL DEFAULT 'booking' CHECK (source IN ('booking', 'admin', 'recompute')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_coupon_redemptions_coupon_idx
  ON public.service_coupon_redemptions (coupon_id, created_at DESC);

CREATE INDEX IF NOT EXISTS service_coupon_redemptions_service_idx
  ON public.service_coupon_redemptions (service_type, created_at DESC);

CREATE INDEX IF NOT EXISTS service_coupon_redemptions_booking_idx
  ON public.service_coupon_redemptions (booking_id);

CREATE UNIQUE INDEX IF NOT EXISTS service_coupon_redemptions_coupon_booking_unique_idx
  ON public.service_coupon_redemptions (coupon_id, booking_id)
  WHERE booking_id IS NOT NULL;

CREATE OR REPLACE VIEW public.service_coupon_usage_stats AS
SELECT
  c.id AS coupon_id,
  c.service_type,
  count(r.id)::integer AS redemption_count,
  COALESCE(sum(r.discount_amount), 0)::numeric(12,2) AS total_discount_amount,
  max(r.created_at) AS last_redeemed_at
FROM public.service_coupons c
LEFT JOIN public.service_coupon_redemptions r
  ON r.coupon_id = c.id
GROUP BY c.id, c.service_type;

DO $$
BEGIN
  IF to_regclass('public.trip_bookings') IS NOT NULL THEN
    ALTER TABLE public.trip_bookings
      ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES public.service_coupons(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS coupon_code text,
      ADD COLUMN IF NOT EXISTS base_price numeric(12,2),
      ADD COLUMN IF NOT EXISTS coupon_discount_amount numeric(12,2),
      ADD COLUMN IF NOT EXISTS final_price numeric(12,2),
      ADD COLUMN IF NOT EXISTS coupon_partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS coupon_partner_commission_bps integer;

    ALTER TABLE public.trip_bookings
      DROP CONSTRAINT IF EXISTS trip_bookings_coupon_partner_commission_bps_check;

    ALTER TABLE public.trip_bookings
      ADD CONSTRAINT trip_bookings_coupon_partner_commission_bps_check
      CHECK (coupon_partner_commission_bps IS NULL OR coupon_partner_commission_bps >= 0);
  END IF;

  IF to_regclass('public.hotel_bookings') IS NOT NULL THEN
    ALTER TABLE public.hotel_bookings
      ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES public.service_coupons(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS coupon_code text,
      ADD COLUMN IF NOT EXISTS base_price numeric(12,2),
      ADD COLUMN IF NOT EXISTS coupon_discount_amount numeric(12,2),
      ADD COLUMN IF NOT EXISTS final_price numeric(12,2),
      ADD COLUMN IF NOT EXISTS coupon_partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS coupon_partner_commission_bps integer;

    ALTER TABLE public.hotel_bookings
      DROP CONSTRAINT IF EXISTS hotel_bookings_coupon_partner_commission_bps_check;

    ALTER TABLE public.hotel_bookings
      ADD CONSTRAINT hotel_bookings_coupon_partner_commission_bps_check
      CHECK (coupon_partner_commission_bps IS NULL OR coupon_partner_commission_bps >= 0);
  END IF;

  IF to_regclass('public.transport_bookings') IS NOT NULL THEN
    ALTER TABLE public.transport_bookings
      ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES public.service_coupons(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS coupon_code text,
      ADD COLUMN IF NOT EXISTS coupon_discount_amount numeric(12,2),
      ADD COLUMN IF NOT EXISTS coupon_partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS coupon_partner_commission_bps integer;

    ALTER TABLE public.transport_bookings
      DROP CONSTRAINT IF EXISTS transport_bookings_coupon_partner_commission_bps_check;

    ALTER TABLE public.transport_bookings
      ADD CONSTRAINT transport_bookings_coupon_partner_commission_bps_check
      CHECK (coupon_partner_commission_bps IS NULL OR coupon_partner_commission_bps >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.trip_bookings') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS trip_bookings_coupon_id_idx ON public.trip_bookings (coupon_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS trip_bookings_coupon_partner_id_idx ON public.trip_bookings (coupon_partner_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS trip_bookings_coupon_code_idx ON public.trip_bookings (coupon_code)';
  END IF;

  IF to_regclass('public.hotel_bookings') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS hotel_bookings_coupon_id_idx ON public.hotel_bookings (coupon_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS hotel_bookings_coupon_partner_id_idx ON public.hotel_bookings (coupon_partner_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS hotel_bookings_coupon_code_idx ON public.hotel_bookings (coupon_code)';
  END IF;

  IF to_regclass('public.transport_bookings') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS transport_bookings_coupon_id_idx ON public.transport_bookings (coupon_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS transport_bookings_coupon_partner_id_idx ON public.transport_bookings (coupon_partner_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS transport_bookings_coupon_code_idx ON public.transport_bookings (coupon_code)';
  END IF;
END $$;

ALTER TABLE public.service_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_coupon_redemptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.service_coupons FROM anon, authenticated;
REVOKE ALL ON TABLE public.service_coupon_redemptions FROM anon, authenticated;
REVOKE ALL ON TABLE public.service_coupon_usage_stats FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.service_coupons TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.service_coupon_redemptions TO service_role;
GRANT SELECT ON TABLE public.service_coupon_usage_stats TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.service_coupons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.service_coupon_redemptions TO authenticated;
GRANT SELECT ON TABLE public.service_coupon_usage_stats TO authenticated;

DO $$
DECLARE
  has_current_admin boolean := (to_regprocedure('public.is_current_user_admin()') IS NOT NULL);
  has_is_admin boolean := (to_regprocedure('public.is_admin()') IS NOT NULL);
  has_partner_user boolean := (to_regprocedure('public.is_partner_user(uuid)') IS NOT NULL);
BEGIN
  DROP POLICY IF EXISTS service_coupons_admin_all ON public.service_coupons;
  DROP POLICY IF EXISTS service_coupons_partner_read ON public.service_coupons;
  DROP POLICY IF EXISTS service_coupon_redemptions_admin_all ON public.service_coupon_redemptions;
  DROP POLICY IF EXISTS service_coupon_redemptions_partner_read ON public.service_coupon_redemptions;

  IF has_current_admin THEN
    EXECUTE 'CREATE POLICY service_coupons_admin_all ON public.service_coupons FOR ALL TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin())';
    EXECUTE 'CREATE POLICY service_coupon_redemptions_admin_all ON public.service_coupon_redemptions FOR ALL TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin())';
  ELSIF has_is_admin THEN
    EXECUTE 'CREATE POLICY service_coupons_admin_all ON public.service_coupons FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
    EXECUTE 'CREATE POLICY service_coupon_redemptions_admin_all ON public.service_coupon_redemptions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  ELSE
    EXECUTE 'CREATE POLICY service_coupons_admin_all ON public.service_coupons FOR ALL TO authenticated USING ((auth.jwt() -> ''user_metadata'' ->> ''is_admin'')::boolean = true) WITH CHECK ((auth.jwt() -> ''user_metadata'' ->> ''is_admin'')::boolean = true)';
    EXECUTE 'CREATE POLICY service_coupon_redemptions_admin_all ON public.service_coupon_redemptions FOR ALL TO authenticated USING ((auth.jwt() -> ''user_metadata'' ->> ''is_admin'')::boolean = true) WITH CHECK ((auth.jwt() -> ''user_metadata'' ->> ''is_admin'')::boolean = true)';
  END IF;

  IF has_partner_user THEN
    EXECUTE 'CREATE POLICY service_coupons_partner_read ON public.service_coupons FOR SELECT TO authenticated USING (partner_id IS NOT NULL AND public.is_partner_user(partner_id))';
    EXECUTE 'CREATE POLICY service_coupon_redemptions_partner_read ON public.service_coupon_redemptions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.service_coupons c WHERE c.id = coupon_id AND c.partner_id IS NOT NULL AND public.is_partner_user(c.partner_id)))';
  END IF;
END $$;

COMMENT ON TABLE public.service_coupons IS 'Unified admin coupon control center for trips/hotels/transport/shop (cars keep dedicated coupon engine).';
COMMENT ON TABLE public.service_coupon_redemptions IS 'Unified coupon redemptions snapshot table for non-car service bookings.';
COMMENT ON VIEW public.service_coupon_usage_stats IS 'Aggregated usage counters and discount totals for service coupons.';
