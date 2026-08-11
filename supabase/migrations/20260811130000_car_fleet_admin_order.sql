-- car-fleet-admin-order-v1
-- Admin-only Fleet ordering, isolated from public Cars merchandising order.
--
-- This migration never changes public.car_offers.sort_order or any pricing,
-- availability, publication, partner, deposit or booking field.

begin;

do $prerequisites$
begin
  if to_regclass('public.car_offers') is null then
    raise exception using
      errcode = '42P01',
      message = 'car_fleet_admin_order_required_table_missing';
  end if;

  if to_regprocedure('public.is_current_user_admin()') is null then
    raise exception using
      errcode = '42883',
      message = 'car_fleet_admin_order_admin_helper_missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns column_info
    where column_info.table_schema = 'public'
      and column_info.table_name = 'car_offers'
      and column_info.column_name = 'sort_order'
      and column_info.data_type = 'integer'
  ) or not exists (
    select 1
    from information_schema.columns column_info
    where column_info.table_schema = 'public'
      and column_info.table_name = 'car_offers'
      and column_info.column_name = 'updated_at'
      and column_info.data_type = 'timestamp with time zone'
  ) then
    raise exception using
      errcode = '42703',
      message = 'car_fleet_admin_order_offer_contract_missing';
  end if;
end
$prerequisites$;

lock table public.car_offers in share mode;

create temporary table _car_fleet_admin_order_offer_before on commit drop as
select offer.id, offer.sort_order, offer.updated_at
from public.car_offers offer;

create table public.car_offer_admin_order (
  offer_id uuid primary key
    references public.car_offers(id) on delete cascade,
  admin_sort_order integer not null,
  updated_at timestamptz not null default now(),
  constraint car_offer_admin_order_positive
    check (admin_sort_order > 0),
  constraint car_offer_admin_order_sort_unique
    unique (admin_sort_order) deferrable initially immediate
);

comment on table public.car_offer_admin_order is
  'Private Admin Fleet ordering. It never affects public quote-total ordering.';
comment on column public.car_offer_admin_order.admin_sort_order is
  'Dense one-based global position used only by the Admin Fleet list.';

insert into public.car_offer_admin_order (offer_id, admin_sort_order)
select
  offer.id,
  row_number() over (
    order by
      lower(coalesce(offer.location, '')),
      offer.sort_order nulls last,
      offer.created_at nulls last,
      offer.id
  )::integer
from public.car_offers offer;

create or replace function public.car_offer_admin_order_set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger car_offer_admin_order_set_updated_at
before update on public.car_offer_admin_order
for each row
execute function public.car_offer_admin_order_set_updated_at();

create or replace function public.car_offer_admin_order_append_new_offer()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_next_order integer;
begin
  -- Serialize concurrent offer inserts before deriving the next dense position.
  perform pg_advisory_xact_lock(20260811, 130000);

  select coalesce(max(order_row.admin_sort_order), 0) + 1
  into v_next_order
  from public.car_offer_admin_order order_row;

  insert into public.car_offer_admin_order (offer_id, admin_sort_order)
  values (new.id, v_next_order);

  return new;
end
$$;

create trigger car_offers_append_admin_order
after insert on public.car_offers
for each row
execute function public.car_offer_admin_order_append_new_offer();

