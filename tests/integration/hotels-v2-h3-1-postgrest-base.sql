\set ON_ERROR_STOP on

-- Disposable local-only production-shaped H3.1 fixture. This composes the
-- established H2A/H2B/H2B.1 chain, its H2B.2 policy-preservation repair, and
-- the inert H3.1 migration. It never connects to or copies production rows.
\ir hotels-v2-h2b1-postgrest-base.sql
\ir ../../supabase/migrations/20260811280000_hotels_v2_h2b2_shadow_property_policy_preservation.sql
\ir ../../supabase/migrations/20260811290000_hotels_v2_h3_1_inert_admin_configuration.sql

update public.hotels
set children_policy='minimum_age',minimum_child_age=15
where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca';

insert into public.hotel_room_types(
  id,hotel_id,code,name_i18n,description_i18n,gallery,
  capacity_adults,capacity_children,max_occupancy,amenities,
  inventory_mode,base_inventory_count,status,sort_order,legacy_source_key
) values
  (
    'b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca',
    'upper-floor-apartment','{"en":"Upper Floor Apartment"}'::jsonb,'{}'::jsonb,'[]'::jsonb,
    null,null,4,array['air_conditioning','balcony','terrace']::text[],
    'pooled',1,'active',100,'upper_floor_apartment'
  ),
  (
    '825c01b7-9f82-492a-9c81-9b1d5cd7acd3',
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca',
    'ground-floor-apartment','{"en":"Ground Floor Apartment"}'::jsonb,'{}'::jsonb,'[]'::jsonb,
    null,null,4,array['air_conditioning','terrace']::text[],
    'pooled',1,'active',200,'ground_floor_apartment'
  );

insert into public.hotel_pricing_schedules(
  id,hotel_id,code,name_i18n,application_scope,currency,
  maximum_party_size,is_active,review_status,source,source_reference
) values (
  'b0a3104f-7b31-5265-a59f-c2d166f11a23',
  '9b6d99a0-923a-4fbc-be54-c066e856e6ca',
  'seven-arches-room-occupancy','{"en":"7 Arches room occupancy"}'::jsonb,
  'room_occupancy','EUR',4,false,'requires_review','legacy_preview','{}'::jsonb
);

insert into public.hotel_rate_plans(
  id,hotel_id,code,name_i18n,description_i18n,cancellation_policy,is_active,sort_order
) values (
  '22e47a63-a630-4fb6-8f43-816f2d3fdc17',
  '9b6d99a0-923a-4fbc-be54-c066e856e6ca',
  'standard','{"en":"Standard"}'::jsonb,'{}'::jsonb,
  '{"type":"non_refundable"}'::jsonb,false,100
);

notify pgrst, 'reload schema';
