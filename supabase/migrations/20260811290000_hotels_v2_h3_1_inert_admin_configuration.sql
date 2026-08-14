begin;
set transaction isolation level repeatable read;

-- Hotels 2.0 H3.1: inert Admin configuration contracts only.
--
-- This migration deliberately creates no Hotel configuration rows, exposes no
-- public/partner quote or booking RPC, changes no property architecture, and
-- leaves every Hotels V2 capability flag disabled.  H3 activation must consume
-- these reviewed contracts through a separate server-authoritative release.

lock table public.site_settings in share row exclusive mode;

do $h3_1_preconditions$
declare
  v_shadow_definition text;
begin
  if to_regclass('public.hotel_room_types') is null
     or to_regclass('public.hotel_rate_plans') is null
     or to_regclass('public.hotel_pricing_schedules') is null
     or to_regclass('public.hotel_activity_log') is null
     or to_regprocedure('public.hotel_v2_h2a_require_admin()') is null
     or to_regprocedure('public.hotel_v2_h2a_keys_allowed(jsonb,text[])') is null
     or to_regprocedure('public.hotel_v2_set_updated_at_and_version()') is null
     or to_regprocedure('public.hotel_v2_admin_get_property_workspace(uuid)') is null
     or to_regprocedure('public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)') is null then
    raise exception using errcode='55000',message='hotels_v2_h3_1_prerequisite_missing';
  end if;

  select pg_get_functiondef(
    'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure
  ) into v_shadow_definition;
  if v_shadow_definition not like '%hotels_v2_h2b2_preserve_reviewed_property_policy_v1%'
     or v_shadow_definition not like '%hotels_v2_h2b1_preserve_reviewed_rate_plan_v1%'
     or v_shadow_definition not like '%hotels_v2_h2b1_shadow_room_three_way_conflict%' then
    raise exception using errcode='55000',message='hotels_v2_h3_1_h2b2_contract_missing';
  end if;

  if to_regclass('public.hotel_room_allocation_rules') is not null
     or to_regclass('public.hotel_room_allocation_rule_items') is not null
     or to_regclass('public.hotel_payment_policies') is not null
     or to_regclass('public.hotel_payment_policy_terms') is not null
     or to_regclass('public.hotel_commission_policies') is not null
     or to_regclass('public.hotel_calendar_source_configs') is not null
     or to_regprocedure('public.hotel_v2_admin_get_h3_1_configuration(uuid)') is not null
     or to_regprocedure('public.hotel_v2_admin_apply_h3_1_configuration(jsonb,uuid)') is not null
     or exists(select 1 from information_schema.columns
       where table_schema='public' and table_name='hotels' and column_name='minimum_stay_nights')
     or exists(select 1 from information_schema.columns
       where table_schema='public' and table_name='hotel_pricing_schedules'
         and column_name='minimum_billable_occupancy')
     or exists(select 1 from information_schema.columns
       where table_schema='public' and table_name='hotel_rate_plans' and column_name='price_inclusions') then
    raise exception using errcode='42P07',message='hotels_v2_h3_1_objects_already_exist';
  end if;

  if (select count(*) from public.site_settings)<>1
     or not exists(select 1 from public.site_settings where id=1)
     or exists(select 1 from public.site_settings where id=1 and (
       hotel_rooms_v2_enabled or hotel_external_sync_enabled
       or hotel_instant_booking_enabled or hotel_stripe_connect_enabled
     )) then
    raise exception using errcode='55000',message='hotels_v2_h3_1_capability_state_unsafe';
  end if;
end
$h3_1_preconditions$;

create temporary table hotels_v2_h3_1_protected_snapshot(
  relation_name text primary key,
  row_count bigint not null,
  fingerprint text not null
) on commit drop;

insert into hotels_v2_h3_1_protected_snapshot
select 'hotels',count(*),md5(coalesce(string_agg(
    (to_jsonb(row_value)-'minimum_stay_nights')::text,'|' order by row_value.id),''))
  from public.hotels row_value
union all select 'hotel_room_types',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_room_types row_value
union all select 'hotel_rate_plans',count(*),md5(coalesce(string_agg(
    (to_jsonb(row_value)-'price_inclusions')::text,'|' order by row_value.id),''))
  from public.hotel_rate_plans row_value
union all select 'hotel_pricing_schedules',count(*),md5(coalesce(string_agg(
    (to_jsonb(row_value)-'minimum_billable_occupancy')::text,'|' order by row_value.id),''))
  from public.hotel_pricing_schedules row_value
