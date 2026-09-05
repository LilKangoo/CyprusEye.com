-- Read-only post-Apply verifier for the 114405 acyclic seam with the
-- additive 114406 transport-stable reviewed-plan fingerprint contract.
begin;
set transaction read only;
set local statement_timeout='120s';

do $verify$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_admin_d_hash constant text:=
    '2ed412e46a827c3b57b570f3c6675edc5d1a92562fb8acb59b7148b245ed592a';
  c_receipt_hash constant text:=
    '2829ec9059a4e035344ed35d26c7cac1d12c7296fd91ab498c7df78aa8f13dee';
  c_inert_hash constant text:=
    '190b30e05c95e7220f800284b6408659f21172dba48161163e2a364c40aa95a5';
  c_canonical_json_hash constant text:=
    '34a597ce33e7340b4c3779ecf60286abc51aa67661954a9b616a9f2af2eb0e06';
  c_plan_fingerprint_hash constant text:=
    '17f80cd334cfd5aeeef64b620dcf4785a5a662e1a1a0e64696516f86c778ffe0';
  c_preview_hash constant text:=
    'c75f83699e6d8c1c8234dbd6fec8a81dd2a337e9e193289df39f7a730b9014fd';
  c_apply_hash constant text:=
    '786485c7a27574feda2f2c6716c8ea4c755795f3f2eea8ab2153d91e4c2c44ef';
  c_review_guard_hash constant text:=
    '9d2376f4f1f8e035ffd93818ab382b1e2858dd10b38688fe8a31d3fc5845278c';
  v_admin_d_oid oid:=to_regprocedure(
    'public.hotel_v2_admin_d_current_foundation_snapshot()');
  v_receipt_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()');
  v_inert_oid oid:=to_regprocedure(
    'public.hotel_v2_h3_1p_pricing_promotion_snapshot_inert_core(uuid)');
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
  v_preview_oid oid:=to_regprocedure(
    'public.hotel_v2_admin_preview_seven_arches_pricing_activation(jsonb)');
  v_canonical_json_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_pricing_activation_canonical_json(jsonb)');
  v_plan_fingerprint_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_pricing_activation_plan_fingerprint(jsonb)');
  v_activation_immutable_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_pricing_activation_immutable()');
  v_activation_insert_guard_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_pricing_activation_evolution_insert_guard()');
  v_review_guard_oid oid:=to_regprocedure(
    'public.hotel_v2_seven_arches_pricing_activation_review_guard()');
  v_admin_d jsonb;
  v_activation jsonb;
  v_canonical jsonb;
  v_scoped_lineage jsonb;
  v_promotion jsonb;
  v_source text;
  v_pricing_receipt
    public.hotel_seven_arches_pricing_activation_evolution_receipts%rowtype;
  v_task2_stage2
    public.hotel_seven_arches_task2_stage2_compatibility_receipts%rowtype;