create or replace function public.admin_reorder_car_fleet(
  p_expected_rows jsonb,
  p_ordered_offer_ids jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_request_role text;
  v_offer_count integer;
  v_expected_count integer;
  v_desired_count integer;
  v_updated_count integer;
  v_receipt_rows jsonb;
begin
  begin
    v_request_role := coalesce(
      nullif(auth.jwt() ->> 'role', ''),
      nullif(current_setting('request.jwt.claim.role', true), '')
    );
  exception when others then
    v_request_role := null;
  end;

  if not public.is_current_user_admin()
     and v_request_role is distinct from 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'car_fleet_admin_order_admin_required';
  end if;

  if p_expected_rows is null
     or jsonb_typeof(p_expected_rows) <> 'array'
     or p_ordered_offer_ids is null
     or jsonb_typeof(p_ordered_offer_ids) <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'car_fleet_admin_order_invalid_arguments';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_expected_rows) expected(value)
    where jsonb_typeof(expected.value) <> 'object'
       or not (
         expected.value ? 'offer_id'
         and expected.value ? 'admin_sort_order'
         and expected.value ? 'updated_at'
       )
       or exists (
         select 1
         from jsonb_object_keys(expected.value) field(name)
         where field.name not in ('offer_id', 'admin_sort_order', 'updated_at')
       )
  ) or exists (
    select 1
    from jsonb_array_elements(p_ordered_offer_ids) desired(value)
    where jsonb_typeof(desired.value) <> 'string'
  ) then
    raise exception using
      errcode = '22023',
      message = 'car_fleet_admin_order_invalid_row_shape';
  end if;

  -- Membership cannot change while the reviewed complete global order is
  -- checked and applied. The private table lock serializes all reorder calls.
  lock table public.car_offers in share mode;
  lock table public.car_offer_admin_order in share row exclusive mode;

  select count(*) into v_offer_count from public.car_offers;
  v_expected_count := jsonb_array_length(p_expected_rows);
  v_desired_count := jsonb_array_length(p_ordered_offer_ids);

  if (select count(*) from public.car_offer_admin_order) <> v_offer_count
     or exists (
       select 1
       from public.car_offers offer
       left join public.car_offer_admin_order order_row on order_row.offer_id = offer.id
       where order_row.offer_id is null
     ) then
    raise exception using
      errcode = '23514',
      message = 'car_fleet_admin_order_membership_invariant_failed';
  end if;

  begin
    if exists (
      select 1
      from jsonb_to_recordset(p_expected_rows) expected(
        offer_id uuid,
        admin_sort_order integer,
        updated_at timestamptz
      )
      where expected.offer_id is null
         or expected.admin_sort_order is null
         or expected.updated_at is null
    ) or (
      select count(*)
      from jsonb_to_recordset(p_expected_rows) expected(offer_id uuid)
    ) <> (
      select count(distinct expected.offer_id)
      from jsonb_to_recordset(p_expected_rows) expected(offer_id uuid)
    ) or (
      select count(*)
      from jsonb_array_elements_text(p_ordered_offer_ids) desired(offer_id)
    ) <> (
      select count(distinct desired.offer_id::uuid)
      from jsonb_array_elements_text(p_ordered_offer_ids) desired(offer_id)
    ) then
      raise exception using
        errcode = '22023',
        message = 'car_fleet_admin_order_duplicate_or_invalid_offer_id';
    end if;
  exception when invalid_text_representation or datetime_field_overflow then
    raise exception using
      errcode = '22023',
      message = 'car_fleet_admin_order_duplicate_or_invalid_offer_id';
  end;

  if v_expected_count <> v_offer_count
     or v_desired_count <> v_offer_count then
    raise exception using
      errcode = '40001',
      message = 'car_fleet_admin_order_membership_changed';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_expected_rows) expected(
      offer_id uuid,
      admin_sort_order integer,
      updated_at timestamptz
    )
    full join public.car_offer_admin_order order_row
      on order_row.offer_id = expected.offer_id
    where expected.offer_id is null
       or order_row.offer_id is null
       or order_row.admin_sort_order is distinct from expected.admin_sort_order
       or order_row.updated_at is distinct from expected.updated_at
  ) then
    raise exception using
      errcode = '40001',
      message = 'car_fleet_admin_order_stale_snapshot';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(p_ordered_offer_ids) desired(offer_id)
    left join public.car_offers offer on offer.id = desired.offer_id::uuid
    where offer.id is null
  ) then
    raise exception using
      errcode = '40001',
      message = 'car_fleet_admin_order_membership_changed';
  end if;

  set constraints car_offer_admin_order_sort_unique deferred;

  with desired as (
    select desired.offer_id::uuid as offer_id, desired.ordinality::integer as admin_sort_order
    from jsonb_array_elements_text(p_ordered_offer_ids)
      with ordinality desired(offer_id, ordinality)
  )
  update public.car_offer_admin_order order_row
  set admin_sort_order = desired.admin_sort_order
  from desired
  where order_row.offer_id = desired.offer_id;

  get diagnostics v_updated_count = row_count;
  set constraints car_offer_admin_order_sort_unique immediate;

  if v_updated_count <> v_offer_count
     or (
       select count(distinct order_row.admin_sort_order)
       from public.car_offer_admin_order order_row
     ) <> v_offer_count
     or (
       v_offer_count > 0
       and (
         (select min(order_row.admin_sort_order) from public.car_offer_admin_order order_row) <> 1
         or (select max(order_row.admin_sort_order) from public.car_offer_admin_order order_row) <> v_offer_count
       )
     ) then
    raise exception using
      errcode = '23514',
      message = 'car_fleet_admin_order_postcondition_failed';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'offer_id', order_row.offer_id,
    'admin_sort_order', order_row.admin_sort_order,
    'updated_at', order_row.updated_at
  ) order by order_row.admin_sort_order), '[]'::jsonb)
  into v_receipt_rows
  from public.car_offer_admin_order order_row;

  return jsonb_build_object(
    'operation', 'fleet_admin_reorder',
    'offer_count', v_offer_count,
    'offer_ids', p_ordered_offer_ids,
    'rows', v_receipt_rows
  );
