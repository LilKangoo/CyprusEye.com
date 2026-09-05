\set ON_ERROR_STOP on
\set provider_install_external_enabled 1
\set seven_arches_owner_live_drift_fixture 1
\ir hotels-v2-seven-arches-pricing-activation-postgres-base.sql

-- Production order: the accepted Task2 content proposal precedes 114400.
begin;
do $task2_accept_before_recursion_compatibility$
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
        'pl','7 Łuków — aktywacja','en','7 Arches activation',
        'he','הפעלת 7 קשתות')),
      'reason','Task2 acceptance before pricing activation recursion compatibility')));
  perform public.hotel_v2_partner_apply_content_plan(v_preview->'reviewed_plan',
    '39000000-0000-4000-8000-000000000001',
    '39000000-0000-4000-8000-000000000002');
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
      'reason','Accept Task2 proposal before recursion compatibility'));
  perform public.hotel_v2_admin_apply_partner_property_proposal_plan(
    v_preview->'reviewed_plan','39000000-0000-4000-8000-000000000003');
  reset role;
  if not public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable() then
    raise exception 'pricing_activation_recursion_task2_accept_failed';
  end if;
end
$task2_accept_before_recursion_compatibility$;
commit;

\ir ../../supabase/migrations/20260811440000_hotels_v2_seven_arches_pricing_activation.sql

-- The pinned prior source contains one executable state-validator edge plus a
-- separate metadata lineage reference.  Exercise the executable-context
-- classifier independently so metadata, comments, and string literals cannot
-- create either a false positive or a false negative.
do $recursion_compatibility_prior_call_shape_gate$
declare
  c_executable constant text:=
    'and public.hotel_v2_seven_arches_pricing_activation_state_is_exact()),false);';
  c_metadata constant text:=
    'pg_get_functiondef(''public.hotel_v2_seven_arches_pricing_activation_state_is_exact()''::regprocedure)';
  c_reference constant text:=
    'to_regprocedure(''public.hotel_v2_seven_arches_pricing_activation_state_is_exact()'')';
  v_case record;
  v_executable_count integer;
  v_live_source text;
  v_passed integer:=0;
begin
  for v_case in select * from (values
    ('one_executable_plus_metadata',c_executable||E'\n'||c_metadata,true),
    ('zero_executable','select true;',false),
    ('two_executable',c_executable||E'\n'||c_executable,false),
    ('metadata_only',c_metadata,false),
    ('duplicate_executable_unchanged_metadata',
      c_metadata||E'\n'||c_executable||E'\n'||c_executable,false),
    ('one_executable_extra_nonruntime_text',
      c_executable||E'\n'||c_metadata||E'\n-- public.hotel_v2_seven_arches_pricing_activation_state_is_exact()'
        ||E'\n'||quote_literal(
          'public.hotel_v2_seven_arches_pricing_activation_state_is_exact()')
        ||E'\n'||c_reference,true)
  ) shape(label,source_text,expected_valid) loop
    v_executable_count:=
      (length(v_case.source_text)-length(replace(
        v_case.source_text,c_executable,'')))/length(c_executable);
    if (v_executable_count=1) is distinct from v_case.expected_valid then
      raise exception 'pricing_activation_recursion_call_shape_case_failed:%:%:%',
        v_case.label,v_case.expected_valid,v_executable_count;
    end if;
    v_passed:=v_passed+1;
  end loop;
  v_live_source:=pg_get_functiondef(
    'public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()'::regprocedure);
  if (length(v_live_source)-length(replace(v_live_source,c_executable,'')))
       /length(c_executable)<>1 then
    raise exception 'pricing_activation_recursion_live_call_shape_mismatch';
  end if;
  if v_passed<>6 then
    raise exception 'pricing_activation_recursion_call_shape_coverage_mismatch:%',
      v_passed;
  end if;
  perform set_config('test.hotels_114405_call_shape_case_count',v_passed::text,false);
end
$recursion_compatibility_prior_call_shape_gate$;

\ir ../../supabase/manual/hotels_v2_seven_arches_pricing_activation_recursion_compatibility_preflight.sql
\ir ../../supabase/migrations/20260811440500_hotels_v2_seven_arches_pricing_activation_recursion_compatibility.sql
\ir ../../supabase/migrations/20260811440600_hotels_v2_seven_arches_pricing_activation_transport_stable_fingerprint.sql

do $recursion_compatibility_pre_activation_gate$
begin
  if (select count(*)
      from public.hotel_seven_arches_pricing_activation_evolution_receipts)<>0
     or public.hotel_v2_seven_arches_pricing_activation_current_is_safe()
       is not true
     or public.hotel_v2_seven_arches_pricing_scoped_lineage()->>'contract_version'
       is distinct from 'hotels_v2_seven_arches_pricing_scoped_lineage_v1'
     or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc where oid=to_regprocedure(
         'public.hotel_v2_admin_d_current_foundation_snapshot()'))<>
       '2ed412e46a827c3b57b570f3c6675edc5d1a92562fb8acb59b7148b245ed592a'
    or (select encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex')
      from pg_proc where oid=to_regprocedure(
         'public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()'))<>
       '2829ec9059a4e035344ed35d26c7cac1d12c7296fd91ab498c7df78aa8f13dee' then
    raise exception 'pricing_activation_recursion_pre_activation_state_invalid';
  end if;
end
$recursion_compatibility_pre_activation_gate$;

-- A test-only receipt boundary aborts one otherwise valid Apply after all
-- protected writes and the receipt INSERT.  Its exact P0001 rolls the Apply
-- subtransaction back before the post-receipt graph, proving containment.
create function public.hotel_v2_114405_test_stop_after_activation_receipt()
returns trigger language plpgsql set search_path=pg_catalog,public
as $test_function$
declare
  v_canonical jsonb;
begin
  v_canonical:=public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot();
  if (select count(*)
      from public.hotel_seven_arches_pricing_activation_evolution_receipts)<>1
     or v_canonical is null
     or public.hotel_v2_7a_pricing_activation_transaction_is_preserved()
       is not true then
    raise exception 'pricing_activation_recursion_failed_apply_boundary_invalid';
  end if;
  raise exception 'pricing_activation_recursion_failed_apply_rollback_sentinel';
end
$test_function$;
create trigger hotel_v2_114405_test_stop_after_activation_receipt
after insert on public.hotel_seven_arches_pricing_activation_evolution_receipts
for each row execute function public.hotel_v2_114405_test_stop_after_activation_receipt();

