\set ON_ERROR_STOP on
-- Production-shaped chain through ADMIN-C. All A/B/C/H3.1P/H3.2A state that
-- ADMIN-D protects is installed before ADMIN-D captures its immutable receipt.
\ir hotels-v2-admin-c-pricing-control-postgrest-base.sql
\ir hotels-v2-admin-d-protected-history-fixture.sql

alter table public.hotel_bookings
  add column if not exists num_adults integer default 1,
  add column if not exists num_children integer default 0;
update public.profiles set is_admin=true
where id='10000000-0000-4000-8000-000000000008';

-- Generic legacy Partner workspace fixture used by the H3.2B/Task2 chain.
update public.hotels set architecture_version='legacy'
where id='c1000000-0000-4000-8000-000000000001';
update public.hotel_room_types set inventory_mode='unitized',base_inventory_count=0
where id='c1100000-0000-4000-8000-000000000001';
insert into public.hotel_units(id,room_type_id,code,name_i18n,status)
values('c1600000-0000-4000-8000-000000000001',
  'c1100000-0000-4000-8000-000000000001','studio-1',
  '{"pl":"Studio 1","en":"Studio 1","he":"סטודיו 1"}'::jsonb,'active');
begin;
insert into public.hotel_rate_plans(id,hotel_id,code,name_i18n,description_i18n,
  cancellation_policy,is_active,review_status,sort_order)
values('c1200000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001',
  'standard','{"pl":"Standard","en":"Standard","he":"סטנדרט"}',
  '{"pl":"Elastyczna stawka","en":"Flexible rate","he":"תעריף גמיש"}',
  '{"type":"flexible"}',true,'reviewed',10);
insert into public.hotel_room_rates(id,hotel_id,room_type_id,rate_plan_id,base_nightly_rate,
  currency,is_active,review_status,sort_order)
values('c1300000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001',
  'c1100000-0000-4000-8000-000000000001','c1200000-0000-4000-8000-000000000001',80,'EUR',true,'reviewed',10);
insert into public.hotel_rate_rules(id,room_rate_id,valid_from,valid_to,weekdays,nightly_rate,
  priority,is_active)
values('c1700000-0000-4000-8000-000000000001','c1300000-0000-4000-8000-000000000001',
  current_date+30,current_date+45,array[1,2,3,4,5,6,7]::smallint[],90,10,true);
insert into public.hotel_calendar_overrides(id,hotel_id,room_rate_id,stay_date,nightly_rate,
  nightly_rate_mode,reason,actor_id,actor_type,source,is_active,provenance,
  pricing_source,pricing_reason,pricing_actor_type,pricing_actor_id,pricing_updated_at,pricing_correlation_id)
values('c1800000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001',
  'c1300000-0000-4000-8000-000000000001',current_date+32,88,'set',
  'ADMIN-C pricing-only fixture','10000000-0000-4000-8000-000000000001','admin','legacy_preview',true,
  '{"fixture":"admin_c_price_only"}','manual','ADMIN-C pricing-only fixture','admin',
  '10000000-0000-4000-8000-000000000001',clock_timestamp(),
  'c1900000-0000-4000-8000-000000000001');
insert into public.hotel_room_allocation_rules(id,hotel_id,code,allocation_mode,min_guest_count,
  max_guest_count,is_active,review_status,sort_order)
values('c1400000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001',
  'choice-1-3','customer_choice',1,3,true,'reviewed',10);
insert into public.hotel_room_allocation_rule_items(id,hotel_id,allocation_rule_id,room_type_id,
  units_required,allocated_guest_count,pricing_guest_count,allocated_guest_counts,pricing_guest_counts,sort_order)
values('c1500000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001',
  'c1400000-0000-4000-8000-000000000001','c1100000-0000-4000-8000-000000000001',1,null,null,null,null,10);
commit;

insert into public.partner_resources(id,partner_id,resource_type,resource_id)
values('32000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000001',
  'hotels','c1000000-0000-4000-8000-000000000001');
insert into public.hotel_partner_hotel_permissions(
  assignment_id,partner_id,hotel_id,edit_property_content,edit_property_photos,
  edit_room_content,edit_room_photos,create_rooms,edit_room_structure,
  manage_prices,manage_availability,process_bookings,view_payment_status,created_by,updated_by)
values('32000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',true,true,true,true,true,true,true,true,true,true,
  '10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001');

-- Accepted commercial prerequisites are captured by ADMIN-D before Task3.
insert into public.hotel_commission_policies(
  id,hotel_id,code,commission_mode,amount,currency,is_active,review_status)
values('38000000-0000-4000-8000-000000000001','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
  'partner-fixed-room-night','per_allocated_room_per_night',10,'EUR',true,'reviewed');
