\set ON_ERROR_STOP on
\if :{?provider_install_external_enabled}
\else
\set provider_install_external_enabled false
\endif
\if :{?provider_booking_only}
\else
\set provider_booking_only false
\endif
\ir hotels-v2-seven-arches-pricing-activation-postgres-base.sql
\ir ../../supabase/migrations/20260811440000_hotels_v2_seven_arches_pricing_activation.sql
do $task3_workspace_lineage_guard$
declare v_definition text; v_needle text; v_message text; v_rolled_back boolean:=false;
begin
  if not public.hotel_v2_seven_arches_pricing_activation_current_is_safe() then
    raise exception 'seven_arches_task3_workspace_lineage_baseline_failed';
  end if;
  begin
    v_definition:=pg_get_functiondef(
      'public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)'::regprocedure);
    v_needle:='where draft.assignment_id=(v_access->>''assignment_id'')::uuid'
      ||E'\n    and draft.status=''pending_admin_review'';';
    if (length(v_definition)-length(replace(v_definition,v_needle,'')))/length(v_needle)<>1 then
      raise exception 'seven_arches_task3_workspace_lineage_probe_source_drift';
    end if;
    execute replace(v_definition,v_needle,
      'where draft.assignment_id=(v_access->>''assignment_id'')::uuid'
        ||E'\n    and (draft.status=''pending_admin_review'');');
    if public.hotel_v2_partner_workspace_function_lineage_is_exact()
       or public.hotel_v2_seven_arches_pricing_activation_current_is_safe() then
      raise exception 'seven_arches_task3_workspace_lineage_drift_was_accepted';
    end if;
    raise exception 'seven_arches_task3_workspace_lineage_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=v_message='seven_arches_task3_workspace_lineage_probe_rollback';
  end;
  if not v_rolled_back
     or not public.hotel_v2_partner_workspace_function_lineage_is_exact()
     or not public.hotel_v2_seven_arches_pricing_activation_current_is_safe() then
    raise exception 'seven_arches_task3_workspace_lineage_negative_failed';
  end if;
end
$task3_workspace_lineage_guard$;
\ir ../../supabase/migrations/20260811442500_hotels_v2_external_calendar_site_settings_compatibility.sql
\if :provider_install_external_enabled
do $site_settings_on$
begin
  if not (select hotel_external_sync_enabled from public.site_settings where id=1)
     or public.hotel_v2_external_calendar_site_settings_fingerprint() is null
     or not public.hotel_v2_partner_workspace_function_lineage_is_exact() then
    raise exception 'seven_arches_provider_on_site_settings_seam_failed';
  end if;
end
$site_settings_on$;
\else
do $site_settings_off$
begin
  if (select hotel_external_sync_enabled from public.site_settings where id=1)
     or public.hotel_v2_external_calendar_site_settings_fingerprint() is null
     or not public.hotel_v2_partner_workspace_function_lineage_is_exact() then
    raise exception 'seven_arches_provider_off_site_settings_seam_failed';
  end if;
end
$site_settings_off$;
\endif
\ir ../../supabase/manual/hotels_v2_external_calendar_provider_types_preflight.sql
\ir ../../supabase/migrations/20260811445000_hotels_v2_external_calendar_provider_types.sql

do $provider_attribution_static$
declare v_oid oid:=to_regprocedure(
  'public.hotel_v2_external_calendar_provider_sources_are_attributable()');
begin
  if v_oid is null or (select proowner from pg_proc where oid=v_oid)<>'postgres'::regrole
     or not (select prosecdef from pg_proc where oid=v_oid)
     or (select proconfig from pg_proc where oid=v_oid)
       is distinct from array['search_path=pg_catalog, public']::text[]
     or has_function_privilege(0::oid,v_oid,'EXECUTE')
     or has_function_privilege('anon',v_oid,'EXECUTE')
     or has_function_privilege('authenticated',v_oid,'EXECUTE')
     or has_function_privilege('service_role',v_oid,'EXECUTE')
     or (select provider_source_attribution_source_hash
       from public.hotel_partner_property_proposal_foundation_receipts where id=1)
       is distinct from public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(v_oid)))
     or exists(select 1
       from public.hotel_seven_arches_pricing_activation_evolution_receipts activation
       join hotels_v2_private.hotel_external_calendar_provider_evolution_receipts receipt
         on receipt.id=activation.id
       where exists(select 1
         from unnest(activation.stage2_allowed_fingerprint_keys) changed(changed_key)
         where receipt.prior_compatible_fingerprints->(changed.changed_key)
           is distinct from activation.before_stage2_protected_fingerprints->(changed.changed_key)))
     or not public.hotel_v2_external_calendar_provider_sources_are_attributable()
     or not public.hotel_v2_external_calendar_provider_evolution_is_safe() then
    raise exception 'seven_arches_provider_attribution_static_confidence_failed';
  end if;
end
$provider_attribution_static$;

-- Task3 receipt normalization must fail closed independently of the provider
-- attribution ledger.  Every mutation below is contained by a PL/pgSQL
-- exception subtransaction, including temporary trigger/constraint DDL.
do $provider_task3_normalization_negatives$
declare v_activation public.hotel_seven_arches_pricing_activation_evolution_receipts%rowtype;
  v_activation_count integer; v_message text; v_rolled_back boolean;
  v_constraint text; v_unrelated_key text; v_after_prior jsonb;
