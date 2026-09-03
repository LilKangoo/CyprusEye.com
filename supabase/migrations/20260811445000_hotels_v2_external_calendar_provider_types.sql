-- Hotels V2 Stage 2 provider-type evolution.  booking_com, airbnb and ical
-- are provider labels over the same reviewed iCalendar/Vault transport.
begin;
set local lock_timeout='15s';
set local statement_timeout='180s';

do $preconditions$
begin
  if to_regclass('hotels_v2_private.hotel_external_calendar_foundation_receipts') is null
     or to_regprocedure('public.hotel_v2_external_calendar_protected_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_external_calendar_preview_common(text,jsonb)') is null
     or to_regprocedure('public.hotel_v2_external_calendar_apply_common(text,jsonb,uuid,uuid,text)') is null
     or to_regprocedure('public.hotel_v2_external_calendar_worker_get_source_stage2a(uuid)') is null
     or to_regprocedure('public.hotel_v2_external_calendar_scheduler_enqueue_internal(integer)') is null
     or to_regprocedure('public.hotel_v2_admin_d_snapshot(uuid,date,date,boolean)') is null
     or to_regprocedure('public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()') is null
     or to_regprocedure('public.hotel_v2_seven_arches_pricing_activation_current_is_safe()') is null
     or to_regprocedure('public.hotel_v2_h3_2b_protected_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_external_calendar_site_settings_fingerprint()') is null
     or to_regprocedure('public.hotel_v2_partner_workspace_function_lineage_is_exact()') is null
     or to_regprocedure('public.hotel_v2_admin_d_current_foundation_snapshot()') is null
     or to_regprocedure('public.hotel_v2_external_calendar_stage2_compatible_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_external_calendar_provider_sources_are_attributable()') is null
     or to_regprocedure('public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()') is null
     or to_regprocedure('public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()') is null
     or to_regprocedure('public.hotel_v2_seven_arches_pricing_scoped_lineage()') is null
     or to_regprocedure(
       'public.hotel_v2_7a_pricing_activation_transaction_is_preserved()')
       is null
     or to_regprocedure('public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact()') is null
     or to_regprocedure('public.hotel_v2_public_quote_seven_arches_core(jsonb)') is null
     or to_regprocedure('public.hotel_v2_public_create_seven_arches_booking(jsonb)') is null
     or to_regprocedure(
       'public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact()') is null
     or to_regclass('public.hotel_partner_property_proposal_foundation_receipts') is null
     or to_regclass('public.hotel_admin_availability_foundation_evolution_receipts') is null
     or to_regclass('public.hotel_seven_arches_task2_stage2_compatibility_receipts') is null
     or to_regclass('hotels_v2_private.hotel_external_calendar_activation_receipts') is null
     or to_regclass('public.hotel_seven_arches_pricing_activation_evolution_receipts') is null
     or to_regclass('public.hotel_seven_arches_independent_pricing_evolution_receipts') is null
     or to_regclass('public.hotel_seven_arches_reviewed_pricing_foundation_receipts') is null
     or to_regclass('public.hotel_seven_arches_reviewed_pricing_evolution_receipts') is null
     or to_regclass('public.hotel_seven_arches_public_quote_issuances') is null
     or to_regclass('public.hotel_seven_arches_public_booking_receipts') is null then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_foundation_missing';
  end if;
  if to_regclass('hotels_v2_private.hotel_external_calendar_provider_evolution_receipts') is not null then
    raise exception using errcode='23514',message='hotels_v2_external_calendar_provider_evolution_already_present';
  end if;
  if not exists(select 1 from hotels_v2_private.hotel_external_calendar_foundation_receipts receipt
      where receipt.id=1 and receipt.protected_fingerprint=
        public.hotel_v2_external_calendar_worker_hash(receipt.protected_fingerprints)) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_foundation_drift';
  end if;
  if public.hotel_v2_external_calendar_site_settings_fingerprint() is null
     or exists(select 1 from hotels_v2_private.hotel_external_calendar_sync_jobs
       where status in('leased','running'))
     or exists(select 1 from hotels_v2_private.hotel_external_calendar_sync_runs
       where status='running') then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_activation_drift';
  end if;
  if not coalesce((public.hotel_v2_admin_d_current_foundation_snapshot()->>'original_receipt_intact')::boolean,false)
     or not coalesce((public.hotel_v2_admin_d_current_foundation_snapshot()->>'seven_arches_owner_preset_exact')::boolean,false)
     or not coalesce((public.hotel_v2_admin_d_current_foundation_snapshot()->>'audit_chain_exact')::boolean,false)
     or not public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact()
     or not public.hotel_v2_seven_arches_pricing_activation_current_is_safe()
     or not public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()
     or not public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()
     or public.hotel_v2_seven_arches_pricing_scoped_lineage() is null
     or not public.hotel_v2_7a_pricing_activation_transaction_is_preserved()
     or public.hotel_v2_seven_arches_pricing_scoped_lineage()->>'contract_version'
       is distinct from 'hotels_v2_seven_arches_pricing_scoped_lineage_v1' then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_owner_evolution_drift';
  end if;
  if not exists(select 1 from public.hotel_partner_property_proposal_foundation_receipts receipt
      where receipt.id=1 and receipt.provider_source_attribution_source_hash=
        public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
          'public.hotel_v2_external_calendar_provider_sources_are_attributable()'::regprocedure))))
     or not public.hotel_v2_external_calendar_provider_sources_are_attributable() then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_attribution_drift';
  end if;
  -- Fail closed against the exact committed definition of every accepted
  -- function this forward migration evolves.  CREATE OR REPLACE below must
  -- never turn an unknown upstream definition into a blessed provider state.
  if exists(select 1 from (values
      ('public.hotel_v2_admin_d_current_foundation_snapshot()',
        '2ed412e46a827c3b57b570f3c6675edc5d1a92562fb8acb59b7148b245ed592a','s'::"char",
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_admin_d_snapshot(uuid,date,date,boolean)',
        'c356babeced94194355f5215fbb810beb1e17f9cc66b66a094652bc5532444d4','v'::"char",
        array['search_path=pg_catalog, public, auth']::text[],false),
      ('public.hotel_v2_external_calendar_apply_common(text,jsonb,uuid,uuid,text)',
        'a90e31de536eac6e20f1c2c741ff0cb3acb83c63d828bb53b1fb497d1f062f1f','v'::"char",
        array['search_path=pg_catalog, public, auth']::text[],false),
      ('public.hotel_v2_external_calendar_control_common(text,uuid,uuid)',
        '4cd6c670dd75759f628afad1c2a19ad93fe33f7cef289f30abc0479c1a03f4c8','s'::"char",
        array['search_path=pg_catalog, public, auth']::text[],false),
      ('public.hotel_v2_external_calendar_guard_room_unit_capacity()',
        '9d076b4ef7506123580609ccd2dc95d1732a5b6737bd26e1cbebb894f3132267','v'::"char",
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_external_calendar_guard_source()',
        '1f32c2178e1ff4052a1060bdfe247d87f4378b14cf6b07222bb160f2addd9aa1','v'::"char",
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_external_calendar_preview_common(text,jsonb)',
        '58597bf1f2d41482f51c3582e3267a87671144becd49a73bf53cac3144fd8d46','v'::"char",
        array['search_path=pg_catalog, public, auth']::text[],false),
      ('public.hotel_v2_external_calendar_protected_fingerprints()',
        'e9df9093d67ff5039855a0435174416c2eaca71b67700d4806eb56466e9c4af5','s'::"char",
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_h3_2b_protected_fingerprints()',
        '7ca318d9b7b441fa67b1f67b95100d4feee5cf9e1e336a826cbe7408edac97f2','s'::"char",
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_external_calendar_site_settings_fingerprint()',
        'e297f1b640f544644d695b36b4aca0b2dc90385e83709e8a494044aabc3b95bd','s'::"char",
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_external_calendar_provider_sources_are_attributable()',
        '6aee1bb6d02b999877d6384633dd9eab1e8d533917b24ab25e20c83973a0025f','s'::"char",
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_external_calendar_scheduler_enqueue_internal(integer)',
        '71219e42a4fcac040981f2aca5630f396733c41c9d844c00d248db85b557783d','v'::"char",
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_external_calendar_scheduler_lease(integer,uuid,integer)',
        'a7f8b25a863a2c8ae66c66de487d95be1dc0da96b75527b10b3f36a398907606','v'::"char",
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_external_calendar_set_secret_internal(uuid,bigint,text,text)',
        '7147beb1ff3dffaac4bf22479e6b8a9eebcbf198f701ce008f3fdaf4b17542a2','v'::"char",
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_external_calendar_source_projection(uuid)',
        '654b9f24f7e4f82a62a62752079bc9b1e37c60a61ce533b9b746b92b05efe06a','s'::"char",
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_external_calendar_worker_begin_sync(jsonb)',
        'd6f13d351a8902d04fdfe3f303e71a888f12f66f1791e841139c949db7f62c47','v'::"char",
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_external_calendar_worker_finalize_sync(jsonb)',
        '9c70cddfe946e1c19644ec39ae5958669b0aec95d60474aa18bf87e1bc13fc1f','v'::"char",
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_external_calendar_worker_get_source_stage2a(uuid)',
        'a268d6e3e505b49bddb83dc5a49f5bb0f532621db91f030415bb2f460ef3c00e','v'::"char",
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_external_calendar_worker_list_sources(integer)',
        '965d53dbf9ad378ac9c67645234df5591b0be556eec3bf6478b712708cd68494','v'::"char",
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_partner_apply_external_calendar_plan(jsonb,uuid,uuid,text)',
        '455713d256a08bbfb16426ec870cff301915ef76c438bac98ea3be6ae093fcba','v'::"char",
        array['search_path=pg_catalog, public, auth']::text[],true),
      ('public.hotel_v2_public_quote_seven_arches_core(jsonb)',
        '5265e97e8971d06e95e27db72ebc2f5e006eac8cb17779f1cff6ab519f9e6559','v'::"char",
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_seven_arches_independent_pricing_activation_lineage()',
        '2bda434306e7ffc14c852ca6ab8deb4edf77411cab5658b77c0bef743c91388d','s'::"char",
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()',
        'c93374ece2a04386ca3b1e6f1168de3ba5162425d977857d1a4b137626ce6650','s'::"char",
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()',
        '61556afaeb2359b1850dd517c655cc6d05aa1babdaf63bf31b0ad53de18aff7b','s'::"char",
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_seven_arches_pricing_scoped_lineage()',
        '424dec1ba57f42950e4240c0d97d9823a8803e33d3ac207e8a52584c7126b4c0','s'::"char",
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()',
        'e42b5b7cabecd6e7ec7a847796983e497572f9f8fc0802f642fdc6b995d84ac3','s'::"char",
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()',
        '0a6255e457f0912452949966e47e29a0ce0f6cda3e85c53b999343f9b68c3a95','s'::"char",
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_7a_pricing_activation_transaction_is_preserved()',
        '54b3d6baea7b5b99330b2cb6cdb212314d80e41da75a9ab8f800bc7dab215fdb','s'::"char",
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact()',
        '6c6f107b2d90abd7d9216cbd10c5d3817661250cdc35d52858c9ba923cfda258','s'::"char",
        array['search_path=pg_catalog, public']::text[],false),
      ('public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact()',
        'c0e257ae4a8bbf8fae16270025dbbd34490ff39ebeda1733e26de1215b372e0e','s'::"char",
        array['search_path=pg_catalog, public']::text[],false)
    ) expected(signature,source_hash,volatility,path,authenticated_execute)
    left join pg_proc procedure_row on procedure_row.oid=to_regprocedure(expected.signature)
    where procedure_row.oid is null or procedure_row.proowner<>'postgres'::regrole
      or not procedure_row.prosecdef
      or procedure_row.provolatile is distinct from expected.volatility
      or procedure_row.proconfig is distinct from expected.path
      or encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')
        is distinct from expected.source_hash
      or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      or has_function_privilege('service_role',procedure_row.oid,'EXECUTE')
        is distinct from (expected.signature=any(array[
          'public.hotel_v2_external_calendar_scheduler_lease(integer,uuid,integer)',
          'public.hotel_v2_external_calendar_worker_begin_sync(jsonb)',
          'public.hotel_v2_external_calendar_worker_finalize_sync(jsonb)',
          'public.hotel_v2_external_calendar_worker_list_sources(integer)'
        ]::text[]))
      or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
        is distinct from expected.authenticated_execute) then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_provider_dependency_source_drift';
  end if;
  if not exists(select 1 from pg_proc procedure_row
      where procedure_row.oid=
          'public.hotel_v2_7a_pricing_activation_transaction_is_preserved()'::regprocedure
        and procedure_row.proowner='postgres'::regrole
        and procedure_row.prosecdef
        and procedure_row.provolatile='s'
        and procedure_row.proconfig=
          array['search_path=pg_catalog, public']::text[]
        and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
        and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
        and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
        and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE')) then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_provider_transaction_preservation_security_drift';
  end if;
end
$preconditions$;

create function public.hotel_v2_external_calendar_ics_source_type_is_supported(p_source_type text)
returns boolean language sql immutable set search_path=pg_catalog
as $$select coalesce(p_source_type in('booking_com','airbnb','ical'),false)$$;

create table hotels_v2_private.hotel_external_calendar_provider_evolution_receipts(
  id smallint primary key check(id=1),
  contract_version text not null check(contract_version=
    'hotels_v2_external_calendar_provider_evolution_v1'),
  original_foundation_fingerprint text not null check(original_foundation_fingerprint~'^[0-9a-f]{64}$'),
  original_protected_fingerprints jsonb not null,
  prior_compatible_fingerprints jsonb not null check(jsonb_typeof(prior_compatible_fingerprints)='object'),
  prior_compatible_fingerprint text not null check(prior_compatible_fingerprint~'^[0-9a-f]{64}$'),
  manual_source_fingerprint text not null check(manual_source_fingerprint~'^[0-9a-f]{64}$'),
  provider_source_baseline jsonb not null check(jsonb_typeof(provider_source_baseline)='array'),
  prior_function_fingerprints jsonb not null check(jsonb_typeof(prior_function_fingerprints)='object'),
  changed_function_signatures text[] not null,
  prior_function_source_hashes jsonb not null
    check(jsonb_typeof(prior_function_source_hashes)='object'),
  prior_reviewed_pricing_catalog_fingerprint text not null
    check(prior_reviewed_pricing_catalog_fingerprint~'^[0-9a-f]{64}$'),
  pricing_scoped_lineage_at_install jsonb not null
    check(jsonb_typeof(pricing_scoped_lineage_at_install)='object'),
  pricing_scoped_lineage_at_install_fingerprint text not null
    check(pricing_scoped_lineage_at_install_fingerprint~'^[0-9a-f]{64}$'),
  pricing_scoped_lineage_helper_source_hash text not null
    check(pricing_scoped_lineage_helper_source_hash~'^[0-9a-f]{64}$'),
  pricing_transaction_preservation_source_hash text not null
    check(pricing_transaction_preservation_source_hash~'^[0-9a-f]{64}$'),
  historical_property_site_settings_raw_fingerprint text not null
    check(historical_property_site_settings_raw_fingerprint~'^[0-9a-f]{32}$'),
  historical_stage2_site_settings_raw_fingerprint text not null
    check(historical_stage2_site_settings_raw_fingerprint~'^[0-9a-f]{32}$'),
  historical_property_map_fingerprint text not null
    check(historical_property_map_fingerprint~'^[0-9a-f]{64}$'),
  historical_stage2_map_fingerprint text not null
    check(historical_stage2_map_fingerprint~'^[0-9a-f]{64}$'),
  canonical_site_settings_lifecycle_fingerprint text not null
    check(canonical_site_settings_lifecycle_fingerprint~'^[0-9a-f]{64}$'),
  canonical_site_settings_helper_source_hash text not null
    check(canonical_site_settings_helper_source_hash~'^[0-9a-f]{64}$'),
  site_settings_activation_receipt_fingerprint text not null
    check(site_settings_activation_receipt_fingerprint~'^[0-9a-f]{64}$'),
  provider_bridge_source_hash text
    check(provider_bridge_source_hash is null
      or provider_bridge_source_hash~'^[0-9a-f]{64}$'),
  evolved_protected_fingerprints jsonb,
  evolved_protected_fingerprint text check(evolved_protected_fingerprint is null
    or evolved_protected_fingerprint~'^[0-9a-f]{64}$'),
  evolved_function_fingerprints jsonb,
  evolved_function_source_hashes jsonb,
  evolved_reviewed_pricing_catalog_fingerprint text
    check(evolved_reviewed_pricing_catalog_fingerprint is null
      or evolved_reviewed_pricing_catalog_fingerprint~'^[0-9a-f]{64}$'),
  evolution_helper_fingerprints jsonb,
  fingerprint_helper_source_hashes jsonb,
  safe_function_source_hash text check(safe_function_source_hash is null
    or safe_function_source_hash~'^[0-9a-f]{64}$'),
  receipt_hash text check(receipt_hash is null or receipt_hash~'^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp()
);
revoke all on hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
  from public,anon,authenticated,service_role;

-- Partner provider changes are proposals, never live mutations.  The accepted
-- Partner-reviewed plan is stored in the private schema; a set/rotate URL is
-- held only in Vault until the Admin accepts or rejects it.
create table hotels_v2_private.hotel_external_calendar_partner_proposals(
  id uuid primary key,
  partner_review_id uuid not null unique
    references hotels_v2_private.hotel_external_calendar_plan_reviews(id)
      on delete restrict,
  actor_id uuid not null,
  partner_id uuid not null,
  assignment_id uuid not null,
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  permission_version bigint not null check(permission_version>0),
  access_snapshot_token text not null check(access_snapshot_token~'^[0-9a-f]{64}$'),
  snapshot_token text not null check(snapshot_token~'^[0-9a-f]{64}$'),
  entity text not null check(entity in('calendar_source','ical_secret','calendar_sync')),
  action text not null check(action in(
    'create','update','enable','disable','set','rotate','clear','trigger')),
  source_id uuid not null,
  source_type text not null
    check(public.hotel_v2_external_calendar_ics_source_type_is_supported(source_type)),
  room_type_id uuid not null references public.hotel_room_types(id) on delete restrict,
  reason text not null check(reason=btrim(reason) and length(reason) between 3 and 500
    and reason!~'[[:cntrl:]]'),
  reviewed_plan jsonb not null check(jsonb_typeof(reviewed_plan)='object'),
  operation jsonb not null check(jsonb_typeof(operation)='object'),
  plan_fingerprint text not null check(plan_fingerprint~'^[0-9a-f]{64}$'),
  vault_secret_id uuid,
  url_fingerprint text check(url_fingerprint is null or url_fingerprint~'^[0-9a-f]{64}$'),
  status text not null default 'pending_admin_review'
    check(status in('pending_admin_review','accepted','rejected')),
  submission_correlation_id uuid not null,
  submission_idempotency_key uuid not null,
  submission_request_hash text not null check(submission_request_hash~'^[0-9a-f]{64}$'),
  submitted_at timestamptz not null,
  expires_at timestamptz not null check(expires_at>submitted_at),
  reviewed_at timestamptz,
  reviewed_by uuid,
  admin_reason text check(admin_reason is null or (
    admin_reason=btrim(admin_reason) and length(admin_reason) between 3 and 500
    and admin_reason!~'[[:cntrl:]]')),
  consumed_correlation_id uuid,
  consumed_idempotency_key uuid,
  result jsonb,
  check((status='pending_admin_review' and reviewed_at is null and reviewed_by is null
      and admin_reason is null and consumed_correlation_id is null
      and consumed_idempotency_key is null and result is null)
    or (status in('accepted','rejected') and reviewed_at is not null
      and reviewed_by is not null and admin_reason is not null
      and consumed_correlation_id is not null and consumed_idempotency_key is not null
      and result is not null)),
  check((status='pending_admin_review' and (
      (entity='ical_secret' and action in('set','rotate')
        and vault_secret_id is not null and url_fingerprint is not null)
      or (not(entity='ical_secret' and action in('set','rotate'))
        and vault_secret_id is null and url_fingerprint is null)))
    or (status in('accepted','rejected')
      and vault_secret_id is null and url_fingerprint is null)),
  unique(actor_id,submission_idempotency_key),
  unique(submission_correlation_id),
  constraint hotel_extcal_provider_proposal_assignment_fkey
    foreign key(assignment_id,partner_id,hotel_id)
    references public.hotel_partner_hotel_permissions(
      assignment_id,partner_id,hotel_id) on delete restrict
);
revoke all on hotels_v2_private.hotel_external_calendar_partner_proposals
  from public,anon,authenticated,service_role;

create table hotels_v2_private.hotel_external_calendar_provider_review_receipts(
  sequence_no bigint primary key,
  proposal_id uuid not null unique
    references hotels_v2_private.hotel_external_calendar_partner_proposals(id)
      on delete restrict,
  action text not null check(action in('accepted','rejected')),
  actor_id uuid not null,
  correlation_id uuid not null,
  idempotency_key uuid not null,
  previous_receipt_hash text not null check(previous_receipt_hash~'^[0-9a-f]{64}$'),
  result_hash text not null check(result_hash~'^[0-9a-f]{64}$'),
  reason_hash text not null check(reason_hash~'^[0-9a-f]{64}$'),
  created_at timestamptz not null,
  receipt_hash text not null unique check(receipt_hash~'^[0-9a-f]{64}$'),
  unique(actor_id,idempotency_key),
  unique(correlation_id)
);
revoke all on hotels_v2_private.hotel_external_calendar_provider_review_receipts
  from public,anon,authenticated,service_role;

create table hotels_v2_private.hotel_external_calendar_provider_admin_previews(
  admin_review_id uuid primary key
    references hotels_v2_private.hotel_external_calendar_plan_reviews(id)
      on delete restrict,
  proposal_id uuid not null
    references hotels_v2_private.hotel_external_calendar_partner_proposals(id)
      on delete restrict,
  actor_id uuid not null,
  partner_plan_fingerprint text not null
    check(partner_plan_fingerprint~'^[0-9a-f]{64}$'),
  admin_plan_fingerprint text not null
    check(admin_plan_fingerprint~'^[0-9a-f]{64}$'),
  admin_reason text not null check(admin_reason=btrim(admin_reason)
    and length(admin_reason) between 3 and 500 and admin_reason!~'[[:cntrl:]]'),
  created_at timestamptz not null,
  expires_at timestamptz not null check(expires_at>created_at),
  unique(proposal_id,admin_review_id)
);
revoke all on hotels_v2_private.hotel_external_calendar_provider_admin_previews
  from public,anon,authenticated,service_role;

create function hotels_v2_private.hotel_external_calendar_provider_proposal_summary(
  p_proposal_id uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog,public
as $function$
select jsonb_build_object(
  'proposal_id',proposal.id,'hotel_id',proposal.hotel_id,
  'partner_id',proposal.partner_id,'assignment_id',proposal.assignment_id,
  'entity',case when proposal.entity='calendar_sync' then 'sync_job'
    else proposal.entity end,
  'action',case when proposal.entity='calendar_sync' and proposal.action='trigger'
    then 'enqueue' else proposal.action end,
  'source_id',proposal.source_id,
  'source_type',proposal.source_type,'room_type_id',proposal.room_type_id,
  'reason',proposal.reason,'plan_fingerprint',proposal.plan_fingerprint,
  'status',proposal.status,
  'submitted_at',proposal.submitted_at,'expires_at',proposal.expires_at,
  'is_fresh',proposal.status='pending_admin_review'
    and proposal.expires_at>clock_timestamp()
    and exists(select 1 from public.hotel_partner_hotel_permissions permission
      where permission.assignment_id=proposal.assignment_id
        and permission.partner_id=proposal.partner_id
        and permission.hotel_id=proposal.hotel_id
        and permission.version=proposal.permission_version
        and permission.manage_availability),
  'reviewed_at',proposal.reviewed_at,
  'reviewed_by',proposal.reviewed_by,
  'admin_reason',proposal.admin_reason)
from hotels_v2_private.hotel_external_calendar_partner_proposals proposal
where proposal.id=p_proposal_id
$function$;
revoke all on function
  hotels_v2_private.hotel_external_calendar_provider_proposal_summary(uuid)
  from public,anon,authenticated,service_role;

create function hotels_v2_private.hotel_external_calendar_provider_proposal_guard()
returns trigger language plpgsql set search_path=pg_catalog,public
as $function$
declare
  v_operation jsonb;
  v_reviewed_plan_for_pii jsonb;
  v_operation_for_pii jsonb;
  v_expected_secret_configured jsonb;
  v_payload_secret_configured jsonb;
begin
  if tg_op='INSERT' then
    if new.status<>'pending_admin_review'
       or jsonb_typeof(new.reviewed_plan->'operations') is distinct from 'array' then
      raise exception using errcode='55000',
        message='hotels_v2_external_calendar_provider_proposal_invalid';
    end if;
    if jsonb_array_length(new.reviewed_plan->'operations')<>1 then
      raise exception using errcode='55000',
        message='hotels_v2_external_calendar_provider_proposal_invalid';
    end if;
    v_operation:=new.reviewed_plan#>'{operations,0}';
    v_expected_secret_configured:=
      new.operation#>'{expected_original,secret_configured}';
    v_payload_secret_configured:=new.operation#>'{payload,secret_configured}';
    -- The immutable reviewed plan necessarily carries two protected 64-hex
    -- lineage tokens, while accepted source projections carry the safe boolean
    -- `secret_configured`.  Bind the plan byte-for-byte to its protected Review
    -- and validate those exact values before removing only their exact paths
    -- from the generic PII scan.  Any additional/nested token or secret key
    -- remains visible to the recursive scanner and therefore fails closed.
    if new.operation is distinct from v_operation
       or new.reviewed_plan->>'access_snapshot_token' is distinct from
         new.access_snapshot_token
       or new.reviewed_plan->>'snapshot_token' is distinct from
         new.snapshot_token
       or not exists(select 1
         from hotels_v2_private.hotel_external_calendar_plan_reviews review
         where review.id=new.partner_review_id
           and review.actor_type='partner'
           and review.actor_id=new.actor_id
           and review.partner_id=new.partner_id
           and review.assignment_id=new.assignment_id
           and review.hotel_id=new.hotel_id
           and review.permission_version=new.permission_version
           and review.access_snapshot_token=new.access_snapshot_token
           and review.snapshot_token=new.snapshot_token
           and review.reviewed_plan is not distinct from new.reviewed_plan
           and review.plan_fingerprint=new.plan_fingerprint
           and review.expires_at is not distinct from new.expires_at
           and review.consumed_at is null)
       or (v_expected_secret_configured is not null
         and jsonb_typeof(v_expected_secret_configured) is distinct from 'boolean')
       or (v_payload_secret_configured is not null
         and jsonb_typeof(v_payload_secret_configured) is distinct from 'boolean') then
      raise exception using errcode='55000',
        message='hotels_v2_external_calendar_provider_proposal_invalid';
    end if;
    if new.entity='ical_secret' and new.action in('set','rotate','clear') then
      if v_expected_secret_configured is null
         or v_payload_secret_configured is null
         or (v_payload_secret_configured::text)::boolean is distinct from
           (new.action<>'clear') then
        raise exception using errcode='55000',
          message='hotels_v2_external_calendar_provider_proposal_invalid';
      end if;
    elsif v_payload_secret_configured is not null then
      raise exception using errcode='55000',
        message='hotels_v2_external_calendar_provider_proposal_invalid';
    end if;
    v_reviewed_plan_for_pii:=
      new.reviewed_plan-array[
        'access_snapshot_token','snapshot_token']::text[]
      #-array['operations','0','expected_original','secret_configured']::text[]
      #-array['operations','0','payload','secret_configured']::text[];
    v_operation_for_pii:=
      new.operation
      #-array['expected_original','secret_configured']::text[]
      #-array['payload','secret_configured']::text[];
    if not public.hotel_v2_h3_2a_jsonb_is_pii_free(v_reviewed_plan_for_pii)
       or not public.hotel_v2_h3_2a_jsonb_is_pii_free(v_operation_for_pii) then
      raise exception using errcode='55000',
        message='hotels_v2_external_calendar_provider_proposal_invalid';
    end if;
    return new;
  end if;
  if tg_op='DELETE'
     or old.status<>'pending_admin_review'
     or new.status not in('accepted','rejected')
     or new.id is distinct from old.id
     or new.partner_review_id is distinct from old.partner_review_id
     or new.actor_id is distinct from old.actor_id
     or new.partner_id is distinct from old.partner_id
     or new.assignment_id is distinct from old.assignment_id
     or new.hotel_id is distinct from old.hotel_id
     or new.permission_version is distinct from old.permission_version
     or new.access_snapshot_token is distinct from old.access_snapshot_token
     or new.snapshot_token is distinct from old.snapshot_token
     or new.entity is distinct from old.entity
     or new.action is distinct from old.action
     or new.source_id is distinct from old.source_id
     or new.source_type is distinct from old.source_type
     or new.room_type_id is distinct from old.room_type_id
     or new.reason is distinct from old.reason
     or new.reviewed_plan is distinct from old.reviewed_plan
     or new.operation is distinct from old.operation
     or new.plan_fingerprint is distinct from old.plan_fingerprint
     or new.vault_secret_id is not null
     or new.url_fingerprint is not null
     or new.submission_correlation_id is distinct from old.submission_correlation_id
     or new.submission_idempotency_key is distinct from old.submission_idempotency_key
     or new.submission_request_hash is distinct from old.submission_request_hash
     or new.submitted_at is distinct from old.submitted_at
     or new.expires_at is distinct from old.expires_at
     or new.reviewed_at is null or not isfinite(new.reviewed_at)
     or new.reviewed_by is null or new.admin_reason is null
     or new.consumed_correlation_id is null
     or new.consumed_idempotency_key is null
     or new.result is null
     or (new.status='accepted' and (
       new.result#>'{apply,control}' is distinct from
         public.hotel_v2_external_calendar_control_common(
           'admin',null,new.hotel_id)
       or not public.hotel_v2_h3_2a_jsonb_is_pii_free(
         new.result#-array['apply','control']::text[])))
     or (new.status='rejected'
       and not public.hotel_v2_h3_2a_jsonb_is_pii_free(new.result)) then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_provider_proposal_transition_invalid';
  end if;
  return new;
end
$function$;

create trigger hotel_external_calendar_provider_proposal_guard
before insert or update or delete
on hotels_v2_private.hotel_external_calendar_partner_proposals
for each row execute function
  hotels_v2_private.hotel_external_calendar_provider_proposal_guard();

create trigger hotel_external_calendar_provider_preview_immutable
before update or delete
on hotels_v2_private.hotel_external_calendar_provider_admin_previews
for each row execute function public.hotel_v2_h3_2a_reject_immutable_change();

create trigger hotel_external_calendar_provider_review_receipt_immutable
before update or delete
on hotels_v2_private.hotel_external_calendar_provider_review_receipts
for each row execute function public.hotel_v2_h3_2a_reject_immutable_change();

create function hotels_v2_private.hotel_external_calendar_provider_worker_scheduler_is_ready()
returns boolean language plpgsql stable security definer set search_path=pg_catalog,public
as $function$
declare v_job_count integer:=0;
begin
  if to_regclass('cron.job') is null then return false; end if;
  execute $sql$select count(*) from cron.job
    where jobname='hotels-v2-external-calendar-15m'
      and schedule='*/15 * * * *' and active
      and command='select public.hotel_v2_external_calendar_scheduler_dispatch()'$sql$
    into v_job_count;
  return v_job_count=1
    and (select count(*) from vault.decrypted_secrets
      where name='hotels-v2-external-calendar-worker-url'
        and decrypted_secret=
          'https://daoohnbnnowmmcizgvrq.functions.supabase.co/hotels-v2-external-calendar-sync')=1
    and (select count(*) from vault.decrypted_secrets
      where name='hotels-v2-external-calendar-worker-shared-secret'
        and length(decrypted_secret)>=32
        and decrypted_secret!~'[[:space:][:cntrl:]]')=1
    and public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact();
exception when undefined_table or undefined_function or invalid_schema_name then
  return false;
end
$function$;
revoke all on function
  hotels_v2_private.hotel_external_calendar_provider_worker_scheduler_is_ready()
  from public,anon,authenticated,service_role;

create function hotels_v2_private.hotel_external_calendar_provider_write_review_receipt(
  p_proposal_id uuid,p_action text,p_actor_id uuid,p_correlation_id uuid,
  p_idempotency_key uuid,p_result jsonb,p_reason text)
returns text language plpgsql volatile security definer
set search_path=pg_catalog,public
as $function$
declare
  v_sequence bigint;
  v_previous text;
  v_created timestamptz:=clock_timestamp();
  v_result_hash text;
  v_reason_hash text;
  v_receipt_hash text;
begin
  if p_proposal_id is null or p_action not in('accepted','rejected')
     or p_actor_id is null or p_correlation_id is null or p_idempotency_key is null
     or jsonb_typeof(p_result) is distinct from 'object'
     or not public.hotel_v2_external_calendar_reason_valid(to_jsonb(p_reason))
     -- The proposal transition guard has already bound an accepted
     -- `apply.control` byte-for-byte to the server-derived Admin control while
     -- the proposal is pending.  After that guarded row becomes terminal, bind
     -- this receipt input to that exact row before omitting only the protected
     -- control subtree (which necessarily carries lineage tokens and the safe
     -- `secret_configured` projection) from the generic PII scan.
     or not exists(select 1
       from hotels_v2_private.hotel_external_calendar_partner_proposals proposal
       where proposal.id=p_proposal_id
         and proposal.status=p_action
         and proposal.reviewed_by=p_actor_id
         and proposal.consumed_correlation_id=p_correlation_id
         and proposal.consumed_idempotency_key=p_idempotency_key
         and proposal.admin_reason=p_reason
         and proposal.result is not distinct from p_result)
     or (p_action='accepted'
       and not public.hotel_v2_h3_2a_jsonb_is_pii_free(
         p_result#-array['apply','control']::text[]))
     or (p_action='rejected'
       and not public.hotel_v2_h3_2a_jsonb_is_pii_free(p_result)) then
    raise exception using errcode='22023',
      message='hotels_v2_external_calendar_provider_invalid_decision_receipt';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'hotels-v2-external-calendar-provider-review-receipt-chain',0));
  select receipt.sequence_no,receipt.receipt_hash
    into v_sequence,v_previous
  from hotels_v2_private.hotel_external_calendar_provider_review_receipts receipt
  order by receipt.sequence_no desc limit 1;
  v_sequence:=coalesce(v_sequence,0)+1;
  v_previous:=coalesce(v_previous,repeat('0',64));
  v_result_hash:=public.hotel_v2_external_calendar_worker_hash(p_result);
  v_reason_hash:=public.hotel_v2_external_calendar_worker_hash(
    jsonb_build_object('reason',p_reason));
  v_receipt_hash:=public.hotel_v2_external_calendar_worker_hash(jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_provider_review_receipt_v1',
    'sequence_no',v_sequence,'proposal_id',p_proposal_id,'action',p_action,
    'actor_id',p_actor_id,'correlation_id',p_correlation_id,
    'idempotency_key',p_idempotency_key,'previous_receipt_hash',v_previous,
    'result_hash',v_result_hash,'reason_hash',v_reason_hash,
    'created_at_unix_microseconds',
      (extract(epoch from v_created)*1000000)::bigint));
  insert into hotels_v2_private.hotel_external_calendar_provider_review_receipts(
    sequence_no,proposal_id,action,actor_id,correlation_id,idempotency_key,
    previous_receipt_hash,result_hash,reason_hash,created_at,receipt_hash)
  values(v_sequence,p_proposal_id,p_action,p_actor_id,p_correlation_id,
    p_idempotency_key,v_previous,v_result_hash,v_reason_hash,v_created,v_receipt_hash);
  return v_receipt_hash;
end
$function$;
revoke all on function
  hotels_v2_private.hotel_external_calendar_provider_write_review_receipt(
    uuid,text,uuid,uuid,uuid,jsonb,text)
  from public,anon,authenticated,service_role;

create function hotels_v2_private.hotel_external_calendar_provider_review_chain_is_exact()
returns boolean language sql stable security definer set search_path=pg_catalog,public
as $function$
with ordered as (
  select receipt.*,
    lag(receipt.receipt_hash) over(order by receipt.sequence_no) prior_hash,
    row_number() over(order by receipt.sequence_no) expected_sequence
  from hotels_v2_private.hotel_external_calendar_provider_review_receipts receipt
), checked as (
  select ordered.*,
    public.hotel_v2_external_calendar_worker_hash(jsonb_build_object(
      'contract_version','hotels_v2_external_calendar_provider_review_receipt_v1',
      'sequence_no',ordered.sequence_no,'proposal_id',ordered.proposal_id,
      'action',ordered.action,'actor_id',ordered.actor_id,
      'correlation_id',ordered.correlation_id,
      'idempotency_key',ordered.idempotency_key,
      'previous_receipt_hash',ordered.previous_receipt_hash,
      'result_hash',ordered.result_hash,'reason_hash',ordered.reason_hash,
      'created_at_unix_microseconds',
        (extract(epoch from ordered.created_at)*1000000)::bigint)) expected_hash
  from ordered
)
select not exists(select 1 from checked
    where sequence_no<>expected_sequence
      or previous_receipt_hash is distinct from
        coalesce(prior_hash,repeat('0',64))
      or receipt_hash is distinct from expected_hash)
  and not exists(select 1
    from hotels_v2_private.hotel_external_calendar_partner_proposals proposal
    left join hotels_v2_private.hotel_external_calendar_provider_review_receipts receipt
      on receipt.proposal_id=proposal.id
    where (proposal.status='pending_admin_review' and receipt.proposal_id is not null)
       or (proposal.status in('accepted','rejected') and (
         receipt.proposal_id is null
         or receipt.action<>proposal.status
         or receipt.actor_id<>proposal.reviewed_by
         or receipt.correlation_id<>proposal.consumed_correlation_id
         or receipt.idempotency_key<>proposal.consumed_idempotency_key
         or receipt.result_hash<>public.hotel_v2_external_calendar_worker_hash(
           proposal.result)
         or receipt.reason_hash<>public.hotel_v2_external_calendar_worker_hash(
           jsonb_build_object('reason',proposal.admin_reason)))))
$function$;
revoke all on function
  hotels_v2_private.hotel_external_calendar_provider_review_chain_is_exact()
  from public,anon,authenticated,service_role;

create function hotels_v2_private.hotel_external_calendar_provider_expire_pending(
  p_hotel_id uuid,p_actor_id uuid)
returns integer language plpgsql volatile security definer
set search_path=pg_catalog,public
as $function$
declare
  v_proposal hotels_v2_private.hotel_external_calendar_partner_proposals%rowtype;
  v_correlation uuid;
  v_idempotency uuid;
  v_reason constant text:='Proposal expired before Admin review.';
  v_result jsonb;
  v_count integer:=0;
begin
  if p_hotel_id is null or p_actor_id is null then
    raise exception using errcode='22023',
      message='hotels_v2_external_calendar_provider_invalid_expiry';
  end if;
  for v_proposal in
    select proposal.*
    from hotels_v2_private.hotel_external_calendar_partner_proposals proposal
    where proposal.hotel_id=p_hotel_id
      and proposal.status='pending_admin_review'
      and proposal.expires_at<=clock_timestamp()
    order by proposal.submitted_at,proposal.id
    for update
  loop
    v_correlation:=gen_random_uuid();
    v_idempotency:=gen_random_uuid();
    if v_proposal.vault_secret_id is not null then
      delete from vault.secrets secret
      where secret.id=v_proposal.vault_secret_id
        and secret.name='hotel-calendar-proposal-'||v_proposal.id::text;
      if not found then
        raise exception using errcode='55000',
          message='hotels_v2_external_calendar_provider_staged_secret_missing';
      end if;
    end if;
    v_result:=jsonb_build_object(
      'contract_version','hotels_v2_external_calendar_provider_decision_record_v1',
      'proposal_id',v_proposal.id,'decision','rejected','expired',true,
      'request_hash',public.hotel_v2_external_calendar_worker_hash(
        jsonb_build_object('proposal_id',v_proposal.id,'decision','expired')),
      'url_fingerprint',v_proposal.url_fingerprint,'apply',null);
    update hotels_v2_private.hotel_external_calendar_partner_proposals set
      status='rejected',reviewed_at=clock_timestamp(),reviewed_by=p_actor_id,
      admin_reason=v_reason,consumed_correlation_id=v_correlation,
      consumed_idempotency_key=v_idempotency,result=v_result,
      vault_secret_id=null,url_fingerprint=null
    where id=v_proposal.id;
    perform hotels_v2_private.hotel_external_calendar_provider_write_review_receipt(
      v_proposal.id,'rejected',p_actor_id,v_correlation,v_idempotency,
      v_result,v_reason);
    v_count:=v_count+1;
  end loop;
  return v_count;
end
$function$;
revoke all on function
  hotels_v2_private.hotel_external_calendar_provider_expire_pending(uuid,uuid)
  from public,anon,authenticated,service_role;

create function hotels_v2_private.hotel_external_calendar_provider_function_fingerprints()
returns jsonb language sql stable security definer set search_path=pg_catalog,public
as $function$
select jsonb_object_agg(signature,public.hotel_v2_external_calendar_worker_hash(
  to_jsonb(pg_get_functiondef(signature::regprocedure))) order by signature)
from unnest(array[
  'public.hotel_v2_external_calendar_worker_get_source_stage2a(uuid)',
  'public.hotel_v2_external_calendar_worker_list_sources(integer)',
  'public.hotel_v2_external_calendar_worker_begin_sync(jsonb)',
  'public.hotel_v2_external_calendar_worker_finalize_sync(jsonb)',
  'public.hotel_v2_admin_d_snapshot(uuid,date,date,boolean)',
  'public.hotel_v2_external_calendar_guard_source()',
  'public.hotel_v2_external_calendar_guard_room_unit_capacity()',
  'public.hotel_v2_external_calendar_source_projection(uuid)',
  'public.hotel_v2_external_calendar_control_common(text,uuid,uuid)',
  'public.hotel_v2_external_calendar_preview_common(text,jsonb)',
  'public.hotel_v2_external_calendar_set_secret_internal(uuid,bigint,text,text)',
  'public.hotel_v2_external_calendar_apply_common(text,jsonb,uuid,uuid,text)',
  'public.hotel_v2_external_calendar_scheduler_enqueue_internal(integer)',
  'public.hotel_v2_external_calendar_scheduler_lease(integer,uuid,integer)',
  'public.hotel_v2_external_calendar_protected_fingerprints()',
  'public.hotel_v2_h3_2b_protected_fingerprints()',
  'public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()',
  'public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()',
  'public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact()',
  'public.hotel_v2_seven_arches_pricing_activation_current_is_safe()',
  'public.hotel_v2_external_calendar_site_settings_fingerprint()',
  'public.hotel_v2_external_calendar_provider_sources_are_attributable()',
  'public.hotel_v2_partner_workspace_function_lineage_is_exact()'
  ,'public.hotel_v2_admin_d_current_foundation_snapshot()'
  ,'public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()'
  ,'public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()'
  ,'public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()'
  ,'public.hotel_v2_seven_arches_reviewed_pricing_oracle()'
  ,'public.hotel_v2_seven_arches_reviewed_pricing_current_state()'
  ,'public.hotel_v2_seven_arches_pricing_scoped_lineage()'
  ,'public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()'
  ,'public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()'
  ,'public.hotel_v2_7a_pricing_activation_transaction_is_preserved()'
  ,'public.hotel_v2_public_quote_seven_arches_core(jsonb)'
  ,'public.hotel_v2_public_quote_seven_arches(jsonb)'
  ,'public.hotel_v2_public_create_seven_arches_booking(jsonb)'
  ,'public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact()'
  ,'public.hotel_v2_seven_arches_public_quote_fingerprint(jsonb)'
  ,'public.hotel_v2_partner_apply_external_calendar_plan(jsonb,uuid,uuid,text)'
  ,'public.hotel_v2_seven_arches_independent_pricing_activation_lineage()'
]) signature
$function$;

create function hotels_v2_private.hotel_external_calendar_provider_function_source_hashes()
returns jsonb language sql stable security definer set search_path=pg_catalog,public
as $function$
select jsonb_object_agg(signature,encode(extensions.digest(
  convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex') order by signature)
from unnest(array[
  'public.hotel_v2_external_calendar_worker_get_source_stage2a(uuid)',
  'public.hotel_v2_external_calendar_worker_list_sources(integer)',
  'public.hotel_v2_external_calendar_worker_begin_sync(jsonb)',
  'public.hotel_v2_external_calendar_worker_finalize_sync(jsonb)',
  'public.hotel_v2_admin_d_snapshot(uuid,date,date,boolean)',
  'public.hotel_v2_external_calendar_guard_source()',
  'public.hotel_v2_external_calendar_guard_room_unit_capacity()',
  'public.hotel_v2_external_calendar_source_projection(uuid)',
  'public.hotel_v2_external_calendar_control_common(text,uuid,uuid)',
  'public.hotel_v2_external_calendar_preview_common(text,jsonb)',
  'public.hotel_v2_external_calendar_set_secret_internal(uuid,bigint,text,text)',
  'public.hotel_v2_external_calendar_apply_common(text,jsonb,uuid,uuid,text)',
  'public.hotel_v2_external_calendar_scheduler_enqueue_internal(integer)',
  'public.hotel_v2_external_calendar_scheduler_lease(integer,uuid,integer)',
  'public.hotel_v2_external_calendar_protected_fingerprints()',
  'public.hotel_v2_h3_2b_protected_fingerprints()',
  'public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()',
  'public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()',
  'public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact()',
  'public.hotel_v2_seven_arches_pricing_activation_current_is_safe()',
  'public.hotel_v2_external_calendar_site_settings_fingerprint()',
  'public.hotel_v2_external_calendar_provider_sources_are_attributable()',
  'public.hotel_v2_partner_workspace_function_lineage_is_exact()',
  'public.hotel_v2_admin_d_current_foundation_snapshot()',
  'public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()',
  'public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()',
  'public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()',
  'public.hotel_v2_seven_arches_reviewed_pricing_oracle()',
  'public.hotel_v2_seven_arches_reviewed_pricing_current_state()',
  'public.hotel_v2_seven_arches_pricing_scoped_lineage()',
  'public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()',
  'public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()',
  'public.hotel_v2_7a_pricing_activation_transaction_is_preserved()',
  'public.hotel_v2_public_quote_seven_arches_core(jsonb)',
  'public.hotel_v2_public_quote_seven_arches(jsonb)',
  'public.hotel_v2_public_create_seven_arches_booking(jsonb)',
  'public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact()',
  'public.hotel_v2_seven_arches_public_quote_fingerprint(jsonb)',
  'public.hotel_v2_partner_apply_external_calendar_plan(jsonb,uuid,uuid,text)'
  ,'public.hotel_v2_seven_arches_independent_pricing_activation_lineage()'
]) signature
join pg_proc procedure_row on procedure_row.oid=signature::regprocedure
$function$;

insert into hotels_v2_private.hotel_external_calendar_provider_evolution_receipts(
  id,contract_version,original_foundation_fingerprint,original_protected_fingerprints,
  prior_compatible_fingerprints,prior_compatible_fingerprint,
  manual_source_fingerprint,provider_source_baseline,prior_function_fingerprints,
  changed_function_signatures,prior_function_source_hashes,
  prior_reviewed_pricing_catalog_fingerprint,
  pricing_scoped_lineage_at_install,
  pricing_scoped_lineage_at_install_fingerprint,
  pricing_scoped_lineage_helper_source_hash,
  pricing_transaction_preservation_source_hash,
  historical_property_site_settings_raw_fingerprint,
  historical_stage2_site_settings_raw_fingerprint,
  historical_property_map_fingerprint,historical_stage2_map_fingerprint,
  canonical_site_settings_lifecycle_fingerprint,
  canonical_site_settings_helper_source_hash,
  site_settings_activation_receipt_fingerprint)
select 1,'hotels_v2_external_calendar_provider_evolution_v1',
  foundation.protected_fingerprint,foundation.protected_fingerprints,
  normalized.value,public.hotel_v2_external_calendar_worker_hash(normalized.value),
  public.hotel_v2_external_calendar_worker_hash(coalesce((select jsonb_agg(to_jsonb(source) order by source.id)
    from public.hotel_calendar_source_configs source where source.source_type='manual'),'[]'::jsonb)),
  coalesce((select jsonb_agg(to_jsonb(source) order by source.id)
    from public.hotel_calendar_source_configs source
    where public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type)),'[]'::jsonb),
  hotels_v2_private.hotel_external_calendar_provider_function_fingerprints(),
  array[
    'public.hotel_v2_admin_d_current_foundation_snapshot()',
    'public.hotel_v2_admin_d_snapshot(uuid,date,date,boolean)',
    'public.hotel_v2_external_calendar_apply_common(text,jsonb,uuid,uuid,text)',
    'public.hotel_v2_external_calendar_control_common(text,uuid,uuid)',
    'public.hotel_v2_external_calendar_guard_room_unit_capacity()',
    'public.hotel_v2_external_calendar_guard_source()',
    'public.hotel_v2_external_calendar_preview_common(text,jsonb)',
    'public.hotel_v2_external_calendar_protected_fingerprints()',
    'public.hotel_v2_external_calendar_provider_sources_are_attributable()',
    'public.hotel_v2_external_calendar_scheduler_enqueue_internal(integer)',
    'public.hotel_v2_external_calendar_scheduler_lease(integer,uuid,integer)',
    'public.hotel_v2_external_calendar_set_secret_internal(uuid,bigint,text,text)',
    'public.hotel_v2_external_calendar_source_projection(uuid)',
    'public.hotel_v2_external_calendar_worker_begin_sync(jsonb)',
    'public.hotel_v2_external_calendar_worker_finalize_sync(jsonb)',
    'public.hotel_v2_external_calendar_worker_get_source_stage2a(uuid)',
    'public.hotel_v2_external_calendar_worker_list_sources(integer)',
    'public.hotel_v2_partner_apply_external_calendar_plan(jsonb,uuid,uuid,text)',
    'public.hotel_v2_public_quote_seven_arches_core(jsonb)',
    'public.hotel_v2_seven_arches_independent_pricing_activation_lineage()',
    'public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()',
    'public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()',
    'public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()',
    'public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()'
  ]::text[],
  hotels_v2_private.hotel_external_calendar_provider_function_source_hashes(),
  public.hotel_v2_seven_arches_reviewed_pricing_catalog_fingerprint(),
  scoped.value,
  public.hotel_v2_external_calendar_worker_hash(scoped.value),
  scoped_source.value,
  preservation_source.value,
  property.protected_fingerprints->>'site_settings',
  owner_receipt.stage2_current_protected_fingerprints->>'site_settings',
  property.protected_fingerprint,
  owner_receipt.stage2_current_protected_fingerprint,
  site_lifecycle.value,
  (select encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')
   from pg_proc procedure_row where procedure_row.oid=
     'public.hotel_v2_external_calendar_site_settings_fingerprint()'::regprocedure),
  public.hotel_v2_external_calendar_worker_hash(jsonb_set(
    to_jsonb(site_activation),'{created_at}',
    to_jsonb((extract(epoch from site_activation.created_at)*1000000)::bigint),false))
from hotels_v2_private.hotel_external_calendar_foundation_receipts foundation
join public.hotel_partner_property_proposal_foundation_receipts property
  on property.id=foundation.id
join public.hotel_admin_availability_foundation_evolution_receipts owner_receipt
  on owner_receipt.id=foundation.id
join public.hotel_seven_arches_task2_stage2_compatibility_receipts canonical
  on canonical.id=foundation.id
join hotels_v2_private.hotel_external_calendar_activation_receipts site_activation
  on site_activation.id=foundation.id
cross join lateral (select public.hotel_v2_external_calendar_stage2_compatible_fingerprints() value) compatible
cross join lateral (select public.hotel_v2_external_calendar_site_settings_fingerprint() value) site_lifecycle
-- The provider receipt is an upstream baseline, so an already-applied exact
-- Task3 transition is folded back to its immutable before projection.  The
-- precondition above has already required the full Task3 current-safe proof;
-- zero receipts remains the inert baseline and exactly one receipt contributes
-- only the activation receipt's transactionally protected controlled keys.
cross join lateral (select case
  when (select count(*) from public.hotel_seven_arches_pricing_activation_evolution_receipts)=0
    then compatible.value
  else compatible.value||coalesce((select jsonb_object_agg(changed.changed_key,
      activation.before_stage2_protected_fingerprints->(changed.changed_key))
    from public.hotel_seven_arches_pricing_activation_evolution_receipts activation
    cross join lateral unnest(activation.stage2_allowed_fingerprint_keys) changed(changed_key)
    where activation.id=1),'{}'::jsonb)
  end value) task3_normalized
cross join lateral (select jsonb_set(task3_normalized.value,'{site_settings}',to_jsonb(
  site_lifecycle.value),false) value) normalized
cross join lateral (select public.hotel_v2_seven_arches_pricing_scoped_lineage() value) scoped
cross join lateral (select encode(extensions.digest(convert_to(procedure_row.prosrc,
  'UTF8'),'sha256'),'hex') value from pg_proc procedure_row where procedure_row.oid=
    'public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure) scoped_source
cross join lateral (select encode(extensions.digest(convert_to(procedure_row.prosrc,
  'UTF8'),'sha256'),'hex') value from pg_proc procedure_row where procedure_row.oid=
    'public.hotel_v2_7a_pricing_activation_transaction_is_preserved()'::regprocedure)
  preservation_source
where foundation.id=1
  and property.protected_fingerprint=
    public.hotel_v2_h3_2b_hash(property.protected_fingerprints)
  and owner_receipt.stage2_current_protected_fingerprint=
    public.hotel_v2_external_calendar_worker_hash(
      owner_receipt.stage2_current_protected_fingerprints)
  and property.protected_fingerprints->>'site_settings'~'^[0-9a-f]{32}$'
  and owner_receipt.stage2_current_protected_fingerprints->>'site_settings'
    =property.protected_fingerprints->>'site_settings'
  and site_lifecycle.value=
    '9d385718586ec03664878d35552e73373bd2e4dca170dc497025fc6780c79bf5'
  and canonical.canonical_task2_protected_fingerprint=
    public.hotel_v2_h3_2b_hash(canonical.canonical_task2_protected_fingerprints)
  and canonical.canonical_stage2_protected_fingerprint=
    public.hotel_v2_external_calendar_worker_hash(
      canonical.canonical_stage2_protected_fingerprints)
  and jsonb_typeof(scoped.value)='object'
  and scoped.value->>'contract_version'=
    'hotels_v2_seven_arches_pricing_scoped_lineage_v1'
  and scoped.value->>'site_settings_lifecycle_fingerprint'=site_lifecycle.value
  and scoped_source.value~'^[0-9a-f]{64}$'
  and preservation_source.value~'^[0-9a-f]{64}$'
  and public.hotel_v2_7a_pricing_activation_transaction_is_preserved();

create function hotels_v2_private.hotel_external_calendar_evolve_function(
  p_signature text,p_needle text,p_replacement text,p_expected_count integer
) returns void language plpgsql security definer set search_path=pg_catalog,public
as $function$
declare v_definition text; v_count integer;
begin
  if p_signature is null or to_regprocedure(p_signature) is null or p_needle is null
     or p_needle='' or p_replacement is null or p_expected_count<=0 then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_invalid_source_patch';
  end if;
  v_definition:=pg_get_functiondef(to_regprocedure(p_signature));
  v_count:=(length(v_definition)-length(replace(v_definition,p_needle,'')))/length(p_needle);
  if v_count<>p_expected_count then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_source_drift',
      detail=p_signature||':'||v_count::text||':'||p_expected_count::text;
  end if;
  execute replace(v_definition,p_needle,p_replacement);
end
$function$;

-- Non-recursive bridge for immutable pricing/ADMIN-D receipts whose accepted
-- dependency was the pre-provider external helper.  It never calls a pricing
-- validator; higher-layer validators may therefore use it without a cycle.
create function public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()
returns boolean language plpgsql stable security definer
set search_path=pg_catalog,public
as $function$
declare
  v_receipt hotels_v2_private.hotel_external_calendar_provider_evolution_receipts%rowtype;
  v_live_definitions jsonb;
  v_live_sources jsonb;
  v_pricing_scoped_lineage jsonb;
  v_pricing_scoped_lineage_source_hash text;
  v_transaction_preservation_source_hash text;
  v_inflight boolean:=false;
  v_finalized boolean:=false;
  v_safe_function oid;
begin
  if (select count(*)
      from hotels_v2_private.hotel_external_calendar_provider_evolution_receipts)<>1 then
    return false;
  end if;
  select * into strict v_receipt
  from hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
  where id=1;
  v_pricing_scoped_lineage:=
    public.hotel_v2_seven_arches_pricing_scoped_lineage();
  select encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),
    'sha256'),'hex') into v_pricing_scoped_lineage_source_hash
  from pg_proc procedure_row where procedure_row.oid=
    'public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure;
  select encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),
    'sha256'),'hex') into v_transaction_preservation_source_hash
  from pg_proc procedure_row where procedure_row.oid=
    'public.hotel_v2_7a_pricing_activation_transaction_is_preserved()'::regprocedure;
  v_inflight:=v_receipt.receipt_hash is null
    and v_receipt.safe_function_source_hash is null
    and v_receipt.evolved_protected_fingerprints is null
    and v_receipt.evolved_protected_fingerprint is null
    and v_receipt.evolution_helper_fingerprints is null
    and v_receipt.fingerprint_helper_source_hashes is null
    and to_regprocedure(
      'hotels_v2_private.hotel_external_calendar_evolve_function(text,text,text,integer)')
      is not null
    and not exists(select 1 from pg_trigger trigger_row
      where trigger_row.tgrelid=
        'hotels_v2_private.hotel_external_calendar_provider_evolution_receipts'::regclass
        and not trigger_row.tgisinternal
        and trigger_row.tgname=
          'hotel_external_calendar_provider_evolution_receipt_immutable')
    and not (select attribute.attnotnull from pg_attribute attribute
      where attribute.attrelid=
        'hotels_v2_private.hotel_external_calendar_provider_evolution_receipts'::regclass
        and attribute.attname='receipt_hash' and not attribute.attisdropped);
  if not v_inflight then
    v_safe_function:=to_regprocedure(
      'public.hotel_v2_external_calendar_provider_evolution_is_safe()');
    if v_safe_function is null then
      return false;
    end if;
    v_finalized:=v_receipt.evolved_protected_fingerprints is not null
      and v_receipt.evolved_protected_fingerprint=
        public.hotel_v2_external_calendar_worker_hash(
          v_receipt.evolved_protected_fingerprints)
      and v_receipt.evolution_helper_fingerprints is not null
      and v_receipt.fingerprint_helper_source_hashes is not null
      and v_receipt.safe_function_source_hash=
        public.hotel_v2_external_calendar_worker_hash(
          to_jsonb(pg_get_functiondef(v_safe_function)))
      and v_receipt.receipt_hash=
        public.hotel_v2_external_calendar_worker_hash(jsonb_set(
          to_jsonb(v_receipt)-'receipt_hash','{created_at}',to_jsonb(
            (extract(epoch from v_receipt.created_at)*1000000)::bigint),false))
      and not exists(select 1 from unnest(array[
          'evolved_protected_fingerprints','evolved_protected_fingerprint',
          'evolved_function_fingerprints','evolved_function_source_hashes',
          'evolved_reviewed_pricing_catalog_fingerprint',
          'evolution_helper_fingerprints','fingerprint_helper_source_hashes',
          'safe_function_source_hash','receipt_hash']::text[]) expected(column_name)
        left join pg_attribute attribute on attribute.attrelid=
          'hotels_v2_private.hotel_external_calendar_provider_evolution_receipts'::regclass
          and attribute.attname=expected.column_name and not attribute.attisdropped
        where attribute.attnum is null or not attribute.attnotnull)
      and exists(select 1 from pg_trigger trigger_row
        where trigger_row.tgrelid=
          'hotels_v2_private.hotel_external_calendar_provider_evolution_receipts'::regclass
          and not trigger_row.tgisinternal
          and trigger_row.tgname=
            'hotel_external_calendar_provider_evolution_receipt_immutable'
          and trigger_row.tgenabled='O'
          and trigger_row.tgfoid=
            'public.hotel_v2_h3_2a_reject_immutable_change()'::regprocedure);
  end if;
  if v_receipt.evolved_function_fingerprints is null
     or v_receipt.evolved_function_source_hashes is null then
    return false;
  end if;
  v_live_definitions:=
    hotels_v2_private.hotel_external_calendar_provider_function_fingerprints();
  v_live_sources:=
    hotels_v2_private.hotel_external_calendar_provider_function_source_hashes();
  return v_receipt.changed_function_signatures is not distinct from array[
      'public.hotel_v2_admin_d_current_foundation_snapshot()',
      'public.hotel_v2_admin_d_snapshot(uuid,date,date,boolean)',
      'public.hotel_v2_external_calendar_apply_common(text,jsonb,uuid,uuid,text)',
      'public.hotel_v2_external_calendar_control_common(text,uuid,uuid)',
      'public.hotel_v2_external_calendar_guard_room_unit_capacity()',
      'public.hotel_v2_external_calendar_guard_source()',
      'public.hotel_v2_external_calendar_preview_common(text,jsonb)',
      'public.hotel_v2_external_calendar_protected_fingerprints()',
      'public.hotel_v2_external_calendar_provider_sources_are_attributable()',
      'public.hotel_v2_external_calendar_scheduler_enqueue_internal(integer)',
      'public.hotel_v2_external_calendar_scheduler_lease(integer,uuid,integer)',
      'public.hotel_v2_external_calendar_set_secret_internal(uuid,bigint,text,text)',
      'public.hotel_v2_external_calendar_source_projection(uuid)',
      'public.hotel_v2_external_calendar_worker_begin_sync(jsonb)',
      'public.hotel_v2_external_calendar_worker_finalize_sync(jsonb)',
      'public.hotel_v2_external_calendar_worker_get_source_stage2a(uuid)',
      'public.hotel_v2_external_calendar_worker_list_sources(integer)',
      'public.hotel_v2_partner_apply_external_calendar_plan(jsonb,uuid,uuid,text)',
      'public.hotel_v2_public_quote_seven_arches_core(jsonb)',
      'public.hotel_v2_seven_arches_independent_pricing_activation_lineage()',
      'public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()',
      'public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()',
      'public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()',
      'public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()'
    ]::text[]
    and v_receipt.contract_version=
      'hotels_v2_external_calendar_provider_evolution_v1'
    and v_receipt.provider_bridge_source_hash is not distinct from
      (select encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),
        'sha256'),'hex') from pg_proc procedure_row where procedure_row.oid=
        'public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()'::regprocedure)
    and (v_inflight or v_finalized)
    and v_receipt.historical_property_site_settings_raw_fingerprint=
      (select property.protected_fingerprints->>'site_settings'
       from public.hotel_partner_property_proposal_foundation_receipts property
       where property.id=1)
    and v_receipt.historical_stage2_site_settings_raw_fingerprint=
      (select owner_receipt.stage2_current_protected_fingerprints->>'site_settings'
       from public.hotel_admin_availability_foundation_evolution_receipts owner_receipt
       where owner_receipt.id=1)
    and v_receipt.historical_property_site_settings_raw_fingerprint=
      v_receipt.historical_stage2_site_settings_raw_fingerprint
    and v_receipt.historical_property_map_fingerprint=
      (select property.protected_fingerprint
       from public.hotel_partner_property_proposal_foundation_receipts property
       where property.id=1)
    and v_receipt.historical_stage2_map_fingerprint=
      (select owner_receipt.stage2_current_protected_fingerprint
       from public.hotel_admin_availability_foundation_evolution_receipts owner_receipt
       where owner_receipt.id=1)
    and v_receipt.canonical_site_settings_lifecycle_fingerprint=
      public.hotel_v2_external_calendar_site_settings_fingerprint()
    and v_receipt.canonical_site_settings_lifecycle_fingerprint=
      '9d385718586ec03664878d35552e73373bd2e4dca170dc497025fc6780c79bf5'
    and v_receipt.canonical_site_settings_helper_source_hash=
      'e297f1b640f544644d695b36b4aca0b2dc90385e83709e8a494044aabc3b95bd'
    and v_receipt.canonical_site_settings_helper_source_hash=
      (select encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc procedure_row where procedure_row.oid=
         'public.hotel_v2_external_calendar_site_settings_fingerprint()'::regprocedure)
    and v_receipt.site_settings_activation_receipt_fingerprint=
      (select public.hotel_v2_external_calendar_worker_hash(jsonb_set(
         to_jsonb(site_activation),'{created_at}',to_jsonb(
           (extract(epoch from site_activation.created_at)*1000000)::bigint),false))
       from hotels_v2_private.hotel_external_calendar_activation_receipts site_activation
       where site_activation.id=1)
    and v_receipt.pricing_scoped_lineage_at_install_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(
        v_receipt.pricing_scoped_lineage_at_install)
    and v_receipt.pricing_scoped_lineage_at_install->>'contract_version'=
      'hotels_v2_seven_arches_pricing_scoped_lineage_v1'
    and v_receipt.pricing_scoped_lineage_at_install->>
      'site_settings_lifecycle_fingerprint'=
        v_receipt.canonical_site_settings_lifecycle_fingerprint
    and v_receipt.pricing_scoped_lineage_helper_source_hash=
      v_pricing_scoped_lineage_source_hash
    and v_receipt.pricing_transaction_preservation_source_hash=
      v_transaction_preservation_source_hash
    and public.hotel_v2_7a_pricing_activation_transaction_is_preserved()
    and jsonb_typeof(v_pricing_scoped_lineage)='object'
    and v_pricing_scoped_lineage->>'contract_version'=
      'hotels_v2_seven_arches_pricing_scoped_lineage_v1'
    and v_pricing_scoped_lineage->>'site_settings_lifecycle_fingerprint'=
      v_receipt.canonical_site_settings_lifecycle_fingerprint
    and exists(select 1 from pg_proc procedure_row
      where procedure_row.oid=
          'public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure
        and procedure_row.proowner='postgres'::regrole
        and procedure_row.prosecdef
        and procedure_row.provolatile='s'
        and procedure_row.proconfig=
          array['search_path=pg_catalog, public']::text[]
        and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
        and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
        and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
        and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
    and exists(select 1 from pg_proc procedure_row
      where procedure_row.oid=
          'public.hotel_v2_7a_pricing_activation_transaction_is_preserved()'::regprocedure
        and procedure_row.proowner='postgres'::regrole
        and procedure_row.prosecdef
        and procedure_row.provolatile='s'
        and procedure_row.proconfig=
          array['search_path=pg_catalog, public']::text[]
        and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
        and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
        and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
        and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
    and v_receipt.prior_function_source_hashes->>
      'public.hotel_v2_h3_2b_protected_fingerprints()'=
      '7ca318d9b7b441fa67b1f67b95100d4feee5cf9e1e336a826cbe7408edac97f2'
    and v_receipt.prior_function_source_hashes->>
      'public.hotel_v2_seven_arches_pricing_scoped_lineage()'=
      v_receipt.pricing_scoped_lineage_helper_source_hash
    and v_receipt.prior_function_fingerprints->>
      'public.hotel_v2_external_calendar_provider_sources_are_attributable()'=
      (select foundation.provider_source_attribution_source_hash
       from public.hotel_partner_property_proposal_foundation_receipts foundation
       where foundation.id=1)
    and v_receipt.prior_function_fingerprints->>
      'public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()'=
      (select canonical.canonical_snapshot_source_hash
       from public.hotel_seven_arches_task2_stage2_compatibility_receipts canonical
       where canonical.id=1)
    and v_receipt.prior_function_fingerprints->>
      'public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()'=
      (select canonical.validator_source_hash
       from public.hotel_seven_arches_task2_stage2_compatibility_receipts canonical
       where canonical.id=1)
    and v_receipt.evolved_function_source_hashes->>
      'public.hotel_v2_seven_arches_pricing_scoped_lineage()'=
      v_receipt.pricing_scoped_lineage_helper_source_hash
    and v_receipt.evolved_function_source_hashes->>
      'public.hotel_v2_h3_2b_protected_fingerprints()'=
      '7ca318d9b7b441fa67b1f67b95100d4feee5cf9e1e336a826cbe7408edac97f2'
    and v_receipt.prior_function_source_hashes->>
      'public.hotel_v2_external_calendar_protected_fingerprints()'=
      'e9df9093d67ff5039855a0435174416c2eaca71b67700d4806eb56466e9c4af5'
    and v_receipt.prior_function_source_hashes->>
      'public.hotel_v2_external_calendar_provider_sources_are_attributable()'=
      '6aee1bb6d02b999877d6384633dd9eab1e8d533917b24ab25e20c83973a0025f'
    and v_receipt.evolved_function_source_hashes->>
      'public.hotel_v2_external_calendar_provider_sources_are_attributable()'=
      '78cef0753a71a5bf7304f0a627fdf687b12998b80e84626d59d41884dc522d68'
    and v_receipt.evolved_function_source_hashes->>
      'public.hotel_v2_external_calendar_protected_fingerprints()'=
      'f432744ec7753928726b3a4d4c999183d6f1f394217aa35182f594cd05b39d49'
    and v_receipt.prior_function_source_hashes->>
      'public.hotel_v2_admin_d_current_foundation_snapshot()'=
      '2ed412e46a827c3b57b570f3c6675edc5d1a92562fb8acb59b7148b245ed592a'
    and v_receipt.prior_function_source_hashes->>
      'public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()'=
      '04462d1fc2ade7d2c4574e7caef96f323cbb98a31d869c6f02e8f09dffe1dda4'
    and v_receipt.prior_function_source_hashes->>
      'public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()'=
      'c93374ece2a04386ca3b1e6f1168de3ba5162425d977857d1a4b137626ce6650'
    and v_receipt.evolved_function_source_hashes->>
      'public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()'=
      '598c3510d00ae3b71d15b20906fc6c00eb01f70e11c89eee5bb49bcdeae41d9b'
    and v_receipt.prior_function_source_hashes->>
      'public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()'=
      '61556afaeb2359b1850dd517c655cc6d05aa1babdaf63bf31b0ad53de18aff7b'
    and v_receipt.prior_function_source_hashes->>
      'public.hotel_v2_public_quote_seven_arches_core(jsonb)'=
      '5265e97e8971d06e95e27db72ebc2f5e006eac8cb17779f1cff6ab519f9e6559'
    and v_receipt.prior_function_source_hashes->>
      'public.hotel_v2_seven_arches_independent_pricing_activation_lineage()'=
      '2bda434306e7ffc14c852ca6ab8deb4edf77411cab5658b77c0bef743c91388d'
    and v_receipt.prior_reviewed_pricing_catalog_fingerprint is not distinct from
      (select foundation.catalog_fingerprint
       from public.hotel_seven_arches_reviewed_pricing_foundation_receipts foundation
       where foundation.id=1)
    and v_receipt.evolved_reviewed_pricing_catalog_fingerprint is not distinct from
      public.hotel_v2_seven_arches_reviewed_pricing_catalog_fingerprint()
    and v_receipt.evolved_function_fingerprints is not distinct from
      v_live_definitions
    and v_receipt.evolved_function_source_hashes is not distinct from
      v_live_sources
    and not exists(select 1
      from jsonb_each(v_receipt.prior_function_source_hashes) prior(signature,value)
      where signature<>all(v_receipt.changed_function_signatures)
        and value is distinct from
          v_receipt.evolved_function_source_hashes->signature)
    and not exists(select 1
      from unnest(v_receipt.changed_function_signatures) changed(signature)
      where v_receipt.prior_function_source_hashes->signature is null
        or v_receipt.evolved_function_source_hashes->signature is null
        or v_receipt.prior_function_source_hashes->signature is not distinct from
          v_receipt.evolved_function_source_hashes->signature);
exception when no_data_found or too_many_rows or undefined_function
  or undefined_table then
  return false;
end
$function$;

update hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
set provider_bridge_source_hash=(select encode(extensions.digest(
  convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')
  from pg_proc procedure_row where procedure_row.oid=
    'public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()'::regprocedure)
where id=1;
alter table hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
  alter column provider_bridge_source_hash set not null;

-- Evolve the raw helper's provider classification in place. Its OID and raw
-- live-state behavior remain intact; no foundation-pinned wrapper replaces it.
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_protected_fingerprints()',
  'where source.source_type<>''ical'' order by source.id',
  'where not public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type) order by source.id',1);

-- Partner proposal submission consumes its reviewed plan without mutating a
-- live calendar source.  Evolve the accepted attribution predicate so that
-- this one no-activity transition is attributable only through the exact
-- proposal row and exact Partner submission receipt; every other consumed
-- review retains the historical activity requirement.
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_provider_sources_are_attributable()',
  $provider_attribution_needle$  if exists(select 1 from hotels_v2_private.hotel_external_calendar_plan_reviews review
      where review.consumed_at is not null and not exists(select 1 from public.hotel_activity_log activity
        where activity.source='hotels_v2_external_calendar_control'
          and activity.correlation_id=review.consumed_correlation_id))
     or exists(select 1 from hotels_v2_private.hotel_external_calendar_correlations correlation
      where not exists(select 1 from public.hotel_activity_log activity
        where activity.source='hotels_v2_external_calendar_control'
          and activity.correlation_id=correlation.correlation_id))
     or exists(select 1 from hotels_v2_private.hotel_external_calendar_admin_receipts receipt
      where not exists(select 1 from public.hotel_activity_log activity
        where activity.source='hotels_v2_external_calendar_control'
          and activity.correlation_id=receipt.correlation_id))
     or exists(select 1 from public.hotel_partner_action_receipts receipt
      where receipt.action='h3_2d_external_calendar' and not exists(select 1
        from public.hotel_activity_log activity
        where activity.source='hotels_v2_external_calendar_control'
          and activity.correlation_id=receipt.correlation_id)) then
    return false;
  end if;$provider_attribution_needle$,
  $provider_attribution_replacement$  if exists(select 1
      from hotels_v2_private.hotel_external_calendar_plan_reviews review
      where review.consumed_at is not null
        and not exists(select 1 from public.hotel_activity_log activity
          where activity.source='hotels_v2_external_calendar_control'
            and activity.correlation_id=review.consumed_correlation_id)
        and (select count(*)
          from hotels_v2_private.hotel_external_calendar_partner_proposals proposal
          join public.hotel_partner_action_receipts receipt
            on receipt.action='h3_2d_external_calendar_provider_proposal'
           and receipt.partner_id=proposal.partner_id
           and receipt.hotel_id=proposal.hotel_id
           and receipt.actor_user_id=proposal.actor_id
           and receipt.correlation_id=proposal.submission_correlation_id
           and receipt.idempotency_key=proposal.submission_idempotency_key
           and receipt.request_hash=proposal.submission_request_hash
           and receipt.result=jsonb_build_object(
             'contract_version','hotels_v2_external_calendar_partner_proposal_receipt_v1',
             'proposal_id',proposal.id,'hotel_id',proposal.hotel_id,
             'partner_id',proposal.partner_id,
             'correlation_id',proposal.submission_correlation_id,
             'idempotency_key',proposal.submission_idempotency_key,
             'request_hash',proposal.submission_request_hash,
             'status','pending_admin_review')
          where proposal.partner_review_id=review.id
            and proposal.actor_id=review.actor_id
            and proposal.partner_id=review.partner_id
            and proposal.assignment_id=review.assignment_id
            and proposal.hotel_id=review.hotel_id
            and proposal.permission_version=review.permission_version
            and proposal.access_snapshot_token=review.access_snapshot_token
            and proposal.snapshot_token=review.snapshot_token
            and proposal.reviewed_plan=review.reviewed_plan
            and proposal.plan_fingerprint=review.plan_fingerprint
            and proposal.submission_correlation_id=review.consumed_correlation_id
            and proposal.submitted_at=review.consumed_at)<>1)
     or exists(select 1
      from hotels_v2_private.hotel_external_calendar_correlations correlation
      where not exists(select 1 from public.hotel_activity_log activity
        where activity.source='hotels_v2_external_calendar_control'
          and activity.correlation_id=correlation.correlation_id))
     or exists(select 1
      from hotels_v2_private.hotel_external_calendar_admin_receipts receipt
      where not exists(select 1 from public.hotel_activity_log activity
        where activity.source='hotels_v2_external_calendar_control'
          and activity.correlation_id=receipt.correlation_id))
     or exists(select 1 from public.hotel_partner_action_receipts receipt
      where receipt.action='h3_2d_external_calendar' and not exists(select 1
        from public.hotel_activity_log activity
        where activity.source='hotels_v2_external_calendar_control'
          and activity.correlation_id=receipt.correlation_id))
     or exists(select 1
      from hotels_v2_private.hotel_external_calendar_partner_proposals proposal
      where (select count(*)
        from hotels_v2_private.hotel_external_calendar_plan_reviews review
        join public.hotel_partner_action_receipts receipt
          on receipt.action='h3_2d_external_calendar_provider_proposal'
         and receipt.partner_id=proposal.partner_id
         and receipt.hotel_id=proposal.hotel_id
         and receipt.actor_user_id=proposal.actor_id
         and receipt.correlation_id=proposal.submission_correlation_id
         and receipt.idempotency_key=proposal.submission_idempotency_key
         and receipt.request_hash=proposal.submission_request_hash
         and receipt.result=jsonb_build_object(
           'contract_version','hotels_v2_external_calendar_partner_proposal_receipt_v1',
           'proposal_id',proposal.id,'hotel_id',proposal.hotel_id,
           'partner_id',proposal.partner_id,
           'correlation_id',proposal.submission_correlation_id,
           'idempotency_key',proposal.submission_idempotency_key,
           'request_hash',proposal.submission_request_hash,
           'status','pending_admin_review')
        where review.id=proposal.partner_review_id
          and review.actor_type='partner'
          and review.actor_id=proposal.actor_id
          and review.partner_id=proposal.partner_id
          and review.assignment_id=proposal.assignment_id
          and review.hotel_id=proposal.hotel_id
          and review.permission_version=proposal.permission_version
          and review.access_snapshot_token=proposal.access_snapshot_token
          and review.snapshot_token=proposal.snapshot_token
          and review.reviewed_plan=proposal.reviewed_plan
          and review.plan_fingerprint=proposal.plan_fingerprint
          and review.consumed_correlation_id=proposal.submission_correlation_id
          and review.consumed_at=proposal.submitted_at)<>1)
     or exists(select 1 from public.hotel_partner_action_receipts receipt
      where receipt.action='h3_2d_external_calendar_provider_proposal'
        and (select count(*)
          from hotels_v2_private.hotel_external_calendar_partner_proposals proposal
          join hotels_v2_private.hotel_external_calendar_plan_reviews review
            on review.id=proposal.partner_review_id
           and review.actor_type='partner'
           and review.actor_id=proposal.actor_id
           and review.partner_id=proposal.partner_id
           and review.assignment_id=proposal.assignment_id
           and review.hotel_id=proposal.hotel_id
           and review.permission_version=proposal.permission_version
           and review.access_snapshot_token=proposal.access_snapshot_token
           and review.snapshot_token=proposal.snapshot_token
           and review.reviewed_plan=proposal.reviewed_plan
           and review.plan_fingerprint=proposal.plan_fingerprint
           and review.consumed_correlation_id=proposal.submission_correlation_id
           and review.consumed_at=proposal.submitted_at
          where receipt.partner_id=proposal.partner_id
            and receipt.hotel_id=proposal.hotel_id
            and receipt.actor_user_id=proposal.actor_id
            and receipt.correlation_id=proposal.submission_correlation_id
            and receipt.idempotency_key=proposal.submission_idempotency_key
            and receipt.request_hash=proposal.submission_request_hash
            and receipt.result=jsonb_build_object(
              'contract_version','hotels_v2_external_calendar_partner_proposal_receipt_v1',
              'proposal_id',proposal.id,'hotel_id',proposal.hotel_id,
              'partner_id',proposal.partner_id,
              'correlation_id',proposal.submission_correlation_id,
              'idempotency_key',proposal.submission_idempotency_key,
              'request_hash',proposal.submission_request_hash,
              'status','pending_admin_review'))<>1) then
    return false;
  end if;$provider_attribution_replacement$,1);

-- Worker and scheduler selection/binding.
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_worker_get_source_stage2a(uuid)',
  'v_source.source_type <> ''ical''','not public.hotel_v2_external_calendar_ics_source_type_is_supported(v_source.source_type)',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_worker_list_sources(integer)',
  'source.source_type=''ical''','public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type)',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_worker_begin_sync(jsonb)',
  'v_source.source_type<>''ical''','not public.hotel_v2_external_calendar_ics_source_type_is_supported(v_source.source_type)',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_worker_finalize_sync(jsonb)',
  'v_source.source_type<>''ical''','not public.hotel_v2_external_calendar_ics_source_type_is_supported(v_source.source_type)',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_scheduler_enqueue_internal(integer)',
  'source.source_type=''ical''','public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type)',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_scheduler_lease(integer,uuid,integer)',
  'source.source_type=''ical''','public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type)',1);

-- ADMIN-D capacity overlay remains subtractive and now aggregates every
-- supported iCalendar-labelled provider.
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_admin_d_snapshot(uuid,date,date,boolean)',
  'source.source_type=''ical''','public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type)',2);

