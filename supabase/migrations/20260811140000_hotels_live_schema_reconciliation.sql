begin;
set transaction isolation level repeatable read;

-- Hotels H1A: reconcile accepted live-only Hotel schema into the tracked
-- migration history. This migration is additive on a fresh database and a
-- no-data-change contract check on the accepted production schema.

do $$
declare
  v_missing text[];
begin
  select coalesce(array_agg(object_name order by object_name), '{}'::text[])
  into v_missing
  from unnest(array[
    'public.hotels',
    'public.profiles'
  ]::text[]) required(object_name)
  where to_regclass(object_name) is null;

  if cardinality(v_missing) > 0 then
    raise exception using
      errcode = '42P01',
      message = 'hotels_h1a_reconciliation_required_object_missing',
      detail = array_to_string(v_missing, ',');
  end if;

  if to_regprocedure('public.is_current_user_admin()') is null then
    raise exception using
      errcode = '42883',
      message = 'hotels_h1a_reconciliation_admin_helper_missing';
  end if;
end
$$;

create temporary table hotels_h1a_reconciliation_snapshot (
  protected_hotels_fingerprint text not null,
  hotel_cities_existed boolean not null,
  hotel_cities_fingerprint text,
  hotel_amenities_existed boolean not null,
  hotel_amenities_fingerprint text
) on commit drop;

insert into hotels_h1a_reconciliation_snapshot (
  protected_hotels_fingerprint,
  hotel_cities_existed,
  hotel_amenities_existed
)
select
  (
    select md5(coalesce(string_agg(
      (
        to_jsonb(hotel)
        - 'sort_order'
        - 'amenities'
        - 'title_i18n'
        - 'description_i18n'
      )::text,
      '|' order by hotel.id
    ), ''))
    from public.hotels hotel
  ),
  to_regclass('public.hotel_cities') is not null,
  to_regclass('public.hotel_amenities') is not null;

do $$
declare
  v_fingerprint text;
begin
  if to_regclass('public.hotel_cities') is not null then
    execute 'select md5(coalesce(string_agg(to_jsonb(city)::text, ''|'' order by city.id), '''')) from public.hotel_cities city'
    into v_fingerprint;
    update hotels_h1a_reconciliation_snapshot
    set hotel_cities_fingerprint = v_fingerprint;
  end if;

  if to_regclass('public.hotel_amenities') is not null then
    execute 'select md5(coalesce(string_agg(to_jsonb(amenity)::text, ''|'' order by amenity.id), '''')) from public.hotel_amenities amenity'
    into v_fingerprint;
    update hotels_h1a_reconciliation_snapshot
    set hotel_amenities_fingerprint = v_fingerprint;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'hotels' and column_name = 'sort_order'
  ) then
    alter table public.hotels add column sort_order integer not null default 1000;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'hotels' and column_name = 'amenities'
  ) then
    alter table public.hotels add column amenities jsonb default '[]'::jsonb;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'hotels' and column_name = 'title_i18n'
  ) then
    alter table public.hotels add column title_i18n jsonb;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'hotels' and column_name = 'description_i18n'
  ) then
    alter table public.hotels add column description_i18n jsonb;
  end if;
end
$$;

do $$
declare
  v_mismatch_count integer;
