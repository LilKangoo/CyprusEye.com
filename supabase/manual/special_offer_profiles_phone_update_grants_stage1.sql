-- Special Offers 3C.5C-1C corrective SQL.
-- Replaces broad public/authenticated profile UPDATE grants with column allowlists
-- that preserve existing profile UI writes while excluding profiles.phone.
-- Prepared for manual execution only. No profile, entry or answer rows are changed.

begin;

do $$
declare
  v_all_profile_columns text[];
  v_update_allowlist constant text[] := array[
    'name',
    'username',
    'username_normalized',
    'avatar_url',
    'preferred_language',
    'registration_completed',
    'registration_completed_at',
    'xp',
    'level',
    'updated_at'
  ];
  v_insert_allowlist constant text[] := array[
    'id',
    'email',
    'name',
    'username',
    'username_normalized',
    'avatar_url',
    'preferred_language',
    'registration_completed',
    'registration_completed_at'
  ];
  v_existing_update_columns text[];
  v_existing_insert_columns text[];
begin
  if to_regclass('public.profiles') is null then
    raise exception 'Missing required table public.profiles';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'phone'
  ) then
    raise exception 'Missing required column public.profiles.phone';
  end if;

  select array_agg(quote_ident(column_name::text) order by ordinal_position)
  into v_all_profile_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles';

  select array_agg(quote_ident(column_name::text) order by array_position(v_update_allowlist, column_name::text))
  into v_existing_update_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles'
    and column_name::text = any(v_update_allowlist);

  select array_agg(quote_ident(column_name::text) order by array_position(v_insert_allowlist, column_name::text))
  into v_existing_insert_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles'
    and column_name::text = any(v_insert_allowlist);

  if v_all_profile_columns is null or array_length(v_all_profile_columns, 1) is null then
    raise exception 'No columns found for public.profiles';
  end if;

  if v_existing_update_columns is null or array_length(v_existing_update_columns, 1) is null then
    raise exception 'No allowed profile UPDATE columns exist';
  end if;

  if v_existing_insert_columns is null or array_length(v_existing_insert_columns, 1) is null then
    raise exception 'No allowed profile INSERT columns exist';
  end if;

  revoke insert, update, delete on table public.profiles from public;
  revoke insert, update, delete on table public.profiles from anon;
  revoke insert, update, delete on table public.profiles from authenticated;

  execute format(
    'revoke insert (%s), update (%s) on table public.profiles from public',
    array_to_string(v_all_profile_columns, ', '),
    array_to_string(v_all_profile_columns, ', ')
  );
  execute format(
    'revoke insert (%s), update (%s) on table public.profiles from anon',
    array_to_string(v_all_profile_columns, ', '),
    array_to_string(v_all_profile_columns, ', ')
  );
  execute format(
    'revoke insert (%s), update (%s) on table public.profiles from authenticated',
    array_to_string(v_all_profile_columns, ', '),
    array_to_string(v_all_profile_columns, ', ')
  );

  execute format(
    'grant insert (%s) on table public.profiles to authenticated',
    array_to_string(v_existing_insert_columns, ', ')
  );
  execute format(
    'grant update (%s) on table public.profiles to authenticated',
    array_to_string(v_existing_update_columns, ', ')
  );
end;
$$;

commit;
