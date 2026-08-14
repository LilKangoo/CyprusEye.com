-- READ ONLY. Run immediately after
-- 20260811270000_hotels_v2_h2b1_reviewed_rate_plan_preservation.sql and before
-- the final reviewed Admin Save.
with
constants as (
  select
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid hotel_id,
    'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid upper_id,
    '825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid ground_id,
    '22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid plan_id,
    array[
      'air_conditioning','balcony','coffee_maker','electric_bike','kitchen',
      'mountain_view','non_smoking','parking','private_bathroom','terrace','wifi'
    ]::text[] upper_expected,
    array[
      'air_conditioning','coffee_maker','electric_bike','kitchen','mountain_view',
      'non_smoking','parking','private_bathroom','terrace','tv','wifi'
    ]::text[] ground_expected
),
rpc as (
  select
    pg_get_functiondef('public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure) definition,
    (select prosecdef from pg_proc where oid=
      'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure) security_definer,
    coalesce((select proconfig @> array['search_path=pg_catalog, public, auth']
      from pg_proc where oid=
      'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure),false) safe_search_path
),
property_state as (
  select
    count(*)::integer property_count,
    count(*) filter(where architecture_version='legacy')::integer legacy_count,
    max(children_policy) children_policy,
    max(minimum_child_age) minimum_child_age,
    max(case when jsonb_typeof(photos)='array' then jsonb_array_length(photos) end)::integer photo_count,
    max(case when jsonb_typeof(pricing_tiers->'rules')='array'
      then jsonb_array_length(pricing_tiers->'rules') end)::integer pricing_rule_count
  from public.hotels cross join constants where id=constants.hotel_id
),
room_state as (
  select
    count(*)::integer room_count,
    count(*) filter(where room.id in (constants.upper_id,constants.ground_id))::integer exact_room_count,
    count(*) filter(where room.id not in (constants.upper_id,constants.ground_id))::integer unexpected_room_count,
    max(room.version) filter(where room.id=constants.upper_id) upper_version,
    (jsonb_agg(room.gallery) filter(where room.id=constants.upper_id))->0 upper_gallery,
    (jsonb_agg(to_jsonb(room.amenities)) filter(where room.id=constants.upper_id))->0 upper_current_json,
    max(room.version) filter(where room.id=constants.ground_id) ground_version,
    (jsonb_agg(room.gallery) filter(where room.id=constants.ground_id))->0 ground_gallery,
    (jsonb_agg(to_jsonb(room.amenities)) filter(where room.id=constants.ground_id))->0 ground_current_json
  from public.hotel_room_types room cross join constants
  where room.hotel_id=constants.hotel_id
),
plan_state as (
  select
    count(*)::integer plan_count,
    max(plan.version) version,
    max(plan.updated_at) updated_at,
    jsonb_agg(plan.cancellation_policy)->0 cancellation_policy,
    count(*) filter(where plan.hotel_id=constants.hotel_id and plan.code='standard'
      and not plan.is_active and plan.version=2
      and plan.cancellation_policy='{"type":"non_refundable"}'::jsonb
      and public.hotel_v2_h2a_cancellation_policy_is_valid(plan.cancellation_policy)
    )::integer preserved_production_plan_count,
    md5(coalesce(string_agg(to_jsonb(plan)::text,'|' order by plan.id),'')) fingerprint
  from public.hotel_rate_plans plan cross join constants where plan.id=constants.plan_id
),
graph_state as (
  select
    (select count(*) from public.hotel_room_rates room_rate where room_rate.id in (
      '7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid,
      '3320590d-632d-423f-80d0-fd021cba7293'::uuid
    ) and room_rate.hotel_id=constants.hotel_id and room_rate.rate_plan_id=constants.plan_id
      and not room_rate.is_active)::integer inactive_rate_count,
    (select count(*) from public.hotel_pricing_schedules schedule where schedule.id in (
      'b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid,
      '443065c0-984a-5de3-a22a-d03042c41107'::uuid
    ) and schedule.hotel_id=constants.hotel_id and not schedule.is_active
      and schedule.review_status='requires_review')::integer inert_schedule_count
  from constants
),
flags as (
  select count(*) filter(where id=1 and not hotel_rooms_v2_enabled
    and not hotel_external_sync_enabled and not hotel_instant_booking_enabled
    and not hotel_stripe_connect_enabled)::integer all_off_count
  from public.site_settings
),
history as (
  select
    (select count(*)::integer from public.hotel_bookings) booking_count,
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
      from public.hotel_bookings row_value) booking_fingerprint,
    (select count(*)::integer from public.partner_service_fulfillments
      where resource_type='hotels') fulfillment_count,
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
      from public.partner_service_fulfillments row_value
      where row_value.resource_type='hotels') fulfillment_fingerprint
)
select
  md5(rpc.definition) definition_fingerprint,
  room_state.upper_version,
  room_state.upper_gallery,
  room_state.upper_current_json upper_current_amenities,
  room_state.ground_version,
  room_state.ground_gallery,
  room_state.ground_current_json ground_current_amenities,
  plan_state.version rate_plan_version,
  plan_state.updated_at rate_plan_updated_at,
  plan_state.cancellation_policy,
  plan_state.fingerprint rate_plan_fingerprint,
  history.booking_count,history.booking_fingerprint,
  history.fulfillment_count,history.fulfillment_fingerprint,
  (
    rpc.definition like '%hotels_v2_h2b1_preserve_reviewed_rate_plan_v1%'
    and rpc.definition like '%hotel_v2_h2a_cancellation_policy_is_valid%'
    and rpc.definition like '%hotels_v2_h2b1_shadow_room_three_way_conflict%'
    and rpc.definition not like '%cancellation_policy->>''type'' from public.hotel_rate_plans where id=c_plan)<>''requires_review''%'
    and rpc.security_definer and rpc.safe_search_path
    and not has_function_privilege('anon',
      'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)','EXECUTE')
    and not has_function_privilege('service_role',
      'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)','EXECUTE')
    and has_function_privilege('authenticated',
      'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)','EXECUTE')
    and property_state.property_count=1 and property_state.legacy_count=1
    and property_state.children_policy='minimum_age' and property_state.minimum_child_age=15
    and property_state.photo_count=9 and property_state.pricing_rule_count=63
    and room_state.room_count=2 and room_state.exact_room_count=2 and room_state.unexpected_room_count=0
    and room_state.upper_version=4 and room_state.ground_version=5
    and room_state.upper_gallery='[]'::jsonb and room_state.ground_gallery='[]'::jsonb
    and room_state.upper_current_json=to_jsonb(constants.upper_expected)
    and room_state.ground_current_json=to_jsonb(constants.ground_expected)
    and plan_state.plan_count=1 and plan_state.preserved_production_plan_count=1
    and graph_state.inactive_rate_count=2 and graph_state.inert_schedule_count=2
    and flags.all_off_count=1
    and history.booking_count=3 and history.booking_fingerprint='fb5a4c508b0df32afbffe5b1594c7a50'
    and history.fulfillment_count=5 and history.fulfillment_fingerprint='1e01541853d87d26adccb8172074934b'
  ) hotels_v2_h2b1_reviewed_rate_plan_preservation_safe
from constants cross join rpc cross join property_state cross join room_state
cross join plan_state cross join graph_state cross join flags cross join history;
