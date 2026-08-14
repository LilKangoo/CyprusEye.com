begin;
set transaction isolation level repeatable read;
lock table public.site_settings in share row exclusive mode;

-- Hotels V2 H3.1 deferred Room inventory authorization repair.
--
-- H3.1 intentionally keeps every internal validator non-callable by API roles.
-- The Room Type / Unit inventory constraint is deferred until transaction
-- commit, however, so its trigger entrypoint can execute after an Admin
-- SECURITY DEFINER RPC has returned and the effective role is once again the
-- PostgREST caller.  Make only that trusted trigger entrypoint SECURITY
-- DEFINER.  Its nested validator remains SECURITY INVOKER and directly denied.

do $h3_1_trigger_auth_preconditions$
declare
  v_entry_oid oid := to_regprocedure(
    'public.hotel_v2_h3_1_room_inventory_constraint_trigger()'
  );
  v_validator_oid oid := to_regprocedure(
    'public.hotel_v2_h3_1_validate_room_allocation_inventory(uuid)'
  );
  v_definition text;
  v_trigger_count integer;
  v_total_trigger_count integer;
  v_rpc record;
begin
  if v_entry_oid is null or v_validator_oid is null then
    raise exception using errcode='55000',
      message='hotels_v2_h3_1_trigger_auth_prerequisite_missing';
  end if;

  select pg_get_functiondef(v_entry_oid) into v_definition;
  if (select pg_get_userbyid(proowner) from pg_proc where oid=v_entry_oid)<>'postgres'
     or (select prokind from pg_proc where oid=v_entry_oid)<>'f'
     or (select prorettype from pg_proc where oid=v_entry_oid)<>'trigger'::regtype
     or (select lanname from pg_proc join pg_language on pg_language.oid=pg_proc.prolang
         where pg_proc.oid=v_entry_oid)<>'plpgsql'
     or (select proconfig from pg_proc where oid=v_entry_oid)
          is distinct from array['search_path=pg_catalog, public']::text[]
     or (select md5(prosrc) from pg_proc where oid=v_entry_oid)
          <>'9bfaf350419720016ae405fd353bb4d7' then
    raise exception using errcode='55000',
      message='hotels_v2_h3_1_trigger_auth_entrypoint_contract_mismatch';
  end if;

  if (select pg_get_userbyid(proowner) from pg_proc where oid=v_validator_oid)<>'postgres'
     or (select prokind from pg_proc where oid=v_validator_oid)<>'f'
     or (select prosecdef from pg_proc where oid=v_validator_oid)
     or (select proconfig from pg_proc where oid=v_validator_oid)
          is distinct from array['search_path=pg_catalog, public']::text[]
     or (select md5(prosrc) from pg_proc where oid=v_validator_oid)
          <>'6d72f588895a0f13a7e7d03332f6f132'
     or has_function_privilege('public',v_validator_oid,'EXECUTE')
     or has_function_privilege('anon',v_validator_oid,'EXECUTE')
     or has_function_privilege('authenticated',v_validator_oid,'EXECUTE')
     or has_function_privilege('service_role',v_validator_oid,'EXECUTE')
     or has_function_privilege('authenticator',v_validator_oid,'EXECUTE') then
    raise exception using errcode='55000',
      message='hotels_v2_h3_1_trigger_auth_validator_contract_mismatch';
  end if;

  select
    count(*),
    count(*) filter(where
      trigger_row.tgenabled='O'
      and trigger_row.tgdeferrable
      and trigger_row.tginitdeferred
      and (
        (
          relation.relname='hotel_room_types'
          and trigger_row.tgname='hotel_room_types_h3_1_allocation_inventory_guard'
          and pg_get_triggerdef(trigger_row.oid,true)=
            'CREATE CONSTRAINT TRIGGER hotel_room_types_h3_1_allocation_inventory_guard AFTER UPDATE OF status, inventory_mode, base_inventory_count ON hotel_room_types DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hotel_v2_h3_1_room_inventory_constraint_trigger()'
        )
        or
        (
          relation.relname='hotel_units'
          and trigger_row.tgname='hotel_units_h3_1_allocation_inventory_guard'
          and pg_get_triggerdef(trigger_row.oid,true)=
            'CREATE CONSTRAINT TRIGGER hotel_units_h3_1_allocation_inventory_guard AFTER INSERT OR DELETE OR UPDATE ON hotel_units DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hotel_v2_h3_1_room_inventory_constraint_trigger()'
        )
      )
    )
  into v_total_trigger_count,v_trigger_count
  from pg_trigger trigger_row
  join pg_class relation on relation.oid=trigger_row.tgrelid
  join pg_namespace namespace on namespace.oid=relation.relnamespace
  where not trigger_row.tgisinternal
    and trigger_row.tgfoid=v_entry_oid
    and namespace.nspname='public';
  if v_total_trigger_count<>2 or v_trigger_count<>2 then
    raise exception using errcode='55000',
      message='hotels_v2_h3_1_trigger_auth_binding_mismatch';
  end if;

  for v_rpc in
    select expected.signature,to_regprocedure(expected.signature) oid
    from (values
      ('public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'),
      ('public.hotel_v2_admin_apply_room_type_plan(jsonb,uuid)'),
      ('public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid)')
    ) expected(signature)
  loop
    if v_rpc.oid is null
       or (select pg_get_userbyid(proowner) from pg_proc where oid=v_rpc.oid)<>'postgres'
       or not (select prosecdef from pg_proc where oid=v_rpc.oid)
       or (select proconfig from pg_proc where oid=v_rpc.oid)
            is distinct from array['search_path=pg_catalog, public, auth']::text[]
       or not has_function_privilege('authenticated',v_rpc.oid,'EXECUTE')
       or has_function_privilege('public',v_rpc.oid,'EXECUTE')
       or has_function_privilege('anon',v_rpc.oid,'EXECUTE')
       or has_function_privilege('service_role',v_rpc.oid,'EXECUTE')
       or strpos(pg_get_functiondef(v_rpc.oid),
            'perform public.hotel_v2_h2a_require_admin()')=0 then
      raise exception using errcode='55000',
        message='hotels_v2_h3_1_trigger_auth_admin_rpc_contract_mismatch',
        detail=v_rpc.signature;
    end if;
  end loop;

  if exists(select 1 from public.site_settings where id=1 and (
       hotel_rooms_v2_enabled or hotel_external_sync_enabled
       or hotel_instant_booking_enabled or hotel_stripe_connect_enabled
     )) then
    raise exception using errcode='55000',
      message='hotels_v2_h3_1_trigger_auth_capability_state_unsafe';
  end if;
