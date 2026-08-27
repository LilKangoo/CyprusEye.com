-- Read-only verification for the installed 114425 Hotels-only site-settings
-- compatibility seam.
begin;
set transaction read only;
set local statement_timeout='120s';

do $verify$
declare
  v_oid oid:=to_regprocedure(
    'public.hotel_v2_external_calendar_site_settings_fingerprint()');
  v_expected text;
  v_expected_source_hash constant text:=
    'e297f1b640f544644d695b36b4aca0b2dc90385e83709e8a494044aabc3b95bd';
begin
  if v_oid is null
     or to_regclass('public.site_settings') is null
     or to_regclass(
       'hotels_v2_private.hotel_external_calendar_activation_receipts') is null
     or to_regprocedure('public.hotel_v2_external_calendar_worker_hash(jsonb)') is null
     or to_regprocedure(
       'public.hotel_v2_external_calendar_activation_function_fingerprints()') is null
     or to_regprocedure(
       'public.hotel_v2_partner_workspace_function_lineage_is_exact()') is null
     or to_regprocedure('public.hotel_v2_h3_2a_reject_immutable_change()') is null then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_site_settings_verify_foundation_missing';
  end if;

  if (select proowner from pg_proc where oid=v_oid)<>'postgres'::regrole
     or (select prosecdef from pg_proc where oid=v_oid) is distinct from true
     or (select proconfig from pg_proc where oid=v_oid)
       is distinct from array['search_path=pg_catalog, public']::text[]
     or has_function_privilege(0::oid,v_oid,'EXECUTE')
     or has_function_privilege('anon',v_oid,'EXECUTE')
     or has_function_privilege('authenticated',v_oid,'EXECUTE')
     or has_function_privilege('service_role',v_oid,'EXECUTE')
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_oid) is distinct from v_expected_source_hash then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_site_settings_verify_helper_security_mismatch';
  end if;

  if exists(select 1 from (values
      ('public.hotel_v2_external_calendar_worker_hash(jsonb)',true,
        array['search_path=pg_catalog']::text[],
        'd60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828'),
      ('public.hotel_v2_external_calendar_activation_function_fingerprints()',true,
        array['search_path=pg_catalog, public']::text[],
        'fa6ae9122ad73f57be91c611177eb562b90b09ca9620b98d9f494abafcf3a914'),
      ('public.hotel_v2_partner_workspace_function_lineage_is_exact()',true,
        array['search_path=pg_catalog, public']::text[],
        'dde4fac2d044a53bb713cced26ca93c8295548c9bde3717d0ea83dc511801a85'),
      ('public.hotel_v2_h3_2a_reject_immutable_change()',false,
        array['search_path=pg_catalog, public']::text[],
        '5ab5f8fec4515a0eb0e4da1a4de9f765618f45feb0dfe581e0f2a0e9d0a9ef6c')
    ) expected(signature,security_definer,path,source_hash)
    left join pg_proc procedure_row
      on procedure_row.oid=to_regprocedure(expected.signature)
    where procedure_row.oid is null
      or procedure_row.proowner<>'postgres'::regrole
      or procedure_row.prosecdef is distinct from expected.security_definer
      or procedure_row.proconfig is distinct from expected.path
      or encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')
        is distinct from expected.source_hash
      or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
      or has_function_privilege('service_role',procedure_row.oid,'EXECUTE')) then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_site_settings_verify_frozen_function_security_mismatch';
  end if;

  if (select count(*) from public.site_settings)<>1
     or not exists(select 1 from public.site_settings setting where setting.id=1
       and setting.hotel_rooms_v2_enabled is not distinct from false
       and (setting.hotel_external_sync_enabled is not distinct from false
         or setting.hotel_external_sync_enabled is not distinct from true)
       and setting.hotel_instant_booking_enabled is not distinct from false
       and setting.hotel_stripe_connect_enabled is not distinct from false) then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_site_settings_verify_unsupported_hotels_lifecycle';
  end if;

  if (select count(*)
      from hotels_v2_private.hotel_external_calendar_activation_receipts)<>1
     or not exists(select 1
       from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
       where receipt.id=1
         and (receipt.site_settings_without_external_fingerprint
           ~'^[0-9a-f]{64}$') is not distinct from true
         and jsonb_typeof(receipt.compatibility_function_fingerprints)
           is not distinct from 'object'
         and receipt.created_at is not null
         and isfinite(receipt.created_at)) then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_site_settings_verify_activation_receipt_envelope_mismatch';
  end if;

  -- The type guard above must complete before either object iterator runs.
  if not exists(select 1
       from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
       where receipt.id=1
         and (select count(*) from jsonb_object_keys(
           receipt.compatibility_function_fingerprints))=20
         and (receipt.compatibility_function_fingerprints ?& array[
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
         ]::text[]) is not distinct from true
         and not exists(select 1 from jsonb_each_text(
           receipt.compatibility_function_fingerprints) fingerprint(signature,value)
           where (fingerprint.value~'^[0-9a-f]{64}$') is distinct from true))
     or not exists(select 1 from pg_class relation
       where relation.oid=
         'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
         and relation.relowner='postgres'::regrole)
     or (select count(*) from pg_attribute attribute
       where attribute.attrelid=
         'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
         and attribute.attnum>0 and not attribute.attisdropped)<>4
     or exists(select 1 from (values
        (1::smallint,'id','smallint',true,null::text),
        (2::smallint,'site_settings_without_external_fingerprint','text',true,null::text),
        (3::smallint,'compatibility_function_fingerprints','jsonb',true,null::text),
        (4::smallint,'created_at','timestamp with time zone',true,'clock_timestamp()')
       ) expected(attnum,attname,type_name,not_null,default_expression)
       left join pg_attribute attribute on attribute.attrelid=
         'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
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
     or (select count(*) from pg_constraint constraint_row where
       constraint_row.conrelid=
         'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass)<>4
     or (select count(*) from pg_constraint constraint_row
       join pg_index index_row on index_row.indexrelid=constraint_row.conindid
       where constraint_row.conrelid=
           'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
         and constraint_row.contype='p' and constraint_row.convalidated
         and constraint_row.conkey=array[1]::smallint[]
         and pg_get_constraintdef(constraint_row.oid)='PRIMARY KEY (id)'
         and index_row.indisprimary and index_row.indisunique
         and index_row.indisvalid and index_row.indisready)<>1
     or (select count(*) from pg_constraint constraint_row where
       constraint_row.conrelid=
           'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
         and constraint_row.contype='c' and constraint_row.convalidated
         and not constraint_row.connoinherit
         and constraint_row.conkey=array[1]::smallint[]
         and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
           '[[:space:]]+','','g')='(id=1)')<>1
     or (select count(*) from pg_constraint constraint_row where
       constraint_row.conrelid=
           'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
         and constraint_row.contype='c' and constraint_row.convalidated
         and not constraint_row.connoinherit
         and constraint_row.conkey=array[2]::smallint[]
         and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
           '[[:space:]]+','','g')=
           '(site_settings_without_external_fingerprint~''^[0-9a-f]{64}$''::text)')<>1
     or (select count(*) from pg_constraint constraint_row where
       constraint_row.conrelid=
           'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
         and constraint_row.contype='c' and constraint_row.convalidated
         and not constraint_row.connoinherit
         and constraint_row.conkey=array[3]::smallint[]
         and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
           '[[:space:]]+','','g')=
           '(jsonb_typeof(compatibility_function_fingerprints)=''object''::text)')<>1
     or exists(select 1 from pg_policy policy where policy.polrelid=
       'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass)
     or not exists(select 1 from pg_trigger trigger_row
       where trigger_row.tgrelid=
         'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
         and trigger_row.tgname='hotel_external_calendar_activation_receipt_immutable'
         and trigger_row.tgfoid=
           'public.hotel_v2_h3_2a_reject_immutable_change()'::regprocedure
         and trigger_row.tgtype=27 and not trigger_row.tgisinternal
         and trigger_row.tgenabled='O')
     or exists(select 1
       from unnest(array[
         'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
       ]) privilege(name)
       where has_table_privilege(0::oid,
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
     or not exists(select 1 from pg_namespace namespace_row
       where namespace_row.oid='hotels_v2_private'::regnamespace
         and namespace_row.nspowner='postgres'::regrole)
     or has_schema_privilege(0::oid,'hotels_v2_private','USAGE')
     or has_schema_privilege('anon','hotels_v2_private','USAGE')
     or has_schema_privilege('service_role','hotels_v2_private','USAGE')
     or has_schema_privilege(0::oid,'hotels_v2_private','CREATE')
     or has_schema_privilege('anon','hotels_v2_private','CREATE')
     or has_schema_privilege('authenticated','hotels_v2_private','CREATE')
     or has_schema_privilege('service_role','hotels_v2_private','CREATE') then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_site_settings_verify_activation_receipt_integrity_mismatch';
  end if;

  if public.hotel_v2_partner_workspace_function_lineage_is_exact()
       is distinct from true then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_site_settings_verify_current_stage2f_lineage_mismatch';
  end if;

  v_expected:=public.hotel_v2_external_calendar_worker_hash(jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_site_settings_lifecycle_v2',
    'id',1,
    'hotel_rooms_v2_enabled',false,
    'hotel_external_sync_enabled_supported_values',jsonb_build_array(false,true),
    'hotel_instant_booking_enabled',false,
    'hotel_stripe_connect_enabled',false));
  if v_expected is null
     or public.hotel_v2_external_calendar_site_settings_fingerprint()
       is distinct from v_expected then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_site_settings_verify_canonical_fingerprint_mismatch';
  end if;
end
$verify$;

select
  'hotels_v2_external_calendar_site_settings_compatibility_verify_v2'
    contract_version,
  setting.hotel_rooms_v2_enabled,
  setting.hotel_external_sync_enabled,
  setting.hotel_instant_booking_enabled,
  setting.hotel_stripe_connect_enabled,
  true supported_hotels_lifecycle,
  (select count(*)::integer
    from hotels_v2_private.hotel_external_calendar_activation_receipts)
    activation_receipt_count,
  true activation_receipt_historical_integrity,
  true frozen_function_security_exact,
  (public.hotel_v2_partner_workspace_function_lineage_is_exact() is true)
    current_stage2f_function_lineage_exact,
  (setting.hotel_external_sync_enabled is true) stage2f_activation_required,
  case when setting.hotel_external_sync_enabled is true
    then 'activation_lineage' else 'readiness_evidence' end
    activation_receipt_role,
  (setting.hotel_external_sync_enabled is false
    or public.hotel_v2_partner_workspace_function_lineage_is_exact() is true)
    external_activation_requirement_met,
  public.hotel_v2_external_calendar_site_settings_fingerprint()
    canonical_fingerprint,
  true verified
from public.site_settings setting where setting.id=1;

commit;
