begin;
set transaction isolation level repeatable read;

-- Hotels 2.0 H2B calendar/rates foundation. This migration is additive and
-- inert: it seeds no Hotel V2 data, changes no legacy Hotel row and leaves all
-- Hotels V2 capability flags disabled.

-- Serialize capability-state changes with this foundation deployment. A
-- concurrent flag toggle cannot commit between the pre/post checks.
lock table public.site_settings in share row exclusive mode;

do $h2b_preconditions$
begin
  if to_regclass('public.hotel_room_types') is null
     or to_regclass('public.hotel_room_rates') is null
     or to_regclass('public.hotel_rate_rules') is null
     or to_regclass('public.hotel_daily_inventory') is null
     or to_regclass('public.hotel_daily_rates') is null
     or to_regclass('public.hotel_activity_log') is null
     or to_regprocedure('public.hotel_v2_h2a_require_admin()') is null
     or to_regprocedure('public.hotel_v2_h2a_keys_allowed(jsonb,text[])') is null
     or to_regprocedure('public.hotel_v2_admin_get_property_workspace(uuid)') is null then
    raise exception using errcode = '55000', message = 'hotels_v2_h2b_h1a_h2a_prerequisite_missing';
  end if;

  if to_regclass('public.hotel_calendar_overrides') is not null
     or to_regclass('public.hotel_room_rate_occupancy_tiers') is not null
     or to_regprocedure('public.hotel_v2_admin_resolve_rate(uuid,date,date,integer)') is not null
     or to_regprocedure('public.hotel_v2_admin_get_calendar(uuid,date,date)') is not null
     or to_regprocedure('public.hotel_v2_admin_apply_calendar_plan(jsonb,uuid)') is not null
     or to_regprocedure('public.hotel_v2_h2b_validate_occupancy_tier_contract()') is not null
     or to_regprocedure('public.hotel_v2_h2b_guard_room_capacity_against_tiers()') is not null
     or exists(select 1 from pg_trigger where tgname in (
       'hotel_room_rate_occupancy_tiers_capacity_guard','hotel_room_types_occupancy_tier_capacity_guard'
     ) and not tgisinternal)
     or exists(select 1 from pg_constraint where conrelid='public.hotel_rate_rules'::regclass
       and conname='hotel_rate_rules_weekdays_unique_check') then
    raise exception using errcode = '42P07', message = 'hotels_v2_h2b_objects_already_exist';
  end if;

  if (select count(*) from public.site_settings) <> 1
     or not exists (select 1 from public.site_settings where id = 1) then
    raise exception using errcode = '55000', message = 'hotels_v2_h2b_site_settings_singleton_mismatch';
  end if;

  if exists (
    select 1 from public.site_settings setting
    where setting.hotel_rooms_v2_enabled
       or setting.hotel_external_sync_enabled
       or setting.hotel_instant_booking_enabled
       or setting.hotel_stripe_connect_enabled
  ) then
    raise exception using errcode = '55000', message = 'hotels_v2_h2b_capability_flag_enabled';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.hotel_rate_rules'::regclass
      and tgname = 'hotel_rate_rules_set_updated_at_and_version'
      and not tgisinternal
      and tgfoid = 'public.hotel_v2_set_updated_at_and_version()'::regprocedure
  ) then
    raise exception using errcode = '55000', message = 'hotels_v2_h2b_version_trigger_prerequisite_missing';
  end if;
end
$h2b_preconditions$;

create temporary table hotels_v2_h2b_protected_snapshot (
  relation_name text primary key,
  row_count bigint not null,
  fingerprint text not null
) on commit drop;

insert into hotels_v2_h2b_protected_snapshot(relation_name, row_count, fingerprint)
select 'hotels', count(*), md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), '')) from public.hotels row_value
union all select 'hotel_bookings', count(*), md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), '')) from public.hotel_bookings row_value
union all select 'partner_service_fulfillments', count(*), md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), '')) from public.partner_service_fulfillments row_value
union all select 'hotel_room_types', count(*), md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), '')) from public.hotel_room_types row_value
union all select 'hotel_room_rates', count(*), md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), '')) from public.hotel_room_rates row_value
union all select 'hotel_rate_rules', count(*), md5(coalesce(string_agg(jsonb_build_object(
  'id',row_value.id,'room_rate_id',row_value.room_rate_id,'valid_from',row_value.valid_from,
  'valid_to',row_value.valid_to,'weekdays',row_value.weekdays,'nightly_rate',row_value.nightly_rate,
  'minimum_stay',row_value.minimum_stay,'maximum_stay',row_value.maximum_stay,
  'closed_to_arrival',row_value.closed_to_arrival,'closed_to_departure',row_value.closed_to_departure,
  'priority',row_value.priority,'is_active',row_value.is_active,'version',row_value.version,
  'created_at',row_value.created_at,'updated_at',row_value.updated_at
)::text, '|' order by row_value.id), '')) from public.hotel_rate_rules row_value
union all select 'hotel_daily_inventory', count(*), md5(coalesce(string_agg(jsonb_build_object(
  'room_type_id',row_value.room_type_id,'stay_date',row_value.stay_date,
  'sellable_units',row_value.sellable_units,'closed',row_value.closed,
  'source_timestamp',row_value.source_timestamp,'provenance',row_value.provenance,
  'version',row_value.version,'updated_at',row_value.updated_at
)::text, '|' order by row_value.room_type_id, row_value.stay_date), '')) from public.hotel_daily_inventory row_value
union all select 'hotel_daily_rates', count(*), md5(coalesce(string_agg(jsonb_build_object(
  'room_rate_id',row_value.room_rate_id,'stay_date',row_value.stay_date,'nightly_rate',row_value.nightly_rate,
  'minimum_stay',row_value.minimum_stay,'maximum_stay',row_value.maximum_stay,'closed',row_value.closed,
  'closed_to_arrival',row_value.closed_to_arrival,'closed_to_departure',row_value.closed_to_departure,
  'source_timestamp',row_value.source_timestamp,'provenance',row_value.provenance,
  'version',row_value.version,'updated_at',row_value.updated_at
)::text, '|' order by row_value.room_rate_id, row_value.stay_date), '')) from public.hotel_daily_rates row_value
union all select 'hotel_activity_log', count(*), md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), '')) from public.hotel_activity_log row_value;

alter table public.hotel_room_rates
  add constraint hotel_room_rates_id_hotel_id_key unique (id, hotel_id);

alter table public.hotel_rate_rules
  add column source text not null default 'system',
  add column source_timestamp timestamptz,
  add column provenance jsonb not null default '{}'::jsonb,
  add constraint hotel_rate_rules_source_check check (source in ('manual','legacy_preview','system')),
  add constraint hotel_rate_rules_provenance_check check (jsonb_typeof(provenance)='object'),
  add constraint hotel_rate_rules_weekdays_unique_check check (
    cardinality(weekdays) =
      (case when array_position(weekdays,1::smallint) is null then 0 else 1 end)
      +(case when array_position(weekdays,2::smallint) is null then 0 else 1 end)
      +(case when array_position(weekdays,3::smallint) is null then 0 else 1 end)
      +(case when array_position(weekdays,4::smallint) is null then 0 else 1 end)
      +(case when array_position(weekdays,5::smallint) is null then 0 else 1 end)
      +(case when array_position(weekdays,6::smallint) is null then 0 else 1 end)
      +(case when array_position(weekdays,7::smallint) is null then 0 else 1 end)
  );

alter table public.hotel_daily_rates
  add column source text not null default 'system',
  add constraint hotel_daily_rates_source_check check (source in ('manual','legacy_preview','system'));

alter table public.hotel_daily_inventory
  add column source text not null default 'system',
  add column reason text,
  add column expires_at timestamptz,
  add column actor_id uuid,
  add column sellable_units_mode text not null default 'set',
  add column closed_mode text not null default 'set',
  add constraint hotel_daily_inventory_source_check
    check (source in ('manual','legacy_preview','system')),
  add constraint hotel_daily_inventory_reason_check
    check (reason is null or length(btrim(reason)) between 1 and 500),
  add constraint hotel_daily_inventory_manual_audit_check
    check (source <> 'manual' or (reason is not null and actor_id is not null)),
  add constraint hotel_daily_inventory_sellable_units_mode_check
    check (sellable_units_mode in ('set','clear')),
  add constraint hotel_daily_inventory_closed_mode_check
    check (closed_mode in ('set','clear'));

comment on column public.hotel_daily_inventory.expires_at is
  'A temporary manual inventory row is ignored after this instant; it remains stored for audit/history until explicitly reviewed.';

comment on table public.hotel_daily_rates is
  'Reserved H1/H2 materialization foundation. In H2B only closed=true is an authoritative safety closure; price/stay/arrival/departure values remain inert until a later provenance-controlled materialization contract is deployed.';

create table public.hotel_room_rate_occupancy_tiers (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  room_rate_id uuid not null,
  guest_count smallint not null check (guest_count > 0),
  threshold_nights integer not null check (threshold_nights > 0),
  nightly_rate numeric(12,2) not null check (nightly_rate >= 0),
  is_active boolean not null default false,
  source text not null default 'manual',
  source_timestamp timestamptz,
  provenance jsonb not null default '{}'::jsonb,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_room_rate_occupancy_tiers_room_rate_hotel_fkey
    foreign key (room_rate_id, hotel_id)
    references public.hotel_room_rates(id, hotel_id) on delete cascade,
  constraint hotel_room_rate_occupancy_tiers_rate_guest_threshold_key
    unique (room_rate_id, guest_count, threshold_nights),
  constraint hotel_room_rate_occupancy_tiers_source_check
    check (source in ('manual','legacy_preview','system')),
  constraint hotel_room_rate_occupancy_tiers_provenance_check
    check (jsonb_typeof(provenance) = 'object')
);

create index hotel_room_rate_occupancy_tiers_lookup_idx
  on public.hotel_room_rate_occupancy_tiers(room_rate_id, guest_count, threshold_nights desc, id)
  where is_active;
create index hotel_room_rate_occupancy_tiers_hotel_idx
  on public.hotel_room_rate_occupancy_tiers(hotel_id, room_rate_id, id);

comment on table public.hotel_room_rate_occupancy_tiers is
  'Optional exact-guest-count stay-length tiers. If any tier is active for a product, missing guest/threshold coverage fails closed; the base rate is not a fallback.';

create function public.hotel_v2_h2b_validate_occupancy_tier_contract()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
declare
  v_capacity integer;
begin
  select room_type.capacity_adults + room_type.capacity_children
  into v_capacity
  from public.hotel_room_rates room_rate
  join public.hotel_room_types room_type on room_type.id=room_rate.room_type_id
  where room_rate.id=new.room_rate_id and room_rate.hotel_id=new.hotel_id;
  if v_capacity is null or new.guest_count > v_capacity then
    raise exception using errcode='23514', message='hotels_v2_h2b_occupancy_tier_exceeds_room_capacity';
  end if;
  return new;
end;
$function$;

create function public.hotel_v2_h2b_guard_room_capacity_against_tiers()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if new.capacity_adults + new.capacity_children < old.capacity_adults + old.capacity_children
     and exists (
       select 1
       from public.hotel_room_rates room_rate
       join public.hotel_room_rate_occupancy_tiers tier on tier.room_rate_id=room_rate.id
       where room_rate.room_type_id=new.id
         and tier.is_active
         and tier.guest_count > new.capacity_adults + new.capacity_children
     ) then
    raise exception using errcode='23514', message='hotels_v2_h2b_room_capacity_below_active_occupancy_tier';
  end if;
  return new;
end;
$function$;

revoke all on function public.hotel_v2_h2b_validate_occupancy_tier_contract()
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_h2b_guard_room_capacity_against_tiers()
  from public,anon,authenticated,service_role;

create trigger hotel_room_rate_occupancy_tiers_capacity_guard
before insert or update of hotel_id,room_rate_id,guest_count,is_active
on public.hotel_room_rate_occupancy_tiers
for each row execute function public.hotel_v2_h2b_validate_occupancy_tier_contract();

create trigger hotel_room_types_occupancy_tier_capacity_guard
before update of capacity_adults,capacity_children on public.hotel_room_types
for each row execute function public.hotel_v2_h2b_guard_room_capacity_against_tiers();

