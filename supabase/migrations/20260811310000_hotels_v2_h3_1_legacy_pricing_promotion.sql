begin;
set transaction isolation level repeatable read;

-- Hotels V2 H3.1P: reviewed legacy -> normalized commercial pricing promotion.
--
-- This migration is schema/RPC only.  It does not backfill an allocation,
-- review a schedule, activate a Room Rate, change architecture_version, touch
-- the legacy calculator, or enable a Hotels V2 capability.  The exact Admin
-- promotion RPC below is the only path that writes the reviewed 7 Kamares
-- pricing-occupancy mapping.

lock table public.site_settings in share row exclusive mode;

do $h3_1p_preconditions$
begin
  if to_regclass('public.hotel_room_allocation_rule_items') is null
     or to_regclass('public.hotel_pricing_schedules') is null
     or to_regclass('public.hotel_pricing_schedule_occupancy_tiers') is null
     or to_regclass('public.hotel_room_rates') is null
     or to_regclass('public.hotel_activity_log') is null
     or to_regprocedure('public.hotel_v2_h2a_require_admin()') is null
     or to_regprocedure('public.hotel_v2_h2a_keys_allowed(jsonb,text[])') is null
     or to_regprocedure('public.hotel_v2_h3_1_validate_allocation_rule(uuid)') is null
     or to_regprocedure('public.hotel_v2_admin_get_h3_1_configuration(uuid)') is null
     or to_regprocedure('public.hotel_v2_admin_apply_h3_1_configuration(jsonb,uuid)') is null then
    raise exception using errcode='55000',message='hotels_v2_h3_1p_prerequisite_missing';
  end if;

  if exists(select 1 from information_schema.columns
      where table_schema='public' and table_name='hotel_room_allocation_rule_items'
        and column_name='pricing_guest_count')
     or to_regclass('public.hotel_pricing_promotion_reviews') is not null
     or to_regprocedure('public.hotel_v2_admin_get_legacy_pricing_promotion_preview(uuid)') is not null
     or to_regprocedure('public.hotel_v2_admin_apply_legacy_pricing_promotion(jsonb,uuid)') is not null then
    raise exception using errcode='42P07',message='hotels_v2_h3_1p_objects_already_exist';
  end if;

  if (select count(*) from public.site_settings)<>1
     or exists(select 1 from public.site_settings where id=1 and (
       hotel_rooms_v2_enabled or hotel_external_sync_enabled
       or hotel_instant_booking_enabled or hotel_stripe_connect_enabled
     )) then
    raise exception using errcode='55000',message='hotels_v2_h3_1p_capability_state_unsafe';
  end if;

  if not (select prosecdef from pg_proc
       where oid='public.hotel_v2_admin_apply_h3_1_configuration(jsonb,uuid)'::regprocedure)
     or pg_get_userbyid((select proowner from pg_proc
       where oid='public.hotel_v2_admin_apply_h3_1_configuration(jsonb,uuid)'::regprocedure))<>'postgres'
     or coalesce(array_to_string((select proconfig from pg_proc
       where oid='public.hotel_v2_admin_apply_h3_1_configuration(jsonb,uuid)'::regprocedure),','),'')
       not like '%search_path=pg_catalog, public, auth%' then
    raise exception using errcode='55000',message='hotels_v2_h3_1p_h3_1_apply_security_unsafe';
  end if;
end
$h3_1p_preconditions$;

create temporary table hotels_v2_h3_1p_protected_snapshot(
  relation_name text primary key,
  row_count bigint not null,
  fingerprint text not null
) on commit drop;

insert into hotels_v2_h3_1p_protected_snapshot
select 'hotels',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotels row_value
union all select 'hotel_bookings',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_bookings row_value
union all select 'partner_service_fulfillments',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.partner_service_fulfillments row_value
union all select 'service_deposit_requests',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.service_deposit_requests row_value
union all select 'service_coupon_redemptions',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.service_coupon_redemptions row_value
union all select 'hotel_room_types',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_room_types row_value
union all select 'hotel_rate_plans',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_rate_plans row_value
union all select 'hotel_room_rates',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_room_rates row_value
union all select 'hotel_pricing_schedules',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_pricing_schedules row_value
union all select 'hotel_pricing_schedule_occupancy_tiers',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_pricing_schedule_occupancy_tiers row_value
union all select 'hotel_room_allocation_rules',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_room_allocation_rules row_value
union all select 'hotel_room_allocation_rule_items',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_room_allocation_rule_items row_value
union all select 'hotel_activity_log',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_activity_log row_value
union all select 'site_settings',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.site_settings row_value;

