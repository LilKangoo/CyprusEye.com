-- RPC helpers for shop filters

CREATE OR REPLACE FUNCTION public.shop_get_price_bounds(
  p_category_ids uuid[] DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_lang text DEFAULT 'pl',
  p_in_stock boolean DEFAULT false,
  p_on_sale boolean DEFAULT false
)
RETURNS TABLE (
  min_price numeric,
  max_price numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT p.price
    FROM public.shop_products p
    WHERE p.status = 'active'
      AND (p_category_ids IS NULL OR p.category_id = ANY(p_category_ids))
      AND (
        p_search IS NULL OR btrim(p_search) = '' OR
        (CASE WHEN lower(p_lang) = 'en' THEN coalesce(p.name_en, p.name) ELSE p.name END)
          ILIKE ('%' || regexp_replace(p_search, '[%_]', '', 'g') || '%')
      )
      AND (
        NOT p_in_stock OR p.track_inventory = false OR coalesce(p.stock_quantity, 0) > 0
      )
      AND (
        NOT p_on_sale OR coalesce(p.compare_at_price, 0) > 0
      )
  )
  SELECT
    coalesce(min(price), 0) AS min_price,
    coalesce(max(price), 0) AS max_price
  FROM filtered;
$$;

GRANT EXECUTE ON FUNCTION public.shop_get_price_bounds(uuid[], text, text, boolean, boolean) TO anon;
GRANT EXECUTE ON FUNCTION public.shop_get_price_bounds(uuid[], text, text, boolean, boolean) TO authenticated;