union all select 'hotel_rate_rules',count(*),md5(coalesce(string_agg(
    to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_rate_rules row_value
union all select 'hotel_daily_inventory',count(*),md5(coalesce(string_agg(
    to_jsonb(row_value)::text,'|' order by row_value.room_type_id,row_value.stay_date),''))
  from public.hotel_daily_inventory row_value
union all select 'hotel_daily_rates',count(*),md5(coalesce(string_agg(
    to_jsonb(row_value)::text,'|' order by row_value.room_rate_id,row_value.stay_date),''))
  from public.hotel_daily_rates row_value
union all select 'hotel_calendar_overrides',count(*),md5(coalesce(string_agg(
    to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_calendar_overrides row_value
union all select 'hotel_bookings',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_bookings row_value
union all select 'partner_service_fulfillments',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.partner_service_fulfillments row_value
union all select 'hotel_activity_log',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_activity_log row_value
union all select 'site_settings',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.site_settings row_value;

create function public.hotel_v2_h3_1_codes_valid(p_codes text[])
returns boolean
language sql
immutable
set search_path=pg_catalog
as $function$
  select p_codes is not null
    and array_position(p_codes,null) is null
    and cardinality(p_codes)=(select count(distinct code) from unnest(p_codes) code)
    and not exists(
      select 1 from unnest(p_codes) code
      where code<>lower(btrim(code))
         or length(code) not between 1 and 80
         or code!~'^[a-z0-9][a-z0-9_-]*$'
    );
$function$;

revoke all on function public.hotel_v2_h3_1_codes_valid(text[])
  from public,anon,authenticated,service_role;
-- Existing Admin and backend/service maintenance of hotel_rate_plans must
-- still be able to satisfy the new CHECK constraint. This immutable predicate
-- exposes no data and grants no table mutation by itself.
grant execute on function public.hotel_v2_h3_1_codes_valid(text[])
  to authenticated,service_role;

alter table public.hotels
  add column minimum_stay_nights integer,
  add constraint hotels_h3_1_minimum_stay_check
    check(minimum_stay_nights is null or minimum_stay_nights>=1);

comment on column public.hotels.minimum_stay_nights is
  'Reviewed property default minimum stay for future Rooms V2 server quoting. NULL means not configured; legacy public runtime ignores it.';

alter table public.hotel_pricing_schedules
  add column minimum_billable_occupancy smallint not null default 1,
  add constraint hotel_pricing_schedules_h3_1_minimum_billable_check
    check(minimum_billable_occupancy between 1 and maximum_party_size);

comment on column public.hotel_pricing_schedules.minimum_billable_occupancy is
  'Future quote floor for occupancy lookup (for example one guest may be billed at the lowest configured two-guest tier). H3.1 does not resolve public quotes.';

alter table public.hotel_rate_plans
  add column price_inclusions text[] not null default '{}'::text[],
  add constraint hotel_rate_plans_h3_1_price_inclusions_check
    check(public.hotel_v2_h3_1_codes_valid(price_inclusions));

comment on column public.hotel_rate_plans.price_inclusions is
  'Reviewed normalized inclusion codes such as taxes or cleaning. The field is configuration only until H3 activation.';

create table public.hotel_room_allocation_rules(
  id uuid primary key,
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  code text not null,
  allocation_mode text not null,
  min_guest_count smallint not null,
  max_guest_count smallint not null,
  is_active boolean not null default false,
  review_status text not null default 'requires_review',
  sort_order integer not null default 1000,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_room_allocation_rules_id_hotel_key unique(id,hotel_id),
  constraint hotel_room_allocation_rules_hotel_code_key unique(hotel_id,code),
  constraint hotel_room_allocation_rules_code_check check(
    code=lower(btrim(code)) and length(code) between 1 and 80
    and code~'^[a-z0-9][a-z0-9_-]*$'
  ),
  constraint hotel_room_allocation_rules_mode_check check(
    allocation_mode in ('customer_choice','required_bundle')
  ),
  constraint hotel_room_allocation_rules_guest_range_check check(
    min_guest_count between 1 and 50 and max_guest_count between min_guest_count and 50
  ),
  constraint hotel_room_allocation_rules_bundle_exact_check check(
    allocation_mode<>'required_bundle' or min_guest_count=max_guest_count
  ),
  constraint hotel_room_allocation_rules_review_check check(
    review_status in ('requires_review','reviewed','disabled')
  ),
  constraint hotel_room_allocation_rules_active_review_check check(
    not is_active or review_status='reviewed'
  ),
  constraint hotel_room_allocation_rules_sort_check check(sort_order>=0),
  constraint hotel_room_allocation_rules_version_check check(version>0)
);

create table public.hotel_room_allocation_rule_items(
  id uuid primary key,
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  allocation_rule_id uuid not null,
  room_type_id uuid not null,
  units_required integer not null default 1,
  allocated_guest_count smallint,
  sort_order integer not null default 1000,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_room_allocation_rule_items_rule_hotel_fkey
    foreign key(allocation_rule_id,hotel_id)
    references public.hotel_room_allocation_rules(id,hotel_id) on delete cascade,
  constraint hotel_room_allocation_rule_items_room_hotel_fkey
    foreign key(room_type_id,hotel_id)
    references public.hotel_room_types(id,hotel_id) on delete restrict,
  constraint hotel_room_allocation_rule_items_rule_room_key
    unique(allocation_rule_id,room_type_id),
  constraint hotel_room_allocation_rule_items_units_check check(units_required>=1),
  constraint hotel_room_allocation_rule_items_guests_check check(
    allocated_guest_count is null or allocated_guest_count>=1
  ),
  constraint hotel_room_allocation_rule_items_sort_check check(sort_order>=0),
  constraint hotel_room_allocation_rule_items_version_check check(version>0)
);

create index hotel_room_allocation_rules_hotel_sort_idx
  on public.hotel_room_allocation_rules(hotel_id,is_active,sort_order,id);
create index hotel_room_allocation_rule_items_rule_sort_idx
  on public.hotel_room_allocation_rule_items(allocation_rule_id,sort_order,id);

comment on table public.hotel_room_allocation_rules is
  'Reviewed future H3 party-to-room allocation configuration. One exact required_bundle rule per party size removes ambiguous split semantics.';
comment on column public.hotel_room_allocation_rules.allocation_mode is
  'customer_choice offers eligible alternatives; required_bundle allocates every listed room using fixed item guest counts.';
comment on table public.hotel_room_allocation_rule_items is
  'Exact Room Types participating in an allocation rule. allocated_guest_count is NULL for customer choice; for a reviewed bundle it is the total guests allocated across units_required of that Room Type.';

create table public.hotel_payment_policies(
  id uuid primary key,
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  code text not null,
  name_i18n jsonb not null default '{}'::jsonb,
  currency character(3) not null default 'EUR',
  is_active boolean not null default false,
  review_status text not null default 'requires_review',
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_payment_policies_id_hotel_key unique(id,hotel_id),
  constraint hotel_payment_policies_hotel_code_key unique(hotel_id,code),
  constraint hotel_payment_policies_code_check check(
    code=lower(btrim(code)) and length(code) between 1 and 80
    and code~'^[a-z0-9][a-z0-9_-]*$'
  ),
  constraint hotel_payment_policies_name_check check(jsonb_typeof(name_i18n)='object'),
  constraint hotel_payment_policies_currency_check check(currency::text~'^[A-Z]{3}$'),
  constraint hotel_payment_policies_review_check check(
    review_status in ('requires_review','reviewed','disabled')
  ),
  constraint hotel_payment_policies_active_review_check check(
    not is_active or review_status='reviewed'
  ),
  constraint hotel_payment_policies_version_check check(version>0)
);

create table public.hotel_payment_policy_terms(
  id uuid primary key,
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  payment_policy_id uuid not null,
  sequence integer not null,
  due_event text not null,
  amount_mode text not null,
  amount_value numeric(12,2),
  recipient text not null,
  payment_methods text[] not null,
  instructions_i18n jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_payment_policy_terms_policy_hotel_fkey
    foreign key(payment_policy_id,hotel_id)
    references public.hotel_payment_policies(id,hotel_id) on delete cascade,
  constraint hotel_payment_policy_terms_policy_sequence_key unique(payment_policy_id,sequence),
  constraint hotel_payment_policy_terms_sequence_check check(sequence>=1),
  constraint hotel_payment_policy_terms_due_event_check check(
    due_event in ('at_booking','after_partner_acceptance','before_arrival','on_arrival')
  ),
  constraint hotel_payment_policy_terms_amount_mode_check check(
    amount_mode in ('percent_total','flat','remaining_balance')
  ),
  constraint hotel_payment_policy_terms_amount_check check(
    (amount_mode='percent_total' and amount_value>0 and amount_value<=100)
    or (amount_mode='flat' and amount_value>=0)
    or (amount_mode='remaining_balance' and amount_value is null)
  ),
  constraint hotel_payment_policy_terms_recipient_check check(recipient in ('partner','platform')),
  constraint hotel_payment_policy_terms_methods_check check(
    cardinality(payment_methods)>=1
    and public.hotel_v2_h3_1_codes_valid(payment_methods)
    and payment_methods<@array['bank_transfer','cash','card','online']::text[]
  ),
  constraint hotel_payment_policy_terms_instructions_check check(jsonb_typeof(instructions_i18n)='object'),
  constraint hotel_payment_policy_terms_version_check check(version>0)
);

create index hotel_payment_policies_hotel_idx
  on public.hotel_payment_policies(hotel_id,is_active,code,id);
create unique index hotel_payment_policies_one_active_per_hotel_uidx
  on public.hotel_payment_policies(hotel_id) where is_active;
create index hotel_payment_policy_terms_policy_idx
  on public.hotel_payment_policy_terms(payment_policy_id,sequence,id);

comment on table public.hotel_payment_policies is
  'Future H3 request-confirmation payment schedule configuration; it creates no charge and does not replace existing service_deposit rules in H3.1.';
comment on table public.hotel_payment_policy_terms is
  'Ordered inert due-event configuration: at booking, after partner acceptance, before arrival or on arrival. Example: 50 percent to partner after acceptance, then remaining balance to partner on arrival by cash or card.';

create table public.hotel_commission_policies(
  id uuid primary key,
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  code text not null,
  commission_mode text not null,
  amount numeric(12,2) not null,
  currency character(3) not null default 'EUR',
  is_active boolean not null default false,
  review_status text not null default 'requires_review',
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_commission_policies_hotel_code_key unique(hotel_id,code),
  constraint hotel_commission_policies_code_check check(
    code=lower(btrim(code)) and length(code) between 1 and 80
    and code~'^[a-z0-9][a-z0-9_-]*$'
  ),
  constraint hotel_commission_policies_mode_check check(
    commission_mode in ('per_allocated_room_per_night','percent_booking_total')
  ),
  constraint hotel_commission_policies_amount_check check(
    amount>=0 and (commission_mode<>'percent_booking_total' or amount<=100)
  ),
  constraint hotel_commission_policies_currency_check check(currency::text~'^[A-Z]{3}$'),
  constraint hotel_commission_policies_review_check check(
    review_status in ('requires_review','reviewed','disabled')
  ),
  constraint hotel_commission_policies_active_review_check check(
    not is_active or review_status='reviewed'
  ),
  constraint hotel_commission_policies_version_check check(version>0)
);

create index hotel_commission_policies_hotel_idx
  on public.hotel_commission_policies(hotel_id,is_active,code,id);
create unique index hotel_commission_policies_one_active_per_hotel_uidx
  on public.hotel_commission_policies(hotel_id) where is_active;

comment on table public.hotel_commission_policies is
  'Separate future H3 commercial commission configuration. Supports per allocated room/night or percent of authoritative booking total, never inferred from payment due terms.';

create table public.hotel_calendar_source_configs(
  id uuid primary key,
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  room_type_id uuid,
  code text not null,
  source_type text not null,
  external_reference text,
  configuration jsonb not null default '{}'::jsonb,
  is_enabled boolean not null default false,
  review_status text not null default 'requires_review',
  priority smallint not null default 0,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_calendar_source_configs_room_hotel_fkey
    foreign key(room_type_id,hotel_id)
    references public.hotel_room_types(id,hotel_id) on delete cascade,
  constraint hotel_calendar_source_configs_hotel_code_key unique(hotel_id,code),
  constraint hotel_calendar_source_configs_code_check check(
    code=lower(btrim(code)) and length(code) between 1 and 80
    and code~'^[a-z0-9][a-z0-9_-]*$'
  ),
  constraint hotel_calendar_source_configs_source_check check(
    source_type in ('manual','booking_com','airbnb','ical')
  ),
  constraint hotel_calendar_source_configs_reference_check check(
    external_reference is null or length(btrim(external_reference)) between 1 and 500
  ),
  constraint hotel_calendar_source_configs_configuration_check check(
    jsonb_typeof(configuration)='object'
  ),
  constraint hotel_calendar_source_configs_external_inert_check check(
    source_type='manual' or not is_enabled
  ),
  constraint hotel_calendar_source_configs_review_check check(
    review_status in ('requires_review','reviewed','disabled')
  ),
  constraint hotel_calendar_source_configs_enabled_review_check check(
    not is_enabled or review_status='reviewed'
  ),
  constraint hotel_calendar_source_configs_version_check check(version>0)
);

create index hotel_calendar_source_configs_hotel_idx
  on public.hotel_calendar_source_configs(hotel_id,room_type_id,priority desc,id);
create unique index hotel_calendar_source_configs_one_property_enabled_uidx
  on public.hotel_calendar_source_configs(hotel_id)
  where is_enabled and room_type_id is null;
create unique index hotel_calendar_source_configs_one_room_enabled_uidx
  on public.hotel_calendar_source_configs(hotel_id,room_type_id)
  where is_enabled and room_type_id is not null;

comment on table public.hotel_calendar_source_configs is
  'Adapter-facing source metadata only. H3.1 contains no Booking.com, Airbnb or iCal connector and forbids enabling an external source.';
comment on column public.hotel_calendar_source_configs.configuration is
  'Non-secret adapter metadata. Credentials and tokens must never be stored here.';

-- Constraint helpers validate reviewed aggregate graphs at transaction end, so
-- an atomic RPC may replace child rows without weakening the final contract.
create function public.hotel_v2_h3_1_validate_allocation_rule(p_rule_id uuid)
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
          item.allocated_guest_count is not null or item.units_required<>1
          or coalesce(room_type.max_occupancy,
            room_type.capacity_adults+room_type.capacity_children)<v_rule.max_guest_count
        ))
        or (v_rule.allocation_mode='required_bundle' and (
          item.allocated_guest_count is null
          or item.allocated_guest_count>
            coalesce(room_type.max_occupancy,
              room_type.capacity_adults+room_type.capacity_children)*item.units_required
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

create function public.hotel_v2_h3_1_allocation_rule_constraint_trigger()
returns trigger
language plpgsql
set search_path=pg_catalog,public
as $function$
begin
  if tg_table_name='hotel_room_allocation_rules' then
    perform public.hotel_v2_h3_1_validate_allocation_rule(new.id);
  else
    if tg_op<>'INSERT' then
      perform public.hotel_v2_h3_1_validate_allocation_rule(old.allocation_rule_id);
    end if;
    if tg_op<>'DELETE' and (tg_op='INSERT' or new.allocation_rule_id is distinct from old.allocation_rule_id) then
      perform public.hotel_v2_h3_1_validate_allocation_rule(new.allocation_rule_id);
    end if;
  end if;
  return null;
end
$function$;

create function public.hotel_v2_h3_1_validate_room_allocation_inventory(p_room_type_id uuid)
returns void
language plpgsql
set search_path=pg_catalog,public
as $function$
begin
  if exists(
    select 1
    from public.hotel_room_allocation_rule_items item
    join public.hotel_room_allocation_rules rule on rule.id=item.allocation_rule_id
    join public.hotel_room_types room_type on room_type.id=item.room_type_id
    where item.room_type_id=p_room_type_id and rule.is_active and rule.review_status='reviewed'
      and (
        room_type.status<>'active'
        or (room_type.inventory_mode='pooled'
          and item.units_required>room_type.base_inventory_count)
        or (room_type.inventory_mode='unitized' and item.units_required>(
          select count(*) from public.hotel_units unit_row
          where unit_row.room_type_id=room_type.id and unit_row.status='active'
        ))
      )
  ) then
    raise exception using errcode='23514',message='hotels_v2_h3_1_active_allocation_inventory_invalid';
  end if;
end
$function$;

create function public.hotel_v2_h3_1_room_inventory_constraint_trigger()
returns trigger
language plpgsql
set search_path=pg_catalog,public
as $function$
begin
  if tg_table_name='hotel_room_types' then
    perform public.hotel_v2_h3_1_validate_room_allocation_inventory(new.id);
  else
    if tg_op<>'INSERT' then
      perform public.hotel_v2_h3_1_validate_room_allocation_inventory(old.room_type_id);
    end if;
    if tg_op<>'DELETE' and (tg_op='INSERT' or new.room_type_id is distinct from old.room_type_id) then
      perform public.hotel_v2_h3_1_validate_room_allocation_inventory(new.room_type_id);
    end if;
  end if;
  return null;
end
$function$;

create function public.hotel_v2_h3_1_validate_payment_policy(p_policy_id uuid)
returns void
language plpgsql
set search_path=pg_catalog,public
as $function$
declare
  v_policy public.hotel_payment_policies%rowtype;
  v_count integer;
  v_remaining integer;
  v_percent numeric;
  v_max_sequence integer;
  v_remaining_sequence integer;
begin
  select * into v_policy from public.hotel_payment_policies where id=p_policy_id;
  if not found then return; end if;
  select count(*)::integer,
    count(*) filter(where amount_mode='remaining_balance')::integer,
    coalesce(sum(amount_value) filter(where amount_mode='percent_total'),0),
    max(sequence),
    max(sequence) filter(where amount_mode='remaining_balance')
  into v_count,v_remaining,v_percent,v_max_sequence,v_remaining_sequence
  from public.hotel_payment_policy_terms where payment_policy_id=v_policy.id;
  if v_remaining>1 or v_percent>100
     or (v_remaining=1 and (
       v_percent=100 or v_remaining_sequence is distinct from v_max_sequence
     ))
     or (v_policy.review_status='reviewed' and (
       v_count<1 or not (
         (v_remaining=0 and v_percent=100)
         or (v_remaining=1 and v_percent<100)
       )
     )) then
    raise exception using errcode='23514',message='hotels_v2_h3_1_invalid_reviewed_payment_policy';
  end if;
end
$function$;

create function public.hotel_v2_h3_1_payment_policy_constraint_trigger()
returns trigger
language plpgsql
set search_path=pg_catalog,public
as $function$
begin
  if tg_table_name='hotel_payment_policies' then
    perform public.hotel_v2_h3_1_validate_payment_policy(new.id);
  else
    if tg_op<>'INSERT' then
      perform public.hotel_v2_h3_1_validate_payment_policy(old.payment_policy_id);
    end if;
    if tg_op<>'DELETE' and (tg_op='INSERT' or new.payment_policy_id is distinct from old.payment_policy_id) then
      perform public.hotel_v2_h3_1_validate_payment_policy(new.payment_policy_id);
    end if;
  end if;
  return null;
end
$function$;

create constraint trigger hotel_room_allocation_rules_contract_guard
after insert or update on public.hotel_room_allocation_rules
deferrable initially deferred for each row
execute function public.hotel_v2_h3_1_allocation_rule_constraint_trigger();
create constraint trigger hotel_room_allocation_rule_items_contract_guard
after insert or update or delete on public.hotel_room_allocation_rule_items
deferrable initially deferred for each row
execute function public.hotel_v2_h3_1_allocation_rule_constraint_trigger();
create constraint trigger hotel_room_types_h3_1_allocation_inventory_guard
after update of status,inventory_mode,base_inventory_count on public.hotel_room_types
deferrable initially deferred for each row
execute function public.hotel_v2_h3_1_room_inventory_constraint_trigger();
create constraint trigger hotel_units_h3_1_allocation_inventory_guard
after insert or update or delete on public.hotel_units
deferrable initially deferred for each row
execute function public.hotel_v2_h3_1_room_inventory_constraint_trigger();
create constraint trigger hotel_payment_policies_contract_guard
after insert or update on public.hotel_payment_policies
deferrable initially deferred for each row
execute function public.hotel_v2_h3_1_payment_policy_constraint_trigger();
create constraint trigger hotel_payment_policy_terms_contract_guard
after insert or update or delete on public.hotel_payment_policy_terms
deferrable initially deferred for each row
execute function public.hotel_v2_h3_1_payment_policy_constraint_trigger();

do $h3_1_version_triggers$
declare v_table_name text;
begin
  foreach v_table_name in array array[
    'hotel_room_allocation_rules','hotel_room_allocation_rule_items',
    'hotel_payment_policies','hotel_payment_policy_terms',
    'hotel_commission_policies','hotel_calendar_source_configs'
  ] loop
    execute format('alter table public.%I enable row level security',v_table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.hotel_v2_set_updated_at_and_version()',
      v_table_name||'_set_updated_at_and_version',v_table_name
    );
  end loop;
end
$h3_1_version_triggers$;

revoke all on function public.hotel_v2_h3_1_validate_allocation_rule(uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_h3_1_allocation_rule_constraint_trigger()
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_h3_1_validate_room_allocation_inventory(uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_h3_1_room_inventory_constraint_trigger()
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_h3_1_validate_payment_policy(uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_h3_1_payment_policy_constraint_trigger()
  from public,anon,authenticated,service_role;

create function public.hotel_v2_h3_1_allocation_items_fingerprint(p_rule_id uuid)
returns text
language sql
stable
set search_path=pg_catalog,public
as $function$
  select md5(coalesce(string_agg(jsonb_build_object(
    'id',item.id,'hotel_id',item.hotel_id,'allocation_rule_id',item.allocation_rule_id,
    'room_type_id',item.room_type_id,'units_required',item.units_required,
    'allocated_guest_count',item.allocated_guest_count,'sort_order',item.sort_order,
    'version',item.version,'updated_at',item.updated_at
  )::text,'|' order by item.sort_order,item.id),''))
  from public.hotel_room_allocation_rule_items item
  where item.allocation_rule_id=p_rule_id;
$function$;

create function public.hotel_v2_h3_1_payment_terms_fingerprint(p_policy_id uuid)
returns text
language sql
stable
set search_path=pg_catalog,public
as $function$
  select md5(coalesce(string_agg(jsonb_build_object(
    'id',term.id,'hotel_id',term.hotel_id,'payment_policy_id',term.payment_policy_id,
    'sequence',term.sequence,'due_event',term.due_event,'amount_mode',term.amount_mode,
    'amount_value',term.amount_value,'recipient',term.recipient,
    'payment_methods',term.payment_methods,'instructions_i18n',term.instructions_i18n,
    'version',term.version,'updated_at',term.updated_at
  )::text,'|' order by term.sequence,term.id),''))
  from public.hotel_payment_policy_terms term
  where term.payment_policy_id=p_policy_id;
$function$;

revoke all on function public.hotel_v2_h3_1_allocation_items_fingerprint(uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_h3_1_payment_terms_fingerprint(uuid)
  from public,anon,authenticated,service_role;

alter table public.hotel_activity_log
  drop constraint hotel_activity_log_entity_type_check,
  add constraint hotel_activity_log_entity_type_check check(entity_type in (
    'property','room_type','unit','rate_plan','room_rate','rate_rule',
    'calendar_override','daily_inventory','occupancy_tier',
    'pricing_schedule','allocation_rule','payment_policy',
    'commission_policy','calendar_source'
  ));

alter table public.hotel_room_allocation_rules enable row level security;
alter table public.hotel_room_allocation_rule_items enable row level security;
alter table public.hotel_payment_policies enable row level security;
alter table public.hotel_payment_policy_terms enable row level security;
alter table public.hotel_commission_policies enable row level security;
alter table public.hotel_calendar_source_configs enable row level security;

do $h3_1_rls_and_grants$
declare v_table_name text;
begin
  foreach v_table_name in array array[
    'hotel_room_allocation_rules','hotel_room_allocation_rule_items',
    'hotel_payment_policies','hotel_payment_policy_terms',
    'hotel_commission_policies','hotel_calendar_source_configs'
  ] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using(public.is_current_user_admin())',
      v_table_name||'_admin_select',v_table_name
    );
    execute format('revoke all on table public.%I from public,anon,authenticated',v_table_name);
    execute format('grant select on table public.%I to authenticated',v_table_name);
    execute format('revoke all on table public.%I from service_role',v_table_name);
    execute format('grant select on table public.%I to service_role',v_table_name);
  end loop;
end
$h3_1_rls_and_grants$;

-- The dedicated read RPC keeps H3.1 configuration separate from the legacy
-- workspace payload. It exposes exact versions and aggregate fingerprints but
-- no booking/customer PII.
create function public.hotel_v2_admin_get_h3_1_configuration(p_hotel_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path=pg_catalog,public,auth
as $function$
declare
  v_hotel public.hotels%rowtype;
begin
  perform public.hotel_v2_h2a_require_admin();
  select * into v_hotel from public.hotels where id=p_hotel_id;
  if not found then
    raise exception using errcode='P0002',message='hotels_v2_h3_1_property_not_found';
  end if;

  return jsonb_build_object(
    'property',jsonb_build_object(
      'id',v_hotel.id,
      'updated_at',v_hotel.updated_at,
      'architecture_version',v_hotel.architecture_version,
      'booking_mode',v_hotel.booking_mode,
      'currency',v_hotel.currency,
      'minimum_stay_nights',v_hotel.minimum_stay_nights,
      'children_policy',v_hotel.children_policy,
      'minimum_child_age',v_hotel.minimum_child_age
    ),
    'room_types',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',room_type.id,'code',room_type.code,'name_i18n',room_type.name_i18n,
        'status',room_type.status,'max_occupancy',room_type.max_occupancy,
        'capacity_adults',room_type.capacity_adults,
        'capacity_children',room_type.capacity_children,
        'inventory_mode',room_type.inventory_mode,
        'base_inventory_count',room_type.base_inventory_count,
        'version',room_type.version,'updated_at',room_type.updated_at
      ) order by room_type.sort_order,room_type.id)
      from public.hotel_room_types room_type where room_type.hotel_id=p_hotel_id
    ),'[]'::jsonb),
    'pricing_schedules',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',schedule.id,'code',schedule.code,'name_i18n',schedule.name_i18n,
        'application_scope',schedule.application_scope,'currency',schedule.currency,
        'maximum_party_size',schedule.maximum_party_size,
        'minimum_billable_occupancy',schedule.minimum_billable_occupancy,
        'is_active',schedule.is_active,'review_status',schedule.review_status,
        'source',schedule.source,'version',schedule.version,'updated_at',schedule.updated_at
      ) order by schedule.code,schedule.id)
      from public.hotel_pricing_schedules schedule where schedule.hotel_id=p_hotel_id
    ),'[]'::jsonb),
    'rate_plans',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',rate_plan.id,'code',rate_plan.code,'name_i18n',rate_plan.name_i18n,
        'price_inclusions',rate_plan.price_inclusions,'is_active',rate_plan.is_active,
        'version',rate_plan.version,'updated_at',rate_plan.updated_at
      ) order by rate_plan.sort_order,rate_plan.id)
      from public.hotel_rate_plans rate_plan where rate_plan.hotel_id=p_hotel_id
    ),'[]'::jsonb),
    'allocation_rules',coalesce((
      select jsonb_agg(to_jsonb(rule_row) order by rule_row.sort_order,rule_row.id)
      from (
        select rule.*,
          public.hotel_v2_h3_1_allocation_items_fingerprint(rule.id) items_fingerprint,
          coalesce((select jsonb_agg(to_jsonb(item) order by item.sort_order,item.id)
            from public.hotel_room_allocation_rule_items item
            where item.allocation_rule_id=rule.id),'[]'::jsonb) items
        from public.hotel_room_allocation_rules rule
        where rule.hotel_id=p_hotel_id
      ) rule_row
    ),'[]'::jsonb),
    'payment_policies',coalesce((
      select jsonb_agg(to_jsonb(policy_row) order by policy_row.code,policy_row.id)
      from (
        select policy.*,
          public.hotel_v2_h3_1_payment_terms_fingerprint(policy.id) terms_fingerprint,
          coalesce((select jsonb_agg(to_jsonb(term) order by term.sequence,term.id)
            from public.hotel_payment_policy_terms term
            where term.payment_policy_id=policy.id),'[]'::jsonb) terms
        from public.hotel_payment_policies policy
        where policy.hotel_id=p_hotel_id
      ) policy_row
    ),'[]'::jsonb),
    'commission_policies',coalesce((
      select jsonb_agg(to_jsonb(policy) order by policy.code,policy.id)
      from public.hotel_commission_policies policy where policy.hotel_id=p_hotel_id
    ),'[]'::jsonb),
    'calendar_sources',coalesce((
      select jsonb_agg(to_jsonb(source_row) order by source_row.priority desc,source_row.code,source_row.id)
      from public.hotel_calendar_source_configs source_row where source_row.hotel_id=p_hotel_id
    ),'[]'::jsonb),
    'feature_flags',(
      select jsonb_build_object(
        'hotel_rooms_v2_enabled',setting.hotel_rooms_v2_enabled,
        'hotel_external_sync_enabled',setting.hotel_external_sync_enabled,
        'hotel_instant_booking_enabled',setting.hotel_instant_booking_enabled,
        'hotel_stripe_connect_enabled',setting.hotel_stripe_connect_enabled
      ) from public.site_settings setting where setting.id=1
    )
  );
