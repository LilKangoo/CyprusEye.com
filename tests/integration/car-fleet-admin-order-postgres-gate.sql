-- Isolated PostgreSQL 16 gate for
-- 20260811130000_car_fleet_admin_order.sql.
-- Synthetic fixtures only. Every mutation is rolled back.

begin;

select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

create function pg_temp.car_fleet_admin_order_snapshot()
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'offer_id', order_row.offer_id,
    'admin_sort_order', order_row.admin_sort_order,
    'updated_at', order_row.updated_at
  ) order by order_row.offer_id), '[]'::jsonb)
  from public.car_offer_admin_order order_row
$$;

create function pg_temp.car_fleet_admin_order_ids(p_descending boolean default false)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(order_row.offer_id::text order by
    case when p_descending then -order_row.admin_sort_order else order_row.admin_sort_order end,
    order_row.offer_id
  ), '[]'::jsonb)
  from public.car_offer_admin_order order_row
$$;

create temporary table _car_fleet_public_order_before on commit drop as
select offer.id, offer.sort_order, offer.updated_at
from public.car_offers offer;

do $initial_contract$
declare
  v_offer_count integer;
begin
  select count(*) into v_offer_count from public.car_offers;
  if (select count(*) from public.car_offer_admin_order) <> v_offer_count
     or (v_offer_count > 0 and (
       (select min(admin_sort_order) from public.car_offer_admin_order) <> 1
       or (select max(admin_sort_order) from public.car_offer_admin_order) <> v_offer_count
     )) then
    raise exception 'Fleet Admin order migration backfill is not dense and complete';
  end if;
end
$initial_contract$;

do $atomic_reorder$
declare
  v_receipt jsonb;
  v_expected_ids jsonb;
begin
  v_expected_ids := pg_temp.car_fleet_admin_order_ids(true);
  v_receipt := public.admin_reorder_car_fleet(
    pg_temp.car_fleet_admin_order_snapshot(),
    v_expected_ids
  );

  if v_receipt ->> 'operation' <> 'fleet_admin_reorder'
     or (v_receipt ->> 'offer_count')::integer <> (select count(*) from public.car_offers)
     or v_receipt -> 'offer_ids' is distinct from v_expected_ids
     or pg_temp.car_fleet_admin_order_ids(false) is distinct from v_expected_ids then
    raise exception 'Atomic Fleet Admin reorder receipt or persisted order mismatch: %', v_receipt;
  end if;
end
$atomic_reorder$;

-- A forged stale snapshot must abort before changing any position.
create temporary table _car_fleet_positions_before_stale on commit drop as
select offer_id, admin_sort_order, updated_at
from public.car_offer_admin_order;

do $stale_abort$
declare
  v_stale_expected jsonb;
begin
  select jsonb_agg(jsonb_build_object(
    'offer_id', order_row.offer_id,
    'admin_sort_order', order_row.admin_sort_order,
    'updated_at', order_row.updated_at - interval '1 second'
  ) order by order_row.offer_id)
  into v_stale_expected
  from public.car_offer_admin_order order_row;

  begin
    perform public.admin_reorder_car_fleet(
      v_stale_expected,
      pg_temp.car_fleet_admin_order_ids(true)
    );
    raise exception 'Stale Fleet Admin reorder unexpectedly succeeded';
  exception when serialization_failure then
    if sqlerrm <> 'car_fleet_admin_order_stale_snapshot' then
      raise;
    end if;
  end;

  if exists (
    select 1
    from _car_fleet_positions_before_stale before_state
    full join public.car_offer_admin_order order_row using (offer_id)
    where before_state.offer_id is null
       or order_row.offer_id is null
       or before_state.admin_sort_order is distinct from order_row.admin_sort_order
       or before_state.updated_at is distinct from order_row.updated_at
  ) then
    raise exception 'Stale Fleet Admin reorder partially changed rows';
  end if;
end
$stale_abort$;

do $invalid_membership_abort$
declare
  v_first_id text;
  v_duplicate_ids jsonb;
