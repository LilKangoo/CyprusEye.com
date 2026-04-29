begin;

-- Stage 15: remove signed-in user execution from app-owned SECURITY DEFINER
-- functions unless the current application intentionally calls them as RPCs
-- or RLS policies require signed-in users to execute them.
--
-- This is grant-only. It does not change function bodies, triggers, policies,
-- table data, Edge Functions, or service_role access.

do $$
declare
  target_function regprocedure;
  target_name text;
  keep_authenticated_names constant text[] := array[
    -- Direct public/browser RPCs used by the current app. Logged-in users can
    -- still trigger the same public flows, so authenticated must keep EXECUTE.
    'car_coupon_quote',
    'get_service_deposit_status',
    'hotel_check_availability',
    'service_coupon_quote',
    'shop_generate_order_number',
    'shop_get_price_bounds',
    'shop_get_public_tax_settings',
    'submit_partner_plus_application',
    'validate_referral_code_public',

    -- Authenticated user/admin/partner RPCs currently called by the app.
    'admin_adjust_user_xp',
    'admin_backfill_partner_service_fulfillments_for_resource',
    'admin_ban_user',
    'admin_delete_comment',
    'admin_delete_comment_photo',
    'admin_delete_poi',
    'admin_enable_affiliate_only_user',
    'admin_get_action_log',
    'admin_get_activity_log',
    'admin_get_all_comments',
    'admin_get_comment_details',
    'admin_get_content_stats',
    'admin_get_detailed_content_stats',
    'admin_get_top_contributors',
    'admin_get_user_details',
    'admin_list_partner_plus_applications',
    'admin_set_user_referred_by',
    'admin_set_user_xp_level',
    'admin_unban_user',
    'admin_update_comment',
    'admin_update_user_profile',
    'admin_update_xp_rule',
    'affiliate_admin_create_adjustment',
    'affiliate_admin_create_payout',
    'affiliate_admin_get_partner_balances_v1',
    'affiliate_admin_list_unattributed_deposits_v1',
    'affiliate_admin_mark_payout_paid',
    'affiliate_admin_recompute_commissions_for_deposit',
    'affiliate_admin_reset_commissions_for_deposit',
    'affiliate_admin_unmark_payout_paid',
    'affiliate_get_partner_balance',
    'affiliate_get_partner_balance_v2',
    'affiliate_get_referrer_balance_v1',
    'affiliate_request_cashout',
    'apply_referral_code_to_profile_if_missing',
    'award_poi',
    'award_task',
    'complete_oauth_registration',
    'confirm_referral',
    'partner_get_referral_attributed_orders',
    'partner_get_service_deposit_amounts',
    'revert_task',
    'upsert_partner_service_fulfillment_from_booking_with_partner',
    'verify_quest_code',
    'verify_quest_location',

    -- Partner acceptance RPCs kept for compatibility with older admin/partner
    -- flows while Edge Functions are the primary path.
    'partner_accept_fulfillment',
    'partner_reject_fulfillment',
    'partner_accept_service_fulfillment',
    'partner_reject_service_fulfillment',

    -- Policy helper functions referenced by RLS policies.
    'auth_is_admin',
    'can_auto_publish_partner_blog',
    'can_manage_partner_blog',
    'current_authenticated_email',
    'is_admin',
    'is_current_user_admin',
    'is_current_user_staff',
    'is_partner_owner',
    'is_partner_user',
    'is_shop_admin',
    'is_transport_admin_user',
    'is_user_admin',
    'is_user_banned',
    'partner_plus_is_admin_request'
  ];
begin
  for target_function, target_name in
    select p.oid::regprocedure, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
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
    execute format('grant execute on function %s to service_role', target_function);

    if target_name = any(keep_authenticated_names) then
      execute format('grant execute on function %s to authenticated', target_function);
    else
      execute format('revoke execute on function %s from authenticated', target_function);
    end if;
  end loop;
end
$$;

commit;
