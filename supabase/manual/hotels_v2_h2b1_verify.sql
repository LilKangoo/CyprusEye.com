-- Hotels 2.0 H2B.1 children-policy / 7 Arches shadow foundation verify.
-- READ ONLY. Run immediately after 20260811240000, before the Admin shadow action.

with
properties as (
  select count(*)::integer property_count,
    count(*) filter(where architecture_version='legacy')::integer legacy_count,
    count(*) filter(where architecture_version='rooms_v2')::integer rooms_v2_count,
    count(*) filter(where children_policy is null and minimum_child_age is null)::integer policy_unreviewed_count,
    coalesce(array_agg(id order by id),'{}'::uuid[]) property_ids,
    md5(coalesce(string_agg((to_jsonb(hotel)-'children_policy'-'minimum_child_age'
      -'architecture_version'-'timezone'-'currency'-'booking_mode'-'check_in_from'-'check_out_until')::text,
      '|' order by id),'')) protected_fingerprint
  from public.hotels hotel
),
expected_properties as (
  select array[
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid,
    'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1'::uuid
  ] property_ids
),
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
rows as (
  select
    (select count(*)::integer from public.hotel_room_types) room_type_count,
    (select count(*)::integer from public.hotel_room_rates) room_rate_count,
    (select count(*)::integer from public.hotel_calendar_overrides) calendar_override_count,
    (select count(*)::integer from public.hotel_room_rate_occupancy_tiers) occupancy_tier_count,
    (select count(*)::integer from public.hotel_pricing_schedules) pricing_schedule_count,
    (select count(*)::integer from public.hotel_pricing_schedule_occupancy_tiers) schedule_tier_count,
    (select count(*)::integer from public.hotel_room_types where legacy_source_key is not null) legacy_source_room_count,
    (select count(*)::integer from public.hotel_room_types
      where id in ('b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid,'825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid)) reserved_room_count,
    (select count(*)::integer from public.hotel_rate_plans
      where id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid) reserved_plan_count,
    (select count(*)::integer from public.hotel_room_rates
      where id in ('7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid,'3320590d-632d-423f-80d0-fd021cba7293'::uuid)) reserved_rate_count
),
column_contract as (
  select
    (select count(*)=2 from information_schema.columns where table_schema='public' and table_name='hotels'
      and ((column_name='children_policy' and data_type='text' and is_nullable='YES')
        or (column_name='minimum_child_age' and data_type='smallint' and is_nullable='YES'))) property_columns,
    (select count(*)=4 from information_schema.columns where table_schema='public' and table_name='hotel_room_types'
      and column_name in ('max_occupancy','children_policy_override','minimum_child_age_override','legacy_source_key')) room_columns,
    (select count(*)=1 from information_schema.columns where table_schema='public' and table_name='hotel_room_rates'
      and column_name='pricing_schedule_id' and data_type='uuid' and is_nullable='YES') rate_schedule_link,
    (select is_nullable='YES' from information_schema.columns where table_schema='public'
      and table_name='hotel_room_types' and column_name='capacity_adults') adults_capacity_nullable,
    (select is_nullable='YES' from information_schema.columns where table_schema='public'
      and table_name='hotel_room_types' and column_name='capacity_children') children_capacity_nullable,
    (select count(*)=14 from information_schema.columns where table_schema='public' and table_name='hotel_pricing_schedules') schedule_exact_columns,
    (select count(*)=9 from information_schema.columns where table_schema='public' and table_name='hotel_pricing_schedule_occupancy_tiers') tier_exact_columns
),
constraint_contract as (
  select
    exists(select 1 from pg_constraint where conrelid='public.hotels'::regclass
      and conname='hotels_minimum_child_age_check' and pg_get_constraintdef(oid) like '%17%'
      and pg_get_constraintdef(oid) ilike '%IS NOT NULL%' and pg_get_constraintdef(oid) ilike '%IS TRUE%') property_policy_check,
    exists(select 1 from pg_constraint where conrelid='public.hotel_room_types'::regclass
      and conname='hotel_room_types_capacity_check' and pg_get_constraintdef(oid) like '%max_occupancy%'
      and pg_get_constraintdef(oid) ilike '%capacity_adults IS NOT NULL%'
      and pg_get_constraintdef(oid) ilike '%capacity_children IS NOT NULL%'
      and pg_get_constraintdef(oid) ilike '%IS TRUE%') total_capacity_check,
    exists(select 1 from pg_constraint where conrelid='public.hotel_room_types'::regclass
      and conname='hotel_room_types_minimum_child_age_override_check' and pg_get_constraintdef(oid) like '%17%'
      and pg_get_constraintdef(oid) ilike '%IS NOT NULL%' and pg_get_constraintdef(oid) ilike '%IS TRUE%') room_policy_check,
    exists(select 1 from pg_constraint where conrelid='public.hotel_room_rates'::regclass
      and conname='hotel_room_rates_pricing_schedule_hotel_fkey') same_property_schedule_fk,
    exists(select 1 from pg_constraint where conrelid='public.hotel_pricing_schedules'::regclass
      and conname='hotel_pricing_schedules_scope_check') schedule_scope_check,
    exists(select 1 from pg_constraint where conrelid='public.hotel_pricing_schedules'::regclass
      and conname='hotel_pricing_schedules_activation_review_check') schedule_activation_check,
    exists(select 1 from pg_constraint where conrelid='public.hotel_rate_plans'::regclass
      and conname='hotel_rate_plans_h2b1_review_activation_check') cancellation_activation_check,
    exists(select 1 from pg_constraint where conrelid='public.hotel_room_rates'::regclass
      and conname='hotel_room_rates_h2b1_schedule_inert_check') schedule_product_inert_check,
    exists(select 1 from pg_constraint where conrelid='public.hotel_pricing_schedule_occupancy_tiers'::regclass
      and conname='hotel_pricing_schedule_tiers_key') schedule_tier_unique,
    exists(select 1 from pg_trigger where tgrelid='public.hotel_pricing_schedule_occupancy_tiers'::regclass
      and tgname='hotel_pricing_schedule_tiers_capacity_guard' and not tgisinternal) schedule_tier_capacity_trigger,
    exists(select 1 from pg_trigger where tgrelid='public.hotel_room_types'::regclass
      and tgname='hotel_room_types_occupancy_tier_capacity_guard' and not tgisinternal
      and tgfoid=to_regprocedure('public.hotel_v2_h2b_guard_room_capacity_against_tiers()')) total_capacity_trigger,
    exists(select 1 from pg_constraint where conrelid='public.hotel_activity_log'::regclass
      and conname='hotel_activity_log_entity_type_check' and pg_get_constraintdef(oid) like '%pricing_schedule%') activity_schedule_entity,
    exists(select 1 from pg_proc where oid=to_regprocedure('public.hotel_v2_h2a_cancellation_policy_is_valid(jsonb)')
      and pg_get_functiondef(oid) like '%requires_review%') reviewed_cancellation_placeholder
),
rls_contract as (
  select
    (select relrowsecurity from pg_class where oid='public.hotel_pricing_schedules'::regclass)
      and (select relrowsecurity from pg_class where oid='public.hotel_pricing_schedule_occupancy_tiers'::regclass) rls_enabled,
    (select count(*)=2 from pg_policies where schemaname='public'
      and tablename in ('hotel_pricing_schedules','hotel_pricing_schedule_occupancy_tiers')
      and cmd='SELECT' and roles=array['authenticated']::name[]
      and lower(coalesce(qual,'')) like '%is_current_user_admin%') admin_select_policies,
    (select count(*)=2 from pg_policies where schemaname='public'
      and tablename in ('hotel_pricing_schedules','hotel_pricing_schedule_occupancy_tiers')) exact_policy_count,
    not has_table_privilege('anon','public.hotel_pricing_schedules','SELECT')
      and not has_table_privilege('anon','public.hotel_pricing_schedule_occupancy_tiers','SELECT')
      and has_table_privilege('authenticated','public.hotel_pricing_schedules','SELECT')
      and has_table_privilege('authenticated','public.hotel_pricing_schedule_occupancy_tiers','SELECT')
      and not has_table_privilege('authenticated','public.hotel_pricing_schedules','INSERT')
      and not has_table_privilege('authenticated','public.hotel_pricing_schedules','UPDATE')
      and not has_table_privilege('authenticated','public.hotel_pricing_schedule_occupancy_tiers','INSERT')
      and not has_table_privilege('authenticated','public.hotel_pricing_schedule_occupancy_tiers','UPDATE') raw_admin_writes_denied
),
rpc_contract as (
  select count(*)=5 rpc_count,
    count(*) filter(where procedure_info.prosecdef
      and coalesce(procedure_info.proconfig,'{}'::text[]) @> array['search_path=pg_catalog, public, auth']::text[])=5 safe_definers,
    count(*) filter(where has_function_privilege('authenticated',procedure_info.oid,'EXECUTE')
      and not has_function_privilege('anon',procedure_info.oid,'EXECUTE')
      and not has_function_privilege('service_role',procedure_info.oid,'EXECUTE'))=5 exact_grants,
    bool_and(case when procedure_info.proname='hotel_v2_admin_apply_room_type_plan' then
      pg_get_functiondef(procedure_info.oid) like '%stale_room_type_source%'
      and pg_get_functiondef(procedure_info.oid) like '%duplicate%'
      and pg_get_functiondef(procedure_info.oid) like '%max_occupancy%' else true end) room_plan_contract,
    bool_and(case when procedure_info.proname='hotel_v2_admin_prepare_legacy_shadow_rooms' then
      pg_get_functiondef(procedure_info.oid) like '%seven_arches_two_apartments_v1%'
      and pg_get_functiondef(procedure_info.oid) like '%room_photo_not_in_property_gallery%'
      and pg_get_functiondef(procedure_info.oid) like '%pricing_schedule_tier_count%27%'
      and pg_get_functiondef(procedure_info.oid) like '%property_party_preview_tier_count%63%' else true end) shadow_contract,
    bool_and(case when procedure_info.proname='hotel_v2_admin_prepare_legacy_shadow_rooms' then
      pg_get_functiondef(procedure_info.oid) like '%shadow_tier_value_mismatch%'
      and pg_get_functiondef(procedure_info.oid) like '%stale_pricing_schedule%'
      and pg_get_functiondef(procedure_info.oid) like '%stale_rate_plan%'
      and pg_get_functiondef(procedure_info.oid) like '%stale_upper_room_rate%'
      and pg_get_functiondef(procedure_info.oid) like '%if v_before is null then%insert into public.hotel_room_rates%'
      and pg_get_functiondef(procedure_info.oid) not like '%delete from public.hotel_pricing_schedule_occupancy_tiers%'
      else true end) repeat_save_preserves_reviewed_pricing,
    bool_and(case when procedure_info.proname='hotel_v2_admin_resolve_rate' then
      pg_get_functiondef(procedure_info.oid) like '%shared_room_pricing_schedule_requires_h3_resolution%'
      and pg_get_functiondef(procedure_info.oid) like '%hotel_v2_h2b1_room_capacity%' else true end) resolver_fail_closed,
    bool_and(case when procedure_info.proname in (
      'hotel_v2_admin_apply_guest_policy_plan','hotel_v2_admin_apply_room_type_plan',
      'hotel_v2_admin_prepare_legacy_shadow_rooms'
    ) then lower(pg_get_functiondef(procedure_info.oid)) like '%errcode=''pt409''%'
      and lower(pg_get_functiondef(procedure_info.oid)) not like '%errcode=''40001''%'
      else true end) business_conflicts_nonretrying
  from pg_proc procedure_info join pg_namespace namespace_info on namespace_info.oid=procedure_info.pronamespace
  where namespace_info.nspname='public' and procedure_info.proname in (
    'hotel_v2_admin_apply_guest_policy_plan','hotel_v2_admin_apply_room_type_plan',
    'hotel_v2_admin_prepare_legacy_shadow_rooms','hotel_v2_admin_get_property_workspace',
    'hotel_v2_admin_resolve_rate'
  )
),
internal_contract as (
  select
    to_regprocedure('public.hotel_v2_admin_get_property_workspace_h2b_core(uuid)') is not null workspace_core_present,
    to_regprocedure('public.hotel_v2_admin_resolve_rate_h2b_core(uuid,date,date,integer)') is not null resolver_core_present,
    to_regprocedure('public.hotel_v2_h2a_readiness_h2b_core(uuid)') is not null readiness_core_present,
    not has_function_privilege('anon','public.hotel_v2_admin_get_property_workspace_h2b_core(uuid)','EXECUTE')
      and not has_function_privilege('authenticated','public.hotel_v2_admin_get_property_workspace_h2b_core(uuid)','EXECUTE')
      and not has_function_privilege('service_role','public.hotel_v2_admin_get_property_workspace_h2b_core(uuid)','EXECUTE') core_workspace_direct_denied,
    not has_function_privilege('anon','public.hotel_v2_admin_resolve_rate_h2b_core(uuid,date,date,integer)','EXECUTE')
      and not has_function_privilege('authenticated','public.hotel_v2_admin_resolve_rate_h2b_core(uuid,date,date,integer)','EXECUTE')
      and not has_function_privilege('service_role','public.hotel_v2_admin_resolve_rate_h2b_core(uuid,date,date,integer)','EXECUTE') core_resolver_direct_denied
    ,not has_function_privilege('anon','public.hotel_v2_h2a_readiness_h2b_core(uuid)','EXECUTE')
      and not has_function_privilege('authenticated','public.hotel_v2_h2a_readiness_h2b_core(uuid)','EXECUTE')
      and not has_function_privilege('service_role','public.hotel_v2_h2a_readiness_h2b_core(uuid)','EXECUTE') readiness_core_direct_denied,
    not has_function_privilege('anon','public.hotel_v2_h2a_readiness(uuid)','EXECUTE')
      and not has_function_privilege('authenticated','public.hotel_v2_h2a_readiness(uuid)','EXECUTE')
      and not has_function_privilege('service_role','public.hotel_v2_h2a_readiness(uuid)','EXECUTE')
      and exists(select 1 from pg_proc where oid=to_regprocedure('public.hotel_v2_h2a_readiness(uuid)')
        and prosecdef
        and coalesce(proconfig,'{}'::text[]) @> array['search_path=pg_catalog, public']::text[]
        and pg_get_functiondef(oid) like '%unreviewed_children_policy%'
        and pg_get_functiondef(oid) like '%unreviewed_cancellation_policy%'
        and pg_get_functiondef(oid) like '%h2b1_schedule_product_not_executable%') readiness_hardened
),
transport_contract as (
  select
    to_regprocedure('public.hotel_v2_admin_apply_calendar_plan_h2b1_core(jsonb,uuid)') is not null
      and to_regprocedure('public.hotel_v2_admin_apply_workspace_plan_h2b1_core(jsonb,uuid)') is not null
      as cores_present,
    not has_function_privilege('anon','public.hotel_v2_admin_apply_calendar_plan_h2b1_core(jsonb,uuid)','EXECUTE')
      and not has_function_privilege('authenticated','public.hotel_v2_admin_apply_calendar_plan_h2b1_core(jsonb,uuid)','EXECUTE')
      and not has_function_privilege('service_role','public.hotel_v2_admin_apply_calendar_plan_h2b1_core(jsonb,uuid)','EXECUTE')
      and not has_function_privilege('anon','public.hotel_v2_admin_apply_workspace_plan_h2b1_core(jsonb,uuid)','EXECUTE')
      and not has_function_privilege('authenticated','public.hotel_v2_admin_apply_workspace_plan_h2b1_core(jsonb,uuid)','EXECUTE')
      and not has_function_privilege('service_role','public.hotel_v2_admin_apply_workspace_plan_h2b1_core(jsonb,uuid)','EXECUTE')
      as core_direct_denied,
    (select count(*)=2 from pg_proc procedure_info where procedure_info.oid in (
      'public.hotel_v2_admin_apply_calendar_plan(jsonb,uuid)'::regprocedure,
      'public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid)'::regprocedure
    ) and procedure_info.prosecdef
      and coalesce(procedure_info.proconfig,'{}'::text[]) @> array['search_path=pg_catalog, public, auth']::text[]
      and lower(pg_get_functiondef(procedure_info.oid)) like '%when serialization_failure%'
      and lower(pg_get_functiondef(procedure_info.oid)) like '%errcode=''pt409''%'
      and has_function_privilege('authenticated',procedure_info.oid,'EXECUTE')
      and not has_function_privilege('anon',procedure_info.oid,'EXECUTE')
      and not has_function_privilege('service_role',procedure_info.oid,'EXECUTE')) wrappers_hardened
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
seven_arches_source as (
  select count(*)::integer property_count,
    count(*) filter(where architecture_version='legacy' and pricing_model='tiered_by_nights'
      and max_persons=8 and jsonb_typeof(photos)='array' and jsonb_array_length(photos)=9
      and jsonb_array_length(pricing_tiers->'rules')=63 and pricing_tiers->>'currency'='EUR'
      and coalesce(description->>'en','') like '%All apartments are air-conditioned%'
      and coalesce(description->>'en','') like '%accepts children from 10 years old%'
      and coalesce(description->>'en','') like '%For bookings above 4 people%2 apartments%'
      and coalesce(amenities,'[]'::jsonb)
        @> '["air_conditioning","terrace","balcony"]'::jsonb)::integer source_contract_count
  from public.hotels where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
),
seven_arches_expected(persons,rates) as (
  values
    (2,array[100,90,88,84,80,76,74,72,70]::numeric[]),
    (3,array[130,113,113,104,100,95,94,90,90]::numeric[]),
    (4,array[155,135,135,120,118,114,111,107,107]::numeric[]),
    (5,array[200,180,176,168,160,152,148,144,140]::numeric[]),
    (6,array[260,226,226,208,200,190,188,180,180]::numeric[]),
    (7,array[310,270,270,240,236,228,222,214,214]::numeric[]),
    (8,array[310,270,270,240,236,228,222,214,214]::numeric[])
),
seven_arches_durations(nights) as (select generate_series(2,10) union all select 14),
seven_arches_replay as (
  select expected.persons,duration.nights,least(duration.nights,10)::integer expected_threshold,
    expected.rates[least(duration.nights-1,9)] expected_rate,
    selected.min_nights selected_threshold,selected.price_per_night selected_rate
  from seven_arches_expected expected cross join seven_arches_durations duration
  left join lateral (
    select (rule->>'min_nights')::integer min_nights,(rule->>'price_per_night')::numeric price_per_night
    from public.hotels hotel cross join lateral jsonb_array_elements(hotel.pricing_tiers->'rules') rule
    where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
      and (rule->>'persons')::integer=expected.persons and (rule->>'min_nights')::integer<=duration.nights
    order by (rule->>'min_nights')::integer desc limit 1
  ) selected on true
),
seven_arches_oracle as (
  select count(*)::integer case_count,
    count(*) filter(where selected_threshold is distinct from expected_threshold
      or selected_rate is distinct from expected_rate
      or round(selected_rate*nights,2) is distinct from round(expected_rate*nights,2))::integer mismatch_count
  from seven_arches_replay
),
oracle as (
  select
    source.source_contract_count as seven_arches_source_contract_count,
    case when source.property_count=1 and source.source_contract_count=1
      and replay.case_count=70 and replay.mismatch_count=0 then 0 else 1 end hotel_7_arches_occupancy_price_mismatch,
    case when properties.protected_fingerprint='b3e3a9c5bda72a83e49d3095d175ab9c' then 0 else 1 end hotel_legacy_price_mismatch,
    case when properties.protected_fingerprint='b3e3a9c5bda72a83e49d3095d175ab9c' then 0 else 1 end hotel_legacy_public_mismatch,
    case when bookings.fingerprint='fb5a4c508b0df32afbffe5b1594c7a50'
      and fulfillments.fingerprint='1e01541853d87d26adccb8172074934b'
      and relationships.deposit_fingerprint='42b5e1dc9726890e90014c3e89c2329d'
      and relationships.coupon_fingerprint='d41d8cd98f00b204e9800998ecf8427e' then 0 else 1 end hotel_booking_payload_unexplained_difference
  from seven_arches_source source cross join seven_arches_oracle replay cross join properties
  cross join bookings cross join fulfillments cross join relationships
)
select
  properties.property_count,properties.legacy_count,properties.rooms_v2_count,properties.policy_unreviewed_count,
  properties.protected_fingerprint as protected_property_fingerprint,
  rows.room_type_count,rows.room_rate_count,rows.calendar_override_count,rows.occupancy_tier_count,
  rows.pricing_schedule_count,rows.schedule_tier_count,rows.legacy_source_room_count,
  flags.flags_off_count,
  columns.property_columns,columns.room_columns,columns.rate_schedule_link,
  constraints.property_policy_check,constraints.total_capacity_check,constraints.room_policy_check,
  constraints.same_property_schedule_fk,constraints.schedule_scope_check,constraints.schedule_activation_check,
  constraints.cancellation_activation_check,constraints.schedule_product_inert_check,constraints.schedule_tier_unique,
  rls.rls_enabled,rls.admin_select_policies,rls.exact_policy_count,rls.raw_admin_writes_denied,
  rpc.rpc_count,rpc.safe_definers,rpc.exact_grants,rpc.room_plan_contract,rpc.shadow_contract,
  rpc.repeat_save_preserves_reviewed_pricing,rpc.resolver_fail_closed,rpc.business_conflicts_nonretrying,
  transport.cores_present,transport.core_direct_denied,transport.wrappers_hardened,
  oracle.seven_arches_source_contract_count,
  security.booking_rls_enabled,security.broad_select_removed,security.customer_bridge_present,security.partner_bridge_present,
  oracle.hotel_7_arches_occupancy_price_mismatch as "HOTEL_7_ARCHES_OCCUPANCY_PRICE_MISMATCH",
  oracle.hotel_legacy_price_mismatch as "HOTEL_LEGACY_PRICE_MISMATCH",
  oracle.hotel_legacy_public_mismatch as "HOTEL_LEGACY_PUBLIC_MISMATCH",
  oracle.hotel_booking_payload_unexplained_difference as "HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE",
  (
    properties.property_count=2 and properties.legacy_count=2 and properties.rooms_v2_count=0
    and properties.policy_unreviewed_count=2 and properties.property_ids=expected.property_ids
    and flags.settings_count=1 and flags.flags_off_count=1
    and rows.pricing_schedule_count=0 and rows.schedule_tier_count=0 and rows.legacy_source_room_count=0
    and rows.reserved_room_count=0 and rows.reserved_plan_count=0 and rows.reserved_rate_count=0
    and columns.property_columns and columns.room_columns and columns.rate_schedule_link
    and columns.adults_capacity_nullable and columns.children_capacity_nullable
    and columns.schedule_exact_columns and columns.tier_exact_columns
    and constraints.property_policy_check and constraints.total_capacity_check and constraints.room_policy_check
    and constraints.same_property_schedule_fk and constraints.schedule_scope_check
    and constraints.schedule_activation_check and constraints.cancellation_activation_check
    and constraints.schedule_product_inert_check and constraints.schedule_tier_unique
    and constraints.schedule_tier_capacity_trigger and constraints.total_capacity_trigger
    and constraints.activity_schedule_entity and constraints.reviewed_cancellation_placeholder
    and rls.rls_enabled and rls.admin_select_policies and rls.exact_policy_count and rls.raw_admin_writes_denied
    and rpc.rpc_count and rpc.safe_definers and rpc.exact_grants and rpc.room_plan_contract
    and rpc.shadow_contract and rpc.repeat_save_preserves_reviewed_pricing and rpc.resolver_fail_closed
    and rpc.business_conflicts_nonretrying
    and internal.workspace_core_present and internal.resolver_core_present and internal.readiness_core_present
    and internal.core_workspace_direct_denied and internal.core_resolver_direct_denied
    and internal.readiness_core_direct_denied and internal.readiness_hardened
    and transport.cores_present and transport.core_direct_denied and transport.wrappers_hardened
    and security.booking_rls_enabled and security.broad_select_removed
    and security.customer_bridge_present and security.partner_bridge_present
    and oracle.hotel_7_arches_occupancy_price_mismatch=0
    and oracle.hotel_legacy_price_mismatch=0 and oracle.hotel_legacy_public_mismatch=0
    and oracle.hotel_booking_payload_unexplained_difference=0
  ) hotels_v2_h2b1_foundation_safe
from properties cross join expected_properties expected cross join bookings cross join fulfillments
cross join relationships cross join flags cross join rows cross join column_contract columns
cross join constraint_contract constraints cross join rls_contract rls cross join rpc_contract rpc
cross join internal_contract internal cross join transport_contract transport
cross join h1_security security cross join oracle;
