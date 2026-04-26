begin;

-- Stage 10: keep public booking creation, but require a valid booking shape.
--
-- Anonymous bookings are a product requirement. These policies replace
-- unrestricted WITH CHECK (true) clauses with lightweight checks that match the
-- public forms: contact details, booking dates/times, and initial statuses only.
-- JSON row checks keep compatibility with historical booking table variants.

drop policy if exists bookings_insert_public on public.bookings;
create policy bookings_insert_public
  on public.bookings
  for insert
  with check (
    nullif(btrim(coalesce(to_jsonb(bookings)->>'name', '')), '') is not null
    and coalesce(to_jsonb(bookings)->>'email', '') ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    and nullif(btrim(coalesce(to_jsonb(bookings)->>'whatsapp', '')), '') is not null
    and nullif(btrim(coalesce(to_jsonb(bookings)->>'start_at', '')), '') is not null
    and nullif(btrim(coalesce(to_jsonb(bookings)->>'end_at', '')), '') is not null
    and coalesce(to_jsonb(bookings)->>'status', 'pending') = 'pending'
  );

drop policy if exists car_bookings_anon_insert on public.car_bookings;
create policy car_bookings_anon_insert
  on public.car_bookings
  for insert
  to anon
  with check (
    nullif(btrim(coalesce(to_jsonb(car_bookings)->>'customer_name', to_jsonb(car_bookings)->>'full_name', to_jsonb(car_bookings)->>'name', '')), '') is not null
    and coalesce(to_jsonb(car_bookings)->>'customer_email', to_jsonb(car_bookings)->>'email', '') ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    and (
      nullif(btrim(coalesce(to_jsonb(car_bookings)->>'customer_phone', to_jsonb(car_bookings)->>'phone', '')), '') is not null
      or nullif(btrim(coalesce(to_jsonb(car_bookings)->>'flight_number', '')), '') is not null
    )
    and (
      (
        nullif(btrim(coalesce(to_jsonb(car_bookings)->>'pickup_date', '')), '') is not null
        and nullif(btrim(coalesce(to_jsonb(car_bookings)->>'return_date', '')), '') is not null
      )
      or (
        nullif(btrim(coalesce(to_jsonb(car_bookings)->>'start_at', '')), '') is not null
        and nullif(btrim(coalesce(to_jsonb(car_bookings)->>'end_at', '')), '') is not null
      )
    )
    and coalesce(to_jsonb(car_bookings)->>'status', 'pending') = 'pending'
    and coalesce(to_jsonb(car_bookings)->>'payment_status', 'unpaid') in ('unpaid', 'pending', 'not_required')
  );

drop policy if exists car_bookings_auth_insert on public.car_bookings;
create policy car_bookings_auth_insert
  on public.car_bookings
  for insert
  to authenticated
  with check (
    nullif(btrim(coalesce(to_jsonb(car_bookings)->>'customer_name', to_jsonb(car_bookings)->>'full_name', to_jsonb(car_bookings)->>'name', '')), '') is not null
    and coalesce(to_jsonb(car_bookings)->>'customer_email', to_jsonb(car_bookings)->>'email', '') ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    and (
      nullif(btrim(coalesce(to_jsonb(car_bookings)->>'customer_phone', to_jsonb(car_bookings)->>'phone', '')), '') is not null
      or nullif(btrim(coalesce(to_jsonb(car_bookings)->>'flight_number', '')), '') is not null
    )
    and (
      (
        nullif(btrim(coalesce(to_jsonb(car_bookings)->>'pickup_date', '')), '') is not null
        and nullif(btrim(coalesce(to_jsonb(car_bookings)->>'return_date', '')), '') is not null
      )
      or (
        nullif(btrim(coalesce(to_jsonb(car_bookings)->>'start_at', '')), '') is not null
        and nullif(btrim(coalesce(to_jsonb(car_bookings)->>'end_at', '')), '') is not null
      )
    )
    and coalesce(to_jsonb(car_bookings)->>'status', 'pending') = 'pending'
    and coalesce(to_jsonb(car_bookings)->>'payment_status', 'unpaid') in ('unpaid', 'pending', 'not_required')
  );

