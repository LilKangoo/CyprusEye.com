-- READ ONLY. Run immediately before
-- 20260811260000_hotels_v2_h2b1_shadow_three_way_merge.sql.
-- This reports the exact currently stored room amenities.  For a preparation
-- opened from this fresh workspace, EXPECTED ORIGINAL equals CURRENT.
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
    to_regprocedure('public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)') is not null present,
    coalesce(pg_get_functiondef(to_regprocedure(
      'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'
    )) like '%expected_property_policy%',false) reviewed_policy_present,
    coalesce(pg_get_functiondef(to_regprocedure(
      'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'
    )) like '%hotels_v2_h2b1_stale_shadow_room%',false) stale_guard_present,
    coalesce(pg_get_functiondef(to_regprocedure(
      'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'
    )) like '%expected_original%',false) three_way_already_present
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
    max(room.version) filter(where room.id=constants.ground_id) ground_version,
    max(room.updated_at) filter(where room.id=constants.upper_id) upper_updated_at,
    max(room.updated_at) filter(where room.id=constants.ground_id) ground_updated_at
  from constants
  left join public.hotel_room_types room on room.id in (constants.upper_id,constants.ground_id)
  left join lateral unnest(coalesce(room.amenities,'{}'::text[])) amenity on true
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
  room_state.upper_updated_at,
  room_state.upper_current as upper_expected_original_amenities,
  room_state.upper_current as upper_current_amenities,
  constants.upper_target as upper_target_amenities,
  case when room_state.upper_current=constants.upper_target then 'CURRENT_EQUALS_TARGET_SAFE_NOOP'
    else 'CURRENT_EQUALS_FRESH_EXPECTED_ORIGINAL_REVIEW_TARGET_CHANGE' end upper_merge_classification,
  room_state.ground_version,
  room_state.ground_updated_at,
  room_state.ground_current as ground_expected_original_amenities,
  room_state.ground_current as ground_current_amenities,
  constants.ground_target as ground_target_amenities,
  case when room_state.ground_current=constants.ground_target then 'CURRENT_EQUALS_TARGET_SAFE_NOOP'
    else 'CURRENT_EQUALS_FRESH_EXPECTED_ORIGINAL_REVIEW_TARGET_CHANGE' end ground_merge_classification,
  function_contract.three_way_already_present,
  (
    function_contract.present
    and function_contract.reviewed_policy_present
    and function_contract.stale_guard_present
    and property_state.property_count=1
    and property_state.legacy_count=1
    and property_state.nine_photo_count=1
    and property_state.legacy_pricing_count=1
    and room_state.exact_room_count=2
    and flags.all_off_count=1
  ) as hotels_v2_h2b1_shadow_three_way_merge_preflight_safe
from constants
cross join function_contract
cross join property_state
cross join room_state
cross join flags;
