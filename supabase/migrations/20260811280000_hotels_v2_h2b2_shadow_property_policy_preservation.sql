begin;
set transaction isolation level repeatable read;

-- H2B.2 separates the reviewed property child policy from the completed
-- legacy room/photo preparation.  The shadow RPC may require an exact fresh
-- policy snapshot, but it must never choose, rewrite or log a policy value.
lock table public.site_settings in share mode;

create temporary table hotels_v2_h2b2_policy_preservation_snapshot(
  relation_name text primary key,
  row_count bigint not null,
  fingerprint text not null
) on commit drop;

insert into hotels_v2_h2b2_policy_preservation_snapshot
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

do $h2b2_policy_preservation_install$
declare
  v_definition text;
  v_original_definition text;
  v_old text;
  v_new text;
begin
  if to_regprocedure('public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)') is null
     or to_regprocedure('public.hotel_v2_h2b1_children_policy_valid(text,integer,boolean)') is null
     or to_regclass('public.hotel_activity_log') is null then
    raise exception using errcode='55000',message='hotels_v2_h2b2_policy_preservation_prerequisite_missing';
  end if;
  if (select count(*) from public.site_settings where id=1
      and not hotel_rooms_v2_enabled and not hotel_external_sync_enabled
      and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled)<>1 then
    raise exception using errcode='55000',message='hotels_v2_h2b2_policy_preservation_capability_enabled';
  end if;

  select pg_get_functiondef(
    'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure
  ) into v_definition;
  v_original_definition:=v_definition;

  -- Safe manual reapplication after the exact repair is already installed.
  if v_definition like '%hotels_v2_h2b2_preserve_reviewed_property_policy_v1%'
     and v_definition like '%hotels_v2_h2b1_preserve_reviewed_rate_plan_v1%'
     and v_definition like '%hotels_v2_h2b1_shadow_room_three_way_conflict%'
     and v_definition not like '%update public.hotels set children_policy=''minimum_age'',minimum_child_age=10%' then
    return;
  end if;

  -- Fail closed unless the function is exactly on the deployed H2B.1 repair
  -- chain.  This prevents a textual rewrite of an unknown future body.
  if v_definition not like '%hotels_v2_h2b1_preserve_reviewed_rate_plan_v1%'
     or v_definition not like '%hotels_v2_h2b1_shadow_room_three_way_conflict%'
     or v_definition not like '%hotels_v2_h2b1_three_way_identity_v1%'
     or v_definition not like '%expected_property_policy%'
     or v_definition not like '%hotels_v2_h2b1_stale_property_policy%'
     or v_definition not like '%perform public.hotel_v2_h2a_require_admin()%'
     or v_definition not like '%legacy_source_key=excluded.legacy_source_key%' then
    raise exception using errcode='55000',message='hotels_v2_h2b2_policy_preservation_function_drift';
  end if;

  v_old:=$old$  if not public.hotel_v2_h2b1_children_policy_valid(
    p_plan->'property_policy'->>'children_policy',
    case when p_plan->'property_policy'->>'minimum_child_age' is null then null else (p_plan->'property_policy'->>'minimum_child_age')::integer end,false
  ) or p_plan->'property_policy'->>'children_policy'<>'minimum_age'
     or (p_plan->'property_policy'->>'minimum_child_age')::integer<>10 then
    raise exception using errcode='22023',message='hotels_v2_h2b1_seven_arches_child_policy_mismatch';
  end if;$old$;
  v_new:=$new$  -- hotels_v2_h2b2_preserve_reviewed_property_policy_v1: this
  -- workflow consumes the exact currently reviewed policy; it never chooses
  -- a different property policy as part of room/photo preparation.
  if jsonb_typeof(p_plan->'property_policy')<>'object'
     or not public.hotel_v2_h2a_keys_allowed(
       p_plan->'property_policy',array['children_policy','minimum_child_age']
     )
     or not (p_plan->'property_policy' ?& array['children_policy','minimum_child_age'])
     or (p_plan->'property_policy'->>'minimum_child_age' is not null
       and p_plan->'property_policy'->>'minimum_child_age' !~ '^[0-9]{1,2}$')
     or not public.hotel_v2_h2b1_children_policy_valid(
       p_plan->'property_policy'->>'children_policy',
       case when p_plan->'property_policy'->>'minimum_child_age' is null then null
         else (p_plan->'property_policy'->>'minimum_child_age')::integer end,false
     )
     or p_plan->'property_policy'->>'children_policy' is distinct from v_expected_policy_value
     or (case when p_plan->'property_policy'->>'minimum_child_age' is null then null
       else (p_plan->'property_policy'->>'minimum_child_age')::integer end)
         is distinct from v_expected_minimum_age then
    raise exception using errcode='22023',message='hotels_v2_h2b2_shadow_property_policy_mismatch';
  end if;$new$;
  if strpos(v_definition,v_old)=0 then
    raise exception using errcode='55000',message='hotels_v2_h2b2_policy_validation_predicate_drift';
  end if;
  v_definition:=replace(v_definition,v_old,v_new);

  v_old:=$old$  select to_jsonb(hotel) into v_before from public.hotels hotel where id=c_hotel;
  if v_hotel.children_policy is distinct from 'minimum_age'
     or v_hotel.minimum_child_age is distinct from 10 then
    update public.hotels set children_policy='minimum_age',minimum_child_age=10
    where id=c_hotel
      and updated_at=v_hotel.updated_at
      and children_policy is not distinct from v_expected_policy_value
      and minimum_child_age is not distinct from v_expected_minimum_age
    returning to_jsonb(hotels.*) into v_after;
    if v_after is null then
      raise exception using errcode='PT409',message='hotels_v2_h2b1_stale_property_policy';
    end if;
    insert into public.hotel_activity_log(hotel_id,entity_type,entity_id,action,before_state,after_state,actor_type,actor_id,source,correlation_id)
    values(c_hotel,'property',c_hotel,'update',v_before,v_after,'admin',auth.uid(),'hotels_v2_h2b1_shadow_prepare',p_correlation_id);
  end if;$old$;
  v_new:=$new$  -- Recheck the locked policy immediately before the first write.  The row
  -- remains locked from the original fresh read, and no property mutation or
  -- property activity belongs to this shadow preparation.
  if v_hotel.children_policy is distinct from v_expected_policy_value
     or v_hotel.minimum_child_age is distinct from v_expected_minimum_age then
    raise exception using errcode='PT409',message='hotels_v2_h2b1_stale_property_policy';
  end if;$new$;
  if strpos(v_definition,v_old)=0 then
    raise exception using errcode='55000',message='hotels_v2_h2b2_policy_mutation_block_drift';
  end if;
  v_definition:=replace(v_definition,v_old,v_new);

  if v_definition=v_original_definition
     or v_definition not like '%hotels_v2_h2b2_preserve_reviewed_property_policy_v1%'
     or v_definition not like '%hotels_v2_h2b2_shadow_property_policy_mismatch%'
     or v_definition not like '%hotels_v2_h2b1_preserve_reviewed_rate_plan_v1%'
     or v_definition not like '%hotels_v2_h2b1_shadow_room_three_way_conflict%'
     or v_definition like '%update public.hotels set children_policy=''minimum_age'',minimum_child_age=10%'
     or v_definition like '%p_plan->''property_policy''->>''children_policy''<>''minimum_age''%'
     or v_definition like '%p_plan->''property_policy''->>''minimum_child_age'')::integer<>10%' then
    raise exception using errcode='55000',message='hotels_v2_h2b2_policy_preservation_rewrite_failed';
  end if;
  execute v_definition;
