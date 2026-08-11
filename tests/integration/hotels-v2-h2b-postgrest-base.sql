\set ON_ERROR_STOP on

-- Disposable local-only PostgREST fixture. Reuse the production-shaped H2A
-- partner/property contract, then apply H2B exactly once. No production data or
-- endpoint is read or written by this gate.
\ir hotels-v2-h2a-rpc-hotfix-postgrest-base.sql
\ir ../../supabase/migrations/20260811230000_hotels_v2_h2b_calendar_rates_foundation.sql

-- One inert shadow Room Type x Rate Plan product for the legacy 7 Arches ID.
-- architecture_version remains legacy and every Hotels V2 capability flag
-- remains disabled.
insert into public.hotel_room_types(
  id,hotel_id,code,name_i18n,description_i18n,capacity_adults,
  capacity_children,inventory_mode,base_inventory_count,status
) values (
  '61000000-0000-4000-8000-000000000001',
  '9b6d99a0-923a-4fbc-be54-c066e856e6ca',
  'postgrest-shadow-room',jsonb_build_object('en','PostgREST Shadow Room'),
  '{}'::jsonb,2,0,'pooled',3,'active'
);

insert into public.hotel_rate_plans(
  id,hotel_id,code,name_i18n,description_i18n,cancellation_policy,is_active
) values (
  '62000000-0000-4000-8000-000000000001',
  '9b6d99a0-923a-4fbc-be54-c066e856e6ca',
  'postgrest-standard',jsonb_build_object('en','PostgREST Standard'),
  '{}'::jsonb,jsonb_build_object('type','flexible'),true
);

insert into public.hotel_room_rates(
  id,hotel_id,room_type_id,rate_plan_id,base_nightly_rate,currency,is_active
) values (
  '63000000-0000-4000-8000-000000000001',
  '9b6d99a0-923a-4fbc-be54-c066e856e6ca',
  '61000000-0000-4000-8000-000000000001',
  '62000000-0000-4000-8000-000000000001',
  100,'EUR',true
);

notify pgrst, 'reload schema';
