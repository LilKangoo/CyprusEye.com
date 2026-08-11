begin;
set transaction isolation level repeatable read;

-- Hotels H1A inert normalized foundation. This is an intentionally one-time,
-- non-reapplicable migration: any pre-existing normalized H1A table fails the
-- transaction before schema changes, instead of guessing whether a partial
-- earlier definition is safe.
-- No legacy property is converted, no room/rate/inventory row is seeded, and
-- every capability flag remains false.

do $$
declare
  v_missing text[];
begin
  select coalesce(array_agg(object_name order by object_name), '{}'::text[])
  into v_missing
  from unnest(array[
    'public.hotels',
    'public.hotel_bookings',
    'public.hotel_categories',
    'public.partner_service_fulfillments',
    'public.site_settings'
  ]::text[]) required(object_name)
  where to_regclass(object_name) is null;

  if cardinality(v_missing) > 0 then
    raise exception using
      errcode = '42P01',
      message = 'hotels_v2_h1a_core_required_object_missing',
      detail = array_to_string(v_missing, ',');
  end if;

  if to_regprocedure('public.is_current_user_admin()') is null then
    raise exception using
      errcode = '42883',
      message = 'hotels_v2_h1a_core_admin_helper_missing';
  end if;

  if (select count(*) from public.site_settings) <> 1
     or not exists (select 1 from public.site_settings where id = 1) then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_h1a_core_site_settings_contract_invalid';
  end if;

  select coalesce(array_agg(object_name order by object_name), '{}'::text[])
  into v_missing
  from unnest(array[
      'public.hotel_room_types',
      'public.hotel_units',
      'public.hotel_rate_plans',
      'public.hotel_room_rates',
      'public.hotel_rate_rules',
      'public.hotel_daily_inventory',
      'public.hotel_daily_rates'
    ]::text[]) expected(object_name)
  where to_regclass(object_name) is not null;

  if cardinality(v_missing) > 0 then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_h1a_core_normalized_object_already_exists',
      detail = array_to_string(v_missing, ',');
  end if;

  if to_regprocedure('public.hotel_v2_set_updated_at_and_version()') is not null then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_h1a_core_version_helper_already_exists';
  end if;
end
$$;

lock table public.hotels in share mode;
lock table public.hotel_bookings in share mode;
lock table public.partner_service_fulfillments in share mode;
lock table public.site_settings in share row exclusive mode;

create temporary table hotels_v2_h1a_core_snapshot on commit drop as
select
  (
    select md5(coalesce(string_agg(
      (
        to_jsonb(hotel)
        - 'architecture_version'
        - 'timezone'
        - 'currency'
        - 'booking_mode'
        - 'check_in_from'
        - 'check_out_until'
      )::text,
      '|' order by hotel.id
    ), ''))
    from public.hotels hotel
  ) as protected_hotels_fingerprint,
  (
    select md5(coalesce(string_agg(to_jsonb(booking)::text, '|' order by booking.id), ''))
    from public.hotel_bookings booking
  ) as hotel_bookings_fingerprint,
  (
    select md5(coalesce(string_agg(to_jsonb(fulfillment)::text, '|' order by fulfillment.id), ''))
    from public.partner_service_fulfillments fulfillment
    where fulfillment.resource_type = 'hotels'
  ) as hotel_fulfillments_fingerprint,
  (
    select md5(coalesce(string_agg(
      (
        to_jsonb(setting)
        - 'hotel_rooms_v2_enabled'
        - 'hotel_external_sync_enabled'
        - 'hotel_instant_booking_enabled'
        - 'hotel_stripe_connect_enabled'
      )::text,
      '|' order by setting.id
    ), ''))
    from public.site_settings setting
  ) as protected_site_settings_fingerprint,
  (
    select md5(coalesce(string_agg(to_jsonb(category)::text, '|' order by category.id), ''))
    from public.hotel_categories category
  ) as hotel_categories_fingerprint;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'hotels' and column_name = 'architecture_version'
  ) then
    alter table public.hotels
      add column architecture_version text not null default 'legacy';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'hotels' and column_name = 'timezone'
  ) then
    alter table public.hotels
      add column timezone text not null default 'Europe/Nicosia';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'hotels' and column_name = 'currency'
  ) then
    alter table public.hotels
      add column currency character(3) not null default 'EUR';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'hotels' and column_name = 'booking_mode'
  ) then
    alter table public.hotels
      add column booking_mode text not null default 'request_confirmation';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'hotels' and column_name = 'check_in_from'
  ) then
    alter table public.hotels add column check_in_from time without time zone;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'hotels' and column_name = 'check_out_until'
  ) then
    alter table public.hotels add column check_out_until time without time zone;
  end if;
end
$$;

do $$
declare
  v_mismatch_count integer;
