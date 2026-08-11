begin;
set transaction isolation level repeatable read;

-- Hotels 2.0 H2A production hotfix.
--
-- The deployed H2A Admin directory used partner_resources.is_active even
-- though the established relationship contract represents an active
-- assignment by row existence. This migration replaces only the three
-- affected read functions. It does not add a column or mutate any Hotel,
-- booking, fulfillment, feature-flag, partner, room, rate, or payment row.
--
-- This is intentionally a one-time fail-closed repair. Reapplying it after
-- success is rejected because the defective function-body predicate is no
-- longer present.

do $hotfix_preconditions$
declare
  v_actual_columns text[];
  v_bad_functions text[];
begin
  if to_regclass('public.partner_resources') is null
     or to_regclass('public.hotels') is null
     or to_regclass('public.hotel_bookings') is null
     or to_regclass('public.partner_service_fulfillments') is null
     or to_regclass('public.site_settings') is null then
    raise exception using
      errcode = '42P01',
      message = 'hotels_v2_h2a_property_directory_hotfix_required_table_missing';
  end if;

  if to_regprocedure('public.hotel_v2_h2a_readiness(uuid)') is null
     or to_regprocedure('public.hotel_v2_admin_get_property_list()') is null
     or to_regprocedure('public.hotel_v2_admin_get_property_workspace(uuid)') is null then
    raise exception using
      errcode = '42883',
      message = 'hotels_v2_h2a_property_directory_hotfix_required_function_missing';
  end if;

  select coalesce(array_agg(column_name order by ordinal_position), '{}'::text[])
  into v_actual_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'partner_resources';

  if v_actual_columns <> array[
    'id', 'partner_id', 'resource_type', 'resource_id', 'created_at'
  ]::text[] then
    raise exception using
      errcode = '42703',
      message = 'hotels_v2_h2a_partner_resources_contract_mismatch',
      detail = 'actual_columns=' || array_to_string(v_actual_columns, ',');
  end if;

  if exists (
    select 1
    from information_schema.columns column_info
    where column_info.table_schema = 'public'
      and column_info.table_name = 'partner_resources'
      and (
        (column_info.column_name = 'id'
          and (column_info.data_type <> 'uuid' or column_info.is_nullable <> 'NO'))
        or (column_info.column_name = 'partner_id'
          and (column_info.data_type <> 'uuid' or column_info.is_nullable <> 'NO'))
        or (column_info.column_name = 'resource_type'
          and (column_info.data_type <> 'text' or column_info.is_nullable <> 'NO'))
        or (column_info.column_name = 'resource_id'
          and (column_info.data_type <> 'uuid' or column_info.is_nullable <> 'NO'))
        or (column_info.column_name = 'created_at'
          and (column_info.data_type <> 'timestamp with time zone'
            or column_info.is_nullable <> 'YES'))
      )
  ) then
    raise exception using
      errcode = '42804',
      message = 'hotels_v2_h2a_partner_resources_column_shape_mismatch';
  end if;

  if not exists (
    select 1
    from pg_class relation
    where relation.oid = 'public.partner_resources'::regclass
      and relation.relrowsecurity
  ) then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_h2a_partner_resources_rls_missing';
  end if;

  select coalesce(array_agg(signature order by signature), '{}'::text[])
  into v_bad_functions
  from (
    values
      ('public.hotel_v2_h2a_readiness(uuid)'::text),
      ('public.hotel_v2_admin_get_property_list()'::text),
      ('public.hotel_v2_admin_get_property_workspace(uuid)'::text)
  ) required(signature)
  where position(
    'assignment.is_active'
    in pg_get_functiondef(to_regprocedure(required.signature))
  ) = 0;

  if cardinality(v_bad_functions) > 0 then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_h2a_property_directory_defect_not_present',
      detail = array_to_string(v_bad_functions, ',');
  end if;

  if not (
    select procedure_info.prosecdef
      and procedure_info.provolatile = 's'
      and 'search_path=pg_catalog, public' = any(coalesce(procedure_info.proconfig, '{}'::text[]))
    from pg_proc procedure_info
    where procedure_info.oid = to_regprocedure('public.hotel_v2_h2a_readiness(uuid)')
  ) then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_h2a_readiness_security_contract_mismatch';
  end if;

  if exists (
    select 1
    from unnest(array[
      'public.hotel_v2_admin_get_property_list()',
      'public.hotel_v2_admin_get_property_workspace(uuid)'
    ]::text[]) required(signature)
    join pg_proc procedure_info
      on procedure_info.oid = to_regprocedure(required.signature)
    where not procedure_info.prosecdef
       or procedure_info.provolatile <> 's'
       or not (
         'search_path=pg_catalog, public, auth'
         = any(coalesce(procedure_info.proconfig, '{}'::text[]))
       )
       or not has_function_privilege('authenticated', procedure_info.oid, 'EXECUTE')
       or has_function_privilege('anon', procedure_info.oid, 'EXECUTE')
       or has_function_privilege('service_role', procedure_info.oid, 'EXECUTE')
  ) then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_h2a_admin_reader_security_contract_mismatch';
  end if;

  if has_function_privilege(
       'authenticated',
       'public.hotel_v2_h2a_readiness(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.hotel_v2_h2a_readiness(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.hotel_v2_h2a_readiness(uuid)',
       'EXECUTE'
     ) then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_h2a_readiness_grant_contract_mismatch';
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
      message = 'hotels_v2_h2a_property_directory_hotfix_flags_not_inert';
  end if;
