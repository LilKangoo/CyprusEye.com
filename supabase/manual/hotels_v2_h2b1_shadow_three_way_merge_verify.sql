-- READ ONLY. Run after
-- 20260811260000_hotels_v2_h2b1_shadow_three_way_merge.sql.
with
constants as (
  select
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid hotel_id,
    'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid upper_id,
    '825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid ground_id,
    array['air_conditioning','balcony','terrace']::text[] upper_target,
    array['air_conditioning','terrace']::text[] ground_target
),
function_contract as (
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
    count(*) filter(where hotel.id=constants.hotel_id)::integer property_count,
    count(*) filter(where hotel.id=constants.hotel_id and hotel.architecture_version='legacy')::integer legacy_count,
    count(*) filter(where hotel.id=constants.hotel_id and jsonb_typeof(hotel.photos)='array'
      and jsonb_array_length(hotel.photos)=9)::integer nine_photo_count,
    count(*) filter(where hotel.id=constants.hotel_id and hotel.pricing_model='tiered_by_nights'
      and jsonb_typeof(hotel.pricing_tiers->'rules')='array'
      and jsonb_array_length(hotel.pricing_tiers->'rules')=63)::integer legacy_pricing_count,
    max(hotel.children_policy) filter(where hotel.id=constants.hotel_id) children_policy,
    max(hotel.minimum_child_age) filter(where hotel.id=constants.hotel_id) minimum_child_age
  from public.hotels hotel cross join constants
),
room_state as (
  select
    count(distinct room.id) filter(where room.id in (constants.upper_id,constants.ground_id))::integer exact_room_count,
    coalesce(array_agg(amenity order by amenity) filter(where room.id=constants.upper_id and amenity is not null),'{}'::text[]) upper_current,
    coalesce(array_agg(amenity order by amenity) filter(where room.id=constants.ground_id and amenity is not null),'{}'::text[]) ground_current,
    max(room.version) filter(where room.id=constants.upper_id) upper_version,
    max(room.version) filter(where room.id=constants.ground_id) ground_version
  from constants
  left join public.hotel_room_types room on room.id in (constants.upper_id,constants.ground_id)
  left join lateral unnest(coalesce(room.amenities,'{}'::text[])) amenity on true
),
inert_graph as (
  select
    count(*) filter(where plan.id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid
      and not plan.is_active)::integer inactive_plan_count,
    (select count(*) from public.hotel_room_rates room_rate where room_rate.id in (
      '7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid,
      '3320590d-632d-423f-80d0-fd021cba7293'::uuid
    ) and not room_rate.is_active)::integer inactive_rate_count
  from public.hotel_rate_plans plan
),
flags as (
  select count(*) filter(where id=1 and not hotel_rooms_v2_enabled
    and not hotel_external_sync_enabled and not hotel_instant_booking_enabled
    and not hotel_stripe_connect_enabled)::integer all_off_count
  from public.site_settings
)
select
  property_state.property_count,
  property_state.legacy_count,
  property_state.children_policy,
  property_state.minimum_child_age,
  room_state.exact_room_count,
  room_state.upper_version,
  room_state.upper_current as upper_expected_original_amenities,
  room_state.upper_current as upper_current_amenities,
  constants.upper_target as upper_target_amenities,
  case when room_state.upper_current=constants.upper_target then 'CURRENT_EQUALS_TARGET_SAFE_NOOP'
    else 'CURRENT_EQUALS_FRESH_EXPECTED_ORIGINAL_REVIEW_TARGET_CHANGE' end upper_merge_classification,
  room_state.ground_version,
  room_state.ground_current as ground_expected_original_amenities,
  room_state.ground_current as ground_current_amenities,
  constants.ground_target as ground_target_amenities,
  case when room_state.ground_current=constants.ground_target then 'CURRENT_EQUALS_TARGET_SAFE_NOOP'
    else 'CURRENT_EQUALS_FRESH_EXPECTED_ORIGINAL_REVIEW_TARGET_CHANGE' end ground_merge_classification,
  (
    function_contract.definition like '%expected_original%'
    and function_contract.definition like '%hotels_v2_h2b1_shadow_room_three_way_conflict%'
    and function_contract.definition like '%hotels_v2_h2b1_three_way_identity_v1%'
    and function_contract.definition like '%legacy_source_key=excluded.legacy_source_key%'
    and function_contract.security_definer
    and function_contract.safe_search_path
    and not has_function_privilege('anon',
      'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)','EXECUTE')
    and not has_function_privilege('service_role',
      'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)','EXECUTE')
    and has_function_privilege('authenticated',
      'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)','EXECUTE')
    and property_state.property_count=1
    and property_state.legacy_count=1
    and property_state.nine_photo_count=1
    and property_state.legacy_pricing_count=1
    and room_state.exact_room_count=2
    and inert_graph.inactive_plan_count=1
    and inert_graph.inactive_rate_count=2
    and flags.all_off_count=1
  ) as hotels_v2_h2b1_shadow_three_way_merge_safe
from constants
cross join function_contract
cross join property_state
cross join room_state
cross join inert_graph
cross join flags;
