-- Hotels V2 H3.1P post-Admin legacy pricing promotion verification (READ ONLY).
-- Run only after the reviewed Admin promotion RPC returns HTTP 200.
\set ON_ERROR_STOP on

\if :{?h3_1p_expected_booking_count}
\else
\set h3_1p_expected_booking_count 3
\set h3_1p_expected_booking_fingerprint fb5a4c508b0df32afbffe5b1594c7a50
\set h3_1p_expected_fulfillment_count 5
\set h3_1p_expected_fulfillment_fingerprint 1e01541853d87d26adccb8172074934b
\endif

with
constants as (
  select
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid hotel_id,
    'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid upper_id,
    '825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid ground_id
),
preview as (
  select public.hotel_v2_h3_1p_pricing_promotion_snapshot(constants.hotel_id) value
  from constants
),
allocation_graph as (
  select
    count(distinct rule.id)::integer rule_count,
    count(item.id)::integer item_count,
    count(*) filter(where rule.code='guests-1-4-choice'
      and item.allocated_guest_count is null
      and item.pricing_guest_count is null)::integer choice_null_count,
    count(*) filter(where rule.code='guests-5-bundle'
      and ((item.room_type_id=constants.upper_id and item.allocated_guest_count=3)
        or (item.room_type_id=constants.ground_id and item.allocated_guest_count=2))
      and item.pricing_guest_count=2)::integer five_exact_count,
    count(*) filter(where rule.code='guests-6-bundle'
      and item.allocated_guest_count=3 and item.pricing_guest_count=3)::integer six_exact_count,
    count(*) filter(where rule.code='guests-7-bundle'
      and ((item.room_type_id=constants.upper_id and item.allocated_guest_count=4)
        or (item.room_type_id=constants.ground_id and item.allocated_guest_count=3))
      and item.pricing_guest_count=4)::integer seven_exact_count,
    count(*) filter(where rule.code='guests-8-bundle'
      and item.allocated_guest_count=4 and item.pricing_guest_count=4)::integer eight_exact_count
  from public.hotel_room_allocation_rules rule
  join public.hotel_room_allocation_rule_items item on item.allocation_rule_id=rule.id
  cross join constants
  where rule.hotel_id=constants.hotel_id
),
receipt as (
  select count(*)::integer receipt_count,
    count(*) filter(where review.contract_version='seven_kamares_legacy_to_h3_pricing_v1'
      and review.review_status='reviewed'
      and review.acknowledged_pricing_occupancy_mapping
      and review.parity_case_count=70 and review.parity_mismatch_count=0
      and review.source_fingerprint='7208ab4ecc0e47abd64d87ca1ac53a03'
      and review.source_fingerprint=preview.value#>>'{source,pricing_fingerprint}'
      and review.target_fingerprint=preview.value#>>'{target,target_fingerprint}'
      and review.pricing_occupancy_mapping_fingerprint=
        preview.value->>'pricing_occupancy_mapping_fingerprint'
      and review.parity_fingerprint=preview.value#>>'{parity,fingerprint}')::integer exact_count
  from public.hotel_pricing_promotion_reviews review cross join preview
),
gallery as (
  select
    (select jsonb_array_length(hotel.photos) from public.hotels hotel cross join constants
      where hotel.id=constants.hotel_id)::integer property_photo_count,
    (select jsonb_array_length(room.gallery) from public.hotel_room_types room cross join constants
      where room.id=constants.upper_id)::integer upper_photo_count,
    (select jsonb_array_length(room.gallery) from public.hotel_room_types room cross join constants
      where room.id=constants.ground_id)::integer ground_photo_count,
    (select count(*) from public.hotel_room_types room cross join constants
      cross join lateral jsonb_array_elements(room.gallery) photo(value)
      where room.hotel_id=constants.hotel_id and not exists(
        select 1 from public.hotels hotel
        cross join lateral jsonb_array_elements(hotel.photos) property_photo(value)
        where hotel.id=constants.hotel_id and property_photo.value=photo.value
      ))::integer foreign_photo_count
),
history as (
  select
    (select count(*) from public.hotel_bookings)::integer booking_count,
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
      from public.hotel_bookings row_value) booking_fingerprint,
    (select count(*) from public.partner_service_fulfillments
      where resource_type='hotels')::integer fulfillment_count,
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
      from public.partner_service_fulfillments row_value
      where resource_type='hotels') fulfillment_fingerprint
)
select
  preview.value#>>'{promotion,status}' promotion_status,
  preview.value#>>'{source,pricing_fingerprint}' legacy_pricing_fingerprint,
  (preview.value#>>'{source,rule_count}')::integer legacy_tier_count,
  (preview.value#>>'{target,room_schedule,tier_count}')::integer room_tier_count,
  allocation_graph.*,
  gallery.*,
  receipt.receipt_count,receipt.exact_count exact_receipt_count,
  (preview.value#>>'{parity,total_mismatch_count}')::integer
    as "HOTEL_7_ARCHES_OCCUPANCY_PRICE_MISMATCH",
  case when preview.value#>>'{source,pricing_fingerprint}'=
      '7208ab4ecc0e47abd64d87ca1ac53a03'
      and (preview.value#>>'{source,rule_count}')::integer=63 then 0 else 1 end
    as "HOTEL_LEGACY_PRICE_MISMATCH",
  case when preview.value#>>'{property,architecture_version}'='legacy'
      and not exists(select 1 from public.site_settings where id=1 and (
        hotel_rooms_v2_enabled or hotel_external_sync_enabled
        or hotel_instant_booking_enabled or hotel_stripe_connect_enabled))
    then 0 else 1 end as "HOTEL_LEGACY_PUBLIC_MISMATCH",
  case when history.booking_count=(:'h3_1p_expected_booking_count')::integer
      and history.booking_fingerprint=(:'h3_1p_expected_booking_fingerprint')::text
      and history.fulfillment_count=(:'h3_1p_expected_fulfillment_count')::integer
      and history.fulfillment_fingerprint=(:'h3_1p_expected_fulfillment_fingerprint')::text
    then 0 else 1 end as "HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE",
  (
    coalesce((preview.value->>'supported')::boolean,false)
    and preview.value#>>'{promotion,status}'='reviewed'
    and preview.value#>>'{target,room_schedule,review_status}'='reviewed'
    and not (preview.value#>>'{target,room_schedule,is_active}')::boolean
    and preview.value#>>'{source,property_party_preview,review_status}'='requires_review'
    and not (preview.value#>>'{source,property_party_preview,is_active}')::boolean
    and preview.value#>>'{target,rate_plan,code}'='standard'
    and preview.value#>'{target,rate_plan,cancellation_policy}'=
      '{"type":"non_refundable"}'::jsonb
    and not (preview.value#>>'{target,rate_plan,is_active}')::boolean
    and jsonb_array_length(preview.value#>'{target,room_rates}')=2
    and not exists(select 1 from jsonb_array_elements(preview.value#>'{target,room_rates}') rate(value)
      where (rate.value->>'is_active')::boolean)
    and (select count(*) from public.hotel_room_rates rate cross join constants
      where rate.hotel_id=constants.hotel_id
        and rate.rate_plan_id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid
        and rate.pricing_schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid
        and rate.base_nightly_rate=0 and btrim(rate.currency::text)='EUR'
        and not rate.is_active
        and ((rate.id='7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid
          and rate.room_type_id=constants.upper_id)
          or (rate.id='3320590d-632d-423f-80d0-fd021cba7293'::uuid
          and rate.room_type_id=constants.ground_id)))=2
    and (preview.value#>>'{source,rule_count}')::integer=63
    and (preview.value#>>'{target,room_schedule,tier_count}')::integer=27
    and (preview.value#>>'{source,property_party_preview,tier_count}')::integer=63
    and (preview.value#>>'{parity,total_case_count}')::integer=70
    and (preview.value#>>'{parity,total_mismatch_count}')::integer=0
    and allocation_graph.rule_count=5 and allocation_graph.item_count=10
    and allocation_graph.choice_null_count=2
    and allocation_graph.five_exact_count=2
    and allocation_graph.six_exact_count=2
    and allocation_graph.seven_exact_count=2
    and allocation_graph.eight_exact_count=2
    and receipt.receipt_count=1 and receipt.exact_count=1
    and gallery.property_photo_count=9
    and gallery.upper_photo_count=6 and gallery.ground_photo_count=5
    and gallery.foreign_photo_count=0
    and (select count(*) from public.hotel_room_types room cross join constants
      where room.hotel_id=constants.hotel_id)=2
    and (select architecture_version from public.hotels hotel cross join constants
      where hotel.id=constants.hotel_id)='legacy'
    and not exists(select 1 from public.site_settings where id=1 and (
      hotel_rooms_v2_enabled or hotel_external_sync_enabled
      or hotel_instant_booking_enabled or hotel_stripe_connect_enabled))
    and history.booking_count=(:'h3_1p_expected_booking_count')::integer
    and history.booking_fingerprint=(:'h3_1p_expected_booking_fingerprint')::text
    and history.fulfillment_count=(:'h3_1p_expected_fulfillment_count')::integer
    and history.fulfillment_fingerprint=(:'h3_1p_expected_fulfillment_fingerprint')::text
  ) hotels_v2_h3_1_legacy_pricing_promotion_safe
from preview cross join allocation_graph cross join receipt cross join gallery cross join history;