-- Table guards, lifecycle guards and redacted control projection.
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_guard_source()',
  'new.source_type<>''ical''','not public.hotel_v2_external_calendar_ics_source_type_is_supported(new.source_type)',3);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_guard_source()',
  'if tg_op=''UPDATE'' and new.room_type_id is distinct from old.room_type_id and (old.is_enabled',
  'if tg_op=''UPDATE'' and (new.room_type_id is distinct from old.room_type_id or new.source_type is distinct from old.source_type) and (old.is_enabled',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_guard_room_unit_capacity()',
  'source.source_type=''ical''','public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type)',4);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_source_projection(uuid)',
  'source.source_type=''ical''','public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type)',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_control_common(text,uuid,uuid)',
  'source.source_type=''ical''','public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type)',5);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_control_common(text,uuid,uuid)',
  E'return jsonb_build_object(''contract_version'',''hotels_v2_external_calendar_control_v1'',\n    ''hotel_id'',p_hotel_id,''partner_id'',p_partner_id,''assignment_id'',v_assignment,',
  E'return jsonb_build_object(''contract_version'',''hotels_v2_external_calendar_control_v2'',\n    ''hotel_id'',p_hotel_id,''partner_id'',p_partner_id,''assignment_id'',v_assignment,',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_control_common(text,uuid,uuid)',
  '''sources'',v_sources,''public_change'',false)',
  E'''sources'',v_sources,\n    ''provider_capability'',jsonb_build_object(\n      ''contract_version'',''hotels_v2_external_calendar_provider_capability_v1'',\n      ''stage'',''provider_types_active'',\n      ''supported_providers'',jsonb_build_array(''booking_com'',''airbnb'',''ical''),\n      ''source_review_available'',true,''private_url_management_available'',true,\n      ''activation_available'',coalesce((select hotel_external_sync_enabled\n        from public.site_settings where id=1),false)\n        and hotels_v2_private.hotel_external_calendar_provider_worker_scheduler_is_ready(),\n      ''manual_sync_available'',coalesce((select hotel_external_sync_enabled\n        from public.site_settings where id=1),false)\n        and hotels_v2_private.hotel_external_calendar_provider_worker_scheduler_is_ready(),\n      ''worker_scheduler_ready'',\n        hotels_v2_private.hotel_external_calendar_provider_worker_scheduler_is_ready()),\n    ''provider_proposals'',coalesce((select jsonb_agg(\n      hotels_v2_private.hotel_external_calendar_provider_proposal_summary(proposal.id)\n      order by proposal.submitted_at desc,proposal.id)\n      from hotels_v2_private.hotel_external_calendar_partner_proposals proposal\n      where proposal.hotel_id=p_hotel_id\n        and (p_actor_type=''admin'' or proposal.partner_id=p_partner_id)),''[]''::jsonb),\n    ''public_change'',false)',1);