create table public.hotel_calendar_overrides (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  room_rate_id uuid not null,
  stay_date date not null,
  nightly_rate numeric(12,2),
  nightly_rate_mode text,
  minimum_stay integer,
  minimum_stay_mode text,
  maximum_stay integer,
  maximum_stay_mode text,
  closed boolean,
  closed_mode text,
  closed_to_arrival boolean,
  closed_to_arrival_mode text,
  closed_to_departure boolean,
  closed_to_departure_mode text,
  reason text not null,
  expires_at timestamptz,
  actor_id uuid not null,
  actor_type text not null default 'admin',
  source text not null default 'manual',
  source_timestamp timestamptz,
  is_active boolean not null default true,
  provenance jsonb not null default '{}'::jsonb,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_calendar_overrides_room_rate_hotel_fkey
    foreign key (room_rate_id, hotel_id)
    references public.hotel_room_rates(id, hotel_id) on delete cascade,
  constraint hotel_calendar_overrides_room_rate_stay_date_key unique (room_rate_id, stay_date),
  constraint hotel_calendar_overrides_reason_check check (length(btrim(reason)) between 1 and 500),
  constraint hotel_calendar_overrides_actor_type_check check (actor_type in ('admin','partner','sync','system')),
  constraint hotel_calendar_overrides_source_check check (source in ('manual','legacy_preview','system')),
  constraint hotel_calendar_overrides_provenance_check check (jsonb_typeof(provenance) = 'object'),
  constraint hotel_calendar_overrides_nightly_rate_check check (nightly_rate is null or nightly_rate >= 0),
  constraint hotel_calendar_overrides_stay_check check (
    (minimum_stay is null or minimum_stay > 0)
    and (maximum_stay is null or maximum_stay > 0)
    and (minimum_stay is null or maximum_stay is null or maximum_stay >= minimum_stay)
  ),
  constraint hotel_calendar_overrides_nightly_rate_mode_check check (
    (nightly_rate_mode is null and nightly_rate is null)
    or (nightly_rate_mode = 'clear' and nightly_rate is null)
    or (nightly_rate_mode = 'set' and nightly_rate is not null)
  ),
  constraint hotel_calendar_overrides_minimum_stay_mode_check check (
    (minimum_stay_mode is null and minimum_stay is null)
    or (minimum_stay_mode = 'clear' and minimum_stay is null)
    or (minimum_stay_mode = 'set' and minimum_stay is not null)
  ),
  constraint hotel_calendar_overrides_maximum_stay_mode_check check (
    (maximum_stay_mode is null and maximum_stay is null)
    or (maximum_stay_mode = 'clear' and maximum_stay is null)
    or (maximum_stay_mode = 'set' and maximum_stay is not null)
  ),
  constraint hotel_calendar_overrides_closed_mode_check check (
    (closed_mode is null and closed is null)
    or (closed_mode = 'clear' and closed is null)
    or (closed_mode = 'set' and closed is not null)
  ),
  constraint hotel_calendar_overrides_cta_mode_check check (
    (closed_to_arrival_mode is null and closed_to_arrival is null)
    or (closed_to_arrival_mode = 'clear' and closed_to_arrival is null)
    or (closed_to_arrival_mode = 'set' and closed_to_arrival is not null)
  ),
  constraint hotel_calendar_overrides_ctd_mode_check check (
    (closed_to_departure_mode is null and closed_to_departure is null)
    or (closed_to_departure_mode = 'clear' and closed_to_departure is null)
    or (closed_to_departure_mode = 'set' and closed_to_departure is not null)
  ),
  constraint hotel_calendar_overrides_value_check check (
    nightly_rate_mode is not null
    or minimum_stay_mode is not null
    or maximum_stay_mode is not null
    or closed_mode is not null
    or closed_to_arrival_mode is not null
    or closed_to_departure_mode is not null
  )
);

create index hotel_calendar_overrides_hotel_date_idx
  on public.hotel_calendar_overrides(hotel_id, stay_date, room_rate_id);
create index hotel_calendar_overrides_active_lookup_idx
  on public.hotel_calendar_overrides(room_rate_id, stay_date)
  where is_active;

comment on table public.hotel_calendar_overrides is
  'Exact-date reviewed overrides. NULL mode means no field at this layer; SET supplies a value; CLEAR records explicit fall-through to lower precedence.';
comment on column public.hotel_calendar_overrides.provenance is
  'Trace metadata only. Credentials are forbidden from this public-schema table.';

create trigger hotel_room_rate_occupancy_tiers_set_updated_at_and_version
before update on public.hotel_room_rate_occupancy_tiers
for each row execute function public.hotel_v2_set_updated_at_and_version();
create trigger hotel_calendar_overrides_set_updated_at_and_version
before update on public.hotel_calendar_overrides
for each row execute function public.hotel_v2_set_updated_at_and_version();

alter table public.hotel_room_rate_occupancy_tiers enable row level security;
alter table public.hotel_calendar_overrides enable row level security;
create policy hotel_room_rate_occupancy_tiers_admin_select
on public.hotel_room_rate_occupancy_tiers for select to authenticated
using (public.is_current_user_admin());
create policy hotel_calendar_overrides_admin_select
on public.hotel_calendar_overrides for select to authenticated
using (public.is_current_user_admin());

revoke all on table public.hotel_room_rate_occupancy_tiers from public, anon, authenticated;
revoke all on table public.hotel_calendar_overrides from public, anon, authenticated;
grant select on table public.hotel_room_rate_occupancy_tiers to authenticated;
grant select on table public.hotel_calendar_overrides to authenticated;
grant all on table public.hotel_room_rate_occupancy_tiers to service_role;
grant all on table public.hotel_calendar_overrides to service_role;

do $h2b_activity_contract$
declare
  v_entity_definition text;
  v_action_definition text;
begin
  select pg_get_constraintdef(oid, true) into v_entity_definition from pg_constraint
  where conrelid = 'public.hotel_activity_log'::regclass and conname = 'hotel_activity_log_entity_type_check';
  select pg_get_constraintdef(oid, true) into v_action_definition from pg_constraint
  where conrelid = 'public.hotel_activity_log'::regclass and conname = 'hotel_activity_log_action_check';
  if v_entity_definition is null or v_entity_definition not like '%room_rate%'
     or v_entity_definition like '%calendar_override%'
     or v_action_definition is null or v_action_definition not like '%duplicate%'
     or v_action_definition like '%delete%' then
    raise exception using errcode = '23514', message = 'hotels_v2_h2b_activity_contract_mismatch';
  end if;
end
$h2b_activity_contract$;

alter table public.hotel_activity_log
  drop constraint hotel_activity_log_entity_type_check,
  add constraint hotel_activity_log_entity_type_check check (
    entity_type in (
      'property','room_type','unit','rate_plan','room_rate','rate_rule',
      'calendar_override','daily_inventory','occupancy_tier'
    )
  ),
  drop constraint hotel_activity_log_action_check,
  add constraint hotel_activity_log_action_check check (
    action in ('create','update','disable','duplicate','delete')
  );

