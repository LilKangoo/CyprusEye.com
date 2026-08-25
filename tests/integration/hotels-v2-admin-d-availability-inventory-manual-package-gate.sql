\set ON_ERROR_STOP on
\ir hotels-v2-admin-c-pricing-control-postgrest-base.sql
\ir hotels-v2-admin-d-pgcrypto-production-shim.sql
\ir hotels-v2-admin-d-protected-history-fixture.sql
alter table public.hotel_bookings add column if not exists num_adults integer default 1,
  add column if not exists num_children integer default 0;

-- The production preflight intentionally pins the production graph's physical
-- target fingerprint. This disposable graph has locally generated tier UUIDs
-- and timestamps, so execute the unmodified preflight and require its exact
-- production-target rejection while proving every semantic/receipt condition
-- in that composite check still passes.
\set ON_ERROR_STOP off
\ir ../../supabase/manual/hotels_v2_admin_d_availability_inventory_preflight.sql
\set ON_ERROR_STOP on

create temporary table admin_d_manual_preflight_result(
  sqlstate text not null,
  message text not null
) on commit preserve rows;
insert into admin_d_manual_preflight_result values(
  :'LAST_ERROR_SQLSTATE', :'LAST_ERROR_MESSAGE'
);

do $admin_d_disposable_preflight_contract$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_production_target constant text:='baeaae09e1775f28f39695696084f5a1';
  v_error admin_d_manual_preflight_result%rowtype;
  v_snapshot jsonb;
