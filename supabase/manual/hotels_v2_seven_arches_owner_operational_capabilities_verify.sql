-- Standalone read-only verifier for migration 143.6.
-- Supabase SQL Editor compatible.
begin;
set transaction read only;
set local statement_timeout='90s';

do $verify$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_system_actor constant uuid:='00000000-0000-0000-0000-000000000000';
  v_snapshot jsonb;
  v_original public.hotel_admin_availability_foundation_receipts%rowtype;
  v_evolution public.hotel_admin_availability_foundation_evolution_receipts%rowtype;
  v_external boolean;
  v_current_owner_user_ids uuid[];
  v_current_foreign_permissions_fingerprint text;
begin
  if to_regclass('public.hotel_admin_availability_foundation_evolution_receipts') is null
     or to_regclass('public.hotel_partner_workspace_foundation_receipts') is null
     or to_regclass('hotels_v2_private.hotel_external_calendar_foundation_receipts') is null
     or to_regclass('hotels_v2_private.hotel_external_calendar_activation_receipts') is null
     or to_regprocedure('public.hotel_v2_seven_arches_owner_capabilities()') is null
     or to_regprocedure('public.hotel_v2_admin_d_current_foundation_snapshot()') is null
     or to_regprocedure('public.hotel_v2_admin_d_protected_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_admin_d_immutable_row()') is null
     or to_regprocedure('public.hotel_v2_h3_2b_hash(jsonb)') is null
     or to_regprocedure('public.hotel_v2_external_calendar_worker_hash(jsonb)') is null
     or to_regprocedure('public.hotel_v2_external_calendar_protected_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_external_calendar_activation_function_fingerprints()') is null then
    raise exception 'HOTELS_V2_SEVEN_ARCHES_OWNER_VERIFY_FAIL: object missing';
  end if;

  if (select count(*) from public.hotel_admin_availability_foundation_receipts)<>1
     or not exists(select 1 from public.hotel_admin_availability_foundation_receipts receipt
       where receipt.id=1 and receipt.protected_fingerprint=encode(extensions.digest(
         convert_to(receipt.protected_fingerprints::text,'UTF8'),'sha256'),'hex'))
     or (select count(*) from public.hotel_partner_workspace_foundation_receipts)<>1
     or not exists(select 1 from public.hotel_partner_workspace_foundation_receipts receipt
       where receipt.id=1 and receipt.protected_fingerprint=
         public.hotel_v2_h3_2b_hash(receipt.protected_fingerprints))
     or (select count(*) from hotels_v2_private.hotel_external_calendar_foundation_receipts)<>1
     or not exists(select 1 from hotels_v2_private.hotel_external_calendar_foundation_receipts receipt
       where receipt.id=1 and receipt.protected_fingerprint=
         public.hotel_v2_external_calendar_worker_hash(receipt.protected_fingerprints))
     or (select count(*) from hotels_v2_private.hotel_external_calendar_activation_receipts)<>1
     or not exists(select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
       where receipt.id=1
         and receipt.site_settings_without_external_fingerprint~'^[0-9a-f]{64}$'
         and jsonb_typeof(receipt.compatibility_function_fingerprints)='object') then
    raise exception 'HOTELS_V2_SEVEN_ARCHES_OWNER_VERIFY_FAIL: historical receipt integrity mismatch';
  end if;

  if (select count(*) from public.hotel_admin_availability_foundation_evolution_receipts)<>1 then
    raise exception 'HOTELS_V2_SEVEN_ARCHES_OWNER_VERIFY_FAIL: evolution receipt cardinality mismatch';
  end if;
  select * into strict v_original
  from public.hotel_admin_availability_foundation_receipts where id=1;
  select * into strict v_evolution
  from public.hotel_admin_availability_foundation_evolution_receipts where id=1;
  select array_agg(member.user_id order by member.user_id)
    into v_current_owner_user_ids
  from public.partner_users member
  where member.partner_id=v_evolution.partner_id and member.role='owner';
  select md5(coalesce(string_agg(to_jsonb(permission)::text,'|'
      order by permission.assignment_id),''))
    into v_current_foreign_permissions_fingerprint
  from public.hotel_partner_hotel_permissions permission
  where permission.hotel_id<>c_hotel;
  if v_evolution.contract_version<>'hotels_v2_admin_d_foundation_evolution_v2'
     or v_evolution.original_foundation_receipt_id<>1
     or v_evolution.original_protected_fingerprint<>v_original.protected_fingerprint
     or v_evolution.before_current_protected_fingerprint<>encode(extensions.digest(
       convert_to(v_evolution.before_current_protected_fingerprints::text,'UTF8'),'sha256'),'hex')
     or v_evolution.current_protected_fingerprint<>encode(extensions.digest(
       convert_to(v_evolution.current_protected_fingerprints::text,'UTF8'),'sha256'),'hex')
     or v_evolution.stage2_before_current_protected_fingerprint<>
       public.hotel_v2_external_calendar_worker_hash(
         v_evolution.stage2_before_current_protected_fingerprints)
     or v_evolution.stage2_current_protected_fingerprint<>
       public.hotel_v2_external_calendar_worker_hash(
         v_evolution.stage2_current_protected_fingerprints)
     or v_evolution.current_protected_fingerprints is distinct from
       public.hotel_v2_admin_d_protected_fingerprints()
     or v_evolution.stage2_current_protected_fingerprints is distinct from
       public.hotel_v2_external_calendar_protected_fingerprints()
     or v_evolution.allowed_fingerprint_keys is distinct from array[
       'hotel_partner_hotel_permissions','hotel_partner_action_receipts',
       'hotel_partner_event_outbox','non_admin_d_activity']::text[]
     or (v_evolution.current_protected_fingerprints-v_evolution.allowed_fingerprint_keys)
       is distinct from
       (v_evolution.before_current_protected_fingerprints-v_evolution.allowed_fingerprint_keys)
     or exists(select 1 from unnest(v_evolution.allowed_fingerprint_keys) changed(key_name)
       where v_evolution.before_current_protected_fingerprints->(changed.key_name) is null
          or v_evolution.current_protected_fingerprints->(changed.key_name) is null
          or v_evolution.before_current_protected_fingerprints->>(changed.key_name)
            is not distinct from
            v_evolution.current_protected_fingerprints->>(changed.key_name))
     or v_evolution.stage2_allowed_fingerprint_keys is distinct from array[
       'hotel_partner_hotel_permissions','non_external_calendar_activity',
       'non_external_calendar_partner_receipts']::text[]
     or (v_evolution.stage2_current_protected_fingerprints-
       v_evolution.stage2_allowed_fingerprint_keys) is distinct from
       (v_evolution.stage2_before_current_protected_fingerprints-
       v_evolution.stage2_allowed_fingerprint_keys)
     or exists(select 1 from unnest(v_evolution.stage2_allowed_fingerprint_keys) changed(key_name)
       where v_evolution.stage2_before_current_protected_fingerprints->(changed.key_name) is null
          or v_evolution.stage2_current_protected_fingerprints->(changed.key_name) is null
          or v_evolution.stage2_before_current_protected_fingerprints->>(changed.key_name)
            is not distinct from
            v_evolution.stage2_current_protected_fingerprints->>(changed.key_name))
     or v_evolution.before_foreign_permissions_fingerprint is distinct from
       v_evolution.current_foreign_permissions_fingerprint
     or v_evolution.current_foreign_permissions_fingerprint is distinct from
       v_current_foreign_permissions_fingerprint
     or coalesce(cardinality(v_evolution.owner_user_ids),0)<1
     or array_position(v_evolution.owner_user_ids,null) is not null
     or cardinality(v_evolution.owner_user_ids)<>(select count(distinct owner_id)
       from unnest(v_evolution.owner_user_ids) owner_id)
     or v_evolution.owner_user_ids is distinct from v_current_owner_user_ids
     or v_evolution.owner_membership_fingerprint<>encode(extensions.digest(convert_to(
       jsonb_build_object(
         'contract_version','hotels_v2_seven_arches_owner_membership_v1',
         'hotel_id',v_evolution.hotel_id,'partner_id',v_evolution.partner_id,
         'assignment_id',v_evolution.assignment_id,'role','owner',
         'owner_user_ids',to_jsonb(v_evolution.owner_user_ids)
       )::text,'UTF8'),'sha256'),'hex')
     or not exists(select 1 from public.hotel_partner_action_receipts receipt
       where receipt.id=v_evolution.action_receipt_id
         and receipt.actor_user_id=c_system_actor) then
    raise exception 'HOTELS_V2_SEVEN_ARCHES_OWNER_VERIFY_FAIL: current-baseline receipt mismatch';
  end if;

  v_snapshot:=public.hotel_v2_admin_d_current_foundation_snapshot();
  if not coalesce((v_snapshot->>'historical_receipts_intact')::boolean,false)
     or not coalesce((v_snapshot->>'frozen_contracts_exact')::boolean,false)
     or not coalesce((v_snapshot->>'supported_hotel_flags')::boolean,false)
     or not coalesce((v_snapshot->>'stage2f_function_compatibility_exact')::boolean,false)
     or not coalesce((v_snapshot->>'current_matches_latest')::boolean,false)
     or not coalesce((v_snapshot->>'stage2_current_matches_latest')::boolean,false)
     or not coalesce((v_snapshot->>'seven_arches_target_foundation_exact')::boolean,false)
     or not coalesce((v_snapshot->>'seven_arches_assignment_exact')::boolean,false)
     or not coalesce((v_snapshot->>'seven_arches_owner_membership_exact')::boolean,false)
     or (v_snapshot->>'seven_arches_owner_count')::integer<1
     or not coalesce((v_snapshot->>'seven_arches_owner_preset_exact')::boolean,false)
     or not coalesce((v_snapshot->>'foreign_hotel_permissions_unchanged')::boolean,false)
     or not coalesce((v_snapshot->>'audit_chain_exact')::boolean,false)
     or not coalesce((v_snapshot->>'safe')::boolean,false)
     or v_evolution.hotel_id<>c_hotel then
    raise exception 'HOTELS_V2_SEVEN_ARCHES_OWNER_VERIFY_FAIL: target/current snapshot mismatch: %',v_snapshot;
  end if;

  if not (select count(*)=1 and bool_and(id=1
      and hotel_rooms_v2_enabled is false
      and hotel_instant_booking_enabled is false
      and hotel_stripe_connect_enabled is false
      and hotel_external_sync_enabled is not null) from public.site_settings) then
    raise exception 'HOTELS_V2_SEVEN_ARCHES_OWNER_VERIFY_FAIL: unsupported Hotels feature flag state';
  end if;
  select hotel_external_sync_enabled into strict v_external
  from public.site_settings where id=1;
  if v_external and not exists(select 1
      from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
      where receipt.id=1 and receipt.compatibility_function_fingerprints
        is not distinct from public.hotel_v2_external_calendar_activation_function_fingerprints()) then
    raise exception 'HOTELS_V2_SEVEN_ARCHES_OWNER_VERIFY_FAIL: Stage2F function compatibility mismatch';
  end if;

  if not exists(select 1 from pg_class relation
      where relation.oid='public.hotel_admin_availability_foundation_evolution_receipts'::regclass
        and relation.relowner='postgres'::regrole and relation.relrowsecurity)
     or exists(select 1 from pg_policy policy
       where policy.polrelid='public.hotel_admin_availability_foundation_evolution_receipts'::regclass)
     or exists(select 1 from unnest(array[
       'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege(name)
       where has_table_privilege(0::oid,
         'public.hotel_admin_availability_foundation_evolution_receipts'::regclass,privilege.name)
          or has_table_privilege('anon',
         'public.hotel_admin_availability_foundation_evolution_receipts'::regclass,privilege.name)
          or has_table_privilege('authenticated',
         'public.hotel_admin_availability_foundation_evolution_receipts'::regclass,privilege.name)
          or has_table_privilege('service_role',
         'public.hotel_admin_availability_foundation_evolution_receipts'::regclass,privilege.name))
     or not exists(select 1 from pg_trigger trigger_row
       where trigger_row.tgrelid=
         'public.hotel_admin_availability_foundation_evolution_receipts'::regclass
         and trigger_row.tgname='hotel_admin_availability_foundation_evolution_immutable'
         and trigger_row.tgfoid='public.hotel_v2_admin_d_immutable_row()'::regprocedure
         and not trigger_row.tgisinternal and trigger_row.tgenabled='O'
         and trigger_row.tgtype=27) then
    raise exception 'HOTELS_V2_SEVEN_ARCHES_OWNER_VERIFY_FAIL: evolution receipt ACL/immutability mismatch';
  end if;

  if exists(select 1 from (values
      ('public.hotel_v2_seven_arches_owner_capabilities()',false,array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_admin_d_current_foundation_snapshot()',true,
        array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_external_calendar_worker_hash(jsonb)',true,
        array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_external_calendar_activation_function_fingerprints()',true,
        array['search_path=pg_catalog, public']::text[])
    ) expected(signature,secdef,path)
    left join pg_proc procedure_row on procedure_row.oid=to_regprocedure(expected.signature)
    where procedure_row.oid is null or procedure_row.proowner<>'postgres'::regrole
      or procedure_row.prosecdef is distinct from expected.secdef
      or procedure_row.proconfig is distinct from expected.path
      or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
      or has_function_privilege('service_role',procedure_row.oid,'EXECUTE')) then
    raise exception 'HOTELS_V2_SEVEN_ARCHES_OWNER_VERIFY_FAIL: helper metadata/ACL mismatch';
  end if;
end
$verify$;

with state as(
  select public.hotel_v2_admin_d_current_foundation_snapshot() value
), evolution as(
  select * from public.hotel_admin_availability_foundation_evolution_receipts where id=1
), current_owner_membership as(
  select array_agg(member.user_id order by member.user_id) owner_user_ids
  from public.partner_users member cross join evolution
  where member.partner_id=evolution.partner_id and member.role='owner'
), diagnostics as(
  select
    coalesce((state.value->>'historical_receipts_intact')::boolean,false)
      as original_receipts_intact,
    coalesce((state.value->>'frozen_contracts_exact')::boolean,false)
      as frozen_contracts_exact,
    evolution.before_current_protected_fingerprint=encode(extensions.digest(
      convert_to(evolution.before_current_protected_fingerprints::text,'UTF8'),'sha256'),'hex')
      and evolution.current_protected_fingerprint=encode(extensions.digest(
      convert_to(evolution.current_protected_fingerprints::text,'UTF8'),'sha256'),'hex')
      and evolution.stage2_before_current_protected_fingerprint=
        public.hotel_v2_external_calendar_worker_hash(
          evolution.stage2_before_current_protected_fingerprints)
      and evolution.stage2_current_protected_fingerprint=
        public.hotel_v2_external_calendar_worker_hash(
          evolution.stage2_current_protected_fingerprints)
      as evolution_receipt_hashes_exact,
    coalesce(cardinality(evolution.owner_user_ids),0)>=1
      and array_position(evolution.owner_user_ids,null) is null
      and evolution.owner_user_ids is not distinct from
        current_owner_membership.owner_user_ids
      and cardinality(evolution.owner_user_ids)=(select count(distinct owner_id)
        from unnest(evolution.owner_user_ids) owner_id)
      and evolution.owner_membership_fingerprint=encode(extensions.digest(convert_to(
        jsonb_build_object(
          'contract_version','hotels_v2_seven_arches_owner_membership_v1',
          'hotel_id',evolution.hotel_id,'partner_id',evolution.partner_id,
          'assignment_id',evolution.assignment_id,'role','owner',
          'owner_user_ids',to_jsonb(evolution.owner_user_ids)
        )::text,'UTF8'),'sha256'),'hex')
      and coalesce((state.value->>'seven_arches_owner_membership_exact')::boolean,false)
      and (state.value->>'seven_arches_owner_count')::integer=
        cardinality(evolution.owner_user_ids)
      as owner_membership_exact,
    evolution.allowed_fingerprint_keys=array[
      'hotel_partner_hotel_permissions','hotel_partner_action_receipts',
      'hotel_partner_event_outbox','non_admin_d_activity']::text[]
      and (evolution.current_protected_fingerprints-evolution.allowed_fingerprint_keys)
        is not distinct from
        (evolution.before_current_protected_fingerprints-evolution.allowed_fingerprint_keys)
      and evolution.stage2_allowed_fingerprint_keys=array[
        'hotel_partner_hotel_permissions','non_external_calendar_activity',
        'non_external_calendar_partner_receipts']::text[]
      and (evolution.stage2_current_protected_fingerprints-
          evolution.stage2_allowed_fingerprint_keys) is not distinct from
        (evolution.stage2_before_current_protected_fingerprints-
          evolution.stage2_allowed_fingerprint_keys)
      and evolution.before_foreign_permissions_fingerprint
        is not distinct from evolution.current_foreign_permissions_fingerprint
      as allowed_delta_exact,
    coalesce((state.value->>'current_matches_latest')::boolean,false)
      as current_baseline_exact,
    coalesce((state.value->>'stage2_current_matches_latest')::boolean,false)
      as stage2_current_baseline_exact,
    coalesce((state.value->>'seven_arches_target_foundation_exact')::boolean,false)
      as target_foundation_exact,
    coalesce((state.value->>'seven_arches_assignment_exact')::boolean,false)
      and coalesce((state.value->>'seven_arches_owner_preset_exact')::boolean,false)
      and coalesce((state.value->>'foreign_hotel_permissions_unchanged')::boolean,false)
      as owner_preset_exact,
    coalesce((state.value->>'audit_chain_exact')::boolean,false) as audit_chain_exact,
    (select count(*)=1 and bool_and(id=1 and hotel_rooms_v2_enabled is false
      and hotel_instant_booking_enabled is false and hotel_stripe_connect_enabled is false
      and hotel_external_sync_enabled is not null) from public.site_settings)
      as supported_hotels_flags,
    not exists(select 1 from public.site_settings setting where setting.id=1
      and setting.hotel_external_sync_enabled and not exists(select 1
        from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
        where receipt.id=1 and receipt.compatibility_function_fingerprints
          is not distinct from public.hotel_v2_external_calendar_activation_function_fingerprints()))
      as stage2f_function_compatibility
  from state cross join evolution cross join current_owner_membership
)
select 'hotels_v2_seven_arches_owner_operational_capabilities_verify_v2' contract_version,
  (not original_receipts_intact)::integer original_receipt_mismatch,
  (not frozen_contracts_exact)::integer frozen_contract_mismatch,
  (not evolution_receipt_hashes_exact)::integer evolution_receipt_hash_mismatch,
  (not owner_membership_exact)::integer owner_membership_mismatch,
  (not allowed_delta_exact)::integer allowed_delta_mismatch,
  (not current_baseline_exact)::integer current_baseline_mismatch,
  (not stage2_current_baseline_exact)::integer stage2_current_baseline_mismatch,
  (not target_foundation_exact)::integer target_foundation_mismatch,
  (not owner_preset_exact)::integer owner_preset_mismatch,
  (not audit_chain_exact)::integer audit_chain_mismatch,
  (not supported_hotels_flags)::integer supported_hotels_flags_mismatch,
  (not stage2f_function_compatibility)::integer stage2f_compatibility_mismatch,
  original_receipts_intact and frozen_contracts_exact and evolution_receipt_hashes_exact
    and owner_membership_exact
    and allowed_delta_exact and current_baseline_exact and target_foundation_exact
    and stage2_current_baseline_exact and owner_preset_exact and audit_chain_exact
    and supported_hotels_flags and stage2f_function_compatibility
    as hotels_v2_seven_arches_owner_operational_capabilities_safe,
  state.value as current_foundation
from state cross join diagnostics;
commit;
