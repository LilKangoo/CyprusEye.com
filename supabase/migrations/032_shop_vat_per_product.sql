-- Add per-product VAT price mode
ALTER TABLE public.shop_products
  ADD COLUMN IF NOT EXISTS tax_price_mode TEXT NOT NULL DEFAULT 'inherit'
  CHECK (tax_price_mode IN ('inherit', 'net', 'gross'));

CREATE OR REPLACE FUNCTION public.shop_get_public_tax_settings()
RETURNS TABLE (
  tax_enabled BOOLEAN,
  tax_included_in_price BOOLEAN,
  tax_based_on TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.tax_enabled,
    s.tax_included_in_price,
    s.tax_based_on
  FROM public.shop_settings s
  WHERE s.id = 1;
$$;

GRANT EXECUTE ON FUNCTION public.shop_get_public_tax_settings() TO anon;
GRANT EXECUTE ON FUNCTION public.shop_get_public_tax_settings() TO authenticated;
