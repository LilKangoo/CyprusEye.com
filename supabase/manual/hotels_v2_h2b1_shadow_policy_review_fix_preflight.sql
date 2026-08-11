-- Hotels 2.0 H2B.1 reviewed-policy repair preflight.
-- READ ONLY. Run immediately before 20260811250000. Returns one summary row.

with
rpc as (
  select
    count(*)::integer function_count,
    count(*) filter(where procedure_info.prosecdef)::integer security_definer_count,
    count(*) filter(where procedure_info.provolatile='v')::integer volatile_count,
    count(*) filter(where procedure_info.proconfig @> array['search_path=pg_catalog, public, auth'])::integer safe_search_path_count,
    count(*) filter(where
      (
        (pg_get_functiondef(procedure_info.oid) like '%hotels_v2_h2b1_guest_policy_already_reviewed%'
          and pg_get_functiondef(procedure_info.oid) not like '%expected_property_policy%')
        or
        (pg_get_functiondef(procedure_info.oid) not like '%hotels_v2_h2b1_guest_policy_already_reviewed%'
          and pg_get_functiondef(procedure_info.oid) like '%expected_property_policy%'
          and pg_get_functiondef(procedure_info.oid) like '%hotels_v2_h2b1_stale_property_policy%')
      )
      and pg_get_functiondef(procedure_info.oid) like '%hotels_v2_h2b1_unexpected_existing_room_type%'
      and pg_get_functiondef(procedure_info.oid) like '%All apartments are air-conditioned%'
      and pg_get_functiondef(procedure_info.oid) like '%perform public.hotel_v2_h2a_require_admin()%'
    )::integer old_or_repaired_contract_count,
    count(*) filter(where has_function_privilege('authenticated',procedure_info.oid,'EXECUTE')
      and not has_function_privilege('anon',procedure_info.oid,'EXECUTE')
      and not has_function_privilege('service_role',procedure_info.oid,'EXECUTE')
      and not exists(select 1
        from aclexplode(coalesce(procedure_info.proacl,acldefault('f',procedure_info.proowner))) privilege
        where privilege.grantee=0 and privilege.privilege_type='EXECUTE')
    )::integer exact_grant_count,
    max(md5(pg_get_functiondef(procedure_info.oid))) definition_fingerprint
  from pg_proc procedure_info
  join pg_namespace function_schema on function_schema.oid=procedure_info.pronamespace
  where function_schema.nspname='public'
    and procedure_info.proname='hotel_v2_admin_prepare_legacy_shadow_rooms'
    and pg_get_function_identity_arguments(procedure_info.oid)='p_plan jsonb, p_correlation_id uuid'
),
property as (
  select count(*)::integer property_count,
    count(*) filter(where architecture_version='legacy')::integer legacy_count,
    count(*) filter(where children_policy is null
      or (children_policy in ('allowed','not_allowed') and minimum_child_age is null)
      or (children_policy='minimum_age' and minimum_child_age between 0 and 17)
    )::integer valid_policy_count,
    max(children_policy) children_policy,
    max(minimum_child_age) minimum_child_age,
    max(updated_at) updated_at,
    max(case when jsonb_typeof(photos)='array' then jsonb_array_length(photos) end)::integer photo_count,
    max(case when jsonb_typeof(pricing_tiers->'rules')='array'
      then jsonb_array_length(pricing_tiers->'rules') end)::integer pricing_rule_count,
    count(*) filter(where pricing_model='tiered_by_nights' and max_persons=8
      and coalesce(description->>'en','') like '%All apartments are air-conditioned%'
      and coalesce(description->>'en','') like '%accepts children from 10 years old%'
      and coalesce(description->>'en','') like '%For bookings above 4 people%2 apartments%'
      and coalesce(amenities,'[]'::jsonb) @> '["air_conditioning","terrace","balcony"]'::jsonb
      and jsonb_typeof(photos)='array' and jsonb_array_length(photos)=9
      and jsonb_typeof(pricing_tiers->'rules')='array' and jsonb_array_length(pricing_tiers->'rules')=63
    )::integer source_contract_count
  from public.hotels
  where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
),
rooms as (
  select count(*)::integer room_count,
    count(*) filter(where id in (
      'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid,
      '825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid
    ))::integer deterministic_room_count,
    count(*) filter(where id not in (
      'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid,
      '825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid
    ))::integer unexpected_room_count,
    count(*) filter(where status in ('draft','active')
      and max_occupancy=4 and capacity_adults is null and capacity_children is null
      and inventory_mode='pooled' and base_inventory_count=1)::integer safe_room_count,
    coalesce(jsonb_agg(jsonb_build_object(
      'id',id,'version',version,'status',status,
      'gallery_count',case when jsonb_typeof(gallery)='array' then jsonb_array_length(gallery) end,
      'legacy_source_key',legacy_source_key,'updated_at',updated_at
    ) order by id) filter(where id is not null),'[]'::jsonb) room_state
  from public.hotel_room_types
  where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
),
plans as (
  select count(*)::integer plan_count,
    count(*) filter(where not is_active and cancellation_policy->>'type'='requires_review')::integer inert_plan_count
  from public.hotel_rate_plans
  where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
    and id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid
),
rates as (
  select count(*)::integer rate_count,
    count(*) filter(where not is_active and pricing_schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid)::integer inert_rate_count
  from public.hotel_room_rates
  where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
    and id in (
      '7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid,
      '3320590d-632d-423f-80d0-fd021cba7293'::uuid
    )
),
schedules as (
  select count(*)::integer schedule_count,
    count(*) filter(where not is_active and review_status='requires_review' and source='legacy_preview')::integer inert_schedule_count,
    (select count(*)::integer from public.hotel_pricing_schedule_occupancy_tiers tier
      where tier.schedule_id in (
        'b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid,
        '443065c0-984a-5de3-a22a-d03042c41107'::uuid
      ) and tier.is_active) active_tier_count
  from public.hotel_pricing_schedules
  where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
    and id in (
      'b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid,
      '443065c0-984a-5de3-a22a-d03042c41107'::uuid
    )
),
flags as (
  select count(*)::integer settings_count,
    count(*) filter(where not hotel_rooms_v2_enabled and not hotel_external_sync_enabled
      and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled)::integer flags_off_count
  from public.site_settings
),
history as (
  select
    (select count(*)::integer from public.hotel_bookings) booking_count,
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
      from public.hotel_bookings row_value) booking_fingerprint,
    (select count(*)::integer from public.partner_service_fulfillments where resource_type='hotels') fulfillment_count,
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
      from public.partner_service_fulfillments row_value where row_value.resource_type='hotels') fulfillment_fingerprint
),
protected as (
  select jsonb_build_object(
    'hotels',(select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),'')) from public.hotels row_value),
    'room_types',(select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),'')) from public.hotel_room_types row_value),
    'rate_plans',(select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),'')) from public.hotel_rate_plans row_value),
    'room_rates',(select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),'')) from public.hotel_room_rates row_value),
    'pricing_schedules',(select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),'')) from public.hotel_pricing_schedules row_value),
    'pricing_schedule_tiers',(select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),'')) from public.hotel_pricing_schedule_occupancy_tiers row_value),
    'activity',(select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),'')) from public.hotel_activity_log row_value),
    'settings',(select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),'')) from public.site_settings row_value)
  ) fingerprints
)
select
  property.property_count,property.legacy_count,property.children_policy,property.minimum_child_age,
  property.updated_at,property.photo_count,property.pricing_rule_count,property.source_contract_count,
  rooms.room_count,rooms.deterministic_room_count,rooms.unexpected_room_count,rooms.safe_room_count,rooms.room_state,
  plans.plan_count,plans.inert_plan_count,rates.rate_count,rates.inert_rate_count,
  schedules.schedule_count,schedules.inert_schedule_count,schedules.active_tier_count,
  flags.flags_off_count,
  rpc.function_count,rpc.security_definer_count,rpc.volatile_count,rpc.safe_search_path_count,
  rpc.old_or_repaired_contract_count,rpc.exact_grant_count,rpc.definition_fingerprint,
  history.booking_count,history.booking_fingerprint,history.fulfillment_count,history.fulfillment_fingerprint,
  protected.fingerprints as protected_fingerprints,
  (
    property.property_count=1 and property.legacy_count=1 and property.valid_policy_count=1
    and property.source_contract_count=1 and property.photo_count=9 and property.pricing_rule_count=63
    and rooms.unexpected_room_count=0
    and (
      (rooms.room_count=0 and plans.plan_count=0 and rates.rate_count=0
        and schedules.schedule_count=0 and schedules.active_tier_count=0)
      or
      (rooms.room_count=2 and rooms.deterministic_room_count=2 and rooms.safe_room_count=2
        and plans.plan_count=1 and plans.inert_plan_count=1
        and rates.rate_count=2 and rates.inert_rate_count=2
        and schedules.schedule_count=2 and schedules.inert_schedule_count=2
        and schedules.active_tier_count=90)
    )
    and flags.settings_count=1 and flags.flags_off_count=1
    and rpc.function_count=1 and rpc.security_definer_count=1 and rpc.volatile_count=1
    and rpc.safe_search_path_count=1 and rpc.old_or_repaired_contract_count=1 and rpc.exact_grant_count=1
    and history.booking_count=3 and history.booking_fingerprint='fb5a4c508b0df32afbffe5b1594c7a50'
    and history.fulfillment_count=5 and history.fulfillment_fingerprint='1e01541853d87d26adccb8172074934b'
  ) hotels_v2_h2b1_shadow_policy_review_fix_preflight_safe
from rpc cross join property cross join rooms cross join plans cross join rates
cross join schedules cross join flags cross join history cross join protected;
