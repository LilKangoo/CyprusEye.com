-- Hotels 2.0 H2A foundation verification (READ ONLY).
-- Run immediately after 20260811200000 and before any H2A Admin writes.

with
expected_property_ids(id) as (
  values
    ('9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),
    ('f9fbaa61-fdce-4418-8579-ddb2b0a75fb1'::uuid)
),
property_state as (
  select
    count(*)::integer as property_count,
    count(*) filter (where architecture_version = 'legacy')::integer as legacy_count,
    count(*) filter (where architecture_version = 'rooms_v2')::integer as rooms_v2_count,
    coalesce(array_agg(id order by id), '{}'::uuid[]) as property_ids,
    md5(coalesce(string_agg(
      (
        to_jsonb(hotel)
        - 'architecture_version'
        - 'timezone'
        - 'currency'
        - 'booking_mode'
        - 'check_in_from'
        - 'check_out_until'
      )::text,
      '|' order by id
    ), '')) as protected_fingerprint
  from public.hotels hotel
),
booking_state as (
  select
    count(*)::integer as booking_count,
    md5(coalesce(string_agg(to_jsonb(booking)::text, '|' order by id), '')) as fingerprint
  from public.hotel_bookings booking
),
fulfillment_state as (
  select
    count(*)::integer as fulfillment_count,
    md5(coalesce(string_agg(to_jsonb(fulfillment)::text, '|' order by id), '')) as fingerprint
  from public.partner_service_fulfillments fulfillment
  where resource_type = 'hotels'
),
relationship_state as (
  select
    (select md5(coalesce(string_agg(to_jsonb(deposit_row)::text, '|' order by deposit_row.id), ''))
     from public.service_deposit_requests deposit_row where deposit_row.resource_type = 'hotels') as deposit_fingerprint,
    (select md5(coalesce(string_agg(to_jsonb(coupon_row)::text, '|' order by coupon_row.id), ''))
     from public.service_coupon_redemptions coupon_row where coupon_row.service_type = 'hotels') as coupon_fingerprint
),
flag_state as (
  select
    count(*)::integer as settings_count,
    count(*) filter (
      where not hotel_rooms_v2_enabled
        and not hotel_external_sync_enabled
        and not hotel_instant_booking_enabled
        and not hotel_stripe_connect_enabled
    )::integer as flags_off_count
  from public.site_settings
),
normalized_state as (
  select
    (select count(*)::integer from public.hotel_room_types) as room_types,
    (select count(*)::integer from public.hotel_units) as units,
    (select count(*)::integer from public.hotel_rate_plans) as rate_plans,
    (select count(*)::integer from public.hotel_room_rates) as room_rates,
    (select count(*)::integer from public.hotel_rate_rules) as rate_rules,
    (select count(*)::integer from public.hotel_daily_inventory) as daily_inventory,
    (select count(*)::integer from public.hotel_daily_rates) as daily_rates,
    (select count(*)::integer from public.hotel_activity_log) as activity_rows
),
normalized_write_security as (
  select
    count(*) filter (
      where has_table_privilege('authenticated', format('public.%I', table_name), 'SELECT')
        and not has_table_privilege('authenticated', format('public.%I', table_name), 'INSERT')
        and not has_table_privilege('authenticated', format('public.%I', table_name), 'UPDATE')
        and not has_table_privilege('authenticated', format('public.%I', table_name), 'DELETE')
    )::integer as rpc_only_write_count
  from unnest(array[
    'hotel_room_types', 'hotel_units', 'hotel_rate_plans', 'hotel_room_rates',
    'hotel_rate_rules', 'hotel_daily_inventory', 'hotel_daily_rates'
  ]::text[]) table_name
),
activity_contract as (
  select
    exists (
      select 1 from pg_class relation
      where relation.oid = 'public.hotel_activity_log'::regclass
        and relation.relrowsecurity
    ) as rls_enabled,
    (
      select count(*) = 1
      from pg_policies policy_info
      where policy_info.schemaname = 'public'
        and policy_info.tablename = 'hotel_activity_log'
        and policy_info.policyname = 'hotel_activity_log_admin_select'
        and policy_info.cmd = 'SELECT'
        and policy_info.roles = array['authenticated']::name[]
        and lower(coalesce(policy_info.qual, '')) like '%is_current_user_admin%'
    ) as exact_policy,
    not has_table_privilege('anon', 'public.hotel_activity_log', 'SELECT')
      and has_table_privilege('authenticated', 'public.hotel_activity_log', 'SELECT')
      and not has_table_privilege('authenticated', 'public.hotel_activity_log', 'INSERT')
      and not has_table_privilege('authenticated', 'public.hotel_activity_log', 'UPDATE')
      and not has_table_privilege('authenticated', 'public.hotel_activity_log', 'DELETE')
      and has_table_privilege('service_role', 'public.hotel_activity_log', 'SELECT')
      and has_table_privilege('service_role', 'public.hotel_activity_log', 'INSERT')
      and not has_table_privilege('service_role', 'public.hotel_activity_log', 'UPDATE')
      and not has_table_privilege('service_role', 'public.hotel_activity_log', 'DELETE') as grant_contract,
    (
      select count(*) = 12
      from information_schema.columns
      where table_schema = 'public' and table_name = 'hotel_activity_log'
    ) as column_contract,
    (
      select count(*) = 3
      from pg_indexes index_info
      where index_info.schemaname = 'public'
        and index_info.tablename = 'hotel_activity_log'
        and index_info.indexname in (
          'hotel_activity_log_hotel_created_idx',
          'hotel_activity_log_entity_idx',
          'hotel_activity_log_correlation_idx'
        )
    ) as index_contract
),
constraint_contract as (
  select count(*) = 5 as all_constraints_present
  from pg_constraint constraint_info
  where constraint_info.conrelid in (
      'public.hotels'::regclass,
      'public.hotel_room_types'::regclass,
      'public.hotel_rate_plans'::regclass
    )
    and constraint_info.conname in (
      'hotel_room_types_h2a_name_i18n_check',
      'hotel_room_types_h2a_bed_configuration_check',
      'hotel_rate_plans_h2a_name_i18n_check',
      'hotel_rate_plans_h2a_cancellation_policy_check',
      'hotels_h2a_rooms_v2_unpublished_check'
    )
    and constraint_info.convalidated
),
rpc_contract as (
  select
    count(*) = 4 as rpc_count,
    count(*) filter (
      where procedure_info.prosecdef
        and exists (
          select 1 from unnest(coalesce(procedure_info.proconfig, '{}'::text[])) config
          where config = 'search_path=pg_catalog, public, auth'
        )
    ) = 4 as security_definer_search_path,
    count(*) filter (
      where has_function_privilege(
        'authenticated',
        procedure_info.oid,
        'EXECUTE'
      )
      and not has_function_privilege('anon', procedure_info.oid, 'EXECUTE')
      and not has_function_privilege('service_role', procedure_info.oid, 'EXECUTE')
    ) = 4 as exact_grants,
    bool_and(
      case
        when procedure_info.proname = 'hotel_v2_admin_apply_workspace_plan' then
          pg_get_functiondef(procedure_info.oid) like '%Complete stale/shape/dependency preflight%'
          and pg_get_functiondef(procedure_info.oid) like '%hotels_v2_h2a_stale_during_apply%'
          and pg_get_functiondef(procedure_info.oid) like '%hotel_activity_log%'
        else true
      end
    ) as transaction_source_contract
  from pg_proc procedure_info
  join pg_namespace namespace_info on namespace_info.oid = procedure_info.pronamespace
  where namespace_info.nspname = 'public'
    and procedure_info.proname in (
      'hotel_v2_admin_get_property_list',
      'hotel_v2_admin_get_property_workspace',
      'hotel_v2_admin_apply_workspace_plan',
      'hotel_v2_admin_create_property_draft'
    )
),
h1a_security as (
  select
    exists (
      select 1 from pg_class relation
      where relation.oid = 'public.hotel_bookings'::regclass and relation.relrowsecurity
    ) as booking_rls_enabled,
    not exists (
      select 1 from pg_policies policy_info
      where policy_info.schemaname = 'public'
        and policy_info.tablename = 'hotel_bookings'
        and policy_info.roles @> array['authenticated']::name[]
        and policy_info.cmd in ('SELECT', 'ALL')
        and replace(lower(coalesce(policy_info.qual, '')), ' ', '') in ('true','(true)')
    ) as broad_authenticated_select_removed,
    not has_table_privilege('anon', 'public.hotel_bookings', 'SELECT') as anon_select_denied,
    to_regprocedure('public.customer_get_hotel_bookings(integer)') is not null as customer_bridge_present,
    to_regprocedure('public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)') is not null as partner_bridge_present,
    exists (
      select 1
      from pg_catalog.pg_proc procedure_info
      where procedure_info.oid = to_regprocedure(
        'public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)'
      )
        and procedure_info.prosecdef
    ) as partner_bridge_security_definer,
    exists (
      select 1
      from pg_catalog.pg_proc procedure_info
      where procedure_info.oid = to_regprocedure(
        'public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)'
      )
        and procedure_info.provolatile = 's'
    ) as partner_bridge_stable,
    exists (
      select 1
      from pg_catalog.pg_proc procedure_info
      where procedure_info.oid = to_regprocedure(
        'public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)'
      )
        and coalesce(procedure_info.proconfig, '{}'::text[])
          @> array['search_path=pg_catalog, public']::text[]
    ) as partner_bridge_safe_search_path,
    coalesce(has_function_privilege(
      'authenticated',
      to_regprocedure('public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)'),
      'EXECUTE'
    ), false) as partner_bridge_authenticated_execute,
    not coalesce(has_function_privilege(
      'anon',
      to_regprocedure('public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)'),
      'EXECUTE'
    ), false) as partner_bridge_anon_public_execute_denied,
    not coalesce(has_function_privilege(
      'service_role',
      to_regprocedure('public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)'),
      'EXECUTE'
    ), false) as partner_bridge_service_role_execute_denied,
    to_regprocedure('public.is_partner_user(uuid)') is not null as partner_identity_helper_present,
    to_regprocedure('public.is_current_user_admin()') is not null as partner_admin_helper_present
),
deferred_contract as (
  select
    to_regclass('public.hotel_calendar_overrides') is null as calendar_overrides_deferred,
    to_regclass('public.hotel_sync_sources') is null as sync_sources_deferred
),
expected as (
  select array_agg(id order by id) as property_ids from expected_property_ids
),
oracle as (
  select
    case when property.protected_fingerprint = 'b3e3a9c5bda72a83e49d3095d175ab9c' then 0 else 1 end
      as hotel_legacy_price_mismatch,
    case when property.protected_fingerprint = 'b3e3a9c5bda72a83e49d3095d175ab9c' then 0 else 1 end
      as hotel_legacy_public_mismatch,
    case when booking.fingerprint = 'fb5a4c508b0df32afbffe5b1594c7a50'
           and fulfillment.fingerprint = '1e01541853d87d26adccb8172074934b'
           and relationships.deposit_fingerprint = '42b5e1dc9726890e90014c3e89c2329d'
           and relationships.coupon_fingerprint = 'd41d8cd98f00b204e9800998ecf8427e'
      then 0 else 1 end as hotel_booking_payload_unexplained_difference
  from property_state property
  cross join booking_state booking
  cross join fulfillment_state fulfillment
  cross join relationship_state relationships
)
select
  property.property_count,
  property.legacy_count,
  property.rooms_v2_count,
  property.property_ids,
  property.protected_fingerprint as protected_property_fingerprint,
  booking.booking_count,
  booking.fingerprint as booking_fingerprint,
  fulfillment.fulfillment_count,
  fulfillment.fingerprint as fulfillment_fingerprint,
  flags.flags_off_count,
  normalized.room_types as room_type_count,
  normalized.units as unit_count,
  normalized.rate_plans as rate_plan_count,
  normalized.room_rates as room_rate_count,
  normalized.activity_rows as activity_row_count,
  normalized_security.rpc_only_write_count,
  activity.rls_enabled as activity_rls_enabled,
  activity.exact_policy as activity_policy_exact,
  activity.grant_contract as activity_grants_exact,
  rpc.rpc_count as admin_rpcs_present,
  rpc.security_definer_search_path as admin_rpcs_hardened,
  rpc.exact_grants as admin_rpc_grants_exact,
  security.broad_authenticated_select_removed,
  security.partner_bridge_present,
  security.partner_bridge_security_definer,
  security.partner_bridge_stable,
  security.partner_bridge_safe_search_path,
  security.partner_bridge_authenticated_execute,
  security.partner_bridge_anon_public_execute_denied,
  security.partner_bridge_service_role_execute_denied,
  security.partner_identity_helper_present,
  security.partner_admin_helper_present,
  deferred.calendar_overrides_deferred,
  oracle.hotel_legacy_price_mismatch as "HOTEL_LEGACY_PRICE_MISMATCH",
  oracle.hotel_legacy_public_mismatch as "HOTEL_LEGACY_PUBLIC_MISMATCH",
  oracle.hotel_booking_payload_unexplained_difference as "HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE",
  (
    property.property_count = 2
    and property.legacy_count = 2
    and property.rooms_v2_count = 0
    and property.property_ids = expected.property_ids
    and property.protected_fingerprint = 'b3e3a9c5bda72a83e49d3095d175ab9c'
    and booking.booking_count = 3
    and booking.fingerprint = 'fb5a4c508b0df32afbffe5b1594c7a50'
    and fulfillment.fulfillment_count = 5
    and fulfillment.fingerprint = '1e01541853d87d26adccb8172074934b'
    and relationships.deposit_fingerprint = '42b5e1dc9726890e90014c3e89c2329d'
    and relationships.coupon_fingerprint = 'd41d8cd98f00b204e9800998ecf8427e'
    and flags.settings_count = 1
    and flags.flags_off_count = 1
    and normalized.room_types = 0
    and normalized.units = 0
    and normalized.rate_plans = 0
    and normalized.room_rates = 0
    and normalized.rate_rules = 0
    and normalized.daily_inventory = 0
    and normalized.daily_rates = 0
    and normalized.activity_rows = 0
    and normalized_security.rpc_only_write_count = 7
    and activity.rls_enabled
    and activity.exact_policy
    and activity.grant_contract
    and activity.column_contract
    and activity.index_contract
    and constraints.all_constraints_present
    and rpc.rpc_count
    and rpc.security_definer_search_path
    and rpc.exact_grants
    and rpc.transaction_source_contract
    and security.booking_rls_enabled
    and security.broad_authenticated_select_removed
    and security.anon_select_denied
    and security.customer_bridge_present
    and security.partner_bridge_present
    and security.partner_bridge_security_definer
    and security.partner_bridge_stable
    and security.partner_bridge_safe_search_path
    and security.partner_bridge_authenticated_execute
    and security.partner_bridge_anon_public_execute_denied
    and security.partner_bridge_service_role_execute_denied
    and security.partner_identity_helper_present
    and security.partner_admin_helper_present
    and deferred.calendar_overrides_deferred
    and deferred.sync_sources_deferred
    and oracle.hotel_legacy_price_mismatch = 0
    and oracle.hotel_legacy_public_mismatch = 0
    and oracle.hotel_booking_payload_unexplained_difference = 0
  ) as hotels_v2_h2a_foundation_safe
from property_state property
cross join booking_state booking
cross join fulfillment_state fulfillment
cross join relationship_state relationships
cross join flag_state flags
cross join normalized_state normalized
cross join normalized_write_security normalized_security
cross join activity_contract activity
cross join constraint_contract constraints
cross join rpc_contract rpc
cross join h1a_security security
cross join deferred_contract deferred
cross join expected
cross join oracle;
