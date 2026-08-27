-- 7 Arches Task 2 proposal-review deployment preflight (READ ONLY).
--
-- The original H3.2B receipt is immutable historical evidence.  Mutable live
-- state is instead bound to the exact current-baseline evolution captured by
-- 114360.  This preflight must run after 114360 and before 114370.

do $seven_arches_property_proposal_preflight_dependencies$
begin
  if to_regclass('public.hotel_partner_workspace_foundation_receipts') is null
     or to_regclass('public.hotel_admin_availability_foundation_receipts') is null
     or to_regclass('public.hotel_admin_availability_foundation_evolution_receipts') is null
     or to_regclass('public.site_settings') is null
     or to_regprocedure('public.hotel_v2_h3_2b_hash(jsonb)') is null
     or to_regprocedure('public.hotel_v2_admin_d_current_foundation_snapshot()') is null
     or to_regprocedure('public.hotel_v2_admin_d_protected_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_external_calendar_protected_fingerprints()') is null
     or to_regprocedure('public.hotel_v2_external_calendar_worker_hash(jsonb)') is null then
    raise exception using errcode='55000',
      message='HOTELS_V2_SEVEN_ARCHES_PROPERTY_PROPOSAL_PREFLIGHT_FAIL: prerequisite missing';
  end if;
end
$seven_arches_property_proposal_preflight_dependencies$;

