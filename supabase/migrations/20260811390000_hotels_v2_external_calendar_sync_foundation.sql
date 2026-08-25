-- Hotels V2 Stage 2A: external calendar sync runtime foundation.
-- Inert by design:
-- - no external source is enabled,
-- - no Hotels V2 feature flag changes,
-- - no public availability changes,
-- - no legacy booking/pricing/payment row changes,
-- - no iCal URL is stored outside Supabase Vault.

begin;
set transaction isolation level repeatable read;
set local lock_timeout = '15s';
set local statement_timeout = '180s';

do $stage2a_preconditions$
begin
  if to_regclass('public.hotels') is null
     or to_regclass('public.hotel_room_types') is null
     or to_regclass('public.hotel_calendar_source_configs') is null
     or to_regclass('public.site_settings') is null
     or to_regnamespace('hotels_v2_private') is null
     or to_regclass('vault.secrets') is null
     or to_regclass('vault.decrypted_secrets') is null
     or to_regprocedure('vault.create_secret(text,text,text,uuid)') is null
     or to_regprocedure('vault.update_secret(uuid,text,text,text,uuid)') is null then
    raise exception using
      errcode = '55000',
      message = 'hotels_v2_external_calendar_foundation_dependencies_missing';
  end if;

  if not exists (
    select 1
    from pg_extension
    where extname = 'supabase_vault'
  ) then
    raise exception using
      errcode = '55000',
      message = 'hotels_v2_external_calendar_vault_extension_missing';
  end if;

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
    raise exception using
      errcode = '55000',
      message = 'hotels_v2_external_calendar_feature_flags_not_inert';
  end if;

  if to_regclass('hotels_v2_private.hotel_external_calendar_source_secrets') is not null
     or to_regclass('hotels_v2_private.hotel_external_calendar_sync_runs') is not null
     or to_regclass('hotels_v2_private.hotel_external_calendar_source_state') is not null
     or to_regclass('hotels_v2_private.hotel_external_calendar_events') is not null
     or to_regclass('hotels_v2_private.hotel_external_calendar_day_blocks') is not null then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_external_calendar_foundation_already_present';
  end if;
end
$stage2a_preconditions$;

create table hotels_v2_private.hotel_external_calendar_source_secrets (
  source_id uuid primary key
    references public.hotel_calendar_source_configs(id) on delete cascade,

  hotel_id uuid not null
    references public.hotels(id) on delete cascade,

  room_type_id uuid not null,

  vault_secret_id uuid not null unique,

  secret_kind text not null default 'ical_url',

  version bigint not null default 1,

  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),

  constraint hotel_external_calendar_source_secrets_room_hotel_fkey
    foreign key (room_type_id, hotel_id)
    references public.hotel_room_types(id, hotel_id)
    on delete restrict,

  constraint hotel_external_calendar_source_secrets_kind_check
    check (secret_kind = 'ical_url'),

  constraint hotel_external_calendar_source_secrets_version_check
    check (version > 0)
);

comment on table hotels_v2_private.hotel_external_calendar_source_secrets is
  'Private binding between an iCal calendar source and its Supabase Vault secret. Never stores the decrypted URL.';

create table hotels_v2_private.hotel_external_calendar_sync_runs (
  id uuid primary key default gen_random_uuid(),

  source_id uuid not null
    references public.hotel_calendar_source_configs(id) on delete cascade,

  hotel_id uuid not null
    references public.hotels(id) on delete cascade,

  room_type_id uuid not null,

  trigger_type text not null,
  status text not null,

  started_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,

  http_status smallint,

  content_fingerprint text,

  event_count integer,
  active_event_count integer,

  error_code text,
  error_message text,

  created_at timestamptz not null default clock_timestamp(),

  constraint hotel_external_calendar_sync_runs_room_hotel_fkey
    foreign key (room_type_id, hotel_id)
    references public.hotel_room_types(id, hotel_id)
    on delete restrict,

  constraint hotel_external_calendar_sync_runs_trigger_check
    check (trigger_type in (
      'manual_test',
      'manual',
      'scheduled',
      'retry'
    )),

  constraint hotel_external_calendar_sync_runs_status_check
    check (status in (
      'running',
      'succeeded',
      'failed',
      'skipped'
    )),

  constraint hotel_external_calendar_sync_runs_http_status_check
    check (http_status is null or http_status between 100 and 599),

  constraint hotel_external_calendar_sync_runs_fingerprint_check
    check (
      content_fingerprint is null
      or content_fingerprint ~ '^[0-9a-f]{64}$'
    ),

  constraint hotel_external_calendar_sync_runs_counts_check
    check (
      (event_count is null or event_count >= 0)
      and
      (active_event_count is null or active_event_count >= 0)
    ),

  constraint hotel_external_calendar_sync_runs_error_code_check
    check (
      error_code is null
      or (
        error_code = btrim(error_code)
        and length(error_code) between 1 and 120
        and error_code !~ '[[:cntrl:]]'
      )
    ),

  constraint hotel_external_calendar_sync_runs_error_message_check
    check (
      error_message is null
      or (
        error_message = btrim(error_message)
        and length(error_message) between 1 and 500
        and error_message !~ '[[:cntrl:]]'
      )
    )
);

