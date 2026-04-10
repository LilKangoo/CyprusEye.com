-- Allow partner users to read partner-assigned shop discounts
-- and backfill legacy partner relationships for older rows.

CREATE INDEX IF NOT EXISTS idx_shop_discounts_user_ids_gin
  ON public.shop_discounts
  USING gin (user_ids);

CREATE INDEX IF NOT EXISTS idx_shop_discounts_applicable_vendor_ids_gin
  ON public.shop_discounts
  USING gin (applicable_vendor_ids);

DROP POLICY IF EXISTS shop_discounts_partner_read ON public.shop_discounts;
CREATE POLICY shop_discounts_partner_read
  ON public.shop_discounts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.partner_users pu
      JOIN public.partners p
        ON p.id = pu.partner_id
      WHERE pu.user_id = auth.uid()
        AND (
          pu.user_id = ANY(COALESCE(shop_discounts.user_ids, '{}'::uuid[]))
          OR (
            p.shop_vendor_id IS NOT NULL
            AND p.shop_vendor_id = ANY(COALESCE(shop_discounts.applicable_vendor_ids, '{}'::uuid[]))
          )
        )
    )
  );

WITH vendor_backfill AS (
  SELECT
    d.id AS discount_id,
    array_agg(DISTINCT p.shop_vendor_id) FILTER (WHERE p.shop_vendor_id IS NOT NULL) AS vendor_ids
  FROM public.shop_discounts d
  JOIN public.partner_users pu
    ON pu.user_id = ANY(COALESCE(d.user_ids, '{}'::uuid[]))
  JOIN public.partners p
    ON p.id = pu.partner_id
  GROUP BY d.id
)
UPDATE public.shop_discounts d
SET applicable_vendor_ids = COALESCE(
  (
    SELECT array_agg(DISTINCT vendor_id)
    FROM unnest(
      COALESCE(d.applicable_vendor_ids, '{}'::uuid[])
      || COALESCE(vendor_backfill.vendor_ids, '{}'::uuid[])
    ) AS vendor_id
  ),
  '{}'::uuid[]
)
FROM vendor_backfill
WHERE d.id = vendor_backfill.discount_id
  AND COALESCE(array_length(vendor_backfill.vendor_ids, 1), 0) > 0;

WITH user_backfill AS (
  SELECT
    d.id AS discount_id,
    array_agg(DISTINCT pu.user_id) FILTER (WHERE pu.user_id IS NOT NULL) AS partner_user_ids
  FROM public.shop_discounts d
  JOIN public.partners p
    ON p.shop_vendor_id = ANY(COALESCE(d.applicable_vendor_ids, '{}'::uuid[]))
  JOIN public.partner_users pu
    ON pu.partner_id = p.id
  GROUP BY d.id
)
UPDATE public.shop_discounts d
SET user_ids = COALESCE(
  (
    SELECT array_agg(DISTINCT user_id)
    FROM unnest(
      COALESCE(d.user_ids, '{}'::uuid[])
      || COALESCE(user_backfill.partner_user_ids, '{}'::uuid[])
    ) AS user_id
  ),
  '{}'::uuid[]
)
FROM user_backfill
WHERE d.id = user_backfill.discount_id
  AND COALESCE(array_length(user_backfill.partner_user_ids, 1), 0) > 0;
