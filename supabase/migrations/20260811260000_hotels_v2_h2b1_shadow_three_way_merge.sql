begin;
set transaction isolation level repeatable read;

-- H2B.1 reviewed structural merge repair.  The browser may now carry the
-- exact Room Type snapshot that the Admin originally reviewed.  The locked
-- server row is writable only field-by-field when CURRENT still equals either
-- ORIGINAL or TARGET.  Exact versions, deterministic IDs, relationships,
-- pricing graph checks and the single-transaction save remain unchanged.
lock table public.site_settings in share mode;

create temporary table hotels_v2_h2b1_three_way_snapshot(
  relation_name text primary key,
  row_count bigint not null,
  fingerprint text not null
) on commit drop;

insert into hotels_v2_h2b1_three_way_snapshot
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

do $h2b1_three_way_install$
declare
  v_definition text;
  v_original_definition text;
  v_old text;
  v_new text;
begin
  if to_regprocedure('public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)') is null
     or to_regprocedure('public.hotel_v2_admin_get_property_workspace(uuid)') is null
     or to_regclass('public.hotel_room_types') is null
     or to_regclass('public.hotel_activity_log') is null then
    raise exception using errcode='55000',message='hotels_v2_h2b1_three_way_prerequisite_missing';
  end if;
  if exists(select 1 from public.site_settings where id=1 and (
    hotel_rooms_v2_enabled or hotel_external_sync_enabled
    or hotel_instant_booking_enabled or hotel_stripe_connect_enabled
  )) then
    raise exception using errcode='55000',message='hotels_v2_h2b1_three_way_capability_enabled';
  end if;

  select pg_get_functiondef(
    'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure
  ) into v_definition;
  v_original_definition:=v_definition;

  -- Safe manual reapplication: an already installed exact contract is a no-op.
  if v_definition like '%hotels_v2_h2b1_shadow_room_three_way_conflict%'
     and v_definition like '%expected_original%'
     and v_definition like '%hotels_v2_h2b1_three_way_identity_v1%'
     and v_definition like '%legacy_source_key=excluded.legacy_source_key%' then
    return;
  end if;

  if v_definition not like '%hotels_v2_h2b1_stale_shadow_room%'
     or v_definition not like '%expected_property_policy%'
     or v_definition not like '%perform public.hotel_v2_h2a_require_admin()%'
     or v_definition not like '%hotels_v2_h2b1_shadow_tier_value_mismatch%' then
    raise exception using errcode='55000',message='hotels_v2_h2b1_three_way_function_drift';
  end if;

  v_old:='v_expected_policy jsonb; v_expected_policy_value text; v_expected_minimum_age integer;';
  v_new:='v_expected_policy jsonb; v_expected_policy_value text; v_expected_minimum_age integer;
  v_expected_original jsonb; v_current_state jsonb; v_target_state jsonb; v_state_key text;';
  if strpos(v_definition,v_old)=0 then
    raise exception using errcode='55000',message='hotels_v2_h2b1_three_way_declaration_drift';
  end if;
  v_definition:=replace(v_definition,v_old,v_new);

  v_old:=$old$'id','expected_version','source_key','code','name_i18n','description_i18n','gallery','amenities','max_occupancy','sort_order'$old$;
  v_new:=$new$'id','expected_version','source_key','code','name_i18n','description_i18n','gallery','amenities','max_occupancy','sort_order','expected_original'$new$;
  if strpos(v_definition,v_old)=0 then
    raise exception using errcode='55000',message='hotels_v2_h2b1_three_way_allowed_keys_drift';
  end if;
  v_definition:=replace(v_definition,v_old,v_new);

  v_old:=$old$    end if;
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
    end if;$old$;
  v_new:=$new$    end if;

    v_expected_original:=null;
    if v_room_json ? 'expected_original'
       and jsonb_typeof(v_room_json->'expected_original')='object' then
      v_expected_original:=v_room_json->'expected_original';
      if jsonb_typeof(v_expected_original)<>'object'
         or not public.hotel_v2_h2a_keys_allowed(v_expected_original,array[
           'hotel_id','source_key','code','name_i18n','description_i18n','gallery','amenities',
           'max_occupancy','capacity_adults','capacity_children','inventory_mode','base_inventory_count','sort_order'
         ]) or not (v_expected_original ?& array[
           'hotel_id','source_key','code','name_i18n','description_i18n','gallery','amenities',
           'max_occupancy','capacity_adults','capacity_children','inventory_mode','base_inventory_count','sort_order'
         ])
         or coalesce(v_expected_original->>'hotel_id','') !~ '^[0-9a-fA-F-]{36}$'
         or (v_expected_original->>'hotel_id')::uuid<>c_hotel
         or jsonb_typeof(v_expected_original->'source_key') not in ('string','null')
         or (v_expected_original->>'source_key' is not null
           and v_expected_original->>'source_key'<>v_room_json->>'source_key')
         or jsonb_typeof(v_expected_original->'code')<>'string'
         or v_expected_original->>'code'<>v_room_json->>'code'
         or jsonb_typeof(v_expected_original->'name_i18n')<>'object'
         or jsonb_typeof(v_expected_original->'description_i18n')<>'object'
         or jsonb_typeof(v_expected_original->'gallery')<>'array'
         or jsonb_typeof(v_expected_original->'amenities')<>'array'
         or coalesce(v_expected_original->>'max_occupancy','') !~ '^[0-9]+$'
         or (v_expected_original->>'capacity_adults' is not null
           and v_expected_original->>'capacity_adults' !~ '^[0-9]+$')
         or (v_expected_original->>'capacity_children' is not null
           and v_expected_original->>'capacity_children' !~ '^[0-9]+$')
         or jsonb_typeof(v_expected_original->'inventory_mode')<>'string'
         or coalesce(v_expected_original->>'base_inventory_count','') !~ '^[0-9]+$'
         or coalesce(v_expected_original->>'sort_order','') !~ '^[0-9]+$'
         or exists(select 1 from jsonb_array_elements(v_expected_original->'gallery') item
           where jsonb_typeof(item.value)<>'string')
         or exists(select 1 from jsonb_array_elements(v_expected_original->'amenities') item
           where jsonb_typeof(item.value)<>'string') then
        raise exception using errcode='22023',message='hotels_v2_h2b1_invalid_expected_original';
      end if;
    elsif v_room_json ? 'expected_original'
       and jsonb_typeof(v_room_json->'expected_original')<>'null' then
      raise exception using errcode='22023',message='hotels_v2_h2b1_invalid_expected_original';
    end if;

    select * into v_room from public.hotel_room_types where id=(v_room_json->>'id')::uuid for update;
    v_existing_version:=case when (v_room_json->>'id')::uuid=c_upper then (v_expected->>'upper_room')::bigint else (v_expected->>'ground_room')::bigint end;
    if (v_room_json->>'expected_version')::bigint<>v_existing_version then
      raise exception using errcode='PT409',message='hotels_v2_h2b1_room_expected_version_mismatch';
    end if;
    if found then
      -- hotels_v2_h2b1_three_way_identity_v1: identity is never mergeable.
      if v_room.hotel_id<>c_hotel
         or v_room.code<>v_room_json->>'code'
         or (v_room.legacy_source_key is not null
           and v_room.legacy_source_key<>v_room_json->>'source_key')
         or v_room.version<>v_existing_version then
        raise exception using errcode='PT409',message='hotels_v2_h2b1_stale_shadow_room';
      end if;

      v_current_state:=jsonb_build_object(
        'hotel_id',v_room.hotel_id,'source_key',v_room.legacy_source_key,'code',v_room.code,
        'name_i18n',v_room.name_i18n,'description_i18n',v_room.description_i18n,
        'gallery',v_room.gallery,
        'amenities',to_jsonb(array(select amenity from unnest(v_room.amenities) amenity order by amenity)),
        'max_occupancy',v_room.max_occupancy,'capacity_adults',v_room.capacity_adults,
        'capacity_children',v_room.capacity_children,'inventory_mode',v_room.inventory_mode,
        'base_inventory_count',v_room.base_inventory_count,'sort_order',v_room.sort_order
      );
      v_target_state:=jsonb_build_object(
        'hotel_id',c_hotel,'source_key',v_room_json->>'source_key','code',v_room_json->>'code',
        'name_i18n',v_room_json->'name_i18n',
        'description_i18n',coalesce(v_room_json->'description_i18n','{}'::jsonb),
        'gallery',v_room_json->'gallery',
        'amenities',to_jsonb(array(select value#>>'{}' from jsonb_array_elements(v_room_json->'amenities') order by value#>>'{}')),
        'max_occupancy',4,'capacity_adults',null,'capacity_children',null,
        'inventory_mode','pooled','base_inventory_count',1,
        'sort_order',coalesce((v_room_json->>'sort_order')::integer,1000)
      );

      if v_expected_original is null then
        -- Deployment-order compatibility for the old browser: it may save only
        -- when the locked structural contract already equals TARGET.
        if v_room.legacy_source_key<>v_room_json->>'source_key'
           or v_room.code<>v_room_json->>'code'
           or v_room.max_occupancy<>4 or v_room.capacity_adults is not null or v_room.capacity_children is not null
           or v_room.inventory_mode<>'pooled' or v_room.base_inventory_count<>1
           or cardinality(v_room.amenities)<>jsonb_array_length(v_room_json->'amenities')
           or not (v_room.amenities @> array(select value#>>'{}' from jsonb_array_elements(v_room_json->'amenities'))) then
          raise exception using errcode='PT409',message='hotels_v2_h2b1_stale_shadow_room';
        end if;
      else
        v_expected_original:=jsonb_build_object(
          'hotel_id',(v_expected_original->>'hotel_id')::uuid,
          'source_key',v_expected_original->>'source_key','code',v_expected_original->>'code',
          'name_i18n',v_expected_original->'name_i18n',
          'description_i18n',v_expected_original->'description_i18n',
          'gallery',v_expected_original->'gallery',
          'amenities',to_jsonb(array(select value#>>'{}' from jsonb_array_elements(v_expected_original->'amenities') order by value#>>'{}')),
          'max_occupancy',(v_expected_original->>'max_occupancy')::integer,
          'capacity_adults',(v_expected_original->>'capacity_adults')::integer,
          'capacity_children',(v_expected_original->>'capacity_children')::integer,
          'inventory_mode',v_expected_original->>'inventory_mode',
          'base_inventory_count',(v_expected_original->>'base_inventory_count')::integer,
          'sort_order',(v_expected_original->>'sort_order')::integer
        );
        foreach v_state_key in array array[
          'name_i18n','description_i18n','gallery','amenities',
          'max_occupancy','capacity_adults','capacity_children','inventory_mode','base_inventory_count','sort_order'
        ] loop
          if v_current_state->v_state_key is distinct from v_expected_original->v_state_key
             and v_current_state->v_state_key is distinct from v_target_state->v_state_key then
            raise exception using errcode='PT409',
              message='hotels_v2_h2b1_shadow_room_three_way_conflict',
              detail=jsonb_build_object(
                'room_id',v_room.id,'field',v_state_key,
                'original',v_expected_original->v_state_key,
                'current',v_current_state->v_state_key,
                'target',v_target_state->v_state_key
              )::text;
          end if;
        end loop;
      end if;
    elsif v_expected_original is not null or v_existing_version<>0
       or exists(select 1 from public.hotel_room_types where hotel_id=c_hotel and legacy_source_key=v_room_json->>'source_key') then
      raise exception using errcode='PT409',message='hotels_v2_h2b1_shadow_room_identity_conflict';
    end if;$new$;
  if strpos(v_definition,v_old)=0 then
    raise exception using errcode='55000',message='hotels_v2_h2b1_three_way_validation_block_drift';
  end if;
  v_definition:=replace(v_definition,v_old,v_new);

  v_old:=$old$amenities=excluded.amenities,inventory_mode='pooled',base_inventory_count=1,sort_order=excluded.sort_order$old$;
  v_new:=$new$amenities=excluded.amenities,inventory_mode='pooled',base_inventory_count=1,sort_order=excluded.sort_order,
      legacy_source_key=excluded.legacy_source_key$new$;
  if strpos(v_definition,v_old)=0 then
    raise exception using errcode='55000',message='hotels_v2_h2b1_three_way_upsert_drift';
  end if;
  v_definition:=replace(v_definition,v_old,v_new);

  if v_definition=v_original_definition
     or v_definition not like '%hotels_v2_h2b1_shadow_room_three_way_conflict%'
     or v_definition not like '%expected_original%'
     or v_definition not like '%hotels_v2_h2b1_three_way_identity_v1%'
     or v_definition not like '%legacy_source_key=excluded.legacy_source_key%' then
    raise exception using errcode='55000',message='hotels_v2_h2b1_three_way_rewrite_failed';
  end if;
  execute v_definition;
end
$h2b1_three_way_install$;

comment on function public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid) is
  'Admin-only exact 7 Arches shadow preparation. Per reviewed field, locked CURRENT must equal ORIGINAL or TARGET; exact versions, identities, inert pricing and one atomic transaction remain mandatory.';
revoke all on function public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid) to authenticated;

do $h2b1_three_way_postconditions$
declare
  v_snapshot hotels_v2_h2b1_three_way_snapshot%rowtype;
  v_count bigint;
  v_fingerprint text;
  v_definition text;
begin
  for v_snapshot in select * from hotels_v2_h2b1_three_way_snapshot loop
    execute format(
      'select count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,''|'' order by row_value.id),'''')) from public.%I row_value',
      v_snapshot.relation_name
    ) into v_count,v_fingerprint;
    if v_count<>v_snapshot.row_count or v_fingerprint is distinct from v_snapshot.fingerprint then
      raise exception using errcode='55000',message='hotels_v2_h2b1_three_way_migration_changed_data';
    end if;
  end loop;

  select pg_get_functiondef(
    'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure
  ) into v_definition;
  if v_definition not like '%expected_original%'
     or v_definition not like '%hotels_v2_h2b1_shadow_room_three_way_conflict%'
     or v_definition not like '%hotels_v2_h2b1_three_way_identity_v1%'
     or v_definition not like '%legacy_source_key=excluded.legacy_source_key%'
     or v_definition not like '%perform public.hotel_v2_h2a_require_admin()%'
     or not (select prosecdef from pg_proc
       where oid='public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure)
     or not coalesce((select proconfig @> array['search_path=pg_catalog, public, auth']
       from pg_proc where oid='public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure),false)
     or has_function_privilege('anon','public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)','EXECUTE')
     or has_function_privilege('service_role','public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)','EXECUTE') then
    raise exception using errcode='55000',message='hotels_v2_h2b1_three_way_postcondition_failed';
  end if;
end
$h2b1_three_way_postconditions$;

commit;
