-- Hotels V2 ADMIN-D: reviewed availability and inventory control plane.
-- Additive and inert: no legacy booking, public resolver, architecture, flag,
-- pricing, payment, commission, ownership or Partner-assignment row is changed.

begin;
set local lock_timeout = '15s';
set local statement_timeout = '180s';

do $admin_d_dependencies$
begin
  if to_regclass('public.hotels') is null
     or to_regclass('public.hotel_room_types') is null
     or to_regclass('public.hotel_units') is null
     or to_regclass('public.hotel_room_rates') is null
     or to_regclass('public.hotel_rate_rules') is null
     or to_regclass('public.hotel_daily_inventory') is null
     or to_regclass('public.hotel_daily_rates') is null
     or to_regclass('public.hotel_calendar_overrides') is null
     or to_regclass('public.hotel_bookings') is null
     or to_regclass('public.hotel_activity_log') is null
     or to_regprocedure('public.hotel_v2_h2a_require_admin()') is null
     or to_regprocedure('public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid)') is null
     or to_regprocedure('public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()') is null
     or to_regprocedure('public.hotel_v2_admin_preview_pricing_quote(jsonb)') is null
     or to_regprocedure('extensions.digest(bytea,text)') is null then
    raise exception using errcode='55000',message='hotels_v2_admin_d_dependencies_missing';
  end if;
  if exists(select 1 from unnest(array['hotel_id','arrival_date','departure_date','status','updated_at',
      'num_adults','num_children']) required(column_name)
    where not exists(select 1 from information_schema.columns column_info
      where column_info.table_schema='public' and column_info.table_name='hotel_bookings'
        and column_info.column_name=required.column_name)) then
    raise exception using errcode='55000',message='hotels_v2_admin_d_booking_contract_missing';
  end if;
  if exists(select 1 from unnest(array[
      'hotels','hotel_room_types','hotel_units','hotel_property_pricing_defaults','hotel_rate_plans',
      'hotel_room_rates','hotel_pricing_schedules','hotel_pricing_schedule_occupancy_tiers',
      'hotel_room_rate_occupancy_tiers','hotel_rate_rules','hotel_room_allocation_rules',
      'hotel_room_allocation_rule_items','hotel_daily_rates','hotel_calendar_overrides',
      'hotel_pricing_promotion_reviews','hotel_admin_pricing_action_receipts',
      'hotel_calendar_source_configs','hotel_payment_policies','hotel_payment_policy_terms',
      'hotel_commission_policies','hotel_bookings','hotel_activity_log','partner_service_fulfillments',
      'partner_service_fulfillment_form_snapshots','service_deposit_requests','service_deposit_rules',
      'service_deposit_overrides','service_coupons','service_coupon_redemptions','referrals',
      'affiliate_commission_events','affiliate_payouts','affiliate_adjustments','affiliate_program_settings',
      'affiliate_referrer_overrides','affiliate_cashout_requests','profile_referral_code_aliases',
      'site_settings','partners','partner_users','partner_resources','partner_user_resources',
      'hotel_partner_hotel_permissions','hotel_partner_action_receipts','hotel_partner_event_outbox',
      'hotel_property_operational_profiles']) required(relation_name)
    where to_regclass('public.'||required.relation_name) is null) then
    raise exception using errcode='55000',message='hotels_v2_admin_d_protected_relation_missing';
  end if;
end
$admin_d_dependencies$;

alter table public.hotel_rate_rules
  add column availability_version bigint not null default 1,
  add column availability_reason text,
  add column availability_actor_id uuid,
  add column availability_correlation_id uuid,
  add column availability_updated_at timestamptz,
  add constraint hotel_rate_rules_admin_d_availability_version_check
    check (availability_version > 0),
  add constraint hotel_rate_rules_admin_d_availability_reason_check
    check (availability_reason is null or (availability_reason=btrim(availability_reason)
      and length(availability_reason) between 1 and 500 and availability_reason!~'[[:cntrl:]]'));

alter table public.hotel_calendar_overrides
  add column availability_active boolean not null default true,
  add column availability_expires_at timestamptz,
  add column availability_version bigint not null default 1,
  add column availability_reason text,
  add column availability_actor_id uuid,
  add column availability_correlation_id uuid,
  add column availability_updated_at timestamptz,
  add constraint hotel_calendar_overrides_admin_d_availability_version_check check(availability_version>0),
  add constraint hotel_calendar_overrides_admin_d_availability_reason_check
    check(availability_reason is null or (availability_reason=btrim(availability_reason)
      and length(availability_reason) between 1 and 500 and availability_reason!~'[[:cntrl:]]'));

alter table public.hotel_units
  add constraint hotel_units_id_room_type_id_key unique(id,room_type_id);
alter table public.hotel_room_rates
  add constraint hotel_room_rates_admin_d_exact_product_key unique(id,hotel_id,room_type_id,rate_plan_id);

comment on column public.hotel_rate_rules.availability_version is
  'ADMIN-D field-scoped optimistic version for CTA/CTD only; ADMIN-C pricing edits do not advance it.';

create table public.hotel_unit_calendar_blocks (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  room_type_id uuid not null,
  unit_id uuid not null references public.hotel_units(id) on delete restrict,
  from_date date not null,
  to_date date not null,
  blocked boolean not null default true,
  reason text not null,
  expires_at timestamptz,
  is_active boolean not null default true,
  actor_id uuid not null,
  correlation_id uuid not null,
  version bigint not null default 1,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint hotel_unit_calendar_blocks_room_hotel_fkey foreign key (room_type_id,hotel_id)
    references public.hotel_room_types(id,hotel_id) on delete restrict,
  constraint hotel_unit_calendar_blocks_unit_room_fkey foreign key(unit_id,room_type_id)
    references public.hotel_units(id,room_type_id) on delete restrict,
  constraint hotel_unit_calendar_blocks_dates_check check (to_date >= from_date),
  constraint hotel_unit_calendar_blocks_reason_check check (reason=btrim(reason)
    and length(reason) between 1 and 500 and reason!~'[[:cntrl:]]'),
  constraint hotel_unit_calendar_blocks_version_check check (version > 0)
);
create index hotel_unit_calendar_blocks_lookup_idx
  on public.hotel_unit_calendar_blocks(hotel_id,room_type_id,from_date,to_date,unit_id)
  where is_active and blocked;

create table public.hotel_inventory_day_locks (
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  room_type_id uuid not null,
  stay_date date not null,
  version bigint not null default 1,
  updated_at timestamptz not null default clock_timestamp(),
  primary key(room_type_id,stay_date),
  constraint hotel_inventory_day_locks_room_hotel_fkey foreign key(room_type_id,hotel_id)
    references public.hotel_room_types(id,hotel_id) on delete cascade,
  constraint hotel_inventory_day_locks_version_check check(version>0)
);