begin
  with expected(column_name, formatted_type, not_null, default_expression) as (
    values
      ('architecture_version', 'text', true, '''legacy''::text'),
      ('timezone', 'text', true, '''Europe/Nicosia''::text'),
      ('currency', 'character(3)', true, '''EUR''::bpchar'),
      ('booking_mode', 'text', true, '''request_confirmation''::text'),
      ('check_in_from', 'time without time zone', false, null),
      ('check_out_until', 'time without time zone', false, null)
  ), actual as (
    select
      attribute.attname as column_name,
      format_type(attribute.atttypid, attribute.atttypmod) as formatted_type,
      attribute.attnotnull as not_null,
      pg_get_expr(default_value.adbin, default_value.adrelid) as default_expression
    from pg_attribute attribute
    left join pg_attrdef default_value
      on default_value.adrelid = attribute.attrelid
     and default_value.adnum = attribute.attnum
    where attribute.attrelid = 'public.hotels'::regclass
      and attribute.attnum > 0
      and not attribute.attisdropped
      and attribute.attname in (
        'architecture_version', 'timezone', 'currency', 'booking_mode',
        'check_in_from', 'check_out_until'
      )
  )
  select count(*) into v_mismatch_count
  from expected
  left join actual using (column_name)
  where actual.column_name is null
     or actual.formatted_type is distinct from expected.formatted_type
     or actual.not_null is distinct from expected.not_null
     or actual.default_expression is distinct from expected.default_expression;

  if v_mismatch_count <> 0 then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_h1a_core_hotels_column_contract_mismatch',
      detail = v_mismatch_count::text;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.hotels'::regclass
      and conname = 'hotels_architecture_version_check'
  ) then
    alter table public.hotels
      add constraint hotels_architecture_version_check
      check (architecture_version in ('legacy', 'rooms_v2'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.hotels'::regclass
      and conname = 'hotels_timezone_not_blank_check'
  ) then
    alter table public.hotels
      add constraint hotels_timezone_not_blank_check
      check (length(btrim(timezone)) > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.hotels'::regclass
      and conname = 'hotels_currency_check'
  ) then
    alter table public.hotels
      add constraint hotels_currency_check
      check (currency::text ~ '^[A-Z]{3}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.hotels'::regclass
      and conname = 'hotels_booking_mode_check'
  ) then
    alter table public.hotels
      add constraint hotels_booking_mode_check
      check (booking_mode in ('request_confirmation', 'instant_booking', 'external_redirect'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.hotels'::regclass
      and conname = 'hotels_architecture_version_check'
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%architecture_version%legacy%rooms_v2%'
  ) or not exists (
    select 1 from pg_constraint
    where conrelid = 'public.hotels'::regclass
      and conname = 'hotels_timezone_not_blank_check'
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%length%btrim%timezone%0%'
  ) or not exists (
    select 1 from pg_constraint
    where conrelid = 'public.hotels'::regclass
      and conname = 'hotels_currency_check'
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%currency%[A-Z]{3}%'
  ) or not exists (
    select 1 from pg_constraint
    where conrelid = 'public.hotels'::regclass
      and conname = 'hotels_booking_mode_check'
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%booking_mode%request_confirmation%instant_booking%external_redirect%'
  ) then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_h1a_core_hotels_constraint_contract_mismatch';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'site_settings' and column_name = 'hotel_rooms_v2_enabled'
  ) then
    alter table public.site_settings
      add column hotel_rooms_v2_enabled boolean not null default false;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'site_settings' and column_name = 'hotel_external_sync_enabled'
  ) then
    alter table public.site_settings
      add column hotel_external_sync_enabled boolean not null default false;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'site_settings' and column_name = 'hotel_instant_booking_enabled'
  ) then
    alter table public.site_settings
      add column hotel_instant_booking_enabled boolean not null default false;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'site_settings' and column_name = 'hotel_stripe_connect_enabled'
  ) then
    alter table public.site_settings
      add column hotel_stripe_connect_enabled boolean not null default false;
  end if;
end
$$;

do $$
declare
  v_mismatch_count integer;
begin
  with expected(column_name) as (
    values
      ('hotel_rooms_v2_enabled'),
      ('hotel_external_sync_enabled'),
      ('hotel_instant_booking_enabled'),
      ('hotel_stripe_connect_enabled')
  )
  select count(*) into v_mismatch_count
  from expected
  left join information_schema.columns actual
    on actual.table_schema = 'public'
   and actual.table_name = 'site_settings'
   and actual.column_name = expected.column_name
  where actual.column_name is null
     or actual.data_type <> 'boolean'
     or actual.is_nullable <> 'NO'
     or actual.column_default <> 'false';

  if v_mismatch_count <> 0 then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_h1a_core_feature_flag_contract_mismatch',
      detail = v_mismatch_count::text;
  end if;

  if exists (
    select 1 from public.site_settings setting
    where setting.hotel_rooms_v2_enabled
       or setting.hotel_external_sync_enabled
       or setting.hotel_instant_booking_enabled
       or setting.hotel_stripe_connect_enabled
  ) then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_h1a_core_feature_flag_not_inert';
  end if;
