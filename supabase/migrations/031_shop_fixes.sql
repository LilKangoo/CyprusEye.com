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

-- Ensure admin policies work correctly by recreating them with proper checks
-- Drop and recreate admin policies to ensure they work

-- First drop existing admin policies if they exist
DROP POLICY IF EXISTS "vendors_admin" ON shop_vendors;
DROP POLICY IF EXISTS "categories_admin" ON shop_categories;
DROP POLICY IF EXISTS "attributes_admin" ON shop_attributes;
DROP POLICY IF EXISTS "attr_values_admin" ON shop_attribute_values;
DROP POLICY IF EXISTS "tax_classes_admin" ON shop_tax_classes;
DROP POLICY IF EXISTS "tax_rates_admin" ON shop_tax_rates;
DROP POLICY IF EXISTS "shipping_classes_admin" ON shop_shipping_classes;
DROP POLICY IF EXISTS "products_admin" ON shop_products;
DROP POLICY IF EXISTS "variants_admin" ON shop_product_variants;

-- Recreate admin policies with proper checks
CREATE POLICY "vendors_admin" ON shop_vendors FOR ALL TO authenticated 
  USING (is_shop_admin()) WITH CHECK (is_shop_admin());

CREATE POLICY "categories_admin" ON shop_categories FOR ALL TO authenticated 
  USING (is_shop_admin()) WITH CHECK (is_shop_admin());

CREATE POLICY "attributes_admin" ON shop_attributes FOR ALL TO authenticated 
  USING (is_shop_admin()) WITH CHECK (is_shop_admin());

CREATE POLICY "attr_values_admin" ON shop_attribute_values FOR ALL TO authenticated 
  USING (is_shop_admin()) WITH CHECK (is_shop_admin());

CREATE POLICY "tax_classes_admin" ON shop_tax_classes FOR ALL TO authenticated 
  USING (is_shop_admin()) WITH CHECK (is_shop_admin());

CREATE POLICY "tax_rates_admin" ON shop_tax_rates FOR ALL TO authenticated 
  USING (is_shop_admin()) WITH CHECK (is_shop_admin());

CREATE POLICY "shipping_classes_admin" ON shop_shipping_classes FOR ALL TO authenticated 
  USING (is_shop_admin()) WITH CHECK (is_shop_admin());

CREATE POLICY "products_admin" ON shop_products FOR ALL TO authenticated 
  USING (is_shop_admin()) WITH CHECK (is_shop_admin());

CREATE POLICY "variants_admin" ON shop_product_variants FOR ALL TO authenticated 
  USING (is_shop_admin()) WITH CHECK (is_shop_admin());

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

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE '✅ Shop fixes migration completed!';
END $$;