create index hotel_external_calendar_sync_runs_source_idx
  on hotels_v2_private.hotel_external_calendar_sync_runs(
    source_id,
    started_at desc,
    id
  );

comment on table hotels_v2_private.hotel_external_calendar_sync_runs is
  'Private, PII-free execution history for external Hotel calendar synchronization. Raw ICS payloads are never persisted.';

create table hotels_v2_private.hotel_external_calendar_source_state (
  source_id uuid primary key
    references public.hotel_calendar_source_configs(id) on delete cascade,

  last_run_id uuid
    references hotels_v2_private.hotel_external_calendar_sync_runs(id)
    on delete set null,

  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  next_retry_at timestamptz,

  consecutive_failures integer not null default 0,

  last_content_fingerprint text,

  last_event_count integer not null default 0,
  last_active_event_count integer not null default 0,

  last_error_code text,
  last_error_message text,

  version bigint not null default 1,

  updated_at timestamptz not null default clock_timestamp(),

  constraint hotel_external_calendar_source_state_failure_count_check
    check (consecutive_failures >= 0),

  constraint hotel_external_calendar_source_state_event_counts_check
    check (
      last_event_count >= 0
      and last_active_event_count >= 0
    ),

  constraint hotel_external_calendar_source_state_fingerprint_check
    check (
      last_content_fingerprint is null
      or last_content_fingerprint ~ '^[0-9a-f]{64}$'
    ),

  constraint hotel_external_calendar_source_state_error_code_check
    check (
      last_error_code is null
      or (
        last_error_code = btrim(last_error_code)
        and length(last_error_code) between 1 and 120
        and last_error_code !~ '[[:cntrl:]]'
      )
    ),

  constraint hotel_external_calendar_source_state_error_message_check
    check (
      last_error_message is null
      or (
        last_error_message = btrim(last_error_message)
        and length(last_error_message) between 1 and 500
        and last_error_message !~ '[[:cntrl:]]'
      )
    ),

  constraint hotel_external_calendar_source_state_version_check
    check (version > 0)
);

comment on table hotels_v2_private.hotel_external_calendar_source_state is
  'Sanitizable runtime state for an external calendar source. Contains no calendar URL and no raw provider payload.';

create table hotels_v2_private.hotel_external_calendar_events (
  id uuid primary key default gen_random_uuid(),

  source_id uuid not null
    references public.hotel_calendar_source_configs(id) on delete cascade,

  hotel_id uuid not null
    references public.hotels(id) on delete cascade,

  room_type_id uuid not null,

  external_uid_hash text not null,
  recurrence_id_hash text,

  event_fingerprint text not null,

  starts_on date not null,
  ends_on date not null,

  event_status text not null default 'active',

  source_sequence integer,
  source_last_modified_at timestamptz,

  first_seen_run_id uuid not null
    references hotels_v2_private.hotel_external_calendar_sync_runs(id)
    on delete restrict,

  last_seen_run_id uuid not null
    references hotels_v2_private.hotel_external_calendar_sync_runs(id)
    on delete restrict,

  first_seen_at timestamptz not null default clock_timestamp(),
  last_seen_at timestamptz not null default clock_timestamp(),
  cancelled_at timestamptz,

  version bigint not null default 1,

  constraint hotel_external_calendar_events_room_hotel_fkey
    foreign key (room_type_id, hotel_id)
    references public.hotel_room_types(id, hotel_id)
    on delete restrict,

  constraint hotel_external_calendar_events_uid_hash_check
    check (external_uid_hash ~ '^[0-9a-f]{64}$'),

  constraint hotel_external_calendar_events_recurrence_hash_check
    check (
      recurrence_id_hash is null
      or recurrence_id_hash ~ '^[0-9a-f]{64}$'
    ),

  constraint hotel_external_calendar_events_fingerprint_check
    check (event_fingerprint ~ '^[0-9a-f]{64}$'),

  constraint hotel_external_calendar_events_dates_check
    check (ends_on > starts_on),

  constraint hotel_external_calendar_events_status_check
    check (event_status in ('active', 'cancelled')),

  constraint hotel_external_calendar_events_sequence_check
    check (source_sequence is null or source_sequence >= 0),

  constraint hotel_external_calendar_events_cancelled_check
    check (
      (event_status = 'active' and cancelled_at is null)
      or
      (event_status = 'cancelled' and cancelled_at is not null)
    ),

  constraint hotel_external_calendar_events_version_check
    check (version > 0),

  constraint hotel_external_calendar_events_exact_key
    unique (id, source_id, hotel_id, room_type_id)
);

