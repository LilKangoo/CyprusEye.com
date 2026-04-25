begin;

create or replace function public.current_authenticated_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(
    trim(
      coalesce(
        nullif(auth.jwt() ->> 'email', ''),
        nullif((
          select p.email
          from public.profiles p
          where p.id = auth.uid()
          limit 1
        ), ''),
        ''
      )
    )
  );
$$;

grant execute on function public.current_authenticated_email() to authenticated, service_role;

do $$
declare
  email_col text;
begin
  if to_regclass('public.trip_bookings') is not null then
    drop policy if exists trip_bookings_user_select on public.trip_bookings;

    create policy trip_bookings_user_select
      on public.trip_bookings
      for select
      to authenticated
      using (
        lower(trim(coalesce(customer_email, ''))) = public.current_authenticated_email()
      );
  end if;

  if to_regclass('public.car_bookings') is not null then
    select case
      when exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'car_bookings'
          and column_name = 'email'
      ) then 'email'
      when exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'car_bookings'
          and column_name = 'customer_email'
      ) then 'customer_email'
      else null
    end
    into email_col;

    if email_col is not null then
      execute 'drop policy if exists car_bookings_user_select on public.car_bookings';
      execute format(
        'create policy car_bookings_user_select
          on public.car_bookings
          for select
          to authenticated
          using (
            lower(trim(coalesce(%I, ''''))) = public.current_authenticated_email()
          )',
        email_col
      );
    end if;
  end if;

  if to_regclass('public.transport_bookings') is not null then
    drop policy if exists transport_bookings_user_select on public.transport_bookings;

    create policy transport_bookings_user_select
      on public.transport_bookings
      for select
      to authenticated
      using (
        lower(trim(coalesce(customer_email, ''))) = public.current_authenticated_email()
      );
  end if;
end
$$;

commit;
