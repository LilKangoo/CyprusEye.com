-- =====================================================
-- Special Offers base tables - Stage 1 draft
-- =====================================================
-- Prepared only. Do not run until reviewed.
--
-- Scope:
-- - special_offers
-- - special_offer_translations
-- - special_offer_prizes
-- - special_offer_links
-- - special_offer_audit_log
--
-- Out of scope for this stage:
-- - entries
-- - entry tasks
-- - campaign tasks
-- - draws
-- - draw snapshots
-- - winners
-- =====================================================

DO $$
BEGIN
  IF to_regprocedure('public.is_current_user_admin()') IS NULL THEN
    RAISE EXCEPTION 'Required helper public.is_current_user_admin() is missing. Review admin RLS helpers before running Special Offers base stage.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.special_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  type text NOT NULL DEFAULT 'contest',
  status text NOT NULL DEFAULT 'draft',
  visibility text NOT NULL DEFAULT 'private',
  start_at timestamptz,
  end_at timestamptz,
  winner_announce_at timestamptz,
  timezone text NOT NULL DEFAULT 'Asia/Nicosia',
  requires_login boolean NOT NULL DEFAULT true,
  requires_form boolean NOT NULL DEFAULT true,
  requires_manual_approval boolean NOT NULL DEFAULT true,
  allow_multiple_entries boolean NOT NULL DEFAULT false,
  max_entries_per_user integer NOT NULL DEFAULT 1,
  allow_bonus_points boolean NOT NULL DEFAULT true,
  exclude_admins boolean NOT NULL DEFAULT true,
  exclude_partners boolean NOT NULL DEFAULT false,
  public_winner_display boolean NOT NULL DEFAULT false,
  response_deadline_days integer NOT NULL DEFAULT 7,
  hero_image_url text,
  cover_image_url text,
  settings_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CONSTRAINT special_offers_slug_not_blank CHECK (length(trim(slug)) > 0),
  CONSTRAINT special_offers_slug_format CHECK (slug = lower(slug) AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT special_offers_type_check CHECK (type IN ('contest', 'giveaway', 'weighted_draw', 'partner_promo', 'coupon_promo', 'landing_only')),
  CONSTRAINT special_offers_status_check CHECK (status IN ('draft', 'scheduled', 'active', 'ended', 'locked', 'archived')),
  CONSTRAINT special_offers_visibility_check CHECK (visibility IN ('private', 'public', 'unlisted')),
  CONSTRAINT special_offers_dates_check CHECK (end_at IS NULL OR start_at IS NULL OR end_at >= start_at),
  CONSTRAINT special_offers_winner_announce_check CHECK (winner_announce_at IS NULL OR start_at IS NULL OR winner_announce_at >= start_at),
  CONSTRAINT special_offers_max_entries_check CHECK (max_entries_per_user > 0),
  CONSTRAINT special_offers_response_deadline_days_check CHECK (response_deadline_days > 0),
  CONSTRAINT special_offers_settings_json_object_check CHECK (jsonb_typeof(settings_json) = 'object')
);

CREATE TABLE IF NOT EXISTS public.special_offer_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.special_offers(id) ON DELETE CASCADE,
  lang text NOT NULL CHECK (lang IN ('pl', 'en', 'he')),
  title text,
  short_description text,
  full_description text,
  prize_description text,
  rules_html text,
  faq_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  seo_title text,
  seo_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT special_offer_translations_faq_json_array_check CHECK (jsonb_typeof(faq_json) = 'array'),
  UNIQUE (offer_id, lang)
);

CREATE TABLE IF NOT EXISTS public.special_offer_prizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.special_offers(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sponsor_name text,
  quantity integer NOT NULL DEFAULT 1,
  value_estimate numeric(12,2),
  currency text NOT NULL DEFAULT 'EUR',
  restrictions text,
  fulfillment_notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT special_offer_prizes_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT special_offer_prizes_quantity_check CHECK (quantity > 0),
  CONSTRAINT special_offer_prizes_value_estimate_check CHECK (value_estimate IS NULL OR value_estimate >= 0),
  CONSTRAINT special_offer_prizes_currency_check CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE TABLE IF NOT EXISTS public.special_offer_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.special_offers(id) ON DELETE CASCADE,
  link_type text NOT NULL,
  resource_id uuid,
  url text,
  label text,
  description text,
  is_primary boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT special_offer_links_type_check CHECK (link_type IN ('cars', 'trips', 'hotels', 'transport', 'shop', 'coupons', 'vip', 'custom')),
  CONSTRAINT special_offer_links_target_check CHECK (
    (
      link_type IN ('cars', 'trips', 'hotels', 'transport', 'shop', 'coupons')
      AND (
        resource_id IS NOT NULL
        OR (url IS NOT NULL AND length(trim(url)) > 0)
      )
    )
    OR (
      link_type IN ('vip', 'custom')
      AND url IS NOT NULL
      AND length(trim(url)) > 0
    )
  ),
  CONSTRAINT special_offer_links_url_protocol_check CHECK (
    url IS NULL
    OR url ~* '^(https?://|/)'
  )
);

