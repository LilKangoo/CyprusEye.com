\set ON_ERROR_STOP on
\if :{?provider_install_external_enabled}
\else
\set provider_install_external_enabled true
\endif
\if :{?provider_booking_only}
\else
\set provider_booking_only false
\endif
-- Install the complete accepted pricing/application chain.  The nested gate
-- performs the real 114400 activation, then installs 114405/114410/114415/
-- 114420 and proves the accepted receipt/parity/booking lineage.
\if :{?provider_use_preinstalled_accepted_chain}
\ir ../../supabase/manual/hotels_v2_external_calendar_site_settings_compatibility_verify.sql
-- The full-chain gate normally leaves this focused 114415 item constructor in
-- pg_temp.  Recreate the exact helper when the disposable fixture starts from
-- the already-accepted through-114425 template instead of replaying that gate.
create function pg_temp.reviewed_pricing_item(
  p_room_key text,p_guest_count integer,p_minimum_nights integer,p_delta numeric
) returns jsonb language sql stable security definer
set search_path=pg_catalog,public as $function$
select jsonb_build_object(
  'hotel_id',authority.hotel_id,
  'room_type_id',authority.room_type_id,
  'room_rate_id',authority.room_rate_id,
  'pricing_schedule_id',authority.independent_schedule_id,
  'schedule_tier_id',authority.target_tier_id,
  'guest_count',authority.guest_count,
  'minimum_nights',authority.threshold_nights,
  'currency',authority.currency,
  'before_price',authority.current_nightly_rate,
  'requested_price',authority.current_nightly_rate+p_delta)
from public.hotel_seven_arches_independent_pricing_authority authority
where authority.room_key=p_room_key
  and authority.guest_count=p_guest_count
  and authority.threshold_nights=p_minimum_nights;
$function$;
\else
\ir hotels-v2-seven-arches-application-pricing-bridge-postgres-gate.sql

\ir ../../supabase/manual/hotels_v2_external_calendar_site_settings_compatibility_preflight.sql
\ir ../../supabase/migrations/20260811442500_hotels_v2_external_calendar_site_settings_compatibility.sql
\ir ../../supabase/manual/hotels_v2_external_calendar_site_settings_compatibility_verify.sql
\endif

