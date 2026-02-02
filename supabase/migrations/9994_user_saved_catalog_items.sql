CREATE TABLE IF NOT EXISTS public.user_saved_catalog_items (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('trip','hotel','car','poi','recommendation')),
  ref_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_type, ref_id)
);

ALTER TABLE public.user_saved_catalog_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_saved_catalog_items TO authenticated;

DROP POLICY IF EXISTS user_saved_catalog_items_owner_all ON public.user_saved_catalog_items;
CREATE POLICY user_saved_catalog_items_owner_all
ON public.user_saved_catalog_items
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DO $$
BEGIN
  IF to_regprocedure('public.is_current_user_admin()') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS user_saved_catalog_items_admin_all ON public.user_saved_catalog_items';
    EXECUTE 'CREATE POLICY user_saved_catalog_items_admin_all ON public.user_saved_catalog_items FOR ALL TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin())';
  END IF;
END $$;
