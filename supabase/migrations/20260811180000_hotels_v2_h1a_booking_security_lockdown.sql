begin;
set transaction isolation level repeatable read;

-- Hotels 2.0 H1A: remove the broad authenticated Hotel-booking read policy
-- only after the exact-partner operational bridge exists.  This migration is
-- intentionally data-inert and preserves the request -> partner confirmation
-- lifecycle.

do $$
declare
  v_missing text[];
begin
  select coalesce(array_agg(required.name order by required.name), '{}'::text[])
  into v_missing
  from unnest(array[
    'public.hotel_bookings',
    'public.hotels',
    'public.partner_service_fulfillments',
    'public.service_deposit_requests',
    'public.service_coupon_redemptions'
  ]::text[]) as required(name)
  where to_regclass(required.name) is null;

  if cardinality(v_missing) > 0 then
    raise exception using
      errcode = '42P01',
      message = 'hotels_h1a_security_required_object_missing',
      detail = array_to_string(v_missing, ',');
  end if;

  if to_regprocedure('public.is_current_user_admin()') is null
     or to_regprocedure('public.customer_get_hotel_bookings(integer)') is null
     or to_regprocedure('public.partner_get_referral_attributed_orders_safe(uuid,integer)') is null
     or to_regprocedure('public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)') is null
     or to_regprocedure('public.admin_upsert_partner_service_fulfillment_exact(uuid,text,uuid,uuid,date,date,numeric,text,text,text,text,text,text,timestamp with time zone)') is null then
    raise exception using
      errcode = '42883',
      message = 'hotels_h1a_security_bridge_missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'hotel_bookings'
      and column_name = 'user_id'
      and data_type = 'uuid'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'hotel_bookings'
      and column_name = 'created_by'
      and data_type = 'uuid'
  ) then
    raise exception using
      errcode = '42703',
      message = 'hotels_h1a_security_booking_owner_columns_missing';
  end if;
end
$$;

create temporary table hotels_h1a_security_before on commit drop as
select
  (select md5(coalesce(string_agg(to_jsonb(booking_row)::text, '|' order by booking_row.id), ''))
   from public.hotel_bookings booking_row) as booking_fingerprint,
  (select md5(coalesce(string_agg(to_jsonb(fulfillment_row)::text, '|' order by fulfillment_row.id), ''))
   from public.partner_service_fulfillments fulfillment_row
   where fulfillment_row.resource_type = 'hotels') as fulfillment_fingerprint,
  (select md5(coalesce(string_agg(to_jsonb(deposit_row)::text, '|' order by deposit_row.id), ''))
   from public.service_deposit_requests deposit_row
   where deposit_row.resource_type = 'hotels') as deposit_fingerprint,
  (select md5(coalesce(string_agg(to_jsonb(coupon_row)::text, '|' order by coupon_row.id), ''))
   from public.service_coupon_redemptions coupon_row
   where coupon_row.service_type = 'hotels') as coupon_fingerprint;

create or replace function public.hotel_bookings_assign_authenticated_owner()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or public.is_current_user_admin() then
    return new;
  end if;

  if new.user_id is null then
    new.user_id := v_uid;
  elsif new.user_id is distinct from v_uid then
    raise exception using
      errcode = '42501',
      message = 'hotel_booking_user_id_must_match_authenticated_user';
  end if;

  if new.created_by is not null and new.created_by is distinct from v_uid then
    raise exception using
      errcode = '42501',
      message = 'hotel_booking_created_by_must_match_authenticated_user';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_hotel_bookings_assign_authenticated_owner on public.hotel_bookings;
create trigger trg_hotel_bookings_assign_authenticated_owner
before insert on public.hotel_bookings
for each row
execute function public.hotel_bookings_assign_authenticated_owner();

revoke all on function public.hotel_bookings_assign_authenticated_owner() from public;
revoke all on function public.hotel_bookings_assign_authenticated_owner() from anon;
revoke all on function public.hotel_bookings_assign_authenticated_owner() from authenticated;
grant execute on function public.hotel_bookings_assign_authenticated_owner() to service_role;

