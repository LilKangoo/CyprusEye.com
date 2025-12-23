-- RPC helpers for shop facet counts

CREATE OR REPLACE FUNCTION public.shop_get_category_counts(
  p_search text DEFAULT NULL,
  p_lang text DEFAULT 'pl',
  p_in_stock boolean DEFAULT false,
  p_on_sale boolean DEFAULT false,
  p_price_min numeric DEFAULT NULL,
  p_price_max numeric DEFAULT NULL
)
RETURNS TABLE (
  category_id uuid,
  product_count bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH filtered_products AS (
    SELECT p.id, p.category_id
    FROM public.shop_products p
    WHERE p.status = 'active'
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
      AND (
        p_price_min IS NULL OR p.price >= p_price_min
      )
      AND (
        p_price_max IS NULL OR p.price <= p_price_max
      )
      AND p.category_id IS NOT NULL
  ),
  direct_counts AS (
    SELECT fp.category_id, count(*)::bigint AS cnt
    FROM filtered_products fp
    GROUP BY fp.category_id
  ),
  menu_categories AS (
    SELECT c.id, c.parent_id
    FROM public.shop_categories c
    WHERE c.is_active = true
      AND c.show_in_menu = true
  ),
  ancestors AS (
    SELECT c.id AS category_id, c.id AS ancestor_id, c.parent_id
    FROM menu_categories c
    UNION ALL
    SELECT a.category_id, p.id AS ancestor_id, p.parent_id
    FROM ancestors a
    JOIN menu_categories p ON p.id = a.parent_id
    WHERE a.parent_id IS NOT NULL
  )
  SELECT
    a.ancestor_id AS category_id,
    sum(dc.cnt)::bigint AS product_count
  FROM ancestors a
  JOIN direct_counts dc ON dc.category_id = a.category_id
  GROUP BY a.ancestor_id;
$$;

GRANT EXECUTE ON FUNCTION public.shop_get_category_counts(text, text, boolean, boolean, numeric, numeric) TO anon;
GRANT EXECUTE ON FUNCTION public.shop_get_category_counts(text, text, boolean, boolean, numeric, numeric) TO authenticated;