create or replace function public.hotel_v2_admin_resolve_rate(
  p_room_rate_id uuid,
  p_check_in date,
  p_check_out date,
  p_guest_count integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  v_rate public.hotel_room_rates%rowtype;
  v_room public.hotel_room_types%rowtype;
  v_property public.hotels%rowtype;
  v_tier public.hotel_room_rate_occupancy_tiers%rowtype;
  v_override public.hotel_calendar_overrides%rowtype;
  v_range_rule public.hotel_rate_rules%rowtype;
  v_weekday_rule public.hotel_rate_rules%rowtype;
  v_inventory public.hotel_daily_inventory%rowtype;
  v_daily public.hotel_daily_rates%rowtype;
  v_nights integer;
  v_active_tier_count integer;
  v_date date;
  v_top_priority smallint;
  v_top_count integer;
  v_rate_value numeric(12,2);
  v_minimum integer;
  v_maximum integer;
  v_closed boolean;
  v_cta boolean;
  v_ctd boolean;
  v_sellable integer;
  v_rate_source text;
  v_field_provenance jsonb;
  v_breakdown jsonb := '[]'::jsonb;
  v_blockers jsonb := '[]'::jsonb;
  v_total numeric(14,2) := 0;
  v_departure_ctd boolean := false;
  v_as_of timestamptz := statement_timestamp();
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_room_rate_id is null or p_check_in is null or p_check_out is null
     or p_check_out <= p_check_in or (p_check_out - p_check_in) > 62
     or p_guest_count is null or p_guest_count < 1 then
    raise exception using errcode = '22023', message = 'hotels_v2_h2b_invalid_rate_query';
  end if;
  v_nights := p_check_out - p_check_in;

  select * into v_rate from public.hotel_room_rates where id = p_room_rate_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'hotels_v2_h2b_room_rate_not_found';
  end if;
  select * into strict v_room from public.hotel_room_types where id = v_rate.room_type_id;
  select * into strict v_property from public.hotels where id = v_rate.hotel_id;

  if not v_rate.is_active then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code','inactive_room_rate'));
  end if;
  if v_room.status <> 'active' then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code','inactive_room_type'));
  end if;
  if p_guest_count > v_room.capacity_adults + v_room.capacity_children then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code','occupancy_exceeds_capacity',
      'guest_count',p_guest_count,
      'capacity',v_room.capacity_adults + v_room.capacity_children
    ));
  end if;

  select count(*) into v_active_tier_count
  from public.hotel_room_rate_occupancy_tiers tier
  where tier.room_rate_id = v_rate.id and tier.is_active;

  if v_active_tier_count > 0 then
    select * into v_tier
    from public.hotel_room_rate_occupancy_tiers tier
    where tier.room_rate_id = v_rate.id
      and tier.is_active
      and tier.guest_count = p_guest_count
      and tier.threshold_nights <= v_nights
    order by tier.threshold_nights desc, tier.id
    limit 1;
    if not found then
      return jsonb_build_object(
        'ok',false,
        'requestable',false,
        'reason','missing_occupancy_los_tier',
        'blocking_reasons',jsonb_build_array('missing_occupancy_los_tier'),
        'hotel_id',v_property.id,
        'room_type_id',v_room.id,
        'room_rate_id',v_rate.id,
        'rate_plan_id',v_rate.rate_plan_id,
        'check_in',p_check_in,
        'check_out',p_check_out,
        'nights',v_nights,
        'guest_count',p_guest_count,
        'currency',v_rate.currency,
        'selected_occupancy_tier',null,
        'nightly_breakdown','[]'::jsonb,
        'total',null
      );
    end if;
    v_rate_value := v_tier.nightly_rate;
    v_rate_source := 'occupancy_los_tier';
  else
    v_rate_value := v_rate.base_nightly_rate;
    v_rate_source := 'room_rate_base';
  end if;

  for v_date in
    select day_value::date
    from generate_series(p_check_in::timestamp, (p_check_out - 1)::timestamp, interval '1 day') day_value
  loop
    v_range_rule := null;
    v_weekday_rule := null;
    v_override := null;
    v_inventory := null;
    v_daily := null;

    select max(rule.priority) into v_top_priority
    from public.hotel_rate_rules rule
    where rule.room_rate_id = v_rate.id and rule.is_active
      and rule.weekdays @> array[1,2,3,4,5,6,7]::smallint[]
      and v_date between rule.valid_from and rule.valid_to;
    if v_top_priority is not null then
      select count(*) into v_top_count
      from public.hotel_rate_rules rule
      where rule.room_rate_id = v_rate.id and rule.is_active
        and rule.weekdays @> array[1,2,3,4,5,6,7]::smallint[]
        and v_date between rule.valid_from and rule.valid_to
        and rule.priority = v_top_priority;
      if v_top_count > 1 then
        return jsonb_build_object(
          'ok',false,'requestable',false,'reason','ambiguous_range_rules',
          'blocking_reasons',jsonb_build_array('ambiguous_range_rules'),
          'hotel_id',v_property.id,'room_type_id',v_room.id,'room_rate_id',v_rate.id,
          'rate_plan_id',v_rate.rate_plan_id,'check_in',p_check_in,'check_out',p_check_out,
          'nights',v_nights,'guest_count',p_guest_count,'currency',v_rate.currency,
          'ambiguous_date',v_date
        );
      end if;
      select * into v_range_rule from public.hotel_rate_rules rule
      where rule.room_rate_id = v_rate.id and rule.is_active
        and rule.weekdays @> array[1,2,3,4,5,6,7]::smallint[]
        and v_date between rule.valid_from and rule.valid_to
        and rule.priority = v_top_priority
      order by rule.id limit 1;
    end if;

    select max(rule.priority) into v_top_priority
    from public.hotel_rate_rules rule
    where rule.room_rate_id = v_rate.id and rule.is_active
      and not (rule.weekdays @> array[1,2,3,4,5,6,7]::smallint[])
      and v_date between rule.valid_from and rule.valid_to
      and extract(isodow from v_date)::smallint = any(rule.weekdays);
    if v_top_priority is not null then
      select count(*) into v_top_count
      from public.hotel_rate_rules rule
      where rule.room_rate_id = v_rate.id and rule.is_active
        and not (rule.weekdays @> array[1,2,3,4,5,6,7]::smallint[])
        and v_date between rule.valid_from and rule.valid_to
        and extract(isodow from v_date)::smallint = any(rule.weekdays)
        and rule.priority = v_top_priority;
      if v_top_count > 1 then
        return jsonb_build_object(
          'ok',false,'requestable',false,'reason','ambiguous_weekday_rules',
          'blocking_reasons',jsonb_build_array('ambiguous_weekday_rules'),
          'hotel_id',v_property.id,'room_type_id',v_room.id,'room_rate_id',v_rate.id,
          'rate_plan_id',v_rate.rate_plan_id,'check_in',p_check_in,'check_out',p_check_out,
          'nights',v_nights,'guest_count',p_guest_count,'currency',v_rate.currency,
          'ambiguous_date',v_date
        );
      end if;
      select * into v_weekday_rule from public.hotel_rate_rules rule
      where rule.room_rate_id = v_rate.id and rule.is_active
        and not (rule.weekdays @> array[1,2,3,4,5,6,7]::smallint[])
        and v_date between rule.valid_from and rule.valid_to
        and extract(isodow from v_date)::smallint = any(rule.weekdays)
        and rule.priority = v_top_priority
      order by rule.id limit 1;
    end if;

    select * into v_override
    from public.hotel_calendar_overrides exact_override
    where exact_override.room_rate_id = v_rate.id
      and exact_override.stay_date = v_date
      and exact_override.is_active
      and (exact_override.expires_at is null or exact_override.expires_at > v_as_of);
    select * into v_inventory from public.hotel_daily_inventory inventory
    where inventory.room_type_id = v_room.id and inventory.stay_date = v_date
      and (inventory.expires_at is null or inventory.expires_at > v_as_of);
    select * into v_daily from public.hotel_daily_rates daily_rate
    where daily_rate.room_rate_id = v_rate.id and daily_rate.stay_date = v_date;

    -- Base <- weekday <- full-range/seasonal <- exact date. A CLEAR mode at
    -- the exact layer is deliberately ignored and therefore reveals the
    -- already-resolved lower layer.
    if v_active_tier_count > 0 then
      v_rate_value := v_tier.nightly_rate;
      v_rate_source := 'occupancy_los_tier';
      v_field_provenance := jsonb_build_object(
        'nightly_rate',jsonb_build_object(
          'layer','occupancy_los_tier','source_id',v_tier.id,
          'source',v_tier.source,'source_timestamp',v_tier.source_timestamp,
          'provenance',v_tier.provenance
        )
      );
    else
      v_rate_value := v_rate.base_nightly_rate;
      v_rate_source := 'room_rate_base';
      v_field_provenance := jsonb_build_object(
        'nightly_rate',jsonb_build_object('layer','room_rate_base','source_id',v_rate.id)
      );
    end if;
    v_minimum := null;
    v_maximum := null;
    v_closed := false;
    v_cta := false;
    v_ctd := false;

    if v_weekday_rule.id is not null then
      v_rate_value := v_weekday_rule.nightly_rate;
      if v_weekday_rule.minimum_stay is not null then v_minimum := v_weekday_rule.minimum_stay; end if;
      if v_weekday_rule.maximum_stay is not null then v_maximum := v_weekday_rule.maximum_stay; end if;
      v_cta := v_weekday_rule.closed_to_arrival;
      v_ctd := v_weekday_rule.closed_to_departure;
      v_rate_source := 'weekday_rule';
      v_field_provenance := v_field_provenance || jsonb_strip_nulls(jsonb_build_object(
        'nightly_rate',jsonb_build_object('layer','weekday_rule','source_id',v_weekday_rule.id,'priority',v_weekday_rule.priority,'source',v_weekday_rule.source,'source_timestamp',v_weekday_rule.source_timestamp,'provenance',v_weekday_rule.provenance),
        'minimum_stay',case when v_weekday_rule.minimum_stay is not null then jsonb_build_object('layer','weekday_rule','source_id',v_weekday_rule.id) end,
        'maximum_stay',case when v_weekday_rule.maximum_stay is not null then jsonb_build_object('layer','weekday_rule','source_id',v_weekday_rule.id) end,
        'closed_to_arrival',jsonb_build_object('layer','weekday_rule','source_id',v_weekday_rule.id),
        'closed_to_departure',jsonb_build_object('layer','weekday_rule','source_id',v_weekday_rule.id)
      ));
    end if;
    if v_range_rule.id is not null then
      v_rate_value := v_range_rule.nightly_rate;
      if v_range_rule.minimum_stay is not null then v_minimum := v_range_rule.minimum_stay; end if;
      if v_range_rule.maximum_stay is not null then v_maximum := v_range_rule.maximum_stay; end if;
      v_cta := v_range_rule.closed_to_arrival;
      v_ctd := v_range_rule.closed_to_departure;
      v_rate_source := 'range_rule';
      v_field_provenance := v_field_provenance || jsonb_strip_nulls(jsonb_build_object(
        'nightly_rate',jsonb_build_object('layer','range_rule','source_id',v_range_rule.id,'priority',v_range_rule.priority,'source',v_range_rule.source,'source_timestamp',v_range_rule.source_timestamp,'provenance',v_range_rule.provenance),
        'minimum_stay',case when v_range_rule.minimum_stay is not null then jsonb_build_object('layer','range_rule','source_id',v_range_rule.id) end,
        'maximum_stay',case when v_range_rule.maximum_stay is not null then jsonb_build_object('layer','range_rule','source_id',v_range_rule.id) end,
        'closed_to_arrival',jsonb_build_object('layer','range_rule','source_id',v_range_rule.id),
        'closed_to_departure',jsonb_build_object('layer','range_rule','source_id',v_range_rule.id)
      ));
    end if;
    if v_override.id is not null then
      if v_override.nightly_rate_mode = 'set' then v_rate_value := v_override.nightly_rate; v_rate_source := 'exact_date_override'; end if;
      if v_override.minimum_stay_mode = 'set' then v_minimum := v_override.minimum_stay; end if;
      if v_override.maximum_stay_mode = 'set' then v_maximum := v_override.maximum_stay; end if;
      if v_override.closed_mode = 'set' then v_closed := v_override.closed; end if;
      if v_override.closed_to_arrival_mode = 'set' then v_cta := v_override.closed_to_arrival; end if;
      if v_override.closed_to_departure_mode = 'set' then v_ctd := v_override.closed_to_departure; end if;
      v_field_provenance := v_field_provenance || jsonb_strip_nulls(jsonb_build_object(
        'nightly_rate',case when v_override.nightly_rate_mode='set' then jsonb_build_object('layer','exact_date_override','mode','set','source_id',v_override.id,'source',v_override.source,'source_timestamp',v_override.source_timestamp,'provenance',v_override.provenance) end,
        'minimum_stay',case when v_override.minimum_stay_mode='set' then jsonb_build_object('layer','exact_date_override','mode','set','source_id',v_override.id) end,
        'maximum_stay',case when v_override.maximum_stay_mode='set' then jsonb_build_object('layer','exact_date_override','mode','set','source_id',v_override.id) end,
        'closed',case when v_override.closed_mode='set' then jsonb_build_object('layer','exact_date_override','mode','set','source_id',v_override.id) end,
        'closed_to_arrival',case when v_override.closed_to_arrival_mode='set' then jsonb_build_object('layer','exact_date_override','mode','set','source_id',v_override.id) end,
        'closed_to_departure',case when v_override.closed_to_departure_mode='set' then jsonb_build_object('layer','exact_date_override','mode','set','source_id',v_override.id) end
      ));
    end if;

    v_sellable := case
      when v_inventory.room_type_id is not null and v_inventory.sellable_units_mode='set'
        then v_inventory.sellable_units
      else v_room.base_inventory_count
    end;
    v_field_provenance := v_field_provenance || jsonb_build_object(
      'inventory',case when v_inventory.room_type_id is null
        then jsonb_build_object('layer','room_type_base_inventory','source_id',v_room.id)
        else jsonb_build_object(
          'layer','daily_inventory','source_id',v_inventory.room_type_id::text || ':' || v_date::text,
          'source',v_inventory.source,'source_timestamp',v_inventory.source_timestamp,
          'provenance',v_inventory.provenance,'expires_at',v_inventory.expires_at
        ) end
    );
    if (v_inventory.room_type_id is not null and v_inventory.closed_mode='set' and v_inventory.closed)
       or coalesce(v_daily.closed,false) then
      v_closed := true;
      v_field_provenance := v_field_provenance || jsonb_build_object(
        'closed',jsonb_build_object('layer','safety_closure','source_id',coalesce(v_inventory.room_type_id::text || ':' || v_date::text, v_daily.room_rate_id::text || ':' || v_date::text))
      );
    end if;

    if v_closed then v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code','closed','stay_date',v_date)); end if;
    if v_sellable <= 0 then v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code','no_inventory','stay_date',v_date)); end if;
    if v_date = p_check_in and v_cta then v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code','closed_to_arrival','stay_date',v_date)); end if;
    if v_date = p_check_in and v_minimum is not null and v_nights < v_minimum then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code','below_minimum_stay','required',v_minimum,'actual',v_nights));
    end if;
    if v_date = p_check_in and v_maximum is not null and v_nights > v_maximum then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code','above_maximum_stay','required',v_maximum,'actual',v_nights));
    end if;
    if v_minimum is not null and v_maximum is not null and v_maximum < v_minimum then
      return jsonb_build_object(
        'ok',false,'requestable',false,'reason','invalid_resolved_stay_restriction',
        'blocking_reasons',jsonb_build_array('invalid_resolved_stay_restriction'),
        'hotel_id',v_property.id,'room_type_id',v_room.id,'room_rate_id',v_rate.id,
        'rate_plan_id',v_rate.rate_plan_id,'check_in',p_check_in,'check_out',p_check_out,
        'nights',v_nights,'guest_count',p_guest_count,'currency',v_rate.currency,
        'invalid_date',v_date
      );
    end if;

    v_breakdown := v_breakdown || jsonb_build_array(jsonb_build_object(
      'stay_date',v_date,'nightly_rate',v_rate_value,'currency',v_rate.currency,
      'sellable_units',v_sellable,'closed',v_closed,
      'minimum_stay',v_minimum,'maximum_stay',v_maximum,
      'closed_to_arrival',v_cta,'closed_to_departure',v_ctd,
      'source',v_rate_source,'provenance',v_field_provenance
    ));
    v_total := v_total + v_rate_value;
  end loop;

  -- Departure restriction uses the same layer order on the non-charged
  -- check-out date. Only CTD is relevant here.
  v_range_rule := null;
  v_weekday_rule := null;
  v_override := null;
  select max(rule.priority) into v_top_priority from public.hotel_rate_rules rule
  where rule.room_rate_id = v_rate.id and rule.is_active
    and not (rule.weekdays @> array[1,2,3,4,5,6,7]::smallint[])
    and p_check_out between rule.valid_from and rule.valid_to
    and extract(isodow from p_check_out)::smallint = any(rule.weekdays);
  if v_top_priority is not null then
    select count(*) into v_top_count from public.hotel_rate_rules rule
    where rule.room_rate_id=v_rate.id and rule.is_active
      and not (rule.weekdays @> array[1,2,3,4,5,6,7]::smallint[])
      and p_check_out between rule.valid_from and rule.valid_to
      and extract(isodow from p_check_out)::smallint=any(rule.weekdays)
      and rule.priority=v_top_priority;
    if v_top_count>1 then
      return jsonb_build_object(
        'ok',false,'requestable',false,'reason','ambiguous_weekday_rules',
        'blocking_reasons',jsonb_build_array('ambiguous_weekday_rules'),
        'hotel_id',v_property.id,'room_type_id',v_room.id,'room_rate_id',v_rate.id,
        'rate_plan_id',v_rate.rate_plan_id,'check_in',p_check_in,'check_out',p_check_out,
        'nights',v_nights,'guest_count',p_guest_count,'currency',v_rate.currency,
        'ambiguous_date',p_check_out
      );
    end if;
    select * into v_weekday_rule from public.hotel_rate_rules rule
    where rule.room_rate_id=v_rate.id and rule.is_active
      and not (rule.weekdays @> array[1,2,3,4,5,6,7]::smallint[])
      and p_check_out between rule.valid_from and rule.valid_to
      and extract(isodow from p_check_out)::smallint=any(rule.weekdays)
      and rule.priority=v_top_priority order by rule.id limit 1;
  end if;
  select max(rule.priority) into v_top_priority from public.hotel_rate_rules rule
  where rule.room_rate_id = v_rate.id and rule.is_active
    and rule.weekdays @> array[1,2,3,4,5,6,7]::smallint[]
    and p_check_out between rule.valid_from and rule.valid_to;
  if v_top_priority is not null then
    select count(*) into v_top_count from public.hotel_rate_rules rule
    where rule.room_rate_id=v_rate.id and rule.is_active
      and rule.weekdays @> array[1,2,3,4,5,6,7]::smallint[]
      and p_check_out between rule.valid_from and rule.valid_to and rule.priority=v_top_priority;
    if v_top_count>1 then
      return jsonb_build_object(
        'ok',false,'requestable',false,'reason','ambiguous_range_rules',
        'blocking_reasons',jsonb_build_array('ambiguous_range_rules'),
        'hotel_id',v_property.id,'room_type_id',v_room.id,'room_rate_id',v_rate.id,
        'rate_plan_id',v_rate.rate_plan_id,'check_in',p_check_in,'check_out',p_check_out,
        'nights',v_nights,'guest_count',p_guest_count,'currency',v_rate.currency,
        'ambiguous_date',p_check_out
      );
    end if;
    select * into v_range_rule from public.hotel_rate_rules rule
    where rule.room_rate_id=v_rate.id and rule.is_active
      and rule.weekdays @> array[1,2,3,4,5,6,7]::smallint[]
      and p_check_out between rule.valid_from and rule.valid_to and rule.priority=v_top_priority
    order by rule.id limit 1;
  end if;
  select * into v_override from public.hotel_calendar_overrides exact_override
  where exact_override.room_rate_id = v_rate.id and exact_override.stay_date = p_check_out
    and exact_override.is_active
    and (exact_override.expires_at is null or exact_override.expires_at > v_as_of);
  v_departure_ctd := coalesce(v_weekday_rule.closed_to_departure,false);
  if v_range_rule.id is not null then v_departure_ctd := v_range_rule.closed_to_departure; end if;
  if v_override.closed_to_departure_mode = 'set' then v_departure_ctd := v_override.closed_to_departure; end if;
  if v_departure_ctd then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code','closed_to_departure','stay_date',p_check_out));
  end if;

  return jsonb_build_object(
    'ok',true,
    'requestable',jsonb_array_length(v_blockers) = 0,
    'reason',case when jsonb_array_length(v_blockers) = 0 then null else v_blockers->0->>'code' end,
    'blocking_reasons',v_blockers,
    'hotel_id',v_property.id,
    'property_name',v_property.title,
    'room_type_id',v_room.id,
    'room_rate_id',v_rate.id,
    'rate_plan_id',v_rate.rate_plan_id,
    'check_in',p_check_in,
    'check_out',p_check_out,
    'nights',v_nights,
    'guest_count',p_guest_count,
    'currency',v_rate.currency,
    'selected_occupancy_tier',case when v_tier.id is null then null else to_jsonb(v_tier) end,
    'nightly_breakdown',v_breakdown,
    'departure_restrictions',jsonb_build_object('stay_date',p_check_out,'closed_to_departure',v_departure_ctd),
    'total',round(v_total,2)
  );
