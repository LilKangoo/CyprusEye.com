-- Production preflight for the additive provider-type evolution.
begin;
set transaction read only;
set local statement_timeout='120s';
do $preflight$
declare c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
begin
  if to_regclass('hotels_v2_private.hotel_external_calendar_foundation_receipts') is null
     or to_regprocedure('public.hotel_v2_external_calendar_protected_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_external_calendar_stage2_compatible_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_external_calendar_provider_sources_are_attributable()') is null
     or to_regclass('public.hotel_partner_property_proposal_foundation_receipts') is null
     or to_regprocedure('public.hotel_v2_external_calendar_site_settings_fingerprint()') is null
     or to_regprocedure('public.hotel_v2_partner_workspace_function_lineage_is_exact()') is null
     or to_regprocedure('public.hotel_v2_seven_arches_pricing_activation_current_is_safe()') is null
     or to_regprocedure('public.hotel_v2_partner_get_external_calendar_control(uuid,uuid)') is null
     or to_regprocedure('public.hotel_v2_external_calendar_scheduler_dispatch()') is null then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_preflight_foundation_missing';
  end if;
  if to_regclass('hotels_v2_private.hotel_external_calendar_provider_evolution_receipts') is not null then
    raise exception using errcode='23514',message='hotels_v2_external_calendar_provider_preflight_already_applied';
  end if;
  if not exists(select 1 from hotels_v2_private.hotel_external_calendar_foundation_receipts receipt
      where receipt.id=1 and receipt.protected_fingerprint=
        public.hotel_v2_external_calendar_worker_hash(receipt.protected_fingerprints)) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_preflight_protected_drift';
  end if;
  if public.hotel_v2_external_calendar_site_settings_fingerprint() is null
     or not public.hotel_v2_partner_workspace_function_lineage_is_exact()
     or exists(select 1 from hotels_v2_private.hotel_external_calendar_sync_jobs
       where status in('leased','running'))
     or exists(select 1 from hotels_v2_private.hotel_external_calendar_sync_runs
       where status='running') then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_preflight_activation_drift';
  end if;
  if not coalesce((public.hotel_v2_admin_d_current_foundation_snapshot()->>'original_receipt_intact')::boolean,false)
     or not coalesce((public.hotel_v2_admin_d_current_foundation_snapshot()->>'seven_arches_owner_preset_exact')::boolean,false)
     or not coalesce((public.hotel_v2_admin_d_current_foundation_snapshot()->>'audit_chain_exact')::boolean,false)
     or not public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()
     or not public.hotel_v2_seven_arches_pricing_activation_current_is_safe() then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_preflight_owner_evolution_drift';
  end if;
  if not exists(select 1 from public.hotel_partner_property_proposal_foundation_receipts receipt
      where receipt.id=1 and receipt.provider_source_attribution_source_hash=
        public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(
          'public.hotel_v2_external_calendar_provider_sources_are_attributable()'::regprocedure))))
     or not public.hotel_v2_external_calendar_provider_sources_are_attributable() then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_preflight_attribution_drift';
  end if;
  if (select count(*) from public.hotel_room_types room where room.hotel_id=c_hotel
      and room.id in('b4ef504f-cdeb-4e3c-a54d-932146ef4e94','825c01b7-9f82-492a-9c81-9b1d5cd7acd3')
      and room.status='active' and room.inventory_mode='pooled' and room.base_inventory_count=1)<>2
     or exists(select 1 from public.hotel_calendar_source_configs source where source.hotel_id=c_hotel
       and source.source_type<>'manual')
     or exists(select 1 from hotels_v2_private.hotel_external_calendar_source_secrets binding
       where binding.hotel_id=c_hotel)
     or not exists(select 1 from public.hotel_partner_hotel_permissions permission
       join public.partner_resources assignment on assignment.id=permission.assignment_id
       join public.partners partner on partner.id=permission.partner_id
       where permission.hotel_id=c_hotel and assignment.partner_id=permission.partner_id
         and assignment.resource_type='hotels' and assignment.resource_id=c_hotel
         and partner.status='active' and partner.can_manage_hotels
         and permission.manage_availability
         and (select count(*)=1 from public.partner_users member
           where member.partner_id=partner.id and member.role='owner')) then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_provider_preflight_seven_arches_not_ready';
  end if;
end
$preflight$;
select 'hotels_v2_external_calendar_provider_types_preflight_v1' contract_version,
  2 seven_arches_room_count,0 configured_provider_source_count,0 configured_secret_count,
  true original_stage2_receipt_exact,true feature_flags_legacy_safe,true ready;
commit;
