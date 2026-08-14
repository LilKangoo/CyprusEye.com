-- READ ONLY. Run immediately before
-- 20260811270000_hotels_v2_h2b1_reviewed_rate_plan_preservation.sql.
-- This is intentionally exact to the accepted 7 Arches production state.
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
    ]::text[] ground_expected,
    array['air_conditioning','balcony','terrace']::text[] upper_target,
    array['air_conditioning','terrace']::text[] ground_target
),
rpc as (
  select
    count(*)::integer function_count,
    count(*) filter(where procedure_info.prosecdef)::integer security_definer_count,
    count(*) filter(where procedure_info.provolatile='v')::integer volatile_count,
    count(*) filter(where procedure_info.proconfig @> array['search_path=pg_catalog, public, auth'])::integer safe_search_path_count,
    count(*) filter(where
      pg_get_functiondef(procedure_info.oid) like '%hotels_v2_h2b1_shadow_room_three_way_conflict%'
      and pg_get_functiondef(procedure_info.oid) like '%expected_original%'
      and pg_get_functiondef(procedure_info.oid) like '%hotels_v2_h2b1_stale_rate_plan%'
      and (
        pg_get_functiondef(procedure_info.oid) like '%cancellation_policy->>''type'' from public.hotel_rate_plans where id=c_plan)<>''requires_review''%'
        or pg_get_functiondef(procedure_info.oid) like '%hotels_v2_h2b1_preserve_reviewed_rate_plan_v1%'
      )
    )::integer old_or_repaired_contract_count,
    count(*) filter(where
      pg_get_functiondef(procedure_info.oid) like '%hotels_v2_h2b1_preserve_reviewed_rate_plan_v1%'
      or strpos(
        pg_get_functiondef(procedure_info.oid),
        $old$       or (select is_active from public.hotel_rate_plans where id=c_plan)
       or (select cancellation_policy->>'type' from public.hotel_rate_plans where id=c_plan)<>'requires_review'
       or (select cancellation_policy->>'reason' from public.hotel_rate_plans where id=c_plan)<>'legacy_cancellation_terms_unconfirmed' then$old$
      )>0
    )::integer exact_rewrite_target_count,
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
  select
    count(*)::integer property_count,
    count(*) filter(where architecture_version='legacy')::integer legacy_count,
    max(children_policy) children_policy,
    max(minimum_child_age) minimum_child_age,
    max(updated_at) updated_at,
    max(case when jsonb_typeof(photos)='array' then jsonb_array_length(photos) end)::integer photo_count,
    max(case when jsonb_typeof(pricing_tiers->'rules')='array'
      then jsonb_array_length(pricing_tiers->'rules') end)::integer pricing_rule_count
  from public.hotels cross join constants
  where id=constants.hotel_id
),
room_state as (
  select
    count(*)::integer room_count,
    count(*) filter(where room.id in (constants.upper_id,constants.ground_id))::integer exact_room_count,
    count(*) filter(where room.id not in (constants.upper_id,constants.ground_id))::integer unexpected_room_count,
    max(room.version) filter(where room.id=constants.upper_id) upper_version,
    max(room.updated_at) filter(where room.id=constants.upper_id) upper_updated_at,
    max(room.status) filter(where room.id=constants.upper_id) upper_status,
    (jsonb_agg(room.gallery) filter(where room.id=constants.upper_id))->0 upper_gallery,
    (jsonb_agg(to_jsonb(room.amenities)) filter(where room.id=constants.upper_id))->0 upper_current_json,
    max(room.version) filter(where room.id=constants.ground_id) ground_version,
    max(room.updated_at) filter(where room.id=constants.ground_id) ground_updated_at,
    max(room.status) filter(where room.id=constants.ground_id) ground_status,
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
    max(plan.code) code,
    bool_or(plan.is_active) is_active,
    jsonb_agg(plan.cancellation_policy)->0 cancellation_policy,
    count(*) filter(where plan.hotel_id=constants.hotel_id and plan.code='standard'
      and not plan.is_active and plan.version=2
      and plan.cancellation_policy='{"type":"non_refundable"}'::jsonb
      and public.hotel_v2_h2a_cancellation_policy_is_valid(plan.cancellation_policy)
    )::integer accepted_production_plan_count,
    md5(coalesce(string_agg(to_jsonb(plan)::text,'|' order by plan.id),'')) fingerprint
  from public.hotel_rate_plans plan cross join constants
  where plan.id=constants.plan_id
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
  rpc.definition_fingerprint,
  property_state.updated_at property_updated_at,
  property_state.children_policy,
  property_state.minimum_child_age,
  room_state.upper_version,
  room_state.upper_updated_at,
  room_state.upper_status,
  room_state.upper_gallery,
  room_state.upper_current_json upper_current_amenities,
  constants.upper_target upper_target_amenities,
  case when room_state.upper_current_json=to_jsonb(constants.upper_target) then 'CURRENT_EQUALS_TARGET_SAFE_NOOP'
    else 'CURRENT_EQUALS_FRESH_ORIGINAL_TARGET_DIFFERS_SAFE_REVIEW' end upper_merge_classification,
  room_state.ground_version,
  room_state.ground_updated_at,
  room_state.ground_status,
  room_state.ground_gallery,
  room_state.ground_current_json ground_current_amenities,
  constants.ground_target ground_target_amenities,
  case when room_state.ground_current_json=to_jsonb(constants.ground_target) then 'CURRENT_EQUALS_TARGET_SAFE_NOOP'
    else 'CURRENT_EQUALS_FRESH_ORIGINAL_TARGET_DIFFERS_SAFE_REVIEW' end ground_merge_classification,
  plan_state.version rate_plan_version,
  plan_state.updated_at rate_plan_updated_at,
  plan_state.code rate_plan_code,
  plan_state.is_active rate_plan_is_active,
  plan_state.cancellation_policy,
  plan_state.fingerprint rate_plan_fingerprint,
  history.booking_count,history.booking_fingerprint,
  history.fulfillment_count,history.fulfillment_fingerprint,
  (
    rpc.function_count=1 and rpc.security_definer_count=1 and rpc.volatile_count=1
    and rpc.safe_search_path_count=1 and rpc.old_or_repaired_contract_count=1
    and rpc.exact_rewrite_target_count=1
    and rpc.exact_grant_count=1
    and property_state.property_count=1 and property_state.legacy_count=1
    and property_state.children_policy='minimum_age' and property_state.minimum_child_age=15
    and property_state.photo_count=9 and property_state.pricing_rule_count=63
    and room_state.room_count=2 and room_state.exact_room_count=2 and room_state.unexpected_room_count=0
    and room_state.upper_version=4 and room_state.ground_version=5
    and room_state.upper_status='active' and room_state.ground_status='active'
    and room_state.upper_gallery='[]'::jsonb and room_state.ground_gallery='[]'::jsonb
    and room_state.upper_current_json=to_jsonb(constants.upper_expected)
    and room_state.ground_current_json=to_jsonb(constants.ground_expected)
    and plan_state.plan_count=1 and plan_state.accepted_production_plan_count=1
    and graph_state.inactive_rate_count=2 and graph_state.inert_schedule_count=2
    and flags.all_off_count=1
    and history.booking_count=3 and history.booking_fingerprint='fb5a4c508b0df32afbffe5b1594c7a50'
    and history.fulfillment_count=5 and history.fulfillment_fingerprint='1e01541853d87d26adccb8172074934b'
  ) hotels_v2_h2b1_reviewed_rate_plan_preservation_preflight_safe
from constants cross join rpc cross join property_state cross join room_state
cross join plan_state cross join graph_state cross join flags cross join history;
