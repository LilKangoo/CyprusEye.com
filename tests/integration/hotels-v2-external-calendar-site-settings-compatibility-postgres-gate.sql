\set ON_ERROR_STOP on

-- Build the reviewed local production shape through 114400 only. Keep the
-- external-calendar flag OFF while 114400 installs because that migration
-- predates the 114425 compatibility seam. The live-drift fixture changes the
-- unrelated force_refresh/updated_at/updated_by/car_* columns after the
-- immutable 114350 receipt was captured.
\set provider_install_external_enabled false
\set seven_arches_owner_live_drift_fixture 1
\ir hotels-v2-seven-arches-pricing-activation-postgres-base.sql
\ir ../../supabase/manual/hotels_v2_seven_arches_pricing_activation_preflight.sql
\ir ../../supabase/migrations/20260811440000_hotels_v2_seven_arches_pricing_activation.sql

-- The new preflight must accept the supported OFF lifecycle despite unrelated
-- mutable site_settings drift.
\ir ../../supabase/manual/hotels_v2_external_calendar_site_settings_compatibility_preflight.sql

-- Materialize the same local-only Vault and scheduler evidence used by the
-- existing production-style Stage2F fixture, then prove the preflight also
-- accepts ON. No secret value is selected or emitted by this gate.
select vault.create_secret(
  'https://daoohnbnnowmmcizgvrq.functions.supabase.co/hotels-v2-external-calendar-sync',
  'hotels-v2-external-calendar-worker-url',
  '114425 local production-style worker URL',null)
where not exists(select 1 from vault.decrypted_secrets
  where name='hotels-v2-external-calendar-worker-url');
select vault.create_secret(
  '114425-local-only-shared-secret-0123456789abcdef',
  'hotels-v2-external-calendar-worker-shared-secret',
  '114425 local production-style scoped worker secret',null)
where not exists(select 1 from vault.decrypted_secrets
  where name='hotels-v2-external-calendar-worker-shared-secret');
create schema if not exists cron;
create table if not exists cron.job(
  jobid bigint generated always as identity primary key,
  jobname text not null unique,
  schedule text not null,
  command text not null,
  active boolean not null default true
);
insert into cron.job(jobname,schedule,command,active)
values('hotels-v2-external-calendar-15m','*/15 * * * *',
  'select public.hotel_v2_external_calendar_scheduler_dispatch()',true)
on conflict(jobname) do update set schedule=excluded.schedule,
  command=excluded.command,active=excluded.active;
update public.site_settings set
  hotel_external_sync_enabled=true,
  force_refresh_version=force_refresh_version+1,
  updated_at=clock_timestamp(),
  updated_by='36000000-0000-4000-8000-000000000102'
where id=1;

do $production_style_on$
begin
  if (select count(*) from public.site_settings)<>1
     or not exists(select 1 from public.site_settings setting where setting.id=1
       and setting.hotel_external_sync_enabled
       and setting.car_multi_city_mapped_enabled
       and setting.car_threshold_daily_rates_enabled
       and setting.force_refresh_version=80
       and setting.updated_at is not null
       and setting.updated_by='36000000-0000-4000-8000-000000000102')
     or not exists(select 1 from vault.decrypted_secrets
       where name='hotels-v2-external-calendar-worker-url')
     or not exists(select 1 from vault.decrypted_secrets
       where name='hotels-v2-external-calendar-worker-shared-secret')
     or not exists(select 1 from cron.job where
       jobname='hotels-v2-external-calendar-15m'
       and schedule='*/15 * * * *'
       and command='select public.hotel_v2_external_calendar_scheduler_dispatch()'
       and active) then
    raise exception 'external_calendar_site_settings_production_style_on_fixture_failed';
  end if;
end
$production_style_on$;

\ir ../../supabase/manual/hotels_v2_external_calendar_site_settings_compatibility_preflight.sql
\ir ../../supabase/migrations/20260811442500_hotels_v2_external_calendar_site_settings_compatibility.sql
\ir ../../supabase/manual/hotels_v2_external_calendar_site_settings_compatibility_verify.sql

