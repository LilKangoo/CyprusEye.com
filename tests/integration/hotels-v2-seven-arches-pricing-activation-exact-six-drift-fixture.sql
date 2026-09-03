\set ON_ERROR_STOP on

-- Disposable post-114370/pre-114400 production-shaped live evolution. The
-- filename is retained so existing focused runners keep working; this is no
-- longer an exact-cardinality allowlist fixture. It proves that normal global
-- operational activity can advance after the immutable 114370 receipt while
-- the exact 7 Arches Hotel lineage remains unchanged.

create temporary table seven_arches_task3_live_baseline_before
on commit preserve rows as
select
  foundation.protected_fingerprints task2_protected_fingerprints,
  public.hotel_v2_external_calendar_stage2_compatible_fingerprints()
    stage2_protected_fingerprints,
  to_jsonb(foundation) property_foundation_receipt,
  to_jsonb(owner_receipt) owner_foundation_receipt,
  (select to_jsonb(hotel) from public.hotels hotel
    where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid) target_hotel,
  (select jsonb_agg(to_jsonb(assignment) order by assignment.id)
    from public.partner_resources assignment
    where assignment.resource_type='hotels'
      and assignment.resource_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)
    target_assignments,
  (select jsonb_agg(to_jsonb(policy) order by policy.id)
    from public.hotel_commission_policies policy
    where policy.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)
    target_commission_policies,
  (select jsonb_agg(to_jsonb(policy) order by policy.id)
    from public.hotel_payment_policies policy
    where policy.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)
    target_payment_policies,
  (select jsonb_agg(to_jsonb(term) order by term.id)
    from public.hotel_payment_policy_terms term
    where term.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)
    target_payment_terms,
  (select count(*) from public.affiliate_commission_events) affiliate_event_count,
  (select to_jsonb(event_row) from public.affiliate_commission_events event_row
    where event_row.id='36000000-0000-4000-8000-000000000110'::uuid)
    historical_affiliate_event
from public.hotel_partner_property_proposal_foundation_receipts foundation
cross join public.hotel_admin_availability_foundation_evolution_receipts owner_receipt
where foundation.id=1 and owner_receipt.id=1;

do $live_baseline_fixture_prerequisites$
begin
  if (select count(*) from seven_arches_task3_live_baseline_before)<>1
     or (select count(*)
       from public.hotel_admin_availability_foundation_evolution_receipts)<>1
     or (select count(*)
       from public.hotel_partner_property_proposal_foundation_receipts)<>1
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
     or not exists(select 1 from public.affiliate_commission_events
       where id='36000000-0000-4000-8000-000000000110')
     or not exists(select 1 from public.site_settings where id=1) then
    raise exception 'seven_arches_task3_live_baseline_fixture_prerequisite_missing';
  end if;
end
$live_baseline_fixture_prerequisites$;

-- First normal operational advancement after the 114370 receipt.
update public.partner_service_fulfillment_form_snapshots
set snapshot=snapshot||'{"task3_live_baseline_phase":1}'::jsonb
where id='36000000-0000-4000-8000-000000000106';

update public.partner_service_fulfillments
set status='accepted'
where id='36000000-0000-4000-8000-000000000104';

update public.profile_referral_code_aliases
set reason='Task3 production-shaped live evolution'
where id='36000000-0000-4000-8000-000000000108';

do $live_baseline_referral_transition$
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
$live_baseline_referral_transition$;

update public.service_deposit_requests
set resource_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
where id='36000000-0000-4000-8000-000000000109';

-- A later reviewed deposit/affiliate operation appends a new event. All
-- identities are synthetic and linked to the existing unrelated Partner.
insert into public.service_deposit_requests(id,resource_type,resource_id,created_at)
values('36000000-0000-4000-8000-000000000113','hotels',
  'c1000000-0000-4000-8000-000000000001','2026-08-31T18:01:00Z');

insert into public.affiliate_commission_events(
  id,partner_id,deposit_request_id,level,referrer_user_id,referred_user_id,
  resource_type,booking_id,fulfillment_id,deposit_paid_at,deposit_amount,
  commission_bps,commission_amount,currency,created_at
) values(
  '36000000-0000-4000-8000-000000000114',
  '20000000-0000-4000-8000-000000000002',
  '36000000-0000-4000-8000-000000000113',1,
  '36000000-0000-4000-8000-000000000101',
  '36000000-0000-4000-8000-000000000102','hotels',
  '36000000-0000-4000-8000-000000000105',
  '36000000-0000-4000-8000-000000000104','2026-08-31T18:01:00Z',
  120,550,6.60,'EUR','2026-08-31T18:01:00Z');

