begin;

-- Stage 3A publication safety.
-- Remove legacy policies that expose every available offer and replace them
-- with one explicit public contract: available AND published. No offer row is
-- modified by this migration.

do $$
begin
  if to_regclass('public.car_offers') is null then
    raise exception using
      errcode = '42P01',
      message = 'car_publication_safety_car_offers_missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'car_offers'
      and column_name = 'is_available'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'car_offers'
      and column_name = 'is_published'
  ) then
    raise exception using
      errcode = '42703',
      message = 'car_publication_safety_required_columns_missing';
  end if;

  if to_regprocedure('public.is_current_user_admin()') is null
     or to_regprocedure('public.is_partner_user(uuid)') is null then
    raise exception using
      errcode = '42883',
      message = 'car_publication_safety_access_helpers_missing';
  end if;
end
$$;

alter table public.car_offers enable row level security;

drop policy if exists "Anyone can view available car offers" on public.car_offers;
drop policy if exists "Authenticated users can view all offers" on public.car_offers;
drop policy if exists car_offers_public_select on public.car_offers;
drop policy if exists car_offers_authenticated_select on public.car_offers;

create policy car_offers_public_select
on public.car_offers
for select
to anon
using (is_available is true and is_published is true);

-- Authenticated administrators and owning partners retain their existing
-- internal access. Ordinary authenticated customers receive the same public
-- availability/publication restriction as anon.
create policy car_offers_authenticated_select
on public.car_offers
for select
to authenticated
using (
  public.is_current_user_admin()
  or (owner_partner_id is not null and public.is_partner_user(owner_partner_id))
  or (is_available is true and is_published is true)
);

do $$
begin
  if exists (
    select 1
    from pg_policy policy
    where policy.polrelid = 'public.car_offers'::regclass
      and policy.polname in (
        'Anyone can view available car offers',
        'Authenticated users can view all offers'
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'car_publication_safety_legacy_policy_remains';
  end if;

  if exists (
    select 1
    from pg_policy policy
    where policy.polrelid = 'public.car_offers'::regclass
      and policy.polcmd in ('r', '*')
      and (
        0::oid = any(policy.polroles)
        or (select role.oid from pg_roles role where role.rolname = 'anon') = any(policy.polroles)
      )
      and (
        coalesce(pg_get_expr(policy.polqual, policy.polrelid), '') not ilike '%is_available%'
        or coalesce(pg_get_expr(policy.polqual, policy.polrelid), '') not ilike '%is_published%'
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'car_publication_safety_unsafe_anon_policy_remains';
  end if;
end
$$;

commit;