-- Exercise the installed verifier itself in both supported lifecycle states.
update public.site_settings set hotel_external_sync_enabled=false where id=1;
\ir ../../supabase/manual/hotels_v2_external_calendar_site_settings_compatibility_verify.sql
update public.site_settings set hotel_external_sync_enabled=true where id=1;
\ir ../../supabase/manual/hotels_v2_external_calendar_site_settings_compatibility_verify.sql

-- The canonical value deliberately describes the allowed two-state Hotels
-- lifecycle, not the current ON/OFF value or unrelated mutable columns.
do $supported_lifecycle_and_unrelated_drift$
declare
  v_expected text:=public.hotel_v2_external_calendar_worker_hash(
    jsonb_build_object(
      'contract_version','hotels_v2_external_calendar_site_settings_lifecycle_v2',
      'id',1,
      'hotel_rooms_v2_enabled',false,
      'hotel_external_sync_enabled_supported_values',jsonb_build_array(false,true),
      'hotel_instant_booking_enabled',false,
      'hotel_stripe_connect_enabled',false));
  v_on text;
  v_off text;
begin
  v_on:=public.hotel_v2_external_calendar_site_settings_fingerprint();
  if v_on is distinct from v_expected then
    raise exception 'external_calendar_site_settings_on_fingerprint_failed:%',v_on;
  end if;

  update public.site_settings set hotel_external_sync_enabled=false where id=1;
  v_off:=public.hotel_v2_external_calendar_site_settings_fingerprint();
  if v_off is distinct from v_expected or v_off is distinct from v_on then
    raise exception 'external_calendar_site_settings_off_fingerprint_failed:on %, off %',
      v_on,v_off;
  end if;

  update public.site_settings set
    car_multi_city_mapped_enabled=false,
    car_threshold_daily_rates_enabled=false,
    force_refresh_version=force_refresh_version+17,
    updated_at=clock_timestamp()+interval '1 minute',
    updated_by='36000000-0000-4000-8000-000000000101'
  where id=1;
  if public.hotel_v2_external_calendar_site_settings_fingerprint()
       is distinct from v_expected then
    raise exception 'external_calendar_site_settings_unrelated_false_drift_rejected';
  end if;

  update public.site_settings set
    hotel_external_sync_enabled=true,
    car_multi_city_mapped_enabled=true,
    car_threshold_daily_rates_enabled=true,
    force_refresh_version=force_refresh_version+19,
    updated_at=clock_timestamp()+interval '2 minutes',
    updated_by='36000000-0000-4000-8000-000000000102'
  where id=1;
  if public.hotel_v2_external_calendar_site_settings_fingerprint()
       is distinct from v_expected then
    raise exception 'external_calendar_site_settings_unrelated_true_drift_rejected';
  end if;
end
$supported_lifecycle_and_unrelated_drift$;

-- Every negative probe is an exception subtransaction. The deliberate final
-- exception rolls back the flag/function/receipt mutation before the next
-- case, and every case rechecks the accepted production-style ON baseline.
do $site_settings_compatibility_negatives$
declare
  c_site_helper_source_hash constant text:=
    'e297f1b640f544644d695b36b4aca0b2dc90385e83709e8a494044aabc3b95bd';
  v_expected text:=public.hotel_v2_external_calendar_site_settings_fingerprint();
  v_message text;
  v_rolled_back boolean;
  v_rejected boolean;
  v_sqlstate text;
  v_source_hash text;
  v_constraint_name text;
  v_constraint record;
  v_definition text;
  v_needle text;
