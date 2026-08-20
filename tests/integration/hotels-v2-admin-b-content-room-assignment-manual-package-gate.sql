\set ON_ERROR_STOP on

-- Disposable-only proof that the SQL-Editor sequence executes in order.
-- Production defaults stay hard-coded in the manual files; this fixture sets
-- their documented session override keys to its own synthetic row fingerprints.
\ir hotels-v2-admin-a-room-gallery-post-promotion-postgrest-base.sql
\ir hotels-v2-admin-b-production-assignment-trigger-fixture.sql

select set_config('hotels_v2.admin_b_expected_property_gallery_fingerprint',
  (select md5(photos::text) from public.hotels
    where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'),false);
select set_config('hotels_v2.admin_b_expected_owner_partner_id',
  (select owner_partner_id::text from public.hotels
    where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'),false);
select set_config('hotels_v2.admin_b_expected_upper_version',
  (select version::text from public.hotel_room_types
    where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'),false);
select set_config('hotels_v2.admin_b_expected_upper_gallery_count',
  (select jsonb_array_length(gallery)::text from public.hotel_room_types
    where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'),false);
select set_config('hotels_v2.admin_b_expected_upper_gallery_fingerprint',
  (select md5(gallery::text) from public.hotel_room_types
    where id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94'),false);
select set_config('hotels_v2.admin_b_expected_ground_version',
  (select version::text from public.hotel_room_types
    where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3'),false);
select set_config('hotels_v2.admin_b_expected_ground_gallery_count',
  (select jsonb_array_length(gallery)::text from public.hotel_room_types
    where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3'),false);
select set_config('hotels_v2.admin_b_expected_ground_gallery_fingerprint',
  (select md5(gallery::text) from public.hotel_room_types
    where id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3'),false);
select set_config('hotels_v2.admin_b_expected_booking_count',
  (select count(*)::text from public.hotel_bookings),false);
select set_config('hotels_v2.admin_b_expected_booking_fingerprint',
  (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|'
    order by row_value.id),'')) from public.hotel_bookings row_value),false);
select set_config('hotels_v2.admin_b_expected_fulfillment_count',
  (select count(*)::text from public.partner_service_fulfillments
    where resource_type='hotels'),false);
select set_config('hotels_v2.admin_b_expected_fulfillment_fingerprint',
  (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|'
    order by row_value.id),'')) from public.partner_service_fulfillments row_value
    where resource_type='hotels'),false);
select set_config('hotels_v2.admin_b_expected_deposit_fingerprint',
  (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|'
    order by row_value.id),'')) from public.service_deposit_requests row_value
    where resource_type='hotels'),false);
select set_config('hotels_v2.admin_b_expected_coupon_fingerprint',
  (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|'
    order by row_value.id),'')) from public.service_coupon_redemptions row_value
    where service_type='hotels'),false);
select set_config('hotels_v2.admin_b_expected_h3_1p_target_fingerprint',
  (public.hotel_v2_h3_1p_pricing_promotion_snapshot(
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca')#>>'{target,target_fingerprint}'),false);

create temporary table admin_b_manual_protected_before(
  relation_name text primary key,
  fingerprint text not null
) on commit preserve rows;

do $capture$
declare v_relation text;
begin
  foreach v_relation in array array[
    'hotel_bookings','partner_service_fulfillments',
    'partner_service_fulfillment_form_snapshots','service_deposit_requests',
    'service_deposit_rules','service_deposit_overrides','service_coupons',
    'service_coupon_redemptions','hotel_units','hotel_rate_plans',
    'hotel_room_rates','hotel_rate_rules','hotel_daily_inventory',
    'hotel_daily_rates','hotel_room_rate_occupancy_tiers',
    'hotel_calendar_overrides','hotel_pricing_schedules',
    'hotel_pricing_schedule_occupancy_tiers','hotel_room_allocation_rules',
    'hotel_room_allocation_rule_items','hotel_payment_policies',
    'hotel_payment_policy_terms','hotel_commission_policies',
    'hotel_calendar_source_configs','hotel_pricing_promotion_reviews',
    'hotel_partner_hotel_permissions','hotel_partner_action_receipts',
    'hotel_partner_event_outbox','hotel_activity_log','hotels',
    'partners','partner_users','partner_resources','partner_user_resources','referrals',
    'affiliate_commission_events','affiliate_payouts','affiliate_adjustments',
    'affiliate_program_settings','affiliate_referrer_overrides',
    'affiliate_cashout_requests','profile_referral_code_aliases','site_settings'
  ] loop
    if to_regclass('public.'||v_relation) is not null then
      execute format(
        'insert into admin_b_manual_protected_before select %L,md5(coalesce('
        ||'string_agg(to_jsonb(row_value)::text,''|'' order by '
        ||'to_jsonb(row_value)::text),'''')) from public.%I row_value',
        v_relation,v_relation
      );
    end if;
  end loop;
  insert into admin_b_manual_protected_before
  select 'hotel_room_types_without_floor',md5(coalesce(string_agg(
    (to_jsonb(row_value)-'floor_label_i18n')::text,'|' order by
    (to_jsonb(row_value)-'floor_label_i18n')::text),''))
  from public.hotel_room_types row_value;
end
$capture$;

\ir ../../supabase/manual/hotels_v2_admin_b_content_room_assignment_preflight.sql
\ir ../../supabase/migrations/20260811340000_hotels_v2_admin_b_content_room_assignment_control.sql
\ir ../../supabase/manual/hotels_v2_admin_b_content_room_assignment_verify.sql

do $compare$
declare v_row admin_b_manual_protected_before%rowtype; v_actual text;
begin
  for v_row in select * from admin_b_manual_protected_before order by relation_name loop
    if v_row.relation_name='hotel_room_types_without_floor' then
      select md5(coalesce(string_agg(
        (to_jsonb(row_value)-'floor_label_i18n')::text,'|' order by
        (to_jsonb(row_value)-'floor_label_i18n')::text),''))
      into v_actual from public.hotel_room_types row_value;
    else
      execute format('select md5(coalesce(string_agg(to_jsonb(row_value)::text,'
        ||'''|'' order by to_jsonb(row_value)::text),'''')) from public.%I row_value',
        v_row.relation_name) into v_actual;
    end if;
    if v_actual is distinct from v_row.fingerprint then
      raise exception 'admin_b_manual_package_protected_drift: %',v_row.relation_name;
    end if;
  end loop;
end
$compare$;

select true as hotels_v2_admin_b_manual_package_sequence_safe;
