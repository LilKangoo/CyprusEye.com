-- Transport Price 4.0A-2 - round-trip total semantics diagnostics.
-- Read-only. Do not execute any mutating RPC from this file.
--
-- Purpose: confirm whether deployed public.get_service_deposit_status(uuid)
-- or related functions/views add transport_bookings.return_total_price on top of
-- transport_bookings.total_price for round-trip transport bookings.

with fns as (
  select
    p.oid,
    p.proname,
    pg_get_function_identity_arguments(p.oid) as identity_args,
    pg_get_function_result(p.oid) as result_type,
    p.prosrc,
    lower(regexp_replace(coalesce(p.prosrc, ''), '[[:space:]]+', ' ', 'g')) as source
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
),
deposit_status_overloads as (
  select *
  from fns
  where proname = 'get_service_deposit_status'
),
target as (
  select *
  from deposit_status_overloads
  where identity_args = 'p_id uuid'
  limit 1
),
other_sources as (
  select
    'function' as source_type,
    proname || '(' || identity_args || ')' as source_name,
    source
  from fns
  where proname <> 'get_service_deposit_status'
    and source like '%transport_bookings%'
    and source like '%return_total_price%'
    and source like '%total_price%'
    and (
      source ~ 'total_price.{0,220}\+.{0,220}return_total_price'
      or source ~ 'return_total_price.{0,220}\+.{0,220}total_price'
      or source like '%coalesce(tr.total_price%'
      or source like '%coalesce(tb.total_price%'
      or source like '%coalesce(transport_bookings.total_price%'
    )

  union all

  select
    case when c.relkind = 'm' then 'materialized_view' else 'view' end as source_type,
    c.relname as source_name,
    lower(regexp_replace(coalesce(pg_get_viewdef(c.oid, true), ''), '[[:space:]]+', ' ', 'g')) as source
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('v', 'm')
    and lower(coalesce(pg_get_viewdef(c.oid, true), '')) like '%transport_bookings%'
    and lower(coalesce(pg_get_viewdef(c.oid, true), '')) like '%return_total_price%'
    and lower(coalesce(pg_get_viewdef(c.oid, true), '')) like '%total_price%'
),
other_matches as (
  select
    count(*) > 0 as found,
    coalesce(string_agg(source_type || ':' || source_name, ' | ' order by source_type, source_name), '') as details
  from other_sources
  where source ~ 'total_price.{0,220}\+.{0,220}return_total_price'
     or source ~ 'return_total_price.{0,220}\+.{0,220}total_price'
),
checks as (
  select
    'deposit_status_rpc_exists' as check_name,
    exists (select 1 from deposit_status_overloads) as pass,
    coalesce((
      select string_agg(proname || '(' || identity_args || ')', ' | ' order by identity_args)
      from deposit_status_overloads
    ), 'no overloads found') as details

  union all
  select
    'deposit_status_exact_overload_selected',
    exists (select 1 from target),
    coalesce((select proname || '(' || identity_args || ') returns ' || result_type from target), 'public.get_service_deposit_status(p_id uuid) not found')

  union all
  select
    'deployed_source_loaded',
    coalesce((select length(source) > 0 from target), false),
    coalesce((select left(source, 800) from target), 'no source')

  union all
  select
    'total_price_used',
    coalesce((select source like '%total_price%' from target), false),
    coalesce((select 'contains total_price=' || (source like '%total_price%')::text from target), 'no source')

  union all
  select
    'return_total_price_used',
    coalesce((select source like '%return_total_price%' from target), false),
    coalesce((select 'contains return_total_price=' || (source like '%return_total_price%')::text from target), 'no source')

  union all
  select
    'total_plus_return_pattern_found',
    coalesce((
      select
        source ~ 'total_price.{0,220}\+.{0,220}return_total_price'
        or source ~ 'return_total_price.{0,220}\+.{0,220}total_price'
      from target
    ), false),
    coalesce((
      select case
        when source ~ 'total_price.{0,220}\+.{0,220}return_total_price'
          then substring(source from 'total_price.{0,220}\+.{0,220}return_total_price')
        when source ~ 'return_total_price.{0,220}\+.{0,220}total_price'
          then substring(source from 'return_total_price.{0,220}\+.{0,220}total_price')
        else 'no total-plus-return pattern found'
      end
      from target
    ), 'no source')

  union all
  select
    'round_trip_double_count_confirmed',
    coalesce((
      select
        source like '%transport%'
        and source like '%return_total_price%'
        and (
          source ~ 'total_price.{0,220}\+.{0,220}return_total_price'
          or source ~ 'return_total_price.{0,220}\+.{0,220}total_price'
        )
      from target
    ), false),
    coalesce((
      select case
        when source like '%transport%'
          and source like '%return_total_price%'
          and (
            source ~ 'total_price.{0,220}\+.{0,220}return_total_price'
            or source ~ 'return_total_price.{0,220}\+.{0,220}total_price'
          )
          then 'get_service_deposit_status adds return_total_price to total_price for transport. Since booking creation stores total_price as full combined quote, this is a double-count risk.'
        else 'not confirmed by deployed source'
      end
      from target
    ), 'no source')

  union all
  select
    'other_round_trip_double_count_sources',
    not found,
    case
      when found then details
      else 'no other deployed public functions/views matched total_price + return_total_price'
    end
  from other_matches

  union all
  select
    'diagnostics_read_only',
    true,
    'This file reads pg_proc, pg_class, pg_namespace and pg_get_viewdef only; it does not execute get_service_deposit_status or modify data.'
)
select check_name, pass, details
from checks
order by
  case when pass is false or pass is null then 0 else 1 end,
  check_name;