do $recursion_compatibility_failed_apply_rollback_gate$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_correlation constant uuid:='39000000-0000-4000-8000-000000000008';
  v_snapshot jsonb;
  v_preview jsonb;
  v_review_id uuid;
  v_message text;
  v_failed boolean:=false;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_snapshot:=public.hotel_v2_admin_get_seven_arches_pricing_activation();
  v_preview:=public.hotel_v2_admin_preview_seven_arches_pricing_activation(
    jsonb_build_object(
      'contract_version','hotels_v2_seven_arches_pricing_activation_draft_v1',
      'hotel_id',c_hotel,'snapshot_token',v_snapshot->>'snapshot_token',
      'upper_base_nightly_rate',135.00,'ground_base_nightly_rate',115.00,
      'rate_plan_name_i18n',jsonb_build_object(
        'pl','Standardowa','en','Standard','he','סטנדרטי'),
      'rate_plan_description_i18n',jsonb_build_object(
        'pl','Bezzwrotna taryfa dla obu apartamentów.',
        'en','Non-refundable rate for both apartments.',
        'he','תעריף ללא החזר לשתי הדירות.'),
      'schedule_name_i18n',jsonb_build_object(
        'pl','Obłożenie i długość pobytu',
        'en','Occupancy and length of stay','he','תפוסה ואורך שהייה'),
      'reason','Rollback-contained activation boundary probe'));
  v_review_id:=(v_preview#>>'{reviewed_plan,review_id}')::uuid;
  begin
    perform public.hotel_v2_admin_apply_seven_arches_pricing_activation(
      v_preview->'reviewed_plan',c_correlation,
      'seven-arches-recursion-failed-rollback');
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_recursion_failed_apply_rollback_sentinel';
  end;
  reset role;
  if not v_failed
     or (select count(*)
       from public.hotel_seven_arches_pricing_activation_evolution_receipts)<>0
     or exists(select 1 from public.hotel_admin_pricing_action_receipts
       where correlation_id=c_correlation)
     or exists(select 1 from public.hotel_activity_log where correlation_id=c_correlation)
     or exists(select 1
       from public.hotel_seven_arches_pricing_activation_transaction_context)
     or not exists(select 1 from public.hotel_seven_arches_pricing_activation_reviews
       where id=v_review_id and consumed_at is null and result is null)
     or public.hotel_v2_seven_arches_pricing_activation_current_is_safe() is not true
     or public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot() is null then
    raise exception 'pricing_activation_recursion_failed_apply_not_contained:%',v_message;
  end if;
  perform set_config('test.hotels_114405_failed_activation_rollback','true',false);
end
$recursion_compatibility_failed_apply_rollback_gate$;

drop trigger hotel_v2_114405_test_stop_after_activation_receipt
  on public.hotel_seven_arches_pricing_activation_evolution_receipts;
drop function public.hotel_v2_114405_test_stop_after_activation_receipt();

-- The 114406 transport-stable Admin workflow must now cross the first-receipt
-- boundary and pin the evolved validator source.
begin;
do $activate_after_recursion_compatibility$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_snapshot jsonb;
  v_preview jsonb;
  v_result jsonb;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_snapshot:=public.hotel_v2_admin_get_seven_arches_pricing_activation();
  if v_snapshot->>'status'<>'ready' then
    raise exception 'pricing_activation_recursion_initial_snapshot_invalid:%',v_snapshot;
  end if;
  v_preview:=public.hotel_v2_admin_preview_seven_arches_pricing_activation(
    jsonb_build_object(
      'contract_version','hotels_v2_seven_arches_pricing_activation_draft_v1',
      'hotel_id',c_hotel,'snapshot_token',v_snapshot->>'snapshot_token',
      'upper_base_nightly_rate',135.00,'ground_base_nightly_rate',115.00,
      'rate_plan_name_i18n',jsonb_build_object(
        'pl','Standardowa','en','Standard','he','סטנדרטי'),
      'rate_plan_description_i18n',jsonb_build_object(
        'pl','Bezzwrotna taryfa dla obu apartamentów.',
        'en','Non-refundable rate for both apartments.',
        'he','תעריף ללא החזר לשתי הדירות.'),
      'schedule_name_i18n',jsonb_build_object(
        'pl','Obłożenie i długość pobytu',
        'en','Occupancy and length of stay','he','תפוסה ואורך שהייה'),
      'reason','Reviewed activation after recursion compatibility'));
  if v_preview->>'changed'<>'true'
     or jsonb_array_length(v_preview->'blocking_reasons')<>0 then
    raise exception 'pricing_activation_recursion_preview_invalid:%',v_preview;
  end if;
  v_result:=public.hotel_v2_admin_apply_seven_arches_pricing_activation(
    v_preview->'reviewed_plan','39000000-0000-4000-8000-000000000004',
    'seven-arches-recursion-compatible-activation');
  reset role;
  if v_result->>'changed'<>'true' or v_result->>'replayed'<>'false'
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true
     or public.hotel_v2_seven_arches_pricing_activation_current_is_safe() is not true then
    raise exception 'pricing_activation_recursion_apply_invalid:%',v_result;
  end if;
end
$activate_after_recursion_compatibility$;
commit;

\ir ../../supabase/manual/hotels_v2_seven_arches_pricing_activation_recursion_compatibility_verify.sql

begin;
do $recursion_compatibility_negative_and_acyclic_gate$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_failed boolean;
  v_message text;
  v_sqlstate text;
  v_definition text;
  v_constraint_name text;
  v_constraint_name_2 text;
  v_index integer;
  v_probe record;
  v_passed_probe_labels text[]:='{}'::text[];
  v_required_probe_labels constant text[]:=array[
    'activation_receipt_missing','activation_receipt_duplicate',
    'before_after_boundary','task2_validator_source','scoped_lineage_source','apply_source',
    'function_owner','function_security_definer','function_search_path','function_acl',
    'admin_d_mapping','parity_binding','hotel_binding','partner_binding',
    'assignment_binding','review_correlation_binding','failed_activation_rollback'
  ]::text[];
  v_value jsonb;
  v_assignment_id uuid;
  v_assignment_resource_before uuid;
  v_pricing_state_before jsonb;
  v_current_safe_before boolean;
  v_review_binding_before jsonb;
begin
  if current_setting('test.hotels_114405_failed_activation_rollback',true)
       is distinct from 'true' then
    raise exception 'pricing_activation_recursion_failed_apply_evidence_missing';
  end if;
  v_passed_probe_labels:=array_append(
    v_passed_probe_labels,'failed_activation_rollback');
  -- The exact receipt remains immutable.
  v_failed:=false;
  begin
    update public.hotel_seven_arches_pricing_activation_evolution_receipts
      set pricing_authority=pricing_authority where id=1;
  exception when sqlstate '55000' then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='hotels_v2_seven_arches_pricing_activation_immutable';
  end;
  if not v_failed then raise exception 'pricing_activation_recursion_receipt_update_allowed'; end if;

  -- Receipt corruption fails closed and the exception subtransaction restores
  -- both the row and immutable trigger before the next assertion.
  v_failed:=false;
  begin
    alter table public.hotel_seven_arches_pricing_activation_evolution_receipts
      disable trigger hotel_seven_arches_pricing_activation_evolution_immutable;
    update public.hotel_seven_arches_pricing_activation_evolution_receipts
      set after_protected_fingerprint=repeat('0',64) where id=1;
    if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
      raise exception 'pricing_activation_recursion_corrupt_receipt_accepted';
    end if;
    raise exception 'pricing_activation_recursion_receipt_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_recursion_receipt_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true then
    raise exception 'pricing_activation_recursion_receipt_probe_failed:%',v_message;
  end if;

  -- The receipt must pin this exact evolved validator body.  Corrupting only
  -- that source anchor fails closed and the subtransaction restores it.
  v_failed:=false;
  begin
    alter table public.hotel_seven_arches_pricing_activation_evolution_receipts
      disable trigger hotel_seven_arches_pricing_activation_evolution_immutable;
    update public.hotel_seven_arches_pricing_activation_evolution_receipts
      set receipt_validator_source_hash=repeat('0',64) where id=1;
    if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
      raise exception 'pricing_activation_recursion_source_pin_drift_accepted';
    end if;
    raise exception 'pricing_activation_recursion_source_pin_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_recursion_source_pin_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true then
    raise exception 'pricing_activation_recursion_source_pin_probe_failed:%',v_message;
  end if;

  -- The activation receipt is an exact singleton.
  v_failed:=false;
  begin
    alter table public.hotel_seven_arches_pricing_activation_evolution_receipts
      disable trigger hotel_seven_arches_pricing_activation_evolution_immutable;
    delete from public.hotel_seven_arches_pricing_activation_evolution_receipts where id=1;
    if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
      raise exception 'pricing_activation_recursion_missing_receipt_accepted';
    end if;
    raise exception 'pricing_activation_recursion_missing_receipt_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_recursion_missing_receipt_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true then
    raise exception 'pricing_activation_recursion_missing_receipt_probe_failed:%',v_message;
  end if;
  v_passed_probe_labels:=array_append(v_passed_probe_labels,'activation_receipt_missing');

  v_failed:=false;
  begin
    select conname into strict v_constraint_name from pg_constraint
      where conrelid=
        'public.hotel_seven_arches_pricing_activation_evolution_receipts'::regclass
        and contype='p';
    select conname into strict v_constraint_name_2 from pg_constraint
      where conrelid=
        'public.hotel_seven_arches_pricing_activation_evolution_receipts'::regclass
        and contype='c' and conkey=array[1]::smallint[]
        and regexp_replace(pg_get_expr(conbin,conrelid),'[[:space:]]+','','g')='(id=1)';
    v_definition:=pg_get_functiondef(
      'public.hotel_v2_seven_arches_pricing_activation_evolution_insert_guard()'::regprocedure);
    execute 'create or replace function public.hotel_v2_seven_arches_pricing_activation_evolution_insert_guard()
      returns trigger language plpgsql security definer set search_path=pg_catalog,public
      as $duplicate_probe$ begin return new; end $duplicate_probe$';
    execute format('alter table public.hotel_seven_arches_pricing_activation_evolution_receipts drop constraint %I',
      v_constraint_name);
    execute format('alter table public.hotel_seven_arches_pricing_activation_evolution_receipts drop constraint %I',
      v_constraint_name_2);
    for v_probe in select conname from pg_constraint where conrelid=
      'public.hotel_seven_arches_pricing_activation_evolution_receipts'::regclass
      and contype='u' loop
      execute format('alter table public.hotel_seven_arches_pricing_activation_evolution_receipts drop constraint %I',
        v_probe.conname);
    end loop;
    insert into public.hotel_seven_arches_pricing_activation_evolution_receipts
    select (jsonb_populate_record(
      null::public.hotel_seven_arches_pricing_activation_evolution_receipts,
      jsonb_set(to_jsonb(receipt),'{id}','2'::jsonb,false))).*
    from public.hotel_seven_arches_pricing_activation_evolution_receipts receipt where id=1;
    execute v_definition;
    if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
      raise exception 'pricing_activation_recursion_duplicate_receipt_accepted';
    end if;
    raise exception 'pricing_activation_recursion_duplicate_receipt_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_recursion_duplicate_receipt_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true then
    raise exception 'pricing_activation_recursion_duplicate_receipt_probe_failed:%',v_message;
  end if;
  v_passed_probe_labels:=array_append(v_passed_probe_labels,'activation_receipt_duplicate');

  -- BEFORE remains bound to the immutable Task2 receipt and cannot be replaced
  -- by the otherwise internally valid live AFTER map.
  v_failed:=false;
  begin
    alter table public.hotel_seven_arches_pricing_activation_evolution_receipts
      disable trigger hotel_seven_arches_pricing_activation_evolution_immutable;
    update public.hotel_seven_arches_pricing_activation_evolution_receipts set
      before_protected_fingerprints=after_protected_fingerprints,
      before_protected_fingerprint=after_protected_fingerprint,
      before_stage2_protected_fingerprints=after_stage2_protected_fingerprints,
      before_stage2_protected_fingerprint=after_stage2_protected_fingerprint
    where id=1;
    if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
      raise exception 'pricing_activation_recursion_before_after_swap_accepted';
    end if;
    raise exception 'pricing_activation_recursion_before_after_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_recursion_before_after_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true then
    raise exception 'pricing_activation_recursion_before_after_probe_failed:%',v_message;
  end if;
  v_passed_probe_labels:=array_append(v_passed_probe_labels,'before_after_boundary');

  -- The Task2 validator source pin is distinct from the projector source pin.
  v_failed:=false;
  begin
    alter table public.hotel_seven_arches_task2_stage2_compatibility_receipts
      disable trigger hotel_seven_arches_task2_stage2_compatibility_receipt_immutable;
    update public.hotel_seven_arches_task2_stage2_compatibility_receipts
      set validator_source_hash=repeat('0',64) where id=1;
    if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
      raise exception 'pricing_activation_recursion_task2_validator_pin_drift_accepted';
    end if;
    raise exception 'pricing_activation_recursion_task2_validator_pin_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_recursion_task2_validator_pin_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true then
    raise exception 'pricing_activation_recursion_task2_validator_pin_probe_failed:%',v_message;
  end if;
  v_passed_probe_labels:=array_append(v_passed_probe_labels,'task2_validator_source');

  -- The immutable Task2 receipt independently pins the long-lived scoped
  -- Hotels lineage projector.  Broad operational maps remain receipt history,
  -- never a permanent current-state equality requirement.
  v_failed:=false;
  begin
    alter table public.hotel_seven_arches_task2_stage2_compatibility_receipts
      disable trigger hotel_seven_arches_task2_stage2_compatibility_receipt_immutable;
    update public.hotel_seven_arches_task2_stage2_compatibility_receipts
      set scoped_lineage_source_hash=repeat('0',64) where id=1;
    if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
      raise exception 'pricing_activation_recursion_scoped_lineage_pin_drift_accepted';
    end if;
    raise exception 'pricing_activation_recursion_scoped_lineage_pin_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_recursion_scoped_lineage_pin_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true then
    raise exception 'pricing_activation_recursion_scoped_lineage_pin_probe_failed:%',
      v_message;
  end if;
  v_passed_probe_labels:=array_append(v_passed_probe_labels,'scoped_lineage_source');

  -- A body-only Apply source drift is rejected even when signature/security
  -- remain unchanged.
  v_failed:=false;
  begin
    v_definition:=pg_get_functiondef(
      'public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text)'::regprocedure);
    if position(E'AS $function$\ndeclare' in v_definition)=0 then
      raise exception 'pricing_activation_recursion_apply_source_probe_shape';
    end if;
    execute replace(v_definition,E'AS $function$\ndeclare',
      E'AS $function$\n-- 114405 source drift probe\ndeclare');
    if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
      raise exception 'pricing_activation_recursion_apply_source_drift_accepted';
    end if;
    raise exception 'pricing_activation_recursion_apply_source_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_recursion_apply_source_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true then
    raise exception 'pricing_activation_recursion_apply_source_probe_failed:%',v_message;
  end if;
  v_passed_probe_labels:=array_append(v_passed_probe_labels,'apply_source');

  -- Self owner/SECDEF/ACL are separate from search_path and all fail closed.
  v_failed:=false;
  begin
    alter function public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()
      owner to authenticated;
    begin
      if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
        raise exception 'pricing_activation_recursion_validator_owner_drift_accepted';
      end if;
    exception when insufficient_privilege then
      null;
    end;
    raise exception 'pricing_activation_recursion_validator_owner_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_recursion_validator_owner_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true then
    raise exception 'pricing_activation_recursion_validator_owner_probe_failed:%',v_message;
  end if;
  v_passed_probe_labels:=array_append(v_passed_probe_labels,'function_owner');

  v_failed:=false;
  begin
    alter function public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()
      security invoker;
    if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
      raise exception 'pricing_activation_recursion_validator_secdef_drift_accepted';
    end if;
    raise exception 'pricing_activation_recursion_validator_secdef_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_recursion_validator_secdef_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true then
    raise exception 'pricing_activation_recursion_validator_secdef_probe_failed:%',v_message;
  end if;
  v_passed_probe_labels:=array_append(v_passed_probe_labels,'function_security_definer');

  v_failed:=false;
  begin
    grant execute on function
      public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() to authenticated;
    if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
      raise exception 'pricing_activation_recursion_validator_acl_drift_accepted';
    end if;
    raise exception 'pricing_activation_recursion_validator_acl_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_recursion_validator_acl_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true then
    raise exception 'pricing_activation_recursion_validator_acl_probe_failed:%',v_message;
  end if;
  v_passed_probe_labels:=array_append(v_passed_probe_labels,'function_acl');

  -- The immutable canonical Task2 receipt is the only accepted BEFORE
  -- authority.  A map/self-hash mismatch must fail closed.
  v_failed:=false;
  begin
    alter table public.hotel_seven_arches_task2_stage2_compatibility_receipts
      disable trigger hotel_seven_arches_task2_stage2_compatibility_receipt_immutable;
    update public.hotel_seven_arches_task2_stage2_compatibility_receipts
      set canonical_task2_protected_fingerprint=repeat('0',64) where id=1;
    if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
      raise exception 'pricing_activation_recursion_task2_hash_drift_accepted';
    end if;
    raise exception 'pricing_activation_recursion_task2_hash_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_recursion_task2_hash_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true then
    raise exception 'pricing_activation_recursion_task2_hash_probe_failed:%',v_message;
  end if;

  v_failed:=false;
  begin
    alter table public.hotel_seven_arches_task2_stage2_compatibility_receipts
      disable trigger hotel_seven_arches_task2_stage2_compatibility_receipt_immutable;
    update public.hotel_seven_arches_task2_stage2_compatibility_receipts
      set canonical_stage2_protected_fingerprint=repeat('0',64) where id=1;
    if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
      raise exception 'pricing_activation_recursion_stage2_hash_drift_accepted';
    end if;
    raise exception 'pricing_activation_recursion_stage2_hash_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_recursion_stage2_hash_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true then
    raise exception 'pricing_activation_recursion_stage2_hash_probe_failed:%',v_message;
  end if;

  -- The canonical projector source recorded by Task2 is immutable lineage.
  v_failed:=false;
  begin
    alter table public.hotel_seven_arches_task2_stage2_compatibility_receipts
      disable trigger hotel_seven_arches_task2_stage2_compatibility_receipt_immutable;
    update public.hotel_seven_arches_task2_stage2_compatibility_receipts
      set canonical_snapshot_source_hash=repeat('0',64) where id=1;
    if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
      raise exception 'pricing_activation_recursion_projector_pin_drift_accepted';
    end if;
    raise exception 'pricing_activation_recursion_projector_pin_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_recursion_projector_pin_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true then
    raise exception 'pricing_activation_recursion_projector_pin_probe_failed:%',v_message;
  end if;

  -- Receipt trigger topology and raw browser ACL are independently protected.
  v_failed:=false;
  begin
    alter table public.hotel_seven_arches_task2_stage2_compatibility_receipts
      disable trigger hotel_seven_arches_task2_stage2_compatibility_receipt_immutable;
    if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
      raise exception 'pricing_activation_recursion_task2_trigger_drift_accepted';
    end if;
    raise exception 'pricing_activation_recursion_task2_trigger_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_recursion_task2_trigger_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true then
    raise exception 'pricing_activation_recursion_task2_trigger_probe_failed:%',v_message;
  end if;

  v_failed:=false;
  begin
    grant select on public.hotel_seven_arches_task2_stage2_compatibility_receipts
      to authenticated;
    if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
      raise exception 'pricing_activation_recursion_task2_acl_drift_accepted';
    end if;
    raise exception 'pricing_activation_recursion_task2_acl_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_recursion_task2_acl_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true then
    raise exception 'pricing_activation_recursion_task2_acl_probe_failed:%',v_message;
  end if;

  -- A single missing receipt constraint is independently rejected.
  v_failed:=false;
  begin
    select conname into strict v_constraint_name from pg_constraint
      where conrelid=
        'public.hotel_seven_arches_task2_stage2_compatibility_receipts'::regclass
        and contype='c' and conkey=array[2]::smallint[];
    execute format('alter table public.hotel_seven_arches_task2_stage2_compatibility_receipts drop constraint %I',
      v_constraint_name);
    if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
      raise exception 'pricing_activation_recursion_task2_constraint_drift_accepted';
    end if;
    raise exception 'pricing_activation_recursion_task2_constraint_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_recursion_task2_constraint_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true then
    raise exception 'pricing_activation_recursion_task2_constraint_probe_failed:%',v_message;
  end if;

  -- Live lower-layer source drift is distinct from corrupting its stored pin.
  for v_probe in select * from (values
    ('projector','public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()'),
    ('task2_validator','public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()'),
    ('scoped_lineage','public.hotel_v2_seven_arches_pricing_scoped_lineage()'),
    ('transaction_preservation',
      'public.hotel_v2_7a_pricing_activation_transaction_is_preserved()'),
    ('immutable','public.hotel_v2_seven_arches_pricing_activation_immutable()'),
    ('insert_guard','public.hotel_v2_seven_arches_pricing_activation_evolution_insert_guard()'),
    ('review_guard','public.hotel_v2_seven_arches_pricing_activation_review_guard()')
  ) probe(label,signature) loop
    v_failed:=false;
    begin
      v_definition:=pg_get_functiondef(to_regprocedure(v_probe.signature));
      if position(E'AS $function$\n' in v_definition)=0 then
        raise exception 'pricing_activation_recursion_live_source_probe_shape:%',v_probe.label;
      end if;
      execute replace(v_definition,E'AS $function$\n',
        E'AS $function$\n-- 114405 live source drift probe\n');
      if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
        raise exception 'pricing_activation_recursion_live_source_drift_accepted:%',
          v_probe.label;
      end if;
      raise exception 'pricing_activation_recursion_live_source_probe_rollback:%',
        v_probe.label;
    exception when raise_exception then
      get stacked diagnostics v_message=message_text;
      v_failed:=v_message='pricing_activation_recursion_live_source_probe_rollback:'||
        v_probe.label;
    end;
    if not v_failed
       or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()
         is not true then
      raise exception 'pricing_activation_recursion_live_source_probe_failed:%:%',
        v_probe.label,v_message;
    end if;
  end loop;

  -- Owner, SECURITY DEFINER, and raw EXECUTE topology are each probed for
  -- both canonical lower-layer functions; their path probes follow below.
  for v_probe in select * from (values
    ('projector_owner',
      'alter function public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot() owner to authenticated'),
    ('projector_secdef',
      'alter function public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot() security invoker'),
    ('projector_acl',
      'grant execute on function public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot() to authenticated'),
    ('task2_validator_owner',
      'alter function public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact() owner to authenticated'),
    ('task2_validator_secdef',
      'alter function public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact() security invoker'),
    ('task2_validator_acl',
      'grant execute on function public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact() to authenticated'),
    ('scoped_lineage_owner',
      'alter function public.hotel_v2_seven_arches_pricing_scoped_lineage() owner to authenticated'),
    ('scoped_lineage_secdef',
      'alter function public.hotel_v2_seven_arches_pricing_scoped_lineage() security invoker'),
    ('scoped_lineage_acl',
      'grant execute on function public.hotel_v2_seven_arches_pricing_scoped_lineage() to authenticated'),
    ('transaction_preservation_owner',
      'alter function public.hotel_v2_7a_pricing_activation_transaction_is_preserved() owner to authenticated'),
    ('transaction_preservation_secdef',
      'alter function public.hotel_v2_7a_pricing_activation_transaction_is_preserved() security invoker'),
    ('transaction_preservation_acl',
      'grant execute on function public.hotel_v2_7a_pricing_activation_transaction_is_preserved() to authenticated')
  ) probe(label,mutation) loop
    v_failed:=false;
    begin
      execute v_probe.mutation;
      begin
        if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
          raise exception 'pricing_activation_recursion_lower_security_drift_accepted:%',
            v_probe.label;
        end if;
      exception when insufficient_privilege then
        null;
      end;
      raise exception 'pricing_activation_recursion_lower_security_probe_rollback:%',
        v_probe.label;
    exception when raise_exception then
      get stacked diagnostics v_message=message_text;
      v_failed:=v_message='pricing_activation_recursion_lower_security_probe_rollback:'||
        v_probe.label;
    end;
    if not v_failed
       or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()
         is not true then
      raise exception 'pricing_activation_recursion_lower_security_probe_failed:%:%',
        v_probe.label,v_message;
    end if;
  end loop;

  -- Both canonical lower-layer functions retain exact security metadata.
  v_failed:=false;
  begin
    execute 'alter function public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot() set search_path=public';
    if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
      raise exception 'pricing_activation_recursion_projector_path_drift_accepted';
    end if;
    raise exception 'pricing_activation_recursion_projector_path_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_recursion_projector_path_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true then
    raise exception 'pricing_activation_recursion_projector_path_probe_failed:%',v_message;
  end if;

  v_failed:=false;
  begin
    execute 'alter function public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact() set search_path=public';
    if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
      raise exception 'pricing_activation_recursion_task2_validator_path_drift_accepted';
    end if;
    raise exception 'pricing_activation_recursion_task2_validator_path_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_recursion_task2_validator_path_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true then
    raise exception 'pricing_activation_recursion_task2_validator_path_probe_failed:%',v_message;
  end if;

  for v_probe in select * from (values
    ('scoped_lineage',
      'alter function public.hotel_v2_seven_arches_pricing_scoped_lineage() set search_path=public'),
    ('transaction_preservation',
      'alter function public.hotel_v2_7a_pricing_activation_transaction_is_preserved() set search_path=public')
  ) probe(label,mutation) loop
    v_failed:=false;
    begin
      execute v_probe.mutation;
      if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
        raise exception 'pricing_activation_recursion_scoped_path_drift_accepted:%',
          v_probe.label;
      end if;
      raise exception 'pricing_activation_recursion_scoped_path_probe_rollback:%',
        v_probe.label;
    exception when raise_exception then
      get stacked diagnostics v_message=message_text;
      v_failed:=v_message='pricing_activation_recursion_scoped_path_probe_rollback:'||
        v_probe.label;
    end;
    if not v_failed
       or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()
         is not true then
      raise exception 'pricing_activation_recursion_scoped_path_probe_failed:%:%',
        v_probe.label,v_message;
    end if;
  end loop;

  -- All three functions protecting the trusted review/receipt rows are pinned.
  for v_probe in select * from (values
    ('immutable','alter function public.hotel_v2_seven_arches_pricing_activation_immutable() set search_path=public'),
    ('insert_guard','alter function public.hotel_v2_seven_arches_pricing_activation_evolution_insert_guard() set search_path=public'),
    ('review_guard','alter function public.hotel_v2_seven_arches_pricing_activation_review_guard() set search_path=public')
  ) probe(label,mutation) loop
    v_failed:=false;
    begin
      execute v_probe.mutation;
      if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
        raise exception 'pricing_activation_recursion_guard_drift_accepted:%',v_probe.label;
      end if;
      raise exception 'pricing_activation_recursion_guard_probe_rollback:%',v_probe.label;
    exception when raise_exception then
      get stacked diagnostics v_message=message_text;
      v_failed:=v_message='pricing_activation_recursion_guard_probe_rollback:'||
        v_probe.label;
    end;
    if not v_failed
       or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()
         is not true then
      raise exception 'pricing_activation_recursion_guard_probe_failed:%:%',
        v_probe.label,v_message;
    end if;
  end loop;

  -- Function security metadata is part of the direct validator proof.
  v_failed:=false;
  begin
    execute 'alter function public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() set search_path=public';
    if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
      raise exception 'pricing_activation_recursion_validator_path_drift_accepted';
    end if;
    raise exception 'pricing_activation_recursion_validator_path_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_recursion_validator_path_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true then
    raise exception 'pricing_activation_recursion_validator_path_probe_failed:%',v_message;
  end if;
  v_passed_probe_labels:=array_append(v_passed_probe_labels,'function_search_path');

  -- ADMIN-D must retain the sole wrapper-to-inert-core substitution.
  v_failed:=false;
  begin
    v_definition:=pg_get_functiondef(
      'public.hotel_v2_admin_d_current_foundation_snapshot()'::regprocedure);
    if (length(v_definition)-length(replace(v_definition,
         'v_h3:=public.hotel_v2_h3_1p_pricing_promotion_snapshot_inert_core(c_hotel);','')))
         /length('v_h3:=public.hotel_v2_h3_1p_pricing_promotion_snapshot_inert_core(c_hotel);')<>1 then
      raise exception 'pricing_activation_recursion_admin_d_mapping_probe_shape';
    end if;
    execute replace(v_definition,
      'v_h3:=public.hotel_v2_h3_1p_pricing_promotion_snapshot_inert_core(c_hotel);',
      'v_h3:=public.hotel_v2_h3_1p_pricing_promotion_snapshot(c_hotel);');
    if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
      raise exception 'pricing_activation_recursion_admin_d_mapping_drift_accepted';
    end if;
    raise exception 'pricing_activation_recursion_admin_d_mapping_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_recursion_admin_d_mapping_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true then
    raise exception 'pricing_activation_recursion_admin_d_mapping_probe_failed:%',v_message;
  end if;
  v_passed_probe_labels:=array_append(v_passed_probe_labels,'admin_d_mapping');

  -- The reviewed parity fingerprint remains bound to the current 70-case oracle.
  v_failed:=false;
  begin
    alter table public.hotel_seven_arches_pricing_activation_evolution_receipts
      disable trigger hotel_seven_arches_pricing_activation_evolution_immutable;
    update public.hotel_seven_arches_pricing_activation_evolution_receipts
      set parity_fingerprint=repeat('0',32) where id=1;
    if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
      raise exception 'pricing_activation_recursion_parity_drift_accepted';
    end if;
    raise exception 'pricing_activation_recursion_parity_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_recursion_parity_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true then
    raise exception 'pricing_activation_recursion_parity_probe_failed:%',v_message;
  end if;
  v_passed_probe_labels:=array_append(v_passed_probe_labels,'parity_binding');

  -- Hotel, Partner, and assignment authority are checked independently.
  v_failed:=false;
  begin
    alter table public.hotel_seven_arches_pricing_activation_evolution_receipts
      disable trigger hotel_seven_arches_pricing_activation_evolution_immutable;
    select conname into strict v_constraint_name from pg_constraint
      where conrelid=
        'public.hotel_seven_arches_pricing_activation_evolution_receipts'::regclass
        and contype='c' and conkey=array[5]::smallint[];
    execute format('alter table public.hotel_seven_arches_pricing_activation_evolution_receipts drop constraint %I',
      v_constraint_name);
    update public.hotel_seven_arches_pricing_activation_evolution_receipts
      set hotel_id='c1000000-0000-4000-8000-000000000001'::uuid where id=1;
    if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
      raise exception 'pricing_activation_recursion_hotel_binding_drift_accepted';
    end if;
    raise exception 'pricing_activation_recursion_hotel_binding_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_recursion_hotel_binding_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true then
    raise exception 'pricing_activation_recursion_hotel_binding_probe_failed:%',v_message;
  end if;
  v_passed_probe_labels:=array_append(v_passed_probe_labels,'hotel_binding');

  v_failed:=false;
  begin
    update public.partners set can_manage_hotels=false where id=(select partner_id
      from public.hotel_admin_availability_foundation_evolution_receipts where id=1);
    if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
      raise exception 'pricing_activation_recursion_partner_binding_drift_accepted';
    end if;
    raise exception 'pricing_activation_recursion_partner_binding_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_recursion_partner_binding_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true then
    raise exception 'pricing_activation_recursion_partner_binding_probe_failed:%',v_message;
  end if;
  v_passed_probe_labels:=array_append(v_passed_probe_labels,'partner_binding');

  select foundation.assignment_id,assignment.resource_id
  into strict v_assignment_id,v_assignment_resource_before
  from public.hotel_admin_availability_foundation_evolution_receipts foundation
  join public.partner_resources assignment on assignment.id=foundation.assignment_id
  where foundation.id=1;
  v_pricing_state_before:=
    public.hotel_v2_seven_arches_pricing_activation_snapshot();
  v_current_safe_before:=
    public.hotel_v2_seven_arches_pricing_activation_current_is_safe();
  select jsonb_build_object(
    'receipt_review_id',receipt.review_id,
    'receipt_correlation_id',receipt.correlation_id,
    'review',to_jsonb(review_row))
  into strict v_review_binding_before
  from public.hotel_seven_arches_pricing_activation_evolution_receipts receipt
  join public.hotel_seven_arches_pricing_activation_reviews review_row
    on review_row.id=receipt.review_id
  where receipt.id=1;
  if v_current_safe_before is not true then
    raise exception 'pricing_activation_recursion_assignment_binding_baseline_invalid';
  end if;

  v_failed:=false;
  v_sqlstate:=null;
  v_message:=null;
  begin
    update public.partner_resources
      set resource_id='ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid
      where id=v_assignment_id;
    if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
      raise exception 'pricing_activation_recursion_assignment_binding_drift_accepted';
    end if;
    raise exception 'pricing_activation_recursion_assignment_binding_probe_rollback';
  exception
    when foreign_key_violation or raise_exception then
      get stacked diagnostics
        v_sqlstate=returned_sqlstate,
        v_message=message_text;
      if v_sqlstate='23503'
         and v_message='hotels_v2_admin_b_assignment_property_not_found' then
        v_failed:=true;
      elsif v_sqlstate='P0001'
         and v_message='pricing_activation_recursion_assignment_binding_probe_rollback' then
        v_failed:=true;
      else
        raise exception 'pricing_activation_recursion_assignment_binding_probe_unexpected:%:%:%',
          'assignment_binding',v_sqlstate,v_message;
      end if;
    when others then
      get stacked diagnostics
        v_sqlstate=returned_sqlstate,
        v_message=message_text;
      raise exception 'pricing_activation_recursion_assignment_binding_probe_unexpected:%:%:%',
        'assignment_binding',v_sqlstate,v_message;
  end;
  if not v_failed
     or (select count(*) from public.partner_resources where id=v_assignment_id)<>1
     or (select resource_id from public.partner_resources where id=v_assignment_id)
       is distinct from v_assignment_resource_before
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true
     or public.hotel_v2_seven_arches_pricing_activation_current_is_safe()
       is distinct from v_current_safe_before
     or public.hotel_v2_seven_arches_pricing_activation_snapshot()
       is distinct from v_pricing_state_before
     or (select jsonb_build_object(
           'receipt_review_id',receipt.review_id,
           'receipt_correlation_id',receipt.correlation_id,
           'review',to_jsonb(review_row))
         from public.hotel_seven_arches_pricing_activation_evolution_receipts receipt
         join public.hotel_seven_arches_pricing_activation_reviews review_row
           on review_row.id=receipt.review_id
         where receipt.id=1) is distinct from v_review_binding_before then
    raise exception 'pricing_activation_recursion_assignment_binding_probe_failed:%:%',
      v_sqlstate,v_message;
  end if;
  v_passed_probe_labels:=array_append(v_passed_probe_labels,'assignment_binding');

  v_failed:=false;
  begin
    alter table public.hotel_seven_arches_pricing_activation_evolution_receipts
      disable trigger hotel_seven_arches_pricing_activation_evolution_immutable;
    update public.hotel_seven_arches_pricing_activation_evolution_receipts
      set correlation_id='39000000-0000-4000-8000-000000000099'::uuid where id=1;
    if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
      raise exception 'pricing_activation_recursion_review_correlation_drift_accepted';
    end if;
    raise exception 'pricing_activation_recursion_review_correlation_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_recursion_review_correlation_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true then
    raise exception 'pricing_activation_recursion_review_correlation_probe_failed:%',v_message;
  end if;
  v_passed_probe_labels:=array_append(v_passed_probe_labels,'review_correlation_binding');

  -- The five-key delta envelope rejects an altered allowlist, an unchanged
  -- declared key, and any unrelated live change even with coherent self-hash.
  v_failed:=false;
  begin
    select conname into strict v_constraint_name from pg_constraint
      where conrelid=
        'public.hotel_seven_arches_pricing_activation_evolution_receipts'::regclass
        and contype='c'
        and position('allowed_fingerprint_keys' in pg_get_expr(conbin,conrelid))>0
        and position('stage2_allowed_fingerprint_keys' in pg_get_expr(conbin,conrelid))=0;
    alter table public.hotel_seven_arches_pricing_activation_evolution_receipts
      disable trigger hotel_seven_arches_pricing_activation_evolution_immutable;
    execute format('alter table public.hotel_seven_arches_pricing_activation_evolution_receipts drop constraint %I',
      v_constraint_name);
    update public.hotel_seven_arches_pricing_activation_evolution_receipts
      set allowed_fingerprint_keys=array['hotel_rate_plans']::text[] where id=1;
    if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
      raise exception 'pricing_activation_recursion_allowlist_drift_accepted';
    end if;
    raise exception 'pricing_activation_recursion_allowlist_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_recursion_allowlist_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true then
    raise exception 'pricing_activation_recursion_allowlist_probe_failed:%',v_message;
  end if;

  v_failed:=false;
  begin
    alter table public.hotel_seven_arches_pricing_activation_evolution_receipts
      disable trigger hotel_seven_arches_pricing_activation_evolution_immutable;
    update public.hotel_seven_arches_pricing_activation_evolution_receipts set
      after_protected_fingerprints=jsonb_set(after_protected_fingerprints,
        '{hotel_rate_plans}',before_protected_fingerprints->'hotel_rate_plans',false),
      after_protected_fingerprint=public.hotel_v2_h3_2b_hash(jsonb_set(
        after_protected_fingerprints,'{hotel_rate_plans}',
        before_protected_fingerprints->'hotel_rate_plans',false))
    where id=1;
    if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
      raise exception 'pricing_activation_recursion_unchanged_allowed_key_accepted';
    end if;
    raise exception 'pricing_activation_recursion_unchanged_allowed_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_recursion_unchanged_allowed_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true then
    raise exception 'pricing_activation_recursion_unchanged_allowed_probe_failed:%',v_message;
  end if;

  v_failed:=false;
  begin
    alter table public.hotel_seven_arches_pricing_activation_evolution_receipts
      disable trigger hotel_seven_arches_pricing_activation_evolution_immutable;
    update public.hotel_seven_arches_pricing_activation_evolution_receipts set
      after_stage2_protected_fingerprints=after_stage2_protected_fingerprints||
        jsonb_build_object('unexpected_probe',repeat('a',64)),
      after_stage2_protected_fingerprint=
        public.hotel_v2_external_calendar_worker_hash(
          after_stage2_protected_fingerprints||
            jsonb_build_object('unexpected_probe',repeat('a',64)))
    where id=1;
    if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
      raise exception 'pricing_activation_recursion_unrelated_delta_accepted';
    end if;
    raise exception 'pricing_activation_recursion_unrelated_delta_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_recursion_unrelated_delta_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true then
    raise exception 'pricing_activation_recursion_unrelated_delta_probe_failed:%',v_message;
  end if;

  -- Every Hotels lifecycle flag failure, including external NULL, is isolated.
  for v_probe in select * from (values
    ('rooms','update public.site_settings set hotel_rooms_v2_enabled=true where id=1'),
    ('instant','update public.site_settings set hotel_instant_booking_enabled=true where id=1'),
    ('stripe','update public.site_settings set hotel_stripe_connect_enabled=true where id=1'),
    ('external_null','update public.site_settings set hotel_external_sync_enabled=null where id=1')
  ) probe(label,mutation) loop
    v_failed:=false;
    begin
      if v_probe.label='external_null' then
        alter table public.site_settings
          alter column hotel_external_sync_enabled drop not null;
      end if;
      execute v_probe.mutation;
      if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
        raise exception 'pricing_activation_recursion_flag_drift_accepted:%',v_probe.label;
      end if;
      raise exception 'pricing_activation_recursion_flag_probe_rollback:%',v_probe.label;
    exception when raise_exception then
      get stacked diagnostics v_message=message_text;
      v_failed:=v_message='pricing_activation_recursion_flag_probe_rollback:'||v_probe.label;
    end;
    if not v_failed
       or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()
         is not true then
      raise exception 'pricing_activation_recursion_flag_probe_failed:%:%',
        v_probe.label,v_message;
    end if;
  end loop;

  -- A protected live price drift is rejected.  The subtransaction rolls back
  -- the temporary trigger change and queued deferred graph event together.
  v_failed:=false;
  begin
    alter table public.hotel_room_rates
      disable trigger hotel_room_rates_admin_c_h3_1p_freeze;
    update public.hotel_room_rates set base_nightly_rate=base_nightly_rate+1
      where id='7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid;
    if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() then
      raise exception 'pricing_activation_recursion_rate_drift_accepted';
    end if;
    raise exception 'pricing_activation_recursion_rate_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='pricing_activation_recursion_rate_probe_rollback';
  end;
  if not v_failed
     or public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true then
    raise exception 'pricing_activation_recursion_rate_probe_failed:%',v_message;
  end if;

  -- Repeated calls across every former edge prove finite, stable agreement.
  for v_index in 1..3 loop
    if public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() is not true
       or public.hotel_v2_seven_arches_pricing_activation_current_is_safe() is not true then
      raise exception 'pricing_activation_recursion_repeated_safe_failed:%',v_index;
    end if;
    v_value:=public.hotel_v2_seven_arches_pricing_activation_snapshot();
    if v_value->>'status'<>'active' then
      raise exception 'pricing_activation_recursion_repeated_snapshot_failed:%',v_index;
    end if;
    v_value:=public.hotel_v2_seven_arches_pricing_scoped_lineage();
    if v_value->>'contract_version' is distinct from
         'hotels_v2_seven_arches_pricing_scoped_lineage_v1'
       or public.hotel_v2_7a_pricing_activation_transaction_is_preserved()
         is not true then
      raise exception 'pricing_activation_recursion_repeated_scoped_lineage_failed:%',
        v_index;
    end if;
    v_value:=public.hotel_v2_admin_d_current_foundation_snapshot();
    if v_value->>'contract_version'<>'hotels_v2_admin_d_current_foundation_v1' then
      raise exception 'pricing_activation_recursion_repeated_admin_d_failed:%',v_index;
    end if;
    v_value:=public.hotel_v2_h3_1p_pricing_promotion_snapshot(c_hotel);
    if v_value#>>'{activation,status}'<>'active' then
      raise exception 'pricing_activation_recursion_repeated_promotion_failed:%',v_index;
    end if;
  end loop;
  if cardinality(v_passed_probe_labels)<>cardinality(v_required_probe_labels)
     or not (v_passed_probe_labels@>v_required_probe_labels
       and v_required_probe_labels@>v_passed_probe_labels) then
    raise exception 'pricing_activation_recursion_required_probe_coverage_mismatch:%:%',
      v_required_probe_labels,v_passed_probe_labels;
  end if;
  perform set_config('test.hotels_114405_required_probe_count',
    cardinality(v_passed_probe_labels)::text,false);
  perform set_config('test.hotels_114405_required_probe_labels',
    array_to_string(v_passed_probe_labels,','),false);
end
$recursion_compatibility_negative_and_acyclic_gate$;
commit;

select
  'HOTELS_V2_7A_PRICING_ACTIVATION_RECURSION_POSTGRES_GATE_OK' sentinel,
  public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact() receipt_exact,
  public.hotel_v2_seven_arches_pricing_activation_current_is_safe() current_safe,
  current_setting('test.hotels_114405_call_shape_case_count')::integer
    call_shape_case_count,
  current_setting('test.hotels_114405_required_probe_count')::integer required_probe_count,
  current_setting('test.hotels_114405_required_probe_labels') required_probe_labels,
  current_setting('test.hotels_114405_failed_activation_rollback')::boolean
    failed_activation_rollback_contained;
