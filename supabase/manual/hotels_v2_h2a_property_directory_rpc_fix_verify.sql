-- Hotels 2.0 H2A property-directory RPC hotfix verification (READ ONLY).
-- Run after 20260811210000_hotels_v2_h2a_property_directory_rpc_fix.sql.

with
expected_property_ids(id) as (
  values
    ('9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),
    ('f9fbaa61-fdce-4418-8579-ddb2b0a75fb1'::uuid)
),
partner_resources_columns as (
  select
    coalesce(array_agg(column_name::text order by ordinal_position), '{}'::text[]) as actual_columns,
    count(*) filter (
      where column_name = 'id'
        and data_type = 'uuid'
        and is_nullable = 'NO'
    ) = 1 as id_contract,
    count(*) filter (
      where column_name = 'partner_id'
        and data_type = 'uuid'
        and is_nullable = 'NO'
    ) = 1 as partner_id_contract,
    count(*) filter (
      where column_name = 'resource_type'
        and data_type = 'text'
        and is_nullable = 'NO'
    ) = 1 as resource_type_contract,
    count(*) filter (
      where column_name = 'resource_id'
        and data_type = 'uuid'
        and is_nullable = 'NO'
    ) = 1 as resource_id_contract,
    count(*) filter (
      where column_name = 'created_at'
        and data_type = 'timestamp with time zone'
        and is_nullable = 'YES'
    ) = 1 as created_at_contract
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'partner_resources'
),
partner_resources_contract as (
  select
    columns.actual_columns = array[
      'id', 'partner_id', 'resource_type', 'resource_id', 'created_at'
    ]::text[]
      and columns.id_contract
      and columns.partner_id_contract
      and columns.resource_type_contract
      and columns.resource_id_contract
      and columns.created_at_contract
      and exists (
        select 1
        from pg_class relation
        where relation.oid = 'public.partner_resources'::regclass
          and relation.relrowsecurity
      ) as valid
  from partner_resources_columns columns
),
function_state as (
  select
    procedure_info.oid,
    procedure_info.proname,
    procedure_info.prosecdef,
    procedure_info.provolatile,
    procedure_info.proconfig,
    pg_get_functiondef(procedure_info.oid) as definition
  from pg_proc procedure_info
  join pg_namespace namespace_info
    on namespace_info.oid = procedure_info.pronamespace
  where namespace_info.nspname = 'public'
    and procedure_info.oid in (
      to_regprocedure('public.hotel_v2_h2a_readiness(uuid)'),
      to_regprocedure('public.hotel_v2_admin_get_property_list()'),
      to_regprocedure('public.hotel_v2_admin_get_property_workspace(uuid)')
    )
),
function_contract as (
  select
    count(*) = 3 as exact_function_count,
    count(*) filter (
      where position('assignment.is_active' in definition) = 0
    ) = 3 as invalid_reference_removed,
    count(*) filter (
      where proname = 'hotel_v2_admin_get_property_workspace'
        and position('''is_active'', true' in definition) > 0
    ) = 1 as derived_assignment_activity,
    count(*) filter (
      where proname = 'hotel_v2_h2a_readiness'
        and prosecdef
        and provolatile = 's'
        and 'search_path=pg_catalog, public' = any(coalesce(proconfig, '{}'::text[]))
        and not has_function_privilege('authenticated', oid, 'EXECUTE')
        and not has_function_privilege('anon', oid, 'EXECUTE')
        and not has_function_privilege('service_role', oid, 'EXECUTE')
    ) = 1 as readiness_security,
    count(*) filter (
      where proname in (
          'hotel_v2_admin_get_property_list',
          'hotel_v2_admin_get_property_workspace'
        )
        and prosecdef
        and provolatile = 's'
        and 'search_path=pg_catalog, public, auth' = any(coalesce(proconfig, '{}'::text[]))
        and has_function_privilege('authenticated', oid, 'EXECUTE')
        and not has_function_privilege('anon', oid, 'EXECUTE')
        and not has_function_privilege('service_role', oid, 'EXECUTE')
    ) = 2 as admin_reader_security
  from function_state
),
property_state as (
  select
    count(*)::integer as property_count,
    count(*) filter (where hotel.is_published)::integer as published_count,
    count(*) filter (where hotel.architecture_version = 'legacy')::integer as legacy_count,
    count(*) filter (where hotel.architecture_version = 'rooms_v2')::integer as rooms_v2_count,
    coalesce(array_agg(hotel.id order by hotel.id), '{}'::uuid[]) as actual_ids,
    count(readiness.value)::integer as readiness_probe_count
  from public.hotels hotel
  cross join lateral (
    select public.hotel_v2_h2a_readiness(hotel.id) as value
  ) readiness
),
flag_state as (
  select
    count(*) = 1
      and count(*) filter (
        where id = 1
          and not hotel_rooms_v2_enabled
          and not hotel_external_sync_enabled
          and not hotel_instant_booking_enabled
          and not hotel_stripe_connect_enabled
      ) = 1 as all_off
  from public.site_settings
),
normalized_state as (
  select
    (select count(*) from public.hotel_room_types) as room_types,
    (select count(*) from public.hotel_units) as units,
    (select count(*) from public.hotel_rate_plans) as rate_plans,
    (select count(*) from public.hotel_room_rates) as room_rates,
    (select count(*) from public.hotel_rate_rules) as rate_rules,
    (select count(*) from public.hotel_daily_inventory) as daily_inventory,
    (select count(*) from public.hotel_daily_rates) as daily_rates
),
h1a_security as (
  select
    exists (
      select 1
      from pg_class relation
      where relation.oid = 'public.hotel_bookings'::regclass
        and relation.relrowsecurity
    ) as booking_rls_enabled,
    not exists (
      select 1
      from pg_policies policy_info
      where policy_info.schemaname = 'public'
        and policy_info.tablename = 'hotel_bookings'
        and policy_info.roles @> array['authenticated']::name[]
        and policy_info.cmd in ('SELECT', 'ALL')
        and replace(lower(coalesce(policy_info.qual, '')), ' ', '') in ('true', '(true)')
    ) as broad_authenticated_select_removed,
    not has_table_privilege('anon', 'public.hotel_bookings', 'SELECT') as anon_select_denied,
    to_regprocedure('public.customer_get_hotel_bookings(integer)') is not null
      as customer_bridge_present,
    to_regprocedure(
      'public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)'
    ) is not null as partner_bridge_present
),
summary as (
  select
    columns.actual_columns as partner_resources_actual_columns,
    partner_contract.valid as partner_resources_contract,
    functions.exact_function_count,
    functions.invalid_reference_removed,
    functions.derived_assignment_activity,
    functions.readiness_security,
    functions.admin_reader_security,
    properties.property_count,
    properties.published_count,
    properties.legacy_count,
    properties.rooms_v2_count,
    properties.actual_ids,
    properties.readiness_probe_count,
    flags.all_off as all_hotels_v2_flags_off,
    normalized.room_types,
    normalized.units,
    normalized.rate_plans,
    normalized.room_rates,
    normalized.rate_rules,
    normalized.daily_inventory,
    normalized.daily_rates,
    security.booking_rls_enabled,
    security.broad_authenticated_select_removed,
    security.anon_select_denied,
    security.customer_bridge_present,
    security.partner_bridge_present,
    properties.property_count = 2
      and properties.published_count = 1
      and properties.legacy_count = 2
      and properties.rooms_v2_count = 0
      and properties.actual_ids = (
        select array_agg(id order by id) from expected_property_ids
      )
      and properties.readiness_probe_count = 2 as exact_property_contract,
    normalized.room_types = 0
      and normalized.units = 0
      and normalized.rate_plans = 0
      and normalized.room_rates = 0
      and normalized.rate_rules = 0
      and normalized.daily_inventory = 0
      and normalized.daily_rates = 0 as normalized_tables_still_empty
  from partner_resources_columns columns
  cross join partner_resources_contract partner_contract
  cross join function_contract functions
  cross join property_state properties
  cross join flag_state flags
  cross join normalized_state normalized
  cross join h1a_security security
)
select
  summary.*,
  summary.partner_resources_contract
    and summary.exact_function_count
    and summary.invalid_reference_removed
    and summary.derived_assignment_activity
    and summary.readiness_security
    and summary.admin_reader_security
    and summary.exact_property_contract
    and summary.all_hotels_v2_flags_off
    and summary.normalized_tables_still_empty
    and summary.booking_rls_enabled
    and summary.broad_authenticated_select_removed
    and summary.anon_select_denied
    and summary.customer_bridge_present
    and summary.partner_bridge_present
    as hotels_v2_h2a_property_directory_rpc_fix_safe
from summary;