end
$hotfix_preconditions$;

lock table public.hotels in share mode;
lock table public.hotel_bookings in share mode;
lock table public.partner_service_fulfillments in share mode;
lock table public.partner_resources in share mode;
lock table public.partners in share mode;
lock table public.hotel_room_types in share mode;
lock table public.hotel_units in share mode;
lock table public.hotel_rate_plans in share mode;
lock table public.hotel_room_rates in share mode;
lock table public.hotel_activity_log in share mode;
lock table public.service_deposit_rules in share mode;
lock table public.service_deposit_overrides in share mode;
lock table public.site_settings in share mode;

create temporary table hotels_v2_h2a_property_directory_hotfix_snapshot
on commit drop
as
select jsonb_build_object(
  'hotels', (
    select md5(coalesce(string_agg(to_jsonb(row_data)::text, '|' order by row_data.id), ''))
    from public.hotels row_data
  ),
  'bookings', (
    select md5(coalesce(string_agg(to_jsonb(row_data)::text, '|' order by row_data.id), ''))
    from public.hotel_bookings row_data
  ),
  'fulfillments', (
    select md5(coalesce(string_agg(to_jsonb(row_data)::text, '|' order by row_data.id), ''))
    from public.partner_service_fulfillments row_data
    where row_data.resource_type = 'hotels'
  ),
  'assignments', (
    select md5(coalesce(string_agg(to_jsonb(row_data)::text, '|' order by row_data.id), ''))
    from public.partner_resources row_data
    where row_data.resource_type = 'hotels'
  ),
  'partners', (
    select md5(coalesce(string_agg(to_jsonb(row_data)::text, '|' order by row_data.id), ''))
    from public.partners row_data
  ),
  'room_types', (
    select md5(coalesce(string_agg(to_jsonb(row_data)::text, '|' order by row_data.id), ''))
    from public.hotel_room_types row_data
  ),
  'units', (
    select md5(coalesce(string_agg(to_jsonb(row_data)::text, '|' order by row_data.id), ''))
    from public.hotel_units row_data
  ),
  'rate_plans', (
    select md5(coalesce(string_agg(to_jsonb(row_data)::text, '|' order by row_data.id), ''))
    from public.hotel_rate_plans row_data
  ),
  'room_rates', (
    select md5(coalesce(string_agg(to_jsonb(row_data)::text, '|' order by row_data.id), ''))
    from public.hotel_room_rates row_data
  ),
  'activity', (
    select md5(coalesce(string_agg(to_jsonb(row_data)::text, '|' order by row_data.id), ''))
    from public.hotel_activity_log row_data
  ),
  'deposit_rules', (
    select md5(coalesce(string_agg(to_jsonb(row_data)::text, '|' order by row_data.id), ''))
    from public.service_deposit_rules row_data
    where row_data.resource_type = 'hotels'
  ),
  'deposit_overrides', (
    select md5(coalesce(string_agg(to_jsonb(row_data)::text, '|' order by row_data.id), ''))
    from public.service_deposit_overrides row_data
    where row_data.resource_type = 'hotels'
  ),
  'settings', (
    select md5(coalesce(string_agg(to_jsonb(row_data)::text, '|' order by row_data.id), ''))
    from public.site_settings row_data
  )
) as protected_state;

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
        'is_active', true
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

comment on function public.hotel_v2_h2a_readiness(uuid) is
  'Internal H2A readiness summary. Operational Hotel assignment activity is represented by partner_resources row existence.';
comment on function public.hotel_v2_admin_get_property_list() is
  'Admin-only H2A property summaries. One result object per property; rooms are counts, never top-level properties.';
comment on function public.hotel_v2_admin_get_property_workspace(uuid) is
  'Admin-only exact-property H2A workspace snapshot without customer contact PII. Operational assignment is_active is a derived compatibility value.';