select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_control_common(text,uuid,uuid)',
  'hotels_v2_private.hotel_external_calendar_provider_proposal_summary(proposal.id)',
  E'case when p_actor_type=''partner'' then jsonb_set(\n        hotels_v2_private.hotel_external_calendar_provider_proposal_summary(proposal.id),\n        ''{reviewed_by}'',''null''::jsonb,false)\n      else hotels_v2_private.hotel_external_calendar_provider_proposal_summary(proposal.id) end',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_control_common(text,uuid,uuid)',
  E'from hotels_v2_private.hotel_external_calendar_partner_proposals proposal\n      where proposal.hotel_id=p_hotel_id\n        and (p_actor_type=''admin'' or proposal.partner_id=p_partner_id)',
  E'from (select candidate.id,candidate.submitted_at\n        from hotels_v2_private.hotel_external_calendar_partner_proposals candidate\n        where candidate.hotel_id=p_hotel_id\n          and (p_actor_type=''admin'' or candidate.partner_id=p_partner_id)\n        order by candidate.submitted_at desc,candidate.id limit 100) proposal',1);

-- Reviewed source create/update contract: source_type is explicit and exact.
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_preview_common(text,jsonb)',
  'array[''room_type_id'',''code'',''sync_interval_minutes'',''units_per_event'',''priority'']',
  'array[''room_type_id'',''code'',''source_type'',''sync_interval_minutes'',''units_per_event'',''priority'']',2);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_preview_common(text,jsonb)',
  E'or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(v_payload)\n       or jsonb_typeof(v_payload->''code'')<>''string''',
  E'or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(v_payload)\n       or jsonb_typeof(v_payload->''source_type'')<>''string''\n       or not public.hotel_v2_external_calendar_ics_source_type_is_supported(v_payload->>''source_type'')\n       or jsonb_typeof(v_payload->''code'')<>''string''',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_preview_common(text,jsonb)',
  '''code'',v_payload->''code'',''source_type'',''ical''',
  '''code'',v_payload->''code'',''source_type'',v_payload->''source_type''',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_preview_common(text,jsonb)',
  'v_source.source_type<>''ical''','not public.hotel_v2_external_calendar_ics_source_type_is_supported(v_source.source_type)',4);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_preview_common(text,jsonb)',
  'if v_source.room_type_id<>(v_payload->>''room_type_id'')::uuid and (v_source.is_enabled',
  'if (v_source.room_type_id<>(v_payload->>''room_type_id'')::uuid or v_source.source_type<>v_payload->>''source_type'') and (v_source.is_enabled',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_preview_common(text,jsonb)',
  '''code'',v_payload->''code'',''priority'',v_payload->''priority''',
  '''code'',v_payload->''code'',''source_type'',v_payload->''source_type'',''priority'',v_payload->''priority''',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_preview_common(text,jsonb)',
  E'v_changed:=v_source.room_type_id<>(v_payload->>''room_type_id'')::uuid\n        or v_source.code<>v_payload->>''code''',
  E'v_changed:=v_source.room_type_id<>(v_payload->>''room_type_id'')::uuid\n        or v_source.source_type<>v_payload->>''source_type'' or v_source.code<>v_payload->>''code''',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_preview_common(text,jsonb)',
  '["code","priority","room_type_id","sync_interval_minutes","units_per_event"]',
  '["code","priority","room_type_id","source_type","sync_interval_minutes","units_per_event"]',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_preview_common(text,jsonb)',
  E'      if not (v_control->>''hotel_external_sync_enabled'')::boolean then\n        return jsonb_build_object(''contract_version'',''hotels_v2_external_calendar_preview_v1'',\n          ''hotel_id'',v_hotel,''partner_id'',v_partner,''changed'',false,\n          ''blocking_reasons'',''["external_calendar_not_activated"]''::jsonb,''impacts'',''[]''::jsonb,''reviewed_plan'',null);\n      end if;',
  E'      if not (v_control->>''hotel_external_sync_enabled'')::boolean\n         or not hotels_v2_private.hotel_external_calendar_provider_worker_scheduler_is_ready() then\n        return jsonb_build_object(''contract_version'',''hotels_v2_external_calendar_preview_v1'',\n          ''hotel_id'',v_hotel,''partner_id'',v_partner,''changed'',false,\n          ''blocking_reasons'',case\n            when not (v_control->>''hotel_external_sync_enabled'')::boolean\n              then ''["external_calendar_not_activated"]''::jsonb\n            else ''["provider_worker_scheduler_not_ready"]''::jsonb end,\n          ''impacts'',''[]''::jsonb,''reviewed_plan'',null);\n      end if;',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_preview_common(text,jsonb)',
  E'    if not found or not public.hotel_v2_external_calendar_ics_source_type_is_supported(v_source.source_type) or not v_source.is_enabled\n       or not (v_control->>''hotel_external_sync_enabled'')::boolean then',
  E'    if not found\n       or not public.hotel_v2_external_calendar_ics_source_type_is_supported(\n         v_source.source_type) or not v_source.is_enabled\n       or not (v_control->>''hotel_external_sync_enabled'')::boolean\n       or not hotels_v2_private.hotel_external_calendar_provider_worker_scheduler_is_ready() then',1);

