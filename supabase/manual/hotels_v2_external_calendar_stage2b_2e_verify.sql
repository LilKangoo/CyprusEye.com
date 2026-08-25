-- Standalone read-only SQL Editor verifier for Stages 2B-2E.
begin;
set transaction read only;
set local statement_timeout='120s';
do $verify$
declare v_h3 jsonb; v_relation text; v_role text; v_privilege text;
begin
  if not exists(select 1 from hotels_v2_private.hotel_external_calendar_foundation_receipts receipt
      where receipt.id=1
        and receipt.protected_fingerprints=public.hotel_v2_external_calendar_protected_fingerprints()
        and receipt.protected_fingerprint=public.hotel_v2_external_calendar_worker_hash(receipt.protected_fingerprints)) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_verify_protected_drift';
  end if;
  if not exists(select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
      join public.site_settings setting on setting.id=receipt.id where receipt.id=1
        and receipt.site_settings_without_external_fingerprint=
          public.hotel_v2_external_calendar_worker_hash(to_jsonb(setting)-'hotel_external_sync_enabled')
        and receipt.compatibility_function_fingerprints=
          public.hotel_v2_external_calendar_activation_function_fingerprints()) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_verify_compatibility_drift';
  end if;
  if not (select count(*)=1 and bool_and(id=1 and not hotel_rooms_v2_enabled
      and not hotel_external_sync_enabled and not hotel_instant_booking_enabled
      and not hotel_stripe_connect_enabled) from public.site_settings)
     or exists(select 1 from public.hotel_calendar_source_configs source
       where source.source_type<>'manual' and source.is_enabled) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_verify_activation_drift';
  end if;

  if exists(select 1 from (values
      ('public.hotel_v2_external_calendar_worker_get_source(uuid)','service_role'),
      ('public.hotel_v2_external_calendar_worker_list_sources(integer)','service_role'),
      ('public.hotel_v2_external_calendar_worker_begin_sync(jsonb)','service_role'),
      ('public.hotel_v2_external_calendar_worker_finalize_sync(jsonb)','service_role'),
      ('public.hotel_v2_external_calendar_worker_fail_sync(jsonb)','service_role'),
      ('public.hotel_v2_external_calendar_scheduler_enqueue(integer)','service_role'),
      ('public.hotel_v2_external_calendar_scheduler_lease(integer,uuid,integer)','service_role'),
      ('public.hotel_v2_admin_get_external_calendar_control(uuid)','authenticated'),
      ('public.hotel_v2_admin_preview_external_calendar_plan(jsonb)','authenticated'),
      ('public.hotel_v2_admin_apply_external_calendar_plan(jsonb,uuid,uuid,text)','authenticated'),
      ('public.hotel_v2_partner_get_external_calendar_control(uuid,uuid)','authenticated'),
      ('public.hotel_v2_partner_preview_external_calendar_plan(jsonb)','authenticated'),
      ('public.hotel_v2_partner_apply_external_calendar_plan(jsonb,uuid,uuid,text)','authenticated')
    ) expected(signature,grantee)
    left join pg_proc procedure on procedure.oid=to_regprocedure(expected.signature)
    where procedure.oid is null or procedure.proowner<>'postgres'::regrole or not procedure.prosecdef
      or procedure.proconfig not in(array['search_path=pg_catalog, public']::text[],
        array['search_path=pg_catalog, public, auth']::text[])
      or has_function_privilege(0::oid,procedure.oid,'EXECUTE')
      or has_function_privilege('anon',procedure.oid,'EXECUTE')
      or has_function_privilege('authenticated',procedure.oid,'EXECUTE') is distinct from (expected.grantee='authenticated')
      or has_function_privilege('service_role',procedure.oid,'EXECUTE') is distinct from (expected.grantee='service_role')) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_verify_rpc_security_mismatch';
  end if;
  if has_function_privilege('authenticated',
       'public.hotel_v2_admin_set_external_calendar_ical_secret(uuid,bigint,bigint,text)','EXECUTE')
     or has_function_privilege('service_role',
       'public.hotel_v2_admin_set_external_calendar_ical_secret(uuid,bigint,bigint,text)','EXECUTE')
     or has_function_privilege(0::oid,
       'public.hotel_v2_admin_set_external_calendar_ical_secret(uuid,bigint,bigint,text)'::regprocedure,'EXECUTE') then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_verify_legacy_secret_bypass';
  end if;
  if has_function_privilege(0::oid,
       'public.hotel_v2_admin_get_external_calendar_status(uuid)'::regprocedure,'EXECUTE')
     or has_function_privilege('anon',
       'public.hotel_v2_admin_get_external_calendar_status(uuid)','EXECUTE')
     or has_function_privilege('authenticated',
       'public.hotel_v2_admin_get_external_calendar_status(uuid)','EXECUTE')
     or has_function_privilege('service_role',
       'public.hotel_v2_admin_get_external_calendar_status(uuid)','EXECUTE') then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_verify_legacy_status_bypass';
  end if;
  if exists(select 1 from (values
      ('public.hotel_v2_external_calendar_guard_review()',false,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_external_calendar_guard_source()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_external_calendar_guard_room_unit_capacity()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_external_calendar_control_common(text,uuid,uuid)',true,array['search_path=pg_catalog, public, auth']::text[]),
      ('public.hotel_v2_external_calendar_preview_common(text,jsonb)',true,array['search_path=pg_catalog, public, auth']::text[]),
      ('public.hotel_v2_external_calendar_set_secret_internal(uuid,bigint,text,text)',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_external_calendar_apply_common(text,jsonb,uuid,uuid,text)',true,array['search_path=pg_catalog, public, auth']::text[]),
      ('public.hotel_v2_external_calendar_worker_hash(jsonb)',true,array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_external_calendar_worker_get_source_stage2a(uuid)',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_external_calendar_scheduler_enqueue_internal(integer)',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_external_calendar_scheduler_dispatch()',true,array['search_path=pg_catalog, public']::text[])
      ,('public.hotel_v2_external_calendar_activation_function_fingerprints()',true,array['search_path=pg_catalog, public']::text[])
    ) expected(signature,security_definer,configuration)
    left join pg_proc procedure on procedure.oid=to_regprocedure(expected.signature)
    where procedure.oid is null or procedure.proowner<>'postgres'::regrole
      or procedure.prosecdef is distinct from expected.security_definer
      or procedure.proconfig is distinct from expected.configuration
      or has_function_privilege(0::oid,procedure.oid,'EXECUTE')
      or has_function_privilege('anon',procedure.oid,'EXECUTE')
      or has_function_privilege('authenticated',procedure.oid,'EXECUTE')
      or has_function_privilege('service_role',procedure.oid,'EXECUTE')) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_verify_internal_security_mismatch';
  end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.hotel_room_types'::regclass
       and tgname='hotel_room_types_external_calendar_capacity_guard' and not tgisinternal)
     or not exists(select 1 from pg_trigger where tgrelid='public.hotel_units'::regclass
       and tgname='hotel_units_external_calendar_capacity_guard' and not tgisinternal)
     or not exists(select 1 from pg_trigger where tgrelid='public.hotel_calendar_source_configs'::regclass
       and tgname='hotel_calendar_source_configs_external_guard' and not tgisinternal) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_verify_trigger_mismatch';
  end if;

  foreach v_relation in array array['hotel_external_calendar_source_secrets',
      'hotel_external_calendar_sync_runs','hotel_external_calendar_source_state',
      'hotel_external_calendar_events','hotel_external_calendar_day_blocks',
      'hotel_external_calendar_sync_jobs','hotel_external_calendar_plan_reviews',
      'hotel_external_calendar_admin_receipts','hotel_external_calendar_correlations',
      'hotel_external_calendar_foundation_receipts','hotel_external_calendar_activation_receipts'] loop
    if to_regclass('hotels_v2_private.'||v_relation) is null then
      raise exception using errcode='55000',message='hotels_v2_external_calendar_verify_private_relation_missing'; end if;
    foreach v_role in array array['anon','authenticated','service_role'] loop
      foreach v_privilege in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
        if has_table_privilege(v_role,'hotels_v2_private.'||v_relation,v_privilege) then
          raise exception using errcode='55000',message='hotels_v2_external_calendar_verify_raw_acl_mismatch'; end if;
      end loop;
    end loop;
  end loop;
  if has_schema_privilege(0::oid,'hotels_v2_private','USAGE')
     or has_schema_privilege('anon','hotels_v2_private','USAGE')
     or has_schema_privilege('service_role','hotels_v2_private','USAGE')
     or has_schema_privilege(0::oid,'hotels_v2_private','CREATE')
     or has_schema_privilege('anon','hotels_v2_private','CREATE')
     or has_schema_privilege('authenticated','hotels_v2_private','CREATE')
     or has_schema_privilege('service_role','hotels_v2_private','CREATE') then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_verify_private_schema_acl';
  end if;
  if pg_get_functiondef('public.hotel_v2_external_calendar_scheduler_dispatch()'::regprocedure)
       not like '%https://daoohnbnnowmmcizgvrq.functions.supabase.co/hotels-v2-external-calendar-sync%'
     or pg_get_functiondef('public.hotel_v2_external_calendar_scheduler_dispatch()'::regprocedure)
       not like '%timeout_milliseconds=>150000%'
     or pg_get_functiondef('public.hotel_v2_external_calendar_scheduler_dispatch()'::regprocedure)
       not like '%''limit'',8%' then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_verify_dispatch_contract_mismatch';
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
          and correlation.actor_type=review.actor_type and correlation.actor_id=review.actor_id)
      or (review.actor_type='admin' and not exists(select 1
        from hotels_v2_private.hotel_external_calendar_admin_receipts receipt
        where receipt.correlation_id=review.consumed_correlation_id and receipt.actor_id=review.actor_id))
      or (review.actor_type='partner' and not exists(select 1 from public.hotel_partner_action_receipts receipt
        where receipt.correlation_id=review.consumed_correlation_id and receipt.actor_user_id=review.actor_id
          and receipt.partner_id=review.partner_id and receipt.action='h3_2d_external_calendar'))))
     or exists(select 1 from public.hotel_activity_log activity
       where activity.source='hotels_v2_external_calendar_control' and not exists(
         select 1 from hotels_v2_private.hotel_external_calendar_plan_reviews review
         where review.consumed_correlation_id=activity.correlation_id and review.consumed_at is not null)) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_verify_ledger_mismatch';
  end if;

  if exists(select 1 from hotels_v2_private.hotel_external_calendar_day_blocks block
    join public.hotel_calendar_source_configs source on source.id=block.source_id
    where source.hotel_id<>block.hotel_id or source.room_type_id<>block.room_type_id
      or source.source_type<>'ical' or block.units_blocked<=0) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_verify_topology_mismatch';
  end if;
  v_h3:=public.hotel_v2_h3_1p_pricing_promotion_snapshot('9b6d99a0-923a-4fbc-be54-c066e856e6ca');
  if not coalesce((v_h3->>'supported')::boolean,false)
     or (v_h3#>>'{parity,total_case_count}')::integer<>70
     or (v_h3#>>'{parity,total_mismatch_count}')::integer<>0
     or not public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact() then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_verify_h3_mismatch'; end if;
end
$verify$;
select 'hotels_v2_external_calendar_stage2b_2e_verify_v1' contract_version,
  0 protected_mismatch_count,0 security_mismatch_count,0 ledger_mismatch_count,
  0 topology_mismatch_count,0 h3_parity_mismatch_count,0 activation_mismatch_count,
  true stage2b_2e_safe;
commit;
