\set ON_ERROR_STOP on

-- H3.1P is the inert legacy-pricing-promotion prerequisite before H3.2.

begin;

create temporary table h31p_legacy_prices(
  guest_count integer not null,
  threshold_nights integer not null,
  nightly_rate numeric not null,
  primary key(guest_count,threshold_nights)
) on commit drop;

with matrices(guest_count,rates) as (
  values
    (2,array[100,90,88,84,80,76,74,72,70]::numeric[]),
    (3,array[130,113,113,104,100,95,94,90,90]::numeric[]),
    (4,array[155,135,135,120,118,114,111,107,107]::numeric[]),
    (5,array[200,180,176,168,160,152,148,144,140]::numeric[]),
    (6,array[260,226,226,208,200,190,188,180,180]::numeric[]),
    (7,array[310,270,270,240,236,228,222,214,214]::numeric[]),
    (8,array[310,270,270,240,236,228,222,214,214]::numeric[])
), thresholds(threshold_nights,ordinality) as (
  values (2,1),(3,2),(4,3),(5,4),(6,5),(7,6),(8,7),(9,8),(10,9)
)
insert into h31p_legacy_prices(guest_count,threshold_nights,nightly_rate)
select matrices.guest_count,thresholds.threshold_nights,matrices.rates[thresholds.ordinality]
from matrices cross join thresholds;

create temporary table h31p_room_prices on commit drop as
select * from h31p_legacy_prices where guest_count between 2 and 4;

alter table h31p_room_prices add primary key(guest_count,threshold_nights);

create temporary table h31p_reviewed_allocations(
  party_guest_count integer not null,
  room_ordinal integer not null,
  room_type_id uuid not null,
  allocated_guest_count integer not null,
  pricing_guest_count integer not null,
  primary key(party_guest_count,room_ordinal)
) on commit drop;

insert into h31p_reviewed_allocations values
  (5,1,'b4ef504f-cdeb-4e3c-a54d-932146ef4e94',3,2),
  (5,2,'825c01b7-9f82-492a-9c81-9b1d5cd7acd3',2,2),
  (6,1,'b4ef504f-cdeb-4e3c-a54d-932146ef4e94',3,3),
  (6,2,'825c01b7-9f82-492a-9c81-9b1d5cd7acd3',3,3),
  (7,1,'b4ef504f-cdeb-4e3c-a54d-932146ef4e94',4,4),
  (7,2,'825c01b7-9f82-492a-9c81-9b1d5cd7acd3',3,4),
  (8,1,'b4ef504f-cdeb-4e3c-a54d-932146ef4e94',4,4),
  (8,2,'825c01b7-9f82-492a-9c81-9b1d5cd7acd3',4,4);

create temporary table h31p_bundle_replay on commit drop as
select
  allocation.party_guest_count,
  legacy.threshold_nights,
  legacy.nightly_rate as legacy_party_nightly_rate,
  sum(room.nightly_rate) as allocated_room_nightly_sum,
  sum(room.nightly_rate)-legacy.nightly_rate as nightly_delta
from h31p_reviewed_allocations allocation
join h31p_legacy_prices legacy
  on legacy.guest_count=allocation.party_guest_count
join h31p_room_prices room
  on room.guest_count=allocation.pricing_guest_count
 and room.threshold_nights=legacy.threshold_nights
group by allocation.party_guest_count,legacy.threshold_nights,legacy.nightly_rate;

create temporary table h31p_unsafe_physical_fallback on commit drop as
select
  allocation.party_guest_count,
  legacy.threshold_nights,
  legacy.nightly_rate as legacy_party_nightly_rate,
  sum(room.nightly_rate) as allocated_room_nightly_sum,
  sum(room.nightly_rate)-legacy.nightly_rate as nightly_delta
from h31p_reviewed_allocations allocation
join h31p_legacy_prices legacy
  on legacy.guest_count=allocation.party_guest_count
join h31p_room_prices room
  on room.guest_count=allocation.allocated_guest_count
 and room.threshold_nights=legacy.threshold_nights
group by allocation.party_guest_count,legacy.threshold_nights,legacy.nightly_rate;

create temporary table h31p_choice_replay on commit drop as
with stays(nights,selected_threshold) as (
  values (2,2),(3,3),(4,4),(5,5),(6,6),(7,7),(8,8),(9,9),(10,10),(14,10)
), parties(requested_guest_count) as (
  select generate_series(1,4)
)
select
  parties.requested_guest_count,
  greatest(2,parties.requested_guest_count) as pricing_guest_count,
  stays.nights,
  legacy.nightly_rate as legacy_party_nightly_rate,
  room.nightly_rate as allocated_room_nightly_sum,
  room.nightly_rate-legacy.nightly_rate as nightly_delta
from parties
cross join stays
join h31p_legacy_prices legacy
  on legacy.guest_count=greatest(2,parties.requested_guest_count)
 and legacy.threshold_nights=stays.selected_threshold
join h31p_room_prices room
  on room.guest_count=greatest(2,parties.requested_guest_count)
 and room.threshold_nights=stays.selected_threshold;

create temporary table h31p_bundle_long_stay_replay on commit drop as
select
  allocation.party_guest_count,
  14 as nights,
  legacy.nightly_rate as legacy_party_nightly_rate,
  sum(room.nightly_rate) as allocated_room_nightly_sum,
  sum(room.nightly_rate)-legacy.nightly_rate as nightly_delta
