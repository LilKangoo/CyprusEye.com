begin;

-- Stage 4 follow-up: harden the remaining public app-owned functions reported
-- by Supabase Security Advisor after migration 153.
--
-- This intentionally uses ALTER FUNCTION against live pg_proc entries, rather
-- than CREATE OR REPLACE, so function bodies, SECURITY DEFINER flags, grants,
-- triggers, and overloads remain intact. Extension-owned functions are skipped.

do $$
declare
  target_name text;
  target_function regprocedure;
begin
  foreach target_name in array array[
    '_user_email_of_row',
    '_user_name_of_row',
    'admin_adjust_user_xp',
    'admin_ban_user',
    'admin_bulk_comment_operation',
    'admin_bulk_delete_comments',
    'admin_bulk_update_users',
    'admin_delete_comment',
    'admin_delete_comment_photo',
    'admin_delete_user',
    'admin_get_action_log',
    'admin_get_activity_log',
    'admin_get_all_comments',
    'admin_get_all_photos',
    'admin_get_car_booking_stats',
    'admin_get_comment_details',
    'admin_get_content_stats',
    'admin_get_detailed_content_stats',
    'admin_get_flagged_content',
    'admin_get_top_contributors',
    'admin_get_user_growth',
    'admin_notification_jobs_set_updated_at',
    'admin_push_subscriptions_set_updated_at',
    'admin_toggle_admin',
    'admin_unban_user',
    'admin_update_booking_status',
    'admin_update_comment',
    'admin_update_xp_rule',
    'affiliate_cashout_requests_set_updated_at',
    'apply_xp_event',
    'auth_is_admin',
    'award_task',
    'award_xp',
    'calculate_paphos_price',
    'car_booking_rental_days',
    'check_car_availability',
    'confirm_referral',
    'create_notification_on_like',
    'create_notification_on_reply',
    'get_task_xp',
    'handle_new_user',
    'is_shop_admin',
    'is_user_admin',
    'normalize_referral_code',
    'partner_payout_details_set_updated_at',
    'partner_push_subscriptions_set_updated_at',
    'revert_task',
    'shop_award_xp',
    'shop_generate_invoice_number',
    'shop_generate_order_number',
    'shop_update_product_review_stats',
    'shop_update_timestamp',
    'sync_recommendation_click_count',
    'sync_recommendation_view_count',
    'touch_updated_at',
    'trg_transport_booking_require_customer_email',
    'trip_date_selection_requests_set_updated_at',
    'try_numeric',
    'try_uuid',
    'update_affiliate_referrer_overrides_updated_at',
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
        and not exists (
          select 1
          from pg_depend d
          join pg_extension e on e.oid = d.refobjid
          where d.objid = p.oid
            and d.deptype = 'e'
        )
    loop
      execute format('alter function %s set search_path = public', target_function);
    end loop;
  end loop;
end
$$;

commit;
