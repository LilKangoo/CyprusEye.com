begin;

do $$
declare
  backup_table record;
  backup_policy record;
  admin_expr text;
  internal_table text;
  internal_policy record;
begin
  if to_regprocedure('public.is_current_user_admin()') is not null then
    admin_expr := 'public.is_current_user_admin()';
  else
    admin_expr := '(exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_admin, false) = true))';
  end if;

  for backup_table in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and (
        tablename = 'pois_backup_i18n_final'
        or tablename = 'car_offers_backup'
        or tablename = 'tasks_backup_quests_i18n'
        or tablename like 'pois_backup_before_i18n_deploy_%'
      )
  loop
    for backup_policy in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = backup_table.tablename
    loop
      execute format(
        'drop policy if exists %I on public.%I',
        backup_policy.policyname,
        backup_table.tablename
      );
    end loop;

    execute format(
      'revoke all privileges on table public.%I from anon, authenticated',
      backup_table.tablename
    );

    execute format(
      'alter table public.%I enable row level security',
      backup_table.tablename
    );
  end loop;

  foreach internal_table in array array[
    'admin_activity_log',
    'car_location_fees',
    'car_pricing_rules'
  ]
  loop
    if to_regclass(format('public.%I', internal_table)) is null then
      continue;
    end if;

    for internal_policy in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = internal_table
    loop
      execute format(
        'drop policy if exists %I on public.%I',
        internal_policy.policyname,
        internal_table
      );
    end loop;

    execute format(
      'revoke all privileges on table public.%I from anon, authenticated',
      internal_table
    );

    execute format(
      'grant select, insert, update, delete on table public.%I to authenticated',
      internal_table
    );

    execute format(
      'alter table public.%I enable row level security',
      internal_table
    );

    execute format(
      'create policy %I on public.%I for select to authenticated using (%s)',
      internal_table || '_admin_select',
      internal_table,
      admin_expr
    );

    execute format(
      'create policy %I on public.%I for insert to authenticated with check (%s)',
      internal_table || '_admin_insert',
      internal_table,
      admin_expr
    );

    execute format(
      'create policy %I on public.%I for update to authenticated using (%s) with check (%s)',
      internal_table || '_admin_update',
      internal_table,
      admin_expr,
      admin_expr
    );

    execute format(
      'create policy %I on public.%I for delete to authenticated using (%s)',
      internal_table || '_admin_delete',
      internal_table,
      admin_expr
    );
  end loop;
end
$$;

commit;
