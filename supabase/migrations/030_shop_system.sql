-- =====================================================
-- COMPLETE SHOP SYSTEM - Migration 030
-- E-commerce for WakacjeCypr.com
-- All customization options for admin control
-- =====================================================

-- =====================================================
-- 1. VENDORS (etykiety sprzedawców)
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_en TEXT,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  description_en TEXT,
  logo_url TEXT,
  banner_url TEXT,
  website_url TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  city TEXT,
  address TEXT,
  commission_rate DECIMAL(5,2) DEFAULT 0,
  bank_name TEXT,
  bank_iban TEXT,
  bank_swift TEXT,
  total_products INTEGER DEFAULT 0,
  total_sales INTEGER DEFAULT 0,
  total_revenue DECIMAL(12,2) DEFAULT 0,
  avg_rating DECIMAL(3,2) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_vendors_slug ON shop_vendors(slug);
CREATE INDEX IF NOT EXISTS idx_shop_vendors_active ON shop_vendors(is_active) WHERE is_active = true;

-- =====================================================
-- 2. CATEGORIES (hierarchiczne)
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_en TEXT,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  description_en TEXT,
  parent_id UUID REFERENCES shop_categories(id) ON DELETE SET NULL,
  level INTEGER DEFAULT 0,
  path TEXT,
  image_url TEXT,
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  show_in_menu BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  meta_title TEXT,
  meta_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_categories_slug ON shop_categories(slug);
CREATE INDEX IF NOT EXISTS idx_shop_categories_parent ON shop_categories(parent_id);

