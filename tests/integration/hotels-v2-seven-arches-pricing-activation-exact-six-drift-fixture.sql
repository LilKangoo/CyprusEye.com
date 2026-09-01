\set ON_ERROR_STOP on

-- Disposable post-114370/pre-114400 production-shaped drift. The broad
-- owner live-drift fixture establishes the accepted historical lineage before
-- 114360. This fixture then changes exactly the six legitimate mutable
-- fingerprint classes observed between the immutable Task2 receipt and the
-- reviewed pricing-activation boundary.

create temporary table seven_arches_task3_exact_six_before
on commit preserve rows as
select
  foundation.protected_fingerprints task2_protected_fingerprints,
  public.hotel_v2_external_calendar_stage2_compatible_fingerprints()
    stage2_protected_fingerprints
from public.hotel_partner_property_proposal_foundation_receipts foundation
where foundation.id=1;

do $exact_six_fixture_prerequisites$
begin
  if (select count(*) from seven_arches_task3_exact_six_before)<>1
     or (select count(*) from public.hotel_admin_availability_foundation_evolution_receipts)<>1
     or (select count(*) from public.hotel_partner_property_proposal_foundation_receipts)<>1
     or not exists(select 1 from public.partner_service_fulfillments
       where id='36000000-0000-4000-8000-000000000104')
     or not exists(select 1 from public.partner_service_fulfillment_form_snapshots
       where id='36000000-0000-4000-8000-000000000106')
     or not exists(select 1 from public.profile_referral_code_aliases
       where id='36000000-0000-4000-8000-000000000108')
     or not exists(select 1 from public.referrals
       where id='36000000-0000-4000-8000-000000000107')
     or not exists(select 1 from public.service_deposit_requests
       where id='36000000-0000-4000-8000-000000000109')
     or not exists(select 1 from public.site_settings where id=1) then
    raise exception 'seven_arches_task3_exact_six_fixture_prerequisite_missing';
  end if;
end
$exact_six_fixture_prerequisites$;

update public.partner_service_fulfillment_form_snapshots
set snapshot=snapshot||'{"task3_exact_six":true}'::jsonb
where id='36000000-0000-4000-8000-000000000106';

update public.partner_service_fulfillments
set status='accepted'
where id='36000000-0000-4000-8000-000000000104';

update public.profile_referral_code_aliases
set reason='Task3 exact-six production-shaped drift'
where id='36000000-0000-4000-8000-000000000108';

do $exact_six_referral_transition$
begin
  if exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='referrals'
      and column_name='confirmed_at') then
    execute $sql$update public.referrals
      set status='confirmed',confirmed_at='2026-08-31T18:00:00Z'::timestamptz
      where id='36000000-0000-4000-8000-000000000107'$sql$;
  else
    update public.referrals set status='confirmed'
    where id='36000000-0000-4000-8000-000000000107';
  end if;
end
$exact_six_referral_transition$;

update public.service_deposit_requests
set resource_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
where id='36000000-0000-4000-8000-000000000109';

update public.site_settings
set force_refresh_version=80,
  updated_at='2026-08-31T18:00:00Z'::timestamptz,
  updated_by='36000000-0000-4000-8000-000000000101'
where id=1;

create temporary table seven_arches_task3_exact_six_after
on commit preserve rows as
select
  public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()
    task2_protected_fingerprints,
  public.hotel_v2_external_calendar_stage2_compatible_fingerprints()
    stage2_protected_fingerprints;

do $exact_six_fixture_shape$
declare
  c_expected constant text[]:=array[
    'partner_service_fulfillment_form_snapshots',
    'partner_service_fulfillments',
    'profile_referral_code_aliases',
    'referrals',
    'service_deposit_requests',
    'site_settings']::text[];
  v_task2_changed text[];
  v_stage2_changed text[];
begin
  select coalesce(array_agg(keys.key order by keys.key collate "C"),'{}'::text[])
  into v_task2_changed
  from (
    select jsonb_object_keys(before_state.task2_protected_fingerprints||
      after_state.task2_protected_fingerprints) key
    from seven_arches_task3_exact_six_before before_state
    cross join seven_arches_task3_exact_six_after after_state
  ) keys
  cross join seven_arches_task3_exact_six_before before_state
  cross join seven_arches_task3_exact_six_after after_state
  where before_state.task2_protected_fingerprints->keys.key is distinct from
    after_state.task2_protected_fingerprints->keys.key;

  select coalesce(array_agg(keys.key order by keys.key collate "C"),'{}'::text[])
  into v_stage2_changed
  from (
    select jsonb_object_keys(before_state.stage2_protected_fingerprints||
      after_state.stage2_protected_fingerprints) key
    from seven_arches_task3_exact_six_before before_state
    cross join seven_arches_task3_exact_six_after after_state
  ) keys
  cross join seven_arches_task3_exact_six_before before_state
  cross join seven_arches_task3_exact_six_after after_state
  where before_state.stage2_protected_fingerprints->keys.key is distinct from
    after_state.stage2_protected_fingerprints->keys.key;

  if v_task2_changed is distinct from c_expected
     or v_stage2_changed is distinct from c_expected then
    raise exception using errcode='55000',
      message='seven_arches_task3_exact_six_fixture_shape_mismatch',
      detail=jsonb_build_object('expected',c_expected,'task2',v_task2_changed,
        'stage2',v_stage2_changed)::text;
  end if;
end
$exact_six_fixture_shape$;

select 'HOTELS_V2_7A_PRICING_ACTIVATION_EXACT_SIX_FIXTURE_OK' sentinel,
  array[
    'partner_service_fulfillment_form_snapshots',
    'partner_service_fulfillments',
    'profile_referral_code_aliases',
    'referrals',
    'service_deposit_requests',
    'site_settings']::text[] changed_keys;