-- A subsequent alias operation proves this is an evolving stream rather than
-- a one-audit-date snapshot.
insert into public.profile_referral_code_aliases(
  id,user_id,referral_code,referral_code_normalized,created_at,created_by,reason
) values(
  '36000000-0000-4000-8000-000000000115',
  '36000000-0000-4000-8000-000000000101','LIVEDRIFT2','livedrift2',
  '2026-08-31T18:02:00Z','36000000-0000-4000-8000-000000000101',
  'Disposable subsequent live evolution');

update public.partner_service_fulfillment_form_snapshots
set snapshot=snapshot||'{"task3_live_baseline_phase":2}'::jsonb
where id='36000000-0000-4000-8000-000000000106';

update public.site_settings
set car_multi_city_mapped_enabled=not car_multi_city_mapped_enabled,
  car_threshold_daily_rates_enabled=not car_threshold_daily_rates_enabled,
  force_refresh_version=81,
  updated_at='2026-08-31T18:02:00Z'::timestamptz,
  updated_by='36000000-0000-4000-8000-000000000101'
where id=1;

create temporary table seven_arches_task3_live_baseline_after
on commit preserve rows as
select
  public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()
    task2_protected_fingerprints,
  public.hotel_v2_external_calendar_stage2_compatible_fingerprints()
    stage2_protected_fingerprints;

do $live_baseline_fixture_shape$
declare
  v_before seven_arches_task3_live_baseline_before%rowtype;
  v_after seven_arches_task3_live_baseline_after%rowtype;
begin
  select * into strict v_before from seven_arches_task3_live_baseline_before;
  select * into strict v_after from seven_arches_task3_live_baseline_after;

  if v_before.task2_protected_fingerprints is not distinct from
       v_after.task2_protected_fingerprints
     or v_before.stage2_protected_fingerprints is not distinct from
       v_after.stage2_protected_fingerprints
     or v_before.task2_protected_fingerprints->'affiliate_commission_events'
       is not distinct from
       v_after.task2_protected_fingerprints->'affiliate_commission_events'
     or v_before.stage2_protected_fingerprints->'affiliate_commission_events'
       is not distinct from
       v_after.stage2_protected_fingerprints->'affiliate_commission_events'
     or (select count(*) from public.affiliate_commission_events)
       <>v_before.affiliate_event_count+1
     or (select to_jsonb(event_row) from public.affiliate_commission_events event_row
       where event_row.id='36000000-0000-4000-8000-000000000110'::uuid)
       is distinct from v_before.historical_affiliate_event
     or not exists(select 1 from public.affiliate_commission_events event_row
       join public.service_deposit_requests deposit
         on deposit.id=event_row.deposit_request_id
       join public.partner_service_fulfillments fulfillment
         on fulfillment.id=event_row.fulfillment_id
       where event_row.id='36000000-0000-4000-8000-000000000114'::uuid
         and event_row.partner_id=fulfillment.partner_id
         and event_row.resource_type=deposit.resource_type)
     or (select to_jsonb(foundation)
       from public.hotel_partner_property_proposal_foundation_receipts foundation
       where foundation.id=1) is distinct from v_before.property_foundation_receipt
     or (select to_jsonb(owner_receipt)
       from public.hotel_admin_availability_foundation_evolution_receipts owner_receipt
       where owner_receipt.id=1) is distinct from v_before.owner_foundation_receipt
     or (select to_jsonb(hotel) from public.hotels hotel
       where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)
       is distinct from v_before.target_hotel
     or (select jsonb_agg(to_jsonb(assignment) order by assignment.id)
       from public.partner_resources assignment
       where assignment.resource_type='hotels'
         and assignment.resource_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)
       is distinct from v_before.target_assignments
     or (select jsonb_agg(to_jsonb(policy) order by policy.id)
       from public.hotel_commission_policies policy
       where policy.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)
       is distinct from v_before.target_commission_policies
     or (select jsonb_agg(to_jsonb(policy) order by policy.id)
       from public.hotel_payment_policies policy
       where policy.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)
       is distinct from v_before.target_payment_policies
     or (select jsonb_agg(to_jsonb(term) order by term.id)
       from public.hotel_payment_policy_terms term
       where term.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid)
       is distinct from v_before.target_payment_terms then
    raise exception using errcode='55000',
      message='seven_arches_task3_live_baseline_fixture_shape_mismatch';
  end if;
end
$live_baseline_fixture_shape$;

select 'HOTELS_V2_7A_PRICING_ACTIVATION_LIVE_BASELINE_FIXTURE_OK' sentinel,
  true broad_maps_advanced,
  true affiliate_event_appended,
  true target_lineage_unchanged;
