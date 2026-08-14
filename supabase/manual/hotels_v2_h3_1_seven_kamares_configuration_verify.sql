-- Hotels V2 H3.1 post-Admin 7 Kamares configuration verification (READ ONLY).
-- Run only after the reviewed "Apply 7 Kamares setup" Admin save succeeds.
-- This verifies shadow configuration; it does not authorize public activation.

with
constants as (
  select
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid hotel_id,
    'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid upper_id,
    '825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid ground_id,
    '22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid rate_plan_id,
    '7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid upper_rate_id,
    '3320590d-632d-423f-80d0-fd021cba7293'::uuid ground_rate_id,
    'b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid room_schedule_id,
    '443065c0-984a-5de3-a22a-d03042c41107'::uuid party_schedule_id
),
property_state as (
  select count(*)::integer property_count,
    count(*) filter(where architecture_version='legacy' and minimum_stay_nights=2
      and children_policy='minimum_age' and minimum_child_age=15
      and booking_mode='request_confirmation' and currency='EUR'
      and check_in_from='14:00'::time and check_out_until='11:00'::time
      and jsonb_array_length(photos)=9 and jsonb_array_length(pricing_tiers->'rules')=63)::integer exact_count,
    max(md5(pricing_tiers::text)) legacy_pricing_fingerprint
  from public.hotels hotel cross join constants where hotel.id=constants.hotel_id
),
partner_state as (
  select
    count(*) filter(where owner.id is not null and owner.status='active'
      and owner.can_manage_hotels)::integer eligible_owner_count,
    (select count(*)::integer
      from public.partner_resources assignment cross join constants
      where assignment.resource_type='hotels'
        and assignment.resource_id=constants.hotel_id)::integer operational_assignment_count,
    (select count(*)::integer
      from public.partner_resources assignment
      join public.hotels property
        on property.id=assignment.resource_id
       and assignment.resource_type='hotels'
      cross join constants
      where property.id=constants.hotel_id
        and assignment.partner_id=property.owner_partner_id)::integer owner_is_operational_count
  from public.hotels property
  cross join constants
  left join public.partners owner on owner.id=property.owner_partner_id
  where property.id=constants.hotel_id
),
room_state as (
  select count(*)::integer room_count,
    count(*) filter(where room.id=constants.upper_id and room.status='active'
      and room.max_occupancy=4 and room.base_inventory_count=1
      and room.children_policy_override is null and room.minimum_child_age_override is null
      and room.amenities=array['air_conditioning','balcony','terrace']::text[]
      and jsonb_array_length(room.gallery)>0)::integer upper_exact_count,
    count(*) filter(where room.id=constants.ground_id and room.status='active'
      and room.max_occupancy=4 and room.base_inventory_count=1
      and room.children_policy_override is null and room.minimum_child_age_override is null
      and room.amenities=array['air_conditioning','terrace']::text[]
      and jsonb_array_length(room.gallery)>0)::integer ground_exact_count,
    count(*) filter(where exists(
      select 1 from jsonb_array_elements(room.gallery) room_photo
      where not exists(select 1 from public.hotels property
        cross join lateral jsonb_array_elements(property.photos) property_photo
        where property.id=room.hotel_id and property_photo.value=room_photo.value)
    ))::integer foreign_gallery_count
  from public.hotel_room_types room cross join constants where room.hotel_id=constants.hotel_id
),
rate_state as (
  select
    (select count(*) from public.hotel_rate_plans plan cross join constants
      where plan.hotel_id=constants.hotel_id and plan.id=constants.rate_plan_id
        and not plan.is_active and plan.cancellation_policy='{"type":"non_refundable"}'::jsonb
        and cardinality(plan.price_inclusions)=2
        and plan.price_inclusions@>array['cleaning','taxes']::text[])::integer rate_plan_count,
    (select count(*) from public.hotel_room_rates rate cross join constants
      where rate.hotel_id=constants.hotel_id and not rate.is_active)::integer inactive_room_rate_count,
    (select count(*) from public.hotel_room_rates rate cross join constants
      where rate.id=constants.upper_rate_id and rate.hotel_id=constants.hotel_id
        and rate.room_type_id=constants.upper_id and rate.rate_plan_id=constants.rate_plan_id
        and rate.pricing_schedule_id=constants.room_schedule_id
        and rate.currency='EUR' and not rate.is_active)::integer upper_room_rate_count,
    (select count(*) from public.hotel_room_rates rate cross join constants
      where rate.id=constants.ground_rate_id and rate.hotel_id=constants.hotel_id
        and rate.room_type_id=constants.ground_id and rate.rate_plan_id=constants.rate_plan_id
        and rate.pricing_schedule_id=constants.room_schedule_id
        and rate.currency='EUR' and not rate.is_active)::integer ground_room_rate_count,
    (select count(*) from public.hotel_pricing_schedules schedule cross join constants
      where schedule.hotel_id=constants.hotel_id
        and schedule.id in (constants.room_schedule_id,constants.party_schedule_id)
        and not schedule.is_active and schedule.minimum_billable_occupancy=2)::integer schedule_count,
    (select count(*) from public.hotel_pricing_schedule_occupancy_tiers tier cross join constants
      where tier.schedule_id=constants.room_schedule_id)::integer room_tier_count,
    (select count(*) from public.hotel_pricing_schedule_occupancy_tiers tier cross join constants
      where tier.schedule_id=constants.party_schedule_id)::integer party_tier_count,
    (select count(*) from public.hotel_pricing_schedules schedule cross join constants cross join property_state
      where schedule.id in (constants.room_schedule_id,constants.party_schedule_id)
        and schedule.source_reference->>'pricing_fingerprint'=property_state.legacy_pricing_fingerprint)::integer fingerprint_count
),
allocation_state as (
  select
    count(*)::integer rule_count,
    count(*) filter(where is_active and review_status='reviewed')::integer active_reviewed_count,
    count(*) filter(where code='guests-1-4-choice' and allocation_mode='customer_choice'
      and min_guest_count=1 and max_guest_count=4 and is_active and review_status='reviewed')::integer choice_count,
    count(*) filter(where code in ('guests-5-bundle','guests-6-bundle','guests-7-bundle','guests-8-bundle')
      and allocation_mode='required_bundle' and min_guest_count=max_guest_count
      and min_guest_count between 5 and 8 and is_active and review_status='reviewed')::integer bundle_count
  from public.hotel_room_allocation_rules rule cross join constants where rule.hotel_id=constants.hotel_id
),
allocation_items as (
  select count(*)::integer item_count,
    count(*) filter(where rule.code='guests-1-4-choice' and item.allocated_guest_count is null
      and item.units_required=1 and item.room_type_id in (constants.upper_id,constants.ground_id))::integer choice_item_count,
    count(*) filter(where rule.code='guests-5-bundle' and item.allocated_guest_count in (2,3))::integer five_item_count,
    count(*) filter(where rule.code='guests-5-bundle' and (
      (item.room_type_id=constants.upper_id and item.allocated_guest_count=3)
      or (item.room_type_id=constants.ground_id and item.allocated_guest_count=2)
    ))::integer five_exact_item_count,
    count(*) filter(where rule.code='guests-6-bundle' and item.allocated_guest_count=3
      and item.room_type_id in (constants.upper_id,constants.ground_id))::integer six_exact_item_count,
    count(*) filter(where rule.code='guests-7-bundle' and (
      (item.room_type_id=constants.upper_id and item.allocated_guest_count=4)
      or (item.room_type_id=constants.ground_id and item.allocated_guest_count=3)
    ))::integer seven_exact_item_count,
    count(*) filter(where rule.code='guests-8-bundle' and item.allocated_guest_count=4
      and item.room_type_id in (constants.upper_id,constants.ground_id))::integer eight_exact_item_count,
    sum(item.allocated_guest_count) filter(where rule.code='guests-5-bundle')::integer five_split_total,
    sum(item.allocated_guest_count) filter(where rule.code='guests-6-bundle')::integer six_split_total,
    sum(item.allocated_guest_count) filter(where rule.code='guests-7-bundle')::integer seven_split_total,
    sum(item.allocated_guest_count) filter(where rule.code='guests-8-bundle')::integer eight_split_total
  from public.hotel_room_allocation_rule_items item
  join public.hotel_room_allocation_rules rule on rule.id=item.allocation_rule_id
  cross join constants where rule.hotel_id=constants.hotel_id
),
payment_state as (
  select
    (select count(*) from public.hotel_payment_policies policy cross join constants
      where policy.hotel_id=constants.hotel_id)::integer total_policy_count,
    (select count(*) from public.hotel_payment_policies policy cross join constants
      where policy.hotel_id=constants.hotel_id and policy.code='seven-kamares-request-confirmation'
        and policy.is_active and policy.review_status='reviewed' and policy.currency='EUR')::integer policy_count,
    (select count(*) from public.hotel_payment_policy_terms term
      join public.hotel_payment_policies policy on policy.id=term.payment_policy_id cross join constants
      where policy.hotel_id=constants.hotel_id and policy.code='seven-kamares-request-confirmation')::integer term_count,
    (select count(*) from public.hotel_payment_policy_terms term
      join public.hotel_payment_policies policy on policy.id=term.payment_policy_id cross join constants
      where policy.hotel_id=constants.hotel_id and policy.code='seven-kamares-request-confirmation'
        and term.sequence=1 and term.due_event='after_partner_acceptance'
        and term.amount_mode='percent_total' and term.amount_value=50
        and term.recipient='partner' and term.payment_methods=array['bank_transfer']::text[])::integer acceptance_term_count,
    (select count(*) from public.hotel_payment_policy_terms term
      join public.hotel_payment_policies policy on policy.id=term.payment_policy_id cross join constants
      where policy.hotel_id=constants.hotel_id and policy.code='seven-kamares-request-confirmation'
        and term.sequence=2 and term.due_event='on_arrival'
        and term.amount_mode='remaining_balance' and term.amount_value is null
        and term.recipient='partner' and cardinality(term.payment_methods)=2
        and term.payment_methods@>array['cash','card']::text[])::integer arrival_term_count
),
commercial_state as (
  select
    (select count(*) from public.hotel_commission_policies policy cross join constants
      where policy.hotel_id=constants.hotel_id)::integer total_commission_count,
    (select count(*) from public.hotel_commission_policies policy cross join constants
      where policy.hotel_id=constants.hotel_id and policy.code='seven-kamares-platform-commission'
        and policy.commission_mode='per_allocated_room_per_night'
        and policy.amount=10 and policy.currency='EUR'
        and policy.is_active and policy.review_status='reviewed')::integer commission_count,
    (select count(*) from public.hotel_calendar_source_configs source_row cross join constants
      where source_row.hotel_id=constants.hotel_id and source_row.code='manual-primary'
        and source_row.source_type='manual' and source_row.room_type_id is null
        and source_row.external_reference is null and source_row.configuration='{}'::jsonb
        and source_row.priority=100
        and source_row.is_enabled and source_row.review_status='reviewed')::integer manual_source_count,
    (select count(*) from public.hotel_calendar_source_configs source_row cross join constants
      where source_row.hotel_id=constants.hotel_id)::integer total_source_count,
    (select count(*) from public.hotel_calendar_source_configs source_row cross join constants
      where source_row.hotel_id=constants.hotel_id and source_row.source_type<>'manual'
        and source_row.is_enabled)::integer enabled_external_count
),
calendar_state as (
  select
    (select count(*)::integer
      from public.hotel_daily_inventory inventory
      join public.hotel_room_types room on room.id=inventory.room_type_id
      cross join constants where room.hotel_id=constants.hotel_id) daily_inventory_count,
    (select count(*)::integer
      from public.hotel_daily_rates daily_rate
      join public.hotel_room_rates room_rate on room_rate.id=daily_rate.room_rate_id
      cross join constants where room_rate.hotel_id=constants.hotel_id) daily_rate_count,
    (select count(*)::integer
      from public.hotel_rate_rules rule_row
      join public.hotel_room_rates room_rate on room_rate.id=rule_row.room_rate_id
      cross join constants where room_rate.hotel_id=constants.hotel_id) rate_rule_count,
    (select count(*)::integer from public.hotel_calendar_overrides override_row
      cross join constants where override_row.hotel_id=constants.hotel_id) override_count
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
    (select count(*)::integer from public.partner_service_fulfillments
      where resource_type='hotels') fulfillment_count,
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
      from public.partner_service_fulfillments row_value where resource_type='hotels') fulfillment_fingerprint
),
oracle as (
  select
    case when rates.room_tier_count=27 and rates.party_tier_count=63
      and rates.fingerprint_count=2 then 0 else 1 end hotel_7_arches_occupancy_price_mismatch,
    case when property_state.exact_count=1 and rates.room_tier_count=27
      and rates.party_tier_count=63 and rates.fingerprint_count=2 then 0 else 1 end hotel_legacy_price_mismatch,
    case when property_state.exact_count=1 and flags.all_off_count=1 then 0 else 1 end hotel_legacy_public_mismatch,
    case when history.booking_count=3
      and history.booking_fingerprint='fb5a4c508b0df32afbffe5b1594c7a50'
      and history.fulfillment_count=5
      and history.fulfillment_fingerprint='1e01541853d87d26adccb8172074934b'
      then 0 else 1 end hotel_booking_payload_unexplained_difference
  from property_state cross join rate_state rates cross join flags cross join history
)
select
  property_state.property_count,partners.eligible_owner_count,
  partners.operational_assignment_count,partners.owner_is_operational_count,
  rooms.room_count,rates.rate_plan_count,
  rates.inactive_room_rate_count,rates.schedule_count,rates.room_tier_count,rates.party_tier_count,
  allocations.rule_count,allocations.active_reviewed_count,items.item_count,
  payments.policy_count,payments.term_count,commercial.commission_count,commercial.manual_source_count,
  calendar.daily_inventory_count,calendar.daily_rate_count,
  calendar.rate_rule_count,calendar.override_count,
  history.booking_count,history.booking_fingerprint,history.fulfillment_count,history.fulfillment_fingerprint,
  oracle.hotel_7_arches_occupancy_price_mismatch as "HOTEL_7_ARCHES_OCCUPANCY_PRICE_MISMATCH",
  oracle.hotel_legacy_price_mismatch as "HOTEL_LEGACY_PRICE_MISMATCH",
  oracle.hotel_legacy_public_mismatch as "HOTEL_LEGACY_PUBLIC_MISMATCH",
  oracle.hotel_booking_payload_unexplained_difference as "HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE",
  (
    property_state.property_count=1 and property_state.exact_count=1
    and partners.eligible_owner_count=1 and partners.operational_assignment_count=1
    and partners.owner_is_operational_count=1
    and rooms.room_count=2 and rooms.upper_exact_count=1 and rooms.ground_exact_count=1
    and rooms.foreign_gallery_count=0
    and rates.rate_plan_count=1 and rates.inactive_room_rate_count=2
    and rates.upper_room_rate_count=1 and rates.ground_room_rate_count=1
    and rates.schedule_count=2
    and rates.room_tier_count=27 and rates.party_tier_count=63 and rates.fingerprint_count=2
    and allocations.rule_count=5 and allocations.active_reviewed_count=5
    and allocations.choice_count=1 and allocations.bundle_count=4
    and items.item_count=10 and items.choice_item_count=2 and items.five_item_count=2
    and items.five_exact_item_count=2 and items.six_exact_item_count=2
    and items.seven_exact_item_count=2 and items.eight_exact_item_count=2
    and items.five_split_total=5 and items.six_split_total=6
    and items.seven_split_total=7 and items.eight_split_total=8
    and payments.total_policy_count=1 and payments.policy_count=1 and payments.term_count=2
    and payments.acceptance_term_count=1 and payments.arrival_term_count=1
    and commercial.total_commission_count=1 and commercial.commission_count=1
    and commercial.total_source_count=1 and commercial.manual_source_count=1
    and commercial.enabled_external_count=0 and flags.all_off_count=1
    and calendar.daily_inventory_count=0 and calendar.daily_rate_count=0
    and calendar.rate_rule_count=0 and calendar.override_count=0
    and oracle.hotel_7_arches_occupancy_price_mismatch=0
    and oracle.hotel_legacy_price_mismatch=0
    and oracle.hotel_legacy_public_mismatch=0
    and oracle.hotel_booking_payload_unexplained_difference=0
  ) hotels_v2_h3_1_seven_kamares_configuration_safe
from property_state cross join partner_state partners cross join room_state rooms cross join rate_state rates
cross join allocation_state allocations cross join allocation_items items
cross join payment_state payments cross join commercial_state commercial
cross join calendar_state calendar cross join flags cross join history cross join oracle;
