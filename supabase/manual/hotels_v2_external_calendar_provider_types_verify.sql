-- Standalone read-only verifier for the provider-lineage boundary.
begin;
set transaction read only;
set local statement_timeout='180s';

do $verify$
declare
  v_signature text;
  v_relation text;
  v_role text;
  v_incoming_timezone text:=current_setting('TimeZone');
  v_nicosia jsonb;
  v_utc jsonb;
begin
  if to_regclass('hotels_v2_private.hotel_external_calendar_provider_evolution_receipts') is null
     or to_regclass('hotels_v2_private.hotel_external_calendar_partner_proposals') is null
     or to_regclass('hotels_v2_private.hotel_external_calendar_provider_review_receipts') is null
     or to_regclass('hotels_v2_private.hotel_external_calendar_provider_admin_previews') is null
     or to_regprocedure('public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()') is null
     or to_regprocedure('public.hotel_v2_external_calendar_provider_evolution_is_safe()') is null
     or to_regprocedure('public.hotel_v2_seven_arches_pricing_scoped_lineage()') is null
     or to_regprocedure(
       'public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()') is null
     or to_regprocedure(
       'public.hotel_v2_7a_pricing_activation_transaction_is_preserved()')
       is null
     or to_regprocedure(
       'public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact()') is null
     or to_regprocedure('public.hotel_v2_admin_get_external_calendar_provider_reviews(uuid)') is null
     or to_regprocedure('public.hotel_v2_admin_preview_external_calendar_partner_proposal(uuid,text)') is null
     or to_regprocedure(
       'public.hotel_v2_admin_apply_external_calendar_partner_proposal(uuid,jsonb,uuid,uuid,text)') is null
     or to_regprocedure(
       'public.hotel_v2_admin_reject_external_calendar_partner_proposal(uuid,text,uuid,uuid)') is null then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_provider_verify_foundation_missing';
  end if;

  if (select count(*) from hotels_v2_private.hotel_external_calendar_provider_evolution_receipts)<>1
     or not public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()
     or not public.hotel_v2_external_calendar_provider_evolution_is_safe()
     or not public.hotel_v2_external_calendar_provider_sources_are_attributable()
     or (select receipt.prior_function_source_hashes->>
       'public.hotel_v2_external_calendar_provider_sources_are_attributable()'
       from hotels_v2_private.hotel_external_calendar_provider_evolution_receipts receipt
       where receipt.id=1) is distinct from
       '6aee1bb6d02b999877d6384633dd9eab1e8d533917b24ab25e20c83973a0025f'
     or public.hotel_v2_external_calendar_site_settings_fingerprint() is null
     or not public.hotel_v2_partner_workspace_function_lineage_is_exact()
     or not public.hotel_v2_seven_arches_pricing_activation_current_is_safe()
     or not public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()
     or not public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()
     or public.hotel_v2_seven_arches_pricing_scoped_lineage() is null
     or not public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()
     or not public.hotel_v2_7a_pricing_activation_transaction_is_preserved()
     or public.hotel_v2_seven_arches_pricing_scoped_lineage()->>'contract_version'
       is distinct from 'hotels_v2_seven_arches_pricing_scoped_lineage_v1'
     or not public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact()
     or not exists(select 1 from pg_proc procedure_row
       where procedure_row.oid=
         'public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure
         and procedure_row.proowner='postgres'::regrole
         and procedure_row.prosecdef and procedure_row.provolatile='s'
         and procedure_row.proconfig=
           array['search_path=pg_catalog, public']::text[]
         and encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),
           'sha256'),'hex')=
           '5d8e31185a165c555c2fcfcce2802fe569bb7cc201ddfb7ac91978acfa2e3141'
         and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
         and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
         and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
         and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
     or not exists(select 1 from pg_proc procedure_row
       where procedure_row.oid=
         'public.hotel_v2_seven_arches_payment_policy_lineage_is_exact()'::regprocedure
         and procedure_row.proowner='postgres'::regrole
         and procedure_row.prosecdef and procedure_row.provolatile='s'
         and procedure_row.proconfig=
           array['search_path=pg_catalog, public']::text[]
         and encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),
           'sha256'),'hex')=
           '03dbfb03f1219361abe2173ee8e2b079b4191f6ab83d664fece9833926aeba94'
         and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
         and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
         and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
         and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
     or not exists(select 1 from pg_proc procedure_row
       join hotels_v2_private.hotel_external_calendar_provider_evolution_receipts receipt
         on receipt.id=1
       where procedure_row.oid=
         'public.hotel_v2_7a_pricing_activation_transaction_is_preserved()'::regprocedure
         and procedure_row.proowner='postgres'::regrole
         and procedure_row.prosecdef and procedure_row.provolatile='s'
         and procedure_row.proconfig=
           array['search_path=pg_catalog, public']::text[]
         and encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),
           'sha256'),'hex')=receipt.pricing_transaction_preservation_source_hash
         and receipt.pricing_transaction_preservation_source_hash=
           '54b3d6baea7b5b99330b2cb6cdb212314d80e41da75a9ab8f800bc7dab215fdb'
         and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
         and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
         and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
         and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
     or not exists(select 1 from pg_proc procedure_row
       where procedure_row.oid=
         'public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact()'::regprocedure
         and procedure_row.proowner='postgres'::regrole
         and procedure_row.prosecdef and procedure_row.provolatile='s'
         and procedure_row.proconfig=
           array['search_path=pg_catalog, public']::text[]
         and encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),
           'sha256'),'hex')=
           'c0e257ae4a8bbf8fae16270025dbbd34490ff39ebeda1733e26de1215b372e0e'
         and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
         and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
         and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
         and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
     or not exists(select 1 from pg_proc procedure_row
       join pg_language language_row on language_row.oid=procedure_row.prolang
       where procedure_row.oid=
         'public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()'::regprocedure
         and procedure_row.proowner='postgres'::regrole
         and language_row.lanname='plpgsql'
         and procedure_row.prosecdef and procedure_row.provolatile='s'
         and procedure_row.proconfig=
           array['search_path=pg_catalog, public']::text[]
         and encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),
           'sha256'),'hex')=
           '598c3510d00ae3b71d15b20906fc6c00eb01f70e11c89eee5bb49bcdeae41d9b'
         and not has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
         and not has_function_privilege('anon',procedure_row.oid,'EXECUTE')
         and not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
         and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
     or not coalesce((public.hotel_v2_admin_d_current_foundation_snapshot()->>
       'original_receipt_intact')::boolean,false)
     or not coalesce((public.hotel_v2_admin_d_current_foundation_snapshot()->>
       'audit_chain_exact')::boolean,false) then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_provider_verify_lineage_drift';
  end if;

  if not (public.hotel_v2_external_calendar_ics_source_type_is_supported('booking_com')
      and public.hotel_v2_external_calendar_ics_source_type_is_supported('airbnb')
      and public.hotel_v2_external_calendar_ics_source_type_is_supported('ical'))
     or public.hotel_v2_external_calendar_ics_source_type_is_supported('manual')
     or public.hotel_v2_external_calendar_ics_source_type_is_supported('expedia') then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_provider_verify_provider_set_mismatch';
  end if;

  if not exists(select 1
      from hotels_v2_private.hotel_external_calendar_provider_evolution_receipts receipt
      join hotels_v2_private.hotel_external_calendar_foundation_receipts foundation
        on foundation.id=receipt.id
      join public.hotel_partner_property_proposal_foundation_receipts property
        on property.id=receipt.id
      join public.hotel_admin_availability_foundation_evolution_receipts owner_receipt
        on owner_receipt.id=receipt.id
      join public.hotel_seven_arches_task2_stage2_compatibility_receipts canonical
        on canonical.id=receipt.id
      join hotels_v2_private.hotel_external_calendar_activation_receipts site_activation
        on site_activation.id=receipt.id
      where receipt.id=1
        and receipt.contract_version=
          'hotels_v2_external_calendar_provider_evolution_v1'
        and 'public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()'=
          any(receipt.changed_function_signatures)
        and 'public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()'=
          any(receipt.changed_function_signatures)
        and 'public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()'=
          any(receipt.changed_function_signatures)
        and receipt.provider_bridge_source_hash=(select encode(extensions.digest(
          convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')
          from pg_proc procedure_row where procedure_row.oid=
            'public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()'::regprocedure)
        and receipt.provider_bridge_source_hash=
          'fe87a30bafb9d2b2579a80a53701298fed797fa097f83c70d0fd1f331a776686'
        and receipt.original_foundation_fingerprint=foundation.protected_fingerprint
        and receipt.original_protected_fingerprints=foundation.protected_fingerprints
        and receipt.pricing_scoped_lineage_at_install_fingerprint=
          public.hotel_v2_external_calendar_worker_hash(
            receipt.pricing_scoped_lineage_at_install)
        and receipt.pricing_scoped_lineage_at_install->>'contract_version'=
          'hotels_v2_seven_arches_pricing_scoped_lineage_v1'
        and receipt.pricing_scoped_lineage_helper_source_hash=
          (select encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),
            'sha256'),'hex') from pg_proc procedure_row where procedure_row.oid=
              'public.hotel_v2_seven_arches_pricing_scoped_lineage()'::regprocedure)
        and receipt.pricing_transaction_preservation_source_hash=
          (select encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),
            'sha256'),'hex') from pg_proc procedure_row where procedure_row.oid=
              'public.hotel_v2_7a_pricing_activation_transaction_is_preserved()'::regprocedure)
        and public.hotel_v2_7a_pricing_activation_transaction_is_preserved()
        and receipt.historical_property_site_settings_raw_fingerprint=
          property.protected_fingerprints->>'site_settings'
        and receipt.historical_stage2_site_settings_raw_fingerprint=
          owner_receipt.stage2_current_protected_fingerprints->>'site_settings'
        and receipt.historical_property_site_settings_raw_fingerprint=
          receipt.historical_stage2_site_settings_raw_fingerprint
        and receipt.historical_property_map_fingerprint=property.protected_fingerprint
        and property.protected_fingerprint=
          public.hotel_v2_h3_2b_hash(property.protected_fingerprints)
        and receipt.historical_stage2_map_fingerprint=
          owner_receipt.stage2_current_protected_fingerprint
        and owner_receipt.stage2_current_protected_fingerprint=
          public.hotel_v2_external_calendar_worker_hash(
            owner_receipt.stage2_current_protected_fingerprints)
        and receipt.canonical_site_settings_lifecycle_fingerprint=
          '9d385718586ec03664878d35552e73373bd2e4dca170dc497025fc6780c79bf5'
        and receipt.canonical_site_settings_lifecycle_fingerprint=
          public.hotel_v2_external_calendar_site_settings_fingerprint()
        and receipt.canonical_site_settings_helper_source_hash=
          'e297f1b640f544644d695b36b4aca0b2dc90385e83709e8a494044aabc3b95bd'
        and receipt.canonical_site_settings_helper_source_hash=
          (select encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),
            'sha256'),'hex') from pg_proc procedure_row where procedure_row.oid=
              'public.hotel_v2_external_calendar_site_settings_fingerprint()'::regprocedure)
        and receipt.site_settings_activation_receipt_fingerprint=
          public.hotel_v2_external_calendar_worker_hash(jsonb_set(
            to_jsonb(site_activation),'{created_at}',to_jsonb(
              (extract(epoch from site_activation.created_at)*1000000)::bigint),false))
        and receipt.prior_function_source_hashes->>
          'public.hotel_v2_external_calendar_protected_fingerprints()'=
          'e9df9093d67ff5039855a0435174416c2eaca71b67700d4806eb56466e9c4af5'
        and receipt.prior_function_source_hashes->>
          'public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()'=
          'c93374ece2a04386ca3b1e6f1168de3ba5162425d977857d1a4b137626ce6650'
        and receipt.evolved_function_source_hashes->>
          'public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()'=
          '598c3510d00ae3b71d15b20906fc6c00eb01f70e11c89eee5bb49bcdeae41d9b'
        and receipt.evolved_function_source_hashes->>
          'public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()'=
          (select encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),
            'sha256'),'hex') from pg_proc procedure_row where procedure_row.oid=
              'public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()'::regprocedure)
        and receipt.prior_function_source_hashes->>
          'public.hotel_v2_h3_2b_protected_fingerprints()'=
          '7ca318d9b7b441fa67b1f67b95100d4feee5cf9e1e336a826cbe7408edac97f2'
        and receipt.evolved_function_source_hashes->>
          'public.hotel_v2_h3_2b_protected_fingerprints()'=
          '7ca318d9b7b441fa67b1f67b95100d4feee5cf9e1e336a826cbe7408edac97f2'
        and receipt.prior_function_fingerprints->>
          'public.hotel_v2_external_calendar_provider_sources_are_attributable()'=
          property.provider_source_attribution_source_hash
        and receipt.prior_function_fingerprints->>
          'public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()'=
          canonical.canonical_snapshot_source_hash
        and receipt.prior_function_fingerprints->>
          'public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()'=
          canonical.validator_source_hash
        and receipt.evolved_function_fingerprints=
          hotels_v2_private.hotel_external_calendar_provider_function_fingerprints()
        and receipt.evolved_function_source_hashes=
          hotels_v2_private.hotel_external_calendar_provider_function_source_hashes()
        and receipt.evolved_protected_fingerprints=
          public.hotel_v2_external_calendar_provider_protected_fingerprints()
        and receipt.evolved_protected_fingerprints->>'contract_version'=
          'hotels_v2_external_calendar_provider_protected_v2'
        and (receipt.evolved_protected_fingerprints->>
          'transaction_preservation_exact')::boolean is true
        and receipt.evolved_protected_fingerprint=
          public.hotel_v2_external_calendar_worker_hash(receipt.evolved_protected_fingerprints)
        and receipt.fingerprint_helper_source_hashes=jsonb_build_object(
          'provider_function_fingerprints',
            public.hotel_v2_external_calendar_worker_hash(to_jsonb(pg_get_functiondef(
              'hotels_v2_private.hotel_external_calendar_provider_function_fingerprints()'::regprocedure))),
          'provider_helper_fingerprints',
            public.hotel_v2_external_calendar_worker_hash(to_jsonb(pg_get_functiondef(
              'hotels_v2_private.hotel_external_calendar_provider_helper_fingerprints()'::regprocedure))),
          'historical_raw_site_settings_helper',
            '7ca318d9b7b441fa67b1f67b95100d4feee5cf9e1e336a826cbe7408edac97f2',
          'canonical_site_settings_helper',
            'e297f1b640f544644d695b36b4aca0b2dc90385e83709e8a494044aabc3b95bd',
          'pricing_scoped_lineage_helper',
            receipt.pricing_scoped_lineage_helper_source_hash,
          'pricing_transaction_preservation_helper',
            receipt.pricing_transaction_preservation_source_hash)
        and receipt.receipt_hash=public.hotel_v2_external_calendar_worker_hash(jsonb_set(
          to_jsonb(receipt)-'receipt_hash','{created_at}',to_jsonb(
            (extract(epoch from receipt.created_at)*1000000)::bigint),false))
        and receipt.prior_reviewed_pricing_catalog_fingerprint=
          (select catalog_fingerprint
           from public.hotel_seven_arches_reviewed_pricing_foundation_receipts where id=1)
        and receipt.evolved_reviewed_pricing_catalog_fingerprint=
          public.hotel_v2_seven_arches_reviewed_pricing_catalog_fingerprint()) then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_provider_verify_receipt_drift';
  end if;

  -- Prove both sides of the site_settings representation bridge. The lower
  -- Property/Stage2 projectors retain the exact raw whole-row fingerprint;
  -- only the provider projection substitutes the canonical Hotels lifecycle.
  if public.hotel_v2_external_calendar_site_settings_fingerprint()
       is distinct from public.hotel_v2_external_calendar_worker_hash(
         jsonb_build_object(
           'contract_version','hotels_v2_external_calendar_site_settings_lifecycle_v2',
           'id',1,
           'hotel_rooms_v2_enabled',false,
           'hotel_external_sync_enabled_supported_values',jsonb_build_array(false,true),
           'hotel_instant_booking_enabled',false,
           'hotel_stripe_connect_enabled',false))
     or public.hotel_v2_external_calendar_site_settings_fingerprint()
       is distinct from
         '9d385718586ec03664878d35552e73373bd2e4dca170dc497025fc6780c79bf5'
     or public.hotel_v2_h3_2b_protected_fingerprints()->>'site_settings'
       is distinct from md5(pg_catalog.query_to_xml($query$
         select to_jsonb(row_value)::text
         from public.site_settings row_value
         order by to_jsonb(row_value)::text$query$,true,true,'')::text)
     or public.hotel_v2_external_calendar_stage2_compatible_fingerprints()
          ->>'site_settings'
       is distinct from md5(pg_catalog.query_to_xml($query$
         select to_jsonb(row_value)::text
         from public.site_settings row_value
         order by to_jsonb(row_value)::text$query$,true,true,'')::text)
     or public.hotel_v2_external_calendar_provider_protected_fingerprints()
          ->>'site_settings'
       is distinct from public.hotel_v2_external_calendar_site_settings_fingerprint()
     or exists(select 1
       from hotels_v2_private.hotel_external_calendar_provider_evolution_receipts receipt
       where receipt.id=1 and (
         receipt.prior_compatible_fingerprints->>'site_settings'
           is distinct from public.hotel_v2_external_calendar_site_settings_fingerprint()
         or receipt.evolved_protected_fingerprints->>'site_settings'
           is distinct from public.hotel_v2_external_calendar_site_settings_fingerprint()
         or receipt.prior_function_source_hashes->>
              'public.hotel_v2_external_calendar_site_settings_fingerprint()'
           is distinct from receipt.evolved_function_source_hashes->>
              'public.hotel_v2_external_calendar_site_settings_fingerprint()'
         or receipt.prior_function_source_hashes->>
              'public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()'
           is distinct from
              'c93374ece2a04386ca3b1e6f1168de3ba5162425d977857d1a4b137626ce6650'
         or receipt.evolved_function_source_hashes->>
              'public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()'
           is distinct from
              '598c3510d00ae3b71d15b20906fc6c00eb01f70e11c89eee5bb49bcdeae41d9b')) then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_provider_verify_site_settings_bridge_drift';
  end if;

  perform set_config('TimeZone','Asia/Nicosia',true);
  select jsonb_build_object(
    'historical_property_raw',
      receipt.historical_property_site_settings_raw_fingerprint,
    'historical_stage2_raw',
      receipt.historical_stage2_site_settings_raw_fingerprint,
    'canonical_lifecycle',receipt.canonical_site_settings_lifecycle_fingerprint,
    'canonical_helper_source',receipt.canonical_site_settings_helper_source_hash,
    'pricing_scoped_lineage_at_install',
      receipt.pricing_scoped_lineage_at_install_fingerprint,
    'pricing_scoped_lineage_helper_source',
      receipt.pricing_scoped_lineage_helper_source_hash,
    'pricing_transaction_preservation_source',
      receipt.pricing_transaction_preservation_source_hash,
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
    'fingerprint_helper_sources',receipt.fingerprint_helper_source_hashes,
    'protected',receipt.evolved_protected_fingerprint,
    'prior_compatible',receipt.prior_compatible_fingerprint,
    'manual_source',receipt.manual_source_fingerprint,
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
    'pricing_scoped_lineage_at_install',
      receipt.pricing_scoped_lineage_at_install_fingerprint,
    'pricing_scoped_lineage_helper_source',
      receipt.pricing_scoped_lineage_helper_source_hash,
    'pricing_transaction_preservation_source',
      receipt.pricing_transaction_preservation_source_hash,
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
    'fingerprint_helper_sources',receipt.fingerprint_helper_source_hashes,
    'protected',receipt.evolved_protected_fingerprint,
    'prior_compatible',receipt.prior_compatible_fingerprint,
    'manual_source',receipt.manual_source_fingerprint,
    'function_sources',receipt.evolved_function_source_hashes)
    into strict v_utc
  from hotels_v2_private.hotel_external_calendar_provider_evolution_receipts receipt
  join hotels_v2_private.hotel_external_calendar_activation_receipts site_activation
    on site_activation.id=receipt.id
  where receipt.id=1;
  perform set_config('TimeZone',v_incoming_timezone,true);
  if v_nicosia is distinct from v_utc
     or (v_nicosia->>'activation_receipt_exact')::boolean is not true
     or (v_nicosia->>'receipt_self_exact')::boolean is not true
     or current_setting('TimeZone')<>v_incoming_timezone then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_provider_verify_timezone_drift';
  end if;

  if exists(select 1 from public.hotel_calendar_source_configs source
      left join public.hotel_room_types room
        on room.id=source.room_type_id and room.hotel_id=source.hotel_id
      left join hotels_v2_private.hotel_external_calendar_source_secrets binding
        on binding.source_id=source.id
      where public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type)
        and (room.id is null or room.status<>'active'
          or (source.is_enabled and (source.review_status<>'reviewed'
            or binding.source_id is null or binding.hotel_id<>source.hotel_id
            or binding.room_type_id<>source.room_type_id
            or (source.configuration->>'units_per_event')::integer>
              case when room.inventory_mode='unitized' then
                (select count(*)::integer from public.hotel_units unit
                 where unit.room_type_id=room.id and unit.status='active')
              else room.base_inventory_count end))))
     or exists(select 1 from hotels_v2_private.hotel_external_calendar_day_blocks block
       left join public.hotel_calendar_source_configs source on source.id=block.source_id
       where source.id is null or source.hotel_id<>block.hotel_id
         or source.room_type_id<>block.room_type_id
         or not public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type)
         or block.units_blocked<=0) then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_provider_verify_source_topology_drift';
  end if;

  if exists(select 1 from hotels_v2_private.hotel_external_calendar_partner_proposals proposal
      where proposal.status='pending_admin_review'
        and (proposal.reviewed_at is not null or proposal.reviewed_by is not null
          or proposal.admin_reason is not null or proposal.result is not null
          or (proposal.entity='ical_secret' and proposal.action in('set','rotate')
            and (proposal.vault_secret_id is null or proposal.url_fingerprint is null
              or (select count(*) from vault.secrets secret
                where secret.id=proposal.vault_secret_id)<>1))
          or (not(proposal.entity='ical_secret' and proposal.action in('set','rotate'))
            and (proposal.vault_secret_id is not null
              or proposal.url_fingerprint is not null))))
     or exists(select 1 from hotels_v2_private.hotel_external_calendar_partner_proposals proposal
       where proposal.status in('accepted','rejected')
         and (proposal.reviewed_at is null or proposal.reviewed_by is null
           or proposal.admin_reason is null or proposal.result is null
           or proposal.vault_secret_id is not null or proposal.url_fingerprint is not null
           or proposal.result::text~'vault_secret_id'
           or (proposal.entity='ical_secret' and proposal.action in('set','rotate')
             and coalesce(proposal.result->>'url_fingerprint','')!~'^[0-9a-f]{64}$')))
     or exists(select 1 from hotels_v2_private.hotel_external_calendar_provider_review_receipts receipt
       left join hotels_v2_private.hotel_external_calendar_partner_proposals proposal
         on proposal.id=receipt.proposal_id
       where proposal.id is null or proposal.status<>receipt.action) then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_provider_verify_review_ledger_drift';
  end if;

  foreach v_signature in array array[
    'public.hotel_v2_external_calendar_worker_get_source(uuid)',
    'public.hotel_v2_external_calendar_worker_list_sources(integer)',
    'public.hotel_v2_external_calendar_worker_begin_sync(jsonb)',
    'public.hotel_v2_external_calendar_worker_finalize_sync(jsonb)',
    'public.hotel_v2_external_calendar_worker_fail_sync(jsonb)',
    'public.hotel_v2_external_calendar_scheduler_enqueue(integer)',
    'public.hotel_v2_external_calendar_scheduler_lease(integer,uuid,integer)'] loop
    if not exists(select 1 from pg_proc procedure_row
        where procedure_row.oid=v_signature::regprocedure
          and procedure_row.proowner='postgres'::regrole
          and procedure_row.prosecdef
          and procedure_row.proconfig=array['search_path=pg_catalog, public']::text[])
       or has_function_privilege(0::oid,v_signature::regprocedure,'EXECUTE')
       or has_function_privilege('anon',v_signature,'EXECUTE')
       or has_function_privilege('authenticated',v_signature,'EXECUTE')
       or not has_function_privilege('service_role',v_signature,'EXECUTE') then
      raise exception using errcode='55000',
        message='hotels_v2_external_calendar_provider_verify_worker_acl';
    end if;
  end loop;

  foreach v_signature in array array[
    'public.hotel_v2_admin_get_external_calendar_control(uuid)',
    'public.hotel_v2_admin_preview_external_calendar_plan(jsonb)',
    'public.hotel_v2_admin_apply_external_calendar_plan(jsonb,uuid,uuid,text)',
    'public.hotel_v2_partner_get_external_calendar_control(uuid,uuid)',
    'public.hotel_v2_partner_preview_external_calendar_plan(jsonb)',
    'public.hotel_v2_partner_apply_external_calendar_plan(jsonb,uuid,uuid,text)',
    'public.hotel_v2_admin_get_external_calendar_provider_reviews(uuid)',
    'public.hotel_v2_admin_preview_external_calendar_partner_proposal(uuid,text)',
    'public.hotel_v2_admin_apply_external_calendar_partner_proposal(uuid,jsonb,uuid,uuid,text)',
    'public.hotel_v2_admin_reject_external_calendar_partner_proposal(uuid,text,uuid,uuid)'] loop
    if not exists(select 1 from pg_proc procedure_row
        where procedure_row.oid=v_signature::regprocedure
          and procedure_row.proowner='postgres'::regrole
          and procedure_row.prosecdef
          and procedure_row.proconfig=array['search_path=pg_catalog, public, auth']::text[])
       or has_function_privilege(0::oid,v_signature::regprocedure,'EXECUTE')
       or has_function_privilege('anon',v_signature,'EXECUTE')
       or has_function_privilege('service_role',v_signature,'EXECUTE')
       or not has_function_privilege('authenticated',v_signature,'EXECUTE') then
      raise exception using errcode='55000',
        message='hotels_v2_external_calendar_provider_verify_control_acl';
    end if;
  end loop;

  foreach v_relation in array array[
      'hotel_external_calendar_provider_evolution_receipts',
      'hotel_external_calendar_partner_proposals',
      'hotel_external_calendar_provider_review_receipts',
      'hotel_external_calendar_provider_admin_previews',
      'hotel_external_calendar_source_secrets','hotel_external_calendar_sync_runs',
      'hotel_external_calendar_source_state','hotel_external_calendar_events',
      'hotel_external_calendar_day_blocks','hotel_external_calendar_sync_jobs',
      'hotel_external_calendar_plan_reviews','hotel_external_calendar_admin_receipts',
      'hotel_external_calendar_correlations'] loop
    foreach v_role in array array['anon','authenticated','service_role'] loop
      if has_table_privilege(v_role,'hotels_v2_private.'||v_relation,'SELECT')
         or has_table_privilege(v_role,'hotels_v2_private.'||v_relation,'INSERT')
         or has_table_privilege(v_role,'hotels_v2_private.'||v_relation,'UPDATE')
         or has_table_privilege(v_role,'hotels_v2_private.'||v_relation,'DELETE') then
        raise exception using errcode='55000',
          message='hotels_v2_external_calendar_provider_verify_raw_acl';
      end if;
    end loop;
  end loop;

  if has_table_privilege('anon','vault.secrets','SELECT')
     or has_table_privilege('authenticated','vault.secrets','SELECT')
     or has_table_privilege('anon','vault.decrypted_secrets','SELECT')
     or has_table_privilege('authenticated','vault.decrypted_secrets','SELECT') then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_provider_verify_vault_raw_acl';
  end if;
end
$verify$;

select 'hotels_v2_external_calendar_provider_types_verify_v3' contract_version,
  0 lineage_mismatch_count,0 security_mismatch_count,0 topology_mismatch_count,
  (select count(*)::integer from public.hotel_calendar_source_configs
   where source_type in('booking_com','airbnb','ical')) provider_source_count,
  (select count(*)::integer
   from hotels_v2_private.hotel_external_calendar_partner_proposals) provider_proposal_count,
  true site_settings_representation_bridge_exact,true pricing_scoped_lineage_exact,
  true pricing_transaction_preservation_exact,
  true timezone_stable,true provider_evolution_safe;
commit;
