-- DELIBERATELY GUARDED, MANUAL-ONLY ACTIVATION.
-- After deployment/health verification of the exact Stage 2 worker, an
-- authorized operator must change the single acknowledgement below to TRUE.
-- This file is intentionally not a Supabase migration.
begin;
set local lock_timeout='15s';
set local statement_timeout='180s';

do $explicit_operator_acknowledgement$
declare v_worker_deployed_and_verified boolean:=false; -- OPERATOR MUST SET TRUE
begin
  if not v_worker_deployed_and_verified then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_worker_deployment_acknowledgement_required';
  end if;
end
$explicit_operator_acknowledgement$;

do $activation_guard$
begin
  if to_regprocedure('public.hotel_v2_external_calendar_scheduler_dispatch()') is null
     or to_regprocedure('public.hotel_v2_external_calendar_provider_evolution_is_safe()') is null
     or to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null
     or to_regclass('cron.job') is null then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_activation_dependencies_missing';
  end if;
  if pg_get_functiondef('public.hotel_v2_external_calendar_scheduler_dispatch()'::regprocedure)
       not like '%https://daoohnbnnowmmcizgvrq.functions.supabase.co/hotels-v2-external-calendar-sync%'
     or pg_get_functiondef('public.hotel_v2_external_calendar_scheduler_dispatch()'::regprocedure)
       not like '%timeout_milliseconds=>150000%'
     or pg_get_functiondef('public.hotel_v2_external_calendar_scheduler_dispatch()'::regprocedure)
       not like '%''limit'',8%'
     or not public.hotel_v2_external_calendar_provider_evolution_is_safe()
     or not exists(select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
       join public.site_settings setting on setting.id=receipt.id where receipt.id=1
         and receipt.site_settings_without_external_fingerprint=
           public.hotel_v2_external_calendar_worker_hash(to_jsonb(setting)-'hotel_external_sync_enabled')
         and receipt.compatibility_function_fingerprints=
           public.hotel_v2_external_calendar_activation_function_fingerprints()) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_activation_source_drift';
  end if;
  if not (select count(*)=1 and bool_and(id=1 and not hotel_rooms_v2_enabled
      and not hotel_external_sync_enabled and not hotel_instant_booking_enabled
      and not hotel_stripe_connect_enabled) from public.site_settings)
     or exists(select 1 from public.hotel_calendar_source_configs
       where source_type<>'manual' and is_enabled)
     or exists(select 1 from hotels_v2_private.hotel_external_calendar_sync_jobs
       where status in('queued','leased','running')) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_activation_state_mismatch';
  end if;
  if (select count(*) from vault.decrypted_secrets
      where name='hotels-v2-external-calendar-worker-url'
        and decrypted_secret='https://daoohnbnnowmmcizgvrq.functions.supabase.co/hotels-v2-external-calendar-sync')<>1
     or (select count(*) from vault.decrypted_secrets
      where name='hotels-v2-external-calendar-worker-shared-secret'
        and length(decrypted_secret)>=32 and decrypted_secret!~'[[:space:][:cntrl:]]')<>1 then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_activation_vault_binding_missing';
  end if;
  if exists(select 1 from cron.job where jobname='hotels-v2-external-calendar-15m') then
    raise exception using errcode='23505',message='hotels_v2_external_calendar_scheduler_already_installed';
  end if;
end
$activation_guard$;

do $activate_flag$
begin
  update public.site_settings set hotel_external_sync_enabled=true where id=1
    and not hotel_rooms_v2_enabled and not hotel_external_sync_enabled
    and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled;
  if not found then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_activation_flag_update_failed';
  end if;
end
$activate_flag$;

select cron.schedule('hotels-v2-external-calendar-15m','*/15 * * * *',
  $command$select public.hotel_v2_external_calendar_scheduler_dispatch()$command$);
notify pgrst,'reload schema';
commit;
