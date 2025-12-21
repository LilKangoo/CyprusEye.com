-- =====================================================
-- 031 - Add shipping_details column to shop_orders
-- =====================================================

ALTER TABLE shop_orders
ADD COLUMN IF NOT EXISTS shipping_details JSONB;
