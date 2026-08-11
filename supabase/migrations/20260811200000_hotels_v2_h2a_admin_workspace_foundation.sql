begin;
set transaction isolation level repeatable read;

-- Hotels 2.0 H2A Admin foundation.
--
-- This migration is intentionally inert for public Hotels.  It creates an
-- append-only Admin activity ledger and exact/versioned Admin RPCs over the
-- normalized H1A tables.  It does not convert a property, publish a property,
-- seed a room/rate, alter a booking, or enable a Hotels capability flag.

do $h2a_preconditions$
declare
  v_missing text[];
  v_nonempty text[];
begin
  select coalesce(array_agg(object_name order by object_name), '{}'::text[])
  into v_missing
  from unnest(array[
    'public.hotels',
    'public.hotel_bookings',
    'public.hotel_room_types',
    'public.hotel_units',
    'public.hotel_rate_plans',
    'public.hotel_room_rates',
    'public.hotel_rate_rules',
    'public.hotel_daily_inventory',
    'public.hotel_daily_rates',
    'public.hotel_amenities',
    'public.partners',
    'public.partner_resources',
    'public.service_deposit_rules',
    'public.service_deposit_overrides',
    'public.site_settings'
  ]::text[]) required(object_name)
  where to_regclass(object_name) is null;

  if cardinality(v_missing) > 0 then
    raise exception using
      errcode = '42P01',
      message = 'hotels_v2_h2a_required_object_missing',
      detail = array_to_string(v_missing, ',');
  end if;

  if to_regprocedure('public.is_current_user_admin()') is null
     or to_regprocedure('public.hotel_v2_set_updated_at_and_version()') is null then
    raise exception using
      errcode = '42883',
      message = 'hotels_v2_h2a_required_h1a_helper_missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns column_info
    where column_info.table_schema = 'public'
      and column_info.table_name = 'partners'
      and column_info.column_name = 'can_manage_hotels'
      and column_info.data_type = 'boolean'
  ) then
    raise exception using
      errcode = '42703',
      message = 'hotels_v2_h2a_partner_hotel_capability_contract_missing';
  end if;

  if to_regclass('public.hotel_activity_log') is not null
     or to_regprocedure('public.hotel_v2_admin_get_property_list()') is not null
     or to_regprocedure('public.hotel_v2_admin_get_property_workspace(uuid)') is not null
     or to_regprocedure('public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid)') is not null
     or to_regprocedure('public.hotel_v2_admin_create_property_draft(uuid,jsonb,uuid)') is not null then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_h2a_foundation_already_present';
  end if;

  if (select count(*) from public.site_settings) <> 1
     or not exists (select 1 from public.site_settings where id = 1)
     or exists (
       select 1
       from public.site_settings
       where hotel_rooms_v2_enabled
          or hotel_external_sync_enabled
          or hotel_instant_booking_enabled
          or hotel_stripe_connect_enabled
     ) then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_h2a_feature_flags_not_inert';
  end if;

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
  ) populated;

  if cardinality(v_nonempty) > 0 then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_h2a_normalized_tables_not_empty_at_foundation',
      detail = array_to_string(v_nonempty, ',');
  end if;

  if exists (select 1 from public.hotels where architecture_version <> 'legacy') then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_h2a_unexpected_rooms_v2_property_before_foundation';
  end if;
end
$h2a_preconditions$;

lock table public.hotels in share row exclusive mode;
lock table public.hotel_bookings in share mode;
lock table public.hotel_room_types in share row exclusive mode;
lock table public.hotel_units in share row exclusive mode;
lock table public.hotel_rate_plans in share row exclusive mode;
lock table public.hotel_room_rates in share row exclusive mode;
lock table public.hotel_rate_rules in share mode;
lock table public.hotel_daily_inventory in share mode;
lock table public.hotel_daily_rates in share mode;
lock table public.site_settings in share mode;

create temporary table hotels_v2_h2a_protected_snapshot on commit drop as
select
  (select md5(coalesce(string_agg(to_jsonb(hotel)::text, '|' order by hotel.id), '')) from public.hotels hotel)
    as hotels_fingerprint,
  (select md5(coalesce(string_agg(to_jsonb(booking)::text, '|' order by booking.id), '')) from public.hotel_bookings booking)
    as bookings_fingerprint,
  (select md5(coalesce(string_agg(to_jsonb(setting)::text, '|' order by setting.id), '')) from public.site_settings setting)
    as settings_fingerprint;