create unique index hotel_external_calendar_events_source_uid_uidx
  on hotels_v2_private.hotel_external_calendar_events(
    source_id,
    external_uid_hash,
    coalesce(
      recurrence_id_hash,
      '0000000000000000000000000000000000000000000000000000000000000000'
    )
  );

create index hotel_external_calendar_events_room_dates_idx
  on hotels_v2_private.hotel_external_calendar_events(
    hotel_id,
    room_type_id,
    starts_on,
    ends_on
  )
  where event_status = 'active';

comment on table hotels_v2_private.hotel_external_calendar_events is
  'PII-minimized normalized external events. Provider UID and recurrence identity are stored only as SHA-256 hashes.';

create table hotels_v2_private.hotel_external_calendar_day_blocks (
  event_id uuid not null,

  source_id uuid not null,
  hotel_id uuid not null,
  room_type_id uuid not null,

  stay_date date not null,

  units_blocked integer not null default 1,

  is_active boolean not null default true,

  first_seen_run_id uuid not null
    references hotels_v2_private.hotel_external_calendar_sync_runs(id)
    on delete restrict,

  last_seen_run_id uuid not null
    references hotels_v2_private.hotel_external_calendar_sync_runs(id)
    on delete restrict,

  version bigint not null default 1,

  updated_at timestamptz not null default clock_timestamp(),

  primary key (event_id, stay_date),

  constraint hotel_external_calendar_day_blocks_event_fkey
    foreign key (event_id, source_id, hotel_id, room_type_id)
    references hotels_v2_private.hotel_external_calendar_events(
      id,
      source_id,
      hotel_id,
      room_type_id
    )
    on delete cascade,

  constraint hotel_external_calendar_day_blocks_units_check
    check (units_blocked > 0),

  constraint hotel_external_calendar_day_blocks_version_check
    check (version > 0)
);

create index hotel_external_calendar_day_blocks_room_day_idx
  on hotels_v2_private.hotel_external_calendar_day_blocks(
    hotel_id,
    room_type_id,
    stay_date,
    source_id
  )
  where is_active;

comment on table hotels_v2_private.hotel_external_calendar_day_blocks is
  'External-calendar Room Type day projection. Stage 2A does not consume this table in availability calculations.';

revoke all
  on table hotels_v2_private.hotel_external_calendar_source_secrets,
           hotels_v2_private.hotel_external_calendar_sync_runs,
           hotels_v2_private.hotel_external_calendar_source_state,
           hotels_v2_private.hotel_external_calendar_events,
           hotels_v2_private.hotel_external_calendar_day_blocks
  from public, anon, authenticated, service_role;


-- ---------------------------------------------------------------------------
-- Stage 2A controlled RPC boundary
-- ---------------------------------------------------------------------------

create function public.hotel_v2_external_calendar_require_service_role()
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_claims jsonb := '{}'::jsonb;
  v_role text;
begin
  begin
    v_claims :=
      coalesce(
        nullif(current_setting('request.jwt.claims', true), '')::jsonb,
        '{}'::jsonb
      );
  exception
    when others then
      v_claims := '{}'::jsonb;
  end;

  v_role := coalesce(
    v_claims->>'role',
    nullif(current_setting('request.jwt.claim.role', true), '')
  );

  if v_role is distinct from 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'hotels_v2_external_calendar_service_role_required';
  end if;