select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_preview_common(text,jsonb)',
  E'  if v_entity=''calendar_source'' and v_action=''create'' then\n    if v_id is not null then raise exception using errcode=''22023'',message=''hotels_v2_external_calendar_create_id_must_be_null''; end if;\n    v_id:=gen_random_uuid();\n  elsif v_id is null then',
  E'  if v_entity=''calendar_source'' and v_action=''create'' then\n    if v_id is null then\n      v_id:=gen_random_uuid();\n    elsif p_actor_type<>''admin''\n       or nullif(current_setting(''hotels_v2.external_calendar_provider_proposal_id'',true),'''') is null\n       or not exists(select 1\n         from hotels_v2_private.hotel_external_calendar_partner_proposals proposal\n         where proposal.id=current_setting(\n             ''hotels_v2.external_calendar_provider_proposal_id'',true)::uuid\n           and proposal.hotel_id=v_hotel and proposal.status=''pending_admin_review''\n           and proposal.entity=''calendar_source'' and proposal.action=''create''\n           and proposal.source_id=v_id\n           and proposal.operation->>''expected_version''=v_intent->>''expected_version''\n           and proposal.operation->''payload'' is not distinct from v_intent->''payload'') then\n      raise exception using errcode=''22023'',\n        message=''hotels_v2_external_calendar_create_id_must_be_null'';\n    end if;\n  elsif v_id is null then',1);

-- A private feed URL is bounded HTTPS without embedded authority credentials.
-- It is inspected only inside SECURITY DEFINER code and never projected.
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_preview_common(text,jsonb)',
  E'or jsonb_typeof(v_payload->''ical_url'')<>''string'' or length(btrim(v_payload->>''ical_url'')) not between 12 and 4096\n       or btrim(v_payload->>''ical_url'')!~''^https://[^[:space:][:cntrl:]]+$''))',
  E'or jsonb_typeof(v_payload->''ical_url'')<>''string'' or length(btrim(v_payload->>''ical_url'')) not between 12 and 4096\n       or btrim(v_payload->>''ical_url'')!~''^https://[^/?#[:space:][:cntrl:]@]+([/?#].*)?$''))',1);

select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_set_secret_internal(uuid,bigint,text,text)',
  'v_source.source_type<>''ical''','not public.hotel_v2_external_calendar_ics_source_type_is_supported(v_source.source_type)',1);