begin
  if v_expected is null then
    raise exception 'external_calendar_site_settings_negative_baseline_failed';
  end if;
  select encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')
  into strict v_source_hash
  from pg_proc procedure_row where procedure_row.oid=
    'public.hotel_v2_external_calendar_site_settings_fingerprint()'::regprocedure;
  if v_source_hash is distinct from c_site_helper_source_hash then
    raise exception 'external_calendar_site_settings_helper_source_baseline_failed:%',
      v_source_hash;
  end if;

  v_rolled_back:=false;
  begin
    update public.site_settings set hotel_rooms_v2_enabled=true where id=1;
    if public.hotel_v2_external_calendar_site_settings_fingerprint() is not null then
      raise exception 'external_calendar_site_settings_rooms_true_accepted';
    end if;
    raise exception 'external_calendar_site_settings_rooms_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=v_message='external_calendar_site_settings_rooms_probe_rollback';
  end;
  if not v_rolled_back
     or public.hotel_v2_external_calendar_site_settings_fingerprint()
       is distinct from v_expected then
    raise exception 'external_calendar_site_settings_rooms_negative_failed';
  end if;

  v_rolled_back:=false;
  begin
    update public.site_settings set hotel_instant_booking_enabled=true where id=1;
    if public.hotel_v2_external_calendar_site_settings_fingerprint() is not null then
      raise exception 'external_calendar_site_settings_instant_true_accepted';
    end if;
    raise exception 'external_calendar_site_settings_instant_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=v_message='external_calendar_site_settings_instant_probe_rollback';
  end;
  if not v_rolled_back
     or public.hotel_v2_external_calendar_site_settings_fingerprint()
       is distinct from v_expected then
    raise exception 'external_calendar_site_settings_instant_negative_failed';
  end if;

  v_rolled_back:=false;
  begin
    update public.site_settings set hotel_stripe_connect_enabled=true where id=1;
    if public.hotel_v2_external_calendar_site_settings_fingerprint() is not null then
      raise exception 'external_calendar_site_settings_stripe_true_accepted';
    end if;
    raise exception 'external_calendar_site_settings_stripe_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=v_message='external_calendar_site_settings_stripe_probe_rollback';
  end;
  if not v_rolled_back
     or public.hotel_v2_external_calendar_site_settings_fingerprint()
       is distinct from v_expected then
    raise exception 'external_calendar_site_settings_stripe_negative_failed';
  end if;

  v_rolled_back:=false;
  begin
    alter table hotels_v2_private.hotel_external_calendar_activation_receipts
      disable trigger hotel_external_calendar_activation_receipt_immutable;
    delete from hotels_v2_private.hotel_external_calendar_activation_receipts;
    if public.hotel_v2_external_calendar_site_settings_fingerprint() is not null then
      raise exception 'external_calendar_site_settings_missing_on_receipt_accepted';
    end if;
    raise exception 'external_calendar_site_settings_missing_on_receipt_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=
      v_message='external_calendar_site_settings_missing_on_receipt_probe_rollback';
  end;
  if not v_rolled_back
     or public.hotel_v2_external_calendar_site_settings_fingerprint()
       is distinct from v_expected then
    raise exception 'external_calendar_site_settings_missing_on_receipt_negative_failed';
  end if;

  v_rolled_back:=false;
  begin
    alter table hotels_v2_private.hotel_external_calendar_activation_receipts
      disable trigger hotel_external_calendar_activation_receipt_immutable;
    update hotels_v2_private.hotel_external_calendar_activation_receipts set
      compatibility_function_fingerprints=jsonb_set(
        compatibility_function_fingerprints,
        array['public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)'],
        to_jsonb('corrupt-fingerprint'::text),false)
    where id=1;
    if public.hotel_v2_external_calendar_site_settings_fingerprint() is not null then
      raise exception 'external_calendar_site_settings_corrupt_fingerprint_accepted';
    end if;
    raise exception 'external_calendar_site_settings_corrupt_fingerprint_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=
      v_message='external_calendar_site_settings_corrupt_fingerprint_probe_rollback';
  end;
  if not v_rolled_back
     or public.hotel_v2_external_calendar_site_settings_fingerprint()
       is distinct from v_expected then
    raise exception 'external_calendar_site_settings_corrupt_fingerprint_negative_failed';
  end if;

  -- A malformed non-object receipt must take the named envelope path, never
  -- reach jsonb_object_keys/jsonb_each_text and surface an anonymous SQL error.
  select constraint_row.conname into strict v_constraint_name
  from pg_constraint constraint_row
  where constraint_row.conrelid=
      'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
    and constraint_row.contype='c'
    and constraint_row.conkey=array[3]::smallint[];
  v_rolled_back:=false;
  begin
    execute format(
      'alter table hotels_v2_private.hotel_external_calendar_activation_receipts drop constraint %I',
      v_constraint_name);
    alter table hotels_v2_private.hotel_external_calendar_activation_receipts
      disable trigger hotel_external_calendar_activation_receipt_immutable;
    update hotels_v2_private.hotel_external_calendar_activation_receipts
      set compatibility_function_fingerprints='[]'::jsonb where id=1;
    v_rejected:=false;
    begin
      v_rejected:=
        public.hotel_v2_external_calendar_site_settings_fingerprint() is null;
    exception when others then
      get stacked diagnostics v_sqlstate=returned_sqlstate;
      raise exception 'external_calendar_site_settings_malformed_receipt_raw_sql_error:%',
        v_sqlstate;
    end;
    if not v_rejected then
      raise exception 'external_calendar_site_settings_malformed_receipt_json_accepted';
    end if;
    raise exception 'external_calendar_site_settings_malformed_receipt_json_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=
      v_message='external_calendar_site_settings_malformed_receipt_json_probe_rollback';
  end;
  if not v_rolled_back
     or public.hotel_v2_external_calendar_site_settings_fingerprint()
       is distinct from v_expected then
    raise exception 'external_calendar_site_settings_malformed_receipt_json_named_failure';
  end if;

  v_rolled_back:=false;
  begin
    for v_constraint in
      select constraint_row.conname
      from pg_constraint constraint_row
      where constraint_row.conrelid=
        'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
        and constraint_row.contype in('p','c')
    loop
      execute format(
        'alter table hotels_v2_private.hotel_external_calendar_activation_receipts drop constraint %I',
        v_constraint.conname);
    end loop;
    alter table hotels_v2_private.hotel_external_calendar_activation_receipts
      disable trigger hotel_external_calendar_activation_receipt_immutable;
    insert into hotels_v2_private.hotel_external_calendar_activation_receipts(
      id,site_settings_without_external_fingerprint,
      compatibility_function_fingerprints,created_at)
    select 2,site_settings_without_external_fingerprint,
      compatibility_function_fingerprints,created_at
    from hotels_v2_private.hotel_external_calendar_activation_receipts where id=1;
    if public.hotel_v2_external_calendar_site_settings_fingerprint() is not null then
      raise exception 'external_calendar_site_settings_extra_receipt_accepted';
    end if;
    raise exception 'external_calendar_site_settings_extra_receipt_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=v_message='external_calendar_site_settings_extra_receipt_probe_rollback';
  end;
  if not v_rolled_back
     or public.hotel_v2_external_calendar_site_settings_fingerprint()
       is distinct from v_expected then
    raise exception 'external_calendar_site_settings_extra_receipt_negative_failed';
  end if;

  v_rolled_back:=false;
  begin
    alter table hotels_v2_private.hotel_external_calendar_activation_receipts
      disable trigger hotel_external_calendar_activation_receipt_immutable;
    update hotels_v2_private.hotel_external_calendar_activation_receipts
      set created_at='infinity'::timestamptz where id=1;
    if public.hotel_v2_external_calendar_site_settings_fingerprint() is not null then
      raise exception 'external_calendar_site_settings_infinite_created_at_accepted';
    end if;
    raise exception 'external_calendar_site_settings_created_at_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=v_message='external_calendar_site_settings_created_at_probe_rollback';
  end;
  if not v_rolled_back
     or public.hotel_v2_external_calendar_site_settings_fingerprint()
       is distinct from v_expected then
    raise exception 'external_calendar_site_settings_created_at_negative_failed';
  end if;

  v_rolled_back:=false;
  begin
    alter table hotels_v2_private.hotel_external_calendar_activation_receipts
      alter column created_at drop default;
    if public.hotel_v2_external_calendar_site_settings_fingerprint() is not null then
      raise exception 'external_calendar_site_settings_created_at_default_drift_accepted';
    end if;
    raise exception 'external_calendar_site_settings_created_at_default_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=
      v_message='external_calendar_site_settings_created_at_default_probe_rollback';
  end;
  if not v_rolled_back
     or public.hotel_v2_external_calendar_site_settings_fingerprint()
       is distinct from v_expected then
    raise exception 'external_calendar_site_settings_created_at_default_negative_failed';
  end if;

  select constraint_row.conname into strict v_constraint_name
  from pg_constraint constraint_row
  where constraint_row.conrelid=
      'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
    and constraint_row.contype='c'
    and constraint_row.conkey=array[2]::smallint[];
  v_rolled_back:=false;
  begin
    execute format(
      'alter table hotels_v2_private.hotel_external_calendar_activation_receipts drop constraint %I',
      v_constraint_name);
    if public.hotel_v2_external_calendar_site_settings_fingerprint() is not null then
      raise exception 'external_calendar_site_settings_catalog_constraint_drift_accepted';
    end if;
    raise exception 'external_calendar_site_settings_catalog_constraint_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=
      v_message='external_calendar_site_settings_catalog_constraint_probe_rollback';
  end;
  if not v_rolled_back
     or public.hotel_v2_external_calendar_site_settings_fingerprint()
       is distinct from v_expected then
    raise exception 'external_calendar_site_settings_catalog_constraint_negative_failed';
  end if;

  v_rolled_back:=false;
  begin
    alter table hotels_v2_private.hotel_external_calendar_activation_receipts
      disable trigger hotel_external_calendar_activation_receipt_immutable;
    if public.hotel_v2_external_calendar_site_settings_fingerprint() is not null then
      raise exception 'external_calendar_site_settings_receipt_trigger_drift_accepted';
    end if;
    raise exception 'external_calendar_site_settings_receipt_trigger_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=
      v_message='external_calendar_site_settings_receipt_trigger_probe_rollback';
  end;
  if not v_rolled_back
     or public.hotel_v2_external_calendar_site_settings_fingerprint()
       is distinct from v_expected then
    raise exception 'external_calendar_site_settings_receipt_trigger_negative_failed';
  end if;

  v_rolled_back:=false;
  begin
    grant select on
      hotels_v2_private.hotel_external_calendar_activation_receipts
      to authenticated;
    if public.hotel_v2_external_calendar_site_settings_fingerprint() is not null then
      raise exception 'external_calendar_site_settings_receipt_acl_drift_accepted';
    end if;
    raise exception 'external_calendar_site_settings_receipt_acl_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=v_message='external_calendar_site_settings_receipt_acl_probe_rollback';
  end;
  if not v_rolled_back
     or public.hotel_v2_external_calendar_site_settings_fingerprint()
       is distinct from v_expected then
    raise exception 'external_calendar_site_settings_receipt_acl_negative_failed';
  end if;

  v_rolled_back:=false;
  begin
    grant usage on schema hotels_v2_private to anon;
    if public.hotel_v2_external_calendar_site_settings_fingerprint() is not null then
      raise exception 'external_calendar_site_settings_private_schema_acl_drift_accepted';
    end if;
    raise exception 'external_calendar_site_settings_private_schema_acl_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=
      v_message='external_calendar_site_settings_private_schema_acl_probe_rollback';
  end;
  if not v_rolled_back
     or public.hotel_v2_external_calendar_site_settings_fingerprint()
       is distinct from v_expected then
    raise exception 'external_calendar_site_settings_private_schema_acl_negative_failed';
  end if;

  v_rolled_back:=false;
  begin
    grant create on schema public to authenticated;
    alter function
      public.hotel_v2_external_calendar_activation_function_fingerprints()
      owner to authenticated;
    if public.hotel_v2_external_calendar_site_settings_fingerprint() is not null then
      raise exception 'external_calendar_site_settings_dependency_owner_drift_accepted';
    end if;
    raise exception 'external_calendar_site_settings_dependency_owner_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=
      v_message='external_calendar_site_settings_dependency_owner_probe_rollback';
  end;
  if not v_rolled_back
     or public.hotel_v2_external_calendar_site_settings_fingerprint()
       is distinct from v_expected then
    raise exception 'external_calendar_site_settings_dependency_owner_negative_failed';
  end if;

  v_rolled_back:=false;
  begin
    alter function
      public.hotel_v2_external_calendar_activation_function_fingerprints()
      set search_path=public;
    if public.hotel_v2_external_calendar_site_settings_fingerprint() is not null then
      raise exception 'external_calendar_site_settings_dependency_search_path_drift_accepted';
    end if;
    raise exception 'external_calendar_site_settings_dependency_search_path_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=
      v_message='external_calendar_site_settings_dependency_search_path_probe_rollback';
  end;
  if not v_rolled_back
     or public.hotel_v2_external_calendar_site_settings_fingerprint()
       is distinct from v_expected then
    raise exception 'external_calendar_site_settings_dependency_search_path_negative_failed';
  end if;

  v_rolled_back:=false;
  begin
    grant execute on function
      public.hotel_v2_external_calendar_activation_function_fingerprints()
      to authenticated;
    if public.hotel_v2_external_calendar_site_settings_fingerprint() is not null then
      raise exception 'external_calendar_site_settings_dependency_acl_drift_accepted';
    end if;
    raise exception 'external_calendar_site_settings_dependency_acl_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=
      v_message='external_calendar_site_settings_dependency_acl_probe_rollback';
  end;
  if not v_rolled_back
     or public.hotel_v2_external_calendar_site_settings_fingerprint()
       is distinct from v_expected then
    raise exception 'external_calendar_site_settings_dependency_acl_negative_failed';
  end if;

  -- Source pinning is independent of the lineage helper's owner/search path
  -- and ACL metadata. A semantically harmless body edit must still fail.
  v_definition:=pg_get_functiondef(
    'public.hotel_v2_partner_workspace_function_lineage_is_exact()'::regprocedure);
  v_needle:='if v_oid is null then return false; end if;';
  if (length(v_definition)-length(replace(v_definition,v_needle,'')))
       /length(v_needle)<>1 then
    raise exception 'external_calendar_site_settings_lineage_helper_probe_source_drift';
  end if;
  v_rolled_back:=false;
  begin
    execute replace(v_definition,v_needle,
      'if (v_oid is null) then return false; end if;');
    if public.hotel_v2_partner_workspace_function_lineage_is_exact()
         is not distinct from true
       or public.hotel_v2_external_calendar_site_settings_fingerprint() is not null then
      raise exception 'external_calendar_site_settings_lineage_helper_source_drift_accepted';
    end if;
    raise exception 'external_calendar_site_settings_lineage_helper_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=
      v_message='external_calendar_site_settings_lineage_helper_probe_rollback';
  end;
  if not v_rolled_back
     or public.hotel_v2_external_calendar_site_settings_fingerprint()
       is distinct from v_expected then
    raise exception 'external_calendar_site_settings_lineage_helper_negative_failed';
  end if;

  -- A NULL canonical hash is never a valid success value. Mutate only the
  -- frozen hash body, prove both the direct expected value and installed seam
  -- fail closed, then roll the function definition back.
  v_rolled_back:=false;
  begin
    create or replace function public.hotel_v2_external_calendar_worker_hash(p_value jsonb)
    returns text language sql immutable security definer set search_path=pg_catalog
    as $expected_null$select null::text$expected_null$;
    if public.hotel_v2_external_calendar_worker_hash(jsonb_build_object(
         'contract_version','hotels_v2_external_calendar_site_settings_lifecycle_v2',
         'id',1,
         'hotel_rooms_v2_enabled',false,
         'hotel_external_sync_enabled_supported_values',jsonb_build_array(false,true),
         'hotel_instant_booking_enabled',false,
         'hotel_stripe_connect_enabled',false)) is not null
       or public.hotel_v2_external_calendar_site_settings_fingerprint() is not null then
      raise exception 'external_calendar_site_settings_expected_hash_null_accepted';
    end if;
    raise exception 'external_calendar_site_settings_expected_hash_null_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=
      v_message='external_calendar_site_settings_expected_hash_null_probe_rollback';
  end;
  if not v_rolled_back
     or public.hotel_v2_external_calendar_site_settings_fingerprint()
       is distinct from v_expected then
    raise exception 'external_calendar_site_settings_expected_hash_null_negative_failed';
  end if;

  -- The helper cannot reliably pin its own body while executing it, so the
  -- migration postcondition and verifier own this exact prosrc check. Change
  -- only an internal comment and assert the frozen verifier hash detects it.
  v_definition:=pg_get_functiondef(
    'public.hotel_v2_external_calendar_site_settings_fingerprint()'::regprocedure);
  v_needle:='-- No mutable non-Hotels site_settings field enters the canonical value.';
  if (length(v_definition)-length(replace(v_definition,v_needle,'')))
       /length(v_needle)<>1 then
    raise exception 'external_calendar_site_settings_helper_body_probe_source_drift';
  end if;
  v_rolled_back:=false;
  begin
    execute replace(v_definition,v_needle,
      '-- No mutable non-Hotels site_settings field enters the canonical value (probe).');
    select encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')
    into strict v_source_hash
    from pg_proc procedure_row where procedure_row.oid=
      'public.hotel_v2_external_calendar_site_settings_fingerprint()'::regprocedure;
    if v_source_hash is not distinct from c_site_helper_source_hash
       or public.hotel_v2_external_calendar_site_settings_fingerprint()
         is distinct from v_expected then
      raise exception 'external_calendar_site_settings_helper_body_drift_not_isolated';
    end if;
    raise exception 'external_calendar_site_settings_helper_body_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=v_message='external_calendar_site_settings_helper_body_probe_rollback';
  end;
  select encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')
  into strict v_source_hash
  from pg_proc procedure_row where procedure_row.oid=
    'public.hotel_v2_external_calendar_site_settings_fingerprint()'::regprocedure;
  if not v_rolled_back or v_source_hash is distinct from c_site_helper_source_hash
     or public.hotel_v2_external_calendar_site_settings_fingerprint()
       is distinct from v_expected then
    raise exception 'external_calendar_site_settings_helper_body_negative_failed';
  end if;

  v_rolled_back:=false;
  begin
    grant create on schema public to authenticated;
    alter function public.hotel_v2_external_calendar_site_settings_fingerprint()
      owner to authenticated;
    v_rejected:=false;
    begin
      v_rejected:=
        public.hotel_v2_external_calendar_site_settings_fingerprint() is null;
    exception when others then
      get stacked diagnostics v_sqlstate=returned_sqlstate;
      v_rejected:=v_sqlstate='42501';
    end;
    if not v_rejected then
      raise exception 'external_calendar_site_settings_helper_owner_drift_accepted';
    end if;
    raise exception 'external_calendar_site_settings_helper_owner_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=v_message='external_calendar_site_settings_helper_owner_probe_rollback';
  end;
  if not v_rolled_back
     or public.hotel_v2_external_calendar_site_settings_fingerprint()
       is distinct from v_expected then
    raise exception 'external_calendar_site_settings_helper_owner_negative_failed';
  end if;

  v_rolled_back:=false;
  begin
    alter function public.hotel_v2_external_calendar_site_settings_fingerprint()
      set search_path=public;
    if public.hotel_v2_external_calendar_site_settings_fingerprint() is not null then
      raise exception 'external_calendar_site_settings_helper_search_path_drift_accepted';
    end if;
    raise exception 'external_calendar_site_settings_helper_search_path_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=
      v_message='external_calendar_site_settings_helper_search_path_probe_rollback';
  end;
  if not v_rolled_back
     or public.hotel_v2_external_calendar_site_settings_fingerprint()
       is distinct from v_expected then
    raise exception 'external_calendar_site_settings_helper_search_path_negative_failed';
  end if;

  v_rolled_back:=false;
  begin
    grant execute on function
      public.hotel_v2_external_calendar_site_settings_fingerprint()
      to authenticated;
    if public.hotel_v2_external_calendar_site_settings_fingerprint() is not null then
      raise exception 'external_calendar_site_settings_helper_acl_drift_accepted';
    end if;
    raise exception 'external_calendar_site_settings_helper_acl_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=v_message='external_calendar_site_settings_helper_acl_probe_rollback';
  end;
  if not v_rolled_back
     or public.hotel_v2_external_calendar_site_settings_fingerprint()
       is distinct from v_expected then
    raise exception 'external_calendar_site_settings_helper_acl_negative_failed';
  end if;

  -- Workspace lineage is mandatory in both supported external states.
  v_definition:=pg_get_functiondef(
    'public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)'::regprocedure);
  v_needle:='where draft.assignment_id=(v_access->>''assignment_id'')::uuid'
    ||E'\n    and draft.status=''pending_admin_review'';';
  if (length(v_definition)-length(replace(v_definition,v_needle,'')))
       /length(v_needle)<>1 then
    raise exception 'external_calendar_site_settings_lineage_probe_source_drift';
  end if;

  v_rolled_back:=false;
  begin
    execute replace(v_definition,v_needle,
      'where draft.assignment_id=(v_access->>''assignment_id'')::uuid'
        ||E'\n    and (draft.status=''pending_admin_review'');');
    if public.hotel_v2_partner_workspace_function_lineage_is_exact()
         is not distinct from true
       or public.hotel_v2_external_calendar_site_settings_fingerprint() is not null then
      raise exception 'external_calendar_site_settings_on_lineage_drift_accepted';
    end if;
    raise exception 'external_calendar_site_settings_on_lineage_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=v_message='external_calendar_site_settings_on_lineage_probe_rollback';
  end;
  if not v_rolled_back
     or public.hotel_v2_external_calendar_site_settings_fingerprint()
       is distinct from v_expected then
    raise exception 'external_calendar_site_settings_on_lineage_negative_failed';
  end if;

  v_rolled_back:=false;
  begin
    update public.site_settings set hotel_external_sync_enabled=false where id=1;
    execute replace(v_definition,v_needle,
      'where draft.assignment_id=(v_access->>''assignment_id'')::uuid'
        ||E'\n    and (draft.status=''pending_admin_review'');');
    if public.hotel_v2_partner_workspace_function_lineage_is_exact()
         is not distinct from true
       or public.hotel_v2_external_calendar_site_settings_fingerprint() is not null then
      raise exception 'external_calendar_site_settings_off_lineage_drift_accepted';
    end if;
    raise exception 'external_calendar_site_settings_off_lineage_probe_rollback';
  exception when raise_exception then
    get stacked diagnostics v_message=message_text;
    v_rolled_back:=v_message='external_calendar_site_settings_off_lineage_probe_rollback';
  end;
  if not v_rolled_back
     or public.hotel_v2_external_calendar_site_settings_fingerprint()
       is distinct from v_expected then
    raise exception 'external_calendar_site_settings_off_lineage_negative_failed';
  end if;
end
$site_settings_compatibility_negatives$;

-- A second verifier pass proves every destructive-looking negative probe was
-- fully contained and the final production-style ON state remains deployable.
do $final_production_style_state$
begin
  if not exists(select 1 from public.site_settings setting where setting.id=1
       and setting.hotel_external_sync_enabled
       and not setting.hotel_rooms_v2_enabled
       and not setting.hotel_instant_booking_enabled
       and not setting.hotel_stripe_connect_enabled)
     or public.hotel_v2_external_calendar_site_settings_fingerprint() is null then
    raise exception 'external_calendar_site_settings_final_on_state_failed';
  end if;
end
$final_production_style_state$;

\ir ../../supabase/manual/hotels_v2_external_calendar_site_settings_compatibility_verify.sql

select
  'hotels_v2_external_calendar_site_settings_compatibility_postgres_gate_v1'
    contract_version,
  public.hotel_v2_external_calendar_site_settings_fingerprint()
    canonical_fingerprint,
  (select hotel_external_sync_enabled from public.site_settings where id=1)
    production_style_external_enabled,
  true preflight_off_passed,
  true preflight_on_passed,
  true migration_passed,
  true verifier_passed,
  true rollback_containment_passed,
  true passed;