begin
  select count(*) into v_activation_count
  from public.hotel_seven_arches_pricing_activation_evolution_receipts;
  if v_activation_count=0 then
    if (select receipt.prior_compatible_fingerprints
        from hotels_v2_private.hotel_external_calendar_provider_evolution_receipts receipt where receipt.id=1)
       is distinct from jsonb_set(public.hotel_v2_external_calendar_stage2_compatible_fingerprints(),
         '{site_settings}',to_jsonb(public.hotel_v2_external_calendar_site_settings_fingerprint()),false) then
      raise exception 'seven_arches_provider_no_task3_identity_failed';
    end if;
    return;
  elsif v_activation_count<>1 then
    raise exception 'seven_arches_provider_task3_receipt_cardinality_failed';
  end if;
  select * into strict v_activation
  from public.hotel_seven_arches_pricing_activation_evolution_receipts where id=1;

  -- A: current protected state no longer equals the exact receipt AFTER state.
  v_rolled_back:=false;
  begin
    update public.hotel_activity_log set after_state=after_state||'{"_provider_probe":true}'::jsonb
    where id=v_activation.activity_ids[1];
    if public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_task3_current_after_drift_accepted'; end if;
    raise exception 'seven_arches_provider_task3_current_after_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=v_message='seven_arches_provider_task3_current_after_probe_rollback';
  end;
  if not v_rolled_back then raise exception 'seven_arches_provider_task3_current_after_negative_failed'; end if;

  -- B: immutable BEFORE hash no longer self-hashes.
  v_rolled_back:=false;
  begin
    alter table public.hotel_seven_arches_pricing_activation_evolution_receipts
      disable trigger hotel_seven_arches_pricing_activation_evolution_immutable;
    update public.hotel_seven_arches_pricing_activation_evolution_receipts
      set before_stage2_protected_fingerprint=repeat('a',64) where id=1;
    if public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_task3_before_hash_drift_accepted'; end if;
    raise exception 'seven_arches_provider_task3_before_hash_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=v_message='seven_arches_provider_task3_before_hash_probe_rollback';
  end;
  if not v_rolled_back then raise exception 'seven_arches_provider_task3_before_hash_negative_failed'; end if;

  -- C: immutable AFTER hash no longer self-hashes.
  v_rolled_back:=false;
  begin
    alter table public.hotel_seven_arches_pricing_activation_evolution_receipts
      disable trigger hotel_seven_arches_pricing_activation_evolution_immutable;
    update public.hotel_seven_arches_pricing_activation_evolution_receipts
      set after_stage2_protected_fingerprint=repeat('b',64) where id=1;
    if public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_task3_after_hash_drift_accepted'; end if;
    raise exception 'seven_arches_provider_task3_after_hash_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=v_message='seven_arches_provider_task3_after_hash_probe_rollback';
  end;
  if not v_rolled_back then raise exception 'seven_arches_provider_task3_after_hash_negative_failed'; end if;

  -- D: the exact five-key allowlist cannot be broadened or narrowed.
  select constraint_row.conname into strict v_constraint
  from pg_constraint constraint_row
  where constraint_row.conrelid=
      'public.hotel_seven_arches_pricing_activation_evolution_receipts'::regclass
    and constraint_row.contype='c'
    and pg_get_constraintdef(constraint_row.oid) like '%stage2_allowed_fingerprint_keys%';
  v_rolled_back:=false;
  begin
    execute format('alter table public.hotel_seven_arches_pricing_activation_evolution_receipts drop constraint %I',
      v_constraint);
    alter table public.hotel_seven_arches_pricing_activation_evolution_receipts
      disable trigger hotel_seven_arches_pricing_activation_evolution_immutable;
    update public.hotel_seven_arches_pricing_activation_evolution_receipts
      set stage2_allowed_fingerprint_keys=array['hotel_rate_plans']::text[] where id=1;
    if public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_task3_allowlist_drift_accepted'; end if;
    raise exception 'seven_arches_provider_task3_allowlist_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=v_message='seven_arches_provider_task3_allowlist_probe_rollback';
  end;
  if not v_rolled_back then raise exception 'seven_arches_provider_task3_allowlist_negative_failed'; end if;

  -- E: an unrelated protected key cannot be absorbed into the AFTER receipt.
  select key_name into strict v_unrelated_key
  from jsonb_object_keys(v_activation.after_stage2_protected_fingerprints) key_row(key_name)
  where key_name<>all(v_activation.stage2_allowed_fingerprint_keys)
  order by key_name limit 1;
  v_rolled_back:=false;
  begin
    alter table public.hotel_seven_arches_pricing_activation_evolution_receipts
      disable trigger hotel_seven_arches_pricing_activation_evolution_immutable;
    update public.hotel_seven_arches_pricing_activation_evolution_receipts set
      after_stage2_protected_fingerprints=jsonb_set(after_stage2_protected_fingerprints,
        array[v_unrelated_key],'"provider-probe"'::jsonb,false),
      after_stage2_protected_fingerprint=public.hotel_v2_external_calendar_worker_hash(
        jsonb_set(after_stage2_protected_fingerprints,array[v_unrelated_key],
          '"provider-probe"'::jsonb,false))
      where id=1;
    if public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_task3_unrelated_key_drift_accepted'; end if;
    raise exception 'seven_arches_provider_task3_unrelated_key_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=v_message='seven_arches_provider_task3_unrelated_key_probe_rollback';
  end;
  if not v_rolled_back then raise exception 'seven_arches_provider_task3_unrelated_key_negative_failed'; end if;

  -- F: deleting Task3 cannot turn its current AFTER state into a no-receipt
  -- identity baseline, even if a trusted writer also rewrites provider prior.
  v_after_prior:=jsonb_set(v_activation.after_stage2_protected_fingerprints,
    '{site_settings}',to_jsonb(public.hotel_v2_external_calendar_site_settings_fingerprint()),false);
  v_rolled_back:=false;
  begin
    alter table public.hotel_seven_arches_pricing_activation_evolution_receipts
      disable trigger hotel_seven_arches_pricing_activation_evolution_immutable;
    alter table hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
      disable trigger hotel_external_calendar_provider_evolution_receipt_immutable;
    update hotels_v2_private.hotel_external_calendar_provider_evolution_receipts set
      prior_compatible_fingerprints=v_after_prior,
      prior_compatible_fingerprint=public.hotel_v2_external_calendar_worker_hash(v_after_prior)
      where id=1;
    delete from public.hotel_seven_arches_pricing_activation_evolution_receipts where id=1;
    if public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_task3_missing_receipt_after_prior_accepted'; end if;
    raise exception 'seven_arches_provider_task3_missing_receipt_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=v_message='seven_arches_provider_task3_missing_receipt_probe_rollback';
  end;
  if not v_rolled_back then raise exception 'seven_arches_provider_task3_missing_receipt_negative_failed'; end if;

  if not public.hotel_v2_external_calendar_provider_evolution_is_safe() then
    raise exception 'seven_arches_provider_task3_normalization_not_restored'; end if;
