-- Standalone dual-mode verifier after 114450. It accepts either the inert
-- pre-2F state or the exact manually activated 2F state.
begin;
set transaction read only;
set local statement_timeout='120s';
do $verify$
declare c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_signature text; v_role text; v_relation text; v_external boolean; v_count integer;
begin
  if not public.hotel_v2_external_calendar_provider_evolution_is_safe()
     or not public.hotel_v2_external_calendar_provider_sources_are_attributable()
     or not exists(select 1 from public.hotel_partner_property_proposal_foundation_receipts receipt
       where receipt.id=1 and receipt.provider_source_attribution_source_hash=
         public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
           'public.hotel_v2_external_calendar_provider_sources_are_attributable()'::regprocedure))))
     or public.hotel_v2_external_calendar_site_settings_fingerprint() is null
     or not public.hotel_v2_partner_workspace_function_lineage_is_exact()
     or not exists(select 1 from pg_proc procedure where procedure.oid=
       'public.hotel_v2_external_calendar_site_settings_fingerprint()'::regprocedure
       and procedure.proowner='postgres'::regrole and procedure.prosecdef
       and procedure.proconfig=array['search_path=pg_catalog, public']::text[])
     or not exists(select 1 from hotels_v2_private.hotel_external_calendar_provider_evolution_receipts receipt
       join hotels_v2_private.hotel_external_calendar_foundation_receipts foundation on foundation.id=receipt.id
       where receipt.id=1 and receipt.original_foundation_fingerprint=foundation.protected_fingerprint
         and receipt.original_protected_fingerprints=foundation.protected_fingerprints
         and receipt.evolved_function_fingerprints=
           hotels_v2_private.hotel_external_calendar_provider_function_fingerprints()) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_verify_receipt_drift';
  end if;
  if exists(select 1
      from public.hotel_seven_arches_pricing_activation_evolution_receipts activation
      join hotels_v2_private.hotel_external_calendar_provider_evolution_receipts receipt
        on receipt.id=activation.id
      where exists(select 1
        from unnest(activation.stage2_allowed_fingerprint_keys) changed(changed_key)
        where receipt.prior_compatible_fingerprints->(changed.changed_key)
          is distinct from activation.before_stage2_protected_fingerprints->(changed.changed_key))) then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_provider_verify_prior_normalization_drift';
  end if;
  if not (public.hotel_v2_external_calendar_ics_source_type_is_supported('booking_com')
      and public.hotel_v2_external_calendar_ics_source_type_is_supported('airbnb')
      and public.hotel_v2_external_calendar_ics_source_type_is_supported('ical'))
     or public.hotel_v2_external_calendar_ics_source_type_is_supported('manual') then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_verify_enum_mismatch';
  end if;
  select hotel_external_sync_enabled into strict v_external from public.site_settings where id=1;
  if not v_external and (exists(select 1 from public.hotel_calendar_source_configs source
       where source.source_type<>'manual' and source.is_enabled)
     or exists(select 1 from hotels_v2_private.hotel_external_calendar_sync_jobs
       where status in('queued','leased','running'))) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_verify_inert_runtime_drift';
  end if;
  if v_external then
    if to_regclass('cron.job') is null
       or (select count(*) from vault.decrypted_secrets
         where name='hotels-v2-external-calendar-worker-url'
           and decrypted_secret='https://daoohnbnnowmmcizgvrq.functions.supabase.co/hotels-v2-external-calendar-sync')<>1
       or (select count(*) from vault.decrypted_secrets
         where name='hotels-v2-external-calendar-worker-shared-secret'
           and length(decrypted_secret)>=32 and decrypted_secret!~'[[:space:][:cntrl:]]')<>1 then
      raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_verify_active_vault_drift';
    end if;
    execute $sql$select count(*) from cron.job where jobname='hotels-v2-external-calendar-15m'
      and schedule='*/15 * * * *' and active$sql$ into v_count;
    if v_count<>1 then raise exception using errcode='55000',
      message='hotels_v2_external_calendar_provider_verify_active_scheduler_drift'; end if;
    if exists(select 1 from public.hotel_calendar_source_configs source
      left join hotels_v2_private.hotel_external_calendar_source_secrets binding on binding.source_id=source.id
      left join public.hotel_room_types room on room.id=source.room_type_id and room.hotel_id=source.hotel_id
      where source.is_enabled and source.source_type<>'manual'
        and (not public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type)
        or source.review_status<>'reviewed' or binding.source_id is null
        or binding.hotel_id<>source.hotel_id or binding.room_type_id<>source.room_type_id
        or room.id is null or room.status<>'active'
        or (source.configuration->>'units_per_event')::integer>case when room.inventory_mode='unitized'
          then (select count(*)::integer from public.hotel_units unit
            where unit.room_type_id=room.id and unit.status='active') else room.base_inventory_count end)) then
      raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_verify_enabled_topology';
    end if;
  end if;
  if (select count(*) from public.hotel_room_types room where room.hotel_id=c_hotel
      and room.id in('b4ef504f-cdeb-4e3c-a54d-932146ef4e94','825c01b7-9f82-492a-9c81-9b1d5cd7acd3')
      and room.status='active' and room.inventory_mode='pooled' and room.base_inventory_count=1)<>2
     or exists(select 1 from public.hotel_calendar_source_configs source where source.hotel_id=c_hotel
       and source.source_type<>'manual'
       and not public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type))
     or exists(select 1 from hotels_v2_private.hotel_external_calendar_source_secrets binding
       join public.hotel_calendar_source_configs source on source.id=binding.source_id
       where source.hotel_id=c_hotel and (binding.hotel_id<>source.hotel_id
         or binding.room_type_id<>source.room_type_id)) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_verify_seven_arches_topology';
  end if;
  if exists(select 1 from hotels_v2_private.hotel_external_calendar_day_blocks block
      join public.hotel_calendar_source_configs source on source.id=block.source_id
      where source.hotel_id<>block.hotel_id or source.room_type_id<>block.room_type_id
        or not public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type)
        or block.units_blocked<=0) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_verify_block_topology';
  end if;
  if exists(select 1 from hotels_v2_private.hotel_external_calendar_sync_jobs job
      left join public.hotel_calendar_source_configs source on source.id=job.source_id
      left join hotels_v2_private.hotel_external_calendar_source_secrets binding on binding.source_id=job.source_id
      where source.id is null or not public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type)
        or job.hotel_id<>source.hotel_id or job.room_type_id<>source.room_type_id
        or job.source_version>source.version or binding.source_id is null
        or job.binding_version>binding.version)
     or exists(select 1 from hotels_v2_private.hotel_external_calendar_sync_runs run
      left join hotels_v2_private.hotel_external_calendar_sync_jobs job on job.id=run.job_id
      left join public.hotel_calendar_source_configs source on source.id=run.source_id
      where job.id is null or source.id is null
        or not public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type)
        or run.source_id<>job.source_id or run.hotel_id<>job.hotel_id
        or run.room_type_id<>job.room_type_id or run.source_version<>job.source_version
        or run.binding_version<>job.binding_version or run.trigger_type<>job.trigger_type) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_verify_run_topology';
  end if;
  if exists(select 1 from hotels_v2_private.hotel_external_calendar_plan_reviews review
    where review.consumed_at is not null and (
      (select count(*) from public.hotel_activity_log activity
       where activity.source='hotels_v2_external_calendar_control'
         and activity.correlation_id=review.consumed_correlation_id
         and activity.hotel_id=review.hotel_id and activity.actor_id=review.actor_id
         and activity.actor_type=review.actor_type and activity.entity_type='calendar_source'
         and activity.entity_id=(review.reviewed_plan#>>'{operations,0,id}')::uuid
         and activity.action=case review.reviewed_plan#>>'{operations,0,action}'
           when 'create' then 'create' when 'disable' then 'disable' else 'update' end)<>1
      or not exists(select 1 from hotels_v2_private.hotel_external_calendar_correlations correlation
        where correlation.correlation_id=review.consumed_correlation_id
          and correlation.actor_type=review.actor_type and correlation.actor_id=review.actor_id
          and correlation.idempotency_key is not null and correlation.request_hash~'^[0-9a-f]{64}$')
      or (review.actor_type='admin' and not exists(select 1
        from hotels_v2_private.hotel_external_calendar_admin_receipts receipt
        join hotels_v2_private.hotel_external_calendar_correlations correlation
          on correlation.correlation_id=receipt.correlation_id
        where receipt.correlation_id=review.consumed_correlation_id and receipt.actor_id=review.actor_id
          and receipt.hotel_id=review.hotel_id and receipt.idempotency_key=correlation.idempotency_key
          and receipt.request_hash=correlation.request_hash
          and receipt.result->>'correlation_id'=receipt.correlation_id::text
          and receipt.result->>'idempotency_key'=receipt.idempotency_key::text
          and receipt.result->>'hotel_id'=receipt.hotel_id::text))
      or (review.actor_type='partner' and not exists(select 1 from public.hotel_partner_action_receipts receipt
        join hotels_v2_private.hotel_external_calendar_correlations correlation
          on correlation.correlation_id=receipt.correlation_id
        where receipt.correlation_id=review.consumed_correlation_id and receipt.actor_user_id=review.actor_id
          and receipt.partner_id=review.partner_id and receipt.hotel_id=review.hotel_id
          and receipt.action='h3_2d_external_calendar'
          and receipt.idempotency_key=correlation.idempotency_key
          and receipt.request_hash=correlation.request_hash
          and receipt.result->>'correlation_id'=receipt.correlation_id::text
          and receipt.result->>'idempotency_key'=receipt.idempotency_key::text
          and receipt.result->>'hotel_id'=receipt.hotel_id::text))))
     or exists(select 1 from public.hotel_activity_log activity
       where activity.source='hotels_v2_external_calendar_control' and not exists(
         select 1 from hotels_v2_private.hotel_external_calendar_plan_reviews review
         where review.consumed_correlation_id=activity.correlation_id and review.consumed_at is not null))
     or exists(select 1 from hotels_v2_private.hotel_external_calendar_correlations correlation
       where not exists(select 1 from hotels_v2_private.hotel_external_calendar_plan_reviews review
         where review.consumed_correlation_id=correlation.correlation_id and review.consumed_at is not null)) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_verify_ledger_mismatch';
  end if;
  foreach v_signature in array array[
    'public.hotel_v2_external_calendar_worker_get_source(uuid)',
    'public.hotel_v2_external_calendar_worker_list_sources(integer)',
    'public.hotel_v2_external_calendar_worker_begin_sync(jsonb)',
    'public.hotel_v2_external_calendar_worker_finalize_sync(jsonb)',
    'public.hotel_v2_external_calendar_worker_fail_sync(jsonb)',
    'public.hotel_v2_external_calendar_scheduler_enqueue(integer)',
    'public.hotel_v2_external_calendar_scheduler_lease(integer,uuid,integer)'] loop
    if not exists(select 1 from pg_proc procedure where procedure.oid=v_signature::regprocedure
         and procedure.proowner='postgres'::regrole and procedure.prosecdef
         and procedure.proconfig=array['search_path=pg_catalog, public']::text[])
       or has_function_privilege(0::oid,v_signature::regprocedure,'EXECUTE')
       or has_function_privilege('anon',v_signature,'EXECUTE')
       or has_function_privilege('authenticated',v_signature,'EXECUTE')
       or not has_function_privilege('service_role',v_signature,'EXECUTE') then
      raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_verify_worker_acl'; end if;
  end loop;
  foreach v_signature in array array[
    'public.hotel_v2_admin_get_external_calendar_control(uuid)',
    'public.hotel_v2_admin_preview_external_calendar_plan(jsonb)',
    'public.hotel_v2_admin_apply_external_calendar_plan(jsonb,uuid,uuid,text)',
    'public.hotel_v2_partner_get_external_calendar_control(uuid,uuid)',
    'public.hotel_v2_partner_preview_external_calendar_plan(jsonb)',
    'public.hotel_v2_partner_apply_external_calendar_plan(jsonb,uuid,uuid,text)'] loop
    if not exists(select 1 from pg_proc procedure where procedure.oid=v_signature::regprocedure
         and procedure.proowner='postgres'::regrole and procedure.prosecdef
         and procedure.proconfig=array['search_path=pg_catalog, public, auth']::text[])
       or has_function_privilege(0::oid,v_signature::regprocedure,'EXECUTE')
       or has_function_privilege('anon',v_signature,'EXECUTE')
       or has_function_privilege('service_role',v_signature,'EXECUTE')
       or not has_function_privilege('authenticated',v_signature,'EXECUTE') then
      raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_verify_control_acl'; end if;
  end loop;
  foreach v_signature in array array[
    'public.hotel_v2_external_calendar_ics_source_type_is_supported(text)',
    'public.hotel_v2_external_calendar_provider_sources_are_attributable()',
    'public.hotel_v2_external_calendar_stage2_compatible_fingerprints()',
    'public.hotel_v2_external_calendar_protected_fingerprints()',
    'public.hotel_v2_external_calendar_site_settings_fingerprint()',
    'public.hotel_v2_partner_workspace_function_lineage_is_exact()',
    'public.hotel_v2_external_calendar_provider_protected_fingerprints()',
    'public.hotel_v2_external_calendar_provider_evolution_is_safe()',
    'hotels_v2_private.hotel_external_calendar_provider_function_fingerprints()',
    'hotels_v2_private.hotel_external_calendar_provider_helper_fingerprints()'] loop
    if has_function_privilege(0::oid,v_signature::regprocedure,'EXECUTE')
       or has_function_privilege('anon',v_signature,'EXECUTE')
       or has_function_privilege('authenticated',v_signature,'EXECUTE')
       or has_function_privilege('service_role',v_signature,'EXECUTE') then
      raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_verify_internal_acl'; end if;
  end loop;
  foreach v_relation in array array['hotel_external_calendar_provider_evolution_receipts',
      'hotel_external_calendar_source_secrets','hotel_external_calendar_sync_runs',
      'hotel_external_calendar_source_state','hotel_external_calendar_events',
      'hotel_external_calendar_day_blocks','hotel_external_calendar_sync_jobs',
      'hotel_external_calendar_plan_reviews','hotel_external_calendar_admin_receipts',
      'hotel_external_calendar_correlations'] loop
    if has_table_privilege(0::oid,('hotels_v2_private.'||v_relation)::regclass,'SELECT')
       or has_table_privilege(0::oid,('hotels_v2_private.'||v_relation)::regclass,'INSERT')
       or has_table_privilege(0::oid,('hotels_v2_private.'||v_relation)::regclass,'UPDATE')
       or has_table_privilege(0::oid,('hotels_v2_private.'||v_relation)::regclass,'DELETE') then
      raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_verify_public_raw_acl'; end if;
    foreach v_role in array array['anon','authenticated','service_role'] loop
      if has_table_privilege(v_role,'hotels_v2_private.'||v_relation,'SELECT')
         or has_table_privilege(v_role,'hotels_v2_private.'||v_relation,'INSERT')
         or has_table_privilege(v_role,'hotels_v2_private.'||v_relation,'UPDATE')
         or has_table_privilege(v_role,'hotels_v2_private.'||v_relation,'DELETE') then
        raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_verify_raw_acl'; end if;
    end loop;
  end loop;
  if pg_get_functiondef('public.hotel_v2_external_calendar_scheduler_dispatch()'::regprocedure)
       not like '%https://daoohnbnnowmmcizgvrq.functions.supabase.co/hotels-v2-external-calendar-sync%'
     or pg_get_functiondef('public.hotel_v2_external_calendar_scheduler_dispatch()'::regprocedure)
       not like '%timeout_milliseconds=>150000%'
     or pg_get_functiondef('public.hotel_v2_external_calendar_scheduler_dispatch()'::regprocedure)
       not like '%''limit'',8%' then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_verify_dispatch_drift';
  end if;
end
$verify$;
select 'hotels_v2_external_calendar_provider_types_verify_v1' contract_version,
  0 protected_mismatch_count,0 security_mismatch_count,0 ledger_mismatch_count,
  0 topology_mismatch_count,2 seven_arches_room_count,
  (select count(*)::integer from public.hotel_calendar_source_configs
    where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' and source_type<>'manual') provider_source_count,
  (select hotel_external_sync_enabled from public.site_settings where id=1) external_sync_active,
  true provider_evolution_safe;
commit;
