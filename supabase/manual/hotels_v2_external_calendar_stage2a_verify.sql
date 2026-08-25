-- Hotels V2 Stage 2A
-- POST-MIGRATION verifier for migration 139.
-- READ ONLY by design.

begin;
set transaction read only;
set local statement_timeout = '60s';

do $stage2a_verify$
declare
  v_failures text[] := array[]::text[];

  v_table text;
  v_role text;
  v_has_rows boolean;

  v_source text;
begin
  -- -------------------------------------------------------------------------
  -- Runtime objects must exist.
  -- -------------------------------------------------------------------------

  foreach v_table in array array[
    'hotel_external_calendar_source_secrets',
    'hotel_external_calendar_sync_runs',
    'hotel_external_calendar_source_state',
    'hotel_external_calendar_events',
    'hotel_external_calendar_day_blocks'
  ]
  loop
    if to_regclass(
      format('hotels_v2_private.%I', v_table)
    ) is null then
      v_failures := array_append(
        v_failures,
        'missing runtime table: ' || v_table
      );
    end if;
  end loop;

  if to_regprocedure(
       'public.hotel_v2_external_calendar_require_service_role()'
     ) is null then
    v_failures := array_append(
      v_failures,
      'missing service-role guard RPC'
    );
  end if;

  if to_regprocedure(
       'public.hotel_v2_admin_set_external_calendar_ical_secret(uuid,bigint,bigint,text)'
     ) is null then
    v_failures := array_append(
      v_failures,
      'missing admin iCal secret RPC'
    );
  end if;

  if to_regprocedure(
       'public.hotel_v2_admin_get_external_calendar_status(uuid)'
     ) is null then
    v_failures := array_append(
      v_failures,
      'missing sanitized admin status RPC'
    );
  end if;

  if to_regprocedure(
       'public.hotel_v2_external_calendar_worker_get_source(uuid)'
     ) is null then
    v_failures := array_append(
      v_failures,
      'missing service-role worker RPC'
    );
  end if;

  -- -------------------------------------------------------------------------
  -- Migration must not seed runtime data.
  -- -------------------------------------------------------------------------

  foreach v_table in array array[
    'hotel_external_calendar_source_secrets',
    'hotel_external_calendar_sync_runs',
    'hotel_external_calendar_source_state',
    'hotel_external_calendar_events',
    'hotel_external_calendar_day_blocks'
  ]
  loop
    if to_regclass(
      format('hotels_v2_private.%I', v_table)
    ) is not null then

      execute format(
        'select exists (
           select 1
           from hotels_v2_private.%I
           limit 1
         )',
        v_table
      )
      into v_has_rows;

      if v_has_rows then
        v_failures := array_append(
          v_failures,
          'runtime table unexpectedly seeded: ' || v_table
        );
      end if;
    end if;
  end loop;

  -- -------------------------------------------------------------------------
  -- No browser/service-role direct table access.
  -- -------------------------------------------------------------------------

  foreach v_table in array array[
    'hotel_external_calendar_source_secrets',
    'hotel_external_calendar_sync_runs',
    'hotel_external_calendar_source_state',
    'hotel_external_calendar_events',
    'hotel_external_calendar_day_blocks'
  ]
  loop
    if to_regclass(
      format('hotels_v2_private.%I', v_table)
    ) is not null then

      foreach v_role in array array[
        'anon',
        'authenticated',
        'service_role'
      ]
      loop
        if has_table_privilege(
             v_role,
             format('hotels_v2_private.%I', v_table),
             'SELECT'
           )
           or has_table_privilege(
             v_role,
             format('hotels_v2_private.%I', v_table),
             'INSERT'
           )
           or has_table_privilege(
             v_role,
             format('hotels_v2_private.%I', v_table),
             'UPDATE'
           )
           or has_table_privilege(
             v_role,
             format('hotels_v2_private.%I', v_table),
             'DELETE'
           ) then
          v_failures := array_append(
            v_failures,
            'direct table privilege detected: '
            || v_role
            || ' -> '
            || v_table
          );
        end if;
      end loop;
    end if;
  end loop;

  -- Existing private schema ACL must remain unchanged.
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
      'hotels_v2_private USAGE ACL changed'
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
      'hotels_v2_private CREATE ACL changed'
    );
  end if;

  -- -------------------------------------------------------------------------
  -- Function security-definer contract.
  -- -------------------------------------------------------------------------

  if not coalesce((
    select procedure_info.prosecdef
    from pg_proc procedure_info
    where procedure_info.oid =
      to_regprocedure(
        'public.hotel_v2_external_calendar_require_service_role()'
      )
  ), false) then
    v_failures := array_append(
      v_failures,
      'service-role guard is not SECURITY DEFINER'
    );
  end if;

  if not coalesce((
    select procedure_info.prosecdef
    from pg_proc procedure_info
    where procedure_info.oid =
      to_regprocedure(
        'public.hotel_v2_admin_set_external_calendar_ical_secret(uuid,bigint,bigint,text)'
      )
  ), false) then
    v_failures := array_append(
      v_failures,
      'admin secret RPC is not SECURITY DEFINER'
    );
  end if;

  if not coalesce((
    select procedure_info.prosecdef
    from pg_proc procedure_info
    where procedure_info.oid =
      to_regprocedure(
        'public.hotel_v2_admin_get_external_calendar_status(uuid)'
      )
  ), false) then
    v_failures := array_append(
      v_failures,
      'admin status RPC is not SECURITY DEFINER'
    );
  end if;

  if not coalesce((
    select procedure_info.prosecdef
    from pg_proc procedure_info
    where procedure_info.oid =
      to_regprocedure(
        'public.hotel_v2_external_calendar_worker_get_source(uuid)'
      )
  ), false) then
    v_failures := array_append(
      v_failures,
      'worker RPC is not SECURITY DEFINER'
    );
  end if;

  -- Every controlled function must pin its search_path.
  if exists (
    select 1
    from pg_proc procedure_info
    where procedure_info.oid in (
      to_regprocedure(
        'public.hotel_v2_external_calendar_require_service_role()'
      ),
      to_regprocedure(
        'public.hotel_v2_admin_set_external_calendar_ical_secret(uuid,bigint,bigint,text)'
      ),
      to_regprocedure(
        'public.hotel_v2_admin_get_external_calendar_status(uuid)'
      ),
      to_regprocedure(
        'public.hotel_v2_external_calendar_worker_get_source(uuid)'
      )
    )
    and not exists (
      select 1
      from unnest(
        coalesce(
          procedure_info.proconfig,
          array[]::text[]
        )
      ) config_value
      where config_value like 'search_path=%'
    )
  ) then
    v_failures := array_append(
      v_failures,
      'controlled RPC without pinned search_path'
    );
  end if;

  -- -------------------------------------------------------------------------
  -- Exact EXECUTE boundary.
  -- -------------------------------------------------------------------------

  if has_function_privilege(
       'anon',
       'public.hotel_v2_external_calendar_require_service_role()',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.hotel_v2_external_calendar_require_service_role()',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.hotel_v2_external_calendar_require_service_role()',
       'EXECUTE'
     ) then
    v_failures := array_append(
      v_failures,
      'service-role guard EXECUTE ACL mismatch'
    );
  end if;

  if has_function_privilege(
       'anon',
       'public.hotel_v2_admin_set_external_calendar_ical_secret(uuid,bigint,bigint,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.hotel_v2_admin_set_external_calendar_ical_secret(uuid,bigint,bigint,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.hotel_v2_admin_set_external_calendar_ical_secret(uuid,bigint,bigint,text)',
       'EXECUTE'
     ) then
    v_failures := array_append(
      v_failures,
      'admin secret RPC EXECUTE ACL mismatch'
    );
  end if;

  if has_function_privilege(
       'anon',
       'public.hotel_v2_admin_get_external_calendar_status(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.hotel_v2_admin_get_external_calendar_status(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.hotel_v2_admin_get_external_calendar_status(uuid)',
       'EXECUTE'
     ) then
    v_failures := array_append(
      v_failures,
      'admin status RPC EXECUTE ACL mismatch'
    );
  end if;

  if has_function_privilege(
       'anon',
       'public.hotel_v2_external_calendar_worker_get_source(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.hotel_v2_external_calendar_worker_get_source(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.hotel_v2_external_calendar_worker_get_source(uuid)',
       'EXECUTE'
     ) then
    v_failures := array_append(
      v_failures,
      'worker RPC EXECUTE ACL mismatch'
    );
  end if;

  -- -------------------------------------------------------------------------
  -- Source-code security boundary.
  -- -------------------------------------------------------------------------

  select procedure_info.prosrc
  into v_source
  from pg_proc procedure_info
  where procedure_info.oid =
    to_regprocedure(
      'public.hotel_v2_external_calendar_require_service_role()'
    );

  if v_source is null
     or v_source not like '%service_role%' then
    v_failures := array_append(
      v_failures,
      'service-role JWT guard missing'
    );
  end if;

  select procedure_info.prosrc
  into v_source
  from pg_proc procedure_info
  where procedure_info.oid =
    to_regprocedure(
      'public.hotel_v2_admin_set_external_calendar_ical_secret(uuid,bigint,bigint,text)'
    );

  if v_source is null
     or v_source not like
       '%perform public.hotel_v2_h2a_require_admin();%' then
    v_failures := array_append(
      v_failures,
      'admin secret RPC admin guard missing'
    );
  end if;

  if v_source is not null
     and v_source ~* 'vault[.]decrypted_secrets' then
    v_failures := array_append(
      v_failures,
      'admin secret RPC reads decrypted Vault'
    );
  end if;

  if v_source is not null
     and v_source ~*
       'return[[:space:]]+jsonb_build_object[[:space:]]*\([^;]*''ical_url''' then
    v_failures := array_append(
      v_failures,
      'admin secret RPC returns iCal URL'
    );
  end if;

  select procedure_info.prosrc
  into v_source
  from pg_proc procedure_info
  where procedure_info.oid =
    to_regprocedure(
      'public.hotel_v2_admin_get_external_calendar_status(uuid)'
    );

  if v_source is null
     or v_source not like
       '%perform public.hotel_v2_h2a_require_admin();%' then
    v_failures := array_append(
      v_failures,
      'admin status RPC admin guard missing'
    );
  end if;

  if v_source is not null
     and v_source ~* 'vault[.]' then
    v_failures := array_append(
      v_failures,
      'admin status RPC touches Vault'
    );
  end if;

  select procedure_info.prosrc
  into v_source
  from pg_proc procedure_info
  where procedure_info.oid =
    to_regprocedure(
      'public.hotel_v2_external_calendar_worker_get_source(uuid)'
    );

  if v_source is null
     or v_source not like
       '%perform public.hotel_v2_external_calendar_require_service_role();%'
     or v_source not like
       '%vault.decrypted_secrets%'
     or v_source not like
       '%decrypted_secret%'
     or v_source not like
       '%' || quote_literal('ical_url') || '%' then
    v_failures := array_append(
      v_failures,
      'worker secret boundary contract mismatch'
    );
  end if;

  -- -------------------------------------------------------------------------
  -- Vault browser ACL must remain untouched.
  -- -------------------------------------------------------------------------

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
      'vault.secrets ACL changed'
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
      'vault.decrypted_secrets ACL changed'
    );
  end if;

  -- -------------------------------------------------------------------------
  -- Stage 2A must STILL be fully inert after installation.
  -- -------------------------------------------------------------------------

  if (select count(*) from public.site_settings) <> 1
     or not exists (
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
      'Hotels V2 feature flags changed'
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
      'external source became enabled'
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
      'iCal URL present in public source configuration'
    );
  end if;

  if coalesce(array_length(v_failures, 1), 0) > 0 then
    raise exception using
      errcode = '55000',
      message =
        'HOTELS_V2_STAGE2A_VERIFY_FAILED: '
        || array_to_string(v_failures, ' | ');
  end if;
end
$stage2a_verify$;

select jsonb_build_object(
  'contract_version',
    'hotels_v2_stage2a_verify_v1',

  'status',
    'PASS',

  'runtime_tables',
    5,

  'runtime_rows_seeded',
    false,

  'direct_runtime_access',
    false,

  'admin_secret_boundary',
    'PASS',

  'admin_status_boundary',
    'PASS',

  'worker_service_role_boundary',
    'PASS',

  'vault_acl',
    'PASS',

  'availability_effect',
    'NONE',

  'feature_flags_inert',
    true
) as hotels_v2_stage2a_verify;

commit;
