-- Hotels 2.0 H2B calendar/rates foundation verification (READ ONLY).
-- Run immediately after 20260811230000 and before any H2B Admin write.

with
properties as (
  select count(*)::integer property_count,
         count(*) filter(where architecture_version='legacy')::integer legacy_count,
         count(*) filter(where architecture_version='rooms_v2')::integer rooms_v2_count,
         coalesce(array_agg(id order by id),'{}'::uuid[]) property_ids,
         md5(coalesce(string_agg((to_jsonb(hotel)-'architecture_version'-'timezone'-'currency'-'booking_mode'-'check_in_from'-'check_out_until')::text,'|' order by id),'')) protected_fingerprint
  from public.hotels hotel
),
bookings as (
  select count(*)::integer booking_count,
         md5(coalesce(string_agg(to_jsonb(booking)::text,'|' order by id),'')) fingerprint
  from public.hotel_bookings booking
),
fulfillments as (
  select count(*)::integer fulfillment_count,
         md5(coalesce(string_agg(to_jsonb(fulfillment)::text,'|' order by id),'')) fingerprint
  from public.partner_service_fulfillments fulfillment
  where resource_type='hotels'
),
relationships as (
  select
    (select md5(coalesce(string_agg(to_jsonb(deposit_row)::text,'|' order by deposit_row.id),''))
       from public.service_deposit_requests deposit_row where deposit_row.resource_type='hotels') deposit_fingerprint,
    (select md5(coalesce(string_agg(to_jsonb(coupon_row)::text,'|' order by coupon_row.id),''))
       from public.service_coupon_redemptions coupon_row where coupon_row.service_type='hotels') coupon_fingerprint
),
seven_arches_source as (
  select
    count(*)::integer property_count,
    count(*) filter(where pricing_model='tiered_by_nights')::integer expected_model_count,
    coalesce(sum(jsonb_array_length(coalesce(pricing_tiers->'rules','[]'::jsonb))),0)::integer pricing_rule_count
  from public.hotels
  where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
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
seven_arches_durations(nights) as (
  select generate_series(2,10) union all select 14
),
seven_arches_replay as (
  select expected.persons,duration.nights,
         least(duration.nights,10)::integer expected_threshold,
         expected.rates[least(duration.nights-1,9)] expected_rate,
         selected.min_nights selected_threshold,
         selected.price_per_night selected_rate
  from seven_arches_expected expected
  cross join seven_arches_durations duration
  left join lateral (
    select (rule->>'min_nights')::integer min_nights,
           (rule->>'price_per_night')::numeric price_per_night
    from public.hotels hotel
    cross join lateral jsonb_array_elements(coalesce(hotel.pricing_tiers->'rules','[]'::jsonb)) rule
    where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
      and (rule->>'persons')::integer=expected.persons
      and (rule->>'min_nights')::integer<=duration.nights
    order by (rule->>'min_nights')::integer desc
    limit 1
  ) selected on true
),
seven_arches_replay_oracle as (
  select count(*) filter(where
    selected_threshold is distinct from expected_threshold
    or selected_rate is distinct from expected_rate
    or round(selected_rate*nights,2) is distinct from round(expected_rate*nights,2)
  )::integer mismatch_count,
  count(*)::integer replay_case_count
  from seven_arches_replay
),
flags as (
  select count(*)::integer settings_count,
         count(*) filter(where not hotel_rooms_v2_enabled and not hotel_external_sync_enabled
           and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled)::integer flags_off_count
  from public.site_settings
),
row_state as (
  select
    (select count(*)::integer from public.hotel_room_types) room_type_count,
    (select count(*)::integer from public.hotel_room_rates) room_rate_count,
    (select count(*)::integer from public.hotel_rate_rules) rate_rule_count,
    (select count(*)::integer from public.hotel_daily_inventory) daily_inventory_count,
    (select count(*)::integer from public.hotel_daily_rates) daily_rate_count,
    (select count(*)::integer from public.hotel_calendar_overrides) calendar_override_count,
    (select count(*)::integer from public.hotel_room_rate_occupancy_tiers) occupancy_tier_count
),
column_contract as (
  select
    (select count(*)=27 from information_schema.columns where table_schema='public' and table_name='hotel_calendar_overrides') calendar_override_exact_columns,
    (select count(*)=13 from information_schema.columns where table_schema='public' and table_name='hotel_room_rate_occupancy_tiers') occupancy_tier_exact_columns,
    (select count(*)=7 from information_schema.columns where table_schema='public' and table_name='hotel_daily_inventory'
      and column_name in ('source','reason','expires_at','actor_id','sellable_units_mode','closed_mode','source_timestamp')) inventory_metadata_columns,
    (select count(*)=3 from information_schema.columns where table_schema='public' and table_name='hotel_rate_rules'
      and column_name in ('source','source_timestamp','provenance')) rule_metadata_columns,
    (select count(*)=1 from information_schema.columns where table_schema='public' and table_name='hotel_daily_rates' and column_name='source') daily_rate_source_column
),
constraint_contract as (
  select
    (select count(*)>=12 from pg_constraint where conrelid='public.hotel_calendar_overrides'::regclass) calendar_override_constraints,
    (select count(*)>=8 from pg_constraint where conrelid='public.hotel_room_rate_occupancy_tiers'::regclass) occupancy_tier_constraints,
    exists(select 1 from pg_constraint where conrelid='public.hotel_room_rates'::regclass and conname='hotel_room_rates_id_hotel_id_key') exact_property_fk_support,
    exists(select 1 from pg_constraint where conrelid='public.hotel_daily_inventory'::regclass and conname='hotel_daily_inventory_manual_audit_check') inventory_audit_constraint,
    exists(select 1 from pg_constraint where conrelid='public.hotel_rate_rules'::regclass and conname='hotel_rate_rules_weekdays_unique_check') weekdays_unique_constraint,
    exists(select 1 from pg_trigger where tgrelid='public.hotel_room_rate_occupancy_tiers'::regclass
      and tgname='hotel_room_rate_occupancy_tiers_capacity_guard' and not tgisinternal) occupancy_capacity_trigger,
    exists(select 1 from pg_trigger where tgrelid='public.hotel_room_types'::regclass
      and tgname='hotel_room_types_occupancy_tier_capacity_guard' and not tgisinternal) room_capacity_trigger,
    exists(select 1 from pg_constraint where conrelid='public.hotel_activity_log'::regclass and conname='hotel_activity_log_entity_type_check'
      and pg_get_constraintdef(oid) like '%calendar_override%' and pg_get_constraintdef(oid) like '%occupancy_tier%') activity_entities_extended,
    exists(select 1 from pg_constraint where conrelid='public.hotel_activity_log'::regclass and conname='hotel_activity_log_action_check'
      and pg_get_constraintdef(oid) like '%delete%') activity_actions_extended
),
rls_contract as (
  select
    (select relrowsecurity from pg_class where oid='public.hotel_calendar_overrides'::regclass)
      and (select relrowsecurity from pg_class where oid='public.hotel_room_rate_occupancy_tiers'::regclass) rls_enabled,
    (select count(*)=2 from pg_policies where schemaname='public'
      and tablename in ('hotel_calendar_overrides','hotel_room_rate_occupancy_tiers')
      and cmd='SELECT' and roles=array['authenticated']::name[]
      and lower(coalesce(qual,'')) like '%is_current_user_admin%') admin_select_policies,
    (select count(*)=2 from pg_policies where schemaname='public'
      and tablename in ('hotel_calendar_overrides','hotel_room_rate_occupancy_tiers')) exact_policy_count,
    not has_table_privilege('anon','public.hotel_calendar_overrides','SELECT')
      and not has_table_privilege('anon','public.hotel_room_rate_occupancy_tiers','SELECT')
      and has_table_privilege('authenticated','public.hotel_calendar_overrides','SELECT')
      and has_table_privilege('authenticated','public.hotel_room_rate_occupancy_tiers','SELECT')
      and not has_table_privilege('authenticated','public.hotel_calendar_overrides','INSERT')
      and not has_table_privilege('authenticated','public.hotel_calendar_overrides','UPDATE')
      and not has_table_privilege('authenticated','public.hotel_calendar_overrides','DELETE')
      and not has_table_privilege('authenticated','public.hotel_room_rate_occupancy_tiers','INSERT')
      and not has_table_privilege('authenticated','public.hotel_room_rate_occupancy_tiers','UPDATE')
      and not has_table_privilege('authenticated','public.hotel_room_rate_occupancy_tiers','DELETE') raw_writes_denied
),
rpc_contract as (
  select
    count(*)=3 rpc_count,
    count(*) filter(where procedure_info.prosecdef and coalesce(procedure_info.proconfig,'{}'::text[]) @> array['search_path=pg_catalog, public, auth']::text[])=3 safe_definers,
    count(*) filter(where has_function_privilege('authenticated',procedure_info.oid,'EXECUTE')
      and not has_function_privilege('anon',procedure_info.oid,'EXECUTE')
      and not has_function_privilege('service_role',procedure_info.oid,'EXECUTE'))=3 exact_grants,
    bool_and(case when procedure_info.proname='hotel_v2_admin_apply_calendar_plan' then
      pg_get_functiondef(procedure_info.oid) like '%Complete read/shape/ownership/version preflight%'
      and pg_get_functiondef(procedure_info.oid) like '%hotels_v2_h2b_stale_calendar_snapshot%'
      and pg_get_functiondef(procedure_info.oid) like '%hotel_activity_log%'
      and pg_get_functiondef(procedure_info.oid) like '%equal_priority_rate_rule_overlap%'
      else true end) atomic_apply_contract,
    bool_and(case when procedure_info.proname='hotel_v2_admin_resolve_rate' then
      pg_get_functiondef(procedure_info.oid) like '%missing_occupancy_los_tier%'
      and pg_get_functiondef(procedure_info.oid) like '%rule.weekdays @> array[1,2,3,4,5,6,7]::smallint[]%'
      and pg_get_functiondef(procedure_info.oid) like '%exact_override.expires_at%'
      else true end) resolver_contract,
    bool_and(case when procedure_info.proname='hotel_v2_admin_get_calendar' then
      pg_get_functiondef(procedure_info.oid) like '%effective_cells%'
      and pg_get_functiondef(procedure_info.oid) like '%snapshot_token%'
      and pg_get_functiondef(procedure_info.oid) like '%snapshot_valid_until%'
      and pg_get_functiondef(procedure_info.oid) like '%expires_at is null or exact_override.expires_at > v_as_of%'
      and pg_get_functiondef(procedure_info.oid) like '%expires_at is null or inventory.expires_at > v_as_of%'
      else true end) calendar_contract
  from pg_proc procedure_info join pg_namespace namespace_info on namespace_info.oid=procedure_info.pronamespace
  where namespace_info.nspname='public' and procedure_info.proname in (
    'hotel_v2_admin_resolve_rate','hotel_v2_admin_get_calendar','hotel_v2_admin_apply_calendar_plan'
  )
),
helper_contract as (
  select
    count(*)=2 helper_count,
    count(*) filter(where not procedure_info.prosecdef
      and coalesce(procedure_info.proconfig,'{}'::text[]) @> array['search_path=pg_catalog, public']::text[])=2 safe_invokers,
    count(*) filter(where
      not has_function_privilege('anon',procedure_info.oid,'EXECUTE')
      and not has_function_privilege('authenticated',procedure_info.oid,'EXECUTE')
      and not has_function_privilege('service_role',procedure_info.oid,'EXECUTE'))=2 direct_execute_denied,
    exists(select 1 from pg_trigger where tgrelid='public.hotel_room_rate_occupancy_tiers'::regclass
      and tgname='hotel_room_rate_occupancy_tiers_capacity_guard' and not tgisinternal
      and tgfoid=to_regprocedure('public.hotel_v2_h2b_validate_occupancy_tier_contract()'))
      occupancy_trigger_exact,
    exists(select 1 from pg_trigger where tgrelid='public.hotel_room_types'::regclass
      and tgname='hotel_room_types_occupancy_tier_capacity_guard' and not tgisinternal
      and tgfoid=to_regprocedure('public.hotel_v2_h2b_guard_room_capacity_against_tiers()'))
      room_capacity_trigger_exact
  from pg_proc procedure_info join pg_namespace namespace_info on namespace_info.oid=procedure_info.pronamespace
  where namespace_info.nspname='public' and procedure_info.proname in (
    'hotel_v2_h2b_validate_occupancy_tier_contract','hotel_v2_h2b_guard_room_capacity_against_tiers'
  )
),
h1a_security as (
  select
    (select relrowsecurity from pg_class where oid='public.hotel_bookings'::regclass) booking_rls_enabled,
    not exists(select 1 from pg_policies policy_info where policy_info.schemaname='public' and policy_info.tablename='hotel_bookings'
      and policy_info.roles @> array['authenticated']::name[] and policy_info.cmd in ('SELECT','ALL')
      and replace(lower(coalesce(policy_info.qual,'')),' ','') in ('true','(true)')) broad_select_removed,
    to_regprocedure('public.customer_get_hotel_bookings(integer)') is not null customer_bridge_present,
    to_regprocedure('public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)') is not null partner_bridge_present,
    exists(select 1 from pg_proc procedure_info
      where procedure_info.oid=to_regprocedure('public.customer_get_hotel_bookings(integer)')
        and procedure_info.prosecdef
        and coalesce(procedure_info.proconfig,'{}'::text[]) @> array['search_path=pg_catalog, public']::text[]
    ) customer_bridge_hardened,
    exists(select 1 from pg_proc procedure_info
      where procedure_info.oid=to_regprocedure('public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)')
        and procedure_info.prosecdef and procedure_info.provolatile='s'
        and coalesce(procedure_info.proconfig,'{}'::text[]) @> array['search_path=pg_catalog, public']::text[]
    ) partner_bridge_hardened,
    coalesce(has_function_privilege('authenticated',to_regprocedure('public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)'),'EXECUTE'),false)
      and not coalesce(has_function_privilege('anon',to_regprocedure('public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)'),'EXECUTE'),false)
      and not coalesce(has_function_privilege('service_role',to_regprocedure('public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)'),'EXECUTE'),false)
      partner_bridge_grants_exact,
    coalesce(has_function_privilege('authenticated',to_regprocedure('public.customer_get_hotel_bookings(integer)'),'EXECUTE'),false)
      and not coalesce(has_function_privilege('anon',to_regprocedure('public.customer_get_hotel_bookings(integer)'),'EXECUTE'),false)
      and not coalesce(has_function_privilege('service_role',to_regprocedure('public.customer_get_hotel_bookings(integer)'),'EXECUTE'),false)
      customer_bridge_grants_exact
),
expected_properties as (
  select array[
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid,
    'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1'::uuid
  ] property_ids
),
oracle as (
  select
    case when properties.protected_fingerprint='b3e3a9c5bda72a83e49d3095d175ab9c'
          and seven_arches.property_count=1 and seven_arches.expected_model_count=1
          and seven_arches.pricing_rule_count=63
          and replay.replay_case_count=70 and replay.mismatch_count=0
      then 0 else 1 end hotel_7_arches_occupancy_price_mismatch,
    case when properties.protected_fingerprint='b3e3a9c5bda72a83e49d3095d175ab9c'
      then 0 else 1 end hotel_legacy_price_mismatch,
    case when properties.protected_fingerprint='b3e3a9c5bda72a83e49d3095d175ab9c'
      then 0 else 1 end hotel_legacy_public_mismatch,
    case when bookings.fingerprint='fb5a4c508b0df32afbffe5b1594c7a50'
          and fulfillments.fingerprint='1e01541853d87d26adccb8172074934b'
          and relationships.deposit_fingerprint='42b5e1dc9726890e90014c3e89c2329d'
          and relationships.coupon_fingerprint='d41d8cd98f00b204e9800998ecf8427e'
      then 0 else 1 end hotel_booking_payload_unexplained_difference
  from properties cross join bookings cross join fulfillments cross join relationships
  cross join seven_arches_source seven_arches cross join seven_arches_replay_oracle replay
)
select
  properties.property_count,properties.legacy_count,properties.rooms_v2_count,
  properties.protected_fingerprint as protected_property_fingerprint,
  rows.room_type_count,rows.room_rate_count,rows.rate_rule_count,rows.daily_inventory_count,rows.daily_rate_count,
  rows.calendar_override_count,rows.occupancy_tier_count,
  bookings.booking_count,bookings.fingerprint as booking_fingerprint,
  fulfillments.fulfillment_count as hotel_fulfillment_count,fulfillments.fingerprint as fulfillment_fingerprint,
  relationships.deposit_fingerprint,relationships.coupon_fingerprint,
  seven_arches.pricing_rule_count as seven_arches_pricing_rule_count,
  replay.replay_case_count as seven_arches_replay_case_count,
  replay.mismatch_count as seven_arches_replay_mismatch_count,
  flags.flags_off_count,
  columns.calendar_override_exact_columns,columns.occupancy_tier_exact_columns,columns.inventory_metadata_columns,
  constraints.activity_entities_extended,constraints.activity_actions_extended,
  rls.rls_enabled,rls.admin_select_policies,rls.exact_policy_count,rls.raw_writes_denied,
  rpc.rpc_count,rpc.safe_definers,rpc.exact_grants,rpc.atomic_apply_contract,rpc.resolver_contract,rpc.calendar_contract,
  helpers.helper_count,helpers.safe_invokers,helpers.direct_execute_denied,
  helpers.occupancy_trigger_exact,helpers.room_capacity_trigger_exact,
  security.booking_rls_enabled,security.broad_select_removed,security.customer_bridge_present,security.partner_bridge_present,
  security.customer_bridge_hardened,security.customer_bridge_grants_exact,
  security.partner_bridge_hardened,security.partner_bridge_grants_exact,
  oracle.hotel_7_arches_occupancy_price_mismatch as "HOTEL_7_ARCHES_OCCUPANCY_PRICE_MISMATCH",
  oracle.hotel_legacy_price_mismatch as "HOTEL_LEGACY_PRICE_MISMATCH",
  oracle.hotel_legacy_public_mismatch as "HOTEL_LEGACY_PUBLIC_MISMATCH",
  oracle.hotel_booking_payload_unexplained_difference as "HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE",
  (
    properties.property_count=2 and properties.legacy_count=2 and properties.rooms_v2_count=0
    and properties.property_ids=expected.property_ids
    and properties.protected_fingerprint='b3e3a9c5bda72a83e49d3095d175ab9c'
    and flags.settings_count=1 and flags.flags_off_count=1
    and rows.calendar_override_count=0 and rows.occupancy_tier_count=0
    and bookings.booking_count=3 and bookings.fingerprint='fb5a4c508b0df32afbffe5b1594c7a50'
    and fulfillments.fulfillment_count=5 and fulfillments.fingerprint='1e01541853d87d26adccb8172074934b'
    and relationships.deposit_fingerprint='42b5e1dc9726890e90014c3e89c2329d'
    and relationships.coupon_fingerprint='d41d8cd98f00b204e9800998ecf8427e'
    and seven_arches.property_count=1 and seven_arches.expected_model_count=1 and seven_arches.pricing_rule_count=63
    and replay.replay_case_count=70 and replay.mismatch_count=0
    and columns.calendar_override_exact_columns and columns.occupancy_tier_exact_columns
    and columns.inventory_metadata_columns and columns.rule_metadata_columns and columns.daily_rate_source_column
    and constraints.calendar_override_constraints and constraints.occupancy_tier_constraints
    and constraints.exact_property_fk_support and constraints.inventory_audit_constraint and constraints.weekdays_unique_constraint
    and constraints.occupancy_capacity_trigger and constraints.room_capacity_trigger
    and constraints.activity_entities_extended and constraints.activity_actions_extended
    and rls.rls_enabled and rls.admin_select_policies and rls.exact_policy_count and rls.raw_writes_denied
    and rpc.rpc_count and rpc.safe_definers and rpc.exact_grants
    and rpc.atomic_apply_contract and rpc.resolver_contract and rpc.calendar_contract
    and helpers.helper_count and helpers.safe_invokers and helpers.direct_execute_denied
    and helpers.occupancy_trigger_exact and helpers.room_capacity_trigger_exact
    and security.booking_rls_enabled and security.broad_select_removed
    and security.customer_bridge_present and security.partner_bridge_present
    and security.customer_bridge_hardened and security.customer_bridge_grants_exact
    and security.partner_bridge_hardened and security.partner_bridge_grants_exact
    and oracle.hotel_7_arches_occupancy_price_mismatch=0
    and oracle.hotel_legacy_price_mismatch=0
    and oracle.hotel_legacy_public_mismatch=0
    and oracle.hotel_booking_payload_unexplained_difference=0
  ) hotels_v2_h2b_foundation_safe
from properties cross join expected_properties expected cross join flags cross join row_state rows
cross join column_contract columns cross join constraint_contract constraints cross join rls_contract rls
cross join rpc_contract rpc cross join helper_contract helpers cross join h1a_security security cross join bookings cross join fulfillments
cross join relationships cross join seven_arches_source seven_arches
cross join seven_arches_replay_oracle replay cross join oracle;