begin;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000008"}',true);
do $pre_provider_capability_boundary$
declare v_control jsonb;
begin
  v_control:=public.hotel_v2_admin_get_external_calendar_control(
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca');
  if v_control->>'contract_version'<>'hotels_v2_external_calendar_control_v1'
     or v_control?'provider_capability' then
    raise exception 'seven_arches_pre_provider_capability_boundary_failed:%',v_control;
  end if;
end
$pre_provider_capability_boundary$;
rollback;

\if :provider_install_external_enabled
do $site_settings_on$
begin
  if not (select hotel_external_sync_enabled from public.site_settings where id=1)
     or public.hotel_v2_external_calendar_site_settings_fingerprint() is null
     or not public.hotel_v2_partner_workspace_function_lineage_is_exact() then
    raise exception 'seven_arches_provider_on_site_settings_seam_failed';
  end if;
end
$site_settings_on$;
\else
do $site_settings_off$
begin
  if (select hotel_external_sync_enabled from public.site_settings where id=1)
     or public.hotel_v2_external_calendar_site_settings_fingerprint() is null
     or not public.hotel_v2_partner_workspace_function_lineage_is_exact() then
    raise exception 'seven_arches_provider_off_site_settings_seam_failed';
  end if;
end
$site_settings_off$;
\endif

-- Bind only non-secret Vault identity/version metadata.  The gate deliberately
-- never reads or hashes either worker secret value.
create temp table seven_arches_provider_worker_secrets_before
on commit preserve rows as
select secret.id,secret.name,secret.created_at,secret.updated_at
from vault.secrets secret
where secret.name in('hotels-v2-external-calendar-worker-url',
  'hotels-v2-external-calendar-worker-shared-secret');

\ir ../../supabase/manual/hotels_v2_external_calendar_provider_types_preflight.sql
\ir ../../supabase/migrations/20260811445000_hotels_v2_external_calendar_provider_types.sql

do $provider_worker_secret_immutability$
begin
  if ((select count(*) from seven_arches_provider_worker_secrets_before)<>
       (case when (select hotel_external_sync_enabled from public.site_settings where id=1)
         then 2 else 0 end))
     or exists(select 1 from seven_arches_provider_worker_secrets_before before_secret
       full join (select secret.id,secret.name,secret.created_at,secret.updated_at
         from vault.secrets secret
         where secret.name in('hotels-v2-external-calendar-worker-url',
           'hotels-v2-external-calendar-worker-shared-secret')) current_secret
       using(id,name,created_at,updated_at)
       where before_secret.id is null or current_secret.id is null) then
    raise exception using errcode='55000',
      message='seven_arches_provider_worker_secret_metadata_mutation_detected';
  end if;
end
$provider_worker_secret_immutability$;

do $provider_timezone_stability$
declare
  v_incoming text:=current_setting('TimeZone');
  v_nicosia jsonb;
  v_utc jsonb;
begin
  perform set_config('TimeZone','Asia/Nicosia',true);
  select jsonb_build_object(
    'historical_property_raw',
      receipt.historical_property_site_settings_raw_fingerprint,
    'historical_stage2_raw',
      receipt.historical_stage2_site_settings_raw_fingerprint,
    'canonical_lifecycle',receipt.canonical_site_settings_lifecycle_fingerprint,
    'canonical_helper_source',receipt.canonical_site_settings_helper_source_hash,
    'activation_receipt',receipt.site_settings_activation_receipt_fingerprint,
    'receipt_hash',receipt.receipt_hash,
    'activation_receipt_exact',receipt.site_settings_activation_receipt_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(jsonb_set(
        to_jsonb(site_activation),'{created_at}',to_jsonb(
          (extract(epoch from site_activation.created_at)*1000000)::bigint),false)),
    'receipt_self_exact',receipt.receipt_hash=
      public.hotel_v2_external_calendar_worker_hash(jsonb_set(
        to_jsonb(receipt)-'receipt_hash','{created_at}',to_jsonb(
          (extract(epoch from receipt.created_at)*1000000)::bigint),false)),
    'helper_sources',receipt.fingerprint_helper_source_hashes,
    'prior_compatible',receipt.prior_compatible_fingerprint,
    'manual_source',receipt.manual_source_fingerprint,
    'evolved_protected',receipt.evolved_protected_fingerprint,
    'prior_catalog',receipt.prior_reviewed_pricing_catalog_fingerprint,
    'evolved_catalog',receipt.evolved_reviewed_pricing_catalog_fingerprint,
    'function_sources',receipt.evolved_function_source_hashes)
    into strict v_nicosia
  from hotels_v2_private.hotel_external_calendar_provider_evolution_receipts receipt
  join hotels_v2_private.hotel_external_calendar_activation_receipts site_activation
    on site_activation.id=receipt.id
  where receipt.id=1;

  perform set_config('TimeZone','UTC',true);
  select jsonb_build_object(
    'historical_property_raw',
      receipt.historical_property_site_settings_raw_fingerprint,
    'historical_stage2_raw',
      receipt.historical_stage2_site_settings_raw_fingerprint,
    'canonical_lifecycle',receipt.canonical_site_settings_lifecycle_fingerprint,
    'canonical_helper_source',receipt.canonical_site_settings_helper_source_hash,
    'activation_receipt',receipt.site_settings_activation_receipt_fingerprint,
    'receipt_hash',receipt.receipt_hash,
    'activation_receipt_exact',receipt.site_settings_activation_receipt_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(jsonb_set(
        to_jsonb(site_activation),'{created_at}',to_jsonb(
          (extract(epoch from site_activation.created_at)*1000000)::bigint),false)),
    'receipt_self_exact',receipt.receipt_hash=
      public.hotel_v2_external_calendar_worker_hash(jsonb_set(
        to_jsonb(receipt)-'receipt_hash','{created_at}',to_jsonb(
          (extract(epoch from receipt.created_at)*1000000)::bigint),false)),
    'helper_sources',receipt.fingerprint_helper_source_hashes,
    'prior_compatible',receipt.prior_compatible_fingerprint,
    'manual_source',receipt.manual_source_fingerprint,
    'evolved_protected',receipt.evolved_protected_fingerprint,
    'prior_catalog',receipt.prior_reviewed_pricing_catalog_fingerprint,
    'evolved_catalog',receipt.evolved_reviewed_pricing_catalog_fingerprint,
    'function_sources',receipt.evolved_function_source_hashes)
    into strict v_utc
  from hotels_v2_private.hotel_external_calendar_provider_evolution_receipts receipt
  join hotels_v2_private.hotel_external_calendar_activation_receipts site_activation
    on site_activation.id=receipt.id
  where receipt.id=1;

  perform set_config('TimeZone',v_incoming,true);
  if v_nicosia is distinct from v_utc
     or (v_nicosia->>'activation_receipt_exact')::boolean is not true
     or (v_nicosia->>'receipt_self_exact')::boolean is not true
     or current_setting('TimeZone')<>v_incoming then
    raise exception using errcode='55000',
      message='seven_arches_provider_timezone_stability_failed',
      detail=jsonb_build_object('nicosia',v_nicosia,'utc',v_utc)::text;
  end if;
end
$provider_timezone_stability$;

-- The provider boundary must preserve the 114410 representation bridge: the
-- mutable whole-row fingerprint follows the live row, while the canonical
-- Hotels lifecycle fingerprint deliberately ignores unrelated metadata.
do $provider_site_settings_representation_positives$
declare
  c_canonical constant text:=
    '9d385718586ec03664878d35552e73373bd2e4dca170dc497025fc6780c79bf5';
  v_raw_before text;
  v_raw_after text;
  v_message text;
  v_passed integer:=0;
begin
  v_raw_before:=md5(pg_catalog.query_to_xml($query$
    select to_jsonb(row_value)::text
    from public.site_settings row_value
    order by to_jsonb(row_value)::text$query$,true,true,'')::text);
  if public.hotel_v2_external_calendar_site_settings_fingerprint()
       is distinct from c_canonical
     or public.hotel_v2_h3_2b_protected_fingerprints()->>'site_settings'
       is distinct from v_raw_before
     or public.hotel_v2_external_calendar_stage2_compatible_fingerprints()
          ->>'site_settings' is distinct from v_raw_before
     or public.hotel_v2_external_calendar_provider_protected_fingerprints()
          ->>'site_settings' is distinct from c_canonical then
    raise exception 'seven_arches_provider_site_settings_bridge_baseline_failed';
  end if;

  -- A: cache-refresh metadata changes the raw representation but not the
  -- canonical lifecycle or any provider-lineage verdict.
  begin
    if not exists(select 1 from information_schema.columns
        where table_schema='public' and table_name='site_settings'
          and column_name='force_refresh_version') then
      alter table public.site_settings
        add column force_refresh_version bigint not null default 0;
    end if;
    update public.site_settings
    set force_refresh_version=force_refresh_version+1
    where id=1;
    v_raw_after:=md5(pg_catalog.query_to_xml($query$
      select to_jsonb(row_value)::text
      from public.site_settings row_value
      order by to_jsonb(row_value)::text$query$,true,true,'')::text);
    if v_raw_after is not distinct from v_raw_before
       or public.hotel_v2_external_calendar_site_settings_fingerprint()
         is distinct from c_canonical
       or public.hotel_v2_h3_2b_protected_fingerprints()->>'site_settings'
         is distinct from v_raw_after
       or public.hotel_v2_external_calendar_stage2_compatible_fingerprints()
            ->>'site_settings' is distinct from v_raw_after
       or public.hotel_v2_external_calendar_provider_protected_fingerprints()
            ->>'site_settings' is distinct from c_canonical
       or not public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_force_refresh_bridge_failed';
    end if;
    raise exception 'seven_arches_provider_force_refresh_bridge_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    if v_message<>'seven_arches_provider_force_refresh_bridge_rollback' then
      raise;
    end if;
    v_passed:=v_passed+1;
  end;

  -- B: audit timestamps/actor metadata are likewise raw-row evidence only.
  begin
    if not exists(select 1 from information_schema.columns
        where table_schema='public' and table_name='site_settings'
          and column_name='updated_at') then
      alter table public.site_settings add column updated_at timestamptz;
    end if;
    if not exists(select 1 from information_schema.columns
        where table_schema='public' and table_name='site_settings'
          and column_name='updated_by') then
      alter table public.site_settings add column updated_by uuid;
    end if;
    update public.site_settings
    set updated_at=clock_timestamp()+interval '1 day',
        updated_by='10000000-0000-4000-8000-000000000008'::uuid
    where id=1;
    v_raw_after:=md5(pg_catalog.query_to_xml($query$
      select to_jsonb(row_value)::text
      from public.site_settings row_value
      order by to_jsonb(row_value)::text$query$,true,true,'')::text);
    if v_raw_after is not distinct from v_raw_before
       or public.hotel_v2_external_calendar_site_settings_fingerprint()
         is distinct from c_canonical
       or public.hotel_v2_h3_2b_protected_fingerprints()->>'site_settings'
         is distinct from v_raw_after
       or public.hotel_v2_external_calendar_stage2_compatible_fingerprints()
            ->>'site_settings' is distinct from v_raw_after
       or public.hotel_v2_external_calendar_provider_protected_fingerprints()
            ->>'site_settings' is distinct from c_canonical
       or not public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_audit_metadata_bridge_failed';
    end if;
    raise exception 'seven_arches_provider_audit_metadata_bridge_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    if v_message<>'seven_arches_provider_audit_metadata_bridge_rollback' then
      raise;
    end if;
    v_passed:=v_passed+1;
  end;

  -- C: an unrelated car lifecycle flag is not part of the Hotels lifecycle.
  begin
    if not exists(select 1 from information_schema.columns
        where table_schema='public' and table_name='site_settings'
          and column_name='car_multi_city_mapped_enabled') then
      alter table public.site_settings
        add column car_multi_city_mapped_enabled boolean not null default false;
    end if;
    update public.site_settings
    set car_multi_city_mapped_enabled=not car_multi_city_mapped_enabled
    where id=1;
    v_raw_after:=md5(pg_catalog.query_to_xml($query$
      select to_jsonb(row_value)::text
      from public.site_settings row_value
      order by to_jsonb(row_value)::text$query$,true,true,'')::text);
    if v_raw_after is not distinct from v_raw_before
       or public.hotel_v2_external_calendar_site_settings_fingerprint()
         is distinct from c_canonical
       or public.hotel_v2_h3_2b_protected_fingerprints()->>'site_settings'
         is distinct from v_raw_after
       or public.hotel_v2_external_calendar_stage2_compatible_fingerprints()
            ->>'site_settings' is distinct from v_raw_after
       or public.hotel_v2_external_calendar_provider_protected_fingerprints()
            ->>'site_settings' is distinct from c_canonical
       or not public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_car_flag_bridge_failed';
    end if;
    raise exception 'seven_arches_provider_car_flag_bridge_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    if v_message<>'seven_arches_provider_car_flag_bridge_rollback' then
      raise;
    end if;
    v_passed:=v_passed+1;
  end;

  -- D: the unrelated daily-rate threshold flag is independently ignored.
  begin
    if not exists(select 1 from information_schema.columns
        where table_schema='public' and table_name='site_settings'
          and column_name='car_threshold_daily_rates_enabled') then
      alter table public.site_settings
        add column car_threshold_daily_rates_enabled boolean not null default false;
    end if;
    update public.site_settings
    set car_threshold_daily_rates_enabled=not car_threshold_daily_rates_enabled
    where id=1;
    v_raw_after:=md5(pg_catalog.query_to_xml($query$
      select to_jsonb(row_value)::text
      from public.site_settings row_value
      order by to_jsonb(row_value)::text$query$,true,true,'')::text);
    if v_raw_after is not distinct from v_raw_before
       or public.hotel_v2_external_calendar_site_settings_fingerprint()
         is distinct from c_canonical
       or public.hotel_v2_h3_2b_protected_fingerprints()->>'site_settings'
         is distinct from v_raw_after
       or public.hotel_v2_external_calendar_stage2_compatible_fingerprints()
            ->>'site_settings' is distinct from v_raw_after
       or public.hotel_v2_external_calendar_provider_protected_fingerprints()
            ->>'site_settings' is distinct from c_canonical
       or not public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_car_threshold_bridge_failed';
    end if;
    raise exception 'seven_arches_provider_car_threshold_bridge_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    if v_message<>'seven_arches_provider_car_threshold_bridge_rollback' then
      raise;
    end if;
    v_passed:=v_passed+1;
  end;

  if v_passed<>4
     or public.hotel_v2_external_calendar_site_settings_fingerprint()
       is distinct from c_canonical
     or not public.hotel_v2_external_calendar_provider_evolution_is_safe() then
    raise exception 'seven_arches_provider_site_settings_bridge_positive_count_failed:%',
      v_passed;
  end if;
end
$provider_site_settings_representation_positives$;

-- Fail-closed representation checks. Each probe is its own exception
-- subtransaction, so even DDL metadata drift is restored before continuing.
do $provider_site_settings_representation_negatives$
declare
  v_message text;
  v_constraint text;
  v_passed integer:=0;
  v_definition text;
  v_needle text;
begin
  -- A: cardinality greater than one is not a supported lifecycle row set.
  begin
    insert into public.site_settings(id) values(2);
    if public.hotel_v2_external_calendar_site_settings_fingerprint() is not null
       or public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_site_settings_extra_row_accepted';
    end if;
    raise exception 'seven_arches_provider_site_settings_extra_row_rollback';
  exception
    when check_violation then
      get stacked diagnostics v_message=message_text,v_constraint=constraint_name;
      if v_constraint<>'site_settings_id_check'
         or v_message not like 'new row for relation "site_settings" violates check constraint%' then
        raise;
      end if;
      v_passed:=v_passed+1;
    when raise_exception then
      get stacked diagnostics v_message=message_text;
      if v_message<>'seven_arches_provider_site_settings_extra_row_rollback' then raise; end if;
      v_passed:=v_passed+1;
  end;

  -- B: cardinality zero is equally invalid.
  begin
    delete from public.site_settings where id=1;
    if public.hotel_v2_external_calendar_site_settings_fingerprint() is not null
       or public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_site_settings_missing_row_accepted';
    end if;
    raise exception 'seven_arches_provider_site_settings_missing_row_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    if v_message<>'seven_arches_provider_site_settings_missing_row_rollback' then raise; end if;
    v_passed:=v_passed+1;
  end;

  -- C-E: the three fixed Hotels lifecycle flags cannot move to true.
  begin
    update public.site_settings set hotel_rooms_v2_enabled=true where id=1;
    if public.hotel_v2_external_calendar_site_settings_fingerprint() is not null
       or public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_rooms_lifecycle_drift_accepted';
    end if;
    raise exception 'seven_arches_provider_rooms_lifecycle_drift_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    if v_message<>'seven_arches_provider_rooms_lifecycle_drift_rollback' then raise; end if;
    v_passed:=v_passed+1;
  end;
  begin
    update public.site_settings set hotel_instant_booking_enabled=true where id=1;
    if public.hotel_v2_external_calendar_site_settings_fingerprint() is not null
       or public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_instant_lifecycle_drift_accepted';
    end if;
    raise exception 'seven_arches_provider_instant_lifecycle_drift_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    if v_message<>'seven_arches_provider_instant_lifecycle_drift_rollback' then raise; end if;
    v_passed:=v_passed+1;
  end;
  begin
    update public.site_settings set hotel_stripe_connect_enabled=true where id=1;
    if public.hotel_v2_external_calendar_site_settings_fingerprint() is not null
       or public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_stripe_lifecycle_drift_accepted';
    end if;
    raise exception 'seven_arches_provider_stripe_lifecycle_drift_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    if v_message<>'seven_arches_provider_stripe_lifecycle_drift_rollback' then raise; end if;
    v_passed:=v_passed+1;
  end;

  -- F: external-sync must remain a non-null supported Boolean.
  begin
    update public.site_settings set hotel_external_sync_enabled=null where id=1;
    if public.hotel_v2_external_calendar_site_settings_fingerprint() is not null
       or public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_external_null_accepted';
    end if;
    raise exception 'seven_arches_provider_external_null_rollback';
  exception
    when not_null_violation then v_passed:=v_passed+1;
    when raise_exception then
      get stacked diagnostics v_message=message_text;
      if v_message<>'seven_arches_provider_external_null_rollback' then raise; end if;
      v_passed:=v_passed+1;
  end;

  -- G: the canonical/raw bridge helper's SECURITY DEFINER boundary is pinned.
  begin
    alter function public.hotel_v2_external_calendar_site_settings_fingerprint()
      security invoker;
    if public.hotel_v2_external_calendar_site_settings_fingerprint() is not null
       or public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_site_settings_helper_security_drift_accepted';
    end if;
    raise exception 'seven_arches_provider_site_settings_helper_security_drift_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    if v_message<>'seven_arches_provider_site_settings_helper_security_drift_rollback' then
      raise;
    end if;
    v_passed:=v_passed+1;
  end;

  -- H: a source-only change is rejected even when the helper still computes
  -- the same canonical value and preserves its security metadata.
  begin
    v_definition:=pg_get_functiondef(
      'public.hotel_v2_external_calendar_site_settings_fingerprint()'::regprocedure);
    v_needle:=E'declare\n  v_setting public.site_settings%rowtype;';
    if (length(v_definition)-length(replace(v_definition,v_needle,'')))
         /length(v_needle)<>1 then
      raise exception 'seven_arches_provider_site_settings_helper_probe_source_drift';
    end if;
    execute replace(v_definition,v_needle,
      v_needle||E'\n  -- test-only source identity probe');
    if public.hotel_v2_external_calendar_site_settings_fingerprint() is null
       or public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_site_settings_helper_source_drift_accepted';
    end if;
    raise exception 'seven_arches_provider_site_settings_helper_source_drift_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    if v_message<>'seven_arches_provider_site_settings_helper_source_drift_rollback' then
      raise;
    end if;
    v_passed:=v_passed+1;
  end;

  -- I: a lower Property map that does not equal direct whole-row
  -- recomputation cannot be normalized into an accepted provider projection.
  begin
    v_definition:=pg_get_functiondef(
      'public.hotel_v2_h3_2b_protected_fingerprints()'::regprocedure);
    v_needle:='public.hotel_v2_h3_2b_protected_fingerprints()';
    if (length(v_definition)-length(replace(v_definition,v_needle,'')))
         /length(v_needle)<>1 then
      raise exception 'seven_arches_provider_raw_property_probe_source_drift';
    end if;
    execute replace(v_definition,v_needle,
      'pg_temp.seven_arches_provider_raw_property_original()');
    execute $ddl$
      create or replace function public.hotel_v2_h3_2b_protected_fingerprints()
      returns jsonb language sql stable security definer
      set search_path=pg_catalog,public
      as $probe$
      select jsonb_set(
        pg_temp.seven_arches_provider_raw_property_original(),
        '{site_settings}',to_jsonb('provider-raw-mismatch'::text),false)
      $probe$
    $ddl$;
    if public.hotel_v2_h3_2b_protected_fingerprints()->>'site_settings'
         is not distinct from md5(pg_catalog.query_to_xml($query$
           select to_jsonb(row_value)::text
           from public.site_settings row_value
           order by to_jsonb(row_value)::text$query$,true,true,'')::text)
       or public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_raw_property_mismatch_accepted';
    end if;
    raise exception 'seven_arches_provider_raw_property_mismatch_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    if v_message<>'seven_arches_provider_raw_property_mismatch_rollback' then raise; end if;
    v_passed:=v_passed+1;
  end;

  -- J: replacing both immutable canonical map values with a self-consistent
  -- but non-contract fingerprint must still fail closed.
  begin
    alter table public.hotel_seven_arches_pricing_activation_evolution_receipts
      disable trigger hotel_seven_arches_pricing_activation_evolution_immutable;
    update public.hotel_seven_arches_pricing_activation_evolution_receipts set
      after_protected_fingerprints=jsonb_set(after_protected_fingerprints,
        '{site_settings}',to_jsonb(repeat('c',64)),false),
      after_protected_fingerprint=public.hotel_v2_external_calendar_worker_hash(
        jsonb_set(after_protected_fingerprints,'{site_settings}',
          to_jsonb(repeat('c',64)),false)),
      after_stage2_protected_fingerprints=jsonb_set(after_stage2_protected_fingerprints,
        '{site_settings}',to_jsonb(repeat('c',64)),false),
      after_stage2_protected_fingerprint=public.hotel_v2_external_calendar_worker_hash(
        jsonb_set(after_stage2_protected_fingerprints,'{site_settings}',
          to_jsonb(repeat('c',64)),false))
    where id=1;
    if public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()
       or public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_canonical_lifecycle_corruption_accepted';
    end if;
    raise exception 'seven_arches_provider_canonical_lifecycle_corruption_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    if v_message<>'seven_arches_provider_canonical_lifecycle_corruption_rollback' then
      raise;
    end if;
    v_passed:=v_passed+1;
  end;

  -- K: canonical Property and Stage2 site_settings evidence must agree.
  begin
    alter table public.hotel_seven_arches_pricing_activation_evolution_receipts
      disable trigger hotel_seven_arches_pricing_activation_evolution_immutable;
    update public.hotel_seven_arches_pricing_activation_evolution_receipts set
      after_stage2_protected_fingerprints=jsonb_set(after_stage2_protected_fingerprints,
        '{site_settings}',to_jsonb(repeat('d',64)),false),
      after_stage2_protected_fingerprint=public.hotel_v2_external_calendar_worker_hash(
        jsonb_set(after_stage2_protected_fingerprints,'{site_settings}',
          to_jsonb(repeat('d',64)),false))
    where id=1;
    if public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()
       or public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_property_stage2_site_disagreement_accepted';
    end if;
    raise exception 'seven_arches_provider_property_stage2_site_disagreement_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    if v_message<>'seven_arches_provider_property_stage2_site_disagreement_rollback' then
      raise;
    end if;
    v_passed:=v_passed+1;
  end;

  if v_passed<>11
     or public.hotel_v2_external_calendar_site_settings_fingerprint() is null
     or not public.hotel_v2_external_calendar_provider_evolution_is_safe() then
    raise exception 'seven_arches_provider_site_settings_bridge_negative_count_failed:%',
      v_passed;
  end if;
end
$provider_site_settings_representation_negatives$;

-- The immutable provider receipt binds the historical raw maps, canonical
-- lifecycle bridge, helper sources, activation seam and its own UTC-stable
-- self-hash. Corrupt each evidence class independently and fail closed.
do $provider_site_settings_receipt_negatives$
declare v_probe text; v_message text; v_constraint text; v_passed integer:=0;
begin
  foreach v_probe in array array[
    'historical_raw','historical_map','canonical_lifecycle',
    'canonical_helper','activation_receipt','helper_source_map','receipt_hash',
    'contract_version','provider_bridge_source','topology_before','topology_after',
    'changed_signatures','incomplete_transition'] loop
    begin
      alter table hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
        disable trigger hotel_external_calendar_provider_evolution_receipt_immutable;
      case v_probe
        when 'historical_raw' then
          update hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
          set historical_property_site_settings_raw_fingerprint=repeat('a',32)
          where id=1;
        when 'historical_map' then
          update hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
          set historical_property_map_fingerprint=repeat('b',64)
          where id=1;
        when 'canonical_lifecycle' then
          update hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
          set canonical_site_settings_lifecycle_fingerprint=repeat('c',64)
          where id=1;
        when 'canonical_helper' then
          update hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
          set canonical_site_settings_helper_source_hash=repeat('d',64)
          where id=1;
        when 'activation_receipt' then
          update hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
          set site_settings_activation_receipt_fingerprint=repeat('e',64)
          where id=1;
        when 'helper_source_map' then
          update hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
          set fingerprint_helper_source_hashes=jsonb_set(
            fingerprint_helper_source_hashes,'{canonical_site_settings_helper}',
            to_jsonb(repeat('f',64)),false)
          where id=1;
        when 'receipt_hash' then
          update hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
          set receipt_hash=repeat('0',64) where id=1;
        when 'contract_version' then
          for v_constraint in select constraint_row.conname
            from pg_constraint constraint_row
            where constraint_row.conrelid=
              'hotels_v2_private.hotel_external_calendar_provider_evolution_receipts'::regclass
              and constraint_row.contype='c'
              and pg_get_constraintdef(constraint_row.oid) like '%contract_version%'
          loop
            execute format('alter table hotels_v2_private.%I drop constraint %I',
              'hotel_external_calendar_provider_evolution_receipts',v_constraint);
          end loop;
          update hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
          set contract_version='hotels_v2_external_calendar_provider_evolution_wrong'
          where id=1;
        when 'provider_bridge_source' then
          update hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
          set provider_bridge_source_hash=repeat('1',64) where id=1;
        when 'topology_before' then
          update hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
          set prior_function_source_hashes=jsonb_set(prior_function_source_hashes,
            '{public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()}',
            to_jsonb(repeat('2',64)),false) where id=1;
        when 'topology_after' then
          update hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
          set evolved_function_source_hashes=jsonb_set(evolved_function_source_hashes,
            '{public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()}',
            to_jsonb(repeat('3',64)),false) where id=1;
        when 'changed_signatures' then
          update hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
          set changed_function_signatures=array_remove(changed_function_signatures,
            'public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()')
          where id=1;
        when 'incomplete_transition' then
          alter table hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
            alter column evolved_protected_fingerprints drop not null;
          update hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
          set evolved_protected_fingerprints=null where id=1;
      end case;
      if public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()
         or public.hotel_v2_external_calendar_provider_evolution_is_safe() then
        raise exception 'seven_arches_provider_bridge_receipt_corruption_accepted:%',v_probe;
      end if;
      raise exception 'seven_arches_provider_bridge_receipt_probe_rollback:%',v_probe;
    exception when raise_exception then
      get stacked diagnostics v_message=message_text;
      if v_message<>'seven_arches_provider_bridge_receipt_probe_rollback:'||v_probe then
        raise;
      end if;
      v_passed:=v_passed+1;
    end;
  end loop;

  begin
    alter table hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
      disable trigger hotel_external_calendar_provider_evolution_receipt_immutable;
    for v_constraint in select constraint_row.conname
      from pg_constraint constraint_row
      where constraint_row.conrelid=
        'hotels_v2_private.hotel_external_calendar_provider_evolution_receipts'::regclass
        and constraint_row.contype in('p','c')
    loop
      execute format('alter table hotels_v2_private.%I drop constraint %I',
        'hotel_external_calendar_provider_evolution_receipts',v_constraint);
    end loop;
    insert into hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
    select (jsonb_populate_record(
      null::hotels_v2_private.hotel_external_calendar_provider_evolution_receipts,
      to_jsonb(receipt)||jsonb_build_object('id',2))).*
    from hotels_v2_private.hotel_external_calendar_provider_evolution_receipts receipt
    where receipt.id=1;
    if public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()
       or public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_duplicate_receipt_accepted';
    end if;
    raise exception 'seven_arches_provider_duplicate_receipt_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    if v_message<>'seven_arches_provider_duplicate_receipt_probe_rollback' then raise; end if;
    v_passed:=v_passed+1;
  end;

  if v_passed<>14
     or not public.hotel_v2_external_calendar_provider_evolution_is_safe() then
    raise exception 'seven_arches_provider_bridge_receipt_negative_count_failed:%',v_passed;
  end if;
end
$provider_site_settings_receipt_negatives$;

do $provider_attribution_static$
declare v_oid oid:=to_regprocedure(
  'public.hotel_v2_external_calendar_provider_sources_are_attributable()');
begin
  if v_oid is null or (select proowner from pg_proc where oid=v_oid)<>'postgres'::regrole
     or not (select prosecdef from pg_proc where oid=v_oid)
     or (select proconfig from pg_proc where oid=v_oid)
       is distinct from array['search_path=pg_catalog, public']::text[]
     or has_function_privilege(0::oid,v_oid,'EXECUTE')
     or has_function_privilege('anon',v_oid,'EXECUTE')
     or has_function_privilege('authenticated',v_oid,'EXECUTE')
     or has_function_privilege('service_role',v_oid,'EXECUTE')
     or (select foundation.provider_source_attribution_source_hash
       from public.hotel_partner_property_proposal_foundation_receipts foundation
       join hotels_v2_private.hotel_external_calendar_provider_evolution_receipts receipt
         on receipt.id=foundation.id)
       is distinct from (select receipt.prior_function_fingerprints->>
         'public.hotel_v2_external_calendar_provider_sources_are_attributable()'
         from hotels_v2_private.hotel_external_calendar_provider_evolution_receipts receipt
         where receipt.id=1)
     or (select receipt.prior_function_source_hashes->>
       'public.hotel_v2_external_calendar_provider_sources_are_attributable()'
       from hotels_v2_private.hotel_external_calendar_provider_evolution_receipts receipt
       where receipt.id=1) is distinct from
       '6aee1bb6d02b999877d6384633dd9eab1e8d533917b24ab25e20c83973a0025f'
     or (select receipt.evolved_function_fingerprints->>
       'public.hotel_v2_external_calendar_provider_sources_are_attributable()'
       from hotels_v2_private.hotel_external_calendar_provider_evolution_receipts receipt
       where receipt.id=1)
       is distinct from public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(v_oid)))
     or exists(select 1
       from public.hotel_seven_arches_pricing_activation_evolution_receipts activation
       join hotels_v2_private.hotel_external_calendar_provider_evolution_receipts receipt
         on receipt.id=activation.id
       where exists(select 1
         from unnest(activation.stage2_allowed_fingerprint_keys) changed(changed_key)
         where receipt.prior_compatible_fingerprints->(changed.changed_key)
           is distinct from activation.before_stage2_protected_fingerprints->(changed.changed_key)))
     or not public.hotel_v2_external_calendar_provider_sources_are_attributable()
     or not public.hotel_v2_external_calendar_provider_evolution_is_safe() then
    raise exception 'seven_arches_provider_attribution_static_confidence_failed';
  end if;
