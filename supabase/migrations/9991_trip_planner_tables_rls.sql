CREATE TABLE IF NOT EXISTS public.user_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  start_date date,
  end_date date,
  days_count integer,
  base_city text,
  include_north boolean NOT NULL DEFAULT false,
  variant_group_id uuid,
  variant_name text,
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','archived')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_plans_user_id ON public.user_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_user_plans_status ON public.user_plans(status);
CREATE INDEX IF NOT EXISTS idx_user_plans_variant_group_id ON public.user_plans(variant_group_id);

CREATE OR REPLACE FUNCTION public.update_user_plans_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_user_plans_updated_at ON public.user_plans;
CREATE TRIGGER trg_update_user_plans_updated_at
BEFORE UPDATE ON public.user_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_user_plans_updated_at();

CREATE TABLE IF NOT EXISTS public.user_plan_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.user_plans(id) ON DELETE CASCADE,
  day_index integer NOT NULL,
  date date,
  city text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(plan_id, day_index)
);

CREATE INDEX IF NOT EXISTS idx_user_plan_days_plan_id ON public.user_plan_days(plan_id);
CREATE INDEX IF NOT EXISTS idx_user_plan_days_date ON public.user_plan_days(date);

CREATE OR REPLACE FUNCTION public.update_user_plan_days_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_user_plan_days_updated_at ON public.user_plan_days;
CREATE TRIGGER trg_update_user_plan_days_updated_at
BEFORE UPDATE ON public.user_plan_days
FOR EACH ROW
EXECUTE FUNCTION public.update_user_plan_days_updated_at();

CREATE TABLE IF NOT EXISTS public.user_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_day_id uuid NOT NULL REFERENCES public.user_plan_days(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('poi','trip','hotel','car','note','custom')),
  ref_id uuid,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  estimated_price numeric(12,2),
  currency text DEFAULT 'EUR',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_plan_items_plan_day_id ON public.user_plan_items(plan_day_id);
CREATE INDEX IF NOT EXISTS idx_user_plan_items_item_type ON public.user_plan_items(item_type);

CREATE OR REPLACE FUNCTION public.update_user_plan_items_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_user_plan_items_updated_at ON public.user_plan_items;
CREATE TRIGGER trg_update_user_plan_items_updated_at
BEFORE UPDATE ON public.user_plan_items
FOR EACH ROW
EXECUTE FUNCTION public.update_user_plan_items_updated_at();

ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_plan_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_plan_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_plan_days TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_plan_items TO authenticated;

DROP POLICY IF EXISTS user_plans_owner_all ON public.user_plans;
CREATE POLICY user_plans_owner_all
ON public.user_plans
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DO $$
BEGIN
  IF to_regprocedure('public.is_current_user_admin()') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS user_plans_admin_all ON public.user_plans';
    EXECUTE 'CREATE POLICY user_plans_admin_all ON public.user_plans FOR ALL TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin())';
  END IF;
END $$;

DROP POLICY IF EXISTS user_plan_days_owner_all ON public.user_plan_days;
CREATE POLICY user_plan_days_owner_all
ON public.user_plan_days
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_plans p
    WHERE p.id = plan_id
      AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_plans p
    WHERE p.id = plan_id
      AND p.user_id = auth.uid()
  )
);

DO $$
BEGIN
  IF to_regprocedure('public.is_current_user_admin()') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS user_plan_days_admin_all ON public.user_plan_days';
    EXECUTE 'CREATE POLICY user_plan_days_admin_all ON public.user_plan_days FOR ALL TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin())';
  END IF;
END $$;

DROP POLICY IF EXISTS user_plan_items_owner_all ON public.user_plan_items;
CREATE POLICY user_plan_items_owner_all
ON public.user_plan_items
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_plan_days d
    JOIN public.user_plans p ON p.id = d.plan_id
    WHERE d.id = plan_day_id
      AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_plan_days d
    JOIN public.user_plans p ON p.id = d.plan_id
    WHERE d.id = plan_day_id
      AND p.user_id = auth.uid()
  )
);

DO $$
BEGIN
  IF to_regprocedure('public.is_current_user_admin()') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS user_plan_items_admin_all ON public.user_plan_items';
    EXECUTE 'CREATE POLICY user_plan_items_admin_all ON public.user_plan_items FOR ALL TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin())';
  END IF;
END $$;
