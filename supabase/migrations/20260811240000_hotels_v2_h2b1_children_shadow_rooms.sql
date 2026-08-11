begin;
set transaction isolation level repeatable read;

-- Hotels 2.0 H2B.1: structural child policy, total-occupancy support and a
-- reviewed/idempotent legacy-shadow preparation seam.  This migration is
-- inert: it creates no Room Type, Rate Plan, rate, schedule or tier rows and
-- it never changes architecture_version, publication or capability flags.

lock table public.site_settings in share row exclusive mode;

do $h2b1_preconditions$
begin
  if to_regclass('public.hotel_room_types') is null
     or to_regclass('public.hotel_room_rates') is null
     or to_regclass('public.hotel_room_rate_occupancy_tiers') is null
     or to_regclass('public.hotel_activity_log') is null
     or to_regprocedure('public.hotel_v2_admin_resolve_rate(uuid,date,date,integer)') is null
     or to_regprocedure('public.hotel_v2_admin_get_property_workspace(uuid)') is null
     or to_regprocedure('public.hotel_v2_admin_apply_calendar_plan(jsonb,uuid)') is null
     or to_regprocedure('public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid)') is null
     or to_regprocedure('public.hotel_v2_h2a_require_admin()') is null
     or to_regprocedure('public.hotel_v2_h2a_keys_allowed(jsonb,text[])') is null
     or to_regprocedure('public.hotel_v2_h2a_i18n_is_valid(jsonb,boolean)') is null
     or to_regprocedure('public.hotel_v2_set_updated_at_and_version()') is null then
    raise exception using errcode='55000', message='hotels_v2_h2b1_h2b_prerequisite_missing';
  end if;

  if to_regclass('public.hotel_pricing_schedules') is not null
     or to_regclass('public.hotel_pricing_schedule_occupancy_tiers') is not null
     or to_regprocedure('public.hotel_v2_h2b1_room_capacity(uuid)') is not null
     or to_regprocedure('public.hotel_v2_h2b1_children_policy_valid(text,integer,boolean)') is not null
     or to_regprocedure('public.hotel_v2_admin_apply_room_type_plan(jsonb,uuid)') is not null
     or to_regprocedure('public.hotel_v2_admin_apply_guest_policy_plan(jsonb,uuid)') is not null
     or to_regprocedure('public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)') is not null
     or to_regprocedure('public.hotel_v2_h2a_readiness_h2b_core(uuid)') is not null
     or to_regprocedure('public.hotel_v2_admin_get_property_workspace_h2b_core(uuid)') is not null
     or to_regprocedure('public.hotel_v2_admin_resolve_rate_h2b_core(uuid,date,date,integer)') is not null
     or to_regprocedure('public.hotel_v2_admin_apply_calendar_plan_h2b1_core(jsonb,uuid)') is not null
     or to_regprocedure('public.hotel_v2_admin_apply_workspace_plan_h2b1_core(jsonb,uuid)') is not null
     or exists(select 1 from information_schema.columns where table_schema='public' and table_name='hotels'
       and column_name in ('children_policy','minimum_child_age'))
     or exists(select 1 from information_schema.columns where table_schema='public' and table_name='hotel_room_types'
       and column_name in ('max_occupancy','children_policy_override','minimum_child_age_override','legacy_source_key'))
     or exists(select 1 from information_schema.columns where table_schema='public' and table_name='hotel_room_rates'
       and column_name='pricing_schedule_id') then
    raise exception using errcode='42P07', message='hotels_v2_h2b1_objects_already_exist';
  end if;

  if (select count(*) from public.site_settings)<>1
     or not exists(select 1 from public.site_settings where id=1)
     or exists(select 1 from public.site_settings where hotel_rooms_v2_enabled
       or hotel_external_sync_enabled or hotel_instant_booking_enabled or hotel_stripe_connect_enabled) then
    raise exception using errcode='55000', message='hotels_v2_h2b1_capability_contract_mismatch';
  end if;

  if not exists(select 1 from public.hotel_amenities where code='air_conditioning' and is_active)
     or not exists(select 1 from public.hotel_amenities where code='terrace' and is_active)
     or not exists(select 1 from public.hotel_amenities where code='balcony' and is_active) then
    raise exception using errcode='55000', message='hotels_v2_h2b1_required_amenities_missing';
  end if;
end
$h2b1_preconditions$;

create temporary table hotels_v2_h2b1_protected_snapshot(
  relation_name text primary key,
  row_count bigint not null,
  fingerprint text not null
) on commit drop;

insert into hotels_v2_h2b1_protected_snapshot
select 'hotels',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),'')) from public.hotels row_value
union all select 'hotel_bookings',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),'')) from public.hotel_bookings row_value
union all select 'partner_service_fulfillments',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),'')) from public.partner_service_fulfillments row_value
union all select 'hotel_room_types',count(*),md5(coalesce(string_agg((to_jsonb(row_value)
  -'max_occupancy'-'children_policy_override'-'minimum_child_age_override'-'legacy_source_key')::text,'|' order by row_value.id),'')) from public.hotel_room_types row_value
union all select 'hotel_rate_plans',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),'')) from public.hotel_rate_plans row_value
union all select 'hotel_room_rates',count(*),md5(coalesce(string_agg((to_jsonb(row_value)-'pricing_schedule_id')::text,'|' order by row_value.id),'')) from public.hotel_room_rates row_value
union all select 'hotel_room_rate_occupancy_tiers',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),'')) from public.hotel_room_rate_occupancy_tiers row_value
union all select 'hotel_activity_log',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),'')) from public.hotel_activity_log row_value;

alter table public.hotels
  add column children_policy text,
  add column minimum_child_age smallint,
  add constraint hotels_children_policy_check check (
    (children_policy is null or (
      children_policy is not null and children_policy in ('allowed','not_allowed','minimum_age')
    )) is true
  ),
  add constraint hotels_minimum_child_age_check check (
    (
      (children_policy is null and minimum_child_age is null)
      or (children_policy is not null and children_policy in ('allowed','not_allowed')
        and minimum_child_age is null)
      or (children_policy is not null and children_policy='minimum_age'
        and minimum_child_age is not null and minimum_child_age between 0 and 17)
    ) is true
  );

comment on column public.hotels.children_policy is
  'Rooms V2 guest-policy metadata. Legacy public booking ignores it until an explicit H3 property activation.';
comment on column public.hotels.minimum_child_age is
  'Minimum accepted age for a guest classified as a child; this does not define the legal meaning of child.';

alter table public.hotel_room_types drop constraint hotel_room_types_capacity_check;
alter table public.hotel_room_types
  alter column capacity_adults drop not null,
  alter column capacity_children drop not null,
  add column max_occupancy smallint,
  add column children_policy_override text,
  add column minimum_child_age_override smallint,
  add column legacy_source_key text,
  add constraint hotel_room_types_capacity_check check (
    (
      (max_occupancy is not null and max_occupancy between 1 and 50
        and capacity_adults is null and capacity_children is null)
      or (max_occupancy is null and capacity_adults is not null and capacity_adults>0
        and capacity_children is not null and capacity_children>=0)
    ) is true
  ),
  add constraint hotel_room_types_children_policy_override_check check (
    (children_policy_override is null or (
      children_policy_override is not null
      and children_policy_override in ('allowed','not_allowed','minimum_age')
    )) is true
  ),
  add constraint hotel_room_types_minimum_child_age_override_check check (
    (
      (children_policy_override is null and minimum_child_age_override is null)
      or (children_policy_override is not null
        and children_policy_override in ('allowed','not_allowed')
        and minimum_child_age_override is null)
      or (children_policy_override is not null and children_policy_override='minimum_age'
        and minimum_child_age_override is not null and minimum_child_age_override between 0 and 17)
    ) is true
  ),
  add constraint hotel_room_types_legacy_source_key_check check (
    legacy_source_key is null or (
      legacy_source_key=lower(btrim(legacy_source_key))
      and length(legacy_source_key) between 1 and 120
      and legacy_source_key~'^[a-z0-9][a-z0-9_-]*$'
    )
  );

create unique index hotel_room_types_hotel_legacy_source_key_uidx
  on public.hotel_room_types(hotel_id,legacy_source_key) where legacy_source_key is not null;

comment on column public.hotel_room_types.max_occupancy is
  'Maximum total guests when an adult/child capacity split is not confirmed. H2B/H3 use this before the legacy split sum.';
comment on column public.hotel_room_types.legacy_source_key is
  'Stable reviewed shadow-preparation mapping; never a public identifier.';

create table public.hotel_pricing_schedules(
  id uuid primary key,
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  code text not null,
  name_i18n jsonb not null,
  application_scope text not null,
  currency character(3) not null default 'EUR',
  maximum_party_size smallint not null,
  is_active boolean not null default false,
  review_status text not null default 'requires_review',
  source text not null default 'legacy_preview',
  source_reference jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_pricing_schedules_id_hotel_key unique(id,hotel_id),
  constraint hotel_pricing_schedules_code_check check (
    code=lower(btrim(code)) and length(code) between 1 and 80 and code~'^[a-z0-9][a-z0-9_-]*$'
  ),
  constraint hotel_pricing_schedules_hotel_code_key unique(hotel_id,code),
  constraint hotel_pricing_schedules_name_check check (jsonb_typeof(name_i18n)='object'),
  constraint hotel_pricing_schedules_scope_check check (
    application_scope in ('room_occupancy','property_booking_party')
  ),
  constraint hotel_pricing_schedules_currency_check check (currency::text~'^[A-Z]{3}$'),
  constraint hotel_pricing_schedules_party_check check (maximum_party_size between 1 and 50),
  constraint hotel_pricing_schedules_review_check check (review_status in ('requires_review','reviewed','disabled')),
  constraint hotel_pricing_schedules_activation_review_check check (
    not is_active or review_status='reviewed'
  ),
  constraint hotel_pricing_schedules_source_check check (source in ('manual','legacy_preview','system')),
  constraint hotel_pricing_schedules_source_reference_check check (jsonb_typeof(source_reference)='object'),
  constraint hotel_pricing_schedules_version_check check (version>0)
);

create table public.hotel_pricing_schedule_occupancy_tiers(
  id uuid primary key,
  schedule_id uuid not null references public.hotel_pricing_schedules(id) on delete cascade,
  guest_count smallint not null,
  threshold_nights integer not null,
  nightly_rate numeric(12,2) not null,
  is_active boolean not null default true,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_pricing_schedule_tiers_key unique(schedule_id,guest_count,threshold_nights),
  constraint hotel_pricing_schedule_tiers_guest_check check (guest_count>0),
  constraint hotel_pricing_schedule_tiers_threshold_check check (threshold_nights>0),
  constraint hotel_pricing_schedule_tiers_rate_check check (nightly_rate>=0),
  constraint hotel_pricing_schedule_tiers_version_check check (version>0)
);

create index hotel_pricing_schedules_hotel_idx on public.hotel_pricing_schedules(hotel_id,code,id);
create index hotel_pricing_schedule_tiers_lookup_idx
  on public.hotel_pricing_schedule_occupancy_tiers(schedule_id,guest_count,threshold_nights desc,id)
  where is_active;

alter table public.hotel_room_rates
  add column pricing_schedule_id uuid,
  add constraint hotel_room_rates_pricing_schedule_hotel_fkey
    foreign key(pricing_schedule_id,hotel_id)
    references public.hotel_pricing_schedules(id,hotel_id) on delete restrict,
  add constraint hotel_room_rates_h2b1_schedule_inert_check check (
    pricing_schedule_id is null or not is_active
  );

comment on table public.hotel_pricing_schedules is
  'Reusable shadow pricing schedules. Room occupancy schedules may be shared by products; property-party previews preserve multi-room legacy contracts for H3 allocation.';
comment on column public.hotel_room_rates.pricing_schedule_id is
  'Optional reusable room-occupancy schedule link. Property-party schedules remain unlinked provenance previews.';