end
$h2b2_policy_preservation_install$;

comment on function public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid) is
  'Admin-only exact 7 Arches room/photo preparation. Exact reviewed policy and entity snapshots remain mandatory; the current property child policy and reviewed inactive Rate Plan are preserved and never rewritten by this workflow.';
revoke all on function public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid) to authenticated;

do $h2b2_policy_preservation_postconditions$
declare
  v_snapshot hotels_v2_h2b2_policy_preservation_snapshot%rowtype;
  v_count bigint;
  v_fingerprint text;
  v_definition text;
begin
  for v_snapshot in select * from hotels_v2_h2b2_policy_preservation_snapshot loop
    execute format(
      'select count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,''|'' order by row_value.id),'''')) from public.%I row_value',
      v_snapshot.relation_name
    ) into v_count,v_fingerprint;
    if v_count<>v_snapshot.row_count or v_fingerprint is distinct from v_snapshot.fingerprint then
      raise exception using errcode='55000',message='hotels_v2_h2b2_policy_preservation_changed_data';
    end if;
  end loop;

  select pg_get_functiondef(
    'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure
  ) into v_definition;
  if v_definition not like '%hotels_v2_h2b2_preserve_reviewed_property_policy_v1%'
     or v_definition not like '%hotels_v2_h2b2_shadow_property_policy_mismatch%'
     or v_definition not like '%hotels_v2_h2b1_preserve_reviewed_rate_plan_v1%'
     or v_definition not like '%hotels_v2_h2b1_shadow_room_three_way_conflict%'
     or v_definition like '%update public.hotels set children_policy=''minimum_age'',minimum_child_age=10%'
     or not (select prosecdef from pg_proc
       where oid='public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure)
     or not coalesce((select proconfig @> array['search_path=pg_catalog, public, auth']
       from pg_proc where oid='public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure),false)
     or has_function_privilege('anon','public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)','EXECUTE')
     or has_function_privilege('service_role','public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)','EXECUTE') then
    raise exception using errcode='55000',message='hotels_v2_h2b2_policy_preservation_postcondition_failed';
  end if;
end
$h2b2_policy_preservation_postconditions$;

commit;