-- An Admin acceptance promotes the exact proposal-scoped Vault entry into the
-- live source binding. Direct Admin plans retain the accepted behavior when
-- the two internal proposal GUCs are absent.
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_set_secret_internal(uuid,bigint,text,text)',
  $provider_needle$declare v_binding hotels_v2_private.hotel_external_calendar_source_secrets%rowtype;
  v_source public.hotel_calendar_source_configs%rowtype; v_secret uuid; v_name text; v_description text; v_key uuid;$provider_needle$,
  $provider_replacement$declare v_binding hotels_v2_private.hotel_external_calendar_source_secrets%rowtype;
  v_source public.hotel_calendar_source_configs%rowtype; v_secret uuid; v_name text; v_description text; v_key uuid;
  v_staged_secret_id uuid:=nullif(current_setting(
    'hotels_v2.external_calendar_provider_staged_secret_id',true),'')::uuid;
  v_proposal_id uuid:=nullif(current_setting(
    'hotels_v2.external_calendar_provider_proposal_id',true),'')::uuid;$provider_replacement$,1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_set_secret_internal(uuid,bigint,text,text)',
  $provider_needle$  select * into v_binding from hotels_v2_private.hotel_external_calendar_source_secrets
    where source_id=p_source_id for update;$provider_needle$,
  $provider_replacement$  if (v_staged_secret_id is null)<>(v_proposal_id is null)
     or (v_staged_secret_id is not null and (
       not exists(select 1
         from hotels_v2_private.hotel_external_calendar_partner_proposals proposal
         where proposal.id=v_proposal_id
           and proposal.status='pending_admin_review'
           and proposal.entity='ical_secret'
           and proposal.action in('set','rotate')
           and proposal.source_id=p_source_id
           and proposal.vault_secret_id=v_staged_secret_id
           and proposal.url_fingerprint=p_url_fingerprint)
       or (select count(*) from vault.decrypted_secrets secret
         where secret.id=v_staged_secret_id
           and secret.name='hotel-calendar-proposal-'||v_proposal_id::text
           and encode(extensions.digest(convert_to(secret.decrypted_secret,'UTF8'),
             'sha256'),'hex')=p_url_fingerprint)<>1)) then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_provider_staged_secret_mismatch';
  end if;
  select * into v_binding from hotels_v2_private.hotel_external_calendar_source_secrets
    where source_id=p_source_id for update;$provider_replacement$,1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_set_secret_internal(uuid,bigint,text,text)',
  $provider_needle$    select vault.create_secret(btrim(p_url),'hotel-calendar-source-'||p_source_id||'-'||gen_random_uuid(),
      'Hotels V2 iCal source '||p_source_id,null) into v_secret;$provider_needle$,
  $provider_replacement$    if v_staged_secret_id is null then
      select vault.create_secret(btrim(p_url),
        'hotel-calendar-source-'||p_source_id||'-'||gen_random_uuid(),
        'Hotels V2 iCal source '||p_source_id,null) into v_secret;
    else
      select secret.key_id into strict v_key from vault.secrets secret
      where secret.id=v_staged_secret_id
        and secret.name='hotel-calendar-proposal-'||v_proposal_id::text;
      perform vault.update_secret(v_staged_secret_id,btrim(p_url),
        'hotel-calendar-source-'||p_source_id||'-'||v_staged_secret_id,
        'Hotels V2 iCal source '||p_source_id,v_key);
      v_secret:=v_staged_secret_id;
    end if;$provider_replacement$,1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_set_secret_internal(uuid,bigint,text,text)',
  $provider_needle$    select name,description,key_id into strict v_name,v_description,v_key from vault.secrets where id=v_binding.vault_secret_id;
    perform vault.update_secret(v_binding.vault_secret_id,btrim(p_url),v_name,v_description,v_key);
    update hotels_v2_private.hotel_external_calendar_source_secrets set version=version+1,
      url_fingerprint=p_url_fingerprint,updated_at=clock_timestamp() where source_id=p_source_id
      returning version into p_expected_binding_version;$provider_needle$,
  $provider_replacement$    if v_staged_secret_id is null then
      select name,description,key_id into strict v_name,v_description,v_key
      from vault.secrets where id=v_binding.vault_secret_id;
      perform vault.update_secret(v_binding.vault_secret_id,btrim(p_url),
        v_name,v_description,v_key);
      update hotels_v2_private.hotel_external_calendar_source_secrets
      set version=version+1,url_fingerprint=p_url_fingerprint,
        updated_at=clock_timestamp() where source_id=p_source_id
        returning version into p_expected_binding_version;
    else
      if v_binding.vault_secret_id=v_staged_secret_id then
        raise exception using errcode='55000',
          message='hotels_v2_external_calendar_provider_live_secret_collision';
      end if;
      select secret.name into strict v_name from vault.secrets secret
      where secret.id=v_binding.vault_secret_id;
      if left(v_name,length('hotel-calendar-source-'||p_source_id||'-'))<>
          'hotel-calendar-source-'||p_source_id||'-' then
        raise exception using errcode='55000',
          message='hotels_v2_external_calendar_provider_live_secret_mismatch';
      end if;
      select secret.key_id into strict v_key from vault.secrets secret
      where secret.id=v_staged_secret_id
        and secret.name='hotel-calendar-proposal-'||v_proposal_id::text;
      perform vault.update_secret(v_staged_secret_id,btrim(p_url),
        'hotel-calendar-source-'||p_source_id||'-'||v_staged_secret_id,
        'Hotels V2 iCal source '||p_source_id,v_key);
      update hotels_v2_private.hotel_external_calendar_source_secrets
      set vault_secret_id=v_staged_secret_id,version=version+1,
        url_fingerprint=p_url_fingerprint,updated_at=clock_timestamp()
      where source_id=p_source_id returning version into p_expected_binding_version;
      delete from vault.secrets secret
      where secret.id=v_binding.vault_secret_id and secret.name=v_name;
      if not found then
        raise exception using errcode='55000',
          message='hotels_v2_external_calendar_provider_old_secret_cleanup_failed';
      end if;
    end if;$provider_replacement$,1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_apply_common(text,jsonb,uuid,uuid,text)',
  'v_payload->>''code'',''ical'',jsonb_build_object',
  'v_payload->>''code'',v_payload->>''source_type'',jsonb_build_object',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_apply_common(text,jsonb,uuid,uuid,text)',
  'update public.hotel_calendar_source_configs set room_type_id=(v_payload->>''room_type_id'')::uuid,code=v_payload->>''code'',',
  E'update public.hotel_calendar_source_configs set room_type_id=(v_payload->>''room_type_id'')::uuid,code=v_payload->>''code'',\n      source_type=v_payload->>''source_type'',',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_apply_common(text,jsonb,uuid,uuid,text)',
  E'  elsif v_entity=''calendar_source'' and v_action in(''enable'',''disable'') then\n    if v_before is distinct from v_operation->''expected_original'' or v_source.version<>v_expected then\n      raise exception using errcode=''PT409'',message=''hotels_v2_external_calendar_source_stale''; end if;\n    perform set_config(''hotels_v2.external_calendar_apply_context'',p_correlation_id::text,true);',
  E'  elsif v_entity=''calendar_source'' and v_action in(''enable'',''disable'') then\n    if v_before is distinct from v_operation->''expected_original'' or v_source.version<>v_expected then\n      raise exception using errcode=''PT409'',message=''hotels_v2_external_calendar_source_stale''; end if;\n    if v_action=''enable'' and (\n       not coalesce((select hotel_external_sync_enabled from public.site_settings\n         where id=1),false)\n       or not hotels_v2_private.hotel_external_calendar_provider_worker_scheduler_is_ready()\n       or not exists(select 1 from hotels_v2_private.hotel_external_calendar_source_secrets\n         where source_id=v_id)\n       or exists(select 1 from public.hotel_calendar_source_configs other\n         where other.hotel_id=v_hotel and other.room_type_id=v_source.room_type_id\n           and other.is_enabled and other.id<>v_id)) then\n      raise exception using errcode=''23514'',\n        message=''hotels_v2_external_calendar_source_not_activatable'';\n    end if;\n    perform set_config(''hotels_v2.external_calendar_apply_context'',p_correlation_id::text,true);',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_external_calendar_apply_common(text,jsonb,uuid,uuid,text)',
  E'  elsif v_entity=''calendar_sync'' and v_action=''trigger'' then\n    if p_ical_url is not null or v_before is distinct from v_operation->''expected_original''\n       or v_expected<>coalesce((v_before#>>''{health,state_version}'')::bigint,0) then',
  E'  elsif v_entity=''calendar_sync'' and v_action=''trigger'' then\n    if not coalesce((select hotel_external_sync_enabled from public.site_settings\n         where id=1),false)\n       or not hotels_v2_private.hotel_external_calendar_provider_worker_scheduler_is_ready()\n       or v_source.id is null or not v_source.is_enabled\n       or not public.hotel_v2_external_calendar_ics_source_type_is_supported(\n         v_source.source_type) then\n      raise exception using errcode=''23514'',\n        message=''hotels_v2_external_calendar_source_not_triggerable'';\n    end if;\n    if p_ical_url is not null or v_before is distinct from v_operation->''expected_original''\n       or v_expected<>coalesce((v_before#>>''{health,state_version}'')::bigint,0) then',1);

-- Public quote and booking recomputation use the effective provider blocks
-- for every allocated Room/stay date.  Partial blocks are capped against the
-- accepted Room capacity; 7 Arches has one active unit per apartment.
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_public_quote_seven_arches_core(jsonb)',
  E'  if v_allocation_count<>(case when v_guests<=4 then 1 else 2 end)\n     or v_room_total is null then\n    raise exception using errcode=''55000'',\n      message=''hotels_v2_seven_arches_public_quote_authority_resolution_failed'';\n  end if;',
  E'  if v_allocation_count<>(case when v_guests<=4 then 1 else 2 end)\n     or v_room_total is null then\n    raise exception using errcode=''55000'',\n      message=''hotels_v2_seven_arches_public_quote_authority_resolution_failed'';\n  end if;\n  if coalesce((select hotel_external_sync_enabled\n      from public.site_settings where id=1),false) and exists(select 1\n    from jsonb_array_elements(v_allocation) allocation(value)\n    join public.hotel_room_types room\n      on room.id=(allocation.value->>''room_type_id'')::uuid and room.hotel_id=c_hotel\n    cross join lateral generate_series(v_arrival,v_departure-1,interval ''1 day'') stay(stay_date)\n    where coalesce((select sum(block.units_blocked)\n      from hotels_v2_private.hotel_external_calendar_day_blocks block\n      join public.hotel_calendar_source_configs source\n        on source.id=block.source_id and source.hotel_id=block.hotel_id\n       and source.room_type_id=block.room_type_id\n      where block.hotel_id=c_hotel and block.room_type_id=room.id\n        and block.stay_date=stay.stay_date::date and block.is_active\n        and source.is_enabled and source.review_status=''reviewed''\n        and public.hotel_v2_external_calendar_ics_source_type_is_supported(\n          source.source_type)),0)>=case when room.inventory_mode=''unitized''\n        then (select count(*) from public.hotel_units unit\n          where unit.room_type_id=room.id and unit.status=''active'')\n        else room.base_inventory_count end) then\n    raise exception using errcode=''PT409'',\n      message=''hotels_v2_seven_arches_public_quote_room_unavailable'';\n  end if;',1);

-- Coordinate the accepted external-helper evolution with every immutable
-- pricing/ADMIN-D consumer that previously pinned the pre-provider source.
-- Each consumer retains its complete business predicates and accepts the
-- source transition only through the exact, non-recursive provider receipt.
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()',
  E'     or v_task2_foundation.provider_source_attribution_source_hash is distinct from\n       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(v_provider_oid)))',
  E'     or (v_task2_foundation.provider_source_attribution_source_hash is distinct from\n       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(v_provider_oid)))\n       and not public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact())',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()',
  E'         or v_task2_foundation.provider_source_attribution_source_hash is distinct from\n           public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(v_provider_oid)))',
  E'         or (v_task2_foundation.provider_source_attribution_source_hash is distinct from\n           public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(v_provider_oid)))\n           and not public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact())',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()',
  E'      and receipt.canonical_snapshot_source_hash=public.hotel_v2_h3_2b_hash(\n        to_jsonb(pg_get_functiondef(\n          ''public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()''::regprocedure)))',
  E'      and (receipt.canonical_snapshot_source_hash=public.hotel_v2_h3_2b_hash(\n        to_jsonb(pg_get_functiondef(\n          ''public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()''::regprocedure)))\n        or public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact())',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()',
  E'      and receipt.validator_source_hash=public.hotel_v2_h3_2b_hash(to_jsonb(\n        pg_get_functiondef(\n          to_regprocedure(\n            ''public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()''))))',
  E'      and (receipt.validator_source_hash=public.hotel_v2_h3_2b_hash(to_jsonb(\n        pg_get_functiondef(\n          to_regprocedure(\n            ''public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()''))))\n        or public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact())',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()',
  E'           or v_task2_receipt.canonical_snapshot_source_hash is distinct from\n             public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(\n               ''public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()''::regprocedure)))',
  E'           or (v_task2_receipt.canonical_snapshot_source_hash is distinct from\n             public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(\n               ''public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()''::regprocedure)))\n             and not public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact())',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()',
  E'    and v_task2_stage2.canonical_snapshot_source_hash=\n      public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(\n        ''public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()''::regprocedure)))',
  E'    and (v_task2_stage2.canonical_snapshot_source_hash=\n      public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(\n        ''public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()''::regprocedure)))\n      or public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact())',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()',
  E'    and v_task2_stage2.validator_source_hash=\n      public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(\n        ''public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()''::regprocedure)))',
  E'    and (v_task2_stage2.validator_source_hash=\n      public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(\n        ''public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()''::regprocedure)))\n      or public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact())',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_admin_d_current_foundation_snapshot()',
  E'  v_stage2f_safe:=not exists(select 1 from public.site_settings setting\n      where setting.id=1 and setting.hotel_external_sync_enabled)\n    or exists(select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt\n      where receipt.id=1 and receipt.compatibility_function_fingerprints=\n        public.hotel_v2_external_calendar_activation_function_fingerprints());',
  E'  v_stage2f_safe:=not exists(select 1 from public.site_settings setting\n      where setting.id=1 and setting.hotel_external_sync_enabled)\n    or exists(select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt\n      where receipt.id=1 and receipt.compatibility_function_fingerprints=\n        jsonb_set(public.hotel_v2_external_calendar_activation_function_fingerprints(),\n          array[''public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)'']::text[],\n          receipt.compatibility_function_fingerprints->\n            ''public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)'',false)\n        and public.hotel_v2_partner_workspace_function_lineage_is_exact());',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_admin_d_current_foundation_snapshot()',
  '''e9df9093d67ff5039855a0435174416c2eaca71b67700d4806eb56466e9c4af5''',
  '''f432744ec7753928726b3a4d4c999183d6f1f394217aa35182f594cd05b39d49''',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_admin_d_current_foundation_snapshot()',
  E'    and exists(select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt\n      where receipt.id=1 and receipt.compatibility_function_fingerprints=\n        public.hotel_v2_external_calendar_activation_function_fingerprints());',
  E'    and exists(select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt\n      where receipt.id=1 and receipt.compatibility_function_fingerprints=\n        jsonb_set(public.hotel_v2_external_calendar_activation_function_fingerprints(),\n          array[''public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)'']::text[],\n          receipt.compatibility_function_fingerprints->\n            ''public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)'',false)\n        and public.hotel_v2_partner_workspace_function_lineage_is_exact())\n    and public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact();',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_admin_d_current_foundation_snapshot()',
  '''190b30e05c95e7220f800284b6408659f21172dba48161163e2a364c40aa95a5''',
  '''b7f42109b544714bd31083357f7eb0f531fa10e01919640736aba150c556a118''',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_admin_d_current_foundation_snapshot()',
  '    and v_evolution.current_protected_fingerprints is not distinct from v_current',
  E'    and public.hotel_v2_seven_arches_pricing_scoped_lineage() is not null\n    and public.hotel_v2_7a_pricing_activation_transaction_is_preserved()\n    and public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()\n    and public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact()\n    and public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()\n    and public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()\n    and public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact()\n    and public.hotel_v2_external_calendar_provider_sources_are_attributable()\n    and hotels_v2_private.hotel_external_calendar_provider_review_chain_is_exact()',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_admin_d_current_foundation_snapshot()',
  '    and v_evolution.stage2_current_protected_fingerprints is not distinct from v_stage2_current',
  E'    and public.hotel_v2_seven_arches_pricing_scoped_lineage() is not null\n    and public.hotel_v2_7a_pricing_activation_transaction_is_preserved()\n    and public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()\n    and public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact()\n    and public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()\n    and public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()\n    and public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact()\n    and public.hotel_v2_external_calendar_provider_sources_are_attributable()\n    and hotels_v2_private.hotel_external_calendar_provider_review_chain_is_exact()',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_admin_d_current_foundation_snapshot()',
  E'  return jsonb_build_object(\n    ''contract_version'',''hotels_v2_admin_d_current_foundation_v1'',',
  E'  v_target_foundation_safe:=v_target_foundation_safe or (\n    public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()\n    and public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact()\n    and public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()\n    and public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()\n    and public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact()\n    and public.hotel_v2_external_calendar_provider_sources_are_attributable()\n    and hotels_v2_private.hotel_external_calendar_provider_review_chain_is_exact());\n  return jsonb_build_object(\n    ''contract_version'',''hotels_v2_admin_d_current_foundation_v1'',',1);

select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_seven_arches_independent_pricing_activation_lineage()',
  E'''admin_d'',encode(extensions.digest(convert_to((select prosrc from pg_proc where oid=\n        ''public.hotel_v2_admin_d_current_foundation_snapshot()''::regprocedure),''UTF8''),''sha256''),''hex''),',
  E'''admin_d'',case when public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()\n        then ''2ed412e46a827c3b57b570f3c6675edc5d1a92562fb8acb59b7148b245ed592a''\n        else encode(extensions.digest(convert_to((select prosrc from pg_proc where oid=\n          ''public.hotel_v2_admin_d_current_foundation_snapshot()''::regprocedure),''UTF8''),''sha256''),''hex'') end,',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_seven_arches_independent_pricing_activation_lineage()',
  E'''canonical_projector'',encode(extensions.digest(convert_to((select prosrc from pg_proc where oid=\n        ''public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()''::regprocedure),\n        ''UTF8''),''sha256''),''hex''),',
  E'''canonical_projector'',case when public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()\n        then ''e42b5b7cabecd6e7ec7a847796983e497572f9f8fc0802f642fdc6b995d84ac3''\n        else encode(extensions.digest(convert_to((select prosrc from pg_proc where oid=\n          ''public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()''::regprocedure),\n          ''UTF8''),''sha256''),''hex'') end,',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_seven_arches_independent_pricing_activation_lineage()',
  E'''task2_validator'',encode(extensions.digest(convert_to((select prosrc from pg_proc where oid=\n        ''public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()''::regprocedure),\n        ''UTF8''),''sha256''),''hex''),',
  E'''task2_validator'',case when public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()\n        then ''0a6255e457f0912452949966e47e29a0ce0f6cda3e85c53b999343f9b68c3a95''\n        else encode(extensions.digest(convert_to((select prosrc from pg_proc where oid=\n          ''public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()''::regprocedure),\n          ''UTF8''),''sha256''),''hex'') end,',1);