end
$function$;

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
  v_hotel_id uuid;
  v_hotel public.hotels%rowtype;
  v_expected_property_updated_at timestamptz;
  v_reviewed_at timestamptz;
  v_operation jsonb;
  v_child jsonb;
  v_entity text;
  v_action text;
  v_id uuid;
  v_expected_version bigint;
  v_expected_fingerprint text;
  v_payload jsonb;
  v_before jsonb;
  v_after jsonb;
  v_schedule public.hotel_pricing_schedules%rowtype;
  v_rate_plan public.hotel_rate_plans%rowtype;
  v_rule public.hotel_room_allocation_rules%rowtype;
  v_payment public.hotel_payment_policies%rowtype;
  v_commission public.hotel_commission_policies%rowtype;
  v_calendar public.hotel_calendar_source_configs%rowtype;
  v_room public.hotel_room_types%rowtype;
  v_child_count integer;
  v_sum_guests integer;
  v_sum_units integer;
  v_remaining_count integer;
  v_percent_sum numeric;
  v_max_sequence integer;
  v_remaining_sequence integer;
  v_methods text[];
  v_inclusions text[];
begin
  perform public.hotel_v2_h2a_require_admin();

  -- A caller may invoke more than one reviewed operation inside one outer
  -- transaction. Re-establish deferred aggregate checks for this graph build;
  -- the function forces them IMMEDIATE again before returning.
  set constraints hotel_room_allocation_rules_contract_guard,
    hotel_room_allocation_rule_items_contract_guard,
    hotel_payment_policies_contract_guard,
    hotel_payment_policy_terms_contract_guard deferred;

  if p_plan is null or jsonb_typeof(p_plan)<>'object' or p_correlation_id is null
     or not public.hotel_v2_h2a_keys_allowed(
       p_plan,array['hotel_id','expected_property_updated_at','reviewed_at','operations']
     )
     or not (p_plan ?& array['hotel_id','expected_property_updated_at','reviewed_at','operations'])
     or jsonb_typeof(p_plan->'operations')<>'array'
     or jsonb_array_length(p_plan->'operations') not between 1 and 100 then
    raise exception using errcode='22023',message='hotels_v2_h3_1_invalid_reviewed_plan';
  end if;

  v_hotel_id:=(p_plan->>'hotel_id')::uuid;
  v_expected_property_updated_at:=(p_plan->>'expected_property_updated_at')::timestamptz;
  v_reviewed_at:=(p_plan->>'reviewed_at')::timestamptz;
  if v_reviewed_at>clock_timestamp()+interval '5 minutes'
     or v_reviewed_at<clock_timestamp()-interval '30 minutes' then
    raise exception using errcode='22023',message='hotels_v2_h3_1_review_expired';
  end if;

  select * into v_hotel from public.hotels where id=v_hotel_id for update;
  if not found then
    raise exception using errcode='P0002',message='hotels_v2_h3_1_property_not_found';
  end if;
  if v_hotel.updated_at is distinct from v_expected_property_updated_at then
    raise exception using errcode='PT409',message='hotels_v2_h3_1_stale_property';
  end if;
  if exists(select 1 from public.site_settings where id=1 and (
    hotel_rooms_v2_enabled or hotel_external_sync_enabled
    or hotel_instant_booking_enabled or hotel_stripe_connect_enabled
  )) then
    raise exception using errcode='55000',message='hotels_v2_h3_1_capability_enabled';
  end if;
  if exists(select 1 from public.hotel_activity_log where correlation_id=p_correlation_id) then
    raise exception using errcode='23505',message='hotels_v2_h3_1_correlation_already_used';
  end if;
  if exists(
    select 1
    from jsonb_array_elements(p_plan->'operations') operation(value)
    group by operation.value->>'entity',operation.value->>'id'
    having count(*)>1
  ) then
    raise exception using errcode='22023',message='hotels_v2_h3_1_duplicate_operation_target';
  end if;

  -- Lock and validate every exact target before the first mutation.
  for v_operation in select value from jsonb_array_elements(p_plan->'operations') loop
    if jsonb_typeof(v_operation)<>'object'
       or not public.hotel_v2_h2a_keys_allowed(v_operation,array[
         'entity','type','id','expected_version','expected_children_fingerprint','payload'
       ])
       or not (v_operation ?& array['entity','type','id','expected_version','payload'])
       or jsonb_typeof(v_operation->'payload')<>'object'
       or v_operation->>'id' is null
       or v_operation->>'expected_version' !~ '^[0-9]+$' then
      raise exception using errcode='22023',message='hotels_v2_h3_1_invalid_operation';
    end if;
    v_entity:=v_operation->>'entity';
    v_action:=v_operation->>'type';
    v_id:=(v_operation->>'id')::uuid;
    v_expected_version:=(v_operation->>'expected_version')::bigint;
    v_expected_fingerprint:=v_operation->>'expected_children_fingerprint';
    v_payload:=v_operation->'payload';

    if v_entity='property_configuration' then
      if v_action<>'update' or v_id<>v_hotel_id or v_expected_version<>0
         or not public.hotel_v2_h2a_keys_allowed(v_payload,array['minimum_stay_nights'])
         or not (v_payload?'minimum_stay_nights')
         or (v_payload->>'minimum_stay_nights' is not null and (
           v_payload->>'minimum_stay_nights' !~ '^[0-9]+$'
           or (v_payload->>'minimum_stay_nights')::integer<1
         )) then
        raise exception using errcode='22023',message='hotels_v2_h3_1_invalid_property_configuration';
      end if;

    elsif v_entity='pricing_schedule' then
      if v_action<>'update'
         or not public.hotel_v2_h2a_keys_allowed(v_payload,array['minimum_billable_occupancy'])
         or not (v_payload?'minimum_billable_occupancy')
         or v_payload->>'minimum_billable_occupancy' !~ '^[0-9]+$' then
        raise exception using errcode='22023',message='hotels_v2_h3_1_invalid_pricing_schedule_operation';
      end if;
      select * into v_schedule from public.hotel_pricing_schedules
      where id=v_id and hotel_id=v_hotel_id for update;
      if not found or v_schedule.version<>v_expected_version then
        raise exception using errcode='PT409',message='hotels_v2_h3_1_stale_pricing_schedule';
      end if;
      if (v_payload->>'minimum_billable_occupancy')::integer not between 1 and v_schedule.maximum_party_size then
        raise exception using errcode='23514',message='hotels_v2_h3_1_minimum_billable_occupancy_out_of_range';
      end if;

    elsif v_entity='rate_plan' then
      if v_action<>'update'
         or not public.hotel_v2_h2a_keys_allowed(v_payload,array['price_inclusions'])
         or jsonb_typeof(v_payload->'price_inclusions')<>'array' then
        raise exception using errcode='22023',message='hotels_v2_h3_1_invalid_rate_plan_operation';
      end if;
      v_inclusions:=array(
        select inclusion
        from jsonb_array_elements_text(v_payload->'price_inclusions') inclusion
        order by inclusion
      );
      if not public.hotel_v2_h3_1_codes_valid(v_inclusions) then
        raise exception using errcode='23514',message='hotels_v2_h3_1_invalid_price_inclusions';
      end if;
      select * into v_rate_plan from public.hotel_rate_plans
      where id=v_id and hotel_id=v_hotel_id for update;
      if not found or v_rate_plan.version<>v_expected_version then
        raise exception using errcode='PT409',message='hotels_v2_h3_1_stale_rate_plan';
      end if;

    elsif v_entity='allocation_rule' then
      if v_action not in ('create','update','disable') then
        raise exception using errcode='22023',message='hotels_v2_h3_1_invalid_allocation_action';
      end if;
      if v_action='create' then
        if v_expected_version<>0 or exists(select 1 from public.hotel_room_allocation_rules where id=v_id) then
          raise exception using errcode='23505',message='hotels_v2_h3_1_allocation_rule_create_conflict';
        end if;
      else
        select * into v_rule from public.hotel_room_allocation_rules
        where id=v_id and hotel_id=v_hotel_id for update;
        if not found or v_rule.version<>v_expected_version then
          raise exception using errcode='PT409',message='hotels_v2_h3_1_stale_allocation_rule';
        end if;
        perform 1 from public.hotel_room_allocation_rule_items
          where allocation_rule_id=v_id for update;
        if v_expected_fingerprint is null
           or public.hotel_v2_h3_1_allocation_items_fingerprint(v_id)<>v_expected_fingerprint then
          raise exception using errcode='PT409',message='hotels_v2_h3_1_stale_allocation_rule';
        end if;
      end if;
      if v_action='disable' then
        if v_payload<>'{}'::jsonb then
          raise exception using errcode='22023',message='hotels_v2_h3_1_disable_payload_must_be_empty';
        end if;
      else
        if not public.hotel_v2_h2a_keys_allowed(v_payload,array[
          'code','allocation_mode','min_guest_count','max_guest_count',
          'is_active','review_status','sort_order','items'
        ]) or not (v_payload ?& array[
          'code','allocation_mode','min_guest_count','max_guest_count',
          'is_active','review_status','sort_order','items'
        ]) or jsonb_typeof(v_payload->'items')<>'array'
           or v_payload->>'allocation_mode' not in ('customer_choice','required_bundle')
           or v_payload->>'review_status' not in ('requires_review','reviewed','disabled')
           or v_payload->>'min_guest_count' !~ '^[0-9]+$'
           or v_payload->>'max_guest_count' !~ '^[0-9]+$'
           or (v_payload->>'min_guest_count')::integer not between 1 and 50
           or (v_payload->>'max_guest_count')::integer not between (v_payload->>'min_guest_count')::integer and 50
           or (v_payload->>'allocation_mode'='required_bundle'
             and v_payload->>'min_guest_count'<>v_payload->>'max_guest_count')
           or ((v_payload->>'is_active')::boolean and v_payload->>'review_status'<>'reviewed') then
          raise exception using errcode='22023',message='hotels_v2_h3_1_invalid_allocation_rule_payload';
        end if;
        v_child_count:=jsonb_array_length(v_payload->'items');
        v_sum_guests:=0; v_sum_units:=0;
        if v_payload->>'review_status'='reviewed' and (
          v_child_count<1
          or (v_payload->>'allocation_mode'='customer_choice' and v_child_count<2)
        ) then
          raise exception using errcode='23514',message='hotels_v2_h3_1_reviewed_allocation_items_required';
        end if;
        if exists(select 1 from jsonb_array_elements(v_payload->'items') item(value)
          group by item.value->>'id' having count(*)>1)
           or exists(select 1 from jsonb_array_elements(v_payload->'items') item(value)
          group by item.value->>'room_type_id' having count(*)>1) then
          raise exception using errcode='23505',message='hotels_v2_h3_1_duplicate_allocation_item';
        end if;
        for v_child in select value from jsonb_array_elements(v_payload->'items') loop
          if jsonb_typeof(v_child)<>'object'
             or not public.hotel_v2_h2a_keys_allowed(v_child,array[
               'id','room_type_id','units_required','allocated_guest_count','sort_order'
             ])
             or not (v_child ?& array['id','room_type_id','units_required','allocated_guest_count','sort_order'])
             or v_child->>'units_required' !~ '^[0-9]+$'
             or (v_child->>'units_required')::integer<1 then
            raise exception using errcode='22023',message='hotels_v2_h3_1_invalid_allocation_item';
          end if;
          select * into v_room from public.hotel_room_types
          where id=(v_child->>'room_type_id')::uuid and hotel_id=v_hotel_id for share;
          if not found then
            raise exception using errcode='23503',message='hotels_v2_h3_1_allocation_room_outside_property';
          end if;
          if v_payload->>'allocation_mode'='customer_choice' then
            if v_child->>'allocated_guest_count' is not null
               or (v_child->>'units_required')::integer<>1
               or coalesce(v_room.max_occupancy,v_room.capacity_adults+v_room.capacity_children)
                 <(v_payload->>'max_guest_count')::integer then
              raise exception using errcode='23514',message='hotels_v2_h3_1_invalid_customer_choice_item';
            end if;
          else
            if v_child->>'allocated_guest_count' is null
               or v_child->>'allocated_guest_count' !~ '^[0-9]+$'
               or (v_child->>'allocated_guest_count')::integer<1
               or (v_child->>'allocated_guest_count')::integer>
                 coalesce(v_room.max_occupancy,v_room.capacity_adults+v_room.capacity_children)
                   *(v_child->>'units_required')::integer then
              raise exception using errcode='23514',message='hotels_v2_h3_1_invalid_required_bundle_item';
            end if;
            v_sum_guests:=v_sum_guests+(v_child->>'allocated_guest_count')::integer;
          end if;
          v_sum_units:=v_sum_units+(v_child->>'units_required')::integer;
          if (v_payload->>'is_active')::boolean and (
            v_room.status<>'active'
            or (v_room.inventory_mode='pooled'
              and (v_child->>'units_required')::integer>v_room.base_inventory_count)
            or (v_room.inventory_mode='unitized'
              and (v_child->>'units_required')::integer>(
                select count(*) from public.hotel_units unit_row
                where unit_row.room_type_id=v_room.id and unit_row.status='active'
              ))
          ) then
            raise exception using errcode='23514',message='hotels_v2_h3_1_allocation_room_not_sellable';
          end if;
        end loop;
        if v_payload->>'review_status'='reviewed'
           and v_payload->>'allocation_mode'='required_bundle'
           and (v_sum_units<2 or v_sum_guests<>(v_payload->>'min_guest_count')::integer) then
          raise exception using errcode='23514',message='hotels_v2_h3_1_required_bundle_split_mismatch';
        end if;
      end if;

    elsif v_entity='payment_policy' then
      if v_action not in ('create','update','disable') then
        raise exception using errcode='22023',message='hotels_v2_h3_1_invalid_payment_action';
      end if;
      if v_action='create' then
        if v_expected_version<>0 or exists(select 1 from public.hotel_payment_policies where id=v_id) then
          raise exception using errcode='23505',message='hotels_v2_h3_1_payment_policy_create_conflict';
        end if;
      else
        select * into v_payment from public.hotel_payment_policies
        where id=v_id and hotel_id=v_hotel_id for update;
        if not found or v_payment.version<>v_expected_version then
          raise exception using errcode='PT409',message='hotels_v2_h3_1_stale_payment_policy';
        end if;
        perform 1 from public.hotel_payment_policy_terms
          where payment_policy_id=v_id for update;
        if v_expected_fingerprint is null
           or public.hotel_v2_h3_1_payment_terms_fingerprint(v_id)<>v_expected_fingerprint then
          raise exception using errcode='PT409',message='hotels_v2_h3_1_stale_payment_policy';
        end if;
      end if;
      if v_action='disable' then
        if v_payload<>'{}'::jsonb then
          raise exception using errcode='22023',message='hotels_v2_h3_1_disable_payload_must_be_empty';
        end if;
      else
        if not public.hotel_v2_h2a_keys_allowed(v_payload,array[
          'code','name_i18n','currency','is_active','review_status','terms'
        ]) or not (v_payload ?& array[
          'code','name_i18n','currency','is_active','review_status','terms'
        ]) or jsonb_typeof(v_payload->'name_i18n')<>'object'
           or jsonb_typeof(v_payload->'terms')<>'array'
           or v_payload->>'currency'!~'^[A-Z]{3}$'
           or v_payload->>'review_status' not in ('requires_review','reviewed','disabled')
           or ((v_payload->>'is_active')::boolean and v_payload->>'review_status'<>'reviewed') then
          raise exception using errcode='22023',message='hotels_v2_h3_1_invalid_payment_policy_payload';
        end if;
        v_child_count:=jsonb_array_length(v_payload->'terms');
        v_remaining_count:=0; v_percent_sum:=0;
        v_max_sequence:=0; v_remaining_sequence:=null;
        if v_payload->>'review_status'='reviewed' and v_child_count<1 then
          raise exception using errcode='23514',message='hotels_v2_h3_1_reviewed_payment_terms_required';
        end if;
        if exists(select 1 from jsonb_array_elements(v_payload->'terms') term(value)
          group by term.value->>'id' having count(*)>1)
           or exists(select 1 from jsonb_array_elements(v_payload->'terms') term(value)
          group by term.value->>'sequence' having count(*)>1) then
          raise exception using errcode='23505',message='hotels_v2_h3_1_duplicate_payment_term';
        end if;
        for v_child in select value from jsonb_array_elements(v_payload->'terms') loop
          if jsonb_typeof(v_child)<>'object'
             or not public.hotel_v2_h2a_keys_allowed(v_child,array[
               'id','sequence','due_event','amount_mode','amount_value','recipient',
               'payment_methods','instructions_i18n'
             ])
             or not (v_child ?& array[
               'id','sequence','due_event','amount_mode','amount_value','recipient',
               'payment_methods','instructions_i18n'
             ])
             or v_child->>'sequence' !~ '^[0-9]+$' or (v_child->>'sequence')::integer<1
             or v_child->>'due_event' not in ('at_booking','after_partner_acceptance','before_arrival','on_arrival')
             or v_child->>'amount_mode' not in ('percent_total','flat','remaining_balance')
             or v_child->>'recipient' not in ('partner','platform')
             or jsonb_typeof(v_child->'payment_methods')<>'array'
             or jsonb_typeof(v_child->'instructions_i18n')<>'object' then
            raise exception using errcode='22023',message='hotels_v2_h3_1_invalid_payment_term';
          end if;
          v_methods:=array(select jsonb_array_elements_text(v_child->'payment_methods'));
          if cardinality(v_methods)<1 or not public.hotel_v2_h3_1_codes_valid(v_methods)
             or not v_methods<@array['bank_transfer','cash','card','online']::text[] then
            raise exception using errcode='23514',message='hotels_v2_h3_1_invalid_payment_methods';
          end if;
          if v_child->>'amount_mode'='remaining_balance' then
            if v_child->>'amount_value' is not null then
              raise exception using errcode='23514',message='hotels_v2_h3_1_remaining_balance_value_forbidden';
            end if;
            v_remaining_count:=v_remaining_count+1;
            v_remaining_sequence:=(v_child->>'sequence')::integer;
          elsif v_child->>'amount_value' is null
             or (v_child->>'amount_value')::numeric<0
             or (v_child->>'amount_mode'='percent_total' and (
               (v_child->>'amount_value')::numeric<=0 or (v_child->>'amount_value')::numeric>100
             )) then
            raise exception using errcode='23514',message='hotels_v2_h3_1_invalid_payment_amount';
          elsif v_child->>'amount_mode'='percent_total' then
            v_percent_sum:=v_percent_sum+(v_child->>'amount_value')::numeric;
          end if;
          v_max_sequence:=greatest(v_max_sequence,(v_child->>'sequence')::integer);
        end loop;
        if v_remaining_count>1 or v_percent_sum>100
           or (v_remaining_count=1 and (
             v_percent_sum=100
             or v_remaining_sequence is distinct from v_max_sequence
           ))
           or (v_payload->>'review_status'='reviewed'
             and not (
               (v_remaining_count=0 and v_percent_sum=100)
               or (v_remaining_count=1 and v_percent_sum<100)
             )) then
          raise exception using errcode='23514',message='hotels_v2_h3_1_invalid_payment_schedule_total';
        end if;
      end if;

    elsif v_entity='commission_policy' then
      if v_action not in ('create','update','disable') then
        raise exception using errcode='22023',message='hotels_v2_h3_1_invalid_commission_action';
      end if;
      if v_action='create' then
        if v_expected_version<>0 or exists(select 1 from public.hotel_commission_policies where id=v_id) then
          raise exception using errcode='23505',message='hotels_v2_h3_1_commission_policy_create_conflict';
        end if;
      else
        select * into v_commission from public.hotel_commission_policies
        where id=v_id and hotel_id=v_hotel_id for update;
        if not found or v_commission.version<>v_expected_version then
          raise exception using errcode='PT409',message='hotels_v2_h3_1_stale_commission_policy';
        end if;
      end if;
      if v_action='disable' then
        if v_payload<>'{}'::jsonb then raise exception using errcode='22023',message='hotels_v2_h3_1_disable_payload_must_be_empty'; end if;
      elsif not public.hotel_v2_h2a_keys_allowed(v_payload,array[
          'code','commission_mode','amount','currency','is_active','review_status'
        ]) or not (v_payload ?& array[
          'code','commission_mode','amount','currency','is_active','review_status'
        ]) or v_payload->>'commission_mode' not in (
          'per_allocated_room_per_night','percent_booking_total'
        )
           or (v_payload->>'amount')::numeric<0
           or (v_payload->>'commission_mode'='percent_booking_total'
             and (v_payload->>'amount')::numeric>100)
           or v_payload->>'currency'!~'^[A-Z]{3}$'
           or v_payload->>'review_status' not in ('requires_review','reviewed','disabled')
           or ((v_payload->>'is_active')::boolean and v_payload->>'review_status'<>'reviewed') then
        raise exception using errcode='22023',message='hotels_v2_h3_1_invalid_commission_policy_payload';
      end if;

    elsif v_entity='calendar_source' then
      if v_action not in ('create','update','disable') then
        raise exception using errcode='22023',message='hotels_v2_h3_1_invalid_calendar_source_action';
      end if;
      if v_action='create' then
        if v_expected_version<>0 or exists(select 1 from public.hotel_calendar_source_configs where id=v_id) then
          raise exception using errcode='23505',message='hotels_v2_h3_1_calendar_source_create_conflict';
        end if;
      else
        select * into v_calendar from public.hotel_calendar_source_configs
        where id=v_id and hotel_id=v_hotel_id for update;
        if not found or v_calendar.version<>v_expected_version then
          raise exception using errcode='PT409',message='hotels_v2_h3_1_stale_calendar_source';
        end if;
      end if;
      if v_action='disable' then
        if v_payload<>'{}'::jsonb then raise exception using errcode='22023',message='hotels_v2_h3_1_disable_payload_must_be_empty'; end if;
      else
        if not public.hotel_v2_h2a_keys_allowed(v_payload,array[
          'code','source_type','room_type_id','external_reference','configuration',
          'is_enabled','review_status','priority'
        ]) or not (v_payload ?& array[
          'code','source_type','room_type_id','external_reference','configuration',
          'is_enabled','review_status','priority'
        ]) or v_payload->>'source_type' not in ('manual','booking_com','airbnb','ical')
           or jsonb_typeof(v_payload->'configuration')<>'object'
           or v_payload->>'review_status' not in ('requires_review','reviewed','disabled')
           or ((v_payload->>'is_enabled')::boolean and (
             v_payload->>'review_status'<>'reviewed' or v_payload->>'source_type'<>'manual'
           )) then
          raise exception using errcode='22023',message='hotels_v2_h3_1_invalid_calendar_source_payload';
        end if;
        if v_payload->>'room_type_id' is not null then
          perform 1 from public.hotel_room_types
          where id=(v_payload->>'room_type_id')::uuid and hotel_id=v_hotel_id for share;
          if not found then
            raise exception using errcode='23503',message='hotels_v2_h3_1_calendar_source_room_outside_property';
          end if;
        end if;
      end if;
    else
      raise exception using errcode='22023',message='hotels_v2_h3_1_unknown_operation_entity';
    end if;
  end loop;

  -- Apply only after the complete reviewed plan and every concurrency token
  -- passed. Any later constraint error still rolls the single RPC transaction
  -- back in full.
  for v_operation in
    select operation.value
    from jsonb_array_elements(p_plan->'operations') with ordinality operation(value,ordinal)
    order by case when operation.value->>'type'='disable' then 0 else 1 end,operation.ordinal
  loop
    v_entity:=v_operation->>'entity'; v_action:=v_operation->>'type';
    v_id:=(v_operation->>'id')::uuid;
    v_expected_version:=(v_operation->>'expected_version')::bigint;
    v_payload:=v_operation->'payload';
    v_before:=null; v_after:=null;

    if v_entity='property_configuration' then
      select to_jsonb(hotel) into v_before from public.hotels hotel where id=v_hotel_id;
      if v_hotel.minimum_stay_nights is distinct from
         (case when v_payload->>'minimum_stay_nights' is null then null
           else (v_payload->>'minimum_stay_nights')::integer end) then
        update public.hotels hotel set minimum_stay_nights=
          case when v_payload->>'minimum_stay_nights' is null then null
            else (v_payload->>'minimum_stay_nights')::integer end
        where hotel.id=v_hotel_id and hotel.updated_at=v_expected_property_updated_at
        returning to_jsonb(hotel.*) into v_after;
        if v_after is null then raise exception using errcode='PT409',message='hotels_v2_h3_1_stale_property'; end if;
      end if;

    elsif v_entity='pricing_schedule' then
      select to_jsonb(schedule) into v_before from public.hotel_pricing_schedules schedule where id=v_id;
      update public.hotel_pricing_schedules schedule
      set minimum_billable_occupancy=(v_payload->>'minimum_billable_occupancy')::smallint
      where schedule.id=v_id and schedule.version=v_expected_version
      returning to_jsonb(schedule.*) into v_after;
      if v_after is null then raise exception using errcode='PT409',message='hotels_v2_h3_1_stale_pricing_schedule'; end if;

    elsif v_entity='rate_plan' then
      select to_jsonb(rate_plan) into v_before from public.hotel_rate_plans rate_plan where id=v_id;
      update public.hotel_rate_plans rate_plan set price_inclusions=
        array(
          select inclusion
          from jsonb_array_elements_text(v_payload->'price_inclusions') inclusion
          order by inclusion
        )
      where rate_plan.id=v_id and rate_plan.version=v_expected_version
      returning to_jsonb(rate_plan.*) into v_after;
      if v_after is null then raise exception using errcode='PT409',message='hotels_v2_h3_1_stale_rate_plan'; end if;

    elsif v_entity='allocation_rule' then
      if v_action='create' then
        insert into public.hotel_room_allocation_rules(
          id,hotel_id,code,allocation_mode,min_guest_count,max_guest_count,
          is_active,review_status,sort_order
        ) values(
          v_id,v_hotel_id,v_payload->>'code',v_payload->>'allocation_mode',
          (v_payload->>'min_guest_count')::smallint,(v_payload->>'max_guest_count')::smallint,
          (v_payload->>'is_active')::boolean,v_payload->>'review_status',
          (v_payload->>'sort_order')::integer
        );
      else
        select to_jsonb(rule)||jsonb_build_object(
          'items',(select coalesce(jsonb_agg(to_jsonb(item) order by item.sort_order,item.id),'[]'::jsonb)
            from public.hotel_room_allocation_rule_items item where item.allocation_rule_id=v_id)
        ) into v_before from public.hotel_room_allocation_rules rule where id=v_id;
        if v_action='disable' then
          update public.hotel_room_allocation_rules rule
          set is_active=false,review_status='disabled'
          where rule.id=v_id and rule.version=v_expected_version;
        else
          update public.hotel_room_allocation_rules rule set
            code=v_payload->>'code',allocation_mode=v_payload->>'allocation_mode',
            min_guest_count=(v_payload->>'min_guest_count')::smallint,
            max_guest_count=(v_payload->>'max_guest_count')::smallint,
            is_active=(v_payload->>'is_active')::boolean,
            review_status=v_payload->>'review_status',sort_order=(v_payload->>'sort_order')::integer
          where rule.id=v_id and rule.version=v_expected_version;
          delete from public.hotel_room_allocation_rule_items where allocation_rule_id=v_id;
        end if;
      end if;
      if v_action in ('create','update') then
        for v_child in select value from jsonb_array_elements(v_payload->'items') loop
          insert into public.hotel_room_allocation_rule_items(
            id,hotel_id,allocation_rule_id,room_type_id,units_required,allocated_guest_count,sort_order
          ) values(
            (v_child->>'id')::uuid,v_hotel_id,v_id,(v_child->>'room_type_id')::uuid,
            (v_child->>'units_required')::integer,
            case when v_child->>'allocated_guest_count' is null then null
              else (v_child->>'allocated_guest_count')::smallint end,
            (v_child->>'sort_order')::integer
          );
        end loop;
      end if;
      select to_jsonb(rule)||jsonb_build_object(
        'items',(select coalesce(jsonb_agg(to_jsonb(item) order by item.sort_order,item.id),'[]'::jsonb)
          from public.hotel_room_allocation_rule_items item where item.allocation_rule_id=v_id)
      ) into v_after from public.hotel_room_allocation_rules rule where id=v_id;

    elsif v_entity='payment_policy' then
      if v_action='create' then
        insert into public.hotel_payment_policies(
          id,hotel_id,code,name_i18n,currency,is_active,review_status
        ) values(
          v_id,v_hotel_id,v_payload->>'code',v_payload->'name_i18n',
          (v_payload->>'currency')::character(3),(v_payload->>'is_active')::boolean,
          v_payload->>'review_status'
        );
      else
        select to_jsonb(policy)||jsonb_build_object(
          'terms',(select coalesce(jsonb_agg(to_jsonb(term) order by term.sequence,term.id),'[]'::jsonb)
            from public.hotel_payment_policy_terms term where term.payment_policy_id=v_id)
        ) into v_before from public.hotel_payment_policies policy where id=v_id;
        if v_action='disable' then
          update public.hotel_payment_policies policy
          set is_active=false,review_status='disabled'
          where policy.id=v_id and policy.version=v_expected_version;
        else
          update public.hotel_payment_policies policy set
            code=v_payload->>'code',name_i18n=v_payload->'name_i18n',
            currency=(v_payload->>'currency')::character(3),
            is_active=(v_payload->>'is_active')::boolean,
            review_status=v_payload->>'review_status'
          where policy.id=v_id and policy.version=v_expected_version;
          delete from public.hotel_payment_policy_terms where payment_policy_id=v_id;
        end if;
      end if;
      if v_action in ('create','update') then
        for v_child in select value from jsonb_array_elements(v_payload->'terms') loop
          insert into public.hotel_payment_policy_terms(
            id,hotel_id,payment_policy_id,sequence,due_event,amount_mode,amount_value,
            recipient,payment_methods,instructions_i18n
          ) values(
            (v_child->>'id')::uuid,v_hotel_id,v_id,(v_child->>'sequence')::integer,
            v_child->>'due_event',v_child->>'amount_mode',
            case when v_child->>'amount_value' is null then null else (v_child->>'amount_value')::numeric end,
            v_child->>'recipient',array(
              select payment_method
              from jsonb_array_elements_text(v_child->'payment_methods') payment_method
              order by payment_method
            ),
            v_child->'instructions_i18n'
          );
        end loop;
      end if;
      select to_jsonb(policy)||jsonb_build_object(
        'terms',(select coalesce(jsonb_agg(to_jsonb(term) order by term.sequence,term.id),'[]'::jsonb)
          from public.hotel_payment_policy_terms term where term.payment_policy_id=v_id)
      ) into v_after from public.hotel_payment_policies policy where id=v_id;

    elsif v_entity='commission_policy' then
      if v_action='create' then
        insert into public.hotel_commission_policies(
          id,hotel_id,code,commission_mode,amount,currency,is_active,review_status
        ) values(
          v_id,v_hotel_id,v_payload->>'code',v_payload->>'commission_mode',
          (v_payload->>'amount')::numeric,(v_payload->>'currency')::character(3),
          (v_payload->>'is_active')::boolean,v_payload->>'review_status'
        ) returning to_jsonb(hotel_commission_policies.*) into v_after;
      else
        select to_jsonb(policy) into v_before from public.hotel_commission_policies policy where id=v_id;
        if v_action='disable' then
          update public.hotel_commission_policies policy set is_active=false,review_status='disabled'
          where policy.id=v_id and policy.version=v_expected_version
          returning to_jsonb(policy.*) into v_after;
        else
          update public.hotel_commission_policies policy set
            code=v_payload->>'code',commission_mode=v_payload->>'commission_mode',
            amount=(v_payload->>'amount')::numeric,currency=(v_payload->>'currency')::character(3),
            is_active=(v_payload->>'is_active')::boolean,review_status=v_payload->>'review_status'
          where policy.id=v_id and policy.version=v_expected_version
          returning to_jsonb(policy.*) into v_after;
        end if;
      end if;

    elsif v_entity='calendar_source' then
      if v_action='create' then
        insert into public.hotel_calendar_source_configs(
          id,hotel_id,room_type_id,code,source_type,external_reference,configuration,
          is_enabled,review_status,priority
        ) values(
          v_id,v_hotel_id,case when v_payload->>'room_type_id' is null then null
            else (v_payload->>'room_type_id')::uuid end,
          v_payload->>'code',v_payload->>'source_type',v_payload->>'external_reference',
          v_payload->'configuration',(v_payload->>'is_enabled')::boolean,
          v_payload->>'review_status',(v_payload->>'priority')::smallint
        ) returning to_jsonb(hotel_calendar_source_configs.*) into v_after;
      else
        select to_jsonb(source_row) into v_before from public.hotel_calendar_source_configs source_row where id=v_id;
        if v_action='disable' then
          update public.hotel_calendar_source_configs source_row
          set is_enabled=false,review_status='disabled'
          where source_row.id=v_id and source_row.version=v_expected_version
          returning to_jsonb(source_row.*) into v_after;
        else
          update public.hotel_calendar_source_configs source_row set
            room_type_id=case when v_payload->>'room_type_id' is null then null
              else (v_payload->>'room_type_id')::uuid end,
            code=v_payload->>'code',source_type=v_payload->>'source_type',
            external_reference=v_payload->>'external_reference',configuration=v_payload->'configuration',
            is_enabled=(v_payload->>'is_enabled')::boolean,
            review_status=v_payload->>'review_status',priority=(v_payload->>'priority')::smallint
          where source_row.id=v_id and source_row.version=v_expected_version
          returning to_jsonb(source_row.*) into v_after;
        end if;
      end if;
    end if;

    if v_after is not null and v_after is distinct from v_before then
      insert into public.hotel_activity_log(
        hotel_id,entity_type,entity_id,action,before_state,after_state,
        actor_type,actor_id,source,correlation_id
      ) values(
        v_hotel_id,
        case v_entity
          when 'property_configuration' then 'property'
          when 'pricing_schedule' then 'pricing_schedule'
          when 'rate_plan' then 'rate_plan'
          when 'allocation_rule' then 'allocation_rule'
          when 'payment_policy' then 'payment_policy'
          when 'commission_policy' then 'commission_policy'
          when 'calendar_source' then 'calendar_source'
        end,
        v_id,case when v_action='create' then 'create' when v_action='disable' then 'disable' else 'update' end,
        v_before,v_after,'admin',auth.uid(),'hotels_v2_h3_1_admin_configuration',p_correlation_id
      );
    end if;
  end loop;

  set constraints hotel_room_allocation_rules_contract_guard,
    hotel_room_allocation_rule_items_contract_guard,
    hotel_payment_policies_contract_guard,
    hotel_payment_policy_terms_contract_guard immediate;

  return jsonb_build_object(
    'correlation_id',p_correlation_id,
    'hotel_id',v_hotel_id,
    'configuration',public.hotel_v2_admin_get_h3_1_configuration(v_hotel_id)
  );
