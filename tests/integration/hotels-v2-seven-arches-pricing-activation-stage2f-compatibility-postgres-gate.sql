\set ON_ERROR_STOP on
\if :{?stage2f_install_external_enabled}
\else
\set stage2f_install_external_enabled 1
\endif
\set provider_install_external_enabled :stage2f_install_external_enabled
\if :stage2f_install_external_enabled
\set stage2f_expected_external true
\else
\set stage2f_expected_external false
\endif
\set seven_arches_owner_live_drift_fixture 1
\ir hotels-v2-seven-arches-pricing-activation-postgres-base.sql
select set_config('test.stage2f_expected_external',
  :'stage2f_expected_external',false);

-- Production-style prerequisite: Task2 has been accepted in the selected
-- Stage2F OFF/ON state while unrelated mutable site_settings metadata has
-- moved past its immutable activation-era receipt.
begin;
do $accept_task2_before_pricing_activation$
declare
  c_partner constant uuid:='20000000-0000-4000-8000-000000000001';
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_workspace jsonb;
  v_preview jsonb;
  v_control jsonb;
  v_proposal jsonb;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  v_workspace:=public.hotel_v2_partner_get_workspace(
    c_partner,c_hotel,current_date,current_date+2);
  v_preview:=public.hotel_v2_partner_preview_content_plan(jsonb_build_object(
    'contract_version','hotels_v2_h3_2b_content_draft_v1',
    'partner_id',c_partner,'hotel_id',c_hotel,
    'access_snapshot_token',v_workspace#>>'{assignment,access_snapshot_token}',
    'content_snapshot_token',v_workspace->>'content_snapshot_token',
    'intent',jsonb_build_object(
      'entity','property_content','action','update','id',c_hotel,
      'payload',jsonb_build_object('title_i18n',jsonb_build_object(
        'pl','7 Łuków — Stage2F','en','7 Arches Stage2F',
        'he','7 קשתות Stage2F')),
      'reason','Task2 acceptance before focused Stage2F compatibility gate')));
  perform public.hotel_v2_partner_apply_content_plan(v_preview->'reviewed_plan',
    '39100000-0000-4000-8000-000000000001',
    '39100000-0000-4000-8000-000000000002');
  reset role;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_control:=public.hotel_v2_admin_get_partner_property_proposals(c_hotel);
  v_proposal:=v_control#>'{proposals,0}';
  v_preview:=public.hotel_v2_admin_preview_partner_property_proposal_plan(
    jsonb_build_object(
      'contract_version','hotels_v2_seven_arches_property_proposal_review_request_v1',
      'hotel_id',c_hotel,'proposal_id',v_proposal->'id',
      'proposal_version',v_proposal->'version','action','accept',
      'reason','Accept Task2 before focused Stage2F compatibility gate'));
  perform public.hotel_v2_admin_apply_partner_property_proposal_plan(
    v_preview->'reviewed_plan','39100000-0000-4000-8000-000000000003');
  reset role;

  -- A second legitimate metadata change occurs after 114370/Task2 acceptance
  -- and before 114400 captures its canonical compatibility receipt.
  update public.site_settings
    set force_refresh_version=force_refresh_version+1,
        updated_at=clock_timestamp()
    where id=1;

  if public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()
       is not true
     or not exists(select 1 from public.site_settings setting
       join hotels_v2_private.hotel_external_calendar_activation_receipts receipt
         on receipt.id=setting.id
       where setting.id=1
         and setting.hotel_external_sync_enabled is not distinct from
           current_setting('test.stage2f_expected_external')::boolean
         and setting.force_refresh_version=80
         and setting.car_multi_city_mapped_enabled
         and setting.car_threshold_daily_rates_enabled
         and receipt.site_settings_without_external_fingerprint is distinct from
           public.hotel_v2_external_calendar_worker_hash(
             to_jsonb(setting)-'hotel_external_sync_enabled')) then
    raise exception 'pricing_activation_stage2f_fixture_not_production_style';
  end if;
end
$accept_task2_before_pricing_activation$;
commit;

-- The critical assertion: 114400 itself must install in each independently
-- replayed Stage2F OFF/ON state while the immutable activation-era full-row
-- hash intentionally differs from the current row. This gate stops before
-- 114405.
\ir ../../supabase/migrations/20260811440000_hotels_v2_seven_arches_pricing_activation.sql

begin;
do $pricing_activation_stage2f_compatibility_gate$
declare
  v_failed boolean;
  v_message text;
  v_flag text;
  v_constraint text;
  v_probe record;
  v_probe_result boolean;
  v_probe_sqlstate text;
  v_probe_error text;
  v_previous_bulk_probe text;
  v_function_owner_42501_seen boolean:=false;
  v_function_owner_followup_restored boolean:=false;
  v_canonical jsonb;
  v_task2_receipt
    public.hotel_seven_arches_task2_stage2_compatibility_receipts%rowtype;
  v_negative_count integer:=0;
  v_projector_negative_count integer:=0;
  v_task2_receipt_negative_count integer:=0;
  v_validator_negative_count integer:=0;