end
$function$;

revoke all
  on function public.hotel_v2_external_calendar_require_service_role()
  from public, anon, authenticated, service_role;

grant execute
  on function public.hotel_v2_external_calendar_require_service_role()
  to service_role;


create function public.hotel_v2_admin_set_external_calendar_ical_secret(
  p_source_id uuid,
  p_expected_source_version bigint,
  p_expected_binding_version bigint,
  p_ical_url text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_source public.hotel_calendar_source_configs%rowtype;
  v_binding hotels_v2_private.hotel_external_calendar_source_secrets%rowtype;

  v_url text;

  v_secret_id uuid;
  v_secret_name text;
  v_secret_description text;
  v_secret_key_id uuid;
begin
  perform public.hotel_v2_h2a_require_admin();

  if p_source_id is null
     or p_expected_source_version is null
     or p_expected_source_version <= 0
     or p_expected_binding_version is null
     or p_expected_binding_version < 0
     or p_ical_url is null then
    raise exception using
      errcode = '22023',
      message = 'hotels_v2_external_calendar_invalid_secret_request';
  end if;

  v_url := btrim(p_ical_url);

  if length(v_url) not between 12 and 4096
     or v_url !~ '^https://[^[:space:][:cntrl:]]+$' then
    raise exception using
      errcode = '22023',
      message = 'hotels_v2_external_calendar_invalid_ical_url';
  end if;

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
    raise exception using
      errcode = '55000',
      message = 'hotels_v2_external_calendar_secret_feature_flags_not_inert';
  end if;

  select *
  into v_source
  from public.hotel_calendar_source_configs
  where id = p_source_id
  for update;

  if not found then
    raise exception using
      errcode = 'PT404',
      message = 'hotels_v2_external_calendar_source_not_found';
  end if;

  if v_source.version <> p_expected_source_version then
    raise exception using
      errcode = 'PT409',
      message = 'hotels_v2_external_calendar_source_stale';
  end if;

  if v_source.source_type <> 'ical'
     or v_source.room_type_id is null
     or v_source.is_enabled then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_external_calendar_source_not_bindable';
  end if;

  if not exists (
    select 1
    from public.hotel_room_types room
    where room.id = v_source.room_type_id
      and room.hotel_id = v_source.hotel_id
  ) then
    raise exception using
      errcode = '23503',
      message = 'hotels_v2_external_calendar_source_room_mismatch';
  end if;

  select *
  into v_binding
  from hotels_v2_private.hotel_external_calendar_source_secrets
  where source_id = p_source_id
  for update;

  if not found then
    if p_expected_binding_version <> 0 then
      raise exception using
        errcode = 'PT409',
        message = 'hotels_v2_external_calendar_secret_binding_stale';
    end if;

    select vault.create_secret(
      v_url,
      'hotel-calendar-source-'
        || p_source_id::text
        || '-'
        || gen_random_uuid()::text,
      'Hotels V2 iCal calendar source '
        || p_source_id::text,
      null
    )
    into v_secret_id;

    if v_secret_id is null then
      raise exception using
        errcode = '55000',
        message = 'hotels_v2_external_calendar_vault_create_failed';
    end if;

    insert into hotels_v2_private.hotel_external_calendar_source_secrets (
      source_id,
      hotel_id,
      room_type_id,
      vault_secret_id,
      secret_kind
    )
    values (
      v_source.id,
      v_source.hotel_id,
      v_source.room_type_id,
      v_secret_id,
      'ical_url'
    )
    returning *
    into v_binding;

  else
    if v_binding.version <> p_expected_binding_version then
      raise exception using
        errcode = 'PT409',
        message = 'hotels_v2_external_calendar_secret_binding_stale';
    end if;

    if v_binding.hotel_id <> v_source.hotel_id
       or v_binding.room_type_id <> v_source.room_type_id then
      raise exception using
        errcode = '55000',
        message = 'hotels_v2_external_calendar_secret_binding_topology_mismatch';
    end if;

    select
      secret.name,
      secret.description,
      secret.key_id
    into
      v_secret_name,
      v_secret_description,
      v_secret_key_id
    from vault.secrets secret
    where secret.id = v_binding.vault_secret_id;

    if not found then
      raise exception using
        errcode = '55000',
        message = 'hotels_v2_external_calendar_vault_secret_missing';
    end if;

    perform vault.update_secret(
      v_binding.vault_secret_id,
      v_url,
      v_secret_name,
      v_secret_description,
      v_secret_key_id
    );

    update hotels_v2_private.hotel_external_calendar_source_secrets binding
    set
      version = binding.version + 1,
      updated_at = clock_timestamp()
    where binding.source_id = p_source_id
      and binding.version = p_expected_binding_version
    returning *
    into v_binding;

    if not found then
      raise exception using
        errcode = 'PT409',
        message = 'hotels_v2_external_calendar_secret_binding_stale';
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'source_id', v_source.id,
    'hotel_id', v_source.hotel_id,
    'room_type_id', v_source.room_type_id,
    'source_version', v_source.version,
    'binding_version', v_binding.version,
    'secret_configured', true
  );