begin
  select * into strict v_error from admin_d_manual_preflight_result;
  v_snapshot:=public.hotel_v2_h3_1p_pricing_promotion_snapshot(c_hotel);

  if v_error.sqlstate<>'P0001'
     or v_error.message<>'HOTELS_V2_ADMIN_D_PREFLIGHT_FAIL accepted H3.1P 70/0 contract drift'
     or v_snapshot#>>'{target,target_fingerprint}' is null
     or v_snapshot#>>'{target,target_fingerprint}'=c_production_target
     or not public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()
     or not coalesce((v_snapshot->>'supported')::boolean,false)
     or v_snapshot#>>'{promotion,status}'<>'reviewed'
     or v_snapshot#>>'{source,pricing_fingerprint}'<>'7208ab4ecc0e47abd64d87ca1ac53a03'
     or v_snapshot->>'pricing_occupancy_mapping_fingerprint'<>'6f6e6c64f0b0d0aa60e3575d4fd4ac1c'
     or v_snapshot#>>'{parity,fingerprint}'<>'b3c915266ab060efaba522cf5587fb75'
     or (v_snapshot#>>'{parity,total_case_count}')::integer<>70
     or (v_snapshot#>>'{parity,total_mismatch_count}')::integer<>0
     or (v_snapshot#>>'{target,room_schedule,tier_count}')::integer<>27
     or (v_snapshot#>>'{source,property_party_preview,tier_count}')::integer<>63
     or (select count(*) from public.hotel_pricing_promotion_reviews review
       where review.hotel_id=c_hotel
         and review.contract_version='seven_kamares_legacy_to_h3_pricing_v1'
         and review.review_status='reviewed'
         and review.acknowledged_pricing_occupancy_mapping
         and review.source_fingerprint=v_snapshot#>>'{source,pricing_fingerprint}'
         and review.target_fingerprint=v_snapshot#>>'{target,target_fingerprint}'
         and review.pricing_occupancy_mapping_fingerprint=
           v_snapshot->>'pricing_occupancy_mapping_fingerprint'
         and review.parity_fingerprint=v_snapshot#>>'{parity,fingerprint}'
         and review.parity_case_count=(v_snapshot#>>'{parity,total_case_count}')::integer
         and review.parity_mismatch_count=(v_snapshot#>>'{parity,total_mismatch_count}')::integer
         and review.result->>'target_fingerprint'=review.target_fingerprint)<>1
     or exists(select 1 from public.hotel_rate_plans where hotel_id=c_hotel and is_active)
     or exists(select 1 from public.hotel_room_rates where hotel_id=c_hotel and is_active)
     or exists(select 1 from public.hotel_pricing_schedules where hotel_id=c_hotel and is_active) then
    raise exception 'admin_d_manual_fixture_preflight_contract_mismatch';
  end if;
end
$admin_d_disposable_preflight_contract$;

\ir ../../supabase/migrations/20260811360000_hotels_v2_admin_d_availability_inventory_control.sql
\ir ../../supabase/manual/hotels_v2_admin_d_availability_inventory_verify.sql
\ir ../../supabase/manual/hotels_v2_admin_d_availability_inventory_post_admin_verify.sql
do $admin_d_manual_gate$
begin
  if not exists(select 1 from public.hotel_admin_availability_foundation_receipts receipt
      where receipt.id=1 and receipt.protected_fingerprints=public.hotel_v2_admin_d_protected_fingerprints()
        and receipt.protected_fingerprint=encode(extensions.digest(convert_to(receipt.protected_fingerprints::text,'UTF8'),'sha256'),'hex'))
     or (public.hotel_v2_h3_1p_pricing_promotion_snapshot('9b6d99a0-923a-4fbc-be54-c066e856e6ca')#>>'{parity,total_case_count}')::integer<>70
     or (public.hotel_v2_h3_1p_pricing_promotion_snapshot('9b6d99a0-923a-4fbc-be54-c066e856e6ca')#>>'{parity,total_mismatch_count}')::integer<>0
     or (select count(*) from public.site_settings)<>1
     or not exists(select 1 from public.site_settings where id=1 and not hotel_rooms_v2_enabled
       and not hotel_external_sync_enabled and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled)
     or exists(select 1 from public.hotel_pricing_schedules
       where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' and is_active)
     or exists(select 1 from unnest(array['hotel_unit_calendar_blocks','hotel_inventory_day_locks',
       'hotel_inventory_holds','hotel_booking_room_allocations','hotel_inventory_commitments',
       'hotel_admin_availability_action_receipts','hotel_admin_availability_plan_reviews',
       'hotel_admin_availability_foundation_receipts']) relation_name(name)
       cross join unnest(array['anon','authenticated','service_role']) role_name(name)
       cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege_name(name)
       where has_table_privilege(role_name.name,'public.'||relation_name.name,privilege_name.name))
     or exists(select 1 from (values
       ('public.hotel_v2_admin_get_availability_control(uuid,date,date)'),
       ('public.hotel_v2_admin_preview_availability_plan(jsonb)'),
       ('public.hotel_v2_admin_apply_availability_control_plan(jsonb,uuid,text)'),
       ('public.hotel_v2_admin_preview_stay(jsonb)')) expected(signature)
       left join pg_proc p on p.oid=to_regprocedure(expected.signature)
       where p.oid is null or p.proowner<>(select oid from pg_roles where rolname='postgres')
         or not p.prosecdef or p.proconfig is distinct from array['search_path=pg_catalog, public, auth']::text[]
         or has_function_privilege(0::oid,p.oid,'EXECUTE') or has_function_privilege('anon',p.oid,'EXECUTE')
         or has_function_privilege('service_role',p.oid,'EXECUTE')
         or not has_function_privilege('authenticated',p.oid,'EXECUTE'))
     or exists(select 1 from public.hotel_activity_log activity
       where activity.source='hotels_v2_admin_d_availability_control' and not exists(
         select 1 from public.hotel_admin_availability_action_receipts receipt,
           lateral jsonb_array_elements(receipt.result->'activity') item(value)
         where receipt.correlation_id=activity.correlation_id and item.value->>'id'=activity.id::text)) then
    raise exception 'HOTELS_V2_ADMIN_D_MANUAL_PACKAGE_GATE_FAIL';
  end if;
end
$admin_d_manual_gate$;
select true as hotels_v2_admin_d_availability_inventory_manual_package_sequence_safe;
