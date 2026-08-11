-- Hotels 2.0 H2B calendar/rates preflight (READ ONLY).
-- Run immediately before 20260811230000. Returns exactly one summary row.

with
expected_properties(id) as (
  values
    ('9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),
    ('f9fbaa61-fdce-4418-8579-ddb2b0a75fb1'::uuid)
),
properties as (
  select count(*)::integer property_count,
         count(*) filter(where architecture_version='legacy')::integer legacy_count,
         count(*) filter(where architecture_version='rooms_v2')::integer rooms_v2_count,
         coalesce(array_agg(id order by id),'{}'::uuid[]) property_ids,
         md5(coalesce(string_agg((to_jsonb(hotel)-'architecture_version'-'timezone'-'currency'-'booking_mode'-'check_in_from'-'check_out_until')::text,'|' order by id),'')) protected_fingerprint
  from public.hotels hotel
),
expected as (select array_agg(id order by id) property_ids from expected_properties),
bookings as (
  select count(*)::integer booking_count,md5(coalesce(string_agg(to_jsonb(booking)::text,'|' order by id),'')) fingerprint
  from public.hotel_bookings booking
),
fulfillments as (
  select count(*)::integer fulfillment_count,md5(coalesce(string_agg(to_jsonb(fulfillment)::text,'|' order by id),'')) fingerprint
  from public.partner_service_fulfillments fulfillment where resource_type='hotels'
),
relationships as (
  select
    (select md5(coalesce(string_agg(to_jsonb(deposit_row)::text,'|' order by deposit_row.id),'')) from public.service_deposit_requests deposit_row where deposit_row.resource_type='hotels') deposit_fingerprint,
    (select md5(coalesce(string_agg(to_jsonb(coupon_row)::text,'|' order by coupon_row.id),'')) from public.service_coupon_redemptions coupon_row where coupon_row.service_type='hotels') coupon_fingerprint
),
flags as (
  select count(*)::integer settings_count,
         count(*) filter(where not hotel_rooms_v2_enabled and not hotel_external_sync_enabled
           and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled)::integer flags_off_count
  from public.site_settings
),
normalized as (
  select
    (select count(*)::integer from public.hotel_room_types) room_type_count,
    (select count(*)::integer from public.hotel_units) unit_count,
    (select count(*)::integer from public.hotel_rate_plans) rate_plan_count,
    (select count(*)::integer from public.hotel_room_rates) room_rate_count,
    (select count(*)::integer from public.hotel_rate_rules) rate_rule_count,
    (select count(*)::integer from public.hotel_daily_inventory) daily_inventory_count,
    (select count(*)::integer from public.hotel_daily_rates) daily_rate_count,
    (select count(*)::integer from public.hotel_activity_log) activity_count
),
security as (
  select
    (select relrowsecurity from pg_class where oid='public.hotel_bookings'::regclass) hotel_bookings_rls_enabled,
    not exists(
      select 1 from pg_policies policy_info
      where policy_info.schemaname='public' and policy_info.tablename='hotel_bookings'
        and policy_info.roles @> array['authenticated']::name[] and policy_info.cmd in ('SELECT','ALL')
        and replace(lower(coalesce(policy_info.qual,'')),' ','') in ('true','(true)')
    ) broad_authenticated_select_removed,
    not has_table_privilege('anon','public.hotel_bookings','SELECT') anon_booking_select_denied,
    to_regprocedure('public.customer_get_hotel_bookings(integer)') is not null customer_bridge_present,
    to_regprocedure('public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)') is not null partner_bridge_present,
    to_regprocedure('public.hotel_v2_admin_get_property_list()') is not null property_list_present,
    to_regprocedure('public.hotel_v2_admin_get_property_workspace(uuid)') is not null workspace_present,
    to_regprocedure('public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid)') is not null workspace_apply_present,
    to_regclass('public.hotel_activity_log') is not null activity_present,
    exists(select 1 from pg_proc procedure_info where procedure_info.oid=to_regprocedure('public.customer_get_hotel_bookings(integer)')
      and procedure_info.prosecdef
      and coalesce(procedure_info.proconfig,'{}'::text[]) @> array['search_path=pg_catalog, public']::text[]) customer_bridge_hardened,
    coalesce(has_function_privilege('authenticated',to_regprocedure('public.customer_get_hotel_bookings(integer)'),'EXECUTE'),false)
      and not coalesce(has_function_privilege('anon',to_regprocedure('public.customer_get_hotel_bookings(integer)'),'EXECUTE'),false)
      and not coalesce(has_function_privilege('service_role',to_regprocedure('public.customer_get_hotel_bookings(integer)'),'EXECUTE'),false)
      customer_bridge_grants_exact,
    exists(select 1 from pg_proc procedure_info where procedure_info.oid=to_regprocedure('public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)')
      and procedure_info.prosecdef and procedure_info.provolatile='s'
      and coalesce(procedure_info.proconfig,'{}'::text[]) @> array['search_path=pg_catalog, public']::text[]) partner_bridge_hardened,
    coalesce(has_function_privilege('authenticated',to_regprocedure('public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)'),'EXECUTE'),false)
      and not coalesce(has_function_privilege('anon',to_regprocedure('public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)'),'EXECUTE'),false)
      and not coalesce(has_function_privilege('service_role',to_regprocedure('public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)'),'EXECUTE'),false)
      partner_bridge_grants_exact
),
h2a_admin_rpc_security as (
  select
    count(*)=4 rpc_count,
    count(*) filter(where procedure_info.prosecdef
      and coalesce(procedure_info.proconfig,'{}'::text[]) @> array['search_path=pg_catalog, public, auth']::text[])=4 hardened_count,
    count(*) filter(where has_function_privilege('authenticated',procedure_info.oid,'EXECUTE')
      and not has_function_privilege('anon',procedure_info.oid,'EXECUTE')
      and not has_function_privilege('service_role',procedure_info.oid,'EXECUTE'))=4 exact_grants
  from pg_proc procedure_info join pg_namespace namespace_info on namespace_info.oid=procedure_info.pronamespace
  where namespace_info.nspname='public' and procedure_info.proname in (
    'hotel_v2_admin_get_property_list','hotel_v2_admin_get_property_workspace',
    'hotel_v2_admin_apply_workspace_plan','hotel_v2_admin_create_property_draft'
  )
),
h2b_absence as (
  select
    to_regclass('public.hotel_calendar_overrides') is null calendar_overrides_absent,
    to_regclass('public.hotel_room_rate_occupancy_tiers') is null occupancy_tiers_absent,
    to_regprocedure('public.hotel_v2_admin_resolve_rate(uuid,date,date,integer)') is null resolver_absent,
    to_regprocedure('public.hotel_v2_admin_get_calendar(uuid,date,date)') is null calendar_rpc_absent,
    to_regprocedure('public.hotel_v2_admin_apply_calendar_plan(jsonb,uuid)') is null calendar_apply_absent,
    to_regprocedure('public.hotel_v2_h2b_validate_occupancy_tier_contract()') is null occupancy_guard_function_absent,
    to_regprocedure('public.hotel_v2_h2b_guard_room_capacity_against_tiers()') is null capacity_guard_function_absent,
    not exists(select 1 from pg_trigger where tgname in (
      'hotel_room_rate_occupancy_tiers_capacity_guard','hotel_room_types_occupancy_tier_capacity_guard'
    ) and not tgisinternal) capacity_guard_triggers_absent,
    not exists(select 1 from information_schema.columns where table_schema='public' and table_name='hotel_daily_inventory'
      and column_name in ('source','reason','expires_at','actor_id','sellable_units_mode','closed_mode')) inventory_metadata_absent,
    not exists(select 1 from information_schema.columns where table_schema='public' and table_name='hotel_rate_rules'
      and column_name in ('source','source_timestamp','provenance')) rule_metadata_absent,
    not exists(select 1 from information_schema.columns where table_schema='public' and table_name='hotel_daily_rates' and column_name='source') daily_rate_source_absent,
    not exists(select 1 from pg_constraint where conrelid='public.hotel_room_rates'::regclass and conname='hotel_room_rates_id_hotel_id_key') composite_key_absent,
    not exists(select 1 from pg_constraint where conrelid='public.hotel_rate_rules'::regclass and conname='hotel_rate_rules_weekdays_unique_check') weekday_guard_absent
)
select
  properties.property_count,
  properties.legacy_count,
  properties.rooms_v2_count,
  properties.property_ids,
  properties.protected_fingerprint as protected_property_fingerprint,
  bookings.booking_count,bookings.fingerprint as booking_fingerprint,
  fulfillments.fulfillment_count,fulfillments.fingerprint as fulfillment_fingerprint,
  relationships.deposit_fingerprint,relationships.coupon_fingerprint,
  flags.flags_off_count,
  normalized.room_type_count,
  normalized.unit_count,
  normalized.rate_plan_count,
  normalized.room_rate_count,
  normalized.rate_rule_count,
  normalized.daily_inventory_count,
  normalized.daily_rate_count,
  normalized.activity_count,
  security.hotel_bookings_rls_enabled,
  security.broad_authenticated_select_removed,
  security.customer_bridge_present,
  security.partner_bridge_present,
  security.customer_bridge_hardened,security.customer_bridge_grants_exact,
  security.partner_bridge_hardened,security.partner_bridge_grants_exact,
  h2a_rpc.rpc_count as h2a_admin_rpc_count,h2a_rpc.hardened_count as h2a_admin_rpcs_hardened,
  h2a_rpc.exact_grants as h2a_admin_rpc_grants_exact,
  h2b.calendar_overrides_absent,
  h2b.occupancy_tiers_absent,
  (
    properties.property_count=2
    and properties.legacy_count=2
    and properties.rooms_v2_count=0
    and properties.property_ids=expected.property_ids
    and properties.protected_fingerprint='b3e3a9c5bda72a83e49d3095d175ab9c'
    and bookings.booking_count=3 and bookings.fingerprint='fb5a4c508b0df32afbffe5b1594c7a50'
    and fulfillments.fulfillment_count=5 and fulfillments.fingerprint='1e01541853d87d26adccb8172074934b'
    and relationships.deposit_fingerprint='42b5e1dc9726890e90014c3e89c2329d'
    and relationships.coupon_fingerprint='d41d8cd98f00b204e9800998ecf8427e'
    and flags.settings_count=1 and flags.flags_off_count=1
    and security.hotel_bookings_rls_enabled
    and security.broad_authenticated_select_removed
    and security.anon_booking_select_denied
    and security.customer_bridge_present and security.partner_bridge_present
    and security.customer_bridge_hardened and security.customer_bridge_grants_exact
    and security.partner_bridge_hardened and security.partner_bridge_grants_exact
    and security.property_list_present and security.workspace_present
    and security.workspace_apply_present and security.activity_present
    and h2a_rpc.rpc_count and h2a_rpc.hardened_count and h2a_rpc.exact_grants
    and h2b.calendar_overrides_absent and h2b.occupancy_tiers_absent
    and h2b.resolver_absent and h2b.calendar_rpc_absent and h2b.calendar_apply_absent
    and h2b.occupancy_guard_function_absent and h2b.capacity_guard_function_absent
    and h2b.capacity_guard_triggers_absent
    and h2b.inventory_metadata_absent and h2b.rule_metadata_absent
    and h2b.daily_rate_source_absent and h2b.composite_key_absent and h2b.weekday_guard_absent
  ) hotels_v2_h2b_preflight_safe
from properties cross join expected cross join bookings cross join fulfillments cross join relationships
cross join flags cross join normalized cross join security
cross join h2a_admin_rpc_security h2a_rpc cross join h2b_absence h2b;
