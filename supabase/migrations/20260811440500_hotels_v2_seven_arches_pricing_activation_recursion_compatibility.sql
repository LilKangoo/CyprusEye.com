begin;
set transaction isolation level repeatable read;
set local lock_timeout='15s';
set local statement_timeout='180s';

-- 114400 installs its reviewed activation workflow before any activation
-- receipt exists.  The later Task2 hardening made two validation paths form a
-- cycle only after the first receipt is inserted.  This additive seam is
-- deliberately pre-activation: an existing receipt is a boundary mismatch.
do $seven_arches_pricing_activation_recursion_dependencies$
declare
  v_admin_d_oid oid:=to_regprocedure(
    'public.hotel_v2_admin_d_current_foundation_snapshot()');
  v_receipt_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()');
  v_task2_validator_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()');
  v_projector_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()');
  v_apply_oid oid:=to_regprocedure(
    'public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text)');
  v_activation_immutable_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_pricing_activation_immutable()');
  v_activation_insert_guard_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_pricing_activation_evolution_insert_guard()');
  v_review_guard_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_pricing_activation_review_guard()');
  v_admin_d_source text;
  v_receipt_source text;
begin
  if v_admin_d_oid is null or v_receipt_oid is null
     or v_task2_validator_oid is null or v_projector_oid is null
     or v_apply_oid is null
     or v_activation_immutable_oid is null
     or v_activation_insert_guard_oid is null or v_review_guard_oid is null
     or to_regprocedure(
       'public.hotel_v2_h3_1p_pricing_promotion_snapshot_inert_core(uuid)') is null
     or to_regprocedure('public.hotel_v2_h3_1p_parity_snapshot(uuid)') is null
     or to_regprocedure(
       'public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()') is null
     or to_regprocedure(
       'public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()') is null
     or to_regprocedure(
       'public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()') is null
     or to_regprocedure(
       'public.hotel_v2_external_calendar_protected_fingerprints()') is null
     or to_regprocedure(
       'public.hotel_v2_external_calendar_provider_sources_are_attributable()') is null
     or to_regprocedure(
       'public.hotel_v2_partner_workspace_function_lineage_is_exact()') is null
     or to_regclass(
       'public.hotel_seven_arches_pricing_activation_evolution_receipts') is null
     or to_regclass(
       'public.hotel_admin_availability_foundation_evolution_receipts') is null
     or to_regclass(
       'public.hotel_partner_property_proposal_foundation_receipts') is null
     or to_regclass(
       'hotels_v2_private.hotel_external_calendar_foundation_receipts') is null
     or to_regclass(
       'hotels_v2_private.hotel_external_calendar_activation_receipts') is null
     or to_regclass(
       'public.hotel_seven_arches_task2_stage2_compatibility_receipts') is null
     or to_regprocedure(
       'public.hotel_v2_external_calendar_activation_function_fingerprints()') is null
     or to_regprocedure(
       'public.hotel_v2_h3_2a_reject_immutable_change()') is null then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_recursion_dependency_missing';
  end if;
  if (select count(*)
      from public.hotel_seven_arches_pricing_activation_evolution_receipts)<>0
     or to_regclass(
       'public.hotel_seven_arches_independent_pricing_evolution_receipts') is not null
     or to_regprocedure(
       'public.hotel_v2_external_calendar_site_settings_fingerprint()') is not null
     or to_regclass(
       'hotels_v2_private.hotel_external_calendar_provider_evolution_receipts') is not null then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_recursion_boundary_mismatch';
  end if;
  if (select proowner from pg_proc where oid=v_admin_d_oid)<>'postgres'::regrole
     or not (select prosecdef from pg_proc where oid=v_admin_d_oid)
     or (select provolatile from pg_proc where oid=v_admin_d_oid)<>'s'
     or (select proconfig from pg_proc where oid=v_admin_d_oid)
       is distinct from array['search_path=pg_catalog, public']::text[]
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_admin_d_oid)<>
         '686ef8d305ba401d52c2e2f5ed9f41036a6418beb785144da52a857c4640c32a'
     or (select proowner from pg_proc where oid=v_receipt_oid)<>'postgres'::regrole
     or not (select prosecdef from pg_proc where oid=v_receipt_oid)
     or (select provolatile from pg_proc where oid=v_receipt_oid)<>'s'
     or (select proconfig from pg_proc where oid=v_receipt_oid)
       is distinct from array['search_path=pg_catalog, public']::text[]
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_receipt_oid)<>
         'a794d528a3843009b65ba0927c508c8bf2b9f5ffdfce97f593ac81d6769526c6'
     or has_function_privilege(0::oid,v_admin_d_oid,'EXECUTE')
     or has_function_privilege('anon',v_admin_d_oid,'EXECUTE')
     or has_function_privilege('authenticated',v_admin_d_oid,'EXECUTE')
     or has_function_privilege('service_role',v_admin_d_oid,'EXECUTE')
     or has_function_privilege(0::oid,v_receipt_oid,'EXECUTE')
     or has_function_privilege('anon',v_receipt_oid,'EXECUTE')
     or has_function_privilege('authenticated',v_receipt_oid,'EXECUTE')
     or has_function_privilege('service_role',v_receipt_oid,'EXECUTE')
     or not exists(select 1 from pg_proc procedure_row
       where procedure_row.oid=v_task2_validator_oid
         and procedure_row.proowner='postgres'::regrole and procedure_row.prosecdef
         and procedure_row.provolatile='s'
         and procedure_row.proconfig=
           array['search_path=pg_catalog, public']::text[]
         and encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),
           'hex')='1a14ec7b271861cc5bfc9a683d26e3ef2f2d8a88a86771915a34f503d8a2ff88'
         and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
         and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
         and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
         and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
     or not exists(select 1 from pg_proc procedure_row
       where procedure_row.oid=v_projector_oid
         and procedure_row.proowner='postgres'::regrole and procedure_row.prosecdef
         and procedure_row.provolatile='s'
         and procedure_row.proconfig=
           array['search_path=pg_catalog, public']::text[]
         and encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),
           'hex')='c4860bf5c3eb4219a7fb19e386138fcae8b05292dd728d281c02c41eb9b7b8b9'
         and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
         and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
         and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
         and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
     or not exists(select 1 from pg_proc procedure_row
       where procedure_row.oid=v_apply_oid
         and procedure_row.proowner='postgres'::regrole and procedure_row.prosecdef
         and procedure_row.provolatile='v'
         and procedure_row.proconfig=
           array['search_path=pg_catalog, public, auth']::text[]
         and encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),
           'hex')='8c304f78fe93ca8a944443d668ccd82879374379d9520a69b160a2afde0d3407'
         and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
         and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
         and has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
         and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
     or exists(select 1 from (values
       (v_activation_immutable_oid,array['search_path=pg_catalog']::text[],
         '4b3e5ff853a0b8f2e21dd4d18359f8a92614f298d33e7cb9223e9b6aca31fc87'),
       (v_activation_insert_guard_oid,
         array['search_path=pg_catalog, public']::text[],
         '220afcdf846be8b91b554acb5054364126bc7adb1aa085d1bd86ac149985bdb7'),
       (v_review_guard_oid,array['search_path=pg_catalog, public, auth']::text[],
         '23ff92a30533948004130655e1e81b79386f1416afdd413c38816b0573220758')
     ) expected(oid,path,source_hash)
     left join pg_proc procedure_row on procedure_row.oid=expected.oid
     where procedure_row.oid is null
       or procedure_row.proowner<>'postgres'::regrole or not procedure_row.prosecdef
       or procedure_row.provolatile<>'v' or procedure_row.proconfig is distinct from expected.path
       or encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')
         is distinct from expected.source_hash
       or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
       or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
       or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
       or has_function_privilege('service_role',procedure_row.oid,'EXECUTE')) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_recursion_source_or_security_drift';
  end if;
  if (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
      from pg_proc where oid=to_regprocedure(
        'public.hotel_v2_h3_1p_pricing_promotion_snapshot_inert_core(uuid)'))<>
       '190b30e05c95e7220f800284b6408659f21172dba48161163e2a364c40aa95a5' then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_recursion_inert_core_drift';
  end if;
  if not exists(select 1 from pg_class relation where relation.oid=
       'public.hotel_seven_arches_pricing_activation_evolution_receipts'::regclass
       and relation.relowner='postgres'::regrole and relation.relrowsecurity)
     or exists(select 1 from pg_policy policy where policy.polrelid=
       'public.hotel_seven_arches_pricing_activation_evolution_receipts'::regclass)
     or (select count(*) from pg_trigger trigger_row where trigger_row.tgrelid=
       'public.hotel_seven_arches_pricing_activation_evolution_receipts'::regclass
       and not trigger_row.tgisinternal)<>2
     or not exists(select 1 from pg_trigger trigger_row where trigger_row.tgrelid=
       'public.hotel_seven_arches_pricing_activation_evolution_receipts'::regclass
       and trigger_row.tgname=
         'hotel_seven_arches_pricing_activation_evolution_immutable'
       and trigger_row.tgfoid=
         'public.hotel_v2_seven_arches_pricing_activation_immutable()'::regprocedure
       and trigger_row.tgtype=27 and trigger_row.tgenabled='O'
       and not trigger_row.tgisinternal)
     or not exists(select 1 from pg_trigger trigger_row where trigger_row.tgrelid=
       'public.hotel_seven_arches_pricing_activation_evolution_receipts'::regclass
       and trigger_row.tgname=
         'hotel_seven_arches_pricing_activation_evolution_insert_guard'
       and trigger_row.tgfoid=
         'public.hotel_v2_seven_arches_pricing_activation_evolution_insert_guard()'::regprocedure
       and trigger_row.tgtype=7 and trigger_row.tgenabled='O'
       and not trigger_row.tgisinternal)
     or exists(select 1 from unnest(array[
       'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
     ]) privilege(name) where has_table_privilege(0::oid,
         'public.hotel_seven_arches_pricing_activation_evolution_receipts'::regclass,
         privilege.name)
       or has_table_privilege('anon',
         'public.hotel_seven_arches_pricing_activation_evolution_receipts'::regclass,
         privilege.name)
       or has_table_privilege('authenticated',
         'public.hotel_seven_arches_pricing_activation_evolution_receipts'::regclass,
         privilege.name)
       or has_table_privilege('service_role',
         'public.hotel_seven_arches_pricing_activation_evolution_receipts'::regclass,
         privilege.name)) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_recursion_receipt_topology_drift';
  end if;
  if (select count(*)
      from hotels_v2_private.hotel_external_calendar_activation_receipts)<>1
     or not exists(select 1
       from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
       where receipt.id=1 and receipt.created_at is not null
         and isfinite(receipt.created_at)
         and receipt.site_settings_without_external_fingerprint~'^[0-9a-f]{64}$'
         and jsonb_typeof(receipt.compatibility_function_fingerprints)='object'
         and (select count(*)
           from jsonb_object_keys(receipt.compatibility_function_fingerprints))=20
         and receipt.compatibility_function_fingerprints ?& array[
           'public.hotel_v2_h3_2a_require_partner_hotel_access(uuid,uuid,text,boolean)',
           'public.hotel_v2_partner_list_assigned_properties(uuid)',
           'public.hotel_v2_admin_apply_partner_hotel_permissions(jsonb,uuid,uuid)',
           'public.hotel_v2_admin_create_property_draft(uuid,jsonb,uuid)',
           'public.hotel_v2_admin_apply_guest_policy_plan(jsonb,uuid)',
           'public.hotel_v2_admin_apply_room_control_plan(jsonb,uuid)',
           'public.hotel_v2_admin_get_content_control(uuid)',
           'public.hotel_v2_admin_apply_operational_assignment_plan(jsonb,uuid)',
           'public.hotel_v2_admin_apply_property_control_plan(jsonb,uuid)',
           'public.hotel_v2_admin_apply_pricing_control_plan(jsonb,uuid,text)',
           'public.hotel_v2_admin_apply_h3_1_configuration_h3_1p_core(jsonb,uuid)',
           'public.hotel_v2_h3_2b_flags_off()',
           'public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)',
           'public.hotel_v2_admin_create_property_draft_admin_b_core(uuid,jsonb,uuid)',
           'public.hotel_v2_admin_apply_guest_policy_plan_admin_b_core(jsonb,uuid)',
           'public.hotel_v2_admin_apply_workspace_plan_admin_b_core(jsonb,uuid)',
           'public.hotel_v2_admin_apply_calendar_plan_admin_c_core(jsonb,uuid)',
           'public.hotel_v2_admin_apply_workspace_plan_admin_c_core(jsonb,uuid)',
           'public.hotel_v2_admin_apply_h3_1_configuration_admin_c_core(jsonb,uuid)',
           'public.hotel_v2_admin_apply_legacy_pricing_promotion_admin_c_core(jsonb,uuid)'
         ]::text[]
         and not exists(select 1 from jsonb_each_text(
           receipt.compatibility_function_fingerprints) entry
           where (entry.value~'^[0-9a-f]{64}$') is distinct from true))
     or not exists(select 1 from pg_class relation where relation.oid=
       'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
       and relation.relowner='postgres'::regrole and not relation.relrowsecurity)
     or exists(select 1 from pg_policy policy where policy.polrelid=
       'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass)
     or (select count(*) from pg_trigger trigger_row where trigger_row.tgrelid=
       'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
       and not trigger_row.tgisinternal)<>1
     or not exists(select 1 from pg_trigger trigger_row where trigger_row.tgrelid=
       'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
       and trigger_row.tgname='hotel_external_calendar_activation_receipt_immutable'
       and trigger_row.tgfoid=
         'public.hotel_v2_h3_2a_reject_immutable_change()'::regprocedure
       and trigger_row.tgtype=27 and trigger_row.tgenabled='O'
       and not trigger_row.tgisinternal)
     or exists(select 1 from unnest(array[
       'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
     ]) privilege(name) where has_table_privilege(0::oid,
         'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,
         privilege.name)
       or has_table_privilege('anon',
         'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,
         privilege.name)
       or has_table_privilege('authenticated',
         'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,
         privilege.name)
       or has_table_privilege('service_role',
         'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,
         privilege.name))
     or public.hotel_v2_partner_workspace_function_lineage_is_exact() is not true then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_recursion_stage2f_receipt_drift';
  end if;
  if not exists(select 1 from pg_proc procedure_row where procedure_row.oid=
       'public.hotel_v2_external_calendar_activation_function_fingerprints()'::regprocedure
       and procedure_row.proowner='postgres'::regrole and procedure_row.prosecdef
       and procedure_row.provolatile='s'
       and procedure_row.proconfig=
         array['search_path=pg_catalog, public']::text[]
       and encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')=
         'fa6ae9122ad73f57be91c611177eb562b90b09ca9620b98d9f494abafcf3a914')
     or not exists(select 1 from pg_proc procedure_row where procedure_row.oid=
       'public.hotel_v2_h3_2a_reject_immutable_change()'::regprocedure
       and procedure_row.proowner='postgres'::regrole and not procedure_row.prosecdef
       and procedure_row.provolatile='v'
       and procedure_row.proconfig=
         array['search_path=pg_catalog, public']::text[]
       and encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')=
         '5ab5f8fec4515a0eb0e4da1a4de9f765618f45feb0dfe581e0f2a0e9d0a9ef6c')
     or has_function_privilege(0::oid,
       'public.hotel_v2_external_calendar_activation_function_fingerprints()'::regprocedure,
       'EXECUTE')
     or has_function_privilege('anon',
       'public.hotel_v2_external_calendar_activation_function_fingerprints()',
       'EXECUTE')
     or has_function_privilege('authenticated',
       'public.hotel_v2_external_calendar_activation_function_fingerprints()',
       'EXECUTE')
     or has_function_privilege('service_role',
       'public.hotel_v2_external_calendar_activation_function_fingerprints()',
       'EXECUTE')
     or has_function_privilege(0::oid,
       'public.hotel_v2_h3_2a_reject_immutable_change()'::regprocedure,'EXECUTE')
     or has_function_privilege('anon',
       'public.hotel_v2_h3_2a_reject_immutable_change()','EXECUTE')
     or has_function_privilege('authenticated',
       'public.hotel_v2_h3_2a_reject_immutable_change()','EXECUTE')
     or has_function_privilege('service_role',
       'public.hotel_v2_h3_2a_reject_immutable_change()','EXECUTE') then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_recursion_stage2f_function_drift';
  end if;
  v_admin_d_source:=pg_get_functiondef(v_admin_d_oid);
  v_receipt_source:=pg_get_functiondef(v_receipt_oid);
  if (length(v_admin_d_source)-length(replace(v_admin_d_source,
       'v_h3:=public.hotel_v2_h3_1p_pricing_promotion_snapshot(c_hotel);','')))
       /length('v_h3:=public.hotel_v2_h3_1p_pricing_promotion_snapshot(c_hotel);')<>1
     or (length(v_receipt_source)-length(replace(v_receipt_source,
       'v_canonical:=public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot();','')))
       /length('v_canonical:=public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot();')<>1
     or position(
       'v_current_stage2:=public.hotel_v2_external_calendar_stage2_compatible_fingerprints();'
       in v_receipt_source)<>0
     or (length(v_receipt_source)-length(replace(v_receipt_source,
       'and public.hotel_v2_seven_arches_pricing_activation_state_is_exact()),false);','')))
       /length('and public.hotel_v2_seven_arches_pricing_activation_state_is_exact()),false);')<>1
     or public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()
       is not true
     or public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot() is null then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_recursion_call_graph_drift';
  end if;
end
$seven_arches_pricing_activation_recursion_dependencies$;

lock table public.hotel_seven_arches_pricing_activation_evolution_receipts
  in share row exclusive mode;
lock table public.hotel_seven_arches_pricing_activation_reviews
  in share row exclusive mode;

-- Preserve the complete ADMIN-D snapshot byte-for-byte except for its H3.1P
-- dependency.  The inert core supplies the same historical H3.1P fields
-- without re-entering the activation receipt/snapshot graph.
do $seven_arches_pricing_activation_recursion_admin_d_patch$
declare
  v_definition text;
  v_before jsonb;
  v_after jsonb;
  v_old constant text:=
    'v_h3:=public.hotel_v2_h3_1p_pricing_promotion_snapshot(c_hotel);';
  v_new constant text:=
    'v_h3:=public.hotel_v2_h3_1p_pricing_promotion_snapshot_inert_core(c_hotel);';
begin
  execute 'select public.hotel_v2_admin_d_current_foundation_snapshot()'
    into strict v_before;
  select pg_get_functiondef(
    'public.hotel_v2_admin_d_current_foundation_snapshot()'::regprocedure)
    into strict v_definition;
  if (length(v_definition)-length(replace(v_definition,v_old,'')))
       /length(v_old)<>1
     or position(v_new in v_definition)<>0 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_recursion_admin_d_source_drift';
  end if;
  execute replace(v_definition,v_old,v_new);
  execute 'select public.hotel_v2_admin_d_current_foundation_snapshot()'
    into strict v_after;
  if v_after is distinct from v_before then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_recursion_admin_d_semantic_drift';
  end if;
end
$seven_arches_pricing_activation_recursion_admin_d_patch$;

-- This validator deliberately uses no ADMIN-D, Stage2-compatible, Task2,
-- activation snapshot/state, promotion wrapper, current-safe, or self call.
-- It consumes the lower-layer canonical projection and reconstructs active
-- state from exact immutable receipts/base rows so every caller is finite.
create or replace function public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()
returns boolean language plpgsql security definer stable
set search_path=pg_catalog,public
as $function$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_system_actor constant uuid:='00000000-0000-0000-0000-000000000000';
  v_receipt public.hotel_seven_arches_pricing_activation_evolution_receipts%rowtype;
  v_review public.hotel_seven_arches_pricing_activation_reviews%rowtype;
  v_owner public.hotel_admin_availability_foundation_evolution_receipts%rowtype;
  v_original public.hotel_admin_availability_foundation_receipts%rowtype;
  v_task2 public.hotel_partner_property_proposal_foundation_receipts%rowtype;
  v_task2_stage2
    public.hotel_seven_arches_task2_stage2_compatibility_receipts%rowtype;
  v_stage2f hotels_v2_private.hotel_external_calendar_activation_receipts%rowtype;
  v_canonical jsonb;
  v_current jsonb;
  v_current_stage2 jsonb;
  v_payload jsonb;
  v_parity jsonb;
  v_current_owner_user_ids uuid[];
  v_activity_count integer;
  v_owner_membership_exact boolean:=false;
  v_assignment_exact boolean:=false;
  v_permission_exact boolean:=false;
  v_audit_exact boolean:=false;
  v_task2_receipt_topology_exact boolean:=false;
  v_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()');
  v_admin_d_oid oid:=to_regprocedure(
    'public.hotel_v2_admin_d_current_foundation_snapshot()');
  v_inert_oid oid:=to_regprocedure(
    'public.hotel_v2_h3_1p_pricing_promotion_snapshot_inert_core(uuid)');
  v_task2_validator_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()');
  v_projector_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()');
  v_apply_oid oid:=to_regprocedure(
    'public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text)');
  v_activation_immutable_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_pricing_activation_immutable()');
  v_activation_insert_guard_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_pricing_activation_evolution_insert_guard()');
  v_review_guard_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_pricing_activation_review_guard()');
  v_activation_fingerprints_oid oid:=to_regprocedure(
    'public.hotel_v2_external_calendar_activation_function_fingerprints()');
  v_immutable_oid oid:=to_regprocedure(
    'public.hotel_v2_h3_2a_reject_immutable_change()');
begin
  if (select count(*)
      from public.hotel_seven_arches_pricing_activation_evolution_receipts)<>1
     or (select count(*)
      from public.hotel_admin_availability_foundation_evolution_receipts)<>1
     or (select count(*)
      from public.hotel_admin_availability_foundation_receipts)<>1
     or (select count(*)
      from public.hotel_partner_property_proposal_foundation_receipts)<>1
     or (select count(*)
      from hotels_v2_private.hotel_external_calendar_foundation_receipts)<>1
     or (select count(*)
      from hotels_v2_private.hotel_external_calendar_activation_receipts)<>1
     or (select count(*)
      from public.hotel_seven_arches_task2_stage2_compatibility_receipts)<>1
     or v_oid is null or v_admin_d_oid is null or v_inert_oid is null
     or v_task2_validator_oid is null or v_projector_oid is null
     or v_apply_oid is null
     or v_activation_immutable_oid is null
     or v_activation_insert_guard_oid is null or v_review_guard_oid is null
     or v_activation_fingerprints_oid is null
     or v_immutable_oid is null then
    return false;
  end if;
  select * into strict v_receipt
    from public.hotel_seven_arches_pricing_activation_evolution_receipts where id=1;
  select * into strict v_review
    from public.hotel_seven_arches_pricing_activation_reviews
    where id=v_receipt.review_id;
  select * into strict v_owner
    from public.hotel_admin_availability_foundation_evolution_receipts where id=1;
  select * into strict v_original
    from public.hotel_admin_availability_foundation_receipts where id=1;
  select * into strict v_task2
    from public.hotel_partner_property_proposal_foundation_receipts where id=1;
  select * into strict v_task2_stage2
    from public.hotel_seven_arches_task2_stage2_compatibility_receipts where id=1;
  select * into strict v_stage2f
    from hotels_v2_private.hotel_external_calendar_activation_receipts where id=1;
  v_canonical:=public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot();
  v_current:=v_canonical->'task2_protected_fingerprints';
  v_current_stage2:=v_canonical->'stage2_protected_fingerprints';

  v_task2_receipt_topology_exact:=coalesce(
    v_task2_stage2.id=1
    and v_task2_stage2.contract_version=
      'hotels_v2_seven_arches_task2_stage2_compatibility_v1'
    and v_task2_stage2.created_at is not null
    and isfinite(v_task2_stage2.created_at)
    and exists(select 1 from pg_class relation where relation.oid=
      'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
      and relation.relowner='postgres'::regrole and relation.relrowsecurity)
    and (select count(*) from pg_attribute attribute where attribute.attrelid=
      'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
      and attribute.attnum>0 and not attribute.attisdropped)=9
    and not exists(select 1 from (values
      (1::smallint,'id','smallint',true,null::text),
      (2::smallint,'contract_version','text',true,null::text),
      (3::smallint,'canonical_task2_protected_fingerprints','jsonb',true,null::text),
      (4::smallint,'canonical_task2_protected_fingerprint','text',true,null::text),
      (5::smallint,'canonical_stage2_protected_fingerprints','jsonb',true,null::text),
      (6::smallint,'canonical_stage2_protected_fingerprint','text',true,null::text),
      (7::smallint,'canonical_snapshot_source_hash','text',true,null::text),
      (8::smallint,'validator_source_hash','text',true,null::text),
      (9::smallint,'created_at','timestamp with time zone',true,'clock_timestamp()')
    ) expected(attnum,attname,type_name,not_null,default_expression)
    left join pg_attribute attribute on attribute.attrelid=
      'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
      and attribute.attnum=expected.attnum and not attribute.attisdropped
    left join pg_attrdef default_row on default_row.adrelid=attribute.attrelid
      and default_row.adnum=attribute.attnum
    where attribute.attrelid is null
      or attribute.attname is distinct from expected.attname
      or format_type(attribute.atttypid,attribute.atttypmod)
        is distinct from expected.type_name
      or attribute.attnotnull is distinct from expected.not_null
      or attribute.attidentity is distinct from ''
      or attribute.attgenerated is distinct from ''
      or pg_get_expr(default_row.adbin,default_row.adrelid)
        is distinct from expected.default_expression)
    and (select count(*) from pg_constraint constraint_row where
      constraint_row.conrelid=
        'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass)=9
    and (select count(*) from pg_constraint constraint_row
      join pg_index index_row on index_row.indexrelid=constraint_row.conindid
      where constraint_row.conrelid=
          'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
        and constraint_row.contype='p' and constraint_row.convalidated
        and constraint_row.conkey=array[1]::smallint[]
        and pg_get_constraintdef(constraint_row.oid)='PRIMARY KEY (id)'
        and index_row.indisprimary and index_row.indisunique
        and index_row.indisvalid and index_row.indisready)=1
    and (select count(*) from pg_constraint constraint_row where
      constraint_row.conrelid=
          'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
        and constraint_row.contype='c' and constraint_row.convalidated
        and not constraint_row.connoinherit
        and constraint_row.conkey=array[1]::smallint[]
        and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
          '[[:space:]]+','','g')='(id=1)')=1
    and (select count(*) from pg_constraint constraint_row where
      constraint_row.conrelid=
          'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
        and constraint_row.contype='c' and constraint_row.convalidated
        and not constraint_row.connoinherit
        and constraint_row.conkey=array[2]::smallint[]
        and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
          '[[:space:]]+','','g')=
          '(contract_version=''hotels_v2_seven_arches_task2_stage2_compatibility_v1''::text)')=1
    and (select count(*) from pg_constraint constraint_row where
      constraint_row.conrelid=
          'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
        and constraint_row.contype='c' and constraint_row.convalidated
        and not constraint_row.connoinherit
        and constraint_row.conkey=array[3]::smallint[]
        and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
          '[[:space:]]+','','g')=
          '(jsonb_typeof(canonical_task2_protected_fingerprints)=''object''::text)')=1
    and (select count(*) from pg_constraint constraint_row where
      constraint_row.conrelid=
          'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
        and constraint_row.contype='c' and constraint_row.convalidated
        and not constraint_row.connoinherit
        and constraint_row.conkey=array[5]::smallint[]
        and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
          '[[:space:]]+','','g')=
          '(jsonb_typeof(canonical_stage2_protected_fingerprints)=''object''::text)')=1
    and not exists(select 1 from (values
      (4::smallint,'canonical_task2_protected_fingerprint'),
      (6::smallint,'canonical_stage2_protected_fingerprint'),
      (7::smallint,'canonical_snapshot_source_hash'),
      (8::smallint,'validator_source_hash')
    ) expected(attnum,column_name) where (select count(*)
      from pg_constraint constraint_row where constraint_row.conrelid=
        'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
        and constraint_row.contype='c' and constraint_row.convalidated
        and not constraint_row.connoinherit
        and constraint_row.conkey=array[expected.attnum]::smallint[]
        and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
          '[[:space:]]+','','g')='('||expected.column_name||
            '~''^[0-9a-f]{64}$''::text)')<>1)
    and not exists(select 1 from pg_policy policy where policy.polrelid=
      'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass)
    and (select count(*) from pg_trigger trigger_row where trigger_row.tgrelid=
      'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
      and not trigger_row.tgisinternal)=1
    and exists(select 1 from pg_trigger trigger_row where trigger_row.tgrelid=
      'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
      and trigger_row.tgname=
        'hotel_seven_arches_task2_stage2_compatibility_receipt_immutable'
      and trigger_row.tgfoid=
        to_regprocedure('public.hotel_v2_seven_arches_pricing_activation_immutable()')
      and trigger_row.tgtype=27 and trigger_row.tgenabled='O'
      and not trigger_row.tgisinternal)
    and not exists(select 1 from unnest(array[
      'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
    ]) privilege(name) where has_table_privilege(0::oid,
        'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass,
        privilege.name)
      or has_table_privilege('anon',
        'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass,
        privilege.name)
      or has_table_privilege('authenticated',
        'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass,
        privilege.name)
      or has_table_privilege('service_role',
        'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass,
        privilege.name)),false);

  if v_receipt.created_at is null or not isfinite(v_receipt.created_at)
     or (select proowner from pg_proc where oid=v_oid)<>'postgres'::regrole
     or not (select prosecdef from pg_proc where oid=v_oid)
     or (select provolatile from pg_proc where oid=v_oid)<>'s'
     or (select proconfig from pg_proc where oid=v_oid)
       is distinct from array['search_path=pg_catalog, public']::text[]
     or has_function_privilege(0::oid,v_oid,'EXECUTE')
     or has_function_privilege('anon',v_oid,'EXECUTE')
     or has_function_privilege('authenticated',v_oid,'EXECUTE')
     or has_function_privilege('service_role',v_oid,'EXECUTE')
     or (select proowner from pg_proc where oid=v_admin_d_oid)<>'postgres'::regrole
     or not (select prosecdef from pg_proc where oid=v_admin_d_oid)
     or (select provolatile from pg_proc where oid=v_admin_d_oid)<>'s'
     or (select proconfig from pg_proc where oid=v_admin_d_oid)
       is distinct from array['search_path=pg_catalog, public']::text[]
     or has_function_privilege(0::oid,v_admin_d_oid,'EXECUTE')
     or has_function_privilege('anon',v_admin_d_oid,'EXECUTE')
     or has_function_privilege('authenticated',v_admin_d_oid,'EXECUTE')
     or has_function_privilege('service_role',v_admin_d_oid,'EXECUTE')
     or (select proowner from pg_proc where oid=v_inert_oid)<>'postgres'::regrole
     or (select prosecdef from pg_proc where oid=v_inert_oid)
     or (select provolatile from pg_proc where oid=v_inert_oid)<>'s'
     or (select proconfig from pg_proc where oid=v_inert_oid)
       is distinct from array['search_path=pg_catalog, public']::text[]
     or has_function_privilege(0::oid,v_inert_oid,'EXECUTE')
     or has_function_privilege('anon',v_inert_oid,'EXECUTE')
     or has_function_privilege('authenticated',v_inert_oid,'EXECUTE')
     or has_function_privilege('service_role',v_inert_oid,'EXECUTE')
     or (select proowner from pg_proc where oid=v_task2_validator_oid)
       <>'postgres'::regrole
     or not (select prosecdef from pg_proc where oid=v_task2_validator_oid)
     or (select provolatile from pg_proc where oid=v_task2_validator_oid)<>'s'
     or (select proconfig from pg_proc where oid=v_task2_validator_oid)
       is distinct from array['search_path=pg_catalog, public']::text[]
     or has_function_privilege(0::oid,v_task2_validator_oid,'EXECUTE')
     or has_function_privilege('anon',v_task2_validator_oid,'EXECUTE')
     or has_function_privilege('authenticated',v_task2_validator_oid,'EXECUTE')
     or has_function_privilege('service_role',v_task2_validator_oid,'EXECUTE')
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_task2_validator_oid)<>
       '1a14ec7b271861cc5bfc9a683d26e3ef2f2d8a88a86771915a34f503d8a2ff88'
     or (select proowner from pg_proc where oid=v_projector_oid)
       <>'postgres'::regrole
     or not (select prosecdef from pg_proc where oid=v_projector_oid)
     or (select provolatile from pg_proc where oid=v_projector_oid)<>'s'
     or (select proconfig from pg_proc where oid=v_projector_oid)
       is distinct from array['search_path=pg_catalog, public']::text[]
     or has_function_privilege(0::oid,v_projector_oid,'EXECUTE')
     or has_function_privilege('anon',v_projector_oid,'EXECUTE')
     or has_function_privilege('authenticated',v_projector_oid,'EXECUTE')
     or has_function_privilege('service_role',v_projector_oid,'EXECUTE')
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_projector_oid)<>
       'c4860bf5c3eb4219a7fb19e386138fcae8b05292dd728d281c02c41eb9b7b8b9'
     or not exists(select 1 from pg_proc procedure_row
       where procedure_row.oid=v_apply_oid
         and procedure_row.proowner='postgres'::regrole and procedure_row.prosecdef
         and procedure_row.provolatile='v'
         and procedure_row.proconfig=
           array['search_path=pg_catalog, public, auth']::text[]
         and encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),
           'hex')='8c304f78fe93ca8a944443d668ccd82879374379d9520a69b160a2afde0d3407'
         and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
         and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
         and has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
         and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
     or exists(select 1 from (values
       (v_activation_immutable_oid,array['search_path=pg_catalog']::text[],
         '4b3e5ff853a0b8f2e21dd4d18359f8a92614f298d33e7cb9223e9b6aca31fc87'),
       (v_activation_insert_guard_oid,
         array['search_path=pg_catalog, public']::text[],
         '220afcdf846be8b91b554acb5054364126bc7adb1aa085d1bd86ac149985bdb7'),
       (v_review_guard_oid,array['search_path=pg_catalog, public, auth']::text[],
         '23ff92a30533948004130655e1e81b79386f1416afdd413c38816b0573220758')
     ) expected(oid,path,source_hash)
     left join pg_proc procedure_row on procedure_row.oid=expected.oid
     where procedure_row.oid is null
       or procedure_row.proowner<>'postgres'::regrole or not procedure_row.prosecdef
       or procedure_row.provolatile<>'v' or procedure_row.proconfig is distinct from expected.path
       or encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')
         is distinct from expected.source_hash
       or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
       or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
       or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
       or has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
     or v_task2_receipt_topology_exact is not true
     or jsonb_typeof(v_canonical) is distinct from 'object'
     or (select count(*) from jsonb_object_keys(v_canonical))<>7
     or (v_canonical ?& array['contract_version','site_settings_lifecycle',
       'site_settings_lifecycle_fingerprint','task2_protected_fingerprints',
       'task2_protected_fingerprint','stage2_protected_fingerprints',
       'stage2_protected_fingerprint']) is not true
     or v_canonical->>'contract_version' is distinct from
       'hotels_v2_seven_arches_task2_stage2_canonical_snapshot_v1'
     or v_canonical->'site_settings_lifecycle' is distinct from jsonb_build_object(
       'contract_version','hotels_v2_external_calendar_site_settings_lifecycle_v2',
       'id',1,'hotel_rooms_v2_enabled',false,
       'hotel_external_sync_enabled_supported_values',jsonb_build_array(false,true),
       'hotel_instant_booking_enabled',false,'hotel_stripe_connect_enabled',false)
     or v_canonical->>'site_settings_lifecycle_fingerprint' is distinct from
       public.hotel_v2_external_calendar_worker_hash(
         v_canonical->'site_settings_lifecycle')
     or jsonb_typeof(v_current) is distinct from 'object'
     or jsonb_typeof(v_current_stage2) is distinct from 'object'
     or v_canonical->>'task2_protected_fingerprint' is distinct from
       public.hotel_v2_h3_2b_hash(v_current)
     or v_canonical->>'stage2_protected_fingerprint' is distinct from
       public.hotel_v2_external_calendar_worker_hash(v_current_stage2)
     or v_task2_stage2.canonical_task2_protected_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(
         v_task2_stage2.canonical_task2_protected_fingerprints)
     or v_task2_stage2.canonical_stage2_protected_fingerprint is distinct from
       public.hotel_v2_external_calendar_worker_hash(
         v_task2_stage2.canonical_stage2_protected_fingerprints)
     or v_task2_stage2.canonical_snapshot_source_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(v_projector_oid)))
     or v_task2_stage2.validator_source_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(
         pg_get_functiondef(v_task2_validator_oid)))
     or v_task2_stage2.canonical_task2_protected_fingerprints is distinct from
       jsonb_set(v_task2.protected_fingerprints,'{site_settings}',
         v_canonical->'site_settings_lifecycle_fingerprint',false)
     or v_task2_stage2.canonical_stage2_protected_fingerprints is distinct from
       jsonb_set(v_owner.stage2_current_protected_fingerprints,'{site_settings}',
         v_canonical->'site_settings_lifecycle_fingerprint',false)
     or not exists(select 1 from pg_class relation
       where relation.oid=
         'public.hotel_seven_arches_pricing_activation_evolution_receipts'::regclass
         and relation.relowner='postgres'::regrole and relation.relrowsecurity)
     or exists(select 1 from pg_policy policy where policy.polrelid=
       'public.hotel_seven_arches_pricing_activation_evolution_receipts'::regclass)
     or (select count(*) from pg_trigger trigger_row
       where trigger_row.tgrelid=
         'public.hotel_seven_arches_pricing_activation_evolution_receipts'::regclass
         and not trigger_row.tgisinternal)<>2
     or not exists(select 1 from pg_trigger trigger_row
       where trigger_row.tgrelid=
         'public.hotel_seven_arches_pricing_activation_evolution_receipts'::regclass
         and trigger_row.tgname='hotel_seven_arches_pricing_activation_evolution_immutable'
         and trigger_row.tgfoid=
           'public.hotel_v2_seven_arches_pricing_activation_immutable()'::regprocedure
         and trigger_row.tgtype=27 and trigger_row.tgenabled='O'
         and not trigger_row.tgisinternal)
     or not exists(select 1 from pg_trigger trigger_row
       where trigger_row.tgrelid=
         'public.hotel_seven_arches_pricing_activation_evolution_receipts'::regclass
         and trigger_row.tgname='hotel_seven_arches_pricing_activation_evolution_insert_guard'
         and trigger_row.tgfoid=
           'public.hotel_v2_seven_arches_pricing_activation_evolution_insert_guard()'::regprocedure
         and trigger_row.tgtype=7 and trigger_row.tgenabled='O'
         and not trigger_row.tgisinternal)
     or not exists(select 1 from pg_class relation
       where relation.oid=
         'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
         and relation.relowner='postgres'::regrole and relation.relrowsecurity)
     or exists(select 1 from pg_policy policy where policy.polrelid=
       'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass)
     or (select count(*) from pg_trigger trigger_row
       where trigger_row.tgrelid=
         'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
         and not trigger_row.tgisinternal)<>1
     or not exists(select 1 from pg_trigger trigger_row
       where trigger_row.tgrelid=
         'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
         and trigger_row.tgname=
           'hotel_seven_arches_task2_stage2_compatibility_receipt_immutable'
         and trigger_row.tgfoid=
           'public.hotel_v2_seven_arches_pricing_activation_immutable()'::regprocedure
         and trigger_row.tgtype=27 and trigger_row.tgenabled='O'
         and not trigger_row.tgisinternal)
     or exists(select 1 from unnest(array[
       'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
     ]) privilege(name) where
       has_table_privilege(0::oid,
         'public.hotel_seven_arches_pricing_activation_evolution_receipts'::regclass,
         privilege.name)
       or has_table_privilege('anon',
         'public.hotel_seven_arches_pricing_activation_evolution_receipts'::regclass,
         privilege.name)
       or has_table_privilege('authenticated',
         'public.hotel_seven_arches_pricing_activation_evolution_receipts'::regclass,
         privilege.name)
       or has_table_privilege('service_role',
         'public.hotel_seven_arches_pricing_activation_evolution_receipts'::regclass,
         privilege.name))
     or exists(select 1 from unnest(array[
       'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
     ]) privilege(name) where
       has_table_privilege(0::oid,
         'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass,
         privilege.name)
       or has_table_privilege('anon',
         'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass,
         privilege.name)
       or has_table_privilege('authenticated',
         'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass,
         privilege.name)
       or has_table_privilege('service_role',
         'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass,
         privilege.name))
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_admin_d_oid)<>
       '2ed412e46a827c3b57b570f3c6675edc5d1a92562fb8acb59b7148b245ed592a'
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_inert_oid)<>
       '190b30e05c95e7220f800284b6408659f21172dba48161163e2a364c40aa95a5' then
    return false;
  end if;

  -- The Stage2F row hash is historical activation-era evidence.  Current
  -- mutable site_settings metadata is intentionally outside this proof; only
  -- the four Hotels lifecycle flags and the immutable receipt/function lineage
  -- remain authoritative.
  if v_stage2f.created_at is null or not isfinite(v_stage2f.created_at)
     or v_stage2f.site_settings_without_external_fingerprint!~'^[0-9a-f]{64}$'
     or jsonb_typeof(v_stage2f.compatibility_function_fingerprints)<>'object'
     or (select count(*)
       from jsonb_object_keys(v_stage2f.compatibility_function_fingerprints))<>20
     or not (v_stage2f.compatibility_function_fingerprints ?& array[
       'public.hotel_v2_h3_2a_require_partner_hotel_access(uuid,uuid,text,boolean)',
       'public.hotel_v2_partner_list_assigned_properties(uuid)',
       'public.hotel_v2_admin_apply_partner_hotel_permissions(jsonb,uuid,uuid)',
       'public.hotel_v2_admin_create_property_draft(uuid,jsonb,uuid)',
       'public.hotel_v2_admin_apply_guest_policy_plan(jsonb,uuid)',
       'public.hotel_v2_admin_apply_room_control_plan(jsonb,uuid)',
       'public.hotel_v2_admin_get_content_control(uuid)',
       'public.hotel_v2_admin_apply_operational_assignment_plan(jsonb,uuid)',
       'public.hotel_v2_admin_apply_property_control_plan(jsonb,uuid)',
       'public.hotel_v2_admin_apply_pricing_control_plan(jsonb,uuid,text)',
       'public.hotel_v2_admin_apply_h3_1_configuration_h3_1p_core(jsonb,uuid)',
       'public.hotel_v2_h3_2b_flags_off()',
       'public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)',
       'public.hotel_v2_admin_create_property_draft_admin_b_core(uuid,jsonb,uuid)',
       'public.hotel_v2_admin_apply_guest_policy_plan_admin_b_core(jsonb,uuid)',
       'public.hotel_v2_admin_apply_workspace_plan_admin_b_core(jsonb,uuid)',
       'public.hotel_v2_admin_apply_calendar_plan_admin_c_core(jsonb,uuid)',
       'public.hotel_v2_admin_apply_workspace_plan_admin_c_core(jsonb,uuid)',
       'public.hotel_v2_admin_apply_h3_1_configuration_admin_c_core(jsonb,uuid)',
       'public.hotel_v2_admin_apply_legacy_pricing_promotion_admin_c_core(jsonb,uuid)'
     ]::text[])
     or exists(select 1
       from jsonb_each_text(v_stage2f.compatibility_function_fingerprints) entry
       where (entry.value~'^[0-9a-f]{64}$') is distinct from true)
     or not exists(select 1 from pg_class relation where relation.oid=
       'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
       and relation.relowner='postgres'::regrole and not relation.relrowsecurity)
     or exists(select 1 from pg_policy policy where policy.polrelid=
       'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass)
     or (select count(*) from pg_trigger trigger_row where trigger_row.tgrelid=
       'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
       and not trigger_row.tgisinternal)<>1
     or not exists(select 1 from pg_trigger trigger_row where trigger_row.tgrelid=
       'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
       and trigger_row.tgname='hotel_external_calendar_activation_receipt_immutable'
       and trigger_row.tgfoid=v_immutable_oid and trigger_row.tgtype=27
       and trigger_row.tgenabled='O' and not trigger_row.tgisinternal)
     or exists(select 1 from unnest(array[
       'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
     ]) privilege(name) where has_table_privilege(0::oid,
         'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,
         privilege.name)
       or has_table_privilege('anon',
         'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,
         privilege.name)
       or has_table_privilege('authenticated',
         'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,
         privilege.name)
       or has_table_privilege('service_role',
         'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,
         privilege.name))
     or (select proowner from pg_proc where oid=v_activation_fingerprints_oid)
       <>'postgres'::regrole
     or not (select prosecdef from pg_proc where oid=v_activation_fingerprints_oid)
     or (select provolatile from pg_proc where oid=v_activation_fingerprints_oid)<>'s'
     or (select proconfig from pg_proc where oid=v_activation_fingerprints_oid)
       is distinct from array['search_path=pg_catalog, public']::text[]
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_activation_fingerprints_oid)<>
       'fa6ae9122ad73f57be91c611177eb562b90b09ca9620b98d9f494abafcf3a914'
     or has_function_privilege(0::oid,v_activation_fingerprints_oid,'EXECUTE')
     or has_function_privilege('anon',v_activation_fingerprints_oid,'EXECUTE')
     or has_function_privilege('authenticated',v_activation_fingerprints_oid,'EXECUTE')
     or has_function_privilege('service_role',v_activation_fingerprints_oid,'EXECUTE')
     or (select proowner from pg_proc where oid=v_immutable_oid)<>'postgres'::regrole
     or (select prosecdef from pg_proc where oid=v_immutable_oid)
     or (select provolatile from pg_proc where oid=v_immutable_oid)<>'v'
     or (select proconfig from pg_proc where oid=v_immutable_oid)
       is distinct from array['search_path=pg_catalog, public']::text[]
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_immutable_oid)<>
       '5ab5f8fec4515a0eb0e4da1a4de9f765618f45feb0dfe581e0f2a0e9d0a9ef6c'
     or has_function_privilege(0::oid,v_immutable_oid,'EXECUTE')
     or has_function_privilege('anon',v_immutable_oid,'EXECUTE')
     or has_function_privilege('authenticated',v_immutable_oid,'EXECUTE')
     or has_function_privilege('service_role',v_immutable_oid,'EXECUTE')
     or public.hotel_v2_partner_workspace_function_lineage_is_exact() is not true then
    return false;
  end if;

  select array_agg(member.user_id order by member.user_id)
    into v_current_owner_user_ids
  from public.partner_users member
  where member.partner_id=v_owner.partner_id and member.role='owner';
  v_owner_membership_exact:=coalesce(cardinality(v_current_owner_user_ids),0)>=1
    and v_owner.owner_user_ids is not distinct from v_current_owner_user_ids
    and array_position(v_owner.owner_user_ids,null) is null
    and cardinality(v_owner.owner_user_ids)=(select count(distinct owner_id)
      from unnest(v_owner.owner_user_ids) owner_id)
    and v_owner.owner_membership_fingerprint=encode(extensions.digest(convert_to(
      jsonb_build_object(
        'contract_version','hotels_v2_seven_arches_owner_membership_v1',
        'hotel_id',v_owner.hotel_id,'partner_id',v_owner.partner_id,
        'assignment_id',v_owner.assignment_id,'role','owner',
        'owner_user_ids',to_jsonb(v_owner.owner_user_ids)
      )::text,'UTF8'),'sha256'),'hex');
  v_assignment_exact:=(select count(*)=1 from public.partner_resources assignment
      where assignment.resource_type='hotels' and assignment.resource_id=c_hotel)
    and exists(select 1 from public.hotels hotel
      join public.partners partner on partner.id=hotel.owner_partner_id
      join public.partner_resources assignment on assignment.partner_id=partner.id
        and assignment.resource_type='hotels' and assignment.resource_id=hotel.id
      where hotel.id=c_hotel and partner.id=v_owner.partner_id
        and assignment.id=v_owner.assignment_id
        and partner.status='active' and partner.can_manage_hotels)
    and v_owner_membership_exact;
  v_permission_exact:=(select count(*)=1
      from public.hotel_partner_hotel_permissions permission
      where permission.hotel_id=c_hotel
        and permission.assignment_id=v_owner.assignment_id
        and permission.partner_id=v_owner.partner_id and permission.version=1
        and permission.created_by is null and permission.updated_by is null
        and permission.has_mutation_capability
        and public.hotel_v2_h3_2a_permissions_snapshot(permission.assignment_id)
          is not distinct from v_owner.after_permission
        and public.hotel_v2_h3_2a_permissions_snapshot(permission.assignment_id)->'capabilities'
          is not distinct from public.hotel_v2_seven_arches_owner_capabilities())
    and (select count(*)=1 from public.hotel_partner_hotel_permissions permission
      where permission.hotel_id=c_hotel)
    and not exists(select 1 from public.hotel_partner_hotel_permissions permission
      where permission.hotel_id=c_hotel
        and permission.assignment_id<>v_owner.assignment_id
        and permission.has_mutation_capability);
  v_audit_exact:=exists(select 1 from public.hotel_activity_log activity
      where activity.id=v_owner.activity_id and activity.hotel_id=c_hotel
        and activity.entity_type='property' and activity.entity_id=c_hotel
        and activity.action='update' and activity.actor_type='system'
        and activity.actor_id is null
        and activity.source='hotels_v2_seven_arches_owner_capability_bootstrap'
        and activity.correlation_id=v_owner.correlation_id
        and activity.before_state=jsonb_build_object(
          'partner_permissions',v_owner.before_permission,
          'assignment_id',v_owner.assignment_id,'partner_id',v_owner.partner_id)
        and activity.after_state=jsonb_build_object(
          'partner_permissions',v_owner.after_permission,
          'assignment_id',v_owner.assignment_id,'partner_id',v_owner.partner_id))
    and exists(select 1 from public.hotel_partner_action_receipts receipt
      where receipt.id=v_owner.action_receipt_id
        and receipt.partner_id=v_owner.partner_id and receipt.hotel_id=c_hotel
        and receipt.actor_user_id=c_system_actor
        and receipt.action='bootstrap_7_arches_owner_capabilities'
        and receipt.idempotency_key=v_owner.idempotency_key
        and receipt.request_hash=v_owner.request_hash
        and receipt.correlation_id=v_owner.correlation_id
        and receipt.result is not distinct from jsonb_build_object(
          'ok',true,
          'contract_version','hotels_v2_seven_arches_owner_capability_bootstrap_v1',
          'source','hotels_v2_seven_arches_owner_capability_bootstrap',
          'hotel_id',c_hotel,'partner_id',v_owner.partner_id,
          'assignment_id',v_owner.assignment_id,'changed',true,
          'permission',v_owner.after_permission,
          'correlation_id',v_owner.correlation_id,
          'idempotency_key',v_owner.idempotency_key)
        and receipt.request_hash=encode(extensions.digest(convert_to(jsonb_build_object(
          'contract_version','hotels_v2_seven_arches_owner_capability_bootstrap_v1',
          'actor_type','system','hotel_id',c_hotel,
          'partner_id',v_owner.partner_id,'assignment_id',v_owner.assignment_id,
          'owner_user_ids',to_jsonb(v_owner.owner_user_ids),
          'owner_membership_fingerprint',v_owner.owner_membership_fingerprint,
          'capabilities',v_owner.capabilities)::text,'UTF8'),'sha256'),'hex'))
    and exists(select 1 from public.hotel_partner_event_outbox event
      where event.id=v_owner.outbox_id and event.partner_id=v_owner.partner_id
        and event.hotel_id=c_hotel and event.aggregate_type='hotel_partner_permissions'
        and event.aggregate_id=v_owner.assignment_id
        and event.event_type='hotel.partner_permissions.updated'
        and event.dedupe_key='h3_2a:permission:'||v_owner.action_receipt_id::text
        and event.payload is not distinct from jsonb_build_object(
          'hotel_id',c_hotel,'assignment_id',v_owner.assignment_id,
          'partner_id',v_owner.partner_id,'permission_version',1,
          'has_mutation_capability',true,'correlation_id',v_owner.correlation_id));

  if v_assignment_exact is not true or v_permission_exact is not true
     or v_audit_exact is not true
     or v_original.id<>1
     or v_original.protected_fingerprint<>public.hotel_v2_h3_2b_hash(
       v_original.protected_fingerprints)
     or v_owner.contract_version<>'hotels_v2_admin_d_foundation_evolution_v2'
     or v_owner.before_current_protected_fingerprint<>encode(extensions.digest(
       convert_to(v_owner.before_current_protected_fingerprints::text,'UTF8'),
       'sha256'),'hex')
     or v_owner.current_protected_fingerprint<>encode(extensions.digest(
       convert_to(v_owner.current_protected_fingerprints::text,'UTF8'),
       'sha256'),'hex')
     or v_owner.stage2_current_protected_fingerprint<>
       public.hotel_v2_external_calendar_worker_hash(
         v_owner.stage2_current_protected_fingerprints)
     or not exists(select 1
       from hotels_v2_private.hotel_external_calendar_foundation_receipts foundation
       where foundation.id=1 and foundation.protected_fingerprint=
         public.hotel_v2_external_calendar_worker_hash(foundation.protected_fingerprints))
     or v_task2.protected_fingerprint<>
       public.hotel_v2_h3_2b_hash(v_task2.protected_fingerprints)
     or v_task2.owner_evolution_receipt_id<>v_owner.id
     or v_task2.owner_evolution_receipt_fingerprint<>
       public.hotel_v2_h3_2b_hash(jsonb_set(to_jsonb(v_owner),'{created_at}',
         to_jsonb(extract(epoch from v_owner.created_at)),false))
     or v_task2.stage2_compatibility_source_hash<>
       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
         'public.hotel_v2_external_calendar_stage2_compatible_fingerprints()'::regprocedure)))
     or not exists(select 1
       from public.hotel_seven_arches_task2_stage2_compatibility_receipts receipt
       where receipt.id=1 and receipt.created_at is not null
         and isfinite(receipt.created_at)
         and receipt.validator_source_hash=public.hotel_v2_h3_2b_hash(to_jsonb(
           pg_get_functiondef(v_task2_validator_oid))))
     or v_task2.provider_source_attribution_source_hash<>
       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
         'public.hotel_v2_external_calendar_provider_sources_are_attributable()'::regprocedure)))
     or public.hotel_v2_external_calendar_provider_sources_are_attributable()
       is not true
     or public.hotel_v2_partner_workspace_function_lineage_is_exact() is not true
     or public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()
       is not true
     or (select count(*)<>1 or bool_or(id<>1 or hotel_rooms_v2_enabled
          or hotel_external_sync_enabled is null
          or hotel_instant_booking_enabled or hotel_stripe_connect_enabled)
       from public.site_settings) then
    return false;
  end if;

  v_payload:=v_review.reviewed_plan#>'{operation,payload}';
  v_parity:=public.hotel_v2_h3_1p_parity_snapshot(c_hotel);
  select count(*) into v_activity_count from public.hotel_activity_log activity
    where activity.id=any(v_receipt.activity_ids)
      and activity.hotel_id=v_receipt.hotel_id and activity.actor_id=v_receipt.actor_id
      and activity.actor_type='admin' and activity.action='update'
      and activity.source='hotels_v2_seven_arches_pricing_activation'
      and activity.correlation_id=v_receipt.correlation_id
      and (activity.entity_type,activity.entity_id) in(
        ('rate_plan','22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid),
        ('pricing_schedule','b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid),
        ('room_rate','7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid),
        ('room_rate','3320590d-632d-423f-80d0-fd021cba7293'::uuid));

  -- Inline the activation snapshot blockers.  Calling that snapshot here
  -- would recreate the receipt -> snapshot -> Task2 -> ADMIN-D cycle.
  if not exists(select 1 from public.hotels hotel where hotel.id=c_hotel
       and hotel.architecture_version='legacy' and btrim(hotel.currency::text)='EUR'
       and hotel.minimum_stay_nights=2 and hotel.booking_mode='request_confirmation'
       and md5(hotel.pricing_tiers::text)='7208ab4ecc0e47abd64d87ca1ac53a03')
     or coalesce((v_parity->>'total_case_count')::integer,-1)<>70
     or coalesce((v_parity->>'total_mismatch_count')::integer,-1)<>0
     or v_parity->>'fingerprint' is distinct from v_receipt.parity_fingerprint
     or public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()
       is not true
     or not exists(select 1 from public.hotel_pricing_promotion_reviews review
       where review.hotel_id=c_hotel
         and review.contract_version='seven_kamares_legacy_to_h3_pricing_v1'
         and review.review_status='reviewed' and review.parity_case_count=70
         and review.parity_mismatch_count=0
         and review.acknowledged_pricing_occupancy_mapping
         and review.source_fingerprint='7208ab4ecc0e47abd64d87ca1ac53a03'
         and review.parity_fingerprint=v_parity->>'fingerprint')
     or (select count(*) from public.hotel_rate_plans where hotel_id=c_hotel)<>1
     or not exists(select 1 from public.hotel_rate_plans plan where
       plan.id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid and plan.hotel_id=c_hotel
       and plan.code='standard' and plan.is_active and plan.review_status='reviewed'
       and plan.name_i18n is not distinct from v_payload->'rate_plan_name_i18n'
       and plan.description_i18n is not distinct from v_payload->'rate_plan_description_i18n'
       and public.hotel_v2_admin_c_i18n_is_valid(plan.name_i18n,true,240,false)
       and public.hotel_v2_admin_c_i18n_is_valid(
         plan.description_i18n,true,5000,true)
       and plan.cancellation_policy='{"type":"non_refundable"}'::jsonb
       and plan.price_inclusions=array['cleaning','taxes']::text[])
     or (select count(*) from public.hotel_room_rates where hotel_id=c_hotel)<>2
     or not exists(select 1 from public.hotel_room_rates rate where
       rate.id='7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid and rate.hotel_id=c_hotel
       and rate.room_type_id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid
       and rate.rate_plan_id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid
       and rate.pricing_schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid
       and rate.base_nightly_rate=v_receipt.upper_base_nightly_rate
       and btrim(rate.currency::text)='EUR' and rate.is_active
       and rate.review_status='reviewed')
     or not exists(select 1 from public.hotel_room_rates rate where
       rate.id='3320590d-632d-423f-80d0-fd021cba7293'::uuid and rate.hotel_id=c_hotel
       and rate.room_type_id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid
       and rate.rate_plan_id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid
       and rate.pricing_schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid
       and rate.base_nightly_rate=v_receipt.ground_base_nightly_rate
       and btrim(rate.currency::text)='EUR' and rate.is_active
       and rate.review_status='reviewed')
     or (select count(*) from public.hotel_pricing_schedules where hotel_id=c_hotel)<>2
     or not exists(select 1 from public.hotel_pricing_schedules schedule where
       schedule.id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid
       and schedule.hotel_id=c_hotel and schedule.code='shared-apartment-occupancy-los'
       and schedule.application_scope='room_occupancy'
       and schedule.minimum_billable_occupancy=2 and schedule.maximum_party_size=4
       and btrim(schedule.currency::text)='EUR' and schedule.is_active
       and schedule.review_status='reviewed' and schedule.source='legacy_preview'
       and schedule.source_reference->>'pricing_fingerprint'=
         '7208ab4ecc0e47abd64d87ca1ac53a03'
       and schedule.name_i18n is not distinct from v_payload->'schedule_name_i18n')
     or not exists(select 1 from public.hotel_pricing_schedules schedule where
       schedule.id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid
       and public.hotel_v2_admin_c_i18n_is_valid(
         schedule.name_i18n,true,240,false))
     or not exists(select 1 from public.hotel_pricing_schedules schedule where
       schedule.id='443065c0-984a-5de3-a22a-d03042c41107'::uuid
       and schedule.hotel_id=c_hotel and schedule.code='legacy-property-party-preview'
       and schedule.application_scope='property_booking_party'
       and not schedule.is_active and schedule.review_status='requires_review')
     or (select count(*) from public.hotel_pricing_schedule_occupancy_tiers tier
       where tier.schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid
         and tier.is_active)<>27
     or exists(
       (select (source.value->>'persons')::smallint,
          (source.value->>'min_nights')::integer,
          (source.value->>'price_per_night')::numeric
        from public.hotels hotel
        cross join lateral jsonb_array_elements(hotel.pricing_tiers->'rules') source(value)
        where hotel.id=c_hotel and (source.value->>'persons')::integer between 2 and 4
        except
        select tier.guest_count,tier.threshold_nights,tier.nightly_rate
        from public.hotel_pricing_schedule_occupancy_tiers tier
        where tier.schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid
          and tier.is_active)
       union all
       (select tier.guest_count,tier.threshold_nights,tier.nightly_rate
        from public.hotel_pricing_schedule_occupancy_tiers tier
        where tier.schedule_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid
          and tier.is_active
        except
        select (source.value->>'persons')::smallint,
          (source.value->>'min_nights')::integer,
          (source.value->>'price_per_night')::numeric
        from public.hotels hotel
        cross join lateral jsonb_array_elements(hotel.pricing_tiers->'rules') source(value)
        where hotel.id=c_hotel and (source.value->>'persons')::integer between 2 and 4))
     or (select count(*) from public.hotel_payment_policies where hotel_id=c_hotel)<>1
     or not exists(select 1 from public.hotel_payment_policies policy
       where policy.hotel_id=c_hotel and policy.code='seven-kamares-request-confirmation'
         and btrim(policy.currency::text)='EUR' and policy.is_active
         and policy.review_status='reviewed')
     or (select count(*) from public.hotel_payment_policy_terms term
       join public.hotel_payment_policies policy on policy.id=term.payment_policy_id
       where policy.hotel_id=c_hotel)<>2
     or not exists(select 1 from public.hotel_payment_policy_terms term
       join public.hotel_payment_policies policy on policy.id=term.payment_policy_id
       where policy.hotel_id=c_hotel and term.sequence=1
         and term.due_event='after_partner_acceptance' and term.amount_mode='percent_total'
         and term.amount_value=50 and term.recipient='partner'
         and term.payment_methods=array['bank_transfer']::text[])
     or not exists(select 1 from public.hotel_payment_policy_terms term
       join public.hotel_payment_policies policy on policy.id=term.payment_policy_id
       where policy.hotel_id=c_hotel and term.sequence=2 and term.due_event='on_arrival'
         and term.amount_mode='remaining_balance' and term.amount_value is null
         and term.recipient='partner'
         and term.payment_methods=array['card','cash']::text[])
     or (select count(*) from public.hotel_commission_policies policy
       where policy.hotel_id=c_hotel and policy.is_active
         and policy.review_status='reviewed')<>1
     or not exists(select 1 from public.hotel_commission_policies policy
       where policy.hotel_id=c_hotel
         and policy.commission_mode='per_allocated_room_per_night'
         and policy.amount=10 and btrim(policy.currency::text)='EUR'
         and policy.is_active and policy.review_status='reviewed') then
    return false;
  end if;

  return coalesce(v_receipt.contract_version=
      'hotels_v2_seven_arches_pricing_activation_evolution_v1'
    and v_receipt.hotel_id=c_hotel and v_receipt.id=1
    and v_receipt.before_protected_fingerprint=
      public.hotel_v2_h3_2b_hash(v_receipt.before_protected_fingerprints)
    and v_receipt.before_protected_fingerprints is not distinct from
      v_task2_stage2.canonical_task2_protected_fingerprints
    and v_receipt.before_protected_fingerprint is not distinct from
      v_task2_stage2.canonical_task2_protected_fingerprint
    and v_receipt.after_protected_fingerprint=
      public.hotel_v2_h3_2b_hash(v_receipt.after_protected_fingerprints)
    and v_receipt.after_protected_fingerprints is not distinct from v_current
    and v_receipt.after_protected_fingerprint is not distinct from
      v_canonical->>'task2_protected_fingerprint'
    and v_receipt.allowed_fingerprint_keys=array[
      'hotel_rate_plans','hotel_room_rates_protected','hotel_pricing_schedules',
      'hotel_admin_pricing_action_receipts','non_h3_2b_activity']::text[]
    and (v_receipt.after_protected_fingerprints-v_receipt.allowed_fingerprint_keys)
      is not distinct from
      (v_receipt.before_protected_fingerprints-v_receipt.allowed_fingerprint_keys)
    and not exists(select 1 from unnest(v_receipt.allowed_fingerprint_keys) changed(key)
      where v_receipt.before_protected_fingerprints->changed.key is null
        or v_receipt.after_protected_fingerprints->changed.key is null
        or v_receipt.before_protected_fingerprints->changed.key
          is not distinct from v_receipt.after_protected_fingerprints->changed.key)
    and v_receipt.before_stage2_protected_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(
        v_receipt.before_stage2_protected_fingerprints)
    and v_receipt.before_stage2_protected_fingerprint=
      v_task2_stage2.canonical_stage2_protected_fingerprint
    and v_receipt.before_stage2_protected_fingerprints is not distinct from
      v_task2_stage2.canonical_stage2_protected_fingerprints
    and v_receipt.after_stage2_protected_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(
        v_receipt.after_stage2_protected_fingerprints)
    and v_receipt.after_stage2_protected_fingerprints is not distinct from
      v_current_stage2
    and v_receipt.after_stage2_protected_fingerprint is not distinct from
      v_canonical->>'stage2_protected_fingerprint'
    and v_receipt.stage2_allowed_fingerprint_keys=array[
      'hotel_rate_plans','hotel_room_rates_protected','hotel_pricing_schedules',
      'hotel_admin_pricing_action_receipts','non_external_calendar_activity']::text[]
    and (v_receipt.after_stage2_protected_fingerprints-
      v_receipt.stage2_allowed_fingerprint_keys) is not distinct from
      (v_receipt.before_stage2_protected_fingerprints-
      v_receipt.stage2_allowed_fingerprint_keys)
    and not exists(select 1
      from unnest(v_receipt.stage2_allowed_fingerprint_keys) changed(key)
      where v_receipt.before_stage2_protected_fingerprints->changed.key is null
        or v_receipt.after_stage2_protected_fingerprints->changed.key is null
        or v_receipt.before_stage2_protected_fingerprints->changed.key
          is not distinct from v_receipt.after_stage2_protected_fingerprints->changed.key)
    and v_review.id=v_receipt.review_id and v_review.consumed_at is not null
    and v_review.consumed_correlation_id=v_receipt.correlation_id
    and v_review.consumed_idempotency_key=v_receipt.idempotency_key
    and v_review.actor_id=v_receipt.actor_id and v_review.result is not null
    and v_review.result->>'contract_version'=
      'hotels_v2_seven_arches_pricing_activation_apply_result_v1'
    and v_review.result->>'review_id'=v_review.id::text
    and v_review.result->>'correlation_id'=v_receipt.correlation_id::text
    and v_review.result->>'idempotency_key'=v_receipt.idempotency_key
    and v_review.result->'activity_ids'=to_jsonb(v_receipt.activity_ids)
    and v_review.result->>'public_change'='false'
    and v_review.result->>'legacy_authoritative'='true'
    and v_receipt.upper_base_nightly_rate is not distinct from
      (v_payload->>'upper_base_nightly_rate')::numeric
    and v_receipt.ground_base_nightly_rate is not distinct from
      (v_payload->>'ground_base_nightly_rate')::numeric
    and v_receipt.pricing_authority='shared_schedule'
    and exists(select 1 from public.hotel_admin_pricing_action_receipts receipt
      where receipt.id=v_receipt.admin_receipt_id
        and receipt.hotel_id=v_receipt.hotel_id and receipt.actor_id=v_receipt.actor_id
        and receipt.idempotency_key=v_receipt.idempotency_key
        and receipt.correlation_id=v_receipt.correlation_id
        and receipt.result=v_review.result
        and receipt.request_hash=encode(extensions.digest(convert_to(jsonb_build_object(
          'reviewed_plan',v_review.reviewed_plan,
          'correlation_id',v_receipt.correlation_id)::text,'UTF8'),'sha256'),'hex'))
    and v_activity_count=4 and cardinality(v_receipt.activity_ids)=4
    and (select count(*) from public.hotel_activity_log activity
      where activity.source='hotels_v2_seven_arches_pricing_activation')=4
    and exists(select 1 from public.hotel_activity_log activity
      where activity.id=any(v_receipt.activity_ids) and activity.entity_type='rate_plan'
        and activity.entity_id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid
        and activity.before_state->>'is_active'='false'
        and activity.after_state->>'is_active'='true'
        and activity.after_state->'name_i18n' is not distinct from
          v_payload->'rate_plan_name_i18n'
        and activity.after_state->'description_i18n' is not distinct from
          v_payload->'rate_plan_description_i18n'
        and (activity.after_state-array[
          'name_i18n','description_i18n','is_active','version','updated_at'])
          is not distinct from (activity.before_state-array[
          'name_i18n','description_i18n','is_active','version','updated_at'])
        and (activity.after_state->>'version')::integer=
          (activity.before_state->>'version')::integer+1
        and (activity.after_state->>'updated_at')::timestamptz>
          (activity.before_state->>'updated_at')::timestamptz)
    and exists(select 1 from public.hotel_activity_log activity
      where activity.id=any(v_receipt.activity_ids)
        and activity.entity_type='pricing_schedule'
        and activity.entity_id='b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid
        and activity.before_state->>'is_active'='false'
        and activity.after_state->>'is_active'='true'
        and activity.after_state->'name_i18n' is not distinct from
          v_payload->'schedule_name_i18n'
        and (activity.after_state-array['name_i18n','is_active','version','updated_at'])
          is not distinct from
          (activity.before_state-array['name_i18n','is_active','version','updated_at'])
        and (activity.after_state->>'version')::integer=
          (activity.before_state->>'version')::integer+1
        and (activity.after_state->>'updated_at')::timestamptz>
          (activity.before_state->>'updated_at')::timestamptz)
    and exists(select 1 from public.hotel_activity_log activity
      where activity.id=any(v_receipt.activity_ids) and activity.entity_type='room_rate'
        and activity.entity_id='7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid
        and activity.before_state->>'is_active'='false'
        and (activity.before_state->>'base_nightly_rate')::numeric=0
        and activity.after_state->>'is_active'='true'
        and (activity.after_state->>'base_nightly_rate')::numeric=
          (v_payload->>'upper_base_nightly_rate')::numeric
        and (activity.after_state-array[
          'base_nightly_rate','is_active','version','updated_at'])
          is not distinct from (activity.before_state-array[
          'base_nightly_rate','is_active','version','updated_at'])
        and (activity.after_state->>'version')::integer=
          (activity.before_state->>'version')::integer+1
        and (activity.after_state->>'updated_at')::timestamptz>
          (activity.before_state->>'updated_at')::timestamptz)
    and exists(select 1 from public.hotel_activity_log activity
      where activity.id=any(v_receipt.activity_ids) and activity.entity_type='room_rate'
        and activity.entity_id='3320590d-632d-423f-80d0-fd021cba7293'::uuid
        and activity.before_state->>'is_active'='false'
        and (activity.before_state->>'base_nightly_rate')::numeric=0
        and activity.after_state->>'is_active'='true'
        and (activity.after_state->>'base_nightly_rate')::numeric=
          (v_payload->>'ground_base_nightly_rate')::numeric
        and (activity.after_state-array[
          'base_nightly_rate','is_active','version','updated_at'])
          is not distinct from (activity.before_state-array[
          'base_nightly_rate','is_active','version','updated_at'])
        and (activity.after_state->>'version')::integer=
          (activity.before_state->>'version')::integer+1
        and (activity.after_state->>'updated_at')::timestamptz>
          (activity.before_state->>'updated_at')::timestamptz)
    and v_receipt.validator_source_before_hash=encode(extensions.digest(convert_to(
      pg_get_functiondef('public.hotel_v2_admin_c_validate_pricing_graph(uuid)'::regprocedure),
      'UTF8'),'sha256'),'hex')
    and v_receipt.validator_source_after_hash=encode(extensions.digest(convert_to(
      pg_get_functiondef('public.hotel_v2_admin_c_validate_pricing_graph(uuid)'::regprocedure),
      'UTF8'),'sha256'),'hex')
    and v_receipt.inert_snapshot_source_hash=encode(extensions.digest(convert_to(
      pg_get_functiondef(
        'public.hotel_v2_h3_1p_pricing_promotion_snapshot_inert_core(uuid)'::regprocedure),
      'UTF8'),'sha256'),'hex')
    and v_receipt.canonical_snapshot_source_hash=encode(extensions.digest(convert_to(
      pg_get_functiondef(
        'public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid)'::regprocedure),
      'UTF8'),'sha256'),'hex')
    and v_receipt.activation_snapshot_source_hash=encode(extensions.digest(convert_to(
      pg_get_functiondef(
        'public.hotel_v2_seven_arches_pricing_activation_snapshot()'::regprocedure),
      'UTF8'),'sha256'),'hex')
    and v_receipt.state_validator_source_hash=encode(extensions.digest(convert_to(
      pg_get_functiondef(
        'public.hotel_v2_seven_arches_pricing_activation_state_is_exact()'::regprocedure),
      'UTF8'),'sha256'),'hex')
    and v_receipt.receipt_validator_source_hash=encode(extensions.digest(convert_to(
      pg_get_functiondef(
        'public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()'::regprocedure),
      'UTF8'),'sha256'),'hex')
    and v_receipt.freeze_trigger_source_hash=encode(extensions.digest(convert_to(
      pg_get_functiondef(
        'public.hotel_v2_admin_c_h3_1p_freeze_trigger()'::regprocedure),
      'UTF8'),'sha256'),'hex')
    and not exists(select 1
      from public.hotel_seven_arches_pricing_activation_transaction_context),false);
end
$function$;

alter function public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()
  owner to postgres;
revoke all on function public.hotel_v2_admin_d_current_foundation_snapshot()
  from public,anon,authenticated,service_role;
revoke all on function public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()
  from public,anon,authenticated,service_role;

do $seven_arches_pricing_activation_recursion_postconditions$
declare
  v_admin_d_oid oid:=to_regprocedure(
    'public.hotel_v2_admin_d_current_foundation_snapshot()');
  v_receipt_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()');
  v_source text;
begin
  if (select count(*)
      from public.hotel_seven_arches_pricing_activation_evolution_receipts)<>0
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_admin_d_oid)<>
         '2ed412e46a827c3b57b570f3c6675edc5d1a92562fb8acb59b7148b245ed592a'
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_receipt_oid)<>
         '305f00d9c47c0366e79afe107eb4c1b41850bfb61b3c55a0c4461ca2481e8f32'
     or (select proowner from pg_proc where oid=v_admin_d_oid)<>'postgres'::regrole
     or not (select prosecdef from pg_proc where oid=v_admin_d_oid)
     or (select provolatile from pg_proc where oid=v_admin_d_oid)<>'s'
     or (select proconfig from pg_proc where oid=v_admin_d_oid)
       is distinct from array['search_path=pg_catalog, public']::text[]
     or (select proowner from pg_proc where oid=v_receipt_oid)<>'postgres'::regrole
     or not (select prosecdef from pg_proc where oid=v_receipt_oid)
     or (select provolatile from pg_proc where oid=v_receipt_oid)<>'s'
     or (select proconfig from pg_proc where oid=v_receipt_oid)
       is distinct from array['search_path=pg_catalog, public']::text[]
     or has_function_privilege(0::oid,v_admin_d_oid,'EXECUTE')
     or has_function_privilege('anon',v_admin_d_oid,'EXECUTE')
     or has_function_privilege('authenticated',v_admin_d_oid,'EXECUTE')
     or has_function_privilege('service_role',v_admin_d_oid,'EXECUTE')
     or has_function_privilege(0::oid,v_receipt_oid,'EXECUTE')
     or has_function_privilege('anon',v_receipt_oid,'EXECUTE')
     or has_function_privilege('authenticated',v_receipt_oid,'EXECUTE')
     or has_function_privilege('service_role',v_receipt_oid,'EXECUTE')
     or public.hotel_v2_seven_arches_pricing_activation_current_is_safe()
       is not true then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_recursion_installation_failed';
  end if;
  v_source:=(select prosrc from pg_proc where oid=v_admin_d_oid);
  if (length(v_source)-length(replace(v_source,
       'v_h3:=public.hotel_v2_h3_1p_pricing_promotion_snapshot_inert_core(c_hotel);','')))
       /length('v_h3:=public.hotel_v2_h3_1p_pricing_promotion_snapshot_inert_core(c_hotel);')<>1
     or position(
       'v_h3:=public.hotel_v2_h3_1p_pricing_promotion_snapshot(c_hotel);' in v_source)<>0 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_recursion_admin_d_postcondition_failed';
  end if;
  v_source:=(select prosrc from pg_proc where oid=v_receipt_oid);
  if (length(v_source)-length(replace(v_source,
       'v_canonical:=public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot();','')))
       /length('v_canonical:=public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot();')<>1
     or exists(select 1 from unnest(array[
       'hotel_v2_admin_d_current_foundation_snapshot',
       'hotel_v2_seven_arches_task2_stage2_compatibility_is_exact',
       'hotel_v2_external_calendar_stage2_compatible_fingerprints',
       'hotel_v2_seven_arches_pricing_activation_snapshot',
       'hotel_v2_seven_arches_pricing_activation_state_is_exact',
       'hotel_v2_h3_1p_pricing_promotion_snapshot',
       'hotel_v2_seven_arches_pricing_activation_current_is_safe',
       'hotel_v2_seven_arches_pricing_activation_receipt_is_exact'
     ]) forbidden(name) where v_source~(
       '(:=[[:space:]]*|perform[[:space:]]+|select[[:space:]]+|return[[:space:]]+'||
       '|if[[:space:]]+|and[[:space:]]+|or[[:space:]]+)public[.]'||
       forbidden.name||'[(]')) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_recursion_receipt_postcondition_failed';
  end if;
end
$seven_arches_pricing_activation_recursion_postconditions$;

notify pgrst,'reload schema';
commit;
