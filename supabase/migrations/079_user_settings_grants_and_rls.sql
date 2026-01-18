DO $$
DECLARE
  key_col text;
  has_user_id boolean;
  has_id boolean;
  has_admin_fn boolean;
BEGIN
  IF to_regclass('public.user_settings') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'GRANT USAGE ON SCHEMA public TO authenticated';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_settings TO authenticated';

  EXECUTE 'ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY';

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_settings' AND column_name = 'user_id'
  ) INTO has_user_id;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_settings' AND column_name = 'id'
  ) INTO has_id;

  key_col := NULL;
  IF has_user_id THEN
    key_col := 'user_id';
  ELSIF has_id THEN
    key_col := 'id';
  END IF;

  has_admin_fn := (to_regprocedure('public.is_current_user_admin()') IS NOT NULL);

  IF key_col IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS user_settings_owner_select ON public.user_settings';
    EXECUTE 'DROP POLICY IF EXISTS user_settings_owner_insert ON public.user_settings';
    EXECUTE 'DROP POLICY IF EXISTS user_settings_owner_update ON public.user_settings';

    EXECUTE format(
      'CREATE POLICY user_settings_owner_select ON public.user_settings FOR SELECT TO authenticated USING (%I = auth.uid())',
      key_col
    );

    EXECUTE format(
      'CREATE POLICY user_settings_owner_insert ON public.user_settings FOR INSERT TO authenticated WITH CHECK (%I = auth.uid())',
      key_col
    );

    EXECUTE format(
      'CREATE POLICY user_settings_owner_update ON public.user_settings FOR UPDATE TO authenticated USING (%I = auth.uid()) WITH CHECK (%I = auth.uid())',
      key_col,
      key_col
    );
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS user_settings_admin_all ON public.user_settings';

  IF has_admin_fn THEN
    EXECUTE 'CREATE POLICY user_settings_admin_all ON public.user_settings FOR ALL TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin())';
  ELSE
    EXECUTE 'CREATE POLICY user_settings_admin_all ON public.user_settings FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true))';
  END IF;
END $$;