-- =====================================================
-- 3. PRODUCT ATTRIBUTES (dynamic)
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_en TEXT,
  slug TEXT UNIQUE NOT NULL,
  type TEXT DEFAULT 'select',
  is_required BOOLEAN DEFAULT false,
  is_visible BOOLEAN DEFAULT true,
  is_variation BOOLEAN DEFAULT true,
  is_filterable BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shop_attribute_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_id UUID NOT NULL REFERENCES shop_attributes(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  value_en TEXT,
  slug TEXT NOT NULL,
  color_hex TEXT,
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  UNIQUE(attribute_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_attr_values_attr ON shop_attribute_values(attribute_id);

-- =====================================================
-- 4. TAX CLASSES
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_tax_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_en TEXT,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shop_tax_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_class_id UUID NOT NULL REFERENCES shop_tax_classes(id) ON DELETE CASCADE,
  country TEXT NOT NULL,
  state TEXT DEFAULT '*',
  postcode TEXT DEFAULT '*',
  city TEXT DEFAULT '*',
  rate DECIMAL(6,4) NOT NULL,
  name TEXT NOT NULL,
  is_compound BOOLEAN DEFAULT false,
  is_shipping BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tax_rates_class ON shop_tax_rates(tax_class_id);
CREATE INDEX IF NOT EXISTS idx_tax_rates_country ON shop_tax_rates(country);

INSERT INTO shop_tax_classes (name, name_en, slug, is_default) VALUES
  ('Standard', 'Standard', 'standard', true),
  ('Reduced', 'Reduced', 'reduced', false),
  ('Zero Rate', 'Zero Rate', 'zero', false)
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- 5. SHIPPING CLASSES
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_shipping_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_en TEXT,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  extra_cost DECIMAL(10,2) DEFAULT 0,
  extra_cost_per_kg DECIMAL(10,2) DEFAULT 0,
  handling_fee DECIMAL(10,2) DEFAULT 0,
  requires_signature BOOLEAN DEFAULT false,
  requires_insurance BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO shop_shipping_classes (name, name_en, slug) VALUES
  ('Standard', 'Standard', 'standard'),
  ('Heavy Items', 'Heavy Items', 'heavy'),
  ('Fragile', 'Fragile', 'fragile'),
  ('Digital', 'Digital', 'digital')
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- 6. SHIPPING ZONES & METHODS
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_shipping_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_en TEXT,
  countries TEXT[] NOT NULL,
  regions JSONB,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shop_shipping_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES shop_shipping_zones(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  description_en TEXT,
  method_type TEXT DEFAULT 'flat_rate',
  cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  free_shipping_threshold DECIMAL(10,2),
  cost_per_kg DECIMAL(10,2) DEFAULT 0,
  min_weight DECIMAL(10,3),
  max_weight DECIMAL(10,3),
  dim_weight_factor INTEGER DEFAULT 5000,
  price_tiers JSONB,
  cost_per_item DECIMAL(10,2) DEFAULT 0,
  class_costs JSONB,
  min_delivery_days INTEGER,
  max_delivery_days INTEGER,
  processing_days INTEGER DEFAULT 1,
  requires_signature BOOLEAN DEFAULT false,
  includes_insurance BOOLEAN DEFAULT false,
  insurance_cost DECIMAL(10,2) DEFAULT 0,
  tracking_url_template TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipping_methods_zone ON shop_shipping_methods(zone_id);

INSERT INTO shop_shipping_zones (name, name_en, countries, sort_order) VALUES
  ('Cypr', 'Cyprus', ARRAY['CY'], 1),
  ('Unia Europejska', 'European Union', ARRAY['AT','BE','BG','HR','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'], 2),
  ('Międzynarodowa', 'International', ARRAY['*'], 3)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 7. CUSTOMER GROUPS
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_customer_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_en TEXT,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  discount_type TEXT DEFAULT 'percentage',
  discount_value DECIMAL(10,2) DEFAULT 0,
  min_orders INTEGER,
  min_spent DECIMAL(12,2),
  max_order_value DECIMAL(12,2),
  max_items_per_order INTEGER,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO shop_customer_groups (name, name_en, slug, is_default) VALUES
  ('Retail', 'Retail', 'retail', true),
  ('VIP', 'VIP', 'vip', false),
  ('Wholesale', 'Wholesale', 'wholesale', false)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS shop_customer_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES shop_customer_groups(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ,
  UNIQUE(user_id, group_id)
);

-- =====================================================
-- 8. PRODUCTS
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_en TEXT,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  description_en TEXT,
  short_description TEXT,
  short_description_en TEXT,
  vendor_id UUID REFERENCES shop_vendors(id) ON DELETE SET NULL,
  category_id UUID REFERENCES shop_categories(id) ON DELETE SET NULL,
  tax_class_id UUID REFERENCES shop_tax_classes(id) ON DELETE SET NULL,
  shipping_class_id UUID REFERENCES shop_shipping_classes(id) ON DELETE SET NULL,
  price DECIMAL(10,2) NOT NULL,
  compare_at_price DECIMAL(10,2),
  cost_price DECIMAL(10,2),
  sale_price DECIMAL(10,2),
  sale_start_date TIMESTAMPTZ,
  sale_end_date TIMESTAMPTZ,
  tiered_pricing JSONB,
  group_prices JSONB,
  sku TEXT UNIQUE,
  barcode TEXT,
  stock_quantity INTEGER DEFAULT 0,
  track_inventory BOOLEAN DEFAULT true,
  allow_backorder BOOLEAN DEFAULT false,
  backorder_limit INTEGER,
  low_stock_threshold INTEGER DEFAULT 5,
  warehouse_location TEXT,
  is_preorder BOOLEAN DEFAULT false,
  preorder_date TIMESTAMPTZ,
  preorder_limit INTEGER,
  min_purchase_quantity INTEGER DEFAULT 1,
  max_purchase_quantity INTEGER,
  quantity_step INTEGER DEFAULT 1,
  product_type TEXT DEFAULT 'simple',
  weight DECIMAL(10,3),
  weight_unit TEXT DEFAULT 'kg',
  length DECIMAL(10,2),
  width DECIMAL(10,2),
  height DECIMAL(10,2),
  dimension_unit TEXT DEFAULT 'cm',
  is_virtual BOOLEAN DEFAULT false,
  digital_file_url TEXT,
  digital_file_name TEXT,
  download_limit INTEGER,
  download_expiry_days INTEGER,
  subscription_interval TEXT,
  subscription_interval_count INTEGER DEFAULT 1,
  subscription_trial_days INTEGER DEFAULT 0,
  subscription_signup_fee DECIMAL(10,2) DEFAULT 0,
  is_customizable BOOLEAN DEFAULT false,
  customization_options JSONB,
  images JSONB DEFAULT '[]'::jsonb,
  thumbnail_url TEXT,
  video_url TEXT,
  upsell_product_ids UUID[] DEFAULT '{}',
  cross_sell_product_ids UUID[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  is_featured BOOLEAN DEFAULT false,
  is_bestseller BOOLEAN DEFAULT false,
  is_new BOOLEAN DEFAULT false,
  is_on_sale BOOLEAN DEFAULT false,
  is_gift_card BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'draft',
  visibility TEXT DEFAULT 'visible',
  meta_title TEXT,
  meta_description TEXT,
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  view_count INTEGER DEFAULT 0,
  avg_rating DECIMAL(3,2) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  total_sold INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  CONSTRAINT valid_product_status CHECK (status IN ('draft', 'active', 'archived')),
  CONSTRAINT valid_product_type CHECK (product_type IN ('simple', 'variable', 'grouped', 'bundle', 'digital', 'subscription')),
  CONSTRAINT valid_visibility CHECK (visibility IN ('visible', 'hidden', 'search_only', 'catalog_only')),
  CONSTRAINT positive_price CHECK (price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_shop_products_slug ON shop_products(slug);
CREATE INDEX IF NOT EXISTS idx_shop_products_vendor ON shop_products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_shop_products_category ON shop_products(category_id);
CREATE INDEX IF NOT EXISTS idx_shop_products_status ON shop_products(status);
CREATE INDEX IF NOT EXISTS idx_shop_products_type ON shop_products(product_type);
CREATE INDEX IF NOT EXISTS idx_shop_products_featured ON shop_products(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_shop_products_bestseller ON shop_products(is_bestseller) WHERE is_bestseller = true;
CREATE INDEX IF NOT EXISTS idx_shop_products_sku ON shop_products(sku);
CREATE INDEX IF NOT EXISTS idx_shop_products_stripe ON shop_products(stripe_product_id);
CREATE INDEX IF NOT EXISTS idx_shop_products_tags ON shop_products USING GIN(tags);

-- =====================================================
-- 9. PRODUCT VARIANTS
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  barcode TEXT,
  price DECIMAL(10,2),
  compare_at_price DECIMAL(10,2),
  cost_price DECIMAL(10,2),
  tiered_pricing JSONB,
  group_prices JSONB,
  stock_quantity INTEGER DEFAULT 0,
  warehouse_location TEXT,
  attributes JSONB NOT NULL,
  weight DECIMAL(10,3),
  length DECIMAL(10,2),
  width DECIMAL(10,2),
  height DECIMAL(10,2),
  image_url TEXT,
  stripe_price_id TEXT,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_variants_product ON shop_product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_shop_variants_sku ON shop_product_variants(sku);

-- =====================================================
-- 10. PRODUCT BUNDLES
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_product_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES shop_product_variants(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  allow_variant_selection BOOLEAN DEFAULT false,
  discount_type TEXT,
  discount_value DECIMAL(10,2),
  sort_order INTEGER DEFAULT 0,
  UNIQUE(bundle_product_id, product_id, variant_id)
);

-- =====================================================
-- 11. PRODUCT ATTRIBUTES LINK
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_product_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
  attribute_id UUID NOT NULL REFERENCES shop_attributes(id) ON DELETE CASCADE,
  value_ids UUID[] NOT NULL,
  is_visible BOOLEAN DEFAULT true,
  is_variation BOOLEAN DEFAULT true,
  UNIQUE(product_id, attribute_id)
);

-- =====================================================
-- 12. SHOPPING CART
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  discount_code TEXT,
  shipping_method_id UUID REFERENCES shop_shipping_methods(id),
  customer_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  reminder_sent_at TIMESTAMPTZ,
  reminder_count INTEGER DEFAULT 0,
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS shop_cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES shop_carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES shop_product_variants(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  customization_data JSONB,
  unit_price_at_add DECIMAL(10,2),
  stock_reserved_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT positive_quantity CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_shop_cart_items_cart ON shop_cart_items(cart_id);

-- =====================================================
-- 13. WISHLIST
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_wishlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES shop_product_variants(id) ON DELETE CASCADE,
  notify_on_sale BOOLEAN DEFAULT false,
  notify_on_stock BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id, variant_id)
);

-- =====================================================
-- 14. CUSTOMER ADDRESSES
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT,
  address_type TEXT DEFAULT 'both',
  is_default_shipping BOOLEAN DEFAULT false,
  is_default_billing BOOLEAN DEFAULT false,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  email TEXT,
  line1 TEXT NOT NULL,
  line2 TEXT,
  city TEXT NOT NULL,
  state TEXT,
  postal_code TEXT,
  country TEXT NOT NULL DEFAULT 'CY',
  tax_id TEXT,
  tax_id_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_addresses_user ON shop_addresses(user_id);

-- =====================================================
-- 15. DISCOUNTS / PROMO CODES
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  description_internal TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percentage',
  discount_value DECIMAL(10,2) NOT NULL,
  buy_quantity INTEGER,
  get_quantity INTEGER,
  get_product_ids UUID[],
  minimum_order_amount DECIMAL(10,2),
  maximum_order_amount DECIMAL(10,2),
  minimum_items INTEGER,
  maximum_discount_amount DECIMAL(10,2),
  applies_to TEXT DEFAULT 'all',
  applicable_product_ids UUID[] DEFAULT '{}',
  applicable_category_ids UUID[] DEFAULT '{}',
  applicable_vendor_ids UUID[] DEFAULT '{}',
  exclude_product_ids UUID[] DEFAULT '{}',
  exclude_category_ids UUID[] DEFAULT '{}',
  exclude_sale_items BOOLEAN DEFAULT false,
  user_ids UUID[] DEFAULT '{}',
  customer_group_ids UUID[] DEFAULT '{}',
  first_purchase_only BOOLEAN DEFAULT false,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  usage_limit_per_user INTEGER DEFAULT 1,
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  stripe_coupon_id TEXT,
  stripe_promotion_code_id TEXT,
  is_stackable BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  is_auto_apply BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_discounts_code ON shop_discounts(code);
CREATE INDEX IF NOT EXISTS idx_shop_discounts_active ON shop_discounts(is_active) WHERE is_active = true;

-- =====================================================
-- 16. ORDERS
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_group_id UUID REFERENCES shop_customer_groups(id),
  billing_address JSONB NOT NULL,
  shipping_address JSONB NOT NULL,
  items_subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  shipping_cost DECIMAL(10,2) DEFAULT 0,
  shipping_tax DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  tax_breakdown JSONB,
  xp_earned INTEGER DEFAULT 0,
  xp_awarded_at TIMESTAMPTZ,
  discount_code TEXT,
  discount_id UUID REFERENCES shop_discounts(id) ON DELETE SET NULL,
  discount_breakdown JSONB,
  status TEXT DEFAULT 'pending',
  payment_status TEXT DEFAULT 'unpaid',
  fulfillment_status TEXT DEFAULT 'unfulfilled',
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_invoice_id TEXT,
  shipping_method_id UUID REFERENCES shop_shipping_methods(id),
  shipping_method_name TEXT,
  shipping_carrier TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  estimated_delivery_date DATE,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  customer_notes TEXT,
  admin_notes TEXT,
  gift_message TEXT,
  is_gift BOOLEAN DEFAULT false,
  order_source TEXT DEFAULT 'website',
  ip_address INET,
  user_agent TEXT,
  invoice_number TEXT,
  invoice_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  CONSTRAINT valid_order_status CHECK (status IN ('pending', 'confirmed', 'processing', 'on_hold', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded', 'failed')),
  CONSTRAINT valid_payment_status CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'partially_refunded', 'refunded', 'failed')),
  CONSTRAINT valid_fulfillment_status CHECK (fulfillment_status IN ('unfulfilled', 'partially_fulfilled', 'fulfilled', 'returned', 'partially_returned'))
);

CREATE INDEX IF NOT EXISTS idx_shop_orders_user ON shop_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_email ON shop_orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_shop_orders_status ON shop_orders(status);
CREATE INDEX IF NOT EXISTS idx_shop_orders_payment ON shop_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_shop_orders_created ON shop_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_orders_number ON shop_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_shop_orders_stripe ON shop_orders(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_stripe_pi ON shop_orders(stripe_payment_intent_id);

-- =====================================================
-- 17. ORDER ITEMS
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES shop_products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES shop_product_variants(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES shop_vendors(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  variant_name TEXT,
  sku TEXT,
  vendor_name TEXT,
  product_image TEXT,
  product_type TEXT DEFAULT 'simple',
  customization_data JSONB,
  digital_file_url TEXT,
  download_count INTEGER DEFAULT 0,
  download_limit INTEGER,
  download_expires_at TIMESTAMPTZ,
  original_price DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  subtotal DECIMAL(10,2) NOT NULL,
  tax_class TEXT,
  tax_rate DECIMAL(6,4) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  weight DECIMAL(10,3),
  fulfilled_quantity INTEGER DEFAULT 0,
  returned_quantity INTEGER DEFAULT 0,
  refunded_quantity INTEGER DEFAULT 0,
  refunded_amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_order_items_order ON shop_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_shop_order_items_product ON shop_order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_shop_order_items_vendor ON shop_order_items(vendor_id);

-- =====================================================
-- 18. ORDER STATUS HISTORY
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_order_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  note TEXT,
  changed_by UUID REFERENCES auth.users(id),
  is_customer_visible BOOLEAN DEFAULT true,
  notification_sent BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_order_history_order ON shop_order_history(order_id);

-- =====================================================
-- 19. REFUNDS
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  reason TEXT,
  refund_type TEXT DEFAULT 'full',
  stripe_refund_id TEXT,
  status TEXT DEFAULT 'pending',
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMPTZ,
  items JSONB,
  restock_items BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_refunds_order ON shop_refunds(order_id);

-- =====================================================
-- 20. REVIEWS
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES shop_orders(id) ON DELETE SET NULL,
  order_item_id UUID REFERENCES shop_order_items(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
  value_rating INTEGER CHECK (value_rating >= 1 AND value_rating <= 5),
  title TEXT,
  content TEXT,
  pros TEXT,
  cons TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  video_url TEXT,
  author_name TEXT,
  show_as_anonymous BOOLEAN DEFAULT false,
  vendor_response TEXT,
  vendor_response_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  moderation_note TEXT,
  moderated_by UUID REFERENCES auth.users(id),
  moderated_at TIMESTAMPTZ,
  is_verified_purchase BOOLEAN DEFAULT false,
  helpful_count INTEGER DEFAULT 0,
  unhelpful_count INTEGER DEFAULT 0,
  report_count INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, user_id, order_item_id)
);

CREATE INDEX IF NOT EXISTS idx_shop_reviews_product ON shop_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_shop_reviews_user ON shop_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_reviews_status ON shop_reviews(status);

CREATE TABLE IF NOT EXISTS shop_review_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES shop_reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_helpful BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(review_id, user_id)
);

CREATE TABLE IF NOT EXISTS shop_review_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES shop_reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(review_id, user_id)
);

-- =====================================================
-- 21. SUBSCRIPTIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES shop_product_variants(id) ON DELETE SET NULL,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  stripe_price_id TEXT,
  status TEXT DEFAULT 'active',
  quantity INTEGER DEFAULT 1,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  pause_collection JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_subs_user ON shop_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_subs_stripe ON shop_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_shop_subs_status ON shop_subscriptions(status);

-- =====================================================
-- 22. DISCOUNT USAGE
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_discount_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_id UUID NOT NULL REFERENCES shop_discounts(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  discount_amount DECIMAL(10,2) NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(discount_id, order_id)
);

-- =====================================================
-- 23. ABANDONED CARTS
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_abandoned_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES shop_carts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cart_total DECIMAL(10,2),
  cart_items_count INTEGER,
  cart_items_snapshot JSONB,
  email_1_sent_at TIMESTAMPTZ,
  email_2_sent_at TIMESTAMPTZ,
  email_3_sent_at TIMESTAMPTZ,
  discount_code TEXT,
  discount_offered_at TIMESTAMPTZ,
  is_recovered BOOLEAN DEFAULT false,
  recovered_order_id UUID REFERENCES shop_orders(id),
  recovered_at TIMESTAMPTZ,
  is_unsubscribed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 24. PRODUCT ANALYTICS
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_product_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_views_product ON shop_product_views(product_id);
CREATE INDEX IF NOT EXISTS idx_product_views_date ON shop_product_views(viewed_at);

CREATE TABLE IF NOT EXISTS shop_product_views_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
  view_date DATE NOT NULL,
  view_count INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  UNIQUE(product_id, view_date)
);

-- =====================================================
-- 25. INVENTORY ALERTS
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_inventory_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES shop_product_variants(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  current_quantity INTEGER,
  threshold INTEGER,
  email_sent_at TIMESTAMPTZ,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 26. PRICE HISTORY
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES shop_product_variants(id) ON DELETE CASCADE,
  old_price DECIMAL(10,2),
  new_price DECIMAL(10,2) NOT NULL,
  old_compare_at_price DECIMAL(10,2),
  new_compare_at_price DECIMAL(10,2),
  reason TEXT,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_history_product ON shop_price_history(product_id);

-- =====================================================
-- 27. SHOP SETTINGS
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  shop_name TEXT DEFAULT 'WakacjeCypr Shop',
  shop_email TEXT,
  shop_phone TEXT,
  shop_address JSONB,
  default_currency TEXT DEFAULT 'EUR',
  order_number_prefix TEXT DEFAULT 'WC',
  next_order_number INTEGER DEFAULT 1000,
  invoice_number_prefix TEXT DEFAULT 'INV',
  next_invoice_number INTEGER DEFAULT 1000,
  require_phone BOOLEAN DEFAULT false,
  require_company BOOLEAN DEFAULT false,
  enable_gift_message BOOLEAN DEFAULT true,
  reserve_stock_minutes INTEGER DEFAULT 15,
  low_stock_threshold_default INTEGER DEFAULT 5,
  xp_enabled BOOLEAN DEFAULT true,
  xp_per_euro INTEGER DEFAULT 1,
  xp_award_on TEXT DEFAULT 'payment',
  tax_enabled BOOLEAN DEFAULT false,
  tax_included_in_price BOOLEAN DEFAULT true,
  tax_based_on TEXT DEFAULT 'shipping',
  enable_free_shipping_notice BOOLEAN DEFAULT true,
  free_shipping_notice_threshold DECIMAL(10,2),
  abandoned_cart_enabled BOOLEAN DEFAULT true,
  abandoned_cart_delay_hours INTEGER DEFAULT 24,
  abandoned_cart_email_1_hours INTEGER DEFAULT 24,
  abandoned_cart_email_2_hours INTEGER DEFAULT 48,
  abandoned_cart_email_3_hours INTEGER DEFAULT 72,
  abandoned_cart_discount_code TEXT,
  abandoned_cart_discount_percent DECIMAL(5,2) DEFAULT 10,
  reviews_enabled BOOLEAN DEFAULT true,
  reviews_require_approval BOOLEAN DEFAULT true,
  reviews_require_purchase BOOLEAN DEFAULT false,
  reviews_allow_images BOOLEAN DEFAULT true,
  notify_admin_on_order BOOLEAN DEFAULT true,
  notify_admin_on_low_stock BOOLEAN DEFAULT true,
  admin_notification_email TEXT,
  terms_url TEXT,
  privacy_url TEXT,
  return_policy_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO shop_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- =====================================================
-- 28. EMAIL TEMPLATES
-- =====================================================
CREATE TABLE IF NOT EXISTS shop_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  subject_en TEXT,
  body_html TEXT NOT NULL,
  body_html_en TEXT,
  variables JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION shop_generate_order_number()
RETURNS TEXT AS $$
DECLARE
  settings_row shop_settings%ROWTYPE;
  new_number TEXT;
BEGIN
  SELECT * INTO settings_row FROM shop_settings WHERE id = 1 FOR UPDATE;
  new_number := settings_row.order_number_prefix || '-' || LPAD(settings_row.next_order_number::TEXT, 6, '0');
  UPDATE shop_settings SET next_order_number = next_order_number + 1 WHERE id = 1;
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION shop_generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  settings_row shop_settings%ROWTYPE;
  new_number TEXT;
BEGIN
  SELECT * INTO settings_row FROM shop_settings WHERE id = 1 FOR UPDATE;
  new_number := settings_row.invoice_number_prefix || '-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(settings_row.next_invoice_number::TEXT, 5, '0');
  UPDATE shop_settings SET next_invoice_number = next_invoice_number + 1 WHERE id = 1;
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION shop_award_xp(p_order_id UUID)
RETURNS INTEGER AS $$
DECLARE
  order_row shop_orders%ROWTYPE;
  settings_row shop_settings%ROWTYPE;
  xp_to_award INTEGER;
BEGIN
  SELECT * INTO order_row FROM shop_orders WHERE id = p_order_id;
  SELECT * INTO settings_row FROM shop_settings WHERE id = 1;
  
  IF order_row.id IS NULL OR NOT settings_row.xp_enabled THEN
    RETURN 0;
  END IF;
  
  IF order_row.xp_awarded_at IS NOT NULL THEN
    RETURN order_row.xp_earned;
  END IF;
  
  xp_to_award := FLOOR(order_row.total * settings_row.xp_per_euro);
  
  UPDATE profiles SET
    xp = xp + xp_to_award,
    total_xp = total_xp + xp_to_award,
    level = FLOOR((total_xp + xp_to_award) / 150) + 1,
    updated_at = NOW()
  WHERE id = order_row.user_id;
  
  UPDATE shop_orders SET
    xp_earned = xp_to_award,
    xp_awarded_at = NOW()
  WHERE id = p_order_id;
  
  RETURN xp_to_award;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION shop_update_product_review_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE shop_products SET
      avg_rating = (SELECT COALESCE(AVG(rating), 0) FROM shop_reviews WHERE product_id = NEW.product_id AND status = 'approved'),
      total_reviews = (SELECT COUNT(*) FROM shop_reviews WHERE product_id = NEW.product_id AND status = 'approved'),
      updated_at = NOW()
    WHERE id = NEW.product_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE shop_products SET
      avg_rating = (SELECT COALESCE(AVG(rating), 0) FROM shop_reviews WHERE product_id = OLD.product_id AND status = 'approved'),
      total_reviews = (SELECT COUNT(*) FROM shop_reviews WHERE product_id = OLD.product_id AND status = 'approved'),
      updated_at = NOW()
    WHERE id = OLD.product_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION shop_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION is_shop_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    auth.uid() = '15f3d442-092d-4eb8-9627-db90da0283eb'::uuid OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGERS
-- =====================================================
DROP TRIGGER IF EXISTS shop_vendors_updated ON shop_vendors;
CREATE TRIGGER shop_vendors_updated BEFORE UPDATE ON shop_vendors FOR EACH ROW EXECUTE FUNCTION shop_update_timestamp();

DROP TRIGGER IF EXISTS shop_categories_updated ON shop_categories;
CREATE TRIGGER shop_categories_updated BEFORE UPDATE ON shop_categories FOR EACH ROW EXECUTE FUNCTION shop_update_timestamp();

DROP TRIGGER IF EXISTS shop_products_updated ON shop_products;
CREATE TRIGGER shop_products_updated BEFORE UPDATE ON shop_products FOR EACH ROW EXECUTE FUNCTION shop_update_timestamp();

DROP TRIGGER IF EXISTS shop_variants_updated ON shop_product_variants;
CREATE TRIGGER shop_variants_updated BEFORE UPDATE ON shop_product_variants FOR EACH ROW EXECUTE FUNCTION shop_update_timestamp();

DROP TRIGGER IF EXISTS shop_carts_updated ON shop_carts;
CREATE TRIGGER shop_carts_updated BEFORE UPDATE ON shop_carts FOR EACH ROW EXECUTE FUNCTION shop_update_timestamp();

DROP TRIGGER IF EXISTS shop_cart_items_updated ON shop_cart_items;
CREATE TRIGGER shop_cart_items_updated BEFORE UPDATE ON shop_cart_items FOR EACH ROW EXECUTE FUNCTION shop_update_timestamp();

DROP TRIGGER IF EXISTS shop_addresses_updated ON shop_addresses;
CREATE TRIGGER shop_addresses_updated BEFORE UPDATE ON shop_addresses FOR EACH ROW EXECUTE FUNCTION shop_update_timestamp();

DROP TRIGGER IF EXISTS shop_discounts_updated ON shop_discounts;
CREATE TRIGGER shop_discounts_updated BEFORE UPDATE ON shop_discounts FOR EACH ROW EXECUTE FUNCTION shop_update_timestamp();

DROP TRIGGER IF EXISTS shop_orders_updated ON shop_orders;
CREATE TRIGGER shop_orders_updated BEFORE UPDATE ON shop_orders FOR EACH ROW EXECUTE FUNCTION shop_update_timestamp();

DROP TRIGGER IF EXISTS shop_reviews_updated ON shop_reviews;
CREATE TRIGGER shop_reviews_updated BEFORE UPDATE ON shop_reviews FOR EACH ROW EXECUTE FUNCTION shop_update_timestamp();

DROP TRIGGER IF EXISTS shop_subs_updated ON shop_subscriptions;
CREATE TRIGGER shop_subs_updated BEFORE UPDATE ON shop_subscriptions FOR EACH ROW EXECUTE FUNCTION shop_update_timestamp();

DROP TRIGGER IF EXISTS shop_settings_updated ON shop_settings;
CREATE TRIGGER shop_settings_updated BEFORE UPDATE ON shop_settings FOR EACH ROW EXECUTE FUNCTION shop_update_timestamp();

DROP TRIGGER IF EXISTS shop_review_stats_trigger ON shop_reviews;
CREATE TRIGGER shop_review_stats_trigger
  AFTER INSERT OR UPDATE OR DELETE ON shop_reviews
  FOR EACH ROW
  EXECUTE FUNCTION shop_update_product_review_stats();

-- =====================================================
-- RLS POLICIES
-- =====================================================
ALTER TABLE shop_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_attribute_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_tax_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_shipping_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_shipping_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_shipping_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_customer_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_customer_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_product_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_product_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_order_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_review_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_review_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_discount_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_abandoned_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_product_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_product_views_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_inventory_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_email_templates ENABLE ROW LEVEL SECURITY;

-- PUBLIC READ POLICIES
CREATE POLICY "vendors_public" ON shop_vendors FOR SELECT USING (is_active);
CREATE POLICY "categories_public" ON shop_categories FOR SELECT USING (is_active);
CREATE POLICY "attributes_public" ON shop_attributes FOR SELECT USING (true);
CREATE POLICY "attr_values_public" ON shop_attribute_values FOR SELECT USING (true);
CREATE POLICY "tax_classes_public" ON shop_tax_classes FOR SELECT USING (is_active);
CREATE POLICY "tax_rates_public" ON shop_tax_rates FOR SELECT USING (true);
CREATE POLICY "shipping_classes_public" ON shop_shipping_classes FOR SELECT USING (true);
CREATE POLICY "shipping_zones_public" ON shop_shipping_zones FOR SELECT USING (is_active);
CREATE POLICY "shipping_methods_public" ON shop_shipping_methods FOR SELECT USING (is_active);
CREATE POLICY "customer_groups_public" ON shop_customer_groups FOR SELECT USING (is_active);
CREATE POLICY "products_public" ON shop_products FOR SELECT USING (status = 'active');
CREATE POLICY "variants_public" ON shop_product_variants FOR SELECT USING (is_active);
CREATE POLICY "bundles_public" ON shop_product_bundles FOR SELECT USING (true);
CREATE POLICY "product_attrs_public" ON shop_product_attributes FOR SELECT USING (true);
CREATE POLICY "discounts_public" ON shop_discounts FOR SELECT USING (is_active AND (starts_at IS NULL OR starts_at <= NOW()) AND (expires_at IS NULL OR expires_at > NOW()));
CREATE POLICY "reviews_public" ON shop_reviews FOR SELECT USING (status = 'approved');
CREATE POLICY "review_votes_public" ON shop_review_votes FOR SELECT USING (true);
CREATE POLICY "views_daily_public" ON shop_product_views_daily FOR SELECT USING (true);

-- USER OWN DATA POLICIES
CREATE POLICY "carts_user" ON shop_carts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "cart_items_user" ON shop_cart_items FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM shop_carts WHERE id = cart_id AND user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM shop_carts WHERE id = cart_id AND user_id = auth.uid()));
CREATE POLICY "wishlist_user" ON shop_wishlist FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "addresses_user" ON shop_addresses FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "orders_user_read" ON shop_orders FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "order_items_user_read" ON shop_order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM shop_orders WHERE id = order_id AND user_id = auth.uid()));
CREATE POLICY "order_history_user_read" ON shop_order_history FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM shop_orders WHERE id = order_id AND user_id = auth.uid()) AND is_customer_visible);
CREATE POLICY "reviews_user_insert" ON shop_reviews FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "reviews_user_update" ON shop_reviews FOR UPDATE TO authenticated USING (user_id = auth.uid() AND status = 'pending');
CREATE POLICY "review_votes_user" ON shop_review_votes FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "review_reports_user" ON shop_review_reports FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "subscriptions_user_read" ON shop_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "group_members_user_read" ON shop_customer_group_members FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "product_views_insert" ON shop_product_views FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ADMIN FULL ACCESS POLICIES
CREATE POLICY "vendors_admin" ON shop_vendors FOR ALL TO authenticated USING (is_shop_admin());
CREATE POLICY "categories_admin" ON shop_categories FOR ALL TO authenticated USING (is_shop_admin());
CREATE POLICY "attributes_admin" ON shop_attributes FOR ALL TO authenticated USING (is_shop_admin());
CREATE POLICY "attr_values_admin" ON shop_attribute_values FOR ALL TO authenticated USING (is_shop_admin());
CREATE POLICY "tax_classes_admin" ON shop_tax_classes FOR ALL TO authenticated USING (is_shop_admin());
CREATE POLICY "tax_rates_admin" ON shop_tax_rates FOR ALL TO authenticated USING (is_shop_admin());
CREATE POLICY "shipping_classes_admin" ON shop_shipping_classes FOR ALL TO authenticated USING (is_shop_admin());
CREATE POLICY "shipping_zones_admin" ON shop_shipping_zones FOR ALL TO authenticated USING (is_shop_admin());
CREATE POLICY "shipping_methods_admin" ON shop_shipping_methods FOR ALL TO authenticated USING (is_shop_admin());
CREATE POLICY "customer_groups_admin" ON shop_customer_groups FOR ALL TO authenticated USING (is_shop_admin());
CREATE POLICY "group_members_admin" ON shop_customer_group_members FOR ALL TO authenticated USING (is_shop_admin());
CREATE POLICY "products_admin" ON shop_products FOR ALL TO authenticated USING (is_shop_admin());
CREATE POLICY "variants_admin" ON shop_product_variants FOR ALL TO authenticated USING (is_shop_admin());
CREATE POLICY "bundles_admin" ON shop_product_bundles FOR ALL TO authenticated USING (is_shop_admin());
CREATE POLICY "product_attrs_admin" ON shop_product_attributes FOR ALL TO authenticated USING (is_shop_admin());
CREATE POLICY "discounts_admin" ON shop_discounts FOR ALL TO authenticated USING (is_shop_admin());
CREATE POLICY "orders_admin" ON shop_orders FOR ALL TO authenticated USING (is_shop_admin());
CREATE POLICY "order_items_admin" ON shop_order_items FOR ALL TO authenticated USING (is_shop_admin());
CREATE POLICY "order_history_admin" ON shop_order_history FOR ALL TO authenticated USING (is_shop_admin());
CREATE POLICY "refunds_admin" ON shop_refunds FOR ALL TO authenticated USING (is_shop_admin());
CREATE POLICY "reviews_admin" ON shop_reviews FOR ALL TO authenticated USING (is_shop_admin());
CREATE POLICY "review_reports_admin" ON shop_review_reports FOR ALL TO authenticated USING (is_shop_admin());
CREATE POLICY "subscriptions_admin" ON shop_subscriptions FOR ALL TO authenticated USING (is_shop_admin());
CREATE POLICY "discount_usage_admin" ON shop_discount_usage FOR ALL TO authenticated USING (is_shop_admin());
CREATE POLICY "abandoned_carts_admin" ON shop_abandoned_carts FOR ALL TO authenticated USING (is_shop_admin());
CREATE POLICY "product_views_admin" ON shop_product_views FOR ALL TO authenticated USING (is_shop_admin());
CREATE POLICY "views_daily_admin" ON shop_product_views_daily FOR ALL TO authenticated USING (is_shop_admin());
CREATE POLICY "inventory_alerts_admin" ON shop_inventory_alerts FOR ALL TO authenticated USING (is_shop_admin());
CREATE POLICY "price_history_admin" ON shop_price_history FOR ALL TO authenticated USING (is_shop_admin());
CREATE POLICY "settings_admin" ON shop_settings FOR ALL TO authenticated USING (is_shop_admin());
CREATE POLICY "email_templates_admin" ON shop_email_templates FOR ALL TO authenticated USING (is_shop_admin());

-- SERVICE ROLE POLICIES (for Edge Functions / webhooks)
CREATE POLICY "orders_service_insert" ON shop_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "order_items_service_insert" ON shop_order_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "order_history_service_insert" ON shop_order_history FOR INSERT TO authenticated WITH CHECK (true);

-- =====================================================
-- STORAGE BUCKET
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-files', 'shop-files', false)
ON CONFLICT DO NOTHING;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$ 
BEGIN 
  RAISE NOTICE '✅ Shop system migration completed successfully!';
  RAISE NOTICE 'Created 28+ tables for complete e-commerce functionality';
END $$;
