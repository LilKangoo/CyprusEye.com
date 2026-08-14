-- Hotels 2.0 H2B.2 final 7 Arches shadow / age-15 verification.
-- READ ONLY. This statement intentionally performs no DDL or DML.
-- Run after the reviewed age-15 property-policy/inheritance Save has completed.

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
    '443065c0-984a-5de3-a22a-d03042c41107'::uuid party_schedule_id,
    array['air_conditioning','balcony','terrace']::text[] upper_amenities,
    array['air_conditioning','terrace']::text[] ground_amenities,
    '{"type":"non_refundable"}'::jsonb accepted_cancellation_policy
),
properties as (
  select
    count(*)::integer property_count,
    count(*) filter(where architecture_version='legacy')::integer legacy_count,
    count(*) filter(where architecture_version='rooms_v2')::integer rooms_v2_count
  from public.hotels
),
property_state as (
  select
    count(*)::integer property_count,
    count(*) filter(where
      hotel.slug='7-ukow'
      and hotel.architecture_version='legacy'
      and hotel.is_published
      and hotel.status='draft'
      and hotel.submission_status='draft'
      and hotel.pricing_model='tiered_by_nights'
      and hotel.max_persons=8
      and hotel.children_policy='minimum_age'
      and hotel.minimum_child_age=15
      and jsonb_typeof(hotel.photos)='array'
      and jsonb_array_length(hotel.photos)=9
      and hotel.pricing_tiers->>'currency'='EUR'
      and jsonb_typeof(hotel.pricing_tiers->'rules')='array'
      and jsonb_array_length(hotel.pricing_tiers->'rules')=63
    )::integer exact_contract_count,
    max(hotel.children_policy) children_policy,
    max(hotel.minimum_child_age) minimum_child_age,
    max(jsonb_array_length(hotel.photos)) filter(where jsonb_typeof(hotel.photos)='array')::integer property_gallery_count,
    max(jsonb_array_length(hotel.pricing_tiers->'rules'))
      filter(where jsonb_typeof(hotel.pricing_tiers->'rules')='array')::integer legacy_rule_count,
    max(md5(hotel.pricing_tiers::text)) legacy_pricing_fingerprint
  from public.hotels hotel cross join constants
  where hotel.id=constants.hotel_id
),
room_rows as (
  select room.*,
    coalesce(room.children_policy_override,hotel.children_policy) effective_children_policy,
    case
      when coalesce(room.children_policy_override,hotel.children_policy)='minimum_age'
        then coalesce(room.minimum_child_age_override,hotel.minimum_child_age)
      else null
    end effective_minimum_child_age
  from public.hotel_room_types room
  join public.hotels hotel on hotel.id=room.hotel_id
  cross join constants
  where room.hotel_id=constants.hotel_id
),
rooms as (
  select
    count(*)::integer room_count,
    count(*) filter(where room.id in (constants.upper_id,constants.ground_id))::integer exact_id_count,
    count(*) filter(where room.id not in (constants.upper_id,constants.ground_id))::integer unexpected_room_count,
    count(*) filter(where room.id=constants.upper_id
      and room.legacy_source_key='upper_floor_apartment'
      and room.code='upper-floor-apartment'
      and room.name_i18n->>'pl'='Apartament na piętrze'
      and room.name_i18n->>'en'='Upper Floor Apartment'
      and room.name_i18n->>'he'='דירה בקומה העליונה'
      and room.max_occupancy=4
      and room.capacity_adults is null and room.capacity_children is null
      and room.inventory_mode='pooled' and room.base_inventory_count=1
      and room.status='active'
      and room.children_policy_override is null
      and room.minimum_child_age_override is null
      and room.effective_children_policy='minimum_age'
      and room.effective_minimum_child_age=15
      and room.amenities @> constants.upper_amenities
      and constants.upper_amenities @> room.amenities
      and cardinality(room.amenities)=cardinality(constants.upper_amenities)
      and jsonb_typeof(room.gallery)='array'
      and jsonb_array_length(room.gallery)>0
    )::integer upper_exact_count,
    count(*) filter(where room.id=constants.ground_id
      and room.legacy_source_key='ground_floor_apartment'
      and room.code='ground-floor-apartment'
      and room.name_i18n->>'pl'='Apartament na parterze'
      and room.name_i18n->>'en'='Ground Floor Apartment'
      and room.name_i18n->>'he'='דירה בקומת הקרקע'
      and room.max_occupancy=4
      and room.capacity_adults is null and room.capacity_children is null
      and room.inventory_mode='pooled' and room.base_inventory_count=1
      and room.status='active'
      and room.children_policy_override is null
      and room.minimum_child_age_override is null
      and room.effective_children_policy='minimum_age'
      and room.effective_minimum_child_age=15
      and room.amenities @> constants.ground_amenities
      and constants.ground_amenities @> room.amenities
      and cardinality(room.amenities)=cardinality(constants.ground_amenities)
      and not (room.amenities @> array['balcony']::text[])
      and jsonb_typeof(room.gallery)='array'
      and jsonb_array_length(room.gallery)>0
    )::integer ground_exact_count,
    max(room.version) filter(where room.id=constants.upper_id) upper_version,
    max(room.version) filter(where room.id=constants.ground_id) ground_version,
    max(room.children_policy_override) filter(where room.id=constants.upper_id) upper_policy_override,
    max(room.minimum_child_age_override) filter(where room.id=constants.upper_id) upper_minimum_age_override,
    max(room.effective_children_policy) filter(where room.id=constants.upper_id) upper_effective_policy,
    max(room.effective_minimum_child_age) filter(where room.id=constants.upper_id) upper_effective_minimum_age,
    max(room.children_policy_override) filter(where room.id=constants.ground_id) ground_policy_override,
    max(room.minimum_child_age_override) filter(where room.id=constants.ground_id) ground_minimum_age_override,
    max(room.effective_children_policy) filter(where room.id=constants.ground_id) ground_effective_policy,
    max(room.effective_minimum_child_age) filter(where room.id=constants.ground_id) ground_effective_minimum_age,
    max(jsonb_array_length(room.gallery)) filter(where room.id=constants.upper_id
      and jsonb_typeof(room.gallery)='array')::integer upper_gallery_count,
    max(jsonb_array_length(room.gallery)) filter(where room.id=constants.ground_id
      and jsonb_typeof(room.gallery)='array')::integer ground_gallery_count,
    (jsonb_agg(to_jsonb(room.amenities)) filter(where room.id=constants.upper_id))->0 upper_amenities,
    (jsonb_agg(to_jsonb(room.amenities)) filter(where room.id=constants.ground_id))->0 ground_amenities
  from room_rows room cross join constants
),
room_photos as (
  select room.id room_id,photo.value photo
  from room_rows room
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(room.gallery)='array' then room.gallery else '[]'::jsonb end
  ) photo(value)
),
gallery_audit as (
  select
    count(*) filter(where room_photo.room_id=constants.upper_id)::integer upper_gallery_count,
    count(*) filter(where room_photo.room_id=constants.ground_id)::integer ground_gallery_count,
    count(*) filter(where not exists(
      select 1
      from public.hotels property
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(property.photos)='array' then property.photos else '[]'::jsonb end
      ) property_photo(value)
      where property.id=constants.hotel_id and property_photo.value=room_photo.photo
    ))::integer foreign_photo_count,
    (select count(*)::integer from (
      select duplicate.room_id,duplicate.photo
      from room_photos duplicate
      group by duplicate.room_id,duplicate.photo
      having count(*)>1
    ) repeated)::integer duplicate_photo_count
  from room_photos room_photo cross join constants
),
rate_plan as (
  select
    count(*)::integer property_plan_count,
    count(*) filter(where plan.id=constants.plan_id
      and plan.code='standard'
      and not plan.is_active
      and plan.version=2
      and plan.cancellation_policy=constants.accepted_cancellation_policy
      and public.hotel_v2_h2a_cancellation_policy_is_valid(plan.cancellation_policy)
    )::integer exact_preserved_plan_count,
    max(plan.version) filter(where plan.id=constants.plan_id) preserved_version,
    max(plan.updated_at) filter(where plan.id=constants.plan_id) preserved_updated_at,
    (jsonb_agg(plan.cancellation_policy) filter(where plan.id=constants.plan_id))->0 preserved_policy,
    md5(coalesce(string_agg(plan.cancellation_policy::text,'|' order by plan.id),'')) policy_fingerprint,
    md5(coalesce(string_agg(to_jsonb(plan)::text,'|' order by plan.id),'')) row_fingerprint
  from public.hotel_rate_plans plan cross join constants
  where plan.hotel_id=constants.hotel_id
),
room_rates as (
  select
    count(*)::integer rate_count,
    count(*) filter(where rate.id=constants.upper_rate_id
      and rate.room_type_id=constants.upper_id
      and rate.rate_plan_id=constants.plan_id
      and rate.pricing_schedule_id=constants.room_schedule_id
      and rate.base_nightly_rate=0 and rate.currency='EUR' and not rate.is_active
    )::integer upper_exact_count,
    count(*) filter(where rate.id=constants.ground_rate_id
      and rate.room_type_id=constants.ground_id
      and rate.rate_plan_id=constants.plan_id
      and rate.pricing_schedule_id=constants.room_schedule_id
      and rate.base_nightly_rate=0 and rate.currency='EUR' and not rate.is_active
    )::integer ground_exact_count,
    md5(coalesce(string_agg(to_jsonb(rate)::text,'|' order by rate.id),'')) fingerprint
  from public.hotel_room_rates rate cross join constants
  where rate.hotel_id=constants.hotel_id
),
schedules as (
  select
    count(*)::integer schedule_count,
    count(*) filter(where schedule.id=constants.room_schedule_id
      and schedule.code='shared-apartment-occupancy-los'
      and schedule.application_scope='room_occupancy'
      and schedule.currency='EUR' and schedule.maximum_party_size=4
      and not schedule.is_active and schedule.review_status='requires_review'
      and schedule.source='legacy_preview'
      and schedule.source_reference->>'pricing_fingerprint'=property_state.legacy_pricing_fingerprint
    )::integer room_schedule_count,
    count(*) filter(where schedule.id=constants.party_schedule_id
      and schedule.code='legacy-property-party-preview'
      and schedule.application_scope='property_booking_party'
      and schedule.currency='EUR' and schedule.maximum_party_size=8
      and not schedule.is_active and schedule.review_status='requires_review'
      and schedule.source='legacy_preview'
      and schedule.source_reference->>'pricing_fingerprint'=property_state.legacy_pricing_fingerprint
    )::integer party_schedule_count,
    md5(coalesce(string_agg(to_jsonb(schedule)::text,'|' order by schedule.id),'')) fingerprint
  from public.hotel_pricing_schedules schedule cross join constants cross join property_state
  where schedule.hotel_id=constants.hotel_id
),
tier_counts as (
  select
    count(*)::integer total_tier_count,
    count(*) filter(where tier.schedule_id=constants.room_schedule_id and tier.is_active)::integer room_tier_count,
    count(*) filter(where tier.schedule_id=constants.party_schedule_id and tier.is_active)::integer party_tier_count,
    count(*) filter(where tier.schedule_id not in (constants.room_schedule_id,constants.party_schedule_id)
      or not tier.is_active)::integer unexpected_or_inactive_tier_count,
    md5(coalesce(string_agg(to_jsonb(tier)::text,'|' order by tier.id),'')) fingerprint
  from public.hotel_pricing_schedule_occupancy_tiers tier
  join public.hotel_pricing_schedules schedule on schedule.id=tier.schedule_id
  cross join constants
  where schedule.hotel_id=constants.hotel_id
),
room_schedule_mismatch as (
  select count(*)::integer mismatch_count from (
    (select (rule->>'persons')::smallint guest_count,
      (rule->>'min_nights')::integer threshold_nights,
      (rule->>'price_per_night')::numeric nightly_rate
     from public.hotels hotel
     cross join lateral jsonb_array_elements(hotel.pricing_tiers->'rules') rule
     cross join constants
     where hotel.id=constants.hotel_id and (rule->>'persons')::integer between 2 and 4
     except
     select tier.guest_count,tier.threshold_nights,tier.nightly_rate
     from public.hotel_pricing_schedule_occupancy_tiers tier cross join constants
     where tier.schedule_id=constants.room_schedule_id and tier.is_active)
    union all
    (select tier.guest_count,tier.threshold_nights,tier.nightly_rate
     from public.hotel_pricing_schedule_occupancy_tiers tier cross join constants
     where tier.schedule_id=constants.room_schedule_id and tier.is_active
     except
     select (rule->>'persons')::smallint,(rule->>'min_nights')::integer,
       (rule->>'price_per_night')::numeric
     from public.hotels hotel
     cross join lateral jsonb_array_elements(hotel.pricing_tiers->'rules') rule
     cross join constants
     where hotel.id=constants.hotel_id and (rule->>'persons')::integer between 2 and 4)
  ) mismatch
),
party_schedule_mismatch as (
  select count(*)::integer mismatch_count from (
    (select (rule->>'persons')::smallint guest_count,
      (rule->>'min_nights')::integer threshold_nights,
      (rule->>'price_per_night')::numeric nightly_rate
     from public.hotels hotel
     cross join lateral jsonb_array_elements(hotel.pricing_tiers->'rules') rule
     cross join constants
     where hotel.id=constants.hotel_id
     except
     select tier.guest_count,tier.threshold_nights,tier.nightly_rate
     from public.hotel_pricing_schedule_occupancy_tiers tier cross join constants
     where tier.schedule_id=constants.party_schedule_id and tier.is_active)
    union all
    (select tier.guest_count,tier.threshold_nights,tier.nightly_rate
     from public.hotel_pricing_schedule_occupancy_tiers tier cross join constants
     where tier.schedule_id=constants.party_schedule_id and tier.is_active
     except
     select (rule->>'persons')::smallint,(rule->>'min_nights')::integer,
       (rule->>'price_per_night')::numeric
     from public.hotels hotel
     cross join lateral jsonb_array_elements(hotel.pricing_tiers->'rules') rule
     cross join constants
     where hotel.id=constants.hotel_id)
  ) mismatch
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
    cross join lateral jsonb_array_elements(hotel.pricing_tiers->'rules') rule
    cross join constants
    where hotel.id=constants.hotel_id
      and (rule->>'persons')::integer=expected.persons
      and (rule->>'min_nights')::integer<=duration.nights
    order by (rule->>'min_nights')::integer desc
    limit 1
  ) selected on true
),
legacy_oracle as (
  select count(*)::integer case_count,
    count(*) filter(where selected_threshold is distinct from expected_threshold
      or selected_rate is distinct from expected_rate
      or round(selected_rate*nights,2) is distinct from round(expected_rate*nights,2)
    )::integer mismatch_count
  from seven_arches_replay
),
flags as (
  select count(*)::integer settings_count,
    count(*) filter(where not hotel_rooms_v2_enabled
      and not hotel_external_sync_enabled
      and not hotel_instant_booking_enabled
      and not hotel_stripe_connect_enabled)::integer flags_off_count
  from public.site_settings
),
protected_history as (
  select
    (select count(*)::integer from public.hotel_bookings) booking_count,
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
      from public.hotel_bookings row_value) booking_fingerprint,
    (select count(*)::integer from public.partner_service_fulfillments
      where resource_type='hotels') fulfillment_count,
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
      from public.partner_service_fulfillments row_value
      where row_value.resource_type='hotels') fulfillment_fingerprint,
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
      from public.service_deposit_requests row_value
      where row_value.resource_type='hotels') deposit_fingerprint,
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
      from public.service_coupon_redemptions row_value
      where row_value.service_type='hotels') coupon_fingerprint
),
oracle as (
  select
    case when legacy.case_count=70 and legacy.mismatch_count=0
      and room_parity.mismatch_count=0 and party_parity.mismatch_count=0
      then 0 else 1 end hotel_7_arches_occupancy_price_mismatch,
    case when property_state.exact_contract_count=1
      and legacy.case_count=70 and legacy.mismatch_count=0
      then 0 else 1 end hotel_legacy_price_mismatch,
    case when properties.property_count=2 and properties.legacy_count=2
      and properties.rooms_v2_count=0 and property_state.exact_contract_count=1
      and flags.settings_count=1 and flags.flags_off_count=1
      then 0 else 1 end hotel_legacy_public_mismatch,
    case when history.booking_count=3
      and history.booking_fingerprint='fb5a4c508b0df32afbffe5b1594c7a50'
      and history.fulfillment_count=5
      and history.fulfillment_fingerprint='1e01541853d87d26adccb8172074934b'
      and history.deposit_fingerprint='42b5e1dc9726890e90014c3e89c2329d'
      and history.coupon_fingerprint='d41d8cd98f00b204e9800998ecf8427e'
      then 0 else 1 end hotel_booking_payload_unexplained_difference
  from properties cross join property_state cross join legacy_oracle legacy
  cross join room_schedule_mismatch room_parity
  cross join party_schedule_mismatch party_parity
  cross join flags cross join protected_history history
)
select
  properties.property_count,properties.legacy_count,properties.rooms_v2_count,
  property_state.property_count as seven_arches_property_count,
  property_state.exact_contract_count as seven_arches_exact_contract_count,
  property_state.children_policy,property_state.minimum_child_age,
  property_state.property_gallery_count,property_state.legacy_rule_count,
  property_state.legacy_pricing_fingerprint,
  rooms.room_count,rooms.exact_id_count,rooms.unexpected_room_count,
  rooms.upper_exact_count,rooms.ground_exact_count,
  rooms.upper_version,rooms.ground_version,
  rooms.upper_policy_override,rooms.upper_minimum_age_override,
  rooms.upper_effective_policy,rooms.upper_effective_minimum_age,
  rooms.ground_policy_override,rooms.ground_minimum_age_override,
  rooms.ground_effective_policy,rooms.ground_effective_minimum_age,
  rooms.upper_gallery_count,rooms.ground_gallery_count,
  rooms.upper_amenities,rooms.ground_amenities,
  gallery.foreign_photo_count,gallery.duplicate_photo_count,
  rate_plan.property_plan_count,rate_plan.exact_preserved_plan_count,
  rate_plan.preserved_version as rate_plan_version,
  rate_plan.preserved_updated_at as rate_plan_updated_at,
  rate_plan.preserved_policy as rate_plan_cancellation_policy,
  rate_plan.policy_fingerprint as rate_plan_policy_fingerprint,
  rate_plan.row_fingerprint as rate_plan_row_fingerprint,
  room_rates.rate_count,room_rates.upper_exact_count as upper_room_rate_exact_count,
  room_rates.ground_exact_count as ground_room_rate_exact_count,
  room_rates.fingerprint as room_rates_fingerprint,
  schedules.schedule_count,schedules.room_schedule_count,schedules.party_schedule_count,
  schedules.fingerprint as schedules_fingerprint,
  tiers.total_tier_count,tiers.room_tier_count,tiers.party_tier_count,
  tiers.unexpected_or_inactive_tier_count,tiers.fingerprint as tiers_fingerprint,
  room_parity.mismatch_count as room_schedule_value_mismatch,
  party_parity.mismatch_count as property_party_value_mismatch,
  legacy.case_count as legacy_oracle_case_count,
  legacy.mismatch_count as legacy_oracle_mismatch_count,
  flags.flags_off_count,
  history.booking_count,history.booking_fingerprint,
  history.fulfillment_count,history.fulfillment_fingerprint,
  history.deposit_fingerprint,history.coupon_fingerprint,
  oracle.hotel_7_arches_occupancy_price_mismatch as "HOTEL_7_ARCHES_OCCUPANCY_PRICE_MISMATCH",
  oracle.hotel_legacy_price_mismatch as "HOTEL_LEGACY_PRICE_MISMATCH",
  oracle.hotel_legacy_public_mismatch as "HOTEL_LEGACY_PUBLIC_MISMATCH",
  oracle.hotel_booking_payload_unexplained_difference as "HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE",
  (
    properties.property_count=2 and properties.legacy_count=2 and properties.rooms_v2_count=0
    and property_state.property_count=1 and property_state.exact_contract_count=1
    and property_state.children_policy='minimum_age' and property_state.minimum_child_age=15
    and property_state.property_gallery_count=9 and property_state.legacy_rule_count=63
    and rooms.room_count=2 and rooms.exact_id_count=2 and rooms.unexpected_room_count=0
    and rooms.upper_exact_count=1 and rooms.ground_exact_count=1
    and rooms.upper_gallery_count=6 and rooms.ground_gallery_count=5
    and gallery.upper_gallery_count=rooms.upper_gallery_count
    and gallery.ground_gallery_count=rooms.ground_gallery_count
    and gallery.foreign_photo_count=0 and gallery.duplicate_photo_count=0
    and rate_plan.property_plan_count=1 and rate_plan.exact_preserved_plan_count=1
    and rate_plan.preserved_version=2
    and rate_plan.preserved_policy=constants.accepted_cancellation_policy
    and rate_plan.policy_fingerprint=md5(constants.accepted_cancellation_policy::text)
    and room_rates.rate_count=2 and room_rates.upper_exact_count=1 and room_rates.ground_exact_count=1
    and schedules.schedule_count=2 and schedules.room_schedule_count=1 and schedules.party_schedule_count=1
    and tiers.total_tier_count=90 and tiers.room_tier_count=27 and tiers.party_tier_count=63
    and tiers.unexpected_or_inactive_tier_count=0
    and room_parity.mismatch_count=0 and party_parity.mismatch_count=0
    and flags.settings_count=1 and flags.flags_off_count=1
    and oracle.hotel_7_arches_occupancy_price_mismatch=0
    and oracle.hotel_legacy_price_mismatch=0
    and oracle.hotel_legacy_public_mismatch=0
    and oracle.hotel_booking_payload_unexplained_difference=0
  ) hotels_v2_h2b2_seven_arches_policy_15_safe
from constants cross join properties cross join property_state cross join rooms
cross join gallery_audit gallery cross join rate_plan cross join room_rates
cross join schedules cross join tier_counts tiers
cross join room_schedule_mismatch room_parity
cross join party_schedule_mismatch party_parity
cross join legacy_oracle legacy cross join flags
cross join protected_history history cross join oracle;