end;
$function$;

-- Forward declaration so the transactional apply function can return a fresh
-- calendar snapshot. The complete body replaces this stub later in the same
-- transaction; no caller can observe the stub.
create function public.hotel_v2_admin_get_calendar(
  p_hotel_id uuid,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
begin
  perform public.hotel_v2_h2a_require_admin();
  raise exception using errcode = '55000', message = 'hotels_v2_h2b_calendar_install_in_progress';
end;
$function$;

create or replace function public.hotel_v2_admin_apply_calendar_plan(
  p_plan jsonb,
  p_correlation_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  v_hotel_id uuid;
  v_from date;
  v_to date;
  v_operation jsonb;
  v_entity text;
  v_action text;
  v_id uuid;
  v_expected_version bigint;
  v_payload jsonb;
  v_before jsonb;
  v_after jsonb;
  v_affected integer;
  v_room_rate public.hotel_room_rates%rowtype;
  v_room_type public.hotel_room_types%rowtype;
  v_rule public.hotel_rate_rules%rowtype;
  v_override public.hotel_calendar_overrides%rowtype;
  v_tier public.hotel_room_rate_occupancy_tiers%rowtype;
  v_inventory public.hotel_daily_inventory%rowtype;
  v_stay_date date;
  v_room_type_id uuid;
  v_activity_id uuid;
  v_reason text;
  v_expires_at timestamptz;
  v_source text;
  v_current_snapshot text;
  v_reviewed_at timestamptz;
  v_capacity integer;
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_plan is null or jsonb_typeof(p_plan) <> 'object' or p_correlation_id is null
     or not public.hotel_v2_h2a_keys_allowed(p_plan,array['hotel_id','from','to','reviewed_at','snapshot_token','operations'])
     or not (p_plan ?& array['hotel_id','from','to','reviewed_at','snapshot_token','operations'])
     or nullif(btrim(p_plan->>'snapshot_token'),'') is null
     or jsonb_typeof(p_plan->'operations') <> 'array'
     or jsonb_array_length(p_plan->'operations') < 1
     or jsonb_array_length(p_plan->'operations') > 1000 then
    raise exception using errcode = '22023', message = 'hotels_v2_h2b_invalid_calendar_plan';
  end if;
  v_hotel_id := (p_plan->>'hotel_id')::uuid;
  v_from := (p_plan->>'from')::date;
  v_to := (p_plan->>'to')::date;
  v_reviewed_at := (p_plan->>'reviewed_at')::timestamptz;
  if v_to < v_from or (v_to - v_from) > 61 then
    raise exception using errcode = '22023', message = 'hotels_v2_h2b_invalid_calendar_range';
  end if;
  if v_reviewed_at < clock_timestamp() - interval '30 minutes'
     or v_reviewed_at > clock_timestamp() + interval '5 minutes' then
    raise exception using errcode = '22023', message = 'hotels_v2_h2b_invalid_review_timestamp';
  end if;

  perform 1 from public.hotels where id = v_hotel_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'hotels_v2_h2b_property_not_found'; end if;
  if exists (select 1 from public.hotel_activity_log where correlation_id = p_correlation_id) then
    raise exception using errcode = '23505', message = 'hotels_v2_h2b_correlation_id_already_used';
  end if;
  v_current_snapshot := public.hotel_v2_admin_get_calendar(v_hotel_id,v_from,v_to)->>'snapshot_token';
  if v_current_snapshot is distinct from p_plan->>'snapshot_token' then
    raise exception using errcode = '40001', message = 'hotels_v2_h2b_stale_calendar_snapshot';
  end if;
  if exists (
    select 1 from (
      select operation.value->>'entity' entity_name,
             coalesce(operation.value->>'id',concat_ws(':',operation.value#>>'{payload,room_type_id}',operation.value#>>'{payload,stay_date}')) target_key,
             count(*)
      from jsonb_array_elements(p_plan->'operations') operation(value)
      group by 1,2 having count(*) > 1
    ) duplicate_target
  ) then
    raise exception using errcode = '22023', message = 'hotels_v2_h2b_duplicate_plan_target';
  end if;

  create temporary table if not exists pg_temp.hotel_v2_h2b_rule_plan_state (
    id uuid primary key,
    room_rate_id uuid not null,
    valid_from date not null,
    valid_to date not null,
    weekdays smallint[] not null,
    priority smallint not null,
    is_active boolean not null
  ) on commit drop;
  truncate pg_temp.hotel_v2_h2b_rule_plan_state;
  insert into pg_temp.hotel_v2_h2b_rule_plan_state
  select rule.id,rule.room_rate_id,rule.valid_from,rule.valid_to,rule.weekdays,rule.priority,rule.is_active
  from public.hotel_rate_rules rule join public.hotel_room_rates room_rate on room_rate.id = rule.room_rate_id
  where room_rate.hotel_id = v_hotel_id;

  -- Complete read/shape/ownership/version preflight. No mutation occurs before
  -- this loop and the final rule ambiguity check have both succeeded.
  for v_operation in
    select operation.value from jsonb_array_elements(p_plan->'operations') with ordinality operation(value,ordinal)
    order by operation.value->>'entity',operation.value->>'id',operation.ordinal
  loop
    if jsonb_typeof(v_operation) <> 'object'
       or not public.hotel_v2_h2a_keys_allowed(v_operation,array['entity','type','id','expected_version','payload'])
       or not (v_operation ?& array['entity','type','expected_version','payload'])
       or jsonb_typeof(v_operation->'payload') <> 'object' then
      raise exception using errcode = '22023', message = 'hotels_v2_h2b_invalid_calendar_operation';
    end if;
    v_entity := v_operation->>'entity';
    v_action := v_operation->>'type';
    v_payload := v_operation->'payload';
    v_expected_version := (v_operation->>'expected_version')::bigint;
    v_id := case when v_operation ? 'id' and v_operation->>'id' is not null then (v_operation->>'id')::uuid end;
    if v_expected_version < 0 or v_entity not in ('rate_rule','calendar_override','daily_inventory','occupancy_tier') then
      raise exception using errcode = '22023', message = 'hotels_v2_h2b_invalid_operation_contract';
    end if;

    if v_entity = 'rate_rule' then
      if v_id is null or v_action not in ('create','update','disable')
         or not public.hotel_v2_h2a_keys_allowed(v_payload,array[
           'room_rate_id','valid_from','valid_to','weekdays','nightly_rate','minimum_stay',
           'maximum_stay','closed_to_arrival','closed_to_departure','priority','is_active',
           'source','source_timestamp','provenance'
         ]) then
        raise exception using errcode = '22023', message = 'hotels_v2_h2b_invalid_rate_rule_operation';
      end if;
      if v_payload ? 'weekdays' and (
        jsonb_typeof(v_payload->'weekdays') <> 'array'
        or jsonb_array_length(v_payload->'weekdays') < 1
        or exists (
          select 1 from jsonb_array_elements_text(v_payload->'weekdays') weekday(value)
          where weekday.value !~ '^[1-7]$'
        )
        or jsonb_array_length(v_payload->'weekdays') <> (
          select count(distinct weekday.value)
          from jsonb_array_elements_text(v_payload->'weekdays') weekday(value)
        )
      ) then
        raise exception using errcode = '22023', message = 'hotels_v2_h2b_weekdays_must_be_unique';
      end if;
      if v_action = 'create' then
        if v_expected_version <> 0 or exists(select 1 from public.hotel_rate_rules where id = v_id)
           or not (v_payload ?& array['room_rate_id','valid_from','valid_to','weekdays','nightly_rate']) then
          raise exception using errcode = '23514', message = 'hotels_v2_h2b_invalid_rate_rule_create';
        end if;
        select * into v_room_rate from public.hotel_room_rates
        where id = (v_payload->>'room_rate_id')::uuid and hotel_id = v_hotel_id for share;
        if not found then raise exception using errcode = '23503', message = 'hotels_v2_h2b_rate_rule_outside_property'; end if;
        insert into pg_temp.hotel_v2_h2b_rule_plan_state values (
          v_id,v_room_rate.id,(v_payload->>'valid_from')::date,(v_payload->>'valid_to')::date,
          array(select jsonb_array_elements_text(v_payload->'weekdays')::smallint),
          coalesce((v_payload->>'priority')::smallint,0),coalesce((v_payload->>'is_active')::boolean,false)
        );
      else
        if v_expected_version < 1 then raise exception using errcode = '22023', message = 'hotels_v2_h2b_rate_rule_version_required'; end if;
        select rule.* into v_rule from public.hotel_rate_rules rule
        join public.hotel_room_rates room_rate on room_rate.id = rule.room_rate_id
        where rule.id = v_id and room_rate.hotel_id = v_hotel_id for update of rule;
        if not found or v_rule.version <> v_expected_version then raise exception using errcode = '40001', message = 'hotels_v2_h2b_stale_rate_rule'; end if;
        if v_payload ? 'room_rate_id' and (v_payload->>'room_rate_id')::uuid <> v_rule.room_rate_id then
          raise exception using errcode = '23514', message = 'hotels_v2_h2b_rate_rule_product_change_forbidden';
        end if;
        if v_action = 'disable' and v_payload <> '{}'::jsonb then raise exception using errcode = '22023', message = 'hotels_v2_h2b_disable_payload_must_be_empty'; end if;
        update pg_temp.hotel_v2_h2b_rule_plan_state state set
          valid_from=case when v_payload ? 'valid_from' then (v_payload->>'valid_from')::date else state.valid_from end,
          valid_to=case when v_payload ? 'valid_to' then (v_payload->>'valid_to')::date else state.valid_to end,
          weekdays=case when v_payload ? 'weekdays' then array(select jsonb_array_elements_text(v_payload->'weekdays')::smallint) else state.weekdays end,
          priority=case when v_payload ? 'priority' then (v_payload->>'priority')::smallint else state.priority end,
          is_active=case when v_action='disable' then false when v_payload ? 'is_active' then (v_payload->>'is_active')::boolean else state.is_active end
        where state.id=v_id;
      end if;

    elsif v_entity = 'calendar_override' then
      if v_id is null or v_action not in ('create','update','disable','delete')
         or not public.hotel_v2_h2a_keys_allowed(v_payload,array[
           'room_rate_id','stay_date','nightly_rate','minimum_stay','maximum_stay','closed',
           'closed_to_arrival','closed_to_departure','reason','expires_at','source','source_timestamp',
           'nightly_rate_mode','minimum_stay_mode','maximum_stay_mode','closed_mode',
           'closed_to_arrival_mode','closed_to_departure_mode','is_active','provenance'
         ]) then
        raise exception using errcode = '22023', message = 'hotels_v2_h2b_invalid_calendar_override_operation';
      end if;
      if v_action = 'create' then
        if v_expected_version <> 0 or exists(select 1 from public.hotel_calendar_overrides where id=v_id)
           or not (v_payload ?& array['room_rate_id','stay_date','reason']) then
          raise exception using errcode = '23514', message = 'hotels_v2_h2b_invalid_calendar_override_create';
        end if;
        select * into v_room_rate from public.hotel_room_rates
        where id=(v_payload->>'room_rate_id')::uuid and hotel_id=v_hotel_id for share;
        if not found then raise exception using errcode = '23503', message = 'hotels_v2_h2b_calendar_override_outside_property'; end if;
        v_stay_date := (v_payload->>'stay_date')::date;
        perform 1 from public.hotel_calendar_overrides where room_rate_id=v_room_rate.id and stay_date=v_stay_date for update;
        if found then raise exception using errcode = '23505', message = 'hotels_v2_h2b_calendar_override_key_exists'; end if;
      else
        if v_expected_version < 1 then raise exception using errcode = '22023', message = 'hotels_v2_h2b_calendar_override_version_required'; end if;
        select * into v_override from public.hotel_calendar_overrides where id=v_id and hotel_id=v_hotel_id for update;
        if not found or v_override.version <> v_expected_version then raise exception using errcode = '40001', message = 'hotels_v2_h2b_stale_calendar_override'; end if;
        v_stay_date := v_override.stay_date;
        if v_action in ('disable','delete') and v_payload <> '{}'::jsonb then raise exception using errcode = '22023', message = 'hotels_v2_h2b_empty_payload_required'; end if;
        if v_action='update' and (not (v_payload ? 'reason') or length(btrim(v_payload->>'reason')) < 1) then
          raise exception using errcode = '22023', message = 'hotels_v2_h2b_override_reason_required';
        end if;
      end if;
      if v_stay_date not between v_from and v_to then raise exception using errcode = '22023', message = 'hotels_v2_h2b_override_outside_reviewed_range'; end if;
      if v_action in ('create','update') then
        v_reason := btrim(v_payload->>'reason');
        v_expires_at := case when v_payload ? 'expires_at' and v_payload->>'expires_at' is not null then (v_payload->>'expires_at')::timestamptz end;
        if length(v_reason) not between 1 and 500 then raise exception using errcode = '22023', message = 'hotels_v2_h2b_override_reason_invalid'; end if;
        if v_expires_at is not null and v_expires_at <= clock_timestamp() then raise exception using errcode = '22023', message = 'hotels_v2_h2b_override_expiry_not_future'; end if;
        if exists (
          select 1 from unnest(array['nightly_rate','minimum_stay','maximum_stay','closed','closed_to_arrival','closed_to_departure']) field_name
          where (v_payload ? field_name) <> (v_payload ? (field_name || '_mode'))
             or (
               v_payload ? (field_name || '_mode') and (
                 v_payload->>(field_name || '_mode') not in ('set','clear')
                 or (v_payload->>(field_name || '_mode')='set' and v_payload->>field_name is null)
                 or (v_payload->>(field_name || '_mode')='clear' and v_payload->>field_name is not null)
               )
             )
        ) then
          raise exception using errcode = '22023', message = 'hotels_v2_h2b_override_mode_value_mismatch';
        end if;
      end if;

    elsif v_entity = 'occupancy_tier' then
      if v_id is null or v_action not in ('create','update','disable','delete')
         or not public.hotel_v2_h2a_keys_allowed(v_payload,array[
           'room_rate_id','guest_count','threshold_nights','nightly_rate','is_active','source','source_timestamp','provenance'
         ]) then
        raise exception using errcode = '22023', message = 'hotels_v2_h2b_invalid_occupancy_tier_operation';
      end if;
      if v_action='create' then
        if v_expected_version<>0 or exists(select 1 from public.hotel_room_rate_occupancy_tiers where id=v_id)
           or not (v_payload ?& array['room_rate_id','guest_count','threshold_nights','nightly_rate']) then
          raise exception using errcode = '23514', message = 'hotels_v2_h2b_invalid_occupancy_tier_create';
        end if;
        select * into v_room_rate from public.hotel_room_rates where id=(v_payload->>'room_rate_id')::uuid and hotel_id=v_hotel_id for share;
        if not found then raise exception using errcode = '23503', message = 'hotels_v2_h2b_occupancy_tier_outside_property'; end if;
        select room_type.capacity_adults + room_type.capacity_children into v_capacity
        from public.hotel_room_types room_type where room_type.id=v_room_rate.room_type_id;
        if (v_payload->>'guest_count')::integer > v_capacity then
          raise exception using errcode='23514', message='hotels_v2_h2b_occupancy_tier_exceeds_room_capacity';
        end if;
        perform 1 from public.hotel_room_rate_occupancy_tiers
        where room_rate_id=v_room_rate.id and guest_count=(v_payload->>'guest_count')::smallint
          and threshold_nights=(v_payload->>'threshold_nights')::integer for update;
        if found then raise exception using errcode = '23505', message = 'hotels_v2_h2b_occupancy_tier_key_exists'; end if;
      else
        if v_expected_version<1 then raise exception using errcode = '22023', message = 'hotels_v2_h2b_occupancy_tier_version_required'; end if;
        select * into v_tier from public.hotel_room_rate_occupancy_tiers where id=v_id and hotel_id=v_hotel_id for update;
        if not found or v_tier.version<>v_expected_version then raise exception using errcode = '40001', message = 'hotels_v2_h2b_stale_occupancy_tier'; end if;
        if v_payload ? 'room_rate_id' and (v_payload->>'room_rate_id')::uuid<>v_tier.room_rate_id then raise exception using errcode = '23514', message = 'hotels_v2_h2b_occupancy_tier_product_change_forbidden'; end if;
        if v_action in ('disable','delete') and v_payload<>'{}'::jsonb then raise exception using errcode = '22023', message = 'hotels_v2_h2b_empty_payload_required'; end if;
        select room_type.capacity_adults + room_type.capacity_children into v_capacity
        from public.hotel_room_rates room_rate
        join public.hotel_room_types room_type on room_type.id=room_rate.room_type_id
        where room_rate.id=v_tier.room_rate_id;
        if coalesce((v_payload->>'guest_count')::integer,v_tier.guest_count) > v_capacity then
          raise exception using errcode='23514', message='hotels_v2_h2b_occupancy_tier_exceeds_room_capacity';
        end if;
      end if;

    else
      if v_action not in ('upsert','delete')
         or not public.hotel_v2_h2a_keys_allowed(v_payload,array[
           'room_type_id','stay_date','sellable_units','closed','source','source_timestamp',
           'sellable_units_mode','closed_mode','reason','expires_at','provenance'
         ])
         or not (v_payload ?& array['room_type_id','stay_date']) then
        raise exception using errcode = '22023', message = 'hotels_v2_h2b_invalid_daily_inventory_operation';
      end if;
      v_room_type_id := (v_payload->>'room_type_id')::uuid;
      v_stay_date := (v_payload->>'stay_date')::date;
      if v_stay_date not between v_from and v_to then raise exception using errcode = '22023', message = 'hotels_v2_h2b_inventory_outside_reviewed_range'; end if;
      select * into v_room_type from public.hotel_room_types where id=v_room_type_id and hotel_id=v_hotel_id for share;
      if not found then raise exception using errcode = '23503', message = 'hotels_v2_h2b_inventory_outside_property'; end if;
      select * into v_inventory from public.hotel_daily_inventory where room_type_id=v_room_type_id and stay_date=v_stay_date for update;
      if v_expected_version=0 then
        if found or v_action<>'upsert' or not (v_payload ? 'sellable_units') then
          raise exception using errcode = '23514', message = 'hotels_v2_h2b_invalid_inventory_create';
        end if;
      elsif not found or v_inventory.version<>v_expected_version then
        raise exception using errcode = '40001', message = 'hotels_v2_h2b_stale_daily_inventory';
      end if;
      if v_action='delete' and v_expected_version<1 then raise exception using errcode = '22023', message = 'hotels_v2_h2b_inventory_delete_version_required'; end if;
      if v_action='upsert' then
        v_reason := coalesce(nullif(btrim(v_payload->>'reason'),''),nullif(btrim(v_payload#>>'{provenance,reason}'),''));
        v_expires_at := case
          when v_payload ? 'expires_at' and v_payload->>'expires_at' is not null then (v_payload->>'expires_at')::timestamptz
          when v_payload#>>'{provenance,expires_at}' is not null then (v_payload#>>'{provenance,expires_at}')::timestamptz
        end;
        if v_reason is null or length(v_reason)>500 then raise exception using errcode = '22023', message = 'hotels_v2_h2b_inventory_reason_required'; end if;
        if v_expires_at is not null and v_expires_at<=clock_timestamp() then raise exception using errcode = '22023', message = 'hotels_v2_h2b_inventory_expiry_not_future'; end if;
        if coalesce(v_payload->>'sellable_units_mode','set') not in ('set','clear')
           or coalesce(v_payload->>'closed_mode','set') not in ('set','clear') then
          raise exception using errcode = '22023', message = 'hotels_v2_h2b_inventory_mode_invalid';
        end if;
      end if;
    end if;
  end loop;

  if exists (
    select 1 from pg_temp.hotel_v2_h2b_rule_plan_state left_rule
    join pg_temp.hotel_v2_h2b_rule_plan_state right_rule
      on left_rule.room_rate_id=right_rule.room_rate_id and left_rule.id<right_rule.id
     and (left_rule.weekdays @> array[1,2,3,4,5,6,7]::smallint[])
       = (right_rule.weekdays @> array[1,2,3,4,5,6,7]::smallint[])
     and left_rule.priority=right_rule.priority
     and left_rule.valid_from<=right_rule.valid_to and right_rule.valid_from<=left_rule.valid_to
     and left_rule.weekdays && right_rule.weekdays
    where left_rule.is_active and right_rule.is_active
  ) then
    raise exception using errcode = '23514', message = 'hotels_v2_h2b_equal_priority_rate_rule_overlap';
  end if;

  -- Apply only after the complete reviewed plan passed.
  for v_operation in
    select operation.value from jsonb_array_elements(p_plan->'operations') with ordinality operation(value,ordinal)
    order by operation.ordinal
  loop
    v_entity:=v_operation->>'entity'; v_action:=v_operation->>'type'; v_payload:=v_operation->'payload';
    v_expected_version:=(v_operation->>'expected_version')::bigint;
    v_id:=case when v_operation ? 'id' and v_operation->>'id' is not null then (v_operation->>'id')::uuid end;
    v_before:=null; v_after:=null; v_affected:=0;

    if v_entity='rate_rule' then
      if v_action='create' then
        insert into public.hotel_rate_rules(id,room_rate_id,valid_from,valid_to,weekdays,nightly_rate,minimum_stay,maximum_stay,closed_to_arrival,closed_to_departure,priority,is_active,source,source_timestamp,provenance)
        values(v_id,(v_payload->>'room_rate_id')::uuid,(v_payload->>'valid_from')::date,(v_payload->>'valid_to')::date,
          array(select jsonb_array_elements_text(v_payload->'weekdays')::smallint),(v_payload->>'nightly_rate')::numeric,
          case when v_payload ? 'minimum_stay' and v_payload->>'minimum_stay' is not null then (v_payload->>'minimum_stay')::integer end,
          case when v_payload ? 'maximum_stay' and v_payload->>'maximum_stay' is not null then (v_payload->>'maximum_stay')::integer end,
          coalesce((v_payload->>'closed_to_arrival')::boolean,false),coalesce((v_payload->>'closed_to_departure')::boolean,false),
          coalesce((v_payload->>'priority')::smallint,0),coalesce((v_payload->>'is_active')::boolean,false),'manual',
          case when v_payload ? 'source_timestamp' and v_payload->>'source_timestamp' is not null then (v_payload->>'source_timestamp')::timestamptz end,
          coalesce(v_payload->'provenance',jsonb_build_object('source','admin')))
        returning to_jsonb(hotel_rate_rules.*) into v_after;
      else
        select to_jsonb(rule.*) into v_before from public.hotel_rate_rules rule where id=v_id;
        update public.hotel_rate_rules rule set
          valid_from=case when v_payload ? 'valid_from' then (v_payload->>'valid_from')::date else rule.valid_from end,
          valid_to=case when v_payload ? 'valid_to' then (v_payload->>'valid_to')::date else rule.valid_to end,
          weekdays=case when v_payload ? 'weekdays' then array(select jsonb_array_elements_text(v_payload->'weekdays')::smallint) else rule.weekdays end,
          nightly_rate=case when v_payload ? 'nightly_rate' then (v_payload->>'nightly_rate')::numeric else rule.nightly_rate end,
          minimum_stay=case when v_payload ? 'minimum_stay' then (v_payload->>'minimum_stay')::integer else rule.minimum_stay end,
          maximum_stay=case when v_payload ? 'maximum_stay' then (v_payload->>'maximum_stay')::integer else rule.maximum_stay end,
          closed_to_arrival=case when v_payload ? 'closed_to_arrival' then (v_payload->>'closed_to_arrival')::boolean else rule.closed_to_arrival end,
          closed_to_departure=case when v_payload ? 'closed_to_departure' then (v_payload->>'closed_to_departure')::boolean else rule.closed_to_departure end,
          priority=case when v_payload ? 'priority' then (v_payload->>'priority')::smallint else rule.priority end,
          is_active=case when v_action='disable' then false when v_payload ? 'is_active' then (v_payload->>'is_active')::boolean else rule.is_active end,
          source='manual',source_timestamp=null,
          provenance=case when v_payload ? 'provenance' then v_payload->'provenance' else rule.provenance end
        where rule.id=v_id and rule.version=v_expected_version returning to_jsonb(rule.*) into v_after;
      end if;

    elsif v_entity='calendar_override' then
      if v_action='create' then
        insert into public.hotel_calendar_overrides(
          id,hotel_id,room_rate_id,stay_date,
          nightly_rate,nightly_rate_mode,minimum_stay,minimum_stay_mode,maximum_stay,maximum_stay_mode,
          closed,closed_mode,closed_to_arrival,closed_to_arrival_mode,closed_to_departure,closed_to_departure_mode,
          reason,expires_at,actor_id,actor_type,source,source_timestamp,is_active,provenance
        ) values(
          v_id,v_hotel_id,(v_payload->>'room_rate_id')::uuid,(v_payload->>'stay_date')::date,
          case when v_payload ? 'nightly_rate' and v_payload->>'nightly_rate' is not null then (v_payload->>'nightly_rate')::numeric end,
          v_payload->>'nightly_rate_mode',
          case when v_payload ? 'minimum_stay' and v_payload->>'minimum_stay' is not null then (v_payload->>'minimum_stay')::integer end,
          v_payload->>'minimum_stay_mode',
          case when v_payload ? 'maximum_stay' and v_payload->>'maximum_stay' is not null then (v_payload->>'maximum_stay')::integer end,
          v_payload->>'maximum_stay_mode',
          case when v_payload ? 'closed' and v_payload->>'closed' is not null then (v_payload->>'closed')::boolean end,
          v_payload->>'closed_mode',
          case when v_payload ? 'closed_to_arrival' and v_payload->>'closed_to_arrival' is not null then (v_payload->>'closed_to_arrival')::boolean end,
          v_payload->>'closed_to_arrival_mode',
          case when v_payload ? 'closed_to_departure' and v_payload->>'closed_to_departure' is not null then (v_payload->>'closed_to_departure')::boolean end,
          v_payload->>'closed_to_departure_mode',
          btrim(v_payload->>'reason'),case when v_payload ? 'expires_at' and v_payload->>'expires_at' is not null then (v_payload->>'expires_at')::timestamptz end,
          auth.uid(),'admin',case when v_payload->>'source' in ('manual','legacy_preview','system') then v_payload->>'source' else 'manual' end,
          case when v_payload ? 'source_timestamp' and v_payload->>'source_timestamp' is not null then (v_payload->>'source_timestamp')::timestamptz end,
          coalesce((v_payload->>'is_active')::boolean,true),coalesce(v_payload->'provenance','{}'::jsonb)
        ) returning to_jsonb(hotel_calendar_overrides.*) into v_after;
      elsif v_action='delete' then
        delete from public.hotel_calendar_overrides exact_override where id=v_id and version=v_expected_version returning to_jsonb(exact_override.*) into v_before;
      else
        select to_jsonb(exact_override.*) into v_before from public.hotel_calendar_overrides exact_override where id=v_id;
        update public.hotel_calendar_overrides exact_override set
          nightly_rate=case when v_payload ? 'nightly_rate' and v_payload->>'nightly_rate' is not null then (v_payload->>'nightly_rate')::numeric when v_payload ? 'nightly_rate' then null else exact_override.nightly_rate end,
          nightly_rate_mode=case when v_payload ? 'nightly_rate_mode' then v_payload->>'nightly_rate_mode' else exact_override.nightly_rate_mode end,
          minimum_stay=case when v_payload ? 'minimum_stay' and v_payload->>'minimum_stay' is not null then (v_payload->>'minimum_stay')::integer when v_payload ? 'minimum_stay' then null else exact_override.minimum_stay end,
          minimum_stay_mode=case when v_payload ? 'minimum_stay_mode' then v_payload->>'minimum_stay_mode' else exact_override.minimum_stay_mode end,
          maximum_stay=case when v_payload ? 'maximum_stay' and v_payload->>'maximum_stay' is not null then (v_payload->>'maximum_stay')::integer when v_payload ? 'maximum_stay' then null else exact_override.maximum_stay end,
          maximum_stay_mode=case when v_payload ? 'maximum_stay_mode' then v_payload->>'maximum_stay_mode' else exact_override.maximum_stay_mode end,
          closed=case when v_payload ? 'closed' and v_payload->>'closed' is not null then (v_payload->>'closed')::boolean when v_payload ? 'closed' then null else exact_override.closed end,
          closed_mode=case when v_payload ? 'closed_mode' then v_payload->>'closed_mode' else exact_override.closed_mode end,
          closed_to_arrival=case when v_payload ? 'closed_to_arrival' and v_payload->>'closed_to_arrival' is not null then (v_payload->>'closed_to_arrival')::boolean when v_payload ? 'closed_to_arrival' then null else exact_override.closed_to_arrival end,
          closed_to_arrival_mode=case when v_payload ? 'closed_to_arrival_mode' then v_payload->>'closed_to_arrival_mode' else exact_override.closed_to_arrival_mode end,
          closed_to_departure=case when v_payload ? 'closed_to_departure' and v_payload->>'closed_to_departure' is not null then (v_payload->>'closed_to_departure')::boolean when v_payload ? 'closed_to_departure' then null else exact_override.closed_to_departure end,
          closed_to_departure_mode=case when v_payload ? 'closed_to_departure_mode' then v_payload->>'closed_to_departure_mode' else exact_override.closed_to_departure_mode end,
          reason=btrim(v_payload->>'reason'),expires_at=case
            when v_payload ? 'expires_at' and v_payload->>'expires_at' is not null
              then (v_payload->>'expires_at')::timestamptz
            when v_payload ? 'expires_at' then null
            else exact_override.expires_at
          end,
          actor_id=auth.uid(),actor_type='admin',source=case when v_payload->>'source' in ('manual','legacy_preview','system') then v_payload->>'source' else 'manual' end,
          source_timestamp=case when v_payload ? 'source_timestamp' and v_payload->>'source_timestamp' is not null then (v_payload->>'source_timestamp')::timestamptz else exact_override.source_timestamp end,
          is_active=case when v_action='disable' then false when v_payload ? 'is_active' then (v_payload->>'is_active')::boolean else exact_override.is_active end,
          provenance=case when v_payload ? 'provenance' then v_payload->'provenance' else exact_override.provenance end
        where exact_override.id=v_id and exact_override.version=v_expected_version returning to_jsonb(exact_override.*) into v_after;
      end if;

    elsif v_entity='occupancy_tier' then
      if v_action='create' then
        insert into public.hotel_room_rate_occupancy_tiers(id,hotel_id,room_rate_id,guest_count,threshold_nights,nightly_rate,is_active,source,source_timestamp,provenance)
        values(v_id,v_hotel_id,(v_payload->>'room_rate_id')::uuid,(v_payload->>'guest_count')::smallint,(v_payload->>'threshold_nights')::integer,
          (v_payload->>'nightly_rate')::numeric,coalesce((v_payload->>'is_active')::boolean,false),
          case when v_payload->>'source' in ('legacy_preview','system') then v_payload->>'source' else 'manual' end,
          case when v_payload ? 'source_timestamp' and v_payload->>'source_timestamp' is not null then (v_payload->>'source_timestamp')::timestamptz end,
          coalesce(v_payload->'provenance','{}'::jsonb)) returning to_jsonb(hotel_room_rate_occupancy_tiers.*) into v_after;
      elsif v_action='delete' then
        delete from public.hotel_room_rate_occupancy_tiers tier where id=v_id and version=v_expected_version returning to_jsonb(tier.*) into v_before;
      else
        select to_jsonb(tier.*) into v_before from public.hotel_room_rate_occupancy_tiers tier where id=v_id;
        update public.hotel_room_rate_occupancy_tiers tier set
          guest_count=case when v_payload ? 'guest_count' then (v_payload->>'guest_count')::smallint else tier.guest_count end,
          threshold_nights=case when v_payload ? 'threshold_nights' then (v_payload->>'threshold_nights')::integer else tier.threshold_nights end,
          nightly_rate=case when v_payload ? 'nightly_rate' then (v_payload->>'nightly_rate')::numeric else tier.nightly_rate end,
          is_active=case when v_action='disable' then false when v_payload ? 'is_active' then (v_payload->>'is_active')::boolean else tier.is_active end,
          source=case when v_payload->>'source' in ('legacy_preview','system') then v_payload->>'source' when v_payload ? 'source' then 'manual' else tier.source end,
          source_timestamp=case when v_payload ? 'source_timestamp' and v_payload->>'source_timestamp' is not null then (v_payload->>'source_timestamp')::timestamptz else tier.source_timestamp end,
          provenance=case when v_payload ? 'provenance' then v_payload->'provenance' else tier.provenance end
        where tier.id=v_id and tier.version=v_expected_version returning to_jsonb(tier.*) into v_after;
      end if;

    else
      v_room_type_id:=(v_payload->>'room_type_id')::uuid; v_stay_date:=(v_payload->>'stay_date')::date;
      v_activity_id:=md5(v_room_type_id::text || ':' || v_stay_date::text)::uuid;
      if v_action='delete' then
        delete from public.hotel_daily_inventory inventory
        where inventory.room_type_id=v_room_type_id and inventory.stay_date=v_stay_date and inventory.version=v_expected_version
        returning to_jsonb(inventory.*) into v_before;
      elsif v_expected_version=0 then
        v_reason:=coalesce(nullif(btrim(v_payload->>'reason'),''),nullif(btrim(v_payload#>>'{provenance,reason}'),''));
        v_expires_at:=case
          when v_payload ? 'expires_at' and v_payload->>'expires_at' is not null
            then (v_payload->>'expires_at')::timestamptz
          when v_payload ? 'expires_at' then null
          when coalesce(v_payload->'provenance','{}'::jsonb) ? 'expires_at'
               and v_payload#>>'{provenance,expires_at}' is not null
            then (v_payload#>>'{provenance,expires_at}')::timestamptz
          when coalesce(v_payload->'provenance','{}'::jsonb) ? 'expires_at' then null
          else null
        end;
        insert into public.hotel_daily_inventory(room_type_id,stay_date,sellable_units,closed,sellable_units_mode,closed_mode,source,source_timestamp,reason,expires_at,actor_id,provenance)
        values(v_room_type_id,v_stay_date,
          case when coalesce(v_payload->>'sellable_units_mode','set')='clear'
            then (select room_type.base_inventory_count from public.hotel_room_types room_type where room_type.id=v_room_type_id)
            else (v_payload->>'sellable_units')::integer end,
          case when coalesce(v_payload->>'closed_mode','set')='clear' then false else coalesce((v_payload->>'closed')::boolean,false) end,
          coalesce(v_payload->>'sellable_units_mode','set'),coalesce(v_payload->>'closed_mode','set'),'manual',
          case when v_payload ? 'source_timestamp' and v_payload->>'source_timestamp' is not null then (v_payload->>'source_timestamp')::timestamptz end,
          v_reason,v_expires_at,auth.uid(),coalesce(v_payload->'provenance','{}'::jsonb)) returning to_jsonb(hotel_daily_inventory.*) into v_after;
      else
        select to_jsonb(inventory.*) into v_before from public.hotel_daily_inventory inventory where room_type_id=v_room_type_id and stay_date=v_stay_date;
        v_reason:=coalesce(nullif(btrim(v_payload->>'reason'),''),nullif(btrim(v_payload#>>'{provenance,reason}'),''));
        update public.hotel_daily_inventory inventory set
          sellable_units=case
            when v_payload ? 'sellable_units_mode' and v_payload->>'sellable_units_mode'='clear'
              then (select room_type.base_inventory_count from public.hotel_room_types room_type where room_type.id=v_room_type_id)
            when v_payload ? 'sellable_units' then (v_payload->>'sellable_units')::integer
            else inventory.sellable_units end,
          closed=case
            when v_payload ? 'closed_mode' and v_payload->>'closed_mode'='clear' then false
            when v_payload ? 'closed' then (v_payload->>'closed')::boolean
            else inventory.closed end,
          sellable_units_mode=case when v_payload ? 'sellable_units_mode' then v_payload->>'sellable_units_mode' else inventory.sellable_units_mode end,
          closed_mode=case when v_payload ? 'closed_mode' then v_payload->>'closed_mode' else inventory.closed_mode end,
          source='manual',source_timestamp=null,reason=v_reason,expires_at=case
            when v_payload ? 'expires_at' and v_payload->>'expires_at' is not null
              then (v_payload->>'expires_at')::timestamptz
            when v_payload ? 'expires_at' then null
            when coalesce(v_payload->'provenance','{}'::jsonb) ? 'expires_at'
                 and v_payload#>>'{provenance,expires_at}' is not null
              then (v_payload#>>'{provenance,expires_at}')::timestamptz
            when coalesce(v_payload->'provenance','{}'::jsonb) ? 'expires_at' then null
            else inventory.expires_at
          end,actor_id=auth.uid(),
          provenance=case when v_payload ? 'provenance' then v_payload->'provenance' else inventory.provenance end
        where inventory.room_type_id=v_room_type_id and inventory.stay_date=v_stay_date and inventory.version=v_expected_version
        returning to_jsonb(inventory.*) into v_after;
      end if;
    end if;

    get diagnostics v_affected=row_count;
    if coalesce(v_affected,0)<>1 then raise exception using errcode = '40001', message = 'hotels_v2_h2b_stale_during_apply'; end if;
    if v_entity<>'daily_inventory' then v_activity_id:=v_id; end if;
    insert into public.hotel_activity_log(hotel_id,entity_type,entity_id,action,before_state,after_state,actor_type,actor_id,source,correlation_id)
    values(v_hotel_id,v_entity,v_activity_id,
      case when v_action='upsert' then case when v_expected_version=0 then 'create' else 'update' end else v_action end,
      v_before,v_after,'admin',auth.uid(),'hotels_v2_h2b_calendar_plan',p_correlation_id);
  end loop;

  return jsonb_build_object(
    'correlation_id',p_correlation_id,
    'calendar',public.hotel_v2_admin_get_calendar(v_hotel_id,v_from,v_to)
  );
end;
$function$;


create or replace function public.hotel_v2_admin_get_calendar(
  p_hotel_id uuid,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  v_result jsonb;
  v_snapshot_token text;
  v_as_of timestamptz := statement_timestamp();
  v_snapshot_valid_until timestamptz;
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_hotel_id is null or p_start_date is null or p_end_date is null
     or p_end_date < p_start_date or (p_end_date - p_start_date) > 61 then
    raise exception using errcode = '22023', message = 'hotels_v2_h2b_invalid_calendar_query';
  end if;
  if not exists (select 1 from public.hotels where id = p_hotel_id) then
    raise exception using errcode = 'P0002', message = 'hotels_v2_h2b_property_not_found';
  end if;

  select md5(concat_ws('|',
    p_hotel_id::text,
    p_start_date::text,
    p_end_date::text,
    (select property.updated_at::text from public.hotels property where property.id=p_hotel_id),
    coalesce((
      select string_agg(room_type.id::text || ':' || room_type.version::text, ',' order by room_type.id)
      from public.hotel_room_types room_type where room_type.hotel_id = p_hotel_id
    ),''),
    coalesce((
      select string_agg(room_rate.id::text || ':' || room_rate.version::text, ',' order by room_rate.id)
      from public.hotel_room_rates room_rate where room_rate.hotel_id = p_hotel_id
    ),''),
    coalesce((
      select string_agg(rate_plan.id::text || ':' || rate_plan.version::text, ',' order by rate_plan.id)
      from public.hotel_rate_plans rate_plan where rate_plan.hotel_id=p_hotel_id
    ),''),
    coalesce((
      select string_agg(rule.id::text || ':' || rule.version::text, ',' order by rule.id)
      from public.hotel_rate_rules rule join public.hotel_room_rates room_rate on room_rate.id = rule.room_rate_id
      where room_rate.hotel_id = p_hotel_id and rule.valid_from <= p_end_date + 1 and rule.valid_to >= p_start_date
    ),''),
    coalesce((
      select string_agg(exact_override.id::text || ':' || exact_override.version::text || ':'
        || (exact_override.expires_at is null or exact_override.expires_at > v_as_of)::text, ',' order by exact_override.id)
      from public.hotel_calendar_overrides exact_override
      where exact_override.hotel_id = p_hotel_id and exact_override.stay_date between p_start_date and p_end_date + 1
    ),''),
    coalesce((
      select string_agg(tier.id::text || ':' || tier.version::text, ',' order by tier.id)
      from public.hotel_room_rate_occupancy_tiers tier where tier.hotel_id = p_hotel_id
    ),''),
    coalesce((
      select string_agg(inventory.room_type_id::text || ':' || inventory.stay_date::text || ':' || inventory.version::text || ':'
        || (inventory.expires_at is null or inventory.expires_at > v_as_of)::text, ',' order by inventory.room_type_id, inventory.stay_date)
      from public.hotel_daily_inventory inventory join public.hotel_room_types room_type on room_type.id = inventory.room_type_id
      where room_type.hotel_id = p_hotel_id and inventory.stay_date between p_start_date and p_end_date
    ),''),
    coalesce((
      select string_agg(daily_rate.room_rate_id::text || ':' || daily_rate.stay_date::text || ':' || daily_rate.version::text, ',' order by daily_rate.room_rate_id,daily_rate.stay_date)
      from public.hotel_daily_rates daily_rate join public.hotel_room_rates room_rate on room_rate.id=daily_rate.room_rate_id
      where room_rate.hotel_id=p_hotel_id and daily_rate.stay_date between p_start_date and p_end_date
    ),'')
  )) into v_snapshot_token;

  select min(expiry_value) into v_snapshot_valid_until
  from (
    select exact_override.expires_at expiry_value
    from public.hotel_calendar_overrides exact_override
    where exact_override.hotel_id=p_hotel_id
      and exact_override.stay_date between p_start_date and p_end_date + 1
      and exact_override.is_active and exact_override.expires_at>v_as_of
    union all
    select inventory.expires_at
    from public.hotel_daily_inventory inventory
    join public.hotel_room_types room_type on room_type.id=inventory.room_type_id
    where room_type.hotel_id=p_hotel_id
      and inventory.stay_date between p_start_date and p_end_date
      and inventory.expires_at>v_as_of
  ) active_expiry;

  select jsonb_build_object(
    'hotel_id',p_hotel_id,
    'start_date',p_start_date,
    'end_date',p_end_date,
    'snapshot_token',v_snapshot_token,
    'snapshot_as_of',v_as_of,
    'snapshot_valid_until',v_snapshot_valid_until,
    'property',(select to_jsonb(property) from public.hotels property where property.id = p_hotel_id),
    'room_types',coalesce((
      select jsonb_agg(to_jsonb(room_type) order by room_type.sort_order, room_type.id)
      from public.hotel_room_types room_type where room_type.hotel_id = p_hotel_id
    ),'[]'::jsonb),
    'room_rates',coalesce((
      select jsonb_agg(
        to_jsonb(room_rate) || jsonb_build_object(
          'room_name_i18n',room_type.name_i18n,
          'room_code',room_type.code,
          'room_version',room_type.version,
          'rate_plan_name_i18n',rate_plan.name_i18n,
          'rate_plan_code',rate_plan.code,
          'rate_plan_version',rate_plan.version
        ) order by room_type.sort_order, room_rate.sort_order, room_rate.id
      )
      from public.hotel_room_rates room_rate
      join public.hotel_room_types room_type on room_type.id = room_rate.room_type_id
      join public.hotel_rate_plans rate_plan on rate_plan.id = room_rate.rate_plan_id
      where room_rate.hotel_id = p_hotel_id
    ),'[]'::jsonb),
    'rate_rules',coalesce((
      select jsonb_agg(to_jsonb(rule) order by rule.room_rate_id, rule.priority desc, rule.valid_from, rule.id)
      from public.hotel_rate_rules rule join public.hotel_room_rates room_rate on room_rate.id = rule.room_rate_id
      where room_rate.hotel_id = p_hotel_id and rule.valid_from <= p_end_date and rule.valid_to >= p_start_date
    ),'[]'::jsonb),
    'occupancy_tiers',coalesce((
      select jsonb_agg(to_jsonb(tier) order by tier.room_rate_id, tier.guest_count, tier.threshold_nights, tier.id)
      from public.hotel_room_rate_occupancy_tiers tier where tier.hotel_id = p_hotel_id
    ),'[]'::jsonb),
    'calendar_overrides',coalesce((
      select jsonb_agg(to_jsonb(exact_override) order by exact_override.room_rate_id, exact_override.stay_date)
      from public.hotel_calendar_overrides exact_override
      where exact_override.hotel_id = p_hotel_id and exact_override.stay_date between p_start_date and p_end_date
    ),'[]'::jsonb),
    'daily_inventory',coalesce((
      select jsonb_agg(to_jsonb(inventory) order by inventory.room_type_id, inventory.stay_date)
      from public.hotel_daily_inventory inventory join public.hotel_room_types room_type on room_type.id = inventory.room_type_id
      where room_type.hotel_id = p_hotel_id and inventory.stay_date between p_start_date and p_end_date
    ),'[]'::jsonb),
    'daily_rates',coalesce((
      select jsonb_agg(to_jsonb(daily_rate) order by daily_rate.room_rate_id, daily_rate.stay_date)
      from public.hotel_daily_rates daily_rate join public.hotel_room_rates room_rate on room_rate.id = daily_rate.room_rate_id
      where room_rate.hotel_id = p_hotel_id and daily_rate.stay_date between p_start_date and p_end_date
    ),'[]'::jsonb),
    'effective_cells',coalesce((
      select jsonb_agg(jsonb_build_object(
        'room_rate_id',room_rate.id,
        'room_type_id',room_rate.room_type_id,
        'stay_date',calendar_day.stay_date,
        'ok',coalesce((resolved.quote->>'ok')::boolean,false),
        'requestable',coalesce((resolved.quote->>'requestable')::boolean,false),
        'nightly_rate',(resolved.night->>'nightly_rate')::numeric,
        'currency',coalesce(resolved.night->>'currency',room_rate.currency::text),
        'sellable_units',(resolved.night->>'sellable_units')::integer,
        'closed',coalesce((resolved.night->>'closed')::boolean,true),
        'minimum_stay',(resolved.night->>'minimum_stay')::integer,
        'maximum_stay',(resolved.night->>'maximum_stay')::integer,
        'closed_to_arrival',coalesce((resolved.night->>'closed_to_arrival')::boolean,false),
        'closed_to_departure',coalesce((resolved.night->>'closed_to_departure')::boolean,false),
        'source',resolved.night->>'source',
        'provenance',coalesce(resolved.night->'provenance','{}'::jsonb),
        'blocking_reasons',coalesce(resolved.quote->'blocking_reasons','[]'::jsonb)
      ) order by room_rate.sort_order, room_rate.id, calendar_day.stay_date)
      from public.hotel_room_rates room_rate
      join public.hotel_room_types room_type on room_type.id = room_rate.room_type_id
      cross join lateral (
        select day_value::date stay_date
        from generate_series(p_start_date::timestamp, p_end_date::timestamp, interval '1 day') day_value
      ) calendar_day
      cross join lateral (
        select quote,
               case when jsonb_array_length(coalesce(quote->'nightly_breakdown','[]'::jsonb)) > 0
                 then quote->'nightly_breakdown'->0 else '{}'::jsonb end night
        from (select public.hotel_v2_admin_resolve_rate(
          room_rate.id,calendar_day.stay_date,calendar_day.stay_date + 1,
          greatest(1,least(2,room_type.capacity_adults + room_type.capacity_children))
        ) quote) quote_result
      ) resolved
      where room_rate.hotel_id = p_hotel_id
    ),'[]'::jsonb),
    'activity',coalesce((
      select jsonb_agg(to_jsonb(activity_row) order by activity_row.created_at desc, activity_row.id desc)
      from (
        select activity.* from public.hotel_activity_log activity
        where activity.hotel_id = p_hotel_id
          and activity.entity_type in ('rate_rule','calendar_override','daily_inventory','occupancy_tier')
        order by activity.created_at desc, activity.id desc limit 100
      ) activity_row
    ),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$function$;

comment on function public.hotel_v2_admin_resolve_rate(uuid,date,date,integer) is
  'Admin-only authoritative H2B stay resolver: occupancy tier/base, weekday rule, range rule, exact override and safety closure, with restrictions and provenance.';
comment on function public.hotel_v2_admin_get_calendar(uuid,date,date) is
  'Admin-only bounded H2B calendar snapshot with raw versioned rows and flattened effective cells from the authoritative resolver.';
comment on function public.hotel_v2_admin_apply_calendar_plan(jsonb,uuid) is
  'Admin-only all-or-nothing reviewed H2B plan. Exact dates/IDs, complete stale preflight, rule ambiguity validation and append-only activity are mandatory.';

revoke all on function public.hotel_v2_admin_resolve_rate(uuid,date,date,integer)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_get_calendar(uuid,date,date)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_apply_calendar_plan(jsonb,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.hotel_v2_admin_resolve_rate(uuid,date,date,integer) to authenticated;
grant execute on function public.hotel_v2_admin_get_calendar(uuid,date,date) to authenticated;
grant execute on function public.hotel_v2_admin_apply_calendar_plan(jsonb,uuid) to authenticated;

do $h2b_postconditions$
declare
  v_snapshot record;
  v_count bigint;
  v_fingerprint text;
begin
  if exists(select 1 from public.hotel_calendar_overrides)
     or exists(select 1 from public.hotel_room_rate_occupancy_tiers) then
    raise exception using errcode = '23514', message = 'hotels_v2_h2b_new_tables_not_empty';
  end if;

  for v_snapshot in select * from hotels_v2_h2b_protected_snapshot loop
    if v_snapshot.relation_name='hotel_rate_rules' then
      select count(*),md5(coalesce(string_agg(jsonb_build_object(
        'id',row_value.id,'room_rate_id',row_value.room_rate_id,'valid_from',row_value.valid_from,
        'valid_to',row_value.valid_to,'weekdays',row_value.weekdays,'nightly_rate',row_value.nightly_rate,
        'minimum_stay',row_value.minimum_stay,'maximum_stay',row_value.maximum_stay,
        'closed_to_arrival',row_value.closed_to_arrival,'closed_to_departure',row_value.closed_to_departure,
        'priority',row_value.priority,'is_active',row_value.is_active,'version',row_value.version,
        'created_at',row_value.created_at,'updated_at',row_value.updated_at
      )::text,'|' order by row_value.id),'')) into v_count,v_fingerprint from public.hotel_rate_rules row_value;
    elsif v_snapshot.relation_name='hotel_daily_inventory' then
      select count(*),md5(coalesce(string_agg(jsonb_build_object(
        'room_type_id',row_value.room_type_id,'stay_date',row_value.stay_date,
        'sellable_units',row_value.sellable_units,'closed',row_value.closed,
        'source_timestamp',row_value.source_timestamp,'provenance',row_value.provenance,
        'version',row_value.version,'updated_at',row_value.updated_at
      )::text,'|' order by row_value.room_type_id,row_value.stay_date),'')) into v_count,v_fingerprint from public.hotel_daily_inventory row_value;
    elsif v_snapshot.relation_name='hotel_daily_rates' then
      select count(*),md5(coalesce(string_agg(jsonb_build_object(
        'room_rate_id',row_value.room_rate_id,'stay_date',row_value.stay_date,'nightly_rate',row_value.nightly_rate,
        'minimum_stay',row_value.minimum_stay,'maximum_stay',row_value.maximum_stay,'closed',row_value.closed,
        'closed_to_arrival',row_value.closed_to_arrival,'closed_to_departure',row_value.closed_to_departure,
        'source_timestamp',row_value.source_timestamp,'provenance',row_value.provenance,
        'version',row_value.version,'updated_at',row_value.updated_at
      )::text,'|' order by row_value.room_rate_id,row_value.stay_date),'')) into v_count,v_fingerprint from public.hotel_daily_rates row_value;
    else
      execute format(
        'select count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,''|'' order by row_value.id),'''')) from public.%I row_value',
        v_snapshot.relation_name
      ) into v_count,v_fingerprint;
    end if;
    if v_count is distinct from v_snapshot.row_count or v_fingerprint is distinct from v_snapshot.fingerprint then
      raise exception using errcode = '23514', message = 'hotels_v2_h2b_protected_state_changed', detail = v_snapshot.relation_name;
    end if;
  end loop;

  if (select count(*) from public.site_settings) <> 1
     or not exists(select 1 from public.site_settings where id=1)
     or exists(select 1 from public.site_settings setting
    where setting.hotel_rooms_v2_enabled or setting.hotel_external_sync_enabled
       or setting.hotel_instant_booking_enabled or setting.hotel_stripe_connect_enabled) then
    raise exception using errcode = '23514', message = 'hotels_v2_h2b_flag_changed';
  end if;

  if not (select relrowsecurity from pg_class where oid='public.hotel_calendar_overrides'::regclass)
     or not (select relrowsecurity from pg_class where oid='public.hotel_room_rate_occupancy_tiers'::regclass)
     or has_table_privilege('anon','public.hotel_calendar_overrides','SELECT')
     or has_table_privilege('anon','public.hotel_room_rate_occupancy_tiers','SELECT')
     or has_table_privilege('authenticated','public.hotel_calendar_overrides','INSERT')
     or has_table_privilege('authenticated','public.hotel_room_rate_occupancy_tiers','INSERT')
     or has_function_privilege('anon','public.hotel_v2_h2b_validate_occupancy_tier_contract()','EXECUTE')
     or has_function_privilege('authenticated','public.hotel_v2_h2b_validate_occupancy_tier_contract()','EXECUTE')
     or has_function_privilege('service_role','public.hotel_v2_h2b_validate_occupancy_tier_contract()','EXECUTE')
     or has_function_privilege('anon','public.hotel_v2_h2b_guard_room_capacity_against_tiers()','EXECUTE')
     or has_function_privilege('authenticated','public.hotel_v2_h2b_guard_room_capacity_against_tiers()','EXECUTE')
     or has_function_privilege('service_role','public.hotel_v2_h2b_guard_room_capacity_against_tiers()','EXECUTE')
     or not exists(select 1 from pg_trigger where tgrelid='public.hotel_room_rate_occupancy_tiers'::regclass
       and tgname='hotel_room_rate_occupancy_tiers_capacity_guard' and not tgisinternal
       and tgfoid='public.hotel_v2_h2b_validate_occupancy_tier_contract()'::regprocedure)
     or not exists(select 1 from pg_trigger where tgrelid='public.hotel_room_types'::regclass
       and tgname='hotel_room_types_occupancy_tier_capacity_guard' and not tgisinternal
       and tgfoid='public.hotel_v2_h2b_guard_room_capacity_against_tiers()'::regprocedure)
     or has_function_privilege('anon','public.hotel_v2_admin_get_calendar(uuid,date,date)','EXECUTE')
     or has_function_privilege('anon','public.hotel_v2_admin_resolve_rate(uuid,date,date,integer)','EXECUTE')
     or has_function_privilege('anon','public.hotel_v2_admin_apply_calendar_plan(jsonb,uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.hotel_v2_admin_get_calendar(uuid,date,date)','EXECUTE')
     or not has_function_privilege('authenticated','public.hotel_v2_admin_resolve_rate(uuid,date,date,integer)','EXECUTE')
     or not has_function_privilege('authenticated','public.hotel_v2_admin_apply_calendar_plan(jsonb,uuid)','EXECUTE') then
    raise exception using errcode = '23514', message = 'hotels_v2_h2b_security_contract_mismatch';
  end if;
end
$h2b_postconditions$;

commit;
