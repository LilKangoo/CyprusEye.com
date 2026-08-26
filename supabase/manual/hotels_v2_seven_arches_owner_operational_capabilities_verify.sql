-- Standalone read-only verifier for migration 143.6.
-- Supabase SQL Editor compatible.
begin;
set transaction read only;
set local statement_timeout='90s';

do $verify$
declare v_snapshot jsonb;
begin
  if to_regclass('public.hotel_admin_availability_foundation_evolution_receipts') is null
     or to_regprocedure('public.hotel_v2_seven_arches_owner_capabilities()') is null
     or to_regprocedure('public.hotel_v2_admin_d_current_foundation_snapshot()') is null then
    raise exception 'HOTELS_V2_SEVEN_ARCHES_OWNER_VERIFY_FAIL: object missing';
  end if;
  v_snapshot:=public.hotel_v2_admin_d_current_foundation_snapshot();
  if not coalesce((v_snapshot->>'safe')::boolean,false) then
    raise exception 'HOTELS_V2_SEVEN_ARCHES_OWNER_VERIFY_FAIL: %',v_snapshot;
  end if;
  if not exists(select 1 from pg_class relation
      where relation.oid='public.hotel_admin_availability_foundation_evolution_receipts'::regclass
        and relation.relowner='postgres'::regrole and relation.relrowsecurity)
     or exists(select 1 from pg_policy policy
       where policy.polrelid='public.hotel_admin_availability_foundation_evolution_receipts'::regclass)
     or exists(select 1 from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege(name)
       where has_table_privilege(0::oid,
         'public.hotel_admin_availability_foundation_evolution_receipts'::regclass,privilege.name)
          or has_table_privilege('anon',
         'public.hotel_admin_availability_foundation_evolution_receipts'::regclass,privilege.name)
          or has_table_privilege('authenticated',
         'public.hotel_admin_availability_foundation_evolution_receipts'::regclass,privilege.name)
          or has_table_privilege('service_role',
         'public.hotel_admin_availability_foundation_evolution_receipts'::regclass,privilege.name)) then
    raise exception 'HOTELS_V2_SEVEN_ARCHES_OWNER_VERIFY_FAIL: raw receipt ACL mismatch';
  end if;
  if exists(select 1 from (values
      ('public.hotel_v2_seven_arches_owner_capabilities()',false,array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_admin_d_current_foundation_snapshot()',true,array['search_path=pg_catalog, public']::text[])
    ) expected(signature,secdef,path)
    left join pg_proc procedure_row on procedure_row.oid=to_regprocedure(expected.signature)
    where procedure_row.oid is null or procedure_row.proowner<>'postgres'::regrole
      or procedure_row.prosecdef is distinct from expected.secdef
      or procedure_row.proconfig is distinct from expected.path
      or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
      or has_function_privilege('service_role',procedure_row.oid,'EXECUTE')) then
    raise exception 'HOTELS_V2_SEVEN_ARCHES_OWNER_VERIFY_FAIL: helper metadata/ACL mismatch';
  end if;
end
$verify$;

with state as(select public.hotel_v2_admin_d_current_foundation_snapshot() value),
diagnostics as(select
  case when coalesce((value->>'original_receipt_intact')::boolean,false) then 0 else 1 end
    original_receipt_mismatch,
  case when coalesce((value->>'current_matches_latest')::boolean,false) then 0 else 1 end
    current_baseline_mismatch,
  case when coalesce((value->>'seven_arches_assignment_exact')::boolean,false)
      and coalesce((value->>'seven_arches_owner_preset_exact')::boolean,false) then 0 else 1 end
    owner_preset_mismatch,
  case when coalesce((value->>'audit_chain_exact')::boolean,false) then 0 else 1 end
    audit_chain_mismatch
  from state)
select 'hotels_v2_seven_arches_owner_operational_capabilities_verify_v1' contract_version,
  state.value as current_foundation,
  diagnostics.original_receipt_mismatch,diagnostics.current_baseline_mismatch,
  diagnostics.owner_preset_mismatch,diagnostics.audit_chain_mismatch,
  diagnostics.original_receipt_mismatch=0 and diagnostics.current_baseline_mismatch=0
    and diagnostics.owner_preset_mismatch=0 and diagnostics.audit_chain_mismatch=0
    as hotels_v2_seven_arches_owner_operational_capabilities_safe
from state cross join diagnostics;
commit;
