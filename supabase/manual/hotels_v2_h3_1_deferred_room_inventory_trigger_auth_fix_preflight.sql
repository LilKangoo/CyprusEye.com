-- READ-ONLY manual preflight for the H3.1 deferred Room inventory trigger
-- authorization repair. This file performs no writes.

with function_state as (
  select
    entry_proc.oid entry_oid,
    validator_proc.oid validator_oid,
    pg_get_userbyid(entry_proc.proowner) entry_owner,
    entry_proc.prokind entry_kind,
    entry_proc.prosecdef entry_security_definer,
    entry_proc.proconfig entry_config,
    entry_proc.proacl entry_acl,
    md5(entry_proc.prosrc) entry_body_hash,
    pg_get_userbyid(validator_proc.proowner) validator_owner,
    validator_proc.prokind validator_kind,
    validator_proc.prosecdef validator_security_definer,
    validator_proc.proconfig validator_config,
    validator_proc.proacl validator_acl,
    md5(validator_proc.prosrc) validator_body_hash
  from (select
    to_regprocedure('public.hotel_v2_h3_1_room_inventory_constraint_trigger()') entry_oid,
    to_regprocedure('public.hotel_v2_h3_1_validate_room_allocation_inventory(uuid)') validator_oid
  ) expected
  left join pg_proc entry_proc on entry_proc.oid=expected.entry_oid
  left join pg_proc validator_proc on validator_proc.oid=expected.validator_oid
), trigger_state as (
  select
    count(*) filter(where
      trigger_row.tgenabled='O' and trigger_row.tgdeferrable and trigger_row.tginitdeferred
      and (
        (relation.relname='hotel_room_types'
         and trigger_row.tgname='hotel_room_types_h3_1_allocation_inventory_guard'
         and pg_get_triggerdef(trigger_row.oid,true)=
           'CREATE CONSTRAINT TRIGGER hotel_room_types_h3_1_allocation_inventory_guard AFTER UPDATE OF status, inventory_mode, base_inventory_count ON hotel_room_types DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hotel_v2_h3_1_room_inventory_constraint_trigger()')
        or
        (relation.relname='hotel_units'
         and trigger_row.tgname='hotel_units_h3_1_allocation_inventory_guard'
         and pg_get_triggerdef(trigger_row.oid,true)=
           'CREATE CONSTRAINT TRIGGER hotel_units_h3_1_allocation_inventory_guard AFTER INSERT OR DELETE OR UPDATE ON hotel_units DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hotel_v2_h3_1_room_inventory_constraint_trigger()')
      )
    ) expected_binding_count,
    count(*) total_entrypoint_binding_count
  from pg_trigger trigger_row
  join pg_class relation on relation.oid=trigger_row.tgrelid
  join pg_namespace namespace on namespace.oid=relation.relnamespace
  where not trigger_row.tgisinternal
    and namespace.nspname='public'
    and trigger_row.tgfoid=to_regprocedure(
      'public.hotel_v2_h3_1_room_inventory_constraint_trigger()'
    )
), rpc_state as (
  select count(*) filter(where
      procedure_info.oid is not null
      and pg_get_userbyid(procedure_info.proowner)='postgres'
      and procedure_info.prokind='f'
      and procedure_info.prosecdef
      and procedure_info.proconfig is not distinct from
        array['search_path=pg_catalog, public, auth']::text[]
      and has_function_privilege('authenticated',procedure_info.oid,'EXECUTE')
      and not has_function_privilege('public',procedure_info.oid,'EXECUTE')
      and not has_function_privilege('anon',procedure_info.oid,'EXECUTE')
      and not has_function_privilege('service_role',procedure_info.oid,'EXECUTE')
      and strpos(pg_get_functiondef(procedure_info.oid),
        'perform public.hotel_v2_h2a_require_admin()')>0
    ) expected_rpc_count
  from (values
    (to_regprocedure('public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)')),
    (to_regprocedure('public.hotel_v2_admin_apply_room_type_plan(jsonb,uuid)')),
    (to_regprocedure('public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid)'))
  ) expected(oid)
  left join pg_proc procedure_info on procedure_info.oid=expected.oid
), capability_state as (
  select count(*)=1 and not bool_or(
    hotel_rooms_v2_enabled or hotel_external_sync_enabled
    or hotel_instant_booking_enabled or hotel_stripe_connect_enabled
  ) flags_off
  from public.site_settings where id=1
)
select
  current_timestamp checked_at,
  function_state.entry_owner,
  function_state.entry_kind,
  function_state.entry_security_definer,
  function_state.entry_config,
  function_state.entry_acl,
  function_state.entry_body_hash,
  function_state.validator_owner,
  function_state.validator_kind,
  function_state.validator_security_definer,
  function_state.validator_config,
  function_state.validator_acl,
  function_state.validator_body_hash,
  trigger_state.expected_binding_count,
  trigger_state.total_entrypoint_binding_count,
  rpc_state.expected_rpc_count,
  capability_state.flags_off,
  coalesce(not function_state.entry_security_definer,false) repair_needed,
  coalesce((
    function_state.entry_owner='postgres'
    and function_state.entry_kind='f'
    and function_state.entry_config is not distinct from
      array['search_path=pg_catalog, public']::text[]
    and function_state.entry_body_hash='9bfaf350419720016ae405fd353bb4d7'
    and function_state.validator_owner='postgres'
    and function_state.validator_kind='f'
    and not function_state.validator_security_definer
    and function_state.validator_config is not distinct from
      array['search_path=pg_catalog, public']::text[]
    and function_state.validator_body_hash='6d72f588895a0f13a7e7d03332f6f132'
    and not has_function_privilege('public',function_state.validator_oid,'EXECUTE')
    and not has_function_privilege('anon',function_state.validator_oid,'EXECUTE')
    and not has_function_privilege('authenticated',function_state.validator_oid,'EXECUTE')
    and not has_function_privilege('service_role',function_state.validator_oid,'EXECUTE')
    and not has_function_privilege('authenticator',function_state.validator_oid,'EXECUTE')
    and trigger_state.expected_binding_count=2
    and trigger_state.total_entrypoint_binding_count=2
    and rpc_state.expected_rpc_count=3
    and capability_state.flags_off
  ),false) hotels_v2_h3_1_deferred_trigger_auth_preflight_safe
from function_state cross join trigger_state cross join rpc_state cross join capability_state;