drop policy if exists hotel_bookings_anon_insert on public.hotel_bookings;
create policy hotel_bookings_anon_insert
  on public.hotel_bookings
  for insert
  to anon
  with check (
    nullif(btrim(coalesce(to_jsonb(hotel_bookings)->>'customer_name', '')), '') is not null
    and coalesce(to_jsonb(hotel_bookings)->>'customer_email', '') ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    and nullif(btrim(coalesce(to_jsonb(hotel_bookings)->>'arrival_date', '')), '') is not null
    and nullif(btrim(coalesce(to_jsonb(hotel_bookings)->>'departure_date', '')), '') is not null
    and coalesce(nullif(to_jsonb(hotel_bookings)->>'num_adults', ''), '1')::integer >= 1
    and coalesce(to_jsonb(hotel_bookings)->>'status', 'pending') = 'pending'
  );

drop policy if exists hotel_bookings_authenticated_insert on public.hotel_bookings;
create policy hotel_bookings_authenticated_insert
  on public.hotel_bookings
  for insert
  to authenticated
  with check (
    nullif(btrim(coalesce(to_jsonb(hotel_bookings)->>'customer_name', '')), '') is not null
    and coalesce(to_jsonb(hotel_bookings)->>'customer_email', '') ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    and nullif(btrim(coalesce(to_jsonb(hotel_bookings)->>'arrival_date', '')), '') is not null
    and nullif(btrim(coalesce(to_jsonb(hotel_bookings)->>'departure_date', '')), '') is not null
    and coalesce(nullif(to_jsonb(hotel_bookings)->>'num_adults', ''), '1')::integer >= 1
    and coalesce(to_jsonb(hotel_bookings)->>'status', 'pending') = 'pending'
  );

drop policy if exists transport_bookings_public_insert on public.transport_bookings;
create policy transport_bookings_public_insert
  on public.transport_bookings
  for insert
  to anon, authenticated
  with check (
    nullif(btrim(coalesce(to_jsonb(transport_bookings)->>'customer_name', '')), '') is not null
    and coalesce(to_jsonb(transport_bookings)->>'customer_email', '') ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    and nullif(btrim(coalesce(to_jsonb(transport_bookings)->>'customer_phone', '')), '') is not null
    and nullif(btrim(coalesce(to_jsonb(transport_bookings)->>'travel_date', '')), '') is not null
    and nullif(btrim(coalesce(to_jsonb(transport_bookings)->>'travel_time', '')), '') is not null
    and coalesce(nullif(to_jsonb(transport_bookings)->>'num_passengers', ''), '1')::integer >= 1
    and coalesce(to_jsonb(transport_bookings)->>'status', 'pending') = 'pending'
    and coalesce(to_jsonb(transport_bookings)->>'payment_status', 'pending') in ('pending', 'not_required')
  );

drop policy if exists trip_bookings_anon_insert on public.trip_bookings;
create policy trip_bookings_anon_insert
  on public.trip_bookings
  for insert
  to anon
  with check (
    nullif(btrim(coalesce(to_jsonb(trip_bookings)->>'customer_name', '')), '') is not null
    and coalesce(to_jsonb(trip_bookings)->>'customer_email', '') ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    and nullif(btrim(coalesce(to_jsonb(trip_bookings)->>'arrival_date', '')), '') is not null
    and nullif(btrim(coalesce(to_jsonb(trip_bookings)->>'departure_date', '')), '') is not null
    and coalesce(nullif(to_jsonb(trip_bookings)->>'num_adults', ''), '1')::integer >= 1
    and coalesce(to_jsonb(trip_bookings)->>'status', 'pending') = 'pending'
  );

drop policy if exists trip_bookings_auth_insert on public.trip_bookings;
create policy trip_bookings_auth_insert
  on public.trip_bookings
  for insert
  to authenticated
  with check (
    nullif(btrim(coalesce(to_jsonb(trip_bookings)->>'customer_name', '')), '') is not null
    and coalesce(to_jsonb(trip_bookings)->>'customer_email', '') ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    and nullif(btrim(coalesce(to_jsonb(trip_bookings)->>'arrival_date', '')), '') is not null
    and nullif(btrim(coalesce(to_jsonb(trip_bookings)->>'departure_date', '')), '') is not null
    and coalesce(nullif(to_jsonb(trip_bookings)->>'num_adults', ''), '1')::integer >= 1
    and coalesce(to_jsonb(trip_bookings)->>'status', 'pending') = 'pending'
  );

commit;