-- Forward-evolve the Phase-1 topology validator at the exact provider
-- boundary.  The accepted 114415 body already validates current topology via
-- the reviewed-pricing chain; this adds exact zero/one provider cardinality
-- and permits the provider-adjusted activation-lineage representation only
-- through the lower, non-recursive provider lineage bridge.
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()',
  E'  v_lineage_normalized jsonb;\nbegin',
  E'  v_lineage_normalized jsonb;\n  v_provider_receipt_count integer:=0;\nbegin\n  if to_regclass(''hotels_v2_private.hotel_external_calendar_provider_evolution_receipts'')\n       is not null then\n    execute ''select count(*) from hotels_v2_private.''||\n      ''hotel_external_calendar_provider_evolution_receipts''\n      into v_provider_receipt_count;\n    if v_provider_receipt_count not in(0,1)\n       or (v_provider_receipt_count=1 and not\n         public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()) then\n      return false;\n    end if;\n  end if;',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()',
  E'  if public.hotel_v2_h3_2b_hash(v_lineage_normalized)\n       is distinct from v_phase1.historical_activation_lineage_fingerprint\n     or (select count(*)',
  E'  if v_provider_receipt_count=1 then\n    if v_lineage_normalized#>>''{lower_function_sources,provider_attribution}''\n         is distinct from\n         ''78cef0753a71a5bf7304f0a627fdf687b12998b80e84626d59d41884dc522d68'' then\n      return false;\n    end if;\n    v_lineage_normalized:=jsonb_set(v_lineage_normalized,\n      ''{lower_function_sources,provider_attribution}'',\n      to_jsonb(''6aee1bb6d02b999877d6384633dd9eab1e8d533917b24ab25e20c83973a0025f''::text),false);\n    v_lineage_normalized:=jsonb_set(v_lineage_normalized,\n      ''{lower_function_security}'',coalesce((select jsonb_agg(\n        case when entry.value->>''signature''=\n          ''public.hotel_v2_external_calendar_provider_sources_are_attributable()''\n        then jsonb_set(entry.value,''{source_hash}'',\n          to_jsonb(''6aee1bb6d02b999877d6384633dd9eab1e8d533917b24ab25e20c83973a0025f''::text),false)\n        else entry.value end order by entry.ordinality)\n        from jsonb_array_elements(v_lineage_normalized->''lower_function_security'')\n          with ordinality entry(value,ordinality)),''[]''::jsonb),false);\n  end if;\n  if public.hotel_v2_h3_2b_hash(v_lineage_normalized)\n       is distinct from v_phase1.historical_activation_lineage_fingerprint\n     or (select count(*)',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()',
  E'     or v_foundation.external_helper_source_hash is distinct from\n       encode(extensions.digest(convert_to((select procedure_row.prosrc\n         from pg_proc procedure_row where procedure_row.oid=\n           ''public.hotel_v2_external_calendar_protected_fingerprints()''::regprocedure),\n         ''UTF8''),''sha256''),''hex'')',
  E'     or (v_foundation.external_helper_source_hash is distinct from\n       encode(extensions.digest(convert_to((select procedure_row.prosrc\n         from pg_proc procedure_row where procedure_row.oid=\n           ''public.hotel_v2_external_calendar_protected_fingerprints()''::regprocedure),\n         ''UTF8''),''sha256''),''hex'')\n       and not public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact())',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()',
  E'     or v_foundation.catalog_fingerprint is distinct from\n       public.hotel_v2_seven_arches_reviewed_pricing_catalog_fingerprint()',
  E'     or (v_foundation.catalog_fingerprint is distinct from\n       public.hotel_v2_seven_arches_reviewed_pricing_catalog_fingerprint()\n       and not public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact())',1);
select hotels_v2_private.hotel_external_calendar_evolve_function(
  'public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()',
  E'     or v_foundation.topology_source_after_hash is distinct from\n       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(\n         ''public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()''::regprocedure)))',
  E'     or (v_foundation.topology_source_after_hash is distinct from\n       public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(\n         ''public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()''::regprocedure)))\n       and not public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact())',1);

-- Partner Apply is now submission-only.  It consumes the immutable Partner
-- review and, for set/rotate, stages the exact reviewed URL in a proposal-only
-- Vault entry.  It never mutates a live source, binding, job or day block.
create or replace function public.hotel_v2_partner_apply_external_calendar_plan(
  p_reviewed_plan jsonb,p_correlation_id uuid,p_idempotency_key uuid,
  p_ical_url text default null)
returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog,public,auth
as $function$
declare
  v_actor uuid:=auth.uid();
  v_review hotels_v2_private.hotel_external_calendar_plan_reviews%rowtype;
  v_proposal hotels_v2_private.hotel_external_calendar_partner_proposals%rowtype;
  v_control jsonb;
  v_operation jsonb;
  v_entity text;
  v_action text;
  v_source_id uuid;
  v_source_type text;
  v_room_type_id uuid;
  v_url_fingerprint text;
  v_request_hash text;
  v_proposal_id uuid:=gen_random_uuid();
  v_vault_secret_id uuid;
  v_submitted_at timestamptz:=clock_timestamp();
  v_receipt_result jsonb;
begin
  if v_actor is null or p_reviewed_plan is null
     or jsonb_typeof(p_reviewed_plan) is distinct from 'object'
     or p_correlation_id is null or p_idempotency_key is null
     or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(p_reviewed_plan)
     or jsonb_typeof(p_reviewed_plan->'operations') is distinct from 'array'
     or jsonb_array_length(p_reviewed_plan->'operations')<>1 then
    raise exception using errcode='22023',
      message='hotels_v2_external_calendar_invalid_partner_proposal_submit';
  end if;
  v_operation:=p_reviewed_plan#>'{operations,0}';
  v_entity:=v_operation->>'entity';
  v_action:=v_operation->>'action';
  v_source_id:=(v_operation->>'id')::uuid;
  v_url_fingerprint:=case when p_ical_url is null then null else
    encode(extensions.digest(convert_to(btrim(p_ical_url),'UTF8'),'sha256'),'hex') end;
  if (v_entity='ical_secret' and v_action in('set','rotate')) then
    if p_ical_url is null or length(btrim(p_ical_url)) not between 12 and 4096
       or btrim(p_ical_url)!~'^https://[^/?#[:space:][:cntrl:]@]+([/?#].*)?$' then
      raise exception using errcode='22023',
        message='hotels_v2_external_calendar_provider_invalid_staged_url';
    end if;
    if v_url_fingerprint is distinct from
        v_operation#>>'{payload,url_fingerprint}' then
      raise exception using errcode='PT409',
        message='hotels_v2_external_calendar_secret_hash_mismatch';
    end if;
  elsif p_ical_url is not null then
    raise exception using errcode='22023',
      message='hotels_v2_external_calendar_provider_unexpected_staged_url';
  end if;
  v_request_hash:=public.hotel_v2_external_calendar_worker_hash(jsonb_build_object(
    'reviewed_plan',p_reviewed_plan,'url_fingerprint',v_url_fingerprint));
  perform pg_advisory_xact_lock(hashtextextended(
    'hotels-v2-external-calendar-provider-submit:'||v_actor::text||':'||
      p_idempotency_key::text,0));
  perform pg_advisory_xact_lock(hashtextextended(
    'hotels-v2-external-calendar-provider-correlation:'||p_correlation_id::text,0));
  select * into v_proposal
  from hotels_v2_private.hotel_external_calendar_partner_proposals proposal
  where proposal.actor_id=v_actor
    and proposal.submission_idempotency_key=p_idempotency_key;
  if found then
    if v_proposal.submission_correlation_id is distinct from p_correlation_id
       or v_proposal.submission_request_hash is distinct from v_request_hash then
      raise exception using errcode='PT409',
        message='hotels_v2_external_calendar_provider_proposal_idempotency_conflict';
    end if;
    v_control:=public.hotel_v2_external_calendar_control_common(
      'partner',v_proposal.partner_id,v_proposal.hotel_id);
    return jsonb_build_object(
      'contract_version','hotels_v2_external_calendar_partner_proposal_submit_v1',
      'proposal',jsonb_set(
        hotels_v2_private.hotel_external_calendar_provider_proposal_summary(
          v_proposal.id),'{reviewed_by}','null'::jsonb,false),
      'replayed',true,'control',v_control);
  end if;
  if exists(select 1
      from hotels_v2_private.hotel_external_calendar_partner_proposals proposal
      where proposal.submission_correlation_id=p_correlation_id)
     or exists(select 1
       from hotels_v2_private.hotel_external_calendar_correlations correlation
       where correlation.correlation_id=p_correlation_id)
     or exists(select 1 from public.hotel_activity_log activity
       where activity.correlation_id=p_correlation_id)
     or exists(select 1 from public.hotel_partner_action_receipts receipt
       where receipt.correlation_id=p_correlation_id) then
    raise exception using errcode='PT409',
      message='hotels_v2_external_calendar_provider_proposal_correlation_conflict';
  end if;
  select * into v_review
  from hotels_v2_private.hotel_external_calendar_plan_reviews review
  where review.id=(p_reviewed_plan->>'review_id')::uuid
  for update;
  if not found or v_review.actor_type<>'partner' or v_review.actor_id<>v_actor
     or v_review.reviewed_plan is distinct from p_reviewed_plan
     or v_review.plan_fingerprint is distinct from
       public.hotel_v2_external_calendar_worker_hash(
         p_reviewed_plan-'plan_fingerprint')
     or v_review.plan_fingerprint is distinct from
       p_reviewed_plan->>'plan_fingerprint'
     or v_review.expires_at<=v_submitted_at or v_review.consumed_at is not null then
    raise exception using errcode='PT409',
      message='hotels_v2_external_calendar_review_stale';
  end if;
  v_control:=public.hotel_v2_external_calendar_control_common(
    'partner',v_review.partner_id,v_review.hotel_id);
  if v_control->>'snapshot_token' is distinct from v_review.snapshot_token
     or v_control->>'access_snapshot_token' is distinct from
       v_review.access_snapshot_token
     or (v_control->>'permission_version')::bigint is distinct from
       v_review.permission_version
     or not exists(select 1
       from public.hotel_partner_hotel_permissions permission
       where permission.assignment_id=v_review.assignment_id
         and permission.partner_id=v_review.partner_id
         and permission.hotel_id=v_review.hotel_id
         and permission.version=v_review.permission_version
         and permission.manage_availability) then
    raise exception using errcode='PT409',
      message='hotels_v2_external_calendar_provider_proposal_stale';
  end if;
  if v_entity='calendar_source' and v_action in('create','update') then
    v_source_type:=v_operation#>>'{payload,source_type}';
    v_room_type_id:=(v_operation#>>'{payload,room_type_id}')::uuid;
  else
    select source.source_type,source.room_type_id
      into v_source_type,v_room_type_id
    from public.hotel_calendar_source_configs source
    where source.id=v_source_id and source.hotel_id=v_review.hotel_id;
  end if;
  if v_source_id is null or v_source_type is null or v_room_type_id is null
     or not public.hotel_v2_external_calendar_ics_source_type_is_supported(
       v_source_type)
     or not exists(select 1 from public.hotel_room_types room
       where room.id=v_room_type_id and room.hotel_id=v_review.hotel_id
         and room.status='active') then
    raise exception using errcode='PT409',
      message='hotels_v2_external_calendar_provider_proposal_stale';
  end if;
  if v_entity='ical_secret' and v_action in('set','rotate') then
    select vault.create_secret(
      btrim(p_ical_url),'hotel-calendar-proposal-'||v_proposal_id::text,
      'Hotels V2 reviewed calendar proposal '||v_proposal_id::text,null)
      into v_vault_secret_id;
    if v_vault_secret_id is null
       or (select count(*) from vault.decrypted_secrets secret
         where secret.id=v_vault_secret_id
           and secret.name='hotel-calendar-proposal-'||v_proposal_id::text
           and encode(extensions.digest(convert_to(secret.decrypted_secret,'UTF8'),
             'sha256'),'hex')=v_url_fingerprint)<>1 then
      raise exception using errcode='55000',
        message='hotels_v2_external_calendar_provider_staged_secret_mismatch';
    end if;
  end if;
  insert into hotels_v2_private.hotel_external_calendar_partner_proposals(
    id,partner_review_id,actor_id,partner_id,assignment_id,hotel_id,
    permission_version,access_snapshot_token,snapshot_token,entity,action,
    source_id,source_type,room_type_id,reason,reviewed_plan,operation,
    plan_fingerprint,vault_secret_id,url_fingerprint,
    submission_correlation_id,submission_idempotency_key,
    submission_request_hash,submitted_at,expires_at)
  values(v_proposal_id,v_review.id,v_actor,v_review.partner_id,
    v_review.assignment_id,v_review.hotel_id,v_review.permission_version,
    v_review.access_snapshot_token,v_review.snapshot_token,v_entity,v_action,
    v_source_id,v_source_type,v_room_type_id,v_operation->>'reason',
    p_reviewed_plan,v_operation,v_review.plan_fingerprint,v_vault_secret_id,
    case when v_vault_secret_id is null then null else v_url_fingerprint end,
    p_correlation_id,p_idempotency_key,v_request_hash,v_submitted_at,
    v_review.expires_at);
  update hotels_v2_private.hotel_external_calendar_plan_reviews set
    consumed_at=v_submitted_at,consumed_correlation_id=p_correlation_id
  where id=v_review.id;
  v_receipt_result:=jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_partner_proposal_receipt_v1',
    'proposal_id',v_proposal_id,'hotel_id',v_review.hotel_id,
    'partner_id',v_review.partner_id,'correlation_id',p_correlation_id,
    'idempotency_key',p_idempotency_key,'request_hash',v_request_hash,
    'status','pending_admin_review');
  insert into public.hotel_partner_action_receipts(
    partner_id,hotel_id,actor_user_id,action,idempotency_key,request_hash,
    correlation_id,result)
  values(v_review.partner_id,v_review.hotel_id,v_actor,
    'h3_2d_external_calendar_provider_proposal',p_idempotency_key,
    v_request_hash,p_correlation_id,v_receipt_result);
  v_control:=public.hotel_v2_external_calendar_control_common(
    'partner',v_review.partner_id,v_review.hotel_id);
  return jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_partner_proposal_submit_v1',
    'proposal',jsonb_set(
      hotels_v2_private.hotel_external_calendar_provider_proposal_summary(
        v_proposal_id),'{reviewed_by}','null'::jsonb,false),
    'replayed',false,'control',v_control);
exception when unique_violation then
  raise exception using errcode='PT409',
    message='hotels_v2_external_calendar_provider_proposal_conflict';
end
$function$;

create function public.hotel_v2_admin_get_external_calendar_provider_reviews(
  p_hotel_id uuid)
returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog,public,auth
as $function$
declare
  v_actor uuid:=auth.uid();
  v_proposals jsonb;
begin
  perform public.hotel_v2_h2a_require_admin();
  if v_actor is null or p_hotel_id is null then
    raise exception using errcode='22023',
      message='hotels_v2_external_calendar_provider_invalid_review_list';
  end if;
  perform public.hotel_v2_external_calendar_control_common('admin',null,p_hotel_id);
  perform hotels_v2_private.hotel_external_calendar_provider_expire_pending(
    p_hotel_id,v_actor);
  select coalesce(jsonb_agg(
      hotels_v2_private.hotel_external_calendar_provider_proposal_summary(
        candidate.id) order by candidate.submitted_at desc,candidate.id),
      '[]'::jsonb)
    into v_proposals
  from (select proposal.id,proposal.submitted_at
    from hotels_v2_private.hotel_external_calendar_partner_proposals proposal
    where proposal.hotel_id=p_hotel_id
    order by proposal.submitted_at desc,proposal.id limit 100) candidate;
  return jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_provider_review_list_v1',
    'hotel_id',p_hotel_id,'proposals',v_proposals);
end
$function$;

create function public.hotel_v2_admin_preview_external_calendar_partner_proposal(
  p_proposal_id uuid,p_admin_reason text)
returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog,public,auth
as $function$
declare
  v_actor uuid:=auth.uid();
  v_proposal hotels_v2_private.hotel_external_calendar_partner_proposals%rowtype;
  v_control jsonb;
  v_draft jsonb;
  v_payload jsonb;
  v_preview jsonb;
  v_admin_plan jsonb;
  v_url text;
