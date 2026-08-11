-- Hotels 2.0 H2B.1 children-policy / 7 Arches shadow preflight.
-- READ ONLY. Run immediately before 20260811240000. Returns one row.

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
    md5(coalesce(string_agg((to_jsonb(hotel)-'architecture_version'-'timezone'-'currency'-'booking_mode'
      -'check_in_from'-'check_out_until')::text,'|' order by id),'')) protected_fingerprint
  from public.hotels hotel
),
expected as (select array_agg(id order by id) property_ids from expected_properties),
bookings as (
  select count(*)::integer booking_count,
    md5(coalesce(string_agg(to_jsonb(booking)::text,'|' order by id),'')) fingerprint
  from public.hotel_bookings booking
),
fulfillments as (
  select count(*)::integer fulfillment_count,
    md5(coalesce(string_agg(to_jsonb(fulfillment)::text,'|' order by id),'')) fingerprint
  from public.partner_service_fulfillments fulfillment where resource_type='hotels'
),
relationships as (
  select
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
      from public.service_deposit_requests row_value where row_value.resource_type='hotels') deposit_fingerprint,
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
      from public.service_coupon_redemptions row_value where row_value.service_type='hotels') coupon_fingerprint
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
    (select count(*)::integer from public.hotel_calendar_overrides) calendar_override_count,
    (select count(*)::integer from public.hotel_room_rate_occupancy_tiers) occupancy_tier_count,
    (select count(*)::integer from public.hotel_activity_log) activity_count,
    (select count(*)::integer from public.hotel_room_types
      where id in ('b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid,'825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid)) reserved_room_id_count,
    (select count(*)::integer from public.hotel_rate_plans
      where id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid) reserved_rate_plan_id_count,
    (select count(*)::integer from public.hotel_room_rates
      where id in ('7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid,'3320590d-632d-423f-80d0-fd021cba7293'::uuid)) reserved_room_rate_id_count
),
seven_arches as (
  select count(*)::integer property_count,
    count(*) filter(where architecture_version='legacy' and pricing_model='tiered_by_nights'
      and max_persons=8 and jsonb_typeof(photos)='array' and jsonb_array_length(photos)=9
      and pricing_tiers->>'currency'='EUR'
      and coalesce(description->>'en','') like '%All apartments are air-conditioned%'
      and coalesce(description->>'en','') like '%accepts children from 10 years old%'
      and coalesce(description->>'en','') like '%For bookings above 4 people%2 apartments%'
      and coalesce(amenities,'[]'::jsonb)
        @> '["air_conditioning","terrace","balcony"]'::jsonb)::integer source_contract_count,
    max(jsonb_array_length(coalesce(pricing_tiers->'rules','[]'::jsonb)))::integer pricing_rule_count,
    max(md5(pricing_tiers::text)) pricing_fingerprint
  from public.hotels where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
),
seven_arches_grid as (
  select count(*)::integer rule_count,
    count(distinct (rule->>'persons')::integer)::integer guest_count,
    count(distinct (rule->>'min_nights')::integer)::integer threshold_count,
    count(*) filter(where (rule->>'persons')::integer not between 2 and 8
      or (rule->>'min_nights')::integer not between 2 and 10
      or (rule->>'price_per_night')::numeric<0)::integer invalid_rule_count,
    count(*)-(count(distinct ((rule->>'persons')::integer,(rule->>'min_nights')::integer)))::integer duplicate_rule_count
  from public.hotels hotel
  cross join lateral jsonb_array_elements(coalesce(hotel.pricing_tiers->'rules','[]'::jsonb)) rule
  where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
),
amenities as (
  select count(*) filter(where code in ('air_conditioning','terrace','balcony') and is_active)::integer confirmed_amenity_count,
    count(*) filter(where code in ('air_conditioning','terrace','balcony'))::integer exact_amenity_code_count
  from public.hotel_amenities
),
h1_security as (
  select
    (select relrowsecurity from pg_class where oid='public.hotel_bookings'::regclass) booking_rls_enabled,
    not exists(select 1 from pg_policies policy_info where policy_info.schemaname='public'
      and policy_info.tablename='hotel_bookings' and policy_info.roles @> array['authenticated']::name[]
      and policy_info.cmd in ('SELECT','ALL') and replace(lower(coalesce(policy_info.qual,'')),' ','') in ('true','(true)')) broad_select_removed,
    to_regprocedure('public.customer_get_hotel_bookings(integer)') is not null customer_bridge_present,
    to_regprocedure('public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)') is not null partner_bridge_present
),
h2b_contract as (
  select
    to_regclass('public.hotel_calendar_overrides') is not null calendar_present,
    to_regclass('public.hotel_room_rate_occupancy_tiers') is not null occupancy_tiers_present,
    to_regprocedure('public.hotel_v2_admin_resolve_rate(uuid,date,date,integer)') is not null resolver_present,
    to_regprocedure('public.hotel_v2_admin_get_calendar(uuid,date,date)') is not null calendar_rpc_present,
    to_regprocedure('public.hotel_v2_admin_apply_calendar_plan(jsonb,uuid)') is not null calendar_apply_present,
    to_regprocedure('public.hotel_v2_admin_get_property_workspace(uuid)') is not null workspace_present,
    to_regprocedure('public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid)') is not null workspace_apply_present,
    to_regprocedure('public.hotel_v2_admin_apply_calendar_plan_h2b1_core(jsonb,uuid)') is null calendar_transport_core_absent,
    to_regprocedure('public.hotel_v2_admin_apply_workspace_plan_h2b1_core(jsonb,uuid)') is null workspace_transport_core_absent,
    to_regprocedure('public.hotel_v2_h2a_require_admin()') is not null admin_guard_present,
    to_regprocedure('public.hotel_v2_h2a_keys_allowed(jsonb,text[])') is not null key_guard_present,
    to_regprocedure('public.hotel_v2_h2a_i18n_is_valid(jsonb,boolean)') is not null i18n_guard_present,
    to_regprocedure('public.hotel_v2_set_updated_at_and_version()') is not null version_trigger_present
),
h2b1_absence as (
  select
    to_regclass('public.hotel_pricing_schedules') is null schedules_absent,
    to_regclass('public.hotel_pricing_schedule_occupancy_tiers') is null schedule_tiers_absent,
    to_regprocedure('public.hotel_v2_admin_apply_guest_policy_plan(jsonb,uuid)') is null guest_policy_rpc_absent,
    to_regprocedure('public.hotel_v2_admin_apply_room_type_plan(jsonb,uuid)') is null room_type_rpc_absent,
    to_regprocedure('public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)') is null shadow_rpc_absent,
    to_regprocedure('public.hotel_v2_h2b1_room_capacity(uuid)') is null capacity_helper_absent,
    to_regprocedure('public.hotel_v2_h2a_readiness_h2b_core(uuid)') is null readiness_core_absent,
    not exists(select 1 from information_schema.columns where table_schema='public' and table_name='hotels'
      and column_name in ('children_policy','minimum_child_age')) property_columns_absent,
    not exists(select 1 from information_schema.columns where table_schema='public' and table_name='hotel_room_types'
      and column_name in ('max_occupancy','children_policy_override','minimum_child_age_override','legacy_source_key')) room_columns_absent,
    not exists(select 1 from information_schema.columns where table_schema='public' and table_name='hotel_room_rates'
      and column_name='pricing_schedule_id') rate_link_absent
)
select
  properties.property_count,properties.legacy_count,properties.rooms_v2_count,properties.property_ids,
  properties.protected_fingerprint as protected_property_fingerprint,
  bookings.booking_count,bookings.fingerprint as booking_fingerprint,
  fulfillments.fulfillment_count as hotel_fulfillment_count,fulfillments.fingerprint as fulfillment_fingerprint,
  relationships.deposit_fingerprint,relationships.coupon_fingerprint,
  flags.flags_off_count,
  normalized.room_type_count,normalized.unit_count,normalized.rate_plan_count,normalized.room_rate_count,
  normalized.rate_rule_count,normalized.daily_inventory_count,normalized.daily_rate_count,
  normalized.calendar_override_count,normalized.occupancy_tier_count,normalized.activity_count,
  seven_arches.source_contract_count as seven_arches_source_contract_count,
  seven_arches.pricing_rule_count as seven_arches_pricing_rule_count,
  seven_arches.pricing_fingerprint as seven_arches_pricing_fingerprint,
  amenities.confirmed_amenity_count,
  h1.booking_rls_enabled,h1.broad_select_removed,h1.customer_bridge_present,h1.partner_bridge_present,
  h2b.calendar_present,h2b.occupancy_tiers_present,h2b.resolver_present,h2b.calendar_rpc_present,h2b.calendar_apply_present,
  (
    properties.property_count=2 and properties.legacy_count=2 and properties.rooms_v2_count=0
    and properties.property_ids=expected.property_ids
    and properties.protected_fingerprint='b3e3a9c5bda72a83e49d3095d175ab9c'
    and bookings.booking_count=3 and bookings.fingerprint='fb5a4c508b0df32afbffe5b1594c7a50'
    and fulfillments.fulfillment_count=5 and fulfillments.fingerprint='1e01541853d87d26adccb8172074934b'
    and relationships.deposit_fingerprint='42b5e1dc9726890e90014c3e89c2329d'
    and relationships.coupon_fingerprint='d41d8cd98f00b204e9800998ecf8427e'
    and flags.settings_count=1 and flags.flags_off_count=1
    and seven_arches.property_count=1 and seven_arches.source_contract_count=1 and seven_arches.pricing_rule_count=63
    and seven_arches_grid.rule_count=63 and seven_arches_grid.guest_count=7 and seven_arches_grid.threshold_count=9
    and seven_arches_grid.invalid_rule_count=0 and seven_arches_grid.duplicate_rule_count=0
    and amenities.confirmed_amenity_count=3 and amenities.exact_amenity_code_count=3
    and normalized.reserved_room_id_count=0 and normalized.reserved_rate_plan_id_count=0
    and normalized.reserved_room_rate_id_count=0
    and h1.booking_rls_enabled and h1.broad_select_removed and h1.customer_bridge_present and h1.partner_bridge_present
    and h2b.calendar_present and h2b.occupancy_tiers_present and h2b.resolver_present
    and h2b.calendar_rpc_present and h2b.calendar_apply_present and h2b.workspace_present
    and h2b.workspace_apply_present and h2b.admin_guard_present and h2b.key_guard_present
    and h2b.i18n_guard_present and h2b.version_trigger_present
    and h2b.calendar_transport_core_absent and h2b.workspace_transport_core_absent
    and absence.schedules_absent and absence.schedule_tiers_absent and absence.guest_policy_rpc_absent
    and absence.room_type_rpc_absent and absence.shadow_rpc_absent and absence.capacity_helper_absent
    and absence.readiness_core_absent
    and absence.property_columns_absent and absence.room_columns_absent and absence.rate_link_absent
  ) hotels_v2_h2b1_preflight_safe
from properties cross join expected cross join bookings cross join fulfillments cross join relationships
cross join flags cross join normalized cross join seven_arches cross join seven_arches_grid
cross join amenities cross join h1_security h1 cross join h2b_contract h2b cross join h2b1_absence absence;