end
$provider_attribution_static$;

-- Task3 receipt normalization must fail closed independently of the provider
-- attribution ledger.  Every mutation below is contained by a PL/pgSQL
-- exception subtransaction, including temporary trigger/constraint DDL.
do $provider_task3_normalization_negatives$
declare v_activation public.hotel_seven_arches_pricing_activation_evolution_receipts%rowtype;
  v_activation_count integer; v_message text; v_rolled_back boolean;
  v_constraint text; v_unrelated_key text; v_after_prior jsonb;
begin
  select count(*) into v_activation_count
  from public.hotel_seven_arches_pricing_activation_evolution_receipts;
  if v_activation_count=0 then
    if (select receipt.prior_compatible_fingerprints
        from hotels_v2_private.hotel_external_calendar_provider_evolution_receipts receipt where receipt.id=1)
       is distinct from jsonb_set(public.hotel_v2_external_calendar_stage2_compatible_fingerprints(),
         '{site_settings}',to_jsonb(public.hotel_v2_external_calendar_site_settings_fingerprint()),false) then
      raise exception 'seven_arches_provider_no_task3_identity_failed';
    end if;
    return;
  elsif v_activation_count<>1 then
    raise exception 'seven_arches_provider_task3_receipt_cardinality_failed';
  end if;
  select * into strict v_activation
  from public.hotel_seven_arches_pricing_activation_evolution_receipts where id=1;

  -- A: current protected state no longer equals the exact receipt AFTER state.
  v_rolled_back:=false;
  begin
    update public.hotel_activity_log set after_state=after_state||'{"_provider_probe":true}'::jsonb
    where id=v_activation.activity_ids[1];
    if public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_task3_current_after_drift_accepted'; end if;
    raise exception 'seven_arches_provider_task3_current_after_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=v_message='seven_arches_provider_task3_current_after_probe_rollback';
  end;
  if not v_rolled_back then raise exception 'seven_arches_provider_task3_current_after_negative_failed'; end if;

  -- B: immutable BEFORE hash no longer self-hashes.
  v_rolled_back:=false;
  begin
    alter table public.hotel_seven_arches_pricing_activation_evolution_receipts
      disable trigger hotel_seven_arches_pricing_activation_evolution_immutable;
    update public.hotel_seven_arches_pricing_activation_evolution_receipts
      set before_stage2_protected_fingerprint=repeat('a',64) where id=1;
    if public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_task3_before_hash_drift_accepted'; end if;
    raise exception 'seven_arches_provider_task3_before_hash_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=v_message='seven_arches_provider_task3_before_hash_probe_rollback';
  end;
  if not v_rolled_back then raise exception 'seven_arches_provider_task3_before_hash_negative_failed'; end if;

  -- C: immutable AFTER hash no longer self-hashes.
  v_rolled_back:=false;
  begin
    alter table public.hotel_seven_arches_pricing_activation_evolution_receipts
      disable trigger hotel_seven_arches_pricing_activation_evolution_immutable;
    update public.hotel_seven_arches_pricing_activation_evolution_receipts
      set after_stage2_protected_fingerprint=repeat('b',64) where id=1;
    if public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_task3_after_hash_drift_accepted'; end if;
    raise exception 'seven_arches_provider_task3_after_hash_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=v_message='seven_arches_provider_task3_after_hash_probe_rollback';
  end;
  if not v_rolled_back then raise exception 'seven_arches_provider_task3_after_hash_negative_failed'; end if;

  -- D: the exact five-key allowlist cannot be broadened or narrowed.
  select constraint_row.conname into strict v_constraint
  from pg_constraint constraint_row
  where constraint_row.conrelid=
      'public.hotel_seven_arches_pricing_activation_evolution_receipts'::regclass
    and constraint_row.contype='c'
    and pg_get_constraintdef(constraint_row.oid) like '%stage2_allowed_fingerprint_keys%';
  v_rolled_back:=false;
  begin
    execute format('alter table public.hotel_seven_arches_pricing_activation_evolution_receipts drop constraint %I',
      v_constraint);
    alter table public.hotel_seven_arches_pricing_activation_evolution_receipts
      disable trigger hotel_seven_arches_pricing_activation_evolution_immutable;
    update public.hotel_seven_arches_pricing_activation_evolution_receipts
      set stage2_allowed_fingerprint_keys=array['hotel_rate_plans']::text[] where id=1;
    if public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_task3_allowlist_drift_accepted'; end if;
    raise exception 'seven_arches_provider_task3_allowlist_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=v_message='seven_arches_provider_task3_allowlist_probe_rollback';
  end;
  if not v_rolled_back then raise exception 'seven_arches_provider_task3_allowlist_negative_failed'; end if;

  -- E: an unrelated protected key cannot be absorbed into the AFTER receipt.
  select key_name into strict v_unrelated_key
  from jsonb_object_keys(v_activation.after_stage2_protected_fingerprints) key_row(key_name)
  where key_name<>all(v_activation.stage2_allowed_fingerprint_keys)
  order by key_name limit 1;
  v_rolled_back:=false;
  begin
    alter table public.hotel_seven_arches_pricing_activation_evolution_receipts
      disable trigger hotel_seven_arches_pricing_activation_evolution_immutable;
    update public.hotel_seven_arches_pricing_activation_evolution_receipts set
      after_stage2_protected_fingerprints=jsonb_set(after_stage2_protected_fingerprints,
        array[v_unrelated_key],'"provider-probe"'::jsonb,false),
      after_stage2_protected_fingerprint=public.hotel_v2_external_calendar_worker_hash(
        jsonb_set(after_stage2_protected_fingerprints,array[v_unrelated_key],
          '"provider-probe"'::jsonb,false))
      where id=1;
    if public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_task3_unrelated_key_drift_accepted'; end if;
    raise exception 'seven_arches_provider_task3_unrelated_key_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=v_message='seven_arches_provider_task3_unrelated_key_probe_rollback';
  end;
  if not v_rolled_back then raise exception 'seven_arches_provider_task3_unrelated_key_negative_failed'; end if;

  -- F: deleting Task3 cannot turn its current AFTER state into a no-receipt
  -- identity baseline, even if a trusted writer also rewrites provider prior.
  v_after_prior:=jsonb_set(v_activation.after_stage2_protected_fingerprints,
    '{site_settings}',to_jsonb(public.hotel_v2_external_calendar_site_settings_fingerprint()),false);
  v_rolled_back:=false;
  begin
    alter table public.hotel_seven_arches_pricing_activation_evolution_receipts
      disable trigger hotel_seven_arches_pricing_activation_evolution_immutable;
    alter table hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
      disable trigger hotel_external_calendar_provider_evolution_receipt_immutable;
    update hotels_v2_private.hotel_external_calendar_provider_evolution_receipts set
      prior_compatible_fingerprints=v_after_prior,
      prior_compatible_fingerprint=public.hotel_v2_external_calendar_worker_hash(v_after_prior)
      where id=1;
    delete from public.hotel_seven_arches_pricing_activation_evolution_receipts where id=1;
    if public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_task3_missing_receipt_after_prior_accepted'; end if;
    raise exception 'seven_arches_provider_task3_missing_receipt_probe_rollback';
  exception
    when foreign_key_violation then
      get stacked diagnostics v_message=message_text,v_constraint=constraint_name;
      v_rolled_back:=v_constraint=
        'hotel_seven_arches_independent_prici_activation_receipt_id_fkey'
        and v_message like 'update or delete on table "hotel_seven_arches_pricing_activation_evolution_receipts" violates foreign key constraint%';
      if not v_rolled_back then raise; end if;
    when raise_exception then
      get stacked diagnostics v_message=message_text;
      v_rolled_back:=v_message='seven_arches_provider_task3_missing_receipt_probe_rollback';
  end;
  if not v_rolled_back then raise exception 'seven_arches_provider_task3_missing_receipt_negative_failed'; end if;

  if not public.hotel_v2_external_calendar_provider_evolution_is_safe() then
    raise exception 'seven_arches_provider_task3_normalization_not_restored'; end if;
