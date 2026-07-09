-- Special Offers 3C.5C-6G
-- Read-only verification for public Special Offer landing RPC.

with fn as (
  select
    p.oid,
    p.prosecdef,
    p.prorettype = 'jsonb'::regtype as returns_jsonb_type,
    p.proowner::regrole::text as owner_name,
    coalesce(array_to_string(p.proconfig, ','), '') as proconfig,
    lower(regexp_replace(p.prosrc, '[[:space:]]+', ' ', 'g')) as normalized_source
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.oid = to_regprocedure('public.get_public_special_offer_landing(text)')
),
grants as (
  select
    has_function_privilege('public', 'public.get_public_special_offer_landing(text)', 'EXECUTE') as public_execute,
    has_function_privilege('anon', 'public.get_public_special_offer_landing(text)', 'EXECUTE') as anon_execute,
    has_function_privilege('authenticated', 'public.get_public_special_offer_landing(text)', 'EXECUTE') as authenticated_execute,
    has_function_privilege('service_role', 'public.get_public_special_offer_landing(text)', 'EXECUTE') as service_role_execute
),
table_grants as (
  select
    exists (
      select 1
      from information_schema.table_privileges
      where table_schema = 'public'
        and table_name in (
          'special_offers',
          'special_offer_translations',
          'special_offer_prizes',
          'special_offer_prize_translations',
          'special_offer_links',
          'special_offer_link_translations'
        )
        and grantee in ('PUBLIC', 'anon')
        and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
    ) as anon_public_write_grants_present
),
checks as (
  select
    to_regclass('public.special_offers') is not null as special_offers_exists,
    to_regclass('public.special_offer_translations') is not null as translations_exists,
    to_regclass('public.special_offer_prizes') is not null as prizes_exists,
    to_regclass('public.special_offer_prize_translations') is not null as prize_translations_exists,
    to_regclass('public.special_offer_links') is not null as links_exists,
    to_regclass('public.special_offer_link_translations') is not null as link_translations_exists,
    to_regclass('public.special_offer_form_fields') is not null as form_fields_exists,
    to_regclass('public.special_offer_form_field_translations') is not null as form_field_translations_exists,
    exists (select 1 from fn) as rpc_exists,
    coalesce((select prosecdef from fn), false) as rpc_security_definer,
    coalesce((select proconfig from fn), '') like '%search_path=pg_catalog, public%' as rpc_safe_search_path,
    coalesce((select owner_name from fn), '') = 'postgres' as rpc_owner_ok,
    not coalesce((select public_execute from grants), true) as public_execute_absent,
    coalesce((select anon_execute from grants), false) as anon_execute_present,
    coalesce((select authenticated_execute from grants), false) as authenticated_execute_present,
    not coalesce((select service_role_execute from grants), false) as service_role_execute_absent,
    not coalesce((select anon_public_write_grants_present from table_grants), true) as no_anon_public_table_write_grants,
    coalesce((select returns_jsonb_type from fn), false) as returns_jsonb,
    coalesce((select normalized_source from fn), '') like '%o.status = ''active''%' as active_status_guard_present,
    coalesce((select normalized_source from fn), '') like '%o.visibility = ''public''%' as public_visibility_guard_present,
    coalesce((select normalized_source from fn), '') like '%o.start_at is not null%' as start_required_present,
    coalesce((select normalized_source from fn), '') like '%o.end_at is not null%' as end_required_present,
    coalesce((select normalized_source from fn), '') like '%now() >= o.start_at%' as lower_date_guard_present,
    coalesce((select normalized_source from fn), '') like '%now() <= o.end_at%' as upper_date_guard_present,
    coalesce((select normalized_source from fn), '') like '%o.archived_at is null%' as archived_guard_present,
    coalesce((select normalized_source from fn), '') like '%''campaign''%' as campaign_payload_present,
    coalesce((select normalized_source from fn), '') like '%''translations''%' as translations_payload_present,
    coalesce((select normalized_source from fn), '') like '%''prizes''%' as prizes_payload_present,
    coalesce((select normalized_source from fn), '') like '%''links''%' as links_payload_present,
    coalesce((select normalized_source from fn), '') like '%''formfields''%' as form_fields_payload_present,
    coalesce((select normalized_source from fn), '') not like '%special_offer_entries%' as no_entries_read,
    coalesce((select normalized_source from fn), '') not like '%special_offer_entry_answers%' as no_answers_read,
    coalesce((select normalized_source from fn), '') not like '%special_offer_entry_activities%' as no_activities_read,
    coalesce((select normalized_source from fn), '') not like '%special_offer_audit_log%' as no_audit_log_read,
    coalesce((select normalized_source from fn), '') not like '%auth.users%' as no_auth_users_read,
    coalesce((select normalized_source from fn), '') not like '%insert into%' as no_insert,
    coalesce((select normalized_source from fn), '') not like '%update public.%' as no_update,
    coalesce((select normalized_source from fn), '') not like '%delete from%' as no_delete,
    to_regclass('public.special_offer_draws') is null as no_draws_table,
    to_regclass('public.special_offer_winners') is null as no_winners_table
)
select
  *,
  (
    special_offers_exists
    and translations_exists
    and prizes_exists
    and prize_translations_exists
    and links_exists
    and link_translations_exists
    and form_fields_exists
    and form_field_translations_exists
    and rpc_exists
    and rpc_security_definer
    and rpc_safe_search_path
    and rpc_owner_ok
    and public_execute_absent
    and anon_execute_present
    and authenticated_execute_present
    and service_role_execute_absent
    and no_anon_public_table_write_grants
    and returns_jsonb
    and active_status_guard_present
    and public_visibility_guard_present
    and start_required_present
    and end_required_present
    and lower_date_guard_present
    and upper_date_guard_present
    and archived_guard_present
    and campaign_payload_present
    and translations_payload_present
    and prizes_payload_present
    and links_payload_present
    and form_fields_payload_present
    and no_entries_read
    and no_answers_read
    and no_activities_read
    and no_audit_log_read
    and no_auth_users_read
    and no_insert
    and no_update
    and no_delete
    and no_draws_table
    and no_winners_table
  ) as overall_pass
from checks;
