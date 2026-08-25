-- Read-only production preflight for Hotels V2 external calendar Stages 2B-2E.
begin;
set transaction read only;
set local statement_timeout='90s';
do $preflight$
declare v_h3 jsonb;
begin
  if to_regclass('hotels_v2_private.hotel_external_calendar_source_secrets') is null
     or to_regprocedure('public.hotel_v2_external_calendar_worker_get_source(uuid)') is null
     or to_regprocedure('public.hotel_v2_admin_d_snapshot(uuid,date,date,boolean)') is null
     or to_regprocedure('public.hotel_v2_h3_2b_access_snapshot(uuid,uuid,text)') is null
     or to_regclass('vault.secrets') is null or to_regclass('vault.decrypted_secrets') is null
     or to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_stage2b_2e_dependencies_missing';
  end if;
  if to_regclass('hotels_v2_private.hotel_external_calendar_sync_jobs') is not null
     or to_regprocedure('public.hotel_v2_external_calendar_worker_finalize_sync(jsonb)') is not null then
    raise exception using errcode='23514',message='hotels_v2_external_calendar_stage2b_2e_already_present';
  end if;
  if not (select count(*)=1 and bool_and(id=1 and not hotel_rooms_v2_enabled
      and not hotel_external_sync_enabled and not hotel_instant_booking_enabled
      and not hotel_stripe_connect_enabled) from public.site_settings)
     or exists(select 1 from public.hotel_calendar_source_configs
       where source_type<>'manual' and is_enabled) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_preflight_not_inert';
  end if;
  if not exists(select 1 from public.hotel_admin_availability_foundation_receipts receipt
      where receipt.id=1 and receipt.protected_fingerprints=public.hotel_v2_admin_d_protected_fingerprints()
        and receipt.protected_fingerprint=public.hotel_v2_admin_d_hash(receipt.protected_fingerprints))
     or not exists(select 1 from public.hotel_partner_workspace_foundation_receipts receipt
      where receipt.id=1 and receipt.protected_fingerprints=public.hotel_v2_h3_2b_protected_fingerprints()
        and receipt.protected_fingerprint=public.hotel_v2_h3_2b_hash(receipt.protected_fingerprints)) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_preflight_foundation_drift';
  end if;
  v_h3:=public.hotel_v2_h3_1p_pricing_promotion_snapshot('9b6d99a0-923a-4fbc-be54-c066e856e6ca');
  if not coalesce((v_h3->>'supported')::boolean,false)
     or v_h3#>>'{promotion,status}'<>'reviewed'
     or (v_h3#>>'{parity,total_case_count}')::integer<>70
     or (v_h3#>>'{parity,total_mismatch_count}')::integer<>0
     or not public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact() then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_preflight_h3_contract_drift';
  end if;
end
$preflight$;
select 'hotels_v2_external_calendar_stage2b_2e_preflight_v1' contract_version,
  0 protected_mismatch_count,0 security_mismatch_count,0 h3_parity_mismatch_count,
  0 activation_mismatch_count,true stage2b_2e_preflight_safe;
commit;
