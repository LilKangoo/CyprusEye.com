\set ON_ERROR_STOP on
\set provider_install_external_enabled 1
\set seven_arches_owner_live_drift_fixture 1
\set seven_arches_pricing_activation_exact_six_fixture 1
\ir hotels-v2-seven-arches-pricing-activation-postgres-base.sql
\ir ../../supabase/manual/hotels_v2_seven_arches_pricing_activation_preflight.sql
\ir ../../supabase/migrations/20260811440000_hotels_v2_seven_arches_pricing_activation.sql

begin;
set local statement_timeout='180s';

-- The compatibility model intentionally permits unrelated live activity
-- before or after rollout. It must still reject any unrelated mutation made
-- inside the protected activation transaction. Capture the complete broad
-- maps so each failing probe also proves rollback containment.
create temporary table seven_arches_114400_full_preservation_before
on commit drop as
select
  public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()
    task2_protected_fingerprints,
  public.hotel_v2_external_calendar_stage2_compatible_fingerprints()
    stage2_protected_fingerprints;

create function pg_temp.hotel_v2_114400_full_preservation_mutation()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public
as $function$
declare v_key text:=current_setting(
  'hotels_v2_test.full_preservation_inflight_key',true);
begin
  case v_key
    when 'affiliate_commission_events' then
      insert into public.affiliate_commission_events(
        id,partner_id,deposit_request_id,level,referrer_user_id,referred_user_id,
        resource_type,booking_id,fulfillment_id,deposit_paid_at,deposit_amount,
        commission_bps,commission_amount,currency,created_at
      ) values(
        '36000000-0000-4000-8000-000000000199',
        '20000000-0000-4000-8000-000000000002',
        '36000000-0000-4000-8000-000000000109',2,
        '36000000-0000-4000-8000-000000000101',
        '36000000-0000-4000-8000-000000000102','hotels',
        '36000000-0000-4000-8000-000000000105',
        '36000000-0000-4000-8000-000000000104',clock_timestamp(),
        100,100,1.00,'EUR',clock_timestamp())
      on conflict(id) do nothing;
    when 'partner_service_fulfillment_form_snapshots' then
      update public.partner_service_fulfillment_form_snapshots
      set snapshot=snapshot||'{"task3_inflight":true}'::jsonb
      where id='36000000-0000-4000-8000-000000000106'::uuid;
    when 'partner_service_fulfillments' then
      update public.partner_service_fulfillments
      set status='pending_acceptance'
      where id='36000000-0000-4000-8000-000000000104'::uuid;
    when 'profile_referral_code_aliases' then
      update public.profile_referral_code_aliases
      set reason=reason||' inflight'
      where id='36000000-0000-4000-8000-000000000108'::uuid;
    when 'referrals' then
      update public.referrals set status='pending'
      where id='36000000-0000-4000-8000-000000000107'::uuid;
    when 'service_deposit_requests' then
      update public.service_deposit_requests set resource_id=null
      where id='36000000-0000-4000-8000-000000000109'::uuid;
    when 'site_settings' then
      update public.site_settings
      set force_refresh_version=force_refresh_version+1,
        updated_at=clock_timestamp()
      where id=1;
    else
      raise exception 'full_preservation_inflight_unknown_key:%',v_key;
  end case;
  return null;
end
$function$;

create trigger hotel_v2_114400_full_preservation_inflight_mutation
after insert on public.hotel_activity_log
for each statement execute function
  pg_temp.hotel_v2_114400_full_preservation_mutation();

-- Browser roles intentionally have no raw access to the reviewed activation
-- relations. Keep rollback inspection behind this test-only postgres helper.
create function pg_temp.hotel_v2_114400_full_preservation_is_clean()
returns boolean language sql stable security definer
set search_path=pg_catalog,public
as $function$
select not exists(
    select 1 from public.hotel_seven_arches_pricing_activation_evolution_receipts)
  and not exists(
    select 1 from public.hotel_seven_arches_pricing_activation_transaction_context)
  and not exists(
    select 1 from public.hotel_seven_arches_pricing_activation_reviews)
  and public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()
    is not distinct from (select task2_protected_fingerprints
      from pg_temp.seven_arches_114400_full_preservation_before)
  and public.hotel_v2_external_calendar_stage2_compatible_fingerprints()
    is not distinct from (select stage2_protected_fingerprints
      from pg_temp.seven_arches_114400_full_preservation_before);
$function$;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

do $full_preservation_inflight_negatives$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_key text; v_snapshot jsonb; v_preview jsonb; v_failed boolean; v_message text;
  v_case integer:=0;
begin
  foreach v_key in array array[
    'affiliate_commission_events',
    'partner_service_fulfillment_form_snapshots',
    'partner_service_fulfillments',
    'profile_referral_code_aliases',
    'referrals',
    'service_deposit_requests',
    'site_settings']::text[] loop
    v_case:=v_case+1;
    perform set_config('hotels_v2_test.full_preservation_inflight_key',v_key,true);
    v_failed:=false;
    v_message:=null;
    begin
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
          'reason','Full transaction preservation negative '||v_key));
      perform public.hotel_v2_admin_apply_seven_arches_pricing_activation(
        v_preview->'reviewed_plan',
        ('39000000-0000-4000-8000-'||lpad(v_case::text,12,'0'))::uuid,
        'seven-arches-full-preservation-'||v_case::text);
    exception when sqlstate '55000' then
      get stacked diagnostics v_message=message_text;
      v_failed:=v_message in(
        'hotels_v2_seven_arches_pricing_activation_delta_scope_mismatch',
        'hotels_v2_seven_arches_pricing_activation_stage2_delta_scope_mismatch',
        'hotels_v2_seven_arches_pricing_activation_postcondition_failed',
        'hotels_v2_seven_arches_pricing_activation_full_postcondition_failed');
    end;
    if not v_failed
       or pg_temp.hotel_v2_114400_full_preservation_is_clean() is not true then
      raise exception using errcode='55000',
        message='seven_arches_full_preservation_inflight_negative_failed',
        detail=jsonb_build_object('key',v_key,'message',v_message)::text;
    end if;
  end loop;
end
$full_preservation_inflight_negatives$;

reset role;
rollback;

select 'HOTELS_V2_7A_PRICING_ACTIVATION_FULL_PRESERVATION_INFLIGHT_GATE_PASS'
    sentinel,
  7 unrelated_inflight_mutation_negatives,true rollback_contained;
