\set ON_ERROR_STOP on
\set provider_install_external_enabled 1
\set seven_arches_owner_live_drift_fixture 1
\set seven_arches_pricing_activation_exact_six_fixture 1
\ir hotels-v2-seven-arches-pricing-activation-postgres-base.sql
\ir ../../supabase/manual/hotels_v2_seven_arches_pricing_activation_preflight.sql
\ir ../../supabase/migrations/20260811440000_hotels_v2_seven_arches_pricing_activation.sql

begin;
set local statement_timeout='180s';

create function pg_temp.hotel_v2_114400_exact_six_inflight_mutation()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public
as $function$
declare v_key text:=current_setting('hotels_v2_test.exact_six_inflight_key',true);
begin
  case v_key
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
    else
      raise exception 'exact_six_inflight_unknown_key:%',v_key;
  end case;
  return null;
end
$function$;

create trigger hotel_v2_114400_exact_six_inflight_mutation
after insert on public.hotel_activity_log
for each statement execute function pg_temp.hotel_v2_114400_exact_six_inflight_mutation();

-- The negative calls execute as the browser role, which intentionally has no
-- raw access to the reviewed activation relations.  Keep rollback inspection
-- behind a test-only postgres-owned helper instead of weakening those ACLs.
create function pg_temp.hotel_v2_114400_exact_six_inflight_is_clean()
returns boolean language sql stable security definer
set search_path=pg_catalog,public
as $function$
select not exists(
    select 1 from public.hotel_seven_arches_pricing_activation_evolution_receipts)
  and not exists(
    select 1 from public.hotel_seven_arches_pricing_activation_transaction_context)
  and not exists(
    select 1 from public.hotel_seven_arches_pricing_activation_reviews);
$function$;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

do $exact_six_inflight_negatives$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_key text; v_snapshot jsonb; v_preview jsonb; v_failed boolean; v_message text;
  v_case integer:=0;
begin
  foreach v_key in array array[
    'partner_service_fulfillment_form_snapshots',
    'partner_service_fulfillments',
    'profile_referral_code_aliases',
    'referrals',
    'service_deposit_requests']::text[] loop
    v_case:=v_case+1;
    perform set_config('hotels_v2_test.exact_six_inflight_key',v_key,true);
    v_failed:=false;
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
          'reason','Exact-six in-flight negative '||v_key));
      perform public.hotel_v2_admin_apply_seven_arches_pricing_activation(
        v_preview->'reviewed_plan',
        ('39000000-0000-4000-8000-'||lpad(v_case::text,12,'0'))::uuid,
        'seven-arches-exact-six-inflight-'||v_case::text);
    exception when sqlstate '55000' then
      get stacked diagnostics v_message=message_text;
      v_failed:=v_message in(
        'hotels_v2_seven_arches_pricing_activation_delta_scope_mismatch',
        'hotels_v2_seven_arches_pricing_activation_stage2_delta_scope_mismatch',
        'hotels_v2_seven_arches_pricing_activation_postcondition_failed',
        'hotels_v2_seven_arches_pricing_activation_full_postcondition_failed');
    end;
    if not v_failed
       or pg_temp.hotel_v2_114400_exact_six_inflight_is_clean() is not true then
      raise exception using errcode='55000',
        message='seven_arches_exact_six_inflight_negative_failed',
        detail=jsonb_build_object('key',v_key,'message',v_message)::text;
    end if;
  end loop;
end
$exact_six_inflight_negatives$;

reset role;
rollback;

select 'HOTELS_V2_7A_PRICING_ACTIVATION_EXACT_SIX_INFLIGHT_GATE_PASS' sentinel,
  5 non_site_settings_mutation_negatives,true rollback_contained;
