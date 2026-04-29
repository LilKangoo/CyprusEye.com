begin;

-- Stage 14: remove anonymous execution from app-owned SECURITY DEFINER
-- functions that are not intentionally public browser RPCs.
--
-- This is grant-only. It does not change function bodies, triggers, policies,
-- table data, Edge Functions, or authenticated/service_role access.

do $$
declare
  target_function regprocedure;
  target_name text;
  anon_allowed_names constant text[] := array[
    -- Direct public/browser RPCs used by the current app.
    'car_coupon_quote',
    'get_service_deposit_status',
    'hotel_check_availability',
    'service_coupon_quote',
    'shop_generate_order_number',
    'shop_get_price_bounds',
    'shop_get_public_tax_settings',
    'submit_partner_plus_application',
    'validate_referral_code_public',

    -- Public RLS helper functions. Public policies reference these in OR
    -- expressions, so removing anon can cause permission errors on reads.
    'is_admin',
    'is_current_user_admin'
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

    if target_name = any(anon_allowed_names) then
      execute format('grant execute on function %s to anon', target_function);
      execute format('grant execute on function %s to authenticated', target_function);
    else
      execute format('revoke execute on function %s from anon', target_function);
    end if;
  end loop;
end
$$;

commit;
