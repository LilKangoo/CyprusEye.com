-- Read-only preflight for the final provider-lineage evolution. The checks
-- bind the accepted pricing/application chain before 114450 replaces any
-- provider-facing or ADMIN-D compatibility function.
begin;
set transaction read only;
set local statement_timeout='180s';

do $preflight$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
begin
  if to_regclass('hotels_v2_private.hotel_external_calendar_foundation_receipts') is null
     or to_regclass('public.hotel_seven_arches_pricing_activation_evolution_receipts') is null
     or to_regclass('public.hotel_seven_arches_independent_pricing_evolution_receipts') is null
     or to_regclass('public.hotel_seven_arches_reviewed_pricing_foundation_receipts') is null
     or to_regclass('public.hotel_seven_arches_reviewed_pricing_evolution_receipts') is null
     or to_regclass('public.hotel_seven_arches_public_quote_issuances') is null
     or to_regclass('public.hotel_seven_arches_public_booking_receipts') is null
     or to_regprocedure('public.hotel_v2_external_calendar_protected_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_external_calendar_provider_sources_are_attributable()') is null
     or to_regprocedure('public.hotel_v2_external_calendar_site_settings_fingerprint()') is null
     or to_regprocedure('public.hotel_v2_partner_workspace_function_lineage_is_exact()') is null
     or to_regprocedure('public.hotel_v2_admin_d_current_foundation_snapshot()') is null
     or to_regprocedure('public.hotel_v2_seven_arches_pricing_activation_current_is_safe()') is null
     or to_regprocedure('public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()') is null
     or to_regprocedure('public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()') is null
     or to_regprocedure('public.hotel_v2_seven_arches_pricing_scoped_lineage()') is null
     or to_regprocedure(
       'public.hotel_v2_7a_pricing_activation_transaction_is_preserved()')
       is null
     or to_regprocedure(
       'public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact()') is null
     or to_regprocedure('public.hotel_v2_public_quote_seven_arches_core(jsonb)') is null
     or to_regprocedure('public.hotel_v2_public_create_seven_arches_booking(jsonb)') is null then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_provider_preflight_foundation_missing';
  end if;
  if to_regclass('hotels_v2_private.hotel_external_calendar_provider_evolution_receipts') is not null then
    raise exception using errcode='23514',
      message='hotels_v2_external_calendar_provider_preflight_already_applied';
  end if;

  if (select count(*) from public.hotel_seven_arches_pricing_activation_evolution_receipts)<>1
     or (select count(*) from public.hotel_seven_arches_independent_pricing_evolution_receipts)<>1
     or (select count(*) from public.hotel_seven_arches_reviewed_pricing_foundation_receipts)<>1
     or not public.hotel_v2_seven_arches_pricing_activation_current_is_safe()
     or not public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()
     or not public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()
     or public.hotel_v2_seven_arches_pricing_scoped_lineage() is null
     or not public.hotel_v2_7a_pricing_activation_transaction_is_preserved()
     or public.hotel_v2_seven_arches_pricing_scoped_lineage()->>'contract_version'
       is distinct from 'hotels_v2_seven_arches_pricing_scoped_lineage_v1'
     or public.hotel_v2_seven_arches_pricing_scoped_lineage()->>
       'site_settings_lifecycle_fingerprint'
       is distinct from public.hotel_v2_external_calendar_site_settings_fingerprint()
     or not public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact()
     or not public.hotel_v2_external_calendar_provider_sources_are_attributable()
     or public.hotel_v2_external_calendar_site_settings_fingerprint() is null
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
     or not public.hotel_v2_partner_workspace_function_lineage_is_exact() then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_provider_preflight_accepted_lineage_drift';
  end if;

  if exists(select 1 from (values
      ('public.hotel_v2_external_calendar_protected_fingerprints()',
        'e9df9093d67ff5039855a0435174416c2eaca71b67700d4806eb56466e9c4af5','s'::"char",
        array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_current_foundation_snapshot()',
        '2ed412e46a827c3b57b570f3c6675edc5d1a92562fb8acb59b7148b245ed592a','s'::"char",
        array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_h3_2b_protected_fingerprints()',
        '7ca318d9b7b441fa67b1f67b95100d4feee5cf9e1e336a826cbe7408edac97f2','s'::"char",
        array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_external_calendar_site_settings_fingerprint()',
        'e297f1b640f544644d695b36b4aca0b2dc90385e83709e8a494044aabc3b95bd','s'::"char",
        array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_partner_workspace_function_lineage_is_exact()',
        'dde4fac2d044a53bb713cced26ca93c8295548c9bde3717d0ea83dc511801a85','s'::"char",
        array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_seven_arches_independent_pricing_topology_is_exact()',
        'c93374ece2a04386ca3b1e6f1168de3ba5162425d977857d1a4b137626ce6650','s'::"char",
        array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()',
        '61556afaeb2359b1850dd517c655cc6d05aa1babdaf63bf31b0ad53de18aff7b','s'::"char",
        array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_seven_arches_pricing_scoped_lineage()',
        '424dec1ba57f42950e4240c0d97d9823a8803e33d3ac207e8a52584c7126b4c0','s'::"char",
        array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()',
        'e42b5b7cabecd6e7ec7a847796983e497572f9f8fc0802f642fdc6b995d84ac3','s'::"char",
        array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()',
        '0a6255e457f0912452949966e47e29a0ce0f6cda3e85c53b999343f9b68c3a95','s'::"char",
        array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_7a_pricing_activation_transaction_is_preserved()',
        '54b3d6baea7b5b99330b2cb6cdb212314d80e41da75a9ab8f800bc7dab215fdb','s'::"char",
        array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact()',
        'c0e257ae4a8bbf8fae16270025dbbd34490ff39ebeda1733e26de1215b372e0e','s'::"char",
        array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_public_quote_seven_arches_core(jsonb)',
        '5265e97e8971d06e95e27db72ebc2f5e006eac8cb17779f1cff6ab519f9e6559','v'::"char",
        array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_public_create_seven_arches_booking(jsonb)',
        '3342ae34d00495ad5278e18cdb95ca152f6aed51402f32d56b525779400791ee','v'::"char",
        array['search_path=pg_catalog, public, auth']::text[])
    ) expected(signature,source_hash,volatility,path)
    left join pg_proc procedure_row on procedure_row.oid=to_regprocedure(expected.signature)
    where procedure_row.oid is null
      or procedure_row.proowner<>'postgres'::regrole
      or not procedure_row.prosecdef
      or procedure_row.provolatile is distinct from expected.volatility
      or procedure_row.proconfig is distinct from expected.path
      or encode(extensions.digest(convert_to(procedure_row.prosrc,'UTF8'),'sha256'),'hex')
        is distinct from expected.source_hash) then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_provider_preflight_source_drift';
  end if;

  if not exists(select 1 from pg_proc procedure_row
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
        and not has_function_privilege('service_role',procedure_row.oid,'EXECUTE')) then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_provider_preflight_scoped_lineage_security_drift';
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
      message='hotels_v2_external_calendar_provider_preflight_transaction_preservation_security_drift';
  end if;

  if not exists(select 1 from hotels_v2_private.hotel_external_calendar_foundation_receipts receipt
      where receipt.id=1 and receipt.protected_fingerprint=
        public.hotel_v2_external_calendar_worker_hash(receipt.protected_fingerprints))
     or exists(select 1 from hotels_v2_private.hotel_external_calendar_sync_jobs
       where status in('leased','running'))
     or exists(select 1 from hotels_v2_private.hotel_external_calendar_sync_runs
       where status='running') then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_provider_preflight_runtime_drift';
  end if;

  if (select count(*) from public.hotel_room_types room
      where room.hotel_id=c_hotel
        and room.id in('b4ef504f-cdeb-4e3c-a54d-932146ef4e94',
          '825c01b7-9f82-492a-9c81-9b1d5cd7acd3')
        and room.status='active' and room.inventory_mode='pooled'
        and room.base_inventory_count=1)<>2
     or exists(select 1 from public.hotel_calendar_source_configs source
       where source.hotel_id=c_hotel and source.source_type<>'manual')
     or exists(select 1 from hotels_v2_private.hotel_external_calendar_source_secrets binding
       where binding.hotel_id=c_hotel) then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_provider_preflight_seven_arches_not_ready';
  end if;
end
$preflight$;

select 'hotels_v2_external_calendar_provider_types_preflight_v3' contract_version,
  1 activation_receipt_count,1 topology_receipt_count,
  (select count(*)::integer from public.hotel_seven_arches_reviewed_pricing_evolution_receipts)
    reviewed_pricing_receipt_count,
  2 seven_arches_room_count,0 configured_provider_source_count,
  true site_settings_representation_bridge_exact,true pricing_scoped_lineage_exact,
  true pricing_transaction_preservation_exact,
  true accepted_pricing_lineage_exact,true ready;
commit;
