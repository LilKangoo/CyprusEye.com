-- Transport Price 4.0E-1 email summary RPC.
--
-- Scope:
-- - Adds a server-only read RPC for Edge Functions using service_role.
-- - Does not change public/customer/partner financial summary ACL.
-- - Does not mutate bookings, payments, Stripe, refunds, commissions, payouts
--   or fulfillment snapshots.

begin;

do $$
begin
  if to_regprocedure('public.transport_booking_financial_summary_core(uuid)') is null then
    raise exception 'Missing required function public.transport_booking_financial_summary_core(uuid)';
  end if;

  if to_regrole('service_role') is null then
    raise exception 'Missing required role service_role';
  end if;
end $$;

create or replace function public.service_get_transport_booking_financial_summary(p_booking_id uuid)
returns table (
  booking_id uuid,
  effective_total numeric,
  currency text,
  confirmed_paid_gross numeric,
  balance_due numeric,
  derived_payment_state text
)
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select
    s.booking_id,
    s.effective_total,
    s.currency,
    s.confirmed_paid_gross,
    s.balance_due,
    s.derived_payment_state
  from public.transport_booking_financial_summary_core(p_booking_id) s;
$$;

alter function public.service_get_transport_booking_financial_summary(uuid) owner to postgres;

revoke all on function public.service_get_transport_booking_financial_summary(uuid) from public;
revoke all on function public.service_get_transport_booking_financial_summary(uuid) from anon;
revoke all on function public.service_get_transport_booking_financial_summary(uuid) from authenticated;
grant execute on function public.service_get_transport_booking_financial_summary(uuid) to service_role;

comment on function public.service_get_transport_booking_financial_summary(uuid) is
  'Server-only transport financial summary for trusted Edge Functions. Uses effective_total from the core summary and exposes no adjustment audit, PII, Stripe IDs, commissions or payout data.';

commit;
