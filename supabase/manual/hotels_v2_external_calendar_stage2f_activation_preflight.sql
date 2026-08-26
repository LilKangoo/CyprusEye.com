-- Read-only SQL Editor activation readiness proof. This does not flip a flag.
with checks as(
  select
    to_regprocedure('public.hotel_v2_external_calendar_worker_finalize_sync(jsonb)') is not null worker_ready,
    to_regprocedure('public.hotel_v2_admin_apply_external_calendar_plan(jsonb,uuid,uuid,text)') is not null admin_ready,
    to_regprocedure('public.hotel_v2_partner_apply_external_calendar_plan(jsonb,uuid,uuid,text)') is not null partner_ready,
    to_regprocedure('public.hotel_v2_external_calendar_scheduler_dispatch()') is not null scheduler_ready,
    to_regprocedure('public.hotel_v2_external_calendar_provider_evolution_is_safe()') is not null
      and public.hotel_v2_external_calendar_provider_evolution_is_safe() provider_types_ready,
    to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null pg_net_ready,
    exists(select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
      join public.site_settings setting on setting.id=receipt.id where receipt.id=1
        and receipt.site_settings_without_external_fingerprint=
          public.hotel_v2_external_calendar_worker_hash(to_jsonb(setting)-'hotel_external_sync_enabled')
        and receipt.compatibility_function_fingerprints=
          public.hotel_v2_external_calendar_activation_function_fingerprints()) compatibility_ready,
    (pg_get_functiondef('public.hotel_v2_external_calendar_scheduler_dispatch()'::regprocedure)
      like '%https://daoohnbnnowmmcizgvrq.functions.supabase.co/hotels-v2-external-calendar-sync%'
      and pg_get_functiondef('public.hotel_v2_external_calendar_scheduler_dispatch()'::regprocedure)
        like '%timeout_milliseconds=>150000%'
      and pg_get_functiondef('public.hotel_v2_external_calendar_scheduler_dispatch()'::regprocedure)
        like '%''limit'',8%') dispatch_contract_ready,
    to_regclass('cron.job') is not null pg_cron_ready,
    (select count(*)=1 from vault.decrypted_secrets
      where name='hotels-v2-external-calendar-worker-url'
        and decrypted_secret='https://daoohnbnnowmmcizgvrq.functions.supabase.co/hotels-v2-external-calendar-sync') worker_url_ready,
    (select count(*)=1 from vault.decrypted_secrets
      where name='hotels-v2-external-calendar-worker-shared-secret'
        and length(decrypted_secret)>=32 and decrypted_secret!~'[[:space:][:cntrl:]]') scoped_secret_ready,
    (select count(*)=1 and bool_and(id=1 and not hotel_rooms_v2_enabled
      and not hotel_external_sync_enabled and not hotel_instant_booking_enabled
      and not hotel_stripe_connect_enabled) from public.site_settings) flags_inert,
    not exists(select 1 from public.hotel_calendar_source_configs
      where source_type<>'manual' and is_enabled) external_sources_disabled,
    not exists(select 1 from hotels_v2_private.hotel_external_calendar_sync_jobs
      where status in('queued','leased','running')) no_open_jobs
), result as(select *,worker_ready and admin_ready and partner_ready and scheduler_ready
  and provider_types_ready and pg_net_ready and compatibility_ready and dispatch_contract_ready
  and pg_cron_ready and worker_url_ready and scoped_secret_ready
  and flags_inert and external_sources_disabled and no_open_jobs as stage2f_activation_ready from checks)
select 'hotels_v2_external_calendar_stage2f_activation_preflight_v1' contract_version,result.* from result;
