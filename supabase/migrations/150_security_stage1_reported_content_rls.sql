begin;

do $$
declare
  admin_expr text;
  staff_expr text;
  has_moderator_column boolean;
  existing_policy record;
begin
  if to_regclass('public.reported_content') is null then
    raise notice 'Skipping reported_content RLS migration: table does not exist.';
    return;
  end if;

  if to_regprocedure('public.is_current_user_admin()') is not null then
    admin_expr := 'public.is_current_user_admin()';
  else
    admin_expr := '(exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_admin, false) = true))';
  end if;

  if to_regprocedure('public.is_current_user_staff()') is not null then
    staff_expr := 'public.is_current_user_staff()';
  else
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'is_moderator'
    ) into has_moderator_column;

    if has_moderator_column then
      staff_expr := '(exists (select 1 from public.profiles p where p.id = auth.uid() and (coalesce(p.is_admin, false) or coalesce(p.is_moderator, false))))';
    else
      staff_expr := admin_expr;
    end if;
  end if;

  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reported_content'
  loop
    execute format(
      'drop policy if exists %I on public.reported_content',
      existing_policy.policyname
    );
  end loop;

  revoke all privileges on table public.reported_content from anon, authenticated;
  grant select, insert, update, delete on table public.reported_content to authenticated;

  alter table public.reported_content enable row level security;

  execute format(
    'create policy reported_content_staff_select on public.reported_content for select to authenticated using (%s)',
    staff_expr
  );

  execute format(
    'create policy reported_content_staff_update on public.reported_content for update to authenticated using (%s) with check (%s)',
    staff_expr,
    staff_expr
  );

  execute format(
    'create policy reported_content_staff_delete on public.reported_content for delete to authenticated using (%s)',
    staff_expr
  );

  create policy reported_content_user_insert
    on public.reported_content
    for insert
    to authenticated
    with check (
      auth.uid() is not null
      and coalesce(reporter_id, auth.uid()) = auth.uid()
      and resolved_at is null
      and resolved_by is null
      and coalesce(status, 'pending') in ('pending', 'open')
    );
end
$$;

commit;