begin
  select offer_id::text into v_first_id
  from public.car_offer_admin_order
  order by admin_sort_order
  limit 1;

  v_duplicate_ids := jsonb_build_array(v_first_id, v_first_id);

  begin
    perform public.admin_reorder_car_fleet(
      pg_temp.car_fleet_admin_order_snapshot(),
      v_duplicate_ids
    );
    raise exception 'Duplicate Fleet Admin order membership unexpectedly succeeded';
  exception when invalid_parameter_value then
    if sqlerrm <> 'car_fleet_admin_order_duplicate_or_invalid_offer_id' then
      raise;
    end if;
  end;

  begin
    perform public.admin_reorder_car_fleet(
      pg_temp.car_fleet_admin_order_snapshot(),
      jsonb_build_array(v_first_id)
    );
    raise exception 'Incomplete Fleet Admin order membership unexpectedly succeeded';
  exception when serialization_failure then
    if sqlerrm <> 'car_fleet_admin_order_membership_changed' then
      raise;
    end if;
  end;
end
$invalid_membership_abort$;

do $non_admin_abort$
begin
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    '{"role":"authenticated","user_metadata":{"is_admin":false}}',
    true
  );

  begin
    perform public.admin_reorder_car_fleet(
      pg_temp.car_fleet_admin_order_snapshot(),
      pg_temp.car_fleet_admin_order_ids(false)
    );
    raise exception 'Non-Admin Fleet reorder unexpectedly succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'car_fleet_admin_order_admin_required' then
      raise;
    end if;
  end;

  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end
$non_admin_abort$;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","user_metadata":{"is_admin":false}}',
  true
);

do $non_admin_rls$
begin
  if (select count(*) from public.car_offer_admin_order) <> 0 then
    raise exception 'Non-Admin authenticated user can read private Fleet order rows';
  end if;
end
$non_admin_rls$;

select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","user_metadata":{"is_admin":true}}',
  true
);

do $admin_rls$
begin
  if (select count(*) from public.car_offer_admin_order)
       <> (select count(*) from public.car_offers) then
    raise exception 'Admin cannot read the complete private Fleet order';
  end if;
end
$admin_rls$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","user_metadata":{"is_admin":true}}',
  true
);

do $new_offer_append_and_cascade$
declare
  v_offer_id constant uuid := 'ca300001-0000-4000-8000-00000000a013';
  v_previous_count integer;
begin
  select count(*) into v_previous_count from public.car_offers;

  insert into public.car_offers
  select (jsonb_populate_record(
    null::public.car_offers,
    to_jsonb(source_offer)
      || jsonb_build_object(
        'id', v_offer_id,
        'car_model', jsonb_build_object('en', 'Admin order fixture'),
        'is_available', false,
        'is_published', false,
        'submission_status', 'draft',
        'sort_order', 999999,
        'created_at', now(),
        'updated_at', now()
      )
  )).*
  from public.car_offers source_offer
  where source_offer.id = 'ca300001-0000-4000-8000-000000000001'::uuid;

  if not exists (
    select 1
    from public.car_offer_admin_order order_row
    where order_row.offer_id = v_offer_id
      and order_row.admin_sort_order = v_previous_count + 1
  ) then
    raise exception 'New exact offer was not appended to the private Admin order';
  end if;

  delete from public.car_offers where id = v_offer_id;

  if exists (
    select 1 from public.car_offer_admin_order where offer_id = v_offer_id
  ) or (select count(*) from public.car_offer_admin_order) <> v_previous_count then
    raise exception 'Deleted exact offer did not cascade from private Admin order';
  end if;
end
$new_offer_append_and_cascade$;

reset role;
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

do $public_order_unchanged$
begin
  if exists (
    select 1
    from _car_fleet_public_order_before before_state
    full join public.car_offers offer using (id)
    where before_state.id is null
       or offer.id is null
       or before_state.sort_order is distinct from offer.sort_order
       or before_state.updated_at is distinct from offer.updated_at
  ) then
    raise exception 'Private Admin reorder changed public offer order or offer concurrency timestamps';
  end if;
end
$public_order_unchanged$;

rollback;
