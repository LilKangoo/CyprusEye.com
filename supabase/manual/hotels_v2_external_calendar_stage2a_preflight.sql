-- Hotels V2 Stage 2A
-- PRE-MIGRATION gate for migration 139.
-- READ ONLY by design.

begin;
set transaction read only;
set local statement_timeout = '60s';

do $stage2a_preflight$
declare
  v_failures text[] := array[]::text[];
begin
  -- -------------------------------------------------------------------------
  -- Core Stage 1 dependencies
  -- -------------------------------------------------------------------------

  if to_regclass('public.hotels') is null then
    v_failures := array_append(v_failures, 'missing public.hotels');
  end if;

  if to_regclass('public.hotel_room_types') is null then
    v_failures := array_append(v_failures, 'missing public.hotel_room_types');
  end if;

  if to_regclass('public.hotel_calendar_source_configs') is null then
    v_failures := array_append(
      v_failures,
      'missing public.hotel_calendar_source_configs'
    );
  end if;

  if to_regclass('public.site_settings') is null then
    v_failures := array_append(v_failures, 'missing public.site_settings');
  end if;

  if to_regnamespace('hotels_v2_private') is null then
    v_failures := array_append(
      v_failures,
      'missing hotels_v2_private schema'
    );
  end if;

  if to_regprocedure('public.hotel_v2_h2a_require_admin()') is null then
    v_failures := array_append(
      v_failures,
      'missing hotel_v2_h2a_require_admin()'
    );
  end if;

  if to_regprocedure('gen_random_uuid()') is null then
    v_failures := array_append(
      v_failures,
      'missing gen_random_uuid()'
    );
  end if;

  -- -------------------------------------------------------------------------
  -- Columns consumed by migration 139 / Stage 2A RPC contract
  -- -------------------------------------------------------------------------

  if exists (
    select 1
    from (
      values
        ('hotel_calendar_source_configs', 'id'),
        ('hotel_calendar_source_configs', 'hotel_id'),
        ('hotel_calendar_source_configs', 'room_type_id'),
        ('hotel_calendar_source_configs', 'code'),
        ('hotel_calendar_source_configs', 'source_type'),
        ('hotel_calendar_source_configs', 'external_reference'),
        ('hotel_calendar_source_configs', 'configuration'),
        ('hotel_calendar_source_configs', 'is_enabled'),
        ('hotel_calendar_source_configs', 'review_status'),
        ('hotel_calendar_source_configs', 'priority'),
        ('hotel_calendar_source_configs', 'version'),
        ('hotel_calendar_source_configs', 'updated_at'),

        ('hotel_room_types', 'id'),
        ('hotel_room_types', 'hotel_id'),

        ('site_settings', 'hotel_rooms_v2_enabled'),
        ('site_settings', 'hotel_external_sync_enabled'),
        ('site_settings', 'hotel_instant_booking_enabled'),
        ('site_settings', 'hotel_stripe_connect_enabled')
    ) required(table_name, column_name)

    where not exists (
      select 1
      from information_schema.columns column_info
      where column_info.table_schema = 'public'
        and column_info.table_name = required.table_name
        and column_info.column_name = required.column_name
    )
  ) then
    v_failures := array_append(
      v_failures,
      'required Stage 2A public columns missing'
    );
  end if;

  -- The new private runtime tables use the existing room/hotel composite key.
  if not exists (
    select 1
    from pg_constraint constraint_info
    join pg_class relation
      on relation.oid = constraint_info.conrelid
    join pg_namespace namespace_info
      on namespace_info.oid = relation.relnamespace
    where namespace_info.nspname = 'public'
      and relation.relname = 'hotel_room_types'
      and constraint_info.contype in ('p', 'u')
      and (
        replace(
          pg_get_constraintdef(constraint_info.oid),
          '"',
          ''
        ) ilike 'UNIQUE (id, hotel_id)%'
        or
        replace(
          pg_get_constraintdef(constraint_info.oid),
          '"',
          ''
        ) ilike 'PRIMARY KEY (id, hotel_id)%'
      )
  ) then
    v_failures := array_append(
      v_failures,
      'hotel_room_types lacks unique (id, hotel_id) contract'
    );
  end if;

  -- -------------------------------------------------------------------------
  -- Vault contract discovered from production
  -- -------------------------------------------------------------------------

  if not exists (
    select 1
    from pg_extension
    where extname = 'supabase_vault'
  ) then
    v_failures := array_append(
      v_failures,
      'supabase_vault extension missing'
    );
  end if;

  if to_regclass('vault.secrets') is null then
    v_failures := array_append(
      v_failures,
      'vault.secrets missing'
    );
  end if;

  if to_regclass('vault.decrypted_secrets') is null then
    v_failures := array_append(
      v_failures,
      'vault.decrypted_secrets missing'
    );
  end if;

  if to_regprocedure(
    'vault.create_secret(text,text,text,uuid)'
  ) is null then
    v_failures := array_append(
      v_failures,
      'vault.create_secret contract missing'
    );
  end if;

  if to_regprocedure(
    'vault.update_secret(uuid,text,text,text,uuid)'
  ) is null then
    v_failures := array_append(
      v_failures,
      'vault.update_secret contract missing'
    );
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'vault'
      and table_name = 'secrets'
      and column_name = 'id'
      and data_type = 'uuid'
  ) then
    v_failures := array_append(
      v_failures,
      'vault.secrets.id contract mismatch'
    );
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'vault'
      and table_name = 'decrypted_secrets'
      and column_name = 'decrypted_secret'
      and data_type = 'text'
  ) then
    v_failures := array_append(
      v_failures,
      'vault.decrypted_secrets.decrypted_secret contract mismatch'
    );
  end if;

  -- Browser roles must not have direct Vault access.
  if has_function_privilege(
       'anon',
       'vault.create_secret(text,text,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'vault.create_secret(text,text,text,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'vault.create_secret(text,text,text,uuid)',
       'EXECUTE'
     ) then
    v_failures := array_append(
      v_failures,
      'vault.create_secret ACL mismatch'
    );
  end if;

  if has_function_privilege(
       'anon',
       'vault.update_secret(uuid,text,text,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'vault.update_secret(uuid,text,text,text,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'vault.update_secret(uuid,text,text,text,uuid)',
       'EXECUTE'
     ) then
    v_failures := array_append(
      v_failures,
      'vault.update_secret ACL mismatch'
    );
  end if;

  if has_table_privilege(
       'anon',
       'vault.secrets',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'vault.secrets',
       'SELECT'
     )
     or not has_table_privilege(
       'service_role',
       'vault.secrets',
       'SELECT'
     ) then
    v_failures := array_append(
      v_failures,
      'vault.secrets SELECT ACL mismatch'
    );
  end if;

  if has_table_privilege(
       'anon',
       'vault.decrypted_secrets',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'vault.decrypted_secrets',
       'SELECT'
     )
     or not has_table_privilege(
       'service_role',
       'vault.decrypted_secrets',
       'SELECT'
     ) then
    v_failures := array_append(
      v_failures,
      'vault.decrypted_secrets SELECT ACL mismatch'
    );
  end if;

  -- -------------------------------------------------------------------------
  -- Existing private schema ACL must remain the frozen Stage 1 model.
  -- -------------------------------------------------------------------------

  if has_schema_privilege(
       'anon',
       'hotels_v2_private',
       'USAGE'
     )
     or not has_schema_privilege(
       'authenticated',
       'hotels_v2_private',
       'USAGE'
     )
     or has_schema_privilege(
       'service_role',
       'hotels_v2_private',
       'USAGE'
     ) then
    v_failures := array_append(
      v_failures,
      'hotels_v2_private USAGE ACL drift'
    );
  end if;

  if has_schema_privilege(
       'anon',
       'hotels_v2_private',
       'CREATE'
     )
     or has_schema_privilege(
       'authenticated',
       'hotels_v2_private',
       'CREATE'
     )
     or has_schema_privilege(
       'service_role',
       'hotels_v2_private',
       'CREATE'
     ) then
    v_failures := array_append(
      v_failures,
      'hotels_v2_private CREATE ACL drift'
    );
  end if;

  -- -------------------------------------------------------------------------
  -- Stage 2A must start completely inert.
  -- -------------------------------------------------------------------------

  if (select count(*) from public.site_settings) <> 1 then
    v_failures := array_append(
      v_failures,
      'site_settings cardinality must equal 1'
    );

  elsif not exists (
    select 1
    from public.site_settings
    where id = 1
      and not hotel_rooms_v2_enabled
      and not hotel_external_sync_enabled
      and not hotel_instant_booking_enabled
      and not hotel_stripe_connect_enabled
  ) then
    v_failures := array_append(
      v_failures,
      'Hotels V2 feature flags are not fully inert'
    );
  end if;

  if exists (
    select 1
    from public.hotel_calendar_source_configs
    where source_type <> 'manual'
      and is_enabled
  ) then
    v_failures := array_append(
      v_failures,
      'external calendar source already enabled'
    );
  end if;

  if exists (
    select 1
    from public.hotel_calendar_source_configs
    where source_type = 'ical'
      and configuration::text ~* 'https?://'
  ) then
    v_failures := array_append(
      v_failures,
      'iCal URL detected in public source configuration'
    );
  end if;

  -- -------------------------------------------------------------------------
  -- Migration 139 must not have been partially installed.
  -- -------------------------------------------------------------------------

  if to_regclass(
       'hotels_v2_private.hotel_external_calendar_source_secrets'
     ) is not null
     or to_regclass(
       'hotels_v2_private.hotel_external_calendar_sync_runs'
     ) is not null
     or to_regclass(
       'hotels_v2_private.hotel_external_calendar_source_state'
     ) is not null
     or to_regclass(
       'hotels_v2_private.hotel_external_calendar_events'
     ) is not null
     or to_regclass(
       'hotels_v2_private.hotel_external_calendar_day_blocks'
     ) is not null then
    v_failures := array_append(
      v_failures,
      'Stage 2A private runtime table already exists'
    );
  end if;

  if to_regprocedure(
       'public.hotel_v2_external_calendar_require_service_role()'
     ) is not null
     or to_regprocedure(
       'public.hotel_v2_admin_set_external_calendar_ical_secret(uuid,bigint,bigint,text)'
     ) is not null
     or to_regprocedure(
       'public.hotel_v2_admin_get_external_calendar_status(uuid)'
     ) is not null
     or to_regprocedure(
       'public.hotel_v2_external_calendar_worker_get_source(uuid)'
     ) is not null then
    v_failures := array_append(
      v_failures,
      'Stage 2A RPC already exists'
    );
  end if;

  if coalesce(array_length(v_failures, 1), 0) > 0 then
    raise exception using
      errcode = '55000',
      message =
        'HOTELS_V2_STAGE2A_PREFLIGHT_FAILED: '
        || array_to_string(v_failures, ' | ');
  end if;
end
$stage2a_preflight$;

select jsonb_build_object(
  'contract_version',
    'hotels_v2_stage2a_preflight_v1',

  'status',
    'PASS',

  'feature_flags_inert',
    true,

  'external_sources_enabled',
    (
      select count(*)
      from public.hotel_calendar_source_configs
      where source_type <> 'manual'
        and is_enabled
    ),

  'runtime_foundation_present',
    false,

  'vault_contract',
    'PASS',

  'private_schema_acl',
    'PASS'
) as hotels_v2_stage2a_preflight;

commit;