create trigger hotel_pricing_schedules_set_updated_at_and_version
before update on public.hotel_pricing_schedules
for each row execute function public.hotel_v2_set_updated_at_and_version();
create trigger hotel_pricing_schedule_tiers_set_updated_at_and_version
before update on public.hotel_pricing_schedule_occupancy_tiers
for each row execute function public.hotel_v2_set_updated_at_and_version();

create function public.hotel_v2_h2b1_validate_schedule_tier_capacity()
returns trigger language plpgsql set search_path=pg_catalog,public
as $function$
declare v_maximum smallint;
begin
  select maximum_party_size into v_maximum from public.hotel_pricing_schedules where id=new.schedule_id;
  if v_maximum is null or new.guest_count>v_maximum then
    raise exception using errcode='23514',message='hotels_v2_h2b1_schedule_tier_exceeds_party_size'; end if;
  return new;
end
$function$;
create function public.hotel_v2_h2b1_guard_schedule_party_size()
returns trigger language plpgsql set search_path=pg_catalog,public
as $function$
begin
  if exists(select 1 from public.hotel_pricing_schedule_occupancy_tiers tier
    where tier.schedule_id=new.id and tier.is_active and tier.guest_count>new.maximum_party_size) then
    raise exception using errcode='23514',message='hotels_v2_h2b1_schedule_party_size_below_active_tier'; end if;
  return new;
end
$function$;
create trigger hotel_pricing_schedule_tiers_capacity_guard
before insert or update of schedule_id,guest_count,is_active on public.hotel_pricing_schedule_occupancy_tiers
for each row execute function public.hotel_v2_h2b1_validate_schedule_tier_capacity();
create trigger hotel_pricing_schedules_party_size_guard
before update of maximum_party_size on public.hotel_pricing_schedules
for each row execute function public.hotel_v2_h2b1_guard_schedule_party_size();
revoke all on function public.hotel_v2_h2b1_validate_schedule_tier_capacity() from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_h2b1_guard_schedule_party_size() from public,anon,authenticated,service_role;

alter table public.hotel_pricing_schedules enable row level security;
alter table public.hotel_pricing_schedule_occupancy_tiers enable row level security;
create policy hotel_pricing_schedules_admin_select on public.hotel_pricing_schedules
  for select to authenticated using(public.is_current_user_admin());
create policy hotel_pricing_schedule_tiers_admin_select on public.hotel_pricing_schedule_occupancy_tiers
  for select to authenticated using(public.is_current_user_admin());
revoke all on table public.hotel_pricing_schedules from public,anon,authenticated;
revoke all on table public.hotel_pricing_schedule_occupancy_tiers from public,anon,authenticated;
grant select on table public.hotel_pricing_schedules to authenticated;
grant select on table public.hotel_pricing_schedule_occupancy_tiers to authenticated;
grant all on table public.hotel_pricing_schedules to service_role;
grant all on table public.hotel_pricing_schedule_occupancy_tiers to service_role;

create function public.hotel_v2_h2b1_children_policy_valid(
  p_policy text,
  p_minimum_age integer,
  p_allow_inherit boolean default false
) returns boolean
language sql immutable
set search_path=pg_catalog
as $function$
  select case
    when p_policy is null then coalesce(p_allow_inherit,false) and p_minimum_age is null
    when p_policy in ('allowed','not_allowed') then p_minimum_age is null
    when p_policy='minimum_age' then p_minimum_age is not null and p_minimum_age between 0 and 17
    else false
  end
$function$;

create function public.hotel_v2_h2b1_room_capacity(p_room_type_id uuid)
returns integer
language sql stable
set search_path=pg_catalog,public
as $function$
  select case
    when room_type.max_occupancy is not null then room_type.max_occupancy
    when room_type.capacity_adults is not null and room_type.capacity_children is not null
      then room_type.capacity_adults+room_type.capacity_children
    else null end
  from public.hotel_room_types room_type where room_type.id=p_room_type_id
$function$;

-- H2A deliberately supported only executable cancellation policies. H2B.1
-- needs an explicit inert state rather than inventing terms for a legacy
-- property. H3 readiness must reject this type until Admin replaces it.
create or replace function public.hotel_v2_h2a_cancellation_policy_is_valid(p_value jsonb)
returns boolean language plpgsql immutable set search_path=pg_catalog
as $function$
declare v_type text; v_deadline integer; v_mode text; v_penalty numeric;
begin
  if p_value is null or jsonb_typeof(p_value)<>'object' then return false; end if;
  v_type:=p_value->>'type';
  if v_type not in ('flexible','non_refundable','custom','requires_review') then return false; end if;
  if exists(select 1 from jsonb_object_keys(p_value) key_name where key_name not in(
    'type','deadline_hours','penalty_mode','penalty_value','summary_i18n','reason'
  )) then return false; end if;
  if p_value?'summary_i18n' and not public.hotel_v2_h2a_i18n_is_valid(p_value->'summary_i18n',false) then return false; end if;
  if v_type='requires_review' then
    return not (p_value?'deadline_hours') and not (p_value?'penalty_mode') and not (p_value?'penalty_value')
      and length(btrim(coalesce(p_value->>'reason',''))) between 1 and 160;
  end if;
  if p_value?'reason' then return false; end if;
  if v_type<>'custom' then
    return not (p_value?'deadline_hours') and not (p_value?'penalty_mode') and not (p_value?'penalty_value');
  end if;
  if not (p_value?'deadline_hours') or not (p_value?'penalty_mode') then return false; end if;
  begin v_deadline:=(p_value->>'deadline_hours')::integer; exception when others then return false; end;
  v_mode:=p_value->>'penalty_mode';
  if v_deadline<0 or v_mode not in ('none','flat','percent') then return false; end if;
  if v_mode='none' then return not (p_value?'penalty_value') or p_value->>'penalty_value' is null; end if;
  if not (p_value?'penalty_value') then return false; end if;
  begin v_penalty:=(p_value->>'penalty_value')::numeric; exception when others then return false; end;
  return v_penalty>=0 and (v_mode<>'percent' or v_penalty<=100);
end
$function$;

-- A placeholder policy is deliberately non-executable. The generic H2A
-- workspace RPC may edit Rate Plans, so this invariant belongs in the table
-- contract rather than only in the H2B.1 UI/readiness layer.
alter table public.hotel_rate_plans
  add constraint hotel_rate_plans_h2b1_review_activation_check check (
    not is_active or cancellation_policy->>'type'<>'requires_review'
  );

create or replace function public.hotel_v2_h2b_validate_occupancy_tier_contract()
returns trigger language plpgsql set search_path=pg_catalog,public
as $function$
declare v_capacity integer;
begin
  select public.hotel_v2_h2b1_room_capacity(room_rate.room_type_id) into v_capacity
  from public.hotel_room_rates room_rate
  where room_rate.id=new.room_rate_id and room_rate.hotel_id=new.hotel_id;
  if v_capacity is null or new.guest_count>v_capacity then
    raise exception using errcode='23514',message='hotels_v2_h2b_occupancy_tier_exceeds_room_capacity';
  end if;
  return new;
end
$function$;

create or replace function public.hotel_v2_h2b_guard_room_capacity_against_tiers()
returns trigger language plpgsql set search_path=pg_catalog,public
as $function$
declare v_capacity integer;
begin
  v_capacity:=coalesce(new.max_occupancy,
    case when new.capacity_adults is null then null
      else new.capacity_adults+coalesce(new.capacity_children,0) end);
  if v_capacity is null then
    raise exception using errcode='23514',message='hotels_v2_h2b1_room_capacity_required';
  end if;
  if exists(
    select 1 from public.hotel_room_rates room_rate
    join public.hotel_room_rate_occupancy_tiers tier on tier.room_rate_id=room_rate.id
    where room_rate.room_type_id=new.id and tier.is_active and tier.guest_count>v_capacity
  ) then
    raise exception using errcode='23514',message='hotels_v2_h2b_room_capacity_below_active_occupancy_tier';
  end if;
  return new;
end
$function$;

drop trigger hotel_room_types_occupancy_tier_capacity_guard on public.hotel_room_types;
create trigger hotel_room_types_occupancy_tier_capacity_guard
before update of capacity_adults,capacity_children,max_occupancy on public.hotel_room_types
for each row execute function public.hotel_v2_h2b_guard_room_capacity_against_tiers();

revoke all on function public.hotel_v2_h2b1_children_policy_valid(text,integer,boolean) from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_h2b1_room_capacity(uuid) from public,anon,authenticated,service_role;

-- PostgREST must not receive SQLSTATE 40001 for an ordinary reviewed-version
-- conflict. It is a transaction serialization signal and PostgREST 14 may
-- wait for retry/connection recovery instead of returning to the Admin UI.
-- Retain the exact H2A/H2B implementations as private cores and translate
-- only their optimistic-concurrency failures to an explicit HTTP 409.
alter function public.hotel_v2_admin_apply_calendar_plan(jsonb,uuid)
  rename to hotel_v2_admin_apply_calendar_plan_h2b1_core;
revoke all on function public.hotel_v2_admin_apply_calendar_plan_h2b1_core(jsonb,uuid)
  from public,anon,authenticated,service_role;

create function public.hotel_v2_admin_apply_calendar_plan(
  p_plan jsonb,p_correlation_id uuid default gen_random_uuid()
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
declare v_message text; v_detail text; v_hint text;
begin
  perform public.hotel_v2_h2a_require_admin();
  return public.hotel_v2_admin_apply_calendar_plan_h2b1_core(p_plan,p_correlation_id);
exception when serialization_failure then
  get stacked diagnostics
    v_message=message_text,v_detail=pg_exception_detail,v_hint=pg_exception_hint;
  raise exception using errcode='PT409',
    message=coalesce(nullif(v_message,''),'hotels_v2_h2b1_stale_calendar_plan'),
    detail=coalesce(v_detail,''),hint=coalesce(v_hint,'');
end
$function$;
comment on function public.hotel_v2_admin_apply_calendar_plan(jsonb,uuid) is
  'Admin-only H2B.1 transport wrapper: preserves the H2B transactional calendar plan and returns optimistic conflicts as HTTP 409.';
revoke all on function public.hotel_v2_admin_apply_calendar_plan(jsonb,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.hotel_v2_admin_apply_calendar_plan(jsonb,uuid) to authenticated;

alter function public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid)
  rename to hotel_v2_admin_apply_workspace_plan_h2b1_core;
revoke all on function public.hotel_v2_admin_apply_workspace_plan_h2b1_core(jsonb,uuid)
  from public,anon,authenticated,service_role;

create function public.hotel_v2_admin_apply_workspace_plan(
  p_plan jsonb,p_correlation_id uuid default gen_random_uuid()
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
declare v_message text; v_detail text; v_hint text;
begin
  perform public.hotel_v2_h2a_require_admin();
  return public.hotel_v2_admin_apply_workspace_plan_h2b1_core(p_plan,p_correlation_id);
exception when serialization_failure then
  get stacked diagnostics
    v_message=message_text,v_detail=pg_exception_detail,v_hint=pg_exception_hint;
  raise exception using errcode='PT409',
    message=coalesce(nullif(v_message,''),'hotels_v2_h2b1_stale_workspace_plan'),
    detail=coalesce(v_detail,''),hint=coalesce(v_hint,'');
end
$function$;
comment on function public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid) is
  'Admin-only H2B.1 transport wrapper: preserves the H2A transactional workspace plan and returns optimistic conflicts as HTTP 409.';
revoke all on function public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid) to authenticated;

-- Extend the deployed H2A readiness result without rewriting its established
-- room/inventory/partner rules. These blockers remain visible in shadow mode;
-- a legacy property still reports public state LEGACY.
alter function public.hotel_v2_h2a_readiness(uuid)
  rename to hotel_v2_h2a_readiness_h2b_core;