alter table public.hotel_bookings enable row level security;

drop policy if exists "Authenticated users can view hotel bookings" on public.hotel_bookings;
drop policy if exists hotel_bookings_authenticated_select on public.hotel_bookings;
drop policy if exists hotel_bookings_customer_select on public.hotel_bookings;
drop policy if exists hotel_bookings_admin_select on public.hotel_bookings;
drop policy if exists "Admins can update hotel bookings" on public.hotel_bookings;
drop policy if exists "Admins can delete hotel bookings" on public.hotel_bookings;
drop policy if exists "Anyone can create hotel bookings" on public.hotel_bookings;
drop policy if exists hotel_bookings_anon_insert on public.hotel_bookings;
drop policy if exists hotel_bookings_authenticated_insert on public.hotel_bookings;

create policy hotel_bookings_customer_select
on public.hotel_bookings
for select
to authenticated
using (
  user_id = auth.uid()
  or created_by = auth.uid()
);

create policy hotel_bookings_admin_select
on public.hotel_bookings
for select
to authenticated
using (public.is_current_user_admin());

create policy "Admins can update hotel bookings"
on public.hotel_bookings
for update
to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

create policy "Admins can delete hotel bookings"
on public.hotel_bookings
for delete
to authenticated
using (public.is_current_user_admin());

create policy hotel_bookings_anon_insert
on public.hotel_bookings
for insert
to anon
with check (
  user_id is null
  and created_by is null
  and nullif(btrim(coalesce(customer_name, '')), '') is not null
  and coalesce(customer_email, '') ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  and arrival_date is not null
  and departure_date is not null
  and departure_date > arrival_date
  and coalesce(num_adults, 1) >= 1
  and coalesce(status, 'pending') = 'pending'
);

create policy hotel_bookings_authenticated_insert
on public.hotel_bookings
for insert
to authenticated
with check (
  (public.is_current_user_admin() or user_id = auth.uid())
  and (created_by is null or created_by = auth.uid() or public.is_current_user_admin())
  and nullif(btrim(coalesce(customer_name, '')), '') is not null
  and coalesce(customer_email, '') ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  and arrival_date is not null
  and departure_date is not null
  and departure_date > arrival_date
  and coalesce(num_adults, 1) >= 1
  and coalesce(status, 'pending') = 'pending'
);

revoke all on table public.hotel_bookings from public;
revoke all on table public.hotel_bookings from anon;
revoke all on table public.hotel_bookings from authenticated;
grant insert on table public.hotel_bookings to anon;
grant select, insert, update, delete on table public.hotel_bookings to authenticated;
grant all on table public.hotel_bookings to service_role;

create index if not exists hotel_bookings_user_id_idx
  on public.hotel_bookings(user_id)
  where user_id is not null;
create index if not exists hotel_bookings_created_by_idx
  on public.hotel_bookings(created_by)
  where created_by is not null;
create index if not exists hotel_bookings_legacy_customer_email_lower_idx
  on public.hotel_bookings(lower(btrim(customer_email)))
  where user_id is null and created_by is null and customer_email is not null;

-- Trigger-only Hotel functions are not browser APIs.  Direct EXECUTE is
-- removed while PostgreSQL trigger execution continues normally.
do $$
declare
  v_name text;
  v_function regprocedure;