end
$$;

comment on column public.hotels.architecture_version is
  'Hotels architecture selector. H1A creates rooms_v2 capability but does not convert legacy properties.';
comment on column public.hotels.timezone is
  'IANA timezone used for property-local booking rules.';
comment on column public.hotels.currency is
  'Property default ISO 4217 currency.';
comment on column public.hotels.booking_mode is
  'Booking lifecycle mode; all H1A legacy properties remain request_confirmation.';

comment on table public.hotel_categories is
  'Legacy/deprecated Hotel categorization retained for compatibility. Hotels 2.0 H1A does not depend on this table.';

create table public.hotel_room_types (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  code text not null,
  name_i18n jsonb not null,
  description_i18n jsonb not null default '{}'::jsonb,
  gallery jsonb not null default '[]'::jsonb,
  capacity_adults smallint not null,
  capacity_children smallint not null default 0,
  bed_configuration jsonb not null default '[]'::jsonb,
  bathrooms numeric(4,1),
  size_sqm numeric(8,2),
  amenities text[] not null default '{}'::text[],
  inventory_mode text not null default 'pooled',
  base_inventory_count integer not null default 0,
  status text not null default 'draft',
  sort_order integer not null default 1000,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_room_types_id_hotel_id_key unique (id, hotel_id),
  constraint hotel_room_types_code_check check (
    code = lower(btrim(code))
    and length(code) between 1 and 80
    and code ~ '^[a-z0-9][a-z0-9_-]*$'
  ),
  constraint hotel_room_types_name_i18n_check check (jsonb_typeof(name_i18n) = 'object'),
  constraint hotel_room_types_description_i18n_check check (jsonb_typeof(description_i18n) = 'object'),
  constraint hotel_room_types_gallery_check check (jsonb_typeof(gallery) = 'array'),
  constraint hotel_room_types_capacity_check check (capacity_adults > 0 and capacity_children >= 0),
  constraint hotel_room_types_bed_configuration_check check (jsonb_typeof(bed_configuration) = 'array'),
  constraint hotel_room_types_bathrooms_check check (bathrooms is null or bathrooms >= 0),
  constraint hotel_room_types_size_sqm_check check (size_sqm is null or size_sqm > 0),
  constraint hotel_room_types_amenities_check check (array_position(amenities, null) is null),
  constraint hotel_room_types_inventory_mode_check check (inventory_mode in ('pooled', 'unitized')),
  constraint hotel_room_types_base_inventory_count_check check (base_inventory_count >= 0),
  constraint hotel_room_types_status_check check (status in ('draft', 'active', 'disabled')),
  constraint hotel_room_types_sort_order_check check (sort_order >= 0),
  constraint hotel_room_types_version_check check (version > 0)
);

create unique index hotel_room_types_hotel_code_lower_uidx
  on public.hotel_room_types(hotel_id, lower(code));
create index hotel_room_types_hotel_status_sort_idx
  on public.hotel_room_types(hotel_id, status, sort_order, id);

create table public.hotel_units (
  id uuid primary key default gen_random_uuid(),
  room_type_id uuid not null references public.hotel_room_types(id) on delete cascade,
  code text not null,
  name_i18n jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_units_code_check check (
    code = lower(btrim(code))
    and length(code) between 1 and 80
    and code ~ '^[a-z0-9][a-z0-9_-]*$'
  ),
  constraint hotel_units_name_i18n_check check (jsonb_typeof(name_i18n) = 'object'),
  constraint hotel_units_status_check check (status in ('active', 'maintenance', 'disabled')),
  constraint hotel_units_version_check check (version > 0)
);

create unique index hotel_units_room_type_code_lower_uidx
  on public.hotel_units(room_type_id, lower(code));
create index hotel_units_room_type_status_idx
  on public.hotel_units(room_type_id, status, id);

