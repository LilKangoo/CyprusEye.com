begin;

-- Stage 7: remove broad authenticated INSERT policies from shop order tables.
--
-- Checkout and Stripe webhook writes are performed by Edge Functions using the
-- service-role key, which bypasses RLS. Customers still keep their SELECT
-- policies for reading their own orders, and admins keep shop admin policies.

drop policy if exists "orders_service_insert" on public.shop_orders;
drop policy if exists "order_items_service_insert" on public.shop_order_items;
drop policy if exists "order_history_service_insert" on public.shop_order_history;

commit;