revoke all on function public.hotel_v2_h2a_readiness_h2b_core(uuid)
  from public,anon,authenticated,service_role;

create function public.hotel_v2_h2a_readiness(p_hotel_id uuid)
returns jsonb language plpgsql security definer stable
set search_path=pg_catalog,public
as $function$
declare
  v_result jsonb; v_architecture text; v_blockers text[];
begin
  v_result:=public.hotel_v2_h2a_readiness_h2b_core(p_hotel_id);
  select architecture_version into strict v_architecture from public.hotels where id=p_hotel_id;
  select coalesce(array_agg(value),'{}'::text[]) into v_blockers
  from jsonb_array_elements_text(coalesce(v_result->'preparation_blockers','[]'::jsonb)) value;

  if exists(
    select 1 from public.hotel_room_types room_type
    join public.hotels hotel on hotel.id=room_type.hotel_id
    where room_type.hotel_id=p_hotel_id and room_type.status='active'
      and not public.hotel_v2_h2b1_children_policy_valid(
        coalesce(room_type.children_policy_override,hotel.children_policy),
        case when room_type.children_policy_override is not null
          then room_type.minimum_child_age_override else hotel.minimum_child_age end,false
      )
  ) and not ('unreviewed_children_policy'=any(v_blockers)) then
    v_blockers:=array_append(v_blockers,'unreviewed_children_policy');
  end if;
  if exists(select 1 from public.hotel_rate_plans rate_plan
    where rate_plan.hotel_id=p_hotel_id and rate_plan.is_active
      and rate_plan.cancellation_policy->>'type'='requires_review')
     and not ('unreviewed_cancellation_policy'=any(v_blockers)) then
    v_blockers:=array_append(v_blockers,'unreviewed_cancellation_policy');
  end if;
  if exists(select 1 from public.hotel_room_rates room_rate
    where room_rate.hotel_id=p_hotel_id and room_rate.is_active
      and room_rate.pricing_schedule_id is not null)
     and not ('h2b1_schedule_product_not_executable'=any(v_blockers)) then
    v_blockers:=array_append(v_blockers,'h2b1_schedule_product_not_executable');
  end if;

  v_result:=jsonb_set(v_result,'{preparation_blockers}',to_jsonb(v_blockers),true);
  if cardinality(v_blockers)>0 then
    v_result:=jsonb_set(v_result,'{preparation_state}','"BLOCKED"'::jsonb,true);
    if v_architecture<>'legacy' then
      v_result:=jsonb_set(v_result,'{state}','"BLOCKED"'::jsonb,true);
      v_result:=jsonb_set(v_result,'{blockers}',to_jsonb(v_blockers),true);
    end if;
  end if;
  return v_result;
end
$function$;
comment on function public.hotel_v2_h2a_readiness(uuid) is
  'H2B.1 readiness wrapper: active rooms require reviewed child policy; placeholder cancellation and linked shadow schedules are not executable.';
revoke all on function public.hotel_v2_h2a_readiness(uuid)
  from public,anon,authenticated,service_role;

-- Retain the deployed H2B implementation as the exact-rate/calendar core.
-- The wrapper adds total-capacity enforcement and refuses to misapply a
-- property-booking-party schedule to one physical room.
alter function public.hotel_v2_admin_resolve_rate(uuid,date,date,integer)
  rename to hotel_v2_admin_resolve_rate_h2b_core;
revoke all on function public.hotel_v2_admin_resolve_rate_h2b_core(uuid,date,date,integer)
  from public,anon,authenticated,service_role;

