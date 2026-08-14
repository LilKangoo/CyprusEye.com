-- READ ONLY. Run immediately after
-- 20260811280000_hotels_v2_h2b2_shadow_property_policy_preservation.sql.
-- This verifies the repaired RPC and the unchanged accepted production graph.
with
constants as (
  select
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid hotel_id,
    'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid upper_id,
    '825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid ground_id,
    '22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid plan_id,
    '7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid upper_rate_id,
    '3320590d-632d-423f-80d0-fd021cba7293'::uuid ground_rate_id,
    'b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid room_schedule_id,
    '443065c0-984a-5de3-a22a-d03042c41107'::uuid party_schedule_id
),
rpc as (
  select
    count(*)::integer function_count,
    count(*) filter(where procedure_info.prosecdef)::integer security_definer_count,
    count(*) filter(where procedure_info.provolatile='v')::integer volatile_count,
    count(*) filter(where procedure_info.proconfig @> array['search_path=pg_catalog, public, auth'])::integer safe_search_path_count,
    count(*) filter(where
      pg_get_functiondef(procedure_info.oid) like '%hotels_v2_h2b2_preserve_reviewed_property_policy_v1%'
      and pg_get_functiondef(procedure_info.oid) like '%hotels_v2_h2b2_shadow_property_policy_mismatch%'
      and pg_get_functiondef(procedure_info.oid) like '%hotels_v2_h2b1_preserve_reviewed_rate_plan_v1%'
      and pg_get_functiondef(procedure_info.oid) like '%hotels_v2_h2b1_shadow_room_three_way_conflict%'
      and pg_get_functiondef(procedure_info.oid) like '%hotels_v2_h2b1_stale_property_policy%'
      and pg_get_functiondef(procedure_info.oid) not like '%update public.hotels set children_policy=''minimum_age'',minimum_child_age=10%'
      and pg_get_functiondef(procedure_info.oid) not like '%hotels_v2_h2b1_seven_arches_child_policy_mismatch%'
    )::integer repaired_body_count,
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
property_state as (
  select count(*)::integer property_count,
    count(*) filter(where architecture_version='legacy')::integer legacy_count,
    max(children_policy) children_policy,max(minimum_child_age) minimum_child_age,
    max(updated_at) updated_at,
    max(jsonb_array_length(photos))::integer photo_count,
    max(jsonb_array_length(pricing_tiers->'rules'))::integer pricing_rule_count
  from public.hotels cross join constants where id=constants.hotel_id
),
room_state as (
  select count(*)::integer room_count,
    count(*) filter(where room.id in (constants.upper_id,constants.ground_id))::integer exact_room_count,
    count(*) filter(where room.id not in (constants.upper_id,constants.ground_id))::integer unexpected_room_count,
    max(room.children_policy_override) filter(where room.id=constants.upper_id) upper_policy_override,
    max(room.minimum_child_age_override) filter(where room.id=constants.upper_id) upper_minimum_age_override,
    max(room.version) filter(where room.id=constants.upper_id) upper_version,
    max(room.updated_at) filter(where room.id=constants.upper_id) upper_updated_at,
    max(room.status) filter(where room.id=constants.upper_id) upper_status,
    max(jsonb_array_length(room.gallery)) filter(where room.id=constants.upper_id) upper_gallery_count,
    (jsonb_agg(to_jsonb(room.amenities)) filter(where room.id=constants.upper_id))->0 upper_amenities,
    max(room.children_policy_override) filter(where room.id=constants.ground_id) ground_policy_override,
    max(room.minimum_child_age_override) filter(where room.id=constants.ground_id) ground_minimum_age_override,
    max(room.version) filter(where room.id=constants.ground_id) ground_version,
    max(room.updated_at) filter(where room.id=constants.ground_id) ground_updated_at,
    max(room.status) filter(where room.id=constants.ground_id) ground_status,
    max(jsonb_array_length(room.gallery)) filter(where room.id=constants.ground_id) ground_gallery_count,
    (jsonb_agg(to_jsonb(room.amenities)) filter(where room.id=constants.ground_id))->0 ground_amenities,
    count(*) filter(where exists(select 1 from jsonb_array_elements(room.gallery) room_photo
      where not exists(select 1 from public.hotels property,
        jsonb_array_elements(property.photos) property_photo
        where property.id=room.hotel_id and property_photo.value=room_photo.value)))::integer foreign_gallery_room_count
  from public.hotel_room_types room cross join constants where room.hotel_id=constants.hotel_id
),
graph_state as (
  select
    (select count(*) from public.hotel_rate_plans plan
      where plan.id=constants.plan_id and plan.hotel_id=constants.hotel_id
        and lower(btrim(plan.code))='standard' and not plan.is_active
        and plan.cancellation_policy='{"type":"non_refundable"}'::jsonb)::integer exact_plan_count,
    (select count(*) from public.hotel_room_rates room_rate
      where room_rate.id in (constants.upper_rate_id,constants.ground_rate_id)
        and room_rate.hotel_id=constants.hotel_id and room_rate.rate_plan_id=constants.plan_id
        and not room_rate.is_active)::integer inactive_rate_count,
    (select count(*) from public.hotel_pricing_schedules schedule
      where schedule.id in (constants.room_schedule_id,constants.party_schedule_id)
        and schedule.hotel_id=constants.hotel_id and not schedule.is_active
        and schedule.review_status='requires_review')::integer inert_schedule_count,
    (select count(*) from public.hotel_pricing_schedule_occupancy_tiers tier
      where tier.schedule_id=constants.room_schedule_id)::integer room_tier_count,
    (select count(*) from public.hotel_pricing_schedule_occupancy_tiers tier
      where tier.schedule_id=constants.party_schedule_id)::integer party_tier_count
  from constants
),
flags as (
  select count(*) filter(where id=1 and not hotel_rooms_v2_enabled
    and not hotel_external_sync_enabled and not hotel_instant_booking_enabled
    and not hotel_stripe_connect_enabled)::integer all_off_count from public.site_settings
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
evaluated as (
  select *,
    case when room_state.upper_policy_override is null then property_state.children_policy
      else room_state.upper_policy_override end upper_effective_policy,
    case when room_state.upper_policy_override is null then property_state.minimum_child_age
      else room_state.upper_minimum_age_override end upper_effective_minimum_age,
    case when room_state.ground_policy_override is null then property_state.children_policy
      else room_state.ground_policy_override end ground_effective_policy,
    case when room_state.ground_policy_override is null then property_state.minimum_child_age
      else room_state.ground_minimum_age_override end ground_effective_minimum_age
  from rpc cross join property_state cross join room_state cross join graph_state cross join flags cross join history
)
select
  definition_fingerprint,updated_at property_updated_at,
  children_policy property_children_policy,minimum_child_age property_minimum_child_age,
  upper_policy_override,upper_minimum_age_override,upper_effective_policy,upper_effective_minimum_age,
  upper_version,upper_updated_at,upper_status,upper_gallery_count,upper_amenities,
  ground_policy_override,ground_minimum_age_override,ground_effective_policy,ground_effective_minimum_age,
  ground_version,ground_updated_at,ground_status,ground_gallery_count,ground_amenities,
  booking_count,booking_fingerprint,fulfillment_count,fulfillment_fingerprint,
  (
    function_count=1 and security_definer_count=1 and volatile_count=1
    and safe_search_path_count=1 and repaired_body_count=1 and exact_grant_count=1
    and property_count=1 and legacy_count=1 and photo_count=9 and pricing_rule_count=63
    and public.hotel_v2_h2b1_children_policy_valid(children_policy,minimum_child_age,false)
    and room_count=2 and exact_room_count=2 and unexpected_room_count=0
    and upper_effective_policy='minimum_age' and upper_effective_minimum_age=15
    and ground_effective_policy='minimum_age' and ground_effective_minimum_age=15
    and ((children_policy='minimum_age' and minimum_child_age=15
      and upper_policy_override is null and upper_minimum_age_override is null
      and ground_policy_override is null and ground_minimum_age_override is null)
      or (children_policy='minimum_age' and minimum_child_age=10
      and upper_policy_override='minimum_age' and upper_minimum_age_override=15
      and ground_policy_override='minimum_age' and ground_minimum_age_override=15))
    and upper_status='active' and ground_status='active'
    and upper_gallery_count=6 and ground_gallery_count=5 and foreign_gallery_room_count=0
    and upper_amenities=to_jsonb(array['air_conditioning','balcony','terrace']::text[])
    and ground_amenities=to_jsonb(array['air_conditioning','terrace']::text[])
    and exact_plan_count=1 and inactive_rate_count=2 and inert_schedule_count=2
    and room_tier_count=27 and party_tier_count=63 and all_off_count=1
    and booking_count=3 and booking_fingerprint='fb5a4c508b0df32afbffe5b1594c7a50'
    and fulfillment_count=5 and fulfillment_fingerprint='1e01541853d87d26adccb8172074934b'
  ) hotels_v2_h2b2_policy_preservation_safe
from evaluated;
