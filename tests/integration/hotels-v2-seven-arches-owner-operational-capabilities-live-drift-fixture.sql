-- Disposable pre-114360 live-production drift. All changes are unrelated to
-- the target 7 Arches owner boundary and occur after the immutable historical
-- ADMIN-D/H3.2B/Stage2 receipts were captured.

create temporary table seven_arches_historical_receipts_before
on commit preserve rows as
select 'admin_d'::text receipt_name,to_jsonb(receipt) value
from public.hotel_admin_availability_foundation_receipts receipt where receipt.id=1
union all
select 'h3_2b',to_jsonb(receipt)
from public.hotel_partner_workspace_foundation_receipts receipt where receipt.id=1
union all
select 'external_calendar',to_jsonb(receipt)
from hotels_v2_private.hotel_external_calendar_foundation_receipts receipt where receipt.id=1
union all
select 'stage2f_activation',to_jsonb(receipt)
from hotels_v2_private.hotel_external_calendar_activation_receipts receipt where receipt.id=1;

insert into public.profiles(id,email,is_admin) values
  ('36000000-0000-4000-8000-000000000101','live-drift-referrer@example.test',false),
  ('36000000-0000-4000-8000-000000000102','live-drift-referred@example.test',false);
insert into auth.users(id,email) values
  ('36000000-0000-4000-8000-000000000101','live-drift-referrer@example.test'),
  ('36000000-0000-4000-8000-000000000102','live-drift-referred@example.test');

update public.partners
set name='Synthetic Other Partner (live drift)'
where id='20000000-0000-4000-8000-000000000002';
insert into public.partner_users(id,partner_id,user_id,role) values(
  '36000000-0000-4000-8000-000000000103',
  '20000000-0000-4000-8000-000000000002',
  '36000000-0000-4000-8000-000000000101','member');

update public.hotels
set description_i18n='{"en":"Unrelated Hotel live operational edit"}'::jsonb
where id='c1000000-0000-4000-8000-000000000001';

insert into public.partner_service_fulfillments(
  id,resource_type,booking_id,resource_id,partner_id,status
) values(
  '36000000-0000-4000-8000-000000000104','hotels',
  '36000000-0000-4000-8000-000000000105',
  'c1000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002','pending_acceptance');
insert into public.partner_service_fulfillment_form_snapshots(
  id,fulfillment_id,snapshot
) values(
  '36000000-0000-4000-8000-000000000106',
  '36000000-0000-4000-8000-000000000104',
  '{"fixture":"legitimate_live_drift"}'::jsonb);

insert into public.referrals(id,referrer_id,referred_id,status) values(
  '36000000-0000-4000-8000-000000000107',
  '36000000-0000-4000-8000-000000000101',
  '36000000-0000-4000-8000-000000000102','pending');
insert into public.affiliate_referrer_overrides(
  referrer_user_id,level1_bps_override,notes
) values(
  '36000000-0000-4000-8000-000000000101',550,
  'Disposable legitimate live-drift fixture');
insert into public.profile_referral_code_aliases(
  id,user_id,referral_code,referral_code_normalized,created_by,reason
) values(
  '36000000-0000-4000-8000-000000000108',
  '36000000-0000-4000-8000-000000000101','LIVEDRIFT','livedrift',
  '36000000-0000-4000-8000-000000000101','Disposable fixture');
insert into public.service_deposit_requests(id,resource_type,resource_id) values(
  '36000000-0000-4000-8000-000000000109','hotels',
  'c1000000-0000-4000-8000-000000000001');
insert into public.affiliate_commission_events(
  id,partner_id,deposit_request_id,level,referrer_user_id,referred_user_id,
  resource_type,booking_id,fulfillment_id,deposit_amount,commission_bps,
  commission_amount,currency
) values(
  '36000000-0000-4000-8000-000000000110',
  '20000000-0000-4000-8000-000000000002',
  '36000000-0000-4000-8000-000000000109',1,
  '36000000-0000-4000-8000-000000000101',
  '36000000-0000-4000-8000-000000000102','hotels',
  '36000000-0000-4000-8000-000000000105',
  '36000000-0000-4000-8000-000000000104',100,550,5.50,'EUR');

insert into public.hotel_activity_log(
  id,hotel_id,entity_type,entity_id,action,before_state,after_state,
  actor_type,actor_id,source,correlation_id
) values(
  '36000000-0000-4000-8000-000000000111',
  'c1000000-0000-4000-8000-000000000001','property',
  'c1000000-0000-4000-8000-000000000001','update',
  '{"operational_note":null}'::jsonb,
  '{"operational_note":"unrelated live activity"}'::jsonb,
  'system',null,'hotels_v2_live_drift_fixture',
  '36000000-0000-4000-8000-000000000112');

update public.site_settings set
  car_multi_city_mapped_enabled=true,
  car_threshold_daily_rates_enabled=true,
  force_refresh_version=79,
  updated_at=clock_timestamp(),
  updated_by='36000000-0000-4000-8000-000000000101'
where id=1;

create temporary table seven_arches_live_drift_before
on commit preserve rows as
select public.hotel_v2_admin_d_protected_fingerprints() value;

create temporary table seven_arches_live_drift_stage2_before
on commit preserve rows as
select public.hotel_v2_external_calendar_protected_fingerprints() value;

do $live_drift_shape$
declare v_changed text[];
begin
  select coalesce(array_agg(current_state.key order by current_state.key),'{}'::text[])
  into v_changed
  from jsonb_each((select value from seven_arches_live_drift_before)) current_state
  where current_state.value is distinct from (
    select receipt.protected_fingerprints->current_state.key
    from public.hotel_admin_availability_foundation_receipts receipt where receipt.id=1
  );
  if not array['affiliate_commission_events','affiliate_referrer_overrides',
      'hotels','non_admin_d_activity',
      'partner_service_fulfillment_form_snapshots','partner_service_fulfillments',
      'partner_users','partners','profile_referral_code_aliases','referrals',
      'service_deposit_requests','site_settings']::text[] <@ v_changed then
    raise exception 'seven_arches_live_drift_fixture_missing_categories:%',v_changed;
  end if;
end
$live_drift_shape$;