create table public.hotel_rate_plans (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  code text not null,
  name_i18n jsonb not null,
  description_i18n jsonb not null default '{}'::jsonb,
  meal_plan_code text,
  cancellation_policy jsonb not null,
  booking_mode_override text,
  is_active boolean not null default false,
  sort_order integer not null default 1000,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_rate_plans_id_hotel_id_key unique (id, hotel_id),
  constraint hotel_rate_plans_code_check check (
    code = lower(btrim(code))
    and length(code) between 1 and 80
    and code ~ '^[a-z0-9][a-z0-9_-]*$'
  ),
  constraint hotel_rate_plans_name_i18n_check check (jsonb_typeof(name_i18n) = 'object'),
  constraint hotel_rate_plans_description_i18n_check check (jsonb_typeof(description_i18n) = 'object'),
  constraint hotel_rate_plans_meal_plan_code_check check (
    meal_plan_code is null
    or (
      meal_plan_code = lower(btrim(meal_plan_code))
      and meal_plan_code ~ '^[a-z0-9][a-z0-9_-]*$'
    )
  ),
  constraint hotel_rate_plans_cancellation_policy_check check (jsonb_typeof(cancellation_policy) = 'object'),
  constraint hotel_rate_plans_booking_mode_override_check check (
    booking_mode_override is null
    or booking_mode_override in ('request_confirmation', 'instant_booking', 'external_redirect')
  ),
  constraint hotel_rate_plans_sort_order_check check (sort_order >= 0),
  constraint hotel_rate_plans_version_check check (version > 0)
);

create unique index hotel_rate_plans_hotel_code_lower_uidx
  on public.hotel_rate_plans(hotel_id, lower(code));
create index hotel_rate_plans_hotel_active_sort_idx
  on public.hotel_rate_plans(hotel_id, is_active, sort_order, id);

create table public.hotel_room_rates (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  room_type_id uuid not null,
  rate_plan_id uuid not null,
  base_nightly_rate numeric(12,2) not null,
  currency character(3) not null default 'EUR',
  external_redirect_url text,
  is_active boolean not null default false,
  sort_order integer not null default 1000,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_room_rates_room_type_hotel_fkey
    foreign key (room_type_id, hotel_id)
    references public.hotel_room_types(id, hotel_id)
    on delete cascade,
  constraint hotel_room_rates_rate_plan_hotel_fkey
    foreign key (rate_plan_id, hotel_id)
    references public.hotel_rate_plans(id, hotel_id)
    on delete cascade,
  constraint hotel_room_rates_room_type_rate_plan_key unique (room_type_id, rate_plan_id),
  constraint hotel_room_rates_base_nightly_rate_check check (base_nightly_rate >= 0),
  constraint hotel_room_rates_currency_check check (currency::text ~ '^[A-Z]{3}$'),
  constraint hotel_room_rates_external_redirect_url_check check (
    external_redirect_url is null or external_redirect_url ~ '^https://'
  ),
  constraint hotel_room_rates_sort_order_check check (sort_order >= 0),
  constraint hotel_room_rates_version_check check (version > 0)
);

create index hotel_room_rates_hotel_active_sort_idx
  on public.hotel_room_rates(hotel_id, is_active, sort_order, id);

create table public.hotel_rate_rules (
  id uuid primary key default gen_random_uuid(),
  room_rate_id uuid not null references public.hotel_room_rates(id) on delete cascade,
  valid_from date not null,
  valid_to date not null,
  weekdays smallint[] not null default array[1,2,3,4,5,6,7]::smallint[],
  nightly_rate numeric(12,2) not null,
  minimum_stay integer,
  maximum_stay integer,
  closed_to_arrival boolean not null default false,
  closed_to_departure boolean not null default false,
  priority smallint not null default 0,
  is_active boolean not null default false,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_rate_rules_date_range_check check (valid_to >= valid_from),
  constraint hotel_rate_rules_weekdays_check check (
    cardinality(weekdays) between 1 and 7
    and array_position(weekdays, null) is null
    and weekdays <@ array[1,2,3,4,5,6,7]::smallint[]
  ),
  constraint hotel_rate_rules_nightly_rate_check check (nightly_rate >= 0),
  constraint hotel_rate_rules_stay_check check (
    (minimum_stay is null or minimum_stay > 0)
    and (maximum_stay is null or maximum_stay > 0)
    and (minimum_stay is null or maximum_stay is null or maximum_stay >= minimum_stay)
  ),
  constraint hotel_rate_rules_version_check check (version > 0)
);

create index hotel_rate_rules_room_rate_dates_idx
  on public.hotel_rate_rules(room_rate_id, valid_from, valid_to, priority desc, id);
create index hotel_rate_rules_active_lookup_idx
  on public.hotel_rate_rules(room_rate_id, valid_from, valid_to)
  where is_active is true;

comment on column public.hotel_rate_rules.weekdays is
  'ISO weekday numbers: 1=Monday through 7=Sunday.';
comment on table public.hotel_rate_rules is
  'H1A rule foundation only. Equal-priority overlap resolution is intentionally deferred to H2 validation.';

