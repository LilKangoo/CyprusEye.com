-- Hotels 2.0 H2A production preflight (READ ONLY).
-- Run immediately before 20260811200000. Returns exactly one summary row.

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
    (select count(*)::integer from public.hotel_daily_rates) as daily_rates
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
h2a_absence as (
  select
    to_regclass('public.hotel_activity_log') is null as activity_absent,
    to_regclass('public.hotel_calendar_overrides') is null as calendar_override_absent,
    to_regprocedure('public.hotel_v2_admin_get_property_list()') is null as list_rpc_absent,
    to_regprocedure('public.hotel_v2_admin_get_property_workspace(uuid)') is null as workspace_rpc_absent,
    to_regprocedure('public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid)') is null as apply_rpc_absent,
    to_regprocedure('public.hotel_v2_admin_create_property_draft(uuid,jsonb,uuid)') is null as create_rpc_absent,
    not exists (
      select 1 from pg_constraint constraint_info
      where constraint_info.conrelid = 'public.hotels'::regclass
        and constraint_info.conname = 'hotels_h2a_rooms_v2_unpublished_check'
    ) as publication_guard_absent
),
expected as (
  select array_agg(id order by id) as property_ids from expected_property_ids
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
  normalized.rate_rules as rate_rule_count,
  normalized.daily_inventory as daily_inventory_count,
  normalized.daily_rates as daily_rate_count,
  security.booking_rls_enabled,
  security.broad_authenticated_select_removed,
  security.customer_bridge_present,
  security.partner_bridge_present,
  security.partner_bridge_security_definer,
  security.partner_bridge_stable,
  security.partner_bridge_safe_search_path,
  security.partner_bridge_authenticated_execute,
  security.partner_bridge_anon_public_execute_denied,
  security.partner_bridge_service_role_execute_denied,
  security.partner_identity_helper_present,
  security.partner_admin_helper_present,
  h2a.activity_absent,
  h2a.calendar_override_absent,
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
    and flags.settings_count = 1
    and flags.flags_off_count = 1
    and normalized.room_types = 0
    and normalized.units = 0
    and normalized.rate_plans = 0
    and normalized.room_rates = 0
    and normalized.rate_rules = 0
    and normalized.daily_inventory = 0
    and normalized.daily_rates = 0
    and security.booking_rls_enabled
    and security.broad_authenticated_select_removed
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
    and h2a.activity_absent
    and h2a.calendar_override_absent
    and h2a.list_rpc_absent
    and h2a.workspace_rpc_absent
    and h2a.apply_rpc_absent
    and h2a.create_rpc_absent
    and h2a.publication_guard_absent
  ) as hotels_v2_h2a_preflight_safe
from property_state property
cross join booking_state booking
cross join fulfillment_state fulfillment
cross join flag_state flags
cross join normalized_state normalized
cross join h1a_security security
cross join h2a_absence h2a
cross join expected;
