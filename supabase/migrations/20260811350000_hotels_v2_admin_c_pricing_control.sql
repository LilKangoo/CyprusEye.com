-- CYPRUSEYE Hotels V2 ADMIN-C: normalized pricing control plane.
-- Additive/shadow only. Public Hotels V2 flags stay OFF and the accepted
-- 7 Kamares H3.1P graph remains immutable and inactive.

begin;
set local lock_timeout = '15s';
set local statement_timeout = '120s';

do $admin_c_preconditions$
begin
  if to_regclass('public.hotel_rate_plans') is null
     or to_regclass('public.hotel_room_rates') is null
     or to_regclass('public.hotel_pricing_schedules') is null
     or to_regclass('public.hotel_pricing_schedule_occupancy_tiers') is null
     or to_regclass('public.hotel_room_rate_occupancy_tiers') is null
     or to_regclass('public.hotel_rate_rules') is null
     or to_regclass('public.hotel_calendar_overrides') is null
     or to_regclass('public.hotel_room_allocation_rules') is null
     or to_regclass('public.hotel_room_allocation_rule_items') is null
     or to_regprocedure('public.hotel_v2_admin_get_content_control(uuid)') is null
     or to_regprocedure('public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid)') is null
     or to_regprocedure('public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid)') is null
     or to_regprocedure('public.hotel_v2_admin_apply_calendar_plan(jsonb,uuid)') is null
     or to_regprocedure('public.hotel_v2_admin_apply_h3_1_configuration(jsonb,uuid)') is null
     or to_regprocedure('public.hotel_v2_admin_apply_legacy_pricing_promotion(jsonb,uuid)') is null then
    raise exception using errcode='55000',
      message='hotels_v2_admin_c_required_foundation_missing';
  end if;

  if to_regclass('public.hotel_admin_pricing_action_receipts') is not null
     or to_regclass('public.hotel_property_pricing_defaults') is not null
     or to_regprocedure('public.hotel_v2_admin_get_pricing_control(uuid)') is not null
     or to_regprocedure('public.hotel_v2_admin_apply_pricing_control_plan(jsonb,uuid,text)') is not null
     or to_regprocedure('public.hotel_v2_admin_preview_pricing_quote(jsonb)') is not null
     or exists(
       select 1 from information_schema.columns
       where table_schema='public' and (
         (table_name='hotel_rate_plans' and column_name='review_status')
         or (table_name='hotel_room_rates' and column_name='review_status')
         or (table_name='hotel_pricing_schedules' and column_name='sharing_mode')
         or (table_name='hotel_room_allocation_rule_items'
           and column_name in('allocated_guest_counts','pricing_guest_counts'))
         or (table_name='hotel_calendar_overrides' and column_name in(
           'pricing_source','pricing_reason','pricing_expires_at','pricing_actor_type',
           'pricing_actor_id','pricing_updated_at','pricing_correlation_id'))
       )
     ) then
    raise exception using errcode='55000',
      message='hotels_v2_admin_c_partial_or_repeat_apply';
  end if;

  if (select count(*) from public.site_settings)<>1
     or not exists(select 1 from public.site_settings where id=1
       and not hotel_rooms_v2_enabled and not hotel_external_sync_enabled
       and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled) then
    raise exception using errcode='55000',message='hotels_v2_admin_c_flags_must_be_off';
  end if;

  if not exists(
    select 1 from public.hotels hotel
    where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
      and hotel.architecture_version='legacy'
      and md5(hotel.pricing_tiers::text)='7208ab4ecc0e47abd64d87ca1ac53a03'
      and jsonb_array_length(hotel.pricing_tiers->'rules')=63
  ) or exists(
    select 1 from public.hotel_rate_plans
    where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid and is_active
  ) or exists(
    select 1 from public.hotel_room_rates
    where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid and is_active
  ) or exists(
    select 1 from public.hotel_pricing_schedules
    where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid and is_active
  ) then
    raise exception using errcode='55000',message='hotels_v2_admin_c_legacy_baseline_drift';
  end if;

  if not coalesce((public.hotel_v2_h3_1p_pricing_promotion_snapshot(
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)#>>'{supported}')::boolean,false)
     or public.hotel_v2_h3_1p_pricing_promotion_snapshot(
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)#>>'{promotion,status}'<>'reviewed'
     or (public.hotel_v2_h3_1p_pricing_promotion_snapshot(
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)#>>'{parity,total_case_count}')::integer<>70
     or (public.hotel_v2_h3_1p_pricing_promotion_snapshot(
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)#>>'{parity,total_mismatch_count}')::integer<>0 then
    raise exception using errcode='55000',message='hotels_v2_admin_c_h3_1p_receipt_drift';
  end if;

  -- The fast-default lifecycle classification is safe only for the exact
  -- reviewed H3.1P baseline. Unknown pre-existing drafts must be reviewed,
  -- never silently labelled reviewed by this migration.
  if (select count(*) from public.hotel_rate_plans)<>1
     or not exists(select 1 from public.hotel_rate_plans where id=
       '22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid and hotel_id=
       '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)
     or (select count(*) from public.hotel_room_rates)<>2
     or (select count(*) from public.hotel_room_rates where id in(
       '7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid,
       '3320590d-632d-423f-80d0-fd021cba7293'::uuid) and hotel_id=
       '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)<>2
     or (select count(*) from public.hotel_pricing_schedules)<>2
     or (select count(*) from public.hotel_pricing_schedules where id in(
       'b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid,
       '443065c0-984a-5de3-a22a-d03042c41107'::uuid) and hotel_id=
       '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)<>2 then
    raise exception using errcode='55000',
      message='hotels_v2_admin_c_unreviewed_existing_lifecycle_rows';
  end if;

  if exists(select 1 from public.hotel_room_allocation_rule_items
    where units_required>1) then
    raise exception using errcode='55000',
      message='hotels_v2_admin_c_existing_multi_unit_allocation_requires_review';
  end if;
end
$admin_c_preconditions$;

lock table public.site_settings in share mode;
lock table public.hotels in share row exclusive mode;
lock table public.hotel_rate_plans in share row exclusive mode;
lock table public.hotel_room_rates in share row exclusive mode;
lock table public.hotel_pricing_schedules in share row exclusive mode;
lock table public.hotel_pricing_schedule_occupancy_tiers in share row exclusive mode;
lock table public.hotel_room_rate_occupancy_tiers in share row exclusive mode;
lock table public.hotel_rate_rules in share row exclusive mode;
lock table public.hotel_calendar_overrides in share row exclusive mode;
lock table public.hotel_room_allocation_rules in share row exclusive mode;
lock table public.hotel_room_allocation_rule_items in share row exclusive mode;
lock table public.hotel_activity_log in share row exclusive mode;

create temporary table hotels_v2_admin_c_protected_before(
  relation_name text primary key,
  row_count bigint not null,
  fingerprint text not null
) on commit drop;

do $admin_c_capture$
declare v_relation text;
begin
  foreach v_relation in array array[
    'hotels','hotel_room_types','hotel_units','hotel_rate_plans','hotel_room_rates',
    'hotel_pricing_schedules','hotel_pricing_schedule_occupancy_tiers',
    'hotel_room_rate_occupancy_tiers','hotel_rate_rules','hotel_daily_rates',
    'hotel_daily_inventory','hotel_calendar_overrides',
    'hotel_room_allocation_rules','hotel_room_allocation_rule_items',
    'hotel_pricing_promotion_reviews','hotel_bookings',
    'partner_service_fulfillments','partner_service_fulfillment_form_snapshots',
    'service_deposit_requests','service_deposit_rules','service_deposit_overrides',
    'service_coupons','service_coupon_redemptions','referrals',
    'affiliate_commission_events','affiliate_payouts','affiliate_adjustments',
    'affiliate_program_settings','affiliate_referrer_overrides',
    'affiliate_cashout_requests','profile_referral_code_aliases','site_settings',
    'partners','partner_users','partner_resources','partner_user_resources',
    'hotel_property_operational_profiles','hotel_calendar_source_configs',
    'hotel_payment_policies','hotel_payment_policy_terms',
    'hotel_commission_policies','hotel_partner_hotel_permissions',
    'hotel_partner_action_receipts','hotel_partner_event_outbox','hotel_activity_log'
  ] loop
    if to_regclass('public.'||v_relation) is not null then
      execute format('lock table public.%I in share mode',v_relation);
      execute format(
        'insert into hotels_v2_admin_c_protected_before '
        ||'select %L,count(*),md5(coalesce(string_agg((to_jsonb(row_value)-%L::text[])::text,''|'' '
        ||'order by (to_jsonb(row_value)-%L::text[])::text),'''')) from public.%I row_value',
        v_relation,
        case v_relation
          when 'hotel_rate_plans' then array['review_status']::text[]
          when 'hotel_room_rates' then array['review_status']::text[]
          when 'hotel_pricing_schedules' then array['sharing_mode']::text[]
          when 'hotel_room_allocation_rule_items' then
            array['allocated_guest_counts','pricing_guest_counts']::text[]
          when 'hotel_calendar_overrides' then array[
            'pricing_source','pricing_reason','pricing_expires_at','pricing_actor_type',
            'pricing_actor_id','pricing_updated_at','pricing_correlation_id']::text[]
          else '{}'::text[] end,
        case v_relation
          when 'hotel_rate_plans' then array['review_status']::text[]
          when 'hotel_room_rates' then array['review_status']::text[]
          when 'hotel_pricing_schedules' then array['sharing_mode']::text[]
          when 'hotel_room_allocation_rule_items' then
            array['allocated_guest_counts','pricing_guest_counts']::text[]
          when 'hotel_calendar_overrides' then array[
            'pricing_source','pricing_reason','pricing_expires_at','pricing_actor_type',
            'pricing_actor_id','pricing_updated_at','pricing_correlation_id']::text[]
          else '{}'::text[] end,
        v_relation
      );
    end if;
  end loop;
end
$admin_c_capture$;

-- The first diagnostic block intentionally gives a controlled error before a
-- lock wait. Re-run every production-sensitive predicate after the complete
-- deterministic lock set is held, so no trusted concurrent writer can cross
-- the precondition/capture boundary.
do $admin_c_locked_preconditions$
begin
  if (select count(*) from public.site_settings)<>1
     or not exists(select 1 from public.site_settings where id=1
       and not hotel_rooms_v2_enabled and not hotel_external_sync_enabled
       and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled)
     or not exists(select 1 from public.hotels hotel
       where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
         and hotel.architecture_version='legacy'
         and md5(hotel.pricing_tiers::text)='7208ab4ecc0e47abd64d87ca1ac53a03'
         and jsonb_array_length(hotel.pricing_tiers->'rules')=63)
     or not coalesce((public.hotel_v2_h3_1p_pricing_promotion_snapshot(
       '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)#>>'{supported}')::boolean,false)
     or public.hotel_v2_h3_1p_pricing_promotion_snapshot(
       '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)#>>'{promotion,status}'<>'reviewed'
     or (public.hotel_v2_h3_1p_pricing_promotion_snapshot(
       '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)#>>'{parity,total_case_count}')::integer<>70
     or (public.hotel_v2_h3_1p_pricing_promotion_snapshot(
       '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)#>>'{parity,total_mismatch_count}')::integer<>0
     or (select count(*) from public.hotel_rate_plans)<>1
     or (select count(*) from public.hotel_room_rates)<>2
     or (select count(*) from public.hotel_pricing_schedules)<>2
     or exists(select 1 from public.hotel_room_allocation_rule_items where units_required>1)
  then
    raise exception using errcode='55000',
      message='hotels_v2_admin_c_locked_baseline_drift';
  end if;
end
$admin_c_locked_preconditions$;

create function public.hotel_v2_admin_c_guest_array_matches_total(
  p_values smallint[],
  p_units integer,
  p_total smallint
)
returns boolean
language sql
immutable
set search_path=pg_catalog
as $function$
  select p_values is not null and p_units is not null and p_total is not null
    and cardinality(p_values)=p_units
    and array_position(p_values,null) is null
    and 0 < all(p_values)
    and 50 >= all(p_values)
    and p_total=(select sum(value)::smallint from unnest(p_values) value)
$function$;

revoke all on function public.hotel_v2_admin_c_guest_array_matches_total(smallint[],integer,smallint)
  from public,anon,authenticated,service_role;

alter table public.hotel_rate_plans
  add column review_status text not null default 'reviewed',
  add constraint hotel_rate_plans_admin_c_review_status_check
    check(review_status in('requires_review','reviewed','disabled')),
  add constraint hotel_rate_plans_admin_c_review_activation_check
    check(not is_active or review_status='reviewed');
alter table public.hotel_rate_plans alter column review_status set default 'requires_review';

alter table public.hotel_room_rates
  add column review_status text not null default 'reviewed',
  add constraint hotel_room_rates_admin_c_review_status_check
    check(review_status in('requires_review','reviewed','disabled')),
  add constraint hotel_room_rates_admin_c_review_activation_check
    check(not is_active or review_status='reviewed');
alter table public.hotel_room_rates alter column review_status set default 'requires_review';

alter table public.hotel_pricing_schedules
  add column sharing_mode text not null default 'shared',
  add constraint hotel_pricing_schedules_admin_c_sharing_mode_check
    check(sharing_mode in('shared','independent'));

alter table public.hotel_room_allocation_rule_items
  add column allocated_guest_counts smallint[],
  add column pricing_guest_counts smallint[],
  add constraint hotel_room_allocation_items_admin_c_allocated_array_check check(
    allocated_guest_counts is null or (allocated_guest_count is not null
      and public.hotel_v2_admin_c_guest_array_matches_total(
      allocated_guest_counts,units_required,allocated_guest_count)
    )),
  add constraint hotel_room_allocation_items_admin_c_pricing_array_check check(
    pricing_guest_counts is null or (pricing_guest_count is not null
      and public.hotel_v2_admin_c_guest_array_matches_total(
      pricing_guest_counts,units_required,pricing_guest_count)
    )),
  add constraint hotel_room_allocation_items_admin_c_multi_unit_exact_check check(
    units_required=1 or (
      allocated_guest_counts is not null
      and pricing_guest_count is not null
      and pricing_guest_counts is not null
    )
  );

alter table public.hotel_calendar_overrides
  add column pricing_source text,
  add column pricing_reason text,
  add column pricing_expires_at timestamptz,
  add column pricing_actor_type text,
  add column pricing_actor_id uuid,
  add column pricing_updated_at timestamptz,
  add column pricing_correlation_id uuid,
  add constraint hotel_calendar_overrides_admin_c_pricing_provenance_check check(
    case when nightly_rate_mode is null and minimum_stay_mode is null
        and maximum_stay_mode is null then
      pricing_source is null and pricing_reason is null and pricing_expires_at is null
      and pricing_actor_type is null and pricing_actor_id is null
      and pricing_updated_at is null and pricing_correlation_id is null
    else
      -- Existing H2B rows retain an all-NULL pricing provenance tuple and are
      -- projected as explicit read-only legacy pricing. Every ADMIN-C write is
      -- required by the trigger below to populate the complete second branch.
      (pricing_source is null and pricing_reason is null and pricing_expires_at is null
        and pricing_actor_type is null and pricing_actor_id is null
        and pricing_updated_at is null and pricing_correlation_id is null)
      or (
        pricing_source is not null
        and pricing_source in('manual','partner','sync','system')
        and pricing_reason is not null and pricing_reason=btrim(pricing_reason)
        and length(pricing_reason) between 1 and 500
        and pricing_reason!~'[[:cntrl:]]'
        and pricing_actor_type is not null
        and pricing_actor_type in('admin','partner','sync','system')
        and (pricing_actor_id is not null or pricing_actor_type in('sync','system'))
        and pricing_updated_at is not null and pricing_correlation_id is not null
      )
    end
  );

create function public.hotel_v2_admin_c_calendar_pricing_provenance_guard()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public
as $function$
declare
  v_configured boolean;
  v_complete boolean;
  v_all_null boolean;
begin
  v_configured:=new.nightly_rate_mode is not null
    or new.minimum_stay_mode is not null or new.maximum_stay_mode is not null;
  v_all_null:=new.pricing_source is null and new.pricing_reason is null
    and new.pricing_expires_at is null and new.pricing_actor_type is null
    and new.pricing_actor_id is null and new.pricing_updated_at is null
    and new.pricing_correlation_id is null;
  v_complete:=new.pricing_source is not null and new.pricing_reason is not null
    and new.pricing_actor_type is not null and new.pricing_updated_at is not null
    and new.pricing_correlation_id is not null;

  if not v_configured then
    if not v_all_null then
      raise exception using errcode='23514',
        message='hotels_v2_admin_c_orphan_pricing_provenance';
    end if;
    return new;
  end if;
  if v_complete then return new; end if;

  -- Grandfather only a byte-preserved pre-ADMIN-C price/stay tuple. New rows,
  -- reparenting, or any pricing edit must carry complete pricing provenance.
  if tg_op='UPDATE'
     and old.pricing_source is null and old.pricing_reason is null
     and old.pricing_expires_at is null and old.pricing_actor_type is null
     and old.pricing_actor_id is null and old.pricing_updated_at is null
     and old.pricing_correlation_id is null and v_all_null
     and old.id=new.id and old.hotel_id=new.hotel_id
     and old.room_rate_id=new.room_rate_id and old.stay_date=new.stay_date
     and old.nightly_rate_mode is not distinct from new.nightly_rate_mode
     and old.nightly_rate is not distinct from new.nightly_rate
     and old.minimum_stay_mode is not distinct from new.minimum_stay_mode
     and old.minimum_stay is not distinct from new.minimum_stay
     and old.maximum_stay_mode is not distinct from new.maximum_stay_mode
     and old.maximum_stay is not distinct from new.maximum_stay then
    return new;
  end if;
  raise exception using errcode='23514',
    message='hotels_v2_admin_c_pricing_provenance_required';
end
$function$;

create trigger hotel_calendar_overrides_admin_c_pricing_provenance_guard
before insert or update on public.hotel_calendar_overrides
for each row execute function public.hotel_v2_admin_c_calendar_pricing_provenance_guard();

-- H2B.1 intentionally prohibited every schedule-backed active Room Rate while
-- the graph was inert. ADMIN-C replaces that temporary check with deferred
-- reviewed relationship validation below.
alter table public.hotel_room_rates
  drop constraint hotel_room_rates_h2b1_schedule_inert_check;

create table public.hotel_property_pricing_defaults(
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null unique references public.hotels(id) on delete cascade,
  nightly_rate numeric(12,2) not null,
  currency text not null,
  is_active boolean not null default false,
  review_status text not null default 'requires_review',
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_property_pricing_defaults_rate_check
    check(nightly_rate>0 and nightly_rate<=9999999999.99),
  constraint hotel_property_pricing_defaults_currency_check
    check(currency~'^[A-Z]{3}$'),
  constraint hotel_property_pricing_defaults_review_check
    check(review_status in('requires_review','reviewed','disabled')),
  constraint hotel_property_pricing_defaults_activation_check
    check(not is_active or review_status='reviewed'),
  constraint hotel_property_pricing_defaults_version_check check(version>0)
);
alter table public.hotel_property_pricing_defaults enable row level security;
revoke all on table public.hotel_property_pricing_defaults
  from public,anon,authenticated,service_role;

create trigger hotel_property_pricing_defaults_set_updated_at_and_version
before update on public.hotel_property_pricing_defaults
for each row execute function public.hotel_v2_set_updated_at_and_version();

alter table public.hotel_activity_log
  drop constraint hotel_activity_log_entity_type_check,
  add constraint hotel_activity_log_entity_type_check check(entity_type in(
    'property','room_type','unit','rate_plan','room_rate','rate_rule',
    'calendar_override','daily_inventory','occupancy_tier','pricing_schedule',
    'allocation_rule','payment_policy','commission_policy','calendar_source',
    'property_pricing_default'
  ));

create table public.hotel_admin_pricing_action_receipts(
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  actor_id uuid not null,
  idempotency_key text not null,
  correlation_id uuid not null unique,
  request_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint hotel_admin_pricing_receipts_actor_key unique(actor_id,idempotency_key),
  constraint hotel_admin_pricing_receipts_key_check check(
    length(idempotency_key) between 8 and 120
    and idempotency_key~'^[A-Za-z0-9][A-Za-z0-9._:-]*$'
  ),
  constraint hotel_admin_pricing_receipts_hash_check check(request_hash~'^[0-9a-f]{64}$'),
  constraint hotel_admin_pricing_receipts_result_check check(jsonb_typeof(result)='object')
);
alter table public.hotel_admin_pricing_action_receipts enable row level security;
revoke all on table public.hotel_admin_pricing_action_receipts
  from public,anon,authenticated,service_role;

comment on table public.hotel_admin_pricing_action_receipts is
  'Immutable ADMIN-C request/result receipts. Browser roles have no raw access; the Admin mutation RPC provides same-request replay.';

create function public.hotel_v2_admin_c_pricing_receipt_immutable_trigger()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public
as $function$
begin
  raise exception using errcode='55000',
    message='hotels_v2_admin_c_pricing_receipt_immutable';
end
$function$;

create trigger hotel_admin_pricing_action_receipts_immutable
before update or delete on public.hotel_admin_pricing_action_receipts
for each row execute function public.hotel_v2_admin_c_pricing_receipt_immutable_trigger();

revoke all on function public.hotel_v2_admin_c_pricing_receipt_immutable_trigger()
  from public,anon,authenticated,service_role;

create function public.hotel_v2_admin_c_lifecycle(
  p_is_active boolean,
  p_review_status text
)
returns text
language sql
immutable
set search_path=pg_catalog
as $function$
  select case
    when p_is_active then 'active'
    when p_review_status='disabled' then 'disabled'
    when p_review_status='reviewed' then 'inactive'
    else 'draft'
  end
$function$;

create function public.hotel_v2_admin_c_is_promotion_entity(
  p_hotel_id uuid,
  p_entity text,
  p_entity_id uuid
)
returns boolean
language sql
stable
set search_path=pg_catalog,public
as $function$
  select p_hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
    and exists(
      select 1 from public.hotel_pricing_promotion_reviews review
      where review.hotel_id=p_hotel_id
        and review.contract_version='seven_kamares_legacy_to_h3_pricing_v1'
        and review.review_status='reviewed'
        and review.parity_case_count=70 and review.parity_mismatch_count=0
    )
    and p_entity in('rate_plan','room_rate','pricing_schedule','rate_rule',
      'exact_date_price','allocation_rule','occupancy_tier','property_pricing_default')
    and p_entity_id is not null
$function$;

create function public.hotel_v2_admin_c_immutable_contract(
  p_hotel_id uuid,
  p_entity text,
  p_entity_id uuid
)
returns jsonb
language sql
stable
set search_path=pg_catalog,public
as $function$
  select case when public.hotel_v2_admin_c_is_promotion_entity(
    p_hotel_id,p_entity,p_entity_id) then jsonb_build_object(
      'locked',true,
      'contract_version','seven_kamares_legacy_to_h3_pricing_v1',
      'reason','accepted_h3_1p_hotel_pricing_graph'
    ) else null end
$function$;

-- Isolated accepted-H3.1P oracle. Allocation rule/item UUIDs were generated by
-- the reviewed H3.1 Admin save and are already pinned by the promotion receipt
-- and protected fingerprints. Validate the exact semantic graph by its unique
-- rule codes and Room relationships instead of assuming disposable-fixture IDs.
create function public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()
returns boolean
language sql
stable
set search_path=pg_catalog,public
as $function$
  with expected_rules(code,allocation_mode,min_guest_count,max_guest_count) as (
    values
      ('guests-1-4-choice','customer_choice',1,4),
      ('guests-5-bundle','required_bundle',5,5),
      ('guests-6-bundle','required_bundle',6,6),
      ('guests-7-bundle','required_bundle',7,7),
      ('guests-8-bundle','required_bundle',8,8)
  ), expected_items(rule_code,room_type_id,physical,pricing) as (
    values
      ('guests-1-4-choice','b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid,null::smallint,null::smallint),
      ('guests-1-4-choice','825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid,null::smallint,null::smallint),
      ('guests-5-bundle','b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid,3::smallint,2::smallint),
      ('guests-5-bundle','825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid,2::smallint,2::smallint),
      ('guests-6-bundle','b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid,3::smallint,3::smallint),
      ('guests-6-bundle','825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid,3::smallint,3::smallint),
      ('guests-7-bundle','b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid,4::smallint,4::smallint),
      ('guests-7-bundle','825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid,3::smallint,4::smallint),
      ('guests-8-bundle','b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid,4::smallint,4::smallint),
      ('guests-8-bundle','825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid,4::smallint,4::smallint)
  ), actual_rules as (
    select rule.code,rule.allocation_mode,rule.min_guest_count,
      rule.max_guest_count,rule.is_active,rule.review_status
    from public.hotel_room_allocation_rules rule
    where rule.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
  ), actual_items as (
    select rule.code rule_code,item.hotel_id,item.room_type_id,
      item.allocated_guest_count physical,item.pricing_guest_count pricing,
      item.units_required,item.allocated_guest_counts,
      item.pricing_guest_counts
    from public.hotel_room_allocation_rule_items item
    join public.hotel_room_allocation_rules rule on rule.id=item.allocation_rule_id
    where rule.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
  )
  select (select count(*) from actual_rules)=5
    and not exists(
      select 1 from expected_rules expected full join actual_rules actual using(code)
      where expected.code is null or actual.code is null
        or actual.allocation_mode is distinct from expected.allocation_mode
        or actual.min_guest_count is distinct from expected.min_guest_count
        or actual.max_guest_count is distinct from expected.max_guest_count
        or actual.is_active is distinct from true
        or actual.review_status is distinct from 'reviewed')
    and (select count(*) from actual_items)=10
    and not exists(
      select 1 from expected_items expected full join actual_items actual
        using(rule_code,room_type_id)
      where expected.rule_code is null or actual.rule_code is null
        or expected.room_type_id is null or actual.room_type_id is null
        or actual.hotel_id is distinct from
          '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
        or actual.physical is distinct from expected.physical
        or actual.pricing is distinct from expected.pricing
        or actual.units_required is distinct from 1
        or actual.allocated_guest_counts is not null
        or actual.pricing_guest_counts is not null)
$function$;

create function public.hotel_v2_admin_c_schedule_tiers_fingerprint(p_schedule_id uuid)
returns text
language sql
stable
set search_path=pg_catalog,public
as $function$
  select md5(coalesce(string_agg(jsonb_build_object(
    'id',tier.id,'schedule_id',tier.schedule_id,'guest_count',tier.guest_count,
    'threshold_nights',tier.threshold_nights,'nightly_rate',tier.nightly_rate,
    'is_active',tier.is_active,'version',tier.version
  )::text,'|' order by tier.guest_count,tier.threshold_nights,tier.id),''))
  from public.hotel_pricing_schedule_occupancy_tiers tier
  where tier.schedule_id=p_schedule_id
$function$;

create function public.hotel_v2_admin_c_room_tiers_fingerprint(p_room_rate_id uuid)
returns text
language sql
stable
set search_path=pg_catalog,public
as $function$
  select md5(coalesce(string_agg(jsonb_build_object(
    'id',tier.id,'hotel_id',tier.hotel_id,'room_rate_id',tier.room_rate_id,
    'guest_count',tier.guest_count,'threshold_nights',tier.threshold_nights,
    'nightly_rate',tier.nightly_rate,'is_active',tier.is_active,
    'source',tier.source,'version',tier.version
  )::text,'|' order by tier.guest_count,tier.threshold_nights,tier.id),''))
  from public.hotel_room_rate_occupancy_tiers tier
  where tier.room_rate_id=p_room_rate_id
$function$;

create function public.hotel_v2_admin_c_schedule_link_fingerprint(p_schedule_id uuid)
returns text
language sql
stable
set search_path=pg_catalog,public
as $function$
  select md5(coalesce(string_agg(jsonb_build_object(
    'room_rate_id',rate.id,'version',rate.version,'is_active',rate.is_active,
    'review_status',rate.review_status
  )::text,'|' order by rate.id),''))
  from public.hotel_room_rates rate where rate.pricing_schedule_id=p_schedule_id
$function$;

create function public.hotel_v2_admin_c_allocation_items_fingerprint(p_rule_id uuid)
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
    'allocated_guest_counts',item.allocated_guest_counts,
    'pricing_guest_counts',item.pricing_guest_counts,
    'sort_order',item.sort_order,'version',item.version
  )::text,'|' order by item.sort_order,item.id),''))
  from public.hotel_room_allocation_rule_items item
  where item.allocation_rule_id=p_rule_id
$function$;

create function public.hotel_v2_admin_c_i18n_is_valid(
  p_value jsonb,p_require_all boolean,p_max_length integer,
  p_allow_lf boolean default false
)
returns boolean language sql immutable set search_path=pg_catalog
as $function$
  select p_value is not null and jsonb_typeof(p_value)='object'
    and p_max_length between 1 and 20000
    and not exists(select 1 from jsonb_each(p_value) entry
      where entry.key not in('pl','en','he')
        or jsonb_typeof(entry.value)<>'string'
        or replace(replace(entry.value#>>'{}',E'\r\n',E'\n'),E'\r',E'\n')
          <>btrim(replace(replace(entry.value#>>'{}',E'\r\n',E'\n'),E'\r',E'\n'))
        or left(replace(replace(entry.value#>>'{}',E'\r\n',E'\n'),E'\r',E'\n'),1)=E'\n'
        or right(replace(replace(entry.value#>>'{}',E'\r\n',E'\n'),E'\r',E'\n'),1)=E'\n'
        or length(replace(replace(entry.value#>>'{}',E'\r\n',E'\n'),E'\r',E'\n'))
          not between 1 and p_max_length
        or case when p_allow_lf then
          replace(replace(replace(entry.value#>>'{}',E'\r\n',E'\n'),E'\r',E'\n'),E'\n','')
            ~'[[:cntrl:]]'
          else entry.value#>>'{}'~'[[:cntrl:]]' end)
    and (not p_require_all or p_value ?& array['pl','en','he'])
$function$;

-- JSON transport identifiers must use PostgreSQL's exact lowercase canonical
-- UUID rendering. PostgreSQL's uuid input routine accepts several shorthand
-- spellings, so casting alone is not a strict browser boundary.
create function public.hotel_v2_admin_c_uuid_is_canonical(p_value text)
returns boolean language sql immutable strict set search_path=pg_catalog
as $function$
  select p_value~'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
$function$;

create function public.hotel_v2_admin_c_json_uuid_fields_are_canonical(p_value jsonb)
returns boolean language plpgsql immutable set search_path=pg_catalog,public
as $function$
declare v_key text; v_child jsonb;
begin
  if p_value is null then return false; end if;
  if jsonb_typeof(p_value)='object' then
    for v_key,v_child in select key,value from jsonb_each(p_value) loop
      if v_key='id' or v_key like '%\_id' escape '\' then
        if jsonb_typeof(v_child)<>'null' and (
          jsonb_typeof(v_child)<>'string'
          or not public.hotel_v2_admin_c_uuid_is_canonical(v_child#>>'{}')) then
          return false;
        end if;
      elsif v_key like '%\_ids' escape '\' then
        if jsonb_typeof(v_child)<>'null' and (
          jsonb_typeof(v_child)<>'array' or exists(select 1
            from jsonb_array_elements(v_child) item
            where jsonb_typeof(item)<>'string'
              or not public.hotel_v2_admin_c_uuid_is_canonical(item#>>'{}'))) then
          return false;
        end if;
      elsif jsonb_typeof(v_child) in('object','array')
          and not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(v_child) then
        return false;
      end if;
    end loop;
  elsif jsonb_typeof(p_value)='array' then
    for v_child in select value from jsonb_array_elements(p_value) loop
      if jsonb_typeof(v_child) in('object','array')
          and not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(v_child) then
        return false;
      end if;
    end loop;
  end if;
  return true;
end
$function$;

create function public.hotel_v2_admin_c_date_is_canonical(p_value text)
returns boolean language plpgsql immutable strict set search_path=pg_catalog
as $function$
declare v_date date;
begin
  if p_value!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     or substring(p_value,1,4)::integer=0 then return false; end if;
  v_date:=make_date(substring(p_value,1,4)::integer,
    substring(p_value,6,2)::integer,substring(p_value,9,2)::integer);
  return to_char(v_date,'YYYY-MM-DD')=p_value;
exception when others then return false;
end
$function$;

create function public.hotel_v2_admin_c_timestamptz_is_canonical(p_value text)
returns boolean language plpgsql immutable strict set search_path=pg_catalog
as $function$
declare
  v_match text[];
  v_date date;
  v_hour integer; v_minute integer; v_second integer;
  v_offset_hour integer; v_offset_minute integer;
  v_parsed timestamptz;
begin
  v_match:=regexp_match(p_value,
    '^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$');
  if v_match is null or v_match[1]::integer=0 then return false; end if;
  v_date:=make_date(v_match[1]::integer,v_match[2]::integer,v_match[3]::integer);
  if to_char(v_date,'YYYY-MM-DD')<>substring(p_value,1,10) then return false; end if;
  v_hour:=v_match[4]::integer; v_minute:=v_match[5]::integer;
  v_second:=v_match[6]::integer;
  if v_hour not between 0 and 23 or v_minute not between 0 and 59
     or v_second not between 0 and 59 then return false; end if;
  if v_match[7]<>'Z' then
    v_offset_hour:=substring(v_match[7],2,2)::integer;
    v_offset_minute:=substring(v_match[7],5,2)::integer;
    if v_offset_hour not between 0 and 14 or v_offset_minute not between 0 and 59
       or (v_offset_hour=14 and v_offset_minute<>0) then return false; end if;
  end if;
  v_parsed:=p_value::timestamptz;
  return v_parsed is not null;
exception when others then return false;
end
$function$;

create function public.hotel_v2_admin_c_json_timestamp_fields_are_canonical(p_value jsonb)
returns boolean language plpgsql immutable set search_path=pg_catalog,public
as $function$
declare v_key text; v_child jsonb;
begin
  if p_value is null then return false; end if;
  if jsonb_typeof(p_value)='object' then
    for v_key,v_child in select key,value from jsonb_each(p_value) loop
      if v_key in('reviewed_at','expires_at','pricing_expires_at') then
        if jsonb_typeof(v_child)<>'null' and (
          jsonb_typeof(v_child)<>'string'
          or not public.hotel_v2_admin_c_timestamptz_is_canonical(v_child#>>'{}')) then
          return false;
        end if;
      elsif jsonb_typeof(v_child) in('object','array')
          and not public.hotel_v2_admin_c_json_timestamp_fields_are_canonical(v_child) then
        return false;
      end if;
    end loop;
  elsif jsonb_typeof(p_value)='array' then
    for v_child in select value from jsonb_array_elements(p_value) loop
      if jsonb_typeof(v_child) in('object','array')
          and not public.hotel_v2_admin_c_json_timestamp_fields_are_canonical(v_child) then
        return false;
      end if;
    end loop;
  end if;
  return true;
end
$function$;

revoke all on function public.hotel_v2_admin_c_uuid_is_canonical(text),
  public.hotel_v2_admin_c_json_uuid_fields_are_canonical(jsonb),
  public.hotel_v2_admin_c_date_is_canonical(text),
  public.hotel_v2_admin_c_timestamptz_is_canonical(text),
  public.hotel_v2_admin_c_json_timestamp_fields_are_canonical(jsonb)
  from public,anon,authenticated,service_role;

create function public.hotel_v2_admin_c_cancellation_policy_is_valid(p_policy jsonb)
returns boolean language sql immutable set search_path=pg_catalog
as $function$
  select p_policy is not null and jsonb_typeof(p_policy)='object' and case
    when p_policy->>'type' in('flexible','non_refundable') then
      (select count(*)=1 from jsonb_object_keys(p_policy))
    when p_policy->>'type'='requires_review' then
      (select count(*)=2 from jsonb_object_keys(p_policy))
      and jsonb_typeof(p_policy->'reason')='string'
      and p_policy->>'reason'=btrim(p_policy->>'reason')
      and length(p_policy->>'reason') between 1 and 160
      and p_policy->>'reason'!~'[[:cntrl:]]'
    when p_policy->>'type'='custom' then
      jsonb_typeof(p_policy->'deadline_hours')='number'
      and p_policy->>'deadline_hours'~'^[0-9]+$'
      and (p_policy->>'deadline_hours')::numeric between 0 and 87600
      and jsonb_typeof(p_policy->'penalty_mode')='string'
      and p_policy->>'penalty_mode' in('none','flat','percent')
      and case when p_policy->>'penalty_mode'='none' then
        (select count(*)=3 from jsonb_object_keys(p_policy))
      else
        (select count(*)=4 from jsonb_object_keys(p_policy))
        and jsonb_typeof(p_policy->'penalty_value')='number'
        and p_policy->>'penalty_value'~'^[0-9]+(?:\.[0-9]{1,2})?$'
        and (p_policy->>'penalty_value')::numeric between 0 and
          case when p_policy->>'penalty_mode'='percent' then 100 else 9999999999.99 end
      end
    else false end
$function$;

create function public.hotel_v2_admin_c_https_url_is_valid(p_value text)
returns boolean
language plpgsql
immutable
set search_path=pg_catalog
as $function$
declare
  v_authority text;
  v_host text;
  v_port text;
begin
  if p_value is null or p_value<>btrim(p_value) or length(p_value) not between 1 and 2048
     or p_value!~'^https://[^/?#[:space:][:cntrl:]@]+(?:[/?#][^[:space:][:cntrl:]]*)?$' then
    return false;
  end if;
  v_authority:=substring(p_value from '^https://([^/?#]+)');
  if v_authority~'^\[' then
    if v_authority!~'^\[[0-9A-Fa-f:.]+\](?::[0-9]{1,5})?$' then return false; end if;
    v_port:=substring(v_authority from '\]:([0-9]+)$');
  else
    if v_authority!~'^[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?(?::[0-9]{1,5})?$'
       or v_authority~'\.\.' then return false; end if;
    v_host:=split_part(v_authority,':',1);
    if v_host like '.%' or v_host like '%.' then return false; end if;
    v_port:=substring(v_authority from ':([0-9]+)$');
  end if;
  return v_port is null or v_port::integer between 1 and 65535;
exception when invalid_text_representation or numeric_value_out_of_range then
  return false;
end
$function$;

create function public.hotel_v2_admin_c_schedule_source_summary(
  p_source text,p_reference jsonb
)
returns jsonb
language plpgsql
immutable
set search_path=pg_catalog
as $function$
declare
  v_clone text;
  v_pricing_model text;
  v_fingerprint text;
  v_rule_count integer;
  v_guest_counts jsonb;
  v_blocker text;
begin
  if p_reference is null or jsonb_typeof(p_reference)<>'object' then
    p_reference:='{}'::jsonb;
  end if;
  if p_source='manual' and jsonb_typeof(p_reference->'cloned_from_schedule_id')='string'
     and p_reference->>'cloned_from_schedule_id'~
       '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_clone:=p_reference->>'cloned_from_schedule_id';
  end if;
  if p_source='legacy_preview' then
    if jsonb_typeof(p_reference->'pricing_model')='string'
       and p_reference->>'pricing_model'=btrim(p_reference->>'pricing_model')
       and length(p_reference->>'pricing_model') between 1 and 80
       and p_reference->>'pricing_model'!~'[[:cntrl:]]' then
      v_pricing_model:=p_reference->>'pricing_model';
    end if;
    if jsonb_typeof(p_reference->'pricing_fingerprint')='string'
       and p_reference->>'pricing_fingerprint'~'^[0-9a-f]{32}$' then
      v_fingerprint:=p_reference->>'pricing_fingerprint';
    end if;
    if jsonb_typeof(p_reference->'rule_count')='number'
       and p_reference->>'rule_count'~'^[0-9]+$'
       and length(p_reference->>'rule_count')<=3
       and (p_reference->>'rule_count')::integer between 0 and 500 then
      v_rule_count:=(p_reference->>'rule_count')::integer;
    end if;
    if jsonb_typeof(p_reference->'guest_counts')='array'
       and jsonb_array_length(p_reference->'guest_counts') between 1 and 50
       and not exists(select 1 from jsonb_array_elements(p_reference->'guest_counts') value
         where jsonb_typeof(value)<>'number' or value#>>'{}'!~'^[0-9]+$'
           or length(value#>>'{}')>2 or (value#>>'{}')::integer not between 1 and 50) then
      select jsonb_agg((value#>>'{}')::integer order by ordinal)
      into v_guest_counts
      from jsonb_array_elements(p_reference->'guest_counts') with ordinality item(value,ordinal);
    end if;
    if jsonb_typeof(p_reference->'migration_blocker')='string'
       and p_reference->>'migration_blocker'=btrim(p_reference->>'migration_blocker')
       and length(p_reference->>'migration_blocker') between 1 and 160
       and p_reference->>'migration_blocker'!~'[[:cntrl:]]' then
      v_blocker:=p_reference->>'migration_blocker';
    end if;
  end if;
  return jsonb_build_object(
    'kind',case when p_source in('manual','legacy_preview','system') then p_source else 'system' end,
    'cloned_from_schedule_id',v_clone,
    'pricing_model',v_pricing_model,
    'pricing_fingerprint',v_fingerprint,
    'rule_count',v_rule_count,
    'guest_counts',v_guest_counts,
    'migration_blocker',v_blocker
  );
end
$function$;

create function public.hotel_v2_admin_c_enforce_graph_limits(
  p_hotel_id uuid,
  p_plan_delta integer default 0,
  p_rate_delta integer default 0,
  p_schedule_delta integer default 0,
  p_rule_delta integer default 0,
  p_exact_delta integer default 0,
  p_allocation_delta integer default 0,
  p_schedule_tier_delta integer default 0,
  p_direct_tier_delta integer default 0,
  p_allocation_item_delta integer default 0
)
returns void
language plpgsql
security definer
set search_path=pg_catalog,public
as $function$
declare
  v_plans bigint;
  v_rooms bigint;
  v_rates bigint;
  v_schedules bigint;
  v_rules bigint;
  v_exact bigint;
  v_allocations bigint;
  v_schedule_tiers bigint;
  v_direct_tiers bigint;
  v_allocation_items bigint;
  v_max_schedule_links bigint;
begin
  select count(*) into v_plans from public.hotel_rate_plans
    where hotel_id=p_hotel_id;
  select count(*) into v_rooms from public.hotel_room_types
    where hotel_id=p_hotel_id;
  select count(*) into v_rates from public.hotel_room_rates
    where hotel_id=p_hotel_id;
  select count(*) into v_schedules from public.hotel_pricing_schedules
    where hotel_id=p_hotel_id;
  select count(*) into v_rules from public.hotel_rate_rules rule
    where exists(select 1 from public.hotel_room_rates rate
      where rate.id=rule.room_rate_id and rate.hotel_id=p_hotel_id);
  select count(*) into v_exact from public.hotel_calendar_overrides
    where hotel_id=p_hotel_id;
  select count(*) into v_allocations from public.hotel_room_allocation_rules
    where hotel_id=p_hotel_id;
  select count(*) into v_schedule_tiers
    from public.hotel_pricing_schedule_occupancy_tiers tier
    where exists(select 1 from public.hotel_pricing_schedules schedule
      where schedule.id=tier.schedule_id and schedule.hotel_id=p_hotel_id);
  select count(*) into v_direct_tiers
    from public.hotel_room_rate_occupancy_tiers where hotel_id=p_hotel_id;
  select count(*) into v_allocation_items
    from public.hotel_room_allocation_rule_items where hotel_id=p_hotel_id;
  select coalesce(max(link_count),0) into v_max_schedule_links
  from (select count(*) link_count from public.hotel_room_rates rate
    where rate.hotel_id=p_hotel_id and rate.pricing_schedule_id is not null
    group by rate.pricing_schedule_id) links;

  if v_plans+p_plan_delta>200 or v_rooms>1000
     or v_rates+p_rate_delta>5000 or v_schedules+p_schedule_delta>1000
     or v_rules+p_rule_delta>10000 or v_exact+p_exact_delta>50000
     or v_allocations+p_allocation_delta>500
     or v_schedule_tiers+p_schedule_tier_delta>50000
     or v_direct_tiers+p_direct_tier_delta>50000
     or v_allocation_items+p_allocation_item_delta>10000
     or v_max_schedule_links>1000 then
    raise exception using errcode='54000',
      message='hotels_v2_admin_c_technical_limit_exceeded',
      detail=jsonb_build_object(
        'rate_plans',v_plans+p_plan_delta,'room_types',v_rooms,
        'room_rates',v_rates+p_rate_delta,
        'pricing_schedules',v_schedules+p_schedule_delta,
        'rate_rules',v_rules+p_rule_delta,
        'exact_date_prices',v_exact+p_exact_delta,
        'allocation_rules',v_allocations+p_allocation_delta,
        'schedule_tiers',v_schedule_tiers+p_schedule_tier_delta,
        'independent_tiers',v_direct_tiers+p_direct_tier_delta,
        'allocation_items',v_allocation_items+p_allocation_item_delta,
        'maximum_schedule_links',v_max_schedule_links,
        'limits',jsonb_build_object(
          'rate_plans',200,'room_types',1000,'room_rates',5000,
          'pricing_schedules',1000,'rate_rules',10000,
          'exact_date_prices',50000,'allocation_rules',500,
          'schedule_tiers',50000,'independent_tiers',50000,
          'allocation_items',10000,'schedule_links',1000,
          'snapshot_bytes',20971520)
      )::text;
  end if;
end
$function$;

revoke all on function public.hotel_v2_admin_c_lifecycle(boolean,text)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_c_is_promotion_entity(uuid,text,uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_c_immutable_contract(uuid,text,uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_c_schedule_tiers_fingerprint(uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_c_room_tiers_fingerprint(uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_c_schedule_link_fingerprint(uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_c_allocation_items_fingerprint(uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_c_i18n_is_valid(jsonb,boolean,integer,boolean)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_c_cancellation_policy_is_valid(jsonb)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_c_https_url_is_valid(text)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_c_schedule_source_summary(text,jsonb)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_c_enforce_graph_limits(
  uuid,integer,integer,integer,integer,integer,integer,integer,integer,integer)
  from public,anon,authenticated,service_role;

-- A reviewed graph is validated at transaction end. This lets one reviewed
-- RPC create/activate related objects atomically without weakening the final
-- relationship, coverage, or precedence contract.
create function public.hotel_v2_admin_c_validate_pricing_graph(p_hotel_id uuid)
returns void
language plpgsql
security definer
set search_path=pg_catalog,public
as $function$
begin
  if p_hotel_id is null or not exists(select 1 from public.hotels where id=p_hotel_id) then
    return;
  end if;
  perform public.hotel_v2_admin_c_enforce_graph_limits(p_hotel_id);

  -- A one-night default is never inferred. Any active pricing graph needs an
  -- explicit property rule, including a real one-night Hotel storing 1.
  if exists(select 1 from public.hotels hotel where hotel.id=p_hotel_id
      and hotel.minimum_stay_nights is null)
     and (exists(select 1 from public.hotel_rate_plans plan
          where plan.hotel_id=p_hotel_id and plan.is_active)
       or exists(select 1 from public.hotel_room_rates rate
          where rate.hotel_id=p_hotel_id and rate.is_active)
       or exists(select 1 from public.hotel_pricing_schedules schedule
          where schedule.hotel_id=p_hotel_id and schedule.is_active)
       or exists(select 1 from public.hotel_property_pricing_defaults default_price
          where default_price.hotel_id=p_hotel_id and default_price.is_active)) then
    raise exception using errcode='23514',
      message='hotels_v2_admin_c_active_graph_minimum_stay_required';
  end if;

  if exists(
    select 1 from public.hotel_pricing_schedules schedule
    where schedule.hotel_id=p_hotel_id and schedule.sharing_mode='independent'
      and (select count(*) from public.hotel_room_rates rate
        where rate.pricing_schedule_id=schedule.id)>1
  ) then
    raise exception using errcode='23514',
      message='hotels_v2_admin_c_independent_schedule_multiple_links';
  end if;

  if exists(select 1 from public.hotel_property_pricing_defaults default_price
    join public.hotels hotel on hotel.id=default_price.hotel_id
    where default_price.hotel_id=p_hotel_id and default_price.is_active and (
      default_price.review_status<>'reviewed'
      or default_price.currency<>hotel.currency
      or default_price.nightly_rate<=0
      or hotel.minimum_stay_nights is null)) then
    raise exception using errcode='23514',
      message='hotels_v2_admin_c_active_property_default_not_ready';
  end if;

  if exists(
    select 1 from public.hotel_room_rates rate
    join public.hotel_pricing_schedules schedule on schedule.id=rate.pricing_schedule_id
    where rate.hotel_id=p_hotel_id
      and (schedule.hotel_id<>rate.hotel_id
        or schedule.application_scope<>'room_occupancy'
        or schedule.currency<>rate.currency)
  ) then
    raise exception using errcode='23514',
      message='hotels_v2_admin_c_invalid_room_schedule_relationship';
  end if;

  if exists(
    select 1
    from public.hotel_rate_plans plan
    where plan.hotel_id=p_hotel_id and plan.is_active
      and (plan.review_status<>'reviewed'
        or not public.hotel_v2_admin_c_i18n_is_valid(plan.name_i18n,true,240)
        or not public.hotel_v2_admin_c_i18n_is_valid(plan.description_i18n,true,5000,true)
        or not public.hotel_v2_admin_c_cancellation_policy_is_valid(plan.cancellation_policy)
        or plan.cancellation_policy->>'type'='requires_review'
        or (select hotel.minimum_stay_nights from public.hotels hotel
          where hotel.id=plan.hotel_id) is null
        or not exists(select 1 from public.hotel_room_rates rate
          where rate.rate_plan_id=plan.id and rate.review_status='reviewed'))
  ) then
    raise exception using errcode='23514',
      message='hotels_v2_admin_c_active_rate_plan_not_ready';
  end if;

  if exists(
    select 1
    from public.hotel_room_rates rate
    join public.hotel_rate_plans plan on plan.id=rate.rate_plan_id
    join public.hotel_room_types room_type on room_type.id=rate.room_type_id
    left join public.hotel_pricing_schedules schedule on schedule.id=rate.pricing_schedule_id
    where rate.hotel_id=p_hotel_id and rate.is_active and (
      rate.review_status<>'reviewed' or not plan.is_active
      or plan.review_status<>'reviewed' or room_type.status<>'active'
      or (select hotel.minimum_stay_nights from public.hotels hotel
        where hotel.id=rate.hotel_id) is null
      or coalesce(room_type.max_occupancy,
           room_type.capacity_adults+room_type.capacity_children) is null
      or coalesce(room_type.max_occupancy,
           room_type.capacity_adults+room_type.capacity_children)<=0
      or rate.currency<>(select hotel.currency from public.hotels hotel where hotel.id=rate.hotel_id)
      or (coalesce(plan.booking_mode_override,
            (select hotel.booking_mode from public.hotels hotel where hotel.id=rate.hotel_id))
          ='external_redirect' and not public.hotel_v2_admin_c_https_url_is_valid(
            rate.external_redirect_url))
      or (rate.pricing_schedule_id is not null and (
        schedule.id is null or not schedule.is_active
        or schedule.review_status<>'reviewed'
        or schedule.application_scope<>'room_occupancy'
        or schedule.currency<>rate.currency
        or schedule.minimum_billable_occupancy>
          coalesce(room_type.max_occupancy,room_type.capacity_adults+room_type.capacity_children)
        or exists(select 1 from public.hotel_room_rate_occupancy_tiers direct_tier
          where direct_tier.room_rate_id=rate.id and direct_tier.is_active)
        or exists(
          select 1
          from generate_series(schedule.minimum_billable_occupancy::integer,
            least(schedule.maximum_party_size,
              coalesce(room_type.max_occupancy,
                room_type.capacity_adults+room_type.capacity_children))::integer) guest_count
          where not exists(select 1
            from public.hotel_pricing_schedule_occupancy_tiers tier
            where tier.schedule_id=schedule.id and tier.is_active
              and tier.guest_count=guest_count
              and tier.threshold_nights<=(select hotel.minimum_stay_nights
                from public.hotels hotel where hotel.id=rate.hotel_id))
        )
      ))
      or (rate.pricing_schedule_id is null and (
        (exists(select 1 from public.hotel_room_rate_occupancy_tiers tier
           where tier.room_rate_id=rate.id and tier.is_active)
         and ((select min(tier.guest_count)::integer
                from public.hotel_room_rate_occupancy_tiers tier
                where tier.room_rate_id=rate.id and tier.is_active)>
              coalesce(room_type.max_occupancy,
                room_type.capacity_adults+room_type.capacity_children)
         or exists(
           select 1 from generate_series((select min(tier.guest_count)::integer
               from public.hotel_room_rate_occupancy_tiers tier
               where tier.room_rate_id=rate.id and tier.is_active),
             coalesce(room_type.max_occupancy,
               room_type.capacity_adults+room_type.capacity_children)) guest_count
           where not exists(select 1
             from public.hotel_room_rate_occupancy_tiers tier
             where tier.room_rate_id=rate.id and tier.is_active
               and tier.guest_count=guest_count
               and tier.threshold_nights<=(select hotel.minimum_stay_nights
                 from public.hotels hotel where hotel.id=rate.hotel_id))
         )))
        or (not exists(select 1 from public.hotel_room_rate_occupancy_tiers tier
              where tier.room_rate_id=rate.id and tier.is_active)
            and rate.base_nightly_rate<=0 and not exists(
              select 1 from public.hotel_property_pricing_defaults default_price
              where default_price.hotel_id=rate.hotel_id and default_price.is_active
                and default_price.review_status='reviewed'
                and default_price.currency=rate.currency
                and default_price.nightly_rate>0))
      ))
    )
  ) then
    raise exception using errcode='23514',
      message='hotels_v2_admin_c_active_room_rate_not_ready';
  end if;

  if exists(select 1 from public.hotel_pricing_schedules schedule
    where schedule.hotel_id=p_hotel_id and schedule.is_active and (
      schedule.review_status<>'reviewed'
      or schedule.application_scope<>'room_occupancy'
      or not public.hotel_v2_admin_c_i18n_is_valid(schedule.name_i18n,true,240)
      or schedule.currency<>(select hotel.currency from public.hotels hotel
        where hotel.id=schedule.hotel_id)
      or exists(select 1 from generate_series(schedule.minimum_billable_occupancy::integer,
          schedule.maximum_party_size::integer) guest_count where not exists(
        select 1 from public.hotel_pricing_schedule_occupancy_tiers tier
        where tier.schedule_id=schedule.id and tier.is_active
          and tier.guest_count=guest_count
          and tier.threshold_nights<=(select hotel.minimum_stay_nights
            from public.hotels hotel where hotel.id=schedule.hotel_id)))
    )) then
    raise exception using errcode='23514',
      message='hotels_v2_admin_c_active_schedule_not_ready';
  end if;

  if exists(
    select 1 from public.hotel_rate_rules rule
    join public.hotel_room_rates rate on rate.id=rule.room_rate_id
    where rate.hotel_id=p_hotel_id and rule.is_active and rate.review_status<>'reviewed'
  ) then
    raise exception using errcode='23514',
      message='hotels_v2_admin_c_active_rule_requires_reviewed_room_rate';
  end if;

  if exists(select 1 from public.hotel_calendar_overrides override_row
    join public.hotel_room_rates rate on rate.id=override_row.room_rate_id
    where override_row.hotel_id=p_hotel_id
      and (override_row.nightly_rate_mode is not null
        or override_row.minimum_stay_mode is not null
        or override_row.maximum_stay_mode is not null)
      and rate.review_status<>'reviewed') then
    raise exception using errcode='23514',
      message='hotels_v2_admin_c_active_exact_price_requires_reviewed_room_rate';
  end if;

  if exists(
    select 1
    from public.hotel_rate_rules left_rule
    join public.hotel_rate_rules right_rule
      on right_rule.room_rate_id=left_rule.room_rate_id
     and right_rule.id>left_rule.id
     and right_rule.is_active and left_rule.is_active
     and right_rule.priority=left_rule.priority
     and daterange(right_rule.valid_from,right_rule.valid_to,'[]')
       && daterange(left_rule.valid_from,left_rule.valid_to,'[]')
     and (cardinality(right_rule.weekdays)=7)
       = (cardinality(left_rule.weekdays)=7)
     and right_rule.weekdays && left_rule.weekdays
    join public.hotel_room_rates rate on rate.id=left_rule.room_rate_id
    where rate.hotel_id=p_hotel_id
  ) then
    raise exception using errcode='23514',
      message='hotels_v2_admin_c_equal_priority_rate_rule_overlap';
  end if;

  -- The accepted H3.1P graph stays shadow-inactive. These checks also protect
  -- it from trusted direct writes, independently of browser RPC allowlists.
  if p_hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid and (
    exists(select 1 from public.hotel_rate_plans where id=
      '22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid and is_active)
    or exists(select 1 from public.hotel_room_rates where id in(
      '7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid,
      '3320590d-632d-423f-80d0-fd021cba7293'::uuid) and is_active)
    or exists(select 1 from public.hotel_pricing_schedules where id in(
      'b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid,
      '443065c0-984a-5de3-a22a-d03042c41107'::uuid) and is_active)
  ) then
    raise exception using errcode='23514',
      message='hotels_v2_admin_c_h3_1p_graph_must_remain_inactive';
  end if;
  if p_hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid and (
    exists(select 1 from public.hotel_rate_plans where hotel_id=p_hotel_id
      and id<>'22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid and is_active)
    or exists(select 1 from public.hotel_room_rates where hotel_id=p_hotel_id
      and id not in('7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid,
        '3320590d-632d-423f-80d0-fd021cba7293'::uuid) and is_active)
    or exists(select 1 from public.hotel_pricing_schedules where hotel_id=p_hotel_id
      and id not in('b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid,
        '443065c0-984a-5de3-a22a-d03042c41107'::uuid) and is_active)
    or exists(select 1 from public.site_settings setting
      where setting.id=1 and setting.hotel_rooms_v2_enabled)
  ) then
    raise exception using errcode='23514',
      message='hotels_v2_admin_c_7k_new_pricing_must_remain_inactive';
  end if;
end
$function$;

create function public.hotel_v2_admin_c_apply_tier_set_operation(
  p_hotel_id uuid,p_operation jsonb,p_correlation_id uuid,p_actor uuid
)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public
as $function$
declare
  v_rate_id uuid:=(p_operation->>'id')::uuid;
  v_expected bigint:=(p_operation->>'expected_version')::bigint;
  v_payload jsonb:=p_operation->'payload';
  v_original jsonb:=p_operation->'expected_original';
  v_rate public.hotel_room_rates%rowtype;
  v_tier public.hotel_room_rate_occupancy_tiers%rowtype;
  v_child jsonb; v_tier_id uuid; v_current jsonb; v_target jsonb;
  v_before jsonb; v_after jsonb; v_activity jsonb;
  v_changed boolean:=false;
begin
  select * into v_rate from public.hotel_room_rates
    where id=v_rate_id and hotel_id=p_hotel_id for update;
  if not found then
    raise exception using errcode='PT404',message='hotels_v2_admin_c_room_rate_not_found';
  end if;
  if v_rate.version<>v_expected then
    raise exception using errcode='PT409',message='hotels_v2_admin_c_stale_room_rate_tier_parent',
      detail=jsonb_build_object('entity','room_rate_tier_set','id',v_rate_id,
        'expected_version',v_expected,'current_version',v_rate.version)::text;
  end if;
  if exists(select 1 from public.hotel_room_rate_occupancy_tiers tier
      where tier.room_rate_id=v_rate_id and tier.source<>'manual') then
    raise exception using errcode='42501',
      message='hotels_v2_admin_c_nonmanual_room_rate_tiers_read_only';
  end if;
  if p_operation->>'expected_children_fingerprint' is distinct from
      public.hotel_v2_admin_c_room_tiers_fingerprint(v_rate_id) then
    raise exception using errcode='PT409',message='hotels_v2_admin_c_room_rate_tiers_stale';
  end if;
  if not public.hotel_v2_h2a_keys_allowed(v_payload,array['tiers'])
     or not (v_payload?'tiers') or jsonb_typeof(v_payload->'tiers')<>'array'
     or not public.hotel_v2_h2a_keys_allowed(v_original,array['tiers'])
     or not (v_original?'tiers') or jsonb_typeof(v_original->'tiers')<>'array'
     or jsonb_array_length(v_payload->'tiers')>500
     or jsonb_array_length(v_original->'tiers')>500 then
    raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_room_rate_tier_set';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',tier.id,'hotel_id',tier.hotel_id,'room_rate_id',tier.room_rate_id,
    'guest_count',tier.guest_count,'threshold_nights',tier.threshold_nights,
    'nightly_rate',tier.nightly_rate,'is_active',tier.is_active,'version',tier.version
  ) order by tier.guest_count,tier.threshold_nights,tier.id),'[]'::jsonb)
  into v_current from public.hotel_room_rate_occupancy_tiers tier
  where tier.room_rate_id=v_rate_id;
  v_before:=jsonb_build_object('tiers',v_current);
  if v_original<>v_before then
    raise exception using errcode='PT409',message='hotels_v2_admin_c_room_rate_tier_original_mismatch';
  end if;
  perform public.hotel_v2_admin_c_enforce_graph_limits(
    p_hotel_id,
    p_direct_tier_delta=>greatest(
      jsonb_array_length(v_payload->'tiers')-jsonb_array_length(v_current),0));
  if exists(select 1 from jsonb_array_elements(v_payload->'tiers') child
    group by child.value->>'id' having count(*)>1)
     or exists(select 1 from jsonb_array_elements(v_payload->'tiers') child
       group by child.value->>'guest_count',child.value->>'threshold_nights'
       having count(*)>1) then
    raise exception using errcode='22023',message='hotels_v2_admin_c_duplicate_room_rate_tier';
  end if;
  for v_child in select value from jsonb_array_elements(v_payload->'tiers') loop
    if jsonb_typeof(v_child)<>'object'
       or not public.hotel_v2_h2a_keys_allowed(v_child,array[
         'id','hotel_id','room_rate_id','guest_count','threshold_nights',
         'nightly_rate','is_active','version'])
       or not (v_child ?& array['id','hotel_id','room_rate_id','guest_count',
         'threshold_nights','nightly_rate','is_active','version'])
       or jsonb_typeof(v_child->'id')<>'string'
       or jsonb_typeof(v_child->'hotel_id')<>'string'
       or jsonb_typeof(v_child->'room_rate_id')<>'string'
       or jsonb_typeof(v_child->'guest_count')<>'number'
       or jsonb_typeof(v_child->'threshold_nights')<>'number'
       or jsonb_typeof(v_child->'nightly_rate')<>'number'
       or jsonb_typeof(v_child->'is_active')<>'boolean'
       or jsonb_typeof(v_child->'version')<>'number'
       or v_child->>'guest_count'!~'^[0-9]+$'
       or v_child->>'threshold_nights'!~'^[0-9]+$'
       or v_child->>'nightly_rate'!~'^[0-9]+(?:\.[0-9]{1,2})?$'
       or v_child->>'version'!~'^[0-9]+$' then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_room_rate_tier';
    end if;
    begin
      v_tier_id:=(v_child->>'id')::uuid;
      if (v_child->>'hotel_id')::uuid<>p_hotel_id
         or (v_child->>'room_rate_id')::uuid<>v_rate_id then
        raise exception using errcode='22023',message='hotels_v2_admin_c_foreign_room_rate_tier';
      end if;
    exception when invalid_text_representation then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_room_rate_tier_identity';
    end;
    if (v_child->>'guest_count')::integer not between 1 and 50
       or (v_child->>'threshold_nights')::integer not between 1 and 3650
       or (v_child->>'nightly_rate')::numeric>9999999999.99 then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_room_rate_tier_values';
    end if;
    select * into v_tier from public.hotel_room_rate_occupancy_tiers
      where id=v_tier_id for update;
    if found then
      if v_tier.hotel_id<>p_hotel_id or v_tier.room_rate_id<>v_rate_id
         or v_tier.version<>(v_child->>'version')::bigint then
        raise exception using errcode='PT409',message='hotels_v2_admin_c_stale_room_rate_tier';
      end if;
      v_current:=jsonb_build_object('guest_count',v_tier.guest_count,
        'threshold_nights',v_tier.threshold_nights,'nightly_rate',v_tier.nightly_rate,
        'is_active',v_tier.is_active);
      v_target:=jsonb_build_object('guest_count',(v_child->>'guest_count')::integer,
        'threshold_nights',(v_child->>'threshold_nights')::integer,
        'nightly_rate',(v_child->>'nightly_rate')::numeric,
        'is_active',(v_child->>'is_active')::boolean);
      if v_current<>v_target then
        update public.hotel_room_rate_occupancy_tiers set
          guest_count=(v_child->>'guest_count')::smallint,
          threshold_nights=(v_child->>'threshold_nights')::integer,
          nightly_rate=(v_child->>'nightly_rate')::numeric,
          is_active=(v_child->>'is_active')::boolean
        where id=v_tier_id;
        v_changed:=true;
      end if;
    else
      if v_child->>'version'<>'0' then
        raise exception using errcode='PT409',message='hotels_v2_admin_c_missing_room_rate_tier';
      end if;
      insert into public.hotel_room_rate_occupancy_tiers(
        id,hotel_id,room_rate_id,guest_count,threshold_nights,nightly_rate,
        is_active,source,provenance)
      values(v_tier_id,p_hotel_id,v_rate_id,(v_child->>'guest_count')::smallint,
        (v_child->>'threshold_nights')::integer,(v_child->>'nightly_rate')::numeric,
        (v_child->>'is_active')::boolean,'manual','{}'::jsonb);
      v_changed:=true;
    end if;
  end loop;
  delete from public.hotel_room_rate_occupancy_tiers tier
    where tier.room_rate_id=v_rate_id and not exists(
      select 1 from jsonb_array_elements(v_payload->'tiers') child
      where (child->>'id')::uuid=tier.id);
  if found then v_changed:=true; end if;
  if not v_changed then return jsonb_build_object('changed',false,'activity',null); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',tier.id,'hotel_id',tier.hotel_id,'room_rate_id',tier.room_rate_id,
    'guest_count',tier.guest_count,'threshold_nights',tier.threshold_nights,
    'nightly_rate',tier.nightly_rate,'is_active',tier.is_active,'version',tier.version
  ) order by tier.guest_count,tier.threshold_nights,tier.id),'[]'::jsonb)
  into v_current from public.hotel_room_rate_occupancy_tiers tier
  where tier.room_rate_id=v_rate_id;
  v_after:=jsonb_build_object('tiers',v_current,
    'tiers_fingerprint',public.hotel_v2_admin_c_room_tiers_fingerprint(v_rate_id));
  v_activity:=public.hotel_v2_admin_c_record_activity(p_hotel_id,'occupancy_tier',v_rate_id,
    'update',v_before,v_after,p_correlation_id,p_actor);
  return jsonb_build_object('changed',true,'activity',v_activity);
end
$function$;

create function public.hotel_v2_admin_c_apply_rate_rule_operation(
  p_hotel_id uuid,p_operation jsonb,p_correlation_id uuid,p_actor uuid
)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public
as $function$
declare
  v_id uuid:=(p_operation->>'id')::uuid; v_action text:=p_operation->>'action';
  v_expected bigint:=(p_operation->>'expected_version')::bigint;
  v_payload jsonb:=p_operation->'payload'; v_original jsonb:=p_operation->'expected_original';
  v_row public.hotel_rate_rules%rowtype; v_before jsonb; v_target jsonb; v_after jsonb;
  v_rate_id uuid; v_weekdays smallint[]; v_activity jsonb;
begin
  if v_action not in('create','update','disable') then
    raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_rate_rule_action';
  end if;
  if v_action<>'create' then
    select rule.* into v_row from public.hotel_rate_rules rule
      join public.hotel_room_rates rate on rate.id=rule.room_rate_id
      where rule.id=v_id and rate.hotel_id=p_hotel_id for update of rule;
    if not found then raise exception using errcode='PT404',message='hotels_v2_admin_c_rate_rule_not_found'; end if;
    if v_row.version<>v_expected then raise exception using errcode='PT409',
      message='hotels_v2_admin_c_stale_rate_rule',detail=jsonb_build_object(
        'entity','rate_rule','id',v_id,'expected_version',v_expected,
        'current_version',v_row.version)::text; end if;
    if v_row.source<>'manual' then
      raise exception using errcode='42501',
        message='hotels_v2_admin_c_nonmanual_rate_rule_read_only';
    end if;
    v_before:=jsonb_build_object('room_rate_id',v_row.room_rate_id,
      'valid_from',v_row.valid_from,'valid_to',v_row.valid_to,
      'weekdays',to_jsonb(v_row.weekdays),'nightly_rate',v_row.nightly_rate,
      'minimum_stay',v_row.minimum_stay,'maximum_stay',v_row.maximum_stay,
      'closed_to_arrival',v_row.closed_to_arrival,
      'closed_to_departure',v_row.closed_to_departure,
      'priority',v_row.priority,'is_active',v_row.is_active);
    if v_action in('update','disable') and v_original<>v_before then
      raise exception using errcode='PT409',message='hotels_v2_admin_c_rate_rule_original_mismatch';
    end if;
  elsif exists(select 1 from public.hotel_rate_rules where id=v_id) then
    raise exception using errcode='PT409',message='hotels_v2_admin_c_rate_rule_id_exists';
  end if;
  if v_action='disable' then
    if v_row.closed_to_arrival or v_row.closed_to_departure then
      raise exception using errcode='55000',
        message='hotels_v2_admin_c_rule_calendar_restriction_owned_by_admin_d';
    end if;
    if not v_row.is_active then return jsonb_build_object('changed',false,'activity',null); end if;
    update public.hotel_rate_rules set is_active=false where id=v_id;
  else
    if not public.hotel_v2_h2a_keys_allowed(v_payload,array[
      'room_rate_id','valid_from','valid_to','weekdays','nightly_rate','minimum_stay',
      'maximum_stay','closed_to_arrival','closed_to_departure','priority','is_active'])
      or not (v_payload ?& array['room_rate_id','valid_from','valid_to','weekdays',
        'nightly_rate','minimum_stay','maximum_stay','closed_to_arrival',
        'closed_to_departure','priority','is_active'])
      or jsonb_typeof(v_payload->'room_rate_id')<>'string'
      or jsonb_typeof(v_payload->'valid_from')<>'string'
      or jsonb_typeof(v_payload->'valid_to')<>'string'
      or jsonb_typeof(v_payload->'weekdays')<>'array'
      or jsonb_typeof(v_payload->'nightly_rate')<>'number'
      or jsonb_typeof(v_payload->'minimum_stay') not in('number','null')
      or jsonb_typeof(v_payload->'maximum_stay') not in('number','null')
      or jsonb_typeof(v_payload->'closed_to_arrival')<>'boolean'
      or jsonb_typeof(v_payload->'closed_to_departure')<>'boolean'
      or jsonb_typeof(v_payload->'priority')<>'number'
      or jsonb_typeof(v_payload->'is_active')<>'boolean'
      or v_payload->>'nightly_rate'!~'^[0-9]+(?:\.[0-9]{1,2})?$'
      or v_payload->>'priority'!~'^-[0-9]+$|^[0-9]+$'
      or (v_payload->>'minimum_stay' is not null and v_payload->>'minimum_stay'!~'^[0-9]+$')
      or (v_payload->>'maximum_stay' is not null and v_payload->>'maximum_stay'!~'^[0-9]+$')
      or exists(select 1 from jsonb_array_elements(v_payload->'weekdays') day
        where jsonb_typeof(day)<>'number' or day#>>'{}'!~'^[0-9]+$'
          or (day#>>'{}')::integer not between 1 and 7) then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_rate_rule_payload';
    end if;
    begin
      v_rate_id:=(v_payload->>'room_rate_id')::uuid;
      if not public.hotel_v2_admin_c_date_is_canonical(v_payload->>'valid_from')
         or not public.hotel_v2_admin_c_date_is_canonical(v_payload->>'valid_to') then
        raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_rate_rule_dates';
      end if;
    exception when invalid_text_representation or datetime_field_overflow then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_rate_rule_dates';
    end;
    if not exists(select 1 from public.hotel_room_rates
        where id=v_rate_id and hotel_id=p_hotel_id and review_status='reviewed')
       or (v_payload->>'valid_to')::date<(v_payload->>'valid_from')::date
       or (v_payload->>'nightly_rate')::numeric>9999999999.99
       or (v_payload->>'minimum_stay' is not null and
         (v_payload->>'minimum_stay')::integer not between 1 and 3650)
       or (v_payload->>'maximum_stay' is not null and
         (v_payload->>'maximum_stay')::integer not between 1 and 3650)
       or (v_payload->>'minimum_stay' is not null and v_payload->>'maximum_stay' is not null
         and (v_payload->>'maximum_stay')::integer<(v_payload->>'minimum_stay')::integer)
       or (v_payload->>'priority')::integer not between -32768 and 32767 then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_rate_rule_values';
    end if;
    select coalesce(array_agg(distinct (day#>>'{}')::smallint order by (day#>>'{}')::smallint),
      '{}'::smallint[]) into v_weekdays from jsonb_array_elements(v_payload->'weekdays') day;
    if cardinality(v_weekdays)<>jsonb_array_length(v_payload->'weekdays')
       or cardinality(v_weekdays) not between 1 and 7 then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_rate_rule_weekdays';
    end if;
    v_target:=jsonb_build_object('room_rate_id',v_rate_id,
      'valid_from',(v_payload->>'valid_from')::date,'valid_to',(v_payload->>'valid_to')::date,
      'weekdays',to_jsonb(v_weekdays),'nightly_rate',(v_payload->>'nightly_rate')::numeric,
      'minimum_stay',case when v_payload->>'minimum_stay' is null then null
        else (v_payload->>'minimum_stay')::integer end,
      'maximum_stay',case when v_payload->>'maximum_stay' is null then null
        else (v_payload->>'maximum_stay')::integer end,
      'closed_to_arrival',(v_payload->>'closed_to_arrival')::boolean,
      'closed_to_departure',(v_payload->>'closed_to_departure')::boolean,
      'priority',(v_payload->>'priority')::smallint,
      'is_active',(v_payload->>'is_active')::boolean);
    if v_action='update' and v_rate_id<>v_row.room_rate_id then
      raise exception using errcode='22023',
        message='hotels_v2_admin_c_rate_rule_identity_is_immutable';
    end if;
    if v_action='update' and v_row.is_active
       and not (v_target->>'is_active')::boolean then
      raise exception using errcode='22023',
        message='hotels_v2_admin_c_rate_rule_disable_action_required';
    end if;
    if (v_action='create' and ((v_target->>'closed_to_arrival')::boolean
          or (v_target->>'closed_to_departure')::boolean))
       or (v_action='update' and (
          (v_target->>'closed_to_arrival')::boolean<>v_row.closed_to_arrival
          or (v_target->>'closed_to_departure')::boolean<>v_row.closed_to_departure))
       or (v_action='update' and not (v_target->>'is_active')::boolean
          and (v_row.closed_to_arrival or v_row.closed_to_departure)) then
      raise exception using errcode='55000',
        message='hotels_v2_admin_c_rule_calendar_restriction_owned_by_admin_d';
    end if;
    if v_action='create' then
      perform public.hotel_v2_admin_c_enforce_graph_limits(
        p_hotel_id,p_rule_delta=>1);
      insert into public.hotel_rate_rules(id,room_rate_id,valid_from,valid_to,weekdays,
        nightly_rate,minimum_stay,maximum_stay,closed_to_arrival,closed_to_departure,
        priority,is_active,source,provenance)
      values(v_id,v_rate_id,(v_target->>'valid_from')::date,(v_target->>'valid_to')::date,
        v_weekdays,(v_target->>'nightly_rate')::numeric,
        (v_target->>'minimum_stay')::integer,(v_target->>'maximum_stay')::integer,
        (v_target->>'closed_to_arrival')::boolean,(v_target->>'closed_to_departure')::boolean,
        (v_target->>'priority')::smallint,(v_target->>'is_active')::boolean,'manual','{}'::jsonb);
    elsif v_target<>v_before then
      update public.hotel_rate_rules set room_rate_id=v_rate_id,
        valid_from=(v_target->>'valid_from')::date,valid_to=(v_target->>'valid_to')::date,
        weekdays=v_weekdays,nightly_rate=(v_target->>'nightly_rate')::numeric,
        minimum_stay=(v_target->>'minimum_stay')::integer,
        maximum_stay=(v_target->>'maximum_stay')::integer,
        closed_to_arrival=(v_target->>'closed_to_arrival')::boolean,
        closed_to_departure=(v_target->>'closed_to_departure')::boolean,
        priority=(v_target->>'priority')::smallint,is_active=(v_target->>'is_active')::boolean
      where id=v_id;
    else return jsonb_build_object('changed',false,'activity',null); end if;
  end if;
  select rule.* into v_row from public.hotel_rate_rules rule where id=v_id;
  v_after:=jsonb_build_object('room_rate_id',v_row.room_rate_id,
    'valid_from',v_row.valid_from,'valid_to',v_row.valid_to,'weekdays',to_jsonb(v_row.weekdays),
    'nightly_rate',v_row.nightly_rate,'minimum_stay',v_row.minimum_stay,
    'maximum_stay',v_row.maximum_stay,'closed_to_arrival',v_row.closed_to_arrival,
    'closed_to_departure',v_row.closed_to_departure,'priority',v_row.priority,
    'is_active',v_row.is_active);
  v_activity:=public.hotel_v2_admin_c_record_activity(p_hotel_id,'rate_rule',v_id,
    case when v_action='create' then 'create' when v_action='disable' then 'disable' else 'update' end,
    case when v_action='create' then null else v_before end,v_after,p_correlation_id,p_actor);
  return jsonb_build_object('changed',true,'activity',v_activity);
end
$function$;

create function public.hotel_v2_admin_c_apply_exact_price_operation(
  p_hotel_id uuid,p_operation jsonb,p_correlation_id uuid,p_actor uuid
)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public
as $function$
declare
  v_id uuid:=(p_operation->>'id')::uuid; v_action text:=p_operation->>'action';
  v_expected bigint:=(p_operation->>'expected_version')::bigint;
  v_payload jsonb:=p_operation->'payload'; v_original jsonb:=p_operation->'expected_original';
  v_row public.hotel_calendar_overrides%rowtype; v_before jsonb; v_target jsonb; v_after jsonb;
  v_audit_before jsonb; v_audit_after jsonb;
  v_rate_id uuid; v_stay_date date; v_reason text; v_activity jsonb;
  v_pricing_expires_at timestamptz;
  v_shared boolean; v_pricing_configured boolean;
begin
  if v_action not in('create','update','disable') then
    raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_exact_price_action';
  end if;
  if v_action<>'create' then
    select * into v_row from public.hotel_calendar_overrides
      where id=v_id and hotel_id=p_hotel_id for update;
    if not found then raise exception using errcode='PT404',message='hotels_v2_admin_c_exact_price_not_found'; end if;
    if v_row.version<>v_expected then raise exception using errcode='PT409',
      message='hotels_v2_admin_c_stale_exact_price',detail=jsonb_build_object(
        'entity','exact_date_price','id',v_id,'expected_version',v_expected,
        'current_version',v_row.version)::text; end if;
    if (v_row.nightly_rate_mode is not null or v_row.minimum_stay_mode is not null
          or v_row.maximum_stay_mode is not null)
       and v_row.pricing_source is distinct from 'manual' then
      raise exception using errcode='42501',
        message='hotels_v2_admin_c_nonmanual_exact_price_read_only';
    end if;
    v_before:=jsonb_build_object('nightly_rate_mode',v_row.nightly_rate_mode,
      'nightly_rate',v_row.nightly_rate,'minimum_stay_mode',v_row.minimum_stay_mode,
      'minimum_stay',v_row.minimum_stay,'maximum_stay_mode',v_row.maximum_stay_mode,
      'maximum_stay',v_row.maximum_stay,'reason',v_row.pricing_reason,
      'expires_at',v_row.pricing_expires_at);
    v_audit_before:=v_before||jsonb_build_object('pricing_source',v_row.pricing_source,
      'pricing_actor_type',v_row.pricing_actor_type,
      'pricing_actor_id',v_row.pricing_actor_id,
      'pricing_updated_at',v_row.pricing_updated_at,
      'pricing_correlation_id',v_row.pricing_correlation_id);
    if v_original<>v_before then
      raise exception using errcode='PT409',message='hotels_v2_admin_c_exact_price_original_mismatch';
    end if;
    v_rate_id:=v_row.room_rate_id; v_stay_date:=v_row.stay_date;
  elsif exists(select 1 from public.hotel_calendar_overrides where id=v_id) then
    raise exception using errcode='PT409',message='hotels_v2_admin_c_exact_price_id_exists';
  end if;
  if v_action='disable' then
    v_shared:=v_row.closed_mode is not null
      or v_row.closed_to_arrival_mode is not null
      or v_row.closed_to_departure_mode is not null
      or v_row.source<>'manual' or v_row.provenance<>'{}'::jsonb
      or v_row.reason<>'ADMIN-C pricing-only row';
    v_pricing_configured:=v_row.nightly_rate_mode is not null
      or v_row.minimum_stay_mode is not null or v_row.maximum_stay_mode is not null;
    if not v_pricing_configured then
      return jsonb_build_object('changed',false,'activity',null);
    end if;
    if v_shared then
      update public.hotel_calendar_overrides set nightly_rate=null,nightly_rate_mode=null,
        minimum_stay=null,minimum_stay_mode=null,maximum_stay=null,maximum_stay_mode=null,
        pricing_source=null,pricing_reason=null,pricing_expires_at=null,
        pricing_actor_type=null,pricing_actor_id=null,pricing_updated_at=null,
        pricing_correlation_id=null
      where id=v_id;
      select * into v_row from public.hotel_calendar_overrides where id=v_id;
      v_after:=jsonb_build_object('nightly_rate_mode',v_row.nightly_rate_mode,
        'nightly_rate',v_row.nightly_rate,'minimum_stay_mode',v_row.minimum_stay_mode,
        'minimum_stay',v_row.minimum_stay,'maximum_stay_mode',v_row.maximum_stay_mode,
        'maximum_stay',v_row.maximum_stay,'reason',v_row.pricing_reason,
        'expires_at',v_row.pricing_expires_at);
    else
      delete from public.hotel_calendar_overrides where id=v_id;
      v_after:=null;
    end if;
  else
    if not public.hotel_v2_h2a_keys_allowed(v_payload,
      case when v_action='create' then array['hotel_id','room_rate_id','stay_date',
        'nightly_rate_mode','nightly_rate','minimum_stay_mode','minimum_stay',
        'maximum_stay_mode','maximum_stay','reason','expires_at']
      else array['nightly_rate_mode','nightly_rate','minimum_stay_mode','minimum_stay',
        'maximum_stay_mode','maximum_stay','reason','expires_at'] end)
      or not (v_payload ?& (case when v_action='create' then array['hotel_id','room_rate_id',
        'stay_date','nightly_rate_mode','nightly_rate','minimum_stay_mode','minimum_stay',
        'maximum_stay_mode','maximum_stay','reason','expires_at']
      else array['nightly_rate_mode','nightly_rate','minimum_stay_mode','minimum_stay',
        'maximum_stay_mode','maximum_stay','reason','expires_at'] end)) then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_exact_price_payload';
    end if;
    if v_action='create' then
      if jsonb_typeof(v_payload->'hotel_id')<>'string'
         or jsonb_typeof(v_payload->'room_rate_id')<>'string'
         or jsonb_typeof(v_payload->'stay_date')<>'string'
         or jsonb_typeof(v_payload->'reason')<>'string'
         or jsonb_typeof(v_payload->'expires_at') not in('string','null') then
        raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_exact_price_identity';
      end if;
      begin
        if (v_payload->>'hotel_id')::uuid<>p_hotel_id then
          raise exception using errcode='22023',message='hotels_v2_admin_c_foreign_exact_price';
        end if;
        v_rate_id:=(v_payload->>'room_rate_id')::uuid;
        if not public.hotel_v2_admin_c_date_is_canonical(
             v_payload->>'stay_date') then
          raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_exact_price_date';
        end if;
        v_stay_date:=(v_payload->>'stay_date')::date;
      exception when invalid_text_representation or datetime_field_overflow then
        raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_exact_price_identity';
      end;
      if exists(select 1 from public.hotel_calendar_overrides
          where room_rate_id=v_rate_id and stay_date=v_stay_date) then
        raise exception using errcode='PT409',message='hotels_v2_admin_c_exact_date_row_exists',
          detail=(select jsonb_build_object('existing_id',id,'current_version',version)::text
            from public.hotel_calendar_overrides
            where room_rate_id=v_rate_id and stay_date=v_stay_date);
      end if;
    end if;
    if jsonb_typeof(v_payload->'reason')<>'string'
       or v_payload->>'reason'<>btrim(v_payload->>'reason')
       or length(v_payload->>'reason') not between 1 and 500
       or v_payload->>'reason'~'[[:cntrl:]]'
       or jsonb_typeof(v_payload->'expires_at') not in('string','null')
       or (jsonb_typeof(v_payload->'expires_at')='string' and not
         public.hotel_v2_admin_c_timestamptz_is_canonical(
           v_payload->>'expires_at'))
       or not exists(select 1 from public.hotel_room_rates
         where id=v_rate_id and hotel_id=p_hotel_id and review_status='reviewed') then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_exact_price_values';
    end if;
    begin
      v_reason:=v_payload->>'reason';
      v_pricing_expires_at:=case when v_payload->>'expires_at' is null then null
        else (v_payload->>'expires_at')::timestamptz end;
    exception when invalid_text_representation or datetime_field_overflow then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_exact_price_expiry';
    end;
    if v_pricing_expires_at is not null and v_pricing_expires_at<=clock_timestamp() then
      raise exception using errcode='22023',message='hotels_v2_admin_c_exact_price_expiry_not_future';
    end if;
    if jsonb_typeof(v_payload->'nightly_rate_mode') not in('string','null')
       or jsonb_typeof(v_payload->'minimum_stay_mode') not in('string','null')
       or jsonb_typeof(v_payload->'maximum_stay_mode') not in('string','null')
       or (jsonb_typeof(v_payload->'nightly_rate_mode')='string'
         and v_payload->>'nightly_rate_mode' not in('set','clear'))
       or (jsonb_typeof(v_payload->'minimum_stay_mode')='string'
         and v_payload->>'minimum_stay_mode' not in('set','clear'))
       or (jsonb_typeof(v_payload->'maximum_stay_mode')='string'
         and v_payload->>'maximum_stay_mode' not in('set','clear'))
       or jsonb_typeof(v_payload->'nightly_rate') not in('number','null')
       or jsonb_typeof(v_payload->'minimum_stay') not in('number','null')
       or jsonb_typeof(v_payload->'maximum_stay') not in('number','null')
       or (jsonb_typeof(v_payload->'nightly_rate_mode')='null'
         and jsonb_typeof(v_payload->'nightly_rate')<>'null')
       or (jsonb_typeof(v_payload->'minimum_stay_mode')='null'
         and jsonb_typeof(v_payload->'minimum_stay')<>'null')
       or (jsonb_typeof(v_payload->'maximum_stay_mode')='null'
         and jsonb_typeof(v_payload->'maximum_stay')<>'null')
       or (jsonb_typeof(v_payload->'nightly_rate_mode')='null'
         and jsonb_typeof(v_payload->'minimum_stay_mode')='null'
         and jsonb_typeof(v_payload->'maximum_stay_mode')='null')
       or (v_payload->>'nightly_rate_mode'='set' and (
         jsonb_typeof(v_payload->'nightly_rate')<>'number'
         or v_payload->>'nightly_rate'!~'^[0-9]+(?:\.[0-9]{1,2})?$'
         or (v_payload->>'nightly_rate')::numeric>9999999999.99))
       or (v_payload->>'nightly_rate_mode'='clear' and jsonb_typeof(v_payload->'nightly_rate')<>'null')
       or (v_payload->>'minimum_stay_mode'='set' and (
         jsonb_typeof(v_payload->'minimum_stay')<>'number'
         or v_payload->>'minimum_stay'!~'^[0-9]+$'
         or (v_payload->>'minimum_stay')::integer not between 1 and 3650))
       or (v_payload->>'minimum_stay_mode'='clear' and jsonb_typeof(v_payload->'minimum_stay')<>'null')
       or (v_payload->>'maximum_stay_mode'='set' and (
         jsonb_typeof(v_payload->'maximum_stay')<>'number'
         or v_payload->>'maximum_stay'!~'^[0-9]+$'
         or (v_payload->>'maximum_stay')::integer not between 1 and 3650))
       or (v_payload->>'maximum_stay_mode'='clear' and jsonb_typeof(v_payload->'maximum_stay')<>'null')
       or (v_payload->>'minimum_stay_mode'='set' and v_payload->>'maximum_stay_mode'='set'
         and (v_payload->>'maximum_stay')::integer<(v_payload->>'minimum_stay')::integer) then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_exact_price_modes';
    end if;
    v_target:=jsonb_build_object('nightly_rate_mode',v_payload->>'nightly_rate_mode',
      'nightly_rate',case when v_payload->>'nightly_rate_mode'='set'
        then (v_payload->>'nightly_rate')::numeric else null end,
      'minimum_stay_mode',v_payload->>'minimum_stay_mode',
      'minimum_stay',case when v_payload->>'minimum_stay_mode'='set'
        then (v_payload->>'minimum_stay')::integer else null end,
      'maximum_stay_mode',v_payload->>'maximum_stay_mode',
      'maximum_stay',case when v_payload->>'maximum_stay_mode'='set'
        then (v_payload->>'maximum_stay')::integer else null end,
      'reason',v_reason,'expires_at',v_pricing_expires_at);
    if v_action='create' then
      perform public.hotel_v2_admin_c_enforce_graph_limits(
        p_hotel_id,p_exact_delta=>1);
      insert into public.hotel_calendar_overrides(id,hotel_id,room_rate_id,stay_date,
        nightly_rate,nightly_rate_mode,minimum_stay,minimum_stay_mode,
        maximum_stay,maximum_stay_mode,reason,actor_id,actor_type,source,
        is_active,provenance,pricing_source,pricing_reason,pricing_expires_at,
        pricing_actor_type,pricing_actor_id,pricing_updated_at,pricing_correlation_id)
      values(v_id,p_hotel_id,v_rate_id,v_stay_date,
        (v_target->>'nightly_rate')::numeric,v_target->>'nightly_rate_mode',
        (v_target->>'minimum_stay')::integer,v_target->>'minimum_stay_mode',
        (v_target->>'maximum_stay')::integer,v_target->>'maximum_stay_mode',
        'ADMIN-C pricing-only row',p_actor,'admin','manual',true,'{}'::jsonb,
        'manual',v_reason,v_pricing_expires_at,'admin',p_actor,clock_timestamp(),
        p_correlation_id);
    elsif v_target<>v_before then
      update public.hotel_calendar_overrides set
        nightly_rate=(v_target->>'nightly_rate')::numeric,
        nightly_rate_mode=v_target->>'nightly_rate_mode',
        minimum_stay=(v_target->>'minimum_stay')::integer,
        minimum_stay_mode=v_target->>'minimum_stay_mode',
        maximum_stay=(v_target->>'maximum_stay')::integer,
        maximum_stay_mode=v_target->>'maximum_stay_mode',
        pricing_source='manual',pricing_reason=v_reason,
        pricing_expires_at=v_pricing_expires_at,pricing_actor_type='admin',
        pricing_actor_id=p_actor,pricing_updated_at=clock_timestamp(),
        pricing_correlation_id=p_correlation_id
      where id=v_id;
    else return jsonb_build_object('changed',false,'activity',null); end if;
    select * into v_row from public.hotel_calendar_overrides where id=v_id;
    v_after:=jsonb_build_object('nightly_rate_mode',v_row.nightly_rate_mode,
      'nightly_rate',v_row.nightly_rate,'minimum_stay_mode',v_row.minimum_stay_mode,
      'minimum_stay',v_row.minimum_stay,'maximum_stay_mode',v_row.maximum_stay_mode,
      'maximum_stay',v_row.maximum_stay,'reason',v_row.pricing_reason,
      'expires_at',v_row.pricing_expires_at);
  end if;
  if v_after is not null then
    v_audit_after:=v_after||jsonb_build_object('pricing_source',v_row.pricing_source,
      'pricing_actor_type',v_row.pricing_actor_type,
      'pricing_actor_id',v_row.pricing_actor_id,
      'pricing_updated_at',v_row.pricing_updated_at,
      'pricing_correlation_id',v_row.pricing_correlation_id);
  end if;
  v_activity:=public.hotel_v2_admin_c_record_activity(p_hotel_id,'calendar_override',v_id,
    case when v_action='create' then 'create' when v_action='disable' then 'disable' else 'update' end,
    case when v_action='create' then null else v_audit_before end,
    v_audit_after,p_correlation_id,p_actor);
  return jsonb_build_object('changed',true,'activity',v_activity);
end
$function$;

create function public.hotel_v2_admin_c_record_activity(
  p_hotel_id uuid,p_entity text,p_entity_id uuid,p_action text,
  p_before jsonb,p_after jsonb,p_correlation_id uuid,p_actor uuid
)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public
as $function$
declare v_id uuid; v_created timestamptz;
begin
  insert into public.hotel_activity_log(hotel_id,entity_type,entity_id,action,
    before_state,after_state,actor_type,actor_id,source,correlation_id)
  values(p_hotel_id,p_entity,p_entity_id,p_action,p_before,p_after,
    'admin',p_actor,'hotels_v2_admin_c_pricing_control',p_correlation_id)
  returning id,created_at into v_id,v_created;
  return jsonb_build_object('id',v_id,'entity_type',p_entity,'entity_id',p_entity_id,
    'action',p_action,'correlation_id',p_correlation_id,'actor_type','admin',
    'actor_id',p_actor,
    'source','hotels_v2_admin_c_pricing_control','created_at',v_created,
    'before_state',p_before,'after_state',p_after);
end
$function$;

create function public.hotel_v2_admin_c_apply_rate_plan_operation(
  p_hotel_id uuid,p_operation jsonb,p_correlation_id uuid,p_actor uuid
)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public
as $function$
declare v_id uuid:=(p_operation->>'id')::uuid; v_action text:=p_operation->>'action';
  v_expected bigint:=(p_operation->>'expected_version')::bigint;
  v_payload jsonb:=p_operation->'payload'; v_original jsonb:=p_operation->'expected_original';
  v_row public.hotel_rate_plans%rowtype; v_before jsonb; v_target jsonb; v_after jsonb;
  v_active boolean; v_review text; v_lifecycle text; v_inclusions text[];
  v_name jsonb; v_description jsonb; v_activity jsonb;
begin
  if v_action not in('create','update','disable') then
    raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_rate_plan_action';
  end if;
  if v_action<>'create' then
    select * into v_row from public.hotel_rate_plans where id=v_id and hotel_id=p_hotel_id for update;
    if not found then raise exception using errcode='PT404',message='hotels_v2_admin_c_rate_plan_not_found'; end if;
    if v_row.version<>v_expected then raise exception using errcode='PT409',
      message='hotels_v2_admin_c_stale_rate_plan',detail=jsonb_build_object(
        'entity','rate_plan','id',v_id,'expected_version',v_expected,
        'current_version',v_row.version)::text; end if;
    v_before:=jsonb_build_object('code',v_row.code,
      'name_i18n',public.hotel_v2_admin_c_i18n_canonical(v_row.name_i18n),
      'description_i18n',public.hotel_v2_admin_c_i18n_canonical(v_row.description_i18n,true),
      'meal_plan_code',v_row.meal_plan_code,'cancellation_policy',v_row.cancellation_policy,
      'booking_mode_override',v_row.booking_mode_override,
      'price_inclusions',public.hotel_v2_admin_c_string_set_canonical(v_row.price_inclusions),
      'lifecycle_status',public.hotel_v2_admin_c_lifecycle(v_row.is_active,v_row.review_status),
      'sort_order',v_row.sort_order);
    if v_action in('update','disable') and v_original<>v_before then
      raise exception using errcode='PT409',message='hotels_v2_admin_c_rate_plan_original_mismatch';
    end if;
  elsif exists(select 1 from public.hotel_rate_plans where id=v_id) then
    raise exception using errcode='PT409',message='hotels_v2_admin_c_rate_plan_id_exists';
  end if;
  if v_action='disable' then
    v_target:=v_before||jsonb_build_object('lifecycle_status','disabled');
  else
    if not public.hotel_v2_h2a_keys_allowed(v_payload,array[
      'code','name_i18n','description_i18n','meal_plan_code','cancellation_policy',
      'booking_mode_override','price_inclusions','lifecycle_status','sort_order'])
      or not (v_payload ?& array['code','name_i18n','description_i18n','meal_plan_code',
        'cancellation_policy','booking_mode_override','price_inclusions',
        'lifecycle_status','sort_order'])
      or jsonb_typeof(v_payload->'code')<>'string'
      or jsonb_typeof(v_payload->'name_i18n')<>'object'
      or jsonb_typeof(v_payload->'description_i18n')<>'object'
      or jsonb_typeof(v_payload->'meal_plan_code') not in('string','null')
      or jsonb_typeof(v_payload->'cancellation_policy')<>'object'
      or jsonb_typeof(v_payload->'booking_mode_override') not in('string','null')
      or jsonb_typeof(v_payload->'price_inclusions')<>'array'
      or jsonb_array_length(v_payload->'price_inclusions')>200
      or jsonb_typeof(v_payload->'lifecycle_status')<>'string'
      or jsonb_typeof(v_payload->'sort_order')<>'number'
      or v_payload->>'sort_order'!~'^[0-9]+$' then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_rate_plan_payload';
    end if;
    if not public.hotel_v2_admin_c_i18n_is_valid(v_payload->'name_i18n',false,240)
       or not public.hotel_v2_admin_c_i18n_is_valid(
         v_payload->'description_i18n',false,5000,true) then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_rate_plan_values';
    end if;
    v_name:=public.hotel_v2_admin_c_i18n_canonical(v_payload->'name_i18n');
    v_description:=public.hotel_v2_admin_c_i18n_canonical(
      v_payload->'description_i18n',true);
    if not public.hotel_v2_admin_c_i18n_is_valid(v_name,false,240)
       or not public.hotel_v2_admin_c_i18n_is_valid(v_description,false,5000,true)
       or btrim(v_payload->>'code')!~'^[a-z0-9][a-z0-9_-]{0,79}$'
       or v_payload->>'code'<>lower(btrim(v_payload->>'code'))
       or (v_payload->>'meal_plan_code' is not null and
         (v_payload->>'meal_plan_code'!~'^[a-z0-9][a-z0-9_-]{0,79}$'
          or v_payload->>'meal_plan_code'<>lower(btrim(v_payload->>'meal_plan_code'))))
       or not public.hotel_v2_admin_c_cancellation_policy_is_valid(
         v_payload->'cancellation_policy')
       or (v_payload->>'booking_mode_override' is not null and
         v_payload->>'booking_mode_override' not in(
           'request_confirmation','instant_booking','external_redirect'))
       or exists(select 1 from jsonb_array_elements(v_payload->'price_inclusions') item
         where jsonb_typeof(item)<>'string'
           or item#>>'{}'<>btrim(item#>>'{}')) then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_rate_plan_values';
    end if;
    select coalesce(array_agg(distinct value order by value),'{}'::text[]) into v_inclusions
      from jsonb_array_elements_text(v_payload->'price_inclusions') value;
    if cardinality(v_inclusions)<>jsonb_array_length(v_payload->'price_inclusions')
       or not public.hotel_v2_h3_1_codes_valid(v_inclusions)
       or (v_payload->>'sort_order')::integer>1000000 then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_rate_plan_codes';
    end if;
    v_lifecycle:=v_payload->>'lifecycle_status';
    if v_lifecycle not in('draft','inactive','active')
       or (v_lifecycle='active' and p_operation->>'activation_acknowledged'<>'true') then
      raise exception using errcode='22023',message='hotels_v2_admin_c_rate_plan_activation_not_acknowledged';
    end if;
    v_target:=jsonb_build_object('code',lower(btrim(v_payload->>'code')),
      'name_i18n',v_name,'description_i18n',v_description,
      'meal_plan_code',case when v_payload->>'meal_plan_code' is null then null
        else lower(btrim(v_payload->>'meal_plan_code')) end,
      'cancellation_policy',v_payload->'cancellation_policy',
      'booking_mode_override',v_payload->'booking_mode_override',
      'price_inclusions',to_jsonb(v_inclusions),'lifecycle_status',v_lifecycle,
      'sort_order',(v_payload->>'sort_order')::integer);
  end if;
  v_lifecycle:=v_target->>'lifecycle_status';
  v_active:=v_lifecycle='active';
  v_review:=case when v_lifecycle='draft' then 'requires_review'
    when v_lifecycle='disabled' then 'disabled' else 'reviewed' end;
  if exists(select 1 from public.hotel_rate_plans plan
      where plan.hotel_id=p_hotel_id and lower(plan.code)=lower(v_target->>'code')
        and plan.id<>v_id) then
    raise exception using errcode='PT409',
      message='hotels_v2_admin_c_rate_plan_code_conflict';
  end if;
  if v_action='create' then
    perform public.hotel_v2_admin_c_enforce_graph_limits(
      p_hotel_id,p_plan_delta=>1);
    insert into public.hotel_rate_plans(id,hotel_id,code,name_i18n,description_i18n,
      meal_plan_code,cancellation_policy,booking_mode_override,price_inclusions,
      is_active,review_status,sort_order)
    values(v_id,p_hotel_id,v_target->>'code',v_target->'name_i18n',
      v_target->'description_i18n',v_target->>'meal_plan_code',
      v_target->'cancellation_policy',v_target->>'booking_mode_override',v_inclusions,
      v_active,v_review,(v_target->>'sort_order')::integer);
  elsif v_target<>v_before then
    select coalesce(array_agg(value order by value),'{}'::text[]) into v_inclusions
      from jsonb_array_elements_text(v_target->'price_inclusions') value;
    update public.hotel_rate_plans set code=v_target->>'code',name_i18n=v_target->'name_i18n',
      description_i18n=v_target->'description_i18n',meal_plan_code=v_target->>'meal_plan_code',
      cancellation_policy=v_target->'cancellation_policy',
      booking_mode_override=v_target->>'booking_mode_override',price_inclusions=v_inclusions,
      is_active=v_active,review_status=v_review,sort_order=(v_target->>'sort_order')::integer
    where id=v_id;
  else
    return jsonb_build_object('changed',false,'activity',null);
  end if;
  select * into v_row from public.hotel_rate_plans where id=v_id;
  v_after:=jsonb_build_object('code',v_row.code,
    'name_i18n',public.hotel_v2_admin_c_i18n_canonical(v_row.name_i18n),
    'description_i18n',public.hotel_v2_admin_c_i18n_canonical(v_row.description_i18n,true),
    'meal_plan_code',v_row.meal_plan_code,'cancellation_policy',v_row.cancellation_policy,
    'booking_mode_override',v_row.booking_mode_override,
    'price_inclusions',public.hotel_v2_admin_c_string_set_canonical(v_row.price_inclusions),
    'lifecycle_status',public.hotel_v2_admin_c_lifecycle(v_row.is_active,v_row.review_status),
    'sort_order',v_row.sort_order);
  v_activity:=public.hotel_v2_admin_c_record_activity(p_hotel_id,'rate_plan',v_id,
    case when v_action='create' then 'create' when v_action='disable' then 'disable' else 'update' end,
    case when v_action='create' then null else v_before end,v_after,p_correlation_id,p_actor);
  return jsonb_build_object('changed',true,'activity',v_activity);
end
$function$;

create function public.hotel_v2_admin_c_i18n_canonical(
  p_value jsonb,p_allow_lf boolean default false
)
returns jsonb language sql immutable set search_path=pg_catalog
as $function$
  select case
    when p_value is null or jsonb_typeof(p_value)<>'object' then null
    when exists(select 1 from jsonb_each(p_value) entry
      where entry.key not in('pl','en','he')
        or jsonb_typeof(entry.value)<>'string'
        or replace(replace(entry.value#>>'{}',E'\r\n',E'\n'),E'\r',E'\n')
          <>btrim(replace(replace(entry.value#>>'{}',E'\r\n',E'\n'),E'\r',E'\n'))
        or left(replace(replace(entry.value#>>'{}',E'\r\n',E'\n'),E'\r',E'\n'),1)=E'\n'
        or right(replace(replace(entry.value#>>'{}',E'\r\n',E'\n'),E'\r',E'\n'),1)=E'\n'
        or case when p_allow_lf then
          replace(replace(replace(entry.value#>>'{}',E'\r\n',E'\n'),E'\r',E'\n'),E'\n','')
            ~'[[:cntrl:]]'
          else entry.value#>>'{}'~'[[:cntrl:]]' end) then null
    else coalesce((select jsonb_object_agg(entry.key,
      replace(replace(entry.value#>>'{}',E'\r\n',E'\n'),E'\r',E'\n') order by entry.key)
      from jsonb_each(p_value) entry),'{}'::jsonb)
  end
$function$;

create function public.hotel_v2_admin_c_string_set_canonical(p_value text[])
returns jsonb language sql immutable set search_path=pg_catalog
as $function$
  select coalesce(jsonb_agg(value order by value),'[]'::jsonb)
  from (select distinct btrim(code) value from unnest(coalesce(p_value,'{}'::text[])) code) codes
$function$;

revoke all on function public.hotel_v2_admin_c_i18n_canonical(jsonb,boolean)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_c_string_set_canonical(text[])
  from public,anon,authenticated,service_role;

create function public.hotel_v2_admin_c_apply_room_rate_operation(
  p_hotel_id uuid,p_operation jsonb,p_correlation_id uuid,p_actor uuid
)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public
as $function$
declare v_id uuid:=(p_operation->>'id')::uuid; v_action text:=p_operation->>'action';
  v_expected bigint:=(p_operation->>'expected_version')::bigint;
  v_payload jsonb:=p_operation->'payload'; v_original jsonb:=p_operation->'expected_original';
  v_row public.hotel_room_rates%rowtype; v_before jsonb; v_target jsonb; v_after jsonb;
  v_lifecycle text; v_active boolean; v_review text; v_activity jsonb;
  v_room_id uuid; v_plan_id uuid; v_schedule_id uuid; v_impact_schedule uuid;
  v_current_links jsonb; v_expected_links jsonb;
begin
  if v_action not in('create','update','disable') then
    raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_room_rate_action'; end if;
  if v_action<>'create' then
    select * into v_row from public.hotel_room_rates where id=v_id and hotel_id=p_hotel_id for update;
    if not found then raise exception using errcode='PT404',message='hotels_v2_admin_c_room_rate_not_found'; end if;
    if v_row.version<>v_expected then raise exception using errcode='PT409',
      message='hotels_v2_admin_c_stale_room_rate',detail=jsonb_build_object(
        'entity','room_rate','id',v_id,'expected_version',v_expected,
        'current_version',v_row.version)::text; end if;
    v_before:=jsonb_build_object('room_type_id',v_row.room_type_id,
      'rate_plan_id',v_row.rate_plan_id,'pricing_schedule_id',v_row.pricing_schedule_id,
      'base_nightly_rate',v_row.base_nightly_rate,'currency',v_row.currency,
      'external_redirect_url',v_row.external_redirect_url,
      'lifecycle_status',public.hotel_v2_admin_c_lifecycle(v_row.is_active,v_row.review_status),
      'sort_order',v_row.sort_order);
    if v_action in('update','disable') and v_original<>v_before then
      raise exception using errcode='PT409',message='hotels_v2_admin_c_room_rate_original_mismatch'; end if;
  elsif exists(select 1 from public.hotel_room_rates where id=v_id) then
    raise exception using errcode='PT409',message='hotels_v2_admin_c_room_rate_id_exists';
  end if;
  if v_action='disable' then
    v_target:=v_before||jsonb_build_object('lifecycle_status','disabled');
  else
    if not public.hotel_v2_h2a_keys_allowed(v_payload,array[
      'room_type_id','rate_plan_id','pricing_schedule_id','base_nightly_rate',
      'currency','external_redirect_url','lifecycle_status','sort_order'])
      or not (v_payload ?& array['room_type_id','rate_plan_id','pricing_schedule_id',
        'base_nightly_rate','currency','external_redirect_url','lifecycle_status','sort_order'])
      or jsonb_typeof(v_payload->'room_type_id')<>'string'
      or jsonb_typeof(v_payload->'rate_plan_id')<>'string'
      or jsonb_typeof(v_payload->'pricing_schedule_id') not in('string','null')
      or jsonb_typeof(v_payload->'base_nightly_rate')<>'number'
      or v_payload->>'base_nightly_rate'!~'^[0-9]+(?:\.[0-9]{1,2})?$'
      or jsonb_typeof(v_payload->'currency')<>'string'
      or jsonb_typeof(v_payload->'external_redirect_url') not in('string','null')
      or jsonb_typeof(v_payload->'lifecycle_status')<>'string'
      or jsonb_typeof(v_payload->'sort_order')<>'number'
      or v_payload->>'sort_order'!~'^[0-9]+$' then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_room_rate_payload'; end if;
    begin
      v_room_id:=(v_payload->>'room_type_id')::uuid;
      v_plan_id:=(v_payload->>'rate_plan_id')::uuid;
      v_schedule_id:=case when v_payload->>'pricing_schedule_id' is null then null
        else (v_payload->>'pricing_schedule_id')::uuid end;
    exception when others then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_room_rate_relationship'; end;
    if not exists(select 1 from public.hotel_room_types where id=v_room_id and hotel_id=p_hotel_id)
       or not exists(select 1 from public.hotel_rate_plans where id=v_plan_id and hotel_id=p_hotel_id)
       or (v_schedule_id is not null and not exists(select 1 from public.hotel_pricing_schedules
          where id=v_schedule_id and hotel_id=p_hotel_id and application_scope='room_occupancy'))
       or v_payload->>'currency'!~'^[A-Z]{3}$'
       or v_payload->>'currency'<>(select hotel.currency from public.hotels hotel
         where hotel.id=p_hotel_id)
       or (v_schedule_id is not null and v_payload->>'currency'<>
         (select schedule.currency from public.hotel_pricing_schedules schedule
          where schedule.id=v_schedule_id))
       or (v_payload->>'base_nightly_rate')::numeric>9999999999.99
       or (v_payload->>'external_redirect_url' is not null and
          not public.hotel_v2_admin_c_https_url_is_valid(
            v_payload->>'external_redirect_url'))
       or (v_payload->>'sort_order')::integer>1000000 then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_room_rate_values'; end if;
    v_lifecycle:=v_payload->>'lifecycle_status';
    if v_lifecycle not in('draft','inactive','active')
       or (v_lifecycle='active' and p_operation->>'activation_acknowledged'<>'true') then
      raise exception using errcode='22023',message='hotels_v2_admin_c_room_rate_activation_not_acknowledged'; end if;
    v_target:=jsonb_build_object('room_type_id',v_room_id,'rate_plan_id',v_plan_id,
      'pricing_schedule_id',v_schedule_id,
      'base_nightly_rate',(v_payload->>'base_nightly_rate')::numeric(12,2),
      'currency',v_payload->>'currency',
      'external_redirect_url',v_payload->'external_redirect_url',
      'lifecycle_status',v_lifecycle,'sort_order',(v_payload->>'sort_order')::integer);
  end if;

  if v_action='update' and ((v_target->>'room_type_id')::uuid<>v_row.room_type_id
      or (v_target->>'rate_plan_id')::uuid<>v_row.rate_plan_id) then
    raise exception using errcode='22023',
      message='hotels_v2_admin_c_room_rate_identity_is_immutable';
  end if;

  if (v_action='create' and v_schedule_id is not null)
     or (v_action<>'create' and (v_before->>'pricing_schedule_id') is distinct from
      (v_target->>'pricing_schedule_id')) then
    v_impact_schedule:=case when v_action<>'create'
        and v_before->>'pricing_schedule_id' is not null
      then (v_before->>'pricing_schedule_id')::uuid
      else (v_target->>'pricing_schedule_id')::uuid end;
    select coalesce(jsonb_agg(rate.id order by rate.id),'[]'::jsonb) into v_current_links
      from public.hotel_room_rates rate where rate.pricing_schedule_id=v_impact_schedule;
    v_expected_links:=p_operation->'expected_linked_room_rate_ids';
    if p_operation->>'expected_link_fingerprint' is null
       or p_operation->>'expected_link_fingerprint'<>
          public.hotel_v2_admin_c_schedule_link_fingerprint(v_impact_schedule)
       or v_expected_links<>v_current_links
       or p_operation->>'shared_impact_acknowledged'<>'true' then
      raise exception using errcode='PT409',message='hotels_v2_admin_c_schedule_link_impact_stale'; end if;
  end if;
  v_lifecycle:=v_target->>'lifecycle_status'; v_active:=v_lifecycle='active';
  v_review:=case when v_lifecycle='draft' then 'requires_review'
    when v_lifecycle='disabled' then 'disabled' else 'reviewed' end;
  if v_action='create' and exists(select 1 from public.hotel_room_rates rate
      where rate.hotel_id=p_hotel_id and rate.room_type_id=v_room_id
        and rate.rate_plan_id=v_plan_id) then
    raise exception using errcode='PT409',
      message='hotels_v2_admin_c_room_rate_pair_conflict';
  end if;
  if v_schedule_id is not null
     and (v_action='create' or v_row.pricing_schedule_id is distinct from v_schedule_id)
     and (select count(*) from public.hotel_room_rates rate
       where rate.pricing_schedule_id=v_schedule_id)>=1000 then
    raise exception using errcode='54000',
      message='hotels_v2_admin_c_technical_limit_exceeded',
      detail=jsonb_build_object('pricing_schedule_id',v_schedule_id,
        'schedule_links',1001,'limit',1000)::text;
  end if;
  if v_action='create' then
    perform public.hotel_v2_admin_c_enforce_graph_limits(
      p_hotel_id,p_rate_delta=>1);
    insert into public.hotel_room_rates(id,hotel_id,room_type_id,rate_plan_id,
      pricing_schedule_id,base_nightly_rate,currency,external_redirect_url,
      is_active,review_status,sort_order)
    values(v_id,p_hotel_id,v_room_id,v_plan_id,v_schedule_id,
      (v_target->>'base_nightly_rate')::numeric, v_target->>'currency',
      v_target->>'external_redirect_url',v_active,v_review,(v_target->>'sort_order')::integer);
  elsif v_target<>v_before then
    update public.hotel_room_rates set room_type_id=(v_target->>'room_type_id')::uuid,
      rate_plan_id=(v_target->>'rate_plan_id')::uuid,
      pricing_schedule_id=(v_target->>'pricing_schedule_id')::uuid,
      base_nightly_rate=(v_target->>'base_nightly_rate')::numeric,
      currency=v_target->>'currency',external_redirect_url=v_target->>'external_redirect_url',
      is_active=v_active,review_status=v_review,sort_order=(v_target->>'sort_order')::integer
    where id=v_id;
  else return jsonb_build_object('changed',false,'activity',null); end if;
  select * into v_row from public.hotel_room_rates where id=v_id;
  v_after:=jsonb_build_object('room_type_id',v_row.room_type_id,
    'rate_plan_id',v_row.rate_plan_id,'pricing_schedule_id',v_row.pricing_schedule_id,
    'base_nightly_rate',v_row.base_nightly_rate,'currency',v_row.currency,
    'external_redirect_url',v_row.external_redirect_url,
    'lifecycle_status',public.hotel_v2_admin_c_lifecycle(v_row.is_active,v_row.review_status),
    'sort_order',v_row.sort_order);
  v_activity:=public.hotel_v2_admin_c_record_activity(p_hotel_id,'room_rate',v_id,
    case when v_action='create' then 'create' when v_action='disable' then 'disable' else 'update' end,
    case when v_action='create' then null else v_before end,v_after,p_correlation_id,p_actor);
  return jsonb_build_object('changed',true,'activity',v_activity);
end
$function$;

create function public.hotel_v2_admin_c_apply_schedule_operation(
  p_hotel_id uuid,p_operation jsonb,p_correlation_id uuid,p_actor uuid
)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public
as $function$
declare v_id uuid:=(p_operation->>'id')::uuid; v_action text:=p_operation->>'action';
  v_expected bigint:=(p_operation->>'expected_version')::bigint;
  v_payload jsonb:=p_operation->'payload'; v_original jsonb:=p_operation->'expected_original';
  v_row public.hotel_pricing_schedules%rowtype; v_source public.hotel_pricing_schedules%rowtype;
  v_tier public.hotel_pricing_schedule_occupancy_tiers%rowtype;
  v_before jsonb; v_target jsonb; v_after jsonb; v_tiers jsonb; v_current_tiers jsonb;
  v_child jsonb; v_tier_id uuid; v_child_changed boolean:=false; v_parent_changed boolean:=false;
  v_lifecycle text; v_active boolean; v_review text; v_activity jsonb; v_source_id uuid;
  v_links jsonb:='[]'::jsonb; v_expected_links jsonb;
  v_semantic_source jsonb; v_semantic_target jsonb;
  v_child_current jsonb; v_child_target jsonb;
begin
  if v_action='clone' then
    if not public.hotel_v2_h2a_keys_allowed(v_payload,array[
      'source_schedule_id','expected_source_version','code','name_i18n','sharing_mode','tiers'])
       or not (v_payload ?& array['source_schedule_id','expected_source_version','code',
         'name_i18n','sharing_mode','tiers'])
       or jsonb_typeof(v_payload->'source_schedule_id')<>'string'
       or jsonb_typeof(v_payload->'expected_source_version')<>'number'
       or v_payload->>'expected_source_version'!~'^[0-9]+$'
       or jsonb_typeof(v_payload->'code')<>'string'
       or jsonb_typeof(v_payload->'name_i18n')<>'object'
       or jsonb_typeof(v_payload->'sharing_mode')<>'string'
       or jsonb_typeof(v_payload->'tiers')<>'array'
       or jsonb_array_length(v_payload->'tiers')>500 then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_schedule_clone'; end if;
    v_source_id:=(v_payload->>'source_schedule_id')::uuid;
    select * into v_source from public.hotel_pricing_schedules
      where id=v_source_id and hotel_id=p_hotel_id for update;
    if not found then raise exception using errcode='PT404',message='hotels_v2_admin_c_clone_source_not_found'; end if;
    select coalesce(jsonb_agg(rate.id order by rate.id),'[]'::jsonb) into v_links
      from public.hotel_room_rates rate where rate.pricing_schedule_id=v_source.id;
    if v_source.version<>(v_payload->>'expected_source_version')::bigint
       or p_operation->>'expected_children_fingerprint' is distinct from
          public.hotel_v2_admin_c_schedule_tiers_fingerprint(v_source.id)
       or p_operation->>'expected_link_fingerprint' is distinct from
          public.hotel_v2_admin_c_schedule_link_fingerprint(v_source.id)
       or p_operation->'expected_linked_room_rate_ids'<>v_links
       or (jsonb_array_length(v_links)>0
         and p_operation->>'shared_impact_acknowledged'<>'true') then
      raise exception using errcode='PT409',message='hotels_v2_admin_c_clone_source_stale'; end if;
    if exists(select 1 from public.hotel_pricing_schedules where id=v_id) then
      raise exception using errcode='PT409',message='hotels_v2_admin_c_clone_target_exists'; end if;
    if v_source.application_scope<>'room_occupancy'
       or v_payload->>'sharing_mode' not in('shared','independent')
       or btrim(v_payload->>'code')!~'^[a-z0-9][a-z0-9_-]{0,79}$'
       or v_payload->>'code'<>lower(btrim(v_payload->>'code'))
       or not public.hotel_v2_admin_c_i18n_is_valid(
         v_payload->'name_i18n',false,240)
       or exists(select 1 from jsonb_array_elements(v_payload->'tiers') child
         group by child.value->>'id' having count(*)>1)
       or exists(select 1 from jsonb_array_elements(v_payload->'tiers') child
         group by child.value->>'guest_count',child.value->>'threshold_nights'
         having count(*)>1) then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_clone_target'; end if;
    for v_child in select value from jsonb_array_elements(v_payload->'tiers') loop
      if jsonb_typeof(v_child)<>'object'
         or not public.hotel_v2_h2a_keys_allowed(v_child,array[
          'id','schedule_id','guest_count','threshold_nights','nightly_rate','is_active','version'])
         or not (v_child ?& array['id','schedule_id','guest_count','threshold_nights',
          'nightly_rate','is_active','version'])
         or jsonb_typeof(v_child->'id')<>'string'
         or jsonb_typeof(v_child->'schedule_id')<>'string'
         or jsonb_typeof(v_child->'guest_count')<>'number'
         or jsonb_typeof(v_child->'threshold_nights')<>'number'
         or jsonb_typeof(v_child->'nightly_rate')<>'number'
         or jsonb_typeof(v_child->'is_active')<>'boolean'
         or jsonb_typeof(v_child->'version')<>'number'
         or (v_child->>'schedule_id')::uuid<>v_id
         or v_child->>'version'<>'0'
         or v_child->>'guest_count'!~'^[0-9]+$'
         or (v_child->>'guest_count')::integer not between 1 and 50
         or v_child->>'threshold_nights'!~'^[0-9]+$'
         or (v_child->>'threshold_nights')::integer not between 1 and 3650
         or v_child->>'nightly_rate'!~'^[0-9]+(?:\.[0-9]{1,2})?$'
         or (v_child->>'nightly_rate')::numeric>9999999999.99 then
        raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_clone_tier';
      end if;
    end loop;
    select coalesce(jsonb_agg(jsonb_build_object('guest_count',tier.guest_count,
      'threshold_nights',tier.threshold_nights,'nightly_rate',tier.nightly_rate,
      'is_active',tier.is_active) order by tier.guest_count,tier.threshold_nights),'[]'::jsonb)
      into v_semantic_source from public.hotel_pricing_schedule_occupancy_tiers tier
      where tier.schedule_id=v_source.id;
    select coalesce(jsonb_agg(jsonb_build_object('guest_count',(child.value->>'guest_count')::integer,
      'threshold_nights',(child.value->>'threshold_nights')::integer,
      'nightly_rate',(child.value->>'nightly_rate')::numeric,
      'is_active',(child.value->>'is_active')::boolean)
      order by (child.value->>'guest_count')::integer,(child.value->>'threshold_nights')::integer),
      '[]'::jsonb) into v_semantic_target
      from jsonb_array_elements(v_payload->'tiers') child(value);
    if v_semantic_target<>v_semantic_source then
      raise exception using errcode='22023',message='hotels_v2_admin_c_clone_tiers_not_exact_copy'; end if;
    if exists(select 1 from public.hotel_pricing_schedules schedule
        where schedule.hotel_id=p_hotel_id
          and schedule.code=lower(btrim(v_payload->>'code')) and schedule.id<>v_id) then
      raise exception using errcode='PT409',
        message='hotels_v2_admin_c_schedule_code_conflict';
    end if;
    perform public.hotel_v2_admin_c_enforce_graph_limits(
      p_hotel_id,p_schedule_delta=>1,
      p_schedule_tier_delta=>jsonb_array_length(v_payload->'tiers'));
    insert into public.hotel_pricing_schedules(id,hotel_id,code,name_i18n,application_scope,
      currency,maximum_party_size,minimum_billable_occupancy,is_active,review_status,
      source,source_reference,sharing_mode)
    values(v_id,p_hotel_id,lower(btrim(v_payload->>'code')),
      public.hotel_v2_admin_c_i18n_canonical(v_payload->'name_i18n'),
      v_source.application_scope,v_source.currency,v_source.maximum_party_size,
      v_source.minimum_billable_occupancy,false,'requires_review','manual',
      jsonb_build_object('cloned_from_schedule_id',v_source.id),v_payload->>'sharing_mode');
    for v_child in select value from jsonb_array_elements(v_payload->'tiers') loop
      v_tier_id:=(v_child->>'id')::uuid;
      if exists(select 1 from public.hotel_pricing_schedule_occupancy_tiers where id=v_tier_id) then
        raise exception using errcode='PT409',message='hotels_v2_admin_c_clone_tier_id_exists'; end if;
      insert into public.hotel_pricing_schedule_occupancy_tiers(id,schedule_id,guest_count,
        threshold_nights,nightly_rate,is_active)
      values(v_tier_id,v_id,(v_child->>'guest_count')::smallint,
        (v_child->>'threshold_nights')::integer,(v_child->>'nightly_rate')::numeric,
        (v_child->>'is_active')::boolean);
    end loop;
    v_after:=jsonb_build_object('source_schedule_id',v_source.id,'target_schedule_id',v_id,
      'sharing_mode',v_payload->>'sharing_mode','lifecycle_status','draft',
      'tiers_fingerprint',public.hotel_v2_admin_c_schedule_tiers_fingerprint(v_id));
    v_activity:=public.hotel_v2_admin_c_record_activity(p_hotel_id,'pricing_schedule',v_id,
      'duplicate',null,v_after,p_correlation_id,p_actor);
    return jsonb_build_object('changed',true,'activity',v_activity);
  end if;

  if v_action not in('create','update','disable') then
    raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_schedule_action'; end if;
  if v_action<>'create' then
    select * into v_row from public.hotel_pricing_schedules where id=v_id and hotel_id=p_hotel_id for update;
    if not found then raise exception using errcode='PT404',message='hotels_v2_admin_c_schedule_not_found'; end if;
    if v_row.version<>v_expected then raise exception using errcode='PT409',
      message='hotels_v2_admin_c_stale_schedule'; end if;
    if v_row.source<>'manual' then
      raise exception using errcode='42501',
        message='hotels_v2_admin_c_nonmanual_schedule_read_only';
    end if;
    if p_operation->>'expected_children_fingerprint' is distinct from
       public.hotel_v2_admin_c_schedule_tiers_fingerprint(v_id) then
      raise exception using errcode='PT409',message='hotels_v2_admin_c_schedule_tiers_stale'; end if;
    select coalesce(jsonb_agg(rate.id order by rate.id),'[]'::jsonb) into v_links
      from public.hotel_room_rates rate where rate.pricing_schedule_id=v_id;
    if p_operation->>'expected_link_fingerprint' is distinct from
       public.hotel_v2_admin_c_schedule_link_fingerprint(v_id)
       or p_operation->'expected_linked_room_rate_ids'<>v_links then
      raise exception using errcode='PT409',message='hotels_v2_admin_c_schedule_links_stale'; end if;
    select coalesce(jsonb_agg(jsonb_build_object('id',tier.id,'schedule_id',tier.schedule_id,
      'guest_count',tier.guest_count,'threshold_nights',tier.threshold_nights,
      'nightly_rate',tier.nightly_rate,'is_active',tier.is_active,'version',tier.version)
      order by tier.guest_count,tier.threshold_nights,tier.id),'[]'::jsonb)
      into v_current_tiers from public.hotel_pricing_schedule_occupancy_tiers tier
      where tier.schedule_id=v_id;
    v_before:=jsonb_build_object('code',v_row.code,
      'name_i18n',public.hotel_v2_admin_c_i18n_canonical(v_row.name_i18n),
      'application_scope',v_row.application_scope,'currency',v_row.currency,
      'maximum_party_size',v_row.maximum_party_size,
      'minimum_billable_occupancy',v_row.minimum_billable_occupancy,
      'sharing_mode',v_row.sharing_mode,
      'lifecycle_status',public.hotel_v2_admin_c_lifecycle(v_row.is_active,v_row.review_status),
      'tiers',v_current_tiers);
    if v_action in('update','disable') and v_original<>v_before then
      raise exception using errcode='PT409',message='hotels_v2_admin_c_schedule_original_mismatch'; end if;
  elsif exists(select 1 from public.hotel_pricing_schedules where id=v_id) then
    raise exception using errcode='PT409',message='hotels_v2_admin_c_schedule_id_exists';
  end if;
  if v_action='disable' then v_target:=v_before||jsonb_build_object('lifecycle_status','disabled');
  else
    if not public.hotel_v2_h2a_keys_allowed(v_payload,array['code','name_i18n',
      'application_scope','currency','maximum_party_size','minimum_billable_occupancy',
      'sharing_mode','lifecycle_status','tiers'])
      or not (v_payload ?& array['code','name_i18n','application_scope','currency',
        'maximum_party_size','minimum_billable_occupancy','sharing_mode','lifecycle_status','tiers'])
      or jsonb_typeof(v_payload->'code')<>'string'
      or jsonb_typeof(v_payload->'name_i18n')<>'object'
      or jsonb_typeof(v_payload->'application_scope')<>'string'
      or jsonb_typeof(v_payload->'currency')<>'string'
      or jsonb_typeof(v_payload->'maximum_party_size')<>'number'
      or jsonb_typeof(v_payload->'minimum_billable_occupancy')<>'number'
      or jsonb_typeof(v_payload->'sharing_mode')<>'string'
      or jsonb_typeof(v_payload->'lifecycle_status')<>'string'
      or jsonb_typeof(v_payload->'tiers')<>'array'
      or jsonb_array_length(v_payload->'tiers')>500
      or v_payload->>'maximum_party_size'!~'^[0-9]+$'
      or v_payload->>'minimum_billable_occupancy'!~'^[0-9]+$' then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_schedule_payload'; end if;
    v_tiers:=v_payload->'tiers'; v_lifecycle:=v_payload->>'lifecycle_status';
    if btrim(v_payload->>'code')!~'^[a-z0-9][a-z0-9_-]{0,79}$'
       or v_payload->>'code'<>lower(btrim(v_payload->>'code'))
       or v_payload->>'application_scope'<>'room_occupancy'
       or v_payload->>'currency'!~'^[A-Z]{3}$'
       or (v_payload->>'maximum_party_size')::integer not between 1 and 50
       or (v_payload->>'minimum_billable_occupancy')::integer not between 1 and
          (v_payload->>'maximum_party_size')::integer
       or v_payload->>'sharing_mode' not in('shared','independent')
       or v_lifecycle not in('draft','inactive','active')
       or not public.hotel_v2_admin_c_i18n_is_valid(
          v_payload->'name_i18n',false,240)
       or exists(select 1 from jsonb_array_elements(v_payload->'tiers') child
         group by child.value->>'id' having count(*)>1)
       or exists(select 1 from jsonb_array_elements(v_payload->'tiers') child
         group by child.value->>'guest_count',child.value->>'threshold_nights'
         having count(*)>1)
       or (v_lifecycle='active' and p_operation->>'activation_acknowledged'<>'true') then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_schedule_values'; end if;
    if (v_payload->>'sharing_mode'='shared'
       or coalesce(v_before->>'sharing_mode','')='shared') and jsonb_array_length(v_links)>0
       and p_operation->>'shared_impact_acknowledged'<>'true' then
      raise exception using errcode='22023',message='hotels_v2_admin_c_shared_impact_not_acknowledged'; end if;
    v_target:=jsonb_build_object('code',lower(btrim(v_payload->>'code')),
      'name_i18n',public.hotel_v2_admin_c_i18n_canonical(v_payload->'name_i18n'),
      'application_scope',v_payload->>'application_scope','currency',v_payload->>'currency',
      'maximum_party_size',(v_payload->>'maximum_party_size')::integer,
      'minimum_billable_occupancy',(v_payload->>'minimum_billable_occupancy')::integer,
      'sharing_mode',v_payload->>'sharing_mode','lifecycle_status',v_lifecycle,'tiers',v_tiers);
  end if;
  if v_action='disable' and jsonb_array_length(v_links)>0
     and p_operation->>'shared_impact_acknowledged'<>'true' then
    raise exception using errcode='22023',
      message='hotels_v2_admin_c_linked_schedule_disable_not_acknowledged';
  end if;
  v_lifecycle:=v_target->>'lifecycle_status'; v_active:=v_lifecycle='active';
  v_review:=case when v_lifecycle='draft' then 'requires_review'
    when v_lifecycle='disabled' then 'disabled' else 'reviewed' end;
  if exists(select 1 from public.hotel_pricing_schedules schedule
      where schedule.hotel_id=p_hotel_id and schedule.code=v_target->>'code'
        and schedule.id<>v_id) then
    raise exception using errcode='PT409',
      message='hotels_v2_admin_c_schedule_code_conflict';
  end if;
  if v_action<>'disable' then
    perform public.hotel_v2_admin_c_enforce_graph_limits(
      p_hotel_id,
      p_schedule_delta=>case when v_action='create' then 1 else 0 end,
      p_schedule_tier_delta=>greatest(jsonb_array_length(v_target->'tiers')-
        coalesce(jsonb_array_length(v_current_tiers),0),0));
  end if;
  if v_action='create' then
    insert into public.hotel_pricing_schedules(id,hotel_id,code,name_i18n,application_scope,
      currency,maximum_party_size,minimum_billable_occupancy,is_active,review_status,
      source,source_reference,sharing_mode)
    values(v_id,p_hotel_id,v_target->>'code',v_target->'name_i18n',
      v_target->>'application_scope',v_target->>'currency',
      (v_target->>'maximum_party_size')::integer,
      (v_target->>'minimum_billable_occupancy')::integer,v_active,v_review,
      'manual','{}'::jsonb,v_target->>'sharing_mode');
    v_parent_changed:=true;
  elsif (v_target-'tiers')<>(v_before-'tiers') then
    update public.hotel_pricing_schedules set code=v_target->>'code',name_i18n=v_target->'name_i18n',
      application_scope=v_target->>'application_scope',currency=v_target->>'currency',
      maximum_party_size=(v_target->>'maximum_party_size')::integer,
      minimum_billable_occupancy=(v_target->>'minimum_billable_occupancy')::integer,
      sharing_mode=v_target->>'sharing_mode',is_active=v_active,review_status=v_review
    where id=v_id; v_parent_changed:=true;
  end if;
  if v_action<>'disable' then
    for v_child in select value from jsonb_array_elements(v_target->'tiers') loop
      if not public.hotel_v2_h2a_keys_allowed(v_child,array['id','schedule_id','guest_count',
        'threshold_nights','nightly_rate','is_active','version'])
        or not (v_child ?& array['id','schedule_id','guest_count','threshold_nights',
          'nightly_rate','is_active','version'])
        or jsonb_typeof(v_child->'id')<>'string'
        or jsonb_typeof(v_child->'schedule_id')<>'string'
        or jsonb_typeof(v_child->'guest_count')<>'number'
        or jsonb_typeof(v_child->'threshold_nights')<>'number'
        or jsonb_typeof(v_child->'nightly_rate')<>'number'
        or jsonb_typeof(v_child->'version')<>'number'
        or (v_child->>'schedule_id')::uuid<>v_id
        or v_child->>'guest_count'!~'^[0-9]+$' or v_child->>'threshold_nights'!~'^[0-9]+$'
        or v_child->>'nightly_rate'!~'^[0-9]+(?:\.[0-9]{1,2})?$'
        or jsonb_typeof(v_child->'is_active')<>'boolean'
        or v_child->>'version'!~'^[0-9]+$'
        or (v_child->>'guest_count')::integer not between 1 and 50
        or (v_child->>'threshold_nights')::integer not between 1 and 3650
        or (v_child->>'nightly_rate')::numeric>9999999999.99 then
        raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_schedule_tier'; end if;
      v_tier_id:=(v_child->>'id')::uuid;
      select * into v_tier from public.hotel_pricing_schedule_occupancy_tiers
        where id=v_tier_id for update;
      if found then
        if v_tier.schedule_id<>v_id or v_tier.version<>(v_child->>'version')::bigint then
          raise exception using errcode='PT409',message='hotels_v2_admin_c_stale_schedule_tier'; end if;
        v_child_current:=jsonb_build_object('guest_count',v_tier.guest_count,
          'threshold_nights',v_tier.threshold_nights,'nightly_rate',v_tier.nightly_rate,
          'is_active',v_tier.is_active);
        v_child_target:=jsonb_build_object('guest_count',(v_child->>'guest_count')::integer,
          'threshold_nights',(v_child->>'threshold_nights')::integer,
          'nightly_rate',(v_child->>'nightly_rate')::numeric,'is_active',(v_child->>'is_active')::boolean);
        if v_child_current<>v_child_target then
          update public.hotel_pricing_schedule_occupancy_tiers set
            guest_count=(v_child->>'guest_count')::smallint,
            threshold_nights=(v_child->>'threshold_nights')::integer,
            nightly_rate=(v_child->>'nightly_rate')::numeric,
            is_active=(v_child->>'is_active')::boolean where id=v_tier_id;
          v_child_changed:=true;
        end if;
      else
        if v_child->>'version'<>'0' then raise exception using errcode='PT409',
          message='hotels_v2_admin_c_missing_schedule_tier'; end if;
        insert into public.hotel_pricing_schedule_occupancy_tiers(id,schedule_id,guest_count,
          threshold_nights,nightly_rate,is_active) values(v_tier_id,v_id,
          (v_child->>'guest_count')::smallint,(v_child->>'threshold_nights')::integer,
          (v_child->>'nightly_rate')::numeric,(v_child->>'is_active')::boolean);
        v_child_changed:=true;
      end if;
    end loop;
    delete from public.hotel_pricing_schedule_occupancy_tiers tier where tier.schedule_id=v_id
      and not exists(select 1 from jsonb_array_elements(v_target->'tiers') child
        where (child->>'id')::uuid=tier.id);
    if found then v_child_changed:=true; end if;
  end if;
  if not v_parent_changed and not v_child_changed then
    return jsonb_build_object('changed',false,'activity',null); end if;
  select * into v_row from public.hotel_pricing_schedules where id=v_id;
  v_after:=jsonb_build_object('code',v_row.code,'name_i18n',v_row.name_i18n,
    'application_scope',v_row.application_scope,'currency',v_row.currency,
    'maximum_party_size',v_row.maximum_party_size,
    'minimum_billable_occupancy',v_row.minimum_billable_occupancy,
    'sharing_mode',v_row.sharing_mode,
    'lifecycle_status',public.hotel_v2_admin_c_lifecycle(v_row.is_active,v_row.review_status),
    'tiers_fingerprint',public.hotel_v2_admin_c_schedule_tiers_fingerprint(v_id));
  v_activity:=public.hotel_v2_admin_c_record_activity(p_hotel_id,'pricing_schedule',v_id,
    case when v_action='create' then 'create' when v_action='disable' then 'disable' else 'update' end,
    case when v_action='create' then null else v_before end,v_after,p_correlation_id,p_actor);
  return jsonb_build_object('changed',true,'activity',v_activity);
end
$function$;

create function public.hotel_v2_admin_c_apply_allocation_operation(
  p_hotel_id uuid,p_operation jsonb,p_correlation_id uuid,p_actor uuid
)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public
as $function$
declare
  v_id uuid:=(p_operation->>'id')::uuid; v_action text:=p_operation->>'action';
  v_expected bigint:=(p_operation->>'expected_version')::bigint;
  v_payload jsonb:=p_operation->'payload'; v_original jsonb:=p_operation->'expected_original';
  v_row public.hotel_room_allocation_rules%rowtype;
  v_item public.hotel_room_allocation_rule_items%rowtype;
  v_before jsonb; v_target jsonb; v_after jsonb; v_current_items jsonb;
  v_child jsonb; v_item_id uuid; v_room_id uuid; v_allocated smallint[]; v_pricing smallint[];
  v_child_current jsonb; v_child_target jsonb; v_activity jsonb;
  v_lifecycle text; v_active boolean; v_review text;
  v_parent_changed boolean:=false; v_child_changed boolean:=false;
begin
  if v_action not in('create','update','disable') then
    raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_allocation_action';
  end if;
  if v_action<>'create' then
    select * into v_row from public.hotel_room_allocation_rules
      where id=v_id and hotel_id=p_hotel_id for update;
    if not found then raise exception using errcode='PT404',message='hotels_v2_admin_c_allocation_not_found'; end if;
    if v_row.version<>v_expected then raise exception using errcode='PT409',
      message='hotels_v2_admin_c_stale_allocation',detail=jsonb_build_object(
        'entity','allocation_rule','id',v_id,'expected_version',v_expected,
        'current_version',v_row.version)::text; end if;
    if p_operation->>'expected_children_fingerprint' is distinct from
       public.hotel_v2_admin_c_allocation_items_fingerprint(v_id) then
      raise exception using errcode='PT409',message='hotels_v2_admin_c_allocation_items_stale';
    end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',item.id,'hotel_id',item.hotel_id,'allocation_rule_id',item.allocation_rule_id,
      'room_type_id',item.room_type_id,'units_required',item.units_required,
      'allocated_guest_count',item.allocated_guest_count,
      'pricing_guest_count',item.pricing_guest_count,
      'allocated_guest_counts',to_jsonb(item.allocated_guest_counts),
      'pricing_guest_counts',to_jsonb(item.pricing_guest_counts),
      'sort_order',item.sort_order) order by item.sort_order,item.id),'[]'::jsonb)
    into v_current_items from public.hotel_room_allocation_rule_items item
    where item.allocation_rule_id=v_id;
    v_before:=jsonb_build_object('code',v_row.code,'allocation_mode',v_row.allocation_mode,
      'min_guest_count',v_row.min_guest_count,'max_guest_count',v_row.max_guest_count,
      'lifecycle_status',public.hotel_v2_admin_c_lifecycle(v_row.is_active,v_row.review_status),
      'sort_order',v_row.sort_order,'items',v_current_items);
    if v_action in('update','disable') and v_original<>v_before then
      raise exception using errcode='PT409',message='hotels_v2_admin_c_allocation_original_mismatch';
    end if;
  elsif exists(select 1 from public.hotel_room_allocation_rules where id=v_id) then
    raise exception using errcode='PT409',message='hotels_v2_admin_c_allocation_id_exists';
  end if;
  if v_action='disable' then
    v_target:=v_before||jsonb_build_object('lifecycle_status','disabled');
  else
    if not public.hotel_v2_h2a_keys_allowed(v_payload,array['code','allocation_mode',
      'min_guest_count','max_guest_count','lifecycle_status','sort_order','items'])
      or not (v_payload ?& array['code','allocation_mode','min_guest_count','max_guest_count',
        'lifecycle_status','sort_order','items'])
      or jsonb_typeof(v_payload->'code')<>'string'
      or jsonb_typeof(v_payload->'allocation_mode')<>'string'
      or jsonb_typeof(v_payload->'min_guest_count')<>'number'
      or jsonb_typeof(v_payload->'max_guest_count')<>'number'
      or jsonb_typeof(v_payload->'lifecycle_status')<>'string'
      or jsonb_typeof(v_payload->'sort_order')<>'number'
      or jsonb_typeof(v_payload->'items')<>'array'
      or v_payload->>'min_guest_count'!~'^[0-9]+$'
      or v_payload->>'max_guest_count'!~'^[0-9]+$'
      or v_payload->>'sort_order'!~'^[0-9]+$' then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_allocation_payload';
    end if;
    v_lifecycle:=v_payload->>'lifecycle_status';
    if btrim(v_payload->>'code')!~'^[a-z0-9][a-z0-9_-]{0,79}$'
       or v_payload->>'code'<>lower(btrim(v_payload->>'code'))
       or v_payload->>'allocation_mode' not in('customer_choice','required_bundle')
       or (v_payload->>'min_guest_count')::integer not between 1 and 50
       or (v_payload->>'max_guest_count')::integer not between
          (v_payload->>'min_guest_count')::integer and 50
       or (v_payload->>'allocation_mode'='required_bundle'
         and v_payload->>'min_guest_count'<>v_payload->>'max_guest_count')
       or v_lifecycle not in('draft','inactive','active')
       or (v_payload->>'sort_order')::integer>1000000
       or (v_lifecycle='active' and p_operation->>'activation_acknowledged'<>'true')
       or jsonb_array_length(v_payload->'items') not between 1 and 100 then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_allocation_values';
    end if;
    if exists(select 1 from jsonb_array_elements(v_payload->'items') child
       group by child.value->>'id' having count(*)>1)
       or exists(select 1 from jsonb_array_elements(v_payload->'items') child
       group by child.value->>'room_type_id' having count(*)>1) then
      raise exception using errcode='22023',message='hotels_v2_admin_c_duplicate_allocation_item';
    end if;
    v_target:=jsonb_build_object('code',lower(btrim(v_payload->>'code')),
      'allocation_mode',v_payload->>'allocation_mode',
      'min_guest_count',(v_payload->>'min_guest_count')::integer,
      'max_guest_count',(v_payload->>'max_guest_count')::integer,
      'lifecycle_status',v_lifecycle,'sort_order',(v_payload->>'sort_order')::integer,
      'items',v_payload->'items');
  end if;
  v_lifecycle:=v_target->>'lifecycle_status'; v_active:=v_lifecycle='active';
  v_review:=case when v_lifecycle='draft' then 'requires_review'
    when v_lifecycle='disabled' then 'disabled' else 'reviewed' end;
  if exists(select 1 from public.hotel_room_allocation_rules rule
      where rule.hotel_id=p_hotel_id and rule.code=v_target->>'code'
        and rule.id<>v_id) then
    raise exception using errcode='PT409',
      message='hotels_v2_admin_c_allocation_code_conflict';
  end if;
  if v_action<>'disable' then
    perform public.hotel_v2_admin_c_enforce_graph_limits(
      p_hotel_id,
      p_allocation_delta=>case when v_action='create' then 1 else 0 end,
      p_allocation_item_delta=>greatest(jsonb_array_length(v_target->'items')-
        coalesce(jsonb_array_length(v_current_items),0),0));
  end if;
  if v_action='create' then
    insert into public.hotel_room_allocation_rules(id,hotel_id,code,allocation_mode,
      min_guest_count,max_guest_count,is_active,review_status,sort_order)
    values(v_id,p_hotel_id,v_target->>'code',v_target->>'allocation_mode',
      (v_target->>'min_guest_count')::smallint,(v_target->>'max_guest_count')::smallint,
      v_active,v_review,(v_target->>'sort_order')::integer);
    v_parent_changed:=true;
  elsif (v_target-'items')<>(v_before-'items') then
    update public.hotel_room_allocation_rules set code=v_target->>'code',
      allocation_mode=v_target->>'allocation_mode',
      min_guest_count=(v_target->>'min_guest_count')::smallint,
      max_guest_count=(v_target->>'max_guest_count')::smallint,
      is_active=v_active,review_status=v_review,sort_order=(v_target->>'sort_order')::integer
    where id=v_id;
    v_parent_changed:=true;
  end if;
  if v_action<>'disable' then
    for v_child in select value from jsonb_array_elements(v_target->'items') loop
      if jsonb_typeof(v_child)<>'object'
         or not public.hotel_v2_h2a_keys_allowed(v_child,array[
          'id','hotel_id','allocation_rule_id','room_type_id','units_required',
          'allocated_guest_count','pricing_guest_count','allocated_guest_counts',
          'pricing_guest_counts','sort_order'])
         or not (v_child ?& array['id','hotel_id','allocation_rule_id','room_type_id',
          'units_required','allocated_guest_count','pricing_guest_count',
          'allocated_guest_counts','pricing_guest_counts','sort_order'])
         or jsonb_typeof(v_child->'id')<>'string'
         or jsonb_typeof(v_child->'hotel_id')<>'string'
         or jsonb_typeof(v_child->'allocation_rule_id')<>'string'
         or jsonb_typeof(v_child->'room_type_id')<>'string'
         or jsonb_typeof(v_child->'units_required')<>'number'
         or jsonb_typeof(v_child->'allocated_guest_count') not in('number','null')
         or jsonb_typeof(v_child->'pricing_guest_count') not in('number','null')
         or jsonb_typeof(v_child->'allocated_guest_counts') not in('array','null')
         or jsonb_typeof(v_child->'pricing_guest_counts') not in('array','null')
         or jsonb_typeof(v_child->'sort_order')<>'number'
         or v_child->>'units_required'!~'^[0-9]+$'
         or (v_child->>'allocated_guest_count' is not null
           and v_child->>'allocated_guest_count'!~'^[0-9]+$')
         or (v_child->>'pricing_guest_count' is not null
           and v_child->>'pricing_guest_count'!~'^[0-9]+$')
         or v_child->>'sort_order'!~'^[0-9]+$'
         or exists(select 1 from jsonb_array_elements(
           case when jsonb_typeof(v_child->'allocated_guest_counts')='array'
             then v_child->'allocated_guest_counts' else '[]'::jsonb end) value
           where jsonb_typeof(value)<>'number' or value#>>'{}'!~'^[0-9]+$'
             or (value#>>'{}')::integer not between 1 and 50)
         or exists(select 1 from jsonb_array_elements(
           case when jsonb_typeof(v_child->'pricing_guest_counts')='array'
             then v_child->'pricing_guest_counts' else '[]'::jsonb end) value
           where jsonb_typeof(value)<>'number' or value#>>'{}'!~'^[0-9]+$'
             or (value#>>'{}')::integer not between 1 and 50) then
        raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_allocation_item';
      end if;
      begin
        v_item_id:=(v_child->>'id')::uuid; v_room_id:=(v_child->>'room_type_id')::uuid;
        if (v_child->>'hotel_id')::uuid<>p_hotel_id
           or (v_child->>'allocation_rule_id')::uuid<>v_id then
          raise exception using errcode='22023',message='hotels_v2_admin_c_foreign_allocation_item';
        end if;
      exception when invalid_text_representation then
        raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_allocation_item_identity';
      end;
      if not exists(select 1 from public.hotel_room_types
          where id=v_room_id and hotel_id=p_hotel_id)
         or (v_child->>'units_required')::integer not between 1 and 50
         or (v_child->>'allocated_guest_count' is not null and
          (v_child->>'allocated_guest_count')::integer not between 1 and 2500)
         or (v_child->>'pricing_guest_count' is not null and
          (v_child->>'pricing_guest_count')::integer not between 1 and 2500)
         or (v_child->>'sort_order')::integer>1000000 then
        raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_allocation_item_values';
      end if;
      select case when jsonb_typeof(v_child->'allocated_guest_counts')='array'
        then coalesce(array_agg((value#>>'{}')::smallint order by ord),'{}'::smallint[])
        else null end into v_allocated
      from jsonb_array_elements(case when jsonb_typeof(v_child->'allocated_guest_counts')='array'
        then v_child->'allocated_guest_counts' else '[]'::jsonb end)
        with ordinality valueset(value,ord);
      select case when jsonb_typeof(v_child->'pricing_guest_counts')='array'
        then coalesce(array_agg((value#>>'{}')::smallint order by ord),'{}'::smallint[])
        else null end into v_pricing
      from jsonb_array_elements(case when jsonb_typeof(v_child->'pricing_guest_counts')='array'
        then v_child->'pricing_guest_counts' else '[]'::jsonb end)
        with ordinality valueset(value,ord);
      if (v_target->>'allocation_mode'='customer_choice' and (
          (v_child->>'units_required')::integer<>1
          or v_child->>'allocated_guest_count' is not null
          or v_child->>'pricing_guest_count' is not null
          or v_allocated is not null or v_pricing is not null))
         or (v_target->>'allocation_mode'='required_bundle' and (
          v_child->>'allocated_guest_count' is null or v_child->>'pricing_guest_count' is null
          or ((v_child->>'units_required')::integer>1 and
            (v_allocated is null or v_pricing is null))))
         or (v_allocated is not null and not public.hotel_v2_admin_c_guest_array_matches_total(
          v_allocated,(v_child->>'units_required')::integer,
          (v_child->>'allocated_guest_count')::smallint))
         or (v_pricing is not null and not public.hotel_v2_admin_c_guest_array_matches_total(
          v_pricing,(v_child->>'units_required')::integer,
          (v_child->>'pricing_guest_count')::smallint)) then
        raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_allocation_occupancy';
      end if;
      v_child_target:=jsonb_build_object('hotel_id',p_hotel_id,
        'allocation_rule_id',v_id,'room_type_id',v_room_id,
        'units_required',(v_child->>'units_required')::integer,
        'allocated_guest_count',case when v_child->>'allocated_guest_count' is null then null
          else (v_child->>'allocated_guest_count')::integer end,
        'pricing_guest_count',case when v_child->>'pricing_guest_count' is null then null
          else (v_child->>'pricing_guest_count')::integer end,
        'allocated_guest_counts',to_jsonb(v_allocated),
        'pricing_guest_counts',to_jsonb(v_pricing),
        'sort_order',(v_child->>'sort_order')::integer);
      select * into v_item from public.hotel_room_allocation_rule_items
        where id=v_item_id for update;
      if found then
        if v_item.hotel_id<>p_hotel_id or v_item.allocation_rule_id<>v_id then
          raise exception using errcode='PT409',message='hotels_v2_admin_c_foreign_existing_allocation_item';
        end if;
        v_child_current:=jsonb_build_object('hotel_id',v_item.hotel_id,
          'allocation_rule_id',v_item.allocation_rule_id,'room_type_id',v_item.room_type_id,
          'units_required',v_item.units_required,'allocated_guest_count',v_item.allocated_guest_count,
          'pricing_guest_count',v_item.pricing_guest_count,
          'allocated_guest_counts',to_jsonb(v_item.allocated_guest_counts),
          'pricing_guest_counts',to_jsonb(v_item.pricing_guest_counts),
          'sort_order',v_item.sort_order);
        if v_child_current<>v_child_target then
          update public.hotel_room_allocation_rule_items set room_type_id=v_room_id,
            units_required=(v_child->>'units_required')::integer,
            allocated_guest_count=(v_child->>'allocated_guest_count')::smallint,
            pricing_guest_count=(v_child->>'pricing_guest_count')::smallint,
            allocated_guest_counts=v_allocated,pricing_guest_counts=v_pricing,
            sort_order=(v_child->>'sort_order')::integer
          where id=v_item_id;
          v_child_changed:=true;
        end if;
      else
        insert into public.hotel_room_allocation_rule_items(id,hotel_id,allocation_rule_id,
          room_type_id,units_required,allocated_guest_count,pricing_guest_count,
          allocated_guest_counts,pricing_guest_counts,sort_order)
        values(v_item_id,p_hotel_id,v_id,v_room_id,(v_child->>'units_required')::integer,
          (v_child->>'allocated_guest_count')::smallint,
          (v_child->>'pricing_guest_count')::smallint,v_allocated,v_pricing,
          (v_child->>'sort_order')::integer);
        v_child_changed:=true;
      end if;
    end loop;
    delete from public.hotel_room_allocation_rule_items item
      where item.allocation_rule_id=v_id and not exists(
        select 1 from jsonb_array_elements(v_target->'items') child
        where (child->>'id')::uuid=item.id);
    if found then v_child_changed:=true; end if;
  end if;
  if not v_parent_changed and not v_child_changed then
    return jsonb_build_object('changed',false,'activity',null);
  end if;
  select * into v_row from public.hotel_room_allocation_rules where id=v_id;
  v_after:=jsonb_build_object('code',v_row.code,'allocation_mode',v_row.allocation_mode,
    'min_guest_count',v_row.min_guest_count,'max_guest_count',v_row.max_guest_count,
    'lifecycle_status',public.hotel_v2_admin_c_lifecycle(v_row.is_active,v_row.review_status),
    'sort_order',v_row.sort_order,
    'items_fingerprint',public.hotel_v2_admin_c_allocation_items_fingerprint(v_id));
  v_activity:=public.hotel_v2_admin_c_record_activity(p_hotel_id,'allocation_rule',v_id,
    case when v_action='create' then 'create' when v_action='disable' then 'disable' else 'update' end,
    case when v_action='create' then null else v_before end,v_after,p_correlation_id,p_actor);
  return jsonb_build_object('changed',true,'activity',v_activity);
end
$function$;

create function public.hotel_v2_admin_c_apply_property_default_operation(
  p_hotel_id uuid,p_operation jsonb,p_correlation_id uuid,p_actor uuid
)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public
as $function$
declare
  v_id uuid:=(p_operation->>'id')::uuid;
  v_action text:=p_operation->>'action';
  v_expected bigint:=(p_operation->>'expected_version')::bigint;
  v_payload jsonb:=p_operation->'payload';
  v_original jsonb:=p_operation->'expected_original';
  v_row public.hotel_property_pricing_defaults%rowtype;
  v_before jsonb; v_target jsonb; v_after jsonb; v_activity jsonb;
  v_lifecycle text; v_active boolean; v_review text;
begin
  if v_action not in('create','update','disable') then
    raise exception using errcode='22023',
      message='hotels_v2_admin_c_invalid_property_default_action';
  end if;
  if v_action<>'create' then
    select * into v_row from public.hotel_property_pricing_defaults
      where id=v_id and hotel_id=p_hotel_id for update;
    if not found then raise exception using errcode='PT404',
      message='hotels_v2_admin_c_property_default_not_found'; end if;
    if v_row.version<>v_expected then raise exception using errcode='PT409',
      message='hotels_v2_admin_c_stale_property_default',
      detail=jsonb_build_object('entity','property_pricing_default','id',v_id,
        'expected_version',v_expected,'current_version',v_row.version)::text; end if;
    v_before:=jsonb_build_object('nightly_rate',v_row.nightly_rate,
      'currency',v_row.currency,'lifecycle_status',
      public.hotel_v2_admin_c_lifecycle(v_row.is_active,v_row.review_status));
    if v_original<>v_before then raise exception using errcode='PT409',
      message='hotels_v2_admin_c_property_default_original_mismatch'; end if;
  elsif exists(select 1 from public.hotel_property_pricing_defaults
      where id=v_id or hotel_id=p_hotel_id) then
    raise exception using errcode='PT409',
      message='hotels_v2_admin_c_property_default_already_exists';
  end if;

  if v_action='disable' then
    if v_row.review_status='disabled' and not v_row.is_active then
      return jsonb_build_object('changed',false,'activity',null);
    end if;
    update public.hotel_property_pricing_defaults set
      is_active=false,review_status='disabled' where id=v_id;
  else
    if not public.hotel_v2_h2a_keys_allowed(v_payload,
      case when v_action='create' then array['hotel_id','nightly_rate','currency','lifecycle_status']
        else array['nightly_rate','currency','lifecycle_status'] end)
       or not (v_payload ?& (case when v_action='create' then
          array['hotel_id','nightly_rate','currency','lifecycle_status']
        else array['nightly_rate','currency','lifecycle_status'] end))
       or (v_action='create' and (jsonb_typeof(v_payload->'hotel_id')<>'string'
         or (v_payload->>'hotel_id')::uuid<>p_hotel_id))
       or jsonb_typeof(v_payload->'nightly_rate')<>'number'
       or v_payload->>'nightly_rate'!~'^[0-9]+(?:\.[0-9]{1,2})?$'
       or (v_payload->>'nightly_rate')::numeric not between 0.01 and 9999999999.99
       or jsonb_typeof(v_payload->'currency')<>'string'
       or v_payload->>'currency'!~'^[A-Z]{3}$'
       or jsonb_typeof(v_payload->'lifecycle_status')<>'string'
       or v_payload->>'lifecycle_status' not in('draft','inactive','active') then
      raise exception using errcode='22023',
        message='hotels_v2_admin_c_invalid_property_default_payload';
    end if;
    if v_payload->>'currency'<>(select hotel.currency from public.hotels hotel
        where hotel.id=p_hotel_id) then
      raise exception using errcode='22023',
        message='hotels_v2_admin_c_property_default_currency_mismatch';
    end if;
    v_lifecycle:=v_payload->>'lifecycle_status';
    v_active:=v_lifecycle='active';
    v_review:=case when v_lifecycle='draft' then 'requires_review' else 'reviewed' end;
    if v_active and p_operation->>'activation_acknowledged'<>'true' then
      raise exception using errcode='22023',
        message='hotels_v2_admin_c_activation_acknowledgement_required';
    end if;
    v_target:=jsonb_build_object('nightly_rate',(v_payload->>'nightly_rate')::numeric,
      'currency',v_payload->>'currency','lifecycle_status',v_lifecycle);
    if v_action='create' then
      insert into public.hotel_property_pricing_defaults(
        id,hotel_id,nightly_rate,currency,is_active,review_status)
      values(v_id,p_hotel_id,(v_payload->>'nightly_rate')::numeric,
        v_payload->>'currency',v_active,v_review);
    elsif v_target<>v_before then
      update public.hotel_property_pricing_defaults set
        nightly_rate=(v_payload->>'nightly_rate')::numeric,
        currency=v_payload->>'currency',is_active=v_active,review_status=v_review
      where id=v_id;
    else
      return jsonb_build_object('changed',false,'activity',null);
    end if;
  end if;
  select * into v_row from public.hotel_property_pricing_defaults where id=v_id;
  v_after:=jsonb_build_object('nightly_rate',v_row.nightly_rate,
    'currency',v_row.currency,'lifecycle_status',
    public.hotel_v2_admin_c_lifecycle(v_row.is_active,v_row.review_status));
  v_activity:=public.hotel_v2_admin_c_record_activity(p_hotel_id,
    'property_pricing_default',v_id,
    case when v_action='create' then 'create' when v_action='disable' then 'disable'
      else 'update' end,case when v_action='create' then null else v_before end,
    v_after,p_correlation_id,p_actor);
  return jsonb_build_object('changed',true,'activity',v_activity);
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception using errcode='22023',
    message='hotels_v2_admin_c_invalid_property_default_value';
end
$function$;

create function public.hotel_v2_admin_c_apply_operation(
  p_hotel_id uuid,p_operation jsonb,p_correlation_id uuid,p_actor uuid
)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public
as $function$
begin
  case p_operation->>'entity'
    when 'property_pricing_default' then return public.hotel_v2_admin_c_apply_property_default_operation(
      p_hotel_id,p_operation,p_correlation_id,p_actor);
    when 'rate_plan' then return public.hotel_v2_admin_c_apply_rate_plan_operation(
      p_hotel_id,p_operation,p_correlation_id,p_actor);
    when 'room_rate' then return public.hotel_v2_admin_c_apply_room_rate_operation(
      p_hotel_id,p_operation,p_correlation_id,p_actor);
    when 'pricing_schedule' then return public.hotel_v2_admin_c_apply_schedule_operation(
      p_hotel_id,p_operation,p_correlation_id,p_actor);
    when 'room_rate_tier_set' then return public.hotel_v2_admin_c_apply_tier_set_operation(
      p_hotel_id,p_operation,p_correlation_id,p_actor);
    when 'rate_rule' then return public.hotel_v2_admin_c_apply_rate_rule_operation(
      p_hotel_id,p_operation,p_correlation_id,p_actor);
    when 'exact_date_price' then return public.hotel_v2_admin_c_apply_exact_price_operation(
      p_hotel_id,p_operation,p_correlation_id,p_actor);
    when 'allocation_rule' then return public.hotel_v2_admin_c_apply_allocation_operation(
      p_hotel_id,p_operation,p_correlation_id,p_actor);
    else raise exception using errcode='22023',message='hotels_v2_admin_c_unknown_pricing_entity';
  end case;
end
$function$;

create function public.hotel_v2_admin_apply_pricing_control_plan(
  p_plan jsonb,
  p_correlation_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,auth
as $function$
declare
  c_plan constant text:='hotels_v2_admin_c_pricing_plan_v1';
  c_control constant text:='hotels_v2_admin_c_pricing_control_v1';
  v_actor uuid; v_hotel_id uuid; v_reviewed_at timestamptz;
  v_request_hash text; v_receipt public.hotel_admin_pricing_action_receipts%rowtype;
  v_control jsonb; v_operation jsonb; v_payload jsonb; v_original jsonb;
  v_entity text; v_action text; v_id uuid; v_expected_version bigint;
  v_lifecycle text; v_target_active boolean; v_target_review text;
  v_before jsonb; v_after jsonb; v_activity jsonb:='[]'::jsonb;
  v_changed boolean:=false; v_entity_changed boolean; v_child jsonb;
  v_plan_row public.hotel_rate_plans%rowtype;
  v_rate_row public.hotel_room_rates%rowtype;
  v_schedule public.hotel_pricing_schedules%rowtype;
  v_rule_row public.hotel_rate_rules%rowtype;
  v_override public.hotel_calendar_overrides%rowtype;
  v_allocation public.hotel_room_allocation_rules%rowtype;
  v_child_current jsonb; v_child_target jsonb; v_result jsonb;
  v_inclusions text[]; v_weekdays smallint[]; v_allocated smallint[]; v_pricing smallint[];
  v_clone_operation jsonb; v_relink_operation jsonb; v_clone_source uuid; v_clone_target uuid;
  v_old_schedule uuid; v_new_schedule uuid; v_link_ids jsonb; v_count integer;
begin
  perform public.hotel_v2_h2a_require_admin();
  v_actor:=auth.uid();
  if v_actor is null or not public.hotel_v2_admin_c_uuid_is_canonical(v_actor::text)
     or p_plan is null or jsonb_typeof(p_plan)<>'object'
     or p_correlation_id is null
     or not public.hotel_v2_admin_c_uuid_is_canonical(p_correlation_id::text)
     or p_idempotency_key is null
     or not public.hotel_v2_h2a_keys_allowed(p_plan,array[
       'contract_version','hotel_id','snapshot_token','reviewed_at','operations'])
     or not (p_plan ?& array['contract_version','hotel_id','snapshot_token','reviewed_at','operations'])
     or p_plan->>'contract_version'<>c_plan
     or octet_length(convert_to(p_plan::text,'UTF8'))>5242880
     or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(p_plan)
     or not public.hotel_v2_admin_c_json_timestamp_fields_are_canonical(p_plan)
     or jsonb_typeof(p_plan->'hotel_id')<>'string'
     or jsonb_typeof(p_plan->'snapshot_token')<>'string'
     or p_plan->>'snapshot_token'!~'^[0-9a-f]{64}$'
     or jsonb_typeof(p_plan->'reviewed_at')<>'string'
     or not public.hotel_v2_admin_c_timestamptz_is_canonical(
       p_plan->>'reviewed_at')
     or jsonb_typeof(p_plan->'operations')<>'array'
     or jsonb_array_length(p_plan->'operations') not between 1 and 100
     or length(p_idempotency_key) not between 8 and 120
     or p_idempotency_key!~'^[A-Za-z0-9][A-Za-z0-9._:-]*$' then
    raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_pricing_plan';
  end if;
  begin
    v_hotel_id:=(p_plan->>'hotel_id')::uuid;
    v_reviewed_at:=(p_plan->>'reviewed_at')::timestamptz;
  exception when others then
    raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_plan_identifiers';
  end;
  v_request_hash:=encode(digest(convert_to(jsonb_build_object(
    'plan',p_plan,'correlation_id',p_correlation_id)::text,'UTF8'),'sha256'),'hex');
  -- Serialize both same actor/key replays and global correlation identity
  -- before the first receipt lookup. A concurrent identical request therefore
  -- deterministically replays instead of surfacing a raw unique violation.
  perform pg_advisory_xact_lock(hashtextextended(
    'hotels-v2-admin-c-key:'||v_actor::text||':'||p_idempotency_key,0));
  perform pg_advisory_xact_lock(hashtextextended(
    'hotels-v2-admin-c-correlation:'||p_correlation_id::text,0));
  select * into v_receipt from public.hotel_admin_pricing_action_receipts
    where actor_id=v_actor and idempotency_key=p_idempotency_key for update;
  if found then
    if v_receipt.request_hash<>v_request_hash or v_receipt.correlation_id<>p_correlation_id
       or v_receipt.hotel_id<>v_hotel_id then
      raise exception using errcode='PT409',message='hotels_v2_admin_c_idempotency_conflict';
    end if;
    return jsonb_set(v_receipt.result,'{replayed}','true'::jsonb,true);
  end if;
  if exists(select 1 from public.hotel_admin_pricing_action_receipts
    where correlation_id=p_correlation_id)
     or exists(select 1 from public.hotel_activity_log
       where correlation_id=p_correlation_id) then
    raise exception using errcode='PT409',message='hotels_v2_admin_c_correlation_conflict';
  end if;
  -- Freshness is a new-request gate, not a replay gate. An exact retry must
  -- remain deterministic for the lifetime of its immutable receipt.
  if v_reviewed_at<clock_timestamp()-interval '30 minutes'
     or v_reviewed_at>clock_timestamp()+interval '5 minutes' then
    raise exception using errcode='22023',message='hotels_v2_admin_c_pricing_review_expired';
  end if;

  perform 1 from public.site_settings where id=1 for share;
  if (select count(*) from public.site_settings)<>1
     or exists(select 1 from public.site_settings where id<>1 or
       hotel_rooms_v2_enabled or hotel_external_sync_enabled
       or hotel_instant_booking_enabled or hotel_stripe_connect_enabled) then
    raise exception using errcode='55000',message='hotels_v2_admin_c_public_activation_guard';
  end if;
  perform 1 from public.hotels where id=v_hotel_id for update;
  if not found then raise exception using errcode='PT404',message='hotels_v2_admin_c_property_not_found'; end if;
  if v_hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
     and exists(select 1 from public.hotel_pricing_promotion_reviews review
       where review.hotel_id=v_hotel_id
         and review.contract_version='seven_kamares_legacy_to_h3_pricing_v1'
         and review.review_status='reviewed' and review.parity_case_count=70
         and review.parity_mismatch_count=0) then
    raise exception using errcode='55000',
      message='hotels_v2_admin_c_h3_1p_graph_immutable';
  end if;
  perform 1 from public.hotel_room_types where hotel_id=v_hotel_id order by id for share;
  perform 1 from public.hotel_property_pricing_defaults
    where hotel_id=v_hotel_id order by id for update;
  perform 1 from public.hotel_rate_plans where hotel_id=v_hotel_id order by id for update;
  perform 1 from public.hotel_room_rates where hotel_id=v_hotel_id order by id for update;
  perform 1 from public.hotel_pricing_schedules where hotel_id=v_hotel_id order by id for update;
  perform 1 from public.hotel_pricing_schedule_occupancy_tiers tier
    where exists(select 1 from public.hotel_pricing_schedules schedule
      where schedule.id=tier.schedule_id and schedule.hotel_id=v_hotel_id) order by tier.id for update;
  perform 1 from public.hotel_room_rate_occupancy_tiers where hotel_id=v_hotel_id order by id for update;
  perform 1 from public.hotel_rate_rules rule where exists(select 1 from public.hotel_room_rates rate
    where rate.id=rule.room_rate_id and rate.hotel_id=v_hotel_id) order by rule.id for update;
  perform 1 from public.hotel_calendar_overrides where hotel_id=v_hotel_id order by id for update;
  perform 1 from public.hotel_room_allocation_rules where hotel_id=v_hotel_id order by id for update;
  perform 1 from public.hotel_room_allocation_rule_items where hotel_id=v_hotel_id order by id for update;

  if exists(select 1 from jsonb_array_elements(p_plan->'operations') operation
      group by operation.value->>'entity',operation.value->>'id' having count(*)>1) then
    raise exception using errcode='22023',
      message='hotels_v2_admin_c_duplicate_operation_target';
  end if;

  v_control:=public.hotel_v2_admin_c_pricing_control_snapshot(v_hotel_id);
  if v_control->>'snapshot_token' is distinct from p_plan->>'snapshot_token' then
    raise exception using errcode='PT409',message='hotels_v2_admin_c_stale_pricing_snapshot',
      detail=jsonb_build_object('current_snapshot_token',v_control->>'snapshot_token',
        'changed_entities',jsonb_build_array('pricing_graph'))::text;
  end if;

  set constraints hotel_rate_plans_admin_c_graph_guard,
    hotel_room_rates_admin_c_graph_guard,hotel_pricing_schedules_admin_c_graph_guard,
    hotel_property_pricing_defaults_admin_c_graph_guard,
    hotel_pricing_schedule_tiers_admin_c_graph_guard,hotel_room_rate_tiers_admin_c_graph_guard,
    hotel_rate_rules_admin_c_graph_guard,hotel_calendar_overrides_admin_c_graph_guard,
    hotel_room_allocation_rules_contract_guard,hotel_room_allocation_rule_items_contract_guard,
    hotel_room_allocation_rules_admin_c_extension_guard,
    hotel_room_allocation_items_admin_c_extension_guard deferred;

  -- Bind the only allowed direct schedule A->B transition: one exact clone
  -- followed by one same-product relink in this two-operation transaction.
  for v_operation in select value from jsonb_array_elements(p_plan->'operations') loop
    if v_operation->>'entity'='pricing_schedule' and v_operation->>'action'='clone' then
      if v_clone_operation is not null then
        raise exception using errcode='22023',message='hotels_v2_admin_c_multiple_clone_operations';
      end if;
      v_clone_operation:=v_operation;
    elsif v_operation->>'entity'='room_rate' and v_operation->>'action'='update' then
      begin
        v_old_schedule:=nullif(v_operation#>>'{expected_original,pricing_schedule_id}','')::uuid;
        v_new_schedule:=nullif(v_operation#>>'{payload,pricing_schedule_id}','')::uuid;
      exception when others then
        raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_schedule_link';
      end;
      if v_old_schedule is not null and v_new_schedule is not null
         and v_old_schedule<>v_new_schedule then
        if v_relink_operation is not null then
          raise exception using errcode='22023',message='hotels_v2_admin_c_multiple_relink_operations';
        end if;
        v_relink_operation:=v_operation;
      end if;
    end if;
  end loop;
  if v_relink_operation is not null then
    if v_clone_operation is null or jsonb_array_length(p_plan->'operations')<>2
       or p_plan#>>'{operations,0,entity}'<>'pricing_schedule'
       or p_plan#>>'{operations,0,action}'<>'clone'
       or p_plan#>>'{operations,1,entity}'<>'room_rate'
       or p_plan#>>'{operations,1,action}'<>'update'
       or (v_clone_operation->>'id')::uuid<>(v_relink_operation#>>'{payload,pricing_schedule_id}')::uuid
       or (v_clone_operation#>>'{payload,source_schedule_id}')::uuid<>
          (v_relink_operation#>>'{expected_original,pricing_schedule_id}')::uuid
       or v_clone_operation#>>'{payload,sharing_mode}'<>'independent'
       or v_clone_operation->>'shared_impact_acknowledged'<>'true'
       or v_relink_operation->>'shared_impact_acknowledged'<>'true'
       or v_relink_operation#>>'{payload,lifecycle_status}' not in('draft','inactive') then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_clone_relink_pair';
    end if;
  elsif v_clone_operation is not null and jsonb_array_length(p_plan->'operations')>1 then
    raise exception using errcode='22023',message='hotels_v2_admin_c_clone_must_be_single_or_exact_pair';
  end if;

  for v_operation in select value from jsonb_array_elements(p_plan->'operations') loop
    if jsonb_typeof(v_operation)<>'object'
       or not public.hotel_v2_h2a_keys_allowed(v_operation,array[
         'entity','action','id','expected_version','expected_children_fingerprint',
         'expected_link_fingerprint','expected_linked_room_rate_ids',
         'shared_impact_acknowledged','activation_acknowledged','expected_original','payload'])
       or not (v_operation ?& array['entity','action','id','expected_version',
         'expected_children_fingerprint','expected_link_fingerprint',
         'expected_linked_room_rate_ids','shared_impact_acknowledged',
         'activation_acknowledged','expected_original','payload'])
       or jsonb_typeof(v_operation->'entity')<>'string'
       or jsonb_typeof(v_operation->'action')<>'string'
       or jsonb_typeof(v_operation->'id')<>'string'
       or jsonb_typeof(v_operation->'expected_version')<>'number'
       or v_operation->>'expected_version'!~'^[0-9]+$'
       or jsonb_typeof(v_operation->'expected_children_fingerprint') not in('string','null')
       or jsonb_typeof(v_operation->'expected_link_fingerprint') not in('string','null')
       or (jsonb_typeof(v_operation->'expected_children_fingerprint')='string'
         and v_operation->>'expected_children_fingerprint'!~'^[0-9a-f]{32}$')
       or (jsonb_typeof(v_operation->'expected_link_fingerprint')='string'
         and v_operation->>'expected_link_fingerprint'!~'^[0-9a-f]{32}$')
       or jsonb_typeof(v_operation->'expected_linked_room_rate_ids')<>'array'
       or jsonb_array_length(v_operation->'expected_linked_room_rate_ids')>1000
       or exists(select 1 from jsonb_array_elements(v_operation->'expected_linked_room_rate_ids') link
         where jsonb_typeof(link)<>'string')
       or (select count(*) from jsonb_array_elements_text(
         v_operation->'expected_linked_room_rate_ids'))<>
         (select count(distinct link) from jsonb_array_elements_text(
           v_operation->'expected_linked_room_rate_ids') link)
       or jsonb_typeof(v_operation->'shared_impact_acknowledged')<>'boolean'
       or jsonb_typeof(v_operation->'activation_acknowledged')<>'boolean'
       or jsonb_typeof(v_operation->'expected_original')<>'object'
       or jsonb_typeof(v_operation->'payload')<>'object' then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_operation_envelope';
    end if;
    begin
      v_entity:=v_operation->>'entity'; v_action:=v_operation->>'action';
      v_id:=(v_operation->>'id')::uuid;
      v_expected_version:=(v_operation->>'expected_version')::bigint;
    exception when others then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_operation_identifiers';
    end;
    if v_entity not in('property_pricing_default','rate_plan','room_rate','pricing_schedule','room_rate_tier_set',
         'rate_rule','exact_date_price','allocation_rule')
       or v_action not in('create','update','clone','disable')
       or (v_action='clone' and v_entity<>'pricing_schedule')
       or (v_entity='room_rate_tier_set' and v_action<>'update')
       or (v_action in('create','clone') and v_expected_version<>0)
       or (v_action not in('create','clone') and v_expected_version<1)
       or (v_action='disable' and v_operation->'payload'<>'{}'::jsonb)
       or (v_action in('create','clone')
         and v_operation->'expected_original'<>'{}'::jsonb) then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_operation_contract';
    end if;
    v_payload:=v_operation->'payload'; v_original:=v_operation->'expected_original';
    v_entity_changed:=false;

    v_after:=public.hotel_v2_admin_c_apply_operation(
      v_hotel_id,v_operation,p_correlation_id,v_actor);
    v_entity_changed:=coalesce((v_after->>'changed')::boolean,false);
    if jsonb_typeof(v_after->'activity')='object' then
      v_activity:=v_activity||jsonb_build_array(v_after->'activity');
    end if;
    v_changed:=v_changed or v_entity_changed;
  end loop;

  set constraints hotel_rate_plans_admin_c_graph_guard,
    hotel_room_rates_admin_c_graph_guard,hotel_pricing_schedules_admin_c_graph_guard,
    hotel_property_pricing_defaults_admin_c_graph_guard,
    hotel_pricing_schedule_tiers_admin_c_graph_guard,hotel_room_rate_tiers_admin_c_graph_guard,
    hotel_rate_rules_admin_c_graph_guard,hotel_calendar_overrides_admin_c_graph_guard,
    hotel_room_allocation_rules_contract_guard,hotel_room_allocation_rule_items_contract_guard,
    hotel_room_allocation_rules_admin_c_extension_guard,
    hotel_room_allocation_items_admin_c_extension_guard immediate;

  v_control:=public.hotel_v2_admin_c_pricing_control_snapshot(v_hotel_id);
  v_result:=jsonb_build_object('contract_version',c_plan,'hotel_id',v_hotel_id,
    'correlation_id',p_correlation_id,'idempotency_key',p_idempotency_key,
    'replayed',false,'changed',v_changed,'activity',v_activity,
    'pricing_control',v_control);
  insert into public.hotel_admin_pricing_action_receipts(
    hotel_id,actor_id,idempotency_key,correlation_id,request_hash,result)
  values(v_hotel_id,v_actor,p_idempotency_key,p_correlation_id,v_request_hash,v_result);
  return v_result;
exception when invalid_text_representation or numeric_value_out_of_range
  or datetime_field_overflow then
  raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_pricing_value';
end
$function$;

create function public.hotel_v2_admin_c_pricing_graph_constraint_trigger()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public
as $function$
declare v_old_hotel_id uuid; v_new_hotel_id uuid;
begin
  if tg_table_name in('hotel_rate_plans','hotel_room_rates','hotel_pricing_schedules',
      'hotel_property_pricing_defaults') then
    v_old_hotel_id:=case when tg_op='INSERT' then null else (to_jsonb(old)->>'hotel_id')::uuid end;
    v_new_hotel_id:=case when tg_op='DELETE' then null else (to_jsonb(new)->>'hotel_id')::uuid end;
  elsif tg_table_name='hotel_pricing_schedule_occupancy_tiers' then
    if tg_op<>'INSERT' then select hotel_id into v_old_hotel_id
      from public.hotel_pricing_schedules where id=(to_jsonb(old)->>'schedule_id')::uuid; end if;
    if tg_op<>'DELETE' then select hotel_id into v_new_hotel_id
      from public.hotel_pricing_schedules where id=(to_jsonb(new)->>'schedule_id')::uuid; end if;
  elsif tg_table_name in('hotel_room_rate_occupancy_tiers','hotel_calendar_overrides') then
    v_old_hotel_id:=case when tg_op='INSERT' then null else (to_jsonb(old)->>'hotel_id')::uuid end;
    v_new_hotel_id:=case when tg_op='DELETE' then null else (to_jsonb(new)->>'hotel_id')::uuid end;
  elsif tg_table_name='hotel_rate_rules' then
    if tg_op<>'INSERT' then select hotel_id into v_old_hotel_id
      from public.hotel_room_rates where id=(to_jsonb(old)->>'room_rate_id')::uuid; end if;
    if tg_op<>'DELETE' then select hotel_id into v_new_hotel_id
      from public.hotel_room_rates where id=(to_jsonb(new)->>'room_rate_id')::uuid; end if;
  end if;
  if v_old_hotel_id is not null then perform public.hotel_v2_admin_c_validate_pricing_graph(v_old_hotel_id); end if;
  if v_new_hotel_id is not null and v_new_hotel_id is distinct from v_old_hotel_id then
    perform public.hotel_v2_admin_c_validate_pricing_graph(v_new_hotel_id);
  end if;
  return null;
end
$function$;

create constraint trigger hotel_rate_plans_admin_c_graph_guard
after insert or update or delete on public.hotel_rate_plans
deferrable initially deferred for each row
execute function public.hotel_v2_admin_c_pricing_graph_constraint_trigger();
create constraint trigger hotel_room_rates_admin_c_graph_guard
after insert or update or delete on public.hotel_room_rates
deferrable initially deferred for each row
execute function public.hotel_v2_admin_c_pricing_graph_constraint_trigger();
create constraint trigger hotel_pricing_schedules_admin_c_graph_guard
after insert or update or delete on public.hotel_pricing_schedules
deferrable initially deferred for each row
execute function public.hotel_v2_admin_c_pricing_graph_constraint_trigger();
create constraint trigger hotel_property_pricing_defaults_admin_c_graph_guard
after insert or update or delete on public.hotel_property_pricing_defaults
deferrable initially deferred for each row
execute function public.hotel_v2_admin_c_pricing_graph_constraint_trigger();
create constraint trigger hotel_pricing_schedule_tiers_admin_c_graph_guard
after insert or update or delete on public.hotel_pricing_schedule_occupancy_tiers
deferrable initially deferred for each row
execute function public.hotel_v2_admin_c_pricing_graph_constraint_trigger();
create constraint trigger hotel_room_rate_tiers_admin_c_graph_guard
after insert or update or delete on public.hotel_room_rate_occupancy_tiers
deferrable initially deferred for each row
execute function public.hotel_v2_admin_c_pricing_graph_constraint_trigger();
create constraint trigger hotel_rate_rules_admin_c_graph_guard
after insert or update or delete on public.hotel_rate_rules
deferrable initially deferred for each row
execute function public.hotel_v2_admin_c_pricing_graph_constraint_trigger();
create constraint trigger hotel_calendar_overrides_admin_c_graph_guard
after insert or update or delete on public.hotel_calendar_overrides
deferrable initially deferred for each row
execute function public.hotel_v2_admin_c_pricing_graph_constraint_trigger();

revoke all on function public.hotel_v2_admin_c_validate_pricing_graph(uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_c_pricing_graph_constraint_trigger()
  from public,anon,authenticated,service_role;

-- Generalize the preserved H3.1/H3.1P aggregate validator only at its two
-- historical "at least two" assumptions. Its long exact 7 Kamares receipt
-- guard remains byte-for-byte otherwise.
do $admin_c_generalize_allocation$
declare v_definition text;
begin
  select pg_get_functiondef(
    'public.hotel_v2_h3_1_validate_allocation_rule(uuid)'::regprocedure
  ) into v_definition;
  if strpos(v_definition,
      '(v_rule.allocation_mode=''customer_choice'' and v_count<2)')=0
     or strpos(v_definition,
      'v_units<2 or v_total<>v_rule.min_guest_count')=0 then
    raise exception using errcode='55000',
      message='hotels_v2_admin_c_allocation_validator_drift';
  end if;
  v_definition:=replace(v_definition,
    '(v_rule.allocation_mode=''customer_choice'' and v_count<2)',
    '(v_rule.allocation_mode=''customer_choice'' and v_count<1)');
  v_definition:=replace(v_definition,
    'v_units<2 or v_total<>v_rule.min_guest_count',
    'v_units<1 or v_total<>v_rule.min_guest_count');
  execute v_definition;
end
$admin_c_generalize_allocation$;

create function public.hotel_v2_admin_c_validate_allocation_extensions(p_rule_id uuid)
returns void
language plpgsql
security definer
set search_path=pg_catalog,public
as $function$
declare v_rule public.hotel_room_allocation_rules%rowtype;
begin
  select * into v_rule from public.hotel_room_allocation_rules where id=p_rule_id;
  if not found then return; end if;

  if v_rule.allocation_mode='required_bundle'
     and v_rule.min_guest_count<>v_rule.max_guest_count then
    raise exception using errcode='23514',
      message='hotels_v2_admin_c_bundle_requires_exact_guest_count';
  end if;

  if exists(
    select 1 from public.hotel_room_allocation_rule_items item
    join public.hotel_room_types room_type on room_type.id=item.room_type_id
    where item.allocation_rule_id=v_rule.id and (
      (v_rule.allocation_mode='customer_choice' and (
        item.units_required<>1 or item.allocated_guest_count is not null
        or item.pricing_guest_count is not null
        or item.allocated_guest_counts is not null
        or item.pricing_guest_counts is not null
        or coalesce(room_type.max_occupancy,
          room_type.capacity_adults+room_type.capacity_children)<v_rule.max_guest_count
      ))
      or (v_rule.allocation_mode='required_bundle' and (
        item.allocated_guest_count is null
        or (v_rule.review_status='reviewed' and item.pricing_guest_count is null)
        or (item.units_required>1 and (
          item.allocated_guest_counts is null or item.pricing_guest_counts is null))
        or (item.allocated_guest_counts is not null and exists(
          select 1 from unnest(item.allocated_guest_counts) guest_count
          where guest_count>coalesce(room_type.max_occupancy,
            room_type.capacity_adults+room_type.capacity_children)))
        or (item.pricing_guest_counts is not null and exists(
          select 1 from unnest(item.pricing_guest_counts) guest_count
          where guest_count>coalesce(room_type.max_occupancy,
            room_type.capacity_adults+room_type.capacity_children)))
      ))
    )
  ) then
    raise exception using errcode='23514',
      message='hotels_v2_admin_c_invalid_per_unit_allocation_contract';
  end if;
end
$function$;

create function public.hotel_v2_admin_c_allocation_extension_constraint_trigger()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public
as $function$
begin
  if tg_table_name='hotel_room_allocation_rules' then
    perform public.hotel_v2_admin_c_validate_allocation_extensions(
      case when tg_op='DELETE' then old.id else new.id end);
  else
    if tg_op<>'INSERT' then
      perform public.hotel_v2_admin_c_validate_allocation_extensions(old.allocation_rule_id);
    end if;
    if tg_op<>'DELETE' and (tg_op='INSERT'
      or new.allocation_rule_id is distinct from old.allocation_rule_id) then
      perform public.hotel_v2_admin_c_validate_allocation_extensions(new.allocation_rule_id);
    end if;
  end if;
  return null;
end
$function$;

create constraint trigger hotel_room_allocation_rules_admin_c_extension_guard
after insert or update or delete on public.hotel_room_allocation_rules
deferrable initially deferred for each row
execute function public.hotel_v2_admin_c_allocation_extension_constraint_trigger();
create constraint trigger hotel_room_allocation_items_admin_c_extension_guard
after insert or update or delete on public.hotel_room_allocation_rule_items
deferrable initially deferred for each row
execute function public.hotel_v2_admin_c_allocation_extension_constraint_trigger();

revoke all on function public.hotel_v2_admin_c_validate_allocation_extensions(uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_c_allocation_extension_constraint_trigger()
  from public,anon,authenticated,service_role;

-- Active pricing and allocation readiness also depends on a deliberately
-- small set of ADMIN-B property/Room fields. Revalidate only when those
-- semantic dependencies change; content, names, notes, and galleries remain
-- decoupled from pricing concurrency.
create function public.hotel_v2_admin_c_validate_cross_domain_hotel(p_hotel_id uuid)
returns void
language plpgsql
security definer
set search_path=pg_catalog,public
as $function$
declare v_rule_id uuid;
begin
  if p_hotel_id is null or not exists(select 1 from public.hotels where id=p_hotel_id) then
    return;
  end if;
  perform public.hotel_v2_admin_c_validate_pricing_graph(p_hotel_id);
  for v_rule_id in select rule.id from public.hotel_room_allocation_rules rule
      where rule.hotel_id=p_hotel_id order by rule.id loop
    perform public.hotel_v2_h3_1_validate_allocation_rule(v_rule_id);
    perform public.hotel_v2_admin_c_validate_allocation_extensions(v_rule_id);
  end loop;
end
$function$;

create function public.hotel_v2_admin_c_cross_domain_constraint_trigger()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public
as $function$
declare v_old_hotel_id uuid; v_new_hotel_id uuid;
begin
  if tg_table_name='hotel_property_operational_profiles' then
    if tg_op='INSERT' and to_jsonb(new)->>'maximum_stay_nights' is null then
      return null;
    elsif tg_op='DELETE' and to_jsonb(old)->>'maximum_stay_nights' is null then
      return null;
    elsif tg_op='UPDATE' and to_jsonb(old)->'maximum_stay_nights'
        is not distinct from to_jsonb(new)->'maximum_stay_nights' then
      return null;
    end if;
  end if;
  if tg_table_name='hotels' then
    v_old_hotel_id:=old.id; v_new_hotel_id:=new.id;
  elsif tg_table_name='hotel_units' then
    if tg_op<>'INSERT' then
      select room_type.hotel_id into v_old_hotel_id
      from public.hotel_room_types room_type where room_type.id=old.room_type_id;
    end if;
    if tg_op<>'DELETE' then
      select room_type.hotel_id into v_new_hotel_id
      from public.hotel_room_types room_type where room_type.id=new.room_type_id;
    end if;
  else
    v_old_hotel_id:=case when tg_op='INSERT' then null
      else nullif(to_jsonb(old)->>'hotel_id','')::uuid end;
    v_new_hotel_id:=case when tg_op='DELETE' then null
      else nullif(to_jsonb(new)->>'hotel_id','')::uuid end;
  end if;
  if v_old_hotel_id is not null then
    perform public.hotel_v2_admin_c_validate_cross_domain_hotel(v_old_hotel_id);
  end if;
  if v_new_hotel_id is not null and v_new_hotel_id is distinct from v_old_hotel_id then
    perform public.hotel_v2_admin_c_validate_cross_domain_hotel(v_new_hotel_id);
  end if;
  return null;
end
$function$;

create constraint trigger hotels_admin_c_pricing_dependency_guard
after update on public.hotels
deferrable initially deferred for each row
when (old.currency is distinct from new.currency
  or old.minimum_stay_nights is distinct from new.minimum_stay_nights
  or old.booking_mode is distinct from new.booking_mode
  or old.children_policy is distinct from new.children_policy
  or old.minimum_child_age is distinct from new.minimum_child_age)
execute function public.hotel_v2_admin_c_cross_domain_constraint_trigger();

create constraint trigger hotel_property_profiles_admin_c_pricing_dependency_insert_delete_guard
after insert or delete on public.hotel_property_operational_profiles
deferrable initially deferred for each row
execute function public.hotel_v2_admin_c_cross_domain_constraint_trigger();

create constraint trigger hotel_property_profiles_admin_c_pricing_dependency_update_guard
after update on public.hotel_property_operational_profiles
deferrable initially deferred for each row
when (old.maximum_stay_nights is distinct from new.maximum_stay_nights)
execute function public.hotel_v2_admin_c_cross_domain_constraint_trigger();

create constraint trigger hotel_room_types_admin_c_pricing_dependency_guard
after update on public.hotel_room_types
deferrable initially deferred for each row
when (old.hotel_id is distinct from new.hotel_id
  or old.status is distinct from new.status
  or old.max_occupancy is distinct from new.max_occupancy
  or old.capacity_adults is distinct from new.capacity_adults
  or old.capacity_children is distinct from new.capacity_children
  or old.children_policy_override is distinct from new.children_policy_override
  or old.minimum_child_age_override is distinct from new.minimum_child_age_override
  or old.inventory_mode is distinct from new.inventory_mode
  or old.base_inventory_count is distinct from new.base_inventory_count)
execute function public.hotel_v2_admin_c_cross_domain_constraint_trigger();

create constraint trigger hotel_units_admin_c_pricing_dependency_insert_delete_guard
after insert or delete on public.hotel_units
deferrable initially deferred for each row
execute function public.hotel_v2_admin_c_cross_domain_constraint_trigger();

create constraint trigger hotel_units_admin_c_pricing_dependency_update_guard
after update on public.hotel_units
deferrable initially deferred for each row
when (old.room_type_id is distinct from new.room_type_id
  or old.status is distinct from new.status)
execute function public.hotel_v2_admin_c_cross_domain_constraint_trigger();

revoke all on function public.hotel_v2_admin_c_validate_cross_domain_hotel(uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_c_cross_domain_constraint_trigger()
  from public,anon,authenticated,service_role;

create function public.hotel_v2_admin_c_h3_1p_freeze_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public
as $function$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid;
  v_old jsonb:=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
  v_new jsonb:=case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
  v_old_hotel uuid; v_new_hotel uuid; v_operational_only boolean:=false;
begin
  if tg_table_name in('hotel_rate_plans','hotel_room_rates','hotel_pricing_schedules',
      'hotel_calendar_overrides','hotel_room_allocation_rules',
      'hotel_room_allocation_rule_items','hotel_room_rate_occupancy_tiers',
      'hotel_property_pricing_defaults') then
    v_old_hotel:=case when tg_op='INSERT' then null
      else nullif(v_old->>'hotel_id','')::uuid end;
    v_new_hotel:=case when tg_op='DELETE' then null
      else nullif(v_new->>'hotel_id','')::uuid end;
  elsif tg_table_name='hotel_pricing_schedule_occupancy_tiers' then
    if tg_op<>'INSERT' then select hotel_id into v_old_hotel
      from public.hotel_pricing_schedules where id=(v_old->>'schedule_id')::uuid; end if;
    if tg_op<>'DELETE' then select hotel_id into v_new_hotel
      from public.hotel_pricing_schedules where id=(v_new->>'schedule_id')::uuid; end if;
  elsif tg_table_name='hotel_rate_rules' then
    if tg_op<>'INSERT' then select hotel_id into v_old_hotel
      from public.hotel_room_rates where id=(v_old->>'room_rate_id')::uuid; end if;
    if tg_op<>'DELETE' then select hotel_id into v_new_hotel
      from public.hotel_room_rates where id=(v_new->>'room_rate_id')::uuid; end if;
  end if;

  if tg_table_name='hotel_calendar_overrides' and
      (v_old_hotel=c_hotel or v_new_hotel=c_hotel) then
    if tg_op='INSERT' then
      v_operational_only:=new.nightly_rate_mode is null and new.nightly_rate is null
        and new.minimum_stay_mode is null and new.minimum_stay is null
        and new.maximum_stay_mode is null and new.maximum_stay is null;
    elsif tg_op='DELETE' then
      v_operational_only:=old.nightly_rate_mode is null and old.nightly_rate is null
        and old.minimum_stay_mode is null and old.minimum_stay is null
        and old.maximum_stay_mode is null and old.maximum_stay is null;
    elsif tg_op='UPDATE' then
      v_operational_only:=new.id=old.id and new.hotel_id=old.hotel_id
        and new.room_rate_id=old.room_rate_id and new.stay_date=old.stay_date
      and (new.nightly_rate_mode,new.nightly_rate,new.minimum_stay_mode,
        new.minimum_stay,new.maximum_stay_mode,new.maximum_stay,
        new.pricing_source,new.pricing_reason,new.pricing_expires_at,
        new.pricing_actor_type,new.pricing_actor_id,new.pricing_updated_at,
        new.pricing_correlation_id)
      is not distinct from (old.nightly_rate_mode,old.nightly_rate,
        old.minimum_stay_mode,old.minimum_stay,old.maximum_stay_mode,old.maximum_stay,
        old.pricing_source,old.pricing_reason,old.pricing_expires_at,
        old.pricing_actor_type,old.pricing_actor_id,old.pricing_updated_at,
        old.pricing_correlation_id);
    end if;
  end if;

  if (v_old_hotel=c_hotel or v_new_hotel=c_hotel) and not v_operational_only
     and exists(select 1 from public.hotel_pricing_promotion_reviews review
    where review.hotel_id=c_hotel
      and review.contract_version='seven_kamares_legacy_to_h3_pricing_v1'
      and review.review_status='reviewed' and review.parity_case_count=70
      and review.parity_mismatch_count=0) then
    raise exception using errcode='55000',message='hotels_v2_admin_c_h3_1p_graph_immutable';
  end if;
  return case when tg_op='DELETE' then old else new end;
end
$function$;

create trigger hotel_rate_plans_admin_c_h3_1p_freeze
before insert or update or delete on public.hotel_rate_plans
for each row execute function public.hotel_v2_admin_c_h3_1p_freeze_trigger();
create trigger hotel_room_rates_admin_c_h3_1p_freeze
before insert or update or delete on public.hotel_room_rates
for each row execute function public.hotel_v2_admin_c_h3_1p_freeze_trigger();
create trigger hotel_pricing_schedules_admin_c_h3_1p_freeze
before insert or update or delete on public.hotel_pricing_schedules
for each row execute function public.hotel_v2_admin_c_h3_1p_freeze_trigger();
create trigger hotel_property_pricing_defaults_admin_c_h3_1p_freeze
before insert or update or delete on public.hotel_property_pricing_defaults
for each row execute function public.hotel_v2_admin_c_h3_1p_freeze_trigger();
create trigger hotel_pricing_schedule_tiers_admin_c_h3_1p_freeze
before insert or update or delete on public.hotel_pricing_schedule_occupancy_tiers
for each row execute function public.hotel_v2_admin_c_h3_1p_freeze_trigger();
create trigger hotel_room_rate_tiers_admin_c_h3_1p_freeze
before insert or update or delete on public.hotel_room_rate_occupancy_tiers
for each row execute function public.hotel_v2_admin_c_h3_1p_freeze_trigger();
create trigger hotel_rate_rules_admin_c_h3_1p_freeze
before insert or update or delete on public.hotel_rate_rules
for each row execute function public.hotel_v2_admin_c_h3_1p_freeze_trigger();
create trigger hotel_calendar_overrides_admin_c_h3_1p_freeze
before insert or update or delete on public.hotel_calendar_overrides
for each row execute function public.hotel_v2_admin_c_h3_1p_freeze_trigger();
create trigger hotel_room_allocation_rules_admin_c_h3_1p_freeze
before insert or update or delete on public.hotel_room_allocation_rules
for each row execute function public.hotel_v2_admin_c_h3_1p_freeze_trigger();
create trigger hotel_room_allocation_items_admin_c_h3_1p_freeze
before insert or update or delete on public.hotel_room_allocation_rule_items
for each row execute function public.hotel_v2_admin_c_h3_1p_freeze_trigger();

revoke all on function public.hotel_v2_admin_c_h3_1p_freeze_trigger()
  from public,anon,authenticated,service_role;

create function public.hotel_v2_admin_c_pricing_control_snapshot(p_hotel_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path=pg_catalog,public
as $function$
declare
  c_control constant text:='hotels_v2_admin_c_pricing_control_v1';
  v_hotel public.hotels%rowtype;
  v_flags jsonb;
  v_property jsonb;
  v_default jsonb;
  v_plans jsonb;
  v_rooms jsonb;
  v_rates jsonb;
  v_schedules jsonb;
  v_rules jsonb;
  v_exact jsonb;
  v_allocations jsonb;
  v_legacy jsonb;
  v_token_source jsonb;
  v_token text;
  v_recent jsonb;
  v_result jsonb;
begin
  select * into v_hotel from public.hotels where id=p_hotel_id;
  if not found then
    raise exception using errcode='PT404',message='hotels_v2_admin_c_property_not_found';
  end if;
  perform public.hotel_v2_admin_c_enforce_graph_limits(p_hotel_id);
  select jsonb_build_object(
    'hotel_rooms_v2_enabled',setting.hotel_rooms_v2_enabled,
    'hotel_external_sync_enabled',setting.hotel_external_sync_enabled,
    'hotel_instant_booking_enabled',setting.hotel_instant_booking_enabled,
    'hotel_stripe_connect_enabled',setting.hotel_stripe_connect_enabled
  ) into v_flags from public.site_settings setting where setting.id=1;
  if v_flags is null then
    raise exception using errcode='55000',message='hotels_v2_admin_c_site_settings_missing';
  end if;

  v_property:=jsonb_build_object(
    'id',v_hotel.id,'updated_at',v_hotel.updated_at,
    'architecture_version',v_hotel.architecture_version,
    'currency',v_hotel.currency,'minimum_stay_nights',v_hotel.minimum_stay_nights,
    'booking_mode',v_hotel.booking_mode,
    'maximum_stay_nights',(select profile.maximum_stay_nights
      from public.hotel_property_operational_profiles profile where profile.hotel_id=v_hotel.id),
    'children_policy',v_hotel.children_policy,
    'minimum_child_age',v_hotel.minimum_child_age
  );

  select jsonb_build_object(
    'id',default_price.id,'hotel_id',default_price.hotel_id,
    'nightly_rate',default_price.nightly_rate,'currency',default_price.currency,
    'is_active',default_price.is_active,'review_status',default_price.review_status,
    'lifecycle_status',public.hotel_v2_admin_c_lifecycle(
      default_price.is_active,default_price.review_status),
    'version',default_price.version,'updated_at',default_price.updated_at,
    'immutable_contract',public.hotel_v2_admin_c_immutable_contract(
      default_price.hotel_id,'property_pricing_default',default_price.id),
    'activation_blockers',to_jsonb(array_remove(array[
      case when default_price.currency<>v_hotel.currency then 'currency_mismatch' end,
      case when default_price.nightly_rate<=0 then 'positive_nightly_rate_required' end,
      case when v_hotel.minimum_stay_nights is null then 'minimum_stay_rule_missing' end,
      case when public.hotel_v2_admin_c_is_promotion_entity(default_price.hotel_id,
        'property_pricing_default',default_price.id) then 'h3_1p_contract_immutable' end
    ]::text[],null))
  ) into v_default
  from public.hotel_property_pricing_defaults default_price
  where default_price.hotel_id=p_hotel_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',plan.id,'hotel_id',plan.hotel_id,'code',plan.code,
    'name_i18n',plan.name_i18n,'description_i18n',plan.description_i18n,
    'meal_plan_code',plan.meal_plan_code,'cancellation_policy',plan.cancellation_policy,
    'booking_mode_override',plan.booking_mode_override,
    'price_inclusions',to_jsonb(plan.price_inclusions),'is_active',plan.is_active,
    'review_status',plan.review_status,
    'lifecycle_status',public.hotel_v2_admin_c_lifecycle(plan.is_active,plan.review_status),
    'review_basis',case when public.hotel_v2_admin_c_is_promotion_entity(
      plan.hotel_id,'rate_plan',plan.id) then 'h3_1p_promotion' else 'stored' end,
    'sort_order',plan.sort_order,'version',plan.version,'updated_at',plan.updated_at,
    'immutable_contract',public.hotel_v2_admin_c_immutable_contract(
      plan.hotel_id,'rate_plan',plan.id),
    'activation_blockers',to_jsonb(array_remove(array[
      case when not public.hotel_v2_admin_c_i18n_is_valid(plan.name_i18n,true,240)
        then 'localized_name_incomplete' end,
      case when not public.hotel_v2_admin_c_i18n_is_valid(plan.description_i18n,true,5000,true)
        then 'localized_description_incomplete' end,
      case when not public.hotel_v2_admin_c_cancellation_policy_is_valid(
        plan.cancellation_policy) then 'cancellation_policy_invalid' end,
      case when plan.cancellation_policy->>'type'='requires_review'
        then 'cancellation_policy_requires_review' end,
      case when not exists(select 1 from public.hotel_room_rates linked
        where linked.rate_plan_id=plan.id and linked.review_status='reviewed')
        then 'reviewed_room_rate_required' end,
      case when v_hotel.minimum_stay_nights is null
        then 'minimum_stay_rule_missing' end,
      case when public.hotel_v2_admin_c_is_promotion_entity(
        plan.hotel_id,'rate_plan',plan.id) then 'h3_1p_contract_immutable' end
    ]::text[],null))
  ) order by plan.sort_order,plan.code,plan.id),'[]'::jsonb)
  into v_plans from public.hotel_rate_plans plan where plan.hotel_id=p_hotel_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',room_type.id,'hotel_id',room_type.hotel_id,'code',room_type.code,
    'name_i18n',room_type.name_i18n,'status',room_type.status,
    'max_occupancy',room_type.max_occupancy,'capacity_adults',room_type.capacity_adults,
    'capacity_children',room_type.capacity_children,
    'children_policy_override',room_type.children_policy_override,
    'minimum_child_age_override',room_type.minimum_child_age_override,
    'inventory_mode',room_type.inventory_mode,
    'base_inventory_count',room_type.base_inventory_count,
    'active_unit_count',(select count(*) from public.hotel_units unit_row
      where unit_row.room_type_id=room_type.id and unit_row.status='active'),
    'version',room_type.version,
    'updated_at',room_type.updated_at
  ) order by room_type.sort_order,room_type.code,room_type.id),'[]'::jsonb)
  into v_rooms from public.hotel_room_types room_type where room_type.hotel_id=p_hotel_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',rate.id,'hotel_id',rate.hotel_id,'room_type_id',rate.room_type_id,
    'rate_plan_id',rate.rate_plan_id,'pricing_schedule_id',rate.pricing_schedule_id,
    'base_nightly_rate',rate.base_nightly_rate,'currency',rate.currency,
    'external_redirect_url',rate.external_redirect_url,'is_active',rate.is_active,
    'review_status',rate.review_status,
    'lifecycle_status',public.hotel_v2_admin_c_lifecycle(rate.is_active,rate.review_status),
    'review_basis',case when public.hotel_v2_admin_c_is_promotion_entity(
      rate.hotel_id,'room_rate',rate.id) then 'h3_1p_promotion' else 'stored' end,
    'sort_order',rate.sort_order,'version',rate.version,'updated_at',rate.updated_at,
    'pricing_source',case when rate.pricing_schedule_id is not null then 'pricing_schedule'
      when exists(select 1 from public.hotel_room_rate_occupancy_tiers tier
        where tier.room_rate_id=rate.id and tier.is_active) then 'independent_tiers'
      when rate.base_nightly_rate>0 then 'base_nightly_rate'
      when exists(select 1 from public.hotel_property_pricing_defaults default_price
        where default_price.hotel_id=rate.hotel_id and default_price.is_active
          and default_price.review_status='reviewed' and default_price.nightly_rate>0
          and default_price.currency=rate.currency) then 'property_default'
      else 'missing' end,
    'base_nightly_rate_authoritative',rate.base_nightly_rate>0
      and rate.pricing_schedule_id is null and not exists(
      select 1 from public.hotel_room_rate_occupancy_tiers tier
      where tier.room_rate_id=rate.id and tier.is_active),
    'independent_tiers',coalesce((select jsonb_agg(jsonb_build_object(
      'id',tier.id,'hotel_id',tier.hotel_id,'room_rate_id',tier.room_rate_id,
      'guest_count',tier.guest_count,'threshold_nights',tier.threshold_nights,
      'nightly_rate',tier.nightly_rate,'is_active',tier.is_active,
      'source',tier.source,
      'immutable_contract',case when tier.source<>'manual' then jsonb_build_object(
        'locked',true,'contract_version','pricing_source_provenance_v1',
        'reason','nonmanual_source_read_only') else null end,
      'version',tier.version,'updated_at',tier.updated_at
    ) order by tier.guest_count,tier.threshold_nights,tier.id)
      from public.hotel_room_rate_occupancy_tiers tier
      where tier.room_rate_id=rate.id),'[]'::jsonb),
    'independent_tiers_fingerprint',public.hotel_v2_admin_c_room_tiers_fingerprint(rate.id),
    'immutable_contract',public.hotel_v2_admin_c_immutable_contract(
      rate.hotel_id,'room_rate',rate.id),
    'activation_blockers',to_jsonb(array_remove(array[
      case when (select status from public.hotel_room_types where id=rate.room_type_id)<>'active'
        then 'room_type_not_active' end,
      case when coalesce((select room_type.max_occupancy
            from public.hotel_room_types room_type where room_type.id=rate.room_type_id),
          (select room_type.capacity_adults+room_type.capacity_children
            from public.hotel_room_types room_type where room_type.id=rate.room_type_id)) is null
        or coalesce((select room_type.max_occupancy
            from public.hotel_room_types room_type where room_type.id=rate.room_type_id),
          (select room_type.capacity_adults+room_type.capacity_children
            from public.hotel_room_types room_type where room_type.id=rate.room_type_id))<=0
        then 'room_capacity_missing' end,
      case when v_hotel.minimum_stay_nights is null
        then 'minimum_stay_rule_missing' end,
      case when not exists(select 1 from public.hotel_rate_plans plan
        where plan.id=rate.rate_plan_id and plan.is_active and plan.review_status='reviewed')
        then 'rate_plan_not_active' end,
      case when rate.currency<>v_hotel.currency then 'currency_mismatch' end,
      case when coalesce((select plan.booking_mode_override
          from public.hotel_rate_plans plan where plan.id=rate.rate_plan_id),
          v_hotel.booking_mode)='external_redirect' and (
          not public.hotel_v2_admin_c_https_url_is_valid(rate.external_redirect_url))
        then 'external_redirect_url_required' end,
      case when rate.pricing_schedule_id is not null and not exists(
        select 1 from public.hotel_pricing_schedules schedule
        where schedule.id=rate.pricing_schedule_id and schedule.is_active
          and schedule.review_status='reviewed'
          and schedule.application_scope='room_occupancy'
          and schedule.currency=rate.currency) then 'pricing_schedule_not_ready' end,
      case when rate.pricing_schedule_id is not null and exists(
        select 1 from public.hotel_room_rate_occupancy_tiers tier
        where tier.room_rate_id=rate.id and tier.is_active)
        then 'conflicting_independent_tiers' end,
      case when rate.pricing_schedule_id is not null and exists(
        select 1 from public.hotel_pricing_schedules schedule
        where schedule.id=rate.pricing_schedule_id and (
          v_hotel.minimum_stay_nights is null or exists(
            select 1 from generate_series(schedule.minimum_billable_occupancy::integer,
              least(schedule.maximum_party_size,coalesce((select room_type.max_occupancy
                from public.hotel_room_types room_type where room_type.id=rate.room_type_id),
                (select room_type.capacity_adults+room_type.capacity_children
                from public.hotel_room_types room_type where room_type.id=rate.room_type_id)))::integer) guest_count
            where not exists(select 1 from public.hotel_pricing_schedule_occupancy_tiers tier
              where tier.schedule_id=schedule.id and tier.is_active
                and tier.guest_count=guest_count
                and tier.threshold_nights<=v_hotel.minimum_stay_nights))))
        then 'occupancy_los_coverage_incomplete' end,
      case when rate.pricing_schedule_id is not null and exists(
        select 1 from public.hotel_pricing_schedules schedule
        where schedule.id=rate.pricing_schedule_id
          and schedule.minimum_billable_occupancy>coalesce(
            (select room_type.max_occupancy from public.hotel_room_types room_type
              where room_type.id=rate.room_type_id),
            (select room_type.capacity_adults+room_type.capacity_children
              from public.hotel_room_types room_type
              where room_type.id=rate.room_type_id)))
        then 'minimum_billable_occupancy_exceeds_room' end,
      case when rate.pricing_schedule_id is null
        and exists(select 1 from public.hotel_room_rate_occupancy_tiers tier
          where tier.room_rate_id=rate.id and tier.is_active)
        and (v_hotel.minimum_stay_nights is null or exists(
          select 1 from generate_series((select min(tier.guest_count)::integer
              from public.hotel_room_rate_occupancy_tiers tier
              where tier.room_rate_id=rate.id and tier.is_active),
            coalesce((select room_type.max_occupancy from public.hotel_room_types room_type
              where room_type.id=rate.room_type_id),(select room_type.capacity_adults+
              room_type.capacity_children from public.hotel_room_types room_type
              where room_type.id=rate.room_type_id))) guest_count
          where not exists(select 1 from public.hotel_room_rate_occupancy_tiers tier
            where tier.room_rate_id=rate.id and tier.is_active
              and tier.guest_count=guest_count
              and tier.threshold_nights<=v_hotel.minimum_stay_nights)))
        then 'occupancy_los_coverage_incomplete' end,
      case when rate.pricing_schedule_id is null
        and (select min(tier.guest_count) from public.hotel_room_rate_occupancy_tiers tier
          where tier.room_rate_id=rate.id and tier.is_active)>coalesce(
            (select room_type.max_occupancy from public.hotel_room_types room_type
              where room_type.id=rate.room_type_id),
            (select room_type.capacity_adults+room_type.capacity_children
              from public.hotel_room_types room_type
              where room_type.id=rate.room_type_id))
        then 'minimum_billable_occupancy_exceeds_room' end,
      case when rate.pricing_schedule_id is null and rate.base_nightly_rate<=0
        and not exists(select 1 from public.hotel_room_rate_occupancy_tiers tier
          where tier.room_rate_id=rate.id and tier.is_active)
        and not exists(select 1 from public.hotel_property_pricing_defaults default_price
          where default_price.hotel_id=rate.hotel_id and default_price.is_active
            and default_price.review_status='reviewed' and default_price.nightly_rate>0
            and default_price.currency=rate.currency)
        then 'pricing_source_required' end,
      case when public.hotel_v2_admin_c_is_promotion_entity(
        rate.hotel_id,'room_rate',rate.id) then 'h3_1p_contract_immutable' end
    ]::text[],null))
  ) order by rate.sort_order,rate.id),'[]'::jsonb)
  into v_rates from public.hotel_room_rates rate where rate.hotel_id=p_hotel_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',schedule.id,'hotel_id',schedule.hotel_id,'code',schedule.code,
    'name_i18n',schedule.name_i18n,'application_scope',schedule.application_scope,
    'currency',schedule.currency,'maximum_party_size',schedule.maximum_party_size,
    'minimum_billable_occupancy',schedule.minimum_billable_occupancy,
    'is_active',schedule.is_active,'review_status',schedule.review_status,
    'lifecycle_status',public.hotel_v2_admin_c_lifecycle(
      schedule.is_active,schedule.review_status),
    'source',schedule.source,'source_reference',
      public.hotel_v2_admin_c_schedule_source_summary(
        schedule.source,schedule.source_reference),
    'sharing_mode',schedule.sharing_mode,'version',schedule.version,
    'updated_at',schedule.updated_at,
    'linked_room_rate_ids',coalesce((select jsonb_agg(rate.id order by rate.id)
      from public.hotel_room_rates rate where rate.pricing_schedule_id=schedule.id),'[]'::jsonb),
    'link_fingerprint',public.hotel_v2_admin_c_schedule_link_fingerprint(schedule.id),
    'tiers',coalesce((select jsonb_agg(jsonb_build_object(
      'id',tier.id,'schedule_id',tier.schedule_id,
      'guest_count',tier.guest_count,'threshold_nights',tier.threshold_nights,
      'nightly_rate',tier.nightly_rate,'is_active',tier.is_active,
      'version',tier.version,'updated_at',tier.updated_at
    ) order by tier.guest_count,tier.threshold_nights,tier.id)
      from public.hotel_pricing_schedule_occupancy_tiers tier
      where tier.schedule_id=schedule.id),'[]'::jsonb),
    'tiers_fingerprint',public.hotel_v2_admin_c_schedule_tiers_fingerprint(schedule.id),
    'immutable_contract',coalesce(public.hotel_v2_admin_c_immutable_contract(
      schedule.hotel_id,'pricing_schedule',schedule.id),case
        when schedule.source<>'manual' then jsonb_build_object(
          'locked',true,'contract_version','pricing_source_provenance_v1',
          'reason','nonmanual_source_read_only') else null end),
    'activation_blockers',to_jsonb(array_remove(array[
      case when not public.hotel_v2_admin_c_i18n_is_valid(schedule.name_i18n,true,240)
        then 'localized_name_incomplete' end,
      case when schedule.application_scope<>'room_occupancy'
        then 'property_party_reference_only' end,
      case when schedule.currency<>v_hotel.currency then 'currency_mismatch' end,
      case when v_hotel.minimum_stay_nights is null
        then 'minimum_stay_rule_missing' end,
      case when not exists(select 1 from public.hotel_pricing_schedule_occupancy_tiers tier
        where tier.schedule_id=schedule.id and tier.is_active) then 'active_tier_required' end,
      case when schedule.sharing_mode='independent' and
        (select count(*) from public.hotel_room_rates rate
         where rate.pricing_schedule_id=schedule.id)>1
        then 'independent_schedule_multiple_links' end,
      case when exists(select 1 from generate_series(
        schedule.minimum_billable_occupancy::integer,schedule.maximum_party_size::integer) guest_count
        where not exists(select 1 from public.hotel_pricing_schedule_occupancy_tiers tier
          where tier.schedule_id=schedule.id and tier.is_active
            and tier.guest_count=guest_count
            and tier.threshold_nights<=v_hotel.minimum_stay_nights))
        then 'occupancy_los_coverage_incomplete' end,
      case when schedule.source<>'manual' then 'nonmanual_source_read_only' end,
      case when public.hotel_v2_admin_c_is_promotion_entity(
        schedule.hotel_id,'pricing_schedule',schedule.id)
        then 'h3_1p_contract_immutable' end
    ]::text[],null))
  ) order by schedule.code,schedule.id),'[]'::jsonb)
  into v_schedules from public.hotel_pricing_schedules schedule
  where schedule.hotel_id=p_hotel_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',rule.id,'hotel_id',rate.hotel_id,'room_rate_id',rule.room_rate_id,
    'valid_from',rule.valid_from,'valid_to',rule.valid_to,
    'weekdays',to_jsonb(rule.weekdays),'nightly_rate',rule.nightly_rate,
    'minimum_stay',rule.minimum_stay,'maximum_stay',rule.maximum_stay,
    'closed_to_arrival',rule.closed_to_arrival,
    'closed_to_departure',rule.closed_to_departure,'priority',rule.priority,
    'is_active',rule.is_active,'source',rule.source,'version',rule.version,
    'updated_at',rule.updated_at,'immutable_contract',coalesce(
      public.hotel_v2_admin_c_immutable_contract(rate.hotel_id,'room_rate',rate.id),
      case when rule.source<>'manual' then jsonb_build_object(
        'locked',true,'contract_version','pricing_source_provenance_v1',
        'reason','nonmanual_source_read_only') else null end)
  ) order by rule.valid_from,rule.valid_to,rule.priority desc,rule.id),'[]'::jsonb)
  into v_rules from public.hotel_rate_rules rule
  join public.hotel_room_rates rate on rate.id=rule.room_rate_id
  where rate.hotel_id=p_hotel_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',override_row.id,'hotel_id',override_row.hotel_id,
    'room_rate_id',override_row.room_rate_id,'stay_date',override_row.stay_date,
    'nightly_rate_mode',override_row.nightly_rate_mode,
    'nightly_rate',override_row.nightly_rate,
    'minimum_stay_mode',override_row.minimum_stay_mode,
    'minimum_stay',override_row.minimum_stay,
    'maximum_stay_mode',override_row.maximum_stay_mode,
    'maximum_stay',override_row.maximum_stay,
    'pricing_active',((override_row.nightly_rate_mode is not null
      or override_row.minimum_stay_mode is not null
      or override_row.maximum_stay_mode is not null) and case
        when override_row.pricing_source is null then override_row.is_active
          and (override_row.expires_at is null
            or override_row.expires_at>statement_timestamp())
        else override_row.pricing_expires_at is null
          or override_row.pricing_expires_at>statement_timestamp() end),
    'pricing_source',case when override_row.pricing_source is null and (
      override_row.nightly_rate_mode is not null
      or override_row.minimum_stay_mode is not null
      or override_row.maximum_stay_mode is not null)
      then override_row.source else override_row.pricing_source end,
    'pricing_reason',case when override_row.pricing_source is null and (
      override_row.nightly_rate_mode is not null
      or override_row.minimum_stay_mode is not null
      or override_row.maximum_stay_mode is not null)
      then case when override_row.reason=btrim(override_row.reason)
          and length(override_row.reason) between 1 and 500
          and override_row.reason!~'[[:cntrl:]]' then override_row.reason
        else 'Legacy pricing override (read-only; original reason retained server-side)' end
      else override_row.pricing_reason end,
    'pricing_expires_at',case when override_row.pricing_source is null and (
      override_row.nightly_rate_mode is not null
      or override_row.minimum_stay_mode is not null
      or override_row.maximum_stay_mode is not null)
      then override_row.expires_at else override_row.pricing_expires_at end,
    'pricing_actor_type',case when override_row.pricing_source is null and (
      override_row.nightly_rate_mode is not null
      or override_row.minimum_stay_mode is not null
      or override_row.maximum_stay_mode is not null)
      then override_row.actor_type else override_row.pricing_actor_type end,
    'pricing_actor_id',case when override_row.pricing_source is null and (
      override_row.nightly_rate_mode is not null
      or override_row.minimum_stay_mode is not null
      or override_row.maximum_stay_mode is not null)
      then override_row.actor_id else override_row.pricing_actor_id end,
    'pricing_updated_at',case when override_row.pricing_source is null and (
      override_row.nightly_rate_mode is not null
      or override_row.minimum_stay_mode is not null
      or override_row.maximum_stay_mode is not null)
      then override_row.updated_at else override_row.pricing_updated_at end,
    'pricing_correlation_id',override_row.pricing_correlation_id,
    'shared_with_calendar',(override_row.closed_mode is not null
      or override_row.closed_to_arrival_mode is not null
      or override_row.closed_to_departure_mode is not null),
    'pricing_configured',(override_row.nightly_rate_mode is not null
      or override_row.minimum_stay_mode is not null
      or override_row.maximum_stay_mode is not null),
    'immutable_contract',coalesce(public.hotel_v2_admin_c_immutable_contract(
      override_row.hotel_id,'exact_date_price',override_row.id),case
        when override_row.pricing_source is null and (
          override_row.nightly_rate_mode is not null
          or override_row.minimum_stay_mode is not null
          or override_row.maximum_stay_mode is not null) then jsonb_build_object(
            'locked',true,'contract_version','pre_admin_c_calendar_pricing_v1',
            'reason','legacy_exact_pricing_read_only')
        when override_row.pricing_source<>'manual' then jsonb_build_object(
          'locked',true,'contract_version','pricing_source_provenance_v1',
          'reason','nonmanual_source_read_only') else null end),
    'version',override_row.version,'updated_at',override_row.updated_at
  ) order by override_row.stay_date,override_row.room_rate_id,override_row.id),'[]'::jsonb)
  into v_exact from public.hotel_calendar_overrides override_row
  where override_row.hotel_id=p_hotel_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',allocation.id,'hotel_id',allocation.hotel_id,'code',allocation.code,
    'allocation_mode',allocation.allocation_mode,
    'min_guest_count',allocation.min_guest_count,
    'max_guest_count',allocation.max_guest_count,
    'is_active',allocation.is_active,'review_status',allocation.review_status,
    'lifecycle_status',public.hotel_v2_admin_c_lifecycle(
      allocation.is_active,allocation.review_status),
    'sort_order',allocation.sort_order,'version',allocation.version,
    'updated_at',allocation.updated_at,
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',item.id,'hotel_id',item.hotel_id,
      'allocation_rule_id',item.allocation_rule_id,'room_type_id',item.room_type_id,
      'units_required',item.units_required,
      'allocated_guest_count',item.allocated_guest_count,
      'pricing_guest_count',item.pricing_guest_count,
      'allocated_guest_counts',to_jsonb(item.allocated_guest_counts),
      'pricing_guest_counts',to_jsonb(item.pricing_guest_counts),
      'sort_order',item.sort_order,'version',item.version
    ) order by item.sort_order,item.id) from public.hotel_room_allocation_rule_items item
      where item.allocation_rule_id=allocation.id),'[]'::jsonb),
    'items_fingerprint',public.hotel_v2_admin_c_allocation_items_fingerprint(allocation.id),
    'immutable_contract',public.hotel_v2_admin_c_immutable_contract(
      allocation.hotel_id,'allocation_rule',allocation.id),
    'activation_blockers',to_jsonb(array_remove(array[
      case when allocation.review_status<>'reviewed'
        then 'allocation_not_reviewed' end,
      case when not exists(select 1 from public.hotel_room_allocation_rule_items item
        where item.allocation_rule_id=allocation.id) then 'allocation_item_required' end,
      case when exists(select 1 from public.hotel_room_allocation_rule_items item
        where item.allocation_rule_id=allocation.id and (
          (allocation.allocation_mode='customer_choice' and (
            item.units_required<>1 or item.allocated_guest_count is not null
            or item.pricing_guest_count is not null
            or item.allocated_guest_counts is not null
            or item.pricing_guest_counts is not null))
          or (allocation.allocation_mode='required_bundle' and (
            item.allocated_guest_count is null or item.pricing_guest_count is null
            or (item.units_required>1 and (item.allocated_guest_counts is null
              or item.pricing_guest_counts is null))))))
        then 'allocation_contract_incomplete' end,
      case when exists(select 1 from public.hotel_room_allocation_rule_items item
        left join public.hotel_room_types room_type on room_type.id=item.room_type_id
        where item.allocation_rule_id=allocation.id and (
          room_type.id is null or room_type.hotel_id<>allocation.hotel_id
          or room_type.status<>'active'
          or coalesce(room_type.max_occupancy,
            room_type.capacity_adults+room_type.capacity_children) is null
          or coalesce(room_type.max_occupancy,
            room_type.capacity_adults+room_type.capacity_children)<=0))
        then 'allocation_room_not_ready' end,
      case when exists(select 1 from public.hotel_room_allocation_rule_items item
        join public.hotel_room_types room_type on room_type.id=item.room_type_id
        where item.allocation_rule_id=allocation.id and (
          (room_type.inventory_mode='pooled'
            and item.units_required>room_type.base_inventory_count)
          or (room_type.inventory_mode='unitized' and item.units_required>(
            select count(*) from public.hotel_units unit_row
            where unit_row.room_type_id=room_type.id and unit_row.status='active'))))
        then 'allocation_inventory_insufficient' end,
      case when exists(select 1 from public.hotel_room_allocation_rule_items item
        join public.hotel_room_types room_type on room_type.id=item.room_type_id
        where item.allocation_rule_id=allocation.id and (
          (allocation.allocation_mode='customer_choice' and coalesce(
            room_type.max_occupancy,room_type.capacity_adults+
              room_type.capacity_children)<allocation.max_guest_count)
          or (allocation.allocation_mode='required_bundle' and (
            item.allocated_guest_count>coalesce(room_type.max_occupancy,
              room_type.capacity_adults+room_type.capacity_children)*item.units_required
            or item.pricing_guest_count>coalesce(room_type.max_occupancy,
              room_type.capacity_adults+room_type.capacity_children)*item.units_required
            or exists(select 1 from unnest(item.allocated_guest_counts) guest_count
              where guest_count>coalesce(room_type.max_occupancy,
                room_type.capacity_adults+room_type.capacity_children))
            or exists(select 1 from unnest(item.pricing_guest_counts) guest_count
              where guest_count>coalesce(room_type.max_occupancy,
                room_type.capacity_adults+room_type.capacity_children))))))
        then 'allocation_capacity_exceeded' end,
      case when allocation.allocation_mode='required_bundle' and (
        allocation.min_guest_count<>allocation.max_guest_count
        or coalesce((select sum(item.allocated_guest_count)
          from public.hotel_room_allocation_rule_items item
          where item.allocation_rule_id=allocation.id),0)<>allocation.min_guest_count
        or coalesce((select sum(item.units_required)
          from public.hotel_room_allocation_rule_items item
          where item.allocation_rule_id=allocation.id),0)<1)
        then 'bundle_guest_total_mismatch' end,
      case when exists(select 1 from public.hotel_room_allocation_rules other
        where other.hotel_id=allocation.hotel_id and other.id<>allocation.id
          and other.is_active and other.review_status='reviewed'
          and allocation.min_guest_count<=other.max_guest_count
          and other.min_guest_count<=allocation.max_guest_count)
        then 'active_allocation_range_overlap' end,
      case when exists(
        select 1 from generate_series(1,greatest(allocation.max_guest_count::integer,
          coalesce((select max(other.max_guest_count)::integer
            from public.hotel_room_allocation_rules other
            where other.hotel_id=allocation.hotel_id and other.id<>allocation.id
              and other.is_active and other.review_status='reviewed'),0))) guest_count
        where (case when guest_count between allocation.min_guest_count
              and allocation.max_guest_count then 1 else 0 end)
          +(select count(*) from public.hotel_room_allocation_rules other
            where other.hotel_id=allocation.hotel_id and other.id<>allocation.id
              and other.is_active and other.review_status='reviewed'
              and guest_count between other.min_guest_count and other.max_guest_count)<>1)
        then 'active_allocation_coverage_gap' end,
      case when public.hotel_v2_admin_c_is_promotion_entity(
        allocation.hotel_id,'allocation_rule',allocation.id)
        then 'h3_1p_contract_immutable' end
    ]::text[],null))
  ) order by allocation.sort_order,allocation.code,allocation.id),'[]'::jsonb)
  into v_allocations from public.hotel_room_allocation_rules allocation
  where allocation.hotel_id=p_hotel_id;

  v_legacy:=jsonb_build_object(
    'architecture_version',v_hotel.architecture_version,
    'legacy_pricing_authoritative',v_hotel.architecture_version='legacy',
    'legacy_pricing_rule_count',case when p_hotel_id=
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
      then jsonb_array_length(v_hotel.pricing_tiers->'rules') else null end,
    'legacy_pricing_fingerprint',case when p_hotel_id=
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
      then md5(v_hotel.pricing_tiers::text) else null end,
    'public_change',false
  );
  v_token_source:=jsonb_build_object(
    'property',jsonb_build_object(
      'id',v_hotel.id,'architecture_version',v_hotel.architecture_version,
      'currency',v_hotel.currency,'minimum_stay_nights',v_hotel.minimum_stay_nights,
      'booking_mode',v_hotel.booking_mode,
      'maximum_stay_nights',v_property->'maximum_stay_nights',
      'children_policy',v_hotel.children_policy,
      'minimum_child_age',v_hotel.minimum_child_age
    ),
    'feature_flags',v_flags,'legacy_safety',v_legacy,
    'property_pricing_default',v_default,
    'rate_plans',v_plans,
    'room_types',coalesce((select jsonb_agg(
      room.value-'name_i18n'-'code'-'version'-'updated_at' order by room.value->>'id')
      from jsonb_array_elements(v_rooms) room(value)),'[]'::jsonb),
    'room_rates',v_rates,'pricing_schedules',v_schedules,
    'rate_rules',coalesce((select jsonb_agg(
      rule.value-'closed_to_arrival'-'closed_to_departure'-'version'-'updated_at'
      order by rule.value->>'id')
      from jsonb_array_elements(v_rules) rule(value)),'[]'::jsonb),
    'exact_date_prices',coalesce((select jsonb_agg(
      exact.value-'pricing_source'-'pricing_reason'-'pricing_actor_type'
        -'pricing_actor_id'-'pricing_updated_at'-'pricing_correlation_id'
        -'shared_with_calendar'-'version'-'updated_at'
      order by exact.value->>'id') from jsonb_array_elements(v_exact) exact(value)
      where (exact.value->>'pricing_configured')::boolean),'[]'::jsonb),
    'allocation_rules',v_allocations
  );
  v_token:=encode(digest(convert_to(v_token_source::text,'UTF8'),'sha256'),'hex');

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',activity.id,'entity_type',activity.entity_type,
    'entity_id',activity.entity_id,'action',activity.action,
    'correlation_id',activity.correlation_id,'actor_type',activity.actor_type,
    'actor_id',activity.actor_id,
    'source',case when activity.source='hotels_v2_admin_c_pricing_control'
      then activity.source else 'historical_pricing_activity' end,
    'created_at',activity.created_at,
    'before_state',case when activity.source='hotels_v2_admin_c_pricing_control'
      then activity.before_state else null end,
    'after_state',case when activity.source='hotels_v2_admin_c_pricing_control'
      then activity.after_state else null end
  ) order by activity.created_at desc,activity.id desc),
    '[]'::jsonb) into v_recent
  from (select id,entity_type,entity_id,action,correlation_id,actor_type,actor_id,
      source,created_at,before_state,after_state
    from public.hotel_activity_log where hotel_id=p_hotel_id
    and entity_type in('property_pricing_default','rate_plan','room_rate','pricing_schedule','occupancy_tier',
      'rate_rule','calendar_override','allocation_rule')
    and action in('create','update','disable','duplicate','delete')
    and actor_type in('admin','partner','sync','system')
    and (actor_id is not null or actor_type in('sync','system'))
    order by created_at desc,id desc limit 100) activity;

  v_result:=jsonb_build_object(
    'contract_version',c_control,'hotel_id',p_hotel_id,
    'property',v_property,'feature_flags',v_flags,'legacy_safety',v_legacy,
    'property_pricing_default',v_default,
    'snapshot_token',v_token,'rate_plans',v_plans,'room_types',v_rooms,
    'room_rates',v_rates,'pricing_schedules',v_schedules,'rate_rules',v_rules,
    'exact_date_prices',v_exact,'allocation_rules',v_allocations,
    'recent_activity',v_recent
  );
  if octet_length(convert_to(v_result::text,'UTF8'))>20971520 then
    raise exception using errcode='54000',
      message='hotels_v2_admin_c_technical_limit_exceeded',
      detail=jsonb_build_object('snapshot_bytes',
        octet_length(convert_to(v_result::text,'UTF8')),
        'limit',20971520)::text;
  end if;
  return v_result;
end
$function$;

revoke all on function public.hotel_v2_admin_c_pricing_control_snapshot(uuid)
  from public,anon,authenticated,service_role;

create function public.hotel_v2_admin_get_pricing_control(p_hotel_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path=pg_catalog,public,auth
as $function$
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_hotel_id is null then
    raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_hotel_id';
  end if;
  return public.hotel_v2_admin_c_pricing_control_snapshot(p_hotel_id);
end
$function$;

create function public.hotel_v2_admin_c_blocker(
  p_code text,
  p_entity text default null,
  p_entity_id uuid default null,
  p_stay_date date default null,
  p_detail jsonb default null
)
returns jsonb language sql immutable set search_path=pg_catalog
as $function$
  select jsonb_build_object('code',p_code,'entity',p_entity,
    'entity_id',p_entity_id,'stay_date',p_stay_date,'detail',p_detail)
$function$;

revoke all on function public.hotel_v2_admin_c_blocker(text,text,uuid,date,jsonb)
  from public,anon,authenticated,service_role;

create function public.hotel_v2_admin_c_child_slots_are_feasible(
  p_child_ages smallint[],p_required_thresholds smallint[],p_optional_thresholds smallint[]
)
returns boolean
language plpgsql
immutable
set search_path=pg_catalog
as $function$
declare
  v_children smallint[];
  v_required smallint[];
  v_optional smallint[];
  v_threshold smallint;
  v_child smallint;
  v_position integer;
  v_index integer;
begin
  select coalesce(array_agg(age order by age),'{}'::smallint[]) into v_children
    from unnest(coalesce(p_child_ages,'{}'::smallint[])) age;
  select coalesce(array_agg(threshold order by threshold desc),'{}'::smallint[])
    into v_required from unnest(coalesce(p_required_thresholds,'{}'::smallint[])) threshold;
  if cardinality(v_children)<cardinality(v_required) then return false; end if;
  foreach v_threshold in array v_required loop
    select min(age) into v_child from unnest(v_children) age where age>=v_threshold;
    if v_child is null then return false; end if;
    v_position:=array_position(v_children,v_child);
    v_children:=coalesce(v_children[1:v_position-1],'{}'::smallint[])
      ||coalesce(v_children[v_position+1:cardinality(v_children)],'{}'::smallint[]);
  end loop;
  if cardinality(v_children)>cardinality(coalesce(p_optional_thresholds,'{}'::smallint[])) then
    return false;
  end if;
  select coalesce(array_agg(threshold order by threshold),'{}'::smallint[])
    into v_optional from (
      select threshold from unnest(coalesce(p_optional_thresholds,'{}'::smallint[])) threshold
      order by threshold limit cardinality(v_children)
    ) selected;
  select coalesce(array_agg(age order by age),'{}'::smallint[]) into v_children
    from unnest(v_children) age;
  if cardinality(v_children)>0 then
    for v_index in 1..cardinality(v_children) loop
      if v_children[v_index]<v_optional[v_index] then return false; end if;
    end loop;
  end if;
  return true;
end
$function$;

revoke all on function public.hotel_v2_admin_c_child_slots_are_feasible(
  smallint[],smallint[],smallint[]) from public,anon,authenticated,service_role;

create function public.hotel_v2_admin_c_resolve_price_product(
  p_room_rate_id uuid,
  p_check_in date,
  p_check_out date,
  p_pricing_guest_count integer
)
returns jsonb
language plpgsql
security definer
stable
set search_path=pg_catalog,public
as $function$
declare
  v_rate public.hotel_room_rates%rowtype;
  v_plan public.hotel_rate_plans%rowtype;
  v_room public.hotel_room_types%rowtype;
  v_hotel public.hotels%rowtype;
  v_default public.hotel_property_pricing_defaults%rowtype;
  v_schedule public.hotel_pricing_schedules%rowtype;
  v_tier public.hotel_pricing_schedule_occupancy_tiers%rowtype;
  v_direct public.hotel_room_rate_occupancy_tiers%rowtype;
  v_weekday public.hotel_rate_rules%rowtype;
  v_range public.hotel_rate_rules%rowtype;
  v_exact public.hotel_calendar_overrides%rowtype;
  v_date date;
  v_nights integer;
  v_base numeric(12,2);
  v_base_source text;
  v_base_source_id uuid;
  v_base_threshold integer;
  v_min_billable integer;
  v_value numeric(12,2);
  v_source text;
  v_source_id uuid;
  v_minimum integer;
  v_maximum integer;
  v_minimum_source text;
  v_maximum_source text;
  v_minimum_source_id uuid;
  v_maximum_source_id uuid;
  v_effective_minimum integer;
  v_effective_maximum integer;
  v_stay_allowed boolean:=true;
  v_structural_ok boolean:=true;
  v_exact_price_id uuid;
  v_total numeric(14,2):=0;
  v_breakdown jsonb:='[]'::jsonb;
  v_blockers jsonb:='[]'::jsonb;
  v_property_bound_blockers jsonb:='[]'::jsonb;
  v_resolved_occupancy integer;
  v_minimum_configured_occupancy integer;
begin
  if p_room_rate_id is null or p_check_in is null or p_check_out is null
     or p_check_out<=p_check_in or p_pricing_guest_count is null
     or p_pricing_guest_count<1 then
    raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_product_preview';
  end if;
  v_nights:=p_check_out-p_check_in;
  select * into v_rate from public.hotel_room_rates where id=p_room_rate_id;
  if not found then
    return jsonb_build_object('ok',false,'blocking_reasons',jsonb_build_array(
      public.hotel_v2_admin_c_blocker('room_rate_not_found','room_rate',p_room_rate_id)),'nightly_breakdown','[]'::jsonb,
      'total',null);
  end if;
  select * into v_plan from public.hotel_rate_plans where id=v_rate.rate_plan_id;
  select * into v_room from public.hotel_room_types where id=v_rate.room_type_id;
  select * into v_hotel from public.hotels where id=v_rate.hotel_id;
  if v_plan.id is null or v_room.id is null or v_hotel.id is null
     or v_plan.hotel_id<>v_rate.hotel_id or v_room.hotel_id<>v_rate.hotel_id then
    return jsonb_build_object('ok',false,'blocking_reasons',jsonb_build_array(
      public.hotel_v2_admin_c_blocker('room_rate_relationship_invalid','room_rate',v_rate.id)),
      'nightly_breakdown','[]'::jsonb,'total',null);
  end if;
  if not v_rate.is_active then
    v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
      'room_rate_inactive','room_rate',v_rate.id));
  end if;
  if not coalesce(v_plan.is_active,false) then
    v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
      'rate_plan_inactive','rate_plan',v_rate.rate_plan_id));
  end if;
  if v_rate.review_status<>'reviewed' then
    v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
      'room_rate_requires_review','room_rate',v_rate.id));
  end if;
  if v_plan.review_status<>'reviewed' or v_plan.cancellation_policy->>'type'='requires_review' then
    v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
      'rate_plan_requires_review','rate_plan',v_plan.id));
  end if;
  if v_room.status<>'active' then
    v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
      'room_type_inactive','room_type',v_room.id));
    v_structural_ok:=false;
  end if;
  if coalesce(v_room.max_occupancy,
       v_room.capacity_adults+v_room.capacity_children) is null
     or coalesce(v_room.max_occupancy,
       v_room.capacity_adults+v_room.capacity_children)<=0 then
    v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
      'room_capacity_missing','room_type',v_room.id));
    v_structural_ok:=false;
  elsif p_pricing_guest_count>coalesce(v_room.max_occupancy,
       v_room.capacity_adults+v_room.capacity_children) then
    v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
      'pricing_occupancy_exceeds_room','room_type',v_room.id,null,
      jsonb_build_object('pricing_guest_count',p_pricing_guest_count,
        'capacity',coalesce(v_room.max_occupancy,
          v_room.capacity_adults+v_room.capacity_children))));
    v_structural_ok:=false;
  end if;
  if v_rate.currency<>v_hotel.currency then
    v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
      'room_rate_currency_mismatch','room_rate',v_rate.id));
    v_structural_ok:=false;
  end if;
  select profile.maximum_stay_nights into v_maximum
    from public.hotel_property_operational_profiles profile
    where profile.hotel_id=v_hotel.id;
  if v_hotel.minimum_stay_nights is not null
     and v_nights<v_hotel.minimum_stay_nights then
    v_property_bound_blockers:=v_property_bound_blockers||jsonb_build_array(
      public.hotel_v2_admin_c_blocker('below_minimum_stay','room_rate',v_rate.id,
        p_check_in,jsonb_build_object('required',v_hotel.minimum_stay_nights,
          'actual',v_nights,'source','property')));
  end if;
  if v_maximum is not null and v_nights>v_maximum then
    v_property_bound_blockers:=v_property_bound_blockers||jsonb_build_array(
      public.hotel_v2_admin_c_blocker('above_maximum_stay','room_rate',v_rate.id,
        p_check_in,jsonb_build_object('required',v_maximum,'actual',v_nights,
          'source','property')));
  end if;

  if v_rate.pricing_schedule_id is not null then
    select * into v_schedule from public.hotel_pricing_schedules
      where id=v_rate.pricing_schedule_id;
    v_resolved_occupancy:=greatest(p_pricing_guest_count,
      coalesce(v_schedule.minimum_billable_occupancy,1));
    select * into v_tier from public.hotel_pricing_schedule_occupancy_tiers tier
      where tier.schedule_id=v_schedule.id and tier.is_active
        and tier.guest_count=v_resolved_occupancy
        and tier.threshold_nights<=v_nights
      order by tier.threshold_nights desc,tier.id limit 1;
    if not found then
      return jsonb_build_object('ok',false,'blocking_reasons',v_blockers||
        v_property_bound_blockers||
        jsonb_build_array(public.hotel_v2_admin_c_blocker(
          'missing_schedule_occupancy_los_tier','pricing_schedule',v_schedule.id,null,
          jsonb_build_object('pricing_guest_count',v_resolved_occupancy,'nights',v_nights))),
        'nightly_breakdown','[]'::jsonb,'total',null);
    end if;
    v_base:=v_tier.nightly_rate;
    v_base_source:='pricing_schedule_tier'; v_base_source_id:=v_tier.id;
    v_base_threshold:=v_tier.threshold_nights;
    v_min_billable:=v_schedule.minimum_billable_occupancy;
    if not v_schedule.is_active or v_schedule.review_status<>'reviewed' then
      v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
        'pricing_schedule_inactive_or_unreviewed','pricing_schedule',v_schedule.id));
    end if;
    if v_schedule.application_scope<>'room_occupancy'
       or v_schedule.currency<>v_rate.currency then
      v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
        'pricing_schedule_relationship_invalid','pricing_schedule',v_schedule.id));
      v_structural_ok:=false;
    end if;
  elsif exists(select 1 from public.hotel_room_rate_occupancy_tiers tier
      where tier.room_rate_id=v_rate.id and tier.is_active) then
    select min(tier.guest_count)::integer into v_minimum_configured_occupancy
    from public.hotel_room_rate_occupancy_tiers tier
    where tier.room_rate_id=v_rate.id and tier.is_active;
    v_resolved_occupancy:=greatest(p_pricing_guest_count,v_minimum_configured_occupancy);
    select * into v_direct from public.hotel_room_rate_occupancy_tiers tier
      where tier.room_rate_id=v_rate.id and tier.is_active
        and tier.guest_count=v_resolved_occupancy
        and tier.threshold_nights<=v_nights
      order by tier.threshold_nights desc,tier.id limit 1;
    if not found then
      return jsonb_build_object('ok',false,'blocking_reasons',v_blockers||
        v_property_bound_blockers||
        jsonb_build_array(public.hotel_v2_admin_c_blocker(
          'missing_independent_occupancy_los_tier','room_rate',v_rate.id,null,
          jsonb_build_object('pricing_guest_count',v_resolved_occupancy,'nights',v_nights))),
        'nightly_breakdown','[]'::jsonb,'total',null);
    end if;
    v_base:=v_direct.nightly_rate;
    v_base_source:='independent_occupancy_tier'; v_base_source_id:=v_direct.id;
    v_base_threshold:=v_direct.threshold_nights;
    v_min_billable:=v_minimum_configured_occupancy;
  else
    v_resolved_occupancy:=p_pricing_guest_count;
    v_base_threshold:=null; v_min_billable:=1;
    if v_rate.base_nightly_rate>0 then
      v_base:=v_rate.base_nightly_rate;
      v_base_source:='base_nightly_rate'; v_base_source_id:=v_rate.id;
    else
      select * into v_default from public.hotel_property_pricing_defaults
        where hotel_id=v_hotel.id;
      if not found then
        return jsonb_build_object('ok',false,'blocking_reasons',v_blockers||
          v_property_bound_blockers||
          jsonb_build_array(public.hotel_v2_admin_c_blocker(
            'property_default_pricing_missing','property',v_hotel.id,null,
            jsonb_build_object('room_rate_id',v_rate.id))),
          'nightly_breakdown','[]'::jsonb,'total',null);
      end if;
      v_base:=v_default.nightly_rate;
      v_base_source:='property_default'; v_base_source_id:=v_default.id;
      if not v_default.is_active or v_default.review_status<>'reviewed' then
        v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
          'property_pricing_default_inactive_or_unreviewed',
          'property_pricing_default',v_default.id));
      end if;
      if v_default.currency<>v_rate.currency then
        v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
          'property_pricing_default_currency_mismatch',
          'property_pricing_default',v_default.id));
        v_structural_ok:=false;
      end if;
    end if;
  end if;

  if not v_structural_ok then
    return jsonb_build_object('ok',false,
      'blocking_reasons',v_blockers||v_property_bound_blockers,
      'nightly_breakdown','[]'::jsonb,'total',null);
  end if;

  for v_date in select generate_series(p_check_in::timestamp,
      (p_check_out-1)::timestamp,interval '1 day')::date loop
    v_value:=v_base; v_source:=v_base_source; v_source_id:=v_base_source_id;
    v_minimum:=v_hotel.minimum_stay_nights;
    select profile.maximum_stay_nights into v_maximum
      from public.hotel_property_operational_profiles profile where profile.hotel_id=v_hotel.id;
    v_minimum_source:=case when v_minimum is null then null else 'property' end;
    v_maximum_source:=case when v_maximum is null then null else 'property' end;
    v_minimum_source_id:=case when v_minimum is null then null else v_hotel.id end;
    v_maximum_source_id:=case when v_maximum is null then null else v_hotel.id end;
    v_exact_price_id:=null;
    v_weekday:=null; v_range:=null; v_exact:=null;

    select * into v_weekday from public.hotel_rate_rules rule
      where rule.room_rate_id=v_rate.id and rule.is_active
        and cardinality(rule.weekdays)<7 and v_date between rule.valid_from and rule.valid_to
        and extract(isodow from v_date)::smallint=any(rule.weekdays)
      order by rule.priority desc,rule.id limit 1;
    if found then
      v_value:=v_weekday.nightly_rate; v_source:='weekday_rule'; v_source_id:=v_weekday.id;
      if v_weekday.minimum_stay is not null then
        v_minimum:=v_weekday.minimum_stay; v_minimum_source:='weekday_rule';
        v_minimum_source_id:=v_weekday.id; end if;
      if v_weekday.maximum_stay is not null then
        v_maximum:=v_weekday.maximum_stay; v_maximum_source:='weekday_rule';
        v_maximum_source_id:=v_weekday.id; end if;
    end if;
    select * into v_range from public.hotel_rate_rules rule
      where rule.room_rate_id=v_rate.id and rule.is_active
        and cardinality(rule.weekdays)=7 and v_date between rule.valid_from and rule.valid_to
      order by rule.priority desc,rule.id limit 1;
    if found then
      v_value:=v_range.nightly_rate; v_source:='seasonal_range_rule'; v_source_id:=v_range.id;
      if v_range.minimum_stay is not null then v_minimum:=v_range.minimum_stay;
        v_minimum_source:='seasonal_range_rule'; v_minimum_source_id:=v_range.id; end if;
      if v_range.maximum_stay is not null then v_maximum:=v_range.maximum_stay;
        v_maximum_source:='seasonal_range_rule'; v_maximum_source_id:=v_range.id; end if;
    end if;
    select * into v_exact from public.hotel_calendar_overrides override_row
      where override_row.room_rate_id=v_rate.id and override_row.stay_date=v_date
        and (override_row.nightly_rate_mode is not null
          or override_row.minimum_stay_mode is not null
          or override_row.maximum_stay_mode is not null)
        and case when override_row.pricing_source is null then
          override_row.is_active and (override_row.expires_at is null
            or override_row.expires_at>statement_timestamp())
        else override_row.pricing_expires_at is null
          or override_row.pricing_expires_at>statement_timestamp() end;
    if found then
      v_exact_price_id:=v_exact.id;
      if v_exact.nightly_rate_mode='set' then
        v_value:=v_exact.nightly_rate; v_source:='exact_date_price'; v_source_id:=v_exact.id;
      end if;
      if v_exact.minimum_stay_mode='set' then v_minimum:=v_exact.minimum_stay;
        v_minimum_source:='exact_date_price'; v_minimum_source_id:=v_exact.id; end if;
      if v_exact.maximum_stay_mode='set' then v_maximum:=v_exact.maximum_stay;
        v_maximum_source:='exact_date_price'; v_maximum_source_id:=v_exact.id; end if;
    end if;
    if v_date=p_check_in and v_minimum is not null and v_nights<v_minimum then
      v_stay_allowed:=false; v_blockers:=v_blockers||jsonb_build_array(
        public.hotel_v2_admin_c_blocker('below_minimum_stay','room_rate',v_rate.id,
          v_date,jsonb_build_object('required',v_minimum,'actual',v_nights)));
    end if;
    if v_date=p_check_in and v_maximum is not null and v_nights>v_maximum then
      v_stay_allowed:=false; v_blockers:=v_blockers||jsonb_build_array(
        public.hotel_v2_admin_c_blocker('above_maximum_stay','room_rate',v_rate.id,
          v_date,jsonb_build_object('required',v_maximum,'actual',v_nights)));
    end if;
    if v_date=p_check_in and v_minimum is null then
      v_structural_ok:=false; v_stay_allowed:=false;
      v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
        'minimum_stay_rule_missing','room_rate',v_rate.id,v_date));
    end if;
    if v_date=p_check_in then v_effective_minimum:=v_minimum; v_effective_maximum:=v_maximum; end if;
    v_total:=v_total+v_value;
    v_breakdown:=v_breakdown||jsonb_build_array(jsonb_build_object(
      'stay_date',v_date,'room_rate_id',v_rate.id,
      'requested_pricing_guest_count',p_pricing_guest_count,
      'resolved_pricing_guest_count',v_resolved_occupancy,
      'minimum_billable_occupancy',v_min_billable,
      'base_pricing_source',v_base_source,'base_pricing_source_id',v_base_source_id,
      'los_threshold_nights',v_base_threshold,
      'weekday_rule_id',v_weekday.id,'seasonal_range_rule_id',v_range.id,
      'exact_date_price_id',v_exact_price_id,'final_pricing_source',v_source,
      'nightly_rate',round(v_value,2),'currency',v_rate.currency,
      'effective_minimum_stay',v_minimum,'effective_maximum_stay',v_maximum,
      'minimum_stay_source',v_minimum_source,'minimum_stay_source_id',v_minimum_source_id,
      'maximum_stay_source',v_maximum_source,'maximum_stay_source_id',v_maximum_source_id
    ));
  end loop;
  return jsonb_build_object('ok',v_structural_ok and v_stay_allowed,
    'blocking_reasons',v_blockers,
    'nightly_breakdown',case when v_structural_ok and v_stay_allowed
      then v_breakdown else '[]'::jsonb end,
    'total',case when v_structural_ok and v_stay_allowed
      then round(v_total,2) else null end,
    'room_rate_id',v_rate.id,'rate_plan_id',v_rate.rate_plan_id,
    'room_type_id',v_rate.room_type_id,'currency',v_rate.currency,
    'requested_pricing_guest_count',p_pricing_guest_count,
    'resolved_pricing_guest_count',v_resolved_occupancy,
    'minimum_billable_occupancy',v_min_billable,
    'base_pricing_source',v_base_source,'base_pricing_source_id',v_base_source_id,
    'los_threshold_nights',v_base_threshold,
    'effective_minimum_stay',v_effective_minimum,
    'effective_maximum_stay',v_effective_maximum,'stay_allowed',v_stay_allowed,
    'booking_mode',coalesce(v_plan.booking_mode_override,v_hotel.booking_mode),
    'cancellation_policy',v_plan.cancellation_policy,
    'price_inclusions',to_jsonb(v_plan.price_inclusions));
end
$function$;

revoke all on function public.hotel_v2_admin_c_resolve_price_product(uuid,date,date,integer)
  from public,anon,authenticated,service_role;

create function public.hotel_v2_admin_preview_pricing_quote(p_request jsonb)
returns jsonb
language plpgsql
security definer
stable
set search_path=pg_catalog,public,auth
as $function$
declare
  c_contract constant text:='hotels_v2_admin_c_pricing_preview_v1';
  v_hotel_id uuid; v_plan_id uuid; v_rule_id uuid; v_selected_room_id uuid;
  v_check_in date; v_check_out date; v_adults integer; v_child_ages smallint[];
  v_guest_count integer; v_nights integer; v_control jsonb; v_hotel public.hotels%rowtype;
  v_rule public.hotel_room_allocation_rules%rowtype; v_item record; v_unit integer;
  v_physical smallint; v_pricing smallint; v_rate_id uuid; v_product jsonb;
  v_resolved jsonb; v_allocation jsonb:='[]'::jsonb; v_products jsonb:='[]'::jsonb;
  v_breakdown jsonb:='[]'::jsonb; v_blockers jsonb:='[]'::jsonb;
  v_total numeric(14,2):=0; v_ok boolean:=true; v_policy text; v_min_age smallint;
  v_item_count integer:=0; v_candidate_count integer; v_requestable boolean:=false;
  v_bundle_child_lower integer:=0; v_bundle_child_upper integer:=0;
  v_bundle_demographic_ambiguous boolean:=false;
  v_bundle_demographic_impossible boolean:=false;
  v_bundle_physical_total integer:=0;
  v_unit_child_lower integer; v_unit_child_upper integer; v_unit_child_threshold smallint;
  v_required_child_thresholds smallint[]:='{}'::smallint[];
  v_optional_child_thresholds smallint[]:='{}'::smallint[];
  v_slot integer;
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_request is null or jsonb_typeof(p_request)<>'object'
     or not public.hotel_v2_h2a_keys_allowed(p_request,array[
       'contract_version','hotel_id','snapshot_token','rate_plan_id',
       'allocation_rule_id','selected_room_type_id','check_in','check_out',
       'adults','child_ages'])
     or not (p_request ?& array['contract_version','hotel_id','snapshot_token',
       'rate_plan_id','allocation_rule_id','selected_room_type_id','check_in','check_out',
       'adults','child_ages'])
     or p_request->>'contract_version'<>c_contract
     or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(p_request)
     or jsonb_typeof(p_request->'hotel_id')<>'string'
     or jsonb_typeof(p_request->'snapshot_token')<>'string'
     or p_request->>'snapshot_token'!~'^[0-9a-f]{64}$'
     or jsonb_typeof(p_request->'check_in')<>'string'
     or jsonb_typeof(p_request->'check_out')<>'string'
     or not public.hotel_v2_admin_c_date_is_canonical(p_request->>'check_in')
     or not public.hotel_v2_admin_c_date_is_canonical(p_request->>'check_out')
     or jsonb_typeof(p_request->'rate_plan_id') not in('string','null')
     or jsonb_typeof(p_request->'allocation_rule_id') not in('string','null')
     or jsonb_typeof(p_request->'selected_room_type_id') not in('string','null')
     or jsonb_typeof(p_request->'adults')<>'number'
     or p_request->>'adults'!~'^[0-9]+$'
     or jsonb_typeof(p_request->'child_ages')<>'array'
     or jsonb_array_length(p_request->'child_ages')>50
     or exists(select 1 from jsonb_array_elements(p_request->'child_ages') age
       where jsonb_typeof(age)<>'number' or age#>>'{}'!~'^[0-9]+$'
         or (age#>>'{}')::integer not between 0 and 17) then
    raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_preview_request';
  end if;
  begin
    v_hotel_id:=(p_request->>'hotel_id')::uuid;
    v_plan_id:=case when p_request->>'rate_plan_id' is null then null
      else (p_request->>'rate_plan_id')::uuid end;
    v_rule_id:=case when p_request->>'allocation_rule_id' is null then null
      else (p_request->>'allocation_rule_id')::uuid end;
    v_selected_room_id:=case when p_request->>'selected_room_type_id' is null then null
      else (p_request->>'selected_room_type_id')::uuid end;
    v_check_in:=(p_request->>'check_in')::date;
    v_check_out:=(p_request->>'check_out')::date;
    v_adults:=(p_request->>'adults')::integer;
    select coalesce(array_agg((age#>>'{}')::smallint order by ord),'{}'::smallint[])
      into v_child_ages from jsonb_array_elements(p_request->'child_ages')
      with ordinality child(age,ord);
  exception when others then
    raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_preview_identifiers';
  end;
  if to_char(v_check_in,'YYYY-MM-DD')<>p_request->>'check_in'
     or to_char(v_check_out,'YYYY-MM-DD')<>p_request->>'check_out' then
    raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_preview_dates';
  end if;
  v_nights:=v_check_out-v_check_in; v_guest_count:=v_adults+cardinality(v_child_ages);
  if v_adults not between 1 and 50 or v_guest_count>50 or v_nights<1 then
    raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_preview_range';
  end if;
  if v_nights>365 then
    raise exception using errcode='22023',
      message='hotels_v2_admin_c_preview_query_limit_exceeded',
      detail=jsonb_build_object('technical_maximum_nights',365,'requested_nights',v_nights)::text;
  end if;
  v_control:=public.hotel_v2_admin_c_pricing_control_snapshot(v_hotel_id);
  if v_control->>'snapshot_token' is distinct from p_request->>'snapshot_token' then
    raise exception using errcode='PT409',message='hotels_v2_admin_c_stale_pricing_snapshot',
      detail=jsonb_build_object('current_snapshot_token',v_control->>'snapshot_token',
        'changed_entities',jsonb_build_array('pricing_graph'))::text;
  end if;
  select * into v_hotel from public.hotels where id=v_hotel_id;
  if v_plan_id is null then
    select count(*)::integer,(array_agg(plan.id order by plan.id))[1]
      into v_candidate_count,v_plan_id
    from public.hotel_rate_plans plan where plan.hotel_id=v_hotel_id
      and plan.is_active and plan.review_status='reviewed';
    if v_candidate_count<>1 then
      v_plan_id:=null; v_ok:=false;
      v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
        'rate_plan_required','rate_plan'));
    end if;
  end if;
  if v_plan_id is not null and not exists(select 1 from public.hotel_rate_plans plan
      where plan.id=v_plan_id and plan.hotel_id=v_hotel_id) then
    v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
      'rate_plan_not_found','rate_plan',v_plan_id));
    v_ok:=false;
  end if;
  if v_rule_id is null then
    select count(*)::integer,(array_agg(rule.id order by rule.id))[1]
      into v_candidate_count,v_rule_id
    from public.hotel_room_allocation_rules rule where rule.hotel_id=v_hotel_id
      and rule.is_active and rule.review_status='reviewed'
      and v_guest_count between rule.min_guest_count and rule.max_guest_count;
    if v_candidate_count<>1 then
      v_rule_id:=null; v_ok:=false;
      v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
        'allocation_rule_required','allocation_rule'));
    end if;
  end if;
  if not v_ok then
    return jsonb_build_object('contract_version',c_contract,'hotel_id',v_hotel_id,
      'snapshot_token',v_control->>'snapshot_token','ok',false,'requestable',false,
      'blocking_reasons',v_blockers,'currency',v_hotel.currency,
      'check_in',v_check_in,'check_out',v_check_out,'nights',v_nights,
      'adults',v_adults,'child_ages',to_jsonb(v_child_ages),'guest_count',v_guest_count,
      'allocation','[]'::jsonb,'products','[]'::jsonb,
      'nightly_breakdown','[]'::jsonb,'customer_total',null,
      'pricing_precedence',jsonb_build_array('exact_date_price','seasonal_range_rule',
        'weekday_rule','pricing_schedule_tier','independent_occupancy_tier',
        'room_rate_base_nightly_rate','property_default'),
      'legacy_authoritative',v_hotel.architecture_version='legacy','public_change',false);
  end if;
  select * into v_rule from public.hotel_room_allocation_rules
    where id=v_rule_id and hotel_id=v_hotel_id;
  if not found or v_guest_count not between v_rule.min_guest_count and v_rule.max_guest_count then
    v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
      'allocation_rule_mismatch','allocation_rule',v_rule_id));
    v_ok:=false;
  elsif v_rule.allocation_mode='customer_choice' and v_selected_room_id is null then
    select count(*)::integer,(array_agg(item.room_type_id order by item.room_type_id))[1]
      into v_candidate_count,v_selected_room_id
      from public.hotel_room_allocation_rule_items item
      where item.allocation_rule_id=v_rule.id;
    if v_candidate_count<>1 then
      v_selected_room_id:=null; v_ok:=false;
      v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
        'room_choice_required','allocation_rule',v_rule.id));
    end if;
  elsif v_rule.allocation_mode='required_bundle' and v_selected_room_id is not null then
    v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
      'room_choice_not_allowed','allocation_rule',v_rule.id));
    v_ok:=false;
  end if;
  if v_rule.id is not null and (not v_rule.is_active or v_rule.review_status<>'reviewed') then
    v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
      'allocation_rule_inactive_or_unreviewed','allocation_rule',v_rule.id));
  end if;

  if v_ok then
    for v_item in select item.*,room_type.children_policy_override,
        room_type.minimum_child_age_override,room_type.status room_status,
        room_type.capacity_adults,room_type.capacity_children,
        coalesce(room_type.max_occupancy,
          room_type.capacity_adults+room_type.capacity_children) room_capacity
      from public.hotel_room_allocation_rule_items item
      join public.hotel_room_types room_type on room_type.id=item.room_type_id
      where item.allocation_rule_id=v_rule.id
        and (v_rule.allocation_mode='required_bundle' or item.room_type_id=v_selected_room_id)
      order by item.sort_order,item.id
    loop
      v_item_count:=v_item_count+1;
      v_policy:=coalesce(v_item.children_policy_override,v_hotel.children_policy);
      v_min_age:=case when v_item.children_policy_override is not null
        then v_item.minimum_child_age_override else v_hotel.minimum_child_age end;
      if v_rule.allocation_mode='customer_choice' and cardinality(v_child_ages)>0
          and (v_policy is null or v_policy='not_allowed'
          or (v_policy='minimum_age' and (v_min_age is null or exists(
            select 1 from unnest(v_child_ages) age where age<v_min_age)))) then
        v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
          'child_policy_not_satisfied','room_type',v_item.room_type_id));
        v_ok:=false;
      end if;
      if v_item.room_status<>'active' then
        v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
          'allocated_room_type_inactive','room_type',v_item.room_type_id));
        v_ok:=false;
      end if;
      if v_item.room_capacity is null or v_item.room_capacity<=0 then
        v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
          'room_capacity_missing','room_type',v_item.room_type_id));
        v_ok:=false;
      elsif coalesce(v_item.allocated_guest_count,v_guest_count)>
          v_item.room_capacity*v_item.units_required then
        v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
          'physical_occupancy_exceeds_room','room_type',v_item.room_type_id));
        v_ok:=false;
      end if;
      if v_rule.allocation_mode='customer_choice' and (
          (v_item.capacity_adults is not null and v_adults>v_item.capacity_adults)
          or (v_item.capacity_children is not null
            and cardinality(v_child_ages)>v_item.capacity_children)) then
        v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
          'room_demographic_capacity_exceeded','room_type',v_item.room_type_id,
          null,jsonb_build_object('adults',v_adults,'children',cardinality(v_child_ages),
            'capacity_adults',v_item.capacity_adults,
            'capacity_children',v_item.capacity_children)));
        v_ok:=false;
      end if;
      v_allocation:=v_allocation||jsonb_build_array(jsonb_build_object(
        'allocation_rule_id',v_rule.id,'allocation_mode',v_rule.allocation_mode,
        'room_type_id',v_item.room_type_id,
        'units_required',v_item.units_required,
        'allocated_guest_count',case when v_rule.allocation_mode='customer_choice'
          then v_guest_count else v_item.allocated_guest_count end,
        'pricing_guest_count',case when v_rule.allocation_mode='customer_choice'
          then v_guest_count else v_item.pricing_guest_count end,
        'allocated_guest_counts',case when v_rule.allocation_mode='customer_choice'
          then to_jsonb(array[v_guest_count]) else to_jsonb(coalesce(
            v_item.allocated_guest_counts,array[v_item.allocated_guest_count])) end,
        'pricing_guest_counts',case when v_rule.allocation_mode='customer_choice'
          then to_jsonb(array[v_guest_count]) else to_jsonb(coalesce(
            v_item.pricing_guest_counts,array[v_item.pricing_guest_count])) end
      ));
      for v_unit in 1..v_item.units_required loop
        v_physical:=case when v_rule.allocation_mode='customer_choice' then v_guest_count
          when v_item.allocated_guest_counts is null then v_item.allocated_guest_count
          else v_item.allocated_guest_counts[v_unit] end;
        v_pricing:=case when v_rule.allocation_mode='customer_choice' then v_guest_count
          when v_item.pricing_guest_counts is null then v_item.pricing_guest_count
          else v_item.pricing_guest_counts[v_unit] end;
        if v_physical is null or v_pricing is null then
          v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
            'allocation_unit_occupancy_missing','allocation_rule',v_rule.id));
          v_ok:=false; continue;
        end if;
        if v_rule.allocation_mode='required_bundle' then
          v_bundle_physical_total:=v_bundle_physical_total+v_physical;
          if v_policy is null or (v_policy='minimum_age' and v_min_age is null) then
            v_bundle_demographic_ambiguous:=true;
          else
            if v_item.capacity_adults is null and v_item.capacity_children is null then
              v_unit_child_lower:=0; v_unit_child_upper:=v_physical;
            elsif v_item.capacity_adults is null or v_item.capacity_children is null then
              v_bundle_demographic_ambiguous:=true;
              v_unit_child_lower:=0; v_unit_child_upper:=0;
            else
              v_unit_child_lower:=greatest(0,v_physical-v_item.capacity_adults);
              v_unit_child_upper:=least(v_physical,v_item.capacity_children);
            end if;
            if v_policy='not_allowed' then v_unit_child_upper:=0; end if;
            if v_unit_child_lower>v_unit_child_upper then
              v_bundle_demographic_impossible:=true;
            else
              v_unit_child_threshold:=case when v_policy='minimum_age'
                then v_min_age else 0 end;
              v_bundle_child_lower:=v_bundle_child_lower+v_unit_child_lower;
              v_bundle_child_upper:=v_bundle_child_upper+v_unit_child_upper;
              if v_unit_child_lower>0 then
                for v_slot in 1..v_unit_child_lower loop
                  v_required_child_thresholds:=array_append(
                    v_required_child_thresholds,v_unit_child_threshold);
                end loop;
              end if;
              if v_unit_child_upper>v_unit_child_lower then
                for v_slot in 1..(v_unit_child_upper-v_unit_child_lower) loop
                  v_optional_child_thresholds:=array_append(
                    v_optional_child_thresholds,v_unit_child_threshold);
                end loop;
              end if;
            end if;
          end if;
        end if;
        select count(*)::integer,(array_agg(rate.id order by rate.id))[1]
          into v_candidate_count,v_rate_id
          from public.hotel_room_rates rate
          where rate.hotel_id=v_hotel_id and rate.rate_plan_id=v_plan_id
            and rate.room_type_id=v_item.room_type_id;
        if v_candidate_count=0 then
          v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
            'room_rate_missing','room_type',v_item.room_type_id));
          v_ok:=false; continue;
        elsif v_candidate_count<>1 then
          v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
            'room_rate_ambiguous','room_type',v_item.room_type_id,null,
            jsonb_build_object('candidate_count',v_candidate_count)));
          v_ok:=false; continue;
        end if;
        v_resolved:=public.hotel_v2_admin_c_resolve_price_product(
          v_rate_id,v_check_in,v_check_out,v_pricing);
        if not coalesce((v_resolved->>'ok')::boolean,false) then v_ok:=false; end if;
        v_blockers:=v_blockers||coalesce(v_resolved->'blocking_reasons','[]'::jsonb);
        if v_resolved->'total' is not null then v_total:=v_total+(v_resolved->>'total')::numeric; end if;
        v_product:=jsonb_build_object('room_type_id',v_item.room_type_id,
          'room_rate_id',v_rate_id,'rate_plan_id',v_plan_id,'unit_sequence',v_unit,
          'allocated_guest_count',v_physical,
          'requested_pricing_guest_count',v_pricing,
          'resolved_pricing_guest_count',v_resolved->'resolved_pricing_guest_count',
          'minimum_billable_occupancy',v_resolved->'minimum_billable_occupancy',
          'base_pricing_source',v_resolved->>'base_pricing_source',
          'base_pricing_source_id',v_resolved->'base_pricing_source_id',
          'los_threshold_nights',v_resolved->'los_threshold_nights',
          'subtotal',v_resolved->'total','currency',v_resolved->>'currency',
          'booking_mode',v_resolved->>'booking_mode',
          'cancellation_policy',v_resolved->'cancellation_policy',
          'price_inclusions',v_resolved->'price_inclusions',
          'effective_minimum_stay',v_resolved->'effective_minimum_stay',
          'effective_maximum_stay',v_resolved->'effective_maximum_stay',
          'stay_allowed',v_resolved->'stay_allowed');
        v_products:=v_products||jsonb_build_array(v_product);
        select coalesce(jsonb_agg(day.value||jsonb_build_object(
          'room_type_id',v_item.room_type_id,'rate_plan_id',v_plan_id,
          'unit_sequence',v_unit,'allocated_guest_count',v_physical)
          order by day.value->>'stay_date'),'[]'::jsonb)
        into v_resolved from jsonb_array_elements(
          coalesce(v_resolved->'nightly_breakdown','[]'::jsonb)) day(value);
        v_breakdown:=v_breakdown||v_resolved;
      end loop;
    end loop;
  end if;
  if v_rule.id is not null and v_rule.allocation_mode='required_bundle' then
    if v_bundle_physical_total<>v_guest_count then
      v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
        'bundle_physical_guest_total_mismatch','allocation_rule',v_rule.id,null,
        jsonb_build_object('allocated_guests',v_bundle_physical_total,
          'requested_guests',v_guest_count)));
      v_ok:=false;
    elsif v_bundle_demographic_ambiguous then
      v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
        'bundle_demographic_capacity_incomplete','allocation_rule',v_rule.id));
      v_ok:=false;
    elsif v_bundle_demographic_impossible or not
        public.hotel_v2_admin_c_child_slots_are_feasible(v_child_ages,
        v_required_child_thresholds,v_optional_child_thresholds) then
      v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
        'bundle_demographic_capacity_exceeded','allocation_rule',v_rule.id,null,
        jsonb_build_object('children',cardinality(v_child_ages),
          'minimum_children',v_bundle_child_lower,
          'maximum_children',v_bundle_child_upper)));
      v_ok:=false;
    end if;
  end if;
  if v_ok and v_item_count=0 then
    v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
      'allocation_items_missing','allocation_rule',v_rule.id));
    v_ok:=false;
  end if;
  if not exists(select 1 from public.hotel_rate_plans
      where id=v_plan_id and hotel_id=v_hotel_id) then
    v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
      'rate_plan_not_found','rate_plan',v_plan_id));
    v_ok:=false;
  end if;
  -- This is a shadow calculator. Inactive normalized state is calculated for
  -- Review, but is never requestable and never changes the legacy public path.
  return jsonb_build_object('contract_version',c_contract,'hotel_id',v_hotel_id,
    'snapshot_token',v_control->>'snapshot_token','ok',v_ok,'requestable',v_requestable,
    'blocking_reasons',v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
      case when v_hotel.architecture_version='legacy' then 'legacy_architecture_authoritative'
        else 'public_hotels_v2_off' end,'property',v_hotel.id)),
    'currency',v_hotel.currency,'check_in',v_check_in,'check_out',v_check_out,
    'nights',v_nights,'adults',v_adults,'child_ages',to_jsonb(v_child_ages),
    'guest_count',v_guest_count,'allocation',v_allocation,'products',v_products,
    'nightly_breakdown',v_breakdown,
    'customer_total',case when v_ok then round(v_total,2) else null end,
    'pricing_precedence',jsonb_build_array('exact_date_price','seasonal_range_rule',
      'weekday_rule','pricing_schedule_tier','independent_occupancy_tier',
      'room_rate_base_nightly_rate','property_default'),
    'legacy_authoritative',v_hotel.architecture_version='legacy','public_change',false);
exception when invalid_text_representation or numeric_value_out_of_range
  or datetime_field_overflow then
  raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_preview_value';
end
$function$;

-- Retire every older browser mutation seam that owns ADMIN-C pricing fields.
-- The retained wrappers keep operational units, inventory/closures, payment,
-- commission, and source configuration available for their later phases.
alter function public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid)
  rename to hotel_v2_admin_apply_workspace_plan_admin_c_core;
alter function public.hotel_v2_admin_apply_workspace_plan_admin_c_core(jsonb,uuid)
  set search_path=pg_catalog,public;
revoke all on function public.hotel_v2_admin_apply_workspace_plan_admin_c_core(jsonb,uuid)
  from public,anon,authenticated,service_role;

create function public.hotel_v2_admin_apply_workspace_plan(
  p_plan jsonb,p_correlation_id uuid default gen_random_uuid()
)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_plan is null or jsonb_typeof(p_plan)<>'object'
     or p_correlation_id is null
     or not public.hotel_v2_admin_c_uuid_is_canonical(p_correlation_id::text)
     or auth.uid() is null
     or not public.hotel_v2_admin_c_uuid_is_canonical(auth.uid()::text)
     or jsonb_typeof(p_plan->'operations')<>'array'
     or exists(select 1 from jsonb_array_elements(p_plan->'operations') operation(value)
       where jsonb_typeof(operation.value)<>'object'
          or operation.value->>'entity' is distinct from 'unit') then
    raise exception using errcode='42501',
      message='hotels_v2_admin_c_use_pricing_control_rpc';
  end if;
  return public.hotel_v2_admin_apply_workspace_plan_admin_c_core(p_plan,p_correlation_id);
end
$function$;

alter function public.hotel_v2_admin_apply_calendar_plan(jsonb,uuid)
  rename to hotel_v2_admin_apply_calendar_plan_admin_c_core;
alter function public.hotel_v2_admin_apply_calendar_plan_admin_c_core(jsonb,uuid)
  set search_path=pg_catalog,public;
revoke all on function public.hotel_v2_admin_apply_calendar_plan_admin_c_core(jsonb,uuid)
  from public,anon,authenticated,service_role;

create function public.hotel_v2_admin_apply_calendar_plan(
  p_plan jsonb,p_correlation_id uuid default gen_random_uuid()
)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
declare
  v_hotel_id uuid;
  v_operation jsonb;
  v_payload jsonb;
  v_entity text;
  v_action text;
  v_id uuid;
  v_room_rate_id uuid;
  v_stay_date date;
  v_existing public.hotel_calendar_overrides%rowtype;
  v_sanitized jsonb;
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_plan is null or jsonb_typeof(p_plan)<>'object'
     or p_correlation_id is null
     or not public.hotel_v2_admin_c_uuid_is_canonical(p_correlation_id::text)
     or auth.uid() is null
     or not public.hotel_v2_admin_c_uuid_is_canonical(auth.uid()::text)
     or jsonb_typeof(p_plan->'hotel_id')<>'string'
     or jsonb_typeof(p_plan->'from')<>'string'
     or jsonb_typeof(p_plan->'to')<>'string'
     or not public.hotel_v2_admin_c_date_is_canonical(p_plan->>'from')
     or not public.hotel_v2_admin_c_date_is_canonical(p_plan->>'to')
     or jsonb_typeof(p_plan->'reviewed_at')<>'string'
     or not public.hotel_v2_admin_c_timestamptz_is_canonical(
       p_plan->>'reviewed_at')
     or jsonb_typeof(p_plan->'operations')<>'array' then
    raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_calendar_compat_plan';
  end if;

  -- Calendar/provider provenance is an opaque, server-owned compatibility
  -- field. Strip it only from the two known transport paths before recursive
  -- UUID/timestamp validation; never create a global JSON-key exemption that
  -- could hide smuggled ADMIN-C identifiers elsewhere in a request.
  select jsonb_set(p_plan,'{operations}',coalesce(jsonb_agg(
      jsonb_set(operation.value,'{payload}',
        (((operation.value->'payload')-'source')-'source_timestamp')-'provenance',true)
      order by operation.ordinal),'[]'::jsonb),true)
    into v_sanitized
  from jsonb_array_elements(p_plan->'operations') with ordinality operation(value,ordinal);
  if not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(v_sanitized)
     or not public.hotel_v2_admin_c_json_timestamp_fields_are_canonical(v_sanitized) then
    raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_calendar_compat_plan';
  end if;
  begin
    v_hotel_id:=(p_plan->>'hotel_id')::uuid;
  exception when invalid_text_representation then
    raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_calendar_compat_plan';
  end;
  perform 1 from public.hotels where id=v_hotel_id for update;
  if not found then raise exception using errcode='PT404',message='hotels_v2_admin_c_property_not_found'; end if;

  for v_operation in select value from jsonb_array_elements(p_plan->'operations') loop
    if jsonb_typeof(v_operation)<>'object' or jsonb_typeof(v_operation->'payload')<>'object' then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_calendar_compat_operation';
    end if;
    v_entity:=v_operation->>'entity'; v_action:=v_operation->>'type';
    v_payload:=v_operation->'payload';
    if v_entity not in('daily_inventory','calendar_override') then
      raise exception using errcode='42501',message='hotels_v2_admin_c_pricing_owned_by_pricing_control';
    end if;
    if v_payload ?| array['nightly_rate','nightly_rate_mode','minimum_stay',
        'minimum_stay_mode','maximum_stay','maximum_stay_mode'] then
      raise exception using errcode='42501',message='hotels_v2_admin_c_calendar_pricing_smuggling_denied';
    end if;
    if v_entity='calendar_override' then
      if v_action='create' then
        if not public.hotel_v2_h2a_keys_allowed(v_payload,array[
          'room_rate_id','stay_date','closed','closed_mode','closed_to_arrival',
          'closed_to_arrival_mode','closed_to_departure','closed_to_departure_mode',
          'reason','expires_at','is_active','source','source_timestamp','provenance']) then
          raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_operational_override';
        end if;
        begin
          if not (v_payload ?& array['room_rate_id','stay_date'])
             or jsonb_typeof(v_payload->'room_rate_id')<>'string'
             or jsonb_typeof(v_payload->'stay_date')<>'string'
             or not public.hotel_v2_admin_c_date_is_canonical(
               v_payload->>'stay_date') then
            raise exception using errcode='22023',
              message='hotels_v2_admin_c_invalid_operational_override_identity';
          end if;
          v_room_rate_id:=(v_payload->>'room_rate_id')::uuid;
          v_stay_date:=(v_payload->>'stay_date')::date;
        exception when invalid_text_representation or datetime_field_overflow then
          raise exception using errcode='22023',
            message='hotels_v2_admin_c_invalid_operational_override_identity';
        end;
        if not exists(select 1 from public.hotel_room_rates rate
            where rate.id=v_room_rate_id and rate.hotel_id=v_hotel_id) then
          raise exception using errcode='22023',
            message='hotels_v2_admin_c_foreign_operational_override';
        end if;
        select * into v_existing from public.hotel_calendar_overrides
          where room_rate_id=v_room_rate_id and stay_date=v_stay_date for update;
        if found then
          raise exception using errcode='PT409',
            message='hotels_v2_admin_c_calendar_override_key_exists_use_existing_id',
            detail=jsonb_build_object('existing_id',v_existing.id,
              'current_version',v_existing.version)::text;
        end if;
      else
        begin v_id:=(v_operation->>'id')::uuid;
        exception when invalid_text_representation then
          raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_operational_override'; end;
        select * into v_existing from public.hotel_calendar_overrides
          where id=v_id and hotel_id=v_hotel_id for update;
        if not found then raise exception using errcode='PT404',message='hotels_v2_admin_c_calendar_override_not_found'; end if;
        if v_existing.source<>'manual' then
          raise exception using errcode='42501',message='hotels_v2_admin_c_external_override_read_only';
        end if;
        if v_action in('disable','delete') and (
          v_existing.nightly_rate_mode is not null
          or v_existing.minimum_stay_mode is not null
          or v_existing.maximum_stay_mode is not null) then
          raise exception using errcode='42501',message='hotels_v2_admin_c_shared_pricing_row_preserved';
        end if;
        if v_action='update' and not public.hotel_v2_h2a_keys_allowed(v_payload,array[
          'closed','closed_mode','closed_to_arrival','closed_to_arrival_mode',
          'closed_to_departure','closed_to_departure_mode','reason','expires_at',
          'is_active','source','source_timestamp','provenance']) then
          raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_operational_override';
        end if;
        if v_action='update' and v_existing.pricing_source is null and (
          v_existing.nightly_rate_mode is not null
          or v_existing.minimum_stay_mode is not null
          or v_existing.maximum_stay_mode is not null) and (
          v_payload ? 'is_active' or v_payload ? 'expires_at') then
          raise exception using errcode='42501',
            message='hotels_v2_admin_c_shared_pricing_effect_preserved';
        end if;
      end if;
    elsif not public.hotel_v2_h2a_keys_allowed(v_payload,array[
      'room_type_id','stay_date','sellable_units','closed','sellable_units_mode',
      'closed_mode','reason','expires_at','source','source_timestamp','provenance']) then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_operational_inventory';
    end if;
  end loop;

  -- v_sanitized is the already-validated server-owned-field-free transport.
  return public.hotel_v2_admin_apply_calendar_plan_admin_c_core(v_sanitized,p_correlation_id);
end
$function$;

alter function public.hotel_v2_admin_apply_h3_1_configuration(jsonb,uuid)
  rename to hotel_v2_admin_apply_h3_1_configuration_admin_c_core;
alter function public.hotel_v2_admin_apply_h3_1_configuration_admin_c_core(jsonb,uuid)
  set search_path=pg_catalog,public;
revoke all on function public.hotel_v2_admin_apply_h3_1_configuration_admin_c_core(jsonb,uuid)
  from public,anon,authenticated,service_role;

create function public.hotel_v2_admin_apply_h3_1_configuration(
  p_plan jsonb,p_correlation_id uuid default gen_random_uuid()
)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_plan is null or jsonb_typeof(p_plan)<>'object'
     or p_correlation_id is null
     or not public.hotel_v2_admin_c_uuid_is_canonical(p_correlation_id::text)
     or auth.uid() is null
     or not public.hotel_v2_admin_c_uuid_is_canonical(auth.uid()::text)
     or jsonb_typeof(p_plan->'operations')<>'array'
     or exists(select 1 from jsonb_array_elements(p_plan->'operations') operation(value)
       where jsonb_typeof(operation.value)<>'object'
          or operation.value->>'entity' not in('payment_policy','commission_policy','calendar_source')) then
    raise exception using errcode='42501',message='hotels_v2_admin_c_use_pricing_control_rpc';
  end if;
  return public.hotel_v2_admin_apply_h3_1_configuration_admin_c_core(p_plan,p_correlation_id);
end
$function$;

alter function public.hotel_v2_admin_apply_legacy_pricing_promotion(jsonb,uuid)
  rename to hotel_v2_admin_apply_legacy_pricing_promotion_admin_c_core;
alter function public.hotel_v2_admin_apply_legacy_pricing_promotion_admin_c_core(jsonb,uuid)
  set search_path=pg_catalog,public;
revoke all on function public.hotel_v2_admin_apply_legacy_pricing_promotion_admin_c_core(jsonb,uuid)
  from public,anon,authenticated,service_role;

create function public.hotel_v2_admin_apply_legacy_pricing_promotion(
  p_plan jsonb,p_correlation_id uuid default gen_random_uuid()
)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
declare v_hotel_id uuid;
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_plan is null or jsonb_typeof(p_plan)<>'object'
     or p_correlation_id is null
     or not public.hotel_v2_admin_c_uuid_is_canonical(p_correlation_id::text)
     or auth.uid() is null
     or not public.hotel_v2_admin_c_uuid_is_canonical(auth.uid()::text)
     or jsonb_typeof(p_plan->'hotel_id')<>'string'
     or not public.hotel_v2_admin_c_uuid_is_canonical(p_plan->>'hotel_id') then
    raise exception using errcode='22023',
      message='hotels_v2_admin_c_invalid_legacy_promotion_plan';
  end if;
  begin v_hotel_id:=(p_plan->>'hotel_id')::uuid;
  exception when others then
    raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_legacy_promotion_plan'; end;
  if v_hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
     and exists(select 1 from public.hotel_pricing_promotion_reviews review
       where review.hotel_id=v_hotel_id
         and review.contract_version='seven_kamares_legacy_to_h3_pricing_v1'
         and review.review_status='reviewed') then
    raise exception using errcode='55000',message='hotels_v2_admin_c_h3_1p_graph_immutable';
  end if;
  return public.hotel_v2_admin_apply_legacy_pricing_promotion_admin_c_core(
    p_plan,p_correlation_id);
end
$function$;

-- Final ownership and ACL boundary. Internal helpers, dispatchers, trigger
-- functions, and compatibility cores are never callable through PostgREST.
do $admin_c_raw_table_acl$
declare v_relation text;
begin
  foreach v_relation in array array[
    'hotel_property_pricing_defaults','hotel_admin_pricing_action_receipts',
    'hotel_rate_plans','hotel_room_rates','hotel_pricing_schedules',
    'hotel_pricing_schedule_occupancy_tiers','hotel_room_rate_occupancy_tiers',
    'hotel_rate_rules','hotel_calendar_overrides','hotel_room_allocation_rules',
    'hotel_room_allocation_rule_items','hotel_daily_rates','hotel_activity_log',
    'hotel_pricing_promotion_reviews'
  ] loop
    execute format('revoke select,insert,update,delete,truncate,references,trigger '
      ||'on table public.%I from public,anon,authenticated',v_relation);
  end loop;
end
$admin_c_raw_table_acl$;

do $admin_c_function_acl$
declare v_signature regprocedure;
begin
  for v_signature in
    select procedure_row.oid::regprocedure
    from pg_proc procedure_row
    join pg_namespace namespace_row on namespace_row.oid=procedure_row.pronamespace
    where namespace_row.nspname='public' and (
      left(procedure_row.proname,length('hotel_v2_admin_c_'))=
        'hotel_v2_admin_c_'
      or procedure_row.proname in(
        'hotel_v2_admin_get_pricing_control',
        'hotel_v2_admin_apply_pricing_control_plan',
        'hotel_v2_admin_preview_pricing_quote',
        'hotel_v2_admin_apply_workspace_plan',
        'hotel_v2_admin_apply_calendar_plan',
        'hotel_v2_admin_apply_h3_1_configuration',
        'hotel_v2_admin_apply_legacy_pricing_promotion',
        'hotel_v2_admin_apply_workspace_plan_admin_c_core',
        'hotel_v2_admin_apply_calendar_plan_admin_c_core',
        'hotel_v2_admin_apply_h3_1_configuration_admin_c_core',
        'hotel_v2_admin_apply_legacy_pricing_promotion_admin_c_core'
      )
    )
  loop
    execute format('alter function %s owner to postgres',v_signature);
    execute format('revoke all on function %s from public,anon,authenticated,service_role',
      v_signature);
  end loop;
end
$admin_c_function_acl$;

alter table public.hotel_admin_pricing_action_receipts owner to postgres;
alter table public.hotel_property_pricing_defaults owner to postgres;

grant execute on function public.hotel_v2_admin_get_pricing_control(uuid)
  to authenticated;
grant execute on function public.hotel_v2_admin_apply_pricing_control_plan(jsonb,uuid,text)
  to authenticated;
grant execute on function public.hotel_v2_admin_preview_pricing_quote(jsonb)
  to authenticated;
grant execute on function public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid)
  to authenticated;
grant execute on function public.hotel_v2_admin_apply_calendar_plan(jsonb,uuid)
  to authenticated;
grant execute on function public.hotel_v2_admin_apply_h3_1_configuration(jsonb,uuid)
  to authenticated;
grant execute on function public.hotel_v2_admin_apply_legacy_pricing_promotion(jsonb,uuid)
  to authenticated;

-- This pure immutable predicate is the sole helper exposed to trusted backend
-- DML because PostgreSQL evaluates it inside allocation CHECK constraints.
grant execute on function public.hotel_v2_admin_c_guest_array_matches_total(
  smallint[],integer,smallint) to service_role;

comment on function public.hotel_v2_admin_get_pricing_control(uuid) is
  'ADMIN-C Admin-only normalized pricing graph snapshot. Shadow-only while Hotels V2 flags remain OFF.';
comment on function public.hotel_v2_admin_apply_pricing_control_plan(jsonb,uuid,text) is
  'ADMIN-C Admin-only reviewed, idempotent, optimistic pricing control mutation. No automatic retry.';
comment on function public.hotel_v2_admin_preview_pricing_quote(jsonb) is
  'ADMIN-C Admin-only price/stay preview. Does not establish availability or mutate state.';

-- Evaluate every existing graph after installing all cross-domain guards.
do $admin_c_existing_graph_validation$
declare v_hotel_id uuid; v_rule_id uuid;
begin
  for v_hotel_id in select hotel.id from public.hotels hotel order by hotel.id loop
    perform public.hotel_v2_admin_c_validate_pricing_graph(v_hotel_id);
  end loop;
  for v_rule_id in select rule.id from public.hotel_room_allocation_rules rule
      order by rule.id loop
    perform public.hotel_v2_h3_1_validate_allocation_rule(v_rule_id);
    perform public.hotel_v2_admin_c_validate_allocation_extensions(v_rule_id);
  end loop;
end
$admin_c_existing_graph_validation$;

do $admin_c_postconditions$
declare
  v_before record;
  v_after_count bigint;
  v_after_fingerprint text;
  v_excluded text[];
  v_signature text;
  v_internal_offenders text;
begin
  if (select count(*) from public.site_settings)<>1
     or not exists(select 1 from public.site_settings where id=1
       and not hotel_rooms_v2_enabled and not hotel_external_sync_enabled
       and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled) then
    raise exception using errcode='55000',message='hotels_v2_admin_c_flags_changed';
  end if;

  for v_before in select * from hotels_v2_admin_c_protected_before order by relation_name loop
    v_excluded:=case v_before.relation_name
      when 'hotel_rate_plans' then array['review_status']::text[]
      when 'hotel_room_rates' then array['review_status']::text[]
      when 'hotel_pricing_schedules' then array['sharing_mode']::text[]
      when 'hotel_room_allocation_rule_items' then
        array['allocated_guest_counts','pricing_guest_counts']::text[]
      when 'hotel_calendar_overrides' then array[
        'pricing_source','pricing_reason','pricing_expires_at','pricing_actor_type',
        'pricing_actor_id','pricing_updated_at','pricing_correlation_id']::text[]
      else '{}'::text[] end;
    execute format(
      'select count(*),md5(coalesce(string_agg((to_jsonb(row_value)-%L::text[])::text,''|'' '
      ||'order by (to_jsonb(row_value)-%L::text[])::text),'''')) from public.%I row_value',
      v_excluded,v_excluded,v_before.relation_name)
      into v_after_count,v_after_fingerprint;
    if v_after_count<>v_before.row_count
       or v_after_fingerprint<>v_before.fingerprint then
      raise exception using errcode='55000',
        message='hotels_v2_admin_c_protected_relation_changed',
        detail=jsonb_build_object('relation',v_before.relation_name,
          'before_count',v_before.row_count,'after_count',v_after_count,
          'before_fingerprint',v_before.fingerprint,
          'after_fingerprint',v_after_fingerprint)::text;
    end if;
  end loop;

  if (select count(*) from public.hotel_rate_plans where review_status='reviewed')<>1
     or (select count(*) from public.hotel_room_rates where review_status='reviewed')<>2
     or exists(select 1 from public.hotel_rate_plans where review_status<>'reviewed')
     or exists(select 1 from public.hotel_room_rates where review_status<>'reviewed')
     or exists(select 1 from public.hotel_pricing_schedules where sharing_mode<>'shared')
     or exists(select 1 from public.hotel_room_allocation_rule_items
       where allocated_guest_counts is not null or pricing_guest_counts is not null)
     or exists(select 1 from public.hotel_calendar_overrides override_row where
       override_row.pricing_source is not null or override_row.pricing_reason is not null
       or override_row.pricing_expires_at is not null
       or override_row.pricing_actor_type is not null
       or override_row.pricing_actor_id is not null
       or override_row.pricing_updated_at is not null
       or override_row.pricing_correlation_id is not null)
     or exists(select 1 from public.hotel_property_pricing_defaults)
     or exists(select 1 from public.hotel_admin_pricing_action_receipts) then
    raise exception using errcode='55000',message='hotels_v2_admin_c_additive_default_drift';
  end if;

  if not coalesce((public.hotel_v2_h3_1p_pricing_promotion_snapshot(
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)#>>'{supported}')::boolean,false)
     or not public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()
     or public.hotel_v2_h3_1p_pricing_promotion_snapshot(
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)#>>'{promotion,status}'<>'reviewed'
     or (public.hotel_v2_h3_1p_pricing_promotion_snapshot(
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)#>>'{parity,total_case_count}')::integer<>70
     or (public.hotel_v2_h3_1p_pricing_promotion_snapshot(
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)#>>'{parity,total_mismatch_count}')::integer<>0
     or exists(select 1 from public.hotel_rate_plans where hotel_id=
       '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid and is_active)
     or exists(select 1 from public.hotel_room_rates where hotel_id=
       '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid and is_active)
     or exists(select 1 from public.hotel_pricing_schedules where hotel_id=
       '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid and is_active)
     or exists(select 1 from public.hotel_property_pricing_defaults where hotel_id=
       '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid) then
    raise exception using errcode='55000',message='hotels_v2_admin_c_h3_1p_contract_changed';
  end if;

  if not (select relrowsecurity from pg_class where oid=
       'public.hotel_admin_pricing_action_receipts'::regclass)
     or exists(select 1 from pg_policies where schemaname='public'
       and tablename='hotel_admin_pricing_action_receipts')
     or has_table_privilege('anon','public.hotel_admin_pricing_action_receipts','SELECT')
     or has_table_privilege('authenticated','public.hotel_admin_pricing_action_receipts','SELECT')
     or has_table_privilege('service_role','public.hotel_admin_pricing_action_receipts','SELECT') then
    raise exception using errcode='55000',message='hotels_v2_admin_c_receipt_acl_failed';
  end if;

  if not (select relrowsecurity from pg_class where oid=
       'public.hotel_property_pricing_defaults'::regclass)
     or exists(select 1 from pg_policies where schemaname='public'
       and tablename='hotel_property_pricing_defaults')
     or has_table_privilege('anon','public.hotel_property_pricing_defaults','SELECT')
     or has_table_privilege('authenticated','public.hotel_property_pricing_defaults','SELECT')
     or has_table_privilege('service_role','public.hotel_property_pricing_defaults','SELECT') then
    raise exception using errcode='55000',message='hotels_v2_admin_c_property_default_acl_failed';
  end if;

  if exists(
    select 1
    from unnest(array[
      'hotel_property_pricing_defaults','hotel_admin_pricing_action_receipts',
      'hotel_rate_plans','hotel_room_rates','hotel_pricing_schedules',
      'hotel_pricing_schedule_occupancy_tiers','hotel_room_rate_occupancy_tiers',
      'hotel_rate_rules','hotel_calendar_overrides','hotel_room_allocation_rules',
      'hotel_room_allocation_rule_items','hotel_daily_rates','hotel_activity_log',
      'hotel_pricing_promotion_reviews'
    ]::text[]) relation_name
    where has_table_privilege('anon','public.'||relation_name,'SELECT')
       or has_table_privilege('anon','public.'||relation_name,'INSERT')
       or has_table_privilege('anon','public.'||relation_name,'UPDATE')
       or has_table_privilege('anon','public.'||relation_name,'DELETE')
       or has_table_privilege('authenticated','public.'||relation_name,'SELECT')
       or has_table_privilege('authenticated','public.'||relation_name,'INSERT')
       or has_table_privilege('authenticated','public.'||relation_name,'UPDATE')
       or has_table_privilege('authenticated','public.'||relation_name,'DELETE')
       or exists(select 1 from pg_class relation_row
         join pg_namespace namespace_row on namespace_row.oid=relation_row.relnamespace
         cross join lateral aclexplode(coalesce(relation_row.relacl,
           acldefault('r',relation_row.relowner))) privilege_row
         where namespace_row.nspname='public' and relation_row.relname=relation_name
           and privilege_row.grantee=0
           and privilege_row.privilege_type in('SELECT','INSERT','UPDATE','DELETE'))
  ) then
    raise exception using errcode='55000',message='hotels_v2_admin_c_raw_pricing_acl_failed';
  end if;

  foreach v_signature in array array[
    'public.hotel_v2_admin_get_pricing_control(uuid)',
    'public.hotel_v2_admin_apply_pricing_control_plan(jsonb,uuid,text)',
    'public.hotel_v2_admin_preview_pricing_quote(jsonb)',
    'public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid)',
    'public.hotel_v2_admin_apply_calendar_plan(jsonb,uuid)',
    'public.hotel_v2_admin_apply_h3_1_configuration(jsonb,uuid)',
    'public.hotel_v2_admin_apply_legacy_pricing_promotion(jsonb,uuid)'
  ] loop
    if to_regprocedure(v_signature) is null
       or not has_function_privilege('authenticated',v_signature,'EXECUTE')
       or has_function_privilege('anon',v_signature,'EXECUTE')
       or has_function_privilege('service_role',v_signature,'EXECUTE')
       or not (select procedure_row.prosecdef from pg_proc procedure_row
         where procedure_row.oid=to_regprocedure(v_signature))
       or (select pg_get_userbyid(procedure_row.proowner) from pg_proc procedure_row
         where procedure_row.oid=to_regprocedure(v_signature))<>'postgres'
       or (select procedure_row.proconfig from pg_proc procedure_row
         where procedure_row.oid=to_regprocedure(v_signature))
           is distinct from array['search_path=pg_catalog, public, auth']::text[]
       or exists(select 1 from pg_proc procedure_row
         cross join lateral aclexplode(coalesce(procedure_row.proacl,
           acldefault('f',procedure_row.proowner))) privilege_row
         where procedure_row.oid=to_regprocedure(v_signature)
           and privilege_row.grantee=0 and privilege_row.privilege_type='EXECUTE') then
      raise exception using errcode='55000',message='hotels_v2_admin_c_rpc_acl_failed',
        detail=v_signature;
    end if;
  end loop;

  if not has_function_privilege('service_role',
       'public.hotel_v2_admin_c_guest_array_matches_total(smallint[],integer,smallint)',
       'EXECUTE')
     or has_function_privilege('anon',
       'public.hotel_v2_admin_c_guest_array_matches_total(smallint[],integer,smallint)',
       'EXECUTE')
     or has_function_privilege('authenticated',
       'public.hotel_v2_admin_c_guest_array_matches_total(smallint[],integer,smallint)',
       'EXECUTE')
     or not (select procedure_row.proowner='postgres'::regrole
          and not procedure_row.prosecdef
          and procedure_row.proconfig=array['search_path=pg_catalog']::text[]
        from pg_proc procedure_row where procedure_row.oid=to_regprocedure(
          'public.hotel_v2_admin_c_guest_array_matches_total(smallint[],integer,smallint)'))
     or exists(select 1 from pg_proc procedure_row
       cross join lateral aclexplode(coalesce(procedure_row.proacl,
         acldefault('f',procedure_row.proowner))) privilege_row
       where procedure_row.oid=to_regprocedure(
         'public.hotel_v2_admin_c_guest_array_matches_total(smallint[],integer,smallint)')
         and privilege_row.grantee=0 and privilege_row.privilege_type='EXECUTE') then
    raise exception using errcode='55000',message='hotels_v2_admin_c_check_helper_acl_failed';
  end if;

  select string_agg(concat_ws('|',procedure_row.oid::regprocedure::text,
      pg_get_userbyid(procedure_row.proowner),procedure_row.prosecdef::text,
      coalesce(array_to_string(procedure_row.proconfig,','),'NULL'),
      has_function_privilege('anon',procedure_row.oid,'EXECUTE')::text,
      has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')::text,
      has_function_privilege('service_role',procedure_row.oid,'EXECUTE')::text),E'\n'
      order by procedure_row.oid::regprocedure::text)
    into v_internal_offenders
    from pg_proc procedure_row
    join pg_namespace namespace_row on namespace_row.oid=procedure_row.pronamespace
    where namespace_row.nspname='public'
      and (left(procedure_row.proname,length('hotel_v2_admin_c_'))=
          'hotel_v2_admin_c_'
        or right(procedure_row.proname,length('_admin_c_core'))=
          '_admin_c_core')
      and procedure_row.proname<>'hotel_v2_admin_c_guest_array_matches_total'
      and (procedure_row.proowner<>'postgres'::regrole
        or (procedure_row.proconfig is distinct from
              array['search_path=pg_catalog']::text[]
          and procedure_row.proconfig is distinct from
              array['search_path=pg_catalog, public']::text[])
        or (procedure_row.prosecdef and procedure_row.proconfig is distinct from
          array['search_path=pg_catalog, public']::text[])
        or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
        or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
        or has_function_privilege('service_role',procedure_row.oid,'EXECUTE')
        or exists(select 1 from aclexplode(coalesce(procedure_row.proacl,
          acldefault('f',procedure_row.proowner))) privilege_row
          where privilege_row.grantee=0 and privilege_row.privilege_type='EXECUTE'))
  ;
  if v_internal_offenders is not null then
    raise exception using errcode='55000',message='hotels_v2_admin_c_internal_rpc_exposed',
      detail=v_internal_offenders;
  end if;
end
$admin_c_postconditions$;

notify pgrst,'reload schema';
commit;
