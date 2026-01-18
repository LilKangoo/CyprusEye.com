DO $$
DECLARE
  has_admin_fn boolean;
BEGIN
  has_admin_fn := (to_regprocedure('public.is_current_user_admin()') IS NOT NULL);

  IF to_regclass('public.admin_users_overview') IS NOT NULL OR to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE '
      CREATE OR REPLACE VIEW public.admin_users_overview AS
      SELECT
        p.id,
        p.username,
        p.name,
        p.email,
        p.level,
        p.xp,
        p.is_admin,
        p.created_at,
        p.updated_at,
        NULL::timestamptz AS last_sign_in_at,
        NULL::timestamptz AS confirmed_at,
        p.banned_until,
        (SELECT COUNT(*) FROM public.poi_comments WHERE user_id = p.id) as comment_count,
        (SELECT COUNT(*) FROM public.poi_ratings WHERE user_id = p.id) as rating_count,
        (SELECT COUNT(*) FROM public.user_poi_visits WHERE user_id = p.id) as visit_count,
        (SELECT COUNT(*) FROM public.completed_tasks WHERE user_id = p.id) as completed_tasks_count
      FROM public.profiles p
      WHERE ' || (CASE WHEN has_admin_fn THEN 'public.is_current_user_admin()' ELSE '(EXISTS (SELECT 1 FROM public.profiles ap WHERE ap.id = auth.uid() AND ap.is_admin = true))' END) || '
      ORDER BY p.created_at DESC
    ';

    EXECUTE 'GRANT SELECT ON public.admin_users_overview TO authenticated';
  END IF;

  IF to_regclass('public.admin_system_diagnostics') IS NOT NULL OR to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE '
      CREATE OR REPLACE VIEW public.admin_system_diagnostics AS
      SELECT
        ''total_users'' as metric,
        COUNT(*)::TEXT as value,
        ''Total registered users'' as description
      FROM public.profiles
      WHERE ' || (CASE WHEN has_admin_fn THEN 'public.is_current_user_admin()' ELSE '(EXISTS (SELECT 1 FROM public.profiles ap WHERE ap.id = auth.uid() AND ap.is_admin = true))' END) || '
      UNION ALL
      SELECT
        ''active_users_7d'' as metric,
        COUNT(DISTINCT user_id)::TEXT as value,
        ''Users active in last 7 days'' as description
      FROM public.poi_comments
      WHERE created_at > NOW() - INTERVAL ''7 days''
        AND ' || (CASE WHEN has_admin_fn THEN 'public.is_current_user_admin()' ELSE '(EXISTS (SELECT 1 FROM public.profiles ap WHERE ap.id = auth.uid() AND ap.is_admin = true))' END) || '
      UNION ALL
      SELECT
        ''total_pois'' as metric,
        COUNT(*)::TEXT as value,
        ''Total points of interest'' as description
      FROM public.pois
      WHERE ' || (CASE WHEN has_admin_fn THEN 'public.is_current_user_admin()' ELSE '(EXISTS (SELECT 1 FROM public.profiles ap WHERE ap.id = auth.uid() AND ap.is_admin = true))' END) || '
      UNION ALL
      SELECT
        ''total_comments'' as metric,
        COUNT(*)::TEXT as value,
        ''Total comments'' as description
      FROM public.poi_comments
      WHERE ' || (CASE WHEN has_admin_fn THEN 'public.is_current_user_admin()' ELSE '(EXISTS (SELECT 1 FROM public.profiles ap WHERE ap.id = auth.uid() AND ap.is_admin = true))' END) || '
      UNION ALL
      SELECT
        ''total_ratings'' as metric,
        COUNT(*)::TEXT as value,
        ''Total ratings'' as description
      FROM public.poi_ratings
      WHERE ' || (CASE WHEN has_admin_fn THEN 'public.is_current_user_admin()' ELSE '(EXISTS (SELECT 1 FROM public.profiles ap WHERE ap.id = auth.uid() AND ap.is_admin = true))' END) || '
      UNION ALL
      SELECT
        ''total_visits'' as metric,
        COUNT(*)::TEXT as value,
        ''Total POI visits'' as description
      FROM public.user_poi_visits
      WHERE ' || (CASE WHEN has_admin_fn THEN 'public.is_current_user_admin()' ELSE '(EXISTS (SELECT 1 FROM public.profiles ap WHERE ap.id = auth.uid() AND ap.is_admin = true))' END) || '
    ';

    EXECUTE 'GRANT SELECT ON public.admin_system_diagnostics TO authenticated';
  END IF;
END $$;
