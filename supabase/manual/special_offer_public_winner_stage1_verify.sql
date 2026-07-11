-- Special Offers 3C.6E
-- Public-safe winner result read path verify.
--
-- Read-only. Does not execute public winner RPC and does not mutate data.

with fn as (
  select
    p.oid,
    p.proname,
    pg_get_function_identity_arguments(p.oid) as identity_args,
    (select rolname from pg_roles where oid = p.proowner) as owner_name,
    p.prosecdef,
    p.provolatile,
    coalesce(array_to_string(p.proconfig, ','), '') as proconfig,
    lower(regexp_replace(coalesce(p.prosrc, ''), '[[:space:]]+', ' ', 'g')) as source,
    p.proacl,
    p.proowner
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('get_public_special_offer_landing', 'get_public_special_offer_winner')
    and pg_get_function_identity_arguments(p.oid) = 'p_slug text'
),
fn_acl as (
  select
    f.proname,
    coalesce(bool_or(a.grantee = 0 and a.privilege_type = 'EXECUTE'), false) as public_execute_present,
    coalesce(bool_or(a.grantee = 'anon'::regrole and a.privilege_type = 'EXECUTE'), false) as anon_execute_present,
    coalesce(bool_or(a.grantee = 'authenticated'::regrole and a.privilege_type = 'EXECUTE'), false) as authenticated_execute_present,
    coalesce(bool_or(a.grantee = 'service_role'::regrole and a.privilege_type = 'EXECUTE'), false) as service_role_execute_present
  from fn f
  left join lateral aclexplode(coalesce(f.proacl, acldefault('f', f.proowner))) a on true
  group by f.proname
),
table_acl as (
  select
    coalesce(bool_or(a.grantee = 'anon'::regrole and a.privilege_type = 'SELECT'), false) as anon_raw_winner_select_present,
    coalesce(bool_or(a.grantee = 0 and a.privilege_type = 'SELECT'), false) as public_raw_winner_select_present,
    coalesce(bool_or(a.grantee = 'anon'::regrole and a.privilege_type in ('INSERT', 'UPDATE', 'DELETE')), false) as anon_raw_winner_write_present,
    coalesce(bool_or(a.grantee = 'authenticated'::regrole and a.privilege_type in ('INSERT', 'UPDATE', 'DELETE')), false) as authenticated_raw_winner_write_present
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
landing as (
  select * from fn where proname = 'get_public_special_offer_landing'
),
winner as (
  select * from fn where proname = 'get_public_special_offer_winner'
),
checks as (
  select
    to_regclass('public.special_offer_winner_workflows') is not null as winner_workflows_exists,
    to_regclass('public.special_offer_winner_publications') is not null as winner_publications_exists,
    exists(select 1 from landing) as landing_rpc_exists,
    coalesce((select prosecdef from landing), false) as landing_security_definer,
    coalesce((select proconfig like '%search_path=pg_catalog, public%' from landing), false) as landing_safe_search_path,
    coalesce((select owner_name = 'postgres' from landing), false) as landing_owner_ok,
    coalesce((select source like '%o.status in (''active'', ''ended'', ''locked'')%' from landing), false) as landing_allows_ended_public_statuses,
    coalesce((select source like '%o.visibility = ''public''%' from landing), false) as landing_requires_public_visibility,
    coalesce((select source like '%o.archived_at is null%' from landing), false) as landing_blocks_archived,
    coalesce((select source like '%now() >= o.start_at%' from landing), false) as landing_requires_started_campaign,
    coalesce((select source not like '%now() <= o.end_at%' from landing), false) as landing_no_longer_hides_ended_public_campaigns,
    exists(select 1 from winner) as winner_rpc_exists,
    coalesce((select prosecdef from winner), false) as winner_security_definer,
    coalesce((select proconfig like '%search_path=pg_catalog, public%' from winner), false) as winner_safe_search_path,
    coalesce((select owner_name = 'postgres' from winner), false) as winner_owner_ok,
    coalesce((select provolatile = 's' from winner), false) as winner_stable,
    coalesce((select source like '%winner_published%' from winner), false) as winner_returns_published_flag,
    coalesce((select source like '%public_name%' from winner), false) as winner_returns_public_name,
    coalesce((select source like '%published_at%' from winner), false) as winner_returns_published_at,
    coalesce((select source like '%campaign_slug%' from winner), false) as winner_returns_campaign_slug,
    coalesce((select source like '%o.visibility = ''public''%' from winner), false) as winner_requires_public_campaign,
    coalesce((select source like '%o.status in (''active'', ''ended'', ''locked'')%' from winner), false) as winner_blocks_draft_private_archived,
    coalesce((select source like '%w.status = ''published''%' from winner), false) as winner_requires_published_workflow,
    coalesce((select source like '%p.publication_consent_confirmed is true%' from winner), false) as winner_requires_publication_consent,
    coalesce((select source like '%p.published_at is not null%' from winner), false) as winner_requires_published_at,
    coalesce((select source like '%p.unpublished_at is null%' from winner), false) as winner_hides_unpublished_result,
    coalesce((select source like '%nullif(btrim(p.public_name), '''') is not null%' from winner), false) as winner_requires_non_empty_public_name,
    coalesce((select source not like '%''entry_id''%' from winner), false) as winner_does_not_return_entry_id,
    coalesce((select source not like '%''workflow_id''%' from winner), false) as winner_does_not_return_workflow_id,
    coalesce((select source not like '%''shortlist_id''%' from winner), false) as winner_does_not_return_shortlist_id,
    coalesce((select source not like '%''user_id''%' from winner), false) as winner_does_not_return_user_id,
    coalesce((select source not like '%''email''%' and source not like '%''phone''%' and source not like '%''date_of_birth''%' from winner), false) as winner_does_not_return_contact_pii,
    coalesce((select source not like '%''score''%' and source not like '%''total_points''%' and source not like '%''bonus_points''%' from winner), false) as winner_does_not_return_score,
    coalesce((select source not like '%''answers''%' and source not like '%''evidence_url''%' and source not like '%''contact_notes''%' and source not like '%''committee_notes''%' from winner), false) as winner_does_not_return_private_payloads,
    coalesce((select not public_execute_present from fn_acl where proname = 'get_public_special_offer_winner'), false) as winner_public_execute_absent,
    coalesce((select anon_execute_present from fn_acl where proname = 'get_public_special_offer_winner'), false) as winner_anon_execute_present,
    coalesce((select authenticated_execute_present from fn_acl where proname = 'get_public_special_offer_winner'), false) as winner_authenticated_execute_present,
    coalesce((select not service_role_execute_present from fn_acl where proname = 'get_public_special_offer_winner'), false) as winner_service_role_execute_absent,
    coalesce((select not public_execute_present from fn_acl where proname = 'get_public_special_offer_landing'), false) as landing_public_execute_absent,
    coalesce((select anon_execute_present from fn_acl where proname = 'get_public_special_offer_landing'), false) as landing_anon_execute_present,
    coalesce((select authenticated_execute_present from fn_acl where proname = 'get_public_special_offer_landing'), false) as landing_authenticated_execute_present,
    coalesce((select not service_role_execute_present from fn_acl where proname = 'get_public_special_offer_landing'), false) as landing_service_role_execute_absent,
    not coalesce((select public_raw_winner_select_present from table_acl), false) as no_public_raw_winner_table_select,
    not coalesce((select anon_raw_winner_select_present from table_acl), false) as no_anon_raw_winner_table_select,
    not coalesce((select anon_raw_winner_write_present from table_acl), false) as no_anon_raw_winner_table_writes,
    not coalesce((select authenticated_raw_winner_write_present from table_acl), false) as no_authenticated_raw_winner_table_writes
)
select
  *,
  (
    winner_workflows_exists
    and winner_publications_exists
    and landing_rpc_exists
    and landing_security_definer
    and landing_safe_search_path
    and landing_owner_ok
    and landing_allows_ended_public_statuses
    and landing_requires_public_visibility
    and landing_blocks_archived
    and landing_requires_started_campaign
    and landing_no_longer_hides_ended_public_campaigns
    and winner_rpc_exists
    and winner_security_definer
    and winner_safe_search_path
    and winner_owner_ok
    and winner_stable
    and winner_returns_published_flag
    and winner_returns_public_name
    and winner_returns_published_at
    and winner_returns_campaign_slug
    and winner_requires_public_campaign
    and winner_blocks_draft_private_archived
    and winner_requires_published_workflow
    and winner_requires_publication_consent
    and winner_requires_published_at
    and winner_hides_unpublished_result
    and winner_requires_non_empty_public_name
    and winner_does_not_return_entry_id
    and winner_does_not_return_workflow_id
    and winner_does_not_return_shortlist_id
    and winner_does_not_return_user_id
    and winner_does_not_return_contact_pii
    and winner_does_not_return_score
    and winner_does_not_return_private_payloads
    and winner_public_execute_absent
    and winner_anon_execute_present
    and winner_authenticated_execute_present
    and winner_service_role_execute_absent
    and landing_public_execute_absent
    and landing_anon_execute_present
    and landing_authenticated_execute_present
    and landing_service_role_execute_absent
    and no_public_raw_winner_table_select
    and no_anon_raw_winner_table_select
    and no_anon_raw_winner_table_writes
    and no_authenticated_raw_winner_table_writes
  ) as overall_pass
from checks;