end
$function$;

comment on function public.hotel_v2_admin_set_external_calendar_ical_secret(
  uuid,
  bigint,
  bigint,
  text
) is
  'Admin-only iCal secret create/rotation boundary. The decrypted URL is written only to Supabase Vault and is never returned. Stage 2A requires the external source to remain disabled.';

revoke all
  on function public.hotel_v2_admin_set_external_calendar_ical_secret(
    uuid,
    bigint,
    bigint,
    text
  )
  from public, anon, authenticated, service_role;

grant execute
  on function public.hotel_v2_admin_set_external_calendar_ical_secret(
    uuid,
    bigint,
    bigint,
    text
  )
  to authenticated;


create function public.hotel_v2_admin_get_external_calendar_status(
  p_hotel_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_result jsonb;
begin
  perform public.hotel_v2_h2a_require_admin();

  if p_hotel_id is null
     or not exists (
       select 1
       from public.hotels
       where id = p_hotel_id
     ) then
    raise exception using
      errcode = 'PT404',
      message = 'hotels_v2_external_calendar_property_not_found';
  end if;

  select jsonb_build_object(
    'contract_version',
      'hotels_v2_external_calendar_status_v1',

    'hotel_id',
      p_hotel_id,

    'hotel_external_sync_enabled',
      (
        select setting.hotel_external_sync_enabled
        from public.site_settings setting
        where setting.id = 1
      ),

    'sources',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', source.id,
              'hotel_id', source.hotel_id,
              'room_type_id', source.room_type_id,
              'code', source.code,
              'source_type', source.source_type,
              'external_reference', source.external_reference,
              'configuration', source.configuration,
              'is_enabled', source.is_enabled,
              'review_status', source.review_status,
              'priority', source.priority,
              'version', source.version,
              'updated_at', source.updated_at,

              'secret_configured',
                binding.source_id is not null,

              'binding_version',
                binding.version,

              'last_attempt_at',
                state.last_attempt_at,

              'last_success_at',
                state.last_success_at,

              'last_failure_at',
                state.last_failure_at,

              'next_retry_at',
                state.next_retry_at,

              'consecutive_failures',
                coalesce(state.consecutive_failures, 0),

              'last_event_count',
                coalesce(state.last_event_count, 0),

              'last_active_event_count',
                coalesce(state.last_active_event_count, 0),

              'last_error_code',
                state.last_error_code,

              'last_error_message',
                state.last_error_message,

              'state_version',
                state.version
            )
            order by
              source.room_type_id nulls first,
              source.priority desc,
              source.code,
              source.id
          )
          from public.hotel_calendar_source_configs source

          left join hotels_v2_private.hotel_external_calendar_source_secrets binding
            on binding.source_id = source.id

          left join hotels_v2_private.hotel_external_calendar_source_state state
            on state.source_id = source.id

          where source.hotel_id = p_hotel_id
            and source.source_type <> 'manual'
        ),
        '[]'::jsonb
      )
  )
  into v_result;

  return v_result;
end
$function$;

comment on function public.hotel_v2_admin_get_external_calendar_status(uuid) is
  'Admin-only sanitized external-calendar runtime status. Never returns Vault IDs, secret names, encrypted values or decrypted calendar URLs.';

revoke all
  on function public.hotel_v2_admin_get_external_calendar_status(uuid)
  from public, anon, authenticated, service_role;

grant execute
  on function public.hotel_v2_admin_get_external_calendar_status(uuid)
  to authenticated;


