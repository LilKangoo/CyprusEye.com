\set ON_ERROR_STOP on

-- Disposable-only proof of the documented SQL Editor order. Production
-- defaults remain frozen in the three manual files; this compact fixture
-- binds their documented session override keys to its synthetic rows.
\ir hotels-v2-admin-b-content-room-assignment-postgrest-base.sql

select set_config('hotels_v2.admin_c_expected_owner_partner_id',
  (select owner_partner_id::text from public.hotels
    where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'),false);
select set_config('hotels_v2.admin_c_expected_booking_count',
  (select count(*)::text from public.hotel_bookings),false);
select set_config('hotels_v2.admin_c_expected_booking_fingerprint',
  (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|'
    order by row_value.id),'')) from public.hotel_bookings row_value),false);
select set_config('hotels_v2.admin_c_expected_fulfillment_count',
  (select count(*)::text from public.partner_service_fulfillments
    where resource_type='hotels'),false);
select set_config('hotels_v2.admin_c_expected_fulfillment_fingerprint',
  (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|'
    order by row_value.id),'')) from public.partner_service_fulfillments row_value
    where resource_type='hotels'),false);
select set_config('hotels_v2.admin_c_expected_deposit_fingerprint',
  (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|'
    order by row_value.id),'')) from public.service_deposit_requests row_value
    where resource_type='hotels'),false);
select set_config('hotels_v2.admin_c_expected_coupon_fingerprint',
  (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|'
    order by row_value.id),'')) from public.service_coupon_redemptions row_value
    where service_type='hotels'),false);
select set_config('hotels_v2.admin_c_expected_h3_1p_target_fingerprint',
  (public.hotel_v2_h3_1p_pricing_promotion_snapshot(
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca')#>>'{target,target_fingerprint}'),false);

create temporary table admin_c_manual_relation_specs(
  relation_name text primary key,
  excluded_columns text[] not null
) on commit preserve rows;

insert into admin_c_manual_relation_specs values
  ('hotels','{}'),('hotel_room_types','{}'),('hotel_units','{}'),
  ('hotel_rate_plans',array['review_status']),
  ('hotel_room_rates',array['review_status']),
  ('hotel_pricing_schedules',array['sharing_mode']),
  ('hotel_pricing_schedule_occupancy_tiers','{}'),
  ('hotel_room_rate_occupancy_tiers','{}'),('hotel_rate_rules','{}'),
  ('hotel_daily_rates','{}'),('hotel_daily_inventory','{}'),
  ('hotel_calendar_overrides',array['pricing_source','pricing_reason',
    'pricing_expires_at','pricing_actor_type','pricing_actor_id',
    'pricing_updated_at','pricing_correlation_id']),
  ('hotel_room_allocation_rules','{}'),
  ('hotel_room_allocation_rule_items',array[
    'allocated_guest_counts','pricing_guest_counts']),
  ('hotel_pricing_promotion_reviews','{}'),('hotel_bookings','{}'),
  ('partner_service_fulfillments','{}'),
  ('partner_service_fulfillment_form_snapshots','{}'),
  ('service_deposit_requests','{}'),('service_deposit_rules','{}'),
  ('service_deposit_overrides','{}'),('service_coupons','{}'),
  ('service_coupon_redemptions','{}'),('referrals','{}'),
  ('affiliate_commission_events','{}'),('affiliate_payouts','{}'),
  ('affiliate_adjustments','{}'),('affiliate_program_settings','{}'),
  ('affiliate_referrer_overrides','{}'),('affiliate_cashout_requests','{}'),
  ('profile_referral_code_aliases','{}'),('site_settings','{}'),
  ('partners','{}'),('partner_users','{}'),('partner_resources','{}'),
  ('partner_user_resources','{}'),('hotel_property_operational_profiles','{}'),
  ('hotel_calendar_source_configs','{}'),('hotel_payment_policies','{}'),
  ('hotel_payment_policy_terms','{}'),('hotel_commission_policies','{}'),
  ('hotel_partner_hotel_permissions','{}'),
  ('hotel_partner_action_receipts','{}'),('hotel_partner_event_outbox','{}'),
  ('hotel_activity_log','{}');

create temporary table admin_c_manual_protected_before(
  relation_name text primary key,
  fingerprint text not null
) on commit preserve rows;

do $capture$
declare v_spec record; v_fingerprint text;
begin
  for v_spec in select * from admin_c_manual_relation_specs order by relation_name loop
    if to_regclass('public.'||v_spec.relation_name) is not null then
      execute format(
        'select md5(coalesce(string_agg((to_jsonb(row_value)-%L::text[])::text,'
        ||'''|'' order by (to_jsonb(row_value)-%L::text[])::text),'''')) '
        ||'from public.%I row_value',
        v_spec.excluded_columns,v_spec.excluded_columns,v_spec.relation_name)
      into v_fingerprint;
      insert into admin_c_manual_protected_before values(
        v_spec.relation_name,v_fingerprint);
    end if;
  end loop;
end
$capture$;

\ir ../../supabase/manual/hotels_v2_admin_c_pricing_control_preflight.sql
\ir ../../supabase/migrations/20260811350000_hotels_v2_admin_c_pricing_control.sql
\ir ../../supabase/manual/hotels_v2_admin_c_pricing_control_verify.sql

do $compare$
declare v_row admin_c_manual_protected_before%rowtype; v_excluded text[]; v_actual text;
begin
  for v_row in select * from admin_c_manual_protected_before order by relation_name loop
    select excluded_columns into v_excluded from admin_c_manual_relation_specs
      where relation_name=v_row.relation_name;
    execute format(
      'select md5(coalesce(string_agg((to_jsonb(row_value)-%L::text[])::text,'
      ||'''|'' order by (to_jsonb(row_value)-%L::text[])::text),'''')) '
      ||'from public.%I row_value',
      v_excluded,v_excluded,v_row.relation_name) into v_actual;
    if v_actual is distinct from v_row.fingerprint then
      raise exception 'admin_c_manual_package_protected_drift: %',v_row.relation_name;
    end if;
  end loop;
end
$compare$;

\ir ../../supabase/manual/hotels_v2_admin_c_pricing_control_post_admin_verify.sql

select jsonb_build_object(
  'pricing_schedule_occupancy_tiers',md5(coalesce((select string_agg(
    to_jsonb(row_value)::text,'|' order by row_value.id)
    from public.hotel_pricing_schedule_occupancy_tiers row_value),'')),
  'room_rate_occupancy_tiers',md5(coalesce((select string_agg(
    to_jsonb(row_value)::text,'|' order by row_value.id)
    from public.hotel_room_rate_occupancy_tiers row_value),'')),
  'allocation_rule_items',md5(coalesce((select string_agg(
    to_jsonb(row_value)::text,'|' order by row_value.id)
    from public.hotel_room_allocation_rule_items row_value),''))
) as reviewed_admin_authoritative_child_fingerprints;

select true as hotels_v2_admin_c_manual_package_sequence_safe;
