do $verify$
begin
  if not (select count(*)=1 and bool_and(id=1 and not hotel_rooms_v2_enabled
      and hotel_external_sync_enabled and not hotel_instant_booking_enabled
      and not hotel_stripe_connect_enabled) from public.site_settings)
     or not public.hotel_v2_h3_2b_flags_off()
     or not exists(select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
       join public.site_settings setting on setting.id=receipt.id
       where receipt.id=1 and receipt.site_settings_without_external_fingerprint=
         public.hotel_v2_external_calendar_worker_hash(to_jsonb(setting)-'hotel_external_sync_enabled'))
     or not exists(select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
       where receipt.id=1 and receipt.compatibility_function_fingerprints=
         public.hotel_v2_external_calendar_activation_function_fingerprints())
     or pg_get_functiondef('public.hotel_v2_external_calendar_scheduler_dispatch()'::regprocedure)
       not like '%https://daoohnbnnowmmcizgvrq.functions.supabase.co/hotels-v2-external-calendar-sync%'
     or pg_get_functiondef('public.hotel_v2_external_calendar_scheduler_dispatch()'::regprocedure)
       not like '%timeout_milliseconds=>150000%'
     or pg_get_functiondef('public.hotel_v2_external_calendar_scheduler_dispatch()'::regprocedure)
       not like '%''limit'',8%'
     or (select count(*) from cron.job where jobname='hotels-v2-external-calendar-15m'
       and schedule='*/15 * * * *' and active)<>1 then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_stage2f_activation_verify_failed';
  end if;
end
$verify$;
select 'hotels_v2_external_calendar_stage2f_activation_verify_v1' contract_version,
  true stage2f_activation_safe;