end
$provider_task3_normalization_negatives$;

create function pg_temp.seven_arches_provider_attribution_probe()
returns jsonb language sql stable security definer set search_path=pg_catalog,public
as $function$
select jsonb_build_object(
  'sources_attributable',public.hotel_v2_external_calendar_provider_sources_are_attributable(),
  'provider_safe',public.hotel_v2_external_calendar_provider_evolution_is_safe())
$function$;
revoke all on function pg_temp.seven_arches_provider_attribution_probe()
  from public,anon,authenticated,service_role;
grant execute on function pg_temp.seven_arches_provider_attribution_probe() to authenticated;

create function pg_temp.seven_arches_provider_pricing_probe()
returns jsonb language sql stable security definer set search_path=pg_catalog,public
as $function$
select jsonb_build_object(
  'pricing_state',public.hotel_v2_seven_arches_reviewed_pricing_current_state(),
  'pricing_receipt_chain_exact',
    public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact(),
  'pricing_topology_exact',
    public.hotel_v2_seven_arches_independent_pricing_topology_is_exact(),
  'provider_safe',public.hotel_v2_external_calendar_provider_evolution_is_safe())
$function$;
revoke all on function pg_temp.seven_arches_provider_pricing_probe()
  from public,anon,authenticated,service_role;
grant execute on function pg_temp.seven_arches_provider_pricing_probe() to authenticated;