from h31p_reviewed_allocations allocation
join h31p_legacy_prices legacy
  on legacy.guest_count=allocation.party_guest_count
 and legacy.threshold_nights=10
join h31p_room_prices room
  on room.guest_count=allocation.pricing_guest_count
 and room.threshold_nights=10
group by allocation.party_guest_count,legacy.nightly_rate;

do $audit$
declare
  v_mismatch_count integer;
  v_mismatch_guests integer[];
begin
  if (select count(*) from h31p_legacy_prices)<>63 then
    raise exception 'h31p_expected_63_legacy_rules';
  end if;
  if (select count(*) from h31p_room_prices)<>27 then
    raise exception 'h31p_expected_27_room_rules';
  end if;
  if exists(select 1 from h31p_room_prices where guest_count=1) then
    raise exception 'h31p_one_guest_tier_must_not_be_fabricated';
  end if;
  if (select count(*) from h31p_bundle_replay)<>36 then
    raise exception 'h31p_expected_36_bundle_tier_cases';
  end if;
  if (select count(*) from h31p_choice_replay)<>40
     or exists(select 1 from h31p_choice_replay where nightly_delta<>0) then
    raise exception 'h31p_choice_or_one_guest_floor_parity_failed';
  end if;
  if exists(
    select 1 from h31p_choice_replay
    where requested_guest_count=1 and pricing_guest_count<>2
  ) or (select count(*) from h31p_choice_replay where requested_guest_count=1)<>10 then
    raise exception 'h31p_one_guest_must_use_exact_two_guest_floor';
  end if;
  if (select count(*) from h31p_bundle_long_stay_replay)<>4
     or exists(select 1 from h31p_bundle_long_stay_replay where nightly_delta<>0) then
    raise exception 'h31p_bundle_10_plus_continuation_parity_failed';
  end if;
  if exists(
    select 1 from h31p_reviewed_allocations
    where (room_ordinal=1 and room_type_id<>'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid)
       or (room_ordinal=2 and room_type_id<>'825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid)
  ) then
    raise exception 'h31p_exact_room_identity_mapping_changed';
  end if;

  select count(*)
  into v_mismatch_count
  from h31p_bundle_replay
  where nightly_delta<>0;

  if v_mismatch_count<>0 then
    raise exception 'h31p_reviewed_pricing_occupancy_mismatch count=%',v_mismatch_count;
  end if;

  select count(*),array_agg(distinct party_guest_count order by party_guest_count)
  into v_mismatch_count,v_mismatch_guests
  from h31p_unsafe_physical_fallback
  where nightly_delta<>0;

  if v_mismatch_count<>18 or v_mismatch_guests<>array[5,7] then
    raise exception 'h31p_unsafe_physical_fallback_was_not_detected count=% guests=%',
      v_mismatch_count,v_mismatch_guests;
  end if;
  if not exists(
    select 1 from h31p_bundle_replay
    where party_guest_count=5 and threshold_nights=2
      and legacy_party_nightly_rate=200 and allocated_room_nightly_sum=200 and nightly_delta=0
  ) then
    raise exception 'h31p_five_guest_example_changed';
  end if;
  if not exists(
    select 1 from h31p_bundle_replay
    where party_guest_count=7 and threshold_nights=2
      and legacy_party_nightly_rate=310 and allocated_room_nightly_sum=310 and nightly_delta=0
  ) then
    raise exception 'h31p_seven_guest_example_changed';
  end if;
  if not exists(
    select 1 from h31p_unsafe_physical_fallback
    where party_guest_count=5 and threshold_nights=2 and nightly_delta=30
  ) or not exists(
    select 1 from h31p_unsafe_physical_fallback
    where party_guest_count=7 and threshold_nights=2 and nightly_delta=-25
  ) then
    raise exception 'h31p_physical_fallback_guard_changed';
  end if;
end
$audit$;

select
  '7208ab4ecc0e47abd64d87ca1ac53a03'::text as accepted_legacy_pricing_fingerprint,
  (select count(*) from h31p_legacy_prices) as legacy_rule_count,
  (select count(*) from h31p_room_prices) as room_rule_count,
  (select count(*) from h31p_bundle_replay) as bundle_tier_case_count,
  63::integer as threshold_case_count,
  7::integer as long_stay_case_count,
  70::integer as total_legacy_parity_case_count,
  (select count(*) from h31p_choice_replay where requested_guest_count=1) as one_guest_floor_case_count,
  (select count(*) from h31p_bundle_replay where nightly_delta<>0) as allocation_sum_price_mismatch,
  ((select count(*) from h31p_choice_replay
      where requested_guest_count between 2 and 4 and nightly_delta<>0)
   +(select count(*) from h31p_bundle_replay where nightly_delta<>0))::integer
    as threshold_price_mismatch,
  ((select count(*) from h31p_choice_replay where requested_guest_count between 2 and 4 and nights=14 and nightly_delta<>0)
   +(select count(*) from h31p_bundle_long_stay_replay where nightly_delta<>0))::integer
    as long_stay_price_mismatch,
  (select count(*) from h31p_unsafe_physical_fallback where nightly_delta<>0) as unsafe_physical_fallback_mismatch,
  true as exact_legacy_parity_with_reviewed_pricing_occupancy;

rollback;