create table public.hotel_daily_inventory (
  room_type_id uuid not null references public.hotel_room_types(id) on delete cascade,
  stay_date date not null,
  sellable_units integer not null default 0,
  closed boolean not null default false,
  source_timestamp timestamptz,
  provenance jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (room_type_id, stay_date),
  constraint hotel_daily_inventory_sellable_units_check check (sellable_units >= 0),
  constraint hotel_daily_inventory_provenance_check check (jsonb_typeof(provenance) = 'object'),
  constraint hotel_daily_inventory_version_check check (version > 0)
);

create index hotel_daily_inventory_stay_date_idx
  on public.hotel_daily_inventory(stay_date, room_type_id);

comment on table public.hotel_daily_inventory is
  'Empty H1A normalized inventory foundation. sync_source_id and sync_run_id FKs are intentionally deferred until H4 creates their authoritative tables.';

create table public.hotel_daily_rates (
  room_rate_id uuid not null references public.hotel_room_rates(id) on delete cascade,
  stay_date date not null,
  nightly_rate numeric(12,2) not null,
  minimum_stay integer,
  maximum_stay integer,
  closed boolean not null default false,
  closed_to_arrival boolean not null default false,
  closed_to_departure boolean not null default false,
  source_timestamp timestamptz,
  provenance jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (room_rate_id, stay_date),
  constraint hotel_daily_rates_nightly_rate_check check (nightly_rate >= 0),
  constraint hotel_daily_rates_stay_check check (
    (minimum_stay is null or minimum_stay > 0)
    and (maximum_stay is null or maximum_stay > 0)
    and (minimum_stay is null or maximum_stay is null or maximum_stay >= minimum_stay)
  ),
  constraint hotel_daily_rates_provenance_check check (jsonb_typeof(provenance) = 'object'),
  constraint hotel_daily_rates_version_check check (version > 0)
);

create index hotel_daily_rates_stay_date_idx
  on public.hotel_daily_rates(stay_date, room_rate_id);

create temporary table hotels_v2_h1a_expected_columns (
  table_name text not null,
  column_name text not null,
  formatted_type text not null,
  not_null boolean not null,
  primary key (table_name, column_name)
) on commit drop;