end
$function$;

comment on function public.hotel_v2_admin_get_h3_1_configuration(uuid) is
  'Admin-only inert H3.1 configuration snapshot with exact versions and aggregate child fingerprints; returns no booking PII.';
comment on function public.hotel_v2_admin_apply_h3_1_configuration(jsonb,uuid) is
  'Admin-only reviewed atomic H3.1 configuration mutation. Exact IDs, property updated_at, row versions and aggregate child fingerprints fail closed before writes.';

revoke all on function public.hotel_v2_admin_get_h3_1_configuration(uuid)
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_admin_apply_h3_1_configuration(jsonb,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.hotel_v2_admin_get_h3_1_configuration(uuid) to authenticated;
grant execute on function public.hotel_v2_admin_apply_h3_1_configuration(jsonb,uuid) to authenticated;

do $h3_1_postconditions$
declare
  v_snapshot record;
  v_count bigint;
  v_fingerprint text;
begin
  if exists(select 1 from public.site_settings where id=1 and (
       hotel_rooms_v2_enabled or hotel_external_sync_enabled
       or hotel_instant_booking_enabled or hotel_stripe_connect_enabled
     )) then
    raise exception using errcode='55000',message='hotels_v2_h3_1_public_state_changed';
  end if;

  if exists(select 1 from public.hotels where minimum_stay_nights is not null)
     or exists(select 1 from public.hotel_pricing_schedules where minimum_billable_occupancy<>1)
     or exists(select 1 from public.hotel_rate_plans where price_inclusions<>'{}'::text[])
     or (select count(*) from public.hotel_room_allocation_rules)<>0
     or (select count(*) from public.hotel_room_allocation_rule_items)<>0
     or (select count(*) from public.hotel_payment_policies)<>0
     or (select count(*) from public.hotel_payment_policy_terms)<>0
     or (select count(*) from public.hotel_commission_policies)<>0
     or (select count(*) from public.hotel_calendar_source_configs)<>0 then
    raise exception using errcode='55000',message='hotels_v2_h3_1_inert_seed_contract_failed';
  end if;

  for v_snapshot in select * from hotels_v2_h3_1_protected_snapshot loop
    if v_snapshot.relation_name='hotels' then
      select count(*),md5(coalesce(string_agg(
        (to_jsonb(row_value)-'minimum_stay_nights')::text,'|' order by row_value.id),''))
      into v_count,v_fingerprint from public.hotels row_value;
    elsif v_snapshot.relation_name='hotel_rate_plans' then
      select count(*),md5(coalesce(string_agg(
        (to_jsonb(row_value)-'price_inclusions')::text,'|' order by row_value.id),''))
      into v_count,v_fingerprint from public.hotel_rate_plans row_value;
    elsif v_snapshot.relation_name='hotel_pricing_schedules' then
      select count(*),md5(coalesce(string_agg(
        (to_jsonb(row_value)-'minimum_billable_occupancy')::text,'|' order by row_value.id),''))
      into v_count,v_fingerprint from public.hotel_pricing_schedules row_value;
    elsif v_snapshot.relation_name='hotel_rate_rules' then
      select count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
      into v_count,v_fingerprint from public.hotel_rate_rules row_value;
    elsif v_snapshot.relation_name='hotel_daily_inventory' then
      select count(*),md5(coalesce(string_agg(
        to_jsonb(row_value)::text,'|' order by row_value.room_type_id,row_value.stay_date),''))
      into v_count,v_fingerprint from public.hotel_daily_inventory row_value;
    elsif v_snapshot.relation_name='hotel_daily_rates' then
      select count(*),md5(coalesce(string_agg(
        to_jsonb(row_value)::text,'|' order by row_value.room_rate_id,row_value.stay_date),''))
      into v_count,v_fingerprint from public.hotel_daily_rates row_value;
    elsif v_snapshot.relation_name='hotel_calendar_overrides' then
      select count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
      into v_count,v_fingerprint from public.hotel_calendar_overrides row_value;
    elsif v_snapshot.relation_name='hotel_room_types' then
      select count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
      into v_count,v_fingerprint from public.hotel_room_types row_value;
    elsif v_snapshot.relation_name='hotel_bookings' then
      select count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
      into v_count,v_fingerprint from public.hotel_bookings row_value;
    elsif v_snapshot.relation_name='partner_service_fulfillments' then
      select count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
      into v_count,v_fingerprint from public.partner_service_fulfillments row_value;
    elsif v_snapshot.relation_name='hotel_activity_log' then
      select count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
      into v_count,v_fingerprint from public.hotel_activity_log row_value;
    elsif v_snapshot.relation_name='site_settings' then
      select count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
      into v_count,v_fingerprint from public.site_settings row_value;
    end if;
    if v_count is distinct from v_snapshot.row_count
       or v_fingerprint is distinct from v_snapshot.fingerprint then
      raise exception using errcode='55000',message='hotels_v2_h3_1_protected_state_changed',
        detail=v_snapshot.relation_name;
    end if;
  end loop;

  if not exists(select 1 from pg_proc
      where oid='public.hotel_v2_admin_get_h3_1_configuration(uuid)'::regprocedure
        and prosecdef and provolatile='s'
        and proconfig@>array['search_path=pg_catalog, public, auth'])
     or not exists(select 1 from pg_proc
      where oid='public.hotel_v2_admin_apply_h3_1_configuration(jsonb,uuid)'::regprocedure
        and prosecdef and provolatile='v'
        and proconfig@>array['search_path=pg_catalog, public, auth'])
     or not has_function_privilege('authenticated',
       'public.hotel_v2_admin_get_h3_1_configuration(uuid)','EXECUTE')
     or not has_function_privilege('authenticated',
       'public.hotel_v2_admin_apply_h3_1_configuration(jsonb,uuid)','EXECUTE')
     or has_function_privilege('anon',
       'public.hotel_v2_admin_get_h3_1_configuration(uuid)','EXECUTE')
     or has_function_privilege('anon',
       'public.hotel_v2_admin_apply_h3_1_configuration(jsonb,uuid)','EXECUTE')
     or has_function_privilege('service_role',
       'public.hotel_v2_admin_get_h3_1_configuration(uuid)','EXECUTE')
     or has_function_privilege('service_role',
       'public.hotel_v2_admin_apply_h3_1_configuration(jsonb,uuid)','EXECUTE') then
    raise exception using errcode='55000',message='hotels_v2_h3_1_rpc_security_contract_failed';
  end if;

  -- The only helper callable by authenticated/service_role is the immutable
  -- code validator needed by the additive hotel_rate_plans CHECK. Aggregate
  -- validators, fingerprints and trigger entry points stay non-callable.
  if not has_function_privilege('service_role',
       'public.hotel_v2_h3_1_codes_valid(text[])','EXECUTE')
     or not has_function_privilege('authenticated',
       'public.hotel_v2_h3_1_codes_valid(text[])','EXECUTE')
     or has_function_privilege('anon',
       'public.hotel_v2_h3_1_codes_valid(text[])','EXECUTE')
     or exists(
       select 1
       from (values
         ('public.hotel_v2_h3_1_validate_allocation_rule(uuid)'),
         ('public.hotel_v2_h3_1_allocation_rule_constraint_trigger()'),
         ('public.hotel_v2_h3_1_validate_room_allocation_inventory(uuid)'),
         ('public.hotel_v2_h3_1_room_inventory_constraint_trigger()'),
         ('public.hotel_v2_h3_1_validate_payment_policy(uuid)'),
         ('public.hotel_v2_h3_1_payment_policy_constraint_trigger()'),
         ('public.hotel_v2_h3_1_allocation_items_fingerprint(uuid)'),
         ('public.hotel_v2_h3_1_payment_terms_fingerprint(uuid)')
       ) helper(signature)
       where has_function_privilege('anon',helper.signature,'EXECUTE')
          or has_function_privilege('authenticated',helper.signature,'EXECUTE')
          or has_function_privilege('service_role',helper.signature,'EXECUTE')
     ) then
    raise exception using errcode='55000',message='hotels_v2_h3_1_helper_security_contract_failed';
  end if;

  if exists(
    select 1 from (values
      ('hotel_room_allocation_rules'),('hotel_room_allocation_rule_items'),
      ('hotel_payment_policies'),('hotel_payment_policy_terms'),
      ('hotel_commission_policies'),('hotel_calendar_source_configs')
    ) expected(table_name)
    where not exists(select 1 from pg_class relation
      join pg_namespace namespace on namespace.oid=relation.relnamespace
      where namespace.nspname='public' and relation.relname=expected.table_name
        and relation.relrowsecurity)
      or has_table_privilege('anon','public.'||expected.table_name,'SELECT')
      or has_table_privilege('authenticated','public.'||expected.table_name,'INSERT')
      or has_table_privilege('authenticated','public.'||expected.table_name,'UPDATE')
      or has_table_privilege('authenticated','public.'||expected.table_name,'DELETE')
      or not has_table_privilege('authenticated','public.'||expected.table_name,'SELECT')
      or has_table_privilege('service_role','public.'||expected.table_name,'INSERT')
      or has_table_privilege('service_role','public.'||expected.table_name,'UPDATE')
      or has_table_privilege('service_role','public.'||expected.table_name,'DELETE')
      or not has_table_privilege('service_role','public.'||expected.table_name,'SELECT')
  ) then
    raise exception using errcode='55000',message='hotels_v2_h3_1_table_security_contract_failed';
  end if;
end
$h3_1_postconditions$;

notify pgrst,'reload schema';
commit;
