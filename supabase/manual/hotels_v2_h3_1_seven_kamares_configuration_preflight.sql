-- Hotels V2 H3.1 7 Kamares post-foundation / pre-Admin preflight (READ ONLY).
-- Run after the H3.1 foundation, deferred-trigger authorization repair, and
-- reviewed Overview save of check-in 14:00 / check-out 11:00; then run it
-- immediately before the reviewed 7 Kamares Booking setup save. This query
-- accepts only an empty configuration or the exact idempotently saved contract.

with
constants as (
  select
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid hotel_id,
    'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1'::uuid rgb_id,
    'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid upper_id,
    '825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid ground_id,
    '22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid rate_plan_id,
    '7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid upper_rate_id,
    '3320590d-632d-423f-80d0-fd021cba7293'::uuid ground_rate_id,
    'b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid room_schedule_id,
    '443065c0-984a-5de3-a22a-d03042c41107'::uuid party_schedule_id,
    array['air_conditioning','balcony','terrace']::text[] upper_amenities,
    array['air_conditioning','terrace']::text[] ground_amenities
),
properties as (
  select count(*)::integer property_count,
    count(*) filter(where architecture_version='legacy')::integer legacy_count,
    count(*) filter(where architecture_version='rooms_v2')::integer rooms_v2_count,
    array_agg(id order by id) property_ids
  from public.hotels
),
property_state as (
  select count(*)::integer property_count,
    count(*) filter(where hotel.slug='7-ukow'
      and hotel.pricing_model='tiered_by_nights' and hotel.max_persons=8
      and hotel.pricing_tiers->>'currency'='EUR'
      and jsonb_typeof(hotel.pricing_tiers->'rules')='array'
      and jsonb_array_length(hotel.pricing_tiers->'rules')=63)::integer legacy_price_contract_count,
    count(*) filter(where hotel.slug='7-ukow'
      and hotel.architecture_version='legacy' and hotel.is_published
      and hotel.status='draft' and hotel.submission_status='draft'
      and hotel.booking_mode='request_confirmation'
      and jsonb_typeof(hotel.photos)='array'
      and jsonb_array_length(hotel.photos)=9)::integer legacy_public_contract_count,
    count(*) filter(where hotel.slug='7-ukow'
      and hotel.architecture_version='legacy' and hotel.is_published
      and hotel.status='draft' and hotel.submission_status='draft'
      and hotel.pricing_model='tiered_by_nights' and hotel.max_persons=8
      and hotel.children_policy='minimum_age' and hotel.minimum_child_age=15
      and hotel.booking_mode='request_confirmation' and hotel.currency='EUR'
      and hotel.check_in_from='14:00'::time and hotel.check_out_until='11:00'::time
      and jsonb_typeof(hotel.photos)='array' and jsonb_array_length(hotel.photos)=9
      and hotel.pricing_tiers->>'currency'='EUR'
      and jsonb_typeof(hotel.pricing_tiers->'rules')='array'
      and jsonb_array_length(hotel.pricing_tiers->'rules')=63)::integer exact_count,
    max(hotel.updated_at) updated_at,
    max(hotel.minimum_stay_nights) minimum_stay_nights,
    max(hotel.check_in_from) check_in_from,
    max(hotel.check_out_until) check_out_until,
    max(md5(hotel.pricing_tiers::text)) legacy_pricing_fingerprint
  from public.hotels hotel cross join constants where hotel.id=constants.hotel_id
),
partner_state as (
  select
    (array_agg(property.owner_partner_id) filter(where property.owner_partner_id is not null))[1]
      owner_partner_id,
    count(*) filter(where owner.id is not null and owner.status='active'
      and owner.can_manage_hotels)::integer eligible_owner_count,
    (select count(*)::integer from public.partner_resources assignment cross join constants
      where assignment.resource_type='hotels'
        and assignment.resource_id=constants.hotel_id)::integer operational_assignment_count,
    (select count(*)::integer
      from public.partner_resources assignment
      join public.hotels property on property.id=assignment.resource_id
        and assignment.resource_type='hotels'
      cross join constants where property.id=constants.hotel_id
        and assignment.partner_id=property.owner_partner_id)::integer owner_is_operational_count
  from public.hotels property cross join constants
  left join public.partners owner on owner.id=property.owner_partner_id
  where property.id=constants.hotel_id
),
room_state as (
  select count(*)::integer room_count,
    count(*) filter(where room.id=constants.upper_id and room.status='active'
      and room.legacy_source_key='upper_floor_apartment'
      and room.code='upper-floor-apartment'
      and room.max_occupancy=4
      and room.capacity_adults is null and room.capacity_children is null
      and room.inventory_mode='pooled' and room.base_inventory_count=1
      and room.children_policy_override is null and room.minimum_child_age_override is null
      and room.amenities@>constants.upper_amenities
      and constants.upper_amenities@>room.amenities
      and cardinality(room.amenities)=cardinality(constants.upper_amenities)
      and jsonb_typeof(room.gallery)='array' and jsonb_array_length(room.gallery)=6)::integer upper_exact_count,
    count(*) filter(where room.id=constants.ground_id and room.status='active'
      and room.legacy_source_key='ground_floor_apartment'
      and room.code='ground-floor-apartment'
      and room.max_occupancy=4
      and room.capacity_adults is null and room.capacity_children is null
      and room.inventory_mode='pooled' and room.base_inventory_count=1
      and room.children_policy_override is null and room.minimum_child_age_override is null
      and room.amenities@>constants.ground_amenities
      and constants.ground_amenities@>room.amenities
      and cardinality(room.amenities)=cardinality(constants.ground_amenities)
      and not (room.amenities@>array['balcony']::text[])
      and jsonb_typeof(room.gallery)='array' and jsonb_array_length(room.gallery)=5)::integer ground_exact_count,
    max(room.version) filter(where room.id=constants.upper_id) upper_version,
    max(room.updated_at) filter(where room.id=constants.upper_id) upper_updated_at,
    max(room.version) filter(where room.id=constants.ground_id) ground_version,
    max(room.updated_at) filter(where room.id=constants.ground_id) ground_updated_at
  from public.hotel_room_types room cross join constants where room.hotel_id=constants.hotel_id
),
gallery_rows as (
  select room.id room_id,photo.value photo
  from public.hotel_room_types room
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(room.gallery)='array' then room.gallery else '[]'::jsonb end
  ) photo(value)
  cross join constants where room.hotel_id=constants.hotel_id
),
gallery_state as (
  select
    count(*) filter(where room_photo.room_id=constants.upper_id)::integer upper_gallery_count,
    count(*) filter(where room_photo.room_id=constants.ground_id)::integer ground_gallery_count,
    count(*) filter(where not exists(
      select 1 from public.hotels property
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(property.photos)='array' then property.photos else '[]'::jsonb end
      ) property_photo(value)
      where property.id=constants.hotel_id and property_photo.value=room_photo.photo
    ))::integer foreign_photo_count,
    (select count(*)::integer from (
      select duplicate.room_id,duplicate.photo from gallery_rows duplicate
      group by duplicate.room_id,duplicate.photo having count(*)>1
    ) repeated)::integer duplicate_photo_count
  from gallery_rows room_photo cross join constants
),
shadow_state as (
  select
    (select count(*) from public.hotel_units unit_row
      join public.hotel_room_types room on room.id=unit_row.room_type_id
      cross join constants where room.hotel_id=constants.hotel_id)::integer unit_count,
    (select count(*) from public.hotel_rate_plans plan cross join constants
      where plan.hotel_id=constants.hotel_id)::integer total_rate_plan_count,
    (select count(*) from public.hotel_rate_plans plan cross join constants
      where plan.hotel_id=constants.hotel_id and plan.id=constants.rate_plan_id
        and plan.code='standard' and not plan.is_active
        and plan.cancellation_policy='{"type":"non_refundable"}'::jsonb)::integer exact_rate_plan_count,
    (select max(plan.version) from public.hotel_rate_plans plan cross join constants
      where plan.id=constants.rate_plan_id)::bigint rate_plan_version,
    (select max(plan.updated_at) from public.hotel_rate_plans plan cross join constants
      where plan.id=constants.rate_plan_id) rate_plan_updated_at,
    (select count(*) from public.hotel_rate_plans plan cross join constants
      where plan.id=constants.rate_plan_id and plan.price_inclusions='{}'::text[])::integer empty_inclusions_count,
    (select count(*) from public.hotel_rate_plans plan cross join constants
      where plan.id=constants.rate_plan_id and cardinality(plan.price_inclusions)=2
        and plan.price_inclusions@>array['cleaning','taxes']::text[])::integer final_inclusions_count,
    (select count(*) from public.hotel_room_rates rate cross join constants
      where rate.hotel_id=constants.hotel_id)::integer total_room_rate_count,
    (select count(*) from public.hotel_room_rates rate cross join constants
      where rate.id=constants.upper_rate_id and rate.hotel_id=constants.hotel_id
        and rate.room_type_id=constants.upper_id and rate.rate_plan_id=constants.rate_plan_id
        and rate.pricing_schedule_id=constants.room_schedule_id
        and rate.base_nightly_rate=0 and rate.currency='EUR'
        and rate.external_redirect_url is null and not rate.is_active)::integer upper_rate_exact_count,
    (select max(rate.version) from public.hotel_room_rates rate cross join constants
      where rate.id=constants.upper_rate_id)::bigint upper_rate_version,
    (select max(rate.updated_at) from public.hotel_room_rates rate cross join constants
      where rate.id=constants.upper_rate_id) upper_rate_updated_at,
    (select count(*) from public.hotel_room_rates rate cross join constants
      where rate.id=constants.ground_rate_id and rate.hotel_id=constants.hotel_id
        and rate.room_type_id=constants.ground_id and rate.rate_plan_id=constants.rate_plan_id
        and rate.pricing_schedule_id=constants.room_schedule_id
        and rate.base_nightly_rate=0 and rate.currency='EUR'
        and rate.external_redirect_url is null and not rate.is_active)::integer ground_rate_exact_count,
    (select max(rate.version) from public.hotel_room_rates rate cross join constants
      where rate.id=constants.ground_rate_id)::bigint ground_rate_version,
    (select max(rate.updated_at) from public.hotel_room_rates rate cross join constants
      where rate.id=constants.ground_rate_id) ground_rate_updated_at,
    (select count(*) from public.hotel_pricing_schedules schedule cross join constants
      where schedule.hotel_id=constants.hotel_id)::integer total_schedule_count,
    (select count(*) from public.hotel_pricing_schedules schedule cross join constants
      where schedule.id=constants.room_schedule_id and schedule.hotel_id=constants.hotel_id
        and schedule.code='shared-apartment-occupancy-los'
        and schedule.application_scope='room_occupancy' and schedule.currency='EUR'
        and schedule.maximum_party_size=4 and not schedule.is_active
        and schedule.review_status='requires_review' and schedule.source='legacy_preview')::integer room_schedule_exact_count,
    (select max(schedule.version) from public.hotel_pricing_schedules schedule cross join constants
      where schedule.id=constants.room_schedule_id)::bigint room_schedule_version,
    (select max(schedule.updated_at) from public.hotel_pricing_schedules schedule cross join constants
      where schedule.id=constants.room_schedule_id) room_schedule_updated_at,
    (select count(*) from public.hotel_pricing_schedules schedule cross join constants
      where schedule.id=constants.party_schedule_id and schedule.hotel_id=constants.hotel_id
        and schedule.code='legacy-property-party-preview'
        and schedule.application_scope='property_booking_party' and schedule.currency='EUR'
        and schedule.maximum_party_size=8 and not schedule.is_active
        and schedule.review_status='requires_review' and schedule.source='legacy_preview')::integer party_schedule_exact_count,
    (select max(schedule.version) from public.hotel_pricing_schedules schedule cross join constants
      where schedule.id=constants.party_schedule_id)::bigint party_schedule_version,
    (select max(schedule.updated_at) from public.hotel_pricing_schedules schedule cross join constants
      where schedule.id=constants.party_schedule_id) party_schedule_updated_at,
    (select count(*) from public.hotel_pricing_schedules schedule cross join constants
      where schedule.hotel_id=constants.hotel_id and schedule.minimum_billable_occupancy=1)::integer floor_one_count,
    (select count(*) from public.hotel_pricing_schedules schedule cross join constants
      where schedule.hotel_id=constants.hotel_id and schedule.minimum_billable_occupancy=2)::integer floor_two_count,
    (select count(*) from public.hotel_pricing_schedule_occupancy_tiers tier
      join public.hotel_pricing_schedules schedule on schedule.id=tier.schedule_id
      cross join constants where schedule.hotel_id=constants.hotel_id)::integer total_tier_count,
    (select count(*) from public.hotel_pricing_schedule_occupancy_tiers tier cross join constants
      where tier.schedule_id=constants.room_schedule_id and tier.is_active)::integer room_tier_count,
    (select count(*) from public.hotel_pricing_schedule_occupancy_tiers tier cross join constants
      where tier.schedule_id=constants.party_schedule_id and tier.is_active)::integer party_tier_count,
    (select count(*) from public.hotel_pricing_schedules schedule cross join constants cross join property_state
      where schedule.id in (constants.room_schedule_id,constants.party_schedule_id)
        and schedule.source_reference->>'pricing_fingerprint'=property_state.legacy_pricing_fingerprint)::integer fingerprint_count
),
room_schedule_mismatch as (
  select count(*)::integer mismatch_count from (
    (select (rule->>'persons')::smallint guest_count,(rule->>'min_nights')::integer threshold_nights,
      (rule->>'price_per_night')::numeric nightly_rate
     from public.hotels hotel
     cross join lateral jsonb_array_elements(hotel.pricing_tiers->'rules') rule
     cross join constants where hotel.id=constants.hotel_id
       and (rule->>'persons')::integer between 2 and 4
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
     cross join constants where hotel.id=constants.hotel_id
       and (rule->>'persons')::integer between 2 and 4)
  ) mismatch
),
party_schedule_mismatch as (
  select count(*)::integer mismatch_count from (
    (select (rule->>'persons')::smallint guest_count,(rule->>'min_nights')::integer threshold_nights,
      (rule->>'price_per_night')::numeric nightly_rate
     from public.hotels hotel
     cross join lateral jsonb_array_elements(hotel.pricing_tiers->'rules') rule
     cross join constants where hotel.id=constants.hotel_id
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
     cross join constants where hotel.id=constants.hotel_id)
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
legacy_oracle as (
  select count(*)::integer case_count,
    count(*) filter(where selected_threshold is distinct from expected_threshold
      or selected_rate is distinct from expected_rate
      or round(selected_rate*nights,2) is distinct from round(expected_rate*nights,2))::integer mismatch_count
  from (
    select expected.persons,duration.nights,
      least(duration.nights,10)::integer expected_threshold,
      expected.rates[least(duration.nights-1,9)] expected_rate,
      selected.min_nights selected_threshold,selected.price_per_night selected_rate
    from seven_arches_expected expected cross join seven_arches_durations duration
    left join lateral (
      select (rule->>'min_nights')::integer min_nights,
        (rule->>'price_per_night')::numeric price_per_night
      from public.hotels hotel
      cross join lateral jsonb_array_elements(hotel.pricing_tiers->'rules') rule
      cross join constants where hotel.id=constants.hotel_id
        and (rule->>'persons')::integer=expected.persons
        and (rule->>'min_nights')::integer<=duration.nights
      order by (rule->>'min_nights')::integer desc limit 1
    ) selected on true
  ) replay
),
allocation_state as (
  select count(*)::integer rule_count,
    count(*) filter(where is_active and review_status='reviewed')::integer active_reviewed_count,
    count(*) filter(where code='guests-1-4-choice' and allocation_mode='customer_choice'
      and min_guest_count=1 and max_guest_count=4 and is_active and review_status='reviewed')::integer choice_count,
    count(*) filter(where code in ('guests-5-bundle','guests-6-bundle','guests-7-bundle','guests-8-bundle')
      and allocation_mode='required_bundle' and min_guest_count=max_guest_count
      and min_guest_count between 5 and 8 and is_active and review_status='reviewed')::integer bundle_count,
    coalesce(jsonb_agg(jsonb_build_object('id',id,'code',code,'version',version,'updated_at',updated_at)
      order by sort_order,id),'[]'::jsonb) row_versions
  from public.hotel_room_allocation_rules rule cross join constants where rule.hotel_id=constants.hotel_id
),
allocation_item_state as (
  select count(*)::integer item_count,
    count(*) filter(where rule.code='guests-1-4-choice' and item.allocated_guest_count is null
      and item.units_required=1 and item.room_type_id in (constants.upper_id,constants.ground_id))::integer choice_item_count,
    count(*) filter(where rule.code='guests-5-bundle' and ((item.room_type_id=constants.upper_id and item.allocated_guest_count=3)
      or (item.room_type_id=constants.ground_id and item.allocated_guest_count=2)))::integer five_exact_count,
    count(*) filter(where rule.code='guests-6-bundle' and item.allocated_guest_count=3
      and item.room_type_id in (constants.upper_id,constants.ground_id))::integer six_exact_count,
    count(*) filter(where rule.code='guests-7-bundle' and ((item.room_type_id=constants.upper_id and item.allocated_guest_count=4)
      or (item.room_type_id=constants.ground_id and item.allocated_guest_count=3)))::integer seven_exact_count,
    count(*) filter(where rule.code='guests-8-bundle' and item.allocated_guest_count=4
      and item.room_type_id in (constants.upper_id,constants.ground_id))::integer eight_exact_count,
    sum(item.allocated_guest_count) filter(where rule.code='guests-5-bundle')::integer five_total,
    sum(item.allocated_guest_count) filter(where rule.code='guests-6-bundle')::integer six_total,
    sum(item.allocated_guest_count) filter(where rule.code='guests-7-bundle')::integer seven_total,
    sum(item.allocated_guest_count) filter(where rule.code='guests-8-bundle')::integer eight_total,
    coalesce(jsonb_agg(jsonb_build_object('id',item.id,'rule_id',item.allocation_rule_id,
      'room_type_id',item.room_type_id,'version',item.version,'updated_at',item.updated_at)
      order by rule.sort_order,item.sort_order,item.id),'[]'::jsonb) row_versions
  from public.hotel_room_allocation_rule_items item
  join public.hotel_room_allocation_rules rule on rule.id=item.allocation_rule_id
  cross join constants where rule.hotel_id=constants.hotel_id
),
payment_state as (
  select
    (select count(*) from public.hotel_payment_policies policy cross join constants
      where policy.hotel_id=constants.hotel_id)::integer policy_count,
    (select count(*) from public.hotel_payment_policies policy cross join constants
      where policy.hotel_id=constants.hotel_id and policy.code='seven-kamares-request-confirmation'
        and policy.is_active and policy.review_status='reviewed' and policy.currency='EUR')::integer exact_policy_count,
    (select count(*) from public.hotel_payment_policy_terms term
      join public.hotel_payment_policies policy on policy.id=term.payment_policy_id
      cross join constants where policy.hotel_id=constants.hotel_id)::integer term_count,
    (select count(*) from public.hotel_payment_policy_terms term
      join public.hotel_payment_policies policy on policy.id=term.payment_policy_id
      cross join constants where policy.hotel_id=constants.hotel_id
        and policy.code='seven-kamares-request-confirmation' and term.sequence=1
        and term.due_event='after_partner_acceptance' and term.amount_mode='percent_total'
        and term.amount_value=50 and term.recipient='partner'
        and term.payment_methods=array['bank_transfer']::text[])::integer acceptance_term_count,
    (select count(*) from public.hotel_payment_policy_terms term
      join public.hotel_payment_policies policy on policy.id=term.payment_policy_id
      cross join constants where policy.hotel_id=constants.hotel_id
        and policy.code='seven-kamares-request-confirmation' and term.sequence=2
        and term.due_event='on_arrival' and term.amount_mode='remaining_balance'
        and term.amount_value is null and term.recipient='partner'
        and cardinality(term.payment_methods)=2
        and term.payment_methods@>array['cash','card']::text[])::integer arrival_term_count,
    (select count(*) from public.hotel_payment_policy_terms term
      join public.hotel_payment_policies policy on policy.id=term.payment_policy_id
      cross join constants where policy.hotel_id=constants.hotel_id
        and policy.code='seven-kamares-request-confirmation' and term.sequence=1
        and term.due_event='after_partner_acceptance'
        and term.payment_methods=array['bank_transfer']::text[]
        and term.instructions_i18n<>'{}'::jsonb)::integer bank_instruction_count,
    (select coalesce(jsonb_agg(jsonb_build_object('id',policy.id,'code',policy.code,
      'version',policy.version,'updated_at',policy.updated_at) order by policy.code,policy.id),'[]'::jsonb)
      from public.hotel_payment_policies policy cross join constants
      where policy.hotel_id=constants.hotel_id) policy_versions,
    (select coalesce(jsonb_agg(jsonb_build_object('id',term.id,'policy_id',term.payment_policy_id,
      'sequence',term.sequence,'version',term.version,'updated_at',term.updated_at)
      order by term.payment_policy_id,term.sequence,term.id),'[]'::jsonb)
      from public.hotel_payment_policy_terms term
      join public.hotel_payment_policies policy on policy.id=term.payment_policy_id
      cross join constants where policy.hotel_id=constants.hotel_id) term_versions
),
commercial_state as (
  select
    (select count(*) from public.hotel_commission_policies policy cross join constants
      where policy.hotel_id=constants.hotel_id)::integer commission_count,
    (select count(*) from public.hotel_commission_policies policy cross join constants
      where policy.hotel_id=constants.hotel_id and policy.code='seven-kamares-platform-commission'
        and policy.commission_mode='per_allocated_room_per_night' and policy.amount=10
        and policy.currency='EUR' and policy.is_active and policy.review_status='reviewed')::integer exact_commission_count,
    (select count(*) from public.hotel_calendar_source_configs source_row cross join constants
      where source_row.hotel_id=constants.hotel_id)::integer source_count,
    (select count(*) from public.hotel_calendar_source_configs source_row cross join constants
      where source_row.hotel_id=constants.hotel_id and source_row.code='manual-primary'
        and source_row.source_type='manual' and source_row.room_type_id is null
        and source_row.external_reference is null and source_row.configuration='{}'::jsonb
        and source_row.priority=100 and source_row.is_enabled
        and source_row.review_status='reviewed')::integer exact_manual_source_count,
    (select coalesce(jsonb_agg(jsonb_build_object('id',policy.id,'code',policy.code,
      'version',policy.version,'updated_at',policy.updated_at) order by policy.code,policy.id),'[]'::jsonb)
      from public.hotel_commission_policies policy cross join constants
      where policy.hotel_id=constants.hotel_id) commission_versions,
    (select coalesce(jsonb_agg(jsonb_build_object('id',source_row.id,'code',source_row.code,
      'version',source_row.version,'updated_at',source_row.updated_at) order by source_row.code,source_row.id),'[]'::jsonb)
      from public.hotel_calendar_source_configs source_row cross join constants
      where source_row.hotel_id=constants.hotel_id) source_versions
),
global_h3_rows as (
  select
    (select count(*) from public.hotel_room_allocation_rules)::integer rule_count,
    (select count(*) from public.hotel_room_allocation_rule_items)::integer item_count,
    (select count(*) from public.hotel_payment_policies)::integer policy_count,
    (select count(*) from public.hotel_payment_policy_terms)::integer term_count,
    (select count(*) from public.hotel_commission_policies)::integer commission_count,
    (select count(*) from public.hotel_calendar_source_configs)::integer source_count
),
configuration_mode as (
  select
    (property_state.minimum_stay_nights is null
      and shadow.floor_one_count=2 and shadow.floor_two_count=0
      and shadow.empty_inclusions_count=1 and shadow.final_inclusions_count=0
      and allocations.rule_count=0 and items.item_count=0
      and payments.policy_count=0 and payments.term_count=0
      and commercial.commission_count=0 and commercial.source_count=0
      and global_rows.rule_count=0 and global_rows.item_count=0
      and global_rows.policy_count=0 and global_rows.term_count=0
      and global_rows.commission_count=0 and global_rows.source_count=0) empty_configuration,
    (property_state.minimum_stay_nights=2
      and shadow.floor_one_count=0 and shadow.floor_two_count=2
      and shadow.empty_inclusions_count=0 and shadow.final_inclusions_count=1
      and allocations.rule_count=5 and allocations.active_reviewed_count=5
      and allocations.choice_count=1 and allocations.bundle_count=4
      and items.item_count=10 and items.choice_item_count=2
      and items.five_exact_count=2 and items.six_exact_count=2
      and items.seven_exact_count=2 and items.eight_exact_count=2
      and items.five_total=5 and items.six_total=6 and items.seven_total=7 and items.eight_total=8
      and payments.policy_count=1 and payments.exact_policy_count=1
      and payments.term_count=2 and payments.acceptance_term_count=1 and payments.arrival_term_count=1
      and commercial.commission_count=1 and commercial.exact_commission_count=1
      and commercial.source_count=1 and commercial.exact_manual_source_count=1
      and global_rows.rule_count=5 and global_rows.item_count=10
      and global_rows.policy_count=1 and global_rows.term_count=2
      and global_rows.commission_count=1 and global_rows.source_count=1) idempotently_configured
  from property_state cross join shadow_state shadow
  cross join allocation_state allocations cross join allocation_item_state items
  cross join payment_state payments cross join commercial_state commercial
  cross join global_h3_rows global_rows
),
calendar_state as (
  select
    (select count(*)::integer from public.hotel_daily_inventory inventory
      join public.hotel_room_types room on room.id=inventory.room_type_id
      cross join constants where room.hotel_id=constants.hotel_id) daily_inventory_count,
    (select count(*)::integer from public.hotel_daily_rates daily_rate
      join public.hotel_room_rates room_rate on room_rate.id=daily_rate.room_rate_id
      cross join constants where room_rate.hotel_id=constants.hotel_id) daily_rate_count,
    (select count(*)::integer from public.hotel_rate_rules rule_row
      join public.hotel_room_rates room_rate on room_rate.id=rule_row.room_rate_id
      cross join constants where room_rate.hotel_id=constants.hotel_id) rate_rule_count,
    (select count(*)::integer from public.hotel_calendar_overrides override_row
      cross join constants where override_row.hotel_id=constants.hotel_id) override_count
),
foundation_state as (
  select
    to_regprocedure('public.hotel_v2_admin_get_h3_1_configuration(uuid)') is not null get_rpc_present,
    to_regprocedure('public.hotel_v2_admin_apply_h3_1_configuration(jsonb,uuid)') is not null apply_rpc_present,
    exists(select 1 from pg_proc where oid=to_regprocedure(
      'public.hotel_v2_h3_1_room_inventory_constraint_trigger()')
      and prosecdef and proconfig@>array['search_path=pg_catalog, public']) deferred_trigger_repair_present,
    not exists(select 1 from (values('anon'),('authenticated'),('service_role')) role_name(name)
      where has_function_privilege(role_name.name,
        'public.hotel_v2_h3_1_room_inventory_constraint_trigger()','EXECUTE')) trigger_entrypoint_private,
    exists(select 1 from pg_proc where oid=to_regprocedure(
      'public.hotel_v2_h3_1_validate_room_allocation_inventory(uuid)')
      and not prosecdef) nested_validator_invoker
),
flags as (
  select count(*)::integer settings_count,
    count(*) filter(where id=1 and not hotel_rooms_v2_enabled
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
      from public.partner_service_fulfillments row_value where resource_type='hotels') fulfillment_fingerprint,
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
      from public.service_deposit_requests row_value where row_value.resource_type='hotels') deposit_fingerprint,
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
      from public.service_coupon_redemptions row_value where row_value.service_type='hotels') coupon_fingerprint
),
oracle as (
  select
    case when legacy.case_count=70 and legacy.mismatch_count=0
      and room_parity.mismatch_count=0 and party_parity.mismatch_count=0
      then 0 else 1 end hotel_7_arches_occupancy_price_mismatch,
    case when property_state.legacy_price_contract_count=1
      and legacy.case_count=70 and legacy.mismatch_count=0
      then 0 else 1 end hotel_legacy_price_mismatch,
    case when properties.property_count=2 and properties.legacy_count=2
      and properties.rooms_v2_count=0 and property_state.legacy_public_contract_count=1
      and flags.settings_count=1 and flags.all_off_count=1
      then 0 else 1 end hotel_legacy_public_mismatch,
    case when history.booking_count=3
      and history.booking_fingerprint='fb5a4c508b0df32afbffe5b1594c7a50'
      and history.fulfillment_count=5
      and history.fulfillment_fingerprint='1e01541853d87d26adccb8172074934b'
      and history.deposit_fingerprint='42b5e1dc9726890e90014c3e89c2329d'
      and history.coupon_fingerprint='d41d8cd98f00b204e9800998ecf8427e'
      then 0 else 1 end hotel_booking_payload_unexplained_difference
  from properties cross join property_state cross join legacy_oracle legacy
  cross join room_schedule_mismatch room_parity cross join party_schedule_mismatch party_parity
  cross join flags cross join history
)
select
  constants.hotel_id,property_state.updated_at as property_updated_at,
  property_state.minimum_stay_nights,property_state.check_in_from,property_state.check_out_until,
  partner.owner_partner_id,partner.operational_assignment_count,
  constants.upper_id,rooms.upper_version,rooms.upper_updated_at,
  constants.ground_id,rooms.ground_version,rooms.ground_updated_at,
  constants.rate_plan_id,shadow.rate_plan_version,shadow.rate_plan_updated_at,
  constants.upper_rate_id,shadow.upper_rate_version,shadow.upper_rate_updated_at,
  constants.ground_rate_id,shadow.ground_rate_version,shadow.ground_rate_updated_at,
  constants.room_schedule_id,shadow.room_schedule_version,shadow.room_schedule_updated_at,
  constants.party_schedule_id,shadow.party_schedule_version,shadow.party_schedule_updated_at,
  allocations.row_versions as allocation_rule_versions,
  items.row_versions as allocation_item_versions,
  payments.policy_versions as payment_policy_versions,
  payments.term_versions as payment_term_versions,
  commercial.commission_versions,commercial.source_versions as calendar_source_versions,
  payments.bank_instruction_count=1 as partner_bank_payment_instructions_present,
  jsonb_strip_nulls(jsonb_build_object(
    'partner_bank_payment_instructions',case when payments.bank_instruction_count<>1 then 'missing' end,
    'rate_plan',case when shadow.exact_rate_plan_count=1 then 'inactive' end,
    'room_rates',case when shadow.total_room_rate_count=2 then 'inactive' end,
    'calendar_inventory',case when calendar.daily_inventory_count=0 then 'not_configured' end,
    'public_capability',case when flags.all_off_count=1 then 'flags_off' end
  )) operational_readiness_blockers,
  case when mode.empty_configuration then 'empty'
    when mode.idempotently_configured then 'idempotently_configured'
    else 'drift' end h3_configuration_state,
  history.booking_count,history.booking_fingerprint,
  history.fulfillment_count,history.fulfillment_fingerprint,
  history.deposit_fingerprint,history.coupon_fingerprint,
  oracle.hotel_7_arches_occupancy_price_mismatch as "HOTEL_7_ARCHES_OCCUPANCY_PRICE_MISMATCH",
  oracle.hotel_legacy_price_mismatch as "HOTEL_LEGACY_PRICE_MISMATCH",
  oracle.hotel_legacy_public_mismatch as "HOTEL_LEGACY_PUBLIC_MISMATCH",
  oracle.hotel_booking_payload_unexplained_difference as "HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE",
  (
    properties.property_count=2 and properties.legacy_count=2 and properties.rooms_v2_count=0
    and properties.property_ids=array[constants.hotel_id,constants.rgb_id]::uuid[]
    and property_state.property_count=1 and property_state.exact_count=1
    and partner.eligible_owner_count=1 and partner.operational_assignment_count=1
    and partner.owner_is_operational_count=1
    and rooms.room_count=2 and rooms.upper_exact_count=1 and rooms.ground_exact_count=1
    and gallery.upper_gallery_count=6 and gallery.ground_gallery_count=5
    and gallery.foreign_photo_count=0 and gallery.duplicate_photo_count=0
    and shadow.unit_count=0 and shadow.total_rate_plan_count=1
    and shadow.exact_rate_plan_count=1 and shadow.total_room_rate_count=2
    and shadow.upper_rate_exact_count=1 and shadow.ground_rate_exact_count=1
    and shadow.total_schedule_count=2 and shadow.room_schedule_exact_count=1
    and shadow.party_schedule_exact_count=1 and shadow.total_tier_count=90
    and shadow.room_tier_count=27 and shadow.party_tier_count=63 and shadow.fingerprint_count=2
    and room_parity.mismatch_count=0 and party_parity.mismatch_count=0
    and legacy.case_count=70 and legacy.mismatch_count=0
    and (mode.empty_configuration or mode.idempotently_configured)
    and calendar.daily_inventory_count=0 and calendar.daily_rate_count=0
    and calendar.rate_rule_count=0 and calendar.override_count=0
    and foundation.get_rpc_present and foundation.apply_rpc_present
    and foundation.deferred_trigger_repair_present
    and foundation.trigger_entrypoint_private and foundation.nested_validator_invoker
    and flags.settings_count=1 and flags.all_off_count=1
    and oracle.hotel_7_arches_occupancy_price_mismatch=0
    and oracle.hotel_legacy_price_mismatch=0
    and oracle.hotel_legacy_public_mismatch=0
    and oracle.hotel_booking_payload_unexplained_difference=0
  ) hotels_v2_h3_1_seven_kamares_configuration_preflight_safe
from constants cross join properties cross join property_state cross join partner_state partner
cross join room_state rooms cross join gallery_state gallery cross join shadow_state shadow
cross join room_schedule_mismatch room_parity cross join party_schedule_mismatch party_parity
cross join legacy_oracle legacy cross join allocation_state allocations
cross join allocation_item_state items cross join payment_state payments
cross join commercial_state commercial cross join configuration_mode mode
cross join calendar_state calendar cross join foundation_state foundation
cross join flags cross join history cross join oracle;