CREATE TABLE IF NOT EXISTS public.special_offer_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid REFERENCES public.special_offers(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT special_offer_audit_log_action_not_blank CHECK (length(trim(action)) > 0),
  CONSTRAINT special_offer_audit_log_old_value_object_check CHECK (old_value IS NULL OR jsonb_typeof(old_value) = 'object'),
  CONSTRAINT special_offer_audit_log_new_value_object_check CHECK (new_value IS NULL OR jsonb_typeof(new_value) = 'object'),
  CONSTRAINT special_offer_audit_log_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_special_offers_status
  ON public.special_offers(status);

CREATE INDEX IF NOT EXISTS idx_special_offers_type
  ON public.special_offers(type);

CREATE INDEX IF NOT EXISTS idx_special_offers_dates
  ON public.special_offers(start_at, end_at);

CREATE INDEX IF NOT EXISTS idx_special_offer_translations_offer_lang
  ON public.special_offer_translations(offer_id, lang);

CREATE INDEX IF NOT EXISTS idx_special_offer_prizes_offer
  ON public.special_offer_prizes(offer_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_special_offer_links_offer
  ON public.special_offer_links(offer_id);

CREATE INDEX IF NOT EXISTS idx_special_offer_links_type_resource
  ON public.special_offer_links(link_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_special_offer_audit_log_offer_created
  ON public.special_offer_audit_log(offer_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.special_offers_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_special_offers_set_updated_at ON public.special_offers;
CREATE TRIGGER trg_special_offers_set_updated_at
BEFORE UPDATE ON public.special_offers
FOR EACH ROW
EXECUTE FUNCTION public.special_offers_set_updated_at();

DROP TRIGGER IF EXISTS trg_special_offer_translations_set_updated_at ON public.special_offer_translations;
CREATE TRIGGER trg_special_offer_translations_set_updated_at
BEFORE UPDATE ON public.special_offer_translations
FOR EACH ROW
EXECUTE FUNCTION public.special_offers_set_updated_at();

DROP TRIGGER IF EXISTS trg_special_offer_prizes_set_updated_at ON public.special_offer_prizes;
CREATE TRIGGER trg_special_offer_prizes_set_updated_at
BEFORE UPDATE ON public.special_offer_prizes
FOR EACH ROW
EXECUTE FUNCTION public.special_offers_set_updated_at();

DROP TRIGGER IF EXISTS trg_special_offer_links_set_updated_at ON public.special_offer_links;
CREATE TRIGGER trg_special_offer_links_set_updated_at
BEFORE UPDATE ON public.special_offer_links
FOR EACH ROW
EXECUTE FUNCTION public.special_offers_set_updated_at();

ALTER TABLE public.special_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_offer_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_offer_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_offer_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_offer_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.special_offers FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.special_offer_translations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.special_offer_prizes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.special_offer_links FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.special_offer_audit_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.special_offers_set_updated_at() FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.special_offers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.special_offer_translations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.special_offer_prizes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.special_offer_links TO authenticated;
GRANT SELECT, INSERT ON TABLE public.special_offer_audit_log TO authenticated;

GRANT ALL ON TABLE public.special_offers TO service_role;
GRANT ALL ON TABLE public.special_offer_translations TO service_role;
GRANT ALL ON TABLE public.special_offer_prizes TO service_role;
GRANT ALL ON TABLE public.special_offer_links TO service_role;
GRANT ALL ON TABLE public.special_offer_audit_log TO service_role;

DROP POLICY IF EXISTS special_offers_admin_all ON public.special_offers;
CREATE POLICY special_offers_admin_all
ON public.special_offers
FOR ALL
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS special_offer_translations_admin_all ON public.special_offer_translations;
CREATE POLICY special_offer_translations_admin_all
ON public.special_offer_translations
FOR ALL
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS special_offer_prizes_admin_all ON public.special_offer_prizes;
CREATE POLICY special_offer_prizes_admin_all
ON public.special_offer_prizes
FOR ALL
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS special_offer_links_admin_all ON public.special_offer_links;
CREATE POLICY special_offer_links_admin_all
ON public.special_offer_links
FOR ALL
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS special_offer_audit_log_admin_select ON public.special_offer_audit_log;
CREATE POLICY special_offer_audit_log_admin_select
ON public.special_offer_audit_log
FOR SELECT
TO authenticated
USING (public.is_current_user_admin());

DROP POLICY IF EXISTS special_offer_audit_log_admin_insert ON public.special_offer_audit_log;
CREATE POLICY special_offer_audit_log_admin_insert
ON public.special_offer_audit_log
FOR INSERT
TO authenticated
WITH CHECK (public.is_current_user_admin());

COMMENT ON TABLE public.special_offers IS 'Base campaign records for contests, giveaways, limited offers, coupon promos, partner promos, and landing-only campaigns.';
COMMENT ON TABLE public.special_offer_translations IS 'Per-language Special Offers landing and SEO content for PL/EN/HE.';
COMMENT ON TABLE public.special_offer_prizes IS 'Prize definitions attached to Special Offers campaigns.';
COMMENT ON TABLE public.special_offer_links IS 'Polymorphic service/CTA links attached to Special Offers campaigns. Entity validation is handled in application code.';
COMMENT ON TABLE public.special_offer_audit_log IS 'Audit trail for Special Offers admin actions. Entry/task/draw/winner actions will be added in later stages.';
