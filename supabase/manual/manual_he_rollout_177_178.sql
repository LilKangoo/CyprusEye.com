-- Manual HE internal rollout for migrations 177 and 178.
-- Use this only when Supabase CLI migration history is blocked by older
-- unregistered migrations. This script is additive/idempotent and does not
-- activate Hebrew in public UI, switchers, SEO, hreflang, sitemap, or routes.
--
-- Required before running:
-- 1. Take a database backup or snapshot.
-- 2. Run supabase/manual/he_stage4_schema_checks.sql section "Pre-rollout".
-- 3. Confirm that the remote migration backlog 095-176 will NOT be pushed
--    automatically as part of this HE rollout.
--
-- After successful execution and verification, migration history can be
-- repaired manually with Supabase CLI, for 177/178 only:
--   supabase migration repair 177 178 --status applied --linked
--
-- Do not mark 095-176 applied unless each has been separately verified.

-- ---------------------------------------------------------------------------
-- 177_profiles_preferred_language_he.sql
-- ---------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS preferred_language text;

DO $$
DECLARE
  existing_definition text;
BEGIN
  SELECT pg_get_constraintdef(c.oid)
    INTO existing_definition
  FROM pg_constraint c
  WHERE c.conrelid = 'public.profiles'::regclass
    AND c.conname = 'profiles_preferred_language_chk';

  IF existing_definition IS NULL OR existing_definition NOT ILIKE '%he%' THEN
    ALTER TABLE public.profiles
      DROP CONSTRAINT IF EXISTS profiles_preferred_language_chk;

    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_preferred_language_chk
      CHECK (
        preferred_language IS NULL
        OR preferred_language IN ('pl', 'en', 'he')
      )
      NOT VALID;

    ALTER TABLE public.profiles
      VALIDATE CONSTRAINT profiles_preferred_language_chk;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    COMMENT ON COLUMN public.profiles.preferred_language IS
      'Preferred language selected by the signed-in user. Supported values: pl, en, he. Hebrew is internal/hidden until public rollout.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 178_he_internal_content_fields.sql
-- ---------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.blog_posts
  ADD COLUMN IF NOT EXISTS categories_he text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tags_he text[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF to_regclass('public.blog_posts') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_blog_posts_categories_he_gin
      ON public.blog_posts USING gin(categories_he);

    CREATE INDEX IF NOT EXISTS idx_blog_posts_tags_he_gin
      ON public.blog_posts USING gin(tags_he);

    COMMENT ON COLUMN public.blog_posts.categories_he IS
      'Internal Hebrew category labels. Hidden until Hebrew public rollout.';

    COMMENT ON COLUMN public.blog_posts.tags_he IS
      'Internal Hebrew tag labels. Hidden until Hebrew public rollout.';
  END IF;
END $$;

ALTER TABLE IF EXISTS public.pois
  ADD COLUMN IF NOT EXISTS name_i18n jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS description_i18n jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS badge_i18n jsonb NOT NULL DEFAULT '{}';

ALTER TABLE IF EXISTS public.poi_categories
  ADD COLUMN IF NOT EXISTS name_he text;

ALTER TABLE IF EXISTS public.shop_vendors
  ADD COLUMN IF NOT EXISTS name_he text,
  ADD COLUMN IF NOT EXISTS description_he text;

ALTER TABLE IF EXISTS public.shop_categories
  ADD COLUMN IF NOT EXISTS name_he text,
  ADD COLUMN IF NOT EXISTS description_he text,
  ADD COLUMN IF NOT EXISTS meta_title_he text,
  ADD COLUMN IF NOT EXISTS meta_description_he text;

ALTER TABLE IF EXISTS public.shop_attributes
  ADD COLUMN IF NOT EXISTS name_he text;

ALTER TABLE IF EXISTS public.shop_attribute_values
  ADD COLUMN IF NOT EXISTS value_he text;

ALTER TABLE IF EXISTS public.shop_tax_classes
  ADD COLUMN IF NOT EXISTS name_he text,
  ADD COLUMN IF NOT EXISTS description_he text;

ALTER TABLE IF EXISTS public.shop_shipping_classes
  ADD COLUMN IF NOT EXISTS name_he text,
  ADD COLUMN IF NOT EXISTS description_he text;

ALTER TABLE IF EXISTS public.shop_shipping_zones
  ADD COLUMN IF NOT EXISTS name_he text;

ALTER TABLE IF EXISTS public.shop_shipping_methods
  ADD COLUMN IF NOT EXISTS name_he text,
  ADD COLUMN IF NOT EXISTS description_he text;

ALTER TABLE IF EXISTS public.shop_customer_groups
  ADD COLUMN IF NOT EXISTS name_he text,
  ADD COLUMN IF NOT EXISTS description_he text;

ALTER TABLE IF EXISTS public.shop_products
  ADD COLUMN IF NOT EXISTS name_he text,
  ADD COLUMN IF NOT EXISTS description_he text,
  ADD COLUMN IF NOT EXISTS short_description_he text,
  ADD COLUMN IF NOT EXISTS meta_title_he text,
  ADD COLUMN IF NOT EXISTS meta_description_he text;

ALTER TABLE IF EXISTS public.shop_product_variants
  ADD COLUMN IF NOT EXISTS name_he text;

ALTER TABLE IF EXISTS public.shop_discounts
  ADD COLUMN IF NOT EXISTS description_he text;

ALTER TABLE IF EXISTS public.shop_email_templates
  ADD COLUMN IF NOT EXISTS subject_he text,
  ADD COLUMN IF NOT EXISTS body_html_he text;

ALTER TABLE IF EXISTS public.transport_locations
  ADD COLUMN IF NOT EXISTS name_he text;

DO $$
BEGIN
  IF to_regclass('public.transport_locations') IS NOT NULL THEN
    COMMENT ON COLUMN public.transport_locations.name_he IS
      'Internal Hebrew transport location label. Hidden until Hebrew public rollout.';
  END IF;
END $$;
