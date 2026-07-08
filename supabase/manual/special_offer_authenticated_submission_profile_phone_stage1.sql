-- Special Offers 3C.5C-1B corrective SQL.
-- Adds nullable profile phone storage used by authenticated Special Offers submit enrichment.
-- Prepared for manual execution only. No backfill and no entry/answer changes.

begin;

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'Missing required table public.profiles';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'updated_at'
  ) then
    raise exception 'Missing required column public.profiles.updated_at';
  end if;
end;
$$;

alter table public.profiles
  add column if not exists phone text;

alter table public.profiles
  drop constraint if exists profiles_phone_safe_check;

alter table public.profiles
  add constraint profiles_phone_safe_check
  check (
    phone is null
    or (
      char_length(phone) between 1 and 80
      and phone = btrim(phone)
      and phone !~ '[[:cntrl:]]'
      and phone ~ '^\+[1-9][0-9]{0,3}\s+[0-9][0-9\s().-]{3,39}$'
    )
  );

comment on column public.profiles.phone is
  'Optional normalized phone number. Special Offers submit may fill this only for the authenticated user when empty.';

revoke update (phone) on public.profiles from public;
revoke update (phone) on public.profiles from anon;
revoke update (phone) on public.profiles from authenticated;

commit;
