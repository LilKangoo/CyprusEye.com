-- =====================================================
-- Cars coupons system (admin-managed)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.car_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text,
  description text,
  internal_notes text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','expired')),
  is_active boolean NOT NULL DEFAULT true,
  discount_type text NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent','fixed')),
  discount_value numeric(12,2) NOT NULL CHECK (discount_value > 0),
  currency text NOT NULL DEFAULT 'EUR',
  starts_at timestamptz,
  expires_at timestamptz,
  single_use boolean NOT NULL DEFAULT false,
  usage_limit_total integer,
  usage_limit_per_user integer,
  min_rental_days integer,
  min_rental_total numeric(12,2),
  applicable_locations text[] NOT NULL DEFAULT '{}'::text[],
  applicable_offer_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  applicable_car_models text[] NOT NULL DEFAULT '{}'::text[],
  applicable_car_types text[] NOT NULL DEFAULT '{}'::text[],
  excluded_offer_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  excluded_car_models text[] NOT NULL DEFAULT '{}'::text[],
  excluded_car_types text[] NOT NULL DEFAULT '{}'::text[],
  partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  partner_commission_bps_override integer,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT car_coupons_dates_check CHECK (expires_at IS NULL OR starts_at IS NULL OR expires_at >= starts_at),
  CONSTRAINT car_coupons_percent_check CHECK (discount_type <> 'percent' OR (discount_value > 0 AND discount_value <= 100)),
  CONSTRAINT car_coupons_usage_limits_check CHECK (
    (usage_limit_total IS NULL OR usage_limit_total > 0)
    AND (usage_limit_per_user IS NULL OR usage_limit_per_user > 0)
  ),
  CONSTRAINT car_coupons_min_days_check CHECK (min_rental_days IS NULL OR min_rental_days >= 1),
  CONSTRAINT car_coupons_min_total_check CHECK (min_rental_total IS NULL OR min_rental_total >= 0),
  CONSTRAINT car_coupons_partner_bps_check CHECK (
    partner_commission_bps_override IS NULL OR partner_commission_bps_override >= 0
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS car_coupons_code_unique_idx
  ON public.car_coupons ((upper(code)));

CREATE INDEX IF NOT EXISTS car_coupons_status_idx
  ON public.car_coupons (status, is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS car_coupons_partner_idx
  ON public.car_coupons (partner_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.car_coupons_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.code := upper(trim(COALESCE(NEW.code, '')));
  IF NEW.code = '' THEN
    RAISE EXCEPTION 'coupon_code_required';
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

DROP TRIGGER IF EXISTS trg_car_coupons_before_write ON public.car_coupons;
CREATE TRIGGER trg_car_coupons_before_write
  BEFORE INSERT OR UPDATE ON public.car_coupons
  FOR EACH ROW
  EXECUTE FUNCTION public.car_coupons_before_write();

CREATE TABLE IF NOT EXISTS public.car_coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.car_coupons(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES public.car_bookings(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  base_rental_price numeric(12,2),
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  final_rental_price numeric(12,2),
  currency text NOT NULL DEFAULT 'EUR',
  source text NOT NULL DEFAULT 'booking' CHECK (source IN ('booking','admin','recompute')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(coupon_id, booking_id)
);

CREATE INDEX IF NOT EXISTS car_coupon_redemptions_coupon_idx
  ON public.car_coupon_redemptions (coupon_id, created_at DESC);

CREATE INDEX IF NOT EXISTS car_coupon_redemptions_booking_idx
  ON public.car_coupon_redemptions (booking_id);

CREATE INDEX IF NOT EXISTS car_coupon_redemptions_user_idx
  ON public.car_coupon_redemptions (user_id, created_at DESC);

CREATE OR REPLACE VIEW public.car_coupon_usage_stats AS
SELECT
  c.id AS coupon_id,
  count(r.id)::integer AS redemption_count,
  COALESCE(sum(r.discount_amount), 0)::numeric(12,2) AS total_discount_amount,
  max(r.created_at) AS last_redeemed_at
FROM public.car_coupons c
LEFT JOIN public.car_coupon_redemptions r
  ON r.coupon_id = c.id
GROUP BY c.id;

DO $$
BEGIN
  IF to_regclass('public.car_bookings') IS NOT NULL THEN
    ALTER TABLE public.car_bookings
      ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES public.car_coupons(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS coupon_code text,
      ADD COLUMN IF NOT EXISTS base_rental_price numeric(12,2),
      ADD COLUMN IF NOT EXISTS coupon_discount_amount numeric(12,2),
      ADD COLUMN IF NOT EXISTS final_rental_price numeric(12,2),
      ADD COLUMN IF NOT EXISTS coupon_partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS coupon_partner_commission_bps integer;

    ALTER TABLE public.car_bookings
      DROP CONSTRAINT IF EXISTS car_bookings_coupon_partner_commission_bps_check;

    ALTER TABLE public.car_bookings
      ADD CONSTRAINT car_bookings_coupon_partner_commission_bps_check
      CHECK (coupon_partner_commission_bps IS NULL OR coupon_partner_commission_bps >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.car_bookings') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS car_bookings_coupon_id_idx ON public.car_bookings (coupon_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS car_bookings_coupon_partner_id_idx ON public.car_bookings (coupon_partner_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS car_bookings_coupon_code_idx ON public.car_bookings (coupon_code)';
  END IF;
END $$;

ALTER TABLE public.car_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_coupon_redemptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.car_coupons FROM anon, authenticated;
REVOKE ALL ON TABLE public.car_coupon_redemptions FROM anon, authenticated;
REVOKE ALL ON TABLE public.car_coupon_usage_stats FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.car_coupons TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.car_coupon_redemptions TO service_role;
GRANT SELECT ON TABLE public.car_coupon_usage_stats TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.car_coupons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.car_coupon_redemptions TO authenticated;
GRANT SELECT ON TABLE public.car_coupon_usage_stats TO authenticated;

DO $$
DECLARE
  has_current_admin boolean := (to_regprocedure('public.is_current_user_admin()') IS NOT NULL);
  has_is_admin boolean := (to_regprocedure('public.is_admin()') IS NOT NULL);
  has_partner_user boolean := (to_regprocedure('public.is_partner_user(uuid)') IS NOT NULL);
BEGIN
  DROP POLICY IF EXISTS car_coupons_admin_all ON public.car_coupons;
  DROP POLICY IF EXISTS car_coupons_partner_read ON public.car_coupons;
  DROP POLICY IF EXISTS car_coupon_redemptions_admin_all ON public.car_coupon_redemptions;
  DROP POLICY IF EXISTS car_coupon_redemptions_partner_read ON public.car_coupon_redemptions;

  IF has_current_admin THEN
    EXECUTE 'CREATE POLICY car_coupons_admin_all ON public.car_coupons FOR ALL TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin())';
    EXECUTE 'CREATE POLICY car_coupon_redemptions_admin_all ON public.car_coupon_redemptions FOR ALL TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin())';
  ELSIF has_is_admin THEN
    EXECUTE 'CREATE POLICY car_coupons_admin_all ON public.car_coupons FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
    EXECUTE 'CREATE POLICY car_coupon_redemptions_admin_all ON public.car_coupon_redemptions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  ELSE
    EXECUTE 'CREATE POLICY car_coupons_admin_all ON public.car_coupons FOR ALL TO authenticated USING ((auth.jwt() -> ''user_metadata'' ->> ''is_admin'')::boolean = true) WITH CHECK ((auth.jwt() -> ''user_metadata'' ->> ''is_admin'')::boolean = true)';
    EXECUTE 'CREATE POLICY car_coupon_redemptions_admin_all ON public.car_coupon_redemptions FOR ALL TO authenticated USING ((auth.jwt() -> ''user_metadata'' ->> ''is_admin'')::boolean = true) WITH CHECK ((auth.jwt() -> ''user_metadata'' ->> ''is_admin'')::boolean = true)';
  END IF;

  IF has_partner_user THEN
    EXECUTE 'CREATE POLICY car_coupons_partner_read ON public.car_coupons FOR SELECT TO authenticated USING (partner_id IS NOT NULL AND public.is_partner_user(partner_id))';
    EXECUTE 'CREATE POLICY car_coupon_redemptions_partner_read ON public.car_coupon_redemptions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.car_coupons c WHERE c.id = coupon_id AND c.partner_id IS NOT NULL AND public.is_partner_user(c.partner_id)))';
  END IF;
END $$;

COMMENT ON TABLE public.car_coupons IS 'Admin-managed coupons for car rentals (scoped by locations/offers/cars and optional partner attribution).';
COMMENT ON TABLE public.car_coupon_redemptions IS 'Coupon applications snapshot per car booking.';
COMMENT ON VIEW public.car_coupon_usage_stats IS 'Aggregated coupon usage counters and totals.';
