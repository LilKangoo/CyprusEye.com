\set ON_ERROR_STOP on
\ir hotels-v2-admin-c-pricing-control-postgrest-base.sql
\ir hotels-v2-admin-d-pgcrypto-production-shim.sql
\ir hotels-v2-admin-d-protected-history-fixture.sql

alter table public.hotel_bookings
  add column if not exists num_adults integer default 1,
  add column if not exists num_children integer default 0;
update public.profiles set is_admin=true
where id='10000000-0000-4000-8000-000000000008';

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
-- A genuine pre-ADMIN-D operational row proves that legacy active/expiry
-- semantics are grandfathered but frozen once D takes field ownership.
insert into public.hotel_calendar_overrides(id,hotel_id,room_rate_id,stay_date,closed,closed_mode,
  reason,actor_id,actor_type,source,is_active,provenance)
values('c1800000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000001',
  'c1300000-0000-4000-8000-000000000001',current_date+31,true,'set',
  'Pre-ADMIN-D operational fixture','10000000-0000-4000-8000-000000000001',
  'admin','legacy_preview',true,'{"fixture":"pre_admin_d_operational"}'::jsonb);
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
notify pgrst,'reload schema';