begin
  with expected(column_name, data_type, is_nullable, column_default) as (
    values
      ('sort_order', 'integer', 'NO', '1000'),
      ('amenities', 'jsonb', 'YES', '''[]''::jsonb'),
      ('title_i18n', 'jsonb', 'YES', null),
      ('description_i18n', 'jsonb', 'YES', null)
  ), actual as (
    select
      column_name,
      case
        when data_type = 'USER-DEFINED' then udt_name
        else data_type
      end as data_type,
      is_nullable,
      column_default
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'hotels'
      and column_name in ('sort_order', 'amenities', 'title_i18n', 'description_i18n')
  )
  select count(*)
  into v_mismatch_count
  from expected
  left join actual using (column_name)
  where actual.column_name is null
     or actual.data_type is distinct from expected.data_type
     or actual.is_nullable is distinct from expected.is_nullable
     or actual.column_default is distinct from expected.column_default;

  if v_mismatch_count <> 0 then
    raise exception using
      errcode = '23514',
      message = 'hotels_h1a_reconciliation_hotels_column_contract_mismatch',
      detail = v_mismatch_count::text;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.hotel_cities') is null then
    create table public.hotel_cities (
      id uuid primary key default gen_random_uuid(),
      name text not null unique,
      name_pl text,
      name_en text,
      display_order integer default 0,
      is_active boolean default true,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );
  end if;
end
$$;

do $$
declare
  v_mismatch_count integer;
  v_column_count integer;
begin
  select count(*) into v_column_count
  from information_schema.columns
  where table_schema = 'public' and table_name = 'hotel_cities';

  if v_column_count <> 8 then
    raise exception using
      errcode = '23514',
      message = 'hotels_h1a_reconciliation_hotel_cities_column_count_mismatch',
      detail = v_column_count::text;
  end if;

  with expected(column_name, data_type, is_nullable, column_default) as (
    values
      ('id', 'uuid', 'NO', 'gen_random_uuid()'),
      ('name', 'text', 'NO', null),
      ('name_pl', 'text', 'YES', null),
      ('name_en', 'text', 'YES', null),
      ('display_order', 'integer', 'YES', '0'),
      ('is_active', 'boolean', 'YES', 'true'),
      ('created_at', 'timestamp with time zone', 'YES', 'now()'),
      ('updated_at', 'timestamp with time zone', 'YES', 'now()')
  ), actual as (
    select
      column_name,
      case when data_type = 'USER-DEFINED' then udt_name else data_type end as data_type,
      is_nullable,
      column_default
    from information_schema.columns
    where table_schema = 'public' and table_name = 'hotel_cities'
  )
  select count(*) into v_mismatch_count
  from expected
  left join actual using (column_name)
  where actual.column_name is null
     or actual.data_type is distinct from expected.data_type
     or actual.is_nullable is distinct from expected.is_nullable
     or actual.column_default is distinct from expected.column_default;

  if v_mismatch_count <> 0 then
    raise exception using
      errcode = '23514',
      message = 'hotels_h1a_reconciliation_hotel_cities_contract_mismatch',
      detail = v_mismatch_count::text;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.hotel_cities'::regclass
      and contype = 'p'
      and pg_get_constraintdef(oid) = 'PRIMARY KEY (id)'
  ) or not exists (
    select 1 from pg_constraint
    where conrelid = 'public.hotel_cities'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (name)'
  ) then
    raise exception using
      errcode = '23514',
      message = 'hotels_h1a_reconciliation_hotel_cities_key_contract_mismatch';
  end if;
end
$$;

create index if not exists hotel_cities_display_order_idx
  on public.hotel_cities(display_order);
create index if not exists hotel_cities_is_active_idx
  on public.hotel_cities(is_active);

do $$
declare
  v_mismatch_count integer;
  v_actual_count integer;
begin
  with expected(index_name, index_definition) as (
    values
      ('hotel_cities_pkey', 'CREATE UNIQUE INDEX hotel_cities_pkey ON public.hotel_cities USING btree (id)'),
      ('hotel_cities_name_key', 'CREATE UNIQUE INDEX hotel_cities_name_key ON public.hotel_cities USING btree (name)'),
      ('hotel_cities_display_order_idx', 'CREATE INDEX hotel_cities_display_order_idx ON public.hotel_cities USING btree (display_order)'),
      ('hotel_cities_is_active_idx', 'CREATE INDEX hotel_cities_is_active_idx ON public.hotel_cities USING btree (is_active)')
  ), actual as (
    select index_relation.relname::text as index_name,
           pg_get_indexdef(index_relation.oid) as index_definition
    from pg_index index_info
    join pg_class index_relation on index_relation.oid = index_info.indexrelid
    where index_info.indrelid = 'public.hotel_cities'::regclass
  )
  select count(*) into v_mismatch_count
  from expected
  left join actual using (index_name)
  where actual.index_name is null
     or actual.index_definition is distinct from expected.index_definition;

  select count(*) into v_actual_count
  from pg_index
  where indrelid = 'public.hotel_cities'::regclass;

  if v_mismatch_count <> 0
     or v_actual_count <> 4 then
    raise exception using
      errcode = '23514',
      message = 'hotels_h1a_reconciliation_hotel_cities_index_contract_mismatch',
      detail = v_mismatch_count::text;
  end if;
end
$$;

do $$
begin
  if to_regprocedure('public.update_hotel_cities_updated_at()') is null then
    execute $function$
      create function public.update_hotel_cities_updated_at()
      returns trigger
      language plpgsql
      set search_path = pg_catalog, public
      as $body$
      begin
        new.updated_at = now();
        return new;
      end;
      $body$
    $function$;
  elsif not exists (
    select 1
    from pg_proc procedure
    where procedure.oid = 'public.update_hotel_cities_updated_at()'::regprocedure
      and procedure.prorettype = 'trigger'::regtype
      and pg_get_functiondef(procedure.oid) ilike '%new.updated_at = now()%'
  ) then
    raise exception using
      errcode = '23514',
      message = 'hotels_h1a_reconciliation_hotel_cities_trigger_function_mismatch';
  end if;

  alter function public.update_hotel_cities_updated_at()
    set search_path = pg_catalog, public;

  if not exists (
    select 1
    from pg_proc procedure
    where procedure.oid = 'public.update_hotel_cities_updated_at()'::regprocedure
      and coalesce(procedure.proconfig, '{}'::text[]) @> array['search_path=pg_catalog, public']::text[]
  ) then
    raise exception using
      errcode = '23514',
      message = 'hotels_h1a_reconciliation_hotel_cities_trigger_search_path_mismatch';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.hotel_cities'::regclass
      and tgname = 'trg_update_hotel_cities_updated_at'
      and not tgisinternal
  ) then
    create trigger trg_update_hotel_cities_updated_at
      before update on public.hotel_cities
      for each row execute function public.update_hotel_cities_updated_at();
  elsif not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.hotel_cities'::regclass
      and tgname = 'trg_update_hotel_cities_updated_at'
      and not tgisinternal
      and tgfoid = 'public.update_hotel_cities_updated_at()'::regprocedure
      and pg_get_triggerdef(oid, true) ilike 'create trigger trg_update_hotel_cities_updated_at before update on hotel_cities%'
  ) then
    raise exception using
      errcode = '23514',
      message = 'hotels_h1a_reconciliation_hotel_cities_trigger_mismatch';
  end if;
end
$$;

alter table public.hotel_cities enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'hotel_cities'
      and policyname = 'hotel_cities_select_public'
  ) then
    create policy hotel_cities_select_public
      on public.hotel_cities for select
      using (is_active = true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'hotel_cities'
      and policyname = 'hotel_cities_all_admin'
  ) then
    create policy hotel_cities_all_admin
      on public.hotel_cities for all
      using (
        exists (
          select 1 from public.profiles
          where profiles.id = auth.uid() and profiles.is_admin = true
        )
      )
      with check (
        exists (
          select 1 from public.profiles
          where profiles.id = auth.uid() and profiles.is_admin = true
        )
      );
  end if;

  if (
    select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'hotel_cities'
  ) <> 2
  or not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'hotel_cities'
      and policyname = 'hotel_cities_select_public'
      and permissive = 'PERMISSIVE'
      and roles = array['public']::name[]
      and cmd = 'SELECT'
      and regexp_replace(lower(coalesce(qual, '')), '[()[:space:]"]', '', 'g') = 'is_active=true'
      and with_check is null
  )
  or not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'hotel_cities'
      and policyname = 'hotel_cities_all_admin'
      and permissive = 'PERMISSIVE'
      and roles = array['public']::name[]
      and cmd = 'ALL'
      and regexp_replace(lower(coalesce(qual, '')), '[()[:space:]"]', '', 'g') =
          'existsselect1fromprofileswhereprofiles.id=auth.uidandprofiles.is_admin=true'
      and regexp_replace(lower(coalesce(with_check, '')), '[()[:space:]"]', '', 'g') =
          'existsselect1fromprofileswhereprofiles.id=auth.uidandprofiles.is_admin=true'
  ) then
    raise exception using
      errcode = '23514',
      message = 'hotels_h1a_reconciliation_hotel_cities_policy_contract_mismatch';
  end if;
end
$$;

revoke all on table public.hotel_cities from public, anon, authenticated;
grant select on table public.hotel_cities to anon;
grant select, insert, update, delete on table public.hotel_cities to authenticated;
grant all on table public.hotel_cities to service_role;

comment on table public.hotel_cities is 'Dynamic cities/locations for hotels management';
comment on column public.hotel_cities.name is 'Primary city name (used as value)';
comment on column public.hotel_cities.display_order is 'Order in dropdowns (lower = first)';

do $$
begin
  if to_regclass('public.hotel_amenities') is null then
    create table public.hotel_amenities (
      id uuid primary key default gen_random_uuid(),
      code text not null unique,
      category text not null,
      icon text,
      name_en text not null,
      name_pl text not null,
      display_order integer default 0,
      is_popular boolean default false,
      is_active boolean default true,
      created_at timestamptz default now(),
      name_he text
    );
  end if;
end
$$;

do $$
declare
  v_mismatch_count integer;
  v_column_count integer;
begin
  select count(*) into v_column_count
  from information_schema.columns
  where table_schema = 'public' and table_name = 'hotel_amenities';

  if v_column_count <> 11 then
    raise exception using
      errcode = '23514',
      message = 'hotels_h1a_reconciliation_hotel_amenities_column_count_mismatch',
      detail = v_column_count::text;
  end if;

  with expected(column_name, data_type, is_nullable, column_default) as (
    values
      ('id', 'uuid', 'NO', 'gen_random_uuid()'),
      ('code', 'text', 'NO', null),
      ('category', 'text', 'NO', null),
      ('icon', 'text', 'YES', null),
      ('name_en', 'text', 'NO', null),
      ('name_pl', 'text', 'NO', null),
      ('display_order', 'integer', 'YES', '0'),
      ('is_popular', 'boolean', 'YES', 'false'),
      ('is_active', 'boolean', 'YES', 'true'),
      ('created_at', 'timestamp with time zone', 'YES', 'now()'),
      ('name_he', 'text', 'YES', null)
  ), actual as (
    select
      column_name,
      case when data_type = 'USER-DEFINED' then udt_name else data_type end as data_type,
      is_nullable,
      column_default
    from information_schema.columns
    where table_schema = 'public' and table_name = 'hotel_amenities'
  )
  select count(*) into v_mismatch_count
  from expected
  left join actual using (column_name)
  where actual.column_name is null
     or actual.data_type is distinct from expected.data_type
     or actual.is_nullable is distinct from expected.is_nullable
     or actual.column_default is distinct from expected.column_default;

  if v_mismatch_count <> 0 then
    raise exception using
      errcode = '23514',
      message = 'hotels_h1a_reconciliation_hotel_amenities_contract_mismatch',
      detail = v_mismatch_count::text;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.hotel_amenities'::regclass
      and contype = 'p'
      and pg_get_constraintdef(oid) = 'PRIMARY KEY (id)'
  ) or not exists (
    select 1 from pg_constraint
    where conrelid = 'public.hotel_amenities'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (code)'
  ) then
    raise exception using
      errcode = '23514',
      message = 'hotels_h1a_reconciliation_hotel_amenities_key_contract_mismatch';
  end if;
end
$$;

create index if not exists hotel_amenities_category_idx
  on public.hotel_amenities(category);
create index if not exists hotel_amenities_display_order_idx
  on public.hotel_amenities(display_order);
create index if not exists hotel_amenities_is_active_idx
  on public.hotel_amenities(is_active);

do $$
declare
  v_mismatch_count integer;
  v_actual_count integer;
begin
  with expected(index_name, index_definition) as (
    values
      ('hotel_amenities_pkey', 'CREATE UNIQUE INDEX hotel_amenities_pkey ON public.hotel_amenities USING btree (id)'),
      ('hotel_amenities_code_key', 'CREATE UNIQUE INDEX hotel_amenities_code_key ON public.hotel_amenities USING btree (code)'),
      ('hotel_amenities_category_idx', 'CREATE INDEX hotel_amenities_category_idx ON public.hotel_amenities USING btree (category)'),
      ('hotel_amenities_display_order_idx', 'CREATE INDEX hotel_amenities_display_order_idx ON public.hotel_amenities USING btree (display_order)'),
      ('hotel_amenities_is_active_idx', 'CREATE INDEX hotel_amenities_is_active_idx ON public.hotel_amenities USING btree (is_active)')
  ), actual as (
    select index_relation.relname::text as index_name,
           pg_get_indexdef(index_relation.oid) as index_definition
    from pg_index index_info
    join pg_class index_relation on index_relation.oid = index_info.indexrelid
    where index_info.indrelid = 'public.hotel_amenities'::regclass
  )
  select count(*) into v_mismatch_count
  from expected
  left join actual using (index_name)
  where actual.index_name is null
     or actual.index_definition is distinct from expected.index_definition;

  select count(*) into v_actual_count
  from pg_index
  where indrelid = 'public.hotel_amenities'::regclass;

  if v_mismatch_count <> 0
     or v_actual_count <> 5 then
    raise exception using
      errcode = '23514',
      message = 'hotels_h1a_reconciliation_hotel_amenities_index_contract_mismatch',
      detail = v_mismatch_count::text;
  end if;
end
$$;

alter table public.hotel_amenities enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'hotel_amenities'
      and policyname = 'hotel_amenities_select_public'
  ) then
    create policy hotel_amenities_select_public
      on public.hotel_amenities for select
      using (is_active = true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'hotel_amenities'
      and policyname = 'hotel_amenities_all_admin'
  ) then
    create policy hotel_amenities_all_admin
      on public.hotel_amenities for all
      using (
        exists (
          select 1 from public.profiles
          where profiles.id = auth.uid() and profiles.is_admin = true
        )
      )
      with check (
        exists (
          select 1 from public.profiles
          where profiles.id = auth.uid() and profiles.is_admin = true
        )
      );
  end if;

  if (
    select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'hotel_amenities'
  ) <> 2
  or not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'hotel_amenities'
      and policyname = 'hotel_amenities_select_public'
      and permissive = 'PERMISSIVE'
      and roles = array['public']::name[]
      and cmd = 'SELECT'
      and regexp_replace(lower(coalesce(qual, '')), '[()[:space:]"]', '', 'g') = 'is_active=true'
      and with_check is null
  )
  or not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'hotel_amenities'
      and policyname = 'hotel_amenities_all_admin'
      and permissive = 'PERMISSIVE'
      and roles = array['public']::name[]
      and cmd = 'ALL'
      and regexp_replace(lower(coalesce(qual, '')), '[()[:space:]"]', '', 'g') =
          'existsselect1fromprofileswhereprofiles.id=auth.uidandprofiles.is_admin=true'
      and regexp_replace(lower(coalesce(with_check, '')), '[()[:space:]"]', '', 'g') =
          'existsselect1fromprofileswhereprofiles.id=auth.uidandprofiles.is_admin=true'
  ) then
    raise exception using
      errcode = '23514',
      message = 'hotels_h1a_reconciliation_hotel_amenities_policy_contract_mismatch';
  end if;
end
$$;

revoke all on table public.hotel_amenities from public, anon, authenticated;
grant select on table public.hotel_amenities to anon;
grant select, insert, update, delete on table public.hotel_amenities to authenticated;
grant all on table public.hotel_amenities to service_role;

comment on column public.hotel_amenities.name_he is
  'Internal Hebrew hotel amenity label. Hidden until controlled Hebrew public rollout.';

do $$
declare
  v_table_name text;
begin
  foreach v_table_name in array array['hotel_cities', 'hotel_amenities']
  loop
    if not coalesce((
      select relation.relrowsecurity
      from pg_class relation
      where relation.oid = format('public.%I', v_table_name)::regclass
    ), false) then
      raise exception using
        errcode = '23514',
        message = 'hotels_h1a_reconciliation_live_table_rls_mismatch',
        detail = v_table_name;
    end if;

    if not has_table_privilege('anon', format('public.%I', v_table_name), 'SELECT')
       or has_table_privilege('anon', format('public.%I', v_table_name), 'INSERT')
       or has_table_privilege('anon', format('public.%I', v_table_name), 'UPDATE')
       or has_table_privilege('anon', format('public.%I', v_table_name), 'DELETE')
       or has_table_privilege('anon', format('public.%I', v_table_name), 'TRUNCATE')
       or has_table_privilege('anon', format('public.%I', v_table_name), 'REFERENCES')
       or has_table_privilege('anon', format('public.%I', v_table_name), 'TRIGGER')
       or not has_table_privilege('authenticated', format('public.%I', v_table_name), 'SELECT')
       or not has_table_privilege('authenticated', format('public.%I', v_table_name), 'INSERT')
       or not has_table_privilege('authenticated', format('public.%I', v_table_name), 'UPDATE')
       or not has_table_privilege('authenticated', format('public.%I', v_table_name), 'DELETE')
       or has_table_privilege('authenticated', format('public.%I', v_table_name), 'TRUNCATE')
       or has_table_privilege('authenticated', format('public.%I', v_table_name), 'REFERENCES')
       or has_table_privilege('authenticated', format('public.%I', v_table_name), 'TRIGGER')
       or not has_table_privilege('service_role', format('public.%I', v_table_name), 'SELECT')
       or not has_table_privilege('service_role', format('public.%I', v_table_name), 'INSERT')
       or not has_table_privilege('service_role', format('public.%I', v_table_name), 'UPDATE')
       or not has_table_privilege('service_role', format('public.%I', v_table_name), 'DELETE')
       or not has_table_privilege('service_role', format('public.%I', v_table_name), 'TRUNCATE')
       or not has_table_privilege('service_role', format('public.%I', v_table_name), 'REFERENCES')
       or not has_table_privilege('service_role', format('public.%I', v_table_name), 'TRIGGER') then
      raise exception using
        errcode = '23514',
        message = 'hotels_h1a_reconciliation_live_table_grant_mismatch',
        detail = v_table_name;
    end if;
  end loop;

  if obj_description('public.hotel_cities'::regclass, 'pg_class') is distinct from
       'Dynamic cities/locations for hotels management'
     or col_description('public.hotel_cities'::regclass, (
       select attnum from pg_attribute
       where attrelid = 'public.hotel_cities'::regclass and attname = 'name'
     )) is distinct from 'Primary city name (used as value)'
     or col_description('public.hotel_cities'::regclass, (
       select attnum from pg_attribute
       where attrelid = 'public.hotel_cities'::regclass and attname = 'display_order'
     )) is distinct from 'Order in dropdowns (lower = first)'
     or obj_description('public.hotel_amenities'::regclass, 'pg_class') is not null
     or col_description('public.hotel_amenities'::regclass, (
       select attnum from pg_attribute
       where attrelid = 'public.hotel_amenities'::regclass and attname = 'name_he'
     )) is distinct from
       'Internal Hebrew hotel amenity label. Hidden until controlled Hebrew public rollout.' then
    raise exception using
      errcode = '23514',
      message = 'hotels_h1a_reconciliation_live_comment_contract_mismatch';
  end if;
end
$$;

do $$
declare
  v_snapshot hotels_h1a_reconciliation_snapshot%rowtype;
  v_current_fingerprint text;
begin
  select * into v_snapshot from hotels_h1a_reconciliation_snapshot;

  select md5(coalesce(string_agg(
    (
      to_jsonb(hotel)
      - 'sort_order'
      - 'amenities'
      - 'title_i18n'
      - 'description_i18n'
    )::text,
    '|' order by hotel.id
  ), ''))
  into v_current_fingerprint
  from public.hotels hotel;

  if v_current_fingerprint is distinct from v_snapshot.protected_hotels_fingerprint then
    raise exception using
      errcode = '23514',
      message = 'hotels_h1a_reconciliation_protected_hotels_changed';
  end if;

  if v_snapshot.hotel_cities_existed then
    select md5(coalesce(string_agg(to_jsonb(city)::text, '|' order by city.id), ''))
    into v_current_fingerprint
    from public.hotel_cities city;

    if v_current_fingerprint is distinct from v_snapshot.hotel_cities_fingerprint then
      raise exception using
        errcode = '23514',
        message = 'hotels_h1a_reconciliation_hotel_cities_rows_changed';
    end if;
  elsif exists (select 1 from public.hotel_cities) then
    raise exception using
      errcode = '23514',
      message = 'hotels_h1a_reconciliation_created_hotel_cities_not_empty';
  end if;

  if v_snapshot.hotel_amenities_existed then
    select md5(coalesce(string_agg(to_jsonb(amenity)::text, '|' order by amenity.id), ''))
    into v_current_fingerprint
    from public.hotel_amenities amenity;

    if v_current_fingerprint is distinct from v_snapshot.hotel_amenities_fingerprint then
      raise exception using
        errcode = '23514',
        message = 'hotels_h1a_reconciliation_hotel_amenities_rows_changed';
    end if;
  elsif exists (select 1 from public.hotel_amenities) then
    raise exception using
      errcode = '23514',
      message = 'hotels_h1a_reconciliation_created_hotel_amenities_not_empty';
  end if;
end
$$;

commit;
