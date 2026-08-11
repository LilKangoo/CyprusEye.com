-- Hotels 2.0 H2B.1 post-Admin verification for the reviewed 7 Arches shadow.
-- READ ONLY. Run only after "Prepare 2 existing apartments" succeeds.

with
property_contract as (
  select count(*)::integer property_count,
    count(*) filter(where slug='7-ukow' and architecture_version='legacy'
      and is_published and status='draft' and submission_status='draft'
      and pricing_model='tiered_by_nights' and max_persons=8
      and children_policy='minimum_age' and minimum_child_age=10
      and coalesce(description->>'en','') like '%All apartments are air-conditioned%'
      and coalesce(amenities,'[]'::jsonb)
        @> '["air_conditioning","terrace","balcony"]'::jsonb
      and jsonb_typeof(photos)='array' and jsonb_array_length(photos)=9
      and pricing_tiers->>'currency'='EUR' and jsonb_array_length(pricing_tiers->'rules')=63)::integer exact_contract_count,
    max(md5(pricing_tiers::text)) pricing_fingerprint
  from public.hotels where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
),
rooms as (
  select count(*)::integer room_count,
    count(*) filter(where status in ('draft','active'))::integer safe_room_status_count,
    count(*) filter(where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid
      and legacy_source_key='upper_floor_apartment' and code='upper-floor-apartment'
      and max_occupancy=4 and capacity_adults is null and capacity_children is null
      and inventory_mode='pooled' and base_inventory_count=1 and status in ('draft','active')
      and amenities @> array['air_conditioning','terrace','balcony']::text[] and cardinality(amenities)=3
      and coalesce(length(btrim(name_i18n->>'pl')),0)>0
      and coalesce(length(btrim(name_i18n->>'en')),0)>0
      and coalesce(length(btrim(name_i18n->>'he')),0)>0
      and jsonb_typeof(gallery)='array' and jsonb_array_length(gallery)>0)::integer upper_exact_count,
    count(*) filter(where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid
      and legacy_source_key='ground_floor_apartment' and code='ground-floor-apartment'
      and max_occupancy=4 and capacity_adults is null and capacity_children is null
      and inventory_mode='pooled' and base_inventory_count=1 and status in ('draft','active')
      and amenities @> array['air_conditioning','terrace']::text[] and cardinality(amenities)=2
      and not (amenities @> array['balcony']::text[])
      and coalesce(length(btrim(name_i18n->>'pl')),0)>0
      and coalesce(length(btrim(name_i18n->>'en')),0)>0
      and coalesce(length(btrim(name_i18n->>'he')),0)>0
      and jsonb_typeof(gallery)='array' and jsonb_array_length(gallery)>0)::integer ground_exact_count,
    count(*) filter(where exists(
      select 1 from jsonb_array_elements(room_type.gallery) room_photo
      where not exists(select 1 from jsonb_array_elements((
        select property.photos from public.hotels property where property.id=room_type.hotel_id
      )) property_photo
        where property_photo.value=room_photo.value)
    ))::integer rooms_with_foreign_photo
  from public.hotel_room_types room_type
  where room_type.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
),
rate_plan as (
  select count(*)::integer plan_count,
    count(*) filter(where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
      and code='standard' and not is_active
      and cancellation_policy->>'type'='requires_review'
      and cancellation_policy->>'reason'='legacy_cancellation_terms_unconfirmed')::integer exact_plan_count
  from public.hotel_rate_plans where id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid
),
schedules as (
  select count(*)::integer schedule_count,
    count(*) filter(where id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid
      and hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
      and code='shared-apartment-occupancy-los' and application_scope='room_occupancy'
      and maximum_party_size=4 and not is_active and review_status='requires_review' and source='legacy_preview')::integer room_schedule_count,
    count(*) filter(where id='443065c0-984a-5de3-a22a-d03042c41107'::uuid
      and hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
      and code='legacy-property-party-preview' and application_scope='property_booking_party'
      and maximum_party_size=8 and not is_active and review_status='requires_review' and source='legacy_preview')::integer party_schedule_count,
    count(*) filter(where source_reference->>'pricing_fingerprint'=(select pricing_fingerprint from property_contract))::integer fingerprint_match_count
  from public.hotel_pricing_schedules
  where id in ('b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid,'443065c0-984a-5de3-a22a-d03042c41107'::uuid)
),
room_rates as (
  select count(*)::integer rate_count,
    count(*) filter(where id='7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid
      and hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
      and room_type_id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid
      and rate_plan_id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid
      and pricing_schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid
      and base_nightly_rate=0 and currency='EUR' and not is_active)::integer upper_rate_count,
    count(*) filter(where id='3320590d-632d-423f-80d0-fd021cba7293'::uuid
      and hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
      and room_type_id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid
      and rate_plan_id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid
      and pricing_schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid
      and base_nightly_rate=0 and currency='EUR' and not is_active)::integer ground_rate_count
  from public.hotel_room_rates
  where id in ('7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid,'3320590d-632d-423f-80d0-fd021cba7293'::uuid)
),
room_schedule_mismatch as (
  select count(*)::integer mismatch_count from (
    (select (rule->>'persons')::smallint guest_count,(rule->>'min_nights')::integer threshold_nights,
      (rule->>'price_per_night')::numeric nightly_rate
     from public.hotels hotel cross join lateral jsonb_array_elements(hotel.pricing_tiers->'rules') rule
     where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid and (rule->>'persons')::integer between 2 and 4
     except
     select guest_count,threshold_nights,nightly_rate from public.hotel_pricing_schedule_occupancy_tiers
     where schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid and is_active)
    union all
    (select guest_count,threshold_nights,nightly_rate from public.hotel_pricing_schedule_occupancy_tiers
     where schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid and is_active
     except
     select (rule->>'persons')::smallint,(rule->>'min_nights')::integer,(rule->>'price_per_night')::numeric
     from public.hotels hotel cross join lateral jsonb_array_elements(hotel.pricing_tiers->'rules') rule
     where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid and (rule->>'persons')::integer between 2 and 4)
  ) mismatch
),
party_schedule_mismatch as (
  select count(*)::integer mismatch_count from (
    (select (rule->>'persons')::smallint guest_count,(rule->>'min_nights')::integer threshold_nights,
      (rule->>'price_per_night')::numeric nightly_rate
     from public.hotels hotel cross join lateral jsonb_array_elements(hotel.pricing_tiers->'rules') rule
     where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
     except
     select guest_count,threshold_nights,nightly_rate from public.hotel_pricing_schedule_occupancy_tiers
     where schedule_id='443065c0-984a-5de3-a22a-d03042c41107'::uuid and is_active)
    union all
    (select guest_count,threshold_nights,nightly_rate from public.hotel_pricing_schedule_occupancy_tiers
     where schedule_id='443065c0-984a-5de3-a22a-d03042c41107'::uuid and is_active
     except
     select (rule->>'persons')::smallint,(rule->>'min_nights')::integer,(rule->>'price_per_night')::numeric
     from public.hotels hotel cross join lateral jsonb_array_elements(hotel.pricing_tiers->'rules') rule
     where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)
  ) mismatch
),
tier_counts as (
  select count(*) filter(where schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid and is_active)::integer room_tier_count,
    count(*) filter(where schedule_id='443065c0-984a-5de3-a22a-d03042c41107'::uuid and is_active)::integer party_tier_count
  from public.hotel_pricing_schedule_occupancy_tiers
),
flags as (
  select count(*)::integer settings_count,
    count(*) filter(where not hotel_rooms_v2_enabled and not hotel_external_sync_enabled
      and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled)::integer flags_off_count
  from public.site_settings
),
protected_history as (
  select
    (select count(*)::integer from public.hotel_bookings) booking_count,
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
      from public.hotel_bookings row_value) booking_fingerprint,
    (select count(*)::integer from public.partner_service_fulfillments where resource_type='hotels') fulfillment_count,
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
      from public.partner_service_fulfillments row_value where row_value.resource_type='hotels') fulfillment_fingerprint
)
select
  property_contract.property_count,property_contract.exact_contract_count,
  rooms.room_count,rooms.safe_room_status_count,
  rooms.upper_exact_count,rooms.ground_exact_count,rooms.rooms_with_foreign_photo,
  rate_plan.plan_count,rate_plan.exact_plan_count,
  schedules.schedule_count,schedules.room_schedule_count,schedules.party_schedule_count,schedules.fingerprint_match_count,
  room_rates.rate_count,room_rates.upper_rate_count,room_rates.ground_rate_count,
  tiers.room_tier_count,tiers.party_tier_count,
  room_parity.mismatch_count as room_schedule_value_mismatch,
  party_parity.mismatch_count as property_party_value_mismatch,
  flags.flags_off_count,
  case when room_parity.mismatch_count=0 and party_parity.mismatch_count=0 then 0 else 1 end
    as "HOTEL_7_ARCHES_OCCUPANCY_PRICE_MISMATCH",
  case when property_contract.exact_contract_count=1 then 0 else 1 end as "HOTEL_LEGACY_PRICE_MISMATCH",
  case when property_contract.exact_contract_count=1 and flags.flags_off_count=1 then 0 else 1 end as "HOTEL_LEGACY_PUBLIC_MISMATCH",
  case when history.booking_count=3 and history.booking_fingerprint='fb5a4c508b0df32afbffe5b1594c7a50'
    and history.fulfillment_count=5 and history.fulfillment_fingerprint='1e01541853d87d26adccb8172074934b'
    then 0 else 1 end as "HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE",
  (
    property_contract.property_count=1 and property_contract.exact_contract_count=1
    and rooms.room_count=2 and rooms.safe_room_status_count=2
    and rooms.upper_exact_count=1 and rooms.ground_exact_count=1
    and rooms.rooms_with_foreign_photo=0
    and rate_plan.plan_count=1 and rate_plan.exact_plan_count=1
    and schedules.schedule_count=2 and schedules.room_schedule_count=1
    and schedules.party_schedule_count=1 and schedules.fingerprint_match_count=2
    and room_rates.rate_count=2 and room_rates.upper_rate_count=1 and room_rates.ground_rate_count=1
    and tiers.room_tier_count=27 and tiers.party_tier_count=63
    and room_parity.mismatch_count=0 and party_parity.mismatch_count=0
    and flags.settings_count=1 and flags.flags_off_count=1
    and history.booking_count=3 and history.booking_fingerprint='fb5a4c508b0df32afbffe5b1594c7a50'
    and history.fulfillment_count=5 and history.fulfillment_fingerprint='1e01541853d87d26adccb8172074934b'
  ) hotels_v2_h2b1_seven_arches_shadow_safe
from property_contract cross join rooms cross join rate_plan cross join schedules cross join room_rates
cross join room_schedule_mismatch room_parity cross join party_schedule_mismatch party_parity
cross join tier_counts tiers cross join flags cross join protected_history history;