begin
  perform public.hotel_v2_h2a_require_admin();
  if v_actor is null or p_proposal_id is null
     or not public.hotel_v2_external_calendar_reason_valid(to_jsonb(p_admin_reason)) then
    raise exception using errcode='22023',
      message='hotels_v2_external_calendar_provider_invalid_admin_reason';
  end if;
  select * into v_proposal
  from hotels_v2_private.hotel_external_calendar_partner_proposals proposal
  where proposal.id=p_proposal_id for update;
  if not found then
    raise exception using errcode='PT404',
      message='hotels_v2_external_calendar_provider_proposal_not_found';
  end if;
  if v_proposal.status<>'pending_admin_review'
     or v_proposal.expires_at<=clock_timestamp()
     or not exists(select 1
       from public.hotel_partner_hotel_permissions permission
       where permission.assignment_id=v_proposal.assignment_id
         and permission.partner_id=v_proposal.partner_id
         and permission.hotel_id=v_proposal.hotel_id
         and permission.version=v_proposal.permission_version
         and permission.manage_availability) then
    raise exception using errcode='PT409',
      message='hotels_v2_external_calendar_provider_proposal_stale';
  end if;
  v_control:=public.hotel_v2_external_calendar_control_common(
    'admin',null,v_proposal.hotel_id);
  if v_control->>'snapshot_token' is distinct from v_proposal.snapshot_token then
    raise exception using errcode='PT409',
      message='hotels_v2_external_calendar_provider_proposal_stale';
  end if;
  v_payload:=v_proposal.operation->'payload';
  if v_proposal.entity='ical_secret'
     and v_proposal.action in('set','rotate') then
    select secret.decrypted_secret into v_url
    from vault.decrypted_secrets secret
    where secret.id=v_proposal.vault_secret_id
      and secret.name='hotel-calendar-proposal-'||v_proposal.id::text;
    if not found or encode(extensions.digest(convert_to(v_url,'UTF8'),'sha256'),
         'hex') is distinct from v_proposal.url_fingerprint then
      raise exception using errcode='55000',
        message='hotels_v2_external_calendar_provider_staged_secret_mismatch';
    end if;
    v_payload:=jsonb_build_object(
      'source_id',v_proposal.source_id,'ical_url',v_url);
  end if;
  v_draft:=jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_draft_v1',
    'hotel_id',v_proposal.hotel_id,'partner_id',null,'assignment_id',null,
    'permission_version',null,'access_snapshot_token',null,
    'snapshot_token',v_control->>'snapshot_token',
    'intent',jsonb_build_object(
      'entity',v_proposal.entity,'action',v_proposal.action,
      'id',v_proposal.source_id,
      'expected_version',v_proposal.operation->'expected_version',
      'payload',v_payload,'reason',p_admin_reason));
  perform set_config('hotels_v2.external_calendar_provider_proposal_id',
    v_proposal.id::text,true);
  v_preview:=public.hotel_v2_external_calendar_preview_common('admin',v_draft);
  perform set_config('hotels_v2.external_calendar_provider_proposal_id','',true);
  v_url:=null;
  v_admin_plan:=v_preview->'reviewed_plan';
  if v_preview->>'changed'<>'true' or v_admin_plan is null
     or v_admin_plan->>'actor_type'<>'admin'
     or v_admin_plan->'partner_id'<>'null'::jsonb
     or v_admin_plan->'assignment_id'<>'null'::jsonb
     or v_admin_plan->'permission_version'<>'null'::jsonb
     or v_admin_plan->'access_snapshot_token'<>'null'::jsonb
     or ((v_admin_plan#>'{operations,0}')-'reason') is distinct from
       (v_proposal.operation-'reason')
     or v_admin_plan#>>'{operations,0,reason}' is distinct from p_admin_reason then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_provider_admin_preview_mismatch';
  end if;
  insert into hotels_v2_private.hotel_external_calendar_provider_admin_previews(
    admin_review_id,proposal_id,actor_id,partner_plan_fingerprint,
    admin_plan_fingerprint,admin_reason,created_at,expires_at)
  values((v_admin_plan->>'review_id')::uuid,v_proposal.id,v_actor,
    v_proposal.plan_fingerprint,v_admin_plan->>'plan_fingerprint',p_admin_reason,
    (v_admin_plan->>'reviewed_at')::timestamptz,
    (v_admin_plan->>'expires_at')::timestamptz);
  return jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_provider_admin_preview_v1',
    'proposal',hotels_v2_private.hotel_external_calendar_provider_proposal_summary(
      v_proposal.id),'preview',v_preview);
end
$function$;

create function public.hotel_v2_admin_apply_external_calendar_partner_proposal(
  p_proposal_id uuid,p_reviewed_plan jsonb,p_correlation_id uuid,
  p_idempotency_key uuid,p_admin_reason text)
returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog,public,auth
as $function$
declare
  v_actor uuid:=auth.uid();
  v_proposal hotels_v2_private.hotel_external_calendar_partner_proposals%rowtype;
  v_preview hotels_v2_private.hotel_external_calendar_provider_admin_previews%rowtype;
  v_request_hash text;
  v_url text;
  v_apply jsonb;
  v_record jsonb;
begin
  perform public.hotel_v2_h2a_require_admin();
  if v_actor is null or p_proposal_id is null or p_reviewed_plan is null
     or jsonb_typeof(p_reviewed_plan) is distinct from 'object'
     or p_correlation_id is null or p_idempotency_key is null
     or not public.hotel_v2_external_calendar_reason_valid(to_jsonb(p_admin_reason))
     or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(p_reviewed_plan) then
    raise exception using errcode='22023',
      message='hotels_v2_external_calendar_provider_invalid_admin_apply';
  end if;
  v_request_hash:=public.hotel_v2_external_calendar_worker_hash(jsonb_build_object(
    'proposal_id',p_proposal_id,'reviewed_plan',p_reviewed_plan,
    'decision','accepted','admin_reason',p_admin_reason));
  perform pg_advisory_xact_lock(hashtextextended(
    'hotels-v2-external-calendar-provider-admin:'||v_actor::text||':'||
      p_idempotency_key::text,0));
  perform pg_advisory_xact_lock(hashtextextended(
    'hotels-v2-external-calendar-provider-correlation:'||p_correlation_id::text,0));
  select * into v_proposal
  from hotels_v2_private.hotel_external_calendar_partner_proposals proposal
  where proposal.id=p_proposal_id for update;
  if not found then
    raise exception using errcode='PT404',
      message='hotels_v2_external_calendar_provider_proposal_not_found';
  end if;
  if v_proposal.status<>'pending_admin_review' then
    if v_proposal.status='accepted'
       and v_proposal.reviewed_by=v_actor
       and v_proposal.consumed_correlation_id=p_correlation_id
       and v_proposal.consumed_idempotency_key=p_idempotency_key
       and v_proposal.result->>'request_hash'=v_request_hash then
      return jsonb_build_object(
        'contract_version','hotels_v2_external_calendar_provider_admin_apply_v1',
        'proposal',hotels_v2_private.hotel_external_calendar_provider_proposal_summary(
          v_proposal.id),'apply',v_proposal.result->'apply','replayed',true);
    end if;
    raise exception using errcode='PT409',
      message='hotels_v2_external_calendar_provider_proposal_decision_conflict';
  end if;
  if v_proposal.expires_at<=clock_timestamp()
     or not exists(select 1
       from public.hotel_partner_hotel_permissions permission
       where permission.assignment_id=v_proposal.assignment_id
         and permission.partner_id=v_proposal.partner_id
         and permission.hotel_id=v_proposal.hotel_id
         and permission.version=v_proposal.permission_version
         and permission.manage_availability) then
    raise exception using errcode='PT409',
      message='hotels_v2_external_calendar_provider_proposal_stale';
  end if;
  select * into v_preview
  from hotels_v2_private.hotel_external_calendar_provider_admin_previews preview
  where preview.admin_review_id=(p_reviewed_plan->>'review_id')::uuid
    and preview.proposal_id=v_proposal.id
    and preview.actor_id=v_actor;
  if not found or v_preview.expires_at<=clock_timestamp()
     or v_preview.partner_plan_fingerprint<>v_proposal.plan_fingerprint
     or v_preview.admin_plan_fingerprint<>p_reviewed_plan->>'plan_fingerprint'
     or v_preview.admin_reason<>p_admin_reason
     or public.hotel_v2_external_calendar_worker_hash(
       p_reviewed_plan-'plan_fingerprint')<>v_preview.admin_plan_fingerprint
     or p_reviewed_plan->>'actor_type'<>'admin'
     or ((p_reviewed_plan#>'{operations,0}')-'reason') is distinct from
       (v_proposal.operation-'reason')
     or p_reviewed_plan#>>'{operations,0,reason}'<>p_admin_reason then
    raise exception using errcode='PT409',
      message='hotels_v2_external_calendar_provider_admin_review_mismatch';
  end if;
  if v_proposal.vault_secret_id is not null then
    select secret.decrypted_secret into v_url
    from vault.decrypted_secrets secret
    where secret.id=v_proposal.vault_secret_id
      and secret.name='hotel-calendar-proposal-'||v_proposal.id::text;
    if not found or encode(extensions.digest(convert_to(v_url,'UTF8'),'sha256'),
         'hex') is distinct from v_proposal.url_fingerprint then
      raise exception using errcode='55000',
        message='hotels_v2_external_calendar_provider_staged_secret_mismatch';
    end if;
  end if;
  if v_proposal.vault_secret_id is not null then
    perform set_config('hotels_v2.external_calendar_provider_proposal_id',
      v_proposal.id::text,true);
    perform set_config('hotels_v2.external_calendar_provider_staged_secret_id',
      v_proposal.vault_secret_id::text,true);
  end if;
  v_apply:=public.hotel_v2_external_calendar_apply_common(
    'admin',p_reviewed_plan,p_correlation_id,p_idempotency_key,v_url);
  perform set_config('hotels_v2.external_calendar_provider_proposal_id','',true);
  perform set_config('hotels_v2.external_calendar_provider_staged_secret_id','',true);
  v_url:=null;
  if v_proposal.vault_secret_id is not null then
    if (select count(*)
      from hotels_v2_private.hotel_external_calendar_source_secrets binding
      join vault.secrets secret on secret.id=binding.vault_secret_id
      where binding.source_id=v_proposal.source_id
        and binding.vault_secret_id=v_proposal.vault_secret_id
        and binding.url_fingerprint=v_proposal.url_fingerprint
        and binding.version=(v_proposal.operation->>'expected_version')::bigint+1
        and secret.name='hotel-calendar-source-'||v_proposal.source_id::text||'-'||
          v_proposal.vault_secret_id::text)<>1 then
      raise exception using errcode='55000',
        message='hotels_v2_external_calendar_provider_secret_promotion_mismatch';
    end if;
  end if;
  v_record:=jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_provider_decision_record_v1',
    'proposal_id',v_proposal.id,'decision','accepted','expired',false,
    'request_hash',v_request_hash,'url_fingerprint',v_proposal.url_fingerprint,
    'apply',v_apply);
  update hotels_v2_private.hotel_external_calendar_partner_proposals set
    status='accepted',reviewed_at=clock_timestamp(),reviewed_by=v_actor,
    admin_reason=p_admin_reason,consumed_correlation_id=p_correlation_id,
    consumed_idempotency_key=p_idempotency_key,result=v_record,
    vault_secret_id=null,url_fingerprint=null
  where id=v_proposal.id;
  perform hotels_v2_private.hotel_external_calendar_provider_write_review_receipt(
    v_proposal.id,'accepted',v_actor,p_correlation_id,p_idempotency_key,
    v_record,p_admin_reason);
  return jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_provider_admin_apply_v1',
    'proposal',hotels_v2_private.hotel_external_calendar_provider_proposal_summary(
      v_proposal.id),'apply',v_apply,'replayed',false);
exception when unique_violation then
  raise exception using errcode='PT409',
    message='hotels_v2_external_calendar_provider_admin_apply_conflict';
end
$function$;

create function public.hotel_v2_admin_reject_external_calendar_partner_proposal(
  p_proposal_id uuid,p_admin_reason text,p_correlation_id uuid,
  p_idempotency_key uuid)
returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog,public,auth
as $function$
declare
  v_actor uuid:=auth.uid();
  v_proposal hotels_v2_private.hotel_external_calendar_partner_proposals%rowtype;
  v_request_hash text;
  v_record jsonb;
begin
  perform public.hotel_v2_h2a_require_admin();
  if v_actor is null or p_proposal_id is null or p_correlation_id is null
     or p_idempotency_key is null
     or not public.hotel_v2_external_calendar_reason_valid(to_jsonb(p_admin_reason)) then
    raise exception using errcode='22023',
      message='hotels_v2_external_calendar_provider_invalid_admin_reject';
  end if;
  v_request_hash:=public.hotel_v2_external_calendar_worker_hash(jsonb_build_object(
    'proposal_id',p_proposal_id,'decision','rejected',
    'admin_reason',p_admin_reason));
  perform pg_advisory_xact_lock(hashtextextended(
    'hotels-v2-external-calendar-provider-admin:'||v_actor::text||':'||
      p_idempotency_key::text,0));
  perform pg_advisory_xact_lock(hashtextextended(
    'hotels-v2-external-calendar-provider-correlation:'||p_correlation_id::text,0));
  select * into v_proposal
  from hotels_v2_private.hotel_external_calendar_partner_proposals proposal
  where proposal.id=p_proposal_id for update;
  if not found then
    raise exception using errcode='PT404',
      message='hotels_v2_external_calendar_provider_proposal_not_found';
  end if;
  if v_proposal.status<>'pending_admin_review' then
    if v_proposal.status='rejected'
       and v_proposal.reviewed_by=v_actor
       and v_proposal.consumed_correlation_id=p_correlation_id
       and v_proposal.consumed_idempotency_key=p_idempotency_key
       and v_proposal.result->>'request_hash'=v_request_hash then
      return jsonb_build_object(
        'contract_version','hotels_v2_external_calendar_provider_admin_apply_v1',
        'proposal',hotels_v2_private.hotel_external_calendar_provider_proposal_summary(
          v_proposal.id),'apply',null,'replayed',true);
    end if;
    raise exception using errcode='PT409',
      message='hotels_v2_external_calendar_provider_proposal_decision_conflict';
  end if;
  if exists(select 1
      from hotels_v2_private.hotel_external_calendar_provider_review_receipts receipt
      where receipt.correlation_id=p_correlation_id
         or (receipt.actor_id=v_actor and receipt.idempotency_key=p_idempotency_key))
     or exists(select 1
       from hotels_v2_private.hotel_external_calendar_correlations correlation
       where correlation.correlation_id=p_correlation_id)
     or exists(select 1 from public.hotel_activity_log activity
       where activity.correlation_id=p_correlation_id)
     or exists(select 1 from public.hotel_partner_action_receipts receipt
       where receipt.correlation_id=p_correlation_id) then
    raise exception using errcode='PT409',
      message='hotels_v2_external_calendar_provider_proposal_correlation_conflict';
  end if;
  if v_proposal.vault_secret_id is not null then
    delete from vault.secrets secret
    where secret.id=v_proposal.vault_secret_id
      and secret.name='hotel-calendar-proposal-'||v_proposal.id::text;
    if not found then
      raise exception using errcode='55000',
        message='hotels_v2_external_calendar_provider_staged_secret_missing';
    end if;
  end if;
  v_record:=jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_provider_decision_record_v1',
    'proposal_id',v_proposal.id,'decision','rejected','expired',false,
    'request_hash',v_request_hash,'url_fingerprint',v_proposal.url_fingerprint,
    'apply',null);
  update hotels_v2_private.hotel_external_calendar_partner_proposals set
    status='rejected',reviewed_at=clock_timestamp(),reviewed_by=v_actor,
    admin_reason=p_admin_reason,consumed_correlation_id=p_correlation_id,
    consumed_idempotency_key=p_idempotency_key,result=v_record,
    vault_secret_id=null,url_fingerprint=null
  where id=v_proposal.id;
  perform hotels_v2_private.hotel_external_calendar_provider_write_review_receipt(
    v_proposal.id,'rejected',v_actor,p_correlation_id,p_idempotency_key,
    v_record,p_admin_reason);
  return jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_provider_admin_apply_v1',
    'proposal',hotels_v2_private.hotel_external_calendar_provider_proposal_summary(
      v_proposal.id),'apply',null,'replayed',false);
exception when unique_violation then
  raise exception using errcode='PT409',
    message='hotels_v2_external_calendar_provider_admin_reject_conflict';
end
$function$;

-- Finalize the exact evolved function/catalog layer before asking any
-- provider-aware protected projector to traverse ADMIN-D.  The bridge is
-- deliberately false until these three fields bind the live AFTER state.
update hotels_v2_private.hotel_external_calendar_provider_evolution_receipts set
  evolved_function_fingerprints=
    hotels_v2_private.hotel_external_calendar_provider_function_fingerprints(),
  evolved_function_source_hashes=
    hotels_v2_private.hotel_external_calendar_provider_function_source_hashes(),
  evolved_reviewed_pricing_catalog_fingerprint=
    public.hotel_v2_seven_arches_reviewed_pricing_catalog_fingerprint()
where id=1;
alter table hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
  alter column evolved_function_fingerprints set not null,
  alter column evolved_function_source_hashes set not null,
  alter column evolved_reviewed_pricing_catalog_fingerprint set not null;

create function public.hotel_v2_external_calendar_provider_protected_fingerprints()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public
as $function$
declare v_provider
    hotels_v2_private.hotel_external_calendar_provider_evolution_receipts%rowtype;
  v_site_settings_fingerprint text;
  v_pricing_scoped_lineage jsonb;
  v_pricing_scoped_lineage_source_hash text;
  v_transaction_preservation_source_hash text;
begin
  v_site_settings_fingerprint:=
    public.hotel_v2_external_calendar_site_settings_fingerprint();
  v_pricing_scoped_lineage:=
    public.hotel_v2_seven_arches_pricing_scoped_lineage();
  select encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),
    'sha256'),'hex') into v_pricing_scoped_lineage_source_hash
  from pg_proc procedure_row where procedure_row.oid=
    'public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure;
  select encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),
    'sha256'),'hex') into v_transaction_preservation_source_hash
  from pg_proc procedure_row where procedure_row.oid=
    'public.hotel_v2_7a_pricing_activation_transaction_is_preserved()'::regprocedure;
  if v_site_settings_fingerprint is null
     or jsonb_typeof(v_pricing_scoped_lineage)<>'object'
     or v_pricing_scoped_lineage->>'contract_version'<>
       'hotels_v2_seven_arches_pricing_scoped_lineage_v1'
     or (select count(*)
       from hotels_v2_private.hotel_external_calendar_provider_evolution_receipts)<>1 then
    return null;
  end if;
  select * into strict v_provider
  from hotels_v2_private.hotel_external_calendar_provider_evolution_receipts receipt
  where receipt.id=1;
  if v_provider.contract_version<>
       'hotels_v2_external_calendar_provider_evolution_v1'
     or v_provider.prior_compatible_fingerprint is distinct from
       public.hotel_v2_external_calendar_worker_hash(
         v_provider.prior_compatible_fingerprints)
     or v_provider.original_foundation_fingerprint is distinct from
       (select foundation.protected_fingerprint
        from hotels_v2_private.hotel_external_calendar_foundation_receipts foundation
        where foundation.id=1)
     or v_provider.historical_property_map_fingerprint is distinct from
       (select property.protected_fingerprint
        from public.hotel_partner_property_proposal_foundation_receipts property
        where property.id=1)
     or v_provider.historical_stage2_map_fingerprint is distinct from
       (select owner_receipt.stage2_current_protected_fingerprint
        from public.hotel_admin_availability_foundation_evolution_receipts owner_receipt
        where owner_receipt.id=1)
     or v_provider.canonical_site_settings_lifecycle_fingerprint
       is distinct from v_site_settings_fingerprint
     or v_provider.pricing_scoped_lineage_helper_source_hash
       is distinct from v_pricing_scoped_lineage_source_hash
     or v_provider.pricing_transaction_preservation_source_hash
       is distinct from v_transaction_preservation_source_hash
     or v_provider.pricing_scoped_lineage_at_install_fingerprint
       is distinct from public.hotel_v2_external_calendar_worker_hash(
         v_provider.pricing_scoped_lineage_at_install)
     or not public.hotel_v2_7a_pricing_activation_transaction_is_preserved()
     or not public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact()
     or not public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()
     or not public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()
     or not public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact()
     or not public.hotel_v2_external_calendar_provider_sources_are_attributable()
     or not hotels_v2_private.hotel_external_calendar_provider_review_chain_is_exact() then
    return null;
  end if;
  -- This is the long-lived provider projection.  It contains only immutable
  -- foundation evidence, critical 7 Arches identities/policies, the canonical
  -- Hotels lifecycle, and boolean proofs for legitimately evolving pricing,
  -- booking, and provider ledgers.  Broad operational rows remain protected by
  -- the immutable transaction-preservation receipt, not frozen here.
  return jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_provider_protected_v2',
    'hotel_id',v_pricing_scoped_lineage->'hotel_id',
    'partner_id',v_pricing_scoped_lineage->'partner_id',
    'assignment_id',v_pricing_scoped_lineage->'assignment_id',
    'owner_user_ids',v_pricing_scoped_lineage->'owner_user_ids',
    'owner_membership_fingerprint',
      v_pricing_scoped_lineage->'owner_membership_fingerprint',
    'permission_preset_fingerprint',
      v_pricing_scoped_lineage->'permission_preset_fingerprint',
    'room_identity_fingerprint',
      v_pricing_scoped_lineage->'room_identity_fingerprint',
    'allocation_contract_exact',true,
    'commission_policy_fingerprint',
      v_pricing_scoped_lineage->'commission_policy_fingerprint',
    'payment_policy_fingerprint',
      v_pricing_scoped_lineage->'payment_policy_fingerprint',
    'site_settings',v_site_settings_fingerprint,
    'owner_capability_receipt_fingerprint',
      v_pricing_scoped_lineage->'owner_capability_receipt_fingerprint',
    'property_foundation_receipt_fingerprint',
      v_pricing_scoped_lineage->'property_foundation_receipt_fingerprint',
    'lower_function_security_fingerprint',
      v_pricing_scoped_lineage->'lower_function_security_fingerprint',
    'historical_external_foundation_fingerprint',
      v_provider.original_foundation_fingerprint,
    'historical_property_map_fingerprint',
      v_provider.historical_property_map_fingerprint,
    'historical_stage2_map_fingerprint',
      v_provider.historical_stage2_map_fingerprint,
    'supported_provider_types',jsonb_build_array('airbnb','booking_com','ical'),
    'transaction_preservation_exact',true,
    'property_lineage_exact',true,
    'pricing_topology_exact',true,
    'reviewed_pricing_chain_exact',true,
    'public_booking_chain_exact',true,
    'provider_source_attribution_exact',true,
    'provider_review_chain_exact',true);
exception when no_data_found or too_many_rows or undefined_function
  or undefined_table or invalid_schema_name then
  return null;
end
$function$;

create function hotels_v2_private.hotel_external_calendar_provider_helper_fingerprints()
returns jsonb language sql stable security definer set search_path=pg_catalog,public
as $function$
select jsonb_object_agg(signature,public.hotel_v2_external_calendar_worker_hash(
  to_jsonb(pg_get_functiondef(signature::regprocedure))) order by signature)
from unnest(array[
  'public.hotel_v2_external_calendar_ics_source_type_is_supported(text)',
  'public.hotel_v2_external_calendar_provider_sources_are_attributable()',
  'public.hotel_v2_external_calendar_stage2_compatible_fingerprints()',
  'public.hotel_v2_external_calendar_provider_protected_fingerprints()',
  'public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()',
  'hotels_v2_private.hotel_external_calendar_provider_function_source_hashes()',
  'hotels_v2_private.hotel_external_calendar_provider_proposal_summary(uuid)',
  'hotels_v2_private.hotel_external_calendar_provider_proposal_guard()',
  'hotels_v2_private.hotel_external_calendar_provider_worker_scheduler_is_ready()',
  'hotels_v2_private.hotel_external_calendar_provider_write_review_receipt(uuid,text,uuid,uuid,uuid,jsonb,text)',
  'hotels_v2_private.hotel_external_calendar_provider_review_chain_is_exact()',
  'hotels_v2_private.hotel_external_calendar_provider_expire_pending(uuid,uuid)',
  'public.hotel_v2_admin_get_external_calendar_provider_reviews(uuid)',
  'public.hotel_v2_admin_preview_external_calendar_partner_proposal(uuid,text)',
  'public.hotel_v2_admin_apply_external_calendar_partner_proposal(uuid,jsonb,uuid,uuid,text)',
  'public.hotel_v2_admin_reject_external_calendar_partner_proposal(uuid,text,uuid,uuid)'
]) signature
$function$;

-- Materialize the protected projection once while the receipt is still
-- unambiguously in its installation phase, before any dependent evidence field
-- changes the bridge from its strict in-flight branch to fail-closed.
do $capture_provider_protected$
declare
  v_protected jsonb;
begin
  v_protected:=public.hotel_v2_external_calendar_provider_protected_fingerprints();
  if v_protected is null then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_provider_protected_capture_failed';
  end if;
  update hotels_v2_private.hotel_external_calendar_provider_evolution_receipts receipt set
    evolved_protected_fingerprints=v_protected,
    evolved_protected_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(v_protected)
  where receipt.id=1;
end
$capture_provider_protected$;