insert into hotels_v2_h1a_expected_columns(table_name, column_name, formatted_type, not_null)
values
  ('hotel_room_types','id','uuid',true),
  ('hotel_room_types','hotel_id','uuid',true),
  ('hotel_room_types','code','text',true),
  ('hotel_room_types','name_i18n','jsonb',true),
  ('hotel_room_types','description_i18n','jsonb',true),
  ('hotel_room_types','gallery','jsonb',true),
  ('hotel_room_types','capacity_adults','smallint',true),
  ('hotel_room_types','capacity_children','smallint',true),
  ('hotel_room_types','bed_configuration','jsonb',true),
  ('hotel_room_types','bathrooms','numeric(4,1)',false),
  ('hotel_room_types','size_sqm','numeric(8,2)',false),
  ('hotel_room_types','amenities','text[]',true),
  ('hotel_room_types','inventory_mode','text',true),
  ('hotel_room_types','base_inventory_count','integer',true),
  ('hotel_room_types','status','text',true),
  ('hotel_room_types','sort_order','integer',true),
  ('hotel_room_types','version','bigint',true),
  ('hotel_room_types','created_at','timestamp with time zone',true),
  ('hotel_room_types','updated_at','timestamp with time zone',true),
  ('hotel_units','id','uuid',true),
  ('hotel_units','room_type_id','uuid',true),
  ('hotel_units','code','text',true),
  ('hotel_units','name_i18n','jsonb',true),
  ('hotel_units','status','text',true),
  ('hotel_units','version','bigint',true),
  ('hotel_units','created_at','timestamp with time zone',true),
  ('hotel_units','updated_at','timestamp with time zone',true),
  ('hotel_rate_plans','id','uuid',true),
  ('hotel_rate_plans','hotel_id','uuid',true),
  ('hotel_rate_plans','code','text',true),
  ('hotel_rate_plans','name_i18n','jsonb',true),
  ('hotel_rate_plans','description_i18n','jsonb',true),
  ('hotel_rate_plans','meal_plan_code','text',false),
  ('hotel_rate_plans','cancellation_policy','jsonb',true),
  ('hotel_rate_plans','booking_mode_override','text',false),
  ('hotel_rate_plans','is_active','boolean',true),
  ('hotel_rate_plans','sort_order','integer',true),
  ('hotel_rate_plans','version','bigint',true),
  ('hotel_rate_plans','created_at','timestamp with time zone',true),
  ('hotel_rate_plans','updated_at','timestamp with time zone',true),
  ('hotel_room_rates','id','uuid',true),
  ('hotel_room_rates','hotel_id','uuid',true),
  ('hotel_room_rates','room_type_id','uuid',true),
  ('hotel_room_rates','rate_plan_id','uuid',true),
  ('hotel_room_rates','base_nightly_rate','numeric(12,2)',true),
  ('hotel_room_rates','currency','character(3)',true),
  ('hotel_room_rates','external_redirect_url','text',false),
  ('hotel_room_rates','is_active','boolean',true),
  ('hotel_room_rates','sort_order','integer',true),
  ('hotel_room_rates','version','bigint',true),
  ('hotel_room_rates','created_at','timestamp with time zone',true),
  ('hotel_room_rates','updated_at','timestamp with time zone',true),
  ('hotel_rate_rules','id','uuid',true),
  ('hotel_rate_rules','room_rate_id','uuid',true),
  ('hotel_rate_rules','valid_from','date',true),
  ('hotel_rate_rules','valid_to','date',true),
  ('hotel_rate_rules','weekdays','smallint[]',true),
  ('hotel_rate_rules','nightly_rate','numeric(12,2)',true),
  ('hotel_rate_rules','minimum_stay','integer',false),
  ('hotel_rate_rules','maximum_stay','integer',false),
  ('hotel_rate_rules','closed_to_arrival','boolean',true),
  ('hotel_rate_rules','closed_to_departure','boolean',true),
  ('hotel_rate_rules','priority','smallint',true),
  ('hotel_rate_rules','is_active','boolean',true),
  ('hotel_rate_rules','version','bigint',true),
  ('hotel_rate_rules','created_at','timestamp with time zone',true),
  ('hotel_rate_rules','updated_at','timestamp with time zone',true),
  ('hotel_daily_inventory','room_type_id','uuid',true),
  ('hotel_daily_inventory','stay_date','date',true),
  ('hotel_daily_inventory','sellable_units','integer',true),
  ('hotel_daily_inventory','closed','boolean',true),
  ('hotel_daily_inventory','source_timestamp','timestamp with time zone',false),
  ('hotel_daily_inventory','provenance','jsonb',true),
  ('hotel_daily_inventory','version','bigint',true),
  ('hotel_daily_inventory','updated_at','timestamp with time zone',true),
  ('hotel_daily_rates','room_rate_id','uuid',true),
  ('hotel_daily_rates','stay_date','date',true),
  ('hotel_daily_rates','nightly_rate','numeric(12,2)',true),
  ('hotel_daily_rates','minimum_stay','integer',false),
  ('hotel_daily_rates','maximum_stay','integer',false),
  ('hotel_daily_rates','closed','boolean',true),
  ('hotel_daily_rates','closed_to_arrival','boolean',true),
  ('hotel_daily_rates','closed_to_departure','boolean',true),
  ('hotel_daily_rates','source_timestamp','timestamp with time zone',false),
  ('hotel_daily_rates','provenance','jsonb',true),
  ('hotel_daily_rates','version','bigint',true),
  ('hotel_daily_rates','updated_at','timestamp with time zone',true);

do $$
declare
  v_mismatch_count integer;
  v_extra_count integer;
  v_missing_constraint_count integer;
