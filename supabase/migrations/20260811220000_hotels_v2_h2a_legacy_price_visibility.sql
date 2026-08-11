begin;

set transaction isolation level repeatable read;

-- Hotels H2A legacy-price visibility repair.
--
-- The Property Directory deliberately reads normalized Rooms V2 products for
-- its top-level price_from value. Legacy properties do not have normalized
-- products yet, so the Admin client also needs the accepted legacy pricing
-- inputs in order to run the existing CE_HOTEL_PRICING preview unchanged.
-- This migration changes one Admin reader only. It does not write Hotel rows,
-- create normalized records, or alter any public pricing/booking path.

do $legacy_price_visibility_preconditions$
declare
  v_function oid := to_regprocedure('public.hotel_v2_admin_get_property_list()');
  v_definition text;
begin
  if v_function is null then
    raise exception using
      errcode = '42883',
      message = 'hotels_v2_h2a_property_list_rpc_missing';
  end if;

  if exists (
    select 1
    from (values
      ('architecture_version', 'text'),
      ('pricing_model', 'text'),
      ('pricing_tiers', 'jsonb'),
      ('room_types', 'jsonb'),
      ('pricing_extras', 'jsonb'),
      ('max_persons', 'integer'),
      ('currency', 'character')
    ) expected(column_name, data_type)
    left join information_schema.columns actual
      on actual.table_schema = 'public'
     and actual.table_name = 'hotels'
     and actual.column_name = expected.column_name
     and actual.data_type = expected.data_type
    where actual.column_name is null
  ) then
    raise exception using
      errcode = '42703',
      message = 'hotels_v2_h2a_legacy_pricing_source_contract_missing';
  end if;

  select pg_get_functiondef(v_function) into v_definition;

  if position('assignment.is_active' in v_definition) > 0
     or position('assignment.resource_type = ''hotels''' in v_definition) = 0
     or position('assignment.resource_id = hotel.id' in v_definition) = 0 then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_h2a_property_list_partner_contract_unexpected';
  end if;

  if position('''price_from''' in v_definition) = 0
     or position('public.hotel_room_rates' in v_definition) = 0 then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_h2a_property_list_normalized_price_contract_unexpected';
  end if;

  if position('''legacy_configuration''' in v_definition) > 0 then
    raise exception using
      errcode = '55000',
      message = 'hotels_v2_h2a_legacy_price_visibility_already_applied';
  end if;

  if not (
    select procedure_info.prosecdef
      and procedure_info.provolatile = 's'
      and 'search_path=pg_catalog, public, auth'
          = any(coalesce(procedure_info.proconfig, '{}'::text[]))
    from pg_proc procedure_info
    where procedure_info.oid = v_function
  ) then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_h2a_property_list_security_contract_unexpected';
  end if;
end
$legacy_price_visibility_preconditions$;

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
        'legacy_configuration', case
          when hotel.architecture_version = 'legacy' then jsonb_build_object(
            'pricing_model', hotel.pricing_model,
            'pricing_tiers', coalesce(
              hotel.pricing_tiers,
              jsonb_build_object('currency', hotel.currency, 'rules', jsonb_build_array())
            ),
            'room_types', coalesce(hotel.room_types, jsonb_build_array()),
            'pricing_extras', coalesce(
              hotel.pricing_extras,
              jsonb_build_object('currency', hotel.currency, 'items', jsonb_build_array())
            ),
            'max_persons', hotel.max_persons,
            'currency', hotel.currency
          )
          else null
        end,
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

comment on function public.hotel_v2_admin_get_property_list() is
  'Admin-only H2A property summaries. Legacy pricing inputs are returned separately from normalized Rooms V2 price_from so the established preview engine remains authoritative.';

revoke all on function public.hotel_v2_admin_get_property_list()
  from public, anon, authenticated, service_role;
grant execute on function public.hotel_v2_admin_get_property_list()
  to authenticated;

do $legacy_price_visibility_postconditions$
declare
  v_function oid := to_regprocedure('public.hotel_v2_admin_get_property_list()');
  v_definition text;
begin
  select pg_get_functiondef(v_function) into v_definition;

  if position('''legacy_configuration''' in v_definition) = 0
     or position('''pricing_model'', hotel.pricing_model' in v_definition) = 0
     or position('''pricing_tiers'', coalesce' in v_definition) = 0
     or position('''room_types'', coalesce' in v_definition) = 0
     or position('''pricing_extras'', coalesce' in v_definition) = 0
     or position('''max_persons'', hotel.max_persons' in v_definition) = 0
     or position('when hotel.architecture_version = ''legacy''' in v_definition) = 0 then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_h2a_legacy_configuration_contract_missing';
  end if;

  if position('assignment.is_active' in v_definition) > 0
     or position('assignment.resource_type = ''hotels''' in v_definition) = 0
     or position('assignment.resource_id = hotel.id' in v_definition) = 0 then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_h2a_property_list_partner_contract_regressed';
  end if;

  if not (
    select procedure_info.prosecdef
      and procedure_info.provolatile = 's'
      and 'search_path=pg_catalog, public, auth'
          = any(coalesce(procedure_info.proconfig, '{}'::text[]))
    from pg_proc procedure_info
    where procedure_info.oid = v_function
  )
  or not has_function_privilege(
       'authenticated',
       'public.hotel_v2_admin_get_property_list()',
       'EXECUTE'
     )
  or has_function_privilege(
       'anon',
       'public.hotel_v2_admin_get_property_list()',
       'EXECUTE'
     )
  or has_function_privilege(
       'service_role',
       'public.hotel_v2_admin_get_property_list()',
       'EXECUTE'
     ) then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_h2a_property_list_security_contract_regressed';
  end if;
end
$legacy_price_visibility_postconditions$;

commit;
