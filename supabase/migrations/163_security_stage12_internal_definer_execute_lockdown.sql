begin;

-- Stage 12: remove direct API EXECUTE access from internal SECURITY DEFINER
-- functions. This migration intentionally targets trigger/maintenance functions
-- only; user-facing RPCs used by the app remain unchanged for separate review.

do $$
declare
  target_name text;
  target_function regprocedure;
begin
  foreach target_name in array array[
    'admin_notification_jobs_set_updated_at',
    'admin_push_subscriptions_set_updated_at',
    'affiliate_cashout_requests_set_updated_at',
    'affiliate_handle_service_deposit_paid',
    'apply_referral_code_from_auth_metadata',
    'blog_set_updated_at',
    'car_coupons_before_write',
    'cleanup_old_car_image',
    'partner_payout_details_set_updated_at',
    'partner_push_subscriptions_set_updated_at',
    'prevent_referred_by_change',
    'profiles_set_registration_completed_default',
    'service_coupons_before_write',
    'set_updated_at',
    'shop_update_product_review_stats',
    'shop_update_timestamp',
    'sync_car_booking_status_from_deposit_paid',
    'sync_recommendation_category_poi_link',
    'sync_recommendation_geography',
    'sync_referrals_from_profiles_assignment',
    'sync_referrals_from_profiles_insert',
    'touch_updated_at',
    'trg_apply_booking_referral_attribution',
    'trg_apply_service_coupon_hotel_booking',
    'trg_apply_service_coupon_transport_booking',
    'trg_apply_service_coupon_trip_booking',
    'trg_car_coupon_redemption_from_booking',
    'trg_enqueue_customer_received_car_booking',
    'trg_enqueue_customer_received_hotel_booking',
    'trg_enqueue_customer_received_shop_order',
    'trg_enqueue_customer_received_transport_booking',
    'trg_enqueue_customer_received_trip_booking',
    'trg_enqueue_partner_pending_service_fulfillment',
    'trg_enqueue_partner_pending_shop_fulfillment',
    'trg_kick_admin_notification_worker',
    'trg_notify_admin_new_car_booking',
    'trg_notify_admin_new_hotel_booking',
    'trg_notify_admin_new_transport_booking',
    'trg_notify_admin_new_trip_booking',
    'trg_notify_admin_partner_plus_application',
    'trg_notify_admin_shop_order_paid',
    'trg_partner_resources_backfill_service_fulfillments',
    'trg_partner_resources_backfill_transport_fulfillments',
    'trg_partner_service_fulfillment_from_car_booking',
    'trg_partner_service_fulfillment_from_hotel_booking',
    'trg_partner_service_fulfillment_from_transport_booking',
    'trg_partner_service_fulfillment_from_trip_booking',
    'trg_partner_service_fulfillments_expire_on_insert',
    'trg_partner_service_fulfillments_sync_status',
    'trg_poi_categories_set_updated_at',
    'trg_profiles_referral_code_defaults',
    'trg_service_coupon_redemption_from_hotel_booking',
    'trg_service_coupon_redemption_from_transport_booking',
    'trg_service_coupon_redemption_from_trip_booking',
    'trg_sync_hotel_coupon_to_fulfillment',
    'trg_sync_partner_car_duration_days_from_booking',
    'trg_sync_transport_coupon_to_fulfillment',
    'trg_sync_trip_coupon_to_fulfillment',
    'trg_transport_booking_require_customer_email',
    'trip_date_selection_requests_set_updated_at',
    'update_affiliate_referrer_overrides_updated_at',
    'update_car_bookings_updated_at',
    'update_car_updated_at',
    'update_comment_timestamp',
    'update_deposit_updated_at',
    'update_hotel_bookings_updated_at',
    'update_hotel_categories_updated_at',
    'update_hotel_cities_updated_at',
    'update_hotels_updated_at',
    'update_partner_service_fulfillments_updated_at',
    'update_partners_updated_at',
    'update_poi_ratings_updated_at',
    'update_shop_order_fulfillments_updated_at',
    'update_transport_updated_at',
    'update_trip_bookings_updated_at',
    'update_user_plan_days_updated_at',
    'update_user_plan_items_updated_at',
    'update_user_plans_updated_at',
    'validate_hotels_photos_len'
  ]
  loop
    for target_function in
      select p.oid::regprocedure
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = target_name
        and p.prosecdef
        and not exists (
          select 1
          from pg_depend d
          join pg_extension e on e.oid = d.refobjid
          where d.objid = p.oid
            and d.deptype = 'e'
        )
    loop
      execute format('revoke execute on function %s from public', target_function);
      execute format('revoke execute on function %s from anon', target_function);
      execute format('revoke execute on function %s from authenticated', target_function);
    end loop;
  end loop;
end
$$;

-- Notification queue RPCs are worker-only. Keep service_role access, but remove
-- accidental direct execution by browser/API roles.
do $$
declare
  target_name text;
  target_function regprocedure;
begin
  foreach target_name in array array[
    'claim_admin_notification_jobs',
    'complete_admin_notification_job',
    'enqueue_admin_notification'
  ]
  loop
    for target_function in
      select p.oid::regprocedure
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = target_name
        and p.prosecdef
        and not exists (
          select 1
          from pg_depend d
          join pg_extension e on e.oid = d.refobjid
          where d.objid = p.oid
            and d.deptype = 'e'
        )
    loop
      execute format('revoke execute on function %s from public', target_function);
      execute format('revoke execute on function %s from anon', target_function);
      execute format('revoke execute on function %s from authenticated', target_function);
      execute format('grant execute on function %s to service_role', target_function);
    end loop;
  end loop;
end
$$;

commit;