do $h3_1p_optional_referral_snapshots$
declare v_relation text;
begin
  foreach v_relation in array array[
    'referrals','affiliate_commission_events','affiliate_payouts','affiliate_adjustments',
    'affiliate_program_settings','affiliate_referrer_overrides',
    'affiliate_cashout_requests','profile_referral_code_aliases'
  ] loop
    if to_regclass('public.'||v_relation) is not null then
      execute format(
        'insert into hotels_v2_h3_1p_protected_snapshot '
        ||'select %L,count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,''|'' order by to_jsonb(row_value)::text),'''')) '
        ||'from public.%I row_value',
        v_relation,v_relation
      );
    end if;
  end loop;
end
$h3_1p_optional_referral_snapshots$;

alter table public.hotel_room_allocation_rule_items
  add column pricing_guest_count smallint,
  add constraint hotel_room_allocation_rule_items_pricing_guests_check
    check(pricing_guest_count is null or pricing_guest_count between 1 and 50);

comment on column public.hotel_room_allocation_rule_items.pricing_guest_count is
  'Explicit Room Rate occupancy used for a reviewed allocation item. allocated_guest_count remains the physical guest split. NULL means dynamic requested/minimum-billable occupancy for customer_choice, or unreviewed bundle pricing.';

create table public.hotel_pricing_promotion_reviews(
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  contract_version text not null,
  source_fingerprint text not null,
  source_tier_fingerprint text not null,
  target_fingerprint text not null,
  pricing_occupancy_mapping_fingerprint text not null,
  parity_fingerprint text not null,
  parity_case_count integer not null,
  parity_mismatch_count integer not null,
  acknowledged_pricing_occupancy_mapping boolean not null,
  review_status text not null default 'reviewed',
  reviewed_by uuid not null,
  reviewed_at timestamptz not null,
  correlation_id uuid not null unique,
  request_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint hotel_pricing_promotion_reviews_hotel_contract_key
    unique(hotel_id,contract_version),
  constraint hotel_pricing_promotion_reviews_contract_check check(
    contract_version=lower(btrim(contract_version))
    and length(contract_version) between 1 and 120
    and contract_version~'^[a-z0-9][a-z0-9_-]*$'
  ),
  constraint hotel_pricing_promotion_reviews_fingerprints_check check(
    source_fingerprint~'^[0-9a-f]{32}$'
    and source_tier_fingerprint~'^[0-9a-f]{32}$'
    and target_fingerprint~'^[0-9a-f]{32}$'
    and pricing_occupancy_mapping_fingerprint~'^[0-9a-f]{32}$'
    and parity_fingerprint~'^[0-9a-f]{32}$'
    and request_hash~'^[0-9a-f]{32}$'
  ),
  constraint hotel_pricing_promotion_reviews_parity_check check(
    parity_case_count=70 and parity_mismatch_count=0
  ),
  constraint hotel_pricing_promotion_reviews_ack_check check(
    acknowledged_pricing_occupancy_mapping
  ),
  constraint hotel_pricing_promotion_reviews_status_check check(review_status='reviewed'),
  constraint hotel_pricing_promotion_reviews_result_check check(
    jsonb_typeof(result)='object'
    and public.hotel_v2_h2a_keys_allowed(result,array[
      'ok','replayed','correlation_id','review_id','hotel_id','public_change',
      'legacy_authoritative','source_fingerprint','target_fingerprint',
      'pricing_occupancy_mapping_fingerprint','parity','room_schedule',
      'rate_plan','room_rates'
    ])
  )
);

comment on table public.hotel_pricing_promotion_reviews is
  'Immutable Admin review receipt for an inert legacy-to-normalized pricing promotion. Contains no customer data and never activates a public Hotel product.';

alter table public.hotel_pricing_promotion_reviews enable row level security;
create policy hotel_pricing_promotion_reviews_admin_select
on public.hotel_pricing_promotion_reviews for select to authenticated
using(public.is_current_user_admin());
revoke all on table public.hotel_pricing_promotion_reviews from public,anon,authenticated;
grant select on table public.hotel_pricing_promotion_reviews to authenticated;
revoke all on table public.hotel_pricing_promotion_reviews from service_role;
grant select on table public.hotel_pricing_promotion_reviews to service_role;

create function public.hotel_v2_h3_1p_expected_pricing_guest_count(
  p_rule_code text,
  p_room_type_id uuid
)
returns smallint
language sql
immutable
set search_path=pg_catalog
as $function$
  select case
    when p_rule_code='guests-5-bundle' and p_room_type_id in (
      'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid,
      '825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid
    ) then 2
    when p_rule_code='guests-6-bundle' and p_room_type_id in (
      'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid,
      '825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid
    ) then 3
    when p_rule_code in ('guests-7-bundle','guests-8-bundle') and p_room_type_id in (
      'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid,
      '825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid
    ) then 4
    else null
  end::smallint;
$function$;

create function public.hotel_v2_h3_1p_schedule_tier_fingerprint(p_schedule_id uuid)
returns text
language sql
stable
set search_path=pg_catalog,public
as $function$
  select md5(coalesce(string_agg(jsonb_build_object(
    'guest_count',tier.guest_count,
    'threshold_nights',tier.threshold_nights,
    'nightly_rate',tier.nightly_rate,
    'is_active',tier.is_active
  )::text,'|' order by tier.guest_count,tier.threshold_nights,tier.id),''))
  from public.hotel_pricing_schedule_occupancy_tiers tier
  where tier.schedule_id=p_schedule_id;
$function$;

create function public.hotel_v2_h3_1p_source_tier_fingerprint(p_hotel_id uuid)
returns text
language sql
stable
set search_path=pg_catalog,public
as $function$
  select md5(coalesce(string_agg(jsonb_build_object(
    'guest_count',(rule.value->>'persons')::smallint,
    'threshold_nights',(rule.value->>'min_nights')::integer,
    'nightly_rate',(rule.value->>'price_per_night')::numeric
  )::text,'|' order by (rule.value->>'persons')::integer,(rule.value->>'min_nights')::integer),''))
  from public.hotels hotel
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(hotel.pricing_tiers->'rules')='array'
      then hotel.pricing_tiers->'rules' else '[]'::jsonb end
  ) rule(value)
  where hotel.id=p_hotel_id;
$function$;

revoke all on function public.hotel_v2_h3_1p_expected_pricing_guest_count(text,uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_h3_1p_schedule_tier_fingerprint(uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_h3_1p_source_tier_fingerprint(uuid)
  from public,anon,authenticated,service_role;

create function public.hotel_v2_h3_1p_allocation_preview(p_hotel_id uuid)
returns jsonb
language sql
stable
set search_path=pg_catalog,public
as $function$
with
durations(nights) as (
  values (2),(3),(4),(5),(6),(7),(8),(9),(10),(14)
),
requested(guest_count) as (
  select generate_series(1,8)
),
matched_rules as (
  select requested.guest_count,rule.id rule_id,rule.allocation_mode
  from requested
  join public.hotel_room_allocation_rules rule
    on rule.hotel_id=p_hotel_id
   and rule.is_active and rule.review_status='reviewed'
   and requested.guest_count between rule.min_guest_count and rule.max_guest_count
),
numbered_items as (
  select matched.guest_count,matched.rule_id,matched.allocation_mode,
    case when matched.allocation_mode='customer_choice'
      then row_number() over(partition by matched.guest_count order by item.sort_order,item.id)
      else 1 end option_number,
    item.id item_id,item.room_type_id,item.units_required,item.allocated_guest_count,
    case when matched.allocation_mode='customer_choice' then null::smallint
      else public.hotel_v2_h3_1p_expected_pricing_guest_count(rule.code,item.room_type_id)
    end pricing_guest_count,
    case when matched.allocation_mode='customer_choice'
      then greatest(matched.guest_count,schedule.minimum_billable_occupancy)::smallint
      else public.hotel_v2_h3_1p_expected_pricing_guest_count(rule.code,item.room_type_id)
    end resolved_pricing_guest_count,
    room_type.name_i18n room_name,
    room_rate.id room_rate_id,
    item.sort_order
  from matched_rules matched
  join public.hotel_room_allocation_rules rule on rule.id=matched.rule_id
  join public.hotel_room_allocation_rule_items item on item.allocation_rule_id=rule.id
  join public.hotel_room_types room_type
    on room_type.id=item.room_type_id and room_type.hotel_id=rule.hotel_id
  join public.hotel_room_rates room_rate
    on room_rate.room_type_id=item.room_type_id and room_rate.hotel_id=rule.hotel_id
   and room_rate.rate_plan_id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid
   and room_rate.pricing_schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid
   and room_rate.id=case item.room_type_id
     when 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid
       then '7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid
     when '825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid
       then '3320590d-632d-423f-80d0-fd021cba7293'::uuid
     else null::uuid end
  join public.hotel_pricing_schedules schedule on schedule.id=room_rate.pricing_schedule_id
),
priced_rows as (
  select item.guest_count,item.allocation_mode,item.option_number,item.item_id,
    item.room_type_id,item.room_rate_id,item.units_required,item.allocated_guest_count,
    item.pricing_guest_count,item.resolved_pricing_guest_count,item.room_name,item.sort_order,
    duration.nights,
    room_tier.threshold_nights,room_tier.nightly_rate,
    legacy_tier.nightly_rate legacy_nightly_rate
  from numbered_items item
  cross join durations duration
  left join lateral (
    select tier.threshold_nights,tier.nightly_rate
    from public.hotel_pricing_schedule_occupancy_tiers tier
    where tier.schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid
      and tier.is_active
      and tier.guest_count=item.resolved_pricing_guest_count
      and tier.threshold_nights<=duration.nights
    order by tier.threshold_nights desc,tier.id
    limit 1
  ) room_tier on true
  left join lateral (
    select (legacy.value->>'price_per_night')::numeric nightly_rate
    from public.hotels hotel
    cross join lateral jsonb_array_elements(hotel.pricing_tiers->'rules') legacy(value)
    where hotel.id=p_hotel_id
      and (legacy.value->>'persons')::integer=greatest(item.guest_count,2)
      and (legacy.value->>'min_nights')::integer<=duration.nights
    order by (legacy.value->>'min_nights')::integer desc
    limit 1
  ) legacy_tier on true
),
comparisons as (
  select priced.guest_count,priced.allocation_mode,priced.option_number,priced.nights,
    max(priced.threshold_nights)::integer threshold_nights,
    case when count(*)=1 then max(priced.resolved_pricing_guest_count)::integer else null end priced_occupancy,
    jsonb_agg(jsonb_build_object(
      'room_type_id',priced.room_type_id,
      'room_rate_id',priced.room_rate_id,
      'pricing_guest_count',priced.resolved_pricing_guest_count,
      'nightly_rate',priced.nightly_rate
    ) order by priced.sort_order,priced.item_id) room_nightly_rates,
    max(priced.legacy_nightly_rate) legacy_nightly_rate,
    sum(priced.nightly_rate) room_rate_sum
  from priced_rows priced
  group by priced.guest_count,priced.allocation_mode,priced.option_number,priced.nights
),
option_rows as (
  select distinct item.guest_count,item.allocation_mode,item.option_number
  from numbered_items item
),
options as (
  select option_row.guest_count,option_row.allocation_mode,option_row.option_number,
    (select jsonb_agg(jsonb_build_object(
      'room_type_id',item.room_type_id,
      'room_rate_id',item.room_rate_id,
      'room_name',item.room_name,
      'allocated_guest_count',item.allocated_guest_count,
      'pricing_guest_count',item.pricing_guest_count,
      'units_required',item.units_required
    ) order by item.sort_order,item.item_id)
      from numbered_items item
      where item.guest_count=option_row.guest_count
        and item.option_number=option_row.option_number
    ) allocation,
    (select jsonb_agg(jsonb_build_object(
      'nights',comparison.nights,
      'threshold_nights',comparison.threshold_nights,
      'requested_guest_count',comparison.guest_count,
      'priced_occupancy',comparison.priced_occupancy,
      'room_nightly_rates',comparison.room_nightly_rates,
      'legacy_nightly_rate',comparison.legacy_nightly_rate,
      'room_rate_sum',comparison.room_rate_sum,
      'stay_total',comparison.room_rate_sum*comparison.nights,
      'currency','EUR'
    ) order by comparison.nights)
      from comparisons comparison
      where comparison.guest_count=option_row.guest_count
        and comparison.option_number=option_row.option_number
    ) nightly_comparisons
  from option_rows option_row
),
preview_rows as (
  select requested.guest_count,matched.allocation_mode,
    coalesce(jsonb_agg(jsonb_build_object(
      'allocation',options.allocation,
      'nightly_comparisons',options.nightly_comparisons
    ) order by options.option_number) filter(where options.option_number is not null),'[]'::jsonb) options
  from requested
  left join matched_rules matched on matched.guest_count=requested.guest_count
  left join options on options.guest_count=requested.guest_count
  group by requested.guest_count,matched.allocation_mode
)
select coalesce(jsonb_agg(jsonb_build_object(
  'guest_count',preview.guest_count,
  'allocation_mode',preview.allocation_mode,
  'options',preview.options
) order by preview.guest_count),'[]'::jsonb)
from preview_rows preview;
$function$;

create function public.hotel_v2_h3_1p_parity_snapshot(p_hotel_id uuid)
returns jsonb
language sql
stable
set search_path=pg_catalog,public
as $function$
with preview as (
  select public.hotel_v2_h3_1p_allocation_preview(p_hotel_id) value
), comparisons as (
  select (entry.value->>'guest_count')::integer guest_count,
    comparison.value comparison
  from preview
  cross join lateral jsonb_array_elements(preview.value) entry(value)
  cross join lateral jsonb_array_elements(entry.value->'options') option(value)
  cross join lateral jsonb_array_elements(option.value->'nightly_comparisons') comparison(value)
  -- The two customer-choice rooms share the exact same reviewed schedule.
  -- Count only the first identical option in the parity oracle.
  where entry.value->>'allocation_mode'<>'customer_choice'
     or option.value=(entry.value->'options')->0
), normalized as (
  select guest_count,
    (comparison->>'nights')::integer nights,
    (comparison->>'legacy_nightly_rate')::numeric legacy_nightly_rate,
    (comparison->>'room_rate_sum')::numeric room_rate_sum,
    (comparison->>'stay_total')::numeric stay_total
  from comparisons
  where guest_count between 2 and 8
), summary as (
  select count(*)::integer total_case_count,
    count(*) filter(where nights between 2 and 10)::integer threshold_case_count,
    count(*) filter(where nights=14)::integer long_stay_case_count,
    count(*) filter(where room_rate_sum is distinct from legacy_nightly_rate
      or stay_total is distinct from legacy_nightly_rate*nights)::integer total_mismatch_count,
    count(*) filter(where nights between 2 and 10 and (
      room_rate_sum is distinct from legacy_nightly_rate
      or stay_total is distinct from legacy_nightly_rate*nights
    ))::integer threshold_mismatch_count,
    count(*) filter(where nights=14 and (
      room_rate_sum is distinct from legacy_nightly_rate
      or stay_total is distinct from legacy_nightly_rate*nights
    ))::integer long_stay_mismatch_count,
    md5(coalesce(string_agg(jsonb_build_object(
      'guest_count',guest_count,'nights',nights,
      'legacy_nightly_rate',legacy_nightly_rate,
      'room_rate_sum',room_rate_sum,'stay_total',stay_total
    )::text,'|' order by guest_count,nights),'')) fingerprint
  from normalized
)
select jsonb_build_object(
  'threshold_case_count',threshold_case_count,
  'threshold_mismatch_count',threshold_mismatch_count,
  'long_stay_case_count',long_stay_case_count,
  'long_stay_mismatch_count',long_stay_mismatch_count,
  'total_case_count',total_case_count,
  'total_mismatch_count',total_mismatch_count,
  'fingerprint',fingerprint
)
from summary;
$function$;

revoke all on function public.hotel_v2_h3_1p_allocation_preview(uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_h3_1p_parity_snapshot(uuid)
  from public,anon,authenticated,service_role;

create function public.hotel_v2_h3_1p_pricing_promotion_snapshot(p_hotel_id uuid)
returns jsonb
language plpgsql
stable
set search_path=pg_catalog,public
as $function$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_upper constant uuid:='b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
  c_ground constant uuid:='825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
  c_plan constant uuid:='22e47a63-a630-4fb6-8f43-816f2d3fdc17';
  c_upper_rate constant uuid:='7e420964-9cbf-4f1b-abd3-09840af5240f';
  c_ground_rate constant uuid:='3320590d-632d-423f-80d0-fd021cba7293';
  c_schedule constant uuid:='b0a3104f-7b31-5265-a59f-c2d166f11a23';
  c_party constant uuid:='443065c0-984a-5de3-a22a-d03042c41107';
  c_source_fingerprint constant text:='7208ab4ecc0e47abd64d87ca1ac53a03';
  c_contract constant text:='seven_kamares_legacy_to_h3_pricing_v1';
  v_hotel public.hotels%rowtype;
  v_schedule public.hotel_pricing_schedules%rowtype;
  v_party public.hotel_pricing_schedules%rowtype;
  v_plan public.hotel_rate_plans%rowtype;
  v_upper public.hotel_room_types%rowtype;
  v_ground public.hotel_room_types%rowtype;
  v_upper_rate public.hotel_room_rates%rowtype;
  v_ground_rate public.hotel_room_rates%rowtype;
  v_source_tiers jsonb;
  v_room_tiers jsonb;
  v_party_tiers jsonb;
  v_rooms jsonb;
  v_rates jsonb;
  v_allocations jsonb;
  v_allocation_fingerprint text;
  v_mapping_fingerprint text;
  v_target_fingerprint text;
  v_source_tier_fingerprint text;
  v_room_tier_fingerprint text;
  v_party_tier_fingerprint text;
  v_parity jsonb;
  v_expected jsonb;
  v_snapshot_token text;
  v_flags jsonb;
  v_blockers jsonb:='[]'::jsonb;
  v_review public.hotel_pricing_promotion_reviews%rowtype;
  v_current_mapping_count integer;
  v_target_mapping_count integer;
begin
  if p_hotel_id is distinct from c_hotel then
    return jsonb_build_object(
      'contract_version',c_contract,'supported',false,'hotel_id',p_hotel_id,
      'public_change',false,'blockers',jsonb_build_array('unsupported_property_contract')
    );
  end if;

  select * into v_hotel from public.hotels where id=c_hotel;
  select * into v_upper from public.hotel_room_types where id=c_upper and hotel_id=c_hotel;
  select * into v_ground from public.hotel_room_types where id=c_ground and hotel_id=c_hotel;
  select * into v_plan from public.hotel_rate_plans where id=c_plan and hotel_id=c_hotel;
  select * into v_schedule from public.hotel_pricing_schedules where id=c_schedule and hotel_id=c_hotel;
  select * into v_party from public.hotel_pricing_schedules where id=c_party and hotel_id=c_hotel;
  select * into v_upper_rate from public.hotel_room_rates where id=c_upper_rate and hotel_id=c_hotel;
  select * into v_ground_rate from public.hotel_room_rates where id=c_ground_rate and hotel_id=c_hotel;
  select * into v_review from public.hotel_pricing_promotion_reviews
    where hotel_id=c_hotel and contract_version=c_contract;

  if v_hotel.id is null then
    return jsonb_build_object(
      'contract_version',c_contract,'supported',false,'hotel_id',p_hotel_id,
      'public_change',false,'blockers',jsonb_build_array('property_missing')
    );
  end if;

  select jsonb_build_object(
    'hotel_rooms_v2_enabled',setting.hotel_rooms_v2_enabled,
    'hotel_external_sync_enabled',setting.hotel_external_sync_enabled,
    'hotel_instant_booking_enabled',setting.hotel_instant_booking_enabled,
    'hotel_stripe_connect_enabled',setting.hotel_stripe_connect_enabled
  ) into v_flags from public.site_settings setting where setting.id=1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'guest_count',(rule.value->>'persons')::smallint,
    'threshold_nights',(rule.value->>'min_nights')::integer,
    'nightly_rate',(rule.value->>'price_per_night')::numeric
  ) order by (rule.value->>'persons')::integer,(rule.value->>'min_nights')::integer),'[]'::jsonb)
  into v_source_tiers
  from jsonb_array_elements(case when jsonb_typeof(v_hotel.pricing_tiers->'rules')='array'
    then v_hotel.pricing_tiers->'rules' else '[]'::jsonb end) rule(value);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',tier.id,'guest_count',tier.guest_count,
    'threshold_nights',tier.threshold_nights,'nightly_rate',tier.nightly_rate,
    'is_active',tier.is_active,'version',tier.version,'updated_at',tier.updated_at
  ) order by tier.guest_count,tier.threshold_nights,tier.id),'[]'::jsonb)
  into v_room_tiers from public.hotel_pricing_schedule_occupancy_tiers tier
  where tier.schedule_id=c_schedule;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',tier.id,'guest_count',tier.guest_count,
    'threshold_nights',tier.threshold_nights,'nightly_rate',tier.nightly_rate,
    'is_active',tier.is_active,'version',tier.version,'updated_at',tier.updated_at
  ) order by tier.guest_count,tier.threshold_nights,tier.id),'[]'::jsonb)
  into v_party_tiers from public.hotel_pricing_schedule_occupancy_tiers tier
  where tier.schedule_id=c_party;

  v_source_tier_fingerprint:=public.hotel_v2_h3_1p_source_tier_fingerprint(c_hotel);
  v_room_tier_fingerprint:=public.hotel_v2_h3_1p_schedule_tier_fingerprint(c_schedule);
  v_party_tier_fingerprint:=public.hotel_v2_h3_1p_schedule_tier_fingerprint(c_party);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',room.id,'code',room.code,'name_i18n',room.name_i18n,
    'status',room.status,'max_occupancy',room.max_occupancy,
    'base_inventory_count',room.base_inventory_count,
    'version',room.version,'updated_at',room.updated_at
  ) order by case room.id when c_upper then 1 when c_ground then 2 else 3 end),'[]'::jsonb)
  into v_rooms from public.hotel_room_types room
  where room.id in(c_upper,c_ground) and room.hotel_id=c_hotel;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',rate.id,'room_type_id',rate.room_type_id,'rate_plan_id',rate.rate_plan_id,
    'pricing_schedule_id',rate.pricing_schedule_id,'base_nightly_rate',rate.base_nightly_rate,
    'currency',btrim(rate.currency::text),'is_active',rate.is_active,
    'version',rate.version,'updated_at',rate.updated_at
  ) order by case rate.id when c_upper_rate then 1 else 2 end),'[]'::jsonb)
  into v_rates from public.hotel_room_rates rate
  where rate.id in(c_upper_rate,c_ground_rate) and rate.hotel_id=c_hotel;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',rule.id,'code',rule.code,'allocation_mode',rule.allocation_mode,
    'min_guest_count',rule.min_guest_count,'max_guest_count',rule.max_guest_count,
    'is_active',rule.is_active,'review_status',rule.review_status,
    'version',rule.version,
    'items',(select coalesce(jsonb_agg(jsonb_build_object(
      'id',item.id,'room_type_id',item.room_type_id,
      'units_required',item.units_required,
      'allocated_guest_count',item.allocated_guest_count,
      'pricing_guest_count',item.pricing_guest_count,
      'version',item.version
    ) order by item.sort_order,item.id),'[]'::jsonb)
      from public.hotel_room_allocation_rule_items item
      where item.allocation_rule_id=rule.id)
  ) order by rule.sort_order,rule.id),'[]'::jsonb)
  into v_allocations from public.hotel_room_allocation_rules rule
  where rule.hotel_id=c_hotel;

  v_allocation_fingerprint:=md5(v_allocations::text);
  select md5(coalesce(string_agg(jsonb_build_object(
    'rule_code',rule.code,'room_type_id',item.room_type_id,
    'allocated_guest_count',item.allocated_guest_count,
    'pricing_guest_count',public.hotel_v2_h3_1p_expected_pricing_guest_count(rule.code,item.room_type_id)
  )::text,'|' order by rule.min_guest_count,item.sort_order,item.id),''))
  into v_mapping_fingerprint
  from public.hotel_room_allocation_rules rule
  join public.hotel_room_allocation_rule_items item on item.allocation_rule_id=rule.id
  where rule.hotel_id=c_hotel and rule.allocation_mode='required_bundle';

  select count(*) filter(where item.pricing_guest_count is not null),
    count(*) filter(where item.pricing_guest_count is not distinct from
      public.hotel_v2_h3_1p_expected_pricing_guest_count(rule.code,item.room_type_id))
  into v_current_mapping_count,v_target_mapping_count
  from public.hotel_room_allocation_rules rule
  join public.hotel_room_allocation_rule_items item on item.allocation_rule_id=rule.id
  where rule.hotel_id=c_hotel and rule.allocation_mode='required_bundle';

  v_parity:=public.hotel_v2_h3_1p_parity_snapshot(c_hotel);

  v_target_fingerprint:=md5(jsonb_build_object(
    'contract_version',c_contract,
    'legacy_pricing_fingerprint',md5(v_hotel.pricing_tiers::text),
    'room_schedule',jsonb_build_object(
      'id',v_schedule.id,'code',v_schedule.code,'application_scope',v_schedule.application_scope,
      'currency',btrim(v_schedule.currency::text),'maximum_party_size',v_schedule.maximum_party_size,
      'minimum_billable_occupancy',v_schedule.minimum_billable_occupancy,
      'is_active',false,'review_status','reviewed','tier_fingerprint',v_room_tier_fingerprint
    ),
    'rate_plan',jsonb_build_object(
      'id',v_plan.id,'code',v_plan.code,'cancellation_policy',v_plan.cancellation_policy,
      'price_inclusions',v_plan.price_inclusions,'is_active',v_plan.is_active
    ),
    'room_rates',v_rates,
    'pricing_occupancy_mapping_fingerprint',v_mapping_fingerprint,
    'parity_fingerprint',v_parity->>'fingerprint'
  )::text);

  if v_hotel.id is null then v_blockers:=v_blockers||'"property_missing"'::jsonb; end if;
  if v_hotel.architecture_version is distinct from 'legacy'
     or v_hotel.pricing_model is distinct from 'tiered_by_nights'
     or md5(v_hotel.pricing_tiers::text) is distinct from c_source_fingerprint
     or v_hotel.pricing_tiers->>'currency' is distinct from 'EUR'
     or jsonb_array_length(coalesce(v_hotel.pricing_tiers->'rules','[]'::jsonb))<>63 then
    v_blockers:=v_blockers||'"legacy_source_contract_mismatch"'::jsonb;
  end if;
  if v_hotel.minimum_stay_nights is distinct from 2
     or v_hotel.booking_mode is distinct from 'request_confirmation'
     or btrim(v_hotel.currency::text)<>'EUR' then
    v_blockers:=v_blockers||'"h3_1_property_configuration_mismatch"'::jsonb;
  end if;
  if v_upper.id is null or v_ground.id is null
     or (select count(*) from public.hotel_room_types where hotel_id=c_hotel)<>2
     or v_upper.status is distinct from 'active' or v_ground.status is distinct from 'active'
     or v_upper.max_occupancy is distinct from 4 or v_ground.max_occupancy is distinct from 4
     or v_upper.inventory_mode is distinct from 'pooled' or v_ground.inventory_mode is distinct from 'pooled'
     or v_upper.base_inventory_count is distinct from 1
     or v_ground.base_inventory_count is distinct from 1 then
    v_blockers:=v_blockers||'"room_contract_mismatch"'::jsonb;
  end if;
  if v_plan.id is null or v_plan.code is distinct from 'standard'
     or (select count(*) from public.hotel_rate_plans where hotel_id=c_hotel)<>1
     or v_plan.cancellation_policy<>'{"type":"non_refundable"}'::jsonb
     or v_plan.price_inclusions is distinct from array['cleaning','taxes']::text[]
     or v_plan.is_active then
    v_blockers:=v_blockers||'"rate_plan_contract_mismatch"'::jsonb;
  end if;
  if v_schedule.id is null
     or (select count(*) from public.hotel_pricing_schedules where hotel_id=c_hotel)<>2
     or v_schedule.application_scope<>'room_occupancy'
     or v_schedule.code<>'shared-apartment-occupancy-los'
     or btrim(v_schedule.currency::text)<>'EUR'
     or v_schedule.maximum_party_size<>4 or v_schedule.minimum_billable_occupancy<>2
     or v_schedule.source<>'legacy_preview'
     or v_schedule.source_reference->>'pricing_fingerprint' is distinct from c_source_fingerprint
     or v_schedule.is_active or v_schedule.review_status not in('requires_review','reviewed')
     or jsonb_array_length(v_room_tiers)<>27
     or exists(
       (select (source.value->>'persons')::smallint,(source.value->>'min_nights')::integer,
          (source.value->>'price_per_night')::numeric
        from jsonb_array_elements(v_hotel.pricing_tiers->'rules') source(value)
        where (source.value->>'persons')::integer between 2 and 4
        except
        select tier.guest_count,tier.threshold_nights,tier.nightly_rate
        from public.hotel_pricing_schedule_occupancy_tiers tier
        where tier.schedule_id=c_schedule and tier.is_active)
       union all
       (select tier.guest_count,tier.threshold_nights,tier.nightly_rate
        from public.hotel_pricing_schedule_occupancy_tiers tier
        where tier.schedule_id=c_schedule and tier.is_active
        except
        select (source.value->>'persons')::smallint,(source.value->>'min_nights')::integer,
          (source.value->>'price_per_night')::numeric
        from jsonb_array_elements(v_hotel.pricing_tiers->'rules') source(value)
        where (source.value->>'persons')::integer between 2 and 4)
     ) then
    v_blockers:=v_blockers||'"room_schedule_contract_mismatch"'::jsonb;
  end if;
  if v_party.id is null or v_party.application_scope is distinct from 'property_booking_party'
     or v_party.code<>'legacy-property-party-preview'
     or btrim(v_party.currency::text)<>'EUR'
     or v_party.maximum_party_size<>8 or v_party.is_active
     or v_party.review_status<>'requires_review' or v_party.source<>'legacy_preview'
     or v_party.source_reference->>'pricing_fingerprint' is distinct from c_source_fingerprint
     or jsonb_array_length(v_party_tiers)<>63
     or exists(
       (select (source.value->>'persons')::smallint,(source.value->>'min_nights')::integer,
          (source.value->>'price_per_night')::numeric
        from jsonb_array_elements(v_hotel.pricing_tiers->'rules') source(value)
        except
        select tier.guest_count,tier.threshold_nights,tier.nightly_rate
        from public.hotel_pricing_schedule_occupancy_tiers tier
        where tier.schedule_id=c_party and tier.is_active)
       union all
       (select tier.guest_count,tier.threshold_nights,tier.nightly_rate
        from public.hotel_pricing_schedule_occupancy_tiers tier
        where tier.schedule_id=c_party and tier.is_active
        except
        select (source.value->>'persons')::smallint,(source.value->>'min_nights')::integer,
          (source.value->>'price_per_night')::numeric
        from jsonb_array_elements(v_hotel.pricing_tiers->'rules') source(value))
     ) then
    v_blockers:=v_blockers||'"property_party_preview_contract_mismatch"'::jsonb;
  end if;
  if v_upper_rate.id is null or v_ground_rate.id is null
     or (select count(*) from public.hotel_room_rates where hotel_id=c_hotel)<>2
     or v_upper_rate.room_type_id is distinct from c_upper
     or v_ground_rate.room_type_id is distinct from c_ground
     or v_upper_rate.rate_plan_id is distinct from c_plan
     or v_ground_rate.rate_plan_id is distinct from c_plan
     or v_upper_rate.pricing_schedule_id is distinct from c_schedule
     or v_ground_rate.pricing_schedule_id is distinct from c_schedule
     or v_upper_rate.base_nightly_rate is distinct from 0
     or v_ground_rate.base_nightly_rate is distinct from 0
     or btrim(v_upper_rate.currency::text) is distinct from 'EUR'
     or btrim(v_ground_rate.currency::text) is distinct from 'EUR'
     or v_upper_rate.is_active or v_ground_rate.is_active then
    v_blockers:=v_blockers||'"room_rate_contract_mismatch"'::jsonb;
  end if;
  if jsonb_array_length(v_allocations)<>5
     or (select count(*) from public.hotel_room_allocation_rule_items item
       join public.hotel_room_allocation_rules rule on rule.id=item.allocation_rule_id
       where rule.hotel_id=c_hotel)<>10
     or exists(
       select 1
       from public.hotel_room_allocation_rules rule
       where rule.hotel_id=c_hotel and not (
         (rule.code='guests-1-4-choice' and rule.allocation_mode='customer_choice'
           and rule.min_guest_count=1 and rule.max_guest_count=4)
         or (rule.code='guests-5-bundle' and rule.allocation_mode='required_bundle'
           and rule.min_guest_count=5 and rule.max_guest_count=5)
         or (rule.code='guests-6-bundle' and rule.allocation_mode='required_bundle'
           and rule.min_guest_count=6 and rule.max_guest_count=6)
         or (rule.code='guests-7-bundle' and rule.allocation_mode='required_bundle'
           and rule.min_guest_count=7 and rule.max_guest_count=7)
         or (rule.code='guests-8-bundle' and rule.allocation_mode='required_bundle'
           and rule.min_guest_count=8 and rule.max_guest_count=8)
       )
     )
     or exists(select 1 from public.hotel_room_allocation_rules rule
       where rule.hotel_id=c_hotel and (not rule.is_active or rule.review_status<>'reviewed'))
     or exists(
       select 1
       from public.hotel_room_allocation_rules rule
       join public.hotel_room_allocation_rule_items item on item.allocation_rule_id=rule.id
       where rule.hotel_id=c_hotel and (
         item.units_required is distinct from 1
         or item.room_type_id not in(c_upper,c_ground)
         or (rule.code='guests-1-4-choice' and (
           item.allocated_guest_count is not null or item.pricing_guest_count is not null))
         or (rule.code='guests-5-bundle' and (
           (item.room_type_id=c_upper and item.allocated_guest_count is distinct from 3)
           or (item.room_type_id=c_ground and item.allocated_guest_count is distinct from 2)))
         or (rule.code='guests-6-bundle' and item.allocated_guest_count is distinct from 3)
         or (rule.code='guests-7-bundle' and (
           (item.room_type_id=c_upper and item.allocated_guest_count is distinct from 4)
           or (item.room_type_id=c_ground and item.allocated_guest_count is distinct from 3)))
         or (rule.code='guests-8-bundle' and item.allocated_guest_count is distinct from 4)
       )
     )
     or not (
       v_current_mapping_count=0
       or (v_current_mapping_count=8 and v_target_mapping_count=8)
     )
     or (v_schedule.review_status='reviewed' and v_target_mapping_count<>8) then
    v_blockers:=v_blockers||'"allocation_pricing_occupancy_contract_mismatch"'::jsonb;
  end if;
  if (v_parity->>'threshold_case_count')::integer<>63
     or (v_parity->>'long_stay_case_count')::integer<>7
     or (v_parity->>'total_case_count')::integer<>70
     or (v_parity->>'total_mismatch_count')::integer<>0 then
    v_blockers:=v_blockers||'"commercial_price_parity_mismatch"'::jsonb;
  end if;
  if v_review.id is not null and (
       v_schedule.review_status is distinct from 'reviewed'
       or v_schedule.is_active
       or v_target_mapping_count<>8
       or v_review.source_fingerprint is distinct from md5(v_hotel.pricing_tiers::text)
       or v_review.target_fingerprint is distinct from v_target_fingerprint
       or v_review.pricing_occupancy_mapping_fingerprint is distinct from v_mapping_fingerprint
       or v_review.parity_fingerprint is distinct from v_parity->>'fingerprint'
     ) then
    v_blockers:=v_blockers||'"promotion_receipt_state_mismatch"'::jsonb;
  end if;
  if v_flags is null or exists(select 1 from public.site_settings where id=1 and (
    hotel_rooms_v2_enabled or hotel_external_sync_enabled
    or hotel_instant_booking_enabled or hotel_stripe_connect_enabled
  )) then
    v_blockers:=v_blockers||'"hotel_v2_capability_enabled"'::jsonb;
  end if;

  v_expected:=jsonb_build_object(
    'property_updated_at',v_hotel.updated_at,
    'legacy_pricing_fingerprint',md5(v_hotel.pricing_tiers::text),
    'source_tier_fingerprint',v_source_tier_fingerprint,
    'room_schedule_id',c_schedule,'room_schedule_version',v_schedule.version,
    'room_schedule_tier_fingerprint',v_room_tier_fingerprint,
    'property_party_preview_id',c_party,'property_party_preview_version',v_party.version,
    'property_party_tier_fingerprint',v_party_tier_fingerprint,
    'rate_plan_id',c_plan,'rate_plan_version',v_plan.version,
    'upper_room_id',c_upper,'upper_room_version',v_upper.version,
    'ground_room_id',c_ground,'ground_room_version',v_ground.version,
    'upper_room_rate_id',c_upper_rate,'upper_room_rate_version',v_upper_rate.version,
    'ground_room_rate_id',c_ground_rate,'ground_room_rate_version',v_ground_rate.version,
    'allocation_fingerprint',v_allocation_fingerprint,
    'pricing_occupancy_mapping_fingerprint',v_mapping_fingerprint,
    'parity_fingerprint',v_parity->>'fingerprint',
    'target_fingerprint',v_target_fingerprint
  );
  v_snapshot_token:=md5(v_expected::text);

  return jsonb_build_object(
    'contract_version',c_contract,
    'supported',jsonb_array_length(v_blockers)=0,
    'hotel_id',c_hotel,'public_change',false,
    'property',jsonb_build_object(
      'id',v_hotel.id,'updated_at',v_hotel.updated_at,
      'architecture_version',v_hotel.architecture_version,
      'pricing_model',v_hotel.pricing_model,'currency',btrim(v_hotel.currency::text),
      'minimum_stay_nights',v_hotel.minimum_stay_nights,
      'booking_mode',v_hotel.booking_mode
    ),
    'flags',v_flags,
    'source',jsonb_build_object(
      'pricing_model',v_hotel.pricing_model,'currency',v_hotel.pricing_tiers->>'currency',
      'rule_count',jsonb_array_length(v_source_tiers),
      'pricing_fingerprint',md5(v_hotel.pricing_tiers::text),
      'tier_fingerprint',v_source_tier_fingerprint,'tiers',v_source_tiers,
      'property_party_preview',jsonb_build_object(
        'id',v_party.id,'version',v_party.version,'is_active',v_party.is_active,
        'review_status',v_party.review_status,'tier_count',jsonb_array_length(v_party_tiers),
        'tier_fingerprint',v_party_tier_fingerprint,'tiers',v_party_tiers
      )
    ),
    'target',jsonb_build_object(
      'rate_plan',jsonb_build_object(
        'id',v_plan.id,'version',v_plan.version,'code',v_plan.code,
        'cancellation_policy',v_plan.cancellation_policy,
        'price_inclusions',v_plan.price_inclusions,'is_active',v_plan.is_active
      ),
      'rooms',v_rooms,'room_rates',v_rates,
      'room_schedule',jsonb_build_object(
        'id',v_schedule.id,'version',v_schedule.version,'code',v_schedule.code,
        'application_scope',v_schedule.application_scope,'currency',btrim(v_schedule.currency::text),
        'maximum_party_size',v_schedule.maximum_party_size,
        'minimum_billable_occupancy',v_schedule.minimum_billable_occupancy,
        'is_active',v_schedule.is_active,'review_status',v_schedule.review_status,
        'tier_count',jsonb_array_length(v_room_tiers),
        'tier_fingerprint',v_room_tier_fingerprint,'tiers',v_room_tiers
      ),
      'allocation_fingerprint',v_allocation_fingerprint,
      'target_fingerprint',v_target_fingerprint
    ),
    'allocation_previews',public.hotel_v2_h3_1p_allocation_preview(c_hotel),
    'pricing_occupancy_mapping_fingerprint',v_mapping_fingerprint,
    'parity',v_parity,
    'expected',v_expected,'snapshot_token',v_snapshot_token,
    'promotion',case when v_review.id is null then jsonb_build_object(
      'status','not_reviewed','decision','promote_room_schedule_to_reviewed'
    ) else jsonb_build_object(
      'status','reviewed','decision','promote_room_schedule_to_reviewed',
      'review_id',v_review.id,'reviewed_at',v_review.reviewed_at,
      'correlation_id',v_review.correlation_id
    ) end,
    'safety',jsonb_build_object(
      'legacy_authoritative',true,'architecture_legacy',v_hotel.architecture_version='legacy',
      'room_schedule_inactive',not v_schedule.is_active,
      'rate_plan_inactive',not v_plan.is_active,
      'room_rates_inactive',not v_upper_rate.is_active and not v_ground_rate.is_active,
      'all_flags_off',not exists(select 1 from public.site_settings where id=1 and (
        hotel_rooms_v2_enabled or hotel_external_sync_enabled
        or hotel_instant_booking_enabled or hotel_stripe_connect_enabled
      ))
    ),
    'blockers',v_blockers
  );
end
$function$;

revoke all on function public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid)
  from public,anon,authenticated,service_role;

create function public.hotel_v2_admin_get_legacy_pricing_promotion_preview(p_hotel_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path=pg_catalog,public,auth
as $function$
begin
  perform public.hotel_v2_h2a_require_admin();
  return public.hotel_v2_h3_1p_pricing_promotion_snapshot(p_hotel_id);
end
$function$;

comment on function public.hotel_v2_admin_get_legacy_pricing_promotion_preview(uuid) is
  'Admin-only H3.1P preview. Returns the exact 63-rule source, 27-tier target, physical/pricing occupancy mapping and 70-case parity oracle without mutation.';

revoke all on function public.hotel_v2_admin_get_legacy_pricing_promotion_preview(uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.hotel_v2_admin_get_legacy_pricing_promotion_preview(uuid)
  to authenticated;

-- Preserve the H3.1 aggregate guard while separating physical occupancy from
-- pricing occupancy.  Before a promotion, NULL bundle pricing is an explicit
-- unreviewed state.  Once a receipt exists, a general H3.1 allocation save
-- that omits or changes the reviewed mapping fails closed at transaction end.
create or replace function public.hotel_v2_h3_1_validate_allocation_rule(p_rule_id uuid)
returns void
language plpgsql
set search_path=pg_catalog,public
as $function$
declare
  v_rule public.hotel_room_allocation_rules%rowtype;
  v_count integer;
  v_total integer;
  v_units integer;
begin
  select * into v_rule from public.hotel_room_allocation_rules where id=p_rule_id;
  if not found then return; end if;

  select count(*)::integer,coalesce(sum(item.allocated_guest_count),0)::integer,
    coalesce(sum(item.units_required),0)::integer
  into v_count,v_total,v_units
  from public.hotel_room_allocation_rule_items item
  where item.allocation_rule_id=v_rule.id;

  if exists(
    select 1
    from public.hotel_room_allocation_rule_items item
    join public.hotel_room_types room_type on room_type.id=item.room_type_id
    where item.allocation_rule_id=v_rule.id
      and (
        item.hotel_id<>v_rule.hotel_id
        or (v_rule.is_active and (
          room_type.status<>'active'
          or (room_type.inventory_mode='pooled'
            and item.units_required>room_type.base_inventory_count)
          or (room_type.inventory_mode='unitized' and item.units_required>(
            select count(*) from public.hotel_units unit_row
            where unit_row.room_type_id=room_type.id and unit_row.status='active'
          ))
        ))
        or (v_rule.allocation_mode='customer_choice' and (
          item.allocated_guest_count is not null or item.pricing_guest_count is not null
          or item.units_required<>1
          or coalesce(room_type.max_occupancy,
            room_type.capacity_adults+room_type.capacity_children)<v_rule.max_guest_count
        ))
        or (v_rule.allocation_mode='required_bundle' and (
          item.allocated_guest_count is null
          or item.allocated_guest_count>
            coalesce(room_type.max_occupancy,
              room_type.capacity_adults+room_type.capacity_children)*item.units_required
          or (item.pricing_guest_count is not null and item.pricing_guest_count>
            coalesce(room_type.max_occupancy,
              room_type.capacity_adults+room_type.capacity_children)*item.units_required)
        ))
      )
  ) then
    raise exception using errcode='23514',message='hotels_v2_h3_1_invalid_allocation_item_contract';
  end if;

  if v_rule.review_status='reviewed' and (
    v_count<1
    or (v_rule.allocation_mode='customer_choice' and v_count<2)
    or (v_rule.allocation_mode='required_bundle' and (
      v_units<2 or v_total<>v_rule.min_guest_count
    ))
  ) then
    raise exception using errcode='23514',message='hotels_v2_h3_1_incomplete_reviewed_allocation_rule';
  end if;

  if v_rule.is_active and v_rule.review_status='reviewed'
     and v_rule.allocation_mode='required_bundle'
     and coalesce(current_setting('hotels_v2.h3_1p_allocation_rewrite',true),'')<>'on'
     and exists(
       select 1 from public.hotel_pricing_promotion_reviews review
       where review.hotel_id=v_rule.hotel_id
         and review.contract_version='seven_kamares_legacy_to_h3_pricing_v1'
         and review.review_status='reviewed'
     )
     and exists(
       select 1 from public.hotel_room_allocation_rule_items item
       where item.allocation_rule_id=v_rule.id and item.pricing_guest_count is null
     ) then
    raise exception using errcode='23514',
      message='hotels_v2_h3_1p_reviewed_pricing_occupancy_required';
  end if;

  if coalesce(current_setting('hotels_v2.h3_1p_allocation_rewrite',true),'')<>'on'
     and exists(
       select 1 from public.hotel_pricing_promotion_reviews review
       where review.hotel_id=v_rule.hotel_id
         and review.contract_version='seven_kamares_legacy_to_h3_pricing_v1'
         and review.review_status='reviewed'
     ) and (
       (select count(*) from public.hotel_room_allocation_rules rule
         where rule.hotel_id=v_rule.hotel_id)<>5
       or (select count(*) from public.hotel_room_allocation_rule_items item
         join public.hotel_room_allocation_rules rule on rule.id=item.allocation_rule_id
         where rule.hotel_id=v_rule.hotel_id)<>10
       or exists(
         select 1 from public.hotel_room_allocation_rules rule
         where rule.hotel_id=v_rule.hotel_id and (
           not rule.is_active or rule.review_status<>'reviewed'
           or not (
             (rule.code='guests-1-4-choice' and rule.allocation_mode='customer_choice'
               and rule.min_guest_count=1 and rule.max_guest_count=4)
             or (rule.code='guests-5-bundle' and rule.allocation_mode='required_bundle'
               and rule.min_guest_count=5 and rule.max_guest_count=5)
             or (rule.code='guests-6-bundle' and rule.allocation_mode='required_bundle'
               and rule.min_guest_count=6 and rule.max_guest_count=6)
             or (rule.code='guests-7-bundle' and rule.allocation_mode='required_bundle'
               and rule.min_guest_count=7 and rule.max_guest_count=7)
             or (rule.code='guests-8-bundle' and rule.allocation_mode='required_bundle'
               and rule.min_guest_count=8 and rule.max_guest_count=8)
           )
         )
       )
       or exists(
         select 1
         from public.hotel_room_allocation_rules rule
         left join public.hotel_room_allocation_rule_items item
           on item.allocation_rule_id=rule.id
         where rule.hotel_id=v_rule.hotel_id
         group by rule.id
         having count(item.id)<>2
           or count(*) filter(where item.room_type_id=
             'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid)<>1
           or count(*) filter(where item.room_type_id=
             '825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid)<>1
       )
       or exists(
         select 1
         from public.hotel_room_allocation_rules rule
         join public.hotel_room_allocation_rule_items item
           on item.allocation_rule_id=rule.id
         where rule.hotel_id=v_rule.hotel_id and (
           item.units_required is distinct from 1
           or item.room_type_id not in(
             'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid,
             '825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid
           )
           or (rule.code='guests-1-4-choice' and (
             item.allocated_guest_count is not null
             or item.pricing_guest_count is not null))
           or (rule.code='guests-5-bundle' and (
             (item.room_type_id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid
               and item.allocated_guest_count is distinct from 3)
             or (item.room_type_id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid
               and item.allocated_guest_count is distinct from 2)
             or item.pricing_guest_count is distinct from 2))
           or (rule.code='guests-6-bundle' and (
             item.allocated_guest_count is distinct from 3
             or item.pricing_guest_count is distinct from 3))
           or (rule.code='guests-7-bundle' and (
             (item.room_type_id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid
               and item.allocated_guest_count is distinct from 4)
             or (item.room_type_id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid
               and item.allocated_guest_count is distinct from 3)
             or item.pricing_guest_count is distinct from 4))
           or (rule.code='guests-8-bundle' and (
             item.allocated_guest_count is distinct from 4
             or item.pricing_guest_count is distinct from 4))
         )
       )
     ) then
    raise exception using errcode='23514',
      message='hotels_v2_h3_1p_reviewed_allocation_graph_required';
  end if;

  if exists(
    select 1
    from public.hotel_room_allocation_rules left_rule
    join public.hotel_room_allocation_rules right_rule
      on right_rule.hotel_id=left_rule.hotel_id and right_rule.id>left_rule.id
      and right_rule.is_active and right_rule.review_status='reviewed'
      and left_rule.min_guest_count<=right_rule.max_guest_count
      and right_rule.min_guest_count<=left_rule.max_guest_count
    where left_rule.hotel_id=v_rule.hotel_id
      and left_rule.is_active and left_rule.review_status='reviewed'
  ) then
    raise exception using errcode='23514',message='hotels_v2_h3_1_active_allocation_range_overlap';
  end if;

  if exists(select 1 from public.hotel_room_allocation_rules active_rule
       where active_rule.hotel_id=v_rule.hotel_id and active_rule.is_active
         and active_rule.review_status='reviewed')
     and exists(
    select 1
    from generate_series(1,(
      select max(active_rule.max_guest_count)::integer
      from public.hotel_room_allocation_rules active_rule
      where active_rule.hotel_id=v_rule.hotel_id and active_rule.is_active
        and active_rule.review_status='reviewed'
    )) guest_count
    where (select count(*) from public.hotel_room_allocation_rules active_rule
      where active_rule.hotel_id=v_rule.hotel_id and active_rule.is_active
        and active_rule.review_status='reviewed'
        and guest_count between active_rule.min_guest_count and active_rule.max_guest_count)<>1
  ) then
    raise exception using errcode='23514',message='hotels_v2_h3_1_active_allocation_coverage_gap';
  end if;
end
$function$;

revoke all on function public.hotel_v2_h3_1_validate_allocation_rule(uuid)
  from public,anon,authenticated,service_role;

create function public.hotel_v2_admin_apply_legacy_pricing_promotion(
  p_plan jsonb,
  p_correlation_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,auth
as $function$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_schedule constant uuid:='b0a3104f-7b31-5265-a59f-c2d166f11a23';
  c_contract constant text:='seven_kamares_legacy_to_h3_pricing_v1';
  v_hotel_id uuid;
  v_reviewed_at timestamptz;
  v_request_hash text;
  v_existing public.hotel_pricing_promotion_reviews%rowtype;
  v_preview jsonb;
  v_after_preview jsonb;
  v_before jsonb;
  v_after jsonb;
  v_review_id uuid:=gen_random_uuid();
  v_result jsonb;
  v_updated_count integer;
  v_mapping_before jsonb;
begin
  perform public.hotel_v2_h2a_require_admin();

  if p_plan is null or jsonb_typeof(p_plan)<>'object' or p_correlation_id is null
     or not public.hotel_v2_h2a_keys_allowed(p_plan,array[
       'hotel_id','reviewed_at','snapshot_token','expected','decision',
       'acknowledge_pricing_occupancy_mapping'
     ])
     or not (p_plan ?& array[
       'hotel_id','reviewed_at','snapshot_token','expected','decision',
       'acknowledge_pricing_occupancy_mapping'
     ])
     or jsonb_typeof(p_plan->'expected')<>'object'
     or p_plan->>'reviewed_at' is null then
    raise exception using errcode='22023',message='hotels_v2_h3_pricing_promotion_invalid_plan';
  end if;

  v_hotel_id:=(p_plan->>'hotel_id')::uuid;

  v_reviewed_at:=(p_plan->>'reviewed_at')::timestamptz;
  v_request_hash:=md5(p_plan::text);

  select * into v_existing from public.hotel_pricing_promotion_reviews
  where correlation_id=p_correlation_id;
  if found then
    if v_existing.request_hash<>v_request_hash then
      raise exception using errcode='23505',message='hotels_v2_h3_pricing_promotion_correlation_reuse';
    end if;
    return v_existing.result||jsonb_build_object('replayed',true);
  end if;

  if v_hotel_id is distinct from c_hotel
     or p_plan->>'decision' is distinct from 'promote_room_schedule_to_reviewed' then
    raise exception using errcode='22023',message='hotels_v2_h3_pricing_promotion_unsupported_contract';
  end if;
  if coalesce((p_plan->>'acknowledge_pricing_occupancy_mapping')::boolean,false) is not true then
    raise exception using errcode='22023',
      message='hotels_v2_h3_pricing_promotion_pricing_occupancy_ack_required';
  end if;
  if v_reviewed_at<clock_timestamp()-interval '30 minutes'
     or v_reviewed_at>clock_timestamp()+interval '5 minutes' then
    raise exception using errcode='22023',message='hotels_v2_h3_pricing_promotion_review_expired';
  end if;

  -- Lock every source and target before the first write.  Relationship,
  -- version and fingerprint checks are then evaluated from one exact graph.
  perform 1 from public.site_settings where id=1 for share;
  perform 1 from public.hotels where id=c_hotel for update;
  perform 1 from public.hotel_room_types where hotel_id=c_hotel for update;
  perform 1 from public.hotel_rate_plans where hotel_id=c_hotel for update;
  perform 1 from public.hotel_room_rates where hotel_id=c_hotel for update;
  perform 1 from public.hotel_pricing_schedules where hotel_id=c_hotel for update;
  perform 1 from public.hotel_pricing_schedule_occupancy_tiers tier
    join public.hotel_pricing_schedules schedule on schedule.id=tier.schedule_id
    where schedule.hotel_id=c_hotel for update of tier;
  perform 1 from public.hotel_room_allocation_rules where hotel_id=c_hotel for update;
  perform 1 from public.hotel_room_allocation_rule_items item
    join public.hotel_room_allocation_rules rule on rule.id=item.allocation_rule_id
    where rule.hotel_id=c_hotel for update of item;

  -- A concurrent duplicate can pass the first receipt read, wait on the graph
  -- locks, then resume after the winning transaction commits. Re-read the
  -- exact correlation under the acquired locks so equal requests replay while
  -- a different hash still fails closed.
  select * into v_existing from public.hotel_pricing_promotion_reviews
  where correlation_id=p_correlation_id;
  if found then
    if v_existing.request_hash<>v_request_hash then
      raise exception using errcode='23505',message='hotels_v2_h3_pricing_promotion_correlation_reuse';
    end if;
    return v_existing.result||jsonb_build_object('replayed',true);
  end if;

  select * into v_existing from public.hotel_pricing_promotion_reviews
  where hotel_id=c_hotel and contract_version=c_contract;
  if found then
    raise exception using errcode='PT409',message='hotels_v2_h3_pricing_promotion_already_reviewed';
  end if;
  if exists(select 1 from public.hotel_activity_log where correlation_id=p_correlation_id) then
    raise exception using errcode='23505',message='hotels_v2_h3_pricing_promotion_correlation_reuse';
  end if;

  v_preview:=public.hotel_v2_h3_1p_pricing_promotion_snapshot(c_hotel);
  if not coalesce((v_preview->>'supported')::boolean,false) then
    raise exception using errcode='55000',message='hotels_v2_h3_pricing_promotion_source_not_ready',
      detail=coalesce(v_preview->'blockers','[]'::jsonb)::text;
  end if;
  if p_plan->'expected' is distinct from v_preview->'expected'
     or p_plan->>'snapshot_token' is distinct from v_preview->>'snapshot_token' then
    raise exception using errcode='PT409',message='hotels_v2_h3_pricing_promotion_stale_review';
  end if;
  if v_preview#>>'{target,room_schedule,review_status}'<>'requires_review'
     or (v_preview#>>'{target,room_schedule,is_active}')::boolean
     or (v_preview#>>'{target,rate_plan,is_active}')::boolean
     or exists(select 1 from jsonb_array_elements(v_preview#>'{target,room_rates}') rate(value)
       where (rate.value->>'is_active')::boolean)
     or v_preview#>>'{source,pricing_fingerprint}'<>'7208ab4ecc0e47abd64d87ca1ac53a03'
     or (v_preview#>>'{parity,total_case_count}')::integer<>70
     or (v_preview#>>'{parity,total_mismatch_count}')::integer<>0 then
    raise exception using errcode='55000',message='hotels_v2_h3_pricing_promotion_inert_contract_mismatch';
  end if;

  select jsonb_object_agg(rule.id::text,(
    select jsonb_build_object('pricing_occupancy',coalesce(jsonb_agg(jsonb_build_object(
      'item_id',item.id,'room_type_id',item.room_type_id,
      'allocated_guest_count',item.allocated_guest_count,
      'pricing_guest_count',item.pricing_guest_count
    ) order by item.sort_order,item.id),'[]'::jsonb))
    from public.hotel_room_allocation_rule_items item
    where item.allocation_rule_id=rule.id
  )) into v_mapping_before
  from public.hotel_room_allocation_rules rule
  where rule.hotel_id=c_hotel and rule.allocation_mode='required_bundle';

  update public.hotel_room_allocation_rule_items item
  set pricing_guest_count=public.hotel_v2_h3_1p_expected_pricing_guest_count(rule.code,item.room_type_id)
  from public.hotel_room_allocation_rules rule
  where rule.id=item.allocation_rule_id and rule.hotel_id=c_hotel
    and rule.allocation_mode='required_bundle'
    and item.pricing_guest_count is null;
  get diagnostics v_updated_count=row_count;
  if v_updated_count not in(0,8) or exists(
    select 1 from public.hotel_room_allocation_rules rule
    join public.hotel_room_allocation_rule_items item on item.allocation_rule_id=rule.id
    where rule.hotel_id=c_hotel and rule.allocation_mode='required_bundle'
      and item.pricing_guest_count is distinct from
        public.hotel_v2_h3_1p_expected_pricing_guest_count(rule.code,item.room_type_id)
  ) then
    raise exception using errcode='PT409',message='hotels_v2_h3_pricing_promotion_stale_review';
  end if;

  insert into public.hotel_activity_log(
    hotel_id,entity_type,entity_id,action,before_state,after_state,
    actor_type,actor_id,source,correlation_id
  )
  select c_hotel,'allocation_rule',rule.id,'update',
    v_mapping_before->rule.id::text,
    jsonb_build_object('pricing_occupancy',coalesce(jsonb_agg(jsonb_build_object(
      'item_id',item.id,'room_type_id',item.room_type_id,
      'allocated_guest_count',item.allocated_guest_count,
      'pricing_guest_count',item.pricing_guest_count
    ) order by item.sort_order,item.id),'[]'::jsonb)),
    'admin',auth.uid(),'hotels_v2_h3_1_legacy_pricing_promotion',p_correlation_id
  from public.hotel_room_allocation_rules rule
  join public.hotel_room_allocation_rule_items item on item.allocation_rule_id=rule.id
  where rule.hotel_id=c_hotel and rule.allocation_mode='required_bundle'
  group by rule.id;

  select to_jsonb(schedule) into v_before
  from public.hotel_pricing_schedules schedule where schedule.id=c_schedule;
  update public.hotel_pricing_schedules schedule
  set review_status='reviewed'
  where schedule.id=c_schedule
    and schedule.version=(p_plan#>>'{expected,room_schedule_version}')::bigint
    and schedule.review_status='requires_review' and not schedule.is_active
  returning to_jsonb(schedule.*) into v_after;
  if v_after is null then
    raise exception using errcode='PT409',message='hotels_v2_h3_pricing_promotion_stale_review';
  end if;

  insert into public.hotel_activity_log(
    hotel_id,entity_type,entity_id,action,before_state,after_state,
    actor_type,actor_id,source,correlation_id
  ) values(
    c_hotel,'pricing_schedule',c_schedule,'update',v_before,v_after,
    'admin',auth.uid(),'hotels_v2_h3_1_legacy_pricing_promotion',p_correlation_id
  );

  v_after_preview:=public.hotel_v2_h3_1p_pricing_promotion_snapshot(c_hotel);
  if not coalesce((v_after_preview->>'supported')::boolean,false)
     or v_after_preview#>>'{source,pricing_fingerprint}'<>v_preview#>>'{source,pricing_fingerprint}'
     or v_after_preview#>>'{target,target_fingerprint}'<>v_preview#>>'{target,target_fingerprint}'
     or v_after_preview#>>'{pricing_occupancy_mapping_fingerprint}'
        <>v_preview#>>'{pricing_occupancy_mapping_fingerprint}'
     or (v_after_preview#>>'{parity,total_mismatch_count}')::integer<>0
     or v_after_preview#>>'{target,room_schedule,review_status}'<>'reviewed'
     or (v_after_preview#>>'{target,room_schedule,is_active}')::boolean then
    raise exception using errcode='55000',message='hotels_v2_h3_pricing_promotion_postcondition_failed';
  end if;

  v_result:=jsonb_build_object(
    'ok',true,'replayed',false,'correlation_id',p_correlation_id,
    'review_id',v_review_id,'hotel_id',c_hotel,'public_change',false,
    'legacy_authoritative',true,
    'source_fingerprint',v_after_preview#>>'{source,pricing_fingerprint}',
    'target_fingerprint',v_after_preview#>>'{target,target_fingerprint}',
    'pricing_occupancy_mapping_fingerprint',
      v_after_preview->>'pricing_occupancy_mapping_fingerprint',
    'parity',v_after_preview->'parity',
    'room_schedule',v_after_preview#>'{target,room_schedule}',
    'rate_plan',v_after_preview#>'{target,rate_plan}',
    'room_rates',v_after_preview#>'{target,room_rates}'
  );

  insert into public.hotel_pricing_promotion_reviews(
    id,hotel_id,contract_version,source_fingerprint,source_tier_fingerprint,
    target_fingerprint,pricing_occupancy_mapping_fingerprint,parity_fingerprint,
    parity_case_count,parity_mismatch_count,acknowledged_pricing_occupancy_mapping,
    reviewed_by,reviewed_at,correlation_id,request_hash,result
  ) values(
    v_review_id,c_hotel,c_contract,
    v_after_preview#>>'{source,pricing_fingerprint}',
    v_after_preview#>>'{source,tier_fingerprint}',
    v_after_preview#>>'{target,target_fingerprint}',
    v_after_preview->>'pricing_occupancy_mapping_fingerprint',
    v_after_preview#>>'{parity,fingerprint}',
    (v_after_preview#>>'{parity,total_case_count}')::integer,
    (v_after_preview#>>'{parity,total_mismatch_count}')::integer,
    true,auth.uid(),v_reviewed_at,p_correlation_id,v_request_hash,v_result
  );

  set constraints hotel_room_allocation_rules_contract_guard,
    hotel_room_allocation_rule_items_contract_guard immediate;

  return v_result;
end
$function$;

comment on function public.hotel_v2_admin_apply_legacy_pricing_promotion(jsonb,uuid) is
  'Admin-only atomic H3.1P promotion. Writes only exact bundle pricing_guest_count values, the dormant room schedule review state, an immutable receipt and activity; legacy/public state remains untouched.';

revoke all on function public.hotel_v2_admin_apply_legacy_pricing_promotion(jsonb,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.hotel_v2_admin_apply_legacy_pricing_promotion(jsonb,uuid)
  to authenticated;

-- The H3.1 workspace snapshot already serializes allocation items with
-- to_jsonb(item), so the additive column is returned automatically.  Replace
-- its aggregate token explicitly so optimistic concurrency also covers the
-- new pricing occupancy value.
create or replace function public.hotel_v2_h3_1_allocation_items_fingerprint(p_rule_id uuid)
returns text
language sql
stable
set search_path=pg_catalog,public
as $function$
  select md5(coalesce(string_agg(jsonb_build_object(
    'id',item.id,'hotel_id',item.hotel_id,'allocation_rule_id',item.allocation_rule_id,
    'room_type_id',item.room_type_id,'units_required',item.units_required,
    'allocated_guest_count',item.allocated_guest_count,
    'pricing_guest_count',item.pricing_guest_count,
    'sort_order',item.sort_order,'version',item.version,'updated_at',item.updated_at
  )::text,'|' order by item.sort_order,item.id),''))
  from public.hotel_room_allocation_rule_items item
  where item.allocation_rule_id=p_rule_id;
$function$;

revoke all on function public.hotel_v2_h3_1_allocation_items_fingerprint(uuid)
  from public,anon,authenticated,service_role;

-- Preserve the already-applied H3.1 implementation as an internal core and
-- put a narrow compatibility wrapper on its original PostgREST signature.
-- The wrapper requires an explicit pricing_guest_count key for every item,
-- strips that additive key for the old core, then writes and validates it in
-- the same RPC transaction before returning a fresh configuration snapshot.
alter function public.hotel_v2_admin_apply_h3_1_configuration(jsonb,uuid)
  rename to hotel_v2_admin_apply_h3_1_configuration_h3_1p_core;

revoke all on function public.hotel_v2_admin_apply_h3_1_configuration_h3_1p_core(jsonb,uuid)
  from public,anon,authenticated,service_role;

create function public.hotel_v2_admin_apply_h3_1_configuration(
  p_plan jsonb,
  p_correlation_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,auth
as $function$
declare
  v_operation jsonb;
  v_child jsonb;
  v_core_plan jsonb;
  v_core_result jsonb;
  v_hotel_id uuid;
  v_rule_id uuid;
  v_item_id uuid;
  v_pricing_guest_count smallint;
  v_has_promotion_receipt boolean;
  v_before jsonb;
  v_after jsonb;
  v_promotion_preview jsonb;
begin
  perform public.hotel_v2_h2a_require_admin();

  if p_plan is null or jsonb_typeof(p_plan)<>'object'
     or jsonb_typeof(p_plan->'operations')<>'array' then
    raise exception using errcode='22023',message='hotels_v2_h3_1_invalid_reviewed_plan';
  end if;

  v_hotel_id:=(p_plan->>'hotel_id')::uuid;
  select exists(
    select 1 from public.hotel_pricing_promotion_reviews review
    where review.hotel_id=v_hotel_id
      and review.contract_version='seven_kamares_legacy_to_h3_pricing_v1'
      and review.review_status='reviewed'
  ) into v_has_promotion_receipt;

  if not v_has_promotion_receipt and exists(
    select 1
    from jsonb_array_elements(p_plan->'operations') operation(value)
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(operation.value#>'{payload,items}')='array'
        then operation.value#>'{payload,items}' else '[]'::jsonb end
    ) item(value)
    where operation.value->>'entity'='allocation_rule'
      and operation.value->>'type' in('create','update')
      and jsonb_typeof(item.value->'pricing_guest_count')<>'null'
  ) then
    raise exception using errcode='55000',
      message='hotels_v2_h3_1p_dedicated_pricing_promotion_required';
  end if;

  for v_operation in
    select operation.value
    from jsonb_array_elements(p_plan->'operations') operation(value)
    where operation.value->>'entity'='allocation_rule'
      and operation.value->>'type' in('create','update')
  loop
    if jsonb_typeof(v_operation#>'{payload,items}')<>'array' then
      raise exception using errcode='22023',message='hotels_v2_h3_1_invalid_allocation_rule_payload';
    end if;

    for v_child in select item.value from jsonb_array_elements(v_operation#>'{payload,items}') item(value)
    loop
      if jsonb_typeof(v_child)<>'object' or not (v_child?'pricing_guest_count') then
        raise exception using errcode='22023',
          message='hotels_v2_h3_1p_pricing_guest_count_required';
      end if;

      if v_operation#>>'{payload,allocation_mode}'='customer_choice' then
        if jsonb_typeof(v_child->'pricing_guest_count')<>'null' then
          raise exception using errcode='23514',
            message='hotels_v2_h3_1p_customer_choice_pricing_guest_count_must_be_null';
        end if;
      elsif jsonb_typeof(v_child->'pricing_guest_count') not in('null','number')
         or (jsonb_typeof(v_child->'pricing_guest_count')='number' and (
           v_child->>'pricing_guest_count' !~ '^[0-9]+$'
           or (v_child->>'pricing_guest_count')::integer not between 1 and 50
         ))
         or (
           v_has_promotion_receipt
           and coalesce((v_operation#>>'{payload,is_active}')::boolean,false)
           and v_operation#>>'{payload,review_status}'='reviewed'
           and jsonb_typeof(v_child->'pricing_guest_count')='null'
         ) then
        raise exception using errcode='23514',
          message='hotels_v2_h3_1p_invalid_bundle_pricing_guest_count';
      end if;
    end loop;
  end loop;

  select jsonb_set(p_plan,'{operations}',coalesce(jsonb_agg(
    case when operation.value->>'entity'='allocation_rule'
                   and operation.value->>'type' in('create','update')
      then jsonb_set(operation.value,'{payload,items}',(
        select coalesce(jsonb_agg(item.value-'pricing_guest_count' order by item.ordinal),'[]'::jsonb)
        from jsonb_array_elements(operation.value#>'{payload,items}')
          with ordinality item(value,ordinal)
      ))
      else operation.value end
    order by operation.ordinal
  ),'[]'::jsonb))
  into v_core_plan
  from jsonb_array_elements(p_plan->'operations') with ordinality operation(value,ordinal);

  perform set_config('hotels_v2.h3_1p_allocation_rewrite','on',true);
  v_core_result:=public.hotel_v2_admin_apply_h3_1_configuration_h3_1p_core(
    v_core_plan,p_correlation_id
  );

  set constraints hotel_room_allocation_rules_contract_guard,
    hotel_room_allocation_rule_items_contract_guard deferred;

  for v_operation in
    select operation.value
    from jsonb_array_elements(p_plan->'operations') operation(value)
    where operation.value->>'entity'='allocation_rule'
      and operation.value->>'type' in('create','update')
  loop
    v_rule_id:=(v_operation->>'id')::uuid;
    select jsonb_build_object(
      'pricing_occupancy',coalesce(jsonb_agg(jsonb_build_object(
        'item_id',item.id,'room_type_id',item.room_type_id,
        'allocated_guest_count',item.allocated_guest_count,
        'pricing_guest_count',item.pricing_guest_count
      ) order by item.sort_order,item.id),'[]'::jsonb)
    ) into v_before
    from public.hotel_room_allocation_rule_items item
    where item.allocation_rule_id=v_rule_id and item.hotel_id=v_hotel_id;

    for v_child in select item.value from jsonb_array_elements(v_operation#>'{payload,items}') item(value)
    loop
      v_item_id:=(v_child->>'id')::uuid;
      v_pricing_guest_count:=case when jsonb_typeof(v_child->'pricing_guest_count')='null'
        then null else (v_child->>'pricing_guest_count')::smallint end;

      perform 1 from public.hotel_room_allocation_rule_items item
      where item.id=v_item_id and item.hotel_id=v_hotel_id
        and item.allocation_rule_id=v_rule_id for update;
      if not found then
        raise exception using errcode='PT409',message='hotels_v2_h3_1_stale_allocation_rule';
      end if;

      update public.hotel_room_allocation_rule_items item
      set pricing_guest_count=v_pricing_guest_count
      where item.id=v_item_id
        and item.pricing_guest_count is distinct from v_pricing_guest_count;
    end loop;

    select jsonb_build_object(
      'pricing_occupancy',coalesce(jsonb_agg(jsonb_build_object(
        'item_id',item.id,'room_type_id',item.room_type_id,
        'allocated_guest_count',item.allocated_guest_count,
        'pricing_guest_count',item.pricing_guest_count
      ) order by item.sort_order,item.id),'[]'::jsonb)
    ) into v_after
    from public.hotel_room_allocation_rule_items item
    where item.allocation_rule_id=v_rule_id and item.hotel_id=v_hotel_id;

    if v_after is distinct from v_before then
      insert into public.hotel_activity_log(
        hotel_id,entity_type,entity_id,action,before_state,after_state,
        actor_type,actor_id,source,correlation_id
      ) values(
        v_hotel_id,'allocation_rule',v_rule_id,'update',v_before,v_after,
        'admin',auth.uid(),'hotels_v2_h3_1p_pricing_occupancy_compatibility',p_correlation_id
      );
    end if;
  end loop;

  perform set_config('hotels_v2.h3_1p_allocation_rewrite','off',true);

  for v_rule_id in
    select distinct (operation.value->>'id')::uuid
    from jsonb_array_elements(p_plan->'operations') operation(value)
    where operation.value->>'entity'='allocation_rule'
      and operation.value->>'type' in('create','update','disable')
  loop
    perform public.hotel_v2_h3_1_validate_allocation_rule(v_rule_id);
  end loop;

  set constraints hotel_room_allocation_rules_contract_guard,
    hotel_room_allocation_rule_items_contract_guard immediate;

  if v_has_promotion_receipt then
    v_promotion_preview:=public.hotel_v2_h3_1p_pricing_promotion_snapshot(v_hotel_id);
    if not coalesce((v_promotion_preview->>'supported')::boolean,false)
       or exists(
         select 1 from public.hotel_pricing_promotion_reviews review
         where review.hotel_id=v_hotel_id
           and review.contract_version='seven_kamares_legacy_to_h3_pricing_v1'
           and (
             review.source_fingerprint is distinct from
               v_promotion_preview#>>'{source,pricing_fingerprint}'
             or review.target_fingerprint is distinct from
               v_promotion_preview#>>'{target,target_fingerprint}'
             or review.pricing_occupancy_mapping_fingerprint is distinct from
               v_promotion_preview->>'pricing_occupancy_mapping_fingerprint'
             or review.parity_fingerprint is distinct from
               v_promotion_preview#>>'{parity,fingerprint}'
           )
       ) then
      raise exception using errcode='23514',
        message='hotels_v2_h3_1p_reviewed_pricing_contract_required';
    end if;
  end if;

  return jsonb_set(
    v_core_result,'{configuration}',
    public.hotel_v2_admin_get_h3_1_configuration(v_hotel_id),true
  );
end
$function$;

comment on function public.hotel_v2_admin_apply_h3_1_configuration(jsonb,uuid) is
  'Admin-only H3.1 reviewed mutation with atomic pricing_guest_count round-trip. Allocation item payloads must explicitly include the nullable pricing occupancy key.';

revoke all on function public.hotel_v2_admin_apply_h3_1_configuration(jsonb,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.hotel_v2_admin_apply_h3_1_configuration(jsonb,uuid)
  to authenticated;

notify pgrst,'reload schema';

do $h3_1p_postconditions$
declare
  v_snapshot record;
  v_count bigint;
  v_fingerprint text;
  v_function record;
begin
  if exists(select 1 from public.site_settings where id=1 and (
       hotel_rooms_v2_enabled or hotel_external_sync_enabled
       or hotel_instant_booking_enabled or hotel_stripe_connect_enabled
     )) then
    raise exception using errcode='55000',message='hotels_v2_h3_1p_capability_changed';
  end if;

  if exists(select 1 from public.hotel_room_allocation_rule_items
      where pricing_guest_count is not null)
     or exists(select 1 from public.hotel_pricing_promotion_reviews) then
    raise exception using errcode='55000',message='hotels_v2_h3_1p_migration_wrote_business_data';
  end if;

  for v_snapshot in select * from hotels_v2_h3_1p_protected_snapshot loop
    if v_snapshot.relation_name='hotel_room_allocation_rule_items' then
      select count(*),md5(coalesce(string_agg(
        (to_jsonb(row_value)-'pricing_guest_count')::text,'|' order by row_value.id),''))
      into v_count,v_fingerprint
      from public.hotel_room_allocation_rule_items row_value;
    elsif v_snapshot.relation_name in(
      'referrals','affiliate_commission_events','affiliate_payouts','affiliate_adjustments',
      'affiliate_program_settings','affiliate_referrer_overrides',
      'affiliate_cashout_requests','profile_referral_code_aliases'
    ) then
      execute format(
        'select count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,''|'' order by to_jsonb(row_value)::text),'''')) from public.%I row_value',
        v_snapshot.relation_name
      ) into v_count,v_fingerprint;
    else
      execute format(
        'select count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,''|'' order by row_value.id),'''')) from public.%I row_value',
        v_snapshot.relation_name
      ) into v_count,v_fingerprint;
    end if;

    if v_count is distinct from v_snapshot.row_count
       or v_fingerprint is distinct from v_snapshot.fingerprint then
      raise exception using errcode='55000',message='hotels_v2_h3_1p_protected_state_changed',
        detail=v_snapshot.relation_name;
    end if;
  end loop;

  if not exists(select 1 from information_schema.columns
      where table_schema='public' and table_name='hotel_room_allocation_rule_items'
        and column_name='pricing_guest_count' and data_type='smallint' and is_nullable='YES')
     or to_regclass('public.hotel_pricing_promotion_reviews') is null
     or not (select relrowsecurity from pg_class
       where oid='public.hotel_pricing_promotion_reviews'::regclass)
     or (select count(*) from pg_policies
       where schemaname='public' and tablename='hotel_pricing_promotion_reviews')<>1
     or has_table_privilege('anon','public.hotel_pricing_promotion_reviews','SELECT')
     or has_table_privilege('authenticated','public.hotel_pricing_promotion_reviews','INSERT')
     or has_table_privilege('authenticated','public.hotel_pricing_promotion_reviews','UPDATE')
     or has_table_privilege('authenticated','public.hotel_pricing_promotion_reviews','DELETE')
     or not has_table_privilege('authenticated','public.hotel_pricing_promotion_reviews','SELECT')
     or has_table_privilege('service_role','public.hotel_pricing_promotion_reviews','INSERT')
     or has_table_privilege('service_role','public.hotel_pricing_promotion_reviews','UPDATE')
     or has_table_privilege('service_role','public.hotel_pricing_promotion_reviews','DELETE') then
    raise exception using errcode='55000',message='hotels_v2_h3_1p_receipt_security_mismatch';
  end if;

  for v_function in
    select signature,should_be_definer,should_be_authenticated
    from (values
      ('public.hotel_v2_admin_get_legacy_pricing_promotion_preview(uuid)',true,true),
      ('public.hotel_v2_admin_apply_legacy_pricing_promotion(jsonb,uuid)',true,true),
      ('public.hotel_v2_admin_apply_h3_1_configuration(jsonb,uuid)',true,true),
      ('public.hotel_v2_admin_apply_h3_1_configuration_h3_1p_core(jsonb,uuid)',true,false),
      ('public.hotel_v2_h3_1p_expected_pricing_guest_count(text,uuid)',false,false),
      ('public.hotel_v2_h3_1p_schedule_tier_fingerprint(uuid)',false,false),
      ('public.hotel_v2_h3_1p_source_tier_fingerprint(uuid)',false,false),
      ('public.hotel_v2_h3_1p_allocation_preview(uuid)',false,false),
      ('public.hotel_v2_h3_1p_parity_snapshot(uuid)',false,false),
      ('public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid)',false,false),
      ('public.hotel_v2_h3_1_allocation_items_fingerprint(uuid)',false,false)
    ) expected(signature,should_be_definer,should_be_authenticated)
  loop
    if to_regprocedure(v_function.signature) is null
       or (select prosecdef from pg_proc where oid=to_regprocedure(v_function.signature))
          is distinct from v_function.should_be_definer
       or pg_get_userbyid((select proowner from pg_proc
          where oid=to_regprocedure(v_function.signature))) is distinct from 'postgres'
       or coalesce(array_to_string((select proconfig from pg_proc
          where oid=to_regprocedure(v_function.signature)),','),'') not like '%search_path=%'
       or has_function_privilege(0::oid,to_regprocedure(v_function.signature),'EXECUTE')
       or has_function_privilege('anon',v_function.signature,'EXECUTE')
       or has_function_privilege('service_role',v_function.signature,'EXECUTE')
       or has_function_privilege('authenticated',v_function.signature,'EXECUTE')
          is distinct from v_function.should_be_authenticated then
      raise exception using errcode='55000',message='hotels_v2_h3_1p_function_security_mismatch',
        detail=v_function.signature;
    end if;
  end loop;

  if pg_get_functiondef('public.hotel_v2_admin_apply_h3_1_configuration(jsonb,uuid)'::regprocedure)
       not like '%hotels_v2_h3_1p_pricing_guest_count_required%'
     or pg_get_functiondef('public.hotel_v2_admin_apply_h3_1_configuration(jsonb,uuid)'::regprocedure)
       not like '%pricing_guest_count=v_pricing_guest_count%'
     or pg_get_functiondef('public.hotel_v2_h3_1_allocation_items_fingerprint(uuid)'::regprocedure)
       not like '%pricing_guest_count%' then
    raise exception using errcode='55000',message='hotels_v2_h3_1p_round_trip_contract_missing';
  end if;
end
$h3_1p_postconditions$;

commit;