create function public.hotel_v2_admin_resolve_rate(
  p_room_rate_id uuid,p_check_in date,p_check_out date,p_guest_count integer
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
declare
  v_rate public.hotel_room_rates%rowtype;
  v_room public.hotel_room_types%rowtype;
  v_capacity integer;
  v_guest_count integer;
  v_schedule public.hotel_pricing_schedules%rowtype;
begin
  perform public.hotel_v2_h2a_require_admin();
  select * into v_rate from public.hotel_room_rates where id=p_room_rate_id;
  if not found then raise exception using errcode='P0002',message='hotels_v2_h2b_room_rate_not_found'; end if;
  select * into strict v_room from public.hotel_room_types where id=v_rate.room_type_id;
  v_capacity:=public.hotel_v2_h2b1_room_capacity(v_room.id);
  v_guest_count:=coalesce(p_guest_count,greatest(1,least(2,v_capacity)));
  if v_capacity is null or v_guest_count<1 then
    raise exception using errcode='22023',message='hotels_v2_h2b1_room_capacity_unresolved';
  end if;
  if v_guest_count>v_capacity then
    return jsonb_build_object(
      'ok',false,'requestable',false,'reason','occupancy_exceeds_capacity',
      'blocking_reasons',jsonb_build_array('occupancy_exceeds_capacity'),
      'hotel_id',v_rate.hotel_id,'room_type_id',v_room.id,'room_rate_id',v_rate.id,
      'rate_plan_id',v_rate.rate_plan_id,'check_in',p_check_in,'check_out',p_check_out,
      'guest_count',v_guest_count,'capacity',v_capacity,'currency',v_rate.currency,'total',null
    );
  end if;
  if v_rate.pricing_schedule_id is not null then
    select * into strict v_schedule from public.hotel_pricing_schedules where id=v_rate.pricing_schedule_id;
    return jsonb_build_object(
      'ok',false,'requestable',false,
      'reason','shared_room_pricing_schedule_requires_h3_resolution',
      'blocking_reasons',jsonb_build_array('shared_room_pricing_schedule_requires_h3_resolution'),
      'hotel_id',v_rate.hotel_id,'room_type_id',v_room.id,'room_rate_id',v_rate.id,
      'rate_plan_id',v_rate.rate_plan_id,'pricing_schedule_id',v_schedule.id,
      'pricing_schedule_scope',v_schedule.application_scope,
      'check_in',p_check_in,'check_out',p_check_out,'guest_count',v_guest_count,
      'capacity',v_capacity,'currency',v_rate.currency,'nightly_breakdown','[]'::jsonb,'total',null
    );
  end if;
  return public.hotel_v2_admin_resolve_rate_h2b_core(
    p_room_rate_id,p_check_in,p_check_out,v_guest_count
  );
end
$function$;

comment on function public.hotel_v2_admin_resolve_rate(uuid,date,date,integer) is
  'Admin-only H2B.1 wrapper: exact total occupancy is enforced; reusable schedule resolution fails closed until H3 adds the authoritative allocation-aware resolver.';
revoke all on function public.hotel_v2_admin_resolve_rate(uuid,date,date,integer)
  from public,anon,authenticated,service_role;
grant execute on function public.hotel_v2_admin_resolve_rate(uuid,date,date,integer) to authenticated;

-- Add schedule data to the established workspace without copying its security
-- or legacy compatibility logic.
alter function public.hotel_v2_admin_get_property_workspace(uuid)
  rename to hotel_v2_admin_get_property_workspace_h2b_core;
revoke all on function public.hotel_v2_admin_get_property_workspace_h2b_core(uuid)
  from public,anon,authenticated,service_role;

create function public.hotel_v2_admin_get_property_workspace(p_hotel_id uuid)
returns jsonb language plpgsql security definer stable
set search_path=pg_catalog,public,auth
as $function$
declare v_result jsonb;
begin
  perform public.hotel_v2_h2a_require_admin();
  v_result:=public.hotel_v2_admin_get_property_workspace_h2b_core(p_hotel_id);
  return v_result || jsonb_build_object(
    'pricing_schedules',coalesce((
      select jsonb_agg(to_jsonb(schedule) order by schedule.code,schedule.id)
      from public.hotel_pricing_schedules schedule where schedule.hotel_id=p_hotel_id
    ),'[]'::jsonb),
    'pricing_schedule_tiers',coalesce((
      select jsonb_agg(to_jsonb(tier) order by tier.schedule_id,tier.guest_count,tier.threshold_nights,tier.id)
      from public.hotel_pricing_schedule_occupancy_tiers tier
      join public.hotel_pricing_schedules schedule on schedule.id=tier.schedule_id
      where schedule.hotel_id=p_hotel_id
    ),'[]'::jsonb),
    'legacy_shadow_preview',(
      select jsonb_build_object(
        'legacy_pricing_fingerprint',md5(coalesce(hotel.pricing_tiers,'{}'::jsonb)::text),
        'legacy_pricing_rule_count',case when jsonb_typeof(hotel.pricing_tiers->'rules')='array'
          then jsonb_array_length(hotel.pricing_tiers->'rules') else 0 end,
        'property_gallery_count',case when jsonb_typeof(hotel.photos)='array' then jsonb_array_length(hotel.photos) else 0 end
      ) from public.hotels hotel where hotel.id=p_hotel_id
    )
  );
end
$function$;
comment on function public.hotel_v2_admin_get_property_workspace(uuid) is
  'Admin-only H2B.1 workspace including reusable shadow pricing schedules and a non-PII legacy source fingerprint.';
revoke all on function public.hotel_v2_admin_get_property_workspace(uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.hotel_v2_admin_get_property_workspace(uuid) to authenticated;

create function public.hotel_v2_admin_apply_guest_policy_plan(
  p_plan jsonb,p_correlation_id uuid default gen_random_uuid()
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
declare
  v_hotel_id uuid; v_hotel public.hotels%rowtype; v_reviewed_at timestamptz;
  v_policy jsonb; v_room_policy jsonb; v_room public.hotel_room_types%rowtype;
  v_before jsonb; v_after jsonb; v_room_count integer:=0;
  v_max smallint; v_adults smallint; v_children smallint;
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_plan is null or jsonb_typeof(p_plan)<>'object' or p_correlation_id is null
     or not public.hotel_v2_h2a_keys_allowed(p_plan,array[
       'hotel_id','expected_property_updated_at','reviewed_at','property_policy','room_policies'
     ]) or not (p_plan ?& array['hotel_id','expected_property_updated_at','reviewed_at'])
     or (not (p_plan?'property_policy') and not (p_plan?'room_policies')) then
    raise exception using errcode='22023',message='hotels_v2_h2b1_invalid_guest_policy_plan';
  end if;
  v_hotel_id:=(p_plan->>'hotel_id')::uuid;
  v_reviewed_at:=(p_plan->>'reviewed_at')::timestamptz;
  if v_reviewed_at<clock_timestamp()-interval '30 minutes' or v_reviewed_at>clock_timestamp()+interval '5 minutes' then
    raise exception using errcode='22023',message='hotels_v2_h2b1_guest_policy_review_expired';
  end if;
  select * into v_hotel from public.hotels where id=v_hotel_id for update;
  if not found then raise exception using errcode='P0002',message='hotels_v2_h2b1_property_not_found'; end if;
  if v_hotel.updated_at is distinct from (p_plan->>'expected_property_updated_at')::timestamptz then
    raise exception using errcode='PT409',message='hotels_v2_h2b1_stale_property';
  end if;
  if exists(select 1 from public.hotel_activity_log where correlation_id=p_correlation_id) then
    raise exception using errcode='23505',message='hotels_v2_h2b1_correlation_id_already_used';
  end if;
  if p_plan?'property_policy' then
    v_policy:=p_plan->'property_policy';
    if jsonb_typeof(v_policy)<>'object'
       or not public.hotel_v2_h2a_keys_allowed(v_policy,array['children_policy','minimum_child_age'])
       or not (v_policy?'children_policy')
       or not public.hotel_v2_h2b1_children_policy_valid(
         v_policy->>'children_policy',case when v_policy->>'minimum_child_age' is null then null else (v_policy->>'minimum_child_age')::integer end,false
       ) then raise exception using errcode='22023',message='hotels_v2_h2b1_invalid_property_children_policy'; end if;
  end if;
  if p_plan?'room_policies' then
    if jsonb_typeof(p_plan->'room_policies')<>'array' or jsonb_array_length(p_plan->'room_policies')>100 then
      raise exception using errcode='22023',message='hotels_v2_h2b1_invalid_room_policy_array';
    end if;
    if exists(select 1 from jsonb_array_elements(p_plan->'room_policies') item group by item->>'room_type_id' having count(*)>1) then
      raise exception using errcode='22023',message='hotels_v2_h2b1_duplicate_room_policy_target';
    end if;
    for v_room_policy in select value from jsonb_array_elements(p_plan->'room_policies') loop
      if jsonb_typeof(v_room_policy)<>'object'
         or not public.hotel_v2_h2a_keys_allowed(v_room_policy,array[
           'room_type_id','expected_version','children_policy_override','minimum_child_age_override',
           'max_occupancy','capacity_adults','capacity_children'
         ]) or not (v_room_policy ?& array['room_type_id','expected_version'])
         or not public.hotel_v2_h2b1_children_policy_valid(
           v_room_policy->>'children_policy_override',
           case when v_room_policy->>'minimum_child_age_override' is null then null else (v_room_policy->>'minimum_child_age_override')::integer end,true
         ) then raise exception using errcode='22023',message='hotels_v2_h2b1_invalid_room_children_policy'; end if;
      select * into v_room from public.hotel_room_types
      where id=(v_room_policy->>'room_type_id')::uuid and hotel_id=v_hotel_id for update;
      if not found or v_room.version<>(v_room_policy->>'expected_version')::bigint then
        raise exception using errcode='PT409',message='hotels_v2_h2b1_stale_room_policy';
      end if;
      v_max:=case when v_room_policy?'max_occupancy' then (v_room_policy->>'max_occupancy')::smallint else v_room.max_occupancy end;
      v_adults:=case when v_room_policy?'capacity_adults' then (v_room_policy->>'capacity_adults')::smallint else v_room.capacity_adults end;
      v_children:=case when v_room_policy?'capacity_children' then (v_room_policy->>'capacity_children')::smallint else v_room.capacity_children end;
      if not ((v_max between 1 and 50 and v_adults is null and v_children is null)
        or (v_max is null and v_adults>0 and v_children>=0)) then
        raise exception using errcode='22023',message='hotels_v2_h2b1_invalid_room_capacity';
      end if;
    end loop;
  end if;

  if p_plan?'property_policy' then
    select to_jsonb(hotel) into v_before from public.hotels hotel where id=v_hotel_id;
    update public.hotels set
      children_policy=v_policy->>'children_policy',
      minimum_child_age=case when v_policy->>'minimum_child_age' is null then null else (v_policy->>'minimum_child_age')::smallint end
    where id=v_hotel_id and updated_at=v_hotel.updated_at returning to_jsonb(hotels.*) into v_after;
    if v_after is null then raise exception using errcode='PT409',message='hotels_v2_h2b1_stale_property'; end if;
    insert into public.hotel_activity_log(hotel_id,entity_type,entity_id,action,before_state,after_state,actor_type,actor_id,source,correlation_id)
    values(v_hotel_id,'property',v_hotel_id,'update',v_before,v_after,'admin',auth.uid(),'hotels_v2_h2b1_guest_policy',p_correlation_id);
  end if;
  if p_plan?'room_policies' then
    for v_room_policy in select value from jsonb_array_elements(p_plan->'room_policies') loop
      select to_jsonb(room_type) into v_before from public.hotel_room_types room_type where id=(v_room_policy->>'room_type_id')::uuid;
      update public.hotel_room_types set
        children_policy_override=case when v_room_policy?'children_policy_override'
          then nullif(v_room_policy->>'children_policy_override','') else children_policy_override end,
        minimum_child_age_override=case when v_room_policy?'minimum_child_age_override'
          then case when v_room_policy->>'minimum_child_age_override' is null then null
            else (v_room_policy->>'minimum_child_age_override')::smallint end
          else minimum_child_age_override end,
        max_occupancy=case when v_room_policy?'max_occupancy' then (v_room_policy->>'max_occupancy')::smallint else max_occupancy end,
        capacity_adults=case when v_room_policy?'capacity_adults' then (v_room_policy->>'capacity_adults')::smallint else capacity_adults end,
        capacity_children=case when v_room_policy?'capacity_children' then (v_room_policy->>'capacity_children')::smallint else capacity_children end
      where id=(v_room_policy->>'room_type_id')::uuid
        and hotel_id=v_hotel_id and version=(v_room_policy->>'expected_version')::bigint
      returning to_jsonb(hotel_room_types.*) into v_after;
      if v_after is null then raise exception using errcode='PT409',message='hotels_v2_h2b1_stale_room_policy'; end if;
      insert into public.hotel_activity_log(hotel_id,entity_type,entity_id,action,before_state,after_state,actor_type,actor_id,source,correlation_id)
      values(v_hotel_id,'room_type',(v_room_policy->>'room_type_id')::uuid,'update',v_before,v_after,'admin',auth.uid(),'hotels_v2_h2b1_guest_policy',p_correlation_id);
      v_room_count:=v_room_count+1;
    end loop;
  end if;
  return jsonb_build_object('correlation_id',p_correlation_id,'updated_room_policy_count',v_room_count,
    'workspace',public.hotel_v2_admin_get_property_workspace(v_hotel_id),
    'activity',(select coalesce(jsonb_agg(to_jsonb(activity) order by activity.created_at,activity.id),'[]'::jsonb)
      from public.hotel_activity_log activity where activity.correlation_id=p_correlation_id));
end
$function$;

-- Exact/versioned Room Type save for the H2B.1 capacity and child-policy
-- contract. Existing H2A saves remain valid for confirmed split capacities;
-- this RPC is required when max_occupancy or a Room override participates in
-- the same reviewed Room edit.
create function public.hotel_v2_admin_apply_room_type_plan(
  p_plan jsonb,p_correlation_id uuid default gen_random_uuid()
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
declare
  v_hotel_id uuid; v_hotel public.hotels%rowtype; v_operation jsonb; v_payload jsonb;
  v_room_id uuid; v_action text; v_expected_version bigint; v_room public.hotel_room_types%rowtype;
  v_before jsonb; v_after jsonb; v_reviewed_at timestamptz;
  v_max smallint; v_adults smallint; v_children smallint; v_mode text;
  v_child_policy text; v_child_age smallint; v_amenity text;
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_plan is null or jsonb_typeof(p_plan)<>'object' or p_correlation_id is null
     or not public.hotel_v2_h2a_keys_allowed(p_plan,array[
       'hotel_id','expected_property_updated_at','reviewed_at','operation'
     ]) or not (p_plan ?& array['hotel_id','expected_property_updated_at','reviewed_at','operation'])
     or jsonb_typeof(p_plan->'operation')<>'object' then
    raise exception using errcode='22023',message='hotels_v2_h2b1_invalid_room_type_plan'; end if;
  v_hotel_id:=(p_plan->>'hotel_id')::uuid; v_operation:=p_plan->'operation';
  if not public.hotel_v2_h2a_keys_allowed(v_operation,array['type','id','expected_version','payload'])
     or not (v_operation ?& array['type','id','expected_version','payload'])
     or jsonb_typeof(v_operation->'payload')<>'object' then
    raise exception using errcode='22023',message='hotels_v2_h2b1_invalid_room_type_operation'; end if;
  v_action:=v_operation->>'type'; v_room_id:=(v_operation->>'id')::uuid;
  v_expected_version:=(v_operation->>'expected_version')::bigint; v_payload:=v_operation->'payload';
  if v_action not in ('create','update','disable','duplicate') or v_room_id is null
     or (v_action<>'duplicate' and v_payload?'source_id')
     or not public.hotel_v2_h2a_keys_allowed(v_payload,array[
       'source_id','code','name_i18n','description_i18n','gallery','capacity_adults','capacity_children','max_occupancy',
       'children_policy_override','minimum_child_age_override','bed_configuration','bathrooms','size_sqm',
       'amenities','inventory_mode','base_inventory_count','status','sort_order'
     ]) then raise exception using errcode='22023',message='hotels_v2_h2b1_invalid_room_type_payload'; end if;
  v_reviewed_at:=(p_plan->>'reviewed_at')::timestamptz;
  if v_reviewed_at<clock_timestamp()-interval '30 minutes' or v_reviewed_at>clock_timestamp()+interval '5 minutes' then
    raise exception using errcode='22023',message='hotels_v2_h2b1_room_type_review_expired'; end if;
  select * into v_hotel from public.hotels where id=v_hotel_id for share;
  if not found then raise exception using errcode='P0002',message='hotels_v2_h2b1_property_not_found'; end if;
  if v_hotel.updated_at is distinct from (p_plan->>'expected_property_updated_at')::timestamptz then
    raise exception using errcode='PT409',message='hotels_v2_h2b1_stale_property'; end if;
  if exists(select 1 from public.hotel_activity_log where correlation_id=p_correlation_id) then
    raise exception using errcode='23505',message='hotels_v2_h2b1_correlation_id_already_used'; end if;
  select * into v_room from public.hotel_room_types where id=v_room_id for update;
  if v_action='create' then
    if found or v_expected_version<>0 or not (v_payload ?& array[
      'code','name_i18n','gallery','bed_configuration','amenities','inventory_mode','base_inventory_count'
    ]) then raise exception using errcode='23514',message='hotels_v2_h2b1_invalid_room_type_create'; end if;
  elsif v_action='duplicate' then
    if found or v_expected_version is null or not (v_payload ?& array['source_id','code']) then
      raise exception using errcode='23514',message='hotels_v2_h2b1_invalid_room_type_duplicate'; end if;
    select * into v_room from public.hotel_room_types
      where id=(v_payload->>'source_id')::uuid and hotel_id=v_hotel_id for update;
    if not found or v_room.version<>v_expected_version then
      raise exception using errcode='PT409',message='hotels_v2_h2b1_stale_room_type_source'; end if;
  else
    if not found or v_room.hotel_id<>v_hotel_id or v_room.version<>v_expected_version then
      raise exception using errcode='PT409',message='hotels_v2_h2b1_stale_room_type'; end if;
    if v_action='disable' and v_payload<>'{}'::jsonb then
      raise exception using errcode='22023',message='hotels_v2_h2b1_disable_payload_must_be_empty'; end if;
  end if;
  if v_action='disable' then
    v_max:=v_room.max_occupancy; v_adults:=v_room.capacity_adults; v_children:=v_room.capacity_children;
    v_child_policy:=v_room.children_policy_override; v_child_age:=v_room.minimum_child_age_override;
  else
    v_max:=case when v_payload?'max_occupancy' then (v_payload->>'max_occupancy')::smallint else v_room.max_occupancy end;
    v_adults:=case when v_payload?'capacity_adults' then (v_payload->>'capacity_adults')::smallint else v_room.capacity_adults end;
    v_children:=case when v_payload?'capacity_children' then (v_payload->>'capacity_children')::smallint else
      case when v_action='create' then null else v_room.capacity_children end end;
    if not ((v_max between 1 and 50 and v_adults is null and v_children is null)
      or (v_max is null and v_adults>0 and v_children>=0)) then
      raise exception using errcode='22023',message='hotels_v2_h2b1_invalid_room_capacity'; end if;
    v_child_policy:=case when v_payload?'children_policy_override'
      then nullif(v_payload->>'children_policy_override','') else v_room.children_policy_override end;
    v_child_age:=case when v_payload?'minimum_child_age_override'
      then (v_payload->>'minimum_child_age_override')::smallint else v_room.minimum_child_age_override end;
    if not public.hotel_v2_h2b1_children_policy_valid(v_child_policy,v_child_age,true) then
      raise exception using errcode='22023',message='hotels_v2_h2b1_invalid_room_children_policy'; end if;
    if v_payload?'name_i18n' and not public.hotel_v2_h2a_i18n_is_valid(v_payload->'name_i18n',true) then
      raise exception using errcode='22023',message='hotels_v2_h2b1_invalid_room_name'; end if;
    if v_payload?'description_i18n' and not public.hotel_v2_h2a_i18n_is_valid(v_payload->'description_i18n',false) then
      raise exception using errcode='22023',message='hotels_v2_h2b1_invalid_room_description'; end if;
    if (v_payload?'gallery' and jsonb_typeof(v_payload->'gallery')<>'array')
       or (v_payload?'bed_configuration' and not public.hotel_v2_h2a_beds_are_valid(v_payload->'bed_configuration'))
       or (v_payload?'amenities' and jsonb_typeof(v_payload->'amenities')<>'array') then
      raise exception using errcode='22023',message='hotels_v2_h2b1_invalid_room_structured_data'; end if;
    if v_payload?'amenities' then
      for v_amenity in select value#>>'{}' from jsonb_array_elements(v_payload->'amenities') loop
        if not exists(select 1 from public.hotel_amenities where code=v_amenity and is_active) then
          raise exception using errcode='23503',message='hotels_v2_h2b1_unknown_room_amenity'; end if;
      end loop;
    end if;
    v_mode:=coalesce(v_payload->>'inventory_mode',case when v_action='create' then 'pooled' else v_room.inventory_mode end);
    if v_mode not in ('pooled','unitized') then raise exception using errcode='22023',message='hotels_v2_h2b1_invalid_inventory_mode'; end if;
    if v_action='update' and v_mode<>v_room.inventory_mode and (
      exists(select 1 from public.hotel_daily_inventory where room_type_id=v_room_id)
      or (v_room.inventory_mode='unitized' and exists(select 1 from public.hotel_units where room_type_id=v_room_id))
    ) then raise exception using errcode='23514',message='hotels_v2_h2b1_inventory_mode_change_requires_empty_state'; end if;
  end if;

  if v_action in ('create','duplicate') then
    if v_action='duplicate' then v_before:=to_jsonb(v_room); end if;
    insert into public.hotel_room_types(
      id,hotel_id,code,name_i18n,description_i18n,gallery,capacity_adults,capacity_children,max_occupancy,
      children_policy_override,minimum_child_age_override,bed_configuration,bathrooms,size_sqm,amenities,
      inventory_mode,base_inventory_count,status,sort_order
    ) values(
      v_room_id,v_hotel_id,lower(btrim(v_payload->>'code')),
      case when v_payload?'name_i18n' then v_payload->'name_i18n' else v_room.name_i18n end,
      case when v_payload?'description_i18n' then v_payload->'description_i18n'
        when v_action='duplicate' then v_room.description_i18n else '{}'::jsonb end,
      case when v_payload?'gallery' then v_payload->'gallery'
        when v_action='duplicate' then v_room.gallery else '[]'::jsonb end,
      v_adults,v_children,v_max,v_child_policy,v_child_age,
      case when v_payload?'bed_configuration' then v_payload->'bed_configuration'
        when v_action='duplicate' then v_room.bed_configuration else '[]'::jsonb end,
      case when v_payload?'bathrooms' then (v_payload->>'bathrooms')::numeric
        when v_action='duplicate' then v_room.bathrooms else null end,
      case when v_payload?'size_sqm' then (v_payload->>'size_sqm')::numeric
        when v_action='duplicate' then v_room.size_sqm else null end,
      case when v_payload?'amenities' then array(select value#>>'{}' from jsonb_array_elements(v_payload->'amenities'))
        when v_action='duplicate' then v_room.amenities else '{}'::text[] end,v_mode,
      case when v_payload?'base_inventory_count' then (v_payload->>'base_inventory_count')::integer
        when v_action='duplicate' then v_room.base_inventory_count else 0 end,
      case when v_action='duplicate' then 'draft' else coalesce(v_payload->>'status','draft') end,
      case when v_payload?'sort_order' then (v_payload->>'sort_order')::integer
        when v_action='duplicate' then v_room.sort_order+1 else 1000 end
    ) returning to_jsonb(hotel_room_types.*) into v_after;
  elsif v_action='disable' then
    v_before:=to_jsonb(v_room);
    update public.hotel_room_types set status='disabled' where id=v_room_id and version=v_expected_version
    returning to_jsonb(hotel_room_types.*) into v_after;
  else
    v_before:=to_jsonb(v_room);
    update public.hotel_room_types set
      code=case when v_payload?'code' then lower(btrim(v_payload->>'code')) else code end,
      name_i18n=case when v_payload?'name_i18n' then v_payload->'name_i18n' else name_i18n end,
      description_i18n=case when v_payload?'description_i18n' then v_payload->'description_i18n' else description_i18n end,
      gallery=case when v_payload?'gallery' then v_payload->'gallery' else gallery end,
      capacity_adults=v_adults,capacity_children=v_children,max_occupancy=v_max,
      children_policy_override=v_child_policy,minimum_child_age_override=v_child_age,
      bed_configuration=case when v_payload?'bed_configuration' then v_payload->'bed_configuration' else bed_configuration end,
      bathrooms=case when v_payload?'bathrooms' then (v_payload->>'bathrooms')::numeric else bathrooms end,
      size_sqm=case when v_payload?'size_sqm' then (v_payload->>'size_sqm')::numeric else size_sqm end,
      amenities=case when v_payload?'amenities' then array(select value#>>'{}' from jsonb_array_elements(v_payload->'amenities')) else amenities end,
      inventory_mode=v_mode,
      base_inventory_count=case when v_payload?'base_inventory_count' then (v_payload->>'base_inventory_count')::integer else base_inventory_count end,
      status=case when v_payload?'status' then v_payload->>'status' else status end,
      sort_order=case when v_payload?'sort_order' then (v_payload->>'sort_order')::integer else sort_order end
    where id=v_room_id and hotel_id=v_hotel_id and version=v_expected_version
    returning to_jsonb(hotel_room_types.*) into v_after;
  end if;
  if v_after is null then raise exception using errcode='PT409',message='hotels_v2_h2b1_stale_room_type'; end if;
  insert into public.hotel_activity_log(hotel_id,entity_type,entity_id,action,before_state,after_state,actor_type,actor_id,source,correlation_id)
  values(v_hotel_id,'room_type',v_room_id,case when v_action='disable' then 'disable' else v_action end,
    v_before,v_after,'admin',auth.uid(),'hotels_v2_h2b1_room_type',p_correlation_id);
  return jsonb_build_object('correlation_id',p_correlation_id,'room_type_id',v_room_id,
    'workspace',public.hotel_v2_admin_get_property_workspace(v_hotel_id),
    'activity',(select coalesce(jsonb_agg(to_jsonb(activity) order by activity.created_at,activity.id),'[]'::jsonb)
      from public.hotel_activity_log activity where activity.correlation_id=p_correlation_id));
end
$function$;

-- This intentionally narrow RPC is the only H2B.1 path that reconstructs the
-- accepted 7 Arches legacy product. It derives the 63 schedule tiers from the
-- freshly locked property row, never from browser-supplied money.
create function public.hotel_v2_admin_prepare_legacy_shadow_rooms(
  p_plan jsonb,p_correlation_id uuid default gen_random_uuid()
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,auth
as $function$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_upper constant uuid:='b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
  c_ground constant uuid:='825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
  c_plan constant uuid:='22e47a63-a630-4fb6-8f43-816f2d3fdc17';
  c_upper_rate constant uuid:='7e420964-9cbf-4f1b-abd3-09840af5240f';
  c_ground_rate constant uuid:='3320590d-632d-423f-80d0-fd021cba7293';
  c_schedule constant uuid:='b0a3104f-7b31-5265-a59f-c2d166f11a23';
  c_party_preview constant uuid:='443065c0-984a-5de3-a22a-d03042c41107';
  v_hotel public.hotels%rowtype; v_room_json jsonb; v_room public.hotel_room_types%rowtype;
  v_before jsonb; v_after jsonb; v_expected jsonb; v_reviewed_at timestamptz;
  v_gallery_item jsonb; v_amenity text; v_existing_version bigint; v_rule jsonb;
  v_schedule_before jsonb; v_schedule_after jsonb; v_price_fingerprint text;
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_plan is null or jsonb_typeof(p_plan)<>'object' or p_correlation_id is null
     or not public.hotel_v2_h2a_keys_allowed(p_plan,array[
       'hotel_id','expected_property_updated_at','reviewed_at','source_contract',
       'expected_legacy_pricing_fingerprint','expected_versions','property_policy','rooms','prepare_pricing_preview'
     ]) or not (p_plan ?& array[
       'hotel_id','expected_property_updated_at','reviewed_at','source_contract',
       'expected_legacy_pricing_fingerprint','expected_versions','property_policy','rooms','prepare_pricing_preview'
     ]) or (p_plan->>'hotel_id')::uuid<>c_hotel
     or p_plan->>'source_contract'<>'seven_arches_two_apartments_v1'
     or coalesce((p_plan->>'prepare_pricing_preview')::boolean,false) is not true
     or jsonb_typeof(p_plan->'expected_versions')<>'object'
     or jsonb_typeof(p_plan->'rooms')<>'array' or jsonb_array_length(p_plan->'rooms')<>2 then
    raise exception using errcode='22023',message='hotels_v2_h2b1_invalid_shadow_plan';
  end if;
  v_reviewed_at:=(p_plan->>'reviewed_at')::timestamptz;
  if v_reviewed_at<clock_timestamp()-interval '30 minutes' or v_reviewed_at>clock_timestamp()+interval '5 minutes' then
    raise exception using errcode='22023',message='hotels_v2_h2b1_shadow_review_expired';
  end if;
  select * into v_hotel from public.hotels where id=c_hotel for update;
  if not found or v_hotel.architecture_version<>'legacy' then
    raise exception using errcode='55000',message='hotels_v2_h2b1_legacy_property_contract_mismatch';
  end if;
  if v_hotel.updated_at is distinct from (p_plan->>'expected_property_updated_at')::timestamptz then
    raise exception using errcode='PT409',message='hotels_v2_h2b1_stale_property';
  end if;
  if exists(select 1 from public.site_settings where id=1 and (hotel_rooms_v2_enabled
    or hotel_external_sync_enabled or hotel_instant_booking_enabled or hotel_stripe_connect_enabled)) then
    raise exception using errcode='55000',message='hotels_v2_h2b1_capability_flag_enabled';
  end if;
  if exists(select 1 from public.hotel_activity_log where correlation_id=p_correlation_id) then
    raise exception using errcode='23505',message='hotels_v2_h2b1_correlation_id_already_used';
  end if;
  if v_hotel.pricing_model is distinct from 'tiered_by_nights'
     or v_hotel.max_persons is distinct from 8
     or jsonb_typeof(v_hotel.photos) is distinct from 'array'
     or jsonb_array_length(v_hotel.photos)<>9
     or coalesce(v_hotel.description->>'en','') not like '%All apartments are air-conditioned%'
     or coalesce(v_hotel.description->>'en','') not like '%accepts children from 10 years old%'
     or coalesce(v_hotel.description->>'en','') not like '%For bookings above 4 people%2 apartments%'
     or not (coalesce(v_hotel.amenities,'[]'::jsonb)
       @> '["air_conditioning","terrace","balcony"]'::jsonb)
     or jsonb_typeof(v_hotel.pricing_tiers->'rules')<>'array'
     or jsonb_array_length(v_hotel.pricing_tiers->'rules')<>63
     or v_hotel.pricing_tiers->>'currency' is distinct from 'EUR' then
    raise exception using errcode='55000',message='hotels_v2_h2b1_legacy_source_contract_mismatch';
  end if;
  v_price_fingerprint:=md5(v_hotel.pricing_tiers::text);
  if p_plan->>'expected_legacy_pricing_fingerprint'<>v_price_fingerprint then
    raise exception using errcode='PT409',message='hotels_v2_h2b1_stale_legacy_pricing';
  end if;
  if v_hotel.children_policy is not null
     and (v_hotel.children_policy<>'minimum_age' or v_hotel.minimum_child_age<>10) then
    raise exception using errcode='55000',message='hotels_v2_h2b1_guest_policy_already_reviewed';
  end if;
  if exists(select 1 from public.hotel_room_types room_type
    where room_type.hotel_id=c_hotel and room_type.id not in (c_upper,c_ground)) then
    raise exception using errcode='PT409',message='hotels_v2_h2b1_unexpected_existing_room_type';
  end if;
  if (select count(*) from (
      select (rule->>'persons')::integer persons,(rule->>'min_nights')::integer nights,count(*)
      from jsonb_array_elements(v_hotel.pricing_tiers->'rules') rule
      group by 1,2 having count(*)<>1
    ) duplicate_rule)<>0
     or (select count(*) from jsonb_array_elements(v_hotel.pricing_tiers->'rules') rule
       where (rule->>'persons')::integer not between 2 and 8
          or (rule->>'min_nights')::integer not between 2 and 10
          or (rule->>'price_per_night')::numeric<0)<>0
     or (select count(distinct (rule->>'persons')::integer)*count(distinct (rule->>'min_nights')::integer)
       from jsonb_array_elements(v_hotel.pricing_tiers->'rules') rule)<>63 then
    raise exception using errcode='55000',message='hotels_v2_h2b1_legacy_pricing_grid_mismatch';
  end if;
  if not public.hotel_v2_h2b1_children_policy_valid(
    p_plan->'property_policy'->>'children_policy',
    case when p_plan->'property_policy'->>'minimum_child_age' is null then null else (p_plan->'property_policy'->>'minimum_child_age')::integer end,false
  ) or p_plan->'property_policy'->>'children_policy'<>'minimum_age'
     or (p_plan->'property_policy'->>'minimum_child_age')::integer<>10 then
    raise exception using errcode='22023',message='hotels_v2_h2b1_seven_arches_child_policy_mismatch';
  end if;
  v_expected:=p_plan->'expected_versions';
  if not public.hotel_v2_h2a_keys_allowed(v_expected,array[
    'upper_room','ground_room','pricing_schedule','property_party_preview','rate_plan','upper_room_rate','ground_room_rate'
  ]) or not (v_expected ?& array[
    'upper_room','ground_room','pricing_schedule','property_party_preview','rate_plan','upper_room_rate','ground_room_rate'
  ]) then raise exception using errcode='22023',message='hotels_v2_h2b1_invalid_expected_versions'; end if;
  if (select count(distinct (room_value->>'id')::uuid) from jsonb_array_elements(p_plan->'rooms') room_value)<>2
     or not exists(select 1 from jsonb_array_elements(p_plan->'rooms') room_value where (room_value->>'id')::uuid=c_upper)
     or not exists(select 1 from jsonb_array_elements(p_plan->'rooms') room_value where (room_value->>'id')::uuid=c_ground) then
    raise exception using errcode='22023',message='hotels_v2_h2b1_shadow_rooms_exact_set_required';
  end if;

  -- Validate and lock every exact target before the first write.
  for v_room_json in select value from jsonb_array_elements(p_plan->'rooms') loop
    if jsonb_typeof(v_room_json)<>'object'
       or not public.hotel_v2_h2a_keys_allowed(v_room_json,array[
         'id','expected_version','source_key','code','name_i18n','description_i18n','gallery','amenities','max_occupancy','sort_order'
       ]) or not (v_room_json ?& array['id','expected_version','source_key','code','name_i18n','gallery','amenities','max_occupancy'])
       or (v_room_json->>'id')::uuid not in (c_upper,c_ground)
       or coalesce(v_room_json->>'expected_version','') !~ '^[0-9]+$'
       or ((v_room_json->>'id')::uuid=c_upper and v_room_json->>'source_key'<>'upper_floor_apartment')
       or ((v_room_json->>'id')::uuid=c_ground and v_room_json->>'source_key'<>'ground_floor_apartment')
       or ((v_room_json->>'id')::uuid=c_upper and v_room_json->>'code'<>'upper-floor-apartment')
       or ((v_room_json->>'id')::uuid=c_ground and v_room_json->>'code'<>'ground-floor-apartment')
       or (v_room_json->>'max_occupancy')::integer<>4
       or not public.hotel_v2_h2a_i18n_is_valid(v_room_json->'name_i18n',true)
       or jsonb_typeof(v_room_json->'gallery')<>'array' or jsonb_array_length(v_room_json->'gallery')<1
       or (select count(*) from jsonb_array_elements(v_room_json->'gallery'))<>
          (select count(distinct value) from jsonb_array_elements(v_room_json->'gallery'))
       or jsonb_typeof(v_room_json->'amenities')<>'array' then
      raise exception using errcode='22023',message='hotels_v2_h2b1_invalid_shadow_room';
    end if;
    for v_gallery_item in select value from jsonb_array_elements(v_room_json->'gallery') loop
      if not exists(select 1 from jsonb_array_elements(coalesce(v_hotel.photos,'[]'::jsonb)) property_photo where property_photo.value=v_gallery_item) then
        raise exception using errcode='23514',message='hotels_v2_h2b1_room_photo_not_in_property_gallery';
      end if;
    end loop;
    for v_amenity in select value#>>'{}' from jsonb_array_elements(v_room_json->'amenities') loop
      if not exists(select 1 from public.hotel_amenities where code=v_amenity and is_active) then
        raise exception using errcode='23503',message='hotels_v2_h2b1_unknown_room_amenity';
      end if;
    end loop;
    if not (v_room_json->'amenities' @> '["air_conditioning"]'::jsonb)
       or not (v_room_json->'amenities' @> '["terrace"]'::jsonb)
       or ((v_room_json->>'id')::uuid=c_upper and not (v_room_json->'amenities' @> '["balcony"]'::jsonb))
       or ((v_room_json->>'id')::uuid=c_ground and (v_room_json->'amenities' @> '["balcony"]'::jsonb))
       or ((v_room_json->>'id')::uuid=c_upper and jsonb_array_length(v_room_json->'amenities')<>3)
       or ((v_room_json->>'id')::uuid=c_ground and jsonb_array_length(v_room_json->'amenities')<>2) then
      raise exception using errcode='23514',message='hotels_v2_h2b1_confirmed_room_amenity_mismatch';
    end if;
    select * into v_room from public.hotel_room_types where id=(v_room_json->>'id')::uuid for update;
    v_existing_version:=case when (v_room_json->>'id')::uuid=c_upper then (v_expected->>'upper_room')::bigint else (v_expected->>'ground_room')::bigint end;
    if (v_room_json->>'expected_version')::bigint<>v_existing_version then
      raise exception using errcode='PT409',message='hotels_v2_h2b1_room_expected_version_mismatch';
    end if;
    if found then
      if v_room.hotel_id<>c_hotel or v_room.legacy_source_key<>v_room_json->>'source_key'
         or v_room.code<>v_room_json->>'code' or v_room.version<>v_existing_version
         or v_room.max_occupancy<>4 or v_room.capacity_adults is not null or v_room.capacity_children is not null
         or v_room.inventory_mode<>'pooled' or v_room.base_inventory_count<>1
         or cardinality(v_room.amenities)<>jsonb_array_length(v_room_json->'amenities')
         or not (v_room.amenities @> array(select value#>>'{}' from jsonb_array_elements(v_room_json->'amenities'))) then
        raise exception using errcode='PT409',message='hotels_v2_h2b1_stale_shadow_room';
      end if;
    elsif v_existing_version<>0 or exists(select 1 from public.hotel_room_types where hotel_id=c_hotel and legacy_source_key=v_room_json->>'source_key') then
      raise exception using errcode='PT409',message='hotels_v2_h2b1_shadow_room_identity_conflict';
    end if;
  end loop;

  perform 1 from public.hotel_pricing_schedules where id=c_schedule for update;
  if found then
    if (select hotel_id from public.hotel_pricing_schedules where id=c_schedule)<>c_hotel
       or (select version from public.hotel_pricing_schedules where id=c_schedule)<>(v_expected->>'pricing_schedule')::bigint
       or (select code from public.hotel_pricing_schedules where id=c_schedule)<>'shared-apartment-occupancy-los'
       or (select application_scope from public.hotel_pricing_schedules where id=c_schedule)<>'room_occupancy'
       or (select source from public.hotel_pricing_schedules where id=c_schedule)<>'legacy_preview'
       or (select maximum_party_size from public.hotel_pricing_schedules where id=c_schedule)<>4
       or (select is_active from public.hotel_pricing_schedules where id=c_schedule)
       or (select review_status from public.hotel_pricing_schedules where id=c_schedule)<>'requires_review'
       or (select source_reference->>'pricing_fingerprint' from public.hotel_pricing_schedules where id=c_schedule)<>v_price_fingerprint
       or exists(
         (select (rule->>'persons')::smallint,(rule->>'min_nights')::integer,(rule->>'price_per_night')::numeric
          from jsonb_array_elements(v_hotel.pricing_tiers->'rules') rule where (rule->>'persons')::integer between 2 and 4
          except
          select tier.guest_count,tier.threshold_nights,tier.nightly_rate
          from public.hotel_pricing_schedule_occupancy_tiers tier where tier.schedule_id=c_schedule and tier.is_active)
         union all
         (select tier.guest_count,tier.threshold_nights,tier.nightly_rate
          from public.hotel_pricing_schedule_occupancy_tiers tier where tier.schedule_id=c_schedule and tier.is_active
          except
          select (rule->>'persons')::smallint,(rule->>'min_nights')::integer,(rule->>'price_per_night')::numeric
          from jsonb_array_elements(v_hotel.pricing_tiers->'rules') rule where (rule->>'persons')::integer between 2 and 4)
       ) then
      raise exception using errcode='PT409',message='hotels_v2_h2b1_stale_pricing_schedule'; end if;
  elsif (v_expected->>'pricing_schedule')::bigint<>0 then raise exception using errcode='PT409',message='hotels_v2_h2b1_pricing_schedule_missing'; end if;
  perform 1 from public.hotel_pricing_schedules where id=c_party_preview for update;
  if found then
    if (select hotel_id from public.hotel_pricing_schedules where id=c_party_preview)<>c_hotel
       or (select version from public.hotel_pricing_schedules where id=c_party_preview)<>(v_expected->>'property_party_preview')::bigint
       or (select code from public.hotel_pricing_schedules where id=c_party_preview)<>'legacy-property-party-preview'
       or (select application_scope from public.hotel_pricing_schedules where id=c_party_preview)<>'property_booking_party'
       or (select source from public.hotel_pricing_schedules where id=c_party_preview)<>'legacy_preview'
       or (select maximum_party_size from public.hotel_pricing_schedules where id=c_party_preview)<>8
       or (select is_active from public.hotel_pricing_schedules where id=c_party_preview)
       or (select review_status from public.hotel_pricing_schedules where id=c_party_preview)<>'requires_review'
       or (select source_reference->>'pricing_fingerprint' from public.hotel_pricing_schedules where id=c_party_preview)<>v_price_fingerprint
       or exists(
         (select (rule->>'persons')::smallint,(rule->>'min_nights')::integer,(rule->>'price_per_night')::numeric
          from jsonb_array_elements(v_hotel.pricing_tiers->'rules') rule
          except
          select tier.guest_count,tier.threshold_nights,tier.nightly_rate
          from public.hotel_pricing_schedule_occupancy_tiers tier where tier.schedule_id=c_party_preview and tier.is_active)
         union all
         (select tier.guest_count,tier.threshold_nights,tier.nightly_rate
          from public.hotel_pricing_schedule_occupancy_tiers tier where tier.schedule_id=c_party_preview and tier.is_active
          except
          select (rule->>'persons')::smallint,(rule->>'min_nights')::integer,(rule->>'price_per_night')::numeric
          from jsonb_array_elements(v_hotel.pricing_tiers->'rules') rule)
       ) then
      raise exception using errcode='PT409',message='hotels_v2_h2b1_stale_property_party_preview'; end if;
  elsif (v_expected->>'property_party_preview')::bigint<>0 then raise exception using errcode='PT409',message='hotels_v2_h2b1_property_party_preview_missing'; end if;
  perform 1 from public.hotel_rate_plans where id=c_plan for update;
  if found then
    if (select hotel_id from public.hotel_rate_plans where id=c_plan)<>c_hotel
       or (select version from public.hotel_rate_plans where id=c_plan)<>(v_expected->>'rate_plan')::bigint
       or (select code from public.hotel_rate_plans where id=c_plan)<>'standard'
       or (select is_active from public.hotel_rate_plans where id=c_plan)
       or (select cancellation_policy->>'type' from public.hotel_rate_plans where id=c_plan)<>'requires_review'
       or (select cancellation_policy->>'reason' from public.hotel_rate_plans where id=c_plan)<>'legacy_cancellation_terms_unconfirmed' then
      raise exception using errcode='PT409',message='hotels_v2_h2b1_stale_rate_plan'; end if;
  elsif (v_expected->>'rate_plan')::bigint<>0 then raise exception using errcode='PT409',message='hotels_v2_h2b1_rate_plan_missing'; end if;
  perform 1 from public.hotel_room_rates where id=c_upper_rate for update;
  if found then
    if (select hotel_id from public.hotel_room_rates where id=c_upper_rate)<>c_hotel
       or (select version from public.hotel_room_rates where id=c_upper_rate)<>(v_expected->>'upper_room_rate')::bigint
       or (select room_type_id from public.hotel_room_rates where id=c_upper_rate)<>c_upper
       or (select rate_plan_id from public.hotel_room_rates where id=c_upper_rate)<>c_plan
       or (select pricing_schedule_id from public.hotel_room_rates where id=c_upper_rate)<>c_schedule
       or (select base_nightly_rate from public.hotel_room_rates where id=c_upper_rate)<>0
       or (select currency from public.hotel_room_rates where id=c_upper_rate)<>'EUR'
       or (select is_active from public.hotel_room_rates where id=c_upper_rate) then
      raise exception using errcode='PT409',message='hotels_v2_h2b1_stale_upper_room_rate'; end if;
  elsif (v_expected->>'upper_room_rate')::bigint<>0 then raise exception using errcode='PT409',message='hotels_v2_h2b1_upper_room_rate_missing'; end if;
  perform 1 from public.hotel_room_rates where id=c_ground_rate for update;
  if found then
    if (select hotel_id from public.hotel_room_rates where id=c_ground_rate)<>c_hotel
       or (select version from public.hotel_room_rates where id=c_ground_rate)<>(v_expected->>'ground_room_rate')::bigint
       or (select room_type_id from public.hotel_room_rates where id=c_ground_rate)<>c_ground
       or (select rate_plan_id from public.hotel_room_rates where id=c_ground_rate)<>c_plan
       or (select pricing_schedule_id from public.hotel_room_rates where id=c_ground_rate)<>c_schedule
       or (select base_nightly_rate from public.hotel_room_rates where id=c_ground_rate)<>0
       or (select currency from public.hotel_room_rates where id=c_ground_rate)<>'EUR'
       or (select is_active from public.hotel_room_rates where id=c_ground_rate) then
      raise exception using errcode='PT409',message='hotels_v2_h2b1_stale_ground_room_rate'; end if;
  elsif (v_expected->>'ground_room_rate')::bigint<>0 then raise exception using errcode='PT409',message='hotels_v2_h2b1_ground_room_rate_missing'; end if;

  select to_jsonb(hotel) into v_before from public.hotels hotel where id=c_hotel;
  if v_hotel.children_policy is null then
    update public.hotels set children_policy='minimum_age',minimum_child_age=10
    where id=c_hotel and updated_at=v_hotel.updated_at returning to_jsonb(hotels.*) into v_after;
    if v_after is null then raise exception using errcode='PT409',message='hotels_v2_h2b1_stale_property'; end if;
    insert into public.hotel_activity_log(hotel_id,entity_type,entity_id,action,before_state,after_state,actor_type,actor_id,source,correlation_id)
    values(c_hotel,'property',c_hotel,'update',v_before,v_after,'admin',auth.uid(),'hotels_v2_h2b1_shadow_prepare',p_correlation_id);
  end if;

  for v_room_json in select value from jsonb_array_elements(p_plan->'rooms') loop
    select to_jsonb(room_type) into v_before from public.hotel_room_types room_type where id=(v_room_json->>'id')::uuid;
    insert into public.hotel_room_types(
      id,hotel_id,code,name_i18n,description_i18n,gallery,capacity_adults,capacity_children,max_occupancy,
      bed_configuration,bathrooms,size_sqm,amenities,inventory_mode,base_inventory_count,status,sort_order,
      children_policy_override,minimum_child_age_override,legacy_source_key
    ) values(
      (v_room_json->>'id')::uuid,c_hotel,lower(btrim(v_room_json->>'code')),v_room_json->'name_i18n',
      coalesce(v_room_json->'description_i18n','{}'::jsonb),v_room_json->'gallery',null,null,4,
      '[]'::jsonb,null,null,array(select value#>>'{}' from jsonb_array_elements(v_room_json->'amenities')),
      'pooled',1,'draft',coalesce((v_room_json->>'sort_order')::integer,1000),null,null,v_room_json->>'source_key'
    ) on conflict(id) do update set
      code=excluded.code,name_i18n=excluded.name_i18n,description_i18n=excluded.description_i18n,
      gallery=excluded.gallery,capacity_adults=null,capacity_children=null,max_occupancy=4,
      amenities=excluded.amenities,inventory_mode='pooled',base_inventory_count=1,sort_order=excluded.sort_order
    returning to_jsonb(hotel_room_types.*) into v_after;
    insert into public.hotel_activity_log(hotel_id,entity_type,entity_id,action,before_state,after_state,actor_type,actor_id,source,correlation_id)
    values(c_hotel,'room_type',(v_room_json->>'id')::uuid,case when v_before is null then 'create' else 'update' end,
      v_before,v_after,'admin',auth.uid(),'hotels_v2_h2b1_shadow_prepare',p_correlation_id);
  end loop;

  select to_jsonb(schedule) into v_schedule_before from public.hotel_pricing_schedules schedule where id=c_schedule;
  if v_schedule_before is null then
    insert into public.hotel_pricing_schedules(
      id,hotel_id,code,name_i18n,application_scope,currency,maximum_party_size,is_active,review_status,source,source_reference
    ) values(
      c_schedule,c_hotel,'shared-apartment-occupancy-los',
      jsonb_build_object('pl','Wspólny cennik apartamentu','en','Shared apartment pricing','he','תמחור דירה משותף'),
      'room_occupancy','EUR',4,false,'requires_review','legacy_preview',
      jsonb_build_object('pricing_model',v_hotel.pricing_model,'pricing_fingerprint',v_price_fingerprint,'rule_count',27,
        'guest_counts',jsonb_build_array(2,3,4),'migration_blocker','requires_h3_shared_schedule_resolution')
    ) returning to_jsonb(hotel_pricing_schedules.*) into v_schedule_after;
    for v_rule in select value from jsonb_array_elements(v_hotel.pricing_tiers->'rules') loop
      continue when (v_rule->>'persons')::integer>4;
      insert into public.hotel_pricing_schedule_occupancy_tiers(
        id,schedule_id,guest_count,threshold_nights,nightly_rate,is_active
      ) values(
        md5(c_schedule::text||':'||(v_rule->>'persons')||':'||(v_rule->>'min_nights'))::uuid,c_schedule,
        (v_rule->>'persons')::smallint,(v_rule->>'min_nights')::integer,(v_rule->>'price_per_night')::numeric,true
      );
    end loop;
    insert into public.hotel_activity_log(hotel_id,entity_type,entity_id,action,before_state,after_state,actor_type,actor_id,source,correlation_id)
    values(c_hotel,'pricing_schedule',c_schedule,'create',null,
      v_schedule_after||jsonb_build_object('tier_count',27),'admin',auth.uid(),'hotels_v2_h2b1_shadow_prepare',p_correlation_id);
  end if;

  select to_jsonb(schedule) into v_schedule_before from public.hotel_pricing_schedules schedule where id=c_party_preview;
  if v_schedule_before is null then
    insert into public.hotel_pricing_schedules(
      id,hotel_id,code,name_i18n,application_scope,currency,maximum_party_size,is_active,review_status,source,source_reference
    ) values(
      c_party_preview,c_hotel,'legacy-property-party-preview',
      jsonb_build_object('pl','Pełny cennik legacy','en','Full legacy pricing preview','he','תצוגת תמחור מורשת מלאה'),
      'property_booking_party','EUR',8,false,'requires_review','legacy_preview',
      jsonb_build_object('pricing_model',v_hotel.pricing_model,'pricing_fingerprint',v_price_fingerprint,'rule_count',63,
        'migration_blocker','requires_h3_multi_room_allocation')
    ) returning to_jsonb(hotel_pricing_schedules.*) into v_schedule_after;
    for v_rule in select value from jsonb_array_elements(v_hotel.pricing_tiers->'rules') loop
      insert into public.hotel_pricing_schedule_occupancy_tiers(
        id,schedule_id,guest_count,threshold_nights,nightly_rate,is_active
      ) values(
        md5(c_party_preview::text||':'||(v_rule->>'persons')||':'||(v_rule->>'min_nights'))::uuid,c_party_preview,
        (v_rule->>'persons')::smallint,(v_rule->>'min_nights')::integer,(v_rule->>'price_per_night')::numeric,true
      );
    end loop;
    insert into public.hotel_activity_log(hotel_id,entity_type,entity_id,action,before_state,after_state,actor_type,actor_id,source,correlation_id)
    values(c_hotel,'pricing_schedule',c_party_preview,'create',null,
      v_schedule_after||jsonb_build_object('tier_count',63),'admin',auth.uid(),'hotels_v2_h2b1_shadow_prepare',p_correlation_id);
  end if;

  select to_jsonb(rate_plan) into v_before from public.hotel_rate_plans rate_plan where id=c_plan;
  if v_before is null then
    insert into public.hotel_rate_plans(id,hotel_id,code,name_i18n,description_i18n,cancellation_policy,is_active,sort_order)
    values(c_plan,c_hotel,'standard',jsonb_build_object('pl','Standard','en','Standard','he','סטנדרטי'),'{}'::jsonb,
      jsonb_build_object('type','requires_review','reason','legacy_cancellation_terms_unconfirmed',
        'summary_i18n',jsonb_build_object('pl','Warunki anulowania wymagają potwierdzenia','en','Cancellation terms require confirmation','he','תנאי הביטול דורשים אישור')),
      false,100)
    returning to_jsonb(hotel_rate_plans.*) into v_after;
    insert into public.hotel_activity_log(hotel_id,entity_type,entity_id,action,before_state,after_state,actor_type,actor_id,source,correlation_id)
    values(c_hotel,'rate_plan',c_plan,'create',null,v_after,
      'admin',auth.uid(),'hotels_v2_h2b1_shadow_prepare',p_correlation_id);
  end if;

  for v_room_json in select * from jsonb_array_elements(jsonb_build_array(
    jsonb_build_object('id',c_upper_rate,'room_id',c_upper),jsonb_build_object('id',c_ground_rate,'room_id',c_ground)
  )) loop
    select to_jsonb(room_rate) into v_before from public.hotel_room_rates room_rate where id=(v_room_json->>'id')::uuid;
    if v_before is null then
      insert into public.hotel_room_rates(
        id,hotel_id,room_type_id,rate_plan_id,base_nightly_rate,currency,is_active,sort_order,pricing_schedule_id
      ) values((v_room_json->>'id')::uuid,c_hotel,(v_room_json->>'room_id')::uuid,c_plan,0,'EUR',false,100,c_schedule)
      returning to_jsonb(hotel_room_rates.*) into v_after;
      insert into public.hotel_activity_log(hotel_id,entity_type,entity_id,action,before_state,after_state,actor_type,actor_id,source,correlation_id)
      values(c_hotel,'room_rate',(v_room_json->>'id')::uuid,'create',null,
        v_after,'admin',auth.uid(),'hotels_v2_h2b1_shadow_prepare',p_correlation_id);
    end if;
  end loop;

  -- Money is copied only from the freshly locked legacy source. Validate the
  -- complete values, not merely the expected 27/63 counts, before returning.
  if exists(
      (select (rule->>'persons')::smallint,(rule->>'min_nights')::integer,(rule->>'price_per_night')::numeric
       from jsonb_array_elements(v_hotel.pricing_tiers->'rules') rule where (rule->>'persons')::integer between 2 and 4
       except
       select tier.guest_count,tier.threshold_nights,tier.nightly_rate
       from public.hotel_pricing_schedule_occupancy_tiers tier where tier.schedule_id=c_schedule and tier.is_active)
      union all
      (select tier.guest_count,tier.threshold_nights,tier.nightly_rate
       from public.hotel_pricing_schedule_occupancy_tiers tier where tier.schedule_id=c_schedule and tier.is_active
       except
       select (rule->>'persons')::smallint,(rule->>'min_nights')::integer,(rule->>'price_per_night')::numeric
       from jsonb_array_elements(v_hotel.pricing_tiers->'rules') rule where (rule->>'persons')::integer between 2 and 4)
    ) or exists(
      (select (rule->>'persons')::smallint,(rule->>'min_nights')::integer,(rule->>'price_per_night')::numeric
       from jsonb_array_elements(v_hotel.pricing_tiers->'rules') rule
       except
       select tier.guest_count,tier.threshold_nights,tier.nightly_rate
       from public.hotel_pricing_schedule_occupancy_tiers tier where tier.schedule_id=c_party_preview and tier.is_active)
      union all
      (select tier.guest_count,tier.threshold_nights,tier.nightly_rate
       from public.hotel_pricing_schedule_occupancy_tiers tier where tier.schedule_id=c_party_preview and tier.is_active
       except
       select (rule->>'persons')::smallint,(rule->>'min_nights')::integer,(rule->>'price_per_night')::numeric
       from jsonb_array_elements(v_hotel.pricing_tiers->'rules') rule)
    ) then
    raise exception using errcode='55000',message='hotels_v2_h2b1_shadow_tier_value_mismatch';
  end if;

  return jsonb_build_object(
    'correlation_id',p_correlation_id,'hotel_id',c_hotel,
    'room_type_ids',jsonb_build_array(c_upper,c_ground),'rate_plan_id',c_plan,
    'room_rate_ids',jsonb_build_array(c_upper_rate,c_ground_rate),'pricing_schedule_id',c_schedule,
    'pricing_schedule_tier_count',27,'property_party_preview_id',c_party_preview,
    'property_party_preview_tier_count',63,'public_change',false,
    'workspace',public.hotel_v2_admin_get_property_workspace(c_hotel),
    'activity',(select coalesce(jsonb_agg(to_jsonb(activity) order by activity.created_at,activity.id),'[]'::jsonb)
      from public.hotel_activity_log activity where activity.correlation_id=p_correlation_id)
  );
end
$function$;

do $h2b1_activity_contract$
declare v_entity text;
begin
  select pg_get_constraintdef(oid,true) into v_entity from pg_constraint
  where conrelid='public.hotel_activity_log'::regclass and conname='hotel_activity_log_entity_type_check';
  if v_entity is null or v_entity not like '%occupancy_tier%' or v_entity like '%pricing_schedule%' then
    raise exception using errcode='23514',message='hotels_v2_h2b1_activity_contract_mismatch'; end if;
end
$h2b1_activity_contract$;
alter table public.hotel_activity_log drop constraint hotel_activity_log_entity_type_check,
  add constraint hotel_activity_log_entity_type_check check(entity_type in(
    'property','room_type','unit','rate_plan','room_rate','rate_rule','calendar_override',
    'daily_inventory','occupancy_tier','pricing_schedule'
  ));

revoke all on function public.hotel_v2_admin_apply_guest_policy_plan(jsonb,uuid) from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_apply_room_type_plan(jsonb,uuid) from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function public.hotel_v2_admin_apply_guest_policy_plan(jsonb,uuid) to authenticated;
grant execute on function public.hotel_v2_admin_apply_room_type_plan(jsonb,uuid) to authenticated;
grant execute on function public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid) to authenticated;

do $h2b1_postconditions$
declare
  v_snapshot hotels_v2_h2b1_protected_snapshot%rowtype;
  v_count bigint; v_fingerprint text; v_expected_count bigint; v_expected_fingerprint text;
begin
  if exists(select 1 from public.site_settings where hotel_rooms_v2_enabled or hotel_external_sync_enabled
    or hotel_instant_booking_enabled or hotel_stripe_connect_enabled)
     or exists(select 1 from public.hotels where architecture_version<>'legacy')
     or exists(select 1 from public.hotel_room_types where legacy_source_key is not null)
     or exists(select 1 from public.hotel_pricing_schedules)
     or exists(select 1 from public.hotel_pricing_schedule_occupancy_tiers) then
    raise exception using errcode='55000',message='hotels_v2_h2b1_inert_postcondition_failed';
  end if;
  for v_snapshot in select * from hotels_v2_h2b1_protected_snapshot where relation_name<>'hotels' loop
    if v_snapshot.relation_name='hotel_room_types' then
      select count(*),md5(coalesce(string_agg((to_jsonb(row_value)
        -'max_occupancy'-'children_policy_override'-'minimum_child_age_override'-'legacy_source_key')::text,'|' order by row_value.id),''))
      into v_count,v_fingerprint from public.hotel_room_types row_value;
    elsif v_snapshot.relation_name='hotel_room_rates' then
      select count(*),md5(coalesce(string_agg((to_jsonb(row_value)-'pricing_schedule_id')::text,'|' order by row_value.id),''))
      into v_count,v_fingerprint from public.hotel_room_rates row_value;
    else
      execute format('select count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,''|'' order by row_value.id),'''')) from public.%I row_value',v_snapshot.relation_name)
        into v_count,v_fingerprint;
    end if;
    if v_count<>v_snapshot.row_count or v_fingerprint<>v_snapshot.fingerprint then
      raise exception using errcode='55000',message='hotels_v2_h2b1_protected_rows_changed',detail=v_snapshot.relation_name; end if;
  end loop;
  -- Added columns necessarily alter to_jsonb(hotels); protected legacy values
  -- are checked by excluding only the two new metadata columns.
  select count(*),md5(coalesce(string_agg((to_jsonb(hotel)-'children_policy'-'minimum_child_age')::text,'|' order by hotel.id),''))
    into v_count,v_fingerprint from public.hotels hotel;
  select row_count,fingerprint into v_expected_count,v_expected_fingerprint
  from hotels_v2_h2b1_protected_snapshot where relation_name='hotels';
  if v_count<>v_expected_count or v_fingerprint<>v_expected_fingerprint then
    raise exception using errcode='55000',message='hotels_v2_h2b1_hotel_values_changed'; end if;
  if not exists(select 1 from pg_proc where oid='public.hotel_v2_admin_resolve_rate(uuid,date,date,integer)'::regprocedure
      and prosecdef and coalesce(proconfig,'{}'::text[]) @> array['search_path=pg_catalog, public, auth']::text[])
     or not has_function_privilege('authenticated','public.hotel_v2_admin_resolve_rate(uuid,date,date,integer)','EXECUTE')
     or has_function_privilege('anon','public.hotel_v2_admin_resolve_rate(uuid,date,date,integer)','EXECUTE')
     or has_function_privilege('service_role','public.hotel_v2_admin_resolve_rate(uuid,date,date,integer)','EXECUTE') then
    raise exception using errcode='55000',message='hotels_v2_h2b1_resolver_security_mismatch'; end if;
  if not exists(select 1 from pg_proc
      where oid='public.hotel_v2_admin_apply_calendar_plan(jsonb,uuid)'::regprocedure
        and prosecdef and coalesce(proconfig,'{}'::text[]) @> array['search_path=pg_catalog, public, auth']::text[]
        and lower(pg_get_functiondef(oid)) like '%when serialization_failure%'
        and lower(pg_get_functiondef(oid)) like '%errcode=''pt409''%')
     or not exists(select 1 from pg_proc
      where oid='public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid)'::regprocedure
        and prosecdef and coalesce(proconfig,'{}'::text[]) @> array['search_path=pg_catalog, public, auth']::text[]
        and lower(pg_get_functiondef(oid)) like '%when serialization_failure%'
        and lower(pg_get_functiondef(oid)) like '%errcode=''pt409''%')
     or not has_function_privilege('authenticated','public.hotel_v2_admin_apply_calendar_plan(jsonb,uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid)','EXECUTE')
     or has_function_privilege('anon','public.hotel_v2_admin_apply_calendar_plan(jsonb,uuid)','EXECUTE')
     or has_function_privilege('anon','public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid)','EXECUTE')
     or has_function_privilege('service_role','public.hotel_v2_admin_apply_calendar_plan(jsonb,uuid)','EXECUTE')
     or has_function_privilege('service_role','public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid)','EXECUTE')
     or has_function_privilege('anon','public.hotel_v2_admin_apply_calendar_plan_h2b1_core(jsonb,uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.hotel_v2_admin_apply_calendar_plan_h2b1_core(jsonb,uuid)','EXECUTE')
     or has_function_privilege('service_role','public.hotel_v2_admin_apply_calendar_plan_h2b1_core(jsonb,uuid)','EXECUTE')
     or has_function_privilege('anon','public.hotel_v2_admin_apply_workspace_plan_h2b1_core(jsonb,uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.hotel_v2_admin_apply_workspace_plan_h2b1_core(jsonb,uuid)','EXECUTE')
     or has_function_privilege('service_role','public.hotel_v2_admin_apply_workspace_plan_h2b1_core(jsonb,uuid)','EXECUTE') then
    raise exception using errcode='55000',message='hotels_v2_h2b1_transport_wrapper_security_mismatch'; end if;
  if not exists(select 1 from pg_constraint where conrelid='public.hotel_rate_plans'::regclass
      and conname='hotel_rate_plans_h2b1_review_activation_check')
     or not exists(select 1 from pg_constraint where conrelid='public.hotel_room_rates'::regclass
      and conname='hotel_room_rates_h2b1_schedule_inert_check')
     or not exists(select 1 from pg_proc where oid='public.hotel_v2_h2a_readiness(uuid)'::regprocedure
      and prosecdef and coalesce(proconfig,'{}'::text[]) @> array['search_path=pg_catalog, public']::text[]
      and pg_get_functiondef(oid) like '%unreviewed_children_policy%'
      and pg_get_functiondef(oid) like '%unreviewed_cancellation_policy%'
      and pg_get_functiondef(oid) like '%h2b1_schedule_product_not_executable%')
     or has_function_privilege('anon','public.hotel_v2_h2a_readiness(uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.hotel_v2_h2a_readiness(uuid)','EXECUTE')
     or has_function_privilege('service_role','public.hotel_v2_h2a_readiness(uuid)','EXECUTE')
     or has_function_privilege('anon','public.hotel_v2_h2a_readiness_h2b_core(uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.hotel_v2_h2a_readiness_h2b_core(uuid)','EXECUTE')
     or has_function_privilege('service_role','public.hotel_v2_h2a_readiness_h2b_core(uuid)','EXECUTE') then
    raise exception using errcode='55000',message='hotels_v2_h2b1_readiness_security_mismatch'; end if;
end
$h2b1_postconditions$;

commit;
