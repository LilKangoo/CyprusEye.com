begin;
set transaction isolation level repeatable read;

-- The 7 Arches shadow preparation owns rooms/photos and the inert pricing
-- graph links.  It must not require an already Admin-reviewed cancellation
-- policy to return to the original placeholder policy.  This repair changes
-- only the RPC predicate: the exact locked plan must still have the reviewed
-- version, deterministic identity, property, code and inactive state, while
-- its current cancellation policy must satisfy the existing DB validator.
lock table public.site_settings in share mode;

create temporary table hotels_v2_h2b1_rate_plan_repair_snapshot(
  relation_name text primary key,
  row_count bigint not null,
  fingerprint text not null
) on commit drop;

insert into hotels_v2_h2b1_rate_plan_repair_snapshot
select 'hotels',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotels row_value
union all select 'hotel_room_types',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_room_types row_value
union all select 'hotel_rate_plans',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_rate_plans row_value
union all select 'hotel_room_rates',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_room_rates row_value
union all select 'hotel_pricing_schedules',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_pricing_schedules row_value
union all select 'hotel_pricing_schedule_occupancy_tiers',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_pricing_schedule_occupancy_tiers row_value
union all select 'hotel_activity_log',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_activity_log row_value
union all select 'hotel_bookings',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_bookings row_value
union all select 'partner_service_fulfillments',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.partner_service_fulfillments row_value
union all select 'site_settings',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.site_settings row_value;

do $h2b1_rate_plan_repair_install$
declare
  c_hotel constant uuid := '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_plan constant uuid := '22e47a63-a630-4fb6-8f43-816f2d3fdc17';
  v_definition text;
  v_original_definition text;
  v_old text;
  v_new text;
begin
  if to_regprocedure('public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)') is null
     or to_regprocedure('public.hotel_v2_h2a_cancellation_policy_is_valid(jsonb)') is null
     or to_regclass('public.hotel_rate_plans') is null then
    raise exception using errcode='55000',message='hotels_v2_h2b1_rate_plan_repair_prerequisite_missing';
  end if;
  if exists(select 1 from public.site_settings where id=1 and (
    hotel_rooms_v2_enabled or hotel_external_sync_enabled
    or hotel_instant_booking_enabled or hotel_stripe_connect_enabled
  )) then
    raise exception using errcode='55000',message='hotels_v2_h2b1_rate_plan_repair_capability_enabled';
  end if;

  -- A present deterministic plan may be placeholder or already reviewed, but
  -- it must remain exact-property, Standard, inactive and structurally valid.
  if exists(
    select 1 from public.hotel_rate_plans rate_plan
    where rate_plan.id=c_plan and (
      rate_plan.hotel_id<>c_hotel
      or lower(btrim(rate_plan.code))<>'standard'
      or rate_plan.is_active
      or not public.hotel_v2_h2a_cancellation_policy_is_valid(rate_plan.cancellation_policy)
    )
  ) then
    raise exception using errcode='55000',message='hotels_v2_h2b1_rate_plan_repair_plan_contract_drift';
  end if;

  select pg_get_functiondef(
    'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure
  ) into v_definition;
  v_original_definition:=v_definition;

  -- Safe manual reapplication.
  if v_definition like '%hotels_v2_h2b1_preserve_reviewed_rate_plan_v1%'
     and v_definition like '%hotel_v2_h2a_cancellation_policy_is_valid%'
     and v_definition like '%hotels_v2_h2b1_shadow_room_three_way_conflict%' then
    return;
  end if;

  if v_definition not like '%hotels_v2_h2b1_shadow_room_three_way_conflict%'
     or v_definition not like '%hotels_v2_h2b1_stale_rate_plan%'
     or v_definition not like '%perform public.hotel_v2_h2a_require_admin()%'
     or v_definition not like '%expected_property_policy%' then
    raise exception using errcode='55000',message='hotels_v2_h2b1_rate_plan_repair_function_drift';
  end if;

  v_old:=$old$       or (select is_active from public.hotel_rate_plans where id=c_plan)
       or (select cancellation_policy->>'type' from public.hotel_rate_plans where id=c_plan)<>'requires_review'
       or (select cancellation_policy->>'reason' from public.hotel_rate_plans where id=c_plan)<>'legacy_cancellation_terms_unconfirmed' then$old$;
  v_new:=$new$       or (select is_active from public.hotel_rate_plans where id=c_plan)
       -- hotels_v2_h2b1_preserve_reviewed_rate_plan_v1: this workflow never
       -- rewrites a present plan; accept its exact-version reviewed policy.
       or not public.hotel_v2_h2a_cancellation_policy_is_valid(
         (select cancellation_policy from public.hotel_rate_plans where id=c_plan)
       ) then$new$;
  if strpos(v_definition,v_old)=0 then
    raise exception using errcode='55000',message='hotels_v2_h2b1_rate_plan_repair_predicate_drift';
  end if;
  v_definition:=replace(v_definition,v_old,v_new);

  if v_definition=v_original_definition
     or v_definition not like '%hotels_v2_h2b1_preserve_reviewed_rate_plan_v1%'
     or v_definition not like '%hotel_v2_h2a_cancellation_policy_is_valid%'
     or v_definition like '%cancellation_policy->>''type'' from public.hotel_rate_plans where id=c_plan)<>''requires_review''%'
     or v_definition not like '%hotels_v2_h2b1_shadow_room_three_way_conflict%' then
    raise exception using errcode='55000',message='hotels_v2_h2b1_rate_plan_repair_rewrite_failed';
  end if;
  execute v_definition;
end
$h2b1_rate_plan_repair_install$;

comment on function public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid) is
  'Admin-only exact 7 Arches shadow preparation. Exact reviewed versions/identities and field-level room merge remain mandatory; a present inactive valid Rate Plan is preserved, never reset by room/photo preparation.';
revoke all on function public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid) to authenticated;

do $h2b1_rate_plan_repair_postconditions$
declare
  v_snapshot hotels_v2_h2b1_rate_plan_repair_snapshot%rowtype;
  v_count bigint;
  v_fingerprint text;
  v_definition text;
begin
  for v_snapshot in select * from hotels_v2_h2b1_rate_plan_repair_snapshot loop
    execute format(
      'select count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,''|'' order by row_value.id),'''')) from public.%I row_value',
      v_snapshot.relation_name
    ) into v_count,v_fingerprint;
    if v_count<>v_snapshot.row_count or v_fingerprint is distinct from v_snapshot.fingerprint then
      raise exception using errcode='55000',message='hotels_v2_h2b1_rate_plan_repair_changed_data';
    end if;
  end loop;

  select pg_get_functiondef(
    'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure
  ) into v_definition;
  if v_definition not like '%hotels_v2_h2b1_preserve_reviewed_rate_plan_v1%'
     or v_definition not like '%hotel_v2_h2a_cancellation_policy_is_valid%'
     or v_definition not like '%hotels_v2_h2b1_shadow_room_three_way_conflict%'
     or v_definition not like '%perform public.hotel_v2_h2a_require_admin()%'
     or not (select prosecdef from pg_proc
       where oid='public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure)
     or not coalesce((select proconfig @> array['search_path=pg_catalog, public, auth']
       from pg_proc where oid='public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure),false)
     or has_function_privilege('anon','public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)','EXECUTE')
     or has_function_privilege('service_role','public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)','EXECUTE') then
    raise exception using errcode='55000',message='hotels_v2_h2b1_rate_plan_repair_postcondition_failed';
  end if;
end
$h2b1_rate_plan_repair_postconditions$;

commit;