begin
  with actual as (
    select
      relation.relname as table_name,
      attribute.attname as column_name,
      format_type(attribute.atttypid, attribute.atttypmod) as formatted_type,
      attribute.attnotnull as not_null
    from pg_attribute attribute
    join pg_class relation on relation.oid = attribute.attrelid
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'hotel_room_types','hotel_units','hotel_rate_plans','hotel_room_rates',
        'hotel_rate_rules','hotel_daily_inventory','hotel_daily_rates'
      )
      and attribute.attnum > 0
      and not attribute.attisdropped
  )
  select count(*) into v_mismatch_count
  from hotels_v2_h1a_expected_columns expected
  left join actual using (table_name, column_name)
  where actual.column_name is null
     or actual.formatted_type is distinct from expected.formatted_type
     or actual.not_null is distinct from expected.not_null;

  with actual as (
    select relation.relname as table_name, attribute.attname as column_name
    from pg_attribute attribute
    join pg_class relation on relation.oid = attribute.attrelid
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'hotel_room_types','hotel_units','hotel_rate_plans','hotel_room_rates',
        'hotel_rate_rules','hotel_daily_inventory','hotel_daily_rates'
      )
      and attribute.attnum > 0
      and not attribute.attisdropped
  )
  select count(*) into v_extra_count
  from actual
  left join hotels_v2_h1a_expected_columns expected using (table_name, column_name)
  where expected.column_name is null;

  if v_mismatch_count <> 0 or v_extra_count <> 0 then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_h1a_core_normalized_column_contract_mismatch',
      detail = format('missing_or_mismatch=%s,extra=%s', v_mismatch_count, v_extra_count);
  end if;

  with expected(table_name, constraint_name) as (
    values
      ('hotel_room_types','hotel_room_types_pkey'),
      ('hotel_room_types','hotel_room_types_hotel_id_fkey'),
      ('hotel_room_types','hotel_room_types_id_hotel_id_key'),
      ('hotel_room_types','hotel_room_types_code_check'),
      ('hotel_room_types','hotel_room_types_inventory_mode_check'),
      ('hotel_room_types','hotel_room_types_status_check'),
      ('hotel_units','hotel_units_pkey'),
      ('hotel_units','hotel_units_room_type_id_fkey'),
      ('hotel_units','hotel_units_code_check'),
      ('hotel_units','hotel_units_status_check'),
      ('hotel_rate_plans','hotel_rate_plans_pkey'),
      ('hotel_rate_plans','hotel_rate_plans_hotel_id_fkey'),
      ('hotel_rate_plans','hotel_rate_plans_id_hotel_id_key'),
      ('hotel_rate_plans','hotel_rate_plans_code_check'),
      ('hotel_rate_plans','hotel_rate_plans_booking_mode_override_check'),
      ('hotel_room_rates','hotel_room_rates_pkey'),
      ('hotel_room_rates','hotel_room_rates_hotel_id_fkey'),
      ('hotel_room_rates','hotel_room_rates_room_type_hotel_fkey'),
      ('hotel_room_rates','hotel_room_rates_rate_plan_hotel_fkey'),
      ('hotel_room_rates','hotel_room_rates_room_type_rate_plan_key'),
      ('hotel_rate_rules','hotel_rate_rules_pkey'),
      ('hotel_rate_rules','hotel_rate_rules_room_rate_id_fkey'),
      ('hotel_rate_rules','hotel_rate_rules_date_range_check'),
      ('hotel_rate_rules','hotel_rate_rules_weekdays_check'),
      ('hotel_daily_inventory','hotel_daily_inventory_pkey'),
      ('hotel_daily_inventory','hotel_daily_inventory_room_type_id_fkey'),
      ('hotel_daily_inventory','hotel_daily_inventory_sellable_units_check'),
      ('hotel_daily_rates','hotel_daily_rates_pkey'),
      ('hotel_daily_rates','hotel_daily_rates_room_rate_id_fkey'),
      ('hotel_daily_rates','hotel_daily_rates_nightly_rate_check')
  )
  select count(*) into v_missing_constraint_count
  from expected
  left join pg_constraint constraint_info
    on constraint_info.conrelid = format('public.%I', expected.table_name)::regclass
   and constraint_info.conname = expected.constraint_name
  where constraint_info.oid is null;

  if v_missing_constraint_count <> 0 then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_h1a_core_normalized_constraint_contract_mismatch',
      detail = v_missing_constraint_count::text;
  end if;
end
$$;

create or replace function public.hotel_v2_set_updated_at_and_version()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = clock_timestamp();
  new.version = old.version + 1;
  return new;
end;
$$;

revoke all on function public.hotel_v2_set_updated_at_and_version() from public, anon, authenticated;
grant execute on function public.hotel_v2_set_updated_at_and_version() to service_role;

do $$
declare
  v_table_name text;
  v_trigger_name text;
begin
  foreach v_table_name in array array[
    'hotel_room_types',
    'hotel_units',
    'hotel_rate_plans',
    'hotel_room_rates',
    'hotel_rate_rules',
    'hotel_daily_inventory',
    'hotel_daily_rates'
  ]
  loop
    v_trigger_name := v_table_name || '_set_updated_at_and_version';

    if not exists (
      select 1 from pg_trigger
      where tgrelid = format('public.%I', v_table_name)::regclass
        and tgname = v_trigger_name
        and not tgisinternal
    ) then
      execute format(
        'create trigger %I before update on public.%I for each row execute function public.hotel_v2_set_updated_at_and_version()',
        v_trigger_name,
        v_table_name
      );
    elsif not exists (
      select 1 from pg_trigger
      where tgrelid = format('public.%I', v_table_name)::regclass
        and tgname = v_trigger_name
        and not tgisinternal
        and tgfoid = 'public.hotel_v2_set_updated_at_and_version()'::regprocedure
    ) then
      raise exception using
        errcode = '23514',
        message = 'hotels_v2_h1a_core_version_trigger_contract_mismatch',
        detail = v_table_name;
    end if;
  end loop;
end
$$;

do $$
declare
  v_table_name text;
  v_policy_name text;