end
$h3_1_trigger_auth_preconditions$;

create temporary table hotels_v2_h3_1_trigger_auth_snapshot(
  relation_name text primary key,
  row_count bigint not null,
  fingerprint text not null
) on commit drop;

insert into hotels_v2_h3_1_trigger_auth_snapshot
select 'hotels',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotels row_value
union all select 'hotel_room_types',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_room_types row_value
union all select 'hotel_units',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_units row_value
union all select 'hotel_bookings',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_bookings row_value
union all select 'partner_service_fulfillments',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.partner_service_fulfillments row_value
union all select 'hotel_activity_log',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_activity_log row_value
union all select 'hotel_room_allocation_rules',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_room_allocation_rules row_value
union all select 'hotel_room_allocation_rule_items',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_room_allocation_rule_items row_value
union all select 'hotel_payment_policies',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_payment_policies row_value
union all select 'hotel_payment_policy_terms',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_payment_policy_terms row_value
union all select 'hotel_commission_policies',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_commission_policies row_value
union all select 'hotel_calendar_source_configs',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.hotel_calendar_source_configs row_value
union all select 'site_settings',count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
  from public.site_settings row_value;

alter function public.hotel_v2_h3_1_room_inventory_constraint_trigger()
  owner to postgres;
alter function public.hotel_v2_h3_1_room_inventory_constraint_trigger()
  security definer;
alter function public.hotel_v2_h3_1_room_inventory_constraint_trigger()
  set search_path=pg_catalog,public;
revoke all on function public.hotel_v2_h3_1_room_inventory_constraint_trigger()
  from public,anon,authenticated,service_role,authenticator;

do $h3_1_trigger_auth_postconditions$
declare
  v_entry_oid oid := to_regprocedure(
    'public.hotel_v2_h3_1_room_inventory_constraint_trigger()'
  );
  v_validator_oid oid := to_regprocedure(
    'public.hotel_v2_h3_1_validate_room_allocation_inventory(uuid)'
  );
  v_snapshot record;
  v_count bigint;
  v_fingerprint text;
begin
  if v_entry_oid is null
     or (select pg_get_userbyid(proowner) from pg_proc where oid=v_entry_oid)<>'postgres'
     or not (select prosecdef from pg_proc where oid=v_entry_oid)
     or (select proconfig from pg_proc where oid=v_entry_oid)
          is distinct from array['search_path=pg_catalog, public']::text[]
     or (select md5(prosrc) from pg_proc where oid=v_entry_oid)
          <>'9bfaf350419720016ae405fd353bb4d7'
     or has_function_privilege('public',v_entry_oid,'EXECUTE')
     or has_function_privilege('anon',v_entry_oid,'EXECUTE')
     or has_function_privilege('authenticated',v_entry_oid,'EXECUTE')
     or has_function_privilege('service_role',v_entry_oid,'EXECUTE')
     or has_function_privilege('authenticator',v_entry_oid,'EXECUTE') then
    raise exception using errcode='55000',
      message='hotels_v2_h3_1_trigger_auth_repair_failed';
  end if;

  if v_validator_oid is null
     or (select prosecdef from pg_proc where oid=v_validator_oid)
     or (select proconfig from pg_proc where oid=v_validator_oid)
          is distinct from array['search_path=pg_catalog, public']::text[]
     or (select md5(prosrc) from pg_proc where oid=v_validator_oid)
          <>'6d72f588895a0f13a7e7d03332f6f132'
     or has_function_privilege('public',v_validator_oid,'EXECUTE')
     or has_function_privilege('anon',v_validator_oid,'EXECUTE')
     or has_function_privilege('authenticated',v_validator_oid,'EXECUTE')
     or has_function_privilege('service_role',v_validator_oid,'EXECUTE')
     or has_function_privilege('authenticator',v_validator_oid,'EXECUTE') then
    raise exception using errcode='55000',
      message='hotels_v2_h3_1_trigger_auth_validator_broadened';
  end if;

  for v_snapshot in select * from hotels_v2_h3_1_trigger_auth_snapshot loop
    execute format(
      'select count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,''|'' order by row_value.id),'''')) from public.%I row_value',
      v_snapshot.relation_name
    ) into v_count,v_fingerprint;
    if v_count<>v_snapshot.row_count or v_fingerprint<>v_snapshot.fingerprint then
      raise exception using errcode='55000',
        message='hotels_v2_h3_1_trigger_auth_data_changed',
        detail=v_snapshot.relation_name;
    end if;
  end loop;
end
$h3_1_trigger_auth_postconditions$;

commit;
