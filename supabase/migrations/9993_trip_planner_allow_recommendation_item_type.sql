ALTER TABLE public.user_plan_items
DROP CONSTRAINT IF EXISTS user_plan_items_item_type_check;

ALTER TABLE public.user_plan_items
ADD CONSTRAINT user_plan_items_item_type_check
CHECK (item_type IN ('poi','trip','hotel','car','note','custom','recommendation'));