update hotels_v2_private.hotel_external_calendar_provider_evolution_receipts receipt set
  evolution_helper_fingerprints=
    hotels_v2_private.hotel_external_calendar_provider_helper_fingerprints(),
  fingerprint_helper_source_hashes=jsonb_build_object(
    'provider_function_fingerprints',public.hotel_v2_external_calendar_worker_hash(to_jsonb(
      pg_get_functiondef('hotels_v2_private.hotel_external_calendar_provider_function_fingerprints()'::regprocedure))),
    'provider_helper_fingerprints',public.hotel_v2_external_calendar_worker_hash(to_jsonb(
      pg_get_functiondef('hotels_v2_private.hotel_external_calendar_provider_helper_fingerprints()'::regprocedure))),
    'historical_raw_site_settings_helper',encode(extensions.digest(convert_to((select
      procedure_row.prosrc from pg_proc procedure_row where procedure_row.oid=
        'public.hotel_v2_h3_2b_protected_fingerprints()'::regprocedure),'UTF8'),'sha256'),'hex'),
    'canonical_site_settings_helper',encode(extensions.digest(convert_to((select
      procedure_row.prosrc from pg_proc procedure_row where procedure_row.oid=
        'public.hotel_v2_external_calendar_site_settings_fingerprint()'::regprocedure),
      'UTF8'),'sha256'),'hex'),
    'pricing_scoped_lineage_helper',encode(extensions.digest(convert_to((select
      procedure_row.prosrc from pg_proc procedure_row where procedure_row.oid=
        'public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure),
      'UTF8'),'sha256'),'hex'),
    'pricing_transaction_preservation_helper',encode(extensions.digest(convert_to((select
      procedure_row.prosrc from pg_proc procedure_row where procedure_row.oid=
        'public.hotel_v2_7a_pricing_activation_transaction_is_preserved()'::regprocedure),
      'UTF8'),'sha256'),'hex'))
where receipt.id=1;
alter table hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
  alter column evolved_protected_fingerprints set not null,
  alter column evolved_protected_fingerprint set not null,
  alter column evolution_helper_fingerprints set not null,
  alter column fingerprint_helper_source_hashes set not null;

create function public.hotel_v2_external_calendar_provider_evolution_is_safe()
returns boolean language sql stable security definer set search_path=pg_catalog,public
as $function$
select coalesce((select
    receipt.original_foundation_fingerprint=foundation.protected_fingerprint
    and receipt.original_protected_fingerprints=foundation.protected_fingerprints
    and foundation.protected_fingerprint=public.hotel_v2_external_calendar_worker_hash(foundation.protected_fingerprints)
    and receipt.prior_compatible_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(receipt.prior_compatible_fingerprints)
    and receipt.pricing_scoped_lineage_at_install_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(
        receipt.pricing_scoped_lineage_at_install)
    and receipt.pricing_scoped_lineage_at_install->>'contract_version'=
      'hotels_v2_seven_arches_pricing_scoped_lineage_v1'
    and receipt.pricing_scoped_lineage_at_install->>
      'site_settings_lifecycle_fingerprint'=
        receipt.canonical_site_settings_lifecycle_fingerprint
    and receipt.pricing_scoped_lineage_helper_source_hash=
      (select encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),
        'sha256'),'hex') from pg_proc procedure_row where procedure_row.oid=
          'public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure)
    and receipt.pricing_transaction_preservation_source_hash=
      (select encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),
        'sha256'),'hex') from pg_proc procedure_row where procedure_row.oid=
          'public.hotel_v2_7a_pricing_activation_transaction_is_preserved()'::regprocedure)
    and public.hotel_v2_7a_pricing_activation_transaction_is_preserved()
    and jsonb_typeof(public.hotel_v2_seven_arches_pricing_scoped_lineage())='object'
    and public.hotel_v2_seven_arches_pricing_scoped_lineage()->>'contract_version'=
      'hotels_v2_seven_arches_pricing_scoped_lineage_v1'
    and public.hotel_v2_seven_arches_pricing_scoped_lineage()->>
      'site_settings_lifecycle_fingerprint'=
        receipt.canonical_site_settings_lifecycle_fingerprint
    and exists(select 1 from pg_proc procedure_row
      where procedure_row.oid=
          'public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure
        and procedure_row.proowner='postgres'::regrole
        and procedure_row.prosecdef
        and procedure_row.provolatile='s'
        and procedure_row.proconfig=
          array['search_path=pg_catalog, public']::text[]
        and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
        and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
        and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
        and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
    and exists(select 1 from pg_proc procedure_row
      where procedure_row.oid=
          'public.hotel_v2_7a_pricing_activation_transaction_is_preserved()'::regprocedure
        and procedure_row.proowner='postgres'::regrole
        and procedure_row.prosecdef
        and procedure_row.provolatile='s'
        and procedure_row.proconfig=
          array['search_path=pg_catalog, public']::text[]
        and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
        and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
        and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
        and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
    and receipt.historical_property_site_settings_raw_fingerprint=
      property.protected_fingerprints->>'site_settings'
    and receipt.historical_stage2_site_settings_raw_fingerprint=
      owner_receipt.stage2_current_protected_fingerprints->>'site_settings'
    and receipt.historical_property_site_settings_raw_fingerprint=
      receipt.historical_stage2_site_settings_raw_fingerprint
    and property.protected_fingerprint=
      public.hotel_v2_h3_2b_hash(property.protected_fingerprints)
    and receipt.historical_property_map_fingerprint=property.protected_fingerprint
    and owner_receipt.stage2_current_protected_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(
        owner_receipt.stage2_current_protected_fingerprints)
    and receipt.historical_stage2_map_fingerprint=
      owner_receipt.stage2_current_protected_fingerprint
    and receipt.canonical_site_settings_lifecycle_fingerprint=
      public.hotel_v2_external_calendar_site_settings_fingerprint()
    and receipt.canonical_site_settings_lifecycle_fingerprint=
      '9d385718586ec03664878d35552e73373bd2e4dca170dc497025fc6780c79bf5'
    and canonical.canonical_task2_protected_fingerprint=
      public.hotel_v2_h3_2b_hash(canonical.canonical_task2_protected_fingerprints)
    and canonical.canonical_stage2_protected_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(
        canonical.canonical_stage2_protected_fingerprints)
    and receipt.prior_compatible_fingerprints->'site_settings'=
      to_jsonb(receipt.canonical_site_settings_lifecycle_fingerprint)
    and receipt.canonical_site_settings_helper_source_hash=
      'e297f1b640f544644d695b36b4aca0b2dc90385e83709e8a494044aabc3b95bd'
    and receipt.canonical_site_settings_helper_source_hash=
      (select encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')
       from pg_proc procedure_row where procedure_row.oid=
         'public.hotel_v2_external_calendar_site_settings_fingerprint()'::regprocedure)
    and receipt.site_settings_activation_receipt_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(jsonb_set(
        to_jsonb(site_activation),'{created_at}',to_jsonb(
          (extract(epoch from site_activation.created_at)*1000000)::bigint),false))
    and receipt.prior_function_fingerprints->
      'public.hotel_v2_seven_arches_pricing_activation_current_is_safe()'=
      receipt.evolved_function_fingerprints->
      'public.hotel_v2_seven_arches_pricing_activation_current_is_safe()'
    and receipt.prior_function_fingerprints->
      'public.hotel_v2_seven_arches_pricing_activation_current_is_safe()'=
      hotels_v2_private.hotel_external_calendar_provider_function_fingerprints()->
      'public.hotel_v2_seven_arches_pricing_activation_current_is_safe()'
    and receipt.prior_function_fingerprints->
      'public.hotel_v2_external_calendar_site_settings_fingerprint()'=
      receipt.evolved_function_fingerprints->
      'public.hotel_v2_external_calendar_site_settings_fingerprint()'
    and receipt.prior_function_fingerprints->
      'public.hotel_v2_external_calendar_site_settings_fingerprint()'=
      hotels_v2_private.hotel_external_calendar_provider_function_fingerprints()->
      'public.hotel_v2_external_calendar_site_settings_fingerprint()'
    and receipt.evolved_protected_fingerprints=
      public.hotel_v2_external_calendar_provider_protected_fingerprints()
    and receipt.evolved_protected_fingerprints->>'contract_version'=
      'hotels_v2_external_calendar_provider_protected_v2'
    and (receipt.evolved_protected_fingerprints->>
      'transaction_preservation_exact')::boolean is true
    and receipt.evolved_protected_fingerprint=public.hotel_v2_external_calendar_worker_hash(
      receipt.evolved_protected_fingerprints)
    and receipt.evolved_function_fingerprints=hotels_v2_private.hotel_external_calendar_provider_function_fingerprints()
    and receipt.evolution_helper_fingerprints=
      hotels_v2_private.hotel_external_calendar_provider_helper_fingerprints()
    and (select stage2_compatibility_source_hash
      from public.hotel_partner_property_proposal_foundation_receipts where id=1)=
      public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
        'public.hotel_v2_external_calendar_stage2_compatible_fingerprints()'::regprocedure)))
    and receipt.fingerprint_helper_source_hashes=jsonb_build_object(
      'provider_function_fingerprints',public.hotel_v2_external_calendar_worker_hash(to_jsonb(
        pg_get_functiondef('hotels_v2_private.hotel_external_calendar_provider_function_fingerprints()'::regprocedure))),
      'provider_helper_fingerprints',public.hotel_v2_external_calendar_worker_hash(to_jsonb(
        pg_get_functiondef('hotels_v2_private.hotel_external_calendar_provider_helper_fingerprints()'::regprocedure))),
      'historical_raw_site_settings_helper',encode(extensions.digest(convert_to((select
        procedure_row.prosrc from pg_proc procedure_row where procedure_row.oid=
          'public.hotel_v2_h3_2b_protected_fingerprints()'::regprocedure),'UTF8'),'sha256'),'hex'),
      'canonical_site_settings_helper',encode(extensions.digest(convert_to((select
        procedure_row.prosrc from pg_proc procedure_row where procedure_row.oid=
          'public.hotel_v2_external_calendar_site_settings_fingerprint()'::regprocedure),
        'UTF8'),'sha256'),'hex'),
      'pricing_scoped_lineage_helper',encode(extensions.digest(convert_to((select
        procedure_row.prosrc from pg_proc procedure_row where procedure_row.oid=
          'public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure),
        'UTF8'),'sha256'),'hex'),
      'pricing_transaction_preservation_helper',encode(extensions.digest(convert_to((select
        procedure_row.prosrc from pg_proc procedure_row where procedure_row.oid=
          'public.hotel_v2_7a_pricing_activation_transaction_is_preserved()'::regprocedure),
        'UTF8'),'sha256'),'hex'))
    and receipt.safe_function_source_hash=public.hotel_v2_external_calendar_worker_hash(
      to_jsonb(pg_get_functiondef(
        'public.hotel_v2_external_calendar_provider_evolution_is_safe()'::regprocedure)))
    and receipt.receipt_hash=public.hotel_v2_external_calendar_worker_hash(jsonb_set(
      to_jsonb(receipt)-'receipt_hash','{created_at}',to_jsonb(
        (extract(epoch from receipt.created_at)*1000000)::bigint),false))
    and public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact()
    and (select provider_source_attribution_source_hash
      from public.hotel_partner_property_proposal_foundation_receipts where id=1)=
      receipt.prior_function_fingerprints->>
        'public.hotel_v2_external_calendar_provider_sources_are_attributable()'
    and receipt.evolved_function_fingerprints->>
      'public.hotel_v2_external_calendar_provider_sources_are_attributable()'=
      public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
        'public.hotel_v2_external_calendar_provider_sources_are_attributable()'::regprocedure)))
    and public.hotel_v2_external_calendar_provider_sources_are_attributable()
    and public.hotel_v2_external_calendar_site_settings_fingerprint() is not null
    and public.hotel_v2_partner_workspace_function_lineage_is_exact()
    and hotels_v2_private.hotel_external_calendar_provider_review_chain_is_exact()
    and coalesce((public.hotel_v2_admin_d_current_foundation_snapshot()->>
      'original_receipt_intact')::boolean,false)
    and coalesce((public.hotel_v2_admin_d_current_foundation_snapshot()->>
      'seven_arches_owner_preset_exact')::boolean,false)
    and coalesce((public.hotel_v2_admin_d_current_foundation_snapshot()->>
      'audit_chain_exact')::boolean,false)
    and public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()
    and public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()
    and not exists(select 1 from public.hotel_calendar_source_configs source
      where source.source_type<>'manual'
        and not public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type))
    and not exists(select 1 from public.hotel_calendar_source_configs source
      where public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type)
        and not exists(select 1 from jsonb_array_elements(receipt.provider_source_baseline) baseline(value)
          where baseline.value=to_jsonb(source))
        and not exists(select 1 from public.hotel_activity_log activity
          where activity.source='hotels_v2_external_calendar_control'
            and activity.entity_type='calendar_source' and activity.entity_id=source.id
            and activity.after_state->>'id'=source.id::text
            and activity.after_state->>'hotel_id'=source.hotel_id::text
            and activity.after_state->>'room_type_id'=source.room_type_id::text
            and activity.after_state->>'code'=source.code
            and activity.after_state->>'source_type'=source.source_type
            and (activity.after_state->>'is_enabled')::boolean=source.is_enabled
            and activity.after_state->>'review_status'=source.review_status
            and (activity.after_state->>'priority')::smallint=source.priority
            and (activity.after_state->>'version')::bigint=source.version
            and activity.after_state->>'updated_at'=to_jsonb(source.updated_at)#>>'{}'))
  from hotels_v2_private.hotel_external_calendar_provider_evolution_receipts receipt
  join hotels_v2_private.hotel_external_calendar_foundation_receipts foundation on foundation.id=receipt.id
  join public.hotel_partner_property_proposal_foundation_receipts property
    on property.id=receipt.id
  join public.hotel_admin_availability_foundation_evolution_receipts owner_receipt
    on owner_receipt.id=receipt.id
  join public.hotel_seven_arches_task2_stage2_compatibility_receipts canonical
    on canonical.id=receipt.id
  join hotels_v2_private.hotel_external_calendar_activation_receipts site_activation
    on site_activation.id=receipt.id
  where receipt.id=1),false)
$function$;

update hotels_v2_private.hotel_external_calendar_provider_evolution_receipts set
  safe_function_source_hash=public.hotel_v2_external_calendar_worker_hash(to_jsonb(pg_get_functiondef(
    'public.hotel_v2_external_calendar_provider_evolution_is_safe()'::regprocedure))) where id=1;
alter table hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
  alter column safe_function_source_hash set not null;
-- The provider receipt self-hash excludes only itself and represents created_at
-- as integer Unix microseconds, so validation is independent of session TimeZone.
update hotels_v2_private.hotel_external_calendar_provider_evolution_receipts receipt set
  receipt_hash=public.hotel_v2_external_calendar_worker_hash(jsonb_set(
    to_jsonb(receipt)-'receipt_hash','{created_at}',to_jsonb(
      (extract(epoch from receipt.created_at)*1000000)::bigint),false))
where receipt.id=1;
alter table hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
  alter column receipt_hash set not null;
create trigger hotel_external_calendar_provider_evolution_receipt_immutable
before update or delete on hotels_v2_private.hotel_external_calendar_provider_evolution_receipts
for each row execute function public.hotel_v2_h3_2a_reject_immutable_change();

drop function hotels_v2_private.hotel_external_calendar_evolve_function(text,text,text,integer);

alter function public.hotel_v2_external_calendar_ics_source_type_is_supported(text) owner to postgres;
alter function public.hotel_v2_external_calendar_stage2_compatible_fingerprints() owner to postgres;
alter function public.hotel_v2_external_calendar_protected_fingerprints() owner to postgres;
alter function public.hotel_v2_external_calendar_provider_protected_fingerprints() owner to postgres;
alter function public.hotel_v2_external_calendar_provider_evolution_is_safe() owner to postgres;
alter function public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact() owner to postgres;
alter function public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()
  owner to postgres;
alter function hotels_v2_private.hotel_external_calendar_provider_function_fingerprints() owner to postgres;
alter function hotels_v2_private.hotel_external_calendar_provider_function_source_hashes() owner to postgres;
alter function hotels_v2_private.hotel_external_calendar_provider_helper_fingerprints() owner to postgres;
alter function hotels_v2_private.hotel_external_calendar_provider_proposal_summary(uuid) owner to postgres;
alter function hotels_v2_private.hotel_external_calendar_provider_proposal_guard() owner to postgres;
alter function hotels_v2_private.hotel_external_calendar_provider_worker_scheduler_is_ready() owner to postgres;
alter function hotels_v2_private.hotel_external_calendar_provider_write_review_receipt(
  uuid,text,uuid,uuid,uuid,jsonb,text) owner to postgres;
alter function hotels_v2_private.hotel_external_calendar_provider_review_chain_is_exact() owner to postgres;
alter function hotels_v2_private.hotel_external_calendar_provider_expire_pending(uuid,uuid) owner to postgres;
alter function public.hotel_v2_partner_apply_external_calendar_plan(
  jsonb,uuid,uuid,text) owner to postgres;
alter function public.hotel_v2_admin_get_external_calendar_provider_reviews(uuid) owner to postgres;
alter function public.hotel_v2_admin_preview_external_calendar_partner_proposal(
  uuid,text) owner to postgres;
alter function public.hotel_v2_admin_apply_external_calendar_partner_proposal(
  uuid,jsonb,uuid,uuid,text) owner to postgres;
alter function public.hotel_v2_admin_reject_external_calendar_partner_proposal(
  uuid,text,uuid,uuid) owner to postgres;
alter table hotels_v2_private.hotel_external_calendar_provider_evolution_receipts owner to postgres;
alter table hotels_v2_private.hotel_external_calendar_partner_proposals owner to postgres;
alter table hotels_v2_private.hotel_external_calendar_provider_review_receipts owner to postgres;
alter table hotels_v2_private.hotel_external_calendar_provider_admin_previews owner to postgres;
revoke all on function public.hotel_v2_external_calendar_ics_source_type_is_supported(text),
  public.hotel_v2_external_calendar_stage2_compatible_fingerprints(),
  public.hotel_v2_external_calendar_protected_fingerprints(),
  public.hotel_v2_external_calendar_provider_protected_fingerprints(),
  public.hotel_v2_external_calendar_provider_evolution_is_safe(),
  public.hotel_v2_external_calendar_provider_sources_are_attributable(),
  public.hotel_v2_partner_workspace_function_lineage_is_exact(),
  public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact(),
  public.hotel_v2_seven_arches_independent_pricing_topology_is_exact(),
  hotels_v2_private.hotel_external_calendar_provider_function_fingerprints(),
  hotels_v2_private.hotel_external_calendar_provider_function_source_hashes(),
  hotels_v2_private.hotel_external_calendar_provider_proposal_summary(uuid),
  hotels_v2_private.hotel_external_calendar_provider_proposal_guard(),
  hotels_v2_private.hotel_external_calendar_provider_worker_scheduler_is_ready(),
  hotels_v2_private.hotel_external_calendar_provider_write_review_receipt(
    uuid,text,uuid,uuid,uuid,jsonb,text),
  hotels_v2_private.hotel_external_calendar_provider_review_chain_is_exact(),
  hotels_v2_private.hotel_external_calendar_provider_expire_pending(uuid,uuid),
  hotels_v2_private.hotel_external_calendar_provider_helper_fingerprints()
  from public,anon,authenticated,service_role;

revoke all on function
  public.hotel_v2_partner_apply_external_calendar_plan(jsonb,uuid,uuid,text),
  public.hotel_v2_admin_get_external_calendar_provider_reviews(uuid),
  public.hotel_v2_admin_preview_external_calendar_partner_proposal(uuid,text),
  public.hotel_v2_admin_apply_external_calendar_partner_proposal(
    uuid,jsonb,uuid,uuid,text),
  public.hotel_v2_admin_reject_external_calendar_partner_proposal(
    uuid,text,uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function
  public.hotel_v2_partner_apply_external_calendar_plan(jsonb,uuid,uuid,text),
  public.hotel_v2_admin_get_external_calendar_provider_reviews(uuid),
  public.hotel_v2_admin_preview_external_calendar_partner_proposal(uuid,text),
  public.hotel_v2_admin_apply_external_calendar_partner_proposal(
    uuid,jsonb,uuid,uuid,text),
  public.hotel_v2_admin_reject_external_calendar_partner_proposal(
    uuid,text,uuid,uuid)
  to authenticated;

do $postconditions$
begin
  if not public.hotel_v2_external_calendar_provider_evolution_is_safe() then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_evolution_unsafe';
  end if;
  if exists(select 1 from (values
      ('public.hotel_v2_external_calendar_ics_source_type_is_supported(text)',false,array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_external_calendar_provider_sources_are_attributable()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_external_calendar_stage2_compatible_fingerprints()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_external_calendar_protected_fingerprints()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_h3_2b_protected_fingerprints()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_external_calendar_site_settings_fingerprint()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_seven_arches_pricing_scoped_lineage()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_7a_pricing_activation_transaction_is_preserved()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_partner_workspace_function_lineage_is_exact()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_external_calendar_provider_protected_fingerprints()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_external_calendar_provider_evolution_is_safe()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()',true,array['search_path=pg_catalog, public']::text[]),
      ('hotels_v2_private.hotel_external_calendar_provider_function_fingerprints()',true,array['search_path=pg_catalog, public']::text[]),
      ('hotels_v2_private.hotel_external_calendar_provider_function_source_hashes()',true,array['search_path=pg_catalog, public']::text[]),
      ('hotels_v2_private.hotel_external_calendar_provider_proposal_summary(uuid)',true,array['search_path=pg_catalog, public']::text[]),
      ('hotels_v2_private.hotel_external_calendar_provider_proposal_guard()',false,array['search_path=pg_catalog, public']::text[]),
      ('hotels_v2_private.hotel_external_calendar_provider_worker_scheduler_is_ready()',true,array['search_path=pg_catalog, public']::text[]),
      ('hotels_v2_private.hotel_external_calendar_provider_write_review_receipt(uuid,text,uuid,uuid,uuid,jsonb,text)',true,array['search_path=pg_catalog, public']::text[]),
      ('hotels_v2_private.hotel_external_calendar_provider_review_chain_is_exact()',true,array['search_path=pg_catalog, public']::text[]),
      ('hotels_v2_private.hotel_external_calendar_provider_expire_pending(uuid,uuid)',true,array['search_path=pg_catalog, public']::text[]),
      ('hotels_v2_private.hotel_external_calendar_provider_helper_fingerprints()',true,array['search_path=pg_catalog, public']::text[])
    ) expected(signature,security_definer,configuration)
    left join pg_proc procedure on procedure.oid=to_regprocedure(expected.signature)
    where procedure.oid is null or procedure.proowner<>'postgres'::regrole
      or procedure.prosecdef is distinct from expected.security_definer
      or procedure.proconfig is distinct from expected.configuration
      or (expected.signature=
        'public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()'
        and procedure.provolatile<>'s'::"char")
      or (expected.signature=
        'public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()'
        and encode(extensions.digest(convert_to(procedure.prosrc,'UTF8'),
          'sha256'),'hex')<>
          '598c3510d00ae3b71d15b20906fc6c00eb01f70e11c89eee5bb49bcdeae41d9b')
      or (expected.signature=
        'public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()'
        and encode(extensions.digest(convert_to(procedure.prosrc,'UTF8'),
          'sha256'),'hex')<>
          'aa5770828066bcdcddd2b94845793ad6288da3987425d8aad99b89ab27bbb2c3')
      or has_function_privilege(0::oid,procedure.oid,'EXECUTE')
      or has_function_privilege('anon',procedure.oid,'EXECUTE')
      or has_function_privilege('authenticated',procedure.oid,'EXECUTE')
      or has_function_privilege('service_role',procedure.oid,'EXECUTE')) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_security_mismatch';
  end if;
  if exists(select 1 from (values
      ('public.hotel_v2_partner_apply_external_calendar_plan(jsonb,uuid,uuid,text)'),
      ('public.hotel_v2_admin_get_external_calendar_provider_reviews(uuid)'),
      ('public.hotel_v2_admin_preview_external_calendar_partner_proposal(uuid,text)'),
      ('public.hotel_v2_admin_apply_external_calendar_partner_proposal(uuid,jsonb,uuid,uuid,text)'),
      ('public.hotel_v2_admin_reject_external_calendar_partner_proposal(uuid,text,uuid,uuid)')
    ) expected(signature)
    left join pg_proc procedure on procedure.oid=to_regprocedure(expected.signature)
    where procedure.oid is null or procedure.proowner<>'postgres'::regrole
      or not procedure.prosecdef or procedure.provolatile<>'v'::"char"
      or procedure.proconfig is distinct from
        array['search_path=pg_catalog, public, auth']::text[]
      or has_function_privilege(0::oid,procedure.oid,'EXECUTE')
      or has_function_privilege('anon',procedure.oid,'EXECUTE')
      or has_function_privilege('service_role',procedure.oid,'EXECUTE')
      or not has_function_privilege('authenticated',procedure.oid,'EXECUTE')) then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_provider_rpc_security_mismatch';
  end if;
  if has_table_privilege('anon','hotels_v2_private.hotel_external_calendar_provider_evolution_receipts','SELECT')
     or has_table_privilege('authenticated','hotels_v2_private.hotel_external_calendar_provider_evolution_receipts','SELECT')
     or has_table_privilege('service_role','hotels_v2_private.hotel_external_calendar_provider_evolution_receipts','SELECT')
     or has_table_privilege('anon','hotels_v2_private.hotel_external_calendar_partner_proposals','SELECT')
     or has_table_privilege('authenticated','hotels_v2_private.hotel_external_calendar_partner_proposals','SELECT')
     or has_table_privilege('service_role','hotels_v2_private.hotel_external_calendar_partner_proposals','SELECT')
     or has_table_privilege('anon','hotels_v2_private.hotel_external_calendar_provider_review_receipts','SELECT')
     or has_table_privilege('authenticated','hotels_v2_private.hotel_external_calendar_provider_review_receipts','SELECT')
     or has_table_privilege('service_role','hotels_v2_private.hotel_external_calendar_provider_review_receipts','SELECT')
     or has_table_privilege('anon','hotels_v2_private.hotel_external_calendar_provider_admin_previews','SELECT')
     or has_table_privilege('authenticated','hotels_v2_private.hotel_external_calendar_provider_admin_previews','SELECT')
     or has_table_privilege('service_role','hotels_v2_private.hotel_external_calendar_provider_admin_previews','SELECT')
     or (select count(*) from pg_trigger trigger_row
       where trigger_row.tgrelid in(
         'hotels_v2_private.hotel_external_calendar_partner_proposals'::regclass,
         'hotels_v2_private.hotel_external_calendar_provider_review_receipts'::regclass,
         'hotels_v2_private.hotel_external_calendar_provider_admin_previews'::regclass)
         and not trigger_row.tgisinternal
         and trigger_row.tgname in(
           'hotel_external_calendar_provider_proposal_guard',
           'hotel_external_calendar_provider_review_receipt_immutable',
           'hotel_external_calendar_provider_preview_immutable'))<>3
     or public.hotel_v2_external_calendar_site_settings_fingerprint() is null then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_postcondition_mismatch';
  end if;
end
$postconditions$;

notify pgrst,'reload schema';
commit;