end
$provider_task3_normalization_negatives$;

create function pg_temp.seven_arches_provider_attribution_probe()
returns jsonb language sql stable security definer set search_path=pg_catalog,public
as $function$
select jsonb_build_object(
  'sources_attributable',public.hotel_v2_external_calendar_provider_sources_are_attributable(),
  'provider_safe',public.hotel_v2_external_calendar_provider_evolution_is_safe())
$function$;
revoke all on function pg_temp.seven_arches_provider_attribution_probe()
  from public,anon,authenticated,service_role;
grant execute on function pg_temp.seven_arches_provider_attribution_probe() to authenticated;

begin;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000008"}',true);

do $admin_booking_source$
declare c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_upper constant uuid:='b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
  c_ground constant uuid:='825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
  v_control jsonb; v_preview jsonb; v_apply jsonb; v_probe jsonb;
  v_source uuid; v_failed boolean;
begin
  v_control:=public.hotel_v2_admin_get_external_calendar_control(c_hotel);
  if v_control->>'contract_version'<>'hotels_v2_external_calendar_control_v1'
     or jsonb_typeof(v_control->'hotel_external_sync_enabled')<>'boolean'
     or jsonb_array_length(v_control->'rooms')<>2
     or jsonb_array_length(v_control->'sources')<>0
     or (select count(*) from jsonb_array_elements(v_control->'rooms') room
       where (room->>'id')::uuid in(c_upper,c_ground))<>2 then
    raise exception 'seven_arches_external_initial_control_mismatch:%',v_control; end if;

  v_preview:=public.hotel_v2_admin_preview_external_calendar_plan(jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_draft_v1','hotel_id',c_hotel,
    'partner_id',null,'assignment_id',null,'permission_version',null,
    'access_snapshot_token',null,'snapshot_token',v_control->>'snapshot_token','intent',jsonb_build_object(
      'entity','calendar_source','action','create','id',null,'expected_version',0,
      'payload',jsonb_build_object('room_type_id',c_upper,'code','upper-primary',
        'source_type','booking_com','sync_interval_minutes',60,'units_per_event',1,'priority',30),
      'reason','Create reviewed Booking.com ICS source')));
  if v_preview->>'changed'<>'true'
     or v_preview#>>'{reviewed_plan,operations,0,payload,source_type}'<>'booking_com'
     or v_preview#>'{impacts,0,fields}'<>
       '["code","priority","room_type_id","source_type","sync_interval_minutes","units_per_event"]'::jsonb then
    raise exception 'seven_arches_booking_com_preview_mismatch:%',v_preview; end if;
  v_source:=(v_preview#>>'{reviewed_plan,operations,0,id}')::uuid;
  v_apply:=public.hotel_v2_admin_apply_external_calendar_plan(v_preview->'reviewed_plan',
    'e7400000-0000-4000-8000-000000000001','e7410000-0000-4000-8000-000000000001',null);
  if v_apply->>'changed'<>'true' or v_apply->>'replayed'<>'false'
     or v_apply#>>'{activity,0,source}'<>'hotels_v2_external_calendar_control'
     or not exists(select 1 from jsonb_array_elements(v_apply#>'{control,sources}') source
       where (source->>'id')::uuid=v_source and source->>'source_type'='booking_com'
         and (source->>'room_type_id')::uuid=c_upper
         and source->>'secret_configured'='false' and source->'health'->>'status'='never_synced') then
    raise exception 'seven_arches_booking_com_apply_mismatch:%',v_apply; end if;
  v_probe:=pg_temp.seven_arches_provider_attribution_probe();
  if v_probe is distinct from
      '{"provider_safe":true,"sources_attributable":true}'::jsonb then
    raise exception 'seven_arches_booking_com_first_apply_not_attributable:%',v_probe;
  end if;
end
$admin_booking_source$;

\if :provider_booking_only
rollback;
select true as hotels_v2_seven_arches_booking_com_attribution_postgres_gate_passed;
\quit
\endif

do $admin_additional_sources$
declare c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_ground constant uuid:='825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
  v_control jsonb; v_preview jsonb; v_apply jsonb; v_probe jsonb;
  v_source uuid; v_failed boolean;
begin
  v_control:=public.hotel_v2_admin_get_external_calendar_control(c_hotel);
  select (source->>'id')::uuid into strict v_source
    from jsonb_array_elements(v_control->'sources') source
    where source->>'source_type'='booking_com' and source->>'code'='upper-primary';

  v_preview:=public.hotel_v2_admin_preview_external_calendar_plan(jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_draft_v1','hotel_id',c_hotel,
    'partner_id',null,'assignment_id',null,'permission_version',null,
    'access_snapshot_token',null,'snapshot_token',v_control->>'snapshot_token','intent',jsonb_build_object(
      'entity','calendar_source','action','create','id',null,'expected_version',0,
      'payload',jsonb_build_object('room_type_id',c_ground,'code','ground-secondary',
        'source_type','ical','sync_interval_minutes',120,'units_per_event',1,'priority',10),
      'reason','Create reviewed generic iCalendar source')));
  v_apply:=public.hotel_v2_admin_apply_external_calendar_plan(v_preview->'reviewed_plan',
    'e7400000-0000-4000-8000-000000000002','e7410000-0000-4000-8000-000000000002',null);
  if not exists(select 1 from jsonb_array_elements(v_apply#>'{control,sources}') source
       where source->>'source_type'='ical' and (source->>'room_type_id')::uuid=c_ground
         and source->>'secret_configured'='false') then
    raise exception 'seven_arches_ical_apply_mismatch:%',v_apply; end if;
  v_probe:=pg_temp.seven_arches_provider_attribution_probe();
  if v_probe is distinct from
      '{"provider_safe":true,"sources_attributable":true}'::jsonb then
    raise exception 'seven_arches_admin_ical_apply_not_attributable:%',v_probe; end if;

  v_control:=v_apply->'control';
  v_preview:=public.hotel_v2_admin_preview_external_calendar_plan(jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_draft_v1','hotel_id',c_hotel,
    'partner_id',null,'assignment_id',null,'permission_version',null,
    'access_snapshot_token',null,'snapshot_token',v_control->>'snapshot_token','intent',jsonb_build_object(
      'entity','calendar_source','action','create','id',null,'expected_version',0,
      'payload',jsonb_build_object('room_type_id',c_ground,'code','ground-admin-airbnb',
        'source_type','airbnb','sync_interval_minutes',180,'units_per_event',1,'priority',5),
      'reason','Create second reviewed Admin Airbnb ICS source')));
  v_apply:=public.hotel_v2_admin_apply_external_calendar_plan(v_preview->'reviewed_plan',
    'e7400000-0000-4000-8000-000000000007','e7410000-0000-4000-8000-000000000007',null);
  if not exists(select 1 from jsonb_array_elements(v_apply#>'{control,sources}') source
       where source->>'source_type'='airbnb' and source->>'code'='ground-admin-airbnb'
         and (source->>'room_type_id')::uuid=c_ground and source->>'secret_configured'='false') then
    raise exception 'seven_arches_admin_airbnb_apply_mismatch:%',v_apply; end if;
  v_probe:=pg_temp.seven_arches_provider_attribution_probe();
  if v_probe is distinct from
      '{"provider_safe":true,"sources_attributable":true}'::jsonb then
    raise exception 'seven_arches_admin_airbnb_apply_not_attributable:%',v_probe; end if;

  -- Global activation remains manual-only. Enable and manual trigger cannot
  -- produce a review while the flag is OFF and no Vault URL is configured.
  if v_control->>'hotel_external_sync_enabled'='false' then
    v_control:=v_apply->'control';
    v_preview:=public.hotel_v2_admin_preview_external_calendar_plan(jsonb_build_object(
      'contract_version','hotels_v2_external_calendar_draft_v1','hotel_id',c_hotel,
      'partner_id',null,'assignment_id',null,'permission_version',null,
      'access_snapshot_token',null,'snapshot_token',v_control->>'snapshot_token','intent',jsonb_build_object(
        'entity','calendar_source','action','enable','id',v_source,'expected_version',1,
        'payload','{}'::jsonb,'reason','Request enable before operator activation')));
    if v_preview->>'changed'<>'false' or v_preview->'reviewed_plan'<>'null'::jsonb
       or v_preview->'blocking_reasons'<>'["external_calendar_not_activated"]'::jsonb then
      raise exception 'seven_arches_enable_not_safely_blocked:%',v_preview; end if;
    v_failed:=false;
    begin
      perform public.hotel_v2_admin_preview_external_calendar_plan(jsonb_build_object(
        'contract_version','hotels_v2_external_calendar_draft_v1','hotel_id',c_hotel,
        'partner_id',null,'assignment_id',null,'permission_version',null,
        'access_snapshot_token',null,'snapshot_token',v_control->>'snapshot_token','intent',jsonb_build_object(
          'entity','calendar_sync','action','trigger','id',v_source,'expected_version',0,
          'payload',jsonb_build_object('source_id',v_source),'reason','Request manual sync before configuration')));
    exception when check_violation then
      v_failed:=sqlerrm='hotels_v2_external_calendar_source_not_triggerable'; end;
    if not v_failed then raise exception 'seven_arches_unconfigured_manual_sync_allowed'; end if;
  end if;
  if v_apply::text~'"(ical_url|configuration|external_reference|vault_secret_id)"' then
    raise exception 'seven_arches_control_secret_leak'; end if;
end
$admin_additional_sources$;

reset role;
do $provider_attribution_negatives$
declare c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_foreign_hotel constant uuid:='c1000000-0000-4000-8000-000000000001';
  c_foreign_room constant uuid:='c1100000-0000-4000-8000-000000000001';
  c_partner constant uuid:='20000000-0000-4000-8000-000000000001';
  c_partner_actor constant uuid:='10000000-0000-4000-8000-000000000002';
  v_source uuid; v_message text; v_rolled_back boolean; v_failed boolean;
begin
  select id into strict v_source from public.hotel_calendar_source_configs
    where hotel_id=c_hotel and source_type='booking_com' and code='upper-primary';

  v_failed:=false;
  perform set_config('hotels_v2.external_calendar_apply_context','',true);
  perform set_config('hotels_v2.external_calendar_apply_action','',true);
  begin
    insert into public.hotel_calendar_source_configs(id,hotel_id,room_type_id,code,source_type,
      configuration,is_enabled,review_status,priority,version)
    values('e7450000-0000-4000-8000-000000000001',c_hotel,
      'b4ef504f-cdeb-4e3c-a54d-932146ef4e94','direct-no-plan','booking_com',
      '{"sync_interval_minutes":60,"units_per_event":1}',false,'reviewed',0,1);
  exception when object_not_in_prerequisite_state then
    v_failed:=sqlerrm='hotels_v2_external_calendar_reviewed_context_required';
  end;
  if not v_failed then raise exception 'seven_arches_direct_source_without_plan_allowed'; end if;

  -- Correlations are immutable, so a reviewed activity cannot be rebound to
  -- another request hash after Apply.
  v_failed:=false;
  begin
    update hotels_v2_private.hotel_external_calendar_correlations
      set request_hash=repeat('b',64)
      where correlation_id='e7400000-0000-4000-8000-000000000001';
  exception when object_not_in_prerequisite_state then
    v_failed:=sqlerrm='hotels_v2_h3_2a_append_only_violation';
  end;
  if not v_failed then raise exception 'seven_arches_correlation_mismatch_allowed'; end if;

  v_failed:=false;
  begin
    perform set_config('hotels_v2.external_calendar_apply_context',
      'e7440000-0000-4000-8000-000000000010',true);
    perform set_config('hotels_v2.external_calendar_apply_action','update',true);
    update public.hotel_calendar_source_configs
      set hotel_id=c_foreign_hotel,version=version+1,updated_at=clock_timestamp()
      where id=v_source;
  exception when object_not_in_prerequisite_state then
    v_failed:=sqlerrm='hotels_v2_external_calendar_source_field_scope_violation';
  end;
  if not v_failed then raise exception 'seven_arches_source_hotel_mismatch_allowed'; end if;

  v_failed:=false;
  begin
    perform set_config('hotels_v2.external_calendar_apply_context',
      'e7440000-0000-4000-8000-000000000011',true);
    perform set_config('hotels_v2.external_calendar_apply_action','update',true);
    update public.hotel_calendar_source_configs
      set room_type_id=c_foreign_room,version=version+1,updated_at=clock_timestamp()
      where id=v_source;
  exception when check_violation then
    v_failed:=sqlerrm='hotels_v2_external_calendar_source_invalid';
  end;
  if not v_failed then raise exception 'seven_arches_source_room_mismatch_allowed'; end if;

  v_failed:=false;
  begin
    perform set_config('hotels_v2.external_calendar_apply_context',
      'e7440000-0000-4000-8000-000000000012',true);
    perform set_config('hotels_v2.external_calendar_apply_action','update',true);
    update public.hotel_calendar_source_configs
      set source_type='expedia',version=version+1,updated_at=clock_timestamp()
      where id=v_source;
  exception when object_not_in_prerequisite_state then
    v_failed:=sqlerrm='hotels_v2_external_calendar_source_field_scope_violation';
  end;
  if not v_failed then raise exception 'seven_arches_unsupported_provider_allowed'; end if;
  perform set_config('hotels_v2.external_calendar_apply_context','',true);
  perform set_config('hotels_v2.external_calendar_apply_action','',true);

  -- Removing the exact activity makes the shared attribution helper and the
  -- provider-safe verdict fail immediately; the subtransaction restores it.
  v_rolled_back:=false;
  begin
    delete from public.hotel_activity_log
      where correlation_id='e7400000-0000-4000-8000-000000000001';
    if public.hotel_v2_external_calendar_provider_sources_are_attributable()
       or public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_missing_activity_was_accepted';
    end if;
    raise exception 'seven_arches_missing_activity_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=v_message='seven_arches_missing_activity_probe_rollback';
  end;
  if not v_rolled_back then raise exception 'seven_arches_missing_activity_negative_failed'; end if;

  -- Admin receipts are append-only, so the exact reviewed chain cannot be
  -- made receipt-less by an owner/trusted table mutation.
  v_failed:=false;
  begin
    delete from hotels_v2_private.hotel_external_calendar_admin_receipts
      where correlation_id='e7400000-0000-4000-8000-000000000001';
  exception when object_not_in_prerequisite_state then
    v_failed:=sqlerrm='hotels_v2_h3_2a_append_only_violation';
  end;
  if not v_failed then raise exception 'seven_arches_missing_admin_receipt_allowed'; end if;

  -- An excluded Partner H3.2D receipt without its consumed review,
  -- correlation and activity must never be normalized away.
  v_rolled_back:=false;
  begin
    insert into public.hotel_partner_action_receipts(partner_id,hotel_id,actor_user_id,action,
      idempotency_key,request_hash,correlation_id,result)
    values(c_partner,c_hotel,c_partner_actor,'h3_2d_external_calendar',
      'e7430000-0000-4000-8000-000000000001',repeat('a',64),
      'e7440000-0000-4000-8000-000000000001',
      jsonb_build_object('contract_version','hotels_v2_external_calendar_apply_result_v1'));
    if public.hotel_v2_external_calendar_provider_sources_are_attributable()
       or public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_orphan_partner_receipt_was_accepted';
    end if;
    raise exception 'seven_arches_orphan_partner_receipt_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=v_message='seven_arches_orphan_partner_receipt_probe_rollback';
  end;
  if not v_rolled_back then
    raise exception 'seven_arches_orphan_partner_receipt_negative_failed'; end if;

  -- An external-control activity without the exact reviewed chain is equally
  -- invalid even if its redacted source projection looks plausible.
  v_rolled_back:=false;
  begin
    insert into public.hotel_activity_log(hotel_id,entity_type,entity_id,action,
      before_state,after_state,actor_type,actor_id,source,correlation_id)
    values(c_hotel,'calendar_source',v_source,'update',
      public.hotel_v2_external_calendar_source_projection(v_source),
      public.hotel_v2_external_calendar_source_projection(v_source),'admin',
      '10000000-0000-4000-8000-000000000008',
      'hotels_v2_external_calendar_control','e7440000-0000-4000-8000-000000000002');
    if public.hotel_v2_external_calendar_provider_sources_are_attributable()
       or public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_orphan_external_activity_was_accepted';
    end if;
    raise exception 'seven_arches_orphan_external_activity_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=v_message='seven_arches_orphan_external_activity_probe_rollback';
  end;
  if not v_rolled_back then
    raise exception 'seven_arches_orphan_external_activity_negative_failed'; end if;
  if not public.hotel_v2_external_calendar_provider_sources_are_attributable()
     or not public.hotel_v2_external_calendar_provider_evolution_is_safe() then
    raise exception 'seven_arches_provider_attribution_not_restored_after_negatives';
  end if;
end
$provider_attribution_negatives$;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000002"}',true);
do $partner_source$
declare c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_ground constant uuid:='825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
  c_partner constant uuid:='20000000-0000-4000-8000-000000000001';
  v_control jsonb; v_preview jsonb; v_apply jsonb; v_probe jsonb;
begin
  v_control:=public.hotel_v2_partner_get_external_calendar_control(c_partner,c_hotel);
  v_preview:=public.hotel_v2_partner_preview_external_calendar_plan(jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_draft_v1','hotel_id',c_hotel,
    'partner_id',c_partner,'assignment_id',v_control->'assignment_id',
    'permission_version',v_control->'permission_version',
    'access_snapshot_token',v_control->'access_snapshot_token',
    'snapshot_token',v_control->>'snapshot_token','intent',jsonb_build_object(
      'entity','calendar_source','action','create','id',null,'expected_version',0,
      'payload',jsonb_build_object('room_type_id',c_ground,'code','ground-tertiary',
        'source_type','airbnb','sync_interval_minutes',60,'units_per_event',1,'priority',20),
      'reason','Create reviewed Airbnb ICS source')));
  v_apply:=public.hotel_v2_partner_apply_external_calendar_plan(v_preview->'reviewed_plan',
    'e7400000-0000-4000-8000-000000000003','e7410000-0000-4000-8000-000000000003',null);
  if v_apply->>'partner_id'<>c_partner::text or jsonb_array_length(v_apply->'activity')<>1
     or not exists(select 1 from jsonb_array_elements(v_apply#>'{control,sources}') source
       where source->>'source_type'='airbnb' and (source->>'room_type_id')::uuid=c_ground
         and source->>'secret_configured'='false') then
    raise exception 'seven_arches_partner_airbnb_apply_mismatch:%',v_apply; end if;
  v_probe:=pg_temp.seven_arches_provider_attribution_probe();
  if v_probe is distinct from
      '{"provider_safe":true,"sources_attributable":true}'::jsonb then
    raise exception 'seven_arches_partner_airbnb_apply_not_attributable:%',v_probe; end if;
end
$partner_source$;

reset role;
do $partner_receipt_immutability$
declare v_failed boolean:=false;
begin
  begin
    delete from public.hotel_partner_action_receipts
      where action='h3_2d_external_calendar'
        and correlation_id='e7400000-0000-4000-8000-000000000003';
  exception when object_not_in_prerequisite_state then
    v_failed:=sqlerrm='hotels_v2_h3_2a_append_only_violation';
  end;
  if not v_failed then raise exception 'seven_arches_missing_partner_receipt_allowed'; end if;
  if not public.hotel_v2_external_calendar_provider_sources_are_attributable()
     or not public.hotel_v2_external_calendar_provider_evolution_is_safe() then
    raise exception 'seven_arches_partner_receipt_guard_not_restored'; end if;
end
$partner_receipt_immutability$;

set local role service_role;
select set_config('request.jwt.claims',
  '{"role":"service_role","sub":"10000000-0000-4000-8000-000000000009"}',true);
do $worker_off$
declare v_list jsonb; v_enqueue jsonb; v_lease jsonb;
begin
  v_list:=public.hotel_v2_external_calendar_worker_list_sources(25);
  if v_list->>'global_enabled'='true' then return; end if;
  v_enqueue:=public.hotel_v2_external_calendar_scheduler_enqueue(25);
  v_lease:=public.hotel_v2_external_calendar_scheduler_lease(25,
    'e7420000-0000-4000-8000-000000000001',180);
  if v_list->>'global_enabled'<>'false' or v_list->'sources'<>'[]'::jsonb
     or v_enqueue->>'queued_count'<>'0' or v_lease->'jobs'<>'[]'::jsonb then
    raise exception 'seven_arches_worker_scheduler_not_inert'; end if;
end
$worker_off$;
reset role;

-- The provider label does not change the reviewed Vault/ICS lifecycle.  Bind
-- one redacted Booking.com URL, then simulate the separately guarded 2F flag
-- transition and prove enable + manual enqueue.  The transaction rolls back;
-- no URL, source, flag or job escapes this focused gate.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000008"}',true);
do $provider_lifecycle$
declare c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_control jsonb; v_preview jsonb; v_apply jsonb; v_source jsonb;
  v_source_id uuid; v_url constant text:='https://calendar.example.com/seven-arches-upper.ics';
begin
  v_control:=public.hotel_v2_admin_get_external_calendar_control(c_hotel);
  select source into strict v_source from jsonb_array_elements(v_control->'sources') source
    where source->>'source_type'='booking_com';
  v_source_id:=(v_source->>'id')::uuid;
  v_preview:=public.hotel_v2_admin_preview_external_calendar_plan(jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_draft_v1','hotel_id',c_hotel,
    'partner_id',null,'assignment_id',null,'permission_version',null,
    'access_snapshot_token',null,'snapshot_token',v_control->>'snapshot_token','intent',jsonb_build_object(
      'entity','ical_secret','action','set','id',v_source_id,'expected_version',0,
      'payload',jsonb_build_object('source_id',v_source_id,'ical_url',v_url),
      'reason','Bind reviewed Booking.com iCalendar URL')));
  if v_preview::text like '%'||v_url||'%'
     or v_preview#>>'{reviewed_plan,operations,0,payload,secret_configured}'<>'true'
     or v_preview#>>'{impacts,0,after,secret_configured}'<>'true' then
    raise exception 'seven_arches_provider_secret_preview_not_redacted:%',v_preview; end if;
  v_apply:=public.hotel_v2_admin_apply_external_calendar_plan(v_preview->'reviewed_plan',
    'e7400000-0000-4000-8000-000000000004','e7410000-0000-4000-8000-000000000004',v_url);
  if v_apply::text like '%'||v_url||'%' or v_apply::text~'"(ical_url|vault_secret_id)"'
     or v_apply#>>'{control,sources,0,secret_configured}' is null
     or not exists(select 1 from jsonb_array_elements(v_apply#>'{control,sources}') source
       where (source->>'id')::uuid=v_source_id and source->>'secret_configured'='true'
         and (source->>'binding_version')::bigint=1) then
    raise exception 'seven_arches_provider_secret_apply_not_redacted:%',v_apply; end if;
end
$provider_lifecycle$;

reset role;
do $secret_activity_source_attribution_guard$
declare v_failed boolean:=false; v_message text; v_source uuid;
begin
  select id into strict v_source from public.hotel_calendar_source_configs
    where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
      and source_type='booking_com' and code='upper-primary';
  begin
    perform set_config('hotels_v2.external_calendar_apply_context',
      'e7440000-0000-4000-8000-000000000003',true);
    perform set_config('hotels_v2.external_calendar_apply_action','update',true);
    update public.hotel_calendar_source_configs
      set priority=priority+1,version=version+1,updated_at=clock_timestamp()
      where id=v_source;
    if public.hotel_v2_external_calendar_provider_sources_are_attributable()
       or public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_secret_activity_authorized_source_drift';
    end if;
    raise exception 'seven_arches_provider_source_drift_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='seven_arches_provider_source_drift_probe_rollback';
  end;
  if not v_failed then
    raise exception 'seven_arches_provider_source_drift_negative_failed'; end if;
  perform set_config('hotels_v2.external_calendar_apply_context','',true);
  perform set_config('hotels_v2.external_calendar_apply_action','',true);
  if not public.hotel_v2_external_calendar_provider_sources_are_attributable()
     or not public.hotel_v2_external_calendar_provider_evolution_is_safe() then
    raise exception 'seven_arches_provider_source_drift_not_restored'; end if;
end
$secret_activity_source_attribution_guard$;

update public.site_settings set hotel_external_sync_enabled=true
where id=1 and not hotel_external_sync_enabled;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000008"}',true);
do $active_lifecycle$
declare c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_control jsonb; v_preview jsonb; v_apply jsonb; v_source jsonb; v_source_id uuid;
begin
  v_control:=public.hotel_v2_admin_get_external_calendar_control(c_hotel);
  select source into strict v_source from jsonb_array_elements(v_control->'sources') source
    where source->>'source_type'='booking_com';
  v_source_id:=(v_source->>'id')::uuid;
  v_preview:=public.hotel_v2_admin_preview_external_calendar_plan(jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_draft_v1','hotel_id',c_hotel,
    'partner_id',null,'assignment_id',null,'permission_version',null,
    'access_snapshot_token',null,'snapshot_token',v_control->>'snapshot_token','intent',jsonb_build_object(
      'entity','calendar_source','action','enable','id',v_source_id,
      'expected_version',(v_source->>'version')::bigint,'payload','{}'::jsonb,
      'reason','Enable reviewed Booking.com iCalendar source')));
  v_apply:=public.hotel_v2_admin_apply_external_calendar_plan(v_preview->'reviewed_plan',
    'e7400000-0000-4000-8000-000000000005','e7410000-0000-4000-8000-000000000005',null);
  if not exists(select 1 from jsonb_array_elements(v_apply#>'{control,sources}') source
       where (source->>'id')::uuid=v_source_id and source->>'source_type'='booking_com'
         and source->>'is_enabled'='true' and source->>'secret_configured'='true') then
    raise exception 'seven_arches_provider_enable_failed:%',v_apply; end if;
  v_control:=v_apply->'control';
  select source into strict v_source from jsonb_array_elements(v_control->'sources') source
    where (source->>'id')::uuid=v_source_id;
  v_preview:=public.hotel_v2_admin_preview_external_calendar_plan(jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_draft_v1','hotel_id',c_hotel,
    'partner_id',null,'assignment_id',null,'permission_version',null,
    'access_snapshot_token',null,'snapshot_token',v_control->>'snapshot_token','intent',jsonb_build_object(
      'entity','calendar_sync','action','trigger','id',v_source_id,
      'expected_version',(v_source#>>'{health,state_version}')::bigint,
      'payload',jsonb_build_object('source_id',v_source_id),'reason','Queue reviewed manual sync')));
  v_apply:=public.hotel_v2_admin_apply_external_calendar_plan(v_preview->'reviewed_plan',
    'e7400000-0000-4000-8000-000000000006','e7410000-0000-4000-8000-000000000006',null);
  if v_apply#>>'{activity,0,source}'<>'hotels_v2_external_calendar_control' then
    raise exception 'seven_arches_provider_manual_trigger_failed:%',v_apply; end if;
end
$active_lifecycle$;

reset role;
do $owner_guards$
declare v_failed boolean; v_message text; v_definition text; v_needle text;
begin
  v_failed:=false;
  begin
    update public.hotel_calendar_source_configs set source_type='manual'
      where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' and source_type='booking_com';
  exception when object_not_in_prerequisite_state then
    v_failed:=sqlerrm='hotels_v2_external_calendar_source_field_scope_violation'; end;
  if not v_failed then raise exception 'seven_arches_provider_source_smuggling_allowed'; end if;
  -- A reviewed manual-sync activity leaves an open job; it is not authority
  -- for a later source-row mutation, even with a forged table context.
  v_failed:=false;
  begin
    perform set_config('hotels_v2.external_calendar_apply_context',
      'e7440000-0000-4000-8000-000000000004',true);
    perform set_config('hotels_v2.external_calendar_apply_action','update',true);
    update public.hotel_calendar_source_configs
      set priority=priority+1,version=version+1,updated_at=clock_timestamp()
      where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
        and source_type='booking_com' and code='upper-primary';
  exception when sqlstate 'PT409' then
    v_failed:=sqlerrm='hotels_v2_external_calendar_source_sync_in_progress';
  end;
  perform set_config('hotels_v2.external_calendar_apply_context','',true);
  perform set_config('hotels_v2.external_calendar_apply_action','',true);
  if not v_failed then
    raise exception 'seven_arches_sync_activity_authorized_source_drift'; end if;
  v_failed:=false;
  begin
    update public.hotel_partner_hotel_permissions set request_booking_changes=true
    where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
    if public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_unrelated_drift_was_accepted';
    end if;
    raise exception 'seven_arches_provider_unrelated_drift_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='seven_arches_provider_unrelated_drift_probe_rollback';
  end;
  if not v_failed then raise exception 'seven_arches_provider_unrelated_drift_negative_failed'; end if;
  v_failed:=false;
  begin
    update public.site_settings set hotel_instant_booking_enabled=true where id=1;
    if public.hotel_v2_external_calendar_site_settings_fingerprint() is not null
       or public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_site_settings_drift_was_accepted';
    end if;
    raise exception 'seven_arches_provider_site_settings_drift_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='seven_arches_provider_site_settings_drift_probe_rollback';
  end;
  if not v_failed then raise exception 'seven_arches_provider_site_settings_drift_negative_failed'; end if;
  v_failed:=false;
  begin
    v_definition:=pg_get_functiondef(
      'public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)'::regprocedure);
    v_needle:='where draft.assignment_id=(v_access->>''assignment_id'')::uuid'
      ||E'\n    and draft.status=''pending_admin_review'';';
    if (length(v_definition)-length(replace(v_definition,v_needle,'')))/length(v_needle)<>1 then
      raise exception 'seven_arches_provider_workspace_lineage_probe_source_drift';
    end if;
    execute replace(v_definition,v_needle,
      'where draft.assignment_id=(v_access->>''assignment_id'')::uuid'
        ||E'\n    and (draft.status=''pending_admin_review'');');
    if public.hotel_v2_partner_workspace_function_lineage_is_exact()
       or public.hotel_v2_external_calendar_site_settings_fingerprint() is not null
       or public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_workspace_lineage_drift_was_accepted';
    end if;
    raise exception 'seven_arches_provider_workspace_lineage_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='seven_arches_provider_workspace_lineage_probe_rollback';
  end;
  if not v_failed then raise exception 'seven_arches_provider_workspace_lineage_negative_failed'; end if;
  if not public.hotel_v2_partner_workspace_function_lineage_is_exact()
     or public.hotel_v2_external_calendar_site_settings_fingerprint() is null then
    raise exception 'seven_arches_provider_workspace_lineage_not_restored';
  end if;
  if not public.hotel_v2_external_calendar_provider_evolution_is_safe() then
    raise exception 'seven_arches_provider_evolution_not_safe'; end if;
end
$owner_guards$;

set local role service_role;
select set_config('request.jwt.claims',
  '{"role":"service_role","sub":"10000000-0000-4000-8000-000000000009"}',true);
do $worker_active$
declare v_list jsonb; v_enqueue jsonb; v_lease jsonb;
begin
  v_list:=public.hotel_v2_external_calendar_worker_list_sources(25);
  v_enqueue:=public.hotel_v2_external_calendar_scheduler_enqueue(25);
  v_lease:=public.hotel_v2_external_calendar_scheduler_lease(25,
    'e7420000-0000-4000-8000-000000000001',180);
  if v_list->>'global_enabled'<>'true'
     or not exists(select 1 from jsonb_array_elements(v_list->'sources') source
       where source->>'source_type'='booking_com')
     or v_enqueue->>'queued_count'<>'0' or jsonb_array_length(v_lease->'jobs')<>1
     or v_lease#>>'{jobs,0,trigger_type}'<>'manual' then
    raise exception 'seven_arches_worker_scheduler_active_mismatch'; end if;
end
$worker_active$;
reset role;

rollback;
\if :provider_install_external_enabled
do $active_install_postcondition$
begin
  if not (select hotel_external_sync_enabled from public.site_settings where id=1)
     or public.hotel_v2_external_calendar_site_settings_fingerprint() is null
     or not public.hotel_v2_partner_workspace_function_lineage_is_exact()
     or not public.hotel_v2_external_calendar_provider_evolution_is_safe() then
    raise exception 'seven_arches_provider_active_install_postcondition_failed';
  end if;
end
$active_install_postcondition$;
\ir ../../supabase/manual/hotels_v2_external_calendar_provider_types_verify.sql
\else
\ir ../../supabase/manual/hotels_v2_external_calendar_provider_types_verify.sql
\endif
select true as hotels_v2_seven_arches_external_calendar_readiness_postgres_gate_passed;
