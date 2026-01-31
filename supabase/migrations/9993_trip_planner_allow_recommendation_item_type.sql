DO $$
BEGIN
  -- Default constraint name for the inline CHECK is typically user_plan_items_item_type_check
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'user_plan_items'
      AND c.conname = 'user_plan_items_item_type_check'
  ) THEN
    EXECUTE 'ALTER TABLE public.user_plan_items DROP CONSTRAINT user_plan_items_item_type_check';
  END IF;

  EXECUTE $$
    ALTER TABLE public.user_plan_items
    ADD CONSTRAINT user_plan_items_item_type_check
    CHECK (item_type IN ('poi','trip','hotel','car','note','custom','recommendation'))
  $$;
END $$;
