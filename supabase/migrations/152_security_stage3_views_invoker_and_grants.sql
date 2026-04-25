begin;

do $$
declare
  admin_expr text;
  view_name text;
  admin_views text[] := array[
    'admin_users_overview',
    'admin_active_users_7d',
    'admin_reported_comments',
    'admin_system_diagnostics',
    'car_coupon_usage_stats',
    'service_coupon_usage_stats',
    'referral_stats',
    'top_referrers'
  ];
  public_views text[] := array[
    'poi_rating_stats',
    'profile_basic',
    'public_tasks'
  ];
  invoker_only_views text[] := array[
    'admin_users_overview',
    'admin_reported_comments',
    'admin_system_diagnostics',
    'car_coupon_usage_stats',
    'service_coupon_usage_stats',
    'referral_stats',
    'top_referrers',
    'poi_rating_stats',
    'profile_basic',
    'public_tasks'
  ];
begin
  if to_regprocedure('public.is_current_user_admin()') is not null then
    admin_expr := 'public.is_current_user_admin()';
  else
    admin_expr := '(exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_admin, false) = true))';
  end if;

  if to_regclass('public.admin_active_users_7d') is not null then
    execute '
      create or replace view public.admin_active_users_7d
      with (security_invoker = true)
      as
      select count(distinct user_id) as value
      from public.poi_comments
      where created_at >= now() - interval ''7 days''
        and ' || admin_expr;
  end if;

  foreach view_name in array invoker_only_views loop
    if to_regclass('public.' || view_name) is not null then
      execute format(
        'alter view public.%I set (security_invoker = true)',
        view_name
      );
    end if;
  end loop;

  foreach view_name in array admin_views loop
    if to_regclass('public.' || view_name) is not null then
      execute format(
        'revoke all on table public.%I from anon, authenticated',
        view_name
      );
      execute format(
        'grant select on table public.%I to authenticated',
        view_name
      );
    end if;
  end loop;

  foreach view_name in array public_views loop
    if to_regclass('public.' || view_name) is not null then
      execute format(
        'revoke all on table public.%I from anon, authenticated',
        view_name
      );
      execute format(
        'grant select on table public.%I to anon, authenticated',
        view_name
      );
    end if;
  end loop;
end
$$;

commit;