revoke all on function public.hotel_v2_h2a_readiness(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.hotel_v2_admin_get_property_list()
  from public, anon, authenticated, service_role;
revoke all on function public.hotel_v2_admin_get_property_workspace(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.hotel_v2_admin_get_property_list()
  to authenticated;
grant execute on function public.hotel_v2_admin_get_property_workspace(uuid)
  to authenticated;

do $hotfix_postconditions$
declare
  v_expected jsonb;
  v_actual jsonb;
  v_hotel_id uuid;
begin
  if exists (
    select 1
    from unnest(array[
      'public.hotel_v2_h2a_readiness(uuid)',
      'public.hotel_v2_admin_get_property_list()',
      'public.hotel_v2_admin_get_property_workspace(uuid)'
    ]::text[]) required(signature)
    where position(
      'assignment.is_active'
      in pg_get_functiondef(to_regprocedure(required.signature))
    ) > 0
  ) then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_h2a_property_directory_invalid_column_reference_remains';
  end if;

  if position(
    '''is_active'', true'
    in pg_get_functiondef(
      to_regprocedure('public.hotel_v2_admin_get_property_workspace(uuid)')
    )
  ) = 0 then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_h2a_operational_partner_compatibility_field_missing';
  end if;

  if not (
    select procedure_info.prosecdef
      and procedure_info.provolatile = 's'
      and 'search_path=pg_catalog, public' = any(coalesce(procedure_info.proconfig, '{}'::text[]))
    from pg_proc procedure_info
    where procedure_info.oid = to_regprocedure('public.hotel_v2_h2a_readiness(uuid)')
  )
  or has_function_privilege(
       'authenticated',
       'public.hotel_v2_h2a_readiness(uuid)',
       'EXECUTE'
     )
  or has_function_privilege(
       'anon',
       'public.hotel_v2_h2a_readiness(uuid)',
       'EXECUTE'
     )
  or has_function_privilege(
       'service_role',
       'public.hotel_v2_h2a_readiness(uuid)',
       'EXECUTE'
     ) then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_h2a_readiness_post_security_contract_failed';
  end if;

  if exists (
    select 1
    from unnest(array[
      'public.hotel_v2_admin_get_property_list()',
      'public.hotel_v2_admin_get_property_workspace(uuid)'
    ]::text[]) required(signature)
    join pg_proc procedure_info
      on procedure_info.oid = to_regprocedure(required.signature)
    where not procedure_info.prosecdef
       or procedure_info.provolatile <> 's'
       or not (
         'search_path=pg_catalog, public, auth'
         = any(coalesce(procedure_info.proconfig, '{}'::text[]))
       )
       or not has_function_privilege('authenticated', procedure_info.oid, 'EXECUTE')
       or has_function_privilege('anon', procedure_info.oid, 'EXECUTE')
       or has_function_privilege('service_role', procedure_info.oid, 'EXECUTE')
  ) then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_h2a_admin_reader_post_security_contract_failed';
  end if;

  for v_hotel_id in select id from public.hotels order by id
  loop
    perform public.hotel_v2_h2a_readiness(v_hotel_id);
  end loop;

  select protected_state
  into v_expected
  from hotels_v2_h2a_property_directory_hotfix_snapshot;

  select jsonb_build_object(
    'hotels', (
      select md5(coalesce(string_agg(to_jsonb(row_data)::text, '|' order by row_data.id), ''))
      from public.hotels row_data
    ),
    'bookings', (
      select md5(coalesce(string_agg(to_jsonb(row_data)::text, '|' order by row_data.id), ''))
      from public.hotel_bookings row_data
    ),
    'fulfillments', (
      select md5(coalesce(string_agg(to_jsonb(row_data)::text, '|' order by row_data.id), ''))
      from public.partner_service_fulfillments row_data
      where row_data.resource_type = 'hotels'
    ),
    'assignments', (
      select md5(coalesce(string_agg(to_jsonb(row_data)::text, '|' order by row_data.id), ''))
      from public.partner_resources row_data
      where row_data.resource_type = 'hotels'
    ),
    'partners', (
      select md5(coalesce(string_agg(to_jsonb(row_data)::text, '|' order by row_data.id), ''))
      from public.partners row_data
    ),
    'room_types', (
      select md5(coalesce(string_agg(to_jsonb(row_data)::text, '|' order by row_data.id), ''))
      from public.hotel_room_types row_data
    ),
    'units', (
      select md5(coalesce(string_agg(to_jsonb(row_data)::text, '|' order by row_data.id), ''))
      from public.hotel_units row_data
    ),
    'rate_plans', (
      select md5(coalesce(string_agg(to_jsonb(row_data)::text, '|' order by row_data.id), ''))
      from public.hotel_rate_plans row_data
    ),
    'room_rates', (
      select md5(coalesce(string_agg(to_jsonb(row_data)::text, '|' order by row_data.id), ''))
      from public.hotel_room_rates row_data
    ),
    'activity', (
      select md5(coalesce(string_agg(to_jsonb(row_data)::text, '|' order by row_data.id), ''))
      from public.hotel_activity_log row_data
    ),
    'deposit_rules', (
      select md5(coalesce(string_agg(to_jsonb(row_data)::text, '|' order by row_data.id), ''))
      from public.service_deposit_rules row_data
      where row_data.resource_type = 'hotels'
    ),
    'deposit_overrides', (
      select md5(coalesce(string_agg(to_jsonb(row_data)::text, '|' order by row_data.id), ''))
      from public.service_deposit_overrides row_data
      where row_data.resource_type = 'hotels'
    ),
    'settings', (
      select md5(coalesce(string_agg(to_jsonb(row_data)::text, '|' order by row_data.id), ''))
      from public.site_settings row_data
    )
  )
  into v_actual;

  if v_actual is distinct from v_expected then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_h2a_property_directory_hotfix_changed_protected_data';
  end if;
end
$hotfix_postconditions$;

commit;

