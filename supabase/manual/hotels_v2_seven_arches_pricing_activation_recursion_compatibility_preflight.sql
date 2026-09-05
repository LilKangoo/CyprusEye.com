-- Read-only preflight for 114405.  This seam is intentionally installable
-- only after 114400 and before the first reviewed activation Apply.
begin;
set transaction read only;
set local statement_timeout='120s';

do $preflight$
declare
  v_admin_d_oid oid:=to_regprocedure(
    'public.hotel_v2_admin_d_current_foundation_snapshot()');
  v_receipt_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()');
  v_task2_validator_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()');
  v_projector_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()');
  v_scoped_lineage_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_pricing_scoped_lineage()');
  v_transaction_preservation_oid oid:=to_regprocedure(
    'public.hotel_v2_7a_pricing_activation_transaction_is_preserved()');
  v_apply_oid oid:=to_regprocedure(
    'public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text)');
  v_activation_immutable_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_pricing_activation_immutable()');
  v_activation_insert_guard_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_pricing_activation_evolution_insert_guard()');
  v_review_guard_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_pricing_activation_review_guard()');
  v_inert_oid oid:=to_regprocedure(
    'public.hotel_v2_h3_1p_pricing_promotion_snapshot_inert_core(uuid)');
  v_activation_fingerprints_oid oid:=to_regprocedure(
    'public.hotel_v2_external_calendar_activation_function_fingerprints()');
  v_immutable_oid oid:=to_regprocedure(
    'public.hotel_v2_h3_2a_reject_immutable_change()');
  v_admin_d_source text;
  v_receipt_source text;
  v_canonical jsonb;
  v_scoped_lineage jsonb;
  v_task2_stage2
    public.hotel_seven_arches_task2_stage2_compatibility_receipts%rowtype;
