\set ON_ERROR_STOP on
-- ADMIN-C's accepted base transitively composes H3.2A, migration 130, ADMIN-A
-- and the ADMIN-B production assignment fixture. H3.2B configuration must be
-- present before ADMIN-D captures its immutable protected foundation.
\ir hotels-v2-admin-c-pricing-control-postgrest-base.sql
\ir hotels-v2-admin-d-protected-history-fixture.sql

alter table public.hotel_bookings
  add column if not exists num_adults integer default 1,
  add column if not exists num_children integer default 0;
update public.profiles set is_admin=true
where id='10000000-0000-4000-8000-000000000008';

-- The generic ADMIN-C Hotel becomes a legacy-authoritative Partner fixture;
-- its normalized graph remains private/shadow and supports reviewed edits.
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
insert into public.hotel_bookings(id,hotel_id,arrival_date,departure_date,status,total_price,num_adults,num_children)
values('c1a00000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001',
  current_date+33,current_date+35,'confirmed',160,1,0);

insert into public.partner_resources(id,partner_id,resource_type,resource_id)
values('32000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000001',
  'hotels','c1000000-0000-4000-8000-000000000001');

insert into public.hotel_partner_hotel_permissions(
  assignment_id,partner_id,hotel_id,edit_property_content,edit_property_photos,
  edit_room_content,edit_room_photos,create_rooms,edit_room_structure,
  manage_prices,manage_availability,process_bookings,view_payment_status,created_by,updated_by)
values('32000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
  '9b6d99a0-923a-4fbc-be54-c066e856e6ca',true,true,true,true,true,true,true,true,true,true,
  '10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001');
insert into public.hotel_partner_hotel_permissions(
  assignment_id,partner_id,hotel_id,edit_property_content,edit_property_photos,
  edit_room_content,edit_room_photos,create_rooms,edit_room_structure,
  manage_prices,manage_availability,process_bookings,view_payment_status,created_by,updated_by)
values('32000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',true,true,true,true,true,true,true,true,true,true,
  '10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001');

insert into public.hotel_commission_policies(
  id,hotel_id,code,commission_mode,amount,currency,is_active,review_status)
values('38000000-0000-4000-8000-000000000001','9b6d99a0-923a-4fbc-be54-c066e856e6ca',
  'partner-fixed-room-night','per_allocated_room_per_night',10,'EUR',true,'reviewed');
insert into public.hotel_commission_policies(
  id,hotel_id,code,commission_mode,amount,currency,is_active,review_status)
select '38000000-0000-4000-8000-000000000002',hotel.id,'partner-percent-total',
  'percent_booking_total',12.5,hotel.currency,true,'reviewed'
from public.hotels hotel where hotel.id='c1000000-0000-4000-8000-000000000001';

\ir ../../supabase/migrations/20260811360000_hotels_v2_admin_d_availability_inventory_control.sql

begin;
insert into public.hotel_inventory_holds(id,hotel_id,status,expires_at,configuration_fingerprint)
values('c1b00000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001',
  'active',clock_timestamp()+interval '2 hours',repeat('a',64));
insert into public.hotel_inventory_commitments(id,hotel_id,room_type_id,stay_date,hold_id,unit_id,units,status,expires_at)
select 'c1c00000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001',
  'c1100000-0000-4000-8000-000000000001',current_date+36,
  'c1b00000-0000-4000-8000-000000000001','c1600000-0000-4000-8000-000000000001',1,'active',expires_at
from public.hotel_inventory_holds where id='c1b00000-0000-4000-8000-000000000001';
commit;

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
notify pgrst,'reload schema';
