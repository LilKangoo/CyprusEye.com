-- Hotels V2 H3.1 inert Admin configuration preflight (READ ONLY).
-- Run immediately before 20260811290000_hotels_v2_h3_1_inert_admin_configuration.sql.
-- Returns exactly one summary row and performs no DDL/DML.

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
    array_agg(id order by id) property_ids
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
      and jsonb_array_length(pricing_tiers->'rules')=63)::integer exact_property_count
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
        and not plan.is_active and plan.cancellation_policy='{"type":"non_refundable"}'::jsonb)::integer rate_plan_count,
    (select count(*) from public.hotel_room_rates rate cross join constants
      where rate.hotel_id=constants.seven_arches_id and not rate.is_active)::integer inactive_room_rate_count,
    (select count(*) from public.hotel_pricing_schedules schedule cross join constants
      where schedule.hotel_id=constants.seven_arches_id
        and schedule.id in (constants.room_schedule_id,constants.party_schedule_id)
        and not schedule.is_active)::integer inert_schedule_count,
    (select count(*) from public.hotel_pricing_schedule_occupancy_tiers tier cross join constants
      where tier.schedule_id=constants.room_schedule_id)::integer room_tier_count,
    (select count(*) from public.hotel_pricing_schedule_occupancy_tiers tier cross join constants
      where tier.schedule_id=constants.party_schedule_id)::integer party_tier_count
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
    to_regprocedure('public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)') is not null partner_bridge_present,
    exists(select 1 from pg_proc where oid=to_regprocedure(
      'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)')
      and pg_get_functiondef(oid) like '%hotels_v2_h2b2_preserve_reviewed_property_policy_v1%') h2b2_repair_present
),
h3_1_absence as (
  select
    not exists(select 1 from information_schema.columns where table_schema='public'
      and table_name='hotels' and column_name='minimum_stay_nights') property_column_absent,
    not exists(select 1 from information_schema.columns where table_schema='public'
      and table_name='hotel_pricing_schedules' and column_name='minimum_billable_occupancy') schedule_column_absent,
    not exists(select 1 from information_schema.columns where table_schema='public'
      and table_name='hotel_rate_plans' and column_name='price_inclusions') inclusions_column_absent,
    to_regclass('public.hotel_room_allocation_rules') is null allocation_rules_absent,
    to_regclass('public.hotel_room_allocation_rule_items') is null allocation_items_absent,
    to_regclass('public.hotel_payment_policies') is null payment_policies_absent,
    to_regclass('public.hotel_payment_policy_terms') is null payment_terms_absent,
    to_regclass('public.hotel_commission_policies') is null commission_policies_absent,
    to_regclass('public.hotel_calendar_source_configs') is null calendar_sources_absent,
    to_regprocedure('public.hotel_v2_admin_get_h3_1_configuration(uuid)') is null get_rpc_absent,
    to_regprocedure('public.hotel_v2_admin_apply_h3_1_configuration(jsonb,uuid)') is null apply_rpc_absent
)
select
  properties.property_count,properties.legacy_count,properties.rooms_v2_count,
  seven_arches.exact_property_count,rooms.room_count,rooms.upper_exact_count,rooms.ground_exact_count,
  graph.rate_plan_count,graph.inactive_room_rate_count,graph.inert_schedule_count,
  graph.room_tier_count,graph.party_tier_count,
  calendar.daily_inventory_count,calendar.daily_rate_count,
  calendar.rate_rule_count,calendar.override_count,
  history.booking_count,history.booking_fingerprint,
  history.fulfillment_count,history.fulfillment_fingerprint,
  flags.flags_off_count,security.booking_rls_enabled,security.broad_select_removed,
  security.customer_bridge_present,security.partner_bridge_present,security.h2b2_repair_present,
  (
    properties.property_count=2 and properties.legacy_count=2 and properties.rooms_v2_count=0
    and properties.property_ids=array[
      constants.seven_arches_id,constants.rgb_id
    ]::uuid[]
    and flags.settings_count=1 and flags.flags_off_count=1
    and seven_arches.property_count=1 and seven_arches.exact_property_count=1
    and rooms.room_count=2 and rooms.upper_exact_count=1 and rooms.ground_exact_count=1
    and rooms.foreign_gallery_count=0
    and graph.rate_plan_count=1 and graph.inactive_room_rate_count=2
    and graph.inert_schedule_count=2 and graph.room_tier_count=27 and graph.party_tier_count=63
    and calendar.daily_inventory_count=0 and calendar.daily_rate_count=0
    and calendar.rate_rule_count=0 and calendar.override_count=0
    and history.booking_count=3 and history.booking_fingerprint='fb5a4c508b0df32afbffe5b1594c7a50'
    and history.fulfillment_count=5 and history.fulfillment_fingerprint='1e01541853d87d26adccb8172074934b'
    and security.booking_rls_enabled and security.broad_select_removed
    and security.customer_bridge_present and security.partner_bridge_present and security.h2b2_repair_present
    and h3.property_column_absent and h3.schedule_column_absent and h3.inclusions_column_absent
    and h3.allocation_rules_absent and h3.allocation_items_absent
    and h3.payment_policies_absent and h3.payment_terms_absent
    and h3.commission_policies_absent and h3.calendar_sources_absent
    and h3.get_rpc_absent and h3.apply_rpc_absent
  ) hotels_v2_h3_1_inert_admin_configuration_preflight_safe
from properties cross join constants cross join flags cross join seven_arches cross join rooms
cross join shadow_graph graph cross join calendar_state calendar cross join history
cross join security cross join h3_1_absence h3;
