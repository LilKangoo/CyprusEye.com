-- Read-only verification for 20260811130000_car_fleet_admin_order.sql.
-- Expected final column: car_fleet_admin_order_safe = true.

with contract as (
  select
    to_regclass('public.car_offer_admin_order') is not null as table_present,
    to_regprocedure('public.admin_reorder_car_fleet(jsonb,jsonb)') is not null as reorder_rpc_present,
    to_regprocedure('public.car_offer_admin_order_append_new_offer()') is not null as append_function_present,
    exists (
      select 1
      from pg_class relation
      where relation.oid = to_regclass('public.car_offer_admin_order')
        and relation.relrowsecurity
    ) as rls_enabled,
    exists (
      select 1
      from pg_constraint constraint_info
      where constraint_info.conrelid = to_regclass('public.car_offer_admin_order')
        and constraint_info.conname = 'car_offer_admin_order_sort_unique'
        and constraint_info.contype = 'u'
        and constraint_info.condeferrable
    ) as deferrable_unique_present,
    exists (
      select 1
      from pg_constraint constraint_info
      where constraint_info.conrelid = to_regclass('public.car_offer_admin_order')
        and constraint_info.conname = 'car_offer_admin_order_positive'
        and constraint_info.contype = 'c'
    ) as positive_check_present,
    exists (
      select 1
      from pg_constraint constraint_info
      where constraint_info.conrelid = to_regclass('public.car_offer_admin_order')
        and constraint_info.contype = 'f'
        and constraint_info.confrelid = 'public.car_offers'::regclass
        and constraint_info.confdeltype = 'c'
    ) as cascade_fk_present,
    exists (
      select 1
      from pg_trigger trigger_info
      where trigger_info.tgrelid = 'public.car_offers'::regclass
        and trigger_info.tgname = 'car_offers_append_admin_order'
        and not trigger_info.tgisinternal
    ) as append_trigger_present,
    exists (
      select 1
      from pg_trigger trigger_info
      where trigger_info.tgrelid = to_regclass('public.car_offer_admin_order')
        and trigger_info.tgname = 'car_offer_admin_order_set_updated_at'
        and not trigger_info.tgisinternal
    ) as updated_at_trigger_present,
    exists (
      select 1
      from pg_policy policy
      where policy.polrelid = to_regclass('public.car_offer_admin_order')
        and policy.polname = 'car_offer_admin_order_admin_select'
        and policy.polcmd = 'r'
        and position('is_current_user_admin' in coalesce(pg_get_expr(policy.polqual, policy.polrelid), '')) > 0
    ) as admin_select_policy_present,
    not has_table_privilege('anon', 'public.car_offer_admin_order', 'SELECT') as anon_table_denied,
    has_table_privilege('authenticated', 'public.car_offer_admin_order', 'SELECT')
      and not has_table_privilege('authenticated', 'public.car_offer_admin_order', 'INSERT')
      and not has_table_privilege('authenticated', 'public.car_offer_admin_order', 'UPDATE')
      and not has_table_privilege('authenticated', 'public.car_offer_admin_order', 'DELETE')
      as authenticated_read_only_grant,
    not has_function_privilege('anon', 'public.admin_reorder_car_fleet(jsonb,jsonb)', 'EXECUTE') as anon_rpc_denied,
    has_function_privilege('authenticated', 'public.admin_reorder_car_fleet(jsonb,jsonb)', 'EXECUTE') as authenticated_rpc_granted,
    has_function_privilege('service_role', 'public.admin_reorder_car_fleet(jsonb,jsonb)', 'EXECUTE') as service_rpc_granted,
    position(
      'car_fleet_admin_order_admin_required'
      in coalesce(pg_get_functiondef(to_regprocedure('public.admin_reorder_car_fleet(jsonb,jsonb)')), '')
    ) > 0 as rpc_admin_guard_present,
    position(
      'car_fleet_admin_order_stale_snapshot'
      in coalesce(pg_get_functiondef(to_regprocedure('public.admin_reorder_car_fleet(jsonb,jsonb)')), '')
    ) > 0 as rpc_stale_guard_present,
    position(
      'lock table public.car_offers in share mode'
      in lower(coalesce(pg_get_functiondef(to_regprocedure('public.admin_reorder_car_fleet(jsonb,jsonb)')), ''))
    ) > 0 as rpc_membership_lock_present,
    position(
      'set constraints car_offer_admin_order_sort_unique deferred'
      in lower(coalesce(pg_get_functiondef(to_regprocedure('public.admin_reorder_car_fleet(jsonb,jsonb)')), ''))
    ) > 0 as rpc_atomic_reorder_present,
    position(
      'pg_advisory_xact_lock'
      in lower(coalesce(pg_get_functiondef(to_regprocedure('public.car_offer_admin_order_append_new_offer()')), ''))
    ) > 0 as append_serialization_present
), data_state as (
  select
    (select count(*) from public.car_offers) as offer_count,
    (select count(*) from public.car_offer_admin_order) as admin_order_count,
    (
      select count(*)
      from public.car_offers offer
      left join public.car_offer_admin_order order_row on order_row.offer_id = offer.id
      where order_row.offer_id is null
    ) as missing_order_count,
    (
      select count(*)
      from public.car_offer_admin_order order_row
      left join public.car_offers offer on offer.id = order_row.offer_id
      where offer.id is null
    ) as orphan_order_count,
    (
      select count(*)
      from (
        select order_row.admin_sort_order
        from public.car_offer_admin_order order_row
        group by order_row.admin_sort_order
        having count(*) > 1
      ) duplicates
    ) as duplicate_position_count,
    (
      select count(*)
      from public.car_offer_admin_order order_row
      where order_row.admin_sort_order <= 0
    ) as nonpositive_position_count,
    coalesce((select min(order_row.admin_sort_order) from public.car_offer_admin_order order_row), 0) as minimum_position,
    coalesce((select max(order_row.admin_sort_order) from public.car_offer_admin_order order_row), 0) as maximum_position
)
select
  contract.*,
  data_state.*,
  (
    contract.table_present
    and contract.reorder_rpc_present
    and contract.append_function_present
    and contract.rls_enabled
    and contract.deferrable_unique_present
    and contract.positive_check_present
    and contract.cascade_fk_present
    and contract.append_trigger_present
    and contract.updated_at_trigger_present
    and contract.admin_select_policy_present
    and contract.anon_table_denied
    and contract.authenticated_read_only_grant
    and contract.anon_rpc_denied
    and contract.authenticated_rpc_granted
    and contract.service_rpc_granted
    and contract.rpc_admin_guard_present
    and contract.rpc_stale_guard_present
    and contract.rpc_membership_lock_present
    and contract.rpc_atomic_reorder_present
    and contract.append_serialization_present
    and data_state.offer_count = data_state.admin_order_count
    and data_state.missing_order_count = 0
    and data_state.orphan_order_count = 0
    and data_state.duplicate_position_count = 0
    and data_state.nonpositive_position_count = 0
    and (
      data_state.offer_count = 0
      or (
        data_state.minimum_position = 1
        and data_state.maximum_position = data_state.offer_count
      )
    )
  ) as car_fleet_admin_order_safe
from contract
cross join data_state;