begin
  if v_admin_d_oid is null or v_receipt_oid is null or v_inert_oid is null
     or v_task2_validator_oid is null or v_projector_oid is null
     or v_scoped_lineage_oid is null or v_transaction_preservation_oid is null
     or v_apply_oid is null
     or v_activation_immutable_oid is null
     or v_activation_insert_guard_oid is null or v_review_guard_oid is null
     or v_activation_fingerprints_oid is null or v_immutable_oid is null
     or to_regprocedure(
       'public.hotel_v2_seven_arches_pricing_activation_current_is_safe()') is null
     or to_regprocedure(
       'public.hotel_v2_external_calendar_stage2_compatible_fingerprints()') is null
     or to_regprocedure(
       'public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()') is null
     or to_regprocedure(
       'public.hotel_v2_partner_workspace_function_lineage_is_exact()') is null
     or to_regprocedure(
       'public.hotel_v2_seven_arches_pricing_activation_immutable()') is null
     or to_regprocedure(
       'public.hotel_v2_seven_arches_pricing_activation_evolution_insert_guard()') is null
     or to_regclass(
       'public.hotel_seven_arches_pricing_activation_evolution_receipts') is null
     or to_regclass(
       'public.hotel_admin_availability_foundation_evolution_receipts') is null
     or to_regclass(
       'public.hotel_partner_property_proposal_foundation_receipts') is null
     or to_regclass(
       'public.hotel_seven_arches_task2_stage2_compatibility_receipts') is null
     or to_regclass(
       'hotels_v2_private.hotel_external_calendar_activation_receipts') is null then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_recursion_preflight_dependency_missing';
  end if;
  if (select count(*)
      from public.hotel_seven_arches_pricing_activation_evolution_receipts)<>0 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_recursion_preflight_activation_already_present';
  end if;
  if to_regclass(
       'public.hotel_seven_arches_independent_pricing_evolution_receipts') is not null
     or to_regprocedure(
       'public.hotel_v2_external_calendar_site_settings_fingerprint()') is not null
     or to_regclass(
       'hotels_v2_private.hotel_external_calendar_provider_evolution_receipts') is not null then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_recursion_preflight_order_mismatch';
  end if;
  if (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_admin_d_oid)<>
         '686ef8d305ba401d52c2e2f5ed9f41036a6418beb785144da52a857c4640c32a'
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_receipt_oid)<>
         '3cc4d17d0703e29b12df8e6f3e7f24263c1af32bbe09df8928283db100b67b9e'
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_task2_validator_oid)<>
         '0a6255e457f0912452949966e47e29a0ce0f6cda3e85c53b999343f9b68c3a95'
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_projector_oid)<>
         'e42b5b7cabecd6e7ec7a847796983e497572f9f8fc0802f642fdc6b995d84ac3'
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_scoped_lineage_oid)<>
         '655a7f0c9c535036a767e88929e8772bcb03ec2a4274766a5e67b998f0f16c8d'
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_transaction_preservation_oid)<>
         '54b3d6baea7b5b99330b2cb6cdb212314d80e41da75a9ab8f800bc7dab215fdb'
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_apply_oid)<>
         'b85e47c8e5a61832dbbc909fb120d38d965d0077914f2d8009249ca9a8ffb3f6'
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_activation_immutable_oid)<>
         '4b3e5ff853a0b8f2e21dd4d18359f8a92614f298d33e7cb9223e9b6aca31fc87'
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_activation_insert_guard_oid)<>
         '220afcdf846be8b91b554acb5054364126bc7adb1aa085d1bd86ac149985bdb7'
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_review_guard_oid)<>
         '23ff92a30533948004130655e1e81b79386f1416afdd413c38816b0573220758'
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_inert_oid)<>
         '190b30e05c95e7220f800284b6408659f21172dba48161163e2a364c40aa95a5'
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_activation_fingerprints_oid)<>
         'fa6ae9122ad73f57be91c611177eb562b90b09ca9620b98d9f494abafcf3a914'
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_immutable_oid)<>
         '5ab5f8fec4515a0eb0e4da1a4de9f765618f45feb0dfe581e0f2a0e9d0a9ef6c' then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_recursion_preflight_source_mismatch';
  end if;
  if exists(select 1 from (values
      (v_admin_d_oid,true,'s'::"char",array['search_path=pg_catalog, public']::text[]),
      (v_receipt_oid,true,'s'::"char",array['search_path=pg_catalog, public']::text[]),
      (v_task2_validator_oid,true,'s'::"char",
        array['search_path=pg_catalog, public']::text[]),
      (v_projector_oid,true,'s'::"char",
        array['search_path=pg_catalog, public']::text[]),
      (v_scoped_lineage_oid,true,'s'::"char",
        array['search_path=pg_catalog, public']::text[]),
      (v_transaction_preservation_oid,true,'s'::"char",
        array['search_path=pg_catalog, public']::text[]),
      (v_activation_immutable_oid,true,'v'::"char",
        array['search_path=pg_catalog']::text[]),
      (v_activation_insert_guard_oid,true,'v'::"char",
        array['search_path=pg_catalog, public']::text[]),
      (v_review_guard_oid,true,'v'::"char",
        array['search_path=pg_catalog, public, auth']::text[]),
      (v_inert_oid,false,'s'::"char",array['search_path=pg_catalog, public']::text[]),
      (v_activation_fingerprints_oid,true,'s'::"char",
        array['search_path=pg_catalog, public']::text[]),
      (v_immutable_oid,false,'v'::"char",
        array['search_path=pg_catalog, public']::text[])
    ) expected(oid,security_definer,volatility,path)
    left join pg_proc procedure_row on procedure_row.oid=expected.oid
    where procedure_row.oid is null
      or procedure_row.proowner<>'postgres'::regrole
      or procedure_row.prosecdef is distinct from expected.security_definer
      or procedure_row.provolatile is distinct from expected.volatility
      or procedure_row.proconfig is distinct from expected.path
      or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
      or has_function_privilege('service_role',procedure_row.oid,'EXECUTE')) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_recursion_preflight_security_mismatch';
  end if;
  if not exists(select 1 from pg_proc procedure_row where procedure_row.oid=v_apply_oid
       and procedure_row.proowner='postgres'::regrole and procedure_row.prosecdef
       and procedure_row.provolatile='v'
       and procedure_row.proconfig=
         array['search_path=pg_catalog, public, auth']::text[]
       and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
       and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
       and has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
       and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE')) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_recursion_preflight_apply_security_mismatch';
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
     or (select count(*)
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
       and trigger_row.tgfoid=v_immutable_oid and trigger_row.tgtype=27
       and trigger_row.tgenabled='O' and not trigger_row.tgisinternal)
     or exists(select 1 from (values
       ('public.hotel_seven_arches_pricing_activation_evolution_receipts'::regclass),
       ('public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass),
       ('hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass)
     ) protected(relation_oid)
     cross join unnest(array[
       'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
     ]) privilege(name)
     where has_table_privilege(0::oid,protected.relation_oid,privilege.name)
       or has_table_privilege('anon',protected.relation_oid,privilege.name)
       or has_table_privilege('authenticated',protected.relation_oid,privilege.name)
       or has_table_privilege('service_role',protected.relation_oid,privilege.name))
     or public.hotel_v2_partner_workspace_function_lineage_is_exact() is not true then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_recursion_preflight_receipt_topology_mismatch';
  end if;
  if (select count(*)
      from public.hotel_seven_arches_task2_stage2_compatibility_receipts)<>1 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_recursion_preflight_task2_receipt_count_mismatch';
  end if;
  if not coalesce((
    exists(select 1 from pg_class relation where relation.oid=
      'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
      and relation.relowner='postgres'::regrole and relation.relrowsecurity)
    and (select count(*) from pg_attribute attribute where attribute.attrelid=
      'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
      and attribute.attnum>0 and not attribute.attisdropped)=10
    and not exists(select 1 from (values
      (1::smallint,'id','smallint',true,null::text),
      (2::smallint,'contract_version','text',true,null::text),
      (3::smallint,'canonical_task2_protected_fingerprints','jsonb',true,null::text),
      (4::smallint,'canonical_task2_protected_fingerprint','text',true,null::text),
      (5::smallint,'canonical_stage2_protected_fingerprints','jsonb',true,null::text),
      (6::smallint,'canonical_stage2_protected_fingerprint','text',true,null::text),
      (7::smallint,'scoped_lineage_source_hash','text',true,null::text),
      (8::smallint,'canonical_snapshot_source_hash','text',true,null::text),
      (9::smallint,'validator_source_hash','text',true,null::text),
      (10::smallint,'created_at','timestamp with time zone',true,'clock_timestamp()')
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
        'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass)=10
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
      (7::smallint,'scoped_lineage_source_hash'),
      (8::smallint,'canonical_snapshot_source_hash'),
      (9::smallint,'validator_source_hash')
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
      and trigger_row.tgfoid=v_activation_immutable_oid
      and trigger_row.tgtype=27 and trigger_row.tgenabled='O'
      and not trigger_row.tgisinternal)),false) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_recursion_preflight_task2_catalog_mismatch';
  end if;
  select * into strict v_task2_stage2
  from public.hotel_seven_arches_task2_stage2_compatibility_receipts where id=1;
  v_canonical:=public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot();
  v_scoped_lineage:=public.hotel_v2_seven_arches_pricing_scoped_lineage();
  v_admin_d_source:=pg_get_functiondef(v_admin_d_oid);
  v_receipt_source:=pg_get_functiondef(v_receipt_oid);
  if (length(v_admin_d_source)-length(replace(v_admin_d_source,
       'v_h3:=public.hotel_v2_h3_1p_pricing_promotion_snapshot(c_hotel);','')))
       /length('v_h3:=public.hotel_v2_h3_1p_pricing_promotion_snapshot(c_hotel);')<>1
     or position(
       'v_h3:=public.hotel_v2_h3_1p_pricing_promotion_snapshot_inert_core(c_hotel);'
       in v_admin_d_source)<>0
     or (length(v_receipt_source)-length(replace(v_receipt_source,
       'v_canonical:=public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot();','')))
       /length('v_canonical:=public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot();')<>0
     or (length(v_receipt_source)-length(replace(v_receipt_source,
       'v_scoped_lineage:=public.hotel_v2_seven_arches_pricing_scoped_lineage();','')))
       /length('v_scoped_lineage:=public.hotel_v2_seven_arches_pricing_scoped_lineage();')<>1
     or position('v_expected_baseline_delta_keys' in v_receipt_source)<>0
     or position('v_task2_baseline_delta_keys' in v_receipt_source)<>0
     or position('v_stage2_baseline_delta_keys' in v_receipt_source)<>0
     or position(
       'v_task2_stage2.canonical_task2_protected_fingerprints is distinct from'
       in v_receipt_source)<>0
     or position(
       'v_task2_stage2.canonical_stage2_protected_fingerprints is distinct from'
       in v_receipt_source)<>0
     or position(
       'v_current_stage2:=public.hotel_v2_external_calendar_stage2_compatible_fingerprints();'
       in v_receipt_source)<>0
     or (length(v_receipt_source)-length(replace(v_receipt_source,
       'and public.hotel_v2_seven_arches_pricing_activation_state_is_exact()),false);','')))
       /length('and public.hotel_v2_seven_arches_pricing_activation_state_is_exact()),false);')<>1 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_recursion_preflight_call_graph_mismatch';
  end if;
  if public.hotel_v2_seven_arches_pricing_activation_current_is_safe() is not true
     or public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact() is not true
     or jsonb_typeof(v_scoped_lineage) is distinct from 'object'
     or v_scoped_lineage->>'contract_version' is distinct from
       'hotels_v2_seven_arches_pricing_scoped_lineage_v1'
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
     or v_task2_stage2.contract_version is distinct from
       'hotels_v2_seven_arches_task2_stage2_compatibility_v1'
     or v_task2_stage2.created_at is null or not isfinite(v_task2_stage2.created_at)
     or v_task2_stage2.canonical_task2_protected_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(
         v_task2_stage2.canonical_task2_protected_fingerprints)
     or v_task2_stage2.canonical_stage2_protected_fingerprint is distinct from
       public.hotel_v2_external_calendar_worker_hash(
         v_task2_stage2.canonical_stage2_protected_fingerprints)
     or v_task2_stage2.scoped_lineage_source_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(v_scoped_lineage_oid)))
     or v_task2_stage2.canonical_snapshot_source_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(v_projector_oid)))
     or v_task2_stage2.validator_source_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(v_task2_validator_oid))) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_recursion_preflight_baseline_drift';
  end if;
end
$preflight$;

select
  'HOTELS_V2_7A_PRICING_ACTIVATION_RECURSION_PREFLIGHT_OK' sentinel,
  (select count(*)
    from public.hotel_seven_arches_pricing_activation_evolution_receipts)
      activation_receipt_count,
  (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
    from pg_proc where oid=to_regprocedure(
      'public.hotel_v2_admin_d_current_foundation_snapshot()')) admin_d_source_hash,
  (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
    from pg_proc where oid=to_regprocedure(
      'public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()'))
      receipt_validator_source_hash,
  public.hotel_v2_seven_arches_pricing_activation_current_is_safe() ready;
rollback;