create temp table seven_arches_provider_gate_before on commit preserve rows as
select
  (select count(*)::integer from public.hotel_calendar_source_configs
   where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' and source_type<>'manual') source_count,
  (select count(*)::integer from hotels_v2_private.hotel_external_calendar_source_secrets
   where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca') binding_count,
  (select count(*)::integer from hotels_v2_private.hotel_external_calendar_partner_proposals)
    proposal_count,
  (select count(*)::integer from hotels_v2_private.hotel_external_calendar_provider_review_receipts)
    review_receipt_count,
  (select count(*)::integer from hotels_v2_private.hotel_external_calendar_provider_admin_previews)
    admin_preview_count,
  (select count(*)::integer from hotels_v2_private.hotel_external_calendar_plan_reviews)
    plan_review_count,
  (select count(*)::integer from vault.secrets) vault_count,
  (select count(*)::integer from public.hotel_activity_log) activity_count,
  (select count(*)::integer from hotels_v2_private.hotel_external_calendar_admin_receipts)
    admin_receipt_count,
  (select count(*)::integer from public.hotel_partner_action_receipts) partner_receipt_count,
  (select count(*)::integer from hotels_v2_private.hotel_external_calendar_sync_jobs) job_count,
  (select count(*)::integer from hotels_v2_private.hotel_external_calendar_day_blocks) block_count,
  public.hotel_v2_seven_arches_reviewed_pricing_current_state() pricing_state;

begin;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000008"}',true);

do $reviewed_pricing_after_provider_install$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_item jsonb:=pg_temp.reviewed_pricing_item('upper',3,9,1.00);
  v_before jsonb:=pg_temp.seven_arches_provider_pricing_probe()->'pricing_state';
  v_preview jsonb; v_apply jsonb; v_probe jsonb;
begin
  perform set_config('request.jwt.claims',
    '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000001"}',true);
  v_preview:=public.hotel_v2_admin_preview_seven_arches_reviewed_pricing(
    jsonb_build_object(
      'contract_version','hotels_v2_seven_arches_reviewed_pricing_admin_request_v1',
      'hotel_id',c_hotel,'action','accept',
      'reason','Validate reviewed pricing after provider lineage installation',
      'items',jsonb_build_array(v_item)));
  v_apply:=public.hotel_v2_admin_apply_seven_arches_reviewed_pricing(
    v_preview->'reviewed_plan','e7470000-0000-4000-8000-000000000001',
    'e7480000-0000-4000-8000-000000000001');
  v_probe:=pg_temp.seven_arches_provider_pricing_probe();
  if v_apply->>'status'<>'accepted' or v_apply->>'changed'<>'true'
     or (v_probe->'pricing_state'->>'receipt_count')::integer<>
       (v_before->>'receipt_count')::integer+1
     or (v_probe->>'pricing_receipt_chain_exact')::boolean is not true
     or (v_probe->>'pricing_topology_exact')::boolean is not true
     or (v_probe->>'provider_safe')::boolean is not true then
    raise exception 'seven_arches_post_provider_pricing_lineage_failed:%',v_apply; end if;
  perform set_config('request.jwt.claims',
    '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000008"}',true);
end
$reviewed_pricing_after_provider_install$;

do $admin_booking_source$
declare c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_upper constant uuid:='b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
  c_ground constant uuid:='825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
  v_control jsonb; v_preview jsonb; v_apply jsonb; v_probe jsonb;
  v_source uuid; v_failed boolean;
begin
  v_control:=public.hotel_v2_admin_get_external_calendar_control(c_hotel);
  if v_control->>'contract_version'<>'hotels_v2_external_calendar_control_v2'
     or jsonb_typeof(v_control->'hotel_external_sync_enabled')<>'boolean'
     or v_control#>>'{provider_capability,contract_version}'<>
       'hotels_v2_external_calendar_provider_capability_v1'
     or v_control#>>'{provider_capability,stage}'<>'provider_types_active'
     or v_control#>'{provider_capability,supported_providers}'<>
       '["booking_com","airbnb","ical"]'::jsonb
     or jsonb_array_length(v_control->'rooms')<>2
     or jsonb_array_length(v_control->'sources')<>0
     or (select count(*) from jsonb_array_elements(v_control->'rooms') room
       where (room->>'id')::uuid in(c_upper,c_ground))<>2 then
    raise exception 'seven_arches_external_initial_control_mismatch:%',v_control; end if;

  v_preview:=public.hotel_v2_admin_preview_external_calendar_plan(jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_draft_v1','hotel_id',c_hotel,
    'partner_id',null,'assignment_id',null,'permission_version',null,
    'access_snapshot_token',null,'snapshot_token',v_control->>'snapshot_token','intent',jsonb_build_object(
      'entity','calendar_source','action','create','id',null,'expected_version',0,
      'payload',jsonb_build_object('room_type_id',c_upper,'code','upper-primary',
        'source_type','booking_com','sync_interval_minutes',60,'units_per_event',1,'priority',30),
      'reason','Create reviewed Booking.com ICS source')));
  if v_preview->>'changed'<>'true'
     or v_preview#>>'{reviewed_plan,operations,0,payload,source_type}'<>'booking_com'
     or v_preview#>'{impacts,0,fields}'<>
       '["code","priority","room_type_id","source_type","sync_interval_minutes","units_per_event"]'::jsonb then
    raise exception 'seven_arches_booking_com_preview_mismatch:%',v_preview; end if;
  v_source:=(v_preview#>>'{reviewed_plan,operations,0,id}')::uuid;
  v_apply:=public.hotel_v2_admin_apply_external_calendar_plan(v_preview->'reviewed_plan',
    'e7400000-0000-4000-8000-000000000001','e7410000-0000-4000-8000-000000000001',null);
  if v_apply->>'changed'<>'true' or v_apply->>'replayed'<>'false'
     or v_apply#>>'{activity,0,source}'<>'hotels_v2_external_calendar_control'
     or not exists(select 1 from jsonb_array_elements(v_apply#>'{control,sources}') source
       where (source->>'id')::uuid=v_source and source->>'source_type'='booking_com'
         and (source->>'room_type_id')::uuid=c_upper
         and source->>'secret_configured'='false' and source->'health'->>'status'='never_synced') then
    raise exception 'seven_arches_booking_com_apply_mismatch:%',v_apply; end if;
  v_probe:=pg_temp.seven_arches_provider_attribution_probe();
  if v_probe is distinct from
      '{"provider_safe":true,"sources_attributable":true}'::jsonb then
    raise exception 'seven_arches_booking_com_first_apply_not_attributable:%',v_probe;
  end if;
end
$admin_booking_source$;

\if :provider_booking_only
rollback;
select true as hotels_v2_seven_arches_booking_com_attribution_postgres_gate_passed;
\quit
\endif

do $admin_additional_sources$
declare c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_ground constant uuid:='825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
  v_control jsonb; v_preview jsonb; v_apply jsonb; v_probe jsonb;
  v_source uuid; v_failed boolean;
begin
  v_control:=public.hotel_v2_admin_get_external_calendar_control(c_hotel);
  select (source->>'id')::uuid into strict v_source
    from jsonb_array_elements(v_control->'sources') source
    where source->>'source_type'='booking_com' and source->>'code'='upper-primary';

  v_preview:=public.hotel_v2_admin_preview_external_calendar_plan(jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_draft_v1','hotel_id',c_hotel,
    'partner_id',null,'assignment_id',null,'permission_version',null,
    'access_snapshot_token',null,'snapshot_token',v_control->>'snapshot_token','intent',jsonb_build_object(
      'entity','calendar_source','action','create','id',null,'expected_version',0,
      'payload',jsonb_build_object('room_type_id',c_ground,'code','ground-secondary',
        'source_type','ical','sync_interval_minutes',120,'units_per_event',1,'priority',10),
      'reason','Create reviewed generic iCalendar source')));
  v_apply:=public.hotel_v2_admin_apply_external_calendar_plan(v_preview->'reviewed_plan',
    'e7400000-0000-4000-8000-000000000002','e7410000-0000-4000-8000-000000000002',null);
  if not exists(select 1 from jsonb_array_elements(v_apply#>'{control,sources}') source
       where source->>'source_type'='ical' and (source->>'room_type_id')::uuid=c_ground
         and source->>'secret_configured'='false') then
    raise exception 'seven_arches_ical_apply_mismatch:%',v_apply; end if;
  v_probe:=pg_temp.seven_arches_provider_attribution_probe();
  if v_probe is distinct from
      '{"provider_safe":true,"sources_attributable":true}'::jsonb then
    raise exception 'seven_arches_admin_ical_apply_not_attributable:%',v_probe; end if;

  v_control:=v_apply->'control';
  v_preview:=public.hotel_v2_admin_preview_external_calendar_plan(jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_draft_v1','hotel_id',c_hotel,
    'partner_id',null,'assignment_id',null,'permission_version',null,
    'access_snapshot_token',null,'snapshot_token',v_control->>'snapshot_token','intent',jsonb_build_object(
      'entity','calendar_source','action','create','id',null,'expected_version',0,
      'payload',jsonb_build_object('room_type_id',c_ground,'code','ground-admin-airbnb',
        'source_type','airbnb','sync_interval_minutes',180,'units_per_event',1,'priority',5),
      'reason','Create second reviewed Admin Airbnb ICS source')));
  v_apply:=public.hotel_v2_admin_apply_external_calendar_plan(v_preview->'reviewed_plan',
    'e7400000-0000-4000-8000-000000000007','e7410000-0000-4000-8000-000000000007',null);
  if not exists(select 1 from jsonb_array_elements(v_apply#>'{control,sources}') source
       where source->>'source_type'='airbnb' and source->>'code'='ground-admin-airbnb'
         and (source->>'room_type_id')::uuid=c_ground and source->>'secret_configured'='false') then
    raise exception 'seven_arches_admin_airbnb_apply_mismatch:%',v_apply; end if;
  v_probe:=pg_temp.seven_arches_provider_attribution_probe();
  if v_probe is distinct from
      '{"provider_safe":true,"sources_attributable":true}'::jsonb then
    raise exception 'seven_arches_admin_airbnb_apply_not_attributable:%',v_probe; end if;

  -- Global activation remains manual-only.  A source without a private URL
  -- cannot be enabled under either lifecycle state: OFF returns an explicit
  -- non-changing result, while ON fails closed on the missing binding.
  if v_control->>'hotel_external_sync_enabled'='false' then
    v_control:=v_apply->'control';
    v_preview:=public.hotel_v2_admin_preview_external_calendar_plan(jsonb_build_object(
      'contract_version','hotels_v2_external_calendar_draft_v1','hotel_id',c_hotel,
      'partner_id',null,'assignment_id',null,'permission_version',null,
      'access_snapshot_token',null,'snapshot_token',v_control->>'snapshot_token','intent',jsonb_build_object(
        'entity','calendar_source','action','enable','id',v_source,'expected_version',1,
        'payload','{}'::jsonb,'reason','Request enable before operator activation')));
    if v_preview->>'changed'<>'false' or v_preview->'reviewed_plan'<>'null'::jsonb
       or v_preview->'blocking_reasons'<>'["external_calendar_not_activated"]'::jsonb then
      raise exception 'seven_arches_enable_not_safely_blocked:%',v_preview; end if;
    v_failed:=false;
    begin
      perform public.hotel_v2_admin_preview_external_calendar_plan(jsonb_build_object(
        'contract_version','hotels_v2_external_calendar_draft_v1','hotel_id',c_hotel,
        'partner_id',null,'assignment_id',null,'permission_version',null,
        'access_snapshot_token',null,'snapshot_token',v_control->>'snapshot_token','intent',jsonb_build_object(
          'entity','calendar_sync','action','trigger','id',v_source,'expected_version',0,
          'payload',jsonb_build_object('source_id',v_source),'reason','Request manual sync before configuration')));
    exception when check_violation then
      v_failed:=sqlerrm='hotels_v2_external_calendar_source_not_triggerable'; end;
    if not v_failed then raise exception 'seven_arches_unconfigured_manual_sync_allowed'; end if;
  else
    v_control:=v_apply->'control';
    v_failed:=false;
    begin
      perform public.hotel_v2_admin_preview_external_calendar_plan(jsonb_build_object(
        'contract_version','hotels_v2_external_calendar_draft_v1','hotel_id',c_hotel,
        'partner_id',null,'assignment_id',null,'permission_version',null,
        'access_snapshot_token',null,'snapshot_token',v_control->>'snapshot_token',
        'intent',jsonb_build_object(
          'entity','calendar_source','action','enable','id',v_source,
          'expected_version',1,'payload','{}'::jsonb,
          'reason','Reject enable without reviewed private URL')));
    exception when check_violation then
      v_failed:=sqlerrm='hotels_v2_external_calendar_secret_required';
    end;
    if not v_failed then
      raise exception 'seven_arches_enable_without_private_url_allowed'; end if;
  end if;
  if v_apply::text~'"(ical_url|configuration|external_reference|vault_secret_id)"' then
    raise exception 'seven_arches_control_secret_leak'; end if;
end
$admin_additional_sources$;

reset role;
do $provider_attribution_negatives$
declare c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_foreign_hotel constant uuid:='c1000000-0000-4000-8000-000000000001';
  c_foreign_room constant uuid:='c1100000-0000-4000-8000-000000000001';
  c_partner constant uuid:='20000000-0000-4000-8000-000000000001';
  c_partner_actor constant uuid:='10000000-0000-4000-8000-000000000002';
  v_source uuid; v_message text; v_rolled_back boolean; v_failed boolean;
begin
  select id into strict v_source from public.hotel_calendar_source_configs
    where hotel_id=c_hotel and source_type='booking_com' and code='upper-primary';

  v_failed:=false;
  perform set_config('hotels_v2.external_calendar_apply_context','',true);
  perform set_config('hotels_v2.external_calendar_apply_action','',true);
  begin
    insert into public.hotel_calendar_source_configs(id,hotel_id,room_type_id,code,source_type,
      configuration,is_enabled,review_status,priority,version)
    values('e7450000-0000-4000-8000-000000000001',c_hotel,
      'b4ef504f-cdeb-4e3c-a54d-932146ef4e94','direct-no-plan','booking_com',
      '{"sync_interval_minutes":60,"units_per_event":1}',false,'reviewed',0,1);
  exception when object_not_in_prerequisite_state then
    v_failed:=sqlerrm='hotels_v2_external_calendar_reviewed_context_required';
  end;
  if not v_failed then raise exception 'seven_arches_direct_source_without_plan_allowed'; end if;

  -- Correlations are immutable, so a reviewed activity cannot be rebound to
  -- another request hash after Apply.
  v_failed:=false;
  begin
    update hotels_v2_private.hotel_external_calendar_correlations
      set request_hash=repeat('b',64)
      where correlation_id='e7400000-0000-4000-8000-000000000001';
  exception when object_not_in_prerequisite_state then
    v_failed:=sqlerrm='hotels_v2_h3_2a_append_only_violation';
  end;
  if not v_failed then raise exception 'seven_arches_correlation_mismatch_allowed'; end if;

  v_failed:=false;
  begin
    perform set_config('hotels_v2.external_calendar_apply_context',
      'e7440000-0000-4000-8000-000000000010',true);
    perform set_config('hotels_v2.external_calendar_apply_action','update',true);
    update public.hotel_calendar_source_configs
      set hotel_id=c_foreign_hotel,version=version+1,updated_at=clock_timestamp()
      where id=v_source;
  exception when object_not_in_prerequisite_state then
    v_failed:=sqlerrm='hotels_v2_external_calendar_source_field_scope_violation';
  end;
  if not v_failed then raise exception 'seven_arches_source_hotel_mismatch_allowed'; end if;

  v_failed:=false;
  begin
    perform set_config('hotels_v2.external_calendar_apply_context',
      'e7440000-0000-4000-8000-000000000011',true);
    perform set_config('hotels_v2.external_calendar_apply_action','update',true);
    update public.hotel_calendar_source_configs
      set room_type_id=c_foreign_room,version=version+1,updated_at=clock_timestamp()
      where id=v_source;
  exception when check_violation then
    v_failed:=sqlerrm='hotels_v2_external_calendar_source_invalid';
  end;
  if not v_failed then raise exception 'seven_arches_source_room_mismatch_allowed'; end if;

  v_failed:=false;
  begin
    perform set_config('hotels_v2.external_calendar_apply_context',
      'e7440000-0000-4000-8000-000000000012',true);
    perform set_config('hotels_v2.external_calendar_apply_action','update',true);
    update public.hotel_calendar_source_configs
      set source_type='expedia',version=version+1,updated_at=clock_timestamp()
      where id=v_source;
  exception when object_not_in_prerequisite_state then
    v_failed:=sqlerrm='hotels_v2_external_calendar_source_field_scope_violation';
  end;
  if not v_failed then raise exception 'seven_arches_unsupported_provider_allowed'; end if;
  perform set_config('hotels_v2.external_calendar_apply_context','',true);
  perform set_config('hotels_v2.external_calendar_apply_action','',true);

  -- Removing the exact activity makes the shared attribution helper and the
  -- provider-safe verdict fail immediately; the subtransaction restores it.
  v_rolled_back:=false;
  begin
    delete from public.hotel_activity_log
      where correlation_id='e7400000-0000-4000-8000-000000000001';
    if public.hotel_v2_external_calendar_provider_sources_are_attributable()
       or public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_missing_activity_was_accepted';
    end if;
    raise exception 'seven_arches_missing_activity_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=v_message='seven_arches_missing_activity_probe_rollback';
  end;
  if not v_rolled_back then raise exception 'seven_arches_missing_activity_negative_failed'; end if;

  -- Admin receipts are append-only, so the exact reviewed chain cannot be
  -- made receipt-less by an owner/trusted table mutation.
  v_failed:=false;
  begin
    delete from hotels_v2_private.hotel_external_calendar_admin_receipts
      where correlation_id='e7400000-0000-4000-8000-000000000001';
  exception when object_not_in_prerequisite_state then
    v_failed:=sqlerrm='hotels_v2_h3_2a_append_only_violation';
  end;
  if not v_failed then raise exception 'seven_arches_missing_admin_receipt_allowed'; end if;

  -- An excluded Partner H3.2D receipt without its consumed review,
  -- correlation and activity must never be normalized away.
  v_rolled_back:=false;
  begin
    insert into public.hotel_partner_action_receipts(partner_id,hotel_id,actor_user_id,action,
      idempotency_key,request_hash,correlation_id,result)
    values(c_partner,c_hotel,c_partner_actor,'h3_2d_external_calendar',
      'e7430000-0000-4000-8000-000000000001',repeat('a',64),
      'e7440000-0000-4000-8000-000000000001',
      jsonb_build_object('contract_version','hotels_v2_external_calendar_apply_result_v1'));
    if public.hotel_v2_external_calendar_provider_sources_are_attributable()
       or public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_orphan_partner_receipt_was_accepted';
    end if;
    raise exception 'seven_arches_orphan_partner_receipt_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=v_message='seven_arches_orphan_partner_receipt_probe_rollback';
  end;
  if not v_rolled_back then
    raise exception 'seven_arches_orphan_partner_receipt_negative_failed'; end if;

  -- An external-control activity without the exact reviewed chain is equally
  -- invalid even if its redacted source projection looks plausible.
  v_rolled_back:=false;
  begin
    insert into public.hotel_activity_log(hotel_id,entity_type,entity_id,action,
      before_state,after_state,actor_type,actor_id,source,correlation_id)
    values(c_hotel,'calendar_source',v_source,'update',
      public.hotel_v2_external_calendar_source_projection(v_source),
      public.hotel_v2_external_calendar_source_projection(v_source),'admin',
      '10000000-0000-4000-8000-000000000008',
      'hotels_v2_external_calendar_control','e7440000-0000-4000-8000-000000000002');
    if public.hotel_v2_external_calendar_provider_sources_are_attributable()
       or public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_orphan_external_activity_was_accepted';
    end if;
    raise exception 'seven_arches_orphan_external_activity_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=v_message='seven_arches_orphan_external_activity_probe_rollback';
  end;
  if not v_rolled_back then
    raise exception 'seven_arches_orphan_external_activity_negative_failed'; end if;
  if not public.hotel_v2_external_calendar_provider_sources_are_attributable()
     or not public.hotel_v2_external_calendar_provider_evolution_is_safe() then
    raise exception 'seven_arches_provider_attribution_not_restored_after_negatives';
  end if;
end
$provider_attribution_negatives$;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000002"}',true);
do $partner_source$
declare c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_ground constant uuid:='825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
  c_partner constant uuid:='20000000-0000-4000-8000-000000000001';
  v_control jsonb; v_preview jsonb; v_submit jsonb; v_proposal uuid;
begin
  v_control:=public.hotel_v2_partner_get_external_calendar_control(c_partner,c_hotel);
  v_preview:=public.hotel_v2_partner_preview_external_calendar_plan(jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_draft_v1','hotel_id',c_hotel,
    'partner_id',c_partner,'assignment_id',v_control->'assignment_id',
    'permission_version',v_control->'permission_version',
    'access_snapshot_token',v_control->'access_snapshot_token',
    'snapshot_token',v_control->>'snapshot_token','intent',jsonb_build_object(
      'entity','calendar_source','action','create','id',null,'expected_version',0,
      'payload',jsonb_build_object('room_type_id',c_ground,'code','ground-tertiary',
        'source_type','airbnb','sync_interval_minutes',60,'units_per_event',1,'priority',20),
      'reason','Create reviewed Airbnb ICS source')));
  v_submit:=public.hotel_v2_partner_apply_external_calendar_plan(v_preview->'reviewed_plan',
    'e7400000-0000-4000-8000-000000000003','e7410000-0000-4000-8000-000000000003',null);
  v_proposal:=(v_submit#>>'{proposal,proposal_id}')::uuid;
  if v_submit->>'contract_version'<>
       'hotels_v2_external_calendar_partner_proposal_submit_v1'
     or v_submit#>>'{proposal,status}'<>'pending_admin_review'
     or v_submit#>>'{proposal,partner_id}'<>c_partner::text
     or v_submit#>>'{proposal,source_type}'<>'airbnb'
     or v_submit#>>'{proposal,room_type_id}'<>c_ground::text
     or v_proposal is null
     or exists(select 1 from jsonb_array_elements(v_submit#>'{control,sources}') source
       where (source->>'id')::uuid=(v_submit#>>'{proposal,source_id}')::uuid) then
    raise exception 'seven_arches_partner_airbnb_submit_mismatch:%',v_submit; end if;
  perform set_config('test.hotels_114450_partner_proposal_id',v_proposal::text,true);
end
$partner_source$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000008"}',true);
do $admin_partner_source_review$
declare c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_ground constant uuid:='825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
  v_proposal uuid:=current_setting('test.hotels_114450_partner_proposal_id')::uuid;
  v_list jsonb; v_preview jsonb; v_apply jsonb; v_replay jsonb; v_probe jsonb;
  v_failed boolean:=false;
begin
  v_list:=public.hotel_v2_admin_get_external_calendar_provider_reviews(c_hotel);
  if v_list->>'contract_version'<>
       'hotels_v2_external_calendar_provider_review_list_v1'
     or not exists(select 1 from jsonb_array_elements(v_list->'proposals') proposal
       where (proposal->>'proposal_id')::uuid=v_proposal
         and proposal->>'status'='pending_admin_review'
         and proposal->>'source_type'='airbnb') then
    raise exception 'seven_arches_admin_provider_review_list_mismatch:%',v_list; end if;
  v_preview:=public.hotel_v2_admin_preview_external_calendar_partner_proposal(
    v_proposal,'Accept exact reviewed Airbnb Room source');
  if v_preview->>'contract_version'<>
       'hotels_v2_external_calendar_provider_admin_preview_v1'
     or v_preview#>>'{proposal,status}'<>'pending_admin_review'
     or v_preview#>>'{preview,reviewed_plan,actor_type}'<>'admin'
     or v_preview#>>'{preview,reviewed_plan,partner_id}' is not null then
    raise exception 'seven_arches_admin_provider_preview_mismatch:%',v_preview; end if;
  v_apply:=public.hotel_v2_admin_apply_external_calendar_partner_proposal(
    v_proposal,v_preview#>'{preview,reviewed_plan}',
    'e7400000-0000-4000-8000-000000000013',
    'e7410000-0000-4000-8000-000000000013',
    'Accept exact reviewed Airbnb Room source');
  v_replay:=public.hotel_v2_admin_apply_external_calendar_partner_proposal(
    v_proposal,v_preview#>'{preview,reviewed_plan}',
    'e7400000-0000-4000-8000-000000000013',
    'e7410000-0000-4000-8000-000000000013',
    'Accept exact reviewed Airbnb Room source');
  if v_apply->>'contract_version'<>
       'hotels_v2_external_calendar_provider_admin_apply_v1'
     or v_apply#>>'{proposal,status}'<>'accepted'
     or v_apply#>>'{apply,changed}'<>'true'
     or v_apply->>'replayed'<>'false'
     or v_replay->>'replayed'<>'true'
     or not exists(select 1 from jsonb_array_elements(v_apply#>'{apply,control,sources}') source
       where source->>'source_type'='airbnb'
         and (source->>'room_type_id')::uuid=c_ground
         and source->>'secret_configured'='false') then
    raise exception 'seven_arches_admin_provider_accept_mismatch:%',v_apply; end if;
  v_list:=public.hotel_v2_admin_get_external_calendar_provider_reviews(c_hotel);
  if not exists(select 1 from jsonb_array_elements(v_list->'proposals') proposal
      where (proposal->>'proposal_id')::uuid=v_proposal
        and proposal->>'status'='accepted'
        and (proposal->>'reviewed_by')::uuid=auth.uid()
        and proposal->>'admin_reason'='Accept exact reviewed Airbnb Room source') then
    raise exception 'seven_arches_admin_provider_accept_attribution_mismatch:%',v_list;
  end if;
  begin
    perform public.hotel_v2_admin_apply_external_calendar_partner_proposal(
      v_proposal,v_preview#>'{preview,reviewed_plan}',
      'e7400000-0000-4000-8000-000000000099',
      'e7410000-0000-4000-8000-000000000099',
      'Accept exact reviewed Airbnb Room source');
  exception when sqlstate 'PT409' then
    v_failed:=true;
  end;
  if not v_failed then
    raise exception 'seven_arches_consumed_provider_review_conflict_allowed'; end if;
  v_probe:=pg_temp.seven_arches_provider_attribution_probe();
  if v_probe is distinct from
      '{"provider_safe":true,"sources_attributable":true}'::jsonb then
    raise exception 'seven_arches_partner_airbnb_accept_not_attributable:%',v_probe; end if;
end
$admin_partner_source_review$;
reset role;

do $provider_review_receipt_immutability$
declare v_failed boolean:=false;
begin
  begin
    delete from hotels_v2_private.hotel_external_calendar_provider_review_receipts
      where proposal_id=current_setting('test.hotels_114450_partner_proposal_id')::uuid;
  exception when object_not_in_prerequisite_state then
    v_failed:=true;
  end;
  if not v_failed then raise exception 'seven_arches_provider_review_receipt_mutation_allowed'; end if;
  if not public.hotel_v2_external_calendar_provider_sources_are_attributable()
     or not public.hotel_v2_external_calendar_provider_evolution_is_safe() then
    raise exception 'seven_arches_provider_review_receipt_guard_not_restored'; end if;
end
$provider_review_receipt_immutability$;

select set_config('test.hotels_114450_vault_count_before_secret_negative',
  (select count(*)::text from vault.secrets),true);
select set_config('test.hotels_114450_proposal_count_before_secret_negative',
  (select count(*)::text
   from hotels_v2_private.hotel_external_calendar_partner_proposals),true);
set local role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000002"}',true);
do $partner_secret_validation_negatives$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_partner constant uuid:='20000000-0000-4000-8000-000000000001';
  v_control jsonb; v_source jsonb; v_preview jsonb;
  v_count integer:=0; v_message text;
begin
  v_control:=public.hotel_v2_partner_get_external_calendar_control(c_partner,c_hotel);
  if not exists(select 1 from jsonb_array_elements(v_control->'provider_proposals') proposal
      where (proposal->>'proposal_id')::uuid=
        current_setting('test.hotels_114450_partner_proposal_id')::uuid
        and proposal->>'status'='accepted'
        and proposal->'reviewed_by'='null'::jsonb) then
    raise exception 'seven_arches_partner_provider_review_attribution_not_redacted:%',v_control;
  end if;
  select source into strict v_source from jsonb_array_elements(v_control->'sources') source
    where source->>'source_type'='airbnb'
      and source->>'code'='ground-tertiary';
  begin
    perform public.hotel_v2_partner_preview_external_calendar_plan(jsonb_build_object(
      'contract_version','hotels_v2_external_calendar_draft_v1','hotel_id',c_hotel,
      'partner_id',c_partner,'assignment_id',v_control->'assignment_id',
      'permission_version',v_control->'permission_version',
      'access_snapshot_token',v_control->'access_snapshot_token',
      'snapshot_token',v_control->>'snapshot_token','intent',jsonb_build_object(
        'entity','ical_secret','action','set','id',v_source->'id','expected_version',0,
        'payload',jsonb_build_object('source_id',v_source->'id',
          'ical_url','http://airbnb.example.test/not-https.ics'),
        'reason','Reject non HTTPS private fixture feed')));
  exception when sqlstate '22023' then
    get stacked diagnostics v_message=message_text;
    if v_message='hotels_v2_external_calendar_invalid_secret_payload' then
      v_count:=v_count+1;
    else
      raise;
    end if;
  end;
  v_preview:=public.hotel_v2_partner_preview_external_calendar_plan(jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_draft_v1','hotel_id',c_hotel,
    'partner_id',c_partner,'assignment_id',v_control->'assignment_id',
    'permission_version',v_control->'permission_version',
    'access_snapshot_token',v_control->'access_snapshot_token',
    'snapshot_token',v_control->>'snapshot_token','intent',jsonb_build_object(
      'entity','ical_secret','action','set','id',v_source->'id','expected_version',0,
      'payload',jsonb_build_object('source_id',v_source->'id',
        'ical_url','https://airbnb.example.test/expected.ics'),
      'reason','Reject mismatched private fixture feed')));
  begin
    perform public.hotel_v2_partner_apply_external_calendar_plan(v_preview->'reviewed_plan',
      'e7400000-0000-4000-8000-000000000096',
      'e7410000-0000-4000-8000-000000000096',
      'https://airbnb.example.test/different.ics');
  exception when sqlstate 'PT409' then
    get stacked diagnostics v_message=message_text;
    if v_message='hotels_v2_external_calendar_secret_hash_mismatch' then
      v_count:=v_count+1;
    else
      raise;
    end if;
  end;
  if v_count<>2 then
    raise exception 'seven_arches_partner_secret_validation_negative_count:%',v_count; end if;
end
$partner_secret_validation_negatives$;
reset role;
do $partner_secret_validation_rollback$
begin
  if (select count(*) from vault.secrets)<>
       current_setting('test.hotels_114450_vault_count_before_secret_negative')::integer
     or (select count(*) from hotels_v2_private.hotel_external_calendar_partner_proposals)<>
       current_setting('test.hotels_114450_proposal_count_before_secret_negative')::integer then
    raise exception 'seven_arches_partner_secret_validation_left_partial_state'; end if;
end
$partner_secret_validation_rollback$;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000002"}',true);
do $partner_secret_proposal_submit$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_partner constant uuid:='20000000-0000-4000-8000-000000000001';
  c_url constant text:='https://airbnb.example.test/seven-arches-ground.ics';
  v_control jsonb; v_source jsonb; v_preview jsonb; v_submit jsonb;
begin
  v_control:=public.hotel_v2_partner_get_external_calendar_control(c_partner,c_hotel);
  select source into strict v_source from jsonb_array_elements(v_control->'sources') source
    where source->>'source_type'='airbnb'
      and source->>'code'='ground-tertiary';
  v_preview:=public.hotel_v2_partner_preview_external_calendar_plan(jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_draft_v1','hotel_id',c_hotel,
    'partner_id',c_partner,'assignment_id',v_control->'assignment_id',
    'permission_version',v_control->'permission_version',
    'access_snapshot_token',v_control->'access_snapshot_token',
    'snapshot_token',v_control->>'snapshot_token','intent',jsonb_build_object(
      'entity','ical_secret','action','set','id',v_source->'id','expected_version',0,
      'payload',jsonb_build_object('source_id',v_source->'id','ical_url',c_url),
      'reason','Set reviewed private Airbnb fixture feed')));
  if v_preview::text like '%'||c_url||'%'
     or v_preview::text~'"(ical_url|vault_secret_id|decrypted_secret)"' then
    raise exception 'seven_arches_partner_secret_preview_leaked:%',v_preview; end if;
  v_submit:=public.hotel_v2_partner_apply_external_calendar_plan(v_preview->'reviewed_plan',
    'e7400000-0000-4000-8000-000000000016',
    'e7410000-0000-4000-8000-000000000016',c_url);
  if v_submit#>>'{proposal,status}'<>'pending_admin_review'
     or v_submit::text like '%'||c_url||'%'
     or v_submit::text~'"(ical_url|vault_secret_id|decrypted_secret)"'
     or exists(select 1 from jsonb_array_elements(v_submit#>'{control,sources}') source
       where source->>'id'=v_source->>'id' and source->>'secret_configured'<>'false') then
    raise exception 'seven_arches_partner_secret_submit_mismatch:%',v_submit; end if;
  perform set_config('test.hotels_114450_secret_proposal_id',
    v_submit#>>'{proposal,proposal_id}',true);
  perform set_config('test.hotels_114450_secret_source_id',v_source->>'id',true);
end
$partner_secret_proposal_submit$;
reset role;

do $partner_secret_staging_proof$
declare
  v_proposal hotels_v2_private.hotel_external_calendar_partner_proposals%rowtype;
begin
  select * into strict v_proposal
  from hotels_v2_private.hotel_external_calendar_partner_proposals
  where id=current_setting('test.hotels_114450_secret_proposal_id')::uuid;
  if v_proposal.entity<>'ical_secret' or v_proposal.action<>'set'
     or v_proposal.vault_secret_id is null or v_proposal.url_fingerprint!~'^[0-9a-f]{64}$'
     or (select count(*) from vault.secrets where id=v_proposal.vault_secret_id)<>1
     or exists(select 1 from hotels_v2_private.hotel_external_calendar_source_secrets
       where source_id=v_proposal.source_id) then
    raise exception 'seven_arches_partner_secret_staging_mismatch';
  end if;
  perform set_config('test.hotels_114450_secret_staged_vault_id',
    v_proposal.vault_secret_id::text,true);
  perform set_config('test.hotels_114450_secret_staged_fingerprint',
    v_proposal.url_fingerprint,true);
end
$partner_secret_staging_proof$;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000008"}',true);
do $admin_partner_secret_accept$
declare
  v_proposal uuid:=current_setting('test.hotels_114450_secret_proposal_id')::uuid;
  v_preview jsonb; v_apply jsonb;
begin
  v_preview:=public.hotel_v2_admin_preview_external_calendar_partner_proposal(
    v_proposal,'Accept exact reviewed private Airbnb fixture feed');
  if v_preview::text~'"(ical_url|vault_secret_id|decrypted_secret)"' then
    raise exception 'seven_arches_admin_secret_preview_leaked:%',v_preview; end if;
  v_apply:=public.hotel_v2_admin_apply_external_calendar_partner_proposal(
    v_proposal,v_preview#>'{preview,reviewed_plan}',
    'e7400000-0000-4000-8000-000000000017',
    'e7410000-0000-4000-8000-000000000017',
    'Accept exact reviewed private Airbnb fixture feed');
  if v_apply#>>'{proposal,status}'<>'accepted'
     or v_apply::text~'"(ical_url|vault_secret_id|decrypted_secret)"'
     or not exists(select 1 from jsonb_array_elements(v_apply#>'{apply,control,sources}') source
       where source->>'id'=current_setting('test.hotels_114450_secret_source_id')
         and source->>'secret_configured'='true'
         and (source->>'binding_version')::bigint=1) then
    raise exception 'seven_arches_admin_secret_accept_mismatch:%',v_apply; end if;
end
$admin_partner_secret_accept$;
reset role;

do $partner_secret_binding_proof$
declare
  v_proposal hotels_v2_private.hotel_external_calendar_partner_proposals%rowtype;
  v_binding hotels_v2_private.hotel_external_calendar_source_secrets%rowtype;
begin
  select * into strict v_proposal
  from hotels_v2_private.hotel_external_calendar_partner_proposals
  where id=current_setting('test.hotels_114450_secret_proposal_id')::uuid;
  select * into strict v_binding
  from hotels_v2_private.hotel_external_calendar_source_secrets
  where source_id=v_proposal.source_id;
  if v_proposal.status<>'accepted' or v_proposal.vault_secret_id is not null
     or v_proposal.url_fingerprint is not null
     or v_proposal.result->>'url_fingerprint'<>
       current_setting('test.hotels_114450_secret_staged_fingerprint')
     or v_proposal.result::text~'vault_secret_id'
     or v_binding.vault_secret_id<>
       current_setting('test.hotels_114450_secret_staged_vault_id')::uuid
     or v_binding.url_fingerprint<>
       current_setting('test.hotels_114450_secret_staged_fingerprint')
     or v_binding.version<>1
     or (select count(*) from vault.secrets where id=v_binding.vault_secret_id)<>1 then
    raise exception 'seven_arches_partner_secret_binding_mismatch';
  end if;
  perform set_config('test.hotels_114450_bound_vault_id',v_binding.vault_secret_id::text,true);
  perform set_config('test.hotels_114450_bound_fingerprint',v_binding.url_fingerprint,true);
end
$partner_secret_binding_proof$;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000002"}',true);
do $partner_secret_rotation_reject_submit$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_partner constant uuid:='20000000-0000-4000-8000-000000000001';
  c_url constant text:='https://airbnb.example.test/seven-arches-ground-rotated.ics';
  v_control jsonb; v_source jsonb; v_preview jsonb; v_submit jsonb;
begin
  v_control:=public.hotel_v2_partner_get_external_calendar_control(c_partner,c_hotel);
  select source into strict v_source from jsonb_array_elements(v_control->'sources') source
    where source->>'id'=current_setting('test.hotels_114450_secret_source_id');
  v_preview:=public.hotel_v2_partner_preview_external_calendar_plan(jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_draft_v1','hotel_id',c_hotel,
    'partner_id',c_partner,'assignment_id',v_control->'assignment_id',
    'permission_version',v_control->'permission_version',
    'access_snapshot_token',v_control->'access_snapshot_token',
    'snapshot_token',v_control->>'snapshot_token','intent',jsonb_build_object(
      'entity','ical_secret','action','rotate','id',v_source->'id',
      'expected_version',(v_source->>'binding_version')::bigint,
      'payload',jsonb_build_object('source_id',v_source->'id','ical_url',c_url),
      'reason','Propose rejected private Airbnb feed rotation')));
  v_submit:=public.hotel_v2_partner_apply_external_calendar_plan(v_preview->'reviewed_plan',
    'e7400000-0000-4000-8000-000000000018',
    'e7410000-0000-4000-8000-000000000018',c_url);
  if v_submit#>>'{proposal,status}'<>'pending_admin_review'
     or v_submit::text like '%'||c_url||'%'
     or v_submit::text~'"(ical_url|vault_secret_id|decrypted_secret)"' then
    raise exception 'seven_arches_partner_secret_rotation_submit_mismatch:%',v_submit; end if;
  perform set_config('test.hotels_114450_rotation_proposal_id',
    v_submit#>>'{proposal,proposal_id}',true);
end
$partner_secret_rotation_reject_submit$;
reset role;

do $partner_secret_rotation_staging_proof$
declare v_stage uuid; v_fingerprint text;
begin
  select vault_secret_id,url_fingerprint into strict v_stage,v_fingerprint
  from hotels_v2_private.hotel_external_calendar_partner_proposals
  where id=current_setting('test.hotels_114450_rotation_proposal_id')::uuid;
  if v_stage=current_setting('test.hotels_114450_bound_vault_id')::uuid
     or (select count(*) from vault.secrets where id=v_stage)<>1 then
    raise exception 'seven_arches_partner_secret_rotation_not_staged'; end if;
  perform set_config('test.hotels_114450_rotation_vault_id',v_stage::text,true);
  perform set_config('test.hotels_114450_rotation_fingerprint',v_fingerprint,true);
end
$partner_secret_rotation_staging_proof$;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000008"}',true);
do $admin_partner_secret_rotation_reject$
declare v_result jsonb;
begin
  v_result:=public.hotel_v2_admin_reject_external_calendar_partner_proposal(
    current_setting('test.hotels_114450_rotation_proposal_id')::uuid,
    'Reject private Airbnb feed rotation in focused gate',
    'e7400000-0000-4000-8000-000000000019',
    'e7410000-0000-4000-8000-000000000019');
  if v_result#>>'{proposal,status}'<>'rejected' or v_result->'apply' is distinct from 'null'::jsonb
     or v_result::text~'"(ical_url|vault_secret_id|decrypted_secret)"' then
    raise exception 'seven_arches_admin_secret_rotation_reject_mismatch:%',v_result; end if;
end
$admin_partner_secret_rotation_reject$;
reset role;

do $partner_secret_rotation_cleanup$
declare v_binding hotels_v2_private.hotel_external_calendar_source_secrets%rowtype;
  v_proposal hotels_v2_private.hotel_external_calendar_partner_proposals%rowtype;
begin
  select * into strict v_binding from hotels_v2_private.hotel_external_calendar_source_secrets
  where source_id=current_setting('test.hotels_114450_secret_source_id')::uuid;
  select * into strict v_proposal
  from hotels_v2_private.hotel_external_calendar_partner_proposals
  where id=current_setting('test.hotels_114450_rotation_proposal_id')::uuid;
  if v_binding.vault_secret_id<>current_setting('test.hotels_114450_bound_vault_id')::uuid
     or v_binding.url_fingerprint<>current_setting('test.hotels_114450_bound_fingerprint')
     or v_binding.version<>1
     or v_proposal.status<>'rejected' or v_proposal.vault_secret_id is not null
     or v_proposal.url_fingerprint is not null
     or v_proposal.result->>'url_fingerprint'<>
       current_setting('test.hotels_114450_rotation_fingerprint')
     or v_proposal.result::text~'vault_secret_id'
     or exists(select 1 from vault.secrets
       where id=current_setting('test.hotels_114450_rotation_vault_id')::uuid) then
    raise exception 'seven_arches_partner_secret_rotation_cleanup_failed'; end if;
end
$partner_secret_rotation_cleanup$;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000002"}',true);
do $partner_source_rejection_submit$
declare c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_partner constant uuid:='20000000-0000-4000-8000-000000000001';
  v_control jsonb; v_source jsonb; v_preview jsonb; v_submit jsonb;
begin
  v_control:=public.hotel_v2_partner_get_external_calendar_control(c_partner,c_hotel);
  select source into strict v_source from jsonb_array_elements(v_control->'sources') source
    where source->>'source_type'='airbnb'
      and source->>'code'='ground-tertiary';
  v_preview:=public.hotel_v2_partner_preview_external_calendar_plan(jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_draft_v1','hotel_id',c_hotel,
    'partner_id',c_partner,'assignment_id',v_control->'assignment_id',
    'permission_version',v_control->'permission_version',
    'access_snapshot_token',v_control->'access_snapshot_token',
    'snapshot_token',v_control->>'snapshot_token','intent',jsonb_build_object(
      'entity','calendar_source','action','update','id',v_source->'id',
      'expected_version',(v_source->>'version')::bigint,
      'payload',jsonb_build_object('room_type_id',v_source->'room_type_id',
        'code',v_source->'code','source_type',v_source->'source_type',
        'sync_interval_minutes',(v_source->>'sync_interval_minutes')::integer,
        'units_per_event',(v_source->>'units_per_event')::integer,'priority',21),
      'reason','Propose reviewed Airbnb priority change')));
  v_submit:=public.hotel_v2_partner_apply_external_calendar_plan(v_preview->'reviewed_plan',
    'e7400000-0000-4000-8000-000000000014',
    'e7410000-0000-4000-8000-000000000014',null);
  if v_submit#>>'{proposal,status}'<>'pending_admin_review' then
    raise exception 'seven_arches_partner_reject_submit_mismatch:%',v_submit; end if;
  perform set_config('test.hotels_114450_reject_proposal_id',
    v_submit#>>'{proposal,proposal_id}',true);
  perform set_config('test.hotels_114450_reject_source_id',v_source->>'id',true);
  perform set_config('test.hotels_114450_reject_source_version',v_source->>'version',true);
end
$partner_source_rejection_submit$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000008"}',true);
do $admin_partner_source_reject$
declare
  v_result jsonb;
  v_proposal uuid:=current_setting('test.hotels_114450_reject_proposal_id')::uuid;
begin
  v_result:=public.hotel_v2_admin_reject_external_calendar_partner_proposal(
    v_proposal,'Reject priority change in focused provider gate',
    'e7400000-0000-4000-8000-000000000015',
    'e7410000-0000-4000-8000-000000000015');
  if v_result->>'contract_version'<>
       'hotels_v2_external_calendar_provider_admin_apply_v1'
     or v_result#>>'{proposal,status}'<>'rejected'
     or v_result->'apply' is distinct from 'null'::jsonb then
    raise exception 'seven_arches_admin_provider_reject_mismatch:%',v_result; end if;
end
$admin_partner_source_reject$;
reset role;
do $admin_partner_source_reject_state$
begin
  if (select version from public.hotel_calendar_source_configs
      where id=current_setting('test.hotels_114450_reject_source_id')::uuid)<>
       current_setting('test.hotels_114450_reject_source_version')::bigint then
    raise exception 'seven_arches_admin_provider_reject_source_mutated'; end if;
end
$admin_partner_source_reject_state$;

set local role service_role;
select set_config('request.jwt.claims',
  '{"role":"service_role","sub":"10000000-0000-4000-8000-000000000009"}',true);
do $worker_off$
declare v_list jsonb; v_enqueue jsonb; v_lease jsonb;
begin
  v_list:=public.hotel_v2_external_calendar_worker_list_sources(25);
  if v_list->>'global_enabled'='true' then return; end if;
  v_enqueue:=public.hotel_v2_external_calendar_scheduler_enqueue(25);
  v_lease:=public.hotel_v2_external_calendar_scheduler_lease(25,
    'e7420000-0000-4000-8000-000000000001',180);
  if v_list->>'global_enabled'<>'false' or v_list->'sources'<>'[]'::jsonb
     or v_enqueue->>'queued_count'<>'0' or v_lease->'jobs'<>'[]'::jsonb then
    raise exception 'seven_arches_worker_scheduler_not_inert'; end if;
end
$worker_off$;
reset role;

-- The provider label does not change the reviewed Vault/ICS lifecycle.  Bind
-- one redacted Booking.com URL, then simulate the separately guarded 2F flag
-- transition and prove enable + manual enqueue.  The transaction rolls back;
-- no URL, source, flag or job escapes this focused gate.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000008"}',true);
do $provider_lifecycle$
declare c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_control jsonb; v_preview jsonb; v_apply jsonb; v_source jsonb;
  v_source_id uuid; v_url constant text:='https://calendar.example.com/seven-arches-upper.ics';
begin
  v_control:=public.hotel_v2_admin_get_external_calendar_control(c_hotel);
  select source into strict v_source from jsonb_array_elements(v_control->'sources') source
    where source->>'source_type'='booking_com'
      and source->>'code'='upper-primary';
  v_source_id:=(v_source->>'id')::uuid;
  v_preview:=public.hotel_v2_admin_preview_external_calendar_plan(jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_draft_v1','hotel_id',c_hotel,
    'partner_id',null,'assignment_id',null,'permission_version',null,
    'access_snapshot_token',null,'snapshot_token',v_control->>'snapshot_token','intent',jsonb_build_object(
      'entity','ical_secret','action','set','id',v_source_id,'expected_version',0,
      'payload',jsonb_build_object('source_id',v_source_id,'ical_url',v_url),
      'reason','Bind reviewed Booking.com iCalendar URL')));
  if v_preview::text like '%'||v_url||'%'
     or v_preview#>>'{reviewed_plan,operations,0,payload,secret_configured}'<>'true'
     or v_preview#>>'{impacts,0,after,secret_configured}'<>'true' then
    raise exception 'seven_arches_provider_secret_preview_not_redacted:%',v_preview; end if;
  v_apply:=public.hotel_v2_admin_apply_external_calendar_plan(v_preview->'reviewed_plan',
    'e7400000-0000-4000-8000-000000000004','e7410000-0000-4000-8000-000000000004',v_url);
  if v_apply::text like '%'||v_url||'%' or v_apply::text~'"(ical_url|vault_secret_id)"'
     or v_apply#>>'{control,sources,0,secret_configured}' is null
     or not exists(select 1 from jsonb_array_elements(v_apply#>'{control,sources}') source
       where (source->>'id')::uuid=v_source_id and source->>'secret_configured'='true'
         and (source->>'binding_version')::bigint=1) then
    raise exception 'seven_arches_provider_secret_apply_not_redacted:%',v_apply; end if;
end
$provider_lifecycle$;

reset role;
do $secret_activity_source_attribution_guard$
declare v_failed boolean:=false; v_message text; v_source uuid;
begin
  select id into strict v_source from public.hotel_calendar_source_configs
    where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
      and source_type='booking_com' and code='upper-primary';
  begin
    perform set_config('hotels_v2.external_calendar_apply_context',
      'e7440000-0000-4000-8000-000000000003',true);
    perform set_config('hotels_v2.external_calendar_apply_action','update',true);
    update public.hotel_calendar_source_configs
      set priority=priority+1,version=version+1,updated_at=clock_timestamp()
      where id=v_source;
    if public.hotel_v2_external_calendar_provider_sources_are_attributable()
       or public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_secret_activity_authorized_source_drift';
    end if;
    raise exception 'seven_arches_provider_source_drift_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='seven_arches_provider_source_drift_probe_rollback';
  end;
  if not v_failed then
    raise exception 'seven_arches_provider_source_drift_negative_failed'; end if;
  perform set_config('hotels_v2.external_calendar_apply_context','',true);
  perform set_config('hotels_v2.external_calendar_apply_action','',true);
  if not public.hotel_v2_external_calendar_provider_sources_are_attributable()
     or not public.hotel_v2_external_calendar_provider_evolution_is_safe() then
    raise exception 'seven_arches_provider_source_drift_not_restored'; end if;
end
$secret_activity_source_attribution_guard$;

update public.site_settings set hotel_external_sync_enabled=true
where id=1 and not hotel_external_sync_enabled;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000008"}',true);
do $active_lifecycle$
declare c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_control jsonb; v_preview jsonb; v_apply jsonb; v_source jsonb; v_source_id uuid;
begin
  v_control:=public.hotel_v2_admin_get_external_calendar_control(c_hotel);
  select source into strict v_source from jsonb_array_elements(v_control->'sources') source
    where source->>'source_type'='booking_com'
      and source->>'code'='upper-primary';
  v_source_id:=(v_source->>'id')::uuid;
  v_preview:=public.hotel_v2_admin_preview_external_calendar_plan(jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_draft_v1','hotel_id',c_hotel,
    'partner_id',null,'assignment_id',null,'permission_version',null,
    'access_snapshot_token',null,'snapshot_token',v_control->>'snapshot_token','intent',jsonb_build_object(
      'entity','calendar_source','action','enable','id',v_source_id,
      'expected_version',(v_source->>'version')::bigint,'payload','{}'::jsonb,
      'reason','Enable reviewed Booking.com iCalendar source')));
  v_apply:=public.hotel_v2_admin_apply_external_calendar_plan(v_preview->'reviewed_plan',
    'e7400000-0000-4000-8000-000000000005','e7410000-0000-4000-8000-000000000005',null);
  if not exists(select 1 from jsonb_array_elements(v_apply#>'{control,sources}') source
       where (source->>'id')::uuid=v_source_id and source->>'source_type'='booking_com'
         and source->>'is_enabled'='true' and source->>'secret_configured'='true') then
    raise exception 'seven_arches_provider_enable_failed:%',v_apply; end if;
  v_control:=v_apply->'control';
  select source into strict v_source from jsonb_array_elements(v_control->'sources') source
    where (source->>'id')::uuid=v_source_id;
  v_preview:=public.hotel_v2_admin_preview_external_calendar_plan(jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_draft_v1','hotel_id',c_hotel,
    'partner_id',null,'assignment_id',null,'permission_version',null,
    'access_snapshot_token',null,'snapshot_token',v_control->>'snapshot_token','intent',jsonb_build_object(
      'entity','calendar_sync','action','trigger','id',v_source_id,
      'expected_version',(v_source#>>'{health,state_version}')::bigint,
      'payload',jsonb_build_object('source_id',v_source_id),'reason','Queue reviewed manual sync')));
  v_apply:=public.hotel_v2_admin_apply_external_calendar_plan(v_preview->'reviewed_plan',
    'e7400000-0000-4000-8000-000000000006','e7410000-0000-4000-8000-000000000006',null);
  if v_apply#>>'{activity,0,source}'<>'hotels_v2_external_calendar_control' then
    raise exception 'seven_arches_provider_manual_trigger_failed:%',v_apply; end if;
end
$active_lifecycle$;

reset role;
do $owner_guards$
declare v_failed boolean; v_message text; v_definition text; v_needle text;
begin
  v_failed:=false;
  begin
    update public.hotel_calendar_source_configs set source_type='manual'
      where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' and source_type='booking_com';
  exception when object_not_in_prerequisite_state then
    v_failed:=sqlerrm='hotels_v2_external_calendar_source_field_scope_violation'; end;
  if not v_failed then raise exception 'seven_arches_provider_source_smuggling_allowed'; end if;
  -- A reviewed manual-sync activity leaves an open job; it is not authority
  -- for a later source-row mutation, even with a forged table context.
  v_failed:=false;
  begin
    perform set_config('hotels_v2.external_calendar_apply_context',
      'e7440000-0000-4000-8000-000000000004',true);
    perform set_config('hotels_v2.external_calendar_apply_action','update',true);
    update public.hotel_calendar_source_configs
      set priority=priority+1,version=version+1,updated_at=clock_timestamp()
      where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
        and source_type='booking_com' and code='upper-primary';
  exception when sqlstate 'PT409' then
    v_failed:=sqlerrm='hotels_v2_external_calendar_source_sync_in_progress';
  end;
  perform set_config('hotels_v2.external_calendar_apply_context','',true);
  perform set_config('hotels_v2.external_calendar_apply_action','',true);
  if not v_failed then
    raise exception 'seven_arches_sync_activity_authorized_source_drift'; end if;
  v_failed:=false;
  begin
    update public.hotel_partner_hotel_permissions set request_booking_changes=true
    where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
    if public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_unrelated_drift_was_accepted';
    end if;
    raise exception 'seven_arches_provider_unrelated_drift_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='seven_arches_provider_unrelated_drift_probe_rollback';
  end;
  if not v_failed then raise exception 'seven_arches_provider_unrelated_drift_negative_failed'; end if;
  v_failed:=false;
  begin
    update public.site_settings set hotel_instant_booking_enabled=true where id=1;
    if public.hotel_v2_external_calendar_site_settings_fingerprint() is not null
       or public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_site_settings_drift_was_accepted';
    end if;
    raise exception 'seven_arches_provider_site_settings_drift_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='seven_arches_provider_site_settings_drift_probe_rollback';
  end;
  if not v_failed then raise exception 'seven_arches_provider_site_settings_drift_negative_failed'; end if;
  v_failed:=false;
  begin
    v_definition:=pg_get_functiondef(
      'public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)'::regprocedure);
    v_needle:='where draft.assignment_id=(v_access->>''assignment_id'')::uuid'
      ||E'\n    and draft.status=''pending_admin_review'';';
    if (length(v_definition)-length(replace(v_definition,v_needle,'')))/length(v_needle)<>1 then
      raise exception 'seven_arches_provider_workspace_lineage_probe_source_drift';
    end if;
    execute replace(v_definition,v_needle,
      'where draft.assignment_id=(v_access->>''assignment_id'')::uuid'
        ||E'\n    and (draft.status=''pending_admin_review'');');
    if public.hotel_v2_partner_workspace_function_lineage_is_exact()
       or public.hotel_v2_external_calendar_site_settings_fingerprint() is not null
       or public.hotel_v2_external_calendar_provider_evolution_is_safe() then
      raise exception 'seven_arches_provider_workspace_lineage_drift_was_accepted';
    end if;
    raise exception 'seven_arches_provider_workspace_lineage_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_failed:=v_message='seven_arches_provider_workspace_lineage_probe_rollback';
  end;
  if not v_failed then raise exception 'seven_arches_provider_workspace_lineage_negative_failed'; end if;
  if not public.hotel_v2_partner_workspace_function_lineage_is_exact()
     or public.hotel_v2_external_calendar_site_settings_fingerprint() is null then
    raise exception 'seven_arches_provider_workspace_lineage_not_restored';
  end if;
  if not public.hotel_v2_external_calendar_provider_evolution_is_safe() then
    raise exception 'seven_arches_provider_evolution_not_safe'; end if;
end
$owner_guards$;

set local role service_role;
select set_config('request.jwt.claims',
  '{"role":"service_role","sub":"10000000-0000-4000-8000-000000000009"}',true);
do $worker_active$
declare
  v_list jsonb; v_enqueue jsonb; v_lease jsonb; v_job jsonb;
  v_payload jsonb; v_result jsonb;
  v_started timestamptz:=clock_timestamp();
  v_attempt constant uuid:='e7460000-0000-4000-8000-000000000001';
begin
  v_list:=public.hotel_v2_external_calendar_worker_list_sources(25);
  v_enqueue:=public.hotel_v2_external_calendar_scheduler_enqueue(25);
  v_lease:=public.hotel_v2_external_calendar_scheduler_lease(25,
    'e7420000-0000-4000-8000-000000000001',180);
  if v_list->>'global_enabled'<>'true'
     or not exists(select 1 from jsonb_array_elements(v_list->'sources') source
       where source->>'source_type'='booking_com')
     or v_enqueue->>'queued_count'<>'0' or jsonb_array_length(v_lease->'jobs')<>1
     or v_lease#>>'{jobs,0,trigger_type}'<>'manual' then
    raise exception 'seven_arches_worker_scheduler_active_mismatch'; end if;
  v_job:=v_lease#>'{jobs,0}';
  v_payload:=jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_worker_begin_v1',
    'job_id',v_job->'job_id','lease_token',v_job->'lease_token',
    'source_id',v_job->'source_id','hotel_id',v_job->'hotel_id',
    'room_type_id',v_job->'room_type_id','source_version',v_job->'source_version',
    'binding_version',v_job->'binding_version','trigger_type',v_job->'trigger_type',
    'attempt_id',v_attempt,'started_at',v_started);
  v_result:=public.hotel_v2_external_calendar_worker_begin_sync(v_payload);
  if v_result->>'status'<>'running' then
    raise exception 'seven_arches_worker_begin_mismatch:%',v_result; end if;
  v_payload:=jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_worker_finalize_v1',
    'job_id',v_job->'job_id','lease_token',v_job->'lease_token',
    'source_id',v_job->'source_id','hotel_id',v_job->'hotel_id',
    'room_type_id',v_job->'room_type_id','source_version',v_job->'source_version',
    'binding_version',v_job->'binding_version','trigger_type',v_job->'trigger_type',
    'attempt_id',v_attempt,'started_at',v_started,'finished_at',clock_timestamp(),
    'http_status',200,'content_fingerprint',repeat('a',64),
    'events',jsonb_build_array(jsonb_build_object(
      'external_uid_hash',repeat('b',64),'recurrence_id_hash',null,
      'event_fingerprint',repeat('c',64),'starts_on',current_date+20,
      'ends_on',current_date+22,'event_status','active','source_sequence',1,
      'source_last_modified_at',null)));
  v_result:=public.hotel_v2_external_calendar_worker_finalize_sync(v_payload);
  if v_result->>'status'<>'succeeded'
     or (v_result->>'active_day_block_count')::integer<>2
     or (public.hotel_v2_external_calendar_worker_finalize_sync(v_payload)->>'replayed')::boolean
          is not true then
    raise exception 'seven_arches_worker_finalize_mismatch:%',v_result; end if;
end
$worker_active$;
reset role;

set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $room_aware_provider_availability$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_upper constant uuid:='b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
  c_upper_rate constant uuid:='7e420964-9cbf-4f1b-abd3-09840af5240f';
  c_ground constant uuid:='825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
  c_ground_rate constant uuid:='3320590d-632d-423f-80d0-fd021cba7293';
  v_request jsonb; v_quote jsonb; v_failed boolean:=false;
begin
  v_request:=jsonb_build_object(
    'contract_version','hotels_v2_seven_arches_public_quote_request_v1',
    'hotel_id',c_hotel,'room_type_id',c_upper,'room_rate_id',c_upper_rate,
    'arrival_date',current_date+20,'departure_date',current_date+22,
    'guest_count',2,'selected_extra_ids','[]'::jsonb);
  begin
    perform public.hotel_v2_public_quote_seven_arches(v_request);
  exception when sqlstate 'PT409' then
    v_failed:=sqlerrm='hotels_v2_seven_arches_public_quote_room_unavailable';
  end;
  if not v_failed then
    raise exception 'seven_arches_upper_calendar_block_not_enforced'; end if;

  v_quote:=public.hotel_v2_public_quote_seven_arches(v_request||jsonb_build_object(
    'room_type_id',c_ground,'room_rate_id',c_ground_rate));
  if v_quote->>'room_type_id'<>c_ground::text
     or v_quote#>>'{allocation,0,room_type_id}'<>c_ground::text then
    raise exception 'seven_arches_ground_was_cross_room_blocked:%',v_quote; end if;

  v_failed:=false;
  begin
    perform public.hotel_v2_public_quote_seven_arches(v_request||jsonb_build_object(
      'room_type_id',null,'room_rate_id',null,'guest_count',5));
  exception when sqlstate 'PT409' then
    v_failed:=sqlerrm='hotels_v2_seven_arches_public_quote_room_unavailable';
  end;
  if not v_failed then
    raise exception 'seven_arches_bundle_calendar_block_not_enforced'; end if;
end
$room_aware_provider_availability$;
reset role;
do $room_aware_provider_commission$
begin
  if not public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()
     or not public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()
     or not exists(select 1 from public.hotel_commission_policies commission
      where commission.hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
        and commission.is_active and commission.review_status='reviewed'
        and commission.commission_mode='per_allocated_room_per_night'
        and commission.amount=10 and commission.currency='EUR') then
    raise exception 'seven_arches_calendar_mutated_pricing_or_commission';
  end if;
end
$room_aware_provider_commission$;

rollback;

do $provider_rollback_containment$
declare v_before seven_arches_provider_gate_before%rowtype;
begin
  select * into strict v_before from seven_arches_provider_gate_before;
  if (select count(*) from public.hotel_calendar_source_configs
      where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' and source_type<>'manual')<>
       v_before.source_count
     or (select count(*) from hotels_v2_private.hotel_external_calendar_source_secrets
       where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca')<>v_before.binding_count
     or (select count(*) from hotels_v2_private.hotel_external_calendar_partner_proposals)<>
       v_before.proposal_count
     or (select count(*) from hotels_v2_private.hotel_external_calendar_provider_review_receipts)<>
       v_before.review_receipt_count
     or (select count(*) from hotels_v2_private.hotel_external_calendar_provider_admin_previews)<>
       v_before.admin_preview_count
     or (select count(*) from hotels_v2_private.hotel_external_calendar_plan_reviews)<>
       v_before.plan_review_count
     or (select count(*) from vault.secrets)<>v_before.vault_count
     or (select count(*) from public.hotel_activity_log)<>v_before.activity_count
     or (select count(*) from hotels_v2_private.hotel_external_calendar_admin_receipts)<>
       v_before.admin_receipt_count
     or (select count(*) from public.hotel_partner_action_receipts)<>
       v_before.partner_receipt_count
     or (select count(*) from hotels_v2_private.hotel_external_calendar_sync_jobs)<>v_before.job_count
     or (select count(*) from hotels_v2_private.hotel_external_calendar_day_blocks)<>v_before.block_count
     or public.hotel_v2_seven_arches_reviewed_pricing_current_state()
       is distinct from v_before.pricing_state
     or exists(select 1 from hotels_v2_private.hotel_external_calendar_correlations)
     or exists(select 1 from seven_arches_provider_worker_secrets_before before_secret
       full join (select secret.id,secret.name,secret.created_at,secret.updated_at
         from vault.secrets secret
         where secret.name in('hotels-v2-external-calendar-worker-url',
           'hotels-v2-external-calendar-worker-shared-secret')) current_secret
       using(id,name,created_at,updated_at)
       where before_secret.id is null or current_secret.id is null)
     or not public.hotel_v2_external_calendar_provider_evolution_is_safe()
     or not public.hotel_v2_external_calendar_provider_sources_are_attributable() then
    raise exception using errcode='55000',
      message='seven_arches_provider_rollback_containment_failed';
  end if;
end
$provider_rollback_containment$;

\if :provider_install_external_enabled
do $active_install_postcondition$
begin
  if not (select hotel_external_sync_enabled from public.site_settings where id=1)
     or public.hotel_v2_external_calendar_site_settings_fingerprint() is null
     or not public.hotel_v2_partner_workspace_function_lineage_is_exact()
     or not public.hotel_v2_external_calendar_provider_evolution_is_safe() then
    raise exception 'seven_arches_provider_active_install_postcondition_failed';
  end if;
end
$active_install_postcondition$;
\ir ../../supabase/manual/hotels_v2_external_calendar_provider_types_verify.sql
\else
\ir ../../supabase/manual/hotels_v2_external_calendar_provider_types_verify.sql
\endif
select 'HOTELS_V2_7A_EXTERNAL_CALENDAR_PROVIDER_READINESS_POSTGRES_GATE_OK' sentinel,
  3 supported_providers,2 exact_room_scopes,
  2 partner_proposals_accepted,2 partner_proposals_rejected,
  1 staged_secret_promoted,1 staged_secret_rejection_cleaned,
  1 reviewed_pricing_change_after_provider_install,
  2 synced_upper_day_blocks,3 room_aware_quote_assertions,
  3 site_settings_representation_positive_probes,
  11 site_settings_representation_negative_probes,
  14 site_settings_receipt_negative_probes,
  true private_url_redacted,true timezone_stable,true rollback_contained;
