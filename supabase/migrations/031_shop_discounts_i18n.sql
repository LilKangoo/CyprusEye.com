-- Add description_en column to shop_discounts table for i18n support
-- This migration adds the missing column if it doesn't exist

ALTER TABLE shop_discounts ADD COLUMN IF NOT EXISTS description_en TEXT;