create table public.hotel_inventory_holds (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  status text not null default 'active',
  expires_at timestamptz not null,
  released_at timestamptz,
  release_reason text,
  configuration_fingerprint text not null,
  version bigint not null default 1,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint hotel_inventory_holds_status_check check(status in('active','released','expired','consumed')),
  constraint hotel_inventory_holds_fingerprint_check check(configuration_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint hotel_inventory_holds_release_reason_check check(release_reason is null or
    (release_reason=btrim(release_reason) and length(release_reason) between 1 and 500
      and release_reason!~'[[:cntrl:]]')),
  constraint hotel_inventory_holds_version_check check(version>0)
);
comment on table public.hotel_inventory_holds is
  'Empty trusted-backend foundation. ADMIN-D exposes release only; no browser/customer/Partner create or conversion RPC exists.';

create table public.hotel_booking_room_allocations (
  id uuid primary key,
  booking_id uuid not null references public.hotel_bookings(id) on delete restrict,
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  room_type_id uuid not null,
  rate_plan_id uuid not null,
  room_rate_id uuid not null,
  unit_ids uuid[] not null default '{}'::uuid[],
  units_required integer not null,
  allocated_guest_counts smallint[] not null,
  pricing_guest_counts smallint[] not null,
  booking_updated_at timestamptz not null,
  status text not null default 'active',
  released_at timestamptz,
  release_reason text,
  actor_id uuid not null,
  correlation_id uuid not null,
  version bigint not null default 1,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint hotel_booking_room_allocations_room_hotel_fkey foreign key(room_type_id,hotel_id)
    references public.hotel_room_types(id,hotel_id) on delete restrict,
  constraint hotel_booking_room_allocations_rate_hotel_fkey foreign key(room_rate_id,hotel_id)
    references public.hotel_room_rates(id,hotel_id) on delete restrict,
  constraint hotel_booking_room_allocations_plan_hotel_fkey foreign key(rate_plan_id,hotel_id)
    references public.hotel_rate_plans(id,hotel_id) on delete restrict,
  constraint hotel_booking_room_allocations_exact_product_fkey foreign key(room_rate_id,hotel_id,room_type_id,rate_plan_id)
    references public.hotel_room_rates(id,hotel_id,room_type_id,rate_plan_id) on delete restrict,
  constraint hotel_booking_room_allocations_units_check check(units_required>0 and cardinality(unit_ids) in(0,units_required)),
  constraint hotel_booking_room_allocations_guest_vectors_check check(
    cardinality(allocated_guest_counts)=units_required
    and cardinality(pricing_guest_counts)=units_required
    and array_position(allocated_guest_counts,null) is null
    and array_position(pricing_guest_counts,null) is null
    and 0 < all(allocated_guest_counts) and 0 < all(pricing_guest_counts)),
  constraint hotel_booking_room_allocations_status_check check(status in('active','released')),
  constraint hotel_booking_room_allocations_reason_check check(release_reason is null or
    (release_reason=btrim(release_reason) and length(release_reason) between 1 and 500
      and release_reason!~'[[:cntrl:]]')),
  constraint hotel_booking_room_allocations_version_check check(version>0)
);
create index hotel_booking_room_allocations_booking_idx
  on public.hotel_booking_room_allocations(booking_id,status,id);

create table public.hotel_inventory_commitments (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  room_type_id uuid not null,
  stay_date date not null,
  hold_id uuid references public.hotel_inventory_holds(id) on delete restrict,
  booking_allocation_id uuid references public.hotel_booking_room_allocations(id) on delete restrict,
  unit_id uuid references public.hotel_units(id) on delete restrict,
  units integer not null default 1,
  status text not null default 'active',
  expires_at timestamptz,
  version bigint not null default 1,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint hotel_inventory_commitments_room_hotel_fkey foreign key(room_type_id,hotel_id)
    references public.hotel_room_types(id,hotel_id) on delete restrict,
  constraint hotel_inventory_commitments_source_check check((hold_id is null)<>(booking_allocation_id is null)),
  constraint hotel_inventory_commitments_units_check check(units>0),
  constraint hotel_inventory_commitments_status_check check(status in('active','released','expired')),
  constraint hotel_inventory_commitments_expiry_check check(hold_id is not null or expires_at is null),
  constraint hotel_inventory_commitments_version_check check(version>0)
);
create index hotel_inventory_commitments_day_idx
  on public.hotel_inventory_commitments(hotel_id,room_type_id,stay_date,status);
create unique index hotel_inventory_commitments_booking_day_uidx
  on public.hotel_inventory_commitments(booking_allocation_id,stay_date,coalesce(unit_id,'00000000-0000-0000-0000-000000000000'::uuid))
  where booking_allocation_id is not null;
create unique index hotel_inventory_commitments_hold_day_unit_uidx
  on public.hotel_inventory_commitments(hold_id,room_type_id,stay_date,coalesce(unit_id,'00000000-0000-0000-0000-000000000000'::uuid))
  where hold_id is not null;

create table public.hotel_admin_availability_action_receipts (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  correlation_id uuid not null,
  idempotency_key text not null,
  request_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint hotel_admin_availability_receipts_key_check check(idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$'),
  constraint hotel_admin_availability_receipts_hash_check check(request_hash ~ '^[0-9a-f]{64}$'),
  constraint hotel_admin_availability_receipts_result_check check(jsonb_typeof(result)='object'),
  constraint hotel_admin_availability_receipts_actor_key unique(actor_id,idempotency_key),
  constraint hotel_admin_availability_receipts_correlation unique(correlation_id)
);

create table public.hotel_admin_availability_plan_reviews(
  actor_id uuid not null,
  plan_fingerprint text not null,
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  reviewed_plan jsonb not null,
  snapshot_token text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  correlation_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  primary key(actor_id,plan_fingerprint),
  constraint hotel_admin_availability_plan_reviews_hash_check check(plan_fingerprint~'^[0-9a-f]{64}$'),
  constraint hotel_admin_availability_plan_reviews_plan_check check(jsonb_typeof(reviewed_plan)='object')
);

create function public.hotel_v2_admin_d_protected_fingerprints()
returns jsonb language sql stable security definer set search_path=pg_catalog,public
as $function$
with relation_specs(relation_name,excluded_columns) as(values
  ('hotels','{}'::text[]),('hotel_room_types','{}'::text[]),('hotel_units','{}'::text[]),
  ('hotel_property_pricing_defaults','{}'::text[]),('hotel_rate_plans','{}'::text[]),
  ('hotel_room_rates','{}'::text[]),('hotel_pricing_schedules','{}'::text[]),
  ('hotel_pricing_schedule_occupancy_tiers','{}'::text[]),('hotel_room_rate_occupancy_tiers','{}'::text[]),
  ('hotel_rate_rules',array['closed_to_arrival','closed_to_departure','version','updated_at',
    'availability_version','availability_reason','availability_actor_id','availability_correlation_id','availability_updated_at']::text[]),
  ('hotel_room_allocation_rules','{}'::text[]),('hotel_room_allocation_rule_items','{}'::text[]),
  ('hotel_daily_rates','{}'::text[]),('hotel_pricing_promotion_reviews','{}'::text[]),
  ('hotel_admin_pricing_action_receipts','{}'::text[]),
  ('hotel_calendar_source_configs','{}'::text[]),('hotel_payment_policies','{}'::text[]),
  ('hotel_payment_policy_terms','{}'::text[]),('hotel_commission_policies','{}'::text[]),
  ('hotel_bookings','{}'::text[]),('partner_service_fulfillments','{}'::text[]),
  ('partner_service_fulfillment_form_snapshots','{}'::text[]),('service_deposit_requests','{}'::text[]),
  ('service_deposit_rules','{}'::text[]),('service_deposit_overrides','{}'::text[]),
  ('service_coupons','{}'::text[]),('service_coupon_redemptions','{}'::text[]),('referrals','{}'::text[]),
  ('affiliate_commission_events','{}'::text[]),('affiliate_payouts','{}'::text[]),
  ('affiliate_adjustments','{}'::text[]),('affiliate_program_settings','{}'::text[]),
  ('affiliate_referrer_overrides','{}'::text[]),('affiliate_cashout_requests','{}'::text[]),
  ('profile_referral_code_aliases','{}'::text[]),('site_settings','{}'::text[]),('partners','{}'::text[]),
  ('partner_users','{}'::text[]),('partner_resources','{}'::text[]),('partner_user_resources','{}'::text[]),
  ('hotel_partner_hotel_permissions','{}'::text[]),('hotel_partner_action_receipts','{}'::text[]),
  ('hotel_partner_event_outbox','{}'::text[]),('hotel_property_operational_profiles','{}'::text[])
), base as(select coalesce(jsonb_object_agg(spec.relation_name,md5(pg_catalog.query_to_xml(format(
  'select (to_jsonb(row_value)-%L::text[])::text from public.%I row_value order by (to_jsonb(row_value)-%L::text[])::text',
  spec.excluded_columns,spec.relation_name,spec.excluded_columns),true,true,'')::text) order by spec.relation_name),'{}') value
  from relation_specs spec where to_regclass('public.'||spec.relation_name) is not null),
special as(select jsonb_build_object(
  'hotel_calendar_pricing_state',md5(pg_catalog.query_to_xml(
    'select id,hotel_id,room_rate_id,stay_date,nightly_rate,nightly_rate_mode,minimum_stay,minimum_stay_mode,maximum_stay,maximum_stay_mode,reason,expires_at,actor_id,actor_type,source,source_timestamp,is_active,provenance,created_at,pricing_source,pricing_reason,pricing_expires_at,pricing_actor_type,pricing_actor_id,pricing_updated_at,pricing_correlation_id from public.hotel_calendar_overrides where nightly_rate_mode is not null or minimum_stay_mode is not null or maximum_stay_mode is not null order by id',true,true,'')::text),
  'non_admin_d_activity',md5(pg_catalog.query_to_xml(
    $query$select to_jsonb(row_value)::text from public.hotel_activity_log row_value where source is distinct from 'hotels_v2_admin_d_availability_control' order by row_value.id$query$,true,true,'')::text)) value)
select base.value||special.value from base cross join special
$function$;

create table public.hotel_admin_availability_foundation_receipts(
  id smallint primary key default 1 check(id=1),
  protected_fingerprints jsonb not null,
  protected_fingerprint text not null check(protected_fingerprint~'^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  constraint hotel_admin_availability_foundation_fingerprints_check check(jsonb_typeof(protected_fingerprints)='object')
);

-- Do not bless a drifted H3.1P/ADMIN-C graph into the immutable D receipt.
-- SHARE locks keep every captured protected relation stable until COMMIT.
do $admin_d_foundation_capture_guard$
declare v_snapshot jsonb; v_lock_sql text;
begin
  select 'lock table '||string_agg(format('public.%I',relation_name),', ')||' in share mode'
    into v_lock_sql
  from (select unnest(array[
    'hotels','hotel_room_types','hotel_units','hotel_property_pricing_defaults','hotel_rate_plans',
    'hotel_room_rates','hotel_pricing_schedules','hotel_pricing_schedule_occupancy_tiers',
    'hotel_room_rate_occupancy_tiers','hotel_rate_rules','hotel_room_allocation_rules',
    'hotel_room_allocation_rule_items','hotel_daily_rates','hotel_calendar_overrides',
    'hotel_pricing_promotion_reviews','hotel_admin_pricing_action_receipts',
    'hotel_calendar_source_configs','hotel_payment_policies',
    'hotel_payment_policy_terms','hotel_commission_policies','hotel_bookings','hotel_activity_log',
    'partner_service_fulfillments','partner_service_fulfillment_form_snapshots','service_deposit_requests',
    'service_deposit_rules','service_deposit_overrides','service_coupons','service_coupon_redemptions',
    'referrals','affiliate_commission_events','affiliate_payouts','affiliate_adjustments',
    'affiliate_program_settings','affiliate_referrer_overrides','affiliate_cashout_requests',
    'profile_referral_code_aliases','site_settings','partners','partner_users','partner_resources',
    'partner_user_resources','hotel_partner_hotel_permissions','hotel_partner_action_receipts',
    'hotel_partner_event_outbox','hotel_property_operational_profiles']) as relation_name) protected
  where to_regclass('public.'||protected.relation_name) is not null;
  execute v_lock_sql;
  if (select count(*) from public.site_settings)<>1
     or not exists(select 1 from public.site_settings where id=1
       and not hotel_rooms_v2_enabled and not hotel_external_sync_enabled
       and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled)
     or not exists(select 1 from public.hotels where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
       and architecture_version='legacy' and md5(pricing_tiers::text)='7208ab4ecc0e47abd64d87ca1ac53a03'
       and jsonb_array_length(pricing_tiers->'rules')=63)
     or exists(select 1 from public.hotel_rate_plans where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' and is_active)
     or exists(select 1 from public.hotel_room_rates where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' and is_active)
     or exists(select 1 from public.hotel_pricing_schedules where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' and is_active)
     or not public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact() then
    raise exception using errcode='55000',message='hotels_v2_admin_d_accepted_foundation_drift';
  end if;
  v_snapshot:=public.hotel_v2_h3_1p_pricing_promotion_snapshot('9b6d99a0-923a-4fbc-be54-c066e856e6ca');
  if not coalesce((v_snapshot->>'supported')::boolean,false)
     or v_snapshot#>>'{promotion,status}'<>'reviewed'
     or v_snapshot#>>'{source,pricing_fingerprint}'<>'7208ab4ecc0e47abd64d87ca1ac53a03'
     or (v_snapshot#>>'{source,rule_count}')::integer<>63
     or v_snapshot->>'pricing_occupancy_mapping_fingerprint'<>'6f6e6c64f0b0d0aa60e3575d4fd4ac1c'
     or v_snapshot#>>'{parity,fingerprint}'<>'b3c915266ab060efaba522cf5587fb75'
     or (v_snapshot#>>'{parity,total_case_count}')::integer<>70
     or (v_snapshot#>>'{parity,total_mismatch_count}')::integer<>0
     or (v_snapshot#>>'{target,room_schedule,tier_count}')::integer<>27
     or (v_snapshot#>>'{source,property_party_preview,tier_count}')::integer<>63
     or not exists(select 1 from public.hotel_pricing_promotion_reviews review
       where review.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
         and review.contract_version='seven_kamares_legacy_to_h3_pricing_v1'
         and review.review_status='reviewed' and review.acknowledged_pricing_occupancy_mapping
         and review.source_fingerprint=v_snapshot#>>'{source,pricing_fingerprint}'
         and review.target_fingerprint=v_snapshot#>>'{target,target_fingerprint}'
         and review.pricing_occupancy_mapping_fingerprint=v_snapshot->>'pricing_occupancy_mapping_fingerprint'
         and review.parity_fingerprint=v_snapshot#>>'{parity,fingerprint}'
         and review.parity_case_count=(v_snapshot#>>'{parity,total_case_count}')::integer
         and review.parity_mismatch_count=(v_snapshot#>>'{parity,total_mismatch_count}')::integer
         and review.result->>'target_fingerprint'=review.target_fingerprint) then
    raise exception using errcode='55000',message='hotels_v2_admin_d_h3_1p_oracle_drift';
  end if;
end
$admin_d_foundation_capture_guard$;
insert into public.hotel_admin_availability_foundation_receipts(id,protected_fingerprints,protected_fingerprint)
select 1,fingerprints,encode(extensions.digest(convert_to(fingerprints::text,'UTF8'),'sha256'),'hex')
from (select public.hotel_v2_admin_d_protected_fingerprints() fingerprints) captured;

alter table public.hotel_unit_calendar_blocks enable row level security;
alter table public.hotel_inventory_day_locks enable row level security;
alter table public.hotel_inventory_holds enable row level security;
alter table public.hotel_booking_room_allocations enable row level security;
alter table public.hotel_inventory_commitments enable row level security;
alter table public.hotel_admin_availability_action_receipts enable row level security;
alter table public.hotel_admin_availability_plan_reviews enable row level security;
alter table public.hotel_admin_availability_foundation_receipts enable row level security;

revoke all on table public.hotel_unit_calendar_blocks,public.hotel_inventory_day_locks,
  public.hotel_inventory_holds,public.hotel_booking_room_allocations,
  public.hotel_inventory_commitments,public.hotel_admin_availability_action_receipts,
  public.hotel_admin_availability_plan_reviews,public.hotel_admin_availability_foundation_receipts
  from public,anon,authenticated,service_role;
revoke select,insert,update,delete,truncate,references,trigger
  on table public.hotel_room_types,public.hotel_units,public.hotel_rate_plans,
    public.hotel_room_rates,public.hotel_rate_rules,public.hotel_daily_inventory,
    public.hotel_daily_rates,public.hotel_calendar_overrides
  from public,anon,authenticated;

create function public.hotel_v2_admin_d_keys_allowed(p_value jsonb,p_keys text[])
returns boolean language sql immutable set search_path=pg_catalog
as $$select jsonb_typeof(p_value)='object' and not exists(
  select 1 from jsonb_object_keys(p_value) key_name where not key_name=any(p_keys))$$;

create function public.hotel_v2_admin_d_hash(p_value jsonb)
returns text language sql immutable strict set search_path=pg_catalog,public
as $$select encode(extensions.digest(convert_to(p_value::text,'UTF8'),'sha256'),'hex')$$;

create function public.hotel_v2_admin_d_uuid_is_canonical(p_value text)
returns boolean language sql immutable set search_path=pg_catalog
as $$select p_value is not null and p_value ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'$$;

create function public.hotel_v2_admin_d_deterministic_uuid(p_value text)
returns uuid language sql immutable strict set search_path=pg_catalog
as $function$
  select (substr(md5(p_value),1,8)||'-'||substr(md5(p_value),9,4)||'-5'||
    substr(md5(p_value),14,3)||'-8'||substr(md5(p_value),18,3)||'-'||substr(md5(p_value),21,12))::uuid
$function$;

create function public.hotel_v2_admin_d_reason_is_valid(p_value jsonb)
returns boolean language sql immutable set search_path=pg_catalog
as $$select coalesce(jsonb_typeof(p_value)='string' and p_value#>>'{}'=btrim(p_value#>>'{}')
  and length(p_value#>>'{}') between 1 and 500 and (p_value#>>'{}')!~'[[:cntrl:]]',false)$$;

create function public.hotel_v2_admin_d_json_dates_are_canonical(p_value jsonb)
returns boolean language plpgsql immutable set search_path=pg_catalog,public
as $function$
declare v_key text; v_child jsonb;
begin
  if p_value is null then return false; end if;
  if jsonb_typeof(p_value)='object' then
    for v_key,v_child in select key,value from jsonb_each(p_value) loop
      if v_key in('from','to','stay_date','from_date','to_date','valid_from','valid_to','arrival_date','departure_date','check_in','check_out')
         and (jsonb_typeof(v_child)<>'string' or not public.hotel_v2_admin_c_date_is_canonical(v_child#>>'{}')) then return false; end if;
      if v_key in('reviewed_at','expires_at','availability_expires_at','availability_updated_at','booking_updated_at','updated_at','snapshot_as_of','snapshot_valid_until')
         and jsonb_typeof(v_child)<>'null' and (jsonb_typeof(v_child)<>'string'
           or not public.hotel_v2_admin_c_timestamptz_is_canonical(v_child#>>'{}')) then return false; end if;
      if jsonb_typeof(v_child) in('object','array') and not public.hotel_v2_admin_d_json_dates_are_canonical(v_child) then return false; end if;
    end loop;
  elsif jsonb_typeof(p_value)='array' then
    for v_child in select value from jsonb_array_elements(p_value) loop
      if jsonb_typeof(v_child) in('object','array') and not public.hotel_v2_admin_d_json_dates_are_canonical(v_child) then return false; end if;
    end loop;
  end if;
  return true;
end
$function$;

create function public.hotel_v2_admin_d_validate_shared_availability_fields()
returns trigger language plpgsql security definer set search_path=pg_catalog,public
as $function$
declare v_changed boolean; v_neutral boolean;
begin
  if tg_table_name='hotel_rate_rules' then
    if tg_op='DELETE' then
      if old.closed_to_arrival or old.closed_to_departure
         or old.availability_reason is not null or old.availability_actor_id is not null
         or old.availability_correlation_id is not null or old.availability_updated_at is not null
         or old.availability_version>1 then
        raise exception using errcode='55000',message='hotels_v2_admin_d_availability_history_delete_forbidden'; end if;
      return old;
    end if;
    if tg_op='INSERT' then
      v_neutral:=not new.closed_to_arrival and not new.closed_to_departure;
      if v_neutral then
        if new.availability_reason is not null or new.availability_actor_id is not null
           or new.availability_correlation_id is not null or new.availability_updated_at is not null
           or new.availability_version<>1 then
          raise exception using errcode='55000',message='hotels_v2_admin_d_rate_rule_availability_metadata_invalid'; end if;
      elsif new.availability_version<>1 or not public.hotel_v2_admin_d_reason_is_valid(to_jsonb(new.availability_reason))
         or new.availability_actor_id is null or new.availability_correlation_id is null
         or new.availability_updated_at is null then
        raise exception using errcode='55000',message='hotels_v2_admin_d_rate_rule_availability_metadata_required'; end if;
      return new;
    end if;
    if (old.closed_to_arrival or old.closed_to_departure or new.closed_to_arrival or new.closed_to_departure)
       and (new.room_rate_id,new.valid_from,new.valid_to,new.weekdays,new.priority,new.is_active)
         is distinct from (old.room_rate_id,old.valid_from,old.valid_to,old.weekdays,old.priority,old.is_active) then
      raise exception using errcode='55000',message='hotels_v2_admin_d_active_rate_rule_scope_immutable'; end if;
    v_changed:=(new.closed_to_arrival,new.closed_to_departure)
      is distinct from (old.closed_to_arrival,old.closed_to_departure);
    if not v_changed then
      if (new.availability_version,new.availability_reason,new.availability_actor_id,
          new.availability_correlation_id,new.availability_updated_at)
         is distinct from (old.availability_version,old.availability_reason,old.availability_actor_id,
          old.availability_correlation_id,old.availability_updated_at) then
        raise exception using errcode='55000',message='hotels_v2_admin_d_availability_metadata_without_change'; end if;
    elsif (new.id,new.room_rate_id,new.valid_from,new.valid_to,new.weekdays,new.nightly_rate,
          new.minimum_stay,new.maximum_stay,new.priority,new.is_active,new.created_at)
        is distinct from
        (old.id,old.room_rate_id,old.valid_from,old.valid_to,old.weekdays,old.nightly_rate,
          old.minimum_stay,old.maximum_stay,old.priority,old.is_active,old.created_at) then
      raise exception using errcode='55000',message='hotels_v2_admin_d_cross_domain_write_forbidden';
    elsif new.availability_version<>old.availability_version+1
       or not public.hotel_v2_admin_d_reason_is_valid(to_jsonb(new.availability_reason))
       or new.availability_actor_id is null or new.availability_correlation_id is null
       or new.availability_updated_at is null
       or new.availability_updated_at<=coalesce(old.availability_updated_at,'-infinity'::timestamptz) then
      raise exception using errcode='55000',message='hotels_v2_admin_d_availability_change_metadata_invalid';
    end if;
    return new;
  elsif tg_table_name='hotel_calendar_overrides' then
    if tg_op='DELETE' then
      if old.closed_mode is not null or old.closed_to_arrival_mode is not null
         or old.closed_to_departure_mode is not null or old.availability_reason is not null
         or old.availability_actor_id is not null or old.availability_correlation_id is not null
         or old.availability_updated_at is not null or old.availability_expires_at is not null
         or old.availability_version>1 then
        raise exception using errcode='55000',message='hotels_v2_admin_d_availability_history_delete_forbidden'; end if;
      return old;
    end if;
    if tg_op='INSERT' then
      v_neutral:=new.closed_mode is null and new.closed_to_arrival_mode is null
        and new.closed_to_departure_mode is null;
      if v_neutral then
        if new.availability_reason is not null or new.availability_actor_id is not null
           or new.availability_correlation_id is not null or new.availability_updated_at is not null
           or new.availability_expires_at is not null or new.availability_version<>1 then
          raise exception using errcode='55000',message='hotels_v2_admin_d_calendar_availability_metadata_invalid'; end if;
      elsif new.availability_version<>1 or not public.hotel_v2_admin_d_reason_is_valid(to_jsonb(new.availability_reason))
         or new.availability_actor_id is null or new.availability_correlation_id is null
         or new.availability_updated_at is null then
        raise exception using errcode='55000',message='hotels_v2_admin_d_calendar_availability_metadata_required'; end if;
      return new;
    end if;
    if (old.closed_mode is not null or old.closed_to_arrival_mode is not null
        or old.closed_to_departure_mode is not null or new.closed_mode is not null
        or new.closed_to_arrival_mode is not null or new.closed_to_departure_mode is not null)
       and (new.room_rate_id,new.stay_date) is distinct from (old.room_rate_id,old.stay_date) then
      raise exception using errcode='55000',message='hotels_v2_admin_d_active_calendar_identity_immutable'; end if;
    if old.availability_updated_at is null
       and (old.closed_mode is not null or old.closed_to_arrival_mode is not null or old.closed_to_departure_mode is not null)
       and (new.is_active,new.reason,new.expires_at) is distinct from (old.is_active,old.reason,old.expires_at) then
      raise exception using errcode='55000',message='hotels_v2_admin_d_legacy_calendar_scope_immutable'; end if;
    v_changed:=(new.closed,new.closed_mode,new.closed_to_arrival,new.closed_to_arrival_mode,
      new.closed_to_departure,new.closed_to_departure_mode,new.availability_active,new.availability_expires_at)
      is distinct from (old.closed,old.closed_mode,old.closed_to_arrival,old.closed_to_arrival_mode,
      old.closed_to_departure,old.closed_to_departure_mode,old.availability_active,old.availability_expires_at);
    if not v_changed then
      if (new.availability_version,new.availability_reason,new.availability_actor_id,
          new.availability_correlation_id,new.availability_updated_at)
         is distinct from (old.availability_version,old.availability_reason,old.availability_actor_id,
          old.availability_correlation_id,old.availability_updated_at) then
        raise exception using errcode='55000',message='hotels_v2_admin_d_availability_metadata_without_change'; end if;
    elsif (new.id,new.hotel_id,new.room_rate_id,new.stay_date,new.nightly_rate,new.nightly_rate_mode,
        new.minimum_stay,new.minimum_stay_mode,new.maximum_stay,new.maximum_stay_mode,
        new.reason,new.expires_at,new.actor_id,new.actor_type,new.source,new.source_timestamp,
        new.is_active,new.provenance,new.created_at)
      is distinct from
      (old.id,old.hotel_id,old.room_rate_id,old.stay_date,old.nightly_rate,old.nightly_rate_mode,
        old.minimum_stay,old.minimum_stay_mode,old.maximum_stay,old.maximum_stay_mode,
        old.reason,old.expires_at,old.actor_id,old.actor_type,old.source,old.source_timestamp,
        old.is_active,old.provenance,old.created_at) then
      raise exception using errcode='55000',message='hotels_v2_admin_d_cross_domain_write_forbidden';
    elsif new.availability_version<>old.availability_version+1
       or not public.hotel_v2_admin_d_reason_is_valid(to_jsonb(new.availability_reason))
       or new.availability_actor_id is null or new.availability_correlation_id is null
       or new.availability_updated_at is null
       or new.availability_updated_at<=coalesce(old.availability_updated_at,'-infinity'::timestamptz) then
      raise exception using errcode='55000',message='hotels_v2_admin_d_availability_change_metadata_invalid';
    end if;
    return new;
  else
    raise exception using errcode='55000',
      message='hotels_v2_admin_d_shared_availability_trigger_relation_invalid';
  end if;
end
$function$;
create trigger hotel_rate_rules_admin_d_availability_guard
before insert or update or delete on public.hotel_rate_rules for each row
execute function public.hotel_v2_admin_d_validate_shared_availability_fields();
create trigger hotel_calendar_overrides_admin_d_availability_guard
before insert or update or delete on public.hotel_calendar_overrides for each row
execute function public.hotel_v2_admin_d_validate_shared_availability_fields();

create function public.hotel_v2_admin_d_audit_state(p_entity text,p_state jsonb)
returns jsonb language sql immutable set search_path=pg_catalog,public
as $function$
select case when p_state is null then null
  when p_entity='daily_inventory' then jsonb_build_object('room_type_id',p_state->'room_type_id','stay_date',p_state->'stay_date','sellable_units',p_state->'sellable_units','sellable_units_mode',p_state->'sellable_units_mode','closed',p_state->'closed','closed_mode',p_state->'closed_mode','reason',p_state->'reason','expires_at',p_state->'expires_at','version',p_state->'version','deleted',p_state->'deleted')
  when p_entity='unit_calendar_block' then jsonb_build_object('id',p_state->'id','room_type_id',p_state->'room_type_id','unit_id',p_state->'unit_id','from_date',p_state->'from_date','to_date',p_state->'to_date','blocked',p_state->'blocked','reason',p_state->'reason','expires_at',p_state->'expires_at','is_active',p_state->'is_active','version',p_state->'version')
  when p_entity='operational_override' then jsonb_build_object('id',p_state->'id','room_rate_id',p_state->'room_rate_id','stay_date',p_state->'stay_date','closed',p_state->'closed','closed_mode',p_state->'closed_mode','closed_to_arrival',p_state->'closed_to_arrival','closed_to_arrival_mode',p_state->'closed_to_arrival_mode','closed_to_departure',p_state->'closed_to_departure','closed_to_departure_mode',p_state->'closed_to_departure_mode','availability_active',p_state->'availability_active','availability_expires_at',p_state->'availability_expires_at','availability_reason',p_state->'availability_reason','availability_version',p_state->'availability_version')
  when p_entity='rate_rule_operational_restriction' then jsonb_build_object('id',p_state->'id','room_rate_id',p_state->'room_rate_id','valid_from',p_state->'valid_from','valid_to',p_state->'valid_to','weekdays',p_state->'weekdays','priority',p_state->'priority','is_active',p_state->'is_active','closed_to_arrival',p_state->'closed_to_arrival','closed_to_departure',p_state->'closed_to_departure','availability_reason',p_state->'availability_reason','availability_version',p_state->'availability_version')
  when p_entity='booking_allocation' then jsonb_build_object('booking_id',p_state->'booking_id','booking_updated_at',p_state->'booking_updated_at','allocations',coalesce(p_state->'allocations','[]'::jsonb))
  when p_entity='hold' then jsonb_build_object('id',p_state->'id','status',p_state->'status','expires_at',p_state->'expires_at','release_reason',p_state->'release_reason','version',p_state->'version')
  else jsonb_build_object('fingerprint',encode(extensions.digest(convert_to(p_state::text,'UTF8'),'sha256'),'hex'),'redacted',true) end
$function$;

create function public.hotel_v2_admin_d_immutable_row()
returns trigger language plpgsql set search_path=pg_catalog
as $$begin raise exception using errcode='55000',message='hotels_v2_admin_d_immutable_receipt'; end$$;
create trigger hotel_admin_availability_receipts_immutable
before update or delete on public.hotel_admin_availability_action_receipts for each row
execute function public.hotel_v2_admin_d_immutable_row();
create trigger hotel_admin_availability_reviews_no_delete
before delete on public.hotel_admin_availability_plan_reviews for each row
execute function public.hotel_v2_admin_d_immutable_row();
create trigger hotel_admin_availability_foundation_immutable
before update or delete on public.hotel_admin_availability_foundation_receipts for each row
execute function public.hotel_v2_admin_d_immutable_row();
create trigger hotel_unit_calendar_blocks_no_delete
before delete on public.hotel_unit_calendar_blocks for each row execute function public.hotel_v2_admin_d_immutable_row();
create trigger hotel_inventory_holds_no_delete
before delete on public.hotel_inventory_holds for each row execute function public.hotel_v2_admin_d_immutable_row();
create trigger hotel_booking_room_allocations_no_delete
before delete on public.hotel_booking_room_allocations for each row execute function public.hotel_v2_admin_d_immutable_row();
create trigger hotel_inventory_commitments_no_delete
before delete on public.hotel_inventory_commitments for each row execute function public.hotel_v2_admin_d_immutable_row();
create function public.hotel_v2_admin_d_plan_review_consume_guard()
returns trigger language plpgsql set search_path=pg_catalog
as $$begin
  if (new.actor_id,new.plan_fingerprint,new.hotel_id,new.reviewed_plan,new.snapshot_token,new.expires_at,new.created_at)
     is distinct from (old.actor_id,old.plan_fingerprint,old.hotel_id,old.reviewed_plan,old.snapshot_token,old.expires_at,old.created_at)
     or old.consumed_at is not null or new.consumed_at is null or new.correlation_id is null then
    raise exception using errcode='55000',message='hotels_v2_admin_d_immutable_review'; end if;
  return new;
end$$;
create trigger hotel_admin_availability_reviews_consume_guard
before update on public.hotel_admin_availability_plan_reviews for each row
execute function public.hotel_v2_admin_d_plan_review_consume_guard();

create function public.hotel_v2_admin_d_validate_unit_block()
returns trigger language plpgsql security definer set search_path=pg_catalog,public
as $function$
declare v_day date; v_physical integer; v_blocked integer; v_configured integer; v_committed integer;
begin
  if tg_op='UPDATE' and ((new.id,new.hotel_id,new.room_type_id,new.unit_id,new.created_at)
      is distinct from (old.id,old.hotel_id,old.room_type_id,old.unit_id,old.created_at)
      or new.version<>old.version+1 or new.updated_at<=old.updated_at) then
    raise exception using errcode='55000',message='hotels_v2_admin_d_invalid_unit_block_transition'; end if;
  if new.reason<>btrim(new.reason) or new.reason~'[[:cntrl:]]' then
    raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_unit_block_reason'; end if;
  if new.is_active and new.blocked and (new.expires_at is null or new.expires_at>clock_timestamp())
     and not exists(select 1 from public.hotel_units unit join public.hotel_room_types room on room.id=unit.room_type_id
    where unit.id=new.unit_id and unit.room_type_id=new.room_type_id and unit.status='active'
      and room.hotel_id=new.hotel_id and room.status='active' and room.inventory_mode='unitized') then
    raise exception using errcode='23503',message='hotels_v2_admin_d_foreign_unit'; end if;
  for v_day in select day_value::date from generate_series(new.from_date,new.to_date,interval '1 day') day_value order by day_value loop
    perform pg_advisory_xact_lock(hashtextextended(new.room_type_id::text||':'||v_day::text,0));
    if new.is_active and new.blocked and (new.expires_at is null or new.expires_at>clock_timestamp()) then
      select count(*) into v_physical from public.hotel_units where room_type_id=new.room_type_id and status='active';
      select count(distinct block.unit_id) into v_blocked from public.hotel_unit_calendar_blocks block
        where block.room_type_id=new.room_type_id and block.id<>new.id and block.is_active and block.blocked
          and (block.expires_at is null or block.expires_at>clock_timestamp()) and v_day between block.from_date and block.to_date;
      v_blocked:=v_blocked+1;
      select case when inventory.sellable_units_mode='set' and (inventory.expires_at is null or inventory.expires_at>clock_timestamp())
        then inventory.sellable_units else v_physical end into v_configured from public.hotel_daily_inventory inventory
        where inventory.room_type_id=new.room_type_id and inventory.stay_date=v_day;
      v_configured:=coalesce(v_configured,v_physical);
      select coalesce(sum(commitment.units),0)::integer into v_committed
      from public.hotel_inventory_commitments commitment
      left join public.hotel_inventory_holds hold_row on hold_row.id=commitment.hold_id
      left join public.hotel_booking_room_allocations allocation on allocation.id=commitment.booking_allocation_id
      left join public.hotel_bookings booking on booking.id=allocation.booking_id
      where commitment.room_type_id=new.room_type_id and commitment.stay_date=v_day and commitment.status='active'
        and ((commitment.hold_id is not null and hold_row.status='active' and hold_row.expires_at>clock_timestamp())
          or (commitment.booking_allocation_id is not null and allocation.status='active' and booking.status in('pending','confirmed')));
      if least(v_physical-v_blocked,v_configured)<v_committed then
        raise exception using errcode='PT409',message='hotels_v2_admin_d_capacity_below_commitments'; end if;
    end if;
  end loop;
  perform pg_advisory_xact_lock(hashtextextended(new.unit_id::text,0));
  if new.is_active and new.blocked and (new.expires_at is null or new.expires_at>clock_timestamp()) and exists(
    select 1 from public.hotel_unit_calendar_blocks block where block.unit_id=new.unit_id and block.id<>new.id
      and block.is_active and block.blocked and (block.expires_at is null or block.expires_at>clock_timestamp())
      and daterange(block.from_date,block.to_date,'[]') && daterange(new.from_date,new.to_date,'[]')) then
    raise exception using errcode='23514',message='hotels_v2_admin_d_overlapping_unit_block'; end if;
  if new.is_active and new.blocked and exists(
    select 1 from public.hotel_inventory_commitments commitment
    left join public.hotel_inventory_holds hold_row on hold_row.id=commitment.hold_id
    where commitment.unit_id=new.unit_id and commitment.status='active'
      and commitment.stay_date between new.from_date and new.to_date
      and (commitment.booking_allocation_id is not null or
        (hold_row.status='active' and hold_row.expires_at>clock_timestamp()))) then
    raise exception using errcode='PT409',message='hotels_v2_admin_d_unit_already_committed'; end if;
  return new;
end
$function$;
create trigger hotel_unit_calendar_blocks_admin_d_guard
before insert or update on public.hotel_unit_calendar_blocks for each row
execute function public.hotel_v2_admin_d_validate_unit_block();

create function public.hotel_v2_admin_d_validate_allocation()
returns trigger language plpgsql security definer set search_path=pg_catalog,public
as $function$
declare v_booking public.hotel_bookings%rowtype; v_mode text; v_capacity integer;
begin
  if tg_op='UPDATE' and (new.id,new.booking_id,new.hotel_id,new.room_type_id,new.rate_plan_id,
      new.room_rate_id,new.unit_ids,new.units_required,new.allocated_guest_counts,new.pricing_guest_counts,
      new.booking_updated_at,new.actor_id,new.correlation_id,new.created_at)
     is distinct from (old.id,old.booking_id,old.hotel_id,old.room_type_id,old.rate_plan_id,
      old.room_rate_id,old.unit_ids,old.units_required,old.allocated_guest_counts,old.pricing_guest_counts,
      old.booking_updated_at,old.actor_id,old.correlation_id,old.created_at) then
    raise exception using errcode='55000',message='hotels_v2_admin_d_allocation_identity_immutable'; end if;
  if tg_op='UPDATE' and not (old.status='active' and new.status='released'
      and new.released_at is not null and public.hotel_v2_admin_d_reason_is_valid(to_jsonb(new.release_reason))
      and new.version=old.version+1 and new.updated_at>old.updated_at) then
    raise exception using errcode='55000',message='hotels_v2_admin_d_invalid_allocation_transition'; end if;
  if tg_op='UPDATE' and exists(select 1 from public.hotel_inventory_commitments commitment
      where commitment.booking_allocation_id=old.id and commitment.status='active') then
    raise exception using errcode='55000',message='hotels_v2_admin_d_allocation_has_active_commitments'; end if;
  if tg_op='UPDATE' then return new; end if;
  select * into v_booking from public.hotel_bookings where id=new.booking_id;
  if not found or v_booking.hotel_id is distinct from new.hotel_id
     or (tg_op='INSERT' and (v_booking.updated_at is distinct from new.booking_updated_at
       or v_booking.status not in('pending','confirmed')))
     or v_booking.departure_date<=v_booking.arrival_date then
    raise exception using errcode='23514',message='hotels_v2_admin_d_booking_mapping_required'; end if;
  select inventory_mode,coalesce(max_occupancy,capacity_adults+capacity_children) into v_mode,v_capacity from public.hotel_room_types
    where id=new.room_type_id and hotel_id=new.hotel_id and status='active';
  if v_mode is null or (v_mode='pooled' and cardinality(new.unit_ids)<>0)
     or (v_mode='unitized' and cardinality(new.unit_ids)<>new.units_required) then
    raise exception using errcode='23514',message='hotels_v2_admin_d_invalid_allocation_inventory_mode'; end if;
  if new.units_required<1 or cardinality(new.allocated_guest_counts)<>new.units_required
     or cardinality(new.pricing_guest_counts)<>new.units_required
     or exists(select 1 from unnest(new.allocated_guest_counts) guest_count
       where guest_count<1 or v_capacity is null or guest_count>v_capacity)
     or exists(select 1 from unnest(new.pricing_guest_counts) guest_count
       where guest_count<1 or v_capacity is null or guest_count>v_capacity) then
    raise exception using errcode='23514',message='hotels_v2_admin_d_allocation_capacity_invalid'; end if;
  if cardinality(new.unit_ids)>0 and exists(select 1
    from unnest(new.unit_ids) as requested_unit(unit_id)
    left join public.hotel_units unit on unit.id=requested_unit.unit_id
      and unit.room_type_id=new.room_type_id and unit.status='active'
    where unit.id is null) then raise exception using errcode='23503',message='hotels_v2_admin_d_foreign_unit'; end if;
  if cardinality(new.unit_ids)<>(select count(distinct requested_unit.unit_id)
      from unnest(new.unit_ids) as requested_unit(unit_id)) then
    raise exception using errcode='23514',message='hotels_v2_admin_d_duplicate_unit_id'; end if;
  return new;
end
$function$;
create trigger hotel_booking_room_allocations_admin_d_guard
before insert or update on public.hotel_booking_room_allocations for each row
execute function public.hotel_v2_admin_d_validate_allocation();

create function public.hotel_v2_admin_d_validate_commitment()
returns trigger language plpgsql security definer set search_path=pg_catalog,public
as $function$
declare v_allocation public.hotel_booking_room_allocations%rowtype; v_hold public.hotel_inventory_holds%rowtype;
  v_mode text; v_physical integer; v_blocked integer; v_configured integer; v_committed integer;
begin
  if tg_op='UPDATE' and (new.id,new.hotel_id,new.room_type_id,new.stay_date,new.hold_id,
      new.booking_allocation_id,new.unit_id,new.units,new.expires_at,new.created_at)
     is distinct from (old.id,old.hotel_id,old.room_type_id,old.stay_date,old.hold_id,
      old.booking_allocation_id,old.unit_id,old.units,old.expires_at,old.created_at) then
    raise exception using errcode='55000',message='hotels_v2_admin_d_commitment_identity_immutable'; end if;
  if tg_op='UPDATE' and not (old.status='active' and new.status in('released','expired')
      and new.version=old.version+1 and new.updated_at>old.updated_at) then
    raise exception using errcode='55000',message='hotels_v2_admin_d_invalid_commitment_transition'; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.room_type_id::text||':'||new.stay_date::text,0));
  if tg_op='UPDATE' then return new; end if;
  if new.booking_allocation_id is not null then
    select * into v_allocation from public.hotel_booking_room_allocations where id=new.booking_allocation_id;
    if not found or v_allocation.hotel_id<>new.hotel_id or v_allocation.room_type_id<>new.room_type_id
       or v_allocation.status<>'active' or new.expires_at is not null
       or (new.unit_id is not null and not new.unit_id=any(v_allocation.unit_ids)) then
      raise exception using errcode='23514',message='hotels_v2_admin_d_invalid_booking_commitment'; end if;
    if not exists(select 1 from public.hotel_bookings booking where booking.id=v_allocation.booking_id
      and new.stay_date>=booking.arrival_date and new.stay_date<booking.departure_date) then
      raise exception using errcode='23514',message='hotels_v2_admin_d_commitment_outside_booking_stay'; end if;
    if (cardinality(v_allocation.unit_ids)=0 and (new.unit_id is not null or new.units<>v_allocation.units_required))
       or (cardinality(v_allocation.unit_ids)>0 and (new.unit_id is null or new.units<>1)) then
      raise exception using errcode='23514',message='hotels_v2_admin_d_invalid_commitment_inventory_mode'; end if;
  else
    select * into v_hold from public.hotel_inventory_holds where id=new.hold_id;
    if not found or v_hold.hotel_id<>new.hotel_id or v_hold.status<>'active'
       or v_hold.expires_at<=clock_timestamp() or new.expires_at is distinct from v_hold.expires_at then
      raise exception using errcode='23514',message='hotels_v2_admin_d_invalid_hold_commitment'; end if;
  end if;
  if new.unit_id is not null and not exists(select 1 from public.hotel_units where id=new.unit_id and room_type_id=new.room_type_id and status='active') then
    raise exception using errcode='23503',message='hotels_v2_admin_d_foreign_unit'; end if;
  if new.status='active' and new.unit_id is not null and exists(
    select 1 from public.hotel_unit_calendar_blocks block where block.unit_id=new.unit_id
      and block.is_active and block.blocked and (block.expires_at is null or block.expires_at>clock_timestamp())
      and new.stay_date between block.from_date and block.to_date) then
    raise exception using errcode='PT409',message='hotels_v2_admin_d_unit_blocked'; end if;
  if new.status='active' and new.unit_id is not null and exists(
    select 1 from public.hotel_inventory_commitments other
    left join public.hotel_inventory_holds other_hold on other_hold.id=other.hold_id
    where other.id<>new.id and other.unit_id=new.unit_id and other.stay_date=new.stay_date and other.status='active'
      and (other.booking_allocation_id is not null or (other_hold.status='active' and other_hold.expires_at>clock_timestamp()))) then
    raise exception using errcode='PT409',message='hotels_v2_admin_d_unit_already_committed'; end if;
  if new.status='active' then
    select inventory_mode,case when inventory_mode='unitized' then
      (select count(*) from public.hotel_units where room_type_id=new.room_type_id and status='active')
      else base_inventory_count end into v_mode,v_physical
    from public.hotel_room_types where id=new.room_type_id and hotel_id=new.hotel_id and status='active';
    if v_physical is null then raise exception using errcode='23514',message='hotels_v2_admin_d_inactive_room'; end if;
    if (v_mode='pooled' and new.unit_id is not null) or (v_mode='unitized' and new.unit_id is null) then
      raise exception using errcode='23514',message='hotels_v2_admin_d_invalid_commitment_inventory_mode'; end if;
    select coalesce(count(distinct block.unit_id),0)::integer into v_blocked
    from public.hotel_unit_calendar_blocks block join public.hotel_units unit on unit.id=block.unit_id and unit.status='active'
    where block.room_type_id=new.room_type_id and block.is_active and block.blocked
      and (block.expires_at is null or block.expires_at>clock_timestamp()) and new.stay_date between block.from_date and block.to_date;
    select case when inventory.sellable_units_mode='set' and (inventory.expires_at is null or inventory.expires_at>clock_timestamp())
      then inventory.sellable_units else v_physical end into v_configured from public.hotel_daily_inventory inventory
      where inventory.room_type_id=new.room_type_id and inventory.stay_date=new.stay_date;
    v_configured:=coalesce(v_configured,v_physical);
    select coalesce(sum(commitment.units),0)::integer into v_committed
    from public.hotel_inventory_commitments commitment
    left join public.hotel_inventory_holds hold_row on hold_row.id=commitment.hold_id
    left join public.hotel_booking_room_allocations allocation on allocation.id=commitment.booking_allocation_id
    left join public.hotel_bookings booking on booking.id=allocation.booking_id
    where commitment.room_type_id=new.room_type_id and commitment.stay_date=new.stay_date
      and commitment.status='active' and commitment.id<>new.id
      and ((commitment.hold_id is not null and hold_row.status='active' and hold_row.expires_at>clock_timestamp())
        or (commitment.booking_allocation_id is not null and allocation.status='active' and booking.status in('pending','confirmed')));
    if least(v_physical-case when v_mode='unitized' then v_blocked else 0 end,v_configured)<v_committed+new.units then
      raise exception using errcode='PT409',message='hotels_v2_admin_d_capacity_below_commitments'; end if;
  end if;
  return new;
end
$function$;
create trigger hotel_inventory_commitments_admin_d_guard
before insert or update on public.hotel_inventory_commitments for each row
execute function public.hotel_v2_admin_d_validate_commitment();

create function public.hotel_v2_admin_d_validate_allocation_topology()
returns trigger language plpgsql security definer set search_path=pg_catalog,public
as $function$
declare v_allocation_id uuid; v_allocation public.hotel_booking_room_allocations%rowtype;
  v_booking public.hotel_bookings%rowtype; v_expected_count bigint; v_actual_count bigint; v_party_total integer;
begin
  if tg_table_name='hotel_booking_room_allocations' then
    v_allocation_id:=new.id;
  elsif tg_table_name='hotel_inventory_commitments' then
    v_allocation_id:=new.booking_allocation_id;
  else
    raise exception using errcode='55000',
      message='hotels_v2_admin_d_allocation_topology_trigger_relation_invalid';
  end if;
  if v_allocation_id is null then return null; end if;
  select * into v_allocation from public.hotel_booking_room_allocations where id=v_allocation_id;
  if not found then return null; end if;
  if v_allocation.status<>'active' then
    if exists(select 1 from public.hotel_inventory_commitments commitment
        where commitment.booking_allocation_id=v_allocation.id and commitment.status='active') then
      raise exception using errcode='23514',message='hotels_v2_admin_d_released_allocation_has_active_commitment'; end if;
    return null;
  end if;
  select * into v_booking from public.hotel_bookings where id=v_allocation.booking_id;
  if not found or v_booking.updated_at is distinct from v_allocation.booking_updated_at then
    raise exception using errcode='23514',message='hotels_v2_admin_d_allocation_topology_stale_booking'; end if;
  select case when cardinality(v_allocation.unit_ids)=0
      then (v_booking.departure_date-v_booking.arrival_date)::bigint
      else (v_booking.departure_date-v_booking.arrival_date)::bigint*cardinality(v_allocation.unit_ids) end,
    (select count(*) from public.hotel_inventory_commitments commitment
      where commitment.booking_allocation_id=v_allocation.id and commitment.status='active')
    into v_expected_count,v_actual_count;
  if v_expected_count<>v_actual_count or exists(
    (select v_allocation.room_type_id,day_value::date,null::uuid,v_allocation.units_required
       from generate_series(v_booking.arrival_date,v_booking.departure_date-1,interval '1 day') day_value
       where cardinality(v_allocation.unit_ids)=0
     union all
     select v_allocation.room_type_id,day_value::date,unit_id,1
       from generate_series(v_booking.arrival_date,v_booking.departure_date-1,interval '1 day') day_value
       cross join unnest(v_allocation.unit_ids) unit_id
       where cardinality(v_allocation.unit_ids)>0)
    except
    select commitment.room_type_id,commitment.stay_date,commitment.unit_id,commitment.units
      from public.hotel_inventory_commitments commitment
      where commitment.booking_allocation_id=v_allocation.id and commitment.status='active') then
    raise exception using errcode='23514',message='hotels_v2_admin_d_allocation_commitment_topology_invalid'; end if;
  select coalesce(sum(guest_count),0)::integer into v_party_total
  from public.hotel_booking_room_allocations allocation
  cross join unnest(allocation.allocated_guest_counts) guest_count
  where allocation.booking_id=v_booking.id and allocation.status='active';
  if v_party_total<>coalesce(v_booking.num_adults,1)+coalesce(v_booking.num_children,0)
     or exists(select 1 from public.hotel_booking_room_allocations allocation
       where allocation.booking_id=v_booking.id and allocation.status='active'
         and allocation.booking_updated_at is distinct from v_booking.updated_at) then
    raise exception using errcode='23514',message='hotels_v2_admin_d_booking_allocation_set_invalid'; end if;
  return null;
end
$function$;
create constraint trigger hotel_booking_room_allocations_admin_d_topology
after insert or update on public.hotel_booking_room_allocations deferrable initially deferred
for each row execute function public.hotel_v2_admin_d_validate_allocation_topology();
create constraint trigger hotel_inventory_commitments_admin_d_allocation_topology
after insert or update on public.hotel_inventory_commitments deferrable initially deferred
for each row execute function public.hotel_v2_admin_d_validate_allocation_topology();

create function public.hotel_v2_admin_d_validate_hold_topology()
returns trigger language plpgsql security definer set search_path=pg_catalog,public
as $function$
declare v_hold_id uuid; v_status text;
begin
  if tg_table_name='hotel_inventory_holds' then
    if tg_op='DELETE' then
      v_hold_id:=old.id;
    else
      v_hold_id:=new.id;
    end if;
  elsif tg_table_name='hotel_inventory_commitments' then
    if tg_op='DELETE' then
      v_hold_id:=old.hold_id;
    else
      v_hold_id:=new.hold_id;
    end if;
  else
    raise exception using errcode='55000',
      message='hotels_v2_admin_d_hold_topology_trigger_relation_invalid';
  end if;
  if v_hold_id is null then return null; end if;
  select status into v_status from public.hotel_inventory_holds where id=v_hold_id;
  if v_status is null then return null; end if;
  if v_status<>'active' and exists(select 1 from public.hotel_inventory_commitments commitment
      where commitment.hold_id=v_hold_id and commitment.status='active') then
    raise exception using errcode='23514',message='hotels_v2_admin_d_inactive_hold_has_active_commitment'; end if;
  if v_status='active' and not exists(select 1 from public.hotel_inventory_commitments commitment
      where commitment.hold_id=v_hold_id and commitment.status='active') then
    raise exception using errcode='23514',message='hotels_v2_admin_d_active_hold_requires_commitment'; end if;
  return null;
end
$function$;
create constraint trigger hotel_inventory_holds_admin_d_topology
after insert or update on public.hotel_inventory_holds deferrable initially deferred
for each row execute function public.hotel_v2_admin_d_validate_hold_topology();
create constraint trigger hotel_inventory_commitments_admin_d_hold_topology
after insert or update on public.hotel_inventory_commitments deferrable initially deferred
for each row execute function public.hotel_v2_admin_d_validate_hold_topology();

create function public.hotel_v2_admin_d_validate_hold_update()
returns trigger language plpgsql set search_path=pg_catalog
as $function$
begin
  if (new.id,new.hotel_id,new.expires_at,new.configuration_fingerprint,new.created_at)
     is distinct from (old.id,old.hotel_id,old.expires_at,old.configuration_fingerprint,old.created_at)
     or old.status<>'active' or new.status not in('released','expired','consumed')
     or new.version<>old.version+1 or new.updated_at<=old.updated_at then
    raise exception using errcode='55000',message='hotels_v2_admin_d_invalid_hold_transition'; end if;
  if new.status='released' and (new.released_at is null
      or not public.hotel_v2_admin_d_reason_is_valid(to_jsonb(new.release_reason))) then
    raise exception using errcode='55000',message='hotels_v2_admin_d_invalid_hold_release'; end if;
  if exists(select 1 from public.hotel_inventory_commitments commitment
      where commitment.hold_id=old.id and commitment.status='active') then
    raise exception using errcode='55000',message='hotels_v2_admin_d_hold_has_active_commitments'; end if;
  return new;
end
$function$;
create trigger hotel_inventory_holds_admin_d_guard before update on public.hotel_inventory_holds
for each row execute function public.hotel_v2_admin_d_validate_hold_update();

-- Cross-domain writers may change physical Room/Unit capacity, but they must
-- serialize with dated commitments and may never strand an accepted mapping.
create function public.hotel_v2_admin_d_validate_room_availability_change()
returns trigger language plpgsql security definer set search_path=pg_catalog,public
as $function$
declare v_day date; v_committed integer; v_blocked integer; v_configured integer; v_physical integer;
begin
  if tg_op='DELETE' and exists(select 1 from public.hotel_unit_calendar_blocks block
    where block.room_type_id=old.id and block.is_active and block.blocked
      and (block.expires_at is null or block.expires_at>clock_timestamp())) then
    raise exception using errcode='PT409',message='hotels_v2_admin_d_room_has_active_unit_blocks'; end if;
  if tg_op='UPDATE' and (new.inventory_mode is distinct from old.inventory_mode
      or (old.status='active' and new.status<>'active')) and exists(
    select 1 from public.hotel_unit_calendar_blocks block where block.room_type_id=old.id
      and block.is_active and block.blocked and (block.expires_at is null or block.expires_at>clock_timestamp())) then
    raise exception using errcode='PT409',message='hotels_v2_admin_d_room_has_active_unit_blocks'; end if;
  if tg_op='UPDATE' and new.inventory_mode is distinct from old.inventory_mode and exists(
    select 1 from public.hotel_inventory_commitments commitment
    left join public.hotel_inventory_holds hold_row on hold_row.id=commitment.hold_id
    left join public.hotel_booking_room_allocations allocation on allocation.id=commitment.booking_allocation_id
    where commitment.room_type_id=old.id and commitment.status='active'
      and ((commitment.hold_id is not null and hold_row.status='active')
        or (commitment.booking_allocation_id is not null and allocation.status='active'))) then
    raise exception using errcode='PT409',message='hotels_v2_admin_d_room_inventory_mode_has_active_commitments'; end if;
  if tg_op='DELETE' or new.status is distinct from old.status
     or new.inventory_mode is distinct from old.inventory_mode
     or new.base_inventory_count is distinct from old.base_inventory_count then
    for v_day in select distinct commitment.stay_date from public.hotel_inventory_commitments commitment
      left join public.hotel_inventory_holds hold_row on hold_row.id=commitment.hold_id
      left join public.hotel_booking_room_allocations allocation on allocation.id=commitment.booking_allocation_id
      left join public.hotel_bookings booking on booking.id=allocation.booking_id
      where commitment.room_type_id=old.id and commitment.status='active'
        and ((commitment.hold_id is not null and hold_row.status='active' and hold_row.expires_at>clock_timestamp())
          or (commitment.booking_allocation_id is not null and allocation.status='active' and booking.status in('pending','confirmed')))
      order by commitment.stay_date loop
      perform pg_advisory_xact_lock(hashtextextended(old.id::text||':'||v_day::text,0));
      if tg_op='DELETE' or new.status<>'active' then
        raise exception using errcode='PT409',message='hotels_v2_admin_d_room_has_active_commitments';
      end if;
      v_physical:=case when new.inventory_mode='unitized' then
        (select count(*) from public.hotel_units where room_type_id=old.id and status='active')
        else new.base_inventory_count end;
      select coalesce(sum(commitment.units),0)::integer into v_committed
      from public.hotel_inventory_commitments commitment
      left join public.hotel_inventory_holds hold_row on hold_row.id=commitment.hold_id
      left join public.hotel_booking_room_allocations allocation on allocation.id=commitment.booking_allocation_id
      left join public.hotel_bookings booking on booking.id=allocation.booking_id
      where commitment.room_type_id=old.id and commitment.stay_date=v_day and commitment.status='active'
        and ((commitment.hold_id is not null and hold_row.status='active' and hold_row.expires_at>clock_timestamp())
          or (commitment.booking_allocation_id is not null and allocation.status='active' and booking.status in('pending','confirmed')));
      select coalesce(count(distinct block.unit_id),0)::integer into v_blocked
      from public.hotel_unit_calendar_blocks block where block.room_type_id=old.id
        and block.is_active and block.blocked and (block.expires_at is null or block.expires_at>clock_timestamp())
        and v_day between block.from_date and block.to_date;
      select case when inventory.sellable_units_mode='set'
          and (inventory.expires_at is null or inventory.expires_at>clock_timestamp())
        then inventory.sellable_units else v_physical end into v_configured
      from public.hotel_daily_inventory inventory where inventory.room_type_id=old.id and inventory.stay_date=v_day;
      v_configured:=coalesce(v_configured,v_physical);
      if least(v_physical-case when new.inventory_mode='unitized' then v_blocked else 0 end,v_configured)<v_committed then
        raise exception using errcode='PT409',message='hotels_v2_admin_d_capacity_below_commitments'; end if;
    end loop;
  end if;
  return case when tg_op='DELETE' then old else new end;
end
$function$;
create trigger hotel_room_types_admin_d_capacity_guard
before update or delete on public.hotel_room_types for each row
execute function public.hotel_v2_admin_d_validate_room_availability_change();

create function public.hotel_v2_admin_d_validate_unit_availability_change()
returns trigger language plpgsql security definer set search_path=pg_catalog,public
as $function$
declare v_day date; v_remaining integer; v_committed integer; v_blocked integer; v_configured integer; v_mode text;
begin
  if (tg_op='DELETE' or new.room_type_id is distinct from old.room_type_id) and (
      exists(select 1 from public.hotel_booking_room_allocations allocation where old.id=any(allocation.unit_ids))
      or exists(select 1 from public.hotel_inventory_commitments commitment where commitment.unit_id=old.id)
      or exists(select 1 from public.hotel_unit_calendar_blocks block where block.unit_id=old.id)) then
    raise exception using errcode='55000',message='hotels_v2_admin_d_unit_historical_ownership_immutable'; end if;
  if (tg_op='DELETE' or new.status is distinct from old.status or new.room_type_id is distinct from old.room_type_id)
     and old.status='active' then
    for v_day in select distinct day_value::date from public.hotel_unit_calendar_blocks block
      cross join generate_series(block.from_date,block.to_date,interval '1 day') day_value
      where block.unit_id=old.id and block.is_active and block.blocked
        and (block.expires_at is null or block.expires_at>clock_timestamp()) order by day_value::date loop
      perform pg_advisory_xact_lock(hashtextextended(old.room_type_id::text||':'||v_day::text,0));
      raise exception using errcode='PT409',message='hotels_v2_admin_d_unit_has_active_block';
    end loop;
    if exists(select 1 from public.hotel_inventory_commitments commitment
      left join public.hotel_inventory_holds hold_row on hold_row.id=commitment.hold_id
      left join public.hotel_booking_room_allocations allocation on allocation.id=commitment.booking_allocation_id
      where commitment.unit_id=old.id and commitment.status='active'
        and ((commitment.hold_id is not null and hold_row.status='active')
          or (commitment.booking_allocation_id is not null and allocation.status='active'))) then
      raise exception using errcode='PT409',message='hotels_v2_admin_d_unit_has_active_commitment'; end if;
    select inventory_mode into v_mode from public.hotel_room_types where id=old.room_type_id;
    if v_mode='pooled' then return case when tg_op='DELETE' then old else new end; end if;
    for v_day in select distinct commitment.stay_date from public.hotel_inventory_commitments commitment
      left join public.hotel_inventory_holds hold_row on hold_row.id=commitment.hold_id
      left join public.hotel_booking_room_allocations allocation on allocation.id=commitment.booking_allocation_id
      left join public.hotel_bookings booking on booking.id=allocation.booking_id
      where commitment.room_type_id=old.room_type_id and commitment.status='active'
        and ((commitment.hold_id is not null and hold_row.status='active' and hold_row.expires_at>clock_timestamp())
          or (commitment.booking_allocation_id is not null and allocation.status='active' and booking.status in('pending','confirmed')))
      order by commitment.stay_date loop
      perform pg_advisory_xact_lock(hashtextextended(old.room_type_id::text||':'||v_day::text,0));
      if exists(select 1 from public.hotel_inventory_commitments commitment
        left join public.hotel_inventory_holds hold_row on hold_row.id=commitment.hold_id
        left join public.hotel_booking_room_allocations allocation on allocation.id=commitment.booking_allocation_id
        left join public.hotel_bookings booking on booking.id=allocation.booking_id
        where commitment.unit_id=old.id and commitment.stay_date=v_day and commitment.status='active'
          and ((commitment.hold_id is not null and hold_row.status='active' and hold_row.expires_at>clock_timestamp())
            or (commitment.booking_allocation_id is not null and allocation.status='active' and booking.status in('pending','confirmed')))) then
        raise exception using errcode='PT409',message='hotels_v2_admin_d_unit_has_active_commitment'; end if;
      select count(*)-1 into v_remaining from public.hotel_units
        where room_type_id=old.room_type_id and status='active';
      select coalesce(sum(commitment.units),0)::integer into v_committed
      from public.hotel_inventory_commitments commitment
      left join public.hotel_inventory_holds hold_row on hold_row.id=commitment.hold_id
      left join public.hotel_booking_room_allocations allocation on allocation.id=commitment.booking_allocation_id
      left join public.hotel_bookings booking on booking.id=allocation.booking_id
      where commitment.room_type_id=old.room_type_id and commitment.stay_date=v_day and commitment.status='active'
        and ((commitment.hold_id is not null and hold_row.status='active' and hold_row.expires_at>clock_timestamp())
          or (commitment.booking_allocation_id is not null and allocation.status='active' and booking.status in('pending','confirmed')));
      select coalesce(count(distinct block.unit_id),0)::integer into v_blocked
      from public.hotel_unit_calendar_blocks block where block.room_type_id=old.room_type_id and block.unit_id<>old.id
        and block.is_active and block.blocked and (block.expires_at is null or block.expires_at>clock_timestamp())
        and v_day between block.from_date and block.to_date;
      select case when inventory.sellable_units_mode='set'
          and (inventory.expires_at is null or inventory.expires_at>clock_timestamp())
        then inventory.sellable_units else v_remaining end into v_configured
      from public.hotel_daily_inventory inventory where inventory.room_type_id=old.room_type_id and inventory.stay_date=v_day;
      v_configured:=coalesce(v_configured,v_remaining);
      if least(v_remaining-v_blocked,v_configured)<v_committed then
        raise exception using errcode='PT409',message='hotels_v2_admin_d_capacity_below_commitments'; end if;
    end loop;
  end if;
  return case when tg_op='DELETE' then old else new end;
end
$function$;
create trigger hotel_units_admin_d_capacity_guard
before update or delete on public.hotel_units for each row
execute function public.hotel_v2_admin_d_validate_unit_availability_change();

create function public.hotel_v2_admin_d_snapshot(
  p_hotel_id uuid,p_from date,p_to date,p_require_admin boolean default true
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
declare
  v_as_of timestamptz:=statement_timestamp();
  v_token text; v_result jsonb; v_valid_until timestamptz;
begin
  if p_require_admin then perform public.hotel_v2_h2a_require_admin(); end if;
  if p_hotel_id is null or p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then
    raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_availability_query';
  end if;
  if not exists(select 1 from public.hotels where id=p_hotel_id) then
    raise exception using errcode='PT404',message='hotels_v2_admin_d_property_not_found';
  end if;
  if (select count(*) from public.site_settings)<>1 or not exists(select 1 from public.site_settings
      where id=1 and not hotel_rooms_v2_enabled and not hotel_external_sync_enabled
        and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled)
     or (p_hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' and not exists(
       select 1 from public.hotels where id=p_hotel_id and architecture_version='legacy')) then
    raise exception using errcode='55000',message='hotels_v2_admin_d_public_activation_guard';
  end if;
  if (select count(*) from public.hotel_room_types where hotel_id=p_hotel_id)>1000
     or (select count(*) from public.hotel_room_rates where hotel_id=p_hotel_id)>5000
     or (select count(*) from public.hotel_units unit join public.hotel_room_types room
       on room.id=unit.room_type_id where room.hotel_id=p_hotel_id)>100000
     or (select count(*)*(p_to-p_from+1) from public.hotel_room_types where hotel_id=p_hotel_id)>62000
     or (select count(*)*(p_to-p_from+1) from public.hotel_room_rates where hotel_id=p_hotel_id)>310000
     or (select count(*) from public.hotel_daily_inventory inventory join public.hotel_room_types room
       on room.id=inventory.room_type_id where room.hotel_id=p_hotel_id and inventory.stay_date between p_from and p_to)>62000
     or (select count(*) from public.hotel_unit_calendar_blocks block where block.hotel_id=p_hotel_id
       and block.from_date<=p_to and block.to_date>=p_from)>62000
     or (select count(*) from public.hotel_calendar_overrides exact where exact.hotel_id=p_hotel_id
       and exact.stay_date between p_from and p_to)>310000
     or (select count(*) from public.hotel_rate_rules rule join public.hotel_room_rates rate
       on rate.id=rule.room_rate_id where rate.hotel_id=p_hotel_id
         and rule.valid_from<=p_to and rule.valid_to>=p_from)>310000
     or (select count(*) from public.hotel_booking_room_allocations allocation
       join public.hotel_bookings booking on booking.id=allocation.booking_id where allocation.hotel_id=p_hotel_id
         and (booking.arrival_date<=p_to and booking.departure_date>p_from or exists(
           select 1 from public.hotel_inventory_commitments commitment
           where commitment.booking_allocation_id=allocation.id and commitment.status='active'
             and commitment.stay_date between p_from and p_to)))>10000
     or (select count(*) from public.hotel_bookings booking where booking.hotel_id=p_hotel_id
       and booking.status in('pending','confirmed') and booking.arrival_date<=p_to and booking.departure_date>p_from
       and not exists(select 1 from public.hotel_booking_room_allocations allocation
         where allocation.booking_id=booking.id and allocation.status='active'
           and allocation.booking_updated_at=booking.updated_at))>10000
     or (select count(*) from public.hotel_inventory_holds hold_row where hold_row.hotel_id=p_hotel_id
       and exists(select 1 from public.hotel_inventory_commitments commitment where commitment.hold_id=hold_row.id
         and commitment.stay_date between p_from and p_to))>10000 then
    raise exception using errcode='54000',message='hotels_v2_admin_d_snapshot_technical_limit_exceeded';
  end if;

  select min(expiry) into v_valid_until from(
    select expires_at expiry from public.hotel_daily_inventory inventory
      join public.hotel_room_types room on room.id=inventory.room_type_id
      where room.hotel_id=p_hotel_id and inventory.stay_date between p_from and p_to and expires_at>v_as_of
    union all select expires_at from public.hotel_unit_calendar_blocks
      where hotel_id=p_hotel_id and is_active and expires_at>v_as_of and from_date<=p_to and to_date>=p_from
    union all select expires_at from public.hotel_inventory_holds
      where hotel_id=p_hotel_id and status='active' and expires_at>v_as_of
        and exists(select 1 from public.hotel_inventory_commitments commitment
          where commitment.hold_id=hotel_inventory_holds.id and commitment.stay_date between p_from and p_to)
    union all select case when availability_updated_at is null then
        case when closed_mode is not null or closed_to_arrival_mode is not null or closed_to_departure_mode is not null then expires_at end
      else availability_expires_at end
      from public.hotel_calendar_overrides where hotel_id=p_hotel_id and stay_date between p_from and p_to
      and case when availability_updated_at is null then
        (closed_mode is not null or closed_to_arrival_mode is not null or closed_to_departure_mode is not null)
          and is_active and expires_at>v_as_of
        else availability_active and availability_expires_at>v_as_of end
  ) expiry_rows;

  select public.hotel_v2_admin_d_hash(jsonb_build_object(
    'hotel',p_hotel_id,'from',p_from,'to',p_to,
    'property',(select jsonb_build_object('architecture_version',architecture_version,'booking_mode',booking_mode,
      'minimum_stay_nights',minimum_stay_nights,'currency',currency,'timezone',timezone) from public.hotels where id=p_hotel_id),
    'operational_profile',(select jsonb_build_object('maximum_stay_nights',maximum_stay_nights) from public.hotel_property_operational_profiles where hotel_id=p_hotel_id),
    'rooms',coalesce((select jsonb_agg(jsonb_build_array(id,status,inventory_mode,base_inventory_count,
      max_occupancy,capacity_adults,capacity_children) order by id) from public.hotel_room_types where hotel_id=p_hotel_id),'[]'),
    'units',coalesce((select jsonb_agg(jsonb_build_array(unit.id,unit.room_type_id,unit.status) order by unit.id) from public.hotel_units unit join public.hotel_room_types room on room.id=unit.room_type_id where room.hotel_id=p_hotel_id),'[]'),
    'inventory',coalesce((select jsonb_agg(jsonb_build_array(inventory.room_type_id,inventory.stay_date,
      inventory.sellable_units,inventory.sellable_units_mode,inventory.closed,inventory.closed_mode,
      inventory.reason,inventory.expires_at,inventory.version) order by inventory.room_type_id,inventory.stay_date)
      from public.hotel_daily_inventory inventory join public.hotel_room_types room on room.id=inventory.room_type_id
      where room.hotel_id=p_hotel_id and inventory.stay_date between p_from and p_to),'[]'),
    'unit_blocks',coalesce((select jsonb_agg(jsonb_build_array(id,version,is_active,expires_at is null or expires_at>v_as_of) order by id) from public.hotel_unit_calendar_blocks where hotel_id=p_hotel_id and from_date<=p_to and to_date>=p_from),'[]'),
    'overrides',coalesce((select jsonb_agg(jsonb_build_array(id,room_rate_id,stay_date,availability_version,
      case when availability_updated_at is null then
        (closed_mode is not null or closed_to_arrival_mode is not null or closed_to_departure_mode is not null) and is_active
        else availability_active end,
      case when availability_updated_at is null then
        case when closed_mode is not null or closed_to_arrival_mode is not null or closed_to_departure_mode is not null then expires_at end
        else availability_expires_at end,
      closed,closed_mode,closed_to_arrival,closed_to_arrival_mode,closed_to_departure,closed_to_departure_mode)
      order by id) from public.hotel_calendar_overrides where hotel_id=p_hotel_id and stay_date between p_from and p_to),'[]'),
    'room_rates',coalesce((select jsonb_agg(jsonb_build_array(id,room_type_id,rate_plan_id,is_active,review_status) order by id) from public.hotel_room_rates where hotel_id=p_hotel_id),'[]'),
    'daily_rates',coalesce((select jsonb_agg(jsonb_build_array(dr.room_rate_id,dr.stay_date,dr.closed) order by dr.room_rate_id,dr.stay_date) from public.hotel_daily_rates dr join public.hotel_room_rates rate on rate.id=dr.room_rate_id where rate.hotel_id=p_hotel_id and dr.stay_date between p_from and p_to),'[]'),
    'rules',coalesce((select jsonb_agg(jsonb_build_array(rule.id,rule.availability_version,
      rule.valid_from,rule.valid_to,rule.weekdays,rule.priority,rule.is_active,
      rule.closed_to_arrival,rule.closed_to_departure) order by rule.id)
      from public.hotel_rate_rules rule join public.hotel_room_rates rate on rate.id=rule.room_rate_id
      where rate.hotel_id=p_hotel_id and rule.valid_from<=p_to and rule.valid_to>=p_from),'[]'),
    'bookings',coalesce((select jsonb_agg(jsonb_build_array(booking.id,booking.status,booking.updated_at,
      booking.arrival_date,booking.departure_date,booking.num_adults,booking.num_children) order by booking.id)
      from public.hotel_bookings booking where booking.hotel_id=p_hotel_id and
        (booking.arrival_date<=p_to and booking.departure_date>p_from or exists(
          select 1 from public.hotel_booking_room_allocations allocation
          join public.hotel_inventory_commitments commitment on commitment.booking_allocation_id=allocation.id
          where allocation.booking_id=booking.id and allocation.status='active' and commitment.status='active'
            and commitment.stay_date between p_from and p_to))),'[]'),
    'allocations',coalesce((select jsonb_agg(jsonb_build_object('id',allocation.id,'booking_id',allocation.booking_id,
      'version',allocation.version,'status',allocation.status,'booking_status',booking.status,
      'booking_updated_at',allocation.booking_updated_at,'current_booking_updated_at',booking.updated_at,
      'arrival_date',booking.arrival_date,'departure_date',booking.departure_date,
      'room_type_id',allocation.room_type_id,'rate_plan_id',allocation.rate_plan_id,'room_rate_id',allocation.room_rate_id,
      'unit_ids',allocation.unit_ids,'units_required',allocation.units_required,
      'allocated_guest_counts',allocation.allocated_guest_counts,'pricing_guest_counts',allocation.pricing_guest_counts,
      'commitments',coalesce((select jsonb_agg(jsonb_build_array(commitment.room_type_id,commitment.stay_date,
        commitment.unit_id,commitment.units,commitment.status) order by commitment.room_type_id,commitment.stay_date,
        commitment.unit_id nulls first,commitment.units) from public.hotel_inventory_commitments commitment
        where commitment.booking_allocation_id=allocation.id and commitment.status='active'),'[]'::jsonb)) order by allocation.id)
      from public.hotel_booking_room_allocations allocation join public.hotel_bookings booking on booking.id=allocation.booking_id
      where allocation.hotel_id=p_hotel_id and (booking.arrival_date<=p_to and booking.departure_date>p_from or exists(
        select 1 from public.hotel_inventory_commitments commitment where commitment.booking_allocation_id=allocation.id
          and commitment.status='active' and commitment.stay_date between p_from and p_to))),'[]'),
    'holds',coalesce((select jsonb_agg(jsonb_build_array(hold_row.id,hold_row.version,hold_row.status,hold_row.expires_at,
      (select min(commitment.stay_date) from public.hotel_inventory_commitments commitment
        where commitment.hold_id=hold_row.id and commitment.status='active'),
      (select max(commitment.stay_date) from public.hotel_inventory_commitments commitment
        where commitment.hold_id=hold_row.id and commitment.status='active')) order by hold_row.id)
      from public.hotel_inventory_holds hold_row where hold_row.hotel_id=p_hotel_id and exists(
        select 1 from public.hotel_inventory_commitments commitment where commitment.hold_id=hold_row.id
          and commitment.stay_date between p_from and p_to)),'[]'),
    'commitments',coalesce((select jsonb_agg(jsonb_build_array(id,version,status) order by id) from public.hotel_inventory_commitments where hotel_id=p_hotel_id and stay_date between p_from and p_to),'[]'),
    'expiry_boundary',v_valid_until
  )) into v_token;

  with room_days as(
    select room.*,day_value::date stay_date
    from public.hotel_room_types room
    cross join generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') day_value
    where room.hotel_id=p_hotel_id
  ), cell_values as(
    select rd.id room_type_id,rd.stay_date,rd.inventory_mode,
      case when rd.inventory_mode='unitized' then
        (select count(*)::integer from public.hotel_units unit where unit.room_type_id=rd.id and unit.status='active')
        else rd.base_inventory_count end physical_capacity,
      inventory.version inventory_version,
      case when inventory.room_type_id is not null and (inventory.expires_at is null or inventory.expires_at>v_as_of)
             and inventory.sellable_units_mode='set' then inventory.sellable_units
        else case when rd.inventory_mode='unitized' then
          (select count(*)::integer from public.hotel_units unit where unit.room_type_id=rd.id and unit.status='active')
          else rd.base_inventory_count end end configured_sellable_units,
      coalesce((select count(distinct block.unit_id)::integer from public.hotel_unit_calendar_blocks block
        join public.hotel_units unit on unit.id=block.unit_id and unit.room_type_id=rd.id and unit.status='active'
        where block.hotel_id=p_hotel_id and block.room_type_id=rd.id and block.is_active and block.blocked
          and (block.expires_at is null or block.expires_at>v_as_of) and rd.stay_date between block.from_date and block.to_date),0) blocked_unit_count,
      coalesce((select jsonb_agg(distinct block.unit_id order by block.unit_id) from public.hotel_unit_calendar_blocks block
        join public.hotel_units unit on unit.id=block.unit_id and unit.room_type_id=rd.id and unit.status='active'
        where block.hotel_id=p_hotel_id and block.room_type_id=rd.id and block.is_active and block.blocked
          and (block.expires_at is null or block.expires_at>v_as_of) and rd.stay_date between block.from_date and block.to_date),'[]') blocked_unit_ids,
      coalesce(inventory.closed_mode='set' and inventory.closed and (inventory.expires_at is null or inventory.expires_at>v_as_of),false) operational_closed,
      false safety_closed,
      coalesce((select sum(commitment.units)::integer from public.hotel_inventory_commitments commitment
        join public.hotel_inventory_holds hold_row on hold_row.id=commitment.hold_id
          and hold_row.status='active' and hold_row.expires_at>v_as_of
        where commitment.hotel_id=p_hotel_id and commitment.room_type_id=rd.id and commitment.stay_date=rd.stay_date
          and commitment.status='active'),0) held_units,
      coalesce((select sum(commitment.units)::integer from public.hotel_inventory_commitments commitment
        join public.hotel_booking_room_allocations allocation on allocation.id=commitment.booking_allocation_id and allocation.status='active'
        join public.hotel_bookings booking on booking.id=allocation.booking_id and booking.status in('pending','confirmed')
        where commitment.hotel_id=p_hotel_id and commitment.room_type_id=rd.id and commitment.stay_date=rd.stay_date
          and commitment.status='active'),0) booked_units,
      (select min(hold_row.expires_at) from public.hotel_inventory_commitments commitment
        join public.hotel_inventory_holds hold_row on hold_row.id=commitment.hold_id
          and hold_row.status='active' and hold_row.expires_at>v_as_of
        where commitment.hotel_id=p_hotel_id and commitment.room_type_id=rd.id and commitment.stay_date=rd.stay_date
          and commitment.status='active') earliest_hold_expiry
    from room_days rd left join public.hotel_daily_inventory inventory
      on inventory.room_type_id=rd.id and inventory.stay_date=rd.stay_date
  ), cells as(
    select *,held_units+booked_units committed_units,
      greatest(0,least(physical_capacity-case when inventory_mode='unitized' then blocked_unit_count else 0 end,
        configured_sellable_units)-held_units-booked_units) available_units
    from cell_values
  )
  select jsonb_build_object(
    'contract_version','hotels_v2_admin_d_availability_control_v1','hotel_id',p_hotel_id,
    'from',p_from,'to',p_to,'snapshot_token',v_token,'snapshot_as_of',v_as_of,
    'snapshot_valid_until',v_valid_until,
    'property',(select jsonb_build_object('id',property.id,'name_i18n',jsonb_build_object(
      'pl',coalesce(property.title_i18n->>'pl',property.title->>'pl',property.title_i18n->>'en',property.title->>'en',property.slug),
      'en',coalesce(property.title_i18n->>'en',property.title->>'en',property.title_i18n->>'pl',property.title->>'pl',property.slug),
      'he',coalesce(property.title_i18n->>'he',property.title->>'he',property.title_i18n->>'en',property.title->>'en',property.slug)),
      'architecture_version',property.architecture_version,'timezone',property.timezone,
      'currency',property.currency,'booking_mode',property.booking_mode,
      'minimum_stay_nights',property.minimum_stay_nights,
      'maximum_stay_nights',profile.maximum_stay_nights,
      'updated_at',greatest(property.updated_at,coalesce(profile.updated_at,property.updated_at)))
      from public.hotels property left join public.hotel_property_operational_profiles profile on profile.hotel_id=property.id
      where property.id=p_hotel_id),
    'room_types',coalesce((select jsonb_agg(jsonb_build_object('id',room.id,'hotel_id',room.hotel_id,
      'code',room.code,'name_i18n',room.name_i18n,'inventory_mode',room.inventory_mode,
      'base_inventory_count',room.base_inventory_count,'status',room.status,'sort_order',room.sort_order,
      'max_occupancy',room.max_occupancy,'capacity_adults',room.capacity_adults,
      'capacity_children',room.capacity_children,'version',room.version,'updated_at',room.updated_at)
      order by room.sort_order,room.id) from public.hotel_room_types room where room.hotel_id=p_hotel_id),'[]'),
    'room_rates',coalesce((select jsonb_agg(jsonb_build_object('id',rate.id,'hotel_id',rate.hotel_id,
      'room_type_id',rate.room_type_id,'rate_plan_id',rate.rate_plan_id,'is_active',rate.is_active,
      'review_status',rate.review_status,'sort_order',rate.sort_order,'version',rate.version,'updated_at',rate.updated_at)
      order by rate.sort_order,rate.id) from public.hotel_room_rates rate where rate.hotel_id=p_hotel_id),'[]'),
    'units',coalesce((select jsonb_agg(jsonb_build_object('id',unit.id,'room_type_id',unit.room_type_id,
      'code',unit.code,'name_i18n',unit.name_i18n,'status',unit.status,'version',unit.version,
      'updated_at',unit.updated_at) order by unit.room_type_id,unit.id)
      from public.hotel_units unit join public.hotel_room_types room on room.id=unit.room_type_id where room.hotel_id=p_hotel_id),'[]'),
    'cells',coalesce((select jsonb_agg(jsonb_build_object(
      'room_type_id',room_type_id,'stay_date',stay_date,'inventory_mode',inventory_mode,
      'physical_capacity',physical_capacity,'configured_sellable_units',configured_sellable_units,
      'blocked_unit_count',blocked_unit_count,'blocked_unit_ids',blocked_unit_ids,
      'operational_closed',operational_closed,'safety_closed',safety_closed,'held_units',held_units,'booked_units',booked_units,
      'committed_units',committed_units,'available_units',case when operational_closed or safety_closed then 0 else available_units end,
      'requestable',false,
      'blocking_reasons',case when operational_closed then '["operational_closed"]'::jsonb else '[]'::jsonb end ||
        case when safety_closed then '["safety_closed"]'::jsonb else '[]'::jsonb end ||
        case when available_units<=0 then '["inventory_exhausted"]'::jsonb else '[]'::jsonb end || '["public_activation_off"]'::jsonb,
      'earliest_hold_expiry',earliest_hold_expiry,
      'provenance',jsonb_build_object('capacity','room_type_or_active_units','inventory','hotel_daily_inventory','commitments','server_authoritative'),
      'inventory_version',coalesce(inventory_version,0)) order by room_type_id,stay_date) from cells),'[]'),
    'product_cells',coalesce((select jsonb_agg(jsonb_build_object(
      'room_type_id',rate.room_type_id,'room_rate_id',rate.id,'rate_plan_id',rate.rate_plan_id,
      'stay_date',day_value::date,
      'operational_closed',coalesce(exact.closed_mode='set' and exact.closed and
        case when exact.availability_updated_at is null then exact.is_active and (exact.expires_at is null or exact.expires_at>v_as_of)
          else exact.availability_active and (exact.availability_expires_at is null or exact.availability_expires_at>v_as_of) end,false),
      'closed_to_arrival',coalesce(case when exact.closed_to_arrival_mode='set' and
        case when exact.availability_updated_at is null then exact.is_active and (exact.expires_at is null or exact.expires_at>v_as_of)
          else exact.availability_active and (exact.availability_expires_at is null or exact.availability_expires_at>v_as_of) end then exact.closed_to_arrival end,
        (select rule.closed_to_arrival from public.hotel_rate_rules rule where rule.room_rate_id=rate.id and rule.is_active and day_value::date between rule.valid_from and rule.valid_to and extract(isodow from day_value)::smallint=any(rule.weekdays) order by (cardinality(rule.weekdays)=7) desc,rule.priority desc,rule.id limit 1),false),
      'closed_to_departure',coalesce(case when exact.closed_to_departure_mode='set' and
        case when exact.availability_updated_at is null then exact.is_active and (exact.expires_at is null or exact.expires_at>v_as_of)
          else exact.availability_active and (exact.availability_expires_at is null or exact.availability_expires_at>v_as_of) end then exact.closed_to_departure end,
        (select rule.closed_to_departure from public.hotel_rate_rules rule where rule.room_rate_id=rate.id and rule.is_active and day_value::date between rule.valid_from and rule.valid_to and extract(isodow from day_value)::smallint=any(rule.weekdays) order by (cardinality(rule.weekdays)=7) desc,rule.priority desc,rule.id limit 1),false),
      'safety_closed',coalesce(dr.closed,false),'requestable',false,
      'blocking_reasons',case when coalesce(exact.closed_mode='set' and exact.closed and
        case when exact.availability_updated_at is null then exact.is_active and (exact.expires_at is null or exact.expires_at>v_as_of)
          else exact.availability_active and (exact.availability_expires_at is null or exact.availability_expires_at>v_as_of) end,false)
        then '["operational_closed"]'::jsonb else '[]'::jsonb end ||
        case when coalesce(dr.closed,false) then '["safety_closed"]'::jsonb else '[]'::jsonb end ||
        case when not rate.is_active then '["room_rate_inactive"]'::jsonb else '[]'::jsonb end || '["public_activation_off"]'::jsonb,
      'provenance',jsonb_build_object('exact_override_id',exact.id,'daily_rate',dr.room_rate_id is not null,
        'availability_version',exact.availability_version))
      order by rate.id,day_value) from public.hotel_room_rates rate
      cross join generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') day_value
      left join public.hotel_calendar_overrides exact on exact.room_rate_id=rate.id and exact.stay_date=day_value::date
      left join public.hotel_daily_rates dr on dr.room_rate_id=rate.id and dr.stay_date=day_value::date
      where rate.hotel_id=p_hotel_id),'[]'),
    'daily_inventory',coalesce((select jsonb_agg(jsonb_build_object('room_type_id',inventory.room_type_id,
      'stay_date',inventory.stay_date,'sellable_units',inventory.sellable_units,'sellable_units_mode',inventory.sellable_units_mode,
      'closed',inventory.closed,'closed_mode',inventory.closed_mode,'reason',inventory.reason,'expires_at',inventory.expires_at,
      'version',inventory.version,'updated_at',inventory.updated_at) order by inventory.room_type_id,inventory.stay_date)
      from public.hotel_daily_inventory inventory join public.hotel_room_types room on room.id=inventory.room_type_id
      where room.hotel_id=p_hotel_id and inventory.stay_date between p_from and p_to),'[]'),
    'unit_calendar_blocks',coalesce((select jsonb_agg(jsonb_build_object('id',block.id,'hotel_id',block.hotel_id,
      'room_type_id',block.room_type_id,'unit_id',block.unit_id,'from_date',block.from_date,'to_date',block.to_date,
      'blocked',block.blocked,'reason',block.reason,'expires_at',block.expires_at,'is_active',block.is_active,
      'version',block.version,'updated_at',block.updated_at) order by block.from_date,block.id)
      from public.hotel_unit_calendar_blocks block where block.hotel_id=p_hotel_id and block.from_date<=p_to and block.to_date>=p_from),'[]'),
    'operational_overrides',coalesce((select jsonb_agg(jsonb_build_object('id',exact.id,'hotel_id',exact.hotel_id,
      'room_rate_id',exact.room_rate_id,'stay_date',exact.stay_date,'closed',exact.closed,'closed_mode',exact.closed_mode,
      'closed_to_arrival',exact.closed_to_arrival,'closed_to_arrival_mode',exact.closed_to_arrival_mode,
      'closed_to_departure',exact.closed_to_departure,'closed_to_departure_mode',exact.closed_to_departure_mode,
      'availability_reason',case when exact.availability_updated_at is null then
        case when exact.closed_mode is not null or exact.closed_to_arrival_mode is not null or exact.closed_to_departure_mode is not null then exact.reason end
        else exact.availability_reason end,
      'availability_expires_at',case when exact.availability_updated_at is null then
        case when exact.closed_mode is not null or exact.closed_to_arrival_mode is not null or exact.closed_to_departure_mode is not null then exact.expires_at end
        else exact.availability_expires_at end,
      'availability_active',case when exact.availability_updated_at is null then
        (exact.closed_mode is not null or exact.closed_to_arrival_mode is not null or exact.closed_to_departure_mode is not null) and exact.is_active
        else exact.availability_active end,
      'availability_version',exact.availability_version,
      'availability_updated_at',exact.availability_updated_at) order by exact.stay_date,exact.id)
      from public.hotel_calendar_overrides exact where exact.hotel_id=p_hotel_id and exact.stay_date between p_from and p_to
      ),'[]'),
    'rate_rule_operational_restrictions',coalesce((select jsonb_agg(jsonb_build_object('id',rule.id,'room_rate_id',rule.room_rate_id,'valid_from',rule.valid_from,'valid_to',rule.valid_to,'weekdays',rule.weekdays,'closed_to_arrival',rule.closed_to_arrival,'closed_to_departure',rule.closed_to_departure,'availability_version',rule.availability_version,'availability_reason',rule.availability_reason,'availability_actor_id',rule.availability_actor_id,'availability_correlation_id',rule.availability_correlation_id,'availability_updated_at',rule.availability_updated_at) order by rule.id) from public.hotel_rate_rules rule join public.hotel_room_rates rate on rate.id=rule.room_rate_id where rate.hotel_id=p_hotel_id and rule.valid_from<=p_to and rule.valid_to>=p_from),'[]'),
    'booking_allocations',coalesce((select jsonb_agg(jsonb_build_object('id',allocation.id,'booking_id',allocation.booking_id,
      'arrival_date',booking.arrival_date,'departure_date',booking.departure_date,
      'current_booking_updated_at',booking.updated_at,'current_booking_status',booking.status,
      'room_type_id',allocation.room_type_id,'rate_plan_id',allocation.rate_plan_id,'room_rate_id',allocation.room_rate_id,
      'unit_ids',allocation.unit_ids,'units_required',allocation.units_required,'allocated_guest_counts',allocation.allocated_guest_counts,
      'pricing_guest_counts',allocation.pricing_guest_counts,'booking_updated_at',allocation.booking_updated_at,
      'status',allocation.status,'version',allocation.version,'updated_at',allocation.updated_at,
      'active_commitment_from',(select min(commitment.stay_date) from public.hotel_inventory_commitments commitment
        where commitment.booking_allocation_id=allocation.id and commitment.status='active'),
      'active_commitment_to',(select max(commitment.stay_date) from public.hotel_inventory_commitments commitment
        where commitment.booking_allocation_id=allocation.id and commitment.status='active'),
      'active_commitments',coalesce((select jsonb_agg(jsonb_build_object('room_type_id',commitment.room_type_id,
        'stay_date',commitment.stay_date,'unit_id',commitment.unit_id,'units',commitment.units,'status',commitment.status)
        order by commitment.room_type_id,commitment.stay_date,commitment.unit_id nulls first,commitment.units)
        from public.hotel_inventory_commitments commitment where commitment.booking_allocation_id=allocation.id
          and commitment.status='active'),'[]'::jsonb)) order by allocation.booking_id,allocation.id)
      from public.hotel_booking_room_allocations allocation join public.hotel_bookings booking on booking.id=allocation.booking_id
      where allocation.hotel_id=p_hotel_id and (booking.arrival_date<=p_to and booking.departure_date>p_from or exists(
        select 1 from public.hotel_inventory_commitments commitment where commitment.booking_allocation_id=allocation.id
          and commitment.status='active' and commitment.stay_date between p_from and p_to))),'[]'),
    'holds',coalesce((select jsonb_agg(jsonb_build_object('id',hold_row.id,'status',hold_row.status,
      'expires_at',hold_row.expires_at,'version',hold_row.version,'created_at',hold_row.created_at,'updated_at',hold_row.updated_at,
      'active_commitment_from',(select min(commitment.stay_date) from public.hotel_inventory_commitments commitment
        where commitment.hold_id=hold_row.id and commitment.status='active'),
      'active_commitment_to',(select max(commitment.stay_date) from public.hotel_inventory_commitments commitment
        where commitment.hold_id=hold_row.id and commitment.status='active'),
      'commitments',coalesce((select jsonb_agg(jsonb_build_object('room_type_id',commitment.room_type_id,
        'stay_date',commitment.stay_date,'unit_id',commitment.unit_id,'units',commitment.units,'status',commitment.status)
        order by commitment.stay_date,commitment.id) from public.hotel_inventory_commitments commitment
        where commitment.hold_id=hold_row.id and commitment.stay_date between p_from and p_to),'[]'::jsonb))
      order by hold_row.created_at,hold_row.id) from public.hotel_inventory_holds hold_row where hold_row.hotel_id=p_hotel_id
      and exists(select 1 from public.hotel_inventory_commitments commitment where commitment.hold_id=hold_row.id
        and commitment.stay_date between p_from and p_to)),'[]'),
    'unmapped_booking_blockers',coalesce((select jsonb_agg(jsonb_build_object('booking_id',booking.id,'booking_updated_at',booking.updated_at,'arrival_date',booking.arrival_date,'departure_date',booking.departure_date,'num_adults',coalesce(booking.num_adults,1),'num_children',coalesce(booking.num_children,0),'status',booking.status,
      'reason',case when exists(select 1 from public.hotel_booking_room_allocations stale where stale.booking_id=booking.id and stale.status='active') then 'stale_booking_allocation' else 'exact_booking_allocation_required' end) order by booking.arrival_date,booking.id)
      from public.hotel_bookings booking where booking.hotel_id=p_hotel_id and booking.status in('pending','confirmed')
        and booking.arrival_date<=p_to and booking.departure_date>p_from
        and not exists(select 1 from public.hotel_booking_room_allocations allocation
          where allocation.booking_id=booking.id and allocation.status='active'
            and allocation.booking_updated_at=booking.updated_at)),'[]'),
    'recent_activity',coalesce((select jsonb_agg(jsonb_build_object('id',activity.id,'entity_type',activity.entity_type,
      'entity_id',activity.entity_id,'action',activity.action,
      'before_state',case when activity.before_state is null then null else jsonb_build_object('fingerprint',public.hotel_v2_admin_d_hash(activity.before_state),'redacted',true) end,
      'after_state',case when activity.after_state is null then null else jsonb_build_object('fingerprint',public.hotel_v2_admin_d_hash(activity.after_state),'redacted',true) end,
      'actor_type',activity.actor_type,'source',activity.source,
      'correlation_id',activity.correlation_id,'created_at',activity.created_at)
      order by activity.created_at desc,activity.id desc) from(select * from public.hotel_activity_log
      where hotel_id=p_hotel_id and entity_type in('daily_inventory','calendar_override','unit_calendar_block',
        'rate_rule_operational_restriction','booking_allocation','inventory_hold') order by created_at desc,id desc limit 100) activity),'[]'),
    'public_change',false) into v_result;
  if octet_length(convert_to(v_result::text,'UTF8'))>20971520 then
    raise exception using errcode='54000',message='hotels_v2_admin_d_snapshot_technical_limit_exceeded'; end if;
  return v_result;
end
$function$;

create function public.hotel_v2_admin_get_availability_control(p_hotel_id uuid,p_from date,p_to date)
returns jsonb language sql security definer set search_path=pg_catalog,public,auth
as $$select public.hotel_v2_admin_d_snapshot(p_hotel_id,p_from,p_to,true)$$;

create function public.hotel_v2_admin_d_review_plan(p_draft jsonb)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
declare
  v_hotel_id uuid; v_from date; v_to date; v_control jsonb;
  v_intent jsonb; v_entity text; v_action text; v_id uuid; v_payload jsonb;
  v_original jsonb; v_operations jsonb:='[]'::jsonb; v_impacts jsonb:='[]'::jsonb;
  v_operation jsonb; v_plan jsonb; v_fingerprint text; v_changed boolean:=false; v_operation_changed boolean;
  v_booking public.hotel_bookings%rowtype; v_item jsonb; v_guest_sum integer; v_room_capacity integer; v_inventory_mode text;
  v_expected_commitments jsonb;
  v_day date; v_weekdays smallint[]; v_rate_id uuid;
  v_impact_rooms jsonb; v_impact_rates jsonb; v_impact_from date; v_impact_to date;
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_draft is null or jsonb_typeof(p_draft)<>'object'
     or not public.hotel_v2_admin_d_keys_allowed(p_draft,array['contract_version','hotel_id','from','to','snapshot_token','intents'])
     or p_draft->>'contract_version'<>'hotels_v2_admin_d_availability_draft_v1'
     or jsonb_typeof(p_draft->'intents')<>'array'
     or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(p_draft)
     or not public.hotel_v2_admin_c_json_timestamp_fields_are_canonical(p_draft)
     or not public.hotel_v2_admin_d_json_dates_are_canonical(p_draft)
     or octet_length(convert_to(p_draft::text,'UTF8'))>5242880
     or jsonb_array_length(p_draft->'intents')<1 or jsonb_array_length(p_draft->'intents')>100 then
    raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_availability_draft';
  end if;
  begin v_hotel_id:=(p_draft->>'hotel_id')::uuid; v_from:=(p_draft->>'from')::date; v_to:=(p_draft->>'to')::date;
  exception when others then raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_availability_draft'; end;
  if v_to<v_from or v_to-v_from>364 or (v_to-v_from>61 and exists(
    select 1 from jsonb_array_elements(p_draft->'intents') intent(value)
    where intent.value->>'entity' not in('booking_allocation','hold'))) then
    raise exception using errcode='22023',message='hotels_v2_admin_d_plan_range_limit_exceeded'; end if;
  v_control:=public.hotel_v2_admin_d_snapshot(v_hotel_id,v_from,v_to,false);
  if v_control->>'snapshot_token' is distinct from p_draft->>'snapshot_token' then
    raise exception using errcode='PT409',message='hotels_v2_admin_d_stale_availability_snapshot';
  end if;

  for v_intent in select value from jsonb_array_elements(p_draft->'intents') loop
    if jsonb_typeof(v_intent)<>'object'
       or not public.hotel_v2_admin_d_keys_allowed(v_intent,array['entity','action','id','payload'])
       or jsonb_typeof(v_intent->'payload')<>'object' then
      raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_intent';
    end if;
    v_entity:=v_intent->>'entity'; v_action:=v_intent->>'action'; v_payload:=v_intent->'payload';
    if (v_payload?'expires_at' and jsonb_typeof(v_payload->'expires_at')<>'null'
          and (v_payload->>'expires_at')::timestamptz<=statement_timestamp())
       or (v_payload?'availability_expires_at' and jsonb_typeof(v_payload->'availability_expires_at')<>'null'
          and (v_payload->>'availability_expires_at')::timestamptz<=statement_timestamp()) then
      raise exception using errcode='22023',message='hotels_v2_admin_d_expiry_must_be_future'; end if;
    v_operation_changed:=false;
    begin v_id:=case when v_intent->>'id' is null then null else (v_intent->>'id')::uuid end;
    exception when others then raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_intent_id'; end;
    v_original:=null;

    if v_entity='operational_override_range' and v_action='expand' then
      if v_id is not null then raise exception using errcode='22023',message='hotels_v2_admin_d_range_id_must_be_null'; end if;
      if not public.hotel_v2_admin_d_keys_allowed(v_payload,array['room_rate_id','valid_from','valid_to','weekdays',
        'closed','closed_mode','closed_to_arrival','closed_to_arrival_mode','closed_to_departure',
        'closed_to_departure_mode','reason','availability_expires_at'])
         or not (v_payload ?& array['room_rate_id','valid_from','valid_to','weekdays','reason'])
         or jsonb_typeof(v_payload->'weekdays')<>'array' then
        raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_operational_override_range'; end if;
      v_rate_id:=(v_payload->>'room_rate_id')::uuid;
      if not exists(select 1 from public.hotel_room_rates where id=v_rate_id and hotel_id=v_hotel_id) then
        raise exception using errcode='23503',message='hotels_v2_admin_d_foreign_room_rate'; end if;
      if not public.hotel_v2_admin_d_reason_is_valid(v_payload->'reason')
         or exists(select 1 from jsonb_array_elements(v_payload->'weekdays') weekday(value)
           where jsonb_typeof(weekday.value)<>'number' or weekday.value#>>'{}'!~'^[1-7]$') then
        raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_operational_override_range'; end if;
      v_weekdays:=array(select value::smallint from jsonb_array_elements_text(v_payload->'weekdays'));
      if (v_payload->>'valid_from')::date<v_from or (v_payload->>'valid_to')::date>v_to
         or (v_payload->>'valid_to')::date<(v_payload->>'valid_from')::date
         or cardinality(v_weekdays) not between 1 and 7 or array_position(v_weekdays,null) is not null
         or exists(select 1 from unnest(v_weekdays) weekday where weekday not between 1 and 7)
         or v_weekdays is distinct from array(select distinct weekday from unnest(v_weekdays) weekday order by weekday)
         or not public.hotel_v2_admin_d_keys_allowed(v_payload,array['room_rate_id','valid_from','valid_to','weekdays',
           'closed','closed_mode','closed_to_arrival','closed_to_arrival_mode','closed_to_departure',
           'closed_to_departure_mode','reason','availability_expires_at'])
         or (v_payload?'closed' and not v_payload?'closed_mode')
         or (v_payload?'closed_to_arrival' and not v_payload?'closed_to_arrival_mode')
         or (v_payload?'closed_to_departure' and not v_payload?'closed_to_departure_mode')
         or (v_payload?'closed_mode' and (v_payload->>'closed_mode' not in('set','clear','no_change')
           or (v_payload->>'closed_mode'='set' and jsonb_typeof(v_payload->'closed')<>'boolean')
           or (v_payload->>'closed_mode'='clear' and jsonb_typeof(v_payload->'closed')<>'null')
           or (v_payload->>'closed_mode'='no_change' and v_payload?'closed')))
         or (v_payload?'closed_to_arrival_mode' and (v_payload->>'closed_to_arrival_mode' not in('set','clear','no_change')
           or (v_payload->>'closed_to_arrival_mode'='set' and jsonb_typeof(v_payload->'closed_to_arrival')<>'boolean')
           or (v_payload->>'closed_to_arrival_mode'='clear' and jsonb_typeof(v_payload->'closed_to_arrival')<>'null')
           or (v_payload->>'closed_to_arrival_mode'='no_change' and v_payload?'closed_to_arrival')))
         or (v_payload?'closed_to_departure_mode' and (v_payload->>'closed_to_departure_mode' not in('set','clear','no_change')
           or (v_payload->>'closed_to_departure_mode'='set' and jsonb_typeof(v_payload->'closed_to_departure')<>'boolean')
           or (v_payload->>'closed_to_departure_mode'='clear' and jsonb_typeof(v_payload->'closed_to_departure')<>'null')
           or (v_payload->>'closed_to_departure_mode'='no_change' and v_payload?'closed_to_departure'))) then
        raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_operational_override_range'; end if;
      if v_payload->>'closed_mode'='no_change' then v_payload:=v_payload-'closed_mode'-'closed'; end if;
      if v_payload->>'closed_to_arrival_mode'='no_change' then v_payload:=v_payload-'closed_to_arrival_mode'-'closed_to_arrival'; end if;
      if v_payload->>'closed_to_departure_mode'='no_change' then v_payload:=v_payload-'closed_to_departure_mode'-'closed_to_departure'; end if;
      for v_day in select day_value::date from generate_series((v_payload->>'valid_from')::date,
        (v_payload->>'valid_to')::date,interval '1 day') day_value
        where extract(isodow from day_value)::smallint=any(v_weekdays) order by day_value loop
        select id,jsonb_build_object('id',id,'hotel_id',hotel_id,'room_rate_id',room_rate_id,'stay_date',stay_date,
          'closed',closed,'closed_mode',closed_mode,'closed_to_arrival',closed_to_arrival,
          'closed_to_arrival_mode',closed_to_arrival_mode,'closed_to_departure',closed_to_departure,
          'closed_to_departure_mode',closed_to_departure_mode,
          'availability_expires_at',case when availability_updated_at is null then
            case when closed_mode is not null or closed_to_arrival_mode is not null or closed_to_departure_mode is not null then expires_at end
            else availability_expires_at end,
          'availability_active',case when availability_updated_at is null then
            (closed_mode is not null or closed_to_arrival_mode is not null or closed_to_departure_mode is not null) and is_active
            else availability_active end,
          'availability_version',availability_version)
          into v_id,v_original from public.hotel_calendar_overrides where room_rate_id=v_rate_id and stay_date=v_day;
        v_id:=coalesce(v_id,public.hotel_v2_admin_d_deterministic_uuid(v_rate_id::text||':'||v_day::text||':admin-d'));
        -- An absent or ADMIN-C price-only row is operationally neutral. CLEAR-only
        -- patches preserve that neutral state and must not create D rows/activity.
        v_operation_changed:=(v_original is null and
            (v_payload->>'closed_mode'='set' or v_payload->>'closed_to_arrival_mode'='set'
              or v_payload->>'closed_to_departure_mode'='set'))
          or (v_original is not null
          and (v_original->'closed_mode'<>'null'::jsonb or v_original->'closed_to_arrival_mode'<>'null'::jsonb
            or v_original->'closed_to_departure_mode'<>'null'::jsonb
            or v_payload->>'closed_mode'='set' or v_payload->>'closed_to_arrival_mode'='set'
            or v_payload->>'closed_to_departure_mode'='set')
          and ((v_payload?'closed_mode' and (v_payload->>'closed_mode' is distinct from v_original->>'closed_mode'
            or case when v_payload->>'closed_mode'='clear' then null else (v_payload->>'closed')::boolean end is distinct from (v_original->>'closed')::boolean))
          or (v_payload?'closed_to_arrival_mode' and (v_payload->>'closed_to_arrival_mode' is distinct from v_original->>'closed_to_arrival_mode'
            or case when v_payload->>'closed_to_arrival_mode'='clear' then null else (v_payload->>'closed_to_arrival')::boolean end is distinct from (v_original->>'closed_to_arrival')::boolean))
          or (v_payload?'closed_to_departure_mode' and (v_payload->>'closed_to_departure_mode' is distinct from v_original->>'closed_to_departure_mode'
            or case when v_payload->>'closed_to_departure_mode'='clear' then null else (v_payload->>'closed_to_departure')::boolean end is distinct from (v_original->>'closed_to_departure')::boolean))
          or (v_payload?'availability_expires_at'
            and (v_original->'closed_mode'<>'null'::jsonb or v_original->'closed_to_arrival_mode'<>'null'::jsonb
              or v_original->'closed_to_departure_mode'<>'null'::jsonb)
            and v_payload->'availability_expires_at' is distinct from v_original->'availability_expires_at')));
        v_operation_changed:=v_operation_changed or (v_original is not null
          and (v_original->'closed_mode'<>'null'::jsonb or v_original->'closed_to_arrival_mode'<>'null'::jsonb
            or v_original->'closed_to_departure_mode'<>'null'::jsonb)
          and not coalesce((v_original->>'availability_active')::boolean,false)
          and (v_payload->>'closed_mode'='set' or v_payload->>'closed_to_arrival_mode'='set'
            or v_payload->>'closed_to_departure_mode'='set'
            or v_original->'closed_mode'<>'null'::jsonb or v_original->'closed_to_arrival_mode'<>'null'::jsonb
            or v_original->'closed_to_departure_mode'<>'null'::jsonb));
        if not v_operation_changed then continue; end if;
        v_operation:=jsonb_build_object('entity','operational_override','action',case when v_original is null then 'create' else 'update' end,
          'id',v_id,'expected_version',coalesce((v_original->>'availability_version')::bigint,0),
          'expected_original',coalesce(v_original,'{}'::jsonb),'payload',
          (v_payload-'valid_from'-'valid_to'-'weekdays')||jsonb_build_object('room_rate_id',v_rate_id,'stay_date',v_day,'availability_active',true));
        v_operations:=v_operations||jsonb_build_array(v_operation);
        v_impacts:=v_impacts||jsonb_build_array(jsonb_build_object('entity','operational_override','action',v_operation->>'action',
          'id',v_id,'changed',true,'affected_room_type_ids',(select jsonb_build_array(room_type_id) from public.hotel_room_rates where id=v_rate_id),
          'affected_room_rate_ids',jsonb_build_array(v_rate_id),'from',v_day,'to',v_day));
        v_operation_changed:=true; v_changed:=true;
      end loop;
      continue;
    end if;

    if v_entity='daily_inventory' and v_action in('upsert','delete') then
      if v_id is not null then raise exception using errcode='22023',message='hotels_v2_admin_d_daily_inventory_id_must_be_null'; end if;
      if not public.hotel_v2_admin_d_keys_allowed(v_payload,array['room_type_id','stay_date','sellable_units','sellable_units_mode','closed','closed_mode','reason','expires_at'])
         or not (v_payload ?& array['room_type_id','stay_date']) then
        raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_daily_inventory'; end if;
      if not exists(select 1 from public.hotel_room_types where id=(v_payload->>'room_type_id')::uuid and hotel_id=v_hotel_id) then
        raise exception using errcode='23503',message='hotels_v2_admin_d_foreign_room_type'; end if;
      if (v_payload->>'stay_date')::date not between v_from and v_to then
        raise exception using errcode='22023',message='hotels_v2_admin_d_inventory_outside_reviewed_range'; end if;
      select jsonb_build_object('room_type_id',room_type_id,'stay_date',stay_date,'sellable_units',sellable_units,
        'sellable_units_mode',sellable_units_mode,'closed',closed,'closed_mode',closed_mode,'reason',reason,
        'expires_at',expires_at,'version',version) into v_original from public.hotel_daily_inventory
        where room_type_id=(v_payload->>'room_type_id')::uuid and stay_date=(v_payload->>'stay_date')::date;
      v_id:=coalesce(v_id,public.hotel_v2_admin_d_deterministic_uuid((v_payload->>'room_type_id')||':'||(v_payload->>'stay_date')));
      if v_action='delete' then
        if not public.hotel_v2_admin_d_reason_is_valid(v_payload->'reason') then
          raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_daily_inventory'; end if;
        v_operation_changed:=v_original is not null;
      else
        if not public.hotel_v2_admin_d_reason_is_valid(v_payload->'reason')
           or (not (v_payload ?& array['sellable_units','sellable_units_mode'])
             and not (v_payload ?& array['closed','closed_mode']) and not (v_payload?'expires_at'))
           or ((v_payload?'sellable_units') is distinct from (v_payload?'sellable_units_mode'))
           or ((v_payload?'closed') is distinct from (v_payload?'closed_mode'))
           or (v_payload ? 'sellable_units_mode' and (v_payload->>'sellable_units_mode' not in('set','clear')
             or (v_payload->>'sellable_units_mode'='set' and (jsonb_typeof(v_payload->'sellable_units')<>'number' or v_payload->>'sellable_units'!~'^(0|[1-9][0-9]*)$' or (v_payload->>'sellable_units')::integer<0))
             or (v_payload->>'sellable_units_mode'='clear' and jsonb_typeof(v_payload->'sellable_units')<>'null')))
           or (v_payload ? 'closed_mode' and (v_payload->>'closed_mode' not in('set','clear')
             or (v_payload->>'closed_mode'='set' and jsonb_typeof(v_payload->'closed')<>'boolean')
             or (v_payload->>'closed_mode'='clear' and jsonb_typeof(v_payload->'closed')<>'null'))) then
          raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_daily_inventory'; end if;
        if v_original is null then
          select case when inventory_mode='unitized' then
              (select count(*) from public.hotel_units where room_type_id=(v_payload->>'room_type_id')::uuid and status='active')
            else base_inventory_count end into v_room_capacity
          from public.hotel_room_types where id=(v_payload->>'room_type_id')::uuid;
          v_operation_changed:=coalesce(
              v_payload->>'sellable_units_mode'='set'
                and (v_payload->>'sellable_units')::integer is distinct from v_room_capacity,
              false)
            or coalesce(
              v_payload->>'closed_mode'='set'
                and (v_payload->>'closed')::boolean is distinct from false,
              false);
        else
          v_operation_changed:=(v_payload ? 'sellable_units' and case when v_payload->>'sellable_units_mode'='clear' then v_original->>'sellable_units_mode'<>'clear'
            else (v_payload->>'sellable_units')::integer is distinct from (v_original->>'sellable_units')::integer or v_original->>'sellable_units_mode'<>'set' end)
          or (v_payload ? 'sellable_units_mode' and v_payload->>'sellable_units_mode' is distinct from v_original->>'sellable_units_mode')
          or (v_payload ? 'closed' and case when v_payload->>'closed_mode'='clear' then v_original->>'closed_mode'<>'clear'
            else (v_payload->>'closed')::boolean is distinct from (v_original->>'closed')::boolean or v_original->>'closed_mode'<>'set' end)
          or (v_payload ? 'closed_mode' and v_payload->>'closed_mode' is distinct from v_original->>'closed_mode')
          or (v_payload ? 'expires_at' and (v_original->>'sellable_units_mode'='set' or v_original->>'closed_mode'='set')
            and v_payload->'expires_at' is distinct from v_original->'expires_at');
        end if;
      end if;

    elsif v_entity='unit_calendar_block' and v_action in('create','update','disable') then
      if v_id is null or not public.hotel_v2_admin_d_keys_allowed(v_payload,
        case when v_action='disable' then array['reason'] else array['unit_id','room_type_id','from_date','to_date','blocked','reason','expires_at','is_active'] end) then
        raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_unit_calendar_block'; end if;
      if v_action<>'disable' and not (v_payload ?& array['unit_id','room_type_id','from_date','to_date','blocked','reason','expires_at','is_active']) then
        raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_unit_calendar_block'; end if;
      select jsonb_build_object('id',id,'hotel_id',hotel_id,'room_type_id',room_type_id,'unit_id',unit_id,
        'from_date',from_date,'to_date',to_date,'blocked',blocked,'reason',reason,'expires_at',expires_at,
        'is_active',is_active,'version',version) into v_original from public.hotel_unit_calendar_blocks where id=v_id and hotel_id=v_hotel_id;
      if v_action<>'disable' and (coalesce((v_payload->>'from_date')::date,(v_original->>'from_date')::date)<v_from
         or coalesce((v_payload->>'to_date')::date,(v_original->>'to_date')::date)>v_to) then
        raise exception using errcode='22023',message='hotels_v2_admin_d_unit_block_outside_reviewed_range'; end if;
      if v_action='create' then
        if v_original is not null or not (v_payload ?& array['unit_id','room_type_id','from_date','to_date','reason']) then
          raise exception using errcode='23514',message='hotels_v2_admin_d_invalid_unit_calendar_block_create'; end if;
        if (v_payload?'blocked' and (v_payload->>'blocked')::boolean is not true)
           or (v_payload?'is_active' and (v_payload->>'is_active')::boolean is not true) then
          raise exception using errcode='22023',message='hotels_v2_admin_d_inert_unit_block_create'; end if;
        if not exists(select 1 from public.hotel_units unit join public.hotel_room_types room on room.id=unit.room_type_id
          where unit.id=(v_payload->>'unit_id')::uuid and unit.status='active'
            and room.id=(v_payload->>'room_type_id')::uuid and room.hotel_id=v_hotel_id
            and room.status='active' and room.inventory_mode='unitized') then
          raise exception using errcode='23503',message='hotels_v2_admin_d_foreign_unit'; end if;
      elsif v_original is null then raise exception using errcode='PT404',message='hotels_v2_admin_d_unit_calendar_block_not_found'; end if;
      if v_action<>'create' and ((v_payload?'unit_id' and v_payload->'unit_id' is distinct from v_original->'unit_id')
        or (v_payload?'room_type_id' and v_payload->'room_type_id' is distinct from v_original->'room_type_id')) then
        raise exception using errcode='23514',message='hotels_v2_admin_d_unit_block_identity_immutable'; end if;
      if not public.hotel_v2_admin_d_reason_is_valid(v_payload->'reason')
        or (v_action<>'disable' and (
          (v_payload?'blocked' and jsonb_typeof(v_payload->'blocked')<>'boolean')
        or (v_payload?'is_active' and jsonb_typeof(v_payload->'is_active')<>'boolean')
        or (v_payload->>'to_date')::date<(v_payload->>'from_date')::date)) then
        raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_unit_calendar_block'; end if;
      if v_action='update' and (v_payload->>'blocked')::boolean and (v_payload->>'is_active')::boolean
         and not exists(select 1 from public.hotel_units unit join public.hotel_room_types room on room.id=unit.room_type_id
           where unit.id=(v_payload->>'unit_id')::uuid and unit.status='active'
             and room.id=(v_payload->>'room_type_id')::uuid and room.hotel_id=v_hotel_id
             and room.status='active' and room.inventory_mode='unitized') then
        raise exception using errcode='23514',message='hotels_v2_admin_d_unit_block_requires_active_unitized_room'; end if;
      if v_action<>'disable' and (v_payload->>'blocked')::boolean and (v_payload->>'is_active')::boolean
         and exists(select 1 from public.hotel_unit_calendar_blocks overlap
           where overlap.unit_id=(v_payload->>'unit_id')::uuid and overlap.id<>v_id
             and overlap.is_active and overlap.blocked
             and (overlap.expires_at is null or overlap.expires_at>statement_timestamp())
             and daterange(overlap.from_date,overlap.to_date,'[]') &&
               daterange((v_payload->>'from_date')::date,(v_payload->>'to_date')::date,'[]')) then
        raise exception using errcode='23514',message='hotels_v2_admin_d_unit_block_overlap'; end if;
      v_operation_changed:=v_action='create' or v_action='disable' and coalesce((v_original->>'is_active')::boolean,false)
        or v_action='update' and (v_payload-'unit_id'-'room_type_id') is distinct from
          jsonb_build_object('from_date',v_original->'from_date','to_date',v_original->'to_date',
            'blocked',v_original->'blocked','reason',v_original->'reason','expires_at',v_original->'expires_at','is_active',v_original->'is_active');

    elsif v_entity='operational_override' and v_action in('create','update','disable') then
      if v_id is null or not public.hotel_v2_admin_d_keys_allowed(v_payload,
        case when v_action='disable' then array['reason'] else array['room_rate_id','stay_date','closed','closed_mode','closed_to_arrival','closed_to_arrival_mode','closed_to_departure','closed_to_departure_mode','reason','availability_expires_at','availability_active'] end) then
        raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_operational_override'; end if;
      select jsonb_build_object('id',id,'hotel_id',hotel_id,'room_rate_id',room_rate_id,'stay_date',stay_date,
        'closed',closed,'closed_mode',closed_mode,'closed_to_arrival',closed_to_arrival,
        'closed_to_arrival_mode',closed_to_arrival_mode,'closed_to_departure',closed_to_departure,
        'closed_to_departure_mode',closed_to_departure_mode,
        'availability_reason',case when availability_updated_at is null then
          case when closed_mode is not null or closed_to_arrival_mode is not null or closed_to_departure_mode is not null then reason end
          else availability_reason end,
        'availability_expires_at',case when availability_updated_at is null then
          case when closed_mode is not null or closed_to_arrival_mode is not null or closed_to_departure_mode is not null then expires_at end
          else availability_expires_at end,
        'availability_active',case when availability_updated_at is null then
          (closed_mode is not null or closed_to_arrival_mode is not null or closed_to_departure_mode is not null) and is_active
          else availability_active end,
        'availability_version',availability_version) into v_original from public.hotel_calendar_overrides where id=v_id and hotel_id=v_hotel_id;
      if coalesce((v_payload->>'stay_date')::date,(v_original->>'stay_date')::date) not between v_from and v_to then
        raise exception using errcode='22023',message='hotels_v2_admin_d_operational_override_outside_reviewed_range'; end if;
      if v_action='create' then
        if v_original is not null or not (v_payload ?& array['room_rate_id','stay_date','reason'])
           or not exists(select 1 from public.hotel_room_rates where id=(v_payload->>'room_rate_id')::uuid and hotel_id=v_hotel_id) then
          raise exception using errcode='23514',message='hotels_v2_admin_d_invalid_operational_override_create'; end if;
        if exists(select 1 from public.hotel_calendar_overrides where room_rate_id=(v_payload->>'room_rate_id')::uuid and stay_date=(v_payload->>'stay_date')::date) then
          raise exception using errcode='PT409',message='hotels_v2_admin_d_operational_override_key_exists'; end if;
        if v_payload?'availability_active' and (v_payload->>'availability_active')::boolean is not true then
          raise exception using errcode='22023',message='hotels_v2_admin_d_inert_operational_override_create'; end if;
      elsif v_original is null then raise exception using errcode='PT404',message='hotels_v2_admin_d_operational_override_not_found'; end if;
      if v_action<>'create' and ((v_payload?'room_rate_id' and v_payload->'room_rate_id' is distinct from v_original->'room_rate_id')
        or (v_payload?'stay_date' and v_payload->'stay_date' is distinct from v_original->'stay_date')) then
        raise exception using errcode='23514',message='hotels_v2_admin_d_operational_override_identity_immutable'; end if;
      if not public.hotel_v2_admin_d_reason_is_valid(v_payload->'reason')
         or (v_action<>'disable' and v_payload?'availability_active' and jsonb_typeof(v_payload->'availability_active')<>'boolean') then
        raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_operational_override'; end if;
      if v_action<>'disable' and (
        (v_payload?'closed' and not v_payload?'closed_mode')
        or (v_payload?'closed_to_arrival' and not v_payload?'closed_to_arrival_mode')
        or (v_payload?'closed_to_departure' and not v_payload?'closed_to_departure_mode')
        or (v_payload?'closed_mode' and (v_payload->>'closed_mode' not in('set','clear','no_change')
          or (v_payload->>'closed_mode'='set' and jsonb_typeof(v_payload->'closed')<>'boolean')
          or (v_payload->>'closed_mode'='clear' and jsonb_typeof(v_payload->'closed')<>'null')
          or (v_payload->>'closed_mode'='no_change' and v_payload?'closed')))
        or (v_payload?'closed_to_arrival_mode' and (v_payload->>'closed_to_arrival_mode' not in('set','clear','no_change')
          or (v_payload->>'closed_to_arrival_mode'='set' and jsonb_typeof(v_payload->'closed_to_arrival')<>'boolean')
          or (v_payload->>'closed_to_arrival_mode'='clear' and jsonb_typeof(v_payload->'closed_to_arrival')<>'null')
          or (v_payload->>'closed_to_arrival_mode'='no_change' and v_payload?'closed_to_arrival')))
        or (v_payload?'closed_to_departure_mode' and (v_payload->>'closed_to_departure_mode' not in('set','clear','no_change')
          or (v_payload->>'closed_to_departure_mode'='set' and jsonb_typeof(v_payload->'closed_to_departure')<>'boolean')
          or (v_payload->>'closed_to_departure_mode'='clear' and jsonb_typeof(v_payload->'closed_to_departure')<>'null')
          or (v_payload->>'closed_to_departure_mode'='no_change' and v_payload?'closed_to_departure')))) then
        raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_operational_override_modes'; end if;
      if v_payload->>'closed_mode'='no_change' then v_payload:=v_payload-'closed_mode'-'closed'; end if;
      if v_payload->>'closed_to_arrival_mode'='no_change' then v_payload:=v_payload-'closed_to_arrival_mode'-'closed_to_arrival'; end if;
      if v_payload->>'closed_to_departure_mode'='no_change' then v_payload:=v_payload-'closed_to_departure_mode'-'closed_to_departure'; end if;
      if v_action='update' and not (v_payload?'availability_active')
         and v_original->'closed_mode'='null'::jsonb
         and v_original->'closed_to_arrival_mode'='null'::jsonb
         and v_original->'closed_to_departure_mode'='null'::jsonb
         and (v_payload->>'closed_mode'='set' or v_payload->>'closed_to_arrival_mode'='set'
           or v_payload->>'closed_to_departure_mode'='set') then
        v_payload:=jsonb_set(v_payload,'{availability_active}','true'::jsonb,true);
      end if;
      if v_action in('create','update') and not (v_payload?'availability_active') then
        v_payload:=jsonb_set(v_payload,'{availability_active}',
          to_jsonb(coalesce((v_original->>'availability_active')::boolean,true)),true);
      end if;
      v_operation_changed:=v_action='create' and
          (v_payload->>'closed_mode'='set' or v_payload->>'closed_to_arrival_mode'='set'
            or v_payload->>'closed_to_departure_mode'='set')
        or v_action='disable' and coalesce((v_original->>'availability_active')::boolean,false)
        or v_action='update'
          and (v_original->'closed_mode'<>'null'::jsonb or v_original->'closed_to_arrival_mode'<>'null'::jsonb
            or v_original->'closed_to_departure_mode'<>'null'::jsonb
            or v_payload->>'closed_mode'='set' or v_payload->>'closed_to_arrival_mode'='set'
            or v_payload->>'closed_to_departure_mode'='set')
          and (
          (v_payload?'closed_mode' and (v_payload->>'closed_mode' is distinct from v_original->>'closed_mode'
            or case when v_payload->>'closed_mode'='clear' then null else (v_payload->>'closed')::boolean end is distinct from (v_original->>'closed')::boolean))
          or (v_payload?'closed_to_arrival_mode' and (v_payload->>'closed_to_arrival_mode' is distinct from v_original->>'closed_to_arrival_mode'
            or case when v_payload->>'closed_to_arrival_mode'='clear' then null else (v_payload->>'closed_to_arrival')::boolean end is distinct from (v_original->>'closed_to_arrival')::boolean))
          or (v_payload?'closed_to_departure_mode' and (v_payload->>'closed_to_departure_mode' is distinct from v_original->>'closed_to_departure_mode'
            or case when v_payload->>'closed_to_departure_mode'='clear' then null else (v_payload->>'closed_to_departure')::boolean end is distinct from (v_original->>'closed_to_departure')::boolean))
          or (v_payload?'availability_active' and (v_payload->>'availability_active')::boolean is distinct from (v_original->>'availability_active')::boolean)
          or (v_payload?'availability_expires_at' and v_payload->'availability_expires_at' is distinct from v_original->'availability_expires_at'));

    elsif v_entity='rate_rule_operational_restriction' and v_action in('update','clear') then
      if v_id is null or not public.hotel_v2_admin_d_keys_allowed(v_payload,
        case when v_action='clear' then array['reason'] else array['closed_to_arrival','closed_to_departure','reason'] end)
         or not public.hotel_v2_admin_d_reason_is_valid(v_payload->'reason')
         or (v_action='update' and v_payload?'closed_to_arrival' and jsonb_typeof(v_payload->'closed_to_arrival')<>'boolean')
         or (v_action='update' and v_payload?'closed_to_departure' and jsonb_typeof(v_payload->'closed_to_departure')<>'boolean') then
        raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_rate_rule_restriction'; end if;
      select jsonb_build_object('id',rule.id,'room_rate_id',rule.room_rate_id,
        'valid_from',rule.valid_from,'valid_to',rule.valid_to,'weekdays',rule.weekdays,
        'priority',rule.priority,'is_active',rule.is_active,
        'closed_to_arrival',rule.closed_to_arrival,'closed_to_departure',rule.closed_to_departure,
        'availability_reason',rule.availability_reason,'availability_version',rule.availability_version) into v_original
        from public.hotel_rate_rules rule join public.hotel_room_rates rate on rate.id=rule.room_rate_id
        where rule.id=v_id and rate.hotel_id=v_hotel_id;
      if v_original is null then raise exception using errcode='PT404',message='hotels_v2_admin_d_rate_rule_not_found'; end if;
      -- The overlapping snapshot binds the full immutable rule scope and its
      -- field-scoped availability version, so Review may acknowledge an
      -- affected scope wider than the current calendar viewport.
      if v_action='update' then
        if not (v_payload?'closed_to_arrival') then v_payload:=jsonb_set(v_payload,'{closed_to_arrival}',v_original->'closed_to_arrival',true); end if;
        if not (v_payload?'closed_to_departure') then v_payload:=jsonb_set(v_payload,'{closed_to_departure}',v_original->'closed_to_departure',true); end if;
      end if;
      v_operation_changed:=(v_action='clear' and ((v_original->>'closed_to_arrival')::boolean or (v_original->>'closed_to_departure')::boolean))
        or (v_action='update' and ((v_payload ? 'closed_to_arrival' and (v_payload->>'closed_to_arrival')::boolean is distinct from (v_original->>'closed_to_arrival')::boolean)
          or (v_payload ? 'closed_to_departure' and (v_payload->>'closed_to_departure')::boolean is distinct from (v_original->>'closed_to_departure')::boolean)));

    elsif v_entity='booking_allocation' and v_action in('map','release') then
      if not public.hotel_v2_admin_d_keys_allowed(v_payload,
        case when v_action='map' then array['booking_id','booking_updated_at','allocations'] else array['booking_id','reason'] end)
         or (v_action='map' and not (v_payload ?& array['booking_id','booking_updated_at','allocations']))
         or (v_action='release' and not (v_payload ?& array['booking_id','reason'])) then
        raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_booking_allocation'; end if;
      if (v_action='map' and v_id is not null)
         or (v_action='release' and (v_id is null or v_id<>(v_payload->>'booking_id')::uuid)) then
        raise exception using errcode='22023',message='hotels_v2_admin_d_booking_allocation_identity_invalid'; end if;
      if v_action='release' and not public.hotel_v2_admin_d_reason_is_valid(v_payload->'reason') then
        raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_booking_allocation'; end if;
      v_id:=coalesce(v_id,(v_payload->>'booking_id')::uuid);
      select jsonb_build_object('booking_id',booking.id,'booking_updated_at',booking.updated_at,
        'arrival_date',booking.arrival_date,'departure_date',booking.departure_date,'status',booking.status,
        'num_adults',coalesce(booking.num_adults,1),'num_children',coalesce(booking.num_children,0),
        'allocations',coalesce((select jsonb_agg(jsonb_build_object('id',allocation.id,
          'room_type_id',allocation.room_type_id,'rate_plan_id',allocation.rate_plan_id,'room_rate_id',allocation.room_rate_id,
          'unit_ids',allocation.unit_ids,'units_required',allocation.units_required,
          'allocated_guest_counts',allocation.allocated_guest_counts,'pricing_guest_counts',allocation.pricing_guest_counts)
          order by allocation.id) from public.hotel_booking_room_allocations allocation
          where allocation.booking_id=booking.id and allocation.status='active'),'[]'::jsonb),
        'commitments',coalesce((select jsonb_agg(jsonb_build_object('room_type_id',commitment.room_type_id,
          'stay_date',commitment.stay_date,'unit_id',commitment.unit_id,'units',commitment.units,
          'status',commitment.status) order by commitment.room_type_id,commitment.stay_date,
            commitment.unit_id nulls first,commitment.units)
          from public.hotel_inventory_commitments commitment join public.hotel_booking_room_allocations allocation
            on allocation.id=commitment.booking_allocation_id
          where allocation.booking_id=booking.id and allocation.status='active' and commitment.status='active'),'[]'::jsonb))
        into v_original from public.hotel_bookings booking where booking.id=(v_payload->>'booking_id')::uuid and booking.hotel_id=v_hotel_id;
      if v_original is null then raise exception using errcode='PT404',message='hotels_v2_admin_d_booking_not_found'; end if;
      if (v_original->>'arrival_date')::date<v_from or (v_original->>'departure_date')::date-1>v_to
         or exists(select 1 from jsonb_array_elements(v_original->'commitments') commitment(value)
           where (commitment.value->>'stay_date')::date not between v_from and v_to) then
        raise exception using errcode='22023',message='hotels_v2_admin_d_booking_outside_reviewed_range'; end if;
      if v_action='map' and jsonb_typeof(v_payload->'allocations')<>'array' then raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_booking_allocation'; end if;
      if v_action='map' then
        if jsonb_array_length(v_payload->'allocations') not between 1 and 1000
           or jsonb_array_length(v_payload->'allocations')<>(select count(distinct item.value->>'id')
          from jsonb_array_elements(v_payload->'allocations') item(value)) then
          raise exception using errcode='22023',message='hotels_v2_admin_d_duplicate_booking_allocation_id'; end if;
        select * into v_booking from public.hotel_bookings where id=(v_payload->>'booking_id')::uuid and hotel_id=v_hotel_id;
        if v_booking.status not in('pending','confirmed') or v_booking.updated_at is distinct from (v_payload->>'booking_updated_at')::timestamptz
           or v_booking.arrival_date<v_from or v_booking.departure_date-1>v_to then
          raise exception using errcode='PT409',message='hotels_v2_admin_d_booking_stale'; end if;
        v_guest_sum:=0;
        for v_item in select value from jsonb_array_elements(v_payload->'allocations') loop
          if jsonb_typeof(v_item)<>'object' or not public.hotel_v2_admin_d_keys_allowed(v_item,
            array['id','room_type_id','rate_plan_id','room_rate_id','unit_ids','units_required','allocated_guest_counts','pricing_guest_counts'])
             or not (v_item ?& array['id','room_type_id','rate_plan_id','room_rate_id','unit_ids','units_required','allocated_guest_counts','pricing_guest_counts'])
             or jsonb_typeof(v_item->'units_required')<>'number' or v_item->>'units_required'!~'^[1-9][0-9]*$'
             or jsonb_typeof(v_item->'unit_ids')<>'array' or jsonb_typeof(v_item->'allocated_guest_counts')<>'array'
             or jsonb_typeof(v_item->'pricing_guest_counts')<>'array' then
            raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_booking_allocation'; end if;
          if not exists(select 1 from public.hotel_room_rates rate join public.hotel_room_types room on room.id=rate.room_type_id
            where rate.id=(v_item->>'room_rate_id')::uuid and rate.hotel_id=v_hotel_id
              and rate.room_type_id=(v_item->>'room_type_id')::uuid and rate.rate_plan_id=(v_item->>'rate_plan_id')::uuid) then
            raise exception using errcode='23503',message='hotels_v2_admin_d_foreign_room_rate'; end if;
          select coalesce(max_occupancy,capacity_adults+capacity_children),inventory_mode into v_room_capacity,v_inventory_mode
            from public.hotel_room_types where id=(v_item->>'room_type_id')::uuid;
          if v_room_capacity is null or (v_item->>'units_required')::integer not between 1 and 1000
             or jsonb_array_length(v_item->'allocated_guest_counts')<>(v_item->>'units_required')::integer
             or jsonb_array_length(v_item->'pricing_guest_counts')<>(v_item->>'units_required')::integer
             or exists(select 1 from jsonb_array_elements(v_item->'allocated_guest_counts') n(value)
               where jsonb_typeof(n.value)<>'number' or n.value#>>'{}'!~'^[1-9][0-9]*$'
                 or (n.value#>>'{}')::integer>50 or (n.value#>>'{}')::integer>v_room_capacity)
             or exists(select 1 from jsonb_array_elements(v_item->'pricing_guest_counts') n(value)
               where jsonb_typeof(n.value)<>'number' or n.value#>>'{}'!~'^[1-9][0-9]*$'
                 or (n.value#>>'{}')::integer>50 or (n.value#>>'{}')::integer>v_room_capacity) then
            raise exception using errcode='23514',message='hotels_v2_admin_d_allocation_capacity_invalid'; end if;
          if (v_inventory_mode='pooled' and jsonb_array_length(v_item->'unit_ids')<>0)
             or (v_inventory_mode='unitized' and jsonb_array_length(v_item->'unit_ids')<>(v_item->>'units_required')::integer)
             or jsonb_array_length(v_item->'unit_ids')<>(select count(distinct value) from jsonb_array_elements_text(v_item->'unit_ids') unit_value(value))
             or exists(select 1 from jsonb_array_elements_text(v_item->'unit_ids') unit_value(value)
               left join public.hotel_units unit on unit.id=unit_value.value::uuid and unit.room_type_id=(v_item->>'room_type_id')::uuid and unit.status='active'
               where unit.id is null) then
            raise exception using errcode='23514',message='hotels_v2_admin_d_allocation_units_invalid'; end if;
          v_guest_sum:=v_guest_sum+(select sum(value::integer) from jsonb_array_elements_text(v_item->'allocated_guest_counts') n(value));
        end loop;
        if exists(select 1 from jsonb_array_elements(v_payload->'allocations') item(value)
          cross join lateral jsonb_array_elements_text(item.value->'unit_ids') unit_value(value)
          group by unit_value.value having count(*)>1) then
          raise exception using errcode='23514',message='hotels_v2_admin_d_duplicate_allocated_unit'; end if;
        if exists(select 1 from jsonb_array_elements(v_payload->'allocations') item(value)
          join public.hotel_booking_room_allocations allocation on allocation.id=(item.value->>'id')::uuid) then
          raise exception using errcode='23505',message='hotels_v2_admin_d_booking_allocation_id_already_used'; end if;
        if v_guest_sum<>coalesce(v_booking.num_adults,1)+coalesce(v_booking.num_children,0) then
          raise exception using errcode='23514',message='hotels_v2_admin_d_allocation_guest_total_mismatch'; end if;
        select jsonb_set(v_payload,'{allocations}',coalesce(jsonb_agg(item.value order by item.value->>'id'),'[]'::jsonb),true)
          into v_payload from jsonb_array_elements(v_payload->'allocations') item(value);
        select coalesce(jsonb_agg(jsonb_build_object('room_type_id',expected.room_type_id,
          'stay_date',expected.stay_date,'unit_id',expected.unit_id,'units',expected.units,'status','active')
          order by expected.room_type_id,expected.stay_date,expected.unit_id nulls first,expected.units),'[]'::jsonb)
          into v_expected_commitments from(
            select (item.value->>'room_type_id')::uuid room_type_id,day_value::date stay_date,
              null::uuid unit_id,(item.value->>'units_required')::integer units
            from jsonb_array_elements(v_payload->'allocations') item(value)
            cross join generate_series(v_booking.arrival_date,v_booking.departure_date-1,interval '1 day') day_value
            where jsonb_array_length(item.value->'unit_ids')=0
            union all
            select (item.value->>'room_type_id')::uuid,day_value::date,(unit_value.value#>>'{}')::uuid,1
            from jsonb_array_elements(v_payload->'allocations') item(value)
            cross join generate_series(v_booking.arrival_date,v_booking.departure_date-1,interval '1 day') day_value
            cross join lateral jsonb_array_elements(item.value->'unit_ids') unit_value(value)
          ) expected;
        v_operation_changed:=v_original->'allocations' is distinct from v_payload->'allocations'
          or v_original->'commitments' is distinct from v_expected_commitments
          or exists(select 1 from public.hotel_booking_room_allocations allocation
            where allocation.booking_id=v_booking.id and allocation.status='active'
              and allocation.booking_updated_at is distinct from v_booking.updated_at);
      else v_operation_changed:=jsonb_array_length(v_original->'allocations')>0; end if;

    elsif v_entity='hold' and v_action='release' then
      if v_id is null or not public.hotel_v2_admin_d_keys_allowed(v_payload,array['reason'])
         or not public.hotel_v2_admin_d_reason_is_valid(v_payload->'reason') then
        raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_hold_release'; end if;
      select jsonb_build_object('id',hold_row.id,'status',hold_row.status,'expires_at',hold_row.expires_at,
        'version',hold_row.version,'commitments',coalesce((select jsonb_agg(jsonb_build_object(
          'room_type_id',commitment.room_type_id,'stay_date',commitment.stay_date,'unit_id',commitment.unit_id,
          'units',commitment.units,'status',commitment.status) order by commitment.stay_date,commitment.id)
          from public.hotel_inventory_commitments commitment where commitment.hold_id=hold_row.id
            and commitment.status='active'),'[]'::jsonb))
        into v_original from public.hotel_inventory_holds hold_row where hold_row.id=v_id and hold_row.hotel_id=v_hotel_id;
      if v_original is null then raise exception using errcode='PT404',message='hotels_v2_admin_d_hold_not_found'; end if;
      if exists(select 1 from public.hotel_inventory_commitments commitment where commitment.hold_id=v_id
        and commitment.status='active' and commitment.stay_date not between v_from and v_to) then
        raise exception using errcode='22023',message='hotels_v2_admin_d_hold_outside_reviewed_range'; end if;
      v_operation_changed:=v_original->>'status'='active' and jsonb_array_length(v_original->'commitments')>0;
    else
      raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_intent_contract';
    end if;

    if not v_operation_changed then continue; end if;
    v_changed:=true;
    v_operation:=jsonb_build_object('entity',v_entity,'action',v_action,'id',v_id,
      'expected_version',coalesce((v_original->>'availability_version')::bigint,(v_original->>'version')::bigint,0),
      'expected_original',coalesce(v_original,'{}'::jsonb),'payload',v_payload);
    v_operations:=v_operations||jsonb_build_array(v_operation);
    v_impact_rooms:='[]'::jsonb; v_impact_rates:='[]'::jsonb; v_impact_from:=v_from; v_impact_to:=v_to;
    if v_entity='daily_inventory' then v_impact_rooms:=jsonb_build_array(v_payload->'room_type_id'); v_impact_from:=(v_payload->>'stay_date')::date; v_impact_to:=v_impact_from;
    elsif v_entity='unit_calendar_block' then v_impact_rooms:=jsonb_build_array(coalesce(v_payload->'room_type_id',v_original->'room_type_id')); v_impact_from:=coalesce((v_payload->>'from_date')::date,(v_original->>'from_date')::date); v_impact_to:=coalesce((v_payload->>'to_date')::date,(v_original->>'to_date')::date);
    elsif v_entity='operational_override' then v_impact_rates:=jsonb_build_array(coalesce(v_payload->'room_rate_id',v_original->'room_rate_id')); v_impact_rooms:=coalesce((select jsonb_build_array(room_type_id) from public.hotel_room_rates where id=(coalesce(v_payload->>'room_rate_id',v_original->>'room_rate_id'))::uuid),'[]'::jsonb); v_impact_from:=coalesce((v_payload->>'stay_date')::date,(v_original->>'stay_date')::date); v_impact_to:=v_impact_from;
    elsif v_entity='rate_rule_operational_restriction' then
      v_impact_rates:=jsonb_build_array(v_original->'room_rate_id');
      v_impact_rooms:=coalesce((select jsonb_build_array(room_type_id) from public.hotel_room_rates where id=(v_original->>'room_rate_id')::uuid),'[]'::jsonb);
      v_impact_from:=(v_original->>'valid_from')::date; v_impact_to:=(v_original->>'valid_to')::date;
    elsif v_entity='booking_allocation' then
      select least(booking.arrival_date,coalesce((select min((commitment.value->>'stay_date')::date)
          from jsonb_array_elements(v_original->'commitments') commitment(value)),booking.arrival_date)),
        greatest(booking.departure_date-1,coalesce((select max((commitment.value->>'stay_date')::date)
          from jsonb_array_elements(v_original->'commitments') commitment(value)),booking.departure_date-1))
        into v_impact_from,v_impact_to from public.hotel_bookings booking where booking.id=(v_payload->>'booking_id')::uuid;
      if v_action='map' then
        select coalesce(jsonb_agg(distinct item.value->'room_type_id'),'[]'::jsonb),
          coalesce(jsonb_agg(distinct item.value->'room_rate_id'),'[]'::jsonb)
          into v_impact_rooms,v_impact_rates from jsonb_array_elements(v_payload->'allocations') item(value);
      else
        select coalesce(jsonb_agg(distinct item.value->'room_type_id'),'[]'::jsonb),
          coalesce(jsonb_agg(distinct item.value->'room_rate_id'),'[]'::jsonb)
          into v_impact_rooms,v_impact_rates from jsonb_array_elements(v_original->'allocations') item(value);
      end if;
    elsif v_entity='hold' then
      select coalesce(jsonb_agg(distinct to_jsonb(commitment.room_type_id)),'[]'::jsonb),
        min(commitment.stay_date),max(commitment.stay_date)
        into v_impact_rooms,v_impact_from,v_impact_to
      from public.hotel_inventory_commitments commitment
      where commitment.hold_id=v_id and commitment.status='active';
    end if;
    v_impacts:=v_impacts||jsonb_build_array(jsonb_build_object('entity',v_entity,'action',v_action,'id',v_id,
      'changed',true,'affected_room_type_ids',v_impact_rooms,'affected_room_rate_ids',v_impact_rates,
      'from',v_impact_from,'to',v_impact_to));
  end loop;

  if exists(select 1 from jsonb_array_elements(v_operations) a(value)
    group by a.value->>'entity',a.value->>'id' having count(*)>1) then
    raise exception using errcode='22023',message='hotels_v2_admin_d_duplicate_plan_target'; end if;
  if jsonb_array_length(v_operations)>100 then
    raise exception using errcode='22023',message='hotels_v2_admin_d_plan_operation_limit_exceeded'; end if;
  v_plan:=jsonb_build_object('contract_version','hotels_v2_admin_d_availability_plan_v1',
    'hotel_id',v_hotel_id,'from',v_from,'to',v_to,'snapshot_token',v_control->>'snapshot_token',
    'reviewed_at',clock_timestamp(),'operations',v_operations);
  if exists(select 1 from jsonb_array_elements(v_operations) operation(value)
      where octet_length(convert_to((operation.value->'expected_original')::text,'UTF8'))>262144)
     or octet_length(convert_to(v_plan::text,'UTF8'))>10485760 then
    raise exception using errcode='54000',message='hotels_v2_admin_d_review_output_technical_limit_exceeded';
  end if;
  v_fingerprint:=public.hotel_v2_admin_d_hash(v_plan);
  v_plan:=v_plan||jsonb_build_object('plan_fingerprint',v_fingerprint);
  insert into public.hotel_admin_availability_plan_reviews(actor_id,plan_fingerprint,hotel_id,
    reviewed_plan,snapshot_token,expires_at)
  values(auth.uid(),v_fingerprint,v_hotel_id,v_plan,v_control->>'snapshot_token',clock_timestamp()+interval '30 minutes');
  return jsonb_build_object('contract_version','hotels_v2_admin_d_availability_plan_preview_v1',
    'hotel_id',v_hotel_id,'changed',v_changed,'impacts',v_impacts,'blocking_reasons','[]'::jsonb,
    'reviewed_plan',v_plan,'plan_fingerprint',v_fingerprint,'current_control',v_control);
exception when invalid_text_representation or datetime_field_overflow or numeric_value_out_of_range then
  raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_availability_draft';
end
$function$;

create function public.hotel_v2_admin_preview_availability_plan(p_draft jsonb)
returns jsonb language sql security definer set search_path=pg_catalog,public,auth
as $$select public.hotel_v2_admin_d_review_plan(p_draft)$$;

do $admin_d_activity_contract$
declare v_entities text; v_actions text;
begin
  select pg_get_constraintdef(oid,true) into v_entities from pg_constraint
    where conrelid='public.hotel_activity_log'::regclass and conname='hotel_activity_log_entity_type_check';
  select pg_get_constraintdef(oid,true) into v_actions from pg_constraint
    where conrelid='public.hotel_activity_log'::regclass and conname='hotel_activity_log_action_check';
  if v_entities is null or v_entities not like '%daily_inventory%' or v_actions is null or v_actions not like '%delete%' then
    raise exception using errcode='55000',message='hotels_v2_admin_d_activity_contract_mismatch'; end if;
end
$admin_d_activity_contract$;
alter table public.hotel_activity_log drop constraint hotel_activity_log_entity_type_check,
  add constraint hotel_activity_log_entity_type_check check(entity_type in(
    'property','room_type','unit','rate_plan','room_rate','rate_rule','calendar_override',
    'daily_inventory','occupancy_tier','pricing_schedule','allocation_rule',
    'payment_policy','commission_policy','calendar_source','property_pricing_default',
    'unit_calendar_block','rate_rule_operational_restriction','booking_allocation','inventory_hold'));

create function public.hotel_v2_admin_apply_availability_control_plan(
  p_plan jsonb,p_correlation_id uuid,p_idempotency_key text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
declare
  v_actor uuid:=auth.uid(); v_hotel_id uuid; v_from date; v_to date; v_reviewed_at timestamptz;
  v_request_hash text; v_expected_fingerprint text; v_receipt public.hotel_admin_availability_action_receipts%rowtype;
  v_review public.hotel_admin_availability_plan_reviews%rowtype;
  v_control jsonb; v_operation jsonb; v_entity text; v_action text; v_id uuid; v_payload jsonb;
  v_expected bigint; v_before jsonb; v_after jsonb; v_changed boolean:=false; v_op_changed boolean;
  v_activity jsonb:='[]'::jsonb; v_activity_id uuid; v_room_id uuid; v_date date; v_capacity integer;
  v_activity_created_at timestamptz; v_ledger_entity text; v_ledger_action text;
  v_booking public.hotel_bookings%rowtype; v_item jsonb; v_allocation public.hotel_booking_room_allocations%rowtype;
  v_unit_ids uuid[]; v_allocated smallint[]; v_pricing smallint[]; v_units integer; v_day date;
  v_result jsonb; v_reason text;
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_plan is null or jsonb_typeof(p_plan)<>'object' or v_actor is null or p_correlation_id is null
     or not public.hotel_v2_admin_d_uuid_is_canonical(v_actor::text)
     or not public.hotel_v2_admin_d_uuid_is_canonical(p_correlation_id::text)
     or p_idempotency_key is null or p_idempotency_key!~'^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$'
     or not public.hotel_v2_admin_d_keys_allowed(p_plan,array['contract_version','hotel_id','from','to','snapshot_token','reviewed_at','operations','plan_fingerprint'])
     or p_plan->>'contract_version'<>'hotels_v2_admin_d_availability_plan_v1'
     or jsonb_typeof(p_plan->'operations')<>'array'
     or not public.hotel_v2_admin_d_json_dates_are_canonical(p_plan)
     or octet_length(convert_to(p_plan::text,'UTF8'))>10485760
     or exists(select 1 from jsonb_array_elements(case when jsonb_typeof(p_plan->'operations')='array'
       then p_plan->'operations' else '[]'::jsonb end) operation(value)
       where octet_length(convert_to((operation.value->'expected_original')::text,'UTF8'))>262144) then
    raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_availability_plan'; end if;
  v_expected_fingerprint:=public.hotel_v2_admin_d_hash(p_plan-'plan_fingerprint');
  if p_plan->>'plan_fingerprint' is distinct from v_expected_fingerprint then
    raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_plan_fingerprint'; end if;
  begin v_hotel_id:=(p_plan->>'hotel_id')::uuid; v_from:=(p_plan->>'from')::date;
    v_to:=(p_plan->>'to')::date; v_reviewed_at:=(p_plan->>'reviewed_at')::timestamptz;
  exception when others then raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_availability_plan'; end;
  if v_to<v_from or v_to-v_from>364 or (v_to-v_from>61 and exists(
    select 1 from jsonb_array_elements(p_plan->'operations') operation(value)
    where operation.value->>'entity' not in('booking_allocation','hold'))) then
    raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_availability_range'; end if;
  v_request_hash:=public.hotel_v2_admin_d_hash(jsonb_build_object('plan',p_plan,
    'correlation_id',p_correlation_id,'idempotency_key',p_idempotency_key));
  perform pg_advisory_xact_lock(hashtextextended('hotels-v2-admin-d-key:'||v_actor::text||':'||p_idempotency_key,0));
  perform pg_advisory_xact_lock(hashtextextended('hotels-v2-admin-d-correlation:'||p_correlation_id::text,0));
  select * into v_receipt from public.hotel_admin_availability_action_receipts
    where actor_id=v_actor and idempotency_key=p_idempotency_key for update;
  if found then
    if v_receipt.request_hash<>v_request_hash then raise exception using errcode='PT409',message='hotels_v2_admin_d_idempotency_conflict'; end if;
    return jsonb_set(v_receipt.result,'{replayed}','true'::jsonb,true);
  end if;
  if exists(select 1 from public.hotel_admin_availability_action_receipts receipt
      where receipt.correlation_id=p_correlation_id)
     or exists(select 1 from public.hotel_activity_log activity
      where activity.correlation_id=p_correlation_id) then
    raise exception using errcode='PT409',message='hotels_v2_admin_d_correlation_conflict'; end if;
  if v_reviewed_at<clock_timestamp()-interval '30 minutes'
     or v_reviewed_at>clock_timestamp()+interval '5 minutes' then
    raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_review_timestamp'; end if;
  select * into v_review from public.hotel_admin_availability_plan_reviews
    where actor_id=v_actor and plan_fingerprint=v_expected_fingerprint for update;
  if not found or v_review.hotel_id<>v_hotel_id or v_review.reviewed_plan is distinct from p_plan
     or v_review.snapshot_token is distinct from p_plan->>'snapshot_token'
     or v_review.expires_at<=clock_timestamp() or v_review.consumed_at is not null then
    raise exception using errcode='42501',message='hotels_v2_admin_d_review_required'; end if;
  perform 1 from public.hotels where id=v_hotel_id for update;
  if not found then raise exception using errcode='PT404',message='hotels_v2_admin_d_property_not_found'; end if;
  v_control:=public.hotel_v2_admin_d_snapshot(v_hotel_id,v_from,v_to,false);
  if v_control->>'snapshot_token' is distinct from p_plan->>'snapshot_token' then
    raise exception using errcode='PT409',message='hotels_v2_admin_d_stale_availability_snapshot'; end if;
  if exists(select 1 from jsonb_array_elements(p_plan->'operations') operation(value)
    where (operation.value#>'{payload,expires_at}' is not null
        and jsonb_typeof(operation.value#>'{payload,expires_at}')<>'null'
        and (operation.value#>>'{payload,expires_at}')::timestamptz<=statement_timestamp())
      or (operation.value#>'{payload,availability_expires_at}' is not null
        and jsonb_typeof(operation.value#>'{payload,availability_expires_at}')<>'null'
        and (operation.value#>>'{payload,availability_expires_at}')::timestamptz<=statement_timestamp())) then
    raise exception using errcode='PT409',message='hotels_v2_admin_d_expiry_elapsed_since_review';
  end if;

  create temporary table if not exists pg_temp.hotel_admin_d_lock_days(
    room_type_id uuid not null,stay_date date not null,primary key(room_type_id,stay_date)) on commit drop;
  truncate pg_temp.hotel_admin_d_lock_days;
  for v_operation in select value from jsonb_array_elements(p_plan->'operations') loop
    v_entity:=v_operation->>'entity'; v_payload:=v_operation->'payload';
    if v_entity='daily_inventory' then
      insert into pg_temp.hotel_admin_d_lock_days values((v_payload->>'room_type_id')::uuid,(v_payload->>'stay_date')::date) on conflict do nothing;
    elsif v_entity='unit_calendar_block' and v_operation->>'action'<>'disable' then
      insert into pg_temp.hotel_admin_d_lock_days
      select (v_payload->>'room_type_id')::uuid,day_value::date from generate_series(
        (v_payload->>'from_date')::date,(v_payload->>'to_date')::date,interval '1 day') day_value on conflict do nothing;
    elsif v_entity='unit_calendar_block' then
      insert into pg_temp.hotel_admin_d_lock_days
      select block.room_type_id,day_value::date from public.hotel_unit_calendar_blocks block
      cross join generate_series(block.from_date,block.to_date,interval '1 day') day_value where block.id=(v_operation->>'id')::uuid on conflict do nothing;
    elsif v_entity='booking_allocation' then
      select * into v_booking from public.hotel_bookings where id=(v_payload->>'booking_id')::uuid and hotel_id=v_hotel_id;
      if not found or v_booking.arrival_date<v_from or v_booking.departure_date-1>v_to then
        raise exception using errcode='22023',message='hotels_v2_admin_d_booking_outside_reviewed_range'; end if;
      insert into pg_temp.hotel_admin_d_lock_days
        select commitment.room_type_id,commitment.stay_date
        from public.hotel_inventory_commitments commitment
        join public.hotel_booking_room_allocations allocation on allocation.id=commitment.booking_allocation_id
        where allocation.booking_id=v_booking.id and allocation.status='active' and commitment.status='active'
        on conflict do nothing;
      if v_operation->>'action'='map' then
        insert into pg_temp.hotel_admin_d_lock_days
        select (item.value->>'room_type_id')::uuid,day_value::date
        from jsonb_array_elements(v_payload->'allocations') item(value)
        cross join generate_series(v_booking.arrival_date,v_booking.departure_date-1,interval '1 day') day_value on conflict do nothing;
      end if;
    elsif v_entity='hold' then
      insert into pg_temp.hotel_admin_d_lock_days
      select commitment.room_type_id,commitment.stay_date
      from public.hotel_inventory_commitments commitment
      where commitment.hold_id=(v_operation->>'id')::uuid and commitment.status='active'
      order by commitment.room_type_id,commitment.stay_date on conflict do nothing;
    end if;
  end loop;
  insert into public.hotel_inventory_day_locks(hotel_id,room_type_id,stay_date)
    select v_hotel_id,lock_day.room_type_id,lock_day.stay_date from pg_temp.hotel_admin_d_lock_days lock_day
    order by lock_day.room_type_id,lock_day.stay_date on conflict(room_type_id,stay_date) do nothing;
  perform pg_advisory_xact_lock(hashtextextended(target.room_type_id::text||':'||target.stay_date::text,0))
    from pg_temp.hotel_admin_d_lock_days target order by target.room_type_id,target.stay_date;
  perform 1 from public.hotel_inventory_day_locks day_lock join pg_temp.hotel_admin_d_lock_days target
    on target.room_type_id=day_lock.room_type_id and target.stay_date=day_lock.stay_date
    order by day_lock.room_type_id,day_lock.stay_date for update of day_lock;

  for v_operation in select value from jsonb_array_elements(p_plan->'operations') order by value->>'entity',value->>'id' loop
    if jsonb_typeof(v_operation)<>'object' or not public.hotel_v2_admin_d_keys_allowed(v_operation,
      array['entity','action','id','expected_version','expected_original','payload']) then
      raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_operation'; end if;
    v_entity:=v_operation->>'entity'; v_action:=v_operation->>'action'; v_id:=(v_operation->>'id')::uuid;
    v_expected:=(v_operation->>'expected_version')::bigint; v_payload:=v_operation->'payload';
    v_before:=null; v_after:=null; v_op_changed:=false;

    if v_entity='daily_inventory' then
      v_room_id:=(v_payload->>'room_type_id')::uuid; v_date:=(v_payload->>'stay_date')::date;
      select jsonb_build_object('room_type_id',room_type_id,'stay_date',stay_date,'sellable_units',sellable_units,
        'sellable_units_mode',sellable_units_mode,'closed',closed,'closed_mode',closed_mode,'reason',reason,
        'expires_at',expires_at,'version',version) into v_before from public.hotel_daily_inventory
        where room_type_id=v_room_id and stay_date=v_date for update;
      if coalesce((v_before->>'version')::bigint,0)<>v_expected then raise exception using errcode='PT409',message='hotels_v2_admin_d_stale_daily_inventory'; end if;
      if v_action='delete' then
        if v_before is not null then
          delete from public.hotel_daily_inventory where room_type_id=v_room_id and stay_date=v_date;
          v_after:=jsonb_build_object('room_type_id',v_room_id,'stay_date',v_date,
            'reason',v_payload->'reason','deleted',true,'version',(v_before->>'version')::bigint+1);
          v_op_changed:=true;
        end if;
      else
        select case when inventory_mode='unitized' then (select count(*) from public.hotel_units where room_type_id=v_room_id and status='active') else base_inventory_count end
          into v_capacity from public.hotel_room_types where id=v_room_id and hotel_id=v_hotel_id;
        if v_capacity is null or (v_payload->>'sellable_units')::integer>v_capacity then raise exception using errcode='23514',message='hotels_v2_admin_d_inventory_exceeds_physical_capacity'; end if;
        v_control:=public.hotel_v2_admin_d_snapshot(v_hotel_id,v_date,v_date,false);
        if v_payload ? 'sellable_units' and
           coalesce((select least((cell.value->>'physical_capacity')::integer-
                 case when cell.value->>'inventory_mode'='unitized' then (cell.value->>'blocked_unit_count')::integer else 0 end,
               case when v_payload->>'sellable_units_mode'='clear' then (cell.value->>'physical_capacity')::integer
                 else (v_payload->>'sellable_units')::integer end)<(cell.value->>'committed_units')::integer
             from jsonb_array_elements(v_control->'cells') cell(value)
             where (cell.value->>'room_type_id')::uuid=v_room_id),false) then
          raise exception using errcode='PT409',message='hotels_v2_admin_d_capacity_below_commitments'; end if;
        if v_before is null then
          insert into public.hotel_daily_inventory(room_type_id,stay_date,sellable_units,closed,source,reason,expires_at,actor_id,sellable_units_mode,closed_mode,provenance)
          values(v_room_id,v_date,case when not (v_payload?'sellable_units_mode') or v_payload->>'sellable_units_mode'='clear' then 0 else (v_payload->>'sellable_units')::integer end,
            case when v_payload->>'closed_mode'='set' then (v_payload->>'closed')::boolean else false end,'manual',btrim(v_payload->>'reason'),
            case when v_payload->>'expires_at' is null then null else (v_payload->>'expires_at')::timestamptz end,v_actor,
            coalesce(v_payload->>'sellable_units_mode','clear'),coalesce(v_payload->>'closed_mode','clear'),jsonb_build_object('admin_d',true,'correlation_id',p_correlation_id)) returning to_jsonb(hotel_daily_inventory.*) into v_after;
          v_op_changed:=true;
        elsif (v_payload ? 'sellable_units' and (case when v_payload->>'sellable_units_mode'='clear' then v_capacity else (v_payload->>'sellable_units')::integer end) is distinct from (v_before->>'sellable_units')::integer)
          or (v_payload ? 'sellable_units_mode' and v_payload->>'sellable_units_mode' is distinct from v_before->>'sellable_units_mode')
          or (v_payload ? 'closed' and (case when v_payload->>'closed_mode'='clear' then false else (v_payload->>'closed')::boolean end) is distinct from (v_before->>'closed')::boolean)
          or (v_payload ? 'closed_mode' and v_payload->>'closed_mode' is distinct from v_before->>'closed_mode')
          or (v_payload ? 'expires_at' and v_payload->'expires_at' is distinct from v_before->'expires_at') then
          update public.hotel_daily_inventory set
            sellable_units=case when not v_payload?'sellable_units' then sellable_units when v_payload->>'sellable_units_mode'='clear' then v_capacity else (v_payload->>'sellable_units')::integer end,
            sellable_units_mode=coalesce(v_payload->>'sellable_units_mode',sellable_units_mode),
            closed=case when not v_payload?'closed' then closed when v_payload->>'closed_mode'='clear' then false else (v_payload->>'closed')::boolean end,closed_mode=coalesce(v_payload->>'closed_mode',closed_mode),
            reason=btrim(v_payload->>'reason'),expires_at=case when v_payload ? 'expires_at' then (v_payload->>'expires_at')::timestamptz else expires_at end,
            actor_id=v_actor,source='manual',provenance=jsonb_build_object('admin_d',true,'correlation_id',p_correlation_id),
            version=version+1,updated_at=clock_timestamp()
          where room_type_id=v_room_id and stay_date=v_date returning to_jsonb(hotel_daily_inventory.*) into v_after;
          v_op_changed:=true;
        end if;
      end if;
    elsif v_entity='unit_calendar_block' then
      select to_jsonb(block) into v_before from public.hotel_unit_calendar_blocks block where id=v_id and hotel_id=v_hotel_id for update;
      if coalesce((v_before->>'version')::bigint,0)<>v_expected then raise exception using errcode='PT409',message='hotels_v2_admin_d_stale_unit_calendar_block'; end if;
      if v_action='create' then
        insert into public.hotel_unit_calendar_blocks(id,hotel_id,room_type_id,unit_id,from_date,to_date,blocked,reason,expires_at,is_active,actor_id,correlation_id)
        values(v_id,v_hotel_id,(v_payload->>'room_type_id')::uuid,(v_payload->>'unit_id')::uuid,(v_payload->>'from_date')::date,(v_payload->>'to_date')::date,
          coalesce((v_payload->>'blocked')::boolean,true),btrim(v_payload->>'reason'),(v_payload->>'expires_at')::timestamptz,coalesce((v_payload->>'is_active')::boolean,true),v_actor,p_correlation_id)
        returning to_jsonb(hotel_unit_calendar_blocks.*) into v_after; v_op_changed:=true;
      elsif v_action='disable' then
        if (v_before->>'is_active')::boolean then update public.hotel_unit_calendar_blocks set is_active=false,
          reason=btrim(v_payload->>'reason'),version=version+1,updated_at=clock_timestamp(),actor_id=v_actor,
          correlation_id=p_correlation_id where id=v_id returning to_jsonb(hotel_unit_calendar_blocks.*) into v_after;
          v_op_changed:=true; end if;
      else
        if (v_payload?'from_date' and v_payload->'from_date' is distinct from v_before->'from_date')
           or (v_payload?'to_date' and v_payload->'to_date' is distinct from v_before->'to_date')
           or (v_payload?'blocked' and v_payload->'blocked' is distinct from v_before->'blocked')
           or (v_payload?'reason' and v_payload->'reason' is distinct from v_before->'reason')
           or (v_payload?'expires_at' and v_payload->'expires_at' is distinct from v_before->'expires_at')
           or (v_payload?'is_active' and v_payload->'is_active' is distinct from v_before->'is_active') then
          update public.hotel_unit_calendar_blocks set from_date=coalesce((v_payload->>'from_date')::date,from_date),to_date=coalesce((v_payload->>'to_date')::date,to_date),blocked=coalesce((v_payload->>'blocked')::boolean,blocked),reason=coalesce(btrim(v_payload->>'reason'),reason),expires_at=case when v_payload?'expires_at' then (v_payload->>'expires_at')::timestamptz else expires_at end,is_active=coalesce((v_payload->>'is_active')::boolean,is_active),version=version+1,updated_at=clock_timestamp(),actor_id=v_actor,correlation_id=p_correlation_id where id=v_id returning to_jsonb(hotel_unit_calendar_blocks.*) into v_after;
          v_op_changed:=true;
        end if;
      end if;
    elsif v_entity='operational_override' then
      select jsonb_build_object('id',id,'room_rate_id',room_rate_id,'stay_date',stay_date,
        'availability_version',availability_version,'availability_reason',case when availability_updated_at is null then
          case when closed_mode is not null or closed_to_arrival_mode is not null or closed_to_departure_mode is not null then reason end
          else availability_reason end,
        'availability_active',case when availability_updated_at is null then
          (closed_mode is not null or closed_to_arrival_mode is not null or closed_to_departure_mode is not null) and is_active
          else availability_active end,
        'availability_expires_at',case when availability_updated_at is null then
          case when closed_mode is not null or closed_to_arrival_mode is not null or closed_to_departure_mode is not null then expires_at end
          else availability_expires_at end,
        'closed',closed,'closed_mode',closed_mode,
        'closed_to_arrival',closed_to_arrival,'closed_to_arrival_mode',closed_to_arrival_mode,
        'closed_to_departure',closed_to_departure,'closed_to_departure_mode',closed_to_departure_mode)
        into v_before from public.hotel_calendar_overrides where id=v_id and hotel_id=v_hotel_id for update;
      if coalesce((v_before->>'availability_version')::bigint,0)<>v_expected then raise exception using errcode='PT409',message='hotels_v2_admin_d_stale_operational_override'; end if;
      if v_action='create' then
        insert into public.hotel_calendar_overrides(id,hotel_id,room_rate_id,stay_date,closed,closed_mode,
          closed_to_arrival,closed_to_arrival_mode,closed_to_departure,closed_to_departure_mode,
          reason,actor_id,source,is_active,provenance,availability_active,availability_expires_at,
          availability_reason,availability_actor_id,availability_correlation_id,availability_updated_at)
        values(v_id,v_hotel_id,(v_payload->>'room_rate_id')::uuid,(v_payload->>'stay_date')::date,
          case when v_payload->>'closed_mode'='clear' then null else (v_payload->>'closed')::boolean end,v_payload->>'closed_mode',
          case when v_payload->>'closed_to_arrival_mode'='clear' then null else (v_payload->>'closed_to_arrival')::boolean end,v_payload->>'closed_to_arrival_mode',
          case when v_payload->>'closed_to_departure_mode'='clear' then null else (v_payload->>'closed_to_departure')::boolean end,v_payload->>'closed_to_departure_mode',
          btrim(v_payload->>'reason'),v_actor,'manual',true,jsonb_build_object('admin_d',true),
          coalesce((v_payload->>'availability_active')::boolean,true),(v_payload->>'availability_expires_at')::timestamptz,
          btrim(v_payload->>'reason'),v_actor,p_correlation_id,clock_timestamp()) returning to_jsonb(hotel_calendar_overrides.*) into v_after; v_op_changed:=true;
      elsif v_action='disable' then
        if (v_before->>'availability_active')::boolean then update public.hotel_calendar_overrides set availability_active=false,availability_reason=btrim(v_payload->>'reason'),availability_version=availability_version+1,availability_actor_id=v_actor,availability_correlation_id=p_correlation_id,availability_updated_at=clock_timestamp() where id=v_id returning to_jsonb(hotel_calendar_overrides.*) into v_after; v_op_changed:=true; end if;
      else
        if (v_payload?'closed_mode' and (v_payload->>'closed_mode' is distinct from v_before->>'closed_mode'
              or case when v_payload->>'closed_mode'='clear' then null else (v_payload->>'closed')::boolean end is distinct from (v_before->>'closed')::boolean))
           or (v_payload?'closed_to_arrival_mode' and (v_payload->>'closed_to_arrival_mode' is distinct from v_before->>'closed_to_arrival_mode'
              or case when v_payload->>'closed_to_arrival_mode'='clear' then null else (v_payload->>'closed_to_arrival')::boolean end is distinct from (v_before->>'closed_to_arrival')::boolean))
           or (v_payload?'closed_to_departure_mode' and (v_payload->>'closed_to_departure_mode' is distinct from v_before->>'closed_to_departure_mode'
              or case when v_payload->>'closed_to_departure_mode'='clear' then null else (v_payload->>'closed_to_departure')::boolean end is distinct from (v_before->>'closed_to_departure')::boolean))
           or (v_payload?'availability_active' and (v_payload->>'availability_active')::boolean is distinct from (v_before->>'availability_active')::boolean)
           or (v_payload?'availability_expires_at' and v_payload->'availability_expires_at' is distinct from v_before->'availability_expires_at') then
          update public.hotel_calendar_overrides set
          closed=case when v_payload?'closed_mode' then case when v_payload->>'closed_mode'='clear' then null else (v_payload->>'closed')::boolean end else closed end,
          closed_mode=case when v_payload?'closed_mode' then v_payload->>'closed_mode' else closed_mode end,
          closed_to_arrival=case when v_payload?'closed_to_arrival_mode' then case when v_payload->>'closed_to_arrival_mode'='clear' then null else (v_payload->>'closed_to_arrival')::boolean end else closed_to_arrival end,
          closed_to_arrival_mode=case when v_payload?'closed_to_arrival_mode' then v_payload->>'closed_to_arrival_mode' else closed_to_arrival_mode end,
          closed_to_departure=case when v_payload?'closed_to_departure_mode' then case when v_payload->>'closed_to_departure_mode'='clear' then null else (v_payload->>'closed_to_departure')::boolean end else closed_to_departure end,
          closed_to_departure_mode=case when v_payload?'closed_to_departure_mode' then v_payload->>'closed_to_departure_mode' else closed_to_departure_mode end,
          availability_active=case when v_payload?'availability_active' then (v_payload->>'availability_active')::boolean else (v_before->>'availability_active')::boolean end,
          availability_expires_at=case when v_payload?'availability_expires_at' then (v_payload->>'availability_expires_at')::timestamptz else (v_before->>'availability_expires_at')::timestamptz end,
          availability_reason=btrim(v_payload->>'reason'),availability_version=availability_version+1,
          availability_actor_id=v_actor,availability_correlation_id=p_correlation_id,availability_updated_at=clock_timestamp()
          where id=v_id returning to_jsonb(hotel_calendar_overrides.*) into v_after; v_op_changed:=true;
        end if;
      end if;
    elsif v_entity='rate_rule_operational_restriction' then
      select jsonb_build_object('id',rule.id,'room_rate_id',rule.room_rate_id,
        'valid_from',rule.valid_from,'valid_to',rule.valid_to,'weekdays',rule.weekdays,
        'priority',rule.priority,'is_active',rule.is_active,
        'closed_to_arrival',rule.closed_to_arrival,'closed_to_departure',rule.closed_to_departure,
        'availability_reason',rule.availability_reason,'availability_version',rule.availability_version) into v_before from public.hotel_rate_rules rule
        join public.hotel_room_rates rate on rate.id=rule.room_rate_id where rule.id=v_id and rate.hotel_id=v_hotel_id for update of rule;
      if (v_before->>'availability_version')::bigint<>v_expected
         or v_before is distinct from v_operation->'expected_original' then
        raise exception using errcode='PT409',message='hotels_v2_admin_d_stale_rate_rule_restriction'; end if;
      if (v_action='clear' and ((v_before->>'closed_to_arrival')::boolean or (v_before->>'closed_to_departure')::boolean))
        or (v_action='update' and ((v_payload?'closed_to_arrival' and (v_payload->>'closed_to_arrival')::boolean is distinct from (v_before->>'closed_to_arrival')::boolean) or (v_payload?'closed_to_departure' and (v_payload->>'closed_to_departure')::boolean is distinct from (v_before->>'closed_to_departure')::boolean))) then
        update public.hotel_rate_rules set closed_to_arrival=case when v_action='clear' then false else coalesce((v_payload->>'closed_to_arrival')::boolean,closed_to_arrival) end,closed_to_departure=case when v_action='clear' then false else coalesce((v_payload->>'closed_to_departure')::boolean,closed_to_departure) end,availability_reason=btrim(v_payload->>'reason'),availability_actor_id=v_actor,availability_correlation_id=p_correlation_id,availability_updated_at=clock_timestamp(),availability_version=availability_version+1 where id=v_id returning to_jsonb(hotel_rate_rules.*) into v_after; v_op_changed:=true;
      end if;
    elsif v_entity='hold' then
      select jsonb_build_object('id',hold_row.id,'status',hold_row.status,'expires_at',hold_row.expires_at,
        'version',hold_row.version,'commitments',coalesce((select jsonb_agg(jsonb_build_object(
          'room_type_id',commitment.room_type_id,'stay_date',commitment.stay_date,'unit_id',commitment.unit_id,
          'units',commitment.units,'status',commitment.status) order by commitment.stay_date,commitment.id)
          from public.hotel_inventory_commitments commitment where commitment.hold_id=hold_row.id
            and commitment.status='active'),'[]'::jsonb)) into v_before
        from public.hotel_inventory_holds hold_row where hold_row.id=v_id and hold_row.hotel_id=v_hotel_id for update;
      if (v_before->>'version')::bigint<>v_expected or v_before is distinct from v_operation->'expected_original' then
        raise exception using errcode='PT409',message='hotels_v2_admin_d_stale_hold'; end if;
      if v_before->>'status'='active' then update public.hotel_inventory_commitments set status='released',version=version+1,updated_at=clock_timestamp() where hold_id=v_id and status='active'; update public.hotel_inventory_holds set status='released',released_at=clock_timestamp(),release_reason=btrim(v_payload->>'reason'),version=version+1,updated_at=clock_timestamp() where id=v_id returning to_jsonb(hotel_inventory_holds.*) into v_after; v_op_changed:=true; end if;
    elsif v_entity='booking_allocation' then
      select * into v_booking from public.hotel_bookings where id=(v_payload->>'booking_id')::uuid and hotel_id=v_hotel_id for update;
      if not found then raise exception using errcode='PT404',message='hotels_v2_admin_d_booking_not_found'; end if;
      if v_action='map' and v_booking.updated_at is distinct from (v_payload->>'booking_updated_at')::timestamptz then raise exception using errcode='PT409',message='hotels_v2_admin_d_booking_stale'; end if;
      if v_action='map' and v_booking.status not in('pending','confirmed') then raise exception using errcode='23514',message='hotels_v2_admin_d_booking_mapping_required'; end if;
      select jsonb_build_object('booking_id',v_booking.id,'booking_updated_at',v_booking.updated_at,
        'arrival_date',v_booking.arrival_date,'departure_date',v_booking.departure_date,'status',v_booking.status,
        'num_adults',coalesce(v_booking.num_adults,1),'num_children',coalesce(v_booking.num_children,0),
        'allocations',coalesce((select jsonb_agg(jsonb_build_object('id',allocation.id,
          'room_type_id',allocation.room_type_id,'rate_plan_id',allocation.rate_plan_id,
          'room_rate_id',allocation.room_rate_id,'unit_ids',allocation.unit_ids,
          'units_required',allocation.units_required,'allocated_guest_counts',allocation.allocated_guest_counts,
          'pricing_guest_counts',allocation.pricing_guest_counts) order by allocation.id)
          from public.hotel_booking_room_allocations allocation
          where allocation.booking_id=v_booking.id and allocation.status='active'),'[]'::jsonb),
        'commitments',coalesce((select jsonb_agg(jsonb_build_object('room_type_id',commitment.room_type_id,
          'stay_date',commitment.stay_date,'unit_id',commitment.unit_id,'units',commitment.units,
          'status',commitment.status) order by commitment.room_type_id,commitment.stay_date,
            commitment.unit_id nulls first,commitment.units)
          from public.hotel_inventory_commitments commitment join public.hotel_booking_room_allocations allocation
            on allocation.id=commitment.booking_allocation_id
          where allocation.booking_id=v_booking.id and allocation.status='active' and commitment.status='active'),'[]'::jsonb)) into v_before;
      if v_before is distinct from v_operation->'expected_original' then
        raise exception using errcode='PT409',message='hotels_v2_admin_d_stale_booking_allocation'; end if;
      if v_action='release' then
        if exists(select 1 from public.hotel_booking_room_allocations where booking_id=v_booking.id and status='active') then
          update public.hotel_inventory_commitments set status='released',version=version+1,updated_at=clock_timestamp() where booking_allocation_id in(select id from public.hotel_booking_room_allocations where booking_id=v_booking.id and status='active') and status='active';
          update public.hotel_booking_room_allocations set status='released',released_at=clock_timestamp(),release_reason=btrim(v_payload->>'reason'),version=version+1,updated_at=clock_timestamp() where booking_id=v_booking.id and status='active'; v_op_changed:=true;
        end if;
      elsif v_action='map' then
        -- Preview proved semantic difference. Replace only this booking's explicit mapping; booking row remains byte-exact.
        update public.hotel_inventory_commitments set status='released',version=version+1,updated_at=clock_timestamp() where booking_allocation_id in(select id from public.hotel_booking_room_allocations where booking_id=v_booking.id and status='active') and status='active';
        update public.hotel_booking_room_allocations set status='released',released_at=clock_timestamp(),release_reason='replaced_by_reviewed_mapping',version=version+1,updated_at=clock_timestamp() where booking_id=v_booking.id and status='active';
        for v_item in select value from jsonb_array_elements(v_payload->'allocations') loop
          if not public.hotel_v2_admin_d_keys_allowed(v_item,array['id','room_type_id','rate_plan_id','room_rate_id','unit_ids','units_required','allocated_guest_counts','pricing_guest_counts']) then raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_booking_allocation'; end if;
          v_unit_ids:=array(select value::uuid from jsonb_array_elements_text(v_item->'unit_ids'));
          v_allocated:=array(select value::smallint from jsonb_array_elements_text(v_item->'allocated_guest_counts'));
          v_pricing:=array(select value::smallint from jsonb_array_elements_text(v_item->'pricing_guest_counts'));
          v_units:=(v_item->>'units_required')::integer;
          insert into public.hotel_booking_room_allocations(id,booking_id,hotel_id,room_type_id,rate_plan_id,room_rate_id,unit_ids,units_required,allocated_guest_counts,pricing_guest_counts,booking_updated_at,actor_id,correlation_id)
          values((v_item->>'id')::uuid,v_booking.id,v_hotel_id,(v_item->>'room_type_id')::uuid,(v_item->>'rate_plan_id')::uuid,(v_item->>'room_rate_id')::uuid,v_unit_ids,v_units,v_allocated,v_pricing,v_booking.updated_at,v_actor,p_correlation_id) returning * into v_allocation;
          for v_day in select generate_series(v_booking.arrival_date::timestamp,(v_booking.departure_date-1)::timestamp,interval '1 day')::date loop
            insert into public.hotel_inventory_day_locks(hotel_id,room_type_id,stay_date) values(v_hotel_id,v_allocation.room_type_id,v_day) on conflict(room_type_id,stay_date) do nothing;
            perform 1 from public.hotel_inventory_day_locks where room_type_id=v_allocation.room_type_id and stay_date=v_day for update;
            v_control:=public.hotel_v2_admin_d_snapshot(v_hotel_id,v_day,v_day,false);
            if coalesce((select (cell.value->>'available_units')::integer from jsonb_array_elements(v_control->'cells') cell(value) where (cell.value->>'room_type_id')::uuid=v_allocation.room_type_id),0)<v_units then raise exception using errcode='PT409',message='hotels_v2_admin_d_insufficient_availability'; end if;
            if cardinality(v_unit_ids)=0 then insert into public.hotel_inventory_commitments(hotel_id,room_type_id,stay_date,booking_allocation_id,units) values(v_hotel_id,v_allocation.room_type_id,v_day,v_allocation.id,v_units);
            else for v_room_id in select unnest(v_unit_ids) loop insert into public.hotel_inventory_commitments(hotel_id,room_type_id,stay_date,booking_allocation_id,unit_id,units) values(v_hotel_id,v_allocation.room_type_id,v_day,v_allocation.id,v_room_id,1); end loop; end if;
          end loop;
        end loop; v_after:=jsonb_build_object('booking_id',v_booking.id,'booking_updated_at',v_booking.updated_at,
          'allocations',v_payload->'allocations'); v_op_changed:=true;
      end if;
    else raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_operation_contract'; end if;

    if v_op_changed then
      v_before:=public.hotel_v2_admin_d_audit_state(v_entity,v_before);
      v_after:=public.hotel_v2_admin_d_audit_state(v_entity,coalesce(v_after,
        case when v_entity='booking_allocation' then jsonb_build_object('booking_id',v_booking.id,
          'booking_updated_at',v_booking.updated_at,'allocations','[]'::jsonb) else null end));
      v_activity_id:=case when v_entity='daily_inventory' then public.hotel_v2_admin_d_deterministic_uuid(v_room_id::text||':'||v_date::text) else v_id end;
      v_ledger_entity:=case when v_entity='operational_override' then 'calendar_override' when v_entity='hold' then 'inventory_hold' else v_entity end;
      v_ledger_action:=case
        when v_entity='daily_inventory' and v_action='delete' then 'delete'
        when v_entity='daily_inventory' and v_action='upsert' and v_expected=0 then 'create'
        when v_action in('create','map') then 'create'
        when v_action in('disable','release','clear') then 'disable'
        else 'update' end;
      insert into public.hotel_activity_log(hotel_id,entity_type,entity_id,action,before_state,after_state,actor_type,actor_id,source,correlation_id)
      values(v_hotel_id,v_ledger_entity,v_activity_id,v_ledger_action,
        v_before,v_after,'admin',v_actor,'hotels_v2_admin_d_availability_control',p_correlation_id)
      returning id,created_at into v_activity_id,v_activity_created_at;
      v_activity:=v_activity||jsonb_build_array(jsonb_build_object('id',v_activity_id,
        'entity_type',v_ledger_entity,'entity_id',case when v_entity='daily_inventory' then public.hotel_v2_admin_d_deterministic_uuid(v_room_id::text||':'||v_date::text) else v_id end,
        'action',v_ledger_action,
        'before_state',case when v_before is null then null else jsonb_build_object('fingerprint',public.hotel_v2_admin_d_hash(v_before),'redacted',true) end,
        'after_state',case when v_after is null then null else jsonb_build_object('fingerprint',public.hotel_v2_admin_d_hash(v_after),'redacted',true) end,
        'actor_type','admin','source','hotels_v2_admin_d_availability_control',
        'correlation_id',p_correlation_id,'created_at',v_activity_created_at));
      v_changed:=true;
    end if;
  end loop;
  if jsonb_array_length(v_activity)<>jsonb_array_length(p_plan->'operations') then
    raise exception using errcode='PT409',message='hotels_v2_admin_d_reviewed_operation_state_changed'; end if;
  v_result:=jsonb_build_object('contract_version','hotels_v2_admin_d_availability_apply_result_v1',
    'hotel_id',v_hotel_id,'correlation_id',p_correlation_id,'idempotency_key',p_idempotency_key,
    'replayed',false,'changed',v_changed,'activity',v_activity,
    'availability_control',public.hotel_v2_admin_d_snapshot(v_hotel_id,v_from,v_to,false));
  insert into public.hotel_admin_availability_action_receipts(actor_id,hotel_id,correlation_id,idempotency_key,request_hash,result)
  values(v_actor,v_hotel_id,p_correlation_id,p_idempotency_key,v_request_hash,v_result);
  update public.hotel_admin_availability_plan_reviews set consumed_at=clock_timestamp(),correlation_id=p_correlation_id
    where actor_id=v_actor and plan_fingerprint=v_expected_fingerprint;
  return v_result;
exception when unique_violation then
  raise exception using errcode='PT409',message='hotels_v2_admin_d_concurrent_availability_conflict';
end
$function$;

create function public.hotel_v2_admin_preview_stay(p_request jsonb)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
declare
  v_hotel_id uuid; v_arrival date; v_departure date; v_pricing_request jsonb;
  v_pricing jsonb; v_pricing_control jsonb; v_control jsonb; v_rooms jsonb; v_blockers jsonb:='[]'::jsonb;
  v_available boolean:=true; v_product jsonb; v_nights jsonb; v_room_blockers jsonb;
  v_rate public.hotel_room_rates%rowtype; v_selected_room uuid; v_selected_plan uuid;
  v_units integer;
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_request is null or jsonb_typeof(p_request)<>'object'
     or not public.hotel_v2_admin_d_keys_allowed(p_request,array['contract_version','hotel_id','arrival_date','departure_date',
       'adults','child_ages','room_type_id','room_rate_id','rate_plan_id','allocation_rule_id','availability_snapshot_token'])
     or p_request->>'contract_version'<>'hotels_v2_admin_d_stay_preview_request_v1'
     or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(p_request)
     or not public.hotel_v2_admin_d_json_dates_are_canonical(p_request) then
    raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_stay_preview'; end if;
  begin v_hotel_id:=(p_request->>'hotel_id')::uuid; v_arrival:=(p_request->>'arrival_date')::date;
    v_departure:=(p_request->>'departure_date')::date;
  exception when others then raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_stay_preview'; end;
  if v_departure<=v_arrival or v_departure-v_arrival>365 then
    raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_stay_preview_range'; end if;
  v_control:=public.hotel_v2_admin_d_snapshot(v_hotel_id,v_arrival,v_departure,false);
  if p_request->>'availability_snapshot_token' is distinct from v_control->>'snapshot_token' then
    raise exception using errcode='PT409',message='hotels_v2_admin_d_stale_availability_snapshot'; end if;
  v_selected_room:=case when p_request->>'room_type_id' is null then null else (p_request->>'room_type_id')::uuid end;
  v_selected_plan:=case when p_request->>'rate_plan_id' is null then null else (p_request->>'rate_plan_id')::uuid end;
  if p_request->>'room_rate_id' is not null then
    select * into v_rate from public.hotel_room_rates where id=(p_request->>'room_rate_id')::uuid and hotel_id=v_hotel_id;
    if not found or (v_selected_room is not null and v_selected_room<>v_rate.room_type_id)
       or (v_selected_plan is not null and v_selected_plan<>v_rate.rate_plan_id) then
      raise exception using errcode='23503',message='hotels_v2_admin_d_foreign_room_rate'; end if;
    v_selected_room:=v_rate.room_type_id; v_selected_plan:=v_rate.rate_plan_id;
  end if;
  v_pricing_control:=public.hotel_v2_admin_get_pricing_control(v_hotel_id);
  v_pricing_request:=jsonb_build_object('contract_version','hotels_v2_admin_c_pricing_preview_v1',
    'hotel_id',v_hotel_id,'snapshot_token',v_pricing_control->>'snapshot_token',
    'rate_plan_id',v_selected_plan,'allocation_rule_id',p_request->'allocation_rule_id',
    'selected_room_type_id',v_selected_room,'check_in',v_arrival,'check_out',v_departure,
    'adults',p_request->'adults','child_ages',coalesce(p_request->'child_ages','[]'::jsonb));
  v_pricing:=public.hotel_v2_admin_preview_pricing_quote(v_pricing_request);
  v_rooms:='[]'::jsonb;
  for v_product in select value from jsonb_array_elements(coalesce(v_pricing->'products','[]'::jsonb))
    order by value->>'room_type_id',value->>'room_rate_id',(value->>'unit_sequence')::integer loop
    select count(*)::integer into v_units from jsonb_array_elements(coalesce(v_pricing->'products','[]'::jsonb)) sibling(value)
      where sibling.value->>'room_type_id'=v_product->>'room_type_id';
    select coalesce(jsonb_agg(cell.value||jsonb_build_object('product',(select product_cell.value
      from jsonb_array_elements(v_control->'product_cells') product_cell(value)
      where product_cell.value->>'room_rate_id'=v_product->>'room_rate_id'
        and product_cell.value->>'stay_date'=cell.value->>'stay_date' limit 1))
      order by cell.value->>'stay_date'),'[]'::jsonb) into v_nights
    from jsonb_array_elements(v_control->'cells') cell(value)
    where cell.value->>'room_type_id'=v_product->>'room_type_id' and (cell.value->>'stay_date')::date<v_departure;
    select coalesce(jsonb_agg(distinct reason.value),'[]'::jsonb) into v_room_blockers
    from jsonb_array_elements(v_nights) night(value)
    cross join lateral jsonb_array_elements_text(night.value->'blocking_reasons') reason(value);
    if jsonb_array_length(v_nights)<>(v_departure-v_arrival)
       or exists(select 1 from jsonb_array_elements(v_nights) cell(value) where (cell.value->>'available_units')::integer<v_units) then
      v_available:=false; v_room_blockers:=v_room_blockers||'["insufficient_availability"]'::jsonb;
    end if;
    if exists(select 1 from jsonb_array_elements(v_control->'product_cells') product_cell(value)
      where product_cell.value->>'room_rate_id'=v_product->>'room_rate_id' and (
        ((product_cell.value->>'stay_date')::date>=v_arrival and (product_cell.value->>'stay_date')::date<v_departure
          and ((product_cell.value->>'operational_closed')::boolean or (product_cell.value->>'safety_closed')::boolean))
        or ((product_cell.value->>'stay_date')::date=v_arrival and (product_cell.value->>'closed_to_arrival')::boolean)
        or ((product_cell.value->>'stay_date')::date=v_departure and (product_cell.value->>'closed_to_departure')::boolean))) then
      v_available:=false; v_room_blockers:=v_room_blockers||'["product_restriction_blocked"]'::jsonb;
    end if;
    select coalesce(jsonb_agg(value order by value),'[]'::jsonb) into v_room_blockers
      from(select distinct value from jsonb_array_elements_text(v_room_blockers) reason(value)) unique_reason;
    v_rooms:=v_rooms||jsonb_build_array(jsonb_build_object('room_type_id',v_product->'room_type_id',
      'room_rate_id',v_product->'room_rate_id','rate_plan_id',v_product->'rate_plan_id',
      'unit_sequence',v_product->'unit_sequence',
      'nights',v_nights,'departure_boundary_product',(select product_cell.value
        from jsonb_array_elements(v_control->'product_cells') product_cell(value)
        where product_cell.value->>'room_rate_id'=v_product->>'room_rate_id'
          and (product_cell.value->>'stay_date')::date=v_departure limit 1),
      'requestable',false,'blocking_reasons',v_room_blockers));
  end loop;
  if exists(select 1 from jsonb_array_elements(v_control->'unmapped_booking_blockers') blocker(value)
    where (blocker.value->>'arrival_date')::date<v_departure
      and (blocker.value->>'departure_date')::date>v_arrival) then
    v_available:=false; v_blockers:=v_blockers||'["unmapped_bookings_require_allocation"]'::jsonb; end if;
  if not coalesce((v_pricing->>'ok')::boolean,false) then v_available:=false;
    v_blockers:=v_blockers||'["pricing_configuration_blocked"]'::jsonb; end if;
  if not v_available then v_blockers:=v_blockers||'["insufficient_availability"]'::jsonb; end if;
  v_blockers:=v_blockers||'["public_activation_off"]'::jsonb;
  select coalesce(jsonb_agg(value order by value),'[]'::jsonb) into v_blockers
    from(select distinct value from jsonb_array_elements_text(v_blockers) reason(value)) unique_reason;
  return jsonb_build_object('contract_version','hotels_v2_admin_d_available_stay_preview_v1',
    'hotel_id',v_hotel_id,'pricing',v_pricing,'availability',jsonb_build_object(
      'snapshot_token',v_control->>'snapshot_token','rooms',v_rooms,
      'requested_units',jsonb_array_length(coalesce(v_pricing->'products','[]'::jsonb)),
      'available_for_stay',v_available),'ok',coalesce((v_pricing->>'ok')::boolean,false) and v_available,
    'requestable',false,'blocking_reasons',v_blockers,
    'configuration_fingerprint',public.hotel_v2_admin_d_hash(jsonb_build_object(
      'pricing',v_pricing->>'snapshot_token','availability',v_control->>'snapshot_token')),
    'public_change',false);
end
$function$;

alter table public.hotel_unit_calendar_blocks owner to postgres;
alter table public.hotel_inventory_day_locks owner to postgres;
alter table public.hotel_inventory_holds owner to postgres;
alter table public.hotel_booking_room_allocations owner to postgres;
alter table public.hotel_inventory_commitments owner to postgres;
alter table public.hotel_admin_availability_action_receipts owner to postgres;
alter table public.hotel_admin_availability_plan_reviews owner to postgres;
alter table public.hotel_admin_availability_foundation_receipts owner to postgres;

alter function public.hotel_v2_admin_d_keys_allowed(jsonb,text[]) owner to postgres;
alter function public.hotel_v2_admin_d_protected_fingerprints() owner to postgres;
alter function public.hotel_v2_admin_d_hash(jsonb) owner to postgres;
alter function public.hotel_v2_admin_d_uuid_is_canonical(text) owner to postgres;
alter function public.hotel_v2_admin_d_deterministic_uuid(text) owner to postgres;
alter function public.hotel_v2_admin_d_reason_is_valid(jsonb) owner to postgres;
alter function public.hotel_v2_admin_d_json_dates_are_canonical(jsonb) owner to postgres;
alter function public.hotel_v2_admin_d_validate_shared_availability_fields() owner to postgres;
alter function public.hotel_v2_admin_d_audit_state(text,jsonb) owner to postgres;
alter function public.hotel_v2_admin_d_immutable_row() owner to postgres;
alter function public.hotel_v2_admin_d_plan_review_consume_guard() owner to postgres;
alter function public.hotel_v2_admin_d_validate_unit_block() owner to postgres;
alter function public.hotel_v2_admin_d_validate_allocation() owner to postgres;
alter function public.hotel_v2_admin_d_validate_commitment() owner to postgres;
alter function public.hotel_v2_admin_d_validate_allocation_topology() owner to postgres;
alter function public.hotel_v2_admin_d_validate_hold_topology() owner to postgres;
alter function public.hotel_v2_admin_d_validate_hold_update() owner to postgres;
alter function public.hotel_v2_admin_d_validate_room_availability_change() owner to postgres;
alter function public.hotel_v2_admin_d_validate_unit_availability_change() owner to postgres;
alter function public.hotel_v2_admin_d_snapshot(uuid,date,date,boolean) owner to postgres;
alter function public.hotel_v2_admin_d_review_plan(jsonb) owner to postgres;
alter function public.hotel_v2_admin_get_availability_control(uuid,date,date) owner to postgres;
alter function public.hotel_v2_admin_preview_availability_plan(jsonb) owner to postgres;
alter function public.hotel_v2_admin_apply_availability_control_plan(jsonb,uuid,text) owner to postgres;
alter function public.hotel_v2_admin_preview_stay(jsonb) owner to postgres;

revoke all on function public.hotel_v2_admin_d_keys_allowed(jsonb,text[]) from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_d_protected_fingerprints() from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_d_hash(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_d_uuid_is_canonical(text) from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_d_deterministic_uuid(text) from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_d_reason_is_valid(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_d_json_dates_are_canonical(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_d_validate_shared_availability_fields() from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_d_audit_state(text,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_d_immutable_row() from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_d_plan_review_consume_guard() from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_d_validate_unit_block() from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_d_validate_allocation() from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_d_validate_commitment() from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_d_validate_allocation_topology() from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_d_validate_hold_topology() from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_d_validate_hold_update() from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_d_validate_room_availability_change() from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_d_validate_unit_availability_change() from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_d_snapshot(uuid,date,date,boolean) from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_d_review_plan(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_get_availability_control(uuid,date,date) from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_preview_availability_plan(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_apply_availability_control_plan(jsonb,uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_preview_stay(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_apply_calendar_plan(jsonb,uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_resolve_rate(uuid,date,date,integer)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_get_calendar(uuid,date,date)
  from public,anon,authenticated,service_role;
grant execute on function public.hotel_v2_admin_get_availability_control(uuid,date,date) to authenticated;
grant execute on function public.hotel_v2_admin_preview_availability_plan(jsonb) to authenticated;
grant execute on function public.hotel_v2_admin_apply_availability_control_plan(jsonb,uuid,text) to authenticated;
grant execute on function public.hotel_v2_admin_preview_stay(jsonb) to authenticated;

do $admin_d_postcondition$
declare v_name text;
begin
  if exists(select 1 from unnest(array['hotel_unit_calendar_blocks','hotel_inventory_day_locks',
      'hotel_inventory_holds','hotel_booking_room_allocations','hotel_inventory_commitments',
      'hotel_admin_availability_action_receipts','hotel_admin_availability_plan_reviews',
      'hotel_admin_availability_foundation_receipts']) v(name)
    cross join unnest(array['anon','authenticated','service_role']) role_name(name)
    cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege_name(name)
    where has_table_privilege(role_name.name,'public.'||v.name,privilege_name.name)) then
    raise exception using errcode='55000',message='hotels_v2_admin_d_raw_table_acl_failed'; end if;
  if exists(select 1 from unnest(array['hotel_room_types','hotel_units','hotel_rate_plans','hotel_room_rates',
      'hotel_rate_rules','hotel_daily_inventory','hotel_daily_rates','hotel_calendar_overrides']) v(name)
    cross join unnest(array['anon','authenticated']) role_name(name)
    cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege_name(name)
    where has_table_privilege(role_name.name,'public.'||v.name,privilege_name.name)) then
    raise exception using errcode='55000',message='hotels_v2_admin_d_normalized_availability_acl_failed'; end if;
  if has_function_privilege('anon','public.hotel_v2_admin_apply_calendar_plan(jsonb,uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.hotel_v2_admin_apply_calendar_plan(jsonb,uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.hotel_v2_admin_resolve_rate(uuid,date,date,integer)','EXECUTE')
     or has_function_privilege('authenticated','public.hotel_v2_admin_get_calendar(uuid,date,date)','EXECUTE') then
    raise exception using errcode='55000',message='hotels_v2_admin_d_legacy_availability_rpc_exposed'; end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and left(p.proname,length('hotel_v2_admin_d_'))='hotel_v2_admin_d_'
      and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE')
        or has_function_privilege('service_role',p.oid,'EXECUTE'))) then
    raise exception using errcode='55000',message='hotels_v2_admin_d_internal_rpc_exposed'; end if;
  if exists(select 1 from (values
      ('public.hotel_v2_admin_d_keys_allowed(jsonb,text[])',false,array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_admin_d_protected_fingerprints()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_hash(jsonb)',false,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_uuid_is_canonical(text)',false,array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_admin_d_deterministic_uuid(text)',false,array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_admin_d_reason_is_valid(jsonb)',false,array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_admin_d_json_dates_are_canonical(jsonb)',false,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_validate_shared_availability_fields()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_audit_state(text,jsonb)',false,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_immutable_row()',false,array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_admin_d_plan_review_consume_guard()',false,array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_admin_d_validate_unit_block()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_validate_allocation()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_validate_commitment()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_validate_allocation_topology()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_validate_hold_topology()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_validate_hold_update()',false,array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_admin_d_validate_room_availability_change()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_validate_unit_availability_change()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_snapshot(uuid,date,date,boolean)',true,array['search_path=pg_catalog, public, auth']::text[]),
      ('public.hotel_v2_admin_d_review_plan(jsonb)',true,array['search_path=pg_catalog, public, auth']::text[])
    ) expected(signature,security_definer,configuration)
    left join pg_proc p on p.oid=to_regprocedure(expected.signature)
    where p.oid is null or p.proowner<>(select oid from pg_roles where rolname='postgres')
      or p.prosecdef is distinct from expected.security_definer
      or p.proconfig is distinct from expected.configuration) then
    raise exception using errcode='55000',message='hotels_v2_admin_d_internal_metadata_failed'; end if;
  if exists(select 1 from (values
      ('public.hotel_v2_admin_get_availability_control(uuid,date,date)'),
      ('public.hotel_v2_admin_preview_availability_plan(jsonb)'),
      ('public.hotel_v2_admin_apply_availability_control_plan(jsonb,uuid,text)'),
      ('public.hotel_v2_admin_preview_stay(jsonb)')) expected(signature)
    left join pg_proc p on p.oid=to_regprocedure(expected.signature)
    where p.oid is null or p.proowner<>(select oid from pg_roles where rolname='postgres')
      or not p.prosecdef or p.proconfig is distinct from array['search_path=pg_catalog, public, auth']::text[]
      or has_function_privilege(0::oid,p.oid,'EXECUTE')
      or has_function_privilege('anon',p.oid,'EXECUTE')
      or has_function_privilege('service_role',p.oid,'EXECUTE')
      or not has_function_privilege('authenticated',p.oid,'EXECUTE')) then
    raise exception using errcode='55000',message='hotels_v2_admin_d_rpc_metadata_failed'; end if;
  if exists(select 1 from unnest(array[
      'hotel_unit_calendar_blocks_admin_d_guard','hotel_booking_room_allocations_admin_d_guard',
      'hotel_inventory_commitments_admin_d_guard','hotel_inventory_holds_admin_d_guard',
      'hotel_rate_rules_admin_d_availability_guard','hotel_calendar_overrides_admin_d_availability_guard',
      'hotel_booking_room_allocations_admin_d_topology','hotel_inventory_commitments_admin_d_allocation_topology',
      'hotel_inventory_holds_admin_d_topology','hotel_inventory_commitments_admin_d_hold_topology',
      'hotel_room_types_admin_d_capacity_guard','hotel_units_admin_d_capacity_guard',
      'hotel_admin_availability_receipts_immutable','hotel_admin_availability_reviews_no_delete',
      'hotel_admin_availability_reviews_consume_guard','hotel_admin_availability_foundation_immutable',
      'hotel_unit_calendar_blocks_no_delete','hotel_inventory_holds_no_delete',
      'hotel_booking_room_allocations_no_delete','hotel_inventory_commitments_no_delete']) expected(trigger_name)
    where not exists(select 1 from pg_trigger where tgname=expected.trigger_name and not tgisinternal)) then
    raise exception using errcode='55000',message='hotels_v2_admin_d_trigger_contract_failed'; end if;
  if exists(select 1 from public.hotel_unit_calendar_blocks)
     or exists(select 1 from public.hotel_inventory_day_locks)
     or exists(select 1 from public.hotel_inventory_holds)
     or exists(select 1 from public.hotel_booking_room_allocations)
     or exists(select 1 from public.hotel_inventory_commitments)
     or exists(select 1 from public.hotel_admin_availability_action_receipts)
     or exists(select 1 from public.hotel_admin_availability_plan_reviews)
     or (select count(*) from public.hotel_admin_availability_foundation_receipts)<>1
     or not exists(select 1 from public.hotel_admin_availability_foundation_receipts receipt
       where receipt.id=1 and receipt.protected_fingerprints=public.hotel_v2_admin_d_protected_fingerprints()
         and receipt.protected_fingerprint=encode(extensions.digest(convert_to(receipt.protected_fingerprints::text,'UTF8'),'sha256'),'hex')) then
    raise exception using errcode='55000',message='hotels_v2_admin_d_foundation_not_empty'; end if;
end
$admin_d_postcondition$;

notify pgrst,'reload schema';
commit;
