begin;

-- Stage 13: remove the implicit PUBLIC execute grant from app-owned
-- SECURITY DEFINER functions, then restore explicit grants only for the roles
-- that the current application uses.
--
-- This is intentionally grant-only. It does not change function bodies, RLS,
-- table data, triggers, or Edge Functions.

do $$
declare
  target_function regprocedure;
begin
  for target_function in
    select p.oid::regprocedure
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
  end loop;
end
$$;

-- Anonymous/browser flows that intentionally call RPC directly.
do $$
declare
  target_name text;
  target_function regprocedure;
begin
  foreach target_name in array array[
    'car_coupon_quote',
    'get_service_deposit_status',
    'hotel_check_availability',
    'get_recommendations_nearby',
    'increment_recommendation_clicks',
    'increment_recommendation_views',
    'service_coupon_quote',
    'shop_generate_order_number',
    'shop_get_category_counts',
    'shop_get_price_bounds',
    'shop_get_public_tax_settings',
    'submit_partner_plus_application',
    'validate_referral_code_public'
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
      execute format('grant execute on function %s to anon', target_function);
      execute format('grant execute on function %s to authenticated', target_function);
      execute format('grant execute on function %s to service_role', target_function);
    end loop;
  end loop;
end
$$;

-- Authenticated user/admin/partner RPCs currently called by the app.
do $$
declare
  target_name text;
  target_function regprocedure;
begin
  foreach target_name in array array[
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
    'verify_quest_location'
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
      execute format('grant execute on function %s to authenticated', target_function);
      execute format('grant execute on function %s to service_role', target_function);
    end loop;
  end loop;
end
$$;

-- Policy helper functions referenced by public/anon policies. Removing anon
-- here can break anonymous reads/inserts because RLS expressions call them.
do $$
declare
  target_name text;
  target_function regprocedure;
begin
  foreach target_name in array array[
    'is_admin',
    'is_current_user_admin'
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
      execute format('grant execute on function %s to anon', target_function);
      execute format('grant execute on function %s to authenticated', target_function);
      execute format('grant execute on function %s to service_role', target_function);
    end loop;
  end loop;
end
$$;

-- Authenticated-only RLS/policy helper functions.
do $$
declare
  target_name text;
  target_function regprocedure;
begin
  foreach target_name in array array[
    'auth_is_admin',
    'can_auto_publish_partner_blog',
    'can_manage_partner_blog',
    'current_authenticated_email',
    'is_current_user_staff',
    'is_partner_owner',
    'is_partner_user',
    'is_shop_admin',
    'is_transport_admin_user',
    'is_user_admin',
    'is_user_banned',
    'partner_plus_is_admin_request'
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
      execute format('grant execute on function %s to authenticated', target_function);
      execute format('grant execute on function %s to service_role', target_function);
    end loop;
  end loop;
end
$$;

-- Worker-only RPCs. They should remain callable by Edge/server contexts only.
do $$
declare
  target_name text;
  target_function regprocedure;
begin
  foreach target_name in array array[
    'claim_admin_notification_jobs',
    'complete_admin_notification_job',
    'enqueue_admin_notification',
    'shop_award_xp'
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
      execute format('revoke execute on function %s from anon', target_function);
      execute format('revoke execute on function %s from authenticated', target_function);
      execute format('grant execute on function %s to service_role', target_function);
    end loop;
  end loop;
end
$$;

commit;