begin
  foreach v_name in array array[
    'hotel_bookings_assign_authenticated_owner',
    'trg_apply_service_coupon_hotel_booking',
    'trg_enqueue_customer_received_hotel_booking',
    'trg_notify_admin_new_hotel_booking',
    'trg_partner_service_fulfillment_from_hotel_booking',
    'trg_service_coupon_redemption_from_hotel_booking',
    'trg_sync_hotel_coupon_to_fulfillment',
    'update_hotel_bookings_updated_at',
    'update_hotel_categories_updated_at',
    'update_hotel_cities_updated_at',
    'update_hotels_updated_at',
    'validate_hotels_photos_len'
  ]
  loop
    for v_function in
      select function_info.oid::regprocedure
      from pg_proc function_info
      join pg_namespace namespace_info on namespace_info.oid = function_info.pronamespace
      where namespace_info.nspname = 'public'
        and function_info.proname = v_name
        and not exists (
          select 1
          from pg_depend dependency
          join pg_extension extension_info on extension_info.oid = dependency.refobjid
          where dependency.objid = function_info.oid
            and dependency.deptype = 'e'
        )
    loop
      execute format('alter function %s set search_path = pg_catalog, public', v_function);
      execute format('revoke execute on function %s from public', v_function);
      execute format('revoke execute on function %s from anon', v_function);
      execute format('revoke execute on function %s from authenticated', v_function);
      execute format('grant execute on function %s to service_role', v_function);
    end loop;
  end loop;
end
$$;

-- The Hotel adjustment RPC is intentionally callable by signed-in Admins,
-- but its body performs its own Admin check.  It must never be anonymous.
do $$
declare
  v_function regprocedure;
begin
  for v_function in
    select function_info.oid::regprocedure
    from pg_proc function_info
    join pg_namespace namespace_info on namespace_info.oid = function_info.pronamespace
    where namespace_info.nspname = 'public'
      and function_info.proname = 'admin_apply_hotel_booking_manual_adjustment'
  loop
    execute format('alter function %s set search_path = pg_catalog, public', v_function);
    execute format('revoke execute on function %s from public', v_function);
    execute format('revoke execute on function %s from anon', v_function);
    execute format('grant execute on function %s to authenticated', v_function);
    execute format('grant execute on function %s to service_role', v_function);
  end loop;
end
$$;

-- Internal fulfillment writers are trigger/service helpers.  Browser Admin
-- calls the separately authorized wrapper installed by the bridge migration.
do $$
declare
  v_name text;
  v_function regprocedure;
begin
  foreach v_name in array array[
    'upsert_partner_service_fulfillment_from_booking',
    'upsert_partner_service_fulfillment_from_booking_with_partner',
    'upsert_partner_service_fulfillments_for_resource_partners'
  ]
  loop
    for v_function in
      select function_info.oid::regprocedure
      from pg_proc function_info
      join pg_namespace namespace_info on namespace_info.oid = function_info.pronamespace
      where namespace_info.nspname = 'public'
        and function_info.proname = v_name
    loop
      execute format('alter function %s set search_path = pg_catalog, public', v_function);
      execute format('revoke execute on function %s from public', v_function);
      execute format('revoke execute on function %s from anon', v_function);
      execute format('revoke execute on function %s from authenticated', v_function);
      execute format('grant execute on function %s to service_role', v_function);
    end loop;
  end loop;
end
$$;

-- The client now uses the redacted compatibility bridge. The original RPC is
-- internal because its legacy return contract contains customer_name.
revoke all on function public.partner_get_referral_attributed_orders(uuid,integer) from public;
revoke all on function public.partner_get_referral_attributed_orders(uuid,integer) from anon;
revoke all on function public.partner_get_referral_attributed_orders(uuid,integer) from authenticated;

do $$
declare
  v_before record;
  v_booking_after text;
  v_fulfillment_after text;
  v_deposit_after text;
  v_coupon_after text;