create or replace function public.hotel_v2_h2a_i18n_is_valid(
  p_value jsonb,
  p_required boolean default true
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $function$
begin
  if p_value is null or jsonb_typeof(p_value) <> 'object' then
    return false;
  end if;

  if not p_required then
    return true;
  end if;

  return exists (
    select 1
    from jsonb_each_text(p_value) entry
    where entry.key in ('pl', 'en', 'he')
      and length(btrim(entry.value)) > 0
  );
end;
$function$;

create or replace function public.hotel_v2_admin_create_property_draft(
  p_id uuid,
  p_payload jsonb,
  p_correlation_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  v_slug text;
  v_title jsonb;
  v_description jsonb;
  v_owner_partner_id uuid;
  v_created public.hotels%rowtype;
begin
  perform public.hotel_v2_h2a_require_admin();

  if p_id is null or p_correlation_id is null
     or p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or not public.hotel_v2_h2a_keys_allowed(p_payload, array[
       'slug', 'title_i18n', 'description_i18n', 'city', 'address_line',
       'district', 'postal_code', 'country', 'latitude', 'longitude',
       'google_maps_url', 'google_place_id', 'amenities', 'check_in_from',
       'check_out_until', 'timezone', 'currency', 'owner_partner_id',
       'cover_image_url', 'photos', 'sort_order'
     ]) then
    raise exception using errcode = '22023', message = 'hotels_v2_h2a_invalid_property_draft_payload';
  end if;

  if exists (select 1 from public.hotels where id = p_id) then
    raise exception using errcode = '23505', message = 'hotels_v2_h2a_property_id_already_exists';
  end if;
  if exists (select 1 from public.hotel_activity_log where correlation_id = p_correlation_id) then
    raise exception using errcode = '23505', message = 'hotels_v2_h2a_correlation_id_already_used';
  end if;

  v_slug := lower(btrim(p_payload->>'slug'));
  v_title := p_payload->'title_i18n';
  v_description := coalesce(p_payload->'description_i18n', '{}'::jsonb);

  if v_slug is null
     or length(v_slug) not between 1 and 120
     or v_slug !~ '^[a-z0-9][a-z0-9-]*$'
     or not public.hotel_v2_h2a_i18n_is_valid(v_title, true)
     or not public.hotel_v2_h2a_i18n_is_valid(v_description, false)
     or (p_payload ? 'amenities' and jsonb_typeof(p_payload->'amenities') <> 'array')
     or (p_payload ? 'photos' and jsonb_typeof(p_payload->'photos') <> 'array') then
    raise exception using errcode = '22023', message = 'hotels_v2_h2a_invalid_property_draft_contract';
  end if;

  if p_payload ? 'owner_partner_id' and p_payload->>'owner_partner_id' is not null then
    v_owner_partner_id := (p_payload->>'owner_partner_id')::uuid;
    if not exists (
      select 1 from public.partners partner
      where partner.id = v_owner_partner_id
        and partner.status = 'active'
        and partner.can_manage_hotels
    ) then
      raise exception using errcode = '23514', message = 'hotels_v2_h2a_owner_partner_not_eligible';
    end if;
  end if;

  insert into public.hotels (
    id,
    slug,
    title,
    description,
    title_i18n,
    description_i18n,
    city,
    address_line,
    district,
    postal_code,
    country,
    latitude,
    longitude,
    google_maps_url,
    google_place_id,
    amenities,
    check_in_from,
    check_out_until,
    timezone,
    currency,
    booking_mode,
    owner_partner_id,
    cover_image_url,
    photos,
    sort_order,
    architecture_version,
    is_published,
    status,
    submission_status
  ) values (
    p_id,
    v_slug,
    v_title,
    v_description,
    v_title,
    v_description,
    nullif(btrim(p_payload->>'city'), ''),
    nullif(btrim(p_payload->>'address_line'), ''),
    nullif(btrim(p_payload->>'district'), ''),
    nullif(btrim(p_payload->>'postal_code'), ''),
    coalesce(nullif(btrim(p_payload->>'country'), ''), 'Cyprus'),
    case when p_payload ? 'latitude' then (p_payload->>'latitude')::double precision else null end,
    case when p_payload ? 'longitude' then (p_payload->>'longitude')::double precision else null end,
    nullif(btrim(p_payload->>'google_maps_url'), ''),
    nullif(btrim(p_payload->>'google_place_id'), ''),
    coalesce(p_payload->'amenities', '[]'::jsonb),
    case when p_payload ? 'check_in_from' and p_payload->>'check_in_from' is not null
      then (p_payload->>'check_in_from')::time without time zone else null end,
    case when p_payload ? 'check_out_until' and p_payload->>'check_out_until' is not null
      then (p_payload->>'check_out_until')::time without time zone else null end,
    coalesce(nullif(btrim(p_payload->>'timezone'), ''), 'Europe/Nicosia'),
    coalesce(nullif(upper(btrim(p_payload->>'currency')), ''), 'EUR')::character(3),
    'request_confirmation',
    v_owner_partner_id,
    nullif(btrim(p_payload->>'cover_image_url'), ''),
    coalesce(p_payload->'photos', '[]'::jsonb),
    coalesce((p_payload->>'sort_order')::integer, 1000),
    'rooms_v2',
    false,
    'draft',
    'draft'
  )
  returning * into v_created;

  insert into public.hotel_activity_log (
    hotel_id, entity_type, entity_id, action, before_state, after_state,
    actor_type, actor_id, source, correlation_id
  ) values (
    p_id, 'property', p_id, 'create', null, to_jsonb(v_created),
    'admin', auth.uid(), 'hotels_v2_h2a_property_draft', p_correlation_id
  );

  return jsonb_build_object(
    'correlation_id', p_correlation_id,
    'created_property_id', p_id,
    'workspace', public.hotel_v2_admin_get_property_workspace(p_id),
    'activity', (
      select coalesce(jsonb_agg(to_jsonb(activity) order by activity.created_at, activity.id), '[]'::jsonb)
      from public.hotel_activity_log activity
      where activity.correlation_id = p_correlation_id
    )
  );
end;
$function$;

create or replace function public.hotel_v2_h2a_beds_are_valid(p_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $function$
declare
  v_item jsonb;
  v_type text;
  v_quantity integer;
begin
  if p_value is null or jsonb_typeof(p_value) <> 'array' then
    return false;
  end if;

  for v_item in select value from jsonb_array_elements(p_value)
  loop
    if jsonb_typeof(v_item) <> 'object'
       or not (v_item ? 'type')
       or not (v_item ? 'quantity') then
      return false;
    end if;

    v_type := v_item->>'type';
    begin
      v_quantity := (v_item->>'quantity')::integer;
    exception when others then
      return false;
    end;

    if v_type not in ('double', 'single', 'sofa', 'bunk', 'king', 'queen', 'other')
       or v_quantity < 1
       or v_quantity > 20
       or exists (
         select 1 from jsonb_object_keys(v_item) key_name
         where key_name not in ('type', 'quantity', 'label')
       )
       or (
         v_item ? 'label'
         and not public.hotel_v2_h2a_i18n_is_valid(v_item->'label', false)
       ) then
      return false;
    end if;
  end loop;

  return true;
end;
$function$;

create or replace function public.hotel_v2_h2a_cancellation_policy_is_valid(p_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $function$
declare
  v_type text;
  v_deadline integer;
  v_penalty numeric;
  v_mode text;
begin
  if p_value is null or jsonb_typeof(p_value) <> 'object' then
    return false;
  end if;

  v_type := p_value->>'type';
  if v_type not in ('flexible', 'non_refundable', 'custom') then
    return false;
  end if;

  if exists (
    select 1 from jsonb_object_keys(p_value) key_name
    where key_name not in ('type', 'deadline_hours', 'penalty_mode', 'penalty_value', 'summary_i18n')
  ) then
    return false;
  end if;

  if p_value ? 'summary_i18n'
     and not public.hotel_v2_h2a_i18n_is_valid(p_value->'summary_i18n', false) then
    return false;
  end if;

  if v_type <> 'custom' then
    return not (p_value ? 'deadline_hours')
       and not (p_value ? 'penalty_mode')
       and not (p_value ? 'penalty_value');
  end if;

  if not (p_value ? 'deadline_hours') or not (p_value ? 'penalty_mode') then
    return false;
  end if;

  begin
    v_deadline := (p_value->>'deadline_hours')::integer;
  exception when others then
    return false;
  end;

  v_mode := p_value->>'penalty_mode';
  if v_deadline < 0 or v_mode not in ('none', 'flat', 'percent') then
    return false;
  end if;

  if v_mode = 'none' then
    return not (p_value ? 'penalty_value') or (p_value->>'penalty_value') is null;
  end if;

  if not (p_value ? 'penalty_value') then
    return false;
  end if;

  begin
    v_penalty := (p_value->>'penalty_value')::numeric;
  exception when others then
    return false;
  end;

  return v_penalty >= 0 and (v_mode <> 'percent' or v_penalty <= 100);
end;
$function$;

alter table public.hotel_room_types
  add constraint hotel_room_types_h2a_name_i18n_check
  check (public.hotel_v2_h2a_i18n_is_valid(name_i18n, true));

alter table public.hotel_room_types
  add constraint hotel_room_types_h2a_bed_configuration_check
  check (public.hotel_v2_h2a_beds_are_valid(bed_configuration));

alter table public.hotel_rate_plans
  add constraint hotel_rate_plans_h2a_name_i18n_check
  check (public.hotel_v2_h2a_i18n_is_valid(name_i18n, true));

alter table public.hotel_rate_plans
  add constraint hotel_rate_plans_h2a_cancellation_policy_check
  check (public.hotel_v2_h2a_cancellation_policy_is_valid(cancellation_policy));

-- H2A can prepare Rooms V2 data, but no current public resolver understands
-- normalized rooms/rates yet. Keep every Rooms V2 property structurally inert
-- even if an older generic Hotel editor or a direct Admin table update tries to
-- set is_published=true. H3 must replace this guard only together with its
-- controlled public eligibility/search contract.
alter table public.hotels
  add constraint hotels_h2a_rooms_v2_unpublished_check
  check (architecture_version = 'legacy' or coalesce(is_published, false) = false);

create table public.hotel_activity_log (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  before_state jsonb,
  after_state jsonb,
  actor_type text not null,
  actor_id uuid,
  source text not null,
  correlation_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint hotel_activity_log_entity_type_check check (
    entity_type in ('property', 'room_type', 'unit', 'rate_plan', 'room_rate')
  ),
  constraint hotel_activity_log_action_check check (
    action in ('create', 'update', 'disable', 'duplicate')
  ),
  constraint hotel_activity_log_actor_type_check check (
    actor_type in ('admin', 'partner', 'sync', 'system')
  ),
  constraint hotel_activity_log_source_check check (length(btrim(source)) between 1 and 120),
  constraint hotel_activity_log_state_check check (
    (before_state is null or jsonb_typeof(before_state) = 'object')
    and (after_state is null or jsonb_typeof(after_state) = 'object')
    and (before_state is not null or after_state is not null)
  )
);

create index hotel_activity_log_hotel_created_idx
  on public.hotel_activity_log(hotel_id, created_at desc, id);
create index hotel_activity_log_entity_idx
  on public.hotel_activity_log(entity_type, entity_id, created_at desc);
create index hotel_activity_log_correlation_idx
  on public.hotel_activity_log(correlation_id, created_at, id);

alter table public.hotel_activity_log enable row level security;

create policy hotel_activity_log_admin_select
on public.hotel_activity_log
for select
to authenticated
using (public.is_current_user_admin());

revoke all on table public.hotel_activity_log from public, anon, authenticated;
grant select on table public.hotel_activity_log to authenticated;
revoke all on table public.hotel_activity_log from service_role;
grant select, insert on table public.hotel_activity_log to service_role;

-- H1A exposed Admin CRUD through RLS.  H2A narrows mutation privileges so a
-- browser cannot bypass exact versions, Review, atomicity or the activity log.
-- Admin SELECT remains policy-gated; every H2A mutation uses the reviewed RPC.
do $h2a_normalized_grants$
declare
  v_table_name text;
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
    execute format(
      'revoke insert, update, delete, truncate, references, trigger on table public.%I from authenticated',
      v_table_name
    );
    execute format('grant select on table public.%I to authenticated', v_table_name);
  end loop;
end
$h2a_normalized_grants$;

comment on table public.hotel_activity_log is
  'Append-only Hotels 2.0 activity ledger. H2A writes are emitted only by the exact Admin workspace transaction.';
comment on column public.hotel_activity_log.correlation_id is
  'One correlation ID groups every atomic mutation in a reviewed H2A workspace plan.';

create or replace function public.hotel_v2_h2a_require_admin()
returns void
language plpgsql
security definer
stable
set search_path = pg_catalog, public, auth
as $function$
begin
  if not public.is_current_user_admin() then
    raise exception using errcode = '42501', message = 'hotels_v2_h2a_admin_required';
  end if;
end;
$function$;

create or replace function public.hotel_v2_h2a_keys_allowed(
  p_value jsonb,
  p_allowed text[]
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $function$
  select jsonb_typeof(p_value) = 'object'
     and not exists (
       select 1 from jsonb_object_keys(p_value) key_name
       where not (key_name = any(p_allowed))
     );
$function$;

create or replace function public.hotel_v2_h2a_readiness(p_hotel_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = pg_catalog, public
as $function$
declare
  v_hotel public.hotels%rowtype;
  v_room_count integer;
  v_active_room_count integer;
  v_rate_plan_count integer;
  v_active_rate_plan_count integer;
  v_room_rate_count integer;
  v_active_product_count integer;
  v_inventory_count integer;
  v_blockers text[] := '{}'::text[];
  v_state text;
begin
  select * into v_hotel from public.hotels where id = p_hotel_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'hotels_v2_h2a_property_not_found';
  end if;

  select
    count(*)::integer,
    count(*) filter (where status = 'active')::integer
  into v_room_count, v_active_room_count
  from public.hotel_room_types
  where hotel_id = p_hotel_id;

  select
    count(*)::integer,
    count(*) filter (where is_active)::integer
  into v_rate_plan_count, v_active_rate_plan_count
  from public.hotel_rate_plans
  where hotel_id = p_hotel_id;

  select
    count(*)::integer,
    count(*) filter (
      where room_rate.is_active
        and room_rate.base_nightly_rate > 0
        and room_type.status = 'active'
        and rate_plan.is_active
    )::integer
  into v_room_rate_count, v_active_product_count
  from public.hotel_room_rates room_rate
  join public.hotel_room_types room_type on room_type.id = room_rate.room_type_id
  join public.hotel_rate_plans rate_plan on rate_plan.id = room_rate.rate_plan_id
  where room_rate.hotel_id = p_hotel_id;

  select coalesce(sum(
    case
      when room_type.inventory_mode = 'pooled' then room_type.base_inventory_count
      else (
        select count(*)::integer
        from public.hotel_units unit_row
        where unit_row.room_type_id = room_type.id
          and unit_row.status = 'active'
      )
    end
  ), 0)::integer
  into v_inventory_count
  from public.hotel_room_types room_type
  where room_type.hotel_id = p_hotel_id
    and room_type.status = 'active';

  if not public.hotel_v2_h2a_i18n_is_valid(coalesce(v_hotel.title_i18n, v_hotel.title), true) then
    v_blockers := array_append(v_blockers, 'missing_property_name');
  end if;
  if coalesce(length(btrim(v_hotel.city)), 0) = 0 then
    v_blockers := array_append(v_blockers, 'missing_city');
  end if;
  if not exists (
    select 1
    from public.partners partner
    where partner.id = v_hotel.owner_partner_id
      and partner.status = 'active'
      and partner.can_manage_hotels
  ) and not exists (
    select 1
    from public.partner_resources assignment
    join public.partners partner on partner.id = assignment.partner_id
    where assignment.resource_type = 'hotels'
      and assignment.resource_id = p_hotel_id
      and assignment.is_active
      and partner.status = 'active'
      and partner.can_manage_hotels
  ) then
    v_blockers := array_append(v_blockers, 'missing_active_partner');
  end if;
  if v_active_room_count = 0 then
    v_blockers := array_append(v_blockers, 'missing_active_room_type');
  end if;
  if exists (
    select 1
    from public.hotel_room_types room_type
    where room_type.hotel_id = p_hotel_id
      and room_type.status = 'active'
      and (
        (room_type.inventory_mode = 'pooled' and room_type.base_inventory_count <= 0)
        or (
          room_type.inventory_mode = 'unitized'
          and not exists (
            select 1 from public.hotel_units unit_row
            where unit_row.room_type_id = room_type.id
              and unit_row.status = 'active'
          )
        )
      )
  ) then
    v_blockers := array_append(v_blockers, 'invalid_active_inventory');
  end if;
  if v_active_rate_plan_count = 0 then
    v_blockers := array_append(v_blockers, 'missing_active_rate_plan');
  end if;
  if v_active_product_count = 0 then
    v_blockers := array_append(v_blockers, 'missing_active_room_rate');
  end if;

  if cardinality(v_blockers) = 0 then
    v_state := 'READY_FOR_CALENDAR';
  elsif v_room_count = 0 and v_rate_plan_count = 0 and v_room_rate_count = 0 then
    v_state := 'DRAFT';
  else
    v_state := 'BLOCKED';
  end if;

  return jsonb_build_object(
    'state', case when v_hotel.architecture_version = 'legacy' then 'LEGACY' else v_state end,
    'blockers', case when v_hotel.architecture_version = 'legacy' then '[]'::jsonb else to_jsonb(v_blockers) end,
    'preparation_state', v_state,
    'preparation_blockers', to_jsonb(v_blockers),
    'room_type_count', v_room_count,
    'active_room_type_count', v_active_room_count,
    'rate_plan_count', v_rate_plan_count,
    'active_rate_plan_count', v_active_rate_plan_count,
    'room_rate_count', v_room_rate_count,
    'active_product_count', v_active_product_count,
    'configured_inventory', v_inventory_count
  );
end;
$function$;

create or replace function public.hotel_v2_admin_get_property_list()
returns jsonb
language plpgsql
security definer
stable
set search_path = pg_catalog, public, auth
as $function$
declare
  v_result jsonb;
begin
  perform public.hotel_v2_h2a_require_admin();

  select coalesce(jsonb_agg(summary order by summary_sort, summary_id), '[]'::jsonb)
  into v_result
  from (
    select
      hotel.sort_order as summary_sort,
      hotel.id as summary_id,
      jsonb_build_object(
        'id', hotel.id,
        'slug', hotel.slug,
        'name_i18n', coalesce(hotel.title_i18n, hotel.title, jsonb_build_object('en', hotel.slug)),
        'city', hotel.city,
        'cover_image_url', hotel.cover_image_url,
        'architecture_version', hotel.architecture_version,
        'public_status', case
          when hotel.is_published and hotel.status = 'published' then 'PUBLISHED'
          when hotel.is_published then 'PUBLISHED_COMPATIBILITY'
          when hotel.status = 'archived' then 'ARCHIVED'
          else 'DRAFT'
        end,
        'is_published', hotel.is_published,
        'status', hotel.status,
        'booking_mode', hotel.booking_mode,
        'owner_partner', case when owner_partner.id is null then null else jsonb_build_object(
          'id', owner_partner.id,
          'name', owner_partner.name,
          'status', owner_partner.status,
          'can_manage_hotels', owner_partner.can_manage_hotels
        ) end,
        'operational_partner_count', (
          select count(*)::integer
          from public.partner_resources assignment
          where assignment.resource_type = 'hotels'
            and assignment.resource_id = hotel.id
            and assignment.is_active
        ),
        'room_type_count', readiness->'room_type_count',
        'rate_plan_count', readiness->'rate_plan_count',
        'configured_inventory', readiness->'configured_inventory',
        'price_from', (
          select min(room_rate.base_nightly_rate)
          from public.hotel_room_rates room_rate
          join public.hotel_room_types room_type on room_type.id = room_rate.room_type_id
          join public.hotel_rate_plans rate_plan on rate_plan.id = room_rate.rate_plan_id
          where room_rate.hotel_id = hotel.id
            and room_rate.is_active
            and room_rate.base_nightly_rate > 0
            and room_type.status = 'active'
            and rate_plan.is_active
        ),
        'currency', hotel.currency,
        'upcoming_booking_count', (
          select count(*)::integer
          from public.hotel_bookings booking
          where booking.hotel_id = hotel.id
            and booking.arrival_date >= current_date
            and booking.status not in ('cancelled', 'rejected')
        ),
        'readiness', readiness,
        'preparation_state', readiness->>'preparation_state',
        'preparation_blockers', readiness->'preparation_blockers'
      ) as summary
    from public.hotels hotel
    left join public.partners owner_partner on owner_partner.id = hotel.owner_partner_id
    cross join lateral public.hotel_v2_h2a_readiness(hotel.id) readiness
  ) rows_to_aggregate;

  return v_result;
end;
$function$;

create or replace function public.hotel_v2_admin_get_property_workspace(p_hotel_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = pg_catalog, public, auth
as $function$
declare
  v_hotel public.hotels%rowtype;
  v_result jsonb;
  v_readiness jsonb;
begin
  perform public.hotel_v2_h2a_require_admin();

  select * into v_hotel from public.hotels where id = p_hotel_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'hotels_v2_h2a_property_not_found';
  end if;

  v_readiness := public.hotel_v2_h2a_readiness(p_hotel_id);

  select jsonb_build_object(
    'property', to_jsonb(v_hotel),
    'owner_partner', (
      select case when partner.id is null then null else jsonb_build_object(
        'id', partner.id,
        'name', partner.name,
        'status', partner.status,
        'can_manage_hotels', partner.can_manage_hotels
      ) end
      from (select 1) singleton
      left join public.partners partner on partner.id = v_hotel.owner_partner_id
    ),
    'operational_partners', coalesce((
      select jsonb_agg(jsonb_build_object(
        'assignment_id', assignment.id,
        'partner_id', partner.id,
        'name', partner.name,
        'status', partner.status,
        'can_manage_hotels', partner.can_manage_hotels,
        'is_active', assignment.is_active
      ) order by partner.name, assignment.id)
      from public.partner_resources assignment
      join public.partners partner on partner.id = assignment.partner_id
      where assignment.resource_type = 'hotels'
        and assignment.resource_id = p_hotel_id
    ), '[]'::jsonb),
    'room_types', coalesce((
      select jsonb_agg(to_jsonb(room_type) order by room_type.sort_order, room_type.id)
      from public.hotel_room_types room_type where room_type.hotel_id = p_hotel_id
    ), '[]'::jsonb),
    'units', coalesce((
      select jsonb_agg(to_jsonb(unit_row) order by room_type.sort_order, unit_row.code, unit_row.id)
      from public.hotel_units unit_row
      join public.hotel_room_types room_type on room_type.id = unit_row.room_type_id
      where room_type.hotel_id = p_hotel_id
    ), '[]'::jsonb),
    'rate_plans', coalesce((
      select jsonb_agg(to_jsonb(rate_plan) order by rate_plan.sort_order, rate_plan.id)
      from public.hotel_rate_plans rate_plan where rate_plan.hotel_id = p_hotel_id
    ), '[]'::jsonb),
    'room_rates', coalesce((
      select jsonb_agg(to_jsonb(room_rate) order by room_rate.sort_order, room_rate.id)
      from public.hotel_room_rates room_rate where room_rate.hotel_id = p_hotel_id
    ), '[]'::jsonb),
    'amenities_catalogue', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', amenity.id,
        'code', amenity.code,
        'category', amenity.category,
        'icon', amenity.icon,
        'name_en', amenity.name_en,
        'name_pl', amenity.name_pl,
        'name_he', amenity.name_he,
        'is_popular', amenity.is_popular
      ) order by amenity.category, amenity.display_order, amenity.code)
      from public.hotel_amenities amenity
      where amenity.is_active
    ), '[]'::jsonb),
    'payment_due_at_booking', jsonb_build_object(
      'default_rule', (
        select to_jsonb(rule_row) - 'created_at' - 'updated_at'
        from public.service_deposit_rules rule_row
        where rule_row.resource_type = 'hotels'
      ),
      'exact_override', (
        select to_jsonb(override_row) - 'created_at' - 'updated_at'
        from public.service_deposit_overrides override_row
        where override_row.resource_type = 'hotels'
          and override_row.resource_id = p_hotel_id
      )
    ),
    'partners', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', partner.id,
        'name', partner.name,
        'status', partner.status,
        'can_manage_hotels', partner.can_manage_hotels
      ) order by partner.name, partner.id)
      from public.partners partner
      where partner.status = 'active'
        and partner.can_manage_hotels
    ), '[]'::jsonb),
    'feature_flags', (
      select jsonb_build_object(
        'hotel_rooms_v2_enabled', setting.hotel_rooms_v2_enabled,
        'hotel_external_sync_enabled', setting.hotel_external_sync_enabled,
        'hotel_instant_booking_enabled', setting.hotel_instant_booking_enabled,
        'hotel_stripe_connect_enabled', setting.hotel_stripe_connect_enabled
      )
      from public.site_settings setting where setting.id = 1
    ),
    'upcoming_booking_count', (
      select count(*)::integer
      from public.hotel_bookings booking
      where booking.hotel_id = p_hotel_id
        and booking.arrival_date >= current_date
        and booking.status not in ('cancelled', 'rejected')
    ),
    'readiness', v_readiness,
    'preparation_state', v_readiness->>'preparation_state',
    'preparation_blockers', v_readiness->'preparation_blockers',
    'recent_activity', coalesce((
      select jsonb_agg(activity_row order by activity_row.created_at desc, activity_row.id desc)
      from (
        select
          activity.id,
          activity.entity_type,
          activity.entity_id,
          activity.action,
          activity.actor_type,
          activity.actor_id,
          activity.source,
          activity.correlation_id,
          activity.created_at
        from public.hotel_activity_log activity
        where activity.hotel_id = p_hotel_id
        order by activity.created_at desc, activity.id desc
        limit 50
      ) activity_row
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

create or replace function public.hotel_v2_admin_apply_workspace_plan(
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
  v_hotel public.hotels%rowtype;
  v_operation jsonb;
  v_entity text;
  v_action text;
  v_id uuid;
  v_payload jsonb;
  v_expected_version bigint;
  v_source_id uuid;
  v_reference_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_room public.hotel_room_types%rowtype;
  v_unit public.hotel_units%rowtype;
  v_rate_plan public.hotel_rate_plans%rowtype;
  v_room_rate public.hotel_room_rates%rowtype;
  v_affected integer;
begin
  perform public.hotel_v2_h2a_require_admin();

  if p_plan is null
     or jsonb_typeof(p_plan) <> 'object'
     or p_correlation_id is null
     or not public.hotel_v2_h2a_keys_allowed(
       p_plan,
       array['hotel_id', 'expected_property_updated_at', 'reviewed_at', 'operations']
     )
     or not (p_plan ? 'hotel_id')
     or not (p_plan ? 'operations')
     or jsonb_typeof(p_plan->'operations') <> 'array'
     or jsonb_array_length(p_plan->'operations') < 1
     or jsonb_array_length(p_plan->'operations') > 100 then
    raise exception using errcode = '22023', message = 'hotels_v2_h2a_invalid_workspace_plan';
  end if;

  v_hotel_id := (p_plan->>'hotel_id')::uuid;

  select * into v_hotel
  from public.hotels
  where id = v_hotel_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'hotels_v2_h2a_property_not_found';
  end if;
  if exists (select 1 from public.hotel_activity_log where correlation_id = p_correlation_id) then
    raise exception using errcode = '23505', message = 'hotels_v2_h2a_correlation_id_already_used';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_plan->'operations') operation(value)
    where operation.value->>'entity' = 'property'
  ) then
    if not (p_plan ? 'expected_property_updated_at')
       or (p_plan->>'expected_property_updated_at')::timestamptz is distinct from v_hotel.updated_at then
      raise exception using errcode = '40001', message = 'hotels_v2_h2a_stale_property';
    end if;
  end if;

  if exists (
    select 1
    from (
      select operation.value->>'entity' as entity_name,
             operation.value->>'id' as entity_id,
             count(*)
      from jsonb_array_elements(p_plan->'operations') operation(value)
      group by operation.value->>'entity', operation.value->>'id'
      having count(*) > 1
    ) duplicate_target
  ) then
    raise exception using errcode = '22023', message = 'hotels_v2_h2a_duplicate_plan_target';
  end if;

  -- Complete stale/shape/dependency preflight.  No mutation occurs before this
  -- loop has validated and row-locked every reviewed exact entity.
  for v_operation in
    select operation.value
    from jsonb_array_elements(p_plan->'operations') with ordinality operation(value, ordinal)
    order by operation.value->>'entity', operation.value->>'id', operation.ordinal
  loop
    if jsonb_typeof(v_operation) <> 'object'
       or not public.hotel_v2_h2a_keys_allowed(
         v_operation,
         array['entity', 'type', 'id', 'expected_version', 'payload']
       )
       or not (v_operation ?& array['entity', 'type', 'id']) then
      raise exception using errcode = '22023', message = 'hotels_v2_h2a_invalid_workspace_operation';
    end if;

    v_entity := v_operation->>'entity';
    v_action := v_operation->>'type';
    v_id := (v_operation->>'id')::uuid;
    v_payload := coalesce(v_operation->'payload', '{}'::jsonb);
    v_expected_version := case
      when v_operation ? 'expected_version' and v_operation->>'expected_version' is not null
        then (v_operation->>'expected_version')::bigint
      else null
    end;

    if v_entity not in ('property', 'room_type', 'unit', 'rate_plan', 'room_rate')
       or v_action not in ('create', 'update', 'disable', 'duplicate')
       or v_id is null
       or jsonb_typeof(v_payload) <> 'object' then
      raise exception using errcode = '22023', message = 'hotels_v2_h2a_invalid_workspace_operation_contract';
    end if;

    if v_entity = 'property' then
      if v_action <> 'update'
         or v_id <> v_hotel_id
         or v_expected_version is not null
         or not public.hotel_v2_h2a_keys_allowed(v_payload, array[
           'title_i18n', 'description_i18n', 'city', 'address_line', 'district',
           'postal_code', 'country', 'latitude', 'longitude', 'google_maps_url',
           'google_place_id', 'amenities', 'check_in_from', 'check_out_until',
           'timezone', 'currency', 'booking_mode', 'owner_partner_id',
           'cover_image_url', 'photos', 'sort_order'
         ]) then
        raise exception using errcode = '22023', message = 'hotels_v2_h2a_invalid_property_operation';
      end if;

      if v_payload ? 'title_i18n'
         and not public.hotel_v2_h2a_i18n_is_valid(v_payload->'title_i18n', true) then
        raise exception using errcode = '22023', message = 'hotels_v2_h2a_invalid_property_name';
      end if;
      if v_payload ? 'description_i18n'
         and not public.hotel_v2_h2a_i18n_is_valid(v_payload->'description_i18n', false) then
        raise exception using errcode = '22023', message = 'hotels_v2_h2a_invalid_property_description';
      end if;
      if (v_payload ? 'amenities' and jsonb_typeof(v_payload->'amenities') <> 'array')
         or (v_payload ? 'photos' and jsonb_typeof(v_payload->'photos') <> 'array') then
        raise exception using errcode = '22023', message = 'hotels_v2_h2a_invalid_property_media';
      end if;
      if v_payload ? 'booking_mode'
         and v_payload->>'booking_mode' not in ('request_confirmation', 'instant_booking', 'external_redirect') then
        raise exception using errcode = '22023', message = 'hotels_v2_h2a_invalid_booking_mode';
      end if;
      if v_payload ? 'owner_partner_id' and v_payload->>'owner_partner_id' is not null
         and not exists (
           select 1 from public.partners partner
           where partner.id = (v_payload->>'owner_partner_id')::uuid
             and partner.status = 'active'
             and partner.can_manage_hotels
         ) then
        raise exception using errcode = '23514', message = 'hotels_v2_h2a_owner_partner_not_eligible';
      end if;

    elsif v_entity = 'room_type' then
      if v_action not in ('create', 'update', 'disable', 'duplicate')
         or not public.hotel_v2_h2a_keys_allowed(v_payload, array[
           'source_id', 'code', 'name_i18n', 'description_i18n', 'gallery',
           'capacity_adults', 'capacity_children', 'bed_configuration',
           'bathrooms', 'size_sqm', 'amenities', 'inventory_mode',
           'base_inventory_count', 'status', 'sort_order'
         ]) then
        raise exception using errcode = '22023', message = 'hotels_v2_h2a_invalid_room_type_operation';
      end if;

      if v_action = 'create' then
        if v_expected_version is not null
           or exists (select 1 from public.hotel_room_types where id = v_id)
           or not (v_payload ?& array['code', 'name_i18n', 'capacity_adults']) then
          raise exception using errcode = '23514', message = 'hotels_v2_h2a_invalid_room_type_create';
        end if;
      elsif v_action = 'duplicate' then
        if v_expected_version is null
           or not (v_payload ?& array['source_id', 'code'])
           or exists (select 1 from public.hotel_room_types where id = v_id) then
          raise exception using errcode = '23514', message = 'hotels_v2_h2a_invalid_room_type_duplicate';
        end if;
        v_source_id := (v_payload->>'source_id')::uuid;
        select * into v_room from public.hotel_room_types
        where id = v_source_id and hotel_id = v_hotel_id for update;
        if not found or v_room.version <> v_expected_version then
          raise exception using errcode = '40001', message = 'hotels_v2_h2a_stale_room_type_source';
        end if;
      else
        if v_expected_version is null then
          raise exception using errcode = '22023', message = 'hotels_v2_h2a_room_type_version_required';
        end if;
        select * into v_room from public.hotel_room_types
        where id = v_id and hotel_id = v_hotel_id for update;
        if not found or v_room.version <> v_expected_version then
          raise exception using errcode = '40001', message = 'hotels_v2_h2a_stale_room_type';
        end if;
        if v_action = 'disable' and v_payload <> '{}'::jsonb then
          raise exception using errcode = '22023', message = 'hotels_v2_h2a_disable_payload_must_be_empty';
        end if;
        if v_action = 'update'
           and v_payload ? 'inventory_mode'
           and v_payload->>'inventory_mode' is distinct from v_room.inventory_mode
           and (
             exists (select 1 from public.hotel_daily_inventory where room_type_id = v_id)
             or (v_room.inventory_mode = 'unitized' and exists (
               select 1 from public.hotel_units where room_type_id = v_id
             ))
           ) then
          raise exception using errcode = '23514', message = 'hotels_v2_h2a_inventory_mode_change_blocked';
        end if;
      end if;

      if v_payload ? 'name_i18n'
         and not public.hotel_v2_h2a_i18n_is_valid(v_payload->'name_i18n', true) then
        raise exception using errcode = '22023', message = 'hotels_v2_h2a_invalid_room_type_name';
      end if;
      if v_payload ? 'description_i18n'
         and not public.hotel_v2_h2a_i18n_is_valid(v_payload->'description_i18n', false) then
        raise exception using errcode = '22023', message = 'hotels_v2_h2a_invalid_room_type_description';
      end if;
      if v_payload ? 'bed_configuration'
         and not public.hotel_v2_h2a_beds_are_valid(v_payload->'bed_configuration') then
        raise exception using errcode = '22023', message = 'hotels_v2_h2a_invalid_bed_configuration';
      end if;
      if (v_payload ? 'gallery' and jsonb_typeof(v_payload->'gallery') <> 'array')
         or (v_payload ? 'amenities' and jsonb_typeof(v_payload->'amenities') <> 'array') then
        raise exception using errcode = '22023', message = 'hotels_v2_h2a_invalid_room_type_collection';
      end if;

    elsif v_entity = 'unit' then
      if v_action not in ('create', 'update', 'disable')
         or not public.hotel_v2_h2a_keys_allowed(v_payload, array[
           'room_type_id', 'code', 'name_i18n', 'status'
         ]) then
        raise exception using errcode = '22023', message = 'hotels_v2_h2a_invalid_unit_operation';
      end if;
      if v_action = 'create' then
        if v_expected_version is not null
           or exists (select 1 from public.hotel_units where id = v_id)
           or not (v_payload ?& array['room_type_id', 'code']) then
          raise exception using errcode = '23514', message = 'hotels_v2_h2a_invalid_unit_create';
        end if;
        v_reference_id := (v_payload->>'room_type_id')::uuid;
        if not exists (
          select 1 from public.hotel_room_types
          where id = v_reference_id and hotel_id = v_hotel_id
        ) and not exists (
          select 1 from jsonb_array_elements(p_plan->'operations') planned(value)
          where planned.value->>'entity' = 'room_type'
            and planned.value->>'type' in ('create', 'duplicate')
            and (planned.value->>'id')::uuid = v_reference_id
        ) then
          raise exception using errcode = '23503', message = 'hotels_v2_h2a_unit_room_type_outside_property';
        end if;

        if not exists (
          select 1
          from public.hotel_room_types room_type
          where room_type.id = v_reference_id
            and room_type.hotel_id = v_hotel_id
            and (
              room_type.inventory_mode = 'unitized'
              or exists (
                select 1
                from jsonb_array_elements(p_plan->'operations') planned(value)
                where planned.value->>'entity' = 'room_type'
                  and planned.value->>'type' = 'update'
                  and (planned.value->>'id')::uuid = v_reference_id
                  and planned.value->'payload'->>'inventory_mode' = 'unitized'
              )
            )
        ) and not exists (
          select 1
          from jsonb_array_elements(p_plan->'operations') planned(value)
          where planned.value->>'entity' = 'room_type'
            and planned.value->>'type' = 'create'
            and (planned.value->>'id')::uuid = v_reference_id
            and coalesce(planned.value->'payload'->>'inventory_mode', 'pooled') = 'unitized'
        ) and not exists (
          select 1
          from jsonb_array_elements(p_plan->'operations') planned(value)
          join public.hotel_room_types source_room
            on source_room.id = (planned.value->'payload'->>'source_id')::uuid
           and source_room.hotel_id = v_hotel_id
          where planned.value->>'entity' = 'room_type'
            and planned.value->>'type' = 'duplicate'
            and (planned.value->>'id')::uuid = v_reference_id
            and coalesce(planned.value->'payload'->>'inventory_mode', source_room.inventory_mode) = 'unitized'
        ) then
          raise exception using errcode = '23514', message = 'hotels_v2_h2a_unit_requires_unitized_room';
        end if;
      else
        if v_expected_version is null then
          raise exception using errcode = '22023', message = 'hotels_v2_h2a_unit_version_required';
        end if;
        select unit_row.* into v_unit
        from public.hotel_units unit_row
        join public.hotel_room_types room_type on room_type.id = unit_row.room_type_id
        where unit_row.id = v_id and room_type.hotel_id = v_hotel_id
        for update of unit_row;
        if not found or v_unit.version <> v_expected_version then
          raise exception using errcode = '40001', message = 'hotels_v2_h2a_stale_unit';
        end if;
        if v_payload ? 'room_type_id' then
          raise exception using errcode = '22023', message = 'hotels_v2_h2a_unit_parent_is_immutable';
        end if;
        if v_action = 'disable' and v_payload <> '{}'::jsonb then
          raise exception using errcode = '22023', message = 'hotels_v2_h2a_disable_payload_must_be_empty';
        end if;
      end if;
      if v_payload ? 'name_i18n'
         and not public.hotel_v2_h2a_i18n_is_valid(v_payload->'name_i18n', false) then
        raise exception using errcode = '22023', message = 'hotels_v2_h2a_invalid_unit_name';
      end if;

    elsif v_entity = 'rate_plan' then
      if v_action not in ('create', 'update', 'disable')
         or not public.hotel_v2_h2a_keys_allowed(v_payload, array[
           'code', 'name_i18n', 'description_i18n', 'meal_plan_code',
           'cancellation_policy', 'booking_mode_override', 'is_active', 'sort_order'
         ]) then
        raise exception using errcode = '22023', message = 'hotels_v2_h2a_invalid_rate_plan_operation';
      end if;
      if v_action = 'create' then
        if v_expected_version is not null
           or exists (select 1 from public.hotel_rate_plans where id = v_id)
           or not (v_payload ?& array['code', 'name_i18n', 'cancellation_policy']) then
          raise exception using errcode = '23514', message = 'hotels_v2_h2a_invalid_rate_plan_create';
        end if;
      else
        if v_expected_version is null then
          raise exception using errcode = '22023', message = 'hotels_v2_h2a_rate_plan_version_required';
        end if;
        select * into v_rate_plan from public.hotel_rate_plans
        where id = v_id and hotel_id = v_hotel_id for update;
        if not found or v_rate_plan.version <> v_expected_version then
          raise exception using errcode = '40001', message = 'hotels_v2_h2a_stale_rate_plan';
        end if;
        if v_action = 'disable' and v_payload <> '{}'::jsonb then
          raise exception using errcode = '22023', message = 'hotels_v2_h2a_disable_payload_must_be_empty';
        end if;
      end if;
      if v_payload ? 'name_i18n'
         and not public.hotel_v2_h2a_i18n_is_valid(v_payload->'name_i18n', true) then
        raise exception using errcode = '22023', message = 'hotels_v2_h2a_invalid_rate_plan_name';
      end if;
      if v_payload ? 'description_i18n'
         and not public.hotel_v2_h2a_i18n_is_valid(v_payload->'description_i18n', false) then
        raise exception using errcode = '22023', message = 'hotels_v2_h2a_invalid_rate_plan_description';
      end if;
      if v_payload ? 'cancellation_policy'
         and not public.hotel_v2_h2a_cancellation_policy_is_valid(v_payload->'cancellation_policy') then
        raise exception using errcode = '22023', message = 'hotels_v2_h2a_invalid_cancellation_policy';
      end if;

    elsif v_entity = 'room_rate' then
      if v_action not in ('create', 'update', 'disable')
         or not public.hotel_v2_h2a_keys_allowed(v_payload, array[
           'room_type_id', 'rate_plan_id', 'base_nightly_rate', 'currency',
           'is_active', 'sort_order'
         ]) then
        raise exception using errcode = '22023', message = 'hotels_v2_h2a_invalid_room_rate_operation';
      end if;
      if v_action = 'create' then
        if v_expected_version is not null
           or exists (select 1 from public.hotel_room_rates where id = v_id)
           or not (v_payload ?& array['room_type_id', 'rate_plan_id', 'base_nightly_rate']) then
          raise exception using errcode = '23514', message = 'hotels_v2_h2a_invalid_room_rate_create';
        end if;

        v_reference_id := (v_payload->>'room_type_id')::uuid;
        if not exists (
          select 1 from public.hotel_room_types where id = v_reference_id and hotel_id = v_hotel_id
        ) and not exists (
          select 1 from jsonb_array_elements(p_plan->'operations') planned(value)
          where planned.value->>'entity' = 'room_type'
            and planned.value->>'type' in ('create', 'duplicate')
            and (planned.value->>'id')::uuid = v_reference_id
        ) then
          raise exception using errcode = '23503', message = 'hotels_v2_h2a_room_rate_room_outside_property';
        end if;

        v_reference_id := (v_payload->>'rate_plan_id')::uuid;
        if not exists (
          select 1 from public.hotel_rate_plans where id = v_reference_id and hotel_id = v_hotel_id
        ) and not exists (
          select 1 from jsonb_array_elements(p_plan->'operations') planned(value)
          where planned.value->>'entity' = 'rate_plan'
            and planned.value->>'type' = 'create'
            and (planned.value->>'id')::uuid = v_reference_id
        ) then
          raise exception using errcode = '23503', message = 'hotels_v2_h2a_room_rate_plan_outside_property';
        end if;
      else
        if v_expected_version is null then
          raise exception using errcode = '22023', message = 'hotels_v2_h2a_room_rate_version_required';
        end if;
        select * into v_room_rate from public.hotel_room_rates
        where id = v_id and hotel_id = v_hotel_id for update;
        if not found or v_room_rate.version <> v_expected_version then
          raise exception using errcode = '40001', message = 'hotels_v2_h2a_stale_room_rate';
        end if;
        if v_payload ? 'room_type_id' or v_payload ? 'rate_plan_id' then
          raise exception using errcode = '22023', message = 'hotels_v2_h2a_room_rate_relationship_is_immutable';
        end if;
        if v_action = 'disable' and v_payload <> '{}'::jsonb then
          raise exception using errcode = '22023', message = 'hotels_v2_h2a_disable_payload_must_be_empty';
        end if;
      end if;
    end if;
  end loop;

  -- Apply after the complete preflight.  Any later constraint failure still
  -- rolls back this one PostgreSQL function call and its entire activity set.
  for v_operation in
    select operation.value
    from jsonb_array_elements(p_plan->'operations') with ordinality operation(value, ordinal)
    order by
      case when operation.value->>'type' in ('create', 'duplicate') then 0 else 1 end,
      case operation.value->>'entity'
        when 'property' then 0
        when 'room_type' then 1
        when 'rate_plan' then 2
        when 'unit' then 3
        when 'room_rate' then 4
        else 9
      end,
      operation.ordinal
  loop
    v_entity := v_operation->>'entity';
    v_action := v_operation->>'type';
    v_id := (v_operation->>'id')::uuid;
    v_payload := coalesce(v_operation->'payload', '{}'::jsonb);
    v_expected_version := case
      when v_operation ? 'expected_version' and v_operation->>'expected_version' is not null
        then (v_operation->>'expected_version')::bigint
      else null
    end;
    v_before := null;
    v_after := null;

    if v_entity = 'property' then
      v_before := to_jsonb(v_hotel);
      update public.hotels hotel
      set
        title_i18n = case when v_payload ? 'title_i18n' then v_payload->'title_i18n' else hotel.title_i18n end,
        title = case when v_payload ? 'title_i18n' then v_payload->'title_i18n' else hotel.title end,
        description_i18n = case when v_payload ? 'description_i18n' then v_payload->'description_i18n' else hotel.description_i18n end,
        description = case when v_payload ? 'description_i18n' then v_payload->'description_i18n' else hotel.description end,
        city = case when v_payload ? 'city' then nullif(btrim(v_payload->>'city'), '') else hotel.city end,
        address_line = case when v_payload ? 'address_line' then nullif(btrim(v_payload->>'address_line'), '') else hotel.address_line end,
        district = case when v_payload ? 'district' then nullif(btrim(v_payload->>'district'), '') else hotel.district end,
        postal_code = case when v_payload ? 'postal_code' then nullif(btrim(v_payload->>'postal_code'), '') else hotel.postal_code end,
        country = case when v_payload ? 'country' then nullif(btrim(v_payload->>'country'), '') else hotel.country end,
        latitude = case when v_payload ? 'latitude' then (v_payload->>'latitude')::double precision else hotel.latitude end,
        longitude = case when v_payload ? 'longitude' then (v_payload->>'longitude')::double precision else hotel.longitude end,
        google_maps_url = case when v_payload ? 'google_maps_url' then nullif(btrim(v_payload->>'google_maps_url'), '') else hotel.google_maps_url end,
        google_place_id = case when v_payload ? 'google_place_id' then nullif(btrim(v_payload->>'google_place_id'), '') else hotel.google_place_id end,
        amenities = case when v_payload ? 'amenities' then v_payload->'amenities' else hotel.amenities end,
        check_in_from = case when v_payload ? 'check_in_from' then (v_payload->>'check_in_from')::time without time zone else hotel.check_in_from end,
        check_out_until = case when v_payload ? 'check_out_until' then (v_payload->>'check_out_until')::time without time zone else hotel.check_out_until end,
        timezone = case when v_payload ? 'timezone' then btrim(v_payload->>'timezone') else hotel.timezone end,
        currency = case when v_payload ? 'currency' then upper(btrim(v_payload->>'currency'))::character(3) else hotel.currency end,
        booking_mode = case when v_payload ? 'booking_mode' then v_payload->>'booking_mode' else hotel.booking_mode end,
        owner_partner_id = case when v_payload ? 'owner_partner_id' then (v_payload->>'owner_partner_id')::uuid else hotel.owner_partner_id end,
        cover_image_url = case when v_payload ? 'cover_image_url' then nullif(btrim(v_payload->>'cover_image_url'), '') else hotel.cover_image_url end,
        photos = case when v_payload ? 'photos' then v_payload->'photos' else hotel.photos end,
        sort_order = case when v_payload ? 'sort_order' then (v_payload->>'sort_order')::integer else hotel.sort_order end
      where hotel.id = v_hotel_id
        and hotel.updated_at = v_hotel.updated_at
      returning to_jsonb(hotel.*) into v_after;
      get diagnostics v_affected = row_count;
      select * into v_hotel from public.hotels where id = v_hotel_id;

    elsif v_entity = 'room_type' and v_action = 'create' then
      insert into public.hotel_room_types (
        id, hotel_id, code, name_i18n, description_i18n, gallery,
        capacity_adults, capacity_children, bed_configuration, bathrooms,
        size_sqm, amenities, inventory_mode, base_inventory_count, status, sort_order
      ) values (
        v_id, v_hotel_id, lower(btrim(v_payload->>'code')), v_payload->'name_i18n',
        coalesce(v_payload->'description_i18n', '{}'::jsonb), coalesce(v_payload->'gallery', '[]'::jsonb),
        (v_payload->>'capacity_adults')::smallint, coalesce((v_payload->>'capacity_children')::smallint, 0),
        coalesce(v_payload->'bed_configuration', '[]'::jsonb),
        case when v_payload ? 'bathrooms' then (v_payload->>'bathrooms')::numeric else null end,
        case when v_payload ? 'size_sqm' then (v_payload->>'size_sqm')::numeric else null end,
        case when v_payload ? 'amenities' then array(select jsonb_array_elements_text(v_payload->'amenities')) else '{}'::text[] end,
        coalesce(v_payload->>'inventory_mode', 'pooled'),
        coalesce((v_payload->>'base_inventory_count')::integer, 0),
        coalesce(v_payload->>'status', 'draft'),
        coalesce((v_payload->>'sort_order')::integer, 1000)
      ) returning to_jsonb(hotel_room_types.*) into v_after;
      v_affected := 1;

    elsif v_entity = 'room_type' and v_action = 'duplicate' then
      v_source_id := (v_payload->>'source_id')::uuid;
      select * into v_room from public.hotel_room_types
      where id = v_source_id and hotel_id = v_hotel_id;
      v_before := to_jsonb(v_room);
      insert into public.hotel_room_types (
        id, hotel_id, code, name_i18n, description_i18n, gallery,
        capacity_adults, capacity_children, bed_configuration, bathrooms,
        size_sqm, amenities, inventory_mode, base_inventory_count, status, sort_order
      ) values (
        v_id, v_hotel_id, lower(btrim(v_payload->>'code')),
        coalesce(v_payload->'name_i18n', v_room.name_i18n),
        coalesce(v_payload->'description_i18n', v_room.description_i18n),
        coalesce(v_payload->'gallery', v_room.gallery),
        coalesce((v_payload->>'capacity_adults')::smallint, v_room.capacity_adults),
        coalesce((v_payload->>'capacity_children')::smallint, v_room.capacity_children),
        coalesce(v_payload->'bed_configuration', v_room.bed_configuration),
        case when v_payload ? 'bathrooms' then (v_payload->>'bathrooms')::numeric else v_room.bathrooms end,
        case when v_payload ? 'size_sqm' then (v_payload->>'size_sqm')::numeric else v_room.size_sqm end,
        case when v_payload ? 'amenities' then array(select jsonb_array_elements_text(v_payload->'amenities')) else v_room.amenities end,
        coalesce(v_payload->>'inventory_mode', v_room.inventory_mode),
        coalesce((v_payload->>'base_inventory_count')::integer, v_room.base_inventory_count),
        'draft',
        coalesce((v_payload->>'sort_order')::integer, v_room.sort_order + 1)
      ) returning to_jsonb(hotel_room_types.*) into v_after;
      v_affected := 1;

    elsif v_entity = 'room_type' then
      select to_jsonb(room_type.*) into v_before from public.hotel_room_types room_type where id = v_id;
      update public.hotel_room_types room_type
      set
        code = case when v_payload ? 'code' then lower(btrim(v_payload->>'code')) else room_type.code end,
        name_i18n = case when v_payload ? 'name_i18n' then v_payload->'name_i18n' else room_type.name_i18n end,
        description_i18n = case when v_payload ? 'description_i18n' then v_payload->'description_i18n' else room_type.description_i18n end,
        gallery = case when v_payload ? 'gallery' then v_payload->'gallery' else room_type.gallery end,
        capacity_adults = case when v_payload ? 'capacity_adults' then (v_payload->>'capacity_adults')::smallint else room_type.capacity_adults end,
        capacity_children = case when v_payload ? 'capacity_children' then (v_payload->>'capacity_children')::smallint else room_type.capacity_children end,
        bed_configuration = case when v_payload ? 'bed_configuration' then v_payload->'bed_configuration' else room_type.bed_configuration end,
        bathrooms = case when v_payload ? 'bathrooms' then (v_payload->>'bathrooms')::numeric else room_type.bathrooms end,
        size_sqm = case when v_payload ? 'size_sqm' then (v_payload->>'size_sqm')::numeric else room_type.size_sqm end,
        amenities = case when v_payload ? 'amenities' then array(select jsonb_array_elements_text(v_payload->'amenities')) else room_type.amenities end,
        inventory_mode = case when v_payload ? 'inventory_mode' then v_payload->>'inventory_mode' else room_type.inventory_mode end,
        base_inventory_count = case when v_payload ? 'base_inventory_count' then (v_payload->>'base_inventory_count')::integer else room_type.base_inventory_count end,
        status = case when v_action = 'disable' then 'disabled' when v_payload ? 'status' then v_payload->>'status' else room_type.status end,
        sort_order = case when v_payload ? 'sort_order' then (v_payload->>'sort_order')::integer else room_type.sort_order end
      where room_type.id = v_id and room_type.version = v_expected_version
      returning to_jsonb(room_type.*) into v_after;
      get diagnostics v_affected = row_count;

    elsif v_entity = 'unit' and v_action = 'create' then
      insert into public.hotel_units (id, room_type_id, code, name_i18n, status)
      values (
        v_id,
        (v_payload->>'room_type_id')::uuid,
        lower(btrim(v_payload->>'code')),
        coalesce(v_payload->'name_i18n', '{}'::jsonb),
        coalesce(v_payload->>'status', 'active')
      ) returning to_jsonb(hotel_units.*) into v_after;
      v_affected := 1;

    elsif v_entity = 'unit' then
      select to_jsonb(unit_row.*) into v_before from public.hotel_units unit_row where id = v_id;
      update public.hotel_units unit_row
      set
        code = case when v_payload ? 'code' then lower(btrim(v_payload->>'code')) else unit_row.code end,
        name_i18n = case when v_payload ? 'name_i18n' then v_payload->'name_i18n' else unit_row.name_i18n end,
        status = case when v_action = 'disable' then 'disabled' when v_payload ? 'status' then v_payload->>'status' else unit_row.status end
      where unit_row.id = v_id and unit_row.version = v_expected_version
      returning to_jsonb(unit_row.*) into v_after;
      get diagnostics v_affected = row_count;

    elsif v_entity = 'rate_plan' and v_action = 'create' then
      insert into public.hotel_rate_plans (
        id, hotel_id, code, name_i18n, description_i18n, meal_plan_code,
        cancellation_policy, booking_mode_override, is_active, sort_order
      ) values (
        v_id, v_hotel_id, lower(btrim(v_payload->>'code')), v_payload->'name_i18n',
        coalesce(v_payload->'description_i18n', '{}'::jsonb),
        nullif(lower(btrim(v_payload->>'meal_plan_code')), ''),
        v_payload->'cancellation_policy', nullif(v_payload->>'booking_mode_override', ''),
        coalesce((v_payload->>'is_active')::boolean, false),
        coalesce((v_payload->>'sort_order')::integer, 1000)
      ) returning to_jsonb(hotel_rate_plans.*) into v_after;
      v_affected := 1;

    elsif v_entity = 'rate_plan' then
      select to_jsonb(rate_plan.*) into v_before from public.hotel_rate_plans rate_plan where id = v_id;
      update public.hotel_rate_plans rate_plan
      set
        code = case when v_payload ? 'code' then lower(btrim(v_payload->>'code')) else rate_plan.code end,
        name_i18n = case when v_payload ? 'name_i18n' then v_payload->'name_i18n' else rate_plan.name_i18n end,
        description_i18n = case when v_payload ? 'description_i18n' then v_payload->'description_i18n' else rate_plan.description_i18n end,
        meal_plan_code = case when v_payload ? 'meal_plan_code' then nullif(lower(btrim(v_payload->>'meal_plan_code')), '') else rate_plan.meal_plan_code end,
        cancellation_policy = case when v_payload ? 'cancellation_policy' then v_payload->'cancellation_policy' else rate_plan.cancellation_policy end,
        booking_mode_override = case when v_payload ? 'booking_mode_override' then nullif(v_payload->>'booking_mode_override', '') else rate_plan.booking_mode_override end,
        is_active = case when v_action = 'disable' then false when v_payload ? 'is_active' then (v_payload->>'is_active')::boolean else rate_plan.is_active end,
        sort_order = case when v_payload ? 'sort_order' then (v_payload->>'sort_order')::integer else rate_plan.sort_order end
      where rate_plan.id = v_id and rate_plan.version = v_expected_version
      returning to_jsonb(rate_plan.*) into v_after;
      get diagnostics v_affected = row_count;

    elsif v_entity = 'room_rate' and v_action = 'create' then
      insert into public.hotel_room_rates (
        id, hotel_id, room_type_id, rate_plan_id, base_nightly_rate,
        currency, is_active, sort_order
      ) values (
        v_id, v_hotel_id, (v_payload->>'room_type_id')::uuid,
        (v_payload->>'rate_plan_id')::uuid, (v_payload->>'base_nightly_rate')::numeric,
        coalesce(nullif(upper(btrim(v_payload->>'currency')), ''), v_hotel.currency)::character(3),
        coalesce((v_payload->>'is_active')::boolean, false),
        coalesce((v_payload->>'sort_order')::integer, 1000)
      ) returning to_jsonb(hotel_room_rates.*) into v_after;
      v_affected := 1;

    elsif v_entity = 'room_rate' then
      select to_jsonb(room_rate.*) into v_before from public.hotel_room_rates room_rate where id = v_id;
      update public.hotel_room_rates room_rate
      set
        base_nightly_rate = case when v_payload ? 'base_nightly_rate' then (v_payload->>'base_nightly_rate')::numeric else room_rate.base_nightly_rate end,
        currency = case when v_payload ? 'currency' then upper(btrim(v_payload->>'currency'))::character(3) else room_rate.currency end,
        is_active = case when v_action = 'disable' then false when v_payload ? 'is_active' then (v_payload->>'is_active')::boolean else room_rate.is_active end,
        sort_order = case when v_payload ? 'sort_order' then (v_payload->>'sort_order')::integer else room_rate.sort_order end
      where room_rate.id = v_id and room_rate.version = v_expected_version
      returning to_jsonb(room_rate.*) into v_after;
      get diagnostics v_affected = row_count;
    end if;

    if coalesce(v_affected, 0) <> 1 then
      raise exception using errcode = '40001', message = 'hotels_v2_h2a_stale_during_apply';
    end if;

    insert into public.hotel_activity_log (
      hotel_id, entity_type, entity_id, action, before_state, after_state,
      actor_type, actor_id, source, correlation_id
    ) values (
      v_hotel_id, v_entity, v_id, v_action, v_before, v_after,
      'admin', auth.uid(), 'hotels_v2_h2a_workspace_plan', p_correlation_id
    );
  end loop;

  return jsonb_build_object(
    'correlation_id', p_correlation_id,
    'workspace', public.hotel_v2_admin_get_property_workspace(v_hotel_id),
    'activity', (
      select coalesce(jsonb_agg(to_jsonb(activity) order by activity.created_at, activity.id), '[]'::jsonb)
      from public.hotel_activity_log activity
      where activity.correlation_id = p_correlation_id
    )
  );
end;
$function$;

comment on function public.hotel_v2_admin_get_property_list() is
  'Admin-only H2A property summaries. One result object per property; rooms are counts, never top-level properties.';
comment on function public.hotel_v2_admin_get_property_workspace(uuid) is
  'Admin-only exact-property H2A workspace snapshot without customer contact PII.';
comment on function public.hotel_v2_admin_create_property_draft(uuid, jsonb, uuid) is
  'Admin-only exact-ID rooms_v2 draft creation. Always unpublished/request-confirmation; capability flags are untouched.';
comment on function public.hotel_v2_admin_apply_workspace_plan(jsonb, uuid) is
  'Admin-only all-or-nothing reviewed H2A plan. Every stale version is rejected before the first mutation.';

revoke all on function public.hotel_v2_h2a_i18n_is_valid(jsonb, boolean)
  from public, anon;
revoke all on function public.hotel_v2_h2a_beds_are_valid(jsonb)
  from public, anon;
revoke all on function public.hotel_v2_h2a_cancellation_policy_is_valid(jsonb)
  from public, anon;
grant execute on function public.hotel_v2_h2a_i18n_is_valid(jsonb, boolean)
  to authenticated, service_role;
grant execute on function public.hotel_v2_h2a_beds_are_valid(jsonb)
  to authenticated, service_role;
grant execute on function public.hotel_v2_h2a_cancellation_policy_is_valid(jsonb)
  to authenticated, service_role;

revoke all on function public.hotel_v2_h2a_require_admin()
  from public, anon, authenticated, service_role;
revoke all on function public.hotel_v2_h2a_keys_allowed(jsonb, text[])
  from public, anon, authenticated, service_role;
revoke all on function public.hotel_v2_h2a_readiness(uuid)
  from public, anon, authenticated, service_role;

revoke all on function public.hotel_v2_admin_get_property_list()
  from public, anon, authenticated, service_role;
revoke all on function public.hotel_v2_admin_get_property_workspace(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.hotel_v2_admin_create_property_draft(uuid, jsonb, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.hotel_v2_admin_apply_workspace_plan(jsonb, uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.hotel_v2_admin_get_property_list()
  to authenticated;
grant execute on function public.hotel_v2_admin_get_property_workspace(uuid)
  to authenticated;
grant execute on function public.hotel_v2_admin_create_property_draft(uuid, jsonb, uuid)
  to authenticated;
grant execute on function public.hotel_v2_admin_apply_workspace_plan(jsonb, uuid)
  to authenticated;

do $h2a_postconditions$
declare
  v_snapshot hotels_v2_h2a_protected_snapshot%rowtype;
  v_fingerprint text;
begin
  select * into v_snapshot from hotels_v2_h2a_protected_snapshot;

  if exists (select 1 from public.hotel_activity_log)
     or exists (select 1 from public.hotel_room_types)
     or exists (select 1 from public.hotel_units)
     or exists (select 1 from public.hotel_rate_plans)
     or exists (select 1 from public.hotel_room_rates)
     or exists (select 1 from public.hotel_rate_rules)
     or exists (select 1 from public.hotel_daily_inventory)
     or exists (select 1 from public.hotel_daily_rates) then
    raise exception using errcode = '23514', message = 'hotels_v2_h2a_foundation_seeded_unexpected_rows';
  end if;

  if exists (select 1 from public.hotels where architecture_version <> 'legacy')
     or exists (
       select 1 from public.site_settings
       where hotel_rooms_v2_enabled
          or hotel_external_sync_enabled
          or hotel_instant_booking_enabled
          or hotel_stripe_connect_enabled
     ) then
    raise exception using errcode = '23514', message = 'hotels_v2_h2a_foundation_not_inert';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'public.hotels'::regclass
      and constraint_row.conname = 'hotels_h2a_rooms_v2_unpublished_check'
      and constraint_row.contype = 'c'
      and constraint_row.convalidated
  ) then
    raise exception using errcode = '23514', message = 'hotels_v2_h2a_rooms_v2_publication_guard_missing';
  end if;

  select md5(coalesce(string_agg(to_jsonb(hotel)::text, '|' order by hotel.id), ''))
  into v_fingerprint from public.hotels hotel;
  if v_fingerprint is distinct from v_snapshot.hotels_fingerprint then
    raise exception using errcode = '23514', message = 'hotels_v2_h2a_existing_hotels_changed';
  end if;

  select md5(coalesce(string_agg(to_jsonb(booking)::text, '|' order by booking.id), ''))
  into v_fingerprint from public.hotel_bookings booking;
  if v_fingerprint is distinct from v_snapshot.bookings_fingerprint then
    raise exception using errcode = '23514', message = 'hotels_v2_h2a_existing_bookings_changed';
  end if;

  select md5(coalesce(string_agg(to_jsonb(setting)::text, '|' order by setting.id), ''))
  into v_fingerprint from public.site_settings setting;
  if v_fingerprint is distinct from v_snapshot.settings_fingerprint then
    raise exception using errcode = '23514', message = 'hotels_v2_h2a_site_settings_changed';
  end if;

  if not exists (
    select 1 from pg_class relation
    where relation.oid = 'public.hotel_activity_log'::regclass
      and relation.relrowsecurity
  )
  or (select count(*) from pg_policies where schemaname = 'public' and tablename = 'hotel_activity_log') <> 1
  or has_table_privilege('anon', 'public.hotel_activity_log', 'SELECT')
  or has_table_privilege('authenticated', 'public.hotel_activity_log', 'INSERT')
  or has_table_privilege('authenticated', 'public.hotel_activity_log', 'UPDATE')
  or has_table_privilege('authenticated', 'public.hotel_activity_log', 'DELETE')
  or not has_table_privilege('authenticated', 'public.hotel_activity_log', 'SELECT')
  or has_table_privilege('service_role', 'public.hotel_activity_log', 'UPDATE')
  or has_table_privilege('service_role', 'public.hotel_activity_log', 'DELETE') then
    raise exception using errcode = '23514', message = 'hotels_v2_h2a_activity_security_contract_mismatch';
  end if;

  if exists (
    select 1
    from unnest(array[
      'hotel_room_types', 'hotel_units', 'hotel_rate_plans', 'hotel_room_rates',
      'hotel_rate_rules', 'hotel_daily_inventory', 'hotel_daily_rates'
    ]::text[]) table_name
    where not has_table_privilege('authenticated', format('public.%I', table_name), 'SELECT')
       or has_table_privilege('authenticated', format('public.%I', table_name), 'INSERT')
       or has_table_privilege('authenticated', format('public.%I', table_name), 'UPDATE')
       or has_table_privilege('authenticated', format('public.%I', table_name), 'DELETE')
  ) then
    raise exception using errcode = '23514', message = 'hotels_v2_h2a_normalized_write_grant_mismatch';
  end if;

  if has_function_privilege('anon', 'public.hotel_v2_admin_get_property_list()', 'EXECUTE')
     or has_function_privilege('anon', 'public.hotel_v2_admin_get_property_workspace(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.hotel_v2_admin_create_property_draft(uuid,jsonb,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.hotel_v2_admin_get_property_list()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.hotel_v2_admin_get_property_workspace(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.hotel_v2_admin_create_property_draft(uuid,jsonb,uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.hotel_v2_admin_get_property_list()', 'EXECUTE')
     or has_function_privilege('service_role', 'public.hotel_v2_admin_get_property_workspace(uuid)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.hotel_v2_admin_create_property_draft(uuid,jsonb,uuid)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid)', 'EXECUTE') then
    raise exception using errcode = '23514', message = 'hotels_v2_h2a_rpc_grant_contract_mismatch';
  end if;
end
$h2a_postconditions$;

-- H2B will introduce the calendar resolver and exact-date override table.
-- The accepted manual precedence is:
--   1. safety closure,
--   2. exact-date Admin override,
--   3. highest-priority matching seasonal/range rule,
--   4. matching weekday rule,
--   5. room-rate base rate.
-- A table is deliberately deferred until H2B defines null/clear semantics and
-- interaction with materialized hotel_daily_rates / hotel_daily_inventory.

commit;
