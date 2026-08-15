-- Hotels V2 H3.1P foundation verification (READ ONLY).
-- Run immediately after migration 20260811310000 and before any Admin
-- promotion. A true result proves schema/RPC readiness with zero business-row
-- promotion: all pricing_guest_count values remain NULL and no receipt exists.
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
  select '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid hotel_id
),
preview as (
  select public.hotel_v2_h3_1p_pricing_promotion_snapshot(constants.hotel_id) value
  from constants
),
acl as (
  select
    not has_function_privilege(0::oid,
      'public.hotel_v2_admin_get_legacy_pricing_promotion_preview(uuid)'::regprocedure,'EXECUTE')
      and not has_function_privilege('anon',
      'public.hotel_v2_admin_get_legacy_pricing_promotion_preview(uuid)','EXECUTE')
      and has_function_privilege('authenticated',
      'public.hotel_v2_admin_get_legacy_pricing_promotion_preview(uuid)','EXECUTE')
      and not has_function_privilege('service_role',
      'public.hotel_v2_admin_get_legacy_pricing_promotion_preview(uuid)','EXECUTE')
      and not has_function_privilege(0::oid,
      'public.hotel_v2_admin_apply_legacy_pricing_promotion(jsonb,uuid)'::regprocedure,'EXECUTE')
      and not has_function_privilege('anon',
      'public.hotel_v2_admin_apply_legacy_pricing_promotion(jsonb,uuid)','EXECUTE')
      and has_function_privilege('authenticated',
      'public.hotel_v2_admin_apply_legacy_pricing_promotion(jsonb,uuid)','EXECUTE')
      and not has_function_privilege('service_role',
      'public.hotel_v2_admin_apply_legacy_pricing_promotion(jsonb,uuid)','EXECUTE') safe
),
one_guest as (
  select count(*)::integer option_count,
    count(*) filter(where jsonb_array_length(option.value->'nightly_comparisons')=10)::integer ten_case_options,
    count(*) filter(where not exists(
      select 1 from jsonb_array_elements(option.value->'nightly_comparisons') comparison(value)
      where (comparison.value->>'priced_occupancy')::integer<>2
         or (comparison.value->>'requested_guest_count')::integer<>1
         or (comparison.value->>'room_rate_sum')::numeric
            is distinct from (comparison.value->>'legacy_nightly_rate')::numeric
    ))::integer exact_floor_options
  from preview
  cross join lateral jsonb_array_elements(preview.value->'allocation_previews') entry(value)
  cross join lateral jsonb_array_elements(entry.value->'options') option(value)
  where (entry.value->>'guest_count')::integer=1
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
  preview.value#>>'{source,pricing_fingerprint}' legacy_pricing_fingerprint,
  (preview.value#>>'{source,rule_count}')::integer legacy_tier_count,
  (preview.value#>>'{target,room_schedule,tier_count}')::integer room_tier_count,
  (preview.value#>>'{source,property_party_preview,tier_count}')::integer party_preview_tier_count,
  (preview.value#>>'{parity,total_case_count}')::integer oracle_case_count,
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
    and preview.value#>>'{promotion,status}'='not_reviewed'
    and preview.value#>>'{target,room_schedule,review_status}'='requires_review'
    and not (preview.value#>>'{target,room_schedule,is_active}')::boolean
    and (preview.value#>>'{source,rule_count}')::integer=63
    and (preview.value#>>'{target,room_schedule,tier_count}')::integer=27
    and (preview.value#>>'{source,property_party_preview,tier_count}')::integer=63
    and (preview.value#>>'{parity,threshold_case_count}')::integer=63
    and (preview.value#>>'{parity,long_stay_case_count}')::integer=7
    and (preview.value#>>'{parity,total_case_count}')::integer=70
    and (preview.value#>>'{parity,total_mismatch_count}')::integer=0
    and jsonb_array_length(preview.value->'allocation_previews')=8
    and one_guest.option_count=2 and one_guest.ten_case_options=2
    and one_guest.exact_floor_options=2
    and not exists(select 1 from public.hotel_pricing_schedule_occupancy_tiers tier
      where tier.schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid
        and tier.guest_count=1)
    and not exists(select 1 from public.hotel_room_allocation_rule_items
      where pricing_guest_count is not null)
    and not exists(select 1 from public.hotel_pricing_promotion_reviews)
    and acl.safe
    and history.booking_count=(:'h3_1p_expected_booking_count')::integer
    and history.booking_fingerprint=(:'h3_1p_expected_booking_fingerprint')::text
    and history.fulfillment_count=(:'h3_1p_expected_fulfillment_count')::integer
    and history.fulfillment_fingerprint=(:'h3_1p_expected_fulfillment_fingerprint')::text
  ) hotels_v2_h3_1_legacy_pricing_promotion_foundation_safe
from preview cross join acl cross join one_guest cross join history;