begin
  foreach v_table_name in array array[
    'hotel_room_types',
    'hotel_units',
    'hotel_rate_plans',
    'hotel_room_rates',
    'hotel_rate_rules',
    'hotel_daily_inventory',
    'hotel_daily_rates'
  ]
  loop
    execute format('alter table public.%I enable row level security', v_table_name);
    v_policy_name := v_table_name || '_admin_all';

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = v_table_name
        and policyname = v_policy_name
    ) then
      execute format(
        'create policy %I on public.%I for all to authenticated using (public.is_current_user_admin()) with check (public.is_current_user_admin())',
        v_policy_name,
        v_table_name
      );
    end if;

    if (
      select count(*) from pg_policies
      where schemaname = 'public' and tablename = v_table_name
    ) <> 1 then
      raise exception using
        errcode = '23514',
        message = 'hotels_v2_h1a_core_policy_count_mismatch',
        detail = v_table_name;
    end if;

    execute format('revoke all on table public.%I from public, anon, authenticated', v_table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', v_table_name);
    execute format('grant all on table public.%I to service_role', v_table_name);
  end loop;
end
$$;

do $$
declare
  v_nonempty text[];
  v_snapshot hotels_v2_h1a_core_snapshot%rowtype;
  v_fingerprint text;
begin
  select coalesce(array_agg(table_name order by table_name), '{}'::text[])
  into v_nonempty
  from (
    select 'hotel_room_types' as table_name where exists (select 1 from public.hotel_room_types)
    union all select 'hotel_units' where exists (select 1 from public.hotel_units)
    union all select 'hotel_rate_plans' where exists (select 1 from public.hotel_rate_plans)
    union all select 'hotel_room_rates' where exists (select 1 from public.hotel_room_rates)
    union all select 'hotel_rate_rules' where exists (select 1 from public.hotel_rate_rules)
    union all select 'hotel_daily_inventory' where exists (select 1 from public.hotel_daily_inventory)
    union all select 'hotel_daily_rates' where exists (select 1 from public.hotel_daily_rates)
  ) nonempty;

  if cardinality(v_nonempty) > 0 then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_h1a_core_normalized_tables_not_empty',
      detail = array_to_string(v_nonempty, ',');
  end if;

  if exists (select 1 from public.hotels where architecture_version <> 'legacy') then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_h1a_core_property_converted';
  end if;

  if exists (
    select 1 from public.hotels
    where booking_mode <> 'request_confirmation'
  ) then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_h1a_core_booking_mode_changed';
  end if;

  select * into v_snapshot from hotels_v2_h1a_core_snapshot;

  select md5(coalesce(string_agg(
    (
      to_jsonb(hotel)
      - 'architecture_version'
      - 'timezone'
      - 'currency'
      - 'booking_mode'
      - 'check_in_from'
      - 'check_out_until'
    )::text,
    '|' order by hotel.id
  ), ''))
  into v_fingerprint
  from public.hotels hotel;

  if v_fingerprint is distinct from v_snapshot.protected_hotels_fingerprint then
    raise exception using errcode = '23514', message = 'hotels_v2_h1a_core_protected_hotels_changed';
  end if;

  select md5(coalesce(string_agg(to_jsonb(booking)::text, '|' order by booking.id), ''))
  into v_fingerprint
  from public.hotel_bookings booking;

  if v_fingerprint is distinct from v_snapshot.hotel_bookings_fingerprint then
    raise exception using errcode = '23514', message = 'hotels_v2_h1a_core_hotel_bookings_changed';
  end if;

  select md5(coalesce(string_agg(to_jsonb(fulfillment)::text, '|' order by fulfillment.id), ''))
  into v_fingerprint
  from public.partner_service_fulfillments fulfillment
  where fulfillment.resource_type = 'hotels';

  if v_fingerprint is distinct from v_snapshot.hotel_fulfillments_fingerprint then
    raise exception using errcode = '23514', message = 'hotels_v2_h1a_core_hotel_fulfillments_changed';
  end if;

  select md5(coalesce(string_agg(
    (
      to_jsonb(setting)
      - 'hotel_rooms_v2_enabled'
      - 'hotel_external_sync_enabled'
      - 'hotel_instant_booking_enabled'
      - 'hotel_stripe_connect_enabled'
    )::text,
    '|' order by setting.id
  ), ''))
  into v_fingerprint
  from public.site_settings setting;

  if v_fingerprint is distinct from v_snapshot.protected_site_settings_fingerprint then
    raise exception using errcode = '23514', message = 'hotels_v2_h1a_core_other_site_settings_changed';
  end if;

  select md5(coalesce(string_agg(to_jsonb(category)::text, '|' order by category.id), ''))
  into v_fingerprint
  from public.hotel_categories category;

  if v_fingerprint is distinct from v_snapshot.hotel_categories_fingerprint then
    raise exception using errcode = '23514', message = 'hotels_v2_h1a_core_hotel_categories_changed';
  end if;
end
$$;

-- Deliberately deferred to H2: hotel_calendar_overrides and a Hotel-specific
-- activity log. Their precedence/actor semantics depend on the Property
-- Workspace write contract and should not be guessed in the inert foundation.

commit;
