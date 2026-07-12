-- Transport Price 4.0B ACL fix.
-- Minimal corrective SQL after base 4.0B deployment.
--
-- Scope:
-- - Preserve existing anon/authenticated access.
-- - Restore service_role EXECUTE on the existing get_service_deposit_status(uuid)
--   overload.
-- - Do not create, replace or modify functions, tables, bookings, payments,
--   Stripe, refunds, commissions, payouts or fulfillment rows.

begin;

do $$
begin
  if to_regprocedure('public.get_service_deposit_status(uuid)') is null then
    raise exception 'Missing required function public.get_service_deposit_status(uuid)';
  end if;
end $$;

grant execute on function public.get_service_deposit_status(uuid) to service_role;

commit;
