-- Hotels V2 H3.1 inert Admin configuration verification (READ ONLY).
-- Run immediately after 20260811290000_hotels_v2_h3_1_inert_admin_configuration.sql
-- and before any reviewed H3.1 Admin configuration write.

with
constants as (
  select
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid seven_arches_id,
    'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1'::uuid rgb_id,
    'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid upper_id,
    '825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid ground_id,
    '22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid rate_plan_id,
    'b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid room_schedule_id,
    '443065c0-984a-5de3-a22a-d03042c41107'::uuid party_schedule_id
),
properties as (
  select count(*)::integer property_count,
    count(*) filter(where architecture_version='legacy')::integer legacy_count,
    count(*) filter(where architecture_version='rooms_v2')::integer rooms_v2_count,
    array_agg(id order by id) property_ids,
    count(*) filter(where minimum_stay_nights is null)::integer unset_minimum_stay_count
  from public.hotels
),
flags as (
  select count(*)::integer settings_count,
    count(*) filter(where id=1 and not hotel_rooms_v2_enabled
      and not hotel_external_sync_enabled and not hotel_instant_booking_enabled
      and not hotel_stripe_connect_enabled)::integer flags_off_count
  from public.site_settings
),
seven_arches as (
  select count(*)::integer property_count,
    count(*) filter(where architecture_version='legacy' and children_policy='minimum_age'
      and minimum_child_age=15 and jsonb_array_length(photos)=9
      and jsonb_array_length(pricing_tiers->'rules')=63)::integer exact_property_count,
    max(md5(pricing_tiers::text)) pricing_fingerprint
  from public.hotels hotel cross join constants where hotel.id=constants.seven_arches_id
),
rooms as (
  select count(*)::integer room_count,
    count(*) filter(where room.id=constants.upper_id and room.status='active'
      and room.base_inventory_count=1 and room.max_occupancy=4
      and room.children_policy_override is null and room.minimum_child_age_override is null
      and room.amenities=array['air_conditioning','balcony','terrace']::text[]
      and jsonb_array_length(room.gallery)>0)::integer upper_exact_count,
    count(*) filter(where room.id=constants.ground_id and room.status='active'
      and room.base_inventory_count=1 and room.max_occupancy=4
      and room.children_policy_override is null and room.minimum_child_age_override is null
      and room.amenities=array['air_conditioning','terrace']::text[]
      and jsonb_array_length(room.gallery)>0)::integer ground_exact_count,
    count(*) filter(where exists(
      select 1 from jsonb_array_elements(room.gallery) room_photo
      where not exists(select 1 from public.hotels property
        cross join lateral jsonb_array_elements(property.photos) property_photo
        where property.id=room.hotel_id and property_photo.value=room_photo.value)
    ))::integer foreign_gallery_count
  from public.hotel_room_types room cross join constants
  where room.hotel_id=constants.seven_arches_id
),
shadow_graph as (
  select
    (select count(*) from public.hotel_rate_plans plan cross join constants
      where plan.hotel_id=constants.seven_arches_id and plan.id=constants.rate_plan_id
        and not plan.is_active and plan.cancellation_policy='{"type":"non_refundable"}'::jsonb
        and plan.price_inclusions='{}'::text[])::integer rate_plan_count,
    (select count(*) from public.hotel_room_rates rate cross join constants
      where rate.hotel_id=constants.seven_arches_id and not rate.is_active)::integer inactive_room_rate_count,
    (select count(*) from public.hotel_pricing_schedules schedule cross join constants
      where schedule.hotel_id=constants.seven_arches_id
        and schedule.id in (constants.room_schedule_id,constants.party_schedule_id)
        and not schedule.is_active and schedule.minimum_billable_occupancy=1)::integer inert_schedule_count,
    (select count(*) from public.hotel_pricing_schedule_occupancy_tiers tier cross join constants
      where tier.schedule_id=constants.room_schedule_id)::integer room_tier_count,
    (select count(*) from public.hotel_pricing_schedule_occupancy_tiers tier cross join constants
      where tier.schedule_id=constants.party_schedule_id)::integer party_tier_count,
    (select count(*) from public.hotel_pricing_schedules schedule cross join constants cross join seven_arches
      where schedule.id in (constants.room_schedule_id,constants.party_schedule_id)
        and schedule.source_reference->>'pricing_fingerprint'=seven_arches.pricing_fingerprint)::integer schedule_fingerprint_count
),
new_rows as (
  select
    (select count(*)::integer from public.hotel_room_allocation_rules) allocation_rule_count,
    (select count(*)::integer from public.hotel_room_allocation_rule_items) allocation_item_count,
    (select count(*)::integer from public.hotel_payment_policies) payment_policy_count,
    (select count(*)::integer from public.hotel_payment_policy_terms) payment_term_count,
    (select count(*)::integer from public.hotel_commission_policies) commission_policy_count,
    (select count(*)::integer from public.hotel_calendar_source_configs) calendar_source_count
),
calendar_state as (
  select
    (select count(*)::integer
      from public.hotel_daily_inventory inventory
      join public.hotel_room_types room on room.id=inventory.room_type_id
      cross join constants where room.hotel_id=constants.seven_arches_id) daily_inventory_count,
    (select count(*)::integer
      from public.hotel_daily_rates daily_rate
      join public.hotel_room_rates room_rate on room_rate.id=daily_rate.room_rate_id
      cross join constants where room_rate.hotel_id=constants.seven_arches_id) daily_rate_count,
    (select count(*)::integer
      from public.hotel_rate_rules rule_row
      join public.hotel_room_rates room_rate on room_rate.id=rule_row.room_rate_id
      cross join constants where room_rate.hotel_id=constants.seven_arches_id) rate_rule_count,
    (select count(*)::integer from public.hotel_calendar_overrides override_row
      cross join constants where override_row.hotel_id=constants.seven_arches_id) override_count
),
columns as (
  select
    exists(select 1 from information_schema.columns where table_schema='public' and table_name='hotels'
      and column_name='minimum_stay_nights' and data_type='integer' and is_nullable='YES') property_minimum_stay_exact,
    exists(select 1 from information_schema.columns where table_schema='public'
      and table_name='hotel_pricing_schedules' and column_name='minimum_billable_occupancy'
      and data_type='smallint' and is_nullable='NO'
      and regexp_replace(column_default,'::[a-z ]+$','','g')='1') minimum_billable_exact,
    exists(select 1 from information_schema.columns where table_schema='public'
      and table_name='hotel_rate_plans' and column_name='price_inclusions'
      and data_type='ARRAY' and is_nullable='NO') inclusions_exact
),
constraints_and_indexes as (
  select
    exists(select 1 from pg_constraint where conname='hotel_room_allocation_rules_mode_check'
      and pg_get_constraintdef(oid) like '%customer_choice%'
      and pg_get_constraintdef(oid) like '%required_bundle%') allocation_modes_exact,
    exists(select 1 from pg_constraint where conname='hotel_payment_policy_terms_due_event_check'
      and pg_get_constraintdef(oid) like '%at_booking%'
      and pg_get_constraintdef(oid) like '%after_partner_acceptance%'
      and pg_get_constraintdef(oid) like '%on_arrival%') payment_events_exact,
    exists(select 1 from pg_constraint where conname='hotel_commission_policies_mode_check'
      and pg_get_constraintdef(oid) like '%per_allocated_room_per_night%'
      and pg_get_constraintdef(oid) like '%percent_booking_total%') commission_mode_exact,
    exists(select 1 from pg_constraint where conname='hotel_calendar_source_configs_source_check'
      and pg_get_constraintdef(oid) like '%booking_com%'
      and pg_get_constraintdef(oid) like '%airbnb%'
      and pg_get_constraintdef(oid) like '%ical%') calendar_sources_exact,
    exists(select 1 from pg_constraint where conname='hotel_calendar_source_configs_external_inert_check') external_sources_inert,
    exists(select 1 from pg_indexes where schemaname='public'
      and indexname='hotel_payment_policies_one_active_per_hotel_uidx') one_active_payment,
    exists(select 1 from pg_indexes where schemaname='public'
      and indexname='hotel_commission_policies_one_active_per_hotel_uidx') one_active_commission,
    exists(select 1 from pg_proc where oid='public.hotel_v2_h3_1_validate_allocation_rule(uuid)'::regprocedure
      and pg_get_functiondef(oid) like '%active_allocation_range_overlap%'
      and pg_get_functiondef(oid) like '%active_allocation_coverage_gap%') allocation_plan_guard
),
rls as (
  select
    count(*) filter(where relation.relrowsecurity)::integer rls_enabled_count,
    count(*) filter(where has_table_privilege('authenticated','public.'||relation.relname,'SELECT')
      and not has_table_privilege('authenticated','public.'||relation.relname,'INSERT')
      and not has_table_privilege('authenticated','public.'||relation.relname,'UPDATE')
      and not has_table_privilege('authenticated','public.'||relation.relname,'DELETE')
      and not has_table_privilege('anon','public.'||relation.relname,'SELECT')
      and has_table_privilege('service_role','public.'||relation.relname,'SELECT')
      and not has_table_privilege('service_role','public.'||relation.relname,'INSERT')
      and not has_table_privilege('service_role','public.'||relation.relname,'UPDATE')
      and not has_table_privilege('service_role','public.'||relation.relname,'DELETE'))::integer exact_grant_count
  from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
  where namespace.nspname='public' and relation.relname in (
    'hotel_room_allocation_rules','hotel_room_allocation_rule_items',
    'hotel_payment_policies','hotel_payment_policy_terms',
    'hotel_commission_policies','hotel_calendar_source_configs'
  )
),
helpers as (
  select
    has_function_privilege('service_role',
      'public.hotel_v2_h3_1_codes_valid(text[])','EXECUTE')
      and has_function_privilege('authenticated',
        'public.hotel_v2_h3_1_codes_valid(text[])','EXECUTE')
      and not has_function_privilege('anon',
        'public.hotel_v2_h3_1_codes_valid(text[])','EXECUTE') codes_helper_exact,
    not exists(
      select 1
      from (values
        ('public.hotel_v2_h3_1_validate_allocation_rule(uuid)'),
        ('public.hotel_v2_h3_1_allocation_rule_constraint_trigger()'),
        ('public.hotel_v2_h3_1_validate_room_allocation_inventory(uuid)'),
        ('public.hotel_v2_h3_1_room_inventory_constraint_trigger()'),
        ('public.hotel_v2_h3_1_validate_payment_policy(uuid)'),
        ('public.hotel_v2_h3_1_payment_policy_constraint_trigger()'),
        ('public.hotel_v2_h3_1_allocation_items_fingerprint(uuid)'),
        ('public.hotel_v2_h3_1_payment_terms_fingerprint(uuid)')
      ) helper(signature)
      where has_function_privilege('anon',helper.signature,'EXECUTE')
         or has_function_privilege('authenticated',helper.signature,'EXECUTE')
         or has_function_privilege('service_role',helper.signature,'EXECUTE')
    ) internal_helpers_denied
),
rpcs as (
  select count(*)::integer rpc_count,
    count(*) filter(where procedure_info.prosecdef
      and procedure_info.proconfig@>array['search_path=pg_catalog, public, auth'])::integer safe_definer_count,
    count(*) filter(where has_function_privilege('authenticated',procedure_info.oid,'EXECUTE')
      and not has_function_privilege('anon',procedure_info.oid,'EXECUTE')
      and not has_function_privilege('service_role',procedure_info.oid,'EXECUTE'))::integer exact_grant_count,
    count(*) filter(where procedure_info.proname='hotel_v2_admin_apply_h3_1_configuration'
      and pg_get_functiondef(procedure_info.oid) like '%expected_property_updated_at%'
      and pg_get_functiondef(procedure_info.oid) like '%expected_children_fingerprint%'
      and pg_get_functiondef(procedure_info.oid) like '%for update%'
      and pg_get_functiondef(procedure_info.oid) like '%hotel_activity_log%')::integer atomic_apply_count
  from pg_proc procedure_info join pg_namespace namespace on namespace.oid=procedure_info.pronamespace
  where namespace.nspname='public' and procedure_info.proname in (
    'hotel_v2_admin_get_h3_1_configuration','hotel_v2_admin_apply_h3_1_configuration'
  )
),
history as (
  select
    (select count(*)::integer from public.hotel_bookings) booking_count,
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
      from public.hotel_bookings row_value) booking_fingerprint,
    (select count(*)::integer from public.partner_service_fulfillments
      where resource_type='hotels') fulfillment_count,
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
      from public.partner_service_fulfillments row_value where resource_type='hotels') fulfillment_fingerprint
),
security as (
  select
    (select relrowsecurity from pg_class where oid='public.hotel_bookings'::regclass) booking_rls_enabled,
    not exists(select 1 from pg_policies policy_info
      where policy_info.schemaname='public' and policy_info.tablename='hotel_bookings'
        and policy_info.roles@>array['authenticated']::name[] and policy_info.cmd in ('SELECT','ALL')
        and replace(lower(coalesce(policy_info.qual,'')),' ','') in ('true','(true)')) broad_select_removed,
    to_regprocedure('public.customer_get_hotel_bookings(integer)') is not null customer_bridge_present,
    to_regprocedure('public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)') is not null partner_bridge_present
),
oracle as (
  select
    case when graph.room_tier_count=27 and graph.party_tier_count=63
      and graph.schedule_fingerprint_count=2 then 0 else 1 end
      hotel_7_arches_occupancy_price_mismatch,
    case when seven_arches.exact_property_count=1 and graph.room_tier_count=27
      and graph.party_tier_count=63 and graph.schedule_fingerprint_count=2 then 0 else 1 end
      hotel_legacy_price_mismatch,
    case when properties.legacy_count=2 and properties.rooms_v2_count=0
      and flags.flags_off_count=1 then 0 else 1 end hotel_legacy_public_mismatch,
    case when history.booking_count=3
      and history.booking_fingerprint='fb5a4c508b0df32afbffe5b1594c7a50'
      and history.fulfillment_count=5
      and history.fulfillment_fingerprint='1e01541853d87d26adccb8172074934b'
      then 0 else 1 end hotel_booking_payload_unexplained_difference
  from seven_arches cross join shadow_graph graph cross join properties cross join flags cross join history
)
select
  properties.property_count,properties.legacy_count,properties.rooms_v2_count,
  properties.unset_minimum_stay_count,flags.flags_off_count,
  seven_arches.exact_property_count,rooms.room_count,rooms.upper_exact_count,rooms.ground_exact_count,
  graph.rate_plan_count,graph.inactive_room_rate_count,graph.inert_schedule_count,
  graph.room_tier_count,graph.party_tier_count,
  rows.allocation_rule_count,rows.allocation_item_count,rows.payment_policy_count,
  rows.payment_term_count,rows.commission_policy_count,rows.calendar_source_count,
  calendar.daily_inventory_count,calendar.daily_rate_count,
  calendar.rate_rule_count,calendar.override_count,
  history.booking_count,history.booking_fingerprint,history.fulfillment_count,history.fulfillment_fingerprint,
  oracle.hotel_7_arches_occupancy_price_mismatch as "HOTEL_7_ARCHES_OCCUPANCY_PRICE_MISMATCH",
  oracle.hotel_legacy_price_mismatch as "HOTEL_LEGACY_PRICE_MISMATCH",
  oracle.hotel_legacy_public_mismatch as "HOTEL_LEGACY_PUBLIC_MISMATCH",
  oracle.hotel_booking_payload_unexplained_difference as "HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE",
  (
    properties.property_count=2 and properties.legacy_count=2 and properties.rooms_v2_count=0
    and properties.property_ids=array[constants.seven_arches_id,constants.rgb_id]::uuid[]
    and properties.unset_minimum_stay_count=2 and flags.settings_count=1 and flags.flags_off_count=1
    and seven_arches.property_count=1 and seven_arches.exact_property_count=1
    and rooms.room_count=2 and rooms.upper_exact_count=1 and rooms.ground_exact_count=1
    and rooms.foreign_gallery_count=0
    and graph.rate_plan_count=1 and graph.inactive_room_rate_count=2
    and graph.inert_schedule_count=2 and graph.room_tier_count=27 and graph.party_tier_count=63
    and rows.allocation_rule_count=0 and rows.allocation_item_count=0
    and rows.payment_policy_count=0 and rows.payment_term_count=0
    and rows.commission_policy_count=0 and rows.calendar_source_count=0
    and calendar.daily_inventory_count=0 and calendar.daily_rate_count=0
    and calendar.rate_rule_count=0 and calendar.override_count=0
    and columns.property_minimum_stay_exact and columns.minimum_billable_exact and columns.inclusions_exact
    and contracts.allocation_modes_exact and contracts.payment_events_exact
    and contracts.commission_mode_exact and contracts.calendar_sources_exact
    and contracts.external_sources_inert and contracts.one_active_payment
    and contracts.one_active_commission and contracts.allocation_plan_guard
    and rls.rls_enabled_count=6 and rls.exact_grant_count=6
    and helpers.codes_helper_exact and helpers.internal_helpers_denied
    and rpcs.rpc_count=2 and rpcs.safe_definer_count=2 and rpcs.exact_grant_count=2
    and rpcs.atomic_apply_count=1
    and security.booking_rls_enabled and security.broad_select_removed
    and security.customer_bridge_present and security.partner_bridge_present
    and oracle.hotel_7_arches_occupancy_price_mismatch=0
    and oracle.hotel_legacy_price_mismatch=0
    and oracle.hotel_legacy_public_mismatch=0
    and oracle.hotel_booking_payload_unexplained_difference=0
  ) hotels_v2_h3_1_inert_admin_configuration_safe
from constants cross join properties cross join flags cross join seven_arches cross join rooms
cross join shadow_graph graph cross join new_rows rows cross join columns
cross join calendar_state calendar cross join constraints_and_indexes contracts
cross join rls cross join rpcs cross join history
cross join helpers cross join security cross join oracle;
