-- =====================================================
-- SHOP SYSTEM FIXES - Migration 031
-- Fixes for missing columns and RLS issues
-- =====================================================

-- Add missing columns to shop_attributes if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shop_attributes' AND column_name = 'is_active') THEN
    ALTER TABLE shop_attributes ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shop_attributes' AND column_name = 'values') THEN
    ALTER TABLE shop_attributes ADD COLUMN values TEXT;
  END IF;
END $$;

-- Add missing columns to shop_shipping_classes if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shop_shipping_classes' AND column_name = 'is_active') THEN
    ALTER TABLE shop_shipping_classes ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Also ensure the is_shop_admin function exists and is correct
CREATE OR REPLACE FUNCTION is_shop_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    auth.uid() = '15f3d442-092d-4eb8-9627-db90da0283eb'::uuid OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure admin policies work correctly by recreating them with proper checks
-- Drop and recreate admin policies to ensure they work


DO $$
BEGIN
  IF to_regclass('public.shop_vendors') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shop_vendors' AND policyname = 'vendors_admin') THEN
      EXECUTE 'CREATE POLICY "vendors_admin" ON shop_vendors FOR ALL TO authenticated USING (is_shop_admin()) WITH CHECK (is_shop_admin())';
    END IF;
  END IF;

  IF to_regclass('public.shop_categories') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shop_categories' AND policyname = 'categories_admin') THEN
      EXECUTE 'CREATE POLICY "categories_admin" ON shop_categories FOR ALL TO authenticated USING (is_shop_admin()) WITH CHECK (is_shop_admin())';
    END IF;
  END IF;

  IF to_regclass('public.shop_attributes') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shop_attributes' AND policyname = 'attributes_admin') THEN
      EXECUTE 'CREATE POLICY "attributes_admin" ON shop_attributes FOR ALL TO authenticated USING (is_shop_admin()) WITH CHECK (is_shop_admin())';
    END IF;
  END IF;

  IF to_regclass('public.shop_attribute_values') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shop_attribute_values' AND policyname = 'attr_values_admin') THEN
      EXECUTE 'CREATE POLICY "attr_values_admin" ON shop_attribute_values FOR ALL TO authenticated USING (is_shop_admin()) WITH CHECK (is_shop_admin())';
    END IF;
  END IF;

  IF to_regclass('public.shop_tax_classes') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shop_tax_classes' AND policyname = 'tax_classes_admin') THEN
      EXECUTE 'CREATE POLICY "tax_classes_admin" ON shop_tax_classes FOR ALL TO authenticated USING (is_shop_admin()) WITH CHECK (is_shop_admin())';
    END IF;
  END IF;

  IF to_regclass('public.shop_tax_rates') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shop_tax_rates' AND policyname = 'tax_rates_admin') THEN
      EXECUTE 'CREATE POLICY "tax_rates_admin" ON shop_tax_rates FOR ALL TO authenticated USING (is_shop_admin()) WITH CHECK (is_shop_admin())';
    END IF;
  END IF;

  IF to_regclass('public.shop_shipping_classes') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shop_shipping_classes' AND policyname = 'shipping_classes_admin') THEN
      EXECUTE 'CREATE POLICY "shipping_classes_admin" ON shop_shipping_classes FOR ALL TO authenticated USING (is_shop_admin()) WITH CHECK (is_shop_admin())';
    END IF;
  END IF;

  IF to_regclass('public.shop_products') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shop_products' AND policyname = 'products_admin') THEN
      EXECUTE 'CREATE POLICY "products_admin" ON shop_products FOR ALL TO authenticated USING (is_shop_admin()) WITH CHECK (is_shop_admin())';
    END IF;
  END IF;

  IF to_regclass('public.shop_product_variants') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shop_product_variants' AND policyname = 'variants_admin') THEN
      EXECUTE 'CREATE POLICY "variants_admin" ON shop_product_variants FOR ALL TO authenticated USING (is_shop_admin()) WITH CHECK (is_shop_admin())';
    END IF;
  END IF;
END $$;

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE '✅ Shop fixes migration completed!';
END $$;
