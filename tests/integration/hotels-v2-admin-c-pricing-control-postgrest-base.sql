\set ON_ERROR_STOP on

-- Disposable production-shaped ADMIN-C fixture. ADMIN-A/B are loaded from
-- their frozen integration base; the extra rooms_v2 Hotel is deliberately
-- pricing-empty before ADMIN-C so generic CRUD/lifecycle can be tested without
-- touching the accepted 7 Kamares graph.
\ir hotels-v2-admin-b-content-room-assignment-postgrest-base.sql

insert into public.hotels(
  id,slug,title,title_i18n,description,description_i18n,city,country,
  amenities,room_types,photos,pricing_model,pricing_tiers,max_persons,
  booking_settings,pricing_extras,owner_partner_id,submission_status,
  is_published,status,sort_order,architecture_version,timezone,currency,
  booking_mode,check_in_from,check_out_until,children_policy,
  minimum_child_age,minimum_stay_nights
) values(
  'c1000000-0000-4000-8000-000000000001','admin-c-future-one-room',
  '{"pl":"Przyszły hotel","en":"Future Hotel","he":"מלון עתידי"}',
  '{"pl":"Przyszły hotel","en":"Future Hotel","he":"מלון עתידי"}',
  '{"pl":"Prywatny szkic","en":"Private draft","he":"טיוטה פרטית"}',
  '{"pl":"Prywatny szkic","en":"Private draft","he":"טיוטה פרטית"}',
  'Nicosia','Cyprus','[]','[]','[]','flat_per_night',
  '{"rules":[],"currency":"EUR"}',3,'{}',
  '{"items":[],"currency":"EUR"}',
  '20000000-0000-4000-8000-000000000001','draft',false,'draft',900,
  'rooms_v2','Europe/Nicosia','EUR','request_confirmation','14:00','11:00',
  'minimum_age',12,1
);

insert into public.hotel_property_operational_profiles(
  hotel_id,maximum_stay_nights,guest_instructions_i18n,
  check_in_instructions_i18n,check_out_instructions_i18n
) values(
  'c1000000-0000-4000-8000-000000000001',30,'{}','{}','{}'
);

insert into public.hotel_room_types(
  id,hotel_id,code,name_i18n,description_i18n,gallery,
  capacity_adults,capacity_children,max_occupancy,bed_configuration,
  bathrooms,size_sqm,amenities,inventory_mode,base_inventory_count,
  status,sort_order,children_policy_override,minimum_child_age_override,
  floor_label_i18n
) values(
  'c1100000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001','studio',
  '{"pl":"Studio","en":"Studio","he":"סטודיו"}',
  '{"pl":"Jednopokojowe studio","en":"One-room studio","he":"סטודיו חדר אחד"}',
  '[]',2,1,null,'[]',1,32,'{}','pooled',1,'active',10,null,null,'{}'
);

-- One genuine pre-ADMIN-C exact-price row proves the additive legacy branch:
-- row-wide H2B active/expiry/provenance remain truthful and read-only, while
-- new ADMIN-C writes use the separate pricing_* provenance tuple.
insert into public.hotel_calendar_overrides(
  id,hotel_id,room_rate_id,stay_date,nightly_rate,nightly_rate_mode,
  minimum_stay,minimum_stay_mode,maximum_stay,maximum_stay_mode,
  reason,expires_at,actor_id,actor_type,source,source_timestamp,is_active,provenance
) values(
  'c2800000-0000-4000-8000-000000000901',
  '9b6d99a0-923a-4fbc-be54-c066e856e6ca',
  '7e420964-9cbf-4f1b-abd3-09840af5240f','2098-01-15',777,'set',
  null,null,null,null,'Pre-ADMIN-C legacy exact-price fixture',
  '2099-01-01T00:00:00Z','10000000-0000-4000-8000-000000000001',
  'admin','legacy_preview','2026-08-01T00:00:00Z',true,
  '{"fixture":"pre_admin_c_legacy_exact_price"}'::jsonb
);

\ir ../../supabase/migrations/20260811350000_hotels_v2_admin_c_pricing_control.sql

-- Durable-replay fixture: this models an exact request that was accepted while
-- its Review was fresh, then retried much later. The public RPC must return the
-- immutable receipt before applying the new-request freshness gate.
do $admin_c_old_replay$
declare
  v_control jsonb;
  v_plan jsonb;
  v_correlation constant uuid:='c2ff0000-0000-4000-8000-000000000001';
  v_key constant text:='admin-c-durable-old-replay-001';
  v_hash text;
  v_result jsonb;
begin
  v_control:=public.hotel_v2_admin_c_pricing_control_snapshot(
    'c1000000-0000-4000-8000-000000000001');
  v_plan:=jsonb_build_object(
    'contract_version','hotels_v2_admin_c_pricing_plan_v1',
    'hotel_id','c1000000-0000-4000-8000-000000000001',
    'snapshot_token',v_control->>'snapshot_token',
    'reviewed_at','2000-01-01T00:00:00.000000Z',
    'operations',jsonb_build_array(jsonb_build_object(
      'entity','property_pricing_default','action','create',
      'id','c1ff0000-0000-4000-8000-000000000001','expected_version',0,
      'expected_children_fingerprint',null,'expected_link_fingerprint',null,
      'expected_linked_room_rate_ids','[]'::jsonb,
      'shared_impact_acknowledged',false,'activation_acknowledged',false,
      'expected_original','{}'::jsonb,
      'payload',jsonb_build_object(
        'hotel_id','c1000000-0000-4000-8000-000000000001',
        'nightly_rate',99,'currency','EUR','lifecycle_status','draft'))));
  v_hash:=encode(digest(convert_to(jsonb_build_object(
    'plan',v_plan,'correlation_id',v_correlation)::text,'UTF8'),'sha256'),'hex');
  v_result:=jsonb_build_object(
    'contract_version','hotels_v2_admin_c_pricing_plan_v1',
    'hotel_id','c1000000-0000-4000-8000-000000000001',
    'correlation_id',v_correlation,'idempotency_key',v_key,
    'replayed',false,'changed',false,'activity','[]'::jsonb,
    'pricing_control',v_control);
  insert into public.hotel_admin_pricing_action_receipts(
    hotel_id,actor_id,idempotency_key,correlation_id,request_hash,result,created_at)
  values('c1000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',v_key,v_correlation,v_hash,v_result,
    clock_timestamp()-interval '1 day');
end
$admin_c_old_replay$;

notify pgrst, 'reload schema';
