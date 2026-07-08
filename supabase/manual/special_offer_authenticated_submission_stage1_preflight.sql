-- Special Offers 3C.5C-1 preflight only.
-- Read-only diagnostics before authenticated-only submit_special_offer_entry.
-- This script must not modify data, grants, RLS, policies or functions.
-- It intentionally reports counts only; it does not expose entry references,
-- emails, phone numbers, answers or other participant PII.

with entry_totals as (
  select
    count(*)::bigint as total_entries,
    count(*) filter (where e.user_id is null)::bigint as entries_without_user_id,
    count(*) filter (where e.user_id is not null)::bigint as entries_with_user_id
  from public.special_offer_entries e
),
campaign_counts as (
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'offer_id', o.id,
          'slug', o.slug,
          'status', o.status,
          'visibility', o.visibility,
          'total_entries', coalesce(c.total_entries, 0),
          'entries_without_user_id', coalesce(c.entries_without_user_id, 0),
          'entries_with_user_id', coalesce(c.entries_with_user_id, 0)
        )
        order by o.slug
      ),
      '[]'::jsonb
    ) as campaigns
  from public.special_offers o
  left join (
    select
      offer_id,
      count(*)::bigint as total_entries,
      count(*) filter (where user_id is null)::bigint as entries_without_user_id,
      count(*) filter (where user_id is not null)::bigint as entries_with_user_id
    from public.special_offer_entries
    group by offer_id
  ) c on c.offer_id = o.id
),
entry_user_id_column as (
  select
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'special_offer_entries'
        and column_name = 'user_id'
    ) as user_id_column_exists,
    coalesce((
      select data_type::text
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'special_offer_entries'
        and column_name = 'user_id'
      limit 1
    ), '') as user_id_data_type,
    coalesce((
      select udt_name::text
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'special_offer_entries'
        and column_name = 'user_id'
      limit 1
    ), '') as user_id_udt_name,
    coalesce((
      select is_nullable = 'YES'
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'special_offer_entries'
        and column_name = 'user_id'
      limit 1
    ), false) as user_id_is_nullable
),
entry_user_id_fk as (
  select
    exists (
      select 1
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
      join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any(con.conkey)
      where ns.nspname = 'public'
        and rel.relname = 'special_offer_entries'
        and con.contype = 'f'
        and att.attname = 'user_id'
        and to_regclass('auth.users') is not null
        and con.confrelid = to_regclass('auth.users')
    ) as user_id_fk_to_auth_users
),
entry_unique_constraints as (
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'constraint_name', con.conname,
          'definition', pg_get_constraintdef(con.oid)
        )
        order by con.conname
      ),
      '[]'::jsonb
    ) as unique_constraints,
    exists (
      select 1
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
      where ns.nspname = 'public'
        and rel.relname = 'special_offer_entries'
        and con.contype = 'u'
        and pg_get_constraintdef(con.oid) ilike '%offer_id%'
        and pg_get_constraintdef(con.oid) ilike '%client_submission_id%'
    ) as offer_client_submission_unique_exists,
    exists (
      select 1
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
      where ns.nspname = 'public'
        and rel.relname = 'special_offer_entries'
        and con.contype = 'u'
        and pg_get_constraintdef(con.oid) ilike '%reference%'
    ) as reference_unique_exists
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace ns on ns.oid = rel.relnamespace
  where ns.nspname = 'public'
    and rel.relname = 'special_offer_entries'
    and con.contype = 'u'
),
rpc as (
  select
    p.oid,
    p.prosecdef,
    p.proowner,
    coalesce(p.proconfig, array[]::text[]) as proconfig,
    pg_get_function_identity_arguments(p.oid) as signature
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'submit_special_offer_entry'
    and pg_get_function_identity_arguments(p.oid) = 'p_offer_slug text, p_lang text, p_answers jsonb, p_client_submission_id uuid'
),
rpc_checks as (
  select
    exists (select 1 from rpc) as rpc_exists,
    coalesce((select signature from rpc), '') as rpc_signature,
    coalesce((select prosecdef from rpc), false) as rpc_security_definer,
    coalesce((select 'search_path=pg_catalog, public' = any(proconfig) from rpc), false) as rpc_safe_search_path,
    coalesce((select pg_get_userbyid(proowner) from rpc), '') as rpc_owner,
    coalesce((select pg_get_userbyid(proowner) = 'postgres' from rpc), false) as rpc_owner_is_postgres,
    case
      when exists (select 1 from rpc)
      then has_function_privilege('public', 'public.submit_special_offer_entry(text,text,jsonb,uuid)', 'EXECUTE')
      else false
    end as public_execute_current,
    case
      when exists (select 1 from rpc)
      then has_function_privilege('anon', 'public.submit_special_offer_entry(text,text,jsonb,uuid)', 'EXECUTE')
      else false
    end as anon_execute_current,
    case
      when exists (select 1 from rpc)
      then has_function_privilege('authenticated', 'public.submit_special_offer_entry(text,text,jsonb,uuid)', 'EXECUTE')
      else false
    end as authenticated_execute_current,
    case
      when exists (select 1 from rpc)
      then has_function_privilege('service_role', 'public.submit_special_offer_entry(text,text,jsonb,uuid)', 'EXECUTE')
      else false
    end as service_role_execute_current
),
profile_columns as (
  select
    to_regclass('public.profiles') is not null as profiles_table_exists,
    coalesce(
      (
        select jsonb_agg(column_name::text order by column_name::text)
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'profiles'
          and column_name in ('id', 'name', 'phone', 'preferred_language', 'updated_at')
      ),
      '[]'::jsonb
    ) as enrichment_candidate_columns,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'name'
    ) as profile_name_column_exists,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'phone'
    ) as profile_phone_column_exists,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'preferred_language'
    ) as profile_preferred_language_column_exists,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'updated_at'
    ) as profile_updated_at_column_exists,
    (
      not exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'profiles'
          and column_name = 'preferred_language'
      )
      or not exists (
        select 1
        from pg_constraint con
        join pg_class rel on rel.oid = con.conrelid
        join pg_namespace ns on ns.oid = rel.relnamespace
        where ns.nspname = 'public'
          and rel.relname = 'profiles'
          and con.contype = 'c'
          and pg_get_constraintdef(con.oid) ilike '%preferred_language%'
      )
      or exists (
        select 1
        from pg_constraint con
        join pg_class rel on rel.oid = con.conrelid
        join pg_namespace ns on ns.oid = rel.relnamespace
        where ns.nspname = 'public'
          and rel.relname = 'profiles'
          and con.contype = 'c'
          and pg_get_constraintdef(con.oid) ilike '%preferred_language%'
          and pg_get_constraintdef(con.oid) ilike '%he%'
      )
    ) as profile_preferred_language_he_safe
),
direct_write_grants as (
  select
    not exists (
      select 1
      from information_schema.table_privileges
      where table_schema = 'public'
        and table_name in ('special_offer_entries', 'special_offer_entry_answers')
        and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
        and grantee in ('PUBLIC', 'anon', 'authenticated')
    )
    and not exists (
      select 1
      from information_schema.column_privileges
      where table_schema = 'public'
        and table_name in ('special_offer_entries', 'special_offer_entry_answers')
        and privilege_type in ('INSERT', 'UPDATE')
        and grantee in ('PUBLIC', 'anon', 'authenticated')
    ) as no_public_direct_entry_answer_writes
),
required_structure as (
  select
    to_regclass('public.special_offers') is not null as special_offers_exists,
    to_regclass('public.special_offer_form_fields') is not null as form_fields_exists,
    to_regclass('public.special_offer_form_field_translations') is not null as form_field_translations_exists,
    to_regclass('public.special_offer_entries') is not null as entries_exists,
    to_regclass('public.special_offer_entry_answers') is not null as answers_exists,
    to_regprocedure('public.is_current_user_admin()') is not null as admin_helper_exists
)
select
  true as preflight_read_only,
  rs.special_offers_exists,
  rs.form_fields_exists,
  rs.form_field_translations_exists,
  rs.entries_exists,
  rs.answers_exists,
  rs.admin_helper_exists,
  et.total_entries,
  et.entries_without_user_id,
  et.entries_with_user_id,
  cc.campaigns as entry_counts_by_campaign,
  uc.user_id_column_exists,
  uc.user_id_data_type,
  uc.user_id_udt_name,
  (uc.user_id_udt_name = 'uuid') as user_id_is_uuid,
  uc.user_id_is_nullable,
  fk.user_id_fk_to_auth_users,
  eu.unique_constraints as entry_unique_constraints,
  eu.offer_client_submission_unique_exists,
  eu.reference_unique_exists,
  rc.rpc_exists,
  rc.rpc_signature,
  (rc.rpc_signature = 'p_offer_slug text, p_lang text, p_answers jsonb, p_client_submission_id uuid') as rpc_signature_ok,
  rc.rpc_security_definer,
  rc.rpc_safe_search_path,
  rc.rpc_owner,
  rc.rpc_owner_is_postgres,
  rc.public_execute_current,
  rc.anon_execute_current,
  rc.authenticated_execute_current,
  rc.service_role_execute_current,
  pc.profiles_table_exists,
  pc.enrichment_candidate_columns,
  pc.profile_name_column_exists,
  pc.profile_phone_column_exists,
  pc.profile_preferred_language_column_exists,
  pc.profile_updated_at_column_exists,
  pc.profile_preferred_language_he_safe,
  dw.no_public_direct_entry_answer_writes,
  (
    rs.special_offers_exists
    and rs.form_fields_exists
    and rs.form_field_translations_exists
    and rs.entries_exists
    and rs.answers_exists
    and rs.admin_helper_exists
    and uc.user_id_column_exists
    and uc.user_id_udt_name = 'uuid'
    and uc.user_id_is_nullable
    and fk.user_id_fk_to_auth_users
    and eu.offer_client_submission_unique_exists
    and eu.reference_unique_exists
    and rc.rpc_exists
    and rc.rpc_signature = 'p_offer_slug text, p_lang text, p_answers jsonb, p_client_submission_id uuid'
    and rc.rpc_security_definer
    and rc.rpc_safe_search_path
    and rc.rpc_owner_is_postgres
    and pc.profiles_table_exists
    and pc.profile_name_column_exists
    and pc.profile_updated_at_column_exists
    and pc.profile_preferred_language_he_safe
    and dw.no_public_direct_entry_answer_writes
  ) as preflight_safe_to_continue
from entry_totals et
cross join campaign_counts cc
cross join entry_user_id_column uc
cross join entry_user_id_fk fk
cross join entry_unique_constraints eu
cross join rpc_checks rc
cross join profile_columns pc
cross join direct_write_grants dw
cross join required_structure rs;
