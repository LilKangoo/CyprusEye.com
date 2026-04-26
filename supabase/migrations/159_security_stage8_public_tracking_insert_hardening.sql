begin;

-- Stage 8: keep anonymous tracking, but restrict it to real active records.
--
-- Public recommendation/shop view tracking is intentional. The broad
-- WITH CHECK (true) policies are replaced with checks that only allow events
-- for existing active recommendations/products.

drop policy if exists recommendation_views_insert_public on public.recommendation_views;
create policy recommendation_views_insert_public
  on public.recommendation_views
  for insert
  to anon, authenticated
  with check (
    exists (
      select 1
      from public.recommendations r
      where r.id = recommendation_id
        and r.active = true
    )
  );

drop policy if exists recommendation_clicks_insert_public on public.recommendation_clicks;
create policy recommendation_clicks_insert_public
  on public.recommendation_clicks
  for insert
  to anon, authenticated
  with check (
    exists (
      select 1
      from public.recommendations r
      where r.id = recommendation_id
        and r.active = true
    )
  );

drop policy if exists "product_views_insert" on public.shop_product_views;
create policy "product_views_insert"
  on public.shop_product_views
  for insert
  to anon, authenticated
  with check (
    exists (
      select 1
      from public.shop_products p
      where p.id = product_id
        and p.status = 'active'
    )
  );

commit;
