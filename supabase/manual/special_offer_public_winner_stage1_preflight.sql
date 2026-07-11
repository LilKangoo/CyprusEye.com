-- Special Offers 3C.6E
-- Public-safe winner result read path preflight.
--
-- Read-only. Does not create, alter, grant, revoke, insert, update or delete.

with required_objects as (
  select
    to_regclass('public.special_offers') is not null as special_offers_exists,
    to_regclass('public.special_offer_translations') is not null as translations_exists,
    to_regclass('public.special_offer_winner_workflows') is not null as winner_workflows_exists,
    to_regclass('public.special_offer_winner_publications') is not null as winner_publications_exists,
    to_regprocedure('public.get_public_special_offer_landing(text)') is not null as landing_rpc_exists
),
winner_rpc as (
  select
    p.oid,
    p.proowner,
    p.prosecdef,
    coalesce(array_to_string(p.proconfig, ','), '') as proconfig
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'get_public_special_offer_winner'
    and pg_get_function_identity_arguments(p.oid) = 'p_slug text'
),
winner_rpc_acl as (
  select
    coalesce(bool_or(a.grantee = 0 and a.privilege_type = 'EXECUTE'), false) as public_execute_present,
    coalesce(bool_or(a.grantee = 'anon'::regrole and a.privilege_type = 'EXECUTE'), false) as anon_execute_present,
    coalesce(bool_or(a.grantee = 'authenticated'::regrole and a.privilege_type = 'EXECUTE'), false) as authenticated_execute_present,
    coalesce(bool_or(a.grantee = 'service_role'::regrole and a.privilege_type = 'EXECUTE'), false) as service_role_execute_present
  from winner_rpc p
  left join lateral aclexplode(coalesce((select proacl from pg_proc where oid = p.oid), acldefault('f', p.proowner))) a on true
),
table_acl as (
  select
    coalesce(bool_or(c.relacl is not null and a.grantee = 'anon'::regrole and a.privilege_type = 'SELECT'), false) as anon_raw_winner_select_present,
    coalesce(bool_or(c.relacl is not null and a.grantee = 'authenticated'::regrole and a.privilege_type in ('INSERT', 'UPDATE', 'DELETE')), false) as authenticated_raw_winner_write_present
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a on true
  where n.nspname = 'public'
    and c.relname in (
      'special_offer_winner_workflows',
      'special_offer_winner_shortlist',
      'special_offer_winner_committee_notes',
      'special_offer_winner_contact_events',
      'special_offer_winner_publications'
    )
),
current_counts as (
  select
    case when to_regclass('public.special_offer_winner_workflows') is null then 0
      else (xpath('/row/c/text()', query_to_xml(
        'select count(*)::text as c from public.special_offer_winner_workflows',
        false,
        true,
        ''
      )))[1]::text::integer
    end as workflow_count,
    case when to_regclass('public.special_offer_winner_publications') is null then 0
      else (xpath('/row/c/text()', query_to_xml(
        'select count(*)::text as c from public.special_offer_winner_publications',
        false,
        true,
        ''
      )))[1]::text::integer
    end as publication_count
)
select
  ro.special_offers_exists,
  ro.translations_exists,
  ro.winner_workflows_exists,
  ro.winner_publications_exists,
  ro.landing_rpc_exists,
  (wr.oid is not null) as public_winner_rpc_exists,
  coalesce(wr.prosecdef, false) as public_winner_rpc_security_definer,
  coalesce(wr.proconfig like '%search_path=pg_catalog, public%', false) as public_winner_rpc_safe_search_path,
  coalesce((select rolname from pg_roles where oid = wr.proowner), '') = 'postgres' as public_winner_rpc_owner_ok,
  not coalesce(a.public_execute_present, false) as public_winner_public_execute_absent,
  coalesce(a.anon_execute_present, false) as public_winner_anon_execute_present,
  coalesce(a.authenticated_execute_present, false) as public_winner_authenticated_execute_present,
  not coalesce(a.service_role_execute_present, false) as public_winner_service_role_execute_absent,
  not coalesce(ta.anon_raw_winner_select_present, false) as no_anon_raw_winner_table_select,
  not coalesce(ta.authenticated_raw_winner_write_present, false) as no_authenticated_raw_winner_table_writes,
  cc.workflow_count,
  cc.publication_count,
  (
    ro.special_offers_exists
    and ro.translations_exists
    and ro.winner_workflows_exists
    and ro.winner_publications_exists
    and ro.landing_rpc_exists
    and not coalesce(ta.anon_raw_winner_select_present, false)
    and not coalesce(ta.authenticated_raw_winner_write_present, false)
  ) as preflight_safe_to_continue
from required_objects ro
cross join current_counts cc
left join winner_rpc wr on true
left join winner_rpc_acl a on true
left join table_acl ta on true;