begin
  if v_admin_d_oid is null or v_receipt_oid is null or v_inert_oid is null
     or v_task2_validator_oid is null or v_projector_oid is null
     or v_scoped_lineage_oid is null or v_transaction_preservation_oid is null
     or v_apply_oid is null or v_preview_oid is null
     or v_canonical_json_oid is null or v_plan_fingerprint_oid is null
     or v_activation_immutable_oid is null
     or v_activation_insert_guard_oid is null or v_review_guard_oid is null
     or to_regprocedure(
       'public.hotel_v2_seven_arches_pricing_activation_current_is_safe()') is null
     or to_regprocedure(
       'public.hotel_v2_seven_arches_pricing_activation_snapshot()') is null
     or to_regprocedure(
       'public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()') is null
     or to_regprocedure(
       'public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid)') is null
     or to_regclass(
       'public.hotel_seven_arches_pricing_activation_evolution_receipts') is null
     or to_regclass(
       'public.hotel_seven_arches_task2_stage2_compatibility_receipts') is null then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_recursion_verify_dependency_missing';
  end if;
  if (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_admin_d_oid)<>c_admin_d_hash
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_receipt_oid)<>c_receipt_hash
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_inert_oid)<>c_inert_hash
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_canonical_json_oid)<>c_canonical_json_hash
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_plan_fingerprint_oid)<>c_plan_fingerprint_hash then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_recursion_verify_source_mismatch';
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
      (v_canonical_json_oid,true,'i'::"char",
        array['search_path=pg_catalog, public']::text[]),
      (v_plan_fingerprint_oid,true,'i'::"char",
        array['search_path=pg_catalog, public']::text[]),
      (v_inert_oid,false,'s'::"char",array['search_path=pg_catalog, public']::text[])
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
      message='hotels_v2_seven_arches_pricing_activation_recursion_verify_security_mismatch';
  end if;
  if (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_task2_validator_oid) is distinct from
         '0a6255e457f0912452949966e47e29a0ce0f6cda3e85c53b999343f9b68c3a95'
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_projector_oid) is distinct from
         'e42b5b7cabecd6e7ec7a847796983e497572f9f8fc0802f642fdc6b995d84ac3'
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_scoped_lineage_oid) is distinct from
         '5d8e31185a165c555c2fcfcce2802fe569bb7cc201ddfb7ac91978acfa2e3141'
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_transaction_preservation_oid) is distinct from
         '54b3d6baea7b5b99330b2cb6cdb212314d80e41da75a9ab8f800bc7dab215fdb'
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_activation_immutable_oid) is distinct from
         '4b3e5ff853a0b8f2e21dd4d18359f8a92614f298d33e7cb9223e9b6aca31fc87'
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=v_activation_insert_guard_oid) is distinct from
         '220afcdf846be8b91b554acb5054364126bc7adb1aa085d1bd86ac149985bdb7'
     or exists(select 1 from (values
       (v_receipt_oid,c_receipt_hash,'s'::"char",
         array['search_path=pg_catalog, public']::text[],false),
       (v_review_guard_oid,c_review_guard_hash,'v'::"char",
         array['search_path=pg_catalog, public, auth']::text[],false),
       (v_preview_oid,c_preview_hash,'v'::"char",
         array['search_path=pg_catalog, public, auth']::text[],true),
       (v_apply_oid,c_apply_hash,'v'::"char",
         array['search_path=pg_catalog, public, auth']::text[],true),
       (v_canonical_json_oid,c_canonical_json_hash,'i'::"char",
         array['search_path=pg_catalog, public']::text[],false),
       (v_plan_fingerprint_oid,c_plan_fingerprint_hash,'i'::"char",
         array['search_path=pg_catalog, public']::text[],false)
     ) expected(oid,source_hash,volatility,path,authenticated_execute)
     left join pg_proc procedure_row on procedure_row.oid=expected.oid
     left join pg_language language_row on language_row.oid=procedure_row.prolang
     where procedure_row.oid is null
       or procedure_row.proowner<>'postgres'::regrole
       or language_row.lanname is distinct from 'plpgsql'
       or not procedure_row.prosecdef
       or procedure_row.provolatile is distinct from expected.volatility
       or procedure_row.proconfig is distinct from expected.path
       or encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),
         'sha256'),'hex') is distinct from expected.source_hash
       or procedure_row.proleakproof or procedure_row.proretset
       or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
       or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
       or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
         is distinct from expected.authenticated_execute
       or has_function_privilege('service_role',procedure_row.oid,'EXECUTE')) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_recursion_verify_lineage_mismatch';
  end if;
  v_source:=(select prosrc from pg_proc where oid=v_admin_d_oid);
  if (length(v_source)-length(replace(v_source,
       'v_h3:=public.hotel_v2_h3_1p_pricing_promotion_snapshot_inert_core(c_hotel);','')))
       /length('v_h3:=public.hotel_v2_h3_1p_pricing_promotion_snapshot_inert_core(c_hotel);')<>1
     or position(
       'v_h3:=public.hotel_v2_h3_1p_pricing_promotion_snapshot(c_hotel);' in v_source)<>0 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_recursion_verify_admin_d_edge_mismatch';
  end if;
  v_source:=(select prosrc from pg_proc where oid=v_receipt_oid);
  if (length(v_source)-length(replace(v_source,
       'v_canonical:=public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot();','')))
       /length('v_canonical:=public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot();')<>1
     or (length(v_source)-length(replace(v_source,
       'v_scoped_lineage:=public.hotel_v2_seven_arches_pricing_scoped_lineage();','')))
       /length('v_scoped_lineage:=public.hotel_v2_seven_arches_pricing_scoped_lineage();')<>1
     or position('v_expected_baseline_delta_keys' in v_source)<>0
     or position('v_task2_baseline_delta_keys' in v_source)<>0
     or position('v_stage2_baseline_delta_keys' in v_source)<>0
     or position(
       'v_task2_stage2.canonical_task2_protected_fingerprints is distinct from'
       in v_source)<>0
     or position(
       'v_task2_stage2.canonical_stage2_protected_fingerprints is distinct from'
       in v_source)<>0
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
      message='hotels_v2_seven_arches_pricing_activation_recursion_verify_receipt_edge_mismatch';
  end if;
  if (select count(*)
      from public.hotel_seven_arches_task2_stage2_compatibility_receipts)<>1
     or (select count(*) from pg_attribute attribute where attribute.attrelid=
       'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
       and attribute.attnum>0 and not attribute.attisdropped)<>10
     or (select count(*) from pg_constraint constraint_row where
       constraint_row.conrelid=
         'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass)<>10 then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_recursion_verify_task2_receipt_count_mismatch';
  end if;
  select * into strict v_task2_stage2
  from public.hotel_seven_arches_task2_stage2_compatibility_receipts where id=1;
  if (select count(*)
      from public.hotel_seven_arches_pricing_activation_evolution_receipts)<>1
     or not exists(select 1
       from public.hotel_seven_arches_pricing_activation_evolution_receipts receipt
       where receipt.id=1 and receipt.receipt_validator_source_hash=encode(
         extensions.digest(convert_to(pg_get_functiondef(v_receipt_oid),'UTF8'),'sha256'),'hex')) then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_recursion_verify_receipt_pin_mismatch';
  end if;
  select * into strict v_pricing_receipt
  from public.hotel_seven_arches_pricing_activation_evolution_receipts where id=1;

  -- These calls previously formed the recursive cycle.  Each must terminate
  -- under the statement timeout and agree on the exact active state.
  if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true
     or public.hotel_v2_seven_arches_pricing_activation_current_is_safe() is not true
     or public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()
       is not true
     or public.hotel_v2_7a_pricing_activation_transaction_is_preserved()
       is not true then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_recursion_verify_receipt_invalid';
  end if;
  v_activation:=public.hotel_v2_seven_arches_pricing_activation_snapshot();
  v_canonical:=public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot();
  v_scoped_lineage:=public.hotel_v2_seven_arches_pricing_scoped_lineage();
  v_admin_d:=public.hotel_v2_admin_d_current_foundation_snapshot();
  v_promotion:=public.hotel_v2_h3_1p_pricing_promotion_snapshot(c_hotel);
  if v_activation->>'status' is distinct from 'active'
     or jsonb_array_length(v_activation->'blocking_reasons')<>0
     or jsonb_typeof(v_canonical) is distinct from 'object'
     or jsonb_typeof(v_scoped_lineage) is distinct from 'object'
     or v_scoped_lineage->>'contract_version' is distinct from
       'hotels_v2_seven_arches_pricing_scoped_lineage_v1'
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
     or jsonb_typeof(v_canonical->'task2_protected_fingerprints')
       is distinct from 'object'
     or jsonb_typeof(v_canonical->'stage2_protected_fingerprints')
       is distinct from 'object'
     or v_canonical->>'task2_protected_fingerprint' is distinct from
       public.hotel_v2_h3_2b_hash(v_canonical->'task2_protected_fingerprints')
     or v_canonical->>'stage2_protected_fingerprint' is distinct from
       public.hotel_v2_external_calendar_worker_hash(
         v_canonical->'stage2_protected_fingerprints')
     or v_task2_stage2.id<>1
     or v_task2_stage2.contract_version is distinct from
       'hotels_v2_seven_arches_task2_stage2_compatibility_v1'
     or v_task2_stage2.created_at is null or not isfinite(v_task2_stage2.created_at)
     or v_pricing_receipt.before_protected_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(v_pricing_receipt.before_protected_fingerprints)
     or v_pricing_receipt.after_protected_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(v_pricing_receipt.after_protected_fingerprints)
     or (v_pricing_receipt.after_protected_fingerprints-
         v_pricing_receipt.allowed_fingerprint_keys) is distinct from
       (v_pricing_receipt.before_protected_fingerprints-
         v_pricing_receipt.allowed_fingerprint_keys)
     or v_pricing_receipt.before_stage2_protected_fingerprint is distinct from
       public.hotel_v2_external_calendar_worker_hash(
         v_pricing_receipt.before_stage2_protected_fingerprints)
     or v_pricing_receipt.after_stage2_protected_fingerprint is distinct from
       public.hotel_v2_external_calendar_worker_hash(
         v_pricing_receipt.after_stage2_protected_fingerprints)
     or (v_pricing_receipt.after_stage2_protected_fingerprints-
         v_pricing_receipt.stage2_allowed_fingerprint_keys) is distinct from
       (v_pricing_receipt.before_stage2_protected_fingerprints-
         v_pricing_receipt.stage2_allowed_fingerprint_keys)
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
       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(v_task2_validator_oid)))
     or v_admin_d->>'contract_version' is distinct from
       'hotels_v2_admin_d_current_foundation_v1'
     or v_admin_d->>'original_receipt_intact' is distinct from 'true'
     or v_admin_d->>'seven_arches_assignment_exact' is distinct from 'true'
     or v_admin_d->>'seven_arches_owner_preset_exact' is distinct from 'true'
     or v_admin_d->>'audit_chain_exact' is distinct from 'true'
     or v_promotion->>'supported' is distinct from 'true'
     or v_promotion#>>'{activation,status}' is distinct from 'active'
     or v_promotion#>>'{safety,reviewed_activation_exact}' is distinct from 'true'
     or v_promotion#>>'{parity,total_case_count}' is distinct from '70'
     or v_promotion#>>'{parity,total_mismatch_count}' is distinct from '0' then
    raise exception using errcode='55000',
      message='hotels_v2_seven_arches_pricing_activation_recursion_verify_acyclic_state_mismatch';
  end if;
end
$verify$;

select
  'HOTELS_V2_7A_PRICING_ACTIVATION_RECURSION_VERIFY_OK' sentinel,
  public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() receipt_exact,
  public.hotel_v2_seven_arches_pricing_activation_current_is_safe() current_safe,
  (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
    from pg_proc where oid=to_regprocedure(
      'public.hotel_v2_admin_d_current_foundation_snapshot()')) admin_d_source_hash,
  (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
    from pg_proc where oid=to_regprocedure(
      'public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()'))
      receipt_validator_source_hash;
rollback;
