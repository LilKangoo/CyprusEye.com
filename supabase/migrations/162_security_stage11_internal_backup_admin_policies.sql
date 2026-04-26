begin;

-- Stage 11: add admin-only policies for internal/backup tables that have RLS
-- enabled but no policies. This removes Security Advisor INFO suggestions
-- without exposing these tables to anonymous or normal authenticated users.

do $$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array[
    'admin_notification_jobs',
    'car_offers_backup',
    'pois_backup_before_i18n_deploy_20251111',
    'pois_backup_i18n_final',
    'tasks_backup_quests_i18n'
  ] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      policy_name := table_name || '_admin_all';
      execute format('drop policy if exists %I on public.%I', policy_name, table_name);
      execute format(
        'create policy %I on public.%I for all to authenticated using (public.is_current_user_admin()) with check (public.is_current_user_admin())',
        policy_name,
        table_name
      );
    end if;
  end loop;
end
$$;

commit;
