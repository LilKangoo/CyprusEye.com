-- Internal Hebrew content foundation.
-- This migration is additive only: it does not activate Hebrew in public UI,
-- SEO, sitemap, hreflang, canonical routing, or public language selectors.

-- Blog taxonomy uses flat arrays next to the existing PL/EN fields.
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS categories_he text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tags_he text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_blog_posts_categories_he_gin
  ON public.blog_posts USING gin(categories_he);

CREATE INDEX IF NOT EXISTS idx_blog_posts_tags_he_gin
  ON public.blog_posts USING gin(tags_he);

COMMENT ON COLUMN public.blog_posts.categories_he IS
  'Internal Hebrew category labels. Hidden until Hebrew public rollout.';

COMMENT ON COLUMN public.blog_posts.tags_he IS
  'Internal Hebrew tag labels. Hidden until Hebrew public rollout.';

-- POI admin already uses JSONB i18n payloads in form code. Keep this additive
-- and do not change map/check-in/radius logic.
ALTER TABLE public.pois
  ADD COLUMN IF NOT EXISTS name_i18n jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS description_i18n jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS badge_i18n jsonb NOT NULL DEFAULT '{}';

ALTER TABLE public.poi_categories
  ADD COLUMN IF NOT EXISTS name_he text;

-- Shop keeps the existing PL base columns plus *_en columns. Add *_he columns
-- conservatively so admin/partner tooling can store Hebrew without schema churn.
ALTER TABLE public.shop_vendors
  ADD COLUMN IF NOT EXISTS name_he text,
  ADD COLUMN IF NOT EXISTS description_he text;

ALTER TABLE public.shop_categories
  ADD COLUMN IF NOT EXISTS name_he text,
  ADD COLUMN IF NOT EXISTS description_he text,
  ADD COLUMN IF NOT EXISTS meta_title_he text,
  ADD COLUMN IF NOT EXISTS meta_description_he text;

ALTER TABLE public.shop_attributes
  ADD COLUMN IF NOT EXISTS name_he text;

ALTER TABLE public.shop_attribute_values
  ADD COLUMN IF NOT EXISTS value_he text;

ALTER TABLE public.shop_tax_classes
  ADD COLUMN IF NOT EXISTS name_he text,
  ADD COLUMN IF NOT EXISTS description_he text;

ALTER TABLE public.shop_shipping_classes
  ADD COLUMN IF NOT EXISTS name_he text,
  ADD COLUMN IF NOT EXISTS description_he text;

ALTER TABLE public.shop_shipping_zones
  ADD COLUMN IF NOT EXISTS name_he text;

ALTER TABLE public.shop_shipping_methods
  ADD COLUMN IF NOT EXISTS name_he text,
  ADD COLUMN IF NOT EXISTS description_he text;

ALTER TABLE public.shop_customer_groups
  ADD COLUMN IF NOT EXISTS name_he text,
  ADD COLUMN IF NOT EXISTS description_he text;

ALTER TABLE public.shop_products
  ADD COLUMN IF NOT EXISTS name_he text,
  ADD COLUMN IF NOT EXISTS description_he text,
  ADD COLUMN IF NOT EXISTS short_description_he text,
  ADD COLUMN IF NOT EXISTS meta_title_he text,
  ADD COLUMN IF NOT EXISTS meta_description_he text;

ALTER TABLE public.shop_product_variants
  ADD COLUMN IF NOT EXISTS name_he text;

ALTER TABLE public.shop_discounts
  ADD COLUMN IF NOT EXISTS description_he text;

ALTER TABLE public.shop_email_templates
  ADD COLUMN IF NOT EXISTS subject_he text,
  ADD COLUMN IF NOT EXISTS body_html_he text;

-- Transport locations currently have name/name_local. Add Hebrew as a separate
-- optional internal label without changing route/pricing logic.
ALTER TABLE public.transport_locations
  ADD COLUMN IF NOT EXISTS name_he text;

COMMENT ON COLUMN public.transport_locations.name_he IS
  'Internal Hebrew transport location label. Hidden until Hebrew public rollout.';