with
historical_h3_2b as materialized(
  select
    count(*)=1 as cardinality_exact,
    count(*) filter(where receipt.id=1
      and receipt.protected_fingerprint=
        public.hotel_v2_h3_2b_hash(receipt.protected_fingerprints))=1 as self_hash_exact
  from public.hotel_partner_workspace_foundation_receipts receipt
),
owner_evolution as materialized(
  select
    count(*)=1 as cardinality_exact,
    count(*) filter(where receipt.id=1
      and receipt.contract_version='hotels_v2_admin_d_foundation_evolution_v2'
      and receipt.original_foundation_receipt_id=1
      and receipt.original_protected_fingerprint=(select original.protected_fingerprint
        from public.hotel_admin_availability_foundation_receipts original where original.id=1)
      and receipt.before_current_protected_fingerprint=encode(extensions.digest(
        convert_to(receipt.before_current_protected_fingerprints::text,'UTF8'),'sha256'),'hex')
      and receipt.current_protected_fingerprint=encode(extensions.digest(
        convert_to(receipt.current_protected_fingerprints::text,'UTF8'),'sha256'),'hex')
      and receipt.current_protected_fingerprints is not distinct from
        public.hotel_v2_admin_d_protected_fingerprints()
      and receipt.allowed_fingerprint_keys=array[
        'hotel_partner_hotel_permissions','hotel_partner_action_receipts',
        'hotel_partner_event_outbox','non_admin_d_activity']::text[]
      and (receipt.current_protected_fingerprints-receipt.allowed_fingerprint_keys)
        is not distinct from
          (receipt.before_current_protected_fingerprints-receipt.allowed_fingerprint_keys)
      and not exists(select 1 from unnest(receipt.allowed_fingerprint_keys) changed(key_name)
        where receipt.before_current_protected_fingerprints->changed.key_name is null
           or receipt.current_protected_fingerprints->changed.key_name is null
           or receipt.before_current_protected_fingerprints->changed.key_name is not distinct from
             receipt.current_protected_fingerprints->changed.key_name)
      and receipt.stage2_before_current_protected_fingerprint=
        public.hotel_v2_external_calendar_worker_hash(
          receipt.stage2_before_current_protected_fingerprints)
      and receipt.stage2_current_protected_fingerprint=
        public.hotel_v2_external_calendar_worker_hash(
          receipt.stage2_current_protected_fingerprints)
      and receipt.stage2_current_protected_fingerprints is not distinct from
        public.hotel_v2_external_calendar_protected_fingerprints()
      and receipt.stage2_allowed_fingerprint_keys=array[
        'hotel_partner_hotel_permissions','non_external_calendar_activity',
        'non_external_calendar_partner_receipts']::text[]
      and (receipt.stage2_current_protected_fingerprints-
          receipt.stage2_allowed_fingerprint_keys) is not distinct from
        (receipt.stage2_before_current_protected_fingerprints-
          receipt.stage2_allowed_fingerprint_keys)
      and not exists(select 1
        from unnest(receipt.stage2_allowed_fingerprint_keys) changed(key_name)
        where receipt.stage2_before_current_protected_fingerprints->changed.key_name is null
           or receipt.stage2_current_protected_fingerprints->changed.key_name is null
           or receipt.stage2_before_current_protected_fingerprints->changed.key_name
             is not distinct from
             receipt.stage2_current_protected_fingerprints->changed.key_name))=1
      as content_and_lineage_exact,
    max(public.hotel_v2_h3_2b_hash(jsonb_set(to_jsonb(receipt),'{created_at}',
      to_jsonb(extract(epoch from receipt.created_at)),false))) filter(where receipt.id=1)
      as receipt_fingerprint,
    max(receipt.stage2_current_protected_fingerprint) filter(where receipt.id=1)
      as stage2_current_protected_fingerprint
  from public.hotel_admin_availability_foundation_evolution_receipts receipt
),
owner_evolution_immutability as materialized(
  select
    exists(select 1 from pg_class relation
      where relation.oid='public.hotel_admin_availability_foundation_evolution_receipts'::regclass
        and relation.relowner='postgres'::regrole and relation.relrowsecurity)
    and not exists(select 1 from pg_policy policy
      where policy.polrelid=
        'public.hotel_admin_availability_foundation_evolution_receipts'::regclass)
    and exists(select 1 from pg_trigger trigger_row
      where trigger_row.tgrelid=
          'public.hotel_admin_availability_foundation_evolution_receipts'::regclass
        and trigger_row.tgname='hotel_admin_availability_foundation_evolution_immutable'
        and trigger_row.tgfoid='public.hotel_v2_admin_d_immutable_row()'::regprocedure
        and not trigger_row.tgisinternal and trigger_row.tgenabled='O'
        and trigger_row.tgtype=27)
    and not exists(select 1
      from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])
        privilege(name)
      where has_table_privilege(0::oid,
          'public.hotel_admin_availability_foundation_evolution_receipts'::regclass,
          privilege.name)
         or has_table_privilege('anon',
          'public.hotel_admin_availability_foundation_evolution_receipts'::regclass,
          privilege.name)
         or has_table_privilege('authenticated',
          'public.hotel_admin_availability_foundation_evolution_receipts'::regclass,
          privilege.name)
         or has_table_privilege('service_role',
          'public.hotel_admin_availability_foundation_evolution_receipts'::regclass,
          privilege.name)) as exact
),
current_foundation as materialized(
  select public.hotel_v2_admin_d_current_foundation_snapshot() value
),
migration_boundary as materialized(
  select
    to_regclass('public.hotel_partner_property_proposal_admin_reviews') is null
    and to_regclass('public.hotel_partner_property_proposal_admin_transaction_context') is null
    and to_regclass('public.hotel_partner_property_proposal_foundation_receipts') is null
    and to_regprocedure('public.hotel_v2_admin_get_partner_property_proposals(uuid)') is null
    and to_regprocedure(
      'public.hotel_v2_admin_preview_partner_property_proposal_plan(jsonb)') is null
    and to_regprocedure(
      'public.hotel_v2_admin_apply_partner_property_proposal_plan(jsonb,uuid)') is null
    and to_regprocedure(
      'public.hotel_v2_seven_arches_property_proposal_canonical_is_attributable()') is null
    and to_regprocedure(
      'public.hotel_v2_seven_arches_property_proposal_protected_fingerprints()') is null
    and to_regprocedure(
      'public.hotel_v2_partner_workspace_function_lineage_is_exact()') is null
    and to_regprocedure(
      'public.hotel_v2_external_calendar_stage2_compatible_fingerprints()') is null
      as exact
),
diagnostics as(
  select
    historical_h3_2b.cardinality_exact as historical_h3_2b_receipt_cardinality_exact,
    historical_h3_2b.self_hash_exact as historical_h3_2b_receipt_self_hash_exact,
    owner_evolution.cardinality_exact as owner_evolution_receipt_cardinality_exact,
    owner_evolution.content_and_lineage_exact as owner_evolution_receipt_exact,
    owner_evolution_immutability.exact as owner_evolution_receipt_immutable,
    owner_evolution.receipt_fingerprint as owner_evolution_receipt_fingerprint,
    coalesce((current_foundation.value->>'original_receipt_intact')::boolean,false)
      as original_admin_d_receipt_intact,
    coalesce((current_foundation.value->>'historical_receipts_intact')::boolean,false)
      as historical_receipts_intact,
    coalesce((current_foundation.value->>'frozen_contracts_exact')::boolean,false)
      as frozen_contracts_exact,
    coalesce((current_foundation.value->>'supported_hotel_flags')::boolean,false)
      as supported_hotel_flags,
    coalesce((current_foundation.value->>'stage2f_function_compatibility_exact')::boolean,false)
      as stage2f_function_compatibility_exact,
    coalesce((current_foundation.value->>'current_matches_latest')::boolean,false)
      as current_matches_latest,
    coalesce((current_foundation.value->>'stage2_current_matches_latest')::boolean,false)
      as stage2_current_matches_latest,
    owner_evolution.stage2_current_protected_fingerprint is not distinct from
      current_foundation.value->>'stage2_current_protected_fingerprint'
      and current_foundation.value->'stage2_current_protected_fingerprints' is not distinct from
        public.hotel_v2_external_calendar_protected_fingerprints()
      as current_stage2_projection_exact,
    coalesce((current_foundation.value->>'seven_arches_target_foundation_exact')::boolean,false)
      as seven_arches_target_foundation_exact,
    coalesce((current_foundation.value->>'seven_arches_owner_membership_exact')::boolean,false)
      as seven_arches_owner_membership_exact,
    coalesce((current_foundation.value->>'seven_arches_assignment_exact')::boolean,false)
      as seven_arches_assignment_exact,
    coalesce((current_foundation.value->>'seven_arches_owner_preset_exact')::boolean,false)
      as seven_arches_owner_preset_exact,
    coalesce((current_foundation.value->>'foreign_hotel_permissions_unchanged')::boolean,false)
      as foreign_hotel_permissions_unchanged,
    coalesce((current_foundation.value->>'audit_chain_exact')::boolean,false)
      as audit_chain_exact,
    coalesce((current_foundation.value->>'safe')::boolean,false)
      as current_admin_d_foundation_safe,
    migration_boundary.exact as migration_boundary_exact
  from historical_h3_2b cross join owner_evolution
  cross join owner_evolution_immutability cross join current_foundation
  cross join migration_boundary
)
select
  'hotels_v2_seven_arches_property_proposal_review_preflight_v1' contract_version,
  diagnostics.*,
  historical_h3_2b_receipt_cardinality_exact
    and historical_h3_2b_receipt_self_hash_exact
    and owner_evolution_receipt_cardinality_exact
    and owner_evolution_receipt_exact
    and owner_evolution_receipt_immutable
    and owner_evolution_receipt_fingerprint~'^[0-9a-f]{64}$'
    and original_admin_d_receipt_intact
    and historical_receipts_intact
    and frozen_contracts_exact
    and supported_hotel_flags
    and stage2f_function_compatibility_exact
    and current_matches_latest
    and stage2_current_matches_latest
    and current_stage2_projection_exact
    and seven_arches_target_foundation_exact
    and seven_arches_owner_membership_exact
    and seven_arches_assignment_exact
    and seven_arches_owner_preset_exact
    and foreign_hotel_permissions_unchanged
    and audit_chain_exact
    and current_admin_d_foundation_safe
    and migration_boundary_exact
    as hotels_v2_seven_arches_property_proposal_review_preflight_safe
from diagnostics;