begin
  select * into v_before from hotels_h1a_security_before;
  select md5(coalesce(string_agg(to_jsonb(booking_row)::text, '|' order by booking_row.id), ''))
  into v_booking_after from public.hotel_bookings booking_row;
  select md5(coalesce(string_agg(to_jsonb(fulfillment_row)::text, '|' order by fulfillment_row.id), ''))
  into v_fulfillment_after
  from public.partner_service_fulfillments fulfillment_row
  where fulfillment_row.resource_type = 'hotels';
  select md5(coalesce(string_agg(to_jsonb(deposit_row)::text, '|' order by deposit_row.id), ''))
  into v_deposit_after
  from public.service_deposit_requests deposit_row
  where deposit_row.resource_type = 'hotels';
  select md5(coalesce(string_agg(to_jsonb(coupon_row)::text, '|' order by coupon_row.id), ''))
  into v_coupon_after
  from public.service_coupon_redemptions coupon_row
  where coupon_row.service_type = 'hotels';

  if v_booking_after is distinct from v_before.booking_fingerprint
     or v_fulfillment_after is distinct from v_before.fulfillment_fingerprint
     or v_deposit_after is distinct from v_before.deposit_fingerprint
     or v_coupon_after is distinct from v_before.coupon_fingerprint then
    raise exception using
      errcode = '23514',
      message = 'hotels_h1a_security_protected_data_changed';
  end if;

  if exists (
    select 1
    from pg_policies policy_info
    where policy_info.schemaname = 'public'
      and policy_info.tablename = 'hotel_bookings'
      and policy_info.cmd = 'SELECT'
      and 'authenticated' = any(policy_info.roles)
      and regexp_replace(coalesce(policy_info.qual, ''), '[()[:space:]]', '', 'g') = 'true'
  ) then
    raise exception using
      errcode = '23514',
      message = 'hotels_h1a_security_broad_authenticated_select_remains';
  end if;

  if (
    select count(*)
    from pg_policies policy_info
    where policy_info.schemaname = 'public'
      and policy_info.tablename = 'hotel_bookings'
  ) <> 6
  or exists (
    select expected.policy_name
    from unnest(array[
      'hotel_bookings_customer_select',
      'hotel_bookings_admin_select',
      'Admins can update hotel bookings',
      'Admins can delete hotel bookings',
      'hotel_bookings_anon_insert',
      'hotel_bookings_authenticated_insert'
    ]::text[]) expected(policy_name)
    where not exists (
      select 1
      from pg_policies policy_info
      where policy_info.schemaname = 'public'
        and policy_info.tablename = 'hotel_bookings'
        and policy_info.policyname = expected.policy_name
    )
  ) then
    raise exception using
      errcode = '23514',
      message = 'hotels_h1a_security_policy_set_mismatch';
  end if;

  if has_table_privilege('anon', 'public.hotel_bookings', 'SELECT')
     or not has_table_privilege('anon', 'public.hotel_bookings', 'INSERT')
     or not has_table_privilege('authenticated', 'public.hotel_bookings', 'SELECT')
     or not exists (
       select 1 from pg_policies
       where schemaname = 'public'
         and tablename = 'hotel_bookings'
         and policyname = 'hotel_bookings_customer_select'
     )
     or not exists (
       select 1 from pg_policies
       where schemaname = 'public'
         and tablename = 'hotel_bookings'
         and policyname = 'hotel_bookings_admin_select'
     ) then
    raise exception using
      errcode = '23514',
      message = 'hotels_h1a_security_postcondition_failed';
  end if;

  if has_function_privilege(
       'authenticated',
       'public.upsert_partner_service_fulfillment_from_booking_with_partner(uuid,text,uuid,uuid,date,date,numeric,text,text,text,text,text,text,timestamp with time zone)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.partner_get_referral_attributed_orders(uuid,integer)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.partner_get_referral_attributed_orders_safe(uuid,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.partner_get_referral_attributed_orders_safe(uuid,integer)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.customer_get_hotel_bookings(integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.customer_get_hotel_bookings(integer)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_upsert_partner_service_fulfillment_exact(uuid,text,uuid,uuid,date,date,numeric,text,text,text,text,text,text,timestamp with time zone)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_upsert_partner_service_fulfillment_exact(uuid,text,uuid,uuid,date,date,numeric,text,text,text,text,text,text,timestamp with time zone)',
       'EXECUTE'
     ) then
    raise exception using
      errcode = '23514',
      message = 'hotels_h1a_security_function_grant_postcondition_failed';
  end if;
end
$$;

commit;