begin
  v_canonical:=public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot();
  select * into strict v_task2_receipt
  from public.hotel_seven_arches_task2_stage2_compatibility_receipts where id=1;
  if (select count(*)
      from public.hotel_seven_arches_pricing_activation_evolution_receipts)<>0
     or public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()
       is not true
     or public.hotel_v2_seven_arches_pricing_activation_current_is_safe()
       is not true
     or not exists(select 1 from public.site_settings where id=1
       and hotel_external_sync_enabled is not distinct from
         current_setting('test.stage2f_expected_external')::boolean
       and not hotel_rooms_v2_enabled
       and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled)
     or (select validator_source_hash
       from public.hotel_seven_arches_task2_stage2_compatibility_receipts where id=1)
       is distinct from public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
         'public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()'::regprocedure)))
     or v_canonical is null
     or (select count(*) from jsonb_object_keys(v_canonical))<>7
     or not (v_canonical?&array['contract_version','site_settings_lifecycle',
       'site_settings_lifecycle_fingerprint','task2_protected_fingerprints',
       'task2_protected_fingerprint','stage2_protected_fingerprints',
       'stage2_protected_fingerprint'])
     or v_canonical->>'contract_version'<>
       'hotels_v2_seven_arches_task2_stage2_canonical_snapshot_v1'
     or v_canonical->'site_settings_lifecycle' is distinct from jsonb_build_object(
       'contract_version','hotels_v2_external_calendar_site_settings_lifecycle_v2',
       'id',1,'hotel_rooms_v2_enabled',false,
       'hotel_external_sync_enabled_supported_values',jsonb_build_array(false,true),
       'hotel_instant_booking_enabled',false,
       'hotel_stripe_connect_enabled',false)
     or v_canonical->>'site_settings_lifecycle_fingerprint' is distinct from
       public.hotel_v2_external_calendar_worker_hash(
         v_canonical->'site_settings_lifecycle')
     or v_task2_receipt.contract_version<>
       'hotels_v2_seven_arches_task2_stage2_compatibility_v1'
     or v_task2_receipt.created_at is null
     or not isfinite(v_task2_receipt.created_at)
     or v_task2_receipt.canonical_task2_protected_fingerprints is distinct from
       v_canonical->'task2_protected_fingerprints'
     or v_task2_receipt.canonical_task2_protected_fingerprint is distinct from
       public.hotel_v2_h3_2b_hash(
         v_task2_receipt.canonical_task2_protected_fingerprints)
     or v_task2_receipt.canonical_stage2_protected_fingerprints is distinct from
       v_canonical->'stage2_protected_fingerprints'
     or v_task2_receipt.canonical_stage2_protected_fingerprint is distinct from
       public.hotel_v2_external_calendar_worker_hash(
         v_task2_receipt.canonical_stage2_protected_fingerprints)
     or v_task2_receipt.canonical_snapshot_source_hash is distinct from
       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
         'public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()'::regprocedure)))
     or (select count(*) from pg_attribute attribute where attribute.attrelid=
       'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
       and attribute.attnum>0 and not attribute.attisdropped)<>9
     or exists(select 1 from (values
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
     or (select count(*) from pg_constraint constraint_row where
       constraint_row.conrelid=
         'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass)<>9
     or not exists(select 1 from pg_class relation where relation.oid=
       'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
       and relation.relowner='postgres'::regrole and relation.relrowsecurity)
     or exists(select 1 from pg_policy policy where policy.polrelid=
       'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass)
     or (select count(*) from pg_trigger trigger_row where trigger_row.tgrelid=
       'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
       and not trigger_row.tgisinternal)<>1
     or not exists(select 1 from pg_trigger trigger_row where trigger_row.tgrelid=
       'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
       and trigger_row.tgname=
         'hotel_seven_arches_task2_stage2_compatibility_receipt_immutable'
       and trigger_row.tgtype=27 and trigger_row.tgenabled='O'
       and not trigger_row.tgisinternal)
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=to_regprocedure(
         'public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()'))<>
       'c4860bf5c3eb4219a7fb19e386138fcae8b05292dd728d281c02c41eb9b7b8b9'
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=to_regprocedure(
         'public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()'))<>
       '1a14ec7b271861cc5bfc9a683d26e3ef2f2d8a88a86771915a34f503d8a2ff88'
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=to_regprocedure(
         'public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()'))<>
       'a794d528a3843009b65ba0927c508c8bf2b9f5ffdfce97f593ac81d6769526c6' then
    raise exception 'pricing_activation_stage2f_install_postcondition_failed';
  end if;

  -- Further unrelated mutable metadata drift must stay outside the lifecycle.
  v_failed:=false;
  begin
    update public.site_settings
      set car_multi_city_mapped_enabled=not car_multi_city_mapped_enabled,
          car_threshold_daily_rates_enabled=
            not car_threshold_daily_rates_enabled,
          force_refresh_version=force_refresh_version+1,
          updated_at=clock_timestamp(),
          updated_by='36000000-0000-4000-8000-000000000102'
      where id=1;
    if not exists(select 1 from public.site_settings where id=1
         and car_multi_city_mapped_enabled is not true
         and car_threshold_daily_rates_enabled is not true
         and force_refresh_version=81
         and updated_by='36000000-0000-4000-8000-000000000102'::uuid)
       or public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()
         is not true
       or public.hotel_v2_seven_arches_pricing_activation_current_is_safe()
         is not true then
      raise exception 'pricing_activation_stage2f_unrelated_drift_rejected';
    end if;
    raise exception 'pricing_activation_stage2f_drift_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_stage2f_drift_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()
       is not true then
    raise exception 'pricing_activation_stage2f_drift_probe_failed:%',v_message;
  end if;

  -- Each unsupported Hotels lifecycle flag fails closed independently.
  foreach v_flag in array array[
    'hotel_rooms_v2_enabled',
    'hotel_instant_booking_enabled',
    'hotel_stripe_connect_enabled'
  ] loop
    v_failed:=false;
    begin
      execute format('update public.site_settings set %I=true where id=1',v_flag);
      if public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact() then
        raise exception 'pricing_activation_stage2f_bad_flag_accepted:%',v_flag;
      end if;
      raise exception 'pricing_activation_stage2f_flag_probe_rollback:%',v_flag;
    exception when raise_exception then
      get stacked diagnostics v_message=message_text;
      v_failed:=v_message='pricing_activation_stage2f_flag_probe_rollback:'||v_flag;
    end;
    if not v_failed
       or public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()
         is not true then
      raise exception 'pricing_activation_stage2f_flag_probe_failed:%:%',
        v_flag,v_message;
    end if;
    v_negative_count:=v_negative_count+1;
  end loop;

  -- Receipt envelope corruption is rejected and rollback-contained.
  v_failed:=false;
  begin
    alter table hotels_v2_private.hotel_external_calendar_activation_receipts
      disable trigger hotel_external_calendar_activation_receipt_immutable;
    update hotels_v2_private.hotel_external_calendar_activation_receipts
      set compatibility_function_fingerprints=
        jsonb_build_object('unexpected',repeat('0',64)) where id=1;
    if public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact() then
      raise exception 'pricing_activation_stage2f_bad_receipt_accepted';
    end if;
    raise exception 'pricing_activation_stage2f_receipt_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_stage2f_receipt_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()
       is not true then
    raise exception 'pricing_activation_stage2f_receipt_probe_failed:%',v_message;
  end if;
  v_negative_count:=v_negative_count+1;

  -- Missing and duplicate receipt cardinalities are both rejected.
  v_failed:=false;
  begin
    alter table hotels_v2_private.hotel_external_calendar_activation_receipts
      disable trigger hotel_external_calendar_activation_receipt_immutable;
    delete from hotels_v2_private.hotel_external_calendar_activation_receipts
      where id=1;
    if public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact() then
      raise exception 'pricing_activation_stage2f_missing_receipt_accepted';
    end if;
    raise exception 'pricing_activation_stage2f_missing_receipt_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_stage2f_missing_receipt_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()
       is not true then
    raise exception 'pricing_activation_stage2f_missing_receipt_probe_failed:%',v_message;
  end if;
  v_negative_count:=v_negative_count+1;

  select constraint_row.conname into strict v_constraint
  from pg_constraint constraint_row where constraint_row.conrelid=
      'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
    and constraint_row.contype='p';
  v_failed:=false;
  begin
    execute format(
      'alter table hotels_v2_private.hotel_external_calendar_activation_receipts drop constraint %I',
      v_constraint);
    insert into hotels_v2_private.hotel_external_calendar_activation_receipts(
      id,site_settings_without_external_fingerprint,
      compatibility_function_fingerprints,created_at)
    select id,site_settings_without_external_fingerprint,
      compatibility_function_fingerprints,created_at
    from hotels_v2_private.hotel_external_calendar_activation_receipts where id=1;
    if public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact() then
      raise exception 'pricing_activation_stage2f_duplicate_receipt_accepted';
    end if;
    raise exception 'pricing_activation_stage2f_duplicate_receipt_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_stage2f_duplicate_receipt_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()
       is not true then
    raise exception 'pricing_activation_stage2f_duplicate_receipt_probe_failed:%',v_message;
  end if;
  v_negative_count:=v_negative_count+1;

  -- The historical site-settings fingerprint rejects malformed and NULL
  -- values even if its physical constraints are rollback-temporarily removed.
  select constraint_row.conname into strict v_constraint
  from pg_constraint constraint_row where constraint_row.conrelid=
      'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
    and constraint_row.contype='c'
    and constraint_row.conkey=array[2]::smallint[];
  for v_probe in select * from (values
    ('hash_malformed',false,$sql$'malformed'::text$sql$),
    ('hash_null',true,$sql$null::text$sql$)
  ) probes(label,drop_not_null,value_expression) loop
    v_failed:=false;
    begin
      alter table hotels_v2_private.hotel_external_calendar_activation_receipts
        disable trigger hotel_external_calendar_activation_receipt_immutable;
      if v_probe.drop_not_null then
        alter table hotels_v2_private.hotel_external_calendar_activation_receipts
          alter column site_settings_without_external_fingerprint drop not null;
      end if;
      execute format(
        'alter table hotels_v2_private.hotel_external_calendar_activation_receipts drop constraint %I',
        v_constraint);
      execute 'update hotels_v2_private.hotel_external_calendar_activation_receipts '
        ||'set site_settings_without_external_fingerprint='||v_probe.value_expression
        ||' where id=1';
      if public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact() then
        raise exception 'pricing_activation_stage2f_bad_hash_accepted:%',v_probe.label;
      end if;
      raise exception 'pricing_activation_stage2f_hash_probe_rollback:%',v_probe.label;
    exception when raise_exception then
      get stacked diagnostics v_message=message_text;
      v_failed:=v_message='pricing_activation_stage2f_hash_probe_rollback:'||v_probe.label;
    end;
    if not v_failed
       or public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()
         is not true then
      raise exception 'pricing_activation_stage2f_hash_probe_failed:%:%',
        v_probe.label,v_message;
    end if;
    v_negative_count:=v_negative_count+1;
  end loop;

  -- A non-object fingerprint envelope is rejected without invoking object
  -- iterators, and an independently missing catalog check is also rejected.
  select constraint_row.conname into strict v_constraint
  from pg_constraint constraint_row where constraint_row.conrelid=
      'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
    and constraint_row.contype='c'
    and constraint_row.conkey=array[3]::smallint[];
  v_failed:=false;
  begin
    alter table hotels_v2_private.hotel_external_calendar_activation_receipts
      disable trigger hotel_external_calendar_activation_receipt_immutable;
    execute format(
      'alter table hotels_v2_private.hotel_external_calendar_activation_receipts drop constraint %I',
      v_constraint);
    update hotels_v2_private.hotel_external_calendar_activation_receipts
      set compatibility_function_fingerprints='[]'::jsonb where id=1;
    if public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact() then
      raise exception 'pricing_activation_stage2f_nonobject_receipt_accepted';
    end if;
    raise exception 'pricing_activation_stage2f_nonobject_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_stage2f_nonobject_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()
       is not true then
    raise exception 'pricing_activation_stage2f_nonobject_probe_failed:%',v_message;
  end if;
  v_negative_count:=v_negative_count+1;

  select constraint_row.conname into strict v_constraint
  from pg_constraint constraint_row where constraint_row.conrelid=
      'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
    and constraint_row.contype='c'
    and constraint_row.conkey=array[1]::smallint[];
  v_failed:=false;
  begin
    execute format(
      'alter table hotels_v2_private.hotel_external_calendar_activation_receipts drop constraint %I',
      v_constraint);
    if public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact() then
      raise exception 'pricing_activation_stage2f_constraint_drift_accepted';
    end if;
    raise exception 'pricing_activation_stage2f_constraint_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_stage2f_constraint_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()
       is not true then
    raise exception 'pricing_activation_stage2f_constraint_probe_failed:%',v_message;
  end if;
  v_negative_count:=v_negative_count+1;

  -- Immutable-trigger and frozen-lineage security drift each fail closed.
  v_failed:=false;
  begin
    alter table hotels_v2_private.hotel_external_calendar_activation_receipts
      disable trigger hotel_external_calendar_activation_receipt_immutable;
    if public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact() then
      raise exception 'pricing_activation_stage2f_trigger_drift_accepted';
    end if;
    raise exception 'pricing_activation_stage2f_trigger_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_stage2f_trigger_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()
       is not true then
    raise exception 'pricing_activation_stage2f_trigger_probe_failed:%',v_message;
  end if;
  v_negative_count:=v_negative_count+1;

  v_failed:=false;
  begin
    alter function public.hotel_v2_partner_workspace_function_lineage_is_exact()
      set search_path=public;
    if public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact() then
      raise exception 'pricing_activation_stage2f_lineage_drift_accepted';
    end if;
    raise exception 'pricing_activation_stage2f_lineage_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_stage2f_lineage_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()
       is not true then
    raise exception 'pricing_activation_stage2f_lineage_probe_failed:%',v_message;
  end if;
  v_negative_count:=v_negative_count+1;

  -- Bounded rollback probes cover every remaining lower-layer predicate. Each
  -- mutation is isolated and the exact valid baseline is reproved afterward.
  for v_probe in select * from (values
    ('external_null',
      $sql$alter table public.site_settings alter column hotel_external_sync_enabled drop not null$sql$,
      $sql$update public.site_settings set hotel_external_sync_enabled=null where id=1$sql$,
      null::text),
    ('receipt_created_at_infinite',
      $sql$alter table hotels_v2_private.hotel_external_calendar_activation_receipts disable trigger hotel_external_calendar_activation_receipt_immutable$sql$,
      $sql$update hotels_v2_private.hotel_external_calendar_activation_receipts set created_at='infinity'::timestamptz where id=1$sql$,
      null::text),
    ('receipt_value_malformed',
      $sql$alter table hotels_v2_private.hotel_external_calendar_activation_receipts disable trigger hotel_external_calendar_activation_receipt_immutable$sql$,
      $sql$update hotels_v2_private.hotel_external_calendar_activation_receipts set compatibility_function_fingerprints=jsonb_set(compatibility_function_fingerprints,array['public.hotel_v2_h3_2a_require_partner_hotel_access(uuid,uuid,text,boolean)'],to_jsonb('malformed'::text),false) where id=1$sql$,
      null::text),
    ('receipt_value_null',
      $sql$alter table hotels_v2_private.hotel_external_calendar_activation_receipts disable trigger hotel_external_calendar_activation_receipt_immutable$sql$,
      $sql$update hotels_v2_private.hotel_external_calendar_activation_receipts set compatibility_function_fingerprints=jsonb_set(compatibility_function_fingerprints,array['public.hotel_v2_h3_2a_require_partner_hotel_access(uuid,uuid,text,boolean)'],'null'::jsonb,false) where id=1$sql$,
      null::text),
    ('receipt_catalog_column',
      $sql$alter table hotels_v2_private.hotel_external_calendar_activation_receipts add column unexpected_internal text$sql$,
      null::text,null::text),
    ('receipt_table_owner',
      $sql$alter table hotels_v2_private.hotel_external_calendar_activation_receipts owner to authenticated$sql$,
      null::text,null::text),
    ('receipt_table_rls',
      $sql$alter table hotels_v2_private.hotel_external_calendar_activation_receipts enable row level security$sql$,
      null::text,null::text),
    ('receipt_table_policy',
      $sql$create policy stage2f_unexpected_policy on hotels_v2_private.hotel_external_calendar_activation_receipts using (true)$sql$,
      null::text,null::text),
    ('receipt_table_acl',
      $sql$grant select on hotels_v2_private.hotel_external_calendar_activation_receipts to authenticated$sql$,
      null::text,null::text),
    ('private_schema_owner',
      $sql$alter schema hotels_v2_private owner to authenticated$sql$,
      null::text,null::text),
    ('private_schema_usage_acl',
      $sql$grant usage on schema hotels_v2_private to anon$sql$,
      null::text,null::text),
    ('private_schema_create_acl',
      $sql$grant create on schema hotels_v2_private to authenticated$sql$,
      null::text,null::text),
    ('function_owner',
      $sql$alter function public.hotel_v2_external_calendar_worker_hash(jsonb) owner to authenticated$sql$,
      null::text,null::text),
    ('function_security_definer',
      $sql$alter function public.hotel_v2_external_calendar_worker_hash(jsonb) security invoker$sql$,
      null::text,null::text),
    ('function_volatility',
      $sql$alter function public.hotel_v2_external_calendar_worker_hash(jsonb) stable$sql$,
      null::text,null::text),
    ('function_source',
      $sql$create or replace function public.hotel_v2_external_calendar_worker_hash(p_value jsonb) returns text language sql immutable security definer set search_path=pg_catalog as $$select repeat('0',64)$$$sql$,
      null::text,null::text),
    ('function_search_path',
      $sql$alter function public.hotel_v2_external_calendar_worker_hash(jsonb) set search_path=public$sql$,
      null::text,null::text),
    ('function_acl',
      $sql$grant execute on function public.hotel_v2_external_calendar_worker_hash(jsonb) to anon$sql$,
      null::text,null::text)
  ) probes(label,command_1,command_2,command_3)
  order by array_position(array[
    'external_null','receipt_created_at_infinite','receipt_value_malformed',
    'receipt_value_null','receipt_catalog_column','receipt_table_owner',
    'receipt_table_rls','receipt_table_policy','receipt_table_acl',
    'private_schema_owner','private_schema_usage_acl','private_schema_create_acl',
    'function_owner','function_security_definer','function_volatility',
    'function_source','function_search_path','function_acl']::text[],probes.label)
  loop
    v_failed:=false;
    v_probe_sqlstate:=null;
    v_probe_error:=null;
    begin
      if v_probe.command_1 is not null then execute v_probe.command_1; end if;
      if v_probe.command_2 is not null then execute v_probe.command_2; end if;
      if v_probe.command_3 is not null then execute v_probe.command_3; end if;
      begin
        v_probe_result:=
          public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact();
      exception
        when sqlstate 'P0001' or sqlstate '42501' then
          get stacked diagnostics
            v_probe_sqlstate=returned_sqlstate,v_probe_error=message_text;
          v_probe_result:=false;
        when others then
          get stacked diagnostics
            v_probe_sqlstate=returned_sqlstate,v_probe_error=message_text;
          raise exception using errcode='P0001',
            message='pricing_activation_stage2f_negative_validator_exception',
            detail=format('probe=%s sqlstate=%s error=%s',
              v_probe.label,v_probe_sqlstate,v_probe_error);
      end;
      if v_probe_result is true then
        raise exception 'pricing_activation_stage2f_negative_accepted:%',v_probe.label;
      end if;
      raise exception 'pricing_activation_stage2f_negative_probe_rollback:%',v_probe.label;
    exception when raise_exception then
      get stacked diagnostics v_message=message_text;
      if v_message='pricing_activation_stage2f_negative_validator_exception' then
        raise;
      end if;
      v_failed:=v_message=
        'pricing_activation_stage2f_negative_probe_rollback:'||v_probe.label;
    end;
    if not v_failed
       or public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()
         is not true then
      raise exception 'pricing_activation_stage2f_negative_probe_failed:%:%',
        v_probe.label,v_message;
    end if;
    if v_probe.label='function_owner' then
      if v_probe_sqlstate is distinct from '42501' then
        raise exception
          'pricing_activation_stage2f_function_owner_sqlstate_mismatch:%:%',
          coalesce(v_probe_sqlstate,'NULL'),coalesce(v_probe_error,'NULL');
      end if;
      v_function_owner_42501_seen:=true;
    elsif v_probe.label='function_security_definer' then
      if v_function_owner_42501_seen is not true
         or v_previous_bulk_probe is distinct from 'function_owner' then
        raise exception
          'pricing_activation_stage2f_function_owner_evidence_missing';
      end if;
      v_function_owner_followup_restored:=true;
    end if;
    v_negative_count:=v_negative_count+1;
    v_previous_bulk_probe:=v_probe.label;
  end loop;

  -- The canonical Task2 compatibility receipt has its own immutable contract;
  -- these probes are counted separately from the frozen 30 Stage2F negatives.
  select constraint_row.conname into strict v_constraint
  from pg_constraint constraint_row where constraint_row.conrelid=
      'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
    and constraint_row.contype='c'
    and constraint_row.conkey=array[2]::smallint[];
  v_failed:=false;
  begin
    alter table public.hotel_seven_arches_task2_stage2_compatibility_receipts
      disable trigger hotel_seven_arches_task2_stage2_compatibility_receipt_immutable;
    execute format(
      'alter table public.hotel_seven_arches_task2_stage2_compatibility_receipts drop constraint %I',
      v_constraint);
    update public.hotel_seven_arches_task2_stage2_compatibility_receipts
      set contract_version='unexpected_contract' where id=1;
    begin
      v_probe_result:=
        public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact();
    exception when others then v_probe_result:=false;
    end;
    if v_probe_result is true then
      raise exception 'pricing_activation_task2_receipt_contract_accepted';
    end if;
    raise exception 'pricing_activation_task2_receipt_contract_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message=
      'pricing_activation_task2_receipt_contract_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()
       is not true then
    raise exception 'pricing_activation_task2_receipt_contract_probe_failed:%',
      v_message;
  end if;
  v_task2_receipt_negative_count:=v_task2_receipt_negative_count+1;

  select constraint_row.conname into strict v_constraint
  from pg_constraint constraint_row where constraint_row.conrelid=
      'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
    and constraint_row.contype='c'
    and constraint_row.conkey=array[4]::smallint[];
  v_failed:=false;
  begin
    execute format(
      'alter table public.hotel_seven_arches_task2_stage2_compatibility_receipts drop constraint %I',
      v_constraint);
    begin
      v_probe_result:=
        public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact();
    exception when others then v_probe_result:=false;
    end;
    if v_probe_result is true then
      raise exception 'pricing_activation_task2_receipt_constraint_accepted';
    end if;
    raise exception 'pricing_activation_task2_receipt_constraint_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message=
      'pricing_activation_task2_receipt_constraint_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()
       is not true then
    raise exception 'pricing_activation_task2_receipt_constraint_probe_failed:%',
      v_message;
  end if;
  v_task2_receipt_negative_count:=v_task2_receipt_negative_count+1;

  for v_probe in select * from (values
    ('task2_map_self_hash',
      $sql$alter table public.hotel_seven_arches_task2_stage2_compatibility_receipts disable trigger hotel_seven_arches_task2_stage2_compatibility_receipt_immutable$sql$,
      $sql$update public.hotel_seven_arches_task2_stage2_compatibility_receipts set canonical_task2_protected_fingerprints=jsonb_set(canonical_task2_protected_fingerprints,'{unexpected}','true'::jsonb,true) where id=1$sql$),
    ('stage2_map_self_hash',
      $sql$alter table public.hotel_seven_arches_task2_stage2_compatibility_receipts disable trigger hotel_seven_arches_task2_stage2_compatibility_receipt_immutable$sql$,
      $sql$update public.hotel_seven_arches_task2_stage2_compatibility_receipts set canonical_stage2_protected_fingerprints=jsonb_set(canonical_stage2_protected_fingerprints,'{unexpected}','true'::jsonb,true) where id=1$sql$),
    ('canonical_snapshot_source',
      $sql$alter table public.hotel_seven_arches_task2_stage2_compatibility_receipts disable trigger hotel_seven_arches_task2_stage2_compatibility_receipt_immutable$sql$,
      $sql$update public.hotel_seven_arches_task2_stage2_compatibility_receipts set canonical_snapshot_source_hash=repeat('0',64) where id=1$sql$),
    ('validator_source',
      $sql$alter table public.hotel_seven_arches_task2_stage2_compatibility_receipts disable trigger hotel_seven_arches_task2_stage2_compatibility_receipt_immutable$sql$,
      $sql$update public.hotel_seven_arches_task2_stage2_compatibility_receipts set validator_source_hash=repeat('0',64) where id=1$sql$),
    ('created_at_finite',
      $sql$alter table public.hotel_seven_arches_task2_stage2_compatibility_receipts disable trigger hotel_seven_arches_task2_stage2_compatibility_receipt_immutable$sql$,
      $sql$update public.hotel_seven_arches_task2_stage2_compatibility_receipts set created_at='infinity'::timestamptz where id=1$sql$),
    ('catalog_column',
      $sql$alter table public.hotel_seven_arches_task2_stage2_compatibility_receipts add column unexpected_internal text$sql$,
      null::text),
    ('immutable_trigger',
      $sql$alter table public.hotel_seven_arches_task2_stage2_compatibility_receipts disable trigger hotel_seven_arches_task2_stage2_compatibility_receipt_immutable$sql$,
      null::text),
    ('raw_acl',
      $sql$grant select on public.hotel_seven_arches_task2_stage2_compatibility_receipts to authenticated$sql$,
      null::text),
    ('table_owner',
      $sql$alter table public.hotel_seven_arches_task2_stage2_compatibility_receipts owner to authenticated$sql$,
      null::text),
    ('row_level_security',
      $sql$alter table public.hotel_seven_arches_task2_stage2_compatibility_receipts disable row level security$sql$,
      null::text),
    ('policy',
      $sql$create policy task2_receipt_unexpected_policy on public.hotel_seven_arches_task2_stage2_compatibility_receipts using (true)$sql$,
      null::text)
  ) probes(label,command_1,command_2) loop
    v_failed:=false;
    begin
      execute v_probe.command_1;
      if v_probe.command_2 is not null then execute v_probe.command_2; end if;
      begin
        v_probe_result:=
          public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact();
      exception when others then v_probe_result:=false;
      end;
      if v_probe_result is true then
        raise exception 'pricing_activation_task2_receipt_negative_accepted:%',
          v_probe.label;
      end if;
      raise exception 'pricing_activation_task2_receipt_probe_rollback:%',
        v_probe.label;
    exception when raise_exception then
      get stacked diagnostics v_message=message_text;
      v_failed:=v_message=
        'pricing_activation_task2_receipt_probe_rollback:'||v_probe.label;
    end;
    if not v_failed
       or public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()
         is not true then
      raise exception 'pricing_activation_task2_receipt_probe_failed:%:%',
        v_probe.label,v_message;
    end if;
    v_task2_receipt_negative_count:=v_task2_receipt_negative_count+1;
  end loop;

  -- Projector lineage/security is additional to the frozen 30 Stage2F probes.
  for v_probe in select * from (values
    ('projector_owner',
      $sql$alter function public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot() owner to authenticated$sql$),
    ('projector_security_definer',
      $sql$alter function public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot() security invoker$sql$),
    ('projector_volatility',
      $sql$alter function public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot() volatile$sql$),
    ('projector_source',
      $sql$create or replace function public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot() returns jsonb language sql stable security definer set search_path=pg_catalog,public as $projector$select null::jsonb$projector$$sql$),
    ('projector_search_path',
      $sql$alter function public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot() set search_path=public$sql$),
    ('projector_acl',
      $sql$grant execute on function public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot() to authenticated$sql$)
  ) probes(label,command_1) loop
    v_failed:=false;
    begin
      execute v_probe.command_1;
      begin
        v_probe_result:=
          public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact();
      exception when others then v_probe_result:=false;
      end;
      if v_probe_result is true then
        raise exception 'pricing_activation_stage2f_projector_negative_accepted:%',
          v_probe.label;
      end if;
      raise exception 'pricing_activation_stage2f_projector_probe_rollback:%',
        v_probe.label;
    exception when raise_exception then
      get stacked diagnostics v_message=message_text;
      v_failed:=v_message=
        'pricing_activation_stage2f_projector_probe_rollback:'||v_probe.label;
    end;
    if not v_failed
       or public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()
         is not true then
      raise exception 'pricing_activation_stage2f_projector_probe_failed:%:%',
        v_probe.label,v_message;
    end if;
    v_projector_negative_count:=v_projector_negative_count+1;
  end loop;

  for v_probe in select * from (values
    ('validator_owner',
      $sql$alter function public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact() owner to authenticated$sql$),
    ('validator_security_definer',
      $sql$alter function public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact() security invoker$sql$),
    ('validator_volatility',
      $sql$alter function public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact() volatile$sql$),
    ('validator_source',
      $sql$create or replace function public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact() returns boolean language sql stable security definer set search_path=pg_catalog,public as $validator$select false$validator$$sql$),
    ('validator_search_path',
      $sql$alter function public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact() set search_path=public$sql$),
    ('validator_acl',
      $sql$grant execute on function public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact() to authenticated$sql$)
  ) probes(label,command_1) loop
    v_failed:=false;
    begin
      execute v_probe.command_1;
      begin
        v_probe_result:=
          public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact();
      exception when others then v_probe_result:=false;
      end;
      if v_probe_result is true then
        raise exception 'pricing_activation_stage2f_validator_negative_accepted:%',
          v_probe.label;
      end if;
      raise exception 'pricing_activation_stage2f_validator_probe_rollback:%',
        v_probe.label;
    exception when raise_exception then
      get stacked diagnostics v_message=message_text;
      v_failed:=v_message=
        'pricing_activation_stage2f_validator_probe_rollback:'||v_probe.label;
    end;
    if not v_failed
       or public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()
         is not true then
      raise exception 'pricing_activation_stage2f_validator_probe_failed:%:%',
        v_probe.label,v_message;
    end if;
    v_validator_negative_count:=v_validator_negative_count+1;
  end loop;

  if v_negative_count<>30 then
    raise exception 'pricing_activation_stage2f_negative_count_mismatch:%',
      v_negative_count;
  end if;
  if v_projector_negative_count<>6 then
    raise exception 'pricing_activation_stage2f_projector_negative_count_mismatch:%',
      v_projector_negative_count;
  end if;
  if v_task2_receipt_negative_count<>13 then
    raise exception 'pricing_activation_task2_receipt_negative_count_mismatch:%',
      v_task2_receipt_negative_count;
  end if;
  if v_validator_negative_count<>6 then
    raise exception 'pricing_activation_stage2f_validator_negative_count_mismatch:%',
      v_validator_negative_count;
  end if;
  if v_function_owner_42501_seen is not true
     or v_function_owner_followup_restored is not true then
    raise exception
      'pricing_activation_stage2f_function_owner_evidence_incomplete:%:%',
      v_function_owner_42501_seen,v_function_owner_followup_restored;
  end if;
  perform set_config('test.stage2f_negative_count',v_negative_count::text,false);
  perform set_config('test.stage2f_projector_negative_count',
    v_projector_negative_count::text,false);
  perform set_config('test.stage2f_task2_receipt_negative_count',
    v_task2_receipt_negative_count::text,false);
  perform set_config('test.stage2f_validator_negative_count',
    v_validator_negative_count::text,false);
  perform set_config('test.stage2f_function_owner_validator_sqlstate','42501',false);
  perform set_config('test.stage2f_function_owner_followup_restored',
    v_function_owner_followup_restored::text,false);
end
$pricing_activation_stage2f_compatibility_gate$;
commit;

select
  'HOTELS_V2_7A_PRICING_ACTIVATION_STAGE2F_COMPATIBILITY_POSTGRES_GATE_OK' sentinel,
  (select hotel_external_sync_enabled from public.site_settings where id=1)
    external_sync_enabled,
  public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact() task2_exact,
  public.hotel_v2_seven_arches_pricing_activation_current_is_safe() current_safe,
  current_setting('test.stage2f_negative_count')::integer negative_probe_count,
  current_setting('test.stage2f_projector_negative_count')::integer
    projector_negative_probe_count,
  current_setting('test.stage2f_task2_receipt_negative_count')::integer
    task2_receipt_negative_probe_count,
  current_setting('test.stage2f_validator_negative_count')::integer
    validator_negative_probe_count,
  current_setting('test.stage2f_function_owner_validator_sqlstate')
    function_owner_validator_sqlstate,
  current_setting('test.stage2f_function_owner_followup_restored')::boolean
    function_owner_followup_restored,
  (select count(*) from public.hotel_seven_arches_pricing_activation_evolution_receipts)
    activation_receipt_count;