create function public.hotel_v2_external_calendar_worker_get_source(
  p_source_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_source public.hotel_calendar_source_configs%rowtype;
  v_binding hotels_v2_private.hotel_external_calendar_source_secrets%rowtype;
  v_decrypted_url text;
begin
  perform public.hotel_v2_external_calendar_require_service_role();

  if p_source_id is null then
    raise exception using
      errcode = '22023',
      message = 'hotels_v2_external_calendar_worker_invalid_source';
  end if;

  select *
  into v_source
  from public.hotel_calendar_source_configs
  where id = p_source_id;

  if not found then
    raise exception using
      errcode = 'PT404',
      message = 'hotels_v2_external_calendar_worker_source_not_found';
  end if;

  if v_source.source_type <> 'ical'
     or v_source.room_type_id is null then
    raise exception using
      errcode = '23514',
      message = 'hotels_v2_external_calendar_worker_source_not_supported';
  end if;

  select *
  into v_binding
  from hotels_v2_private.hotel_external_calendar_source_secrets
  where source_id = p_source_id;

  if not found then
    raise exception using
      errcode = '55000',
      message = 'hotels_v2_external_calendar_worker_secret_not_configured';
  end if;

  if v_binding.hotel_id <> v_source.hotel_id
     or v_binding.room_type_id <> v_source.room_type_id then
    raise exception using
      errcode = '55000',
      message = 'hotels_v2_external_calendar_worker_binding_topology_mismatch';
  end if;

  select secret.decrypted_secret
  into v_decrypted_url
  from vault.decrypted_secrets secret
  where secret.id = v_binding.vault_secret_id;

  if not found
     or v_decrypted_url is null
     or length(btrim(v_decrypted_url)) = 0 then
    raise exception using
      errcode = '55000',
      message = 'hotels_v2_external_calendar_worker_vault_secret_unavailable';
  end if;

  return jsonb_build_object(
    'contract_version',
      'hotels_v2_external_calendar_worker_source_v1',

    'source_id',
      v_source.id,

    'hotel_id',
      v_source.hotel_id,

    'room_type_id',
      v_source.room_type_id,

    'source_type',
      v_source.source_type,

    'source_version',
      v_source.version,

    'binding_version',
      v_binding.version,

    'is_enabled',
      v_source.is_enabled,

    'review_status',
      v_source.review_status,

    'hotel_external_sync_enabled',
      (
        select setting.hotel_external_sync_enabled
        from public.site_settings setting
        where setting.id = 1
      ),

    'ical_url',
      v_decrypted_url
  );
end
$function$;

comment on function public.hotel_v2_external_calendar_worker_get_source(uuid) is
  'Trusted-worker-only source contract. This is the only Stage 2A RPC that may return the decrypted iCal URL, and EXECUTE is restricted to service_role.';

revoke all
  on function public.hotel_v2_external_calendar_worker_get_source(uuid)
  from public, anon, authenticated, service_role;

grant execute
  on function public.hotel_v2_external_calendar_worker_get_source(uuid)
  to service_role;


-- Stage 2A must remain fully inert.
do $stage2a_postconditions$
begin
  if exists (
    select 1
    from public.site_settings
    where hotel_rooms_v2_enabled
       or hotel_external_sync_enabled
       or hotel_instant_booking_enabled
       or hotel_stripe_connect_enabled
  ) then
    raise exception using
      errcode = '55000',
      message = 'hotels_v2_external_calendar_foundation_changed_feature_flags';
  end if;

  if exists (
    select 1
    from public.hotel_calendar_source_configs
    where source_type <> 'manual'
      and is_enabled
  ) then
    raise exception using
      errcode = '55000',
      message = 'hotels_v2_external_calendar_foundation_enabled_external_source';
  end if;

  if exists (
    select 1
    from hotels_v2_private.hotel_external_calendar_source_secrets
  )
  or exists (
    select 1
    from hotels_v2_private.hotel_external_calendar_sync_runs
  )
  or exists (
    select 1
    from hotels_v2_private.hotel_external_calendar_source_state
  )
  or exists (
    select 1
    from hotels_v2_private.hotel_external_calendar_events
  )
  or exists (
    select 1
    from hotels_v2_private.hotel_external_calendar_day_blocks
  ) then
    raise exception using
      errcode = '55000',
      message = 'hotels_v2_external_calendar_foundation_seeded_runtime_rows';
  end if;
end
$stage2a_postconditions$;

commit;