end
$$;

comment on function public.admin_reorder_car_fleet(jsonb, jsonb) is
  'Admin/service-only stale-safe transaction replacing the complete private Fleet order. Public Cars order is unchanged.';

alter table public.car_offer_admin_order enable row level security;

revoke all on table public.car_offer_admin_order
from public, anon, authenticated;
grant select on table public.car_offer_admin_order to authenticated;
grant select, insert, update, delete on table public.car_offer_admin_order to service_role;

create policy car_offer_admin_order_admin_select
on public.car_offer_admin_order
for select
to authenticated
using (public.is_current_user_admin());

revoke all on function public.car_offer_admin_order_set_updated_at()
from public, anon, authenticated;
revoke all on function public.car_offer_admin_order_append_new_offer()
from public, anon, authenticated;
revoke all on function public.admin_reorder_car_fleet(jsonb, jsonb)
from public, anon;

grant execute on function public.car_offer_admin_order_set_updated_at()
to service_role;
grant execute on function public.car_offer_admin_order_append_new_offer()
to service_role;
grant execute on function public.admin_reorder_car_fleet(jsonb, jsonb)
to authenticated, service_role;

do $postconditions$
declare
  v_offer_count integer;
  v_rpc_source text;
  v_append_source text;
begin
  select count(*) into v_offer_count from public.car_offers;
  select procedure.prosrc into v_rpc_source
  from pg_proc procedure
  where procedure.oid = to_regprocedure('public.admin_reorder_car_fleet(jsonb,jsonb)');
  select procedure.prosrc into v_append_source
  from pg_proc procedure
  where procedure.oid = to_regprocedure('public.car_offer_admin_order_append_new_offer()');

  if (select count(*) from public.car_offer_admin_order) <> v_offer_count
     or exists (
       select 1
       from public.car_offers offer
       left join public.car_offer_admin_order order_row on order_row.offer_id = offer.id
       where order_row.offer_id is null
     )
     or (
       select count(distinct order_row.admin_sort_order)
       from public.car_offer_admin_order order_row
     ) <> v_offer_count
     or (
       v_offer_count > 0
       and (
         (select min(order_row.admin_sort_order) from public.car_offer_admin_order order_row) <> 1
         or (select max(order_row.admin_sort_order) from public.car_offer_admin_order order_row) <> v_offer_count
       )
     ) then
    raise exception using
      errcode = '23514',
      message = 'car_fleet_admin_order_backfill_failed';
  end if;

  if exists (
    select 1
    from _car_fleet_admin_order_offer_before before_state
    full join public.car_offers offer using (id)
    where before_state.id is null
       or offer.id is null
       or offer.sort_order is distinct from before_state.sort_order
       or offer.updated_at is distinct from before_state.updated_at
  ) then
    raise exception using
      errcode = '23514',
      message = 'car_fleet_admin_order_changed_public_offer_order';
  end if;

  if to_regprocedure('public.admin_reorder_car_fleet(jsonb,jsonb)') is null
     or position('lock table public.car_offers in share mode' in coalesce(v_rpc_source, '')) = 0
     or position('car_fleet_admin_order_stale_snapshot' in coalesce(v_rpc_source, '')) = 0
     or position('set constraints car_offer_admin_order_sort_unique deferred' in coalesce(v_rpc_source, '')) = 0
     or position('pg_advisory_xact_lock' in coalesce(v_append_source, '')) = 0 then
    raise exception using
      errcode = '23514',
      message = 'car_fleet_admin_order_function_contract_failed';
  end if;

  if has_table_privilege('anon', 'public.car_offer_admin_order', 'SELECT')
     or has_table_privilege('authenticated', 'public.car_offer_admin_order', 'INSERT')
     or has_table_privilege('authenticated', 'public.car_offer_admin_order', 'UPDATE')
     or has_table_privilege('authenticated', 'public.car_offer_admin_order', 'DELETE')
     or not has_table_privilege('authenticated', 'public.car_offer_admin_order', 'SELECT')
     or has_function_privilege('anon', 'public.admin_reorder_car_fleet(jsonb,jsonb)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.admin_reorder_car_fleet(jsonb,jsonb)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.admin_reorder_car_fleet(jsonb,jsonb)', 'EXECUTE') then
    raise exception using
      errcode = '42501',
      message = 'car_fleet_admin_order_privilege_contract_failed';
  end if;
end
$postconditions$;

commit;