insert into public.hotel_commission_policies(
  id,hotel_id,code,commission_mode,amount,currency,is_active,review_status)
select '38000000-0000-4000-8000-000000000002',hotel.id,'partner-percent-total',
  'percent_booking_total',12.5,hotel.currency,true,'reviewed'
from public.hotels hotel where hotel.id='c1000000-0000-4000-8000-000000000001';
begin;
insert into public.hotel_payment_policies(
  id,hotel_id,code,name_i18n,currency,is_active,review_status)
values('38600000-0000-4000-8000-000000000001','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
  'seven-kamares-request-confirmation','{"en":"7 Arches request confirmation"}',
  'EUR',true,'reviewed');
insert into public.hotel_payment_policy_terms(
  id,hotel_id,payment_policy_id,sequence,due_event,amount_mode,amount_value,
  recipient,payment_methods,instructions_i18n)
values
  ('38600000-0000-4000-8000-000000000002','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
   '38600000-0000-4000-8000-000000000001',1,'after_partner_acceptance','percent_total',50,
   'partner',array['bank_transfer'],'{}'),
  ('38600000-0000-4000-8000-000000000003','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
   '38600000-0000-4000-8000-000000000001',2,'on_arrival','remaining_balance',null,
   'partner',array['card','cash'],'{}');
commit;

\ir ../../supabase/migrations/20260811360000_hotels_v2_admin_d_availability_inventory_control.sql

create schema if not exists storage;
create table if not exists storage.buckets(
  id text primary key,name text,public boolean not null default true,
  file_size_limit bigint,allowed_mime_types text[]
);
create table if not exists storage.objects(
  id uuid primary key default gen_random_uuid(),bucket_id text not null,name text not null,
  owner_id text,metadata jsonb not null default '{}'::jsonb,created_at timestamptz default now(),
  unique(bucket_id,name)
);
alter table storage.objects enable row level security;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('poi-photos','poi-photos',true,10485760,array['image/webp']) on conflict(id) do nothing;

\ir ../../supabase/migrations/20260811380000_hotels_v2_h3_2b_partner_hotel_workspace.sql
create extension if not exists supabase_vault;
create extension if not exists pg_net;
\ir ../../supabase/migrations/20260811390000_hotels_v2_external_calendar_sync_foundation.sql
\ir ../../supabase/migrations/20260811400000_hotels_v2_external_calendar_worker_runtime.sql
\ir ../../supabase/migrations/20260811410000_hotels_v2_external_calendar_availability_projection.sql
\ir ../../supabase/migrations/20260811420000_hotels_v2_external_calendar_reviewed_control.sql
\ir ../../supabase/migrations/20260811430000_hotels_v2_external_calendar_scheduler.sql
\ir ../../supabase/migrations/20260811435000_hotels_v2_external_calendar_activation_compatibility.sql
\if :{?provider_install_external_enabled}
\if :provider_install_external_enabled
-- Task4 production-style fixture: Stage2F is already active before any new
-- forward Task1-4 migration is installed. The immutable 114350 receipt is
-- preserved. Materialize only the local Vault and pg_cron evidence that the
-- guarded manual activation would already have created in production; do not
-- execute the Stage2F activation manual itself in this replay fixture.
select vault.create_secret(
  'https://daoohnbnnowmmcizgvrq.functions.supabase.co/hotels-v2-external-calendar-sync',
  'hotels-v2-external-calendar-worker-url',
  'Task4 local production-style worker URL',null)
where not exists(select 1 from vault.decrypted_secrets
  where name='hotels-v2-external-calendar-worker-url');
select vault.create_secret(
  'task4-local-only-shared-secret-0123456789abcdef',
  'hotels-v2-external-calendar-worker-shared-secret',
  'Task4 local production-style scoped worker secret',null)
where not exists(select 1 from vault.decrypted_secrets
  where name='hotels-v2-external-calendar-worker-shared-secret');
create schema if not exists cron;
create table if not exists cron.job(
  jobid bigint generated always as identity primary key,
  jobname text not null unique,
  schedule text not null,
  command text not null,
  active boolean not null default true
);
insert into cron.job(jobname,schedule,command,active)
values('hotels-v2-external-calendar-15m','*/15 * * * *',
  'select public.hotel_v2_external_calendar_scheduler_dispatch()',true)
on conflict(jobname) do update set schedule=excluded.schedule,
  command=excluded.command,active=excluded.active;
update public.site_settings set hotel_external_sync_enabled=true where id=1;
\endif
\endif
\ir ../../supabase/migrations/20260811436000_hotels_v2_seven_arches_owner_operational_capabilities.sql
\ir ../../supabase/migrations/20260811437000_hotels_v2_seven_arches_partner_property_proposal_review.sql
notify pgrst,'reload schema';
